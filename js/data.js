/* ==========================================================================
   data.js — 밸런스 상수 + 능력 단어 51개 정의
   --------------------------------------------------------------------------
   사전(dict.js)에 있는 6만여 개 단어는 전부 만들 수 있고 재화를 번다.
   그중 아래 51개만 특별한 "능력"을 가진다.

   설계 규칙: 단어는 자기 뜻대로 행동한다. 그 성격이 이로울지 해로울지는
   플레이어가 어디에 놓느냐가 정한다.
     FIRE 는 집을 태우지만 MEAT 를 굽고 SAND 를 녹이고 GOLD 를 제련한다.
     BUG 는 나무를 갉지만 BIRD 에게는 먹이다.
     MOUSE 는 돈을 축내지만 CHEESE 로 길들이면 벌어 온다.
   좋기만 한 단어도, 나쁘기만 한 단어도 두지 않는다.

   새 능력 단어를 추가하려면 WORDS 에 항목 하나를 추가하면 된다.
   { id, kind, desc, hint, color, anim, fx, motion, tags,
     flammable, heavy, ghost, act, actEvery, bonds }

   act      : behaviors.js 의 ACTIONS[key] 에 대응하는 주기 행동
   bonds    : "가까이 + 일정 시간" 유지되어야 발동하는 상호작용
              { with, range, time, key }  →  behaviors.js 의 BONDS[key]
              with 는 단어 id 배열 또는 '#tag' 또는 '@letter'

   글자가 다른 글자로 바뀌는 상호작용은 두지 않는다. MEAT 는 구워도 MEAT 고,
   SAND 는 녹여도 SAND 다 — 빛깔과 벌이만 변한다 (behaviors.js 의 ripen).
   결과물로 나오던 ROAST·GLASS·CHEESE·TREE 는 전부 직접 철자해서 만드는 단어라,
   변신을 두면 같은 단어를 얻는 길이 둘이 되고 애써 만든 단어가 제멋대로 사라진다.
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
     45초에서 한 번에 2초씩, 21초까지 열두 번 줄일 수 있다.
     한 걸음이 작은 대신 걸음 수가 많아 후반까지 살 것이 남는다.
     값은 초반은 싸게 시작해서 뒤로 갈수록 배율이 커진다 (×2.1 → ×2.35) */
  SPAWN_STEPS: [45, 43, 41, 39, 37, 35, 33, 31, 29, 27, 25, 23, 21],
  SPAWN_COSTS: [45, 100, 235, 560, 1350, 3300, 8300, 21500, 56000, 148000, 395000, 1070000],

  /* --- 보드 확장 (available 영역 대비 비율) ---
     한 단계에 0.04 씩. 정원이 여섯 개씩 느는 것과 보조를 맞춘 값이다 —
     가로세로가 같이 늘어 넓이는 제곱으로 커지므로, 예전처럼 0.87 까지 가면
     넓이가 4.7배 되는 동안 정원은 2.6배밖에 안 늘어 보드가 휑해진다 */
  EXPAND_SCALE: [0.40, 0.44, 0.48, 0.52, 0.56, 0.60, 0.64],
  EXPAND_COSTS: [120, 500, 2300, 12000, 66000, 390000],
  /* 확장 단계마다 보드에 둘 수 있는 글자 수. 넓이만 늘고 상한이 그대로면
     확장을 살 이유가 약하다. 자리와 정원이 같이 늘어야 한다.
     한 단계에 네 개씩 고르게 늘린다 */
  BOARD_MAX: [20, 24, 28, 32, 36, 40, 44],

  /* --- 도감 힌트 (1단계: 첫 글자+분류, 2단계: 짧은 설명) ---
     아래는 첫 힌트 값이고, 많이 살수록 HINT_STEP 만큼 비싸진다 */
  HINT_COSTS: [60, 260],
  HINT_STEP: 1.05,
  HINT_STEP_CAP: 9,

  OFFLINE_CAP: 7200,     // 오프라인 수입 인정 최대 초 (2시간)
  OFFLINE_RATE: 0.1,     // 그동안 벌었을 액수의 이 비율만 준다
  IDLE_AFTER: 60,        // 이만큼 손대지 않으면 켜 둔 채로도 방치로 넘어간다 (1분)

  /* --- 보석 --- 만들면 품질이 정해지고, 가게에 가져가면 목돈이 된다 */
  GEM_PRICE: 250,        // 매입가 = 이 값 × 글자 수 × 품질
  GEM_HOLD: 1,           // 가게 위에 이만큼 두고 있으면 팔린다
  GEM_QUALITY: [1, 1.5], // 만들어질 때 이 사이에서 뽑히는 품질 배수

  /* --- 화재 --- */
  BURN_COLLAPSE: 42,     // 이만큼 타면 무너져 글자로 흩어진다

  /* --- 무르익음 ---
     짝이 곁에 있으면 천천히 익는다. 글자는 절대 바뀌지 않는다 —
     빛깔이 변하고 벌이가 오를 뿐이다. 한번 익은 것은 되돌아가지 않는다.
     불에 익히는 것만은 다 익은 뒤에도 놔두면 타 버리니 제때 빼내야 한다. */
  RIPE_MUL: 2.0,         // 다 익었을 때의 벌이 배수
  ROAST_MUL: 2.0,        // 처음부터 익어 있는 ROAST 의 벌이 배수
  ROAST_BURN: 20,        // 다 익은 뒤에도 불 옆에 이만큼 두면 타 버린다

  /* --- 벌이 배수 상한 ---
     배수는 곱으로 붙는다. SUN·MOON·GLASS·LAMP·GHOST 를 한 자리에 다 모으면
     한 단어가 혼자 다섯 배, 열 배를 벌어들여 나머지 보드가 장식이 되어 버린다.
     한 단어가 아무리 좋은 자리에 있어도 여기까지다 — 여러 단어를 골고루
     챙기는 쪽이 한 단어에 몰아주는 쪽보다 낫도록 만드는 장치다. */
  INCOME_CAP: 3.2,

  /* --- 톱니바퀴 ---
     이가 맞물리려면 그냥 가까운 정도로는 안 되고 거의 겹치도록 붙여야 한다.
     중심 사이 거리로 재는 것은 이때뿐이다. 톱니 폭만큼으로 잡아 두면
     위·아래·좌·우 넷까지만 물릴 수 있고 대각선은 닿지 않는다. */
  GEAR_MESH: 70,         // 중심 사이가 이 안쪽이면 맞물린 것으로 본다
  GEAR_MAX: 4,           // 하나에 물릴 수 있는 톱니 수
  GEAR_MUL: 2,           // 맞물린 톱니 하나당 제 벌이 배수

  /* --- "가까이 있다" 의 기준 ---
     각 단어에 적힌 range 는 중심 사이 거리가 아니라 글자와 글자 사이의 빈 틈으로 친다.
     긴 단어라고 해서 사정거리가 저절로 넓어지지 않고, 눈에 보이는 간격 그대로 맞는다.
       틈 = (range - RANGE_BASE) × RANGE_MUL, 최소 RANGE_MIN */
  RANGE_BASE: 88,        // 보통 단어 하나 너비. 이만큼은 애초에 붙어 있는 셈이다
  RANGE_MUL: 0.62,       // 낮출수록 바짝 붙여 놓아야 상호작용이 일어난다
  RANGE_MIN: 16,         // 아무리 짧은 range 라도 이만큼은 떨어져 있어도 된다


  WIND_CUT: 0.7,         // 바람이 불면 남은 생성 쿨다운이 이 비율로 줄어든다

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

  START_LETTERS: 8
};

