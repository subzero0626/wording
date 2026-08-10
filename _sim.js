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
  '   (다른 단어로 바뀌지 않아야 정상)');

/* 제때 빼면 익은 채로 남는다 — 식어서 되돌아가지 않는다 */
clear();
const m2 = G.board.makeWord('MEAT', 480, 300);
const f3 = G.board.makeWord('FIRE', 480 + m2.w / 2 + 30 + 8, 300);
const f3x = 480 + m2.w / 2 + 30 + 8;
for (let i = 0; i < 30 * 15; i++) {
  m2.x = 480; m2.y = 300; m2.vx = m2.vy = 0;
  f3.x = f3x; f3.y = 300; f3.vx = f3.vy = 0;
  G.board.step(DT);
}
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
for (const [word, mate] of [['MEAT', 'FIRE'], ['SEED', 'WATER'], ['SEED', 'ICE']]) {
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
for (const [a1, b1, gone] of [['MEAT', 'FIRE', 'ROAST'], ['ICE', 'FIRE', 'WATER'],
['SEED', 'WATER', 'TREE']]) {
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

/* 2.5 ─ 능력이 하나씩만 도는가 ---------------------------------------- */
console.log('\n\n한 단어에 능력 하나\n');

/* 곁에 세워 두고 무엇이 달라지는지를 항목별로 잰다.
   SUN 은 주기만, MOON 은 액수만 건드려야 한다 */
{
  console.log('  곁에 둔 단어    벌이 액수   벌이 주기   하는 일 속도');
  for (const mate of ['SUN', 'MOON', '(없음)']) {
    clear();
    const t = G.board.makeWord('TREE', 400, 300);
    let b = null;
    if (mate !== '(없음)') b = G.board.makeWord(mate, 400 + t.w / 2 + 26, 300);
    for (let i = 0; i < 30 * 3; i++) {
      t.x = 400; t.y = 300; t.vx = t.vy = 0;
      if (b) { b.x = 400 + t.w / 2 + 26; b.y = 300; b.vx = b.vy = 0; }
      G.board.step(DT);
    }
    console.log('  ' + mate.padEnd(15) +
      ('×' + t.incomeMul.toFixed(2)).padStart(9) +
      ('×' + t.haste().toFixed(2)).padStart(12) +
      ('×' + t.speedMul.toFixed(2)).padStart(14));
  }
  console.log('  (한 줄에 배수가 하나만 서 있어야 능력이 하나인 것이다)');
}

/* 별이 힌트권을 떨구고, 주우면 손에 들어오고, 안 주우면 사라진다 */
{
  clear();
  G.state.tickets = 0;
  const s = G.board.makeWord('STAR', 400, 300);
  let dropped = 0, secs = 3600;   // 확률을 1/5 로 낮췄으니 넉넉히 굴려야 한 장 본다
  for (let i = 0; i < 30 * secs; i++) {
    s.x = 400; s.y = 300; s.vx = s.vy = 0;
    G.board.step(DT);
    if (G.tokens.count() > dropped) dropped = G.tokens.count();
  }
  console.log('\n  STAR 를 ' + secs + '초 두면 힌트권이 ' + (dropped ? '떨어진다' : '안 떨어진다') +
    ' · 안 주우면 ' + C.TICKET_DROP_LIFE + '초 뒤 사라진다 (지금 남은 것 ' +
    G.tokens.count() + '장)');
  console.log('  주웠을 때 손에 들어온 장수 ' + G.state.tickets + '장' +
    '  (줍지 않으면 0 이어야 정상)');
}

/* 숯이 불을 지피면 굽는 속도가 실제로 빨라지는가 */
{
  const at = [];
  for (const withCoal of [false, true]) {
    clear();
    const m = G.board.makeWord('MEAT', 420, 300);
    const fx = 420 + m.w / 2 + 30 + 8;
    const f = G.board.makeWord('FIRE', fx, 300);
    let c = null;
    if (withCoal) c = G.board.makeWord('COAL', fx + 40, 300);
    let t = 0, done = 0;
    for (let i = 0; i < 30 * 60; i++) {
      t += DT;
      m.x = 420; m.y = 300; m.vx = m.vy = 0;
      f.x = fx; f.y = 300; f.vx = f.vy = 0;
      if (c) { c.x = fx + 40; c.y = 300; c.vx = c.vy = 0; }
      G.board.step(DT);
      if (!done && (m.data.ripe || 0) >= 1) { done = t; break; }
    }
    at.push(done);
  }
  console.log('\n  고기가 다 익는 데 걸린 시간   불만 ' + at[0].toFixed(0) +
    '초 · 숯을 물리면 ' + at[1].toFixed(0) + '초');
}

/* 상자는 넣어 준 글자만 세고, 고양이가 들어앉으면 더 빨리 쌓는다 */
{
  const got = [];
  for (const withCat of [false, true]) {
    clear();
    const b = G.board.makeWord('BOX', 220, 150);
    const before = G.board.count();
    for (let i = 0; i < 4; i++) {
      G.behaviors.putInBox(b, G.board.spawnLetter('A', 220 + (i - 2) * 26, 190));
    }
    if (withCat) {
      const c = G.board.makeWord('CAT', 220, 100);
      for (let i = 0; i < 30 * 60; i++) {
        b.x = 220; b.y = 150; b.vx = b.vy = 0;
        c.x = 220; c.y = 100; c.vx = c.vy = 0;
        G.board.step(DT);
      }
    } else {
      for (let i = 0; i < 30 * 60; i++) { b.x = 220; b.y = 150; G.board.step(DT); }
      console.log('  넣은 글자 넉 장이 보드에서 빠졌는가  ' +
        (G.board.count() === before ? '빠졌다 (자리 그대로)' : '남아 있다 (문제)'));
    }
    got.push(b.data.stored || 0);
  }
  console.log('  상자가 1분 동안 쌓은 값       넉 장에 ' + got[0].toFixed(0) +
    'w · CAT 이 들어앉으면 ' + got[1].toFixed(0) + 'w' +
    '  (제값 ' + (4 * C.BOX_PER_LETTER * 3) + 'w)');

  /* 열쇠는 한 번 쓰면 부러진다 — 두 번째 상자는 열지 못한다 */
  clear();
  const b1 = G.board.makeWord('BOX', 150, 150);
  G.behaviors.putInBox(b1, G.board.spawnLetter('A', 150, 190));
  b1.data.stored = 120;
  const k = G.board.makeWord('KEY', 150 + b1.w / 2 + 24, 150);
  const money0 = G.state.money;
  for (let i = 0; i < 30 * 6; i++) {
    b1.x = 150; b1.y = 150; b1.vx = b1.vy = 0;
    if (G.board.get(k.id)) { k.x = 150 + b1.w / 2 + 24; k.y = 150; k.vx = k.vy = 0; }
    G.board.step(DT);
  }
  console.log('  KEY 로 상자를 열면            ' + Math.round(G.state.money - money0) +
    'w 를 받고, 열쇠는 ' + (G.board.get(k.id) ? '그대로 있다 (문제)' : '부러졌다') +
    ' · 남은 글자 ' + G.board.all().filter(e => e.type === 'letter').length + '개');
}

/* 물고기는 물이 없으면 한 푼도 벌지 못한다 */
{
  const paid = [];
  for (const withWater of [false, true]) {
    clear();
    const f = G.board.makeWord('FISH', 220, 140);
    let w = null;
    if (withWater) w = G.board.makeWord('WATER', 220 + f.w / 2 + 26, 140);
    for (let i = 0; i < 30 * 3; i++) {
      f.x = 220; f.y = 140; f.vx = f.vy = 0;
      if (w) { w.x = 220 + f.w / 2 + 26; w.y = 140; w.vx = w.vy = 0; }
      G.board.step(DT);
    }
    paid.push(f.income());
  }
  console.log('  FISH 가 20초에 버는 값        물이 없으면 ' + paid[0].toFixed(0) +
    'w · 물 곁이면 ' + paid[1].toFixed(0) + 'w');
}

/* 숯과 불 — 둘 다 세 배로 벌고, 숯은 15분이면 재가 된다 */
{
  clear();
  const f = G.board.makeWord('FIRE', 220, 140);
  const c = G.board.makeWord('COAL', 220 + f.w / 2 + 24, 140);
  const hold = () => {
    f.x = 220; f.y = 140; f.vx = f.vy = 0;
    const cc = G.board.get(c.id);
    if (cc) { cc.x = 220 + f.w / 2 + 24; cc.y = 140; cc.vx = cc.vy = 0; }
  };
  for (let i = 0; i < 30 * 3; i++) { hold(); G.board.step(DT); }
  console.log('  숯을 물린 불의 벌이 배수      FIRE ×' + f.incomeMul.toFixed(1) +
    ' · COAL ×' + c.incomeMul.toFixed(1));

  /* 숯을 하나 더 붙여도 불이 아홉 배를 벌지는 않는다 */
  const c2 = G.board.makeWord('COAL', 220, 140 - 46);
  for (let i = 0; i < 30 * 2; i++) {
    hold(); c2.x = 220; c2.y = 140 - 46; c2.vx = c2.vy = 0;
    G.board.step(DT);
  }
  console.log('  숯을 둘 붙여도 불은          ×' + f.incomeMul.toFixed(1) +
    ' (곱절로 겹치면 ×' + (C.COAL_PAIR * C.COAL_PAIR) + ')');
  G.board.remove(c2);

  let sec = 0;
  for (let i = 0; i < 30 * 60 * 20; i++) {
    hold(); G.board.step(DT);
    if (!G.board.get(c.id)) { sec = i * DT; break; }
  }
  console.log('  숯이 불 곁에서 버틴 시간      ' +
    (sec ? (sec / 60).toFixed(0) + '분 뒤 재가 되었다' : '20분이 지나도 그대로 (문제)'));
}

/* 같은 단어를 여럿 세워도 겹쳐 걸리지 않는다 */
{
  const rows = [];
  for (const [word, read] of [['SUN', e => e.payMul], ['MOON', e => e.incomeMul]]) {
    const got = [];
    for (const n of [1, 3]) {
      clear();
      const t = G.board.makeWord('CRATE', 220, 140);
      const put = [];
      for (let i = 0; i < n; i++) put.push(G.board.makeWord(word, 220, 140 - 44 - i * 4));
      for (let i = 0; i < 30 * 2; i++) {
        t.x = 220; t.y = 140; t.vx = t.vy = 0;
        put.forEach((p, k) => { p.x = 220; p.y = 140 - 44 - k * 4; p.vx = p.vy = 0; });
        G.board.step(DT);
      }
      got.push(read(t).toFixed(2));
    }
    rows.push(word + ' 하나 ×' + got[0] + ' · 셋 ×' + got[1]);
  }
  console.log('  같은 단어를 겹쳐 세우면       ' + rows.join(' · '));

  /* 겹치지 않는 것은 "같은 단어끼리" 다. 종류가 다르면 그대로 곱해져야 한다 —
     숯을 물린 불(+200%)에 달을 세우면 +275% 까지 간다 */
  const read = () => {
    clear();
    const f = G.board.makeWord('FIRE', 220, 140);
    const c = G.board.makeWord('COAL', 220 + f.w / 2 + 24, 140);
    const m = G.board.makeWord('MOON', 220, 140 - 46);
    for (let i = 0; i < 30 * 2; i++) {
      f.x = 220; f.y = 140; f.vx = f.vy = 0;
      c.x = 220 + f.w / 2 + 24; c.y = 140; c.vx = c.vy = 0;
      m.x = 220; m.y = 140 - 46; m.vx = m.vy = 0;
      G.board.step(DT);
    }
    return f;
  };
  const f = read();
  console.log('  숯 물린 불에 달까지 세우면    ×' + f.incomeMul.toFixed(2) +
    ' (숯 ×' + C.COAL_PAIR + ' × 달 ×' + C.MOON_INCOME + ' = ×' +
    (C.COAL_PAIR * C.MOON_INCOME).toFixed(2) + ')');
}

/* 은행 — 떼어 두었다가 한 주기마다 이자를 얹어 돌려준다 */
{
  clear();
  G.state.vault = 0; G.state.vaultT = 0;
  G.board.makeWord('BANK', 220, 140);
  G.state.money = 0;
  G.board.earn(1000);
  const kept = G.state.money, saved = G.state.vault;
  G.state.vaultT = C.BANK_PERIOD - DT;
  G.board.step(DT);
  console.log('  1000w 가 들어오면            손에 ' + Math.round(kept) +
    'w · 금고에 ' + Math.round(saved) + 'w → ' + Math.round(C.BANK_PERIOD / 60) + '분 뒤 ' +
    Math.round(G.state.money - kept) + 'w');

  G.state.vault = C.BANK_VAULT_MAX;
  G.state.money = 0;
  G.board.earn(1000);
  console.log('  금고가 다 차면               떼지 않는다 · 손에 ' +
    Math.round(G.state.money) + 'w');
  G.state.vault = 0; G.state.vaultT = 0;
}

/* 정원이 찬 보드에서도 단어를 분해할 수 있다 — 고칠 길이 막히면 안 된다 */
{
  clear();
  const w = G.board.makeWord('CRATE', 220, 140);
  while (G.board.count() < G.maxEntities()) G.board.spawnLetter('Q');
  const before = G.board.count();
  const ok = G.board.explode(w);
  console.log('  가득 찬 보드에서 분해하면     ' + (ok ? '흩어진다' : '막혀 있다 (문제)') +
    ' · ' + before + ' → ' + G.board.count() + '/' + G.maxEntities() + '개');
  clear();
  const w2 = G.board.makeWord('CRATE', 220, 140);
  G.board.explode(w2);
  console.log('  자리가 있으면                흩어진다 · 낱글자 ' +
    G.board.all().filter(e => e.type === 'letter').length + '개');
}

/* 정원은 낱글자를 센다 — 뜻이 있는 단어가 되었을 때에만 자리가 돌아온다.
   덩어리 하나를 한 칸으로 세면 아무 글자나 붙여 세우는 것이 곧 확장이 된다 */
{
  clear();
  for (const ch of 'CRATE') G.board.spawnLetter(ch);
  const loose = G.board.count();
  clear();
  G.board.add(new G.Entity('cluster', 'CRTE', 220, 140));   // 뜻 없는 덩어리
  const lump = G.board.count();
  clear();
  G.board.makeWord('CRATE', 220, 140);                      // 뜻이 있는 단어
  console.log('  다섯 글자가 먹는 자리         낱낱이 ' + loose + '칸 · 뜻 없이 붙이면 ' +
    lump + '칸 · 단어가 되면 ' + G.board.count() + '칸');
}

/* 다 탄 단어는 글자까지 사라진다 */
{
  clear();
  const t = G.board.makeWord('TREE', 220, 140);
  t.ignite();
  for (let i = 0; i < 30 * (C.BURN_LIFE + 4); i++) G.board.step(DT);
  console.log('  다 타고 나면                 남은 것 ' + G.board.count() +
    '개 (글자로 흩어지면 4개)');
}

/* 강화 — 확률과 배수가 적힌 대로 도는가 */
{
  clear();
  const pad = G.board.makeWord('FORGE', 220, 60);
  const runs = 400;
  const line = [];
  for (let lv = 0; lv < C.UP_ODDS.length; lv++) {
    let ok = 0;
    for (let i = 0; i < runs; i++) {
      const w = G.board.makeWord('CRATE', 220, 150);
      w.data.up = lv;
      if (G.behaviors.runUpgrade(pad, w)) ok++;
      if (G.board.get(w.id)) G.board.remove(w);
    }
    line.push((lv + 1) + '강 ' + Math.round(ok / runs * 100) + '%' +
      '(적힌 값 ' + Math.round(C.UP_ODDS[lv] * 100) + '%)');
  }
  console.log('  강화 성공률 400번씩            ' + line.join(' · '));

  clear();
  const w2 = G.board.makeWord('CRATE', 220, 150);
  const base = w2.income();
  const muls = [];
  for (let lv = 0; lv < C.UP_MUL.length; lv++) {
    w2.data.up = lv + 1;
    muls.push((lv + 1) + '강 ' + w2.income().toFixed(0) + 'w');
  }
  console.log('  CRATE 20초 벌이               그냥 ' + base.toFixed(0) + 'w · ' +
    muls.join(' · '));
  console.log('  능력 단어에 걸 수 있는가       ' +
    (G.behaviors.upgradable(G.board.makeWord('FIRE', 300, 200)) ? '걸린다 (문제)' : '막혀 있다'));
}

/* 정원이 찬 보드에서 낱글자를 팔면 그 자리가 바로 도로 채워지지는 않는가 */
{
  clear();
  G.state.spawnLevel = 0;
  while (G.board.count() < G.maxEntities()) G.board.spawnLetter('Q');
  G.state.spawnTimer = 0;
  G.game.stepSpawn(DT);                       // 정원이 차 있으니 게이지는 멈춰 있다
  const before = G.board.count();
  G.board.remove(G.board.all()[0]);
  G.game.soldOne();
  G.game.stepSpawn(DT);
  console.log('  가득 찬 보드에서 하나를 팔면   ' +
    (G.board.count() < before ? '자리가 남는다 (다음 글자까지 ' +
      G.state.spawnTimer.toFixed(0) + '초)' : '그 프레임에 도로 찬다 (문제)'));
  G.state.spawnTimer = 0;
}

/* 생쥐가 떨어진 힌트권을 대신 주워 온다 */
{
  for (const withMouse of [false, true]) {
    clear();
    G.state.tickets = 0;
    G.tokens.spawnTicket(120, 140);
    if (withMouse) G.board.makeWord('MOUSE', 380, 240);
    for (let i = 0; i < 30 * 12; i++) G.board.step(DT);
    console.log('  떨어진 힌트권을 12초 두면    ' +
      (withMouse ? 'MOUSE 가 있을 때 ' : '아무도 없을 때 ') +
      (G.state.tickets || 0) + '장 손에 들어왔다');
  }
}

/* 자석은 쥐고 있을 때만, 그것도 모음만 끌어온다 */
{
  const pulled = [];
  for (const held of [false, true]) {
    clear();
    const m = G.board.makeWord('MAGNET', 220, 140);
    m.dragging = held;
    const a = G.board.spawnLetter('A', 220, 200);
    const k = G.board.spawnLetter('K', 220, 80);
    const D = G.util.dist;
    const d0 = [D(m.x, m.y, a.x, a.y), D(m.x, m.y, k.x, k.y)];
    for (let i = 0; i < 30 * 6; i++) {
      m.x = 220; m.y = 140; m.vx = m.vy = 0;
      G.board.step(DT);
    }
    pulled.push([d0[0] - D(m.x, m.y, a.x, a.y), d0[1] - D(m.x, m.y, k.x, k.y)]);
  }
  console.log('  자석이 6초 동안 당겨 온 거리   내려놓으면 모음 ' +
    pulled[0][0].toFixed(0) + 'px · 자음 ' + pulled[0][1].toFixed(0) + 'px');
  console.log('                               쥐고 있으면 모음 ' +
    pulled[1][0].toFixed(0) + 'px · 자음 ' + pulled[1][1].toFixed(0) + 'px');
}

/* 망치는 보석값을 다시 매긴다 — 그리고 한 보석에 한 번뿐이다 */
{
  clear();
  const hm = G.board.makeWord('HAMMER', 220, 140);
  const g = G.board.makeWord('GOLD', 220, 190);
  const was = g.income();
  const hold = (secs) => {
    for (let i = 0; i < 30 * secs; i++) {
      hm.x = 220; hm.y = 140; hm.vx = hm.vy = 0;
      g.x = 220; g.y = 190; g.vx = g.vy = 0;
      G.board.step(DT);
    }
  };
  hold(4);
  const first = g.data.worth;
  hold(20);
  console.log('  HAMMER 곁에 GOLD 를 두면       값 ×' + first.toFixed(2) +
    ' · 벌이 ' + was + 'w → ' + g.income().toFixed(1) + 'w' +
    ' · 20초 더 두어도 ×' + g.data.worth.toFixed(2) + ' (한 번뿐)');
  console.log('  그 보석을 SHOP 에 넘기면       ' +
    Math.round(C.GEM_PRICE * g.text.length) + 'w → ' +
    Math.round(C.GEM_PRICE * g.text.length * g.data.worth) + 'w');
}

/* 시간과 시계는 다음 글자를 앞당긴다 */
{
  clear();
  const base = G.game.spawnInterval();
  G.game.sellTime();
  const sold = G.game.spawnInterval();
  const ck = G.board.makeWord('CLOCK', 220, 140);
  const withClock = G.game.spawnInterval();
  G.board.remove(ck);
  const off = G.game.spawnInterval();
  G.state.timeCut = 0;
  console.log('\n  생성 간격  기본 ' + base + '초 · TIME 을 하나 팔면 ' + sold.toFixed(1) +
    '초 · CLOCK 을 세우면 ' + withClock.toFixed(1) + '초 · 시계를 치우면 ' + off.toFixed(1) + '초');
  console.log('  아무리 줄여도 바닥은 ' + C.SPAWN_FLOOR + '초');
}

/* 집은 자리를 늘린다 — 타서 무너지면 늘어난 자리도 사라진다 */
{
  clear();
  const room0 = G.maxEntities();
  const h = G.board.makeWord('HOUSE', 220, 140);
  const room1 = G.maxEntities();
  h.ignite();
  const room2 = G.maxEntities();
  console.log('  보드 정원  집이 없으면 ' + room0 + '개 · 한 채 지으면 ' + room1 +
    '개 · 그 집에 불이 붙으면 ' + room2 + '개');
}

/* 유령은 보고 있을 때는 아무 일도 하지 않는다 */
{
  clear();
  const w = G.board.makeWord('MEAT', 220, 140);
  G.board.makeWord('GHOST', 220, 140);
  for (let i = 0; i < 30 * 5; i++) G.board.step(DT);
  console.log('  GHOST 를 겹쳐 세워도 벌이 배수 ×' + w.incomeMul.toFixed(2) +
    ' (자리를 비운 동안의 몫 ' + Math.round(C.OFFLINE_RATE * 100) + '% → ' +
    Math.round((C.OFFLINE_RATE + C.GHOST_OFFLINE) * 100) + '%)');
}

/* 숯을 문 불은 더 빨리 옮아붙는다 */
{
  const took = [];
  for (const withCoal of [false, true]) {
    clear();
    const t = G.board.makeWord('TREE', 220, 140);
    const f = G.board.makeWord('FIRE', 220 + t.w / 2 + 24, 140);
    if (withCoal) G.board.makeWord('COAL', f.x, 140 - 44);
    let sec = 0;
    for (let i = 0; i < 30 * 90; i++) {
      t.x = 220; t.y = 140; t.vx = t.vy = 0;
      f.x = 220 + t.w / 2 + 24; f.y = 140; f.vx = f.vy = 0;
      G.board.step(DT);
      if (t.burning) { sec = i * DT; break; }
    }
    took.push(sec ? sec.toFixed(0) + '초' : '90초 넘게');
  }
  console.log('  TREE 에 불이 옮아붙기까지     그냥 ' + took[0] +
    ' · COAL 을 물린 불이면 ' + took[1]);
}

/* 물이 불을 끈다 — 이제 이 일을 하는 단어는 하나뿐이다 */
{
  clear();
  const t = G.board.makeWord('TREE', 400, 300); t.ignite();
  const w = G.board.makeWord('WATER', 400 + t.w / 2 + 26, 300);
  let out = 0;
  for (let i = 0; i < 30 * 20; i++) {
    t.x = 400; t.y = 300; w.x = 400 + t.w / 2 + 26; w.y = 300;
    G.board.step(DT);
    if (!t.burning) { out = i * DT; break; }
  }
  console.log('  WATER 가 타는 TREE 를        ' +
    (out ? out.toFixed(0) + '초 만에 껐다' : '20초 동안 못 껐다'));

  /* 불을 끄는 단어가 정말 WATER 하나뿐인가 */
  const putters = [];
  for (const id of G.WORDS.map(w2 => w2.id)) {
    clear();
    const tt = G.board.makeWord('TREE', 400, 300); tt.ignite();
    const o = G.board.makeWord(id, 400 + tt.w / 2 + 26, 300);
    for (let i = 0; i < 30 * 20; i++) {
      tt.x = 400; tt.y = 300; o.x = 400 + tt.w / 2 + 26; o.y = 300;
      G.board.step(DT);
    }
    if (!tt.burning && G.board.get(tt.id)) putters.push(id);
  }
  console.log('  20초 안에 불을 끄는 단어      ' + (putters.join(' ') || '없음'));
}

/* 2.65 ─ 짝을 지으면 그 자리를 지키는가 --------------------------------
   붙여 놓아도 저 혼자 통통 뛰어 달아나면 짝을 지은 보람이 없다.
   90초를 그냥 굴려 놓고, 처음 붙여 둔 자리에서 얼마나 밀려났는지 잰다.
   (짝 없이 혼자 둔 것과 견주어야 "원래 안 움직이는 단어" 와 구별된다) */
console.log('\n\n짝을 붙여 놓으면 그 자리를 지키는가 (90초)\n');
console.log('  짝               혼자 둘 때   짝과 있을 때');
for (const [a, b] of [['BEE', 'TREE'], ['MEAT', 'FIRE'], ['FISH', 'WATER'],
['KEY', 'BOX'], ['GOLD', 'SHOP'], ['CAT', 'BOX'], ['WATER', 'SEED'],
['FIRE', 'COAL'], ['COAL', 'FIRE']]) {
  const drift = (mate) => {
    clear();
    const e = G.board.makeWord(a, 200, 140);
    if (mate) G.board.makeWord(mate, 200 + e.w / 2 + 30, 140);
    const x0 = e.x, y0 = e.y;
    for (let i = 0; i < 30 * 90; i++) G.board.step(DT);
    const live = G.board.get(e.id);
    return live ? G.util.dist(x0, y0, live.x, live.y) : -1;
  };
  const alone = drift(null), paired = drift(b);
  /* 없어진 것은 달아난 것이 아니라 제 일을 마친 것이다 —
     고기는 다 익고 나서 탔고, 금덩이는 가게에 팔렸다 */
  const say = (v) => v < 0 ? '제 일을 마쳤다' : (v < 6 ? '가만히' : Math.round(v) + 'px 이동');
  console.log('  ' + (a + ' + ' + b).padEnd(17) + say(alone).padEnd(13) + say(paired));
}

/* 2.66 ─ 벽은 정말 막는가 ----------------------------------------------
   위아래로 이어 붙여 보드를 반으로 자르는 담을 세우고, 한쪽에 둔 BIRD 가
   5분 동안 한 번이라도 반대쪽에 있었는지 본다 */
{
  const b = G.board.size(), mid = b.w / 2;
  const run = (fence) => {
    clear();
    if (fence) {
      const probe = G.board.makeWord('ROCK', mid, 20), h = probe.h;
      G.board.remove(probe);
      for (let y = h / 2; y < b.h + h; y += h - 2) G.board.makeWord('ROCK', mid, y);
    }
    const bird = G.board.makeWord('BIRD', mid - 90, b.h / 2);
    let over = 0;
    for (let i = 0; i < 30 * 300; i++) { G.board.step(DT); if (bird.x > mid) over++; }
    return over;
  };
  console.log('\n\n벽으로 보드를 반으로 자르고 BIRD 를 5분 굴리면\n');
  console.log('  담을 세우면   반대쪽에 있던 프레임 ' + run(true) + ' (0 이어야 벽이다)');
  console.log('  담이 없으면   반대쪽에 있던 프레임 ' + run(false));
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
  for (const n of [0, 1, 2, 3]) {
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
  console.log('  ' + G.WORDS.length + '개를 전부 힌트로만        ' + all.toLocaleString() + 'w' +
    '  (업그레이드 전부 ' + up.toLocaleString() + 'w)');

  console.log('\n  3단계에서 드러나는 철자');
  console.log('    ' + ['SUN', 'FIRE', 'DIAMOND'].map(id =>
    id + ' → ' + [...id].map((c, i) => i < G.hintReveal(id.length) ? c : '?').join('')).join(' · '));
}

/* 3.7 ─ 능력 단어가 보통 단어보다 얼마나 더 버는가 ---------------------- */
console.log('\n\n능력 단어의 벌이 (보통 단어 = 1.0)\n');

/* 능력 단어를 한 판에 다 깔고 2분 굴린 뒤, 같은 길이의 보통 단어와 견준다 */
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
  return G.board.get(t.id) ? [t.incomeMul, t.gearMul] : [0, 1];
}
console.log('    (벌이 배수 상한 없음 — 자리마다 그대로 곱한다)');
for (const [name, target, mates] of [
  ['보석 하나에 다 붙이기', 'DIAMOND', ['MOON', 'LUCK']],
  ['익힌 고기에 다 붙이기', 'MEAT', ['FIRE', 'COAL', 'MOON', 'LUCK']],
  ['금덩이에 다 붙이기', 'GOLD', ['MOON', 'LUCK', 'SUN']]
]) {
  const [raw, gear] = stack(target, mates);
  console.log('    ' + name.padEnd(22) + '실제 배수 ×' + (raw * gear).toFixed(1));
}

/* 사건으로 들어오는 돈.
   기준은 "지금까지 번 돈" 이 아니라 지금 이 보드의 20초 수입(payRate)이다.
   가끔 터지는 것이라 눈에 잘 안 띄는데, 확률을 곱해 20초치로 펴 놓고 보면
   보통 단어 몇 개 몫인지가 드러난다 — 여기가 부풀면 보드가 사건판이 된다 */
console.log('\n  사건으로 들어오는 돈 (확률을 곱해 20초치로 편 값)');
console.log('    단어    한 번에            20초에 평균   보통 4글자(8w) 대비');
for (const [id, mul, flat, share] of [
  ['BEE', C.EVENT_CUT, C.EVENT_FLAT, 1],
  ['DOG', C.EVENT_CUT, C.EVENT_FLAT, 1 - C.DOG_LETTER],
  ['SHOP', C.COIN_VALUE, C.COIN_FLAT, 1]
]) {
  const p = G.WORDS.find(w => w.id === id).actChance;
  for (const [when, rate] of [['작은 보드', 40], ['다 키운 보드', 460]]) {
    const one = mul * rate + flat, per = p * share * one;
    console.log('    ' + (when === '작은 보드' ? id : '').padEnd(8) +
      when.padEnd(8) + Math.round(one) + 'w'.padEnd(6) +
      String(Math.round(per) + 'w').padStart(10) + '   ×' + (per / 8).toFixed(1));
  }
}

/* 4 ─ 가게에 보석을 파는 값이 적당한가 ---------------------------------- */
console.log('\n\n가게에 보석 팔기\n');
console.log('  보석       파는 값        보드 20초 수입 대비');
for (const id of ['GOLD', 'RUBY', 'DIAMOND', 'EMERALD']) {
  clear();
  const s = G.board.makeWord('SHOP', 400, 300);
  const g = G.board.makeWord(id, 400 + s.w / 2 + 30, 300);
  /* 벌이가 어느 정도 오른 보드를 흉내낸다 */
  for (let i = 0; i < 12; i++) G.board.makeWord('TREE', 60 + (i % 10) * 95, 520);
  G.board.step(DT);
  const rate = G.board.payRate();
  const before = G.state.money;
  for (let i = 0; i < 30 * 12; i++) {
    s.x = 400; s.y = 300; s.vx = s.vy = 0;
    if (G.board.get(g.id)) { g.x = 400 + s.w / 2 + 30; g.y = 300; g.vx = g.vy = 0; }
    G.board.step(DT);
  }
  const got = G.state.money - before;
  console.log('  ' + id.padEnd(10) + (got.toFixed(0) + 'w').padStart(9) +
    (rate > 0 ? ('   20초 수입의 ' + (got / rate).toFixed(1) + '배') : ''));
}
console.log('  (목돈은 보석을 갖다 놓아야만 나온다. 가게가 흘리는 잔돈은 20초마다 ' +
  Math.round(G.defFor('SHOP').actChance * 100) + '% 로, 한 닢이 20초 수입의 ' +
  C.COIN_VALUE + '배뿐이고 주워야 들어온다)');

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
