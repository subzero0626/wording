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

  /* ------------------------------------------------------------------
     거리
     단어에 적힌 range 는 중심 사이 거리가 아니라 글자 사이의 빈 틈으로 읽는다.
     그래야 DIAMOND 처럼 긴 단어가 공짜로 넓은 사정거리를 갖지 않는다.
     ------------------------------------------------------------------ */

  /** 두 글자 사이에 실제로 벌어진 틈 (닿아 있으면 0) */
  function gapOf(a, b) {
    var dx = Math.max(0, Math.abs(a.x - b.x) - (a.w + b.w) / 2);
    var dy = Math.max(0, Math.abs(a.y - b.y) - (a.h + b.h) / 2);
    return Math.sqrt(dx * dx + dy * dy);
  }

  /** range 값을 허용 틈으로 옮긴다 */
  function reach(r) {
    return Math.max(C.RANGE_MIN, (r - C.RANGE_BASE) * C.RANGE_MUL);
  }

  function near(e, r, f) {
    var g = reach(r), out = [], list = G.board.all();
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      if (o === e) continue;
      if (f && !f(o)) continue;
      if (gapOf(e, o) > g) continue;
      out.push(o);
    }
    return out;
  }

  function nearest(e, r, f) {
    var g = reach(r), best = null, bd = Infinity, list = G.board.all();
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      if (o === e) continue;
      if (f && !f(o)) continue;
      var d = gapOf(e, o);
      if (d <= g && d < bd) { bd = d; best = o; }
    }
    return best;
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

  /**
   * 무르익음 — 짝이 곁에 있는 동안 천천히 익는다.
   *
   * 예전에는 여기서 글자를 바꿔치웠다 (MEAT → ROAST, SAND → GLASS). 그런데
   * ROAST 도 GLASS 도 플레이어가 직접 철자해서 만들 수 있는 단어라, 같은 단어를
   * 얻는 길이 둘이 되어 버렸다. 게다가 애써 만든 SAND 가 제멋대로 사라졌다.
   * 그래서 이제 글자는 절대 바뀌지 않는다 — 빛깔이 변하고 벌이가 오를 뿐이다.
   *
   * 한번 익은 것은 짝을 치워도 되돌아가지 않는다. 익히는 데 든 시간을 빼앗지 않는다.
   *
   * @param secs 다 익는 데 걸리는 시간
   * @param tint 'green' 이면 푸르게, 그 밖에는 노릇하게
   * @return 익은 정도 0~1
   */
  function ripen(e, dt, partner, secs, tint) {
    var p = e.data.ripe || 0;
    if (partner && p < 1) p = Math.min(1, p + dt * e.speedMul / secs);
    e.data.ripe = p;
    e.setRipe(p, tint);
    if (p > 0) e.incomeMul *= 1 + (C.RIPE_MUL - 1) * p;
    return p;
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

  /**
   * 다 익은 것을 불 위에 그대로 두면 검어지다 불이 붙는다.
   * 얼마나 남았는지 숫자로 세어 주지 않는다 — 연기와 빛깔이 시계다.
   * 불에서 빼면 그을음이 천천히 가시니, 제때 빼내는 것이 요령이다.
   */
  function overcook(e, dt, fire) {
    var over = Math.max(0, (e.data.over || 0) +
      (fire ? dt * e.hazardMul : -dt * 0.6));
    e.data.over = over;
    var p = Math.min(1, over / C.ROAST_BURN);
    if (fire && Math.random() < dt * (3 + p * p * 46)) {
      G.fx.spark(e.x + U.rand(-e.w * .35, e.w * .35), e.y - e.h * .3, {
        vx: U.rand(-7, 7), vy: U.rand(-34, -18) - p * 14, g: -10,
        r: U.rand(2.4, 4.4 + p * 3), life: U.rand(.9, 1.5),
        c: p > .5 ? '86,80,76' : '150,142,136', a: .18 + p * .3, drag: .98
      });
    }
    if (over >= C.ROAST_BURN) { e.data.over = 0; e.ignite(); }
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
      var t = near(e, 168, isAnyWord(['TREE', 'SEED']));
      for (var i = 0; i < t.length; i++) t[i].speedMul *= 1.6;

      var n = near(e, 150, function (o) { return o.type === 'word' && o !== e; });
      for (var j = 0; j < n.length; j++) {
        if (n[j].def.flammable) n[j].hazardMul *= 1.5;
        if (n[j].def.tags && n[j].def.tags.indexOf('wet') >= 0) n[j].incomeMul *= 0.6;
      }
      if (nearest(e, 180, isWord('MOON'))) e.incomeMul *= 1.3;
    },

    /* 달: 주변을 밤처럼 잠재워 조용히 더 벌게 한다 */
    MOON: function (e, dt) {
      var n = near(e, 160, function (o) { return o !== e; });
      for (var i = 0; i < n.length; i++) {
        n[i].calm = true;
        n[i].incomeMul *= 1.3;
      }
      if (nearest(e, 180, isWord('SUN'))) e.incomeMul *= 1.3;
      if (Math.random() < dt * .5) {
        G.fx.spark(e.x + U.rand(-e.w * .5, e.w * .5), e.y + U.rand(-10, 10), {
          vx: 0, vy: -7, r: 1.4, life: 1.1, c: '160,165,205', a: .45
        });
      }
    },

    /* 별: 가까운 행운을 더 자주 일으킨다 */
    STAR: function (e, dt) {
      var l = near(e, 190, isWord('LUCK'));
      for (var i = 0; i < l.length; i++) l[i].speedMul *= 2.2;
    },

    /* 바람: 불길을 키운다 */
    WIND: function (e, dt) {
      var f = near(e, 150, function (o) { return o.burning || (o.type === 'word' && o.text === 'FIRE'); });
      for (var i = 0; i < f.length; i++) f[i].hazardMul *= 1.8;
    },

    /* ---------- 물 ---------- */

    /* 물: 주변의 불을 끄고, 불 곁에서는 끓어올라 주변을 재촉한다 */
    WATER: function (e, dt) {
      var b = near(e, 132, isBurning);
      for (var i = 0; i < b.length; i++) {
        var t = acc(b[i], 'wet', dt);
        G.fx.spark(b[i].x + U.rand(-10, 10), b[i].y - 6, {
          vx: 0, vy: -10, r: 1.4, life: .5, c: '150,190,220', a: .5
        });
        if (t > 4.5) b[i].extinguish();
      }
      var t2 = near(e, 126, isAnyWord(['TREE', 'SEED']));
      for (var j = 0; j < t2.length; j++) t2[j].speedMul *= 1.5;

      /* 끓는 물 — 말라 없어지지 않는다. 불을 치우면 그냥 잦아든다 */
      e.data.boil = !!nearest(e, 120, isWord('FIRE'));
      if (!e.data.boil) return;
      var n = near(e, 140, function (o) { return o.type === 'word' && o !== e; });
      for (var k = 0; k < n.length; k++) n[k].speedMul *= 1.4;
      if (Math.random() < dt * 3) {
        G.fx.spark(e.x + U.rand(-e.w * .4, e.w * .4), e.y - e.h * .3, {
          vx: U.rand(-6, 6), vy: U.rand(-26, -14), g: -6,
          r: U.rand(1.6, 3), life: .8, c: '210,220,225', a: .3, drag: .97
        });
      }
    },

    /* 강: 흘러가며 낱글자를 하류로 실어 나른다. ROCK 이 있으면 그 뒤가 여울이 된다 */
    RIVER: function (e, dt) {
      if (e.data.flow === undefined) e.data.flow = U.chance(.5) ? 1 : -1;
      var rocks = near(e, 160, isWord('ROCK'));
      var n = near(e, 150, isLoose);
      for (var i = 0; i < n.length; i++) {
        if (n[i].jump) continue;
        /* 여울에 걸린 글자는 떠내려보내지 않는다 (붙드는 일은 ROCK 이 한다) */
        var caught = false;
        for (var r = 0; r < rocks.length; r++) {
          if (gapOf(n[i], rocks[r]) < 40) { caught = true; break; }
        }
        if (caught) continue;
        n[i].vx += e.data.flow * 150 * dt;
        n[i].vy += (e.y - n[i].y) * 0.6 * dt;
      }
      var b = near(e, 172, isBurning);
      for (var j = 0; j < b.length; j++) {
        if (acc(b[j], 'wet', dt) > 3) b[j].extinguish();
      }
      var t = near(e, 152, isAnyWord(['TREE', 'SEED']));
      for (var k = 0; k < t.length; k++) t[k].speedMul *= 1.5;
      if (Math.random() < dt * 3) {
        G.fx.spark(e.x - e.data.flow * e.w * .5, e.y + U.rand(-10, 10), {
          vx: e.data.flow * 40, vy: 0, r: 1.2, life: .8, c: '90,160,200', a: .5, drag: .99
        });
      }
    },

    /**
     * 얼음: 주변을 얼려 붙들어 둔다.
     * 불 곁에서는 녹아내려 얼리는 힘을 잃지만, 녹는 동안 흘린 물이 불을 끈다.
     * 사라지지는 않는다 — 열에서 떼어 놓으면 도로 얼어붙는다.
     */
    ICE: function (e, dt) {
      var hot = nearest(e, 118, isWord('FIRE'));
      var m = (e.data.melt || 0) + (hot ? dt / 15 : -dt / 20);
      e.data.melt = m = Math.max(0, Math.min(1, m));

      var solid = 1 - m;
      if (solid > 0.05) {
        var n = near(e, 60 + 58 * solid, function (o) { return o !== e; });
        for (var i = 0; i < n.length; i++) {
          n[i].chill = 0.7 * solid;
          n[i].hazardMul *= 1 - 0.5 * solid;
          if (n[i].burning && acc(n[i], 'iced', dt) > 8) n[i].extinguish();
        }
      }
      /* 녹아 흐르는 물이 불을 끈다 — 많이 녹았을수록 빠르게 */
      if (m > 0.1) {
        var b = near(e, 124, isBurning);
        for (var j = 0; j < b.length; j++) {
          if (acc(b[j], 'wet', dt * m * 1.6) > 4.5) b[j].extinguish();
        }
        if (Math.random() < dt * m * 4) {
          G.fx.spark(e.x + U.rand(-e.w * .4, e.w * .4), e.y + e.h * .3, {
            vx: 0, vy: 26, g: 40, r: 1.3, life: .6, c: '150,200,225', a: .5
          });
        }
      }
    },

    /**
     * 김: 주변을 몰아치게 재촉한다.
     * 가만히 두면 식어서 힘을 잃는다. 없어지지는 않고, 다시 데우면 되살아난다.
     */
    STEAM: function (e, dt) {
      var hot = nearest(e, 136, function (o) {
        return o.type === 'word' && (o.text === 'FIRE' || (o.text === 'WATER' && o.data.boil));
      });
      var h = (e.data.hot === undefined ? 1 : e.data.hot) + (hot ? dt / 12 : -dt / 60);
      e.data.hot = h = Math.max(0, Math.min(1, h));
      if (h < 0.05) return;
      var n = near(e, 156, function (o) { return o.type === 'word' && o !== e; });
      for (var i = 0; i < n.length; i++) n[i].speedMul *= 1 + 0.9 * h;
    },

    /* ---------- 불과 땅 ---------- */

    /* 불: 곁에 있는 것들을 데운다. COAL 을 물리면 불길이 거세진다 */
    FIRE: function (e, dt) {
      var hot = 1;
      if (nearest(e, 120, isWord('COAL'))) { hot = 2; e.stoke = 2; }
      var n = near(e, 136, function (o) { return o.type === 'word' && o !== e && !o.burning; });
      for (var i = 0; i < n.length; i++) n[i].incomeMul *= 1 + 0.2 * hot;
      if (Math.random() < dt * 2 * hot) {
        G.fx.spark(e.x + U.rand(-e.w * .4, e.w * .4), e.y - 8, {
          vx: U.rand(-6, 6), vy: U.rand(-34, -18), r: U.rand(1.2, 2.2),
          life: .8, c: '235,140,60', a: .7
        });
      }
    },

    /**
     * 바위: 물살 한가운데 놓으면 뒤쪽에 여울이 생긴다.
     * 떠내려가던 낱글자가 거기 걸려 뛰지도 흘러가지도 않고 차곡차곡 모인다 —
     * 강가에 쳐 두는 그물인 셈이다.
     */
    ROCK: function (e, dt) {
      if (!nearest(e, 156, isWord('RIVER'))) return;
      var n = near(e, 138, isLoose);
      for (var i = 0; i < n.length; i++) {
        n[i].calm = true;
        n[i].jump = null;
        n[i].vx *= 0.88; n[i].vy *= 0.88;
        pull(e, n[i], 70, dt, 44);
      }
      if (n.length && Math.random() < dt * 2) {
        G.fx.spark(e.x + U.rand(-e.w * .5, e.w * .5), e.y + U.rand(-8, 8), {
          vx: U.rand(-10, 10), vy: -6, r: 1.2, life: .6, c: '140,180,205', a: .4
        });
      }
    },

    /**
     * 모래: 타는 것을 덮어 끈다.
     * 물보다 느리지만 젖지 않으니 몇 번이고 다시 쓸 수 있고,
     * 불 자체를 끄지는 못해도 번지는 기세는 눌러 준다.
     */
    SAND: function (e, dt) {
      var b = near(e, 120, isBurning);
      for (var i = 0; i < b.length; i++) {
        if (acc(b[i], 'buried', dt) > 7) b[i].extinguish();
        if (Math.random() < dt * 2) {
          G.fx.spark(b[i].x + U.rand(-12, 12), b[i].y + U.rand(-6, 6), {
            vx: U.rand(-8, 8), vy: 10, g: 30, r: 1.2, life: .5, c: '200,182,132', a: .55
          });
        }
      }
      var f = near(e, 128, isWord('FIRE'));
      for (var j = 0; j < f.length; j++) f[j].hazardMul *= 0.55;
    },

    /* 유리: 빛을 모아 렌즈가 된다 */
    GLASS: function (e, dt) {
      var src = nearest(e, 140, isAnyWord(['SUN', 'LAMP']));
      if (!src) return;
      var n = near(e, 140, function (o) { return o.type === 'word' && o !== e; });
      for (var i = 0; i < n.length; i++) n[i].incomeMul *= 1.35;
      if (Math.random() < dt * 2) {
        G.fx.line(src.x, src.y, e.x, e.y, { life: .3, c: '225,215,150', lw: 1 });
      }
    },

    /* ---------- 풀 ---------- */

    TREE: function (e, dt) {
      if (e.data.bugged > 0) e.data.bugged -= dt;
      if (e.data.wet > 0) { e.data.wet -= dt; e.speedMul *= 1.8; }
    },

    /* 씨앗: 볕이나 물이 있어야 싹이 튼다. 튼 싹은 그대로 남는다 */
    SEED: function (e, dt) {
      if (e.burning) return;
      if (e.data.wet > 0) { e.data.wet -= dt; e.speedMul *= 1.8; }
      var sun = nearest(e, 150, isAnyWord(['SUN', 'WATER', 'RAIN', 'RIVER', 'LAMP']));
      var p = ripen(e, dt, sun, 90, 'green');
      if (sun && p < 1 && Math.random() < dt * .5) {
        G.fx.spark(e.x + U.rand(-8, 8), e.y - 4, {
          vx: 0, vy: -10, r: 1.3, life: .7, c: '120,175,110', a: .5
        });
      }
    },

    BEE: function (e, dt) {
      var t = near(e, 132, isAnyWord(['TREE', 'SEED']));
      if (!t.length) return;
      e.calm = true;
      e.incomeMul *= 1.7;
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
      var n = near(e, 150, isLoose);
      var k = Math.min(n.length, 6);
      for (var i = 0; i < k; i++) n[i].calm = true;
      if (k) e.incomeMul *= 1 + k * 0.16;
    },

    ROAD: function (e, dt) {
      var c = near(e, 170, isWord('CAR'));
      for (var i = 0; i < c.length; i++) c[i].incomeMul *= 1.4;
    },

    /* 상자: 낱글자를 붙잡아 정리하고 값을 쌓는다 */
    BOX: function (e, dt) {
      var n = near(e, 128, isLoose);
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
      var n = near(e, 178, isLoose);
      for (var i = 0; i < n.length; i++) pull(e, n[i], 130, dt);
    },

    /* 등불: 밝히고, 붙들고, 책을 비추고, 유령을 민다 */
    LAMP: function (e, dt) {
      var n = near(e, 150, function (o) { return o.type === 'word' && o !== e; });
      for (var i = 0; i < n.length; i++) n[i].incomeMul *= 1.25;
      var l = near(e, 128, isLoose);
      for (var j = 0; j < l.length; j++) l[j].calm = true;
      var b = near(e, 140, isWord('BOOK'));
      for (var k = 0; k < b.length; k++) b[k].speedMul *= 1.8;
      var g = near(e, 122, isWord('GHOST'));
      for (var m = 0; m < g.length; m++) g[m].push(e.x, e.y, 90 * dt);
    },

    /**
     * 톱니바퀴: 다른 톱니와 맞물리면 함께 돈다.
     * 맞물린 하나마다 제 벌이가 곱절로 뛰니 여럿을 짜 놓을수록 급하게 커지지만,
     * 물릴 수 있는 자리가 넷뿐이고 톱니 하나하나가 보드 한 칸을 잡아먹는다.
     */
    GEAR: function (e, dt) {
      var list = G.board.all(), n = 0;
      for (var i = 0; i < list.length && n < C.GEAR_MAX; i++) {
        var o = list[i];
        if (o === e || o.type !== 'word' || o.text !== 'GEAR') continue;
        if (U.dist(e.x, e.y, o.x, o.y) <= C.GEAR_MESH) n++;
      }
      if (!n) return;
      e.gearMul *= Math.pow(C.GEAR_MUL, n);
      if (Math.random() < dt * n * .8) {
        G.fx.spark(e.x + U.rand(-e.w * .45, e.w * .45), e.y + U.rand(-e.h * .3, e.h * .3), {
          vx: U.rand(-8, 8), vy: U.rand(-12, -2), g: 10,
          r: U.rand(.9, 1.6), life: U.rand(.3, .6), c: '190,180,165', a: .6
        });
      }
    },

    /* 시계: 행동을 재촉한다 — 불이 번지는 속도까지 */
    CLOCK: function (e, dt) {
      var n = near(e, 152, function (o) { return o.type === 'word' && o !== e; });
      for (var i = 0; i < n.length; i++) {
        n[i].speedMul *= 1.9;
        n[i].hazardMul *= 1.4;
      }
    },

    /* 시간: 위험은 늦추고, 익어야 하는 것은 빨리 여물게 한다 */
    TIME: function (e, dt) {
      var n = near(e, 146, function (o) { return o !== e; });
      for (var i = 0; i < n.length; i++) {
        n[i].hazardMul *= 0.25;
        n[i].speedMul *= 0.8;
      }
      var ripe = near(e, 146, isAnyWord(['SEED', 'EGG']));
      for (var j = 0; j < ripe.length; j++) ripe[j].speedMul *= 2.2;
    },

    NEST: function (e, dt) {
      if (nearest(e, 112, isWord('BIRD'))) e.incomeMul *= 1.4;
    },

    /* ---------- 짐승 ---------- */

    CAT: function (e, dt) {
      if (e.data.purrT > 0) {
        e.data.purrT -= dt;
        e.calm = true;
        e.incomeMul *= 1.7;
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
          if (U.chance(.4) && G.board.count() < G.maxEntities()) {
            G.board.spawnLetter(null, e.x + U.rand(-40, 40), e.y + U.rand(20, 50));
          } else {
            var v = reward(0.18, 7);
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
      var t = nearest(e, 112, isAnyWord(['NEST', 'TREE']));
      if (t) {
        e.calm = true;
        e.incomeMul *= (t.text === 'NEST') ? 1.9 : 1.6;
      }
    },

    /* 알: 품어 주면 따뜻해진다. 다 품어진 알은 가끔 새 글자를 내놓는다 */
    EGG: function (e, dt) {
      if (e.burning) return;
      var warm = nearest(e, 120, isAnyWord(['NEST', 'BIRD']));
      var p = ripen(e, dt, warm, 80);
      if (warm && p < 1 && Math.random() < dt * (p + .2) * 2) {
        G.fx.spark(e.x + U.rand(-10, 10), e.y, {
          vx: U.rand(-14, 14), vy: -14, r: 1.4, life: .5, c: '200,185,150', a: .8
        });
      }
      if (p < 1) return;
      e.data.lay = (e.data.lay || 0) + dt;
      if (e.data.lay > 34 && G.board.count() < G.maxEntities()) {
        e.data.lay = 0;
        G.board.spawnLetter(null, e.x + U.rand(-34, 34), e.y + U.rand(24, 48));
        G.fx.burst(e.x, e.y, '210,195,160', 10, 56);
      }
    },

    FISH: function (e, dt) {
      var w = nearest(e, 138, isAnyWord(['RIVER', 'WATER', 'RAIN', 'ICE']));
      if (w) {
        e.calm = true;
        e.incomeMul *= (w.text === 'RIVER') ? 1.9 : 1.6;
        if (Math.random() < dt * 1.2) {
          G.fx.spark(e.x + U.rand(-14, 14), e.y - 8, {
            vx: 0, vy: -12, r: 1.3, life: .6, c: '80,170,180', a: .5
          });
        }
      }
    },

    /* 벌레: 나무를 갉는다 */
    BUG: function (e, dt) {
      var t = near(e, 104, isWord('TREE'));
      for (var i = 0; i < t.length; i++) {
        t[i].data.bugged = 0.5;
        t[i].incomeMul *= 0.5;
      }
    },

    /* 생쥐: 치즈 곁에서는 얌전해진다 */
    MOUSE: function (e, dt) {
      if (nearest(e, 108, isWord('CHEESE'))) {
        e.calm = true;
        e.incomeMul *= 1.7;
      }
    },

    CHEESE: function (e, dt) {
      var m = near(e, 210, isWord('MOUSE'));
      for (var i = 0; i < m.length; i++) pull(e, m[i], 110, dt, 54);
    },

    /* 우유: TIME 곁에 오래 두면 꾸덕하게 삭아 벌이가 오른다 */
    MILK: function (e, dt) {
      ripen(e, dt, nearest(e, 96, isWord('TIME')), 38);
    },

    /* ---------- 먹을 것 ---------- */

    /**
     * 고기: 짐승을 부르고, 불 곁에 두면 노릇하게 익는다.
     * 고기는 끝까지 MEAT 다 — 빛깔이 변하고 벌이가 오를 뿐이다.
     * 다 익은 뒤에도 불 위에 두면 타 버린다. 익거나 타거나, 그 둘뿐이다.
     */
    MEAT: function (e, dt) {
      var a = near(e, 190, isAnyWord(['CAT', 'DOG']));
      for (var i = 0; i < a.length; i++) pull(e, a[i], 90, dt, 60);
      if (e.burning) return;

      var f = nearest(e, 100, isWord('FIRE'));
      var p = ripen(e, dt, f, 24);
      if (p > 0 && Math.random() < dt * (2 + p * 8)) {
        G.fx.spark(e.x + U.rand(-e.w * .3, e.w * .3), e.y - e.h * .25, {
          vx: U.rand(-5, 5), vy: U.rand(-24, -12), g: -8,
          r: U.rand(1.6, 3), life: U.rand(.6, 1.1), c: '200,175,145', a: .28, drag: .97
        });
      }
      if (p >= 1) overcook(e, dt, f);
    },

    /**
     * 구이: 처음부터 익어 있는 고기라 그냥 두어도 잘 번다.
     * 불 옆에 계속 두면 점점 검어지다 타 버린다.
     */
    ROAST: function (e, dt) {
      if (e.burning) return;
      e.incomeMul *= C.ROAST_MUL;
      overcook(e, dt, nearest(e, 124, isWord('FIRE')));
      var a = near(e, 190, isAnyWord(['CAT', 'DOG']));
      for (var i = 0; i < a.length; i++) pull(e, a[i], 90, dt, 60);
    },

    /* ---------- 돈 ---------- */

    /* ---------- 보석 ---------- */

    GOLD: function (e, dt) {
      gem(e, dt, nearest(e, 186, isWord('BANK')) ? 1.4 : 1);
    },

    IRON: function (e, dt) {
      var hot = nearest(e, 122, isWord('FIRE'));
      gem(e, dt, hot ? 1.35 : 1);
      if (hot) {
        var n = near(e, 132, function (o) { return o.type === 'word' && o !== e && !o.burning; });
        for (var i = 0; i < n.length; i++) n[i].incomeMul *= 1.15;
      }
      var m = near(e, 220, isWord('MAGNET'));
      for (var j = 0; j < m.length; j++) pull(m[j], e, 150, dt, 52);
    },

    RUBY: function (e, dt) {
      gem(e, dt, nearest(e, 126, isWord('FIRE')) ? 1.35 : 1);
    },

    EMERALD: function (e, dt) {
      gem(e, dt, nearest(e, 132, isAnyWord(['TREE', 'SEED'])) ? 1.35 : 1);
    },

    DIAMOND: function (e, dt) {
      var lit = nearest(e, 140, isAnyWord(['LAMP', 'SUN', 'GLASS']));
      gem(e, dt, lit ? 1.35 : 1);
      if (!lit) return;
      var n = near(e, 150, function (o) { return o.type === 'word' && o !== e; });
      for (var i = 0; i < n.length; i++) n[i].incomeMul *= 1.25;
    },

    /** 가게: 보석을 사들인다. 가게 위에 잠깐만 올려 두면 그 자리에서 목돈이 된다 */
    SHOP: function (e, dt) {
      if (e.burning) return;

      var g = nearest(e, 96, function (o) {
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
      var w = nearest(e, 76, function (o) { return o.type === 'word' && o !== e; });
      if (!w) return;
      w.incomeMul *= 1.7;
      e.incomeMul *= 1.25;
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
      var n = near(e, 230, function (o) { return o !== e; });
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
      var n = near(e, R, function (o) { return o !== e; });
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

      var t = nearest(e, 240, function (o) { return o.type === 'word' && o !== e; });
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
      if (G.board.count() >= G.maxEntities()) return;
      var L = G.board.spawnLetter(null, e.x + U.rand(-56, 56), e.y + U.rand(34, 64));
      L.vy = 30;
      G.fx.spark(e.x, e.y + 10, { vx: 0, vy: 20, r: 2.2, life: .6, c: '90,165,105', a: .8, shape: 'leaf' });
    },

    /* 고양이가 착지하며 글자를 툭 민다. 쥐가 보이면 그쪽으로 덮친다 */
    cat: function (e) {
      if (e.data.purrT > 0) return;              // 골골거리는 중에는 안 움직인다
      var n = near(e, 96, isLoose);
      for (var i = 0; i < n.length; i++) n[i].push(e.x, e.y, U.rand(110, 200));
      if (n.length) G.fx.ring(e.x, e.y, { r0: 6, r1: 90, life: .4, c: '170,150,120', lw: 1 });
      var m = nearest(e, 220, isWord('MOUSE'));
      if (m) e.startJump(Math.min(200, U.dist(e.x, e.y, m.x, m.y)), Math.atan2(m.y - e.y, m.x - e.x), .45);
      else e.startJump(140);
    },

    /* 개가 글자를 물고 간다 */
    dog: function (e) {
      if (e.data.digT > 0) return;
      var L = nearest(e, 230, function (o) {
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
      var road = nearest(e, 200, isWord('ROAD'));
      var a = Math.random() * Math.PI * 2;
      if (road) a = Math.atan2(road.y - e.y, road.x - e.x) + U.rand(-.4, .4);
      e.startJump(road ? 300 : 150, a, road ? 1.0 : 0.75);
      var self = e;
      e.onLand = function () {
        var hit = near(self, 78, function (o) { return o !== self && o.type === 'word'; });
        for (var i = 0; i < hit.length; i++) hit[i].push(self.x, self.y, 170);
        var loose = near(self, 130, isLoose);
        for (var j = 0; j < loose.length; j++) pull(self, loose[j], 110, 1, 44);
        G.fx.ring(self.x, self.y, { r0: 70, r1: 6, life: .4, c: '170,90,90', lw: 1 });
        if (road) {
          var v = reward(0.24, 8);
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
      if (nearest(e, 112, isAnyWord(['NEST', 'TREE']))) return;
      var bug = nearest(e, 320, isWord('BUG'));
      if (bug) {
        e.startJump(Math.min(240, U.dist(e.x, e.y, bug.x, bug.y)), Math.atan2(bug.y - e.y, bug.x - e.x), .5);
        return;
      }
      if (G.board.count() >= G.maxEntities()) { e.startJump(160); return; }
      e.startJump(200);
      var self = e;
      e.onLand = function () {
        var L = G.board.spawnLetter(null, self.x + U.rand(-40, 40), self.y + U.rand(26, 54));
        L.vy = 24;
        G.fx.spark(self.x, self.y + 8, { vx: 0, vy: 18, r: 1.8, life: .6, c: '110,170,190', a: .7 });
        self.onLand = null;
      };
    },

    /**
     * 상점 잔돈.
     * 가게의 본업은 보석 매입이고 이건 지나가다 줍는 푼돈이다.
     * 액수를 보드 전체 수입에 걸어 두었기 때문에, 가게를 여러 채 세우면
     * 채마다 그 금액을 흘려 벌이가 제곱으로 불어난다. 가게 수로 나눠 그것을 막는다 —
     * 몇 채를 세우든 잔돈으로 들어오는 총액은 같고, 줍는 수고만 늘어난다.
     */
    shop: function (e) {
      if (e.burning) return;
      if (G.tokens.count() > 5) return;
      var shops = G.board.all().filter(isWord('SHOP')).length || 1;
      var a = Math.random() * 6.2832, d = U.rand(46, 92);
      var p = G.board.clampPoint(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, { w: 40, h: 40 });
      var v = Math.max(1, Math.round(reward(0.08, 3) * U.rand(.8, 1.25) / shops));
      G.tokens.spawn(p.x, p.y, v);
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
      if (roll === 0 && G.board.count() < G.maxEntities()) {
        G.board.spawnLetter(null, e.x + U.rand(-70, 70), e.y + U.rand(-50, 50));
        G.ui.toast('행운: 새 글자');
      } else if (roll === 1) {
        var v = reward(0.45, 14);
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
        var w = nearest(e, 200, function (o) { return o.type === 'word' && o !== e; });
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
      var w = nearest(e, 150, function (o) { return o.type === 'word' && o !== e; });
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
      var v = reward(0.32, 11);
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
      if (!nearest(e, 132, isAnyWord(['TREE', 'SEED']))) { e.startJump(120); return; }
      var v = reward(0.14, 5);
      G.board.earn(v); G.ui.floatMoney(e.x, e.y - 16, v);
      G.fx.coins(e.x, e.y, 6);
    },

    /* 벌레가 훔쳐간다 */
    bug: function (e) {
      var t = nearest(e, 160, function (o) {
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
      if (nearest(e, 108, isWord('CHEESE'))) return;
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

  var BONDS = {
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
      var t = nearest(a, 150, function (o) {
        return o.type === 'word' && o !== a && o.def.flammable && !o.burning;
      });
      G.fx.line(b.x, b.y, a.x, a.y, { life: .8, c: '255,240,170', lw: 2.5 });
      if (t) {
        G.fx.line(a.x, a.y, t.x, t.y, { life: .8, c: '255,220,120', lw: 2 });
        t.ignite();
      } else {
        var v = reward(0.2, 8);
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
      var held = near(b, 140, function (o) { return o.type !== 'word'; });
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
      var v = reward(0.3, 10);
      G.board.earn(v); G.ui.floatMoney(x, y - 14, v);
      G.ui.toast('CAT 이 MOUSE 를 잡았다');
    },

    eat: function (a, b) {             // a=BIRD, b=BUG
      var x = b.x, y = b.y;
      G.board.remove(b);
      G.fx.burst(x, y, '110,130,60', 14, 80);
      var v = reward(0.35, 11);
      G.board.earn(v); G.ui.floatMoney(x, y - 14, v);
      G.ui.toast('BIRD 가 BUG 를 잡았다');
    },

    /* 둥지에 든 새는 알 대신 글자를 떨군다 — EGG 라는 단어는 직접 철자해서 만드는 것이다 */
    roost: function (a, b) {           // a=BIRD, b=NEST/TREE
      G.contacts.clear(a, b, 'roost', 24);
      if (G.board.count() >= G.maxEntities()) return;
      var L = G.board.spawnLetter(null, b.x + U.rand(-52, 52), b.y + U.rand(30, 58));
      L.vy = 24;
      G.fx.ring(b.x, b.y, { r0: 6, r1: 62, life: .6, c: '190,165,120', lw: 1.2 });
    },

    nibble: function (a, b) {          // a=MOUSE, b=CHEESE
      var v = reward(0.26, 8);
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
      if (!b.burning && G.board.count() < G.maxEntities()) {
        var L = G.board.spawnLetter(null, b.x + U.rand(-50, 50), b.y + U.rand(30, 58));
        L.vy = 26;
      }
      var v = reward(0.18, 6);
      G.board.earn(v); G.ui.floatMoney(a.x, a.y - 16, v);
      G.fx.ring(b.x, b.y, { r0: 6, r1: 66, life: .6, c: '215,185,80', lw: 1.2 });
      G.contacts.clear(a, b, 'pollen', 14);
    }
  };

  var GUARD = {
    /* 익는 중인 것에는 불이 옮지 않는다 — 고기는 타기 전에 먼저 익어야 한다.
       다 익고 나면 보호가 풀리므로, 그때부터는 제때 빼내는 것이 플레이어 몫이다 */
    ignite: function (a, b) {
      return !b.burning && a.suppress <= 0 && b.chill <= 0 &&
        !(b.data.ripe > 0 && b.data.ripe < 1);
    },
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
      if (e.data.fresh > 0) { e.data.fresh -= dt; e.incomeMul *= 1.4; }
      if (e.type !== 'word') continue;
      if (e.data.lucky > 0) { e.data.lucky -= dt; e.incomeMul *= 1.8; }
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

    /* 4. 화재 결과 — 다 타면 글자로 흩어진다 */
    for (i = list.length - 1; i >= 0; i--) {
      e = list[i];
      if (!e.burning || e.burnTime <= C.BURN_COLLAPSE) continue;
      G.ui.toast('<b>' + e.text + '</b> 가 무너져 글자로 흩어졌다');
      G.fx.burst(e.x, e.y, '120,110,105', 26, 130);
      G.board.explode(e, true);
    }

    G.tokens.step(dt);
  }

  function applyBonds(a, bonds, dt) {
    for (var bi = 0; bi < bonds.length; bi++) {
      var bond = bonds[bi];
      var cands = near(a, bond.range, function (o) {
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
        } else if (p > 0.25 && bond.key === 'focus') {
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
