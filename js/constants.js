// ============================================================
// CONSTANTS & CONFIGURATION
// ============================================================

const GAME_VERSION = '2026.02.12';

// --- Movie Quotes (Smokey and the Bandit, 1977) ---
const BANDIT_QUOTES = [
  { text: "What we're dealing with here is a complete lack of respect for the law.", character: 'Sheriff Buford T. Justice' },
  { text: "For the money, for the glory, and for the fun. Mostly for the money.", character: 'Bandit' },
  { text: "Give me a diablo sandwich, a Dr. Pepper, and make it quick, I'm in a hurry.", character: 'Sheriff Buford T. Justice' },
  { text: "There is no way, no way, that you could come from my loins.", character: 'Sheriff Buford T. Justice' },
  { text: "You must be part coon dog, 'cause you make 'em all look like slow motion.", character: 'Bandit' },
  { text: "Nobody makes Sheriff Buford T. Justice look like a possum's pecker!", character: 'Sheriff Buford T. Justice' },
  { text: "I'm not givin' up! I'm never gonna give up!", character: 'Sheriff Buford T. Justice' },
  { text: "When you tell somebody somethin', it depends on what part of the country you're standin' in.", character: 'Bandit' },
  { text: "You can think about it... but don't do it.", character: 'Bandit' },
  { text: "The goddamn Germans got nothin' to do with it.", character: 'Sheriff Buford T. Justice' },
  { text: "My hat blew off, daddy.", character: 'Junior' },
  { text: "I hope your goddamn head was in it.", character: 'Sheriff Buford T. Justice' },
  { text: "You sumbitches couldn't close an umbrella!", character: 'Sheriff Buford T. Justice' },
  { text: "Hold my hat.", character: 'Sheriff Buford T. Justice' },
  { text: "What do you think they do for excitement in this town? Sit around and watch the cars rust.", character: 'Bandit' },
];

// --- Display ---
const CANVAS_W = 1280, CANVAS_H = 720;        // pixels

// --- Legacy (circuit mode — retained for compatibility) ---
const TOTAL_LAPS = 3;
const NUM_AI = 4;
const TRACK_SAMPLES = 1500;
const TRACK_MODE_CIRCUIT = 'circuit';
const TRACK_MODE_POINT_TO_POINT = 'point-to-point';

// --- Limits ---
const MAX_PARTICLES = 250;
const MAX_SKIDMARKS = 600;
const GRID_CELL = 200;                         // px — collision grid cell size

// --- Car Physics ---
const CAR_WIDTH = 20;                          // px
const CAR_LENGTH = 38;                         // px
const CAR_MAX_SPEED = 340;                     // px/s
const CAR_ACCEL = 220;                         // px/s²
const CAR_BRAKE_FORCE = 380;                   // px/s²
const CAR_TURN_RATE = 2.6;                     // rad/s
const CAR_GRIP = 1.0;                          // multiplier (1.0 = full grip)
const CAR_DRIFT_FACTOR = 0.92;                 // lateral velocity retention
const CAR_DRAG = 0.0008;                       // quadratic drag coefficient
const CAR_ROLLING_RESIST = 0.4;                // px/s² constant decel
const CAR_REVERSE_MAX = -80;                   // px/s
const SPEED_FACTOR_DIVISOR = 50;               // steering reduction scale
const TURN_REDUCTION_AT_SPEED = 0.55;          // min steering fraction at top speed
const HANDBRAKE_TURN_MULT = 1.6;               // steering multiplier during handbrake
const HANDBRAKE_DRIFT = 0.96;                  // grip multiplier during handbrake
const DRIFT_THRESHOLD = 25;                    // lateral speed for isDrifting flag

// --- Surface Physics ---
const CURB_GRIP = 0.85;                        // grip multiplier on curbs
const CURB_DRAG = 10;                          // px/s² drag on curbs
const GRASS_GRIP = 0.45;                       // grip multiplier on grass
const GRASS_DRAG = 80;                         // px/s² drag on grass

// --- Police ---
const POLICE_SPEED_FACTOR = 0.92;              // fraction of player max speed
const POLICE_ACCEL = 300;                      // px/s²
const POLICE_BRAKE = 400;                      // px/s²
const POLICE_TURN_RATE = 2.8;                  // rad/s
const POLICE_LOOKAHEAD = 140;                  // px — AI look-ahead distance
const POLICE_RADAR_RADIUS = 120;               // px — arrest detection zone
const POLICE_CHASE_RANGE = 1100;               // px — start chasing when player is this close
const POLICE_GIVE_UP_RANGE = 3500;             // px — stop chasing when player escapes this far
const POLICE_CRUISE_SPEED = 70;                // px/s — patrol speed when not chasing
const NUM_POLICE = 15;
const MIN_POLICE_SPACING = 400;                // px — minimum gap between spawned police
const MIN_DIST_FROM_START = 600;               // px — no police within this range of start
const POLICE_CORRIDOR_MAX = 2000;              // px — max perpendicular distance from route line
const MAX_WARNINGS = 3;                        // strikes before busted
const POLICE_FREEZE_DURATION = 4;              // seconds — cop stops after issuing warning
const WARNING_POPUP_DURATION = 2;              // seconds — HUD popup display time
const WARNING_COOLDOWN = 1;                    // seconds — grace period between warnings

