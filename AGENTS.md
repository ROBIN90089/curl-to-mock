# Working on curl-to-mock

## Project
Dependency-free Node.js CLI that serves one JSON fixture as a local HTTP endpoint. Requires Node.js 20+. Uses ES modules and the built-in HTTP server and test runner.

## Layout
- `bin/cli.js`: CLI arguments, file loading, startup, shutdown, errors.
- `src/server.js`: HTTP responses, delay, CORS and routing.
- `test/mock.test.js`: integration tests using real HTTP and subprocesses.
- `examples/`: products, failed login and pagination fixtures.

## Setup and verification
Run `npm ci`, then `npm test`. Run `npm pack --dry-run` when changing package contents. To try the server: `node bin/cli.js examples/products.json --port 4000`. Stop the server when finished.

## Changes
Keep runtime dependencies at zero unless the requested feature requires otherwise. Preserve loopback binding by default. Validate user-facing options and keep errors actionable. Update CLI help and README for behavior changes. Add meaningful regression coverage for new behavior; do not use real credentials or external APIs in tests. Preserve correct HEAD, OPTIONS, and bodyless-status behavior.

## Current scope
One file, one route, static response. Curl import, multiple routes and file watching are future features; implement only when requested. The package has not been published to npm. Do not claim that npx installation works until publication is verified.
