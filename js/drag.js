/* ==========================================================================
   drag.js — 드래그, 스냅, 글자 조합
   플레이어가 직접 끌어다 붙이는 것만이 단어를 만드는 유일한 방법이다.

   붙는 쪽은 언제나 낱글자와 덩어리다. 완성된 단어를 집었을 때는 아무 데도
   달라붙지 않는다 — 다 만든 단어는 자리를 잡아 주는 것이 주된 일이라,
   옮기다가 옆엣것을 삼켜 버리면 곤란하다.
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
  var dev = null;          // 지금 올려놓은 장치 (BOX · FORGE)
  var devT = 0;            // 장치 위에 대고 있은 시간
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
    return U.screenToPlay(playEl, ev.clientX, ev.clientY);
  }

  /* ------------------------------------------------------------------ */

  function onDown(ev) {
    if (G.game.paused || G.ui.penPicking) return;
    var e = entFromEvent(ev);
    if (!e) return;
    ev.preventDefault();

    cur = e;
    moved = false;
    holdT = 0;
    dev = null; devT = 0;
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
    cur.el.classList.toggle('nomerge', cur.afflicted());

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

    updateDevice();
    updateSnap();
    var tx = rawX, ty = rawY;
    if (snap) {
      tx = U.lerp(rawX, snap.x, C.SNAP_PULL);
      ty = U.lerp(rawY, snap.y, C.SNAP_PULL);
    }
    var c = G.board.clampPoint(tx, ty, cur);
    cur.x = c.x; cur.y = c.y;
    cur.render();
    if (dev) paintDevice(); else paintSnap();
  }

  /* ------------------------------------------------------------------
     장치에 넣기 — BOX 와 FORGE

     붙여서 단어를 만드는 것과는 다른 길이다. 옆에 갖다 대는 것이 아니라
     위에 올려놓고 잠깐 기다리는 것이고, 한번 들어가면 되돌릴 수 없다.
     그래서 스냅선 대신 진행 막대를 띄워 "지금 무슨 일이 벌어지는지" 를 먼저 보인다.
     ------------------------------------------------------------------ */

  /** 지금 끌고 있는 것을 받아 줄 장치가 발밑에 있는가 */
  function findDevice() {
    if (!cur || cur.afflicted()) return null;
    var list = G.board.all();
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      if (o === cur || o.type !== 'word' || o.burning) continue;
      if (!U.overlap({ x: rawX, y: rawY, w: cur.w * .5, h: cur.h * .5 }, o)) continue;

      if (o.text === 'BOX' && cur.type === 'letter') {
        return G.behaviors.boxRoom(o) > 0
          ? { t: o, kind: 'box', label: '상자에 넣기', full: false }
          : { t: o, kind: null, label: '상자가 가득 찼다', full: true };
      }
      if (cur.text === 'KEY' && o.text === 'BOX') {
        var kept = (o.data && o.data.kept) || '';
        var stored = Math.round((o.data && o.data.stored) || 0);
        if (!kept.length && !stored) {
          return { t: o, kind: null, full: true, label: '상자가 비어 있다' };
        }
        return {
          t: o, kind: 'unlock', full: false,
          label: '열기 · ' + kept.length + '개 · ' + stored + 'w'
        };
      }
      if (o.text === 'FORGE' && cur.type === 'word') {
        if (!G.behaviors.upgradable(cur)) {
          return { t: o, kind: null, full: true, label: G.WORD_BY_ID[cur.text]
            ? '능력 단어는 걸 수 없다' : '더 올릴 수 없다' };
        }
        var lv = G.behaviors.upLevel(cur);
        var ok = Math.round(C.UP_ODDS[lv] * 100);
        var bad = 100 - ok;
        return {
          t: o, kind: 'up', full: false,
          label: '<span class="up-ok">' + ok + '%</span>' +
            '<span class="up-sep">|</span>' +
            '<span class="up-bad">' + bad + '%</span>'
        };
      }
      if (o.text === 'CRAFT' && (cur.type === 'cluster' || cur.type === 'word' || cur.type === 'letter')) {
        if (G.behaviors.craftable(cur)) {
          return { t: o, kind: 'craft', full: false, label: '바꾸기 · ' + cur.text };
        }
        if (cur.type === 'letter') {
          return { t: o, kind: null, full: true, label: '같은 글자 둘을 먼저 합쳐라' };
        }
        if (cur.type === 'cluster' && cur.text.length === 2 &&
            cur.text.charAt(0) !== cur.text.charAt(1)) {
          return { t: o, kind: null, full: true, label: '같은 글자끼리만 (AA)' };
        }
        if (cur.type === 'cluster') {
          return { t: o, kind: null, full: true, label: '글자 둘만 (AA)' };
        }
        return { t: o, kind: null, full: true, label: '같은 글자 둘(AA)만 넣을 수 있다' };
      }
      /* 보석을 가게에 올려 팔 때 — 드래그로 겹쳐 1초 */
      if (o.text === 'SHOP' && cur.type === 'word' && G.behaviors.sellableGem(cur)) {
        return { t: o, kind: 'shop', label: '팔기', full: false };
      }
      /* 망치를 보석 위로 끌어다 대고 있어야 두드린다 — 보석을 망치에 올리는 길은 없다 */
      if (cur.text === 'HAMMER' && G.behaviors.hammerable(o)) {
        if (G.state.money < C.HAMMER_COST) {
          return { t: o, kind: null, full: true, label: '내리치기 ' + C.HAMMER_COST + 'w 필요' };
        }
        return { t: o, kind: 'hammer', label: '내리치기 · ' + C.HAMMER_COST + 'w', full: false };
      }
      if (cur.text === 'HAMMER' && o.type === 'word' &&
          ['GOLD', 'RUBY', 'DIAMOND', 'EMERALD'].indexOf(o.text) >= 0 && o.data.worth) {
        return { t: o, kind: null, label: '이미 두드렸다', full: true };
      }
    }
    return null;
  }

  function updateDevice() {
    var d = findDevice();
    if (!d || !dev || d.t !== dev.t || d.kind !== dev.kind) devT = 0;
    dev = d;
  }

  function paintDevice() {
    if (!dev) return;
    if (lastTarget) { lastTarget.el.classList.remove('snaptarget'); lastTarget = null; }
    snapEl.classList.remove('on');
    var need = C.DEVICE_HOLD;
    var p = dev.kind ? Math.min(1, devT / need) : 0;
    var tEl = hintEl.querySelector('.sh-t');
    if (dev.kind === 'up') tEl.innerHTML = dev.label;
    else tEl.textContent = dev.label;
    hintEl.querySelector('.sh-p').style.width = (p * 100).toFixed(0) + '%';
    hintEl.classList.remove('ability', 'growing', 'forge');
    if (dev.kind === 'up') {
      hintEl.classList.add('forge');
      hintEl.classList.remove('waiting');
    } else {
      hintEl.classList.toggle('waiting', p < 1);
    }
    hintEl.style.color = '';
    hintEl.classList.add('on');
    hintEl.style.transform = 'translate(' + Math.round(dev.t.x) + 'px,' +
      Math.round(dev.t.y - dev.t.h / 2 - 28) + 'px) translateX(-50%)';
  }

  /** 대고 있던 시간이 다 찼다 */
  function runDevice() {
    var d = dev, e = cur;
    dev = null; devT = 0;
    clearSnap();
    cancel();                                   // 손에서 놓은 것으로 친다
    if (d.kind === 'box') G.behaviors.putInBox(d.t, e);
    else if (d.kind === 'up') G.behaviors.runUpgrade(d.t, e);
    else if (d.kind === 'hammer') G.behaviors.strikeGem(e, d.t);
    else if (d.kind === 'shop') G.behaviors.sellGem(d.t, e);
    else if (d.kind === 'craft') G.behaviors.putInCraft(d.t, e);
    else if (d.kind === 'unlock') G.behaviors.openBox(e, d.t);
  }

  /**
   * 버릴 수 있는 것은 낱글자뿐이다.
   * 덩어리도 애써 붙여 놓은 것이고 더 긴 단어로 가는 도중일 수 있으니 지키고,
   * 정말 흩고 싶으면 더블클릭으로 낱글자로 되돌린 뒤 하나씩 버리면 된다.
   *
   * 예외가 하나 있다. 파는 것이 곧 쓰는 것인 단어(TIME)는 완성된 채로도 끌어낼 수 있다.
   */
  function sellable(e) {
    if (!e) return false;
    if (e.type === 'letter') return true;
    if (e.type !== 'word' || !e.def.sellable || e.afflicted()) return false;
    /* PEN 은 고른 글자가 들어갈 자리가 있어야 한다 — 가득 차면 못 버린다 */
    if (e.text === 'PEN' && G.board.count() >= G.maxEntities()) return false;
    return true;
  }

  /**
   * 완성된 단어에 붙이는 것인가.
   * 붙는 순간 단어 하나가 사라지는 셈이라, 잠깐 대고 있어야 실행된다.
   */
  function needsHold(target) {
    return target.type === 'word';
  }

  /** 대고 있어야 하는 시간 — 강화된 단어는 더 길다 */
  function holdNeed(target) {
    if (!needsHold(target)) return 0;
    return (target.data && target.data.up) ? C.STAR_HOLD : C.WORD_HOLD;
  }

  /** 드래그가 이어지는 동안 매 프레임 — 단어에 붙이거나 장치에 넣으려면 시간이 걸린다 */
  function tick(dt) {
    if (!cur) return;
    if (dev) {
      if (dev.kind) {
        devT += dt;
        if (devT >= C.DEVICE_HOLD) { runDevice(); return; }
      }
      paintDevice();
      return;
    }
    if (snap && needsHold(snap.target)) {
      holdT += dt;
      if (holdT >= holdNeed(snap.target) && !snap.armed) {
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
    e.el.classList.remove('drag', 'selling', 'nomerge');
    e.resetJumpTimer();

    var s = snap;
    var wasOutside = outside;
    clearSnap();
    cur = null;
    dev = null; devT = 0;
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
    var time = e.type === 'word' && e.text === 'TIME';
    var pen = e.type === 'word' && e.text === 'PEN';
    /* 버리는 순간에 다시 한 번 — 그사이에 글자가 들어왔을 수 있다 */
    if (pen && G.board.count() >= G.maxEntities()) {
      var back = G.board.clampPoint(e.x, e.y, e);
      e.x = back.x; e.y = back.y;
      e.land();
      G.ui.toast('보드가 가득 차 있어 <b>PEN</b> 을 버릴 수 없다');
      return;
    }
    if (time) {
      G.fx.burst(e.x, e.y, '140,138,170', 22, 110);
      G.fx.ring(e.x, e.y, { r0: 6, r1: 88, life: .7, c: '140,138,170', lw: 1.6 });
    }
    if (pen) {
      G.fx.burst(e.x, e.y, '90,120,160', 18, 100);
      G.fx.ring(e.x, e.y, { r0: 6, r1: 80, life: .55, c: '90,120,160', lw: 1.5 });
    }
    G.board.remove(e);
    if (time) G.game.sellTime();
    if (pen) G.ui.openPenPick();
    G.game.soldOne();
    G.ui.pulseGauge();
  }

  function onDblClick(ev) {
    var e = entFromEvent(ev);
    if (!e || G.game.paused || G.ui.penPicking) return;
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
   * 글자·덩어리끼리는 아무렇게나 붙일 수 있다 (덩어리가 되어도 괜찮다).
   *
   * 완성된 단어에 붙일 때는 결과가 단어이거나, 적어도 글자를 더 붙이면
   * 단어가 될 조각이어야 한다 — MOTH 에 E 를 붙여 MOTHE 로 두었다가 R 을 마저
   * 붙여 MOTHER 로 키우는 식이다. 아무 데로도 이어지지 않는 조각이면 애써 만든
   * 단어가 그냥 망가지는 것이라 막는다. (덩어리는 더블클릭으로 되돌릴 수 있다)
   */
  function allowed(a, b, text) {
    if (text.length > C.MAX_CLUSTER) return false;
    if (a.type === 'word' || b.type === 'word') {
      return !!G.lookupWord(text) || G.canGrow(text);
    }
    return true;
  }

  function updateSnap() {
    /* 직전 후보를 기억해 둔다. 여기서 snap 을 먼저 비워 버리면 아래에서
       "대상이 바뀌었나" 를 물을 때 언제나 바뀐 것으로 읽혀, 손이 조금만
       흔들려도 대고 있던 시간이 0 으로 돌아간다 */
    var prev = snap;
    snap = null;
    if (!cur || cur.type === 'word' || cur.afflicted()) return;
    if (dev) { holdT = 0; return; }        // 장치 위에 올려 둔 동안은 붙이지 않는다

    var list = G.board.all(), best = null;
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      if (o === cur || o.merging || o.afflicted()) continue;

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
      if (!prev || prev.target !== o2 || prev.side !== best.side) holdT = 0;

      /* 단어가 걸려 있으면 잠깐 대고 있어야 한다 */
      best.armed = !needsHold(o2) || (holdT >= holdNeed(o2));
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
    hintEl.classList.remove('risky', 'forge');
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

    /* 완성되는 단어를 미리 알려 준다 (사전이 크기 때문에 이게 없으면 막막하다).
       아직 단어가 아니어도 더 붙이면 단어가 될 조각이면 그것도 알려 준다 */
    var text = snapText();
    var kind = G.lookupWord(text);
    var ready = snap.armed !== false;
    var growing = !kind && text.length >= 4 && G.canGrow(text);
    snapEl.classList.toggle('good', !!kind && ready);

    if (!kind && !growing) { hintEl.classList.remove('on'); return; }

    if (kind) {
      var def = G.defFor(text);
      hintEl.querySelector('.sh-t').textContent = text + '  +' + U.money(def.value);
      hintEl.classList.toggle('ability', kind === 'ability');
      hintEl.style.color = (kind === 'ability' && ready) ? def.color.fg : '';
    } else {
      hintEl.querySelector('.sh-t').textContent = text + '…';
      hintEl.classList.remove('ability');
      hintEl.style.color = '';
    }
    hintEl.classList.toggle('growing', growing);
    hintEl.classList.toggle('waiting', !ready);

    /* 단어가 걸려 있으면 진행 막대를 채운다 */
    var p = needsHold(t) ? Math.min(1, holdT / holdNeed(t)) : 1;
    hintEl.querySelector('.sh-p').style.width = (p * 100).toFixed(0) + '%';
    var cx = (cur.x + t.x) / 2;
    hintEl.classList.add('on');
    hintEl.style.transform = 'translate(' + Math.round(cx) + 'px,' +
      Math.round(t.y - t.h / 2 - 28) + 'px) translateX(-50%)';
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
    if (!G.board.get(t.id) || e.afflicted() || t.afflicted()) { e.land(); return; }

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
      if (!G.board.get(e.id) || !G.board.get(t.id) || e.afflicted() || t.afflicted()) {
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
      cur.el.classList.remove('drag', 'selling', 'nomerge');
      var b = G.board.clampPoint(cur.x, cur.y, cur);
      cur.x = b.x; cur.y = b.y;
      cur = null;
    }
    clearSnap();
    dev = null; devT = 0;
    outside = false;
  }

  return {
    init: init, cancel: cancel, tick: tick, hexToRgb: hexToRgb,
    get current() { return cur; },
    get snapTarget() { return snap ? snap.target : null; },
    get selling() { return outside; }
  };
})();
