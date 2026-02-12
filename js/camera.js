// ============================================================
// CAMERA
// ============================================================
class Camera {
  constructor() {
    this.x = 0; this.y = 0;
    this.smoothing = CAMERA_SMOOTHING;
    this.zoom = CAMERA_ZOOM_INITIAL;
    this.minZoom = CAMERA_ZOOM_MIN;
    this.maxZoom = CAMERA_ZOOM_MAX;
  }
  update(target, dt) {
    const speedRatio = clamp(target.speed / target.maxSpeed, 0, 1);
    const tx = target.x + Math.cos(target.angle) * CAMERA_LOOKAHEAD * speedRatio;
    const ty = target.y + Math.sin(target.angle) * CAMERA_LOOKAHEAD * speedRatio;
    this.x += (tx - this.x) * this.smoothing;
    this.y += (ty - this.y) * this.smoothing;
  }
  zoomIn() {
    this.zoom = clamp(this.zoom + CAMERA_ZOOM_STEP, this.minZoom, this.maxZoom);
  }
  zoomOut() {
    this.zoom = clamp(this.zoom - CAMERA_ZOOM_STEP, this.minZoom, this.maxZoom);
  }
  worldToScreen(wx, wy) {
    return {
      x: (wx - this.x) * this.zoom + CANVAS_W/2,
      y: (wy - this.y) * this.zoom + CANVAS_H/2
    };
  }
}
