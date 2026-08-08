/* ==========================================================================
   behaviors.js — 단어의 행동
   --------------------------------------------------------------------------
   FIELDS[단어]  : 매 프레임 지속되는 "장(場)" 효과 (끌어당김, 얼림, 가속…)
   ACTIONS[key]  : def.actEvery 주기로 한 번씩 일어나는 사건
   BONDS[key]    : "가까이 + 일정 시간" 이 유지되어야 발동하는 상호작용
   ========================================================================== */
var G = window.G || (window.G = {});

/* --------------------------------------------------------------------------
   접촉 타이머
   -------------------------------------------------------------------------- */
G.contacts = (function () {
  var map = {};

  function key(a, b, k) { return a + '>' + b + '|' + k; }

  function accum(a, b, k, dt, need) {
    var kk = key(a.id, b.id, k);
    var e = map[kk];
    if (!e) { e = map[kk] = { t: 0, f: 0 }; }
    e.f = G.behaviors.frame();
    e.t += dt;
    return e;
  }

  function progress(a, b, k, need) {
    var e = map[key(a.id, b.id, k)];
    return e ? Math.max(0, Math.min(1, e.t / need)) : 0;
  }

  function reset(a, b, k) {
    var kk = key(a.id, b.id, k);
    if (map[kk]) map[kk].t = 0;
  }

  function clear(a, b, k, cool) {
    var kk = key(a.id, b.id, k);
    if (map[kk]) map[kk].t = -(cool || 0);
  }

  /** 이번 프레임에 갱신되지 않은 접촉은 즉시 초기화(= 떨어뜨리면 리셋) */
  function sweep(f) {
    for (var k in map) {
      if (map[k].f !== f) delete map[k];
    }
  }

  function dropAll(id) {
    for (var k in map) {
      if (k.indexOf(id + '>') === 0 || k.indexOf('>' + id + '|') > 0) delete map[k];
    }
  }

  function serialize() { return map; }
  function restore(m) { map = m || {}; }

  return {
    accum: accum, progress: progress, reset: reset, clear: clear,
    sweep: sweep, dropAll: dropAll, serialize: serialize, restore: restore
  };
})();

/* --------------------------------------------------------------------------
   SHOP 토큰 (클릭해서 줍는 특가)
   -------------------------------------------------------------------------- */
G.tokens = (function () {
  var list = [];
  var layer;

  function init() { layer = document.getElementById('layer'); }

  function spawn(x, y, value) {
    var el = document.createElement('div');
    el.className = 'token';
    el.textContent = 'w';
    el.style.left = (x - 17) + 'px';
    el.style.top = (y - 17) + 'px';
    layer.appendChild(el);
    var t = { el: el, x: x, y: y, value: value, life: 0, max: 16 };
    el.addEventListener('pointerdown', function (ev) {
      ev.stopPropagation();
      take(t);
    });
    list.push(t);
    return t;
  }

  function take(t) {
    if (t.dead) return;
    t.dead = true;
    G.board.earn(t.value);
    G.ui.floatMoney(t.x, t.y, t.value);
    G.fx.coins(t.x, t.y, 10);
    kill(t);
  }

  function kill(t) {
    t.el.classList.add('gone');
    var el = t.el;
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 280);
    var i = list.indexOf(t);
    if (i >= 0) list.splice(i, 1);
  }

  function step(dt) {
    for (var i = list.length - 1; i >= 0; i--) {
      var t = list[i];
      t.life += dt;
      if (t.life > t.max) { t.dead = true; kill(t); continue; }
      if (t.life > t.max - 4) t.el.style.opacity = String(0.25 + 0.75 * Math.abs(Math.sin(t.life * 6)));
    }
  }

  function clearAll() {
    for (var i = list.length - 1; i >= 0; i--) kill(list[i]);
  }

  return { init: init, spawn: spawn, step: step, clearAll: clearAll, count: function () { return list.length; } };
})();

/* --------------------------------------------------------------------------
   행동
   -------------------------------------------------------------------------- */
