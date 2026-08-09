/* 동작 검증 — 상호작용이 설명대로 움직이는지 하나씩 확인한다.
   진행 속도(값 곡선)는 _pace.js 쪽에서 따로 잰다. */
'use strict';
const fs = require('fs');
const { G, C, DT, log, clear } = require('./_head.js');

/* 1 ─ 가까이의 기준 -------------------------------------------------- */
clear();
const probe = G.board.makeWord('FIRE', 300, 300);
console.log('"가까이" 의 기준 — range 가 실제로 몇 px 의 틈을 뜻하는가\n');
console.log('  range   허용 틈   (참고: FIRE 너비 ' + Math.round(probe.w) + 'px)');
for (const r of [96, 100, 118, 124, 152, 180, 190, 210]) {
  const gap = Math.max(C.RANGE_MIN, (r - C.RANGE_BASE) * C.RANGE_MUL);
  console.log(`  ${String(r).padStart(5)}  ${gap.toFixed(0).padStart(6)}px`);
}

/* 2 ─ 글자는 바뀌지 않는다. 익을 뿐이다 -------------------------------- */
console.log('\n\n고기를 불 옆에 계속 두면\n');
clear();
let meat = G.board.makeWord('MEAT', 480, 300);
const fireX = 480 + meat.w / 2 + 30 + 8;          // 틈 8px — 바짝 붙여 놓은 상태
const fire = G.board.makeWord('FIRE', fireX, 300);
let tSec = 0, marks = [], ripeAt = 0;
for (let i = 0; i < 30 * 90; i++) {
  tSec += DT;
  meat.x = 480; meat.y = 300; meat.vx = meat.vy = 0;
  fire.x = fireX; fire.y = 300; fire.vx = fire.vy = 0;
  G.board.step(DT);
  if (!ripeAt) {
    if ((meat.data.ripe || 0) >= 1) {
      ripeAt = tSec;
      marks.push([tSec, `다 익었다 — 글자는 그대로 ${meat.text}, 벌이 ×${meat.incomeMul.toFixed(1)}`]);
    } else if (meat.ripeShown >= 0.5 && !marks.length) {
      marks.push([tSec, '노릇해지는 중 (빛깔 ' + meat.ripeShown.toFixed(2) + ')']);
    }
  } else if (meat.burning) { marks.push([tSec, '그대로 두었더니 탔다']); break; }
}
for (const [t, m] of marks) console.log('  ' + t.toFixed(0).padStart(3) + '초   ' + m);
console.log('\n  띄운 안내문: ' + (log.length ? log.join(' / ') : '없음'));
console.log('  보드에 남은 것: ' + G.board.all().map(e => e.text).join(', ') +
  '   (ROAST 가 생기지 않아야 정상)');

/* 제때 빼면 익은 채로 남는다 — 식어서 되돌아가지 않는다 */
clear();
const m2 = G.board.makeWord('MEAT', 480, 300);
const f3 = G.board.makeWord('FIRE', 480 + m2.w / 2 + 30 + 8, 300);
for (let i = 0; i < 30 * 30; i++) { m2.x = 480; m2.y = 300; G.board.step(DT); }
const wasRipe = m2.data.ripe || 0, wasMul = m2.incomeMul;
G.board.remove(f3);
for (let i = 0; i < 30 * 120; i++) G.board.step(DT);                  // 2분 방치
const alive = G.board.get(m2.id);
console.log('\n  제때 불에서 빼면: 익은 정도 ' + wasRipe.toFixed(2) + ' → ' +
  (alive ? (alive.data.ripe || 0).toFixed(2) : '—') +
  ' · 2분 뒤에도 ' + (alive ? alive.text : '사라짐') +
  ' (벌이 ×' + wasMul.toFixed(1) + ' → ×' + (alive ? alive.incomeMul.toFixed(1) : '-') + ')');

