/* ==========================================================================
   behaviors.js — 단어의 행동
   --------------------------------------------------------------------------
   FIELDS[단어]  : 매 프레임 지속되는 "장(場)" 효과 (끌어당김, 얼림, 가속…)
   ACTIONS[key]  : 20초마다 def.actChance 확률로 한 번씩 일어나는 사건
   BONDS[key]    : "가까이 + 일정 시간" 이 유지되어야 발동하는 상호작용

   단어는 자기 뜻대로 행동한다. FIRE 는 태우고 COAL 은 그 불을 지핀다.
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
   바닥에 떨어진 것들 (STAR 가 떨군 힌트권, SHOP 이 흘린 잔돈)
   --------------------------------------------------------------------------
   가만히 두면 사라진다. 방치형 게임이라 대부분은 저절로 굴러가지만,
   화면을 보고 있을 때만 얻는 것이 하나쯤은 있어야 켜 둘 이유가 생긴다.
   손이 늦는 것이 아깝다면 MOUSE 를 세워 두면 된다 — 종류를 가리지 않고 주워 온다.
   -------------------------------------------------------------------------- */
G.tokens = (function () {
  var list = [];
  var layer;

  /* 힌트권 — 길쭉한 직사각형 + 가운데 구멍, 살짝 기울어 둔다 */
  var ICON =
    '<svg viewBox="0 0 52 18" aria-hidden="true">' +
    '<rect class="tk-face" x="1" y="1.2" width="50" height="15.6" rx="2.8"/>' +
    '<circle class="tk-hole" cx="26" cy="9" r="4.2"/></svg>';

  /* 동전 — 테두리와 가운데 홈 */
  var COIN =
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<circle class="tk-face" cx="12" cy="12" r="10"/>' +
    '<circle class="tk-perf" cx="12" cy="12" r="5.6"/></svg>';

  function init() { layer = document.getElementById('layer'); }

  function drop(kind, cls, html, x, y, life, value) {
    var el = document.createElement('div');
    el.className = 'token ' + cls;
    el.innerHTML = html;
    var hw = cls === 'ticket' ? 18 : 17;
    var hh = cls === 'ticket' ? 14 : 17;
    el.style.left = (x - hw) + 'px';
    el.style.top = (y - hh) + 'px';
    if (layer) layer.appendChild(el);
    var t = { el: el, x: x, y: y, life: 0, max: life, kind: kind, value: value || 0 };
    el.addEventListener('pointerdown', function (ev) {
      ev.stopPropagation();
      take(t);
    });
    list.push(t);
    return t;
  }

  /** 힌트권 한 장을 바닥에 떨군다 */
  function spawnTicket(x, y) {
    return drop('ticket', 'ticket', ICON, x, y, G.C.TICKET_DROP_LIFE);
  }

  /** 잔돈 한 닢을 바닥에 흘린다 */
  function spawnCoin(x, y, value) {
    return drop('coin', 'coin', COIN, x, y, G.C.COIN_DROP_LIFE, Math.max(1, Math.round(value)));
  }

  /** 이 자리에서 가장 가까운 것 (MOUSE 가 주우러 간다) */
  function nearestToken(x, y) {
    var best = null, bd = Infinity;
    for (var i = 0; i < list.length; i++) {
      var t = list[i];
      if (t.dead) continue;
      var d = G.util.dist(x, y, t.x, t.y);
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }

  function take(t) {
    if (t.dead) return;
    t.dead = true;
    if (t.kind === 'coin') {
      G.board.earn(t.value);
      G.ui.floatMoney(t.x, t.y - 10, t.value);
      G.fx.burst(t.x, t.y, '210,180,110', 14, 74);
    } else {
      G.state.tickets = (G.state.tickets || 0) + 1;
      G.fx.burst(t.x, t.y, '215,195,120', 14, 74);
      G.ui.toast('힌트권을 주웠다');
      if (G.ui.renderCodex) G.ui.renderCodex();
    }
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
      /* 사라지기 전 몇 초는 깜빡여서 재촉한다 */
      if (t.life > t.max - 5) {
        t.el.style.opacity = String(0.3 + 0.7 * Math.abs(Math.sin(t.life * 6)));
      }
    }
  }

  function clearAll() {
    for (var i = list.length - 1; i >= 0; i--) kill(list[i]);
  }

  return {
    init: init, spawnTicket: spawnTicket, spawnCoin: spawnCoin,
    step: step, clearAll: clearAll,
    nearest: nearestToken, take: take,
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

  /**
   * 같은 단어에서 오는 효과는 이번 프레임에 한 번만 받는다.
   *
   * 해를 넷 세워 두면 한 단어의 벌이 주기가 네 번 당겨졌었다. 그러면 보드를
   * 꾸리는 일이 "좋은 단어 한 종류를 몇 개까지 욱여넣느냐" 로 납작해진다.
   * 지금은 SUN 이 몇이든 그 자리에서 받는 것은 한 번뿐이라, 두 번째 해는
   * 다른 자리에 세워야 값을 한다 — 종류를 늘리는 쪽이 언제나 낫다.
   *
   * @param tag 효과를 거는 단어 (SUN · MOON · COAL …)
   * @return 이번 프레임에 처음이면 true
   */
  function once(o, tag) {
    var k = '_only' + tag;
    if (o[k] === frameNo) return false;
    o[k] = frameNo;
    return true;
  }

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

  /**
   * 일감을 만난 것은 그 자리에 눌러앉는다.
   *
   * 단어들이 저 혼자 통통 뛰어다니는 것은 보드를 살아 있게 하는 재미지만,
   * 짝을 만나 무언가 하고 있는 중에도 뛰면 그건 그냥 방해다. 나무 곁에 붙인
   * 벌이 자꾸 튀어 달아나 꿀을 못 따고, 굽던 고기가 불에서 내려오고,
   * 가게에 올려 둔 보석이 팔리기 직전에 미끄러져 내렸다.
   * 그래서 짝을 찾은 쪽은 물론 짝이 되어 준 쪽까지 함께 멈춰 세운다.
   */
  function settle(e) {
    if (!e) return;
    e.calm = true;
    e.jump = null;
  }

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
   * 예전에는 여기서 글자를 바꿔치웠다 (고기를 구우면 다른 단어가 되는 식).
   * 그런데 그 결과물도 플레이어가 직접 철자해서 만들 수 있는 단어라, 같은 단어를
   * 얻는 길이 둘이 되어 버렸다. 게다가 애써 만든 것이 제멋대로 사라졌다.
   * 그래서 이제 글자는 절대 바뀌지 않는다 — 빛깔이 변하고 벌이가 오를 뿐이다.
   *
   * 한번 익은 것은 짝을 치워도 되돌아가지 않는다. 익히는 데 든 시간을 빼앗지 않는다.
   *
   * @param secs 다 익는 데 걸리는 시간
   * @param mul  다 익었을 때의 벌이 배수
   * @param tint 'green' 이면 푸르게, 그 밖에는 노릇하게
   * @return 익은 정도 0~1
   */
  function ripen(e, dt, partner, secs, mul, tint) {
    var p = e.data.ripe || 0;
    if (partner && p < 1) p = Math.min(1, p + dt * e.speedMul / secs);
    e.data.ripe = p;
    e.setRipe(p, tint);
    if (p > 0) e.incomeMul *= 1 + (mul - 1) * p;
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
    var over = Math.max(0, (e.data.over || 0) + (fire ? dt : -dt * 0.6));
    e.data.over = over;
    var p = Math.min(1, over / C.OVERCOOK_BURN);
    if (fire && Math.random() < dt * (3 + p * p * 46)) {
      G.fx.spark(e.x + U.rand(-e.w * .35, e.w * .35), e.y - e.h * .3, {
        vx: U.rand(-7, 7), vy: U.rand(-34, -18) - p * 14, g: -10,
        r: U.rand(2.4, 4.4 + p * 3), life: U.rand(.9, 1.5),
        c: p > .5 ? '86,80,76' : '150,142,136', a: .18 + p * .3, drag: .98
      });
    }
    if (over >= C.OVERCOOK_BURN) { e.data.over = 0; e.ignite(); }
  }

  var GEMS = ['GOLD', 'RUBY', 'DIAMOND', 'EMERALD'];

  /**
   * 보석의 공통 성질 — 반짝이는 것뿐이다.
   * 값은 철자 수로 정해진다. 만들자마자 값이 제멋대로 갈리면 잘 나올 때까지
   * 다시 만들게 되므로, 값이 달라지는 것은 플레이어가 HAMMER 로 두드렸을 때뿐이다.
   * 다시 매긴 값은 더블클릭 팝오버의 벌이 줄에 적힌다.
   */
  function gem(e, dt) {
    /* 가게에 올려 두었으면 미끄러져 내리지 않는다 */
    if (nearest(e, 96, isWord('SHOP'))) settle(e);
    if (Math.random() < dt * 1.2) {
      G.fx.spark(e.x + U.rand(-e.w * .4, e.w * .4), e.y + U.rand(-e.h * .3, e.h * .3), {
        vx: U.rand(-6, 6), vy: U.rand(-14, -4), g: -3,
        r: U.rand(1, 1.9), life: U.rand(.5, 1),
        c: '235,225,190', a: .8, shape: 'star'
      });
    }
  }

  /**
   * 망치로 보석을 한 번 내리친다.
   * 깎일 수도 곱절이 될 수도 있고, 한 보석에 한 번뿐이다.
   * @return 매긴 값. 못 치면 0
   */
  function strikeGem(hammer, g) {
    if (!g || !G.board.get(g.id) || g.data.worth || g.afflicted()) return 0;
    if (GEMS.indexOf(g.text) < 0) return 0;
    if (!G.board.spend(C.HAMMER_COST)) {
      G.ui.toast('망치를 쓰려면 <b>' + U.money(C.HAMMER_COST) + '</b> 이 필요하다');
      return 0;
    }
    var steps = Math.round((C.HAMMER_MAX - C.HAMMER_MIN) / C.HAMMER_STEP);
    var w = C.HAMMER_MIN + C.HAMMER_STEP * Math.floor(Math.random() * (steps + 1));
    g.data.worth = w;
    G.fx.burst(g.x, g.y, w >= 1 ? '230,215,150' : '150,140,130', 22, 108);
    G.fx.ring(g.x, g.y, { r0: 4, r1: 84, life: .6, c: '170,150,120', lw: 2 });
    if (hammer) G.fx.linkDots(hammer.x, hammer.y, g.x, g.y, 1, 0.05);
    G.ui.toast('<b>' + g.text + '</b> 를 내리쳤다 · 값 ' + U.pct(w) +
      ' · −' + U.money(C.HAMMER_COST));
    return w;
  }

  function isGem(o) {
    return o.type === 'word' && GEMS.indexOf(o.text) >= 0;
  }

  /** 아직 두드리지 않은 보석인가 */
  function hammerable(o) {
    return isGem(o) && !o.data.worth && !o.afflicted() && !o.burning;
  }

  /** 가게에 넘길 수 있는 보석인가 */
  function sellableGem(o) {
    return isGem(o) && !o.afflicted() && !o.burning;
  }

  /**
   * 보석을 가게에 판다.
   * @return 받은 액수. 못 팔면 0
   */
  function sellGem(shop, g) {
    if (!g || !G.board.get(g.id) || !sellableGem(g)) return 0;
    var v = Math.round(C.GEM_PRICE * g.text.length * (g.data.worth || 1));
    var gx = g.x, gy = g.y, name = g.text;
    var sx = shop ? shop.x : gx, sy = shop ? shop.y : gy;
    G.board.remove(g);
    G.board.earn(v);
    G.ui.floatMoney(gx, gy - 28, v);
    G.fx.coins(sx, sy, 22);
    G.fx.burst(gx, gy, '190,170,120', 22, 116);
    if (shop) G.fx.ring(sx, sy, { r0: 6, r1: 92, life: .7, c: '180,110,175', lw: 1.5 });
    G.ui.toast('<b>' + name + '</b> 를 팔았다 · +' + U.num(v));
    return v;
  }

  /** 물로 치는 것들 — SEED 가 싹트고 FISH 가 헤엄치는 자리 */
  var WET = ['WATER', 'ICE'];

  /* ==================================================================
     끌어다 대고 있으면 되는 장치 — BOX 와 FORGE

     단어를 만드는 길(끌어다 붙이기)과 일부러 다르게 두었다. 이쪽은 붙는 것이
     아니라 "집어넣는" 것이라, 잠깐 대고 있어야 하고 결과를 되돌릴 수 없다.
     실제로 손을 대는 곳은 drag.js 이고, 여기에는 규칙만 둔다.
     ================================================================== */

  /** 지금 상자에 넣을 수 있는 최대 낱글자 수 (CAT 곁이면 늘어난다) */
  function boxSlots(box) {
    var n = C.BOX_SLOTS;
    if (box && (box.data.catT || 0) > 0) n += C.CAT_BOX_SLOTS;
    return n;
  }

  /** 상자에 남은 자리 */
  function boxRoom(box) {
    return boxSlots(box) - (box.data.kept || '').length;
  }

  /** 낱글자를 상자에 넣는다. 보드에서는 빠지므로 정원이 한 칸 빈다 */
  function putInBox(box, letter) {
    if (boxRoom(box) <= 0) return false;
    box.data.kept = (box.data.kept || '') + letter.text;
    var lx = letter.x, ly = letter.y;
    G.board.remove(letter);
    G.fx.line(lx, ly, box.x, box.y, { life: .4, c: '190,160,110', lw: 2 });
    G.fx.burst(box.x, box.y - 6, '190,160,110', 10, 54);
    G.fx.ring(box.x, box.y, { r0: 4, r1: 44, life: .4, c: '190,160,110', lw: 1.2 });
    return true;
  }

  /** 지금 걸려 있는 강화 단계 */
  function upLevel(e) { return (e.data && e.data.up) || 0; }

  /**
   * 강화를 걸 수 있는가.
   * 능력 단어는 뺀다 — 능력이 곧 그 단어의 값이라 벌이 배수를 얹을 자리가 아니고,
   * 애써 찾아낸 능력 단어가 도박 한 번에 사라지면 도감이 무너진다.
   */
  function upgradable(e) {
    return !!e && e.type === 'word' && !G.WORD_BY_ID[e.text] &&
      !e.afflicted() && upLevel(e) < C.UP_ODDS.length;
  }

  /**
   * 강화 한 번. 성공하면 별이 하나 늘고 벌이 배수가 영구히 바뀐다.
   * 실패하면 단어가 글자째 사라진다 — 흩어지지도 않는다.
   * @return {boolean} 성공했는가
   */
  function runUpgrade(pad, target) {
    var lv = upLevel(target);
    var ok = Math.random() < C.UP_ODDS[lv];
    var tx = target.x, ty = target.y, name = target.text;

    G.fx.line(pad.x, pad.y, tx, ty, { life: .6, c: '175,140,215', lw: 2.5 });

    if (!ok) {
      G.board.remove(target);
      G.fx.burst(tx, ty, '150,70,70', 26, 130);
      G.fx.ring(tx, ty, { r0: 6, r1: 96, life: .7, c: '170,80,80', lw: 2 });
      G.ui.toast('<b>' + name + '</b> 강화 실패 — 글자째 사라졌다');
      return false;
    }

    target.data.up = lv + 1;
    target.setStars(lv + 1);
    G.fx.burst(tx, ty, '190,160,235', 22, 112);
    G.fx.ring(tx, ty, { r0: 6, r1: 90, life: .7, c: '175,140,215', lw: 2 });
    for (var i = 0; i < 12; i++) {
      G.fx.spark(tx + U.rand(-20, 20), ty, {
        vx: U.rand(-20, 20), vy: U.rand(-60, -24), g: 30,
        r: U.rand(1.4, 2.6), life: 1, c: '215,190,250', a: .9, shape: 'star'
      });
    }
    G.ui.toast('<b>' + name + '</b> ' + (lv + 1) + '강 성공 · 벌이 ' + U.pct(C.UP_MUL[lv]));
    return true;
  }

  /** 같은 글자 둘을 합친 덩어리인가 (AA · BB …) */
  function twinLetters(e) {
    if (!e || e.afflicted() || e.burning) return false;
    if (e.type !== 'cluster' && e.type !== 'word') return false;
    if (e.type === 'word' && G.WORD_BY_ID[e.text]) return false; // 능력 단어는 안 됨
    var t = e.text;
    return t.length === 2 && t.charAt(0) === t.charAt(1) &&
      t.charAt(0) >= 'A' && t.charAt(0) <= 'Z';
  }

  /** CRAFT 에 넣을 수 있는가 — 같은 글자 둘(AA)을 합친 것만 */
  function craftable(e) {
    return twinLetters(e);
  }

  /** 넣은 글자를 뺀 알파벳에서 서로 다른 둘을 고른다 */
  function pickCraftLetters(exclude) {
    var pool = [], i, a, b, ch;
    for (i = 0; i < 26; i++) {
      ch = String.fromCharCode(65 + i);
      if (ch !== exclude) pool.push(ch);
    }
    a = U.pick(pool);
    b = U.pick(pool);
    while (b === a) b = U.pick(pool);
    return [a, b];
  }

  /**
   * CRAFT 에 같은 글자 둘(AA)을 한 번에 넣는다.
   * 넣은 글자를 제외한 랜덤 글자 둘로 바뀐다.
   */
  function putInCraft(craft, chunk) {
    if (!craftable(chunk) || !G.board.get(chunk.id)) return false;
    var name = chunk.text;
    var exclude = name.charAt(0);
    var wx = chunk.x, wy = chunk.y;
    G.board.remove(chunk);
    var pair = pickCraftLetters(exclude);
    var o1 = G.board.spawnLetter(pair[0], craft.x - 28, craft.y - 36);
    var o2 = G.board.spawnLetter(pair[1], craft.x + 28, craft.y - 36);
    G.fx.line(wx, wy, craft.x, craft.y, { life: .4, c: '180,140,90', lw: 2 });
    G.fx.burst(craft.x, craft.y, '200,160,100', 28, 120);
    G.fx.ring(craft.x, craft.y, { r0: 6, r1: 100, life: .7, c: '180,140,90', lw: 2 });
    G.ui.toast('<b>' + name + '</b> → <b>' + pair[0] + '</b> · <b>' + pair[1] + '</b>');
    return 'done';
  }

  /* ==================================================================
     FIELDS — 매 프레임 지속 효과
     ================================================================== */
  var FIELDS = {

    /* ---------- 하늘 ---------- */

    /**
     * 해 — 곁의 벌이 "주기" 를 당긴다.
     * 액수는 건드리지 않는다. 그쪽은 MOON 몫이다.
     */
    SUN: function (e, dt) {
      var n = near(e, 150, function (o) { return o.type === 'word' && o !== e; });
      for (var i = 0; i < n.length; i++) {
        if (once(n[i], 'SUN')) n[i].payMul *= C.SUN_HASTE;
      }
      if (Math.random() < dt * 1.2) {
        G.fx.spark(e.x + U.rand(-e.w * .5, e.w * .5), e.y + U.rand(-8, 8), {
          vx: U.rand(-10, 10), vy: U.rand(-16, -6), r: 1.3, life: .8,
          c: '230,190,110', a: .5
        });
      }
    },

    /**
     * 달 — 곁의 벌이 "액수" 를 올린다.
     * 주기는 건드리지 않는다. 그쪽은 SUN 몫이다.
     */
    MOON: function (e, dt) {
      var n = near(e, 150, function (o) { return o.type === 'word' && o !== e; });
      for (var i = 0; i < n.length; i++) {
        if (once(n[i], 'MOON')) n[i].incomeMul *= C.MOON_INCOME;
      }
      if (Math.random() < dt * .5) {
        G.fx.spark(e.x + U.rand(-e.w * .5, e.w * .5), e.y + U.rand(-10, 10), {
          vx: 0, vy: -7, r: 1.4, life: 1.1, c: '160,165,205', a: .45
        });
      }
    },

    /* ---------- 물 ---------- */

    /* 물 — 곁에서 타는 것을 꺼 준다. 이 게임에서 불을 끄는 것은 이 단어뿐이다 */
    WATER: function (e, dt) {
      var b = near(e, 132, isBurning);
      if (b.length) settle(e);               // 불을 끄는 중에는 물이 튀어 달아나지 않는다
      for (var i = 0; i < b.length; i++) {
        var t = acc(b[i], 'wet', dt);
        G.fx.spark(b[i].x + U.rand(-10, 10), b[i].y - 6, {
          vx: 0, vy: -10, r: 1.4, life: .5, c: '150,190,220', a: .5
        });
        if (t > 4.5) b[i].extinguish();
      }
    },

    /* 얼음 — 주변을 얼려 그 자리에 세워 둔다 */
    ICE: function (e, dt) {
      var n = near(e, 150, function (o) { return o !== e; });
      for (var i = 0; i < n.length; i++) n[i].chill = 0.7;
      if (n.length && Math.random() < dt * 2) {
        G.fx.spark(e.x + U.rand(-e.w * .5, e.w * .5), e.y + U.rand(-10, 10), {
          vx: U.rand(-8, 8), vy: U.rand(-8, 4), r: 1.2, life: .7,
          c: '170,215,235', a: .5
        });
      }
    },

    /* ---------- 불과 땅 ---------- */

    /* 불 — 잘 타는 것에 옮아붙는다 (불이 옮는 일 자체는 ignite 결속이 맡는다) */
    FIRE: function (e, dt) {
      if (Math.random() < dt * 2 * (e.stoke || 1)) {
        G.fx.spark(e.x + U.rand(-e.w * .4, e.w * .4), e.y - 8, {
          vx: U.rand(-6, 6), vy: U.rand(-34, -18), r: U.rand(1.2, 2.2),
          life: .8, c: '235,140,60', a: .7
        });
      }
    },

    /**
     * 숯 — 곁의 불을 거세게 지핀다.
     * 그 한 쌍은 둘 다 크게 벌고 굽는 것도 빨라지지만, 숯은 제 몸을 태우는 것이라
     * 15분이면 재만 남는다. 보드에서 가장 잘 버는 자리를 유지하려면 계속 다시
     * 만들어 넣어야 한다 — 가만히 두면 저절로 굴러가는 벌이가 아니다.
     *
     * 숯이 여럿이어도 불 하나가 세 배를 넘게 벌지는 않는다 (once).
     */
    COAL: function (e, dt) {
      var f = near(e, 120, isWord('FIRE'));
      if (!f.length) return;

      settle(e);                             // 불을 문 숯도, 그 불도 자리를 지킨다
      for (var i = 0; i < f.length; i++) {
        f[i].data.stokeT = .4;
        f[i].stoke = C.COAL_STOKE;
        settle(f[i]);
        if (once(f[i], 'COAL')) f[i].incomeMul *= C.COAL_PAIR;
      }
      if (once(e, 'COAL')) e.incomeMul *= C.COAL_PAIR;

      /* 다 타 가는 숯. 남은 시간을 분으로 세어 머리 위에 달아 두었더니, 좋은 자리
         하나가 시한폭탄처럼 읽혔다 — 15분 내내 숫자가 줄어드는 것을 보고 있으면
         저 자리는 곧 없어질 자리로만 보인다. 지금은 고기가 익는 것과 같은 방식으로,
         숯이 하얗게 바래 가는 것으로만 알린다 */
      e.data.spent = (e.data.spent || 0) + dt;
      var left = C.COAL_LIFE - e.data.spent;
      e.setRipe(e.data.spent / C.COAL_LIFE, 'ash');
      if (left <= 0) {
        G.ui.toast('<b>COAL</b> 이 다 타서 재가 되었다');
        G.fx.burst(e.x, e.y, '90,84,80', 24, 120);
        G.board.remove(e);
        return;
      }

      if (Math.random() < dt * 2) {
        G.fx.spark(e.x + U.rand(-e.w * .4, e.w * .4), e.y - 6, {
          vx: U.rand(-8, 8), vy: U.rand(-24, -10), r: U.rand(1.4, 2.4),
          life: .7, c: '235,120,50', a: .55
        });
      }
    },

    /* ---------- 풀 ---------- */

    /* 씨앗 — 물이 있어야 싹이 튼다. 튼 싹은 그대로 남는다 */
    SEED: function (e, dt) {
      if (e.burning) return;
      var wet = nearest(e, 150, isAnyWord(WET));
      if (wet) settle(wet);                  // 물을 대는 동안에는 물도 자리를 지킨다
      var p = ripen(e, dt, wet, C.GROW_TIME, C.RIPE_SEED, 'green');
      if (wet && p < 1 && Math.random() < dt * .5) {
        G.fx.spark(e.x + U.rand(-8, 8), e.y - 4, {
          vx: 0, vy: -10, r: 1.3, life: .7, c: '120,175,110', a: .5
        });
      }
    },

    /**
     * 벌 — 나무를 찾으면 그 곁에 눌러앉는다.
     * 꿀을 터는 것은 ACTIONS.bee 가 20초마다 굴리는 주사위인데, 그때 나무가
     * 곁에 없으면 허탕이다. 벌은 제 몸이 가벼워 자주 튀는 편이라
     * 애써 나무에 붙여 놓아도 다음 주사위 때에는 저만치 가 있기 일쑤였다.
     * 나무를 찾은 벌은 이제 그 자리에 머문다 — 붙어 있어야 꿀을 딴다.
     */
    BEE: function (e, dt) {
      var t = nearest(e, 132, isWord('TREE'));
      if (!t) return;
      /* 끌어당기지는 않는다. 둘 다 가벼워서, 당기는 힘과 밀어내는 힘이
         맞물리면 붙어 있는 채로 보드 저편까지 슬금슬금 걸어가 버린다 */
      settle(e); settle(t);
      if (Math.random() < dt * 1.1) {
        G.fx.spark(e.x + U.rand(-9, 9), e.y - 6, {
          vx: U.rand(-6, 6), vy: -8, r: 1.1, life: .6, c: '215,190,90', a: .5
        });
      }
    },

    /* ---------- 살림 ---------- */

    /**
     * 열쇠 — 상자에 직접 올려 열 때까지는 그냥 있다.
     * (여는 손은 drag.js)
     */
    KEY: function (e, dt) { },

    /**
     * 상자 — 플레이어가 직접 넣은 글자만 들어 있다.
     * 저절로 빨아들이던 때에는 쓸 만한 글자까지 상자가 먼저 채 가서,
     * 상자를 세워 두면 오히려 단어를 못 만들었다.
     * 넣은 글자는 보드에서 빠지므로 정원이 한 칸씩 도로 생긴다.
     * 쌓인 값은 상자 안에 잠겨 있다 — 꺼내는 것은 KEY 몫이다.
     */
    BOX: function (e, dt) {
      var n = (e.data.kept || '').length;
      if (n > 0) {
        var per = C.BOX_PER_LETTER / C.PAY_PERIOD;      // 낱글자 하나가 1초에 쌓는 값
        e.data.stored = (e.data.stored || 0) + n * per * dt * (e.boxMul || 1);
      }
      /* 쌓인 값은 더블클릭 팝오버에서 본다 — 머리 위 쪽지는 쓰지 않는다 */
      e.setBadge('');
    },

    /**
     * 자석 — 손에 쥐고 있을 때만 힘을 낸다.
     * 내려놓고도 계속 빨아들이면 보드가 저절로 정리되어 손댈 일이 없어진다.
     * 끌고 다니며 쓸어 담는 도구라야 자석을 만든 보람이 있다.
     * 딸려 오는 것은 모음뿐이다 — 정작 모자란 것은 늘 모음이다.
     */
    MAGNET: function (e, dt) {
      if (!e.dragging) return;
      var n = near(e, 178, function (o) {
        return o.type === 'letter' && G.VOWELS.indexOf(o.text) >= 0;
      });
      for (var i = 0; i < n.length; i++) {
        n[i].heldBy = null;
        n[i].jump = null;
        pull(e, n[i], 220, dt, 34);
      }
      if (Math.random() < dt * 8) {
        var a = Math.random() * 6.2832;
        G.fx.spark(e.x + Math.cos(a) * 90, e.y + Math.sin(a) * 70, {
          vx: -Math.cos(a) * 70, vy: -Math.sin(a) * 55, r: 1.3, life: .5,
          c: '200,110,130', a: .55, drag: .96
        });
      }
    },

    /**
     * 톱니바퀴: 혼자 두어도 네 글자 단어만큼은 번다.
     * 다른 톱니와 맞물리면 하나마다 제 벌이가 곱절로 뛰니 여럿을 짜 놓을수록
     * 급하게 커지지만, 물릴 수 있는 자리가 셋뿐이고 하나하나가 보드 한 칸이다.
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

    /**
     * 망치 — 스스로는 두드리지 않는다.
     * 플레이어가 망치를 보석 위로 끌어다 1초 대고 있어야 값이 다시 매겨진다
     * (drag.js). 보석을 망치 위에 올려 두는 것만으로는 안 된다.
     */
    HAMMER: function (e, dt) {
      if (Math.random() < dt * 1.2) {
        G.fx.spark(e.x + U.rand(-e.w * .4, e.w * .4), e.y + U.rand(-e.h * .25, e.h * .1), {
          vx: U.rand(-8, 8), vy: U.rand(-12, -4), r: U.rand(1, 1.6), life: .7,
          c: '170,160,150', a: .45
        });
      }
    },

    /**
     * 강화대 — 스스로는 아무 일도 하지 않는다.
     * 보통 단어를 끌어다 대고 있어야 굴러가는 물건이라, 하는 일은 전부
     * drag.js 쪽에 있다 (device / runUpgrade). 여기서는 켜져 있다는 표시만 한다.
     */
    FORGE: function (e, dt) {
      if (Math.random() < dt * 1.6) {
        G.fx.spark(e.x + U.rand(-e.w * .45, e.w * .45), e.y + U.rand(-e.h * .3, e.h * .3), {
          vx: 0, vy: U.rand(-18, -8), r: U.rand(1, 1.8), life: .8,
          c: '175,140,215', a: .55, shape: 'star'
        });
      }
    },

    /**
     * 제작대 — 같은 글자 둘(AA)을 넣어 다른 글자 둘로 바꾼다.
     * 넣는 손은 drag.js.
     */
    CRAFT: function (e, dt) {
      if (Math.random() < dt * 1.2) {
        G.fx.spark(e.x + U.rand(-e.w * .4, e.w * .4), e.y + U.rand(-e.h * .2, e.h * .2), {
          vx: U.rand(-6, 6), vy: U.rand(-14, -4), r: U.rand(1, 1.7), life: .7,
          c: '200,160,100', a: .45
        });
      }
    },

    /* ---------- 짐승 ---------- */

    /**
     * 고양이 — 상자를 보면 기어이 들어앉는다.
     * 눌러앉은 상자는 값을 훨씬 빨리 쌓고, 넣을 수 있는 글자도 둘 늘어난다.
     * 쌓인 값을 꺼내려면 여전히 KEY 가 있어야 하니, 상자 한 벌(BOX·CAT·KEY)은
     * 자리를 세 칸 내주고 굴리는 살림이다.
     */
    CAT: function (e, dt) {
      var b = nearest(e, 112, isWord('BOX'));
      if (!b) return;
      /* 고양이 둘이 한 상자에 앉아도 속도·칸이 두 배로 늘지는 않는다 */
      b.data.catT = .4;
      b.boxMul = C.CAT_BOX;
      settle(e);                           // 자리를 잡았으면 더 뛰지 않는다
      pull(b, e, 90, dt, 30);
      if (Math.random() < dt * 1.4) {
        G.fx.spark(e.x + U.rand(-10, 10), e.y - 8, {
          vx: 0, vy: -9, r: 1.3, life: .9, c: '190,175,150', a: .4
        });
      }
    },

    /**
     * 생쥐 — 바닥에 떨어진 것을 그냥 지나치지 못한다.
     * STAR 가 떨군 힌트권도, SHOP 이 흘린 잔돈도 가리지 않는다.
     * 떨어진 것들은 몇 초 안에 눌러야 하는데, 그걸 대신 주워 온다.
     * 훔쳐 가기만 하던 때에는 만들 이유가 없어서 보이는 족족 부수는 단어였다.
     */
    MOUSE: function (e, dt) {
      var t = G.tokens.nearest(e.x, e.y);
      if (!t) return;
      settle(e);
      var d = Math.max(1, U.dist(e.x, e.y, t.x, t.y));
      if (d < 30) {
        G.tokens.take(t);
        G.fx.spark(e.x, e.y - 10, { vx: 0, vy: -20, r: 2, life: .6, c: '190,180,160', a: .7 });
        return;
      }
      e.vx += ((t.x - e.x) / d) * 320 * dt;
      e.vy += ((t.y - e.y) / d) * 320 * dt;
    },

    /* 물고기 — 물이 없으면 파닥거리기만 하고 한 푼도 벌지 못한다 */
    FISH: function (e, dt) {
      var w = nearest(e, 138, isAnyWord(WET));
      if (!w) { e.incomeMul = 0; return; }
      settle(e); settle(w);
      e.incomeMul *= C.FISH_INCOME;
      if (Math.random() < dt * 1.2) {
        G.fx.spark(e.x + U.rand(-14, 14), e.y - 8, {
          vx: 0, vy: -12, r: 1.3, life: .6, c: '80,170,180', a: .5
        });
      }
    },

    /* ---------- 먹을 것 ---------- */

    /**
     * 고기: 불 곁에 두면 노릇하게 익는다.
     * 고기는 끝까지 MEAT 다 — 빛깔이 변하고 벌이가 오를 뿐이다.
     * 다 익은 뒤에도 불 위에 두면 타 버린다. 익거나 타거나, 그 둘뿐이다.
     */
    MEAT: function (e, dt) {
      if (e.burning) return;

      var f = nearest(e, 100, isWord('FIRE'));
      /* 굽는 동안에는 고기도 불도 자리를 뜨지 않는다 — 아니면 익다 말다 한다 */
      if (f) { settle(e); settle(f); }
      /* 숯을 물린 불은 더 빨리 굽는다 — 그만큼 태우기도 쉽다 */
      var p = ripen(e, dt * (f ? f.stoke || 1 : 1), f, C.COOK_TIME, C.RIPE_MEAT);
      if (p > 0 && Math.random() < dt * (2 + p * 8)) {
        G.fx.spark(e.x + U.rand(-e.w * .3, e.w * .3), e.y - e.h * .25, {
          vx: U.rand(-5, 5), vy: U.rand(-24, -12), g: -8,
          r: U.rand(1.6, 3), life: U.rand(.6, 1.1), c: '200,175,145', a: .28, drag: .97
        });
      }
      if (p >= 1) overcook(e, dt, f);
    },

    /* ---------- 보석 ---------- */

    GOLD: function (e, dt) { gem(e, dt); },

    RUBY: function (e, dt) { gem(e, dt); },

    DIAMOND: function (e, dt) { gem(e, dt); },

    EMERALD: function (e, dt) { gem(e, dt); },

    /** 가게: 보석을 사들인다. 겹쳐 1초 대고 있으면 그 자리에서 목돈이 된다 */
    SHOP: function (e, dt) {
      if (e.burning) return;

      var g = nearest(e, 96, function (o) {
        return o.type === 'word' && o !== e && GEMS.indexOf(o.text) >= 0 && !o.afflicted();
      });
      if (!g || g.dragging) { e.data.hold = 0; return; }

      settle(e); settle(g);                  // 값을 치는 동안에는 둘 다 멈춘다
      e.data.hold = (e.data.hold || 0) + dt;
      var p = e.data.hold / C.GEM_HOLD;
      G.fx.linkDots(e.x, e.y, g.x, g.y, Math.min(1, p), dt);
      if (p < 1) return;

      e.data.hold = 0;
      sellGem(e, g);
    },

    /**
     * 유령 — 보는 눈이 있으면 나오지 않는다.
     * 그래서 화면에서는 아무 일도 하지 않는다. 하는 일은 save.js 의 offlineGain
     * 에 있다 — 자리를 비운 동안의 몫을 한 마리마다 늘려 준다.
     * 이 게임에서 유일하게 "보지 않을 때" 값을 하는 단어다.
     */
    GHOST: function (e, dt) {
      if (Math.random() < dt * 1.1) {
        G.fx.spark(e.x + U.rand(-e.w * .4, e.w * .4), e.y - 6, {
          vx: 0, vy: -14, r: 1.8, life: .9, c: '160,160,200', a: .45
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

    /* 나무가 글자를 떨어뜨린다 */
    tree: function (e) {
      if (e.burning) return;
      if (G.board.count() >= G.maxEntities()) return;
      var L = G.board.spawnLetter(null, e.x + U.rand(-56, 56), e.y + U.rand(34, 64));
      L.vy = 30;
      G.fx.spark(e.x, e.y + 10, { vx: 0, vy: 20, r: 2.2, life: .6, c: '90,165,105', a: .8, shape: 'leaf' });
    },

    /* 개가 땅을 파서 무언가를 찾아낸다 — 거의 돈이고, 어쩌다 새 글자다 */
    dog: function (e) {
      e.startJump(90);
      if (U.chance(C.DOG_LETTER) && G.board.count() < G.maxEntities()) {
        var L = G.board.spawnLetter(null, e.x + U.rand(-46, 46), e.y + U.rand(24, 54));
        L.vy = 26;
      } else {
        var v = reward(C.EVENT_CUT, C.EVENT_FLAT);
        G.board.earn(v);
        G.ui.floatMoney(e.x, e.y - 18, v);
      }
      G.fx.burst(e.x, e.y + 14, '150,120,80', 12, 66);
    },

    /* 새가 멀리 날아갔다 낱글자를 하나 물고 돌아온다 */
    bird: function (e) {
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

    /* 운 — 곁의 단어 하나에 행운을 씌운다. 그 단어는 한동안 미친 듯이 번다 */
    luck: function (e) {
      var w = nearest(e, 210, function (o) { return o.type === 'word' && o !== e; });
      if (!w) return;
      w.data.lucky = C.LUCKY_TIME;
      G.fx.burst(w.x, w.y, '110,200,160', 14, 78);
      G.fx.ring(e.x, e.y, { r0: 4, r1: 60, life: .5, c: '110,200,160', lw: 1 });
      G.ui.toast('<b>' + w.text + '</b> 에 행운이 깃들었다');
    },

    /**
     * 별이 힌트권을 떨군다.
     * 돈으로 주면 그냥 벌이가 하나 더 늘 뿐이지만, 힌트권으로 주면
     * 도감을 여는 속도가 빨라진다 — 별이 관여하는 곳이 다른 데가 된다.
     * 오래 두면 사라지니, 보고 있을 때만 챙길 수 있는 몫이다.
     */
    star: function (e) {
      if (G.tokens.count() > 3) return;
      var a = Math.random() * 6.2832, d = U.rand(52, 96);
      var p = G.board.clampPoint(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, { w: 40, h: 40 });
      G.tokens.spawnTicket(p.x, p.y);
      G.fx.ring(e.x, e.y, { r0: 6, r1: 90, life: .9, c: '225,205,120', lw: 1.4 });
      for (var i = 0; i < 10; i++) {
        G.fx.spark(e.x, e.y, {
          vx: U.rand(-40, 40), vy: U.rand(-50, -10), r: U.rand(1.4, 2.6),
          life: 1, c: '235,215,130', a: .8, shape: 'star'
        });
      }
      G.ui.toast('힌트권이 떨어졌다 — 사라지기 전에 줍자');
    },

    /**
     * 가게가 잔돈을 바로 준다.
     * 바닥에 떨구면 주워야 해서 MOUSE 와 겹치고, 그냥 벌이면 보석 매입과
     * 구분이 안 된다. 가끔·소액으로만 들어와 가게가 서 있는 맛을 남긴다.
     */
    change: function (e) {
      if (e.burning) return;
      var v = U.randInt(C.SHOP_COIN_MIN, C.SHOP_COIN_MAX);
      G.board.earn(v);
      G.ui.floatMoney(e.x, e.y - 22, v);
      G.fx.coins(e.x, e.y, 8);
    },

    /* 벌이 꿀을 턴다 — 나무가 곁에 있을 때만 */
    bee: function (e) {
      if (!nearest(e, 132, isWord('TREE'))) { e.startJump(120); return; }
      var v = reward(C.EVENT_CUT, C.EVENT_FLAT);
      G.board.earn(v); G.ui.floatMoney(e.x, e.y - 16, v);
      G.fx.coins(e.x, e.y, 8);
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

    /**
     * 열쇠로 상자를 연다. 쌓인 값을 받고 상자는 텅 빈다 —
     * 안에 넣은 글자는 값으로 바뀐 셈이라 돌아오지 않는다.
     * 열쇠는 한 번 쓰면 부러진다. 상자는 그대로 남아서 다시 쓸 수 있다.
     * (드래그로 KEY 를 BOX 위에 올려 연다 — unlock 결속은 쓰지 않는다)
     */
    unlock: function (a, b) {
      openBox(a, b);
    }
  };

  var GUARD = {
    /* 익는 중인 것에는 불이 옮지 않는다 — 고기는 타기 전에 먼저 익어야 한다.
       다 익고 나면 보호가 풀리므로, 그때부터는 제때 빼내는 것이 플레이어 몫이다 */
    ignite: function (a, b) {
      return !b.burning && b.chill <= 0 && !(b.data.ripe > 0 && b.data.ripe < 1);
    }
  };

  /* ==================================================================
     금고 (BANK)
     ------------------------------------------------------------------
     금고는 은행 한 채가 아니라 보드 전체가 함께 쓴다. 예전에는 첫 번째
     은행에 얹어 두었는데, 그 한 채가 타 버리면 다른 은행이 멀쩡히 서 있어도
     맡긴 돈이 통째로 사라졌다. 지금은 G.state 에 있으니 은행을 옮겨 지어도
     맡긴 돈은 그대로다 — 다만 은행이 한 채도 없으면 넣지도 받지도 못한다.

     금고 시계(vaultT)는 이 함수가 불릴 때에만 간다. 이 함수는 board.step 안에
     있고 board.step 은 보고 있는 동안에만 돌기 때문에, 자리를 비우면 시계는
     멈춘 자리에 그대로 서 있다가 돌아오면 이어 간다. 방치 보상(offlineGain)도
     earn() 을 거치지 않으니 자리를 비운 사이의 벌이는 금고로 들어가지 않는다.
     은행은 켜 두고 굴리는 쪽에 값을 쳐 주는 단어다 — 그 대신 이자를 크게 얹는다.
     ================================================================== */

  function stepVault(dt, list) {
    var banks = [], i;
    for (i = 0; i < list.length; i++) {
      if (list[i].type === 'word' && list[i].text === 'BANK' && !list[i].burning) banks.push(list[i]);
    }
    if (!banks.length) return;

    var v = G.state.vault || 0;
    var rate = G.bankRate(banks.length);
    G.state.vaultT = (G.state.vaultT || 0) + dt;

    var left = Math.max(0, C.BANK_PERIOD - G.state.vaultT);
    var tag = Math.round(v) + 'w · ' + Math.ceil(left / 60) + '분';
    var full = v >= G.vaultMax(banks.length);
    for (i = 0; i < banks.length; i++) banks[i].setBadge(tag, full ? 'good' : null);

    if (G.state.vaultT < C.BANK_PERIOD) return;
    G.state.vaultT = 0;
    G.state.vault = 0;
    if (v < 1) return;

    /* 지급은 earn() 을 거치지 않는다 — 거치면 받은 돈에서 또 떼어 가 돌고 돈다 */
    var pay = Math.round(v * (1 + rate));
    G.state.money += pay;
    G.state.totalEarned = (G.state.totalEarned || 0) + pay;
    var b = banks[0];
    G.ui.floatMoney(b.x, b.y - 22, pay);
    G.fx.coins(b.x, b.y, 18);
    G.fx.ring(b.x, b.y, { r0: 6, r1: 78, life: .7, c: '70,150,110', lw: 1.5 });
    G.ui.toast('금고가 열렸다 · <b>' + U.money(pay) + '</b> (이자 ' + Math.round(rate * 100) + '%)');
  }

  /**
   * 상자에서 쌓인 값을 꺼낸다. KEY 가 열 때 부른다.
   * 상자는 그대로 남고, 넣은 글자는 돌아오지 않는다.
   * @return 꺼낸 액수. 비어 있어 아무것도 안 했으면 -1
   */
  function emptyBox(box) {
    var v = Math.round(box.data.stored || 0);
    var kept = (box.data.kept || '').length;
    if (!v && !kept) return -1;

    box.data.stored = 0;
    box.data.kept = '';
    box.setBadge('');
    if (v > 0) {
      G.board.earn(v);
      G.ui.floatMoney(box.x, box.y - 24, v);
    }
    G.fx.coins(box.x, box.y, 14);
    G.fx.ring(box.x, box.y, { r0: 6, r1: 80, life: .6, c: '200,170,80', lw: 1.5 });
    return v;
  }

  /**
   * KEY 를 BOX 위에 올려 연다. 값이 나오면 열쇠는 부러진다.
   * @return 꺼낸 액수. 실패하면 -1
   */
  function openBox(key, box) {
    if (!key || !box || !G.board.get(key.id) || !G.board.get(box.id)) return -1;
    var v = emptyBox(box);
    if (v < 0) {
      G.ui.toast('상자가 비어 있다');
      return -1;
    }
    var kx = key.x, ky = key.y;
    var left = key.text.charAt(U.randInt(0, key.text.length - 1));
    G.board.remove(key);
    G.fx.burst(kx, ky, '190,165,90', 16, 92);
    if (G.board.count() < G.maxEntities()) {
      var L = G.board.spawnLetter(left, kx, ky + 8);
      L.vy = 40;
    }
    G.ui.toast('<b>BOX</b> 를 열었다 · 열쇠만 부러졌다');
    return v;
  }

  /**
   * 금고에 쌓인 원금을 당장 찾는다. 이자는 만기까지 기다려야 붙으니
   * 지금 찾는 쪽에는 원금만 준다. 시계는 다시 처음부터.
   * @return 찾은 액수 (없으면 0)
   */
  function claimVault(at) {
    var v = Math.round(G.state.vault || 0);
    if (v < 1) return 0;
    G.state.vault = 0;
    G.state.vaultT = 0;
    G.state.money += v;
    G.state.totalEarned = (G.state.totalEarned || 0) + v;
    var x = at ? at.x : 0, y = at ? at.y : 0;
    if (at) {
      G.ui.floatMoney(x, y - 22, v);
      G.fx.coins(x, y, 14);
      G.fx.ring(x, y, { r0: 6, r1: 72, life: .6, c: '70,150,110', lw: 1.4 });
    }
    return v;
  }

  /* ==================================================================
     메인 루프
     ================================================================== */
  var SPREAD = [{ with: '#burnable', range: 104, time: C.IGNITE_TIME, key: 'ignite' }];

  function step(dt) {
    frameNo++;
    var list = G.board.all(), i, e;

    /* 1. 지속 효과 */
    for (i = 0; i < list.length; i++) {
      e = list[i];
      e.danger = 0;
      if (e.type !== 'word') continue;
      if (e.data.lucky > 0) { e.data.lucky -= dt; e.incomeMul *= C.LUCKY_INCOME; }
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

    /* 3. 주기 행동 — 20초에 한 번 주사위를 굴린다.
       예전에는 "26~40초마다 한 번" 처럼 단어마다 다른 주기를 두었는데,
       설명에 적을 수도 없고(그래서 전부 "가끔" 이었다) 서로 견줄 수도 없었다.
       지금은 자는 주기가 벌이 주기와 같은 20초로 통일되어 있어,
       도감에 "20초마다 15%" 라고 그대로 적을 수 있다. */
    for (i = 0; i < list.length; i++) {
      e = list[i];
      if (e.type !== 'word' || !e.def.act) continue;
      var act = ACTIONS[e.def.act];
      if (!act) continue;
      e.actTimer -= dt;
      if (e.actTimer <= 0) {
        e.actTimer += C.PAY_PERIOD;
        var p = (e.def.actChance || .5) * e.speedMul;
        if (!e.dragging && Math.random() < p) act(e);
      }
    }

    /* 4. 금고 */
    stepVault(dt, list);

    /* 5. 화재 결과 — 불이 붙은 채 BURN_LIFE 초면 사라진다.
       TREE 만은 재가 COAL 로 남는다.
       글자로 흩어지게 두었더니 불이 오히려 이득이었다. 다 탄 자리에서 글자가
       도로 나오니 잃는 것이 없고, 정원까지 늘어난 꼴이라 일부러 태우는 편이
       빨랐다. 타면 글자까지 없어져야 불을 무서워한다. */
    for (i = list.length - 1; i >= 0; i--) {
      e = list[i];
      if (!e.burning || e.burnTime <= C.BURN_LIFE) continue;
      var bx = e.x, by = e.y, name = e.text, wasTree = name === 'TREE';
      G.fx.burst(bx, by, '120,110,105', 26, 130);
      G.board.remove(e);
      if (wasTree) {
        var coal = G.board.makeWord('COAL', bx, by);
        G.game.onWordFormed(coal, true, 'ability');
        G.ui.toast('<b>TREE</b> 가 타서 <b>COAL</b> 이 되었다');
      } else {
        G.ui.toast('<b>' + name + '</b> 가 다 타서 사라졌다');
      }
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
        /* 숯을 물린 불(a)은 더 빨리 옮아붙는다 */
        var rate = a.stoke || 1;
        var entry = G.contacts.accum(a, b, bond.key, dt * rate);
        var p = Math.max(0, entry.t) / bond.time;
        if (bond.key === 'ignite') {
          if (p > (b.danger || 0)) b.danger = Math.min(1, p);
          if (p > 0.15) G.fx.dangerDots(a.x, a.y, b.x, b.y, Math.min(1, p), dt);
        } else if (p > 0.25) {
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
    boxRoom: boxRoom, boxSlots: boxSlots, putInBox: putInBox,
    emptyBox: emptyBox, openBox: openBox, claimVault: claimVault,
    upLevel: upLevel, upgradable: upgradable, runUpgrade: runUpgrade,
    hammerable: hammerable, strikeGem: strikeGem,
    sellableGem: sellableGem, sellGem: sellGem,
    craftable: craftable, putInCraft: putInCraft,
    FIELDS: FIELDS, ACTIONS: ACTIONS, BONDS: BONDS
  };
})();
