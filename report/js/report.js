'use strict';
/* AI 眼中的你 · 公开版 · 12 页报告 + 体检入口（MIX饰界智变 · 2026-11-21）
   只读 data/report-data.js 里的聚合数字。真实研究数据只有"行业快照"；单品牌视图只给虚构的演示品牌"江南*澜木业"。
   不显示任何 AI 回答原文：描述和"讲得对不对"都是我们根据统计写的概括。 */
const R = window.REPORT_DATA, Q = new URLSearchParams(location.search), APP = window.APP;
const WP = '../index.html';                                                    // 白皮书
const ACCOUNT = '高维伟-MIX饰界智变';
const P = R.platforms, S = R.subjects[APP.subject], FICT = S.fictional;
let dataset = Q.get('dataset') || 'us'; if (!S.datasets[dataset]) dataset = 'us';
let ds = S.datasets[dataset], page = Math.min(13, Math.max(1, +(Q.get('page') || 1)));
const NP = 13;
const focus = S.focus, m = ds.focus;
const E = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = (n) => ((n || 0) * 100).toFixed(1) + '%', nfmt = (n) => (n == null ? '待补充' : typeof n === 'number' ? n.toFixed(1) : n);
const SCOPE = { us: '美国网络基线', cn: '国内对照', mix: 'MIX 零点' };
document.body.classList.toggle('vertical', APP.vertical); document.body.classList.toggle('clean', APP.clean); document.body.classList.toggle('print-mode', Q.has('print'));
document.querySelector('#dataset').value = dataset;
const name = () => (focus ? E(m ? m.name : focus) : '板材行业');
const legend = () => `<div class="legend">${P.map((p) => `<span><i style="background:${p.color}"></i>${p.name}</span>`).join('')}</div>`;
function header(k, title, sub) { return `<div class="report-heading"><p class="eyebrow">FIELD REPORT / ${String(k).padStart(2, '0')}</p><h1>${title}</h1><p class="sub">${sub || ''}</p></div>`; }
const number = (n, title, sub = '') => `<div class="number"><strong>${n}</strong><span>${title}</span><small>${sub}</small></div>`;
function bars(rows, max) { max = max || Math.max(1, ...rows.map((r) => r.value)); return `<div class="bars">${rows.map((r) => `<div class="bar"><span>${E(r.label)}</span><div><b style="width:${r.value / max * 100}%;background:${r.color || 'var(--gold)'}"></b></div><strong>${r.text ?? r.value}</strong></div>`).join('')}</div>`; }
function empty(title, need) { return `<div class="empty"><span>待补充</span><h2>${title}</h2><p>${need}</p></div>`; }
const DISCLAIM = '统计的是 AI 回答中的出现情况，不代表产品质量、企业规模或市场份额';

