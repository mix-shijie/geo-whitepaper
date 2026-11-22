/* AI 眼中的你 · 公开版 · 开场 3D 星图（MIX饰界智变 · 2026-11-21）
   每个视觉元素都来自 data/report-data.js 里的聚合数据（构建时推导，不含回答原文、品牌原名、门店名）。
   公开版只有一种模式：真实研究数据的行业总览，品牌名按审核表部分隐去。默认静音带中文字幕；可点"朗读"用浏览器自带语音念英文解说，或点"音乐"打开程序生成的底乐和音效。
   画面状态是全局时间 T 的纯函数：同一个 T 永远得到同一帧，?auto 每次播放完全一样。
   页面加载时不启动，由 js/boot.js 调用 CLAUDE_FILM.show() 才初始化（直接打开报告时不占显卡）。 */
window.CLAUDE_FILM = (function () {
'use strict';
let inited = false, running = false, rafId = 0;
function init() {
if (inited) return; inited = true;
const APP = window.APP;
const D = window.REPORT_DATA.film;
window.__filmData = D;
const Q = new URLSearchParams(location.search);
const VERT = APP.vertical, CLEAN = APP.clean, AUTO = Q.has('auto');
const FICT = false;                                                   // 影片只放真实研究的行业总览
const SHOWFPS = Q.has('fps'), NOTEXT = Q.has('notext');
const AT = Q.has('at') ? parseFloat(Q.get('at')) : null;          // 冻结在某个全局时间（截图用）
const START_SCENE = Q.has('scene') ? Math.max(1, Math.min(8, parseInt(Q.get('scene'), 10) || 1)) - 1 : 0;
const LOC = window.REPORT_DATA.local;       // 场景 6"在你的城市"：固定读国内对照（门店只有编号）
window.__localData = LOC;

/* ---------------------------------------------------------------- 时间轴（v3：跟着解说走——英文男声 GuyNeural，中文字幕）
   每个场景 = 1.2 秒引入 + 这一段解说的实际长度 + 1.2 秒留白（最后一个场景留 3 秒）。
   时间来自 report-data.js 的 narration（合成时逐词记下的发声时间；公开版不带音频）。画面关键动作用 A(场景, 词) 对齐到那个词。 */
const NARR = window.REPORT_DATA.narration || null;
const NBY = NARR ? Object.fromEntries(NARR.scenes.map((x) => [x.key, x])) : {};
const LEAD = 1.2, TAIL = 1.2, LAST_TAIL = 3.5;          // 老高 11/19：放慢节奏，引入和留白各 1.2 秒
const SCENES = [
  { key: 'stars',  title: '120 颗星',     def: 11.7 },
  { key: 'source', title: '四条星河',     def: 17.0 },
  { key: 'brand',  title: '品牌星座',     def: 13.1 },
  { key: 'grid',   title: '前五名的覆盖', def: 8.8 },
  { key: 'orbit',  title: '问三遍',       def: 12.1 },
  { key: 'city',   title: '在你的城市',   def: 21.2 },
  { key: 'price',  title: '说得对不对',   def: 14.1 },
  { key: 'mix',    title: '还没亮的星',   def: 11.4 },
];
SCENES.forEach((s, i) => { s.n = NBY[s.key] || null; s.dur = s.n ? +(LEAD + s.n.speech_end + (i === SCENES.length - 1 ? LAST_TAIL : TAIL)).toFixed(3) : s.def; });
const S_STARS = 0, S_SOURCE = 1, S_BRAND = 2, S_GRID = 3, S_ORBIT = 4, S_CITY = 5, S_PRICE = 6, S_MIX = 7;
const START = []; let acc = 0;
for (const s of SCENES) { START.push(acc); acc += s.dur; }
const TOTAL = +acc.toFixed(3);
// 场景内时间：解说里某个词开始发声的时刻；没有解说文件时用默认值
const A = (s, k, def) => (SCENES[s].n && SCENES[s].n.anchors[k] != null ? LEAD + SCENES[s].n.anchors[k] : def);
const TRANS = 3.0, TRANS_CAM = 4.0;          // 转场放慢（v2 是 2.4 / 3.2）
const MORPH_A = A(S_BRAND, 'morph', 4.1) + 0.3, MORPH_B = A(S_BRAND, 'most', 6.3) - 0.1;      // 场景 3：提及 → 首推（"可换成第一个被推荐再看"）

/* ---------------------------------------------------------------- 小工具 */
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (x) => { x = clamp(x); return x * x * x * (x * (x * 6 - 15) + 10); };
const seg = (u, a, b) => ease((u - a) / (b - a));
const win = (u, a, b, fi = 0.8, fo = 0.7) => seg(u, a, a + fi) * (1 - seg(u, b - fo, b));
const hash = (n) => { let x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const hexRGB = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const lift = (c, k) => c.map((v) => Math.min(1, v * (1 - k) + k * 0.95 + v * 0.25));
function vivid(hex) {            // 保持看板色相，只在深色底上提高饱和度和明度
  const c = new THREE.Color(hex), hsl = {}; c.getHSL(hsl);
  c.setHSL(hsl.h, Math.min(1, hsl.s * 1.9 + 0.08), 0.66); return [c.r, c.g, c.b];
}
const mix3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const pct = (x, d = 0) => (x * 100).toFixed(d) + '%';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const GOLD = [0.92, 0.72, 0.40], WARM = [1.0, 0.92, 0.80], DIM = [0.55, 0.56, 0.60], RUST = [0.86, 0.52, 0.40];
const PC = D.platforms.map((p) => vivid(p.color));      // 看板配色，在深色底上略提亮
const PCSS = D.platforms.map((p) => p.color);
const PN = D.platforms.map((p) => p.name);
const brandLabel = (b) => b.label;                                    // 已按当前打码模式解析（与报告同一个 label 函数）
const FOCUS = null;                                                   // 公开版不聚焦任何真实品牌

/* ---------------------------------------------------------------- 舞台 */
const stage = document.getElementById('stage');
const canvas = document.getElementById('gl');
const labelsEl = document.getElementById('labels');
const textEl = document.getElementById('text');
const uiEl = document.getElementById('ui');
stage.classList.toggle('vertical', VERT); document.body.classList.toggle('vertical', VERT);
if (CLEAN) document.body.classList.add('clean');
if (NOTEXT) document.body.classList.add('notext');
let SW = 0, SH = 0, U = 1;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: AT !== null });
renderer.setClearColor(0x04060a, 1);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(VERT ? 50 : 35, VERT ? 9 / 16 : 16 / 9, 0.1, 400);
const CENTER = VERT ? [0.5, 0.6] : [0.5, 0.57];    // 内容中心在画面中的位置，给结论文字留出上方空间

let composer, bloom, film, rt;
function setupComposer() {
  const pr = Math.min(window.devicePixelRatio || 1, 2);
  rt = new THREE.WebGLRenderTarget(SW * pr, SH * pr, { samples: renderer.capabilities.isWebGL2 ? 4 : 0, type: THREE.HalfFloatType });
  composer = new THREE.EffectComposer(renderer, rt);
  composer.setPixelRatio(pr);
  composer.addPass(new THREE.RenderPass(scene, camera));
  bloom = new THREE.UnrealBloomPass(new THREE.Vector2(SW, SH), 0.85, 0.55, 0.12);
  if (!Q.has('nobloom')) composer.addPass(bloom);
  film = new THREE.ShaderPass({
    uniforms: { tDiffuse: { value: null }, uT: { value: 0 }, uAsp: { value: SW / SH } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `float rs(float a,float b,float x){float t=clamp((x-a)/(b-a),0.,1.);return t*t*(3.-2.*t);}uniform sampler2D tDiffuse;uniform float uT;uniform float uAsp;varying vec2 vUv;
      float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
      void main(){vec4 c=texture2D(tDiffuse,vUv);vec2 q=(vUv-.5)*vec2(uAsp,1.);float v=rs(1.25,.25,length(q)*1.05);
      c.rgb=max(c.rgb,vec3(0.));c.rgb*=mix(.62,1.,v);c.rgb=c.rgb/(1.+c.rgb*.18)*1.08;c.rgb=pow(c.rgb,vec3(.98,1.,1.04));
      c.rgb+=(h(vUv*vec2(1920.,1080.)+fract(uT*7.13))-.5)*.012;c.rgb+=vec3(.010,.013,.022);gl_FragColor=vec4(c.rgb,1.);}`,
  });
  composer.addPass(film);
}
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  const asp = VERT ? 9 / 16 : 16 / 9;
  if (w / h > asp) { SH = h; SW = Math.round(h * asp); } else { SW = w; SH = Math.round(w / asp); }
  stage.style.width = SW + 'px'; stage.style.height = SH + 'px';
  stage.style.left = Math.round((w - SW) / 2) + 'px'; stage.style.top = Math.round((h - SH) / 2) + 'px';
  U = (VERT ? SW : SH) / 1080;
  stage.style.setProperty('--u', U);
  const pr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pr); renderer.setSize(SW, SH, false);
  camera.aspect = SW / SH;
  camera.setViewOffset(SW, SH, -(CENTER[0] - 0.5) * SW, -(CENTER[1] - 0.5) * SH, SW, SH);
  camera.updateProjectionMatrix();
  if (composer) { composer.setSize(SW, SH); film.uniforms.uAsp.value = SW / SH; }
  for (const g of GROUPS) g.mat.uniforms.uPR.value = pr * U;
}

/* ---------------------------------------------------------------- 点精灵材质 */
const POINT_VS = `attribute vec3 acolor;attribute float size;attribute float alpha;attribute float kind;
uniform float uPR;varying vec3 vC;varying float vA;varying float vK;
void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;
gl_PointSize=size*uPR*(30./max(.5,-mv.z))*(kind<.5?2.4:1.);vC=acolor;vA=alpha;vK=kind;if(alpha<.002)gl_PointSize=0.;}`;
const POINT_FS = `float rs(float a,float b,float x){float t=clamp((x-a)/(b-a),0.,1.);return t*t*(3.-2.*t);}varying vec3 vC;varying float vA;varying float vK;
void main(){vec2 c=gl_PointCoord-.5;float d=length(c)*2.;if(d>1.)discard;float a;vec3 col=vC;
if(vK<.5){float core=rs(.30,.12,d);float halo=exp(-d*d*9.)*.55+exp(-d*d*3.)*.12;a=core+halo*(1.-core);col=mix(vC,vec3(1.,.97,.92),core*.18);}
else if(vK<1.5){a=rs(.09,.0,abs(d-.78))*.95+exp(-d*d*5.)*.10;}
else{a=rs(1.,.0,d);a*=a;}
gl_FragColor=vec4(col,a*vA);}`;

const GROUPS = [];
class Points {
  constructor(n, fill, opt = {}) {
    this.n = n; this.fill = fill; this.bulge = opt.bulge || 0;
    const g = new THREE.BufferGeometry();
    this.attr = { pos: new Float32Array(n * 3), col: new Float32Array(n * 3), size: new Float32Array(n), alpha: new Float32Array(n), kind: new Float32Array(n) };
    g.setAttribute('position', new THREE.BufferAttribute(this.attr.pos, 3));
    g.setAttribute('acolor', new THREE.BufferAttribute(this.attr.col, 3));
    g.setAttribute('size', new THREE.BufferAttribute(this.attr.size, 1));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.attr.alpha, 1));
    g.setAttribute('kind', new THREE.BufferAttribute(this.attr.kind, 1));
    for (const k of ['position', 'acolor', 'size', 'alpha', 'kind']) g.getAttribute(k).setUsage(THREE.DynamicDrawUsage);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    this.mat = new THREE.ShaderMaterial({ uniforms: { uPR: { value: 1 } }, vertexShader: POINT_VS, fragmentShader: POINT_FS, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending });
    this.obj = new THREE.Points(g, this.mat); this.obj.frustumCulled = false; this.obj.renderOrder = opt.order || 0;
    this.geo = g; scene.add(this.obj); GROUPS.push(this);
    this.A = this.mk(); this.B = this.mk();
  }
  mk() { const n = this.n; return { pos: new Float32Array(n * 3), col: new Float32Array(n * 3), size: new Float32Array(n), alpha: new Float32Array(n), kind: new Float32Array(n) }; }
  update(s, u) {
    const o = this.attr;
    if (s > 0 && u < TRANS && !this.noBlend) {
      const A = this.A, B = this.B;
      this.fill(s - 1, SCENES[s - 1].dur, A); this.fill(s, u, B);
      const k = ease(u / TRANS), arc = Math.sin(Math.PI * k);
      for (let i = 0; i < this.n; i++) {
        const kp = A.alpha[i] < 0.001 ? 1 : (B.alpha[i] < 0.001 ? 0 : k);
        for (let j = 0; j < 3; j++) {
          o.pos[i * 3 + j] = lerp(A.pos[i * 3 + j], B.pos[i * 3 + j], kp);
          o.col[i * 3 + j] = lerp(A.col[i * 3 + j], B.col[i * 3 + j], k);
        }
        if (this.bulge && kp > 0 && kp < 1) o.pos[i * 3 + 2] += arc * this.bulge * (hash(i * 3.7) - 0.3);
        o.size[i] = lerp(A.size[i], B.size[i], k); o.alpha[i] = lerp(A.alpha[i], B.alpha[i], k);
        o.kind[i] = k < 0.5 ? A.kind[i] : B.kind[i];
      }
    } else this.fill(s, u, o);
    for (const k of ['position', 'acolor', 'size', 'alpha', 'kind']) this.geo.getAttribute(k).needsUpdate = true;
  }
}
function put(o, i, p, c, size, alpha, kind = 0) {
  o.pos[i * 3] = p[0]; o.pos[i * 3 + 1] = p[1]; o.pos[i * 3 + 2] = p[2];
  o.col[i * 3] = c[0]; o.col[i * 3 + 1] = c[1]; o.col[i * 3 + 2] = c[2];
  o.size[i] = size; o.alpha[i] = alpha; o.kind[i] = kind;
}
const P3 = (o, i) => [o.pos[i * 3], o.pos[i * 3 + 1], o.pos[i * 3 + 2]];

