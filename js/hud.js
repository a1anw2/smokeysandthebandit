// ============================================================
// HUD
// ============================================================
class HUD {
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

    // Pulsating glow
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 300);
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
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 150);

    // Screen edge flash when close
    if (danger > 0.3) {
      const flash = Math.floor(Date.now() / 200) % 2;
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

    if (track.isOpenTrack && track.segments) {
      // Road network: draw all road segments
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1.5;
      for (const seg of track.segments) {
        if (seg.points.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(seg.points[0].x * scale + ox, seg.points[0].y * scale + oy);
        for (let i = 1; i < seg.points.length; i++) {
          ctx.lineTo(seg.points[i].x * scale + ox, seg.points[i].y * scale + oy);
        }
        ctx.stroke();
      }

      // Start marker (green)
      const sp = track.startPoint;
      ctx.fillStyle = '#4CAF50';
      ctx.beginPath();
      ctx.arc(sp.x * scale + ox, sp.y * scale + oy, 4, 0, Math.PI * 2);
      ctx.fill();

      // Finish marker (gold)
      const fp = track.finishPoint;
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(fp.x * scale + ox, fp.y * scale + oy, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Circuit: draw track outline
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < TRACK_SAMPLES; i += 5) {
        const p = track.points[i];
        const sx = p.x * scale + ox, sy = p.y * scale + oy;
        if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.stroke();
    }

    // car dots
    for (let i = 0; i < cars.length; i++) {
      const car = cars[i];
      const sx = car.x * scale + ox, sy = car.y * scale + oy;

      if (car instanceof PoliceCar) {
        // Police: flashing blue/red dot
        const flash = Math.floor(Date.now() / 300) % 2;
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
}
