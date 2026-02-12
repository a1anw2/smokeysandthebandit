// ============================================================
// ROAD NETWORK — replaces Track for OSM open-road mode
// ============================================================
class RoadNetwork {
  constructor(segments, startPoint, finishPoint, tiles) {
    this.isOpenTrack = true;
    this.segments = segments; // [{points, width, type, normals, leftBound, rightBound}]
    this.tiles = tiles || []; // [{img, gameX, gameY, gameW, gameH}]
    this.startPoint = { ...startPoint };
    this.finishPoint = { ...finishPoint };
    this.grid = {};
    this.numCheckpoints = 10;

    this._computeSegmentGeometry();
    this._buildGrid();
    this._computeBounds();
    this._buildLabels();

    // Total "as the crow flies" distance from start to finish
    this.totalLength = dist(
      this.startPoint.x, this.startPoint.y,
      this.finishPoint.x, this.finishPoint.y
    );

    // Compute start/finish angles from nearest road tangent
    this._computeEndpointAngles();

    // Pre-render the track canvas
    this.trackCanvas = null;
    this.trackBounds = null;
    this.preRender();
  }

  _computeSegmentGeometry() {
    for (const seg of this.segments) {
      seg.normals = [];
      seg.leftBound = [];
      seg.rightBound = [];

      for (let i = 0; i < seg.points.length; i++) {
        const prev = i > 0 ? seg.points[i - 1] : seg.points[i];
        const next = i < seg.points.length - 1 ? seg.points[i + 1] : seg.points[i];
        const dx = next.x - prev.x;
        const dy = next.y - prev.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = -dy / len, ny = dx / len;
        seg.normals.push({ x: nx, y: ny });
        seg.leftBound.push({ x: seg.points[i].x + nx * seg.width, y: seg.points[i].y + ny * seg.width });
        seg.rightBound.push({ x: seg.points[i].x - nx * seg.width, y: seg.points[i].y - ny * seg.width });
      }
    }
  }

  _buildGrid() {
    this.grid = {};
    for (let si = 0; si < this.segments.length; si++) {
      const seg = this.segments[si];
      for (let i = 0; i < seg.points.length - 1; i++) {
        const a = seg.points[i], b = seg.points[i + 1];
        const w = seg.width;
        // Add the road centerline segment to grid (for surface checks)
        this._addToGrid(a, b, si, i, w);
        // No boundary collision grid — roads are connected, cars can roam freely
      }
    }
  }

  _addToGrid(a, b, segIdx, ptIdx, width) {
    const pad = width + 10;
    const minX = Math.min(a.x, b.x) - pad, maxX = Math.max(a.x, b.x) + pad;
    const minY = Math.min(a.y, b.y) - pad, maxY = Math.max(a.y, b.y) + pad;
    const gx0 = Math.floor(minX / ROAD_GRID_CELL), gx1 = Math.floor(maxX / ROAD_GRID_CELL);
    const gy0 = Math.floor(minY / ROAD_GRID_CELL), gy1 = Math.floor(maxY / ROAD_GRID_CELL);
    for (let gx = gx0; gx <= gx1; gx++) {
      for (let gy = gy0; gy <= gy1; gy++) {
        const key = `${gx},${gy}`;
        if (!this.grid[key]) this.grid[key] = { roads: [], boundaries: [] };
        this.grid[key].roads.push({ a, b, segIdx, ptIdx, width });
      }
    }
  }

  _addBoundaryToGrid(a, b, segIdx, ptIdx, side) {
    const minX = Math.min(a.x, b.x), maxX = Math.max(a.x, b.x);
    const minY = Math.min(a.y, b.y), maxY = Math.max(a.y, b.y);
    const gx0 = Math.floor(minX / ROAD_GRID_CELL), gx1 = Math.floor(maxX / ROAD_GRID_CELL);
    const gy0 = Math.floor(minY / ROAD_GRID_CELL), gy1 = Math.floor(maxY / ROAD_GRID_CELL);
    for (let gx = gx0; gx <= gx1; gx++) {
      for (let gy = gy0; gy <= gy1; gy++) {
        const key = `${gx},${gy}`;
        if (!this.grid[key]) this.grid[key] = { roads: [], boundaries: [] };
        this.grid[key].boundaries.push({ a, b, segIdx, ptIdx, side });
      }
    }
  }

