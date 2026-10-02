(() => {
  if (window !== top || window.__fr) return; window.__fr = 1;
  const now = Date.now, doc = document.documentElement;
  const s = { id: crypto.randomUUID(), origin: location.origin, host: location.hostname, path: location.pathname,
    title: document.title.slice(0, 80), start: now(), end: now(), active: 0, clicks: 0, rage: 0, dead: 0, small: 0,
    errors: 0, uturns: 0, maxScroll: 0, dist: 0, fittsSum: 0, fittsN: 0, firstClick: null,
    load: Math.round(performance.now()), w: innerWidth, pts: [] };
  let on = true, dirty = false, lastInput = now(), muts = 0, lastClick = null, recent = [], lastPos = null,
    lastY = scrollY, dir = 0, run = 0, cv = null;
  const apply = st => { on = !st || (st.enabled !== false && !(st.paused || []).includes(location.hostname)); };
  chrome.storage.local.get('settings', r => apply(r.settings));
  chrome.storage.onChanged.addListener(c => c.settings && apply(c.settings.newValue));
  new MutationObserver(() => muts++).observe(doc, { subtree: true, childList: true, characterData: true,
    attributes: true, attributeFilter: ['class', 'style', 'hidden', 'open', 'aria-expanded', 'aria-selected', 'aria-hidden'] });

  const sel = 'a[href],button,input,select,textarea,summary,label,[role=button],[role=link],[role=tab],[role=menuitem],[onclick],[tabindex]';
  const mark = () => { lastInput = now(); dirty = true; };

  setInterval(() => { if (on && !document.hidden && now() - lastInput < 30000) { s.active += 1000; dirty = true; } }, 1000);

  addEventListener('mousemove', e => {
    if (!on) return; lastInput = now();
    if (lastPos) s.dist += Math.hypot(e.clientX - lastPos[0], e.clientY - lastPos[1]);
    lastPos = [e.clientX, e.clientY];
  }, { passive: true });

  addEventListener('click', e => {
    if (!on || !(e.target instanceof Element)) return;
    mark(); s.clicks++; if (s.firstClick == null) s.firstClick = now() - s.start;
    const el = e.target, t = now(), host = el.closest(sel), node = host || el, r = node.getBoundingClientRect();
    const clickable = !!host || getComputedStyle(node).cursor === 'pointer';
    if (s.pts.length < 400) s.pts.push([+(e.pageX / Math.max(doc.scrollWidth, 1)).toFixed(4), Math.round(e.pageY)]);
    if (clickable) {
      const w = Math.max(Math.min(r.width, r.height), 1);
      if (w < 24) s.small++; // WCAG 2.5.8 minimum target size
      if (lastClick) { // Fitts' law index of difficulty: log2(D/W + 1)
        s.fittsSum += Math.log2(Math.hypot(r.left + r.width / 2 - lastClick[0], r.top + r.height / 2 - lastClick[1]) / w + 1);
        s.fittsN++;
      }
    }
    lastClick = [e.clientX, e.clientY];
    recent = recent.filter(c => t - c[2] < 1000); recent.push([e.clientX, e.clientY, t]);
    if (recent.length >= 3 && recent.every(c => Math.hypot(c[0] - e.clientX, c[1] - e.clientY) < 50)) { s.rage++; recent = []; }
    if (clickable && !el.closest('a[href],input,select,textarea,label')) {
      const m0 = muts, u = location.href;
      setTimeout(() => { if (muts === m0 && location.href === u && document.activeElement !== node) { s.dead++; dirty = true; } }, 800);
    }
  }, true);

  addEventListener('scroll', () => {
    if (!on) return; mark();
    const y = scrollY, h = Math.max(doc.scrollHeight - innerHeight, 1), dy = y - lastY, d = Math.sign(dy);
    s.maxScroll = Math.max(s.maxScroll, Math.min(1, y / h)); lastY = y;
    if (d && d !== dir) { if (dir === 1 && run > 400) s.uturns++; dir = d; run = 0; }
    run += Math.abs(dy);
  }, { passive: true });

  const err = () => { if (on) { s.errors++; dirty = true; } };
  addEventListener('error', err); addEventListener('unhandledrejection', err);
  document.addEventListener('invalid', err, true);

  const flush = () => {
    if (!on || !dirty || (s.active < 2000 && !s.clicks)) return;
    dirty = false; s.end = now(); s.title = document.title.slice(0, 80);
    try { chrome.runtime.sendMessage({ type: 'flush', session: s }); } catch (_) {}
  };
  setInterval(flush, 4000); addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => document.hidden && flush());

  function heat(send) {
    if (cv) { cv.remove(); cv = null; return send({ on: false }); }
    chrome.runtime.sendMessage({ type: 'query', origin: s.origin, path: s.path }, list => {
      const all = [s, ...(list || []).filter(x => x.id !== s.id)];
      const W = doc.scrollWidth, H = Math.min(doc.scrollHeight, 12000);
      cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      Object.assign(cv.style, { position: 'absolute', left: 0, top: 0, width: W + 'px', height: H + 'px', pointerEvents: 'none', zIndex: 2147483646 });
      const g = cv.getContext('2d'); let n = 0;
      all.forEach(x => (x.pts || []).forEach(([fx, y]) => {
        if (y > H) return; n++; const px = fx * W, r = 36, gr = g.createRadialGradient(px, y, 0, px, y, r);
        gr.addColorStop(0, 'rgba(208,56,43,.34)'); gr.addColorStop(.5, 'rgba(240,160,40,.16)'); gr.addColorStop(1, 'rgba(240,160,40,0)');
        g.fillStyle = gr; g.fillRect(px - r, y - r, 2 * r, 2 * r);
      }));
      document.body.appendChild(cv); send({ on: true, n });
    });
  }
  chrome.runtime.onMessage.addListener((m, _, send) => {
    if (m.type === 'snapshot') send({ ...s, pts: undefined, on, score: FR.score(s), heat: !!cv });
    if (m.type === 'heat') { heat(send); return true; }
  });
})();
