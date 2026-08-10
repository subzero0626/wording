/* ==========================================================================
   data.js — 밸런스 상수 + 능력 단어 35개 정의
   --------------------------------------------------------------------------
   사전(dict.js)에 있는 6만여 개 단어는 전부 만들 수 있고 재화를 번다.
   그중 아래 35개만 특별한 "능력"을 가진다.

   설계 규칙 하나: 한 단어는 능력을 하나만 가진다.
   예전에는 SUN 하나가 풀을 키우고, 물기를 말리고, 불을 잘 붙게 하고,
   MOON 과 만나면 둘 다 더 벌었다. 네 줄짜리 설명을 읽고도 이 단어를 어디에
   놓아야 할지 알 수 없었다. 지금은 SUN 을 보면 "벌이 주기가 짧아진다" 하나만
   알면 된다. 조합의 재미는 한 단어 안이 아니라 단어와 단어 사이에서 나온다.

   설계 규칙 둘: 설명에 숫자를 적지 않는다.
   "20초마다 8w" 나 "×1.35" 를 적어 두면 게임이 계산표가 된다.
   "조금 오른다 · 크게 오른다" 정도로만 알려 주고, 실제 값은 여기 코드에만 둔다.

   설계 규칙 셋: 하는 일이 겹치는 단어는 두지 않는다.
   불을 끄는 단어가 WATER·RAIN·RIVER·SAND·ICE 다섯이나 있었고, 곁의 벌이를
   올려 주는 단어가 MOON·LAMP·GLASS·DIAMOND·FIRE 다섯이었다. 어느 것을 골라도
   결과가 같으면 고를 이유가 없다. 한 가지 일은 한 단어가 맡는다.
   RIVER 도 낱글자를 붙들어 두는 일이 ICE 와 겹쳐 지웠다. ROCK 은 불이 붙는
   속도를 늦추는 담이었는데, 불을 다루는 일은 이미 WATER 가 맡고 있고
   "불이 늦게 붙는다" 는 눈에 보이지도 않아서 그것도 지웠다 —
   아무 일도 일어나지 않는 것이 능력인 단어는 만들 이유가 생기지 않는다.
   보석 넷(GOLD·RUBY·DIAMOND·EMERALD)만은 일부러 똑같이 두었다. 저마다 다른
   짝을 외워야 했던 때보다, 넷 다 "팔면 목돈" 하나로 읽히는 지금이 낫다.

   설계 규칙 넷: 혼자서도 만들 이유가 있어야 한다.
   CAT 은 MOUSE 를 잡는 것 말고는 할 일이 없었고 MOUSE 는 돈을 훔치기만 했다.
   둘을 같이 만들어야 겨우 본전인 단어 쌍은 결국 아무도 만들지 않는다.
   남을 방해하기만 하던 BUG 도 같은 이유로 지웠다 — 만들면 손해인 단어는
   보이는 족족 부수게 되고, 그것은 선택이 아니라 잡일이다.

   설계 규칙 다섯: 같은 단어를 여럿 세워도 그 효과가 겹치지 않는다.
   해를 넷 세우면 한 단어의 벌이 주기가 네 겹으로 당겨졌다. 그러면 보드 짜기가
   "제일 센 단어를 몇 개까지 욱여넣느냐" 로 납작해진다. 지금은 곁의 단어가
   같은 종류에서 받는 것은 한 번뿐이라, 두 번째 해는 다른 자리에 세워야 값을 한다.
   (GEAR 만 예외다 — 서로 맞물려 커지는 것이 그 단어의 전부이기 때문이다.)

   새 능력 단어를 추가하려면 WORDS 에 항목 하나를 추가하면 된다.
   { id, kind, desc, hint, color, anim, fx, motion, tags,
     flammable, heavy, ghost, solid, sellable, act, actChance, bonds }

   act      : behaviors.js 의 ACTIONS[key] 에 대응하는 주기 행동
   actChance: 20초마다 한 번 굴리는 주사위의 확률 (0~1)
              물건(낱글자·힌트권)이 떨어지는 쪽은 2~3% 로 아주 낮게 잡는다.
              떨어지는 것이 흔하면 정원이 늘 꽉 차 있고, 내가 고른 글자가 아니라
              떨어진 글자로 판이 굴러간다. 돈이 나오는 쪽(BEE·DOG)만 넉넉히 둔다.
              주사위는 board.step 안에서 굴리니 자리를 비운 동안에는 굴러가지 않는다 —
              방치 중에 바닥에 뭔가 떨어져 시간이 다 지나 사라져 있는 일은 없다.
   bonds    : "가까이 + 일정 시간" 유지되어야 발동하는 상호작용
              { with, range, time, key }  →  behaviors.js 의 BONDS[key]
              with 는 단어 id 배열 또는 '#tag' 또는 '@letter'

   글자가 다른 글자로 바뀌는 상호작용은 두지 않는다. MEAT 는 구워도 MEAT 다 —
   빛깔과 벌이만 변한다 (behaviors.js 의 ripen).
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

  /* --- 재화 ---
     버는 방법은 둘로 갈라져 있다. 한 번에 얼마를 버느냐(incomeMul)와
     얼마나 자주 버느냐(payMul). MOON 이 앞을 맡고 SUN 이 뒤를 맡는다.
     둘을 한 덩어리로 두면 두 단어가 결국 같은 일을 하게 된다. */
  PAY_PERIOD: 20,        // 몇 초마다 한 번 벌어들이는가
  PAY_BASE: 1,           // 낱글자 한 개가 한 번에 버는 양
  PAY_WORD_BASE: 4,      // 3글자 단어의 기본값
  PAY_GROWTH: 2,         // 글자가 하나 늘 때마다 곱해지는 값
  MIN_WORD_LEN: 3,       // 이보다 짧으면 단어가 되지 않는다

  /* --- 글자 생성 ---
     50초에서 한 번에 2초씩, 22초까지 열네 번 줄일 수 있다.
     한 걸음이 작은 대신 걸음 수가 많아 후반까지 살 것이 남는다.
     값은 초반은 싸게 시작해서 뒤로 갈수록 배율이 커진다 (×2.05 → ×2.6)

     처음을 45초에서 50초로 늘린 것은, 시작하자마자 글자가 밀려들면 무엇을 만들지
     고르기 전에 자리부터 차기 때문이다. 첫 단어를 손으로 궁리해서 만드는 그 몇 분이
     이 게임에서 제일 재미있는 대목인데, 그때 글자가 계속 떨어지면 그냥 치우는 일이
     된다. 끝값(22초)은 그대로 두고 걸음만 둘 늘려서, 늦어지는 것은 초반뿐이다 */
  SPAWN_STEPS: [50, 48, 46, 44, 42, 40, 38, 36, 34, 32, 30, 28, 26, 24, 22],
  /* 초반만 기본을 약 2배로 올리고 배율도 ×2.4~×2.5 로 조금 더 세게.
     중반부터는 배율을 눌러 끝값(34만)은 예전과 같게 둔다 —
     초반이 너무 싸서 바로 다 사 버리는 느낌만 늦추려는 조정이다 */
  SPAWN_COSTS: [60, 150, 380, 950, 2300, 4800, 8500, 14000, 22000, 38000, 75000, 150000, 280000, 340000],

  /* --- 보드 확장 (available 영역 대비 비율) ---
     한 단계에 0.05 씩. 정원이 네 개씩 느는 것과 보조를 맞춘 값이다 —
     가로세로가 같이 늘어 넓이는 제곱으로 커지므로, 예전처럼 0.87 까지 가면
     넓이가 4.7배 되는 동안 정원은 2.6배밖에 안 늘어 보드가 휑해진다 */
  EXPAND_SCALE: [0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70],
  /* 초반만 약 2배·배율 ×4 안팎. 끝(7.5만)은 그대로 */
  EXPAND_COSTS: [180, 750, 3200, 11000, 28000, 75000],
  /* 확장 단계마다 보드에 둘 수 있는 글자 수. 넓이만 늘고 상한이 그대로면
     확장을 살 이유가 약하다. 자리와 정원이 같이 늘어야 한다.
     한 단계에 네 개씩 고르게 늘린다.

     정원은 낱글자를 세는 수다. 뜻이 있는 단어가 되면 몇 글자짜리든 한 칸으로
     친다 (board.js 의 count). 그래서 시작 정원 20개는 "낱글자 20개" 이자
     "네 글자 단어 스무 개" 이기도 하다 — 만들수록 자리가 넓어진다 */
  BOARD_MAX: [20, 24, 28, 32, 36, 40, 44],

  /* --- 힌트권 ---
     힌트는 재화로 직접 사지 않는다. 먼저 힌트권을 사 두고 도감에서 장수로 낸다.
     값은 한 장 살 때마다 TICKET_STEP 만큼 꼬박꼬박 오른다. 지수로 올리면
     후반에 손댈 수 없이 비싸지고, 안 올리면 남는 돈으로 도감을 통째로 사 버린다.
     사이에 한 겹을 두면 "지금 한 장을 어디에 쓸까" 를 고민하게 된다. */
  TICKET_BASE: 100,
  TICKET_STEP: 20,
  TICKET_PACKS: [1],           // 구매창에서 한 번에 집을 수 있는 묶음

  /* 도감 힌트 단계별로 내야 하는 장수
     1장: 첫 글자 + 갈래 / 3장: 짧은 설명 / 5장: 철자 대부분 */
  HINT_TICKETS: [1, 3, 5],

  OFFLINE_CAP: 7200,     // 오프라인 수입 인정 최대 초 (2시간)
  OFFLINE_RATE: 0.1,     // 그동안 벌었을 액수의 이 비율만 준다
  IDLE_AFTER: 60,        // 이만큼 손대지 않으면 켜 둔 채로도 방치로 넘어간다 (1분)

  /* --- 별이 떨구는 힌트권 ---
     STAR 는 힌트를 대신 밝혀 주지 않는다. 힌트권을 하나 떨어뜨릴 뿐이고,
     무엇에 쓸지는 플레이어가 도감에서 정한다. 다만 가만히 두면 사라진다 —
     보고 있어야 얻는 것이 하나쯤은 있어야 화면을 켜 둘 이유가 생긴다. */
  TICKET_DROP_LIFE: 15,  // 떨어진 힌트권은 이 시간 안에 주워야 한다

  /* --- 보석 ---
     GOLD·RUBY·DIAMOND·EMERALD 넷은 하는 일이 똑같다. 만들어서 가게에 가져가면
     목돈이 된다, 그 한 줄이 전부다. 개체마다 품질이 달랐던 때가 있었는데
     같은 단어를 만들고도 값이 달라 손해 본 기분만 남았다. 지금은 철자가 길수록
     비싸다는 것 하나로 값이 정해진다. */
  GEM_PRICE: 250,        // 매입가 = 이 값 × 글자 수
  /* --- 장치에 대고 넣는 시간 ---
     BOX · FORGE · HAMMER · SHOP · CRAFT 등 "올려 두고 기다리는" 것은 전부 이 값.
     앞으로 비슷한 장치를 만들어도 여기만 본다. */
  DEVICE_HOLD: 1,

  BOX_HOLD: 1,           // = DEVICE_HOLD (하위 호환)
  GEM_HOLD: 1,
  HAMMER_HOLD: 1,
  UP_HOLD: 1,
  CRAFT_HOLD: 1,

  /* --- 화재 --- */
  IGNITE_TIME: 5,        // 이만큼 붙어 있으면 불이 옮는다
  BURN_LIFE: 15,         // 불이 붙은 채 이만큼 지나면 사라진다 (TREE 는 COAL 로)

  /* --- 무르익음 ---
     짝이 곁에 있으면 천천히 익는다. 글자는 절대 바뀌지 않는다 —
     빛깔이 변하고 벌이가 오를 뿐이다. 한번 익은 것은 되돌아가지 않는다.
     불에 익히는 것만은 다 익은 뒤에도 놔두면 타 버리니 제때 빼내야 한다.

     둘의 배수가 다른 것은 무릅쓰는 것이 다르기 때문이다. 고기는 25초를
     지켜보다 제때 빼내야 하고 늦으면 통째로 잃는다. 씨앗은 물만 대 두면
     90초 뒤에 저절로 익고 잃을 일이 없다. 위험이 없으면 값도 작아야 한다 */
  RIPE_MEAT: 2.5,        // 불에 구워 익힌 것 (타면 잃는다)
  RIPE_SEED: 1.5,        // 물을 받아 저절로 익은 것 (위험 없음)
  COOK_TIME: 25,         // 고기가 다 익는 데 걸리는 시간
  GROW_TIME: 90,         // 씨앗이 싹트는 데 걸리는 시간
  OVERCOOK_BURN: 20,     // 다 익은 뒤에도 불 옆에 이만큼 두면 타 버린다

  /* --- 능력의 세기 ---
     설명문에는 "조금 · 크게" 로만 적는다. 실제 값은 여기에만 있다.
     화면에 찍을 때는 배수(×1.25)가 아니라 증감 %( +25% ) 로 읽힌다. */
  SUN_HASTE: 1.25,       // 곁의 벌이 주기 −20% (20초 → 16초)
  MOON_INCOME: 1.25,     // 곁의 벌이 액수 +25%
  FISH_INCOME: 2,        // 물 곁이면 +100%, 물이 없으면 0
  CAT_BOX: 2,            // 고양이가 들어앉은 상자 +100% 속도
  CAT_BOX_SLOTS: 2,      // 그때 상자에 더 넣을 수 있는 낱글자 수
  LUCKY_INCOME: 2.5,     // 행운이 깃든 동안 +150%
  LUCKY_TIME: 20,        // 행운이 머무는 시간(초)

  /* --- 숯과 불 ---
     불은 위험하기만 하고 벌이와는 상관이 없었다. 숯을 물려 두면 그 한 쌍이
     보드에서 가장 잘 버는 자리가 된다 — 대신 불을 곁에 끼고 살아야 하고,
     숯은 타 없어지는 소모품이라 계속 다시 만들어 넣어야 한다. */
  COAL_PAIR: 3,          // 불과 숯이 붙어 있으면 둘 다 이만큼 번다
  COAL_STOKE: 2,         // 그 불이 굽고 옮아붙는 속도
  COAL_LIFE: 900,        // 불 곁에서 이만큼 버티면 숯이 다 탄다 (15분)

  /* --- 은행 ---
     들어오는 돈의 일부를 금고로 돌렸다가 주기마다 이자를 얹어 돌려준다.
     금고에 한도를 둔 것은, 한도가 없으면 후반에 은행 하나가 다른 모든 단어를
     합친 것보다 크게 벌기 때문이다. 한도에 닿으면 더 떼어 가지 않는다 —
     "맡긴 돈이 묶여 있다" 는 느낌만 남기고 손해는 남기지 않는다.

     금고 시계는 **보고 있는 동안에만** 간다. 자리를 비우면 그 자리에서 멈추고,
     돌아오면 멈춘 데서 이어 간다 (맡긴 돈이 사라지지는 않는다).
     방치 중에도 이자가 굴러가면 은행은 "세워 두고 잊는" 단어가 되는데,
     은행은 원래 화면을 켜 두고 굴리는 쪽에 값을 쳐 주려고 만든 단어다.

     그 대신 이자를 10% 에서 50% 로 올렸다. 실제로 손에 들어오는 양은
     "떼어 가는 비율 × 이자" 로 정해지는데(주기와는 상관없다), 10%×10% 면
     전체 벌이의 1% — 한 칸을 내주고 받기에는 너무 적었다. 지금은 5% 로,
     자리 하나가 벌어야 할 몫과 얼추 맞는다 */
  BANK_CUT: 0.1,         // 들어오는 돈에서 금고로 돌리는 비율
  BANK_PERIOD: 600,      // 이 주기로 한꺼번에 돌려준다 (10분, 보는 동안만 흐른다)
  BANK_RATE: 0.5,        // 붙는 이자
  BANK_RATE_EXTRA: 0.05, // 은행이 한 채 늘 때마다 이자에 더해지는 몫
  BANK_VAULT_MAX: 5000,  // 은행 한 채가 맡아 주는 최대 액수
  /* 둘째 은행부터는 이자만 +5%p 인데, 금고가 5000w 로 묶여 있으면 그 +5%p 는
     한 주기에 250w — 아무 네 글자 단어보다도 못하다. 자리를 한 칸 더 내주는 값이
     안 나오면 둘째 은행은 존재하지 않는 것과 같다. 그래서 은행이 늘면 금고도
     같이 넓어진다. 셋까지만 세는 것은 은행으로 보드를 도배하지 못하게 하려는 것 */
  BANK_STACK_MAX: 3,

  /* --- 상자 ---
     저절로 글자를 빨아들이던 때가 있었는데, 그러면 플레이어가 할 일이 없고
     쓸 만한 글자까지 상자가 먼저 채 갔다. 지금은 직접 끌어다 넣어야 한다.
     넣은 글자는 보드에서 빠지니 정원이 한 칸 도로 생긴다 — 쓸모없는 글자를
     치우는 곳이자, 치운 값을 쳐 주는 곳이다. 꺼내려면 KEY 가 있어야 한다. */
  BOX_SLOTS: 6,          // 한 상자에 넣을 수 있는 낱글자 수
  BOX_PER_LETTER: 3,     // 넣은 낱글자 하나가 20초마다 쌓는 값
  KEY_HOLD: 1,           // 열쇠를 상자에 이만큼 대고 있으면 열린다(초)

  /* --- 시간과 시계 ---
     생성 간격을 줄이는 길이 업그레이드 말고 둘 더 있다.
     TIME 은 팔아 없애는 대신 영영 줄이고(쌓인다), CLOCK 은 보드에 서 있는 동안만
     줄인다(자리를 내준다). 어느 쪽이든 SPAWN_FLOOR 밑으로는 내려가지 않는다 —
     글자가 쏟아지기 시작하면 무엇을 만들지 고르는 재미가 사라진다. */
  TIME_CUT: 0.5,         // TIME 을 하나 팔 때마다 영구히 줄어드는 초
  CLOCK_CUT: 0.5,        // 보드에 서 있는 CLOCK 하나가 줄여 주는 초
  SPAWN_FLOOR: 10,       // 아무리 줄여도 이보다 빨라지지 않는다

  HOUSE_ROOM: 3,         // 집 한 채가 늘려 주는 정원

  /* --- 망치 ---
     보석은 만들기만 하면 값이 정해져 있어 손댈 것이 없었다. 망치를 두면
     "그냥 팔까, 한 번 두드려 볼까" 하는 물음이 하나 생긴다.
     보석 하나에 한 번뿐이라, 두드려서 깎였다고 다시 두드릴 수는 없다.

     아래쪽이 얼마나 아픈가로 이 물음의 무게가 정해진다. 0.8 이면 평균이 ×1.4 라
     그냥 다 두드리는 것이 정답이고, 0.5 면 반토막이 무서워 손이 안 나간다.
     그래서 아래를 0.5(−50%)로 둔다 — 평균은 ×1.25 */
  HAMMER_MIN: 0.5,       // 새로 매겨지는 값의 아래쪽 (−50%)
  HAMMER_MAX: 2,         // 위쪽 (+100%, 평균 ×1.25)
  HAMMER_STEP: 0.1,      // 눈금. ×1.29 같은 값이 나오지 않게 끊어서 뽑는다
  HAMMER_COST: 100,      // 한 번 두드릴 때마다 내는 값

  /* --- 사건이 주는 돈 ---
     BEE 의 꿀이나 DOG 이 파낸 것 같은 일회성 보상이다.

     기준은 "지금까지 번 돈" 이 아니라 "이 보드가 지금 20초에 벌어들이는 액수"다.
     평생 수입에 비례시키면 오래 켜 둘수록 사건이 커지는 눈덩이가 되고,
     고정 액수로 두면 초반에는 크고 나중에는 없느니만 못해진다.
     지금 굴러가는 벌이에 붙여 두면 어느 때에 만들어도 값이 비슷하게 느껴진다.

     비율을 30% 로 두었던 때에는 다 키운 보드에서 BEE 한 마리가 20초에 90w 씩,
     보통 단어 열 개 몫을 벌었다. 사건은 가끔 터져서 반가운 것이지
     보드의 벌이가 되어서는 안 된다 — 지금은 잘 쓰면 보통 단어 서너 개 몫이다 */
  EVENT_CUT: 0.1,        // 20초 벌이의 10%
  EVENT_FLAT: 10,        // 보드가 아직 작을 때를 받쳐 주는 최소분
  DOG_LETTER: 0.05,      // 개가 판 것이 낱글자일 확률 (아니면 EVENT_CUT 만큼의 돈)

  /* --- 가게 잔돈 ---
     바닥에 떨구지 않고 바로 들어온다. 주울 일 없는 잔돈은 MOUSE 자리를
     뺏지 않고, 가게가 서 있는 것만으로 가는 잔여 수입이다. */
  SHOP_COIN_MIN: 5,
  SHOP_COIN_MAX: 30,

  /* --- 바닥에 떨어진 잔돈 (예전 저장·기타용) --- */
  COIN_DROP_LIFE: 20,
  COIN_VALUE: 0.2,
  COIN_FLAT: 5,

  /* --- 강화 (FORGE) ---
     보통 단어에 도박을 건다. 성공하면 그 단어 하나가 영영 더 벌고,
     실패하면 글자까지 통째로 사라진다. 3강까지 올리려면 세 번을 다 이겨야 하고
     기대값은 1강에서만 넉넉하다 — 어디서 멈출지가 이 단어의 놀이다. */
  UP_ODDS: [0.85, 0.60, 0.30],   // 1·2·3강 성공 확률
  UP_MUL: [1.25, 1.5, 2],        // 성공했을 때의 영구 벌이 배수

  /* --- 서로 밀어내는 거리 ---
     PUSH_SHRINK 만큼은 파고들 수 있다. 0 이면 글자 상자가 닿기만 해도 밀려나서
     보드가 실제보다 빽빽하게 느껴진다.
     자석끼리만은 같은 극처럼 군다 — 보통 거리의 MAGNET_PUSH 배로 밀어낸다. */
  PUSH_SHRINK: 7,
  MAGNET_PUSH: 3,

  /* 유령은 아무도 보지 않을 때만 움직인다. 자리를 비운 동안의 몫(OFFLINE_RATE)에
     한 마리마다 이만큼 더해진다 — 보드를 지키고 있으면 아무 일도 하지 않으니,
     켜 두고 보는 쪽이 언제나 이득이라는 규칙은 그대로다.
     네 마리까지만 센다. 그 위로는 보드를 유령으로 도배하는 것이 답이 된다 */
  GHOST_OFFLINE: 0.05,
  GHOST_MAX: 4,

  /* --- 톱니바퀴 ---
     이가 맞물리려면 그냥 가까운 정도로는 안 되고 거의 겹치도록 붙여야 한다.
     중심 사이 거리로 재는 것은 이때뿐이다. 톱니 폭만큼으로 잡아 두면
     위·아래·좌·우 넷까지만 물릴 수 있고 대각선은 닿지 않는다.

     물린 톱니 하나마다 벌이가 **곱절**이 된다. 한때 +50% 씩 더하는 것으로
     바꿔 보았는데, 그러면 톱니를 넷 물려도 ×3 이라 그냥 아무 단어 넷을 세우는
     것과 크게 다르지 않았다 — 자리를 몰아 짜 맞춘 보람이 없다.
     곱절로 돌리는 대신 물릴 수 있는 수를 넷에서 **셋**으로 줄였다.
     넷이면 가운데 톱니 하나가 ×16 이라 그 한 칸이 보드의 나머지를 다 합친 것보다
     컸는데, 셋이면 ×8 — 여전히 가장 짜임새 있는 한 벌이지만 판을 삼키지는 않는다.
     (셋으로 줄었으니 십자로 짜던 것을 이제 T 자로 짠다) */
  GEAR_MESH: 70,         // 중심 사이가 이 안쪽이면 맞물린 것으로 본다
  GEAR_MAX: 3,           // 하나에 물릴 수 있는 톱니 수
  GEAR_MUL: 2,           // 맞물린 톱니 하나마다 곱해지는 값

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
  STAR_HOLD: 1.0,        // 강화 별이 붙은 단어에 더 붙일 때 (초)

  /* --- 판매 (보드 밖으로 끌어내 놓기) --- */
  VOWEL_RATE: 0.06,      // 모음 한 개당 생성 확률
  /* 보드에 같은 글자가 한 장 있을 때마다 그 글자가 뽑힐 무게에 곱해진다.
     아주 살짝만 깎는다 — 세게 깎으면 안 가진 글자가 순서대로 배급되어
     Q·Z 가 흔해지고 빈도표를 둔 뜻이 사라진다 (자세한 것은 G.randomLetter) */
  REPEAT_DAMP: 0.75,
  REPEAT_DAMP_MAX: 5,    // 다섯 장 넘게 쌓여도 더는 깎지 않는다 (0.75^5 ≈ 0.24)
  SELL_MARGIN: 22,       // 이만큼 밖으로 나가면 판매 대상
  EDGE_RESIST: 0.34,     // 경계를 넘을 때 따라오는 비율 (낮을수록 뻑뻑하다)
  EDGE_MAX: 96,          // 경계 밖으로 끌려나올 수 있는 최대 거리
  SELL_COOLDOWN_CUT: 0.5,// 판매하면 남은 생성 쿨다운이 이 비율로 줄어든다

  START_LETTERS: 8
};

