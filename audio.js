// Procedural WebAudio: ambience, positional SFX, and layered dynamic music.
export class AudioSys {
  constructor() { this.ok = false; this.intensity = 0; this.targetIntensity = 0; this.beatT = 0; this.duck = 1; this.duckT = 0; }
  init() {
    if (this.ok) return;
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = ctx.createGain(); this.master.gain.value = 0.9;
    this.muffle = ctx.createBiquadFilter(); this.muffle.type = 'lowpass'; this.muffle.frequency.value = 20000;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(this.muffle).connect(comp).connect(ctx.destination);
    this.sfxBus = ctx.createGain(); this.sfxBus.connect(this.master);
    this.ambBus = ctx.createGain(); this.ambBus.connect(this.master);
    this.musBus = ctx.createGain(); this.musBus.gain.value = 0.55; this.musBus.connect(this.master);
    // shared echo for gunshots / big impacts
    this.echo = ctx.createDelay(1.5); this.echo.delayTime.value = 0.23;
    const fb = ctx.createGain(); fb.gain.value = 0.38; const elp = ctx.createBiquadFilter(); elp.type = 'lowpass'; elp.frequency.value = 1600;
    this.echoIn = ctx.createGain(); this.echoIn.gain.value = 0.5;
    this.echoIn.connect(this.echo); this.echo.connect(elp).connect(fb).connect(this.echo); elp.connect(this.sfxBus);
    // noise
    const len = ctx.sampleRate * 2; const buf = ctx.createBuffer(1, len, ctx.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; this.noise = buf;
    const bl = ctx.createBuffer(1, len, ctx.sampleRate); const b = bl.getChannelData(0); let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = last * 3.5; } this.brown = bl;
    // rain bed
    this.rainG = ctx.createGain(); this.rainG.gain.value = 0;
    // Keep continuous rain beneath dialogue and music; thunder uses the separate SFX bus.
    this.rainTrim = ctx.createGain(); this.rainTrim.gain.value = 0.4;
    const rn = this.loopNoise(this.noise); const rbp = ctx.createBiquadFilter(); rbp.type = 'bandpass'; rbp.frequency.value = 2400; rbp.Q.value = 0.4;
    this.rainLP = ctx.createBiquadFilter(); this.rainLP.type = 'lowpass'; this.rainLP.frequency.value = 9000;
    rn.connect(rbp).connect(this.rainLP).connect(this.rainG).connect(this.rainTrim).connect(this.ambBus);
    const rum = this.loopNoise(this.brown); const rg = ctx.createGain(); rg.gain.value = 0.35; rum.connect(rg).connect(this.rainLP);
    // building creaks / wind bed
    this.windG = ctx.createGain(); this.windG.gain.value = 0.05; const wn = this.loopNoise(this.brown); const wlp = ctx.createBiquadFilter(); wlp.type = 'lowpass'; wlp.frequency.value = 400; wn.connect(wlp).connect(this.windG).connect(this.ambBus);
    // music layers
    this.layers = {};
    const mk = (name) => { const g = ctx.createGain(); g.gain.value = 0; g.connect(this.musBus); this.layers[name] = g; return g; };
    const drone = mk('drone'); const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 220; dlp.connect(drone);
    for (const f of [41.2, 41.5, 61.7]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; const g = ctx.createGain(); g.gain.value = 0.25; o.connect(g).connect(dlp); o.start(); }
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lg = ctx.createGain(); lg.gain.value = 90; lfo.connect(lg).connect(dlp.frequency); lfo.start();
    const strings = mk('strings'); const ws = ctx.createWaveShaper(); ws.curve = this.distCurve(18); const slp = ctx.createBiquadFilter(); slp.type = 'lowpass'; slp.frequency.value = 1600;
    const trem = ctx.createGain(); trem.gain.value = 0.5; const tl = ctx.createOscillator(); tl.frequency.value = 9; const tlg = ctx.createGain(); tlg.gain.value = 0.45; tl.connect(tlg).connect(trem.gain); tl.start();
    for (const f of [110, 116.54, 155.56, 164.81, 233.08]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = (Math.random() - 0.5) * 20; const g = ctx.createGain(); g.gain.value = 0.08; o.connect(g).connect(ws); o.start(); }
    ws.connect(slp).connect(trem).connect(strings);
    mk('pulse'); mk('escape');
    this.ok = true;
  }
  // Original title motif: sparse detuned bells over the existing low drone.
  updateMenu(dt, active) {
    if (!this.ok) return;
    if (!this.menuBus) { this.menuBus = this.ctx.createGain(); this.menuBus.gain.value = 0; this.menuBus.connect(this.musBus); this.menuBeat = 0; this.menuNote = 0; }
    const t = this.now();
    this.menuBus.gain.setTargetAtTime(active ? 0.65 : 0, t, active ? 2 : 0.7);
    if (!active) { this.menuBeat = 0; return; }
    this.layers.drone.gain.setTargetAtTime(0.15, t, 2);
    this.rainG.gain.setTargetAtTime(0.18, t, 1);
    this.rainTrim.gain.setTargetAtTime(0.4, t, 0.7);
    this.menuBeat -= dt;
    if (this.menuBeat <= 0) {
      const notes = [164.81, 246.94, 174.61, 220, 164.81, 130.81, 185, 123.47];
      const f = notes[this.menuNote++ % notes.length];
      this.tone(this.menuBus, { f, dur: 5.5, gain: 0.15, attack: 0.035 });
      this.tone(this.menuBus, { f: f * 2.002, dur: 3.8, gain: 0.025, attack: 0.02 });
      this.tone(this.menuBus, { t: 0.48, f: f * 0.999, dur: 4.5, gain: 0.045, attack: 0.12 });
      this.menuBeat = this.menuNote % 4 === 0 ? 4.8 : 2.8;
    }
  }
  distCurve(k) { const n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / n * 2 - 1; c[i] = (1 + k) * x / (1 + k * Math.abs(x)); } return c; }
  loopNoise(buf) { const s = this.ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.loopStart = Math.random(); s.start(0, Math.random()); return s; }
  now() { return this.ctx.currentTime; }

  setListener(cam) {
    if (!this.ok) return; const L = this.ctx.listener; const p = cam.position; const f = cam.getWorldDirection(this._v || (this._v = cam.position.clone()));
    if (L.positionX) { L.positionX.value = p.x; L.positionY.value = p.y; L.positionZ.value = p.z; L.forwardX.value = f.x; L.forwardY.value = f.y; L.forwardZ.value = f.z; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; }
    else { L.setPosition(p.x, p.y, p.z); L.setOrientation(f.x, f.y, f.z, 0, 1, 0); }
  }
  // output node for an SFX: positional or direct
  out(pos, vol = 1, echo = 0) {
    const g = this.ctx.createGain(); g.gain.value = vol;
    if (pos) {
      const p = this.ctx.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 2; p.rolloffFactor = 1.3; p.maxDistance = 80;
      if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y ?? 1; p.positionZ.value = pos.z; } else p.setPosition(pos.x, pos.y ?? 1, pos.z);
      g.connect(p).connect(this.sfxBus); if (echo) { const e = this.ctx.createGain(); e.gain.value = echo; p.connect(e).connect(this.echoIn); }
    } else { g.connect(this.sfxBus); if (echo) { const e = this.ctx.createGain(); e.gain.value = echo; g.connect(e).connect(this.echoIn); } }
    return g;
  }
  burst(dest, { t = 0, dur = 0.1, type = 'bandpass', f = 1000, q = 1, gain = 1, attack = 0.002, curve = 'exp', buf } = {}) {
    const ctx = this.ctx, s = ctx.createBufferSource(); s.buffer = buf || this.noise; const flt = ctx.createBiquadFilter(); flt.type = type; flt.frequency.value = f; flt.Q.value = q;
    const g = ctx.createGain(); const t0 = this.now() + t; g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(gain, t0 + attack);
    if (curve === 'exp') g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); else g.gain.linearRampToValueAtTime(0, t0 + dur);
    s.connect(flt).connect(g).connect(dest); s.start(t0, Math.random() * 1.5); s.stop(t0 + dur + 0.05); return flt;
  }
  tone(dest, { t = 0, dur = 0.2, type = 'sine', f = 440, f2, gain = 0.5, attack = 0.003 } = {}) {
    const ctx = this.ctx, o = ctx.createOscillator(); o.type = type; const t0 = this.now() + t; o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur); const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(gain, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(dest); o.start(t0); o.stop(t0 + dur + 0.05); return o;
  }

  // ------------------------------------------------------------ SFX
  step(mat, vol, pos) {
    if (!this.ok) return; const o = this.out(pos, vol);
    switch (mat) {
      case 'c': this.burst(o, { dur: 0.09, type: 'lowpass', f: 500, gain: 0.35 }); break;
      case 'w': this.burst(o, { dur: 0.12, f: 900, q: 0.8, gain: 0.5 }); this.burst(o, { t: 0.02, dur: 0.15, type: 'highpass', f: 3500, gain: 0.25 }); break;
      case 'm': this.burst(o, { dur: 0.08, f: 1200, gain: 0.5 }); for (const f of [410, 1130, 1720]) this.tone(o, { f, dur: 0.35, gain: 0.08 }); break;
      case 'g': for (let i = 0; i < 5; i++) this.burst(o, { t: i * 0.018 + Math.random() * 0.02, dur: 0.05, type: 'highpass', f: 4000 + Math.random() * 3000, gain: 0.7 }); for (let i = 0; i < 3; i++) this.tone(o, { t: Math.random() * 0.06, f: 3000 + Math.random() * 4000, dur: 0.1, gain: 0.05 }); break;
      case 'f': this.burst(o, { dur: 0.18, type: 'lowpass', f: 380, gain: 0.7 }); this.burst(o, { t: 0.04, dur: 0.12, f: 700, q: 4, gain: 0.3 }); break;
      case 'k': this.burst(o, { dur: 0.1, f: 600, gain: 0.5 }); break;
      default: this.burst(o, { dur: 0.08, f: 1400, q: 0.9, gain: 0.45 }); this.burst(o, { dur: 0.05, type: 'lowpass', f: 250, gain: 0.3 });
    }
  }
  gunshot(pos) {
    if (!this.ok) return; const o = this.out(pos, 1.3, 0.9);
    this.burst(o, { dur: 0.28, type: 'highpass', f: 900, gain: 1.2, attack: 0.001 });
    this.burst(o, { dur: 0.5, type: 'lowpass', f: 400, gain: 1.4, attack: 0.001, buf: this.brown });
    this.tone(o, { f: 140, f2: 38, dur: 0.35, gain: 1.1 });
  }
  ricochet(pos) {
    if (!this.ok) return; const o = this.out(pos, 0.35, 0.2);
    this.burst(o, { dur: 0.035, type: 'highpass', f: 3600, gain: 0.3 });
    this.tone(o, { f: 2600, f2: 740, dur: 0.17, gain: 0.12 });
    this.tone(o, { t: 0.018, f: 4100, f2: 1200, dur: 0.11, gain: 0.04 });
  }
  dryfire() { if (!this.ok) return; const o = this.out(null, 0.6); this.burst(o, { dur: 0.03, type: 'highpass', f: 3000, gain: 0.8 }); this.tone(o, { f: 2200, dur: 0.04, gain: 0.1 }); }
  casing(pos) { if (!this.ok) return; const o = this.out(pos, 0.5); [0.35, 0.52, 0.62, 0.68].forEach((t, i) => { this.tone(o, { t, f: 4200 - i * 300, dur: 0.12, gain: 0.12 / (i + 1) }); this.tone(o, { t, f: 6100, dur: 0.06, gain: 0.05 }); }); }
  reload(pos) { if (!this.ok) return; const o = this.out(pos, 0.8); [0, 0.35, 0.6, 0.95].forEach((t, i) => { this.burst(o, { t, dur: 0.04, type: 'highpass', f: 2500, gain: 0.8 }); this.tone(o, { t, f: 900 + i * 300, dur: 0.07, gain: 0.15 }); }); }
  click(pos, n = 3, vol = 1) { // knocker clicking
    if (!this.ok) return; const o = this.out(pos, vol, 0.42);
    for (let i = 0; i < n; i++) {
      const t = i * (0.065 + Math.random() * 0.025), f = 1150 + Math.random() * 450;
      this.burst(o, { t, dur: 0.018, f: 2900, q: 3, gain: 0.85, attack: 0.0005 });
      this.tone(o, { t, f, f2: f * 0.72, dur: 0.095, gain: 0.24 });
      // Two restrained reflections give the snap a hollow, room-sized tail.
      this.tone(o, { t: t + 0.105, f: f * 0.96, f2: f * 0.72, dur: 0.08, gain: 0.07 });
      this.tone(o, { t: t + 0.22, f: f * 0.94, f2: f * 0.7, dur: 0.09, gain: 0.028 });
    }
    this.tone(o, { t: n * 0.045, f: 520, f2: 170, dur: 0.13, gain: 0.08 });
    this.burst(o, { t: n * 0.07, dur: 0.25, type: 'lowpass', f: 300, gain: 0.25, buf: this.brown }); // throaty gurgle
  }
  scream(pos, kind = 'frenzied', vol = 1) {
    if (!this.ok) return; const o = this.out(pos, vol, 0.3); const ctx = this.ctx; const t0 = this.now();
    const base = kind === 'lurker' ? 210 : kind.includes('knock') ? 150 : 330;
    const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.setValueAtTime(base * 1.3, t0); osc.frequency.exponentialRampToValueAtTime(base * 0.6, t0 + 0.7);
    const vib = ctx.createOscillator(); vib.frequency.value = 23; const vg = ctx.createGain(); vg.gain.value = base * 0.08; vib.connect(vg).connect(osc.frequency);
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 950; f1.Q.value = 3; const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.5, t0 + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.8);
    osc.connect(f1).connect(g).connect(o); osc.start(t0); vib.start(t0); osc.stop(t0 + 0.85); vib.stop(t0 + 0.85);
    this.burst(o, { dur: 0.7, f: 1800, q: 1, gain: 0.35 });
  }
  growl(pos, vol = 0.6) { if (!this.ok) return; const o = this.out(pos, vol); this.tone(o, { type: 'sawtooth', f: 75 + Math.random() * 20, f2: 55, dur: 0.6, gain: 0.25 }); this.burst(o, { dur: 0.5, type: 'lowpass', f: 500, gain: 0.3, buf: this.brown }); }
  breath(vol = 0.3) { if (!this.ok) return; const o = this.out(null, vol); this.burst(o, { dur: 0.45, f: 1100, q: 0.7, gain: 0.3, attack: 0.15, curve: 'lin' }); }
  hurt() { if (!this.ok) return; const o = this.out(null, 0.8); this.tone(o, { type: 'triangle', f: 380, f2: 220, dur: 0.25, gain: 0.3 }); this.burst(o, { dur: 0.3, f: 900, gain: 0.3 }); this.tone(o, { f: 60, f2: 40, dur: 0.3, gain: 0.8 }); }
  stab(pos) { if (!this.ok) return; const o = this.out(pos, 0.9); this.burst(o, { dur: 0.08, type: 'highpass', f: 2000, gain: 0.5 }); this.burst(o, { t: 0.03, dur: 0.15, type: 'lowpass', f: 300, gain: 0.9 }); this.tone(o, { t: 0.03, f: 90, f2: 50, dur: 0.15, gain: 0.6 }); }
  swoosh() { if (!this.ok) return; const o = this.out(null, 0.5); this.burst(o, { dur: 0.18, f: 1400, q: 0.6, gain: 0.5, attack: 0.05 }); }
  door(pos, loud = true) { if (!this.ok) return; const o = this.out(pos, loud ? 1 : 0.5, 0.3); const ctx = this.ctx, t0 = this.now();
    const s = ctx.createOscillator(); s.type = 'sawtooth'; s.frequency.setValueAtTime(140, t0); s.frequency.linearRampToValueAtTime(260, t0 + 0.6); s.frequency.linearRampToValueAtTime(190, t0 + 0.9);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 18; const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.7, t0 + 0.1); g.gain.linearRampToValueAtTime(0.0001, t0 + 1);
    s.connect(bp).connect(g).connect(o); s.start(t0); s.stop(t0 + 1.05);
    if (loud) { this.tone(o, { t: 0.9, f: 220, dur: 0.8, gain: 0.3 }); this.tone(o, { t: 0.9, f: 587, dur: 0.6, gain: 0.12 }); this.burst(o, { t: 0.9, dur: 0.2, type: 'lowpass', f: 300, gain: 0.8 }); } }
  smash(pos) { if (!this.ok) return; const o = this.out(pos, 1.1, 0.5); this.burst(o, { dur: 0.35, type: 'highpass', f: 3000, gain: 1 }); for (let i = 0; i < 9; i++) this.tone(o, { t: Math.random() * 0.25, f: 2500 + Math.random() * 5000, dur: 0.15, gain: 0.1 }); }
  thud(pos) { if (!this.ok) return; const o = this.out(pos, 1, 0.4); this.burst(o, { dur: 0.25, type: 'lowpass', f: 350, gain: 1.2 }); this.tone(o, { f: 110, f2: 60, dur: 0.2, gain: 0.6 }); }
  crack(pos) { if (!this.ok) return; const o = this.out(pos, 1.4, 0.5); this.burst(o, { dur: 0.12, type: 'highpass', f: 1500, gain: 1.3, attack: 0.0005 }); this.burst(o, { t: 0.02, dur: 0.9, type: 'lowpass', f: 200, gain: 1.2, buf: this.brown }); for (let i = 0; i < 6; i++) this.burst(o, { t: 0.1 + i * 0.07 + Math.random() * 0.05, dur: 0.04, f: 800 + Math.random() * 1500, q: 3, gain: 0.5 }); }
  thunder(dist = 1) { if (!this.ok) return; const o = this.out(null, 0.9 * dist); this.burst(o, { dur: 3.5, type: 'lowpass', f: 160, gain: 1.4, attack: 0.3, buf: this.brown }); this.burst(o, { t: 0.2, dur: 1.2, type: 'lowpass', f: 600, gain: 0.5, buf: this.brown }); }
  vent(pos) { if (!this.ok) return; const o = this.out(pos, 0.9); for (let i = 0; i < 7; i++) { const t = i * 0.09 + Math.random() * 0.04; this.burst(o, { t, dur: 0.05, f: 1500, q: 2, gain: 0.6 }); this.tone(o, { t, f: 620 + Math.random() * 200, dur: 0.15, gain: 0.08 }); } }
  scrape(pos, dur = 1.2) { if (!this.ok) return; const o = this.out(pos, 0.7); for (let i = 0; i < 6; i++) this.burst(o, { t: i * dur / 6, dur: dur / 5, f: 500 + Math.random() * 400, q: 2, gain: 0.5, attack: 0.05, curve: 'lin' }); }
  tear(pos) { if (!this.ok) return; const o = this.out(pos, 1.5, 0.6); this.burst(o, { dur: 2.5, type: 'lowpass', f: 700, gain: 1.4, attack: 0.1, buf: this.brown }); for (let i = 0; i < 14; i++) this.burst(o, { t: Math.random() * 1.8, dur: 0.15, f: 250 + Math.random() * 500, q: 5, gain: 0.8 }); this.tone(o, { f: 55, f2: 30, dur: 2, gain: 0.9 }); }
  pickup() { if (!this.ok) return; const o = this.out(null, 0.4); this.burst(o, { dur: 0.15, f: 2500, q: 0.6, gain: 0.4, attack: 0.03 }); }
  roll(pos) { if (!this.ok) return; const o = this.out(pos, 0.6); for (let i = 0; i < 10; i++) this.tone(o, { t: i * 0.11, f: 900 + Math.random() * 300, dur: 0.1, gain: 0.07 }); }
  heartbeat(vol) { if (!this.ok) return; const o = this.out(null, vol); this.tone(o, { f: 55, f2: 40, dur: 0.15, gain: 0.8 }); this.tone(o, { t: 0.2, f: 50, f2: 38, dur: 0.15, gain: 0.5 }); }
  debris(pos) { if (!this.ok) return; const o = this.out(pos, 1.2, 0.5); this.burst(o, { dur: 0.6, type: 'lowpass', f: 450, gain: 1.2, buf: this.brown }); for (let i = 0; i < 8; i++) this.burst(o, { t: 0.05 + Math.random() * 0.5, dur: 0.06, f: 700 + Math.random() * 1200, q: 2, gain: 0.5 }); }

  // ------------------------------------------------------------ per-frame mix
  // intensity: 0 ambient, 1 drone, 2 pulse, 3 combat, 4 escape
  update(dt, { target, indoor, listen, outsideProx }) {
    if (!this.ok) return;
    const up = target > this.intensity; this.intensity += (target - this.intensity) * Math.min(1, dt * (up ? 1.2 : 0.12));
    if (this.duckT > 0) { this.duckT -= dt; this.duck += (0 - this.duck) * Math.min(1, dt * 10); } else this.duck += (1 - this.duck) * Math.min(1, dt * 0.5);
    const I = this.intensity, t = this.now(), k = this.duck;
    const set = (g, v) => g.gain.setTargetAtTime(v, t, 0.3);
    set(this.layers.drone, Math.min(1, Math.max(0, I - 0.2)) * 0.35 * k);
    set(this.layers.strings, Math.max(0, Math.min(1, I - 2.2)) * 0.35 * k);
    set(this.rainTrim, 0.65);
    set(this.rainG, (indoor ? 0.07 + outsideProx * 0.2 : 0.55) * (0.3 + 0.7 * k));
    this.rainLP.frequency.setTargetAtTime(indoor ? 900 : 9000, t, 0.4);
    set(this.windG, 0.05 * k + (indoor ? 0.04 : 0));
    this.muffle.frequency.setTargetAtTime(listen ? 900 : 20000, t, 0.12);
    // percussive pulse
    if (I > 1.4 && k > 0.3) {
      this.beatT -= dt; const bpm = I > 3.5 ? 150 : I > 2.5 ? 118 : 84;
      if (this.beatT <= 0) {
        this.beatT += 60 / bpm; const o = this.layers.pulse; set(o, Math.min(1, I - 1.4) * 0.8 * k);
        this.tone(o, { f: 70, f2: 38, dur: 0.25, gain: 0.8 }); if (I > 2.5) this.burst(o, { t: 30 / bpm, dur: 0.05, type: 'highpass', f: 5000, gain: 0.25 });
        if (I > 3.5) { this.burst(o, { t: 15 / bpm, dur: 0.08, f: 300, q: 2, gain: 0.5 }); this.tone(o, { t: 0.01, type: 'sawtooth', f: 55, dur: 0.2, gain: 0.12 }); }
      }
    } else this.beatT = 0;
  }
  // looping sources that die after `dur` seconds
  loopFor(pos, dur, vol, build) { if (!this.ok) return null; const o = this.out(pos, vol); const t0 = this.now(); const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(1, t0 + 0.3); g.gain.setValueAtTime(1, t0 + Math.max(0.4, dur - 0.8)); g.gain.linearRampToValueAtTime(0.0001, t0 + dur); g.connect(o); const stops = build(g, t0); for (const s of stops) s.stop(t0 + dur + 0.1); return { g, stops }; }
  fire(pos, dur = 5) { return this.loopFor(pos, dur, 0.9, (g) => { const n = this.loopNoise(this.brown); const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; n.connect(lp).connect(g);
    const c = this.loopNoise(this.noise); const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = 2; const cg = this.ctx.createGain(); cg.gain.value = 0.25; const lfo = this.ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 13; const lg = this.ctx.createGain(); lg.gain.value = 0.25; lfo.connect(lg).connect(cg.gain); lfo.start(); c.connect(bp).connect(cg).connect(g); return [n, c, lfo]; }); }
  engine(pos, dur = 14) { this.stopEngine(); this._engine = this.loopFor(pos, dur, 1.1, (g) => { const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 38; const o2 = this.ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 76.5; const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320; const am = this.ctx.createGain(); am.gain.value = 0.5; const lfo = this.ctx.createOscillator(); lfo.frequency.value = 9.5; const lg = this.ctx.createGain(); lg.gain.value = 0.35; lfo.connect(lg).connect(am.gain); o.connect(lp); o2.connect(lp); lp.connect(am).connect(g); for (const x of [o, o2, lfo]) x.start(); const n = this.loopNoise(this.brown); const ng = this.ctx.createGain(); ng.gain.value = 0.3; n.connect(ng).connect(g); return [o, o2, lfo, n]; }); }
  stopEngine() { if (this._engine) { try { this._engine.g.gain.cancelScheduledValues(this.now()); this._engine.g.gain.setTargetAtTime(0.0001, this.now(), 0.1); for (const s of this._engine.stops) s.stop(this.now() + 0.5); } catch {} this._engine = null; } }
  pullcord(pos) { if (!this.ok) return; const o = this.out(pos, 0.9); this.burst(o, { dur: 0.35, f: 1200, q: 1.5, gain: 0.7, attack: 0.02 }); this.tone(o, { type: 'sawtooth', f: 60, f2: 30, dur: 0.4, gain: 0.3 }); this.burst(o, { t: 0.3, dur: 0.15, type: 'lowpass', f: 300, gain: 0.6 }); }
  creak(pos) { if (!this.ok) return; const o = this.out(pos, 0.6); this.tone(o, { type: 'sawtooth', f: 90 + Math.random() * 40, f2: 140, dur: 0.35, gain: 0.08 }); this.burst(o, { dur: 0.3, f: 500, q: 8, gain: 0.25, attack: 0.05 }); }
  silence(sec) { this.duckT = sec; }
}

