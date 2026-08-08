/* ==========================================================================
   save.js — 자동 저장 / 불러오기 (localStorage)
   오프라인 수입은 아주 짧게만 인정한다. 이 게임은 켜 두고 보는 게임이다.
   ========================================================================== */
var G = window.G || (window.G = {});

G.save = (function () {
  /* 재화 규칙이 완전히 바뀌었으므로 v1 저장본은 이어받지 않는다 */
  var KEY = 'letters-board-v2';

  function newState() {
    return {
      v: 2,
      money: 0,
      totalEarned: 0,
      spawnLevel: 0,
      expandLevel: 0,
      spawnTimer: G.C.SPAWN_STEPS[0],
      discovered: {},
      madeWords: {},
      hints: {},
      opt: { fx: true, snapHint: true },
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
    try { localStorage.removeItem(KEY); } catch (err) { }
  }

  /** 저장된 오브젝트를 보드에 복원 */
  function restoreEntities(list) {
    if (!list) return;
    for (var i = 0; i < list.length; i++) {
      var d = list[i];
      if (d.type === 'word' && !G.lookupWord(d.text)) continue;
      var e = new G.Entity(d.type, d.text, d.x, d.y);
      e.data = d.data || {};
      e.age = d.age || 0;
      G.board.add(e);
      if (d.burning) {
        e.burning = true;
        e.burnTime = d.burnTime || 0;
        e.el.classList.add('burning');
      }
    }
  }

  /** 자리를 비운 동안의 보상 (아주 제한적) */
  function offlineGain(savedAt) {
    var dt = (Date.now() - savedAt) / 1000;
    if (!(dt > 0)) return 0;
    var used = Math.min(dt, G.C.OFFLINE_CAP);
    var perTick = G.board.payRate();
    var gain = Math.round(perTick * (used / G.C.PAY_PERIOD) * G.C.OFFLINE_RATE);
    G.state.money += gain;
    G.state.totalEarned += gain;
    return gain;
  }

  return {
    newState: newState, write: write, read: read, clear: clear,
    restoreEntities: restoreEntities, offlineGain: offlineGain
  };
})();
