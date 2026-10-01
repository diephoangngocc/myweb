// Server chạy thử trên máy: phục vụ public/ + /api/state (giống Vercel) — `npm run dev`
// Đồng bộ chỉ hoạt động khi có REDIS_URL hoặc KV_REST_API_URL + KV_REST_API_TOKEN (đặt trong .env.local
// hoặc lấy về bằng `vercel env pull .env.local`). Không có thì app tự chạy chế độ "chỉ lưu trên máy".
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');
const require = createRequire(import.meta.url);

for (const f of ['.env.local', '.env']) {
  const p = join(root, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const handler = require(join(root, 'api', 'state.js'));
const vercel = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));
const headers = (vercel.headers || []).flatMap(h => h.headers);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.md': 'text/markdown; charset=utf-8', '.png': 'image/png' };

const server = createServer(async (req, res) => {
  for (const h of headers) res.setHeader(h.key, h.value);
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/state') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString('utf8');
    req.query = Object.fromEntries(url.searchParams);
    let parsed = null, bad = false;
    if (raw) { try { parsed = JSON.parse(raw); } catch (e) { bad = true; } }
    Object.defineProperty(req, 'body', { get() { if (bad) throw new Error('Invalid JSON'); return parsed; } });
    return handler(req, res);
  }
  let p = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  let file = join(pub, p || 'index.html');
  if (!file.startsWith(pub)) { res.statusCode = 403; return res.end(); }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) { res.statusCode = 404; return res.end('Not found'); }
  res.setHeader('Content-Type', MIME[extname(file)] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-store');
  res.end(readFileSync(file));
});

const port = Number(process.env.PORT || 3000);
server.listen(port, () => {
  const synced = Object.entries(process.env).some(([k, v]) => /(^|_)(KV_REST_API_URL|UPSTASH_REDIS_REST_URL)$/.test(k) || (/(^|_)(REDIS_URL|KV_URL)$/.test(k) && /^rediss?:\/\//.test(v || '')));
  console.log(`Planner 2026 → http://localhost:${port}  (${synced ? 'đồng bộ: BẬT' : 'đồng bộ: TẮT — thiếu REDIS_URL hoặc KV_REST_API_*'})`);
});
