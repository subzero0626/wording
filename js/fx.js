/* ==========================================================================
   fx.js — 캔버스 파티클 / 이펙트 레이어
   보드 좌표계를 그대로 사용한다 (#play 기준).
   평소 파티클은 아주 작고 절제해서, 큰 효과는 사건이 일어날 때만.
   ========================================================================== */
var G = window.G || (window.G = {});

G.fx = (function () {
  var U = G.util;
  var cv = null, ctx = null, W = 0, H = 0, dpr = 1;
  var P = [];            // 파티클
  var R = [];            // 링/파문
  var L = [];            // 선(돌풍 등)
  var MAX = 700;
  var enabled = true;

  function init(canvas) {
    cv = canvas;
    ctx = cv.getContext('2d');
  }

  function resize(w, h) {
    if (!cv) return;
    W = w; H = h;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    cv.style.width = w + 'px';
    cv.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function setEnabled(v) { enabled = v; if (!v) { P.length = 0; R.length = 0; L.length = 0; } }

  function add(p) {
    if (!enabled) return;
    if (P.length > MAX) P.shift();
    P.push(p);
  }

  /** 기본 파티클 생성 헬퍼 */
  function spark(x, y, o) {
    o = o || {};
    add({
      x: x, y: y,
      vx: o.vx || 0, vy: o.vy || 0,
      g: o.g || 0,
      r: o.r || 1.6,
      shrink: o.shrink === undefined ? 1 : o.shrink,
      life: 0, max: o.life || 1,
      c: o.c || '200,120,40',
      a: o.a === undefined ? 0.9 : o.a,
      shape: o.shape || 'dot',
      spin: o.spin || 0, rot: o.rot || 0,
      drag: o.drag === undefined ? 0.9 : o.drag
    });
  }

  function ring(x, y, o) {
    if (!enabled) return;
    o = o || {};
    R.push({
      x: x, y: y, r: o.r0 || 6, r1: o.r1 || 46,
      life: 0, max: o.life || 0.6,
      c: o.c || '90,140,110', lw: o.lw || 2
    });
  }

  function line(x1, y1, x2, y2, o) {
    if (!enabled) return;
    o = o || {};
    L.push({ x1: x1, y1: y1, x2: x2, y2: y2, life: 0, max: o.life || 0.5, c: o.c || '120,130,140', lw: o.lw || 1.5 });
  }

  /* ------------------------------------------------------------------
     상시(ambient) 이펙트 — 단어의 성격을 조용히 드러낸다
     ------------------------------------------------------------------ */
  var AMB = {
    ember: function (e, s) {                    // FIRE
      if (Math.random() > 0.55 * s) return;
      spark(e.x + U.rand(-e.w * .32, e.w * .32), e.y - e.h * .28, {
        vx: U.rand(-6, 6), vy: U.rand(-26, -14), g: -6,
        r: U.rand(1, 2.1), life: U.rand(.5, .95),
        c: U.chance(.5) ? '240,140,50' : '250,190,80', a: .85
      });
    },
    drop: function (e, s) {                     // WATER
      if (Math.random() > 0.10 * s) return;
      spark(e.x + U.rand(-e.w * .4, e.w * .4), e.y + U.rand(-4, 6), {
        vx: U.rand(-4, 4), vy: U.rand(-16, -8), g: 34,
        r: U.rand(1.2, 2), life: U.rand(.6, 1),
        c: '70,150,205', a: .7
      });
    },
    leaf: function (e, s) {                     // TREE
      if (Math.random() > 0.035 * s) return;
      spark(e.x + U.rand(-e.w * .45, e.w * .45), e.y - e.h * .1, {
        vx: U.rand(-9, 9), vy: U.rand(2, 8), g: 10,
        r: U.rand(1.4, 2.4), life: U.rand(1.4, 2.2),
        c: '90,165,105', a: .8, shape: 'leaf', spin: U.rand(-3, 3), drag: .97
      });
    },
    sparkle: function (e, s) {                  // GOLD / LUCK
      if (Math.random() > 0.06 * s) return;
      spark(e.x + U.rand(-e.w * .5, e.w * .5), e.y + U.rand(-e.h * .4, e.h * .4), {
        vx: 0, vy: U.rand(-5, -1),
        r: U.rand(1.2, 2.3), life: U.rand(.5, .9),
        c: '235,195,80', a: 1, shape: 'star', drag: .95
      });
    },
    ray: function (e, s) {                      // SUN
      if (Math.random() > 0.05 * s) return;
      var a = U.rand(0, Math.PI * 2), d = e.w * .55;
      spark(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d * .8, {
        vx: Math.cos(a) * 8, vy: Math.sin(a) * 8,
        r: U.rand(1, 1.8), life: .8, c: '240,200,90', a: .75, drag: .93
      });
    },
    rain: function (e, s) {                     // RAIN
      if (Math.random() > 0.20 * s) return;
      spark(e.x + U.rand(-e.w * .55, e.w * .55), e.y + U.rand(-2, 4), {
        vx: U.rand(-3, 1), vy: U.rand(28, 44), g: 40,
        r: U.rand(.8, 1.4), life: .5, c: '110,150,200', a: .6, shape: 'line', drag: 1
      });
    },
    swirl: function (e, s) {                    // WIND
      if (Math.random() > 0.05 * s) return;
      var a = U.rand(0, Math.PI * 2);
      spark(e.x + Math.cos(a) * e.w * .6, e.y + Math.sin(a) * 14, {
        vx: U.rand(14, 30), vy: U.rand(-3, 3),
        r: U.rand(.9, 1.5), life: .9, c: '150,175,190', a: .5, drag: .97
      });
    },
    wisp: function (e, s) {                     // GHOST
      if (Math.random() > 0.05 * s) return;
      spark(e.x + U.rand(-e.w * .4, e.w * .4), e.y + e.h * .3, {
        vx: U.rand(-4, 4), vy: U.rand(-12, -5),
        r: U.rand(2, 3.6), life: U.rand(.9, 1.5),
        c: '150,150,180', a: .35, drag: .96
      });
    },
    tickmark: function (e, s) {                 // CLOCK
      if (Math.random() > 0.02 * s) return;
      ring(e.x, e.y, { r0: 8, r1: 120, life: 1.1, c: '120,118,112', lw: 1 });
    },
    frost: function (e, s) {                    // ICE
      if (Math.random() > 0.07 * s) return;
      spark(e.x + U.rand(-e.w * .5, e.w * .5), e.y + U.rand(-e.h * .4, e.h * .4), {
        vx: U.rand(-3, 3), vy: U.rand(-4, 4),
        r: U.rand(.8, 1.6), life: U.rand(.9, 1.5),
        c: '150,215,235', a: .8, shape: 'cross', drag: .96
      });
    },
    ripple: function (e, s) {                   // TIME
      if (Math.random() > 0.012 * s) return;
      ring(e.x, e.y, { r0: e.w * .5, r1: e.w * .5 + 26, life: 1.4, c: '140,120,190', lw: 1 });
    },
    field: function (e, s) {                    // MAGNET
      if (Math.random() > 0.02 * s) return;
      ring(e.x, e.y, { r0: 150, r1: 20, life: .9, c: '170,80,100', lw: 1 });
    },
    steam: function (e, s) {                    // STEAM
      if (Math.random() > 0.4 * s) return;
      spark(e.x + U.rand(-e.w * .4, e.w * .4), e.y - e.h * .2, {
        vx: U.rand(-6, 6), vy: U.rand(-30, -16), g: -12,
        r: U.rand(2.5, 5), life: U.rand(.8, 1.4),
        c: '205,215,220', a: .35, drag: .97
      });
    },
    grit: function (e, s) {                     // SAND
      if (Math.random() > 0.09 * s) return;
      spark(e.x + U.rand(-e.w * .45, e.w * .45), e.y + e.h * .3, {
        vx: U.rand(-10, 10), vy: U.rand(-6, -1), g: 26,
        r: U.rand(.8, 1.4), life: U.rand(.5, .9),
        c: '200,180,130', a: .6
      });
    },
    shine: function (e, s) {                    // GLASS
      if (Math.random() > 0.03 * s) return;
      var a = U.rand(0, Math.PI * 2);
      spark(e.x + Math.cos(a) * e.w * .45, e.y + Math.sin(a) * e.h * .4, {
        vx: Math.cos(a) * 16, vy: Math.sin(a) * 16,
        r: U.rand(1, 1.8), life: .7, c: '190,225,235', a: .9, shape: 'star', drag: .93
      });
    },
    savory: function (e, s) {                   // ROAST
      if (Math.random() > 0.3 * s) return;
      spark(e.x + U.rand(-e.w * .35, e.w * .35), e.y - e.h * .25, {
        vx: U.rand(-5, 5), vy: U.rand(-22, -12), g: -8,
        r: U.rand(1.8, 3.4), life: U.rand(.9, 1.5),
        c: '200,170,140', a: .3, drag: .97
      });
    },
    smoke: function (e, s) {                    // 불타는 중
      if (Math.random() > 0.5 * s) return;
      spark(e.x + U.rand(-e.w * .3, e.w * .3), e.y - e.h * .4, {
        vx: U.rand(-8, 8), vy: U.rand(-34, -20), g: -10,
        r: U.rand(2.5, 5), life: U.rand(.9, 1.5),
        c: '120,110,105', a: .28, drag: .98
      });
    }
  };

  /** 오브젝트 상시 이펙트 (dt 로 확률 스케일) */
  function ambient(e, dt) {
    if (!enabled) return;
    var s = dt * 60;                          // 60fps 기준 확률 스케일
    if (e.burning) { AMB.smoke(e, s); AMB.ember(e, s * 1.6); }
    var key = e.def && e.def.fx;
    if (key && AMB[key]) AMB[key](e, s);
  }

  /* ------------------------------------------------------------------
     사건용 큰 효과
     ------------------------------------------------------------------ */
  function burst(x, y, color, n, power) {
    if (!enabled) return;
    n = n || 14; power = power || 90;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, sp = U.rand(power * .35, power);
      spark(x, y, {
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 12, g: 90,
        r: U.rand(1.4, 3), life: U.rand(.5, 1),
        c: color, a: .95, drag: .92
      });
    }
  }

  function splash(x, y) {
    burst(x, y, '90,170,220', 18, 110);
    ring(x, y, { r0: 4, r1: 60, life: .5, c: '90,170,220', lw: 2 });
  }

  function coins(x, y, n) {
    if (!enabled) return;
    for (var i = 0; i < (n || 8); i++) {
      spark(x + U.rand(-8, 8), y, {
        vx: U.rand(-40, 40), vy: U.rand(-110, -60), g: 260,
        r: U.rand(1.8, 3), life: U.rand(.7, 1.1),
        c: '225,180,60', a: 1, shape: 'star', drag: .99
      });
    }
  }

  /** 접촉 진행도 표시: 두 오브젝트 사이에 점이 늘어난다 */
  function dots(ax, ay, bx, by, t, dt, c) {
    if (!enabled) return;
    if (Math.random() > t * 0.9 * dt * 60 * 0.12) return;
    var k = U.rand(.2, .8);
    spark(U.lerp(ax, bx, k), U.lerp(ay, by, k), {
      vx: (bx - ax) * .12, vy: (by - ay) * .12 - 8, g: -4,
      r: U.rand(1, 1.8 + t), life: U.rand(.4, .7),
      c: c, a: .3 + t * .6
    });
  }

  /** 위험이 쌓이는 중 (FIRE ••• HOUSE) */
  function dangerDots(ax, ay, bx, by, t, dt) {
    dots(ax, ay, bx, by, t, dt, '235,120,50');
  }

  /** 좋은 것이 익어 가는 중 (FIRE ••• MEAT) */
  function linkDots(ax, ay, bx, by, t, dt) {
    dots(ax, ay, bx, by, t, dt, '240,190,70');
  }

  /* ------------------------------------------------------------------
     업데이트 / 렌더
     ------------------------------------------------------------------ */
  function update(dt) {
    var i, p;
    for (i = P.length - 1; i >= 0; i--) {
      p = P[i];
      p.life += dt;
      if (p.life >= p.max) { P.splice(i, 1); continue; }
      p.vy += p.g * dt;
      var d = Math.pow(p.drag, dt * 60);
      p.vx *= d; p.vy *= d;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.spin * dt;
    }
    for (i = R.length - 1; i >= 0; i--) {
      R[i].life += dt;
      if (R[i].life >= R[i].max) R.splice(i, 1);
    }
    for (i = L.length - 1; i >= 0; i--) {
      L[i].life += dt;
      if (L[i].life >= L[i].max) L.splice(i, 1);
    }
  }

  function render() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    var i, p, k, al;

    for (i = 0; i < P.length; i++) {
      p = P[i];
      k = p.life / p.max;
      al = p.a * (1 - k * k);
      var r = p.r * (p.shrink ? (1 - k * .55) : 1);
      ctx.globalAlpha = al;
      ctx.fillStyle = 'rgb(' + p.c + ')';
      ctx.strokeStyle = 'rgb(' + p.c + ')';
      if (p.shape === 'dot') {
        ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(.2, r), 0, 6.2832); ctx.fill();
      } else if (p.shape === 'star') {
        ctx.save(); ctx.translate(p.x, p.y);
        ctx.lineWidth = Math.max(.6, r * .55); ctx.beginPath();
        ctx.moveTo(-r * 1.6, 0); ctx.lineTo(r * 1.6, 0);
        ctx.moveTo(0, -r * 1.6); ctx.lineTo(0, r * 1.6);
        ctx.stroke(); ctx.restore();
      } else if (p.shape === 'cross') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.lineWidth = .8; ctx.beginPath();
        ctx.moveTo(-r, -r); ctx.lineTo(r, r); ctx.moveTo(r, -r); ctx.lineTo(-r, r);
        ctx.stroke(); ctx.restore();
      } else if (p.shape === 'leaf') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.beginPath(); ctx.ellipse(0, 0, r * 1.5, r * .7, 0, 0, 6.2832); ctx.fill();
        ctx.restore();
      } else if (p.shape === 'line') {
        ctx.lineWidth = Math.max(.6, r * .8); ctx.beginPath();
        ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * .02, p.y - p.vy * .05); ctx.stroke();
      }
    }

    for (i = 0; i < R.length; i++) {
      var rr = R[i]; k = rr.life / rr.max;
      ctx.globalAlpha = (1 - k) * .55;
      ctx.strokeStyle = 'rgb(' + rr.c + ')';
      ctx.lineWidth = rr.lw;
      ctx.beginPath();
      ctx.arc(rr.x, rr.y, U.lerp(rr.r, rr.r1, U.easeOutCubic(k)), 0, 6.2832);
      ctx.stroke();
    }

    for (i = 0; i < L.length; i++) {
      var ll = L[i]; k = ll.life / ll.max;
      ctx.globalAlpha = (1 - k) * .5;
      ctx.strokeStyle = 'rgb(' + ll.c + ')';
      ctx.lineWidth = ll.lw;
      ctx.beginPath(); ctx.moveTo(ll.x1, ll.y1); ctx.lineTo(ll.x2, ll.y2); ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }

  return {
    init: init, resize: resize, update: update, render: render,
    ambient: ambient, burst: burst, splash: splash, coins: coins,
    ring: ring, line: line, spark: spark,
    dangerDots: dangerDots, linkDots: linkDots,
    setEnabled: setEnabled,
    count: function () { return P.length; }
  };
})();