/**
 * 지금 보드에 둘 수 있는 최대 개수.
 * 확장 단계가 바닥을 정하고, 세워 둔 HOUSE 가 그 위에 자리를 얹는다 —
 * 돈으로 사는 확장 말고 글자로 늘리는 길을 하나 둔 것이다.
 * 집이 타서 무너지면 늘었던 자리도 같이 사라진다.
 */
/** 은행이 맡아 주는 총액. 은행이 늘면 이자와 함께 금고도 넓어진다 */
G.vaultMax = function (banks) {
  return G.C.BANK_VAULT_MAX * Math.min(G.C.BANK_STACK_MAX, banks || 0);
};

/** 은행이 여러 채면 이자가 조금씩 더 붙는다 (넷까지 센다) */
G.bankRate = function (banks) {
  if (!banks) return 0;
  return G.C.BANK_RATE + G.C.BANK_RATE_EXTRA * (Math.min(G.C.BANK_STACK_MAX, banks) - 1);
};

G.maxEntities = function () {
  var m = G.C.BOARD_MAX;
  var lv = G.state ? G.state.expandLevel : 0;
  return m[Math.max(0, Math.min(lv, m.length - 1))] + G.houseRoom();
};

/** HOUSE 가 늘려 주는 자리 */
G.houseRoom = function () {
  if (!G.board || !G.board.all) return 0;
  var list = G.board.all(), n = 0;
  for (var i = 0; i < list.length; i++) {
    if (list[i].type === 'word' && list[i].text === 'HOUSE' && !list[i].burning) n++;
  }
  return n * G.C.HOUSE_ROOM;
};

