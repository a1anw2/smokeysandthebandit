// ============================================================
// HUD
// ============================================================
class HUD {
  constructor() {
    this._minimapCache = null;
    this._minimapTrack = null;
    this._time = 0; // game time in seconds, updated each frame
  }

  setTime(t) { this._time = t; }

  drawSpeedometer(ctx, speed, maxSpeed) {
    const cx = CANVAS_W - 100, cy = CANVAS_H - 90, r = 55;
    // background
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.arc(cx, cy, r + 8, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // arc
    const startA = Math.PI * 0.8, endA = Math.PI * 2.2;
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 5, startA, endA);
    ctx.stroke();

    // colored arc
    const speedRatio = clamp(Math.abs(speed) / maxSpeed, 0, 1);
    const grad = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
    grad.addColorStop(0, '#4CAF50');
    grad.addColorStop(0.6, '#FFC107');
    grad.addColorStop(1, '#F44336');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 5, startA, startA + (endA - startA) * speedRatio);
    ctx.stroke();

    // needle
    const needleAngle = startA + (endA - startA) * speedRatio;
    ctx.strokeStyle = '#FF1744';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(needleAngle) * (r - 12), cy + Math.sin(needleAngle) * (r - 12));
    ctx.stroke();

    // center dot
    ctx.fillStyle = '#FF1744';
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI*2);
    ctx.fill();

    // digital speed (display as MPH)
    const mph = Math.round(Math.abs(speed) * 0.621371);
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(mph + '', cx, cy + 22);
    ctx.font = '10px monospace';
    ctx.fillText('mph', cx, cy + 34);

    // tick marks
    for (let i = 0; i <= 6; i++) {
      const a = startA + (endA - startA) * (i / 6);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (r - 14), cy + Math.sin(a) * (r - 14));
      ctx.lineTo(cx + Math.cos(a) * (r - 8), cy + Math.sin(a) * (r - 8));
      ctx.stroke();
    }
  }

  drawOdometer(ctx, distancePx) {
    // Convert pixels → meters → miles
    const meters = distancePx / PIXELS_PER_METER;
    const miles = meters / 1609.344;
    const label = miles >= 10 ? miles.toFixed(1) : miles.toFixed(2);
    const cx = CANVAS_W - 100, y = CANVAS_H - 22;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    roundRect(ctx, cx - 45, y - 10, 90, 18, 4);
    ctx.fill();
    ctx.fillStyle = '#CCC';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label + ' mi', cx, y + 2);
  }

  drawFinishDirection(ctx, playerX, playerY, finishX, finishY, camera) {
    const dx = finishX - playerX;
    const dy = finishY - playerY;
    const distWorld = Math.sqrt(dx * dx + dy * dy);
    if (distWorld < FINISH_RADIUS * 2) return; // close enough, hide arrow

    const angle = Math.atan2(dy, dx);

    // Position: to the left of the timer (timer is at CANVAS_W/2, y=10..60)
    const boxX = CANVAS_W / 2 - 170;
    const boxY = 10;
    const boxW = 60;
    const boxH = 50;

    // Background panel
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    roundRect(ctx, boxX, boxY, boxW, boxH, 6);
    ctx.fill();

    // Arrow in center of panel
    const acx = boxX + boxW / 2;
    const acy = boxY + 22;

    ctx.save();
    ctx.translate(acx, acy);
    ctx.rotate(angle);

    const arrowLen = 14;
    const arrowW = 7;

    // Pulsating glow (use raceTime passed via game loop)
    const pulse = 0.5 + 0.5 * Math.sin(this._time * 3.33);
    const alpha = 0.6 + pulse * 0.4;

    // Outer glow
    ctx.fillStyle = `rgba(255,215,0,${alpha * 0.3})`;
    ctx.beginPath();
    ctx.moveTo(arrowLen + 3, 0);
    ctx.lineTo(-arrowLen / 2 - 1, -arrowW - 3);
    ctx.lineTo(-arrowLen / 4 - 1, 0);
    ctx.lineTo(-arrowLen / 2 - 1, arrowW + 3);
    ctx.closePath();
    ctx.fill();

    // Main arrow
    ctx.fillStyle = `rgba(255,215,0,${alpha})`;
    ctx.beginPath();
    ctx.moveTo(arrowLen, 0);
    ctx.lineTo(-arrowLen / 2, -arrowW);
    ctx.lineTo(-arrowLen / 4, 0);
    ctx.lineTo(-arrowLen / 2, arrowW);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.7})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();

    // Distance label below arrow
    const meters = distWorld / PIXELS_PER_METER;
    let distLabel;
    if (meters >= 1609.344) {
      distLabel = (meters / 1609.344).toFixed(1) + ' mi';
    } else {
      distLabel = Math.round(meters) + ' m';
    }
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFD700';
    ctx.fillText(distLabel, acx, boxY + 43);
  }

  drawPoliceWarning(ctx, policeCars, playerX, playerY) {
    // Find nearest chasing police
    let nearestDist = Infinity;
    let anyChasing = false;
    for (const cop of policeCars) {
      if (!cop.isChasing) continue;
      anyChasing = true;
      const dx = cop.x - playerX, dy = cop.y - playerY;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < nearestDist) nearestDist = d;
    }
    if (!anyChasing) return;

    // Warning level based on distance
    const dangerDist = 300;
    if (nearestDist > 1200) return; // too far, no warning

    const danger = clamp(1 - nearestDist / dangerDist, 0, 1);
    const pulse = 0.5 + 0.5 * Math.sin(this._time * 6.67);

    // Screen edge flash when close
    if (danger > 0.3) {
      const flash = Math.floor(this._time * 5) % 2;
      const edgeAlpha = danger * 0.2 * pulse;
      ctx.fillStyle = flash === 0
        ? `rgba(33,150,243,${edgeAlpha})`
        : `rgba(244,67,54,${edgeAlpha})`;
      // Top edge strip
      ctx.fillRect(0, 0, CANVAS_W, 4);
      ctx.fillRect(0, CANVAS_H - 4, CANVAS_W, 4);
      ctx.fillRect(0, 0, 4, CANVAS_H);
      ctx.fillRect(CANVAS_W - 4, 0, 4, CANVAS_H);
    }

    // Warning text
    const warnX = CANVAS_W / 2;
    const warnY = 75;
    const alpha = 0.5 + pulse * 0.5;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';

    if (nearestDist < 150) {
      ctx.fillStyle = `rgba(244,67,54,${alpha})`;
      ctx.fillText('⚠ POLICE ON YOUR TAIL! ⚠', warnX, warnY);
    } else if (nearestDist < 500) {
      ctx.fillStyle = `rgba(255,193,7,${alpha})`;
      ctx.fillText('⚠ POLICE APPROACHING', warnX, warnY);
    } else {
      ctx.fillStyle = `rgba(255,255,255,${alpha * 0.5})`;
      ctx.fillText('POLICE ALERT', warnX, warnY);
    }
  }

  drawStreetName(ctx, name) {
    if (!name) return;
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    const tw = ctx.measureText(name).width;
    const pw = tw + 20, ph = 24;
    const x = CANVAS_W / 2, y = CANVAS_H - 55;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    roundRect(ctx, x - pw / 2, y - ph / 2, pw, ph, 5);
    ctx.fill();
    ctx.fillStyle = '#FFF';
    ctx.fillText(name, x, y + 1);
  }

  drawLapCounter(ctx, currentLap, totalLaps) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    roundRect(ctx, CANVAS_W - 160, 15, 145, 40, 6);
    ctx.fill();
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`LAP  ${Math.min(currentLap + 1, totalLaps)} / ${totalLaps}`, CANVAS_W - 25, 42);
  }

  // Progress bar for point-to-point mode
  drawProgressBar(ctx, raceProgress) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    roundRect(ctx, CANVAS_W - 160, 15, 145, 40, 6);
    ctx.fill();

    // Bar background
    const barX = CANVAS_W - 150, barY = 25, barW = 125, barH = 8;
    ctx.fillStyle = '#333';
    roundRect(ctx, barX, barY, barW, barH, 4);
    ctx.fill();

    // Bar fill
    const pct = clamp(raceProgress, 0, 1);
    if (pct > 0) {
      ctx.fillStyle = '#FFD700';
      roundRect(ctx, barX, barY, Math.max(barW * pct, 8), barH, 4);
      ctx.fill();
    }

    // Label
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(pct * 100)}% COMPLETE`, CANVAS_W - 25, 50);
  }

  drawPosition(ctx, position, total) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    roundRect(ctx, CANVAS_W - 160, 62, 145, 40, 6);
    ctx.fill();
    const suffix = position === 1 ? 'st' : position === 2 ? 'nd' : position === 3 ? 'rd' : 'th';
    const colors = { 1: '#FFD700', 2: '#C0C0C0', 3: '#CD7F32' };
    ctx.fillStyle = colors[position] || '#FFF';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${position}${suffix}`, CANVAS_W - 60, 90);
    ctx.fillStyle = '#AAA';
    ctx.font = '14px monospace';
    ctx.fillText(`/ ${total}`, CANVAS_W - 25, 90);
  }

  drawTimer(ctx, raceTime, bestLap, isOpenTrack) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    roundRect(ctx, CANVAS_W/2 - 100, 10, 200, 50, 6);
    ctx.fill();
    ctx.fillStyle = '#FFF';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('TIME', CANVAS_W/2, 28);
    ctx.font = 'bold 18px monospace';
    ctx.fillText(this.formatTime(raceTime), CANVAS_W/2, 48);
    if (!isOpenTrack && bestLap < Infinity) {
      ctx.font = '10px monospace';
      ctx.fillStyle = '#90CAF9';
      ctx.fillText('BEST ' + this.formatTime(bestLap), CANVAS_W/2, 58);
    }
  }

  formatTime(t) {
    const mins = Math.floor(t / 60);
    const secs = Math.floor(t % 60);
    const ms = Math.floor((t % 1) * 1000);
    return `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}.${String(ms).padStart(3,'0')}`;
  }

  drawMiniMap(ctx, track, cars, playerIdx) {
    const mapW = 180, mapH = 140;
    const mx = 15, my = CANVAS_H - mapH - 15;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    roundRect(ctx, mx, my, mapW, mapH, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const bounds = track.getBounds();
    const tw = bounds.maxX - bounds.minX, th = bounds.maxY - bounds.minY;
    const scale = Math.min((mapW - 20) / tw, (mapH - 20) / th);
    const ox = mx + mapW/2 - (tw * scale)/2 - bounds.minX * scale;
    const oy = my + mapH/2 - (th * scale)/2 - bounds.minY * scale;

    // Draw cached road geometry or circuit outline (only rebuilt when track changes)
    if (this._minimapTrack !== track) {
      this._minimapTrack = track;
      this._minimapCache = this._buildMinimapCache(track, mapW, mapH, scale, ox, oy, mx, my);
    }
    if (this._minimapCache) {
      ctx.drawImage(this._minimapCache, mx, my);
    }

    // car dots (dynamic — drawn every frame)
    for (let i = 0; i < cars.length; i++) {
      const car = cars[i];
      const sx = car.x * scale + ox, sy = car.y * scale + oy;

      if (car instanceof PoliceCar) {
        // Police: flashing blue/red dot
        const flash = Math.floor(this._time * 3.33) % 2;
        ctx.fillStyle = flash === 0 ? '#2196F3' : '#F44336';
        ctx.beginPath();
        ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
        ctx.fill();
        // Radar range on minimap
        const radarMini = car.radarRadius * scale;
        ctx.beginPath();
        ctx.arc(sx, sy, radarMini, 0, Math.PI * 2);
        ctx.strokeStyle = flash === 0 ? 'rgba(33,150,243,0.4)' : 'rgba(244,67,54,0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (car instanceof TrafficCar) {
        // Traffic: small grey dot
        ctx.fillStyle = '#888';
        ctx.beginPath();
        ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = car.color;
        ctx.beginPath();
        ctx.arc(sx, sy, i === playerIdx ? 4 : 3, 0, Math.PI * 2);
        ctx.fill();
        if (i === playerIdx) {
          ctx.strokeStyle = '#FFF';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }
  }

  _buildMinimapCache(track, mapW, mapH, scale, ox, oy, mx, my) {
    const cache = document.createElement('canvas');
    cache.width = mapW;
    cache.height = mapH;
    const c = cache.getContext('2d');
    // Offset so world coords map to cache-local coords
    const localOx = ox - mx;
    const localOy = oy - my;

    if (track.isOpenTrack && track.segments) {
      // Road network: draw all road segments
      c.strokeStyle = 'rgba(255,255,255,0.35)';
      c.lineWidth = 1.5;
      for (const seg of track.segments) {
        if (seg.points.length < 2) continue;
        c.beginPath();
        c.moveTo(seg.points[0].x * scale + localOx, seg.points[0].y * scale + localOy);
        for (let i = 1; i < seg.points.length; i++) {
          c.lineTo(seg.points[i].x * scale + localOx, seg.points[i].y * scale + localOy);
        }
        c.stroke();
      }

      // Start marker (green with "S" label)
      const sp = track.startPoint;
      const spx = sp.x * scale + localOx;
      const spy = sp.y * scale + localOy;
      c.fillStyle = '#4CAF50';
      c.beginPath();
      c.arc(spx, spy, 5, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#FFF';
      c.lineWidth = 1;
      c.stroke();
      c.fillStyle = '#FFF';
      c.font = 'bold 9px monospace';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('S', spx, spy);

      // Finish marker (gold flag with "F" label)
      const fp = track.finishPoint;
      const fpx = fp.x * scale + localOx;
      const fpy = fp.y * scale + localOy;
      // Outer glow
      c.fillStyle = 'rgba(255,215,0,0.3)';
      c.beginPath();
      c.arc(fpx, fpy, 9, 0, Math.PI * 2);
      c.fill();
      // Main circle
      c.fillStyle = '#FFD700';
      c.beginPath();
      c.arc(fpx, fpy, 6, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#FFF';
      c.lineWidth = 1.5;
      c.stroke();
      // "F" label
      c.fillStyle = '#000';
      c.font = 'bold 8px monospace';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('F', fpx, fpy);
      // Flag pole + pennant
      c.strokeStyle = '#FFD700';
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(fpx, fpy - 6);
      c.lineTo(fpx, fpy - 16);
      c.stroke();
      c.fillStyle = '#FFD700';
      c.beginPath();
      c.moveTo(fpx, fpy - 16);
      c.lineTo(fpx + 7, fpy - 13);
      c.lineTo(fpx, fpy - 10);
      c.closePath();
      c.fill();
    } else {
      // Circuit: draw track outline
      c.strokeStyle = 'rgba(255,255,255,0.4)';
      c.lineWidth = 2;
      c.beginPath();
      for (let i = 0; i < TRACK_SAMPLES; i += 5) {
        const p = track.points[i];
        const sx = p.x * scale + localOx, sy = p.y * scale + localOy;
        if (i === 0) c.moveTo(sx, sy); else c.lineTo(sx, sy);
      }
      c.closePath();
      c.stroke();
    }

    return cache;
  }

  drawWarningCounter(ctx, warnings, maxWarnings) {
    const x = CANVAS_W - 160, y = 62, w = 145, h = 35;
    const danger = warnings >= maxWarnings - 1 && warnings < maxWarnings;

    // Pulsing red glow when one away from busted
    if (danger) {
      const pulse = 0.5 + 0.5 * Math.sin(this._time * 6);
      ctx.fillStyle = `rgba(200,30,30,${0.3 + pulse * 0.3})`;
      roundRect(ctx, x - 2, y - 2, w + 4, h + 4, 8);
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    roundRect(ctx, x, y, w, h, 6);
    ctx.fill();

    // Label
    ctx.fillStyle = danger ? '#F44336' : '#AAA';
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('WARNINGS', x + 8, y + h / 2 + 3);

    // Strike circles
    const startX = x + 80;
    const iconY = y + h / 2;
    for (let i = 0; i < maxWarnings; i++) {
      const ix = startX + i * 22;
      if (i < warnings) {
        // Filled red circle with X — warning issued
        ctx.fillStyle = '#F44336';
        ctx.beginPath();
        ctx.arc(ix, iconY, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ix - 4, iconY - 4);
        ctx.lineTo(ix + 4, iconY + 4);
        ctx.moveTo(ix + 4, iconY - 4);
        ctx.lineTo(ix - 4, iconY + 4);
        ctx.stroke();
      } else {
        // Empty outline — no warning yet
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(ix, iconY, 8, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  drawWarningPopup(ctx, timer, maxDuration) {
    const alpha = clamp(timer / (maxDuration * 0.5), 0, 1);
    const flash = Math.floor(this._time * 5) % 2;
    const scale = 1 + (1 - alpha) * 0.1;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(CANVAS_W / 2, CANVAS_H / 2 - 50);
    ctx.scale(scale, scale);

    // Flashing red/blue background panel
    ctx.fillStyle = flash === 0
      ? 'rgba(33,80,200,0.6)'
      : 'rgba(200,30,30,0.6)';
    roundRect(ctx, -180, -35, 360, 70, 12);
    ctx.fill();

    // "WARNING!" text
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 42px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('WARNING!', 0, 0);

    ctx.restore();

    // Red vignette — screen-edge flash when a new warning fires
    const vigAlpha = clamp(timer / maxDuration, 0, 1) * 0.4;
    const vigGrad = ctx.createRadialGradient(
      CANVAS_W / 2, CANVAS_H / 2, CANVAS_W * 0.3,
      CANVAS_W / 2, CANVAS_H / 2, CANVAS_W * 0.7
    );
    vigGrad.addColorStop(0, 'rgba(200,30,30,0)');
    vigGrad.addColorStop(1, `rgba(200,30,30,${vigAlpha})`);
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.globalAlpha = 1;
  }

  drawTouchHint(ctx) {
    ctx.save();
    ctx.globalAlpha = 0.25;

    // Left half — steer zone
    ctx.fillStyle = '#2196F3';
    ctx.fillRect(0, 0, CANVAS_W / 2, CANVAS_H);
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('STEER', CANVAS_W / 4, CANVAS_H / 2);
    ctx.font = '11px monospace';
    ctx.fillText('< left | right >', CANVAS_W / 4, CANVAS_H / 2 + 20);

    // Right half top — brake zone
    ctx.fillStyle = '#F44336';
    ctx.fillRect(CANVAS_W / 2, 0, CANVAS_W / 2, CANVAS_H / 2);
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('BRAKE', CANVAS_W * 3 / 4, CANVAS_H / 4);

    // Right half bottom — gas zone
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(CANVAS_W / 2, CANVAS_H / 2, CANVAS_W / 2, CANVAS_H / 2);
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('GAS', CANVAS_W * 3 / 4, CANVAS_H * 3 / 4);
    ctx.font = '11px monospace';
    ctx.fillText('double-tap: drift', CANVAS_W * 3 / 4, CANVAS_H * 3 / 4 + 20);

    ctx.restore();
  }
}
