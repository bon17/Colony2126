// 자동 플레이 봇: 실제 키 입력으로 한 스테이지를 처음(상황 컷)부터 보스 격파까지 플레이한다(순간 이동·무적 없음).
// 쓰는 법(저장소 맨 위에서, Playwright 필요): node tools/playtest_bot.js [easy|normal|hard] [정답률 0~1] [스테이지 번호]
// 예: node tools/playtest_bot.js normal 0.8 6   → 15초마다 상태를 찍고, 끝나면 END clear/gameover 와 오류(ERR)를 보여 준다.
// 봇은 학생보다 훨씬 빠르게 움직이니 걸린 시간은 '최소 시간'으로만 본다. 새 스테이지의 장치를 넣으면 이 봇도 같이 고친다.
// 이어 하기: BOT_SAVE=파일 을 주면 그 파일의 저장(레벨·강화·기술)으로 시작하고, 깨면 그 파일에 저장한다.
//   1~6스테이지를 차례로 같은 파일로 돌리면 학생처럼 강화가 쌓인 채로 플레이한다.
// 목숨을 다 쓰면 그 스테이지를 처음부터 두 번까지 다시 한다(어려움 확인용). 마지막 줄 TRIES = 시도 횟수, 모든 시도의 쓰러짐 합.
const path = require('path'), os = require('os'), fs = require('fs');
const SAVE_FILE = process.env.BOT_SAVE || '';
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
  const carry = SAVE_FILE && fs.existsSync(SAVE_FILE) ? JSON.parse(fs.readFileSync(SAVE_FILE, 'utf8')) : null;
  await page.evaluate(([d, st, c]) => { __colony.reset(); const s = __colony.save; if (c) Object.assign(s, c); s.started = true; s.difficulty = d; __colony.start(st, true); }, [DIFF, STAGE, carry]);
  let tries = 1, downsSum = 0;
  const held = new Set();
  async function setKeys(want) {
    for (const k of [...held]) if (!want.has(k)) { await page.keyboard.up(k); held.delete(k); }
    for (const k of want) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
  }
  let lastLog = 0, wrongBudget = 0, lastWrong = 0, jitter = 0, shots = [], lastZone = null, zoneT = 0;
  const stuck = { x: 0, y: 0, t: 0, until: 0, dx: 0 }, sockPick = { id: null, wrong: false, n: 0 };
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
      // 종장: 지금 열 단말기의 방법, 퀴즈(타이밍 카드 위치, 빈칸·조각 버튼 자리)
      let core = null;
      if (G.L.sockets) {
        const zz = G.zones[G.zoneIdx], ww = zz && G.walls.find(w => w.id === zz.exit), cs = ww && G.gens.find(g => g.socket && g.alive && ww.gens.includes(g.id));
        core = { method: cs ? cs.method : null, ready: !!(cs && cs.ready), sx: cs ? cs.x : 0, sy: cs ? cs.y : 0, run: G.core.run.phase, quiz: __colony.quiz() };
      }
      return { core, ztags: G.zones.map(z => z.tag || ''), barOn, shells, work: !!(G.work && !G.work.done), race: G.race && G.race.on, stage: G.def.id, guide: __colony.guide(), allChips, gateOn: !!(rg && rg.active), restricted: G.restricted, mode: G.mode, time: G.time, P: { x: P.x, y: P.y, hp: P.hp, dead: P.dead }, max: G.st.maxHp, lives: G.lives, lv: G.level, zone: G.zoneIdx, objs, b, near, stats: G.stats, scene: __colony.scene, walls: G.walls.filter(w => w.active).map(w => w.id) };
    });
    if (!s) break;
    // 종장은 보스를 반박하면 엔딩 화면으로 넘어간다
    if (s.scene === 'ending' || s.mode === 'ending') { await setKeys(new Set()); console.log('ZONE boss', (s.time - zoneT).toFixed(0) + 's'); console.log('END clear(ending)', JSON.stringify({ t: s.time.toFixed(0), lv: s.lv, lives: s.lives, stats: s.stats })); downsSum += s.stats.downs; break; }
    if (s.scene !== 'stage') break;
    // 구간이 바뀔 때마다 그 구간에 걸린 시간(움직인 시간)을 찍는다
    if (s.zone !== lastZone && s.mode === 'play') { if (lastZone !== null) console.log('ZONE', s.ztags[lastZone] || ['A', 'B', 'C'][lastZone] || 'boss', (s.time - zoneT).toFixed(0) + 's'); lastZone = s.zone; zoneT = s.time; }
    if (s.mode === 'levelup') { await setKeys(new Set()); await sleep(500); await page.keyboard.press(String(1 + Math.floor(Math.random() * 3)).replace(/^/, 'Digit')); continue; }
    if (s.mode === 'claim') { await setKeys(new Set()); await sleep(2900); await page.keyboard.press('Enter'); continue; }
    // 종장: 단말기가 열리면 퀴즈. 타이밍은 설명 카드 뒤 게임 중에, 빈칸·사진 조각은 멈춘 카드에서
    if (s.mode === 'sockClaim') { await setKeys(new Set()); await sleep(1700); await page.keyboard.press('Enter'); continue; }
    if (s.mode === 'quizCard') {
      await setKeys(new Set()); const q = s.core && s.core.quiz;
      if (!q || q.solved || !q.ui) { await sleep(300); continue; }
      if (sockPick.id !== q.id) { sockPick.id = q.id; sockPick.wrong = Math.random() > ACC; await sleep(1500); continue; }
      const click = async r => { await page.mouse.click(r.x + r.w / 2, r.y + r.h / 2); await sleep(350); };
      if (q.type === 'blank') { const w = q.ui.find(r => !r.ok); if (sockPick.wrong && w) { sockPick.wrong = false; await click(w); } else await click(q.ui.find(r => r.ok)); }
      else {
        const i = q.tiles.findIndex((t, k) => !(t[0] === Math.floor(k / 3) && t[1] === k % 3));
        const j = q.tiles.findIndex(t => t[0] === Math.floor(i / 3) && t[1] === i % 3);
        if (i >= 0 && j >= 0) { await sleep(500); await click(q.ui[i]); await click(q.ui[j]); }
      }
      continue;
    }
    if (s.mode === 'chain') { await setKeys(new Set()); await sleep(1200); await page.keyboard.press('Enter'); continue; }
    if (s.mode === 'rebut') { await setKeys(new Set()); await sleep(1200); await page.keyboard.press('Enter'); continue; }
    if (s.mode === 'down') { await setKeys(new Set()); await sleep(10300); await page.keyboard.press('Enter'); continue; }
    if (s.mode === 'record') { await setKeys(new Set()); await sleep(7300); await page.keyboard.press('Enter'); continue; }
    if (s.mode === 'rules') { await setKeys(new Set()); await sleep(10400); await page.keyboard.press('Enter'); continue; }
    if (s.mode === 'intro') { await page.keyboard.press('Enter'); await sleep(250); continue; }
    if (s.mode === 'brief') { await page.keyboard.press('Enter'); await sleep(200); continue; }
    if (s.mode === 'bossIntro') { await setKeys(new Set()); await page.keyboard.press('Enter'); await sleep(200); continue; }
    if (s.mode === 'gameover' && tries < 3) {
      await setKeys(new Set()); downsSum += s.stats.downs;
      console.log('GAMEOVER try ' + tries, JSON.stringify({ t: s.time.toFixed(0), zone: s.zone, boss: s.b ? s.b.r : null, stats: s.stats }));
      tries++; lastZone = null; zoneT = 0; wrongBudget = 0; lastWrong = 0;
      await page.evaluate(st => __colony.start(st), STAGE); await sleep(300); continue;
    }
    if (s.mode === 'clear' || s.mode === 'gameover') { await setKeys(new Set()); console.log('ZONE', ['A', 'B', 'C'][lastZone] || 'boss', (s.time - zoneT).toFixed(0) + 's'); console.log('END', s.mode, JSON.stringify({ t: s.time.toFixed(0), lv: s.lv, lives: s.lives, stats: s.stats })); downsSum += s.stats.downs; break; }
    let tx = s.P.x, ty = s.P.y - 300, dashNow = false, quizKey = false;
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
    } else if (s.core && s.core.quiz && s.core.quiz.type === 'timing') {
      // 타이밍: 제자리에서 카드를 보고 「파동」. 단말기마다 한 번 정답률에 따라 틀린 카드를 먼저 누를지 정한다
      const q = s.core.quiz;
      if (sockPick.id !== q.id) { sockPick.id = q.id; sockPick.wrong = Math.random() > ACC; sockPick.n = q.miss; }
      if (q.miss > sockPick.n) sockPick.wrong = false;
      const mid = q.cards.find(c => Math.abs(c.x - q.cx) < 28 && !c.got);
      if (mid && (mid.ok || sockPick.wrong)) quizKey = true;
      tx = s.P.x; ty = s.P.y;
    } else if (s.core && s.core.method && s.guide) {
      // 종장 단말기 여는 방법: 안내 화살표가 가리키는 곳(일하는 사람, 단말기, 밸브, 출발선)
      tx = s.guide.x; ty = s.guide.y;
      const d = Math.hypot(tx - s.P.x, ty - s.P.y);
      if (s.core.method === 'pact' && d < 170) { tx = s.P.x + Math.sin(s.time * 2) * 100; ty = s.P.y; }
      if (s.core.method === 'hold' && d < 70) { tx = s.P.x; ty = s.P.y; }
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
    else if ((s.zone === 0 || s.zone === 1) && !s.objs.length) { tx = s.stage === 1 || s.stage === 6 ? 1270 : 800; ty = s.P.y - 300; }
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
    if (quizKey) await page.keyboard.press('KeyE');
    else if (Math.random() < 0.05 && !(s.core && s.core.quiz)) await page.keyboard.press('KeyE');
    // 한 라운드에 한 번만 틀린다(어려움은 틀리면 구슬이 다시 섞여 나와 틀린 구슬이 늘 남아 있다)
    if (wrongBudget < 0 && s.stats.wrong > lastWrong) wrongBudget = 1;
    lastWrong = s.stats.wrong;
    if (s.b && s.b.sh && s.b.orbs.length && wrongBudget === 0 && Math.random() > ACC) wrongBudget = -1;
    if (s.b && !s.b.sh) wrongBudget = 0;
    if (s.time - lastLog > 15) { lastLog = s.time; console.log(JSON.stringify({ t: s.time.toFixed(0), zone: s.zone, hp: Math.round(s.P.hp) + '/' + s.max, lives: s.lives, lv: s.lv, walls: s.walls.join(','), boss: s.b ? { r: s.b.r, hp: s.b.hp.toFixed(2), sh: s.b.sh } : null, downs: s.stats.downs, P: [s.P.x | 0, s.P.y | 0], objs: s.objs.slice(0, 3).map(o => o.k + (o.x | 0) + ',' + (o.y | 0)) })); }
    await sleep(90);
  }
  if (SAVE_FILE) { await sleep(400); const sv = await page.evaluate(() => JSON.stringify(__colony.save)); fs.writeFileSync(SAVE_FILE, sv); }
  console.log('TRIES', tries, 'downs', downsSum);
  await page.screenshot({ path: os.tmpdir() + '/colony2126_bot_end_s' + STAGE + '_' + DIFF + '.png' });
  console.log('ERR', errs.join('\n') || 'none');
  await browser.close();
})();
