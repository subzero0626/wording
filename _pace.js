/* 진행 속도 계측 — 만렙까지 실제로 몇 시간이 걸리는가.
   수입은 거의 평평한데(전 구간 2~3배) 값만 지수로 오르는 구조라,
   값을 손볼 때마다 여기서 다시 재 보지 않으면 며칠짜리가 하루짜리가 된다. */
'use strict';
const { G, C, DT, clear } = require('./_head.js');

/* 사전에서 그 길이의 단어를 하나 집는다 (판마다 같은 것이 나오게 씨앗 고정) */
let seed = 12345;
function pick(len) {
  const raw = G.DICT_RAW[len];
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  const n = (raw.length / len) | 0;
  const i = seed % n;
  return raw.slice(i * len, i * len + len);
}

/** 확장 단계 L 에서 정원을 채운 보드가 20초에 버는 총액 */
function rateAt(L, mix) {
  G.state.expandLevel = L;
  G.board.layout();
  clear();
  const cap = G.maxEntities(), b = G.board.size();
  const ids = G.WORDS.map(w => w.id);
  const cols = Math.ceil(Math.sqrt(cap * b.w / b.h)), rows = Math.ceil(cap / cols);
  for (let k = 0; k < cap; k++) {
    const x = (b.w / cols) * ((k % cols) + .5);
    const y = (b.h / rows) * (((k / cols) | 0) + .5);
    if (k % mix.every === 0) G.board.makeWord(ids[(k * 7) % ids.length], x, y);
    else G.board.makeWord(pick(mix.len), x, y);
  }
  for (let i = 0; i < 30 * 60; i++) G.board.step(DT);
  return G.board.payRate();
}

const hm = h => (h < 1 ? (h * 60).toFixed(0) + '분' : h.toFixed(1) + '시간');

for (const mix of [
  { name: '느슨하게 (4글자 위주 · 능력 단어 1/4)', len: 4, every: 4 },
  { name: '잘 굴릴 때 (5글자 위주 · 능력 단어 1/3)', len: 5, every: 3 }
]) {
  console.log('\n' + mix.name);
  console.log('  단계   정원      20초 수입        시간당');
  const rate = [];
  for (let L = 0; L < C.EXPAND_SCALE.length; L++) {
    const r = rateAt(L, mix);
    rate.push(r);
    console.log('  ' + String(L).padStart(4) + '   ' + String(G.maxEntities()).padStart(3) + '개  ' +
      (Math.round(r) + 'w').padStart(10) + '   ' +
      (Math.round(r * 180).toLocaleString() + 'w').padStart(12));
  }

  /* 싼 것부터 사는 것으로 잡고 만렙까지 걸리는 시간을 더한다.
     수입은 그때 올라 있는 확장 단계의 값을 쓴다 — 생성 단축은 정원이 찬 뒤로는
     수입을 거의 늘리지 못한다 (보드가 이미 꽉 차 있으므로). */
  let hours = 0, L = 0, Sp = 0, spent = 0;
  const rows = [];
  while (L < C.EXPAND_COSTS.length || Sp < C.SPAWN_COSTS.length) {
    const ec = L < C.EXPAND_COSTS.length ? C.EXPAND_COSTS[L] : Infinity;
    const sc = Sp < C.SPAWN_COSTS.length ? C.SPAWN_COSTS[Sp] : Infinity;
    const expand = ec <= sc, cost = expand ? ec : sc;
    const h = cost / (rate[L] * 180);
    hours += h; spent += cost;
    rows.push([expand ? '확장 ' + (L + 1) : '단축 ' + C.SPAWN_STEPS[Sp + 1] + '초', cost, h, hours]);
    if (expand) L++; else Sp++;
  }
  console.log('\n  산 것           값        걸린 시간   누적');
  for (const [n, c, h, t] of rows) {
    console.log('  ' + n.padEnd(12) + (c.toLocaleString() + 'w').padStart(12) +
      '  ' + hm(h).padStart(9) + '   ' + hm(t).padStart(9));
  }
  console.log('  총 ' + spent.toLocaleString() + 'w · ' + hours.toFixed(1) + '시간' +
    ' (하루 3시간이면 ' + (hours / 3).toFixed(0) + '일)');
}
