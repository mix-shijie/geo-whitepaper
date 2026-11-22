/* AI 眼中的你 · 公开版 · 背景音乐和音效（MIX饰界智变 · 2026-11-21）
   音乐和音效全部在页面里用 Web Audio 程序生成，没有任何外部音频素材。公开版不带任何配音文件。
   每个场景一个和弦，场景之间缓慢交叉；音效：场景切换的扫过音、数字出现的提示音、MIX 暗星的低沉长音。
   随机数一律用固定种子，每次播放相同。 */
window.CLAUDE_AUDIO = (function () {
'use strict';
const SR = 48000;
const AC = window.AudioContext || window.webkitAudioContext;
const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

// 每个场景的和弦（MIDI 音高）：D 调式里缓慢游走，最后回到暗的 D 小三和弦
const CHORDS = [
  [38, 45, 50, 52, 57],      // 1 开场      D  sus2
  [34, 41, 46, 50, 53],      // 2 来源      B♭ add9
  [41, 48, 53, 55, 57],      // 3 品牌星座  F  add9
  [36, 43, 48, 50, 55],      // 4 前五名    C  sus2
  [43, 50, 55, 57, 59],      // 5 问三遍    G  add9（稍亮，"门还开着"）
  [45, 52, 57, 59, 61],      // 6 在你的城市 A  add9
  [34, 41, 46, 48, 53],      // 7 价格      B♭ sus2
  [38, 45, 50, 53, 57],      // 8 零点      D  小三
];
const CUTOFF = [700, 900, 950, 820, 1050, 1150, 800, 520];

function noiseBuffer(ctx, sec, seed) {
  const b = ctx.createBuffer(2, Math.floor(sec * ctx.sampleRate), ctx.sampleRate), r = rng(seed);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1; }
  return b;
}
function impulse(ctx, sec, seed) {
  const b = ctx.createBuffer(2, Math.floor(sec * ctx.sampleRate), ctx.sampleRate), r = rng(seed);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < d.length; i++) { const t = i / ctx.sampleRate; d[i] = (r() * 2 - 1) * Math.pow(1 - t / sec, 2.2) * Math.exp(-t * 1.1); } }
  return b;
}
function b64ToArrayBuffer(s) { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; }

/* 排程：把 plan（film 时间轴）里从 from 秒开始的所有声音排到 ctx 上。base = film 时间 0 对应的 ctx 时间。
   plan = { total, starts:[], speech:[{a,b}], narr:[{t, key}], events:[{t, type}] } */
