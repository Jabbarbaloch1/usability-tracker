importScripts('shared.js');
let q = Promise.resolve();
const get = async (k, d) => (await chrome.storage.local.get(k))[k] ?? d;
chrome.runtime.onMessage.addListener((m, sender, send) => {
  if (m.type === 'flush') {
    q = q.then(async () => {
      const all = await get('sessions', []), s = m.session, i = all.findIndex(x => x.id === s.id);
      i > -1 ? all[i] = s : all.push(s);
      while (all.length > 1000) all.shift();
      await chrome.storage.local.set({ sessions: all });
      if (sender.tab) {
        const v = FR.score(s);
        chrome.action.setBadgeText({ tabId: sender.tab.id, text: String(v) });
        chrome.action.setBadgeBackgroundColor({ tabId: sender.tab.id, color: FR.color(v) });
      }
    }).catch(() => {});
    return false;
  }
  if (m.type === 'query') {
    get('sessions', []).then(a => send(a.filter(x => x.origin === m.origin && x.path === m.path)));
    return true;
  }
});
