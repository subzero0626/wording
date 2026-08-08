/* ==========================================================================
   util.js — 공용 유틸리티
   전역 네임스페이스 G 사용 (file:// 로 바로 열 수 있도록 ES module 미사용)
   ========================================================================== */
var G = window.G || (window.G = {});

G.util = (function () {

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function randInt(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function chance(p) { return Math.random() < p; }

  function dist(ax, ay, bx, by) {
    var dx = ax - bx, dy = ay - by;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function dist2(ax, ay, bx, by) {
    var dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
  }

  /** 가중치 { key: weight } 에서 하나 뽑기 */
  function weightedPick(table) {
    var total = 0, k;
    for (k in table) total += table[k];
    var r = Math.random() * total;
    for (k in table) {
      r -= table[k];
      if (r <= 0) return k;
    }
    return k;
  }

  var _id = 0;
  function uid(prefix) { _id += 1; return (prefix || 'e') + _id; }
  function seedUid(n) { if (n > _id) _id = n; }
  function currentUid() { return _id; }

  function money(v) {
    var n = Math.floor(v);
    return '$' + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function secs(v) {
    return Math.max(0, Math.ceil(v)) + '초';
  }

  /** 두 사각형(중심 기준)의 겹침 벡터. 안 겹치면 null */
  function overlap(a, b) {
    var dx = b.x - a.x, dy = b.y - a.y;
    var ox = (a.w + b.w) / 2 - Math.abs(dx);
    if (ox <= 0) return null;
    var oy = (a.h + b.h) / 2 - Math.abs(dy);
    if (oy <= 0) return null;
    return { ox: ox, oy: oy, dx: dx, dy: dy };
  }

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInOut(t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function el(tag, cls, parent) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }

  return {
    clamp: clamp, lerp: lerp, rand: rand, randInt: randInt, pick: pick, chance: chance,
    dist: dist, dist2: dist2, weightedPick: weightedPick,
    uid: uid, seedUid: seedUid, currentUid: currentUid,
    money: money, secs: secs, overlap: overlap,
    easeOutCubic: easeOutCubic, easeInOut: easeInOut, el: el
  };
})();
