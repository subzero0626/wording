/* ==========================================================================
   save.js — 자동 저장 / 불러오기 (localStorage)
   자리를 비운 동안 벌었을 액수의 10% 만 돌려준다. 켜 두고 보는 쪽이 언제나 이득이다.
   ========================================================================== */
var G = window.G || (window.G = {});

G.save = (function () {
  /* 재화 규칙이 완전히 바뀌었으므로 v1 저장본은 이어받지 않는다 */
  var KEY = 'letters-board-v3';

  /* 초기화한 뒤에는 다시 쓰지 않는다.
     이게 없으면 새로고침 직전의 beforeunload 가 방금 지운 자리에 현재 판을
     그대로 다시 써 버려서, 초기화가 아무 일도 하지 않은 것처럼 보인다. */
  var wiped = false;

  function newState() {
    return {
      v: 2,
      money: 0,
      totalEarned: 0,
      totalSpent: 0,
      spawnLevel: 0,
      expandLevel: 0,
      spawnTimer: G.C.SPAWN_STEPS[0],
      timeCut: 0,            // 팔아 없앤 TIME 이 남긴 몫 — 생성 간격에서 영구히 빠진다
      vault: 0,              // BANK 금고에 맡겨 둔 돈 (은행이 타도 남는다)
      vaultT: 0,             // 다음 지급까지 흐른 시간
      discovered: {},
      madeWords: {},
      hints: {},
      tickets: 0,            // 손에 든 힌트권
      ticketsBought: 0,      // 지금까지 산 총 장수 — 다음 장 값이 여기서 나온다
      opt: { fx: true, sfx: true, snapHint: true },
      introDone: false,
      lastTime: Date.now()
    };
  }

  function serialize() {
    var ents = G.board.all().map(function (e) { return e.toJSON(); });
    return {
      state: G.state,
      ents: ents,
      uid: G.util.currentUid(),
      t: Date.now()
    };
  }

  function write() {
    if (wiped) return false;
    try {
      G.state.lastTime = Date.now();
      localStorage.setItem(KEY, JSON.stringify(serialize()));
      return true;
    } catch (err) {
      return false;
    }
  }

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var d = JSON.parse(raw);
      if (!d || !d.state) return null;
      return d;
    } catch (err) {
      return null;
    }
  }

  function clear() {
    wiped = true;
    try { localStorage.removeItem(KEY); } catch (err) { }
  }

  /** 저장된 오브젝트를 보드에 복원 */
  function restoreEntities(list) {
    if (!list) return;
    for (var i = 0; i < list.length; i++) {
      var d = list[i];
      if (d.type === 'word' && d.text === 'WALL') d.text = 'ROCK';  // 이름만 바뀜
      if (d.type === 'word' && !G.lookupWord(d.text)) continue;
      var e = new G.Entity(d.type, d.text, d.x, d.y);
      e.data = d.data || {};
      e.age = d.age || 0;
      G.board.add(e);
      if (e.data.up) e.setStars(e.data.up);
      if (d.burning) {
        e.burning = true;
        e.burnTime = d.burnTime || 0;
        e.el.classList.add('burning');
      }
    }
  }

  /** 보드에 서 있는 유령 수. 유령은 보는 눈이 없을 때만 일한다 (넷까지만 센다) */
  function ghostCount() {
    var n = 0, list = G.board.all();
    for (var i = 0; i < list.length; i++) {
      if (list[i].type === 'word' && list[i].text === 'GHOST' && !list[i].burning) n++;
    }
    return Math.min(G.C.GHOST_MAX, n);
  }

  /** 자리를 비운 동안 받는 몫. 유령 한 마리마다 조금씩 오른다 */
  function offlineRate() {
    return G.C.OFFLINE_RATE + ghostCount() * G.C.GHOST_OFFLINE;
  }

  /** 자리를 비운 동안의 보상 — 벌었을 액수의 offlineRate() 만큼 */
  function offlineGain(savedAt) {
    var dt = (Date.now() - savedAt) / 1000;
    if (!(dt > 0)) return 0;
    var used = Math.min(dt, G.C.OFFLINE_CAP);
    var perTick = G.board.payRate();
    var gain = Math.round(perTick * (used / G.C.PAY_PERIOD) * offlineRate());
    G.state.money += gain;
    G.state.totalEarned += gain;
    return gain;
  }

  return {
    newState: newState, write: write, read: read, clear: clear,
    restoreEntities: restoreEntities, offlineGain: offlineGain,
    ghostCount: ghostCount
  };
})();
