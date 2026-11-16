/* =====================================================================
   콜로니 2126 · 게임 엔진 (game.js)
   - 글자·문항은 data.js에 있습니다. 이 파일은 움직임과 그리기를 맡습니다.
   - 그림(img/)과 사진(photos/)이 없어도 코드로 그린 화면으로 돌아갑니다.
   ===================================================================== */
(function () {
'use strict';

const D = window.COLONY_DATA;
const W = 1280, H = 720, TAU = Math.PI * 2;
// 글꼴(fonts/fonts.js): 제목·버튼 = 학교안심 별자리, 본문·자막 = 학교안심 보드마카
const FONT_BODY = "'Hakgyoansim Boardmarker','Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif";
const FONT_TITLE = "'Hakgyoansim Byeoljari'," + FONT_BODY;
const DEBUG = /[?&]debug/.test(location.search);

const C = {
  ink: '#1b1838', navy: '#232048', navy2: '#2f2a5c', purple: '#5a3f8f',
  red: '#e0573e', rust: '#b8432f', orange: '#f5873a', teal: '#2cc8b6', tealD: '#178a80', tealL: '#9ff5ea',
  cream: '#fff4dc', mustard: '#f7c548', amber: '#ffb12e', amberL: '#ffe29a', white: '#ffffff',
  hp: '#ff5d73', good: '#5fe3a1', bad: '#ff6b6b', skin: '#f6d2b0'
};

/* ---------------- 작은 도구 ---------------- */
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function fmtTime(s) { s = Math.floor(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
const recordById = id => D.records.find(r => r.id === id);
const stageById = id => D.stages.find(s => s.id === id);

/* ---------------- 캔버스 ---------------- */
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const rotateEl = document.getElementById('rotate');
const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
let usingTouch = false;
// 화면 터치 버튼을 늘 보이게 하는 설정 (태블릿용). 브라우저에 따로 기억한다
let forceTouch = false;
try { forceTouch = localStorage.getItem('colony2126.touch') === '1'; } catch (e) { /* 무시 */ }
function setForceTouch(on) { forceTouch = on; try { localStorage.setItem('colony2126.touch', on ? '1' : '0'); } catch (e) { /* 무시 */ } }

function resize() {
  const host = document.body;
  const ww = (host && host.clientWidth) || window.innerWidth, wh = (host && host.clientHeight) || window.innerHeight;
  const s = Math.min(ww / W, wh / H);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = Math.max(1, Math.floor(W * s)), ch = Math.max(1, Math.floor(H * s));
  canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
  canvas.width = Math.floor(cw * dpr); canvas.height = Math.floor(ch * dpr);
  if (rotateEl) rotateEl.style.display = (isTouchDevice && wh > ww) ? 'flex' : 'none';
}
window.addEventListener('resize', resize);
resize();

/* ---------------- 그림·사진 (없어도 됨) ---------------- */
const IMG = {}, PHOTO = {};
function tryLoad(store, key, base, exts) {
  let i = 0;
  const img = new Image();
  img.onload = () => { store[key] = img; };
  img.onerror = () => { i++; if (i < exts.length) img.src = base + '.' + exts[i]; };
  img.src = base + '.' + exts[0];
}
['title', 'logo', 'card', 'op0a', 'op0b', 'op0c', 'op1', 'op2', 'op3', 'map', 'after1', 'after2', 'after3', 'after4', 'after5', 'boss1', 'boss2', 'boss3', 'boss4', 'boss5', 'boss_final', 'hero', 'ending1', 'ending2']
  .forEach(n => tryLoad(IMG, n, 'img/' + n, ['webp', 'jpg', 'png']));
(function loadPhotos() {
  const keys = new Set();
  D.records.forEach(r => r.photo && keys.add(r.photo));
  D.stages.forEach(s => s.boss && s.boss.rounds.forEach(rd => rd.options.forEach(o => o.photo && keys.add(o.photo))));
  keys.forEach(k => tryLoad(PHOTO, k, 'photos/' + k, ['jpg', 'png', 'webp']));
})();
function photoOf(opt) {
  if (!opt) return null;
  if (opt.photo) return PHOTO[opt.photo] || null;
  if (opt.record) { const r = recordById(opt.record); return r && PHOTO[r.photo] || null; }
  return null;
}

/* ---------------- 저장 (실패해도 게임은 계속) ---------------- */
const SAVE_KEY = 'colony2126.save.v1';
function defaultSave() {
  return { started: false, difficulty: 'normal', seenOpening: false, cleared: {}, records: {}, cards: {},
           skills: [], badges: [], level: 1, xp: 0, upgrades: {}, evidence: { right: 0, wrong: 0 }, stageStats: {} };
}
function loadSave() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && typeof s === 'object') return Object.assign(defaultSave(), s); } catch (e) { /* 무시 */ }
  return defaultSave();
}
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* 무시 */ } }
let save = loadSave();

/* ---------------- 소리 (기본 꺼짐) ---------------- */
const Sound = {
  on: false, ac: null,
  toggle() {
    this.on = !this.on;
    if (this.on && !this.ac) { try { this.ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.on = false; } }
  },
  play(kind) {
    if (!this.on || !this.ac) return;
    const P = { hit: [180, 0.12, 'square', 0.05], pick: [880, 0.14, 'sine', 0.07], good: [660, 0.35, 'triangle', 0.09],
                bad: [140, 0.35, 'sawtooth', 0.06], boom: [80, 0.4, 'sawtooth', 0.08], level: [720, 0.4, 'sine', 0.08], ui: [520, 0.06, 'sine', 0.04] }[kind];
    if (!P) return;
    try {
      const t = this.ac.currentTime, o = this.ac.createOscillator(), g = this.ac.createGain();
      o.type = P[2]; o.frequency.setValueAtTime(P[0], t);
      if (kind === 'good' || kind === 'level') o.frequency.exponentialRampToValueAtTime(P[0] * 1.6, t + P[1]);
      if (kind === 'boom' || kind === 'bad') o.frequency.exponentialRampToValueAtTime(P[0] * 0.5, t + P[1]);
      g.gain.setValueAtTime(P[3], t); g.gain.exponentialRampToValueAtTime(0.0001, t + P[1]);
      o.connect(g); g.connect(this.ac.destination); o.start(t); o.stop(t + P[1] + 0.02);
    } catch (e) { /* 무시 */ }
  }
};

/* ---------------- 입력 ---------------- */
const keys = {}, pressed = {};
let taps = [];
const pointer = { x: -1, y: -1 };
let joy = null;
let hitButtons = [], newButtons = [], focusCount = 0;
const ui = { focus: 0 };
const touchAct = { dash: false, skill: false, swap: false };

window.addEventListener('keydown', e => {
  usingTouch = false;
  if (!keys[e.code]) pressed[e.code] = true;
  keys[e.code] = true;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; joy = null; });
const hit = code => !!pressed[code];

function toGame(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
}
canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  canvas.focus();
  const p = toGame(e);
  usingTouch = e.pointerType === 'touch' || e.pointerType === 'pen';
  pointer.x = p.x; pointer.y = p.y;
  for (let i = hitButtons.length - 1; i >= 0; i--) {
    const b = hitButtons[i];
    if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) { if (b.fn) { Sound.play('ui'); b.fn(); } return; }
  }
  if ((e.pointerType === 'touch' || e.pointerType === 'pen' || forceTouch) && wantsJoystick() && p.x < W * 0.5 && !joy) {
    joy = { id: e.pointerId, ox: p.x, oy: p.y, x: p.x, y: p.y };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
    return;
  }
  taps.push(p);
});
canvas.addEventListener('pointermove', e => {
  const p = toGame(e);
  if (joy && e.pointerId === joy.id) { joy.x = p.x; joy.y = p.y; return; }
  if (e.pointerType === 'mouse') { pointer.x = p.x; pointer.y = p.y; }
});
const endPointer = e => { if (joy && e.pointerId === joy.id) joy = null; };
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('visibilitychange', () => { if (document.hidden && scene && scene.name === 'stage' && G && G.mode === 'play') G.mode = 'pause'; });

function wantsJoystick() { return scene && scene.name === 'stage' && G && G.mode === 'play' && !overlay; }

/* ---------------- 그리기 도구 ---------------- */
function rr(x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU); }
function ellipse(x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), 0, 0, TAU); }
// 굵기 900 = 제목 글꼴(별자리), 그 밖 = 본문 글꼴(보드마카, 굵기 하나)
function setFont(size, weight) { ctx.font = (weight || 800) >= 900 ? '600 ' + size + 'px ' + FONT_TITLE : '400 ' + size + 'px ' + FONT_BODY; }
function txt(s, x, y, size, color, align, o) {
  o = o || {};
  setFont(size, o.weight);
  ctx.textAlign = align || 'left'; ctx.textBaseline = o.base || 'middle';
  if (o.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = o.sw || Math.max(3, size / 5); ctx.strokeStyle = o.stroke; ctx.strokeText(s, x, y); }
  ctx.fillStyle = color; ctx.fillText(s, x, y);
}
function wrap(s, maxW, size, weight) {
  setFont(size, weight);
  const out = [];
  String(s).split('\n').forEach(par => {
    let line = '';
    par.split(' ').forEach(w => {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width <= maxW) { line = test; return; }
      if (line) out.push(line);
      if (ctx.measureText(w).width > maxW) {
        let cur = '';
        for (const ch of w) { if (ctx.measureText(cur + ch).width > maxW) { out.push(cur); cur = ch; } else cur += ch; }
        line = cur;
      } else line = w;
    });
    out.push(line);
  });
  return out;
}
function para(s, x, y, maxW, size, color, lh, o) {
  o = o || {};
  const lines = wrap(s, maxW, size, o.weight);
  lines.forEach((l, i) => txt(l, x, y + i * lh, size, color, o.align || 'left', o));
  return lines.length;
}
function drawCover(img, x, y, w, h, zoom) {
  const s = Math.max(w / img.width, h / img.height) * (zoom || 1);
  const iw = img.width * s, ih = img.height * s;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  ctx.restore();
}
function drawContain(img, x, y, w, h) {
  const s = Math.min(w / img.width, h / img.height);
  const iw = img.width * s, ih = img.height * s;
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}
function panel(x, y, w, h, o) {
  o = o || {};
  rr(x, y, w, h, o.r || 18);
  ctx.fillStyle = o.fill || 'rgba(27,24,56,0.9)'; ctx.fill();
  ctx.lineWidth = o.lw || 3; ctx.strokeStyle = o.stroke || 'rgba(255,244,220,0.85)'; ctx.stroke();
}
function dim(a) { ctx.fillStyle = 'rgba(14,12,32,' + (a == null ? 0.7 : a) + ')'; ctx.fillRect(0, 0, W, H); }

function modalStart() {
  newButtons = []; focusCount = 0;
  newButtons.push({ x: 0, y: 0, w: W, h: H, fn: null, focusable: false });
}
function button(x, y, w, h, label, fn, o) {
  o = o || {};
  const focusable = o.focusable !== false;
  const idx = focusable ? focusCount++ : -1;
  const hover = !usingTouch && pointer.x >= x && pointer.x <= x + w && pointer.y >= y && pointer.y <= y + h;
  const focused = focusable && idx === ui.focus && !usingTouch;
  newButtons.push({ x, y, w, h, fn: o.disabled ? null : fn, focusable: focusable && !o.disabled, idx });
  const st = { hot: hover || focused, hover, focused };
  if (o.draw === false) return st;
  ctx.save();
  if (st.hot && !o.disabled) { rr(x - 4, y - 4, w + 8, h + 8, (o.r || 16) + 4); ctx.fillStyle = 'rgba(247,197,72,0.35)'; ctx.fill(); }
  rr(x, y + 4, w, h, o.r || 16); ctx.fillStyle = 'rgba(10,8,30,0.45)'; ctx.fill();
  rr(x, y, w, h, o.r || 16);
  ctx.fillStyle = o.disabled ? '#4a4578' : st.hot ? (o.hotFill || C.mustard) : (o.fill || C.cream);
  ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.stroke();
  txt(label, x + w / 2, y + h / 2 + 1, o.size || 24, o.disabled ? '#a29cd0' : (o.color || C.ink), 'center', { weight: 900 });
  ctx.restore();
  return st;
}
function menuNav() {
  const f = hitButtons.filter(b => b.focusable);
  if (!f.length) return;
  if (ui.focus >= f.length) ui.focus = 0;
  if (hit('ArrowDown') || hit('ArrowRight') || hit('Tab') || hit('KeyS') || hit('KeyD')) { ui.focus = (ui.focus + 1) % f.length; usingTouch = false; }
  if (hit('ArrowUp') || hit('ArrowLeft') || hit('KeyW') || hit('KeyA')) { ui.focus = (ui.focus - 1 + f.length) % f.length; usingTouch = false; }
  if (hit('Enter') || hit('Space') || hit('NumpadEnter')) { const b = f[ui.focus]; if (b && b.fn) { Sound.play('ui'); b.fn(); } }
}
function soundButton(x, y) {
  button(x, y, 170, 46, Sound.on ? '소리: 켬' : '소리: 끔', () => Sound.toggle(), { size: 18, fill: Sound.on ? C.tealL : '#d9d2f0' });
}

/* ---------------- 코드로 그린 캐릭터 ---------------- */
const HERO_LOOK = { suit: C.teal, stripe: C.mustard, hair: '#1d1b2c', skin: '#f6d2b0', scarf: C.orange };
const LOOKS = [
  { suit: '#ec6f9f', stripe: C.cream, hair: '#6b3b22', skin: '#f3c9a4', bow: '#ffd36b' },
  { suit: C.mustard, stripe: C.rust, hair: '#e3ddd2', skin: '#e9b48d', glasses: true },
  { suit: '#8063d1', stripe: C.mustard, hair: '#2c1e18', skin: '#a8714d' },
  { suit: C.cream, stripe: C.teal, hair: '#e8a33c', skin: '#f6d2b0', bow: '#ec6f9f' },
  { suit: '#5aa0e8', stripe: C.cream, hair: '#4a2b1a', skin: '#c98f68', glasses: true }
];

function drawChibi(x, y, t, moving, aim, look, o) {
  o = o || {};
  const bob = moving ? Math.abs(Math.sin(t * 14)) * 3 : Math.sin(t * 3) * 0.8;
  const fx = Math.cos(aim) < -0.1 ? -1 : 1;
  ctx.save(); ctx.translate(x, y);
  if (o.scale) ctx.scale(o.scale, o.scale);
  if (!o.noShadow) { ctx.fillStyle = 'rgba(10,8,30,0.35)'; ellipse(0, 16, 14, 5); ctx.fill(); }
  ctx.translate(0, -bob);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = 2.4; ctx.strokeStyle = C.ink;
  const step = moving ? Math.sin(t * 14) * 3 : 0;
  ctx.fillStyle = '#2a2b4a';
  rr(-8, 7 + step, 7, 9, 3); ctx.fill(); ctx.stroke();
  rr(1, 7 - step, 7, 9, 3); ctx.fill(); ctx.stroke();
  if (look.scarf) {
    const s1 = Math.sin(t * 9) * 3, s2 = Math.sin(t * 9 + 1.2) * 4;
    ctx.fillStyle = look.scarf; ctx.beginPath();
    ctx.moveTo(-fx * 3, -8); ctx.quadraticCurveTo(-fx * 14, -8 + s1, -fx * 22, -3 + s2);
    ctx.lineTo(-fx * 18, 2 + s2); ctx.quadraticCurveTo(-fx * 10, -1, -fx * 1, -3); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  if (!o.noPack) { ctx.fillStyle = '#c99a5b'; rr(-fx * 13 - 5, -6, 10, 13, 3); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = look.suit; rr(-10, -7, 20, 17, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = look.stripe; ctx.fillRect(-7, -5, 3, 13); ctx.fillRect(4, -5, 3, 13);
  if (look.scarf) { ctx.fillStyle = look.scarf; rr(-10, -10, 20, 6, 3); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = look.skin; circle(0, -20, 13); ctx.fill(); ctx.stroke();
  ctx.fillStyle = look.hair; ctx.beginPath();
  ctx.moveTo(-13.6, -19); ctx.arc(0, -20, 13.6, Math.PI, 0); ctx.lineTo(13.6, -19);
  ctx.lineTo(10, -21.5); ctx.lineTo(7, -18); ctx.lineTo(3.5, -22.5); ctx.lineTo(0, -18.5); ctx.lineTo(-4, -22.5); ctx.lineTo(-7.5, -18); ctx.lineTo(-11, -21.5);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-1, -33); ctx.quadraticCurveTo(3, -40, 8, -37); ctx.quadraticCurveTo(4, -35.5, 3, -33); ctx.closePath(); ctx.fill(); ctx.stroke();
  if (look.bow) { ctx.fillStyle = look.bow; circle(-fx * 10, -30, 3.6); ctx.fill(); ctx.stroke(); }
  const ex = fx * 2.5;
  if (o.closed) {
    ctx.beginPath(); ctx.moveTo(ex - 7, -15); ctx.quadraticCurveTo(ex - 5, -17.5, ex - 3, -15); ctx.moveTo(ex + 3, -15); ctx.quadraticCurveTo(ex + 5, -17.5, ex + 7, -15); ctx.stroke();
  } else {
    ctx.fillStyle = C.ink; ellipse(ex - 5, -15, 2.4, 3.4); ctx.fill(); ellipse(ex + 5, -15, 2.4, 3.4); ctx.fill();
    ctx.fillStyle = '#fff'; circle(ex - 4.2, -16.3, 1); ctx.fill(); circle(ex + 5.8, -16.3, 1); ctx.fill();
  }
  if (look.glasses) { ctx.lineWidth = 1.4; circle(ex - 5, -15, 4.2); ctx.stroke(); circle(ex + 5, -15, 4.2); ctx.stroke(); ctx.lineWidth = 2.4; }
  ctx.fillStyle = 'rgba(255,110,140,0.45)'; ellipse(ex - 8.5, -10.5, 2.6, 1.6); ctx.fill(); ellipse(ex + 8.5, -10.5, 2.6, 1.6); ctx.fill();
  ctx.restore();
}
function drawMegaphone(x, y, aim, glow) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(aim);
  if (Math.cos(aim) < 0) ctx.scale(1, -1);
  ctx.lineJoin = 'round'; ctx.lineWidth = 2.2; ctx.strokeStyle = C.ink;
  ctx.fillStyle = '#3c3f68'; rr(-1, 2, 5, 8, 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = C.cream; ctx.beginPath(); ctx.moveTo(-4, -3.5); ctx.lineTo(10, -8); ctx.lineTo(10, 8); ctx.lineTo(-4, 3.5); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = C.teal; rr(9, -9, 5, 18, 2); ctx.fill(); ctx.stroke();
  if (glow > 0) {
    ctx.strokeStyle = 'rgba(159,245,234,' + glow + ')'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(14, 0, 9, -0.9, 0.9); ctx.stroke();
    ctx.beginPath(); ctx.arc(14, 0, 16, -0.8, 0.8); ctx.stroke();
  }
  ctx.restore();
}
const HERO_SCALE = 1.3;
function drawHeroAt(x, y, aim, t, moving, glow, o) {
  ctx.save(); ctx.translate(x, y); ctx.scale(HERO_SCALE, HERO_SCALE);
  drawChibi(0, 0, t, moving, aim, HERO_LOOK, o);
  const hx = Math.cos(aim) * 13, hy = -4 + Math.sin(aim) * 7 - (moving ? Math.abs(Math.sin(t * 14)) * 3 : 0);
  drawMegaphone(hx, hy, aim, glow);
  ctx.restore();
}
function drawEye(x, y, r, lookA, t, o) {
  o = o || {};
  ctx.fillStyle = '#2a2342'; circle(x, y, r); ctx.fill(); ctx.stroke();
  const px = x + Math.cos(lookA) * r * 0.28, py = y + Math.sin(lookA) * r * 0.28;
  ctx.fillStyle = o.color || C.amber; circle(px, py, r * 0.62); ctx.fill();
  ctx.fillStyle = o.core || '#fff1b8'; circle(px, py, r * 0.3); ctx.fill();
  ctx.fillStyle = '#fff'; circle(px - r * 0.22, py - r * 0.25, r * 0.13); ctx.fill();
}
function drawEnemy(e, t) {
  const s = e.spawnT > 0 ? 1 - e.spawnT / 0.5 : 1;
  const flash = e.flash > 0;
  const aimA = Math.atan2(G.P.y - e.y, G.P.x - e.x);
  ctx.save(); ctx.translate(e.x, e.y + (e.type === 'turret' ? 0 : Math.sin(e.t * 4) * 2)); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(10,8,30,0.3)'; ellipse(0, e.r + 8, e.r * 0.8, e.r * 0.28); ctx.fill();
  ctx.lineJoin = 'round'; ctx.lineWidth = 2.6; ctx.strokeStyle = C.ink;
  const body = flash ? '#ffffff' : C.cream;
  if (e.type === 'drone') {
    const r = e.r, sp = Math.sin(t * 40) * r * 0.5;
    ctx.fillStyle = '#9ea3c8';
    ellipse(-r * 0.7, -r * 0.95, Math.abs(sp) + 3, 3); ctx.fill(); ctx.stroke();
    ellipse(r * 0.7, -r * 0.95, Math.abs(sp) + 3, 3); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * 0.7, -r * 0.9); ctx.lineTo(-r * 0.45, -r * 0.6); ctx.moveTo(r * 0.7, -r * 0.9); ctx.lineTo(r * 0.45, -r * 0.6); ctx.stroke();
    ctx.fillStyle = body; circle(0, 0, r); ctx.fill(); ctx.stroke();
    ctx.save(); circle(0, 0, r - 1.5); ctx.clip(); ctx.fillStyle = flash ? '#fff' : '#dccfb8'; ctx.fillRect(-r, r * 0.35, r * 2, r); ctx.restore();
    ctx.fillStyle = C.amber; ctx.fillRect(-r * 0.9, r * 0.3, r * 1.8, 2.5);
    drawEye(0, -1, r * 0.5, aimA, t);
    ctx.beginPath(); ctx.moveTo(-r * 0.55, -r * 0.62); ctx.lineTo(-r * 0.1, -r * 0.45); ctx.moveTo(r * 0.55, -r * 0.62); ctx.lineTo(r * 0.1, -r * 0.45); ctx.stroke();
  } else if (e.type === 'chaser') {
    const r = e.r;
    ctx.save(); ctx.rotate(aimA);
    ctx.fillStyle = flash ? '#fff' : C.red;
    ctx.beginPath(); ctx.moveTo(r * 1.5, 0); ctx.lineTo(-r * 0.4, -r * 1.15); ctx.lineTo(-r * 0.9, 0); ctx.lineTo(-r * 0.4, r * 1.15); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = body; circle(0, 0, r * 0.85); ctx.fill(); ctx.stroke();
    drawEye(0, 0, r * 0.5, aimA, t);
  } else if (e.type === 'turret') {
    const r = e.r;
    ctx.fillStyle = '#3a3566'; ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + Math.PI / 6; ctx.lineTo(Math.cos(a) * r * 1.15, Math.sin(a) * r * 0.85 + 4); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.rotate(e.aim || aimA);
    ctx.fillStyle = flash ? '#fff' : '#b9b3d6'; rr(0, -5, r * 1.3, 10, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.amber; ctx.fillRect(r * 1.1, -5, 4, 10);
    ctx.restore();
    ctx.fillStyle = body; circle(0, -2, r * 0.75); ctx.fill(); ctx.stroke();
    drawEye(0, -3, r * 0.4, aimA, t);
  } else if (e.type === 'guard') {
    const r = e.r, gap = 3 + Math.sin(e.t * 3) * 1.5;
    ctx.fillStyle = body;
    rr(-r - gap, -r, r, r * 2, 10); ctx.fill(); ctx.stroke();
    rr(gap, -r, r, r * 2, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,177,46,0.9)'; ctx.fillRect(-gap + 0.5, -r + 4, gap * 2 - 1, r * 2 - 8);
    ctx.fillStyle = '#3a3566'; rr(-r - gap - 6, -4, 8, 14, 3); ctx.fill(); ctx.stroke(); rr(r + gap - 2, -4, 8, 14, 3); ctx.fill(); ctx.stroke();
    drawEye(0, -r * 0.35, r * 0.42, aimA, t);
    ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.85); ctx.lineTo(-r * 0.1, -r * 0.7); ctx.moveTo(r * 0.5, -r * 0.85); ctx.lineTo(r * 0.1, -r * 0.7); ctx.stroke();
  }
  if (e.chip) drawChipIcon(0, -e.r - 20 + Math.sin(t * 5) * 2, 0.75, t);
  ctx.restore();
  if (e.hp < e.maxHp && e.type !== 'chaser') {
    const w = e.r * 2;
    ctx.fillStyle = 'rgba(10,8,30,0.7)'; ctx.fillRect(e.x - w / 2, e.y + e.r + 10, w, 4);
    ctx.fillStyle = C.amber; ctx.fillRect(e.x - w / 2, e.y + e.r + 10, w * Math.max(0, e.hp / e.maxHp), 4);
  }
}
function drawChipIcon(x, y, s, t) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(159,245,234,0.28)'; circle(0, 0, 20 + Math.sin(t * 4) * 2); ctx.fill();
  ctx.lineWidth = 2.4; ctx.strokeStyle = C.ink;
  ctx.fillStyle = C.tealD; rr(-12, -9, 24, 18, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = C.cream; rr(-8, -5, 16, 6, 2); ctx.fill();
  ctx.fillStyle = C.tealL; ctx.fillRect(-8, 3, 4, 3); ctx.fillRect(-2, 3, 4, 3); ctx.fillRect(4, 3, 4, 3);
  ctx.restore();
}
function drawPhotoBox(rec, x, y, w, h, o) {
  o = o || {};
  const img = rec ? PHOTO[rec.photo] : o.img;
  ctx.save(); rr(x, y, w, h, o.r || 8); ctx.clip();
  if (img) drawCover(img, x, y, w, h);
  else {
    ctx.fillStyle = '#34305f'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 8;
    for (let i = -h; i < w; i += 22) { ctx.beginPath(); ctx.moveTo(x + i, y + h); ctx.lineTo(x + i + h, y); ctx.stroke(); }
    if (rec) {
      txt(rec.year, x + w / 2, y + h / 2 - (h > 90 ? 10 : 4), Math.min(34, Math.max(14, w / 7)), C.amberL, 'center', { stroke: C.ink, sw: 4 });
      if (h > 70) txt('사진 준비 중', x + w / 2, y + h / 2 + 22, Math.max(11, Math.min(15, w / 12)), 'rgba(255,244,220,0.6)', 'center');
    }
  }
  ctx.restore();
  rr(x, y, w, h, o.r || 8); ctx.lineWidth = 2.5; ctx.strokeStyle = C.ink; ctx.stroke();
}

/* ---------------- 코드로 그린 배경 (그림이 없을 때) ---------------- */
function drawMarsScene(t, o) {
  o = o || {};
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1d1950'); g.addColorStop(0.5, '#6a3b86'); g.addColorStop(0.78, '#e3734d'); g.addColorStop(1, '#f2a35a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 50; i++) {
    const sx = (i * 263) % W, sy = (i * 137) % 300;
    ctx.fillStyle = 'rgba(255,255,255,' + (0.3 + 0.3 * Math.sin(t * 2 + i)) + ')'; ctx.fillRect(sx, sy, 2, 2);
  }
  ctx.fillStyle = 'rgba(95,182,255,0.35)'; circle(1080, 92, 12); ctx.fill();
  ctx.fillStyle = '#6cc0ff'; circle(1080, 92, 5); ctx.fill();
  ctx.fillStyle = 'rgba(255,214,122,0.9)'; circle(470, 470, 48); ctx.fill();
  ctx.fillStyle = '#a24a4a'; ctx.beginPath(); ctx.moveTo(0, 500);
  for (let x = 0; x <= W; x += 80) ctx.lineTo(x, 470 + Math.sin(x * 0.013) * 30 + Math.sin(x * 0.041) * 12);
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
  if (!o.noTower) {
    ctx.save(); ctx.translate(1010, 0);
    ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = C.ink;
    ctx.fillStyle = '#efe6d6'; ctx.beginPath(); ctx.moveTo(-30, 110); ctx.lineTo(30, 110); ctx.lineTo(80, 560); ctx.lineTo(-80, 560); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,177,46,0.9)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 140); ctx.lineTo(0, 200); ctx.moveTo(0, 290); ctx.lineTo(0, 540); ctx.moveTo(-40, 380); ctx.lineTo(-55, 540); ctx.moveTo(40, 380); ctx.lineTo(55, 540); ctx.stroke();
    ctx.fillStyle = 'rgba(255,177,46,0.3)'; circle(0, 245, 40 + Math.sin(t * 2) * 3); ctx.fill();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 3;
    drawEye(0, 245, 24, Math.PI * 0.6, t, o.eyeColor ? { color: o.eyeColor, core: '#e8fffb' } : null);
    ctx.restore();
  }
  const domes = [[180, 560, 90], [380, 590, 70], [640, 575, 110], [860, 600, 70], [1180, 590, 95]];
  domes.forEach(d => {
    ctx.fillStyle = 'rgba(210,240,255,0.28)'; ctx.beginPath(); ctx.arc(d[0], d[1], d[2], Math.PI, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#5fb07a'; ctx.beginPath(); ctx.arc(d[0], d[1], d[2] * 0.6, Math.PI, 0); ctx.closePath(); ctx.fill();
  });
  ctx.fillStyle = '#7d2e2a'; ctx.beginPath(); ctx.moveTo(0, 640);
  for (let x = 0; x <= W; x += 60) ctx.lineTo(x, 630 + Math.sin(x * 0.02 + 1) * 14);
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
  if (o.laser) { ctx.fillStyle = 'rgba(255,177,46,0.25)'; ctx.fillRect(628, 0, 24, H); ctx.fillStyle = '#ffe6a6'; ctx.fillRect(637, 0, 6, H); }
}
function backdrop(name, t, o) {
  if (IMG[name]) drawCover(IMG[name], 0, 0, W, H, 1 + (o && o.zoom || 0));
  else drawMarsScene(t, o);
}

