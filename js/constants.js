// ============================================================
// CONSTANTS & CONFIGURATION
// ============================================================
const CANVAS_W = 1280, CANVAS_H = 720;
const TOTAL_LAPS = 3;
const NUM_AI = 4;
const TRACK_SAMPLES = 1500;
const MAX_PARTICLES = 250;
const MAX_SKIDMARKS = 600;
const GRID_CELL = 200;

// Track modes
const TRACK_MODE_CIRCUIT = 'circuit';
const TRACK_MODE_POINT_TO_POINT = 'point-to-point';

// === CAR PHYSICS ===
const CAR_WIDTH = 20;
const CAR_LENGTH = 38;
const CAR_MAX_SPEED = 340;
const CAR_ACCEL = 220;
const CAR_BRAKE_FORCE = 380;
const CAR_TURN_RATE = 2.6;
const CAR_GRIP = 1.0;
const CAR_DRIFT_FACTOR = 0.92;
const CAR_DRAG = 0.0008;
const CAR_ROLLING_RESIST = 0.4;
const CAR_REVERSE_MAX = -80;
const SPEED_FACTOR_DIVISOR = 50;
const TURN_REDUCTION_AT_SPEED = 0.55;
const HANDBRAKE_TURN_MULT = 1.6;
const HANDBRAKE_DRIFT = 0.96;
const DRIFT_THRESHOLD = 25;

// === SURFACE PHYSICS ===
const CURB_GRIP = 0.85;
const CURB_DRAG = 10;
const GRASS_GRIP = 0.45;
const GRASS_DRAG = 80;

// === POLICE ===
const POLICE_SPEED_FACTOR = 0.92;
const POLICE_ACCEL = 300;
const POLICE_BRAKE = 400;
const POLICE_TURN_RATE = 2.8;
const POLICE_LOOKAHEAD = 140;
const POLICE_RADAR_RADIUS = 120;
const POLICE_CHASE_RANGE = 1100;
const POLICE_GIVE_UP_RANGE = 3500;
const POLICE_CRUISE_SPEED = 70;
const NUM_POLICE = 15;
const MIN_POLICE_SPACING = 400;
const MIN_DIST_FROM_START = 600;
const POLICE_CORRIDOR_MAX = 2000;
const MAX_WARNINGS = 3;
const POLICE_FREEZE_DURATION = 4;
const WARNING_POPUP_DURATION = 2;
const WARNING_COOLDOWN = 1;

// === CAMERA ===
const CAMERA_SMOOTHING = 0.07;
const CAMERA_ZOOM_INITIAL = 0.2;
const CAMERA_ZOOM_MIN = 0.2;
const CAMERA_ZOOM_MAX = 1.5;
const CAMERA_ZOOM_STEP = 0.15;
const CAMERA_LOOKAHEAD = 90;

// === GAME ===
const COUNTDOWN_TIME = 3.5;
const AI_STUCK_TIMEOUT = 2;
const AI_STUCK_RECOVERY_SPEED = 50;
const OFF_ROAD_CORRECTION = 0.08;
const COLLISION_PUSH_FACTOR = 0.4;
const COLLISION_PUSH_MAX = 20;
const COLLISION_SPEED_DECAY = 0.93;
const OFF_ROAD_PUSH_SPEED = 1.5;
const OFF_ROAD_SPEED_DECAY = 0.98;
const MIN_START_FINISH_DIST = 200;
const MAX_SNAP_DIST = 500;

// === PARTICLES ===
const SKID_FADE_RATE = 0.08;
const PARTICLE_DRAG = 0.97;

// === RENDERING ===
const MAX_CANVAS_DIM = 10000;
const GRASS_STRIPE_HEIGHT = 40;
const CURB_SEGMENT_STEP = 8;
const CURB_VISUAL_WIDTH = 8;
const TILE_OPACITY = 0.45;

// === SOUND ===
const ENGINE_BASE_FREQ = 80;
const ENGINE_FILTER_FREQ = 400;
const ENGINE_RPM_BASE = 800;
const ENGINE_RPM_RANGE = 4500;

// === NETWORK ===
const OSM_FETCH_TIMEOUT = 45000;
const TILE_FETCH_TIMEOUT = 15000;
const MAX_TILES = 250;

// OSM configuration
const OSM_FETCH_RADIUS = 5000; // meters
const PIXELS_PER_METER = 3;
const SIMPLIFICATION_TOLERANCE = 0.00003; // degrees (~3m)
const ROAD_GRID_CELL = 100; // spatial grid cell size for road network
const FINISH_RADIUS = 80; // pixels - how close to finish point to count as finished

const ROAD_WIDTHS = {
  motorway: 55, motorway_link: 45,
  trunk: 50, trunk_link: 40,
  primary: 45, primary_link: 35,
  secondary: 40, secondary_link: 32,
  tertiary: 35, tertiary_link: 28,
  residential: 30,
  unclassified: 28
};
const DEFAULT_ROAD_WIDTH = 30;

const COLORS = {
  player: '#FFD700',
  ai: ['#E53935', '#1E88E5', '#43A047', '#8E24AA'],
  grass: '#2E7D32',
  grassDark: '#256427',
  road: '#3A3A3A',
  roadLight: '#454545',
  curb1: '#E53935',
  curb2: '#FFFFFF',
  line: '#FFFFFF',
  startFinish: '#FFFFFF'
};

// Road surface colors by type (main roads slightly lighter to stand out)
const ROAD_COLORS = {
  motorway: { fill: '#4A4A4A', light: '#555555' },
  motorway_link: { fill: '#484848', light: '#535353' },
  trunk: { fill: '#474747', light: '#525252' },
  trunk_link: { fill: '#454545', light: '#505050' },
  primary: { fill: '#434343', light: '#4E4E4E' },
  primary_link: { fill: '#414141', light: '#4C4C4C' },
  secondary: { fill: '#3F3F3F', light: '#4A4A4A' },
  secondary_link: { fill: '#3E3E3E', light: '#494949' },
  tertiary: { fill: '#3C3C3C', light: '#474747' },
  tertiary_link: { fill: '#3B3B3B', light: '#464646' },
  residential: { fill: '#383838', light: '#434343' },
  unclassified: { fill: '#363636', light: '#414141' }
};
