/* ==========================================================================
   ui.js — 화면 UI
   평소 보이는 것: 상단 게이지 / 재화 / 좌측 도감 탭 / 우하단 일시정지
   그 외는 전부 필요할 때만 나타난다.
   ========================================================================== */
var G = window.G || (window.G = {});

G.ui = (function () {
  var U = G.util, C = G.C;

  var elMoney, elGauge, elGaugeBar, elGaugeText, elSpawnPop, elWordPop,
    elCodex, elCodexTab, elCodexList, elCodexCount, elCodexFoot, elChip, elToasts,
    elPauseVeil, elIntro, playEl, appEl;

  var lastMoneyShown = -1;
  var chipEdge = null;

  function init() {
    appEl = document.getElementById('app');
    playEl = document.getElementById('play');
    elMoney = document.getElementById('money');
    elGauge = document.getElementById('gauge');
    elGaugeBar = document.querySelector('#gaugeBar i');
    elGaugeText = document.getElementById('gaugeText');
    elSpawnPop = document.getElementById('spawnPop');
    elWordPop = document.getElementById('wordPop');
    elCodex = document.getElementById('codex');
    elCodexTab = document.getElementById('codexTab');
    elCodexList = document.getElementById('codexList');
    elCodexCount = document.getElementById('codexCount');
    elCodexFoot = document.querySelector('#codex footer');
    elChip = document.getElementById('expandChip');
    elToasts = document.getElementById('toasts');
    elPauseVeil = document.getElementById('pauseVeil');
    elIntro = document.getElementById('intro');

    /* --- 생성 게이지 / 업그레이드 팝오버 --- */
    elGauge.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (elSpawnPop.classList.contains('hidden')) openSpawnPop();
      else closePopovers();
    });
    document.getElementById('popBuy').addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (G.game.buySpawnUpgrade()) { renderSpawnPop(); }
    });
    /* 팝오버 내부 조작이 "바깥 클릭"으로 오해받지 않도록 pointerdown 을 막는다 */
    ['pointerdown', 'click'].forEach(function (t) {
      elSpawnPop.addEventListener(t, function (ev) { ev.stopPropagation(); });
      elWordPop.addEventListener(t, function (ev) { ev.stopPropagation(); });
      elGauge.addEventListener(t, function (ev) { ev.stopPropagation(); });
    });
    document.addEventListener('pointerdown', function () { closePopovers(); });

    /* --- 도감 --- */
    elCodexTab.addEventListener('click', function (ev) {
      ev.stopPropagation(); toggleCodex(true);
    });
    document.getElementById('codexClose').addEventListener('click', function (ev) {
      ev.stopPropagation(); toggleCodex(false);
    });
    elCodex.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });

    /* --- 확장 칩: 보드 가장자리에 마우스가 가면 살짝 나타난다 --- */
    document.addEventListener('pointermove', onPointerMove);
    elChip.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (G.board.expandCost() === null) return;
      if (G.board.expand()) { updateChip(); }
      else flashChip();
    });

    /* --- 일시정지 --- */
    document.getElementById('pauseBtn').addEventListener('click', function (ev) {
      ev.stopPropagation(); G.game.setPaused(true);
    });
    document.getElementById('resumeBtn').addEventListener('click', function (ev) {
      ev.stopPropagation(); G.game.setPaused(false);
    });
    document.getElementById('settingsBtn').addEventListener('click', function (ev) {
      ev.stopPropagation();
      document.getElementById('settings').classList.toggle('hidden');
    });
    document.getElementById('optFx').addEventListener('change', function () {
      G.state.opt.fx = this.checked;
      G.fx.setEnabled(this.checked);
    });
    document.getElementById('optSnapHint').addEventListener('change', function () {
      G.state.opt.snapHint = this.checked;
    });
    document.getElementById('resetBtn').addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (confirm('보드를 모두 지우고 처음부터 다시 시작할까요?')) G.game.hardReset();
    });
    elPauseVeil.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });

    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') { closePopovers(); toggleCodex(false); }
      if (ev.key === ' ' && ev.target === document.body) {
        ev.preventDefault(); G.game.setPaused(!G.game.paused);
      }
    });

    renderCodex();
  }

  /* ------------------------------------------------------------------
     상단
     ------------------------------------------------------------------ */
  function tick() {
    var m = Math.floor(G.state.money);
    if (m !== lastMoneyShown) {
      lastMoneyShown = m;
      elMoney.textContent = U.money(m);
    }
    var total = G.game.spawnInterval();
    var left = G.state.spawnTimer;
    var p = U.clamp(1 - left / total, 0, 1);
    elGaugeBar.style.width = (p * 100).toFixed(1) + '%';
    elGaugeText.textContent = (G.board.count() >= C.MAX_ENTITIES)
      ? '보드가 가득 찼다'
      : '다음 글자 ' + U.secs(left);
    if (!elSpawnPop.classList.contains('hidden')) renderSpawnPop();
    if (chipEdge) updateChip();
  }

  /** 생성 게이지가 확 줄었을 때 눈에 띄게 */
  function pulseGauge() {
    elGauge.classList.remove('pulse');
    void elGauge.offsetWidth;
    elGauge.classList.add('pulse');
    setTimeout(function () { elGauge.classList.remove('pulse'); }, 600);
  }

  function bumpMoney() {
    elMoney.classList.remove('bump');
    void elMoney.offsetWidth;
    elMoney.classList.add('bump');
  }

  /** @param small 낱글자처럼 잦은 지급은 작고 옅게 */
  function floatMoney(x, y, amount, small) {
    if (!G.state.opt.fx && small) return;
    var r = playEl.getBoundingClientRect();
    var d = document.createElement('div');
    d.className = 'float-money' + (small ? ' small' : '');
    var neg = amount < 0;
    d.textContent = (neg ? '-' : '+') + U.money(Math.abs(amount));
    if (neg) d.style.color = '#b4544a';
    d.style.left = (r.left + x) + 'px';
    d.style.top = (r.top + y - 20) + 'px';
    d.style.transform = 'translateX(-50%)';
    appEl.appendChild(d);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 1150);
    if (!neg && !small) bumpMoney();
  }

  var toastQ = 0;
  function toast(html) {
    if (toastQ > 3) return;
    toastQ++;
    var t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = html;
    elToasts.appendChild(t);
    setTimeout(function () { t.classList.add('out'); }, 2400);
    setTimeout(function () {
      if (t.parentNode) t.parentNode.removeChild(t);
      toastQ--;
    }, 2750);
  }

  /* ------------------------------------------------------------------
     팝오버
     ------------------------------------------------------------------ */
  function openSpawnPop() {
    closePopovers();
    elSpawnPop.classList.remove('hidden');
    renderSpawnPop();
  }

  function renderSpawnPop() {
    var lv = G.state.spawnLevel;
    var cur = C.SPAWN_STEPS[lv];
    var isMax = lv >= C.SPAWN_STEPS.length - 1;
    document.getElementById('popCur').textContent = cur + '초';
    var btn = document.getElementById('popBuy');
    if (isMax) {
      document.getElementById('popFrom').textContent = cur + '초';
      document.getElementById('popTo').textContent = '최소';
      document.getElementById('popCost').textContent = '—';
      btn.disabled = true;
      btn.textContent = '더 줄일 수 없음';
    } else {
      var next = C.SPAWN_STEPS[lv + 1];
      var cost = C.SPAWN_COSTS[lv];
      document.getElementById('popFrom').textContent = cur + '초';
      document.getElementById('popTo').textContent = next + '초';
      document.getElementById('popCost').textContent = U.money(cost);
      btn.disabled = G.state.money < cost;
      btn.textContent = '단축';
    }
  }

  /** 단어를 더블클릭하면 그 단어의 뜻을 보여준다 */
  function showWordPop(ent, cx, cy) {
    closePopovers();
    var d = ent.def;
    var word = ent.text;

    elWordPop.querySelector('.wp-name').textContent = word;
    elWordPop.querySelector('.wp-name').style.color = d.color.fg;
    elWordPop.querySelector('.wp-pay').textContent =
      C.PAY_PERIOD + '초마다 ' + U.money(d.value);

    var posEl = elWordPop.querySelector('.wp-pos');
    var baseEl = elWordPop.querySelector('.wp-base');
    var koEl = elWordPop.querySelector('.wp-ko');
    var glossEl = elWordPop.querySelector('.wp-gloss');
    posEl.textContent = '';
    baseEl.textContent = '';
    koEl.textContent = '';
    glossEl.textContent = '뜻을 불러오는 중…';
    glossEl.classList.add('loading');

    var token = ++popToken;
    G.defs.get(word, function (info) {
      if (token !== popToken) return;            // 그 사이 다른 걸 열었다
      glossEl.classList.remove('loading');
      if (!info) {
        glossEl.textContent = '뜻 정보가 없는 단어입니다.';
        return;
      }
      posEl.textContent = info.posKo;
      baseEl.textContent = info.base ? (info.base + ' 의 변화형') : '';
      koEl.textContent = info.ko || '';
      glossEl.textContent = info.gloss;
    });

    var br = elWordPop.querySelector('.wp-break');
    br.onclick = function (ev) {
      ev.stopPropagation();
      if (G.board.get(ent.id)) G.board.explode(ent);
      closePopovers();
    };

    elWordPop.classList.remove('hidden');
    var w = elWordPop.offsetWidth, h = elWordPop.offsetHeight;
    elWordPop.style.left = U.clamp(cx - w / 2, 8, window.innerWidth - w - 8) + 'px';
    elWordPop.style.top = U.clamp(cy + 22, 8, window.innerHeight - h - 8) + 'px';
  }
  var popToken = 0;

  function closePopovers() {
    elSpawnPop.classList.add('hidden');
    elWordPop.classList.add('hidden');
  }

  /* ------------------------------------------------------------------
     확장 칩
     ------------------------------------------------------------------ */
  var BAND = 58;

  /** 화면 가장자리 근처에서만 확장 칩을 보여준다 (드래그 중에는 방해하지 않는다) */
  function onPointerMove(ev) {
    if (G.game.paused || G.drag.current) { hideChip(); return; }
    if (ev.target && ev.target.closest &&
      ev.target.closest('#gauge,#money,#codexTab,#codex,#pauseBtn,.pop,.token')) {
      hideChip(); return;
    }
    var w = window.innerWidth, h = window.innerHeight;
    var x = ev.clientX, y = ev.clientY;
    var edge = null;
    if (x < BAND) edge = 'left';
    else if (x > w - BAND) edge = 'right';
    else if (y > h - BAND) edge = 'bottom';
    else if (y < BAND) edge = 'top';

    if (!edge) { hideChip(); return; }
    chipEdge = edge;

    var pad = 30;
    var cx, cy;
    if (edge === 'top') { cx = x; cy = pad + 12; }
    else if (edge === 'bottom') { cx = x; cy = h - pad - 12; }
    else if (edge === 'left') { cx = pad + 22; cy = y; }
    else { cx = w - pad - 22; cy = y; }

    elChip.style.left = Math.round(cx) + 'px';
    elChip.style.top = Math.round(cy) + 'px';
    elChip.classList.add('show');
    updateChip();
  }

  function updateChip() {
    var c = G.board.expandCost();
    if (c === null) {
      elChip.classList.add('max');
      elChip.querySelector('.chip-t').textContent = '최대 크기';
      elChip.querySelector('.chip-c').textContent = '';
      return;
    }
    elChip.classList.remove('max');
    elChip.querySelector('.chip-t').textContent = '확장';
    elChip.querySelector('.chip-c').textContent = U.money(c);
    elChip.classList.toggle('poor', G.state.money < c);
  }

  function hideChip() {
    chipEdge = null;
    elChip.classList.remove('show');
  }

  function flashChip() {
    elChip.animate(
      [{ transform: 'translate(-50%,-50%) scale(1)' },
      { transform: 'translate(-50%,-50%) scale(.93)' },
      { transform: 'translate(-50%,-50%) scale(1)' }],
      { duration: 220 }
    );
  }

  /* ------------------------------------------------------------------
     도감
     ------------------------------------------------------------------ */
  function toggleCodex(open) {
    if (open === undefined) open = !elCodex.classList.contains('open');
    elCodex.classList.toggle('open', open);
    elCodexTab.classList.toggle('open', open);
    if (open) renderCodex();
  }

  var HINT_COST = [180, 450];

  function renderCodex() {
    if (!elCodexList) return;
    var found = 0, html = '';
    G.WORDS.forEach(function (w) {
      var got = !!G.state.discovered[w.id];
      if (got) found++;
      var hint = G.state.hints[w.id] || 0;
      html += '<div class="cx' + (got ? '' : ' locked') + '">';
      html += '<div class="dot" style="--c:' + (got ? w.color.fg : '') + '"></div>';
      html += '<div class="mid">';
      if (got) {
        html += '<div class="n">' + w.id + '</div>';
        html += '<div class="k">' + w.kind + '</div>';
        html += '<div class="d">' + w.desc + '</div>';
      } else {
        var mask = '';
        for (var i = 0; i < w.id.length; i++) {
          mask += (hint >= 1 && i === 0) ? w.id[0] : '?';
        }
        html += '<div class="n">' + mask + '</div>';
        html += '<div class="k">' + (hint >= 1 ? w.kind : w.id.length + ' 글자') + '</div>';
        if (hint >= 2) html += '<div class="d">' + w.hint + '</div>';
        var lv = hint;
        if (lv < 2) {
          html += '<button class="hintbtn" data-w="' + w.id + '">힌트 ' +
            U.money(HINT_COST[lv]) + '</button>';
        }
      }
      html += '</div></div>';
    });
    elCodexList.innerHTML = html;
    elCodexCount.textContent = found + ' / ' + G.WORDS.length;

    var made = Object.keys(G.state.madeWords || {}).length;
    elCodexFoot.innerHTML = made
      ? '그 밖에 만들어 본 단어 <b>' + made + '</b>개 · 사전에 있는 단어라면 무엇이든 만들 수 있다'
      : '보드에서 글자를 끌어다 붙이면 단어가 됩니다.';

    var btns = elCodexList.querySelectorAll('.hintbtn');
    for (var b = 0; b < btns.length; b++) {
      btns[b].addEventListener('click', function (ev) {
        ev.stopPropagation();
        buyHint(this.dataset.w);
      });
    }
  }

  function buyHint(id) {
    var lv = G.state.hints[id] || 0;
    if (lv >= 2) return;
    var cost = HINT_COST[lv];
    if (!G.board.spend(cost)) { toast('돈이 부족하다'); return; }
    G.state.hints[id] = lv + 1;
    renderCodex();
  }

  function hideIntro() {
    if (elIntro) elIntro.classList.add('hidden');
  }

  function showIntro() {
    if (elIntro) elIntro.classList.remove('hidden');
  }

  function setPausedUI(p) {
    elPauseVeil.classList.toggle('hidden', !p);
    if (!p) document.getElementById('settings').classList.add('hidden');
  }

  function syncOptions() {
    document.getElementById('optFx').checked = G.state.opt.fx;
    document.getElementById('optSnapHint').checked = G.state.opt.snapHint;
  }

  return {
    init: init, tick: tick, toast: toast, floatMoney: floatMoney, pulseGauge: pulseGauge,
    closePopovers: closePopovers, showWordPop: showWordPop,
    renderCodex: renderCodex, toggleCodex: toggleCodex,
    setPausedUI: setPausedUI, hideIntro: hideIntro, showIntro: showIntro,
    syncOptions: syncOptions, hideChip: hideChip
  };
})();