/* ---------------- 장면 관리 ---------------- */
let scene = null, overlay = null;
let fadeA = 0, fadeNext = null;
function setScene(s) { scene = s; ui.focus = 0; joy = null; }
function go(make) { if (fadeNext) return; fadeNext = make; }

/* ===== 시작 화면 ===== */
function TitleScene() {
  return {
    name: 'title', t: 0, confirm: false,
    update(dt) { this.t += dt; menuNav(); if (hit('Escape')) this.confirm = false; },
    draw() {
      backdrop('title', this.t);
      const g = ctx.createLinearGradient(0, 0, 0, 260); g.addColorStop(0, 'rgba(20,16,50,0.55)'); g.addColorStop(1, 'rgba(20,16,50,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, 260);
      const bob = Math.sin(this.t * 2) * 4;
      if (IMG.logo) {
        const asp = IMG.logo.width / IMG.logo.height, lw = Math.min(640, 300 * asp), lh = lw / asp;
        ctx.drawImage(IMG.logo, W / 2 - lw / 2, 14 + bob, lw, lh);
        txt(D.subtitle, W / 2, 34 + lh + bob, 30, C.cream, 'center', { weight: 900, stroke: C.ink, sw: 8 });
      } else {
        txt(D.title, W / 2 + 4, 118 + bob + 6, 92, 'rgba(23,138,128,0.9)', 'center', { weight: 900 });
        txt(D.title, W / 2, 118 + bob, 92, C.cream, 'center', { weight: 900, stroke: C.ink, sw: 12 });
        txt(D.subtitle, W / 2, 190 + bob, 26, C.amberL, 'center', { stroke: C.ink, sw: 6 });
      }
      const has = save.started;
      if (this.confirm) {
        modalStart(); dim(0.6);
        panel(W / 2 - 300, 250, 600, 230);
        txt('저장된 진행을 지우고 새로 시작할까요?', W / 2, 310, 24, C.cream, 'center');
        txt('모은 기록과 제도 카드도 사라져요.', W / 2, 348, 18, '#c9c2ef', 'center', { weight: 600 });
        button(W / 2 - 250, 395, 230, 58, '지우고 새로', () => { this.confirm = false; go(() => DifficultyScene()); }, { fill: '#ffb4b4' });
        button(W / 2 + 20, 395, 230, 58, '취소', () => { this.confirm = false; });
        return;
      }
      let y = 452;
      const bx = W / 2 - 170;
      if (has) { button(bx, y, 340, 60, '이어 하기', () => go(() => SelectScene())); y += 74; }
      button(bx, y, 340, 60, has ? '새로 시작' : '시작하기', () => { if (has) { this.confirm = true; ui.focus = 1; } else go(() => DifficultyScene()); }); y += 74;
      button(bx, y, 340, 52, '지구 기록 보관소', () => openArchive(), { size: 21, fill: C.tealL });
      soundButton(W - 190, H - 66);
      button(W - 380, H - 66, 176, 46, forceTouch ? '터치 버튼: 켬' : '터치 버튼: 끔', () => setForceTouch(!forceTouch), { size: 18, fill: forceTouch ? C.tealL : '#d9d2f0' });
      txt('Enter: 고르기 · 방향키: 옮기기', 24, H - 26, 15, 'rgba(255,244,220,0.75)', 'left', { weight: 600, stroke: 'rgba(20,16,50,0.7)', sw: 4 });
    }
  };
}

/* ===== 난이도 ===== */
function DifficultyScene() {
  return {
    name: 'difficulty', t: 0,
    update(dt) { this.t += dt; menuNav(); if (hit('Escape')) go(() => TitleScene()); },
    draw() {
      backdrop('title', this.t); dim(0.62);
      txt('난이도를 고르세요', W / 2, 120, 44, C.cream, 'center', { stroke: C.ink, sw: 8 });
      const opts = [
        { id: 'easy', name: '쉬움', lines: ['체력이 넉넉해요', '쓰러져도 그 자리에서 다시 일어나요'], col: C.tealL },
        { id: 'normal', name: '보통', lines: ['목숨 3개', '쓰러지면 구역 입구에서 다시'], col: C.mustard }
      ];
      opts.forEach((o, i) => {
        const x = W / 2 - 430 + i * 450, y = 200, w = 410, h = 300;
        const st = button(x, y, w, h, '', () => {
          save = defaultSave(); save.started = true; save.difficulty = o.id; writeSave();
          go(() => OpeningScene());
        }, { draw: false });
        panel(x, y, w, h, { fill: st.hot ? 'rgba(60,52,120,0.95)' : 'rgba(27,24,56,0.9)', stroke: st.hot ? o.col : 'rgba(255,244,220,0.6)', lw: st.hot ? 5 : 3 });
        txt(o.name, x + w / 2, y + 70, 54, o.col, 'center', { weight: 900, stroke: C.ink, sw: 8 });
        o.lines.forEach((l, j) => txt(l, x + w / 2, y + 160 + j * 40, 22, C.cream, 'center', { weight: 700 }));
      });
      txt('수업 시간이 짧으면 쉬움을 추천해요', W / 2, 560, 20, '#d4cdf5', 'center', { weight: 600 });
      button(40, H - 80, 160, 50, '◀ 뒤로', () => go(() => TitleScene()), { size: 20 });
    }
  };
}

/* ===== 오프닝 3컷 ===== */
function OpeningScene() {
  const finish = () => { save.seenOpening = true; writeSave(); go(() => SelectScene()); };
  return {
    name: 'opening', i: 0, t: 0, done: false,
    full: false,
    next() { if (this.done) return; this.i++; this.t = 0; this.full = false; if (this.i >= D.opening.length) { this.done = true; this.i = D.opening.length - 1; finish(); } },
    update(dt) {
      this.t += dt;
      if (this.t * 40 >= richText(D.opening[this.i].text).plain.length) this.full = true;
      // 눌러야 넘어간다. 글자가 다 나오기 전에 누르면 먼저 글자를 다 보여 준다
      if (this.t > 0.3 && (hit('Enter') || hit('Space') || hit('ArrowRight') || taps.length)) { if (this.full) this.next(); else this.full = true; }
      if (hit('Escape')) { this.done = true; finish(); }
    },
    draw() {
      const cut = D.opening[this.i];
      if (IMG[cut.img]) drawCover(IMG[cut.img], 0, 0, W, H, 1.02 + this.t * 0.006);
      else drawMarsScene(this.t, { laser: this.i === 0, eyeColor: null });
      // 자막 바: 크기가 고정된 바 안에서 글자가 한 자씩 나온다 (줄은 미리 나눠서 흔들리지 않게)
      const bx = 70, bw = W - 140, bh = 148, by = H - bh - 44, size = 30, lh = 46;
      const g = ctx.createLinearGradient(0, by - 90, 0, H); g.addColorStop(0, 'rgba(12,10,30,0)'); g.addColorStop(0.45, 'rgba(12,10,30,0.6)'); g.addColorStop(1, 'rgba(12,10,30,0.85)');
      ctx.fillStyle = g; ctx.fillRect(0, by - 90, W, H - by + 90);
      panel(bx, by, bw, bh, { fill: 'rgba(16,13,38,0.95)', stroke: 'rgba(255,244,220,0.9)', r: 22 });
      const rich = richText(cut.text);
      const n = this.full ? rich.plain.length : Math.min(rich.plain.length, Math.floor(this.t * 40));
      const nLines = Math.min(2, wrap(rich.plain, bw - 110, size, 600).length);
      drawRich(rich, n, bx + 55, nLines === 1 ? by + bh / 2 : by + bh / 2 - lh / 2, bw - 110, size, lh, C.cream, C.mustard);
      if (cut.card === 'order') drawOrderCard(this.t);
      if (cut.card === 'problems') drawProblemsCard(this.t);
      if (this.full) txt('▼', bx + bw - 40, by + bh - 28 + Math.sin(this.t * 6) * 3, 20, C.mustard, 'center');
      button(W - 190, 24, 166, 48, '건너뛰기 ▶▶', () => { this.done = true; finish(); }, { size: 18, focusable: false });
      txt('클릭 · Enter: 다음', W / 2, H - 20, 16, 'rgba(255,244,220,0.8)', 'center', { weight: 600 });
    }
  };
}

/* {강조} 표시가 있는 자막: 글자를 한 자씩 보여 주면서 강조 부분은 다른 색으로 */
function richText(text) {
  let plain = '', on = false; const hi = [];
  for (const ch of text) { if (ch === '{') { on = true; continue; } if (ch === '}') { on = false; continue; } plain += ch; hi.push(on); }
  return { plain, hi };
}
function drawRich(rich, n, x, y, maxW, size, lh, color, hiColor) {
  const lines = wrap(rich.plain, maxW, size, 600);
  let idx = 0;
  lines.slice(0, 2).forEach((l, li) => {
    let xx = x, k = 0;
    setFont(size, 600);
    while (k < l.length && idx + k < n) {
      const h = rich.hi[idx + k]; let e = k;
      while (e < l.length && idx + e < n && rich.hi[idx + e] === h) e++;
      const seg = l.slice(k, e);
      txt(seg, xx, y + li * lh, size, h ? hiColor : color, 'left', { weight: 600 });
      setFont(size, 600); xx += ctx.measureText(seg).width; k = e;
    }
    idx += l.length + 1;
  });
}
function drawOrderCard(t) {
  const a = Math.min(1, Math.max(0, (t - 0.4) * 3));
  ctx.save(); ctx.globalAlpha = a; ctx.translate(0, (1 - a) * -20);
  panel(40, 36, 470, 178, { fill: 'rgba(20,17,46,0.94)', stroke: C.amber, r: 20, lw: 3 });
  ctx.fillStyle = 'rgba(255,177,46,0.25)'; circle(118, 125, 58 + Math.sin(t * 3) * 3); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.fillStyle = '#f1e8d8'; circle(118, 125, 46); ctx.fill(); ctx.stroke();
  drawEye(118, 125, 32, Math.PI * 0.2 + Math.sin(t) * 0.5, t);
  txt('오더 ORDER', 190, 78, 34, C.amberL, 'left', { weight: 900 });
  txt('정착촌을 운영하는 인공지능', 190, 118, 21, C.cream, 'left', { weight: 600 });
  rr(190, 142, 290, 52, 14); ctx.fillStyle = C.amber; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.stroke();
  txt('원칙: 효율', 335, 169, 32, C.ink, 'center', { weight: 900 });
  ctx.restore();
}
function drawProblemsCard(t) {
  const a = Math.min(1, Math.max(0, (t - 0.3) * 3));
  ctx.save(); ctx.globalAlpha = a;
  const list = D.problems || [];
  const h = 70 + list.length * 42;
  panel(40, 36, 480, h, { fill: 'rgba(20,17,46,0.94)', stroke: C.red, r: 20, lw: 3 });
  txt('효율만 따지자 생긴 일', 66, 72, 26, C.amberL, 'left', { weight: 900 });
  list.forEach((p, i) => {
    const show = Math.min(1, Math.max(0, (t - 0.8 - i * 0.45) * 4));
    if (show <= 0) return;
    ctx.globalAlpha = a * show;
    const y = 116 + i * 42;
    ctx.fillStyle = C.red; circle(80, y, 13); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = C.ink; ctx.stroke();
    txt('!', 80, y + 1, 18, C.cream, 'center', { weight: 900 });
    txt(p, 104, y, 22, C.cream, 'left', { weight: 600 });
  });
  ctx.globalAlpha = a;
  ctx.restore();
}

/* ===== 스테이지 고르기 ===== */
function SelectScene() {
  return {
    name: 'select', t: 0,
    update(dt) { this.t += dt; menuNav(); if (hit('Escape')) go(() => TitleScene()); },
    draw() {
      if (IMG.map) drawCover(IMG.map, 0, 0, W, H); else drawMarsScene(this.t);
      dim(0.35);
      panel(24, 20, W - 48, 96, { fill: 'rgba(27,24,56,0.9)' });
      txt('스테이지 고르기', 50, 54, 32, C.cream, 'left', { weight: 900 });
      txt('효율만 따지는 오더 때문에 생긴 문제를, 지구 기록으로 하나씩 바꿔요', 50, 92, 19, C.tealL, 'left', { weight: 600 });
      const cardsN = Object.keys(save.cards).length;
      txt('Lv ' + save.level + '   ·   제도 카드 ' + cardsN + '/5   ·   ' + (save.difficulty === 'easy' ? '쉬움' : '보통'), W - 50, 54, 21, C.amberL, 'right');
      const n = D.stages.length, cw = 192, gap = 12, x0 = (W - (n * cw + (n - 1) * gap)) / 2, y0 = 330, ch = 286;
      D.stages.forEach((s, i) => {
        const x = x0 + i * (cw + gap);
        const cleared = !!save.cleared[s.id];
        const finalLocked = s.id === 6 && !(save.cleared[1] && save.cleared[2] && save.cleared[3] && save.cleared[4] && save.cleared[5]);
        const playable = s.ready && !finalLocked;
        const st = button(x, y0, cw, ch, '', () => { if (playable) go(() => StageScene(s.id)); }, { draw: false, disabled: !playable });
        const lift = st.hot && playable ? -8 : 0;
        panel(x, y0 + lift, cw, ch, { fill: playable ? (st.hot ? 'rgba(66,56,130,0.96)' : 'rgba(36,31,74,0.94)') : 'rgba(30,27,58,0.8)',
          stroke: playable ? (st.hot ? C.mustard : C.cream) : 'rgba(255,244,220,0.3)', lw: st.hot ? 5 : 3 });
        ctx.fillStyle = playable ? C.mustard : '#5a5488'; circle(x + cw / 2, y0 + lift + 50, 30); ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.stroke();
        txt(s.id === 6 ? '★' : String(s.id), x + cw / 2, y0 + lift + 52, 30, C.ink, 'center', { weight: 900 });
        txt(s.name, x + cw / 2, y0 + lift + 112, 25, playable ? C.cream : '#9a93c8', 'center', { weight: 900 });
        txt(s.movement, x + cw / 2, y0 + lift + 146, 18, playable ? C.tealL : '#7f78ad', 'center', { weight: 700 });
        if (s.problem) {
          rr(x + 14, y0 + lift + 166, cw - 28, 52, 12); ctx.fillStyle = playable ? 'rgba(224,87,62,0.25)' : 'rgba(224,87,62,0.12)'; ctx.fill();
          txt('문제', x + cw / 2, y0 + lift + 180, 13, playable ? '#ffb3a3' : '#9a7f9a', 'center', { weight: 600 });
          txt(s.problem, x + cw / 2, y0 + lift + 202, 17, playable ? C.cream : '#9a93c8', 'center', { weight: 600 });
        }
        const sy = y0 + lift + 248;
        if (cleared) {
          rr(x + 30, sy - 20, cw - 60, 40, 20); ctx.fillStyle = C.good; ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5; ctx.stroke();
          txt('바꿨어요 ✓', x + cw / 2, sy + 1, 19, C.ink, 'center');
        } else if (!s.ready) txt('준비 중', x + cw / 2, sy, 19, '#8e87bd', 'center', { weight: 700 });
        else if (finalLocked) txt('다섯 곳을 깨면 열려요', x + cw / 2, sy, 15, '#8e87bd', 'center', { weight: 700 });
        else txt('출발 ▶', x + cw / 2, sy, 21, C.mustard, 'center');
      });
      if (save.badges.length) txt('운동 배지: ' + save.badges.join(' · '), 40, 650, 19, C.cream, 'left', { stroke: C.ink, sw: 5 });
      button(W - 470, H - 82, 250, 56, '지구 기록 보관소', () => openArchive(), { size: 20, fill: C.tealL });
      button(W - 204, H - 82, 170, 56, '처음 화면', () => go(() => TitleScene()), { size: 20 });
    }
  };
}

/* ===== 결과 ===== */
function ResultScene(r) {
  return {
    name: 'result', t: 0,
    update(dt) { this.t += dt; menuNav(); },
    draw() {
      if (IMG.map) drawCover(IMG.map, 0, 0, W, H); else drawMarsScene(this.t);
      dim(0.55);
      panel(W / 2 - 420, 50, 840, 560);
      txt('STAGE ' + r.id + ' · ' + r.name + ' 클리어!', W / 2, 110, 38, C.mustard, 'center', { weight: 900, stroke: C.ink, sw: 8 });
      const acc = r.right + r.wrong ? Math.round(r.right / (r.right + r.wrong) * 100) : 100;
      const rows = [
        ['걸린 시간', fmtTime(r.time)],
        ['모은 기록', r.chips + ' / ' + r.chipTotal],
        ['증거 정확도', acc + '%  (맞힘 ' + r.right + ' · 틀림 ' + r.wrong + ')'],
        ['레벨', 'Lv ' + r.level],
        ['함께한 정착민', r.rescued + '명']
      ];
      rows.forEach((row, i) => {
        const y = 180 + i * 50;
        txt(row[0], W / 2 - 340, y, 24, '#cfc8f2', 'left', { weight: 700 });
        txt(row[1], W / 2 + 340, y, 26, C.cream, 'right');
        ctx.fillStyle = 'rgba(255,244,220,0.12)'; ctx.fillRect(W / 2 - 340, y + 24, 680, 2);
      });
      const def = stageById(r.id);
      if (def.card) {
        drawCardArt(W / 2 - 300, 412, 118, def.card, 1);
        txt('기술: ' + (D.skills[def.skill] ? D.skills[def.skill].name : ''), W / 2 + 10, 480, 23, C.tealL, 'left');
        txt('운동 배지: ' + def.badge, W / 2 + 10, 520, 23, C.amberL, 'left');
        txt('스테이지 고르기에서 Q로 기술을 바꿔요', W / 2 + 10, 556, 16, '#bdb6e6', 'left', { weight: 600 });
      }
      button(W / 2 - 300, 630, 280, 58, '스테이지 고르기', () => go(() => SelectScene()));
      button(W / 2 + 20, 630, 280, 58, '다시 하기', () => go(() => StageScene(r.id)), { fill: '#d9d2f0' });
    }
  };
}
function drawCardArt(cx, y, w, card, a) {
  const h = w * 1.5, x = cx - w / 2, u = w / 300;
  ctx.save(); ctx.globalAlpha = a == null ? 1 : a;
  if (IMG.card) ctx.drawImage(IMG.card, x, y, w, h);
  else { rr(x, y, w, h, 18 * u); ctx.fillStyle = C.cream; ctx.fill(); ctx.lineWidth = 8 * u; ctx.strokeStyle = C.tealD; ctx.stroke(); }
  txt('제' + card.article + '조', cx, y + h * 0.098, 21 * u, C.tealD, 'center', { weight: 900 });
  txt('제도 카드', cx, y + h * 0.24, 21 * u, C.rust, 'center', { weight: 600 });
  txt(card.name, cx, y + h * 0.35, 56 * u, C.ink, 'center', { weight: 900 });
  txt(card.year, cx, y + h * 0.46, 36 * u, C.tealD, 'center', { weight: 900 });
  wrap(card.text, w * 0.66, 25 * u, 600).forEach((l, i) => txt(l, cx, y + h * 0.565 + i * 34 * u, 25 * u, '#4a3a2c', 'center', { weight: 600 }));
  txt('헌장 제' + card.article + '조의 재료', cx, y + h * 0.78, 19 * u, '#7a5a3a', 'center', { weight: 600 });
  ctx.restore();
}
function drawInstitutionCard(x, y, w, h, card, a) {
  ctx.save(); ctx.globalAlpha = a;
  rr(x, y, w, h, 14); ctx.fillStyle = C.cream; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = C.ink; ctx.stroke();
  rr(x + 8, y + 8, w - 16, h - 16, 10); ctx.lineWidth = 2; ctx.strokeStyle = C.mustard; ctx.stroke();
  txt('제도 카드', x + 22, y + 30, 16, C.rust, 'left');
  txt('헌장 제' + card.article + '조', x + w - 22, y + 30, 16, C.tealD, 'right');
  txt(card.year + ' ' + card.name, x + w / 2, y + h / 2 + 4, Math.min(34, w / 8), C.ink, 'center', { weight: 900 });
  txt(card.text, x + w / 2, y + h - 26, Math.min(18, w / 16), '#5b4a3a', 'center', { weight: 700 });
  ctx.restore();
}

/* ===== 지구 기록 보관소 (덮개 화면) ===== */
function openArchive(onClose) {
  overlay = {
    tab: 1, detail: null, onClose,
    close() { overlay = null; ui.focus = 0; if (onClose) onClose(); },
    update() {
      if (hit('Escape')) { if (this.detail) this.detail = null; else this.close(); return; }
      menuNav();
    },
    draw() {
      modalStart(); dim(0.82);
      panel(30, 24, W - 60, H - 48, { fill: 'rgba(30,26,62,0.98)' });
      txt('지구 기록 보관소', 64, 66, 34, C.tealL, 'left', { weight: 900 });
      txt('여기 있는 기록은 모두 실제 역사예요. 화성 정착촌 이야기는 상상이에요.', 64, 104, 17, '#cfc8f2', 'left', { weight: 600 });
      if (this.detail) { this.drawDetail(); return; }
      const total = D.records.length, got = D.records.filter(r => save.records[r.id]).length;
      txt('모은 기록 ' + got + ' / ' + total, W - 70, 66, 20, C.amberL, 'right');
      [1, 2, 3, 4, 5].forEach((sid, i) => {
        const s = stageById(sid);
        button(64 + i * 160, 130, 150, 42, sid + ' ' + s.movement.replace(' 운동', ''), () => { this.tab = sid; }, { size: 16, fill: this.tab === sid ? C.mustard : '#d9d2f0', r: 12 });
      });
      const recs = D.records.filter(r => r.stage === this.tab);
      if (!recs.length) txt('아직 이 장의 기록이 없어요', W / 2, 380, 24, '#9a93c8', 'center');
      recs.forEach((r, i) => {
        const col = i % 3, row = Math.floor(i / 3);
        const x = 64 + col * 390, y = 192 + row * 150, w = 372, h = 136;
        const has = !!save.records[r.id];
        const st = button(x, y, w, h, '', has ? () => { this.detail = r; } : null, { draw: false, disabled: !has });
        panel(x, y, w, h, { fill: has ? (st.hot ? 'rgba(70,60,130,0.95)' : 'rgba(46,40,92,0.95)') : 'rgba(34,30,66,0.9)', stroke: has ? (st.hot ? C.mustard : 'rgba(255,244,220,0.6)') : 'rgba(255,244,220,0.18)', r: 14 });
        if (has) {
          drawPhotoBox(r, x + 12, y + 12, 150, 112);
          txt(r.year, x + 176, y + 30, 17, C.amberL, 'left');
          para(r.title, x + 176, y + 62, 180, 20, C.cream, 26, { weight: 800 });
        } else {
          txt('???', x + w / 2, y + 56, 34, '#5d5690', 'center', { weight: 900 });
          txt('아직 찾지 못한 기록', x + w / 2, y + 94, 16, '#6f68a3', 'center', { weight: 600 });
        }
      });
      button(W - 230, H - 96, 170, 52, '닫기', () => this.close(), { size: 20 });
    },
    drawDetail() {
      const r = this.detail;
      const img = PHOTO[r.photo];
      if (img) { ctx.fillStyle = '#141228'; rr(64, 140, 600, 450, 12); ctx.fill(); drawContain(img, 70, 146, 588, 438); }
      else drawPhotoBox(r, 64, 140, 600, 450, { r: 12 });
      const x = 700;
      txt(r.year + (r.place ? ' · ' + r.place : ''), x, 160, 20, C.amberL, 'left');
      para(r.title, x, 204, 520, 32, C.cream, 40, { weight: 900 });
      para(r.detail, x, 280, 510, 19, '#e6e0ff', 31, { weight: 600 });
      button(64, H - 96, 170, 52, '◀ 목록', () => { this.detail = null; }, { size: 20 });
      button(W - 230, H - 96, 170, 52, '닫기', () => this.close(), { size: 20 });
    }
  };
  ui.focus = 0;
}

/* =====================================================================
   스테이지 (게임 플레이)
   ===================================================================== */
let G = null;

const ETYPES = {
  drone:  { r: 22, hp: 30,  speed: 90,  xp: 4,  touch: 10 },
  chaser: { r: 16, hp: 18,  speed: 155, xp: 3,  touch: 10 },
  turret: { r: 27, hp: 60,  speed: 0,   xp: 6,  touch: 10 },
  guard:  { r: 32, hp: 150, speed: 45,  xp: 12, touch: 14 }
};
const UPGRADES = [
  { id: 'ally',  name: '동료 드론 +1',  desc: '주위를 도는 작은 드론이 함께 쏜다', max: 4 },
  { id: 'range', name: '공명기 사거리', desc: '공명파가 20% 더 멀리 간다', max: 4 },
  { id: 'rate',  name: '연사 속도',     desc: '공명파를 18% 더 자주 쏜다', max: 5 },
  { id: 'dash',  name: '대시 재충전',   desc: '대시를 18% 더 빨리 다시 쓴다', max: 3 },
  { id: 'hp',    name: '최대 체력',     desc: '최대 체력 +25, 체력도 채운다', max: 4 },
  { id: 'power', name: '공명 위력',     desc: '공명파 피해 +25%', max: 5 },
  { id: 'multi', name: '갈래 공명',     desc: '공명파가 한 갈래 더 나간다', max: 2 },
  { id: 'speed', name: '이동 속도',     desc: '10% 더 빨리 움직인다', max: 3 }
];
const SKILLS = {
  pulse: { cd: 7 },
  march: { cd: 14 }
};
const xpNeed = lv => 20 + (lv - 1) * 18;

function computeStats(up) {
  const n = k => up[k] || 0;
  return {
    maxHp: Math.round((100 + 25 * n('hp')) * (save.difficulty === 'easy' ? 1.5 : 1)),
    fireRate: 3.2 * Math.pow(1.18, n('rate')),
    range: 360 * (1 + 0.2 * n('range')),
    dmg: 10 * (1 + 0.25 * n('power')),
    multi: 1 + n('multi'),
    speed: 245 * (1 + 0.1 * n('speed')),
    dashCd: 1.2 * Math.pow(0.82, n('dash')),
    allies: n('ally')
  };
}

/* ----- 1스테이지 지도 ----- */
function layoutStage1() {
  // 분리선(x=1000)이 A·B 구역을 가른다: 왼쪽 = 넓고 평화로운 '화성 태생' 구역, 오른쪽 = 좁고 어두운 '지구 출신' 구역(주인공 출발)
  const DX = 1000, EX0 = DX + 16, EX1 = 1530;
  const L = {
    w: 1600, h: 3800, start: { x: 1270, y: 3590 },
    arena: { x: 160, y: 0, w: 1280, h: 720 },
    solids: [ { x: 0, y: 0, w: 160, h: 800 }, { x: 1440, y: 0, w: 160, h: 800 }, { x: 160, y: 720, w: 400, h: 80 }, { x: 1040, y: 720, w: 400, h: 80 } ],
    walls: [], gens: [], zones: [], chips: [], caps: [],
    restrict: { wall: 'div', lane: { x0: EX0, x1: EX1, y0: 1812, y1: 3800 } },
    missionWalls: ['wC', 'div', 'wA']
  };
  const wall = (id, x, y, w, h, gens, o) => L.walls.push(Object.assign({ id, x, y, w, h, gens, active: true, fade: 1 }, o || {}));
  const gen = (id, x, y, hp, o) => L.gens.push(Object.assign({ id, x, y, r: 32, hp: hp || 140, maxHp: hp || 140, alive: true, hitT: 0 }, o || {}));
  wall('wC', EX0, 2796, EX1 - EX0, 16, ['g1a', 'g1b']);
  gen('g1a', 1110, 2935, 90); gen('g1b', 1430, 2935, 90);
  wall('div', DX, 1812, 16, 1988, ['g2d'], { divider: true });
  wall('wB', EX0, 1796, EX1 - EX0, 16, ['g2d']);
  gen('g2d', 1270, 1950, 320, { name: '분리선 발생기', big: true });
  wall('wA', 0, 796, 1600, 16, ['g3a', 'g3b']);
  gen('g3a', 330, 935, 120); gen('g3b', 1270, 935, 120);
  wall('gate', 560, 712, 480, 16, [], { active: false, fade: 0, gate: true });
  wall('recgate', 560, 744, 480, 16, [], { recordGate: true, soft: true });
  L.zones = [
    { y0: 2812, y1: 3800, exit: 'wC', check: { x: 1270, y: 3590 }, label: 'A 구역 · 지구 출신 숙소', xr: [EX0 + 40, EX1 - 40],
      pool: ['drone', 'drone', 'chaser'], max: 4, every: 4.0,
      initial: [['drone', 1150, 3280], ['drone', 1420, 3120], ['drone', 1270, 3010], ['chaser', 1450, 3380]] },
    { y0: 1812, y1: 2796, exit: 'wB', check: { x: 1270, y: 2760 }, label: 'B 구역 · 검문소', xr: [EX0 + 40, EX1 - 40],
      pool: ['drone', 'chaser', 'drone'], max: 6, every: 3.2,
      initial: [['turret', 1080, 2060], ['turret', 1460, 2060], ['drone', 1150, 2460], ['drone', 1400, 2330, 'r1_beach'], ['chaser', 1270, 2240]] },
    { y0: 812, y1: 1796, exit: 'wA', check: { x: 800, y: 1740 }, label: 'C 구역 · 관리 구역',
      pool: ['drone', 'chaser', 'drone'], max: 6, every: 3.4,
      initial: [['turret', 210, 1060], ['turret', 1390, 1060], ['guard', 800, 1150, 'r1_nobel'], ['drone', 500, 1400], ['chaser', 1100, 1450]] }
  ];
  // 기록 칩: 지구 출신 구역 2개, 화성 태생 구역 2개(분리선이 꺼져야 갈 수 있다), C 구역 2개
  L.chips = [ ['r1_sign', 1270, 3200], ['r1_king', 1460, 3060], ['r1_civil', 520, 2620], ['r1_vote', 300, 3250], ['r1_apartheid', 230, 1620], ['r1_robben', 1370, 1580] ]
    .map(c => ({ id: c[0], x: c[1], y: c[2], t: Math.random() * 5, got: false }));
  L.caps = [ [1440, 3440, 0], [1100, 2380, 1], [800, 1300, 2] ].map(c => ({ x: c[0], y: c[1], look: LOOKS[c[2]], freed: false, t: Math.random() * 5 }));
  L.bossChip = 'r1_1994';
  [[1110, 3240], [1450, 2620], [1110, 2200], [520, 1200], [1080, 1200], [620, 1610], [980, 1610]]
    .forEach(c => L.solids.push({ x: c[0] - 28, y: c[1] - 28, w: 56, h: 56, crate: true }));
  // 돔 가장자리(바깥은 우주): 걸어 나갈 수 없다
  L.solids.push({ x: 0, y: 800, w: 70, h: 3000, space: true }, { x: 1530, y: 800, w: 70, h: 3000, space: true });
  // 금속 길: 화성 태생 쪽은 넓은 길과 광장, 지구 출신 쪽은 좁은 길
  L.pads = [ { x: 360, y: 1812, w: 300, h: 1988 }, { x: 110, y: 3480, w: 860, h: 300 }, { x: 110, y: 2280, w: 860, h: 220 },
             { x: 1236, y: 1812, w: 68, h: 1988 }, { x: 1050, y: 2870, w: 120, h: 130 }, { x: 1370, y: 2870, w: 120, h: 130 }, { x: 1180, y: 1880, w: 180, h: 140 },
             { x: 660, y: 812, w: 280, h: 984 }, { x: 200, y: 862, w: 1200, h: 150 }, { x: 730, y: 1230, w: 140, h: 140 } ];
  // 유리 거주 돔: 화성 태생 쪽에만
  L.domes = [ { x: 210, y: 3280, r: 70 }, { x: 800, y: 2950, r: 64 }, { x: 200, y: 2080, r: 58 }, { x: 790, y: 2120, r: 60 }, { x: 1420, y: 1250, r: 66 }, { x: 200, y: 1330, r: 58 } ];
  const sl = (stageById(1).slogans || []);
  L.boards = [ { x: 560, y: 3790, text: sl[0] }, { x: 1272, y: 3792, text: sl[1] }, { x: 430, y: 1710, text: sl[2] } ].filter(b => b.text);
  L.laneSigns = [ { x: 520, y: 3420, side: 'left' }, { x: 1272, y: 3330, side: 'right' }, { x: 520, y: 2700, side: 'left' }, { x: 1272, y: 2700, side: 'right' } ];
  L.props = [ { kind: 'solar', x: 820, y: 3640 }, { kind: 'solar', x: 820, y: 3340 }, { kind: 'solar', x: 470, y: 1470 }, { kind: 'solar', x: 1130, y: 1470 },
              { kind: 'plant', x: 160, y: 3560 }, { kind: 'plant', x: 300, y: 3620 }, { kind: 'plant', x: 720, y: 3560 }, { kind: 'plant', x: 160, y: 2400 }, { kind: 'plant', x: 860, y: 2420 }, { kind: 'plant', x: 720, y: 2620 }, { kind: 'plant', x: 160, y: 2800 },
              { kind: 'antenna', x: 300, y: 2950 }, { kind: 'antenna', x: 1250, y: 1660 },
              { kind: 'tank', x: 1480, y: 3700 }, { kind: 'tank', x: 1060, y: 3560 }, { kind: 'tank', x: 1490, y: 2450 }, { kind: 'tank', x: 1000, y: 1150 } ];
  // 화성 태생 주민: 자기 구역을 자유롭게 걸어 다닌다
  L.npcs = [ [300, 3560, 3], [620, 3150, 4], [450, 2780, 0], [700, 2420, 2], [280, 2560, 1] ].map(n => ({ x: n[0], y: n[1], tx: n[0], ty: n[1], look: LOOKS[n[2]], t: Math.random() * 5, wait: Math.random() * 2, moving: false }));
  L.rocks = [];
  let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 160 && L.rocks.length < 56; i++) {
    const x = 90 + rnd() * 1420, y = 830 + rnd() * 2950;
    if (L.pads.some(p => x > p.x - 30 && x < p.x + p.w + 30 && y > p.y - 30 && y < p.y + p.h + 30)) continue;
    if (L.domes.some(d => dist(x, y, d.x, d.y) < d.r + 50) || L.solids.some(s => !s.space && x > s.x - 40 && x < s.x + s.w + 40 && y > s.y - 40 && y < s.y + s.h + 40)) continue;
    if (L.chips.some(c => dist(x, y, c.x, c.y) < 70) || Math.abs(y - 1804) < 40 || Math.abs(y - 2804) < 40 || Math.abs(x - 1008) < 40) continue;
    L.rocks.push({ x, y, kind: rnd() < 0.35 ? 'crater' : 'rock', s: 0.6 + rnd() * 0.9, a: rnd() * TAU });
  }
  return L;
}
const LAYOUTS = { 1: layoutStage1 };

