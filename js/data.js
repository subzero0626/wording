/* ==========================================================================
   data.js — 밸런스 상수 + 능력 단어 40개 정의
   --------------------------------------------------------------------------
   사전(dict.js)에 있는 6만여 개 단어는 전부 만들 수 있고 재화를 번다.
   그중 아래 40개만 특별한 "능력"을 가진다.

   새 능력 단어를 추가하려면 WORDS 에 항목 하나를 추가하면 된다.
   { id, kind, desc, hint, color, anim, fx, pay, motion, tags,
     flammable, heavy, ghost, act, actEvery, bonds }

   pay      : 옛 재화 배수. 지금은 쓰지 않는다 — 능력 단어도 보통 단어와 똑같이
              글자 수로만 벌이가 정해진다. 값은 되살릴 때를 위해 남겨 두었다.
   act      : behaviors.js 의 ACTIONS[key] 에 대응하는 주기 행동
   bonds    : "가까이 + 일정 시간" 유지되어야 발동하는 상호작용
              { with, range, time, key }  →  behaviors.js 의 BONDS[key]
              with 는 단어 id 배열 또는 '#tag' 또는 '@letter'
   ========================================================================== */
var G = window.G || (window.G = {});

/* 테스트용 스위치 — 켜면 도감이 전부 열린 것처럼 보인다.
   보여주기만 하는 것이라 실제 발견 기록에는 손대지 않는다. false 로 되돌리면
   원래 진행 상황이 그대로 돌아온다. */
G.TEST_UNLOCK_ALL = false;

G.C = {
  /* --- 오브젝트 크기 근사식 (실제 값은 DOM 에서 측정한다) --- */
  LETTER_CHAR_W: 21, LETTER_PAD: 10, LETTER_H: 44,
  WORD_CHAR_W: 18, WORD_PAD: 10, WORD_H: 40,
  BOARD_MARGIN: 26,

  /* --- 재화 --- */
  PAY_PERIOD: 20,        // 몇 초마다 한 번 벌어들이는가
  PAY_BASE: 1,           // 낱글자 한 개가 한 번에 버는 양
  PAY_WORD_BASE: 4,      // 3글자 단어의 기본값
  PAY_GROWTH: 2,         // 글자가 하나 늘 때마다 곱해지는 값
  MIN_WORD_LEN: 3,       // 이보다 짧으면 단어가 되지 않는다

  /* --- 글자 생성 ---
     초반은 싸게 시작해서 뒤로 갈수록 배율이 커진다 (×2.1 → ×2.45) */
  SPAWN_STEPS: [45, 41, 37, 34, 31, 28, 25, 23, 21, 19, 18],
  SPAWN_COSTS: [80, 170, 360, 780, 1700, 3800, 8600, 20000, 47000, 115000],

  /* --- 보드 확장 (available 영역 대비 비율) --- */
  EXPAND_SCALE: [0.40, 0.46, 0.53, 0.60, 0.68, 0.77, 0.87],
  EXPAND_COSTS: [100, 300, 950, 3200, 12000, 46000],

  /* --- 도감 힌트 (1단계: 첫 글자+분류, 2단계: 짧은 설명) ---
     아래는 첫 힌트 값이고, 많이 살수록 HINT_STEP 만큼 비싸진다 */
  HINT_COSTS: [100, 500],
  HINT_STEP: 1.10,
  HINT_STEP_CAP: 20,

  OFFLINE_CAP: 7200,     // 오프라인 수입 인정 최대 초 (2시간)
  OFFLINE_RATE: 0.1,     // 그동안 벌었을 액수의 이 비율만 준다
  IDLE_AFTER: 300,       // 이만큼 손대지 않으면 켜 둔 채로도 방치로 넘어간다 (5분)

  /* --- 움직임 --- */
  LETTER_JUMP: [15, 30],
  LETTER_JUMP_RANGE: 78,
  JUMP_DUR: 0.42,

  /* --- 조합 --- */
  SNAP_DIST: 52,         // 상대 가장자리에서 이만큼 떨어져 있어도 붙는다
  SNAP_DY: 40,           // 세로 정렬 허용 거리
  SNAP_PULL: 0.62,       // 스냅 자리로 끌려가는 정도 (0~1)
  MAX_CLUSTER: 8,
  WORD_HOLD: 1.0,        // 이미 완성된 단어에 붙이려면 이만큼 대고 있어야 한다(초)

  /* --- 판매 (보드 밖으로 끌어내 놓기) --- */
  VOWEL_RATE: 0.06,      // 모음 한 개당 생성 확률
  SELL_MARGIN: 22,       // 이만큼 밖으로 나가면 판매 대상
  EDGE_RESIST: 0.34,     // 경계를 넘을 때 따라오는 비율 (낮을수록 뻑뻑하다)
  EDGE_MAX: 96,          // 경계 밖으로 끌려나올 수 있는 최대 거리
  SELL_COOLDOWN_CUT: 0.5,// 판매하면 남은 생성 쿨다운이 이 비율로 줄어든다

  START_LETTERS: 5,
  MAX_ENTITIES: 90
};

