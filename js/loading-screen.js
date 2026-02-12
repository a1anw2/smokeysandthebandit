// ============================================================
// LOADING SCREEN
// ============================================================
class LoadingScreen {
  draw(ctx, message, progress) {
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Title
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(message || 'LOADING...', CANVAS_W / 2, CANVAS_H / 2 - 40);

    // Progress bar background
    const barW = 400, barH = 14;
    const barX = CANVAS_W / 2 - barW / 2;
    const barY = CANVAS_H / 2;
    ctx.fillStyle = '#333';
    roundRect(ctx, barX, barY, barW, barH, 7);
    ctx.fill();

    // Progress bar fill
    const pct = clamp(progress || 0, 0, 1);
    if (pct > 0) {
      ctx.fillStyle = '#FFD700';
      roundRect(ctx, barX, barY, Math.max(barW * pct, 14), barH, 7);
      ctx.fill();
    }

    // Sub-text
    ctx.fillStyle = '#666';
    ctx.font = '14px monospace';
    ctx.fillText('Road data from OpenStreetMap', CANVAS_W / 2, CANVAS_H / 2 + 50);
  }
}
