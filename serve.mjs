import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

// Optional .env.local (KEY=value per line, never committed) — e.g. TELEGRAM_BOT_TOKEN and
// TELEGRAM_CHAT_ID to send real test requests from localhost.
const envFile = path.join(__dirname, '.env.local');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

// Local stand-in for Vercel functions: /api/<name> runs api/<name>.js with the same req/res helpers
const require = createRequire(import.meta.url);
const seen = {};
function runFunction(name, req, res) {
  const file = path.join(__dirname, 'api', name + '.js');
  if (!/^[a-z0-9-]+$/.test(name) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
  let raw = '';
  req.on('data', (c) => { raw += c; if (raw.length > 1e6) req.destroy(); });
  req.on('end', async () => {
    try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = raw; }
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (obj) => { if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); return res; };
    const m = fs.statSync(file).mtimeMs;            // pick up edits without restarting, keep state otherwise
    if (seen[file] !== m) { delete require.cache[file]; seen[file] = m; }
    try { await require(file)(req, res); } catch (e) { console.error(e); if (!res.writableEnded) res.status(500).json({ ok: false, error: 'crashed' }); }
  });
}

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
  '.webmanifest': 'application/manifest+json',
};

http.createServer((req, res) => {
  const api = req.url.split('?')[0].match(/^\/api\/([^/]+)\/?$/);
  if (api) { runFunction(api[1], req, res); return; }
  let urlPath = req.url.split('?')[0];
  urlPath = decodeURIComponent(urlPath);
  if (urlPath.endsWith('/')) urlPath += 'index.html';   // /en/ -> /en/index.html, like the live host
  const filePath = path.join(__dirname, urlPath);
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    } else {
      res.writeHead(200, { 'Content-Type': mime });
      res.end(data);
    }
  });
}).listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
