/* 브라우저 없이 게임 코드를 그대로 올려 놓는 껍데기.
   _sim.js (동작 검증) 와 _pace.js (진행 속도 계측) 가 함께 쓴다. */
'use strict';
const fs = require('fs'), vm = require('vm');

const ctx = new Proxy({}, { get: () => () => {} });

function makeEl(tag) {
  const cls = new Set(), hs = {}, sub = {};
  const el = {
    tagName: (tag || 'div').toUpperCase(),
    style: new Proxy({ setProperty(k, v) { this['--' + k.replace(/^--/, '')] = v; } },
      { get: (t, k) => t[k] || '', set: (t, k, v) => (t[k] = v, true) }),
    children: [], parentNode: null, dataset: {}, textContent: '', innerHTML: '',
    classList: {
      add: (...c) => c.forEach(x => cls.add(x)),
      remove: (...c) => c.forEach(x => cls.delete(x)),
      toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)),
      contains: c => cls.has(c)
    },
    appendChild(c) { c.parentNode = el; el.children.push(c); return c; },
    removeChild(c) { const i = el.children.indexOf(c); if (i >= 0) el.children.splice(i, 1); return c; },
    addEventListener(k, f) { (hs[k] || (hs[k] = [])).push(f); }, removeEventListener() {},
    setAttribute() {}, getAttribute: () => null,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 700 }),
    /* 선택자마다 같은 가짜 자식을 돌려준다. null 을 주면 ui.js 의
       elMoneyVal 같은 것들이 전부 null 이 되어 init 이 그 자리에서 죽는다 */
    getContext: () => ctx,
    querySelector(sel) { return sub[sel] || (sub[sel] = makeEl('div')); },
    querySelectorAll: () => [],
    focus() {}, blur() {}, click() {},
    get offsetWidth() { return 60; }, get offsetHeight() { return 40; },
    clientWidth: 1200, clientHeight: 800, scrollTop: 0, scrollHeight: 0
  };
  Object.defineProperty(el, 'className', {
    get: () => [...cls].join(' '),
    set: v => { cls.clear(); String(v).split(/\s+/).filter(Boolean).forEach(c => cls.add(c)); }
  });
  return el;
}

const byId = {};
const document = {
  body: makeEl('body'), head: makeEl('head'), documentElement: makeEl('html'), hidden: false,
  createElement: makeEl, getElementById: id => byId[id] || (byId[id] = makeEl('div')),
  querySelector: () => makeEl('div'), querySelectorAll: () => [],
  addEventListener() {}, removeEventListener() {}
};

const store = {};
const S = {
  console, Math, JSON, Date, String, Number, Boolean, Object, Array, RegExp, Error, Infinity,
  parseInt, parseFloat, isNaN, isFinite, encodeURIComponent, decodeURIComponent,
  setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
  requestAnimationFrame: () => 0, cancelAnimationFrame: () => {}, document,
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; }
  },
  navigator: { userAgent: 'node' }, performance: { now: () => Date.now() },
  innerWidth: 1200, innerHeight: 800, devicePixelRatio: 1,
  addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false, addListener() {} })
};
S.window = S; S.globalThis = S;
vm.createContext(S);

for (const f of ['js/util.js', 'js/dict.js', 'js/defs.js', 'js/data.js', 'js/fx.js', 'js/entity.js',
  'js/board.js', 'js/drag.js', 'js/behaviors.js', 'js/ui.js', 'js/save.js', 'js/game.js']) {
  vm.runInContext(fs.readFileSync(f, 'utf8'), S, { filename: f });
}

const G = S.G, C = S.G.C;
G.game.init();

/* 화면에 그리는 것들은 조용히 삼키고, 토스트만 기록해 둔다 */
const log = [];
G.ui.floatMoney = () => {};
G.ui.toast = m => log.push(m.replace(/<[^>]+>/g, ''));
G.board.layout(1000, 660);

const DT = 1 / 30;
const clear = () => { for (const e of G.board.all().slice()) G.board.remove(e); log.length = 0; };

module.exports = { G, C, DT, log, clear };
