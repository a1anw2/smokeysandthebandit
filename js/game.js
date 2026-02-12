// ============================================================
// GAME
// ============================================================
const GameState = { MENU: 0, MAP_SELECT: 1, LOADING: 2, COUNTDOWN: 3, RACING: 4, FINISHED: 5 };

class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.canvas.width = CANVAS_W;
    this.canvas.height = CANVAS_H;
    this.ctx = this.canvas.getContext('2d');
    this.input = new InputManager();
    this.track = new Track();
    this.camera = new Camera();
    this.renderer = new Renderer(this.canvas, this.ctx);
    this.hud = new HUD();
    this.particles = new ParticleSystem();
    this.sound = new SoundManager();
    this.state = GameState.MENU;
    this.countdownTimer = 0;
    this.countdownNum = 0;
    this.raceTime = 0;
    this.showMiniMap = true;
    this.cars = [];
    this.player = null;
    this.lastTime = 0;
    this.soundStarted = false;

    // OSM components
    this.osmLoader = new OSMLoader();
    this.mapPicker = new MapPicker();
    this.loadingScreen = new LoadingScreen();
    this.loadingMessage = '';
    this.loadingProgress = 0;
    this.trackMode = TRACK_MODE_CIRCUIT;

    this._resize();
    window.addEventListener('resize', () => this._resize());

    this.renderer.preRenderTrack(this.track);
    this._setupRace();
    requestAnimationFrame(t => this._loop(t));
  }

  _resize() {
    const ratio = CANVAS_W / CANVAS_H;
    let w = window.innerWidth, h = window.innerHeight;
    if (w / h > ratio) { w = h * ratio; } else { h = w / ratio; }
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
  }

  _setupRace() {
    this.cars = [];
    this.policeCars = [];
    this.raceTime = 0;
    this.arrested = false;
    this.particles = new ParticleSystem();

    const profiles = [
      { color: COLORS.ai[0], name: 'ROSSO',   skill: 0.94, aggr: 0.75, speed: 0.96, line: -0.3 },
      { color: COLORS.ai[1], name: 'AZURE',   skill: 0.88, aggr: 0.65, speed: 0.93, line: 0.2 },
      { color: COLORS.ai[2], name: 'VERDE',   skill: 0.82, aggr: 0.7,  speed: 0.90, line: 0 },
      { color: COLORS.ai[3], name: 'VIOLA',   skill: 0.76, aggr: 0.55, speed: 0.86, line: 0.4 },
    ];

    if (this.track.isOpenTrack) {
      // Point-to-point: player at start, police scattered around the map
      const startInfo = this.track.getNearestRoad(this.track.startPoint.x, this.track.startPoint.y);
      const startAngle = startInfo ? startInfo.angle : 0;
      const startX = this.track.startPoint.x;
      const startY = this.track.startPoint.y;

      // Player at start
      this.player = new PlayerCar(startX, startY, startAngle);
      this.cars.push(this.player);

      // Scatter police cars along road segments
      this._spawnPolice();
    } else {
      // Circuit: original grid placement with AI racers (no police)
      const gridPositions = 5;
      for (let i = 0; i < gridPositions; i++) {
        const t = (-i * 0.006 + 1) % 1;
        const pt = this.track.getPointAt(t);
        const n = this.track.getNormalAt(t);
        const tan = this.track.getTangentAt(t);
        const angle = Math.atan2(tan.y, tan.x);
        const offset = (i % 2 === 0) ? 18 : -18;
        const x = pt.x + n.x * offset;
        const y = pt.y + n.y * offset;

        if (i === 2) {
          this.player = new PlayerCar(x, y, angle);
          this.cars.push(this.player);
        } else {
          const pi = i < 2 ? i : i - 1;
          const p = profiles[pi];
          const ai = new AICar(x, y, angle, p.color, p.name, p.skill, p.aggr, p.speed, p.line);
          this.cars.push(ai);
        }
      }
    }

    this.camera.x = this.player.x;
    this.camera.y = this.player.y;
  }

  _spawnPolice() {
    const NUM_POLICE = 15;
    const bounds = this.track.getBounds();
    const startX = this.track.startPoint.x;
    const startY = this.track.startPoint.y;
    const minDistFromStart = 600; // don't spawn too close to start

    // Collect candidate positions from road segments
    const candidates = [];
    for (const seg of this.track.segments) {
      if (seg.points.length < 2) continue;
      // Sample midpoint-ish positions along each segment
      const step = Math.max(1, Math.floor(seg.points.length / 3));
      for (let i = step; i < seg.points.length - 1; i += step) {
        const p = seg.points[i];
        const dStart = Math.sqrt((p.x - startX) * (p.x - startX) + (p.y - startY) * (p.y - startY));
        if (dStart < minDistFromStart) continue;

        // Compute angle from adjacent points
        const prev = seg.points[i - 1], next = seg.points[Math.min(i + 1, seg.points.length - 1)];
        const angle = Math.atan2(next.y - prev.y, next.x - prev.x);
        candidates.push({ x: p.x, y: p.y, angle });
      }
    }

    // Shuffle candidates
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    // Pick up to NUM_POLICE, ensuring they're spread apart
    const minPoliceSpacing = 400;
    const chosen = [];
    for (const c of candidates) {
      if (chosen.length >= NUM_POLICE) break;
      let tooClose = false;
      for (const p of chosen) {
        const d = Math.sqrt((c.x - p.x) * (c.x - p.x) + (c.y - p.y) * (c.y - p.y));
        if (d < minPoliceSpacing) { tooClose = true; break; }
      }
      if (!tooClose) {
        chosen.push(c);
      }
    }

    for (const c of chosen) {
      const cop = new PoliceCar(c.x, c.y, c.angle);
      this.policeCars.push(cop);
      this.cars.push(cop);
    }
  }

  // ---- OSM Loading Flow ----

  async _onLocationSelected(lat, lng, startLL, finishLL) {
    this.state = GameState.LOADING;
    this.loadingProgress = 0.05;
    this.loadingMessage = 'Fetching roads (trying servers...)';

    try {
      // Step 1: Fetch from Overpass API (tries multiple servers)
      this.loadingProgress = 0.1;
      const ways = await this.osmLoader.fetchRoads(lat, lng, OSM_FETCH_RADIUS);

      if (ways.length === 0) {
        this.loadingMessage = 'No roads found here. Try a more urban area.';
        setTimeout(() => { this.state = GameState.MENU; }, 2500);
        return;
      }

      // Step 2: Build road segments
      this.loadingMessage = 'Building road network...';
      this.loadingProgress = 0.3;
      const segments = this.osmLoader.buildRoadSegments(ways, lat, lng);

      if (segments.length === 0) {
        this.loadingMessage = 'Could not build roads. Try a different area.';
        setTimeout(() => { this.state = GameState.MENU; }, 2500);
        return;
      }

      // Step 3: Fetch map tiles (buildings, parks, water etc. from OSM raster tiles)
      this.loadingMessage = 'Fetching map tiles...';
      this.loadingProgress = 0.45;
      let tiles = [];
      try {
        tiles = await this.osmLoader.fetchTiles(
          lat, lng, OSM_FETCH_RADIUS,
          lat, lng,
          this.osmLoader._lastOffsetX, this.osmLoader._lastOffsetY
        );
      } catch (e) {
        console.warn('Tile fetch failed (non-fatal):', e);
      }

      // Step 4: Find start/finish — use user-picked points or auto-find
      this.loadingMessage = 'Setting up race route...';
      this.loadingProgress = 0.6;

      let start, finish;
      if (startLL && finishLL) {
        // Convert user-picked lat/lng to game coordinates
        start = this.osmLoader.latLngToGamePoint(startLL.lat, startLL.lng, lat, lng, segments);
        finish = this.osmLoader.latLngToGamePoint(finishLL.lat, finishLL.lng, lat, lng, segments);
      } else {
        const result = this.osmLoader.findStartFinish(segments);
        start = result.start;
        finish = result.finish;
        const sfDist = result.distance;
        if (!start || !finish || sfDist < 200) {
          this.loadingMessage = 'Area too small. Try a different area.';
          setTimeout(() => { this.state = GameState.MENU; }, 2500);
          return;
        }
      }

      if (!start || !finish) {
        this.loadingMessage = 'Could not place start/finish. Try different points.';
        setTimeout(() => { this.state = GameState.MENU; }, 2500);
        return;
      }

      // Step 5: Create RoadNetwork
      this.loadingMessage = 'Rendering track...';
      this.loadingProgress = 0.8;

      // Use a small delay to let the loading screen render
      await new Promise(r => setTimeout(r, 50));

      this.track = new RoadNetwork(segments, start, finish, tiles);
      this.trackMode = TRACK_MODE_POINT_TO_POINT;
      this.renderer.preRenderTrack(this.track);

      // Step 5: Setup race
      this.loadingMessage = 'Ready!';
      this.loadingProgress = 1.0;
      this._setupRace();

      await new Promise(r => setTimeout(r, 300));

      this.state = GameState.COUNTDOWN;
      this.countdownTimer = 3.5;
      this.countdownNum = 3;

    } catch (err) {
      console.error('OSM loading error:', err);
      this.loadingMessage = 'Error: ' + (err.message || 'Failed to load roads');
      setTimeout(() => { this.state = GameState.MENU; }, 3000);
    }
  }

  // ---- Main Loop ----

  _loop(timestamp) {
    let dt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;
    dt = Math.min(dt, 0.05);
    if (dt <= 0) dt = 1/60;

    this._update(dt);
    this._render();
    this.input.clear();
    requestAnimationFrame(t => this._loop(t));
  }

  _update(dt) {
    if (this.input.wasPressed('Tab')) this.showMiniMap = !this.showMiniMap;
    if (this.input.wasPressed('KeyN')) this.sound.toggle();
    if (this.input.isDown('Minus') || this.input.isDown('NumpadSubtract')) this.camera.zoomOut();
    if (this.input.isDown('Equal') || this.input.isDown('NumpadAdd')) this.camera.zoomIn();

    switch (this.state) {
      case GameState.MENU:
        if (this.input.wasPressed('Enter') || this.input.wasPressed('Space')) {
          // Classic circuit mode
          if (!this.soundStarted) { this.sound.init(); this.soundStarted = true; }
          this.trackMode = TRACK_MODE_CIRCUIT;
          this.track = new Track();
          this.renderer.preRenderTrack(this.track);
          this._setupRace();
          this.state = GameState.COUNTDOWN;
          this.countdownTimer = 3.5;
          this.countdownNum = 3;
        }
        if (this.input.wasPressed('KeyM')) {
          // Open road mode
          if (!this.soundStarted) { this.sound.init(); this.soundStarted = true; }
          this.state = GameState.MAP_SELECT;
          this.mapPicker.onCancel = () => { this.state = GameState.MENU; };
          this.mapPicker.show((lat, lng, startLL, finishLL) => this._onLocationSelected(lat, lng, startLL, finishLL));
        }
        break;

      case GameState.MAP_SELECT:
        // Map picker handles its own UI via DOM
        if (this.input.wasPressed('Escape')) {
          this.mapPicker.hide();
          this.state = GameState.MENU;
        }
        break;

      case GameState.LOADING:
        // Nothing to update — async loading handles state transitions
        break;

      case GameState.COUNTDOWN:
        this.countdownTimer -= dt;
        const newNum = Math.ceil(this.countdownTimer);
        if (newNum !== this.countdownNum && newNum >= 1) {
          this.countdownNum = newNum;
          this.sound.playBeep(440, 0.15);
        }
        if (this.countdownTimer <= 0) {
          this.state = GameState.RACING;
          this.sound.playBeep(880, 0.3);
        }
        this.camera.update(this.player, dt);
        break;

      case GameState.RACING:
        this.raceTime += dt;
        for (const car of this.cars) car.totalTime = this.raceTime;

        this.player.handleInput(this.input);
        this.player.update(dt, this.track);

        for (const car of this.cars) {
          if (car instanceof PoliceCar) {
            car.updatePolice(dt, this.track, this.player, this.cars);
            car.update(dt, this.track);
          } else if (car instanceof AICar) {
            car.updateAI(dt, this.track, this.cars);
            car.update(dt, this.track);
          }
        }

        // Check for arrest (open road only)
        if (this.track.isOpenTrack) {
          for (const cop of this.policeCars) {
            if (cop.checkArrest(this.player)) {
              this.arrested = true;
              this.state = GameState.FINISHED;
              this.sound.silence();
              break;
            }
          }
        }

        // boundary collisions
        if (this.track.isOpenTrack) {
          // Open road: strong push back toward nearest road when off-road
          for (const car of this.cars) {
            const surface = this.track.getSurface(car.x, car.y);
            if (surface === 'grass') {
              const roadInfo = this.track.getNearestRoad(car.x, car.y);
              if (roadInfo) {
                const dx = roadInfo.x - car.x, dy = roadInfo.y - car.y;
                const d = Math.sqrt(dx * dx + dy * dy) || 1;
                const nx = dx / d, ny = dy / d;
                // Strong push — scales with distance off-road
                const pushStr = Math.min(d * 0.4, 20);
                car.x += nx * pushStr;
                car.y += ny * pushStr;
                // Heavy speed penalty off-road
                car.speed *= 0.93;
                // Kill lateral velocity to prevent drifting further off
                const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
                const rx = -Math.sin(car.angle), ry = Math.cos(car.angle);
                const latComp = car.vx * rx + car.vy * ry;
                car.vx -= rx * latComp * 0.5;
                car.vy -= ry * latComp * 0.5;
                // Also steer car back toward road
                const toRoadAngle = Math.atan2(dy, dx);
                const angleDiff = toRoadAngle - car.angle;
                // Normalize angle
                const norm = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
                car.angle += norm * 0.08;
              }
            } else if (surface === 'curb') {
              // Curb: mild correction to keep car on road
              const roadInfo = this.track.getNearestRoad(car.x, car.y);
              if (roadInfo) {
                const dx = roadInfo.x - car.x, dy = roadInfo.y - car.y;
                const d = Math.sqrt(dx * dx + dy * dy) || 1;
                car.x += (dx / d) * 1.5;
                car.y += (dy / d) * 1.5;
                car.speed *= 0.98;
              }
            }
          }
        } else {
          for (const car of this.cars) car.collideWithBoundary(this.track);
        }

        // car-to-car collisions
        for (let i = 0; i < this.cars.length; i++) {
          for (let j = i+1; j < this.cars.length; j++) {
            const a = this.cars[i], b = this.cars[j];
            const dx = b.x - a.x, dy = b.y - a.y;
            const d = Math.sqrt(dx*dx + dy*dy);
            const minDist = 28;
            if (d < minDist && d > 0) {
              const nx = dx/d, ny = dy/d;
              const overlap = (minDist - d) / 2;
              a.x -= nx * overlap; a.y -= ny * overlap;
              b.x += nx * overlap; b.y += ny * overlap;
              const relV = dot(b.vx - a.vx, b.vy - a.vy, nx, ny);
              if (relV < 0) {
                a.vx += nx * relV * 0.5; a.vy += ny * relV * 0.5;
                b.vx -= nx * relV * 0.5; b.vy -= ny * relV * 0.5;
                a.speed *= 0.92; b.speed *= 0.92;
              }
            }
          }
        }

        // particles
        for (const car of this.cars) {
          if (car.isDrifting) {
            const cos = Math.cos(car.angle), sin = Math.sin(car.angle);
            const rx = -sin, ry = cos;
            for (const s of [-1, 1]) {
              const wx = car.x - cos * car.length * 0.35 + rx * s * car.width * 0.4;
              const wy = car.y - sin * car.length * 0.35 + ry * s * car.width * 0.4;
              this.particles.emit(wx, wy, (Math.random()-0.5)*20, (Math.random()-0.5)*20 - 10, 'smoke');
              this.particles.addSkidMark(wx, wy, 0.6);
            }
          }
          if (car.throttle > 0.5 && Math.abs(car.speed) > 50) {
            const cos = Math.cos(car.angle), sin = Math.sin(car.angle);
            const ex = car.x - cos * car.length * 0.5;
            const ey = car.y - sin * car.length * 0.5;
            this.particles.emit(ex, ey, -cos*15 + (Math.random()-0.5)*5, -sin*15 + (Math.random()-0.5)*5, 'exhaust');
          }
          if (car.surfaceType === 'grass' && Math.abs(car.speed) > 30) {
            this.particles.emit(car.x, car.y, (Math.random()-0.5)*30, (Math.random()-0.5)*30, 'dirt');
          }
        }
        this.particles.update(dt);

        this.camera.update(this.player, dt);
        this.sound.update(this.player.speed, this.player.throttle, this.player.maxSpeed);

        // check finish
        if (this.track.isOpenTrack) {
          // Point-to-point: car.js sets finished flag
          if (this.player.finished) {
            this.state = GameState.FINISHED;
            this.sound.silence();
          }
        } else {
          // Circuit
          if (this.player.currentLap >= TOTAL_LAPS) {
            this.player.finished = true;
            this.state = GameState.FINISHED;
            this.sound.silence();
          }
          for (const car of this.cars) {
            if (car instanceof AICar && car.currentLap >= TOTAL_LAPS) {
              car.finished = true;
            }
          }
        }
        break;

      case GameState.FINISHED:
        if (this.input.wasPressed('Enter') || this.input.wasPressed('Space')) {
          // Restart same track
          this._setupRace();
          this.state = GameState.COUNTDOWN;
          this.countdownTimer = 3.5;
          this.countdownNum = 3;
        }
        if (this.input.wasPressed('KeyM')) {
          // New open road
          this.state = GameState.MAP_SELECT;
          this.mapPicker.onCancel = () => { this.state = GameState.MENU; };
          this.mapPicker.show((lat, lng, startLL, finishLL) => this._onLocationSelected(lat, lng, startLL, finishLL));
        }
        if (this.input.wasPressed('Escape')) {
          this.state = GameState.MENU;
        }
        break;
    }
  }

  _getPositions() {
    // Exclude police from race positions
    const racers = this.cars.filter(c => !(c instanceof PoliceCar));
    const sorted = [...racers].sort((a, b) => b.raceProgress - a.raceProgress);
    const playerPos = sorted.indexOf(this.player) + 1;
    return { sorted, playerPos };
  }

  _render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    if (this.state === GameState.MENU) {
      this._renderMenu();
      return;
    }

    if (this.state === GameState.MAP_SELECT) {
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      return;
    }

    if (this.state === GameState.LOADING) {
      this.loadingScreen.draw(ctx, this.loadingMessage, this.loadingProgress);
      return;
    }

    // game view
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    this.renderer.drawTrack(this.camera, this.track);
    this.renderer.drawSkidMarks(this.particles, this.camera);

    const sortedCars = [...this.cars].sort((a, b) => a.y - b.y);
    for (const car of sortedCars) {
      if (car instanceof PoliceCar) {
        this.renderer.drawPoliceCar(car, this.camera, this.raceTime);
      } else {
        this.renderer.drawCar(car, this.camera);
      }
    }
    this.renderer.drawPlayerPulse(this.player, this.camera, this.raceTime);
    this.renderer.drawParticles(this.particles, this.camera);

    // HUD
    const { sorted, playerPos } = this._getPositions();
    this.hud.drawSpeedometer(ctx, this.player.speed, this.player.maxSpeed);
    this.hud.drawOdometer(ctx, this.player.distancePx);
    if (this.track.isOpenTrack && this.track.getRoadName) {
      this.hud.drawStreetName(ctx, this.track.getRoadName(this.player.x, this.player.y));
    }

    if (this.track.isOpenTrack) {
      this.hud.drawProgressBar(ctx, this.player.raceProgress);
      this.hud.drawFinishDirection(ctx, this.player.x, this.player.y, this.track.finishPoint.x, this.track.finishPoint.y, this.camera);
      if (this.policeCars && this.policeCars.length > 0) {
        this.hud.drawPoliceWarning(ctx, this.policeCars, this.player.x, this.player.y);
      }
    } else {
      this.hud.drawLapCounter(ctx, this.player.currentLap, TOTAL_LAPS);
    }

    if (!this.track.isOpenTrack) {
      this.hud.drawPosition(ctx, playerPos, this.cars.length);
    }
    this.hud.drawTimer(ctx, this.raceTime, this.player.bestLap, this.track.isOpenTrack);
    if (this.showMiniMap) {
      this.hud.drawMiniMap(ctx, this.track, this.cars, this.cars.indexOf(this.player));
    }

    // zoom indicator
    const zoomPct = Math.round(this.camera.zoom * 100);
    if (Math.abs(this.camera.zoom - 1.0) > 0.02) {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      roundRect(ctx, CANVAS_W/2 - 35, CANVAS_H - 35, 70, 22, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${zoomPct}%`, CANVAS_W/2, CANVAS_H - 20);
    }

    // controls hint
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('TAB: map  N: sound  -/+: zoom', 10, 20);

    // countdown overlay
    if (this.state === GameState.COUNTDOWN) {
      this._renderCountdown();
    }

    // finish overlay
    if (this.state === GameState.FINISHED) {
      this._renderFinish(sorted);
    }
  }

  _renderMenu() {
    const ctx = this.ctx;
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Animated city grid background
    const t = Date.now() / 1000;
    ctx.strokeStyle = 'rgba(33,150,243,0.06)';
    ctx.lineWidth = 1;
    // Vertical roads
    for (let x = 0; x < CANVAS_W; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_H);
      ctx.stroke();
    }
    // Horizontal roads
    for (let y = 0; y < CANVAS_H; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_W, y);
      ctx.stroke();
    }

    // Animated police lights sweeping across background
    const flash = Math.floor(t * 3) % 2;
    for (let i = 0; i < 6; i++) {
      const px = (i * 220 + t * 40) % (CANVAS_W + 200) - 100;
      const py = 180 + Math.sin(i * 1.7 + t * 0.5) * 120;
      const col = (i + flash) % 2 === 0 ? 'rgba(33,100,243,0.08)' : 'rgba(244,67,54,0.06)';
      ctx.beginPath();
      ctx.arc(px, py + 200, 50, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
    }

    // Dark gradient overlay for readability
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    grad.addColorStop(0, 'rgba(10,10,20,0.9)');
    grad.addColorStop(0.4, 'rgba(10,10,20,0.7)');
    grad.addColorStop(0.7, 'rgba(10,10,20,0.8)');
    grad.addColorStop(1, 'rgba(10,10,20,0.95)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // title with glow
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 58px monospace';
    // Glow
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#FFD700';
    ctx.fillText('THE CANNONBALL RUN', CANVAS_W/2, 70);
    ctx.shadowBlur = 0;
    ctx.restore();

    // subtitle
    ctx.textAlign = 'center';
    ctx.fillStyle = '#F44336';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('Illegal Street Racing — Evade The Police!', CANVAS_W/2, 100);

    // Rules panel
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    roundRect(ctx, CANVAS_W/2 - 320, 120, 640, 160, 10);
    ctx.fill();

    ctx.textAlign = 'left';
    const rulesX = CANVAS_W/2 - 290;
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('HOW TO PLAY:', rulesX, 145);

    ctx.fillStyle = '#CCC';
    ctx.font = '12px monospace';
    const rules = [
      '1. Pick a city, then choose your START and FINISH points',
      '2. Race through real streets to reach the finish line',
      '3. AVOID POLICE — stay out of their red/blue radar zone!',
      '4. If you enter a police radar zone, you are BUSTED!',
      '5. Police will chase you, but you CAN outrun them',
      '6. Reach the finish before getting caught to win!',
    ];
    for (let i = 0; i < rules.length; i++) {
      ctx.fillText(rules[i], rulesX, 165 + i * 18);
    }

    // Controls
    ctx.fillStyle = '#777';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Arrow Keys / WASD - Drive    SPACE - Drift    TAB - Map    N - Sound    -/+ Zoom', CANVAS_W/2, 298);

    // Mode options
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 400);

    ctx.fillStyle = `rgba(144,202,249,${0.4 + pulse * 0.6})`;
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('M - START THE CANNONBALL RUN', CANVAS_W/2, CANVAS_H/2 + 55);

    ctx.fillStyle = `rgba(255,255,255,${0.2 + pulse * 0.3})`;
    ctx.font = '14px monospace';
    ctx.fillText('ENTER - Circuit Race (no police)', CANVAS_W/2, CANVAS_H/2 + 85);

    // Animated chase scene at bottom
    const chaseY = CANVAS_H - 130;
    // Road strip
    ctx.fillStyle = 'rgba(60,60,60,0.5)';
    ctx.fillRect(0, chaseY - 15, CANVAS_W, 30);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([20, 20]);
    ctx.beginPath();
    ctx.moveTo(0, chaseY);
    ctx.lineTo(CANVAS_W, chaseY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Player car (gold) being chased
    const carX = (t * 80) % (CANVAS_W + 300) - 100;
    ctx.save();
    ctx.translate(carX, chaseY);
    ctx.fillStyle = '#FFD700';
    roundRect(ctx, -15, -8, 30, 16, 3);
    ctx.fill();
    ctx.restore();

    // Police car chasing (behind player)
    const copX = carX - 120;
    const copFlash = Math.floor(t * 8) % 2;
    ctx.save();
    ctx.translate(copX, chaseY);
    ctx.fillStyle = '#1A1A2E';
    roundRect(ctx, -15, -8, 30, 16, 3);
    ctx.fill();
    // Siren light
    ctx.fillStyle = copFlash === 0 ? '#2196F3' : '#F44336';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    // Radar ring
    const radarPulse = 0.5 + 0.5 * Math.sin(t * 3);
    ctx.beginPath();
    ctx.arc(0, 0, 25 + radarPulse * 10, 0, Math.PI * 2);
    ctx.strokeStyle = copFlash === 0 ? 'rgba(33,150,243,0.3)' : 'rgba(244,67,54,0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // Second police car further behind
    const cop2X = carX - 260;
    ctx.save();
    ctx.translate(cop2X, chaseY);
    ctx.fillStyle = '#1A1A2E';
    roundRect(ctx, -15, -8, 30, 16, 3);
    ctx.fill();
    ctx.fillStyle = copFlash === 1 ? '#2196F3' : '#F44336';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // City silhouette labels
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    const cityNames = ['RICHMOND', 'CHICAGO', 'NEW YORK', 'LONDON', 'PARIS'];
    for (let i = 0; i < cityNames.length; i++) {
      ctx.fillText(cityNames[i], 130 + i * 230, CANVAS_H - 50);
    }
  }

  _renderCountdown() {
    const ctx = this.ctx;
    const num = Math.ceil(this.countdownTimer);
    if (num >= 1 && num <= 3) {
      const frac = this.countdownTimer % 1;
      const scale = 1 + frac * 0.3;
      ctx.save();
      ctx.translate(CANVAS_W/2, CANVAS_H/2);
      ctx.scale(scale, scale);
      ctx.fillStyle = '#E53935';
      ctx.font = 'bold 120px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = 0.5 + frac * 0.5;
      ctx.fillText(num + '', 0, 0);
      ctx.restore();
    } else if (num <= 0) {
      ctx.fillStyle = '#4CAF50';
      ctx.font = 'bold 80px monospace';
      ctx.textAlign = 'center';
      ctx.globalAlpha = clamp(this.countdownTimer + 1, 0, 1);
      ctx.fillText('GO!', CANVAS_W/2, CANVAS_H/2);
      ctx.globalAlpha = 1;
    }
  }

  _renderFinish(sorted) {
    const ctx = this.ctx;

    if (this.arrested) {
      this._renderArrested();
      return;
    }

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CANNONBALL COMPLETE!', CANVAS_W/2, 120);

    const isOpen = this.track.isOpenTrack;

    // results table
    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = '#AAA';
    const cols = [CANVAS_W/2 - 200, CANVAS_W/2 - 80, CANVAS_W/2 + 50, CANVAS_W/2 + 170];
    ctx.textAlign = 'left';
    ctx.fillText('POS', cols[0], 180);
    ctx.fillText('NAME', cols[1], 180);
    ctx.fillText('TIME', cols[2], 180);
    if (!isOpen) ctx.fillText('BEST LAP', cols[3], 180);

    ctx.font = '15px monospace';
    for (let i = 0; i < sorted.length; i++) {
      const car = sorted[i];
      const y = 210 + i * 30;
      const isPlayer = car === this.player;
      if (isPlayer) {
        ctx.fillStyle = 'rgba(255,215,0,0.15)';
        ctx.fillRect(cols[0] - 10, y - 16, 440, 26);
      }
      ctx.fillStyle = isPlayer ? '#FFD700' : '#DDD';
      const suffix = (i+1) === 1 ? 'st' : (i+1) === 2 ? 'nd' : (i+1) === 3 ? 'rd' : 'th';
      ctx.textAlign = 'left';
      ctx.fillText(`${i+1}${suffix}`, cols[0], y);
      ctx.fillStyle = car.color;
      ctx.fillText(car.name, cols[1], y);
      ctx.fillStyle = isPlayer ? '#FFD700' : '#DDD';
      if (isOpen) {
        ctx.fillText(this.hud.formatTime(this.raceTime), cols[2], y);
      } else {
        const totalT = car.lapTimes.reduce((a,b) => a+b, 0);
        ctx.fillText(this.hud.formatTime(totalT || this.raceTime), cols[2], y);
        ctx.fillText(car.bestLap < Infinity ? this.hud.formatTime(car.bestLap) : '--:--.---', cols[3], y);
      }
    }

    // restart prompt
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 400);
    ctx.fillStyle = `rgba(255,255,255,${0.4 + pulse * 0.6})`;
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ENTER - Race Again    M - New Road    ESC - Menu', CANVAS_W/2, CANVAS_H - 70);
  }

  _renderArrested() {
    const ctx = this.ctx;

    // Flashing red/blue overlay
    const flash = Math.floor(Date.now() / 300) % 2;
    ctx.fillStyle = flash === 0 ? 'rgba(33,80,200,0.4)' : 'rgba(200,30,30,0.4)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Dark center panel
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    roundRect(ctx, CANVAS_W/2 - 300, 80, 600, 340, 16);
    ctx.fill();

    // BUSTED title
    const pulse = 0.7 + 0.3 * Math.sin(Date.now() / 200);
    ctx.fillStyle = `rgba(244,67,54,${pulse})`;
    ctx.font = 'bold 72px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('BUSTED!', CANVAS_W/2, 170);

    // Subtitle
    ctx.fillStyle = '#CCC';
    ctx.font = '18px monospace';
    ctx.fillText('You were caught by the police!', CANVAS_W/2, 220);

    // Stats
    ctx.font = '15px monospace';
    ctx.fillStyle = '#AAA';
    const meters = this.player.distancePx / PIXELS_PER_METER;
    const miles = meters / 1609.344;
    const pct = Math.round(this.player.raceProgress * 100);
    ctx.fillText(`Distance: ${miles.toFixed(2)} mi`, CANVAS_W/2, 270);
    ctx.fillText(`Progress: ${pct}%`, CANVAS_W/2, 295);
    ctx.fillText(`Time: ${this.hud.formatTime(this.raceTime)}`, CANVAS_W/2, 320);

    // Hint
    ctx.fillStyle = '#F44336';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('TIP: Stay out of the radar zone! You can outrun them.', CANVAS_W/2, 365);

    // Restart prompt
    const p2 = 0.5 + 0.5 * Math.sin(Date.now() / 400);
    ctx.fillStyle = `rgba(255,255,255,${0.4 + p2 * 0.6})`;
    ctx.font = 'bold 16px monospace';
    ctx.fillText('ENTER - Race Again    M - New Road    ESC - Menu', CANVAS_W/2, CANVAS_H - 70);
  }
}

// ============================================================
// INITIALIZATION
// ============================================================
window.addEventListener('load', () => { new Game(); });
