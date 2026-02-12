// ============================================================
// INPUT MANAGER
// ============================================================
class InputManager {
  constructor() {
    this.keys = {};
    this.justPressed = {};
    window.addEventListener('keydown', e => {
      if (!this.keys[e.code]) this.justPressed[e.code] = true;
      this.keys[e.code] = true;
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Enter','Minus','Equal','NumpadAdd','NumpadSubtract','Tab'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
  }
  isDown(code) { return !!this.keys[code]; }
  wasPressed(code) { return !!this.justPressed[code]; }
  clear() { this.justPressed = {}; }
}
