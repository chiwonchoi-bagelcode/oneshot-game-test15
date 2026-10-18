// In-page UI audit: clipped text, elements outside the safe viewport, overlapping tap targets, small tap targets.
// Used by tools/qa/screens.mjs after every screen. Returns a list of human-readable problems.
export async function audit(page, label) {
  return page.evaluate((label) => {
    const out = [];
    const vw = window.innerWidth, vh = window.innerHeight;
    const visible = (el) => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
      let p = el;
      while (p) { const s = getComputedStyle(p); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity < 0.05) return false; if (p.classList && p.classList.contains('hidden')) return false; p = p.parentElement; }
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    // the part of an element actually visible after clipping by scrolling/clipping ancestors
    const clipRect = (el) => {
      let r = el.getBoundingClientRect();
      let box = { l: r.left, t: r.top, r: r.right, b: r.bottom };
      let p = el.parentElement;
      while (p) {
        const s = getComputedStyle(p);
        if (s.overflowX !== 'visible' || s.overflowY !== 'visible') {
          const q = p.getBoundingClientRect();
          box = { l: Math.max(box.l, q.left), t: Math.max(box.t, q.top), r: Math.min(box.r, q.right), b: Math.min(box.b, q.bottom) };
        }
        p = p.parentElement;
      }
      return box;
    };
    const name = (el) => (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').filter(Boolean).join('.') : el.tagName.toLowerCase()) + (el.textContent ? ` "${el.textContent.trim().slice(0, 24)}"` : '');
    const layers = ['#L-hud', '#L-home', '#L-results', '#L-popup', '#L-fx'].map((s) => document.querySelector(s)).filter(Boolean);
    const all = layers.flatMap((l) => [...l.querySelectorAll('*')]).filter(visible);
    // 1) text that doesn't fit its box (only where the box clips it)
    for (const el of all) {
      if (!el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      const cs = getComputedStyle(el);
      const clipX = cs.overflowX !== 'visible' || cs.textOverflow === 'ellipsis';
      if (clipX && el.scrollWidth > el.clientWidth + 1) out.push(`clipped text ${name(el)} (${el.scrollWidth}>${el.clientWidth})`);
      if (cs.overflowY === 'hidden' && el.scrollHeight > el.clientHeight + 1) out.push(`clipped text (v) ${name(el)}`);
      // text wider than its parent's content box (overflowing visually)
      const r = el.getBoundingClientRect();
      if (r.right > vw + 0.5 || r.left < -0.5) out.push(`text outside screen ${name(el)} [${Math.round(r.left)}..${Math.round(r.right)}]`);
    }
    // 2) buttons: on screen, in the safe area, big enough, not overlapping each other
    const btns = all.filter((el) => el.matches('.btn, button, [role=button], .lrow, .side-btn .btn'));
    for (const b of btns) {
      const r = b.getBoundingClientRect();
      if (r.left < -0.5 || r.right > vw + 0.5 || r.top < -0.5 || r.bottom > vh + 0.5) {
        // inside a scroll container is fine
        let p = b.parentElement, scrolls = false;
        while (p) { const s = getComputedStyle(p); if (/(auto|scroll)/.test(s.overflowY)) { scrolls = true; break; } p = p.parentElement; }
        if (!scrolls) out.push(`button off screen ${name(b)}`);
      }
      if (!b.closest('#debug') && (r.width < 40 || r.height < 40) && !b.matches('.lrow')) out.push(`small tap target ${name(b)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    for (let i = 0; i < btns.length; i++) {
      for (let j = i + 1; j < btns.length; j++) {
        const a = btns[i], b = btns[j];
        if (a.contains(b) || b.contains(a)) continue;
        const r1 = clipRect(a), r2 = clipRect(b);
        const ix = Math.min(r1.r, r2.r) - Math.max(r1.l, r2.l);
        const iy = Math.min(r1.b, r2.b) - Math.max(r1.t, r2.t);
        if (ix > 2 && iy > 2) {
          // a popup over the home screen is expected; only flag overlaps within the same layer
          const la = a.closest('.layer'), lb = b.closest('.layer');
          if (la === lb && !(a.closest('.popup') && !b.closest('.popup')) && !(!a.closest('.popup') && b.closest('.popup'))) out.push(`overlapping buttons ${name(a)} / ${name(b)}`);
        }
      }
    }
    return out.map((s) => `[${label}] ${s}`);
  }, label);
}