/* 나머지 무르익음 — 짝을 붙여 두면 익고, 글자는 그대로여야 한다 */
console.log('\n\n무르익는 것들 (짝을 곁에 두고 3분)\n');
console.log('  단어    짝        3분 뒤   익은 정도   벌이');
for (const [word, mate] of [['MEAT', 'FIRE'], ['MILK', 'TIME'], ['SEED', 'SUN'], ['EGG', 'NEST']]) {
  clear();
  const a = G.board.makeWord(word, 420, 300);
  const b = G.board.makeWord(mate, 420 + a.w / 2 + 26, 300);
  for (let i = 0; i < 30 * 180; i++) {
    a.x = 420; a.y = 300; a.vx = a.vy = 0;
    b.x = 420 + a.w / 2 + 26; b.y = 300; b.vx = b.vy = 0;
    G.board.step(DT);
    if (word === 'MEAT' && (a.data.ripe || 0) >= 1) G.board.remove(b);   // 다 익으면 뺀다
  }
  const now = G.board.get(a.id);
  console.log('  ' + word.padEnd(7) + mate.padEnd(9) +
    (now ? now.text : '사라짐').padEnd(9) +
    (now ? (now.data.ripe || 0).toFixed(2) : '—').padStart(6) +
    (now ? '   ×' + now.incomeMul.toFixed(1) : ''));
}

/* 변신이 정말 사라졌는가 — 예전 조리법을 하나씩 다시 걸어 본다 */
console.log('\n\n예전 변신 조리법을 다시 걸어 보면 (각 3분)\n');
for (const [a1, b1, gone] of [['SAND', 'FIRE', 'GLASS'], ['ICE', 'FIRE', 'WATER'],
['ROCK', 'RIVER', 'SAND'], ['WATER', 'FIRE', 'STEAM'], ['MILK', 'TIME', 'CHEESE'],
['SEED', 'SUN', 'TREE'], ['EGG', 'NEST', 'BIRD']]) {
  clear();
  const a = G.board.makeWord(a1, 420, 300);
  const b = G.board.makeWord(b1, 420 + a.w / 2 + 26, 300);
  for (let i = 0; i < 30 * 180; i++) {
    a.x = 420; a.y = 300; a.vx = a.vy = 0;
    b.x = 420 + a.w / 2 + 26; b.y = 300; b.vx = b.vy = 0;
    G.board.step(DT);
  }
  const made = G.board.all().some(e => e.text === gone);
  console.log('  ' + (a1 + ' + ' + b1).padEnd(16) + '→ ' + gone.padEnd(8) +
    (made ? '아직 변신한다 (문제)' : '생기지 않는다'));
}

/* 2.5 ─ 변신 대신 들어온 상호작용이 실제로 도는가 ---------------------- */
console.log('\n\n변신 자리에 들어온 상호작용\n');

/* 모래가 타는 것을 덮어 끈다 */
{
  clear();
  const t = G.board.makeWord('TREE', 400, 300); t.ignite();
  const s = G.board.makeWord('SAND', 400 + t.w / 2 + 26, 300);
  let out = 0;
  for (let i = 0; i < 30 * 20; i++) {
    t.x = 400; t.y = 300; s.x = 400 + t.w / 2 + 26; s.y = 300;
    G.board.step(DT);
    if (!t.burning && !out) { out = i * DT; break; }
  }
  console.log('  SAND 가 타는 TREE 를 덮어      ' +
    (out ? out.toFixed(0) + '초 만에 껐다' : '20초 동안 못 껐다'));
}

/* 얼음은 불 곁에서 녹았다가 열을 치우면 도로 언다 */
{
  clear();
  const ice = G.board.makeWord('ICE', 400, 300);
  const f = G.board.makeWord('FIRE', 400 + ice.w / 2 + 26, 300);
  for (let i = 0; i < 30 * 25; i++) { ice.x = 400; ice.y = 300; f.x = 400 + ice.w / 2 + 26; f.y = 300; G.board.step(DT); }
  const melted = ice.data.melt;
  G.board.remove(f);
  for (let i = 0; i < 30 * 40; i++) { ice.x = 400; ice.y = 300; G.board.step(DT); }
  console.log('  ICE 는 불 곁에서 녹고           녹은 정도 ' + melted.toFixed(2) +
    ' → 열을 치우니 ' + ice.data.melt.toFixed(2) + ' (여전히 ' + ice.text + ')');
}