  _computeBounds() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const seg of this.segments) {
      for (const p of seg.points) {
        if (p.x - seg.width < minX) minX = p.x - seg.width;
        if (p.y - seg.width < minY) minY = p.y - seg.width;
        if (p.x + seg.width > maxX) maxX = p.x + seg.width;
        if (p.y + seg.width > maxY) maxY = p.y + seg.width;
      }
    }
    this._bounds = { minX: minX - 100, minY: minY - 100, maxX: maxX + 100, maxY: maxY + 100 };
  }

  _computeEndpointAngles() {
    // Find the road segment closest to start/finish and get its tangent
    const startInfo = this.getNearestRoad(this.startPoint.x, this.startPoint.y);
    const finishInfo = this.getNearestRoad(this.finishPoint.x, this.finishPoint.y);
    this.startPoint.angle = startInfo ? startInfo.angle : 0;
    this.finishPoint.angle = finishInfo ? finishInfo.angle : 0;
  }

  getBounds() {
    return this._bounds;
  }

  // Surface detection — is (x,y) on a road?
  getSurface(x, y) {
    const gx = Math.floor(x / ROAD_GRID_CELL), gy = Math.floor(y / ROAD_GRID_CELL);
    let minDist = Infinity;
    let nearestWidth = DEFAULT_ROAD_WIDTH;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const key = `${gx + dx},${gy + dy}`;
        const cell = this.grid[key];
        if (!cell) continue;
        for (const road of cell.roads) {
          const d = this._pointToSegDist(x, y, road.a, road.b);
          if (d < minDist) {
            minDist = d;
            nearestWidth = road.width;
          }
        }
      }
    }

    if (minDist < nearestWidth - 6) return 'asphalt';
    if (minDist < nearestWidth + 2) return 'curb';
    return 'grass';
  }

  // Get boundary segments near a point (disabled — roads are connected, cars roam freely)
  getSegmentsNear(x, y) {
    return [];
  }

  // Find nearest road point + tangent angle
  getNearestRoad(x, y) {
    const gx = Math.floor(x / ROAD_GRID_CELL), gy = Math.floor(y / ROAD_GRID_CELL);
    let minDist = Infinity;
    let best = null;

    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        const key = `${gx + dx},${gy + dy}`;
        const cell = this.grid[key];
        if (!cell) continue;
        for (const road of cell.roads) {
          const info = this._closestPointOnSeg(x, y, road.a, road.b);
          if (info.dist < minDist) {
            minDist = info.dist;
            const rdx = road.b.x - road.a.x, rdy = road.b.y - road.a.y;
            const len = Math.sqrt(rdx * rdx + rdy * rdy) || 1;
            best = {
              x: info.x, y: info.y,
              dist: info.dist,
              angle: Math.atan2(rdy, rdx),
              width: road.width,
              segIdx: road.segIdx,
              nx: -rdy / len, ny: rdx / len
            };
          }
        }
      }
    }
    return best;
  }

  // Get the name of the road nearest to (x,y)
  getRoadName(x, y) {
    const info = this.getNearestRoad(x, y);
    if (!info || info.dist > info.width + 20) return '';
    const seg = this.segments[info.segIdx];
    return (seg && seg.name) ? seg.name : '';
  }

  // Distance from (x,y) to the finish point
  getDistanceToFinish(x, y) {
    return dist(x, y, this.finishPoint.x, this.finishPoint.y);
  }

  // Get race progress as 0..1
  getRaceProgress(x, y) {
    const dToFinish = this.getDistanceToFinish(x, y);
    return clamp(1 - dToFinish / this.totalLength, 0, 1);
  }

  // Interface compatibility with Track — these are used by the car for getNearestT
  getNearestT(x, y) {
    return this.getRaceProgress(x, y);
  }

  // Stub methods for interface compatibility
  getPointAt(t) {
    // Lerp between start and finish
    return {
      x: lerp(this.startPoint.x, this.finishPoint.x, clamp(t, 0, 1)),
      y: lerp(this.startPoint.y, this.finishPoint.y, clamp(t, 0, 1))
    };
  }

  getTangentAt(t) {
    const dx = this.finishPoint.x - this.startPoint.x;
    const dy = this.finishPoint.y - this.startPoint.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    return { x: dx / len, y: dy / len };
  }

  getNormalAt(t) {
    const tan = this.getTangentAt(t);
    return { x: -tan.y, y: tan.x };
  }

  getWidthAt(t) {
    return DEFAULT_ROAD_WIDTH;
  }

  getCurvatureAt(t) {
    return 0;
  }

  // ---- Internal helpers ----

  _pointToSegDist(px, py, a, b) {
    return this._closestPointOnSeg(px, py, a, b).dist;
  }

  _closestPointOnSeg(px, py, a, b) {
    const abx = b.x - a.x, aby = b.y - a.y;
    const apx = px - a.x, apy = py - a.y;
    const lenSq = abx * abx + aby * aby;
    if (lenSq === 0) return { x: a.x, y: a.y, dist: dist(px, py, a.x, a.y) };
    const t = clamp((apx * abx + apy * aby) / lenSq, 0, 1);
    const cx = a.x + abx * t, cy = a.y + aby * t;
    return { x: cx, y: cy, dist: dist(px, py, cx, cy) };
  }

  // ---- Pre-rendering ----

  preRender() {
    const bounds = this.getBounds();
    this.trackBounds = bounds;
    const w = bounds.maxX - bounds.minX;
    const h = bounds.maxY - bounds.minY;

    // Cap canvas size to avoid memory issues
    const maxDim = 10000;
    let scale = 1;
    if (w > maxDim || h > maxDim) {
      scale = maxDim / Math.max(w, h);
    }

    this.trackCanvas = document.createElement('canvas');
    this.trackCanvas.width = Math.ceil(w * scale);
    this.trackCanvas.height = Math.ceil(h * scale);
    this.renderScale = scale;
    const tc = this.trackCanvas.getContext('2d');
    tc.scale(scale, scale);
    tc.translate(-bounds.minX, -bounds.minY);

    // Grass background
    tc.fillStyle = COLORS.grass;
    tc.fillRect(bounds.minX, bounds.minY, w, h);
    tc.fillStyle = COLORS.grassDark;
    for (let y = bounds.minY; y < bounds.maxY; y += 40) {
      tc.fillRect(bounds.minX, y, w, 20);
    }

    // Draw OSM raster tiles as background (buildings, parks, water, etc.)
    if (this.tiles.length > 0) {
      tc.globalAlpha = 0.45;
      for (const tile of this.tiles) {
        tc.drawImage(tile.img, tile.gameX, tile.gameY, tile.gameW, tile.gameH);
      }
      tc.globalAlpha = 1.0;

      // Slight dark overlay to blend tiles with game aesthetic
      tc.fillStyle = 'rgba(0,0,0,0.15)';
      tc.fillRect(bounds.minX, bounds.minY, w, h);
    }

    // Draw all road surfaces (wider roads first for proper layering)
    const sortedSegs = [...this.segments].sort((a, b) => b.width - a.width);

    // Pass 1: Road surface (no curbs for road network — clean look)
    for (const seg of sortedSegs) {
      if (seg.points.length < 2) continue;

      // Road surface — color by road type
      const roadCol = ROAD_COLORS[seg.type] || { fill: COLORS.road, light: COLORS.roadLight };
      tc.beginPath();
      tc.moveTo(seg.leftBound[0].x, seg.leftBound[0].y);
      for (let i = 1; i < seg.leftBound.length; i++) {
        tc.lineTo(seg.leftBound[i].x, seg.leftBound[i].y);
      }
      for (let i = seg.rightBound.length - 1; i >= 0; i--) {
        tc.lineTo(seg.rightBound[i].x, seg.rightBound[i].y);
      }
      tc.closePath();
      tc.fillStyle = roadCol.fill;
      tc.fill();

      // Lighter center
      tc.beginPath();
      const innerFrac = 0.7;
      tc.moveTo(
        seg.points[0].x + seg.normals[0].x * seg.width * innerFrac,
        seg.points[0].y + seg.normals[0].y * seg.width * innerFrac
      );
      for (let i = 1; i < seg.points.length; i++) {
        tc.lineTo(
          seg.points[i].x + seg.normals[i].x * seg.width * innerFrac,
          seg.points[i].y + seg.normals[i].y * seg.width * innerFrac
        );
      }
      for (let i = seg.points.length - 1; i >= 0; i--) {
        tc.lineTo(
          seg.points[i].x - seg.normals[i].x * seg.width * innerFrac,
          seg.points[i].y - seg.normals[i].y * seg.width * innerFrac
        );
      }
      tc.closePath();
      tc.fillStyle = roadCol.light;
      tc.fill();
    }

    // Pass 2: Center dashed lines
    tc.strokeStyle = 'rgba(255,255,255,0.3)';
    tc.lineWidth = 2;
    tc.setLineDash([15, 15]);
    for (const seg of this.segments) {
      if (seg.points.length < 2) continue;
      tc.beginPath();
      tc.moveTo(seg.points[0].x, seg.points[0].y);
      for (let i = 1; i < seg.points.length; i++) {
        tc.lineTo(seg.points[i].x, seg.points[i].y);
      }
      tc.stroke();
    }
    tc.setLineDash([]);

    // Pass 3: Edge lines
    tc.strokeStyle = 'rgba(255,255,255,0.4)';
    tc.lineWidth = 1.5;
    for (const seg of this.segments) {
      if (seg.points.length < 2) continue;
      // Left edge
      tc.beginPath();
      tc.moveTo(seg.leftBound[0].x, seg.leftBound[0].y);
      for (let i = 1; i < seg.leftBound.length; i++) tc.lineTo(seg.leftBound[i].x, seg.leftBound[i].y);
      tc.stroke();
      // Right edge
      tc.beginPath();
      tc.moveTo(seg.rightBound[0].x, seg.rightBound[0].y);
      for (let i = 1; i < seg.rightBound.length; i++) tc.lineTo(seg.rightBound[i].x, seg.rightBound[i].y);
      tc.stroke();
    }

    // Road names are drawn in real-time (see drawLabels) to avoid blur from pre-render scaling

    // Start marker (green checkered)
    this._drawCheckered(tc, this.startPoint, '#4CAF50');

    // Finish marker (gold checkered)
    this._drawCheckered(tc, this.finishPoint, '#FFD700');

    // Note: START/FINISH text labels are drawn in real-time via drawLabels()
  }

  // Pre-compute road name label positions (called once at construction)
  _buildLabels() {
    this.labels = [];

    for (const seg of this.segments) {
      if (!seg.name || seg.points.length < 2) continue;

      let totalLen = 0;
      for (let i = 0; i < seg.points.length - 1; i++) {
        totalLen += dist(seg.points[i].x, seg.points[i].y, seg.points[i + 1].x, seg.points[i + 1].y);
      }

      if (totalLen < 120) continue; // skip very short segments

      // Place labels every ~1500px along the segment
      const spacing = 1500;
      let nextLabel = Math.min(totalLen / 2, spacing * 0.4);
      let cumDist = 0;

      for (let i = 0; i < seg.points.length - 1 && nextLabel < totalLen; i++) {
        const a = seg.points[i], b = seg.points[i + 1];
        const segLen = dist(a.x, a.y, b.x, b.y);

        while (nextLabel >= cumDist && nextLabel < cumDist + segLen) {
          const t = (nextLabel - cumDist) / segLen;
          const lx = a.x + (b.x - a.x) * t;
          const ly = a.y + (b.y - a.y) * t;
          let angle = Math.atan2(b.y - a.y, b.x - a.x);
          if (angle > Math.PI / 2) angle -= Math.PI;
          if (angle < -Math.PI / 2) angle += Math.PI;

          this.labels.push({ text: seg.name, x: lx, y: ly, angle });
          nextLabel += spacing;
        }
        cumDist += segLen;
      }
    }
  }

  // Draw road names + endpoint labels at screen resolution (called each frame from renderer)
  drawLabels(ctx, camera) {
    const z = camera.zoom || 1;
    const fontSize = Math.max(8, Math.round(9 * z));
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Only draw labels visible in the viewport (expand bounds for zoom-out)
    const halfW = (CANVAS_W / 2 + 150) / z;
    const halfH = (CANVAS_H / 2 + 150) / z;

    // Road name labels — with screen-space overlap + same-name proximity rejection
    const drawnRects = []; // [{x, y, w, h, text}] in screen space

    if (this.labels && this.labels.length > 0) {
      for (const lbl of this.labels) {
        const sx = lbl.x - camera.x;
        const sy = lbl.y - camera.y;
        if (sx < -halfW || sx > halfW || sy < -halfH || sy > halfH) continue;

        const screenX = sx * z + CANVAS_W / 2;
        const screenY = sy * z + CANVAS_H / 2;

        // Estimate label bounding box in screen space for overlap check
        const tw = ctx.measureText(lbl.text).width;
        const pad = 5;
        const rectW = tw + pad * 2 + 10; // margin
        const rectH = fontSize + 10;

        // Check overlap with any drawn label AND same-name proximity
        let skip = false;
        const minNameDist = 250; // min screen pixels between same-name labels
        for (const r of drawnRects) {
          const dx = Math.abs(screenX - r.x), dy = Math.abs(screenY - r.y);
          // Axis-aligned overlap
          if (dx < (rectW + r.w) / 2 && dy < (rectH + r.h) / 2) {
            skip = true;
            break;
          }
          // Same road name too close
          if (r.text === lbl.text && dx * dx + dy * dy < minNameDist * minNameDist) {
            skip = true;
            break;
          }
        }
        if (skip) continue;

        drawnRects.push({ x: screenX, y: screenY, w: rectW, h: rectH, text: lbl.text });

        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.rotate(lbl.angle);

        // Background pill
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        roundRect(ctx, -tw / 2 - pad, -fontSize / 2 - 2, tw + pad * 2, fontSize + 4, 3);
        ctx.fill();

        // White text with slight shadow for clarity
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(lbl.text, 0, 0);
        ctx.restore();
      }
    }

    // START / FINISH labels (always crisp)
    this._drawScreenLabel(ctx, camera, this.startPoint, 'START', '#4CAF50', halfW, halfH);
    this._drawScreenLabel(ctx, camera, this.finishPoint, 'FINISH', '#FFD700', halfW, halfH);
  }

  _drawScreenLabel(ctx, camera, point, text, color, halfW, halfH) {
    const sx = point.x - camera.x;
    const sy = point.y - camera.y;
    if (sx < -halfW || sx > halfW || sy < -halfH || sy > halfH) return;

    const z = camera.zoom || 1;
    const screenX = sx * z + CANVAS_W / 2;
    const screenY = sy * z + CANVAS_H / 2;

    ctx.save();
    const fs = Math.max(9, Math.round(12 * z));
    ctx.font = `bold ${fs}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const info = this.getNearestRoad(point.x, point.y);
    const w = info ? info.width : DEFAULT_ROAD_WIDTH;
    const labelY = screenY - (w + 20) * z;

    // Background pill
    const tw = ctx.measureText(text).width;
    const pw = tw + 16, ph = fs + 8;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    roundRect(ctx, screenX - pw / 2, labelY - ph / 2, pw, ph, 5);
    ctx.fill();

    // Colored text
    ctx.fillStyle = color;
    ctx.fillText(text, screenX, labelY);
    ctx.restore();
  }

  _drawCheckered(tc, point, color) {
    const info = this.getNearestRoad(point.x, point.y);
    if (!info) return;
    const w = info.width || DEFAULT_ROAD_WIDTH;
    tc.save();
    tc.translate(point.x, point.y);
    tc.rotate(info.angle + Math.PI / 2);
    const sz = 12;
    for (let row = -Math.floor(w / sz); row <= Math.floor(w / sz); row++) {
      for (let col = -2; col <= 2; col++) {
        tc.fillStyle = (row + col) % 2 === 0 ? color : '#222';
        tc.fillRect(col * sz, row * sz, sz, sz);
      }
    }
    tc.restore();
  }

  _drawEndpointLabel(tc, point, text, color) {
    const info = this.getNearestRoad(point.x, point.y);
    const w = info ? info.width : DEFAULT_ROAD_WIDTH;
    // Draw label offset above/below the road
    const offsetY = -(w + 25);
    tc.save();
    tc.font = 'bold 22px sans-serif';
    tc.textAlign = 'center';
    tc.textBaseline = 'middle';
    // Background pill
    const metrics = tc.measureText(text);
    const pw = metrics.width + 16, ph = 28;
    tc.fillStyle = 'rgba(0,0,0,0.7)';
    roundRect(tc, point.x - pw / 2, point.y + offsetY - ph / 2, pw, ph, 6);
    tc.fill();
    // Text
    tc.fillStyle = color;
    tc.fillText(text, point.x, point.y + offsetY);
    tc.restore();
  }
}
