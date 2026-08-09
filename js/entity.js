/* ==========================================================================
   entity.js — 보드 위 오브젝트 (낱글자 / 클러스터 / 단어)
   상자 없이 글자 자체가 오브젝트다. 크기는 실제로 그려진 글자 폭에서 잰다.
   등장/착지 연출은 .inner, 상시 애니메이션은 .body 가 담당한다.
   ========================================================================== */
var G = window.G || (window.G = {});

(function () {
  var U = G.util, C = G.C;

  /**
   * @param {'letter'|'cluster'|'word'} type
   * @param {string} text
   */
  function Entity(type, text, x, y) {
    this.id = U.uid('e');
    this.type = type;
    this.text = text;
    this.def = (type === 'word') ? G.defFor(text) : null;

    this.x = x || 0;
    this.y = y || 0;
    this.vx = 0; this.vy = 0;
    this.hop = 0;
    this.w = 0; this.h = 0;

    this.jump = null;
    this.jumpTimer = U.rand(4, 12);
    this.actTimer = 0;
    this.payTimer = U.rand(1, C.PAY_PERIOD);   // 지급 시점을 서로 어긋나게
    this.dragging = false;
    this.merging = false;

    /* 상태 */
    this.burning = false;
    this.burnTime = 0;
    this.chill = 0;
    this.heldBy = null;
    this.calm = false;
    this.incomeMul = 1;
    this.gearMul = 1;
    this.payMul = 1;          // 벌이 주기를 당기는 배수. SUN 이 올린다
    this.speedMul = 1;
    this.suppress = 0;
    this.age = 0;
    this.data = {};
    this.starEl = null;       // 강화 별 (FORGE 에 달구어야 생긴다)

    this.buildDom();
    this.measure();
    this.resetJumpTimer();
    /* 주사위를 굴리는 시점을 서로 어긋나게 (다 같이 굴리면 사건이 몰린다) */
    if (this.def && this.def.act) this.actTimer = U.rand(1, C.PAY_PERIOD);
  }

  Entity.prototype.buildDom = function () {
    var el = document.createElement('div');
    el.className = 'ent ' + this.type;
    el.dataset.id = this.id;

    var inner = document.createElement('div');
    inner.className = 'inner';

    var body = document.createElement('div');
    body.className = 'body';

    inner.appendChild(body);
    el.appendChild(inner);

    var dg = document.createElement('div');
    dg.className = 'danger';
    el.appendChild(dg);

    this.el = el; this.inner = inner; this.body = body; this.dgEl = dg;
    this.renderText();
    this.applyStyle();
  };

  /** 머리 위 쪽지 (조리 상태, 상자에 잠긴 값 …). 빈 값이면 지운다 */
  Entity.prototype.setBadge = function (text, tone) {
    if (!this.el) return;
    if (!text) {
      if (this.badgeEl) { this.el.removeChild(this.badgeEl); this.badgeEl = null; }
      this.badgeText = '';
      return;
    }
    if (!this.badgeEl) {
      this.badgeEl = document.createElement('div');
      this.badgeEl.className = 'badge';
      this.el.appendChild(this.badgeEl);
    }
    if (this.badgeText !== text) {
      this.badgeText = text;
      this.badgeEl.innerHTML = text;
    }
    if (this.badgeTone !== tone) {
      this.badgeTone = tone;
      this.badgeEl.className = 'badge' + (tone ? ' ' + tone : '');
    }
  };

  Entity.prototype.renderText = function () {
    var html = '';
    for (var i = 0; i < this.text.length; i++) {
      html += '<span class="ch">' + this.text[i] + '</span>';
    }
    this.body.innerHTML = html;
  };

  Entity.prototype.applyStyle = function () {
    var d = this.def;
    this.el.classList.remove('anim-shake', 'anim-wave', 'anim-float', 'anim-pulse',
      'anim-tick', 'anim-hop', 'anim-still', 'plain', 'ability');
    if (d) {
      this.el.style.setProperty('--wfg', d.color.fg);
      this.el.style.setProperty('--wbd', d.color.bd);
      this.el.classList.add(d.plain ? 'plain' : 'ability');
      if (d.anim) this.el.classList.add('anim-' + d.anim);
      if (d.ghost) this.el.classList.add('is-ghost');
    }
  };

  /**
   * 크기 측정. DOM 에 붙어 있으면 실제로 그려진 폭을 쓰고,
   * 아직 붙기 전이면 근사식으로 채운다 (board.add 에서 다시 잰다).
   */
  Entity.prototype.measure = function () {
    var w = 0, h = 0;
    if (this.el && this.el.parentNode) {
      w = this.el.offsetWidth;
      h = this.el.offsetHeight;
    }
    if (!w || !h) {
      if (this.type === 'word') {
        w = this.text.length * C.WORD_CHAR_W + C.WORD_PAD;
        h = C.WORD_H;
      } else {
        w = this.text.length * C.LETTER_CHAR_W + C.LETTER_PAD;
        h = C.LETTER_H;
      }
    }
    this.w = w; this.h = h;
  };

  /** DOM 위치 갱신 */
  Entity.prototype.render = function () {
    var tx = Math.round((this.x - this.w / 2) * 10) / 10;
    var ty = Math.round((this.y - this.h / 2 + this.hop) * 10) / 10;
    this.el.style.transform = 'translate(' + tx + 'px,' + ty + 'px)';

    var dg = Math.round((this.danger || 0) * 20) / 20;
    if (this.dgShown !== dg) {
      this.dgShown = dg;
      this.el.style.setProperty('--dg', dg.toFixed(2));
    }
    var held = !!this.heldBy;
    if (this.heldShown !== held) {
      this.heldShown = held;
      this.el.classList.toggle('held', held);
    }
    var frz = this.chill > 0;
    if (this.frzShown !== frz) {
      this.frzShown = frz;
      this.el.classList.toggle('frozen', frz);
    }
    var tamed = this.suppress > 0;
    if (this.tamedShown !== tamed) {
      this.tamedShown = tamed;
      this.el.classList.toggle('tamed', tamed);
    }
  };

  /* ------------------------------------------------------------------
     재화
     ------------------------------------------------------------------ */
  /** 한 번에 버는 양 (배수를 빼고) */
  Entity.prototype.payValue = function () {
    if (this.burning) return 0;
    if (this.type === 'letter') return C.PAY_BASE;
    if (this.type === 'cluster') return C.PAY_BASE * this.text.length;
    return (this.def.value || 0);
  };

  /**
   * 배수까지 얹은 실제 벌이.
   * 자리에서 얻는 배수(SUN·MOON·LUCK…)는 아무리 겹쳐도 INCOME_CAP 에서 잘린다.
   * 톱니바퀴 배수는 그 천장과 따로 곱한다 — 맞물릴 수 있는 수가 넷으로 정해져 있어
   * 스스로 한계를 갖고, 보드 자리를 여러 칸 내주어야만 얻는 것이기 때문이다.
   */
  Entity.prototype.income = function () {
    return this.payValue() * Math.min(this.incomeMul, C.INCOME_CAP) *
      this.gearMul * this.upMul() * this.worthMul();
  };

  /**
   * HAMMER 로 다시 매겨진 값 (보석만 가진다).
   * 20초마다 버는 돈에도, SHOP 에 넘길 때에도 똑같이 걸린다 —
   * 한쪽에만 걸면 "팔 보석은 두드리고 둘 보석은 두드리지 않는" 요령이 생긴다.
   */
  Entity.prototype.worthMul = function () {
    return (this.data && this.data.worth) || 1;
  };

  /**
   * 강화로 얻은 영구 배수.
   * 톱니와 마찬가지로 벌이 천장 바깥에서 곱한다 — 자리를 옮겨도 따라다니고,
   * 잃을 것을 걸고 얻은 값이라 다른 부스터와 자리를 다투게 두지 않는다.
   */
  Entity.prototype.upMul = function () {
    var lv = (this.data && this.data.up) || 0;
    return lv > 0 ? C.UP_MUL[Math.min(lv, C.UP_MUL.length) - 1] : 1;
  };

  /** 왼쪽 위에 붙는 강화 별 */
  Entity.prototype.setStars = function (n) {
    if (!this.el) return;
    if (!n) {
      if (this.starEl) { this.el.removeChild(this.starEl); this.starEl = null; }
      return;
    }
    if (!this.starEl) {
      this.starEl = document.createElement('div');
      this.starEl.className = 'stars';
      this.el.appendChild(this.starEl);
    }
    var s = '';
    for (var i = 0; i < n; i++) s += '<i></i>';
    this.starEl.innerHTML = s;
    this.starEl.dataset.n = n;
  };

  /**
   * 벌이 주기를 얼마나 당겨 받고 있는가 (1 이면 제 속도).
   * 한 번에 얼마를 버느냐(income)와 일부러 갈라 둔 값이다 —
   * MOON 은 앞을, SUN 은 뒤를 맡는다. 한 덩어리로 두면 둘이 같은 단어가 된다.
   */
  Entity.prototype.haste = function () {
    return Math.min(this.payMul, C.HASTE_CAP);
  };

  /** 20초 동안 실제로 들어오는 양 (주기까지 셈에 넣은 값) */
  Entity.prototype.rate = function () {
    return this.income() * this.haste();
  };

  /**
   * 무르익은 정도 (0~1). 글자는 그대로 두고 빛깔만 바꾼다.
   * @param tint 'green' 이면 푸르게, 'ash' 면 하얗게 바래게. 기본은 노릇하게
   */
  Entity.prototype.setRipe = function (p, tint) {
    p = Math.max(0, Math.min(1, p));
    var q = Math.round(p * 12) / 12;
    if (this.ripeShown === q) return;
    this.ripeShown = q;
    if (!this.el) return;
    this.el.style.setProperty('--cook', q.toFixed(2));
    this.el.classList.toggle('ripe-green', tint === 'green' && q > 0);
    this.el.classList.toggle('ripe-ash', tint === 'ash' && q > 0);
  };

  /**
   * 무언가에 걸려 있는 상태인가 — 타는 중, 얼어붙음, 물을 뒤집어씀, 익는 중.
   * 이런 글자는 다른 글자와 붙지 않는다. 먼저 상태를 풀어 줘야 한다.
   * 다 익은 것까지 막는 것은 실수로 애써 익힌 것을 뭉개지 않게 하려는 뜻이다.
   */
  Entity.prototype.afflicted = function () {
    return this.burning || this.chill > 0 || this.suppress > 0 ||
      (this.ripeShown || 0) > 0;
  };

  /* ------------------------------------------------------------------
     점프
     ------------------------------------------------------------------ */
  Entity.prototype.jumpInterval = function () {
    var m = this.def && this.def.motion;
    if (this.type !== 'word') return U.rand(C.LETTER_JUMP[0], C.LETTER_JUMP[1]);
    if (!m) return Infinity;
    return U.rand(m.min, m.max);
  };

  Entity.prototype.jumpRange = function () {
    var m = this.def && this.def.motion;
    return m ? m.range : C.LETTER_JUMP_RANGE;
  };

  Entity.prototype.resetJumpTimer = function () {
    this.jumpTimer = this.jumpInterval();
  };

  Entity.prototype.canJump = function () {
    if (this.dragging || this.jump || this.merging) return false;
    if (this.heldBy || this.calm) return false;
    if (this.type === 'word' && (!this.def || !this.def.motion)) return false;
    return true;
  };

  /** 현재 위치 주변으로 짧게 통 튄다 */
  Entity.prototype.startJump = function (range, dirAngle, dur) {
    if (this.dragging) return;
    range = range || this.jumpRange();
    var best = null, i;
    for (i = 0; i < 6; i++) {
      var a = (dirAngle === undefined || dirAngle === null)
        ? Math.random() * Math.PI * 2
        : dirAngle + U.rand(-.5, .5);
      var d = U.rand(range * .35, range);
      var nx = this.x + Math.cos(a) * d;
      var ny = this.y + Math.sin(a) * d * .8;
      var p = G.board.clampPoint(nx, ny, this);
      /* 벽 너머로는 뛰지 않는다. 여섯 번을 다 물어도 갈 데가 없으면
         이번에는 그냥 제자리에 있는다 — 다음 차례에 다시 물어본다 */
      if (G.board.blocked(this.x, this.y, p.x, p.y, this)) continue;
      var score = G.board.crowdScore(p.x, p.y, this);
      if (!best || score < best.s) best = { x: p.x, y: p.y, s: score };
      if (score === 0) break;
    }
    if (!best) return;
    this.jump = {
      sx: this.x, sy: this.y, tx: best.x, ty: best.y,
      t: 0, dur: dur || C.JUMP_DUR,
      hh: 10 + Math.min(16, U.dist(this.x, this.y, best.x, best.y) * .12)
    };
  };

  /** 밀기 (바람/자동차/고양이) */
  Entity.prototype.push = function (ax, ay, power) {
    if (this.def && this.def.heavy) return;
    if (this.dragging) return;
    var d = Math.max(1, U.dist(this.x, this.y, ax, ay));
    this.vx += ((this.x - ax) / d) * power;
    this.vy += ((this.y - ay) / d) * power;
    this.heldBy = null;
  };

  /* ------------------------------------------------------------------
     매 프레임
     ------------------------------------------------------------------ */
  Entity.prototype.update = function (dt) {
    this.age += dt;

    if (this.chill > 0) this.chill -= dt;
    if (this.suppress > 0) this.suppress -= dt;

    /* 재화 지급 — 주기를 당기는 것은 payMul 뿐이다.
       speedMul 은 "하는 일" 을 재촉할 뿐 벌이 주기에는 손대지 않는다 */
    this.payTimer -= dt * this.haste();
    if (this.payTimer <= 0) {
      this.payTimer += C.PAY_PERIOD;
      var v = this.income();
      if (v > 0) {
        var paid = Math.max(1, Math.round(v));
        G.board.earn(paid);
        G.ui.floatMoney(this.x, this.y - this.h * .4, paid, this.type !== 'word');
      }
    }

    /* 점프 진행 */
    if (this.jump) {
      var j = this.jump;
      j.t += dt;
      var k = Math.min(1, j.t / j.dur);
      var e = U.easeInOut(k);
      this.x = U.lerp(j.sx, j.tx, e);
      this.y = U.lerp(j.sy, j.ty, e);
      this.hop = -Math.sin(Math.PI * k) * j.hh;
      if (k >= 1) {
        this.hop = 0;
        this.jump = null;
        this.land();
        if (this.onLand) this.onLand();
      }
    } else if (!this.dragging) {
      /* 관성 이동 */
      if (this.vx || this.vy) {
        var ox = this.x, oy = this.y;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        var damp = Math.pow(0.90, dt * 60);
        this.vx *= damp; this.vy *= damp;
        if (Math.abs(this.vx) < 1.5) this.vx = 0;
        if (Math.abs(this.vy) < 1.5) this.vy = 0;
        var p = G.board.clampPoint(this.x, this.y, this);
        if (p.x !== this.x) this.vx *= -.4;
        if (p.y !== this.y) this.vy *= -.4;
        this.x = p.x; this.y = p.y;
        /* 바람에 밀려 미끄러지다 벽을 만나면 거기서 멎는다 */
        if (G.board.blocked(ox, oy, this.x, this.y, this)) {
          this.x = ox; this.y = oy; this.vx = 0; this.vy = 0;
        }
      }

      /* 점프 타이머 */
      if (this.canJump()) {
        var rate = this.speedMul;
        if (this.chill > 0) rate *= 0.25;
        this.jumpTimer -= dt * rate;
        if (this.jumpTimer <= 0) {
          this.startJump();
          this.resetJumpTimer();
        }
      }
    }

    if (this.burning) this.burnTime += dt;
  };

  Entity.prototype.land = function () {
    var self = this;
    this.inner.classList.remove('land');
    void this.inner.offsetWidth;
    this.inner.classList.add('land');
    setTimeout(function () { if (self.inner) self.inner.classList.remove('land'); }, 360);
  };

  Entity.prototype.born = function () {
    var self = this;
    this.inner.classList.add('born');
    setTimeout(function () { if (self.inner) self.inner.classList.remove('born'); }, 460);
  };

  /* ------------------------------------------------------------------
     상태 변경
     ------------------------------------------------------------------ */
  Entity.prototype.ignite = function () {
    if (this.burning) return;
    this.burning = true;
    this.burnTime = 0;
    this.danger = 0;
    this.el.classList.add('burning');
    G.fx.burst(this.x, this.y, '235,120,45', 16, 100);
    G.ui.toast('<b>' + this.text + '</b> 에 불이 붙었다');
  };

  Entity.prototype.extinguish = function () {
    if (!this.burning) return;
    this.burning = false;
    this.burnTime = 0;
    this.el.classList.remove('burning');
    G.fx.splash(this.x, this.y);
    for (var i = 0; i < 10; i++) {
      G.fx.spark(this.x + U.rand(-this.w * .4, this.w * .4), this.y, {
        vx: U.rand(-10, 10), vy: U.rand(-30, -14), g: -8,
        r: U.rand(3, 6), life: U.rand(.8, 1.4), c: '170,170,170', a: .3
      });
    }
  };

  Entity.prototype.destroy = function () {
    var el = this.el;
    if (!el) return;
    el.classList.add('dying');
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 320);
    this.el = null; this.inner = null; this.body = null;
  };

  /** 저장용 직렬화 */
  Entity.prototype.toJSON = function () {
    return {
      id: this.id, type: this.type, text: this.text,
      x: Math.round(this.x), y: Math.round(this.y),
      burning: this.burning, burnTime: Math.round(this.burnTime),
      data: this.data, age: Math.round(this.age)
    };
  };

  G.Entity = Entity;
})();