/* 강 한가운데 바위를 놓으면 낱글자가 그 뒤에 걸린다 */
{
  G.state.expandLevel = 6; G.board.layout();          // 넉넉한 판에서 흘려 보낸다
  const kept = [];
  for (const withRock of [false, true]) {
    let stay = 0, total = 0;
    for (let trial = 0; trial < 12; trial++) {
      clear();
      const cx = G.board.size().w / 2, cy = G.board.size().h / 2;
      const r = G.board.makeWord('RIVER', cx, cy);
      const rx = cx + 60;
      if (withRock) G.board.makeWord('ROCK', rx, cy);
      const L = new G.Entity('letter', 'Q', rx + 26, cy);
      G.board.add(L);
      for (let i = 0; i < 30 * 40; i++) { r.x = cx; r.y = cy; r.vx = r.vy = 0; G.board.step(DT); }
      total++;
      if (Math.hypot(L.x - rx, L.y - cy) < 70) stay++;
    }
    kept.push(stay + '/' + total);
  }
  G.state.expandLevel = 0; G.board.layout();
  console.log('  RIVER 에 띄운 낱글자가 40초 뒤 그 자리에 남아 있던 비율');
  console.log('      바위 없이 ' + kept[0] + ' · 바위를 놓으면 ' + kept[1]);
}

/* 물은 불 곁에서 끓어 주변을 재촉하고, 김은 데워 주지 않으면 식는다 */
{
  clear();
  const w = G.board.makeWord('WATER', 400, 300);
  const f = G.board.makeWord('FIRE', 400 + w.w / 2 + 22, 300);
  const c = G.board.makeWord('CLOCK', 400 - w.w / 2 - 30, 300);
  for (let i = 0; i < 30 * 3; i++) { w.x = 400; w.y = 300; f.x = 400 + w.w / 2 + 22; f.y = 300; c.x = 400 - w.w / 2 - 30; c.y = 300; G.board.step(DT); }
  console.log('  WATER 가 불 곁에서 끓는가        ' + (w.data.boil ? '끓는다' : '아니다') +
    ' · 곁의 CLOCK 재촉 ×' + c.speedMul.toFixed(2));

  clear();
  const st = G.board.makeWord('STEAM', 400, 300);
  for (let i = 0; i < 30 * 60; i++) { st.x = 400; st.y = 300; G.board.step(DT); }
  const cold = st.data.hot;
  const f2 = G.board.makeWord('FIRE', 400 + st.w / 2 + 26, 300);
  for (let i = 0; i < 30 * 15; i++) { st.x = 400; st.y = 300; f2.x = 400 + st.w / 2 + 26; f2.y = 300; G.board.step(DT); }
  console.log('  STEAM 은 1분 두면 김이 ' + cold.toFixed(2) +
    ' 까지 식고, 다시 데우면 ' + st.data.hot.toFixed(2) + ' (여전히 ' + st.text + ')');
}

/* 둥지에 든 새는 알 대신 글자를 떨군다 */
{
  clear();
  const b = G.board.makeWord('BIRD', 400, 300);
  const n = G.board.makeWord('NEST', 400 + b.w / 2 + 22, 300);
  for (let i = 0; i < 30 * 120; i++) { b.x = 400; b.y = 300; n.x = 400 + b.w / 2 + 22; n.y = 300; G.board.step(DT); }
  const eggs = G.board.all().filter(e => e.text === 'EGG').length;
  const letters = G.board.all().filter(e => e.type === 'letter').length;
  console.log('  BIRD + NEST 2분              EGG ' + eggs + '개 · 낱글자 ' + letters + '개');
}