/**
 * 단어가 한 번에 버는 재화.
 * 3글자를 기본 4 로 두고, 글자가 하나 늘 때마다 2배.
 *   3글자 4 · 4글자 8 · 5글자 16 · 6글자 32 · 7글자 64 · 8글자 128
 * 능력 단어도 보통 단어와 똑같은 값을 받는다. 능력은 벌이가 아니라 행동으로 드러낸다.
 */
/** 다음 한 장의 값. 지금까지 산 총 장수를 따라 꼬박꼬박 오른다 */
G.ticketPrice = function (bought) {
  if (bought === undefined) bought = (G.state && G.state.ticketsBought) || 0;
  return G.C.TICKET_BASE + G.C.TICKET_STEP * bought;
};

/** n 장을 한꺼번에 살 때의 값 (값이 오르는 중이므로 그냥 곱하면 안 된다) */
G.ticketPack = function (n, bought) {
  if (bought === undefined) bought = (G.state && G.state.ticketsBought) || 0;
  return n * G.C.TICKET_BASE + G.C.TICKET_STEP * (n * bought + n * (n - 1) / 2);
};

/** 힌트 단계 lv(0부터) 를 열려면 내야 하는 힌트권 장수. 다 열었으면 0 */
G.hintTickets = function (lv) {
  return lv < G.C.HINT_TICKETS.length ? G.C.HINT_TICKETS[lv] : 0;
};

