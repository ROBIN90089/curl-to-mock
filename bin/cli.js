#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { createMockServer } from '../src/server.js';

const help = `curl-to-mock — a JSON file, a working API.

Usage: curl-to-mock <file.json> [options]

Options:
  --port <number>    Listening port (default: 4000; 0 selects a free port)
  --host <address>   Bind address (default: 127.0.0.1)
  --path <path>      Endpoint path (default: /)
  --delay <ms>       Response delay, 0–60000 (default: 0)
  --status <code>    HTTP status, 200–599 (default: 200)
  --cors <origin>    Allowed origin (default: *)
  -h, --help        Show help
  -v, --version     Show version

Examples:
  curl-to-mock examples/products.json
  curl-to-mock examples/login-error.json --path /login --status 401
  curl-to-mock examples/pagination.json --delay 800
`;

function parse(args) {
  const options = {};
  let file;
  const names = new Set(['port', 'host', 'path', 'delay', 'status', 'cors']);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('-')) {
      const name = arg.slice(2);
      if (!names.has(name)) throw new Error(`Unknown option: ${arg}`);
      const value = args[++i];
      if (value === undefined || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      options[name] = value;
    } else if (!file) file = arg;
    else throw new Error(`Unexpected argument: ${arg}`);
  }
  if (!file) throw new Error('Provide a JSON file. Run with --help for usage.');
  for (const [name, min, max, fallback] of [['port', 0, 65535, 4000], ['delay', 0, 60000, 0], ['status', 200, 599, 200]]) {
    const value = options[name] ?? String(fallback);
    if (!/^\d+$/.test(value) || Number(value) < min || Number(value) > max) throw new Error(`--${name} must be an integer between ${min} and ${max}`);
    options[name] = Number(value);
  }
  options.path ??= '/';
  options.host ??= '127.0.0.1';
  options.cors ??= '*';
  if (!options.path.startsWith('/') || /[?#\s]/.test(options.path)) throw new Error('--path must start with / and contain no query, fragment, or whitespace');
  if (!options.host.trim()) throw new Error('--host cannot be empty');
  if (!options.cors.trim() || /[\r\n]/.test(options.cors)) throw new Error('--cors must be a nonempty origin without newlines');
  return { file, options };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) return console.log(help);
  if (args.includes('--version') || args.includes('-v')) return console.log('0.1.0');
  const { file, options } = parse(args);
  let raw;
  try { raw = await readFile(file, 'utf8'); }
  catch (error) { throw new Error(`Cannot read ${file}: ${error.code}`); }
  let data;
  try { data = JSON.parse(raw); }
  catch { throw new Error(`Invalid JSON in ${file}`); }
  const server = createMockServer(data, options);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port, options.host, resolve);
  });
  const address = server.address();
  const host = address.address.includes(':') ? `[${address.address}]` : address.address;
  console.log(`\n  curl-to-mock\n\n  Ready → http://${host}:${address.port}${options.path}\n  File  → ${file}\n  HTTP  → ${options.status} · delay ${options.delay}ms · CORS ${options.cors}\n\n  Press Ctrl+C to stop.\n`);
  server.on('error', error => { console.error(`Error: ${error.message}`); process.exitCode = 1; });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
    server.close();
    server.closeAllConnections();
  });
}
main().catch(error => { console.error(`Error: ${error.message}`); process.exitCode = 1; });
