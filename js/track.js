// ============================================================
// TRACK
// ============================================================
class Track {
  constructor() {
    this.isOpenTrack = false;
    this.waypoints = [
      { x: 800,  y: 1600, width: 75 },
      { x: 1100, y: 1600, width: 75 },
      { x: 1400, y: 1600, width: 75 },
      { x: 1700, y: 1580, width: 70 },
      { x: 1950, y: 1480, width: 65 },
      { x: 2150, y: 1300, width: 65 },
      { x: 2250, y: 1050, width: 70 },
      { x: 2200, y: 800,  width: 65 },
      { x: 2050, y: 600,  width: 60 },
      { x: 1850, y: 480,  width: 55 },
      { x: 1650, y: 430,  width: 55 },
      { x: 1450, y: 480,  width: 55 },
      { x: 1300, y: 600,  width: 55 },
      { x: 1100, y: 520,  width: 55 },
      { x: 900,  y: 620,  width: 60 },
      { x: 700,  y: 800,  width: 65 },
      { x: 530,  y: 1050, width: 70 },
      { x: 450,  y: 1300, width: 70 },
      { x: 500,  y: 1500, width: 75 },
      { x: 650,  y: 1600, width: 75 },
    ];
    this.N = this.waypoints.length;
    this.points = [];
    this.leftBoundary = [];
    this.rightBoundary = [];
    this.widths = [];
    this.tangents = [];
    this.normals = [];
    this.cumLen = [0];
    this.totalLength = 0;
    this._sample();
    this._buildGrid();
    this.numCheckpoints = 10;
  }

  _sample() {
    const wp = this.waypoints, N = this.N;
    for (let i = 0; i < TRACK_SAMPLES; i++) {
      const globalT = i / TRACK_SAMPLES;
      const seg = globalT * N;
      const idx = Math.floor(seg);
      const t = seg - idx;
      const p0 = wp[(idx - 1 + N) % N], p1 = wp[idx % N], p2 = wp[(idx+1) % N], p3 = wp[(idx+2) % N];
      const pt = catmullRom(p0, p1, p2, p3, t);
      const w = catmullRomWidth(p0.width, p1.width, p2.width, p3.width, t);
      this.points.push(pt);
      this.widths.push(w);
    }
    for (let i = 0; i < TRACK_SAMPLES; i++) {
      const next = (i + 1) % TRACK_SAMPLES;
      const dx = this.points[next].x - this.points[i].x;
      const dy = this.points[next].y - this.points[i].y;
      const len = Math.sqrt(dx*dx + dy*dy) || 1;
      this.tangents.push({ x: dx/len, y: dy/len });
      this.normals.push({ x: -dy/len, y: dx/len });
      if (i > 0) {
        this.cumLen.push(this.cumLen[i-1] + dist(this.points[i-1].x, this.points[i-1].y, this.points[i].x, this.points[i].y));
      }
    }
    this.totalLength = this.cumLen[TRACK_SAMPLES - 1] + dist(
      this.points[TRACK_SAMPLES-1].x, this.points[TRACK_SAMPLES-1].y,
      this.points[0].x, this.points[0].y
    );
    for (let i = 0; i < TRACK_SAMPLES; i++) {
      const p = this.points[i], n = this.normals[i], w = this.widths[i];
      this.leftBoundary.push({ x: p.x + n.x * w, y: p.y + n.y * w });
      this.rightBoundary.push({ x: p.x - n.x * w, y: p.y - n.y * w });
    }
  }

  _buildGrid() {
    this.grid = {};
    for (let i = 0; i < TRACK_SAMPLES; i++) {
      const next = (i + 1) % TRACK_SAMPLES;
      this._addSegToGrid(this.leftBoundary[i], this.leftBoundary[next], i, 'L');
      this._addSegToGrid(this.rightBoundary[i], this.rightBoundary[next], i, 'R');
    }
  }