/* ----- 처음 하는 사람을 위한 단계별 안내 (1스테이지 A 구역) ----- */
const touchUI = () => forceTouch || usingTouch || (isTouchDevice && !Object.keys(keys).length);
function nearestOf(list) {
  const P = G.P; let best = null, bd = 1e9;
  list.forEach(o => { const d = dist(P.x, P.y, o.x, o.y); if (d < bd) { bd = d; best = o; } });
  return best;
}
const LAYOUTS_COACH = {
  1: () => {
    const wC = () => wallById('wC');
    const gensC = () => G.gens.filter(g => g.alive && wC().gens.includes(g.id));
    return [
      { title: '먼저 움직여 보세요', sub: () => touchUI() ? '왼쪽 화면을 손가락으로 끌면 움직여요' : 'WASD 또는 방향키로 움직여요', done: c => c.moved > 160 },
      { title: '공명 파동을 써 보세요', sub: () => touchUI() ? "오른쪽 아래 '파동' 버튼: 둘레의 주황 탄을 지우고 드론을 밀어내요" : 'E 키: 둘레의 주황 탄을 지우고 드론을 밀어내요 (7초마다 쓸 수 있어요)',
        done: () => G.skillUsed, skipAfter: 15 },
      { title: '드론에게 다가가 보세요', sub: () => '하얀 공 모양 드론이 오더의 기계예요. 공격은 자동! 가까이 가면 알아서 쏴요', done: () => G.stats.kills >= 1,
        target: () => nearestOf(G.enemies.filter(e => !e.dead)), skipAfter: 15 },
      { title: '발생기를 부수세요', sub: () => '노란 화살표를 따라가요. 발생기 옆에 있으면 자동으로 공격해요', done: () => gensC().length < 2, target: () => nearestOf(gensC()) },
      { title: '남은 발생기도 부수세요', sub: () => '발생기를 모두 부수면 위쪽 레이저 벽이 꺼져요', done: () => !wC().active, target: () => nearestOf(gensC()) },
      { title: '레이저 벽이 꺼졌어요!', sub: () => '위쪽으로 나아가 다음 구역으로 가세요', done: () => G.zoneIdx !== 0, target: () => ({ x: G.P.x, y: 2700 }) }
    ];
  }
};
function updateCoach(dt) {
  const c = G.coach; if (!c) return;
  const P = G.P;
  if (c.lx == null) { c.lx = P.x; c.ly = P.y; }
  c.moved += dist(P.x, P.y, c.lx, c.ly); c.lx = P.x; c.ly = P.y;
  c.st += dt; if (c.flash > 0) c.flash -= dt * 2;
  const step = c.steps[c.step];
  if (step && (step.done(c) || (step.skipAfter && c.st > step.skipAfter))) { c.step++; c.st = 0; c.flash = 1; c.showAt = G.t; }
  if (c.step >= c.steps.length) G.coach = null;
}
// 안내: 화면 가운데에 잠깐 떴다가 저절로 사라진다. 그동안 게임은 멈춘다
function showNotice(title, sub, badge) {
  const len = (title + (sub || '')).length;
  const n = { title, sub: sub || '', badge: badge || '!', t: 0, dur: clamp(1.6 + len * 0.045, 2.4, 4.6) };
  G.noticeQ = G.noticeQ || [];
  G.noticeQ.push(n);
}
function pumpNotice() {
  if (G.mode === 'play' && G.noticeQ && G.noticeQ.length && !G.P.dead) { G.notice = G.noticeQ.shift(); G.mode = 'notice'; }
}
function drawNotice() {
  const n = G.notice; if (!n) return;
  const a = Math.max(0, Math.min(1, n.t * 6, (n.dur - n.t) * 4));
  ctx.save(); ctx.globalAlpha = a;
  dim(0.32);
  const lines = wrap(n.sub, 760, 27, 600), w = 900, h = 120 + lines.length * 38, x = W / 2 - w / 2, y = H / 2 - h / 2 - 30;
  panel(x, y, w, h, { fill: 'rgba(20,17,46,0.96)', stroke: C.mustard, r: 24, lw: 4 });
  ctx.fillStyle = n.badge === '!' ? C.tealL : C.mustard; circle(x + 62, y + 60, 34); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.stroke();
  txt(n.badge, x + 62, y + 61, n.badge.length > 1 ? 22 : 34, C.ink, 'center', { weight: 900 });
  txt(n.title, x + 116, y + 60, 40, C.amberL, 'left', { weight: 900 });
  lines.forEach((l, i) => txt(l, x + 116, y + 112 + i * 38, 27, C.cream, 'left', { weight: 600 }));
  rr(x + 30, y + h - 14, (w - 60) * Math.min(1, n.t / n.dur), 5, 3); ctx.fillStyle = 'rgba(159,245,234,0.7)'; ctx.fill();
  ctx.restore();
}
function showTip(key) {
  // 게임 중 설명 팝업은 쓰지 않는다(설명은 시작 전 「알아 두기」에 모음)
  if (G) return;
  if (G.tipsSeen[key]) return;
  if (G.coach && G.coach.step < 2 && key !== 'wall') return;
  G.tipsSeen[key] = true;
  showNotice(title, sub, '!');
}
function updateTips(dt) {
  const P = G.P;
  if (P.dead) return;
  if (G.gems.some(g => dist(g.x, g.y, P.x, P.y) < 300)) showTip('gem', '청록 조각은 경험치예요', '드론을 물리치면 떨어져요. 가까이 가면 저절로 모이고, 모으면 레벨 업!');
  if (G.chips.some(c => !c.got && dist(c.x, c.y, P.x, P.y) < 280)) showTip('chip', '기록 칩이에요', '주우면 실제 지구 역사 기록을 보여 줘요. 보스와 싸울 때 증거가 돼요');
  if (G.caps.some(c => !c.freed && dist(c.x, c.y, P.x, P.y) < 320)) showTip('cap', '갇힌 정착민이에요', '캡슐에 몸으로 닿으면 구출! 동료가 되어 함께 싸워요');
  if (G.zoneIdx === 1 && G.restricted) showTip('div', '분리선 발생기를 찾아요!', '이걸 부수면 분리선이 꺼지고, 지구 출신에게 걸린 제한도 풀려요');
}

function newRun(stageId) {
  const def = stageById(stageId);
  const L = LAYOUTS[stageId]();
  const up = Object.assign({}, save.upgrades);
  const st = computeStats(up);
  const skills = ['pulse'].concat(save.skills.filter(s => SKILLS[s]));
  G = {
    def, L, up, st, level: save.level, xp: save.xp, pendingLv: 0,
    P: { x: L.start.x, y: L.start.y, r: 17, hp: st.maxHp, aim: -Math.PI / 2, t: 0, moving: false, fireT: 0.4, glow: 0,
         dashT: 0, dashCd: 0, dashDir: { x: 0, y: -1 }, last: { x: 0, y: -1 }, inv: 1, kx: 0, ky: 0, marchT: 0, dead: false, deadT: 0 },
    skills, skillIdx: 0, skillCd: 0,
    enemies: [], pB: [], eB: [], gems: [], parts: [], texts: [], pulses: [], settlers: [], trail: [],
    walls: L.walls, gens: L.gens, zones: L.zones.map(z => Object.assign({ entered: false, spawnT: 2 }, z)), chips: L.chips, caps: L.caps,
    zoneIdx: -1, cam: { x: 0, y: 0 }, shake: 0, mode: 'play', time: 0, t: 0,
    lives: save.difficulty === 'easy' ? Infinity : 3, checkpoint: { x: L.start.x, y: L.start.y },
    stats: { right: 0, wrong: 0, downs: 0, rescued: 0, kills: 0 },
    boss: null, arenaLock: false, banner: null, toasts: [], hintT: 14, introT: 0, clearT: 0, lvT: 0, choices: null,
    hpMul: save.difficulty === 'easy' ? 0.8 : 1
  };
  const P = G.P;
  G.cam.x = clamp(P.x - W / 2, 0, L.w - W); G.cam.y = clamp(P.y - H / 2, 0, L.h - H);
  G.mode = 'brief'; G.briefT = 0; G.tip = null; G.tipsSeen = {};
  G.restricted = !!L.restrict; G.npcs = L.npcs || []; G.freeT = -99;
  G.coach = LAYOUTS_COACH[stageId] && !save.cleared[stageId] ? { step: 0, moved: 0, st: 0, flash: 1, steps: LAYOUTS_COACH[stageId]() } : null;
  return G;
}

function StageScene(stageId) {
  newRun(stageId);
  return { name: 'stage', update: updateStage, draw: drawStage };
}

/* ----- 알림 ----- */
function banner(title, sub, color, dur) { G.banner = { title, sub, color: color || C.cream, t: 0, dur: dur || 2.6 }; }
function addText(x, y, s, color, size) { G.texts.push({ x, y, s, color: color || C.cream, size: size || 18, t: 0 }); }
function burst(x, y, color, n, spd, size) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), v = rand(0.3, 1) * (spd || 220);
    G.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.3, 0.7), t: 0, color, size: rand(2, size || 5) });
  }
}

/* ----- 충돌 ----- */
function pushOutRect(o, x, y, w, h) {
  const cx = clamp(o.x, x, x + w), cy = clamp(o.y, y, y + h);
  const dx = o.x - cx, dy = o.y - cy, d2 = dx * dx + dy * dy;
  if (d2 >= o.r * o.r) return false;
  if (d2 === 0) {
    const l = o.x - x, r = x + w - o.x, t = o.y - y, b = y + h - o.y, m = Math.min(l, r, t, b);
    if (m === l) o.x = x - o.r; else if (m === r) o.x = x + w + o.r; else if (m === t) o.y = y - o.r; else o.y = y + h + o.r;
    return true;
  }
  const d = Math.sqrt(d2);
  o.x = cx + dx / d * o.r; o.y = cy + dy / d * o.r;
  return true;
}
function pushOutCircle(o, x, y, r) {
  const dx = o.x - x, dy = o.y - y, d = Math.hypot(dx, dy), m = r + o.r;
  if (d >= m) return false;
  if (d < 0.001) { o.y = y + m; return true; }
  o.x = x + dx / d * m; o.y = y + dy / d * m;
  return true;
}
function collide(o, isPlayer) {
  let touchedLaser = false;
  for (const s of G.L.solids) pushOutRect(o, s.x, s.y, s.w, s.h);
  for (const d of G.L.domes || []) pushOutCircle(o, d.x, d.y, d.r);
  for (const w of G.walls) if (w.active && pushOutRect(o, w.x, w.y, w.w, w.h) && !w.soft) touchedLaser = true;
  for (const g of G.gens) if (g.alive) pushOutCircle(o, g.x, g.y, g.r);
  if (isPlayer) {
    for (const c of G.caps) if (!c.freed) pushOutCircle(o, c.x, c.y, 24);
    if (G.boss && !G.boss.dead) pushOutCircle(o, G.boss.x, G.boss.y, 86);
  }
  o.x = clamp(o.x, o.r, G.L.w - o.r); o.y = clamp(o.y, o.r, G.L.h - o.r);
  if (G.arenaLock) { const a = G.L.arena; o.x = clamp(o.x, a.x + o.r, a.x + a.w - o.r); o.y = clamp(o.y, a.y + 40, a.y + a.h - o.r - 6); }
  return touchedLaser;
}
function moveBody(o, dx, dy, isPlayer) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 7));
  let laser = false;
  for (let i = 0; i < n; i++) { o.x += dx / n; o.y += dy / n; if (collide(o, isPlayer)) laser = true; }
  return laser;
}
function inRectPad(x, y, w, pad) { return x > w.x - pad && x < w.x + w.w + pad && y > w.y - pad && y < w.y + w.h + pad; }
function segBlocked(x1, y1, x2, y2) {
  for (const w of G.walls) {
    if (!w.active) continue;
    let t0 = 0, t1 = 1;
    const dx = x2 - x1, dy = y2 - y1;
    const p = [-dx, dx, -dy, dy], q = [x1 - w.x, w.x + w.w - x1, y1 - w.y, w.y + w.h - y1];
    let ok = true;
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) { if (q[i] < 0) { ok = false; break; } continue; }
      const r = q[i] / p[i];
      if (p[i] < 0) { if (r > t1) { ok = false; break; } if (r > t0) t0 = r; }
      else { if (r < t0) { ok = false; break; } if (r < t1) t1 = r; }
    }
    if (ok) return true;
  }
  return false;
}
function zoneIndexAt(y) { for (let i = 0; i < G.zones.length; i++) if (y >= G.zones[i].y0 && y < G.zones[i].y1) return i; return -1; }
const wallById = id => G.walls.find(w => w.id === id);

/* ----- 적 ----- */
function spawnEnemy(type, x, y, zone, chip) {
  const T = ETYPES[type];
  const e = { type, x, y, r: T.r, hp: T.hp * G.hpMul, maxHp: T.hp * G.hpMul, speed: T.speed, xp: T.xp, touch: T.touch,
              zone, chip: chip || null, t: rand(0, 10), fireT: rand(1.2, 2.6), flash: 0, vx: 0, vy: 0, strafe: Math.random() < 0.5 ? -1 : 1, spawnT: 0.5, dead: false };
  G.enemies.push(e);
  return e;
}
function enemyShot(x, y, a, spd, r) { G.eB.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, r: r || 8, life: 7 }); }
function damageEnemy(e, dmg) {
  if (e.dead) return;
  e.hp -= dmg; e.flash = 0.08;
  if (e.hp <= 0) killEnemy(e);
}
function killEnemy(e) {
  e.dead = true; G.stats.kills++;
  burst(e.x, e.y, C.amber, 12, 240); burst(e.x, e.y, C.cream, 6, 160);
  const n = Math.max(1, Math.round(e.xp / 3));
  for (let i = 0; i < n; i++) G.gems.push({ x: e.x + rand(-10, 10), y: e.y + rand(-10, 10), v: e.xp / n, t: 0, vx: rand(-60, 60), vy: rand(-60, 60) });
  if (e.chip) { G.chips.push({ id: e.chip, x: e.x, y: e.y, t: 0, got: false }); e.chip = null; }
  Sound.play('hit');
}
function updateEnemy(e, dt) {
  const P = G.P;
  e.t += dt; if (e.flash > 0) e.flash -= dt;
  if (e.spawnT > 0) { e.spawnT -= dt; return; }
  const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy) || 1, nx = dx / d, ny = dy / d;
  const aware = d < 720 && !P.dead;
  let vx = 0, vy = 0;
  if (e.type === 'drone') {
    if (aware) {
      const want = d > 250 ? 1 : d < 170 ? -1 : 0;
      vx = nx * want * e.speed - ny * e.strafe * e.speed * 0.6;
      vy = ny * want * e.speed + nx * e.strafe * e.speed * 0.6;
      if (Math.random() < dt * 0.35) e.strafe *= -1;
      e.fireT -= dt;
      if (e.fireT <= 0 && d < 560) { e.fireT = rand(2.0, 2.8); if (!segBlocked(e.x, e.y, P.x, P.y)) enemyShot(e.x, e.y, Math.atan2(dy, dx), 210); }
    }
  } else if (e.type === 'chaser') {
    if (aware) { const w = Math.sin(e.t * 5) * 0.5; vx = (nx - ny * w) * e.speed; vy = (ny + nx * w) * e.speed; }
  } else if (e.type === 'turret') {
    e.aim = Math.atan2(dy, dx);
    e.fireT -= dt;
    if (aware && e.fireT <= 0 && d < 600) { e.fireT = 2.2; if (!segBlocked(e.x, e.y, P.x, P.y)) for (let k = -1; k <= 1; k++) enemyShot(e.x, e.y, e.aim + k * 0.25, 190); }
  } else if (e.type === 'guard') {
    if (aware) { vx = nx * e.speed; vy = ny * e.speed; }
    e.fireT -= dt;
    if (aware && e.fireT <= 0 && d < 620) { e.fireT = 3.2; for (let k = 0; k < 12; k++) enemyShot(e.x, e.y, k / 12 * TAU + e.t, 150, 8); }
  }
  e.vx = lerp(e.vx, vx, Math.min(1, dt * 4)); e.vy = lerp(e.vy, vy, Math.min(1, dt * 4));
  if (e.speed > 0) {
    moveBody(e, e.vx * dt, e.vy * dt, false);
    const z = G.zones[e.zone];
    if (z) e.y = clamp(e.y, z.y0 + e.r, z.y1 - e.r);
  }
  if (!P.dead && dist(e.x, e.y, P.x, P.y) < e.r + P.r) hurtPlayer(e.touch, e.x, e.y);
}

