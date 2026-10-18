// node tools/levels/validate.mjs [--daily] [--json out.json] [--only L01,L02]
// Bundles the validator (JSON imports) with esbuild, then runs levels in parallel worker threads.
import * as esbuild from 'esbuild';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { Worker, isMainThread, workerData, parentPort } from 'node:worker_threads';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const outFile = path.join(root, '.cache', 'validate.bundle.mjs');

if (!isMainThread) {
  const mod = await import(pathToFileURL(outFile).href);
  const res = workerData.ids.map((i) => mod.validateIndex(i));
  const daily = workerData.days ? mod.validateDaily(workerData.days) : [];
  parentPort.postMessage({ res, daily });
} else {
  await esbuild.build({ entryPoints: [path.join(root, 'tools/levels/validate-src.mjs')], bundle: true, platform: 'node', format: 'esm', outfile: outFile, logLevel: 'warning' });
  const mod = await import(pathToFileURL(outFile).href);
  const n = mod.levelCount();
  const onlyArg = process.argv.indexOf('--only');
  const only = onlyArg > 0 ? process.argv[onlyArg + 1].split(',') : null;
  let ids = [...Array(n).keys()];
  if (only) ids = ids.filter((i) => only.includes(mod.levelId(i)));
  const daily = process.argv.includes('--daily');
  const W = Math.max(1, Math.min(os.cpus().length, 4));
  const t0 = Date.now();
  const chunks = Array.from({ length: W }, () => []);
  // interleave so heavy late levels spread across workers
  ids.forEach((id, k) => chunks[k % W].push(id));
  const dayChunks = Array.from({ length: W }, () => []);
  if (daily) for (let d = 0; d < 120; d++) dayChunks[d % W].push(d);
  const outs = await Promise.all(chunks.map((c, k) => new Promise((res, rej) => {
    const w = new Worker(fileURLToPath(import.meta.url), { workerData: { ids: c, days: daily ? dayChunks[k] : null } });
    w.on('message', res); w.on('error', rej);
  })));
  const results = outs.flatMap((o) => o.res).sort((a, b) => a.id.localeCompare(b.id));
  const dailyRes = outs.flatMap((o) => o.daily);
  let bad = 0;
  console.log('id   tide            items stars main(ret/slack) best  allG bots goal turn errors');
  for (const r of results) {
    if (r.errors.length) bad++;
    const st = r.stars.map((s) => (s.ok ? '★' : '·')).join('');
    const m = r.metrics;
    console.log(`${r.id}  ${(m.tide || '').padEnd(15)} ${String(m.items).padStart(3)}   ${st.padEnd(3)}  ${String(m.mainReturn).padStart(5)}/${String(m.mainSlack).padStart(5)}   ${String(m.bestValue).padStart(4)}  ${m.bestAllGoals}  ${m.naive}  ${m.naiveGoal}  ${String(m.turn).padStart(4)} ${m.botWhy || ''}  ${r.errors.join('; ')}`);
  }
  if (daily) {
    const fails = dailyRes.filter((d) => !d.ok);
    console.log(`daily: ${dailyRes.length - fails.length}/${dailyRes.length} ok`);
    for (const f of fails.slice(0, 12)) console.log('  daily fail', f.day, 'board', f.board, f.mod, f.errors.join('; '));
    if (fails.length) bad++;
  }
  const ji = process.argv.indexOf('--json');
  if (ji > 0) fs.writeFileSync(process.argv[ji + 1], JSON.stringify({ results, dailyRes }, null, 1));
  console.log(`${results.length} levels, ${bad} with problems, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  process.exit(bad ? 1 : 0);
}
