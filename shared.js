var FR = {
  fitts(s) { return s.fittsN ? s.fittsSum / s.fittsN : 0; },
  // Ease score: 100 = no observed friction. Penalties are rates per active minute.
  score(s) {
    const m = Math.max(s.active / 60000, 0.5), r = (n, w) => Math.min(1, n / m / w);
    const pen = 26 * r(s.rage, 1) + 16 * r(s.dead, 2) + 16 * Math.min(1, s.errors / 2) +
      10 * r(s.uturns, 1.5) + 12 * Math.min(1, s.small / Math.max(s.clicks, 1)) +
      14 * Math.min(1, Math.max(0, FR.fitts(s) - 3.5) / 3);
    return Math.round(100 - pen);
  },
  grade: v => v >= 85 ? 'Smooth' : v >= 65 ? 'Some friction' : v >= 40 ? 'Noticeable friction' : 'Severe friction',
  color: v => v >= 85 ? '#2E8F6B' : v >= 65 ? '#B98312' : v >= 40 ? '#DB6A2B' : '#D0382B',
  fmt(ms) { const t = Math.round(ms / 1000); return t < 60 ? t + 's' : Math.floor(t / 60) + 'm ' + (t % 60) + 's'; }
};