// ------------------------------------------------------------ recorded sample bank (assets/sfx, built by tools/build_sfx.sh)
// Recorded sounds take priority; the procedural versions above remain as fallbacks and texture layers.
const proc = {};
for (const k of ['step', 'smash', 'thud', 'door', 'stab', 'reload', 'pickup', 'debris', 'thunder', 'creak', 'heartbeat', 'update', 'init', 'engine']) proc[k] = AudioSys.prototype[k];
Object.assign(AudioSys.prototype, {
  init() { proc.init.call(this); if (!this.bankP) this.bankP = this.loadBank(); },
  async loadBank() {
    let groups; try { groups = await (await fetch('assets/sfx/sfx.json')).json(); } catch { return; }
    const bank = {};
    await Promise.all(Object.entries(groups).map(async ([g, files]) => {
      bank[g] = (await Promise.all(files.map(f => fetch(f).then(r => r.arrayBuffer()).then(b => this.ctx.decodeAudioData(b)).catch(() => null)))).filter(Boolean);
    }));
    this.bank = bank;
    const loop = (g, dest, vol) => { const b = bank[g]?.[0]; if (!b) return null; const s = this.ctx.createBufferSource(); s.buffer = b; s.loop = true; const v = this.ctx.createGain(); v.gain.value = vol; s.connect(v).connect(dest); s.start(0, Math.random() * b.duration); return v; };
    loop('amb_rain', this.rainLP, 1.6); loop('amb_wind', this.windG, 2.2); loop('amb_storm', this.rainLP, 0.9);
    this.roomG = this.ctx.createGain(); this.roomG.gain.value = 0; this.roomG.connect(this.ambBus); loop('amb_room', this.roomG, 1);
    this.bedG = this.ctx.createGain(); this.bedG.gain.value = 0; this.bedG.connect(this.musBus); loop('bed_dark', this.bedG, 1); // dread bed under the synth drone
    this.deepG = this.ctx.createGain(); this.deepG.gain.value = 0; this.deepG.connect(this.ambBus);
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.connect(this.deepG);
    for (const [i, b] of (bank.drone_deep || []).entries()) { const s = this.ctx.createBufferSource(); s.buffer = b; s.loop = true; s.playbackRate.value = i ? 0.62 : 0.8; const v = this.ctx.createGain(); v.gain.value = 0.5; s.connect(v).connect(lp); s.start(0, Math.random() * b.duration); }
  },
  sample(group, pos, vol = 1, { rate = 1, echo = 0, t = 0, jitter = 0.06 } = {}) {
    const list = this.ok && this.bank?.[group]; if (!list?.length) return false;
    const s = this.ctx.createBufferSource(); s.buffer = list[(Math.random() * list.length) | 0];
    s.playbackRate.value = rate * (1 + (Math.random() * 2 - 1) * jitter); s.connect(this.out(pos, vol, echo)); s.start(this.now() + t); return true;
  },
  step(mat, vol, pos) {
    const g = { c: 'step_carpet', m: 'step_metal', g: 'step_glass', f: 'step_fungus', P: 'step_wood' }[mat] || 'step_concrete';
    if (!this.sample(g, pos, vol * 1.3)) return proc.step.call(this, mat, vol, pos);
    if (mat === 'w') { const o = this.out(pos, vol * 0.6); this.burst(o, { t: 0.01, dur: 0.15, type: 'highpass', f: 3200, gain: 0.35 }); }
    if (mat === 'g') this.sample('step_glass', pos, vol, { t: 0.035, rate: 1.25 });
    if (mat === 'f') proc.step.call(this, 'f', vol * 0.6, pos);
  },
  smash(pos) { if (this.sample('smash', pos, 1.3, { echo: 0.4 })) { const o = this.out(pos, 0.5); for (let i = 0; i < 5; i++) this.tone(o, { t: 0.05 + Math.random() * 0.3, f: 2500 + Math.random() * 4000, dur: 0.12, gain: 0.06 }); } else proc.smash.call(this, pos); },
  thud(pos) { if (!this.sample('thud', pos, 1.2, { echo: 0.3 })) proc.thud.call(this, pos); },
  door(pos, loud = true) { this.sample('door_open', pos, loud ? 1.1 : 0.7); proc.door.call(this, pos, loud); },
  stab(pos) { if (this.sample('slice', pos, 1)) this.sample('hit_soft', pos, 0.9, { t: 0.03 }); else proc.stab.call(this, pos); },
  reload(pos) { if (this.sample('gun_click', pos, 0.9)) { this.sample('gun_latch', pos, 0.9, { t: 0.45 }); this.sample('gun_click', pos, 0.8, { t: 1.05, rate: 1.2 }); } else proc.reload.call(this, pos); },
  pickup() { if (!this.sample('cloth', null, 0.7)) proc.pickup.call(this); },
  debris(pos) { this.sample('debris', pos, 1.2, { echo: 0.4 }); proc.debris.call(this, pos); },
  thunder(dist = 1) { if (!this.sample('thunder', null, 1.1 * dist, { rate: 0.9, jitter: 0.1 })) proc.thunder.call(this, dist); },
  creak(pos) { if (!this.sample('creak', pos, 0.8)) proc.creak.call(this, pos); },
  heartbeat(vol) { if (!this.sample('heartbeat', null, vol * 1.4, { jitter: 0 })) proc.heartbeat.call(this, vol); },
  // weapon foley
  draw(pos) { this.sample('draw', pos, 0.8); },
  swingHit(kind, pos) { // blade = slice + chop, blunt = punch impacts
    if (kind === 'blade') { this.sample('chop', pos, 1, { echo: 0.15 }); this.sample('hit_soft', pos, 0.8, { t: 0.02 }); }
    else { this.sample('hit_blunt', pos, 1.2, { echo: 0.15 }); this.sample('impact', pos, 0.7); }
  },
  clang(pos) { if (!this.sample('clang', pos, 1.1, { echo: 0.4 })) proc.thud.call(this, pos); },
  sting(name, vol = 0.9) { return this.sample(name, null, vol, { jitter: 0 }); },
  update(dt, o) {
    proc.update.call(this, dt, o); if (!this.deepG) return; const t = this.now();
    this.deepG.gain.setTargetAtTime((o.deep || 0) * 0.55 * this.duck, t, 0.8);
    this.roomG.gain.setTargetAtTime(o.indoor ? 0.5 * this.duck : 0, t, 1.2);
    this.bedG.gain.setTargetAtTime(Math.max(0, Math.min(1, this.intensity - 0.4)) * 0.6 * this.duck, t, 1.5);
  },
  engine(pos, dur = 14) { this.sample('engine_start', pos, 1.3, { jitter: 0 }); return proc.engine.call(this, pos, dur); },
});