// --- Traffic ---
const NUM_TRAFFIC = 20;                          // number of civilian traffic cars
const TRAFFIC_MIN_SPEED = 40;                    // px/s — slowest traffic
const TRAFFIC_MAX_SPEED = 70;                    // px/s — fastest traffic
const TRAFFIC_STEER_GAIN = 2.0;                  // steering responsiveness
const TRAFFIC_STEER_SMOOTH = 0.25;               // exponential smoothing factor
const MIN_TRAFFIC_SPACING = 200;                 // px — minimum gap between spawned traffic
const TRAFFIC_COLORS = ['#9E9E9E', '#E0E0E0', '#5C6BC0', '#C62828', '#2E7D32'];

// --- CB Radio ---
const CB_COOLDOWN = 8;                           // seconds — minimum between messages
const CB_FADE_IN = 0.3;                          // seconds
const CB_DISPLAY = 3;                            // seconds message stays fully visible
const CB_FADE_OUT = 0.5;                         // seconds
const CB_HIGH_SPEED_THRESHOLD = 0.9;             // fraction of max speed
const CB_HIGH_SPEED_DURATION = 3;                // seconds at high speed before trigger

const CB_MESSAGES = {
  race_start: [
    "Breaker breaker, the Bandit's on the move!",
    "10-4, good buddy, let's put the hammer down!",
    "We got ourselves a convoy... well, just you. Go!",
    "Eastbound and down, loaded up and truckin'!",
  ],
  police_approaching: [
    "You got a Smokey on your tail!",
    "Bear in the air! Keep your eyes peeled!",
    "Smokey's comin' in hot, watch yourself!",
    "We got a bear report — Smokey's on the prowl!",
  ],
  warning_received: [
    "That was close! Watch your mirrors!",
    "Whoo-ee, you nearly got nabbed there!",
    "Skin of your teeth, good buddy!",
    "Smokey almost had ya! Keep movin'!",
  ],
  halfway: [
    "Halfway there, keep the hammer down!",
    "We're past the halfway mark, good buddy!",
    "Halfway home — don't let up now!",
  ],
  near_finish: [
    "Almost home free, Bandit!",
    "You can smell the finish line from here!",
    "Just a little further, keep it floored!",
  ],
  high_speed: [
    "You're runnin' hot, good buddy!",
    "Pedal to the metal! That's the way!",
    "10-4, you're flyin' out there!",
    "Hot dang, you're movin'!",
  ],
};

// --- Camera ---
const CAMERA_SMOOTHING = 0.07;                 // exponential smoothing (0 = snap, 1 = frozen)
const CAMERA_ZOOM_INITIAL = 0.2;
const CAMERA_ZOOM_MIN = 0.2;
const CAMERA_ZOOM_MAX = 1.5;
const CAMERA_ZOOM_STEP = 0.15;                 // per key press
const CAMERA_LOOKAHEAD = 90;                   // px — camera leads player by this much

// --- Game ---
const COUNTDOWN_TIME = 3.5;                    // seconds
const AI_STUCK_TIMEOUT = 2;                    // seconds before unstick
const AI_STUCK_RECOVERY_SPEED = 50;            // px/s
const OFF_ROAD_CORRECTION = 0.08;              // rad — angle correction per frame
const COLLISION_PUSH_FACTOR = 0.4;             // push strength multiplier
const COLLISION_PUSH_MAX = 20;                 // px — max push per frame
const COLLISION_SPEED_DECAY = 0.93;            // speed multiplier on grass collision
const OFF_ROAD_PUSH_SPEED = 1.5;              // px — curb correction push
const OFF_ROAD_SPEED_DECAY = 0.98;             // speed multiplier on curb
const MIN_START_FINISH_DIST = 200;             // px — minimum distance between start and finish
const MAX_SNAP_DIST = 500;                     // px — max snap distance for lat/lng → road point
const LEADERBOARD_MAX_ENTRIES = 50;             // max stored best times (LRU eviction)
const LEADERBOARD_STORAGE_KEY = 'satb_bestTimes'; // localStorage key

// --- Particles ---
const SKID_FADE_RATE = 0.08;                   // alpha/s
const PARTICLE_DRAG = 0.97;                    // velocity multiplier per frame

// --- Rendering ---
const MAX_CANVAS_DIM = 10000;                  // px — cap off-screen canvas size
const GRASS_STRIPE_HEIGHT = 40;                // px
const CURB_SEGMENT_STEP = 8;                   // points per curb stripe
const CURB_VISUAL_WIDTH = 8;                   // px
const TILE_OPACITY = 0.7;                      // OSM background tile transparency

// --- Sound ---
const ENGINE_BASE_FREQ = 80;                   // Hz — idle engine frequency
const ENGINE_FILTER_FREQ = 400;                // Hz — lowpass cutoff
const ENGINE_RPM_BASE = 800;                   // RPM at idle
const ENGINE_RPM_RANGE = 4500;                 // RPM added at full speed

// --- Network / OSM ---
const OSM_FETCH_TIMEOUT = 45000;               // ms
const TILE_FETCH_TIMEOUT = 15000;              // ms
const MAX_TILES = 250;
const OSM_FETCH_RADIUS = 5000;                 // meters — area fetched around selected point
const PIXELS_PER_METER = 3;                    // world scale
const SIMPLIFICATION_TOLERANCE = 0.00003;      // degrees (~3m) — Douglas-Peucker tolerance
const ROAD_GRID_CELL = 100;                    // px — spatial grid cell size for road queries
const FINISH_RADIUS = 80;                      // px — proximity to finish point to complete race

// --- Road Widths (px) ---
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

// --- Colors ---
const COLORS = {
  player: '#FFD700',
  ai: ['#E53935', '#1E88E5', '#43A047', '#8E24AA'],
  grass: '#1B5E20',
  grassDark: '#174F1B',
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
