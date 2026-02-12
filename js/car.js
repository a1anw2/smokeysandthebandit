// ============================================================
// CAR (BASE)
// ============================================================
class Car {
  constructor(x, y, angle, color, name) {
    this.x = x; this.y = y; this.angle = angle;
    this.color = color; this.name = name;
    this.vx = 0; this.vy = 0;
    this.speed = 0;
    this.angularVel = 0;
    this.width = 20; this.length = 38;

    this.maxSpeed = 340;
    this.accel = 220;
    this.brakeForce = 380;
    this.turnRate = 2.6;
    this.gripFactor = 1.0;
    this.driftFactor = 0.92;
    this.drag = 0.0008;
    this.rollingResist = 0.4;

    this.throttle = 0; this.brake = 0;
    this.steerInput = 0; this.handbrake = false;
    this.isDrifting = false;
    this.surfaceType = 'asphalt';

    this.currentLap = 0; this.lapProgress = 0;
    this.lastCheckpoint = 0;
    this.checkpointsHit = new Set();
    this.lapTimes = []; this.lapStartTime = 0;
    this.bestLap = Infinity;
    this.finished = false;
    this.totalTime = 0;
    this.raceProgress = 0;
    this.distancePx = 0; // total distance in pixels
  }

  getCorners() {
    const cos = Math.cos(this.angle), sin = Math.sin(this.angle);
    const hw = this.width/2, hl = this.length/2;
    return [
      { x: this.x + cos*hl - sin*hw, y: this.y + sin*hl + cos*hw },
      { x: this.x + cos*hl + sin*hw, y: this.y + sin*hl - cos*hw },
      { x: this.x - cos*hl - sin*hw, y: this.y - sin*hl + cos*hw },
      { x: this.x - cos*hl + sin*hw, y: this.y - sin*hl - cos*hw },
    ];
  }

  update(dt, track) {
    this.surfaceType = track.getSurface(this.x, this.y);
    let surfaceGrip = 1.0, surfaceDrag = 0;
    if (this.surfaceType === 'curb') { surfaceGrip = 0.85; surfaceDrag = 10; }
    else if (this.surfaceType === 'grass') { surfaceGrip = 0.45; surfaceDrag = 80; }

    // longitudinal
    let fwd = 0;
    if (this.throttle > 0) fwd = this.accel * this.throttle * surfaceGrip;
    if (this.brake > 0) fwd -= this.brakeForce * this.brake;
    fwd -= this.speed * Math.abs(this.speed) * this.drag;
    fwd -= this.rollingResist * Math.sign(this.speed || 0.001);
    fwd -= surfaceDrag * Math.sign(this.speed || 0.001);
    this.speed += fwd * dt;
    this.speed = clamp(this.speed, -80, this.maxSpeed);

    // steering
    const speedFactor = clamp(Math.abs(this.speed) / 50, 0, 1);
    let effectiveTurn = this.turnRate * (1 - Math.abs(this.speed) / this.maxSpeed * 0.55);
    if (this.handbrake) effectiveTurn *= 1.6;
    this.angularVel = this.steerInput * effectiveTurn * speedFactor;
    this.angle += this.angularVel * dt;

    // velocity decomposition (drift model)
    const fx = Math.cos(this.angle), fy = Math.sin(this.angle);
    const rx = -Math.sin(this.angle), ry = Math.cos(this.angle);
    if (Math.abs(this.vx) + Math.abs(this.vy) < 0.1 && Math.abs(this.speed) > 0.1) {
      this.vx = fx * this.speed;
      this.vy = fy * this.speed;
    }
    let fwdComp = dot(this.vx, this.vy, fx, fy);
    let latComp = dot(this.vx, this.vy, rx, ry);

    fwdComp = this.speed;
    let df = this.driftFactor * surfaceGrip;
    if (this.handbrake) df = 0.96;
    latComp *= df;

    this.isDrifting = Math.abs(latComp) > 25;
    this.vx = fx * fwdComp + rx * latComp;
    this.vy = fy * fwdComp + ry * latComp;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // odometer
    this.distancePx += Math.abs(this.speed) * dt;

    // progress tracking
    if (track.isOpenTrack) {
      // POINT-TO-POINT MODE
      const dToFinish = track.getDistanceToFinish(this.x, this.y);
      this.raceProgress = clamp(1 - dToFinish / track.totalLength, 0, 1);
      this.lapProgress = this.raceProgress;

      // Finish detection
      if (dToFinish < FINISH_RADIUS && !this.finished) {
        this.finished = true;
      }
    } else {
      // CIRCUIT MODE — original logic
      const prevProgress = this.lapProgress;
      this.lapProgress = track.getNearestT(this.x, this.y);

      const cp = Math.floor(this.lapProgress * track.numCheckpoints);
      this.checkpointsHit.add(cp);

      if (prevProgress > 0.9 && this.lapProgress < 0.1 && this.checkpointsHit.size >= track.numCheckpoints - 1) {
        this.currentLap++;
        if (this.currentLap > 0) {
          const lt = this.totalTime - this.lapStartTime;
          this.lapTimes.push(lt);
          if (lt < this.bestLap) this.bestLap = lt;
        }
        this.lapStartTime = this.totalTime;
        this.checkpointsHit.clear();
      }
      if (prevProgress < 0.1 && this.lapProgress > 0.9) {
        this.currentLap = Math.max(0, this.currentLap - 1);
        this.checkpointsHit.clear();
      }

      this.raceProgress = this.currentLap + this.lapProgress;
    }
  }

  collideWithBoundary(track) {
    const segs = track.getSegmentsNear(this.x, this.y);
    const corners = this.getCorners();
    for (const corner of corners) {
      for (const seg of segs) {
        const { a, b } = seg;
        const abx = b.x - a.x, aby = b.y - a.y;
        const apx = corner.x - a.x, apy = corner.y - a.y;
        const t = clamp(dot(apx, apy, abx, aby) / (dot(abx, aby, abx, aby) || 1), 0, 1);
        const closestX = a.x + abx * t, closestY = a.y + aby * t;
        const dx = corner.x - closestX, dy = corner.y - closestY;
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d < 3) {
          let toCenterX, toCenterY;
          if (track.isOpenTrack && track.getNearestRoad) {
            // Road network: push toward nearest road center
            const roadInfo = track.getNearestRoad(this.x, this.y);
            if (roadInfo) {
              toCenterX = roadInfo.x - this.x;
              toCenterY = roadInfo.y - this.y;
            } else {
              toCenterX = -dx; toCenterY = -dy;
            }
          } else {
            // Circuit: push toward track center
            const trackT = track.getNearestT(this.x, this.y);
            const center = track.getPointAt(trackT);
            toCenterX = center.x - this.x;
            toCenterY = center.y - this.y;
          }
          const tcLen = Math.sqrt(toCenterX*toCenterX + toCenterY*toCenterY) || 1;
          const pushStr = (3 - d) * 2.5;
          this.x += (toCenterX / tcLen) * pushStr;
          this.y += (toCenterY / tcLen) * pushStr;
          this.speed *= 0.85;
          return true;
        }
      }
    }
    return false;
  }
}
