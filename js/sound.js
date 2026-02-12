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
      // Resume suspended context (browser autoplay policy)
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = ENGINE_BASE_FREQ;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = ENGINE_FILTER_FREQ;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);
      this.engineOsc.start();
      this.started = true;
    } catch(e) { /* audio not available */ }
  }
  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }
  update(speed, throttle, maxSpeed) {
    if (!this.started || this.muted) return;
    const rpm = ENGINE_RPM_BASE + (Math.abs(speed) / maxSpeed) * ENGINE_RPM_RANGE;
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
