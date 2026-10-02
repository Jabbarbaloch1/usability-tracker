const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
let all = [];

function agg(L) {
  const sum = k => L.reduce((t, s) => t + (s[k] || 0), 0), min = Math.max(sum('active') / 60000, 0.5), fN = sum('fittsN');
  return { n: L.length, score: Math.round(mean(L.map(FR.score))), clicks: sum('clicks'), rage: sum('rage'), dead: sum('dead'),
    errors: sum('errors'), small: sum('small'), uturns: sum('uturns'), scroll: mean(L.map(s => s.maxScroll)),
    fitts: fN ? sum('fittsSum') / fN : 0, active: sum('active'), rageRate: sum('rage') / min, deadRate: sum('dead') / min,
    uRate: sum('uturns') / min, smallPct: sum('clicks') ? sum('small') / sum('clicks') : 0 };
}

function findings(a) {
  const f = [];
  if (a.rageRate > .2) f.push({ sev: a.rageRate > .6 ? 3 : 2, h: 'Nielsen 1: Visibility of system status', t: 'Repeated clicks on unresponsive elements',
    d: `${a.rage} rage-click bursts (${a.rageRate.toFixed(2)} per active minute). People click again when nothing seems to happen.`,
    fix: 'Acknowledge every action within 100 ms with pressed states, spinners, or inline confirmation.' });
  if (a.deadRate > .3) f.push({ sev: a.deadRate > 1 ? 3 : 2, h: 'Norman: Signifiers and affordances', t: 'Elements look clickable but do nothing',
    d: `${a.dead} dead clicks (${a.deadRate.toFixed(2)} per minute).`, fix: 'Remove pointer styling from static elements, or wire up the expected action.' });
  if (a.errors > 0) f.push({ sev: a.errors > 5 ? 3 : 2, h: 'Nielsen 5 and 9: Error prevention and recovery', t: 'Script errors and failed form validation',
    d: `${a.errors} errors across ${a.n} sessions.`, fix: 'Validate inline as people type and write messages that say what went wrong and how to fix it.' });
  if (a.smallPct > .15) f.push({ sev: a.smallPct > .35 ? 3 : 2, h: 'Fitts\u2019 law and WCAG 2.5.8', t: 'Click targets are too small',
    d: `${Math.round(a.smallPct * 100)}% of interactive clicks landed on targets under 24 px.`, fix: 'Enlarge targets to 44 px, or add padding to extend the hit area.' });
  if (a.fitts > 4.2) f.push({ sev: 2, h: 'Fitts\u2019 law', t: 'High pointing difficulty between actions',
    d: `Average index of difficulty is ${a.fitts.toFixed(1)} bits per click.`, fix: 'Place related actions closer together and make primary targets larger.' });
  if (a.uRate > .5) f.push({ sev: 2, h: 'Information scent and Nielsen 6', t: 'People scroll back up to re-read',
    d: `${a.uturns} scroll U-turns (${a.uRate.toFixed(2)} per minute).`, fix: 'Strengthen headings and visual hierarchy so the next step is visible without searching.' });
  if (a.scroll < .35 && a.n > 2) f.push({ sev: 1, h: 'Visual hierarchy', t: 'Most people never leave the first screen',
    d: `Average scroll depth is ${Math.round(a.scroll * 100)}%.`, fix: 'Move the key content and primary action above the fold.' });
  return f.sort((x, y) => y.sev - x.sev);
}

function chart(L) {
  const d = L.slice(-40), W = 640, H = 170, bw = W / Math.max(d.length, 1);
  let g = '';
  [85, 65, 40].forEach(v => { const y = H - v * H / 100; g += `<line x1="0" x2="${W}" y1="${y}" y2="${y}" stroke="#DFE4EC" stroke-dasharray="3 4"/><text x="${W - 2}" y="${y - 4}" text-anchor="end" font-size="10" fill="#5B6579">${v}</text>`; });
  d.forEach((s, i) => { const v = FR.score(s), h = Math.max(2, v * H / 100);
    g += `<rect x="${i * bw + 2}" y="${H - h}" width="${Math.max(bw - 4, 2)}" height="${h}" rx="3" fill="${FR.color(v)}"><title>${esc(s.host + s.path)}: ${v} on ${new Date(s.start).toLocaleString()}</title></rect>`; });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Ease score per session">${g}</svg>`;
}

