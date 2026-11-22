/* AI 眼中的你 · 公开版 · 启动（MIX饰界智变 · 2026-11-21）
   公开版只有两种内容：
     行业快照   真实研究数据的聚合统计（品牌名按审核表部分隐去，门店只有编号）
     演示品牌   虚构的单品牌报告（江南*澜木业），演示一份企业报告长什么样（?subject=demo）
   其余参数：?auto ?clean ?vertical ?horizontal ?scene=N ?notext ?fps ?at=秒 ；报告：#report ?page=N ?dataset=us|cn|mix ?print */
(function () {
  'use strict';
  const Q = new URLSearchParams(location.search);
  const portrait = window.matchMedia ? matchMedia('(orientation: portrait)').matches : innerHeight > innerWidth;
  const subject = Q.get('subject') === 'demo' ? 'demo' : 'industry';
  const APP = window.APP = {
    subject, fictional: subject === 'demo',
    vertical: Q.has('vertical') || (!Q.has('horizontal') && portrait),
    clean: Q.has('clean'),
    view: null,
  };

  /* ---------------- 顶部标记：影片永远是真实研究的行业总览；报告按所选对象 ---------------- */
  function modebar() {
    const el = document.getElementById('modebar'); if (!el) return;
    const demo = APP.view === 'report' && APP.fictional;
    el.className = demo ? 'demo' : 'masked';
    el.innerHTML = '<b></b><span></span>';
    el.querySelector('span').textContent = demo ? '虚构示例 · 品牌与数据均为虚构' : '真实研究数据 · 仅聚合统计 · 品牌名已部分隐去';
  }

  /* ---------------- 星图 ⇄ 报告 ---------------- */
  function setView(v) {
    APP.view = v;
    document.body.classList.toggle('view-film', v === 'film');
    document.body.classList.toggle('view-report', v === 'report');
    const want = v === 'report' ? '#report' : '';
    if (location.hash !== want) history.replaceState(null, '', location.pathname + location.search + want);
    modebar();
    if (v === 'report' && window.REPORT_BG) window.REPORT_BG.draw(window.REPORT ? window.REPORT.page : 1);
  }
  APP.showReport = function () { if (window.CLAUDE_FILM) window.CLAUDE_FILM.hide(); setView('report'); window.scrollTo(0, 0); };
  APP.showFilm = function (fromScene) { setView('film'); window.CLAUDE_FILM.show(fromScene == null ? 0 : fromScene); };

  APP.start = function () {
    if (!window.REPORT_DATA) { document.body.innerHTML = '<div class="fatal">数据文件没有加载成功（data/report-data.js）。</div>'; return; }
    if (Q.has('print')) { setView('report'); return; }
    if (location.hash === '#report') setView('report');
    else APP.showFilm(Q.has('scene') ? Math.max(1, Math.min(8, parseInt(Q.get('scene'), 10) || 1)) - 1 : 0);
  };
})();
