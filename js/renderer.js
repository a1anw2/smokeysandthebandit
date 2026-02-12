// ============================================================
// RENDERER
// ============================================================
class Renderer {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.trackCanvas = null;
    this.trackBounds = null;
  }

  preRenderTrack(track) {
    if (!track) return;
    // RoadNetwork handles its own pre-rendering
    if (track.isOpenTrack && track.trackCanvas) {
      this.trackCanvas = track.trackCanvas;
      this.trackBounds = track.trackBounds;
      this.renderScale = track.renderScale || 1;
      return;
    }
    this.renderScale = 1;

    const bounds = track.getBounds();
    this.trackBounds = bounds;
    const w = bounds.maxX - bounds.minX;
    const h = bounds.maxY - bounds.minY;

    // Cap canvas size to avoid memory issues (same safeguard as road-network)
    let scale = 1;
    if (w > MAX_CANVAS_DIM || h > MAX_CANVAS_DIM) {
      scale = MAX_CANVAS_DIM / Math.max(w, h);
    }
    this.renderScale = scale;

    this.trackCanvas = document.createElement('canvas');
    this.trackCanvas.width = Math.ceil(w * scale);
    this.trackCanvas.height = Math.ceil(h * scale);
    const tc = this.trackCanvas.getContext('2d');
    tc.scale(scale, scale);
    tc.translate(-bounds.minX, -bounds.minY);

    // grass pattern
    tc.fillStyle = COLORS.grass;
    tc.fillRect(bounds.minX, bounds.minY, w, h);
    tc.fillStyle = COLORS.grassDark;
    for (let y = bounds.minY; y < bounds.maxY; y += GRASS_STRIPE_HEIGHT) {
      tc.fillRect(bounds.minX, y, w, GRASS_STRIPE_HEIGHT / 2);
    }

    // road surface
    tc.beginPath();
    const lb = track.leftBoundary, rb = track.rightBoundary;
    tc.moveTo(lb[0].x, lb[0].y);
    for (let i = 1; i < TRACK_SAMPLES; i++) tc.lineTo(lb[i].x, lb[i].y);
    for (let i = TRACK_SAMPLES - 1; i >= 0; i--) tc.lineTo(rb[i].x, rb[i].y);
    tc.closePath();
    tc.fillStyle = COLORS.road;
    tc.fill();

    // road detail - lighter center
    tc.beginPath();
    for (let i = 0; i < TRACK_SAMPLES; i++) {
      const p = track.points[i], n = track.normals[i], w2 = track.widths[i] * 0.7;
      const lx = p.x + n.x * w2, ly = p.y + n.y * w2;
      if (i === 0) tc.moveTo(lx, ly); else tc.lineTo(lx, ly);
    }
    for (let i = TRACK_SAMPLES - 1; i >= 0; i--) {
      const p = track.points[i], n = track.normals[i], w2 = track.widths[i] * 0.7;
      tc.lineTo(p.x - n.x * w2, p.y - n.y * w2);
    }
    tc.closePath();
    tc.fillStyle = COLORS.roadLight;
    tc.fill();

    // curbs (outer edge)
    for (let side = 0; side < 2; side++) {
      const boundary = side === 0 ? track.leftBoundary : track.rightBoundary;
      for (let i = 0; i < TRACK_SAMPLES; i += CURB_SEGMENT_STEP) {
        const i2 = Math.min(i + CURB_SEGMENT_STEP, TRACK_SAMPLES - 1);
        const color = (Math.floor(i / CURB_SEGMENT_STEP) % 2 === 0) ? COLORS.curb1 : COLORS.curb2;
        tc.beginPath();
        const p1 = boundary[i], p2 = boundary[i2];
        const n1 = track.normals[i], n2 = track.normals[i2];
        const sign = side === 0 ? -1 : 1;
        const cw = CURB_VISUAL_WIDTH;
        tc.moveTo(p1.x, p1.y);
        tc.lineTo(p2.x, p2.y);
        tc.lineTo(p2.x + n2.x * sign * cw, p2.y + n2.y * sign * cw);
        tc.lineTo(p1.x + n1.x * sign * cw, p1.y + n1.y * sign * cw);
        tc.closePath();
        tc.fillStyle = color;
        tc.fill();
      }
    }

    // center dashed line
    tc.strokeStyle = 'rgba(255,255,255,0.3)';
    tc.lineWidth = 2;
    tc.setLineDash([20, 20]);
    tc.beginPath();
    for (let i = 0; i < TRACK_SAMPLES; i++) {
      const p = track.points[i];
      if (i === 0) tc.moveTo(p.x, p.y); else tc.lineTo(p.x, p.y);
    }
    tc.closePath();
    tc.stroke();
    tc.setLineDash([]);

    // edge lines
    tc.strokeStyle = 'rgba(255,255,255,0.5)';
    tc.lineWidth = 2;
    for (let side = 0; side < 2; side++) {
      const boundary = side === 0 ? track.leftBoundary : track.rightBoundary;
      tc.beginPath();
      for (let i = 0; i < TRACK_SAMPLES; i++) {
        const p = boundary[i];
        if (i === 0) tc.moveTo(p.x, p.y); else tc.lineTo(p.x, p.y);
      }
      tc.closePath();
      tc.stroke();
    }

    // start/finish line
    const sfP = track.points[0], sfN = track.normals[0], sfW = track.widths[0];
    tc.save();
    tc.translate(sfP.x, sfP.y);
    tc.rotate(Math.atan2(sfN.y, sfN.x));
    const sfSize = 8;
    for (let row = -Math.floor(sfW / sfSize); row <= Math.floor(sfW / sfSize); row++) {
      for (let col = -1; col <= 1; col++) {
        tc.fillStyle = (row + col) % 2 === 0 ? '#FFF' : '#222';
        tc.fillRect(col * sfSize, row * sfSize, sfSize, sfSize);
      }
    }
    tc.restore();
  }

  drawTrack(camera, track) {
    if (!track || !this.trackCanvas || !this.trackBounds) return;
    const ctx = this.ctx;
    const b = this.trackBounds;
    const z = camera.zoom || 1;
    const sx = (b.minX - camera.x) * z + CANVAS_W/2;
    const sy = (b.minY - camera.y) * z + CANVAS_H/2;
    const dw = (b.maxX - b.minX) * z;
    const dh = (b.maxY - b.minY) * z;
    ctx.drawImage(this.trackCanvas, sx, sy, dw, dh);

    // Draw road names at screen resolution (avoids pre-render blur)
    if (track && track.drawLabels) {
      track.drawLabels(ctx, camera);
    }
  }

  drawSkidMarks(particles, camera) {
    const ctx = this.ctx;
    const z = camera.zoom || 1;
    const sz = 2 * z;
    for (const sm of particles.skidMarks) {
      if (sm.alpha <= 0) continue; // Skip fully faded marks (circular buffer keeps them)
      const s = camera.worldToScreen(sm.x, sm.y);
      ctx.fillStyle = `rgba(30,30,30,${clamp(sm.alpha, 0, 0.6)})`;
      ctx.fillRect(s.x - sz, s.y - sz, sz * 2, sz * 2);
    }
  }

  drawCar(car, camera) {
    const ctx = this.ctx;
    const s = camera.worldToScreen(car.x, car.y);
    const z = camera.zoom || 1;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.scale(z, z);
    ctx.rotate(car.angle);

    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(3, 3, car.length/2 + 2, car.width/2 + 2, 0, 0, Math.PI*2);
    ctx.fill();

    // body
    const grad = ctx.createLinearGradient(-car.length/2, -car.width/2, -car.length/2, car.width/2);
    grad.addColorStop(0, lighten(car.color, 40));
    grad.addColorStop(0.5, car.color);
    grad.addColorStop(1, darken(car.color, 40));
    ctx.fillStyle = grad;
    roundRect(ctx, -car.length/2, -car.width/2, car.length, car.width, 4);
    ctx.fill();
    ctx.strokeStyle = darken(car.color, 60);
    ctx.lineWidth = 1;
    ctx.stroke();

    // windshield
    ctx.fillStyle = '#1a2a4a';
    ctx.beginPath();
    ctx.moveTo(car.length/2 - 12, -car.width/2 + 3);
    ctx.lineTo(car.length/2 - 5, -car.width/2 + 5);
    ctx.lineTo(car.length/2 - 5, car.width/2 - 5);
    ctx.lineTo(car.length/2 - 12, car.width/2 - 3);
    ctx.closePath();
    ctx.fill();

    // rear spoiler
    ctx.fillStyle = darken(car.color, 50);
    ctx.fillRect(-car.length/2, -car.width/2 - 2, 3, car.width + 4);

    // headlights
    ctx.fillStyle = '#FFE082';
    ctx.fillRect(car.length/2 - 3, -car.width/2 + 2, 3, 4);
    ctx.fillRect(car.length/2 - 3, car.width/2 - 6, 3, 4);

    // taillights
    ctx.fillStyle = '#C62828';
    ctx.fillRect(-car.length/2, -car.width/2 + 2, 3, 4);
    ctx.fillRect(-car.length/2, car.width/2 - 6, 3, 4);

    // racing stripe
    ctx.fillStyle = `rgba(255,255,255,0.15)`;
    ctx.fillRect(-car.length/2 + 5, -1.5, car.length - 10, 3);

    ctx.restore();
  }

  drawPoliceCar(car, camera, time) {
    const ctx = this.ctx;
    const s = camera.worldToScreen(car.x, car.y);
    const z = camera.zoom || 1;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.scale(z, z);
    ctx.rotate(car.angle);

    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(3, 3, car.length/2 + 2, car.width/2 + 2, 0, 0, Math.PI*2);
    ctx.fill();

    // body — black and white police scheme
    const grad = ctx.createLinearGradient(-car.length/2, -car.width/2, -car.length/2, car.width/2);
    grad.addColorStop(0, '#2A2A2A');
    grad.addColorStop(0.3, '#1A1A2E');
    grad.addColorStop(0.5, '#1A1A2E');
    grad.addColorStop(0.7, '#1A1A2E');
    grad.addColorStop(1, '#2A2A2A');
    ctx.fillStyle = grad;
    roundRect(ctx, -car.length/2, -car.width/2, car.length, car.width, 4);
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.stroke();

    // White door panels
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(-5, -car.width/2 + 2, 14, car.width - 4);

    // windshield
    ctx.fillStyle = '#1a2a4a';
    ctx.beginPath();
    ctx.moveTo(car.length/2 - 12, -car.width/2 + 3);
    ctx.lineTo(car.length/2 - 5, -car.width/2 + 5);
    ctx.lineTo(car.length/2 - 5, car.width/2 - 5);
    ctx.lineTo(car.length/2 - 12, car.width/2 - 3);
    ctx.closePath();
    ctx.fill();

    // headlights
    ctx.fillStyle = '#FFE082';
    ctx.fillRect(car.length/2 - 3, -car.width/2 + 2, 3, 4);
    ctx.fillRect(car.length/2 - 3, car.width/2 - 6, 3, 4);

    // taillights
    ctx.fillStyle = '#C62828';
    ctx.fillRect(-car.length/2, -car.width/2 + 2, 3, 4);
    ctx.fillRect(-car.length/2, car.width/2 - 6, 3, 4);

    // Roof light bar — flashing blue and red
    const flashPhase = Math.floor(time * 8) % 2;
    const lightBarY = -car.width/2 + 3;
    const lightBarH = car.width - 6;

    // Left light (blue/off)
    ctx.fillStyle = flashPhase === 0 ? '#2196F3' : '#0D47A1';
    ctx.fillRect(-2, -car.width/2 + 3, 4, car.width/2 - 3);

    // Right light (red/off)
    ctx.fillStyle = flashPhase === 1 ? '#F44336' : '#B71C1C';
    ctx.fillRect(-2, 0, 4, car.width/2 - 3);

    ctx.restore();

    // --- Frozen cop: dim overlay, "STOPPED" label, no radar ---
    if (car.isFrozen) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.scale(z, z);
      ctx.rotate(car.angle);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      roundRect(ctx, -car.length/2, -car.width/2, car.length, car.width, 4);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = `bold ${Math.max(8, Math.round(10 * z))}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText('STOPPED', s.x, s.y - 20 * z);
      return;
    }

    // --- Radar / detection radius (always visible) ---
    const radarR = car.radarRadius * z;
    const radarPulse = 0.5 + 0.5 * Math.sin(time * 3);

    // Outer radar ring — pulsing red/blue
    const flashPhase2 = Math.floor(time * 6) % 2;
    const radarColor = flashPhase2 === 0 ? '33,150,243' : '244,67,54'; // blue / red
    const radarAlpha = 0.12 + radarPulse * 0.10;

    // Filled danger zone
    ctx.beginPath();
    ctx.arc(s.x, s.y, radarR, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${radarColor},${radarAlpha})`;
    ctx.fill();

    // Radar ring border
    ctx.beginPath();
    ctx.arc(s.x, s.y, radarR, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${radarColor},${0.35 + radarPulse * 0.3})`;
    ctx.lineWidth = Math.max(1.5, 2 * z);
    ctx.stroke();

    // Inner pulsing sweep ring
    const sweepR = radarR * (0.4 + radarPulse * 0.6);
    ctx.beginPath();
    ctx.arc(s.x, s.y, sweepR, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${radarColor},${0.15 + radarPulse * 0.15})`;
    ctx.lineWidth = Math.max(1, 1.5 * z);
    ctx.stroke();

    // Flashing light glow effect when chasing
    if (car.sirenActive || car.isChasing) {
      const glowRadius = (30 + Math.sin(time * 16) * 10) * z;
      const blueAlpha = flashPhase === 0 ? 0.35 : 0.05;
      const redAlpha = flashPhase === 1 ? 0.35 : 0.05;

      // Blue glow
      ctx.beginPath();
      ctx.arc(s.x, s.y, glowRadius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(33,150,243,${blueAlpha})`;
      ctx.fill();

      // Red glow
      ctx.beginPath();
      ctx.arc(s.x, s.y, glowRadius * 0.8, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(244,67,54,${redAlpha})`;
      ctx.fill();

      // Chase range indicator (faint outer ring)
      const chaseR = car.chaseRange * z;
      ctx.beginPath();
      ctx.arc(s.x, s.y, chaseR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(244,67,54,0.08)`;
      ctx.lineWidth = 1;
      ctx.setLineDash([8 * z, 8 * z]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  drawPlayerPulse(car, camera, time) {
    const ctx = this.ctx;
    const s = camera.worldToScreen(car.x, car.y);
    const z = camera.zoom || 1;
    // Pulsate between 70-110 world-pixels radius
    const pulse = 0.5 + 0.5 * Math.sin(time * 4);
    const radius = (70 + pulse * 40) * z;
    const alpha = 0.25 + pulse * 0.2;
    ctx.beginPath();
    ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,215,0,${alpha})`;
    ctx.lineWidth = Math.max(1.5, 2.5 * z);
    ctx.stroke();
    // Inner glow
    ctx.beginPath();
    ctx.arc(s.x, s.y, radius * 0.7, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,215,0,${alpha * 0.4})`;
    ctx.lineWidth = Math.max(1, 1.5 * z);
    ctx.stroke();
  }

  drawParticles(particles, camera) {
    const ctx = this.ctx;
    const z = camera.zoom || 1;
    for (const p of particles.particles) {
      const s = camera.worldToScreen(p.x, p.y);
      const alpha = clamp(p.life / p.maxLife, 0, 1);
      if (p.type === 'smoke') {
        ctx.fillStyle = `rgba(200,200,200,${alpha * 0.5})`;
      } else if (p.type === 'exhaust') {
        ctx.fillStyle = `rgba(80,80,80,${alpha * 0.4})`;
      } else {
        ctx.fillStyle = `rgba(139,90,43,${alpha * 0.6})`;
      }
      ctx.beginPath();
      ctx.arc(s.x, s.y, p.size * z, 0, Math.PI*2);
      ctx.fill();
    }
  }
}
