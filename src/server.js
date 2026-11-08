import { createServer } from 'node:http';

/** Serve a fixed JSON fixture on one endpoint. Query strings do not affect matching. */
export function createMockServer(data, { path = '/', delay = 0, status = 200, cors = '*' } = {}) {
  const body = JSON.stringify(data, null, 2) + '\n';
  return createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', cors);
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || 'Content-Type, Authorization');
    res.setHeader('Vary', 'Origin, Access-Control-Request-Headers');
    res.setHeader('Cache-Control', 'no-store');
    // Drain request bodies so POST/PUT clients can reuse their connections.
    req.resume();
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    const requestPath = (req.url || '/').split('?')[0];
    if (requestPath !== path) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ error: 'Not found', endpoint: path }) + '\n');
      return;
    }
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    if (res.destroyed) return;
    const noBody = status === 204 || status === 205 || status === 304;
    res.writeHead(status, noBody ? {} : { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(req.method === 'HEAD' || noBody ? undefined : body);
  });
}
