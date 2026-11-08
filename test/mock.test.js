import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createMockServer } from '../src/server.js';

async function fixture(t, options = {}) {
  const server = createMockServer({ ok: true }, options);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  return `http://127.0.0.1:${server.address().port}`;
}
test('serves JSON for GET and POST, ignores query, handles HEAD and 404', async t => {
  const url = await fixture(t, { path: '/api' });
  for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
    const response = await fetch(url + '/api?page=1', { method });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(response.headers.get('access-control-allow-origin'), '*');
  }
  assert.equal(await (await fetch(url + '/api', { method: 'HEAD' })).text(), '');
  assert.equal((await fetch(url + '/wrong')).status, 404);
});
test('custom status, origin and CORS preflight', async t => {
  const url = await fixture(t, { status: 401, cors: 'http://localhost:5173' });
  const response = await fetch(url);
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  const preflight = await fetch(url, { method: 'OPTIONS', headers: { 'Access-Control-Request-Headers': 'x-test, authorization' } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-headers'), 'x-test, authorization');
});
test('delays responses', async t => {
  const url = await fixture(t, { delay: 100 });
  const start = performance.now();
  await (await fetch(url)).text();
  assert.ok(performance.now() - start >= 90);
});
for (const status of [204, 205, 304]) test(`status ${status} has no body`, async t => {
  const url = await fixture(t, { status });
  const response = await fetch(url);
  assert.equal(response.status, status);
  assert.equal(await response.text(), '');
});
test('CLI rejects invalid inputs with useful errors', () => {
  for (const [args, message] of [
    [[], /Provide a JSON file/],
    [['missing.json'], /Cannot read/],
    [['package.json', '--port', 'abc'], /--port must/],
    [['package.json', '--delay', '-1'], /--delay must/],
    [['package.json', '--status', '999'], /--status must/],
    [['package.json', '--path', 'bad'], /--path must/],
    [['package.json', '--unknown'], /Unknown option/],
    [['package.json', '--port'], /Missing value/],
    [['README.md'], /Invalid JSON/],
  ]) {
    const result = spawnSync(process.execPath, ['bin/cli.js', ...args], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, message);
  }
});
test('CLI starts with actual file and stops on SIGTERM', { timeout: 5000 }, async t => {
  const child = spawn(process.execPath, ['bin/cli.js', 'examples/products.json', '--port', '0']);
  t.after(() => child.kill('SIGKILL'));
  let output = '';
  const url = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+\//);
      if (match) resolve(match[0]);
    });
    child.once('exit', code => reject(new Error(`Early exit: ${code}`)));
  });
  const response = await fetch(url);
  assert.equal((await response.json()).products.length, 2);
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  const [code] = await exited;
  assert.equal(code, 0);
});
