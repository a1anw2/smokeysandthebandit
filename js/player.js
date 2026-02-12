// ============================================================
// PLAYER CAR
// ============================================================
class PlayerCar extends Car {
  constructor(x, y, angle) {
    super(x, y, angle, COLORS.player, 'PLAYER');
  }
  handleInput(input) {
    this.throttle = (input.isDown('ArrowUp') || input.isDown('KeyW')) ? 1 : 0;
    this.brake = (input.isDown('ArrowDown') || input.isDown('KeyS')) ? 1 : 0;
    this.steerInput = 0;
    if (input.isDown('ArrowLeft') || input.isDown('KeyA')) this.steerInput = -1;
    if (input.isDown('ArrowRight') || input.isDown('KeyD')) this.steerInput = 1;
    this.handbrake = input.isDown('Space');
  }
}
