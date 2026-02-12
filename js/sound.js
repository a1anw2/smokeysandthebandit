// ============================================================
// SOUND MANAGER
// ============================================================
class SoundManager {
  constructor() {
    this.ctx = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.started = false;
    this.muted = false;
  }
  init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 80;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 400;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);
      this.engineOsc.start();
      this.started = true;
    } catch(e) { /* audio not available */ }
  }
  update(speed, throttle, maxSpeed) {
    if (!this.started || this.muted) return;
    const rpm = 800 + (Math.abs(speed) / maxSpeed) * 4500;
    this.engineOsc.frequency.setTargetAtTime(rpm * 0.028, this.ctx.currentTime, 0.08);
    const g = 0.02 + throttle * 0.04;
    this.engineGain.gain.setTargetAtTime(g, this.ctx.currentTime, 0.08);
  }
  playBeep(freq, dur) {
    if (!this.started || this.muted) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.value = 0.15;
    o.connect(g); g.connect(this.ctx.destination);
    o.start(); o.stop(this.ctx.currentTime + dur);
  }
  silence() {
    if (this.engineGain && this.ctx) this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
  }
  toggle() {
    this.muted = !this.muted;
    if (this.muted) this.silence();
  }
}
