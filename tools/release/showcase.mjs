// Builds out/release/index.html: one page to watch, read and play everything that ships.
// Store text, plan and report are rendered into the page so it also works from file://.
// node tools/release/showcase.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const REL = path.join(root, 'out', 'release');
const rd = (p) => fs.readFileSync(path.join(REL, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(REL, p));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// small markdown renderer: headings, paragraphs, lists, tables, quotes, code, bold, inline code, links
function md(src) {
  const lines = src.replace(/\r/g, '').split('\n');
  const out = [];
  let i = 0;
  const inline = (s) => esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  while (i < lines.length) {
    const l = lines[i];
    if (/^```/.test(l)) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`);
      continue;
    }
    const hm = /^(#{1,4})\s+(.*)$/.exec(l);
    if (hm) { out.push(`<h${hm[1].length + 1}>${inline(hm[2])}</h${hm[1].length + 1}>`); i++; continue; }
    if (/^\|/.test(l)) {
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
      const cells = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = cells(rows[0]);
      const body = rows.slice(2).map(cells);
      out.push(`<div class="tbl"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(l)) {
      const ordered = /^\s*\d+\./.test(l);
      const items = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        let it = lines[i++].replace(/^\s*([-*]|\d+\.)\s+/, '');
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*]|\d+\.)\s+/.test(lines[i])) it += ' ' + lines[i++].trim();
        items.push(`<li>${inline(it)}</li>`);
      }
      out.push(ordered ? `<ol>${items.join('')}</ol>` : `<ul>${items.join('')}</ul>`);
      continue;
    }
    if (/^>\s?/.test(l)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote>${inline(buf.join(' '))}</blockquote>`);
      continue;
    }
    if (!l.trim()) { i++; continue; }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|\||```|>|\s*([-*]|\d+\.)\s)/.test(lines[i])) buf.push(lines[i++]);
    out.push(`<p>${inline(buf.join(' '))}</p>`);
  }
  return out.join('\n');
}

function probe(file) {
  try {
    const j = JSON.parse(execSync(`ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height,codec_type -of json "${path.join(REL, file)}"`).toString());
    const v = j.streams.find((s) => s.codec_type === 'video');
    const subs = j.streams.filter((s) => s.codec_type === 'subtitle').length;
    return `${(+j.format.duration).toFixed(1)}s · ${v.width}×${v.height} ${v.codec_name} · ${(j.format.size / 1e6).toFixed(1)}MB${subs ? ` · ${subs} subtitle tracks` : ''}`;
  } catch { return ''; }
}

const shots = exists('screenshots') ? fs.readdirSync(path.join(REL, 'screenshots')).filter((f) => f.endsWith('.png')).sort() : [];
const subsFiles = exists('subtitles') ? fs.readdirSync(path.join(REL, 'subtitles')).sort() : [];
const store = { ko: exists('store/ko.md') ? md(rd('store/ko.md')) : '', en: exists('store/en.md') ? md(rd('store/en.md')) : '' };
const plan = exists('plan.md') ? md(rd('plan.md')) : '';
const report = exists('report.md') ? md(rd('report.md')) : '<p>(report.md not written yet)</p>';
const vids = [['trailer.mp4', '본편 (자막 트랙 ko/en) · Main cut with ko/en subtitle tracks'], ['video/trailer_ko.mp4', '한국어 자막 버전 · Korean captions burned in'], ['video/trailer_en.mp4', 'English cut (English UI, captions burned in)']].filter(([f]) => exists(f));

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Low Tide Island · Release</title>
<link rel="icon" href="icon-512.png">
<style>
:root { --bg: #f6ecd2; --ink: #2b1d14; --sub: #6b4a2a; --card: #fffaf0; --line: #d9c59a; --sea: #2c638e; --sea2: #3f8db0; --gold: #ffd75e; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.6 system-ui, -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif; }
header { background: linear-gradient(#2c638e, #3f8db0); color: #fff6e0; padding: 28px 16px 22px; text-align: center; }
header img.logo { width: 272px; max-width: 80vw; image-rendering: pixelated; }
header p { margin: 8px auto 14px; max-width: 640px; }
nav { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
nav a { background: var(--gold); color: var(--ink); text-decoration: none; font-weight: 700; padding: 10px 16px; border-radius: 10px; border: 2px solid var(--ink); box-shadow: 0 3px 0 var(--ink); }
main { max-width: 1080px; margin: 0 auto; padding: 8px 16px 64px; }
section { background: var(--card); border: 2px solid var(--line); border-radius: 14px; padding: 18px; margin: 18px 0; }
h2 { margin: 0 0 12px; font-size: 22px; }
h3 { margin: 18px 0 6px; font-size: 17px; }
.row { display: flex; flex-wrap: wrap; gap: 18px; align-items: flex-start; }
.play { display: flex; flex-wrap: wrap; gap: 18px; align-items: flex-start; }
.phone { width: 360px; max-width: 100%; height: 640px; border: 10px solid #222; border-radius: 28px; overflow: hidden; background: #000; flex: none; }
.phone iframe { width: 100%; height: 100%; border: 0; display: block; }
video { width: 300px; max-width: 100%; border-radius: 10px; background: #000; display: block; }
.vid { flex: 1 1 280px; max-width: 320px; }
.cap { font-size: 13px; color: var(--sub); margin-top: 6px; }
.shots { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
.shots a img { width: 100%; border-radius: 8px; border: 1px solid var(--line); display: block; }
.tabs button { font: inherit; font-weight: 700; padding: 8px 14px; min-height: 44px; border: 2px solid var(--ink); background: #fff; border-radius: 10px; cursor: pointer; margin-right: 6px; }
.tabs button[aria-selected="true"] { background: var(--gold); }
.store { margin-top: 10px; }
.doc { max-height: 70vh; overflow: auto; border-top: 1px solid var(--line); margin-top: 10px; padding-top: 6px; }
.tbl { overflow-x: auto; }
table { border-collapse: collapse; margin: 8px 0; font-size: 14px; }
th, td { border: 1px solid var(--line); padding: 4px 8px; text-align: left; vertical-align: top; }
th { background: #f3e5c3; }
code { background: #f1e6cc; padding: 0 4px; border-radius: 4px; }
pre { background: #2b1d14; color: #f6ecd2; padding: 10px; border-radius: 8px; overflow-x: auto; }
blockquote { margin: 8px 0; padding: 4px 12px; border-left: 4px solid var(--line); color: var(--sub); }
ul.files { columns: 2 280px; }
.feature { width: 100%; max-width: 1024px; border-radius: 10px; display: block; image-rendering: auto; }
.icon { width: 128px; height: 128px; border-radius: 28px; image-rendering: pixelated; border: 1px solid var(--line); }
details summary { cursor: pointer; font-weight: 700; padding: 6px 0; min-height: 44px; display: flex; align-items: center; }
@media (max-width: 420px) { .phone { width: 100%; height: 560px; border-width: 6px; } }
</style>
</head>
<body>
<header>
  <img class="logo" src="../assets/logo.png" alt="물때 섬 Low Tide Island">
  <p>물이 빠진 갯벌에서 줍고, 물이 차기 전에 돌아와, 빈 섬을 마을로 키우는 세로형 한 손 게임.<br>Grab what the tide leaves, beat it home, and grow an empty island into a village.</p>
  <nav>
    <a href="../index.html">게임 하기 · Play</a>
    <a href="../tools/editor.html">레벨 에디터 · Level editor</a>
    <a href="#plan">기획서 · Plan</a>
    <a href="#report">보고서 · Report</a>
  </nav>
</header>
<main>
<section>
  <h2>바로 플레이 · Play here</h2>
  <div class="play">
    <div class="phone"><iframe src="../index.html" title="Low Tide Island" allow="autoplay; vibrate"></iframe></div>
    <div style="flex:1 1 260px">
      <p>왼쪽 화면에서 바로 플레이할 수 있어요. 화면 어디든 끌어서 걷고, 물건 위를 지나가면 줍습니다. 물이 차기 전에 아래쪽 섬으로 돌아오세요. 새 창으로 열려면 <a href="../index.html">게임 하기</a>.</p>
      <p>Play in the frame. Drag anywhere to walk; walk over things to pick them up; get back to the island before the tide does. Open <a href="../index.html">full screen</a>.</p>
      <p class="cap">진행은 이 브라우저에 저장됩니다(localStorage). Progress is saved in this browser.</p>
    </div>
  </div>
</section>

<section>
  <h2>트레일러 · Trailer</h2>
  <div class="row">
${vids.map(([f, label], i) => `    <div class="vid"><video controls playsinline preload="metadata" src="${f}">${i === 0 ? subsFiles.filter((s) => s.endsWith('.vtt')).map((s) => `<track kind="subtitles" srclang="${s.includes('.ko.') ? 'ko' : 'en'}" label="${s.includes('.ko.') ? '한국어' : 'English'}" src="subtitles/${s}"${s.includes('.ko.') ? ' default' : ''}>`).join('') : ''}</video><div class="cap">${esc(label)}<br>${probe(f)}</div></div>`).join('\n')}
  </div>
  <p class="cap">자막 파일 · Subtitle files: ${subsFiles.map((s) => `<a href="subtitles/${s}">${s}</a>`).join(' · ')}</p>
</section>

<section>
  <h2>스토어 등록 정보 · Store listing</h2>
  <div class="row">
    <div><img class="icon" src="icon-512.png" alt="app icon"><div class="cap">icon-512.png (512×512)</div></div>
    <div style="flex:1 1 320px"><img class="feature" src="feature-1024x500.png" alt="feature graphic"><div class="cap">feature-1024x500.png</div></div>
  </div>
  <h3>스크린샷 · Screenshots</h3>
  <div class="shots">
${shots.map((s) => `    <a href="screenshots/${s}"><img src="screenshots/${s}" alt="${s}" loading="lazy"></a>`).join('\n')}
  </div>
  <div class="cap">${shots.length} × 1080×1920 PNG</div>
  <h3>문구 · Text</h3>
  <div class="tabs" role="tablist"><button role="tab" aria-selected="true" data-t="ko">한국어</button><button role="tab" aria-selected="false" data-t="en">English</button></div>
  <div class="store" id="store-ko">${store.ko}</div>
  <div class="store" id="store-en" hidden>${store.en}</div>
</section>

<section id="plan">
  <h2>기획서 · Plan</h2>
  <p><a href="plan.md">plan.md</a></p>
  <details><summary>펼쳐 보기 · Read</summary><div class="doc">${plan}</div></details>
</section>

<section id="report">
  <h2>보고서 · Report</h2>
  <p><a href="report.md">report.md</a></p>
  <details open><summary>펼쳐 보기 · Read</summary><div class="doc">${report}</div></details>
</section>
</main>
<script>
document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.tabs button').forEach((x) => x.setAttribute('aria-selected', x === b ? 'true' : 'false'));
  document.getElementById('store-ko').hidden = b.dataset.t !== 'ko';
  document.getElementById('store-en').hidden = b.dataset.t !== 'en';
}));
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(REL, 'index.html'), html);
console.log('showcase written', html.length, 'bytes;', shots.length, 'screenshots,', vids.length, 'videos');