/* ---------------------------------------------------------------- 布局（一次算好） */
const ANS = D.answers;
const CL = VERT ? [[-3.3, 4.3, 0], [3.3, 4.3, 0], [-3.3, -4.6, 0], [3.3, -4.6, 0]]
               : [[-5.5, 2.75, 0], [5.5, 2.75, 0], [-5.5, -3.75, 0], [5.5, -3.75, 0]];
const CR = VERT ? 2.4 : 2.6;
const ansHome = ANS.map((a, i) => {
  const k = i % 30, n = 30, g = Math.PI * (3 - Math.sqrt(5));
  const y = 1 - 2 * (k + 0.5) / n, r = Math.sqrt(1 - y * y), th = g * k + a.p;
  const rad = CR * Math.cbrt(0.25 + 0.75 * hash(i + 4.1));
  const c = CL[a.p];
  return [c[0] + Math.cos(th) * r * rad, c[1] + y * rad * 0.88, c[2] + Math.sin(th) * r * rad];
});
const ansSize = ANS.map((a) => 3.4 + 1.5 * Math.sqrt(a.nc));        // 星的亮度/大小 = 该回答的引用数

// 场景 2：来源节点排在椭圆上；四个专属入口正对各自平台的星团
const CATS = D.sources.categories, NC = CATS.length;
const catTotal = CATS.map((_, c) => D.sources.matrix.reduce((s, r) => s + r[c], 0));
const SIG = PN.map((p) => CATS.indexOf(D.sources.signatures[p].cat));
const RX = VERT ? 6.4 : 14.2, RY = VERT ? 9.0 : 7.9;
const nodePos = new Array(NC);
(function () {
  const gapC = -Math.PI / 2, gapW = VERT ? 0.95 : 1.25;           // 底部留空给结论文字
  const slots = Array.from({ length: NC }, (_, i) => gapC + gapW / 2 + i * (2 * Math.PI - gapW) / (NC - 1));
  const used = new Set();
  SIG.forEach((c, p) => {
    const want = Math.atan2(CL[p][1] / RY, CL[p][0] / RX);
    let best = -1, bd = 1e9;
    slots.forEach((a, i) => { if (used.has(i)) return; const d = Math.abs(Math.atan2(Math.sin(a - want), Math.cos(a - want))); if (d < bd) { bd = d; best = i; } });
    used.add(best); nodePos[c] = [Math.cos(slots[best]) * RX, Math.sin(slots[best]) * RY, 0];
  });
  const free = slots.map((a, i) => i).filter((i) => !used.has(i));
  const rest = CATS.map((_, c) => c).filter((c) => !SIG.includes(c));      // 已按总量降序
  const order = free.map((_, j) => free[(j * 5) % free.length]);
  rest.forEach((c, j) => { const a = slots[order[j]]; nodePos[c] = [Math.cos(a) * RX, Math.sin(a) * RY, (hash(c) - 0.5) * 2]; });
})();
const nodeSize = catTotal.map((t) => 5 + 2.3 * Math.sqrt(t));
const CIT = D.sources.citations;
const citCtrl = CIT.map(([a, c], j) => {
  const s = ansHome[a], e = nodePos[c];
  const m = [(s[0] + e[0]) / 2, (s[1] + e[1]) / 2, (s[2] + e[2]) / 2];
  const dx = e[0] - s[0], dy = e[1] - s[1], L = Math.hypot(dx, dy) || 1;
  const w = (hash(j * 1.3) - 0.5) * 2.2 + (hash(c * 9.1) - 0.5) * 1.2;
  return [m[0] - dy / L * w, m[1] + dx / L * w, m[2] + (hash(j * 2.9) - 0.5) * 3];
});
const sigLitAt = (p) => A(S_SOURCE, 'p' + p, 4.2 + p * 1.35) - 0.1;           // 解说念到"豆包""元宝"……时点亮它的偏爱入口

// 场景 3 / 7：品牌星
const BR = D.brands, NB = D.brand_count, NTOP = BR.length;
const MENT = D.brand_mentions_all, MENT_MAX = Math.max(1, ...MENT);
const BK = 8.4;                                                     // 直径 ∝ √次数（面积 ∝ 次数）
const bPos3 = BR.map((b) => {
  const p = VERT ? b.xy_v : b.xy_h;
  return VERT ? [p[0] * 9.2, p[1] * 8.9 + 0.2, p[2] * 3] : [p[0] * 5.0 + 1.9, p[1] * 5.0 - 0.8, p[2] * 3];
});
const FIRST_MAX = Math.max(1, ...BR.map((b) => b.first));
const HOT_FIRST = BR.filter((b) => b.first / b.mentions >= 0.4 && b.first >= 10).map((b) => b.id);   // 首推多、且首推占提及四成以上
const FOCUS_I = BR.findIndex((b) => b.focus);
const bPos7 = Array.from({ length: NB }, (_, i) => {
  let x, y;
  if (i < NTOP) { const p = bPos3[i]; x = p[0]; y = p[1]; } else { const a = hash(i * 5.3) * Math.PI * 2; x = Math.cos(a); y = Math.sin(a); }
  const L = Math.hypot(x, y) || 1, dx = x / L, dy = y / L;
  const r = i < NTOP ? 7.6 + L * 0.8 : 15 + hash(i) * 4;
  return VERT ? [dx * r * 0.62, dy * r * 1.3 - 1, (hash(i * 7) - 0.5) * 6] : [dx * r * 1.35, dy * r * 1.0, (hash(i * 7) - 0.5) * 6];
});

// 场景 4：点阵（62 条提到品牌的回答）+ 提及条（452 次提及）
const CO = D.concentration;
const gridIdx = new Map(CO.branded.map((a, j) => [a, j]));
const coverOrder = new Map(CO.covered.map((a, j) => [a, j]));
const GC = 8, GS = VERT ? 0.86 : 0.92;
const gridOrigin = VERT ? [-(GC - 1) * GS / 2, 10.0, 0] : [-12.2, 3.4, 0];
const gridPos = (j) => [gridOrigin[0] + (j % GC) * GS, gridOrigin[1] - Math.floor(j / GC) * GS, 0];
const MENTIONS = [];
ANS.forEach((a, i) => a.b.forEach((b) => MENTIONS.push({ a: i, b, t5: CO.top5_ids.includes(b) })));
MENTIONS.sort((x, y) => (y.t5 - x.t5) || (x.a - y.a));
const SR = 8, SS = VERT ? 0.198 : 0.2;
const stripOrigin = VERT ? [-5.55, -5.6, 0] : [1.6, -0.9, 0];
const stripPos = (j) => [stripOrigin[0] + Math.floor(j / SR) * SS, stripOrigin[1] - (j % SR) * SS, 0];
const NSTRIP_COLS = Math.ceil(MENTIONS.length / SR);
// 场景 4 的节奏：点阵在"百分之八十二"念出时全部点亮；提及条在"至少有前五名"时飞入；占比数字在"榜单"时出现
const PCT_AT = A(S_GRID, 'pct', 2.6), LIT0 = Math.min(1.0, PCT_AT - 1.2);
const litAt = (j) => LIT0 + j * (PCT_AT + 0.05 - LIT0) / Math.max(1, CO.covered.length - 1);
const STRIP_AT = A(S_GRID, 'least', 3.7) + 0.2, BOARD_AT = A(S_GRID, 'board', 6.2) - 0.3;
// 场景 1：星在"挨个问了四个 AI"时按平台依次亮起；大字在"一共"时出现
const STAR_AT = A(S_STARS, 'ask', 5.3) - 0.4, BIG1_AT = A(S_STARS, 'total', 6.8) - 0.4;

// 场景 5：三个问题的轨道
const SQ = ['Q09', 'Q11', 'Q13'];
const SYS = SQ.map((q, si) => {
  const st = D.stability[q];
  const spread = Math.pow(1 - st.mean, 2) * (VERT ? 0.7 : 1.05);         // 环离散角度：(1−平均重合度)² 的单调映射，仅示意
  const c = VERT ? [0, [6.4, 1.3, -5.4][si], 0] : [-9.7 + si * 9.7, 0.2, 0];
  const R = VERT ? 3.2 : 3.0;
  const sats = [];
  st.platforms.forEach((pl, p) => {
    const uniq = [...new Set(pl.rounds.flat())];
    const freq = (b) => pl.rounds.filter((r) => r.includes(b)).length;
    uniq.sort((x, y) => freq(y) - freq(x) || x - y);
    uniq.forEach((b) => sats.push({ p, b, rounds: pl.rounds.map((r) => r.includes(b)) }));
  });
  const n = sats.length, gap = 0.18;
  let k = 0;
  sats.forEach((s) => { const pi = s.p; s.theta = (k / n) * (Math.PI * 2 - 4 * gap) + pi * gap; k++; });
  const rings = [0, 1, 2].map((r) => {
    const tilt = (r - 1) * spread * 0.8 + (r === 1 ? 0 : 0), axisA = r * 2.1 + si;
    const ax = new THREE.Vector3(Math.cos(axisA), 0, Math.sin(axisA)).normalize();
    const q4 = new THREE.Quaternion().setFromAxisAngle(ax, tilt + (r - 1) * spread * 0.25);
    const e1 = new THREE.Vector3(1, 0, 0).applyQuaternion(q4), e2 = new THREE.Vector3(0, 0, 1).applyQuaternion(q4);
    return { R: R * (1 + (r - 1) * (0.03 + spread * 0.12)), e1, e2 };
  });
  return { q, st, c, R, sats, rings, spread };
});
const RING_N = 180;
const ringPt = (sys, r, th) => { const g = sys.rings[r]; return [sys.c[0] + g.R * (Math.cos(th) * g.e1.x + Math.sin(th) * g.e2.x), sys.c[1] + g.R * (Math.cos(th) * g.e1.y + Math.sin(th) * g.e2.y), sys.c[2] + g.R * (Math.cos(th) * g.e1.z + Math.sin(th) * g.e2.z)]; };
const SAT_LIST = [];
SYS.forEach((sys, si) => sys.sats.forEach((s) => s.rounds.forEach((on, r) => { if (on) SAT_LIST.push({ si, r, s }); })));

// 场景 6：价格带
const PR = D.prices;
const PMIN = 600, PMAX = 2800;                     // 元/立方米
const fmt = (n) => Number(n).toLocaleString('en-US');
const X0 = VERT ? -5.9 : -8.4, X1 = VERT ? 5.6 : 12.6;
const px = (v) => X0 + (v - PMIN) / (PMAX - PMIN) * (X1 - X0);
const rowY = (p) => VERT ? 4.6 - p * 2.55 : 1.45 - p * 1.55;
const REF_TOP = VERT ? 6.6 : 2.55, REF_BOT = VERT ? -4.9 : -4.15;
const bandRow = PR.ai.map((b, i) => { const same = PR.ai.filter((x) => x.p === b.p); const k = same.indexOf(b); return { k, n: same.length }; });
const bandY = (i) => { const b = PR.ai[i], r = bandRow[i]; return rowY(b.p) + (r.n > 1 ? (r.k === 0 ? 0.30 : -0.36) : 0); };
const bandAt = (i) => A(S_PRICE, 'e1', 3.0) - 0.2 + PR.ai[i].p * 0.62 + bandRow[i].k * 0.3;     // "它还在按 E1、按四八尺报价"
const REF_AT = A(S_PRICE, 'ref', 6.1) - 0.3;                                                    // "可行内的定制板"

// 场景 8：MIX
const MIX_POS = [0, VERT ? -0.6 : -0.2, 3];
const MIX_AT = A(S_MIX, 'mix', 2.8) - 0.2;

