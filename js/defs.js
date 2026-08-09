/* ==========================================================================
   defs.js — 단어 뜻 사전 (첫 글자별 지연 로드)
   --------------------------------------------------------------------------
   뜻 데이터는 4.6MB 라 한꺼번에 들고 있지 않는다.
   단어를 더블클릭하면 그 단어의 첫 글자 파일(js/defs/A.js …)만 그때 불러온다.
   fetch 가 아니라 <script> 태그로 불러오므로 file:// 로 열어도 동작한다.

   영어 뜻: WordNet 3.1 (Princeton) + Webster's 1913 (public domain)
   한글 뜻: kengdic (Korean-English dictionary) 을 영→한으로 뒤집은 것
   값 형식: "품사|원형|한글뜻|영어뜻"   (원형은 어형변화일 때만 채워진다)
   ========================================================================== */
var G = window.G || (window.G = {});

G.defs = (function () {

  var maps = {};        // 'A' → { WORD: "n||gloss" }
  var state = {};       // 'A' → 'loading' | 'done'
  var waiting = {};     // 'A' → [callback]

  var POS_KO = {
    n: '명사', v: '동사', a: '형용사', r: '부사'
  };

  /** 생성된 defs/X.js 가 스스로 호출한다 */
  function put(letter, map) {
    maps[letter] = map || {};
    state[letter] = 'done';
    var q = waiting[letter] || [];
    waiting[letter] = [];
    for (var i = 0; i < q.length; i++) q[i]();
  }

  function parse(word, raw) {
    if (!raw) return null;
    var i = raw.indexOf('|');
    var j = raw.indexOf('|', i + 1);
    var k = raw.indexOf('|', j + 1);
    if (i < 0 || j < 0 || k < 0) return null;
    var pos = raw.slice(0, i);
    return {
      word: word,
      pos: pos,
      posKo: POS_KO[pos] || '',
      base: raw.slice(i + 1, j),        // 원형 (어형변화가 아니면 '')
      ko: raw.slice(j + 1, k),          // 한글 뜻 (없을 수 있다)
      gloss: raw.slice(k + 1)           // 영어 뜻
    };
  }

  /** 이미 불러온 경우에만 즉시 반환 */
  function peek(word) {
    var k = word.charAt(0);
    if (state[k] !== 'done') return undefined;
    return parse(word, maps[k][word]);
  }

  /**
   * 뜻을 가져온다. 필요하면 파일을 불러온 뒤 콜백한다.
   * @param {function(entry|null)} cb
   */
  function get(word, cb) {
    var k = word.charAt(0);
    if (state[k] === 'done') { cb(parse(word, maps[k][word])); return; }

    (waiting[k] = waiting[k] || []).push(function () {
      cb(parse(word, maps[k][word]));
    });
    if (state[k] === 'loading') return;

    state[k] = 'loading';
    var s = document.createElement('script');
    s.src = 'js/defs/' + k + '.js';
    s.async = true;
    s.onerror = function () { put(k, {}); };
    document.head.appendChild(s);
  }

  /** 이 단어의 첫 글자 파일을 미리 준비해 둔다 (팝오버가 덜 깜빡이도록) */
  function prefetch(word) {
    if (!word) return;
    var k = word.charAt(0);
    if (state[k]) return;
    get(word, function () { });
  }

  /* ------------------------------------------------------------------
     한글 뜻 손질
     --------------------------------------------------------------------
     원본은 한영사전을 영→한으로 뒤집은 것이라 두 가지 문제가 있다.
       · 후보가 콤마로 서너 개 붙어 있는데 뒤로 갈수록 잘 안 쓰는 말이다
       · 표제어에서 떨어져 나온 조각이 섞여 있다 ("에게 잔소리하다", "구균의 뜻")
     조각을 걸러 내고, 품사에 맞는 것을 앞세워 둘까지만 보여 준다.
     ------------------------------------------------------------------ */

  /**
   * 손으로 적어 둔 뜻.
   * 자료가 아예 비어 있거나("의 3인칭"), 흔한 뜻 대신 엉뚱한 항목이 잡힌
   * 짧은 단어들이다 — DOE 는 미국 에너지부, JAY 는 미국 외교관, WAS 는
   * 워싱턴주로 들어와 있다. 세 글자 단어는 판마다 계속 만들게 되므로
   * 여기만큼은 가장 흔한 뜻으로 적어 둔다.
   */
  var KO_FIX = {
    ALE: '에일 맥주', ALP: '높은 산', AMP: '암페어, 앰프', ASP: '독사',
    AWE: '경외, 경외감', AXE: '도끼', AYE: '찬성, 네', BYE: '작별 인사, 부전승',
    CAD: '비열한 사람', CHI: '기(氣)', DEB: '사교계에 갓 나온 아가씨',
    DIP: '살짝 담그다, 움푹한 곳', DOC: '의사', DOE: '암사슴',
    EGO: '자아, 자존심', EKE: '근근이 이어 가다', EMU: '에뮤', EON: '아주 긴 세월',
    ERR: '잘못하다', FLU: '독감', FOB: '시곗줄 주머니', GNU: '누',
    GYM: '체육관', HAS: '가지고 있다', HER: '그녀의, 그녀를', HES: '그는',
    IRE: '분노', JAY: '어치', KEN: '아는 범위', LAD: '사내아이',
    LOB: '높이 띄워 던지다', LOO: '화장실', MAX: '최대', MED: '의학의',
    MID: '한가운데의', MOP: '대걸레', OFT: '자주', OOH: '우와',
    ORC: '범고래', PHI: '파이', PIC: '사진', POI: '포이',
    POX: '발진, 마마', PSI: '프사이', QAT: '카트나무', RAJ: '인도 통치',
    RID: '없애다', SAX: '색소폰', SEC: '초, 잠깐', SIS: '언니, 누나',
    SOL: '솔, 태양', TAM: '베레모', TAO: '도(道)', TAU: '타우',
    TEE: '티', TOG: '옷을 입히다', TOT: '꼬마', TUX: '턱시도',
    UMP: '심판', VET: '수의사', VIM: '활력', WAS: '였다',
    WEE: '아주 작은', WOK: '중화 냄비', YAW: '항로를 벗어나다', YEA: '찬성',
    YEW: '주목나무', ZIG: '지그재그로 꺾다',
    /* 복수형인데 자료가 엉뚱한 항목을 물고 있는 것들 */
    ALES: '에일 맥주들', DOES: '암사슴들', ERRS: '잘못하다', TEES: '티들',
    /* 흔한 형용사인데 자료가 엉뚱한 것을 물고 있는 것들.
       BIG 이 "장대", NICE 가 "니스", WISE 가 "철" 로 나오던 자리다.
       원형이 제대로 잡혀야 BIGGER · WISEST 도 "더 큰 · 가장 슬기로운" 으로 읽힌다 */
    BIG: '크다, 커다란', WIDE: '넓다, 너른', NICE: '좋다, 훌륭한',
    WISE: '슬기롭다, 현명한', FINE: '훌륭하다, 섬세한', BLUE: '파랗다, 우울한',
    FEW: '적다, 몇 안 되는', NEW: '새롭다', FREE: '자유롭다, 공짜의',
    RUDE: '무례하다', SURE: '틀림없다, 확실한', VILE: '비열하다',
    NUDE: '벌거벗다', DARK: '어둡다, 캄캄한', RAW: '날것이다, 설익다',
    /* 원형과 뜻이 어긋나 있어 되짚기가 닿지 않는 것 (FINER 에 FIN 의 뜻이 들어 있다) */
    FINER: '더 훌륭한',
    /* 철자가 원형과 아예 다른 비교급·최상급. 철자로는 되짚을 수 없다 */
    BETTER: '더 좋은, 더 나은', WORSE: '더 나쁜', WORST: '가장 나쁜',
    MORE: '더 많은', MOST: '가장 많은', LESS: '더 적은', LEAST: '가장 적은',
    ELDER: '손위의', ELDEST: '맏이의', FURTHER: '더 먼', FARTHER: '더 먼',
    FURTHEST: '가장 먼', FARTHEST: '가장 먼'
  };

  /* 표제어에 딸려 있던 조사가 앞에 남은 것 — "와 결혼하다" 의 "와 " */
  var LEAD_JOSA = /^(에게|으로|와|과|로|에|의|을|를|이|가)\s+/;
  var JUNK_TAIL = /의\s?(뜻|고어체|부정형|단수|복수|약자|이형|변형)$/;
  /* 뜻이 아니라 문법 설명인 조각 — 통째로 그것일 때만 걸러낸다
     ("복수" 는 버리지만 "복수하다" 는 남겨야 한다) */
  var GRAMMAR = /^(\d*인칭|준말|고어체|약자|이형|변형|부정형|비교급|최상급|과거|현재|복수|단수)(형|의)?$/;

  /**
   * 앞에 남은 조사를 떼어 낸다.
   * 예전에는 조사로 시작하면 후보를 통째로 버렸는데, 그 바람에
   * "와 결혼하다"(WED) · "로 간주하다"(DEEM) 처럼 멀쩡한 뜻까지 사라졌다.
   */
  function trim(s) {
    s = (s || '').trim();
    var m = LEAD_JOSA.exec(s);
    if (m) s = s.slice(m[0].length).trim();
    return s;
  }

  /* 한 글자짜리도 버리면 안 된다 — 불 · 물 · 쥐 처럼 가장 흔한 뜻이 그렇다 */
  function usable(s) {
    if (!s || !/[가-힣]/.test(s)) return false;
    return !JUNK_TAIL.test(s) && !GRAMMAR.test(s);
  }

  function isVerb(s) { return /다$/.test(s); }
  function isAdverb(s) { return /(히|게)$/.test(s); }
  function isAdj(s) { return /(는|한|운|픈|쁜)$/.test(s); }

  /** 이 후보가 그 품사에 얼마나 어울리는가 (클수록 앞으로) */
  function fit(s, pos) {
    if (pos === 'v') return isVerb(s) ? 2 : 0;
    if (pos === 'r') return isAdverb(s) ? 2 : 0;
    if (pos === 'a') return isAdj(s) ? 2 : (isVerb(s) ? 1 : 0);
    return (isVerb(s) || isAdverb(s)) ? 0 : 2;     // 명사
  }

  /**
   * 어형변화형의 뜻을 그 모양에 맞춰 바꾼다.
   *   ACTED   출연하다 → 출연한
   *   ADDING  가하다   → 가하고 있는
   *   CATS    고양이   → 고양이들
   *   -LY     걷다     → 걷게
   *
   * 한국어는 어간마다 활용이 달라서 -ED 를 억지로 "은" 으로 만들면 틀린 말이
   * 나온다 (걷다 → 걷은 ✗). "하다" 로 끝날 때만 "한" 을 붙이고, 그 밖에는
   * 어떤 어간에나 그대로 붙는 "던" 을 쓴다 (걷던 · 먹던 · 오던).
   */
  function inflect(s, word, base) {
    if (isVerb(s)) {
      var stem = s.slice(0, -1);                   // 걷다 → 걷 / 출연하다 → 출연하
      if (/ING$/.test(word)) return stem + '고 있는';
      if (/LY$/.test(word)) return stem + '게';
      if (/ED$/.test(word)) {
        return /하$/.test(stem) ? stem.slice(0, -1) + '한' : stem + '던';
      }
      return s;
    }

    /* 복수형에는 "들" 을 붙인다.
       원형이 이미 S 로 끝나면 이 S 는 복수 표시가 아니므로 건드리지 않는다.
       붙여서 어색해지는 쪽이 안 붙여서 밋밋한 쪽보다 훨씬 눈에 거슬리므로,
       확실히 셀 수 있는 이름씨로 보일 때만 붙인다 —
       조사나 어미로 끝나는 것("곁에", "통틀어")은 그대로 둔다. */
    if (/S$/.test(word) && !/S$/.test(base) &&
      !isAdverb(s) && !isAdj(s) && !/\s/.test(s) &&
      /[가-힣]$/.test(s) && !/(들|에|로|서|와|과|만|도|의|를|을|여|써)$/.test(s)) {
      return s + '들';
    }
    return s;
  }

  /* ------------------------------------------------------------------
     비교급 · 최상급

     BIGGER 를 눌러도 BIG 과 똑같은 뜻이 떴다. 자료가 변화형마다 원형의 뜻을
     그대로 복사해 두었기 때문인데, 그래서 "더" 인지 "가장" 인지가 어디에도
     드러나지 않았다. 원형 칸도 절반은 비어 있어(BIGGEST 에는 BIG 이 적혀
     있지만 BIGGER 에는 없다) 그것만 믿을 수도 없다.

     그래서 철자로 되짚는다 — BIGGER → BIGG → BIG. 되짚은 자리에 실제로 단어가
     있고, 그 뜻이 이 단어의 뜻과 글자 그대로 같을 때에만 비교급으로 본다.
     뜻을 복사해 왔다는 것이 곧 변화형이라는 표시이기 때문이다.

     이 "뜻이 같은가" 하나가 남의 말을 거의 다 걸러 준다.
     SOBER 는 SOB 의, TENDER 는 TEND 의, PROPER 는 PROP 의 비교급이 아닌데,
     그것들은 저마다 제 뜻을 갖고 있어 원형의 뜻과 같지 않다.
     품사 칸으로 거르지 않는 것은 자료가 OLD·SAFE·COLD 를 죄다 명사로
     적어 두어서다 — 그것을 믿었다가는 멀쩡한 비교급의 절반을 놓친다.
     ------------------------------------------------------------------ */

  /** ER/EST 를 뗀 뒤 원형이 되었을 법한 철자들 */
  function degStems(s) {
    var out = [s];
    if (/(.)\1$/.test(s)) out.push(s.slice(0, -1));      // BIGG → BIG
    if (/I$/.test(s)) out.push(s.slice(0, -1) + 'Y');    // EASI → EASY
    out.push(s + 'E');                                    // WID  → WIDE
    return out;
  }

  /**
   * 이 단어가 형용사의 비교급·최상급인지 본다.
   * @return null 이거나 { sup: 최상급인가, root: 원형의 뜻풀이 }
   */
  function degree(info) {
    if (info.pos !== 'a' && info.pos !== 'r') return null;
    var m = /^(.{3,})(EST|ER)$/.exec(info.word);
    if (!m) return null;
    var stems = degStems(m[1]);
    for (var i = 0; i < stems.length; i++) {
      if (stems[i] === info.word) continue;
      var r = peek(stems[i]);
      if (!r) continue;
      var same = info.base === r.word || (!!r.ko && info.ko === r.ko);
      if (same) return { sup: m[2] === 'EST', root: r };
    }
    return null;
  }

  /**
   * 후보 목록에서 보여줄 둘을 고른다.
   * @param raw  콤마로 이어진 후보들
   * @param pos  품사 (어느 것을 앞세울지)
   * @param word 화면에 뜰 단어 (변화형이면 모양을 맞춘다)
   * @param base 원형. 비어 있으면 변화형이 아니다
   * @param deg  비교급·최상급이면 true — 앞에 "더 · 가장" 을 붙일 수 있는
   *             후보(형용사·동사꼴)만 남긴다. "더 장대" 같은 말은 안 나오게
   */
  function pick(raw, pos, word, base, deg) {
    if (!raw) return '';
    var parts = raw.split(','), keep = [], i, s;
    for (i = 0; i < parts.length; i++) {
      s = trim(parts[i]);
      if (!usable(s) || keep.indexOf(s) >= 0) continue;
      if (deg && !fit(s, 'a')) continue;
      keep.push(s);
    }
    if (!keep.length) return '';

    keep.sort(function (a, b) { return fit(b, pos) - fit(a, pos); });

    /* 변화형일 때만 모양을 바꾼다. SEED · FEED 처럼 원래 -ED 로 끝나는
       단어까지 과거형으로 읽어 버리면 안 되기 때문이다.
       변화형은 하나만 보여 준다 — 활용이 어울리는 것은 대개 맨 앞 하나뿐이라
       둘씩 늘어놓으면 ACTED 가 "출연한, 조" 처럼 엉킨다. */
    var out = [], limit = (base || deg) ? 1 : 2;
    for (i = 0; i < keep.length && out.length < limit; i++) {
      var t = base ? inflect(keep[i], word, base) : keep[i];
      if (out.indexOf(t) < 0) out.push(t);
    }
    return out.join(', ');
  }

  /** 팝오버에 보여줄 한글 뜻 */
  function koText(info) {
    if (!info) return '';
    /* 손으로 적어 둔 것은 이미 제 모양이라 활용하지 않는다 */
    if (KO_FIX[info.word]) return pick(KO_FIX[info.word], info.pos, info.word, '');

    /* 비교급·최상급은 제 뜻에서든 원형에서든 형용사 하나만 골라 "더 · 가장" 을
       앞에 붙인다. 붙일 만한 후보가 없으면(뜻이 죄다 명사면) 그냥 넘어간다 */
    var d = degree(info);
    if (d) {
      /* 손으로 적어 둔 원형이 있으면 그쪽을 먼저 쓴다 — 자료보다 낫다 */
      var one = pick(KO_FIX[d.root.word], 'a', info.word, '', true) ||
        pick(info.ko, 'a', info.word, '', true) ||
        pick(d.root.ko, 'a', info.word, '', true);
      if (one) return (d.sup ? '가장 ' : '더 ') + one;
    }

    var out = pick(info.ko, info.pos, info.word, info.base);
    if (out) return out;

    /* 변화형인데 제 뜻이 비어 있으면 원형에서 끌어온다 (DUGS 는 비었지만 DUG 은 있다).
       원형의 뜻을 이 단어의 모양에 맞춰 활용해 주므로 그대로 읽힌다. */
    if (info.base && info.base !== info.word) {
      var b = peek(info.base);
      var raw = KO_FIX[info.base] || (b && b.ko);
      if (raw) return pick(raw, (b && b.pos) || info.pos, info.word, info.base);
    }

    /* 손으로 적어 둔 단어의 복수형 (DEB → DEBS). 원형 칸이 비어 있는 항목이 많다.
       어간을 함부로 깎으면 COOLY 를 COO 로 읽는 식의 헛짚음이 생기지만,
       내가 뜻을 아는 단어의 -S 하나만은 안전하다. */
    if (/S$/.test(info.word)) {
      var stem = info.word.slice(0, -1);
      if (KO_FIX[stem]) return pick(KO_FIX[stem], info.pos, info.word, stem);
    }
    return '';
  }

  return {
    put: put, get: get, peek: peek, prefetch: prefetch,
    koText: koText, POS_KO: POS_KO
  };
})();
