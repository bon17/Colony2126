/* =====================================================================
   콜로니 2126 · 게임 엔진 (game.js)
   - 글자·문항은 data.js에 있습니다. 이 파일은 움직임과 그리기를 맡습니다.
   - 그림(img/)과 사진(photos/)이 없어도 코드로 그린 화면으로 돌아갑니다.
   ===================================================================== */
(function () {
'use strict';

const D = window.COLONY_DATA;
const W = 1280, H = 720, TAU = Math.PI * 2;
const FONT = '"Pretendard","Apple SD Gothic Neo","Malgun Gothic","NanumSquareRound","NanumGothic","Noto Sans KR","Noto Sans CJK KR",sans-serif';
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
['title', 'op1', 'op2', 'op3', 'map', 'boss1', 'boss2', 'boss3', 'boss4', 'boss5', 'boss_final', 'hero', 'ending1', 'ending2']
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
  usingTouch = e.pointerType === 'touch';
  pointer.x = p.x; pointer.y = p.y;
  for (let i = hitButtons.length - 1; i >= 0; i--) {
    const b = hitButtons[i];
    if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) { if (b.fn) { Sound.play('ui'); b.fn(); } return; }
  }
  if (e.pointerType === 'touch' && wantsJoystick() && p.x < W * 0.5 && !joy) {
    joy = { id: e.pointerId, ox: p.x, oy: p.y, x: p.x, y: p.y };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
    return;
  }
  taps.push(p);
});
canvas.addEventListener('pointermove', e => {
  const p = toGame(e);
  if (joy && e.pointerId === joy.id) { joy.x = p.x; joy.y = p.y; return; }
  if (e.pointerType !== 'touch') { pointer.x = p.x; pointer.y = p.y; }
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
function setFont(size, weight) { ctx.font = (weight || 800) + ' ' + size + 'px ' + FONT; }
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
  txt(label, x + w / 2, y + h / 2 + 1, o.size || 24, o.disabled ? '#a29cd0' : (o.color || C.ink), 'center');
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
      txt(D.title, W / 2 + 4, 118 + bob + 6, 92, 'rgba(23,138,128,0.9)', 'center', { weight: 900 });
      txt(D.title, W / 2, 118 + bob, 92, C.cream, 'center', { weight: 900, stroke: C.ink, sw: 12 });
      txt(D.subtitle, W / 2, 190 + bob, 26, C.amberL, 'center', { stroke: C.ink, sw: 6 });
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
    next() { if (this.done) return; this.i++; this.t = 0; if (this.i >= D.opening.length) { this.done = true; this.i = D.opening.length - 1; finish(); } },
    update(dt) {
      this.t += dt;
      if (this.t > 7.5 || (this.t > 0.4 && (hit('Enter') || hit('Space') || hit('ArrowRight') || taps.length))) this.next();
      if (hit('Escape')) { this.done = true; finish(); }
    },
    draw() {
      const cut = D.opening[this.i];
      if (IMG[cut.img]) drawCover(IMG[cut.img], 0, 0, W, H, 1.02 + this.t * 0.006);
      else drawMarsScene(this.t, { laser: this.i === 0, eyeColor: null });
      const g = ctx.createLinearGradient(0, H - 230, 0, H); g.addColorStop(0, 'rgba(20,16,50,0)'); g.addColorStop(1, 'rgba(20,16,50,0.92)');
      ctx.fillStyle = g; ctx.fillRect(0, H - 230, W, 230);
      const n = Math.min(cut.text.length, Math.floor(this.t * 28));
      para(cut.text.slice(0, n), W / 2, H - 112, 1000, 28, C.cream, 42, { align: 'center', stroke: C.ink, sw: 6 });
      for (let k = 0; k < D.opening.length; k++) { ctx.fillStyle = k === this.i ? C.mustard : 'rgba(255,244,220,0.4)'; circle(W / 2 - 24 + k * 24, H - 30, 6); ctx.fill(); }
      button(W - 190, 24, 166, 48, '건너뛰기 ▶▶', () => { this.done = true; finish(); }, { size: 18, focusable: false });
      txt('클릭·Enter: 다음', 24, H - 28, 15, 'rgba(255,244,220,0.7)', 'left', { weight: 600 });
    }
  };
}