// Knocker clicks: glottal impulses through throat resonances, ratcheting faster when agitated, with a wet croak.
AudioSys.prototype.click = function (pos, n = 3, vol = 1) {
  if (!this.ok) return; const o = this.out(pos, vol * 1.1, 0.12); const ctx = this.ctx; const t0 = this.now();
  const pitch = 0.85 + Math.random() * 0.3; let t = 0; const gap0 = n > 4 ? 0.055 : 0.11;
  for (let i = 0; i < n; i++) {
    const s = ctx.createBufferSource(); s.buffer = this.noise;
    const g = ctx.createGain(); const st = t0 + t; g.gain.setValueAtTime(0.0001, st); g.gain.linearRampToValueAtTime(1.6, st + 0.0008); g.gain.exponentialRampToValueAtTime(0.0001, st + 0.03 + Math.random() * 0.012);
    s.connect(g);
    for (const [f, q, lv] of [[700, 14, 1], [1900, 10, 0.8], [3400, 7, 0.35]]) { const b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = f * pitch * (0.92 + Math.random() * 0.16); b.Q.value = q; const v = ctx.createGain(); v.gain.value = lv * 2.2; g.connect(b).connect(v).connect(o); }
    s.start(st, Math.random()); s.stop(st + 0.06);
    t += gap0 * (1 - i / (n + 2)) * (0.8 + Math.random() * 0.4); // ratchet accelerates
  }
  const cr = ctx.createOscillator(); cr.type = 'sawtooth'; cr.frequency.setValueAtTime(62 * pitch, t0 + t); cr.frequency.linearRampToValueAtTime(48 * pitch, t0 + t + 0.45);
  const am = ctx.createGain(); am.gain.value = 0; const lfo = ctx.createOscillator(); lfo.frequency.value = 28; const lg = ctx.createGain(); lg.gain.value = 0.5; lfo.connect(lg).connect(am.gain);
  const fm = ctx.createBiquadFilter(); fm.type = 'bandpass'; fm.frequency.value = 520; fm.Q.value = 3; const cg = ctx.createGain();
  cg.gain.setValueAtTime(0.0001, t0 + t); cg.gain.linearRampToValueAtTime(0.5, t0 + t + 0.08); cg.gain.exponentialRampToValueAtTime(0.0001, t0 + t + 0.5);
  cr.connect(am).connect(fm).connect(cg).connect(o); cr.start(t0 + t); lfo.start(t0 + t); cr.stop(t0 + t + 0.55); lfo.stop(t0 + t + 0.55);
  this.burst(o, { t: t + 0.05, dur: 0.35, type: 'lowpass', f: 380, gain: 0.35, buf: this.brown });
};

