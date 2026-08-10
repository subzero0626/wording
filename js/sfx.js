/* ==========================================================================
   sfx.js — 짧은 나무 도막 소리 (Web Audio, 파일 없이 합성)
   글자를 집고 · 붙이고 · 내려놓을 때 가볍게만 울린다.
   ========================================================================== */
var G = window.G || (window.G = {});

G.sfx = (function () {
  var ctx = null, master = null;
  var enabled = true;
  var lastAt = 0;

  function ensure() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.42;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') {
      try { ctx.resume(); } catch (e) { /* ignore */ }
    }
    return true;
  }

  /** 첫 터치에서 오디오를 깨운다 (브라우저 자동재생 정책) */
  function unlock() { ensure(); }

  function setEnabled(v) { enabled = !!v; }

  function noiseBuf(sec) {
    var n = Math.max(1, Math.floor(ctx.sampleRate * sec));
    var buf = ctx.createBuffer(1, n, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  /**
   * 나무끼리 부딪히는 짧은 소리.
   * 낮은 도막 울림 + 높은 표면 탁 소리.
   */
  function knock(o) {
    if (!enabled) return;
    if (!ensure()) return;
    o = o || {};
    var now = ctx.currentTime;
    /* 너무 잦으면 뭉개지므로 아주 짧은 간격만 막는다 */
    if (now - lastAt < 0.018) return;
    lastAt = now;

    var pitch = (o.pitch || 1) * (0.94 + Math.random() * 0.12);
    var vol = o.vol == null ? 1 : o.vol;
    var t0 = now + (o.delay || 0);

    /* 도막 몸통 — 짧고 둔한 울림 */
    var osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(210 * pitch, t0);
    osc.frequency.exponentialRampToValueAtTime(72 * pitch, t0 + 0.09);
    var og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t0);
    og.gain.exponentialRampToValueAtTime(0.38 * vol, t0 + 0.003);
    og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.11);
    osc.connect(og);
    og.connect(master);
    osc.start(t0);
    osc.stop(t0 + 0.13);

    /* 표면 탁 — 짧은 노이즈 */
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf(0.04);
    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1550 * pitch;
    bp.Q.value = 1.35;
    var hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 400;
    var ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t0);
    ng.gain.exponentialRampToValueAtTime(0.5 * vol, t0 + 0.0015);
    ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.038);
    src.connect(hp);
    hp.connect(bp);
    bp.connect(ng);
    ng.connect(master);
    src.start(t0);
    src.stop(t0 + 0.045);
  }

  function tap() { knock({ pitch: 1.35, vol: 0.32 }); }
  function land() { knock({ pitch: 0.98, vol: 0.48 }); }
  function merge() { knock({ pitch: 1.12, vol: 0.62 }); }
  function word() {
    knock({ pitch: 0.82, vol: 0.72 });
    knock({ pitch: 1.05, vol: 0.4, delay: 0.045 });
  }
  function box() { knock({ pitch: 0.62, vol: 0.55 }); }
  function breakApart() {
    knock({ pitch: 1.4, vol: 0.4 });
    knock({ pitch: 0.9, vol: 0.28, delay: 0.03 });
  }
  function soft() { knock({ pitch: 1.2, vol: 0.22 }); }

  return {
    setEnabled: setEnabled,
    unlock: unlock,
    tap: tap,
    land: land,
    merge: merge,
    word: word,
    box: box,
    crack: breakApart,
    soft: soft
  };
})();