// 场景 6：在你的城市（两座城市像两个星系；中间是四个平台，各自向城市射出光束，落点就是它报的商家）
const CITIES = LOC.cities.slice(0, 2);
const CITY_C = VERT ? [[0, 3.8, 0], [0, -8.0, 0]] : [[-8.8, -3.3, 0], [8.8, -3.3, 0]];
const CITY_R = VERT ? 3.5 : 4.2;
const EMIT = PN.map((_, p) => VERT ? [-5.1 + p * 3.4, -2.2, 0] : [0, 0.5 - p * 1.85, 0]);
const BEAM_AT = (ci, p) => A(S_CITY, 'beams', 3.5) - 0.1 + ci * 1.5 + p * 0.32;           // "四个 AI 都直接报出了"
const SHARED_AT = A(S_CITY, 'shared', 9.2) - 0.1, MAP_AT = A(S_CITY, 'map', 13.0) - 0.1, CONCL_AT = A(S_CITY, 'concl', 17.3) - 0.2;
const TOTAL_AT = A(S_CITY, 'total', 7.6) - 0.1, ONLY_AT = A(S_CITY, 'only', 11.5) - 0.1;
const QW = PN.indexOf('千问');
const ENTS = [];          // 每个商家一颗星
CITIES.forEach((c, ci) => {
  // 每个平台在星系里占一个扇区：只被它一家报到的商家散落在自己的扇区外圈；被几家同时报到的落在这几个扇区之间、靠近中心
  const base = VERT ? [Math.PI * 0.75, Math.PI * 0.25, -Math.PI * 0.25, -Math.PI * 0.75] : [Math.PI * 0.6, Math.PI * 0.1, -Math.PI * 0.35, -Math.PI * 0.85];
  const sector = (p) => ci === 0 ? base[p] : (VERT ? -base[p] : Math.PI - base[p]);        // 第二座城市镜像
  c.entities.forEach((e, j) => {
    const k = e.plats.length, h1 = hash(e.n * 3.1 + ci), h2 = hash(e.n * 7.7 + 1.3), h3 = hash(e.n * 1.9 + 4.2);
    let th, r;
    if (k === 1) { th = sector(e.plats[0]) + (h1 - 0.5) * 1.25; r = CITY_R * (0.55 + 0.45 * Math.sqrt(h2)); }
    else if (k >= 3) { const three = c.entities.filter((x) => x.plats.length >= 3), m = three.indexOf(e); th = Math.PI / 2 + m * Math.PI * 2 / three.length; r = CITY_R * (three.length > 1 ? 0.15 : 0); }
    else {   // 被两家报到的：在内圈均匀排开（按两家扇区的中间方向排序），彼此不挤在一起
      const two = c.entities.filter((x) => x.plats.length === 2);
      const mid = (x) => { const sx = x.plats.reduce((s, p) => s + Math.cos(sector(p)), 0), sy = x.plats.reduce((s, p) => s + Math.sin(sector(p)), 0); return Math.atan2(sy, sx); };
      const order = two.map((x) => [x, mid(x)]).sort((m, n) => m[1] - n[1]).map((m) => m[0]);
      th = mid(order[0]) + order.indexOf(e) / two.length * Math.PI * 2; r = CITY_R * (0.36 + 0.06 * (order.indexOf(e) % 2));
    }
    const pos = [CITY_C[ci][0] + Math.cos(th) * r,CITY_C[ci][1] + Math.sin(th) * r * (VERT ? 0.82 : 0.78), (h3 - 0.5) * 1.6];
    const land = Math.min(...e.plats.map((p) => BEAM_AT(ci, p))) + 1.3;
    ENTS.push({ ci, e, k, pos, land, th, r });
  });
});
const BEAMS = [];         // 平台 → 商家，一条光束
ENTS.forEach((x, i) => x.e.plats.forEach((p) => BEAMS.push({ i, p, ci: x.ci, at: BEAM_AT(x.ci, p) })));
const BEAM_PER = 5;

/* ---------------------------------------------------------------- 装饰星尘（与数据星明显区分：更暗、更小、冷灰、静止） */
const NDUST = 1500;
const dust = new Points(NDUST, (s, u, o) => {}, {});
dust.noBlend = true;
for (let i = 0; i < NDUST; i++) {
  // 只放在所有镜头的前方远处（z −70 ~ −190），避免靠近镜头时变成大光斑
  const z = -70 - hash(i * 3.7) * 120, spread = 0.75 * (60 - z);
  put(dust.attr, i, [(hash(i * 1.17) - 0.5) * 2 * spread, (hash(i * 2.31) - 0.5) * 1.3 * spread, z],
    [0.62, 0.67, 0.76], 10 + hash(i * 5.1) * 9, 0.10 + hash(i * 8.3) * 0.22, 2);
}
dust.update = function () { for (const k of ['position', 'acolor', 'size', 'alpha', 'kind']) this.geo.getAttribute(k).needsUpdate = true; this.update = () => {}; };

/* ---------------------------------------------------------------- 回答星（120） */
const ansStars = new Points(ANS.length, (s, u, o) => {
  ANS.forEach((a, i) => {
    const home = ansHome[i], col = PC[a.p], sz = ansSize[i];
    const tw = 0.93 + 0.07 * Math.sin(T * 1.1 + i * 2.17);
    const k = i % 30;
    switch (s) {
      case S_STARS: { const t0 = STAR_AT + a.p * 0.35 + k * 0.03; put(o, i, home, col, sz, seg(u, t0, t0 + 0.9) * 0.95 * tw); break; }   // "挨个问了四个 AI"
      case S_SOURCE: put(o, i, home, col, sz, lerp(0.95, 0.7, seg(u, sigLitAt(0) - 0.6, sigLitAt(0) + 0.6)) * tw); break;
      case S_BRAND: put(o, i, [home[0] * 1.5, home[1] * 1.5, home[2] - 24], col, sz * 0.8, 0.3 * tw); break;
      case S_GRID: {
        if (gridIdx.has(i)) {
          const j = gridIdx.get(i), cv = coverOrder.has(i);
          const lit = cv ? seg(u, litAt(coverOrder.get(i)), litAt(coverOrder.get(i)) + 0.35) : 0;
          put(o, i, gridPos(j), cv ? mix3(DIM, GOLD, lit) : DIM, lerp(8.5, 11, lit), lerp(0.5, 1, lit));
        } else put(o, i, [home[0] * 1.5, home[1] * 1.5, home[2] - 18], col, sz * 0.7, 0.12);
        break;
      }
      case S_ORBIT: case S_CITY: case S_PRICE: put(o, i, [home[0] * 1.5, home[1] * 1.5, home[2] - 24], col, sz * 0.8, 0.0); break;
      case S_MIX: put(o, i, [home[0] * 1.9, home[1] * 1.9, home[2] - 34], col, sz * 1.05, seg(u, 0.3, 2.5) * 0.55 * tw); break;
    }
  });
}, { bulge: 3, order: 2 });

/* ---------------------------------------------------------------- 引用粒子（1486，一条引用一个粒子） */
const PERIOD = 4.8;                 // 引用粒子流动放慢（v2 是 3.8）
const D_SRC = SCENES[S_SOURCE].dur, D_BRAND = SCENES[S_BRAND].dur, D_GRID = SCENES[S_GRID].dur, D_ORBIT = SCENES[S_ORBIT].dur, D_CITY = SCENES[S_CITY].dur, D_PRICE = SCENES[S_PRICE].dur, D_STARS = SCENES[S_STARS].dur;
const citP = new Points(CIT.length, (s, u, o) => {
  for (let j = 0; j < CIT.length; j++) {
    const [a, c] = CIT[j], p = ANS[a].p, st = ansHome[a];
    if (s !== 1) { put(o, j, st, PC[p], 2.2, 0); continue; }
    const tt = (u - 0.7) / PERIOD - hash(j * 0.71);
    if (tt < 0) { put(o, j, st, PC[p], 2.2, 0); continue; }
    const f = tt - Math.floor(tt), e = nodePos[c], m = citCtrl[j], g = 1 - f;
    const pos = [g * g * st[0] + 2 * g * f * m[0] + f * f * e[0], g * g * st[1] + 2 * g * f * m[1] + f * f * e[1], g * g * st[2] + 2 * g * f * m[2] + f * f * e[2]];
    const isSig = c === SIG[p];
    const lit = isSig ? seg(u, sigLitAt(p), sigLitAt(p) + 0.8) : 0;
    const dimOthers = 1 - 0.55 * seg(u, sigLitAt(0) - 0.6, sigLitAt(0) + 0.8);
    const env = Math.pow(Math.sin(Math.PI * f), 0.6) * seg(u, 0.7, 2.2) * (1 - seg(u, D_SRC - 0.8, D_SRC));
    put(o, j, pos, mix3(PC[p], GOLD, lit), lerp(2.3, 3.4, lit), env * lerp(0.62 * dimOthers, 1.0, lit));
  }
}, { order: 1 });

/* ---------------------------------------------------------------- 来源节点（21 类） */
const nodes = new Points(NC, (s, u, o) => {
  for (let c = 0; c < NC; c++) {
    const p = SIG.indexOf(c), lit = p >= 0 ? seg(u, sigLitAt(p), sigLitAt(p) + 0.9) : 0;
    if (s !== 1) { put(o, c, nodePos[c], WARM, nodeSize[c], 0); continue; }
    const a = seg(u, 0.9 + c * 0.05, 2.0 + c * 0.05) * (1 - seg(u, D_SRC - 0.8, D_SRC));
    put(o, c, nodePos[c], mix3([0.8, 0.77, 0.72], GOLD, lit), nodeSize[c] * (1 + 0.18 * lit), a * lerp(0.62, 1, lit));
  }
}, { order: 3 });

/* ---------------------------------------------------------------- 品牌星（36；场景 3 只显示提及 ≥5 的 24 个） */
const brandSize = (m) => BK * Math.sqrt(m);
const morphK = (u) => seg(u, MORPH_A, MORPH_B);
const brands = new Points(NB, (s, u, o) => {
  for (let i = 0; i < NB; i++) {
    const b = i < NTOP ? BR[i] : null;
    const home3 = i < NTOP ? bPos3[i] : bPos7[i];
    switch (s) {
      case 2: {
        if (!b) { put(o, i, home3, WARM, 0, 0); break; }
        const k = morphK(u), t0 = 0.6 + i * 0.085;
        const app = seg(u, t0, t0 + 1.1);
        const hotA = b.top5 ? 1 : 0, hotB = HOT_FIRST.includes(b.id) ? 1 : 0;
        const hot = lerp(hotA * seg(u, 1.6, 2.6), hotB, k);
        const zero = b.first === 0;
        const size = zero && k > 0.5 ? lerp(brandSize(b.mentions) * 0.4, 11, seg(k, 0.5, 1)) : lerp(brandSize(b.mentions), brandSize(b.first), k);
        const al = lerp(1, zero ? 0.42 : 0.5 + 0.5 * Math.sqrt(b.first / FIRST_MAX), k) * (FOCUS_I >= 0 && i !== FOCUS_I ? lerp(1, 0.55, seg(u, 2.0, 3.2)) : 1);
        const isF = i === FOCUS_I;
        put(o, i, home3, isF ? GOLD : mix3(WARM, GOLD, hot * 0.85), Math.max(size, isF ? 9 : 0) * (0.6 + 0.4 * app), app * al, zero && k > 0.5 ? 1 : 0);
        break;
      }
      case S_GRID: put(o, i, [home3[0] * 1.2, home3[1] * 1.2, home3[2] - 12], WARM, b ? brandSize(b.first) : 0, b ? 0.10 : 0); break;
      case S_MIX: { const t0 = 0.4 + (i % 12) * 0.12; put(o, i, bPos7[i], mix3(WARM, GOLD, 0.25 + 0.5 * Math.sqrt(MENT[i] / MENT_MAX)), brandSize(MENT[i]) * 0.95, seg(u, t0, t0 + 1.4) * 0.92); break; }
      default: put(o, i, home3, WARM, b ? brandSize(b.mentions) : 0, 0);
    }
  }
}, { bulge: 2, order: 4 });

/* ---------------------------------------------------------------- 提及粒子（452） */
const ments = new Points(MENTIONS.length, (s, u, o) => {
  MENTIONS.forEach((m, j) => {
    const src = m.b < NTOP ? [bPos3[m.b][0] * 1.2, bPos3[m.b][1] * 1.2, bPos3[m.b][2] - 12] : [ansHome[m.a][0] * 1.5, ansHome[m.a][1] * 1.5, ansHome[m.a][2] - 18];
    if (s !== S_GRID) { put(o, j, src, WARM, 3, 0); return; }
    const col = Math.floor(j / SR), t0 = STRIP_AT + col * 0.022;
    const k = seg(u, t0, t0 + 1.3), land = seg(u, t0 + 1.0, t0 + 1.6);
    const p = stripPos(j), q = [lerp(src[0], p[0], k), lerp(src[1], p[1], k), lerp(src[2], p[2], k) + Math.sin(Math.PI * k) * 2];
    put(o, j, q, m.t5 ? mix3(WARM, GOLD, land) : [0.7, 0.71, 0.74], m.t5 ? 3.6 : 3.1, seg(u, t0 - 0.2, t0 + 0.3) * (m.t5 ? 1 : 0.42));
  });
}, { order: 5 });