function render() {
  const site = $('site').value, days = +$('range').value, cut = days ? Date.now() - days * 864e5 : 0;
  const L = all.filter(s => (!site || s.host === site) && s.start >= cut).sort((a, b) => a.start - b.start);
  if (!L.length) { $('sheet').innerHTML = '<div class="empty"><h2>No sessions in this view</h2><p>Browse a few pages with Friction switched on. Sessions appear here within seconds.</p></div>'; return; }
  const a = agg(L), fs = findings(a);
  const sc = [0, 0, 0, 0]; L.forEach(s => sc[Math.min(3, Math.floor(s.maxScroll * 4))]++);
  const lab = ['0-25%', '25-50%', '50-75%', '75-100%'];
  const groups = {}; L.forEach(s => (groups[s.host + s.path] ||= []).push(s));
  const rows = Object.entries(groups).map(([k, g]) => ({ k, ...agg(g), title: g[g.length - 1].title })).sort((x, y) => x.score - y.score).slice(0, 30);
  $('sheet').innerHTML = `
  <section class="kpis">
    <div><span>Ease score</span><b style="color:${FR.color(a.score)}">${a.score}</b></div>
    <div><span>Sessions</span><b>${a.n}</b></div>
    <div><span>Rage clicks per minute</span><b>${a.rageRate.toFixed(2)}</b></div>
    <div><span>Dead clicks per minute</span><b>${a.deadRate.toFixed(2)}</b></div>
    <div><span>Fitts difficulty, bits</span><b>${a.fitts ? a.fitts.toFixed(1) : '-'}</b></div>
    <div><span>Active time</span><b>${FR.fmt(a.active)}</b></div>
  </section>
  <section class="two"><div><h2>Ease score by session</h2>${chart(L)}</div>
    <div><h2>How far people scroll</h2>${sc.map((n, i) => `<div class="bar"><span>${lab[i]}</span><i><u style="width:${n / L.length * 100}%"></u></i><span>${Math.round(n / L.length * 100)}%</span></div>`).join('')}</div></section>
  <section><h2>Findings</h2>${fs.length ? fs.map(f => `<div class="f"><s style="background:${['', '#B98312', '#DB6A2B', '#D0382B'][f.sev]}"></s><div><h3>${esc(f.t)}</h3><p>${esc(f.d)}</p><p><em>${esc(f.h)}.</em> ${esc(f.fix)}</p></div></div>`).join('') : '<p>No significant friction detected in this view.</p>'}</section>
  <section><h2>Pages, hardest first</h2><div class="scroll"><table><tr><th>Page</th><th>Sessions</th><th>Ease</th><th>Rage</th><th>Dead</th><th>Errors</th><th>Scroll</th><th>Active</th></tr>
  ${rows.map(r => `<tr><td title="${esc(r.title)}">${esc(r.k)}</td><td>${r.n}</td><td><span class="pill" style="background:${FR.color(r.score)}">${r.score}</span></td><td>${r.rage}</td><td>${r.dead}</td><td>${r.errors}</td><td>${Math.round(r.scroll * 100)}%</td><td>${FR.fmt(r.active)}</td></tr>`).join('')}</table></div></section>`;
}

function download(name, type, text) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); }
function load() {
  chrome.storage.local.get('sessions', r => {
    all = r.sessions || []; const cur = $('site').value;
    $('site').innerHTML = '<option value="">All sites</option>' + [...new Set(all.map(s => s.host))].sort().map(h => `<option ${h === cur ? 'selected' : ''} value="${esc(h)}">${esc(h)}</option>`).join('');
    render();
  });
}
$('site').onchange = $('range').onchange = render;
$('json').onclick = () => download('friction-sessions.json', 'application/json', JSON.stringify(all.map(({ pts, ...s }) => s), null, 2));
$('csv').onclick = () => { const k = ['host', 'path', 'start', 'active', 'clicks', 'rage', 'dead', 'small', 'errors', 'uturns', 'maxScroll', 'fittsN', 'firstClick', 'load'];
  download('friction-sessions.csv', 'text/csv', [k.concat('ease').join(',')].concat(all.map(s => k.map(x => JSON.stringify(s[x] ?? '')).concat(FR.score(s)).join(','))).join('\n')); };
$('clear').onclick = () => confirm('Delete all recorded sessions? This cannot be undone.') && chrome.storage.local.remove('sessions', load);
let t; chrome.storage.onChanged.addListener(c => { if (c.sessions) { clearTimeout(t); t = setTimeout(load, 600); } });
load();
