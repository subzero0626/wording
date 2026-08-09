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

  var JUNK_HEAD = /^(로|에게|에|의|을|를|이|가|와|과|으로)\s/;
  var JUNK_TAIL = /의\s?(뜻|고어체|부정형|단수|복수|약자|이형|변형)$/;

  /* 한 글자짜리도 버리면 안 된다 — 불 · 물 · 쥐 처럼 가장 흔한 뜻이 그렇다 */
  function usable(s) {
    if (!s || !/[가-힣]/.test(s)) return false;
    return !JUNK_HEAD.test(s) && !JUNK_TAIL.test(s);
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
       원형이 이미 S 로 끝나면 이 S 는 복수 표시가 아니므로 건드리지 않고,
       이름씨 꼴로 끝나는 후보에만 붙인다 (부사·형용사·감탄사는 제외). */
    if (/S$/.test(word) && !/S$/.test(base) &&
      !isAdverb(s) && !isAdj(s) && /[가-힣]$/.test(s) && !/들$/.test(s)) {
      return s + '들';
    }
    return s;
  }

  /** 팝오버에 보여줄 한글 뜻 */
  function koText(info) {
    if (!info || !info.ko) return '';
    var parts = info.ko.split(','), keep = [], i, s;
    for (i = 0; i < parts.length; i++) {
      s = parts[i].trim();
      if (usable(s)) keep.push(s);
    }
    if (!keep.length) return '';

    keep.sort(function (a, b) { return fit(b, info.pos) - fit(a, info.pos); });

    /* 변화형일 때만 모양을 바꾼다. SEED · FEED 처럼 원래 -ED 로 끝나는
       단어까지 과거형으로 읽어 버리면 안 되기 때문이다. */
    var out = [];
    for (i = 0; i < keep.length && out.length < 2; i++) {
      var t = info.base ? inflect(keep[i], info.word, info.base) : keep[i];
      if (out.indexOf(t) < 0) out.push(t);
    }
    return out.join(', ');
  }

  return {
    put: put, get: get, peek: peek, prefetch: prefetch,
    koText: koText, POS_KO: POS_KO
  };
})();