G.HINT_MAX = G.C.HINT_TICKETS.length;

/** 힌트 3단계에서 드러내는 철자 수 — 끝 한두 글자는 남겨 둔다 */
G.hintReveal = function (len) {
  return Math.max(1, Math.min(len - 1, Math.ceil(len * 0.6)));
};

G.wordValue = function (len, mult) {
  if (len < G.C.MIN_WORD_LEN) return 0;
  var v = G.C.PAY_WORD_BASE
    * Math.pow(G.C.PAY_GROWTH, len - G.C.MIN_WORD_LEN)
    * (mult === undefined ? 1 : mult);
  return Math.max(0, Math.round(v));
};

/* ==========================================================================
   능력 단어 — 한 단어에 능력 하나
   --------------------------------------------------------------------------
   능력을 하는 일로 묶으면 이렇게 된다. 같은 칸에 둘이 들어가지 않도록 짰다.

   벌이를 키운다    MOON(한 번에 더) · SUN(더 자주) · LUCK(가끔 하나에게 한동안)
                    GEAR(맞물린 수만큼) · GHOST(자리를 비운 동안)
                    FORGE(도박을 걸어 영구히) · HAMMER(보석값을 다시 매긴다)
   목돈을 만든다    보석 넷을 SHOP 에 넘긴다 · BANK 가 이자를 붙인다
                    BEE 가 꿀을, DOG 이 땅속에서 찾아온다
                    BOX 에 넣어 쌓고(CAT 이 불린다) KEY 로 연다
   글자를 늘린다    TREE(떨군다) · BIRD(물어 온다) · WIND(다음 글자를 앞당긴다)
   글자를 빨리 받는다 TIME(팔아 영구히) · CLOCK(세워 두는 동안)
   자리를 넓힌다    HOUSE(정원을 늘린다) · BOX(넣으면 자리가 빈다)
   자리를 나눈다    ROCK(아무도 넘어가지 못한다)
   글자를 섞는다    CRAFT(같은 글자 AA → 다른 글자 둘)
   글자를 고른다    MAGNET(쥐고 다니며 모음만 끌어모은다) · ICE(얼려 세움)
                    PEN(버려서 원하는 글자를 고른다)
   무르익힌다       MEAT + FIRE(타기 전에 빼야 한다) · SEED + 물(위험 없음)
   불               FIRE(옮아붙는다) · COAL(거세지고 둘 다 크게 번다) · WATER(끈다)
   자리를 잘 잡는다 FISH(물 곁이라야 번다)
   바닥에 떨어진 것 STAR 가 힌트권을 떨군다 — MOUSE 가 주워 온다
                    SHOP 은 잔돈을 바로 준다
   ========================================================================== */
