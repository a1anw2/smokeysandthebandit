# Smokeys and the Bandit

A browser-based arcade racing game where you play as **the Bandit**, racing through real-world city streets while evading police cars. Built with vanilla JavaScript and HTML5 Canvas — no build tools, no frameworks, just open `index.html` and go.

Roads are fetched live from **OpenStreetMap** via the Overpass API, so you can race through any city in the world.

Play it online: https://a1anw2.github.io/smokeysandthebandit/

``This was a truly vibe coded game, purposely done without looking at a single line of code to see how well Claude would do.``

## How to Play

1. Open `index.html` in a browser
2. Press **Enter** or **Space** to open the map picker
3. Click a city button (or search for any location), then:
   - **Step 1:** Click to select your race area
   - **Step 2:** Click to place the **START** point
   - **Step 3:** Click to place the **FINISH** point
4. Click **RACE!** and go

### Controls

| Key | Action |
|-----|--------|
| **W** / **Up** | Accelerate |
| **S** / **Down** | Brake / Reverse |
| **A** / **Left** | Steer left |
| **D** / **Right** | Steer right |
| **Space** | Handbrake |
| **Tab** | Toggle minimap |
| **N** | Toggle sound |
| **+** / **-** | Zoom in / out |
| **Esc** | Return to menu |

### Rules

- Reach the **FINISH** point as fast as you can
- Avoid police radar zones — entering one earns a **WARNING**
- **3 warnings and you're BUSTED!**
- After issuing a warning the cop freezes briefly, giving you a chance to escape

## File Structure

```
smokeysandthebandit/
  index.html              Entry point — loads all scripts, hosts the canvas
  README.md               This file
  js/
    constants.js           All tunable game parameters (physics, police, camera, etc.)
    utils.js               Shared math helpers: clamp, lerp, normalizeAngle, dist, etc.
    input.js               Keyboard input manager (key state tracking)
    track.js               Procedural circuit track generator (legacy, retained)
    camera.js              Camera follow + zoom with look-ahead smoothing
    particles.js           Particle system — smoke, exhaust, dirt, skid marks
    sound.js               Web Audio API engine sound + beep effects
    car.js                 Base Car class — physics, steering, drift, surface detection
    player.js              PlayerCar — extends Car with keyboard input handling
    ai.js                  AICar — extends Car with road-following AI
    police.js              PoliceCar — extends Car with chase AI, radar, freeze mechanic
    renderer.js            Canvas rendering — track, cars, police radar, skid marks
    hud.js                 HUD overlay — speedometer, timer, minimap, warnings, progress
    osm-loader.js          Overpass API client — fetches roads + map tiles from OSM
    road-network.js        RoadNetwork class — spatial grid, surface queries, road labels
    map-picker.js          Leaflet-based map UI for picking race area and start/finish
    loading-screen.js      Animated loading screen with progress bar
    game.js                Main game controller — state machine, game loop, race logic
```

## Architecture

### Game Loop & State Machine

The game is driven by a `requestAnimationFrame` loop in `game.js`. The state machine controls flow:

```
MENU  -->  MAP_SELECT  -->  LOADING  -->  COUNTDOWN  -->  RACING  -->  FINISHED
  ^            |                                                          |
  |            v (Escape)                                                 |
  +--- (Escape from any state) <------------------------------------------+
```

Each state has its own update and render logic. The RACING state delegates to focused sub-methods:
- `_updateRacing(dt)` — orchestrates all per-frame logic
- `_checkWarnings()` — police radar detection and 3-strike system
- `_updateBoundaryCollisions()` — push cars back onto roads
- `_updateCarCollisions()` — car-to-car physics
- `_emitCarParticles()` — drift smoke, exhaust, dirt effects

### Class Hierarchy

```
Car (base)
  |-- PlayerCar     Keyboard input, no AI
  |-- AICar         Road-following AI with stuck recovery
  |-- PoliceCar     Chase/patrol AI, radar zone, freeze mechanic
```

All cars share the same physics model (`Car.update()`): acceleration, braking, steering with speed-dependent turning, surface grip, drift detection, and velocity decomposition.

### Rendering Pipeline

1. **Pre-render** — `RoadNetwork.preRender()` draws all road surfaces, markings, and tiles to an off-screen canvas (once per track load)
2. **Per-frame** — `Renderer` draws the pre-rendered track canvas, then overlays cars (Y-sorted), particles, and police radar effects
3. **HUD** — `HUD` draws speedometer, timer, minimap, progress bar, police warnings, and warning counter on top

The minimap uses its own cached canvas, rebuilt only when the track changes.

### OpenStreetMap Integration

The map loading flow:

1. **Map Picker** (`map-picker.js`) — Leaflet map UI with city quick-links and search. User picks area center, start, and finish in 3 steps.
2. **OSM Loader** (`osm-loader.js`) — Fetches road data from the Overpass API (tries multiple mirror servers with retry). Converts lat/lng to game-world pixel coordinates. Applies Douglas-Peucker simplification.
3. **Road Network** (`road-network.js`) — Builds a spatial grid for fast nearest-road queries. Provides `getSurface(x,y)` (asphalt/curb/grass), `getNearestRoad(x,y)` (with per-frame caching), and `getRoadName(x,y)` for the HUD street name display.

### Police System

- **15 police cars** spawn along the route corridor between start and finish
- Each cop has a **radar zone** (120px radius) — entering it triggers a warning
- Cops **patrol** roads at cruise speed until the player comes within chase range (1100px)
- During a chase, cops blend between road-following and direct pursuit
- After issuing a warning, the cop **freezes** for 4 seconds
- **3 warnings = busted** (game over)

### Per-Frame Caching

`RoadNetwork.getNearestRoad()` is the most-called spatial query (every car, every frame). It uses a per-frame cache keyed by quantized position (nearest 5px), cleared at the start of each frame via `clearFrameCache()`. This avoids redundant grid lookups when multiple systems query the same position.

## Tuning Gameplay

All gameplay parameters live in `js/constants.js` with inline unit comments. Key sections:

- **Car Physics** — speed, acceleration, grip, drift behavior
- **Surface Physics** — grip/drag on curbs and grass
- **Police** — speed, chase range, radar radius, warning system timing
- **Camera** — smoothing, zoom limits, look-ahead distance

For example, to make police faster: increase `POLICE_SPEED_FACTOR` (fraction of player max speed, currently 0.92). To make them more persistent: increase `POLICE_GIVE_UP_RANGE`.

## Requirements

- A modern browser (Chrome, Firefox, Edge, Safari)
- Internet connection (for fetching OSM road data and map tiles)
- No build step, no dependencies to install