/* ---------------------------------------------------------------- 轨道（3 题 × 3 轮） */
const ringN = SYS.length * 3 * RING_N;
const rings = new Points(ringN, (s, u, o) => {
  let i = 0;
  SYS.forEach((sys, si) => [0, 1, 2].forEach((r) => {
    for (let k = 0; k < RING_N; k++, i++) {
      const th = k / RING_N * Math.PI * 2;
      const p = ringPt(sys, r, th + (s === S_ORBIT ? u * 0.04 : 0));
      if (s !== S_ORBIT) { put(o, i, [sys.c[0], sys.c[1], sys.c[2]], WARM, 1.6, 0); continue; }
      const rev = seg(u, 0.6 + si * 0.25 + r * 0.25 + k / RING_N * 1.2, 0.9 + si * 0.25 + r * 0.25 + k / RING_N * 1.2);
      put(o, i, p, mix3([0.75, 0.73, 0.70], GOLD, 0.25), 2.0, rev * 0.42 * (1 - seg(u, D_ORBIT - 0.85, D_ORBIT)));
    }
  }));
}, { order: 1 });
rings.noBlend = true;
const sats = new Points(SAT_LIST.length, (s, u, o) => {
  SAT_LIST.forEach((x, i) => {
    const sys = SYS[x.si];
    const p = ringPt(sys, x.r, x.s.theta + (s === S_ORBIT ? u * 0.04 : 0));
    if (s !== S_ORBIT) { put(o, i, p, PC[x.s.p], 6, 0); return; }
    const t0 = 2.2 + x.si * 0.35 + x.r * 0.3 + hash(i) * 0.4;
    put(o, i, p, PC[x.s.p], 8.0, seg(u, t0, t0 + 0.7) * 0.95 * (1 - seg(u, D_ORBIT - 0.85, D_ORBIT)));
  });
}, { order: 2 });
sats.noBlend = true;

/* ---------------------------------------------------------------- 目标品牌金圈（公开版 FOCUS 恒为空，不会出现） */
const FZ_POS = VERT ? [0, -7.2, 0] : [9.6, -5.2, 0];         // 目标品牌一次都没被提到时，单独放一个空心圈
const focusRing = new Points(1, (s, u, o) => {
  if (!FOCUS || s !== S_BRAND) { put(o, 0, [0, 0, 0], GOLD, 0, 0, 1); return; }
  const fade = seg(u, 2.0, 3.0) * (1 - seg(u, D_BRAND - 0.8, D_BRAND - 0.05));
  if (FOCUS_I >= 0) {
    const b = BR[FOCUS_I], k = morphK(u), v = lerp(b.mentions, b.first, k);
    put(o, 0, bPos3[FOCUS_I], GOLD, Math.max(26, brandSize(Math.max(v, 1)) * 1.25 + 22), fade * 0.95, 1);
  } else put(o, 0, FZ_POS, GOLD, 30, fade * 0.8, 1);
}, { order: 7 });
focusRing.noBlend = true;

/* ---------------------------------------------------------------- 场景 6：在你的城市 */
const cityOn = (u) => seg(u, 0.3, 1.6) * (1 - seg(u, D_CITY - 0.8, D_CITY));
// 星系的盘面：装饰性星尘（冷灰、很暗、不代表数据），两条旋臂
const NCD = 420;
const cityDust = new Points(NCD * 2, (s, u, o) => {
  for (let ci = 0; ci < 2; ci++) for (let j = 0; j < NCD; j++) {
    const i = ci * NCD + j, c = CITY_C[ci];
    const arm = j % 2, t = hash(j * 1.37 + ci * 9.1), r = CITY_R * (0.12 + 1.02 * Math.sqrt(t));
    const th = arm * Math.PI + t * 4.6 + (hash(j * 3.3 + ci) - 0.5) * 0.9 + (ci ? 0.8 : 0) + (s === S_CITY ? u * 0.012 : 0);
    const p = [c[0] + Math.cos(th) * r, c[1] + Math.sin(th) * r * (VERT ? 0.82 : 0.78), (hash(j * 5.9 + ci) - 0.5) * 1.2];
    if (s !== S_CITY || !CITIES[ci]) { put(o, i, p, [0.6, 0.65, 0.74], 0, 0, 2); continue; }
    put(o, i, p, [0.62, 0.67, 0.78], 6 + hash(j * 2.2) * 8, cityOn(u) * (0.05 + 0.10 * hash(j * 4.4)) * (1 - 0.6 * t), 2);
  }
}, { order: 0 });
cityDust.noBlend = true;
// 商家星：亮起的时刻 = 第一束光落到它身上；"两个以上"念出时，被多个平台同时报到的变亮变大，只被一家报到的变暗、向外散开
const entPos = (x, u) => {
  const sh = seg(u, SHARED_AT, SHARED_AT + 1.2), c = CITY_C[x.ci];
  const push = x.k === 1 ? 1 + 0.10 * sh : 1;
  return [c[0] + (x.pos[0] - c[0]) * push, c[1] + (x.pos[1] - c[1]) * push, x.pos[2]];
};
const mapK = (u) => seg(u, MAP_AT, MAP_AT + 0.7) * (1 - seg(u, CONCL_AT, CONCL_AT + 0.9));
const ents = new Points(Math.max(1, ENTS.length), (s, u, o) => {
  ENTS.forEach((x, i) => {
    if (s !== S_CITY) { put(o, i, x.pos, WARM, 0, 0); return; }
    const app = seg(u, x.land - 0.15, x.land + 0.35), sh = seg(u, SHARED_AT, SHARED_AT + 0.9);
    const isQ = x.ci === 0 && x.e.plats.includes(QW), mk = isQ ? mapK(u) : 0;
    const tw = 0.92 + 0.08 * Math.sin(T * 1.3 + i * 1.7);
    let size, al, col;
    if (x.k >= 2) { size = lerp(7.5, 9 + 3.6 * x.k, sh); al = 0.85 + 0.15 * sh; col = mix3(x.e.market ? [1, 0.9, 0.76] : WARM, GOLD, sh * 0.9); }
    else { size = lerp(7, 4.6, sh); al = lerp(0.8, 0.40, sh) + 0.35 * mk; col = mix3(x.e.market ? [1, 0.9, 0.76] : [0.9, 0.9, 0.92], DIM, sh * 0.5); }
    put(o, i, entPos(x, u), col, size * (1 + 0.15 * mk), app * al * tw * (1 - seg(u, D_CITY - 0.8, D_CITY)));
  });
}, { order: 4 });
// 四个平台：光源
const emitters = new Points(PN.length, (s, u, o) => {
  PN.forEach((_, p) => {
    if (s !== S_CITY) { put(o, p, EMIT[p], PC[p], 0, 0); return; }
    const a0 = BEAM_AT(0, p), pulse = seg(u, a0, a0 + 0.25) * (1 - seg(u, a0 + 0.25, a0 + 1.4)) + (p === QW ? mapK(u) * 0.6 : 0);
    put(o, p, EMIT[p], PC[p], 13 + 9 * pulse, seg(u, 0.6 + p * 0.15, 1.4 + p * 0.15) * (1 - seg(u, D_CITY - 0.8, D_CITY)));
  });
}, { order: 5 });
// 光束：每个"平台 → 商家"一束，粒子沿弧线流过去
const beamCtrl = BEAMS.map((b, j) => {
  const s0 = EMIT[b.p], e = ENTS[b.i].pos, m = [(s0[0] + e[0]) / 2, (s0[1] + e[1]) / 2, (s0[2] + e[2]) / 2];
  const dx = e[0] - s0[0], dy = e[1] - s0[1], L = Math.hypot(dx, dy) || 1, w = (hash(j * 2.71) - 0.5) * 1.6;
  return [m[0] - dy / L * w, m[1] + dx / L * w, m[2] + (hash(j * 1.9) - 0.5) * 2];
});
const beamLevel = (b, u) => {          // 这束光此刻的亮度
  const el = u - b.at; if (el < 0) return 0;
  const x = ENTS[b.i], sh = seg(u, SHARED_AT, SHARED_AT + 0.9), mk = b.ci === 0 ? mapK(u) : 0;
  let lv = lerp(0.55, 0.24, seg(el, 1.2, 3.0));
  lv = lerp(lv, x.k >= 2 ? 0.34 : 0.10, sh);
  lv = b.p === QW ? lerp(lv, 0.8, mk) : lv * (1 - 0.6 * mk);
  return lv * (1 - seg(u, D_CITY - 0.8, D_CITY));
};
const TRV = 1.3;                    // 光束飞行时间（放慢）
const beamP = new Points(Math.max(1, BEAMS.length * BEAM_PER), (s, u, o) => {
  BEAMS.forEach((b, j) => {
    const st = EMIT[b.p], e = entPos(ENTS[b.i], u), m = beamCtrl[j];
    for (let q = 0; q < BEAM_PER; q++) {
      const i = j * BEAM_PER + q;
      if (s !== S_CITY) { put(o, i, st, PC[b.p], 2, 0); continue; }
      const tt = (u - b.at) / TRV - q * (1 / BEAM_PER) * 1.6 - hash(j * 0.37) * 0.3;
      if (tt < 0) { put(o, i, st, PC[b.p], 2, 0); continue; }
      const f = tt < 1 ? tt : (tt - 1) * 0.55 % 1, g = 1 - f;
      const pos = [g * g * st[0] + 2 * g * f * m[0] + f * f * e[0], g * g * st[1] + 2 * g * f * m[1] + f * f * e[1], g * g * st[2] + 2 * g * f * m[2] + f * f * e[2]];
      const lv = beamLevel(b, u), mk = b.p === QW && b.ci === 0 ? mapK(u) : 0;
      put(o, i, pos, mix3(PC[b.p], GOLD, mk * 0.45), lerp(2.4, 3.2, mk), lv * Math.pow(Math.sin(Math.PI * f), 0.5) * (q === 0 && tt < 1 ? 1.4 : 1));
    }
  });
}, { order: 3 });
beamP.noBlend = true; ents.noBlend = true; emitters.noBlend = true;
// 光束的细线（落点 = 推荐的商家）
const bGeo = new THREE.BufferGeometry();
const blp = new Float32Array(Math.max(1, BEAMS.length) * 6), blc = new Float32Array(Math.max(1, BEAMS.length) * 6), bla = new Float32Array(Math.max(1, BEAMS.length) * 2);
bGeo.setAttribute('position', new THREE.BufferAttribute(blp, 3)); bGeo.setAttribute('acolor', new THREE.BufferAttribute(blc, 3)); bGeo.setAttribute('alpha', new THREE.BufferAttribute(bla, 1));
bGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
const beamLines = new THREE.LineSegments(bGeo, new THREE.ShaderMaterial({
  vertexShader: 'attribute vec3 acolor;attribute float alpha;varying vec3 vC;varying float vA;void main(){vC=acolor;vA=alpha;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader: 'varying vec3 vC;varying float vA;void main(){gl_FragColor=vec4(vC,vA);}',
  transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
}));
beamLines.frustumCulled = false; scene.add(beamLines);
function updateBeamLines(s, u) {
  BEAMS.forEach((b, j) => {
    const st = EMIT[b.p], e = entPos(ENTS[b.i], u), grow = s === S_CITY ? seg(u, b.at, b.at + TRV) : 0;
    const al = s === S_CITY ? beamLevel(b, u) * 0.30 : 0, c = PC[b.p];
    for (let k = 0; k < 3; k++) { blp[j * 6 + k] = st[k]; blp[j * 6 + 3 + k] = lerp(st[k], e[k], grow); blc[j * 6 + k] = c[k]; blc[j * 6 + 3 + k] = c[k]; }
    bla[j * 2] = al * 0.5; bla[j * 2 + 1] = al;
  });
  for (const k of ['position', 'acolor', 'alpha']) bGeo.getAttribute(k).needsUpdate = true;
}

/* ---------------------------------------------------------------- MIX：一颗暗星 */
const mixStar = new Points(2, (s, u, o) => {
  const a = s === S_MIX ? seg(u, MIX_AT, MIX_AT + 1.8) : 0;
  const breathe = 0.85 + 0.15 * Math.sin(T * 0.9);
  put(o, 0, MIX_POS, [0.80, 0.68, 0.48], 74, a * 0.6 * breathe, 1);        // 外环：表示它在那里
  put(o, 1, MIX_POS, [0.5, 0.45, 0.4], 6, a * 0.12, 0);                    // 几乎不发光的芯
}, { order: 6 });
mixStar.noBlend = true;

/* ---------------------------------------------------------------- 连线（星座） */
const EDGES = D.edges, EMAX = Math.max(...EDGES.map((e) => e[2]));
const lineGeo = new THREE.BufferGeometry();
const lp = new Float32Array(EDGES.length * 6), lc = new Float32Array(EDGES.length * 6), la = new Float32Array(EDGES.length * 2);
lineGeo.setAttribute('position', new THREE.BufferAttribute(lp, 3));
lineGeo.setAttribute('acolor', new THREE.BufferAttribute(lc, 3));
lineGeo.setAttribute('alpha', new THREE.BufferAttribute(la, 1));
lineGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
const lineMat = new THREE.ShaderMaterial({
  vertexShader: 'attribute vec3 acolor;attribute float alpha;varying vec3 vC;varying float vA;void main(){vC=acolor;vA=alpha;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader: 'varying vec3 vC;varying float vA;void main(){gl_FragColor=vec4(vC,vA);}',
  transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
});
const lines = new THREE.LineSegments(lineGeo, lineMat); lines.frustumCulled = false; scene.add(lines);
function updateLines(s, u) {
  const bp = brands.attr.pos;
  EDGES.forEach(([a, b, n], e) => {
    let al = 0, grow = 1;
    const w = 0.10 + 0.42 * (n / EMAX);
    if (s === S_BRAND) { const t0 = 1.6 + e * 0.035; grow = seg(u, t0, t0 + 1.2); al = w * seg(u, t0, t0 + 0.4) * lerp(1, 0.55, morphK(u)) * (1 - seg(u, D_BRAND - 0.8, D_BRAND)); }
    else if (s === S_GRID && u < TRANS) al = w * 0.55 * (1 - seg(u, 0, 1.2));
    const A = [bp[a * 3], bp[a * 3 + 1], bp[a * 3 + 2]], B = [bp[b * 3], bp[b * 3 + 1], bp[b * 3 + 2]];
    for (let j = 0; j < 3; j++) { lp[e * 6 + j] = A[j]; lp[e * 6 + 3 + j] = lerp(A[j], B[j], grow); lc[e * 6 + j] = lc[e * 6 + 3 + j] = [0.95, 0.86, 0.70][j]; }
    la[e * 2] = al; la[e * 2 + 1] = al * 0.9;
  });
  for (const k of ['position', 'acolor', 'alpha']) lineGeo.getAttribute(k).needsUpdate = true;
}

