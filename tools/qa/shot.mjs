// Quick visual check: open the game in a phone viewport, optionally drive it, save screenshots.
// node tools/qa/shot.mjs [--file] [--w 390 --h 844 --dpr 3] [--steps steps.json] [--out dir] [--page dev.html]
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const W = +arg('w', 390), H = +arg('h', 844), DPR = +arg('dpr', 3);
const outDir = arg('out', '/tmp/claude-0/shots');
const pageName = arg('page', 'index.html');
fs.mkdirSync(outDir, { recursive: true });

export function serve(dir, port = 0) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.mp4': 'video/mp4', '.vtt': 'text/vtt', '.md': 'text/markdown' };
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(dir, p);
    if (!f.startsWith(dir) || !fs.existsSync(f)) { res.writeHead(404); return res.end('nf'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((r) => srv.listen(port, () => r(srv)));
}

export async function openGame({ w = W, h = H, dpr = DPR, file = false, page = pageName, lang = 'ko-KR', storage = null } = {}) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true, locale: lang });
  const pg = await context.newPage();
  const errors = [];
  pg.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
  pg.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
  let srv = null, url;
  if (file) url = 'file://' + path.join(root, 'out', page);
  else { srv = await serve(path.join(root, 'out')); url = `http://127.0.0.1:${srv.address().port}/${page}`; }
  if (storage) await pg.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, storage);
  await pg.goto(url);
  return { browser, context, page: pg, errors, close: async () => { await browser.close(); if (srv) srv.close(); } };
}

// drag with touch-like pointer events (mouse is fine: pointer events are unified)
export async function drag(page, x0, y0, path2, ms = 1000) {
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  const steps = Math.max(2, Math.round(ms / 16));
  for (let i = 1; i <= steps; i++) {
    const k = i / steps;
    const seg = path2.length - 1;
    const si = Math.min(seg - 1, Math.floor(k * seg));
    const lk = k * seg - si;
    const [ax, ay] = path2[si], [bx, by] = path2[si + 1];
    await page.mouse.move(ax + (bx - ax) * lk, ay + (by - ay) * lk);
    await page.waitForTimeout(16);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const g = await openGame({ file: args.includes('--file') });
  await g.page.waitForTimeout(+arg('wait', 2500));
  await g.page.screenshot({ path: path.join(outDir, arg('name', 'shot') + '.png') });
  console.log('errors:', g.errors.length ? g.errors.join('\n') : 'none');
  await g.close();
}
