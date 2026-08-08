/* ==========================================================================
   drag.js — 드래그, 스냅, 글자 조합
   플레이어가 직접 끌어다 붙이는 것만이 단어를 만드는 유일한 방법이다.
   ========================================================================== */
var G = window.G || (window.G = {});

G.drag = (function () {
  var U = G.util, C = G.C;

  var cur = null;          // 드래그 중인 오브젝트
  var offX = 0, offY = 0;
  var moved = false;
  var rawX = 0, rawY = 0;  // 포인터가 실제로 가리키는 위치 (스냅 판정 기준)
  var snap = null;         // {target, side, x, y, armed}
  var holdT = 0;           // 같은 단어에 대고 있은 시간
  var outside = false;     // 보드 밖 = 판매 대기
  var snapEl, hintEl, playEl;

  function init() {
    playEl = document.getElementById('play');
    snapEl = document.getElementById('snapline');
    hintEl = document.getElementById('snaphint');
    var layer = document.getElementById('layer');

    layer.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    layer.addEventListener('dblclick', onDblClick);
    layer.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
  }

  function entFromEvent(ev) {
    var node = ev.target;
    while (node && node !== document.body) {
      if (node.classList && node.classList.contains('ent')) {
        return G.board.get(node.dataset.id);
      }
      node = node.parentNode;
    }
    return null;
  }

  function localPoint(ev) {
    var r = playEl.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  }

  /* ------------------------------------------------------------------ */

  function onDown(ev) {
    if (G.game.paused) return;
    var e = entFromEvent(ev);
    if (!e) return;
    ev.preventDefault();

    cur = e;
    moved = false;
    holdT = 0;
    outside = false;
    var p = localPoint(ev);
    offX = e.x - p.x;
    offY = e.y - p.y;
    rawX = e.x; rawY = e.y;

    e.dragging = true;
    e.jump = null;
    e.hop = 0;
    e.vx = 0; e.vy = 0;
    e.heldBy = null;
    e.el.classList.add('drag');
    G.ui.closePopovers();
  }

  function onMove(ev) {
    if (!cur) return;
    var p = localPoint(ev);
    var nx = p.x + offX, ny = p.y + offY;
    if (Math.abs(nx - rawX) > 1 || Math.abs(ny - rawY) > 1) moved = true;
    rawX = nx; rawY = ny;
    applyPosition();
  }

  /**
   * 포인터 위치를 그대로 쓰되
   *   · 붙일 자리가 보이면 그쪽으로 끌어당기고
   *   · 보드 밖으로 나가려 하면 뻑뻑하게 저항한다 (판매하려는 것)
   * 판정은 항상 포인터 위치(rawX/rawY)로 하기 때문에 한번 붙었다고 들러붙지 않는다.
   */
  function applyPosition() {
    var inside = G.board.clampPoint(rawX, rawY, cur);
    var outX = rawX - inside.x, outY = rawY - inside.y;
    var outDist = Math.sqrt(outX * outX + outY * outY);

    outside = sellable(cur) && outDist > C.SELL_MARGIN;
    cur.el.classList.toggle('selling', outside);

    if (outDist > 0.5) {
      /* 경계를 넘어선 만큼은 일부만 따라온다 — 끌어낼 때 손에 걸리는 느낌 */
      var pull = Math.min(outDist * C.EDGE_RESIST, C.EDGE_MAX);
      var k = pull / outDist;
      cur.x = inside.x + outX * k;
      cur.y = inside.y + outY * k;
      clearSnap();
      cur.render();
      return;
    }

    updateSnap();
    var tx = rawX, ty = rawY;
    if (snap) {
      tx = U.lerp(rawX, snap.x, C.SNAP_PULL);
      ty = U.lerp(rawY, snap.y, C.SNAP_PULL);
    }
    var c = G.board.clampPoint(tx, ty, cur);
    cur.x = c.x; cur.y = c.y;
    cur.render();
    paintSnap();
  }

  /** 단어는 실수로 팔리면 아까우니 낱글자·덩어리만 판매 대상 */
  function sellable(e) { return e && e.type !== 'word'; }

  /** 드래그가 이어지는 동안 매 프레임 — 단어에 붙이려면 시간이 걸린다 */
  function tick(dt) {
    if (!cur) return;
    if (snap && snap.target.type === 'word') {
      holdT += dt;
      if (holdT >= C.WORD_HOLD && !snap.armed) {
        snap.armed = true;
        G.fx.ring(snap.target.x, snap.target.y,
          { r0: 4, r1: 46, life: .4, c: '47,125,85', lw: 2 });
      }
      paintSnap();
    }
  }

  function onUp() {
    if (!cur) return;
    var e = cur;
    e.dragging = false;
    e.el.classList.remove('drag', 'selling');
    e.resetJumpTimer();

    var s = snap;
    var wasOutside = outside;
    clearSnap();
    cur = null;
    outside = false;

    if (wasOutside && moved) {
      sell(e);
      return;
    }
    /* 밖으로 끌려나왔다가 팔지 않은 경우 다시 안으로 */
    var back = G.board.clampPoint(e.x, e.y, e);
    e.x = back.x; e.y = back.y;

    if (s && s.armed !== false && moved && G.board.get(s.target.id)) {
      doSnap(e, s);
    } else if (moved) {
      e.land();
    }
  }

  /* ------------------------------------------------------------------
     판매 — 보드 밖으로 끌어내 놓으면 조용히 버려진다
     재화는 주지 않고, 남은 생성 쿨다운만 당겨 준다.
     ------------------------------------------------------------------ */
  function sell(e) {
    G.board.remove(e);
    G.state.spawnTimer *= C.SELL_COOLDOWN_CUT;
    G.ui.pulseGauge();
  }

  function onDblClick(ev) {
    var e = entFromEvent(ev);
    if (!e || G.game.paused) return;
    ev.preventDefault();
    if (e.type === 'cluster') {
      G.board.explode(e);
    } else if (e.type === 'word') {
      G.ui.showWordPop(e, ev.clientX, ev.clientY);
    }
  }

  /* ------------------------------------------------------------------
     스냅 후보 찾기
     ------------------------------------------------------------------ */
  /**
   * 붙일 수 있는가?
   * 글자끼리는 아무렇게나 붙일 수 있지만(덩어리가 되어도 괜찮다),
   * 이미 완성된 단어가 끼어 있을 때는 결과도 반드시 단어여야 한다.
   * 그래야 실수로 애써 만든 단어를 의미 없는 덩어리로 만들지 않는다.
   */
  function allowed(a, b, text) {
    if (text.length > C.MAX_CLUSTER) return false;
    if (a.type === 'word' || b.type === 'word') return !!G.lookupWord(text);
    return true;
  }

  function updateSnap() {
    snap = null;
    if (!cur) return;

    var list = G.board.all(), best = null;
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      if (o === cur || o.merging) continue;

      var dy = Math.abs(o.y - rawY);
      if (dy > C.SNAP_DY) continue;

      /* 옆에 갖다 대든 그냥 위에 겹쳐 놓든 붙는다.
         좌우 어느 쪽에 붙일지는 상대의 중심을 기준으로 정한다. */
      var dx = rawX - o.x;
      var reach = o.w / 2 + cur.w / 2 + C.SNAP_DIST;
      if (Math.abs(dx) > reach) continue;

      var wantLeft = dx <= 0;                    // cur 이 왼쪽 → cur + o
      var side = null;
      if (wantLeft && allowed(cur, o, cur.text + o.text)) side = 'left';
      else if (!wantLeft && allowed(cur, o, o.text + cur.text)) side = 'right';
      else if (wantLeft && allowed(cur, o, o.text + cur.text)) side = 'right';
      else if (!wantLeft && allowed(cur, o, cur.text + o.text)) side = 'left';
      if (!side) continue;

      var cand = { target: o, side: side, score: Math.abs(dx) + dy * .8 };
      if (!best || cand.score < best.score) best = cand;
    }

    if (best) {
      var o2 = best.target;
      best.y = o2.y;
      best.x = (best.side === 'left')
        ? o2.x - o2.w / 2 - cur.w / 2 + 2
        : o2.x + o2.w / 2 + cur.w / 2 - 2;

      /* 대상이 바뀌면 "대고 있던 시간" 을 처음부터 */
      if (!snap || snap.target !== o2 || snap.side !== best.side) holdT = 0;

      /* 이미 완성된 단어에 붙이려면 잠깐 대고 있어야 한다 */
      best.armed = (o2.type !== 'word') || (holdT >= C.WORD_HOLD);
      snap = best;
    } else {
      holdT = 0;
    }
  }

  var lastTarget = null;

  /** 붙였을 때 나올 글자열 */
  function snapText() {
    if (!snap) return '';
    return (snap.side === 'left') ? cur.text + snap.target.text
      : snap.target.text + cur.text;
  }

  function paintSnap() {
    if (lastTarget && (!snap || lastTarget !== snap.target)) {
      lastTarget.el.classList.remove('snaptarget');
      lastTarget = null;
    }
    if (!snap || !G.state.opt.snapHint) {
      snapEl.classList.remove('on');
      hintEl.classList.remove('on');
      return;
    }
    snap.target.el.classList.add('snaptarget');
    lastTarget = snap.target;

    var t = snap.target;
    var x = (snap.side === 'left') ? t.x - t.w / 2 : t.x + t.w / 2;
    snapEl.style.height = (t.h - 6) + 'px';
    snapEl.style.transform = 'translate(' + (x - 1) + 'px,' + (t.y - t.h / 2 + 3) + 'px)';
    snapEl.classList.add('on');

    /* 완성되는 단어를 미리 알려 준다 (사전이 크기 때문에 이게 없으면 막막하다) */
    var text = snapText();
    var kind = G.lookupWord(text);
    var ready = snap.armed !== false;
    snapEl.classList.toggle('good', !!kind && ready);
    if (kind) {
      var def = G.defFor(text);
      hintEl.querySelector('.sh-t').textContent = text + '  +' + U.money(def.value);
      hintEl.classList.toggle('ability', kind === 'ability');
      hintEl.classList.toggle('waiting', !ready);
      hintEl.style.color = (kind === 'ability' && ready) ? def.color.fg : '';
      /* 단어에 붙이는 중이면 진행 막대를 채운다 */
      var p = (t.type === 'word') ? Math.min(1, holdT / C.WORD_HOLD) : 1;
      hintEl.querySelector('.sh-p').style.width = (p * 100).toFixed(0) + '%';
      var cx = (cur.x + t.x) / 2;
      hintEl.classList.add('on');
      hintEl.style.transform = 'translate(' + Math.round(cx) + 'px,' +
        Math.round(t.y - t.h / 2 - 28) + 'px) translateX(-50%)';
    } else {
      hintEl.classList.remove('on');
    }
  }

  function clearSnap() {
    if (lastTarget) { lastTarget.el.classList.remove('snaptarget'); lastTarget = null; }
    snapEl.classList.remove('on');
    hintEl.classList.remove('on');
    snap = null;
  }

  /* ------------------------------------------------------------------
     합치기
     ------------------------------------------------------------------ */
  function doSnap(e, s) {
    var t = s.target;
    if (!G.board.get(t.id)) { e.land(); return; }

    /* 딱 맞는 자리로 붙여 놓고, 합쳐질 때까지 아무도 밀지 못하게 잠근다 */
    var c = G.board.clampPoint(s.x, s.y, e);
    e.x = c.x; e.y = c.y;
    e.vx = 0; e.vy = 0;
    e.render();
    e.merging = true; t.merging = true;

    var text = (s.side === 'left') ? e.text + t.text : t.text + e.text;
    var cx = (e.x * e.text.length + t.x * t.text.length) / (e.text.length + t.text.length);
    var cy = t.y;

    setTimeout(function () {
      if (!G.board.get(e.id) || !G.board.get(t.id)) {
        e.merging = false; t.merging = false;
        return;
      }
      merge(e, t, text, cx, cy);
    }, 90);
  }

  function merge(a, b, text, cx, cy) {
    G.board.remove(a);
    G.board.remove(b);

    var kind = G.lookupWord(text);
    var ne;
    if (kind) {
      ne = G.board.makeWord(text, cx, cy);
      ne.el.classList.add('forming');
      setTimeout(function () { if (ne.el) ne.el.classList.remove('forming'); }, 520);
      var col = hexToRgb(ne.def.color.fg);
      var big = kind === 'ability';
      G.fx.burst(cx, cy, col, big ? 24 : 12, big ? 120 : 70);
      G.fx.ring(cx, cy, { r0: 6, r1: big ? 78 : 52, life: .6, c: col, lw: big ? 2 : 1.2 });
      G.game.onWordFormed(ne, false, kind);
    } else {
      ne = new G.Entity('cluster', text, cx, cy);
      var p = G.board.clampPoint(cx, cy, ne);
      ne.x = p.x; ne.y = p.y;
      G.board.add(ne);
      G.fx.spark(cx, cy, { vx: 0, vy: -14, r: 2, life: .4, c: '160,155,148', a: .6 });
    }
    ne.land();
    return ne;
  }

  function hexToRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255);
  }

  function cancel() {
    if (cur) {
      cur.dragging = false;
      cur.el.classList.remove('drag', 'selling');
      var b = G.board.clampPoint(cur.x, cur.y, cur);
      cur.x = b.x; cur.y = b.y;
      cur = null;
    }
    clearSnap();
    outside = false;
  }

  return {
    init: init, cancel: cancel, tick: tick, hexToRgb: hexToRgb,
    get current() { return cur; },
    get snapTarget() { return snap ? snap.target : null; },
    get selling() { return outside; }
  };
})();
