// ============================================================
// PARTICLE SYSTEM
// ============================================================
class ParticleSystem {
  constructor() {
    this.particles = [];
    this.skidMarks = [];
    this._skidWriteIdx = 0;
  }

  emit(x, y, vx, vy, type) {
    if (this.particles.length >= MAX_PARTICLES) return;
    const p = {
      x, y, vx, vy, type,
      life: type === 'smoke' ? 0.8 : type === 'exhaust' ? 0.4 : 0.5,
      maxLife: type === 'smoke' ? 0.8 : type === 'exhaust' ? 0.4 : 0.5,
      size: type === 'smoke' ? 4 : type === 'exhaust' ? 2 : 3,
    };
    this.particles.push(p);
  }

  addSkidMark(x, y, alpha) {
    if (this.skidMarks.length < MAX_SKIDMARKS) {
      this.skidMarks.push({ x, y, alpha, age: 0 });
    } else {
      // Circular buffer: overwrite oldest entry
      this.skidMarks[this._skidWriteIdx] = { x, y, alpha, age: 0 };
      this._skidWriteIdx = (this._skidWriteIdx + 1) % MAX_SKIDMARKS;
    }
  }

  update(dt) {
    // Particles: swap-and-pop for O(1) removal
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      p.vx *= PARTICLE_DRAG; p.vy *= PARTICLE_DRAG;
      if (p.type === 'smoke') p.size += dt * 8;
      if (p.life <= 0) {
        // Swap with last element and pop (O(1) instead of O(n) splice)
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
      }
    }
    // Skidmarks: fade in place, mark as invisible when alpha <= 0
    for (let i = this.skidMarks.length - 1; i >= 0; i--) {
      this.skidMarks[i].age += dt;
      this.skidMarks[i].alpha -= dt * SKID_FADE_RATE;
    }
  }
}
