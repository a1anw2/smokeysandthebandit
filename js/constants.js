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