/** 지금 확장 단계에서 보드에 둘 수 있는 최대 개수 */
G.maxEntities = function () {
  var m = G.C.BOARD_MAX;
  var lv = G.state ? G.state.expandLevel : 0;
  return m[Math.max(0, Math.min(lv, m.length - 1))];
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
   능력 단어 51개
   --------------------------------------------------------------------------
   상호작용이 이 게임의 전부다. 아래 표가 지도다.

   무르익음  MEAT + FIRE / MILK + TIME / SEED + SUN·물 / EGG + NEST·BIRD
             빛깔이 변하고 벌이가 오른다. 글자는 끝까지 그대로다
   불        FIRE + #burnable → 화재 / FIRE + RUBY·IRON → 값이 오른다
             FIRE + COAL → 불길이 세진다 / GLASS + SUN → 초점에 불이 붙는다
   보석      GOLD · IRON · RUBY · EMERALD · DIAMOND 를 SHOP 위에 올리면 목돈이 된다
   물        WATER·RAIN·RIVER·SAND 가 불을 끈다 / RIVER 가 낱글자를 하류로 나른다
             ROCK + RIVER → 여울에 낱글자가 모인다 / WATER + FIRE → 끓어 주변을 재촉
             ICE + FIRE → 녹으며 불을 끄고, 열에서 떼면 도로 언다
   풀        BEE + TREE → 수분 / BUG 가 TREE 를 갉는다 / TREE 가 글자를 떨군다
   짐승      CAT + MILK·MEAT → 정착 / CAT + MOUSE → 사냥 / DOG + BONE·MEAT → 땅파기
             BIRD + BUG → 사냥 / BIRD + NEST·TREE → 글자를 떨군다
             MOUSE + CHEESE → 길들임
   살림      KEY + BOX → 개봉 / LAMP + GHOST → 퇴치 / LAMP·SUN + GLASS → 렌즈
             ROAD + CAR → 배달 / BANK + GOLD → 시세 / CLOCK·TIME → 속도와 위험
             GEAR + GEAR → 맞물린 개수만큼 제 벌이가 곱절 (최대 넷)
   플레이어  다 익은 MEAT·ROAST 를 타기 전에 불에서 빼내기 / 보석을 만들어 SHOP 에 팔기
             불이 번지기 전에 WATER·SAND 를 대거나 ROCK 으로 막기
   ========================================================================== */
G.WORDS = [

  /* ------------------------------------------------------------------
     하늘
     ------------------------------------------------------------------ */
  {
    id: 'SUN', kind: '자연', tags: ['hot'],
    desc: '가만히 떠서 볕을 내린다. TREE 와 SEED 가 훨씬 빨리 자라고, MOON 과 함께 뜨면 ' +
      '하루가 온전해져 둘 다 크게 번다. 다만 물기를 말려서 곁에 있는 것들은 불이 더 잘 붙는다.',
    hint: '낮에 뜬다',
    color: { fg: '#b3760a', bd: '#f2d38a' },
    anim: 'pulse', fx: 'ray',
    motion: null
  },
  {
    id: 'MOON', kind: '자연', tags: [],
    desc: '주변을 밤처럼 잠재운다. 곁에 있는 것들은 뛰어다니지 않고 조용히 더 많이 번다. ' +
      'SUN 과 함께 떠 있으면 둘 다 크게 번다.',
    hint: '밤에 뜬다',
    color: { fg: '#5a5f86', bd: '#c3c7e2' },
    anim: 'float', fx: 'wisp',
    motion: null
  },
  {
    id: 'STAR', kind: '자연', tags: [],
    desc: '가만히 반짝인다. 가끔 소원을 들어주어 도감의 힌트를 밝히거나 목돈을 안긴다. ' +
      '가까운 LUCK 이 훨씬 자주 일어난다.',
    hint: '반짝이고 멀다',
    color: { fg: '#8a7a2e', bd: '#e6dca0' },
    anim: 'pulse', fx: 'sparkle',
    motion: null,
    act: 'star', actEvery: [30, 46]
  },
  {
    id: 'WIND', kind: '자연', tags: [],
    desc: '가끔 한 방향으로 돌풍을 일으켜 주변 것들을 밀어낸다. 그 바람에 새 글자가 실려 와 ' +
      '다음 글자를 기다리는 시간이 줄어든다. 불이 곁에 있으면 불길도 같이 키운다.',
    hint: '불어온다',
    color: { fg: '#6b7f8a', bd: '#c6d5db' },
    anim: 'float', fx: 'swirl',
    motion: { min: 9, max: 17, range: 130 },
    act: 'gust', actEvery: [16, 26]
  },
  {
    id: 'RAIN', kind: '자연', tags: ['wet'],
    desc: '가끔 주변에 비를 뿌린다. 범위 안의 불을 끄고, 비를 맞은 것들은 한동안 더 벌며, ' +
      'TREE 와 SEED 는 쑥쑥 자란다.',
    hint: '하늘에서 내린다',
    color: { fg: '#4a6b96', bd: '#b3c6e0' },
    anim: 'wave', fx: 'rain',
    motion: { min: 16, max: 28, range: 86 },
    act: 'rain', actEvery: [18, 27]
  },
  {
    id: 'STORM', kind: '자연', tags: ['wet'],
    desc: '몰아친다. 세게 밀어내고 비를 뿌려 불을 끄며, 가끔 벼락이 떨어진다. ' +
      '벼락을 맞은 단어는 한동안 미친 듯이 벌지만, 운이 나쁘면 글자로 흩어진다.',
    hint: '몰아친다',
    color: { fg: '#46526b', bd: '#b4bcd0' },
    anim: 'shake', fx: 'rain',
    motion: { min: 10, max: 18, range: 112 },
    act: 'storm', actEvery: [22, 34]
  },

  /* ------------------------------------------------------------------
     물
     ------------------------------------------------------------------ */
  {
    id: 'WATER', kind: '자연', tags: ['wet'],
    desc: '고여 있는 물. 주변에서 타고 있는 것을 꺼 주고, FIRE 옆에 잠깐만 있어도 그 기세를 ' +
      '한동안 꺾어 놓는다. 불 곁에서는 끓어올라 주변 단어들의 행동을 재촉한다.',
    hint: '고여 있다',
    color: { fg: '#1d6fa5', bd: '#9dc9e4' },
    anim: 'wave', fx: 'drop',
    motion: { min: 14, max: 26, range: 70 },
    bonds: [{ with: ['FIRE'], range: 108, time: 5, key: 'douse' }]
  },
  {
    id: 'RIVER', kind: '장소', tags: ['wet'],
    desc: '한 방향으로 흐른다. 물에 닿은 낱글자를 하류로 실어 나르고, 주변의 불을 넉넉히 ' +
      '꺼 주며, FISH 가 살기에 가장 좋은 곳이고 TREE 를 잘 자라게 한다.',
    hint: '흐르는 물',
    color: { fg: '#2f6b8f', bd: '#a8cbe0' },
    anim: 'wave', fx: 'drop',
    motion: null, heavy: true
  },
  {
    id: 'ICE', kind: '자연', tags: ['cold', 'wet'],
    desc: '주변 물체를 얼려 뛰어다니지 못하게 한다. 글자를 한자리에 붙들어 둘 때 쓴다. ' +
      'FIRE 곁에서는 녹아내려 얼리는 힘을 잃지만, 녹는 동안 흘린 물이 불을 꺼 준다. ' +
      '열에서 떼어 놓으면 다시 얼어붙는다.',
    hint: '차갑다',
    color: { fg: '#3a8fb0', bd: '#b6e0ee' },
    anim: 'pulse', fx: 'frost',
    motion: { min: 30, max: 52, range: 40 }
  },
  {
    id: 'STEAM', kind: '자연', tags: ['hot', 'wet'],
    desc: '펄펄 끓어오르는 김. 주변 단어들의 행동을 크게 재촉한다. 가만히 두면 김이 식어 ' +
      '힘을 잃으니, FIRE 나 끓는 WATER 곁에 두어 계속 데워 주어야 한다.',
    hint: '끓어오른다',
    color: { fg: '#7c8a92', bd: '#cfd8dc' },
    anim: 'float', fx: 'steam',
    motion: { min: 6, max: 12, range: 100 }
  },

  /* ------------------------------------------------------------------
     불과 땅
     ------------------------------------------------------------------ */
  {
    id: 'FIRE', kind: '자연', tags: ['hot'],
    desc: '가연성 단어 곁에 한참 붙어 있으면 결국 불이 옮아붙는다. 하지만 굽는 일은 ' +
      '불이 있어야 한다 — MEAT 를 노릇하게 익히고, 불에 들어가야 값이 오르는 광물도 있다. ' +
      'WATER 와 SAND 가 가까이 오면 힘을 잃고, COAL 이 있으면 불길이 거세진다.',
    hint: '뜨겁고 위험하다',
    color: { fg: '#c2410c', bd: '#f0b18a' },
    anim: 'shake', fx: 'ember',
    motion: { min: 8, max: 16, range: 84 },
    bonds: [{ with: '#burnable', range: 116, time: 20, key: 'ignite' }]
  },
  {
    id: 'COAL', kind: '재료', tags: ['burnable'],
    desc: '까맣게 타고 남은 덩어리. 그 자체로도 값이 나가고, FIRE 곁에 두면 불길이 훨씬 거세져 ' +
      '주변이 크게 벌고 굽는 것도 빨라진다. 다만 저도 결국은 타서 없어진다.',
    hint: '까맣게 타고 남은 것',
    color: { fg: '#3f3b38', bd: '#b0aaa4' },
    anim: 'still', fx: null,
    motion: null, flammable: true, heavy: true
  },
  {
    id: 'ROCK', kind: '사물', tags: ['heavy'],
    desc: '절대 움직이지 않고 불에도 타지 않는다. 벽처럼 세워 불길을 갈라놓을 수 있다. ' +
      'RIVER 한가운데 놓으면 물살이 갈라져 여울이 생기고, 떠내려가던 낱글자가 그 뒤에 걸려 모인다.',
    hint: '단단하다',
    color: { fg: '#5f5c57', bd: '#cbc7c0' },
    anim: 'still', fx: null,
    motion: null, heavy: true
  },
  {
    id: 'SAND', kind: '재료', tags: [],
    desc: '타고 있는 것을 덮어 끈다. 물과 달리 몇 번이고 다시 쓸 수 있고, FIRE 곁에 두면 ' +
      '불길이 번지는 것을 눌러 준다. 불을 다루는 자리에 미리 깔아 두는 것이다.',
    hint: '잘게 부서진 것',
    color: { fg: '#9a8a5c', bd: '#e2d5ac' },
    anim: 'still', fx: 'grit',
    motion: { min: 34, max: 60, range: 34 }
  },
  {
    id: 'GLASS', kind: '사물', tags: [],
    desc: '빛을 모은다. SUN 이나 LAMP 가 가까우면 렌즈가 되어 곁에 있는 것들이 크게 번다. ' +
      '다만 볕이 아주 오래 모이면 초점에서 불이 붙는다 — 불을 얻는 방법이기도 하다.',
    hint: '투명하고 잘 깨진다',
    color: { fg: '#3f7d86', bd: '#b6dbe0' },
    anim: 'pulse', fx: 'shine',
    motion: null, heavy: true,
    bonds: [{ with: ['SUN'], range: 130, time: 34, key: 'focus' }]
  },

  /* ------------------------------------------------------------------
     풀
     ------------------------------------------------------------------ */
  {
    id: 'TREE', kind: '자연', tags: ['burnable', 'plant'],
    desc: '가끔 새로운 글자 하나를 떨어뜨린다. 물과 볕이 가까울수록 자주 떨어진다. ' +
      '불에 아주 잘 타니 불 가까이 두지 않는 것이 좋다.',
    hint: '자란다',
    color: { fg: '#2f7a43', bd: '#a8d6b0' },
    anim: 'hop', fx: 'leaf',
    motion: { min: 40, max: 72, range: 30 },
    flammable: true,
    act: 'tree', actEvery: [30, 44]
  },
  {
    id: 'SEED', kind: '자연', tags: ['burnable', 'plant'],
    desc: 'SUN 이나 물이 가까우면 천천히 싹이 튼다. 푸르게 오를수록 벌이가 늘고, ' +
      '다 튼 싹은 그대로 남는다. 볕도 물도 없으면 그냥 씨앗인 채다.',
    hint: '심으면 자란다',
    color: { fg: '#5f7a34', bd: '#c6daa4' },
    anim: 'pulse', fx: null,
    motion: null, flammable: true
  },
  {
    id: 'BEE', kind: '동물', tags: ['animal'],
    desc: 'TREE 나 SEED 가 가까우면 꿀을 모아 훨씬 잘 번다. 가끔 꽃가루를 옮겨 나무가 ' +
      '글자를 떨어뜨리게 한다.',
    hint: '윙윙거린다',
    color: { fg: '#8a6a12', bd: '#e6cf86' },
    anim: 'shake', fx: null,
    motion: { min: 4, max: 9, range: 124 },
    act: 'bee', actEvery: [16, 26],
    bonds: [{ with: ['TREE'], range: 100, time: 12, key: 'pollen' }]
  },

  /* ------------------------------------------------------------------
     살림
     ------------------------------------------------------------------ */
  {
    id: 'HOUSE', kind: '장소', tags: ['burnable', 'building'],
    desc: '주변에 흩어진 낱글자를 재워 주고 그만큼 세를 받는다. 재워진 글자는 뛰어다니지 않는다. ' +
      '불이 붙으면 수입이 멈추고, 오래 타면 무너져 글자로 흩어진다.',
    hint: '사람이 사는 곳',
    color: { fg: '#8a6134', bd: '#ddc7a3' },
    anim: 'still', fx: null,
    motion: { min: 55, max: 95, range: 22 },
    flammable: true, heavy: true
  },
  {
    id: 'ROAD', kind: '장소', tags: [],
    desc: '가만히 깔려 있다. 가까이에 CAR 가 있으면 CAR 가 더 멀리 달리고 통행료를 훨씬 많이 ' +
      '벌어 온다.',
    hint: '차가 다니는 곳',
    color: { fg: '#55585c', bd: '#c4c7cc' },
    anim: 'still', fx: null,
    motion: null, heavy: true
  },
  {
    id: 'CAR', kind: '사물', tags: [],
    desc: '가끔 한 방향으로 달려간다. 부딪힌 것은 밀려나지만 지나간 길에 떨어진 낱글자는 ' +
      '함께 실려 온다. ROAD 가 가까우면 더 멀리 달리고 통행료를 벌어 온다.',
    hint: '달린다',
    color: { fg: '#a33a3a', bd: '#e5adad' },
    anim: 'still', fx: null,
    motion: { min: 22, max: 40, range: 34 },
    act: 'car', actEvery: [9, 15]
  },
  {
    id: 'BOX', kind: '사물', tags: ['burnable'],
    desc: '주변에 떨어진 낱글자를 붙잡아 가지런히 정리한다. 붙잡아 둔 글자만큼 안에 값이 쌓이지만, ' +
      '열지 않으면 꺼낼 수 없다.',
    hint: '무언가 담는 것',
    color: { fg: '#8d6a3f', bd: '#dcc49a' },
    anim: 'still', fx: null,
    motion: null, heavy: true
  },
  {
    id: 'KEY', kind: '사물', tags: ['metal'],
    desc: 'BOX 옆에 잠깐 머무르면 상자를 열어 안에 쌓인 값을 한꺼번에 꺼낸다.',
    hint: '무언가 여는 것',
    color: { fg: '#96762c', bd: '#ddcb97' },
    anim: 'still', fx: null,
    motion: { min: 20, max: 36, range: 64 },
    bonds: [{ with: ['BOX'], range: 92, time: 5, key: 'unlock' }]
  },
  {
    id: 'MAGNET', kind: '사물', tags: ['metal'],
    desc: '범위 안의 낱글자를 천천히 끌어당긴다. 글자를 한곳에 모아 단어를 만들 때 쓴다.',
    hint: '끌어당긴다',
    color: { fg: '#9c3f4e', bd: '#e2a9b3' },
    anim: 'pulse', fx: 'field',
    motion: { min: 34, max: 56, range: 40 }
  },
  {
    id: 'BOOK', kind: '사물', tags: ['burnable'],
    desc: '조용히 읽히며, 가끔 도감의 아직 못 찾은 단어에 힌트를 하나 밝혀 준다. ' +
      'LAMP 가 비춰 주면 훨씬 자주 읽힌다.',
    hint: '읽는 것',
    color: { fg: '#4a5a86', bd: '#b8c2de' },
    anim: 'still', fx: null,
    motion: { min: 50, max: 80, range: 26 },
    flammable: true,
    act: 'book', actEvery: [50, 70]
  },
  {
    id: 'LAMP', kind: '사물', tags: ['metal'],
    desc: '주위를 밝힌다. 곁에 있는 단어들이 조금 더 벌고, 낱글자는 불빛 아래 얌전히 머물며, ' +
      'GHOST 는 빛을 견디지 못해 달아난다. GLASS 를 비추면 렌즈가 된다.',
    hint: '어둠을 밝힌다',
    color: { fg: '#8a6a2c', bd: '#e0cb96' },
    anim: 'pulse', fx: 'ray',
    motion: null,
    bonds: [{ with: ['GHOST'], range: 118, time: 6, key: 'banish' }]
  },
  {
    id: 'CLOCK', kind: '사물', tags: ['metal'],
    desc: '주변 단어들의 행동 주기를 재촉한다. 무언가를 자주 하는 단어 옆에 두면 좋지만, ' +
      '불이 번지는 속도까지 같이 빨라진다.',
    hint: '시간을 알린다',
    color: { fg: '#4d4b47', bd: '#cdc9c2' },
    anim: 'tick', fx: 'tickmark',
    motion: null
  },
  {
    id: 'GEAR', kind: '사물', tags: ['metal'],
    desc: '혼자서는 아무 일도 하지 않는다. 다른 GEAR 와 이가 맞물릴 만큼 바짝 붙여 놓으면 ' +
      '함께 돌기 시작하고, 맞물린 톱니 하나마다 제 벌이가 곱절로 뛴다. ' +
      '스스로 움직이지 않으니 한번 짜 놓은 톱니바퀴는 흐트러지지 않는다.',
    hint: '맞물려 돌아간다',
    color: { fg: '#5c5750', bd: '#cbc5bb' },
    anim: 'tick', fx: null,
    motion: null, heavy: true
  },
  {
    id: 'TIME', kind: '개념', tags: [],
    desc: '주변의 위험이 쌓이는 속도를 크게 늦춘다. 화재를 막아 주는 안전지대이면서, ' +
      '느긋하게 익어야 하는 것들 — SEED · EGG · MILK — 은 오히려 빨리 여물게 한다.',
    hint: '흘러가는 것',
    color: { fg: '#6a5a92', bd: '#c9bee2' },
    anim: 'float', fx: 'ripple',
    motion: { min: 45, max: 75, range: 30 }
  },
  {
    id: 'NEST', kind: '장소', tags: ['burnable'],
    desc: 'BIRD 가 앉으면 자리를 잡고 얌전히 벌며, 오래 앉아 있으면 EGG 를 하나 남긴다. ' +
      '불에 잘 탄다.',
    hint: '새가 앉는 곳',
    color: { fg: '#8a6a45', bd: '#ddc8a6' },
    anim: 'still', fx: null,
    motion: null, heavy: true, flammable: true
  },

  /* ------------------------------------------------------------------
     짐승
     ------------------------------------------------------------------ */
  {
    id: 'CAT', kind: '동물', tags: ['animal'],
    desc: '자주 통통 뛰어다니고, 착지하면서 근처 낱글자를 툭 밀어버린다. MILK 나 MEAT 옆에서는 ' +
      '자리를 잡고 골골거리며 잘 벌고, MOUSE 를 보면 잡는다.',
    hint: '야옹',
    color: { fg: '#7c6a55', bd: '#d8cbb9' },
    anim: 'hop', fx: null,
    motion: { min: 5, max: 11, range: 118 },
    act: 'cat', actEvery: [6, 12],
    bonds: [
      { with: ['MILK', 'MEAT', 'ROAST'], range: 88, time: 6, key: 'purr' },
      { with: ['MOUSE'], range: 124, time: 2.5, key: 'hunt' }
    ]
  },
  {
    id: 'DOG', kind: '동물', tags: ['animal'],
    desc: '가끔 가까운 낱글자를 물고 다른 곳에 옮겨 놓는다. BONE 이나 MEAT 옆에서는 자리를 잡고 ' +
      '땅을 파서 돈이나 새 글자를 찾아낸다.',
    hint: '멍멍',
    color: { fg: '#8a6a3c', bd: '#dcc6a0' },
    anim: 'hop', fx: null,
    motion: { min: 7, max: 14, range: 104 },
    act: 'dog', actEvery: [11, 18],
    bonds: [{ with: ['BONE', 'MEAT', 'ROAST'], range: 88, time: 6, key: 'dig' }]
  },
  {
    id: 'BIRD', kind: '동물', tags: ['animal'],
    desc: '멀리 날아갔다가 글자를 물고 돌아온다. NEST 나 TREE 가 가까우면 자리를 잡고 얌전히 ' +
      '벌며 오래 앉아 있으면 EGG 를 남긴다. BUG 를 잡아먹는다.',
    hint: '난다',
    color: { fg: '#3c7f95', bd: '#a9d3de' },
    anim: 'float', fx: null,
    motion: { min: 4, max: 9, range: 150 },
    act: 'bird', actEvery: [22, 34],
    bonds: [
      { with: ['BUG'], range: 104, time: 3, key: 'eat' },
      { with: ['NEST', 'TREE'], range: 100, time: 26, key: 'roost' }
    ]
  },
  {
    id: 'EGG', kind: '동물', tags: ['burnable'],
    desc: 'NEST 나 BIRD 가 품어 주면 천천히 따뜻해진다. 다 품어진 알은 잘 벌고, ' +
      '가끔 새 글자를 하나 내놓는다. 혼자 두면 식은 채 그대로다.',
    hint: '깨어난다',
    color: { fg: '#9a8560', bd: '#e2d7bd' },
    anim: 'still', fx: null,
    motion: null, flammable: true
  },
  {
    id: 'FISH', kind: '동물', tags: ['animal'],
    desc: 'RIVER · WATER · RAIN 근처에서는 편안히 헤엄치며 아주 잘 벌지만, 물이 없으면 ' +
      '파닥거리기만 한다.',
    hint: '헤엄친다',
    color: { fg: '#2b7f7a', bd: '#a5d8d4' },
    anim: 'wave', fx: null,
    motion: { min: 5, max: 10, range: 92 }
  },
  {
    id: 'BUG', kind: '동물', tags: ['animal'],
    desc: '가까운 TREE 를 갉아 성장을 막고 돈을 조금씩 훔친다. 성가시지만 BIRD 에게는 먹이라, ' +
      '새 곁에 몰아 두면 오히려 벌이가 된다.',
    hint: '작고 성가시다',
    color: { fg: '#6b7a2c', bd: '#c6d59a' },
    anim: 'shake', fx: null,
    motion: { min: 6, max: 12, range: 70 },
    act: 'bug', actEvery: [4, 8]
  },
  {
    id: 'MOUSE', kind: '동물', tags: ['animal'],
    desc: '쉴 새 없이 돌아다니며 돈을 조금씩 축낸다. CHEESE 옆에서는 얌전해져 오히려 잘 벌고, ' +
      'CAT 이 보면 잡힌다.',
    hint: '작고 빠르다',
    color: { fg: '#7a7269', bd: '#d6d0c7' },
    anim: 'shake', fx: null,
    motion: { min: 5, max: 10, range: 112 },
    act: 'mouse', actEvery: [7, 13],
    bonds: [{ with: ['CHEESE'], range: 92, time: 10, key: 'nibble' }]
  },

  /* ------------------------------------------------------------------
     먹을 것
     ------------------------------------------------------------------ */
  {
    id: 'MEAT', kind: '재료', tags: ['burnable'],
    desc: 'FIRE 곁에 두면 노릇하게 익어 간다. 다 익으면 빛깔이 변하고 벌이가 크게 오르며, ' +
      '불에서 떼어 놓아도 익은 채로 남는다. 다 익은 뒤에도 불 위에 두면 타 버리니 제때 빼야 한다. ' +
      'CAT 과 DOG 이 냄새를 맡고 달려와 자리를 잡는다.',
    hint: '짐승이 좋아한다',
    color: { fg: '#98453f', bd: '#e4b3ae' },
    anim: 'still', fx: null,
    motion: { min: 40, max: 70, range: 30 },
    flammable: true
  },
  {
    id: 'ROAST', kind: '재료', tags: [],
    desc: '처음부터 잘 익은 고기라 그냥 두어도 잘 번다. ' +
      '불 옆에 그대로 두면 점점 검어지다 타 버리니 제때 빼내야 한다.',
    hint: '노릇하게 익었다',
    color: { fg: '#7a4412', bd: '#d9b184' },
    anim: 'pulse', fx: 'savory',
    motion: null, flammable: true
  },
  {
    id: 'MILK', kind: '사물', tags: [],
    desc: 'CAT 을 자리에 앉힌다. 곁에 있는 동안 고양이가 얌전히 잘 벌어 온다. ' +
      'TIME 옆에 오래 두면 꾸덕하게 삭아 벌이가 크게 오르고, 한번 삭으면 그대로 남는다.',
    hint: '하얗고 마신다',
    color: { fg: '#7d7a72', bd: '#dcd8cf' },
    anim: 'still', fx: null,
    motion: null
  },
  {
    id: 'BONE', kind: '사물', tags: [],
    desc: 'DOG 을 붙잡아 둔다. 개가 자리를 잡으면 땅에서 무언가를 계속 파낸다.',
    hint: '개가 좋아한다',
    color: { fg: '#8b857a', bd: '#dcd6c9' },
    anim: 'still', fx: null,
    motion: null
  },
  {
    id: 'CHEESE', kind: '사물', tags: [],
    desc: 'MOUSE 를 천천히 끌어당겨 붙잡아 둔다. 생쥐가 오래 갉으면 그 값을 챙길 수 있다.',
    hint: '생쥐가 좋아한다',
    color: { fg: '#a08427', bd: '#ecd894' },
    anim: 'still', fx: null,
    motion: null
  },

  /* ------------------------------------------------------------------
     돈
     ------------------------------------------------------------------ */
  /* ------------------------------------------------------------------
     보석 — 만들 때 품질이 정해진다. SHOP 에 가져가면 목돈이 된다
     ------------------------------------------------------------------ */
  {
    id: 'GOLD', kind: '보석', tags: ['metal', 'gem'],
    desc: '가만히 있어도 값이 나가고, BANK 가 가까우면 시세가 오른다. ' +
      'SHOP 위에 잠깐 올려 두면 통째로 팔린다. 잘 나온 것일수록 평소에 버는 돈도, 파는 값도 높다.',
    hint: '반짝이고 비싸다',
    color: { fg: '#a07a12', bd: '#e8cf80' },
    anim: 'pulse', fx: 'sparkle',
    motion: { min: 26, max: 48, range: 42 }
  },
  {
    id: 'IRON', kind: '보석', tags: ['metal', 'gem'],
    desc: '무겁고 단단하다. MAGNET 이 아주 세게 끌어당기고, FIRE 곁에서는 벌겋게 달아올라 ' +
      '주변까지 데운다. SHOP 위에 잠깐 올려 두면 팔린다. 잘 나온 것일수록 평소에 버는 돈도, 파는 값도 높다.',
    hint: '무겁고 단단한 쇠',
    color: { fg: '#5a6068', bd: '#c2c8d0' },
    anim: 'still', fx: null,
    motion: null, heavy: true
  },
  {
    id: 'RUBY', kind: '보석', tags: ['gem'],
    desc: '붉게 타오르는 돌. FIRE 곁에서 더 붉어져 값이 오른다. ' +
      'SHOP 위에 잠깐 올려 두면 팔린다. 잘 나온 것일수록 평소에 버는 돈도, 파는 값도 높다.',
    hint: '붉은 보석',
    color: { fg: '#a32a45', bd: '#e8a8b6' },
    anim: 'pulse', fx: 'sparkle',
    motion: { min: 30, max: 52, range: 34 }
  },
  {
    id: 'EMERALD', kind: '보석', tags: ['gem'],
    desc: '풀빛으로 깊게 빛난다. TREE 나 SEED 가 가까우면 빛이 짙어져 값이 오른다. ' +
      'SHOP 위에 잠깐 올려 두면 팔린다. 잘 나온 것일수록 평소에 버는 돈도, 파는 값도 높다.',
    hint: '초록 보석',
    color: { fg: '#1d7a56', bd: '#a2d9c2' },
    anim: 'pulse', fx: 'sparkle',
    motion: { min: 30, max: 52, range: 34 }
  },
  {
    id: 'DIAMOND', kind: '보석', tags: ['gem'],
    desc: '가장 단단하고 가장 비싸다. 빛을 받으면 사방으로 흩뿌리며, LAMP 나 SUN 이 가까우면 ' +
      '곁에 있는 것들까지 잘 벌게 한다. SHOP 위에 잠깐 올려 두면 팔린다. 잘 나온 것일수록 평소에 버는 돈도, 파는 값도 높다.',
    hint: '가장 단단한 것',
    color: { fg: '#3f7f9a', bd: '#b4d9e6' },
    anim: 'pulse', fx: 'shine',
    motion: null, heavy: true
  },
  {
    id: 'BANK', kind: '경제', tags: ['building'],
    desc: '보드에서 생기는 수입의 일부를 금고에 모아 두었다가, 가끔 이자를 얹어 한꺼번에 지급한다.',
    hint: '돈을 맡기는 곳',
    color: { fg: '#2f6b52', bd: '#a6d3bd' },
    anim: 'still', fx: null,
    motion: null, heavy: true,
    act: 'bank', actEvery: [42, 42]
  },
  {
    id: 'SHOP', kind: '경제', tags: ['building', 'burnable'],
    desc: '보석을 사들인다. 값나가는 광물이나 보석을 만들어 가게 위에 잠깐만 올려 두면 ' +
      '그 자리에서 목돈으로 바꿔 준다. 글자가 길수록, 품질이 좋을수록 비싸다. ' +
      '틈틈이 잔돈도 내놓지만 푼돈이니 큰 기대는 말자.',
    hint: '물건을 파는 곳',
    color: { fg: '#8a4a86', bd: '#dcb4da' },
    anim: 'still', fx: null,
    motion: { min: 45, max: 70, range: 28 },
    flammable: true,
    act: 'shop', actEvery: [26, 40]
  },
  {
    id: 'LUCK', kind: '개념', tags: [],
    desc: '예측할 수 없다. 가끔 주변에 좋은 일이 일어난다 — 목돈, 새 글자, 도감의 힌트, ' +
      '갑작스러운 소나기, 혹은 옆 단어에 잠깐 깃드는 행운.',
    hint: '운이 좋다',
    color: { fg: '#3f8a6e', bd: '#a8dcc6' },
    anim: 'pulse', fx: 'sparkle',
    motion: { min: 12, max: 22, range: 96 },
    act: 'luck', actEvery: [20, 34]
  },
  {
    id: 'GHOST', kind: '개념', tags: [],
    desc: '반투명하게 떠다니며 무엇이든 통과한다. 다른 단어에 겹쳐 세워 두면 씌어서 벌이를 ' +
      '크게 부풀리지만, 그냥 두면 옆에 있는 단어를 놀라게 해 멀리 뛰게 만든다. ' +
      'LAMP 의 빛은 견디지 못한다.',
    hint: '통과한다',
    color: { fg: '#6d6f86', bd: '#cdcedd' },
    anim: 'float', fx: 'wisp',
    motion: { min: 6, max: 12, range: 126 },
    ghost: true,
    act: 'ghost', actEvery: [16, 26]
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

/* --------------------------------------------------------------------------
   특별한 벌이
   --------------------------------------------------------------------------
   보통 단어는 20초마다 정해진 액수를 낸다. 아래 단어들은 그 줄을 보여 주면
   거짓말이 된다 — 보석은 품질에 따라 값이 제각각이고 진짜 돈은 팔 때 들어오며,
   DOG·CAR·LUCK 은 한 번씩 터지는 쪽이 훨씬 크고, BUG 은 벌기는커녕 훔쳐 간다.
   그래서 더블클릭 팝오버에서는 액수 대신 이 한 줄로 벌이의 성격을 알려 준다.
   -------------------------------------------------------------------------- */
(function () {
  var GEM = '가게에 넘길 때 목돈 · 잘 나온 것일수록 비싸다';
  G.PAY_NOTE = {
    GOLD: GEM, IRON: GEM, RUBY: GEM, EMERALD: GEM, DIAMOND: GEM,
    SHOP: '보석을 사들이고, 틈틈이 잔돈을 흘린다',
    BANK: '수입 일부를 맡아 두었다 이자와 함께 내준다',
    DOG: '이따금 땅을 파서 한몫 물어 온다',
    CAR: '길을 따라 배달을 다니며 번다',
    LUCK: '이따금 횡재가 터진다',
    STAR: '소원을 들어준다 — 목돈이나 도감 힌트',
    GHOST: '제 벌이보다 올라탄 단어의 벌이를 부풀린다',
    BUG: '버는 것보다 훔쳐 가는 쪽이 많다',
    MOUSE: '버는 것보다 훔쳐 가는 쪽이 많다',
    MEAT: '불에 익히면 벌이가 곱절이 된다 · 다 익으면 빼낼 것',
    MILK: 'TIME 곁에서 삭히면 벌이가 곱절이 된다',
    SEED: '볕과 물을 받아 싹이 트면 벌이가 곱절이 된다',
    EGG: '품어 주면 벌이가 곱절이 되고 글자도 낳는다',
    ROAST: '처음부터 익어 있어 그냥 두어도 잘 번다 · 불은 조심',
    GEAR: '혼자면 제값 · 맞물린 톱니 하나마다 곱절로 뛴다'
  };
})();

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
    anim: null, fx: null, value: v,
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
 *   자음 21개: 나머지 70% 를 영어에서 쓰이는 빈도대로 나눠 가진다
 *
 * 자음까지 균등하게 뿌리면 Q·X·Z·J 가 T·S·R 만큼 자주 나와 보드에 쓰레기가
 * 쌓인다. 실제 영어 빈도를 따르게 하면 붙일 만한 글자가 손에 들어와서
 * 초반에 단어가 훨씬 잘 나온다. (드물어야 재미있는 Q·Z 도 여전히 나온다)
 */
G.VOWELS = 'AEIOU';
G.CONSONANTS = 'BCDFGHJKLMNPQRSTVWXYZ';

G.randomLetter = (function () {
  var WEIGHT = {
    T: 100, N: 74, S: 73, R: 72, H: 55, L: 47, D: 44, C: 34, M: 28, F: 25,
    W: 22, G: 21, P: 21, Y: 20, B: 17, V: 11, K: 8, X: 3, J: 2, Q: 2, Z: 2
  };
  var upto = [], total = 0, i;
  for (i = 0; i < G.CONSONANTS.length; i++) {
    total += WEIGHT[G.CONSONANTS.charAt(i)] || 1;
    upto.push(total);
  }

  return function () {
    if (Math.random() < G.VOWELS.length * G.C.VOWEL_RATE) {
      return G.VOWELS.charAt(Math.floor(Math.random() * G.VOWELS.length));
    }
    var r = Math.random() * total;
    for (var j = 0; j < upto.length; j++) {
      if (r < upto[j]) return G.CONSONANTS.charAt(j);
    }
    return 'T';
  };
})();

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