/* ----- 플레이어 ----- */
const allyBonus = () => 1 + 0.1 * G.settlers.length;
function hurtPlayer(dmg, sx, sy, force) {
  const P = G.P;
  if (P.dead || G.god) return;
  if (!force && (P.inv > 0 || P.dashT > 0 || P.marchT > 0)) return;
  // 연대: 동료가 10초에 한 번씩 대신 막아 준다
  if (!force) {
    const g = G.settlers.find(s => !(s.guardAt > G.t));
    if (g) { g.guardAt = G.t + 10; P.inv = 0.7; addText(g.x, g.y - 50, '막아 줌!', C.tealL, 21); burst(P.x, P.y - 6, C.tealL, 12, 180); Sound.play('ui'); return; }
  }
  P.hp -= dmg; P.inv = 0.9; G.shake = Math.max(G.shake, 7);
  const a = Math.atan2(P.y - sy, P.x - sx);
  P.kx = Math.cos(a) * 280; P.ky = Math.sin(a) * 280;
  addText(P.x, P.y - 40, '-' + dmg, C.hp, 20);
  Sound.play('hit');
  if (P.hp <= 0) playerDown();
}
function playerDown() {
  const P = G.P;
  P.hp = 0; P.dead = true; G.stats.downs++;
  G.eB = []; burst(P.x, P.y, C.tealL, 24, 260); burst(P.x, P.y, C.orange, 12, 200);
  if (save.difficulty !== 'easy') G.lives--;
  // 쓰러지면 게임을 멈추고, 정해진 시간이 지나야 「다시 시작」을 누를 수 있다
  if (save.difficulty !== 'easy' && G.lives <= 0) { G.mode = 'gameover'; ui.focus = 0; return; }
  G.mode = 'down'; G.downT = 0; ui.focus = 0;
}
const reviveSec = () => (typeof D.reviveSeconds === 'number' ? D.reviveSeconds : 10);
function drawDown() {
  modalStart(); dim(0.66);
  const t = G.downT, left = reviveSec() - t, easy = save.difficulty === 'easy';
  panel(W / 2 - 330, 150, 660, 420, { fill: 'rgba(30,16,30,0.96)', stroke: C.red, r: 24, lw: 4 });
  txt('쓰러졌어요!', W / 2, 220, 52, C.cream, 'center', { weight: 900, stroke: C.ink, sw: 8 });
  if (!easy && G.lives === 1) txt('마지막 목숨이에요! 또 쓰러지면 스테이지를 처음부터 해야 해요', W / 2, 318, 21, C.bad, 'center', { weight: 900 });
  txt(easy ? '조금 쉬었다가 그 자리에서 다시 일어나요' : '남은 목숨 ' + G.lives + '개 · 구역 입구에서 다시 시작해요', W / 2, 282, 22, '#ffd0c8', 'center', { weight: 600 });
  const cx = W / 2, cy = 380, r = 58;
  ctx.fillStyle = 'rgba(10,8,30,0.7)'; circle(cx, cy, r); ctx.fill();
  ctx.strokeStyle = C.mustard; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(cx, cy, r - 6, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, t / reviveSec())); ctx.stroke();
  txt(left > 0 ? String(Math.ceil(left)) : '✓', cx, cy + 2, 46, C.cream, 'center', { weight: 900 });
  if (left > 0) txt('잠시 기다려요', W / 2, 484, 20, '#cfc8f2', 'center', { weight: 600 });
  else button(W / 2 - 150, 462, 300, 64, '다시 시작', () => respawn(), { size: 30 });
}
function respawn() {
  const P = G.P;
  if (save.difficulty !== 'easy') { if (G.lives <= 0) { G.mode = 'gameover'; ui.focus = 0; return; } P.x = G.checkpoint.x; P.y = G.checkpoint.y; }
  P.dead = false; P.hp = G.st.maxHp; P.inv = 2.2; P.kx = P.ky = 0;
  G.eB = []; G.mode = 'play';
  if (save.difficulty !== 'easy' && G.lives === 1) banner('마지막 목숨!', '또 쓰러지면 스테이지를 처음부터 해야 해요', C.bad, 4);
  else banner(save.difficulty === 'easy' ? '다시 일어났어요!' : '다시 도전!', save.difficulty === 'easy' ? '' : '남은 목숨 ' + G.lives, C.tealL, 1.6);
}
function findTarget(x, y, range) {
  let best = null, bd = range;
  for (const e of G.enemies) { if (e.dead || e.spawnT > 0) continue; const d = dist(x, y, e.x, e.y) - e.r; if (d < bd && !segBlocked(x, y, e.x, e.y)) { bd = d; best = e; } }
  for (const g of G.gens) { if (!g.alive) continue; const d = dist(x, y, g.x, g.y) - g.r; if (d < bd && !segBlocked(x, y, g.x, g.y)) { bd = d; best = g; } }
  const b = G.boss;
  if (b && !b.dead && b.dying <= 0) { const d = dist(x, y, b.x, b.y) - 70; if (d < bd) { best = b; } }
  return best;
}
function fireWave(x, y, a, dmg, n, kind, range) {
  const spd = 640;
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * 0.16;
    G.pB.push({ x, y, vx: Math.cos(a + off) * spd, vy: Math.sin(a + off) * spd, a: a + off, r: kind === 'p' ? 10 : 7, dmg, life: (range || G.st.range) / spd + 0.05, kind });
  }
}
function useSkill() {
  const id = G.skills[G.skillIdx];
  if (G.skillCd > 0) return;
  const P = G.P;
  G.skillCd = SKILLS[id].cd; G.skillUsed = true;
  if (id === 'pulse') { G.pulses.push({ x: P.x, y: P.y, r: 10, max: 260, hit: new Set() }); G.shake = Math.max(G.shake, 5); }
  if (id === 'march') { P.marchT = 4; banner(D.skills.march.name, '', C.tealL, 1.2); }
  Sound.play('good');
}
function gainXp(v) {
  G.xp += v;
  while (G.xp >= xpNeed(G.level)) { G.xp -= xpNeed(G.level); G.level++; G.pendingLv++; }
}
function openLevelUp() {
  const avail = UPGRADES.filter(u => (G.up[u.id] || 0) < u.max);
  G.choices = shuffle(avail).slice(0, 3);
  G.mode = 'levelup'; G.lvT = 0; ui.focus = 0;
  Sound.play('level');
}
function chooseUpgrade(u) {
  G.up[u.id] = (G.up[u.id] || 0) + 1;
  const oldMax = G.st.maxHp;
  G.st = computeStats(G.up);
  if (u.id === 'hp') G.P.hp = Math.min(G.st.maxHp, G.P.hp + (G.st.maxHp - oldMax) + 25);
  G.pendingLv--;
  G.mode = 'play';
  addText(G.P.x, G.P.y - 50, u.name, C.mustard, 22);
}
function collectRecord(id) {
  const rec = recordById(id);
  if (!rec) return;
  const fresh = !save.records[id];
  save.records[id] = true; writeSave();
  gainXp(fresh ? 15 : 5);
  Sound.play('pick');
  // 플레이 중이면 게임을 잠깐 멈추고 기록 카드를 보여 준다. '모으기'를 누르면 다시 시작
  if (G.mode === 'play') { G.recQueue = (G.recQueue || []).concat([{ rec, fresh }]); if (!G.recView) openRecord(); }
  else G.toasts.push({ rec, t: 0, fresh });
}
function openRecord() { const q = G.recQueue.shift(); G.recView = q.rec; G.recFresh = q.fresh; G.recT = 0; G.mode = 'record'; ui.focus = 0; }
const readSec = () => (typeof D.recordReadSeconds === 'number' ? D.recordReadSeconds : 5);
function closeRecord() {
  if (G.recT < readSec()) return;
  if (G.recQueue && G.recQueue.length) { openRecord(); return; }
  G.recView = null; G.mode = 'play'; G.P.inv = Math.max(G.P.inv, 0.6);
}

/* ----- 보스 ----- */
const BOSS_POOLS = [['spread', 'ring'], ['spread', 'ring', 'split'], ['ring', 'split', 'sweep', 'spread'], ['split', 'sweep', 'ring', 'spread']];
function startBoss() {
  const gate = G.walls.find(w => w.gate); gate.active = true; gate.fade = 1;
  G.arenaLock = true; G.checkpoint = { x: 800, y: 620 }; G.cam.x = G.L.arena.x; G.cam.y = G.L.arena.y;
  G.enemies.forEach(e => { if (!e.dead) { e.dead = true; burst(e.x, e.y, C.amber, 6, 150); } });
  G.eB = [];
  const hp = 4000 * G.hpMul;
  G.boss = { def: G.def.boss, x: 800, y: 290, hp, maxHp: hp, round: 0, shield: true, stun: 0, t: 0, pat: null, patT: 2.2,
             orbs: [], orbT: 1.6, orbsUp: false, dying: 0, dead: false, flash: 0, lasers: [], breakT: 0 };
  G.mode = 'bossIntro'; G.introT = 0;
}
function bossThreshold(b) { return b.maxHp * (1 - (b.round + 1) / b.def.rounds.length); }
function damageBoss(dmg, x, y) {
  const b = G.boss;
  if (!b || b.dead || b.dying > 0) return;
  if (b.shield) { if (Math.random() < 0.35) burst(x, y, C.amber, 2, 120, 3); return; }
  b.hp -= dmg; b.flash = 0.06;
  const th = bossThreshold(b);
  if (b.hp <= th) {
    if (b.round >= b.def.rounds.length - 1) { b.hp = 0; b.dying = 2.6; b.lasers = []; b.pat = null; b.orbs = []; G.eB = []; G.shake = 16; Sound.play('boom'); return; }
    b.hp = th; b.round++; b.shield = true; b.orbsUp = false; b.orbT = 1.6; b.pat = null; b.patT = 1.4; b.lasers = [];
    G.shake = 10; burst(b.x, b.y, C.amber, 20, 260);
  }
}
function spawnOrbs(b) {
  const rd = b.def.rounds[b.round], a = G.L.arena, placed = [];
  shuffle(rd.options).forEach(opt => {
    let x, y, tries = 0;
    do { x = rand(a.x + 140, a.x + a.w - 140); y = rand(470, 640); tries++; }
    while (tries < 40 && (placed.some(p => dist(p.x, p.y, x, y) < 260) || dist(x, y, G.P.x, G.P.y) < 190));
    placed.push({ x, y });
    const ang = rand(0, TAU);
    b.orbs.push({ opt, x, y, vx: Math.cos(ang) * 38, vy: Math.sin(ang) * 38, r: 46, t: rand(0, 5), born: 0 });
  });
  b.orbsUp = true;
  // 라운드마다 주장을 크게 보여 주고 멈춘다. 「반박하러 가기」를 누르면 다시 시작
  G.mode = 'claim'; G.claimT = 0; G.eB = []; ui.focus = 0;
}
function endRebutCard() { if (G.mode !== 'rebut' || G.rebutT < 1) return; G.mode = 'play'; G.P.inv = Math.max(G.P.inv, 1); }
function drawRebutCard() {
  modalStart(); dim(0.7);
  const r = G.rebut, t = G.rebutT, pop = Math.min(1, t * 5);
  const gl = wrap(r.opt.good || '', 560, 40, 900);
  const w = 980, x = W / 2 - w / 2, rowH = Math.max(300, gl.length * 52 + 90), h = 150 + rowH + 100, y = H / 2 - h / 2;
  ctx.save(); ctx.globalAlpha = pop;
  panel(x, y, w, h, { fill: 'rgba(16,40,38,0.97)', stroke: C.good, r: 26, lw: 5 });
  const sc = 1 + Math.max(0, 0.3 - t) * 1.5;
  ctx.save(); ctx.translate(W / 2, y + 62); ctx.scale(sc, sc); txt('반박 성공!', 0, 0, 66, C.good, 'center', { weight: 900, stroke: C.ink, sw: 10 }); ctx.restore();
  const cl = '「' + r.claim + '」';
  setFont(26, 600); const cw = Math.min(ctx.measureText(cl).width, w - 80);
  txt(cl, W / 2, y + 126, 26, '#c9c2ef', 'center', { weight: 600 });
  ctx.strokeStyle = C.bad; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(W / 2 - cw / 2 - 6, y + 128); ctx.lineTo(W / 2 + cw / 2 + 6, y + 128); ctx.stroke();
  const cx = x + 190, cy = y + 150 + rowH / 2 - 26, rad = 118;
  ctx.save(); circle(cx, cy, rad); ctx.clip();
  const img = photoOf(r.opt);
  if (img) drawCover(img, cx - rad, cy - rad, rad * 2, rad * 2);
  else { ctx.fillStyle = '#3b3570'; ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2); const rec = r.opt.record && recordById(r.opt.record); txt(rec ? rec.year : '기록', cx, cy, 40, C.amberL, 'center', { weight: 900 }); }
  ctx.restore();
  ctx.lineWidth = 6; ctx.strokeStyle = C.good; circle(cx, cy, rad); ctx.stroke();
  txt('증거 · ' + r.opt.label, cx, cy + rad + 32, 26, C.cream, 'center', { weight: 900 });
  const tx = x + 380, ty = y + 150 + rowH / 2 - (gl.length * 52 + 60) / 2 + 20;
  gl.forEach((l, i) => txt(l, tx, ty + i * 52, 40, C.cream, 'left', { weight: 900 }));
  txt('방어막이 깨졌어요! 지금 보스를 공격하세요', tx, ty + gl.length * 52 + 26, 26, C.tealL, 'left', { weight: 600 });
  ctx.restore();
  if (t > 1) button(W / 2 - 170, y + h - 86, 340, 64, '공격하러 가기!', () => endRebutCard(), { size: 30 });
}
function startRebut() { if (G.mode !== 'claim' || G.claimT < 2.6) return; G.mode = 'play'; G.P.inv = Math.max(G.P.inv, 1); }
function drawClaimCard() {
  modalStart(); dim(0.78);
  const b = G.boss, rd = b.def.rounds[b.round], t = G.claimT;
  const slam = Math.min(1, t * 4), shake = t < 0.45 ? (0.45 - t) * 18 : 0;
  ctx.save(); ctx.translate(rand(-shake, shake), rand(-shake, shake));
  // 1단계: 보스 그림과 주장만 크게
  if (IMG[b.def.img]) { ctx.globalAlpha = slam; drawContain(IMG[b.def.img], 70, 120, 300, 330); ctx.globalAlpha = 1; }
  rr(400, 66, 300, 52, 26); ctx.fillStyle = C.red; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.stroke();
  txt(b.def.name + '의 주장', 550, 93, 28, C.cream, 'center', { weight: 900 });
  const ql = wrap('「' + rd.claim + '」', 760, 60, 900);
  const bh = ql.length * 76 + 70, by = 140;
  ctx.save(); ctx.translate(780, by + bh / 2); const sc = 0.6 + 0.4 * slam + (t < 0.35 ? (0.35 - t) * 0.6 : 0); ctx.scale(sc, sc); ctx.translate(-780, -(by + bh / 2));
  rr(380, by, 820, bh, 30); ctx.fillStyle = 'rgba(40,14,24,0.97)'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = C.red; ctx.stroke();
  ctx.fillStyle = 'rgba(40,14,24,0.97)'; ctx.beginPath(); ctx.moveTo(384, by + bh * 0.55); ctx.lineTo(350, by + bh * 0.7); ctx.lineTo(384, by + bh * 0.75); ctx.closePath(); ctx.fill();
  ql.forEach((l, i) => txt(l, 790, by + 72 + i * 76, 60, C.amberL, 'center', { weight: 900, stroke: C.ink, sw: 8 }));
  ctx.restore();
  ctx.restore();
  // 2단계(2초 뒤): 아래쪽 작은 띠에 할 일과 증거
  const p2 = Math.min(1, Math.max(0, (t - 2) * 3));
  if (p2 > 0) {
    ctx.save(); ctx.globalAlpha = p2; ctx.translate(0, (1 - p2) * 40);
    const y2 = 480;
    rr(120, y2, W - 240, 150, 22); ctx.fillStyle = 'rgba(24,21,54,0.95)'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,244,220,0.5)'; ctx.stroke();
    txt('이 주장이 틀렸다는 증거 구슬에 몸으로 닿으세요   (틀린 구슬은 반격!)', W / 2, y2 + 30, 21, C.cream, 'center', { weight: 600 });
    const opts = b.orbs.map(o => o.opt);
    opts.forEach((o, i) => {
      const cx = W / 2 + (i - (opts.length - 1) / 2) * 300 - 50, cy = y2 + 92;
      ctx.save(); circle(cx, cy, 30); ctx.clip();
      const img = photoOf(o);
      if (img) drawCover(img, cx - 30, cy - 30, 60, 60);
      else { ctx.fillStyle = '#3b3570'; ctx.fillRect(cx - 30, cy - 30, 60, 60); ctx.fillStyle = C.cream; ctx.strokeStyle = C.ink; ctx.lineWidth = 2; rr(cx - 9, cy - 12, 18, 23, 3); ctx.fill(); ctx.stroke(); }
      ctx.restore();
      ctx.lineWidth = 3; ctx.strokeStyle = C.cream; circle(cx, cy, 30); ctx.stroke();
      txt(o.label, cx + 40, cy, 20, C.cream, 'left', { weight: 900 });
    });
    ctx.restore();
  }
  if (t > 2.6) button(W / 2 - 160, 646, 320, 60, '반박하러 가기!', () => startRebut(), { size: 28 });
}
function resolveOrb(b, orb) {
  const o = orb.opt, P = G.P;
  if (o.correct) {
    G.stats.right++;
    b.shield = false; b.orbs = []; b.breakT = 0.7;
    b.hp -= b.maxHp * 0.1; b.flash = 0.2;
    b.stun = 1.8; b.pat = null; b.lasers = []; G.eB = [];
    G.shake = 14; burst(b.x, b.y, C.tealL, 30, 340); burst(orb.x, orb.y, C.mustard, 20, 260);
    gainXp(30);
    G.rebut = { opt: o, claim: b.def.rounds[b.round].claim }; G.rebutT = 0; G.mode = 'rebut'; ui.focus = 0;
    Sound.play('good');
  } else {
    G.stats.wrong++;
    b.orbs = b.orbs.filter(x => x !== orb);
    burst(orb.x, orb.y, C.bad, 20, 260);
    P.inv = 0;
    hurtPlayer(10, orb.x, orb.y, true);
    for (let k = 0; k < 6; k++) enemyShot(orb.x, orb.y, k / 6 * TAU, 100, 7);
    P.inv = 1.0;
    banner('반박 실패!', o.why || '', C.bad, 5.5);
    Sound.play('bad');
  }
}
function updateBoss(dt) {
  const b = G.boss, P = G.P, a = G.L.arena;
  b.t += dt; if (b.flash > 0) b.flash -= dt; if (b.breakT > 0) b.breakT -= dt;
  if (b.dying > 0) {
    b.dying -= dt;
    if (Math.random() < dt * 14) burst(b.x + rand(-90, 90), b.y + rand(-110, 90), pick([C.amber, C.cream, C.tealL]), 10, 260);
    G.shake = Math.max(G.shake, 4);
    if (b.dying <= 0) { b.dead = true; burst(b.x, b.y, C.mustard, 60, 420); stageClear(); }
    return;
  }
  const mul = 1 + 0.12 * b.round;
  b.x = 800 + Math.sin(b.t * 0.45) * 300;
  if (b.shield && !b.orbsUp) { b.orbT -= dt; if (b.orbT <= 0) spawnOrbs(b); }
  for (const o of b.orbs) {
    o.t += dt; o.born += dt;
    o.x += o.vx * dt; o.y += o.vy * dt;
    if (o.x < a.x + o.r + 20 || o.x > a.x + a.w - o.r - 20) { o.vx *= -1; o.x = clamp(o.x, a.x + o.r + 20, a.x + a.w - o.r - 20); }
    if (o.y < 465 || o.y > a.h - o.r - 34) { o.vy *= -1; o.y = clamp(o.y, 465, a.h - o.r - 34); }
  }
  if (!P.dead) for (const o of b.orbs.slice()) if (o.born > 0.45 && dist(o.x, o.y, P.x, P.y) < o.r + P.r) { resolveOrb(b, o); break; }
  if (b.stun > 0) { b.stun -= dt; return; }
  if (!b.pat) {
    b.patT -= dt;
    if (b.patT <= 0) b.pat = { kind: pick(BOSS_POOLS[b.round]), t: 0, n: 0, gap: rand(a.x + 170, a.x + a.w - 170) };
  } else {
    const p = b.pat; p.t += dt;
    const cool = () => { b.pat = null; b.lasers = []; b.patT = (b.shield ? 1.3 : 0.9) / Math.sqrt(mul); };
    if (p.kind === 'spread') {
      if (p.n < 3 && p.t >= p.n * 0.45) { const aa = Math.atan2(P.y - b.y, P.x - b.x); for (let k = -2; k <= 2; k++) enemyShot(b.x, b.y + 40, aa + k * 0.22, 225 * mul); p.n++; }
      if (p.t > 1.5) cool();
    } else if (p.kind === 'ring') {
      if (p.n < 3 && p.t >= p.n * 0.6) { const cnt = 18; for (let k = 0; k < cnt; k++) enemyShot(b.x, b.y + 20, k / cnt * TAU + p.n * 0.17, 150 * mul); p.n++; }
      if (p.t > 1.9) cool();
    } else if (p.kind === 'split') {
      const warn = p.t < 1.0;
      b.lasers = [{ kind: 'v', x: b.x, warn }];
      if (!warn && !P.dead && P.y > b.y + 60 && Math.abs(P.x - b.x) < 16 + P.r * 0.7) hurtPlayer(15, b.x, P.y);
      if (p.t > 3.4) cool();
    } else if (p.kind === 'sweep') {
      const warn = p.t < 0.9;
      const sy = warn ? 440 : 440 + (p.t - 0.9) / 3.0 * (a.h - 440);
      b.lasers = [{ kind: 'h', y: sy, gap: p.gap, warn }];
      if (!warn && !P.dead && Math.abs(P.y - sy) < 10 + P.r * 0.7 && Math.abs(P.x - p.gap) > 95) hurtPlayer(15, P.x, sy - 20);
      if (p.t > 3.9) cool();
    }
  }
}
function stageClear() {
  G.mode = 'clear'; G.clearT = 0; ui.focus = 0;
  if (G.L.bossChip) { G.bossRecFresh = !save.records[G.L.bossChip]; save.records[G.L.bossChip] = true; G.bossRec = recordById(G.L.bossChip); }
  G.clearStep = G.def.change ? 0 : 1;
  const d = G.def, s = save;
  s.cleared[d.id] = true;
  if (d.card) s.cards[d.card.id] = true;
  if (d.skill && !s.skills.includes(d.skill)) s.skills.push(d.skill);
  if (d.badge && !s.badges.includes(d.badge)) s.badges.push(d.badge);
  s.level = G.level; s.xp = G.xp; s.upgrades = Object.assign({}, G.up);
  s.evidence.right += G.stats.right; s.evidence.wrong += G.stats.wrong;
  const prev = s.stageStats[d.id];
  if (!prev || G.time < prev.time) s.stageStats[d.id] = { time: G.time, right: G.stats.right, wrong: G.stats.wrong };
  writeSave();
}
function resultData() {
  const recs = D.records.filter(r => r.stage === G.def.id);
  return { id: G.def.id, name: G.def.name, time: G.time, chips: recs.filter(r => save.records[r.id]).length, chipTotal: recs.length,
           right: G.stats.right, wrong: G.stats.wrong, level: G.level, rescued: G.stats.rescued };
}