/* ---------------------------------------------------------------- 光带（价格） */
const RECT_FS = `float rs(float a,float b,float x){float t=clamp((x-a)/(b-a),0.,1.);return t*t*(3.-2.*t);}uniform vec3 uC;uniform float uA;uniform float uRev;uniform float uMode;varying vec2 vUv;
void main(){float x=vUv.x,y=vUv.y;float a;
if(uMode<.5){float ey=exp(-pow((y-.5)*3.4,2.));float core=exp(-pow((y-.5)*9.,2.));float ex=rs(0.,.012,x)*rs(1.,.988,x);a=(ey*.55+core*.6)*ex;}
else if(uMode<1.5){float ey=rs(0.,.18,y)*rs(1.,.82,y);float edge=rs(.0,.04,x)*rs(1.,.96,x);float rim=exp(-pow(x*28.,2.))+exp(-pow((1.-x)*28.,2.));a=ey*(edge*.30+rim*.55);}
else{float ey=rs(0.,.18,y)*rs(1.,.82,y);float rim=exp(-pow(x*28.,2.));a=ey*(pow(1.-x,1.6)*.30+rim*.55);}
a*=rs(uRev,uRev-.03,x);gl_FragColor=vec4(uC,a*uA);}`;
const RECT_VS = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
function rect(mode, color) {
  const m = new THREE.ShaderMaterial({ uniforms: { uC: { value: new THREE.Color(...color) }, uA: { value: 0 }, uRev: { value: 1 }, uMode: { value: mode } }, vertexShader: RECT_VS, fragmentShader: RECT_FS, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m); mesh.frustumCulled = false; mesh.renderOrder = 0; scene.add(mesh); return mesh;
}
const refRects = PR.ref.map((r) => rect(r.open ? 2 : 1, GOLD));
const pointRect = rect(1, GOLD);
const aiRects = PR.ai.map((b) => rect(0, PC[b.p]));
const axisRect = rect(0, [0.7, 0.68, 0.64]);
function updateRects(s, u) {
  const on = s === S_PRICE;
  const fade = on ? 1 - seg(u, D_PRICE - 0.9, D_PRICE) : 0;
  PR.ref.forEach((r, i) => {
    const m = refRects[i], x0 = px(r.lo), x1 = r.open ? px(PMAX) + 0.6 : px(r.hi);
    m.position.set((x0 + x1) / 2, (REF_TOP + REF_BOT) / 2, -0.2); m.scale.set(x1 - x0, REF_TOP - REF_BOT, 1);
    const t0 = REF_AT + i * 0.35;
    m.material.uniforms.uA.value = on ? seg(u, t0, t0 + 1.0) * fade * 0.42 : 0;
    m.material.uniforms.uRev.value = 1.03;
  });
  PR.ai.forEach((b, i) => {
    const m = aiRects[i], x0 = px(b.lo_m3), x1 = Math.max(px(b.hi_m3), x0 + 0.14), y = bandY(i), t0 = bandAt(i);   // 单个报价（约 53）给一条细线
    const k = on ? seg(u, t0, t0 + 1.4) : 0;
    m.position.set(lerp((x0 + x1) / 2 + 9, (x0 + x1) / 2, k), y, lerp(8, 0, k));
    m.scale.set(x1 - x0, VERT ? 0.55 : 0.42, 1);
    m.material.uniforms.uA.value = on ? seg(u, t0, t0 + 0.6) * fade * 0.62 : 0;
    m.material.uniforms.uRev.value = lerp(0.15, 1.03, seg(u, t0 + 0.2, t0 + 1.6));
  });
  { const x = px(PR.ref_point.at), t0 = REF_AT + PR.ref.length * 0.35;
    pointRect.position.set(x, (REF_TOP + REF_BOT) / 2, -0.1); pointRect.scale.set(0.16, REF_TOP - REF_BOT, 1);
    pointRect.material.uniforms.uA.value = on ? seg(u, t0, t0 + 1.0) * fade * 0.9 : 0; pointRect.material.uniforms.uRev.value = 1.03; }
  axisRect.position.set((X0 + X1) / 2, REF_BOT - 0.15, 0); axisRect.scale.set(X1 - X0, 0.08, 1);
  axisRect.material.uniforms.uA.value = on ? seg(u, 0.5, 1.5) * fade * 0.6 : 0;
  axisRect.material.uniforms.uRev.value = on ? seg(u, 0.4, 1.8) * 1.03 : 0;
}

/* ---------------------------------------------------------------- 镜头 */
function cam(s, u) {
  const d = SCENES[s].dur;
  switch (s) {
    case 0: return { p: [0, -0.4, lerp(VERT ? 48 : 44, VERT ? 33 : 28.5, seg(u, 0, d + 2))], t: [0, 0, 0] };
    case 1: return { p: [lerp(0, 1.2, u / d), lerp(-3.5, -5.0, u / d), VERT ? 31 : 34.5], t: [0, VERT ? -3.9 : -2.4, 0] };
    case 2: { const a = lerp(-0.07, 0.09, u / d); return { p: [Math.sin(a) * 29, 1.2, Math.cos(a) * (VERT ? 31 : 28.5)], t: [0, 0, 0] }; }
    case 3: return { p: [lerp(-0.6, 0.6, u / d), 0.3, VERT ? 29 : 25.5], t: [0, VERT ? 1.2 : 0.2, 0] };
    case 4: return { p: [lerp(-1.2, 1.2, u / d), VERT ? 8.5 : 12.5, VERT ? 25 : 23.5], t: [0, VERT ? -1.0 : -0.9, 0] };
    case S_CITY: return VERT ? { p: [lerp(-0.3, 0.3, u / d), -1.7, lerp(37, 35.5, u / d)], t: [0, -1.5, 0] } : { p: [lerp(-0.6, 0.6, u / d), -0.9, lerp(31.5, 30, u / d)], t: [0, -1.0, 0] };
    case S_PRICE: return { p: [lerp(VERT ? 0.4 : 2.6, VERT ? -0.2 : 1.8, u / d), VERT ? -0.2 : 0.35, lerp(VERT ? 28.8 : 24.5, VERT ? 27.6 : 23, u / d)], t: [lerp(VERT ? 0.4 : 2.6, VERT ? -0.2 : 1.8, u / d) * 0.95, VERT ? -0.2 : 0.35, 0] };
    case S_MIX: return { p: [0, 0, lerp(VERT ? 34 : 30, VERT ? 58 : 54, seg(u, 0, d + 1.5))], t: [0, 0, 0] };
  }
}
function updateCamera(s, u) {
  let c = cam(s, u);
  if (s > 0 && u < TRANS_CAM) {
    const a = cam(s - 1, SCENES[s - 1].dur), k = ease(u / TRANS_CAM);
    c = { p: mix3(a.p, c.p, k), t: mix3(a.t, c.t, k) };
    c.p[2] += Math.sin(Math.PI * k) * 2.5;          // 过渡时轻轻后撤，像呼吸
  }
  const br = [Math.sin(T * 0.21) * 0.28, Math.sin(T * 0.17 + 1.3) * 0.18, Math.sin(T * 0.13 + 0.4) * 0.3];
  camera.position.set(c.p[0] + br[0], c.p[1] + br[1], c.p[2] + br[2]);
  camera.lookAt(c.t[0], c.t[1], c.t[2]);
}

/* ---------------------------------------------------------------- 结论文字 */
const SIGTXT = PN.map((p) => {
  const g = D.sources.signatures[p];
  return g.share_of_cat >= 0.999 ? `${g.cat}：只出现在${p}的引用里` : `${g.cat}：${pct(g.share_of_cat)} 来自${p}`;
});
const C = D.concentration, MX = D.mix || { target: '零点', generic: 0, generic_mentions: null, named: 0, recognized: null };
const MIX_IS_US = /^MIX/.test(MX.target || '');
const MASKNOTE = '品牌名称已部分隐去';
const NET = (D.network || []).join(' / ');
const FB = FOCUS ? (FOCUS_I >= 0 ? BR[FOCUS_I] : FOCUS.zero) : null;
const FOCUSTXT = FB ? `金圈：${esc(FB.label)}，被提到 ${FB.mentions} 次，排第一 ${FB.first} 次${FB.below ? '（不足 5 次，因为是目标品牌才放进来）' : ''}。` : '';
const ST = D.stability, SQS = Object.keys(ST);
const meanOf = (kind) => { const v = SQS.filter((q) => ST[q].kind === kind && ST[q].mean != null).map((q) => ST[q].mean); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
const STAB_TXT = (meanOf('品牌题') != null && meanOf('方法题') != null && meanOf('品牌题') > meanOf('方法题'))
  ? '品牌题答案很稳；<br>方法题，<em>每次都不一样</em>。' : '同一个问题问三遍，<br>答案<em>并不总一样</em>。';
const S6A = PR.any_outdated ? 'AI 还在按 <em>E1</em> 报价，市场上定制板已基本 <em>E0</em> 起步。' : 'AI 报的是 <em>E0</em> 口径；先对齐等级，再比价格。';
const S6B = PR.ai_sheet === '4x8' && PR.ai_sheet_stated ? 'AI 默认按 <em>4×8 尺</em>算，行内主流早已是 <em>4×9 尺</em>。' : 'AI 没说报价的规格；这里按 <em>4×8 尺</em>折算。';
function sheetsHTML() {            // 两种板按毫米等比例画出
  const S48 = PR.sheets['4x8'], S49 = PR.sheets['4x9'];
  const L = Math.max(...S48.mm.slice(0, 2), ...S49.mm.slice(0, 2));
  const row = (sh, cls, ghost, text) => {
    const len = Math.max(sh.mm[0], sh.mm[1]), wid = Math.min(sh.mm[0], sh.mm[1]);
    return `<div class="sheet ${cls}"><svg viewBox="-12 -12 ${L + 24} ${wid + 24}">${ghost ? `<rect x="0" y="0" width="${L}" height="${wid}" class="ghost"/>` : ''}<rect x="0" y="0" width="${len}" height="${wid}" class="body"/></svg>`
      + `<div class="sheet-t"><b>${esc(sh.label)}</b>${sh.mm.join('×')}mm · ${sh.m3} m³/张<span>${esc(text)}</span></div></div>`;
  };
  return row(S48, 'ai', true, 'AI 报价默认的规格（虚线是 4×9 尺的长度）') + row(S49, 'ref', false, '行内主流规格；参考带下的元/张按它折算');
}
// 场景 6 的文字
const CY = LOC.cities, CIMP = CY.find((c) => c.name === LOC.implicit) || CY[0], COTH = CY.find((c) => c !== CIMP);
const cityStat = (c) => `${esc(c.name)} ${c.distinct} / ${c.shared} / ${c.single}`;
const CITY_SMALL = `不同名字 / 2 个以上 AI 同报 / 只 1 个 AI 报：${cityStat(CIMP)}${COTH ? '；' + cityStat(COTH) : ''}（门店、市场、工厂都算，同一商家的不同写法已合并）。`
  + (LOC.same_context ? '国内测试为同一对话连续提问，结果受前文影响。' : '') + (LOC.fictional ? '（虚构演示：城市与商家名单均为生成的示例）' : '');
const CITY_US = LOC.us_local ? `对照：美国网络下，千问 ${LOC.us_local.of} 条里有 ${LOC.us_local.n} 条按美国位置改写——在美国问，它把你当成美国人。` : '';
const SHEET_AT = A(S_PRICE, 'e0', 7.6) - 0.2, S6B_AT = A(S_PRICE, 'sheet', 4.7) - 0.2;
const MIXTXT_AT = A(S_MIX, 'zero', 4.75) + 0.3, WEEKS_AT = A(S_MIX, 'weeks', 6.7) - 0.2;
const BRAND_FINE = `<div class="fine" style="margin-top:calc(var(--u)*8px)">统计的是 ${esc(D.date)} 四个 AI 回答中的出现情况，不代表产品质量、企业规模或市场份额；${MASKNOTE}。</div>`;   // v3：从底部移到左上，给字幕让位
const TEXTS = [
  { s: S_STARS, pos: 'center', a: 0.9, b: STAR_AT + 0.6, html: () => `<div class="question" id="qtype"></div>`, cls: 'qbox' },
  { s: S_STARS, pos: 'tl', a: BIG1_AT, b: D_STARS, html: () => `<div class="big">我把 <em>${D.questions}</em> 个问题，问了 <em>${D.platforms.length}</em> 个 AI，<br>一共 <em>${D.answers.length}</em> 次。</div><div class="small">每颗星是一条回答，星的大小对应这条回答引用的来源数。${esc(D.date)}，${esc(NET)}网络下测试。${FICT ? '（虚构演示数据）' : ''}</div>` },
  { s: S_SOURCE, pos: 'bc', a: 1.0, b: D_SRC, html: () => `<div class="big">每个 AI，都有自己<em>偏爱的信息入口</em>。</div><div class="small">每个粒子是一条引用，共 ${CIT.length} 条。金色是各平台比其他平台用得明显更多的来源：${PN.map((p) => `${esc(p)}·${esc(D.sources.signatures[p].cat)}`).join('、')}。</div>` },
  { s: S_BRAND, pos: 'tl', a: 1.0, b: MORPH_A + 0.2, html: () => `<div class="chip">星的大小 · 被提到的次数</div><div class="big">星越大，<br>被提到的<em>次数越多</em>。</div><div class="small">只显示被提到 5 次及以上的 ${BR.filter((b) => !b.below).length} 个品牌；金色是前五名；连线表示常在同一条回答里一起出现（${esc(D.edge_rule)}）。${FOCUSTXT}</div>${BRAND_FINE}` },
  { s: S_BRAND, pos: 'tl', a: MORPH_B - 0.6, b: D_BRAND, html: () => `<div class="chip">星的大小 · 被第一个推荐的次数</div><div class="big">被提到，<br>不等于被<em>第一个推荐</em>。</div><div class="small">同一批回答，换一种数法：看谁在回答里第一个被提到。空心圈表示被提到过、但一次也没有排第一。${FOCUSTXT}</div>${BRAND_FINE}` },
  { s: S_GRID, pos: 'tl', a: 0.9, b: D_GRID, html: () => `<div class="big">前五名，出现在<br><em>${pct(C.coverage)}</em> 的推荐单里。</div><div class="small">左：${C.branded_answers} 条提到品牌的回答，一个点一条，含前五名的点亮。右：全部 ${C.total_mentions} 次品牌提及，一粒一次。</div>` },
  { s: S_ORBIT, pos: 'tl', a: 0.9, b: D_ORBIT, html: () => `<div class="big">${STAB_TXT}</div><div class="small">同一个问题问三遍：一个环是一轮，环上一颗卫星是一次品牌提及，颜色是平台。数字是三轮品牌名单的平均重合度。</div>` },
  { s: S_CITY, pos: 'tl', a: 0.9, b: CONCL_AT + 0.1, html: () => `<div class="chip">在你的城市 · 国内对照测试</div>`
      + `<div class="big" id="cityA" style="opacity:0">${esc(CIMP.name)}，<em id="cityN">${CIMP.distinct}</em> 个不同的名字</div>`
      + `<div class="mid" id="cityB" style="opacity:0">被 2 个以上 AI 同时报到的，只有 <em>${CIMP.shared}</em> 个</div>`
      + (LOC.map_lead ? `<div class="mid" id="cityC" style="opacity:0">${esc(LOC.map_lead.platform)}在${esc(LOC.map_lead.city)}引用最多的：<em>地图与点评</em>，${LOC.map_lead.n} / ${LOC.map_lead.of} 条</div>` : '') },
  { s: S_CITY, pos: 'tl', a: CONCL_AT, b: D_CITY, html: () => `<div class="chip">在你的城市 · 国内对照测试</div><div class="big">本地生意，<br>已经在 AI 的<em>名单</em>里竞争了。</div><div class="small">${CITY_SMALL}</div>${CITY_US ? `<div class="small us">${CITY_US}</div>` : ''}` },
  { s: S_PRICE, pos: 'tl', a: 0.9, b: D_PRICE, html: () => `<div class="big s6">${S6A}</div><div class="big s6" id="s6line2" style="opacity:0">${S6B}</div><div class="small">价格为 AI 回答中的说法；行内参考来自从业者，2026-11；批发按立方米计，零售常按张计。${FICT ? '虚构客户的 AI 报价为演示数值。' : ''}</div>` },
  { s: S_PRICE, pos: VERT ? 'bc' : 'tr', a: SHEET_AT, b: D_PRICE, cls: 'sheetsbox', html: () => sheetsHTML() },
  { s: S_MIX, pos: 'tl', a: MIXTXT_AT, b: SCENES[S_MIX].dur + 1, html: () => MIX_IS_US ? `<div class="big">在 AI 眼中，我还不存在。</div><div class="big" id="mixline2" style="opacity:0">四周后，我们再来看。</div>`
      : `<div class="big">零点，不是结论。</div><div class="big" id="mixline2" style="opacity:0">四周后，我们再来看。</div><div class="small">${esc(MX.target)} 的零点：${esc(MX.basis || '')}</div>` },
];
TEXTS.forEach((t) => { t.el = document.createElement('div'); t.el.className = 'tb ' + t.pos + ' ' + (t.cls || ''); t.el.innerHTML = t.html(); textEl.appendChild(t.el); });
const QTEXT = D.q01 || '做衣柜，颗粒板、多层板、生态板，哪个好？';     // 测试真正问的原题 Q01
const $ = (id) => document.getElementById(id);
const s6line2 = $('s6line2'), qtype = $('qtype'), mixline2 = $('mixline2');
const cityA = $('cityA'), cityB = $('cityB'), cityC = $('cityC'), cityN = $('cityN');
// 底部解说字幕（?nosub 关掉；虚构演示不显示：解说里的数字是真实研究的）
const SUBS = [];
if (NARR && !FICT && !Q.has('nosub')) SCENES.forEach((sc, i) => sc.n && sc.n.subs.forEach((x) => SUBS.push({ a: START[i] + LEAD + x.a - 0.08, b: START[i] + LEAD + x.b + 0.25, text: x.text })));
SUBS.forEach((x, i) => { if (SUBS[i + 1] && x.b > SUBS[i + 1].a) x.b = SUBS[i + 1].a; });
const subEl = document.createElement('div'); subEl.className = 'subline'; textEl.appendChild(subEl);
if (SUBS.length) document.body.classList.add('has-sub');
function updateSub() {
  const cur = SUBS.find((x) => T >= x.a && T < x.b);
  const txt = cur ? cur.text : '';
  if (subEl.dataset.t !== txt) { subEl.textContent = txt; subEl.dataset.t = txt; }
  const o = cur ? Math.min(1, (T - cur.a) / 0.12, (cur.b - T) / 0.12) : 0;
  subEl.style.opacity = o.toFixed(3);
}
function updateTexts(s, u) {
  TEXTS.forEach((t) => { const o = t.s === s ? win(u, t.a, t.b, 0.9, 0.8) : 0; t.el.style.opacity = o.toFixed(3); t.el.style.visibility = o > 0.001 ? 'visible' : 'hidden'; });
  if (s === S_STARS) {
    const n = Math.max(0, Math.min(QTEXT.length, Math.floor((u - 1.0) / 0.15)));
    const caret = u < STAR_AT && Math.floor(u * 2.2) % 2 === 0 ? '<span class="caret"></span>' : '';
    const bi = VERT ? QTEXT.indexOf('，') + 1 : 0;           // 竖屏在第一个逗号后换行
    const html = (bi > 0 && n > bi ? esc(QTEXT.slice(0, bi)) + '<br>' + esc(QTEXT.slice(bi, n)) : esc(QTEXT.slice(0, n))) + caret;
    if (qtype.dataset.h !== html) { qtype.innerHTML = html; qtype.dataset.h = html; }
  }
  if (s === S_MIX) mixline2.style.opacity = seg(u, WEEKS_AT, WEEKS_AT + 0.9).toFixed(3);
  if (s === S_PRICE) s6line2.style.opacity = seg(u, S6B_AT, S6B_AT + 0.9).toFixed(3);
  if (s === S_CITY) {
    cityA.style.opacity = seg(u, TOTAL_AT, TOTAL_AT + 0.5).toFixed(3);
    const nn = String(Math.round(CIMP.distinct * clamp((u - TOTAL_AT) / 0.8)));      // 数字跳出：0 → 49
    if (cityN.textContent !== nn) cityN.textContent = nn;
    cityB.style.opacity = seg(u, ONLY_AT - 0.2, ONLY_AT + 0.4).toFixed(3);
    if (cityC) cityC.style.opacity = seg(u, MAP_AT, MAP_AT + 0.6).toFixed(3);
  }
  updateSub();
}

/* ---------------------------------------------------------------- 3D 标签 */
const LABELS = [];
const vtmp = new THREE.Vector3();
function label(cls, html, scene_, anchor, opts = {}) {
  const el = document.createElement('div'); el.className = 'lab ' + cls; el.innerHTML = html; labelsEl.appendChild(el);
  const L = { el, s: scene_, anchor, op: opts.op || (() => 1), dx: opts.dx || 0, dy: opts.dy || 0, align: opts.align || 'c', up: !!opts.up, html: null, upd: opts.upd };
  LABELS.push(L); return L;
}
function updateLabels(s, u) {
  for (const L of LABELS) {
    let o = L.s === s ? L.op(u) : 0;
    if (o <= 0.002) { if (L.vis !== false) { L.el.style.opacity = 0; L.el.style.visibility = 'hidden'; L.vis = false; } continue; }
    const p = L.anchor(u);
    vtmp.set(p[0], p[1], p[2]).project(camera);
    if (vtmp.z > 1) { L.el.style.opacity = 0; continue; }
    const x = (vtmp.x * 0.5 + 0.5) * SW + L.dx * U, y = (-vtmp.y * 0.5 + 0.5) * SH + L.dy * U;
    if (L.upd) L.upd(u);
    const tx = L.align === 'c' ? '-50%' : (L.align === 'r' ? '-100%' : '0');
    L.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(${tx},${L.up ? '-100%' : '0'})`;
    L.el.style.opacity = o.toFixed(3); L.el.style.visibility = 'visible'; L.vis = true;
  }
}
const scFade = (s) => (u) => seg(u, 0.5, 1.4) * (1 - seg(u, SCENES[s].dur - 0.8, SCENES[s].dur - 0.05));
const ovAt = (sys, si) => sys.st.kind === '方法题' ? A(S_ORBIT, 'method', 5.2) - 0.2 : A(S_ORBIT, 'brandq', 2.9) - 0.2 + si * 0.35;   // "品牌题，答案很稳" / "怎么找稳定的供应商"
const platBandAt = (p) => { const v = PR.ai.map((b, i) => (b.p === p ? bandAt(i) : Infinity)); const m = Math.min(...v); return isFinite(m) ? m : A(S_PRICE, 'e1', 3.0) + p * 0.62; };
const ZERO_AT = A(S_MIX, 'zero', 4.75);
function buildLabels() {
  // 场景 1：平台名
  PN.forEach((p, i) => {
    const c = CL[i], below = true;
    label('lab-plat c', `<span class="dot" style="background:${PCSS[i]}"></span>${esc(p)}<small>${D.platforms[i].answers} 条回答 · ${D.platforms[i].citations} 条引用</small>`, 0,
      () => [c[0], c[1] + (below ? -CR - 0.4 : CR + 0.35), c[2]], { op: (u) => seg(u, STAR_AT + 0.5 + i * 0.35, STAR_AT + 1.4 + i * 0.35) * (1 - seg(u, D_STARS - 0.8, D_STARS)), dy: below ? 6 : -64 });
    const top = c[1] > 0, left = c[0] < 0;
    if (VERT) label('lab-plat c', `<span class="dot" style="background:${PCSS[i]}"></span>${esc(p)}`, 1,
      () => [c[0], c[1] + (top ? -CR * 0.9 - 0.2 : CR * 0.9 + 0.2), c[2]], { op: (u) => scFade(1)(u) * 0.85, dy: top ? 2 : -38 });
    else label('lab-plat', `<span class="dot" style="background:${PCSS[i]}"></span>${esc(p)}`, 1,
      () => [c[0] + (left ? CR + 0.3 : -CR - 0.3), c[1], c[2]], { op: (u) => scFade(1)(u) * 0.85, dy: -18, align: left ? 'l' : 'r' });
  });
  // 场景 2：来源节点
  CATS.forEach((name, c) => {
    const p = SIG.indexOf(c);
    if (p >= 0) {
      const g = D.sources.signatures[PN[p]];
      const sub = g.share_of_cat >= 0.999 ? `${g.own} 条 · 只出现在${PN[p]}的引用里` : `${g.own} / ${g.total} 条来自${PN[p]}`;
      const top = nodePos[c][1] > 0, side = !top && !VERT, right = nodePos[c][0] > 0;
      label('lab-sig ' + (side ? '' : 'c'), `${esc(name)}<small>${esc(PN[p])}引用的 ${pct(g.share_of_platform, 1)}<br>${esc(sub)}</small>`, 1, () => nodePos[c],
        { op: (u) => seg(u, sigLitAt(p) + 0.2, sigLitAt(p) + 1.1) * (1 - seg(u, D_SRC - 0.8, D_SRC - 0.05)), dy: top ? -118 : (side ? -50 : 28),
          dx: side ? (right ? 34 : -34) : 0, align: side ? (right ? 'l' : 'r') : 'c' });
    } else if (catTotal[c] >= 25 && !SIG.some((g) => Math.hypot(nodePos[g][0] - nodePos[c][0], nodePos[g][1] - nodePos[c][1]) < 3.6)) {
      const top = nodePos[c][1] > 0.5, side = !VERT && Math.abs(nodePos[c][1]) <= 0.5;
      label('lab-node c', `${esc(name)}`, 1, () => nodePos[c],
        { op: (u) => seg(u, 1.5 + c * 0.05, 2.5 + c * 0.05) * lerp(0.9, 0.55, seg(u, sigLitAt(0) - 0.6, sigLitAt(0) + 0.8)) * (1 - seg(u, D_SRC - 0.8, D_SRC - 0.05)), dy: top ? -34 : 16, dx: side ? (nodePos[c][0] > 0 ? 30 : -30) : 0, align: side ? (nodePos[c][0] > 0 ? 'l' : 'r') : 'c' });
    }
  });
  // 场景 3：品牌名 + 次数
  BR.forEach((b, i) => {
    const L = label('lab-brand c', '', 2, () => brands.attr.pos.slice(i * 3, i * 3 + 3),
      { op: (u) => { const t0 = 1.0 + i * 0.085; const k = morphK(u); return seg(u, t0, t0 + 1) * lerp(1, b.first === 0 ? 0.42 : 1, k) * (1 - seg(u, D_BRAND - 0.8, D_BRAND - 0.05)); } });
    L.upd = (u) => {
      const k = morphK(u);
      const v = k < 0.5 ? b.mentions : b.first;
      const hot = k < 0.5 ? (b.top5 && u > 2.1) : HOT_FIRST.includes(b.id);
      const sz = brands.attr.size[i] * U * (30 / Math.max(1, camera.position.distanceTo(vtmp.set(...bPos3[i]))));
      const html = `${esc(brandLabel(b))}<span class="n">${v}</span>`;
      if (L.html !== html) { L.el.innerHTML = html; L.html = html; }
      L.el.classList.toggle('hot', !!hot); L.el.classList.toggle('focus', !!b.focus);
      L.el.style.marginTop = (sz * 0.36 + 4 * U).toFixed(1) + 'px';
      L.el.style.setProperty('--fade', 1);
    };
  });
  if (FOCUS && FOCUS_I < 0 && FOCUS.zero) label('lab-brand c focus', `${esc(FOCUS.zero.label)}<span class="n">0</span><small>目标品牌 · 这个集合里一次都没被提到</small>`, 2, () => FZ_POS,
    { op: (u) => seg(u, 2.2, 3.2) * (1 - seg(u, D_BRAND - 0.8, D_BRAND - 0.05)), dy: 34 });
  // 场景 4：两个大数字
  const gl = VERT ? [0, gridOrigin[1] - GC * GS - 0.1, 0] : [gridOrigin[0] + GC * GS + 0.5, gridOrigin[1] - 1.1, 0];
  const n82 = label('lab-bignum', '', 3, () => gl, { op: (u) => seg(u, LIT0, LIT0 + 0.6) * (1 - seg(u, D_GRID - 0.8, D_GRID - 0.05)), align: VERT ? 'c' : 'l', dy: VERT ? 0 : -60 });
  n82.upd = (u) => {
    const lit = CO.covered.filter((a) => u > litAt(coverOrder.get(a)) + 0.05).length;
    const html = `${lit >= C.covered_answers ? pct(C.coverage) : lit + ''}<small><b>${lit} / ${C.branded_answers}</b> 条提到品牌的回答里，<br>至少有前五名中的一个</small>`;
    if (n82.html !== html) { n82.el.innerHTML = html; n82.html = html; }
  };
  const sl = VERT ? [0, stripOrigin[1] + 0.55, 0] : [stripOrigin[0], stripOrigin[1] + 0.6, 0];
  label('lab-bignum', `${pct(C.share)}<small>前五名的提及 <b>${C.top5_mentions}</b> 次，占全部 <b>${C.total_mentions}</b> 次提及</small>`, 3, () => sl,
    { op: (u) => seg(u, BOARD_AT, BOARD_AT + 0.8) * (1 - seg(u, D_GRID - 0.8, D_GRID - 0.05)), align: VERT ? 'c' : 'l', dy: VERT ? -270 : -250 });
  // 场景 5：题目与重合度
  SYS.forEach((sys, si) => {
    const anchor = () => [sys.c[0], sys.c[1] - sys.R * (VERT ? 0.35 : 0.5), sys.c[2] + sys.R * 1.05];
    const rows = PN.map((p, i) => `<td><span class="dot" style="background:${PCSS[i]}"></span>${esc(p)}</td>`).join('');
    const vals = sys.st.platforms.map((x) => `<td class="v">${x.overlap.toFixed(2)}</td>`).join('');
    label('lab-q c', `<span class="kind">${sys.st.kind}</span>${sys.q}<small>${esc(sys.st.question)}</small>`, 4, anchor,
      { op: (u) => seg(u, 1.4 + si * 0.3, 2.3 + si * 0.3) * (1 - seg(u, D_ORBIT - 0.85, D_ORBIT - 0.05)), dy: VERT ? -24 : 22 });
    label('lab-ov c', `${VERT ? '' : '三轮重合度'}<table><tr>${rows}</tr><tr>${vals}</tr></table><span class="mean">平均 ${sys.st.mean.toFixed(2)}</span>`, 4, anchor,
      { op: (u) => seg(u, ovAt(sys, si), ovAt(sys, si) + 0.9) * (1 - seg(u, D_ORBIT - 0.85, D_ORBIT - 0.05)), dy: VERT ? 34 : 92 });
  });
  // 场景 7：价格（元/立方米）
  const P5 = S_PRICE;
  [1000, 1500, 2000, 2500].forEach((v) => label('lab-axis c', fmt(v), P5, () => [px(v), REF_BOT - 0.2, 0], { op: (u) => seg(u, 0.9, 1.8) * scFade(P5)(u), dy: 10 }));
  label('lab-axis', '元/立方米', P5, () => [X1, REF_BOT - 0.2, 0], { op: (u) => seg(u, 0.9, 1.8) * scFade(P5)(u), dy: VERT ? 40 : 10, dx: VERT ? 0 : 20, align: VERT ? 'r' : 'l' });
  PR.ref.forEach((r, i) => {
    const x = r.open ? (px(r.lo) + px(PMAX)) / 2 : (px(r.lo) + px(r.hi)) / 2;
    const range = r.open ? `${fmt(r.lo)} 以上` : `${fmt(r.lo)}—${fmt(r.hi)}`;
    const sheet = r.open ? `约 ${r.lo_sheet} 元/张以上` : `约 ${r.lo_sheet}—${r.hi_sheet} 元/张`;
    // 竖屏里前两条带太窄：第一条的标签右对齐到 1,000，第二条左对齐从 1,000 开始，避免重叠
    const side = VERT && !r.open ? (i === 0 ? 'r' : 'l') : 'c';
    const ax = side === 'r' ? px(r.hi) : side === 'l' ? px(r.lo) : x;
    label('lab-refh c', `<b>${range}</b><br>${esc(r.label)}${r.sub ? `<br><i>（${esc(r.sub)}）</i>` : ''}<small>${sheet}</small>`, P5, () => [ax, REF_TOP, 0],
      { op: (u) => seg(u, REF_AT + 0.4 + i * 0.35, REF_AT + 1.3 + i * 0.35) * scFade(P5)(u), dy: VERT ? -12 : -14, up: true, align: side, dx: side === 'r' ? -10 : side === 'l' ? 10 : 0 });
  });
  { const P0 = PR.ref_point, t0 = REF_AT + 0.4 + PR.ref.length * 0.35;
    label('lab-point', `<b>${P0.approx ? '约 ' : ''}${fmt(P0.at)}</b> ${esc(P0.label)}<small>约 ${P0.sheet} 元/张</small>`, P5,
      () => [px(P0.at), VERT ? rowY(2) - 1.3 : rowY(2) - 0.8, 0], { op: (u) => seg(u, t0, t0 + 0.9) * scFade(P5)(u), align: 'r', dx: -14, dy: -20 }); }
  label('lab-src', '金色竖带：' + esc(PR.ref_source) + '　·　彩色光带：AI 原话，按 4×8 尺折成元/立方米', P5, () => [X0, REF_BOT - 0.2, 0], { op: (u) => seg(u, 2.0, 3.0) * scFade(P5)(u), dy: VERT ? 40 : 48, align: 'l' });
  PN.forEach((p, i) => label('lab-pname', `<span class="dot" style="background:${PCSS[i]}"></span>${esc(p)}`, P5,
    () => VERT ? [X0, rowY(i) + 0.95, 0] : [X0 - 0.5, rowY(i), 0],
    { op: (u) => seg(u, platBandAt(i) - 0.4, platBandAt(i) + 0.4) * scFade(P5)(u), align: VERT ? 'l' : 'r', dy: -16 }));
  PR.ai.forEach((b, i) => {
    const flip = b.hi_m3 > 2050 && !b.outdated;          // 光带伸到右侧时，标签放到光带左边，避免出画
    label('lab-band' + (flip ? ' flip' : ''), `${esc(b.label)}<span class="n">≈${b.lo === b.hi ? fmt(b.lo_m3_r) : fmt(b.lo_m3_r) + '—' + fmt(b.hi_m3_r)}</span><small>原话 ${b.lo === b.hi ? '约 ' + b.lo : b.lo + '—' + b.hi} 元/张</small>`, P5,
      () => [flip ? px(b.lo_m3) : px(b.hi_m3), bandY(i), 0], { op: (u) => seg(u, bandAt(i) + 1.0, bandAt(i) + 1.8) * scFade(P5)(u), align: flip ? 'r' : 'l', dx: flip ? -14 : 14, dy: -13 });
    if (b.outdated) label('lab-tag', '过时口径', P5, () => [px(b.lo_m3), bandY(i), 0],
      { op: (u) => seg(u, bandAt(i) + 1.6, bandAt(i) + 2.3) * scFade(P5)(u), align: 'r', dx: -12, dy: -12 });
  });
  // 场景 8：MIX
  label('lab-mix c', esc(MX.target), S_MIX, () => MIX_POS, { op: (u) => seg(u, MIX_AT + 0.6, MIX_AT + 1.5), dy: 40 });
  label('lab-mixnum c', `<span class="n">${MX.generic_mentions ?? '待判定'} / ${MX.generic}</span>泛问题里，被 AI 主动提到<br><span class="n">${MX.recognized ?? '待判定'} / ${MX.named}</span>直接点名问，被 AI 认出`, S_MIX, () => MIX_POS,
    { op: (u) => seg(u, ZERO_AT - 0.3, ZERO_AT + 0.6), dy: 98 });
  // 场景 6：城市名、各平台报了几家、被多个平台同时报到的商家（只显示"商家 N"，不显示真名）
  const cf = (u) => cityOn(u);
  CITIES.forEach((c, ci) => {
    const anchor = VERT ? [-8.5, CITY_C[ci][1], 0] : [CITY_C[ci][0], CITY_C[ci][1] - CITY_R * 0.78 + 0.3, 0];
    label('lab-city' + (VERT ? '' : ' c'), `${esc(c.name)}<small>${esc(c.note)}</small>`, S_CITY, () => anchor, { op: (u) => seg(u, 0.8 + ci * 0.3, 1.8 + ci * 0.3) * cf(u), align: VERT ? 'l' : 'c', dy: VERT ? -30 : 6 });
    PN.forEach((p, pi) => {
      const st = c.platforms[pi], at = BEAM_AT(ci, pi) + TRV;
      const pos = VERT ? [EMIT[pi][0], EMIT[pi][1], 0] : [EMIT[pi][0] + (ci === 0 ? -0.75 : 0.75), EMIT[pi][1], 0];
      label('lab-cnt' + (VERT ? ' c' : ''), `<b>${st.total}</b><small>${st.stores} 门店·工厂${st.markets ? ` + ${st.markets} 市场` : ''}</small>`, S_CITY, () => pos,
        { op: (u) => seg(u, at, at + 0.6) * cf(u) * (1 - 0.55 * mapK(u) * (pi === QW ? 0 : 1)), align: VERT ? 'c' : (ci === 0 ? 'r' : 'l'), dy: VERT ? (ci === 0 ? -86 : 50) : -20 });
    });
  });
  PN.forEach((p, pi) => label('lab-emit c', `<span class="dot" style="background:${PCSS[pi]}"></span>${esc(p)}`, S_CITY, () => EMIT[pi],
    { op: (u) => seg(u, 0.8 + pi * 0.15, 1.6 + pi * 0.15) * cf(u), dy: VERT ? 16 : -46 }));
  ENTS.forEach((x) => {
    if (x.k < 2 || (x.ci > 0 && x.k < 3)) return;          // 第二座城市只标被 3 家以上报到的，免得挤
    label('lab-ent c', esc(x.e.label), S_CITY, () => entPos(x, SHARED_AT + 2), { op: (u) => seg(u, SHARED_AT + 0.3, SHARED_AT + 1.1) * cf(u) * (x.ci === 0 ? 1 : 0.8), dy: 10 });
  });
}

/* ---------------------------------------------------------------- 声音：默认静音。"朗读"= 浏览器自带语音念英文解说；"音乐"= 程序生成的底乐和音效（js/audio.js） */
const SPEECH = [];
SCENES.forEach((sc, i) => sc.n && sc.n.subs.forEach((x) => SPEECH.push({ a: START[i] + LEAD + x.a, b: START[i] + LEAD + x.b })));
for (let i = SPEECH.length - 1; i > 0; i--) if (SPEECH[i].a - SPEECH[i - 1].b < 0.8) { SPEECH[i - 1].b = SPEECH[i].b; SPEECH.splice(i, 1); }
const PLAN = {
  total: TOTAL, starts: START.slice(), speech: SPEECH,
  narr: SCENES.map((sc, i) => sc.n ? { t: START[i] + LEAD, key: sc.key } : null).filter(Boolean),
  events: [
    ...START.slice(1).map((t) => ({ t: t - 0.35, type: 'whoosh' })),                       // 场景切换
    { t: START[S_STARS] + BIG1_AT + 0.3, type: 'ping' },                                   // 一共 120 次
    { t: START[S_GRID] + PCT_AT, type: 'ping' },                                           // 82%
    { t: START[S_CITY] + TOTAL_AT + 0.1, type: 'ping' },                                   // 49 个不同的名字
    { t: START[S_CITY] + ONLY_AT + 0.1, type: 'ping' },                                    // 只有 10 个
    ...(LOC.map_lead ? [{ t: START[S_CITY] + MAP_AT + 0.1, type: 'ping' }] : []),          // 地图与点评 58
    { t: START[S_MIX] + MIX_AT, type: 'drone' },                                           // MIX 暗星
  ].sort((a, b) => a.t - b.t),
};
window.__audioPlan = PLAN;
// 截图用：每个场景一个代表时刻（关键数字都已出现）
window.__shotAt = [START[S_STARS] + BIG1_AT + 1.6, START[S_SOURCE] + D_SRC - 1.4, START[S_BRAND] + D_BRAND - 1.2, START[S_GRID] + D_GRID - 1.0,
  START[S_ORBIT] + D_ORBIT - 1.2, START[S_CITY] + MAP_AT + 1.3, START[S_PRICE] + D_PRICE - 1.0, TOTAL - 0.6];
window.__shotAtCityEnd = START[S_CITY] + D_CITY - 1.0;
let snd = null, sndOn = false;
async function musicOn() {                                   // 用户点了才创建声音，不需要绕过浏览器的自动播放限制
  if (!snd) { snd = window.CLAUDE_AUDIO.create(PLAN, { voice: false, music: true, sfx: true }); if (!snd) return false; }
  await snd.ready; await snd.unlock(); if (!snd.running) return false;
  if (!paused && running) { snd.play(T); sndOn = true; }
  return true;
}
function musicOff() { if (snd) snd.stop(); if (sndOn) { tOffset = T; t0 = performance.now(); } sndOn = false; }
// 朗读：每句字幕开始时，用浏览器自带语音念对应的英文（优先 Andrew）
const VOICE = (NARR && NARR.voice) || { prefer: ['Andrew'], rate: 0.9 };
const LINES = [];
SCENES.forEach((sc, i) => sc.n && sc.n.subs.forEach((x) => x.en && LINES.push({ t: START[i] + LEAD + x.a, en: x.en })));
const synth = window.speechSynthesis || null;
let reading = false, lineIdx = 0, voiceObj = null;
function pickVoice() {
  if (!synth) return null;
  const vs = synth.getVoices().filter((v) => /^en([-_]|$)/i.test(v.lang));
  for (const p of VOICE.prefer || []) { const v = vs.find((x) => x.name.toLowerCase().includes(p.toLowerCase())); if (v) return v; }
  return vs.find((v) => /en-US/i.test(v.lang)) || vs[0] || null;
}
if (synth) { synth.getVoices(); if (synth.addEventListener) synth.addEventListener('voiceschanged', () => { voiceObj = pickVoice(); }); }
function syncLines() { lineIdx = LINES.findIndex((l) => l.t >= T - 0.05); if (lineIdx < 0) lineIdx = LINES.length; if (synth) synth.cancel(); }
function speakDue() {
  if (!reading || !synth || paused) return;
  while (lineIdx < LINES.length && LINES[lineIdx].t <= T) {
    const l = LINES[lineIdx++]; if (T - l.t > 1.5) continue;           // 跳转后不补念过去的句子
    if (synth.speaking) synth.cancel();                                // 不让朗读越积越多、和画面错开
    const u = new SpeechSynthesisUtterance(l.en); voiceObj = voiceObj || pickVoice();
    if (voiceObj) u.voice = voiceObj; u.lang = voiceObj ? voiceObj.lang : 'en-US'; u.rate = VOICE.rate || 0.9;
    synth.speak(u);
  }
}

/* ---------------------------------------------------------------- 界面 */
let paused = false, tOffset = 0, t0 = null, frozenAt = null, T = 0, endedAt = null;
function sceneAt(t) { let s = 0; for (let i = 0; i < SCENES.length; i++) if (t >= START[i]) s = i; return s; }
function jump(s) {
  s = clamp(s, 0, SCENES.length - 1); tOffset = START[s] + 0.001; t0 = performance.now(); endedAt = null;
  if (paused) frozenAt = tOffset; else if (sndOn) snd.play(tOffset);
  T = tOffset; syncLines();
}
let endBtn = null;
function buildUI() {
  if (SHOWFPS) { const f = document.createElement('div'); f.className = 'fps'; f.id = 'fps'; uiEl.appendChild(f); }
  // 全片结束后淡入"查看完整报告"（录屏的 90 秒画面里不会出现，结束 1 秒后才出来）
  endBtn = document.createElement('button'); endBtn.className = 'to-report'; endBtn.innerHTML = '查看完整报告<span>12 页 + 体检入口 · →</span>';
  endBtn.onclick = () => APP.showReport(); uiEl.appendChild(endBtn);
  if (AUTO) return;
  const nav = document.createElement('div'); nav.className = 'nav';
  const prev = document.createElement('button'); prev.textContent = '‹'; prev.onclick = () => jump(sceneAt(T) - 1);
  nav.appendChild(prev);
  SCENES.forEach((sc, i) => { const b = document.createElement('button'); b.textContent = String(i + 1); b.title = sc.title; b.onclick = () => jump(i); b.dataset.i = i; nav.appendChild(b); });
  const next = document.createElement('button'); next.textContent = '›'; next.onclick = () => jump(sceneAt(T) + 1); nav.appendChild(next);
  const pp = document.createElement('button'); pp.id = 'pp'; pp.textContent = '暂停'; pp.onclick = togglePause; nav.appendChild(pp);
  if (synth && LINES.length) { const rb = document.createElement('button'); rb.id = 'read'; rb.textContent = '朗读'; rb.title = '用浏览器自带的语音念英文解说（字幕是中文）';
    rb.onclick = () => { reading = !reading; rb.classList.toggle('on', reading); syncLines(); }; nav.appendChild(rb); }
  if (window.CLAUDE_AUDIO) { const mb = document.createElement('button'); mb.id = 'music'; mb.textContent = '音乐'; mb.title = '程序生成的底乐和音效';
    mb.onclick = async () => { if (sndOn) { musicOff(); mb.classList.remove('on'); } else if (await musicOn()) mb.classList.add('on'); }; nav.appendChild(mb); }
  const rep = document.createElement('button'); rep.className = 'nav-report'; rep.textContent = '完整报告 →'; rep.onclick = () => APP.showReport(); nav.appendChild(rep);
  uiEl.appendChild(nav);
  const bar = document.createElement('div'); bar.className = 'bar'; bar.id = 'bar'; uiEl.appendChild(bar);
  window.addEventListener('keydown', (e) => {
    if (!running) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { if (sceneAt(T) === SCENES.length - 1 && endedAt !== null) APP.showReport(); else jump(sceneAt(T) + 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') jump(sceneAt(T) - 1);
    else if (e.key === ' ') { togglePause(); e.preventDefault(); }
    else if (/^[1-8]$/.test(e.key)) jump(+e.key - 1);
  });
}
function togglePause() {
  if (paused) { paused = false; tOffset = frozenAt; t0 = performance.now(); if (sndOn) snd.play(frozenAt); syncLines(); }
  else { paused = true; frozenAt = T; if (sndOn) snd.stop(); if (synth) synth.cancel(); }
  const b = document.getElementById('pp'); if (b) b.textContent = paused ? '播放' : '暂停'; }

/* ---------------------------------------------------------------- 主循环 */
let fpsN = 0, fpsT = 0, lastNow = null;
const fpsStats = SCENES.map(() => ({ frames: 0, ms: 0, slow: 0, worst: 0 }));      // 每个场景的帧时间（供 README 帧率记录）
window.__fpsStats = fpsStats;
function frame(now) {
  if (!running) return;
  if (t0 === null) t0 = now;
  let raw;
  if (AT !== null) { T = Math.min(AT, TOTAL - 0.001); raw = AT; }
  else if (paused) { T = frozenAt; raw = T; }
  else if (sndOn) { raw = Math.max(0, snd.now()); T = Math.min(TOTAL - 0.001, raw); }      // 有声音时，画面跟着声卡时钟走（音画不漂移）
  else { raw = tOffset + (now - t0) / 1000; T = Math.min(TOTAL - 0.001, raw); }
  if (raw >= TOTAL && endedAt === null) endedAt = AT !== null ? now - (raw - TOTAL) * 1000 : now;
  const s = sceneAt(T), u = T - START[s];
  for (const g of GROUPS) g.update(s, u);
  updateLines(s, u); updateRects(s, u); updateBeamLines(s, u); updateCamera(s, u);
  camera.updateMatrixWorld();
  updateTexts(s, u); updateLabels(s, u); speakDue();
  film.uniforms.uT.value = T;
  // 开场从黑场淡入
  stage.style.opacity = (AT === null && T < 0.8 && s === 0) ? seg(T, 0, 0.8).toFixed(3) : '1';
  composer.render();
  const eo = endedAt === null ? 0 : seg((now - endedAt) / 1000, 1.0, 2.2);
  endBtn.style.opacity = eo.toFixed(3); endBtn.style.visibility = eo > 0.01 ? 'visible' : 'hidden';
  const bar = document.getElementById('bar'); if (bar) bar.style.width = (T / TOTAL * 100).toFixed(2) + '%';
  document.querySelectorAll('#ui .nav button[data-i]').forEach((b) => b.classList.toggle('on', +b.dataset.i === s));
  if (lastNow !== null && AT === null && !paused && raw < TOTAL) { const dt = now - lastNow, f = fpsStats[s]; f.frames++; f.ms += dt; if (dt > 20) f.slow++; if (dt > f.worst) f.worst = dt; }
  lastNow = now;
  if (SHOWFPS) { fpsN++; if (now - fpsT > 500) { document.getElementById('fps').textContent = (fpsN * 1000 / (now - fpsT)).toFixed(0) + ' fps · ' + T.toFixed(1) + 's · 场景 ' + (s + 1); fpsN = 0; fpsT = now; } }
  window.__geo = { T, s, u, ready: true, ended: endedAt !== null };
  if (AT === null) rafId = requestAnimationFrame(frame);
  else if (endedAt !== null && eo < 1) rafId = requestAnimationFrame(frame);     // ?at 定格在片尾时，让按钮淡入完成
}

function start() {
  resize(); setupComposer(); resize();
  buildLabels(); buildUI();
  window.addEventListener('resize', () => { if (running) resize(); });
  tOffset = START[START_SCENE];
}
start();
// 供截图和检查用：扫描画面文字里是否出现给定的名字（品牌原名、测试人住址等）
window.__leakCheck = function (names) {
  const txt = stage.innerText;
  return { checked: true, leaks: (names || []).filter((n) => n && n.length >= 2 && txt.includes(n)) };
};
return {
  run(fromScene) {
    running = true; resize();
    if (fromScene != null) { tOffset = START[clamp(fromScene, 0, SCENES.length - 1)]; }
    t0 = null; endedAt = null; lastNow = null; paused = false; frozenAt = null;
    const pp = document.getElementById('pp'); if (pp) pp.textContent = '暂停';
    const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    cancelAnimationFrame(rafId);
    if (AT !== null) { fontsReady.then(() => { rafId = requestAnimationFrame(frame); requestAnimationFrame(() => requestAnimationFrame(frame)); }); return; }
    const go = () => { if (!running) return; T = tOffset; syncLines(); if (sndOn) snd.play(tOffset); t0 = null; rafId = requestAnimationFrame(frame); };
    fontsReady.then(() => setTimeout(go, AUTO ? 400 : 0));
  },
  stop() { running = false; cancelAnimationFrame(rafId); if (snd) snd.stop(); if (synth) synth.cancel(); },
  get T() { return T; }, TOTAL, START,
};
}
let api = null;
return {
  show(fromScene) { if (!inited) api = init(); api.run(fromScene); },
  hide() { if (api) api.stop(); },
  get data() { return window.__filmData; },
};
})();
