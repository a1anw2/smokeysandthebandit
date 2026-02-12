// ============================================================
// CAMERA
// ============================================================
class Camera {
  constructor() {
    this.x = 0; this.y = 0;
    this.smoothing = 0.07;
    this.zoom = 0.2;
    this.minZoom = 0.2;
    this.maxZoom = 1.5;
  }
  update(target, dt) {
    const lookAhead = 90;
    const speedRatio = clamp(target.speed / target.maxSpeed, 0, 1);
    const tx = target.x + Math.cos(target.angle) * lookAhead * speedRatio;
    const ty = target.y + Math.sin(target.angle) * lookAhead * speedRatio;
    this.x += (tx - this.x) * this.smoothing;
    this.y += (ty - this.y) * this.smoothing;
  }
  zoomIn() {
    this.zoom = clamp(this.zoom + 0.15, this.minZoom, this.maxZoom);
  }
  zoomOut() {
    this.zoom = clamp(this.zoom - 0.15, this.minZoom, this.maxZoom);
  }
  worldToScreen(wx, wy) {
    return {
      x: (wx - this.x) * this.zoom + CANVAS_W/2,
      y: (wy - this.y) * this.zoom + CANVAS_H/2
    };
  }
}
