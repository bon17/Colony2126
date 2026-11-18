/* 콜로니 2126 · 소리 만들기(파일 없이 Web Audio로 만드는 칩튠)
   효과음과 배경 음악 악보를 여기에 모은다. 게임(소리 켬일 때)과 샘플 파일 뽑기(tools/sound_samples.js)가 같이 쓴다.
   style: 'retro' = 옛날 게임기(사각파, 또렷), 'soft' = 부드러운 전자음(삼각파·종소리, 귀엽게) */
(function () {
  'use strict';
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function freq(n) {
    const m = /^([A-G])([#b]?)(-?\d)$/.exec(n); if (!m) return 0;
    const semi = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return 440 * Math.pow(2, ((+m[3] + 1) * 12 + semi - 69) / 12);
  }
  // 소리 재료: 펄스파(사각파의 폭을 바꾼 것), 잡음
  const cache = new WeakMap();
  function kit(ctx) {
    let k = cache.get(ctx); if (k) return k;
    k = {};
    const pulse = d => { const n = 48, re = new Float32Array(n), im = new Float32Array(n); for (let i = 1; i < n; i++) { re[i] = Math.sin(2 * Math.PI * i * d) / (Math.PI * i); im[i] = (1 - Math.cos(2 * Math.PI * i * d)) / (Math.PI * i); } return ctx.createPeriodicWave(re, im); };
    k.p12 = pulse(0.125); k.p25 = pulse(0.25);
    const len = Math.floor(ctx.sampleRate * 1.0), buf = ctx.createBuffer(1, len, ctx.sampleRate), ch = buf.getChannelData(0);
    let seed = 12345; for (let i = 0; i < len; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; ch[i] = seed / 0x3fffffff - 1; }
    k.noise = buf;
    cache.set(ctx, k); return k;
  }
  // 음 하나: wave(sine·triangle·square·p25·p12), f(Hz), t(시작), d(길이), v(크기)
  function tone(ctx, out, o) {
    const K = kit(ctx), osc = ctx.createOscillator(), g = ctx.createGain();
    if (o.wave === 'p25' || o.wave === 'p12') osc.setPeriodicWave(K[o.wave]); else osc.type = o.wave || 'square';
    const t = o.t, a = o.a == null ? 0.004 : o.a, r = o.r == null ? 0.04 : o.r, end = t + o.d;
    osc.frequency.setValueAtTime(o.f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + (o.slide || o.d));
    if (o.vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = o.vibRate || 6; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(o.f * o.vib, t + Math.min(0.25, o.d)); l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(end + r + 0.02); }
    if (o.detune) osc.detune.setValueAtTime(o.detune, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.v, t + a);
    if (o.decay) g.gain.exponentialRampToValueAtTime(Math.max(0.0001, o.v * (o.sus == null ? 0.001 : o.sus)), Math.min(end, t + a + o.decay));
    g.gain.setTargetAtTime(0.0001, end, r / 3);
    osc.connect(g); g.connect(out);
    osc.start(t); osc.stop(end + r + 0.05);
  }
  // 잡음 하나: 북·심벌·바람 소리. hp/lp/bp = 거르개 주파수, to = 거르개가 미끄러질 곳
  function hiss(ctx, out, o) {
    const K = kit(ctx), src = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    src.buffer = K.noise; src.loop = true;
    f.type = o.type || 'highpass'; f.frequency.setValueAtTime(o.f || 1000, o.t); f.Q.value = o.q || 0.8;
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, o.t + o.d);
    g.gain.setValueAtTime(0.0001, o.t); g.gain.linearRampToValueAtTime(o.v, o.t + (o.a || 0.002));
    g.gain.exponentialRampToValueAtTime(0.0001, o.t + o.d);
    src.connect(f); f.connect(g); g.connect(out);
    src.start(o.t, Math.random() * 0.5); src.stop(o.t + o.d + 0.05);
  }

  /* ---------------- 효과음 ---------------- */
  const SFX = {
    // 대시: 바람이 휙
    dash(c, o, t, s) {
      hiss(c, o, { t, d: 0.22, type: 'bandpass', f: 600, to: 3200, q: 1.4, v: s === 'soft' ? 0.35 : 0.5 });
      tone(c, o, { wave: s === 'soft' ? 'triangle' : 'p25', f: 260, to: 820, t, d: 0.12, v: s === 'soft' ? 0.18 : 0.12 });
    },
    // 공명 파동: 둥— 하고 퍼지는 소리
    skill(c, o, t, s) {
      const w = s === 'soft' ? 'triangle' : 'square';
      tone(c, o, { wave: w, f: 880, to: 220, slide: 0.5, t, d: 0.55, v: s === 'soft' ? 0.32 : 0.16, vib: 0.05, vibRate: 14, r: 0.15 });
      tone(c, o, { wave: s === 'soft' ? 'sine' : 'p25', f: 1320, to: 330, slide: 0.5, t, d: 0.5, v: s === 'soft' ? 0.14 : 0.07, r: 0.15 });
      hiss(c, o, { t, d: 0.4, type: 'lowpass', f: 2400, to: 300, v: 0.12 });
    },
    // 기록 줍기: 띠링
    record(c, o, t, s) {
      const w = s === 'soft' ? 'sine' : 'p25', v = s === 'soft' ? 0.3 : 0.14;
      tone(c, o, { wave: w, f: freq('E6'), t, d: 0.07, v });
      tone(c, o, { wave: w, f: freq('B6'), t: t + 0.08, d: 0.22, v, decay: 0.2, r: 0.1 });
      if (s === 'soft') tone(c, o, { wave: 'sine', f: freq('B7'), t: t + 0.08, d: 0.2, v: 0.06, decay: 0.18 });
    },
    // 카드 꽂기: 찰칵 + 올라가는 화음
    card(c, o, t, s) {
      hiss(c, o, { t, d: 0.05, type: 'highpass', f: 3000, v: 0.4 });
      tone(c, o, { wave: s === 'soft' ? 'triangle' : 'square', f: 120, to: 60, t, d: 0.06, v: 0.3 });
      ['C5', 'E5', 'G5', 'C6'].forEach((n, i) => tone(c, o, { wave: s === 'soft' ? 'triangle' : 'p25', f: freq(n), t: t + 0.1 + i * 0.07, d: i === 3 ? 0.35 : 0.07, v: s === 'soft' ? 0.3 : 0.13, decay: i === 3 ? 0.3 : null, r: 0.08 }));
    },
    // 정답: 따단!
    good(c, o, t, s) {
      const w = s === 'soft' ? 'triangle' : 'p25', v = s === 'soft' ? 0.3 : 0.14;
      tone(c, o, { wave: w, f: freq('G5'), t, d: 0.08, v });
      tone(c, o, { wave: w, f: freq('C6'), t: t + 0.09, d: 0.3, v, vib: 0.01 });
      tone(c, o, { wave: s === 'soft' ? 'sine' : 'square', f: freq('E5'), t: t + 0.09, d: 0.3, v: v * 0.5 });
    },
    // 오답: 뿌우
    bad(c, o, t, s) {
      const w = s === 'soft' ? 'triangle' : 'square', v = s === 'soft' ? 0.32 : 0.14;
      tone(c, o, { wave: w, f: freq('E4'), t, d: 0.12, v, detune: -15 });
      tone(c, o, { wave: w, f: freq('C4'), to: freq('A3'), t: t + 0.14, d: 0.28, v, detune: -15, r: 0.08 });
      if (s !== 'soft') tone(c, o, { wave: 'p12', f: freq('C3'), t: t + 0.14, d: 0.28, v: 0.08 });
    },
    // 맞음: 툭
    hurt(c, o, t, s) {
      tone(c, o, { wave: s === 'soft' ? 'triangle' : 'square', f: 300, to: 90, t, d: 0.12, v: s === 'soft' ? 0.35 : 0.16 });
      hiss(c, o, { t, d: 0.1, type: 'lowpass', f: 1800, v: 0.25 });
    },
    // 레벨 업: 두 옥타브 올라가는 아르페지오
    level(c, o, t, s) {
      const w = s === 'soft' ? 'triangle' : 'p25', v = s === 'soft' ? 0.26 : 0.12;
      ['C5', 'E5', 'G5', 'C6', 'E6', 'G6'].forEach((n, i) => tone(c, o, { wave: w, f: freq(n), t: t + i * 0.06, d: 0.06, v }));
      tone(c, o, { wave: w, f: freq('C7'), t: t + 0.36, d: 0.45, v, vib: 0.012, decay: 0.45, sus: 0.3, r: 0.15 });
      if (s === 'soft') tone(c, o, { wave: 'sine', f: freq('G6'), t: t + 0.36, d: 0.45, v: 0.1, decay: 0.45 });
    },
    // 동료 합류: 반가운 세 음
    ally(c, o, t, s) {
      const w = s === 'soft' ? 'sine' : 'p25', v = s === 'soft' ? 0.32 : 0.14;
      [['G5', 0], ['C6', 0.1], ['E6', 0.2]].forEach(([n, d], i) => tone(c, o, { wave: w, f: freq(n), t: t + d, d: i === 2 ? 0.3 : 0.09, v, decay: i === 2 ? 0.3 : null }));
      tone(c, o, { wave: 'triangle', f: freq('C4'), t, d: 0.4, v: 0.18 });
    },
    // 보스 방어막 깨짐: 쨍그랑
    shield(c, o, t, s) {
      hiss(c, o, { t, d: 0.6, type: 'lowpass', f: 9000, to: 400, v: 0.5 });
      tone(c, o, { wave: s === 'soft' ? 'triangle' : 'square', f: 160, to: 40, t, d: 0.35, v: 0.3 });
      ['E7', 'B6', 'G7', 'D7', 'A6'].forEach((n, i) => tone(c, o, { wave: s === 'soft' ? 'sine' : 'p12', f: freq(n), t: t + 0.03 + i * 0.045, d: 0.12, v: s === 'soft' ? 0.14 : 0.07, decay: 0.12 }));
    },
    // 단추 누름: 톡
    ui(c, o, t, s) { tone(c, o, { wave: s === 'soft' ? 'sine' : 'p25', f: freq('A5'), t, d: 0.035, v: s === 'soft' ? 0.22 : 0.1 }); }
  };
  const SFX_NAMES = { dash: '대시', skill: '공명 파동', record: '기록 줍기', card: '카드 꽂기', good: '정답', bad: '오답', hurt: '맞음', level: '레벨 업', ally: '동료 합류', shield: '보스 방어막 깨짐', ui: '단추 누름' };

  /* ---------------- 배경 음악 ----------------
     멜로디는 8분음표 칸: 음 이름, '-' = 앞 음을 늘림, '.' = 쉼. 한 줄 = 한 마디(8칸)
     chords = 마디마다 화음(베이스와 아르페지오가 쓴다) */
  const SONGS = {
    // 1스테이지 「분리 구역」: 가라앉은 긴장(가단조)
    stage1: { bpm: 108, bass: 'walk', drums: 'light',
      chords: ['A2:A3 C4 E4', 'F2:F3 A3 C4', 'G2:G3 B3 D4', 'E2:E3 G3 B3', 'A2:A3 C4 E4', 'F2:F3 A3 C4', 'G2:G3 B3 D4', 'E2:E3 G#3 B3'],
      lead: ['A4 - C5 - E5 - D5 C5', 'C5 - A4 - F4 - A4 -', 'B4 - D5 - G5 - F5 E5', 'E5 - - - B4 - . .',
             'A4 - C5 - E5 - A5 -', 'G5 F5 E5 - C5 - A4 -', 'B4 - D5 - G4 - B4 -', 'G#4 - B4 - E5 - - -'] },
    // 보스전: 빠르고 몰아치는 느낌(라단조)
    boss: { bpm: 144, bass: 'drive', drums: 'full',
      chords: ['D2:D3 F3 A3', 'D2:D3 F3 A3', 'Bb1:Bb2 D3 F3', 'C2:C3 E3 G3', 'D2:D3 F3 A3', 'D2:D3 F3 A3', 'Bb1:Bb2 D3 F3', 'A1:A2 C#3 E3'],
      lead: ['D5 . D5 F5 . D5 A5 -', 'G5 F5 E5 F5 D5 - . .', 'D5 . D5 F5 . D5 Bb5 -', 'A5 G5 F5 E5 C5 - . .',
             'D6 - A5 - F5 - D5 -', 'E5 F5 G5 A5 F5 - D5 -', 'F5 - D5 - Bb4 - D5 F5', 'E5 - C#5 - A4 - - -'] }
  };
  function drum(c, o, kind, t, s) {
    const soft = s === 'soft';
    if (kind === 'k') { tone(c, o, { wave: 'sine', f: 150, to: 42, slide: 0.12, t, d: 0.16, v: soft ? 0.5 : 0.7, r: 0.04 }); }
    if (kind === 's') { hiss(c, o, { t, d: soft ? 0.09 : 0.14, type: soft ? 'bandpass' : 'highpass', f: soft ? 2600 : 1200, q: soft ? 1.2 : 0.7, v: soft ? 0.22 : 0.3 }); if (!soft) tone(c, o, { wave: 'triangle', f: 190, to: 120, t, d: 0.06, v: 0.25 }); }
    if (kind === 'h') hiss(c, o, { t, d: 0.03, type: 'highpass', f: 7500, v: soft ? 0.06 : 0.09 });
  }
  // 한 곡을 loops번 예약하고, 끝나는 시각을 돌려준다
  function song(c, out, name, t0, s, loops) {
    const S = SONGS[name], soft = s === 'soft', step = 60 / S.bpm / 4, bar = step * 16;
    const bus = c.createGain(); bus.gain.value = 1; bus.connect(out);
    const leadW = soft ? 'triangle' : 'p25', arpW = soft ? 'sine' : 'p12', bassW = 'triangle';
    let t = t0;
    for (let L = 0; L < (loops || 1); L++) {
      S.chords.forEach((cd, bi) => {
        const [root, tones] = cd.split(':'), arp = tones.split(' ').map(freq), bt = t + bi * bar, rf = freq(root);
        // 베이스
        for (let i = 0; i < 8; i++) {
          const f = S.bass === 'drive' ? rf * (i % 2 ? 2 : 1) : rf * (i % 4 === 2 ? 2 : 1) * (i === 7 ? 1.5 : 1);
          if (S.bass === 'drive') { tone(c, bus, { wave: bassW, f, t: bt + i * 2 * step, d: step * 1.6, v: 0.34, r: 0.03 }); tone(c, bus, { wave: bassW, f: rf, t: bt + (i * 2 + 1) * step, d: step * 0.7, v: 0.22, r: 0.02 }); }
          else if (i % 2 === 0) tone(c, bus, { wave: bassW, f, t: bt + i * 2 * step, d: step * 3, v: 0.3, r: 0.05 });
        }
        // 아르페지오(작게)
        const pat = [0, 1, 2, 1];
        for (let i = 0; i < 16; i++) tone(c, bus, { wave: arpW, f: arp[pat[i % 4]] * 2, t: bt + i * step, d: step * 0.6, v: soft ? 0.05 : 0.025, r: 0.02 });
        // 북
        for (let i = 0; i < 16; i++) {
          const k = S.drums === 'full' ? i % 4 === 0 : (i === 0 || i === 8 || i === 10);
          if (k) drum(c, bus, 'k', bt + i * step, s);
          if (i === 4 || i === 12) drum(c, bus, 's', bt + i * step, s);
          if (S.drums === 'full' ? true : i % 2 === 0) drum(c, bus, 'h', bt + i * step, s);
        }
        // 멜로디
        const toks = S.lead[bi].split(' ');
        for (let i = 0; i < toks.length; i++) {
          const n = toks[i]; if (n === '-' || n === '.') continue;
          let len = 1; while (toks[i + len] === '-') len++;
          const d = len * step * 2 * 0.92;
          tone(c, bus, { wave: leadW, f: freq(n), t: bt + i * step * 2, d, v: soft ? 0.2 : 0.09, vib: len > 1 ? 0.012 : 0, a: soft ? 0.012 : 0.004, r: soft ? 0.08 : 0.03 });
          if (soft) tone(c, bus, { wave: 'sine', f: freq(n) * 2, t: bt + i * step * 2, d: Math.min(d, 0.25), v: 0.05, decay: 0.25 });
        }
      });
      t += S.chords.length * bar;
    }
    return t;
  }
  function songLength(name) { const S = SONGS[name]; return 60 / S.bpm * 4 * S.chords.length; }

  window.ColonyChip = { freq, tone, hiss, SFX, SFX_NAMES, SONGS, song, songLength,
    sfx(c, out, name, t, s) { if (SFX[name]) SFX[name](c, out, t, s || 'retro'); } };
})();
