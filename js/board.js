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
  function count() { return ents.length; }

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

  /** 단어/클러스터를 낱글자로 되돌린다 */
  function explode(e, silent) {
    var text = e.text, n = text.length;
    var cx = e.x, cy = e.y;
    remove(e);
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2 + U.rand(-.3, .3);
      var d = 26 + n * 5;
      var L = spawnLetter(text[i], cx + Math.cos(a) * d, cy + Math.sin(a) * d);
      L.vx = Math.cos(a) * 70;
      L.vy = Math.sin(a) * 70;
    }
    if (!silent) G.fx.burst(cx, cy, '160,155,148', 12, 70);
  }

  /* ------------------------------------------------------------------
     매 프레임
     ------------------------------------------------------------------ */
  function step(dt) {
    var i, e;

    /* 1. 필드 효과 초기화 (CLOCK/TIME 이 매 프레임 다시 칠한다) */
    for (i = 0; i < ents.length; i++) {
      e = ents[i];
      e.speedMul = 1;
      e.hazardMul = 1;
      e.incomeMul = 1;
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

  function separate(dt) {
    var n = ents.length, i, j, a, b, ov;
    for (i = 0; i < n; i++) {
      a = ents[i];
      if (a.def && a.def.ghost) continue;
      for (j = i + 1; j < n; j++) {
        b = ents[j];
        if (b.def && b.def.ghost) continue;
        if (noPush(a, b)) continue;
        ov = U.overlap(a, b);
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
    for (var i = 0; i < ents.length; i++) sum += ents[i].payValue() * ents[i].incomeMul;
    return sum;
  }

  /**
   * 수입 지급. BANK 가 있으면 일부를 금고로 돌린다.
   * @param silent  숫자 팝업 없이
   */
  function earn(amount, at, silent) {
    if (amount <= 0) return;
    var banks = [];
    for (var i = 0; i < ents.length; i++) {
      if (ents[i].type === 'word' && ents[i].text === 'BANK' && !ents[i].burning) banks.push(ents[i]);
    }
    if (banks.length) {
      var cut = amount * Math.min(0.3, 0.22 * banks.length);
      amount -= cut;
      var b = banks[0];
      b.data.vault = (b.data.vault || 0) + cut;
    }
    G.state.money += amount;
    G.state.totalEarned = (G.state.totalEarned || 0) + amount;
    if (!silent && at) G.ui.floatMoney(at.x, at.y, amount);
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
    step: step, earn: earn, spend: spend, payRate: payRate,
    expandCost: expandCost, expand: expand,
    get el() { return playEl; }
  };
})();