/* 2.7 ─ 톱니바퀴는 몇 개까지 물리는가 ---------------------------------- */
console.log('\n\n톱니바퀴\n');
{
  G.state.expandLevel = C.EXPAND_SCALE.length - 1; G.board.layout();
  /* 가운데 하나를 두고 둘레에 최대한 많이 욱여넣어 본다 */
  clear();
  const cx = G.board.size().w / 2, cy = G.board.size().h / 2;
  const mid = G.board.makeWord('GEAR', cx, cy);
  const ring = [];
  for (let a = 0; a < 12; a++) {
    const t = (a / 12) * 6.2832;
    ring.push(G.board.makeWord('GEAR', cx + Math.cos(t) * 62, cy + Math.sin(t) * 44));
  }
  for (let i = 0; i < 30 * 8; i++) { mid.x = cx; mid.y = cy; mid.vx = mid.vy = 0; G.board.step(DT); }
  let meshed = 0;
  for (const g of ring) if (Math.hypot(g.x - cx, g.y - cy) <= C.GEAR_MESH) meshed++;
  console.log('  톱니 12개를 한가운데 몰아넣어도 실제로 물리는 수   ' + meshed + '개' +
    ' (상한 ' + C.GEAR_MAX + ')');
  console.log('  가운데 톱니 벌이 배수                            ×' + mid.gearMul.toFixed(0));

  /* 물린 수에 따라 벌이가 어떻게 오르는가 */
  console.log('\n  물린 수   그 톱니 벌이   톱니 한 벌(가운데+둘레) 20초 수입');
  for (const n of [0, 1, 2, 3, 4]) {
    clear();
    const c = G.board.makeWord('GEAR', cx, cy);
    const put = [[62, 0], [-62, 0], [0, 44], [0, -44]].slice(0, n);
    const arms = put.map(([dx, dy]) => G.board.makeWord('GEAR', cx + dx, cy + dy));
    for (let i = 0; i < 30 * 4; i++) {
      c.x = cx; c.y = cy; c.vx = c.vy = 0;
      arms.forEach((g, k) => { g.x = cx + put[k][0]; g.y = cy + put[k][1]; g.vx = g.vy = 0; });
      G.board.step(DT);
    }
    const total = [c].concat(arms).reduce((s, g) => s + g.income(), 0);
    console.log('  ' + String(n).padStart(6) + '   ×' + String(c.gearMul).padStart(2) +
      ' · ' + (c.income().toFixed(0) + 'w').padStart(6) +
      '   ' + (total.toFixed(0) + 'w').padStart(6) +
      '   (보통 4글자 ' + (n + 1) + '개라면 ' + (G.wordValue(4) * (n + 1)).toFixed(0) + 'w)');
  }
  G.state.expandLevel = 0; G.board.layout();
}

/* 3 ─ 상태가 걸린 글자는 붙지 않는다 --------------------------------- */
console.log('\n\n상태가 걸린 글자는 붙지 않는다\n');
clear();
const cases = [];
{ const a = G.board.makeWord('MEAT', 400, 200); const f2 = G.board.makeWord('FIRE', 400 + a.w / 2 + 30, 200);
  for (let i = 0; i < 30 * 8; i++) { a.x = 400; a.y = 200; f2.x = 400 + a.w / 2 + 30; f2.y = 200; G.board.step(DT); }
  cases.push(['불에 익는 중인 MEAT', a.afflicted()]); }
{ const b = new G.Entity('letter', 'K', 200, 400); G.board.add(b); b.ignite();
  cases.push(['타고 있는 글자 K', b.afflicted()]); }
{ const c = new G.Entity('letter', 'L', 700, 400); G.board.add(c); c.chill = 0.7;
  cases.push(['얼어붙은 글자 L', c.afflicted()]); }
{ const d = new G.Entity('letter', 'M', 700, 500); G.board.add(d);
  cases.push(['멀쩡한 글자 M', d.afflicted()]); }
for (const [name, v] of cases) console.log('  ' + name.padEnd(22) + (v ? '붙지 않음' : '붙는다'));

const src = fs.readFileSync('js/drag.js', 'utf8');
console.log('\n  drag.js 차단 지점: ' + (src.match(/afflicted\(\)/g) || []).length + '곳 (후보 탐색 · 놓는 순간 · 합쳐지기 직전)');

/* 3.5 ─ 보드 정원이 확장을 따라 늘어나는가 ----------------------------- */
console.log('\n\n보드 정원과 확장\n');
console.log('  단계   정원   확장 비용   보드 크기   넓이   빽빽한 정도');
for (let lv = 0; lv < C.EXPAND_SCALE.length; lv++) {
  G.state.expandLevel = lv;
  G.board.layout();
  const cost = lv < C.EXPAND_COSTS.length ? C.EXPAND_COSTS[lv] + 'w' : '—';
  const s = C.EXPAND_SCALE[lv], area = s * s / (C.EXPAND_SCALE[0] ** 2);
  const dens = G.maxEntities() / (s * s);
  console.log(`  ${String(lv).padStart(4)}   ${String(G.maxEntities()).padStart(4)}개   ${cost.padStart(9)}` +
    `   비율 ${s.toFixed(2)}   ${(area.toFixed(2) + '배').padStart(6)}   ${dens.toFixed(0).padStart(6)}`);
}
console.log('  (빽빽한 정도가 단계마다 비슷해야 넓이와 정원이 보조를 맞춘 것이다)');
G.state.expandLevel = 0;
G.board.layout();
console.log('  (정원이 다 차면 글자가 더 나오지 않는다 → 확장을 사야 한다)');