/**
 * 단어가 한 번에 버는 재화.
 * 3글자를 기본 4 로 두고, 글자가 하나 늘 때마다 2배.
 *   3글자 4 · 4글자 8 · 5글자 16 · 6글자 32 · 7글자 64 · 8글자 128
 * 능력 단어도 보통 단어와 똑같은 값을 받는다. 능력은 벌이가 아니라 행동으로 드러낸다.
 */
/**
 * 힌트 값. 처음 몇 개는 싸게 풀어 주지만, 도감을 힌트로만 밀어붙이면 가파르게 비싸진다.
 * 값은 지금까지 산 힌트 총 개수를 따라간다 — 후반에 남아도는 재화를 흡수하는 자리.
 */
G.hintCost = function (lv) {
  var bought = 0, h = G.state && G.state.hints;
  for (var k in h) bought += h[k];
  var step = Math.min(G.C.HINT_STEP_CAP, Math.pow(G.C.HINT_STEP, bought));
  return Math.round(G.C.HINT_COSTS[lv] * step);
};

G.wordValue = function (len, mult) {
  if (len < G.C.MIN_WORD_LEN) return 0;
  var v = G.C.PAY_WORD_BASE
    * Math.pow(G.C.PAY_GROWTH, len - G.C.MIN_WORD_LEN)
    * (mult === undefined ? 1 : mult);
  return Math.max(0, Math.round(v));
};

/* ==========================================================================
   능력 단어 40개
   ========================================================================== */