/* ===== 스테이지 고르기 ===== */
function SelectScene() {
  return {
    name: 'select', t: 0,
    update(dt) { this.t += dt; menuNav(); if (hit('Escape')) go(() => TitleScene()); },
    draw() {
      if (IMG.map) drawCover(IMG.map, 0, 0, W, H); else drawMarsScene(this.t);
      dim(0.35);
      panel(24, 20, W - 48, 74, { fill: 'rgba(27,24,56,0.88)' });
      txt('스테이지 고르기', 50, 57, 32, C.cream, 'left', { weight: 900 });
      const cardsN = Object.keys(save.cards).length;
      txt('Lv ' + save.level + '   ·   제도 카드 ' + cardsN + '/5   ·   ' + (save.difficulty === 'easy' ? '쉬움' : '보통'), W - 50, 57, 21, C.amberL, 'right');
      const n = D.stages.length, cw = 192, gap = 12, x0 = (W - (n * cw + (n - 1) * gap)) / 2, y0 = 360, ch = 250;
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
        if (cleared) {
          rr(x + 30, y0 + lift + 180, cw - 60, 40, 20); ctx.fillStyle = C.good; ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5; ctx.stroke();
          txt('클리어 ✓', x + cw / 2, y0 + lift + 201, 19, C.ink, 'center');
        } else if (!s.ready) txt('준비 중', x + cw / 2, y0 + lift + 200, 19, '#8e87bd', 'center', { weight: 700 });
        else if (finalLocked) txt('다섯 곳을 깨면 열려요', x + cw / 2, y0 + lift + 200, 15, '#8e87bd', 'center', { weight: 700 });
        else txt('출발 ▶', x + cw / 2, y0 + lift + 200, 21, C.mustard, 'center');
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
        drawInstitutionCard(W / 2 - 330, 445, 300, 130, def.card, 1);
        txt('기술: ' + (D.skills[def.skill] ? D.skills[def.skill].name : ''), W / 2 + 10, 480, 23, C.tealL, 'left');
        txt('운동 배지: ' + def.badge, W / 2 + 10, 520, 23, C.amberL, 'left');
        txt('스테이지 고르기에서 Q로 기술을 바꿔요', W / 2 + 10, 556, 16, '#bdb6e6', 'left', { weight: 600 });
      }
      button(W / 2 - 300, 630, 280, 58, '스테이지 고르기', () => go(() => SelectScene()));
      button(W / 2 + 20, 630, 280, 58, '다시 하기', () => go(() => StageScene(r.id)), { fill: '#d9d2f0' });
    }
  };
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
  const L = {
    w: 1600, h: 3800, start: { x: 800, y: 3680 },
    arena: { x: 160, y: 0, w: 1280, h: 720 },
    solids: [ { x: 0, y: 0, w: 160, h: 800 }, { x: 1440, y: 0, w: 160, h: 800 }, { x: 160, y: 720, w: 400, h: 80 }, { x: 1040, y: 720, w: 400, h: 80 } ],
    walls: [], gens: [], zones: [], chips: [], caps: []
  };
  const wall = (id, x, y, w, h, gens, o) => L.walls.push(Object.assign({ id, x, y, w, h, gens, active: true, fade: 1 }, o || {}));
  const gen = (id, x, y, hp) => L.gens.push({ id, x, y, r: 32, hp: hp || 140, maxHp: hp || 140, alive: true, hitT: 0 });
  wall('wC', 0, 2796, 1600, 16, ['g1a', 'g1b']);
  gen('g1a', 380, 2930, 90); gen('g1b', 1220, 2930, 90);
  wall('wB', 0, 1796, 1600, 16, ['g2a', 'g2b', 'g2d']);
  wall('div', 792, 1812, 16, 838, ['g2d'], { divider: true });
  gen('g2d', 800, 2725, 160); gen('g2a', 300, 1930); gen('g2b', 1300, 1930);
  wall('wA', 0, 796, 1600, 16, ['g3a', 'g3b']);
  gen('g3a', 330, 935, 190); gen('g3b', 1270, 935, 190);
  wall('gate', 560, 712, 480, 16, [], { active: false, fade: 0, gate: true });
  L.zones = [
    { y0: 2812, y1: 3800, exit: 'wC', check: { x: 800, y: 3680 }, label: 'A 구역 · 정착민 등록소',
      pool: ['drone', 'drone', 'chaser'], max: 5, every: 3.6,
      initial: [['drone', 520, 3300], ['drone', 1080, 3260], ['drone', 800, 3060], ['chaser', 300, 3420]] },
    { y0: 1812, y1: 2796, exit: 'wB', check: { x: 640, y: 2760 }, label: 'B 구역 · 생활 구역',
      pool: ['drone', 'chaser', 'drone'], max: 7, every: 3.0,
      initial: [['turret', 300, 2110], ['turret', 1300, 2110], ['drone', 450, 2400], ['drone', 1150, 2350, 'r1_beach'], ['chaser', 650, 2200]] },
    { y0: 812, y1: 1796, exit: 'wA', check: { x: 800, y: 1740 }, label: 'C 구역 · 관리 구역',
      pool: ['drone', 'chaser', 'guard', 'drone'], max: 8, every: 2.8,
      initial: [['turret', 210, 1060], ['turret', 1390, 1060], ['guard', 800, 1150, 'r1_nobel'], ['drone', 500, 1400], ['drone', 1100, 1350], ['chaser', 800, 1520]] }
  ];
  L.chips = [ ['r1_sign', 800, 3470], ['r1_king', 1370, 3250], ['r1_civil', 170, 2450], ['r1_vote', 1430, 2400], ['r1_apartheid', 230, 1620], ['r1_robben', 1370, 1580] ]
    .map(c => ({ id: c[0], x: c[1], y: c[2], t: Math.random() * 5, got: false }));
  L.caps = [ [430, 2080, 0], [1170, 2080, 1], [800, 1300, 2] ].map(c => ({ x: c[0], y: c[1], look: LOOKS[c[2]], freed: false, t: Math.random() * 5 }));
  L.bossChip = 'r1_1994';
  [[560, 3560], [1040, 3380], [240, 3150], [1320, 3600], [560, 2380], [1040, 2380], [150, 2700], [1450, 2700], [520, 1200], [1080, 1200], [620, 1610], [980, 1610]]
    .forEach(c => L.solids.push({ x: c[0] - 28, y: c[1] - 28, w: 56, h: 56, crate: true }));
  L.props = [];
  for (let i = 0; i < 46; i++) {
    const x = 90 + (i * 389) % 1420, y = 860 + (i * 613) % 2900;
    if (Math.abs(y - 1804) < 60 || Math.abs(y - 2804) < 60) continue;
    L.props.push({ kind: i % 3 === 0 ? 'plant' : i % 3 === 1 ? 'vent' : 'lamp', x, y });
  }
  return L;
}
const LAYOUTS = { 1: layoutStage1 };

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
  banner('STAGE ' + def.id + ' · ' + def.name, def.goal, C.mustard, 3.2);
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
  for (const w of G.walls) if (w.active && pushOutRect(o, w.x, w.y, w.w, w.h)) touchedLaser = true;
  for (const g of G.gens) if (g.alive) pushOutCircle(o, g.x, g.y, g.r);
  if (isPlayer) {
    for (const c of G.caps) if (!c.freed) pushOutCircle(o, c.x, c.y, 24);
    if (G.boss && !G.boss.dead) pushOutCircle(o, G.boss.x, G.boss.y, 70);
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
function hurtPlayer(dmg, sx, sy, force) {
  const P = G.P;
  if (P.dead || G.god) return;
  if (!force && (P.inv > 0 || P.dashT > 0 || P.marchT > 0)) return;
  P.hp -= dmg; P.inv = 0.9; G.shake = Math.max(G.shake, 7);
  const a = Math.atan2(P.y - sy, P.x - sx);
  P.kx = Math.cos(a) * 280; P.ky = Math.sin(a) * 280;
  addText(P.x, P.y - 40, '-' + dmg, C.hp, 20);
  Sound.play('hit');
  if (P.hp <= 0) playerDown();
}
function playerDown() {
  const P = G.P;
  P.hp = 0; P.dead = true; P.deadT = 1.4; G.stats.downs++;
  G.eB = []; burst(P.x, P.y, C.tealL, 24, 260); burst(P.x, P.y, C.orange, 12, 200);
  if (save.difficulty !== 'easy') G.lives--;
}
function respawn() {
  const P = G.P;
  if (save.difficulty !== 'easy') { if (G.lives <= 0) { G.mode = 'gameover'; ui.focus = 0; return; } P.x = G.checkpoint.x; P.y = G.checkpoint.y; }
  P.dead = false; P.hp = G.st.maxHp; P.inv = 2.2; P.kx = P.ky = 0;
  G.eB = [];
  banner(save.difficulty === 'easy' ? '다시 일어났어요!' : '다시 도전!', save.difficulty === 'easy' ? '' : '남은 목숨 ' + G.lives, C.tealL, 1.6);
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
  G.skillCd = SKILLS[id].cd;
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
  G.toasts.push({ rec, t: 0, fresh });
  gainXp(fresh ? 15 : 5);
  Sound.play('pick');
}

/* ----- 보스 ----- */
const BOSS_POOLS = [['spread', 'ring'], ['spread', 'ring', 'split'], ['ring', 'split', 'sweep', 'spread'], ['split', 'sweep', 'ring', 'spread']];
function startBoss() {
  const gate = G.walls.find(w => w.gate); gate.active = true; gate.fade = 1;
  G.arenaLock = true; G.checkpoint = { x: 800, y: 620 };
  G.enemies.forEach(e => { if (!e.dead) { e.dead = true; burst(e.x, e.y, C.amber, 6, 150); } });
  G.eB = [];
  const hp = 4000 * G.hpMul;
  G.boss = { def: G.def.boss, x: 800, y: 255, hp, maxHp: hp, round: 0, shield: true, stun: 0, t: 0, pat: null, patT: 2.2,
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
    do { x = rand(a.x + 140, a.x + a.w - 140); y = rand(430, 650); tries++; }
    while (tries < 40 && (placed.some(p => dist(p.x, p.y, x, y) < 260) || dist(x, y, G.P.x, G.P.y) < 190));
    placed.push({ x, y });
    const ang = rand(0, TAU);
    b.orbs.push({ opt, x, y, vx: Math.cos(ang) * 38, vy: Math.sin(ang) * 38, r: 40, t: rand(0, 5), born: 0 });
  });
  b.orbsUp = true;
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
    banner('반박 성공!', o.good || '', C.good, 3.6);
    Sound.play('good');
  } else {
    G.stats.wrong++;
    b.orbs = b.orbs.filter(x => x !== orb);
    burst(orb.x, orb.y, C.bad, 20, 260);
    P.inv = 0;
    hurtPlayer(14, orb.x, orb.y, true);
    for (let k = 0; k < 10; k++) enemyShot(orb.x, orb.y, k / 10 * TAU, 120, 7);
    P.inv = 1.0;
    banner('반박 실패!', o.why || '', C.bad, 4.2);
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
    if (o.y < 410 || o.y > a.h - o.r - 30) { o.vy *= -1; o.y = clamp(o.y, 410, a.h - o.r - 30); }
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
      const sy = warn ? 390 : 390 + (p.t - 0.9) / 3.0 * (a.h - 390);
      b.lasers = [{ kind: 'h', y: sy, gap: p.gap, warn }];
      if (!warn && !P.dead && Math.abs(P.y - sy) < 10 + P.r * 0.7 && Math.abs(P.x - p.gap) > 95) hurtPlayer(15, P.x, sy - 20);
      if (p.t > 3.9) cool();
    }
  }
}
function stageClear() {
  G.mode = 'clear'; G.clearT = 0; ui.focus = 0;
  if (G.L.bossChip) collectRecord(G.L.bossChip);
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
  if (G.mode === 'play') updatePlay(dt);
  else if (G.mode === 'bossIntro') {
    G.introT += dt; updateFx(dt);
    if (G.introT > 3.4 || (G.introT > 0.7 && (hit('Enter') || hit('Space') || taps.length))) G.mode = 'play';
  } else if (G.mode === 'levelup') {
    G.lvT += dt;
    if (G.lvT > 0.45) {
      ['Digit1', 'Digit2', 'Digit3'].forEach((k, i) => { if (hit(k) && G.choices[i]) chooseUpgrade(G.choices[i]); });
      if (G.mode === 'levelup') menuNav();
    }
  } else if (G.mode === 'clear') { G.clearT += dt; updateFx(dt); if (G.clearT > 1.2) menuNav(); }
  else if (G.mode === 'pause' || G.mode === 'gameover') menuNav();
  touchAct.dash = touchAct.skill = touchAct.swap = false;
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
    P.deadT -= dt;
    if (P.deadT <= 0) respawn();
  } else {
    if ((hit('ShiftLeft') || hit('ShiftRight') || hit('Space') || touchAct.dash) && P.dashCd <= 0) {
      P.dashT = 0.18; P.dashCd = st.dashCd; P.dashDir = P.moving ? { x: P.last.x, y: P.last.y } : { x: Math.cos(P.aim), y: Math.sin(P.aim) };
      burst(P.x, P.y, C.tealL, 8, 160, 4);
    }
    if (hit('KeyE') || touchAct.skill) useSkill();
    if ((hit('KeyQ') || touchAct.swap) && G.skills.length > 1) { G.skillIdx = (G.skillIdx + 1) % G.skills.length; addText(P.x, P.y - 50, D.skills[G.skills[G.skillIdx]].name, C.tealL, 18); }
    let spd = st.speed * (P.marchT > 0 ? 1.25 : 1);
    let vx = mx * spd, vy = my * spd;
    if (P.dashT > 0) { P.dashT -= dt; vx = P.dashDir.x * spd * 3.2; vy = P.dashDir.y * spd * 3.2; if (Math.random() < 0.6) G.parts.push({ x: P.x, y: P.y, vx: 0, vy: 0, life: 0.25, t: 0, color: 'rgba(159,245,234,0.8)', size: 9 }); }
    vx += P.kx; vy += P.ky; P.kx *= Math.pow(0.0008, dt); P.ky *= Math.pow(0.0008, dt);
    if (moveBody(P, vx * dt, vy * dt, true)) hurtPlayer(8, P.x, P.y + (P.y > G.cam.y + H / 2 ? 30 : -30));
  }
  if (P.dashCd > 0) P.dashCd -= dt;
  if (P.inv > 0) P.inv -= dt;
  if (P.marchT > 0) P.marchT -= dt;
  if (G.skillCd > 0) G.skillCd -= dt;
  // 자동 발사
  P.fireT -= dt; if (P.glow > 0) P.glow -= dt * 3;
  const target = P.dead ? null : findTarget(P.x, P.y, st.range);
  if (target) P.aim = Math.atan2(target.y - P.y, target.x - P.x); else if (P.moving) P.aim = Math.atan2(my, mx);
  if (target && P.fireT <= 0) { P.fireT = 1 / st.fireRate; fireWave(P.x + Math.cos(P.aim) * 18, P.y - 4 + Math.sin(P.aim) * 18, P.aim, st.dmg, st.multi, 'p'); P.glow = 1; }
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
    if (tg && s.fireT <= 0 && !P.dead) { s.fireT = 1.0; fireWave(s.x, s.y - 6, s.aim, st.dmg * 0.55, 1, 's', 320); }
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
    if (G.walls.some(w => w.active && inRectPad(b.x, b.y, w, 4)) || G.L.solids.some(s => inRectPad(b.x, b.y, s, 0))) { b.life = 0; burst(b.x, b.y, C.tealL, 3, 90, 3); continue; }
    for (const e of G.enemies) { if (e.dead || e.spawnT > 0) continue; if (dist(b.x, b.y, e.x, e.y) < e.r + b.r) { damageEnemy(e, b.dmg); b.life = 0; burst(b.x, b.y, C.tealL, 3, 100, 3); break; } }
    if (b.life <= 0) continue;
    for (const g of G.gens) {
      if (!g.alive) continue;
      if (dist(b.x, b.y, g.x, g.y - 22) < g.r + b.r) { damageGen(g, b.dmg); b.life = 0; burst(b.x, b.y, C.amber, 3, 100, 3); break; }
    }
    if (b.life <= 0) continue;
    const bo = G.boss;
    if (bo && !bo.dead && bo.dying <= 0 && dist(b.x, b.y, bo.x, bo.y) < (bo.shield ? 128 : 84) + b.r) { damageBoss(b.dmg, b.x, b.y); b.life = 0; }
  }
  G.pB = G.pB.filter(b => b.life > 0);
  // 적 탄
  for (const b of G.eB) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.x < -50 || b.y < -50 || b.x > L.w + 50 || b.y > L.h + 50) { b.life = 0; continue; }
    if (G.walls.some(w => w.active && inRectPad(b.x, b.y, w, 2)) || G.L.solids.some(s => inRectPad(b.x, b.y, s, 0))) { b.life = 0; continue; }
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
      burst(c.x, c.y, C.tealL, 24, 220); addText(c.x, c.y - 50, '정착민이 함께해요!', C.tealL, 22);
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
          const x = rand(80, L.w - 80), y = rand(z.y0 + 60, z.y1 - 60);
          if (dist(x, y, P.x, P.y) > 430 && !G.walls.some(w => w.active && inRectPad(x, y, w, 30)) && !G.L.solids.some(s => inRectPad(x, y, s, 30))) { spawnEnemy(pick(z.pool), x, y, G.zoneIdx); break; }
        }
      }
    }
  }
  if (!G.boss && !wallById('wA').active && P.y < 690 && !P.dead) startBoss();
  if (G.boss && !G.boss.dead) updateBoss(dt);
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
  for (const w of G.walls) {
    if (!w.active || w.gate || !w.gens.length) continue;
    if (w.gens.every(id => !G.gens.find(x => x.id === id).alive)) {
      w.active = false; w.fade = 1;
      if (w.divider) banner('분리선 해제!', '"' + G.def.signs.left + '"과 "' + G.def.signs.right + '"을 나누던 벽이 꺼졌어요', C.tealL, 3);
      else banner('레이저 벽 해제!', w.id === 'wA' ? '앞쪽 보스 구역으로 들어가세요' : '앞으로 나아가세요', C.mustard, 2.6);
    }
  }
}
function updateFx(dt) {
  for (const p of G.parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.9; p.vy *= 0.9; }
  G.parts = G.parts.filter(p => p.t < p.life);
  if (G.parts.length > 600) G.parts.splice(0, G.parts.length - 600);
  for (const t of G.texts) { t.t += dt; t.y -= 40 * dt; }
  G.texts = G.texts.filter(t => t.t < 1.1);
  if (G.banner) { G.banner.t += dt; if (G.banner.t > G.banner.dur) G.banner = null; }
  if (G.toasts.length) { const tt = G.toasts[0]; tt.t += dt; if (tt.t > (tt.zone ? 2.4 : (G.toasts.length > 1 ? 3 : 4.2))) G.toasts.shift(); }
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
  for (const c of G.chips) if (!c.got && vis(c.x, c.y, 60)) drawChipIcon(c.x, c.y + Math.sin(c.t * 3) * 4, 1, G.t);
  for (const gm of G.gems) if (vis(gm.x, gm.y, 20)) { ctx.save(); ctx.translate(gm.x, gm.y); ctx.rotate(G.t * 3); ctx.fillStyle = C.tealL; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(5, 0); ctx.lineTo(0, 6); ctx.lineTo(-5, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
  for (const c of G.caps) if (vis(c.x, c.y, 80)) drawCapsule(c);
  for (const g of G.gens) if (vis(g.x, g.y, 80)) drawGen(g);
  if (G.boss && !G.boss.dead) drawBoss(G.boss);
  const actors = [];
  for (const e of G.enemies) if (vis(e.x, e.y, 60)) actors.push({ y: e.y, f: () => drawEnemy(e, G.t) });
  G.settlers.forEach(s => actors.push({ y: s.y, f: () => drawChibi(s.x, s.y, s.t, s.moving, s.aim, s.look, { scale: 1.1, noPack: true }) }));
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
  drawHUD();
  if (G.mode === 'bossIntro') drawBossIntro();
  else if (G.mode === 'levelup') drawLevelUp();
  else if (G.mode === 'pause') drawPause();
  else if (G.mode === 'clear') drawClear();
  else if (G.mode === 'gameover') drawGameOver();
}
function guideGoal() {
  const P = G.P;
  if (G.boss || P.dead || G.mode !== 'play') return null;
  const z = G.zones[G.zoneIdx];
  if (!z) return { x: 800, y: 640 };
  const w = wallById(z.exit);
  if (w.active) {
    let best = null, bd = 1e9;
    G.gens.forEach(g => { if (g.alive && w.gens.includes(g.id)) { const d = dist(P.x, P.y, g.x, g.y); if (d < bd) { bd = d; best = g; } } });
    return best && bd > 420 ? { x: best.x, y: best.y } : null;
  }
  return G.zoneIdx === G.zones.length - 1 ? { x: 800, y: 700 } : { x: clamp(P.x, 240, 1360), y: z.y0 - 80 };
}
function drawGuide() {
  const g = guideGoal(), P = G.P;
  if (!g || dist(P.x, P.y, g.x, g.y) < 170) return;
  const a = Math.atan2(g.y - P.y, g.x - P.x), r = 74 + Math.sin(G.t * 6) * 6;
  ctx.save(); ctx.translate(P.x + Math.cos(a) * r, P.y - 6 + Math.sin(a) * r); ctx.rotate(a);
  ctx.globalAlpha = 0.85; ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.fillStyle = C.mustard;
  ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-8, -13); ctx.lineTo(-3, 0); ctx.lineTo(-8, 13); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
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
function drawFloor(cam) {
  ctx.fillStyle = '#211d45'; ctx.fillRect(0, 0, W, H);
  const s = 80, x0 = Math.floor(cam.x / s) * s, y0 = Math.floor(cam.y / s) * s;
  for (let y = y0; y < cam.y + H + s; y += s) {
    for (let x = x0; x < cam.x + W + s; x += s) {
      const k = ((x / s) * 7 + (y / s) * 13) & 7;
      ctx.fillStyle = k === 0 ? '#332e63' : k === 3 ? '#2b2759' : '#2e2a5d';
      ctx.fillRect(x - cam.x + 2, y - cam.y + 2, s - 4, s - 4);
      if (k === 5) { ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(x - cam.x + 10, y - cam.y + 10, 4, 4); ctx.fillRect(x - cam.x + s - 14, y - cam.y + s - 14, 4, 4); }
    }
  }
}
function drawWorldDecor() {
  const L = G.L;
  ctx.strokeStyle = 'rgba(247,197,72,0.18)'; ctx.lineWidth = 4; ctx.setLineDash([26, 22]);
  ctx.beginPath(); ctx.moveTo(200, 820); ctx.lineTo(200, L.h); ctx.moveTo(1400, 820); ctx.lineTo(1400, L.h); ctx.stroke();
  ctx.setLineDash([]);
  G.zones.forEach((z, i) => txt(['A', 'B', 'C'][i] + ' 구역', 800, z.y1 - 70, 64, 'rgba(255,244,220,0.07)', 'center', { weight: 900 }));
  const div = wallById('div');
  if (div) {
    const merged = !div.active;
    const s = G.def.signs;
    [[400, s.left], [1200, s.right]].forEach(([x, label]) => {
      const y = 2560;
      ctx.save(); ctx.translate(x, y);
      rr(-120, -34, 240, 68, 14); ctx.fillStyle = merged ? 'rgba(44,200,182,0.25)' : 'rgba(255,177,46,0.22)'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = merged ? C.tealL : C.amber; ctx.stroke();
      txt(merged ? s.merged : label, 0, 2, 30, merged ? C.tealL : C.amberL, 'center', { weight: 900 });
      ctx.restore();
    });
  }
  const a = L.arena;
  ctx.save();
  ctx.fillStyle = 'rgba(15,12,36,0.45)'; ctx.fillRect(a.x, a.y, a.w, a.h);
  ctx.strokeStyle = 'rgba(255,177,46,0.16)'; ctx.lineWidth = 3;
  for (let r = 120; r < 700; r += 110) { circle(800, 300, r); ctx.stroke(); }
  ctx.restore();
  for (const p of L.props || []) drawProp(p);
  for (const s of L.solids) {
    if (s.crate) { drawCrate(s); continue; }
    ctx.fillStyle = '#171433'; ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.fillStyle = '#2c2758'; ctx.fillRect(s.x, s.y + s.h - 10, s.w, 10);
    ctx.save(); ctx.beginPath(); ctx.rect(s.x, s.y + s.h - 10, s.w, 10); ctx.clip();
    ctx.fillStyle = 'rgba(247,197,72,0.55)';
    for (let x = s.x - 20; x < s.x + s.w; x += 28) { ctx.beginPath(); ctx.moveTo(x, s.y + s.h); ctx.lineTo(x + 10, s.y + s.h - 10); ctx.lineTo(x + 22, s.y + s.h - 10); ctx.lineTo(x + 12, s.y + s.h); ctx.closePath(); ctx.fill(); }
    ctx.restore();
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
  const c = G.cam; if (p.x < c.x - 60 || p.x > c.x + W + 60 || p.y < c.y - 80 || p.y > c.y + H + 60) return;
  ctx.save(); ctx.translate(p.x, p.y); ctx.lineJoin = 'round'; ctx.lineWidth = 2.5; ctx.strokeStyle = C.ink;
  if (p.kind === 'vent') {
    ctx.fillStyle = '#25214c'; rr(-26, -16, 52, 32, 6); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 3;
    for (let k = -16; k <= 16; k += 8) { ctx.beginPath(); ctx.moveTo(k, -10); ctx.lineTo(k, 10); ctx.stroke(); }
  } else if (p.kind === 'plant') {
    ctx.fillStyle = 'rgba(10,8,30,0.3)'; ellipse(0, 14, 22, 7); ctx.fill();
    ctx.fillStyle = '#5ec27f'; circle(-8, -10, 11); ctx.fill(); ctx.stroke(); circle(8, -12, 12); ctx.fill(); ctx.stroke(); circle(0, -20, 11); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ec6f9f'; circle(-4, -18, 3); ctx.fill(); circle(9, -8, 3); ctx.fill();
    ctx.fillStyle = C.cream; rr(-16, -4, 32, 18, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.teal; ctx.fillRect(-16, 2, 32, 4);
  } else {
    ctx.fillStyle = 'rgba(255,226,154,0.13)'; circle(0, 0, 46); ctx.fill();
    ctx.fillStyle = 'rgba(10,8,30,0.3)'; ellipse(0, 6, 12, 4); ctx.fill();
    ctx.fillStyle = '#3a3566'; rr(-3, -40, 6, 44, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.amberL; circle(0, -44, 8); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}
function drawWall(w) {
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
  ctx.save(); ctx.translate(g.x + (g.hitT > 0 ? rand(-2, 2) : 0), g.y); ctx.scale(1.25, 1.25);
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
  if (dist(P.x, P.y, c.x, c.y) < 260) {
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
    const h = 236, w = img.width / img.height * h;
    ctx.drawImage(img, -w / 2, -h / 2 - 10, w, h);
    if (b.flash > 0 || b.dying > 0) { ctx.globalAlpha = b.dying > 0 ? 0.3 + 0.3 * Math.sin(b.t * 30) : 0.55; ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(img, -w / 2, -h / 2 - 10, w, h); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
  } else drawBoss1Code(b, P);
  if (b.shield && b.dying <= 0) {
    const r = 128 + Math.sin(b.t * 3) * 3;
    ctx.fillStyle = 'rgba(255,177,46,0.12)'; circle(0, 0, r); ctx.fill();
    ctx.strokeStyle = 'rgba(255,200,90,0.85)'; ctx.lineWidth = 4; circle(0, 0, r); ctx.stroke();
    ctx.save(); circle(0, 0, r); ctx.clip();
    ctx.strokeStyle = 'rgba(255,220,140,0.28)'; ctx.lineWidth = 2;
    for (let yy = -r; yy < r; yy += 34) for (let xx = -r + ((yy / 34) & 1) * 20; xx < r; xx += 40) {
      ctx.beginPath(); for (let k = 0; k < 6; k++) { const an = k / 6 * TAU; ctx.lineTo(xx + Math.cos(an) * 18, yy + Math.sin(an) * 18); } ctx.closePath(); ctx.stroke();
    }
    ctx.restore();
  }
  if (b.breakT > 0) { ctx.strokeStyle = 'rgba(159,245,234,' + b.breakT + ')'; ctx.lineWidth = 8; circle(0, 0, 128 + (0.7 - b.breakT) * 200); ctx.stroke(); }
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
    setFont(16); const tw = ctx.measureText(o.opt.label).width + 22;
    rr(o.x - tw / 2, y + r + 8, tw, 28, 14); ctx.fillStyle = 'rgba(27,24,56,0.92)'; ctx.fill(); ctx.strokeStyle = C.cream; ctx.lineWidth = 2; ctx.stroke();
    txt(o.opt.label, o.x, y + r + 23, 16, C.cream, 'center');
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
  const recs = D.records.filter(r => r.stage === G.def.id), got = recs.filter(r => save.records[r.id]).length;
  panel(W - 304, 12, 236, 70, { fill: 'rgba(27,24,56,0.85)', r: 16 });
  txt(G.def.id + ' · ' + G.def.name, W - 290, 34, 18, C.cream, 'left');
  txt('기록 ' + got + '/' + recs.length + '   ' + fmtTime(G.time), W - 290, 62, 16, C.tealL, 'left', { weight: 700 });
  const pb = button(W - 60, 14, 46, 46, '', () => { if (G.mode === 'play') { G.mode = 'pause'; ui.focus = 0; } }, { focusable: false, draw: false });
  panel(W - 60, 14, 46, 46, { fill: pb.hover ? C.mustard : 'rgba(27,24,56,0.85)', r: 12 });
  ctx.fillStyle = pb.hover ? C.ink : C.cream; ctx.fillRect(W - 46, 26, 6, 22); ctx.fillRect(W - 34, 26, 6, 22);
  if (G.settlers.length) {
    panel(14, H - 62, 54 + G.settlers.length * 30, 48, { fill: 'rgba(27,24,56,0.8)', r: 14 });
    txt('연대', 28, H - 38, 16, C.tealL, 'left');
    G.settlers.forEach((s, i) => { ctx.fillStyle = s.look.suit; circle(84 + i * 30, H - 38, 11); ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.stroke(); });
  }
  let obj = '';
  if (G.boss && !G.boss.dead) obj = '';
  else if (G.zoneIdx >= 0) {
    const w = wallById(G.zones[G.zoneIdx].exit);
    const left = w.gens.filter(id => G.gens.find(g => g.id === id).alive).length;
    obj = left ? '레이저 벽 발생기 ' + left + '개 남음' : '앞으로 나아가세요 ▲';
  } else if (!G.boss) obj = '보스 구역으로 들어가세요 ▲';
  if (obj) { setFont(18); const tw = ctx.measureText(obj).width + 40; panel(W / 2 - tw / 2, 14, tw, 38, { fill: 'rgba(27,24,56,0.85)', r: 19, lw: 2 }); txt(obj, W / 2, 34, 18, C.amberL, 'center'); }
  if (G.boss && !G.boss.dead) drawBossBar(G.boss);
  drawControls();
  if (G.banner) drawBanner(G.banner);
  if (G.toasts.length) drawToast(G.toasts[0]);
  if (G.hintT > 0 && G.zoneIdx === 0 && G.mode === 'play' && !G.toasts.length) {
    const a = Math.min(1, G.hintT / 1.5);
    ctx.globalAlpha = a;
    const lines = usingTouch || isTouchDevice && !Object.keys(keys).length
      ? ['왼쪽 화면을 끌어서 이동 · 공격은 자동', '오른쪽 아래 버튼: 대시 · 기술']
      : ['이동: WASD 또는 방향키   ·   공격은 자동', '대시: Shift 또는 Space   ·   기술: E   ·   멈춤: Esc'];
    panel(W / 2 - 330, H - 128, 660, 84, { fill: 'rgba(27,24,56,0.85)', r: 16, lw: 2 });
    lines.forEach((l, i) => txt(l, W / 2, H - 102 + i * 32, 19, C.cream, 'center', { weight: 700 }));
    ctx.globalAlpha = 1;
  }
  if (P.dead) {
    dim(0.25);
    txt(save.difficulty === 'easy' ? '잠깐 쉬는 중…' : '쓰러졌어요!', W / 2, H / 2, 40, C.cream, 'center', { stroke: C.ink, sw: 8 });
  }
}
function drawHeart(x, y, full) {
  ctx.save(); ctx.translate(x, y); ctx.scale(0.8, 0.8);
  ctx.beginPath(); ctx.moveTo(0, 8); ctx.bezierCurveTo(-14, -2, -8, -14, 0, -6); ctx.bezierCurveTo(8, -14, 14, -2, 0, 8); ctx.closePath();
  ctx.fillStyle = full ? C.hp : '#4a4578'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = C.ink; ctx.stroke();
  ctx.restore();
}
function drawBossBar(b) {
  const x = 372, w = 536, y = 12;
  panel(x, y, w, 104, { fill: 'rgba(27,24,56,0.9)', r: 16 });
  txt(b.def.name, x + 18, y + 22, 19, C.amberL, 'left');
  txt(b.shield ? '방어막' : '공격 가능!', x + w - 18, y + 22, 16, b.shield ? C.amber : C.good, 'right');
  rr(x + 18, y + 38, w - 36, 14, 7); ctx.fillStyle = 'rgba(10,8,30,0.8)'; ctx.fill();
  rr(x + 18, y + 38, (w - 36) * Math.max(0, b.hp / b.maxHp), 14, 7); ctx.fillStyle = b.shield ? C.amber : C.red; ctx.fill();
  for (let k = 1; k < b.def.rounds.length; k++) { ctx.fillStyle = C.ink; ctx.fillRect(x + 18 + (w - 36) * k / b.def.rounds.length - 1, y + 38, 3, 14); }
  if (b.dying > 0) return;
  if (b.shield) {
    const claim = '「' + b.def.rounds[b.round].claim + '」';
    const lines = wrap(claim, w - 40, 18, 800);
    lines.slice(0, 2).forEach((l, i) => txt(l, x + w / 2, y + 68 + i * 24, 18, C.cream, 'center'));
    if (lines.length < 2) txt('맞는 증거 구슬에 몸으로 닿아 반박하세요', x + w / 2, y + 92, 14, C.tealL, 'center', { weight: 700 });
  } else txt('지금이야! 공명파로 공격하세요', x + w / 2, y + 76, 20, C.good, 'center');
}
function drawControls() {
  if (G.mode !== 'play') return;
  const P = G.P, sk = G.skills[G.skillIdx];
  const dashR = P.dashCd > 0 ? P.dashCd / G.st.dashCd : 0, skR = G.skillCd > 0 ? G.skillCd / SKILLS[sk].cd : 0;
  if (usingTouch || (isTouchDevice && !Object.keys(keys).length)) {
    if (joy) {
      ctx.fillStyle = 'rgba(255,244,220,0.12)'; circle(joy.ox, joy.oy, 64); ctx.fill(); ctx.strokeStyle = 'rgba(255,244,220,0.5)'; ctx.lineWidth = 3; ctx.stroke();
      const dx = joy.x - joy.ox, dy = joy.y - joy.oy, d = Math.hypot(dx, dy), m = Math.min(d, 60);
      ctx.fillStyle = 'rgba(255,244,220,0.7)'; circle(joy.ox + (d ? dx / d * m : 0), joy.oy + (d ? dy / d * m : 0), 28); ctx.fill();
    } else { ctx.strokeStyle = 'rgba(255,244,220,0.25)'; ctx.lineWidth = 3; circle(150, H - 150, 64); ctx.stroke(); txt('이동', 150, H - 150, 18, 'rgba(255,244,220,0.4)', 'center'); }
    touchBtn(W - 120, H - 120, 64, '대시', dashR, () => { touchAct.dash = true; });
    touchBtn(W - 260, H - 82, 50, D.skills[sk].name.split(' ').pop(), skR, () => { touchAct.skill = true; });
    if (G.skills.length > 1) touchBtn(W - 250, H - 190, 28, '⇄', 0, () => { touchAct.swap = true; });
  } else {
    cdIcon(W - 150, H - 52, '대시', 'Shift', dashR);
    cdIcon(W - 64, H - 52, D.skills[sk].name, 'E', skR);
    if (G.skills.length > 1) txt('Q: 기술 바꾸기', W - 108, H - 108, 13, 'rgba(255,244,220,0.7)', 'center', { weight: 700 });
  }
}
function touchBtn(x, y, r, label, cdRatio, fn) {
  button(x - r, y - r, r * 2, r * 2, '', fn, { focusable: false, draw: false });
  ctx.fillStyle = 'rgba(27,24,56,0.6)'; circle(x, y, r); ctx.fill();
  if (cdRatio > 0) { ctx.fillStyle = 'rgba(10,8,30,0.6)'; ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * cdRatio); ctx.closePath(); ctx.fill(); }
  ctx.strokeStyle = cdRatio > 0 ? 'rgba(255,244,220,0.35)' : C.tealL; ctx.lineWidth = 4; circle(x, y, r); ctx.stroke();
  txt(label, x, y, r > 40 ? 22 : 18, C.cream, 'center');
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
  const y = G.boss && !G.boss.dead ? 168 : 150, sc = 1 + Math.max(0, 0.25 - b.t) * 1.2;
  ctx.translate(W / 2, y); ctx.scale(sc, sc);
  txt(b.title, 0, 0, 42, b.color, 'center', { weight: 900, stroke: C.ink, sw: 9 });
  ctx.restore();
  if (b.sub) {
    ctx.save(); ctx.globalAlpha = Math.max(0, a);
    const lines = wrap(b.sub, 820, 20, 700);
    const h = lines.length * 28 + 18;
    panel(W / 2 - 440, y + 34, 880, h, { fill: 'rgba(27,24,56,0.85)', r: 14, lw: 2 });
    lines.forEach((l, i) => txt(l, W / 2, y + 34 + 23 + i * 28, 20, C.cream, 'center', { weight: 700 }));
    ctx.restore();
  }
}
function drawToast(tt) {
  const inT = Math.min(1, tt.t * 5), outT = tt.zone ? Math.min(1, (2.4 - tt.t) * 4) : Math.min(1, ((G.toasts.length > 1 ? 3 : 4.2) - tt.t) * 4);
  const a = Math.max(0, Math.min(inT, outT));
  ctx.save(); ctx.globalAlpha = a; ctx.translate(0, (1 - a) * 40);
  if (tt.zone) {
    setFont(22); const tw = ctx.measureText(tt.zone).width + 50;
    panel(W / 2 - tw / 2, H - 92, tw, 50, { fill: 'rgba(27,24,56,0.88)', r: 25, lw: 2 });
    txt(tt.zone, W / 2, H - 67, 22, C.cream, 'center');
  } else {
    const touchUI = usingTouch || (isTouchDevice && !Object.keys(keys).length);
    const r = tt.rec, x = W / 2 - 370 - (touchUI && G.mode === 'play' ? 110 : 0), y = H - 138, w = 740, h = 120;
    panel(x, y, w, h, { fill: 'rgba(27,24,56,0.94)', stroke: C.tealL, r: 16 });
    drawPhotoBox(r, x + 12, y + 12, 128, 96);
    txt(tt.fresh ? '지구 기록 획득!' : '다시 본 기록', x + 156, y + 24, 15, C.tealL, 'left');
    txt(r.year + ' · ' + r.title, x + 156, y + 50, 22, C.cream, 'left', { weight: 900 });
    para(r.line, x + 156, y + 80, w - 172, 17, '#ddd7fb', 22, { weight: 700 });
  }
  ctx.restore();
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
  txt('BOSS', 90, 250, 28, C.amberL, 'left', { stroke: C.ink, sw: 6 });
  txt(b.def.name, 90, 310, 64, C.cream, 'left', { weight: 900, stroke: C.ink, sw: 10 });
  para('「' + b.def.intro + '」', 92, 390, 560, 28, C.cream, 40, { stroke: C.ink, sw: 6 });
  txt('증거 구슬로 오더의 주장을 반박하세요!', 92, 500, 20, C.amberL, 'left', { stroke: C.ink, sw: 5 });
  ctx.restore();
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
  panel(W / 2 - 230, 110, 460, 500);
  txt('잠깐 멈춤', W / 2, 165, 38, C.cream, 'center', { weight: 900 });
  let y = 215;
  button(W / 2 - 170, y, 340, 58, '계속하기', () => { G.mode = 'play'; }); y += 72;
  button(W / 2 - 170, y, 340, 54, '지구 기록 보관소', () => openArchive(), { size: 21, fill: C.tealL }); y += 68;
  button(W / 2 - 170, y, 340, 54, Sound.on ? '소리: 켬' : '소리: 끔', () => Sound.toggle(), { size: 21, fill: '#d9d2f0' }); y += 68;
  button(W / 2 - 170, y, 340, 54, '스테이지 고르기', () => go(() => SelectScene()), { size: 21 }); y += 68;
  txt('나가면 이번 스테이지 진행은 저장되지 않아요 (기록 칩은 저장돼요)', W / 2, y + 14, 14, '#bdb6e6', 'center', { weight: 600 });
}
function drawClear() {
  const t = G.clearT, d = G.def;
  modalStart(); dim(Math.min(0.78, t));
  const a = Math.min(1, t * 2);
  txt('보스 격파!', W / 2, 92, 56, C.mustard, 'center', { weight: 900, stroke: C.ink, sw: 10 });
  if (t > 0.4 && d.card) {
    const s = Math.min(1, (t - 0.4) * 3);
    ctx.save(); ctx.translate(W / 2, 245); ctx.scale(s, 1);
    drawInstitutionCard(-230, -90, 460, 180, d.card, a);
    ctx.restore();
    txt('제도 카드를 얻었어요!', W / 2, 365, 24, C.cream, 'center');
  }
  if (t > 0.9) {
    txt('기술: ' + D.skills[d.skill].name + '   ·   운동 배지: ' + d.badge, W / 2, 408, 22, C.tealL, 'center');
    txt('문제 → 사람들의 행동 → 제도', W / 2, 446, 19, '#cfc8f2', 'center', { weight: 700 });
  }
  if (t > 1.2) button(W / 2 - 150, 490, 300, 60, '결과 보기', () => { const r = resultData(); go(() => ResultScene(r)); });
  if (G.toasts.length) drawToast(G.toasts[0]);
}
function drawGameOver() {
  modalStart(); dim(0.78);
  txt('목숨을 모두 썼어요', W / 2, 220, 48, C.cream, 'center', { weight: 900, stroke: C.ink, sw: 9 });
  txt('모은 기록은 저장되어 있어요. 다시 도전해 볼까요?', W / 2, 290, 22, '#d8d1fa', 'center', { weight: 700 });
  button(W / 2 - 300, 360, 280, 60, '다시 도전', () => go(() => StageScene(G.def.id)));
  button(W / 2 + 20, 360, 280, 60, '스테이지 고르기', () => go(() => SelectScene()), { fill: '#d9d2f0' });
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
    reset() { save = defaultSave(); writeSave(); }
  };
}
})();