/* 정원이 실제로 생성을 막는지 */
clear();
for (let i = 0; i < 40; i++) { if (G.board.count() < G.maxEntities()) G.board.spawnLetter(); }
console.log('  0단계에서 40번 만들어 보면: ' + G.board.count() + '개에서 멈춘다');

/* 다 찼을 때 게이지가 가득 찬 채로 붙잡혀 있다가, 자리가 나면 바로 나오는지 */
{
  clear();
  while (G.board.count() < G.maxEntities()) G.board.spawnLetter();
  G.state.spawnTimer = 0.2;
  for (let i = 0; i < 30 * 30; i++) G.game.stepSpawn(DT);   // 정원이 찬 채로 30초
  const held = G.state.spawnTimer;
  const over = G.board.count() > G.maxEntities();
  console.log('\n  정원이 찬 채 30초를 두면');
  console.log('    남은 대기 ' + held.toFixed(2) + '초 → 게이지 ' +
    (100 * Math.max(0, Math.min(1, 1 - held / G.game.spawnInterval()))).toFixed(0) + '%' +
    (held === 0 ? ' (가득 찬 채로 멈춰 있다)' : ' (되감겼다 — 버그)'));
  console.log('    정원을 넘겼는가 ' + (over ? '넘겼다 — 버그' : '아니다 ' + G.board.count() + '개'));

  G.board.remove(G.board.all()[0]);                        // 한 칸 비우면
  const before = G.board.count();
  G.game.stepSpawn(DT);
  console.log('    한 칸 비우고 한 프레임(' + (DT * 1000).toFixed(0) + 'ms) 뒤 ' +
    before + '개 → ' + G.board.count() + '개' +
    (G.board.count() > before ? ' (바로 나왔다)' : ' (안 나왔다 — 버그)'));
}

/* 3.6 ─ 힌트권 ---------------------------------------------------------- */
console.log('\n\n힌트권\n');
{
  console.log('  산 장수   다음 한 장   ' +
    C.TICKET_PACKS.map(n => (n + '장').padStart(9)).join(''));
  for (const b of [0, 10, 50, 100]) {
    console.log('  ' + String(b).padStart(6) + '   ' + (G.ticketPrice(b) + 'w').padStart(9) +
      '   ' + C.TICKET_PACKS.map(n => (G.ticketPack(n, b).toLocaleString() + 'w').padStart(9)).join(''));
  }

  /* 묶음값이 한 장씩 사는 것과 어긋나면 어느 한쪽이 이득이 되어 버린다 */
  let ok = true;
  for (const n of C.TICKET_PACKS) {
    let one = 0;
    for (let i = 0; i < n; i++) one += G.ticketPrice(30 + i);
    if (one !== G.ticketPack(n, 30)) ok = false;
  }
  console.log('  묶음값 = 한 장씩 산 값의 합 ' + (ok ? '· 맞다' : '· 어긋난다 — 버그'));

  const per = C.HINT_TICKETS.reduce((a, b) => a + b, 0);
  let first = 0;
  for (let i = 0; i < per; i++) first += G.ticketPrice(i);
  let all = 0;
  for (let i = 0; i < per * G.WORDS.length; i++) all += G.ticketPrice(i);
  const up = C.SPAWN_COSTS.concat(C.EXPAND_COSTS).reduce((a, b) => a + b, 0);
  console.log('  한 단어를 끝까지 (' + C.HINT_TICKETS.join('+') + '=' + per + '장) ' +
    first.toLocaleString() + 'w');
  console.log('  51개를 전부 힌트로만        ' + all.toLocaleString() + 'w' +
    '  (업그레이드 전부 ' + up.toLocaleString() + 'w)');

  console.log('\n  3단계에서 드러나는 철자');
  console.log('    ' + ['SUN', 'FIRE', 'DIAMOND'].map(id =>
    id + ' → ' + [...id].map((c, i) => i < G.hintReveal(id.length) ? c : '?').join('')).join(' · '));
}