G.WORDS = [

  /* ---------- 자연 ---------- */
  {
    id: 'FIRE', kind: '자연', tags: ['hot'],
    desc: '가연성 단어 곁에 20초쯤 머무르면 불을 붙인다. WATER 가 가까이 오면 힘을 잃는다.',
    hint: '뜨겁고 위험하다',
    color: { fg: '#c2410c', bd: '#f0b18a' },
    anim: 'shake', fx: 'ember', pay: 0.6,
    motion: { min: 8, max: 16, range: 84 },
    bonds: [{ with: '#burnable', range: 116, time: 20, key: 'ignite' }]
  },
  {
    id: 'WATER', kind: '자연', tags: ['wet'],
    desc: '주변에서 타고 있는 것을 꺼 준다. FIRE 옆에 5초 있으면 FIRE 를 잠시 약하게 만든다.',
    hint: '불을 끈다',
    color: { fg: '#1d6fa5', bd: '#9dc9e4' },
    anim: 'wave', fx: 'drop', pay: 1.0,
    motion: { min: 14, max: 26, range: 70 },
    bonds: [{ with: ['FIRE'], range: 108, time: 5, key: 'douse' }]
  },
  {
    id: 'ICE', kind: '자연', tags: ['cold', 'wet'],
    desc: '주변 물체를 얼려 점프를 줄인다. FIRE 곁에 15초 있으면 녹아서 WATER 가 된다.',
    hint: '차갑다',
    color: { fg: '#3a8fb0', bd: '#b6e0ee' },
    anim: 'pulse', fx: 'frost', pay: 1.2,
    motion: { min: 30, max: 52, range: 40 },
    bonds: [{ with: ['FIRE'], range: 104, time: 15, key: 'melt' }]
  },
  {
    id: 'WIND', kind: '자연', tags: [],
    desc: '가끔 한 방향으로 돌풍을 일으켜 주변 것들을 밀어낸다.',
    hint: '밀어낸다',
    color: { fg: '#6b7f8a', bd: '#c6d5db' },
    anim: 'float', fx: 'swirl', pay: 0.8,
    motion: { min: 9, max: 17, range: 130 },
    act: 'gust', actEvery: [14, 24]
  },
  {
    id: 'SUN', kind: '자연', tags: ['hot'],
    desc: '가만히 떠서 꾸준히 벌어들인다. 가까운 TREE 를 잘 자라게 하고 WATER 는 마르게 한다.',
    hint: '하늘에 뜬 것',
    color: { fg: '#b3760a', bd: '#f2d38a' },
    anim: 'pulse', fx: 'ray', pay: 3.0,
    motion: null
  },
  {
    id: 'RAIN', kind: '자연', tags: ['wet'],
    desc: '가끔 주변에 비를 뿌린다. 범위 안의 불을 끄고 TREE 를 자라게 한다.',
    hint: '하늘에서 내린다',
    color: { fg: '#4a6b96', bd: '#b3c6e0' },
    anim: 'wave', fx: 'rain', pay: 1.2,
    motion: { min: 16, max: 28, range: 86 },
    act: 'rain', actEvery: [18, 27]
  },
  {
    id: 'TREE', kind: '자연', tags: ['burnable', 'plant'],
    desc: '가끔 새로운 글자 하나를 떨어뜨린다. 불에 잘 탄다.',
    hint: '자란다',
    color: { fg: '#2f7a43', bd: '#a8d6b0' },
    anim: 'hop', fx: 'leaf', pay: 1.4,
    motion: { min: 40, max: 72, range: 30 },
    flammable: true,
    act: 'tree', actEvery: [32, 46]
  },
  {
    id: 'SEED', kind: '자연', tags: ['burnable', 'plant'],
    desc: '가만히 있다가 시간이 지나면 싹을 틔워 TREE 가 된다. 물이 가까우면 훨씬 빨리 자란다.',
    hint: '심으면 자란다',
    color: { fg: '#5f7a34', bd: '#c6daa4' },
    anim: 'pulse', fx: null, pay: 0.5,
    motion: null, flammable: true
  },
  {
    id: 'RIVER', kind: '장소', tags: ['wet'],
    desc: '가만히 흐른다. 주변의 불을 넉넉히 꺼 주고, FISH 가 살기에 가장 좋은 곳이며 TREE 를 잘 자라게 한다.',
    hint: '흐르는 물',
    color: { fg: '#2f6b8f', bd: '#a8cbe0' },
    anim: 'wave', fx: 'drop', pay: 1.4,
    motion: null, heavy: true
  },
  {
    id: 'STORM', kind: '자연', tags: ['wet'],
    desc: '몰아친다. 주변을 세게 밀어내면서 동시에 비를 뿌려 불을 끈다. WIND 와 RAIN 을 합친 것.',
    hint: '몰아친다',
    color: { fg: '#46526b', bd: '#b4bcd0' },
    anim: 'shake', fx: 'rain', pay: 1.6,
    motion: { min: 10, max: 18, range: 112 },
    act: 'storm', actEvery: [20, 32]
  },
  {
    id: 'MOON', kind: '자연', tags: [],
    desc: '주변을 밤처럼 잠재운다. 곁에 있는 것들은 뛰지 않고 조용히 더 많이 벌어들인다. SUN 이 가까우면 빛을 잃는다.',
    hint: '밤에 뜬다',
    color: { fg: '#5a5f86', bd: '#c3c7e2' },
    anim: 'float', fx: 'wisp', pay: 2.2,
    motion: null
  },
  {
    id: 'STAR', kind: '자연', tags: [],
    desc: '가만히 반짝인다. 가까운 LUCK 을 더 자주 일어나게 하고, 가끔 소원을 들어준다.',
    hint: '반짝이고 멀다',
    color: { fg: '#8a7a2e', bd: '#e6dca0' },
    anim: 'pulse', fx: 'sparkle', pay: 2.0,
    motion: null,
    act: 'star', actEvery: [30, 46]
  },

  /* ---------- 사물 / 장소 ---------- */
  {
    id: 'HOUSE', kind: '장소', tags: ['burnable', 'building'],
    desc: '거의 움직이지 않고 가장 꾸준히 돈을 번다. 불이 붙으면 수입이 멈추고, 오래 타면 무너져 글자로 흩어진다.',
    hint: '사람이 사는 곳',
    color: { fg: '#8a6134', bd: '#ddc7a3' },
    anim: 'still', fx: null, pay: 3.0,
    motion: { min: 55, max: 95, range: 22 },
    flammable: true, heavy: true
  },
  {
    id: 'ROCK', kind: '사물', tags: ['heavy'],
    desc: '절대 움직이지 않고 불에도 타지 않는다. 벽처럼 세워 위험한 단어를 갈라놓을 수 있다.',
    hint: '단단하다',
    color: { fg: '#5f5c57', bd: '#cbc7c0' },
    anim: 'still', fx: null, pay: 0.3,
    motion: null, heavy: true
  },
  {
    id: 'ROAD', kind: '장소', tags: [],
    desc: '가만히 깔려 있다. 가까이에 CAR 가 있으면 CAR 가 더 멀리 달리고 통행료를 벌어 온다.',
    hint: '차가 다니는 곳',
    color: { fg: '#55585c', bd: '#c4c7cc' },
    anim: 'still', fx: null, pay: 0.6,
    motion: null, heavy: true
  },
  {
    id: 'CAR', kind: '사물', tags: [],
    desc: '가끔 한 방향으로 달려가며 부딪힌 것들을 밀어낸다. ROAD 가 가까우면 더 멀리 달린다.',
    hint: '달린다',
    color: { fg: '#a33a3a', bd: '#e5adad' },
    anim: 'still', fx: null, pay: 1.8,
    motion: { min: 22, max: 40, range: 34 },
    act: 'car', actEvery: [9, 15]
  },
  {
    id: 'BOX', kind: '사물', tags: ['burnable'],
    desc: '주변에 떨어진 낱글자를 붙잡아 가지런히 정리하고, 붙잡힌 글자는 점프하지 않는다.',
    hint: '무언가 담는 것',
    color: { fg: '#8d6a3f', bd: '#dcc49a' },
    anim: 'still', fx: null, pay: 1.0,
    motion: null, heavy: true
  },
  {
    id: 'KEY', kind: '사물', tags: ['metal'],
    desc: 'BOX 옆에 5초 머무르면 상자를 열어 안에 쌓인 것을 꺼낸다.',
    hint: '무언가 여는 것',
    color: { fg: '#96762c', bd: '#ddcb97' },
    anim: 'still', fx: null, pay: 1.0,
    motion: { min: 20, max: 36, range: 64 },
    bonds: [{ with: ['BOX'], range: 92, time: 5, key: 'unlock' }]
  },
  {
    id: 'MAGNET', kind: '사물', tags: ['metal'],
    desc: '범위 안의 낱글자를 천천히 끌어당긴다. 글자를 한곳에 모을 때 쓴다.',
    hint: '끌어당긴다',
    color: { fg: '#9c3f4e', bd: '#e2a9b3' },
    anim: 'pulse', fx: 'field', pay: 0.8,
    motion: { min: 34, max: 56, range: 40 }
  },
  {
    id: 'BOOK', kind: '사물', tags: ['burnable'],
    desc: '조용히 읽히며, 가끔 도감의 아직 못 찾은 단어에 힌트를 하나 밝혀 준다.',
    hint: '읽는 것',
    color: { fg: '#4a5a86', bd: '#b8c2de' },
    anim: 'still', fx: null, pay: 1.2,
    motion: { min: 50, max: 80, range: 26 },
    flammable: true,
    act: 'book', actEvery: [55, 75]
  },
  {
    id: 'CLOCK', kind: '사물', tags: ['metal'],
    desc: '주변 단어들의 행동 주기와 벌이를 빠르게 만든다. TREE·BANK·SHOP 옆에 두면 좋다.',
    hint: '시간을 알린다',
    color: { fg: '#4d4b47', bd: '#cdc9c2' },
    anim: 'tick', fx: 'tickmark', pay: 1.0,
    motion: null
  },
  {
    id: 'TIME', kind: '개념', tags: [],
    desc: '주변의 위험이 쌓이는 속도를 늦춘다. 화재 같은 사고를 막아 주는 안전지대.',
    hint: '흘러가는 것',
    color: { fg: '#6a5a92', bd: '#c9bee2' },
    anim: 'float', fx: 'ripple', pay: 1.4,
    motion: { min: 45, max: 75, range: 30 }
  },
  {
    id: 'LAMP', kind: '사물', tags: ['metal'],
    desc: '주위를 밝힌다. 곁에 있는 단어들이 조금 더 벌고, GHOST 는 빛을 견디지 못해 멀리 달아난다.',
    hint: '어둠을 밝힌다',
    color: { fg: '#8a6a2c', bd: '#e0cb96' },
    anim: 'pulse', fx: 'ray', pay: 1.2,
    motion: null,
    bonds: [{ with: ['GHOST'], range: 118, time: 6, key: 'banish' }]
  },
  {
    id: 'NEST', kind: '장소', tags: ['burnable'],
    desc: 'BIRD 가 앉으면 자리를 잡고 얌전히 벌며, 가끔 EGG 를 하나 남긴다. 불에 잘 탄다.',
    hint: '새가 앉는 곳',
    color: { fg: '#8a6a45', bd: '#ddc8a6' },
    anim: 'still', fx: null, pay: 1.0,
    motion: null, heavy: true, flammable: true,
    act: 'nest', actEvery: [40, 58]
  },

  /* ---------- 동물 ---------- */
  {
    id: 'CAT', kind: '동물', tags: ['animal'],
    desc: '자주 통통 뛰어다니고, 착지하면서 근처 낱글자를 툭 밀어버린다. MILK 옆에서는 얌전해지고, MOUSE 를 보면 잡는다.',
    hint: '야옹',
    color: { fg: '#7c6a55', bd: '#d8cbb9' },
    anim: 'hop', fx: null, pay: 1.6,
    motion: { min: 5, max: 11, range: 118 },
    act: 'cat', actEvery: [6, 12],
    bonds: [
      { with: ['MILK'], range: 88, time: 6, key: 'purr' },
      { with: ['MOUSE'], range: 104, time: 4, key: 'hunt' }
    ]
  },
  {
    id: 'DOG', kind: '동물', tags: ['animal'],
    desc: '가끔 가까운 낱글자를 물고 다른 곳에 옮겨 놓는다. BONE 옆에서는 자리를 잡고 땅을 판다.',
    hint: '멍멍',
    color: { fg: '#8a6a3c', bd: '#dcc6a0' },
    anim: 'hop', fx: null, pay: 1.6,
    motion: { min: 7, max: 14, range: 104 },
    act: 'dog', actEvery: [11, 18],
    bonds: [{ with: ['BONE'], range: 88, time: 6, key: 'dig' }]
  },
  {
    id: 'BIRD', kind: '동물', tags: ['animal'],
    desc: '쉴 새 없이 날아다닌다. NEST 나 TREE 가 가까우면 자리를 잡고 얌전히 벌이를 한다. BUG 를 잡아먹는다.',
    hint: '난다',
    color: { fg: '#3c7f95', bd: '#a9d3de' },
    anim: 'float', fx: null, pay: 1.5,
    motion: { min: 4, max: 9, range: 150 },
    bonds: [{ with: ['BUG'], range: 104, time: 3, key: 'eat' }]
  },
  {
    id: 'FISH', kind: '동물', tags: ['animal'],
    desc: 'RIVER · WATER · RAIN 근처에서는 편안히 헤엄치며 잘 벌지만, 물이 없으면 파닥거리기만 한다.',
    hint: '헤엄친다',
    color: { fg: '#2b7f7a', bd: '#a5d8d4' },
    anim: 'wave', fx: null, pay: 0.7,
    motion: { min: 5, max: 10, range: 92 }
  },
  {
    id: 'BUG', kind: '동물', tags: ['animal'],
    desc: '가까운 TREE 를 갉아 성장을 막고 돈을 조금씩 훔친다. BIRD 가 보면 잡아먹힌다.',
    hint: '작고 성가시다',
    color: { fg: '#6b7a2c', bd: '#c6d59a' },
    anim: 'shake', fx: null, pay: 0,
    motion: { min: 6, max: 12, range: 70 },
    act: 'bug', actEvery: [4, 8]
  },
  {
    id: 'EGG', kind: '동물', tags: ['burnable'],
    desc: '가만히 있다가 시간이 충분히 지나면 깨어나 BIRD 가 된다.',
    hint: '깨어난다',
    color: { fg: '#9a8560', bd: '#e2d7bd' },
    anim: 'still', fx: null, pay: 0.4,
    motion: null
  },
  {
    id: 'MOUSE', kind: '동물', tags: ['animal'],
    desc: '쉴 새 없이 돌아다니며 돈을 조금씩 축낸다. CHEESE 옆에서는 얌전해져 오히려 잘 벌고, CAT 이 보면 잡힌다.',
    hint: '작고 빠르다',
    color: { fg: '#7a7269', bd: '#d6d0c7' },
    anim: 'shake', fx: null, pay: 0.6,
    motion: { min: 5, max: 10, range: 112 },
    act: 'mouse', actEvery: [7, 13],
    bonds: [{ with: ['CHEESE'], range: 92, time: 10, key: 'nibble' }]
  },
  {
    id: 'BEE', kind: '동물', tags: ['animal'],
    desc: 'TREE 나 SEED 가 가까우면 꿀을 모아 훨씬 잘 번다. 가끔 나무를 수분시켜 글자를 떨어뜨리게 한다.',
    hint: '윙윙거린다',
    color: { fg: '#8a6a12', bd: '#e6cf86' },
    anim: 'shake', fx: null, pay: 0.8,
    motion: { min: 4, max: 9, range: 124 },
    act: 'bee', actEvery: [16, 26],
    bonds: [{ with: ['TREE'], range: 100, time: 12, key: 'pollen' }]
  },

  /* ---------- 먹이 / 경제 ---------- */
  {
    id: 'MILK', kind: '사물', tags: [],
    desc: 'CAT 을 얌전하게 만든다. 곁에 있는 동안 고양이가 잘 벌어 온다.',
    hint: '하얗고 마신다',
    color: { fg: '#7d7a72', bd: '#dcd8cf' },
    anim: 'still', fx: null, pay: 0.8,
    motion: null
  },
  {
    id: 'BONE', kind: '사물', tags: [],
    desc: 'DOG 을 붙잡아 둔다. 개가 자리를 잡으면 가끔 땅에서 무언가를 파낸다.',
    hint: '개가 좋아한다',
    color: { fg: '#8b857a', bd: '#dcd6c9' },
    anim: 'still', fx: null, pay: 0.6,
    motion: null
  },
  {
    id: 'CHEESE', kind: '사물', tags: [],
    desc: 'MOUSE 를 천천히 끌어당겨 붙잡아 둔다. 생쥐가 오래 갉으면 그 값을 챙길 수 있다.',
    hint: '생쥐가 좋아한다',
    color: { fg: '#a08427', bd: '#ecd894' },
    anim: 'still', fx: null, pay: 0.9,
    motion: null
  },
  {
    id: 'GOLD', kind: '경제', tags: ['metal'],
    desc: '가만히 있어도 많이 번다. BANK 가 가까우면 더 값이 오른다.',
    hint: '반짝이고 비싸다',
    color: { fg: '#a07a12', bd: '#e8cf80' },
    anim: 'pulse', fx: 'sparkle', pay: 4.0,
    motion: { min: 26, max: 48, range: 42 }
  },
  {
    id: 'BANK', kind: '경제', tags: ['building'],
    desc: '보드에서 생기는 수입의 일부를 금고에 모아 두었다가, 가끔 이자를 얹어 한꺼번에 지급한다.',
    hint: '돈을 맡기는 곳',
    color: { fg: '#2f6b52', bd: '#a6d3bd' },
    anim: 'still', fx: null, pay: 1.2,
    motion: null, heavy: true,
    act: 'bank', actEvery: [42, 42]
  },
  {
    id: 'SHOP', kind: '경제', tags: ['building', 'burnable'],
    desc: '가끔 특가 동전을 내놓는다. 사라지기 전에 눌러서 챙겨야 한다.',
    hint: '물건을 파는 곳',
    color: { fg: '#8a4a86', bd: '#dcb4da' },
    anim: 'still', fx: null, pay: 1.4,
    motion: { min: 45, max: 70, range: 28 },
    act: 'shop', actEvery: [26, 40]
  },
  {
    id: 'LUCK', kind: '개념', tags: [],
    desc: '예측할 수 없다. 가끔 주변에 좋은 일이 일어난다 — 돈, 새 글자, 갑작스러운 소나기.',
    hint: '운이 좋다',
    color: { fg: '#3f8a6e', bd: '#a8dcc6' },
    anim: 'pulse', fx: 'sparkle', pay: 1.2,
    motion: { min: 12, max: 22, range: 96 },
    act: 'luck', actEvery: [20, 34]
  },
  {
    id: 'GHOST', kind: '개념', tags: [],
    desc: '반투명하게 떠다니며 무엇이든 통과한다. 가끔 옆에 있는 단어를 놀라게 해 멀리 뛰게 만든다.',
    hint: '무섭다',
    color: { fg: '#6d6f86', bd: '#cdcedd' },
    anim: 'float', fx: 'wisp', pay: 1.0,
    motion: { min: 6, max: 12, range: 126 },
    ghost: true,
    act: 'ghost', actEvery: [14, 24]
  }
];