function sourceColumns() {
  const hallmark = ['抖音', '公众号', '聚合页', '知乎'];
  return '<div class="source-columns">' + P.map((p, i) => {
    const c = ds.sources[i] || {}, total = Object.values(c).reduce((a, b) => a + b, 0);
    const sorted = Object.entries(c).filter(([k]) => k !== '其他').sort((a, b) => b[1] - a[1]), rows = c['其他'] ? [...sorted.slice(0, 5), ['其他', c['其他']]] : sorted.slice(0, 6);
    return `<article style="--pc:${p.color}"><h3>${p.name}</h3>${!rows.length ? '<p class="empty-source">0 条<small>本平台无相关回答引用</small></p>' : bars(rows.map(([label, value]) => ({ label, value, text: pct(value / total), color: label === '其他' ? '#555e6c' : label === hallmark[i] ? '#dcb66f' : p.color })), Math.max(1, ...rows.map((r) => r[1])))}</article>`;
  }).join('') + '</div>';
}
function pricePanels() {
  return `<div class="price-evidence">${P.map((p) => { const rs = ds.prices[p.name] || []; return `<article style="border-color:${p.color}"><h3 style="color:${p.color}">${p.name}</h3>${rs.length ? ['素板', '饰面板', '未明确饰面'].map((kind) => `<div class="price-kind"><h4>${kind}</h4>${rs.filter((r) => r.kind === kind).map((r) => `<p><span>${E(r.label)}</span><strong>${E(r.price)}</strong>${r.check ? '<small>规格待核</small>' : ''}<small>第${r.round}轮</small></p>`).join('') || '<p>未给出</p>'}</div>`).join('') : '<p>本集合没有可整理的报价。</p>'}</article>`; }).join('')}</div>`;
}
function rankTable() {
  if (focus && m) return `<div class="metrics compact">${number(m.first, '首次出现排第一')}${number(pct(m.first_rate), '首推率')}${number(m.avg_rank == null ? '—' : m.avg_rank.toFixed(2), '平均排位')}</div><table><thead><tr><th>平台</th><th>排第一的次数</th><th>首推率</th><th>平均排位</th></tr></thead><tbody>${P.map((p) => { const r = m.rank_per[p.name]; return `<tr><td><i style="color:${p.color}">●</i> ${p.name}</td><td>${r?.first || 0}</td><td>${r?.first_rate == null ? '无提及' : pct(r.first_rate)}</td><td>${r?.avg_rank == null ? '未出现' : r.avg_rank.toFixed(2)}</td></tr>`; }).join('')}</tbody></table>`;
  return `<table><thead><tr><th>名字</th><th>首次出现排第一</th><th>首推率</th><th>平均排位</th></tr></thead><tbody>${ds.rank8.map((x) => `<tr><td>${E(x.label)}</td><td>${x.first}</td><td>${pct(x.first_rate)}</td><td>${x.avg_rank == null ? '未出现' : x.avg_rank.toFixed(2)}</td></tr>`).join('')}</tbody></table>`;
}
function coverage() {
  return `<div class="coverage"><div class="cell-label"></div>${P.map((p) => `<b>${p.name}</b>`).join('')}${ds.coverage.map((r) => `<span class="cell-label">${r.q}<small title="${E(r.text || r.q)}">${E(r.text || r.q)}</small></span>${r.cells.map(([hit, n], i) => `<div class="tile ${hit ? 'filled' : ''}" style="--pc:${P[i].color}" title="${r.q} ${P[i].name} ${hit}/${n}">${n ? hit + '/' + n : '未采'}</div>`).join('')}`).join('')}</div>`;
}
function localPage() {
  const L = S.local;
  const cn = S.datasets.cn.summary;
  const note = dataset !== 'cn' ? `<p class="geo-note">地域数据来自国内对照测试${L.fictional ? '（虚构示例）' : '（' + E(cn.network.join(' / ')) + '网络，' + E(cn.date) + '）'}，不随上方选的数据集变化。</p>` : '';
  const cards = `<div class="city-cards">${L.cities.map((c) => `<article><h2>${E(c.name)}<small>${E(c.note)}</small></h2><div class="city-nums"><div><strong>${c.distinct}</strong><span>个不同的名字</span></div><div><strong>${c.shared}</strong><span>被 2 个以上 AI 同时报到</span></div><div><strong>${c.single}</strong><span>只被 1 个 AI 报到</span></div></div></article>`).join('')}</div>`;
  const table = `<table class="city-table"><thead><tr><th>平台</th>${L.cities.map((c) => `<th>${E(c.name)} · 报到的商家（编号）</th>`).join('')}</tr></thead><tbody>${P.map((p, pi) => `<tr><td><i style="color:${p.color}">●</i> ${p.name}</td>${L.cities.map((c) => { const st = c.platforms[pi], es = c.entities.filter((e) => e.plats.includes(pi)); return `<td><b>${st.total}</b><small>${st.stores} 门店·工厂 · ${st.markets} 市场</small><span class="ent-chips">${es.map((e) => `<i class="${e.plats.length > 1 ? 'sh' : ''}" title="${E(e.label)}">${e.n}</i>`).join('')}</span></td>`; }).join('')}</tr>`).join('')}</tbody></table>`;
  const lines = [L.map_lead ? `${E(L.map_lead.platform)}在${E(L.map_lead.city)}的来源里，<b>地图与点评 ${L.map_lead.n} 条</b>，占 ${L.map_lead.of} 条的 ${pct(L.map_lead.n / L.map_lead.of)}，居首。` : '', L.us_local ? `对照：美国网络下，${E(L.us_local.platform)} ${L.us_local.of} 条回答里有 <b>${L.us_local.n} 条</b>按美国位置改写——在美国问，它把你当成美国人。` : ''].filter(Boolean);
  return note + cards + (lines.length ? `<p class="city-lines">${lines.join('　')}</p>` : '') + table + `<p class="method">编号 = 商家 N（不公开真名），金色 = 被 2 个以上 AI 同时报到。门店、建材市场、工厂都算；同一商家的不同写法已合并。${L.same_context ? '国内测试为同一对话连续提问，结果受前文影响；' : ''}未核实门店实体，不能推出全城覆盖率。</p>`;
}
function actionPage() {
  const A = S.actions, L = S.local, it = (t, ref) => `<li><p>${t}</p><cite>${ref}</cite></li>`;
  const facts = [], content = [], dist = [];
  if (A.any_outdated) facts.push(it(`AI 还在按 <b>E1/E2</b> 报素板价（${A.price_basis} 个平台）；行内定制板已是 <b>E0</b> 起步。把环保等级和检测报告写进官网、百科、电商详情页。`, '第 6 页 · 说得对不对'));
  else facts.push(it('AI 的报价各说各的口径。先把自己的环保等级、规格、价格口径写清楚，放在 AI 会去读的地方。', '第 6 页 · 说得对不对'));
  if (A.ai_sheet === '4x8' && A.ai_sheet_stated) facts.push(it('AI 默认按 <b>4×8 尺</b>（1220×2440）报价，行内主流已是 <b>4×9 尺</b>（2750×1220）。产品页写明规格，按张、按立方米两种口径都给。', '第 6 页 · 规格'));
  else facts.push(it('AI 报价没说是哪种规格。产品页写明规格（4×8 / 4×9 尺）和计价口径，免得被拿去和别的规格比。', '第 6 页 · 规格'));
  facts.push(it('企业事实卡还空着：认证、生产基地、产能、渠道、近两年的变化。这是 AI 说对你的底稿。', '第 6 页 · 待补充'));
  const mq = Object.entries(A.stability).filter(([, s]) => s.kind === '方法题'), bq = Object.entries(A.stability).filter(([, s]) => s.kind === '品牌题');
  if (mq.length && bq.length) content.push(it(`方法题答案不稳定：${mq.map(([q, s]) => `${q} 三轮重合度 ${s.mean.toFixed(2)}`).join('、')}；品牌题 ${bq.map(([q, s]) => `${q} ${s.mean.toFixed(2)}`).join('、')}。方法题是写内容的机会：${A.methodQs.join('、')}。`, '星图场景 5 · 问三遍'));
  if (A.gaps.length) content.push(it(`${focus ? '这些题里还没有' + name() : '这些题 AI 还没给出任何品牌'}：${A.gaps.slice(0, 12).join('、')}${A.gaps.length > 12 ? ' 等 ' + A.gaps.length + ' 题' : ''}。先把这些题答好的人，先被引用。`, '第 9 页 · 空白'));
  content.push(it(`前五名出现在 <b>${pct(A.coverage)}</b> 的推荐单里。推荐题正面硬拼很难，从知识题、方法题、地域题切进去。`, '第 3 页 · 被提到了吗'));
  dist.push(it(`各平台偏爱的信息入口：${P.map((p) => `${p.name} · <b>${E(A.signatures[p.name])}</b>`).join('、')}。每个入口至少放一条能被引用的内容。`, '第 7 页 · 谁在替你说话'));
  const C0 = L.cities.find((c) => c.name === L.implicit) || L.cities[0];
  if (C0) dist.push(it(`做本地生意，先把地图上的门店信息填准确${L.map_lead ? `：${E(L.map_lead.platform)}在${E(L.map_lead.city)}的来源里地图与点评 ${L.map_lead.n} 条居首` : ''}。${E(C0.name)} ${C0.distinct} 个名字里，只有 ${C0.shared} 个被 2 个以上 AI 同时报到——名单还没定型。`, '第 10 页 · 在你的城市'));
  dist.push(it('四周后用同一套题、同一时段复测，只看变化，不看单次排名。', '第 12 页 · 复测'));
  const col = (n, t, xs) => `<section><h3><span>${n}</span>${t}</h3><ul>${xs.join('')}</ul></section>`;
  return `<p class="draft-badge">自动生成的初稿，顾问会逐条确认</p><div class="action-cols">${col('01', '校准事实', facts)}${col('02', '补足内容', content)}${col('03', '验证分发', dist)}</div><p class="method">每条建议都由前面各页的数字自动生成，右下角标出出处；${FICT ? '虚构示例用虚构数据生成，仅作演示。' : '由行业研究的聚合数据生成；落地前由顾问按企业实际情况确认。'}</p>`;
}
function retestPage() {
  const zero = ds.zero, mix0 = S.datasets.mix.zero;
  const rows = [['提及率', focus && m ? pct(m.rate) : '见前页'], ['首推率', focus && m ? pct(m.first_rate) : '见前页'], ['平均排位', focus && m ? nfmt(m.avg_rank) : '见前页'], ['引用标题', focus && m ? m.cit_titles : '见前页'], ['事实准确率', '待事实卡']];
  return `<div class="metrics">${number(zero ? (zero.generic_hits ?? '待判定') + ' / ' + zero.generic_n : focus && m ? m.mentions : ds.summary.answers, zero ? '泛问题自然提及' : '当前基线')}${number(zero ? (zero.named_recognized ?? '待判定') + ' / ' + zero.named_n : '待测', zero ? '点名题正确识别' : '四周后结果')}${number(4, '周后 / 建议复测')}</div>${!zero && mix0 ? `<p class="zero-strip">另附独立零点 · ${E(mix0.target)}：泛问题 ${mix0.generic_hits ?? '待判定'}/${mix0.generic_n}，点名题正确识别 ${mix0.named_recognized ?? '待判定'}/${mix0.named_n}；不计入本页当前分母。</p>` : ''}${zero ? `<p class="conclusion">零点对象：${E(zero.target)} · ${E(zero.basis)}</p>` : ''}<table><tr><th>复测项</th><th>当前基线</th><th>四周后</th></tr>${rows.map(([t, base]) => `<tr><td>${t}</td><td>${base}</td><td>待复测</td></tr>`).join('')}</table><p class="method">保持问题、平台、轮次和网络条件一致再比较；未采样不记零。MIX 为独立零点集合，不加入美国基线或国内对照的分母。${FICT ? '当前为虚构示例、虚拟数据。' : ''}</p>`;
}
function checkupPage() {
  return `<div class="checkup"><p class="checkup-lead">想看你自己品牌的这份报告？</p><p class="checkup-main">在视频号「${ACCOUNT}」<br>私信“<b>体检</b>”。</p><p class="checkup-sub">同一套题、同一批平台、同一个口径，换成你的品牌和城市。</p><p class="checkup-wp">方法与完整统计见<a href="${WP}">《板材上下游 AI 推荐观察白皮书》</a></p></div>`;
}
const titles = ['', 'AI 眼中的你', '被看见，从一张可复测的快照开始', '被提到了吗', '被提到，不等于被第一个提到', 'AI 给了你哪些描述', '说得对不对，先把口径对齐', '谁在替你说话', '同题出现的，还有这些名字', '哪些问题有你，哪些还是空白', '在你的城市，推荐单又会怎样', '怎么改：从事实、内容到分发', '把今天留下，四周后再看', '你的品牌，也可以这样看一遍'];
function report(k) {
  const sub = `${SCOPE[dataset]} · ${ds.summary.answers} 条回答 · ${ds.summary.date}${FICT ? ' · 虚构示例' : ''}${focus ? ' · ' + name() : ''}`;
  if (k === 13) return header(k, titles[k], '') + checkupPage();
  let html = header(k, k === 1 ? name() + '<br>AI 眼中的你' : titles[k], sub);
  if (k === 1) return html + `<div class="cover-line">${FICT ? '虚构示例 · 品牌与数据均为虚构' : '行业研究 · 聚合统计 · 品牌已部分隐去'}</div><div class="cover-symbol">✳</div><div class="metrics">${number(ds.summary.answers, '独立回答')}${number(ds.summary.questions, '不同问题')}${number(ds.summary.citations, '引用条目')}</div><p class="method">这是一份关于 AI 如何描述、引用与推荐的诊断快照。</p>`;
  if (k === 2) {
    const select = `<label class="brand-picker">体检对象 <select id="subjectPick">${subjectOptions()}</select></label>`;
    return html + select + `<div class="index-layout">${focus && m ? `<div class="score">${m.index ?? '未计算'}<small>${name()} · AI 可见度指数 / 100 · 虚构示例</small></div>` : `<div class="snapshot">${number(ds.summary.answers, '独立回答')}${number(ds.summary.branded_answers, '有品牌的回答', Math.round(ds.summary.branded_answers / Math.max(1, ds.summary.answers) * 100) + '%')}${number(ds.brands_seen, '出现过的品牌')}${number(Math.round(ds.top5_covered / Math.max(1, ds.summary.branded_answers) * 100) + '%', '前五名覆盖')}</div>`}<div><h2>${focus && m ? `${name()} 在 ${m.cover} 个平台被提及` : '行业总览不制造一个行业“总分”'}</h2><p>${focus && m ? `该品牌提及 ${m.mentions} 次，首次出现排第一 ${m.first} 次。（虚构示例，演示一份企业报告长什么样）` : '可见度指数只对单个品牌计算：提及 30% · 首推 20% · 平台 15% · 题型 15% · 稳定 10% · 引用标题 10%，在同一集合内归一化。公开版不对任何真实品牌计算指数。'}</p><p>同一套题、同一平台、同一轮次、同一网络，四周后可以复测对比——这就是“可复测的快照”。</p><p>事实准确率、时效性、定位一致度：待企业事实卡。</p></div></div><p class="method">${DISCLAIM}。v0.1 示例权重，在本集合内归一化，不可跨集合直接比较绝对分数。</p>`;
  }
  if (k === 3) return html + legend() + (!focus ? `<p class="conclusion">${pct(ds.top5_covered / Math.max(1, ds.summary.branded_answers))} 的有品牌回答，至少提到前五名之一。</p>` : '') + bars(focus && m ? P.map((p) => ({ label: p.name, value: m.per[p.name] || 0, text: `${m.per[p.name] || 0} / ${ds.summary.platform_counts[p.name]}`, color: p.color })) : ds.top8.map((x) => ({ label: x.label, value: x.mentions }))) + `<div class="metrics compact">${number(focus && m ? pct(m.rate) : ds.summary.brand_mentions, focus ? '回答提及率' : '去重后的品牌提及次数')}${number(focus && m ? pct(m.sov) : ds.summary.branded_answers, focus ? '声量份额' : '有品牌的回答')}</div><p class="method">${DISCLAIM}；${FICT ? '品牌名称与数据均为虚构' : '品牌名称已部分隐去'}。</p>`;
  if (k === 4) return html + rankTable() + `<p class="method">“首推”沿用 v0.1 算法：回答正文中已识别品牌首次出现的先后顺序。它不是对推荐语气的人工判断，也不代表产品好坏。</p>`;
  if (k === 5) {
    const tags = focus && m ? m.tags : Object.keys(ds.tags);
    return html + `<div class="tag-cloud">${tags.map((t) => `<span>${E(t)}</span>`).join('') || '<span>尚无描述</span>'}</div><div class="summary-cards"><article><h3>我们的概括</h3><p>自动归类目前只分到这几个大类：${tags.map(E).join('、')}。${focus ? name() + '的描述' : '出现过的每个品牌'}都落在这几类里，靠关键词还分不出品牌之间的差别。描述准不准，要人工逐条对照原话。</p></article><article><h3>为什么不放原话</h3><p>公开版只放统计和我们写的概括，不放 AI 回答原文。逐条原话只出现在给企业的完整报告里。</p></article></div><p class="method">自动归类：从提到品牌的回答中匹配关键词，可能包含同段其他主体；需人工确认。</p>`;
  }
  if (k === 6) return html + (dataset === 'us' && !FICT ? `<p class="price-lead">${P.length} 个平台的素板报价里，${ds.price_basis} 个仍列出 E1/E2 口径。</p>` : '') + pricePanels() + `${dataset === 'us' && !FICT ? '<p class="price-reference"><b>行内口径 · 2026-11：</b>定制家具基材已基本 E0 起步；常用规格 2750×1220×18mm。AI 回答多用 1220×2440mm，比较前先统一尺寸。</p>' : ''}${ds.q07_all4 ? '<p class="q07-card"><b>有的讲得对 · Q07：</b>问“无醛板是真的不含甲醛吗”，四个平台都区分了“无醛添加”和“零甲醛”：无醛添加板不等于成品完全不含甲醛。<small>我们的概括，不是 AI 原话。</small></p>' : ''}${empty('企业事实卡对照', '待企业提供认证、基地、产能、渠道与近两年变化；暂不生成事实准确率。')}<p class="method">价格是 AI 回答里提到的数字，经整理归类，不是市场报价；${FICT ? '虚构示例中的价格为演示数值。' : '本页为行业问题对照。'}</p>`;
  if (k === 7) return html + sourceColumns() + `<div class="metrics compact">${number(focus && m ? m.cit_titles : ds.summary.citations, focus ? '标题含品牌的引用' : '本集合引用总量')}${number(focus && m ? m.cit_domains : '—', '不同网站')}${number('待登记', '自有渠道占比')}</div><p class="method">每列显示前五类及其他（如有）；分母包含全部引用，故不加总为100%。${focus ? '只看提到该品牌的回答。' : ''}</p>`;
  if (k === 8) return html + `<div class="peer-cloud">${ds.peers.map((b) => `<span>${E(b)}</span>`).join('') || '<p>本集合没有可列出的同题共现品牌。</p>'}</div><p class="method">仅并列同一条回答同时出现的品牌，不作竞品高低排名；${DISCLAIM}。</p>`;
  if (k === 9) return html + coverage() + `<p class="method">数字为命中轮次 / 实采轮次；${focus ? '看该品牌是否出现' : '行业总览统计是否出现任意品牌'}。未采样不等于未出现。</p>`;
  if (k === 10) return html + localPage();
  if (k === 11) return html + actionPage();
  return html + retestPage();
}
/* 全局品牌切换（顶部栏，和第 2 页同步）：公开版只有"行业快照"和虚构的演示品牌；切换后停在当前页 */
const DEMO_NAME = R.subjects.demo.name;
function subjectOptions() { return `<option value="industry" ${!FICT ? 'selected' : ''}>行业快照（真实数据）</option><optgroup label="演示（虚构）"><option value="demo" ${FICT ? 'selected' : ''}>${E(DEMO_NAME)} · 演示</option></optgroup>`; }
function pickSubject(v) { if (v === APP.subject) return; const u = new URL(location); if (v === 'demo') u.searchParams.set('subject', 'demo'); else u.searchParams.delete('subject'); u.searchParams.set('page', page); u.hash = 'report'; location.href = u; }
function render() {
  document.querySelector('#scope').innerHTML = `采样 ${E(ds.summary.date)} · ${SCOPE[dataset]}（${E(ds.summary.network.join(' / '))}网络）· ${ds.summary.answers} 条独立回答${FICT ? ' · 虚构示例' : ''}<br>${DISCLAIM}<br>方法与完整统计见<a href="${WP}">《板材上下游 AI 推荐观察白皮书》</a>`;
  document.title = `AI 眼中的你 · ${FICT ? '虚构示例' : '行业快照'}`;
  if (Q.has('print')) { document.querySelector('#content').innerHTML = Array.from({ length: NP }, (_, i) => `<section class="report-page" data-page="${i + 1}">${report(i + 1)}</section>`).join(''); return; }
  document.querySelector('#content').innerHTML = `<section class="report-page" data-page="${page}">${report(page)}</section>`;
  document.querySelector('#navigation').innerHTML = `<span>${String(page).padStart(2, '0')} / ${NP}</span><button id="previous" aria-label="上一页">←</button><button id="next" aria-label="下一页">→</button>`;
  document.querySelector('#previous').addEventListener('click', () => go(page - 1)); document.querySelector('#next').addEventListener('click', () => go(page + 1));
  for (const sel of [document.getElementById('subjectPick'), document.getElementById('brandTop')]) { if (!sel) continue; if (sel.id === 'brandTop') sel.innerHTML = subjectOptions(); sel.onchange = () => pickSubject(sel.value); }
  if (window.REPORT_BG) window.REPORT_BG.draw(page);
  document.querySelectorAll('#pagedots button').forEach((b) => b.classList.toggle('on', +b.dataset.p === page));
}
function go(p) { page = (p + NP - 1) % NP + 1; render(); const u = new URL(location); u.searchParams.set('page', page); u.hash = 'report'; history.replaceState(null, '', u); }
document.querySelector('#pagedots').innerHTML = Array.from({ length: NP }, (_, i) => `<button data-p="${i + 1}" title="${titles[i + 1]}">${String(i + 1).padStart(2, '0')}</button>`).join('');
document.querySelectorAll('#pagedots button').forEach((b) => { b.onclick = () => go(+b.dataset.p); });
document.querySelector('#toFilm').onclick = () => APP.showFilm();
document.querySelector('#dataset').onchange = (e) => { const u = new URL(location); u.searchParams.set('dataset', e.target.value); u.searchParams.set('page', page); u.hash = 'report'; location.href = u; };
document.querySelector('#pdf').onclick = () => { const u = new URL(location); u.searchParams.set('print', ''); u.searchParams.set('autoprint', ''); u.searchParams.set('dataset', dataset); u.searchParams.delete('page'); u.hash = 'report'; window.open(u); };
document.querySelector('#pdfHint').textContent = '点"打印 / PDF"会打开 13 页连排的浅色版，在打印窗口里选"另存为 PDF"、纸张 A4。';
document.addEventListener('keydown', (e) => { if (APP.view !== 'report' || e.target.tagName === 'SELECT') return; if (e.key === 'ArrowRight') go(page + 1); if (e.key === 'ArrowLeft') go(page - 1); });
// 手机上左右滑动翻页
let tx = null; document.querySelector('#report-view').addEventListener('touchstart', (e) => { tx = e.touches[0].clientX; }, { passive: true });
document.querySelector('#report-view').addEventListener('touchend', (e) => { if (tx == null) return; const dx = e.changedTouches[0].clientX - tx; tx = null; if (Math.abs(dx) > 60) go(page + (dx < 0 ? 1 : -1)); }, { passive: true });
document.querySelector('#logo').onclick = (e) => { e.preventDefault(); APP.showFilm(); };
render();
window.REPORT = { go, get dataset() { return dataset; }, get page() { return page; } };
if (Q.has('autoprint')) (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => setTimeout(() => window.print(), 600));
