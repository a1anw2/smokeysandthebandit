// ============================================================
// PARTICLE SYSTEM
// ============================================================
class ParticleSystem {
  constructor() {
    this.particles = [];
    this.skidMarks = [];
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
    if (this.skidMarks.length >= MAX_SKIDMARKS) this.skidMarks.shift();
    this.skidMarks.push({ x, y, alpha, age: 0 });
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      p.vx *= 0.97; p.vy *= 0.97;
      if (p.type === 'smoke') p.size += dt * 8;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.skidMarks.length - 1; i >= 0; i--) {
      this.skidMarks[i].age += dt;
      this.skidMarks[i].alpha -= dt * 0.08;
      if (this.skidMarks[i].alpha <= 0) { this.skidMarks.splice(i, 1); }
    }
  }
}