/* ----- 매 프레임 ----- */
function updateStage(dt) {
  G.t += dt;
  if (hit('Escape') || hit('KeyP')) {
    if (G.mode === 'play') { G.mode = 'pause'; ui.focus = 0; return; }
    if (G.mode === 'pause') { G.mode = 'play'; return; }
  }
  if (G.mode === 'brief') {
    G.briefT += dt;
    if (G.briefT > 0.5 && (hit('Enter') || hit('Space') || hit('NumpadEnter'))) openRules();
  } else if (G.mode === 'rules') {
    G.rulesT += dt;
    if (G.rulesT >= rulesSec() && (hit('Enter') || hit('Space') || hit('NumpadEnter'))) startPlay();
  } else if (G.mode === 'play') { updatePlay(dt); pumpNotice(); }
  else if (G.mode === 'notice') { G.notice.t += dt; if (G.notice.t >= G.notice.dur || (G.notice.t > 1 && (taps.length || hit('Enter')))) { G.notice = null; G.mode = 'play'; } }
  else if (G.mode === 'bossIntro') {
    G.introT += dt; updateFx(dt);
    if (G.introT > 0.7 && (hit('Enter') || hit('Space') || taps.length)) { G.mode = 'play'; G.tip = null; }
  } else if (G.mode === 'levelup') {
    G.lvT += dt;
    if (G.lvT > 0.45) {
      ['Digit1', 'Digit2', 'Digit3'].forEach((k, i) => { if (hit(k) && G.choices[i]) chooseUpgrade(G.choices[i]); });
      if (G.mode === 'levelup') menuNav();
    }
  } else if (G.mode === 'record') { G.recT += dt; if (G.recT >= readSec()) menuNav(); }
  else if (G.mode === 'claim') { G.claimT += dt; if (G.claimT < 2 && G.claimT > 0.6 && (hit('Enter') || hit('Space') || taps.length)) G.claimT = 2; else if (G.claimT > 2.6) menuNav(); }
  else if (G.mode === 'rebut') { G.rebutT += dt; if (G.rebutT > 1) menuNav(); }
  else if (G.mode === 'down') { G.downT += dt; updateFx(dt); if (G.downT >= reviveSec()) menuNav(); }
  else if (G.mode === 'clear') { G.clearT += dt; updateFx(dt); if (G.clearT > (G.clearStep === 0 ? 2 : 1.2)) menuNav(); }
  else if (G.mode === 'pause' || G.mode === 'gameover') menuNav();
  touchAct.dash = touchAct.skill = touchAct.swap = false;
}
const rulesSec = () => (typeof D.rulesReadSeconds === 'number' ? D.rulesReadSeconds : 10);
function openRules() { if (G.mode !== 'brief' || G.briefT < 0.5) return; G.mode = 'rules'; G.rulesT = 0; ui.focus = 0; }
function startPlay() {
  if (G.mode !== 'rules' || G.rulesT < rulesSec()) return;
  G.mode = 'play';
  if (G.coach) G.coach.showAt = G.t;
  banner('STAGE ' + G.def.id + ' · ' + G.def.name, '', C.mustard, 2.2);
}
function drawRules() {
  modalStart(); dim(0.8);
  const t = G.rulesT, left = rulesSec() - t;
  panel(40, 22, W - 80, H - 44, { fill: 'rgba(24,21,54,0.98)', r: 24 });
  txt('시작 전에 알아 두기', W / 2, 70, 42, C.mustard, 'center', { weight: 900, stroke: C.ink, sw: 6 });
  const tch = touchUI();
  const items = [
    { k: 'move', n: '이동', d: tch ? '왼쪽 화면을 손가락으로 끌어요' : 'WASD 또는 방향키' },
    { k: 'shoot', n: '공격은 자동', d: '가까운 적과 발생기를 알아서 쏴요' },
    { k: 'pulse', n: '공명 파동', d: (tch ? "'파동' 버튼" : 'E 키') + ': 둘레의 주황 탄을 지우고 드론을 밀어내요 (7초마다)' },
    { k: 'dash', n: '대시', d: (tch ? '대시 버튼' : 'Shift·Space') + ': 짧게 빨리 움직이고, 그동안 탄에 맞지 않아요' }
  ];
  if (G.L.restrict) items.push({ k: 'earth', n: '나는 지구 출신', d: '처음엔 좁은 구역에서 느리고 대시 금지. 분리선을 끄면 풀려요' });
  items.push({ k: 'gem', n: '청록 조각 = 경험치', d: '드론이 떨어뜨려요. 모으면 레벨 업, 강화를 골라요' });
  items.push({ k: 'chip', n: '기록 칩', d: '실제 지구 역사 기록. 모두 모아야 보스 문이 열려요' });
  items.push({ k: 'ally', n: '정착민 = 동료', d: '캡슐에 닿아 구하면 같이 쏘고, 공격 +10%, 대신 막아 줘요' });
  items.forEach((it, i) => {
    const col = i % 2, row = Math.floor(i / 2), x = 70 + col * 576, y = 106 + row * 120, w = 560, h = 108;
    rr(x, y, w, h, 16); ctx.fillStyle = 'rgba(46,40,92,0.95)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,244,220,0.35)'; ctx.stroke();
    ctx.save(); circle(x + 56, y + h / 2, 42); ctx.fillStyle = '#2a2550'; ctx.fill(); ctx.clip(); drawRuleIcon(it.k, x + 56, y + h / 2); ctx.restore();
    txt(it.n, x + 112, y + 34, 26, C.amberL, 'left', { weight: 900 });
    para(it.d, x + 112, y + 70, w - 128, 20, C.cream, 26, { weight: 600 });
  });
  const by = 106 + Math.ceil(items.length / 2) * 120 + 8;
  if (left > 0) {
    button(W / 2 - 170, by, 340, 64, '게임 시작하기 (' + Math.ceil(left) + ')', null, { size: 28, disabled: true });
    rr(W / 2 - 154, by + 52, 308 * Math.min(1, t / rulesSec()), 6, 3); ctx.fillStyle = C.tealL; ctx.fill();
  } else button(W / 2 - 170, by, 340, 64, '게임 시작하기!', () => startPlay(), { size: 30 });
}
function drawRuleIcon(k, x, y) {
  const t = G.t;
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (k === 'move') {
    const keyb = (kx, ky, l) => { rr(kx - 13, ky - 13, 26, 26, 6); ctx.fillStyle = C.cream; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = C.ink; ctx.stroke(); txt(l, kx, ky + 1, 15, C.ink, 'center', { weight: 900 }); };
    keyb(x, y - 15, 'W'); keyb(x - 28, y + 14, 'A'); keyb(x, y + 14, 'S'); keyb(x + 28, y + 14, 'D');
  } else if (k === 'shoot') { drawHeroAt(x - 12, y + 14, 0, t, false, 1, { noShadow: true }); ctx.strokeStyle = C.tealL; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x + 22, y - 6, 8, -0.8, 0.8); ctx.stroke(); ctx.beginPath(); ctx.arc(x + 32, y - 6, 8, -0.8, 0.8); ctx.stroke(); }
  else if (k === 'pulse') { ctx.strokeStyle = C.tealL; ctx.lineWidth = 4; circle(x, y, 14 + (t * 20) % 22); ctx.stroke(); ctx.lineWidth = 2; circle(x, y, 32); ctx.stroke(); ctx.fillStyle = C.orange; circle(x + 24, y - 20, 5); ctx.fill(); circle(x - 26, y + 18, 5); ctx.fill(); }
  else if (k === 'dash') { ctx.fillStyle = C.mustard; ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x - 22, y - 14); ctx.lineTo(x + 2, y); ctx.lineTo(x - 22, y + 14); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - 2, y - 14); ctx.lineTo(x + 22, y); ctx.lineTo(x - 2, y + 14); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  else if (k === 'earth') { ctx.fillStyle = '#6cc0ff'; circle(x, y, 22); ctx.fill(); ctx.fillStyle = '#5fb07a'; circle(x - 7, y - 5, 9); ctx.fill(); circle(x + 9, y + 8, 7); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = C.ink; circle(x, y, 22); ctx.stroke(); }
  else if (k === 'gem') { [[-14, 6], [6, -10], [14, 12]].forEach(([dx, dy]) => { ctx.save(); ctx.translate(x + dx, y + dy); ctx.rotate(t * 2); ctx.fillStyle = C.tealL; ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(7, 0); ctx.lineTo(0, 9); ctx.lineTo(-7, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }); }
  else if (k === 'chip') drawChipIcon(x, y, 1.4, t);
  else if (k === 'ally') { drawChibi(x - 12, y + 14, t, false, 0, LOOKS[0], { noShadow: true, noPack: true }); drawChibi(x + 14, y + 16, t, false, 0, LOOKS[2], { noShadow: true, noPack: true, scale: 0.9 }); }
  ctx.restore();
}
function updatePlay(dt) {
  const P = G.P, st = G.st, L = G.L;
  G.time += dt; P.t += dt;
  if (G.hintT > 0) G.hintT -= dt;
  // 입력
  let mx = 0, my = 0;
  if (keys.KeyA || keys.ArrowLeft) mx -= 1;
  if (keys.KeyD || keys.ArrowRight) mx += 1;
  if (keys.KeyW || keys.ArrowUp) my -= 1;
  if (keys.KeyS || keys.ArrowDown) my += 1;
  if (joy) { const dx = joy.x - joy.ox, dy = joy.y - joy.oy, d = Math.hypot(dx, dy); if (d > 8) { const m = Math.min(1, d / 60); mx += dx / d * m; my += dy / d * m; } }
  const ml = Math.hypot(mx, my);
  if (ml > 1) { mx /= ml; my /= ml; }
  P.moving = ml > 0.1 && !P.dead;
  if (P.moving) P.last = { x: mx / Math.max(ml, 0.001), y: my / Math.max(ml, 0.001) };
  if (P.dead) {
    // 쓰러진 동안은 'down' 화면이 맡는다
  } else {
    const dashPressed = hit('ShiftLeft') || hit('ShiftRight') || hit('Space') || touchAct.dash;
    if (dashPressed && G.restricted) { if (G.t - (G.dashWarnT || -9) > 1.2) { G.dashWarnT = G.t; addText(P.x, P.y - 64, '대시 금지 · 지구 출신', C.bad, 19); } }
    else if (dashPressed && P.dashCd <= 0) {
      P.dashT = 0.18; P.dashCd = st.dashCd; P.dashDir = P.moving ? { x: P.last.x, y: P.last.y } : { x: Math.cos(P.aim), y: Math.sin(P.aim) };
      burst(P.x, P.y, C.tealL, 8, 160, 4);
    }
    if (hit('KeyE') || touchAct.skill) useSkill();
    if (hit('Tab')) { G.missionPinned = !G.missionPinned; if (!G.missionPinned) G.missionAt = -99; }
    if ((hit('KeyQ') || touchAct.swap) && G.skills.length > 1) { G.skillIdx = (G.skillIdx + 1) % G.skills.length; addText(P.x, P.y - 50, D.skills[G.skills[G.skillIdx]].name, C.tealL, 18); }
    let spd = st.speed * (P.marchT > 0 ? 1.25 : 1) * (G.restricted ? 0.72 : 1);
    let vx = mx * spd, vy = my * spd;
    if (P.dashT > 0) { P.dashT -= dt; vx = P.dashDir.x * spd * 3.2; vy = P.dashDir.y * spd * 3.2; if (Math.random() < 0.6) G.parts.push({ x: P.x, y: P.y, vx: 0, vy: 0, life: 0.25, t: 0, color: 'rgba(159,245,234,0.8)', size: 9 }); }
    vx += P.kx; vy += P.ky; P.kx *= Math.pow(0.0008, dt); P.ky *= Math.pow(0.0008, dt);
    if (moveBody(P, vx * dt, vy * dt, true)) { hurtPlayer(8, P.x, P.y + (P.y > G.cam.y + H / 2 ? 30 : -30)); showTip('wall', '레이저 벽은 닿으면 아파요', '발생기를 모두 부수면 꺼져요. 노란 화살표를 따라가요'); }
  }
  if (P.dashCd > 0) P.dashCd -= dt;
  if (P.inv > 0) P.inv -= dt;
  if (P.marchT > 0) P.marchT -= dt;
  if (G.skillCd > 0) G.skillCd -= dt;
  // 자동 발사
  P.fireT -= dt; if (P.glow > 0) P.glow -= dt * 3;
  const target = P.dead ? null : findTarget(P.x, P.y, st.range);
  if (target) P.aim = Math.atan2(target.y - P.y, target.x - P.x); else if (P.moving) P.aim = Math.atan2(my, mx);
  if (target && P.fireT <= 0) { P.fireT = 1 / st.fireRate; fireWave(P.x + Math.cos(P.aim) * 18, P.y - 4 + Math.sin(P.aim) * 18, P.aim, st.dmg * allyBonus(), st.multi, 'p'); P.glow = 1; }
  // 연대: 구출한 정착민과 동료 드론
  G.trailT = (G.trailT || 0) - dt;
  if (G.trailT <= 0) { G.trailT = 0.05; G.trail.push({ x: P.x, y: P.y }); if (G.trail.length > 120) G.trail.shift(); }
  G.settlers.forEach((s, i) => {
    const tp = G.trail[Math.max(0, G.trail.length - 1 - (i + 1) * 6)] || P;
    const ang = (i + 1) * 1.9;
    const tx = tp.x + Math.cos(ang) * 18, ty = tp.y + Math.sin(ang) * 12;
    s.moving = dist(s.x, s.y, tx, ty) > 6;
    s.x = lerp(s.x, tx, Math.min(1, dt * 6)); s.y = lerp(s.y, ty, Math.min(1, dt * 6)); s.t += dt;
    s.fireT -= dt;
    const tg = findTarget(s.x, s.y, 320);
    if (tg) s.aim = Math.atan2(tg.y - s.y, tg.x - s.x);
    if (tg && s.fireT <= 0 && !P.dead) { s.fireT = 0.7; fireWave(s.x, s.y - 6, s.aim, st.dmg * 0.75, 1, 's', 340); }
  });
  G.allyT = (G.allyT || 0) - dt;
  if (st.allies > 0 && G.allyT <= 0 && !P.dead) {
    G.allyT = 0.9 / st.allies;
    const k = Math.floor(G.t * 7) % st.allies, a = G.t * 2.2 + k / st.allies * TAU;
    const ax = P.x + Math.cos(a) * 46, ay = P.y - 6 + Math.sin(a) * 30;
    const tg = findTarget(ax, ay, 330);
    if (tg) fireWave(ax, ay, Math.atan2(tg.y - ay, tg.x - ax), st.dmg * 0.45, 1, 'a', 330);
  }
  // 적
  for (const e of G.enemies) if (!e.dead) updateEnemy(e, dt);
  for (let i = 0; i < G.enemies.length; i++) {
    const a = G.enemies[i]; if (a.dead || a.speed === 0) continue;
    for (let j = i + 1; j < G.enemies.length; j++) {
      const b = G.enemies[j]; if (b.dead) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = a.r + b.r;
      if (d < m && d > 0.01) { const push = (m - d) / 2; a.x -= dx / d * push; a.y -= dy / d * push; if (b.speed > 0) { b.x += dx / d * push; b.y += dy / d * push; } }
    }
  }
  G.enemies = G.enemies.filter(e => !e.dead);
  // 내 탄
  for (const b of G.pB) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0) continue;
    if (G.walls.some(w => w.active && inRectPad(b.x, b.y, w, 4)) || G.L.solids.some(s => inRectPad(b.x, b.y, s, 0)) || (G.L.domes || []).some(d => dist(b.x, b.y, d.x, d.y) < d.r)) { b.life = 0; burst(b.x, b.y, C.tealL, 3, 90, 3); continue; }
    for (const e of G.enemies) { if (e.dead || e.spawnT > 0) continue; if (dist(b.x, b.y, e.x, e.y) < e.r + b.r) { damageEnemy(e, b.dmg); b.life = 0; burst(b.x, b.y, C.tealL, 3, 100, 3); break; } }
    if (b.life <= 0) continue;
    for (const g of G.gens) {
      if (!g.alive) continue;
      if (dist(b.x, b.y, g.x, g.y - 22) < g.r + b.r) { damageGen(g, b.dmg); b.life = 0; burst(b.x, b.y, C.amber, 3, 100, 3); break; }
    }
    if (b.life <= 0) continue;
    const bo = G.boss;
    if (bo && !bo.dead && bo.dying <= 0 && dist(b.x, b.y, bo.x, bo.y) < (bo.shield ? 152 : 100) + b.r) { damageBoss(b.dmg, b.x, b.y); b.life = 0; }
  }
  G.pB = G.pB.filter(b => b.life > 0);
  // 적 탄
  for (const b of G.eB) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.x < -50 || b.y < -50 || b.x > L.w + 50 || b.y > L.h + 50) { b.life = 0; continue; }
    if (G.walls.some(w => w.active && inRectPad(b.x, b.y, w, 2)) || G.L.solids.some(s => inRectPad(b.x, b.y, s, 0)) || (G.L.domes || []).some(d => dist(b.x, b.y, d.x, d.y) < d.r)) { b.life = 0; continue; }
    if (P.dead) continue;
    const d = dist(b.x, b.y, P.x, P.y - 4);
    if (P.marchT > 0 && d < 50) { b.life = 0; burst(b.x, b.y, C.tealL, 4, 120, 3); continue; }
    if (d < b.r + P.r * 0.7) { if (P.inv <= 0 && P.dashT <= 0) { hurtPlayer(10, b.x, b.y); b.life = 0; } }
  }
  G.eB = G.eB.filter(b => b.life > 0);
  // 기술: 공명 파동
  for (const p of G.pulses) {
    p.r += 900 * dt;
    G.eB = G.eB.filter(b => dist(b.x, b.y, p.x, p.y) > p.r);
    for (const e of G.enemies) {
      if (p.hit.has(e) || dist(e.x, e.y, p.x, p.y) > p.r + e.r) continue;
      p.hit.add(e); damageEnemy(e, 25 * st.dmg / 10);
      const a = Math.atan2(e.y - p.y, e.x - p.x); if (e.speed > 0) moveBody(e, Math.cos(a) * 90, Math.sin(a) * 90, false);
    }
    for (const g of G.gens) if (g.alive && !p.hit.has(g) && dist(g.x, g.y, p.x, p.y) < p.r + g.r) { p.hit.add(g); damageGen(g, 30); }
    if (G.boss && !p.hit.has(G.boss) && dist(G.boss.x, G.boss.y, p.x, p.y) < p.r + 80) { p.hit.add(G.boss); damageBoss(40, G.boss.x, G.boss.y + 60); }
  }
  G.pulses = G.pulses.filter(p => p.r < p.max);
  // 발생기·벽
  for (const g of G.gens) if (g.hitT > 0) g.hitT -= dt;
  for (const w of G.walls) if (!w.active && w.fade > 0) w.fade -= dt * 1.5;
  // 줍기
  for (const gm of G.gems) {
    gm.t += dt;
    const d = dist(gm.x, gm.y, P.x, P.y);
    if (d < 130 && !P.dead) { const s = 260 + gm.t * 300; gm.x += (P.x - gm.x) / d * s * dt; gm.y += (P.y - gm.y) / d * s * dt; }
    else { gm.x += gm.vx * dt; gm.y += gm.vy * dt; gm.vx *= 0.92; gm.vy *= 0.92; }
    if (d < 20 && !P.dead) { gm.got = true; gainXp(gm.v); }
  }
  G.gems = G.gems.filter(g => !g.got);
  for (const c of G.chips) {
    if (c.got) continue; c.t += dt;
    const d = dist(c.x, c.y, P.x, P.y);
    if (d < 90 && !P.dead) { c.x += (P.x - c.x) * Math.min(1, dt * 6); c.y += (P.y - c.y) * Math.min(1, dt * 6); }
    if (d < 28 && !P.dead) { c.got = true; collectRecord(c.id); }
  }
  for (const c of G.caps) {
    c.t += dt;
    if (!c.freed && !P.dead && dist(c.x, c.y, P.x, P.y) < 54) {
      c.freed = true; G.stats.rescued++;
      G.settlers.push({ look: c.look, x: c.x, y: c.y, t: 0, fireT: 0.5, aim: -Math.PI / 2, moving: false });
      burst(c.x, c.y, C.tealL, 24, 220); showAllyTip();
      Sound.play('good');
    }
  }
  // 구역
  const zi = zoneIndexAt(P.y);
  if (zi !== G.zoneIdx) {
    G.zoneIdx = zi;
    const z = G.zones[zi];
    if (z && !z.entered) {
      z.entered = true; G.checkpoint = { x: z.check.x, y: z.check.y };
      z.initial.forEach(s => spawnEnemy(s[0], s[1], s[2], zi, s[3]));
      if (zi > 0) G.toasts.push({ zone: z.label, t: 0 });
    }
  }
  const z = G.zones[G.zoneIdx];
  if (z && wallById(z.exit).active) {
    z.spawnT -= dt;
    if (z.spawnT <= 0) {
      z.spawnT = z.every;
      if (G.enemies.filter(e => e.zone === G.zoneIdx).length < z.max) {
        for (let k = 0; k < 14; k++) {
          const xr = z.xr && G.restricted ? z.xr : [80, L.w - 80];
          const x = rand(xr[0], xr[1]), y = rand(z.y0 + 60, z.y1 - 60);
          if (dist(x, y, P.x, P.y) > 430 && !G.walls.some(w => w.active && inRectPad(x, y, w, 30)) && !G.L.solids.some(s => inRectPad(x, y, s, 30)) && !(G.L.domes || []).some(d => dist(x, y, d.x, d.y) < d.r + 30)) { spawnEnemy(pick(z.pool), x, y, G.zoneIdx); break; }
        }
      }
    }
  }
  const rg = wallById('recgate');
  if (rg && rg.active && recordsLeft() === 0) { rg.active = false; rg.fade = 1; banner('기록 문이 열렸어요!', '기록을 모두 모았어요. 이제 보스 구역으로 들어가요', C.tealL, 3.5); Sound.play('good'); }
  if (!G.boss && !wallById('wA').active && P.y < 690 && !P.dead) startBoss();
  if (G.boss && !G.boss.dead) updateBoss(dt);
  updateCoach(dt); updateTips(dt); updateNpcs(dt);
  updateFx(dt);
  // 카메라
  let tx, ty;
  if (G.arenaLock) { tx = L.arena.x; ty = L.arena.y; }
  else { tx = clamp(P.x - W / 2, 0, L.w - W); ty = clamp(P.y - H / 2 - 30, 0, L.h - H); }
  const k = 1 - Math.exp(-dt * 8);
  G.cam.x = lerp(G.cam.x, tx, k); G.cam.y = lerp(G.cam.y, ty, k);
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 30);
  if (G.pendingLv > 0 && G.mode === 'play' && !P.dead) openLevelUp();
}
function damageGen(g, dmg) {
  if (!g.alive) return;
  g.hp -= dmg; g.hitT = 0.1;
  if (g.hp > 0) return;
  g.alive = false; G.shake = Math.max(G.shake, 10);
  burst(g.x, g.y - 20, C.amber, 30, 320); burst(g.x, g.y - 20, C.cream, 14, 200);
  gainXp(8); Sound.play('boom');
  const freed = G.walls.some(w => w.active && w.divider && w.gens.every(id => !G.gens.find(x => x.id === id).alive));
  for (const w of G.walls) {
    if (!w.active || w.gate || !w.gens.length) continue;
    if (w.gens.every(id => !G.gens.find(x => x.id === id).alive)) {
      w.active = false; w.fade = 1;
      if (w.divider) liberate();
      else if (!freed) banner('레이저 벽 해제!', w.id === 'wA' ? '앞쪽 보스 구역으로 들어가세요' : '앞으로 나아가세요', C.mustard, 2.6);
    }
  }
}
function showAllyTip() {
  const n = G.settlers.length;
  if (!G.tipsSeen.ally) { G.tipsSeen.ally = true; showNotice('정착민이 함께해요!', '동료는 같이 쏘고, 1명마다 공격력 +10%, 10초에 한 번 대신 막아 줘요. 힘을 모으는 것을 연대라고 해요', '+'); }
  else showNotice('정착민이 함께해요!', '동료 ' + n + '명 · 공격 +' + n * 10 + '% · 막아 주기', '+');
}
function liberate() {
  G.restricted = false; G.freeT = G.t;

  G.shake = Math.max(G.shake, 12);
  burst(G.P.x, G.P.y, C.tealL, 30, 300);
  const P = G.P;
  const near = G.npcs.slice().sort((a, b) => dist(a.x, a.y, P.x, P.y) - dist(b.x, b.y, P.x, P.y));
  near.slice(0, 2).forEach(n => { n.joined = true; G.settlers.push({ look: n.look, x: n.x, y: n.y, t: 0, fireT: 0.5, aim: 0, moving: false }); addText(n.x, n.y - 50, '함께 가요!', C.tealL, 20); });
  G.npcs = G.npcs.filter(n => !n.joined);
  G.npcs.forEach(n => addText(n.x, n.y - 50, '야호!', C.mustard, 18));
  G.tipsSeen.ally = true;
  showNotice('분리선 해제!', '이제 어디든 갈 수 있고 대시도 쓸 수 있어요. 화성 태생 주민 2명이 함께해요! (동료 ' + G.settlers.length + '명 · 공격 +' + G.settlers.length * 10 + '%)', '✓');
}
function updateNpcs(dt) {
  if (G.arenaLock) return;
  for (const n of G.npcs) {
    n.t += dt;
    if (n.wait > 0) { n.wait -= dt; n.moving = false; continue; }
    const d = dist(n.x, n.y, n.tx, n.ty);
    if (d < 6) { n.wait = rand(1, 3); n.tx = clamp(n.x + rand(-220, 220), 100, 960); n.ty = clamp(n.y + rand(-220, 220), 1880, 3760); continue; }
    n.moving = true;
    const ox = n.x, oy = n.y;
    n.x += (n.tx - n.x) / d * 55 * dt; n.y += (n.ty - n.y) / d * 55 * dt;
    n.r = 14;
    if (moveBody(n, 0, 0, false)) { n.x = ox; n.y = oy; n.tx = n.x; n.ty = n.y; }
    n.aim = Math.atan2(n.ty - n.y, n.tx - n.x);
  }
}
function updateFx(dt) {
  for (const p of G.parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.9; p.vy *= 0.9; }
  G.parts = G.parts.filter(p => p.t < p.life);
  if (G.parts.length > 600) G.parts.splice(0, G.parts.length - 600);
  for (const t of G.texts) { t.t += dt; t.y -= 40 * dt; }
  G.texts = G.texts.filter(t => t.t < 1.1);
  if (G.banner) { G.banner.t += dt; if (G.banner.t > G.banner.dur) G.banner = null; }
  if (G.toasts.length) { const tt = G.toasts[0]; tt.t += dt; if (tt.t > toastDur(tt)) G.toasts.shift(); }
}

