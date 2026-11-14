/* =========================================================================
   破界 · 打砖块  ——  音频引擎（WebAudio 实时合成，零素材）
   ========================================================================= */
(function (P) {
  'use strict';

  const Audio = {
    ctx: null,
    master: null,
    muted: false,
    volume: 0.55,

    init() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC(); } catch (e) { return; }
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 22; comp.ratio.value = 8;
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
    },

    resume() {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    },

    setVolume(v) {
      this.volume = v;
      if (this.master) this.master.gain.value = this.muted ? 0 : v;
    },

    setMuted(m) {
      this.muted = m;
      if (this.master) this.master.gain.value = m ? 0 : this.volume;
    },

    /** 单音 */
    tone(o) {
      if (this.muted || !this.ctx) return;
      const t0 = this.ctx.currentTime + (o.delay || 0);
      const dur = o.dur || 0.12;
      const vol = o.vol == null ? 0.2 : o.vol;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = o.type || 'square';
      osc.frequency.setValueAtTime(o.freq || 440, t0);
      if (o.slide) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(30, (o.freq || 440) + o.slide), t0 + dur);
      }
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g); g.connect(this.master);
      osc.start(t0); osc.stop(t0 + dur + 0.03);
    },

    /** 噪声（打击、爆炸） */
    noise(o) {
      if (this.muted || !this.ctx) return;
      const t0 = this.ctx.currentTime + (o.delay || 0);
      const dur = o.dur || 0.2;
      const vol = o.vol == null ? 0.2 : o.vol;
      const n = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const biq = this.ctx.createBiquadFilter();
      biq.type = 'bandpass'; biq.Q.value = 1.1;
      biq.frequency.setValueAtTime(o.filt || 1400, t0);
      if (o.sweepTo) biq.frequency.exponentialRampToValueAtTime(Math.max(40, o.sweepTo), t0 + dur);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(biq); biq.connect(g); g.connect(this.master);
      src.start(t0); src.stop(t0 + dur + 0.03);
    },

    // ---------------- 具体音效 ----------------
    brick(combo) {
      const base = 330 * Math.pow(1.0595, Math.min(combo, 14));
      this.tone({ freq: base, dur: 0.07, type: 'triangle', vol: 0.22 });
      this.tone({ freq: base * 2, dur: 0.05, type: 'square', vol: 0.07, delay: 0.02 });
      this.noise({ dur: 0.09, vol: 0.10, filt: 2600, sweepTo: 700 });
    },
    crack() { this.tone({ freq: 560, dur: 0.05, type: 'square', vol: 0.1 }); },
    paddle(rel) { this.tone({ freq: 300 + rel * 160, dur: 0.05, type: 'square', vol: 0.16 }); },
    wall() { this.tone({ freq: 180, dur: 0.05, type: 'sine', vol: 0.14 }); },
    power() {
      [0, 0.07, 0.14].forEach((d, i) =>
        this.tone({ freq: 440 * Math.pow(1.26, i), dur: 0.1, type: 'triangle', vol: 0.2, delay: d }));
    },
    laser() { this.tone({ freq: 1400, dur: 0.05, type: 'sawtooth', vol: 0.07, slide: -900 }); },
    bossHit() {
      this.noise({ dur: 0.16, vol: 0.2, filt: 900, sweepTo: 180 });
      this.tone({ freq: 90, dur: 0.16, type: 'sawtooth', vol: 0.16, slide: -40 });
    },
    bossDie() {
      this.noise({ dur: 0.7, vol: 0.3, filt: 1800, sweepTo: 90 });
      [0, 0.1, 0.2, 0.32].forEach((d, i) =>
        this.tone({ freq: 520 / (i + 1), dur: 0.3, type: 'sawtooth', vol: 0.18, delay: d }));
    },
    die() {
      [0, 0.13, 0.26, 0.42].forEach((d, i) =>
        this.tone({ freq: 420 / (i + 1), dur: 0.3, type: 'triangle', vol: 0.22, delay: d }));
    },
    levelUp() {
      [0, 0.09, 0.18, 0.3].forEach((d, i) =>
        this.tone({ freq: 392 * Math.pow(1.26, i), dur: 0.16, type: 'triangle', vol: 0.18, delay: d }));
    },
    win() {
      [523, 659, 784, 1047, 1319].forEach((f, i) =>
        this.tone({ freq: f, dur: 0.35, type: 'triangle', vol: 0.2, delay: i * 0.14 }));
    },
    unlock() {
      [659, 880, 1175].forEach((f, i) =>
        this.tone({ freq: f, dur: 0.25, type: 'triangle', vol: 0.18, delay: i * 0.1 }));
    },
    ui() { this.tone({ freq: 620, dur: 0.05, type: 'square', vol: 0.09 }); }
  };

  P.audio = Audio;
})(window.POJIE = window.POJIE || {});