// ------------------------------------------------------------ interface sounds (backpack, menus, notes)
Object.assign(AudioSys.prototype, {
  uiConfirm() { if (!this.ok) return; const o = this.out(null, 0.32); this.burst(o, {dur: 0.04, type: 'lowpass', f: 1800, gain: 0.18}); this.tone(o, {f: 660, f2: 440, dur: 0.065, gain: 0.12}); },
  uiTick() { if (!this.ok) return; const o = this.out(null, 0.22); this.tone(o, { f: 1650, dur: 0.022, gain: 0.07 }); this.burst(o, { dur: 0.018, type: 'highpass', f: 4200, gain: 0.12 }); },
  zip() { // canvas flap + zipper run
    if (!this.ok) return; this.sample('cloth', null, 0.55); this.sample('belt', null, 0.35, { t: 0.05 });
    const o = this.out(null, 0.45); for (let i = 0; i < 16; i++) this.burst(o, { t: 0.04 + i * 0.016, dur: 0.011, type: 'bandpass', f: 2300 + i * 85, q: 5, gain: 0.3 });
  },
  paper() { if (!this.ok) return; const o = this.out(null, 0.4); for (let i = 0; i < 7; i++) this.burst(o, { t: i * 0.035 + Math.random() * 0.03, dur: 0.05 + Math.random() * 0.04, type: 'highpass', f: 1800 + Math.random() * 2600, gain: 0.25 }); },
});