function schedule(ctx, dest, plan, from, base, opt, bufs) {
  const nodes = [];
  const T = (t) => base + t;                                  // film 时间 → ctx 时间
  const keep = (n) => { nodes.push(n); return n; };
  const at = (t) => Math.max(ctx.currentTime, T(t));
  // 公共混响（音乐和音效共用）
  const verb = keep(ctx.createConvolver()); verb.buffer = bufs.ir;
  const verbOut = keep(ctx.createGain()); verbOut.gain.value = 0.9; verb.connect(verbOut); verbOut.connect(dest);

  /* ---------------- 音乐 ---------------- */
  if (opt.music) {
    const bus = keep(ctx.createGain()); bus.gain.value = 1;
    const duck = keep(ctx.createGain());
    const master = keep(ctx.createGain());
    const lp = keep(ctx.createBiquadFilter()); lp.type = 'lowpass'; lp.Q.value = 0.4;
    bus.connect(lp); lp.connect(duck); duck.connect(master); master.connect(dest);
    const send = keep(ctx.createGain()); send.gain.value = 0.55; master.connect(send); send.connect(verb);
    // 全片音量：开头 3 秒淡入，结尾 3 秒淡出
    const LV = 0.12;                 // 老高 11/19：不再压低，全程同一音量；约比解说低 8 dB（原来解说时被压到约 -38 dB，现在约 -30 dB）
    master.gain.setValueAtTime(from < 3 ? LV * from / 3 : LV, at(from));
    if (from < 3) master.gain.linearRampToValueAtTime(LV, T(3));
    master.gain.setValueAtTime(LV, Math.max(at(from), T(plan.total - 3.2)));
    master.gain.linearRampToValueAtTime(0.0001, T(plan.total + 0.6));
    // 滤波：每个场景的明暗 + 极慢的呼吸
    const lfo = keep(ctx.createOscillator()); lfo.frequency.value = 0.045; const lfoG = keep(ctx.createGain()); lfoG.gain.value = 160;
    lfo.connect(lfoG); lfoG.connect(lp.frequency); lfo.start(at(from)); lfo.stop(T(plan.total + 2));
    plan.starts.forEach((s, i) => {
      if (i === 0 || s + 2 < from) { if (s <= from) lp.frequency.setValueAtTime(CUTOFF[i], at(from)); return; }
      lp.frequency.setValueAtTime(CUTOFF[i - 1], at(s - 1)); lp.frequency.linearRampToValueAtTime(CUTOFF[i], T(s + 2));
    });
    // 解说时压低：老高 11/19 定为不压（DK = 1），底乐音量全程不变
    const DK = 1.0, inSpeech = (t) => plan.speech.some((w) => t >= w.a && t <= w.b);
    duck.gain.setValueAtTime(inSpeech(from) ? DK : 1, at(from));
    if (opt.voice) for (const w of plan.speech) {
      if (w.b < from) continue;
      if (w.a > from) { duck.gain.setValueAtTime(1, T(w.a - 0.35)); duck.gain.linearRampToValueAtTime(DK, T(w.a)); }
      duck.gain.setValueAtTime(DK, T(w.b)); duck.gain.linearRampToValueAtTime(1, T(w.b + 0.9));
    } else duck.gain.setValueAtTime(1, at(from));
    // 和弦铺底：每个场景一组，前后各 2.5 秒交叉
    const r = rng(77);
    plan.starts.forEach((s, i) => {
      const e = i + 1 < plan.starts.length ? plan.starts[i + 1] : plan.total + 1;
      if (e + 2.5 < from) return;
      const a0 = s - (i ? 2.5 : 0), a1 = s + (i ? 2.5 : 3), b0 = e - 2.5, b1 = e + 2.5;
      CHORDS[i].forEach((m, k) => {
        const g = keep(ctx.createGain());
        const lvl = (k === 0 ? 0.30 : k >= 3 ? 0.10 : 0.16);
        // 包络是 film 时间的函数；从中途开始时直接算出当前值
        const env = (t) => t < a0 ? 0 : t < a1 ? (t - a0) / (a1 - a0) : t < b0 ? 1 : t < b1 ? 1 - (t - b0) / (b1 - b0) : 0;
        g.gain.setValueAtTime(lvl * env(Math.max(from, a0)), at(Math.max(from, a0)));
        if (from < a1) g.gain.linearRampToValueAtTime(lvl, T(a1));
        g.gain.setValueAtTime(lvl * env(Math.max(from, b0)), Math.max(at(from), T(b0)));
        g.gain.linearRampToValueAtTime(0, T(b1));
        g.connect(bus);
        for (const [type, det, w] of [['sine', 0, 1], ['triangle', 4 + r() * 3, 0.35]]) {
          const o = keep(ctx.createOscillator()); o.type = type; o.frequency.value = hz(m); o.detune.value = det;
          const og = keep(ctx.createGain()); og.gain.value = w;
          // 每个音各自很慢地起伏，避免"电子琴"感
          const tr = keep(ctx.createOscillator()); tr.frequency.value = 0.06 + r() * 0.08; const trg = keep(ctx.createGain()); trg.gain.value = 0.25 * w;
          tr.connect(trg); trg.connect(og.gain);
          o.connect(og); og.connect(g);
          o.start(at(Math.max(from, a0))); o.stop(T(b1 + 0.1)); tr.start(at(Math.max(from, a0))); tr.stop(T(b1 + 0.1));
        }
      });
      // 高处一点"星光"：和弦五音的两个八度以上，极轻
      const sh = keep(ctx.createOscillator()); sh.type = 'sine'; sh.frequency.value = hz(CHORDS[i][2] + 24);
      const shg = keep(ctx.createGain()); shg.gain.value = 0;
      const t0 = Math.max(from, s + 1.5), t1 = Math.max(t0 + 0.1, e - 1);
      shg.gain.setValueAtTime(0, at(t0)); shg.gain.linearRampToValueAtTime(0.012, T((t0 + t1) / 2)); shg.gain.linearRampToValueAtTime(0, T(t1));
      sh.connect(shg); shg.connect(send); sh.start(at(t0)); sh.stop(T(t1 + 0.1));
    });
  }

  /* ---------------- 音效 ---------------- */
  if (opt.sfx) {
    const fx = keep(ctx.createGain()); fx.gain.value = 1; fx.connect(dest);
    const fxSend = keep(ctx.createGain()); fxSend.gain.value = 0.6; fx.connect(fxSend); fxSend.connect(verb);
    plan.events.forEach((ev, n) => {
      if (ev.t < from - 0.05) return;
      const t = ev.t;
      if (ev.type === 'whoosh') {           // 带通噪声，频率由低到高再回落，左右轻轻扫过
        const src = keep(ctx.createBufferSource()); src.buffer = bufs.noise; src.loop = true;
        const bp = keep(ctx.createBiquadFilter()); bp.type = 'bandpass'; bp.Q.value = 0.9;
        bp.frequency.setValueAtTime(260, T(t)); bp.frequency.exponentialRampToValueAtTime(2200, T(t + 0.75)); bp.frequency.exponentialRampToValueAtTime(500, T(t + 1.7));
        const g = keep(ctx.createGain()); g.gain.setValueAtTime(0.0001, T(t)); g.gain.exponentialRampToValueAtTime(0.075, T(t + 0.6)); g.gain.exponentialRampToValueAtTime(0.0001, T(t + 1.8));
        const pan = ctx.createStereoPanner ? keep(ctx.createStereoPanner()) : null;
        src.connect(bp); bp.connect(g);
        if (pan) { pan.pan.setValueAtTime(n % 2 ? 0.5 : -0.5, T(t)); pan.pan.linearRampToValueAtTime(n % 2 ? -0.5 : 0.5, T(t + 1.8)); g.connect(pan); pan.connect(fx); } else g.connect(fx);
        src.start(T(t), (n * 0.37) % 2); src.stop(T(t + 1.9));
      } else if (ev.type === 'ping') {      // 很轻的提示音：E6 正弦 + 一点泛音，快起慢落
        [[hz(88), 1], [hz(100), 0.22], [hz(95), 0.12]].forEach(([f, w]) => {
          const o = keep(ctx.createOscillator()); o.type = 'sine'; o.frequency.value = f;
          const g = keep(ctx.createGain()); g.gain.setValueAtTime(0.0001, T(t)); g.gain.exponentialRampToValueAtTime(0.034 * w, T(t + 0.012)); g.gain.exponentialRampToValueAtTime(0.0001, T(t + 1.1));
          o.connect(g); g.connect(fx); o.start(T(t)); o.stop(T(t + 1.2));
        });
      } else if (ev.type === 'drone') {     // MIX 暗星：低沉的长音，两个略微失谐的音产生缓慢拍频
        const lp = keep(ctx.createBiquadFilter()); lp.type = 'lowpass'; lp.frequency.value = 420;
        const g = keep(ctx.createGain()); g.gain.setValueAtTime(0.0001, T(t)); g.gain.linearRampToValueAtTime(0.03, T(t + 1.8)); g.gain.setValueAtTime(0.03, T(t + 4.2)); g.gain.linearRampToValueAtTime(0.0001, T(t + 8.5));
        lp.connect(g); g.connect(fx);
        [[hz(38), 0, 1], [hz(38), 6, 0.8], [hz(26), 0, 0.5], [hz(45), 0, 0.25]].forEach(([f, det, w]) => {
          const o = keep(ctx.createOscillator()); o.type = 'sine'; o.frequency.value = f; o.detune.value = det;
          const og = keep(ctx.createGain()); og.gain.value = w; o.connect(og); og.connect(lp); o.start(T(t)); o.stop(T(t + 8.6));
        });
      }
    });
  }

  /* ---------------- 解说 ---------------- */
  if (opt.voice && bufs.narr) {
    const vg = keep(ctx.createGain()); vg.gain.value = 1.0; vg.connect(dest);
    plan.narr.forEach((n) => {
      const buf = bufs.narr[n.key]; if (!buf) return;
      const end = n.t + buf.duration; if (end <= from) return;
      const src = keep(ctx.createBufferSource()); src.buffer = buf; src.connect(vg);
      if (n.t >= from) src.start(T(n.t)); else src.start(at(from), from - n.t);
    });
  }
  return nodes;
}