G.behaviors = (function () {
  var U = G.util, C = G.C;
  var frameNo = 0;

  function frame() { return frameNo; }

  /** 프레임 단위 누적기 (범위를 벗어나면 자동으로 0 으로 돌아간다) */
  function acc(e, key, dt) {
    var k = '_' + key, kf = k + 'F';
    if (e[kf] !== frameNo - 1 && e[kf] !== frameNo) e[k] = 0;
    e[k] = (e[k] || 0) + dt;
    e[kf] = frameNo;
    return e[k];
  }

  function isWord(id) { return function (o) { return o.type === 'word' && o.text === id; }; }
  function isLoose(o) { return o.type !== 'word' && !o.dragging; }
  function isAnyWord(ids) {
    return function (o) { return o.type === 'word' && ids.indexOf(o.text) >= 0; };
  }

  function rgb(hex) { return G.drag.hexToRgb(hex); }

  /**
   * 사건 보상액.
   * 평생 수입(totalEarned)에 비례시키면 벌수록 사건이 커지는 눈덩이가 되므로,
   * 지금 보드가 20초에 버는 양(payRate)을 기준으로 "몇 초치"인지로 정한다.
   * @param mul  payRate 배수 (1 이면 20초치)
   * @param flat 보드가 작을 때를 위한 최소분
   */
  function reward(mul, flat) {
    return Math.max(1, Math.round(flat + G.board.payRate() * mul));
  }

  /* ==================================================================
     FIELDS — 매 프레임 지속 효과
     ================================================================== */
  var FIELDS = {

    /* 주변의 불을 끈다 */
    WATER: function (e, dt) {
      var b = G.board.near(e, 132, function (o) { return o.burning; });
      for (var i = 0; i < b.length; i++) {
        var t = acc(b[i], 'wet', dt);
        G.fx.spark(b[i].x + U.rand(-10, 10), b[i].y - 6, {
          vx: 0, vy: -10, r: 1.4, life: .5, c: '150,190,220', a: .5
        });
        if (t > 4.5) b[i].extinguish();
      }
    },

    /* 주변을 얼려 점프를 줄인다 */
    ICE: function (e, dt) {
      var n = G.board.near(e, 118, function (o) { return o !== e; });
      for (var i = 0; i < n.length; i++) {
        n[i].chill = 0.7;
        if (n[i].burning && acc(n[i], 'iced', dt) > 8) n[i].extinguish();
      }
    },

    /* TREE 를 잘 자라게 하고 WATER 를 마르게 한다 */
    SUN: function (e, dt) {
      var t = G.board.near(e, 168, isWord('TREE'));
      for (var i = 0; i < t.length; i++) t[i].speedMul *= 1.6;
      var w = G.board.near(e, 140, function (o) {
        return o.type === 'word' && (o.text === 'WATER' || o.text === 'ICE');
      });
      for (var j = 0; j < w.length; j++) {
        w[j].incomeMul *= 0.55;
        if (Math.random() < dt * 1.5) {
          G.fx.spark(w[j].x + U.rand(-12, 12), w[j].y - 10, {
            vx: 0, vy: -18, r: 2, life: .7, c: '215,205,180', a: .35
          });
        }
      }
    },

    /* 주변 단어들의 행동을 빠르게 */
    CLOCK: function (e, dt) {
      var n = G.board.near(e, 152, function (o) { return o.type === 'word' && o !== e; });
      for (var i = 0; i < n.length; i++) n[i].speedMul *= 1.9;
    },

    /* 위험이 쌓이는 속도를 늦춘다 */
    TIME: function (e, dt) {
      var n = G.board.near(e, 146, function (o) { return o !== e; });
      for (var i = 0; i < n.length; i++) {
        n[i].hazardMul *= 0.3;
        n[i].speedMul *= 0.8;
      }
    },

    /* 낱글자를 끌어당긴다 */
    MAGNET: function (e, dt) {
      var n = G.board.near(e, 178, isLoose);
      for (var i = 0; i < n.length; i++) {
        var o = n[i];
        if (o.jump) continue;
        var d = Math.max(24, U.dist(e.x, e.y, o.x, o.y));
        if (d < 46) continue;
        var f = 130 * dt;
        o.vx += ((e.x - o.x) / d) * f;
        o.vy += ((e.y - o.y) / d) * f;
      }
    },

    /* 낱글자를 붙잡아 가지런히 정리한다 */
    BOX: function (e, dt) {
      var n = G.board.near(e, 128, isLoose);
      n.sort(function (a, b) {
        return U.dist2(e.x, e.y, a.x, a.y) - U.dist2(e.x, e.y, b.x, b.y);
      });
      var max = Math.min(n.length, 6);
      for (var i = 0; i < max; i++) {
        var o = n[i];
        o.heldBy = e.id;
        o.jump = null;
        var col = i % 3, row = Math.floor(i / 3);
        var tx = e.x + (col - 1) * 42;
        var ty = e.y + 40 + row * 46;
        var p = G.board.clampPoint(tx, ty, o);
        var k = Math.min(1, dt * 3.4);
        o.x = U.lerp(o.x, p.x, k);
        o.y = U.lerp(o.y, p.y, k);
      }
      if (max > 0) e.data.stored = (e.data.stored || 0) + max * 0.5 * dt;
    },

    /* 물이 가까우면 편안히 헤엄친다 */
    FISH: function (e, dt) {
      var w = G.board.nearest(e, 138, isAnyWord(['RIVER', 'WATER', 'RAIN', 'ICE']));
      if (w) {
        e.calm = true;
        e.incomeMul *= (w.text === 'RIVER') ? 4.0 : 3.2;
        if (Math.random() < dt * 1.2) {
          G.fx.spark(e.x + U.rand(-14, 14), e.y - 8, {
            vx: 0, vy: -12, r: 1.3, life: .6, c: '80,170,180', a: .5
          });
        }
      }
    },

    /* 둥지나 나무가 가까우면 자리를 잡는다 */
    BIRD: function (e, dt) {
      var t = G.board.nearest(e, 112, isAnyWord(['NEST', 'TREE']));
      if (t) {
        e.calm = true;
        e.incomeMul *= (t.text === 'NEST') ? 3.2 : 2.6;
      }
    },

    /* MILK 로 얌전해진 상태 유지 */
    CAT: function (e, dt) {
      if (e.data.purrT > 0) {
        e.data.purrT -= dt;
        e.calm = true;
        e.incomeMul *= 2.2;
        if (Math.random() < dt * .6) {
          G.fx.spark(e.x + U.rand(-12, 12), e.y - 14, {
            vx: 0, vy: -10, r: 1.4, life: .8, c: '190,170,140', a: .5
          });
        }
      }
    },

    /* BONE 을 물고 땅을 파거나, 글자를 물고 다닌다 */
    DOG: function (e, dt) {
      if (e.data.digT > 0) {
        e.data.digT -= dt;
        e.calm = true;
        e.data.digAcc = (e.data.digAcc || 0) + dt;
        if (e.data.digAcc > 6) {
          e.data.digAcc = 0;
          if (U.chance(.4) && G.board.count() < C.MAX_ENTITIES) {
            G.board.spawnLetter(null, e.x + U.rand(-40, 40), e.y + U.rand(20, 50));
          } else {
            var v = reward(0.3, 10);
            G.board.earn(v); G.ui.floatMoney(e.x, e.y - 18, v);
          }
          G.fx.burst(e.x, e.y + 14, '150,120,80', 10, 60);
        }
      }
      if (e.data.carry) {
        var L = G.board.get(e.data.carry);
        if (!L || L.dragging) { e.data.carry = null; return; }
        L.heldBy = e.id;
        L.jump = null;
        var tx = e.x + e.w * .55 + 8, ty = e.y + 6;
        var p = G.board.clampPoint(tx, ty, L);
        var k = Math.min(1, dt * 6);
        L.x = U.lerp(L.x, p.x, k); L.y = U.lerp(L.y, p.y, k);
        e.data.carryT = (e.data.carryT || 0) - dt;
        if (e.data.carryT <= 0) {
          e.data.carry = null;
          L.vx = U.rand(-40, 40); L.vy = U.rand(-30, 30);
          G.fx.spark(L.x, L.y, { vx: 0, vy: -20, r: 2, life: .5, c: '160,140,110', a: .6 });
        }
      }
    },

    /* BANK 가 가까우면 값이 오른다 */
    GOLD: function (e, dt) {
      if (G.board.nearest(e, 186, isWord('BANK'))) {
        e.incomeMul *= 1.7;
        if (Math.random() < dt * 1.5) {
          G.fx.spark(e.x + U.rand(-16, 16), e.y + U.rand(-10, 10), {
            vx: 0, vy: -8, r: 1.8, life: .6, c: '235,200,90', a: .9, shape: 'star'
          });
        }
      }
    },

    /* 나무를 갉아 성장을 막는다 */
    BUG: function (e, dt) {
      var t = G.board.near(e, 104, isWord('TREE'));
      for (var i = 0; i < t.length; i++) {
        t[i].data.bugged = 0.5;
        t[i].incomeMul *= 0.3;
      }
    },

    /* 알은 시간이 지나면 깨어난다 */
    EGG: function (e, dt) {
      e.data.hatch = (e.data.hatch || 0) + dt * e.speedMul;
      var p = e.data.hatch / 80;
      if (p > 0.6 && Math.random() < dt * (p - 0.5) * 3) {
        G.fx.spark(e.x + U.rand(-10, 10), e.y, {
          vx: U.rand(-14, 14), vy: -14, r: 1.4, life: .5, c: '200,185,150', a: .8
        });
      }
      if (e.data.hatch >= 80) {
        var x = e.x, y = e.y;
        G.board.remove(e);
        G.fx.burst(x, y, '210,195,160', 18, 100);
        var b = G.board.makeWord('BIRD', x, y);
        b.born();
        G.game.onWordFormed(b, true);
        G.ui.toast('알에서 <b>BIRD</b> 가 깨어났다');
      }
    },

    /* 나무: 물을 맞으면 빨리 자란다 */
    TREE: function (e, dt) {
      if (e.data.bugged > 0) e.data.bugged -= dt;
      if (e.data.wet > 0) { e.data.wet -= dt; e.speedMul *= 1.8; }
      if (G.board.nearest(e, 126, isAnyWord(['RIVER', 'WATER']))) e.speedMul *= 1.5;
    },

    /* 씨앗은 때가 되면 싹을 틔운다. 물이 가까우면 훨씬 빠르다 */
    SEED: function (e, dt) {
      if (e.burning) return;
      var wet = G.board.nearest(e, 132, isAnyWord(['RIVER', 'WATER', 'RAIN', 'STORM']));
      e.data.grow = (e.data.grow || 0) + dt * e.speedMul * (wet ? 2.4 : 1);
      if (Math.random() < dt * .5) {
        G.fx.spark(e.x + U.rand(-8, 8), e.y - 4, {
          vx: 0, vy: -10, r: 1.3, life: .7, c: '120,175,110', a: .5
        });
      }
      if (e.data.grow >= 90) {
        var x = e.x, y = e.y;
        G.board.remove(e);
        G.fx.burst(x, y, '110,170,110', 18, 96);
        var t = G.board.makeWord('TREE', x, y);
        t.born();
        G.game.onWordFormed(t, true);
        G.ui.toast('씨앗이 자라 <b>TREE</b> 가 되었다');
      }
    },

    /* 강: 넉넉히 불을 끄고 나무를 키운다 */
    RIVER: function (e, dt) {
      var b = G.board.near(e, 168, function (o) { return o.burning; });
      for (var i = 0; i < b.length; i++) {
        if (acc(b[i], 'wet', dt) > 3) b[i].extinguish();
      }
      var t = G.board.near(e, 150, isAnyWord(['TREE', 'SEED']));
      for (var j = 0; j < t.length; j++) t[j].speedMul *= 1.5;
    },

    /* 달: 주변을 밤처럼 잠재운다. 해가 가까우면 힘을 잃는다 */
    MOON: function (e, dt) {
      if (G.board.nearest(e, 176, isWord('SUN'))) { e.incomeMul *= 0.5; return; }
      var n = G.board.near(e, 160, function (o) { return o !== e; });
      for (var i = 0; i < n.length; i++) {
        n[i].calm = true;
        n[i].incomeMul *= 1.5;
      }
      if (Math.random() < dt * .5) {
        G.fx.spark(e.x + U.rand(-e.w * .5, e.w * .5), e.y + U.rand(-10, 10), {
          vx: 0, vy: -7, r: 1.4, life: 1.1, c: '160,165,205', a: .45
        });
      }
    },

    /* 별: 가까운 행운을 더 자주 일으킨다 */
    STAR: function (e, dt) {
      var l = G.board.near(e, 190, isWord('LUCK'));
      for (var i = 0; i < l.length; i++) l[i].speedMul *= 2.2;
    },

    /* 등불: 주위를 밝히고 유령을 밀어낸다 */
    LAMP: function (e, dt) {
      var n = G.board.near(e, 150, function (o) { return o.type === 'word' && o !== e; });
      for (var i = 0; i < n.length; i++) n[i].incomeMul *= 1.25;
      var g = G.board.near(e, 122, isWord('GHOST'));
      for (var j = 0; j < g.length; j++) g[j].push(e.x, e.y, 90 * dt);
    },

    /* 둥지: 새가 앉으면 얌전해진다 */
    NEST: function (e, dt) {
      if (G.board.nearest(e, 112, isWord('BIRD'))) e.incomeMul *= 1.4;
    },

    /* 생쥐: 치즈 곁에서는 얌전해진다 */
    MOUSE: function (e, dt) {
      if (G.board.nearest(e, 108, isWord('CHEESE'))) {
        e.calm = true;
        e.incomeMul *= 2.6;
      }
    },

    /* 치즈: 생쥐를 천천히 끌어당긴다 */
    CHEESE: function (e, dt) {
      var m = G.board.near(e, 210, isWord('MOUSE'));
      for (var i = 0; i < m.length; i++) {
        var o = m[i];
        if (o.jump) continue;
        var d = Math.max(28, U.dist(e.x, e.y, o.x, o.y));
        if (d < 54) continue;
        var f = 110 * dt;
        o.vx += ((e.x - o.x) / d) * f;
        o.vy += ((e.y - o.y) / d) * f;
      }
    },

    /* 벌: 나무나 씨앗 곁에서 꿀을 모은다 */
    BEE: function (e, dt) {
      var t = G.board.near(e, 132, isAnyWord(['TREE', 'SEED']));
      if (!t.length) return;
      e.incomeMul *= 2.2;
      for (var i = 0; i < t.length; i++) t[i].speedMul *= 1.4;
      if (Math.random() < dt * .8) {
        G.fx.spark(e.x + U.rand(-10, 10), e.y - 6, {
          vx: U.rand(-8, 8), vy: -10, r: 1.3, life: .6, c: '225,190,70', a: .7
        });
      }
    }
  };

  /* ==================================================================
     ACTIONS — 주기적으로 한 번씩 일어나는 사건
     ================================================================== */
  var ACTIONS = {

    /* 돌풍 */
    gust: function (e) {
      var a = Math.random() * Math.PI * 2;
      var n = G.board.near(e, 230, function (o) { return o !== e; });
      for (var i = 0; i < n.length; i++) {
        var o = n[i];
        if (o.def && o.def.heavy) continue;
        var d = U.dist(e.x, e.y, o.x, o.y);
        var p = 190 * (1 - d / 230);
        o.vx += Math.cos(a) * p;
        o.vy += Math.sin(a) * p;
        o.heldBy = null;
      }
      for (var j = 0; j < 9; j++) {
        var r = U.rand(20, 210), off = U.rand(-70, 70);
        var sx = e.x + Math.cos(a) * -r + Math.cos(a + 1.57) * off;
        var sy = e.y + Math.sin(a) * -r + Math.sin(a + 1.57) * off;
        G.fx.line(sx, sy, sx + Math.cos(a) * 46, sy + Math.sin(a) * 46,
          { life: .55, c: '150,175,190', lw: 1.2 });
      }
      G.fx.ring(e.x, e.y, { r0: 10, r1: 220, life: .55, c: '150,175,190', lw: 1 });
    },

    /* 비 */
    rain: function (e) {
      var R = 172;
      G.fx.ring(e.x, e.y, { r0: 8, r1: R, life: 1.1, c: '110,150,200', lw: 1.5 });
      var n = G.board.near(e, R, function (o) { return o !== e; });
      var put = 0;
      for (var i = 0; i < n.length; i++) {
        var o = n[i];
        if (o.burning) { o.extinguish(); put++; }
        if (o.type === 'word' && o.text === 'TREE') o.data.wet = 14;
      }
      for (var j = 0; j < 40; j++) {
        var a = Math.random() * 6.2832, d = Math.sqrt(Math.random()) * R;
        G.fx.spark(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d - 30, {
          vx: -6, vy: U.rand(120, 190), g: 30, r: U.rand(.8, 1.4),
          life: U.rand(.3, .55), c: '110,150,200', a: .55, shape: 'line', drag: 1
        });
      }
      if (put) G.ui.toast('비가 불을 껐다');
    },

    /* 나무가 글자를 떨어뜨린다 */
    tree: function (e) {
      if (e.burning) return;
      if (e.data.bugged > 0) {
        G.fx.spark(e.x, e.y, { vx: 0, vy: -10, r: 2, life: .6, c: '150,150,110', a: .6 });
        return;
      }
      if (G.board.count() >= C.MAX_ENTITIES) return;
      var L = G.board.spawnLetter(null, e.x + U.rand(-56, 56), e.y + U.rand(34, 64));
      L.vy = 30;
      G.fx.spark(e.x, e.y + 10, { vx: 0, vy: 20, r: 2.2, life: .6, c: '90,165,105', a: .8, shape: 'leaf' });
    },

    /* 고양이가 착지하며 글자를 툭 민다 */
    cat: function (e) {
      var n = G.board.near(e, 96, isLoose);
      for (var i = 0; i < n.length; i++) n[i].push(e.x, e.y, U.rand(110, 200));
      if (n.length) G.fx.ring(e.x, e.y, { r0: 6, r1: 90, life: .4, c: '170,150,120', lw: 1 });
      e.startJump(140);
    },

    /* 개가 글자를 물고 간다 */
    dog: function (e) {
      if (e.data.digT > 0) return;
      var L = G.board.nearest(e, 230, function (o) {
        return o.type === 'letter' && !o.dragging && !o.heldBy;
      });
      if (!L) return;
      e.data.carry = L.id;
      e.data.carryT = U.rand(5, 9);
      e.startJump(150);
      G.fx.spark(e.x, e.y - 10, { vx: 0, vy: -18, r: 1.8, life: .5, c: '160,130,90', a: .7 });
    },

    /* 자동차가 달린다 */
    car: function (e) {
      var road = G.board.nearest(e, 200, isWord('ROAD'));
      var a = Math.random() * Math.PI * 2;
      if (road) a = Math.atan2(road.y - e.y, road.x - e.x) + U.rand(-.4, .4);
      var range = road ? 300 : 150;
      e.startJump(range, a, road ? 1.0 : 0.75);
      var self = e;
      e.onLand = function () {
        var n = G.board.near(self, 78, function (o) { return o !== self; });
        for (var i = 0; i < n.length; i++) n[i].push(self.x, self.y, 170);
        G.fx.ring(self.x, self.y, { r0: 4, r1: 70, life: .35, c: '170,90,90', lw: 1 });
        if (road) {
          var v = reward(0.25, 8);
          G.board.earn(v);
          G.ui.floatMoney(self.x, self.y - 20, v);
        }
        self.onLand = null;
      };
      for (var i = 0; i < 6; i++) {
        G.fx.spark(e.x - Math.cos(a) * 14, e.y - Math.sin(a) * 14, {
          vx: -Math.cos(a) * 40, vy: -Math.sin(a) * 40, r: U.rand(1.4, 2.6),
          life: .6, c: '175,165,160', a: .4
        });
      }
    },

    /* 상점 특가 */
    shop: function (e) {
      if (e.burning) return;
      if (G.tokens.count() > 5) return;
      var a = Math.random() * 6.2832, d = U.rand(46, 92);
      var p = G.board.clampPoint(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, { w: 40, h: 40 });
      G.tokens.spawn(p.x, p.y, Math.round(reward(0.5, 14) * U.rand(.7, 1.4)));
      G.fx.ring(e.x, e.y, { r0: 6, r1: 60, life: .5, c: '180,110,175', lw: 1 });
    },

    /* 은행 지급 */
    bank: function (e) {
      var v = e.data.vault || 0;
      if (v < 1) return;
      e.data.vault = 0;
      /* 금고 환급은 earn() 을 거치지 않는다 — 다시 30% 를 떼여 돌고 돌기 때문 */
      var pay = v * 1.18;
      G.state.money += pay;
      G.state.totalEarned = (G.state.totalEarned || 0) + pay;
      G.ui.floatMoney(e.x, e.y - 22, pay);
      G.fx.coins(e.x, e.y, 14);
      G.fx.ring(e.x, e.y, { r0: 6, r1: 70, life: .6, c: '70,150,110', lw: 1.5 });
    },

    /* 운 */
    luck: function (e) {
      var roll = U.randInt(0, 4);
      if (roll === 0 && G.board.count() < C.MAX_ENTITIES) {
        G.board.spawnLetter(null, e.x + U.rand(-70, 70), e.y + U.rand(-50, 50));
        G.ui.toast('행운: 새 글자');
      } else if (roll === 1) {
        var v = reward(0.8, 22);
        G.board.earn(v); G.ui.floatMoney(e.x, e.y - 20, v);
        G.fx.coins(e.x, e.y, 12);
      } else if (roll === 2) {
        var burning = G.board.all().filter(function (o) { return o.burning; });
        if (burning.length) {
          burning.forEach(function (o) { o.extinguish(); });
          G.ui.toast('행운: 소나기가 불을 껐다');
        } else {
          G.fx.ring(e.x, e.y, { r0: 6, r1: 90, life: .7, c: '90,190,150', lw: 1.5 });
        }
      } else if (roll === 3) {
        var w = G.board.nearest(e, 200, function (o) { return o.type === 'word' && o !== e; });
        if (w) {
          w.data.lucky = 12;
          G.fx.burst(w.x, w.y, '110,200,160', 12, 70);
        }
      } else {
        G.game.freeHint();
      }
      G.fx.ring(e.x, e.y, { r0: 4, r1: 50, life: .5, c: '110,200,160', lw: 1 });
    },

    /* 유령이 놀래킨다 */
    ghost: function (e) {
      var w = G.board.nearest(e, 150, function (o) { return o.type === 'word' && o !== e; });
      if (!w) return;
      var a = Math.atan2(w.y - e.y, w.x - e.x);
      w.startJump(210, a, .5);
      w.chill = 0;
      G.fx.ring(w.x, w.y, { r0: 4, r1: 60, life: .5, c: '140,140,175', lw: 1.5 });
      for (var i = 0; i < 8; i++) {
        G.fx.spark(w.x, w.y, {
          vx: U.rand(-40, 40), vy: U.rand(-50, -10), r: U.rand(2, 4),
          life: .8, c: '150,150,180', a: .35
        });
      }
    },

    /* 책이 힌트를 밝힌다 */
    book: function (e) {
      if (e.burning) return;
      if (G.game.freeHint()) {
        G.fx.ring(e.x, e.y, { r0: 6, r1: 66, life: .8, c: '120,135,190', lw: 1.2 });
        for (var i = 0; i < 8; i++) {
          G.fx.spark(e.x, e.y - 6, {
            vx: U.rand(-26, 26), vy: U.rand(-40, -12), r: 1.6,
            life: 1, c: '130,145,200', a: .7
          });
        }
      }
    },

    /* 폭풍 — 돌풍과 비를 한꺼번에 */
    storm: function (e) {
      ACTIONS.gust(e);
      ACTIONS.rain(e);
      G.fx.ring(e.x, e.y, { r0: 14, r1: 250, life: .8, c: '90,105,140', lw: 2 });
    },

    /* 별에게 비는 소원 */
    star: function (e) {
      if (U.chance(.35) && G.game.freeHint()) {
        G.fx.ring(e.x, e.y, { r0: 6, r1: 90, life: .9, c: '225,205,120', lw: 1.4 });
        return;
      }
      var v = reward(0.55, 18);
      G.board.earn(v); G.ui.floatMoney(e.x, e.y - 20, v);
      for (var i = 0; i < 10; i++) {
        G.fx.spark(e.x, e.y, {
          vx: U.rand(-40, 40), vy: U.rand(-50, -10), r: U.rand(1.4, 2.6),
          life: 1, c: '235,215,130', a: .8, shape: 'star'
        });
      }
    },

    /* 둥지에 알이 하나 */
    nest: function (e) {
      if (e.burning) return;
      if (!G.board.nearest(e, 118, isWord('BIRD'))) return;
      if (G.board.count() >= C.MAX_ENTITIES) return;
      /* 새 → 알 → 새 가 끝없이 불어나지 않게 */
      var flock = G.board.all().filter(isAnyWord(['EGG', 'BIRD']));
      if (flock.length >= 5) return;
      var p = G.board.clampPoint(e.x + U.rand(-48, 48), e.y + U.rand(28, 54), { w: 60, h: 40 });
      var g = G.board.makeWord('EGG', p.x, p.y);
      g.born();
      G.game.onWordFormed(g, true);
      G.fx.ring(e.x, e.y, { r0: 6, r1: 62, life: .6, c: '190,165,120', lw: 1.2 });
      G.ui.toast('둥지에 <b>EGG</b> 가 하나 놓였다');
    },

    /* 벌이 꿀을 턴다 */
    bee: function (e) {
      if (!G.board.nearest(e, 132, isAnyWord(['TREE', 'SEED']))) { e.startJump(120); return; }
      var v = reward(0.22, 8);
      G.board.earn(v); G.ui.floatMoney(e.x, e.y - 16, v);
      G.fx.coins(e.x, e.y, 6);
    },

    /* 생쥐가 축낸다 */
    mouse: function (e) {
      if (G.board.nearest(e, 108, isWord('CHEESE'))) return;   // 치즈 옆에서는 얌전하다
      var steal = Math.min(G.state.money, reward(0.1, 2));
      if (steal > 0.5) {
        G.state.money -= steal;
        G.ui.floatMoney(e.x, e.y - 14, -steal);
      }
      e.startJump(120);
    },

    /* 벌레가 훔쳐간다 */
    bug: function (e) {
      var t = G.board.nearest(e, 160, function (o) {
        return o.type === 'word' && o !== e && (o.def.value || 0) >= 4;
      });
      if (!t) { e.startJump(90); return; }
      var steal = Math.min(G.state.money, reward(0.12, 2));
      if (steal > 0.5) {
        G.state.money -= steal;
        G.ui.floatMoney(t.x, t.y - 16, -steal);
      }
      var a = Math.atan2(t.y - e.y, t.x - e.x);
      e.startJump(80, a);
      G.fx.spark(t.x, t.y, { vx: U.rand(-20, 20), vy: 10, r: 1.6, life: .5, c: '130,140,70', a: .7 });
    }
  };

  /* ==================================================================
     BONDS — 위치 + 시간이 만들어내는 사건
     ================================================================== */
  var BONDS = {
    ignite: function (a, b) {
      b.ignite();
      G.contacts.clear(a, b, 'ignite', 6);
    },
    douse: function (a, b) {           // a=WATER, b=FIRE
      b.suppress = 14;
      b.el.classList.add('frozen');
      setTimeout(function () { if (b.el) b.el.classList.remove('frozen'); }, 14000);
      G.fx.splash(b.x, b.y);
      G.ui.toast('WATER 가 FIRE 를 잠재웠다');
      G.contacts.clear(a, b, 'douse', 20);
    },
    melt: function (a, b) {            // a=ICE, b=FIRE
      var x = a.x, y = a.y;
      G.board.remove(a);
      G.fx.splash(x, y);
      var w = G.board.makeWord('WATER', x, y);
      w.born();
      G.game.onWordFormed(w, true);
      G.ui.toast('ICE 가 녹아 <b>WATER</b> 가 되었다');
    },
    unlock: function (a, b) {          // a=KEY, b=BOX
      var v = b.data.stored || 0;
      b.data.stored = 0;
      if (v > 1) {
        G.board.earn(v);
        G.ui.floatMoney(b.x, b.y - 24, v);
      }
      var held = G.board.near(b, 140, function (o) { return o.type !== 'word'; });
      for (var i = 0; i < held.length; i++) {
        held[i].heldBy = null;
        held[i].push(b.x, b.y, 150);
      }
      G.fx.coins(b.x, b.y, 14);
      G.fx.ring(b.x, b.y, { r0: 6, r1: 80, life: .6, c: '200,170,80', lw: 1.5 });
      G.contacts.clear(a, b, 'unlock', 45);
    },
    purr: function (a, b) {            // a=CAT, b=MILK
      a.data.purrT = 34;
      G.fx.coins(a.x, a.y, 6);
      G.contacts.clear(a, b, 'purr', 30);
    },
    dig: function (a, b) {             // a=DOG, b=BONE
      a.data.digT = 26;
      a.data.carry = null;
      G.fx.burst(a.x, a.y + 12, '160,130,90', 10, 60);
      G.contacts.clear(a, b, 'dig', 26);
    },
    hunt: function (a, b) {            // a=CAT, b=MOUSE
      var x = b.x, y = b.y;
      G.board.remove(b);
      G.fx.burst(x, y, '150,140,130', 14, 82);
      var v = reward(0.5, 14);
      G.board.earn(v); G.ui.floatMoney(x, y - 14, v);
      G.ui.toast('CAT 이 MOUSE 를 잡았다');
    },
    nibble: function (a, b) {          // a=MOUSE, b=CHEESE
      var v = reward(0.45, 12);
      G.board.earn(v); G.ui.floatMoney(b.x, b.y - 20, v);
      G.fx.coins(b.x, b.y, 8);
      G.contacts.clear(a, b, 'nibble', 12);
    },
    banish: function (a, b) {          // a=LAMP, b=GHOST
      var ang = Math.atan2(b.y - a.y, b.x - a.x);
      b.startJump(300, ang, .7);
      b.actTimer = Math.max(b.actTimer, 20);   // 한동안 놀래키지 못한다
      G.fx.ring(b.x, b.y, { r0: 4, r1: 90, life: .6, c: '225,195,110', lw: 1.5 });
      G.ui.toast('LAMP 가 GHOST 를 쫓아냈다');
      G.contacts.clear(a, b, 'banish', 20);
    },
    pollen: function (a, b) {          // a=BEE, b=TREE
      if (!b.burning && G.board.count() < C.MAX_ENTITIES) {
        var L = G.board.spawnLetter(null, b.x + U.rand(-50, 50), b.y + U.rand(30, 58));
        L.vy = 26;
      }
      var v = reward(0.3, 10);
      G.board.earn(v); G.ui.floatMoney(a.x, a.y - 16, v);
      G.fx.ring(b.x, b.y, { r0: 6, r1: 66, life: .6, c: '215,185,80', lw: 1.2 });
      G.contacts.clear(a, b, 'pollen', 14);
    },
    eat: function (a, b) {             // a=BIRD, b=BUG
      var x = b.x, y = b.y;
      G.board.remove(b);
      G.fx.burst(x, y, '110,130,60', 14, 80);
      var v = reward(0.6, 16);
      G.board.earn(v); G.ui.floatMoney(x, y - 14, v);
      G.ui.toast('BIRD 가 BUG 를 잡았다');
    }
  };

  var GUARD = {
    ignite: function (a, b) { return !b.burning && a.suppress <= 0 && b.chill <= 0; },
    melt: function (a, b) { return b.suppress <= 0; },
    douse: function (a, b) { return b.suppress <= 0; }
  };

  /* ==================================================================
     메인 루프
     ================================================================== */
  function step(dt) {
    frameNo++;
    var list = G.board.all(), i, e;

    /* 1. 지속 효과 */
    for (i = 0; i < list.length; i++) {
      e = list[i];
      e.danger = 0;
      if (e.type !== 'word') continue;
      if (e.data.lucky > 0) { e.data.lucky -= dt; e.incomeMul *= 2; }
      var f = FIELDS[e.text];
      if (f) f(e, dt);
    }

    /* 2. 접촉(위치+시간) 상호작용 */
    for (i = 0; i < list.length; i++) {
      e = list[i];
      if (e.type !== 'word' || !e.def.bonds) continue;
      applyBonds(e, e.def.bonds, dt);
    }
    /* 불타는 것은 주변으로 번진다 */
    for (i = 0; i < list.length; i++) {
      e = list[i];
      if (!e.burning) continue;
      applyBonds(e, SPREAD, dt);
    }

    G.contacts.sweep(frameNo);

    /* 3. 주기 행동 */
    for (i = 0; i < list.length; i++) {
      e = list[i];
      if (e.type !== 'word' || !e.def.act) continue;
      var act = ACTIONS[e.def.act];
      if (!act) continue;
      e.actTimer -= dt * e.speedMul;
      if (e.actTimer <= 0) {
        var iv = e.def.actEvery || [20, 30];
        e.actTimer = U.rand(iv[0], iv[1]);
        if (!e.dragging) act(e);
      }
    }

    /* 4. 화재 결과 */
    for (i = list.length - 1; i >= 0; i--) {
      e = list[i];
      if (!e.burning) continue;
      if (e.burnTime > 42) {
        G.ui.toast('<b>' + e.text + '</b> 가 무너져 글자로 흩어졌다');
        G.fx.burst(e.x, e.y, '120,110,105', 26, 130);
        G.board.explode(e, true);
      }
    }

    G.tokens.step(dt);
  }

  var SPREAD = [{ with: '#burnable', range: 104, time: 26, key: 'ignite' }];

  function applyBonds(a, bonds, dt) {
    for (var bi = 0; bi < bonds.length; bi++) {
      var bond = bonds[bi];
      var range = bond.range;
      var cands = G.board.near(a, range * 1.12, function (o) {
        return o !== a && G.matchSpec(o, bond.with);
      });
      for (var ci = 0; ci < cands.length; ci++) {
        var b = cands[ci];
        var g = GUARD[bond.key];
        if (g && !g(a, b)) continue;
        var hz = Math.min(a.hazardMul, b.hazardMul);
        var entry = G.contacts.accum(a, b, bond.key, dt * hz);
        var p = Math.max(0, entry.t) / bond.time;
        if (p > (b.danger || 0) && bond.key === 'ignite') b.danger = Math.min(1, p);
        if (p > 0.15 && bond.key === 'ignite') {
          G.fx.dangerDots(a.x, a.y, b.x, b.y, Math.min(1, p), dt);
        }
        if (entry.t >= bond.time) {
          entry.t = 0;
          BONDS[bond.key](a, b);
          break;
        }
      }
    }
  }

  return {
    step: step, frame: frame,
    FIELDS: FIELDS, ACTIONS: ACTIONS, BONDS: BONDS
  };
})();
