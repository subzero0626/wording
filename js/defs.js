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

  return { put: put, get: get, peek: peek, prefetch: prefetch, POS_KO: POS_KO };
})();