async function loadBuffers(ctx, withVoice) {
  const bufs = { noise: noiseBuffer(ctx, 3, 4242), ir: impulse(ctx, 3.4, 99), narr: null };
  const N = window.CLAUDE_NARRATION;
  if (withVoice && N) {
    bufs.narr = {};
    for (const s of N.scenes) bufs.narr[s.key] = await ctx.decodeAudioData(b64ToArrayBuffer(s.b64));
  }
  return bufs;
}

/* ---------------- 实时播放 ---------------- */
function create(plan, opt) {
  if (!AC || !(opt.voice || opt.music || opt.sfx)) return null;
  const ctx = new AC({ latencyHint: 'playback', sampleRate: SR });
  const out = ctx.createGain(); out.gain.value = 1; out.connect(ctx.destination);
  let bufs = null, nodes = [], base = 0, playing = false;
  const ready = loadBuffers(ctx, opt.voice).then((b) => { bufs = b; });
  function stopNodes() { for (const n of nodes) { try { if (n.stop) n.stop(); } catch (e) { /* 已停止 */ } try { n.disconnect(); } catch (e) { /* 忽略 */ } } nodes = []; }
  return {
    ctx, ready,
    get running() { return ctx.state === 'running'; },
    async unlock() { try { await ctx.resume(); } catch (e) { /* 浏览器不允许自动播放 */ } return ctx.state === 'running'; },
    play(from) {                                // 从 film 时间 from 开始
      if (!bufs) return false;
      stopNodes(); base = ctx.currentTime + 0.06 - from;
      nodes = schedule(ctx, out, plan, from, base, opt, bufs); playing = true; return true;
    },
    now() { return ctx.currentTime - base; },   // 当前 film 时间（以声卡时钟为准，画面跟着声音走）
    get playing() { return playing; },
    pause() { ctx.suspend(); }, resume() { return ctx.resume(); },
    stop() { stopNodes(); playing = false; },
    setMuted(m) { out.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.05); },
  };
}

