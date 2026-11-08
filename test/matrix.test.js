import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMockServer } from '../src/server.js';

async function serve(t, data, options) {
  const server = createMockServer(data, options);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  return `http://127.0.0.1:${server.address().port}`;
}

const statuses = [200,201,202,203,204,205,206,207,208,226,300,301,302,303,304,307,308,400,401,500];
for (const method of ['GET','POST','HEAD']) {
  for (const status of statuses) test(`${method} preserves HTTP ${status} and correct body semantics`, async t => {
    const url = await serve(t, { message: 'fixture' }, { status });
    const response = await fetch(url, { method, redirect: 'manual' });
    assert.equal(response.status, status);
    const body = await response.text();
    if (method === 'HEAD' || [204,205,304].includes(status)) assert.equal(body, '');
    else {
      assert.deepEqual(JSON.parse(body), { message: 'fixture' });
      assert.match(response.headers.get('content-type'), /application\/json/);
    }
  });
}

const paths = ['/','/api','/api/v1/products','/users','/login','/a-b','/a_b','/v2','/products/42','/trailing/','/a.b','/UPPER','/encoded%20path','/nested/very/deep','/0','/health'];
for (const path of paths) test(`exact routing for ${path}, query strings and unmatched paths`, async t => {
  const url = await serve(t, { path }, { path });
  assert.deepEqual(await (await fetch(url + path + '?page=2&search=x')).json(), { path });
  const missing = await fetch(url + '/not-configured-route');
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { error: 'Not found', endpoint: path });
});

const origins = ['*','http://localhost:5173','http://127.0.0.1:3000','https://example.com','https://app.example.com','http://localhost:8080','https://example.com:8443','null'];
for (const cors of origins) test(`CORS response and preflight for ${cors}`, async t => {
  const url = await serve(t, {}, { cors });
  const response = await fetch(url);
  assert.equal(response.headers.get('access-control-allow-origin'), cors);
  const preflight = await fetch(url, { method: 'OPTIONS', headers: { 'Access-Control-Request-Headers': 'authorization, x-request-id' } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), cors);
  assert.equal(preflight.headers.get('access-control-allow-headers'), 'authorization, x-request-id');
  assert.match(preflight.headers.get('access-control-allow-methods'), /POST/);
  assert.equal(await preflight.text(), '');
});

for (const delay of [0,25,75,150]) test(`configured delay ${delay}ms preserves response`, async t => {
  const url = await serve(t, { delay }, { delay });
  const start = performance.now();
  assert.deepEqual(await (await fetch(url)).json(), { delay });
  assert.ok(performance.now() - start >= delay - 5);
});

for (const [name, data] of [['array',[1,'two',false]],['null',null],['unicode',{message:'سلام 👋 café',nested:{enabled:true}}],['scalar','hello']]) {
  test(`round trips ${name} JSON`, async t => {
    const url = await serve(t, data, {});
    const response = await fetch(url);
    assert.deepEqual(await response.json(), data);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  });
}