/* 3.7 ─ 능력 단어가 보통 단어보다 얼마나 더 버는가 ---------------------- */
console.log('\n\n능력 단어의 벌이 (보통 단어 = 1.0)\n');

/* 51개를 한 판에 다 깔고 2분 굴린 뒤, 같은 길이의 보통 단어와 견준다 */
function boardMul() {
  G.state.expandLevel = C.EXPAND_SCALE.length - 1;    // 다 키운 보드에서 잰다
  G.board.layout();
  clear();
  const b = G.board.size(), ids = G.WORDS.map(w => w.id);
  const cols = Math.ceil(Math.sqrt(ids.length * b.w / b.h));
  const rows = Math.ceil(ids.length / cols);
  for (let k = 0; k < ids.length; k++) {
    G.board.makeWord(ids[k], (b.w / cols) * ((k % cols) + .5),
      (b.h / rows) * (((k / cols) | 0) + .5));
  }
  for (let i = 0; i < 30 * 120; i++) G.board.step(DT);
  let live = 0, sum = 0, base = 0;
  const per = [];
  for (const e of G.board.all()) {
    if (e.type !== 'word' || !G.WORD_BY_ID[e.text]) continue;
    live++; sum += e.income(); base += G.wordValue(e.text.length);
    per.push([e.text, e.incomeMul]);
  }
  per.sort((a, b) => b[1] - a[1]);
  return { live, sum, base, per };
}
const bm = boardMul();
console.log('  다 키운 보드에 ' + bm.live + '개를 고르게 깔았을 때');
console.log('    보통 단어였다면  ' + Math.round(bm.base) + 'w / 20초');
console.log('    능력 단어라서    ' + Math.round(bm.sum) + 'w / 20초');
console.log('    전체 배수        ×' + (bm.sum / bm.base).toFixed(2));
console.log('\n  배수가 높은 순서 (상위 12개)');
for (const [t, m] of bm.per.slice(0, 12)) {
  console.log('    ' + t.padEnd(9) + '×' + m.toFixed(2));
}

/* 일부러 겹쳐 쌓으면 얼마까지 가는가 — 배수는 곱으로 붙으므로 이쪽이 진짜 문제다 */
console.log('\n  한 단어에 부스터를 겹쳐 쌓으면');
function stack(target, mates) {
  clear();
  const t = G.board.makeWord(target, 500, 340);
  const put = [];
  for (let i = 0; i < mates.length; i++) {
    const a = (i / mates.length) * 6.2832;
    put.push(G.board.makeWord(mates[i], 500 + Math.cos(a) * 96, 340 + Math.sin(a) * 74));
  }
  for (let k = 0; k < 30 * 90; k++) {
    t.x = 500; t.y = 340; t.vx = t.vy = 0;
    for (let i = 0; i < put.length; i++) {
      const a = (i / put.length) * 6.2832;
      put[i].x = 500 + Math.cos(a) * 96; put[i].y = 340 + Math.sin(a) * 74;
      put[i].vx = put[i].vy = 0;
    }
    G.board.step(DT);
  }
  return G.board.get(t.id) ? t.incomeMul : 0;
}
console.log('    (상한 ×' + C.INCOME_CAP + ' — 실제로 들어오는 돈은 여기서 잘린다)');
for (const [name, target, mates] of [
  ['보석 하나에 빛을 모아', 'DIAMOND', ['SUN', 'MOON', 'GLASS', 'LAMP', 'GHOST']],
  ['익힌 고기에 다 붙이기', 'MEAT', ['FIRE', 'COAL', 'SUN', 'MOON', 'GLASS', 'LAMP', 'GHOST']],
  ['금덩이 진열', 'GOLD', ['BANK', 'SUN', 'MOON', 'GLASS', 'LAMP', 'GHOST']]
]) {
  const raw = stack(target, mates);
  console.log('    ' + name.padEnd(22) + '쌓인 배수 ×' + raw.toFixed(1) +
    '  →  실제 ×' + Math.min(raw, C.INCOME_CAP).toFixed(1));
}

