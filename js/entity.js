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
    this.speedMul = 1;
    this.hazardMul = 1;       // 위험(화재)이 쌓이는 속도. TIME 이 늦춘다
    this.suppress = 0;
    this.age = 0;
    this.data = {};

    this.buildDom();
    this.measure();
    this.resetJumpTimer();
    if (this.def && this.def.actEvery) {
      this.actTimer = U.rand(this.def.actEvery[0] * .4, this.def.actEvery[1]);
    }
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
  /** 한 번에 버는 양 */
  Entity.prototype.payValue = function () {
    if (this.burning) return 0;
    if (this.type === 'letter') return C.PAY_BASE;
    if (this.type === 'cluster') return C.PAY_BASE * this.text.length;
    return (this.def.value || 0);
  };

  /** 익어 가는 정도 (0~1). 이만큼 노릇해진다 */
  Entity.prototype.setCook = function (p) {
    p = Math.max(0, Math.min(1, p));
    var q = Math.round(p * 12) / 12;
    if (this.cookShown === q) return;
    this.cookShown = q;
    if (this.el) this.el.style.setProperty('--cook', q.toFixed(2));
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
      var score = G.board.crowdScore(p.x, p.y, this);
      if (!best || score < best.s) best = { x: p.x, y: p.y, s: score };
      if (score === 0) break;
    }
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

    /* 재화 지급 */
    this.payTimer -= dt * this.speedMul;
    if (this.payTimer <= 0) {
      this.payTimer += C.PAY_PERIOD;
      var v = this.payValue() * this.incomeMul;
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

    if (this.burning) this.burnTime += dt * this.hazardMul;
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
