// 자동 플레이 봇: 실제 키 입력으로 한 스테이지를 처음(상황 컷)부터 보스 격파까지 플레이한다(순간 이동·무적 없음).
// 쓰는 법(저장소 맨 위에서, Playwright 필요): node tools/playtest_bot.js [easy|normal] [정답률 0~1] [스테이지 번호]
// 예: node tools/playtest_bot.js normal 0.8 6   → 15초마다 상태를 찍고, 끝나면 END clear/gameover 와 오류(ERR)를 보여 준다.
// 봇은 학생보다 훨씬 빠르게 움직이니 걸린 시간은 '최소 시간'으로만 본다. 새 스테이지의 장치를 넣으면 이 봇도 같이 고친다.
const path = require('path'), os = require('os');
const { chromium } = require('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const DIFF = process.argv[2] || 'normal';
const ACC = parseFloat(process.argv[3] || '1');
const STAGE = parseInt(process.argv[4] || '1', 10);
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.resolve(__dirname, '../colony2126/index.html') + '?debug');
  await page.evaluate(([d, st]) => { __colony.reset(); const s = __colony.save; s.started = true; s.difficulty = d; __colony.start(st, true); }, [DIFF, STAGE]);
  const held = new Set();
  async function setKeys(want) {
    for (const k of [...held]) if (!want.has(k)) { await page.keyboard.up(k); held.delete(k); }
    for (const k of want) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
  }
  let lastLog = 0, wrongBudget = 0, jitter = 0, shots = [], lastZone = null, zoneT = 0;
  const stuck = { x: 0, y: 0, t: 0, until: 0, dx: 0 };
  const t0 = Date.now();
  while (Date.now() - t0 < 900000) {
    const s = await page.evaluate(() => {
      const G = __colony.G; if (!G) return null;
      const P = G.P, z = G.zones[G.zoneIdx];
      const objs = [];
      if (z) {
        const w = G.walls.find(w => w.id === z.exit);
        G.gens.filter(g => g.alive && w.gens.includes(g.id) && !(g.needAllies && G.settlers.length < g.needAllies)).forEach(g => objs.push({ x: g.x, y: g.y + (g.tower ? 20 : 40), k: g.tower ? 't' : 'g' }));
        G.caps.filter(c => !c.freed && c.y >= z.y0 && c.y < z.y1).forEach(c => objs.push({ x: c.x, y: c.y, k: 'c' }));
        G.chips.filter(c => !c.got && c.y >= z.y0 && c.y < z.y1 && !(G.restricted && G.L.restrict.lane && c.x < 1000)).forEach(c => objs.push({ x: c.x, y: c.y, k: 'h' }));
      }
      const b = G.boss && !G.boss.dead ? { x: G.boss.x, y: G.boss.y, sh: G.boss.shield, r: G.boss.round, hp: G.boss.hp / G.boss.maxHp, orbs: G.boss.orbs.filter(o => o.born > 0.5).map(o => ({ x: o.x, y: o.y, c: !!o.opt.correct })), lasers: G.boss.lasers.map(l => ({ k: l.kind, x: l.x, y: l.y, r: l.r, gap: l.gap, warn: l.warn, x0: l.x0, x1: l.x1, dir: l.dir, hd: l.kind === 'hand' ? (() => { const ox = G.boss.x, oy = G.boss.y + 40, ex = ox + Math.cos(l.a) * l.len, ey = oy + Math.sin(l.a) * l.len, dx = ex - ox, dy = ey - oy, t = Math.max(0, Math.min(1, ((P.x - ox) * dx + (P.y - oy) * dy) / (dx * dx + dy * dy))); return Math.hypot(P.x - ox - dx * t, P.y - oy - dy * t); })() : null })) } : null;
      const rg = G.walls.find(w => w.id === 'recgate');
      const allChips = [];
      if (rg && rg.active) { G.chips.forEach(c => { if (!c.got && !__colony.save.records[c.id] && !(G.restricted && G.L.restrict.lane && c.x < 1000)) allChips.push({ x: c.x, y: c.y, k: 'h' }); }); G.enemies.forEach(e => { if (e.chip && !e.dead) allChips.push({ x: e.x, y: e.y, k: 'e' }); }); }
      const shells = (G.shells || []).filter(s => !s.boom && s.t >= 0 && Math.hypot(s.x - P.x, s.y - P.y) < s.r + 30).map(s => ({ x: s.x, y: s.y }));
      const near = G.eB.filter(e => Math.hypot(e.x - P.x, e.y - P.y) < 120).map(e => ({ x: e.x, y: e.y }));
      const barOn = !!(G.L.barGaps && !G.race && G.restricted && !(G.off && G.off.bar));
      return { barOn, shells, work: !!(G.work && !G.work.done), race: G.race && G.race.on, stage: G.def.id, guide: __colony.guide(), allChips, gateOn: !!(rg && rg.active), restricted: G.restricted, mode: G.mode, time: G.time, P: { x: P.x, y: P.y, hp: P.hp, dead: P.dead }, max: G.st.maxHp, lives: G.lives, lv: G.level, zone: G.zoneIdx, objs, b, near, stats: G.stats, scene: __colony.scene, walls: G.walls.filter(w => w.active).map(w => w.id) };
    });
    if (!s) break;
    // 종장은 보스를 반박하면 엔딩 화면으로 넘어간다
    if (s.scene === 'ending' || s.mode === 'ending') { await setKeys(new Set()); console.log('ZONE boss', (s.time - zoneT).toFixed(0) + 's'); console.log('END clear(ending)', JSON.stringify({ t: s.time.toFixed(0), lv: s.lv, lives: s.lives, stats: s.stats })); break; }
    if (s.scene !== 'stage') break;
    // 구간이 바뀔 때마다 그 구간에 걸린 시간(움직인 시간)을 찍는다
    if (s.zone !== lastZone && s.mode === 'play') { if (lastZone !== null) console.log('ZONE', ['A', 'B', 'C'][lastZone] || 'boss', (s.time - zoneT).toFixed(0) + 's'); lastZone = s.zone; zoneT = s.time; }
    if (s.mode === 'levelup') { await setKeys(new Set()); await sleep(500); await page.keyboard.press(String(1 + Math.floor(Math.random() * 3)).replace(/^/, 'Digit')); continue; }
    if (s.mode === 'claim') { await setKeys(new Set()); await sleep(2900); await page.keyboard.press('Enter'); continue; }
    if (s.mode === 'rebut') { await setKeys(new Set()); await sleep(1200); await page.keyboard.press('Enter'); continue; }
    if (s.mode === 'down') { await setKeys(new Set()); await sleep(10300); await page.keyboard.press('Enter'); continue; }
    if (s.mode === 'record') { await setKeys(new Set()); await sleep(7300); await page.keyboard.press('Enter'); continue; }
    if (s.mode === 'rules') { await setKeys(new Set()); await sleep(10400); await page.keyboard.press('Enter'); continue; }
    if (s.mode === 'intro') { await page.keyboard.press('Enter'); await sleep(250); continue; }
    if (s.mode === 'brief') { await page.keyboard.press('Enter'); await sleep(200); continue; }
    if (s.mode === 'bossIntro') { await setKeys(new Set()); await page.keyboard.press('Enter'); await sleep(200); continue; }
    if (s.mode === 'clear' || s.mode === 'gameover') { await setKeys(new Set()); console.log('ZONE', ['A', 'B', 'C'][lastZone] || 'boss', (s.time - zoneT).toFixed(0) + 's'); console.log('END', s.mode, JSON.stringify({ t: s.time.toFixed(0), lv: s.lv, lives: s.lives, stats: s.stats })); break; }
    let tx = s.P.x, ty = s.P.y - 300, dashNow = false;
    if (s.b) {
      const correct = s.b.orbs.find(o => o.c), wrong = s.b.orbs.find(o => !o.c);
      if (s.b.sh && s.b.orbs.length) {
        const o = (wrongBudget < 0 && wrong) ? wrong : correct || s.b.orbs[0];
        tx = o.x; ty = o.y;
      } else { tx = s.b.x + Math.sin(s.time * 0.8) * 260; ty = 560; }
      for (const l of s.b.lasers) {
        if (l.k === 'v' && Math.abs(s.P.x - l.x) < 90) tx = s.P.x + (s.P.x < l.x ? -200 : 200);
        if (l.k === 'h' && Math.abs(s.P.y - l.y) < 140) { tx = l.gap; }
        if (l.k === 'floor') tx = 800 - l.dir * 320;
        if (l.k === 'hand' && !l.warn && l.hd < 95) dashNow = true;
        if (l.k === 'drain') { const d = Math.hypot(s.P.x - l.x, s.P.y - l.y) || 1; if (d < l.r * (l.warn ? 1.2 : 2.1)) { tx = s.P.x + (s.P.x - l.x) / d * 300; ty = s.P.y + (s.P.y - l.y) / d * 300; } }
        if (l.k === 'gust' && !l.warn) tx -= l.dir * 160;
        if (l.k === 'area') { tx = (l.x0 + l.x1) / 2; if (s.P.x < l.x0 + 20 || s.P.x > l.x1 - 20) ty = s.P.y; }
      }
    } else if (s.work && s.guide) {
      tx = s.guide.x; ty = s.guide.y;
    } else if (s.race) {
      // forced-scroll race: line up with the next gap, then run through it
      const g = s.guide;
      if (g && g.y < s.P.y) { if (Math.abs(g.x - s.P.x) > 46) { tx = g.x; ty = s.P.y - g.y > 130 ? s.P.y - 200 : s.P.y; } else { tx = g.x; ty = g.y - 220; } }
      else { tx = 800; ty = s.P.y - 300; }
    } else if (s.objs.length) {
      s.objs.sort((a, b) => Math.hypot(a.x - s.P.x, a.y - s.P.y) - Math.hypot(b.x - s.P.x, b.y - s.P.y));
      const o = s.objs[0]; tx = o.x; ty = o.y;
      if (o.k === 'g' && Math.hypot(o.x - s.P.x, o.y - s.P.y) < 170) { tx = s.P.x + Math.sin(s.time * 2) * 100; ty = s.P.y; }
      // 종장 A: 출전 금지 차단막이 막고 있으면 안내 화살표(틈)를 따라간다
      if (s.barOn && s.guide && Math.hypot(s.guide.x - o.x, s.guide.y - o.y) > 50) { tx = s.guide.x; ty = s.guide.y; }
      if (o.k === 't' && Math.hypot(o.x - s.P.x, o.y - s.P.y) < 60) { tx = s.P.x; ty = s.P.y; }
    } else if (s.zone === -1 && !s.b && s.P.y < 812) { tx = 800; ty = 600; }
    else if (!s.objs.length && s.gateOn && s.guide) { tx = s.guide.x; ty = s.guide.y; }
    else if (!s.objs.length && s.gateOn && s.allChips.length && (s.zone === -1 || (s.zone === 2 && !s.walls.includes('wA')))) { s.allChips.sort((a, b) => Math.hypot(a.x - s.P.x, a.y - s.P.y) - Math.hypot(b.x - s.P.x, b.y - s.P.y)); tx = s.allChips[0].x; ty = s.allChips[0].y; }
    else if ((s.zone === 0 || s.zone === 1) && !s.objs.length) { tx = s.stage === 1 ? 1270 : 800; ty = s.P.y - 300; }
    else if (s.zone === 2 && !s.walls.includes('wA')) { tx = 800; ty = s.P.y > 880 ? 840 : 600; }
    if (s.shells && s.shells.length) { const e = s.shells[0]; tx = s.P.x + (s.P.x - e.x) * 4 + 1; ty = s.P.y + (s.P.y - e.y) * 4 + 1; }
    // dodge: step away from nearest bullet sometimes
    if (s.near.length && Math.random() < 0.5) { const e = s.near[0]; tx = s.P.x + (s.P.x - e.x) * 2; ty = s.P.y + (s.P.y - e.y) * 2; }
    // 물체에 막혀 제자리면 잠깐 옆으로 비켜 간다(길 찾기가 없어서)
    if (!s.b && Math.hypot(tx - s.P.x, ty - s.P.y) > 60) {
      if (Math.hypot(s.P.x - stuck.x, s.P.y - stuck.y) > 12) { stuck.x = s.P.x; stuck.y = s.P.y; stuck.t = s.time; }
      else if (s.time - stuck.t > 1.5 && !stuck.until) { stuck.until = s.time + 1.2; stuck.dx = (Math.random() < 0.5 ? -1 : 1) * 260; }
    }
    if (stuck.until) { if (s.time < stuck.until) { tx = s.P.x + stuck.dx; ty = s.P.y + 120; } else { stuck.until = 0; stuck.t = s.time; } }
    const dx = tx - s.P.x, dy = ty - s.P.y, want = new Set();
    if (dx < -20) want.add('KeyA'); if (dx > 20) want.add('KeyD');
    if (dy < -20) want.add('KeyW'); if (dy > 20) want.add('KeyS');
    await setKeys(want);
    if (dashNow) await page.keyboard.press('Space');
    if (s.near.length > 2 && Math.random() < 0.2) await page.keyboard.press('Space');
    if (Math.random() < 0.05) await page.keyboard.press('KeyE');
    if (s.b && s.b.sh && s.b.orbs.length && wrongBudget === 0 && Math.random() > ACC) wrongBudget = -1;
    if (s.b && !s.b.sh) wrongBudget = 0;
    if (s.time - lastLog > 15) { lastLog = s.time; console.log(JSON.stringify({ t: s.time.toFixed(0), zone: s.zone, hp: Math.round(s.P.hp) + '/' + s.max, lives: s.lives, lv: s.lv, walls: s.walls.join(','), boss: s.b ? { r: s.b.r, hp: s.b.hp.toFixed(2), sh: s.b.sh } : null, downs: s.stats.downs, P: [s.P.x | 0, s.P.y | 0], objs: s.objs.slice(0, 3).map(o => o.k + (o.x | 0) + ',' + (o.y | 0)) })); }
    await sleep(90);
  }
  await page.screenshot({ path: os.tmpdir() + '/colony2126_bot_end_s' + STAGE + '_' + DIFF + '.png' });
  console.log('ERR', errs.join('\n') || 'none');
  await browser.close();
})();