/* 사건 보상이 20초 수입의 몇 배씩 터지는가 — 실제 코드에서 읽어 온다 */
console.log('\n  한 번씩 터지는 사건이 20초 수입의 몇 배인가');
const bsrc = fs.readFileSync('js/behaviors.js', 'utf8');
const rw = [...bsrc.matchAll(/reward\(([\d.]+),\s*(\d+)\)/g)].map(m => [+m[1], +m[2]]);
rw.sort((a, b) => b[0] - a[0]);
console.log('    가장 큰 것 ×' + rw[0][0] + ' + ' + rw[0][1] + 'w · ' +
  '가장 작은 것 ×' + rw[rw.length - 1][0] + ' + ' + rw[rw.length - 1][1] + 'w · ' +
  '모두 ' + rw.length + '건, 평균 ×' + (rw.reduce((s, r) => s + r[0], 0) / rw.length).toFixed(2));

/* 4 ─ 가게가 흘리는 잔돈이 얼마나 되는가 -------------------------------- */
console.log('\n\n가게 특가 동전 (26~40초에 한 번)\n');
console.log('  가게 수   보드 20초 수입   동전 한 개   분당 잔돈   수입 대비');
for (const n of [1, 3, 10, 25]) {
  clear();
  for (let i = 0; i < n; i++) G.board.makeWord('SHOP', 60 + (i % 10) * 95, 60 + Math.floor(i / 10) * 95);
  /* 벌이가 큰 보드를 흉내내려고 값나가는 단어를 곁들인다 */
  for (let i = 0; i < 12; i++) G.board.makeWord('DIAMOND', 60 + (i % 10) * 95, 420 + Math.floor(i / 10) * 95);
  G.board.step(DT);
  const rate = G.board.payRate();
  /* 동전 값은 behaviors.js 의 shop 이 쓰는 식을 그대로 읽어 온다 */
  const sm = bsrc.match(/reward\(([\d.]+),\s*(\d+)\)\s*\*\s*U\.rand/);
  const coin = Math.max(1, (+sm[2] + rate * +sm[1]) / n);
  const perMin = coin * (60 / 33) * n;
  const income = rate * 3;
  console.log(`  ${String(n).padStart(7)}   ${(rate.toFixed(0) + 'w').padStart(12)}   ${(coin.toFixed(0) + 'w').padStart(9)}   ${(perMin.toFixed(0) + 'w').padStart(9)}   ${(100 * perMin / income).toFixed(0).padStart(6)}%`);
}
console.log('  (동전은 손으로 주워야 들어온다. 가게를 늘려도 총액은 그대로여야 정상)');

/* 5 ─ 능력 단어를 전부 깔고 5분 돌려 본다 (터지는 곳이 없는지) */
G.state.expandLevel = C.EXPAND_SCALE.length - 1;
G.board.layout();
clear();
{
  const b = G.board.size();
  const cols = Math.ceil(Math.sqrt(G.WORDS.length * b.w / b.h));
  const rows = Math.ceil(G.WORDS.length / cols);
  G.WORDS.forEach((w, i) => {
    G.board.makeWord(w.id, (b.w / cols) * ((i % cols) + .5),
      (b.h / rows) * (((i / cols) | 0) + .5));
  });
}
for (let i = 0; i < 14; i++) G.board.spawnLetter();
const before = G.board.count();
let crash = null;
try {
  for (let i = 0; i < 30 * 300; i++) G.board.step(DT);
} catch (err) { crash = err; }
console.log('\n\n능력 단어 ' + G.WORDS.length + '개를 한 판에 깔고 5분\n');
console.log('  ' + (crash ? '터졌다: ' + crash.message : '무사히 돌았다') +
  ' · 남은 것 ' + G.board.count() + '개 (처음 ' + before + '개)');
const kinds = {};
log.forEach(m => { const k = m.replace(/[A-Z]{3,}/g, '○'); kinds[k] = (kinds[k] || 0) + 1; });
const top = Object.entries(kinds).sort((a, b) => b[1] - a[1]).slice(0, 8);
console.log('  일어난 일 ' + log.length + '건 중 잦은 순서:');
top.forEach(([k, n]) => console.log('    ' + String(n).padStart(4) + '회  ' + k));
