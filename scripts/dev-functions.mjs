// Local stand-in for Netlify Functions (dev only).
//   node --env-file=.env scripts/dev-functions.mjs   → http://localhost:9999
// Vite proxies /.netlify/functions/* here (vite.config.js), so the site at
// http://localhost:5173 behaves like on Netlify. Not used in production.
import http from 'http';
import path from 'path';
import { pathToFileURL } from 'url';

const PORT = 9999;
const dir = path.resolve('netlify/functions');

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const name = url.pathname.replace(/^\/\.netlify\/functions\//, '').split('/')[0];
    if (!/^[a-z0-9-]+$/.test(name)) return res.writeHead(404).end('no such function');

    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks).toString('utf8');

    try {
      const mod = await import(pathToFileURL(path.join(dir, `${name}.js`)).href);
      const out = await mod.handler({
        httpMethod: req.method,
        path: url.pathname,
        headers: req.headers,
        queryStringParameters: Object.fromEntries(url.searchParams),
        body,
        isBase64Encoded: false,
      });
      const payload = out.isBase64Encoded ? Buffer.from(out.body || '', 'base64') : out.body || '';
      res.writeHead(out.statusCode || 200, out.headers || {}).end(payload);
      console.log(req.method, url.pathname, '→', out.statusCode);
    } catch (e) {
      console.error(req.method, url.pathname, 'ERROR', e.message);
      res.writeHead(500).end('function error');
    }
  })
  .listen(PORT, () => console.log(`functions on http://localhost:${PORT}`));
