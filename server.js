// Máy chủ Node để chạy thử cục bộ (npm start). Bản triển khai Cloudflare dùng src/worker.js.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './src/app.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const MIME = { '.webp': 'image/webp', '.woff2': 'font/woff2', '.otf': 'font/otf', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };

export function fsStore(dataDir = path.join(ROOT, 'data'), publicDir = path.join(ROOT, 'public')) {
  const dbFile = path.join(dataDir, 'tour.json'), upDir = path.join(dataDir, 'uploads');
  fs.mkdirSync(upDir, { recursive: true });
  return {
    async getJson() { return fs.existsSync(dbFile) ? JSON.parse(fs.readFileSync(dbFile, 'utf8')) : null; },
    async putJson(obj) { fs.writeFileSync(dbFile, JSON.stringify(obj, null, 2)); },
    async getSeed() { const f = path.join(publicDir, 'seed', 'tour.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; },
    async getAsset(name) { const f = path.join(upDir, path.basename(name)); return fs.existsSync(f) ? { data: fs.readFileSync(f), type: MIME[path.extname(f)] || 'application/octet-stream' } : null; },
    async putAsset(name, bytes) { fs.writeFileSync(path.join(upDir, path.basename(name)), bytes); },
    async deleteAsset(name) { fs.rmSync(path.join(upDir, path.basename(name)), { force: true }); }
  };
}

export function createServer({ store = fsStore(), env = process.env, publicDir = path.join(ROOT, 'public') } = {}) {
  const app = createApp({ store, env });
  return http.createServer(async (req, res) => {
    try {
      const chunks = []; for await (const c of req) chunks.push(c);
      const body = chunks.length ? Buffer.concat(chunks) : undefined;
      const request = new Request(`http://${req.headers.host || 'localhost'}${req.url}`, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body });
      const out = await app.handle(request);
      if (out) { res.writeHead(out.status, Object.fromEntries(out.headers)); res.end(Buffer.from(await out.arrayBuffer())); return; }
      const p = decodeURIComponent(new URL(request.url).pathname);
      const rel = p === '/' ? 'index.html' : p === '/admin' || p === '/admin/' ? 'admin/index.html' : p.slice(1);
      let file = path.join(publicDir, rel);
      if (!path.extname(file) && !fs.existsSync(file) && fs.existsSync(file + '.html')) file += '.html';
      if (!file.startsWith(publicDir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    } catch (e) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: e.message })); }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = process.env.PORT || 3360;
  createServer().listen(port, () => console.log(`Pristine Tower: http://localhost:${port}  |  Admin: http://localhost:${port}/admin`));
}
