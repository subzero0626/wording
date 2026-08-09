/* ==========================================================================
   ui.js — 화면 UI
   평소 보이는 것: 상단 게이지 / 재화 / 좌측 도감 탭 / 우하단 일시정지
   그 외는 전부 필요할 때만 나타난다.
   ========================================================================== */
var G = window.G || (window.G = {});

G.ui = (function () {
  var U = G.util, C = G.C;

  var elMoney, elMoneyVal, elGauge, elGaugeBar, elGaugeText, elSpawnPop, elWordPop,
    elBoardCount, elCountNum, elCountMax, elTicketPop, elTicketBuys,
    elCodex, elCodexTab, elCodexList, elCodexCount, elCodexTickets, elCodexFoot,
    elChip, elToasts, elPauseVeil, elIdleVeil, elIntro, playEl, appEl;

  var lastMoneyShown = -1;
  var lastCountShown = -1, lastMaxShown = -1;
  var chipEdge = null;

  function init() {
    appEl = document.getElementById('app');
    playEl = document.getElementById('play');
    elMoney = document.getElementById('money');
    elMoneyVal = elMoney.querySelector('.m-v');
    elGauge = document.getElementById('gauge');
    elGaugeBar = document.querySelector('#gaugeBar i');
    elGaugeText = document.getElementById('gaugeText');
    elBoardCount = document.getElementById('boardCount');
    elCountNum = elBoardCount.querySelector('b');
    elCountMax = elBoardCount.querySelector('span');
    elSpawnPop = document.getElementById('spawnPop');
    elWordPop = document.getElementById('wordPop');
    elCodex = document.getElementById('codex');
    elCodexTab = document.getElementById('codexTab');
    elCodexList = document.getElementById('codexList');
    elCodexCount = document.getElementById('codexCount');
    elCodexTickets = document.getElementById('codexTickets');
    elCodexFoot = document.querySelector('#codex footer');
    elTicketPop = document.getElementById('ticketPop');
    elTicketBuys = elTicketPop.querySelector('.tk-buys');
    elChip = document.getElementById('expandChip');
    elToasts = document.getElementById('toasts');
    elPauseVeil = document.getElementById('pauseVeil');
    elIdleVeil = document.getElementById('idleVeil');
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
    /* --- 재화(또는 도감 안의 힌트권 띠)를 누르면 구매창 --- */
    elMoney.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (elTicketPop.classList.contains('hidden')) openTicketPop();
      else closePopovers();
    });
    elCodexTickets.addEventListener('click', function (ev) {
      ev.stopPropagation(); openTicketPop();
    });
    buildTicketButtons();

    /* 팝오버 내부 조작이 "바깥 클릭"으로 오해받지 않도록 pointerdown 을 막는다 */
    ['pointerdown', 'click'].forEach(function (t) {
      elSpawnPop.addEventListener(t, function (ev) { ev.stopPropagation(); });
      elWordPop.addEventListener(t, function (ev) { ev.stopPropagation(); });
      elGauge.addEventListener(t, function (ev) { ev.stopPropagation(); });
      elMoney.addEventListener(t, function (ev) { ev.stopPropagation(); });
      elTicketPop.addEventListener(t, function (ev) { ev.stopPropagation(); });
    });
    document.addEventListener('pointerdown', function () { closePopovers(); });

    /* --- 도감: 손잡이를 끌어서 여닫는다 (그냥 누르면 토글) --- */
    elCodexTab.addEventListener('pointerdown', onCodexGrab);
    window.addEventListener('pointermove', onCodexDrag);
    window.addEventListener('pointerup', endCodexDrag);
    window.addEventListener('pointercancel', endCodexDrag);

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
    /* 카드 바깥의 어두운 곳을 누르면 그냥 이어서 한다 */
    elPauseVeil.addEventListener('pointerdown', function (ev) {
      ev.stopPropagation();
      if (ev.target === elPauseVeil) G.game.setPaused(false);
    });

    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') {
        if (G.game.paused) { G.game.setPaused(false); return; }
        closePopovers(); toggleCodex(false);
      }
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
      elMoneyVal.textContent = U.num(m);
    }
    var n = G.board.count(), max = G.maxEntities(), full = n >= max;
    if (n !== lastCountShown || max !== lastMaxShown) {
      lastCountShown = n; lastMaxShown = max;
      elCountNum.textContent = n;
      elCountMax.textContent = '/' + max;
      elBoardCount.classList.toggle('full', full);
    }

    var left = G.state.spawnTimer;
    var p = U.clamp(1 - left / G.game.spawnInterval(), 0, 1);
    elGaugeBar.style.width = (p * 100).toFixed(1) + '%';
    elGaugeText.textContent = full
      ? '보드가 가득 찼다 — 넓히면 더 둘 수 있다'
      : '다음 글자 ' + U.secs(left);
    if (!elSpawnPop.classList.contains('hidden')) renderSpawnPop();
    if (!elTicketPop.classList.contains('hidden')) renderTicketPop();
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
    d.textContent = (neg ? '-' : '+') + U.num(Math.abs(amount));   // 단위 없이 숫자만
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
    elGauge.classList.add('tipoff');     // 창이 떴으면 말풍선까지 겹칠 필요 없다
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

  /* ------------------------------------------------------------------
     힌트권 구매창
     ------------------------------------------------------------------ */
  function buildTicketButtons() {
    var html = '';
    for (var i = 0; i < C.TICKET_PACKS.length; i++) {
      html += '<button class="tk-b" data-n="' + C.TICKET_PACKS[i] + '">' +
        '<b>' + C.TICKET_PACKS[i] + '장 사기</b><span></span></button>';
    }
    elTicketBuys.innerHTML = html;
    var bs = elTicketBuys.querySelectorAll('.tk-b');
    for (var k = 0; k < bs.length; k++) {
      bs[k].addEventListener('click', function (ev) {
        ev.stopPropagation();
        buyTickets(+this.dataset.n);
      });
    }
  }

  function openTicketPop() {
    closePopovers();
    elTicketPop.classList.remove('hidden');
    elMoney.classList.add('tipoff');
    renderTicketPop();
  }

  function renderTicketPop() {
    elTicketPop.querySelector('.tk-have').textContent = G.state.tickets + '장';
    elTicketPop.querySelector('.tk-next b').textContent = U.money(C.TICKET_STEP);
    var bs = elTicketBuys.querySelectorAll('.tk-b');
    for (var i = 0; i < bs.length; i++) {
      var n = +bs[i].dataset.n, cost = G.ticketPack(n);
      bs[i].querySelector('span').textContent = U.money(cost);
      bs[i].disabled = G.state.money < cost;
    }
  }

  function buyTickets(n) {
    var cost = G.ticketPack(n);
    if (!G.board.spend(cost)) { toast('돈이 부족하다'); return; }
    G.state.tickets += n;
    G.state.ticketsBought += n;
    renderTicketPop();
    renderCodex();
  }

  /** 단어를 더블클릭하면 그 단어의 뜻을 보여준다 */
  function showWordPop(ent, cx, cy) {
    closePopovers();
    var d = ent.def;
    var word = ent.text;

    elWordPop.querySelector('.wp-name').textContent = word;
    elWordPop.querySelector('.wp-name').style.color = d.color.fg;

    /* 특이한 방식으로 버는 단어는 액수 대신 벌이의 성격을 적는다.
       보석에 "20초마다 8w" 를 띄우면 파는 값과 헷갈리기만 한다 */
    var payEl = elWordPop.querySelector('.wp-pay');
    var note = G.PAY_NOTE[d.id];
    payEl.textContent = note || (C.PAY_PERIOD + '초마다 ' + U.money(d.value));
    payEl.classList.toggle('note', !!note);

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
      /* 한글 자료가 없는 단어가 3분의 1쯤 된다. 그 자리를 비워 두면
         화면이 고장난 것처럼 보이므로, 없다고 적어 두고 영어 뜻으로 넘긴다 */
      var ko = G.defs.koText(info);
      koEl.textContent = ko || '한글 뜻 없음';
      koEl.classList.toggle('none', !ko);
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
    elTicketPop.classList.add('hidden');
    elGauge.classList.remove('tipoff');
    elMoney.classList.remove('tipoff');
  }

  /* ------------------------------------------------------------------
     확장 칩
     ------------------------------------------------------------------ */
  var BAND = 52;      // 놀이영역 경계에서 이만큼 안/밖까지가 반응 범위
  var CHIP_GAP = 12;  // 놀이영역 테두리와 칩 사이의 여백

  /** 보드(놀이영역) 가장자리 근처에서만 확장 칩을 보여준다 (드래그 중에는 방해하지 않는다) */
  function onPointerMove(ev) {
    if (G.game.paused || G.drag.current || cdOn) { hideChip(); return; }
    if (ev.target && ev.target.closest &&
      ev.target.closest('#gauge,#money,#codexTab,#codex,#pauseBtn,.pop,.token')) {
      hideChip(); return;
    }
    var r = playEl.getBoundingClientRect();
    var x = ev.clientX, y = ev.clientY;

    /* 경계에서 너무 멀면(안쪽 깊숙이든 바깥이든) 보여주지 않는다 */
    if (x < r.left - BAND || x > r.right + BAND ||
      y < r.top - BAND || y > r.bottom + BAND) { hideChip(); return; }

    var cand = [
      { e: 'left', d: Math.abs(x - r.left) },
      { e: 'right', d: Math.abs(r.right - x) },
      { e: 'top', d: Math.abs(y - r.top) },
      { e: 'bottom', d: Math.abs(r.bottom - y) }
    ];
    var best = cand[0];
    for (var i = 1; i < cand.length; i++) if (cand[i].d < best.d) best = cand[i];
    if (best.d > BAND) { hideChip(); return; }

    chipEdge = best.e;
    updateChip();       // 글자 수가 바뀌면 칩 폭도 바뀌므로 재기 전에 먼저 채운다

    /* 칩은 반드시 놀이영역 **바깥**에 통째로 놓는다.
       가운데 기준으로 놓이니 절반 너비만큼 더 밀어내야 테두리를 넘지 않는다.
       고정값으로 밀면 좌우에서는 칩의 안쪽 절반이 판 위로 올라와
       가장자리에 놓인 글자를 덮고 클릭까지 가로챈다. */
    var hw = (elChip.offsetWidth || 96) / 2 + CHIP_GAP;
    var hh = (elChip.offsetHeight || 30) / 2 + CHIP_GAP;

    var cx, cy;
    if (best.e === 'top') { cx = x; cy = r.top - hh; }
    else if (best.e === 'bottom') { cx = x; cy = r.bottom + hh; }
    else if (best.e === 'left') { cx = r.left - hw; cy = y; }
    else { cx = r.right + hw; cy = y; }

    /* 화면 밖으로 나가지 않게 하되, 그러다 판 위로 되밀리지는 않게 */
    cx = U.clamp(cx, hw, Math.max(hw, window.innerWidth - hw));
    cy = U.clamp(cy, hh, Math.max(hh, window.innerHeight - hh));
    if (best.e === 'top') cy = Math.min(cy, r.top - hh);
    else if (best.e === 'bottom') cy = Math.max(cy, r.bottom + hh);
    else if (best.e === 'left') cx = Math.min(cx, r.left - hw);
    else cx = Math.max(cx, r.right + hw);

    elChip.style.left = Math.round(cx) + 'px';
    elChip.style.top = Math.round(cy) + 'px';
    elChip.classList.add('show');
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

  /* 손잡이 드래그 — 서랍이 손가락을 그대로 따라온다 */
  var cdW = 0, cdFrom = 0, cdX = 0, cdOpen = false, cdOn = false, cdMoved = false;

  function onCodexGrab(ev) {
    ev.stopPropagation();
    ev.preventDefault();
    cdOpen = elCodex.classList.contains('open');
    cdW = elCodex.offsetWidth;
    cdFrom = ev.clientX;
    cdX = cdOpen ? cdW : 0;
    cdOn = true;
    cdMoved = false;
    if (!cdOpen) renderCodex();          // 열리기 전에 내용을 채워 둔다
    if (elCodexTab.setPointerCapture) elCodexTab.setPointerCapture(ev.pointerId);
    elCodex.classList.add('dragging');
    elCodexTab.classList.add('dragging');
  }

  function onCodexDrag(ev) {
    if (!cdOn) return;
    var d = ev.clientX - cdFrom;
    if (Math.abs(d) > 3) cdMoved = true;
    cdX = U.clamp((cdOpen ? cdW : 0) + d, 0, cdW);
    elCodex.style.transform = 'translateX(calc(-100% + ' + cdX.toFixed(1) + 'px))';
    elCodexTab.style.transform = 'translate(' + cdX.toFixed(1) + 'px,-50%)';
  }

  function endCodexDrag() {
    if (!cdOn) return;
    cdOn = false;
    elCodex.classList.remove('dragging');
    elCodexTab.classList.remove('dragging');
    elCodex.style.transform = '';
    elCodexTab.style.transform = '';
    /* 끌지 않고 눌렀다 떼면 그냥 토글, 끌었다면 놓은 위치로 결정한다 */
    toggleCodex(cdMoved ? (cdX > cdW * (cdOpen ? 0.65 : 0.28)) : !cdOpen);
  }

  /* 설명 안에 나오는 다른 능력 단어 이름은, 아직 못 찾았다면 가려 준다.
     앞뒤가 한글이나 공백이라 \b 로 정확히 그 단어일 때만 잡힌다. */
  var WORD_RE = (function () {
    var ids = G.WORDS.map(function (w) { return w.id; })
      .sort(function (a, b) { return b.length - a.length; });
    return new RegExp('\\b(' + ids.join('|') + ')\\b', 'g');
  })();

  function maskUnknown(text) {
    if (G.TEST_UNLOCK_ALL) return text;
    return text.replace(WORD_RE, function (id) {
      return G.state.discovered[id] ? id : '<i class="q">???</i>';
    });
  }

  function renderCodex() {
    if (!elCodexList) return;
    var found = 0, html = '';
    G.WORDS.forEach(function (w) {
      var got = G.TEST_UNLOCK_ALL || !!G.state.discovered[w.id];
      if (got) found++;
      var hint = G.state.hints[w.id] || 0;
      /* 잠긴 칸은 칸 자체가 버튼이다 — 누르면 다음 단계가 바로 열린다 */
      var open = !got && G.hintTickets(hint) > 0;
      html += '<div class="cx' + (got ? '' : ' locked') + (open ? ' askable' : '') +
        (open ? '" data-w="' + w.id : '') + '">';
      html += '<div class="dot" style="--c:' + (got ? w.color.fg : '') + '"></div>';
      html += '<div class="mid">';
      if (got) {
        html += '<div class="n">' + w.id + '</div>';
        html += '<div class="k">' + w.kind + '</div>';
        html += '<div class="d">' + maskUnknown(w.desc) + '</div>';
      } else {
        /* 3단계에서는 앞에서부터 여러 글자가, 1단계에서는 첫 글자만 드러난다 */
        var shown = hint >= 3 ? G.hintReveal(w.id.length) : (hint >= 1 ? 1 : 0);
        var mask = '';
        for (var i = 0; i < w.id.length; i++) mask += i < shown ? w.id[i] : '?';
        html += '<div class="n">' + mask + '</div>';
        html += '<div class="k">' + (hint >= 1 ? w.kind : w.id.length + ' 글자') + '</div>';
        if (hint >= 2) html += '<div class="d">' + maskUnknown(w.hint) + '</div>';
        var need = G.hintTickets(hint);
        if (need) {
          /* 값만 적어 두면 눌러도 되는 자리인지, 눌러서 뭘 얻는지 알 수 없다.
             단계 표시 · 값 · 무엇이 열리는지를 한 줄에 같이 놓는다. */
          var pips = '';
          for (var p = 0; p < G.HINT_MAX; p++) {
            pips += '<i class="pip' + (p < hint ? ' on' : '') + '"></i>';
          }
          html += '<div class="ask' + (G.state.tickets >= need ? '' : ' poor') + '">' +
            '<span class="pips">' + pips + '</span>' +
            '<span class="cost">힌트권 ' + need + '장</span>' +
            '<span class="gain">' + C.HINT_GAIN[hint] + '</span></div>';
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

    elCodexTickets.querySelector('.ct-n').textContent = G.state.tickets + '장';
    elCodexTickets.classList.toggle('empty', !G.state.tickets);

    var rows = elCodexList.querySelectorAll('.askable');
    for (var b = 0; b < rows.length; b++) {
      rows[b].addEventListener('click', function (ev) {
        ev.stopPropagation();
        spendHint(this.dataset.w);
      });
    }
  }

  /** 도감 칸을 누르면 다음 단계가 바로 열린다 — 확인 절차를 두지 않는다 */
  function spendHint(id) {
    var lv = G.state.hints[id] || 0;
    var need = G.hintTickets(lv);
    if (!need) return;
    if (G.state.tickets < need) {
      toast('힌트권이 ' + (need - G.state.tickets) + '장 모자라다');
      openTicketPop();
      return;
    }
    G.state.tickets -= need;
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
  }

  function setIdleUI(on) {
    if (elIdleVeil) elIdleVeil.classList.toggle('hidden', !on);
  }

  function syncOptions() {
    document.getElementById('optFx').checked = G.state.opt.fx;
    document.getElementById('optSnapHint').checked = G.state.opt.snapHint;
  }

  return {
    init: init, tick: tick, toast: toast, floatMoney: floatMoney, pulseGauge: pulseGauge,
    closePopovers: closePopovers, showWordPop: showWordPop,
    renderCodex: renderCodex, toggleCodex: toggleCodex,
    setPausedUI: setPausedUI, setIdleUI: setIdleUI,
    hideIntro: hideIntro, showIntro: showIntro,
    syncOptions: syncOptions, hideChip: hideChip
  };
})();
