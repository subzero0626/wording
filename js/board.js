/* ==========================================================================
   board.js — 보드(세계) 관리
   오브젝트 목록, 놀이영역 크기/확장, 글자 생성, 충돌 분리, 수입 집계
   ========================================================================== */
var G = window.G || (window.G = {});

G.board = (function () {
  var U = G.util, C = G.C;

  var playEl, layerEl, fxEl, boardEl;
  var ents = [];
  var byId = {};
  var W = 800, H = 600;

  /* ------------------------------------------------------------------
     초기화 / 레이아웃
     ------------------------------------------------------------------ */
  function init() {
    boardEl = document.getElementById('board');
    playEl = document.getElementById('play');
    layerEl = document.getElementById('layer');
    fxEl = document.getElementById('fx');
    G.fx.init(fxEl);
    layout();
    window.addEventListener('resize', function () { layout(); });
  }

  function available() {
    var bw = boardEl.clientWidth, bh = boardEl.clientHeight;
    return {
      w: Math.max(320, bw - C.BOARD_MARGIN * 2 - 44),
      h: Math.max(280, bh - C.BOARD_MARGIN * 2 - 46)
    };
  }

  function layout(animateShift) {
    var a = available();
    var s = C.EXPAND_SCALE[Math.min(G.state.expandLevel, C.EXPAND_SCALE.length - 1)];
    var nw = Math.round(a.w * s), nh = Math.round(a.h * s);
    var dw = nw - W, dh = nh - H;

    W = nw; H = nh;
    playEl.style.width = W + 'px';
    playEl.style.height = H + 'px';
    G.fx.resize(W, H);

    /* 중앙 기준으로 커지므로 기존 오브젝트를 시각적으로 제자리에 둔다 */
    if (animateShift && (dw || dh)) {
      for (var i = 0; i < ents.length; i++) {
        ents[i].x += dw / 2;
        ents[i].y += dh / 2;
      }
    }
    for (var j = 0; j < ents.length; j++) {
      var p = clampPoint(ents[j].x, ents[j].y, ents[j]);
      ents[j].x = p.x; ents[j].y = p.y;
    }
  }

  function size() { return { w: W, h: H }; }

  function clampPoint(x, y, ent) {
    var hw = ent ? ent.w / 2 + 3 : 6, hh = ent ? ent.h / 2 + 3 : 6;
    return {
      x: U.clamp(x, hw, W - hw),
      y: U.clamp(y, hh, H - hh)
    };
  }

  /* ------------------------------------------------------------------
     오브젝트 목록
     ------------------------------------------------------------------ */
  function add(e) {
    ents.push(e);
    byId[e.id] = e;
    layerEl.appendChild(e.el);
    e.measure();              // DOM 에 붙은 뒤 실제 글자 폭을 잰다
    e.render();
    return e;
  }

  function remove(e) {
    var i = ents.indexOf(e);
    if (i >= 0) ents.splice(i, 1);
    delete byId[e.id];
    // 이 오브젝트를 참조하던 상태 정리
    for (var k = 0; k < ents.length; k++) {
      if (ents[k].heldBy === e.id) ents[k].heldBy = null;
      if (ents[k].data && ents[k].data.carry === e.id) ents[k].data.carry = null;
    }
    G.contacts.dropAll(e.id);
    e.destroy();
  }

  function all() { return ents; }
  function get(id) { return byId[id]; }
  /**
   * 정원에 잡히는 수.
   * 오브젝트 하나를 하나로 세면, 자리가 모자랄 때 아무 글자나 둘씩 붙여 세워
   * 두는 것이 곧 확장이 된다 (뜻 없는 CQ 덩어리 하나 = 한 칸). 그러면
   * 확장을 살 이유도, 자리가 모자라다는 긴장도 사라진다.
   * 자리를 돌려주는 것은 **뜻이 있는 단어가 되었을 때**뿐이다 — 뜻 없이 붙여 놓은
   * 덩어리는 붙여 놓았어도 여전히 글자 수만큼 자리를 먹는다.
   */
  function count() {
    var n = 0;
    for (var i = 0; i < ents.length; i++) {
      n += ents[i].type === 'word' ? 1 : ents[i].text.length;
    }
    return n;
  }

  function words() {
    var r = [];
    for (var i = 0; i < ents.length; i++) if (ents[i].type === 'word') r.push(ents[i]);
    return r;
  }

  function loose() {   // 낱글자 + 클러스터
    var r = [];
    for (var i = 0; i < ents.length; i++) if (ents[i].type !== 'word') r.push(ents[i]);
    return r;
  }

  /** 반경 안의 오브젝트 (자기 자신 제외) */
  function near(e, range, filter) {
    var r = [], r2 = range * range;
    for (var i = 0; i < ents.length; i++) {
      var o = ents[i];
      if (o === e) continue;
      if (U.dist2(e.x, e.y, o.x, o.y) > r2) continue;
      if (filter && !filter(o)) continue;
      r.push(o);
    }
    return r;
  }

  function nearest(e, range, filter) {
    var best = null, bd = range * range;
    for (var i = 0; i < ents.length; i++) {
      var o = ents[i];
      if (o === e) continue;
      if (filter && !filter(o)) continue;
      var d = U.dist2(e.x, e.y, o.x, o.y);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  /** 이 위치가 얼마나 붐비는지 (점프 착지 지점 고르기) */
  function crowdScore(x, y, self) {
    var s = 0;
    var box = { x: x, y: y, w: self.w + 8, h: self.h + 8 };
    for (var i = 0; i < ents.length; i++) {
      var o = ents[i];
      if (o === self) continue;
      var ov = U.overlap(box, o);
      if (ov) s += ov.ox * ov.oy;
    }
    return s;
  }

  /* ------------------------------------------------------------------
     글자 생성
     ------------------------------------------------------------------ */
  function freeSpot(w, h) {
    var best = null;
    for (var i = 0; i < 24; i++) {
      var x = U.rand(w / 2 + 8, W - w / 2 - 8);
      var y = U.rand(h / 2 + 8, H - h / 2 - 8);
      var s = 0;
      for (var j = 0; j < ents.length; j++) {
        var ov = U.overlap({ x: x, y: y, w: w + 14, h: h + 14 }, ents[j]);
        if (ov) s += ov.ox * ov.oy;
      }
      if (!best || s < best.s) best = { x: x, y: y, s: s };
      if (s === 0) break;
    }
    return best;
  }

  function spawnLetter(ch, x, y) {
    ch = ch || G.randomLetter();
    var e = new G.Entity('letter', ch, 0, 0);
    if (x === undefined) {
      var sp = freeSpot(e.w, e.h);
      e.x = sp.x; e.y = sp.y;
    } else {
      var p = clampPoint(x, y, e);
      e.x = p.x; e.y = p.y;
    }
    add(e);
    e.born();
    G.fx.ring(e.x, e.y, { r0: 4, r1: 30, life: .45, c: '150,145,138', lw: 1 });
    return e;
  }

  /** 단어 오브젝트 생성 */
  function makeWord(id, x, y) {
    var e = new G.Entity('word', id, x, y);
    var p = clampPoint(x, y, e);
    e.x = p.x; e.y = p.y;
    add(e);
    return e;
  }

  /**
   * 단어/클러스터를 낱글자로 되돌린다.
   *
   * 정원이 모자라면 흩지 않는다. 예전에는 그냥 흩어져서, 스무 칸짜리 보드에
   * 여덟 글자 단어를 분해하면 정원을 일곱이나 넘겨 버렸다 — 새 글자는 안 나오는데
   * 보드만 미어터지는 상태가 되어 무엇 하나 만들 수 없었다.
   *
   * @return 흩었으면 true
   */
  function explode(e) {
    var text = e.text, n = text.length;
    var cx = e.x, cy = e.y;
    /* 지금 이 오브젝트가 먹고 있는 자리(단어는 한 칸, 덩어리는 글자 수)를 빼고
       셈한다. 뜻 없는 덩어리를 도로 흩는 것은 자리를 늘리지도 줄이지도 않는다 */
    var mine = e.type === 'word' ? 1 : n;
    if (count() - mine + n > G.maxEntities()) {
      G.ui.toast('자리가 모자라 <b>' + text + '</b> 를 흩을 수 없다');
      G.fx.ring(cx, cy, { r0: 10, r1: 46, life: .4, c: '190,120,110', lw: 1.5 });
      return false;
    }
    remove(e);
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2 + U.rand(-.3, .3);
      var d = 26 + n * 5;
      var L = spawnLetter(text[i], cx + Math.cos(a) * d, cy + Math.sin(a) * d);
      L.vx = Math.cos(a) * 70;
      L.vy = Math.sin(a) * 70;
    }
    G.fx.burst(cx, cy, '160,155,148', 12, 70);
    return true;
  }

  /* ------------------------------------------------------------------
     매 프레임
     ------------------------------------------------------------------ */
  function step(dt) {
    var i, e;

    /* 1. 필드 효과 초기화 (SUN/MOON 같은 장 효과가 매 프레임 다시 칠한다) */
    for (i = 0; i < ents.length; i++) {
      e = ents[i];
      e.speedMul = 1;
      e.incomeMul = 1;
      e.payMul = 1;           // SUN 이 당기는 벌이 주기
      e.gearMul = 1;          // 톱니바퀴가 맞물려 얻는 배수 (상한과 따로 논다)
      /* 숯이 지핀 불기운과 상자에 들어앉은 고양이. 다른 장 효과와 달리 짧게
         남겨 두는데, 둘 중 어느 쪽 차례가 먼저 오든 같게 굴리려는 것이다 */
      e.data.stokeT = Math.max(0, (e.data.stokeT || 0) - dt);
      e.stoke = e.data.stokeT > 0 ? C.COAL_STOKE : 1;
      e.data.catT = Math.max(0, (e.data.catT || 0) - dt);
      e.boxMul = e.data.catT > 0 ? C.CAT_BOX : 1;
      e.calm = false;
      e.heldBy = null;
    }

    /* 2. 단어 행동 + 상호작용 */
    G.behaviors.step(dt);

    /* 3. 개별 업데이트 */
    for (i = 0; i < ents.length; i++) ents[i].update(dt);

    /* 4. 겹침 분리 */
    separate(dt);

    /* 5. 렌더 + 상시 파티클 */
    for (i = 0; i < ents.length; i++) {
      e = ents[i];
      e.render();
      G.fx.ambient(e, dt);
    }
  }

  /** 조합하려고 끌고 온 것을 밀어내면 안 된다 (이게 없으면 붙이려 할 때 도망간다) */
  function noPush(a, b) {
    if (a.merging || b.merging) return true;
    if (!a.dragging && !b.dragging) return false;
    if (G.drag.selling) return true;                 // 판매하려고 밖으로 빼는 중
    var drag = a.dragging ? a : b, other = a.dragging ? b : a;
    if (G.drag.snapTarget === other) return true;    // 지금 붙이려는 상대
    return drag.type !== 'word' && other.type !== 'word';  // 글자끼리는 자유롭게 겹친다
  }

  /**
   * 이 둘이 서로를 밀어내기 시작하는 거리.
   * 보통은 글자 상자보다 PUSH_SHRINK 만큼 좁게 잡는다 — 딱 맞게 잡으면
   * 스치기만 해도 서로 비켜서서 보드가 실제보다 빽빽해 보인다.
   * 자석끼리만은 같은 극처럼 굴어 보통 거리의 몇 배로 벌어진다.
   * 벽에는 이 너그러움을 주지 않는다 — 벽은 파고들 수 없어야 벽이다.
   */
  function pushBox(e, other) {
    var mul = (e.type === 'word' && other.type === 'word' &&
      e.text === 'MAGNET' && other.text === 'MAGNET') ? C.MAGNET_PUSH : 1;
    var shrink = (isSolid(e) || isSolid(other)) ? 0 : C.PUSH_SHRINK;
    return {
      x: e.x, y: e.y,
      w: Math.max(8, e.w * mul - shrink),
      h: Math.max(8, e.h * mul - shrink)
    };
  }

  /* ------------------------------------------------------------------
     벽 — 지나갈 수 없는 것
     ------------------------------------------------------------------
     WALL 은 제자리에서 꿈쩍하지 않고, 뛰어다니는 것들이 그 너머로 넘어가지
     못하게 막는다. 밀어내기(separate)만으로는 벽이 되지 않는다 — 점프는
     출발점에서 도착점으로 곧장 이어 붙이는 것이라, 벽 위를 훌쩍 건너뛰어
     반대편에 내려앉아 버리기 때문이다. 그래서 뛸 자리를 고를 때 아예
     "가는 길에 벽이 있는가" 를 묻고, 관성으로 미끄러질 때에도 같은 것을 묻는다.
     들고 옮기는 손만은 막지 않는다. 무엇을 어느 쪽에 둘지 정하는 것이
     이 단어를 세우는 이유인데, 그 결정까지 막으면 벽이 아니라 함정이 된다. */

  function isSolid(e) {
    return e.type === 'word' && e.def && e.def.solid && !e.dragging;
  }

  /** 선분이 사각형과 닿는가 (Liang-Barsky) */
  function segBox(x0, y0, x1, y1, cx, cy, hw, hh) {
    var dx = x1 - x0, dy = y1 - y0, t0 = 0, t1 = 1;
    var p = [-dx, dx, -dy, dy];
    var q = [x0 - (cx - hw), (cx + hw) - x0, y0 - (cy - hh), (cy + hh) - y0];
    for (var i = 0; i < 4; i++) {
      if (p[i] === 0) { if (q[i] < 0) return false; continue; }
      var r = q[i] / p[i];
      if (p[i] < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
      else { if (r < t0) return false; if (r < t1) t1 = r; }
    }
    return true;
  }

  /**
   * (x0,y0) 에서 (x1,y1) 로 가는 길을 벽이 막고 있는가.
   * 이미 벽에 걸쳐 서 있는 것은 그 벽을 무시한다 — 그러지 않으면 어느 쪽으로도
   * 못 가고 영영 붙박인다 (밀어내기가 곧 밖으로 빼 준다).
   */
  function blocked(x0, y0, x1, y1, ent) {
    var hw = ent ? ent.w / 2 : 6, hh = ent ? ent.h / 2 : 6;
    for (var i = 0; i < ents.length; i++) {
      var w = ents[i];
      if (w === ent || !isSolid(w)) continue;
      var bw = w.w / 2 + hw - C.PUSH_SHRINK, bh = w.h / 2 + hh - C.PUSH_SHRINK;
      if (segBox(x0, y0, x0, y0, w.x, w.y, bw, bh)) continue;   // 이미 걸쳐 있다
      if (segBox(x0, y0, x1, y1, w.x, w.y, bw, bh)) return true;
    }
    return false;
  }

  function separate(dt) {
    var n = ents.length, i, j, a, b, ov;
    for (i = 0; i < n; i++) {
      a = ents[i];
      if (a.def && a.def.ghost) continue;
      for (j = i + 1; j < n; j++) {
        b = ents[j];
        if (b.def && b.def.ghost) continue;
        if (noPush(a, b)) continue;
        ov = U.overlap(pushBox(a, b), pushBox(b, a));
        if (!ov) continue;

        var pushX = 0, pushY = 0;
        if (ov.ox < ov.oy) pushX = (ov.dx >= 0 ? 1 : -1) * ov.ox;
        else pushY = (ov.dy >= 0 ? 1 : -1) * ov.oy;

        var aFixed = a.dragging || (a.def && a.def.heavy) || a.jump;
        var bFixed = b.dragging || (b.def && b.def.heavy) || b.jump;
        var k = Math.min(1, dt * 9);

        if (aFixed && bFixed) {
          /* 둘 다 고정이면 보통은 그대로 두지만, 무거운 것끼리 영원히 겹쳐
             있는 것은 막는다 (아주 천천히 서로 비켜난다) */
          if (a.dragging || b.dragging || a.jump || b.jump) continue;
          var kk = Math.min(1, dt * 1.6);
          a.x -= pushX * .5 * kk; a.y -= pushY * .5 * kk;
          b.x += pushX * .5 * kk; b.y += pushY * .5 * kk;
          var qa = clampPoint(a.x, a.y, a); a.x = qa.x; a.y = qa.y;
          var qb = clampPoint(b.x, b.y, b); b.x = qb.x; b.y = qb.y;
          continue;
        }
        if (aFixed) {
          b.x += pushX * k; b.y += pushY * k;
        } else if (bFixed) {
          a.x -= pushX * k; a.y -= pushY * k;
        } else {
          a.x -= pushX * .5 * k; a.y -= pushY * .5 * k;
          b.x += pushX * .5 * k; b.y += pushY * .5 * k;
        }
        var pa = clampPoint(a.x, a.y, a); a.x = pa.x; a.y = pa.y;
        var pb = clampPoint(b.x, b.y, b); b.x = pb.x; b.y = pb.y;
      }
    }
  }

  /* ------------------------------------------------------------------
     경제
     ------------------------------------------------------------------ */
  /** 보드 전체가 20초에 버는 총액 (표시용) */
  function payRate() {
    var sum = 0;
    for (var i = 0; i < ents.length; i++) sum += ents[i].rate();
    return sum;
  }

  /**
   * 수입 지급. BANK 가 있으면 일부를 금고로 돌린다.
   * 화면에 숫자를 띄우는 것은 부르는 쪽 몫이다 (여기서도 띄우면 두 번 겹친다).
   */
  function earn(amount) {
    if (amount <= 0) return;
    var banks = 0;
    for (var i = 0; i < ents.length; i++) {
      if (ents[i].type === 'word' && ents[i].text === 'BANK' && !ents[i].burning) banks++;
    }
    if (banks) {
      /* 금고가 꽉 차면 더 떼어 가지 않는다 — 맡길 데가 없는데 계속 떼면
         은행이 서 있는 것 자체가 손해가 된다 */
      var room = G.vaultMax(banks) - (G.state.vault || 0);
      if (room > 0) {
        var cut = Math.min(room, amount * G.C.BANK_CUT);
        amount -= cut;
        G.state.vault = (G.state.vault || 0) + cut;
      }
    }
    G.state.money += amount;
    G.state.totalEarned = (G.state.totalEarned || 0) + amount;
  }

  function spend(amount) {
    if (G.state.money < amount) return false;
    G.state.money -= amount;
    return true;
  }

  /* ------------------------------------------------------------------
     확장
     ------------------------------------------------------------------ */
  function expandCost() {
    if (G.state.expandLevel >= C.EXPAND_COSTS.length) return null;
    return C.EXPAND_COSTS[G.state.expandLevel];
  }

  function expand() {
    var c = expandCost();
    if (c === null || !spend(c)) return false;
    G.state.expandLevel++;
    layout(true);
    playEl.classList.remove('expanding');
    void playEl.offsetWidth;
    playEl.classList.add('expanding');
    G.fx.ring(W / 2, H / 2, { r0: 20, r1: Math.max(W, H) * .6, life: .8, c: '90,150,120', lw: 2 });
    G.ui.toast('보드가 넓어졌다');
    return true;
  }

  return {
    init: init, layout: layout, size: size,
    add: add, remove: remove, all: all, get: get, count: count,
    words: words, loose: loose, near: near, nearest: nearest,
    clampPoint: clampPoint, crowdScore: crowdScore, freeSpot: freeSpot,
    spawnLetter: spawnLetter, makeWord: makeWord, explode: explode,
    blocked: blocked,
    step: step, earn: earn, spend: spend, payRate: payRate,
    expandCost: expandCost, expand: expand,
    get el() { return playEl; }
  };
})();
