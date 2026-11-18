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
// 학생들은 주로 태블릿을 쓰므로 터치 버튼이 기본으로 켜져 있다(PC에서는 시작 화면에서 끌 수 있다)
try { const v = localStorage.getItem('colony2126.touch'); forceTouch = v === null ? true : v === '1'; } catch (e) { forceTouch = true; }
/* 전체화면: 버튼을 누른 그 순간(손가락·클릭 이벤트 안)에 요청해야 브라우저가 허락한다 */
const isFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
let fsNoteT = -1e9;
function toggleFullscreen() {
  try {
    if (isFullscreen()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
    const el = document.documentElement, rq = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!rq || document.fullscreenEnabled === false) { fsNoteT = performance.now(); return; }
    const p = rq.call(el);
    if (p && p.catch) p.catch(() => { fsNoteT = performance.now(); });
  } catch (e) { fsNoteT = performance.now(); }
}
function fsButton(x, y, w, h, size) {
  button(x, y, w, h, isFullscreen() ? '전체화면 끄기' : '전체화면', () => toggleFullscreen(), { size: size || 18, fill: '#d9d2f0' });
}
// 전체화면이 막힌 곳(일부 휴대폰, 다른 페이지 안에 들어간 화면)에서 누르면 잠깐 안내한다
function drawFsNote() {
  const t = (performance.now() - fsNoteT) / 1000; if (t > 3.5) return;
  ctx.save(); ctx.globalAlpha = Math.min(1, (3.5 - t) * 2);
  const s = '이 화면에서는 전체화면이 막혀 있어요. 브라우저 메뉴의 「전체 화면」을 써 주세요', tw = (setFont(18, 600), ctx.measureText(s).width + 40);
  panel(W / 2 - tw / 2, H - 140, tw, 44, { fill: 'rgba(27,24,56,0.96)', stroke: C.mustard, r: 22, lw: 2 });
  txt(s, W / 2, H - 118, 18, C.cream, 'center', { weight: 600 });
  ctx.restore();
}
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
// 스테이지 시작 전 상황 컷 그림(data.js의 intro)
D.stages.forEach(s => (s.intro || []).forEach(c => { if (c.img && !(c.img in IMG)) tryLoad(IMG, c.img, 'img/' + c.img, ['webp', 'jpg', 'png']); }));
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
// 소리: 효과음과 배경 음악을 따로 켜고 끈다. 둘 다 기본은 꺼짐(설정은 이 브라우저에만 저장)
// 소리 재료와 악보는 js/chip.js(ColonyChip). 효과음은 부드러운 전자음, 보스 음악만 옛날 게임기 소리
const SOUND_KEY = 'colony2126.sound.v1';
const Sound = {
  ac: null, sfxOn: false, bgmOn: false, master: null, sfxBus: null, bgmBus: null,
  track: null, bus: null, bar: 0, nextT: 0, lastSfx: {},
  load() { try { const o = JSON.parse(localStorage.getItem(SOUND_KEY) || '{}'); this.sfxOn = !!o.sfx; this.bgmOn = !!o.bgm; } catch (e) { /* 무시 */ } },
  store() { try { localStorage.setItem(SOUND_KEY, JSON.stringify({ sfx: this.sfxOn, bgm: this.bgmOn })); } catch (e) { /* 무시 */ } },
  // 소리 장치는 사용자가 처음 누를 때 만든다(브라우저 규칙)
  ensure() {
    if (!window.ColonyChip) return false;
    if (this.ac) { if (this.ac.state === 'suspended' && !document.hidden) this.ac.resume().catch(() => {}); return true; }
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const comp = ac.createDynamicsCompressor(); comp.connect(ac.destination);
      this.master = ac.createGain(); this.master.gain.value = 1; this.master.connect(comp);
      this.sfxBus = ac.createGain(); this.sfxBus.gain.value = 0.42; this.sfxBus.connect(this.master);
      this.bgmBus = ac.createGain(); this.bgmBus.gain.value = 0.2; this.bgmBus.connect(this.master);
      this.ac = ac; return true;
    } catch (e) { return false; }
  },
  setSfx(on) { this.sfxOn = on; this.store(); if (on && this.ensure()) this.play('ui'); },
  setBgm(on) { this.bgmOn = on; this.store(); if (on) this.ensure(); else this.stopMusic(); },
  play(kind) {
    if (!this.sfxOn || !this.ensure()) return;
    // 예전 이름 → 새 효과음. 자동 공격·드론 처치 소리는 넣지 않는다(계속 나서 시끄럽다)
    const name = { pick: 'record', hit: 'hurt' }[kind] || kind;
    if (!ColonyChip.SFX[name]) return;
    const now = this.ac.currentTime;
    if (this.lastSfx[name] && now - this.lastSfx[name] < 0.06) return;
    this.lastSfx[name] = now;
    try { ColonyChip.sfx(this.ac, this.sfxBus, name, now + 0.01, 'soft'); } catch (e) { /* 무시 */ }
  },
  stopMusic() {
    if (this.bus && this.ac) { const b = this.bus, t = this.ac.currentTime; b.gain.cancelScheduledValues(t); b.gain.setValueAtTime(b.gain.value, t); b.gain.linearRampToValueAtTime(0.0001, t + 0.6); setTimeout(() => { try { b.disconnect(); } catch (e) { /* 무시 */ } }, 900); }
    this.bus = null; this.track = null;
  },
  // 매 화면: 지금 장면에 맞는 곡을 고르고, 다음 마디를 미리 예약해 끝없이 이어 간다
  update(want, quiet) {
    if (!this.bgmOn || !this.ac || this.ac.state !== 'running') return;
    if (want !== this.track) {
      this.stopMusic();
      if (!want || !ColonyChip.SONGS[want]) return;
      this.track = want; this.bar = 0; this.nextT = this.ac.currentTime + 0.15;
      this.bus = this.ac.createGain(); this.bus.gain.value = 1; this.bus.connect(this.bgmBus);
    }
    const t = this.ac.currentTime;
    this.bus.gain.setTargetAtTime(quiet ? 0.45 : 1, t, 0.2);
    if (this.nextT < t) this.nextT = t + 0.05;
    let n = 0;
    while (this.nextT < t + 0.8 && n++ < 2) { try { this.nextT = ColonyChip.songBar(this.ac, this.bus, this.track, this.bar, this.nextT); } catch (e) { this.nextT = t + 2; } this.bar++; }
  }
};
Sound.load();
// 소리를 켜 둔 채 다시 열면, 처음 누를 때 소리 장치를 깨운다
['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, () => { if (Sound.sfxOn || Sound.bgmOn) Sound.ensure(); }, { passive: true }));
document.addEventListener('visibilitychange', () => {
  if (!Sound.ac) return;
  if (document.hidden) Sound.ac.suspend().catch(() => {}); else if (Sound.sfxOn || Sound.bgmOn) Sound.ac.resume().catch(() => {});
});

/* ---------------- 입력 ---------------- */
const keys = {}, pressed = {};
let taps = [];
const pointer = { x: -1, y: -1 };
let joy = null, dragId = null;
let hitButtons = [], newButtons = [], focusCount = 0;
const ui = { focus: 0 };
const touchAct = { dash: false, skill: false };

window.addEventListener('keydown', e => {
  // 엔딩의 글쓰기 칸에 쓰는 동안에는 게임 키로 받지 않는다
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
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
  // 끌어서 놓기(엔딩의 헌장 조립)
  if (!overlay && scene && scene.onDown && scene.onDown(p)) { dragId = e.pointerId; try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ } return; }
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
  if (dragId != null && e.pointerId === dragId) { if (scene && scene.onMove) scene.onMove(p); return; }
  if (e.pointerType === 'mouse') { pointer.x = p.x; pointer.y = p.y; }
});
const endPointer = e => {
  if (joy && e.pointerId === joy.id) joy = null;
  if (dragId != null && e.pointerId === dragId) { dragId = null; if (scene && scene.onUp) scene.onUp(toGame(e)); }
};
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
// drawCover처럼 꽉 채우되, 그림의 (fx, fy) 비율 지점이 가운데에 오도록 자른다. 그림 좌표를 화면 좌표로 바꾸는 함수를 돌려준다
function drawCoverAt(img, x, y, w, h, fx, fy, zoom) {
  const s = Math.max(w / img.width, h / img.height) * (zoom || 1), iw = img.width * s, ih = img.height * s;
  const ox = clamp(x + w / 2 - fx * iw, x + w - iw, x), oy = clamp(y + h / 2 - fy * ih, y + h - ih, y);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.drawImage(img, ox, oy, iw, ih); ctx.restore();
  return (u, v) => ({ x: ox + u * iw, y: oy + v * ih });
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
// 효과음·배경 음악 버튼 두 개(가로 w씩, 사이 14)
function soundButtons(x, y, w, h, size) {
  button(x, y, w, h, Sound.sfxOn ? '효과음: 켬' : '효과음: 끔', () => Sound.setSfx(!Sound.sfxOn), { size: size || 18, fill: Sound.sfxOn ? C.tealL : '#d9d2f0' });
  button(x + w + 14, y, w, h, Sound.bgmOn ? '배경 음악: 켬' : '배경 음악: 끔', () => Sound.setBgm(!Sound.bgmOn), { size: size || 18, fill: Sound.bgmOn ? C.tealL : '#d9d2f0' });
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
  if (o.bib != null) { ctx.fillStyle = '#fff'; rr(-7, -4, 14, 10, 2); ctx.fill(); ctx.lineWidth = 1.4; ctx.stroke(); ctx.lineWidth = 2.4; txt(String(o.bib), 0, 1.5, 8, C.ink, 'center', { weight: 900 }); }
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
  } else if (e.type === 'ejector') {
    const r = e.r;
    ctx.save(); ctx.rotate(aimA); ctx.fillStyle = flash ? '#fff' : C.mustard;
    [1, -1].forEach(s => { ctx.beginPath(); ctx.moveTo(r * 0.4, s * r * 0.45); ctx.quadraticCurveTo(r * 1.75, s * r * 1.25, r * 1.75, s * r * 0.12); ctx.lineTo(r * 1.3, s * r * 0.18); ctx.quadraticCurveTo(r * 1.25, s * r * 0.7, r * 0.5, s * r * 0.15); ctx.closePath(); ctx.fill(); ctx.stroke(); });
    ctx.restore();
    ctx.fillStyle = flash ? '#fff' : '#ffe9b0'; circle(0, 0, r * 0.9); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.red; ctx.fillRect(-r * 0.78, r * 0.3, r * 1.56, 3);
    drawEye(0, -1, r * 0.48, aimA, t);
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
  if (e.hp < e.maxHp && e.type !== 'chaser' && e.type !== 'ejector') {
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
      if (h > 70 && !rec.noPhoto) txt('사진 준비 중', x + w / 2, y + h / 2 + 22, Math.max(11, Math.min(15, w / 12)), 'rgba(255,244,220,0.6)', 'center');
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
function setScene(s) { if (scene && scene !== s && scene.removeInputs) scene.removeInputs(); scene = s; ui.focus = 0; joy = null; dragId = null; }
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
      soundButtons(W - 380, H - 66, 176, 46);
      button(W - 570, H - 66, 176, 46, forceTouch ? '터치 버튼: 켬' : '터치 버튼: 끔', () => setForceTouch(!forceTouch), { size: 18, fill: forceTouch ? C.tealL : '#d9d2f0' });
      fsButton(W - 760, H - 66, 176, 46);
      txt('버튼을 눌러 고르기 (키보드: 방향키 + Enter)', 24, H - 26, 15, 'rgba(255,244,220,0.75)', 'left', { weight: 600, stroke: 'rgba(20,16,50,0.7)', sw: 4 });
      drawFsNote();
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
      txt('화면을 눌러 다음 (키보드: Enter)', W / 2, H - 20, 16, 'rgba(255,244,220,0.8)', 'center', { weight: 600 });
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
// 단계별로 깬다: 앞 스테이지를 깨야 다음 스테이지가 열린다(종장은 다섯 곳을 모두 깨야). 열렸으면 null, 잠겼으면 안내 글
function stageLock(id) {
  const s = stageById(id);
  if (!s || !s.ready) return '준비 중';
  if (save.teacher) return null;   // 선생님 모드: 모든 스테이지가 열린다
  if (id === 6 && ![1, 2, 3, 4, 5].every(i => save.cleared[i])) return save.cleared[5] ? '다섯 곳을 깨면 열려요' : '5스테이지를 깨면 열려요';
  if (id > 1 && !save.cleared[id - 1]) return (id - 1) + '스테이지를 깨면 열려요';
  return null;
}
function SelectScene() {
  return {
    name: 'select', t: 0,
    update(dt) { this.t += dt; menuNav(); if (hit('Escape')) go(() => TitleScene()); },
    draw() {
      if (IMG.map) drawCover(IMG.map, 0, 0, W, H); else drawMarsScene(this.t);
      dim(0.35);
      panel(24, 20, W - 48, 96, { fill: 'rgba(27,24,56,0.9)' });
      txt('스테이지 고르기', 50, 54, 32, C.cream, 'left', { weight: 900 });
      // 선생님 모드: 제목을 빠르게 5번 누르면 모든 스테이지가 열린다(다시 5번 누르면 꺼진다)
      button(40, 26, 280, 52, '', () => {
        this.taps = (this.taps || []).filter(t => this.t - t < 2.5).concat(this.t);
        if (this.taps.length >= 5) { this.taps = []; save.teacher = !save.teacher; writeSave(); this.teacherT = this.t; }
      }, { draw: false, focusable: false });
      if (save.teacher) { rr(290, 38, 250, 30, 15); ctx.fillStyle = 'rgba(43,196,180,0.9)'; ctx.fill(); txt('선생님 모드 · 모두 열림', 415, 54, 16, C.ink, 'center', { weight: 900 }); }
      if (this.teacherT != null && this.t - this.teacherT < 2.5) txt(save.teacher ? '선생님 모드를 켰어요. 모든 스테이지가 열려요' : '선생님 모드를 껐어요', W / 2, 300, 24, C.tealL, 'center', { weight: 900, stroke: C.ink, sw: 6 });
      txt('효율만 따지는 오더 때문에 생긴 문제를, 지구 기록으로 하나씩 바꿔요', 50, 92, 19, C.tealL, 'left', { weight: 600 });
      const cardsN = Object.keys(save.cards).length;
      txt('Lv ' + save.level + '   ·   정착촌 헌장 ' + cardsN + '/5조   ·   ' + (save.difficulty === 'easy' ? '쉬움' : '보통'), W - 50, 54, 21, C.amberL, 'right');
      if (save.cleared[6]) button(W - 330, 72, 280, 38, '정착촌 헌장 보기 ▶', () => go(() => EndingScene({ at: 'result' })), { size: 18, fill: C.mustard });
      const own = ownedSkills();
      if (own.length) {
        panel(24, 130, W - 48, 64, { fill: 'rgba(20,60,56,0.9)', stroke: C.tealL, r: 18, lw: 2 });
        txt('얻은 기술', 50, 152, 19, C.tealL, 'left', { weight: 900 }); txt('자동으로 적용돼요', 50, 176, 14, '#c8f5ee', 'left', { weight: 600 });
        const cw2 = (W - 48 - 190 - 20) / Math.max(4, own.length);
        own.forEach((id, i) => { const sx = 214 + i * cw2; rr(sx, 140, cw2 - 12, 44, 12); ctx.fillStyle = 'rgba(10,30,30,0.75)'; ctx.fill(); txt(D.skills[id].name, sx + 12, 154, 16, C.cream, 'left', { weight: 900 }); txt(D.skills[id].short || '', sx + 12, 174, 14, '#c8f5ee', 'left', { weight: 600 }); });
      }
      const n = D.stages.length, cw = 192, gap = 12, x0 = (W - (n * cw + (n - 1) * gap)) / 2, y0 = 330, ch = 286;
      D.stages.forEach((s, i) => {
        const x = x0 + i * (cw + gap);
        const cleared = !!save.cleared[s.id];
        const lock = stageLock(s.id), playable = !lock, isNext = playable && !cleared;
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
          rr(x + 14, y0 + lift + 166, cw - 28, 52, 12); ctx.fillStyle = cleared ? 'rgba(95,227,161,0.2)' : playable ? 'rgba(224,87,62,0.25)' : 'rgba(224,87,62,0.12)'; ctx.fill();
          txt(cleared ? '문제 해결 ✓' : '문제', x + cw / 2, y0 + lift + 180, 13, cleared ? C.good : playable ? '#ffb3a3' : '#9a7f9a', 'center', { weight: 600 });
          setFont(17, 600); const pfit = Math.min(1, (cw - 40) / ctx.measureText(s.problem).width), pw = ctx.measureText(s.problem).width * pfit;
          txt(s.problem, x + cw / 2, y0 + lift + 202, 17 * pfit, cleared ? '#a9d9c2' : playable ? C.cream : '#9a93c8', 'center', { weight: 600 });
          if (cleared) { ctx.strokeStyle = C.good; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x + cw / 2 - pw / 2 - 4, y0 + lift + 203); ctx.lineTo(x + cw / 2 + pw / 2 + 4, y0 + lift + 203); ctx.stroke(); }
        }
        const sy = y0 + lift + 248;
        // 아직 남은 과제 표시: 4스테이지 잔여 신호, 5스테이지 모래폭풍
        const left = cleared && (s.id === 4 && save.residual ? '잔여 신호 ⚠' : s.id === 5 ? '모래폭풍 ⚠' : null);
        if (left) { setFont(13, 600); const rtw = ctx.measureText(left).width + 18; rr(x + cw - rtw - 8, y0 + lift + 8, rtw, 24, 12); ctx.fillStyle = Math.floor(this.t * 2) % 2 ? 'rgba(160,30,40,0.95)' : 'rgba(110,20,30,0.95)'; ctx.fill(); txt(left, x + cw - rtw / 2 - 8, y0 + lift + 20, 13, '#ffd0c8', 'center', { weight: 600 }); }
        if (cleared) {
          rr(x + 30, sy - 20, cw - 60, 40, 20); ctx.fillStyle = C.good; ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5; ctx.stroke();
          txt('바꿨어요 ✓', x + cw / 2, sy + 1, 19, C.ink, 'center');
        } else if (!s.ready) txt('준비 중', x + cw / 2, sy, 19, '#8e87bd', 'center', { weight: 700 });
        else if (lock) txt(lock, x + cw / 2, sy, 15, '#8e87bd', 'center', { weight: 700 });
        else txt('출발 ▶', x + cw / 2, sy, 21, C.mustard, 'center');
        // 지금 할 차례인 스테이지는 테두리가 깜박인다
        if (isNext && !st.hot) { rr(x - 5, y0 - 5, cw + 10, ch + 10, 26); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(247,197,72,' + (0.45 + 0.4 * Math.sin(this.t * 4)).toFixed(3) + ')'; ctx.stroke(); }
      });
      if (save.badges.length) txt('운동 배지: ' + save.badges.join(' · '), 40, 650, 19, C.cream, 'left', { stroke: C.ink, sw: 5 });
      fsButton(W - 676, H - 82, 190, 56, 19);
      button(W - 470, H - 82, 250, 56, '지구 기록 보관소', () => openArchive(), { size: 20, fill: C.tealL });
      button(W - 204, H - 82, 170, 56, '처음 화면', () => go(() => TitleScene()), { size: 20 });
      drawFsNote();
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
        drawCardArt(W / 2 - 300, 420, 118, def.card, 1);
        const sk = D.skills[def.skill];
        if (sk) { txt('기술: ' + sk.name, W / 2 - 200, 456, 23, C.tealL, 'left'); para(sk.desc + ' (자동 적용)', W / 2 - 200, 488, 500, 17, '#c8f5ee', 24, { weight: 600 }); }
        txt('운동 배지: ' + def.badge, W / 2 - 200, 556, 23, C.amberL, 'left');
      }
      // 다음 스테이지가 열렸으면 그쪽을 먼저(Enter로 바로) 고른다
      if (!stageLock(r.id + 1)) {
        button(W / 2 - 420, 630, 270, 58, '다음 스테이지 ▶', () => go(() => StageScene(r.id + 1)), { fill: C.tealL });
        button(W / 2 - 135, 630, 270, 58, '스테이지 고르기', () => go(() => SelectScene()));
        button(W / 2 + 150, 630, 270, 58, '다시 하기', () => go(() => StageScene(r.id, { skipIntro: true })), { fill: '#d9d2f0' });
      } else {
        button(W / 2 - 300, 630, 280, 58, '스테이지 고르기', () => go(() => SelectScene()));
        button(W / 2 + 20, 630, 280, 58, '다시 하기', () => go(() => StageScene(r.id, { skipIntro: true })), { fill: '#d9d2f0' });
      }
    }
  };
}
/* ===== 엔딩: 정착촌 헌장 =====
   오류 → 헌장 조립(제도 카드를 끌어 조항에 놓기) → 재부팅(바뀐 모습 5컷) → 남은 과제(오더 로그) → 제6조 쓰기 → 결과 카드 → 마지막 장면 */
const END_STEPS = ['error', 'charter', 'reboot', 'warn', 'write', 'result', 'last'];
function endingStats() {
  const ev = save.evidence || { right: 0, wrong: 0 }, tot = ev.right + ev.wrong;
  const acc = tot ? Math.round(ev.right / tot * 100) : 0;
  const grade = (((D.ending && D.ending.grades) || []).find(g => acc >= g.min) || { name: '' }).name;
  let time = 0;
  for (let i = 1; i <= 6; i++) if (save.stageStats && save.stageStats[i]) time += save.stageStats[i].time;
  return { acc, right: ev.right, tot, grade, time, level: save.level || 1 };
}
// 헌장 조립에 쓰는 제도 카드. small = 조항 칸에 들어간 작은 모양
function drawCharterCard(x, y, w, h, card, o) {
  o = o || {};
  ctx.save();
  if (o.lift) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; rr(x + 6, y + 8, w, h, 12); ctx.fill(); }
  rr(x, y, w, h, 12); ctx.fillStyle = o.small ? '#fff8e8' : '#fff3dc'; ctx.fill();
  ctx.lineWidth = o.sel ? 6 : 3; ctx.strokeStyle = o.sel ? C.teal : C.mustard; ctx.stroke();
  ctx.lineWidth = 1.5; ctx.strokeStyle = C.ink; rr(x, y, w, h, 12); ctx.stroke();
  if (o.small) {
    setFont(21, 900); const sz = Math.min(21, 21 * (w - 20) / ctx.measureText(card.name).width);
    txt(card.name, x + w / 2, y + h / 2 - 10, sz, C.ink, 'center', { weight: 900 });
    txt(card.year, x + w / 2, y + h / 2 + 16, 16, '#b05a1e', 'center', { weight: 900 });
  } else {
    txt(card.name, x + 16, y + 21, 22, C.ink, 'left', { weight: 900 });
    txt(card.year, x + w - 16, y + 21, 18, '#b05a1e', 'right', { weight: 900 });
    wrap(card.text, w - 32, 15, 600).slice(0, 2).forEach((l, i) => txt(l, x + 16, y + 45 + i * 19, 15, '#4a3f6b', 'left', { weight: 600 }));
  }
  ctx.restore();
}
// 구글 시트로 보내기(선생님이 data.js의 ending.sheetUrl에 Apps Script 웹 앱 주소를 넣었을 때만)
const sheetUrl = () => String((D.ending && D.ending.sheetUrl) || '').trim();
function sendCharter() {
  const st = endingStats();
  const body = JSON.stringify({ name: save.name || '', article6: save.charter6 || '', grade: st.grade, acc: st.acc, right: st.right, total: st.tot, level: st.level,
    time: fmtTime(st.time), difficulty: save.difficulty === 'easy' ? '쉬움' : '보통', badges: (save.badges || []).length, date: save.endDate || '' });
  // 응답을 읽지 않는 방식(no-cors)으로 보낸다. 네트워크가 막히면 실패로 본다
  try { return fetch(sheetUrl(), { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body }).then(() => true, () => false); }
  catch (e) { return Promise.resolve(false); }
}
function EndingScene(opts) {
  const E = D.ending, CH = D.charter, cardOf = a => cardById(CH.find(c => c.article === a).card) || { name: '', year: '', text: '' };
  const start = Math.max(0, END_STEPS.indexOf((opts && opts.at) || 'error'));
  const S = {
    name: 'ending', t: 0, st: 0, step: start,
    placed: {}, tray: shuffle(CH.map(c => c.article)), drag: null, sel: null, hint: null, hintT: -9, shake: {}, okT: {}, doneT: -1,
    cut: -1, cutT: 0, inputs: null, capture: false, savedT: -9,
    sendState: sheetUrl() ? (save.charterSent ? 'sent' : 'idle') : 'off',
    send() {
      if (!sheetUrl()) { this.sendState = 'off'; return; }
      this.sendState = 'sending'; save.charterSent = false; writeSave();
      sendCharter().then(ok => { this.sendState = ok ? 'sent' : 'fail'; save.charterSent = ok; writeSave(); });
    },
    go(n) { this.removeInputs(); this.step = n; this.st = 0; ui.focus = 0; if (END_STEPS[n] === 'write') this.makeInputs(); if (END_STEPS[n] === 'reboot') { this.cut = -1; this.cutT = 0; } },
    next() { this.go(this.step + 1); },
    rowY(i) { return 128 + i * 88; },
    slotRect(a) { return { x: 140, y: this.rowY(a - 1) + 6, w: 220, h: 66 }; },
    trayRect(a) { return { x: 836, y: this.rowY(this.tray.indexOf(a)) + 4, w: 408, h: 72 }; },
    trayAt(p) { for (const a of this.tray) { if (this.placed[a]) continue; const r = this.trayRect(a); if (p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h) return a; } return null; },
    slotAt(p, pad) { pad = pad || 0; for (const c of CH) { const r = this.slotRect(c.article); if (p.x > r.x - pad && p.x < r.x + r.w + 420 && p.y > r.y - pad && p.y < r.y + r.h + pad) return c.article; } return null; },
    place(a, slot) {
      if (this.placed[slot]) return;
      if (a === slot) {
        this.placed[a] = true; this.okT[a] = this.t; this.sel = null; this.hint = null;
        if (CH.every(c => this.placed[c.article])) this.doneT = this.t;
      } else {
        const c = cardOf(a);
        this.hint = '「' + c.name + '」(' + c.year + '): ' + c.text + '. 어느 조항과 맞을까요?'; this.hintT = this.t; this.shake[a] = this.t; this.sel = null;
      }
    },
    onDown(p) {
      if (END_STEPS[this.step] !== 'charter' || this.doneT >= 0) return false;
      const a = this.trayAt(p);
      if (a != null) { const r = this.trayRect(a); this.drag = { a, ox: p.x - r.x, oy: p.y - r.y, x: p.x, y: p.y, sx: p.x, sy: p.y }; return true; }
      const sl = this.slotAt(p);
      if (sl != null && this.sel != null) { this.place(this.sel, sl); return true; }
      return false;
    },
    onMove(p) { if (this.drag) { this.drag.x = p.x; this.drag.y = p.y; } },
    onUp(p) {
      const d = this.drag; if (!d) return; this.drag = null;
      // 카드 가운데가 조항 줄 위에 있으면 놓는다. 거의 안 움직였으면 「골라 두기」(그다음 조항을 누르면 놓인다)
      const cx = d.x - d.ox + 204, cy = d.y - d.oy + 36, sl = this.slotAt({ x: Math.min(cx, 600), y: cy }, 14);
      if (Math.hypot(p.x - d.sx, p.y - d.sy) < 14) this.sel = this.sel === d.a ? null : d.a;
      else if (sl != null && cx < 820) this.place(d.a, sl);
    },
    makeInputs() {
      if (this.inputs) return;
      const mk = (ph, max, val) => {
        const el = document.createElement('input');
        el.type = 'text'; el.maxLength = max; el.placeholder = ph; el.value = val || ''; el.autocomplete = 'off'; el.spellcheck = false;
        Object.assign(el.style, { position: 'fixed', zIndex: 5, boxSizing: 'border-box', border: '3px solid #f7c548', borderRadius: '12px', background: '#fff8e8',
          color: '#1d1b2c', padding: '0 0.6em', outline: 'none', userSelect: 'text', webkitUserSelect: 'text', touchAction: 'auto', fontFamily: FONT_BODY, margin: '0' });
        el.addEventListener('keydown', e => e.stopPropagation());
        document.body.appendChild(el); return el;
      };
      this.inputs = { a6: mk('여기에 써요', 60, save.charter6), name: mk('이름 또는 번호', 20, save.name) };
    },
    removeInputs() { if (!this.inputs) return; Object.values(this.inputs).forEach(el => el.remove()); this.inputs = null; },
    placeInputs() {
      if (!this.inputs) return;
      const r = canvas.getBoundingClientRect(), sx = r.width / W, sy = r.height / H;
      const put = (el, x, y, w, h, fs) => { el.style.left = (r.left + x * sx) + 'px'; el.style.top = (r.top + y * sy) + 'px'; el.style.width = (w * sx) + 'px'; el.style.height = (h * sy) + 'px'; el.style.fontSize = Math.max(14, fs * sy) + 'px'; };
      put(this.inputs.a6, 200, 356, 880, 58, 26); put(this.inputs.name, 360, 528, 300, 50, 22);
    },
    finishWrite() {
      const v = this.inputs ? this.inputs.a6.value.trim() : save.charter6 || '';
      if (v.length < 2) return;
      save.charter6 = v; save.name = this.inputs ? this.inputs.name.value.trim() : save.name || '';
      const d = new Date(); save.endDate = d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + '.';
      writeSave(); this.send(); this.next();
    },
    saveCard() {
      try {
        this.capture = true; this.draw(); this.capture = false;
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png'); a.download = '정착촌헌장_' + (save.name || '결과카드') + '.png';
        document.body.appendChild(a); a.click(); a.remove(); this.savedT = this.t; this.saveErr = false;
      } catch (e) { this.capture = false; this.savedT = this.t; this.saveErr = true; }
    },
    update(dt) {
      this.t += dt; this.st += dt;
      const k = END_STEPS[this.step], adv = hit('Enter') || hit('Space') || taps.length;
      if (k === 'reboot') {
        if (this.st > 3.6) {
          if (this.cut < 0) { this.cut = 0; this.cutT = 0; }
          this.cutT += dt;
          if (this.cutT > 3.4 || (this.cutT > 0.5 && adv)) { this.cut++; this.cutT = 0; if (this.cut >= E.reboot.length) this.next(); }
        }
      } else menuNav();
    },
    draw() {
      const k = END_STEPS[this.step];
      ctx.fillStyle = '#0d0c1d'; ctx.fillRect(0, 0, W, H);
      if (k === 'error') this.drawError();
      else if (k === 'charter') this.drawCharter();
      else if (k === 'reboot') this.drawReboot();
      else if (k === 'warn') this.drawWarn();
      else if (k === 'write') this.drawWrite();
      else if (k === 'result') this.drawResult();
      else this.drawLast();
    },
    drawOrder(x, y, s, k) {
      // 오더 본체 그림과 눈(렌즈). k: 0 = 주황, 1 = 청록
      const img = IMG.boss_final; if (!img) return;
      drawContain(img, x, y, s, s);
      const lx = x + s / 2, ly = y + s * 0.488, col = 'rgb(' + Math.round(lerp(255, 95, k)) + ',' + Math.round(lerp(177, 227, k)) + ',' + Math.round(lerp(46, 210, k)) + ')';
      const g = ctx.createRadialGradient(lx, ly, 4, lx, ly, s * 0.16); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; circle(lx, ly, s * 0.16); ctx.fill();
      ctx.fillStyle = col; circle(lx, ly, s * 0.035); ctx.fill();
    },
    drawError() {
      const t = this.st;
      if (Math.random() < 0.12) ctx.translate(rand(-6, 6), 0);
      this.drawOrder(440, 30, 400, Math.floor(t * 9) % 4 === 0 ? 1 : 0);
      ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
      for (let i = 0; i < 5; i++) if (Math.random() < 0.3) { ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,177,46,0.25)' : 'rgba(159,245,234,0.22)'; ctx.fillRect(rand(380, 760), rand(40, 420), rand(80, 320), rand(3, 14)); }
      txt('ORDER · 오류', 40, 44, 22, C.amberL, 'left', { weight: 900 });
      E.error.forEach((l, i) => {
        const a = clamp((t - 0.6 - i * 0.9) * 3, 0, 1); if (a <= 0) return;
        ctx.globalAlpha = a; txt(l, W / 2, 486 + i * 50, i === E.error.length - 1 ? 38 : 30, i === E.error.length - 1 ? C.tealL : C.amberL, 'center', { weight: 900, stroke: C.ink, sw: 7 }); ctx.globalAlpha = 1;
      });
      if (t > 0.6 + E.error.length * 0.9) button(W / 2 - 200, 640, 400, 62, '새 원칙 입력하기 ▶', () => this.next(), { size: 26 });
    },
    drawCharter() {
      if (IMG.ending1) { ctx.globalAlpha = 0.22; drawCover(IMG.ending1, 0, 0, W, H); ctx.globalAlpha = 1; }
      txt('정착촌 헌장 만들기', 425, 50, 40, C.mustard, 'center', { weight: 900, stroke: C.ink, sw: 7 });
      txt('제도 카드', 1040, 50, 30, C.cream, 'center', { weight: 900, stroke: C.ink, sw: 6 });
      txt('오른쪽 제도 카드를 손가락으로 끌어 알맞은 조항에 놓아요 (마우스로 끌어도 돼요)', W / 2, 96, 19, C.cream, 'center', { weight: 600, stroke: C.ink, sw: 4 });
      panel(40, 118, 770, 460, { fill: 'rgba(255,243,220,0.97)', stroke: C.mustard, r: 20, lw: 4 });
      const hov = this.drag ? this.slotAt({ x: Math.min(this.drag.x - this.drag.ox + 204, 600), y: this.drag.y - this.drag.oy + 36 }, 14) : null;
      CH.forEach((c, i) => {
        const y = this.rowY(i), a = c.article, s = this.slotRect(a);
        if (i) { ctx.strokeStyle = 'rgba(176,90,30,0.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(60, y - 5); ctx.lineTo(790, y - 5); ctx.stroke(); }
        if (hov === a && !this.placed[a]) { rr(50, y - 2, 750, 82, 14); ctx.fillStyle = 'rgba(43,196,180,0.18)'; ctx.fill(); }
        txt('제' + a + '조', 96, y + 39, 24, '#b05a1e', 'center', { weight: 900 });
        if (this.placed[a]) {
          const ok = this.okT[a], pop = ok != null ? 1 + Math.max(0, 0.25 - (this.t - ok)) * 1.2 : 1;
          ctx.save(); ctx.translate(s.x + s.w / 2, s.y + s.h / 2); ctx.scale(pop, pop); drawCharterCard(-s.w / 2, -s.h / 2, s.w, s.h, cardOf(a), { small: true }); ctx.restore();
          if (ok != null && this.t - ok < 0.6) { ctx.strokeStyle = 'rgba(43,196,180,' + (1 - (this.t - ok) / 0.6) + ')'; ctx.lineWidth = 5; rr(s.x - 6, s.y - 6, s.w + 12, s.h + 12, 16); ctx.stroke(); }
        } else {
          rr(s.x, s.y, s.w, s.h, 12); ctx.fillStyle = this.sel != null || hov === a ? 'rgba(43,196,180,0.14)' : 'rgba(176,90,30,0.07)'; ctx.fill();
          ctx.setLineDash([9, 7]); ctx.lineWidth = 2.5; ctx.strokeStyle = this.sel != null || hov === a ? C.teal : 'rgba(176,90,30,0.55)'; ctx.stroke(); ctx.setLineDash([]);
          txt('카드를 놓아요', s.x + s.w / 2, s.y + s.h / 2, 16, 'rgba(120,70,40,0.6)', 'center', { weight: 600 });
        }
        const ls = wrap(c.text, 420, 22, 600);
        ls.forEach((l, j) => txt(l, 380, y + 39 + (j - (ls.length - 1) / 2) * 28, 22, this.placed[a] ? C.ink : '#4a3f6b', 'left', { weight: this.placed[a] ? 900 : 600 }));
      });
      this.tray.forEach(a => {
        const r = this.trayRect(a);
        if (this.placed[a] || (this.drag && this.drag.a === a)) { rr(r.x, r.y, r.w, r.h, 12); ctx.setLineDash([8, 7]); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,244,220,0.25)'; ctx.stroke(); ctx.setLineDash([]); return; }
        const sh = this.shake[a] != null && this.t - this.shake[a] < 0.4 ? Math.sin((this.t - this.shake[a]) * 60) * 8 * (1 - (this.t - this.shake[a]) / 0.4) : 0;
        drawCharterCard(r.x + sh, r.y, r.w, r.h, cardOf(a), { sel: this.sel === a });
      });
      if (this.drag) { const d = this.drag, r = this.trayRect(d.a); drawCharterCard(d.x - d.ox, d.y - d.oy, r.w, r.h, cardOf(d.a), { lift: true }); }
      if (this.doneT >= 0) {
        txt('헌장 입력 완료!', W / 2, 606, 34, C.tealL, 'center', { weight: 900, stroke: C.ink, sw: 7 });
        if (this.t - this.doneT > 0.8) button(W / 2 - 200, 640, 400, 62, '오더에게 입력하기 ▶', () => this.next(), { size: 26 });
      } else if (this.hint && this.t - this.hintT < 7) {
        const ls = wrap(this.hint, 1060, 21, 600);
        panel(80, 592, W - 160, 26 + ls.length * 28, { fill: 'rgba(90,25,30,0.94)', stroke: C.bad, r: 14, lw: 2 });
        ls.forEach((l, i) => txt(l, W / 2, 606 + 14 + i * 28 - (ls.length > 1 ? 0 : 0), 21, '#ffd9cf', 'center', { weight: 600 }));
      } else if (this.sel != null) txt('이제 놓을 조항을 눌러요', W / 2, 612, 24, C.tealL, 'center', { weight: 900, stroke: C.ink, sw: 5 });
      else txt('조항의 뜻과 제도 카드의 내용을 비교해 보세요', W / 2, 612, 20, 'rgba(255,244,220,0.75)', 'center', { weight: 600 });
    },
    drawReboot() {
      const t = this.st;
      if (this.cut < 0) {
        const k = clamp((t - 0.6) / 2, 0, 1);
        this.drawOrder(440, 24, 400, k);
        txt(k < 1 ? '재부팅 중…' : '재부팅 완료', W / 2, 470, 40, k < 1 ? C.amberL : C.tealL, 'center', { weight: 900, stroke: C.ink, sw: 7 });
        txt('새 원칙을 불러오는 중: 정착촌 헌장 제1조 ~ 제5조', W / 2, 522, 22, C.cream, 'center', { weight: 600 });
        rr(340, 556, 600, 18, 9); ctx.fillStyle = 'rgba(255,244,220,0.15)'; ctx.fill();
        rr(340, 556, 600 * k, 18, 9); ctx.fillStyle = k < 1 ? C.amber : C.tealL; ctx.fill();
        if (k >= 1) txt('오더의 눈이 주황에서 청록으로 바뀌었어요', W / 2, 616, 24, C.tealL, 'center', { weight: 900 });
        return;
      }
      const c = E.reboot[this.cut], img = IMG[c.img], a = Math.min(1, this.cutT * 3);
      if (img) drawCover(img, 0, 0, W, H, 1.02 + this.cutT * 0.012);
      const gr = ctx.createLinearGradient(0, H - 230, 0, H); gr.addColorStop(0, 'rgba(12,10,30,0)'); gr.addColorStop(1, 'rgba(12,10,30,0.9)');
      ctx.fillStyle = gr; ctx.fillRect(0, H - 230, W, 230);
      ctx.globalAlpha = a;
      panel(24, 24, 300, 48, { fill: 'rgba(20,70,60,0.92)', stroke: C.tealL, r: 24, lw: 3 });
      txt('새 원칙 적용 · ' + (this.cut + 1) + '/' + E.reboot.length, 174, 49, 22, '#c8ffe4', 'center', { weight: 900 });
      txt(c.text, W / 2, H - 92, 34, C.cream, 'center', { weight: 900, stroke: C.ink, sw: 7 });
      ctx.globalAlpha = 1;
      txt('화면을 눌러 다음 (키보드: Enter)', W / 2, H - 30, 16, 'rgba(255,244,220,0.8)', 'center', { weight: 600 });
    },
    drawWarn() {
      const t = this.st;
      panel(130, 40, 1020, 560, { fill: 'rgba(8,14,24,0.97)', stroke: C.tealL, r: 18, lw: 3 });
      txt('ORDER 로그 · 새 원칙 적용', 170, 80, 24, C.tealL, 'left', { weight: 900 });
      const lines = CH.map((c, i) => ({ s: '✓ 제' + c.article + '조 적용: ' + c.text, col: '#9ff5ea', at: 0.3 + i * 0.3 }));
      E.warnings.forEach((w, i) => lines.push({ s: w, col: i < 2 ? '#ffb347' : '#ff8a7a', at: 2.0 + i * 0.8, warn: true }));
      lines.forEach((l, i) => {
        if (t < l.at) return;
        const y = 128 + i * 44 + (l.warn ? 14 : 0), blink = l.warn && t - l.at < 1.2 && Math.floor(t * 8) % 2 === 0;
        if (l.warn) { rr(160, y - 18, 960, 36, 8); ctx.fillStyle = blink ? 'rgba(160,40,30,0.55)' : 'rgba(120,40,20,0.3)'; ctx.fill(); }
        txt(l.s, 176, y, 21, l.col, 'left', { weight: l.warn ? 900 : 600 });
      });
      const endAt = 2.0 + E.warnings.length * 0.8 + 0.4;
      if (t > endAt) { const a = Math.min(1, (t - endAt) * 2); ctx.globalAlpha = a; txt(E.warnEnd, W / 2, 548, 36, C.tealL, 'center', { weight: 900, stroke: C.ink, sw: 7 }); ctx.globalAlpha = 1; }
      if (t > endAt + 1.0) button(W / 2 - 160, 630, 320, 62, '다음 ▶', () => this.next(), { size: 26 });
    },
    drawWrite() {
      if (IMG.ending1) drawCover(IMG.ending1, 0, 0, W, H); dim(0.62);
      panel(130, 24, 1020, 650, { fill: 'rgba(24,21,54,0.95)', stroke: C.mustard, r: 22, lw: 4 });
      txt('정착촌 헌장', W / 2, 66, 38, C.mustard, 'center', { weight: 900, stroke: C.ink, sw: 6 });
      CH.forEach((c, i) => { txt('제' + c.article + '조', 190, 118 + i * 36, 20, C.amberL, 'left', { weight: 900 }); txt(c.text, 262, 118 + i * 36, 20, C.cream, 'left', { weight: 600 }); });
      panel(170, 296, 940, 196, { fill: 'rgba(60,46,20,0.9)', stroke: C.mustard, r: 16, lw: 3 });
      txt('제6조', 200, 328, 26, C.amberL, 'left', { weight: 900 });
      txt(E.article6 + ' …', 280, 328, 24, C.cream, 'left', { weight: 900 });
      txt('내가 직접 써요. 정답은 없어요', 1080, 328, 16, '#e6d8b0', 'right', { weight: 600 });
      (E.article6Hint || []).forEach((h, i) => txt(h, 200 + i * 300, 452, 15, '#e6d8b0', 'left', { weight: 600 }));
      txt('이름(번호)', 200, 553, 22, C.cream, 'left', { weight: 900 });
      if (!this.inputs) this.makeInputs();
      this.placeInputs();
      const ok = this.inputs && this.inputs.a6.value.trim().length >= 2;
      button(720, 524, 360, 60, '헌장 완성!', () => this.finishWrite(), { size: 26, disabled: !ok });
      txt(ok ? '다 쓰면 「헌장 완성!」을 눌러요' : '제6조를 두 글자 이상 써 주세요', W / 2, 628, 18, ok ? C.tealL : '#c9c2ef', 'center', { weight: 600 });
    },
    drawResult() {
      const st = endingStats(), x = 70, y = 22, w = W - 140, h = 596;
      ctx.fillStyle = '#1d1b3a'; ctx.fillRect(0, 0, W, H);
      panel(x, y, w, h, { fill: '#fff3dc', stroke: C.mustard, r: 24, lw: 6 });
      txt('정착촌 헌장 · 결과 카드', x + 40, y + 44, 32, C.ink, 'left', { weight: 900 });
      txt((save.name || '이름 없음') + (save.endDate ? '   ' + save.endDate : ''), x + w - 40, y + 44, 22, '#4a3f6b', 'right', { weight: 600 });
      ctx.strokeStyle = 'rgba(176,90,30,0.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 30, y + 76); ctx.lineTo(x + w - 30, y + 76); ctx.stroke();
      CH.forEach((c, i) => {
        const yy = y + 104 + i * 52, card = cardOf(c.article);
        txt('제' + c.article + '조', x + 40, yy, 21, '#b05a1e', 'left', { weight: 900 });
        txt(c.text, x + 112, yy, 20, C.ink, 'left', { weight: 600 });
        txt('← ' + card.name + ' (' + card.year + ')', x + 112, yy + 22, 14, '#6a6090', 'left', { weight: 600 });
      });
      rr(x + 30, y + 368, 700, 130, 16); ctx.fillStyle = '#ffe7b0'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.mustard; ctx.stroke();
      txt('제6조', x + 50, y + 398, 24, '#b05a1e', 'left', { weight: 900 });
      txt(E.article6, x + 126, y + 398, 22, C.ink, 'left', { weight: 900 });
      wrap(save.charter6 || '', 650, 25, 900).slice(0, 2).forEach((l, i) => txt(l, x + 52, y + 440 + i * 34, 25, C.ink, 'left', { weight: 900 }));
      const rx = x + 770, rw = w - 800;
      rr(rx, y + 96, rw, 126, 18); ctx.fillStyle = C.teal; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.stroke();
      txt('등급', rx + rw / 2, y + 124, 20, '#e8fffb', 'center', { weight: 900 });
      txt(st.grade, rx + rw / 2, y + 176, 40, '#fffbe8', 'center', { weight: 900, stroke: C.ink, sw: 6 });
      [['레벨', 'Lv ' + st.level], ['증거 정확도', st.acc + '% (' + st.right + '/' + st.tot + ')'], ['클리어 시간', fmtTime(st.time)], ['운동 배지', (save.badges || []).length + '개']].forEach((r, i) => {
        const yy = y + 260 + i * 44;
        txt(r[0], rx + 8, yy, 20, '#6a6090', 'left', { weight: 600 }); txt(r[1], rx + rw - 8, yy, 22, C.ink, 'right', { weight: 900 });
        ctx.strokeStyle = 'rgba(176,90,30,0.2)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(rx, yy + 22); ctx.lineTo(rx + rw, yy + 22); ctx.stroke();
      });
      const ss = this.sendState;
      if (ss === 'off' || this.capture) { if (IMG.logo) drawContain(IMG.logo, rx + 20, y + 440, rw - 40, 70); }
      else {
        // 선생님 구글 시트로 보낸 상태
        const lab = { sending: '선생님께 보내는 중…', sent: '선생님께 보냈어요 ✓', fail: '보내지 못했어요', idle: '아직 안 보냈어요' }[ss];
        rr(rx, y + 432, rw, 34, 17); ctx.fillStyle = ss === 'sent' ? 'rgba(46,160,110,0.9)' : ss === 'fail' ? 'rgba(200,70,60,0.9)' : 'rgba(106,96,144,0.85)'; ctx.fill();
        txt(lab, rx + rw / 2, y + 449, 18, '#fffbe8', 'center', { weight: 900 });
        if (ss === 'fail' || ss === 'idle') button(rx + 30, y + 474, rw - 60, 44, ss === 'fail' ? '다시 보내기' : '선생님께 보내기', () => this.send(), { size: 19, fill: C.mustard });
      }
      txt('헌장은 완성이 아니라 시작이에요. 그 노력은 지금도 계속되고 있어요.', x + w / 2, y + h - 34, 17, '#6a6090', 'center', { weight: 600 });
      if (this.capture) return;
      button(W / 2 - 440, 636, 280, 58, '그림으로 저장', () => this.saveCard(), { size: 22, fill: C.tealL });
      button(W / 2 - 140, 636, 280, 58, '제6조 고치기', () => this.go(END_STEPS.indexOf('write')), { size: 22, fill: '#d9d2f0' });
      button(W / 2 + 160, 636, 280, 58, '마지막 장면 ▶', () => this.next(), { size: 22 });
      txt(this.t - this.savedT < 5 ? (this.saveErr ? '여기서는 그림 저장이 막혀 있어요. 이 화면을 캡처해서 내요' : '저장했어요! 파일이 안 보이면 이 화면을 캡처해서 내요') : '저장이 안 되면 이 화면을 캡처해서 내요', W / 2, 708, 15, 'rgba(255,244,220,0.8)', 'center', { weight: 600 });
    },
    drawLast() {
      const t = this.st;
      if (IMG.ending2) drawCover(IMG.ending2, 0, 0, W, H, 1 + t * 0.006);
      const gr = ctx.createLinearGradient(0, H - 260, 0, H); gr.addColorStop(0, 'rgba(12,10,30,0)'); gr.addColorStop(1, 'rgba(12,10,30,0.88)');
      ctx.fillStyle = gr; ctx.fillRect(0, H - 260, W, 260);
      ctx.globalAlpha = clamp((t - 0.8) / 1.5, 0, 1);
      wrap(E.last, 1000, 32, 900).forEach((l, i) => txt(l, W / 2, 548 + i * 46, 32, C.cream, 'center', { weight: 900, stroke: C.ink, sw: 7 }));
      ctx.globalAlpha = 1;
      if (t > 3) {
        button(W / 2 - 440, 644, 280, 56, '헌장 다시 보기', () => this.go(END_STEPS.indexOf('result')), { size: 21, fill: '#d9d2f0' });
        button(W / 2 - 140, 644, 280, 56, '스테이지 고르기', () => go(() => SelectScene()), { size: 21 });
        button(W / 2 + 160, 644, 280, 56, '처음 화면', () => go(() => TitleScene()), { size: 21, fill: '#d9d2f0' });
      }
    }
  };
  if (start >= END_STEPS.indexOf('reboot')) CH.forEach(c => { S.placed[c.article] = true; });
  if (END_STEPS[start] === 'write') S.makeInputs();
  return S;
}
function drawCardArt(cx, y, w, card, a) {
  const h = w * 1.5, x = cx - w / 2, u = w / 300;
  ctx.save(); ctx.globalAlpha = a == null ? 1 : a;
  if (IMG.card) ctx.drawImage(IMG.card, x, y, w, h);
  else { rr(x, y, w, h, 18 * u); ctx.fillStyle = C.cream; ctx.fill(); ctx.lineWidth = 8 * u; ctx.strokeStyle = C.tealD; ctx.stroke(); }
  txt('제' + card.article + '조', cx, y + h * 0.098, 21 * u, C.tealD, 'center', { weight: 900 });
  txt('제도 카드', cx, y + h * 0.24, 21 * u, C.rust, 'center', { weight: 600 });
  setFont(56 * u, 900); const nfit = Math.min(1, w * 0.7 / Math.max(1, ctx.measureText(card.name).width));
  txt(card.name, cx, y + h * 0.35, 56 * u * nfit, C.ink, 'center', { weight: 900 });
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
  ejector: { r: 18, hp: 22, speed: 168, xp: 3,  touch: 6 },
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
  pulse: { cd: 7 }
};
const xpNeed = lv => 20 + (lv - 1) * 18;

/* 스테이지를 깨고 얻은 기술: 버튼 없이 효과가 저절로 붙는다(data.js의 skills.효과) */
const ownedSkills = () => (save.skills || []).filter(id => D.skills[id] && D.skills[id].effect);
function skillFx(key, base) { let v = base; ownedSkills().forEach(id => { const e = D.skills[id].effect; if (e[key] != null) v = key === 'speed' || key === 'dashCd' ? v * e[key] : e[key]; }); return v; }
function computeStats(up) {
  const n = k => up[k] || 0;
  return {
    maxHp: Math.round((100 + 25 * n('hp')) * (save.difficulty === 'easy' ? 1.5 : 1)),
    fireRate: 3.2 * Math.pow(1.18, n('rate')),
    range: 360 * (1 + 0.2 * n('range')),
    dmg: 10 * (1 + 0.25 * n('power')),
    multi: 1 + n('multi'),
    speed: skillFx('speed', 245 * (1 + 0.1 * n('speed'))),
    dashCd: skillFx('dashCd', 1.2 * Math.pow(0.82, n('dash'))),
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
    restrict: { kind: 'lane', wall: 'div', lane: { x0: EX0, x1: EX1, y0: 1812, y1: 3800 }, slow: 0.72, noDash: true },
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
  // 기록 칩: 지구 출신 구역 2개, 화성 태생 구역 2개(분리선이 꺼져야 갈 수 있다), C 구역 3개(마지막 칩은 보스 문 바로 앞). 드론이 가진 2개까지 모두 9개
  L.chips = [ ['r1_sign', 1270, 3200], ['r1_king', 1460, 3060], ['r1_civil', 520, 2620], ['r1_vote', 300, 3250], ['r1_apartheid', 230, 1620], ['r1_robben', 1370, 1580], ['r1_1994', 800, 884] ]
    .map(c => ({ id: c[0], x: c[1], y: c[2], t: Math.random() * 5, got: false }));
  L.caps = [ [1440, 3440, 0], [1100, 2380, 1], [800, 1300, 2] ].map(c => ({ x: c[0], y: c[1], look: LOOKS[c[2]], freed: false, t: Math.random() * 5 }));
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
/* ----- 2스테이지 지도: 협곡 레이스 -----
   아래에서 위로: A 출발선(게이트에 막힘) → B 협곡 달리기(화면이 위로 움직이고, 차단막은 지구 출신만 막는다)
   → 등록소 광장(출전 금지 발생기) → C 모두의 레이스 → 결승선(보스) */
function layoutStage2() {
  const TX0 = 300, TX1 = 1300, RACE_END = 2400;
  const L = {
    w: 1600, h: 7100, start: { x: 800, y: 6960 },
    arena: { x: 160, y: 0, w: 1280, h: 720 },
    solids: [ { x: 0, y: 0, w: 160, h: 800 }, { x: 1440, y: 0, w: 160, h: 800 }, { x: 160, y: 720, w: 400, h: 80 }, { x: 1040, y: 720, w: 400, h: 80 } ],
    walls: [], gens: [], zones: [], chips: [], caps: [],
    restrict: { kind: 'race', wall: 'wB',
      hud: '번호표 없음 · 출전 금지 · 가속 발판 꺼짐', hudFree: '번호표 획득! 누구나 달릴 수 있어요',
      mission: '게이트·출전 금지 풀기',
      free: { title: '번호표 획득! 출전 금지 해제', sub: '차단막이 열리고 가속 발판이 켜졌어요. 지구 출신 주자 2명이 함께 달려요!', join: '함께 달려요!', cheer: '달리자!' } },
    missionWalls: ['wC', 'wB', 'wA'],
    track: { x0: TX0, x1: TX1, y0: 812, y1: 7100, startY: 6520 },
    race: { zone: 1, v: 130, endY: RACE_END, minCam: 1700 },
    bossPools: BOSS_POOLS2, finish: true,
    npcBounds: { x0: 1180, x1: 1440, y0: 2080, y1: 2300 },
    pen: { x: 1130, y: 2020, w: 360, h: 330 },
    legend: [
      { k: 'hero', n: '나 (지구 출신 학생)', t: '공명기로 가장 가까운 적을 자동으로 쏴요' },
      { k: 'gen', n: '발생기', t: '부수면 게이트와 차단막이 꺼져요 (노란 화살표)' },
      { k: 'bar', n: '출전 금지 차단막', t: '화성 태생은 통과, 지구 출신은 막혀요. 틈으로 지나가요' },
      { k: 'boost', n: '가속 발판', t: '번호표가 없으면 꺼져 있어요. 출전 금지를 풀면 빨라져요' },
      { k: 'ejector', n: '퇴장 드론', t: '노란 드론. 닿으면 뒤로 밀어내요. 다른 드론의 주황 탄도 피하세요' },
      { k: 'chip', n: '기록 칩', t: '실제 지구 역사 기록. 모두 모아야 보스 문이 열려요' }
    ],
    flow: ['게이트 열기', '틈으로 달리기', '출전 금지 풀기', '기록 칩 모두 모으기', '보스 반박'],
    rules: [
      { k: 'bib', n: '번호표 없음 · 출전 금지', d: '차단막이 나만 막고 가속 발판도 꺼져 있어요. 출전 금지 발생기를 부수면 풀려요' },
      { k: 'run', n: '달리기 구간', d: '화면이 위로 계속 움직여요. 노란 화살표를 따라 차단막의 틈으로! 뒤처지면 다쳐요' }
    ]
  };
  const wall = (id, x, y, w, h, gens, o) => L.walls.push(Object.assign({ id, x, y, w, h, gens, active: true, fade: 1 }, o || {}));
  const gen = (id, x, y, hp, o) => L.gens.push(Object.assign({ id, x, y, r: 32, hp: hp || 140, maxHp: hp || 140, alive: true, hitT: 0 }, o || {}));
  // 출발 게이트: 화성 태생 주자는 지나가고 나만 막힌다
  wall('wC', TX0, 6196, TX1 - TX0, 16, ['g1a', 'g1b'], { startGate: true, denyText: '출전 금지 · 지구 출신', offMsg: ['출발 게이트가 열렸어요!', '코스로 뛰어드세요. 곧 화면이 위로 움직여요'] });
  gen('g1a', 400, 6390, 90, { name: '게이트 발생기' }); gen('g1b', 1200, 6390, 90, { name: '게이트 발생기' });
  // 출전 금지 차단막: [y, 틈 가운데 x, 틈 너비]. 모두 광장의 「출전 금지 발생기」가 켜고 있다
  const BARS = [[5800, 560, 200], [5400, 1020, 200], [5000, 700, 190], [4620, 1100, 180], [4240, 480, 180], [3880, 880, 180], [3520, 1120, 170], [3160, 620, 170], [2800, 900, 170]];
  L.barGaps = [];
  BARS.forEach((b, i) => {
    const y = b[0], gx = b[1], gw = b[2];
    wall('b' + i + 'l', TX0, y, gx - gw / 2 - TX0, 18, ['g2d'], { barrier: true, soft: true });
    wall('b' + i + 'r', gx + gw / 2, y, TX1 - gx - gw / 2, 18, ['g2d'], { barrier: true, soft: true });
    L.barGaps.push({ x: gx, y: y + 9, w: gw, wall: 'b' + i + 'l' });
  });
  wall('wB', 70, 1796, 1460, 16, ['g2d'], { divider: true });
  gen('g2d', 800, 2030, 320, { name: '출전 금지 발생기', big: true, drop: 'r2_1972' });
  // C 구역의 차단막: 출전 금지가 풀리면 열린 채로 남는다
  [1700, 1330].forEach((y, i) => { wall('c' + i + 'l', TX0, y, 400, 18, ['g2d'], { barrier: true, soft: true }); wall('c' + i + 'r', 900, y, 400, 18, ['g2d'], { barrier: true, soft: true }); });
  wall('wA', 0, 796, 1600, 16, ['g3a', 'g3b']);
  gen('g3a', 330, 935, 120); gen('g3b', 1270, 935, 120);
  wall('gate', 560, 712, 480, 16, [], { active: false, fade: 0, gate: true });
  wall('recgate', 560, 744, 480, 16, [], { recordGate: true, soft: true });
  L.zones = [
    { y0: 6212, y1: 7100, exit: 'wC', check: { x: 800, y: 6960 }, label: 'A 구역 · 출발선',
      pool: ['drone', 'chaser'], max: 3, every: 4.5,
      initial: [['drone', 520, 6600], ['drone', 1080, 6600], ['chaser', 800, 6450]] },
    { y0: 1812, y1: 6196, exit: 'wB', check: { x: 800, y: 6120 }, label: 'B 구역 · 협곡 달리기', race: true,
      pool: ['ejector', 'drone', 'ejector'], pool2: ['drone', 'chaser'], max: 3, every: 3.0,
      initial: [['turret', 350, 4810], ['turret', 1250, 3700], ['turret', 560, 2150], ['turret', 1040, 2150], ['drone', 800, 2280]] },
    { y0: 812, y1: 1796, exit: 'wA', check: { x: 800, y: 1740 }, label: 'C 구역 · 모두의 레이스',
      pool: ['drone', 'chaser', 'drone'], max: 5, every: 3.6,
      initial: [['turret', 210, 1060], ['turret', 1390, 1060], ['guard', 800, 1160, 'r2_1971'], ['drone', 480, 1420], ['chaser', 1120, 1450]] }
  ];
  // 기록 칩 6개: 출발선 1, 달리기 1, 발생기가 떨어뜨리는 1, C 구역 2 + 감시 드론이 가진 1
  L.chips = [ ['r2_suffrage', 800, 6700], ['r2_boston', 700, 4880], ['r2_now', 230, 1620], ['r2_saudi', 800, 884] ]
    .map(c => ({ id: c[0], x: c[1], y: c[2], t: Math.random() * 5, got: false }));
  L.caps = [ [1180, 6690, 1], [1100, 1480, 2] ].map(c => ({ x: c[0], y: c[1], look: LOOKS[c[2]], freed: false, t: Math.random() * 5 }));
  [[520, 1200], [1080, 1200], [620, 1560], [980, 1560], [470, 6780], [1130, 6500]]
    .forEach(c => L.solids.push({ x: c[0] - 28, y: c[1] - 28, w: 56, h: 56, crate: true }));
  // 협곡 절벽: 달리기 구간은 좁고, 광장과 C 구역은 넓다
  L.solids.push({ x: 0, y: RACE_END, w: TX0, h: 4700, cliff: true }, { x: TX1, y: RACE_END, w: 300, h: 4700, cliff: true },
                { x: 0, y: 800, w: 70, h: 1600, cliff: true }, { x: 1530, y: 800, w: 70, h: 1600, cliff: true });
  L.pads = [ { x: 560, y: 6880, w: 480, h: 190 }, { x: 600, y: 1850, w: 400, h: 300 }, { x: 660, y: 812, w: 280, h: 984 }, { x: 200, y: 862, w: 1200, h: 150 } ];
  L.domes = [ { x: 1420, y: 1250, r: 66 }, { x: 200, y: 1330, r: 58 }, { x: 200, y: 2200, r: 60 } ];
  // 가속 발판: 달리기 구간(번호표가 없으면 꺼짐)과 C 구역
  L.boosts = [ [690, 5600], [910, 5200], [470, 4810], [1130, 4430], [690, 4060], [910, 3700], [470, 3340], [1130, 2980], [800, 2600],
               [800, 1640], [800, 1440], [560, 1050], [1040, 1050] ].map(b => ({ x: b[0], y: b[1] }));
  const sl = (stageById(2).slogans || []);
  L.boards = [ { x: 560, y: 6330, text: sl[0] }, { x: 1010, y: 4760, text: sl[1] }, { x: 430, y: 1760, text: sl[2] } ].filter(b => b.text);
  // 1스테이지에서 바꾼 것: 꺼진 분리선과 「모두의 길」
  L.deadDivider = { x: 1150, y0: 6850, y1: 7092 };
  L.signs = [ { x: 1150, y: 6800, text: '모두의 길' } ];
  L.crowd = [ [430, 6930, 0, 0], [505, 7010, 3, 0], [650, 6890, 1, Math.PI], [1010, 6990, 4, Math.PI], [1230, 6950, 2, Math.PI], [1100, 7040, 0, 0] ]
    .map(c => ({ x: c[0], y: c[1], look: LOOKS[c[2]], aim: c[3], ph: Math.random() * 5 }));
  L.props = [ { kind: 'kiosk', x: 800, y: 1890 }, { kind: 'solar', x: 470, y: 1470 }, { kind: 'solar', x: 1130, y: 1470 },
              { kind: 'antenna', x: 1250, y: 1660 }, { kind: 'tank', x: 1000, y: 1150 }, { kind: 'plant', x: 360, y: 2260 }, { kind: 'plant', x: 430, y: 1940 },
              { kind: 'tank', x: 380, y: 7040 }, { kind: 'plant', x: 1230, y: 6860 }, { kind: 'antenna', x: 340, y: 6300 } ];
  // 지구 출신 주자: 광장 대기 구역에서 기다린다
  L.npcs = [ [1230, 2130, 0], [1330, 2240, 4], [1400, 2130, 3] ].map(n => ({ x: n[0], y: n[1], tx: n[0], ty: n[1], look: LOOKS[n[2]], t: Math.random() * 5, wait: Math.random() * 2, moving: false }));
  // 화성 태생 주자: 번호표를 달고 차단막을 그냥 지나간다
  L.runners = [ [470, 3, 7, 150], [690, 2, 12, 240], [910, 4, 31, 320], [1130, 1, 45, 200] ]
    .map(r => ({ lane: r[0], x: r[0], y: 6556, look: LOOKS[r[1]], bib: r[2], off: r[3] }));
  L.rocks = [];
  let seed = 9; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 260 && L.rocks.length < 70; i++) {
    const x = 90 + rnd() * 1420, y = 830 + rnd() * 6240;
    const onTrack = x > TX0 - 20 && x < TX1 + 20;
    if (y > RACE_END - 30 && !onTrack) continue;
    if (L.pads.some(p => x > p.x - 30 && x < p.x + p.w + 30 && y > p.y - 30 && y < p.y + p.h + 30)) continue;
    if (L.domes.some(d => dist(x, y, d.x, d.y) < d.r + 50) || L.solids.some(s => !s.cliff && x > s.x - 40 && x < s.x + s.w + 40 && y > s.y - 40 && y < s.y + s.h + 40)) continue;
    if (L.chips.some(c => dist(x, y, c.x, c.y) < 70) || L.boosts.some(b => dist(x, y, b.x, b.y) < 110) || L.walls.some(w => Math.abs(y - w.y) < 44)) continue;
    L.rocks.push({ x, y, kind: onTrack || rnd() < 0.35 ? 'crater' : 'rock', s: (onTrack ? 0.5 : 0.6) + rnd() * (onTrack ? 0.5 : 0.9), a: rnd() * TAU });
  }
  return L;
}
/* ----- 3스테이지 지도: 산소 공장 -----
   아래에서 위로: A 1교대 라인(벨트가 뒤로 민다) → B 24시간 라인(좌우 벨트와 압착기, 일하는 정착민)
   → 24시간 가동 장치(동료 3명이 모여야 멈춘다) → C 쉬는 시간이 생긴 공장 → 시계탑(보스) */
function layoutStage3() {
  const L = {
    w: 1600, h: 4100, start: { x: 800, y: 3990 },
    arena: { x: 160, y: 0, w: 1280, h: 720 },
    solids: [ { x: 0, y: 0, w: 160, h: 800 }, { x: 1440, y: 0, w: 160, h: 800 }, { x: 160, y: 720, w: 400, h: 80 }, { x: 1040, y: 720, w: 400, h: 80 } ],
    walls: [], gens: [], zones: [], chips: [], caps: [],
    restrict: { kind: 'factory', wall: 'wB',
      hud: '24시간 가동 · 벨트 안 멈춤 · 쉼터 잠김', hudFree: '8시간 노동! 쉼터가 열렸어요',
      mission: '문 열기·24시간 가동 멈추기',
      free: { title: '퇴근! 이제 8시간만 일해요', sub: '벨트가 멈추고 쉼터가 열렸어요. 쉼터에 들어가면 피로가 풀리고 체력이 회복돼요!', cheer: '퇴근이다!', joinN: 0 } },
    missionWalls: ['wC', 'wB', 'wA'],
    capsRequired: 3, capLabel: '일하는 정착민 풀어 주기',
    // 피로: 24시간 가동 중에는 쉬지 못해 피로가 쌓이고(fill초에 가득), 가득 차면 체력이 초당 drain씩 줄어든다(최대 체력의 floor 아래로는 줄지 않는다)
    // idle: 가동 중에는 가만히 있어도 초당 이만큼 체력이 줄어든다. slow: 피로가 가득 찼을 때 주인공이 느려지는 정도(0.3 = 30% 느림)
    fatigue: { fill: 40, drain: 1, floor: 0.45, idle: 0.35, slow: 0.3 },
    // 일하는 장면: 산소 통을 need개, from에서 들어 to(벨트)에 올린다. 한 번 올릴 때마다 hours시간이 지난다. 다 올려야 작업 구역을 나갈 수 있다
    work: { need: 3, hours: 8, from: { x: 620, y: 3995 }, to: { x: 990, y: 3870 }, spawn: [['drone', 480, 3560], ['drone', 900, 3480], ['chaser', 700, 3330]] },
    bossPools: BOSS_POOLS3, bossStill: true, bossClock: true,
    npcBounds: { x0: 180, x1: 380, y0: 1910, y1: 2050 },
    legend: [
      { k: 'hero', n: '나 (정착촌 학생)', t: '공명기로 가장 가까운 적을 자동으로 쏴요' },
      { k: 'belt', n: '컨베이어 벨트', t: '멈추지 않아요. 가만히 서 있으면 밀려가요. 끝의 압착기는 아파요' },
      { k: 'worker', n: '일하는 정착민', t: '닿으면 풀려나 동료가 돼요. 3명이 모여야 가동 장치를 멈춰요' },
      { k: 'machine', n: '24시간 가동 장치', t: '혼자서는 못 멈춰요. 동료 3명과 함께 부수면 벨트가 멈춰요' },
      { k: 'rest', n: '쉼터', t: '지금은 잠겨 있어요. 쉬지 못하면 피로가 쌓이고 체력이 줄어요' },
      { k: 'chip', n: '기록 칩', t: '실제 지구 역사 기록. 모두 모아야 보스 문이 열려요' }
    ],
    flow: ['정착민 3명 풀어 주기', '함께 가동 장치 멈추기', '기록 칩 모두 모으기', '보스를 증거로 반박'],
    rules: [
      { k: 'belt24', n: '24시간 가동 = 쉬지 못함', d: '가만히 있어도 체력이 줄고, 피로가 쌓일수록 느려져요. 가동 장치를 멈춰야 쉴 수 있어요' },
      { k: 'unity', n: '단결', d: '가동 장치는 혼자서 못 멈춰요. 일하는 정착민 3명을 풀어 주고 함께 멈춰요' }
    ]
  };
  const wall = (id, x, y, w, h, gens, o) => L.walls.push(Object.assign({ id, x, y, w, h, gens, active: true, fade: 1 }, o || {}));
  const gen = (id, x, y, hp, o) => L.gens.push(Object.assign({ id, x, y, r: 32, hp: hp || 140, maxHp: hp || 140, alive: true, hitT: 0 }, o || {}));
  wall('wC', 70, 3196, 1460, 16, ['g1a', 'g1b'], { offMsg: ['라인 문이 열렸어요!', '위로 나아가세요'] });
  gen('g1a', 430, 3300, 90); gen('g1b', 1170, 3300, 90);
  // 작업 구역 울타리: 산소 통을 다 올리기 전에는 자리를 뜰 수 없다
  wall('wk', 70, 3828, 1460, 12, [], { soft: true, workFence: true, denyText: '작업 중 · 자리 이탈 금지' });
  wall('wB', 70, 1796, 1460, 16, ['g2d'], { divider: true });
  // 벨트를 돌리는 장치: 동료가 3명 모여야 방어막이 풀린다(단결)
  gen('g2d', 800, 2050, 320, { name: '24시간 가동 장치', big: true, needAllies: 3, drop: 'r3_wagner' });
  wall('wA', 0, 796, 1600, 16, ['g3a', 'g3b']);
  gen('g3a', 330, 935, 120); gen('g3b', 1270, 935, 120);
  wall('gate', 560, 712, 480, 16, [], { active: false, fade: 0, gate: true });
  wall('recgate', 560, 744, 480, 16, [], { recordGate: true, soft: true });
  // 2스테이지에서 바꾼 것: 열린 차단막
  wall('d0l', 330, 4056, 300, 18, [], { barrier: true, soft: true, active: false, fade: 0 });
  wall('d0r', 970, 4056, 300, 18, [], { barrier: true, soft: true, active: false, fade: 0 });
  L.zones = [
    { y0: 3212, y1: 4100, exit: 'wC', check: { x: 800, y: 3990 }, label: 'A 구역 · 1교대 라인',
      pool: ['drone', 'chaser'], max: 3, every: 4.5,
      initial: [] },
    { y0: 1812, y1: 3196, exit: 'wB', check: { x: 800, y: 3140 }, label: 'B 구역 · 24시간 라인',
      pool: ['drone', 'chaser', 'drone'], max: 5, every: 3.4,
      initial: [['turret', 1350, 3070], ['drone', 900, 2770], ['drone', 600, 2530], ['turret', 520, 2200], ['turret', 1080, 2200]] },
    { y0: 812, y1: 1796, exit: 'wA', check: { x: 800, y: 1740 }, label: 'C 구역 · 쉬는 시간이 생긴 공장',
      pool: ['drone', 'chaser', 'drone'], max: 5, every: 3.6,
      initial: [['turret', 210, 1060], ['turret', 1390, 1060], ['guard', 800, 1160, 'r3_ilo'], ['drone', 480, 1420], ['chaser', 1120, 1450]] }
  ];
  // 컨베이어 벨트(24시간 가동 중에만 움직인다), 벨트 위의 작업 섬, 벨트 끝의 압착기, 쉼터
  L.belts = [ { x: 70, y: 3420, w: 1460, h: 400, dx: 0, dy: 1, speed: 90 },
              { x: 70, y: 2800, w: 1460, h: 180, dx: -1, dy: 0, speed: 130 },
              { x: 70, y: 2560, w: 1460, h: 180, dx: 1, dy: 0, speed: 130 },
              { x: 70, y: 2320, w: 1460, h: 180, dx: -1, dy: 0, speed: 130 },
              { x: 70, y: 1500, w: 1460, h: 150, dx: 1, dy: 0, speed: 130 } ];
  L.islands = [ { x: 1120, y: 3540, w: 220, h: 170 }, { x: 330, y: 2800, w: 200, h: 180 }, { x: 1070, y: 2560, w: 200, h: 180 } ];
  L.presses = [ { x: 70, y: 2800, w: 90, h: 180 }, { x: 1440, y: 2560, w: 90, h: 180 }, { x: 70, y: 2320, w: 90, h: 180 } ];
  L.rests = [ { x: 150, y: 1880, w: 260, h: 200 }, { x: 1170, y: 1290, w: 260, h: 180 } ];
  // 기록 칩 8개: A 2, B 2 + 가동 장치가 떨어뜨리는 1, C 2 + 감시 드론이 가진 1
  L.chips = [ ['r3_child', 560, 3900], ['r3_1886', 800, 3335], ['r3_mayday', 800, 3090], ['r3_weimar', 1228, 2650], ['r3_memorial', 240, 1380], ['r3_phila', 800, 884] ]
    .map(c => ({ id: c[0], x: c[1], y: c[2], t: Math.random() * 5, got: false }));
  // 작업대에 묶여 일하는 정착민: 닿으면 풀려나 동료가 된다
  L.caps = [ [1230, 3625, 1], [430, 2890, 3], [1130, 2650, 0] ].map(c => ({ x: c[0], y: c[1], look: LOOKS[c[2]], freed: false, t: Math.random() * 5, kind: 'worker' }));
  [[520, 1200], [1080, 1200], [300, 3910], [1310, 3930], [640, 2260], [960, 2260]]
    .forEach(c => L.solids.push({ x: c[0] - 28, y: c[1] - 28, w: 56, h: 56, crate: true }));
  L.solids.push({ x: 0, y: 800, w: 70, h: 3300, fwall: true }, { x: 1530, y: 800, w: 70, h: 3300, fwall: true });
  L.pads = [ { x: 70, y: 812, w: 1460, h: 3288 } ];
  L.domes = [];
  const sl = (stageById(3).slogans || []);
  L.boards = [ { x: 250, y: 4084, text: sl[0] }, { x: 430, y: 3130, text: sl[1] }, { x: 430, y: 1770, text: sl[2] } ].filter(b => b.text);
  L.signs = [ { x: 1400, y: 4040, text: '누구나 출전' } ];
  L.crowd = [ [350, 4020, 0, 0], [430, 4066, 3, 0], [1190, 4050, 4, Math.PI], [1262, 4000, 1, Math.PI] ]
    .map(c => ({ x: c[0], y: c[1], look: LOOKS[c[2]], aim: c[3], ph: Math.random() * 5 }));
  L.props = [ { kind: 'clock', x: 1320, y: 1960 }, { kind: 'tank', x: 120, y: 3880 }, { kind: 'tank', x: 1480, y: 3300 }, { kind: 'tank', x: 120, y: 3100 }, { kind: 'tank', x: 1480, y: 2250 },
              { kind: 'tank', x: 1000, y: 1150 }, { kind: 'tank', x: 120, y: 1700 }, { kind: 'antenna', x: 1250, y: 1700 } ];
  // 벨트 옆에서 일하는 정착민들(화성 태생·지구 출신이 함께): 가동이 멈추면 쉼터로 간다
  L.npcs = [ [600, 2772, 2], [1000, 2772, 4], [430, 2532, 1], [900, 2532, 3], [300, 3848, 0], [1390, 3848, 2] ]
    .map(n => ({ x: n[0], y: n[1], tx: n[0], ty: n[1], look: LOOKS[n[2]], t: Math.random() * 5, wait: 0, moving: false, post: true }));
  L.rocks = [];
  return L;
}
/* ----- 4스테이지 지도: 두 돔 사이 -----
   왼쪽 벽 = 알파 돔, 오른쪽 벽 = 베타 돔. 벽에 붙은 발사대는 공격이 통하지 않고 서로를 향해 끝없이 쏜다.
   아래에서 위로: A 알파 돔 출구(송신탑 1) → B 두 돔 사이 크레이터(송신탑 3, 다 켜면 무기 경쟁이 멈춤) → C 평화의 길 → 보스 */
function layoutStage4() {
  const L = {
    w: 1600, h: 4900, start: { x: 800, y: 4790 },
    arena: { x: 160, y: 0, w: 1280, h: 720 },
    solids: [ { x: 0, y: 0, w: 160, h: 800 }, { x: 1440, y: 0, w: 160, h: 800 }, { x: 160, y: 720, w: 400, h: 80 }, { x: 1040, y: 720, w: 400, h: 80 } ],
    walls: [], gens: [], zones: [], chips: [], caps: [],
    restrict: { kind: 'arms', wall: 'wB', mission: '송신탑 켜기·문 열기',
      free: { title: '평화의 목소리가 이어졌어요', sub: '두 돔의 포탑이 내려갔어요. 하지만 무기가 모두 사라진 것은 아니에요. 빨간 잔여 신호 하나가 아직 깜박여요', cheer: '평화!', joinN: 0 } },
    missionWalls: ['wC', 'wB', 'wA'],
    // 무기 경쟁: 처음 무기 수, 몇 초마다 한쪽이 늘리는지(다른 쪽이 곧 따라 늘린다)
    armsRace: { start: 12, every: 3.2 },
    // 송신탑을 켜는 데 혼자 버티는 시간(초). 동료 1명마다 35% 빨라진다
    towerTime: 7,
    bossPools: BOSS_POOLS4, bossPods: 4, residual: true,
    legend: [
      { k: 'hero', n: '나 (정착촌 학생)', t: '공명기로 가장 가까운 적을 자동으로 쏴요' },
      { k: 'launcher', n: '미사일 발사대', t: '공격이 통하지 않아요. 쏠수록 두 돔의 무기가 늘어나요' },
      { k: 'tower', n: '연대 송신탑', t: '원 안에서 버티면 켜져요. 동료가 많을수록 빨라요' },
      { k: 'warn', n: '미사일 경고', t: '빨간 원이 뜨면 곧 미사일이 떨어져요. 원 밖으로!' },
      { k: 'drone', n: '오더의 드론', t: '하얀 공 모양 기계. 주황 탄을 피하세요' },
      { k: 'chip', n: '기록 칩', t: '실제 지구 역사 기록. 모두 모아야 보스 문이 열려요' }
    ],
    flow: ['송신탑 켜기', '무기 경쟁 멈추기', '기록 칩 모두 모으기', '보스를 증거로 반박'],
    rules: [
      { k: 'arms', n: '무기 경쟁 = 쏴서는 못 이겨요', d: '발사대는 공격이 통하지 않고, 쏠수록 두 돔의 무기가 늘어나요. 미사일은 끝없이 와요' },
      { k: 'tower', n: '연대 송신탑', d: '원 안에서 버티면 켜져요. 동료가 많을수록 빨리 켜지고, 다 켜면 포탑이 내려가요' }
    ]
  };
  const wall = (id, x, y, w, h, gens, o) => L.walls.push(Object.assign({ id, x, y, w, h, gens, active: true, fade: 1 }, o || {}));
  const gen = (id, x, y, hp, o) => L.gens.push(Object.assign({ id, x, y, r: 32, hp: hp || 140, maxHp: hp || 140, alive: true, hitT: 0 }, o || {}));
  const tower = (id, x, y, o) => gen(id, x, y, 1, Object.assign({ tower: true, r: 26, zone: 118, charge: 0 }, o || {}));
  wall('wC', 130, 3964, 1340, 16, ['t1'], { offMsg: ['방어선이 열렸어요!', '두 돔 사이 크레이터로 나아가세요'] });
  tower('t1', 800, 4250, { time: 9 });
  wall('wB', 130, 1796, 1340, 16, ['t2', 't3', 't4'], { divider: true });
  tower('t2', 470, 3450); tower('t3', 1130, 2850); tower('t4', 800, 2190);
  wall('wA', 0, 796, 1600, 16, ['g3a', 'g3b', 'g3c']);
  gen('g3a', 330, 935, 120); gen('g3b', 1270, 935, 120); gen('g3c', 800, 1330, 120);
  wall('gate', 560, 712, 480, 16, [], { active: false, fade: 0, gate: true });
  wall('recgate', 560, 744, 480, 16, [], { recordGate: true, soft: true });
  L.zones = [
    { y0: 3980, y1: 4900, exit: 'wC', check: { x: 800, y: 4790 }, label: 'A 구역 · 알파 돔 출구',
      pool: ['drone', 'chaser'], max: 3, every: 4.5,
      initial: [['drone', 560, 4420], ['drone', 1040, 4250], ['chaser', 800, 4080]] },
    { y0: 1812, y1: 3964, exit: 'wB', check: { x: 800, y: 3900 }, label: 'B 구역 · 두 돔 사이 크레이터',
      pool: ['drone', 'chaser', 'drone'], max: 4, every: 3.6,
      initial: [['drone', 800, 2950, 'r4_npt'], ['drone', 640, 3700], ['chaser', 1000, 3150], ['drone', 560, 2400]] },
    { y0: 812, y1: 1796, exit: 'wA', check: { x: 800, y: 1740 }, label: 'C 구역 · 평화의 길',
      pool: ['drone', 'chaser', 'drone'], max: 6, every: 3.2,
      initial: [['turret', 230, 1060], ['turret', 1370, 1060], ['guard', 800, 1120], ['drone', 480, 1420], ['chaser', 1120, 1460], ['drone', 1000, 1600]] }
  ];
  // 기록 칩 7개: A 2, B 2 + 드론이 가진 1(NPT), C 2
  L.chips = [ ['r4_vietnam', 450, 4560], ['r4_protest', 1170, 4140], ['r4_withdrawal', 1250, 3620], ['r4_nuclear', 360, 2560], ['r4_iraq', 260, 1500], ['r4_ukraine', 800, 884] ]
    .map(c => ({ id: c[0], x: c[1], y: c[2], t: Math.random() * 5, got: false }));
  // 발사대: a = 알파 돔(왼쪽 벽, 오른쪽을 겨눔), b = 베타 돔(오른쪽 벽, 왼쪽을 겨눔). tower = 이 송신탑이 켜지면 접힌다
  const lau = (side, y, tw, o) => Object.assign({ side, x: side === 'a' ? 172 : 1428, y, tower: tw, folded: false, foldK: 0, t: Math.random() * 5, fireT: rand(0.8, 3.5) }, o || {});
  L.launchers = [
    lau('a', 4660, 't1'), lau('b', 4470, 't1'), lau('a', 4220, 't1'), lau('b', 4060, 't1'),
    lau('a', 3820, 't2'), lau('b', 3660, 't2'), lau('a', 3420, 't2'), lau('b', 3260, 't2'),
    lau('a', 3060, 't3'), lau('b', 2900, 't3'), lau('a', 2700, 't3'), lau('b', 2560, 't3'),
    lau('a', 2360, 't4'), lau('b', 2200, 't4'), lau('a', 1990, 't4'), lau('b', 1930, 't4', { residual: true }),
    lau('a', 1560, null, { folded: true, foldK: 1 }), lau('b', 1400, null, { folded: true, foldK: 1 }), lau('a', 1120, null, { folded: true, foldK: 1 }), lau('b', 1000, null, { folded: true, foldK: 1 })
  ];
  [[560, 4400], [1060, 4520], [660, 3300], [960, 3020], [560, 2420], [1080, 2470], [520, 1200], [1080, 1200]]
    .forEach(c => L.solids.push({ x: c[0] - 28, y: c[1] - 28, w: 56, h: 56, crate: true }));
  // 두 돔의 벽(바깥으로 나갈 수 없다)
  L.solids.push({ x: 0, y: 800, w: 130, h: 4100, dwall: 'a' }, { x: 1470, y: 800, w: 130, h: 4100, dwall: 'b' });
  L.pads = [ { x: 560, y: 4700, w: 480, h: 190 }, { x: 660, y: 812, w: 280, h: 984 }, { x: 200, y: 862, w: 1200, h: 150 } ];
  L.domes = [];
  const sl = (stageById(4).slogans || []);
  L.boards = [ { x: 330, y: 4890, text: sl[0] }, { x: 1150, y: 3930, text: sl[1] }, { x: 430, y: 1770, text: sl[2] } ].filter(b => b.text);
  // 3스테이지에서 바뀐 것: 8시간만 일하게 된 사람들이 퇴근 뒤 평화 행진에 모였다
  L.signs = [ { x: 1210, y: 4830, text: '평화 행진 모임' } ];
  L.crowd = [ [1100, 4700, 1, Math.PI, '평화'], [1290, 4740, 2, Math.PI, '무기 말고 평화'], [1180, 4880, 0, Math.PI, ''], [420, 4790, 3, 0, '함께 걸어요'] ]
    .map(c => ({ x: c[0], y: c[1], look: LOOKS[c[2]], aim: c[3], ph: Math.random() * 5, sign: c[4] }));
  L.props = [ { kind: 'antenna', x: 300, y: 4800 }, { kind: 'tank', x: 1360, y: 4620 }, { kind: 'solar', x: 470, y: 1470 }, { kind: 'solar', x: 1130, y: 1470 }, { kind: 'tank', x: 1000, y: 1150 }, { kind: 'antenna', x: 1250, y: 1660 } ];
  L.npcs = [];
  L.rocks = [];
  let seed = 23; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 320 && L.rocks.length < 90; i++) {
    const x = 160 + rnd() * 1280, y = 830 + rnd() * 4040;
    if (L.pads.some(p => x > p.x - 30 && x < p.x + p.w + 30 && y > p.y - 30 && y < p.y + p.h + 30)) continue;
    if (L.gens.some(t => dist(x, y, t.x, t.y) < (t.zone || 60) + 30) || L.solids.some(s => !s.dwall && x > s.x - 40 && x < s.x + s.w + 40 && y > s.y - 40 && y < s.y + s.h + 40)) continue;
    if (L.chips.some(c => dist(x, y, c.x, c.y) < 70) || L.walls.some(w => Math.abs(y - w.y) < 44)) continue;
    L.rocks.push({ x, y, kind: y > 1800 && rnd() < 0.6 ? 'crater' : 'rock', s: 0.6 + rnd() * 0.9, a: rnd() * TAU });
  }
  return L;
}
/* ----- 5스테이지 지도: 마른 얼음 호수 -----
   아래에서 위로: A 마른 부두(우리 돔 밸브 1개. 잠가도 모래폭풍은 그대로) → B 마른 호수 바닥(다른 돔 밸브 3개, 네 돔이 모두 잠그면 폭풍이 걷히고 호수에 물이 참)
   → C 다시 찬 호숫가 → 보스. 모래폭풍 때문에 내 둘레만 보이고, 가끔 돌풍이 옆으로 민다 */
function layoutStage5() {
  const LK = { x: 110, y: 1812, w: 1380, h: 3360 };
  const L = {
    w: 1600, h: 5600, start: { x: 800, y: 5480 },
    arena: { x: 160, y: 0, w: 1280, h: 720 },
    solids: [ { x: 0, y: 0, w: 160, h: 800 }, { x: 1440, y: 0, w: 160, h: 800 }, { x: 160, y: 720, w: 400, h: 80 }, { x: 1040, y: 720, w: 400, h: 80 } ],
    walls: [], gens: [], zones: [], chips: [], caps: [],
    restrict: { kind: 'storm', wall: 'wB', mission: '밸브 잠그기·문 열기',
      free: { title: '호수에 물이 돌아왔어요!', sub: '네 돔이 함께 파이프를 잠갔어요. 모래폭풍이 걷히고 호수에 물이 차요', cheer: '물이다!', joinN: 0 } },
    missionWalls: ['wC', 'wB', 'wA'],
    // 모래폭풍: 보이는 둘레(반지름)는 r0에서 시작해 함께 지키는 돔이 하나 늘 때마다 step만큼 넓어진다. domes = 함께 지켜야 하는 돔 수
    // gust: 돌풍(초). every 사이마다 warn 동안 화살표로 알리고 blow 동안 power만큼 옆으로 민다
    storm: { r0: 225, step: 40, domes: 4, gust: { every: [7, 10], warn: 1.3, blow: 2.4, power: 125 } },
    // 호수 물(%): 처음 water0, 밸브 하나마다 waterStep씩 오르고, 폭풍이 걷히면 100
    water0: 8, waterStep: 20,
    lake: LK,
    bossPools: BOSS_POOLS5, bossPipes: 4,
    legend: [
      { k: 'hero', n: '나 (정착촌 학생)', t: '공명기로 가장 가까운 적을 자동으로 쏴요' },
      { k: 'valve', n: '물 빼돌리는 밸브', t: '부수면 잠겨요. 잠근 돔의 주민이 동료가 돼요' },
      { k: 'storm', n: '모래폭풍', t: '내 둘레만 보여요. 목표와 기록 칩은 모래 너머로 깜박여요' },
      { k: 'gust', n: '돌풍', t: '화살표가 뜨면 곧 옆으로 밀려요. 반대쪽으로 버티거나 대시' },
      { k: 'drone', n: '오더의 드론', t: '하얀 공 모양 기계. 주황 탄을 피하세요' },
      { k: 'chip', n: '기록 칩', t: '실제 지구 역사 기록. 모두 모아야 보스 문이 열려요' }
    ],
    flow: ['우리 돔 밸브 잠그기', '다른 돔 밸브 잠그기', '기록 칩 모두 모으기', '보스를 증거로 반박'],
    rules: [
      { k: 'storm', n: '모래폭풍 = 앞이 안 보여요', d: '내 둘레만 보이고 돌풍이 옆으로 밀어요. 목표와 기록 칩은 모래 너머로 깜박여요' },
      { k: 'valve', n: '함께 지키는 돔', d: '우리 돔 밸브만 잠가서는 폭풍이 안 멈춰요. 네 돔의 밸브를 모두 잠가요' }
    ]
  };
  const wall = (id, x, y, w, h, gens, o) => L.walls.push(Object.assign({ id, x, y, w, h, gens, active: true, fade: 1 }, o || {}));
  const gen = (id, x, y, hp, o) => L.gens.push(Object.assign({ id, x, y, r: 32, hp: hp || 140, maxHp: hp || 140, alive: true, hitT: 0 }, o || {}));
  const valve = (id, x, y, dome, o) => gen(id, x, y, 400, Object.assign({ valve: true, dome, name: dome + ' 밸브' }, o || {}));
  wall('wC', LK.x, 4484, LK.w, 16, ['v0'], { offMsg: ['우리 돔 밸브를 잠갔어요!', '그런데 모래폭풍은 그대로예요. 다른 돔 파이프에서도 물이 계속 빠져나가요'] });
  valve('v0', 290, 4640, '알파 돔');
  wall('wB', LK.x, 1796, LK.w, 16, ['v1', 'v2', 'v3'], { divider: true });
  valve('v1', 1260, 3980, '베타 돔'); valve('v2', 290, 3060, '감마 돔'); valve('v3', 1250, 2160, '델타 돔');
  wall('wA', 0, 796, 1600, 16, ['g3a', 'g3b', 'g3c']);
  gen('g3a', 330, 935, 120); gen('g3b', 1270, 935, 120); gen('g3c', 800, 1330, 120);
  wall('gate', 560, 712, 480, 16, [], { active: false, fade: 0, gate: true });
  wall('recgate', 560, 744, 480, 16, [], { recordGate: true, soft: true });
  L.zones = [
    { y0: 4500, y1: 5600, exit: 'wC', check: { x: 800, y: 5480 }, label: 'A 구역 · 마른 부두',
      pool: ['drone', 'chaser', 'drone'], max: 5, every: 3.8,
      initial: [['drone', 1080, 4900], ['drone', 640, 4700], ['chaser', 1000, 4620], ['guard', 420, 4760], ['turret', 1300, 4820], ['turret', 560, 4560]] },
    { y0: 1812, y1: 4484, exit: 'wB', check: { x: 800, y: 4420 }, label: 'B 구역 · 마른 호수 바닥',
      pool: ['drone', 'chaser', 'drone'], max: 6, every: 3.2,
      initial: [['turret', 1080, 3850], ['guard', 420, 3150], ['turret', 1080, 2280], ['drone', 900, 3300, 'r5_dust'], ['drone', 520, 2700], ['chaser', 700, 4050], ['drone', 800, 2150]] },
    { y0: 812, y1: 1796, exit: 'wA', check: { x: 800, y: 1740 }, label: 'C 구역 · 다시 찬 호숫가',
      pool: ['drone', 'chaser', 'drone'], max: 6, every: 3.2,
      initial: [['turret', 230, 1060], ['turret', 1370, 1060], ['guard', 800, 1120, 'r5_kyoto'], ['drone', 480, 1420], ['chaser', 1120, 1460], ['drone', 1000, 1600]] }
  ];
  // 기록 칩 9개: A 3, B 2 + 드론이 가진 1(황사), C 2 + 감시 드론이 가진 1(교토 의정서). 파리 협정은 보스 문 바로 앞
  L.chips = [ ['r5_aral', 640, 5250], ['r5_1989', 1300, 4980], ['r5_2008', 760, 4600], ['r5_ships', 740, 4170], ['r5_greenpeace', 1000, 2620], ['r5_rio', 240, 1520], ['r5_paris', 800, 884] ]
    .map(c => ({ id: c[0], x: c[1], y: c[2], t: Math.random() * 5, got: false }));
  // 물을 빼돌리는 파이프: 밸브에서 오른쪽(농장 돔 쪽) 절벽까지 이어진다
  L.pipes = L.gens.filter(g => g.valve).map(g => ({ gen: g.id, x0: g.x + 30, x1: LK.x + LK.w, y: g.y - 8 }));
  // 호수 바닥에 남은 배(부딪힌다). 물이 차면 다시 뜬다
  [[560, 4300, -0.1], [1030, 3720, 0.12], [640, 3260, -0.08], [300, 2860, 0.1], [1020, 2430, -0.12], [1250, 2050, 0.08], [380, 5000, 0.14]]
    .forEach(b => L.solids.push({ x: b[0] - 62, y: b[1] - 24, w: 124, h: 48, boat: true, tilt: b[2] }));
  [[520, 1200], [1080, 1200]].forEach(c => L.solids.push({ x: c[0] - 28, y: c[1] - 28, w: 56, h: 56, crate: true }));
  L.solids.push({ x: 0, y: 800, w: LK.x, h: 4800, cliff: true }, { x: LK.x + LK.w, y: 800, w: 1600 - LK.x - LK.w, h: 4800, cliff: true });
  // 부두: 출발 지점에서 마른 호수 쪽으로 뻗어 있다(끝은 이제 마른 땅 위)
  L.pads = [ { x: 560, y: 5400, w: 480, h: 190 }, { x: 740, y: 5040, w: 120, h: 380 }, { x: 660, y: 812, w: 280, h: 984 }, { x: 200, y: 862, w: 1200, h: 150 } ];
  L.domes = [];
  const sl = (stageById(5).slogans || []);
  L.boards = [ { x: 330, y: 5590, text: sl[0] }, { x: 1180, y: 4470, text: sl[1] }, { x: 430, y: 1770, text: sl[2] } ].filter(b => b.text);
  // 4스테이지에서 바뀐 것: 길이 열린 두 돔 사람들이 함께 호수를 되살리러 나섰다
  L.signs = [ { x: 1240, y: 5440, text: '두 돔 함께 탐사대' } ];
  L.crowd = [ [1130, 5530, 1, Math.PI, '물을 돌려줘요'], [1340, 5540, 4, Math.PI, '함께 지켜요'], [1240, 5580, 2, Math.PI, ''], [400, 5500, 0, 0, '호수를 살려요'] ]
    .map(c => ({ x: c[0], y: c[1], look: LOOKS[c[2]], aim: c[3], ph: Math.random() * 5, sign: c[4] }));
  L.props = [ { kind: 'antenna', x: 260, y: 5560 }, { kind: 'tank', x: 1440, y: 5380 }, { kind: 'solar', x: 470, y: 1470 }, { kind: 'solar', x: 1130, y: 1470 }, { kind: 'plant', x: 300, y: 1650 }, { kind: 'plant', x: 1300, y: 1640 }, { kind: 'plant', x: 1000, y: 1150 }, { kind: 'antenna', x: 1250, y: 1700 } ];
  // 밸브 옆에서 기침하는 각 돔 주민: 밸브를 잠그면 동료가 된다
  const say = ['콜록… 물을 돌려줘요!', '앞이 안 보여요!', '물이 다 어디 갔지?', '목말라요…'];
  L.npcs = [ ['v0', 390, 4720, 3], ['v1', 1170, 4060, 0], ['v2', 380, 3140, 2], ['v3', 1160, 2240, 4] ]
    .map(n => ({ valve: n[0], x: n[1], y: n[2], tx: n[1], ty: n[2], look: LOOKS[n[3]], t: Math.random() * 5, wait: 0, moving: false, post: true, say }));
  L.rocks = [];
  let seed = 31; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 260 && L.rocks.length < 40; i++) {
    const x = 120 + rnd() * 1360, y = 830 + rnd() * 4760;
    if (y > LK.y - 40 && y < LK.y + LK.h + 30) continue;
    if (L.pads.some(p => x > p.x - 30 && x < p.x + p.w + 30 && y > p.y - 30 && y < p.y + p.h + 30)) continue;
    if (L.solids.some(s => !s.cliff && x > s.x - 40 && x < s.x + s.w + 40 && y > s.y - 40 && y < s.y + s.h + 40)) continue;
    if (L.chips.some(c => dist(x, y, c.x, c.y) < 70) || L.walls.some(w => Math.abs(y - w.y) < 44)) continue;
    L.rocks.push({ x, y, kind: rnd() < 0.3 ? 'crater' : 'rock', s: 0.6 + rnd() * 0.9, a: rnd() * TAU });
  }
  return L;
}
/* ----- 종장 지도: 오더 코어 -----
   오더 본체가 앞 스테이지의 문제를 한꺼번에 다시 켰다. 「원칙 단말기」는 그 운동의 방법으로 열고(쏴서는 안 열림),
   기록 발판 3개를 「문제 → 행동 → 제도」 순서로 밟으면 제도 카드가 꽂혀 그 문제만 꺼진다(G.off). 스테이지 순서가 아니라 섞인 순서:
   A-1 노동(단결: 벨트 위 세 사람 풀기) → A-2 민권(비폭력 행진: 쏘지 않고 걷기) → B-1 환경(협약: 모래폭풍 속 밸브 4개)
   → B-2 반전 평화(연대: 발사대 아래 원 안에서 버티기) → C 여성(완주: 차단막 틈으로 시간 안에) → 헌장 문 → 오더 본체 */
function layoutStage6() {
  const DX = 1000, EX0 = DX + 16, EX1 = 1530;
  const L = {
    w: 1600, h: 6800, start: { x: 1270, y: 6720 },
    arena: { x: 160, y: 0, w: 1280, h: 720 },
    solids: [ { x: 0, y: 0, w: 160, h: 800 }, { x: 1440, y: 0, w: 160, h: 800 }, { x: 160, y: 720, w: 400, h: 80 }, { x: 1040, y: 720, w: 400, h: 80 } ],
    walls: [], gens: [], zones: [], chips: [], caps: [],
    restrict: { kind: 'core', wall: 'charter', lane: { x0: EX0, x1: EX1, y0: 4616, y1: 6800 }, slow: 0.72, noDash: true,
      mission: '단말기에 제도 카드 꽂기',
      free: { title: '헌장 문이 열렸어요!', sub: '다섯 조항이 모두 입력되고 수업 정리표가 완성됐어요. 이제 오더 본체에게 가요', cheer: '함께 가자!', joinN: 0 } },
    missionWalls: ['a1', 'wC', 'b1', 'wB', 'wA'],
    sockets: 5, capLabel: '일하는 사람 풀어 주기', capsRequired: 3,
    // 피로(3스테이지)와 모래폭풍(5스테이지)은 그 구역(zone 번호: 0 = A-1, 1 = A-2, 2 = B-1, 3 = B-2, 4 = C)에서만 느낀다
    fatigue: { fill: 40, drain: 1, floor: 0.45, idle: 0.35, slow: 0.3, zone: 0 },
    storm: { r0: 230, step: 30, domes: 4, zone: 2, gust: { every: [7, 10], warn: 1.3, blow: 2.4, power: 125 } },
    // 연대: 원 안에서 버티는 시간(초), 완주: 출발 신호 뒤 단말기까지 제한 시간(초)
    holdTime: 10, runLimit: 24,
    runStart: { x: 560, y: 2040, w: 480, h: 110 },
    // 오더 본체는 다른 보스(4000)보다 단단하다
    bossPools: BOSS_POOLS6, bossStill: true, finalBoss: true, bossHp: 5600,
    npcBounds: { x0: 120, x1: 930, y0: 4680, y1: 6740 },
    legend: [
      { k: 'hero', n: '나 (지구 출신 학생)', t: '공명기로 가장 가까운 적을 자동으로 쏴요' },
      { k: 'socket', n: '원칙 단말기', t: '그 운동의 방법으로 열어요. 쏴서는 안 열려요' },
      { k: 'pad', n: '정리표 퀴즈', t: '단말기가 열리면 문제 → 행동 → 제도를 맞혀 카드를 꽂아요' },
      { k: 'worker', n: '일하는 사람', t: '노동 단말기: 벨트 위의 세 사람을 풀어 줘요' },
      { k: 'valve', n: '밸브', t: '환경 단말기: 모래폭풍 속 밸브 네 개를 잠가요' },
      { k: 'charter', n: '헌장 문', t: '제도 카드 5장을 모두 꽂으면 열려요' }
    ],
    flow: ['노동 → 민권', '환경 → 반전 평화', '여성(완주)', '오더 본체 반박'],
    rules: [
      { k: 'core5', n: '단말기마다 여는 방법이 달라요', d: '단결 · 비폭력 행진 · 협약 · 연대 · 완주. 방법은 위쪽 「지금 할 일」이 알려 줘요' },
      { k: 'pad', n: '정리표 퀴즈', d: '단말기마다 퀴즈가 달라요: 지나가는 카드를 「파동」 버튼으로 고르기 · 빈칸 채우기 · 사진 조각 맞추기' },
      { k: 'charter', n: '수업 정리표 → 헌장 문', d: '카드를 꽂을 때마다 정리표가 한 줄씩 채워지고, 다섯 줄이 차면 헌장 문이 열려요' }
    ]
  };
  const wall = (id, x, y, w, h, gens, o) => L.walls.push(Object.assign({ id, x, y, w, h, gens, active: true, fade: 1 }, o || {}));
  const gen = (id, x, y, hp, o) => L.gens.push(Object.assign({ id, x, y, r: 32, hp: hp || 140, maxHp: hp || 140, alive: true, hitT: 0 }, o || {}));
  // 원칙 단말기: n조, 끄는 문제(mech), 꽂히는 제도 카드, 여는 방법(method), 동료가 되는 사람(ally 모습, join 대사), 꺼질 때 한 줄(offText). 쏴서는 안 열린다
  const sock = (id, x, y, n, mech, card, method, o) => gen(id, x, y, 1, Object.assign({ socket: n, mech, card, method, name: '제' + n + '조 단말기', r: 34, noShoot: true, charge: 0 }, o));
  // A: 세로 분리선(지구 출신은 오른쪽 좁은 길, 느리고 대시 금지). A-1은 벨트(노동), A-2는 행진 길(민권)
  wall('div', DX, 4616, 16, 2184, ['k1'], { quiet: true });
  sock('k3', 1270, 5740, 3, 'belt', 'ilo', 'unity', { ally: 2, join: '퇴근! 같이 가요!', offText: '벨트가 멈췄어요' });
  wall('a1', EX0, 5600, EX1 - EX0, 16, ['k3'], { quiet: true });
  sock('k1', 1270, 4720, 1, 'lane', 'civil1964', 'march', { ally: 3, join: '이제 같은 길이야!', offText: '분리선이 꺼졌어요. 대시도 쓸 수 있어요' });
  wall('wC', 70, 4600, 1460, 16, ['k1'], { quiet: true });
  // B: 모래폭풍 속 밸브 4개(환경), 발사대 아래 원(반전 평화)
  const valve = (id, x, y, dome) => gen(id, x, y, 150, { valve: true, dome, name: dome + ' 밸브' });
  valve('v1', 300, 4380, '알파 돔'); valve('v2', 1300, 4200, '베타 돔'); valve('v3', 330, 3820, '감마 돔'); valve('v4', 1270, 3660, '델타 돔');
  sock('k5', 800, 3540, 5, 'storm', 'paris', 'pact', { ally: 0, join: '물과 공기는 함께 지켜요!', offText: '모래폭풍이 걷혔어요' });
  wall('b1', 130, 3400, 1340, 16, ['v1', 'v2', 'v3', 'v4', 'k5'], { quiet: true });
  sock('k4', 800, 2720, 4, 'arms', 'npt', 'hold', { ally: 4, join: '무기 말고 평화!', offText: '발사대가 내려갔어요. 하지만 잔여 신호는 아직 깜박여요', holdR: 118 });
  wall('wB', 130, 2200, 1340, 16, ['k4'], { quiet: true });
  // C: 차단막 사이로 단말기까지 달리기(여성). 늦으면 출발선부터
  L.barGaps = [];
  [[1880, 400], [1620, 1150], [1360, 600], [1110, 1050]].forEach((b, i) => {
    const [y, gx] = b, gw = 190;
    wall('c' + i + 'l', 70, y, gx - gw / 2 - 70, 18, ['k2'], { barrier: true, soft: true });
    wall('c' + i + 'r', gx + gw / 2, y, 1530 - gx - gw / 2, 18, ['k2'], { barrier: true, soft: true });
    L.barGaps.push({ x: gx, y: y + 9, w: gw, wall: 'c' + i + 'l' });
  });
  sock('k2', 1200, 960, 2, 'bar', 'women', 'run', { ally: 1, join: '같이 달리자!', offText: '출전 금지 차단막이 열렸어요' });
  wall('wA', 0, 796, 1600, 16, ['k2']);
  wall('gate', 560, 712, 480, 16, [], { active: false, fade: 0, gate: true });
  // 헌장 문: 다섯 단말기가 모두 켜지면 열린다(이때 모든 제한이 풀린다)
  wall('charter', 560, 744, 480, 16, ['k1', 'k2', 'k3', 'k4', 'k5'], { charter: true, soft: true, divider: true });
  L.zones = [
    { y0: 5616, y1: 6800, exit: 'a1', check: { x: 1270, y: 6720 }, label: 'A 구역 · 노동 라인', tag: 'A-1', xr: [EX0 + 40, EX1 - 40],
      pool: ['drone', 'chaser'], max: 4, every: 3.4,
      initial: [['drone', 1150, 6300], ['chaser', 1420, 6000], ['drone', 1200, 5700]] },
    { y0: 4616, y1: 5600, exit: 'wC', check: { x: 1270, y: 5540 }, label: 'A 구역 · 행진 길', tag: 'A-2', xr: [EX0 + 40, EX1 - 40],
      pool: ['drone', 'drone', 'chaser'], max: 3, every: 4.2,
      initial: [['turret', 1060, 5280], ['turret', 1490, 4980], ['drone', 1300, 5150]] },
    { y0: 3416, y1: 4600, exit: 'b1', check: { x: 800, y: 4540 }, label: 'B 구역 · 마른 저수지', tag: 'B-1',
      pool: ['drone', 'chaser', 'drone'], max: 6, every: 3.0,
      initial: [['drone', 600, 4300], ['chaser', 1000, 4100], ['guard', 420, 3700], ['drone', 1100, 3800], ['turret', 800, 4000]] },
    { y0: 2216, y1: 3400, exit: 'wB', check: { x: 800, y: 3340 }, label: 'B 구역 · 발사대 광장', tag: 'B-2',
      pool: ['drone', 'chaser', 'guard'], max: 6, every: 2.8,
      initial: [['drone', 500, 3100], ['chaser', 1100, 3000], ['guard', 600, 2500], ['drone', 1000, 2450]] },
    { y0: 812, y1: 2200, exit: 'wA', check: { x: 800, y: 2120 }, label: 'C 구역 · 완주 코스', tag: 'C',
      pool: ['ejector', 'drone', 'chaser'], max: 5, every: 3.0,
      initial: [['turret', 230, 1250], ['turret', 1370, 1500], ['drone', 500, 1750], ['ejector', 1000, 1450], ['chaser', 700, 1000]] }
  ];
  L.chips = [];
  // A-1 벨트: 노동 단말기에 카드를 꽂을 때까지 움직인다. 끝에는 압착기, 가운데 섬에 일하는 사람
  L.belts = [ { x: EX0, y: 6420, w: EX1 - EX0, h: 130, dx: -1, dy: 0, speed: 115 },
              { x: EX0, y: 6120, w: EX1 - EX0, h: 130, dx: 1, dy: 0, speed: 115 },
              { x: EX0, y: 5840, w: EX1 - EX0, h: 130, dx: -1, dy: 0, speed: 115 } ];
  L.islands = [ { x: 1300, y: 6430, w: 150, h: 110 }, { x: 1110, y: 6130, w: 150, h: 110 }, { x: 1300, y: 5850, w: 150, h: 110 } ];
  L.presses = [ { x: EX0, y: 6420, w: 84, h: 130 }, { x: EX1 - 84, y: 6120, w: 84, h: 130 }, { x: EX0, y: 5840, w: 84, h: 130 } ];
  L.rests = [];
  L.caps = L.islands.map((is, i) => ({ x: is.x + is.w / 2, y: is.y + is.h / 2 + 4, look: LOOKS[[1, 3, 0][i]], freed: false, t: Math.random() * 5, kind: 'worker', mod: 'labor', stay: '단결!' }));
  // 발사대: 잔여 신호(빨간 불)가 다시 켰다. 공격이 통하지 않고 제4조(NPT)를 꽂으면 내려간다
  const lau = (side, y, o) => Object.assign({ side, x: side === 'a' ? 172 : 1428, y, folded: false, foldK: 0, t: Math.random() * 5, fireT: rand(1.5, 4.5) }, o || {});
  L.launchers = [ lau('a', 4420), lau('b', 4000), lau('a', 3700), lau('b', 3200), lau('a', 2950), lau('b', 2650), lau('a', 2450), lau('b', 2300, { resid: true }) ];
  [[1150, 5300], [1400, 5000], [560, 4150], [1040, 3880], [560, 2900], [1040, 2950], [380, 1500], [1220, 1260]]
    .forEach(c => L.solids.push({ x: c[0] - 28, y: c[1] - 28, w: 56, h: 56, crate: true }));
  L.solids.push({ x: 0, y: 4600, w: 70, h: 2200, space: true }, { x: 1530, y: 4600, w: 70, h: 2200, space: true },
                { x: 0, y: 2200, w: 130, h: 2400, fwall: true }, { x: 1470, y: 2200, w: 130, h: 2400, fwall: true },
                { x: 0, y: 800, w: 70, h: 1400, cliff: true }, { x: 1530, y: 800, w: 70, h: 1400, cliff: true });
  L.pads = [ { x: 1236, y: 4616, w: 68, h: 980 }, { x: 110, y: 6560, w: 860, h: 200 }, { x: 360, y: 4616, w: 160, h: 1944 },
             { x: 130, y: 2216, w: 1340, h: 1168 },
             { x: 200, y: 862, w: 1200, h: 150 } ];
  L.domes = [ { x: 190, y: 4820, r: 58 }, { x: 860, y: 6560, r: 62 }, { x: 200, y: 5600, r: 56 } ];
  const sl = (stageById(6).slogans || []);
  L.boards = [ { x: 560, y: 6790, text: sl[0] }, { x: 1180, y: 4586, text: sl[1] }, { x: 430, y: 2186, text: sl[2] } ].filter(b => b.text);
  L.laneSigns = [ { x: 560, y: 6440, side: 'left' }, { x: 1272, y: 6640, side: 'right' } ];
  // 1~5스테이지에서 함께한 사람들이 출발 지점에 모였다
  L.signs = [ { x: 1272, y: 6770, text: '모든 돔 함께' } ];
  L.crowd = [ [1100, 6760, 1, 0, '사람이 먼저'], [1450, 6760, 4, Math.PI, '함께 바꿔요'] ]
    .map(c => ({ x: c[0], y: c[1], look: LOOKS[c[2]], aim: c[3], ph: Math.random() * 5, sign: c[4] }));
  L.props = [ { kind: 'antenna', x: 1480, y: 6560 }, { kind: 'plant', x: 160, y: 6700 }, { kind: 'plant', x: 700, y: 6720 }, { kind: 'solar', x: 760, y: 5300 }, { kind: 'solar', x: 760, y: 4900 },
              { kind: 'clock', x: 1460, y: 5700 }, { kind: 'tank', x: 1420, y: 2280 },
              { kind: 'solar', x: 470, y: 1470 }, { kind: 'antenna', x: 1250, y: 1760 } ];
  // 사람들: A의 화성 태생 주민(자유롭게 다님), B-1의 돔 주민(밸브를 잠그면 동료)
  const cough = ['콜록… 앞이 안 보여요!', '물을 돌려줘요!', '우리 돔 밸브도 잠가 줘요!'];
  L.npcs = [ [300, 6700, 3], [700, 5350, 0], [250, 5000, 2] ].map(n => ({ x: n[0], y: n[1], tx: n[0], ty: n[1], look: LOOKS[n[2]], t: Math.random() * 5, wait: Math.random() * 2, moving: false }))
    .concat([ [400, 4440, 1], [1200, 4260, 3], [430, 3880, 4], [1170, 3720, 2] ]
      .map(n => ({ x: n[0], y: n[1], tx: n[0], ty: n[1], look: LOOKS[n[2]], t: Math.random() * 5, wait: 0, moving: false, post: true, mech: 'storm', say: cough,
                   nb: { x0: n[0] - 140, x1: n[0] + 140, y0: n[1] - 60, y1: n[1] + 60 } })));
  L.rocks = [];
  let seed = 41; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 320 && L.rocks.length < 60; i++) {
    const x = 90 + rnd() * 1420, y = 830 + rnd() * 5940;
    if (y > 2190 && y < 3390) continue;
    if (L.pads.some(p => x > p.x - 30 && x < p.x + p.w + 30 && y > p.y - 30 && y < p.y + p.h + 30)) continue;
    if (L.belts.some(b => x > b.x - 20 && x < b.x + b.w + 20 && y > b.y - 30 && y < b.y + b.h + 30)) continue;
    if (L.domes.some(d => dist(x, y, d.x, d.y) < d.r + 50) || L.solids.some(s => !s.space && !s.cliff && !s.fwall && x > s.x - 40 && x < s.x + s.w + 40 && y > s.y - 40 && y < s.y + s.h + 40)) continue;
    if (L.gens.some(g => dist(x, y, g.x, g.y) < 110) || L.walls.some(w => Math.abs(y - w.y) < 44) || Math.abs(x - 1008) < 40) continue;
    if (x > L.runStart.x - 30 && x < L.runStart.x + L.runStart.w + 30 && y > L.runStart.y - 30) continue;
    L.rocks.push({ x, y, kind: rnd() < 0.35 ? 'crater' : 'rock', s: 0.6 + rnd() * 0.9, a: rnd() * TAU });
  }
  return L;
}
const LAYOUTS = { 1: layoutStage1, 2: layoutStage2, 3: layoutStage3, 4: layoutStage4, 5: layoutStage5, 6: layoutStage6 };

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
      { title: '먼저 움직여 보세요', sub: () => '왼쪽 화면을 손가락으로 끌면 움직여요 (키보드: WASD·방향키)', done: c => c.moved > 160 },
      { title: '공명 파동을 써 보세요', sub: () => "오른쪽 아래 '파동' 버튼: 둘레의 주황 탄을 지우고 드론을 밀어내요 (키보드: E)",
        done: () => G.skillUsed, skipAfter: 15 },
      { title: '드론에게 다가가 보세요', sub: () => '하얀 공 모양 드론이 오더의 기계예요. 공격은 자동! 가까이 가면 알아서 쏴요', done: () => G.stats.kills >= 1,
        target: () => nearestOf(G.enemies.filter(e => !e.dead)), skipAfter: 15 },
      { title: '발생기를 부수세요', sub: () => '노란 화살표를 따라가요. 발생기 옆에 있으면 자동으로 공격해요', done: () => gensC().length < 2, target: () => nearestOf(gensC()) },
      { title: '남은 발생기도 부수세요', sub: () => '발생기를 모두 부수면 위쪽 레이저 벽이 꺼져요', done: () => !wC().active, target: () => nearestOf(gensC()) },
      { title: '레이저 벽이 꺼졌어요!', sub: () => '위쪽으로 나아가 다음 구역으로 가세요', done: () => G.zoneIdx !== 0, target: () => ({ x: G.P.x, y: 2700 }) }
    ];
  },
  2: () => {
    const wC = () => wallById('wC');
    const gensC = () => G.gens.filter(g => g.alive && wC().gens.includes(g.id));
    return [
      { title: '출발 게이트로 가 보세요 ▲', sub: () => '', done: () => G.denyAt > 0 || gensC().length < 2, target: () => ({ x: 800, y: 6240 }), skipAfter: 16 },
      { title: '나만 막혀요! 게이트 발생기를 부수세요', sub: () => '', done: () => gensC().length < 2, target: () => nearestOf(gensC()) },
      { title: '남은 게이트 발생기도 부수세요', sub: () => '', done: () => !wC().active, target: () => nearestOf(gensC()) },
      { title: '게이트가 열렸어요! 코스로 뛰어드세요 ▲', sub: () => '', done: () => G.zoneIdx !== 0, target: () => ({ x: G.P.x, y: 6100 }) }
    ];
  },
  3: () => {
    const wC = () => wallById('wC');
    const gensC = () => G.gens.filter(g => g.alive && wC().gens.includes(g.id));
    return [
      { title: '벨트를 거슬러, 일하는 정착민에게 가세요', sub: () => '', done: () => G.stats.rescued >= 1, target: () => nearestOf(G.caps.filter(c => !c.freed && c.y > 3212)), skipAfter: 30 },
      { title: '문 발생기를 부수세요', sub: () => '', done: () => gensC().length < 2, target: () => nearestOf(gensC()) },
      { title: '남은 발생기도 부수세요', sub: () => '', done: () => !wC().active, target: () => nearestOf(gensC()) },
      { title: '문이 열렸어요! 위로 나아가세요 ▲', sub: () => '', done: () => G.zoneIdx !== 0, target: () => ({ x: G.P.x, y: 3100 }) }
    ];
  },
  4: () => {
    const t1 = () => G.gens.find(g => g.id === 't1');
    const nearLauncher = () => nearestOf((G.L.launchers || []).filter(l => !l.folded && l.tower === 't1'));
    return [
      { title: '미사일 발사대를 쏴 보세요', sub: () => '', done: () => (G.armsHits || 0) >= 3, target: () => { const l = nearLauncher(); return l && { x: l.x + (l.side === 'a' ? 200 : -200), y: l.y }; }, skipAfter: 14 },
      { title: '쏴도 안 돼요! 연대 송신탑 원 안에서 버티세요', sub: () => '', done: () => !t1().alive, target: () => t1() },
      { title: '방어선이 열렸어요! 위로 나아가세요 ▲', sub: () => '', done: () => G.zoneIdx !== 0, target: () => ({ x: G.P.x, y: 3900 }) }
    ];
  },
  5: () => {
    const v0 = () => G.gens.find(g => g.id === 'v0');
    return [
      { title: '모래폭풍 속에서 알파 돔 밸브를 찾아 잠그세요', sub: () => '', done: () => !v0().alive, target: () => v0() },
      { title: '우리 돔만으로는 폭풍이 안 멈춰요! 위로 ▲', sub: () => '', done: () => G.zoneIdx !== 0, target: () => ({ x: G.P.x, y: 4400 }) }
    ];
  }
};
function updateCoach(dt) {
  const c = G.coach; if (!c || workOn()) return;
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

function newRun(stageId, opts) {
  const def = stageById(stageId);
  const L = LAYOUTS[stageId]();
  const up = Object.assign({}, save.upgrades);
  const st = computeStats(up);
  const skills = ['pulse'];
  G = {
    def, L, up, st, level: save.level, xp: save.xp, pendingLv: 0,
    P: { x: L.start.x, y: L.start.y, r: 17, hp: st.maxHp, aim: -Math.PI / 2, t: 0, moving: false, fireT: 0.4, glow: 0,
         dashT: 0, dashCd: 0, dashDir: { x: 0, y: -1 }, last: { x: 0, y: -1 }, inv: 1, kx: 0, ky: 0, dead: false, deadT: 0 },
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
  G.mode = def.intro && def.intro.length && !(opts && opts.skipIntro) ? 'intro' : 'brief';
  G.cutI = 0; G.cutT = 0; G.cutFull = false;
  G.briefT = 0; G.tip = null; G.tipsSeen = {};
  G.work = L.work ? { n: 0, carry: false, done: false } : null; G.shiftH = 0; G.nightA = 0; G.bellK = 3;
  G.shells = []; G.residualOrb = null; G.armsHits = 0;
  G.arms = L.armsRace ? { a: L.armsRace.start, b: L.armsRace.start } : null; G.armsT = L.armsRace ? L.armsRace.every : 0; G.armsFlash = { a: 0, b: 0 }; G.armsFollow = null;
  G.domes = 0; G.water = L.water0 || 0; G.lakeFill = 0; G.off = {}; G.sockets = 0; G.cardFly = null; G.quiz = null; G.chainCard = null; G.core = { run: { phase: 'idle', t: 0 }, marchers: null };
  G.storm = L.storm ? { k: L.storm.zone == null ? 1 : 0, r: L.storm.r0 } : null;
  G.gust = L.storm ? { phase: 'wait', t: 6, dir: 1 } : null;
  G.restricted = !!L.restrict; G.npcs = L.npcs || []; G.freeT = -99;
  G.race = L.race ? { on: false, done: false, camY: 0, grace: 0, v: L.race.v } : null;
  G.runners = (L.runners || []).map(r => Object.assign({ t: Math.random() * 5, moving: false, boostT: 0 }, r));
  G.coach = LAYOUTS_COACH[stageId] && !save.cleared[stageId] ? { step: 0, moved: 0, st: 0, flash: 1, steps: LAYOUTS_COACH[stageId]() } : null;
  return G;
}

function StageScene(stageId, opts) {
  newRun(stageId, opts);
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
  for (const w of G.walls) {
    if (!w.active || (w.barrier && !isPlayer)) continue;
    if (!pushOutRect(o, w.x, w.y, w.w, w.h)) continue;
    if (!w.soft) touchedLaser = true;
    if (isPlayer && (w.barrier || w.denyText)) { G.denyAt = G.t; G.denyMsg = w.denyText || '출전 금지 · 지구 출신'; }
  }
  for (const g of G.gens) if (g.alive) pushOutCircle(o, g.x, g.y, g.r);
  for (const l of G.L.launchers || []) pushOutCircle(o, l.x, l.y, 30);
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
    if (!w.active || w.barrier) continue;
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
// 문제가 켜져 있는가: 보통은 G.restricted 하나로 다 같이 꺼지고, 종장은 단말기에 카드를 꽂은 문제만 따로 꺼진다(G.off)
const mech = k => !!(G.restricted && !(G.off && G.off[k]));

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
  } else if (e.type === 'chaser' || e.type === 'ejector') {
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
  if (!P.dead && dist(e.x, e.y, P.x, P.y) < e.r + P.r) {
    if (e.type === 'ejector') {
      // 퇴장 드론: 닿으면 뒤(아래)로 밀어내고 사라진다. 대시·무적 중에는 통하지 않는다
      if (P.inv > 0 || P.dashT > 0 || G.god) return;
      const hp0 = P.hp; hurtPlayer(e.touch, e.x, e.y);
      if (P.hp < hp0 && !P.dead) { P.kx = 0; P.ky = 900; addText(P.x, P.y - 64, '퇴장!', C.bad, 22); }
      e.dead = true; burst(e.x, e.y, C.mustard, 12, 220);
    } else hurtPlayer(e.touch, e.x, e.y);
  }
}

/* ----- 플레이어 ----- */
const allyAtk = () => skillFx('allyAtk', 0.1);          // 동료 1명마다 늘어나는 공격력
const guardEvery = () => skillFx('guard', 10);         // 동료가 대신 막아 주는 간격(초)
const allyPct = n => Math.round(n * allyAtk() * 100);
const allyBonus = () => 1 + allyAtk() * G.settlers.length;
function hurtPlayer(dmg, sx, sy, force) {
  const P = G.P;
  if (P.dead || G.god) return;
  if (!force && (P.inv > 0 || P.dashT > 0)) return;
  // 연대: 동료가 10초에 한 번씩 대신 막아 준다
  if (!force) {
    const g = G.settlers.find(s => !(s.guardAt > G.t));
    if (g) { g.guardAt = G.t + guardEvery(); P.inv = 0.7; addText(g.x, g.y - 50, '막아 줌!', C.tealL, 21); burst(P.x, P.y - 6, C.tealL, 12, 180); Sound.play('ui'); return; }
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
  if (G.fatigue > 0.5) G.fatigue = 0.5;
  if (G.race && G.race.on) { G.race.camY = clamp(P.y - H * 0.62, G.L.race.minCam, G.L.h - H); G.race.grace = 1.5; }
  G.eB = []; G.mode = 'play';
  if (save.difficulty !== 'easy' && G.lives === 1) banner('마지막 목숨!', '또 쓰러지면 스테이지를 처음부터 해야 해요', C.bad, 4);
  else banner(save.difficulty === 'easy' ? '다시 일어났어요!' : '다시 도전!', save.difficulty === 'easy' ? '' : '남은 목숨 ' + G.lives, C.tealL, 1.6);
}
function findTarget(x, y, range) {
  let best = null, bd = range;
  for (const e of G.enemies) { if (e.dead || e.spawnT > 0) continue; const d = dist(x, y, e.x, e.y) - e.r; if (d < bd && !segBlocked(x, y, e.x, e.y)) { bd = d; best = e; } }
  for (const g of G.gens) { if (!g.alive || genShielded(g) || g.tower || g.noShoot) continue; const d = dist(x, y, g.x, g.y) - g.r; if (d < bd && !segBlocked(x, y, g.x, g.y)) { bd = d; best = g; } }
  const b = G.boss;
  if (b && !b.dead && b.dying <= 0) { const d = dist(x, y, b.x, b.y) - 70; if (d < bd) { best = b; } }
  if (!best) for (const l of G.L.launchers || []) { if (l.folded) continue; const d = dist(x, y, l.x, l.y) - 30; if (d < Math.min(range, 250) && d < bd) { bd = d; best = l; } }
  return best;
}
function fireWave(x, y, a, dmg, n, kind, range) {
  const spd = 640;
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * 0.16;
    G.pB.push({ x, y, vx: Math.cos(a + off) * spd, vy: Math.sin(a + off) * spd, a: a + off, r: kind === 'p' ? 10 : 7, dmg, life: (range || G.st.range) / spd + 0.05, kind });
  }
}
// 기술을 다시 쓰는 시간: 공명 파동은 「협약」을 얻으면 짧아진다
const skillCdOf = id => id === 'pulse' ? skillFx('pulseCd', SKILLS.pulse.cd) : SKILLS[id].cd;
function useSkill() {
  const id = G.skills[G.skillIdx];
  if (G.skillCd > 0) return;
  const P = G.P;
  G.skillCd = skillCdOf(id); G.skillUsed = true;
  if (id === 'pulse') { G.pulses.push({ x: P.x, y: P.y, r: 10, max: 260, hit: new Set() }); G.shake = Math.max(G.shake, 5); }
  Sound.play('skill');
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
// 배제 모듈: 내려오는 차단막(bars), 출전 구역 제한(area)
// 24/7 시계탑: 시곗바늘 레이저(hand), 벨트 바닥(floor)
// 군비 모듈: 양쪽에서 날아오는 교차 사격(cross), 떨어지는 미사일 경고 원(barrage)
const BOSS_POOLS4 = [['barrage', 'spread'], ['cross', 'barrage', 'ring'], ['cross', 'barrage', 'spread', 'ring'], ['barrage', 'cross', 'ring', 'spread']];
const BOSS_POOLS3 = [['hand', 'spread'], ['hand', 'ring', 'floor'], ['floor', 'hand', 'spread', 'ring'], ['hand', 'floor', 'ring', 'spread']];
const BOSS_POOLS2 = [['bars', 'spread'], ['bars', 'ring', 'area'], ['area', 'bars', 'spread', 'ring'], ['bars', 'area', 'ring', 'spread']];
// 자원 모듈: 끌어당기는 배수구 소용돌이(drain), 옆으로 미는 돌풍과 모래 탄(gust), 잠깐 앞이 안 보이는 모래폭풍(storm)
const BOSS_POOLS5 = [['drain', 'spread'], ['gust', 'drain', 'ring'], ['storm', 'drain', 'gust', 'spread'], ['drain', 'gust', 'storm', 'ring', 'spread']];
// 오더 본체: 라운드마다 앞 보스의 공격(분리 → 배제 → 군비 → 자원), 마지막 라운드는 시계탑까지 다섯 공격 총공세
const BOSS_POOLS6 = [['split', 'sweep', 'spread'], ['bars', 'area', 'ring'], ['cross', 'barrage', 'spread'], ['drain', 'gust', 'storm', 'ring'], ['hand', 'floor', 'split', 'bars', 'cross', 'drain', 'gust']];
// 오더 본체 둘레의 문양: 라운드 순서대로 하나씩 꺼진다
const EMBLEMS6 = ['lane', 'bar', 'arms', 'storm', 'belt'];
function startBoss() {
  const gate = G.walls.find(w => w.gate); gate.active = true; gate.fade = 1;
  G.arenaLock = true; G.checkpoint = { x: 800, y: 620 }; G.cam.x = G.L.arena.x; G.cam.y = G.L.arena.y;
  G.enemies.forEach(e => { if (!e.dead) { e.dead = true; burst(e.x, e.y, C.amber, 6, 150); } });
  G.eB = [];
  const hp = (G.L.bossHp || 4000) * G.hpMul;
  G.boss = { def: G.def.boss, x: 800, y: 290, hp, maxHp: hp, round: 0, shield: true, stun: 0, t: 0, pat: null, patT: 2.2,
             orbs: [], orbT: 1.6, orbsUp: false, dying: 0, dead: false, flash: 0, lasers: [], breakT: 0 };
  G.shells = []; if (G.L.bossPods) G.boss.pods = G.L.bossPods;
  if (G.L.bossPipes) G.boss.pipes = G.L.bossPipes;
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
    if (b.round >= b.def.rounds.length - 1) { b.hp = 0; b.dying = 2.6; b.lasers = []; b.pat = null; b.orbs = []; G.eB = []; G.shake = 16; Sound.play('shield'); return; }
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
function endRebutCard() {
  if (G.mode !== 'rebut' || G.rebutT < 1) return;
  G.mode = 'play'; G.P.inv = Math.max(G.P.inv, 1);
}
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
    if (G.L.bossPods) { b.pods = Math.max(0, b.pods - 1); addText(b.x, b.y - 170, '미사일 포대 하나가 접혔어요', C.tealL, 22); }
    if (G.L.bossPipes) { b.pipes = Math.max(0, b.pipes - 1); addText(b.x, b.y - 170, '파이프 하나가 닫혔어요 · 물이 돌아와요', C.tealL, 22); }
    if (G.L.finalBoss) addText(b.x, b.y - 190, '오더의 문양 하나가 꺼졌어요 (' + (b.round + 1) + '/' + b.def.rounds.length + ')', C.tealL, 22);
    G.rebut = { opt: o, claim: b.def.rounds[b.round].claim }; G.rebutT = 0; G.mode = 'rebut'; ui.focus = 0;
    Sound.play('shield');
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
    if (G.L.residual && !G.residualOrb) { G.residualOrb = { x: b.x, y: b.y - 60, t: 0 }; G.shells = []; banner('군비 모듈 정지…', '하지만 무기가 모두 사라진 것은 아니에요. 잔여 신호 하나가 빠져나갔어요', C.bad, 3.2); }
    if (G.L.finalBoss && !b.saidErr) { b.saidErr = true; G.shells = []; banner('오더 본체가 멈췄어요…', '부서지지 않았어요. 오더가 무언가를 말하려 해요', C.tealL, 2.8); }
    if (Math.random() < dt * (G.L.residual || G.L.finalBoss ? 6 : 14)) burst(b.x + rand(-90, 90), b.y + rand(-110, 90), pick([C.amber, C.cream, C.tealL]), 10, 260);
    G.shake = Math.max(G.shake, 4);
    if (b.dying <= 0) { if (G.L.finalBoss) { stageClear(); return; } b.dead = true; burst(b.x, b.y, C.mustard, 60, 420); stageClear(); }
    return;
  }
  const mul = 1 + 0.12 * b.round;
  b.x = G.L.bossStill ? 800 : 800 + Math.sin(b.t * 0.45) * 300;
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
    if (b.patT <= 0) b.pat = { kind: pick((G.L.bossPools || BOSS_POOLS)[b.round]), t: 0, n: 0, gap: rand(a.x + 170, a.x + a.w - 170) };
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
    } else if (p.kind === 'bars') {
      // 차단막 여러 개가 차례로 내려온다. 틈이 서로 다른 곳에 있다
      if (!p.bars) { const n = b.round >= 2 ? 3 : 2; p.bars = []; let gx = p.gap; for (let i = 0; i < n; i++) { p.bars.push(gx); let nx; do { nx = rand(a.x + 170, a.x + a.w - 170); } while (Math.abs(nx - gx) < 260); gx = nx; } }
      b.lasers = []; let alive = false;
      p.bars.forEach((gx, i) => {
        const lt = p.t - i * 1.0; if (lt < 0) { alive = true; return; }
        const warn = lt < 0.8, sy = warn ? 440 : 440 + (lt - 0.8) / 2.5 * (a.h - 440);
        if (sy > a.h) return;
        alive = true; b.lasers.push({ kind: 'h', y: sy, gap: gx, warn, bar: true });
        if (!warn && !P.dead && Math.abs(P.y - sy) < 10 + P.r * 0.7 && Math.abs(P.x - gx) > 95) hurtPlayer(15, P.x, sy - 20);
      });
      if (!alive) cool();
    } else if (p.kind === 'area') {
      // 출전 구역 제한: 초록 안전 구역 밖은 잠시 뒤 막힌다
      const hw = b.round >= 2 ? 130 : 155, sx = clamp(p.gap, a.x + hw + 30, a.x + a.w - hw - 30), warn = p.t < 1.2;
      b.lasers = [{ kind: 'area', x0: sx - hw, x1: sx + hw, warn }];
      if (!warn && !P.dead && P.y > 430 && (P.x < sx - hw || P.x > sx + hw)) hurtPlayer(15, P.x < sx ? P.x - 30 : P.x + 30, P.y);
      if (p.t > 2.7) cool();
    } else if (p.kind === 'cross') {
      // 양쪽 끝에서 탄 줄이 번갈아 날아온다. 비어 있는 두 줄 사이로 피한다
      const waves = b.round >= 2 ? 4 : 3;
      if (p.n < waves && p.t >= p.n * 0.85) {
        const fromLeft = p.n % 2 === 0, gapAt = Math.floor(rand(0, 5));
        for (let r = 0; r < 6; r++) { if (r === gapAt || r === gapAt + 1) continue; enemyShot(fromLeft ? a.x + 12 : a.x + a.w - 12, 452 + r * 44, fromLeft ? 0 : Math.PI, 250 * mul, 9); }
        p.n++;
      }
      if (p.t > waves * 0.85 + 2.4) cool();
    } else if (p.kind === 'barrage') {
      // 남은 포대 수만큼 미사일이 떨어진다(경고 원 밖으로)
      const per = 2 + (b.pods || 0);
      if (p.n < 3 && p.t >= p.n * 0.95) {
        for (let k = 0; k < per; k++) G.shells.push({ x: clamp(P.x + (k ? rand(-230, 230) : 0), a.x + 70, a.x + a.w - 70), y: clamp(P.y + (k ? rand(-120, 120) : 0), 430, a.h - 40), t: -k * 0.12, warn: 1.15, r: 66 });
        p.n++;
      }
      if (p.t > 3 * 0.95 + 1.7) cool();
    } else if (p.kind === 'hand') {
      // 시곗바늘 레이저가 경기장을 쓸고 지나간다. 앞서 달리거나 대시로 넘는다
      if (p.dir == null) p.dir = Math.random() < 0.5 ? 1 : -1;
      const two = b.round >= 2, T = two ? 5.2 : 4.4, warn = p.t < 1.1;
      const k = clamp((p.t - 1.1) / T, 0, 1), a0 = 0.16, a1 = Math.PI - 0.16;
      const ang = p.dir > 0 ? lerp(a0, a1, k) : lerp(a1, a0, k);
      b.lasers = [{ kind: 'hand', a: ang, len: 800, warn, dir: p.dir }];
      if (two) b.lasers.push({ kind: 'hand', a: Math.PI - ang, len: 800, warn, dir: -p.dir });
      if (!warn && !P.dead) for (const l of b.lasers) {
        const ox = b.x, oy = b.y + 40;
        if (distToSeg(P.x, P.y - 4, ox, oy, ox + Math.cos(l.a) * l.len, oy + Math.sin(l.a) * l.len) < 12 + P.r * 0.7) { hurtPlayer(15, P.x - Math.sin(l.a) * l.dir * 30, P.y + Math.cos(l.a) * l.dir * 30); break; }
      }
      if (p.t > 1.1 + T + 0.15) cool();
    } else if (p.kind === 'floor') {
      // 바닥이 벨트처럼 한쪽으로 밀어낸다. 그 끝에는 압착기
      if (p.dir == null) p.dir = Math.random() < 0.5 ? 1 : -1;
      const warn = p.t < 1.0, edge = p.dir > 0 ? a.x + a.w - 140 : a.x + 140;
      b.lasers = [{ kind: 'floor', dir: p.dir, warn, edge }];
      if (p.n < 2 && p.t >= 1.7 + p.n * 1.1) { const aa = Math.atan2(P.y - b.y, P.x - b.x); for (let k2 = -2; k2 <= 2; k2++) enemyShot(b.x, b.y + 40, aa + k2 * 0.24, 200 * mul); p.n++; }
      if (!warn && !P.dead && P.y > 430 && (p.dir > 0 ? P.x > edge : P.x < edge)) hurtPlayer(12, p.dir > 0 ? a.x + a.w : a.x, P.y);
      if (p.t > 4.2) cool();
    } else if (p.kind === 'drain') {
      // 배수구 소용돌이: 하나는 내 발밑에 생긴다. 가까이 있으면 끌려가고, 가운데에 닿으면 아프다
      if (!p.v) {
        const n = b.round >= 2 ? 3 : 2; p.v = [{ x: clamp(P.x, a.x + 120, a.x + a.w - 120), y: clamp(P.y, 470, a.h - 70), r: 92 }];
        for (let i = 1, tries = 0; i < n && tries < 60; tries++) { const x = rand(a.x + 140, a.x + a.w - 140), y = rand(480, a.h - 80); if (p.v.every(v => dist(v.x, v.y, x, y) > 280)) { p.v.push({ x, y, r: 92 }); i++; } }
      }
      const warn = p.t < 1.1;
      b.lasers = p.v.map(v => ({ kind: 'drain', x: v.x, y: v.y, r: v.r, warn }));
      if (!warn && !P.dead) for (const v of p.v) if (dist(P.x, P.y, v.x, v.y) < 34) { hurtPlayer(12, v.x, v.y); break; }
      if (p.n < 1 && p.t >= 2.2) { const aa = Math.atan2(P.y - b.y, P.x - b.x); for (let k = -2; k <= 2; k++) enemyShot(b.x, b.y + 40, aa + k * 0.24, 200 * mul); p.n++; }
      if (p.t > 1.1 + 2.8) cool();
    } else if (p.kind === 'gust') {
      // 돌풍: 옆으로 밀고, 바람 쪽 끝에서 모래 탄 줄이 날아온다(두 칸이 비어 있다)
      if (p.dir == null) p.dir = Math.random() < 0.5 ? 1 : -1;
      const warn = p.t < 1.0, waves = b.round >= 2 ? 5 : 4;
      b.lasers = [{ kind: 'gust', dir: p.dir, warn }];
      if (!warn && p.n < waves && p.t >= 1.0 + p.n * 0.62) {
        const gapAt = Math.floor(rand(0, 5));
        for (let r = 0; r < 6; r++) { if (r === gapAt || r === gapAt + 1) continue; enemyShot(p.dir > 0 ? a.x + 12 : a.x + a.w - 12, 452 + r * 44, p.dir > 0 ? 0 : Math.PI, 235 * mul, 9); }
        p.n++;
      }
      if (p.t > 1.0 + 2.6 + 0.6) cool();
    } else if (p.kind === 'storm') {
      // 잠깐 모래폭풍: 앞이 좁게 보인다. 증거 구슬과 탄은 모래 너머로도 빛난다
      b.lasers = [{ kind: 'storm', warn: p.t < 1.2 }];
      if (p.n < 2 && p.t >= 1.3 + p.n * 1.6) { const cnt = 14; for (let k = 0; k < cnt; k++) enemyShot(b.x, b.y + 20, k / cnt * TAU + p.n * 0.2, 135 * mul); p.n++; }
      if (p.t > 4.8) cool();
    }
  }
}
function stageClear() {
  G.mode = 'clear'; G.clearT = 0; ui.focus = 0;
  if (G.L.bossChip) { G.bossRecFresh = !save.records[G.L.bossChip]; save.records[G.L.bossChip] = true; G.bossRec = recordById(G.L.bossChip); }
  G.clearStep = G.def.change ? 0 : 1;
  const d = G.def, s = save;
  s.cleared[d.id] = true;
  if (G.L.residual) s.residual = true;
  if (d.card) s.cards[d.card.id] = true;
  if (d.skill && !s.skills.includes(d.skill)) s.skills.push(d.skill);
  if (d.badge && !s.badges.includes(d.badge)) s.badges.push(d.badge);
  s.level = G.level; s.xp = G.xp; s.upgrades = Object.assign({}, G.up);
  s.evidence.right += G.stats.right; s.evidence.wrong += G.stats.wrong;
  const prev = s.stageStats[d.id];
  if (!prev || G.time < prev.time) s.stageStats[d.id] = { time: G.time, right: G.stats.right, wrong: G.stats.wrong };
  writeSave();
  // 종장: 오더는 부서지지 않는다. 원칙을 바꾸는 엔딩으로 간다
  if (G.L.finalBoss) { G.mode = 'ending'; go(() => EndingScene()); }
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
  if (G.mode === 'intro') {
    // 상황 컷: 눌러야 넘어간다. 글자가 다 나오기 전에 누르면 먼저 글자를 다 보여 준다
    G.cutT += dt;
    if (G.cutT * 40 >= richText(G.def.intro[G.cutI].text).plain.length) G.cutFull = true;
    if (hit('Escape')) endCuts();
    else if (G.cutT > 0.3 && (hit('Enter') || hit('Space') || hit('ArrowRight') || taps.length)) { if (G.cutFull) nextCut(); else G.cutFull = true; }
  } else if (G.mode === 'brief') {
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
  else if (G.mode === 'sockClaim') { G.claimT += dt; if (G.claimT > 1.5) menuNav(); }
  else if (G.mode === 'chain') { G.chainT += dt; if (G.chainT > 1) menuNav(); }
  else if (G.mode === 'quizCard') { G.quizT += dt; if (G.quiz && G.quiz.solvedT != null) { if (G.quizT - G.quiz.solvedT > 0.9) finishQuiz(); } else if (G.quizT > 0.4) menuNav(); }
  else if (G.mode === 'down') { G.downT += dt; updateFx(dt); if (G.downT >= reviveSec()) menuNav(); }
  else if (G.mode === 'clear') { G.clearT += dt; updateFx(dt); if (G.clearT > (G.clearStep === 0 ? (G.def.change && G.def.change.mars2 ? 4.2 : 2) : 1.2)) menuNav(); }
  else if (G.mode === 'pause' || G.mode === 'gameover') menuNav();
  touchAct.dash = touchAct.skill = false;
}
const rulesSec = () => (typeof D.rulesReadSeconds === 'number' ? D.rulesReadSeconds : 10);
function openRules() { if (G.mode !== 'brief' || G.briefT < 0.5) return; G.mode = 'rules'; G.rulesT = 0; ui.focus = 0; }
function startPlay() {
  if (G.mode !== 'rules' || G.rulesT < rulesSec()) return;
  G.mode = 'play';
  if (G.coach) G.coach.showAt = G.t;
  const call = G.def.mission && G.def.mission.call;
  banner('STAGE ' + G.def.id + ' · ' + G.def.name, call || '', C.mustard, call ? 3.6 : 2.2);
}
function drawRules() {
  modalStart(); dim(0.8);
  const t = G.rulesT, left = rulesSec() - t;
  panel(40, 22, W - 80, H - 44, { fill: 'rgba(24,21,54,0.98)', r: 24 });
  txt('시작 전에 알아 두기', W / 2, 70, 42, C.mustard, 'center', { weight: 900, stroke: C.ink, sw: 6 });
  const tch = touchUI();
  const items = [
    { k: 'move', n: '이동', d: '왼쪽 화면을 손가락으로 끌어요 (키보드: WASD·방향키)' },
    { k: 'shoot', n: '공격은 자동', d: '가까운 적과 발생기를 알아서 쏴요' },
    { k: 'pulse', n: '공명 파동', d: "'파동' 버튼(키보드 E): 둘레의 주황 탄을 지우고 드론을 밀어내요. 둘레 게이지가 차면 다시 써요" },
    { k: 'dash', n: '대시', d: "'대시' 버튼(키보드 Shift·Space): 짧게 빨리 움직이고, 그동안 탄에 맞지 않아요" }
  ];
  if (G.L.rules) G.L.rules.forEach(r => items.push(r));
  else {
    if (G.L.restrict) items.push({ k: 'earth', n: '나는 지구 출신', d: '처음엔 좁은 구역에서 느리고 대시 금지. 분리선을 끄면 풀려요' });
    items.push({ k: 'gem', n: '청록 조각 = 경험치', d: '드론이 떨어뜨려요. 모으면 레벨 업, 강화를 골라요' });
  }
  if (!G.L.sockets) items.push({ k: 'chip', n: '기록 칩', d: '실제 지구 역사 기록. 모두 모아야 보스 문이 열려요' });
  items.push({ k: 'ally', n: '정착민 = 동료', d: '구하면 같이 쏘고, 1명마다 공격 +' + allyPct(1) + '%, ' + guardEvery() + '초마다 대신 막아 줘요' });
  const own = ownedSkills(), step = own.length ? 108 : 120, ih = own.length ? 98 : 108;
  items.forEach((it, i) => {
    const col = i % 2, row = Math.floor(i / 2), x = 70 + col * 576, y = 106 + row * step, w = 560, h = ih;
    rr(x, y, w, h, 16); ctx.fillStyle = 'rgba(46,40,92,0.95)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,244,220,0.35)'; ctx.stroke();
    ctx.save(); circle(x + 56, y + h / 2, 42); ctx.fillStyle = '#2a2550'; ctx.fill(); ctx.clip(); drawRuleIcon(it.k, x + 56, y + h / 2); ctx.restore();
    // 제목과 설명을 한 묶음으로 칸 안에서 세로 가운데에 둔다(위아래 여백을 같게)
    // 설명이 길면 칸 안에 들어갈 때까지 글자를 줄인다
    let fs = 20, dl = wrap(it.d, w - 128, fs, 600);
    while (fs > 13 && 36 + dl.length * Math.round(fs * 1.25) > h - 10) { fs--; dl = wrap(it.d, w - 128, fs, 600); }
    const lh = Math.round(fs * 1.25), top = y + (h - (36 + dl.length * lh)) / 2;
    txt(it.n, x + 112, top + 15, 26, C.amberL, 'left', { weight: 900 });
    dl.forEach((l, k) => txt(l, x + 112, top + 36 + lh / 2 + k * lh, fs, C.cream, 'left', { weight: 600 }));
  });
  let by = 106 + Math.ceil(items.length / 2) * step + 8;
  if (own.length) {
    rr(70, by - 2, W - 140, 46, 14); ctx.fillStyle = 'rgba(20,60,56,0.92)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = C.tealL; ctx.stroke();
    txt('내가 얻은 기술 (자동 적용)', 90, by + 21, 17, C.tealL, 'left', { weight: 900 });
    // 기술이 많으면 한 줄에 들어가게 글자를 줄인다
    const labels = own.map(id => D.skills[id].name + ': ' + (D.skills[id].short || ''));
    setFont(16, 600); const need = labels.reduce((s, l) => s + ctx.measureText(l).width + 24, 0), fs = Math.max(12, Math.min(16, 16 * (W - 90 - 330) / need));
    setFont(fs, 600); let sx = 330;
    labels.forEach(s => { const tw = ctx.measureText(s).width; txt(s, sx, by + 21, fs, C.cream, 'left', { weight: 600 }); sx += tw + 24 * fs / 16; });
    by += 54;
  }
  if (left > 0) {
    button(W / 2 - 170, by, 340, 64, '게임 시작하기 (' + Math.ceil(left) + ')', null, { size: 28, disabled: true });
    rr(W / 2 - 154, by + 52, 308 * Math.min(1, t / rulesSec()), 6, 3); ctx.fillStyle = C.tealL; ctx.fill();
  } else button(W / 2 - 170, by, 340, 64, '게임 시작하기!', () => startPlay(), { size: 30 });
}
function drawRuleIcon(k, x, y) {
  const t = G.t;
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (k === 'move') {
    ctx.fillStyle = 'rgba(255,244,220,0.14)'; circle(x, y, 30); ctx.fill(); ctx.strokeStyle = 'rgba(255,244,220,0.6)'; ctx.lineWidth = 2.5; ctx.stroke();
    const kx = x + Math.cos(t * 2) * 12, ky = y + Math.sin(t * 2) * 12;
    ctx.fillStyle = C.cream; circle(kx, ky, 12); ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#f6d2b0'; rr(kx - 5, ky - 2, 11, 22, 5); ctx.fill(); ctx.stroke();
  } else if (k === 'shoot') { drawHeroAt(x - 12, y + 14, 0, t, false, 1, { noShadow: true }); ctx.strokeStyle = C.tealL; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x + 22, y - 6, 8, -0.8, 0.8); ctx.stroke(); ctx.beginPath(); ctx.arc(x + 32, y - 6, 8, -0.8, 0.8); ctx.stroke(); }
  else if (k === 'pulse') { ctx.strokeStyle = C.tealL; ctx.lineWidth = 4; circle(x, y, 14 + (t * 20) % 22); ctx.stroke(); ctx.lineWidth = 2; circle(x, y, 32); ctx.stroke(); ctx.fillStyle = C.orange; circle(x + 24, y - 20, 5); ctx.fill(); circle(x - 26, y + 18, 5); ctx.fill(); }
  else if (k === 'dash') { ctx.fillStyle = C.mustard; ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x - 22, y - 14); ctx.lineTo(x + 2, y); ctx.lineTo(x - 22, y + 14); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - 2, y - 14); ctx.lineTo(x + 22, y); ctx.lineTo(x - 2, y + 14); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  else if (k === 'earth') { ctx.fillStyle = '#6cc0ff'; circle(x, y, 22); ctx.fill(); ctx.fillStyle = '#5fb07a'; circle(x - 7, y - 5, 9); ctx.fill(); circle(x + 9, y + 8, 7); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = C.ink; circle(x, y, 22); ctx.stroke(); }
  else if (k === 'gem') { [[-14, 6], [6, -10], [14, 12]].forEach(([dx, dy]) => { ctx.save(); ctx.translate(x + dx, y + dy); ctx.rotate(t * 2); ctx.fillStyle = C.tealL; ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(7, 0); ctx.lineTo(0, 9); ctx.lineTo(-7, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }); }
  else if (k === 'chip') drawChipIcon(x, y, 1.4, t);
  else if (k === 'arms') { [[-1, C.orange], [1, C.orange]].forEach(([s2, col], i) => { const h2 = 18 + ((t * 8 + i * 3) % 14); ctx.fillStyle = col; ctx.fillRect(x + s2 * 14 - 8, y + 20 - h2, 16, h2); ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.strokeRect(x + s2 * 14 - 8, y + 20 - h2, 16, h2); }); ctx.strokeStyle = C.bad; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x - 22, y - 22); ctx.lineTo(x + 22, y + 22); ctx.moveTo(x + 22, y - 22); ctx.lineTo(x - 22, y + 22); ctx.globalAlpha = 0.0; ctx.stroke(); ctx.globalAlpha = 1; txt('↑', x - 14, y - 18, 18, C.amberL, 'center', { weight: 900 }); txt('↑', x + 14, y - 18, 18, C.amberL, 'center', { weight: 900 }); }
  else if (k === 'tower') { ctx.save(); ctx.translate(x, y + 40); ctx.scale(0.42, 0.42); drawTower({ x: 0, y: 0, alive: true, zone: 80, charge: (t * 0.3) % 1, inside: false }); ctx.restore(); }
  else if (k === 'belt24') { ctx.fillStyle = '#f1e8d8'; circle(x, y, 30); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = C.ink; ctx.stroke(); ctx.strokeStyle = C.red; ctx.lineWidth = 6; circle(x, y, 23); ctx.stroke(); txt('24', x, y + 2, 20, C.red, 'center', { weight: 900 }); }
  else if (k === 'unity') { drawChibi(x - 20, y + 16, t, false, 0, LOOKS[1], { noShadow: true, noPack: true, scale: 0.85 }); drawChibi(x + 20, y + 16, t, false, 0, LOOKS[3], { noShadow: true, noPack: true, scale: 0.85 }); drawChibi(x, y + 20, t, false, 0, LOOKS[0], { noShadow: true, noPack: true }); }
  else if (k === 'bib') { ctx.fillStyle = '#fff'; ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5; rr(x - 24, y - 18, 48, 36, 5); ctx.fill(); ctx.stroke(); ctx.strokeStyle = C.bad; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x - 13, y - 10); ctx.lineTo(x + 13, y + 10); ctx.moveTo(x + 13, y - 10); ctx.lineTo(x - 13, y + 10); ctx.stroke(); }
  else if (k === 'run') { ctx.fillStyle = '#e0573e'; ctx.fillRect(x - 40, y - 22, 26, 9); ctx.fillRect(x + 14, y - 22, 26, 9); ctx.fillStyle = C.tealL; for (let i = 0; i < 2; i++) { const yy = y + 20 - i * 18 - ((t * 1.6) % 1) * 18; ctx.beginPath(); ctx.moveTo(x, yy - 10); ctx.lineTo(x + 14, yy + 6); ctx.lineTo(x - 14, yy + 6); ctx.closePath(); ctx.fill(); } }
  else if (k === 'ally') { drawChibi(x - 12, y + 14, t, false, 0, LOOKS[0], { noShadow: true, noPack: true }); drawChibi(x + 14, y + 16, t, false, 0, LOOKS[2], { noShadow: true, noPack: true, scale: 0.9 }); }
  else if (k === 'storm') drawStormIcon('storm', x, y, t);
  else if (k === 'socket' || k === 'charter' || k === 'pad') drawCoreIcon(k, x, y);
  else if (k === 'core5') PROBS.forEach(([pk], i) => { const a = -Math.PI / 2 + i / 5 * TAU, px = x + Math.cos(a) * 22, py = y + Math.sin(a) * 22; ctx.fillStyle = 'rgba(110,28,30,0.95)'; circle(px, py, 13); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = C.bad; ctx.stroke(); drawProblemGlyph(pk, px, py, 0.7, true); });
  else if (k === 'valve') {
    // 네 돔 중 둘이 함께하는 모습
    for (let i = 0; i < 4; i++) { const dx = x - 27 + (i % 2) * 54 - (i < 2 ? 0 : 0), dy = y - 4 + Math.floor(i / 2) * 26, j = i < 2; ctx.fillStyle = j ? C.tealL : 'rgba(255,244,220,0.25)'; ctx.beginPath(); ctx.arc(dx, dy, 15, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = j ? C.ink : 'rgba(255,244,220,0.5)'; ctx.stroke(); }
    txt('2/4', x, y + 34, 15, C.amberL, 'center', { weight: 900 });
  }
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
    if (dashPressed && mech('lane') && L.restrict.noDash) { if (G.t - (G.dashWarnT || -9) > 1.2) { G.dashWarnT = G.t; addText(P.x, P.y - 64, '대시 금지 · 지구 출신', C.bad, 19); } }
    else if (dashPressed && P.dashCd <= 0) {
      P.dashT = 0.18; P.dashCd = st.dashCd; P.dashDir = P.moving ? { x: P.last.x, y: P.last.y } : { x: Math.cos(P.aim), y: Math.sin(P.aim) }; Sound.play('dash');
      burst(P.x, P.y, C.tealL, 8, 160, 4);
    }
    // 종장 타이밍 퀴즈 중에는 「파동」 버튼이 카드를 고르는 버튼이 된다
    if (hit('KeyE') || touchAct.skill) { if (G.quiz && G.quiz.type === 'timing') quizPress(); else useSkill(); }
    if (hit('Tab')) { G.missionPinned = !G.missionPinned; if (!G.missionPinned) G.missionAt = -99; }
    let spd = st.speed * (mech('lane') && L.restrict.slow ? L.restrict.slow : 1) * (P.boostT > 0 ? 1.8 : 1);
    if (L.fatigue) spd *= 1 - (L.fatigue.slow || 0) * (G.fatigue || 0);
    if (G.work && G.work.carry) spd *= 0.75;
    let vx = mx * spd, vy = my * spd;
    if (P.dashT > 0) { P.dashT -= dt; vx = P.dashDir.x * spd * 3.2; vy = P.dashDir.y * spd * 3.2; if (Math.random() < 0.6) G.parts.push({ x: P.x, y: P.y, vx: 0, vy: 0, life: 0.25, t: 0, color: 'rgba(159,245,234,0.8)', size: 9 }); }
    // 종장 완주: 출발 신호를 기다리는 동안은 출발선에 선다
    if (G.core && G.core.run.phase === 'count') { vx = 0; vy = 0; }
    const bv = beltAt(P.x, P.y); if (bv) { vx += bv.x; vy += bv.y; }
    const bp = bossPush(); vx += bp.x; vy += bp.y;
    vx += gustPush();
    vx += P.kx; vy += P.ky; P.kx *= Math.pow(0.0008, dt); P.ky *= Math.pow(0.0008, dt);
    if (moveBody(P, vx * dt, vy * dt, true)) { hurtPlayer(8, P.x, P.y + (P.y > G.cam.y + H / 2 ? 30 : -30)); showTip('wall', '레이저 벽은 닿으면 아파요', '발생기를 모두 부수면 꺼져요. 노란 화살표를 따라가요'); }
    // 나만 막는 차단막에 닿았을 때
    if (G.denyAt === G.t && G.t - (G.denyWarnT || -9) > 1.6) {
      G.denyWarnT = G.t; addText(P.x, P.y - 64, G.denyMsg, C.bad, 19);
      if (!G.denySaid) { G.denySaid = true; const r = G.runners[1]; if (r) addText(r.x, r.y - 56, '왜 너만 막아?', C.cream, 19); }
    }
  }
  if (P.dashCd > 0) P.dashCd -= dt;
  if (P.inv > 0) P.inv -= dt;
  if (G.skillCd > 0) G.skillCd -= dt;
  // 자동 발사
  P.fireT -= dt; if (P.glow > 0) P.glow -= dt * 3;
  const noFire = coreNoFire();
  const target = P.dead || noFire ? null : findTarget(P.x, P.y, st.range);
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
    if (tg && s.fireT <= 0 && !P.dead && !noFire) { s.fireT = 0.7; fireWave(s.x, s.y - 6, s.aim, st.dmg * 0.75, 1, 's', 340); }
  });
  G.allyT = (G.allyT || 0) - dt;
  if (st.allies > 0 && G.allyT <= 0 && !P.dead && !noFire) {
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
    if (G.walls.some(w => w.active && !w.barrier && inRectPad(b.x, b.y, w, 4)) || G.L.solids.some(s => inRectPad(b.x, b.y, s, 0)) || (G.L.domes || []).some(d => dist(b.x, b.y, d.x, d.y) < d.r)) { b.life = 0; burst(b.x, b.y, C.tealL, 3, 90, 3); continue; }
    for (const e of G.enemies) { if (e.dead || e.spawnT > 0) continue; if (dist(b.x, b.y, e.x, e.y) < e.r + b.r) { damageEnemy(e, b.dmg); b.life = 0; burst(b.x, b.y, C.tealL, 3, 100, 3); break; } }
    if (b.life <= 0) continue;
    for (const g of G.gens) {
      if (!g.alive || g.tower || g.noShoot) continue;
      if (dist(b.x, b.y, g.x, g.y - 22) < g.r + b.r) { damageGen(g, b.dmg); b.life = 0; burst(b.x, b.y, C.amber, 3, 100, 3); break; }
    }
    if (b.life <= 0) continue;
    for (const l of G.L.launchers || []) { if (!l.folded && dist(b.x, b.y, l.x, l.y - 8) < 34 + b.r) { b.life = 0; burst(b.x, b.y, C.amberL, 5, 150, 3); armsHit(l, b.kind === 'p'); break; } }
    if (b.life <= 0) continue;
    const bo = G.boss;
    if (bo && !bo.dead && bo.dying <= 0 && dist(b.x, b.y, bo.x, bo.y) < (bo.shield ? 152 : 100) + b.r) { damageBoss(b.dmg, b.x, b.y); b.life = 0; }
  }
  G.pB = G.pB.filter(b => b.life > 0);
  // 적 탄
  for (const b of G.eB) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.x < -50 || b.y < -50 || b.x > L.w + 50 || b.y > L.h + 50) { b.life = 0; continue; }
    if (G.walls.some(w => w.active && !w.barrier && inRectPad(b.x, b.y, w, 2)) || G.L.solids.some(s => inRectPad(b.x, b.y, s, 0)) || (G.L.domes || []).some(d => dist(b.x, b.y, d.x, d.y) < d.r)) { b.life = 0; continue; }
    if (P.dead) continue;
    const d = dist(b.x, b.y, P.x, P.y - 4);
    if (d < b.r + P.r * 0.7) { if (P.inv <= 0 && P.dashT <= 0) { hurtPlayer(10, b.x, b.y); b.life = 0; } }
  }
  G.eB = G.eB.filter(b => b.life > 0);
  // 기술: 공명 파동
  for (const p of G.pulses) {
    p.r += 900 * dt;
    G.eB = G.eB.filter(b => dist(b.x, b.y, p.x, p.y) > p.r);
    for (const e of G.enemies) {
      if (p.hit.has(e) || dist(e.x, e.y, p.x, p.y) > p.r + e.r) continue;
      p.hit.add(e); damageEnemy(e, noFire ? 0 : 25 * st.dmg / 10);
      const a = Math.atan2(e.y - p.y, e.x - p.x); if (e.speed > 0) moveBody(e, Math.cos(a) * 90, Math.sin(a) * 90, false);
    }
    for (const g of G.gens) if (g.alive && !g.tower && !p.hit.has(g) && dist(g.x, g.y, p.x, p.y) < p.r + g.r) { p.hit.add(g); damageGen(g, 30); }
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
      // stay: 따라오지 않고 그 자리에서 팻말을 든다(종장의 일하는 사람)
      if (c.stay) G.L.crowd.push({ x: c.x, y: c.y, look: c.look, aim: -Math.PI / 2, ph: Math.random() * 5, sign: c.stay });
      else G.settlers.push({ look: c.look, x: c.x, y: c.y, t: 0, fireT: 0.5, aim: -Math.PI / 2, moving: false });
      burst(c.x, c.y, C.tealL, 24, 220); if (!c.stay) showAllyTip();
      if (c.kind === 'worker') addText(c.x, c.y - 84, '고마워! 같이 멈추자!', C.tealL, 20);
      Sound.play('ally');
      G.gens.forEach(g => { if (g.alive && g.needAllies && !g.unlocked && G.settlers.length >= g.needAllies) { g.unlocked = true; burst(g.x, g.y - 30, C.tealL, 30, 300); banner('단결! 방어막이 풀렸어요', '이제 함께 「' + (g.name || '발생기') + '」를 부술 수 있어요', C.tealL, 3.6); } });
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
  if (z && wallById(z.exit).active && !workOn()) {
    z.spawnT -= dt;
    if (z.spawnT <= 0) {
      z.spawnT = z.every;
      const racing = z.race && G.race && G.race.on;
      if (G.enemies.filter(e => e.zone === G.zoneIdx && !(z.race && e.type === 'turret')).length < z.max && !(racing && G.race.grace > 0)) {
        for (let k = 0; k < 14; k++) {
          const xr = z.xr && mech('lane') ? z.xr : [80, L.w - 80];
          // 달리기 구간에서는 화면 바로 위쪽에, 달리기가 끝나면 광장에만 나타난다
          const x = rand(xr[0], xr[1]), y = racing ? rand(G.race.camY - 110, G.race.camY + 30) : rand(z.y0 + 60, (z.race ? L.race.endY : z.y1) - 60);
          if (dist(x, y, P.x, P.y) > (racing ? 300 : 430) && !G.walls.some(w => w.active && inRectPad(x, y, w, 30)) && !G.L.solids.some(s => inRectPad(x, y, s, 30)) && !(G.L.domes || []).some(d => dist(x, y, d.x, d.y) < d.r + 30)) { spawnEnemy(pick(z.race && !racing && z.pool2 ? z.pool2 : z.pool), x, y, G.zoneIdx); break; }
        }
      }
    }
  }
  const rg = wallById('recgate');
  if (rg && rg.active && recordsLeft() === 0) { rg.active = false; rg.fade = 1; banner('기록 문이 열렸어요!', '기록을 모두 모았어요. 이제 보스 구역으로 들어가요', C.tealL, 3.5); Sound.play('good'); }
  if (!G.boss && !wallById('wA').active && P.y < 690 && !P.dead) startBoss();
  if (G.boss && !G.boss.dead) updateBoss(dt);
  updateRace(dt); updateBoosts(dt); updateRunners(dt); updateFactory(dt); updateArms(dt); updateStorm(dt); updateCardFly(dt); updateCore(dt);
  updateCoach(dt); updateTips(dt); updateNpcs(dt);
  updateFx(dt);
  // 카메라
  let tx, ty;
  if (G.arenaLock) { tx = L.arena.x; ty = L.arena.y; }
  else if (G.race && G.race.on) { tx = clamp(P.x - W / 2, 0, L.w - W); ty = G.race.camY; }
  else { tx = clamp(P.x - W / 2, 0, L.w - W); ty = clamp(P.y - H / 2 - 30, 0, L.h - H); }
  const k = 1 - Math.exp(-dt * 8);
  G.cam.x = lerp(G.cam.x, tx, k); G.cam.y = lerp(G.cam.y, ty, k);
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 30);
  if (G.pendingLv > 0 && G.mode === 'play' && !P.dead) openLevelUp();
}
// 단결: 동료가 모자라면 가동 장치의 방어막이 풀리지 않는다
// 가동을 멈춘 바로 그 구역에서, 아직 지쳐 있으면 쉼터에 들러 보라고 안내한다
function restNudge() { return !!(G.L.fatigue && (G.L.rests || []).length && !mech('belt') && G.fatigue > 0.3 && G.zoneIdx === (G.L.fatigue.zone != null ? G.L.fatigue.zone : 1) && !G.boss); }
function genShielded(g) { return !!(g.alive && g.needAllies && G.settlers.length < g.needAllies); }
function unityNeed() {
  const z = G.zones[G.zoneIdx]; if (!z || G.boss) return null;
  const w = wallById(z.exit);
  return G.gens.find(g => w.gens.includes(g.id) && genShielded(g)) || null;
}
function damageGen(g, dmg) {
  if (!g.alive || g.noShoot) return;
  if (genShielded(g)) { if (G.t - (G.shieldWarnT || -9) > 1.6) { G.shieldWarnT = G.t; addText(g.x, g.y - 150, '혼자서는 못 멈춰요!', C.bad, 20); } return; }
  g.hp -= dmg; g.hitT = 0.1;
  if (g.hp > 0) return;
  killGen(g);
}
function killGen(g) {
  g.alive = false; G.shake = Math.max(G.shake, 10);
  if (g.tower) onTowerLit(g);
  if (g.valve) onValveClosed(g);
  burst(g.x, g.y - 20, g.socket ? C.tealL : C.amber, 30, 320); burst(g.x, g.y - 20, C.cream, 14, 200);
  gainXp(8); Sound.play(g.socket ? 'card' : 'boom');
  const freed = G.walls.some(w => w.active && w.divider && w.gens.every(id => !G.gens.find(x => x.id === id).alive));
  for (const w of G.walls) {
    if (!w.active || w.gate || !w.gens.length) continue;
    if (w.gens.every(id => !G.gens.find(x => x.id === id).alive)) {
      w.active = false; w.fade = 1;
      if (w.divider) liberate();
      else if (w.barrier) { /* 차단막은 조용히 열린다 */ }
      else if (!freed && !w.quiet) banner(w.offMsg ? w.offMsg[0] : '레이저 벽 해제!', w.offMsg ? w.offMsg[1] : w.id === 'wA' ? '앞쪽 보스 구역으로 들어가세요' : '앞으로 나아가세요', C.mustard, 2.6);
    }
  }
  if (g.socket) onSocket(g);
  // 발생기가 가지고 있던 기록 칩
  if (g.drop) { G.chips.push({ id: g.drop, x: g.x, y: g.y + 70, t: 0, got: false }); g.drop = null; }
}
function showAllyTip() {
  const n = G.settlers.length;
  if (!G.tipsSeen.ally) { G.tipsSeen.ally = true; showNotice('정착민이 함께해요!', '동료는 같이 쏘고, 1명마다 공격력 +' + allyPct(1) + '%, ' + guardEvery() + '초에 한 번 대신 막아 줘요. 힘을 모으는 것을 연대라고 해요', '+'); }
  else showNotice('정착민이 함께해요!', '동료 ' + n + '명 · 공격 +' + allyPct(n) + '% · 막아 주기', '+');
}
function liberate() {
  G.restricted = false; G.freeT = G.t;

  G.shake = Math.max(G.shake, 12);
  burst(G.P.x, G.P.y, C.tealL, 30, 300);
  const P = G.P;
  const near = G.npcs.slice().sort((a, b) => dist(a.x, a.y, P.x, P.y) - dist(b.x, b.y, P.x, P.y));
  const fr = (G.L.restrict && G.L.restrict.free) || {};
  near.slice(0, fr.joinN == null ? 2 : fr.joinN).forEach(n => { n.joined = true; G.settlers.push({ look: n.look, x: n.x, y: n.y, t: 0, fireT: 0.5, aim: 0, moving: false }); addText(n.x, n.y - 50, fr.join || '함께 가요!', C.tealL, 20); });
  G.npcs = G.npcs.filter(n => !n.joined);
  G.npcs.forEach(n => addText(n.x, n.y - 50, fr.cheer || '야호!', C.mustard, 18));
  G.runners.forEach(r => addText(r.x, r.y - 54, '같이 달리자!', C.mustard, 18));
  // 퇴장 드론은 멈춘다
  G.enemies.forEach(e => { if (e.type === 'ejector' && !e.dead) { e.dead = true; burst(e.x, e.y, C.mustard, 10, 200); addText(e.x, e.y - 30, '정지', C.good, 17); } });
  (G.L.launchers || []).forEach(l => { if (l.residual) { l.folded = true; l.foldK = 0; l.resid = true; } else foldLauncher(l); });
  G.shells = [];
  G.tipsSeen.ally = true;
  showNotice(fr.title || '분리선 해제!', (fr.sub || '이제 어디든 갈 수 있고 대시도 쓸 수 있어요. 화성 태생 주민 2명이 함께해요!') + ' (동료 ' + G.settlers.length + '명 · 공격 +' + allyPct(G.settlers.length) + '%)', '✓');
}
/* ----- 달리기 구간: 화면이 위로 계속 움직인다 ----- */
function nextGap() {
  const gs = G.L.barGaps; if (!gs) return null;
  let best = null;
  for (const g of gs) { const w = wallById(g.wall); if (w && w.active && g.y < G.P.y - 12 && (!best || g.y > best.y)) best = g; }
  return best;
}
function updateRace(dt) {
  const R = G.race; if (!R) return;
  const P = G.P, L = G.L, rz = L.race;
  if (!R.on && !R.done && G.zoneIdx === rz.zone && !P.dead) {
    R.on = true; R.camY = G.cam.y; R.grace = 2.4;
    banner('달리기 시작!', '화면이 위로 움직여요. 노란 화살표를 따라 차단막의 틈으로!', C.mustard, 3.2);
  }
  if (!R.on) return;
  if (R.grace > 0) R.grace -= dt; else R.camY -= R.v * dt;
  R.camY = Math.min(R.camY, P.y - H * 0.62);        // 앞서 달리면 화면도 따라간다
  R.camY = Math.max(R.camY, rz.minCam);
  // 뒤처지면 다친다. 차단막을 넘겨 주지는 않는다: 막힌 차단막 아래, 틈 바로 앞으로 옮기고 화면을 잠깐 멈춘다
  const bottom = R.camY + H - 46;
  if (P.y > bottom && !P.dead) {
    hurtPlayer(12, P.x, P.y + 60);
    if (!P.dead) {
      const gp = nextGap();
      let ny = R.camY + H * 0.64;
      if (gp && gp.y + 70 > ny) { ny = gp.y + 70; P.x = gp.x; }
      P.y = ny; P.kx = P.ky = 0; P.inv = Math.max(P.inv, 1.4);
      R.camY = Math.max(rz.minCam, ny - H * 0.62); R.grace = 1.6;
      addText(P.x, P.y - 64, '뒤처졌어요!', C.bad, 22); burst(P.x, P.y, C.bad, 12, 200);
      if (gp) addText(P.x, P.y - 96, '틈으로 지나가세요 ▲', C.tealL, 19);
    }
  }
  // 지나온 차단막 바로 위가 다시 시작하는 자리
  for (const g of L.barGaps) if (P.y < g.y - 70 && G.checkpoint.y > g.y - 90) G.checkpoint = { x: g.x, y: g.y - 90 };
  // 화면 아래로 지나가 버린 기록 칩은 앞쪽 틈에 다시 나타난다
  let k = 0;
  for (const c of G.chips) {
    if (c.got || save.records[c.id] || c.y < R.camY + H + 70) continue;
    const ahead = L.barGaps.filter(g => g.y < R.camY - 40).sort((a, b) => b.y - a.y)[k++];
    if (ahead) { c.x = ahead.x; c.y = ahead.y + 80; } else { c.x = 520 + (k++) * 110; c.y = rz.endY - 90; }
  }
  // 뒤에 남은 드론은 사라진다
  for (const e of G.enemies) if (!e.dead && e.type !== 'turret' && e.y > R.camY + H + 170) e.dead = true;
  if (P.y < rz.endY) {
    R.on = false; R.done = true; G.checkpoint = { x: 800, y: rz.endY - 70 };
    let n = 0;
    for (const c of G.chips) if (!c.got && !save.records[c.id] && c.y > rz.endY) { c.x = 520 + (n++) * 120; c.y = rz.endY - 100; }
    banner('등록소 광장 도착!', '출전 금지 발생기를 부수면 차단막이 모두 꺼져요', C.mustard, 3.2);
  }
}
function updateBoosts(dt) {
  const P = G.P;
  if (P.boostT > 0) { P.boostT -= dt; if (Math.random() < 0.6) G.parts.push({ x: P.x, y: P.y + 6, vx: 0, vy: 0, life: 0.25, t: 0, color: 'rgba(159,245,234,0.8)', size: 8 }); }
  if (P.dead) return;
  for (const b of G.L.boosts || []) {
    if (Math.abs(P.x - b.x) > 84 || Math.abs(P.y - b.y) > 38) continue;
    if (G.restricted) { if (G.t - (G.boostWarnT || -9) > 1.8) { G.boostWarnT = G.t; addText(P.x, P.y - 64, '가속 발판 꺼짐 · 번호표 없음', C.bad, 19); } }
    else { if (!(P.boostT > 0)) { addText(P.x, P.y - 64, '슝!', C.tealL, 26); burst(P.x, P.y, C.tealL, 14, 220, 5); Sound.play('good'); } P.boostT = 1.3; }
  }
}
// 화성 태생 주자: 번호표를 달고, 차단막을 그냥 지나가며, 가속 발판도 쓴다
function updateRunners(dt) {
  const R = G.runners; if (!R.length || G.arenaLock) return;
  const P = G.P, race = G.race;
  R.forEach((r, i) => {
    r.t += dt; if (r.boostT > 0) r.boostT -= dt;
    let lead;
    if (G.time < 2.6) lead = r.y;                                        // 출발선에서 기다린다
    else if (!race.on && !race.done) lead = 6050 - i * 44;               // 게이트를 지나 앞에서 기다린다
    else if (race.on) lead = race.camY + r.off;                          // 달리기: 화면과 함께 달린다
    else if (G.restricted) lead = 2210 + i * 26;                         // 광장에서 기다린다
    else lead = Math.max(P.y - 70 - r.off * 0.5, 1030 + i * 34);         // 모두의 레이스: 함께 달린다
    const ty = Math.min(r.y, lead);
    const v = clamp((r.y - ty) * 3.2, 0, r.boostT > 0 ? 520 : 340);
    const py = r.y; r.y -= v * dt; r.moving = v > 24;
    r.x = r.lane + Math.sin(r.t * 0.7 + i * 1.7) * 26;
    if (!r.said && G.time >= 2.6) { r.said = true; if (i === 1) addText(r.x, r.y - 56, '출발!', C.mustard, 20); }
    for (const w of G.walls) {
      if (!w.active || !(w.barrier || w.startGate)) continue;
      const wy = w.y + w.h / 2;
      if (py > wy && r.y <= wy && r.x > w.x && r.x < w.x + w.w) { addText(r.x, wy - 30, '통과', C.good, 17); burst(r.x, wy, C.good, 8, 140, 4); }
    }
    for (const b of G.L.boosts || []) if (Math.abs(r.x - b.x) < 80 && Math.abs(r.y - b.y) < 34 && !(r.boostT > 0)) { r.boostT = 0.7; burst(r.x, r.y, C.tealL, 6, 160, 4); }
  });
}
/* ----- 공장: 벨트, 압착기, 쉼터 ----- */
function beltAt(x, y) {
  const L = G.L; if (!L.belts || !mech('belt')) return null;
  if ((L.islands || []).some(i => x > i.x && x < i.x + i.w && y > i.y && y < i.y + i.h)) return null;
  for (const b of L.belts) if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return { x: b.dx * b.speed, y: b.dy * b.speed };
  return null;
}
// 바닥이 밀거나(시계탑), 돌풍이 밀거나, 배수구가 끌어당기는 힘. 대시 중에는 받지 않는다
function bossPush() {
  const b = G.boss, P = G.P, out = { x: 0, y: 0 };
  if (!b || b.dead || !b.pat || P.dashT > 0) return out;
  const p = b.pat;
  if (p.kind === 'floor' && p.t > 1.0 && p.t < 4.2) out.x = p.dir * 135;
  else if (p.kind === 'gust' && p.t > 1.0 && p.t < 3.6) out.x = p.dir * 150;
  else if (p.kind === 'drain' && p.v && p.t > 1.1) {
    for (const v of p.v) { const d = dist(P.x, P.y, v.x, v.y), R = v.r * 1.9; if (d < R && d > 4) { const s = 60 + 120 * (1 - d / R); out.x += (v.x - P.x) / d * s; out.y += (v.y - P.y) / d * s; } }
  }
  return out;
}
function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, t = l2 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1) : 0;
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}
function updateFactory(dt) {
  const P = G.P, L = G.L; if (P.dead) return;
  if (mech('belt')) for (const pr of L.presses || []) {
    if (P.x < pr.x - 6 || P.x > pr.x + pr.w + 6 || P.y < pr.y || P.y > pr.y + pr.h) continue;
    hurtPlayer(12, pr.x + pr.w / 2 + (pr.x < 800 ? -70 : 70), P.y);
    if (G.t - (G.pressWarnT || -9) > 1.5) { G.pressWarnT = G.t; addText(P.x, P.y - 64, '압착기!', C.bad, 20); }
  }
  let resting = false;
  for (const r of L.rests || []) {
    if (P.x < r.x || P.x > r.x + r.w || P.y < r.y || P.y > r.y + r.h) continue;
    if (mech('belt')) { if (G.t - (G.restWarnT || -9) > 1.8) { G.restWarnT = G.t; addText(P.x, P.y - 64, '쉼터 잠김 · 쉬는 시간 없음', C.bad, 19); } }
    else {
      resting = true;
      if (P.hp < G.st.maxHp || G.fatigue > 0.01) { P.hp = Math.min(G.st.maxHp, P.hp + 16 * dt); if (G.t - (G.restT || -9) > 0.8) { G.restT = G.t; addText(P.x + rand(-16, 16), P.y - 50, '쉬는 중 +', C.good, 18); } }
    }
  }
  // 일하는 장면: 산소 통을 들어 벨트에 올린다. 올릴 때마다 시간이 훌쩍 지나지만 교대는 없다
  const wk = L.work, ws = G.work;
  if (wk && ws && !ws.done) {
    if (!ws.carry && dist(P.x, P.y, wk.from.x, wk.from.y) < 54) { ws.carry = true; addText(P.x, P.y - 74, '영차!', C.cream, 20); Sound.play('pick'); }
    else if (ws.carry && dist(P.x, P.y, wk.to.x, wk.to.y) < 56) {
      ws.carry = false; ws.n++; G.shiftH = ws.n * wk.hours; G.fatigue = Math.min(1, (G.fatigue || 0) + 0.1);
      burst(wk.to.x, wk.to.y - 24, C.tealL, 14, 200); Sound.play('good');
      if (ws.n < wk.need) banner(G.shiftH + '시간째… 아직 교대가 없어요', '산소 통을 계속 올리세요 (' + ws.n + '/' + wk.need + ')', '#e3c8ff', 2.4);
      else finishWork();
    }
  }
  // 피로: 쉬지 못하고 일하면 쌓이고 체력이 줄어든다. 쌓일수록 느려진다. 쉬면 풀린다
  const F = L.fatigue;
  if (F) {
    const fOn = mech('belt') && (F.zone == null || G.zoneIdx === F.zone);
    if (fOn) {
      if (!ws || ws.done) {
        G.shiftH += dt / 2.5;
        const k = Math.floor(G.shiftH / 8);
        if (k > G.bellK) { G.bellK = k; G.toasts.push({ zone: '교대 벨이 울렸어요 · 오더 방송: 「교대 없음. 계속 가동」', t: 0 }); }
      }
      G.fatigue = Math.min(1, (G.fatigue || 0) + dt / F.fill * (beltAt(P.x, P.y) ? 1.5 : 1));
      const full = G.fatigue >= 1, floor = G.st.maxHp * F.floor, rate = full ? F.drain : (F.idle || 0);
      if (P.hp > floor && !G.god) { const d = Math.min(P.hp - floor, rate * dt); P.hp -= d; G.drainAcc = (G.drainAcc || 0) + d; }
      if (full) {
        if (!G.tiredSeen) { G.tiredSeen = true; banner('지쳤어요!', '쉬지 못해 느려지고 체력이 줄어들어요. 24시간 가동을 멈춰야 쉴 수 있어요', '#e3c8ff', 4.5); }
        G.tiredT = (G.tiredT || 0) - dt;
        if (G.tiredT <= 0) { G.tiredT = 2.4; G.drainAcc = 0; addText(P.x, P.y - 64, P.hp > floor ? '지쳤어요… 체력이 줄어요' : '지쳤어요… 쉬고 싶다', '#e3c8ff', 19); }
      } else if (G.drainAcc >= 2) { G.drainAcc -= 2; addText(P.x, P.y - 60, '쉬지 못해 -2', '#e3c8ff', 17); }
    } else G.fatigue = Math.max(0, (G.fatigue || 0) - dt / (resting ? 2.5 : 24));
    // 창밖: 낮과 밤이 바뀌어도 벨트는 돈다
    const na = fOn ? 0.1 * (1 - Math.cos(TAU * (G.shiftH % 24) / 24)) : 0;
    G.nightA = lerp(G.nightA || 0, na, Math.min(1, dt * 1.5));
  }
}
function workOn() { return !!(G.work && !G.work.done); }
function finishWork() {
  const wk = G.L.work, ws = G.work;
  ws.done = true; G.shiftH = wk.need * wk.hours;
  const fence = G.walls.find(w => w.workFence); if (fence) { fence.active = false; fence.fade = 1; }
  banner(G.shiftH + '시간째… 교대 없음!', '「쉬게 해 주세요!」 이대로는 일할 수 없어요. 자리를 박차고 나가요', C.mustard, 4.4);
  (wk.spawn || []).forEach(s => spawnEnemy(s[0], s[1], s[2], 0));
  if (G.coach) { G.coach.st = 0; G.coach.showAt = G.t; }
}
/* ----- 4스테이지: 무기 경쟁, 발사대, 미사일, 연대 송신탑 ----- */
function armsHit(l, mine) {
  if (G.t - (l.hitT || -9) > 0.45) {
    l.hitT = G.t;
    if (mine && mech('arms') && G.arms) { G.arms[l.side]++; G.armsFlash[l.side] = 1; G.armsHits = (G.armsHits || 0) + 1; }
  }
  if (mine && G.t - (G.armsWarnT || -9) > 2.6) { G.armsWarnT = G.t; addText(l.x + (l.side === 'a' ? 150 : -150), l.y - 70, G.arms ? '통하지 않아요! 쏠수록 무기가 늘어나요' : '통하지 않아요! 제4조 단말기에 카드를 꽂아요', C.bad, 19); }
}
function foldLauncher(l) { if (l.folded) return; l.folded = true; l.foldK = 0; burst(l.x, l.y - 20, C.tealL, 14, 200); }
function onTowerLit(g) {
  const L = G.L, towers = G.gens.filter(x => x.tower), n = towers.filter(x => !x.alive).length;
  (L.launchers || []).forEach(l => { if (l.tower === g.id && !l.residual) foldLauncher(l); });
  if (G.arms) { G.arms.a = Math.max(0, G.arms.a - 4); G.arms.b = Math.max(0, G.arms.b - 4); }
  G.shells = G.shells.filter(s => dist(s.x, s.y, g.x, g.y) > 260);
  // 두 돔 사람들이 송신탑 둘레로 나와 팻말을 든다. 한 명은 동료가 된다
  const signs = ['평화', '전쟁 반대', '무기 말고 평화', '함께해요'];
  for (let k = 0; k < 4; k++) {
    const a = k / 4 * TAU + 0.5;
    L.crowd.push({ x: g.x + Math.cos(a) * 158, y: g.y + 18 + Math.sin(a) * 100, look: LOOKS[(k * 2 + n) % LOOKS.length], aim: Math.cos(a) > 0 ? Math.PI : 0, ph: Math.random() * 5, sign: signs[k] });
  }
  G.settlers.push({ look: LOOKS[(n + 3) % LOOKS.length], x: g.x + 50, y: g.y + 40, t: 0, fireT: 0.5, aim: 0, moving: false });
  burst(g.x, g.y - 96, C.tealL, 40, 320);
  if (!G.tipsSeen.ally) showAllyTip();
  else banner('연대 송신탑 ' + n + '/' + towers.length + ' 켜짐!', '두 돔 사람들이 함께해요 · 둘레 발사대가 내려갔어요 (동료 ' + G.settlers.length + '명)', C.tealL, 3);
}
function updateArms(dt) {
  const L = G.L, P = G.P;
  // 미사일 경고 원: 시간이 되면 떨어져 터진다(보스전에서도 쓴다)
  for (const s of G.shells) {
    s.t += dt;
    if (s.t >= s.warn && !s.boom) {
      s.boom = true; burst(s.x, s.y, C.orange, 22, 260); burst(s.x, s.y, C.cream, 10, 180); G.shake = Math.max(G.shake, 5);
      if (!P.dead && dist(P.x, P.y, s.x, s.y) < s.r + P.r * 0.5) {
        hurtPlayer(9, s.x, s.y);
      }
    }
  }
  G.shells = G.shells.filter(s => s.t < s.warn + 0.35);
  if (G.residualOrb) G.residualOrb.t += dt;
  if (!L.launchers) return;
  for (const l of L.launchers) { l.t += dt; if (l.folded && l.foldK < 1) l.foldK = Math.min(1, l.foldK + dt * 2); }
  const ar = L.armsRace;
  if (G.arms) {
    for (const k of ['a', 'b']) if (G.armsFlash[k] > 0) G.armsFlash[k] -= dt * 2;
    if (G.restricted) {
      // 무기 경쟁: 한쪽이 늘리면 다른 쪽이 곧 따라 늘린다
      G.armsT -= dt;
      if (G.armsT <= 0) {
        G.armsT = ar.every;
        const s = Math.random() < 0.5 ? 'a' : 'b', o = s === 'a' ? 'b' : 'a';
        G.arms[s]++; G.armsFlash[s] = 1;
        G.armsFollow = { side: o, t: 0.9, to: G.arms[s] + (Math.random() < 0.5 ? 1 : 0) };
      }
      if (G.armsFollow) { G.armsFollow.t -= dt; if (G.armsFollow.t <= 0) { const f = G.armsFollow; G.arms[f.side] = Math.max(G.arms[f.side] + 1, f.to); G.armsFlash[f.side] = 1; G.armsFollow = null; } }
    } else { G.arms.a = Math.max(0, G.arms.a - dt * 9); G.arms.b = Math.max(0, G.arms.b - dt * 9); }
  }
  // 송신탑: 원 안에서 버티면 켜진다. 동료가 많을수록 빨리 켜진다
  for (const t of G.gens) {
    if (!t.tower || !t.alive) continue;
    t.inside = !P.dead && G.mode === 'play' && dist(P.x, P.y, t.x, t.y) < t.zone;
    if (t.inside) { t.charge = Math.min(1, t.charge + dt / (t.time || L.towerTime) * (1 + 0.35 * G.settlers.length)); if (t.charge >= 1) damageGen(t, 1e9); }
    else t.charge = Math.max(0, t.charge - dt * 0.04);
  }
  if (!mech('arms') || G.arenaLock || P.dead) return;
  // 발사대: 공격이 통하지 않고, 무기가 늘수록 더 자주 쏜다
  const esc = G.arms ? 1 + clamp((G.arms.a + G.arms.b - 2 * ar.start) / 40, 0, 0.6) : 1;
  for (const l of L.launchers) {
    if (l.folded || Math.abs(l.y - P.y) > 480) continue;
    if (L.sockets && zoneIndexAt(l.y) !== G.zoneIdx) continue;   // 종장: 벽 너머 구역으로는 쏘지 않는다
    l.fireT -= dt * esc;
    if (l.fireT > 0) continue;
    l.fireT = rand(5.0, 7.0);
    const dir = l.side === 'a' ? 1 : -1;
    if (Math.random() < 0.55) {
      const lead = P.moving ? 70 : 0;
      G.shells.push({ x: clamp(P.x + rand(-70, 70) + P.last.x * lead, 170, 1430), y: clamp(P.y + rand(-60, 60) + P.last.y * lead, 830, L.h - 30), t: 0, warn: 1.4, r: 70 });
      l.flash = 0.3;
    } else {
      for (let k = -1; k <= 1; k++) enemyShot(l.x + dir * 34, l.y - 12, (dir > 0 ? 0 : Math.PI) + k * 0.12, 215, 8);
      l.flash = 0.3;
    }
  }
}
/* ----- 5스테이지: 모래폭풍, 돌풍, 밸브, 다시 차는 호수 ----- */
function gustPush() { const g = G.gust; return g && g.phase === 'blow' && G.P.dashT <= 0 && !G.P.dead ? g.dir * G.L.storm.gust.power : 0; }
function onValveClosed(g) {
  const total = G.L.storm.domes;
  G.domes++;
  burst(g.x, g.y - 20, '#6cc8f0', 30, 300); burst(g.x, g.y - 20, C.cream, 12, 200);
  // 밸브 옆 주민이 동료가 된다
  const n = G.npcs.find(x => x.valve === g.id);
  if (n) {
    G.npcs = G.npcs.filter(x => x !== n);
    G.settlers.push({ look: n.look, x: n.x, y: n.y, t: 0, fireT: 0.5, aim: 0, moving: false });
    addText(n.x, n.y - 56, g.id === 'v0' ? '같이 가자! 우리 돔만으로는 안 되나 봐…' : g.dome + '도 함께 지킬게요!', C.tealL, 20);
  }
  if (!G.tipsSeen.ally) showAllyTip();
  else if (G.domes < total && g.id !== 'v0') banner('함께 지키는 돔 ' + G.domes + '/' + total, g.dome + ' 사람들이 함께해요 · 모래폭풍이 조금 약해졌어요 (동료 ' + G.settlers.length + '명)', C.tealL, 3.2);
}
function updateStorm(dt) {
  const L = G.L, S = G.storm; if (!S) return;
  const b = G.boss, P = G.P;
  // 보이는 둘레: 폭풍 중에는 함께 지키는 돔이 늘수록 넓어지고, 폭풍이 걷히면 사라진다. 보스전에서는 모래폭풍 패턴 때만
  let k, r = S.r;
  if (b && !b.dead) { const on = b.pat && b.pat.kind === 'storm' && b.pat.t > 0.4 && b.pat.t < 4.5; k = on ? 1 : 0; r = 270; }
  else if (mech('storm') && (L.storm.zone == null || G.zoneIdx === L.storm.zone)) { k = 1; r = L.storm.r0 + L.storm.step * G.domes; }
  else k = 0;
  S.k = lerp(S.k, k, Math.min(1, dt * (k > S.k ? 2.5 : 0.8)));
  S.r = lerp(S.r, r, Math.min(1, dt * 2));
  // 호수 물(%)과 물이 차는 모습
  const wt = G.restricted ? (L.water0 || 0) + (L.waterStep || 0) * G.domes : 100;
  G.water = lerp(G.water, wt, Math.min(1, dt * 1.6));
  if (!G.restricted) G.lakeFill = Math.min(1, G.lakeFill + dt / 4.5);
  const lk = L.lake;
  if (lk && G.lakeFill > 0.5 && P.moving && !P.dead && P.x > lk.x && P.x < lk.x + lk.w && P.y > lk.y && P.y < lk.y + lk.h && Math.random() < dt * 9)
    G.parts.push({ x: P.x + rand(-8, 8), y: P.y + 12, vx: rand(-30, 30), vy: rand(-40, -10), life: 0.45, t: 0, color: 'rgba(210,245,255,0.85)', size: 4 });
  // 돌풍: 기다림 → 화살표로 알림(warn) → 옆으로 민다(blow)
  const g = G.gust, cfg = L.storm.gust;
  if (g) {
    const active = mech('storm') && (L.storm.zone == null || G.zoneIdx === L.storm.zone) && !b && !P.dead;
    if (!active) { if (g.phase !== 'wait') { g.phase = 'wait'; g.t = rand(cfg.every[0], cfg.every[1]); } }
    else {
      g.t -= dt;
      if (g.t <= 0) {
        if (g.phase === 'wait') { g.phase = 'warn'; g.t = cfg.warn; g.dir = Math.random() < 0.5 ? 1 : -1; }
        else if (g.phase === 'warn') { g.phase = 'blow'; g.t = cfg.blow; }
        else { g.phase = 'wait'; g.t = rand(cfg.every[0], cfg.every[1]); }
      }
    }
  }
  const bg = b && !b.dead && b.pat && b.pat.kind === 'gust' ? b.pat : null;
  if (g && g.phase !== 'wait') S.dir = g.dir; else if (bg) S.dir = bg.dir;
  const fast = (g && g.phase === 'blow') || (bg && bg.t > 1.0);
  S.ph = (S.ph || 0) + dt * (fast ? 1100 : g && g.phase === 'warn' ? 420 : 240) * (S.dir || 1);
}
/* ----- 종장: 원칙 단말기. 잠금을 부수면 제도 카드가 꽂히고, 그 문제만 꺼진다 ----- */
const cardById = id => { const s = D.stages.find(x => x.card && x.card.id === id); return s ? s.card : null; };
const articleOf = n => (D.charter || []).find(c => c.article === n) || { text: '' };
function onSocket(g) {
  const P = G.P, card = cardById(g.card) || { name: '제도', year: '' };
  G.off[g.mech] = true; G.sockets++;
  G.cardFly = { x0: P.x, y0: P.y - 30, x1: g.x, y1: g.y - 112, t: 0, n: g.socket };
  g.insertT = G.t;
  if (g.mech === 'arms') { (G.L.launchers || []).forEach(l => { if (l.resid) { if (!l.folded) { l.folded = true; l.foldK = 0; } } else foldLauncher(l); }); G.shells = []; }
  const cheer = { lane: '같은 길이야!', bar: '누구나 달려요!', belt: '퇴근이다!', storm: '앞이 보여요!' }[g.mech];
  if (cheer) G.npcs.forEach(n => { if (dist(n.x, n.y, P.x, P.y) < 800 && (!n.post || n.mech === g.mech)) addText(n.x, n.y - 54, cheer, C.mustard, 18); });
  // 그 스테이지 사람이 동료가 된다
  G.settlers.push({ look: LOOKS[(g.ally || 0) % LOOKS.length], x: g.x + 46, y: g.y + 40, t: 0, fireT: 0.5, aim: 0, moving: false });
  addText(g.x, g.y - 170, g.join || '함께 가요!', C.tealL, 21);
  const exit = G.walls.find(w => w.quiet && !w.divider && w.gens.includes(g.id));
  const opened = exit && !exit.active;
  banner('제' + g.socket + '조 입력! 「' + card.name + '」', articleOf(g.socket).text + ' → ' + (g.offText || '') + (opened ? ' · 위쪽 문이 열렸어요 ▲' : ''), C.tealL, 4.4);
  if (!G.tipsSeen.ally) showAllyTip();
}
// 단말기 둘레에서 근거 구슬이 떠다닐 칸: 아직 켜진 벽(분리선·차단막·구역 문)과 바깥 벽 안쪽으로만
function sockCell(g) {
  let y0 = 0, y1 = G.L.h, x0 = 0, x1 = G.L.w;
  for (const w of G.walls) {
    if (!w.active || w.gate || w.charter) continue;
    if (w.w > w.h) { if (g.x > w.x && g.x < w.x + w.w) { if (w.y < g.y) y0 = Math.max(y0, w.y + w.h); else y1 = Math.min(y1, w.y); } }
    else if (g.y > w.y && g.y < w.y + w.h) { if (w.x < g.x) x0 = Math.max(x0, w.x + w.w); else x1 = Math.min(x1, w.x); }
  }
  for (const sd of G.L.solids) if ((sd.space || sd.fwall || sd.cliff) && g.y > sd.y && g.y < sd.y + sd.h) { if (sd.x + sd.w <= g.x) x0 = Math.max(x0, sd.x + sd.w); else if (sd.x >= g.x) x1 = Math.min(x1, sd.x); }
  return { x0: x0 + 60, x1: x1 - 60, y0: y0 + 60, y1: y1 - 70 };
}
/* ----- 종장: 단말기를 그 운동의 방법으로 열고, 기록 발판을 순서대로 밟는다 ----- */
const chainOf = g => ((G.def.chains || []).find(c => c.article === g.socket)) || null;
const coreSock = id => G.gens.find(g => g.id === id);
// 지금 열어야 할 단말기: 지금 구역 출구 벽에 걸린, 아직 꽂히지 않은 단말기
function curSock() {
  const z = G.zones[G.zoneIdx]; if (!z) return null;
  const w = wallById(z.exit);
  return G.gens.find(g => g.socket && g.alive && w.gens.includes(g.id)) || null;
}
// 지금 할 일과 안내 화살표가 가리킬 곳(단말기마다 여는 방법이 다르다)
function coreObjective() {
  if (!G.L.sockets || G.boss) return null;
  const q = G.quiz;
  if (q && q.type === 'timing') return { text: '가운데 칸에 「' + roleOf(q.ch, q.ch.items[q.step]) + '」 기록이 오면 「파동」 버튼 (' + q.step + '/' + q.ch.items.length + ')', target: null };
  if (q) return { text: '정리표 퀴즈 풀기', target: null };
  const g = curSock(); if (!g) return null;
  if (g.ready) return { text: '제도 카드를 꽂아요', target: g };
  if (g.method === 'unity') { const cs = G.caps.filter(c => c.mod === 'labor'), f = cs.filter(c => c.freed).length; return { text: '벨트를 거슬러 일하는 사람 풀어 주기 (단결 ' + f + '/' + cs.length + ')', target: nearestOf(cs.filter(c => !c.freed)) }; }
  if (g.method === 'march') return { text: '쏘지 말고 행진해서 제1조 단말기까지 (비폭력 행진)', target: g };
  if (g.method === 'pact') { const vs = G.gens.filter(v => v.valve), left = vs.filter(v => v.alive); return left.length ? { text: '모래폭풍 속 밸브 잠그기 (협약 ' + (vs.length - left.length) + '/' + vs.length + ')', target: nearestOf(left) } : null; }
  if (g.method === 'hold') return { text: '제4조 단말기 원 안에서 버티기 · 쏘지 말고 연대 (' + Math.round(g.charge * 100) + '%)', target: g };
  if (g.method === 'run') {
    const R = G.core.run, sb = G.L.runStart;
    if (R.phase === 'count') return { text: '준비… 곧 출발해요!', target: null };
    if (R.phase === 'go') return { text: '차단막 틈으로 달려 제2조 단말기까지! (' + Math.ceil(R.t) + '초)', target: g };
    return { text: '출발선에 서면 달리기 시작! 제한 시간 안에 단말기까지 (완주)', target: { x: sb.x + sb.w / 2, y: sb.y + sb.h / 2 } };
  }
  return null;
}
// 비폭력 행진 중에는 나와 동료가 쏘지 않는다(파동은 탄을 지우고 밀어내기만)
function coreNoFire() {
  if (!G.L.sockets || G.zoneIdx !== 1) return false;
  const k = coreSock('k1'); return !!(k && k.alive && !k.ready);
}
// 퀴즈 시작: 노동·반전 평화 = 타이밍, 민권·여성 = 빈칸 채우기, 환경 = 사진 조각 맞추기(data.js chains의 quiz)
const movOfRecord = id => { const r = recordById(id), st = r && stageById(r.stage); return st ? st.movement : ''; };
const roleOf = (ch, it) => ch.order === 'year' ? it.year : it.role;
function puzzleRows(tiles) { return [0, 1, 2].map(r => [0, 1, 2].every(c => { const t = tiles[r * 3 + c]; return t.r === r && t.c === c; })); }
function startQuiz(g) {
  if (g.ready) return;
  g.ready = true;
  const ch = chainOf(g);
  if (!ch) { killGen(g); return; }
  burst(g.x, g.y - 50, C.mustard, 26, 260); Sound.play('good');
  const q = { g, ch, type: ch.quiz || 'blank', step: 0, miss: 0, t: 0, solvedT: null };
  G.quiz = q; G.quizT = 0; G.claimT = 0; ui.focus = 0;
  if (q.type === 'timing') {
    q.cards = shuffle(ch.items.concat(ch.decoys || [])).map(it => ({ it, got: false }));
    q.off = 0; q.v = 80; q.lock = 0; q.flash = null;
    G.mode = 'sockClaim';
  } else if (q.type === 'blank') {
    q.opts = shuffle([ch.items[ch.blank]].concat(ch.choices || [])); q.bad = {};
    G.mode = 'quizCard';
  } else {
    const tiles = []; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) tiles.push({ r, c });
    let arr, tries = 0; do { arr = shuffle(tiles); tries++; } while (tries < 50 && puzzleRows(arr).some(x => x));
    q.tiles = arr; q.sel = -1; q.done = puzzleRows(arr); q.hint = shuffle([0, 1, 2]);
    G.mode = 'quizCard';
  }
}
function finishQuiz() {
  const q = G.quiz; if (!q) return;
  G.stats.right++; gainXp(20);
  G.chainCard = { g: q.g, ch: q.ch }; G.chainT = 0; G.mode = 'chain'; ui.focus = 0;
  G.quiz = null;
}
function quizMiss(title, text) { const q = G.quiz; q.miss++; G.stats.wrong++; banner(title, text, C.bad, 4.5); Sound.play('bad'); }
// 타이밍: 카드가 오른쪽에서 왼쪽으로 지나간다. 화면 아래 가운데 칸(TICK)에 온 카드를 「파동」 버튼으로 고른다
const TICK = { x: W / 2 - 300, y: 512, w: 600, h: 136, gap: 150, win: 62 };
function tickerCards(q) {
  const n = q.cards.length, total = n * TICK.gap, left = W / 2 - total / 2;
  return q.cards.map((c, k) => ({ c, x: left + ((((k * TICK.gap - q.off) % total) + total) % total) }));
}
function updateQuiz(dt) {
  const q = G.quiz; if (!q) return;
  q.t += dt;
  if (q.type !== 'timing') return;
  q.off += q.v * dt; if (q.lock > 0) q.lock -= dt;
  if (q.flash) { q.flash.t -= dt; if (q.flash.t <= 0) q.flash = null; }
}
function quizPress() {
  const q = G.quiz; if (!q || q.type !== 'timing' || q.lock > 0 || G.P.dead) return;
  q.lock = 0.45;
  const hitc = tickerCards(q).find(p => Math.abs(p.x - W / 2) < TICK.win), c = hitc && hitc.c, want = q.ch.items[q.step];
  if (c && c.got) { addText(G.P.x, G.P.y - 70, '이미 고른 기록이에요', C.cream, 18); return; }
  if (c && c.it === want) {
    c.got = true; q.step++; q.v += 22; q.flash = { ok: true, t: 0.5 };
    addText(G.P.x, G.P.y - 70, roleOf(q.ch, want) + ' ✓', C.tealL, 22); Sound.play('pick');
    if (q.step >= q.ch.items.length) finishQuiz();
    return;
  }
  q.flash = { ok: false, t: 0.5 };
  const P = G.P; P.inv = 0; hurtPlayer(8, P.x, P.y - 30, true); P.inv = 1.0;
  if (!c) quizMiss('조금 일러요!', '카드가 가운데 칸에 들어왔을 때 눌러요');
  else if (q.ch.items.includes(c.it)) quizMiss('차례가 달라요!', '「' + c.it.label + '」은(는) ' + roleOf(q.ch, c.it) + ' 기록이에요. 지금은 ' + roleOf(q.ch, want) + ' 차례예요');
  else quizMiss('다른 운동의 기록이에요!', '「' + c.it.label + '」은(는) ' + movOfRecord(c.it.record) + ' 기록이에요. 지금은 ' + q.ch.mov + ' 운동의 ' + roleOf(q.ch, want) + ' 차례예요');
}
// 빈칸 채우기: 고른 보기가 맞으면 채워지고, 틀리면 흔들리며 이유 한 줄
function quizPickBlank(o) {
  const q = G.quiz; if (!q || q.solvedT != null) return;
  const ans = q.ch.items[q.ch.blank];
  if (o === ans) { q.solvedT = G.quizT; Sound.play('good'); return; }
  q.bad[o.label] = G.quizT; q.miss++; G.stats.wrong++; Sound.play('bad');
  const same = recordById(o.record) && recordById(ans.record) && recordById(o.record).stage === recordById(ans.record).stage;
  q.why = '「' + o.label + '」은(는) ' + (same && o.year ? o.year + ' 기록이에요. ' : movOfRecord(o.record) + ' 기록이에요. ') + blankHint(q.ch);
}
// 빈칸 자리에 맞는 기록을 찾는 실마리
function blankHint(ch) {
  const b = ch.blank, its = ch.items;
  if (ch.order !== 'year') return ch.mov + ' 운동의 ' + its[b].role + ' 기록을 찾아요';
  if (b === 0) return its[1].year + '년보다 먼저 일어난 ' + ch.mov + ' 운동 기록을 찾아요';
  if (b === its.length - 1) return its[b - 1].year + '년보다 뒤에 일어난 ' + ch.mov + ' 운동 기록을 찾아요';
  return its[b - 1].year + '년과 ' + its[b + 1].year + '년 사이에 일어난 ' + ch.mov + ' 운동 기록을 찾아요';
}
// 사진 조각: 하나를 누르고 다른 하나를 누르면 자리를 바꾼다. 줄이 맞으면 그 줄은 고정
function quizPickTile(i) {
  const q = G.quiz; if (!q || q.solvedT != null || q.done[Math.floor(i / 3)]) return;
  if (q.sel < 0) { q.sel = i; return; }
  if (q.sel === i) { q.sel = -1; return; }
  const a = q.sel; q.sel = -1;
  const t = q.tiles[a]; q.tiles[a] = q.tiles[i]; q.tiles[i] = t;
  const now = puzzleRows(q.tiles);
  now.forEach((d, r) => { if (d && !q.done[r]) { q.done[r] = true; Sound.play('pick'); } });
  if (q.done.every(x => x)) { q.solvedT = G.quizT; Sound.play('good'); }
}
function endChain() {
  if (G.mode !== 'chain' || G.chainT < 1) return;
  const c = G.chainCard; G.chainCard = null;
  G.mode = 'play'; G.P.inv = Math.max(G.P.inv, 1);
  if (c && c.g.alive) killGen(c.g);
}
function updateCore(dt) {
  if (!G.L.sockets) return;
  const P = G.P, L = G.L, C6 = G.core;
  updateQuiz(dt);
  // 행진하는 사람들: A-2에 들어서면 함께 걷는다
  const k1 = coreSock('k1');
  if (G.zoneIdx === 1 && k1.alive && !k1.ready && !C6.marchers) {
    C6.marchers = [['평등', 2], ['함께 걸어요', 4], ['차별 반대', 0]].map((m, i) => ({ x: P.x + (i - 1) * 40, y: P.y + 60, sign: m[0], look: LOOKS[m[1]], t: Math.random() * 5, ph: Math.random() * 5, aim: -Math.PI / 2, moving: false }));
    banner('비폭력 행진', '공격이 꺼져요. 쏘지 말고, 피하며 함께 걸어서 단말기까지 가요', C.tealL, 3.6);
  }
  if (C6.marchers) C6.marchers.forEach((m, i) => {
    const tp = G.trail[Math.max(0, G.trail.length - 1 - (i + 2) * 7)] || P;
    const tx = tp.x + (i - 1) * 44, ty = tp.y + 30;
    m.moving = dist(m.x, m.y, tx, ty) > 6; m.x = lerp(m.x, tx, Math.min(1, dt * 4)); m.y = lerp(m.y, ty, Math.min(1, dt * 4)); m.t += dt;
  });
  if (coreNoFire() && G.t - (C6.nfT || -9) > 3) { C6.nfT = G.t; addText(P.x, P.y - 70, '비폭력 행진 · 공격 꺼짐', C.tealL, 18); }
  for (const g of G.gens) {
    if (!g.socket || !g.alive || g.ready) continue;
    if (g.method === 'unity') {
      if (G.caps.filter(c => c.mod === 'labor').every(c => c.freed)) { banner('단결!', '세 사람이 함께해요. 노동 단말기가 열렸어요', C.tealL, 3); startQuiz(g); }
    } else if (g.method === 'march') {
      if (!P.dead && dist(P.x, P.y, g.x, g.y) < 100) {
        if (C6.marchers) { C6.marchers.forEach(m => { L.crowd.push({ x: m.x, y: m.y, look: m.look, aim: -Math.PI / 2, ph: m.ph, sign: m.sign }); addText(m.x, m.y - 90, '해냈다!', C.mustard, 18); }); C6.marchers = null; }
        startQuiz(g);
      }
    } else if (g.method === 'pact') {
      if (G.gens.filter(v => v.valve).every(v => !v.alive)) { banner('협약!', '네 돔이 함께 밸브를 잠갔어요. 환경 단말기가 열렸어요', C.tealL, 3); startQuiz(g); }
    } else if (g.method === 'hold') {
      g.inside = !P.dead && G.mode === 'play' && dist(P.x, P.y, g.x, g.y) < g.holdR;
      if (g.inside) g.charge = Math.min(1, g.charge + dt / L.holdTime * Math.min(1.8, 1 + 0.08 * G.settlers.length));
      else g.charge = Math.max(0, g.charge - dt * 0.05);
      if (g.charge >= 1) {
        const signs = ['평화', '전쟁 반대', '무기 말고 평화', '함께해요'];
        for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + 0.5; L.crowd.push({ x: g.x + Math.cos(a) * 170, y: g.y + 20 + Math.sin(a) * 110, look: LOOKS[(k * 2 + 1) % LOOKS.length], aim: Math.cos(a) > 0 ? Math.PI : 0, ph: Math.random() * 5, sign: signs[k] }); }
        banner('연대!', '두 돔 사람들이 함께 버텼어요. 반전 평화 단말기가 열렸어요', C.tealL, 3); startQuiz(g);
      }
    } else if (g.method === 'run') {
      const R = C6.run, sb = L.runStart;
      if (P.dead) { R.phase = 'idle'; continue; }
      const inBox = P.x > sb.x && P.x < sb.x + sb.w && P.y > sb.y && P.y < sb.y + sb.h;
      if (R.phase === 'idle') { if (inBox && G.mode === 'play') { R.phase = 'count'; R.t = 2.4; } }
      else if (R.phase === 'count') { R.t -= dt; if (R.t <= 0) { R.phase = 'go'; R.t = L.runLimit; addText(P.x, P.y - 70, '출발!', C.mustard, 30); } }
      else if (R.phase === 'go') {
        R.t -= dt;
        if (dist(P.x, P.y, g.x, g.y) < 100) { R.phase = 'done'; banner('완주!', '시간 안에 닿았어요. 여성 단말기가 열렸어요', C.tealL, 3); startQuiz(g); }
        else if (R.t <= 0) {
          R.phase = 'idle'; P.x = sb.x + sb.w / 2; P.y = sb.y + sb.h / 2; P.inv = 1.2; G.eB = [];
          G.settlers.forEach(s => { s.x = P.x; s.y = P.y + 20; });
          banner('시간 초과!', '출발선부터 다시 달려요. 노란 화살표를 따라 차단막의 틈으로!', C.bad, 3.5);
        }
      }
    }
  }
}
// 바닥: 행진 길, 원, 출발선, 기록 발판
function drawCoreFloor() {
  if (!G.L.sockets) return;
  const L = G.L, c = G.cam;
  const k1 = coreSock('k1');
  if (k1 && k1.alive && !k1.ready) {
    const ln = L.restrict.lane, y0 = 4616, y1 = 5600;
    if (y1 > c.y - 20 && y0 < c.y + H + 20) {
      ctx.fillStyle = 'rgba(43,196,180,0.08)'; ctx.fillRect(ln.x0, y0, ln.x1 - ln.x0, y1 - y0);
      ctx.strokeStyle = 'rgba(159,245,234,0.35)'; ctx.lineWidth = 3; ctx.setLineDash([16, 12]);
      ctx.beginPath(); ctx.moveTo(ln.x0 + 30, y1 - 20); ctx.lineTo(ln.x0 + 30, y0 + 20); ctx.moveTo(ln.x1 - 30, y1 - 20); ctx.lineTo(ln.x1 - 30, y0 + 20); ctx.stroke(); ctx.setLineDash([]);
      for (let y = y1 - 140; y > y0 + 100; y -= 260) txt('비폭력 행진 · 공격 꺼짐', (ln.x0 + ln.x1) / 2, y, 22, 'rgba(159,245,234,0.35)', 'center', { weight: 900 });
    }
  }
  const k4 = coreSock('k4');
  if (k4 && k4.alive && !k4.ready && Math.abs(k4.y - c.y - H / 2) < H) {
    ctx.save(); ctx.translate(k4.x, k4.y);
    ctx.fillStyle = k4.inside ? 'rgba(43,196,180,0.18)' : 'rgba(159,245,234,0.08)'; circle(0, 0, k4.holdR); ctx.fill();
    ctx.strokeStyle = 'rgba(159,245,234,0.8)'; ctx.lineWidth = 4; ctx.setLineDash([14, 10]); ctx.lineDashOffset = -G.t * 20; circle(0, 0, k4.holdR); ctx.stroke(); ctx.setLineDash([]);
    if (k4.charge > 0) { ctx.strokeStyle = C.tealL; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(0, 0, k4.holdR + 8, -Math.PI / 2, -Math.PI / 2 + TAU * k4.charge); ctx.stroke(); }
    txt('원 안에서 버티기 ' + Math.round(k4.charge * 100) + '%', 0, k4.holdR + 34, 18, C.tealL, 'center', { weight: 900, stroke: C.ink, sw: 5 });
    ctx.restore();
  }
  const k2 = coreSock('k2'), sb = L.runStart;
  if (k2 && k2.alive && !k2.ready && sb.y < c.y + H + 40 && sb.y + sb.h > c.y - 40) {
    const R = G.core.run;
    ctx.fillStyle = R.phase === 'idle' ? 'rgba(247,197,72,0.18)' : 'rgba(43,196,180,0.18)'; ctx.fillRect(sb.x, sb.y, sb.w, sb.h);
    checker(sb.x, sb.y, sb.w, 18, 9);
    txt(R.phase === 'idle' ? '출발선 · 여기에 서면 달리기 시작' : '출발선', sb.x + sb.w / 2, sb.y + 62, 22, C.amberL, 'center', { weight: 900, stroke: C.ink, sw: 5 });
  }
}
// 타이밍 퀴즈: 화면 아래 가운데의 카드 띠
function drawTicker() {
  const q = G.quiz; if (!q || q.type !== 'timing' || G.boss) return;
  const T = TICK, want = q.ch.items[q.step];
  panel(T.x, T.y, T.w, T.h, { fill: 'rgba(16,14,40,0.94)', stroke: C.mustard, r: 16, lw: 3 });
  txt('제' + q.g.socket + '조 · ' + q.ch.mov + '   지금 차례: ' + roleOf(q.ch, want), T.x + 16, T.y + 17, 16, C.amberL, 'left', { weight: 900 });
  q.ch.items.forEach((it, i) => {
    const x = T.x + T.w - 186 + i * 60, ok = i < q.step;
    rr(x, T.y + 6, 54, 22, 11); ctx.fillStyle = ok ? C.good : i === q.step ? C.mustard : 'rgba(255,244,220,0.15)'; ctx.fill();
    txt((ok ? '✓ ' : '') + (q.ch.order === 'year' ? (i + 1) + '번' : it.role), x + 27, T.y + 17, 12, ok || i === q.step ? C.ink : '#c9c2ef', 'center', { weight: 900 });
  });
  const sy = T.y + 34, sh = 96;
  ctx.save(); rr(T.x + 6, sy - 2, T.w - 12, sh + 4, 10); ctx.clip();
  ctx.fillStyle = 'rgba(40,36,80,0.9)'; ctx.fillRect(T.x, sy - 2, T.w, sh + 4);
  for (const p of tickerCards(q)) {
    if (p.x < T.x - 70 || p.x > T.x + T.w + 70) continue;
    const cx = p.x, it = p.c.it;
    ctx.globalAlpha = p.c.got ? 0.4 : 1;
    rr(cx - 60, sy + 2, 120, sh - 4, 10); ctx.fillStyle = '#fff3dc'; ctx.fill();
    ctx.save(); rr(cx - 56, sy + 6, 112, 54, 8); ctx.clip();
    const img = photoOf(it); if (img) drawCover(img, cx - 56, sy + 6, 112, 54); else { ctx.fillStyle = '#3b3570'; ctx.fillRect(cx - 56, sy + 6, 112, 54); }
    ctx.restore();
    const ls = wrap(it.label, 108, 13, 900).slice(0, 2);
    ls.forEach((l, j) => txt(l, cx, sy + 70 + j * 15 - (ls.length - 1) * 7, 13, C.ink, 'center', { weight: 900 }));
    if (p.c.got) txt('✓', cx, sy + 33, 34, C.good, 'center', { weight: 900, stroke: C.ink, sw: 5 });
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  const fl = q.flash, col = fl ? (fl.ok ? C.good : C.bad) : C.mustard;
  ctx.lineWidth = fl ? 7 : 5; ctx.strokeStyle = col; rr(W / 2 - 66, sy - 4, 132, sh + 8, 12); ctx.stroke();
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(W / 2 - 10, sy - 6); ctx.lineTo(W / 2 + 10, sy - 6); ctx.lineTo(W / 2, sy + 6); ctx.closePath(); ctx.fill();
}
// 타이밍 퀴즈를 시작하기 전 설명 카드
function drawSockClaim() {
  modalStart(); dim(0.74);
  const q = G.quiz, t = G.claimT; if (!q) return;
  const g = q.g, ch = q.ch;
  ctx.save(); ctx.globalAlpha = Math.min(1, t * 4);
  panel(150, 70, W - 300, 560, { fill: 'rgba(24,21,54,0.97)', stroke: C.mustard, r: 26, lw: 5 });
  txt('제' + g.socket + '조 단말기가 열렸어요! · ' + ch.mov, W / 2, 122, 30, C.tealL, 'center', { weight: 900, stroke: C.ink, sw: 6 });
  const ql = wrap('제' + g.socket + '조  ' + articleOf(g.socket).text, 840, 36, 900);
  rr(220, 156, W - 440, 34 + ql.length * 48, 20); ctx.fillStyle = 'rgba(60,46,20,0.95)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.mustard; ctx.stroke();
  ql.forEach((l, i) => txt(l, W / 2, 196 + i * 48, 36, C.amberL, 'center', { weight: 900, stroke: C.ink, sw: 6 }));
  const y2 = 206 + ql.length * 48 + 40;
  ['화면 아래에 기록 카드가 줄지어 지나가요.', '「문제 → 행동 → 제도」 차례에 맞는 카드가 가운데 칸에 오면', "'파동' 버튼을 눌러요 (키보드: E)", '다른 운동의 카드나 차례가 틀린 카드면 반격! 맞힐수록 빨라져요'].forEach((l, i) =>
    txt(l, W / 2, y2 + i * 40, i === 2 ? 28 : 24, i === 2 ? C.mustard : C.cream, 'center', { weight: 900 }));
  ctx.restore();
  if (t > 1.5) button(W / 2 - 170, 548, 340, 62, '시작!', () => { if (G.mode === 'sockClaim') { G.mode = 'play'; G.P.inv = Math.max(G.P.inv, 1); } }, { size: 28 });
}
// 빈칸 채우기·사진 조각 맞추기 카드(게임이 멈춘다)
function drawQuizCard() {
  modalStart(); dim(0.78);
  const q = G.quiz; if (!q) return;
  const ch = q.ch, g = q.g, t = G.quizT, a = Math.min(1, t * 4);
  ctx.save(); ctx.globalAlpha = a;
  panel(70, 28, W - 140, 664, { fill: 'rgba(24,21,54,0.97)', stroke: C.mustard, r: 26, lw: 5 });
  txt('제' + g.socket + '조 단말기가 열렸어요! · ' + ch.mov + ' — ' + articleOf(g.socket).text, W / 2, 70, 24, C.tealL, 'center', { weight: 900, stroke: C.ink, sw: 5 });
  ctx.restore();
  const imgOf = it => photoOf(it);
  const photoBox = (it, x, y, w, h) => { ctx.save(); rr(x, y, w, h, 10); ctx.clip(); const im = imgOf(it); if (im) drawCover(im, x, y, w, h); else { ctx.fillStyle = '#3b3570'; ctx.fillRect(x, y, w, h); } ctx.restore(); };
  if (q.type === 'blank') {
    txt(ch.order === 'year' ? '일어난 해 순서가 되도록, 빈칸에 들어갈 기록을 눌러요' : '정리표 한 줄의 빈칸에 들어갈 기록을 눌러요', W / 2, 112, 26, C.cream, 'center', { weight: 900 });
    const solved = q.solvedT != null;
    ch.items.forEach((it, i) => {
      const x = 150 + i * 340, y = 140, w = 300, blank = i === ch.blank && !solved;
      rr(x, y, w, 236, 16); ctx.fillStyle = blank ? 'rgba(247,197,72,0.1)' : 'rgba(10,30,30,0.85)'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = blank ? C.mustard : C.tealL; if (blank) ctx.setLineDash([12, 9]); rr(x, y, w, 236, 16); ctx.stroke(); ctx.setLineDash([]);
      txt(ch.order === 'year' ? (blank ? '?' : it.year) : it.role, x + w / 2, y + 26, 26, blank ? C.mustard : C.tealL, 'center', { weight: 900 });
      if (blank) txt('?', x + w / 2, y + 128, 80, C.mustard, 'center', { weight: 900, stroke: C.ink, sw: 8 });
      else { photoBox(it, x + 24, y + 48, w - 48, 132); txt(it.label, x + w / 2, y + 206, 22, C.cream, 'center', { weight: 900 }); }
      if (i < 2) txt('→', x + w + 20, y + 118, 36, C.mustard, 'center', { weight: 900 });
    });
    txt(solved ? '정답! 정리표 한 줄이 이어졌어요' : '아래 기록 중 하나를 골라요', W / 2, 410, 22, solved ? C.good : '#c9c2ef', 'center', { weight: 900 });
    q.ui = [];
    q.opts.forEach((o, i) => {
      const x = 190 + i * 310, y = 432, w = 280, h = 180, bt = q.bad[o.label], sh = bt != null && t - bt < 0.4 ? Math.sin((t - bt) * 60) * 8 * (1 - (t - bt) / 0.4) : 0;
      const isAns = o === ch.items[ch.blank];
      const st = button(x, y, w, h, '', () => quizPickBlank(o), { draw: false, disabled: solved });
      q.ui.push({ x, y, w, h, ok: isAns });
      rr(x + sh, y, w, h, 16); ctx.fillStyle = solved && isAns ? 'rgba(46,160,110,0.9)' : bt != null ? 'rgba(120,40,40,0.9)' : st.hot ? 'rgba(80,70,150,0.95)' : 'rgba(46,40,92,0.95)'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = bt != null ? C.bad : st.hot ? C.mustard : C.cream; rr(x + sh, y, w, h, 16); ctx.stroke();
      photoBox(o, x + sh + 20, y + 16, w - 40, 110);
      txt(o.label, x + sh + w / 2, y + 152, 21, C.cream, 'center', { weight: 900 });
    });
    if (q.why && !solved) { const ls = wrap(q.why, 1040, 19, 600); ls.forEach((l, i) => txt(l, W / 2, 636 + i * 24, 19, '#ffb3a3', 'center', { weight: 600 })); }
  } else {
    txt('사진 조각을 하나 누르고, 바꿀 조각을 또 눌러요. 문제 → 행동 → 제도 줄에 맞게 사진을 맞춰요', W / 2, 108, 21, C.cream, 'center', { weight: 900 });
    const gx = 300, gy = 136, tw = 200, th = 140, gap = 8;
    q.ui = [];
    ['문제', '행동', '제도'].forEach((rl, r) => {
      const y = gy + r * (th + gap);
      rr(gx - 120, y + th / 2 - 24, 104, 48, 24); ctx.fillStyle = q.done[r] ? C.good : 'rgba(255,244,220,0.12)'; ctx.fill();
      txt(rl, gx - 68, y + th / 2, 24, q.done[r] ? C.ink : C.cream, 'center', { weight: 900 });
    });
    q.tiles.forEach((tl, i) => {
      const r = Math.floor(i / 3), c = i % 3, x = gx + c * (tw + gap), y = gy + r * (th + gap), it = ch.items[tl.r];
      const st = button(x, y, tw, th, '', () => quizPickTile(i), { draw: false, disabled: q.done[r] || q.solvedT != null });
      q.ui.push({ x, y, w: tw, h: th, r: tl.r, c: tl.c });
      ctx.save(); rr(x, y, tw, th, 8); ctx.clip();
      const im = imgOf(it); if (im) drawCover(im, x - tl.c * tw, y, tw * 3, th); else { ctx.fillStyle = ['#5a3b70', '#3b5a70', '#705a3b'][tl.r]; ctx.fillRect(x, y, tw, th); txt(it.label, x + tw / 2 - tl.c * 0, y + th / 2, 18, C.cream, 'center'); }
      ctx.restore();
      ctx.lineWidth = q.sel === i ? 6 : 2; ctx.strokeStyle = q.sel === i ? C.mustard : q.done[r] ? C.good : st.hot ? C.cream : 'rgba(255,244,220,0.4)'; rr(x, y, tw, th, 8); ctx.stroke();
    });
    // 줄이 맞으면 오른쪽에 그 기록의 이름과 한 줄
    ['문제', '행동', '제도'].forEach((rl, r) => {
      if (!q.done[r]) return;
      const it = ch.items[r], y = gy + r * (th + gap), x = gx + 3 * (tw + gap) + 6;
      txt(it.label + ' ✓', x, y + th / 2 - 14, 20, C.good, 'left', { weight: 900 });
      wrap(it.line || '', 200, 15, 600).slice(0, 2).forEach((l, j) => txt(l, x, y + th / 2 + 12 + j * 19, 15, '#c8f5ee', 'left', { weight: 600 }));
    });
    // 아래: 이 줄의 기록 세 장(차례는 섞여 있다). 어느 것이 문제·행동·제도인지 생각해서 맞춘다
    txt('이 운동의 기록 (차례는 섞여 있어요)', 150, 606, 17, C.mustard, 'left', { weight: 900 });
    q.hint.forEach((r, k) => {
      const it = ch.items[r], x = 150 + k * 340, y = 622;
      ctx.save(); rr(x, y, 70, 44, 6); ctx.clip(); const im = imgOf(it); if (im) drawCover(im, x, y, 70, 44); else { ctx.fillStyle = '#3b3570'; ctx.fillRect(x, y, 70, 44); } ctx.restore();
      ctx.lineWidth = 2; ctx.strokeStyle = q.done[r] ? C.good : 'rgba(255,244,220,0.5)'; rr(x, y, 70, 44, 6); ctx.stroke();
      txt(it.label + (q.done[r] ? ' ✓' : ''), x + 82, y + 22, 19, q.done[r] ? C.good : C.cream, 'left', { weight: 900 });
    });
    txt(q.solvedT != null ? '세 장면이 모두 맞았어요!' : '맞춘 줄은 초록으로 고정돼요', 1130, 606, 16, q.solvedT != null ? C.good : '#c9c2ef', 'right', { weight: 900 });
  }
}
// 퀴즈를 풀면: 정리표 한 줄(문제 → 행동 → 제도)을 크게 보여 주고 카드를 꽂는다
function drawChainCard() {
  modalStart(); dim(0.74);
  const c = G.chainCard, t = G.chainT; if (!c) return;
  const ch = c.ch, g = c.g, pop = Math.min(1, t * 4);
  ctx.save(); ctx.globalAlpha = pop;
  panel(90, 54, W - 180, 600, { fill: 'rgba(16,40,38,0.97)', stroke: C.good, r: 26, lw: 5 });
  const sc = 1 + Math.max(0, 0.3 - t) * 1.5;
  ctx.save(); ctx.translate(W / 2, 112); ctx.scale(sc, sc); txt('정리표 한 줄 완성!', 0, 0, 52, C.good, 'center', { weight: 900, stroke: C.ink, sw: 9 }); ctx.restore();
  txt(ch.mov + ' · 제' + g.socket + '조 ' + articleOf(g.socket).text, W / 2, 168, 24, C.amberL, 'center', { weight: 900 });
  ch.items.forEach((it, i) => {
    const x = 150 + i * 340, y = 210, w = 300;
    rr(x, y, w, 330, 18); ctx.fillStyle = 'rgba(10,30,30,0.85)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.tealL; ctx.stroke();
    txt(ch.order === 'year' ? it.year : it.role, x + w / 2, y + 30, 28, C.tealL, 'center', { weight: 900 });
    ctx.save(); rr(x + 30, y + 54, w - 60, 150, 12); ctx.clip();
    const img = photoOf(it); if (img) drawCover(img, x + 30, y + 54, w - 60, 150); else { ctx.fillStyle = '#3b3570'; ctx.fillRect(x + 30, y + 54, w - 60, 150); }
    ctx.restore();
    txt(it.label, x + w / 2, y + 232, 22, C.cream, 'center', { weight: 900 });
    wrap(it.line || '', w - 30, 17, 600).slice(0, 3).forEach((l, j) => txt(l, x + w / 2, y + 266 + j * 24, 17, '#c8f5ee', 'center', { weight: 600 }));
    if (i < 2) txt('→', x + w + 20, y + 130, 36, C.mustard, 'center', { weight: 900 });
  });
  ctx.restore();
  if (t > 1) button(W / 2 - 170, 568, 340, 64, '카드 꽂기!', () => endChain(), { size: 30 });
}
function updateCardFly(dt) { const f = G.cardFly; if (!f) return; f.t += dt; if (f.t > 0.75) G.cardFly = null; }
// 작은 제도 카드(단말기에 꽂힌 것, 날아가는 것)
function drawMiniCard(x, y, s, n) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineJoin = 'round';
  ctx.fillStyle = 'rgba(247,197,72,0.35)'; rr(-22, -28, 44, 56, 8); ctx.fill();
  ctx.fillStyle = '#fff3dc'; rr(-17, -23, 34, 46, 5); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.mustard; ctx.stroke();
  ctx.lineWidth = 1.5; ctx.strokeStyle = C.ink; rr(-17, -23, 34, 46, 5); ctx.stroke();
  txt('제' + n + '조', 0, 1, 12, C.ink, 'center', { weight: 900 });
  ctx.restore();
}
function drawCardFly() {
  const f = G.cardFly; if (!f) return;
  const k = Math.min(1, f.t / 0.6), e = 1 - Math.pow(1 - k, 3);
  const x = lerp(f.x0, f.x1, e), y = lerp(f.y0, f.y1, e) - Math.sin(k * Math.PI) * 120;
  drawMiniCard(x, y, 1.4 - 0.5 * e, f.n);
}
function drawSocket(g) {
  const on = !g.alive, n = g.socket, card = cardById(g.card) || { name: '' };
  const z = G.zones[G.zoneIdx], target = !on && z && wallById(z.exit).gens.includes(g.id);
  ctx.save(); ctx.translate(g.x + (g.hitT > 0 ? rand(-2, 2) : 0), g.y);
  ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = C.ink;
  if (on) { ctx.strokeStyle = 'rgba(159,245,234,' + (0.45 + 0.3 * Math.sin(G.t * 4 + n)).toFixed(3) + ')'; ctx.lineWidth = 5; ellipse(0, 12, 66, 22); ctx.stroke(); ctx.strokeStyle = C.ink; ctx.lineWidth = 3; }
  ctx.fillStyle = 'rgba(10,8,30,0.35)'; ellipse(0, 18, 50, 14); ctx.fill();
  ctx.fillStyle = '#3a3566'; rr(-44, 0, 88, 24, 9); ctx.fill(); ctx.stroke();
  ctx.fillStyle = on ? '#e8fbf6' : g.hitT > 0 ? '#fff' : '#efe6d6'; rr(-30, -86, 60, 92, 12); ctx.fill(); ctx.stroke();
  ctx.fillStyle = on ? '#1d5b55' : '#2a2350'; rr(-22, -76, 44, 32, 6); ctx.fill(); ctx.stroke();
  txt('제' + n + '조', 0, -60, 15, on ? C.tealL : C.amberL, 'center', { weight: 900 });
  ctx.fillStyle = '#1a1734'; rr(-24, -96, 48, 10, 4); ctx.fill(); ctx.stroke();
  if (on) {
    const k = clamp((G.t - (g.insertT || -9) - 0.55) / 0.25, 0, 1);
    if (k > 0) { ctx.globalAlpha = k; drawMiniCard(0, -112, 0.9, n); ctx.globalAlpha = 1; }
    ctx.fillStyle = C.good; circle(0, -26, 9); ctx.fill(); ctx.lineWidth = 2.4; ctx.stroke();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(-4, -26); ctx.lineTo(-1, -22); ctx.lineTo(5, -30); ctx.stroke();
  } else if (g.ready) {
    // 열렸다: 기록 발판을 순서대로 밟는 중
    ctx.strokeStyle = 'rgba(247,197,72,' + (0.55 + 0.35 * Math.sin(G.t * 6)).toFixed(3) + ')'; ctx.lineWidth = 5; circle(0, -44, 60); ctx.stroke();
    txt('?', 0, -24, 26, C.mustard, 'center', { weight: 900, stroke: C.ink, sw: 5 });
  } else {
    // 잠김: 그 운동의 방법으로만 열린다
    const pulse = 1 + Math.sin(G.t * 5 + g.x) * 0.06;
    ctx.strokeStyle = 'rgba(255,177,46,0.9)'; ctx.lineWidth = 4; ctx.setLineDash([10, 7]); ctx.lineDashOffset = -G.t * 25; circle(0, -44, 58 * pulse); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = C.amber; ctx.strokeStyle = C.ink; ctx.lineWidth = 2.4; rr(-11, -32, 22, 17, 4); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -32, 7, Math.PI, 0); ctx.stroke();
  }
  if (g.icon) { ctx.restore(); return; }
  const how = { unity: '단결: 세 사람을 풀어 줘요', march: '비폭력 행진: 걸어서 닿아요', pact: '협약: 밸브 네 개를 잠가요', hold: '연대: 원 안에서 버텨요', run: '완주: 시간 안에 달려와요' }[g.method] || '';
  const label = on ? '제' + n + '조 입력 ✓ 「' + card.name + '」' : g.ready ? g.name + ' · 기록 발판을 밟아요' : g.name + ' · ' + how;
  setFont(14, 600); const tw = ctx.measureText(label).width + 18, ly = on ? -158 : -140;
  rr(-tw / 2, ly - 10, tw, 20, 10); ctx.fillStyle = on ? 'rgba(20,70,60,0.95)' : target ? C.mustard : 'rgba(27,24,56,0.88)'; ctx.fill();
  txt(label, 0, ly, 14, on ? '#c8ffe4' : target ? C.ink : C.cream, 'center', { weight: 600 });
  ctx.restore();
}
// 헌장 문: 제도 카드 5장을 모두 꽂으면 열린다
function drawCharterGate(w) {
  const a = w.active ? 1 : Math.max(0, w.fade); if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(247,197,72,0.2)'; ctx.fillRect(w.x, w.y - 14, w.w, w.h + 28);
  ctx.fillStyle = 'rgba(255,220,130,0.8)'; ctx.fillRect(w.x, w.y, w.w, w.h);
  ctx.fillStyle = 'rgba(255,255,255,' + (0.6 + 0.3 * Math.sin(G.t * 6)) + ')'; ctx.fillRect(w.x, w.y + w.h / 2 - 2, w.w, 4);
  if (w.active) {
    const n = G.sockets || 0;
    rr(w.x + w.w / 2 - 230, w.y + 26, 460, 40, 20); ctx.fillStyle = 'rgba(50,38,16,0.92)'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = C.mustard; ctx.stroke();
    txt('헌장 문 · 제도 카드 ' + n + '/5 꽂으면 열려요', w.x + w.w / 2, w.y + 47, 20, C.amberL, 'center', { weight: 900 });
  }
  ctx.restore();
}
// 종장에서 다시 켜진 다섯 문제(앞 스테이지 순서)와 오더 본체 둘레의 문양
const PROBS = [['lane', '분리선'], ['bar', '출전 금지'], ['belt', '24시간'], ['arms', '무기'], ['storm', '모래폭풍']];
function drawProblemGlyph(k, x, y, s, hot) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
  if (k === 'lane') {
    ctx.fillStyle = hot ? 'rgba(255,177,46,0.95)' : 'rgba(159,245,234,0.9)'; ctx.fillRect(-4, -13, 8, 26);
    ctx.fillStyle = '#fff4dc'; ctx.fillRect(-1, -13, 2, 26);
    ctx.fillStyle = C.cream; circle(-10, 4, 4); ctx.fill(); circle(10, 4, 4); ctx.fill();
  } else if (k === 'bar') {
    ctx.save(); ctx.beginPath(); ctx.rect(-14, -5, 28, 10); ctx.clip();
    ctx.fillStyle = hot ? '#e0573e' : C.good; ctx.fillRect(-14, -5, 28, 10); ctx.fillStyle = '#fff4dc';
    for (let xx = -20; xx < 16; xx += 9) { ctx.beginPath(); ctx.moveTo(xx, 5); ctx.lineTo(xx + 4, 5); ctx.lineTo(xx + 9, -5); ctx.lineTo(xx + 5, -5); ctx.closePath(); ctx.fill(); }
    ctx.restore(); ctx.strokeRect(-14, -5, 28, 10);
  } else if (k === 'belt') {
    ctx.fillStyle = '#f1e8d8'; circle(0, 0, 11); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = hot ? C.red : C.teal; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -7); ctx.moveTo(0, 0); ctx.lineTo(5, 3); ctx.stroke();
  } else if (k === 'arms') {
    ctx.fillStyle = hot ? '#e8e2d6' : '#9a96b8'; rr(-2, -10, 14, 6, 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = hot ? C.cream : '#8f8bb0'; circle(-3, 2, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = hot ? C.red : '#4d4777'; circle(-3, 2, 3); ctx.fill();
  } else if (k === 'storm') {
    ctx.strokeStyle = hot ? '#f0b080' : C.tealL; ctx.lineWidth = 2.6;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-12, -7 + i * 7); ctx.quadraticCurveTo(-3, -11 + i * 7, 3, -7 + i * 7); ctx.quadraticCurveTo(8, -3 + i * 7, 12, -7 + i * 7); ctx.stroke(); }
  }
  ctx.restore();
}
function drawCoreIcon(k, x, y) {
  if (k === 'pad') {
    [-34, 0, 34].forEach((dx, i) => { rr(x + dx - 13, y - 12, 26, 32, 5); ctx.fillStyle = i === 1 ? 'rgba(247,197,72,0.25)' : '#fff3dc'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = i === 1 ? C.mustard : C.tealL; if (i === 1) ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]); });
    txt('?', x, y + 4, 18, C.mustard, 'center', { weight: 900 });
    txt('→', x - 17, y + 4, 12, C.cream, 'center', { weight: 900 }); txt('→', x + 17, y + 4, 12, C.cream, 'center', { weight: 900 });
    txt('문제 행동 제도', x, y + 30, 11, C.cream, 'center', { weight: 600 });
    return;
  }
  if (k === 'socket') { ctx.save(); ctx.translate(x, y + 34); ctx.scale(0.5, 0.5); drawSocket({ x: 0, y: 0, alive: true, hitT: 0, hp: 1, maxHp: 1, socket: 1, card: 'civil1964', id: '', icon: true }); ctx.restore(); return; }
  ctx.save();
  ctx.fillStyle = 'rgba(247,197,72,0.25)'; ctx.fillRect(x - 46, y + 4, 92, 22); ctx.fillStyle = 'rgba(255,220,130,0.85)'; ctx.fillRect(x - 46, y + 10, 92, 10);
  for (let i = 0; i < 5; i++) drawMiniCard(x - 36 + i * 18, y - 12, 0.5, i + 1);
  ctx.restore();
}
// 왼쪽 위: 수업 정리표(종장에서 만나는 순서). 카드를 꽂은 줄은 「문제 → 행동 → 제도」가 채워진다
function drawCoreHud() {
  const chains = G.def.chains || [], fz = G.L.fatigue, showF = mech('belt') && G.zoneIdx === fz.zone;
  const rowH = 24, h = 34 + chains.length * rowH + (showF ? 30 : 6);
  const sockOf = c => G.gens.find(x => x.socket === c.article);
  const done = chains.filter(c => { const g = sockOf(c); return g && !g.alive; }).length, all = done >= chains.length, cs = curSock();
  panel(14, 110, 340, h, { fill: 'rgba(24,21,54,0.9)', stroke: all ? C.good : '#f0a070', r: 16, lw: 2 });
  txt('수업 정리표 · 문제 → 행동 → 제도   ' + done + '/' + chains.length, 184, 128, 15, all ? '#c8ffe4' : '#ffd9b8', 'center', { weight: 900 });
  chains.forEach((c, i) => {
    const y = 154 + i * rowH, g = sockOf(c), ok = g && !g.alive, cur = g && g === cs;
    rr(22, y - 10, 66, 20, 10); ctx.fillStyle = ok ? C.good : cur ? C.mustard : 'rgba(160,50,50,0.9)'; ctx.fill();
    setFont(12, 900); const fs = Math.min(12, 12 * 58 / ctx.measureText(c.mov).width);
    txt(c.mov, 55, y, fs, ok || cur ? C.ink : '#ffe2dc', 'center', { weight: 900 });
    const line = ok ? c.items.map(it => it.label).join(' → ') : '?   →   ?   →   ?';
    setFont(12, 600); const wpx = ctx.measureText(line).width, fs2 = wpx > 248 ? Math.max(9, 12 * 248 / wpx) : 12;
    txt(line, 96, y, fs2, ok ? C.cream : 'rgba(255,244,220,0.45)', 'left', { weight: 600 });
  });
  if (showF) {
    const f = G.fatigue || 0, full = f >= 1, fy = 110 + h - 20;
    txt('피로', 30, fy, 14, '#e3c8ff', 'left', { weight: 900 });
    rr(72, fy - 7, 268, 14, 7); ctx.fillStyle = 'rgba(10,8,30,0.8)'; ctx.fill();
    if (f > 0.005) { rr(72, fy - 7, 268 * f, 14, 7); ctx.fillStyle = full ? C.bad : '#b98cff'; ctx.fill(); }
  }
  // 완주: 출발 신호와 남은 시간
  const R = G.core && G.core.run;
  if (R && (R.phase === 'count' || R.phase === 'go') && !G.boss) {
    panel(W / 2 - 170, 74, 340, 50, { fill: 'rgba(24,21,54,0.95)', stroke: R.phase === 'go' && R.t < 6 ? C.bad : C.mustard, r: 25, lw: 3 });
    if (R.phase === 'count') txt('준비… ' + Math.ceil(R.t), W / 2, 99, 28, C.amberL, 'center', { weight: 900 });
    else {
      txt('완주 남은 시간 ' + R.t.toFixed(1) + '초', W / 2, 94, 22, R.t < 6 ? '#ffb3a3' : C.amberL, 'center', { weight: 900 });
      rr(W / 2 - 140, 108, 280, 8, 4); ctx.fillStyle = 'rgba(10,8,30,0.8)'; ctx.fill();
      rr(W / 2 - 140, 108, 280 * clamp(R.t / G.L.runLimit, 0, 1), 8, 4); ctx.fillStyle = R.t < 6 ? C.bad : C.mustard; ctx.fill();
    }
  }
}
function updateNpcs(dt) {
  if (G.arenaLock) return;
  for (const n of G.npcs) {
    n.t += dt;
    if (n.post && mech(n.mech || 'belt')) {
      // 자리를 뜨지 못하고 일한다
      n.moving = false; n.sayT = (n.sayT == null ? rand(0.6, 3.5) : n.sayT) - dt;
      if (n.sayT <= 0) { n.sayT = rand(4, 7); if (dist(n.x, n.y, G.P.x, G.P.y) < 420) addText(n.x, n.y - 54, pick(n.say || ['쉬게 해 주세요!', '쉬고 싶어요…', '졸려요…', '언제 쉬어요?']), n.say ? '#ffd9b8' : '#e3c8ff', 19); }
      continue;
    }
    if (n.wait > 0) { n.wait -= dt; n.moving = false; continue; }
    const d = dist(n.x, n.y, n.tx, n.ty);
    if (d < 6) { const nb = n.nb || G.L.npcBounds || { x0: 100, x1: 960, y0: 1880, y1: 3760 }; n.wait = rand(1, 3); n.tx = clamp(n.x + rand(-220, 220), nb.x0, nb.x1); n.ty = clamp(n.y + rand(-220, 220), nb.y0, nb.y1); continue; }
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
/* ----- 스테이지 시작 전 상황 컷 ----- */
function nextCut() { G.cutI++; G.cutT = 0; G.cutFull = false; if (G.cutI >= G.def.intro.length) endCuts(); }
function endCuts() { if (G.mode !== 'intro') return; G.cutI = Math.min(G.cutI, G.def.intro.length - 1); G.mode = 'brief'; G.briefT = 0; ui.focus = 0; }
function drawStageIntro() {
  const cut = G.def.intro[G.cutI], t = G.cutT;
  if (IMG[cut.img]) drawCover(IMG[cut.img], 0, 0, W, H, 1.02 + t * 0.006);
  else drawMarsScene(G.t, { laser: false, eyeColor: null });
  const bx = 70, bw = W - 140, bh = 148, by = H - bh - 44, size = 30, lh = 46;
  const gr = ctx.createLinearGradient(0, by - 90, 0, H); gr.addColorStop(0, 'rgba(12,10,30,0)'); gr.addColorStop(0.45, 'rgba(12,10,30,0.6)'); gr.addColorStop(1, 'rgba(12,10,30,0.85)');
  ctx.fillStyle = gr; ctx.fillRect(0, by - 90, W, H - by + 90);
  panel(bx, by, bw, bh, { fill: 'rgba(16,13,38,0.95)', stroke: 'rgba(255,244,220,0.9)', r: 22 });
  const rich = richText(cut.text);
  const n = G.cutFull ? rich.plain.length : Math.min(rich.plain.length, Math.floor(t * 40));
  const nLines = Math.min(2, wrap(rich.plain, bw - 110, size, 600).length);
  drawRich(rich, n, bx + 55, nLines === 1 ? by + bh / 2 : by + bh / 2 - lh / 2, bw - 110, size, lh, C.cream, C.mustard);
  const label = 'STAGE ' + G.def.id + ' · ' + G.def.name; setFont(24, 900); const tw = ctx.measureText(label).width + 44;
  panel(24, 24, tw, 48, { fill: 'rgba(27,24,56,0.92)', stroke: C.mustard, r: 24, lw: 3 }); txt(label, 24 + tw / 2, 49, 24, C.amberL, 'center', { weight: 900 });
  if (G.cutFull) txt('▼', bx + bw - 40, by + bh - 28 + Math.sin(G.t * 6) * 3, 20, C.mustard, 'center');
  button(W - 190, 24, 166, 48, '건너뛰기 ▶▶', () => endCuts(), { size: 18, focusable: false });
  txt('화면을 눌러 다음 (키보드: Enter)', W / 2, H - 20, 16, 'rgba(255,244,220,0.8)', 'center', { weight: 600 });
}
function drawStage() {
  if (G.mode === 'intro') { drawStageIntro(); return; }
  const P = G.P, cam = G.cam;
  const sx = G.shake > 0 ? rand(-G.shake, G.shake) * 0.6 : 0, sy = G.shake > 0 ? rand(-G.shake, G.shake) * 0.6 : 0;
  ctx.save(); ctx.translate(sx, sy);
  drawFloor(cam);
  ctx.save(); ctx.translate(-Math.round(cam.x), -Math.round(cam.y));
  drawWorldDecor();
  const vis = (x, y, m) => x > cam.x - m && x < cam.x + W + m && y > cam.y - m && y < cam.y + H + m;
  for (const g of G.gens) if (vis(g.x, g.y, 200)) drawGenLinks(g);
  for (const w of G.walls) drawWall(w);
  drawBarGaps();
  for (const c of G.chips) if (!c.got && vis(c.x, c.y, 60)) {
    drawChipIcon(c.x, c.y + Math.sin(c.t * 3) * 4, 1, G.t);
    if (dist(c.x, c.y, P.x, P.y) < 340) { setFont(13, 600); const tw = ctx.measureText('기록 칩').width + 16; rr(c.x - tw / 2, c.y + 18, tw, 18, 9); ctx.fillStyle = 'rgba(27,24,56,0.85)'; ctx.fill(); txt('기록 칩', c.x, c.y + 27, 13, C.tealL, 'center', { weight: 600 }); }
  }
  for (const gm of G.gems) if (vis(gm.x, gm.y, 20)) { ctx.save(); ctx.translate(gm.x, gm.y); ctx.rotate(G.t * 3); ctx.fillStyle = C.tealL; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(5, 0); ctx.lineTo(0, 6); ctx.lineTo(-5, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
  for (const c of G.caps) if (vis(c.x, c.y, 80)) drawCapsule(c);
  for (const g of G.gens) if (vis(g.x, g.y, 160)) { if (isTargetGen(g) && !g.tower) drawTargetRing(g); drawGen(g); }
  if (G.boss && !G.boss.dead) drawBoss(G.boss);
  const actors = [];
  for (const e of G.enemies) if (vis(e.x, e.y, 60)) actors.push({ y: e.y, f: () => drawEnemy(e, G.t) });
  G.settlers.forEach(s => actors.push({ y: s.y, f: () => drawChibi(s.x, s.y, s.t, s.moving, s.aim, s.look, { scale: 1.1, noPack: true }) }));
  G.npcs.forEach(n => { if (vis(n.x, n.y, 60)) actors.push({ y: n.y, f: () => drawChibi(n.x, n.y, n.t, n.moving, n.aim || 0, n.look, { scale: 1.1, noPack: true, closed: !!(n.post && mech(n.mech || 'belt')) }) }); });
  G.runners.forEach(r => { if (vis(r.x, r.y, 60)) actors.push({ y: r.y, f: () => drawChibi(r.x, r.y, r.t, r.moving, -Math.PI / 2, r.look, { scale: 1.1, noPack: true, bib: r.bib }) }); });
  (G.L.crowd || []).forEach(c => { if (vis(c.x, c.y, 80)) actors.push({ y: c.y, f: () => { drawChibi(c.x, c.y, G.t + c.ph, false, c.aim, c.look, { scale: 1.1, noPack: true }); if (c.sign) drawSign(c); } }); });
  ((G.core && G.core.marchers) || []).forEach(m => { if (vis(m.x, m.y, 80)) actors.push({ y: m.y, f: () => { drawChibi(m.x, m.y, m.t, m.moving, -Math.PI / 2, m.look, { scale: 1.1, noPack: true }); drawSign(m); } }); });
  if (!P.dead) actors.push({ y: P.y, f: drawPlayer });
  actors.sort((a, b) => a.y - b.y).forEach(a => a.f());
  drawGuide();
  if (G.boss && !G.boss.dead) { drawLasers(G.boss); G.boss.orbs.forEach(drawOrb); }
  for (const b of G.pB) drawWaveShot(b);
  drawCardFly();
  for (const s of G.shells || []) if (s.t >= 0 && vis(s.x, s.y, 120)) drawShell(s);
  if (G.residualOrb) drawResidualOrb();
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
  if (G.nightA > 0.004) { ctx.fillStyle = 'rgba(8,10,52,' + G.nightA.toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
  drawStorm();
  drawOffscreenTargets();
  drawHUD();
  if (G.mode === 'notice') drawNotice();
  else if (G.mode === 'brief') drawBrief();
  else if (G.mode === 'rules') drawRules();
  else if (G.mode === 'bossIntro') drawBossIntro();
  else if (G.mode === 'record') drawRecordCard();
  else if (G.mode === 'claim') drawClaimCard();
  else if (G.mode === 'rebut') drawRebutCard();
  else if (G.mode === 'sockClaim') drawSockClaim();
  else if (G.mode === 'chain') drawChainCard();
  else if (G.mode === 'quizCard') drawQuizCard();
  else if (G.mode === 'down') drawDown();
  else if (G.mode === 'levelup') drawLevelUp();
  else if (G.mode === 'pause') drawPause();
  else if (G.mode === 'clear') drawClear();
  else if (G.mode === 'gameover') drawGameOver();
}
function guideGoal() {
  const P = G.P;
  if (G.boss || P.dead || G.mode !== 'play') return null;
  if (workOn()) { const tg = G.work.carry ? G.L.work.to : G.L.work.from; return { x: tg.x, y: tg.y, near: true }; }
  if (G.L.sockets) { const co = coreObjective(); if (co) return co.target ? { x: co.target.x, y: co.target.y, near: true } : null; }
  if (G.coach) { const st = G.coach.steps[G.coach.step]; if (st && st.target) { const t = st.target(); if (t) return { x: t.x, y: t.y, near: true }; } }
  if (G.race && G.race.on) { const g = nextGap(); if (g) return { x: g.x, y: g.y, near: true }; }
  if (unityNeed()) { const c = nearestOf(G.caps.filter(c => !c.freed)); if (c) return { x: c.x, y: c.y, near: true }; }
  if (restNudge()) { const r = nearestOf(G.L.rests.map(r => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 }))); return { x: r.x, y: r.y, near: true }; }
  const z = G.zones[G.zoneIdx];
  if (!z) { if (recordGateNeeded()) { const c = nearestChipTarget(); if (c) return { x: c.x, y: c.y }; } return { x: 800, y: 640 }; }
  const w = wallById(z.exit);
  if (w.active) {
    let best = null, bd = 1e9;
    const sockFirst = G.gens.some(g => g.alive && g.socket && w.gens.includes(g.id));
    G.gens.forEach(g => { if (g.alive && w.gens.includes(g.id) && (!sockFirst || g.socket)) { const d = dist(P.x, P.y, g.x, g.y); if (d < bd) { bd = d; best = g; } } });
    // 모래폭풍 속에서는 가까이 가도 안 보이니 화살표를 더 오래 보여 준다
    const stormy = G.storm && G.storm.k > 0.5;
    return best && bd > (best.tower ? best.zone * 0.75 : stormy ? 130 : 420) ? { x: best.x, y: best.y, near: !!best.tower || stormy } : null;
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
  const ln = G.L.restrict && G.L.restrict.lane;
  if (mech('lane') && ln && x < ln.x0 - 16) return false;
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
// 출전 금지 차단막이 나와 목표 사이를 막고 있으면, 가장 가까운 줄의 틈으로 먼저 안내한다(종장 A)
function viaGap(tx, ty) {
  const P = G.P, gs = G.L.barGaps; if (!gs || !mech('bar') || G.race) return null;
  const lane = mech('lane') && G.L.restrict.lane;
  let best = null, bs = 1e9;
  for (const g of gs) {
    const w = wallById(g.wall); if (!w || !w.active) continue;
    if (g.y <= Math.min(P.y, ty) || g.y >= Math.max(P.y, ty)) continue;
    if (lane && (g.x >= lane.x0) !== (P.x >= lane.x0)) continue;
    const sc = Math.abs(g.y - P.y) * 3 + dist(P.x, P.y, g.x, g.y);
    if (sc < bs) { bs = sc; best = g; }
  }
  return best && { x: best.x, y: best.y + (ty < P.y ? -30 : 30), near: true };
}
function routeGoal() { const g = guideGoal(); if (!g) return null; return viaGap(g.x, g.y) || g; }
function drawGuide() {
  const g = routeGoal(), P = G.P;
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
  drawHeroAt(P.x, P.y, P.aim, P.t, P.moving, Math.max(0, P.glow), G.L.restrict && G.L.restrict.kind === 'race' && !G.restricted ? { bib: 26 } : (G.L.fatigue && mech('belt') && G.fatigue >= 1 ? { closed: true } : null));
  ctx.globalAlpha = 1;
  if (G.work && G.work.carry) drawTank(P.x, P.y - 62);
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
  if (L.lake) drawLake(L.lake);
  if (L.track) drawTrack(L.track);
  for (const r of L.rocks || []) drawRock(r);
  for (const p of L.pads || []) drawPad(p);
  for (const pp of L.pipes || []) drawPipe(pp);
  for (const b of L.belts || []) drawBelt(b);
  for (const i of L.islands || []) drawIsland(i);
  for (const pr of L.presses || []) drawPress(pr);
  for (const r of L.rests || []) drawRest(r);
  if (L.work) drawWork();
  for (const b of L.boosts || []) drawBoost(b);
  if (L.deadDivider) drawDeadDivider(L.deadDivider);
  if (L.pen) drawPen(L.pen);
  drawCoreFloor();
  if (L.restrict && mech('lane') && L.restrict.lane) {
    const ln = L.restrict.lane;
    ctx.fillStyle = 'rgba(25,10,40,0.32)'; ctx.fillRect(ln.x0, ln.y0, ln.x1 - ln.x0, ln.y1 - ln.y0);
  }
  G.zones.forEach((z, i) => txt((z.tag || ['A', 'B', 'C'][i]) + ' 구역', 800, z.y1 - 70, 60, 'rgba(255,244,220,0.12)', 'center', { weight: 900 }));
  if (L.laneSigns) {
    const sg = G.def.signs;
    L.laneSigns.forEach(ls => {
      const merged = !mech('lane');
      const label = merged ? sg.merged : (ls.side === 'left' ? sg.left + ' 전용' : sg.right + ' 구역');
      const good = ls.side === 'left';
      ctx.save(); ctx.translate(ls.x, ls.y);
      rr(-130, -34, 260, 68, 14); ctx.fillStyle = merged ? 'rgba(20,60,70,0.88)' : good ? 'rgba(30,60,50,0.88)' : 'rgba(70,25,25,0.9)'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = merged ? C.tealL : good ? C.good : C.bad; ctx.stroke();
      txt(label, 0, 2, 28, merged ? C.tealL : good ? '#bff5d6' : '#ffc2b8', 'center', { weight: 900 });
      ctx.restore();
    });
  }
  (L.signs || []).forEach(s => {
    ctx.save(); ctx.translate(s.x, s.y);
    rr(-110, -30, 220, 60, 14); ctx.fillStyle = 'rgba(20,60,70,0.88)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.tealL; ctx.stroke();
    txt(s.text, 0, 2, 26, C.tealL, 'center', { weight: 900 });
    ctx.restore();
  });
  const a = L.arena;
  ctx.save();
  ctx.fillStyle = '#2e2b52'; ctx.fillRect(a.x, a.y, a.w, a.h);
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 2;
  for (let yy = a.y; yy < a.y + a.h; yy += 52) for (let xx = a.x + ((yy / 52) & 1) * 30; xx < a.x + a.w; xx += 60) { ctx.beginPath(); for (let k = 0; k < 6; k++) { const an = k / 6 * TAU + Math.PI / 6; ctx.lineTo(xx + Math.cos(an) * 30, yy + Math.sin(an) * 30); } ctx.closePath(); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(255,177,46,0.22)'; ctx.lineWidth = 3;
  for (let r = 120; r < 700; r += 110) { circle(800, 300, r); ctx.stroke(); }
  if (L.bossPipes) drawArenaWater(a);
  if (L.finish) {
    checker(a.x + 40, 150, a.w - 80, 24, 12);
    rr(800 - 80, 92, 160, 40, 20); ctx.fillStyle = 'rgba(20,17,46,0.9)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.mustard; ctx.stroke();
    txt('결승선', 800, 113, 22, C.amberL, 'center', { weight: 900 });
  }
  ctx.restore();
  for (const d of L.domes || []) drawDome(d);
  for (const p of L.props || []) drawProp(p);
  for (const b of L.boards || []) drawBoard(b);
  for (const s of L.solids) {
    if (s.crate) drawCrate(s);
    else if (s.boat) drawBoat(s);
    else if (s.dwall) drawDomeWall(s);
    else if (s.cliff) drawCliff(s);
    else if (s.fwall) drawFactoryWall(s);
    else if (s.space) drawSpaceEdge(s);
    else drawSpaceWindow(s);
  }
  for (const l of L.launchers || []) drawLauncher(l);
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
  } else if (p.kind === 'clock') {
    const on = G.restricted;
    ctx.fillStyle = 'rgba(60,20,20,0.3)'; ellipse(4, 70, 56, 12); ctx.fill();
    ctx.fillStyle = '#3a3566'; rr(-8, 40, 16, 34, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f1e8d8'; circle(0, 0, 62); ctx.fill(); ctx.stroke();
    if (on) {
      ctx.strokeStyle = C.red; ctx.lineWidth = 10; circle(0, 0, 49); ctx.stroke();
      txt('24', 0, 4, 38, C.red, 'center', { weight: 900 });
      ctx.strokeStyle = C.ink; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(G.t * 5) * 44, Math.sin(G.t * 5) * 44); ctx.stroke();
    } else {
      [C.orange, C.teal, C.mustard].forEach((col, i) => { ctx.strokeStyle = col; ctx.lineWidth = 13; ctx.beginPath(); ctx.arc(0, 0, 47, -Math.PI / 2 + i * TAU / 3 + 0.05, -Math.PI / 2 + (i + 1) * TAU / 3 - 0.05); ctx.stroke(); });
      txt('8·8·8', 0, 3, 23, C.ink, 'center', { weight: 900 });
    }
    setFont(13, 600); const cw2 = ctx.measureText(on ? '공장 시계 · 24시간 가동' : '공장 시계 · 일 8 쉼 8 하고 싶은 일 8').width + 16;
    rr(-cw2 / 2, -90, cw2, 18, 9); ctx.fillStyle = on ? 'rgba(70,25,25,0.92)' : 'rgba(20,60,50,0.92)'; ctx.fill(); txt(on ? '공장 시계 · 24시간 가동' : '공장 시계 · 일 8 쉼 8 하고 싶은 일 8', 0, -81, 13, C.cream, 'center', { weight: 600 });
  } else if (p.kind === 'kiosk') {
    ctx.fillStyle = 'rgba(60,20,20,0.3)'; ellipse(4, 30, 62, 12); ctx.fill();
    ctx.fillStyle = C.cream; rr(-52, -30, 104, 58, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.teal; rr(-60, -50, 120, 26, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; rr(-19, -17, 38, 30, 4); ctx.fill(); ctx.stroke();
    txt(G.restricted ? '✕' : '26', 0, -1, 18, G.restricted ? C.bad : C.ink, 'center', { weight: 900 });
    ctx.fillStyle = G.restricted ? C.red : C.good; circle(40, -37, 5); ctx.fill(); ctx.stroke();
    setFont(13, 600); const kw = ctx.measureText('번호표 발급기').width + 16;
    rr(-kw / 2, -76, kw, 18, 9); ctx.fillStyle = 'rgba(27,24,56,0.85)'; ctx.fill(); txt('번호표 발급기', 0, -67, 13, C.cream, 'center', { weight: 600 });
  } else if (p.kind === 'tank') {
    ctx.fillStyle = 'rgba(60,20,20,0.3)'; ellipse(4, 16, 16, 6); ctx.fill();
    ctx.fillStyle = '#e8e2d6'; rr(-12, -24, 24, 40, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.teal; ctx.fillRect(-12, -6, 24, 6);
    txt('O₂', 0, 8, 11, C.ink, 'center', { weight: 600 });
  }
  ctx.restore();
}
// 컨베이어 벨트: 24시간 가동 중에는 화살표 무늬가 움직이고, 멈추면 흐려진다
function drawBelt(b) {
  const c = G.cam; if (b.x > c.x + W || b.x + b.w < c.x || b.y > c.y + H + 10 || b.y + b.h < c.y - 10) return;
  const on = mech('belt'), hor = b.dx !== 0, sp = 90, off = on ? (G.t * b.speed) % sp : 0;
  ctx.save();
  ctx.fillStyle = on ? '#22213c' : '#2c2b47'; ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.beginPath(); ctx.rect(b.x, b.y, b.w, b.h); ctx.clip();
  ctx.strokeStyle = on ? 'rgba(255,196,90,0.5)' : 'rgba(170,170,210,0.2)'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (hor) {
    for (let y = b.y + 45; y < b.y + b.h; y += 90) for (let x = b.x - sp + (b.dx > 0 ? off : sp - off); x < b.x + b.w + sp; x += sp) { ctx.beginPath(); ctx.moveTo(x - 12 * b.dx, y - 18); ctx.lineTo(x + 10 * b.dx, y); ctx.lineTo(x - 12 * b.dx, y + 18); ctx.stroke(); }
  } else {
    const y0 = Math.max(b.y, c.y - sp), y1 = Math.min(b.y + b.h, c.y + H + sp);
    for (let x = b.x + 65; x < b.x + b.w; x += 130) for (let y = b.y - sp + (b.dy > 0 ? off : sp - off); y < y1 + sp; y += sp) { if (y < y0 - sp) continue; ctx.beginPath(); ctx.moveTo(x - 18, y - 12 * b.dy); ctx.lineTo(x, y + 10 * b.dy); ctx.lineTo(x + 18, y - 12 * b.dy); ctx.stroke(); }
  }
  ctx.restore();
  ctx.fillStyle = '#6b7096'; ctx.fillRect(b.x, b.y - 5, b.w, 7); ctx.fillRect(b.x, b.y + b.h - 2, b.w, 7);
  ctx.fillStyle = on ? C.amber : C.good;
  for (let x = Math.max(b.x + 40, Math.floor(c.x / 160) * 160); x < Math.min(b.x + b.w, c.x + W); x += 160) { ctx.fillRect(x, b.y - 4, 10, 5); ctx.fillRect(x, b.y + b.h - 1, 10, 5); }
}
function drawIsland(i) {
  const c = G.cam; if (i.y > c.y + H + 10 || i.y + i.h < c.y - 10) return;
  ctx.fillStyle = 'rgba(10,8,30,0.35)'; rr(i.x + 3, i.y + 6, i.w, i.h, 12); ctx.fill();
  ctx.fillStyle = '#565b85'; rr(i.x, i.y, i.w, i.h, 12); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#2a2d4f'; ctx.stroke();
  ctx.strokeStyle = 'rgba(247,197,72,0.7)'; ctx.lineWidth = 3; ctx.setLineDash([12, 8]); rr(i.x + 7, i.y + 7, i.w - 14, i.h - 14, 8); ctx.stroke(); ctx.setLineDash([]);
}
function drawPress(pr) {
  const c = G.cam; if (pr.y > c.y + H + 10 || pr.y + pr.h < c.y - 10) return;
  const on = mech('belt'), slam = on ? Math.abs(Math.sin(G.t * 3.2 + pr.y)) : 0, left = pr.x < 800;
  ctx.save();
  ctx.fillStyle = '#1b1a33'; ctx.fillRect(pr.x, pr.y, pr.w, pr.h);
  const pw = 30 + slam * (pr.w - 36), px = left ? pr.x : pr.x + pr.w - pw;
  ctx.save(); ctx.beginPath(); ctx.rect(px, pr.y + 6, pw, pr.h - 12); ctx.clip();
  ctx.fillStyle = on ? C.mustard : '#8a8fb0'; ctx.fillRect(px, pr.y + 6, pw, pr.h - 12);
  ctx.fillStyle = C.ink; for (let y = pr.y - 40; y < pr.y + pr.h + 40; y += 36) { ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px + pw, y + 26); ctx.lineTo(px + pw, y + 44); ctx.lineTo(px, y + 18); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.strokeRect(px, pr.y + 6, pw, pr.h - 12);
  setFont(13, 600); const tw = ctx.measureText('압착기').width + 16, lx = left ? pr.x + pr.w + 46 : pr.x - 46;
  rr(lx - tw / 2, pr.y - 22, tw, 18, 9); ctx.fillStyle = on ? 'rgba(70,25,25,0.92)' : 'rgba(27,24,56,0.85)'; ctx.fill(); txt(on ? '압착기' : '멈춤', lx, pr.y - 13, 13, on ? '#ffd0c8' : C.cream, 'center', { weight: 600 });
  ctx.restore();
}
// 쉼터: 24시간 가동 중에는 잠겨 있고, 8시간 노동이 되면 들어가 체력을 채울 수 있다
function drawRest(r) {
  const c = G.cam; if (r.y > c.y + H + 30 || r.y + r.h < c.y - 40) return;
  const on = !mech('belt');
  ctx.save(); ctx.lineJoin = 'round';
  rr(r.x, r.y, r.w, r.h, 18); ctx.fillStyle = on ? 'rgba(24,84,74,0.75)' : 'rgba(70,30,40,0.55)'; ctx.fill();
  ctx.setLineDash(on ? [] : [14, 9]); ctx.lineWidth = 4; ctx.strokeStyle = on ? C.tealL : 'rgba(255,107,107,0.85)'; ctx.stroke(); ctx.setLineDash([]);
  // 긴 의자와 화분
  ctx.lineWidth = 2.5; ctx.strokeStyle = C.ink;
  ctx.fillStyle = on ? '#e2ad6c' : '#7a6a70'; rr(r.x + r.w / 2 - 70, r.y + r.h / 2 - 6, 140, 24, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = on ? '#c98f55' : '#5f5460'; rr(r.x + r.w / 2 - 70, r.y + r.h / 2 - 26, 140, 18, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = on ? '#5ec27f' : '#566058'; circle(r.x + 38, r.y + r.h - 44, 13); ctx.fill(); ctx.stroke(); circle(r.x + 52, r.y + r.h - 54, 12); ctx.fill(); ctx.stroke();
  ctx.fillStyle = C.cream; rr(r.x + 28, r.y + r.h - 38, 34, 16, 5); ctx.fill(); ctx.stroke();
  if (!on) {
    const lx = r.x + r.w - 46, ly = r.y + 52;
    ctx.fillStyle = C.red; rr(lx - 15, ly - 6, 30, 24, 5); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(lx, ly - 6, 9, Math.PI, 0); ctx.stroke();
  } else if (Math.floor(G.t * 2) % 2 === 0) txt('+', r.x + r.w - 44, r.y + 50, 30, C.good, 'center', { weight: 900 });
  const label = on ? '쉼터 · 들어오면 피로가 풀려요' : '쉼터 · 잠김 (쉬는 시간 없음)';
  setFont(16, 600); const tw = ctx.measureText(label).width + 26;
  rr(r.x + r.w / 2 - tw / 2, r.y - 15, tw, 30, 15); ctx.fillStyle = on ? 'rgba(20,60,50,0.95)' : 'rgba(70,25,25,0.95)'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = on ? C.good : C.bad; ctx.stroke();
  txt(label, r.x + r.w / 2, r.y + 1, 16, on ? '#c8ffe4' : '#ffc2b8', 'center', { weight: 600 });
  ctx.restore();
}
function drawFactoryWall(s) {
  const c = G.cam; if (s.x > c.x + W || s.x + s.w < c.x || s.y > c.y + H || s.y + s.h < c.y) return;
  const y0 = Math.max(s.y, c.y - 10), y1 = Math.min(s.y + s.h, c.y + H + 10), left = s.x === 0, inner = left ? s.x + s.w : s.x;
  ctx.fillStyle = '#2f3352'; ctx.fillRect(s.x, y0, s.w, y1 - y0);
  ctx.fillStyle = '#474c74'; ctx.fillRect(s.x + 14, y0, 9, y1 - y0); ctx.fillRect(s.x + 40, y0, 9, y1 - y0);
  ctx.fillStyle = '#23263f';
  for (let y = Math.floor(y0 / 150) * 150; y < y1; y += 150) ctx.fillRect(s.x, y, s.w, 8);
  ctx.save(); ctx.beginPath(); ctx.rect(left ? inner - 9 : inner, y0, 9, y1 - y0); ctx.clip();
  ctx.fillStyle = C.mustard; ctx.fillRect(left ? inner - 9 : inner, y0, 9, y1 - y0);
  ctx.fillStyle = C.ink; for (let y = Math.floor(y0 / 28) * 28 - 28; y < y1; y += 28) { ctx.beginPath(); ctx.moveTo(inner - 10, y); ctx.lineTo(inner + 10, y + 14); ctx.lineTo(inner + 10, y + 26); ctx.lineTo(inner - 10, y + 12); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}
function drawTank(x, y) {
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineWidth = 2.5; ctx.strokeStyle = C.ink;
  ctx.fillStyle = '#e8e2d6'; rr(x - 12, y - 22, 24, 40, 10); ctx.fill(); ctx.stroke();
  ctx.fillStyle = C.teal; ctx.fillRect(x - 12, y - 5, 24, 6);
  ctx.fillStyle = '#9ea3c8'; rr(x - 5, y - 28, 10, 8, 3); ctx.fill(); ctx.stroke();
  ctx.restore();
}
// 일하는 장면의 통 더미와 벨트에 올리는 곳
function drawWork() {
  const wk = G.L.work, ws = G.work, c = G.cam;
  if (wk.from.y < c.y - 120 || wk.to.y > c.y + H + 120) return;
  const left = wk.need - ws.n - (ws.carry ? 1 : 0);
  ctx.save(); ctx.lineJoin = 'round';
  ctx.fillStyle = 'rgba(10,8,30,0.35)'; ellipse(wk.from.x, wk.from.y + 24, 70, 12); ctx.fill();
  ctx.fillStyle = '#c98f55'; rr(wk.from.x - 62, wk.from.y + 8, 124, 18, 5); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = C.ink; ctx.stroke();
  for (let i = 0; i < left; i++) drawTank(wk.from.x - 32 + i * 32, wk.from.y - 6);
  rr(wk.to.x - 52, wk.to.y - 34, 104, 68, 12); ctx.fillStyle = '#3a3566'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.stroke();
  ctx.save(); rr(wk.to.x - 46, wk.to.y - 28, 92, 56, 8); ctx.clip();
  ctx.strokeStyle = ws.done ? 'rgba(170,170,210,0.4)' : 'rgba(255,196,90,0.85)'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  const p = ws.done ? 0 : (G.t * 1.6) % 1;
  for (let k = -1; k < 3; k++) { const yy = wk.to.y + 22 - k * 22 - p * 22; ctx.beginPath(); ctx.moveTo(wk.to.x - 24, yy + 9); ctx.lineTo(wk.to.x, yy - 9); ctx.lineTo(wk.to.x + 24, yy + 9); ctx.stroke(); }
  ctx.restore();
  if (!ws.done) {
    const tg = ws.carry ? wk.to : wk.from, label = ws.carry ? '여기에 올리기' : '산소 통 들기', pu = 1 + Math.sin(G.t * 5) * 0.08;
    ctx.strokeStyle = 'rgba(247,197,72,0.9)'; ctx.lineWidth = 4; ctx.setLineDash([14, 10]); ctx.lineDashOffset = -G.t * 30;
    ctx.beginPath(); ctx.ellipse(tg.x, tg.y + 8, 78 * pu, 40 * pu, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    setFont(17, 900); const tw = ctx.measureText(label).width + 26, by = tg.y - 72 + Math.sin(G.t * 6) * 5;
    rr(tg.x - tw / 2, by - 15, tw, 30, 15); ctx.fillStyle = C.mustard; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.stroke();
    txt(label, tg.x, by + 1, 17, C.ink, 'center', { weight: 900 });
  }
  ctx.restore();
}
// 작업대에 묶여 일하는 정착민
function drawWorker(c) {
  ctx.save(); ctx.translate(c.x, c.y); ctx.scale(1.25, 1.25);
  ctx.lineJoin = 'round'; ctx.lineWidth = 2.6; ctx.strokeStyle = C.ink;
  ctx.fillStyle = 'rgba(10,8,30,0.35)'; ellipse(0, 30, 42, 10); ctx.fill();
  if (!c.freed) drawChibi(0, 2, c.t, true, Math.PI / 2, c.look, { noShadow: true, noPack: true, closed: true });
  ctx.fillStyle = '#7d83ad'; rr(-38, 12, 76, 14, 5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#3a3566'; rr(-32, 26, 9, 9, 2); ctx.fill(); ctx.stroke(); rr(23, 26, 9, 9, 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e8e2d6'; rr(-26, 5, 15, 9, 3); ctx.fill(); ctx.stroke(); rr(8, 4, 18, 10, 3); ctx.fill(); ctx.stroke();
  if (c.freed) { ctx.restore(); return; }
  ctx.strokeStyle = 'rgba(255,177,46,0.95)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, -2, 17, 7, 0, 0, TAU); ctx.stroke();
  ctx.fillStyle = Math.sin(c.t * 6) > 0 ? C.amber : '#7a5a2a'; circle(31, 8, 5); ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.stroke();
  if (!c.icon) {
    if (dist(G.P.x, G.P.y, c.x, c.y) < 300) { rr(-52, -92, 104, 30, 12); ctx.fillStyle = C.cream; ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5; ctx.stroke(); txt('쉬게 해 줘!', 0, -76, 16, C.ink, 'center'); }
    setFont(13, 600); const tw = ctx.measureText('일하는 정착민').width + 16;
    rr(-tw / 2, 40, tw, 18, 9); ctx.fillStyle = 'rgba(27,24,56,0.85)'; ctx.fill(); txt('일하는 정착민', 0, 49, 13, C.tealL, 'center', { weight: 600 });
  }
  ctx.restore();
}
function edgeMarker(wx, wy, label, color) {
  const cam = G.cam, m = 46, sx = wx - cam.x, sy = wy - cam.y;
  if (sx > 0 && sx < W && sy > 0 && sy < H) return;
  const cx = W / 2, cy = H / 2, ang = Math.atan2(sy - cy, sx - cx);
  const k = Math.min((W / 2 - m) / Math.abs(Math.cos(ang) || 1e-6), (H / 2 - m - 40) / Math.abs(Math.sin(ang) || 1e-6));
  ctx.save(); ctx.translate(cx + Math.cos(ang) * k, cy + Math.sin(ang) * k);
  ctx.fillStyle = 'rgba(16,40,38,0.88)'; circle(0, 0, 26); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = color; ctx.stroke();
  txt(label, 0, 1, 13, color, 'center', { weight: 900 });
  ctx.rotate(ang); ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(40, 0); ctx.lineTo(28, -10); ctx.lineTo(28, 10); ctx.closePath(); ctx.fill();
  ctx.restore();
}
/* ----- 4스테이지 그리기 ----- */
function drawDomeWall(s) {
  const c = G.cam; if (s.x > c.x + W || s.x + s.w < c.x || s.y > c.y + H || s.y + s.h < c.y) return;
  const y0 = Math.max(s.y, c.y - 10), y1 = Math.min(s.y + s.h, c.y + H + 10), left = s.dwall === 'a', inner = left ? s.x + s.w : s.x;
  ctx.fillStyle = left ? '#1e3442' : '#2c2648'; ctx.fillRect(s.x, y0, s.w, y1 - y0);
  for (let y = Math.floor(y0 / 70) * 70; y < y1; y += 70) {
    const k = (Math.round(y / 70) * 7919 + (left ? 3 : 11)) % 97;
    ctx.fillStyle = left ? '#2c4a5a' : '#3d3564'; rr(s.x + 14 + (k % 3) * 8, y + 6, s.w - 50, 50, 6); ctx.fill();
    ctx.fillStyle = k % 4 ? 'rgba(255,214,120,0.85)' : 'rgba(159,245,234,0.8)';
    ctx.fillRect(s.x + 26 + (k % 3) * 8, y + 18, 10, 10); ctx.fillRect(s.x + 50 + (k % 3) * 8, y + 18, 10, 10);
  }
  const gr = ctx.createLinearGradient(inner + (left ? -30 : 30), 0, inner, 0);
  gr.addColorStop(0, 'rgba(190,240,255,0)'); gr.addColorStop(1, 'rgba(190,240,255,0.5)');
  ctx.fillStyle = gr; ctx.fillRect(left ? inner - 30 : inner, y0, 30, y1 - y0);
  ctx.fillStyle = '#e6f6ff'; ctx.fillRect(inner - 2, y0, 4, y1 - y0);
  ctx.fillStyle = '#5b6087'; for (let y = Math.floor(y0 / 200) * 200; y < y1; y += 200) ctx.fillRect(left ? inner - 16 : inner - 2, y, 18, 14);
  for (let y = Math.ceil(y0 / 900) * 900 + 450; y < y1; y += 900) {
    const lb = left ? '알파 돔' : '베타 돔';
    ctx.save(); ctx.translate(left ? inner - 40 : inner + 40, y); ctx.rotate(left ? -Math.PI / 2 : Math.PI / 2);
    rr(-48, -15, 96, 30, 15); ctx.fillStyle = 'rgba(20,17,46,0.9)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = C.cream; ctx.stroke();
    txt(lb, 0, 1, 16, C.cream, 'center', { weight: 900 }); ctx.restore();
  }
}
function drawLauncher(l) {
  const c = G.cam; if (!l.icon && (l.y < c.y - 90 || l.y > c.y + H + 90)) return;
  const dir = l.side === 'a' ? 1 : -1, k = l.folded ? l.foldK : 0;
  const aimA = dir > 0 ? -0.12 : Math.PI + 0.12, downA = Math.PI / 2;
  const a = aimA + (downA - aimA) * k * (dir > 0 ? 1 : -1) * (dir > 0 ? 1 : -1);
  ctx.save(); ctx.translate(l.x, l.y); ctx.lineJoin = 'round'; ctx.lineWidth = 2.6; ctx.strokeStyle = C.ink;
  ctx.fillStyle = 'rgba(10,8,30,0.35)'; ellipse(0, 26, 40, 11); ctx.fill();
  ctx.fillStyle = '#3a3566'; rr(-34, 4, 68, 22, 7); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.rotate(l.folded ? lerp(aimA, dir > 0 ? downA : downA, k) : aimA);
  const hot = l.flash > 0 && !l.folded;
  ctx.fillStyle = hot ? '#fff' : l.folded ? '#9a96b8' : '#e8e2d6';
  rr(-8, -16, 52, 14, 5); ctx.fill(); ctx.stroke(); rr(-8, 2, 52, 14, 5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = l.folded ? '#5b5880' : C.red; ctx.fillRect(38, -14, 5, 10); ctx.fillRect(38, 4, 5, 10);
  ctx.restore();
  ctx.fillStyle = l.folded ? '#8f8bb0' : C.cream; circle(0, 0, 18); ctx.fill(); ctx.stroke();
  if (l.resid) {
    const on = Math.floor(G.t * 3) % 2 === 0;
    ctx.fillStyle = on ? '#ff3b3b' : '#6a1a1a'; circle(0, -1, 8); ctx.fill(); ctx.stroke();
    if (on) { ctx.fillStyle = 'rgba(255,59,59,0.3)'; circle(0, -1, 20); ctx.fill(); }
    setFont(13, 600); const tw = ctx.measureText('잔여 신호').width + 16;
    rr(-tw / 2, -50, tw, 18, 9); ctx.fillStyle = 'rgba(120,20,30,0.95)'; ctx.fill(); txt('잔여 신호', 0, -41, 13, '#ffd0c8', 'center', { weight: 600 });
  } else if (l.folded) { ctx.fillStyle = '#4d4777'; circle(0, -1, 7); ctx.fill(); }
  else drawEye(0, -1, 9, l.icon ? 0 : Math.atan2(G.P.y - l.y, G.P.x - l.x), G.t);
  if (!l.icon && !l.folded && dist(G.P.x, G.P.y, l.x, l.y) < 420) {
    setFont(13, 600); const tw = ctx.measureText('미사일 발사대').width + 16;
    rr(-tw / 2 + dir * 30, -48, tw, 18, 9); ctx.fillStyle = 'rgba(70,25,25,0.9)'; ctx.fill(); txt('미사일 발사대', dir * 30, -39, 13, '#ffd0c8', 'center', { weight: 600 });
  }
  ctx.restore();
  if (l.flash > 0) l.flash -= 1 / 60;
}
function drawShell(s) {
  const k = clamp(s.t / s.warn, 0, 1);
  ctx.save();
  if (!s.boom) {
    ctx.fillStyle = 'rgba(255,80,60,' + (0.12 + 0.25 * k) + ')'; ellipse(s.x, s.y, s.r, s.r * 0.6); ctx.fill();
    ctx.strokeStyle = 'rgba(255,90,70,' + (0.6 + 0.4 * Math.sin(G.t * 20)) + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r, s.r * 0.6, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,220,180,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r * (1 - k), s.r * 0.6 * (1 - k), 0, 0, TAU); ctx.stroke();
    // 위에서 떨어지는 미사일
    const my = s.y - 420 * (1 - k * k);
    ctx.translate(s.x, my);
    ctx.fillStyle = 'rgba(255,170,60,0.6)'; ellipse(0, -26, 6, 14); ctx.fill();
    ctx.fillStyle = '#e8e2d6'; ctx.strokeStyle = C.ink; ctx.lineWidth = 2; rr(-6, -18, 12, 26, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.red; ctx.beginPath(); ctx.moveTo(-6, 6); ctx.lineTo(0, 16); ctx.lineTo(6, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else {
    const e = (s.t - s.warn) / 0.35;
    ctx.fillStyle = 'rgba(255,200,120,' + (1 - e) * 0.7 + ')'; ellipse(s.x, s.y, s.r * (0.8 + e * 0.4), s.r * 0.6 * (0.8 + e * 0.4)); ctx.fill();
  }
  ctx.restore();
}
function drawTower(g) {
  const lit = !g.alive, zr = g.zone, ch = g.charge || 0;
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (!lit) {
    ctx.fillStyle = g.inside ? 'rgba(159,245,234,0.18)' : 'rgba(159,245,234,0.07)'; ellipse(g.x, g.y + 12, zr, zr * 0.62); ctx.fill();
    ctx.setLineDash([12, 9]); ctx.lineDashOffset = -G.t * 20; ctx.strokeStyle = 'rgba(159,245,234,0.85)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(g.x, g.y + 12, zr, zr * 0.62, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    if (ch > 0) { ctx.strokeStyle = C.tealL; ctx.lineWidth = 9; ctx.beginPath(); ctx.ellipse(g.x, g.y + 12, zr, zr * 0.62, 0, -Math.PI / 2, -Math.PI / 2 + TAU * ch); ctx.stroke(); }
  } else {
    ctx.strokeStyle = 'rgba(159,245,234,' + (0.35 + 0.2 * Math.sin(G.t * 3)) + ')'; ctx.lineWidth = 4;
    for (let k = 0; k < 3; k++) { const rr2 = ((G.t * 60 + k * 50) % 150) + 30; ctx.beginPath(); ctx.ellipse(g.x, g.y - 96, rr2, rr2 * 0.5, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); }
  }
  ctx.translate(g.x, g.y);
  ctx.fillStyle = 'rgba(10,8,30,0.35)'; ellipse(0, 18, 34, 10); ctx.fill();
  ctx.strokeStyle = C.ink; ctx.lineWidth = 3;
  ctx.strokeStyle = '#3a3566'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-24, 16); ctx.lineTo(0, -88); ctx.lineTo(24, 16); ctx.moveTo(-15, -22); ctx.lineTo(15, -22); ctx.moveTo(-9, -52); ctx.lineTo(9, -52); ctx.stroke();
  ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
  ctx.fillStyle = lit ? C.tealL : C.cream; ctx.beginPath(); ctx.ellipse(0, -96, 24, 12, -0.3, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = lit ? '#fff' : '#9a96b8'; circle(0, -112, 6); ctx.fill(); ctx.stroke();
  if (lit) { ctx.fillStyle = 'rgba(159,245,234,0.35)'; circle(0, -112, 18 + Math.sin(G.t * 6) * 3); ctx.fill(); }
  const label = lit ? '연대 송신탑 · 켜짐!' : g.inside ? '버티는 중 ' + Math.floor(ch * 100) + '%' : '연대 송신탑';
  setFont(15, 600); const tw = ctx.measureText(label).width + 20;
  rr(-tw / 2, -150, tw, 24, 12); ctx.fillStyle = lit ? 'rgba(20,70,60,0.95)' : g.inside ? C.tealL : 'rgba(27,24,56,0.9)'; ctx.fill();
  txt(label, 0, -137, 15, lit ? '#c8ffe4' : g.inside ? C.ink : C.tealL, 'center', { weight: 600 });
  ctx.restore();
}
function drawSign(c) {
  const s = c.sign; setFont(13, 600); const w = Math.max(56, ctx.measureText(s).width + 16), bob = Math.sin(G.t * 3 + c.ph) * 2;
  ctx.save(); ctx.translate(c.x, c.y - 62 + bob);
  ctx.strokeStyle = '#8a6a40'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 26); ctx.stroke();
  rr(-w / 2, -26, w, 26, 5); ctx.fillStyle = C.cream; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = C.ink; ctx.stroke();
  txt(s, 0, -12, 13, C.ink, 'center', { weight: 600 });
  ctx.restore();
}
function drawResidualOrb() {
  const o = G.residualOrb, k = Math.min(1, o.t / 2.5);
  if (k >= 1) return;
  const px = kk => lerp(o.x, o.x + 560, kk * kk), py = kk => lerp(o.y + 80, 20, kk);
  ctx.save();
  for (let i = 1; i < 8; i++) { const kk = Math.max(0, k - i * 0.025); ctx.fillStyle = 'rgba(255,59,59,' + (0.1 * (8 - i) / 7) + ')'; circle(px(kk), py(kk), 16); ctx.fill(); }
  const x = px(k), y = py(k), on = Math.floor(G.t * 8) % 2;
  ctx.fillStyle = 'rgba(255,59,59,0.3)'; circle(x, y, 30 + Math.sin(G.t * 12) * 4); ctx.fill();
  ctx.fillStyle = on ? '#ff3b3b' : '#ffb0b0'; circle(x, y, 15); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.stroke();
  txt('잔여 신호', x, y + 36, 20, '#ffd0c8', 'center', { weight: 900, stroke: C.ink, sw: 5 });
  ctx.restore();
}
function drawBossPods(b) {
  const pos = [[-170, -50], [170, -50], [-150, 70], [150, 70]];
  for (let i = 0; i < G.L.bossPods; i++) {
    const p = pos[i % pos.length], on = i < b.pods;
    ctx.save(); ctx.translate(p[0], p[1]); ctx.lineJoin = 'round'; ctx.lineWidth = 2.5; ctx.strokeStyle = C.ink;
    ctx.rotate(on ? (p[0] < 0 ? -0.5 : 0.5) : (p[0] < 0 ? 1.1 : -1.1));
    ctx.fillStyle = on ? '#e8e2d6' : '#6b6890'; rr(-12, -28, 24, 40, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = on ? C.red : '#3a3566'; ctx.fillRect(-8, -24, 6, 8); ctx.fillRect(2, -24, 6, 8);
    ctx.restore();
  }
  setFont(15, 600);
  const s = '미사일 포대 ' + b.pods + '/' + G.L.bossPods, tw = ctx.measureText(s).width + 20;
  rr(-tw / 2, 120, tw, 24, 12); ctx.fillStyle = 'rgba(70,25,25,0.9)'; ctx.fill(); txt(s, 0, 133, 15, '#ffd0c8', 'center', { weight: 600 });
}
/* ----- 5스테이지 그리기 ----- */
// 마른 호수 바닥: 갈라진 소금 바닥 무늬
let SALT = null;
function saltPattern() {
  if (SALT) return SALT;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  let seed = 7; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  x.fillStyle = '#d6bd96'; x.fillRect(0, 0, 256, 256);
  const both = f => { for (const dx of [-256, 0, 256]) for (const dy of [-256, 0, 256]) f(dx, dy); };
  for (let i = 0; i < 34; i++) { const px = r() * 256, py = r() * 256, rx = 10 + r() * 30, ry = 6 + r() * 16, col = r() < 0.55 ? 'rgba(244,232,210,0.55)' : 'rgba(186,150,108,0.32)'; both((dx, dy) => { x.fillStyle = col; x.beginPath(); x.ellipse(px + dx, py + dy, rx, ry, 0, 0, TAU); x.fill(); }); }
  // 갈라진 금: 흔들린 격자 점을 이어 그물처럼
  const N = 5, pts = [];
  for (let gy = 0; gy < N; gy++) for (let gx = 0; gx < N; gx++) pts.push([gx * 256 / N + 8 + r() * 32, gy * 256 / N + 8 + r() * 32]);
  x.strokeStyle = 'rgba(132,96,62,0.8)'; x.lineWidth = 2.2; x.lineJoin = 'round';
  for (let gy = 0; gy < N; gy++) for (let gx = 0; gx < N; gx++) {
    const p = pts[gy * N + gx];
    [[1, 0], [0, 1]].forEach(([ax, ay]) => {
      const q = pts[((gy + ay) % N) * N + (gx + ax) % N], qx = q[0] + (gx + ax >= N ? 256 : 0), qy = q[1] + (gy + ay >= N ? 256 : 0);
      const mx = (p[0] + qx) / 2 + (r() - 0.5) * 14, my = (p[1] + qy) / 2 + (r() - 0.5) * 14;
      both((dx, dy) => { x.beginPath(); x.moveTo(p[0] + dx, p[1] + dy); x.lineTo(mx + dx, my + dy); x.lineTo(qx + dx, qy + dy); x.stroke(); });
    });
  }
  x.strokeStyle = 'rgba(255,248,232,0.5)'; x.lineWidth = 1;
  for (let i = 0; i < 26; i++) { const px = r() * 256, py = r() * 256, a = r() * TAU; both((dx, dy) => { x.beginPath(); x.moveTo(px + dx, py + dy); x.lineTo(px + dx + Math.cos(a) * 12, py + dy + Math.sin(a) * 12); x.stroke(); }); }
  SALT = ctx.createPattern(c, 'repeat');
  return SALT;
}
function drawLake(lk) {
  const c = G.cam;
  const x0 = Math.max(lk.x, c.x - 4), x1 = Math.min(lk.x + lk.w, c.x + W + 4), y0 = Math.max(lk.y, c.y - 4), y1 = Math.min(lk.y + lk.h, c.y + H + 4);
  if (x1 <= x0 || y1 <= y0) return;
  ctx.fillStyle = saltPattern(); ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // 옛 물가: 호수 아래쪽 끝
  const by = lk.y + lk.h;
  if (by > c.y - 60 && by < c.y + H + 60) {
    const gr = ctx.createLinearGradient(0, by - 60, 0, by + 6); gr.addColorStop(0, 'rgba(160,80,52,0)'); gr.addColorStop(1, 'rgba(150,68,44,0.65)');
    ctx.fillStyle = gr; ctx.fillRect(lk.x, by - 60, lk.w, 66);
  }
  const f = G.lakeFill; if (f <= 0.001) return;
  const e = f * f * (3 - 2 * f);
  ctx.fillStyle = 'rgba(50,158,206,' + (0.74 * e).toFixed(3) + ')'; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.strokeStyle = 'rgba(225,250,255,' + (0.4 * e).toFixed(3) + ')'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  for (let y = Math.floor(y0 / 70) * 70 + 35; y < y1; y += 70) for (let x = Math.floor(x0 / 180) * 180 + (Math.round(y / 70) % 2) * 90; x < x1; x += 180) {
    const o = Math.sin(G.t * 1.5 + x * 0.01 + y * 0.03) * 12;
    ctx.beginPath(); ctx.moveTo(x + o, y); ctx.quadraticCurveTo(x + o + 20, y - 7, x + o + 40, y); ctx.stroke();
  }
  // 떠다니는 얼음 조각
  if (!G.L.floes) { let s = 3; const rr2 = () => (s = (s * 16807) % 2147483647) / 2147483647; G.L.floes = []; for (let i = 0; i < 60; i++) G.L.floes.push({ x: lk.x + 40 + rr2() * (lk.w - 80), y: lk.y + 40 + rr2() * (lk.h - 80), s: 12 + rr2() * 22, a: rr2() * TAU }); }
  ctx.save(); ctx.globalAlpha = e; ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(120,190,220,0.9)';
  for (const fl of G.L.floes) {
    if (fl.x < c.x - 40 || fl.x > c.x + W + 40 || fl.y < c.y - 40 || fl.y > c.y + H + 40) continue;
    const dx = Math.sin(G.t * 0.4 + fl.a) * 6;
    ctx.fillStyle = 'rgba(245,252,255,0.9)'; ctx.beginPath();
    for (let k = 0; k < 6; k++) { const an = fl.a + k / 6 * TAU, rad = fl.s * (0.7 + 0.3 * Math.sin(k * 2.3 + fl.a)); ctx.lineTo(fl.x + dx + Math.cos(an) * rad, fl.y + Math.sin(an) * rad * 0.6); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}
// 물을 빼돌리는 파이프: 밸브가 열려 있으면 물이 오른쪽(농장 돔)으로 흘러간다
function drawPipe(pp) {
  const c = G.cam; if (pp.y < c.y - 60 || pp.y > c.y + H + 60) return;
  const g = G.gens.find(x => x.id === pp.gen), on = !!(g && g.alive);
  const x0 = Math.max(pp.x0, c.x - 20), x1 = Math.min(pp.x1, c.x + W + 20); if (x1 <= x0) return;
  const y = pp.y;
  ctx.save(); ctx.lineJoin = 'round';
  ctx.fillStyle = 'rgba(60,30,20,0.28)'; ctx.fillRect(x0, y + 14, x1 - x0, 14);
  ctx.fillStyle = on ? '#e8e2d6' : '#a5a2bf'; ctx.fillRect(x0, y - 17, x1 - x0, 34);
  ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(x0, y - 12, x1 - x0, 5);
  ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x0, y - 17); ctx.lineTo(x1, y - 17); ctx.moveTo(x0, y + 17); ctx.lineTo(x1, y + 17); ctx.stroke();
  for (let x = pp.x0 + 60 + Math.max(0, Math.ceil((x0 - pp.x0 - 60) / 150)) * 150; x < x1; x += 150) { ctx.fillStyle = on ? C.amber : '#6b6890'; rr(x, y - 20, 12, 40, 3); ctx.fill(); ctx.stroke(); }
  if (on) {
    ctx.fillStyle = 'rgba(64,168,228,0.95)'; const off = (G.t * 170) % 75;
    for (let x = pp.x0 + off; x < pp.x1; x += 75) { if (x < x0 - 20 || x > x1) continue; ctx.beginPath(); ctx.moveTo(x + 12, y); ctx.lineTo(x - 5, y - 8); ctx.lineTo(x - 5, y + 8); ctx.closePath(); ctx.fill(); }
  }
  if (pp.x1 - 200 < c.x + W && pp.x1 > c.x) {
    const s = on ? '호수 물 → 농장 돔' : '잠겼어요 ✓'; setFont(14, 600); const tw = ctx.measureText(s).width + 18;
    rr(pp.x1 - tw - 14, y - 46, tw, 22, 11); ctx.fillStyle = on ? 'rgba(70,25,25,0.92)' : 'rgba(20,60,50,0.92)'; ctx.fill();
    txt(s, pp.x1 - 14 - tw / 2, y - 35, 14, on ? '#ffd0c8' : '#c8ffe4', 'center', { weight: 600 });
  }
  ctx.restore();
}
// 호수 바닥에 남은 배: 물이 차면 똑바로 서서 출렁인다
function drawBoat(s) {
  const c = G.cam; if (s.x > c.x + W + 60 || s.x + s.w < c.x - 60 || s.y > c.y + H + 60 || s.y + s.h < c.y - 60) return;
  const cx = s.x + s.w / 2, cy = s.y + s.h / 2, fl = G.lakeFill || 0, bob = Math.sin(G.t * 2 + cx * 0.01) * 3 * fl;
  ctx.save(); ctx.translate(cx, cy + bob); ctx.rotate((s.tilt || 0) * (1 - fl));
  ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = C.ink;
  ctx.fillStyle = fl > 0.4 ? 'rgba(20,60,90,0.3)' : 'rgba(90,50,30,0.35)'; ellipse(4, 22, 66, 12); ctx.fill();
  ctx.fillStyle = fl > 0.5 ? '#c8673f' : '#9a5236';
  ctx.beginPath(); ctx.moveTo(-64, -16); ctx.lineTo(46, -16); ctx.lineTo(68, 0); ctx.lineTo(46, 20); ctx.lineTo(-58, 20); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e6d3b0'; rr(-52, -9, 90, 20, 6); ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#f1e8d8'; rr(-40, -30, 42, 26, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = C.teal; ctx.fillRect(-34, -24, 9, 8); ctx.fillRect(-20, -24, 9, 8);
  if (fl < 0.5) { ctx.fillStyle = 'rgba(120,52,30,0.55)'; circle(20, 6, 6); ctx.fill(); circle(-6, 12, 4); ctx.fill(); circle(38, -6, 4); ctx.fill(); }
  ctx.restore();
}
// 물 빼돌리는 밸브: 열려 있으면 빨간 손잡이가 돌며 물을 빨아들인다. 부수면 잠긴다(초록)
function drawValve(g) {
  ctx.save(); ctx.translate(g.x + (g.hitT > 0 ? rand(-2, 2) : 0), g.y); ctx.scale(1.3, 1.3);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = 2.6; ctx.strokeStyle = C.ink;
  const on = g.alive;
  ctx.fillStyle = 'rgba(10,8,30,0.35)'; ellipse(0, 16, 32, 10); ctx.fill();
  ctx.fillStyle = '#3a3566'; rr(-30, 4, 60, 18, 8); ctx.fill(); ctx.stroke();
  ctx.fillStyle = on ? 'rgba(70,170,230,0.9)' : '#5b5880'; ctx.fillRect(-22, 9, 44, 8);
  if (on) { ctx.fillStyle = 'rgba(190,235,255,0.9)'; for (let k = 0; k < 3; k++) { const p = (G.t * 1.4 + k / 3) % 1; circle(-26 + p * 22 + k * 2, 13, 2.5); ctx.fill(); } }
  ctx.fillStyle = on ? (g.hitT > 0 ? '#fff' : '#e8e2d6') : '#a5a2bf'; rr(-17, -34, 34, 42, 9); ctx.fill(); ctx.stroke();
  ctx.fillRect(15, -18, 16, 20); ctx.strokeRect(15, -18, 16, 20);
  if (on) drawEye(0, -16, 7.5, g.icon ? 0 : Math.atan2(G.P.y - g.y, G.P.x - g.x), G.t);
  else { ctx.fillStyle = C.good; circle(0, -16, 6); ctx.fill(); ctx.stroke(); }
  ctx.save(); ctx.translate(0, -46); ctx.rotate(on ? G.t * 2.5 : 0);
  ctx.strokeStyle = on ? C.red : C.good; ctx.lineWidth = 5; circle(0, 0, 14); ctx.stroke();
  ctx.lineWidth = 3.5; ctx.beginPath(); for (let k = 0; k < 4; k++) { const a = k / 4 * TAU; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 13, Math.sin(a) * 13); } ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.fillStyle = C.cream; circle(0, -46, 4); ctx.fill(); ctx.stroke();
  if (on && !g.icon) {
    ctx.fillStyle = 'rgba(10,8,30,0.75)'; rr(-28, -80, 56, 8, 4); ctx.fill();
    ctx.fillStyle = C.amber; rr(-28, -80, 56 * Math.max(0, g.hp / g.maxHp), 8, 4); ctx.fill();
  }
  if (!g.icon) {
    const z = G.zones[G.zoneIdx], target = on && z && wallById(z.exit).gens.includes(g.id);
    const s = on ? (g.name || '밸브') : g.dome + ' · 잠김 ✓';
    setFont(13, 600); const tw = ctx.measureText(s).width + 16;
    rr(-tw / 2, -102, tw, 18, 9); ctx.fillStyle = target ? C.mustard : on ? 'rgba(27,24,56,0.85)' : 'rgba(20,70,60,0.92)'; ctx.fill();
    txt(s, 0, -93, 13, target ? C.ink : on ? C.cream : '#c8ffe4', 'center', { weight: 600 });
  }
  ctx.restore();
}
// 모래폭풍: 내 둘레만 보이게 화면을 모래로 덮는다. 탄·보스 공격·증거 구슬은 모래 너머로도 보이게 다시 그리고, 목표와 기록 칩은 신호로 깜박인다
function drawStorm() {
  const S = G.storm; if (!S || S.k < 0.01) return;
  const P = G.P, cam = G.cam, px = P.x - cam.x, py = P.y - 6 - cam.y, r = S.r, k = S.k;
  ctx.save();
  const gr = ctx.createRadialGradient(px, py, r * 0.6, px, py, r * 1.25);
  gr.addColorStop(0, 'rgba(150,72,40,0)'); gr.addColorStop(0.5, 'rgba(150,72,40,' + (0.78 * k).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(126,56,32,' + (0.95 * k).toFixed(3) + ')');
  ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  const dir = S.dir || 1, g = G.gust, blow = (g && g.phase === 'blow') || (G.boss && G.boss.pat && G.boss.pat.kind === 'gust' && G.boss.pat.t > 1);
  const len = blow ? 80 : 26;
  ctx.strokeStyle = 'rgba(246,200,150,' + (0.5 * k).toFixed(3) + ')'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < 80; i++) {
    const sp = 0.6 + (i % 5) * 0.15, x = (((i * 173 + (S.ph || 0) * sp) % (W + 120)) + W + 120) % (W + 120) - 60, y = (i * 97 + Math.sin(G.t * 1.3 + i) * 12 + 720) % H;
    ctx.moveTo(x, y); ctx.lineTo(x - dir * len, y + 3);
  }
  ctx.stroke();
  ctx.restore();
  // 모래 너머로도 보이는 것
  ctx.save(); ctx.translate(-Math.round(cam.x), -Math.round(cam.y));
  ctx.globalAlpha = Math.min(1, k * 1.2);
  for (const b of G.eB) { if (b.x < cam.x - 20 || b.x > cam.x + W + 20 || b.y < cam.y - 20 || b.y > cam.y + H + 20) continue; ctx.fillStyle = C.orange; circle(b.x, b.y, b.r); ctx.fill(); ctx.fillStyle = '#fff4c8'; circle(b.x, b.y, b.r * 0.5); ctx.fill(); }
  for (const s of G.shells || []) if (s.t >= 0) drawShell(s);
  if (G.boss && !G.boss.dead) { drawLasers(G.boss); G.boss.orbs.forEach(drawOrb); }
  ctx.restore();
  if (G.mode !== 'play' || G.boss) return;
  // 신호: 화면 안이지만 모래에 가린 목표(밸브·발생기)와 기록 칩
  const beacon = (wx, wy, label, col) => {
    const sx = wx - cam.x, sy = wy - cam.y;
    if (sx < 20 || sx > W - 20 || sy < 20 || sy > H - 20 || dist(sx, sy, px, py) < r * 0.85) return;
    const pu = 0.5 + 0.5 * Math.sin(G.t * 5);
    ctx.save(); ctx.globalAlpha = k;
    ctx.strokeStyle = col; ctx.lineWidth = 3; circle(sx, sy, 16 + pu * 10); ctx.stroke();
    ctx.fillStyle = col; circle(sx, sy, 7); ctx.fill();
    txt(label, sx, sy - 34, 15, col, 'center', { weight: 900, stroke: C.ink, sw: 4 });
    ctx.restore();
  };
  for (const gn of G.gens) if (isTargetGen(gn)) beacon(gn.x, gn.y - 30, gn.valve ? '밸브' : gn.socket ? '단말기' : '목표', C.mustard);
  for (const t of chipTargets()) beacon(t.x, t.y, '기록', C.tealL);
  // 돌풍 알림: 내 머리 위에 큰 화살표
  if (g && g.phase !== 'wait') {
    const warn = g.phase === 'warn', a = warn ? 0.6 + 0.4 * Math.sin(G.t * 14) : 1;
    ctx.save(); ctx.globalAlpha = a;
    const ar = g.dir > 0 ? '→ → →' : '← ← ←';
    txt(warn ? '돌풍이 와요! ' + ar : '돌풍! ' + ar, px, py - 96, warn ? 30 : 26, warn ? C.amberL : '#ffd9b8', 'center', { weight: 900, stroke: C.ink, sw: 7 });
    if (warn) txt('반대쪽으로 버티거나 대시!', px, py - 62, 19, C.cream, 'center', { weight: 600, stroke: C.ink, sw: 5 });
    ctx.restore();
  }
}
// 보스 경기장: 반박할 때마다 파이프가 닫히고 물웅덩이가 하나씩 생긴다
function drawArenaWater(a) {
  const b = G.boss, n = G.L.bossPipes, closed = b ? (b.dead ? n : n - (b.pipes == null ? n : b.pipes)) : 0;
  ctx.save(); ctx.globalAlpha = 0.55; ctx.fillStyle = saltPattern(); ctx.fillRect(a.x, 380, a.w, a.h - 380); ctx.restore();
  const spots = [[a.x + 170, 610, 150], [a.x + a.w - 170, 610, 150], [a.x + 140, 450, 120], [a.x + a.w - 140, 450, 120]];
  for (let i = 0; i < Math.min(closed, spots.length); i++) {
    const s = spots[i], wob = Math.sin(G.t * 2 + i) * 4;
    ctx.fillStyle = 'rgba(50,158,206,0.8)'; ellipse(s[0], s[1], s[2] + wob, s[2] * 0.45); ctx.fill();
    ctx.strokeStyle = 'rgba(225,250,255,0.6)'; ctx.lineWidth = 3; ellipse(s[0], s[1], s[2] * 0.7 + wob, s[2] * 0.3); ctx.stroke();
  }
}
function drawBossPipes(b) {
  const n = G.L.bossPipes, pos = [[-150, 50, 0.55], [-60, 90, 0.18], [60, 90, -0.18], [150, 50, -0.55]];
  for (let i = 0; i < n; i++) {
    const p = pos[i % pos.length], on = i < b.pipes;
    ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(p[2]); ctx.lineJoin = 'round'; ctx.lineWidth = 2.5; ctx.strokeStyle = C.ink;
    const len = on ? 120 : 46;
    ctx.fillStyle = on ? '#e8e2d6' : '#6b6890'; rr(-12, 0, 24, len, 9); ctx.fill(); ctx.stroke();
    if (on) { ctx.fillStyle = 'rgba(64,168,228,0.95)'; for (let k = 0; k < 4; k++) { const yy = len - ((G.t * 90 + k * 30) % len); circle(0, yy, 4); ctx.fill(); } ctx.fillStyle = C.amber; ctx.fillRect(-12, 30, 24, 6); }
    else { ctx.fillStyle = C.good; circle(0, len, 7); ctx.fill(); ctx.stroke(); }
    ctx.restore();
  }
  setFont(15, 600);
  const s = '물 빼는 파이프 ' + b.pipes + '/' + n, tw = ctx.measureText(s).width + 20;
  rr(-tw / 2, 132, tw, 24, 12); ctx.fillStyle = 'rgba(70,25,25,0.9)'; ctx.fill(); txt(s, 0, 145, 15, '#ffd0c8', 'center', { weight: 600 });
}
function checker(x, y, w, h, s) {
  for (let i = 0; i * s < w; i++) for (let j = 0; j * s < h; j++) { ctx.fillStyle = (i + j) % 2 ? '#1b1838' : '#fff4dc'; ctx.fillRect(x + i * s, y + j * s, Math.min(s, w - i * s), Math.min(s, h - j * s)); }
}
// 협곡 레이스 코스: 다져진 흙길, 흰 가장자리 선, 출발선
function drawTrack(tr) {
  const c = G.cam, y0 = Math.max(tr.y0, c.y - 10), y1 = Math.min(tr.y1, c.y + H + 10);
  if (y1 <= y0) return;
  ctx.fillStyle = 'rgba(86,30,24,0.42)'; ctx.fillRect(tr.x0, y0, tr.x1 - tr.x0, y1 - y0);
  ctx.fillStyle = 'rgba(255,244,220,0.5)'; ctx.fillRect(tr.x0 + 16, y0, 5, y1 - y0); ctx.fillRect(tr.x1 - 21, y0, 5, y1 - y0);
  ctx.fillStyle = 'rgba(255,244,220,0.15)';
  for (let k = 1; k < 4; k++) { const x = tr.x0 + (tr.x1 - tr.x0) * k / 4; for (let y = Math.floor(y0 / 120) * 120; y < y1; y += 120) ctx.fillRect(x - 2, y, 4, 60); }
  if (tr.startY && tr.startY > c.y - 60 && tr.startY < c.y + H + 60) {
    checker(tr.x0 + 21, tr.startY, tr.x1 - tr.x0 - 42, 24, 12);
    txt('출발선', (tr.x0 + tr.x1) / 2, tr.startY + 52, 28, 'rgba(255,244,220,0.45)', 'center', { weight: 900 });
  }
}
function drawCliff(s) {
  const c = G.cam; if (s.x > c.x + W || s.x + s.w < c.x || s.y > c.y + H || s.y + s.h < c.y) return;
  const y0 = Math.max(s.y, c.y - 10), y1 = Math.min(s.y + s.h, c.y + H + 10);
  const left = s.x === 0, inner = left ? s.x + s.w : s.x;
  ctx.fillStyle = '#5a2019'; ctx.fillRect(s.x, y0, s.w, y1 - y0);
  for (let y = Math.floor(y0 / 58) * 58; y < y1; y += 58) {
    const k = (Math.round(y / 58) * 7919 + (left ? 3 : 11)) % 97;
    ctx.fillStyle = k % 3 ? 'rgba(140,58,40,0.5)' : 'rgba(60,18,16,0.5)';
    ctx.fillRect(s.x + (k % 5) * 8, y + (k % 23), Math.max(10, s.w - (k % 7) * 10 - (k % 5) * 8), 10 + (k % 4) * 4);
  }
  ctx.fillStyle = '#7d3325'; ctx.fillRect(left ? inner - 26 : inner, y0, 26, y1 - y0);
  ctx.fillStyle = '#e08a5e'; ctx.fillRect(left ? inner - 5 : inner, y0, 5, y1 - y0);
  ctx.fillStyle = 'rgba(40,10,10,0.3)'; ctx.fillRect(left ? inner : inner - 14, y0, 14, y1 - y0);
}
// 가속 발판: 출전 금지 중에는 꺼져 있다(화성 태생 주자만 쓴다)
function drawBoost(b) {
  const c = G.cam; if (b.y < c.y - 60 || b.y > c.y + H + 60) return;
  const on = !G.restricted, w = 150, h = 60;
  ctx.save(); ctx.translate(b.x, b.y);
  rr(-w / 2, -h / 2, w, h, 14); ctx.fillStyle = on ? 'rgba(20,70,66,0.92)' : 'rgba(44,38,66,0.85)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = on ? C.tealL : '#6b668f'; ctx.stroke();
  ctx.save(); rr(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8, 10); ctx.clip();
  const p = on ? (G.t * 1.8) % 1 : 0;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 6; ctx.strokeStyle = on ? C.tealL : '#8e87bd';
  for (let k = -1; k < 3; k++) { const yy = 22 - k * 20 - p * 20; ctx.globalAlpha = on ? 0.95 : 0.3; ctx.beginPath(); ctx.moveTo(-28, yy + 9); ctx.lineTo(0, yy - 9); ctx.lineTo(28, yy + 9); ctx.stroke(); }
  ctx.restore(); ctx.globalAlpha = 1;
  if (!on) { rr(34, -12, 36, 24, 8); ctx.fillStyle = 'rgba(90,25,30,0.9)'; ctx.fill(); txt('꺼짐', 52, 1, 13, '#ffc2b8', 'center', { weight: 600 }); }
  ctx.restore();
}
function drawDeadDivider(d) {
  const c = G.cam; if (d.y0 > c.y + H + 20 || d.y1 < c.y - 20) return;
  ctx.fillStyle = 'rgba(40,36,70,0.5)'; ctx.fillRect(d.x - 3, d.y0, 6, d.y1 - d.y0);
  ctx.lineWidth = 2; ctx.strokeStyle = C.ink;
  for (let y = d.y0 + 10; y <= d.y1; y += 60) { ctx.fillStyle = '#4d4777'; rr(d.x - 9, y - 6, 18, 14, 4); ctx.fill(); ctx.stroke(); }
  txt('꺼진 분리선', d.x + 18, d.y0 + 62, 15, 'rgba(255,244,220,0.6)', 'left', { weight: 600 });
}
function drawPen(p) {
  const c = G.cam; if (p.y > c.y + H + 20 || p.y + p.h < c.y - 40) return;
  const on = G.restricted;
  ctx.save();
  rr(p.x, p.y, p.w, p.h, 18); ctx.fillStyle = on ? 'rgba(90,25,30,0.22)' : 'rgba(20,70,60,0.16)'; ctx.fill();
  ctx.setLineDash([16, 10]); ctx.lineWidth = 4; ctx.strokeStyle = on ? 'rgba(255,107,107,0.85)' : 'rgba(95,227,161,0.5)'; ctx.stroke(); ctx.setLineDash([]);
  const label = on ? '지구 출신 대기 구역 · 출전 금지' : '누구나 출전!';
  setFont(17, 600); const tw = ctx.measureText(label).width + 28;
  rr(p.x + p.w / 2 - tw / 2, p.y - 16, tw, 32, 16); ctx.fillStyle = on ? 'rgba(70,25,25,0.94)' : 'rgba(20,60,50,0.94)'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = on ? C.bad : C.good; ctx.stroke();
  txt(label, p.x + p.w / 2, p.y + 1, 17, on ? '#ffc2b8' : '#c8ffe4', 'center', { weight: 600 });
  ctx.restore();
}
// 출전 금지 차단막: 켜져 있으면 빨간 줄무늬 막대(나만 막힘), 꺼지면 열린 문
function drawBarrier(w) {
  const c = G.cam;
  if (w.x > c.x + W + 40 || w.x + w.w < c.x - 40 || w.y > c.y + H + 60 || w.y + w.h < c.y - 60) return;
  const a = w.active ? 1 : Math.max(0, w.fade), y = w.y, h = w.h;
  ctx.save();
  if (a > 0) {
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(224,87,62,0.2)'; ctx.fillRect(w.x, y - 12, w.w, h + 24);
    ctx.save(); ctx.beginPath(); ctx.rect(w.x, y - 2, w.w, h + 4); ctx.clip();
    ctx.fillStyle = '#e0573e'; ctx.fillRect(w.x, y - 2, w.w, h + 4);
    ctx.fillStyle = '#fff4dc';
    const off = (G.t * 40) % 44;
    for (let x = w.x - 44 + off; x < w.x + w.w + 22; x += 44) { ctx.beginPath(); ctx.moveTo(x, y + h + 2); ctx.lineTo(x + 14, y + h + 2); ctx.lineTo(x + 28, y - 2); ctx.lineTo(x + 14, y - 2); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    ctx.lineWidth = 2.5; ctx.strokeStyle = C.ink; ctx.strokeRect(w.x, y - 2, w.w, h + 4);
    if (w.w > 230) for (let x = w.x + 120; x < w.x + w.w - 80; x += 330) {
      rr(x - 58, y - 38, 116, 26, 13); ctx.fillStyle = 'rgba(70,25,25,0.94)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = C.bad; ctx.stroke();
      txt('출전 금지', x, y - 24, 15, '#ffd0c8', 'center', { weight: 900 });
    }
    ctx.globalAlpha = 1;
  } else { ctx.fillStyle = 'rgba(95,227,161,0.2)'; ctx.fillRect(w.x, y + 5, w.w, 8); }
  [w.x, w.x + w.w].forEach(px => {
    ctx.fillStyle = '#3a3566'; rr(px - 8, y - 18, 16, 46, 5); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = C.ink; ctx.stroke();
    ctx.fillStyle = w.active ? C.red : C.good; circle(px, y - 9, 5); ctx.fill(); ctx.stroke();
  });
  ctx.restore();
}
// 지나갈 수 있는 틈을 청록 화살표로 보여 준다
function drawBarGaps() {
  if (!G.L.barGaps || !mech('bar')) return;
  const p = (G.t * 1.6) % 1;
  for (const g of G.L.barGaps) {
    if (g.y < G.cam.y - 60 || g.y > G.cam.y + H + 60) continue;
    ctx.fillStyle = 'rgba(159,245,234,0.13)'; ctx.fillRect(g.x - g.w / 2 + 12, g.y - 70, g.w - 24, 140);
    ctx.fillStyle = C.tealL;
    for (let k = 0; k < 3; k++) { const yy = g.y + 52 - k * 36 - p * 36; ctx.globalAlpha = Math.max(0, 0.85 - k * 0.22 - p * 0.2); ctx.beginPath(); ctx.moveTo(g.x, yy - 12); ctx.lineTo(g.x + 22, yy + 9); ctx.lineTo(g.x - 22, yy + 9); ctx.closePath(); ctx.fill(); }
    ctx.globalAlpha = 1;
    txt('틈', g.x, g.y + 86, 18, C.tealL, 'center', { weight: 900, stroke: C.ink, sw: 4 });
  }
}
function drawStartGate(w) {
  const c = G.cam; if (w.y > c.y + H + 140 || w.y < c.y - 60) return;
  const cx = w.x + w.w / 2, open = !w.active;
  ctx.save(); ctx.lineWidth = 3; ctx.strokeStyle = C.ink;
  [w.x - 4, w.x + w.w + 4].forEach(px => { ctx.fillStyle = '#e8e2d6'; rr(px - 13, w.y - 96, 26, 122, 8); ctx.fill(); ctx.stroke(); ctx.fillStyle = open ? C.good : C.red; circle(px, w.y - 78, 7); ctx.fill(); ctx.stroke(); });
  ctx.fillStyle = '#e8e2d6'; rr(w.x - 4, w.y - 112, w.w + 8, 26, 10); ctx.fill(); ctx.stroke();
  const label = open ? '협곡 레이스 · 누구나 출발!' : '협곡 레이스 · 화성 태생만 출전';
  setFont(22, 900); const tw = ctx.measureText(label).width + 44;
  rr(cx - tw / 2, w.y - 134, tw, 48, 16); ctx.fillStyle = open ? 'rgba(20,60,50,0.96)' : 'rgba(70,25,25,0.96)'; ctx.fill(); ctx.strokeStyle = open ? C.good : C.bad; ctx.stroke();
  txt(label, cx, w.y - 109, 22, open ? '#c8ffe4' : '#ffd0c8', 'center', { weight: 900 });
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
  if (w.charter) { drawCharterGate(w); return; }
  if (w.workFence && w.active) { setFont(16, 600); const s = '작업 구역 · 산소 통을 다 올릴 때까지 자리 이탈 금지', tw = ctx.measureText(s).width + 26; rr(w.x + w.w / 2 - tw / 2, w.y - 36, tw, 28, 14); ctx.fillStyle = 'rgba(70,25,25,0.94)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = C.bad; ctx.stroke(); txt(s, w.x + w.w / 2, w.y - 21, 16, '#ffd0c8', 'center', { weight: 600 }); }
  if (w.barrier) { drawBarrier(w); return; }
  if (w.startGate) drawStartGate(w);
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
  if (!g.alive || G.boss || genShielded(g)) return false;
  const z = G.zones[G.zoneIdx];
  return !!z && wallById(z.exit).gens.includes(g.id);
}
function drawTargetRing(g) {
  const p = 1 + Math.sin(G.t * 5) * 0.08;
  ctx.save(); ctx.translate(g.x, g.y + 10);
  ctx.strokeStyle = 'rgba(247,197,72,0.9)'; ctx.lineWidth = 4; ctx.setLineDash([14, 10]); ctx.lineDashOffset = -G.t * 30;
  ctx.beginPath(); ctx.ellipse(0, 0, 62 * p, 26 * p, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  const by = (g.socket ? -182 : -150) + Math.sin(G.t * 6) * 7;
  rr(-38, by - 30, 76, 30, 15); ctx.fillStyle = C.mustard; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.stroke();
  txt('목표', 0, by - 14, 18, C.ink, 'center', { weight: 900 });
  ctx.fillStyle = C.mustard; ctx.beginPath(); ctx.moveTo(-12, by + 2); ctx.lineTo(12, by + 2); ctx.lineTo(0, by + 18); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}
function drawOffscreenTargets() {
  if (G.mode !== 'play' || G.boss) return;
  if (unityNeed()) G.caps.forEach(c => { if (!c.freed) edgeMarker(c.x, c.y, '동료', C.tealL); });
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
    if (!w.active || w.barrier || !w.gens.includes(g.id)) continue;
    const tx = clamp(g.x, w.x, w.x + w.w), ty = clamp(g.y, w.y, w.y + w.h);
    ctx.strokeStyle = 'rgba(255,177,46,0.45)'; ctx.lineWidth = 3; ctx.setLineDash([8, 10]); ctx.lineDashOffset = -G.t * 40;
    ctx.beginPath(); ctx.moveTo(g.x, g.y - 30); ctx.lineTo(tx, ty); ctx.stroke(); ctx.setLineDash([]);
  }
}
function drawGen(g) {
  if (g.socket) { drawSocket(g); return; }
  if (g.tower) { drawTower(g); return; }
  if (g.valve) { drawValve(g); return; }
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
    if (genShielded(g)) {
      ctx.fillStyle = 'rgba(255,177,46,0.14)'; circle(0, -24, 58); ctx.fill();
      ctx.strokeStyle = 'rgba(255,200,90,0.95)'; ctx.lineWidth = 3; ctx.setLineDash([10, 7]); ctx.lineDashOffset = -G.t * 30; circle(0, -24, 58); ctx.stroke(); ctx.setLineDash([]);
      const s2 = '혼자서는 못 멈춰요 · 동료 ' + G.settlers.length + '/' + g.needAllies;
      setFont(14, 600); const tw2 = ctx.measureText(s2).width + 18;
      rr(-tw2 / 2, 32, tw2, 21, 10); ctx.fillStyle = 'rgba(90,25,30,0.95)'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = C.bad; ctx.stroke();
      txt(s2, 0, 43, 14, '#ffd0c8', 'center', { weight: 600 });
    }
  }
  ctx.restore();
}
function drawCapsule(c) {
  if (c.kind === 'worker') { drawWorker(c); return; }
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
  if (G.L.bossPods && b.dying <= 0) drawBossPods(b);
  if (G.L.bossPipes && b.dying <= 0) drawBossPipes(b);
  if (G.L.finalBoss) drawBossEmblems(b);
  if (G.L.bossClock && b.dying <= 0) {
    const lit = b.round + (b.shield ? 0 : 1), R = 180;
    [['일 8', C.orange], ['쉼 8', C.teal], ['하고 싶은 일 8', C.mustard]].forEach((s, i) => {
      const a0 = -Math.PI / 2 + i * TAU / 3 + 0.07, a1 = a0 + TAU / 3 - 0.14, on = lit > i, am = (a0 + a1) / 2;
      ctx.strokeStyle = on ? s[1] : 'rgba(255,244,220,0.16)'; ctx.lineWidth = on ? 12 : 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 0, R, a0, a1); ctx.stroke();
      if (on) txt(s[0], Math.cos(am) * (R + 34), Math.sin(am) * (R + 26), 18, s[1], 'center', { weight: 900, stroke: C.ink, sw: 5 });
    });
  }
  if (b.stun > 0) txt('흔들림!', 0, -150, 22, C.tealL, 'center', { stroke: C.ink, sw: 5 });
  ctx.restore();
}
// 오더 본체: 둘레를 도는 다섯 문양. 반박할 때마다 하나씩 청록으로 꺼진다. 멈추면 눈이 깜박이며 오류를 말한다
function drawBossEmblems(b) {
  const lit = b.dying > 0 ? EMBLEMS6.length : b.round + (b.shield ? 0 : 1), n = EMBLEMS6.length;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + i / n * TAU + b.t * 0.25, x = Math.cos(a) * 215, y = Math.sin(a) * 120 - 6;
    const off = i < lit, cur = i === b.round && !off;
    const r = cur ? 27 + Math.sin(b.t * 6) * 2 : 23;
    ctx.fillStyle = off ? 'rgba(20,90,80,0.92)' : 'rgba(80,30,20,0.92)'; circle(x, y, r); ctx.fill();
    ctx.lineWidth = cur ? 4 : 2.5; ctx.strokeStyle = off ? C.tealL : cur ? C.amberL : C.amber; ctx.stroke();
    drawProblemGlyph(EMBLEMS6[i], x, y, 1.15, !off);
  }
  if (b.dying > 0) {
    const fl = Math.floor(b.t * 12) % 3;
    ctx.fillStyle = fl ? 'rgba(159,245,234,0.85)' : 'rgba(255,177,46,0.85)'; circle(0, -14, 15); ctx.fill();
    ctx.save(); ctx.globalAlpha = 0.65 + 0.35 * Math.sin(b.t * 37);
    txt('오류… 오류…', rand(-3, 3), -190, 28, C.tealL, 'center', { weight: 900, stroke: C.ink, sw: 6 });
    ctx.restore();
  }
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
    } else if (l.kind === 'hand') {
      const ox = b.x, oy = b.y + 40;
      ctx.save(); ctx.beginPath(); ctx.rect(a.x, a.y, a.w, a.h); ctx.clip();
      ctx.save(); ctx.translate(ox, oy); ctx.rotate(l.a);
      if (l.warn) { ctx.fillStyle = 'rgba(255,90,90,' + (0.3 + 0.25 * Math.sin(G.t * 30)) + ')'; ctx.fillRect(70, -3, l.len - 70, 6); }
      else {
        ctx.fillStyle = 'rgba(255,160,40,0.3)'; ctx.fillRect(70, -24, l.len - 70, 48);
        ctx.fillStyle = 'rgba(255,190,60,0.9)'; ctx.fillRect(70, -11, l.len - 70, 22);
        ctx.fillStyle = '#fff6d6'; ctx.fillRect(70, -4, l.len - 70, 8);
      }
      ctx.restore();
      // 도는 방향
      const aa = l.a + l.dir * 0.2, ab = l.a + l.dir * (l.warn ? 0.75 : 0.5);
      ctx.strokeStyle = 'rgba(255,226,154,' + (l.warn ? 0.9 : 0.5) + ')'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(ox, oy, 250, aa, ab, l.dir < 0); ctx.stroke();
      const hx = ox + Math.cos(ab) * 250, hy = oy + Math.sin(ab) * 250, ta = ab + l.dir * Math.PI / 2;
      ctx.fillStyle = 'rgba(255,226,154,' + (l.warn ? 0.9 : 0.5) + ')'; ctx.beginPath(); ctx.moveTo(hx + Math.cos(ta) * 18, hy + Math.sin(ta) * 18); ctx.lineTo(hx + Math.cos(ta + 2.5) * 14, hy + Math.sin(ta + 2.5) * 14); ctx.lineTo(hx + Math.cos(ta - 2.5) * 14, hy + Math.sin(ta - 2.5) * 14); ctx.closePath(); ctx.fill();
      ctx.restore();
      if (l.warn && l === b.lasers[0]) txt('시곗바늘이 돌아요! 앞서 달리거나 대시로 넘어요', a.x + a.w / 2, 452, 24, C.amberL, 'center', { weight: 900, stroke: C.ink, sw: 6 });
    } else if (l.kind === 'floor') {
      const y0 = 440, hh = a.h - y0, p = (G.t * 1.5) % 1;
      ctx.save(); ctx.beginPath(); ctx.rect(a.x, y0, a.w, hh); ctx.clip();
      ctx.fillStyle = 'rgba(30,28,56,' + (l.warn ? 0.3 : 0.5) + ')'; ctx.fillRect(a.x, y0, a.w, hh);
      ctx.strokeStyle = 'rgba(255,196,90,' + (l.warn ? 0.35 : 0.75) + ')'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let yy = y0 + 46; yy < a.h; yy += 84) for (let xx = a.x - 110; xx < a.x + a.w + 110; xx += 110) { const x = xx + (l.warn ? 0 : p * 110 * l.dir); ctx.beginPath(); ctx.moveTo(x - 12 * l.dir, yy - 18); ctx.lineTo(x + 10 * l.dir, yy); ctx.lineTo(x - 12 * l.dir, yy + 18); ctx.stroke(); }
      const ex0 = l.dir > 0 ? l.edge : a.x, ex1 = l.dir > 0 ? a.x + a.w : l.edge;
      ctx.fillStyle = l.warn ? 'rgba(255,90,90,' + (0.2 + 0.15 * Math.sin(G.t * 24)) + ')' : 'rgba(224,87,62,0.6)'; ctx.fillRect(ex0, y0, ex1 - ex0, hh);
      ctx.strokeStyle = 'rgba(255,244,220,0.4)'; ctx.lineWidth = 10; for (let x = ex0 - hh; x < ex1; x += 46) { ctx.beginPath(); ctx.moveTo(x, y0 + hh); ctx.lineTo(x + hh, y0); ctx.stroke(); }
      ctx.restore();
      txt('압착기!', (ex0 + ex1) / 2, y0 + 30, 22, C.bad, 'center', { weight: 900, stroke: C.ink, sw: 5 });
      if (l.warn) txt('바닥이 밀어내요! 반대쪽으로 버텨요', a.x + a.w / 2, 452, 24, C.amberL, 'center', { weight: 900, stroke: C.ink, sw: 6 });
    } else if (l.kind === 'area') {
      const y0 = 430, hh = a.h - y0;
      [[a.x, l.x0], [l.x1, a.x + a.w]].forEach(([x0, x1]) => {
        ctx.fillStyle = l.warn ? 'rgba(255,90,90,' + (0.14 + 0.12 * Math.sin(G.t * 24)) + ')' : 'rgba(224,87,62,0.55)'; ctx.fillRect(x0, y0, x1 - x0, hh);
        if (!l.warn) { ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, hh); ctx.clip(); ctx.strokeStyle = 'rgba(255,244,220,0.35)'; ctx.lineWidth = 10; for (let x = x0 - hh; x < x1; x += 46) { ctx.beginPath(); ctx.moveTo(x, y0 + hh); ctx.lineTo(x + hh, y0); ctx.stroke(); } ctx.restore(); }
      });
      ctx.fillStyle = 'rgba(95,227,161,' + (l.warn ? 0.16 + 0.1 * Math.sin(G.t * 10) : 0.12) + ')'; ctx.fillRect(l.x0, y0, l.x1 - l.x0, hh);
      ctx.strokeStyle = C.good; ctx.lineWidth = 4; ctx.setLineDash([12, 8]); ctx.strokeRect(l.x0, y0, l.x1 - l.x0, hh); ctx.setLineDash([]);
      txt(l.warn ? '여기로!' : '안전', (l.x0 + l.x1) / 2, y0 + 30, 24, C.good, 'center', { weight: 900, stroke: C.ink, sw: 5 });
    } else if (l.kind === 'drain') {
      // 배수구 소용돌이: 경고 동안은 점선 원, 그 뒤에는 도는 물결(가운데가 아프다)
      ctx.save(); ctx.lineCap = 'round';
      if (l.warn) {
        ctx.setLineDash([12, 9]); ctx.lineDashOffset = -G.t * 40; ctx.strokeStyle = 'rgba(255,120,90,' + (0.6 + 0.4 * Math.sin(G.t * 20)) + ')'; ctx.lineWidth = 4;
        ellipse(l.x, l.y, l.r, l.r * 0.62); ctx.stroke(); ctx.setLineDash([]);
        txt('배수구!', l.x, l.y - l.r * 0.62 - 18, 20, C.bad, 'center', { weight: 900, stroke: C.ink, sw: 5 });
      } else {
        ctx.fillStyle = 'rgba(40,90,130,0.45)'; ellipse(l.x, l.y, l.r, l.r * 0.62); ctx.fill();
        for (let k = 0; k < 4; k++) {
          const rr2 = l.r * (1 - k * 0.22), a0 = G.t * (5 + k) + k * 1.6;
          ctx.strokeStyle = k % 2 ? 'rgba(200,240,255,0.85)' : 'rgba(110,190,235,0.9)'; ctx.lineWidth = 5 - k;
          ctx.beginPath(); ctx.ellipse(l.x, l.y, rr2, rr2 * 0.62, 0, a0, a0 + 4.2); ctx.stroke();
        }
        ctx.fillStyle = '#1b2c4a'; ellipse(l.x, l.y, 22, 14); ctx.fill(); ctx.strokeStyle = C.bad; ctx.lineWidth = 3; ellipse(l.x, l.y, 28, 18); ctx.stroke();
      }
      ctx.restore();
      if (l.warn && l === b.lasers[0]) txt('배수구가 끌어당겨요! 원 밖으로 빠져나가요', a.x + a.w / 2, 452, 24, C.amberL, 'center', { weight: 900, stroke: C.ink, sw: 6 });
    } else if (l.kind === 'gust') {
      const y0 = 440, p = (G.t * (l.warn ? 1.2 : 3)) % 1;
      ctx.save(); ctx.beginPath(); ctx.rect(a.x, y0, a.w, a.h - y0); ctx.clip();
      ctx.strokeStyle = 'rgba(246,200,150,' + (l.warn ? 0.4 : 0.75) + ')'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let yy = y0 + 40; yy < a.h; yy += 90) for (let xx = a.x - 140; xx < a.x + a.w + 140; xx += 140) { const x = xx + p * 140 * l.dir; ctx.beginPath(); ctx.moveTo(x - 14 * l.dir, yy - 16); ctx.lineTo(x + 10 * l.dir, yy); ctx.lineTo(x - 14 * l.dir, yy + 16); ctx.stroke(); }
      ctx.restore();
      if (l.warn) txt('돌풍! ' + (l.dir > 0 ? '→ 오른쪽으로 밀려요' : '← 왼쪽으로 밀려요') + ' · 탄 줄의 빈칸으로', a.x + a.w / 2, 452, 24, C.amberL, 'center', { weight: 900, stroke: C.ink, sw: 6 });
    } else if (l.kind === 'storm') {
      if (l.warn) txt('모래폭풍! 빛나는 증거 구슬은 모래 너머로도 보여요', a.x + a.w / 2, 452, 24, C.amberL, 'center', { weight: 900, stroke: C.ink, sw: 6 });
    } else if (l.kind === 'h') {
      const segs = [[a.x, l.gap - 95], [l.gap + 95, a.x + a.w]];
      segs.forEach(([x0, x1]) => {
        if (l.warn) { ctx.fillStyle = 'rgba(255,90,90,' + (0.25 + 0.25 * Math.sin(G.t * 30)) + ')'; ctx.fillRect(x0, l.y - 3, x1 - x0, 6); }
        else {
          if (l.bar) {
            ctx.fillStyle = 'rgba(224,87,62,0.28)'; ctx.fillRect(x0, l.y - 22, x1 - x0, 44);
            ctx.save(); ctx.beginPath(); ctx.rect(x0, l.y - 11, x1 - x0, 22); ctx.clip(); ctx.fillStyle = '#e0573e'; ctx.fillRect(x0, l.y - 11, x1 - x0, 22); ctx.fillStyle = '#fff4dc';
            for (let x = x0 - 44 + (G.t * 60) % 44; x < x1 + 22; x += 44) { ctx.beginPath(); ctx.moveTo(x, l.y + 11); ctx.lineTo(x + 14, l.y + 11); ctx.lineTo(x + 28, l.y - 11); ctx.lineTo(x + 14, l.y - 11); ctx.closePath(); ctx.fill(); }
            ctx.restore(); ctx.lineWidth = 2.5; ctx.strokeStyle = C.ink; ctx.strokeRect(x0, l.y - 11, x1 - x0, 22);
          } else {
          ctx.fillStyle = 'rgba(255,160,40,0.3)'; ctx.fillRect(x0, l.y - 22, x1 - x0, 44);
          ctx.fillStyle = 'rgba(255,190,60,0.85)'; ctx.fillRect(x0, l.y - 10, x1 - x0, 20);
          ctx.fillStyle = '#fff6d6'; ctx.fillRect(x0, l.y - 3, x1 - x0, 6);
          }
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
  if (G.L.sockets && G.mode !== 'brief' && G.mode !== 'rules') { drawCoreHud(); drawTicker(); }
  else if (G.L.fatigue && G.mode !== 'brief' && G.mode !== 'rules') {
    const f = G.fatigue || 0, full = f >= 1 && G.restricted, show = G.restricted || f > 0.01 || G.t - G.freeT < 6;
    if (show) {
      const blink = full && Math.floor(G.t * 4) % 2 === 0, on = G.restricted;
      panel(14, 110, 340, 88, { fill: on ? 'rgba(64,30,84,0.92)' : 'rgba(20,70,60,0.92)', stroke: on ? (blink ? C.bad : '#d9b8ff') : C.good, r: 16, lw: full ? 3 : 2 });
      // 연속 가동 시계: 낮(해)과 밤(달)이 바뀌어도 숫자는 계속 올라간다
      const hod = G.shiftH % 24, night = on && hod >= 8 && hod < 20;
      ctx.fillStyle = night ? '#fff4dc' : C.mustard; circle(36, 130, 10); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = C.ink; ctx.stroke();
      if (night) { ctx.fillStyle = on ? 'rgba(64,30,84,1)' : 'rgba(20,70,60,1)'; circle(41, 126, 8); ctx.fill(); }
      txt(on ? '연속 가동 ' + Math.floor(G.shiftH) + '시간째 · 교대 없음' : '퇴근! 이제 8시간만 일해요', 56, 131, 19, on ? C.amberL : '#c8ffe4', 'left', { weight: 900 });
      txt(on ? (full ? '지쳤어요! 느려지고 체력이 빨리 줄어요' : '쉬지 못해 피로가 쌓이고 체력이 줄어요') : (f > 0.01 ? '쉼터에서 쉬면 피로가 풀려요' : '푹 쉬었어요'), 184, 157, 15, on ? '#f0e2ff' : '#c8ffe4', 'center', { weight: 600 });
      txt('피로', 30, 180, 15, on ? '#e3c8ff' : '#c8ffe4', 'left', { weight: 900 });
      rr(72, 173, 268, 14, 7); ctx.fillStyle = 'rgba(10,8,30,0.8)'; ctx.fill();
      if (f > 0.005) { rr(72, 173, 268 * f, 14, 7); ctx.fillStyle = on ? (full ? C.bad : '#b98cff') : C.good; ctx.fill(); }
    }
  } else if (G.arms && G.mode !== 'brief' && G.mode !== 'rules') {
    const on = G.restricted, A = G.arms, mx = 40;
    panel(14, 110, 340, 92, { fill: on ? 'rgba(80,26,30,0.92)' : 'rgba(20,70,60,0.92)', stroke: on ? C.bad : C.good, r: 16, lw: 2 });
    txt(on ? '무기 경쟁 중 · 한쪽이 늘리면 다른 쪽도' : '무기 경쟁이 멈췄어요', 184, 128, 16, on ? '#ffd0c8' : '#c8ffe4', 'center', { weight: 600 });
    [['a', '알파 돔 무기'], ['b', '베타 돔 무기']].forEach(([k, nm], i) => {
      const y = 150 + i * 28, v = Math.ceil(A[k]), fl = Math.max(0, G.armsFlash[k]);
      txt(nm, 30, y, 15, C.cream, 'left', { weight: 600 });
      rr(132, y - 7, 160, 14, 7); ctx.fillStyle = 'rgba(10,8,30,0.8)'; ctx.fill();
      if (v > 0) { rr(132, y - 7, 160 * Math.min(1, v / mx), 14, 7); ctx.fillStyle = fl > 0 ? '#fff0c8' : on ? C.orange : C.good; ctx.fill(); }
      txt(String(v), 340, y, 19 + fl * 6, fl > 0 ? C.amberL : C.cream, 'right', { weight: 900 });
    });
    if (!on && (G.L.launchers || []).some(l => l.resid) && Math.floor(G.t * 3) % 2 === 0) { rr(244, 116, 100, 22, 11); ctx.fillStyle = 'rgba(120,20,30,0.95)'; ctx.fill(); txt('잔여 신호 1', 294, 127, 13, '#ffd0c8', 'center', { weight: 600 }); }
  } else if (G.L.storm && G.mode !== 'brief' && G.mode !== 'rules') {
    // 모래폭풍 계기판: 호수 물(%)과 함께 지키는 돔(n/4)
    const on = G.restricted, total = G.L.storm.domes;
    panel(14, 110, 340, 92, { fill: on ? 'rgba(92,46,26,0.92)' : 'rgba(20,70,60,0.92)', stroke: on ? '#f0a070' : C.good, r: 16, lw: 2 });
    txt(on ? '모래폭풍 · 앞이 잘 안 보여요' : '호수에 물이 돌아왔어요!', 184, 128, 16, on ? '#ffd9b8' : '#c8ffe4', 'center', { weight: 600 });
    txt('호수 물', 30, 152, 15, C.cream, 'left', { weight: 600 });
    rr(132, 145, 160, 14, 7); ctx.fillStyle = 'rgba(10,8,30,0.8)'; ctx.fill();
    rr(132, 145, 160 * clamp(G.water / 100, 0.04, 1), 14, 7); ctx.fillStyle = '#4fb6e8'; ctx.fill();
    txt(Math.round(G.water) + '%', 340, 152, 18, C.cream, 'right', { weight: 900 });
    txt('함께 지키는 돔', 30, 181, 15, C.cream, 'left', { weight: 600 });
    for (let i = 0; i < total; i++) {
      const dx = 150 + i * 36, dy = 189, j = i < G.domes;
      ctx.fillStyle = j ? C.tealL : 'rgba(255,244,220,0.18)'; ctx.beginPath(); ctx.arc(dx, dy, 13, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = j ? C.ink : 'rgba(255,244,220,0.45)'; ctx.stroke();
    }
    txt(G.domes + '/' + total, 340, 181, 18, G.domes >= total ? C.good : C.amberL, 'right', { weight: 900 });
  } else if (G.L.restrict && G.mode !== 'brief' && G.mode !== 'rules') {
    if (G.restricted) { panel(14, 110, 340, 34, { fill: 'rgba(90,25,30,0.88)', stroke: C.bad, r: 17, lw: 2 }); txt(G.L.restrict.hud || '지구 출신 · 이동 느림 · 대시 금지', 184, 127, 16, '#ffd0c8', 'center', { weight: 600 }); }
    else if (G.t - G.freeT < 6) { panel(14, 110, 340, 34, { fill: 'rgba(20,70,60,0.9)', stroke: C.good, r: 17, lw: 2 }); txt(G.L.restrict.hudFree || '제한 해제! 어디든 갈 수 있어요', 184, 127, 16, '#c8ffe4', 'center', { weight: 600 }); }
  }
  const recs = D.records.filter(r => r.stage === G.def.id), got = recs.filter(r => save.records[r.id]).length;
  panel(W - 304, 12, 236, 70, { fill: 'rgba(27,24,56,0.85)', r: 16 });
  txt(G.def.id + ' · ' + G.def.name, W - 290, 34, 18, C.cream, 'left');
  txt((G.L.sockets ? '제도 카드 ' + G.sockets + '/' + G.L.sockets : '기록 ' + got + '/' + recs.length) + '   ' + fmtTime(G.time), W - 290, 62, 16, C.tealL, 'left', { weight: 700 });
  const pb = button(W - 60, 14, 46, 46, '', () => { if (G.mode === 'play') { G.mode = 'pause'; ui.focus = 0; } }, { focusable: false, draw: false });
  panel(W - 60, 14, 46, 46, { fill: pb.hover ? C.mustard : 'rgba(27,24,56,0.85)', r: 12 });
  ctx.fillStyle = pb.hover ? C.ink : C.cream; ctx.fillRect(W - 46, 26, 6, 22); ctx.fillRect(W - 34, 26, 6, 22);
  if (G.settlers.length) {
    const n = G.settlers.length, label = '동료 ' + n + '명 · 공격 +' + allyPct(n) + '% · 막아 주기';
    setFont(17, 600); const lw2 = ctx.measureText(label).width;
    const pw2 = 30 + n * 28 + lw2 + 20;
    const bx2 = touchUI() ? 250 : 14;
    panel(bx2, H - 64, pw2, 50, { fill: 'rgba(27,24,56,0.85)', stroke: C.tealL, r: 14, lw: 2 });
    G.settlers.forEach((s, i) => { ctx.fillStyle = s.look.suit; circle(bx2 + 24 + i * 28, H - 39, 11); ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.stroke(); if (!(s.guardAt > G.t)) { ctx.strokeStyle = C.tealL; ctx.lineWidth = 2.5; circle(bx2 + 24 + i * 28, H - 39, 15); ctx.stroke(); } });
    txt(label, bx2 + 18 + n * 28, H - 39, 17, C.tealL, 'left', { weight: 600 });
  }
  let obj = '';
  if (G.boss && !G.boss.dead) obj = '';
  else if (workOn()) obj = '지금 할 일 ▶ ' + (G.work.carry ? '산소 통을 벨트에 올리기' : '산소 통 들기') + ' (' + G.work.n + '/' + G.L.work.need + ')';
  else if (coreObjective()) obj = '지금 할 일 ▶ ' + coreObjective().text;
  else if (G.coach && G.coach.steps[G.coach.step]) obj = '지금 할 일 ▶ ' + G.coach.steps[G.coach.step].title;
  else if (G.race && G.race.on) obj = '지금 할 일 ▶ 차단막의 틈으로 달리기! 뒤처지면 다쳐요 ▲';
  else if (unityNeed()) obj = '지금 할 일 ▶ 일하는 정착민 풀어 주기 (' + G.settlers.length + '/' + unityNeed().needAllies + ')';
  else if (restNudge()) obj = '지금 할 일 ▶ 쉼터에 들어가 쉬어 보세요 (피로 풀기)';
  else if (G.zoneIdx >= 0) {
    const w = wallById(G.zones[G.zoneIdx].exit);
    const left = w.gens.filter(id => G.gens.find(g => g.id === id).alive).length;
    const named = w.gens.map(id => G.gens.find(g => g.id === id)).find(g => g.alive && g.name);
    const chipsObj = '지금 할 일 ▶ 기록 칩 모두 모으기 (' + (fieldRecords().length - recordsLeft()) + '/' + fieldRecords().length + ')';
    const z0 = G.zones[G.zoneIdx], chipsHere = recordGateNeeded() && chipTargets().some(c => (c.y >= z0.y0 && c.y < z0.y1) || (zoneIndexAt(c.y) < G.zoneIdx && !G.restricted));
    const towersW = w.gens.length && w.gens.every(id => G.gens.find(g => g.id === id).tower);
    const valvesW = w.gens.length && w.gens.every(id => G.gens.find(g => g.id === id).valve);
    const sockLeft = w.gens.map(id => G.gens.find(g => g.id === id)).filter(g => g.alive && g.socket);
    if (sockLeft.length) obj = '지금 할 일 ▶ ' + sockLeft[0].name + ' 열기';
    else if (valvesW && left) obj = w.gens.length === 1 && named ? '지금 할 일 ▶ ' + named.name + ' 잠그기 (부수면 잠겨요)' : '지금 할 일 ▶ 다른 돔 밸브 잠그기 (함께 지키는 돔 ' + G.domes + '/' + G.L.storm.domes + ')';
    else if (towersW && left) obj = '지금 할 일 ▶ 연대 송신탑 켜기 · 원 안에서 버티기 (' + (w.gens.length - left) + '/' + w.gens.length + ')';
    else obj = named && left === 1 ? '지금 할 일 ▶ ' + named.name + ' 부수기' : left ? '지금 할 일 ▶ ' + (named && w.gens.map(id => G.gens.find(g => g.id === id)).filter(g => g.alive).every(g => g.name === named.name) ? named.name : '발생기') + ' ' + left + '개 부수기' : ((chipsHere || (G.zoneIdx === G.zones.length - 1 && recordGateNeeded())) ? chipsObj : '지금 할 일 ▶ 위로 나아가기 ▲');
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
    txt(touchUI() ? "'파동' 버튼으로 탄 지우기! (E)" : 'E: 공명 파동으로 탄 지우기!', hx - (touchUI() ? 0 : 20), hy - (touchUI() ? 84 : 66), 22, C.tealL, touchUI() ? 'center' : 'right', { weight: 900, stroke: C.ink, sw: 5 });
  }
  const dashR = P.dashCd > 0 ? P.dashCd / G.st.dashCd : 0, skR = G.skillCd > 0 ? G.skillCd / skillCdOf(sk) : 0;
  if (skR <= 0 && G.skWas > 0) G.skReadyAt = G.t;
  G.skWas = skR;
  const rdy = G.t - (G.skReadyAt == null ? -9 : G.skReadyAt);
  if (rdy < 1.2) {
    const sx = touchUI() ? W - 270 : W - 64, sy = touchUI() ? H - 86 : H - 52, sr = touchUI() ? 54 : 36;
    ctx.strokeStyle = 'rgba(159,245,234,' + Math.max(0, 1 - rdy / 0.7) + ')'; ctx.lineWidth = 5; circle(sx, sy, sr + rdy * 46); ctx.stroke();
    txt('준비!', sx, sy - sr - 18, 20, C.tealL, 'center', { weight: 900, stroke: C.ink, sw: 5 });
  }
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
    touchBtn(W - 120, H - 120, 70, '대시', dashR, () => { touchAct.dash = true; }, mech('lane') && G.L.restrict.noDash);
    const tq = G.quiz && G.quiz.type === 'timing';
    touchBtn(W - 270, H - 86, 54, tq ? '이거!' : D.skills[sk].name.split(' ').pop(), tq ? 0 : skR, () => { touchAct.skill = true; }, false, tq ? 0 : G.skillCd);
  } else {
    cdIcon(W - 150, H - 52, '대시', 'Shift', dashR);
    cdIcon(W - 64, H - 52, D.skills[sk].name, 'E', skR, G.skillCd);
  }
}
// 둘레 게이지: 다시 쓸 수 있을 때까지 시계 방향으로 차오른다. 1초 넘게 남았으면 남은 초를 숫자로 보여 준다
function cdRing(x, y, r, cdRatio, lw) {
  const ready = !(cdRatio > 0);
  ctx.save(); ctx.lineWidth = lw; ctx.strokeStyle = 'rgba(255,244,220,0.18)'; circle(x, y, r); ctx.stroke();
  ctx.strokeStyle = ready ? C.tealL : C.mustard; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * (ready ? 1 : Math.max(0.001, 1 - cdRatio))); ctx.stroke();
  ctx.restore();
}
function touchBtn(x, y, r, label, cdRatio, fn, locked, left) {
  button(x - r, y - r, r * 2, r * 2, '', fn, { focusable: false, draw: false });
  ctx.fillStyle = locked ? 'rgba(90,25,30,0.7)' : 'rgba(27,24,56,0.7)'; circle(x, y, r); ctx.fill();
  cdRing(x, y, r, cdRatio, r > 40 ? 7 : 6);
  if (cdRatio > 0 && left >= 1) {
    txt(String(Math.ceil(left)), x, y - 6, r > 40 ? 34 : 28, C.cream, 'center', { weight: 900 });
    txt(label, x, y + (r > 40 ? 24 : 20), 13, '#bdb6e6', 'center', { weight: 600 });
  } else txt(label, x, y, r > 40 ? 24 : 20, locked ? '#ffb3a8' : cdRatio > 0 ? '#bdb6e6' : C.cream, 'center', { weight: 900 });
  if (locked) txt('금지', x, y + 26, 13, '#ffb3a8', 'center', { weight: 600 });
}
function cdIcon(x, y, name, key, cdRatio, left) {
  const r = 36, short = name.length > 5 ? name.slice(0, 5) + '…' : name;
  ctx.fillStyle = 'rgba(27,24,56,0.9)'; circle(x, y, r); ctx.fill();
  cdRing(x, y, r, cdRatio, 6);
  if (cdRatio > 0 && left >= 1) {
    txt(String(Math.ceil(left)), x, y - 6, 26, C.cream, 'center', { weight: 900 });
    txt(short, x, y + 15, 11, '#bdb6e6', 'center', { weight: 700 });
  } else {
    txt(key, x, y - 7, 15, cdRatio > 0 ? '#8e87bd' : C.mustard, 'center');
    txt(short, x, y + 12, 12, cdRatio > 0 ? '#bdb6e6' : C.cream, 'center', { weight: 700 });
  }
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
    G.L.sockets ? { t: G.L.restrict.mission, v: G.sockets + '/' + G.L.sockets, done: G.sockets >= G.L.sockets }
      : { t: G.L.restrict ? (G.L.restrict.mission || '레이저 벽·분리선 끄기') : '레이저 벽 끄기', v: wallsDone + '/' + mainWalls.length, done: wallsDone === mainWalls.length },
    { t: G.L.capLabel || '정착민 구하기', v: G.stats.rescued + '/' + G.caps.length, done: G.stats.rescued === G.caps.length, opt: !G.L.capsRequired },
    { t: '기록 칩 모두 모으기', v: got + '/' + recs.length, done: got === recs.length }
  ];
  if (!recs.length) items.splice(2, 1);
  if (!G.caps.length) items.splice(1, 1);
  items.push({ t: '보스 「' + G.def.boss.name + '」 반박', v: '0/' + rounds, done: false });
  const cur = items.findIndex(i => !i.done && !i.opt);
  const sig = items.map(i => i.v).join('|');
  if (G.missionSig !== sig) { G.missionSig = sig; G.missionAt = G.t; }
  const open = G.missionPinned || G.t - (G.missionAt || 0) < 5;
  if (!open) {
    const st = button(W - 154, 90, 140, 34, '', () => { G.missionPinned = true; }, { focusable: false, draw: false });
    panel(W - 154, 90, 140, 34, { fill: st.hover ? 'rgba(60,52,120,0.9)' : 'rgba(27,24,56,0.75)', r: 17, lw: 2 });
    txt('미션 보기 ▾', W - 84, 107, 15, C.mustard, 'center', { weight: 600 });
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
  const items = G.L.legend || [
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
    const tl = wrap(it.t, w - 118, 16, 600), lh2 = 21, top2 = y + (h - (31 + tl.length * lh2)) / 2;
    txt(it.n, x + 106, top2 + 13, 22, C.cream, 'left', { weight: 900 });
    tl.forEach((l, k) => txt(l, x + 106, top2 + 31 + lh2 / 2 + k * lh2, 16, '#d8d1fa', 'left', { weight: 600 }));
  });
  const flow = G.L.flow || (G.L.restrict ? ['발생기 부수기', '분리선 끄기', '기록 칩 모두 모으기', '보스를 증거로 반박'] : ['발생기 부수기', '레이저 벽 통과', '기록 칩 모두 모으기', '보스를 증거로 반박']);
  const fg = flow.length > 4 ? 26 : 34, fw = Math.min(248, (1160 - (flow.length - 1) * fg) / flow.length), fx0 = W / 2 - (flow.length * fw + (flow.length - 1) * fg) / 2;
  flow.forEach((f, i) => {
    const x = fx0 + i * (fw + fg), y = 506, last = i === flow.length - 1;
    rr(x, y - 22, fw, 44, 22); ctx.fillStyle = last ? 'rgba(224,87,62,0.35)' : 'rgba(247,197,72,0.18)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = last ? C.red : C.mustard; ctx.stroke();
    txt((i + 1) + '. ' + f, x + fw / 2, y, flow.length > 4 ? 17 : 19, C.cream, 'center', { weight: 600 });
    if (!last) txt('▶', x + fw + fg / 2, y, 18, C.mustard, 'center');
  });
  const ctrl = '이동: 왼쪽 화면 끌기 · 공격: 자동 · 대시·공명 파동: 오른쪽 아래 버튼   (키보드: WASD 이동 · Shift 대시 · E 파동)';
  txt(ctrl, W / 2, 562, 17, '#cfc8f2', 'center', { weight: 600 });
  button(W / 2 - 140, 592, 280, 66, '출발!', () => openRules(), { size: 30 });
}
function drawLegendIcon(k, x, y) {
  const t = G.t;
  if (k === 'hero') drawHeroAt(x, y + 12, 0, t, false, 0, { noShadow: true });
  else if (k === 'drone') drawEnemy({ type: 'drone', x, y, r: 24, t, spawnT: 0, flash: 0, hp: 1, maxHp: 1 }, t);
  else if (k === 'gen') { ctx.save(); ctx.translate(x, y + 36); ctx.scale(0.62, 0.62); drawGen({ x: 0, y: 0, alive: true, hitT: 0, hp: 1, maxHp: 1, id: '', icon: true }); ctx.restore(); }
  else if (k === 'wall') { ctx.fillStyle = 'rgba(255,160,40,0.25)'; ctx.fillRect(x - 50, y - 16, 100, 32); ctx.fillStyle = 'rgba(255,177,46,0.75)'; ctx.fillRect(x - 50, y - 8, 100, 16); ctx.fillStyle = '#fff1c8'; ctx.fillRect(x - 50, y - 2, 100, 4); }
  else if (k === 'chip') drawChipIcon(x, y, 1.5, t);
  else if (k === 'bar') { ctx.save(); ctx.beginPath(); ctx.rect(x - 50, y - 9, 100, 18); ctx.clip(); ctx.fillStyle = '#e0573e'; ctx.fillRect(x - 50, y - 9, 100, 18); ctx.fillStyle = '#fff4dc'; for (let xx = x - 70 + (t * 30) % 30; xx < x + 60; xx += 30) { ctx.beginPath(); ctx.moveTo(xx, y + 9); ctx.lineTo(xx + 10, y + 9); ctx.lineTo(xx + 20, y - 9); ctx.lineTo(xx + 10, y - 9); ctx.closePath(); ctx.fill(); } ctx.restore(); }
  else if (k === 'boost') { ctx.strokeStyle = C.tealL; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; for (let i = 0; i < 3; i++) { const yy = y + 22 - i * 20 - ((t * 1.8) % 1) * 20; ctx.beginPath(); ctx.moveTo(x - 24, yy + 8); ctx.lineTo(x, yy - 8); ctx.lineTo(x + 24, yy + 8); ctx.stroke(); } }
  else if (k === 'launcher') { ctx.save(); ctx.translate(x - 8, y + 6); ctx.scale(0.9, 0.9); drawLauncher({ x: 0, y: 0, side: 'a', folded: false, foldK: 0, t, icon: true }); ctx.restore(); }
  else if (k === 'tower') { ctx.save(); ctx.translate(x, y + 40); ctx.scale(0.42, 0.42); drawTower({ x: 0, y: 0, alive: true, zone: 80, charge: (t * 0.3) % 1, inside: false }); ctx.restore(); }
  else if (k === 'warn') { ctx.save(); drawShell({ x, y: y + 12, t: (t * 0.8) % 1.2, warn: 1.25, r: 34 }); ctx.restore(); }
  else if (k === 'belt') { ctx.fillStyle = '#22213c'; ctx.fillRect(x - 46, y - 20, 92, 40); ctx.strokeStyle = 'rgba(255,196,90,0.8)'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; for (let i = -1; i < 3; i++) { const xx = x - 34 + i * 30 + ((t * 40) % 30); ctx.beginPath(); ctx.moveTo(xx - 7, y - 11); ctx.lineTo(xx + 5, y); ctx.lineTo(xx - 7, y + 11); ctx.stroke(); } ctx.fillStyle = '#6b7096'; ctx.fillRect(x - 46, y - 24, 92, 5); ctx.fillRect(x - 46, y + 19, 92, 5); }
  else if (k === 'worker') { ctx.save(); ctx.translate(x, y + 8); ctx.scale(0.7, 0.7); drawWorker({ x: 0, y: 0, look: LOOKS[0], t, freed: false, icon: true }); ctx.restore(); }
  else if (k === 'machine') { ctx.save(); ctx.translate(x, y + 34); ctx.scale(0.58, 0.58); drawGen({ x: 0, y: 0, alive: true, hitT: 0, hp: 1, maxHp: 1, id: '', icon: true, big: true }); ctx.restore(); ctx.strokeStyle = 'rgba(255,200,90,0.9)'; ctx.lineWidth = 3; ctx.setLineDash([7, 5]); circle(x, y, 38); ctx.stroke(); ctx.setLineDash([]); }
  else if (k === 'rest') { ctx.lineWidth = 2.5; ctx.strokeStyle = C.ink; ctx.fillStyle = '#e2ad6c'; rr(x - 32, y + 2, 64, 14, 5); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#c98f55'; rr(x - 32, y - 12, 64, 12, 4); ctx.fill(); ctx.stroke(); ctx.fillStyle = C.red; rr(x + 10, y - 30, 22, 18, 4); ctx.fill(); ctx.stroke(); ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(x + 21, y - 30, 7, Math.PI, 0); ctx.stroke(); }
  else if (k === 'ejector') drawEnemy({ type: 'ejector', x, y, r: 20, t, spawnT: 0, flash: 0, hp: 1, maxHp: 1 }, t);
  else if (k === 'cap') { ctx.save(); ctx.translate(x, y + 14); ctx.scale(0.62, 0.62); drawCapsule({ x: 0, y: 0, look: LOOKS[0], t, freed: false, icon: true }); ctx.restore(); }
  else if (k === 'valve') { ctx.save(); ctx.translate(x, y + 30); ctx.scale(0.6, 0.6); drawValve({ x: 0, y: 0, alive: true, hitT: 0, hp: 1, maxHp: 1, icon: true }); ctx.restore(); }
  else if (k === 'storm' || k === 'gust') drawStormIcon(k, x, y, t);
  else if (k === 'socket' || k === 'charter' || k === 'pad') drawCoreIcon(k, x, y);
}
// 모래폭풍(가운데만 보임)과 돌풍(옆으로 부는 모래) 아이콘
function drawStormIcon(k, x, y, t) {
  ctx.save();
  if (k === 'storm') {
    drawHeroAt(x, y + 14, 0, t, false, 0, { noShadow: true });
    const g = ctx.createRadialGradient(x, y, 14, x, y, 42); g.addColorStop(0, 'rgba(150,72,40,0)'); g.addColorStop(1, 'rgba(150,72,40,0.95)');
    ctx.fillStyle = g; circle(x, y, 44); ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(150,72,40,0.6)'; circle(x, y, 44); ctx.fill();
    ctx.fillStyle = C.amberL; ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x - 24, y - 9); ctx.lineTo(x + 6, y - 9); ctx.lineTo(x + 6, y - 20); ctx.lineTo(x + 28, y); ctx.lineTo(x + 6, y + 20); ctx.lineTo(x + 6, y + 9); ctx.lineTo(x - 24, y + 9); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(246,200,150,0.85)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  for (let i = 0; i < 7; i++) { const xx = x - 40 + ((t * (k === 'gust' ? 90 : 30) + i * 23) % 80), yy = y - 30 + i * 10; ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx - (k === 'gust' ? 18 : 8), yy + 1); ctx.stroke(); }
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
  // 글 묶음의 높이를 먼저 재고, 주황 띠(왼쪽 위아래 약 166~606)의 가운데에 놓는다. 주장이 두 줄이 되어도 겹치지 않는다
  const lines = wrap('「' + b.def.intro + '」', 560, 28, 600);
  const guides = ['① 보스가 주장을 외치면 방어막이 생겨요', '② 주장이 틀렸다는 증거 구슬에 몸으로 닿아요', '③ 방어막이 깨지면 공격! (틀린 구슬은 반격)', "④ 탄이 많으면 '파동' 버튼(키보드 E)으로 지워요"];
  const hTot = 34 + 8 + 66 + 16 + lines.length * 38 + 18 + guides.length * 32 + 14 + 22;
  let y = 388 - hTot / 2;
  txt(G.L.finalBoss ? 'FINAL BOSS · 정착촌 AI' : 'BOSS · 오더의 하위 모듈', 90, y + 17, 26, C.amberL, 'left', { weight: 900, stroke: C.ink, sw: 6 }); y += 34 + 8;
  txt(b.def.name, 90, y + 33, 64, C.cream, 'left', { weight: 900, stroke: C.ink, sw: 10 }); y += 66 + 16;
  lines.forEach((l, i) => txt(l, 92, y + 19 + i * 38, 28, C.cream, 'left', { stroke: C.ink, sw: 6 })); y += lines.length * 38 + 18;
  guides.forEach((l, i) => txt(l, 92, y + 16 + i * 32, 22, C.amberL, 'left', { stroke: C.ink, sw: 5 })); y += guides.length * 32 + 14;
  if (t > 0.7) txt('화면을 눌러 시작 (키보드: Enter)', 92, y + 11, 17, C.cream, 'left', { stroke: C.ink, sw: 4 });
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
  if (img) { rr(px, py, pw, ph, 12); ctx.fillStyle = '#141228'; ctx.fill(); drawContain(img, px + 4, py + 4, pw - 8, ph - 8); rr(px, py, pw, ph, 12); ctx.lineWidth = 2.5; ctx.strokeStyle = C.ink; ctx.stroke();
    if (r.illust) { setFont(15, 600); const it = '설명 그림 · 실제 사진이 아니에요', iw = ctx.measureText(it).width + 22; rr(px + 10, py + ph - 38, iw, 28, 14); ctx.fillStyle = 'rgba(20,17,46,0.88)'; ctx.fill(); txt(it, px + 10 + iw / 2, py + ph - 24, 15, C.amberL, 'center', { weight: 600 }); } }
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
    txt('버튼을 눌러 모으기 (키보드: Enter)', W / 2, y + h - 16, 18, '#bdb6e6', 'center', { weight: 600 });
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
  txt('눌러서 고르기 (키보드: 1·2·3)', W / 2, 600, 16, '#bdb6e6', 'center', { weight: 600 });
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
  panel(W / 2 - 230, 40, 460, 650);
  txt('잠깐 멈춤', W / 2, 90, 38, C.cream, 'center', { weight: 900 });
  let y = 132;
  button(W / 2 - 170, y, 340, 58, '계속하기', () => { G.mode = 'play'; }); y += 70;
  button(W / 2 - 170, y, 340, 52, '지구 기록 보관소', () => openArchive(), { size: 21, fill: C.tealL }); y += 64;
  soundButtons(W / 2 - 170, y, 163, 52, 19); y += 64;
  button(W / 2 - 170, y, 340, 52, forceTouch ? '터치 버튼: 켬 (태블릿)' : '터치 버튼: 끔 (태블릿)', () => setForceTouch(!forceTouch), { size: 20, fill: forceTouch ? C.tealL : '#d9d2f0' }); y += 64;
  fsButton(W / 2 - 170, y, 340, 52, 20); y += 64;
  button(W / 2 - 170, y, 340, 52, '스테이지 고르기', () => go(() => SelectScene()), { size: 21 }); y += 64;
  txt('나가면 이번 스테이지 진행은 저장되지 않아요 (기록 칩은 저장돼요)', W / 2, y + 14, 14, '#bdb6e6', 'center', { weight: 600 });
  drawFsNote();
}
function drawChange() {
  const t = G.clearT, d = G.def, ch = d.change;
  modalStart(); dim(Math.min(0.82, t * 1.5));
  const a = Math.min(1, t * 2);
  ctx.save(); ctx.globalAlpha = a;
  panel(40, 24, W - 80, H - 48, { fill: 'rgba(22,19,50,0.97)', stroke: C.mustard, r: 26, lw: 4 });
  txt(ch.title, W / 2, 86, 44, C.mustard, 'center', { weight: 900, stroke: C.ink, sw: 7 });
  txt('지구에서 사람들의 노력이 세상을 바꾼 것처럼, 화성도 바뀌었어요', W / 2, 136, 26, C.cream, 'center', { weight: 600 });
  // 두 칸을 카드 가운데에 맞춘다: 왼쪽 지구(실제 기록) | 화살표 | 오른쪽 화성(우리 이야기). 이름표는 각 칸 가운데 위, 두 칸의 위아래 끝은 같다
  // 세로 간격: 제목·부제·이름표·내용·다음 버튼 사이를 고르게 둔다
  const lx = 80, lw = 480, gapW = 100, rx = lx + lw + gapW, rw = W - 80 - rx, ly = 182;
  const rows = ch.earth || [], rowH = 94, rowG = 12, top = ly + 56, bodyH = rows.length * rowH + (rows.length - 1) * rowG;
  rr(lx + lw / 2 - 100, ly, 200, 40, 20); ctx.fillStyle = C.tealL; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.stroke();
  txt('지구 · 실제 역사', lx + lw / 2, ly + 20, 20, C.ink, 'center', { weight: 900 });
  rows.forEach((e, i) => {
    const show = Math.min(1, Math.max(0, (t - 0.5 - i * 0.5) * 3));
    if (show <= 0) return;
    ctx.globalAlpha = a * show;
    const y = top + i * (rowH + rowG);
    rr(lx, y, lw, rowH, 16); ctx.fillStyle = 'rgba(44,200,182,0.12)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(159,245,234,0.6)'; ctx.stroke();
    txt(e[0], lx + 18, y + rowH / 2, 34, C.tealL, 'left', { weight: 900 });
    const el = wrap(e[1], lw - 108 - 16, 28, 600);
    el.forEach((l, k) => txt(l, lx + 108, y + rowH / 2 + (k - (el.length - 1) / 2) * 34, 28, C.cream, 'left', { weight: 600 }));
  });
  ctx.globalAlpha = a;
  rr(rx + rw / 2 - 110, ly, 220, 40, 20); ctx.fillStyle = C.orange; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.stroke();
  txt('화성 · 우리 정착촌', rx + rw / 2, ly + 20, 20, C.ink, 'center', { weight: 900 });
  // 화성 글: 첫 문장이 먼저, 둘째 문장(mars2)은 조금 뒤에 그림 위 표시(mark)와 함께 나온다
  const ml1 = wrap(ch.mars, rw, 24, 600), ml2 = ch.mars2 ? wrap(ch.mars2, rw, 24, 600) : [], mlh = 32;
  const ih = bodyH - 14 - (ml1.length + ml2.length) * mlh, img = IMG[ch.img], iy = top;
  const show2 = Math.min(1, Math.max(0, (t - 1.6) * 2)), show3 = ch.mars2 ? Math.min(1, Math.max(0, (t - 3.0) * 1.2)) : 0;
  ctx.globalAlpha = a * show2;
  let toScreen = null;
  if (img) { ctx.save(); rr(rx, iy, rw, ih, 16); ctx.clip(); // 둘째 문장이 나올 때 화면이 표시한 곳(mark)으로 다가간다
    const f0 = ch.focus || { x: 0.5, y: 0.5 }, zk = ch.mark ? show3 * show3 * (3 - 2 * show3) : 0;
    const mdx = ch.mark && ch.mark.x > 0.5 ? -0.06 : 0.06, fx = ch.mark ? lerp(f0.x, ch.mark.x + mdx, zk) : f0.x, fy = ch.mark ? lerp(f0.y, ch.mark.y + 0.07, zk) : f0.y;
    toScreen = drawCoverAt(img, rx, iy, rw, ih, fx, fy, 1 + 0.8 * zk); ctx.restore(); rr(rx, iy, rw, ih, 16); ctx.lineWidth = 3; ctx.strokeStyle = C.cream; ctx.stroke(); }
  else { rr(rx, iy, rw, ih, 16); ctx.fillStyle = '#2e2b52'; ctx.fill(); txt(ch.alt || '모두의 길', rx + rw / 2, iy + ih / 2, 40, C.tealL, 'center', { weight: 900 }); }
  ml1.forEach((l, k) => txt(l, rx, iy + ih + 14 + mlh / 2 + k * mlh, 24, C.cream, 'left', { weight: 600 }));
  if (show3 > 0) {
    ctx.globalAlpha = a * show3;
    ml2.forEach((l, k) => txt(l, rx, iy + ih + 14 + mlh / 2 + (ml1.length + k) * mlh, 24, '#ffc2b8', 'left', { weight: 900 }));
    if (ch.mark && toScreen) {
      // 그림 속 표시 위치: drawCover와 같은 방식으로 그림 좌표를 화면 좌표로 옮긴다
      const mp = toScreen(ch.mark.x, ch.mark.y), mx = mp.x, my = mp.y;
      const pr = 30 + Math.sin(G.t * 6) * 4;
      ctx.save(); rr(rx, iy, rw, ih, 16); ctx.clip();
      ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = 5; circle(mx, my, pr); ctx.stroke(); ctx.strokeStyle = 'rgba(255,59,59,0.4)'; ctx.lineWidth = 10; circle(mx, my, pr + 10); ctx.stroke();
      ctx.restore();
      setFont(17, 900); const lt = ch.mark.label || '아직 남은 무기', tw = ctx.measureText(lt).width + 22, lxx = clamp(mx - tw / 2, rx + 6, rx + rw - tw - 6), lyy = Math.max(iy + 6, my - pr - 40);
      rr(lxx, lyy, tw, 30, 15); ctx.fillStyle = 'rgba(120,20,30,0.95)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#ff8a8a'; ctx.stroke();
      txt(lt, lxx + tw / 2, lyy + 15, 17, '#ffe0dc', 'center', { weight: 900 });
    }
  }
  ctx.globalAlpha = a;
  // 가운데 화살표
  const ax = lx + lw + gapW / 2, ay = top + bodyH / 2;
  ctx.fillStyle = C.mustard; ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(ax - 22, ay - 14); ctx.lineTo(ax + 2, ay - 14); ctx.lineTo(ax + 2, ay - 30); ctx.lineTo(ax + 30, ay); ctx.lineTo(ax + 2, ay + 30); ctx.lineTo(ax + 2, ay + 14); ctx.lineTo(ax - 22, ay + 14); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
  const nextAt = ch.mars2 ? 4.2 : 2, byy = top + bodyH + 44;
  if (t > nextAt) button(W / 2 - 140, byy, 280, 62, '다음 ▶', () => { G.clearStep = 1; G.clearT = 0; ui.focus = 0; }, { size: 26 });
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
    const sk = D.skills[d.skill];
    if (sk) { txt('기술 획득: ' + sk.name, x, 396, 26, C.tealL, 'left', { weight: 900 }); para(sk.desc + ' (자동으로 적용돼요)', x, 432, 600, 21, '#c8f5ee', 30, { weight: 600 }); }
    txt('운동 배지: ' + d.badge, x, 494, 26, C.amberL, 'left', { weight: 600 });
  }
  if (t > 1.2) button(600, 540, 320, 64, '결과 보기', () => { const r = resultData(); go(() => ResultScene(r)); }, { size: 28 });
}
function drawGameOver() {
  modalStart(); dim(0.78);
  txt('목숨을 모두 썼어요', W / 2, 220, 48, C.cream, 'center', { weight: 900, stroke: C.ink, sw: 9 });
  txt('스테이지를 처음부터 다시 해요. 모은 기록 칩은 그대로 남아요.', W / 2, 290, 24, '#d8d1fa', 'center', { weight: 600 });
  button(W / 2 - 180, 360, 360, 66, '처음부터 다시 시작', () => go(() => StageScene(G.def.id, { skipIntro: true })), { size: 28 });
}

/* ---------------- 메인 루프 ---------------- */
// 지금 장면의 배경 음악: 시작·고르기·결과 = menu, 스테이지 = stageN, 보스전 = boss(종장은 bossFinal), 엔딩 = ending
function musicFor() {
  if (!scene) return null;
  if (scene.name === 'ending') return 'ending';
  if (scene.name === 'stage' && G && G.def) {
    if (G.mode === 'clear') return 'menu';
    if (G.boss && !G.boss.dead) return G.L.finalBoss ? 'bossFinal' : 'boss';
    return 'stage' + G.def.id;
  }
  return 'menu';
}
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
    Sound.update(musicFor(), scene && scene.name === 'stage' && G && G.mode === 'pause');
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
    get G() { return G; }, get scene() { return scene && scene.name; }, get sceneObj() { return scene; }, get save() { return save; },
    get mode() { return G && G.mode; }, get overlay() { return !!overlay; },
    get sound() { return { track: Sound.track, sfx: Sound.sfxOn, bgm: Sound.bgmOn, state: Sound.ac && Sound.ac.state, bar: Sound.bar }; },
    start(id, withIntro) { overlay = null; setScene(StageScene(id || 1, { skipIntro: !withIntro })); },
    skipWork() { const ws = G.work; if (!ws || ws.done) return; ws.n = G.L.work.need; ws.carry = false; finishWork(); },
    tp(x, y) { G.P.x = x; G.P.y = y; },
    god(on) { G.god = on !== false; },
    xp(n) { gainXp(n); },
    killGens(ids) { G.gens.forEach(g => { if (!ids || ids.includes(g.id)) { g.needAllies = 0; if (g.socket) { if (g.alive) killGen(g); } else damageGen(g, 9999); } }); },
    openSock(id) { startQuiz(G.gens.find(x => x.id === id)); },
    // 퀴즈 상태(봇·확인용): 타이밍 카드 위치, 빈칸·조각 버튼 자리
    quiz() {
      const q = G.quiz; if (!q) return null;
      const want = q.ch.items[q.step];
      return { type: q.type, id: q.g.id, step: q.step, miss: q.miss, solved: q.solvedT != null, win: TICK.win, cx: W / 2,
        cards: q.type === 'timing' ? tickerCards(q).map(p => ({ x: p.x, label: p.c.it.label, got: p.c.got, ok: p.c.it === want })) : null,
        ui: q.ui || null, tiles: q.tiles ? q.tiles.map(t => [t.r, t.c]) : null, done: q.done || null, sel: q.sel };
    },
    bossHp(f) { const b = G.boss; b.hp = b.maxHp * f; },
    down() { playerDown(); },
    guide() { const g = routeGoal(); return g ? { x: g.x, y: g.y } : null; },
    ending(step) { overlay = null; setScene(EndingScene({ at: step })); },
    result(id) { overlay = null; const d = stageById(id); setScene(ResultScene({ id, name: d.name, time: 300, chips: 6, chipTotal: 6, right: 4, wrong: 1, level: 4, rescued: 2 })); },
    select() { overlay = null; setScene(SelectScene()); },
    reset() { save = defaultSave(); writeSave(); }
  };
}
})();
