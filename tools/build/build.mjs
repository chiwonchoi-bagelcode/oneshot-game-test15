// Build: fonts subset, JS bundles (release + dev + editor), HTML with inlined CSS, PWA files.
// Usage: node tools/build/build.mjs [--skip-fonts]
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = path.join(root, 'out');
const P = (...a) => path.join(root, ...a);

if (!process.argv.includes('--skip-fonts') || !fs.existsSync(P('.cache', 'fonts.css'))) {
  execSync('python3 tools/build/fonts.py', { cwd: root, stdio: 'inherit' });
}
execSync('node tools/levels/gen.mjs', { cwd: root, stdio: 'inherit' });

const common = { bundle: true, format: 'iife', target: ['es2019', 'safari13'], loader: { '.json': 'json' }, legalComments: 'none', logLevel: 'warning' };
await esbuild.build({ ...common, entryPoints: [P('src/main.js')], outfile: P('out/game.js'), minify: true, define: { __DEV__: 'false' } });
await esbuild.build({ ...common, entryPoints: [P('src/main.js')], outfile: P('out/game.dev.js'), minify: false, sourcemap: 'inline', define: { __DEV__: 'true' } });
await esbuild.build({ ...common, entryPoints: [P('editor/editor.js')], outfile: P('out/tools/editor.js'), minify: true, define: { __DEV__: 'true' } });

const css = fs.readFileSync(P('.cache/fonts.css'), 'utf8') + '\n' + fs.readFileSync(P('src/ui/style.css'), 'utf8');
const minCss = (await esbuild.transform(css, { loader: 'css', minify: true })).code;
const tpl = fs.readFileSync(P('src/index.html'), 'utf8');
fs.writeFileSync(P('out/index.html'), tpl.replace('/*CSS*/', minCss).replace('/*GAMEJS*/', 'game.js'));
fs.writeFileSync(P('out/dev.html'), tpl.replace('/*CSS*/', minCss).replace('/*GAMEJS*/', 'game.dev.js').replace('<title>', '<title>[DEV] '));

// editor page
const etpl = fs.readFileSync(P('editor/editor.html'), 'utf8');
fs.mkdirSync(P('out/tools'), { recursive: true });
fs.writeFileSync(P('out/tools/editor.html'), etpl.replace('/*FONTS*/', fs.readFileSync(P('.cache/fonts.css'), 'utf8')));

// PWA
fs.writeFileSync(P('out/manifest.webmanifest'), JSON.stringify({
  name: '물때 섬 · Low Tide Island', short_name: '물때 섬', start_url: './index.html', display: 'standalone',
  orientation: 'portrait', background_color: '#2c638e', theme_color: '#2c638e',
  icons: [{ src: 'assets/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'assets/icon-512.png', sizes: '512x512', type: 'image/png' }],
}, null, 1));
const cacheList = ['./', 'index.html', 'game.js', 'assets/world.png', 'assets/ui.png', 'assets/logo.png', 'assets/audio-sfx.js', 'assets/audio-music.js',
  ...fs.readdirSync(P('out/assets/ui')).map((f) => 'assets/ui/' + f)];
const ver = Date.now().toString(36);
fs.writeFileSync(P('out/sw.js'), `// offline cache (release build)
const C='lowtide-${ver}';const F=${JSON.stringify(cacheList)};
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(F).catch(()=>{})));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))));self.clients.claim();});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{const cp=res.clone();caches.open(C).then(c=>c.put(e.request,cp));return res;})));});
`);
fs.copyFileSync(P('node_modules/galmuri/ofl.md'), P('out/assets/FONT-LICENSE-Galmuri.md'));

const sz = (f) => fs.existsSync(f) ? fs.statSync(f).size : 0;
console.log('game.js', sz(P('out/game.js')), 'index.html', sz(P('out/index.html')), 'world.png', sz(P('out/assets/world.png')));