/* ----- 그리기 ----- */
function drawStage() {
  const P = G.P, cam = G.cam;
  const sx = G.shake > 0 ? rand(-G.shake, G.shake) * 0.6 : 0, sy = G.shake > 0 ? rand(-G.shake, G.shake) * 0.6 : 0;
  ctx.save(); ctx.translate(sx, sy);
  drawFloor(cam);
  ctx.save(); ctx.translate(-Math.round(cam.x), -Math.round(cam.y));
  drawWorldDecor();
  const vis = (x, y, m) => x > cam.x - m && x < cam.x + W + m && y > cam.y - m && y < cam.y + H + m;
  for (const g of G.gens) if (vis(g.x, g.y, 200)) drawGenLinks(g);
  for (const w of G.walls) drawWall(w);
  for (const c of G.chips) if (!c.got && vis(c.x, c.y, 60)) {
    drawChipIcon(c.x, c.y + Math.sin(c.t * 3) * 4, 1, G.t);
    if (dist(c.x, c.y, P.x, P.y) < 340) { setFont(13, 600); const tw = ctx.measureText('기록 칩').width + 16; rr(c.x - tw / 2, c.y + 18, tw, 18, 9); ctx.fillStyle = 'rgba(27,24,56,0.85)'; ctx.fill(); txt('기록 칩', c.x, c.y + 27, 13, C.tealL, 'center', { weight: 600 }); }
  }
  for (const gm of G.gems) if (vis(gm.x, gm.y, 20)) { ctx.save(); ctx.translate(gm.x, gm.y); ctx.rotate(G.t * 3); ctx.fillStyle = C.tealL; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(5, 0); ctx.lineTo(0, 6); ctx.lineTo(-5, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
  for (const c of G.caps) if (vis(c.x, c.y, 80)) drawCapsule(c);
  for (const g of G.gens) if (vis(g.x, g.y, 80)) { if (isTargetGen(g)) drawTargetRing(g); drawGen(g); }
  if (G.boss && !G.boss.dead) drawBoss(G.boss);
  const actors = [];
  for (const e of G.enemies) if (vis(e.x, e.y, 60)) actors.push({ y: e.y, f: () => drawEnemy(e, G.t) });
  G.settlers.forEach(s => actors.push({ y: s.y, f: () => drawChibi(s.x, s.y, s.t, s.moving, s.aim, s.look, { scale: 1.1, noPack: true }) }));
  G.npcs.forEach(n => { if (vis(n.x, n.y, 60)) actors.push({ y: n.y, f: () => drawChibi(n.x, n.y, n.t, n.moving, n.aim || 0, n.look, { scale: 1.1, noPack: true }) }); });
  if (!P.dead) actors.push({ y: P.y, f: drawPlayer });
  actors.sort((a, b) => a.y - b.y).forEach(a => a.f());
  if (G.P.marchT > 0 && !P.dead) { ctx.strokeStyle = 'rgba(159,245,234,' + (0.5 + 0.3 * Math.sin(G.t * 10)) + ')'; ctx.lineWidth = 4; circle(P.x, P.y - 4, 50); ctx.stroke(); ctx.fillStyle = 'rgba(159,245,234,0.12)'; ctx.fill(); }
  drawGuide();
  if (G.boss && !G.boss.dead) { drawLasers(G.boss); G.boss.orbs.forEach(drawOrb); }
  for (const b of G.pB) drawWaveShot(b);
  for (const b of G.eB) if (vis(b.x, b.y, 20)) {
    ctx.fillStyle = 'rgba(255,140,40,0.35)'; circle(b.x, b.y, b.r + 4); ctx.fill();
    ctx.fillStyle = C.orange; circle(b.x, b.y, b.r); ctx.fill();
    ctx.fillStyle = '#fff4c8'; circle(b.x, b.y, b.r * 0.5); ctx.fill();
  }
  for (const p of G.pulses) { ctx.strokeStyle = 'rgba(159,245,234,' + (1 - p.r / p.max) + ')'; ctx.lineWidth = 8; circle(p.x, p.y, p.r); ctx.stroke(); ctx.lineWidth = 3; circle(p.x, p.y, p.r * 0.8); ctx.stroke(); }
  for (const p of G.parts) { ctx.globalAlpha = 1 - p.t / p.life; ctx.fillStyle = p.color; circle(p.x, p.y, p.size * (1 - p.t / p.life * 0.5)); ctx.fill(); }
  ctx.globalAlpha = 1;
  for (const t of G.texts) { ctx.globalAlpha = Math.min(1, 2 - t.t * 2); txt(t.s, t.x, t.y, t.size, t.color, 'center', { stroke: C.ink, sw: 5 }); }
  ctx.globalAlpha = 1;
  ctx.restore();
  ctx.restore();
  drawDust();
  drawOffscreenTargets();
  drawHUD();
  if (G.mode === 'notice') drawNotice();
  else if (G.mode === 'brief') drawBrief();
  else if (G.mode === 'rules') drawRules();
  else if (G.mode === 'bossIntro') drawBossIntro();
  else if (G.mode === 'record') drawRecordCard();
  else if (G.mode === 'claim') drawClaimCard();
  else if (G.mode === 'rebut') drawRebutCard();
  else if (G.mode === 'down') drawDown();
  else if (G.mode === 'levelup') drawLevelUp();
  else if (G.mode === 'pause') drawPause();
  else if (G.mode === 'clear') drawClear();
  else if (G.mode === 'gameover') drawGameOver();
}
function guideGoal() {
  const P = G.P;
  if (G.boss || P.dead || G.mode !== 'play') return null;
  if (G.coach) { const st = G.coach.steps[G.coach.step]; if (st && st.target) { const t = st.target(); if (t) return { x: t.x, y: t.y, near: true }; } }
  const z = G.zones[G.zoneIdx];
  if (!z) { if (recordGateNeeded()) { const c = nearestChipTarget(); if (c) return { x: c.x, y: c.y }; } return { x: 800, y: 640 }; }
  const w = wallById(z.exit);
  if (w.active) {
    let best = null, bd = 1e9;
    G.gens.forEach(g => { if (g.alive && w.gens.includes(g.id)) { const d = dist(P.x, P.y, g.x, g.y); if (d < bd) { bd = d; best = g; } } });
    return best && bd > 420 ? { x: best.x, y: best.y } : null;
  }
  if (recordGateNeeded()) {
    const here = chipTargets().filter(c => c.y >= z.y0 && c.y < z.y1);
    if (here.length) { const c = nearestOf(here); return { x: c.x, y: c.y }; }
    const behind = chipTargets().filter(c => zoneIndexAt(c.y) < G.zoneIdx || G.zoneIdx === G.zones.length - 1);
    if (behind.length && (G.zoneIdx === G.zones.length - 1 || !G.restricted)) { const c = nearestOf(behind); return { x: c.x, y: c.y }; }
  }
  return G.zoneIdx === G.zones.length - 1 ? { x: 800, y: 700 } : { x: clamp(P.x, 240, 1360), y: z.y0 - 80 };
}
// 지금 갈 수 있는 기록 칩(과 칩을 가진 적)만 고른다: 분리선 건너편, 아직 꺼지지 않은 벽 너머는 뺀다
function reachable(x, y) {
  if (G.restricted && x < 1000) return false;
  const here = G.zoneIdx < 0 ? G.zones.length : G.zoneIdx, zc = zoneIndexAt(y);
  if (zc < 0 || zc <= here) return true;
  for (let i = here; i < zc; i++) { const w = wallById(G.zones[i].exit); if (w && w.active) return false; }
  return true;
}
function chipTargets() {
  const out = [];
  G.chips.forEach(c => { if (!c.got && !save.records[c.id] && reachable(c.x, c.y)) out.push({ x: c.x, y: c.y }); });
  G.enemies.forEach(e => { if (e.chip && !e.dead && !save.records[e.chip] && reachable(e.x, e.y)) out.push({ x: e.x, y: e.y }); });
  return out;
}
function nearestChipTarget() { return nearestOf(chipTargets()); }
function drawGuide() {
  const g = guideGoal(), P = G.P;
  if (!g || dist(P.x, P.y, g.x, g.y) < (g.near ? 110 : 170)) return;
  const a = Math.atan2(g.y - P.y, g.x - P.x), r = 74 + Math.sin(G.t * 6) * 6;
  ctx.save(); ctx.translate(P.x + Math.cos(a) * r, P.y - 6 + Math.sin(a) * r); ctx.rotate(a);
  ctx.globalAlpha = 0.85; ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.fillStyle = C.mustard;
  ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-8, -13); ctx.lineTo(-3, 0); ctx.lineTo(-8, 13); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}
function drawDust() {
  const cam = G.cam;
  for (let i = 0; i < 46; i++) {
    const sp = 0.5 + (i % 5) * 0.12;
    const x = (((i * 211) + G.t * (14 + (i % 7) * 4) - cam.x * sp) % (W + 40) + W + 40) % (W + 40) - 20;
    const y = (((i * 137) + G.t * (5 + (i % 3) * 3) - cam.y * sp) % (H + 40) + H + 40) % (H + 40) - 20;
    ctx.fillStyle = 'rgba(255,170,120,' + (0.18 + (i % 4) * 0.07) + ')'; circle(x, y, 1.5 + (i % 3)); ctx.fill();
  }
  if (!G.arenaLock) {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.95);
    g.addColorStop(0, 'rgba(120,40,30,0)'); g.addColorStop(1, 'rgba(90,25,30,0.35)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
}
function drawPlayer() {
  const P = G.P;
  if (P.inv > 0 && P.dashT <= 0 && Math.floor(P.inv * 16) % 2 === 0) ctx.globalAlpha = 0.45;
  drawHeroAt(P.x, P.y, P.aim, P.t, P.moving, Math.max(0, P.glow));
  ctx.globalAlpha = 1;
  if (G.st.allies > 0) for (let k = 0; k < G.st.allies; k++) {
    const a = G.t * 2.2 + k / G.st.allies * TAU, x = P.x + Math.cos(a) * 46, y = P.y - 6 + Math.sin(a) * 30;
    ctx.lineWidth = 2; ctx.strokeStyle = C.ink; ctx.fillStyle = C.tealL; circle(x, y, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.ink; circle(x + 2, y - 1, 2.4); ctx.fill();
  }
}
function drawWaveShot(b) {
  const col = b.kind === 'p' ? C.tealL : b.kind === 's' ? C.amberL : '#bff9ff';
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a);
  ctx.strokeStyle = col; ctx.lineCap = 'round';
  ctx.lineWidth = b.kind === 'p' ? 4 : 3; ctx.beginPath(); ctx.arc(-4, 0, b.r, -0.9, 0.9); ctx.stroke();
  ctx.lineWidth = 2.5; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.arc(-12, 0, b.r * 0.75, -0.8, 0.8); ctx.stroke();
  ctx.restore();
}
let SOIL = null;
function soilPattern() {
  if (SOIL) return SOIL;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  let seed = 11; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  x.fillStyle = '#b5523a'; x.fillRect(0, 0, 256, 256);
  const blot = (px, py, rad, col, sq) => { x.fillStyle = col; for (const dx of [-256, 0, 256]) for (const dy of [-256, 0, 256]) { x.beginPath(); x.ellipse(px + dx, py + dy, rad, rad * sq, 0, 0, TAU); x.fill(); } };
  for (let i = 0; i < 46; i++) blot(r() * 256, r() * 256, 10 + r() * 36, r() < 0.5 ? 'rgba(140,52,36,0.32)' : 'rgba(222,122,80,0.26)', 0.45 + r() * 0.4);
  for (let i = 0; i < 180; i++) blot(r() * 256, r() * 256, 0.8 + r() * 2.2, r() < 0.6 ? 'rgba(105,38,28,0.55)' : 'rgba(246,180,130,0.5)', 1);
  SOIL = ctx.createPattern(c, 'repeat');
  return SOIL;
}
function drawFloor(cam) {
  ctx.save(); ctx.translate(-Math.round(cam.x), -Math.round(cam.y));
  ctx.fillStyle = soilPattern(); ctx.fillRect(cam.x - 4, cam.y - 4, W + 8, H + 8);
  ctx.restore();
}
function drawPad(p) {
  const c = G.cam; if (p.x > c.x + W || p.x + p.w < c.x || p.y > c.y + H || p.y + p.h < c.y) return;
  ctx.fillStyle = 'rgba(60,20,20,0.3)'; rr(p.x + 3, p.y + 7, p.w, p.h, 16); ctx.fill();
  ctx.fillStyle = '#4b5076'; rr(p.x, p.y, p.w, p.h, 16); ctx.fill();
  ctx.save(); rr(p.x, p.y, p.w, p.h, 16); ctx.clip();
  const x0 = Math.max(p.x, Math.floor(c.x / 80) * 80), x1 = Math.min(p.x + p.w, c.x + W), y0 = Math.max(p.y, Math.floor(c.y / 80) * 80), y1 = Math.min(p.y + p.h, c.y + H);
  ctx.strokeStyle = 'rgba(30,32,62,0.55)'; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = Math.ceil(x0 / 80) * 80; x < x1; x += 80) { ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
  for (let y = Math.ceil(y0 / 80) * 80; y < y1; y += 80) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  for (let x = Math.ceil(x0 / 80) * 80; x < x1; x += 80) for (let y = Math.ceil(y0 / 80) * 80; y < y1; y += 80) { ctx.fillRect(x + 6, y + 6, 3, 3); }
  ctx.restore();
  ctx.lineWidth = 3; ctx.strokeStyle = '#2a2d4f'; rr(p.x, p.y, p.w, p.h, 16); ctx.stroke();
  ctx.strokeStyle = 'rgba(159,245,234,0.25)'; ctx.lineWidth = 2; rr(p.x + 5, p.y + 5, p.w - 10, p.h - 10, 12); ctx.stroke();
}
function drawRock(r) {
  const c = G.cam; if (r.x < c.x - 60 || r.x > c.x + W + 60 || r.y < c.y - 60 || r.y > c.y + H + 60) return;
  ctx.save(); ctx.translate(r.x, r.y); ctx.scale(r.s, r.s);
  if (r.kind === 'crater') {
    ctx.fillStyle = 'rgba(120,42,30,0.55)'; ellipse(0, 0, 34, 20); ctx.fill();
    ctx.fillStyle = 'rgba(90,30,22,0.45)'; ellipse(2, 3, 24, 13); ctx.fill();
    ctx.strokeStyle = 'rgba(250,180,130,0.45)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, 34, 20, 0, 0.2, Math.PI - 0.2); ctx.stroke();
  } else {
    ctx.rotate(r.a * 0.2);
    ctx.fillStyle = 'rgba(70,24,18,0.35)'; ellipse(4, 9, 20, 8); ctx.fill();
    ctx.fillStyle = '#8c3b2b'; ctx.beginPath(); ctx.moveTo(-18, 6); ctx.lineTo(-12, -9); ctx.lineTo(2, -14); ctx.lineTo(16, -6); ctx.lineTo(19, 6); ctx.lineTo(4, 11); ctx.closePath(); ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#4a1d18'; ctx.stroke();
    ctx.fillStyle = '#c66a4c'; ctx.beginPath(); ctx.moveTo(-12, -8); ctx.lineTo(2, -13); ctx.lineTo(8, -6); ctx.lineTo(-6, -3); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
function drawDome(d) {
  const c = G.cam; if (d.x < c.x - 120 || d.x > c.x + W + 120 || d.y < c.y - 120 || d.y > c.y + H + 120) return;
  ctx.save(); ctx.translate(d.x, d.y);
  ctx.fillStyle = 'rgba(60,20,20,0.35)'; ellipse(8, 14, d.r + 6, d.r * 0.9); ctx.fill();
  ctx.fillStyle = '#5b6087'; circle(0, 0, d.r + 6); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.stroke();
  ctx.fillStyle = '#5fb07a'; circle(0, 0, d.r * 0.82); ctx.fill();
  ctx.fillStyle = '#78c98e'; circle(-d.r * 0.3, -d.r * 0.2, d.r * 0.32); ctx.fill(); circle(d.r * 0.28, d.r * 0.25, d.r * 0.26); ctx.fill();
  ctx.fillStyle = '#f2e6d0'; rr(-d.r * 0.22, -d.r * 0.1, d.r * 0.44, d.r * 0.34, 4); ctx.fill();
  ctx.fillStyle = 'rgba(190,240,255,0.32)'; circle(0, 0, d.r); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, d.r, 0, TAU); ctx.moveTo(-d.r, 0); ctx.lineTo(d.r, 0); ctx.moveTo(0, -d.r); ctx.lineTo(0, d.r); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, 0, d.r * 0.5, d.r, 0, 0, TAU); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ellipse(-d.r * 0.38, -d.r * 0.45, d.r * 0.22, d.r * 0.1); ctx.fill();
  ctx.restore();
}
function drawBoard(b) {
  const c = G.cam; if (b.x < c.x - 200 || b.x > c.x + W + 200 || b.y < c.y - 160 || b.y > c.y + H + 80) return;
  ctx.save(); ctx.translate(b.x, b.y);
  ctx.fillStyle = 'rgba(60,20,20,0.35)'; ellipse(0, 6, 60, 10); ctx.fill();
  ctx.fillStyle = '#3a3566'; ctx.fillRect(-4, -40, 8, 44); ctx.lineWidth = 2.5; ctx.strokeStyle = C.ink; ctx.strokeRect(-4, -40, 8, 44);
  setFont(17, 600); const w = Math.max(ctx.measureText(b.text[0]).width, ctx.measureText(b.text[1]).width) + 96;
  ctx.fillStyle = 'rgba(255,177,46,' + (0.16 + 0.06 * Math.sin(G.t * 3)) + ')'; rr(-w / 2 - 8, -132, w + 16, 100, 16); ctx.fill();
  rr(-w / 2, -124, w, 84, 12); ctx.fillStyle = 'rgba(25,18,40,0.94)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.amber; ctx.stroke();
  ctx.lineWidth = 2; ctx.strokeStyle = C.ink; ctx.fillStyle = '#f1e8d8'; circle(-w / 2 + 38, -82, 22); ctx.fill(); ctx.stroke();
  drawEye(-w / 2 + 38, -82, 15, Math.atan2(G.P.y - b.y, G.P.x - b.x), G.t);
  txt('오더 방송', -w / 2 + 70, -106, 13, C.amber, 'left', { weight: 600 });
  txt(b.text[0], -w / 2 + 70, -84, 19, C.amberL, 'left', { weight: 900 });
  txt(b.text[1], -w / 2 + 70, -60, 16, C.cream, 'left', { weight: 600 });
  ctx.restore();
}
function drawSpaceEdge(s) {
  const c = G.cam; if (s.x > c.x + W || s.x + s.w < c.x || s.y > c.y + H || s.y + s.h < c.y) return;
  const y0 = Math.max(s.y, c.y - 10), y1 = Math.min(s.y + s.h, c.y + H + 10);
  ctx.fillStyle = '#0e0b26'; ctx.fillRect(s.x, y0, s.w, y1 - y0);
  for (let y = Math.floor(y0 / 37) * 37; y < y1; y += 37) {
    const k = (y / 37 * 7919 + s.x) % 97;
    ctx.fillStyle = 'rgba(255,255,255,' + (0.35 + (k % 5) * 0.12) + ')'; ctx.fillRect(s.x + 8 + (k * 13) % (s.w - 16), y + (k % 17), 2, 2);
  }
  const inner = s.x === 0 ? s.x + s.w : s.x;
  const g = ctx.createLinearGradient(inner + (s.x === 0 ? -22 : 22), 0, inner, 0);
  g.addColorStop(0, 'rgba(159,245,234,0)'); g.addColorStop(1, 'rgba(159,245,234,0.55)');
  ctx.fillStyle = g; ctx.fillRect(s.x === 0 ? inner - 22 : inner, y0, 22, y1 - y0);
  ctx.fillStyle = '#d9f7f2'; ctx.fillRect(inner - 2, y0, 4, y1 - y0);
  ctx.fillStyle = '#5b6087';
  for (let y = Math.floor(y0 / 240) * 240; y < y1; y += 240) ctx.fillRect(s.x === 0 ? inner - 14 : inner - 2, y, 16, 14);
}
function drawSpaceWindow(s) {
  const c = G.cam; if (s.x > c.x + W || s.x + s.w < c.x || s.y > c.y + H || s.y + s.h < c.y) return;
  ctx.fillStyle = '#0e0b26'; ctx.fillRect(s.x, s.y, s.w, s.h);
  for (let i = 0; i < s.w * s.h / 1800; i++) {
    const k = i * 7919 + s.x * 31 + s.y;
    ctx.fillStyle = 'rgba(255,255,255,' + (0.3 + (k % 7) * 0.1) + ')'; ctx.fillRect(s.x + (k * 13) % s.w, s.y + (k * 29) % s.h, 2, 2);
  }
  if (s.w > 300) { ctx.fillStyle = 'rgba(95,182,255,0.35)'; circle(s.x + s.w * 0.7, s.y + s.h * 0.35, 9); ctx.fill(); ctx.fillStyle = '#6cc0ff'; circle(s.x + s.w * 0.7, s.y + s.h * 0.35, 4); ctx.fill(); }
  ctx.lineWidth = 6; ctx.strokeStyle = '#5b6087'; ctx.strokeRect(s.x + 3, s.y + 3, s.w - 6, s.h - 6);
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(159,245,234,0.6)'; ctx.strokeRect(s.x + 8, s.y + 8, s.w - 16, s.h - 16);
}
function drawWorldDecor() {
  const L = G.L;
  for (const r of L.rocks || []) drawRock(r);
  for (const p of L.pads || []) drawPad(p);
  if (L.restrict && G.restricted) {
    const ln = L.restrict.lane;
    ctx.fillStyle = 'rgba(25,10,40,0.32)'; ctx.fillRect(ln.x0, ln.y0, ln.x1 - ln.x0, ln.y1 - ln.y0);
  }
  G.zones.forEach((z, i) => txt(['A', 'B', 'C'][i] + ' 구역', 800, z.y1 - 70, 60, 'rgba(255,244,220,0.12)', 'center', { weight: 900 }));
  if (L.laneSigns) {
    const sg = G.def.signs;
    L.laneSigns.forEach(ls => {
      const merged = !G.restricted;
      const label = merged ? sg.merged : (ls.side === 'left' ? sg.left + ' 전용' : sg.right + ' 구역');
      const good = ls.side === 'left';
      ctx.save(); ctx.translate(ls.x, ls.y);
      rr(-130, -34, 260, 68, 14); ctx.fillStyle = merged ? 'rgba(20,60,70,0.88)' : good ? 'rgba(30,60,50,0.88)' : 'rgba(70,25,25,0.9)'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = merged ? C.tealL : good ? C.good : C.bad; ctx.stroke();
      txt(label, 0, 2, 28, merged ? C.tealL : good ? '#bff5d6' : '#ffc2b8', 'center', { weight: 900 });
      ctx.restore();
    });
  }
  const a = L.arena;
  ctx.save();
  ctx.fillStyle = '#2e2b52'; ctx.fillRect(a.x, a.y, a.w, a.h);
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 2;
  for (let yy = a.y; yy < a.y + a.h; yy += 52) for (let xx = a.x + ((yy / 52) & 1) * 30; xx < a.x + a.w; xx += 60) { ctx.beginPath(); for (let k = 0; k < 6; k++) { const an = k / 6 * TAU + Math.PI / 6; ctx.lineTo(xx + Math.cos(an) * 30, yy + Math.sin(an) * 30); } ctx.closePath(); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(255,177,46,0.22)'; ctx.lineWidth = 3;
  for (let r = 120; r < 700; r += 110) { circle(800, 300, r); ctx.stroke(); }
  ctx.restore();
  for (const d of L.domes || []) drawDome(d);
  for (const p of L.props || []) drawProp(p);
  for (const b of L.boards || []) drawBoard(b);
  for (const s of L.solids) {
    if (s.crate) drawCrate(s);
    else if (s.space) drawSpaceEdge(s);
    else drawSpaceWindow(s);
  }
}
function drawCrate(s) {
  const c = G.cam; if (s.x > c.x + W || s.x + s.w < c.x || s.y > c.y + H || s.y + s.h < c.y) return;
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = C.ink;
  ctx.fillStyle = 'rgba(10,8,30,0.35)'; rr(s.x + 4, s.y + 10, s.w, s.h, 8); ctx.fill();
  ctx.fillStyle = '#c98f55'; rr(s.x, s.y, s.w, s.h, 8); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e2ad6c'; rr(s.x + 6, s.y + 6, s.w - 12, s.h - 22, 5); ctx.fill();
  ctx.strokeStyle = 'rgba(27,24,56,0.55)'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(s.x + 8, s.y + 8); ctx.lineTo(s.x + s.w - 8, s.y + s.h - 18); ctx.moveTo(s.x + s.w - 8, s.y + 8); ctx.lineTo(s.x + 8, s.y + s.h - 18); ctx.stroke();
  ctx.fillStyle = C.teal; ctx.fillRect(s.x + 10, s.y + s.h - 13, s.w - 20, 5);
  ctx.restore();
}
function drawProp(p) {
  const c = G.cam; if (p.x < c.x - 90 || p.x > c.x + W + 90 || p.y < c.y - 90 || p.y > c.y + H + 90) return;
  ctx.save(); ctx.translate(p.x, p.y); ctx.lineJoin = 'round'; ctx.lineWidth = 2.5; ctx.strokeStyle = C.ink;
  if (p.kind === 'solar') {
    ctx.fillStyle = 'rgba(60,20,20,0.3)'; rr(-62, -26, 128, 60, 6); ctx.fill();
    ctx.fillStyle = '#2a4d8f'; rr(-64, -30, 128, 58, 6); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(160,210,255,0.55)'; ctx.lineWidth = 1.5; ctx.beginPath();
    for (let x = -48; x < 64; x += 16) { ctx.moveTo(x, -28); ctx.lineTo(x, 26); }
    ctx.moveTo(-62, -1); ctx.lineTo(62, -1); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.moveTo(-60, -28); ctx.lineTo(-30, -28); ctx.lineTo(-50, 26); ctx.lineTo(-62, 26); ctx.closePath(); ctx.fill();
  } else if (p.kind === 'antenna') {
    ctx.fillStyle = 'rgba(60,20,20,0.3)'; ellipse(4, 16, 24, 8); ctx.fill();
    ctx.fillStyle = '#5b6087'; rr(-5, -6, 10, 22, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.cream; ctx.beginPath(); ctx.ellipse(0, -12, 24, 14, -0.4, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#d8ccb8'; ctx.beginPath(); ctx.ellipse(2, -10, 14, 8, -0.4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(10, -30); ctx.stroke();
    ctx.fillStyle = Math.sin(G.t * 4 + p.x) > 0 ? C.tealL : C.tealD; circle(10, -31, 4); ctx.fill(); ctx.stroke();
  } else if (p.kind === 'plant') {
    ctx.fillStyle = 'rgba(60,20,20,0.3)'; ellipse(4, 14, 26, 8); ctx.fill();
    ctx.fillStyle = '#5ec27f'; circle(-9, -10, 12); ctx.fill(); ctx.stroke(); circle(9, -12, 13); ctx.fill(); ctx.stroke(); circle(0, -22, 12); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ec6f9f'; circle(-4, -20, 3.5); ctx.fill(); circle(10, -9, 3.5); ctx.fill(); ctx.fillStyle = C.mustard; circle(-10, -8, 3); ctx.fill();
    ctx.fillStyle = C.cream; rr(-18, -4, 36, 18, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.teal; ctx.fillRect(-18, 2, 36, 4);
  } else if (p.kind === 'tank') {
    ctx.fillStyle = 'rgba(60,20,20,0.3)'; ellipse(4, 16, 16, 6); ctx.fill();
    ctx.fillStyle = '#e8e2d6'; rr(-12, -24, 24, 40, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.teal; ctx.fillRect(-12, -6, 24, 6);
    txt('O₂', 0, 8, 11, C.ink, 'center', { weight: 600 });
  }
  ctx.restore();
}
function fieldRecords() { return D.records.filter(r => r.stage === G.def.id && r.id !== G.L.bossChip); }
function recordsLeft() { return fieldRecords().filter(r => !save.records[r.id]).length; }
function recordGateNeeded() { const rg = wallById('recgate'); return !!rg && rg.active; }
function drawRecordGate(w) {
  const a = w.active ? 1 : Math.max(0, w.fade); if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(44,200,182,0.22)'; ctx.fillRect(w.x, w.y - 14, w.w, w.h + 28);
  ctx.fillStyle = 'rgba(159,245,234,0.75)'; ctx.fillRect(w.x, w.y, w.w, w.h);
  ctx.fillStyle = 'rgba(255,255,255,' + (0.6 + 0.3 * Math.sin(G.t * 6)) + ')'; ctx.fillRect(w.x, w.y + w.h / 2 - 2, w.w, 4);
  if (w.active) {
    const left = recordsLeft(), tot = fieldRecords().length;
    rr(w.x + w.w / 2 - 210, w.y + 26, 420, 40, 20); ctx.fillStyle = 'rgba(16,40,38,0.92)'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = C.tealL; ctx.stroke();
    txt('기록 문 · 기록 칩 ' + (tot - left) + '/' + tot + ' 모으면 열려요', w.x + w.w / 2, w.y + 47, 20, C.tealL, 'center', { weight: 900 });
  }
  ctx.restore();
}
function drawWall(w) {
  if (w.recordGate) { drawRecordGate(w); return; }
  const a = w.active ? 1 : Math.max(0, w.fade);
  if (a <= 0) return;
  const c = G.cam;
  if (w.x > c.x + W + 40 || w.x + w.w < c.x - 40 || w.y > c.y + H + 40 || w.y + w.h < c.y - 40) return;
  ctx.save(); ctx.globalAlpha = a;
  const hor = w.w > w.h, fl = 0.75 + 0.25 * Math.sin(G.t * 30 + w.x);
  ctx.fillStyle = 'rgba(255,160,40,0.16)';
  if (hor) ctx.fillRect(w.x, w.y - 14, w.w, w.h + 28); else ctx.fillRect(w.x - 14, w.y, w.w + 28, w.h);
  ctx.fillStyle = 'rgba(255,177,46,0.6)'; ctx.fillRect(w.x, w.y, w.w, w.h);
  ctx.fillStyle = 'rgba(255,240,200,' + fl + ')';
  if (hor) ctx.fillRect(w.x, w.y + w.h / 2 - 2, w.w, 4); else ctx.fillRect(w.x + w.w / 2 - 2, w.y, 4, w.h);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  const off = (G.t * 260) % 120;
  if (hor) for (let x = w.x - 120 + off; x < w.x + w.w; x += 120) ctx.fillRect(x, w.y + w.h / 2 - 1, 30, 2);
  else for (let y = w.y - 120 + off; y < w.y + w.h; y += 120) ctx.fillRect(w.x + w.w / 2 - 1, y, 2, 30);
  ctx.restore();
}
function isTargetGen(g) {
  if (!g.alive || G.boss) return false;
  const z = G.zones[G.zoneIdx];
  return !!z && wallById(z.exit).gens.includes(g.id);
}
function drawTargetRing(g) {
  const p = 1 + Math.sin(G.t * 5) * 0.08;
  ctx.save(); ctx.translate(g.x, g.y + 10);
  ctx.strokeStyle = 'rgba(247,197,72,0.9)'; ctx.lineWidth = 4; ctx.setLineDash([14, 10]); ctx.lineDashOffset = -G.t * 30;
  ctx.beginPath(); ctx.ellipse(0, 0, 62 * p, 26 * p, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  const by = -150 + Math.sin(G.t * 6) * 7;
  rr(-38, by - 30, 76, 30, 15); ctx.fillStyle = C.mustard; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.stroke();
  txt('목표', 0, by - 14, 18, C.ink, 'center', { weight: 900 });
  ctx.fillStyle = C.mustard; ctx.beginPath(); ctx.moveTo(-12, by + 2); ctx.lineTo(12, by + 2); ctx.lineTo(0, by + 18); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}
function drawOffscreenTargets() {
  if (G.mode !== 'play' || G.boss) return;
  const cam = G.cam, m = 46;
  const wA = wallById('wA');
  if (recordGateNeeded() && wA && !wA.active) chipTargets().forEach(t => {
    const sx = t.x - cam.x, sy = t.y - cam.y;
    if (sx > 0 && sx < W && sy > 0 && sy < H) return;
    const cx = W / 2, cy = H / 2, ang = Math.atan2(sy - cy, sx - cx);
    const k = Math.min((W / 2 - m) / Math.abs(Math.cos(ang) || 1e-6), (H / 2 - m - 40) / Math.abs(Math.sin(ang) || 1e-6));
    ctx.save(); ctx.translate(cx + Math.cos(ang) * k, cy + Math.sin(ang) * k);
    ctx.fillStyle = 'rgba(16,40,38,0.88)'; circle(0, 0, 26); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.tealL; ctx.stroke();
    txt('기록', 0, 1, 13, C.tealL, 'center', { weight: 900 });
    ctx.rotate(ang); ctx.fillStyle = C.tealL; ctx.beginPath(); ctx.moveTo(40, 0); ctx.lineTo(28, -10); ctx.lineTo(28, 10); ctx.closePath(); ctx.fill();
    ctx.restore();
  });
  for (const g of G.gens) {
    if (!isTargetGen(g)) continue;
    const sx = g.x - cam.x, sy = g.y - 30 - cam.y;
    if (sx > 0 && sx < W && sy > 0 && sy < H) continue;
    const cx = W / 2, cy = H / 2, a = Math.atan2(sy - cy, sx - cx);
    const k = Math.min((W / 2 - m) / Math.abs(Math.cos(a) || 1e-6), (H / 2 - m - 40) / Math.abs(Math.sin(a) || 1e-6));
    const x = cx + Math.cos(a) * k, y = cy + Math.sin(a) * k;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(20,17,46,0.85)'; circle(0, 0, 26); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.mustard; ctx.stroke();
    txt('목표', 0, 1, 13, C.mustard, 'center', { weight: 900 });
    ctx.rotate(a); ctx.fillStyle = C.mustard; ctx.beginPath(); ctx.moveTo(40, 0); ctx.lineTo(28, -10); ctx.lineTo(28, 10); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}
function drawGenLinks(g) {
  if (!g.alive) return;
  for (const w of G.walls) {
    if (!w.active || !w.gens.includes(g.id)) continue;
    const tx = clamp(g.x, w.x, w.x + w.w), ty = clamp(g.y, w.y, w.y + w.h);
    ctx.strokeStyle = 'rgba(255,177,46,0.45)'; ctx.lineWidth = 3; ctx.setLineDash([8, 10]); ctx.lineDashOffset = -G.t * 40;
    ctx.beginPath(); ctx.moveTo(g.x, g.y - 30); ctx.lineTo(tx, ty); ctx.stroke(); ctx.setLineDash([]);
  }
}
function drawGen(g) {
  ctx.save(); ctx.translate(g.x + (g.hitT > 0 ? rand(-2, 2) : 0), g.y); ctx.scale(g.big ? 1.6 : 1.25, g.big ? 1.6 : 1.25);
  ctx.lineJoin = 'round'; ctx.lineWidth = 2.6; ctx.strokeStyle = C.ink;
  if (!g.alive) {
    ctx.fillStyle = '#1a1734'; ellipse(0, 10, 30, 12); ctx.fill();
    ctx.fillStyle = '#4d4777'; rr(-18, -6, 36, 16, 5); ctx.fill(); ctx.stroke();
    ctx.restore(); return;
  }
  ctx.fillStyle = 'rgba(10,8,30,0.35)'; ellipse(0, 14, 30, 10); ctx.fill();
  ctx.fillStyle = '#3a3566'; rr(-26, 2, 52, 18, 8); ctx.fill(); ctx.stroke();
  ctx.fillStyle = g.hitT > 0 ? '#fff' : C.cream; rr(-15, -36, 30, 44, 9); ctx.fill(); ctx.stroke();
  ctx.fillStyle = C.amber; ctx.fillRect(-10, -26, 20, 4); ctx.fillRect(-10, -16, 20, 4);
  const pulse = 1 + Math.sin(G.t * 6 + g.x) * 0.15;
  ctx.fillStyle = 'rgba(255,177,46,0.35)'; circle(0, -48, 18 * pulse); ctx.fill();
  ctx.fillStyle = C.amber; ctx.beginPath(); ctx.moveTo(0, -62); ctx.lineTo(10, -48); ctx.lineTo(0, -36); ctx.lineTo(-10, -48); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff5cc'; ctx.beginPath(); ctx.moveTo(0, -57); ctx.lineTo(4, -48); ctx.lineTo(0, -44); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(10,8,30,0.75)'; rr(-28, -80, 56, 8, 4); ctx.fill();
  ctx.fillStyle = C.amber; rr(-28, -80, 56 * Math.max(0, g.hp / g.maxHp), 8, 4); ctx.fill();
  if (!g.icon) {
    const z = G.zones[G.zoneIdx], target = z && wallById(z.exit).gens.includes(g.id);
    const gname = g.name || '발생기';
    setFont(13, 600); const tw = ctx.measureText(gname).width + 16;
    rr(-tw / 2, -102, tw, 18, 9); ctx.fillStyle = target ? C.mustard : 'rgba(27,24,56,0.85)'; ctx.fill();
    txt(gname, 0, -93, 13, target ? C.ink : C.cream, 'center', { weight: 600 });
  }
  ctx.restore();
}
function drawCapsule(c) {
  ctx.save(); ctx.translate(c.x, c.y); ctx.scale(1.25, 1.25);
  ctx.lineJoin = 'round'; ctx.lineWidth = 2.6; ctx.strokeStyle = C.ink;
  if (c.freed) { ctx.fillStyle = '#3a3566'; ellipse(0, 22, 30, 10); ctx.fill(); ctx.stroke(); ctx.restore(); return; }
  ctx.fillStyle = 'rgba(10,8,30,0.35)'; ellipse(0, 26, 32, 10); ctx.fill();
  ctx.fillStyle = '#3a3566'; rr(-30, 14, 60, 16, 7); ctx.fill(); ctx.stroke();
  drawChibi(0, 4, c.t, false, Math.PI / 2, c.look, { noShadow: true, noPack: true });
  ctx.fillStyle = 'rgba(190,240,255,0.22)'; rr(-26, -44, 52, 62, 22); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,177,46,0.85)'; ctx.lineWidth = 3;
  [-12, 0, 12].forEach(x => { ctx.beginPath(); ctx.moveTo(x, -40); ctx.lineTo(x, 14); ctx.stroke(); });
  ctx.fillStyle = Math.sin(c.t * 6) > 0 ? C.amber : '#7a5a2a'; circle(0, -48, 5); ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.stroke();
  const P = G.P;
  if (!c.icon && dist(P.x, P.y, c.x, c.y) < 260) {
    rr(-46, -92, 92, 30, 12); ctx.fillStyle = C.cream; ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5; ctx.stroke();
    txt('도와줘!', 0, -76, 16, C.ink, 'center');
  }
  ctx.restore();
}
function drawBoss(b) {
  const P = G.P;
  ctx.save();
  const bob = Math.sin(b.t * 2) * 5;
  const shakeX = b.dying > 0 ? rand(-6, 6) : 0;
  ctx.translate(b.x + shakeX, b.y + bob);
  ctx.fillStyle = 'rgba(10,8,30,0.35)'; ellipse(0, 130 - bob, 120, 22); ctx.fill();
  const img = IMG[b.def.img];
  if (img) {
    const h = 290, w = img.width / img.height * h;
    ctx.drawImage(img, -w / 2, -h / 2 - 10, w, h);
    if (b.flash > 0 || b.dying > 0) { ctx.globalAlpha = b.dying > 0 ? 0.3 + 0.3 * Math.sin(b.t * 30) : 0.55; ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(img, -w / 2, -h / 2 - 10, w, h); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
  } else drawBoss1Code(b, P);
  if (b.shield && b.dying <= 0) {
    const r = 152 + Math.sin(b.t * 3) * 3;
    ctx.fillStyle = 'rgba(255,177,46,0.12)'; circle(0, 0, r); ctx.fill();
    ctx.strokeStyle = 'rgba(255,200,90,0.85)'; ctx.lineWidth = 4; circle(0, 0, r); ctx.stroke();
    ctx.save(); circle(0, 0, r); ctx.clip();
    ctx.strokeStyle = 'rgba(255,220,140,0.28)'; ctx.lineWidth = 2;
    for (let yy = -r; yy < r; yy += 34) for (let xx = -r + ((yy / 34) & 1) * 20; xx < r; xx += 40) {
      ctx.beginPath(); for (let k = 0; k < 6; k++) { const an = k / 6 * TAU; ctx.lineTo(xx + Math.cos(an) * 18, yy + Math.sin(an) * 18); } ctx.closePath(); ctx.stroke();
    }
    ctx.restore();
  }
  if (b.breakT > 0) { ctx.strokeStyle = 'rgba(159,245,234,' + b.breakT + ')'; ctx.lineWidth = 8; circle(0, 0, 152 + (0.7 - b.breakT) * 200); ctx.stroke(); }
  if (b.stun > 0) txt('흔들림!', 0, -150, 22, C.tealL, 'center', { stroke: C.ink, sw: 5 });
  ctx.restore();
}
function drawBoss1Code(b, P) {
  ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = C.ink;
  const open = 8 + Math.sin(b.t * 2) * 2 + (b.pat && b.pat.kind === 'split' ? 8 : 0);
  const body = b.flash > 0 ? '#fff' : '#f1e8d8';
  ctx.fillStyle = 'rgba(255,177,46,0.45)'; ctx.fillRect(-open, -90, open * 2, 200);
  ctx.fillStyle = '#fff2c4'; ctx.fillRect(-2, -90, 4, 200);
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.moveTo(-open, -95); ctx.lineTo(-open - 50, -50); ctx.lineTo(-open - 78, 105); ctx.lineTo(-open, 105); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(open, -95); ctx.lineTo(open + 50, -50); ctx.lineTo(open + 78, 105); ctx.lineTo(open, 105); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = C.amber; ctx.fillRect(-open - 52, 20, 30, 5); ctx.fillRect(open + 22, 20, 30, 5);
  ctx.fillStyle = '#3a3566'; rr(-open - 130, -10, 60, 18, 6); ctx.fill(); ctx.stroke(); rr(open + 70, -10, 60, 18, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = C.amber; circle(-open - 134, -1, 7); ctx.fill(); circle(open + 134, -1, 7); ctx.fill();
  ctx.fillStyle = body; circle(0, -95, 34); ctx.fill(); ctx.stroke();
  drawEye(0, -95, 24, Math.atan2(P.y - b.y, P.x - b.x), b.t);
  ctx.beginPath(); ctx.moveTo(-26, -128); ctx.lineTo(-6, -118); ctx.moveTo(26, -128); ctx.lineTo(6, -118); ctx.stroke();
}
function drawLasers(b) {
  const a = G.L.arena;
  for (const l of b.lasers) {
    if (l.kind === 'v') {
      const y0 = b.y + 70;
      if (l.warn) { ctx.fillStyle = 'rgba(255,90,90,' + (0.25 + 0.25 * Math.sin(G.t * 30)) + ')'; ctx.fillRect(l.x - 3, y0, 6, a.h - y0); }
      else {
        ctx.fillStyle = 'rgba(255,160,40,0.3)'; ctx.fillRect(l.x - 26, y0, 52, a.h - y0);
        ctx.fillStyle = 'rgba(255,190,60,0.85)'; ctx.fillRect(l.x - 13, y0, 26, a.h - y0);
        ctx.fillStyle = '#fff6d6'; ctx.fillRect(l.x - 4, y0, 8, a.h - y0);
      }
    } else if (l.kind === 'h') {
      const segs = [[a.x, l.gap - 95], [l.gap + 95, a.x + a.w]];
      segs.forEach(([x0, x1]) => {
        if (l.warn) { ctx.fillStyle = 'rgba(255,90,90,' + (0.25 + 0.25 * Math.sin(G.t * 30)) + ')'; ctx.fillRect(x0, l.y - 3, x1 - x0, 6); }
        else {
          ctx.fillStyle = 'rgba(255,160,40,0.3)'; ctx.fillRect(x0, l.y - 22, x1 - x0, 44);
          ctx.fillStyle = 'rgba(255,190,60,0.85)'; ctx.fillRect(x0, l.y - 10, x1 - x0, 20);
          ctx.fillStyle = '#fff6d6'; ctx.fillRect(x0, l.y - 3, x1 - x0, 6);
        }
      });
      ctx.strokeStyle = 'rgba(159,245,234,0.9)'; ctx.lineWidth = 3; ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.moveTo(l.gap - 95, l.y - 26); ctx.lineTo(l.gap - 95, l.y + 26); ctx.moveTo(l.gap + 95, l.y - 26); ctx.lineTo(l.gap + 95, l.y + 26); ctx.stroke(); ctx.setLineDash([]);
    }
  }
}
function drawOrb(o) {
  const s = Math.min(1, o.born / 0.45), r = o.r * s;
  if (r < 2) return;
  const y = o.y + Math.sin(o.t * 2.2) * 4;
  ctx.save();
  ctx.fillStyle = 'rgba(159,245,234,' + (0.22 + 0.1 * Math.sin(o.t * 4)) + ')'; circle(o.x, y, r + 12); ctx.fill();
  ctx.save(); circle(o.x, y, r); ctx.clip();
  const img = photoOf(o.opt);
  if (img) drawCover(img, o.x - r, y - r, r * 2, r * 2);
  else {
    ctx.fillStyle = '#3b3570'; ctx.fillRect(o.x - r, y - r, r * 2, r * 2);
    ctx.fillStyle = C.cream; ctx.strokeStyle = C.ink; ctx.lineWidth = 2; rr(o.x - 13, y - 17, 26, 32, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#b8ad98'; ctx.fillRect(o.x - 8, y - 9, 16, 2.5); ctx.fillRect(o.x - 8, y - 3, 16, 2.5); ctx.fillRect(o.x - 8, y + 3, 11, 2.5);
  }
  ctx.restore();
  ctx.lineWidth = 4; ctx.strokeStyle = C.cream; circle(o.x, y, r); ctx.stroke();
  ctx.lineWidth = 2; ctx.strokeStyle = C.ink; circle(o.x, y, r + 2); ctx.stroke();
  if (s >= 1) {
    setFont(20, 900); const tw = ctx.measureText(o.opt.label).width + 26;
    rr(o.x - tw / 2, y + r + 8, tw, 34, 17); ctx.fillStyle = 'rgba(27,24,56,0.92)'; ctx.fill(); ctx.strokeStyle = C.cream; ctx.lineWidth = 2; ctx.stroke();
    txt(o.opt.label, o.x, y + r + 26, 20, C.cream, 'center', { weight: 900 });
  }
  ctx.restore();
}

/* ----- 화면 위 정보 (HUD) ----- */
function drawHUD() {
  const P = G.P, st = G.st;
  panel(14, 12, 340, 92, { fill: 'rgba(27,24,56,0.85)', r: 16 });
  ctx.save(); circle(54, 58, 32); ctx.fillStyle = '#3d3778'; ctx.fill(); ctx.clip();
  if (IMG.hero) drawCover(IMG.hero, 22, 26, 64, 64, 1);
  else drawChibi(54, 76, G.t, false, 0, HERO_LOOK, { scale: 1.5, noShadow: true, noPack: true });
  ctx.restore();
  ctx.lineWidth = 3; ctx.strokeStyle = C.cream; circle(54, 58, 32); ctx.stroke();
  txt('Lv ' + G.level, 98, 32, 19, C.mustard, 'left');
  if (save.difficulty === 'easy') txt('쉬움', 340, 32, 15, C.tealL, 'right', { weight: 700 });
  else for (let i = 0; i < 3; i++) drawHeart(286 + i * 22, 32, i < G.lives);
  const hpw = 236;
  rr(98, 46, hpw, 18, 9); ctx.fillStyle = 'rgba(10,8,30,0.8)'; ctx.fill();
  rr(98, 46, hpw * Math.max(0, P.hp / st.maxHp), 18, 9); ctx.fillStyle = P.hp / st.maxHp < 0.3 ? C.bad : C.hp; ctx.fill();
  txt(Math.max(0, Math.ceil(P.hp)) + ' / ' + st.maxHp, 98 + hpw / 2, 56, 13, C.white, 'center', { stroke: C.ink, sw: 3 });
  rr(98, 74, hpw, 9, 5); ctx.fillStyle = 'rgba(10,8,30,0.8)'; ctx.fill();
  rr(98, 74, hpw * Math.min(1, G.xp / xpNeed(G.level)), 9, 5); ctx.fillStyle = C.teal; ctx.fill();
  txt('XP', 98, 93, 11, '#bdb6e6', 'left', { weight: 700 });
  if (G.L.restrict && G.mode !== 'brief' && G.mode !== 'rules') {
    if (G.restricted) { panel(14, 110, 340, 34, { fill: 'rgba(90,25,30,0.88)', stroke: C.bad, r: 17, lw: 2 }); txt('지구 출신 · 이동 느림 · 대시 금지', 184, 127, 16, '#ffd0c8', 'center', { weight: 600 }); }
    else if (G.t - G.freeT < 6) { panel(14, 110, 340, 34, { fill: 'rgba(20,70,60,0.9)', stroke: C.good, r: 17, lw: 2 }); txt('제한 해제! 어디든 갈 수 있어요', 184, 127, 16, '#c8ffe4', 'center', { weight: 600 }); }
  }
  const recs = D.records.filter(r => r.stage === G.def.id), got = recs.filter(r => save.records[r.id]).length;
  panel(W - 304, 12, 236, 70, { fill: 'rgba(27,24,56,0.85)', r: 16 });
  txt(G.def.id + ' · ' + G.def.name, W - 290, 34, 18, C.cream, 'left');
  txt('기록 ' + got + '/' + recs.length + '   ' + fmtTime(G.time), W - 290, 62, 16, C.tealL, 'left', { weight: 700 });
  const pb = button(W - 60, 14, 46, 46, '', () => { if (G.mode === 'play') { G.mode = 'pause'; ui.focus = 0; } }, { focusable: false, draw: false });
  panel(W - 60, 14, 46, 46, { fill: pb.hover ? C.mustard : 'rgba(27,24,56,0.85)', r: 12 });
  ctx.fillStyle = pb.hover ? C.ink : C.cream; ctx.fillRect(W - 46, 26, 6, 22); ctx.fillRect(W - 34, 26, 6, 22);
  if (G.settlers.length) {
    const n = G.settlers.length, label = '동료 ' + n + '명 · 공격 +' + (n * 10) + '% · 막아 주기';
    setFont(17, 600); const lw2 = ctx.measureText(label).width;
    const pw2 = 30 + n * 28 + lw2 + 20;
    const bx2 = touchUI() ? 250 : 14;
    panel(bx2, H - 64, pw2, 50, { fill: 'rgba(27,24,56,0.85)', stroke: C.tealL, r: 14, lw: 2 });
    G.settlers.forEach((s, i) => { ctx.fillStyle = s.look.suit; circle(bx2 + 24 + i * 28, H - 39, 11); ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.stroke(); if (!(s.guardAt > G.t)) { ctx.strokeStyle = C.tealL; ctx.lineWidth = 2.5; circle(bx2 + 24 + i * 28, H - 39, 15); ctx.stroke(); } });
    txt(label, bx2 + 18 + n * 28, H - 39, 17, C.tealL, 'left', { weight: 600 });
  }
  let obj = '';
  if (G.boss && !G.boss.dead) obj = '';
  else if (G.coach && G.coach.steps[G.coach.step]) obj = '지금 할 일 ▶ ' + G.coach.steps[G.coach.step].title;
  else if (G.zoneIdx >= 0) {
    const w = wallById(G.zones[G.zoneIdx].exit);
    const left = w.gens.filter(id => G.gens.find(g => g.id === id).alive).length;
    const named = w.gens.map(id => G.gens.find(g => g.id === id)).find(g => g.alive && g.name);
    const chipsObj = '지금 할 일 ▶ 기록 칩 모두 모으기 (' + (fieldRecords().length - recordsLeft()) + '/' + fieldRecords().length + ')';
    const z0 = G.zones[G.zoneIdx], chipsHere = recordGateNeeded() && chipTargets().some(c => (c.y >= z0.y0 && c.y < z0.y1) || (zoneIndexAt(c.y) < G.zoneIdx && !G.restricted));
    obj = named && left === 1 ? '지금 할 일 ▶ ' + named.name + ' 부수기' : left ? '지금 할 일 ▶ 발생기 ' + left + '개 부수기' : ((chipsHere || (G.zoneIdx === G.zones.length - 1 && recordGateNeeded())) ? chipsObj : '지금 할 일 ▶ 위로 나아가기 ▲');
  } else if (!G.boss) obj = recordGateNeeded() ? '지금 할 일 ▶ 기록 칩 모두 모으기 (' + (fieldRecords().length - recordsLeft()) + '/' + fieldRecords().length + ')' : '지금 할 일 ▶ 보스 구역 문으로 들어가기 ▲';
  if (obj && G.mode !== 'brief' && G.mode !== 'rules' && !coachVisible()) { setFont(26, 900); const tw = ctx.measureText(obj).width + 64; panel(W / 2 - tw / 2, 10, tw, 56, { fill: 'rgba(27,24,56,0.95)', stroke: C.mustard, r: 28, lw: 4 }); txt(obj, W / 2, 39, 26, C.amberL, 'center', { weight: 900 }); }
  if (!G.boss && G.mode !== 'brief' && G.mode !== 'rules') drawMissionList();
  if (G.boss && !G.boss.dead) drawBossBar(G.boss);
  drawControls();
  if (G.banner) drawBanner(G.banner);

  if (G.toasts.length) drawToast(G.toasts[0]);
}
function drawHeart(x, y, full) {
  ctx.save(); ctx.translate(x, y); ctx.scale(0.8, 0.8);
  ctx.beginPath(); ctx.moveTo(0, 8); ctx.bezierCurveTo(-14, -2, -8, -14, 0, -6); ctx.bezierCurveTo(8, -14, 14, -2, 0, 8); ctx.closePath();
  ctx.fillStyle = full ? C.hp : '#4a4578'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = C.ink; ctx.stroke();
  ctx.restore();
}
function drawBossBar(b) {
  const x = 372, w = 536, y = 12;
  panel(x, y, w, 116, { fill: 'rgba(27,24,56,0.92)', r: 16 });
  txt(b.def.name, x + 18, y + 22, 19, C.amberL, 'left');
  txt(b.shield ? '방어막' : '공격 가능!', x + w - 18, y + 22, 16, b.shield ? C.amber : C.good, 'right');
  rr(x + 18, y + 38, w - 36, 14, 7); ctx.fillStyle = 'rgba(10,8,30,0.8)'; ctx.fill();
  rr(x + 18, y + 38, (w - 36) * Math.max(0, b.hp / b.maxHp), 14, 7); ctx.fillStyle = b.shield ? C.amber : C.red; ctx.fill();
  for (let k = 1; k < b.def.rounds.length; k++) { ctx.fillStyle = C.ink; ctx.fillRect(x + 18 + (w - 36) * k / b.def.rounds.length - 1, y + 38, 3, 14); }
  if (b.dying > 0) return;
  if (b.shield) {
    const claim = '「' + b.def.rounds[b.round].claim + '」';
    const lines = wrap(claim, w - 36, 22, 900);
    lines.slice(0, 2).forEach((l, i) => txt(l, x + w / 2, y + 72 + i * 28, 22, C.amberL, 'center', { weight: 900 }));
    if (lines.length < 2) txt('이 주장이 틀렸다는 증거 구슬에 닿으세요', x + w / 2, y + 100, 16, C.tealL, 'center', { weight: 600 });
  } else txt('지금이야! 공명파로 공격하세요', x + w / 2, y + 76, 20, C.good, 'center');
}
function drawControls() {
  if (G.mode !== 'play') return;
  const P = G.P, sk = G.skills[G.skillIdx];
  const crowd = G.eB.filter(b => dist(b.x, b.y, P.x, P.y) < 180).length;
  const hint = G.boss && !G.boss.dead && G.skillCd <= 0 && crowd >= 5 && !P.dead;
  if (hint) {
    const hx = touchUI() ? W - 270 : W - 64, hy = touchUI() ? H - 86 : H - 52;
    ctx.strokeStyle = 'rgba(159,245,234,' + (0.5 + 0.5 * Math.sin(G.t * 12)) + ')'; ctx.lineWidth = 6; circle(hx, hy, (touchUI() ? 66 : 46) + Math.sin(G.t * 12) * 4); ctx.stroke();
    txt(touchUI() ? "'파동' 버튼으로 탄 지우기!" : 'E: 공명 파동으로 탄 지우기!', hx - (touchUI() ? 0 : 20), hy - (touchUI() ? 84 : 66), 22, C.tealL, touchUI() ? 'center' : 'right', { weight: 900, stroke: C.ink, sw: 5 });
  }
  const dashR = P.dashCd > 0 ? P.dashCd / G.st.dashCd : 0, skR = G.skillCd > 0 ? G.skillCd / SKILLS[sk].cd : 0;
  if (touchUI()) {
    if (joy) {
      ctx.fillStyle = 'rgba(255,244,220,0.12)'; circle(joy.ox, joy.oy, 64); ctx.fill(); ctx.strokeStyle = 'rgba(255,244,220,0.5)'; ctx.lineWidth = 3; ctx.stroke();
      const dx = joy.x - joy.ox, dy = joy.y - joy.oy, d = Math.hypot(dx, dy), m = Math.min(d, 60);
      ctx.fillStyle = 'rgba(255,244,220,0.7)'; circle(joy.ox + (d ? dx / d * m : 0), joy.oy + (d ? dy / d * m : 0), 28); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(27,24,56,0.45)'; circle(150, H - 150, 72); ctx.fill();
      ctx.strokeStyle = 'rgba(255,244,220,0.6)'; ctx.lineWidth = 3; circle(150, H - 150, 72); ctx.stroke();
      ctx.fillStyle = 'rgba(255,244,220,0.55)'; circle(150, H - 150, 28); ctx.fill();
      ctx.fillStyle = 'rgba(255,244,220,0.7)';
      [0, 1, 2, 3].forEach(k => { const a = k * Math.PI / 2; ctx.save(); ctx.translate(150 + Math.cos(a) * 52, H - 150 + Math.sin(a) * 52); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-5, -8); ctx.lineTo(-5, 8); ctx.closePath(); ctx.fill(); ctx.restore(); });
      txt('끌어서 이동', 150, H - 62, 16, C.cream, 'center', { weight: 600, stroke: C.ink, sw: 4 });
    }
    touchBtn(W - 120, H - 120, 70, '대시', dashR, () => { touchAct.dash = true; }, G.restricted);
    touchBtn(W - 270, H - 86, 54, D.skills[sk].name.split(' ').pop(), skR, () => { touchAct.skill = true; });
    if (G.skills.length > 1) touchBtn(W - 262, H - 198, 30, '⇄', 0, () => { touchAct.swap = true; });
  } else {
    cdIcon(W - 150, H - 52, '대시', 'Shift', dashR);
    cdIcon(W - 64, H - 52, D.skills[sk].name, 'E', skR);
    if (G.skills.length > 1) txt('Q: 기술 바꾸기', W - 108, H - 108, 13, 'rgba(255,244,220,0.7)', 'center', { weight: 700 });
  }
}
function touchBtn(x, y, r, label, cdRatio, fn, locked) {
  button(x - r, y - r, r * 2, r * 2, '', fn, { focusable: false, draw: false });
  ctx.fillStyle = locked ? 'rgba(90,25,30,0.7)' : 'rgba(27,24,56,0.7)'; circle(x, y, r); ctx.fill();
  if (cdRatio > 0) { ctx.fillStyle = 'rgba(10,8,30,0.6)'; ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * cdRatio); ctx.closePath(); ctx.fill(); }
  ctx.strokeStyle = cdRatio > 0 ? 'rgba(255,244,220,0.35)' : C.tealL; ctx.lineWidth = 4; circle(x, y, r); ctx.stroke();
  txt(label, x, y, r > 40 ? 24 : 20, locked ? '#ffb3a8' : C.cream, 'center', { weight: 900 });
  if (locked) txt('금지', x, y + 26, 13, '#ffb3a8', 'center', { weight: 600 });
}
function cdIcon(x, y, name, key, cdRatio) {
  ctx.fillStyle = 'rgba(27,24,56,0.85)'; circle(x, y, 34); ctx.fill();
  if (cdRatio > 0) { ctx.fillStyle = 'rgba(10,8,30,0.75)'; ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, 34, -Math.PI / 2, -Math.PI / 2 + TAU * cdRatio); ctx.closePath(); ctx.fill(); }
  ctx.strokeStyle = cdRatio > 0 ? 'rgba(255,244,220,0.3)' : C.tealL; ctx.lineWidth = 3; circle(x, y, 34); ctx.stroke();
  txt(key, x, y - 6, 15, cdRatio > 0 ? '#8e87bd' : C.mustard, 'center');
  txt(name.length > 5 ? name.slice(0, 5) + '…' : name, x, y + 12, 12, C.cream, 'center', { weight: 700 });
}
function drawBanner(b) {
  const a = Math.min(1, b.t * 5, (b.dur - b.t) * 3);
  ctx.save(); ctx.globalAlpha = Math.max(0, a);
  const y = G.boss && !G.boss.dead ? 168 : (G && coachVisible() ? 190 : 150), sc = 1 + Math.max(0, 0.25 - b.t) * 1.2;
  ctx.translate(W / 2, y); ctx.scale(sc, sc);
  txt(b.title, 0, 0, 42, b.color, 'center', { weight: 900, stroke: C.ink, sw: 9 });
  ctx.restore();
  if (b.sub) {
    ctx.save(); ctx.globalAlpha = Math.max(0, a);
    const lines = wrap(b.sub, 900, 25, 600);
    const h = lines.length * 34 + 22;
    panel(W / 2 - 480, y + 34, 960, h, { fill: 'rgba(27,24,56,0.92)', r: 16, lw: 2 });
    lines.forEach((l, i) => txt(l, W / 2, y + 34 + 28 + i * 34, 25, C.cream, 'center', { weight: 600 }));
    ctx.restore();
  }
}
function toastDur(tt) { return tt.zone ? 2.4 : (G.toasts.length > 1 ? 4.5 : 6.5); }
const COACH_SHOW = 5;
function coachBarOn() { return false; }
function coachVisible() { return G.mode === 'play' && (G.tip || coachBarOn()); }
function drawToast(tt) {
  const d = toastDur(tt), inT = Math.min(1, tt.t * 5), outT = Math.min(1, (d - tt.t) * 4);
  const a = Math.max(0, Math.min(inT, outT));
  const lift = 0;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(0, (1 - a) * 40);
  if (tt.zone) {
    setFont(22, 600); const tw = ctx.measureText(tt.zone).width + 50;
    panel(W / 2 - tw / 2, H - 92 - lift, tw, 50, { fill: 'rgba(27,24,56,0.9)', r: 25, lw: 2 });
    txt(tt.zone, W / 2, H - 67 - lift, 22, C.cream, 'center', { weight: 600 });
  } else {
    const r = tt.rec, w = 900, h = 150;
    const x = W / 2 - w / 2 - (touchUI() && G.mode === 'play' ? 120 : 0), y = H - h - 16 - lift;
    panel(x, y, w, h, { fill: 'rgba(20,17,46,0.97)', stroke: C.tealL, r: 18, lw: 3 });
    drawPhotoBox(r, x + 14, y + 14, 168, 122, { r: 10 });
    rr(x + 200, y + 14, 94, 26, 13); ctx.fillStyle = C.tealL; ctx.fill();
    txt('지구 기록', x + 247, y + 27, 15, C.ink, 'center', { weight: 600 });
    txt(r.year + (r.place ? ' · ' + r.place : ''), x + 306, y + 27, 17, C.amberL, 'left', { weight: 600 });
    txt(r.title, x + 200, y + 64, 29, C.cream, 'left', { weight: 900 });
    para(r.line, x + 200, y + 102, w - 222, 21, '#f1ecff', 28, { weight: 600 });
  }
  ctx.restore();
}
function drawCoachBar() {
  let title, sub, badge;
  if (G.tip) { title = G.tip.title; sub = G.tip.sub; badge = '!'; }
  else if (coachBarOn()) { const st = G.coach.steps[G.coach.step]; if (!st) return; title = st.title; sub = st.sub(); badge = '▶'; }
  else return;
  const w = 560, x = W / 2 - w / 2, y = 10;
  const subLines = wrap(sub, w - 100, 17, 600).slice(0, 2), h = 50 + subLines.length * 24;
  const fade = G.tip ? Math.min(1, (G.tip.dur - G.tip.t) * 3) : Math.min(1, (COACH_SHOW - (G.t - G.coach.showAt)) * 3);
  ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, fade));
  const fl = G.coach && !G.tip ? Math.max(0, G.coach.flash) : 0;
  panel(x, y, w, h, { fill: 'rgba(20,17,46,0.96)', stroke: fl > 0 ? C.mustard : C.tealL, r: 20, lw: 3 + fl * 3 });
  ctx.fillStyle = badge === '!' ? C.tealL : C.mustard; circle(x + 42, y + 36, 24); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.stroke();
  txt(badge, x + 42, y + 37, badge === '!' ? 26 : 20, C.ink, 'center', { weight: 900 });
  txt(title, x + 80, y + 28, 23, badge === '!' ? C.tealL : C.mustard, 'left', { weight: 900 });
  subLines.forEach((l, i) => txt(l, x + 80, y + 56 + i * 24, 17, C.cream, 'left', { weight: 600 }));
  ctx.restore();
}
function drawMissionList() {
  const mainWalls = (G.L.missionWalls || ['wC', 'wB', 'wA']).map(wallById).filter(Boolean);
  const wallsDone = mainWalls.filter(w => !w.active).length;
  const recs = fieldRecords(), got = recs.filter(r => save.records[r.id]).length;
  const rounds = G.def.boss.rounds.length;
  const items = [
    { t: G.L.restrict ? '레이저 벽·분리선 끄기' : '레이저 벽 끄기', v: wallsDone + '/' + mainWalls.length, done: wallsDone === mainWalls.length },
    { t: '정착민 구하기', v: G.stats.rescued + '/' + G.caps.length, done: G.stats.rescued === G.caps.length, opt: true },
    { t: '기록 칩 모두 모으기', v: got + '/' + recs.length, done: got === recs.length }
  ];
  items.push({ t: '보스 「' + G.def.boss.name + '」 반박', v: '0/' + rounds, done: false });
  const cur = items.findIndex(i => !i.done && !i.opt);
  const sig = items.map(i => i.v).join('|');
  if (G.missionSig !== sig) { G.missionSig = sig; G.missionAt = G.t; }
  const open = G.missionPinned || G.t - (G.missionAt || 0) < 5;
  if (!open) {
    const st = button(W - 154, 90, 140, 34, '', () => { G.missionPinned = true; }, { focusable: false, draw: false });
    panel(W - 154, 90, 140, 34, { fill: st.hover ? 'rgba(60,52,120,0.9)' : 'rgba(27,24,56,0.75)', r: 17, lw: 2 });
    txt(touchUI() ? '미션 보기 ▾' : '미션 (Tab) ▾', W - 84, 107, 15, C.mustard, 'center', { weight: 600 });
    return;
  }
  if (G.missionPinned) button(W - 304, 90, 290, 30 + items.length * 30 + 10, '', () => { G.missionPinned = false; G.missionAt = -99; }, { focusable: false, draw: false });
  const x = W - 304, y = 90, w = 290, h = 30 + items.length * 30 + 10;
  panel(x, y, w, h, { fill: 'rgba(27,24,56,0.82)', r: 14, lw: 2 });
  txt('미션', x + 16, y + 20, 17, C.mustard, 'left', { weight: 900 });
  txt('(선택)은 안 해도 돼요', x + w - 14, y + 20, 12, '#a9a2d6', 'right', { weight: 400 });
  items.forEach((it, i) => {
    const yy = y + 48 + i * 30, isCur = i === cur;
    if (isCur) { rr(x + 8, yy - 13, w - 16, 26, 8); ctx.fillStyle = 'rgba(247,197,72,0.18)'; ctx.fill(); }
    txt(it.done ? '✓' : isCur ? '▶' : '·', x + 22, yy, 16, it.done ? C.good : isCur ? C.mustard : '#a9a2d6', 'center', { weight: 600 });
    txt((it.opt ? '(선택) ' : '') + it.t, x + 38, yy, 15, it.done ? '#8fd9b3' : C.cream, 'left', { weight: 600 });
    txt(it.v, x + w - 16, yy, 15, it.done ? '#8fd9b3' : C.amberL, 'right', { weight: 600 });
  });
}
function drawBrief() {
  modalStart(); dim(0.8);
  const d = G.def, m = d.mission || {};
  panel(50, 26, W - 100, H - 52, { fill: 'rgba(24,21,54,0.98)', r: 24 });
  txt('미션 ' + d.id + ' · ' + d.name, W / 2, 78, 44, C.mustard, 'center', { weight: 900, stroke: C.ink, sw: 6 });
  if (m.why) txt(m.why, W / 2, 126, 21, C.cream, 'center', { weight: 600 });
  rr(110, 148, W - 220, 50, 25); ctx.fillStyle = 'rgba(44,200,182,0.16)'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = C.tealL; ctx.stroke();
  txt('목표  ' + (m.goal || d.goal), W / 2, 174, 23, C.tealL, 'center', { weight: 600 });
  txt('화면에 나오는 것', 96, 226, 19, '#cfc8f2', 'left', { weight: 600 });
  const items = [
    { k: 'hero', n: '나 (정착촌 학생)', t: '공명기로 가장 가까운 적을 자동으로 쏴요' },
    { k: 'drone', n: '오더의 드론', t: '하얀 공 모양 기계. 주황 탄을 피하세요' },
    { k: 'gen', n: '발생기', t: '부수면 레이저 벽이 꺼져요 (노란 화살표)' },
    { k: 'wall', n: '레이저 벽', t: '길을 막는 주황 빛. 닿으면 아파요' },
    { k: 'chip', n: '기록 칩', t: '실제 지구 역사 기록. 모두 모아야 보스 문이 열려요' },
    { k: 'cap', n: '갇힌 정착민', t: '구하면 동료가 되어 같이 쏘고 막아 줘요' }
  ];
  items.forEach((it, i) => {
    const col = i % 3, row = Math.floor(i / 3), x = 90 + col * 372, y = 244 + row * 118, w = 356, h = 106;
    rr(x, y, w, h, 16); ctx.fillStyle = 'rgba(46,40,92,0.95)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,244,220,0.35)'; ctx.stroke();
    ctx.save(); circle(x + 52, y + h / 2, 42); ctx.fillStyle = '#2a2550'; ctx.fill(); ctx.clip(); drawLegendIcon(it.k, x + 52, y + h / 2); ctx.restore();
    txt(it.n, x + 106, y + 32, 22, C.cream, 'left', { weight: 900 });
    para(it.t, x + 106, y + 62, w - 118, 16, '#d8d1fa', 22, { weight: 600 });
  });
  const flow = G.L.restrict ? ['발생기 부수기', '분리선 끄기', '기록 칩 모두 모으기', '보스를 증거로 반박'] : ['발생기 부수기', '레이저 벽 통과', '기록 칩 모두 모으기', '보스를 증거로 반박'];
  const fw = 248, fg = 34, fx0 = W / 2 - (flow.length * fw + (flow.length - 1) * fg) / 2;
  flow.forEach((f, i) => {
    const x = fx0 + i * (fw + fg), y = 506, last = i === flow.length - 1;
    rr(x, y - 22, fw, 44, 22); ctx.fillStyle = last ? 'rgba(224,87,62,0.35)' : 'rgba(247,197,72,0.18)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = last ? C.red : C.mustard; ctx.stroke();
    txt((i + 1) + '. ' + f, x + fw / 2, y, 19, C.cream, 'center', { weight: 600 });
    if (!last) txt('▶', x + fw + fg / 2, y, 18, C.mustard, 'center');
  });
  const ctrl = touchUI() ? '이동: 왼쪽 화면 끌기  ·  공격: 자동  ·  대시(빨리 피하기)·공명 파동(탄 지우기): 오른쪽 아래 버튼' : '이동: WASD·방향키  ·  공격: 자동  ·  대시(빨리 피하기): Shift·Space  ·  공명 파동(탄 지우기): E';
  txt(ctrl, W / 2, 562, 18, '#cfc8f2', 'center', { weight: 600 });
  button(W / 2 - 140, 592, 280, 66, '출발!', () => openRules(), { size: 30 });
}
function drawLegendIcon(k, x, y) {
  const t = G.t;
  if (k === 'hero') drawHeroAt(x, y + 12, 0, t, false, 0, { noShadow: true });
  else if (k === 'drone') drawEnemy({ type: 'drone', x, y, r: 24, t, spawnT: 0, flash: 0, hp: 1, maxHp: 1 }, t);
  else if (k === 'gen') { ctx.save(); ctx.translate(x, y + 36); ctx.scale(0.62, 0.62); drawGen({ x: 0, y: 0, alive: true, hitT: 0, hp: 1, maxHp: 1, id: '', icon: true }); ctx.restore(); }
  else if (k === 'wall') { ctx.fillStyle = 'rgba(255,160,40,0.25)'; ctx.fillRect(x - 50, y - 16, 100, 32); ctx.fillStyle = 'rgba(255,177,46,0.75)'; ctx.fillRect(x - 50, y - 8, 100, 16); ctx.fillStyle = '#fff1c8'; ctx.fillRect(x - 50, y - 2, 100, 4); }
  else if (k === 'chip') drawChipIcon(x, y, 1.5, t);
  else if (k === 'cap') { ctx.save(); ctx.translate(x, y + 14); ctx.scale(0.62, 0.62); drawCapsule({ x: 0, y: 0, look: LOOKS[0], t, freed: false, icon: true }); ctx.restore(); }
}
function drawBossIntro() {
  const t = G.introT, b = G.boss;
  dim(Math.min(0.75, t * 2));
  const slide = Math.min(1, t * 3);
  ctx.save(); ctx.translate((1 - slide) * -300, 0);
  ctx.fillStyle = 'rgba(224,87,62,0.92)'; ctx.beginPath(); ctx.moveTo(0, 170); ctx.lineTo(W, 120); ctx.lineTo(W, 560); ctx.lineTo(0, 610); ctx.closePath(); ctx.fill();
  ctx.restore();
  const img = IMG[b.def.img];
  ctx.save(); ctx.translate((1 - slide) * 400, 0);
  if (img) drawContain(img, 690, 110, 520, 500);
  else { ctx.save(); ctx.translate(950, 380); ctx.scale(1.6, 1.6); drawBoss1Code({ t: G.t, flash: 0, pat: null, y: 0, x: 0 }, { x: 0, y: 200 }); ctx.restore(); }
  ctx.restore();
  ctx.save(); ctx.globalAlpha = Math.min(1, Math.max(0, (t - 0.25) * 3));
  txt('BOSS · 오더의 하위 모듈', 90, 250, 26, C.amberL, 'left', { weight: 900, stroke: C.ink, sw: 6 });
  txt(b.def.name, 90, 310, 64, C.cream, 'left', { weight: 900, stroke: C.ink, sw: 10 });
  para('「' + b.def.intro + '」', 92, 390, 560, 28, C.cream, 40, { stroke: C.ink, sw: 6 });
  ['① 보스가 주장을 외치면 방어막이 생겨요', '② 주장이 틀렸다는 증거 구슬에 몸으로 닿아요', '③ 방어막이 깨지면 공격! (틀린 구슬은 반격)', '④ 탄이 많으면 ' + (touchUI() ? "'파동' 버튼" : 'E') + '(공명 파동)로 지워요'].forEach((l, i) =>
    txt(l, 92, 444 + i * 34, 22, C.amberL, 'left', { stroke: C.ink, sw: 5 }));
  if (t > 0.7) txt('클릭 · Enter: 시작', 92, 590, 17, C.cream, 'left', { stroke: C.ink, sw: 4 });
  ctx.restore();
}
function recordLayout(r, ds) {
  const tw = W - 140 - 560, sz = { title: 46, line: 30, detail: ds };
  const tl = wrap(r.title, tw, sz.title, 900), ll = wrap(r.line, tw - 36, sz.line, 600), dl = wrap(r.detail, tw, sz.detail, 600);
  const dlh = Math.round(sz.detail * 1.45);
  const textH = 44 + tl.length * 56 + 10 + (ll.length * 42 + 28) + 26 + dl.length * dlh;
  return { tw, sz, tl, ll, dl, dlh, textH };
}
function drawRecordCard() {
  modalStart(); dim(0.74);
  const r = G.recView;
  let Lo = recordLayout(r, 28);
  if (Lo.textH > 520) Lo = recordLayout(r, 25);
  if (Lo.textH > 520) Lo = recordLayout(r, 22);
  // 사진 높이를 오른쪽 글 높이에 맞춘다
  const pw = 490, ph = clamp(Lo.textH, 320, 520);
  const contentH = Math.max(ph, Lo.textH);
  const x = 70, w = W - 140, h = Math.min(H - 16, 78 + contentH + 112), y = (H - h) / 2;
  const pop = Math.min(1, G.recT * 6);
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(0.9 + 0.1 * pop, 0.9 + 0.1 * pop); ctx.translate(-W / 2, -H / 2); ctx.globalAlpha = pop;
  panel(x, y, w, h, { fill: 'rgba(22,19,50,0.98)', stroke: C.tealL, r: 24, lw: 4 });
  rr(x + 30, y + 20, 210, 46, 23); ctx.fillStyle = C.tealL; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.stroke();
  txt(G.recFresh ? '지구 기록 획득!' : '지구 기록', x + 135, y + 43, 24, C.ink, 'center', { weight: 900 });
  txt('실제 역사 기록이에요', x + 258, y + 44, 21, '#bdb6e6', 'left', { weight: 600 });
  const px = x + 30, py = y + 82;
  const img = PHOTO[r.photo];
  if (img) { rr(px, py, pw, ph, 12); ctx.fillStyle = '#141228'; ctx.fill(); drawContain(img, px + 4, py + 4, pw - 8, ph - 8); rr(px, py, pw, ph, 12); ctx.lineWidth = 2.5; ctx.strokeStyle = C.ink; ctx.stroke(); }
  else drawPhotoBox(r, px, py, pw, ph, { r: 12 });
  const tx = x + 550, tw = Lo.tw;
  let yy = py + 18;
  txt(r.year + (r.place ? ' · ' + r.place : ''), tx, yy, 26, C.amberL, 'left', { weight: 600 });
  yy += 44;
  Lo.tl.forEach((l, i) => txt(l, tx, yy + i * 56, Lo.sz.title, C.cream, 'left', { weight: 900 }));
  yy += Lo.tl.length * 56 + 10 - 28;
  rr(tx - 4, yy, tw + 4, Lo.ll.length * 42 + 28, 14); ctx.fillStyle = 'rgba(247,197,72,0.15)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(247,197,72,0.65)'; ctx.stroke();
  Lo.ll.forEach((l, i) => txt(l, tx + 16, yy + 35 + i * 42, Lo.sz.line, C.amberL, 'left', { weight: 600 }));
  yy += Lo.ll.length * 42 + 28 + 26 + Lo.dlh / 2;
  Lo.dl.forEach((l, i) => txt(l, tx, yy + i * Lo.dlh, Lo.sz.detail, '#f1ecff', 'left', { weight: 600 }));
  ctx.restore();
  const left = readSec() - G.recT, bx = W / 2 - 160, by = y + h - 100;
  if (left > 0) {
    button(bx, by, 320, 68, '모으기 (' + Math.ceil(left) + ')', null, { size: 32, disabled: true });
    rr(bx + 14, by + 56, 292 * Math.min(1, G.recT / readSec()), 6, 3); ctx.fillStyle = C.tealL; ctx.fill();
    txt('기록을 읽어 보세요. 잠시 뒤에 모을 수 있어요', W / 2, y + h - 16, 18, '#bdb6e6', 'center', { weight: 600 });
  } else {
    button(bx, by, 320, 68, '모으기', () => closeRecord(), { size: 32 });
    txt('Enter · Space · 클릭', W / 2, y + h - 16, 18, '#bdb6e6', 'center', { weight: 600 });
  }
}
function drawLevelUp() {
  modalStart(); dim(0.7);
  txt('레벨 업!', W / 2, 120, 54, C.mustard, 'center', { weight: 900, stroke: C.ink, sw: 10 });
  txt('Lv ' + (G.level - G.pendingLv + 1) + '   ·   강화를 하나 고르세요', W / 2, 180, 22, C.cream, 'center');
  G.choices.forEach((u, i) => {
    const w = 320, h = 320, x = W / 2 - (w * 3 + 40) / 2 + i * (w + 20), y = 230;
    const st = button(x, y, w, h, '', () => { if (G.lvT > 0.45) chooseUpgrade(u); }, { draw: false });
    const lift = st.hot ? -8 : 0;
    panel(x, y + lift, w, h, { fill: st.hot ? 'rgba(70,60,140,0.97)' : 'rgba(36,31,74,0.96)', stroke: st.hot ? C.mustard : C.cream, lw: st.hot ? 5 : 3 });
    ctx.fillStyle = C.tealD; circle(x + w / 2, y + lift + 80, 46); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.stroke();
    drawUpIcon(u.id, x + w / 2, y + lift + 80);
    txt(u.name, x + w / 2, y + lift + 162, 26, C.cream, 'center', { weight: 900 });
    para(u.desc, x + w / 2, y + lift + 206, w - 40, 18, '#d8d1fa', 26, { align: 'center', weight: 700 });
    const cur = G.up[u.id] || 0;
    for (let k = 0; k < u.max; k++) { ctx.fillStyle = k < cur ? C.mustard : k === cur ? C.good : 'rgba(255,244,220,0.2)'; circle(x + w / 2 - (u.max - 1) * 11 + k * 22, y + lift + 280, 7); ctx.fill(); }
    txt(String(i + 1), x + 26, y + lift + 28, 20, C.amberL, 'center');
  });
  txt('클릭 · 1/2/3 · 방향키+Enter', W / 2, 600, 16, '#bdb6e6', 'center', { weight: 600 });
}
function drawUpIcon(id, x, y) {
  ctx.save(); ctx.translate(x, y);
  ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (id === 'ally') { ctx.fillStyle = C.tealL; circle(-12, 0, 13); ctx.fill(); ctx.stroke(); circle(14, -6, 9); ctx.fill(); ctx.stroke(); }
  else if (id === 'range') { ctx.strokeStyle = C.tealL; ctx.lineWidth = 4; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(-16, 0, 10 + k * 11, -0.7, 0.7); ctx.stroke(); } }
  else if (id === 'rate') { ctx.strokeStyle = C.tealL; ctx.lineWidth = 4; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(-18 + k * 14, 0, 12, -0.8, 0.8); ctx.stroke(); } }
  else if (id === 'dash') { ctx.fillStyle = C.mustard; ctx.beginPath(); ctx.moveTo(-20, -14); ctx.lineTo(4, 0); ctx.lineTo(-20, 14); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(24, 0); ctx.lineTo(0, 14); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  else if (id === 'hp') drawHeart(0, 2, true), ctx.scale(1, 1);
  else if (id === 'power') { ctx.fillStyle = C.mustard; ctx.beginPath(); ctx.moveTo(4, -24); ctx.lineTo(-12, 4); ctx.lineTo(0, 4); ctx.lineTo(-4, 24); ctx.lineTo(12, -4); ctx.lineTo(0, -4); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  else if (id === 'multi') { ctx.strokeStyle = C.tealL; ctx.lineWidth = 4; [-0.5, 0, 0.5].forEach(a => { ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-14 + Math.cos(a) * 34, Math.sin(a) * 34); ctx.stroke(); }); }
  else if (id === 'speed') { ctx.fillStyle = C.cream; rr(-6, -16, 22, 30, 8); ctx.fill(); ctx.stroke(); ctx.strokeStyle = C.tealL; ctx.lineWidth = 4; [-8, 0, 8].forEach(yy => { ctx.beginPath(); ctx.moveTo(-26, yy); ctx.lineTo(-12, yy); ctx.stroke(); }); }
  ctx.restore();
}
function drawPause() {
  modalStart(); dim(0.7);
  panel(W / 2 - 230, 90, 460, 560);
  txt('잠깐 멈춤', W / 2, 140, 38, C.cream, 'center', { weight: 900 });
  let y = 186;
  button(W / 2 - 170, y, 340, 58, '계속하기', () => { G.mode = 'play'; }); y += 70;
  button(W / 2 - 170, y, 340, 52, '지구 기록 보관소', () => openArchive(), { size: 21, fill: C.tealL }); y += 64;
  button(W / 2 - 170, y, 340, 52, Sound.on ? '소리: 켬' : '소리: 끔', () => Sound.toggle(), { size: 21, fill: '#d9d2f0' }); y += 64;
  button(W / 2 - 170, y, 340, 52, forceTouch ? '터치 버튼: 켬 (태블릿)' : '터치 버튼: 끔 (태블릿)', () => setForceTouch(!forceTouch), { size: 20, fill: forceTouch ? C.tealL : '#d9d2f0' }); y += 64;
  button(W / 2 - 170, y, 340, 52, '스테이지 고르기', () => go(() => SelectScene()), { size: 21 }); y += 64;
  txt('나가면 이번 스테이지 진행은 저장되지 않아요 (기록 칩은 저장돼요)', W / 2, y + 14, 14, '#bdb6e6', 'center', { weight: 600 });
}
function drawChange() {
  const t = G.clearT, d = G.def, ch = d.change;
  modalStart(); dim(Math.min(0.82, t * 1.5));
  const a = Math.min(1, t * 2);
  ctx.save(); ctx.globalAlpha = a;
  panel(40, 24, W - 80, H - 48, { fill: 'rgba(22,19,50,0.97)', stroke: C.mustard, r: 26, lw: 4 });
  txt(ch.title, W / 2, 78, 44, C.mustard, 'center', { weight: 900, stroke: C.ink, sw: 7 });
  txt('지구에서 사람들의 노력이 세상을 바꾼 것처럼, 화성도 바뀌었어요', W / 2, 126, 26, C.cream, 'center', { weight: 600 });
  // 왼쪽: 지구 (실제 기록)
  const lx = 80, ly = 156, lw = 540;
  rr(lx, ly, 200, 40, 20); ctx.fillStyle = C.tealL; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.stroke();
  txt('지구 · 실제 역사', lx + 100, ly + 20, 20, C.ink, 'center', { weight: 900 });
  (ch.earth || []).forEach((e, i) => {
    const show = Math.min(1, Math.max(0, (t - 0.5 - i * 0.5) * 3));
    if (show <= 0) return;
    ctx.globalAlpha = a * show;
    const y = ly + 58 + i * 106;
    rr(lx, y, lw, 94, 16); ctx.fillStyle = 'rgba(44,200,182,0.12)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(159,245,234,0.6)'; ctx.stroke();
    txt(e[0], lx + 20, y + 47, 40, C.tealL, 'left', { weight: 900 });
    const el = wrap(e[1], lw - 150, 28, 600);
    el.forEach((l, k) => txt(l, lx + 134, y + 47 + (k - (el.length - 1) / 2) * 34, 28, C.cream, 'left', { weight: 600 }));
  });
  ctx.globalAlpha = a;
  // 오른쪽: 화성 (우리 이야기)
  const rx = 660, rw = W - 80 - rx + 40 - 40;
  rr(rx, ly, 220, 40, 20); ctx.fillStyle = C.orange; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.stroke();
  txt('화성 · 우리 정착촌', rx + 110, ly + 20, 20, C.ink, 'center', { weight: 900 });
  const img = IMG[ch.img], iy = ly + 58, ih = 214;
  const show2 = Math.min(1, Math.max(0, (t - 1.6) * 2));
  ctx.globalAlpha = a * show2;
  if (img) { ctx.save(); rr(rx, iy, rw, ih, 16); ctx.clip(); drawCover(img, rx, iy, rw, ih); ctx.restore(); rr(rx, iy, rw, ih, 16); ctx.lineWidth = 3; ctx.strokeStyle = C.cream; ctx.stroke(); }
  else { rr(rx, iy, rw, ih, 16); ctx.fillStyle = '#2e2b52'; ctx.fill(); txt('모두의 길', rx + rw / 2, iy + ih / 2, 40, C.tealL, 'center', { weight: 900 }); }
  para(ch.mars, rx, iy + ih + 30, rw, 26, C.cream, 34, { weight: 600 });
  ctx.globalAlpha = a;
  txt('▶', 640, ly + 180, 40, C.mustard, 'center', { weight: 900 });
  ctx.restore();
  if (G.bossRec && t > 1.2) txt((G.bossRecFresh ? '새 기록 획득: ' : '기록: ') + G.bossRec.year + ' ' + G.bossRec.title + ' (기록 보관소에서 볼 수 있어요)', W / 2, H - 150, 21, C.tealL, 'center', { weight: 600 });
  if (t > 2) button(W / 2 - 140, H - 112, 280, 62, '다음 ▶', () => { G.clearStep = 1; G.clearT = 0; ui.focus = 0; }, { size: 26 });
}
function drawClear() {
  if (G.clearStep === 0) { drawChange(); return; }
  const t = G.clearT, d = G.def;
  modalStart(); dim(Math.min(0.8, t));
  const a = Math.min(1, t * 2);
  txt('보스 격파!', W / 2, 62, 50, C.mustard, 'center', { weight: 900, stroke: C.ink, sw: 9 });
  if (d.card) {
    const s = Math.min(1, Math.max(0.02, (t - 0.2) * 3));
    ctx.save(); ctx.translate(360, 0); ctx.scale(s, 1); drawCardArt(0, 104, 340, d.card, a); ctx.restore();
  }
  if (t > 0.6) {
    const x = 600;
    txt('제도 카드를 얻었어요!', x, 160, 38, C.cream, 'left', { weight: 900 });
    para('이 카드는 마지막에 만드는 「정착촌 헌장」의 제' + d.card.article + '조가 돼요. 다섯 운동의 제도 카드를 모아 헌장을 완성해요.', x, 220, 600, 25, '#e6e0ff', 36, { weight: 600 });
    txt('문제 → 사람들의 행동 → 제도', x, 340, 26, C.mustard, 'left', { weight: 900 });
    txt('기술 획득: ' + D.skills[d.skill].name, x, 400, 26, C.tealL, 'left', { weight: 600 });
    txt('운동 배지: ' + d.badge, x, 440, 26, C.amberL, 'left', { weight: 600 });
  }
  if (t > 1.2) button(640, 520, 320, 64, '결과 보기', () => { const r = resultData(); go(() => ResultScene(r)); }, { size: 28 });
}
function drawGameOver() {
  modalStart(); dim(0.78);
  txt('목숨을 모두 썼어요', W / 2, 220, 48, C.cream, 'center', { weight: 900, stroke: C.ink, sw: 9 });
  txt('스테이지를 처음부터 다시 해요. 모은 기록 칩은 그대로 남아요.', W / 2, 290, 24, '#d8d1fa', 'center', { weight: 600 });
  button(W / 2 - 180, 360, 360, 66, '처음부터 다시 시작', () => go(() => StageScene(G.def.id)), { size: 28 });
}

/* ---------------- 메인 루프 ---------------- */
let last = performance.now();
function frame(now) {
  let dt = (now - last) / 1000; last = now;
  if (!(dt > 0)) dt = 0;
  dt = Math.min(dt, 1 / 30);
  try {
    if (fadeNext) {
      fadeA += dt * 5;
      if (fadeA >= 1) { fadeA = 1; const make = fadeNext; fadeNext = null; overlay = null; setScene(make()); }
    } else if (fadeA > 0) fadeA = Math.max(0, fadeA - dt * 5);
    if (!fadeNext) { if (overlay) overlay.update(dt); else scene.update(dt); }
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    newButtons = []; focusCount = 0;
    scene.draw();
    if (overlay) overlay.draw();
    if (fadeA > 0) { ctx.fillStyle = 'rgba(14,12,32,' + fadeA + ')'; ctx.fillRect(0, 0, W, H); }
    hitButtons = newButtons;
  } catch (err) {
    console.error(err);
  }
  for (const k in pressed) delete pressed[k];
  taps = [];
  requestAnimationFrame(frame);
}
setScene(TitleScene());
requestAnimationFrame(frame);

if (DEBUG) {
  window.__colony = {
    get G() { return G; }, get scene() { return scene && scene.name; }, get save() { return save; },
    get mode() { return G && G.mode; }, get overlay() { return !!overlay; },
    start(id) { overlay = null; setScene(StageScene(id || 1)); },
    tp(x, y) { G.P.x = x; G.P.y = y; },
    god(on) { G.god = on !== false; },
    xp(n) { gainXp(n); },
    killGens(ids) { G.gens.forEach(g => { if (!ids || ids.includes(g.id)) damageGen(g, 9999); }); },
    bossHp(f) { const b = G.boss; b.hp = b.maxHp * f; },
    down() { playerDown(); },
    guide() { const g = guideGoal(); return g ? { x: g.x, y: g.y } : null; },
    reset() { save = defaultSave(); writeSave(); }
  };
}
})();
