/* ==========================================================================
   game.js — 진입점 / 메인 루프
   ========================================================================== */
var G = window.G || (window.G = {});

G.game = (function () {
  var U = G.util, C = G.C;

  var paused = false;
  var last = 0;
  var saveAcc = 0;
  var running = false;
  var awayAt = 0;         // 보드를 재운 시각 (0 이면 돌아가는 중)
  var awayByHide = false; // 탭을 떠나서 잠든 것인가 (아니면 손을 놓아서)
  var idleAcc = 0;        // 마지막 조작 이후 흐른 시간

  /* ------------------------------------------------------------------
     초기화
     ------------------------------------------------------------------ */
  function init() {
    var saved = G.save.read();
    G.state = G.save.newState();
    if (saved && saved.state) {
      var s = saved.state;
      for (var k in G.state) {
        if (s[k] !== undefined) G.state[k] = s[k];
      }
      if (!G.state.opt) G.state.opt = { fx: true, snapHint: true };
      if (G.state.opt.fx === undefined) G.state.opt.fx = true;
      if (G.state.opt.snapHint === undefined) G.state.opt.snapHint = true;
      G.util.seedUid(saved.uid || 0);
    }

    G.board.init();
    G.tokens.init();
    G.drag.init();
    G.ui.init();
    G.ui.syncOptions();
    G.fx.setEnabled(G.state.opt.fx);

    if (saved && saved.ents && saved.ents.length) {
      G.save.restoreEntities(saved.ents);
      var gain = G.save.offlineGain(saved.t || Date.now());
      if (gain > 1) {
        setTimeout(function () {
          G.ui.toast('자리를 비운 동안 ' + U.money(gain) + ' 을 모았다');
        }, 700);
      }
      G.state.spawnTimer = Math.min(G.state.spawnTimer, spawnInterval());
    } else {
      seedBoard();
    }

    if (!G.state.introDone) G.ui.showIntro(); else G.ui.hideIntro();
    G.ui.renderCodex();

    if (document.hidden) { awayAt = Date.now(); awayByHide = true; }
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', function () { G.save.write(); });

    var acts = ['pointerdown', 'pointermove', 'wheel', 'keydown'];
    for (var a = 0; a < acts.length; a++) {
      window.addEventListener(acts[a], onActivity, { passive: true });
    }

    running = true;
    last = performance.now();
    requestAnimationFrame(loop);
  }

  /**
   * 첫 판.
   * 무작위로 뿌리면 자음만 잔뜩 나와 한 단어도 못 만들고 멍하니 기다리게 된다.
   * 그래서 시작 글자는 정해 둔다 — 이 여덟 개로 CAT · RAT · CARE · STORE ·
   * SNORE · CRATE · ACTORS … 처럼 여러 갈래가 바로 열린다.
   */
  function seedBoard() {
    var seed = ['C', 'A', 'T', 'R', 'E', 'S', 'O', 'N'];
    for (var i = 0; i < C.START_LETTERS; i++) {
      G.board.spawnLetter(seed[i] || G.randomLetter());
    }
  }

  /* ------------------------------------------------------------------
     방치
     탭을 떠났을 때, 그리고 켜 둔 채로 IDLE_AFTER 만큼 손을 놓았을 때
     보드를 통째로 재운다. 글자도 생기지 않고, 깨어날 때 그동안의 몫만 따로 받는다.
     ------------------------------------------------------------------ */
  function sleepBoard(byHide) {
    if (awayAt || paused) return;
    awayAt = Date.now();
    awayByHide = !!byHide;
    G.drag.cancel();
    G.ui.closePopovers();
    G.ui.hideChip();
    G.save.write();
    if (!byHide) G.ui.setIdleUI(true);
  }

  function wakeBoard() {
    idleAcc = 0;
    last = performance.now();        // 재워 둔 시간이 한꺼번에 흐르지 않게
    if (!awayAt) return;
    var at = awayAt;
    awayAt = 0;
    G.ui.setIdleUI(false);
    var gain = G.save.offlineGain(at);
    if (gain > 1) G.ui.toast('자리를 비운 동안 ' + U.money(gain) + ' 을 모았다');
  }

  /** 조작이 있었다 — 재워 둔 보드라면 깨운다 */
  function onActivity() {
    if (awayAt && awayByHide) return;   // 탭 복귀는 visibilitychange 가 맡는다
    if (awayAt) wakeBoard();
    else idleAcc = 0;
  }

  function onVisibility() {
    if (document.hidden) { sleepBoard(true); return; }
    wakeBoard();
  }

  /* ------------------------------------------------------------------
     루프
     ------------------------------------------------------------------ */
  function loop(now) {
    if (!running) return;
    requestAnimationFrame(loop);

    var dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;          // 탭 전환 등으로 인한 큰 점프 방지
    if (dt <= 0) return;

    if (!paused && !awayAt) {
      idleAcc += dt;
      if (idleAcc >= C.IDLE_AFTER) { sleepBoard(false); return; }

      stepSpawn(dt);
      G.drag.tick(dt);
      G.board.step(dt);
      G.fx.update(dt);
      saveAcc += dt;
      if (saveAcc > 6) { saveAcc = 0; G.save.write(); }
    }
    G.fx.render();
    G.ui.tick();
  }

  /* ------------------------------------------------------------------
     글자 생성
     ------------------------------------------------------------------ */
  function spawnInterval() {
    return C.SPAWN_STEPS[U.clamp(G.state.spawnLevel, 0, C.SPAWN_STEPS.length - 1)];
  }

  function stepSpawn(dt) {
    G.state.spawnTimer -= dt;
    if (G.state.spawnTimer > 0) return;
    if (G.board.count() >= G.maxEntities()) {
      G.state.spawnTimer = 3;       // 보드가 꽉 찼다 — 잠시 후 다시 시도
      return;
    }
    G.board.spawnLetter();
    G.state.spawnTimer = spawnInterval();
  }

  /** 남은 생성 대기를 당긴다 (WIND · LUCK · 판매) */
  function hurrySpawn(cut) {
    G.state.spawnTimer *= cut;
  }

  function buySpawnUpgrade() {
    var lv = G.state.spawnLevel;
    if (lv >= C.SPAWN_STEPS.length - 1) return false;
    var cost = C.SPAWN_COSTS[lv];
    if (!G.board.spend(cost)) return false;
    G.state.spawnLevel++;
    G.state.spawnTimer = Math.min(G.state.spawnTimer, spawnInterval());
    G.ui.toast('생성 간격 ' + C.SPAWN_STEPS[G.state.spawnLevel] + '초');
    return true;
  }

  /* ------------------------------------------------------------------
     단어 발견
     ------------------------------------------------------------------ */
  function onWordFormed(ent, quiet, kind) {
    var id = ent.text;
    kind = kind || (G.WORD_BY_ID[id] ? 'ability' : 'plain');
    G.defs.prefetch(id);          // 더블클릭했을 때 바로 뜻이 뜨도록 미리 받아 둔다

    if (kind === 'ability') {
      if (!G.state.discovered[id]) {
        G.state.discovered[id] = true;
        G.state.hints[id] = 2;
        G.ui.renderCodex();
        G.ui.toast('능력을 가진 단어 <b>' + id + '</b> 발견');
        var n = Object.keys(G.state.discovered).length;
        if (n === G.WORDS.length) {
          setTimeout(function () {
            G.ui.toast('능력 단어 ' + G.WORDS.length + '개를 모두 찾았다');
          }, 1200);
        }
      } else if (!quiet) {
        G.ui.toast('<b>' + id + '</b>');
      }
    } else {
      var first = !G.state.madeWords[id];
      G.state.madeWords[id] = (G.state.madeWords[id] || 0) + 1;
      if (first) G.ui.renderCodex();
      if (!quiet) {
        G.ui.toast('<b>' + id + '</b> · ' + C.PAY_PERIOD + '초마다 ' +
          U.money(ent.def.value));
      }
    }

    if (!G.state.introDone) {
      G.state.introDone = true;
      G.ui.hideIntro();
    }
  }

  /** BOOK / LUCK 이 주는 무료 힌트 */
  function freeHint() {
    var pool = G.WORDS.filter(function (w) {
      return !G.state.discovered[w.id] && (G.state.hints[w.id] || 0) < 2;
    });
    if (!pool.length) return false;
    var w = U.pick(pool);
    G.state.hints[w.id] = (G.state.hints[w.id] || 0) + 1;
    G.ui.renderCodex();
    G.ui.toast('도감에 힌트가 하나 밝혀졌다');
    return true;
  }

  /* ------------------------------------------------------------------
     일시정지 / 초기화
     ------------------------------------------------------------------ */
  function setPaused(p) {
    paused = !!p;
    if (paused) {
      G.drag.cancel();
      G.ui.closePopovers();
      G.ui.hideChip();
      G.save.write();
    } else {
      last = performance.now();
      idleAcc = 0;
    }
    G.ui.setPausedUI(paused);
  }

  function hardReset() {
    running = false;
    G.save.clear();
    location.reload();
  }

  return {
    init: init,
    spawnInterval: spawnInterval,
    hurrySpawn: hurrySpawn,
    buySpawnUpgrade: buySpawnUpgrade,
    onWordFormed: onWordFormed,
    freeHint: freeHint,
    setPaused: setPaused,
    hardReset: hardReset,
    get paused() { return paused; }
  };
})();

document.addEventListener('DOMContentLoaded', function () { G.game.init(); });
