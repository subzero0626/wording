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
      if (G.state.opt.sfx === undefined) G.state.opt.sfx = true;
      if (G.state.opt.snapHint === undefined) G.state.opt.snapHint = true;
      /* WALL → ROCK 이름만 바뀜 — 발견한 기록도 이어받는다 */
      if (G.state.discovered && G.state.discovered.WALL) {
        G.state.discovered.ROCK = true;
        delete G.state.discovered.WALL;
      }
      if (G.state.madeWords && G.state.madeWords.WALL) {
        G.state.madeWords.ROCK = (G.state.madeWords.ROCK || 0) + G.state.madeWords.WALL;
        delete G.state.madeWords.WALL;
      }
      if (G.state.hints && G.state.hints.WALL) {
        G.state.hints.ROCK = G.state.hints.WALL;
        delete G.state.hints.WALL;
      }
      G.util.seedUid(saved.uid || 0);
    }

    G.board.init();
    G.tokens.init();
    G.drag.init();
    G.ui.init();
    G.ui.syncOptions();
    G.fx.setEnabled(G.state.opt.fx);
    G.sfx.setEnabled(G.state.opt.sfx !== false);

    if (saved && saved.ents && saved.ents.length) {
      G.save.restoreEntities(saved.ents, saved.boardW, saved.boardH);
      var gain = G.save.offlineGain(saved.t || Date.now());
      var ghosts = G.save.ghostCount();
      if (gain > 1) {
        setTimeout(function () {
          G.ui.toast('자리를 비운 동안 ' + U.money(gain) + ' 을 모았다' +
            (ghosts ? ' — 유령이 부지런했다' : ''));
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
    window.addEventListener('pageshow', function () {
      if (!document.hidden) wakeBoard();
    });
    window.addEventListener('beforeunload', function () { G.save.write(); });

    var acts = ['pointerdown', 'pointermove', 'wheel', 'keydown'];
    for (var a = 0; a < acts.length; a++) {
      window.addEventListener(acts[a], onActivity, { passive: true });
    }
    window.addEventListener('pointerdown', function () { G.sfx.unlock(); }, { once: true, capture: true });

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
    awayByHide = false;
    if (!awayAt) return;
    var at = awayAt;
    awayAt = 0;
    G.ui.setIdleUI(false);
    var gain = G.save.offlineGain(at);
    if (gain > 1) G.ui.toast('자리를 비운 동안 ' + U.money(gain) + ' 을 모았다');
  }

  /** 조작이 있었다 — 재워 둔 보드라면 깨운다 */
  function onActivity() {
    if (awayAt) {
      /* 탭을 나갔다가 이미 돌아온 뒤 visibility 이벤트를 놓치면
         awayByHide 가 남은 채로 클릭이 무시되어 보드가 영영 멈춘다.
         화면이 보이는 상태면 조작으로 깨운다. */
      if (awayByHide && document.hidden) return;
      wakeBoard();
      return;
    }
    idleAcc = 0;
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

    if (!paused && !awayAt && !G.ui.penPicking) {
      idleAcc += dt;
      if (idleAcc >= C.IDLE_AFTER) {
        sleepBoard(false);
      } else {
        G.state.playTime = (G.state.playTime || 0) + dt;
        stepSpawn(dt);
        try { G.drag.tick(dt); } catch (err) { console.error(err); G.drag.cancel(); }
        try { G.board.step(dt); } catch (err) { console.error(err); }
        G.fx.update(dt);
        saveAcc += dt;
        if (saveAcc > 6) { saveAcc = 0; G.save.write(); }
      }
    }
    G.fx.render();
    G.ui.tick();
  }

  /* ------------------------------------------------------------------
     글자 생성
     ------------------------------------------------------------------ */
  /**
   * 다음 글자까지의 간격.
   * 업그레이드로 정해진 값에서 두 가지가 더 깎아 낸다 —
   * 팔아 없앤 TIME 이 남긴 몫(영구)과, 지금 보드에 서 있는 CLOCK 들(한시적)이다.
   * 둘을 합쳐도 SPAWN_FLOOR 밑으로는 내려가지 않는다.
   */
  function spawnInterval() {
    var base = C.SPAWN_STEPS[U.clamp(G.state.spawnLevel, 0, C.SPAWN_STEPS.length - 1)];
    return Math.max(C.SPAWN_FLOOR, base - (G.state.timeCut || 0) - clockCut());
  }

  /** 보드에 서 있는 시계가 줄여 주는 초 (타 버린 시계는 세지 않는다) */
  function clockCut() {
    var list = G.board.all(), n = 0;
    for (var i = 0; i < list.length; i++) {
      if (list[i].type === 'word' && list[i].text === 'CLOCK' && !list[i].burning) n++;
    }
    return n * C.CLOCK_CUT;
  }

  function stepSpawn(dt) {
    /* 시계를 새로 세우면 지금 기다리는 것부터 짧아진다.
       다음 글자부터 적용하면 세워 놓고도 아무 일이 없는 것처럼 보인다 */
    var iv = spawnInterval();
    if (G.state.spawnTimer > iv) G.state.spawnTimer = iv;
    if (G.state.spawnTimer > 0) G.state.spawnTimer -= dt;
    if (G.state.spawnTimer > 0) return;
    /* 다 채워 놓고 자리가 없으면 게이지를 가득 찬 채로 붙잡아 둔다.
       다시 세게 하면 게이지가 눈앞에서 되감겨 기다린 시간을 뺏긴 것처럼 보인다.
       한 칸이라도 나는 순간 그 프레임에 바로 내보낸다. */
    G.state.spawnTimer = 0;
    if (G.board.count() >= G.maxEntities()) return;
    G.board.spawnLetter();
    G.state.spawnTimer = spawnInterval();
  }

  /** 남은 생성 대기를 당긴다 (WIND · LUCK) */
  function hurrySpawn(cut) {
    G.state.spawnTimer *= cut;
  }

  /**
   * 낱글자 하나를 팔아 자리를 비웠다.
   * 보통은 남은 대기를 반으로 당겨 준다. 다만 정원이 차서 게이지가 가득 찬 채로
   * 멈춰 있었다면 그 자리를 다음 프레임에 도로 채워 버리게 되는데, 그러면
   * 자리를 만들려고 판 것이 눈앞에서 없던 일이 된다. 그때는 새로 기다리게 한다.
   */
  function soldOne() {
    if (G.state.spawnTimer > 0) {
      G.state.spawnTimer *= C.SELL_COOLDOWN_CUT;
      return;
    }
    G.state.spawnTimer = spawnInterval();
  }

  function buySpawnUpgrade() {
    var lv = G.state.spawnLevel;
    if (lv >= C.SPAWN_STEPS.length - 1) return false;
    var cost = C.SPAWN_COSTS[lv];
    if (!G.board.spend(cost)) return false;
    G.state.spawnLevel++;
    G.state.spawnTimer = Math.min(G.state.spawnTimer, spawnInterval());
    G.ui.toast('생성 간격 ' + spawnInterval().toFixed(1) + '초');
    return true;
  }

  /**
   * TIME 을 팔았다 — 흘려보낸 시간을 돌려받는다.
   * 보드에서 사라지는 대신 남는 것이라, 자리를 차지하지 않고 계속 쌓인다.
   */
  function sellTime() {
    G.state.timeCut = (G.state.timeCut || 0) + C.TIME_CUT;
    var iv = spawnInterval();
    G.state.spawnTimer = Math.min(G.state.spawnTimer, iv);
    G.ui.toast(iv <= C.SPAWN_FLOOR
      ? '더는 빨라지지 않는다 — 생성 간격 ' + iv.toFixed(1) + '초'
      : '시간을 돌려받았다 · 생성 간격 ' + iv.toFixed(1) + '초');
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
        G.state.hints[id] = G.HINT_MAX;
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
    stepSpawn: stepSpawn,        // 헤드리스 검증(_sim.js)에서 부른다
    hurrySpawn: hurrySpawn,
    soldOne: soldOne,
    clockCut: clockCut,
    sellTime: sellTime,
    buySpawnUpgrade: buySpawnUpgrade,
    onWordFormed: onWordFormed,
    setPaused: setPaused,
    hardReset: hardReset,
    get paused() { return paused; }
  };
})();

document.addEventListener('DOMContentLoaded', function () { G.game.init(); });
