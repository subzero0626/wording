/* ==========================================================================
   behaviors.js — 단어의 행동
   --------------------------------------------------------------------------
   FIELDS[단어]  : 매 프레임 지속되는 "장(場)" 효과 (끌어당김, 얼림, 가속…)
   ACTIONS[key]  : def.actEvery 주기로 한 번씩 일어나는 사건
   BONDS[key]    : "가까이 + 일정 시간" 이 유지되어야 발동하는 상호작용

   단어는 자기 뜻대로 행동한다. FIRE 는 태우고 BUG 는 갉는다.
   그것이 이득이 될지 손해가 될지는 플레이어가 어디에 놓느냐가 정한다.
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

  return {
    init: init, spawn: spawn, step: step, clearAll: clearAll,
    count: function () { return list.length; }
  };
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
  function isBurning(o) { return o.burning; }

  /** o 를 e 쪽으로 끌어당긴다 */
  function pull(e, o, force, dt, keep) {
    if (o.jump || o.dragging) return;
    var d = Math.max(24, U.dist(e.x, e.y, o.x, o.y));
    if (d < (keep || 46)) return;
    var f = force * (dt === undefined ? 1 : dt);
    o.vx += ((e.x - o.x) / d) * f;
    o.vy += ((e.y - o.y) / d) * f;
  }

  /** 자리를 바꿔 놓는 변신 (조리·제련·숙성·부화 공통) */
  function become(e, id, color, msg) {
    var x = e.x, y = e.y;
    G.board.remove(e);
    G.fx.burst(x, y, color, 20, 104);
    var w = G.board.makeWord(id, x, y);
    w.born();
    G.game.onWordFormed(w, true);
    if (msg) G.ui.toast(msg);
    return w;
  }

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

  var GEMS = ['GOLD', 'IRON', 'RUBY', 'EMERALD', 'DIAMOND'];

  /**
   * 보석의 공통 성질. 만들어질 때 품질이 한 번 뽑히고 그 뒤로 바뀌지 않는다.
   * 품질은 20초마다 버는 돈에도, 가게 매입가에도 똑같이 곱해진다.
   * 좋은 것일수록 더 자주 반짝이니 눈으로도 구별된다.
   */
  function gem(e, dt, bonus) {
    if (e.data.q === undefined) {
      e.data.q = U.rand(C.GEM_QUALITY[0], C.GEM_QUALITY[1]);
    }
    var q = e.data.q * (bonus || 1);
    e.incomeMul *= q;
    if (Math.random() < dt * (q - .8) * 2.4) {
      G.fx.spark(e.x + U.rand(-e.w * .4, e.w * .4), e.y + U.rand(-e.h * .3, e.h * .3), {
        vx: U.rand(-6, 6), vy: U.rand(-14, -4), g: -3,
        r: U.rand(1, 1.9), life: U.rand(.5, 1),
        c: '235,225,190', a: .8, shape: 'star'
      });
    }
  }

  /* ==================================================================
     FIELDS — 매 프레임 지속 효과
     ================================================================== */
  var FIELDS = {

    /* ---------- 하늘 ---------- */

    /* 해: 풀을 키우고 물기를 말린다. 마른 것은 불이 잘 붙는다 */
    SUN: function (e, dt) {
      var t = G.board.near(e, 168, isAnyWord(['TREE', 'SEED']));
      for (var i = 0; i < t.length; i++) t[i].speedMul *= 1.6;

      var n = G.board.near(e, 150, function (o) { return o.type === 'word' && o !== e; });
      for (var j = 0; j < n.length; j++) {
        if (n[j].def.flammable) n[j].hazardMul *= 1.5;
        if (n[j].def.tags && n[j].def.tags.indexOf('wet') >= 0) n[j].incomeMul *= 0.6;
      }
      if (G.board.nearest(e, 180, isWord('MOON'))) e.incomeMul *= 1.5;
    },

    /* 달: 주변을 밤처럼 잠재워 조용히 더 벌게 한다 */
    MOON: function (e, dt) {
      var n = G.board.near(e, 160, function (o) { return o !== e; });
      for (var i = 0; i < n.length; i++) {
        n[i].calm = true;
        n[i].incomeMul *= 1.5;
      }
      if (G.board.nearest(e, 180, isWord('SUN'))) e.incomeMul *= 1.5;
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

    /* 바람: 불길을 키운다 */
    WIND: function (e, dt) {
      var f = G.board.near(e, 150, function (o) { return o.burning || (o.type === 'word' && o.text === 'FIRE'); });
      for (var i = 0; i < f.length; i++) f[i].hazardMul *= 1.8;
    },

    /* ---------- 물 ---------- */

    /* 물: 주변의 불을 끈다 */
    WATER: function (e, dt) {
      var b = G.board.near(e, 132, isBurning);
      for (var i = 0; i < b.length; i++) {
        var t = acc(b[i], 'wet', dt);
        G.fx.spark(b[i].x + U.rand(-10, 10), b[i].y - 6, {
          vx: 0, vy: -10, r: 1.4, life: .5, c: '150,190,220', a: .5
        });
        if (t > 4.5) b[i].extinguish();
      }
      var t2 = G.board.near(e, 126, isAnyWord(['TREE', 'SEED']));
      for (var j = 0; j < t2.length; j++) t2[j].speedMul *= 1.5;
    },

    /* 강: 흘러가며 낱글자를 하류로 실어 나른다 */
    RIVER: function (e, dt) {
      if (e.data.flow === undefined) e.data.flow = U.chance(.5) ? 1 : -1;
      var n = G.board.near(e, 150, isLoose);
      for (var i = 0; i < n.length; i++) {
        if (n[i].jump) continue;
        n[i].vx += e.data.flow * 150 * dt;
        n[i].vy += (e.y - n[i].y) * 0.6 * dt;
      }
      var b = G.board.near(e, 172, isBurning);
      for (var j = 0; j < b.length; j++) {
        if (acc(b[j], 'wet', dt) > 3) b[j].extinguish();
      }
      var t = G.board.near(e, 152, isAnyWord(['TREE', 'SEED']));
      for (var k = 0; k < t.length; k++) t[k].speedMul *= 1.5;
      if (Math.random() < dt * 3) {
        G.fx.spark(e.x - e.data.flow * e.w * .5, e.y + U.rand(-10, 10), {
          vx: e.data.flow * 40, vy: 0, r: 1.2, life: .8, c: '90,160,200', a: .5, drag: .99
        });
      }
    },

    /* 얼음: 주변을 얼려 붙들어 둔다 */
    ICE: function (e, dt) {
      var n = G.board.near(e, 118, function (o) { return o !== e; });
      for (var i = 0; i < n.length; i++) {
        n[i].chill = 0.7;
        n[i].hazardMul *= 0.5;
        if (n[i].burning && acc(n[i], 'iced', dt) > 8) n[i].extinguish();
      }
    },

    /* 김: 주변을 몰아치게 재촉하지만 곧 식는다 */
    STEAM: function (e, dt) {
      var n = G.board.near(e, 156, function (o) { return o.type === 'word' && o !== e; });
      for (var i = 0; i < n.length; i++) n[i].speedMul *= 2.0;
      e.data.cool = (e.data.cool || 0) + dt;
      if (e.data.cool >= 70) become(e, 'WATER', '190,205,215', '김이 식어 <b>WATER</b> 로 돌아갔다');
    },

    /* ---------- 불과 땅 ---------- */

    /* 불: 곁에 있는 것들을 데운다. COAL 을 물리면 불길이 거세진다 */
    FIRE: function (e, dt) {
      var hot = 1;
      if (G.board.nearest(e, 120, isWord('COAL'))) { hot = 2; e.stoke = 2; }
      var n = G.board.near(e, 136, function (o) { return o.type === 'word' && o !== e && !o.burning; });
      for (var i = 0; i < n.length; i++) n[i].incomeMul *= 1 + 0.3 * hot;
      if (Math.random() < dt * 2 * hot) {
        G.fx.spark(e.x + U.rand(-e.w * .4, e.w * .4), e.y - 8, {
          vx: U.rand(-6, 6), vy: U.rand(-34, -18), r: U.rand(1.2, 2.2),
          life: .8, c: '235,140,60', a: .7
        });
      }
    },

    /* 유리: 빛을 모아 렌즈가 된다 */
    GLASS: function (e, dt) {
      var src = G.board.nearest(e, 140, isAnyWord(['SUN', 'LAMP']));
      if (!src) return;
      var n = G.board.near(e, 140, function (o) { return o.type === 'word' && o !== e; });
      for (var i = 0; i < n.length; i++) n[i].incomeMul *= 1.6;
      if (Math.random() < dt * 2) {
        G.fx.line(src.x, src.y, e.x, e.y, { life: .3, c: '225,215,150', lw: 1 });
      }
    },

    /* ---------- 풀 ---------- */

    TREE: function (e, dt) {
      if (e.data.bugged > 0) e.data.bugged -= dt;
      if (e.data.wet > 0) { e.data.wet -= dt; e.speedMul *= 1.8; }
    },

    SEED: function (e, dt) {
      if (e.burning) return;
      if (e.data.wet > 0) { e.data.wet -= dt; e.speedMul *= 1.8; }
      e.data.grow = (e.data.grow || 0) + dt * e.speedMul;
      if (Math.random() < dt * .5) {
        G.fx.spark(e.x + U.rand(-8, 8), e.y - 4, {
          vx: 0, vy: -10, r: 1.3, life: .7, c: '120,175,110', a: .5
        });
      }
      if (e.data.grow >= 90) become(e, 'TREE', '110,170,110', '씨앗이 자라 <b>TREE</b> 가 되었다');
    },

    BEE: function (e, dt) {
      var t = G.board.near(e, 132, isAnyWord(['TREE', 'SEED']));
      if (!t.length) return;
      e.calm = true;
      e.incomeMul *= 2.2;
      for (var i = 0; i < t.length; i++) t[i].speedMul *= 1.4;
      if (Math.random() < dt * .8) {
        G.fx.spark(e.x + U.rand(-10, 10), e.y - 6, {
          vx: U.rand(-8, 8), vy: -10, r: 1.3, life: .6, c: '225,190,70', a: .7
        });
      }
    },

    /* ---------- 살림 ---------- */

    /* 집: 주변 낱글자를 재워 주고 그만큼 세를 받는다 */
    HOUSE: function (e, dt) {
      if (e.burning) return;
      var n = G.board.near(e, 150, isLoose);
      var k = Math.min(n.length, 6);
      for (var i = 0; i < k; i++) n[i].calm = true;
      if (k) e.incomeMul *= 1 + k * 0.25;
    },

    ROAD: function (e, dt) {
      var c = G.board.near(e, 170, isWord('CAR'));
      for (var i = 0; i < c.length; i++) c[i].incomeMul *= 1.4;
    },

    /* 상자: 낱글자를 붙잡아 정리하고 값을 쌓는다 */
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
        var p = G.board.clampPoint(e.x + (col - 1) * 42, e.y + 40 + row * 46, o);
        var k = Math.min(1, dt * 3.4);
        o.x = U.lerp(o.x, p.x, k);
        o.y = U.lerp(o.y, p.y, k);
      }
      if (max > 0) e.data.stored = (e.data.stored || 0) + max * 0.5 * dt;
      e.setBadge(e.data.stored > 1 ? '잠김 ' + Math.round(e.data.stored) + 'w' : '');
    },

    /* 자석: 낱글자를 끌어당긴다 */
    MAGNET: function (e, dt) {
      var n = G.board.near(e, 178, isLoose);
      for (var i = 0; i < n.length; i++) pull(e, n[i], 130, dt);
    },

    /* 등불: 밝히고, 붙들고, 책을 비추고, 유령을 민다 */
    LAMP: function (e, dt) {
      var n = G.board.near(e, 150, function (o) { return o.type === 'word' && o !== e; });
      for (var i = 0; i < n.length; i++) n[i].incomeMul *= 1.25;
      var l = G.board.near(e, 128, isLoose);
      for (var j = 0; j < l.length; j++) l[j].calm = true;
      var b = G.board.near(e, 140, isWord('BOOK'));
      for (var k = 0; k < b.length; k++) b[k].speedMul *= 1.8;
      var g = G.board.near(e, 122, isWord('GHOST'));
      for (var m = 0; m < g.length; m++) g[m].push(e.x, e.y, 90 * dt);
    },

    /* 시계: 행동을 재촉한다 — 불이 번지는 속도까지 */
    CLOCK: function (e, dt) {
      var n = G.board.near(e, 152, function (o) { return o.type === 'word' && o !== e; });
      for (var i = 0; i < n.length; i++) {
        n[i].speedMul *= 1.9;
        n[i].hazardMul *= 1.4;
      }
    },

    /* 시간: 위험은 늦추고, 익어야 하는 것은 빨리 여물게 한다 */
    TIME: function (e, dt) {
      var n = G.board.near(e, 146, function (o) { return o !== e; });
      for (var i = 0; i < n.length; i++) {
        n[i].hazardMul *= 0.25;
        n[i].speedMul *= 0.8;
      }
      var ripe = G.board.near(e, 146, isAnyWord(['SEED', 'EGG']));
      for (var j = 0; j < ripe.length; j++) ripe[j].speedMul *= 2.2;
    },

    NEST: function (e, dt) {
      if (G.board.nearest(e, 112, isWord('BIRD'))) e.incomeMul *= 1.4;
    },

    /* ---------- 짐승 ---------- */

    CAT: function (e, dt) {
      if (e.data.purrT > 0) {
        e.data.purrT -= dt;
        e.calm = true;
        e.incomeMul *= 2.0;
        if (Math.random() < dt * .6) {
          G.fx.spark(e.x + U.rand(-12, 12), e.y - 14, {
            vx: 0, vy: -10, r: 1.4, life: .8, c: '190,170,140', a: .5
          });
        }
      }
    },

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
        var p = G.board.clampPoint(e.x + e.w * .55 + 8, e.y + 6, L);
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

    BIRD: function (e, dt) {
      var t = G.board.nearest(e, 112, isAnyWord(['NEST', 'TREE']));
      if (t) {
        e.calm = true;
        e.incomeMul *= (t.text === 'NEST') ? 2.4 : 2.0;
      }
    },

    EGG: function (e, dt) {
      if (e.burning) return;
      e.data.hatch = (e.data.hatch || 0) + dt * e.speedMul;
      var p = e.data.hatch / 80;
      if (p > 0.6 && Math.random() < dt * (p - 0.5) * 3) {
        G.fx.spark(e.x + U.rand(-10, 10), e.y, {
          vx: U.rand(-14, 14), vy: -14, r: 1.4, life: .5, c: '200,185,150', a: .8
        });
      }
      if (e.data.hatch >= 80) become(e, 'BIRD', '210,195,160', '알에서 <b>BIRD</b> 가 깨어났다');
    },

    FISH: function (e, dt) {
      var w = G.board.nearest(e, 138, isAnyWord(['RIVER', 'WATER', 'RAIN', 'ICE']));
      if (w) {
        e.calm = true;
        e.incomeMul *= (w.text === 'RIVER') ? 2.5 : 2.0;
        if (Math.random() < dt * 1.2) {
          G.fx.spark(e.x + U.rand(-14, 14), e.y - 8, {
            vx: 0, vy: -12, r: 1.3, life: .6, c: '80,170,180', a: .5
          });
        }
      }
    },

    /* 벌레: 나무를 갉는다 */
    BUG: function (e, dt) {
      var t = G.board.near(e, 104, isWord('TREE'));
      for (var i = 0; i < t.length; i++) {
        t[i].data.bugged = 0.5;
        t[i].incomeMul *= 0.5;
      }
    },

    /* 생쥐: 치즈 곁에서는 얌전해진다 */
    MOUSE: function (e, dt) {
      if (G.board.nearest(e, 108, isWord('CHEESE'))) {
        e.calm = true;
        e.incomeMul *= 2.0;
      }
    },

    CHEESE: function (e, dt) {
      var m = G.board.near(e, 210, isWord('MOUSE'));
      for (var i = 0; i < m.length; i++) pull(e, m[i], 110, dt, 54);
    },

    /* ---------- 먹을 것 ---------- */

    /* 고기: 짐승을 부르고, 불 곁에서는 점점 노릇해진다 */
    MEAT: function (e, dt) {
      var a = G.board.near(e, 190, isAnyWord(['CAT', 'DOG']));
      for (var i = 0; i < a.length; i++) pull(e, a[i], 90, dt, 60);

      var f = G.board.nearest(e, 100, isWord('FIRE'));
      var p = f ? G.contacts.progress(e, f, 'cook', 24) : 0;
      e.setCook(p);
      if (p > 0) {
        e.incomeMul *= 1 + p * 0.8;         // 익어 가는 만큼 값이 오른다
        if (Math.random() < dt * (2 + p * 8)) {
          G.fx.spark(e.x + U.rand(-e.w * .3, e.w * .3), e.y - e.h * .25, {
            vx: U.rand(-5, 5), vy: U.rand(-24, -12), g: -8,
            r: U.rand(1.6, 3), life: U.rand(.6, 1.1), c: '200,175,145', a: .28, drag: .97
          });
        }
      }
    },

    /**
     * 구이: 갓 구웠을 때가 전부다.
     * 불에서 빼지 않으면 연기가 점점 짙어지다가 타 버리고,
     * 빼 놓으면 식으면서 값이 떨어져 결국 MEAT 로 돌아간다.
     * 이 게임에서 플레이어가 반드시 손을 대야 하는 자리 — 숫자 대신 연기로 알린다.
     */
    ROAST: function (e, dt) {
      if (e.burning) { e.setBadge(''); return; }
      if (e.data.hot === undefined) e.data.hot = C.ROAST_HOT;

      if (G.board.nearest(e, 124, isWord('FIRE'))) {
        e.data.over = (e.data.over || 0) + dt * e.hazardMul;
        var p = Math.min(1, e.data.over / C.ROAST_BURN);
        e.setBadge(p > .5 ? '탄내' : '', 'warn');
        if (Math.random() < dt * (3 + p * p * 46)) {
          G.fx.spark(e.x + U.rand(-e.w * .35, e.w * .35), e.y - e.h * .3, {
            vx: U.rand(-7, 7), vy: U.rand(-34, -18) - p * 14, g: -10,
            r: U.rand(2.4, 4.4 + p * 3), life: U.rand(.9, 1.5),
            c: p > .5 ? '86,80,76' : '150,142,136', a: .18 + p * .3, drag: .98
          });
        }
        if (e.data.over >= C.ROAST_BURN) {
          e.data.over = 0;              // 꺼 주면 다시 처음부터 (되붙는 소동을 막는다)
          e.data.hot = C.ROAST_HOT * .5;
          e.setBadge('');
          e.ignite();
        }
        return;
      }

      e.data.over = 0;
      e.data.hot -= dt;
      if (e.data.hot <= 0) {
        e.setBadge('');
        become(e, 'MEAT', '190,150,120', '<b>ROAST</b> 가 다 식었다');
        return;
      }
      var k = e.data.hot / C.ROAST_HOT;
      e.incomeMul *= 1 + (C.ROAST_MUL - 1) * k;
      e.setBadge(k > .6 ? '갓 구움' : (k > .3 ? '아직 따뜻하다' : '식어 간다'), k > .3 ? 'good' : null);
      var a = G.board.near(e, 190, isAnyWord(['CAT', 'DOG']));
      for (var i = 0; i < a.length; i++) pull(e, a[i], 90, dt, 60);
    },

    /* ---------- 돈 ---------- */

    /* ---------- 보석 ---------- */

    GOLD: function (e, dt) {
      gem(e, dt, G.board.nearest(e, 186, isWord('BANK')) ? 1.7 : 1);
    },

    IRON: function (e, dt) {
      var hot = G.board.nearest(e, 122, isWord('FIRE'));
      gem(e, dt, hot ? 1.5 : 1);
      if (hot) {
        var n = G.board.near(e, 132, function (o) { return o.type === 'word' && o !== e && !o.burning; });
        for (var i = 0; i < n.length; i++) n[i].incomeMul *= 1.2;
      }
      var m = G.board.near(e, 220, isWord('MAGNET'));
      for (var j = 0; j < m.length; j++) pull(m[j], e, 150, dt, 52);
    },

    RUBY: function (e, dt) {
      gem(e, dt, G.board.nearest(e, 126, isWord('FIRE')) ? 1.5 : 1);
    },

    EMERALD: function (e, dt) {
      gem(e, dt, G.board.nearest(e, 132, isAnyWord(['TREE', 'SEED'])) ? 1.5 : 1);
    },

    DIAMOND: function (e, dt) {
      var lit = G.board.nearest(e, 140, isAnyWord(['LAMP', 'SUN', 'GLASS']));
      gem(e, dt, lit ? 1.5 : 1);
      if (!lit) return;
      var n = G.board.near(e, 150, function (o) { return o.type === 'word' && o !== e; });
      for (var i = 0; i < n.length; i++) n[i].incomeMul *= 1.4;
    },

    /** 가게: 보석을 사들인다. 가게 위에 잠깐만 올려 두면 그 자리에서 목돈이 된다 */
    SHOP: function (e, dt) {
      if (e.burning) return;

      var g = G.board.nearest(e, 96, function (o) {
        return o.type === 'word' && o !== e && GEMS.indexOf(o.text) >= 0;
      });
      if (!g) { e.data.hold = 0; return; }

      e.data.hold = (e.data.hold || 0) + dt;
      var p = e.data.hold / C.GEM_HOLD;
      G.fx.linkDots(e.x, e.y, g.x, g.y, Math.min(1, p), dt);
      if (p < 1) return;

      e.data.hold = 0;
      var v = Math.round(C.GEM_PRICE * g.text.length * (g.data.q || 1));
      var gx = g.x, gy = g.y, name = g.text;
      G.board.remove(g);
      G.board.earn(v);
      G.ui.floatMoney(e.x, e.y - 28, v);
      G.fx.coins(e.x, e.y, 22);
      G.fx.burst(gx, gy, '190,170,120', 22, 116);
      G.fx.ring(e.x, e.y, { r0: 6, r1: 92, life: .7, c: '180,110,175', lw: 1.5 });
      G.ui.toast('<b>' + name + '</b> 를 팔았다');
    },

    /* 유령: 겹쳐 선 단어에 씌어 벌이를 부풀린다 */
    GHOST: function (e, dt) {
      var w = G.board.nearest(e, 76, function (o) { return o.type === 'word' && o !== e; });
      if (!w) return;
      w.incomeMul *= 2.0;
      e.incomeMul *= 1.4;
      e.calm = true;
      e.data.riding = 1;
      if (Math.random() < dt * 1.6) {
        G.fx.spark(w.x + U.rand(-w.w * .4, w.w * .4), w.y - 6, {
          vx: 0, vy: -14, r: 1.8, life: .9, c: '160,160,200', a: .5
        });
      }
    }
  };

  /* ==================================================================
     ACTIONS — 주기적으로 한 번씩 일어나는 사건
     ================================================================== */
  var ACTIONS = {

    /* 돌풍 — 밀어내는 대신 글자를 실어 온다 */
    gust: function (e) {
      var a = Math.random() * Math.PI * 2;
      var n = G.board.near(e, 230, function (o) { return o !== e; });
      for (var i = 0; i < n.length; i++) {
        var o = n[i];
        if (o.def && o.def.heavy) continue;
        var p = 190 * (1 - U.dist(e.x, e.y, o.x, o.y) / 230);
        o.vx += Math.cos(a) * p;
        o.vy += Math.sin(a) * p;
        o.heldBy = null;
      }
      G.game.hurrySpawn(C.WIND_CUT);
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
        o.data.fresh = 16;
        if (o.type === 'word' && (o.text === 'TREE' || o.text === 'SEED')) o.data.wet = 14;
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

    /* 폭풍 — 돌풍 + 비 + 벼락 */
    storm: function (e) {
      ACTIONS.gust(e);
      ACTIONS.rain(e);
      G.fx.ring(e.x, e.y, { r0: 14, r1: 250, life: .8, c: '90,105,140', lw: 2 });

      var t = G.board.nearest(e, 240, function (o) { return o.type === 'word' && o !== e; });
      if (!t || !U.chance(.55)) return;
      G.fx.line(t.x + U.rand(-40, 40), 0, t.x, t.y, { life: .35, c: '235,235,180', lw: 3 });
      G.fx.burst(t.x, t.y, '235,230,170', 22, 140);
      if (U.chance(.72)) {
        t.data.lucky = 26;
        G.ui.toast('벼락이 <b>' + t.text + '</b> 를 때렸다 — 한동안 미친 듯이 번다');
      } else {
        G.ui.toast('벼락이 <b>' + t.text + '</b> 를 때려 글자로 흩어졌다');
        G.board.explode(t);
      }
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

    /* 고양이가 착지하며 글자를 툭 민다. 쥐가 보이면 그쪽으로 덮친다 */
    cat: function (e) {
      if (e.data.purrT > 0) return;              // 골골거리는 중에는 안 움직인다
      var n = G.board.near(e, 96, isLoose);
      for (var i = 0; i < n.length; i++) n[i].push(e.x, e.y, U.rand(110, 200));
      if (n.length) G.fx.ring(e.x, e.y, { r0: 6, r1: 90, life: .4, c: '170,150,120', lw: 1 });
      var m = G.board.nearest(e, 220, isWord('MOUSE'));
      if (m) e.startJump(Math.min(200, U.dist(e.x, e.y, m.x, m.y)), Math.atan2(m.y - e.y, m.x - e.x), .45);
      else e.startJump(140);
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
      e.startJump(road ? 300 : 150, a, road ? 1.0 : 0.75);
      var self = e;
      e.onLand = function () {
        var hit = G.board.near(self, 78, function (o) { return o !== self && o.type === 'word'; });
        for (var i = 0; i < hit.length; i++) hit[i].push(self.x, self.y, 170);
        var loose = G.board.near(self, 130, isLoose);
        for (var j = 0; j < loose.length; j++) pull(self, loose[j], 110, 1, 44);
        G.fx.ring(self.x, self.y, { r0: 70, r1: 6, life: .4, c: '170,90,90', lw: 1 });
        if (road) {
          var v = reward(0.4, 12);
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

    /* 새가 멀리서 글자를 물어 온다. 벌레가 보이면 먼저 쫓는다 */
    bird: function (e) {
      if (G.board.nearest(e, 112, isAnyWord(['NEST', 'TREE']))) return;
      var bug = G.board.nearest(e, 320, isWord('BUG'));
      if (bug) {
        e.startJump(Math.min(240, U.dist(e.x, e.y, bug.x, bug.y)), Math.atan2(bug.y - e.y, bug.x - e.x), .5);
        return;
      }
      if (G.board.count() >= C.MAX_ENTITIES) { e.startJump(160); return; }
      e.startJump(200);
      var self = e;
      e.onLand = function () {
        var L = G.board.spawnLetter(null, self.x + U.rand(-40, 40), self.y + U.rand(26, 54));
        L.vy = 24;
        G.fx.spark(self.x, self.y + 8, { vx: 0, vy: 18, r: 1.8, life: .6, c: '110,170,190', a: .7 });
        self.onLand = null;
      };
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
      var roll = U.randInt(0, 5);
      if (roll === 0 && G.board.count() < C.MAX_ENTITIES) {
        G.board.spawnLetter(null, e.x + U.rand(-70, 70), e.y + U.rand(-50, 50));
        G.ui.toast('행운: 새 글자');
      } else if (roll === 1) {
        var v = reward(0.8, 22);
        G.board.earn(v); G.ui.floatMoney(e.x, e.y - 20, v);
        G.fx.coins(e.x, e.y, 12);
      } else if (roll === 2) {
        var burning = G.board.all().filter(isBurning);
        if (burning.length) {
          burning.forEach(function (o) { o.extinguish(); });
          G.ui.toast('행운: 소나기가 불을 껐다');
        } else {
          G.game.hurrySpawn(0.35);
          G.ui.toast('행운: 다음 글자가 서둘러 온다');
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

    /* 유령이 놀래킨다 — 단, 무언가에 씌어 있을 때는 얌전하다 */
    ghost: function (e) {
      if (e.data.riding) { e.data.riding = 0; return; }
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

    /* 벌이 꿀을 턴다 */
    bee: function (e) {
      if (!G.board.nearest(e, 132, isAnyWord(['TREE', 'SEED']))) { e.startJump(120); return; }
      var v = reward(0.22, 8);
      G.board.earn(v); G.ui.floatMoney(e.x, e.y - 16, v);
      G.fx.coins(e.x, e.y, 6);
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
      e.startJump(80, Math.atan2(t.y - e.y, t.x - e.x));
      G.fx.spark(t.x, t.y, { vx: U.rand(-20, 20), vy: 10, r: 1.6, life: .5, c: '130,140,70', a: .7 });
    },

    /* 생쥐가 축낸다 */
    mouse: function (e) {
      if (G.board.nearest(e, 108, isWord('CHEESE'))) return;
      var steal = Math.min(G.state.money, reward(0.1, 2));
      if (steal > 0.5) {
        G.state.money -= steal;
        G.ui.floatMoney(e.x, e.y - 14, -steal);
      }
      e.startJump(120);
    }
  };

  /* ==================================================================
     BONDS — 위치 + 시간이 만들어내는 사건
     ================================================================== */

  /** 조리·제련·숙성 공용. bond.into 에 적은 단어로 변신한다 */
  var COOK_MSG = {
    ROAST: '<b>MEAT</b> 가 노릇하게 구워졌다',
    GLASS: '<b>SAND</b> 가 녹아 <b>GLASS</b> 가 되었다',
    STEAM: '물이 다 말라 <b>STEAM</b> 이 되었다',
    WATER: '<b>ICE</b> 가 녹아 <b>WATER</b> 가 되었다',
    SAND: '<b>ROCK</b> 이 깎여 <b>SAND</b> 가 되었다',
    CHEESE: '<b>MILK</b> 가 삭아 <b>CHEESE</b> 가 되었다'
  };

  var BONDS = {
    cook: function (a, b, bond) {
      become(a, bond.into, '235,190,120', COOK_MSG[bond.into] ||
        '<b>' + a.text + '</b> 가 <b>' + bond.into + '</b> 가 되었다');
    },

    ignite: function (a, b) {
      b.ignite();
      G.contacts.clear(a, b, 'ignite', 6);
    },

    douse: function (a, b) {           // a=WATER, b=FIRE
      b.suppress = 14;
      G.fx.splash(b.x, b.y);
      G.contacts.clear(a, b, 'douse', 20);
    },

    /* 렌즈가 볕을 모아 초점에 불을 붙인다 */
    focus: function (a, b) {           // a=GLASS, b=SUN
      var t = G.board.nearest(a, 150, function (o) {
        return o.type === 'word' && o !== a && o.def.flammable && !o.burning;
      });
      G.fx.line(b.x, b.y, a.x, a.y, { life: .8, c: '255,240,170', lw: 2.5 });
      if (t) {
        G.fx.line(a.x, a.y, t.x, t.y, { life: .8, c: '255,220,120', lw: 2 });
        t.ignite();
      } else {
        var v = reward(0.35, 12);
        G.board.earn(v); G.ui.floatMoney(a.x, a.y - 20, v);
      }
      G.contacts.clear(a, b, 'focus', 25);
    },

    unlock: function (a, b) {          // a=KEY, b=BOX
      var v = b.data.stored || 0;
      b.data.stored = 0;
      b.setBadge('');
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

    purr: function (a, b) {            // a=CAT, b=MILK/MEAT/ROAST
      a.data.purrT = 34;
      G.fx.coins(a.x, a.y, 6);
      G.contacts.clear(a, b, 'purr', 30);
    },

    dig: function (a, b) {             // a=DOG, b=BONE/MEAT/ROAST
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

    eat: function (a, b) {             // a=BIRD, b=BUG
      var x = b.x, y = b.y;
      G.board.remove(b);
      G.fx.burst(x, y, '110,130,60', 14, 80);
      var v = reward(0.6, 16);
      G.board.earn(v); G.ui.floatMoney(x, y - 14, v);
      G.ui.toast('BIRD 가 BUG 를 잡았다');
    },

    roost: function (a, b) {           // a=BIRD, b=NEST/TREE
      G.contacts.clear(a, b, 'roost', 24);
      if (G.board.count() >= C.MAX_ENTITIES) return;
      /* 새 → 알 → 새 가 끝없이 불어나지 않게 */
      var flock = G.board.all().filter(isAnyWord(['EGG', 'BIRD']));
      if (flock.length >= 5) return;
      var p = G.board.clampPoint(b.x + U.rand(-52, 52), b.y + U.rand(30, 58), { w: 60, h: 40 });
      var g = G.board.makeWord('EGG', p.x, p.y);
      g.born();
      G.game.onWordFormed(g, true);
      G.fx.ring(b.x, b.y, { r0: 6, r1: 62, life: .6, c: '190,165,120', lw: 1.2 });
      G.ui.toast('<b>EGG</b> 가 하나 놓였다');
    },

    nibble: function (a, b) {          // a=MOUSE, b=CHEESE
      var v = reward(0.45, 12);
      G.board.earn(v); G.ui.floatMoney(b.x, b.y - 20, v);
      G.fx.coins(b.x, b.y, 8);
      G.contacts.clear(a, b, 'nibble', 12);
    },

    banish: function (a, b) {          // a=LAMP, b=GHOST
      b.startJump(300, Math.atan2(b.y - a.y, b.x - a.x), .7);
      b.actTimer = Math.max(b.actTimer, 20);
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
    }
  };

  /** b 가 a 곁에서 "타는" 게 아니라 "변하는" 사이인가 (MEAT 는 불에 타기 전에 구워진다) */
  function transformsWith(b, a) {
    var bonds = b.def && b.def.bonds;
    if (!bonds) return false;
    for (var i = 0; i < bonds.length; i++) {
      if (bonds[i].key !== 'cook') continue;
      var w = bonds[i].with;
      if (Array.isArray(w) && w.indexOf(a.text) >= 0) return true;
    }
    return false;
  }

  var GUARD = {
    ignite: function (a, b) {
      return !b.burning && a.suppress <= 0 && b.chill <= 0 && !transformsWith(b, a);
    },
    cook: function (a, b) { return !a.burning && a.chill <= 0; },
    douse: function (a, b) { return b.suppress <= 0; },
    focus: function (a, b) { return !a.burning; }
  };

  /* ==================================================================
     메인 루프
     ================================================================== */
  var SPREAD = [{ with: '#burnable', range: 104, time: 26, key: 'ignite' }];

  function step(dt) {
    frameNo++;
    var list = G.board.all(), i, e;

    /* 1. 지속 효과 */
    for (i = 0; i < list.length; i++) {
      e = list[i];
      e.danger = 0;
      if (e.data.fresh > 0) { e.data.fresh -= dt; e.incomeMul *= 1.6; }
      if (e.type !== 'word') continue;
      if (e.data.lucky > 0) { e.data.lucky -= dt; e.incomeMul *= 2.2; }
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
      if (e.burning) applyBonds(e, SPREAD, dt);
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

    /* 4. 화재 결과 — 나무는 숯을 남기고, 나머지는 흩어진다 */
    for (i = list.length - 1; i >= 0; i--) {
      e = list[i];
      if (!e.burning || e.burnTime <= C.BURN_COLLAPSE) continue;
      if (e.text === 'TREE' && G.board.count() < C.MAX_ENTITIES) {
        e.burning = false;
        become(e, 'COAL', '90,80,75', '다 타 버린 <b>TREE</b> 자리에 <b>COAL</b> 이 남았다');
      } else {
        G.ui.toast('<b>' + e.text + '</b> 가 무너져 글자로 흩어졌다');
        G.fx.burst(e.x, e.y, '120,110,105', 26, 130);
        G.board.explode(e, true);
      }
    }

    G.tokens.step(dt);
  }

  function applyBonds(a, bonds, dt) {
    for (var bi = 0; bi < bonds.length; bi++) {
      var bond = bonds[bi];
      var cands = G.board.near(a, bond.range * 1.12, function (o) {
        return o !== a && G.matchSpec(o, bond.with);
      });
      for (var ci = 0; ci < cands.length; ci++) {
        var b = cands[ci];
        var g = GUARD[bond.key];
        if (g && !g(a, b)) continue;
        var rate = Math.min(a.hazardMul, b.hazardMul) * (b.stoke || 1);
        var entry = G.contacts.accum(a, b, bond.key, dt * rate);
        var p = Math.max(0, entry.t) / bond.time;
        if (bond.key === 'ignite') {
          if (p > (b.danger || 0)) b.danger = Math.min(1, p);
          if (p > 0.15) G.fx.dangerDots(a.x, a.y, b.x, b.y, Math.min(1, p), dt);
        } else if (p > 0.25 && (bond.key === 'cook' || bond.key === 'focus')) {
          G.fx.linkDots(b.x, b.y, a.x, a.y, Math.min(1, p), dt);
        }
        if (entry.t >= bond.time) {
          entry.t = 0;
          BONDS[bond.key](a, b, bond);
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
