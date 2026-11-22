/* AI 眼中的你 · 公开版 · 报告的静态星河背景：以星图开场同一批 120 条回答为星点，引用量影响亮度（只读聚合数据） */
(() => {
  let last = '';
  function draw(page = 1) {
    if (!document.body.classList.contains('view-report') || document.body.classList.contains('print-mode')) return;
    const canvas = document.getElementById('starbg'); if (!canvas || !window.REPORT_DATA) return;
    const w = innerWidth, h = innerHeight, cover = page === 1, stamp = `${w}:${h}:${cover}`;
    if (last === stamp) return; last = stamp;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#04060a'; ctx.fillRect(0, 0, w, h);
    const answers = window.REPORT_DATA.film.answers, k = cover ? 1 : 0.62;
    answers.forEach((a, i) => {
      const ang = i * 2.399963, d = Math.sqrt((i + 0.5) / answers.length);
      const cx = w * (a.p % 2 ? 0.74 : 0.26), cy = h * (a.p < 2 ? 0.29 : 0.73);
      const x = cx + Math.cos(ang) * d * w * 0.23, y = cy + Math.sin(ang) * d * h * 0.27;
      const size = 1 + Math.sqrt(a.nc) * 0.45, r = size * 12;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(220,182,111,${0.16 * k})`); g.addColorStop(1, 'rgba(220,182,111,0)');
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
      ctx.fillStyle = `rgba(230,220,200,${(0.18 + Math.min(a.nc, 30) / 100) * k})`;
      ctx.beginPath(); ctx.arc(x, y, size, 0, 2 * Math.PI); ctx.fill();
    });
  }
  window.REPORT_BG = { draw };
  addEventListener('resize', () => draw(window.REPORT ? window.REPORT.page : 1));
})();