/* --------------------------------------------------------------------------
   파생 데이터
   -------------------------------------------------------------------------- */
G.WORD_BY_ID = {};
G.WORDS.forEach(function (w) {
  G.WORD_BY_ID[w.id] = w;
  w.value = G.wordValue(w.id.length);
});

/** 능력이 없는 보통 단어의 정의 (한 단어당 하나만 만들어 재사용) */
G.PLAIN_DEFS = {};
G.plainDef = function (text) {
  var d = G.PLAIN_DEFS[text];
  if (d) return d;
  var v = G.wordValue(text.length);
  d = {
    id: text, plain: true, kind: '보통 단어',
    desc: text.length + '글자 단어. 특별한 능력은 없지만 ' +
      G.C.PAY_PERIOD + '초마다 ' + G.util.money(v) + ' 을 벌어 온다.',
    hint: '', tags: [],
    color: { fg: '#17150f', bd: '#cfcac1' },
    anim: null, fx: null, pay: 1, value: v,
    motion: { min: 22, max: 42, range: 58 }
  };
  G.PLAIN_DEFS[text] = d;
  return d;
};

/**
 * 이 글자열이 단어인가?
 * @return {'ability'|'plain'|null}
 */
G.lookupWord = function (text) {
  if (G.WORD_BY_ID[text]) return 'ability';
  if (G.isWord && G.isWord(text)) return 'plain';
  return null;
};

