// ============================================================
// TRAFFIC CAR — civilian vehicle, follows roads at low speed
// ============================================================
class TrafficCar extends Car {
  constructor(x, y, angle, color) {
    super(x, y, angle, color, 'TRAFFIC');
    this.cruiseSpeed = TRAFFIC_MIN_SPEED + Math.random() * (TRAFFIC_MAX_SPEED - TRAFFIC_MIN_SPEED);
    this.maxSpeed = this.cruiseSpeed * 1.2;
    this.accel = 120;
    this.brakeForce = 200;
    this.turnRate = 2.4;
    this.stuckTimer = 0;
  }

  updateTraffic(dt, track) {
    const roadInfo = track.getNearestRoad(this.x, this.y);
    if (!roadInfo) {
      this.throttle = 0;
      this.brake = 0.5;
      this.steerInput = 0;
      this.handbrake = false;
      return;
    }

    // Steer toward road center, following road angle
    const targetAngle = roadInfo.angle;
    const angleDiff = normalizeAngle(targetAngle - this.angle);
    const rawSteer = clamp(angleDiff * TRAFFIC_STEER_GAIN, -1, 1);
    this.steerInput += (rawSteer - this.steerInput) * TRAFFIC_STEER_SMOOTH;

    // Slow down proportional to angle change
    const absTurn = Math.abs(angleDiff);
    const speedTarget = this.cruiseSpeed * (1 - absTurn * 0.5);

    if (this.speed > speedTarget) {
      this.throttle = 0;
      this.brake = clamp((this.speed - speedTarget) / 60, 0.1, 0.5);
    } else {
      this.throttle = clamp((speedTarget - this.speed) / 60, 0.2, 0.5);
      this.brake = 0;
    }
    this.handbrake = false;

    // Stuck detection
    this._handleStuck(dt, track);
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
}
