// 소리 샘플 뽑기: js/chip.js의 효과음·배경 음악을 브라우저(소리 없이)에서 파일로 그려 mp3로 저장한다.
// 쓰는 법: node tools/sound_samples.js <저장할 폴더> [곡 이름…(menu stage1 … boss bossFinal ending, 효과음은 sfx)]
// 소리를 직접 틀지 않는다(OfflineAudioContext). mp3로 바꾸는 데 ffmpeg가 필요하다.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const OUT = process.argv[2] || 'sound_samples';
const SR = 32000;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('about:blank');
  await page.addScriptTag({ path: path.join(__dirname, '..', 'colony2126', 'js', 'chip.js') });
  // job: { kind: 'sfx', style } 또는 { kind: 'song', name, style, loops }
  const render = job => page.evaluate(async ({ job, SR }) => {
    const CH = window.ColonyChip;
    let dur, order = [];
    if (job.kind === 'sfx') { order = Object.keys(CH.SFX); dur = order.length * 1.3 + 0.5; }
    else dur = CH.songLength(job.name) * job.loops + 1.5;
    const ctx = new OfflineAudioContext(1, Math.ceil(dur * SR), SR);
    const out = ctx.createGain(); out.connect(ctx.destination);
    const marks = [];
    if (job.kind === 'sfx') order.forEach((n, i) => { const t = 0.3 + i * 1.3; marks.push([t, CH.SFX_NAMES[n]]); CH.sfx(ctx, out, n, t, job.style); });
    else {
      const end = CH.song(ctx, out, job.name, 0.05, job.style, job.loops);
      // 마지막 마디쯤부터 천천히 작아진다
      out.gain.setValueAtTime(1, end - 3); out.gain.linearRampToValueAtTime(0.0001, end + 0.6);
    }
    const buf = await ctx.startRendering(), d = buf.getChannelData(0);
    let peak = 0; for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
    const k = peak > 0 ? 0.5 / peak : 1, pcm = new Int16Array(d.length);
    for (let i = 0; i < d.length; i++) pcm[i] = Math.max(-32767, Math.min(32767, Math.round(d[i] * k * 32767)));
    let bin = ''; const u8 = new Uint8Array(pcm.buffer); for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return { b64: btoa(bin), peak, marks, dur };
  }, { job, SR });
  const wav = pcm => {
    const h = Buffer.alloc(44);
    h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
    h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
    h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
    return Buffer.concat([h, pcm]);
  };
  // 효과음은 부드러운 전자음, 음악은 곡마다 정한 소리(보스 두 곡만 옛날 게임기). 인자로 곡 이름을 주면 그 곡만 뽑는다
  const only = process.argv.slice(3);
  const songs = await page.evaluate(() => Object.keys(window.ColonyChip.SONGS));
  const jobs = [['효과음', { kind: 'sfx', style: 'soft' }]].concat(songs.map(n => ['음악_' + n, { kind: 'song', name: n, style: 'soft', loops: 2 }]))
    .filter(([name, job]) => !only.length || only.includes(job.name || 'sfx'));
  for (const [name, job] of jobs) {
    const r = await render(job);
    const w = path.join(OUT, name + '.wav'), m = path.join(OUT, name + '.mp3');
    fs.writeFileSync(w, wav(Buffer.from(r.b64, 'base64')));
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', w, '-codec:a', 'libmp3lame', '-b:a', '128k', m]);
    fs.unlinkSync(w);
    console.log(name, r.dur.toFixed(1) + 's', 'peak', r.peak.toFixed(2), r.marks.length ? r.marks.map(([t, n]) => t.toFixed(1) + 's ' + n).join(' · ') : '');
  }
  await browser.close();
})();