G.WORDS = [

  /* ------------------------------------------------------------------
     하늘
     ------------------------------------------------------------------ */
  {
    id: 'SUN', kind: '자연', tags: [],
    desc: '곁의 단어들이 돈을 더 자주 번다.',
    hint: '낮에 뜬다',
    color: { fg: '#b3760a', bd: '#f2d38a' },
    anim: 'pulse', fx: 'ray',
    motion: null
  },
  {
    id: 'MOON', kind: '자연', tags: [],
    desc: '곁의 단어들이 한 번에 더 많이 번다.',
    hint: '밤에 뜬다',
    color: { fg: '#5a5f86', bd: '#c3c7e2' },
    anim: 'float', fx: 'wisp',
    motion: null
  },
  {
    id: 'STAR', kind: '자연', tags: [],
    desc: '아주 가끔 곁에 힌트권을 떨어뜨린다. 오래 두면 사라진다.',
    hint: '반짝이고 멀다',
    color: { fg: '#8a7a2e', bd: '#e6dca0' },
    anim: 'pulse', fx: 'sparkle',
    motion: null,
    act: 'star', actChance: 0.02
  },
  {
    id: 'WIND', kind: '자연', tags: [],
    desc: '가끔 돌풍을 일으켜 가벼운 것을 밀고, 다음 글자를 앞당긴다.',
    hint: '불어온다',
    color: { fg: '#6b7f8a', bd: '#c6d5db' },
    anim: 'float', fx: 'swirl',
    motion: { min: 9, max: 17, range: 130 },
    act: 'gust', actChance: 0.8
  },

  /* ------------------------------------------------------------------
     물
     ------------------------------------------------------------------ */
  {
    id: 'WATER', kind: '자연', tags: ['wet'],
    desc: '곁에서 타고 있는 불을 끈다. 불을 끌 수 있는 유일한 단어다.',
    hint: '고여 있다',
    color: { fg: '#1d6fa5', bd: '#9dc9e4' },
    anim: 'wave', fx: 'drop',
    motion: { min: 14, max: 26, range: 70 }
  },
  {
    id: 'ICE', kind: '자연', tags: ['cold', 'wet'],
    desc: '주변을 얼려 움직임을 크게 줄인다. FISH·SEED 에게는 물이기도 하다.',
    hint: '차갑다',
    color: { fg: '#3a8fb0', bd: '#b6e0ee' },
    anim: 'pulse', fx: 'frost',
    motion: { min: 30, max: 52, range: 40 }
  },

  /* ------------------------------------------------------------------
     불과 땅
     ------------------------------------------------------------------ */
  {
    id: 'FIRE', kind: '자연', tags: ['hot'],
    desc: '잘 타는 것에 5초 붙어 있으면 불이 옮는다. MEAT 를 굽는 길이기도 하다.',
    hint: '뜨겁고 위험하다',
    color: { fg: '#c2410c', bd: '#f0b18a' },
    anim: 'shake', fx: 'ember',
    motion: { min: 8, max: 16, range: 84 },
    bonds: [{ with: '#burnable', range: 116, time: G.C.IGNITE_TIME, key: 'ignite' }]
  },
  {
    id: 'COAL', kind: '재료', tags: [],
    desc: 'FIRE 곁에 두면 둘 다 크게 벌고 불도 세진다. 오래 두면 재가 된다.',
    hint: '까맣게 타고 남은 것',
    color: { fg: '#3f3b38', bd: '#b0aaa4' },
    anim: 'still', fx: null,
    motion: null, heavy: true
  },
  /* ------------------------------------------------------------------
     풀
     ------------------------------------------------------------------ */
  {
    id: 'TREE', kind: '자연', tags: ['plant'],
    desc: '아주 가끔 낱글자를 떨어뜨린다. 불에 타면 COAL 이 된다.',
    hint: '자란다',
    color: { fg: '#2f7a43', bd: '#a8d6b0' },
    anim: 'hop', fx: 'leaf',
    motion: { min: 40, max: 72, range: 30 },
    flammable: true,
    act: 'tree', actChance: 0.03
  },
  {
    id: 'SEED', kind: '자연', tags: ['plant'],
    desc: '물 곁에 두면 싹이 터서 벌이가 오른다.',
    hint: '심으면 자란다',
    color: { fg: '#5f7a34', bd: '#c6daa4' },
    anim: 'pulse', fx: null,
    motion: null, flammable: true
  },
  {
    id: 'BEE', kind: '동물', tags: ['animal'],
    desc: 'TREE 곁에 눌러앉아 꿀을 모아 이따금 목돈을 안긴다.',
    hint: '윙윙거린다',
    color: { fg: '#8a6a12', bd: '#e6cf86' },
    anim: 'shake', fx: null,
    motion: { min: 4, max: 9, range: 124 },
    act: 'bee', actChance: 0.6
  },

  /* ------------------------------------------------------------------
     살림
     ------------------------------------------------------------------ */
  {
    id: 'BOX', kind: '사물', tags: [],
    desc: '낱글자를 넣으면 자리가 비고, 넣은 글자만큼 값이 쌓인다. 상자는 스스로 벌지 않는다. 꺼내려면 KEY 를 올려 둔다.',
    hint: '무언가 담는 것',
    color: { fg: '#8d6a3f', bd: '#dcc49a' },
    anim: 'still', fx: null,
    motion: null, heavy: true, flammable: true
  },
  {
    id: 'KEY', kind: '사물', tags: ['metal'],
    desc: 'BOX 위에 올려 두면 쌓인 값을 꺼낸다. 열쇠만 부러지고 상자는 다시 쓸 수 있다.',
    hint: '무언가 여는 것',
    color: { fg: '#96762c', bd: '#ddcb97' },
    anim: 'still', fx: null,
    motion: { min: 20, max: 36, dist: 64 }
  },
  {
    id: 'MAGNET', kind: '사물', tags: ['metal'],
    desc: '쥐고 다닐 때만 흩어진 모음을 끌어당긴다.',
    hint: '끌어당긴다',
    color: { fg: '#9c3f4e', bd: '#e2a9b3' },
    anim: 'pulse', fx: 'field',
    motion: { min: 34, max: 56, range: 40 }
  },
  {
    id: 'GEAR', kind: '사물', tags: ['metal'],
    desc: '혼자도 벌고, 다른 GEAR 와 맞물리면 벌이가 크게 오른다.',
    hint: '맞물려 돌아간다',
    color: { fg: '#5c5750', bd: '#cbc5bb' },
    anim: 'tick', fx: null,
    motion: null, heavy: true
  },
  {
    id: 'FORGE', kind: '사물', tags: [],
    desc: '보통 단어를 달구어 두들긴다. 성공하면 영영 더 벌고, 실패하면 사라진다.',
    hint: '쇠를 달구는 곳',
    color: { fg: '#7a4f9c', bd: '#cdb2e2' },
    anim: 'pulse', fx: null,
    motion: null, heavy: true
  },
  {
    id: 'HAMMER', kind: '사물', tags: ['metal'],
    desc: '보석 위로 끌어다 대면 값을 다시 매긴다. 한 번에 100w. 깎일 수도 오를 수도 있다. 한 번뿐이다.',
    hint: '두드린다',
    color: { fg: '#6b5344', bd: '#cfbba9' },
    anim: 'still', fx: null,
    motion: null, heavy: true
  },
  {
    id: 'CLOCK', kind: '사물', tags: ['metal'],
    desc: '세워 두면 다음 글자가 오는 간격이 짧아진다.',
    hint: '시간을 알린다',
    color: { fg: '#4d4b47', bd: '#cdc9c2' },
    anim: 'tick', fx: null,
    motion: null
  },
  {
    id: 'HOUSE', kind: '사물', tags: ['building'],
    desc: '글자를 둘 수 있는 자리가 3개 늘어난다.',
    hint: '사는 곳',
    color: { fg: '#8a5a3c', bd: '#dcbfa4' },
    anim: 'still', fx: null,
    motion: null, heavy: true, flammable: true
  },
  {
    id: 'ROCK', kind: '사물', tags: ['building'],
    desc: '움직이지 않고, 다른 것도 이 앞을 지나가지 못한다.',
    hint: '가로막는 것',
    color: { fg: '#6b6257', bd: '#cfc6b8' },
    anim: 'still', fx: null,
    motion: null, heavy: true, solid: true
  },
  {
    id: 'CRAFT', kind: '사물', tags: [],
    desc: '같은 글자 둘을 합쳐(AA) 넣으면 다른 글자 둘로 바꾼다. 넣은 글자는 다시 나오지 않는다.',
    hint: '만든다',
    color: { fg: '#6a4a2e', bd: '#d4b896' },
    anim: 'still', fx: null,
    motion: null, heavy: true
  },

  /* ------------------------------------------------------------------
     짐승
     ------------------------------------------------------------------ */
  {
    id: 'CAT', kind: '동물', tags: ['animal'],
    desc: 'BOX 에 들어앉아 값이 쌓이는 속도와 넣을 수 있는 글자 수를 올린다.',
    hint: '야옹',
    color: { fg: '#7c6a55', bd: '#d8cbb9' },
    anim: 'hop', fx: null,
    motion: { min: 5, max: 11, range: 118 }
  },
  {
    id: 'DOG', kind: '동물', tags: ['animal'],
    desc: '가끔 땅을 파서 돈을 — 어쩌다 낱글자를 — 물어 온다.',
    hint: '멍멍',
    color: { fg: '#8a6a3c', bd: '#dcc6a0' },
    anim: 'hop', fx: null,
    motion: { min: 7, max: 14, range: 104 },
    act: 'dog', actChance: 0.4
  },
  {
    id: 'BIRD', kind: '동물', tags: ['animal'],
    desc: '아주 가끔 낱글자를 하나 물고 돌아온다.',
    hint: '난다',
    color: { fg: '#3c7f95', bd: '#a9d3de' },
    anim: 'float', fx: null,
    motion: { min: 4, max: 9, range: 150 },
    act: 'bird', actChance: 0.03
  },
  {
    id: 'FISH', kind: '동물', tags: ['animal'],
    desc: '물 곁에서만 번다. 물이 없으면 한 푼도 못 번다.',
    hint: '헤엄친다',
    color: { fg: '#2b7f7a', bd: '#a5d8d4' },
    anim: 'wave', fx: null,
    motion: { min: 5, max: 10, range: 92 }
  },
  {
    id: 'MOUSE', kind: '동물', tags: ['animal'],
    desc: '바닥에 떨어진 힌트권·잔돈을 대신 주워 온다.',
    hint: '작고 빠르다',
    color: { fg: '#7a7269', bd: '#d6d0c7' },
    anim: 'shake', fx: null,
    motion: { min: 5, max: 10, range: 112 }
  },

  /* ------------------------------------------------------------------
     먹을 것
     ------------------------------------------------------------------ */
  {
    id: 'MEAT', kind: '재료', tags: [],
    desc: 'FIRE 곁에서 익으면 벌이가 크게 오른다. 너무 오래 두면 탄다.',
    hint: '짐승이 좋아한다',
    color: { fg: '#98453f', bd: '#e4b3ae' },
    anim: 'still', fx: null,
    motion: { min: 40, max: 70, range: 30 },
    flammable: true
  },

  /* ------------------------------------------------------------------
     보석
     ------------------------------------------------------------------ */
  {
    id: 'GOLD', kind: '보석', tags: ['metal', 'gem'],
    desc: 'SHOP 에 올리면 목돈이 된다.',
    hint: '반짝이고 비싸다',
    color: { fg: '#a07a12', bd: '#e8cf80' },
    anim: 'pulse', fx: 'sparkle',
    motion: { min: 26, max: 48, range: 42 }
  },
  {
    id: 'RUBY', kind: '보석', tags: ['gem'],
    desc: 'SHOP 에 올리면 목돈이 된다.',
    hint: '붉게 빛난다',
    color: { fg: '#a3323f', bd: '#e8a8b0' },
    anim: 'pulse', fx: 'sparkle',
    motion: { min: 26, max: 48, range: 42 }
  },
  {
    id: 'DIAMOND', kind: '보석', tags: ['gem'],
    desc: 'SHOP 에 올리면 목돈이 된다. 글자가 길어 값이 크다.',
    hint: '가장 단단한 것',
    color: { fg: '#3f7f9a', bd: '#b4d9e6' },
    anim: 'pulse', fx: 'shine',
    motion: null, heavy: true
  },
  {
    id: 'EMERALD', kind: '보석', tags: ['gem'],
    desc: 'SHOP 에 올리면 목돈이 된다. DIAMOND 와 값이 같다.',
    hint: '푸르게 빛난다',
    color: { fg: '#1f7a55', bd: '#a4d9c0' },
    anim: 'pulse', fx: 'shine',
    motion: null, heavy: true
  },

  /* ------------------------------------------------------------------
     돈과 개념
     ------------------------------------------------------------------ */
  {
    id: 'BANK', kind: '경제', tags: ['building'],
    desc: '들어오는 돈 일부를 맡아 두었다가 이자를 얹어 내준다. ' +
      '원금은 더블클릭으로 당장 찾을 수 있다.',
    hint: '돈을 맡기는 곳',
    color: { fg: '#2f6b52', bd: '#a6d3bd' },
    anim: 'still', fx: null,
    motion: null, heavy: true
  },
  {
    id: 'SHOP', kind: '경제', tags: ['building'],
    desc: '보석을 글자당 250w 에 사들인다. 가끔 잔돈을 바로 준다.',
    hint: '물건을 파는 곳',
    color: { fg: '#8a4a86', bd: '#dcb4da' },
    anim: 'still', fx: null,
    motion: { min: 45, max: 70, range: 28 },
    flammable: true,
    act: 'change', actChance: 0.3
  },
  {
    id: 'PEN', kind: '사물', tags: [],
    desc: '보드 밖으로 버리면 원하는 글자 하나를 고를 수 있다. 보드가 가득이면 버릴 수 없다.',
    hint: '쓴다',
    color: { fg: '#3d5a80', bd: '#b7c9de' },
    anim: 'still', fx: null,
    motion: { min: 28, max: 48, period: 40 },
    sellable: true
  },
  {
    id: 'TIME', kind: '개념', tags: [],
    desc: '팔면 글자 생성 간격이 영구히 짧아진다.',
    hint: '흘러간다',
    color: { fg: '#5c5a72', bd: '#c4c2d6' },
    anim: 'pulse', fx: null,
    motion: { min: 20, max: 34, range: 70 },
    sellable: true
  },
  {
    id: 'LUCK', kind: '개념', tags: [],
    desc: '가끔 곁의 단어 하나에 한동안 행운을 씌운다.',
    hint: '운이 좋다',
    color: { fg: '#3f8a6e', bd: '#a8dcc6' },
    anim: 'pulse', fx: 'sparkle',
    motion: { min: 12, max: 22, range: 96 },
    act: 'luck', actChance: 0.3
  },
  {
    id: 'GHOST', kind: '개념', tags: [],
    desc: '자리를 비운 동안 모이는 돈이 늘어난다. 보고 있으면 일하지 않는다.',
    hint: '통과한다',
    color: { fg: '#6d6f86', bd: '#cdcedd' },
    anim: 'float', fx: 'wisp',
    motion: { min: 6, max: 12, range: 126 },
    ghost: true
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
/* BOX 는 넣은 글자로만 쌓는다 — 단어 자체 벌이는 없다 */
G.WORD_BY_ID.BOX.value = 0;

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
 *   자음 21개: 나머지 70% 를 영어 빈도 순서는 살리고, 격차는 줄여서 나눈다
 *
 * 실제 빈도 그대로면 T 가 Z 보다 오십 배 자주 나와 보드가 T·S·R 일색이 된다.
 * 그렇다고 균등하면 Q·X·Z 가 흔해져 쓰레기가 쌓인다. 그래서 영어 순서는
 * 지키되, 가장 흔한 것과 가장 드문 것의 무게 차이만 **1.5배** 로 눌러 둔다.
 */
G.VOWELS = 'AEIOU';
G.CONSONANTS = 'BCDFGHJKLMNPQRSTVWXYZ';

/* 영어 빈도 순서는 그대로, 최댓값/최솟값 = 1.5 (100…150) */
G.LETTER_WEIGHT = {
  T: 150, N: 137, S: 136, R: 136, H: 127, L: 123, D: 121, C: 116, M: 113, F: 112,
  W: 110, G: 110, P: 110, Y: 109, B: 108, V: 105, K: 103, X: 101, J: 100, Q: 100, Z: 100
};

/** 이 글자가 얼마나 쓸모 있는가. 모음은 늘 귀하므로 맨 위에 둔다 */
G.letterWeight = function (ch) {
  if (G.VOWELS.indexOf(ch) >= 0) return 999;
  return G.LETTER_WEIGHT[ch] || 1;
};

/**
 * 이미 굴러다니는 글자는 조금 덜 나오게 한다.
 *
 * 빈도표만 따르면 같은 글자가 한쪽에 몰린다. 그래서 보드에 한 장 있을 때마다
 * 무게에 REPEAT_DAMP 를 곱한다. 격차가 1.5배뿐이라 세게 깎을 필요는 없고,
 * 쏠림만 눅이면 된다.
 *
 * 단어로 굳은 글자는 세지 않는다. CRATE 안의 T 는 이미 제 할 일을 한 글자라
 * 손에 든 T 가 아니고, 그것까지 세면 단어를 만들수록 그 철자가 안 나온다.
 */
G.randomLetter = (function () {
  var WEIGHT = G.LETTER_WEIGHT;

  /** 보드에 굴러다니는 낱글자 수 (단어가 된 것은 빼고) */
  function loose() {
    var have = {};
    if (!G.board || !G.board.all) return have;
    var list = G.board.all();
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (e.type === 'word') continue;
      for (var k = 0; k < e.text.length; k++) {
        var ch = e.text.charAt(k);
        have[ch] = (have[ch] || 0) + 1;
      }
    }
    return have;
  }

  return function () {
    var C = G.C, have = loose();
    var vowel = Math.random() < G.VOWELS.length * C.VOWEL_RATE;
    var src = vowel ? G.VOWELS : G.CONSONANTS;
    var upto = [], total = 0, i, ch;
    for (i = 0; i < src.length; i++) {
      ch = src.charAt(i);
      var w = vowel ? 1 : (WEIGHT[ch] || 1);
      total += w * Math.pow(C.REPEAT_DAMP, Math.min(have[ch] || 0, C.REPEAT_DAMP_MAX));
      upto.push(total);
    }
    var r = Math.random() * total;
    for (i = 0; i < upto.length; i++) {
      if (r < upto[i]) return src.charAt(i);
    }
    return vowel ? 'E' : 'T';
  };
})();

/* ==========================================================================
   자세한 설명 — 도감에서 찾은 단어의 칸을 누르면 이쪽으로 바뀐다

   설명을 두 벌 쓰는 이유.
   desc 는 "무슨 일이 일어나는가" 만 적는다. 처음 보는 사람에게 ×1.25 니 42초니
   하는 숫자를 들이밀면 그 단어를 왜 만드는지가 도리어 안 보인다.
   그렇다고 숫자를 끝내 감추면, 어느 정도 굴려 본 사람은 SUN 과 MOON 중 무엇을
   먼저 세울지 같은 판단을 감으로만 해야 한다. 그래서 눌러야 나오게 두었다.

   여기 적힌 값은 전부 위의 상수와 behaviors.js 에서 실제로 쓰는 값이다.
   거리는 화면 점(px)이라 적어 봐야 감이 오지 않으므로 옮기지 않는다.
   ========================================================================== */
G.DETAIL = (function () {
  var C = G.C;
  var GEM4 = C.GEM_PRICE * 4, GEM7 = C.GEM_PRICE * 7;
  var SUN_CUT = Math.round((1 - 1 / C.SUN_HASTE) * 100);

  function boost(mul) {
    var p = Math.round((mul - 1) * 100);
    return (p > 0 ? '+' : '') + p + '%';
  }
  function cut(p, flat) {
    return '보드 20초 벌이의 ' + Math.round(p * 100) + '% + ' + flat + 'w';
  }
  function dice(id) {
    for (var i = 0; i < G.WORDS.length; i++) {
      if (G.WORDS[i].id === id) {
        return C.PAY_PERIOD + '초마다 ' + Math.round((G.WORDS[i].actChance || 0) * 100) + '% 로 ';
      }
    }
    return '';
  }

  return {
    SUN: '곁의 단어 벌이 주기가 ' + SUN_CUT + '% 짧아진다. 같은 단어에는 한 번만 걸린다.',
    MOON: '곁의 단어 벌이가 ' + boost(C.MOON_INCOME) + ' 된다. 같은 단어에는 한 번만 걸린다.',
    STAR: dice('STAR') + '힌트권 한 장을 떨군다. ' + C.TICKET_DROP_LIFE +
      '초 안에 주워야 한다.',
    WIND: dice('WIND') + '돌풍을 일으킨다. 다음 글자까지 남은 시간이 ' +
      Math.round((1 - C.WIND_CUT) * 100) + '% 당겨진다.',
    WATER: '곁의 불을 4.5초 대고 있으면 끈다.',
    ICE: '주변 움직임이 75% 줄어든다. FISH·SEED 에게는 물이기도 하다.',
    FIRE: '잘 타는 것을 ' + C.IGNITE_TIME + '초 곁에 두면 불이 옮는다. ' +
      '불이 붙은 채 ' + C.BURN_LIFE + '초면 사라진다. TREE 는 타고 나면 COAL 이 된다.',
    COAL: '곁의 FIRE 와 서로 벌이 ' + boost(C.COAL_PAIR) + '. 그 불은 굽고 옮는 속도가 ' +
      boost(C.COAL_STOKE) + '. 불 곁에서 ' + Math.round(C.COAL_LIFE / 60) +
      '분이면 재가 된다.',
    TREE: dice('TREE') + '낱글자를 하나 떨군다. 불에 타면 COAL 이 된다.',
    SEED: '물 곁에서 ' + C.GROW_TIME + '초에 걸쳐 자라 벌이 ' + boost(C.RIPE_SEED) + '.',
    BEE: dice('BEE') + 'TREE 곁에서 꿀을 턴다 — ' + cut(C.EVENT_CUT, C.EVENT_FLAT) + '.',
    BOX: '낱글자를 ' + C.BOX_HOLD + '초 대면 들어간다 (' + C.BOX_SLOTS + '개까지, CAT 곁이면 +' +
      C.CAT_BOX_SLOTS + '). 한 개마다 ' + C.PAY_PERIOD + '초에 ' + C.BOX_PER_LETTER +
      'w 쌓인다 (CAT 곁이면 ' + boost(C.CAT_BOX) + '). 상자 자체는 벌지 않는다. ' +
      '더블클릭으로 개수·쌓인 돈을 본다. 꺼내려면 KEY 를 상자 위에 ' +
      C.KEY_HOLD + '초 올린다.',
    KEY: 'BOX 위에 ' + C.KEY_HOLD + '초 올리면 열어 값을 전부 받는다. 열쇠만 부러진다.',
    MAGNET: '쥐고 움직일 때만 모음을 끌어당긴다. 자석끼리는 ' + C.MAGNET_PUSH + '배 거리로 밀어낸다.',
    GEAR: '혼자여도 네 글자 몫을 번다. 맞물린 GEAR 하나마다 벌이 ' + boost(C.GEAR_MUL) +
      ', ' + C.GEAR_MAX + '개까지 (최대 ' + boost(Math.pow(C.GEAR_MUL, C.GEAR_MAX)) + ').',
    FORGE: '보통 단어를 ' + C.UP_HOLD + '초 올려 두면 강화. ' +
      '1강 ' + Math.round(C.UP_ODDS[0] * 100) + '%(' + boost(C.UP_MUL[0]) + ') · ' +
      '2강 ' + Math.round(C.UP_ODDS[1] * 100) + '%(' + boost(C.UP_MUL[1]) + ') · ' +
      '3강 ' + Math.round(C.UP_ODDS[2] * 100) + '%(' + boost(C.UP_MUL[2]) + '). 실패하면 사라진다.',
    CAT: '곁의 BOX 쌓는 속도 ' + boost(C.CAT_BOX) + ', 넣을 수 있는 글자 +' +
      C.CAT_BOX_SLOTS + '.',
    DOG: dice('DOG') + '땅을 판다. ' + Math.round(C.DOG_LETTER * 100) +
      '% 는 낱글자, 나머지는 ' + cut(C.EVENT_CUT, C.EVENT_FLAT) + '.',
    BIRD: dice('BIRD') + '낱글자를 하나 물고 온다.',
    FISH: '물 곁이면 벌이 ' + boost(C.FISH_INCOME) + ', 없으면 0.',
    MOUSE: '떨어진 힌트권·잔돈을 주워 온다.',
    MEAT: 'FIRE 곁에서 ' + C.COOK_TIME + '초에 익어 벌이 ' + boost(C.RIPE_MEAT) +
      '. 그 뒤 ' + C.OVERCOOK_BURN + '초 더 두면 탄다. COAL 물린 불은 두 배로 빠르다.',
    GOLD: 'SHOP 에 ' + C.GEM_HOLD + '초면 ' + GEM4 + 'w.',
    RUBY: 'SHOP 에 ' + C.GEM_HOLD + '초면 ' + GEM4 + 'w.',
    DIAMOND: 'SHOP 에 ' + C.GEM_HOLD + '초면 ' + GEM7 + 'w.',
    EMERALD: 'SHOP 에 ' + C.GEM_HOLD + '초면 ' + GEM7 + 'w.',
    BANK: '들어오는 돈의 ' + Math.round(C.BANK_CUT * 100) + '% 를 금고로 돌렸다가 ' +
      Math.round(C.BANK_PERIOD / 60) + '분마다 이자 ' + Math.round(C.BANK_RATE * 100) +
      '% 를 얹어 내준다. 금고 ' + C.BANK_VAULT_MAX + 'w 까지. 은행 하나마다 이자 +' +
      Math.round(C.BANK_RATE_EXTRA * 100) + '%p · 금고 +' + C.BANK_VAULT_MAX +
      'w (' + C.BANK_STACK_MAX + '채까지). 더블클릭으로 원금만 당장 찾을 수 있다.',
    SHOP: '보석을 ' + C.GEM_PRICE + 'w × 글자 수에 산다. ' + dice('SHOP') +
      C.SHOP_COIN_MIN + '–' + C.SHOP_COIN_MAX + 'w 잔돈을 바로 준다.',
    LUCK: dice('LUCK') + '곁의 단어가 ' + C.LUCKY_TIME + '초 동안 벌이 ' +
      boost(C.LUCKY_INCOME) + '.',
    GHOST: '자리 비운 몫이 한 마리마다 +' + Math.round(C.GHOST_OFFLINE * 100) +
      '%p (기본 ' + Math.round(C.OFFLINE_RATE * 100) + '%, 최대 ' +
      Math.round((C.OFFLINE_RATE + C.GHOST_MAX * C.GHOST_OFFLINE) * 100) + '%).',
    HAMMER: '망치를 보석 위에 ' + C.HAMMER_HOLD + '초 대고 있으면 값이 ' +
      boost(C.HAMMER_MIN) + ' ~ ' + boost(C.HAMMER_MAX) +
      ' 로 다시 매겨진다 (−' + C.HAMMER_COST + 'w). 벌이와 SHOP 값 둘 다. 한 번뿐. 두드린 보석을 분해하면 글자 절반이 사라진다.',
    ROCK: '움직이지 않고, 다른 것도 지나가지 못한다. 손으로 옮기는 것만은 통한다.',
    CRAFT: '같은 글자 둘을 합친 것(AA · BB …)을 CRAFT 에 ' + C.DEVICE_HOLD +
      '초 올리면, 넣은 글자를 제외한 랜덤 글자 둘로 바꾼다.',
    HOUSE: '글자 최대 보유가 +' + C.HOUSE_ROOM + '개.',
    PEN: '보드 밖으로 버리면 원하는 알파벳 하나를 고른다. 보드가 가득 차 있으면 버릴 수 없다.',
    CLOCK: '세워 두면 생성 간격 −' + C.CLOCK_CUT + '초 (바닥 ' + C.SPAWN_FLOOR + '초).',
    TIME: '팔면 생성 간격 −' + C.TIME_CUT + '초 (바닥 ' + C.SPAWN_FLOOR + '초).'
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