/* ---------------- 导出分轨（OfflineAudioContext） ---------------- */
function wav(buf) {
  const ch = buf.numberOfChannels, n = buf.length, data = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const w = (o, s) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); data.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt '); data.setUint32(16, 16, true); data.setUint16(20, 1, true);
  data.setUint16(22, ch, true); data.setUint32(24, buf.sampleRate, true); data.setUint32(28, buf.sampleRate * ch * 2, true); data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true);
  w(36, 'data'); data.setUint32(40, n * ch * 2, true);
  const cs = []; for (let c = 0; c < ch; c++) cs.push(buf.getChannelData(c));
  let o = 44, peak = 0;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, cs[c][i])); peak = Math.max(peak, Math.abs(v)); data.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7FFF, true); o += 2; }
  return { bytes: new Uint8Array(data.buffer), peak };
}
async function renderStem(plan, kind) {
  const len = Math.ceil((plan.total + 0.5) * SR);
  const ctx = new OAC(2, len, SR);
  const opt = { voice: kind === 'voice', music: kind === 'music', sfx: kind === 'sfx' };
  const bufs = await loadBuffers(ctx, opt.voice);
  // 音乐分轨里保留"解说时压低"（和页面里听到的一致）：排程时打开 voice 让压低生效，但不放解说音频
  if (kind === 'music') { opt.voice = true; bufs.narr = null; }
  schedule(ctx, ctx.destination, plan, 0, 0, opt, bufs);
  const out = await ctx.startRendering();
  return wav(out);
}
function toB64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }

return { create, schedule, renderStem, toB64, CHORDS };
})();
