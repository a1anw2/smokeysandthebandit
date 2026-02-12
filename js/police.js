// ============================================================
// POLICE CAR — chases the player, arrest on radar contact
// ============================================================
class PoliceCar extends Car {
  constructor(x, y, angle) {
    super(x, y, angle, '#1565C0', 'POLICE');
    // Police can only go 80% of player max speed
    this.maxSpeed = CAR_MAX_SPEED * POLICE_SPEED_FACTOR;
    this.accel = POLICE_ACCEL;
    this.brakeForce = POLICE_BRAKE;
    this.turnRate = POLICE_TURN_RATE;
    this.lookAhead = POLICE_LOOKAHEAD;
    this.stuckTimer = 0;

    // Detection / chase ranges (world pixels)
    this.radarRadius = POLICE_RADAR_RADIUS;
    this.chaseRange = POLICE_CHASE_RANGE;
    this.giveUpRange = POLICE_GIVE_UP_RANGE;

    this.isChasing = false;
    this.patrolAngle = 0;
    this.flashTimer = 0;
    this.sirenActive = false;
    this.isFrozen = false;
    this.freezeTimer = 0;
  }

  freeze() {
    this.isFrozen = true;
    this.freezeTimer = POLICE_FREEZE_DURATION;
    this.isChasing = false;
    this.sirenActive = false;
    this.speed = 0;
    this.vx = 0;
    this.vy = 0;
    this.throttle = 0;
    this.brake = 1;
  }

  updatePolice(dt, track, player, allCars) {
    // If frozen after issuing a warning, count down and skip all AI
    if (this.isFrozen) {
      this.freezeTimer -= dt;
      this.speed = 0;
      this.vx = 0;
      this.vy = 0;
      this.throttle = 0;
      this.brake = 1;
      if (this.freezeTimer <= 0) {
        this.isFrozen = false;
        this.freezeTimer = 0;
      }
      return;
    }

    this.flashTimer += dt;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const distToPlayer = Math.sqrt(dx * dx + dy * dy);

    // Activate chase when player is within chase range
    if (distToPlayer < this.chaseRange) {
      this.isChasing = true;
      this.sirenActive = true;
    }
    // Give up chase when player is far enough
    if (distToPlayer > this.giveUpRange) {
      this.isChasing = false;
      this.sirenActive = false;
    }

    if (this.isChasing) {
      this._chasePlayer(dt, track, player);
    } else {
      this._patrol(dt, track);
    }

    // Avoid other police cars
    this._avoidOthers(allCars);
    this._handleStuck(dt, track);
  }

  _chasePlayer(dt, track, player) {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const distToPlayer = Math.sqrt(dx * dx + dy * dy) || 1;

    // Get road info for smarter navigation
    const roadInfo = track.getNearestRoad(this.x, this.y);

    // Blend between direct chase and road following
    let targetX, targetY;

    if (roadInfo) {
      const cos = Math.cos(roadInfo.angle), sin = Math.sin(roadInfo.angle);
      const playerDirX = dx / distToPlayer, playerDirY = dy / distToPlayer;
      const roadDot = cos * playerDirX + sin * playerDirY;

      // If road goes toward player, follow it; otherwise go more direct
      const blend = roadDot > 0.3 ? 0.3 : 0.1;
      const lookDist = this.lookAhead + Math.abs(this.speed) * 0.2;
      targetX = this.x + (cos * blend + playerDirX * (1 - blend)) * lookDist;
      targetY = this.y + (sin * blend + playerDirY * (1 - blend)) * lookDist;
    } else {
      targetX = player.x;
      targetY = player.y;
    }

    // Steer toward target
    const targetAngle = Math.atan2(targetY - this.y, targetX - this.x);
    const angleDiff = normalizeAngle(targetAngle - this.angle);
    this.steerInput = clamp(angleDiff * 4.0, -1, 1);

    // Speed control — aggressive pursuit
    const absTurn = Math.abs(angleDiff);
    const safeSpeed = Math.max(40, this.maxSpeed * (1 - absTurn * 1.0));

    if (this.speed > safeSpeed * 1.05) {
      this.throttle = 0;
      this.brake = clamp((this.speed - safeSpeed) / 80, 0.1, 0.9);
    } else {
      this.throttle = clamp((safeSpeed - this.speed) / 80, 0.6, 1.0);
      this.brake = 0;
    }
    this.handbrake = false;
  }

  _patrol(dt, track) {
    // Simple patrol — follow nearest road at low speed
    const roadInfo = track.getNearestRoad(this.x, this.y);
    if (!roadInfo) {
      this.throttle = 0;
      this.brake = 0.5;
      return;
    }

    const targetAngle = roadInfo.angle;
    const angleDiff = normalizeAngle(targetAngle - this.angle);
    this.steerInput = clamp(angleDiff * 2.0, -1, 1);

    // Cruise at low speed
    if (this.speed > POLICE_CRUISE_SPEED) {
      this.throttle = 0;
      this.brake = 0.2;
    } else {
      this.throttle = 0.3;
      this.brake = 0;
    }
    this.handbrake = false;
  }

  _avoidOthers(allCars) {
    for (const other of allCars) {
      if (other === this) continue;
      if (other instanceof PlayerCar) continue; // don't avoid the player, chase them!
      const dx = other.x - this.x, dy = other.y - this.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 60 && d > 0) {
        const ahead = dot(dx, dy, Math.cos(this.angle), Math.sin(this.angle));
        if (ahead > 0 && ahead < 50) {
          const side = dot(dx, dy, -Math.sin(this.angle), Math.cos(this.angle));
          this.steerInput -= Math.sign(side) * 0.5;
        }
      }
    }
  }

  _handleStuck(dt, track) {
    if (Math.abs(this.speed) < 5) {
      this.stuckTimer += dt;
      if (this.stuckTimer > AI_STUCK_TIMEOUT) {
        const info = track.getNearestRoad(this.x, this.y);
        if (info) {
          this.x = info.x;
          this.y = info.y;
          this.angle = info.angle;
        }
        this.speed = AI_STUCK_RECOVERY_SPEED;
        this.vx = 0;
        this.vy = 0;
        this.stuckTimer = 0;
      }
    } else {
      this.stuckTimer = 0;
    }
  }

  // Check if player is inside the radar radius = WARNING
  checkArrest(player) {
    if (this.isFrozen) return false;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    return d < this.radarRadius;
  }
}
