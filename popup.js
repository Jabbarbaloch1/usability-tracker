const $ = id => document.getElementById(id);
let tab, st = { enabled: true, paused: [] }, host = '';
const save = () => chrome.storage.local.set({ settings: st });
const hints = [[s => s.rage > 0, 'People are clicking repeatedly. Something looks active but gives no feedback.'],
  [s => s.dead > 0, 'Some elements look clickable but do nothing. Strengthen or remove the signifier.'],
  [s => s.errors > 0, 'Errors are firing. Check validation messages and failed scripts.'],
  [s => s.small > 0, 'Small click targets detected. Enlarge them to at least 24 px, ideally 44.'],
  [s => s.uturns > 0, 'Scrolling back up suggests content is hard to find or scan.']];
async function poll() {
  if (!tab?.id) return empty();
  chrome.tabs.sendMessage(tab.id, { type: 'snapshot' }, s => {
    if (chrome.runtime.lastError || !s) return empty();
    $('empty').hidden = true; $('main').hidden = false;
    const v = s.score, c = FR.color(v);
    $('score').textContent = s.on ? v : '–'; $('score').style.color = c;
    $('fg').style.stroke = c; $('fg').style.strokeDashoffset = 276.46 * (1 - (s.on ? v : 0) / 100);
    $('grade').textContent = s.on ? FR.grade(v) : 'Paused';
    $('hint').textContent = !s.on ? 'Tracking is off for this site.' : (hints.find(h => h[0](s)) || [0, 'No friction observed so far. Keep interacting.'])[1];
    ['rage', 'dead', 'errors', 'uturns', 'small'].forEach(k => $(k).textContent = s[k]);
    $('fitts').textContent = s.fittsN ? FR.fitts(s).toFixed(1) : '–';
    $('time').textContent = 'Active ' + FR.fmt(s.active);
    $('heat').textContent = s.heat ? 'Hide click heatmap' : 'Show click heatmap';
  });
}
function empty() { $('main').hidden = true; $('empty').hidden = false; }
(async () => {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try { host = new URL(tab.url).hostname; } catch (_) {}
  $('host').textContent = host || 'No page';
  st = { ...st, ...((await chrome.storage.local.get('settings')).settings || {}) };
  $('on').checked = st.enabled !== false; $('pause').checked = st.paused.includes(host);
  $('on').onchange = e => { st.enabled = e.target.checked; save(); };
  $('pause').onchange = e => { st.paused = st.paused.filter(h => h !== host); if (e.target.checked) st.paused.push(host); save(); };
  $('heat').onclick = () => chrome.tabs.sendMessage(tab.id, { type: 'heat' }, poll);
  $('dash').onclick = () => chrome.runtime.openOptionsPage();
  poll(); setInterval(poll, 1000);
})();
