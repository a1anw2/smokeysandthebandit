// ============================================================
// AI CAR
// ============================================================
class AICar extends Car {
  constructor(x, y, angle, color, name, skill, aggression, topSpeedFactor, lineOffset) {
    super(x, y, angle, color, name);
    this.skill = skill;
    this.aggression = aggression;
    this.topSpeedFactor = topSpeedFactor;
    this.lineOffset = lineOffset;
    this.maxSpeed *= topSpeedFactor;
    this.lookAhead = 130;
    this.stuckTimer = 0;
  }

  updateAI(dt, track, allCars) {
    if (track.isOpenTrack) {
      this._updateAIRoadNetwork(dt, track, allCars);
    } else {
      this._updateAICircuit(dt, track, allCars);
    }
  }

  // AI for road network (point-to-point) mode
  _updateAIRoadNetwork(dt, track, allCars) {
    // Get nearest road info for current position
    const roadInfo = track.getNearestRoad(this.x, this.y);
    if (!roadInfo) {
      // Off the map — steer toward finish
      const toFinX = track.finishPoint.x - this.x;
      const toFinY = track.finishPoint.y - this.y;
      const targetAngle = Math.atan2(toFinY, toFinX);
      this.steerInput = clamp(normalizeAngle(targetAngle - this.angle) * 2.5, -1, 1);
      this.throttle = 0.5;
      this.brake = 0;
      this.handbrake = false;
      return;
    }

    // Look ahead along the current road direction
    const lookDist = this.lookAhead + Math.abs(this.speed) * 0.25;
    const cos = Math.cos(roadInfo.angle), sin = Math.sin(roadInfo.angle);

    // Blend between following road and heading toward finish
    const toFinX = track.finishPoint.x - this.x;
    const toFinY = track.finishPoint.y - this.y;
    const toFinDist = Math.sqrt(toFinX * toFinX + toFinY * toFinY) || 1;
    const finDirX = toFinX / toFinDist, finDirY = toFinY / toFinDist;

    // Check if road direction aligns with finish direction
    const roadDot = cos * finDirX + sin * finDirY;

    // If road goes toward finish, follow road; otherwise steer more toward finish
    let targetX, targetY;
    if (roadDot > 0.2) {
      // Road goes roughly toward finish — follow road with slight finish bias
      const blend = 0.7;
      targetX = this.x + (cos * blend + finDirX * (1 - blend)) * lookDist;
      targetY = this.y + (sin * blend + finDirY * (1 - blend)) * lookDist;
    } else {
      // Road goes away from finish — look for turns, bias toward finish more
      const blend = 0.4;
      targetX = this.x + (cos * blend + finDirX * (1 - blend)) * lookDist;
      targetY = this.y + (sin * blend + finDirY * (1 - blend)) * lookDist;
    }

    // Apply racing line offset
    targetX += roadInfo.nx * this.lineOffset * roadInfo.width * 0.3;
    targetY += roadInfo.ny * this.lineOffset * roadInfo.width * 0.3;

    // Steer toward target
    const targetAngle = Math.atan2(targetY - this.y, targetX - this.x);
    const angleDiff = normalizeAngle(targetAngle - this.angle);
    this.steerInput = clamp(angleDiff * 2.5, -1, 1);

    // Speed control — slow for sharp turns
    const absTurn = Math.abs(angleDiff);
    const safeSpeed = Math.max(50, this.maxSpeed * (1 - absTurn * 1.2) * this.skill);

    if (this.speed > safeSpeed * 1.05) {
      this.throttle = 0;
      this.brake = clamp((this.speed - safeSpeed) / 100, 0.1, 0.8) * this.aggression;
    } else {
      this.throttle = clamp((safeSpeed - this.speed) / 100, 0.3, 1.0);
      this.brake = 0;
    }
    this.handbrake = false;

    // Avoidance (same as circuit)
    this._avoidOthers(allCars);

    // Stuck detection
    this._handleStuck(dt, track);
  }

  // Original circuit AI
  _updateAICircuit(dt, track, allCars) {
    const currentT = track.getNearestT(this.x, this.y);

    // look ahead on track
    const lookDist = this.lookAhead + Math.abs(this.speed) * 0.2;
    const aheadT = (currentT + lookDist / track.totalLength) % 1;
    const targetPt = track.getPointAt(aheadT);
    const targetN = track.getNormalAt(aheadT);
    const targetW = track.getWidthAt(aheadT);

    // apply racing line offset
    const offsetX = targetPt.x + targetN.x * this.lineOffset * targetW * 0.5;
    const offsetY = targetPt.y + targetN.y * this.lineOffset * targetW * 0.5;

    // steer toward target
    const targetAngle = Math.atan2(offsetY - this.y, offsetX - this.x);
    const angleDiff = normalizeAngle(targetAngle - this.angle);
    this.steerInput = clamp(angleDiff * 2.5, -1, 1);

    // speed control based on upcoming curvature
    let maxCurvature = 0;
    for (let i = 1; i <= 6; i++) {
      const ct = (currentT + i * 40 / track.totalLength) % 1;
      const curv = track.getCurvatureAt(ct);
      maxCurvature = Math.max(maxCurvature, curv);
    }
    const safeSpeed = Math.max(60, this.maxSpeed * (1 - maxCurvature * 1.8) * this.skill);

    if (this.speed > safeSpeed * 1.05) {
      this.throttle = 0;
      this.brake = clamp((this.speed - safeSpeed) / 100, 0.1, 0.8) * this.aggression;
    } else {
      this.throttle = clamp((safeSpeed - this.speed) / 100, 0.3, 1.0);
      this.brake = 0;
    }
    this.handbrake = false;

    // avoidance
    this._avoidOthers(allCars);

    // stuck detection
    this._handleStuck(dt, track);
  }

  _avoidOthers(allCars) {
    for (const other of allCars) {
      if (other === this) continue;
      const dx = other.x - this.x, dy = other.y - this.y;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d < 60 && d > 0) {
        const ahead = dot(dx, dy, Math.cos(this.angle), Math.sin(this.angle));
        if (ahead > 0 && ahead < 50) {
          const side = dot(dx, dy, -Math.sin(this.angle), Math.cos(this.angle));
          this.steerInput -= Math.sign(side) * 0.4;
          if (this.speed > other.speed + 10) this.brake = 0.3;
        }
      }
    }
  }

  _handleStuck(dt, track) {
    if (Math.abs(this.speed) < 5) {
      this.stuckTimer += dt;
      if (this.stuckTimer > AI_STUCK_TIMEOUT) {
        if (track.isOpenTrack && track.getNearestRoad) {
          const info = track.getNearestRoad(this.x, this.y);
          if (info) {
            this.x = info.x;
            this.y = info.y;
            this.angle = info.angle;
          }
        } else {
          const t = track.getNearestT(this.x, this.y);
          const pt = track.getPointAt(t);
          const tan = track.getTangentAt(t);
          this.x = pt.x; this.y = pt.y;
          this.angle = Math.atan2(tan.y, tan.x);
        }
        this.speed = AI_STUCK_RECOVERY_SPEED;
        this.vx = 0; this.vy = 0;
        this.stuckTimer = 0;
      }
    } else {
      this.stuckTimer = 0;
    }
  }
}
