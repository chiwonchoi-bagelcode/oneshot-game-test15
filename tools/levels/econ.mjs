// node tools/levels/econ.mjs [--runs 120] [--seeds 3]
import * as esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = path.join(root, '.cache', 'econ.bundle.mjs');
await esbuild.build({ entryPoints: [path.join(root, 'tools/levels/econ-src.mjs')], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'warning' });
const mod = await import(pathToFileURL(out).href);
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? +process.argv[i + 1] : d; };
const runs = arg('runs', 120), seeds = arg('seeds', 3);
for (let s = 1; s <= seeds; s++) {
  const t0 = Date.now();
  const r = mod.simulate({ runs, seed: s });
  console.log(`\n== seed ${s} (${((Date.now() - t0) / 1000).toFixed(1)}s) ==`);
  console.log('buildings:', r.built.map((b) => `${b.id}${b.lv}@run${b.run}(L${b.level})`).join(' '));
  for (const k of [10, 20, 30, 45, 60, 90, 120]) {
    const e = r.log[k - 1];
    if (e) console.log(`run ${String(k).padStart(3)}: unlocked L${e.unlocked}  mats ${JSON.stringify(e.mats)}`);
  }
  const stuck = [];
  let last = 0, since = 0;
  for (const e of r.log) { if (e.unlocked === last) since++; else { if (since >= 6) stuck.push(`L${last} x${since}`); since = 0; last = e.unlocked; } }
  console.log('slow spots (6+ runs without unlocking):', stuck.join(', ') || 'none');
  console.log('final:', JSON.stringify(r.final));
}
