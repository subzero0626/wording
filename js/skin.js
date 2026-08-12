/* ==========================================================================
   skin.js — 보드 배경 스킨
   카탈로그 · 해변(WebGL) · 우주(2D 행성/소행성) · 밀물/중력
   ========================================================================== */
var G = window.G || (window.G = {});

G.SKINS = [
  { id: 'plain', name: '기본', desc: '깨끗한 보드', cost: 0 },
  { id: 'beach', name: '해변', desc: '파스텔 바다와 모래사장 · 밀물', cost: 3500 },
  { id: 'space', name: '우주', desc: '항성 · 던져 미끄러짐 · 소행성 충돌', cost: 3500 }
];

G.skin = (function () {
  var cv = null, gl = null, prog = null, buf = null;
  var uRes = null, uTime = null;
  var mode = 'off'; // beach: 'gl' | '2d' | 'off'
  var ctx2 = null;
  var spaceCv = null, spaceCtx = null;
  var W = 0, H = 0, dpr = 1;
  var t0 = 0;
  var id = 'plain';
  var enabled = true;
  var rocks = [];
  var stars = [];
  var flybys = [];
  var flyAcc = 0;
  var flyGap = 11 + Math.random() * 7;

  var VS = [
    'attribute vec2 a;',
    'void main(){ gl_Position=vec4(a,0.,1.); }'
  ].join('\n');

  var FS = [
    'precision mediump float;',
    'uniform vec2 uRes;',
    'uniform float uTime;',
    'void main(){',
    '  vec2 uv=gl_FragCoord.xy/uRes;',
    '  float t=uTime;',
    '  float along=uv.x+uv.y;',
    '  float surge=.028*sin(t*1.1+along*1.8);',
    '  float dist=uv.x-uv.y +.16 + sin(along*5.+t*.5)*.01 + surge;',
    '  float edge=smoothstep(-.01,.025,dist);',
    '',
    '  vec3 water=vec3(.74,.86,.91);',
    '  vec3 sand=vec3(.95,.88,.77);',
    '  vec3 col=mix(water, sand, edge);',
    '',
    '  float foam=smoothstep(.045,0.,abs(dist));',
    '  col=mix(col, vec3(.98,.97,.95), foam*.65);',
    '',
    '  float w1=smoothstep(.04,0., abs(dist+.10+sin(along*5.5-t*1.2)*.012));',
    '  float w2=smoothstep(.035,0., abs(dist+.20+sin(along*4.5-t*.9)*.01));',
    '  float w3=smoothstep(.03,0., abs(dist+.30+sin(along*4.+t*.7)*.01));',
    '  col=mix(col, vec3(.84,.92,.96), (w1*.35+w2*.26+w3*.18)*(1.-edge));',
    '',
    '  gl_FragColor=vec4(col,1.);',
    '}'
  ].join('\n');

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn('[skin] shader', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  function initGL() {
    gl = cv.getContext('webgl', {
      alpha: false,
      antialias: true,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: 'low-power'
    });
    if (!gl) return false;
    var vs = compile(gl.VERTEX_SHADER, VS);
    var fs = compile(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return false;
    prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.bindAttribLocation(prog, 0, 'a');
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn('[skin] link', gl.getProgramInfoLog(prog));
      return false;
    }
    buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1
    ]), gl.STATIC_DRAW);
    uRes = gl.getUniformLocation(prog, 'uRes');
    uTime = gl.getUniformLocation(prog, 'uTime');
    return true;
  }

  function init2dBeach() {
    ctx2 = cv.getContext('2d');
    return !!ctx2;
  }

  function interactOn() {
    return !G.state || !G.state.opt || G.state.opt.skinInteract !== false;
  }

  function seedSpaceDecor() {
    rocks = [];
    stars = [];
    var i, cols = 4, rows = 3, n = cols * rows;
    for (i = 0; i < n; i++) {
      var cx = ((i % cols) + 0.5) / cols;
      var cy = (Math.floor(i / cols) + 0.5) / rows;
      /* 항성(좌상단 일부)만 살짝 비우고 고르게 */
      if (cx < 0.22 && cy < 0.22) {
        cx += 0.28;
        cy += 0.18;
      }
      cx = Math.min(0.92, Math.max(0.08, cx + (Math.random() - 0.5) * 0.05));
      cy = Math.min(0.92, Math.max(0.08, cy + (Math.random() - 0.5) * 0.05));
      rocks.push({
        x: cx,
        y: cy,
        phase: Math.random() * Math.PI * 2,
        spin: 0.25 + Math.random() * 0.45,
        ampX: 5 + Math.random() * 10,
        ampY: 4 + Math.random() * 8,
        size: 2.2 + (i % 5) * 0.9,
        tint: 0.7 + Math.random() * 0.25
      });
    }
    for (i = 0; i < 55; i++) {
      stars.push({
        x: Math.random(),
        y: Math.random(),
        r: 0.35 + Math.random() * 1.1,
        a: 0.2 + Math.random() * 0.5,
        tw: Math.random() * Math.PI * 2
      });
    }
  }

  function init(beachCanvas, spaceCanvas) {
    cv = beachCanvas;
    spaceCv = spaceCanvas;
    t0 = performance.now();
    seedSpaceDecor();
    if (spaceCv) {
      spaceCtx = spaceCv.getContext('2d');
      spaceCv.classList.add('hidden');
    }
    if (initGL()) mode = 'gl';
    else if (init2dBeach()) mode = '2d';
    else mode = 'off';
    applyDom();
  }

  function catalog() { return G.SKINS; }

  function findSkin(sid) {
    for (var i = 0; i < G.SKINS.length; i++) {
      if (G.SKINS[i].id === sid) return G.SKINS[i];
    }
    return null;
  }

  function owned(sid) {
    if (!G.state || !G.state.skinsOwned) return sid === 'plain';
    return !!G.state.skinsOwned[sid];
  }

  function ensureState() {
    if (!G.state) return;
    if (!G.state.skinsOwned) G.state.skinsOwned = { plain: true };
    if (!G.state.skinsOwned.plain) G.state.skinsOwned.plain = true;
    /* 삭제된 스킨(초원·노을·종이접기 등)은 기본으로 */
    if (!G.state.skinId || !findSkin(G.state.skinId)) G.state.skinId = 'plain';
    if (G.state.skinsOwned) {
      delete G.state.skinsOwned.meadow;
      delete G.state.skinsOwned.sunset;
      delete G.state.skinsOwned.origami;
    }
  }

  function syncFromState() {
    ensureState();
    setId(G.state.skinId || 'plain');
  }

  function applyDom() {
    var play = document.getElementById('play');
    if (!play) return;
    play.classList.remove('skin-beach', 'skin-space');
    var beachOn = enabled && id === 'beach' && mode !== 'off';
    var spaceOn = enabled && id === 'space' && !!spaceCtx;
    if (cv) cv.classList.toggle('hidden', !beachOn);
    if (spaceCv) spaceCv.classList.toggle('hidden', !spaceOn);
    if (!enabled || id === 'plain') return;
    play.classList.add('skin-' + id);
  }

  function setEnabled(v) {
    enabled = !!v;
    applyDom();
  }

  function setId(next) {
    id = next || 'plain';
    if (G.state) G.state.skinId = id;
    if (id !== 'space') flybys = [];
    applyDom();
  }

  function select(sid) {
    ensureState();
    if (!owned(sid)) return false;
    setId(sid);
    return true;
  }

  function buy(sid) {
    ensureState();
    var sk = findSkin(sid);
    if (!sk || owned(sid)) return false;
    if (sk.cost <= 0) {
      G.state.skinsOwned[sid] = true;
      setId(sid);
      return true;
    }
    if (!G.board.spend(sk.cost)) return false;
    G.state.skinsOwned[sid] = true;
    setId(sid);
    return true;
  }

  /** 항성 — 크게, 코너 밖으로 중심을 둬서 일부만 보임 */
  function starBody(bw, bh) {
    var r = Math.min(bw, bh) * 0.483; /* 0.42 * 1.15 */
    return { x: -r * 0.22, y: -r * 0.02, r: r };
  }

  function motionDamp() {
    if (id === 'space' && interactOn()) return 0.955;
    return 0.90;
  }

  function resizeCanvas(el, w, h) {
    if (!el) return;
    var rw = Math.round(w * dpr);
    var rh = Math.round(h * dpr);
    if (el.width !== rw || el.height !== rh) {
      el.width = rw;
      el.height = rh;
    }
    el.style.width = w + 'px';
    el.style.height = h + 'px';
  }

  function resize(w, h) {
    W = w; H = h;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (cv && mode !== 'off') {
      resizeCanvas(cv, w, h);
      if (mode === 'gl' && gl) gl.viewport(0, 0, cv.width, cv.height);
    }
    if (spaceCv) resizeCanvas(spaceCv, w, h);
  }

  function renderGL(sec) {
    gl.viewport(0, 0, cv.width, cv.height);
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(uRes, cv.width, cv.height);
    gl.uniform1f(uTime, sec);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function renderBeach2d(sec) {
    var w = W, h = H;
    if (!w || !h || !ctx2) return;
    ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
    var surge = Math.sin(sec * 1.1) * 10;
    ctx2.fillStyle = '#bddae6';
    ctx2.fillRect(0, 0, w, h);
    ctx2.fillStyle = '#f1e0bc';
    ctx2.beginPath();
    ctx2.moveTo(w * 1.08 + surge, -2);
    ctx2.lineTo(w + 2, -2);
    ctx2.lineTo(w + 2, h + 2);
    ctx2.lineTo(-2, h + 2);
    ctx2.lineTo(-2, h * 1.08 - surge);
    ctx2.closePath();
    ctx2.fill();
    ctx2.strokeStyle = 'rgba(250,248,245,0.9)';
    ctx2.lineWidth = 8;
    ctx2.beginPath();
    ctx2.moveTo(w * 1.08 + surge, 0);
    ctx2.lineTo(0, h * 1.08 - surge);
    ctx2.stroke();
  }

  function renderSpace(sec) {
    var w = W, h = H, ctx = spaceCtx;
    if (!w || !h || !ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var bg = ctx.createLinearGradient(0, 0, w * 0.15, h);
    bg.addColorStop(0, '#1c2438');
    bg.addColorStop(0.55, '#252e48');
    bg.addColorStop(1, '#2f3654');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    /* 색은 유지하고 대비만 낮춤 */
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(0, 0, w, h);

    var i, s, tw;
    for (i = 0; i < stars.length; i++) {
      s = stars[i];
      tw = 0.55 + 0.45 * Math.sin(sec * 1.3 + s.tw);
      ctx.globalAlpha = s.a * tw * 0.55;
      ctx.fillStyle = '#e8eef8';
      ctx.beginPath();
      ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    var S = starBody(w, h);

    /* 원형 + 조밀·부드러운 기어 테두리 (일정 회전) */
    function starGearPath(cx, cy, R, t) {
      ctx.beginPath();
      var teeth = 24;
      var amp = R * 0.016;
      var n = teeth * 12;
      var spin = t * 0.35;
      for (var k = 0; k <= n; k++) {
        var a = (k / n) * Math.PI * 2;
        var rr = R + amp * Math.sin(a * teeth + spin);
        var px = cx + Math.cos(a) * rr;
        var py = cy + Math.sin(a) * rr;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    }

    /* 항성 — 색 유지, 광배만 약하게 */
    var glow = ctx.createRadialGradient(S.x, S.y, S.r * 0.2, S.x, S.y, S.r * 2.2);
    glow.addColorStop(0, 'rgba(255,220,140,0.22)');
    glow.addColorStop(0.45, 'rgba(255,190,100,0.08)');
    glow.addColorStop(1, 'rgba(255,180,80,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(S.x, S.y, S.r * 2.2, 0, Math.PI * 2);
    ctx.fill();

    var core = ctx.createRadialGradient(S.x, S.y, 0, S.x, S.y, S.r);
    core.addColorStop(0, '#fff6d0');
    core.addColorStop(0.55, '#ffd078');
    core.addColorStop(1, '#f0a040');
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = core;
    starGearPath(S.x, S.y, S.r, sec);
    ctx.fill();
    ctx.globalAlpha = 1;

    /* 소행성 — 같은 색, 더 옅게 */
    for (i = 0; i < rocks.length; i++) {
      var r = rocks[i];
      var ax = r.x * w + Math.cos(sec * r.spin + r.phase) * r.ampX;
      var ay = r.y * h + Math.sin(sec * r.spin * 0.85 + r.phase) * r.ampY;
      var c = Math.floor(130 * r.tint);
      ctx.globalAlpha = 0.42;
      ctx.fillStyle = 'rgb(' + (c + 25) + ',' + (c + 18) + ',' + (c + 12) + ')';
      ctx.beginPath();
      ctx.arc(ax, ay, r.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    /* 지나가는 소행성 — 얇고 긴 물방울 + 하얀 빛 */
    for (i = 0; i < flybys.length; i++) {
      var m = flybys[i];
      var ang = Math.atan2(m.vy, m.vx);
      drawFlyDrop(ctx, m.x, m.y, ang, m.r, 1);
      if (m.buddy) {
        drawFlyDrop(ctx, m.buddy.x, m.buddy.y, ang, m.buddy.r, 1);
      }
    }
  }

  function drawFlyDrop(ctx, x, y, ang, r, scale) {
    scale = scale || 1;
    /* 앞→뒤 두께가 일정하게 줄고, 얇은 흰 방울 */
    var len = r * 8.2 * scale;
    var w0 = r * 0.22 * scale; /* 앞 */
    var w1 = r * 0.10 * scale; /* 뒤 — 거의 일정하게만 가늘어짐 */
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);

    ctx.beginPath();
    ctx.moveTo(len * 0.12, 0);
    /* 앞 반구 */
    ctx.bezierCurveTo(len * 0.12, -w0, len * 0.02, -w0, 0, -w0);
    /* 위쪽: 앞에서 뒤로 선형에 가깝게 */
    ctx.lineTo(-len * 0.72, -w1);
    ctx.quadraticCurveTo(-len * 0.82, 0, -len * 0.72, w1);
    /* 아래쪽 */
    ctx.lineTo(0, w0);
    ctx.bezierCurveTo(len * 0.02, w0, len * 0.12, w0, len * 0.12, 0);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.42;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  var washAcc = 0;
  var washGap = 17 + Math.random() * 8;
  var washT = -1;
  var prevSurge = -1;
  var SHORE = 0.16;
  var WASH_DUR = 2.6;

  function shoreDist(x, y, bw, bh) {
    if (!(bw > 0 && bh > 0)) return 0;
    return (x / bw) + (y / bh) - 1 + SHORE;
  }

  function stepBeach(dt, ents, bw, bh) {
    var t = (performance.now() - t0) * 0.001;
    var surge = Math.sin(t * 1.1);

    if (washT < 0) {
      washAcc += dt;
      var rising = surge > 0.2 && prevSurge <= 0.2;
      if (washAcc >= washGap && (rising || washAcc >= washGap + 6)) {
        washT = 0;
        washAcc = 0;
        washGap = 17 + Math.random() * 8;
      }
      prevSurge = surge;
      if (washT < 0) return;
    } else {
      prevSurge = surge;
    }

    washT += dt;
    if (washT > WASH_DUR) {
      washT = -1;
      return;
    }

    if (!interactOn()) return;

    var u = washT / WASH_DUR;
    var env = Math.sin(Math.PI * u);
    env = env * env;

    var dx = bh, dy = bw;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    dx /= len; dy /= len;

    for (var i = 0; i < ents.length; i++) {
      var e = ents[i];
      if (e.type !== 'letter' && e.type !== 'cluster') continue;
      if (e.dragging || e.merging) continue;
      var sd = shoreDist(e.x, e.y, bw, bh);
      if (sd >= 0.02) continue;

      if (e.jump) {
        e.jump = null;
        e.hop = 0;
      }

      var depth = Math.min(1, Math.max(0.25, -sd / 0.5));
      var letters = Math.max(1, (e.text && e.text.length) || 1);
      var mass = 1 / letters;
      var spd = (76 + 44 * env) * depth * mass;
      e.vx = dx * spd;
      e.vy = dy * spd;
      e.heldBy = null;
    }
  }

  /** 우주 — 약한 중력 + 가끔 대각선 소행성이 글자를 침 */
  function spawnFlyby(bw, bh) {
    var margin = 50;
    /* 오른쪽 위 대각선 → 왼쪽 아래 */
    var x0 = bw + margin;
    var y0 = -margin + Math.random() * bh * 0.35;
    var x1 = -margin;
    var y1 = bh * 0.45 + Math.random() * bh * 0.55;
    var dx = x1 - x0;
    var dy = y1 - y0;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var spd = 760 + Math.random() * 320;
    var vx = (dx / len) * spd;
    var vy = (dy / len) * spd;
    var r = (6 + Math.random() * 4) * 5 * 0.7 * 0.8;
    var m = {
      x: x0,
      y: y0,
      vx: vx,
      vy: vy,
      r: r,
      scale: 1,
      life: len / spd + 0.35,
      hit: {},
      buddy: null
    };
    /* 25% — 옆에 작은 동반 소행성 */
    if (Math.random() < 0.25) {
      var px = -vy / spd;
      var py = vx / spd;
      var side = (Math.random() < 0.5 ? 1 : -1) * (r * 2.2 + Math.random() * r * 0.8);
      m.buddy = {
        x: x0 + px * side,
        y: y0 + py * side,
        ox: px * side,
        oy: py * side,
        /* 본채보다 60% 작게 → 40% 크기 */
        r: r * 0.4,
        hit: {}
      };
    }
    flybys.push(m);
  }

  function stepFlybys(dt, ents, bw, bh) {
    flyAcc += dt;
    if (flyAcc >= flyGap && flybys.length < 2) {
      flyAcc = 0;
      flyGap = 12 + Math.random() * 10;
      spawnFlyby(bw, bh);
    }

    for (var f = flybys.length - 1; f >= 0; f--) {
      var m = flybys[f];
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (m.buddy) {
        m.buddy.x = m.x + m.buddy.ox;
        m.buddy.y = m.y + m.buddy.oy;
      }
      m.life -= dt;
      if (m.life <= 0 || m.x < -80 || m.y < -80 || m.x > bw + 80 || m.y > bh + 80) {
        flybys.splice(f, 1);
        continue;
      }

      hitFlyRock(m, ents, m.r);
      if (m.buddy) hitFlyRock(m.buddy, ents, m.buddy.r, m.vx, m.vy);
    }
  }

  function hitFlyRock(m, ents, rad, ovx, ovy) {
    if (!interactOn()) return;
    var vx = ovx != null ? ovx : m.vx;
    var vy = ovy != null ? ovy : m.vy;
    if (!m.hit) m.hit = {};
    var hitR = rad + 16;
    for (var i = 0; i < ents.length; i++) {
      var e = ents[i];
      if (e.type !== 'letter' && e.type !== 'cluster') continue;
      if (e.dragging || e.merging) continue;
      if (e.def && e.def.heavy) continue;
      if (m.hit[e.id]) continue;

      var dx = e.x - m.x;
      var dy = e.y - m.y;
      var d = Math.sqrt(dx * dx + dy * dy) || 1;
      if (d > hitR + Math.max(e.w, e.h) * 0.25) continue;

      m.hit[e.id] = true;
      if (e.jump) {
        e.jump = null;
        e.hop = 0;
      }
      var letters = Math.max(1, (e.text && e.text.length) || 1);
      var power = (85 + rad * 4) / letters;
      var nlen = Math.sqrt(vx * vx + vy * vy) || 1;
      e.vx += (vx / nlen) * power + (dx / d) * power * 0.2;
      e.vy += (vy / nlen) * power + (dy / d) * power * 0.2;
      e.heldBy = null;
    }
  }

  function stepSpace(dt, ents, bw, bh) {
    stepFlybys(dt, ents, bw, bh);

    if (!interactOn()) return;

    var S = starBody(bw, bh);
    for (var i = 0; i < ents.length; i++) {
      var e = ents[i];
      if (e.type !== 'letter' && e.type !== 'cluster') continue;
      if (e.dragging || e.merging || e.jump) continue;
      if (e.def && e.def.heavy) continue;

      var dx = S.x - e.x;
      var dy = S.y - e.y;
      var d = Math.sqrt(dx * dx + dy * dy) || 1;
      if (d < S.r * 1.2) continue;

      var letters = Math.max(1, (e.text && e.text.length) || 1);
      var mass = 1 / letters;
      var g = (S.r * S.r * 8) / (d * d);
      if (g > 14) g = 14;
      e.vx += (dx / d) * g * mass * dt;
      e.vy += (dy / d) * g * mass * dt;
    }
  }

  function step(dt, ents, bw, bh) {
    if (!enabled) return;
    if (!(bw > 0 && bh > 0)) return;
    if (id === 'beach') {
      if (!ents || !ents.length) return;
      stepBeach(dt, ents, bw, bh);
    } else if (id === 'space') {
      stepSpace(dt, ents || [], bw, bh);
    }
  }

  function render() {
    if (!enabled) return;
    var sec = (performance.now() - t0) * 0.001;
    if (id === 'beach' && mode !== 'off' && cv) {
      if (mode === 'gl') renderGL(sec);
      else renderBeach2d(sec);
    } else if (id === 'space') {
      renderSpace(sec);
    }
  }

  return {
    init: init,
    resize: resize,
    render: render,
    step: step,
    shoreDist: shoreDist,
    motionDamp: motionDamp,
    interactOn: interactOn,
    setEnabled: setEnabled,
    setId: setId,
    select: select,
    buy: buy,
    owned: owned,
    syncFromState: syncFromState,
    ensureState: ensureState,
    catalog: catalog,
    id: function () { return id; }
  };
})();