  _addSegToGrid(a, b, idx, side) {
    const minX = Math.min(a.x, b.x), maxX = Math.max(a.x, b.x);
    const minY = Math.min(a.y, b.y), maxY = Math.max(a.y, b.y);
    const gx0 = Math.floor(minX / GRID_CELL), gx1 = Math.floor(maxX / GRID_CELL);
    const gy0 = Math.floor(minY / GRID_CELL), gy1 = Math.floor(maxY / GRID_CELL);
    for (let gx = gx0; gx <= gx1; gx++) {
      for (let gy = gy0; gy <= gy1; gy++) {
        const key = `${gx},${gy}`;
        if (!this.grid[key]) this.grid[key] = [];
        this.grid[key].push({ a, b, idx, side });
      }
    }
  }

  getPointAt(t) {
    t = ((t % 1) + 1) % 1;
    const fi = t * TRACK_SAMPLES;
    const i = Math.floor(fi) % TRACK_SAMPLES;
    const frac = fi - Math.floor(fi);
    const next = (i + 1) % TRACK_SAMPLES;
    return {
      x: lerp(this.points[i].x, this.points[next].x, frac),
      y: lerp(this.points[i].y, this.points[next].y, frac)
    };
  }

  getTangentAt(t) {
    t = ((t % 1) + 1) % 1;
    const i = Math.floor(t * TRACK_SAMPLES) % TRACK_SAMPLES;
    return this.tangents[i];
  }

  getNormalAt(t) {
    t = ((t % 1) + 1) % 1;
    const i = Math.floor(t * TRACK_SAMPLES) % TRACK_SAMPLES;
    return this.normals[i];
  }

  getWidthAt(t) {
    t = ((t % 1) + 1) % 1;
    const i = Math.floor(t * TRACK_SAMPLES) % TRACK_SAMPLES;
    return this.widths[i];
  }

  getNearestT(x, y) {
    let bestDist = Infinity, bestI = 0;
    for (let i = 0; i < TRACK_SAMPLES; i += 10) {
      const d = (this.points[i].x - x)**2 + (this.points[i].y - y)**2;
      if (d < bestDist) { bestDist = d; bestI = i; }
    }
    let fineI = bestI;
    bestDist = Infinity;
    for (let i = bestI - 15; i <= bestI + 15; i++) {
      const idx = ((i % TRACK_SAMPLES) + TRACK_SAMPLES) % TRACK_SAMPLES;
      const d = (this.points[idx].x - x)**2 + (this.points[idx].y - y)**2;
      if (d < bestDist) { bestDist = d; fineI = idx; }
    }
    return fineI / TRACK_SAMPLES;
  }

  getSurface(x, y) {
    const t = this.getNearestT(x, y);
    const i = Math.floor(t * TRACK_SAMPLES) % TRACK_SAMPLES;
    const p = this.points[i], n = this.normals[i], w = this.widths[i];
    const dx = x - p.x, dy = y - p.y;
    const lateralDist = Math.abs(dot(dx, dy, n.x, n.y));
    if (lateralDist < w - 8) return 'asphalt';
    if (lateralDist < w) return 'curb';
    return 'grass';
  }

  getSegmentsNear(x, y) {
    const gx = Math.floor(x / GRID_CELL), gy = Math.floor(y / GRID_CELL);
    const result = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const key = `${gx+dx},${gy+dy}`;
        if (this.grid[key]) result.push(...this.grid[key]);
      }
    }
    return result;
  }

  getBounds() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of this.points) {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    }
    return { minX: minX - 100, minY: minY - 100, maxX: maxX + 100, maxY: maxY + 100 };
  }

  getCurvatureAt(t) {
    const step = 3 / TRACK_SAMPLES;
    const t1 = this.getTangentAt(t);
    const t2 = this.getTangentAt(t + step);
    const angle = Math.abs(normalizeAngle(Math.atan2(t2.y, t2.x) - Math.atan2(t1.y, t1.x)));
    return angle / step;
  }
}