/** 단어 정의 얻기 (능력 단어 우선) */
G.defFor = function (text) {
  return G.WORD_BY_ID[text] || G.plainDef(text);
};

/**
 * 낱글자 생성
 *   모음 5개 : 각 6%  (합쳐서 30%)
 *   자음 21개: 나머지 70% 를 균등하게  (각 약 3.33%)
 */
G.VOWELS = 'AEIOU';
G.CONSONANTS = 'BCDFGHJKLMNPQRSTVWXYZ';
G.randomLetter = function () {
  if (Math.random() < G.VOWELS.length * G.C.VOWEL_RATE) {
    return G.VOWELS.charAt(Math.floor(Math.random() * G.VOWELS.length));
  }
  return G.CONSONANTS.charAt(Math.floor(Math.random() * G.CONSONANTS.length));
};

/** 태그/아이디 매칭 스펙 검사 */
G.matchSpec = function (ent, spec) {
  if (!spec) return false;
  if (typeof spec === 'string') {
    if (spec === '@letter') return ent.type === 'letter' || ent.type === 'cluster';
    if (spec === '*') return true;
    if (spec.charAt(0) === '#') {
      if (ent.type !== 'word') return false;
      var tag = spec.slice(1);
      if (tag === 'burnable') return !!ent.def.flammable;
      return (ent.def.tags || []).indexOf(tag) >= 0;
    }
    return ent.type === 'word' && ent.text === spec;
  }
  for (var i = 0; i < spec.length; i++) if (G.matchSpec(ent, spec[i])) return true;
  return false;
};
