// ===================== Tower of Defend =====================
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;   // fixed 1280x720 WORLD size

// Size the canvas backing store to the device's real pixels so the browser
// never resamples a downscaled bitmap every frame. Without this, on high-DPR
// phones the fixed 1280x720 buffer is stretched by CSS and re-sampled each
// RAF, making crisp edges (e.g. tower bases) shimmer/"vibrate". Drawing at
// native resolution keeps static art pixel-stable and sharper. The 1280x720
// world is letterboxed onto this buffer by a base transform set in render().
function fitCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 3); // cap cost on 3x+ screens
  const cw = Math.round(canvas.clientWidth * dpr);
  const ch = Math.round(canvas.clientHeight * dpr);
  if (cw > 0 && ch > 0 && (canvas.width !== cw || canvas.height !== ch)) {
    canvas.width = cw;
    canvas.height = ch;
  }
}

// ==================================================================
// ---- Level system: each map in maps/levelN.js registers itself   ----
// ---- into window.LEVELS with LANES (one point-array per spawn    ----
// ---- lane), BUILD_SPOTS, and a composeMap(ctx) that draws the     ----
// ---- whole scene once. The engine below is map-agnostic -- it     ----
// ---- just walks whichever lanes the chosen level provides.       ----
// ==================================================================
let activeLevel = null;
let lanes = [];          // [{points,total,pointAtDistance}, ...]
let BUILD_SPOTS = [];    // mutable: set from the active level

function buildLaneRuntime(points) {
  const segLens = points.slice(1).map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]));
  const total = segLens.reduce((a, b) => a + b, 0);
  function pointAtDistance(dist) {
    if (dist <= 0) return { x: points[0][0], y: points[0][1], angle: 0 };
    let d = dist;
    for (let i = 0; i < segLens.length; i++) {
      const len = segLens[i];
      if (d <= len || i === segLens.length - 1) {
        const t = len === 0 ? 0 : Math.min(d / len, 1);
        const a = points[i], b = points[i + 1];
        const x = a[0] + (b[0] - a[0]) * t;
        const y = a[1] + (b[1] - a[1]) * t;
        const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
        return { x, y, angle };
      }
      d -= len;
    }
    const last = points[points.length - 1];
    return { x: last[0], y: last[1], angle: 0 };
  }
  return { points, total, pointAtDistance };
}

// ---- Asset loading ----
function loadImg(src) {
  const img = new Image();
  img.src = src;
  return img;
}
function loadFrames(prefix, count) {
  const arr = [];
  for (let i = 0; i < count; i++) {
    const n = String(i).padStart(3, '0');
    arr.push(loadImg(`${prefix}${n}.png`));
  }
  return arr;
}

const TOWER_ART = {
  archer: [loadImg('assets/towers/archer_1.png'), loadImg('assets/towers/archer_2.png'), loadImg('assets/towers/archer_3.png')],
  magic:  [loadImg('assets/towers/magic_1.png'),  loadImg('assets/towers/magic_2.png'),  loadImg('assets/towers/magic_3.png')],
  stone:  [loadImg('assets/towers/stone_1.png'),  loadImg('assets/towers/stone_2.png'),  loadImg('assets/towers/stone_3.png')],
  support:[loadImg('assets/towers/support_1.png'),loadImg('assets/towers/support_2.png'),loadImg('assets/towers/support_3.png')],
  // AI-generated (Higgsfield nano-banana-pro, style-referenced on the kit's towers)
  lightning:[loadImg('assets/towers/lightning_1.png'),loadImg('assets/towers/lightning_2.png'),loadImg('assets/towers/lightning_3.png')],
  poison: [loadImg('assets/towers/poison_1.png'), loadImg('assets/towers/poison_2.png'), loadImg('assets/towers/poison_3.png')],
  flame:  [loadImg('assets/towers/flame_1.png'),  loadImg('assets/towers/flame_2.png'),  loadImg('assets/towers/flame_3.png')],
  // sniper is drawn in two layers: a static base + a rotating ballista turret
  sniper: [loadImg('assets/towers/sniper_base_1.png'), loadImg('assets/towers/sniper_base_2.png'), loadImg('assets/towers/sniper_base_3.png')],
  bomb:   [loadImg('assets/towers/bomb_1.png'),   loadImg('assets/towers/bomb_2.png'),   loadImg('assets/towers/bomb_3.png')],
  ember:  [loadImg('assets/towers/ember_1.png'),  loadImg('assets/towers/ember_2.png'),  loadImg('assets/towers/ember_3.png')],
  arcane: [loadImg('assets/towers/arcane_1.png'), loadImg('assets/towers/arcane_2.png'), loadImg('assets/towers/arcane_3.png')],
  storm:  [loadImg('assets/towers/storm_1.png'),  loadImg('assets/towers/storm_2.png'),  loadImg('assets/towers/storm_3.png')],
  hex:    [loadImg('assets/towers/hex_1.png'),    loadImg('assets/towers/hex_2.png'),    loadImg('assets/towers/hex_3.png')],
  ranger: [loadImg('assets/towers/ranger_1.png'), loadImg('assets/towers/ranger_2.png'), loadImg('assets/towers/ranger_3.png')],
  ballista:[loadImg('assets/towers/ballista_1.png'),loadImg('assets/towers/ballista_2.png'),loadImg('assets/towers/ballista_3.png')],
};

// ember (Lava) launcher: kit base #12 (4 posts + brazier) with the dark plates
// #8/#9 forming a cradle and a live flame (#35) as the loaded ammo. Fires a
// lobbed fireball that bursts into embers (#35-39). One shared native scale.
const EMBER_BACK  = loadImg('assets/emberfx/back.png');   // #8 thin plate
const EMBER_FRONT = loadImg('assets/emberfx/front.png');  // #9 thick plate
const EMBER_FLAME = loadImg('assets/emberfx/flame.png');  // #35 flame
const EMBER_BURST = Array.from({ length: 5 }, (_, i) => loadImg(`assets/emberfx/burst_${i}.png`));
// native-pixel offsets inside base #12 (163px wide). The sprite carries a
// drop shadow that pushes the bbox centre to 81.5; the REAL centre (disc +
// posts) is x=76, so both plates AND the flame centre on 76 (back #8 133w ->
// bkx=9.5, front #9 152w -> fx=0). Fires like the cannon: `lift` raises the
// whole press (plates + flame) on the shot.
const EMBER_RIG = { bkx: 9.5, bky: 40, fx: 0, fy: 52, flameX: 76, flameBottom: 106, flameW: 34, lift: 46 };

// sniper ballista turret (top-down, native points RIGHT), rotates to aim.
const SNIPER_TURRET = [loadImg('assets/towers/sniper_turret_1.png'), loadImg('assets/towers/sniper_turret_2.png'), loadImg('assets/towers/sniper_turret_3.png')];
const SNIPER_PIVOT = [[0.529, 0.740], [0.491, 0.741], [0.471, 0.736]]; // pivot as fraction of turret sprite
const SNIPER_TURRET_W = [48, 54, 60]; // drawn width per level

// stone (Cannon) launcher, assembled EXACTLY like the official craftpix demo
// GIF from the kit's own pieces (user-identified composition, all offsets
// measured against the GIF at native piece scale):
//   L1 = base #3  + back plate #2 + front plate #1  (gray/wood)
//   L2 = base #6  + back plate #9 + front plate #8  (silver/iron)
//   L3 = base #7  + back plate #5 + front plate #4  (bronze/orange)
// Z-order per the art (user-corrected): the THIN cradle plate (#1/#8/#4) is
// the DEEPEST layer, the rock rests in ITS cradle, then the base+pillars,
// then the THICK plate (#2/#9/#5) in FRONT hides the rock's bottom. Firing
// lifts the whole press up the pillars and flings the rock out.
const STONE_PLATE_BACK  = [loadImg('assets/stonefx/slabtop_1.png'), loadImg('assets/stonefx/slabtop_2.png'), loadImg('assets/stonefx/slabtop_3.png')]; // thin #1/#8/#4
const STONE_PLATE_FRONT = [loadImg('assets/stonefx/slabbot_1.png'), loadImg('assets/stonefx/slabbot_2.png'), loadImg('assets/stonefx/slabbot_3.png')]; // thick #2/#9/#5
const STONE_ROCK = loadImg('assets/stonefx/rock.png');
// cannon v2: 5x5 grid of 256px frames animating the full throw -- f0-2 rest
// (rock loaded), f3-9 press lifting, f10 at the pillar tops (rock's last
// visible frame), f11 RELEASE (rock gone -- it flew off as the projectile),
// f11-19 the empty press descending, f20-24 a fresh rock reloads.
// ALL THREE levels are now auto-generated from kit pieces with ONE generator
// (base #3/#6/#7 + back plate slabtop_N + rock + front plate slabbot_N, at
// scale 101/164 bottom-anchored to y188, plates+rock lifted per the measured
// lift table, peak ~52px). The loaded rock VANISHES from frames 11-19 (baked
// into the sheet) so it never double-shows while the thrown rock is in flight
// -- same trick as the Lava flame. Measured geometry: bbox 101 wide, bottom
// y188, centre x126.5; the rock at its peak (f10) sits at (122, 87).
const CANNON_SHEETS = [
  loadImg('assets/towers/cannon_v2.png'),
  loadImg('assets/towers/cannon_v2_2.png'),
  loadImg('assets/towers/cannon_v2_3.png'),
];
const CANNON_V2 = {
  cell: 256, cols: 5, frames: 25, fps: 20, releaseFrame: 11,
  bboxW: 101, bottom: 188, centerX: 126.5, rockPeak: { x: 122, y: 87 },
};

// Lava (ember) sheets, auto-generated with the same generator/motion table:
// L1 = base #12 (wood posts), L2 = #13 (golden blades), L3 = #14 (steel
// blades), all with plates #8/#9 and the upside-down flame riding the press.
// Same grid/geometry as the cannon sheets, so CANNON_V2 fields apply; the
// flame at the release frame sits at (123, 89), drawn ~21px wide in-sheet.
const EMBER_SHEETS = [
  loadImg('assets/towers/lava_v2_1.png'),
  loadImg('assets/towers/lava_v2_2.png'),
  loadImg('assets/towers/lava_v2_3.png'),
];
const EMBER_V2 = { flamePeak: { x: 123, y: 89 }, flameW: 21 };

// Magic sheets, auto-generated to match the OFFICIAL magic-tower demo GIF
// (Magic-Tower-Game-Assets.gif -- 3 towers L->R = levels 1-3): tan dome family
// (#2 plain / #3 gems / #4 ornate) with a FIXED gold-swirl crystal (#27) at
// the apex, and YELLOW LIGHTNING that crackles around it. The tower doesn't
// launch anything visible -- instead the crystal glows and electric arcs fan
// out (built procedurally): faint at idle (f0), building over f0-10, a bright
// DISCHARGE at f11 (the bolt fires), fading f12-19, calm f20-24. The projectile
// is a real lightning bolt (mbolt.png = kit #19). The crystal is at a different
// apex height per level, so boltFrom (the bolt's spawn point) is PER LEVEL.
const MAGIC_SHEETS = [
  loadImg('assets/towers/magic_v2_1.png'),
  loadImg('assets/towers/magic_v2_2.png'),
  loadImg('assets/towers/magic_v2_3.png'),
];
const MAGIC_V2 = {
  cell: 256, cols: 5, frames: 25, fps: 20, releaseFrame: 11,
  bboxW: 130, bottom: 188, centerX: 128, loop: true, // lightning crackles NONSTOP
  // gem #27 perches on the apex peak (LOWEST point at the peak, same as Arcane).
  // boltFrom is PER LEVEL, each an ARRAY of gem orbs (magic has 1 gem/level).
  boltFrom: [[{ x: 126, y: 45 }], [{ x: 127, y: 32 }], [{ x: 127, y: 20 }]],
};

// Arcane = the SECOND official magic-tower demo (Magic-Tower-Game-Assets2.gif):
// the green-stone dome family (#6/#7/#8) with the small green gem crystal (#5,
// user-chosen) perched so its LOWEST point touches each dome's APEX PEAK (user
// marked this exactly) -- the gem's glowing orb curls up ABOVE the peak. GREEN
// lightning (#96ebcd) radiates from the orb. Same generator/animation as the
// yellow Magic tower (crackle build -> discharge at f11 -> calm), just green;
// the L1 dome #6 is much shorter so its gem/orb sits lower. boltFrom = the
// glowing-orb centre (where the bolt fires from).
const ARCANE_SHEETS = [
  loadImg('assets/towers/arcane_v2_1.png'),
  loadImg('assets/towers/arcane_v2_2.png'),
  loadImg('assets/towers/arcane_v2_3.png'),
];
// Storm = the THIRD official magic-tower demo (Magic-Tower-Game-Assets3.gif):
// tan crystal-towers #11/#12/#13 with BLUE ornaments (swirl #9 / spikes #10)
// and BLUE lightning (#87e9f2). Extracted DIRECTLY from the demo GIF's 16
// frames (cropped per level, gray bg removed, re-anchored to tan-centre->128 /
// tan-bottom->188 at scale 0.86) so it's pixel-exact to the GIF. loop:true so
// the blue crackle plays nonstop; fires a blue bolt (zbolt.png = kit #23).
const STORM_SHEETS = [
  loadImg('assets/towers/storm_v2_1.png'),
  loadImg('assets/towers/storm_v2_2.png'),
  loadImg('assets/towers/storm_v2_3.png'),
];
const STORM_V2 = {
  cell: 256, cols: 5, frames: 16, fps: 16, releaseFrame: 0,
  bboxW: 120, bottom: 188, centerX: 128, loop: true,
  boltFrom: [[{ x: 129, y: 84 }], [{ x: 127, y: 59 }], [{ x: 130, y: 52 }]],
};

// Hex = the FOURTH official magic-tower demo (Magic-Tower-Game-Assets4.gif):
// dark obsidian towers #16/#17/#18 with RED orbs (#14/#15/#30) and RED
// lightning (#ee5a50). Extracted DIRECTLY from the gif's 16 frames (crop per
// level, gray bg removed, dark-body-centre->128 / body-bottom(gif 266)->188 at
// scale 0.70 -- smaller because L2's spike+orb is very tall). loop:true blood-
// red crackle; fires a red bolt (rbolt.png = kit #25). boltFrom = the red orb.
const HEX_SHEETS = [
  loadImg('assets/towers/hex_v2_1.png'),
  loadImg('assets/towers/hex_v2_2.png'),
  loadImg('assets/towers/hex_v2_3.png'),
];
const HEX_V2 = {
  cell: 256, cols: 5, frames: 16, fps: 16, releaseFrame: 0,
  bboxW: 90, bottom: 188, centerX: 128, loop: true,
  boltFrom: [[{ x: 125, y: 82 }], [{ x: 124, y: 18 }], [{ x: 124, y: 31 }]],
};

// Ranger = the Archer pack's OTHER demo (Archer-Tower-Game-Assets-01.gif): a
// helmeted blue archer (kit #38-43, natively faces RIGHT) on a thatch/haystack
// tower (kit bases #2/#4/#6). COMPOSITED (not gif-extracted) exactly like the
// original Archer so the STATIC thatch base never flips -- only the archer is
// mirrored per facing, and it's drawn BIGGER (1.5x) for readability. base at
// scale 0.84 (centre->128, bottom->188), archer feet on the thatch seat. 6-
// frame shoot cycle (#38-43) looped; fires an ARROW (arrow2.png) from the bow.
// faceLeft picks the L(mirrored)/R(as-is) sheet + bow side.
const RANGER_SHEETS_R = [1, 2, 3].map(l => loadImg(`assets/towers/ranger_v2_${l}R.png`));
const RANGER_SHEETS_L = [1, 2, 3].map(l => loadImg(`assets/towers/ranger_v2_${l}L.png`));
// Works EXACTLY like Archer (8-frame draw-release cycle #38-43, plays on fire,
// arrow leaves at releaseFrame 4; NOT a loop tower), differing only in the
// archer sprite (#38-43) and base (#2/#4/#6). L3 = TWO archers -> two bows/two
// arrows, same as Archer L3. bows measured off each release frame per facing.
const RANGER_V2 = {
  cell: 256, cols: 5, frames: 8, fps: 20, releaseFrame: 4,
  bboxW: 130, bottom: 188, centerX: 128,
  bowR: [[{ x: 144, y: 42 }], [{ x: 144, y: 44 }], [{ x: 117, y: 33 }, { x: 173, y: 33 }]],
  bowL: [[{ x: 110, y: 42 }], [{ x: 110, y: 44 }], [{ x: 81, y: 33 }, { x: 137, y: 33 }]],
};

// Ballista = Archer-Tower-Game-Assets-04.gif: a mechanical bolt-thrower (stone
// legs + wooden ballista frame) that loads a bolt and FIRES IT STRAIGHT UP.
// Extracted from the gif's fire cycle (frames [0-4 load+release, 7-15 reload];
// the fly-away frames 5-6 are dropped so the baked bolt doesn't double the
// projectile). Static base (no facing) -> gif-extraction is safe. Plays ON FIRE
// like the Cannon; the bolt leaves at releaseFrame 4 and flies a MORTAR arc
// (straight up, over, down on target -- same as Lava). bolt = bbolt.png.
const BALLISTA_SHEETS = [
  loadImg('assets/towers/ballista_v2_1.png'),
  loadImg('assets/towers/ballista_v2_2.png'),
  loadImg('assets/towers/ballista_v2_3.png'),
];
const BALLISTA_V2 = {
  cell: 256, cols: 5, frames: 14, fps: 16, releaseFrame: 4,
  bboxW: 114, bottom: 188, centerX: 128, boltPeak: { x: 127, y: 73 },
};
// L3's bolt is GOLD in the gif (L1/L2 are steel-grey); swapped in at draw time.
const BALLISTA_BOLT_GOLD = loadImg('assets/projectiles/bbolt_gold.png');

const ARCANE_V2 = {
  cell: 256, cols: 5, frames: 25, fps: 20, releaseFrame: 11,
  bboxW: 130, bottom: 188, centerX: 128, loop: true, // lightning crackles NONSTOP
  // boltFrom is PER LEVEL, each an ARRAY of gem orbs. L1/L2 have ONE gem; L3
  // has THREE (centre + left + right, matching the demo) that each fire an
  // independent bolt at its own target.
  boltFrom: [
    [{ x: 122, y: 66 }],
    [{ x: 121, y: 23 }],
    [{ x: 124, y: 26 }, { x: 78, y: 70 }, { x: 178, y: 70 }], // centre, left, right (on the shoulders)
  ],
};

// Archer sheets, auto-generated with the "sunken in cup" composition (base +
// green hooded archer #64-71 sunk inside the tower's rim opening, front-rim
// re-pasted on top to occlude the legs) matching the official
// Archer-Tower-Game-Assets-02.gif reference. All 3 levels share the same
// 8-frame cycle SEQ=[64,65,66,67,69,70,71,64] (idle,raise,draw,aim,RELEASE,
// follow,reload,idle) and the same grid/geometry, so one shared config
// applies (like CANNON_V2). L variants mirror ONLY the archer character
// (base tower art is identical between R/L — the tower itself never turns).
const ARCHER_SHEETS_R = [1, 2, 3].map(l => loadImg(`assets/towers/archer_v2_${l}R.png`));
const ARCHER_SHEETS_L = [1, 2, 3].map(l => loadImg(`assets/towers/archer_v2_${l}L.png`));
const ARCHER_V2 = {
  cell: 256, cols: 5, frames: 8, fps: 20, releaseFrame: 4,
  bboxW: 101, bottom: 188, centerX: 126.5,
  // archer scale/height/rim-cut match the OFFICIAL `archer lv1.gif` (user's
  // reference), body anchored DEAD CENTRE on the tower (126.5). LEVEL 3 has
  // TWO archers side-by-side who BOTH turn to face the target and fire
  // together (user request) -- so its sheets have both archers facing the
  // same way, and it launches TWO arrows, one per bow. Bow positions are
  // arrays PER LEVEL, each an array of bow points (L1/L2 = 1 bow, L3 = 2),
  // measured off each release frame per facing direction.
  bowR: [
    [{ x: 143, y: 63 }],                     // L1: 1 archer facing right
    [{ x: 143, y: 63 }],                     // L2: 1 archer facing right
    [{ x: 128, y: 63 }, { x: 158, y: 63 }],  // L3: 2 archers, both facing right
  ],
  bowL: [
    [{ x: 110, y: 63 }],                     // L1: 1 archer facing left
    [{ x: 110, y: 63 }],                     // L2: 1 archer facing left
    [{ x: 94, y: 63 }, { x: 124, y: 63 }],   // L3: 2 archers, both facing left
  ],
};

// native-pixel offsets inside the base sprite's frame. IMPORTANT: the base
// sprites carry a drop shadow that pushes the sprite's bbox centre RIGHT of
// the real tower centre -- the true platform centre is x=75.5 (#3) / 75 (#6)
// / 76 (#7), NOT the 82px sprite half-width. rockX/plates are centred on that
// real centre so they sit on the platform, not the shadow. bky<fy raises the
// thin cradle plate (#1) so it mates flush with the thick front plate (#2).
// (kept for reference; superseded by the CANNON_SHEET frame animation)
const STONE_RIG = [
  { bkx: 1,   bky: 58, fx: 1.5, fy: 86, rockX: 75.5, rd: 35, lift: 58 }, // L1 #3 + plates #1/#2
  { bkx: 0.5, bky: 66, fx: 1,   fy: 94, rockX: 75,   rd: 35, lift: 58 }, // L2 #6 + plates #1/#2 (base swapped 3->6)
  { bkx: 1.5, bky: 66, fx: 2,   fy: 94, rockX: 76,   rd: 35, lift: 58 }, // L3 #7 + plates #4/#5
];
// kit explosion frame animation (files 54-61) for bomb impacts
const BOOM_FRAMES = Array.from({ length: 8 }, (_, i) => loadImg(`assets/stonefx/boom_${i}.png`));
// kit rock-shatter animation (files 40-44): the thrown rock lands and breaks
// apart into scattering debris -- used for the stone (Cannon) impact.
const SHATTER_FRAMES = Array.from({ length: 5 }, (_, i) => loadImg(`assets/stonefx/shatter_${i}.png`));

// projectile sprites (from the kit's tower packs). archer/stone rotate to face
// travel; the arrow art natively points up-left (-135deg) so we offset for that.
const PROJ_ART = {
  archer: loadImg('assets/projectiles/arrow2.png'), // kit archer-pack arrow #37, tip points RIGHT
  stone:  loadImg('assets/projectiles/rock.png'), // kit rock #40 — same rock that sits loaded on the tower
  magic:  loadImg('assets/projectiles/mbolt.png'), // yellow lightning bolt #19, rotates to travel dir
  lightning: loadImg('assets/projectiles/bolt.png'), // cyan-tinted orb
  poison: loadImg('assets/projectiles/poison.png'),
  flame:  loadImg('assets/projectiles/fireball.png'),
  sniper: loadImg('assets/projectiles/sbolt.png'),
  bomb:   loadImg('assets/projectiles/bomb.png'),
  ember:  loadImg('assets/emberfx/flame.png'), // the same flame #35 from the cradle, lobbed upside-down
  arcane: loadImg('assets/projectiles/abolt.png'), // green lightning bolt #21, rotates to travel dir
  storm:  loadImg('assets/projectiles/zbolt.png'), // cyan lightning bolt #23, rotates to travel dir
  hex:    loadImg('assets/projectiles/rbolt.png'), // red lightning bolt #25, rotates to travel dir
  ranger: loadImg('assets/projectiles/arrow2.png'), // same kit arrow as Archer, arrow-bezier flight
  ballista:loadImg('assets/projectiles/bbolt.png'), // ballista bolt (tip up), mortar-arc flight
};
const ARROW_NATIVE = -3 * Math.PI / 4; // arrow.png tip direction
// projectile sprites that point along travel: native tip angle (0 = points right)
const PROJ_FACING = { archer: -3 * Math.PI / 4, sniper: 0, flame: 0 };

const ENEMY_TYPES = {
  e1: { walk: loadFrames('assets/enemies/e1/1_enemies_1_walk_', 20), die: loadFrames('assets/enemies/e1/1_enemies_1_die_', 20), hp: 36, speed: 62, reward: 6, dmg: 1, size: 56, flip: true },
  e2: { walk: loadFrames('assets/enemies/e2/2_enemies_1_walk_', 20), die: loadFrames('assets/enemies/e2/2_enemies_1_die_', 20), hp: 58, speed: 52, reward: 8, dmg: 1, size: 58, flip: true },
  e4: { walk: loadFrames('assets/enemies/e4/4_enemies_1_walk_', 20), die: loadFrames('assets/enemies/e4/4_enemies_1_die_', 20), hp: 92, speed: 46, reward: 11, dmg: 1, size: 60, flip: true },
  e7: { walk: loadFrames('assets/enemies/e7/7_enemies_1_walk_', 20), die: loadFrames('assets/enemies/e7/7_enemies_1_die_', 20), hp: 140, speed: 40, reward: 15, dmg: 2, size: 64, flip: true },
  boss:{ walk: loadFrames('assets/boss/0_boss_walk_', 20), die: loadFrames('assets/boss/0_boss_die_', 20), hp: 1600, speed: 32, reward: 160, dmg: 5, size: 110, flip: false },
};

// ---- Tower configs ----
const TOWER_DEFS = {
  archer:  { cost: 50,  upgradeCost: [0, 40, 70],  range: 300, dmg: [8, 14, 22],  rate: 0.4,  splash: 0,  slow: 0, projColor: '#e8d27a', label: 'Archer' },
  magic:   { cost: 80,  upgradeCost: [0, 55, 95],  range: 270, dmg: [14, 24, 38], rate: 0.9,  splash: 45, slow: 0, projColor: '#f4e77a', label: 'Magic' },
  stone:   { cost: 100, upgradeCost: [0, 70, 120], range: 285, dmg: [30, 55, 90], rate: 1.6,  splash: 58, slow: 0, projColor: '#8b8b8b', label: 'Cannon' },
  support: { cost: 70,  upgradeCost: [0, 50, 85],  range: 240, dmg: [0, 0, 0],    rate: 0,    splash: 0,  slow: 0.45, projColor: '#7ad7ff', label: 'Frost' },
  lightning: { cost: 120, upgradeCost: [0, 80, 130], range: 330, dmg: [20, 36, 60], rate: 0.7, splash: 0, slow: 0, projColor: '#7de8ff', label: 'Lightning' },
  poison: { cost: 90,  upgradeCost: [0, 60, 100], range: 250, dmg: [3, 5, 8],    rate: 0.8, splash: 0,  slow: 0, projColor: '#8ede3f', label: 'Poison', dot: { dps: [9, 15, 24], dur: 3.5 } },
  flame:  { cost: 110, upgradeCost: [0, 75, 125], range: 180, dmg: [7, 12, 19],  rate: 0.4, splash: 60, slow: 0, projColor: '#ff7a2e', label: 'Flame', dot: { dps: [7, 12, 20], dur: 2 }, fxColor: '#ff8a2e' },
  sniper: { cost: 130, upgradeCost: [0, 90, 150], range: 520, dmg: [55, 100, 185], rate: 2.4, splash: 0, slow: 0, projColor: '#d8cba0', label: 'Sniper' },
  bomb:   { cost: 150, upgradeCost: [0, 100, 165], range: 250, dmg: [40, 72, 120], rate: 2.1, splash: 92, slow: 0, projColor: '#2e2e2e', label: 'Bomb', fxColor: '#ffb038' },
  ember:  { cost: 125, upgradeCost: [0, 85, 140], range: 270, dmg: [14, 24, 38], rate: 1.0, splash: 58, slow: 0, projColor: '#ff7a2e', label: 'Lava', dot: { dps: [11, 18, 28], dur: 2.5 }, fxColor: '#ff8a2e' },
  arcane: { cost: 100, upgradeCost: [0, 70, 120], range: 300, dmg: [18, 32, 52], rate: 0.85, splash: 55, slow: 0, projColor: '#6fe6c0', label: 'Arcane' },
  storm:  { cost: 115, upgradeCost: [0, 80, 135], range: 320, dmg: [22, 40, 64], rate: 0.75, splash: 48, slow: 0, projColor: '#87e9f2', label: 'Storm' },
  hex:    { cost: 130, upgradeCost: [0, 90, 150], range: 310, dmg: [26, 48, 78], rate: 0.8,  splash: 52, slow: 0, projColor: '#ee5a50', label: 'Hex' },
  ranger: { cost: 90,  upgradeCost: [0, 60, 105], range: 330, dmg: [14, 24, 40], rate: 0.5,  splash: 0,  slow: 0, projColor: '#e8d27a', label: 'Ranger' },
  ballista:{ cost: 140, upgradeCost: [0, 95, 160], range: 340, dmg: [32, 58, 94], rate: 1.8,  splash: 44, slow: 0, projColor: '#b7beC4', label: 'Ballista' },
};

// ---- Game state ----
const state = {
  gold: 180,
  lives: 20,
  wave: 0,
  waveMax: 10,
  running: false,
  paused: false,
  speed: 1,
  enemies: [],
  towers: [],
  projectiles: [],
  effects: [],
  selectedBuyType: null,
  selectedTower: null,
  waveInProgress: false,
  spawnQueue: [],
  spawnTimer: 0,
  spawnLaneCounter: 0,
  gameOver: false,
};

// ---- DOM refs ----
const goldVal = document.getElementById('goldVal');
const livesVal = document.getElementById('livesVal');
const waveVal = document.getElementById('waveVal');
const waveMaxEl = document.getElementById('waveMax');
const startWaveBtn = document.getElementById('startWaveBtn');
const speedBtn = document.getElementById('speedBtn');
const pauseBtn = document.getElementById('pauseBtn');
const toast = document.getElementById('toast');
const towerPanel = document.getElementById('towerPanel');
const towerPanelInfo = document.getElementById('towerPanelInfo');
const upgradeBtn = document.getElementById('upgradeBtn');
const sellBtn = document.getElementById('sellBtn');
const closeTowerPanel = document.getElementById('closeTowerPanel');
const overlay = document.getElementById('overlay');
const overlayHeader = document.getElementById('overlayHeader');
const overlayTitle = document.getElementById('overlayTitle');
const overlaySub = document.getElementById('overlaySub');
const overlayBtn = document.getElementById('overlayBtn');

waveMaxEl.textContent = state.waveMax;

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('show'), 1600);
}

function updateHud() {
  goldVal.textContent = state.gold;
  livesVal.textContent = Math.max(0, state.lives);
  waveVal.textContent = state.wave;
}

// ---- Sidebar tower buying ----
document.querySelectorAll('.tower-buy').forEach(el => {
  el.addEventListener('click', () => {
    const type = el.dataset.tower;
    if (state.selectedBuyType === type) {
      state.selectedBuyType = null;
      el.classList.remove('selected');
    } else {
      document.querySelectorAll('.tower-buy').forEach(e => e.classList.remove('selected'));
      state.selectedBuyType = type;
      el.classList.add('selected');
    }
    deselectTower();
  });
});

// ---- Entities ----
class Enemy {
  constructor(typeKey, laneIdx) {
    this.type = typeKey;
    const def = ENEMY_TYPES[typeKey];
    this.def = def;
    this.hp = def.hp;
    this.maxHp = def.hp;
    this.laneIdx = laneIdx;
    this.dist = 0;
    this.dead = false;
    this.removeMe = false;
    this.dying = false;
    this.dieFrame = 0;
    this.dieTimer = 0;
    this.animTimer = 0;
    this.animFrame = 0;
    this.slowUntil = 0;
    this.dots = []; // active damage-over-time stacks {dps, remain, acc, color}
    this.pos = lanes[laneIdx].pointAtDistance(0);
    this.facing = 1; // 1 = right (native sprite direction), -1 = left
  }
  // poison/burn: one stack per color; refresh keeps the stronger dps + longer time
  applyDot(dps, dur, color) {
    const ex = this.dots.find(d => d.color === color);
    if (ex) { ex.dps = Math.max(ex.dps, dps); ex.remain = Math.max(ex.remain, dur); }
    else this.dots.push({ dps, remain: dur, acc: 0, color });
  }
  update(dt) {
    if (this.dying) {
      this.dieTimer += dt;
      const frameDur = 0.03;
      this.dieFrame = Math.min(this.def.die.length - 1, Math.floor(this.dieTimer / frameDur));
      if (this.dieTimer > frameDur * this.def.die.length) this.removeMe = true;
      return;
    }
    // damage over time (poison / burn): tick 4x per second
    if (this.dots.length) {
      for (const d of this.dots) {
        d.remain -= dt; d.acc += dt;
        while (d.acc >= 0.25) { d.acc -= 0.25; this.takeDamage(d.dps * 0.25); }
      }
      this.dots = this.dots.filter(d => d.remain > 0);
      if (this.dying) return;
    }
    let speedMul = 1;
    for (const t of state.towers) {
      if (t.type === 'support' && dist2(this.pos, t) <= (TOWER_DEFS.support.range) ** 2) {
        speedMul = Math.min(speedMul, 1 - TOWER_DEFS.support.slow);
      }
    }
    const lane = lanes[this.laneIdx];
    this.dist += this.def.speed * speedMul * dt;
    this.pos = lane.pointAtDistance(this.dist);
    const dx = Math.cos(this.pos.angle);
    if (dx > 0.15) this.facing = 1;
    else if (dx < -0.15) this.facing = -1;
    this.animTimer += dt;
    if (this.animTimer > 0.06) { this.animTimer = 0; this.animFrame = (this.animFrame + 1) % this.def.walk.length; }
    if (this.dist >= lane.total) {
      state.lives -= this.def.dmg;
      this.removeMe = true;
      updateHud();
      if (state.lives <= 0) triggerGameOver(false);
    }
  }
  takeDamage(dmg) {
    if (this.dying) return;
    this.hp -= dmg;
    if (this.hp <= 0) {
      this.dying = true;
      state.gold += this.def.reward;
      updateHud();
    }
  }
  draw() {
    const size = this.def.size;
    // damage-over-time aura under the enemy (green poison / orange burn)
    if (this.dots.length && !this.dying) {
      const now = performance.now() / 1000;
      for (const d of this.dots) {
        const pulse = 0.5 + 0.5 * Math.sin(now * 6);
        const rr = size * 0.36;
        const g = ctx.createRadialGradient(this.pos.x, this.pos.y, 0, this.pos.x, this.pos.y, rr);
        g.addColorStop(0, d.color + '00');
        g.addColorStop(0.7, d.color + Math.round((0.35 + pulse * 0.3) * 255).toString(16).padStart(2, '0'));
        g.addColorStop(1, d.color + '00');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(this.pos.x, this.pos.y - 2, rr, rr * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
    const frames = this.dying ? this.def.die : this.def.walk;
    const idx = this.dying ? this.dieFrame : this.animFrame;
    const img = frames[idx];
    if (img && img.complete && img.naturalWidth) {
      const ar = img.naturalWidth / img.naturalHeight;
      let w = size, h = size / ar;
      if (h > size) { h = size; w = size * ar; }
      const flip = this.def.flip && this.facing === -1;
      if (flip) {
        // mirror about the sprite's own vertical centreline
        ctx.save();
        ctx.translate(this.pos.x, 0);
        ctx.scale(-1, 1);
        ctx.translate(-this.pos.x, 0);
      }
      ctx.drawImage(img, this.pos.x - w / 2, this.pos.y - h + 8, w, h);
      if (flip) ctx.restore();
    }
    if (!this.dying) {
      const bw = size * 0.8;
      const bx = this.pos.x - bw / 2, by = this.pos.y - size - 2;
      ctx.fillStyle = '#000a';
      ctx.fillRect(bx - 1, by - 1, bw + 2, 7);
      ctx.fillStyle = '#c93a3a';
      ctx.fillRect(bx, by, bw, 5);
      ctx.fillStyle = '#5fd35f';
      ctx.fillRect(bx, by, bw * Math.max(0, this.hp / this.maxHp), 5);
    }
  }
}

function dist2(pos, t) { return (pos.x - t.x) ** 2 + (pos.y - t.y) ** 2; }

class Tower {
  constructor(type, x, y) {
    this.type = type;
    this.x = x; this.y = y;
    this.level = 1;
    this.cooldown = 0;
    this.target = null;
    this.spent = TOWER_DEFS[type].cost;
    this.angle = 0;
    this.spot = -1; // index into BUILD_SPOTS this tower occupies
    this.fireT = 0;          // counts down after each shot -> drives recoil/flash
    this.fireDur = 0.22;     // seconds the firing reaction lasts
    this.bobPhase = Math.random() * Math.PI * 2; // desync idle bob between towers
    this.pendingShot = null; // stone launcher: rock releases at lift peak
    this.sheetT = -1;        // sheet animation clock (-1 = idle)
    this.faceLeft = false;   // mirrored sheets (archer) pick by aim side
  }
  get def() { return TOWER_DEFS[this.type]; }
  get range() { return this.def.range + (this.level - 1) * 30; }
  get dmg() { return this.def.dmg[this.level - 1]; }
  // y of the tower's visual top (rod/coil/turret tip) -- muzzle flashes and
  // projectiles originate here so they match each sprite's real height
  get tipY() {
    const img = TOWER_ART[this.type][this.level - 1];
    const size = 76;
    if (img && img.complete && img.naturalWidth) {
      const ar = img.naturalWidth / img.naturalHeight;
      let h = size / ar;
      if (h > size) h = size;
      // stone/ember launch from their press plate at the TOP of the lift
      const frac = this.type === 'stone' ? 0.80 : this.type === 'ember' ? 0.72 : 0.94;
      return this.y + 14 - h * frac;
    }
    return this.y - 45;
  }
  update(dt) {
    if (this.fireT > 0) this.fireT = Math.max(0, this.fireT - dt);
    if (this.def.rate === 0) return; // support tower: passive aura only
    this.cooldown -= dt;
    if (!this.target || this.target.removeMe || this.target.dying || dist2(this.target.pos, this) > this.range ** 2) {
      this.target = this.findTarget();
    }
    if (this.target) {
      this.angle = Math.atan2(this.target.pos.y - this.y, this.target.pos.x - this.x);
    }
    if (this.target && this.cooldown <= 0) {
      this.cooldown = this.def.rate;
      this.fireT = this.fireDur; // kick off the recoil/muzzle-flash animation
      if (this.type === 'lightning') {
        // no flying projectile: the sky strikes the target instantly
        const p = this.target.pos;
        this.target.takeDamage(this.dmg);
        state.effects.push(new LightningStrikeFX(p.x, p.y - this.target.def.size * 0.35));
      } else if (this.sheetRig() && this.sheetRig().cfg.loop) {
        // magic/arcane: the crackle plays NONSTOP, so bolts leave the gem(s)
        // IMMEDIATELY. Each gem fires its OWN bolt at its OWN target (arcane L3
        // = 3 gems -> up to 3 different monsters); dmg is split across gems so
        // a multi-gem tower isn't a flat multiplier on a single target.
        const gems = this.gemLaunchPositions();
        const tgts = this.findTargets(gems.length);
        const col = this.type === 'magic' ? '#f4e77a' : this.type === 'storm' ? '#87e9f2' : this.type === 'hex' ? '#ee5a50' : this.type === 'ranger' ? '#f0e2b0' : '#6fe6c0';
        const dScale = gems.length > 1 ? 0.5 : 1;
        for (let i = 0; i < gems.length && tgts.length; i++) {
          const tgt = tgts[i % tgts.length];
          state.projectiles.push(new Projectile(this, tgt, gems[i], dScale));
          state.effects.push(new ImpactFX(gems[i].x, gems[i].y, 12, col));
        }
      } else if (this.sheetRig()) {
        // sheet-animated towers: play the fire cycle; the ammo leaves at the
        // sheet's release frame, not instantly
        this.pendingShot = this.target;
        this.sheetT = 0;
      } else {
        state.projectiles.push(new Projectile(this, this.target));
      }
    }
    // face the current target (mirrored archer sheets pick by this)
    if (this.target) this.faceLeft = this.target.pos.x < this.x;
    // sheet towers: advance the clock; the ammo launches at releaseFrame,
    // from its measured position on the sheet
    const rig = this.sheetRig();
    if (rig && this.sheetT >= 0) {
      this.sheetT += dt;
      const f = Math.floor(this.sheetT * rig.cfg.fps);
      if (this.pendingShot && f >= rig.cfg.releaseFrame) {
        let tgt = this.pendingShot;
        if (tgt.removeMe || tgt.dying) tgt = this.findTarget();
        if (tgt) {
          const lp = this.stoneLaunchPos();
          if (this.type === 'ember') {
            // hand the flame's spot/size to the projectile (continuity)
            this.emberLaunchX = lp.x; this.emberLaunchY = lp.y;
            this.emberLaunchW = EMBER_V2.flameW * ((76 * 0.926) / CANNON_V2.bboxW);
          }
          if (this.type === 'archer' || this.type === 'ranger') {
            // fire one arrow per bow (L3's two archers shoot together); split
            // the tower's damage across them so DPS matches the level's balance
            const lps = this.archerLaunchPositions();
            for (const alp of lps) {
              state.projectiles.push(new Projectile(this, tgt, alp, 1 / lps.length));
            }
          } else {
            state.projectiles.push(new Projectile(this, tgt));
            state.effects.push(new ImpactFX(lp.x, lp.y, 12,
              this.type === 'ember' ? '#ff8a2e' : this.type === 'magic' ? '#f4e77a' : this.type === 'arcane' ? '#6fe6c0' : '#d8cba0'));
          }
        }
        this.pendingShot = null;
      }
      if (this.sheetT >= rig.cfg.frames / rig.cfg.fps) this.sheetT = -1; // cycle done
    }
  }
  // sheet-animated towers: which sheet + config + ammo release point applies
  sheetRig() {
    const lv = this.level - 1;
    if (this.type === 'stone') return { img: CANNON_SHEETS[lv], cfg: CANNON_V2, peak: CANNON_V2.rockPeak };
    if (this.type === 'ember') return { img: EMBER_SHEETS[lv], cfg: CANNON_V2, peak: EMBER_V2.flamePeak };
    if (this.type === 'magic') return { img: MAGIC_SHEETS[lv], cfg: MAGIC_V2, peak: MAGIC_V2.boltFrom[lv][0] };
    if (this.type === 'arcane') return { img: ARCANE_SHEETS[lv], cfg: ARCANE_V2, peak: ARCANE_V2.boltFrom[lv][0] };
    if (this.type === 'storm') return { img: STORM_SHEETS[lv], cfg: STORM_V2, peak: STORM_V2.boltFrom[lv][0] };
    if (this.type === 'hex') return { img: HEX_SHEETS[lv], cfg: HEX_V2, peak: HEX_V2.boltFrom[lv][0] };
    if (this.type === 'ballista') return { img: BALLISTA_SHEETS[lv], cfg: BALLISTA_V2, peak: BALLISTA_V2.boltPeak };
    if (this.type === 'ranger') {
      const bows = (this.faceLeft ? RANGER_V2.bowL : RANGER_V2.bowR)[lv];
      return { img: (this.faceLeft ? RANGER_SHEETS_L : RANGER_SHEETS_R)[lv], cfg: RANGER_V2, peak: bows[0], peaks: bows };
    }
    if (this.type === 'archer') {
      const peaks = (this.faceLeft ? ARCHER_V2.bowL : ARCHER_V2.bowR)[lv];
      return {
        img: (this.faceLeft ? ARCHER_SHEETS_L : ARCHER_SHEETS_R)[lv],
        cfg: ARCHER_V2,
        peak: peaks[0], // primary bow (single-point users: draw muzzle etc.)
        peaks,          // all bows: L3 has 2, L1/L2 have 1
      };
    }
    return null;
  }
  // where the ammo sits at the release frame (screen coords), derived from the
  // sheet's measured geometry at this tower's drawn scale
  stoneLaunchPos() {
    const rig = this.sheetRig();
    if (!rig) return { x: this.x, y: this.tipY };
    const size = 76;
    const scale = (size * 0.926) / rig.cfg.bboxW; // match previous drawn width
    return {
      x: this.x + (rig.peak.x - rig.cfg.centerX) * scale,
      y: this.y + 14 - (rig.cfg.bottom - rig.peak.y) * scale,
    };
  }
  // all gem launch points (screen) for a loop tower at this level -- arcane L3
  // has 3 gems (centre/left/right), magic + arcane L1/L2 have 1
  gemLaunchPositions() {
    const rig = this.sheetRig(); const cfg = rig.cfg;
    const scale = (76 * 0.926) / cfg.bboxW;
    // ranger picks its bow per facing (rig.peaks); others use cfg.boltFrom
    const gems = rig.peaks || cfg.boltFrom[this.level - 1];
    return gems.map(g => ({
      x: this.x + (g.x - cfg.centerX) * scale,
      y: this.y + 14 - (cfg.bottom - g.y) * scale,
    }));
  }
  // up to n enemies in range, furthest-along first; pads by cycling so every
  // gem of a multi-gem tower gets a target (same monster if too few)
  findTargets(n) {
    const inR = state.enemies.filter(e => !e.dying && !e.removeMe && dist2(e.pos, this) <= this.range ** 2);
    inR.sort((a, b) => b.dist - a.dist);
    if (!inR.length) return [];
    const out = [];
    for (let i = 0; i < n; i++) out.push(inR[i % inR.length]);
    return out;
  }
  // every ammo launch point this frame (archer L3 = both bows, else 1),
  // mapped from the sheet's measured bow peaks through the drawn scale
  archerLaunchPositions() {
    const rig = this.sheetRig();
    const size = 76;
    const scale = (size * 0.926) / rig.cfg.bboxW;
    return rig.peaks.map(pk => ({
      x: this.x + (pk.x - rig.cfg.centerX) * scale,
      y: this.y + 14 - (rig.cfg.bottom - pk.y) * scale,
    }));
  }
  findTarget() {
    let best = null, bestDist = -1;
    for (const e of state.enemies) {
      if (e.dying || e.removeMe) continue;
      const d2 = dist2(e.pos, this);
      if (d2 <= this.range ** 2 && e.dist > bestDist) { best = e; bestDist = e.dist; }
    }
    return best;
  }
  draw(hovered) {
    const arts = TOWER_ART[this.type];
    const img = arts[this.level - 1];
    const size = 76;
    const now = performance.now() / 1000;

    // firing reaction: fp goes 1 -> 0 over fireDur. Front half is a sharp
    // "punch" (recoil back + squash), back half eases back to rest.
    const fp = this.fireT / this.fireDur;               // 1 at shot, 0 at rest
    const kick = Math.sin(Math.min(1, fp) * Math.PI);   // 0->1->0 bump (drives flash/lift only)
    const ax = Math.cos(this.angle), ay = Math.sin(this.angle);
    // the tower body itself stays perfectly still -- no recoil, squash or idle
    // bob (per user request). `kick` still animates the muzzle flash, the stone
    // launcher plate lift, and the projectile release timing.
    const rx = 0, ry = 0, sx = 1, sy = 1, bob = 0;

    let spriteH = size * 0.8; // fallback if art not loaded yet
    let stoneMuzzle = null;
    if (img && img.complete && img.naturalWidth) {
      const ar = img.naturalWidth / img.naturalHeight;
      let w = size, h = size / ar;
      if (h > size) { h = size; w = size * ar; }
      spriteH = h;
      const baseY = this.y + 14; // sprites are anchored by their bottom edge

      // cannon v2: the whole tower (base + press + rock) comes straight from
      // the user's sprite-sheet animation -- no piece composition needed.
      // Idle shows frame 0; firing plays the 25-frame throw cycle.
      let stoneSheet = false;
      const rig = this.sheetRig();
      if (rig && rig.img && rig.img.complete && rig.img.naturalWidth) {
        stoneSheet = true;
        const cfg = rig.cfg;
        // loop towers (magic/arcane) crackle continuously off a free-running
        // clock (+ a per-tower phase from x so neighbours don't flash in sync);
        // others show frame 0 at idle and play the cycle only while firing.
        const f = cfg.loop
          ? Math.floor((now + this.x * 0.013) * cfg.fps) % cfg.frames
          : (this.sheetT >= 0 ? Math.min(cfg.frames - 1, Math.floor(this.sheetT * cfg.fps)) : 0);
        const su = (f % cfg.cols) * cfg.cell, sv = Math.floor(f / cfg.cols) * cfg.cell;
        const scale = (size * 0.926) / cfg.bboxW; // tower drawn ~70px wide like before
        const dw = cfg.cell * scale;
        ctx.drawImage(rig.img, su, sv, cfg.cell, cfg.cell,
          this.x - cfg.centerX * scale, baseY - cfg.bottom * scale, dw, dw);
        stoneMuzzle = this.stoneLaunchPos();
      }

      // ember (Lava): computed here, but the whole cradle (plate #8 -> flame ->
      // plate #9) is drawn OVER the base so the flame shows on #8 and behind #9
      // (per the reference art), not tucked behind the base. Fires like the
      // cannon: the press + flame LIFT on the shot (jump), flame launches at
      // the peak then reloads.
      let emberS = 0, emberOx = 0, emberOy = 0, emberJump = 0, emberLoaded = false;
      if (this.type === 'ember' && !stoneSheet) {
        emberS = w / img.naturalWidth;
        emberOx = this.x - w / 2;
        emberOy = baseY - h;
        emberJump = kick * EMBER_RIG.lift * emberS;
        emberLoaded = this.pendingShot || this.cooldown <= this.def.rate * 0.5;
      }

      if (!stoneSheet) {
        ctx.save();
        ctx.translate(this.x + rx, baseY + ry);
        ctx.scale(sx, sy + bob);
        ctx.drawImage(img, -w / 2, -h, w, h);
        ctx.restore();
      }

      if (this.type === 'ember' && !stoneSheet) {
        const rg = EMBER_RIG;
        // #8 back plate ON the base platform
        if (EMBER_BACK.complete && EMBER_BACK.naturalWidth) {
          ctx.drawImage(EMBER_BACK, emberOx + rg.bkx * emberS, emberOy + rg.bky * emberS - emberJump,
            EMBER_BACK.naturalWidth * emberS, EMBER_BACK.naturalHeight * emberS);
        }
        // flame ON #8, behind #9 -- the loaded ammo (hides on launch like the
        // rock). Static while idle (no flicker animation); flares only on the shot.
        if (emberLoaded && EMBER_FLAME.complete && EMBER_FLAME.naturalWidth) {
          const flick = 1 + kick * 0.5;
          const fw = rg.flameW * emberS * flick;
          const fh = fw * EMBER_FLAME.naturalHeight / EMBER_FLAME.naturalWidth;
          const fx0 = emberOx + rg.flameX * emberS - fw / 2;
          const fy0 = emberOy + rg.flameBottom * emberS - fh - emberJump;
          ctx.save();                 // flame drawn UPSIDE-DOWN (reference art)
          ctx.translate(fx0, fy0 + fh);
          ctx.scale(1, -1);
          ctx.drawImage(EMBER_FLAME, 0, 0, fw, fh);
          ctx.restore();
          stoneMuzzle = { x: emberOx + rg.flameX * emberS, y: fy0 };
          // remember the flame's exact spot + size so the launched projectile
          // starts HERE at the SAME size (continuity: the same flame flies off)
          this.emberLaunchX = emberOx + rg.flameX * emberS;
          this.emberLaunchY = fy0 + fh / 2;
          this.emberLaunchW = fw;
        }
        // #9 front plate covers the flame's bottom
        if (EMBER_FRONT.complete && EMBER_FRONT.naturalWidth) {
          ctx.drawImage(EMBER_FRONT, emberOx + rg.fx * emberS, emberOy + rg.fy * emberS - emberJump,
            EMBER_FRONT.naturalWidth * emberS, EMBER_FRONT.naturalHeight * emberS);
        }
        if (!stoneMuzzle) stoneMuzzle = { x: this.x, y: emberOy + rg.flameBottom * emberS - 18 };
      }
    }

    // sniper: rotating ballista turret mounted on the base platform, aiming
    // at the current target (this.angle is kept pointed at the target while
    // a target is in range)
    let sniperBarrel = null;
    if (this.type === 'sniper') {
      const ti = this.level - 1;
      const tim = SNIPER_TURRET[ti];
      if (tim && tim.complete && tim.naturalWidth) {
        const tw = SNIPER_TURRET_W[ti], th = tw * tim.naturalHeight / tim.naturalWidth;
        const [pfx, pfy] = SNIPER_PIVOT[ti];
        const mountX = this.x, mountY = this.y + 14 - spriteH * 0.72;
        const cx = mountX, cy = mountY; // turret aims but doesn't recoil
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(this.angle);
        ctx.drawImage(tim, -pfx * tw, -pfy * th, tw, th);
        ctx.restore();
        sniperBarrel = { x: cx + ax * tw * 0.6, y: cy + ay * tw * 0.6 };
      }
    }


    // muzzle flash: a quick bright pop AT THE TOWER'S TIP when firing
    // (lightning rod / coil / turret top), leaning slightly toward the target
    if (kick > 0.15 && this.def.rate > 0) {
      const tipY = this.y + 14 - spriteH * 0.94; // just below the very top
      const lean = this.type === 'lightning' ? 0 : 8; // tesla rod is vertical
      let mx = this.x + rx + ax * lean;
      let my = tipY + ry + ay * (lean * 0.6);
      if (sniperBarrel) { mx = sniperBarrel.x; my = sniperBarrel.y; } // ballista tip
      if (stoneMuzzle) { mx = stoneMuzzle.x; my = stoneMuzzle.y; }    // launcher plate
      const fr = 4 + kick * 9;
      const g = ctx.createRadialGradient(mx, my, 0, mx, my, fr);
      g.addColorStop(0, `rgba(255,255,235,${0.85 * kick})`);
      g.addColorStop(0.5, this.def.projColor + 'cc');
      g.addColorStop(1, this.def.projColor + '00');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(mx, my, fr, 0, Math.PI * 2);
      ctx.fill();
    }

    // frost support tower doesn't shoot -> show a slow pulsing aura ring
    if (this.def.slow > 0) {
      const pulse = 0.5 + 0.5 * Math.sin(now * 1.6 + this.bobPhase);
      ctx.save();
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.range * (0.9 + pulse * 0.1), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(122,215,255,${0.10 + pulse * 0.18})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    if (hovered || state.selectedTower === this) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.range, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,216,118,0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,216,118,0.08)';
      ctx.fill();
    }
  }
}

class Projectile {
  constructor(tower, target, launchOverride, dmgScale) {
    this.tower = tower;
    this.target = target;
    this.dmgScale = dmgScale || 1; // <1 when a shot is split across bows (archer L3)
    this.x = tower.x; this.y = tower.tipY; // launch from the tower's tip
    // ember: launch from the exact flame position on the platform (last drawn)
    // AND inherit its drawn size, so it reads as the SAME flame flying off
    if (tower.type === 'ember' && tower.emberLaunchY != null) {
      this.x = tower.emberLaunchX; this.y = tower.emberLaunchY;
      this.drawW = tower.emberLaunchW || 16;
    }
    // sheet towers (cannon/archer): launch from the sheet's measured ammo
    // position at the release frame (cradle top / bow). archer L3 passes an
    // explicit per-bow launch point so each arrow leaves its own archer.
    if (tower.type === 'stone' || tower.type === 'archer' || tower.type === 'magic' || tower.type === 'arcane' || tower.type === 'storm' || tower.type === 'hex' || tower.type === 'ranger' || tower.type === 'ballista') {
      const lp = launchOverride || tower.stoneLaunchPos();
      this.x = lp.x; this.y = lp.y;
    }
    this.speed = tower.type === 'sniper' ? 1300 : (tower.type === 'bomb' || tower.type === 'stone' || tower.type === 'ember') ? 470 : 620;
    this.dead = false;
    this.angle = 0;   // travel direction, kept updated for sprite facing
    this.spin = 0;    // cannonball/bomb tumble
    this.lob = tower.type === 'bomb' || tower.type === 'stone' || tower.type === 'ember'; // arcs through the air
    this.arcH = 0;
    this.travelled = 0;
    this.totalD = Math.hypot(target.pos.x - this.x, target.pos.y - this.y) || 1;
    // arc height of the parabola (gentler for ember so downhill shots read well)
    this.peak = !this.lob ? 0 :
      tower.type === 'ember' ? Math.min(70, this.totalD * 0.2) : Math.min(120, this.totalD * 0.3);
    // Bezier flight paths:
    //  - ember: MORTAR -- straight UP first, graceful arc over, dive down
    //  - archer: ARROW -- flies STRAIGHT at the target first, then gently
    //    curves/drops onto it like a real arrow under gravity
    this.mortar = tower.type === 'ember' || tower.type === 'archer' || tower.type === 'ranger' || tower.type === 'ballista';
    this.arcMode = (tower.type === 'archer' || tower.type === 'ranger') ? 'arrow' : 'mortar';
    if (this.mortar) {
      this.lob = false;              // bezier replaces the parabola hop
      this.t = 0;
      this.p0 = { x: this.x, y: this.y };
      if (this.arcMode === 'arrow') {
        this.riseH = Math.min(28, this.totalD * 0.12);      // slight loft only
        this.dur = Math.max(0.25, this.totalD / 700);       // quick, arrow-fast
        this.visAngle = Math.atan2(target.pos.y - this.y, target.pos.x - this.x);
      } else {
        this.riseH = Math.max(80, this.totalD * 0.35);      // how high it climbs first
        this.dur = Math.max(0.6, this.totalD / this.speed); // min air-time so the rise reads
        this.visAngle = -Math.PI / 2;                       // frame one: heading straight up
      }
    }
    // ACTUAL on-screen velocity angle (includes the arc), valid from frame ONE
    // so the flame never draws with a wrong placeholder direction at launch
    this.angle = Math.atan2(target.pos.y - this.y, target.pos.x - this.x);
    if (!this.mortar) this.visAngle = this.computeVisAngle(0);
  }
  // analytic on-screen velocity direction at path fraction `frac`:
  // the drawn position is (x, y - arcH), so its vertical velocity is the
  // straight-line dy MINUS the arc's slope d(arcH)/dt.
  computeVisAngle(frac) {
    const vx = Math.cos(this.angle) * this.speed;
    let vy = Math.sin(this.angle) * this.speed;
    if (this.lob) {
      const dArc = this.peak * Math.PI * Math.cos(Math.min(1, frac) * Math.PI) * (this.speed / this.totalD);
      vy -= dArc;
    }
    return Math.atan2(vy, vx);
  }
  update(dt) {
    if (!this.target || this.target.removeMe) { this.dead = true; return; }
    const tx = this.target.pos.x, ty = this.target.pos.y - this.target.def.size * 0.4;

    if (this.mortar) {
      // cubic Bezier mortar path: P0 launch, P1 straight above P0 (forces a
      // clean vertical climb), P2 above the target (forces a downward finish),
      // P3 the target. Re-evaluated each frame so it homes on moving monsters,
      // and the direction (Bezier derivative) rotates smoothly the whole way.
      this.t = Math.min(1, this.t + dt / this.dur);
      const s = this.t, is = 1 - s;
      let p1x, p1y, p2x, p2y;
      if (this.arcMode === 'arrow') {
        // ARROW: first control point lies ALONG the line to the target
        // (slightly lofted) so it leaves the bow flying straight, and the
        // approach control sits just above the target so it drops in gently
        const ddx = tx - this.p0.x, ddy = ty - this.p0.y;
        p1x = this.p0.x + ddx * 0.33;
        p1y = this.p0.y + ddy * 0.33 - this.riseH;
        p2x = tx - ddx * 0.2;
        p2y = ty - ddy * 0.2 - this.riseH * 0.6;
      } else {
        // MORTAR: P2 must crest ABOVE the launch too (esp. when the target
        // stands BELOW the tower) so the flame clearly climbs, levels over,
        // THEN dives -- instead of whipping downward right after leaving
        p1x = this.p0.x;               p1y = this.p0.y - this.riseH;
        p2x = tx;                      p2y = Math.min(this.p0.y - this.riseH * 0.55, ty - 70);
      }
      this.x = is*is*is * this.p0.x + 3*is*is*s * p1x + 3*is*s*s * p2x + s*s*s * tx;
      this.y = is*is*is * this.p0.y + 3*is*is*s * p1y + 3*is*s*s * p2y + s*s*s * ty;
      const dxT = 3*is*is * (p1x - this.p0.x) + 6*is*s * (p2x - p1x) + 3*s*s * (tx - p2x);
      const dyT = 3*is*is * (p1y - this.p0.y) + 6*is*s * (p2y - p1y) + 3*s*s * (ty - p2y);
      if (dxT * dxT + dyT * dyT > 0.0001) this.visAngle = Math.atan2(dyT, dxT);
      if (this.t >= 1) {
        this.hit();
        this.dead = true;
      }
      return;
    }

    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    this.angle = Math.atan2(dy, dx);
    this.spin += dt * 14;
    const move = this.speed * dt;
    this.travelled += move;
    if (this.lob) { // parabolic hop, peak at mid-flight
      const frac = Math.min(1, this.travelled / this.totalD);
      this.arcH = Math.sin(frac * Math.PI) * this.peak;
      this.visAngle = this.computeVisAngle(frac); // smooth, exact every frame
    }
    if (d <= move) {
      this.hit();
      this.dead = true;
      return;
    }
    this.x += (dx / d) * move;
    this.y += (dy / d) * move;
  }
  hit() {
    const def = this.tower.def;
    const dmg = this.tower.dmg * this.dmgScale;
    const lvl = this.tower.level - 1;
    const applyTo = e => {
      e.takeDamage(dmg);
      if (def.dot) e.applyDot(def.dot.dps[lvl], def.dot.dur, def.projColor);
    };
    if (def.splash > 0) {
      for (const e of state.enemies) {
        if (e.dying || e.removeMe) continue;
        if (Math.hypot(e.pos.x - this.target.pos.x, e.pos.y - this.target.pos.y) <= def.splash) applyTo(e);
      }
    } else {
      applyTo(this.target);
    }
    // impact burst at the point of contact; bigger for splash towers.
    // stone/bomb use the kit's real explosion frame animation (demo-GIF style);
    // everything else keeps the procedural ring+sparks.
    const r = def.splash > 0 ? def.splash * 0.9 : 16;
    const type = this.tower.type;
    if (type === 'stone') {
      // the thrown rock lands and shatters into debris (kit frames 40-44),
      // scaling up proportionally as the pieces scatter
      state.effects.push(new FrameFX(this.x, this.y, r * 0.7, SHATTER_FRAMES, 16, true));
    } else if (type === 'ember') {
      // fireball bursts into scattering embers (kit frames 35-39)
      state.effects.push(new FrameFX(this.x, this.y, r * 0.8, EMBER_BURST, 16, true));
    } else if (type === 'bomb') {
      state.effects.push(new FrameFX(this.x, this.y, r * 0.8, BOOM_FRAMES));
    } else {
      state.effects.push(new ImpactFX(this.x, this.y, r, def.fxColor || def.projColor));
    }
  }
  draw() {
    const type = this.tower.type;
    const img = PROJ_ART[type];
    const projColor = this.tower.def.projColor;
    const drawY = this.y - this.arcH; // lobbed shots hop up
    if (img && img.complete && img.naturalWidth) {
      const ar = img.naturalWidth / img.naturalHeight;
      ctx.save();
      // soft shadow on the ground for lobbed bombs
      if (this.lob && this.arcH > 2) {
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.beginPath(); ctx.ellipse(this.x, this.y + 6, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.translate(this.x, drawY);
      if (type === 'archer' || type === 'ranger') {
        // arrow #37 (tip natively points right) tilts along its bezier flight:
        // straight out of the bow, then nosing down as it drops on the target
        const w = 26, h = w / ar;
        ctx.rotate(this.visAngle);
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
      } else if (type === 'sniper') {
        const size = 40;
        ctx.rotate(this.angle - PROJ_FACING[type]);
        const w = size, h = size / ar;
        ctx.drawImage(img, -w * 0.32, -h / 2, w, h);
      } else if (type === 'flame') {
        ctx.rotate(this.angle - PROJ_FACING.flame);
        const w = 30, h = 30 / ar;
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
      } else if (type === 'stone' || type === 'bomb') {
        const size = type === 'bomb' ? 26 : 26;
        ctx.rotate(this.spin);
        ctx.drawImage(img, -size / 2, -size / 2, size, size);
      } else if (type === 'ember') {
        // the flame HEAD leads its flight path. In sprite #35 the HEAD is the
        // wide blobby BOTTOM (+y, angle +PI/2) and the pointed tip is the TAIL.
        // Rotate so that bottom/head aligns with the on-screen velocity: head
        // points up/out on launch, then droops to point down as it arcs down.
        // Size is inherited from the platform flame at launch (continuity).
        const w = this.drawW || 16, h = w * img.naturalHeight / img.naturalWidth;
        ctx.rotate(this.visAngle - Math.PI / 2);
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
      } else if (type === 'ballista') {
        // ballista bolt (tip natively UP) on a mortar arc; tip leads the
        // velocity. L3 fires the GOLD bolt (matches the gif), L1/L2 steel.
        const bimg = (this.tower.level === 3 && BALLISTA_BOLT_GOLD.complete && BALLISTA_BOLT_GOLD.naturalWidth) ? BALLISTA_BOLT_GOLD : img;
        const bar = bimg.naturalWidth / bimg.naturalHeight;
        const w = 12, h = w / bar;
        ctx.rotate(this.visAngle + Math.PI / 2);
        ctx.drawImage(bimg, -w / 2, -h / 2, w, h);
      } else if (type === 'magic' || type === 'arcane' || type === 'storm' || type === 'hex') { // lightning bolt, rotated to travel dir
        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 15);
        glow.addColorStop(0, projColor + 'bb');
        glow.addColorStop(1, projColor + '00');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
        // mbolt.png points UP natively (tip at -90deg); align its length with travel
        ctx.rotate(this.angle + Math.PI / 2);
        const h = 30, w = h * ar;
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
      } else { // poison glob: glowing, no rotation
        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 16);
        glow.addColorStop(0, projColor + 'aa');
        glow.addColorStop(1, projColor + '00');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill();
        const w = 24, h = 24 / ar;
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
      }
      ctx.restore();
    } else {
      ctx.fillStyle = projColor;
      ctx.beginPath();
      ctx.arc(this.x, drawY, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// frame-animation effect: plays the kit's explosion frames (stone pack 54-61)
// once at the impact point, scaled to the blast radius.
class FrameFX {
  // proportional=true keeps each frame at its NATIVE size ratio (so a shatter
  // sequence visibly expands as the debris flies out); false fits every frame
  // to the same box (for a boom that's already centred per frame).
  constructor(x, y, radius, frames, fps = 22, proportional = false) {
    this.x = x; this.y = y;
    this.size = radius * 2.2;
    this.frames = frames;
    this.frameDur = 1 / fps;
    this.t = 0;
    this.dead = false;
    this.proportional = proportional;
    this._unit = 0;
  }
  update(dt) {
    this.t += dt;
    if (this.t >= this.frames.length * this.frameDur) this.dead = true;
  }
  draw() {
    const idx = Math.min(this.frames.length - 1, Math.floor(this.t / this.frameDur));
    const img = this.frames[idx];
    if (!img || !img.complete || !img.naturalWidth) return;
    if (this.proportional) {
      if (!this._unit) { // scale so the WIDEST frame spans this.size
        let mx = 0;
        for (const f of this.frames) if (f.naturalWidth) mx = Math.max(mx, f.naturalWidth, f.naturalHeight);
        this._unit = mx ? this.size / mx : 1;
      }
      const w = img.naturalWidth * this._unit, h = img.naturalHeight * this._unit;
      ctx.drawImage(img, this.x - w / 2, this.y - h / 2, w, h);
      return;
    }
    const ar = img.naturalWidth / img.naturalHeight;
    let w = this.size, h = this.size / ar;
    if (h > this.size) { h = this.size; w = this.size * ar; }
    ctx.drawImage(img, this.x - w / 2, this.y - h / 2, w, h);
  }
}

// lightning strike: a jagged bolt crashes down from the sky onto the target,
// re-jittering every few frames so it crackles, with a flash at the impact.
class LightningStrikeFX {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.t = 0;
    this.dur = 0.3;
    this.dead = false;
    this.jitterT = 0;
    this.pts = this.gen();
    this.branch = this.genBranch();
  }
  gen() {
    const H = 250, segs = 7;
    const pts = [[this.x + (Math.random() * 36 - 18), this.y - H]];
    for (let i = 1; i < segs; i++) {
      const yy = this.y - H + (H * i) / segs;
      const spread = 26 * (1 - (i / segs) * 0.65);
      pts.push([this.x + (Math.random() * 2 - 1) * spread, yy]);
    }
    pts.push([this.x, this.y]);
    return pts;
  }
  genBranch() {
    // small fork off a mid segment
    const src = this.pts[3 + Math.floor(Math.random() * 2)];
    const dir = Math.random() < 0.5 ? -1 : 1;
    return [
      [src[0], src[1]],
      [src[0] + dir * (14 + Math.random() * 12), src[1] + 18 + Math.random() * 10],
      [src[0] + dir * (24 + Math.random() * 16), src[1] + 40 + Math.random() * 14],
    ];
  }
  update(dt) {
    this.t += dt;
    this.jitterT += dt;
    if (this.jitterT > 0.05) { // re-roll the bolt shape so it crackles
      this.jitterT = 0;
      this.pts = this.gen();
      this.branch = this.genBranch();
    }
    if (this.t >= this.dur) this.dead = true;
  }
  strokePath(pts, style, width) {
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    ctx.beginPath();
    pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.stroke();
  }
  draw() {
    const a = 1 - this.t / this.dur;
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // outer cyan glow, then hot white core
    this.strokePath(this.pts, `rgba(125,232,255,${0.45 * a})`, 8);
    this.strokePath(this.pts, `rgba(255,255,255,${0.95 * a})`, 2.5);
    this.strokePath(this.branch, `rgba(125,232,255,${0.4 * a})`, 4);
    this.strokePath(this.branch, `rgba(255,255,255,${0.8 * a})`, 1.5);
    // impact flash on the victim
    const fr = 6 + 16 * a;
    const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, fr);
    g.addColorStop(0, `rgba(255,255,255,${0.85 * a})`);
    g.addColorStop(1, 'rgba(125,232,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(this.x, this.y, fr, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

// short-lived impact burst: an expanding fading ring + a few sparks, tinted to
// the projectile colour. Purely procedural so it matches every tower/level.
class ImpactFX {
  constructor(x, y, radius, color) {
    this.x = x; this.y = y;
    this.maxR = radius;
    this.color = color;
    this.t = 0;
    this.dur = 0.32;
    this.dead = false;
    this.sparks = [];
    const n = Math.min(10, Math.round(radius / 6) + 4);
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      const sp = radius * (1.6 + Math.random());
      this.sparks.push({ a, sp, len: 4 + Math.random() * 5 });
    }
  }
  update(dt) {
    this.t += dt;
    if (this.t >= this.dur) this.dead = true;
  }
  draw() {
    const p = this.t / this.dur;      // 0 -> 1
    const ease = 1 - (1 - p) * (1 - p);
    const alpha = 1 - p;
    const hex2 = v => Math.round(v).toString(16).padStart(2, '0');
    // expanding ring
    ctx.save();
    ctx.strokeStyle = this.color + hex2(alpha * 220);
    ctx.lineWidth = 3 * (1 - p) + 0.5;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.maxR * ease, 0, Math.PI * 2);
    ctx.stroke();
    // bright core flash early on
    if (p < 0.5) {
      const cr = this.maxR * 0.5 * ease;
      const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, cr + 1);
      g.addColorStop(0, `rgba(255,255,240,${(0.6 - p) })`);
      g.addColorStop(1, this.color + '00');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(this.x, this.y, cr + 1, 0, Math.PI * 2); ctx.fill();
    }
    // sparks flying out
    ctx.strokeStyle = this.color + hex2(alpha * 255);
    ctx.lineWidth = 2;
    for (const s of this.sparks) {
      const d0 = s.sp * ease;
      const x0 = this.x + Math.cos(s.a) * d0, y0 = this.y + Math.sin(s.a) * d0;
      const x1 = x0 + Math.cos(s.a) * s.len, y1 = y0 + Math.sin(s.a) * s.len;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    }
    ctx.restore();
  }
}

// ---- Wave generation ----
function buildWave(n) {
  const queue = [];
  const isBossWave = n % 5 === 0;
  const baseCount = 6 + n * 2;
  const typePool = n < 3 ? ['e1'] : n < 5 ? ['e1', 'e2'] : n < 8 ? ['e1', 'e2', 'e4'] : ['e1', 'e2', 'e4', 'e7'];
  for (let i = 0; i < baseCount; i++) {
    queue.push(typePool[Math.floor(Math.random() * typePool.length)]);
  }
  if (isBossWave) queue.push('boss');
  return queue;
}

startWaveBtn.addEventListener('click', () => {
  if (!activeLevel || state.waveInProgress || state.gameOver) return;
  state.wave++;
  if (state.wave > state.waveMax) return;
  state.spawnQueue = buildWave(state.wave);
  state.spawnTimer = 0;
  state.waveInProgress = true;
  startWaveBtn.disabled = true;
  updateHud();
});

speedBtn.addEventListener('click', () => {
  state.speed = state.speed === 1 ? 2 : 1;
  speedBtn.textContent = state.speed + 'x';
});

pauseBtn.addEventListener('click', () => {
  state.paused = !state.paused;
});

// ---- Canvas interaction ----
// The canvas element is stretched to fill #playfield (width/height:100%) and
// then letterboxed by CSS `object-fit: contain` to keep its 1280x720 content
// at the right aspect ratio. getBoundingClientRect() returns the STRETCHED
// element box, not the smaller, centered box the content actually draws
// into -- using it directly mis-maps clicks by the letterbox gap, which
// grows (and gets more noticeable near the content's edges) the further the
// window's aspect ratio drifts from 16:9. This computes the real content
// box so clicks/hover line up everywhere, not just when the window happens
// to be exactly 16:9.
function getCanvasContentRect() {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / W, rect.height / H);
  const width = W * scale, height = H * scale;
  const left = rect.left + (rect.width - width) / 2;
  const top = rect.top + (rect.height - height) / 2;
  return { left, top, width, height, scale };
}

function canvasPos(evt) {
  const r = getCanvasContentRect();
  return { x: (evt.clientX - r.left) / r.scale, y: (evt.clientY - r.top) / r.scale };
}

let hoverPos = null;
canvas.addEventListener('mousemove', (e) => { hoverPos = canvasPos(e); });
canvas.addEventListener('mouseleave', () => { hoverPos = null; });

canvas.addEventListener('click', (e) => {
  const p = canvasPos(e);
  if (state.selectedBuyType) {
    tryPlaceTower(state.selectedBuyType, p.x, p.y);
    return;
  }
  const clicked = state.towers.find(t => Math.hypot(t.x - p.x, t.y - p.y) < 34);
  if (clicked) {
    selectTower(clicked, e);
  } else {
    deselectTower();
  }
});

function spotOccupied(i) { return state.towers.some(t => t.spot === i); }

function nearestSpot(x, y) {
  let best = -1, bd = Infinity;
  BUILD_SPOTS.forEach(([sx, sy], i) => {
    const d = Math.hypot(sx - x, sy - y);
    if (d < bd) { bd = d; best = i; }
  });
  return { i: best, d: bd };
}

// Towers can only be built on a free snow pad; the click snaps to it.
function tryPlaceTower(type, x, y) {
  const def = TOWER_DEFS[type];
  const near = nearestSpot(x, y);
  if (near.i < 0 || near.d > SNAP_RADIUS) { showToast('วางได้เฉพาะบนแท่นหิมะเท่านั้น'); return; }
  if (spotOccupied(near.i)) { showToast('จุดนี้มีหอคอยแล้ว'); return; }
  if (state.gold < def.cost) { showToast('เงินไม่พอ!'); return; }
  const [sx, sy] = BUILD_SPOTS[near.i];
  const tower = new Tower(type, sx, sy);
  tower.spot = near.i;
  state.towers.push(tower);
  state.gold -= def.cost;
  // clear the buy selection after placing so the NEXT click on this tower
  // opens its upgrade panel instead of trying to build on the occupied pad
  state.selectedBuyType = null;
  document.querySelectorAll('.tower-buy').forEach(e => e.classList.remove('selected'));
  updateHud();
}

function selectTower(tower, evt) {
  state.selectedTower = tower;
  const r = getCanvasContentRect();
  const fieldRect = document.getElementById('playfield').getBoundingClientRect();
  const localX = (r.left - fieldRect.left) + tower.x * r.scale;
  const localY = (r.top - fieldRect.top) + tower.y * r.scale;
  towerPanel.style.left = Math.min(localX + 30, fieldRect.width - 190) + 'px';
  towerPanel.style.top = Math.max(localY - 60, 10) + 'px';
  renderTowerPanel();
  towerPanel.classList.remove('hidden');
}
function deselectTower() {
  state.selectedTower = null;
  towerPanel.classList.add('hidden');
}
closeTowerPanel.addEventListener('click', deselectTower);

function renderTowerPanel() {
  const t = state.selectedTower;
  if (!t) return;
  const def = t.def;
  const nextCost = t.level < 3 ? def.upgradeCost[t.level] : null;
  towerPanelInfo.innerHTML = `
    <b>${def.label}</b> (Lv.${t.level})<br>
    ดาเมจ: ${t.dmg || '-'} | ระยะ: ${t.range}<br>
    ${t.type === 'support' ? 'ชะลอศัตรู ' + Math.round(def.slow * 100) + '%' : ''}
  `;
  upgradeBtn.textContent = t.level >= 3 ? 'สูงสุดแล้ว' : `⬆ อัพเกรด (${nextCost}g)`;
  upgradeBtn.disabled = t.level >= 3 || state.gold < nextCost;
  sellBtn.textContent = `💰 ขาย (${Math.floor(t.spent * 0.6)}g)`;
}

upgradeBtn.addEventListener('click', () => {
  const t = state.selectedTower;
  if (!t || t.level >= 3) return;
  const cost = t.def.upgradeCost[t.level];
  if (state.gold < cost) return;
  state.gold -= cost;
  t.spent += cost;
  t.level++;
  updateHud();
  renderTowerPanel();
});

sellBtn.addEventListener('click', () => {
  const t = state.selectedTower;
  if (!t) return;
  state.gold += Math.floor(t.spent * 0.6);
  state.towers = state.towers.filter(x => x !== t);
  deselectTower();
  updateHud();
});

// ---- Game over / win ----
function triggerGameOver(won) {
  if (state.gameOver) return;
  state.gameOver = true;
  state.running = false;
  overlayHeader.src = won ? 'assets/gui/header_win.png' : 'assets/gui/header_failed.png';
  overlayTitle.textContent = won ? 'ชนะแล้ว!' : 'พ่ายแพ้!';
  if (won) {
    const stars = starsForLives(state.lives);
    saveStars(activeLevel.id, stars);
    renderLevelList(); // refresh locks/stars so the map is current when reopened
    overlaySub.textContent = `คุณป้องกันฐานสำเร็จครบ ${state.waveMax} เวฟ · ได้ ${stars}/3 ดาว`;
  } else {
    overlaySub.textContent = `คุณเอาชีวิตรอดถึงเวฟที่ ${state.wave}`;
  }
  overlay.classList.remove('hidden');
}
overlayBtn.addEventListener('click', () => {
  overlay.classList.add('hidden');
  activeLevel = null;
  openLevelSelect();
});

// ---- Main loop ----
let lastTime = performance.now();
function loop(now) {
  let dt = (now - lastTime) / 1000;
  lastTime = now;
  dt = Math.min(dt, 0.05);
  if (!state.paused && !state.gameOver) {
    for (let s = 0; s < state.speed; s++) update(dt);
  }
  render();
  requestAnimationFrame(loop);
}

function update(dt) {
  if (!activeLevel) return;
  // spawn
  if (state.waveInProgress && state.spawnQueue.length) {
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      const type = state.spawnQueue.shift();
      const laneIdx = state.spawnLaneCounter % lanes.length;
      state.spawnLaneCounter++;
      state.enemies.push(new Enemy(type, laneIdx));
      state.spawnTimer = 0.55;
    }
  } else if (state.waveInProgress && state.enemies.length === 0) {
    state.waveInProgress = false;
    if (state.wave >= state.waveMax) {
      triggerGameOver(true);
    } else {
      startWaveBtn.disabled = false;
      showToast(`เวฟที่ ${state.wave} ผ่านแล้ว!`);
    }
  }

  for (const e of state.enemies) e.update(dt);
  state.enemies = state.enemies.filter(e => !e.removeMe);

  for (const t of state.towers) t.update(dt);

  for (const p of state.projectiles) p.update(dt);
  state.projectiles = state.projectiles.filter(p => !p.dead);

  for (const fx of state.effects) fx.update(dt);
  state.effects = state.effects.filter(fx => !fx.dead);
}

// ==================================================================
// ---- Map composer: the ACTIVE level draws its whole scene once   ----
// ---- into an offscreen canvas, which is then just blitted.       ----
// ==================================================================
const mapCanvas = document.createElement('canvas');
mapCanvas.width = W; mapCanvas.height = H;
let mapReady = false;
const SNAP_RADIUS = 55; // how close a click must be to a build pad

function render() {
  // Match the backing store to device pixels, then letterbox the 1280x720
  // world onto it (same centered "contain" box the CSS used to produce, so
  // canvasPos()/getCanvasContentRect() stay correct).
  fitCanvas();
  const dw = canvas.width, dh = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, dw, dh);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, dw, dh);
  const vs = Math.min(dw / W, dh / H);
  const ox = Math.round((dw - W * vs) / 2), oy = Math.round((dh - H * vs) / 2);
  ctx.setTransform(vs, 0, 0, vs, ox, oy);

  ctx.clearRect(0, 0, W, H);
  if (!activeLevel) return;
  if (!mapReady && activeLevel.allArtLoaded()) {
    activeLevel.composeMap(mapCanvas.getContext('2d'));
    mapReady = true;
  }
  if (mapReady) {
    ctx.drawImage(mapCanvas, 0, 0);
  } else {
    ctx.fillStyle = '#e3e9ee';
    ctx.fillRect(0, 0, W, H);
  }

  // pad-based placement preview: pads glow while buying; the hovered pad
  // shows the tower's range circle (green = free, red = occupied)
  if (state.selectedBuyType) {
    const pulse = 0.35 + 0.2 * Math.sin(performance.now() / 250);
    const near = hoverPos ? nearestSpot(hoverPos.x, hoverPos.y) : null;
    BUILD_SPOTS.forEach(([sx, sy], i) => {
      const occupied = spotOccupied(i);
      const hovered = near && near.i === i && near.d <= SNAP_RADIUS;
      if (hovered) {
        ctx.beginPath();
        ctx.arc(sx, sy, TOWER_DEFS[state.selectedBuyType].range, 0, Math.PI * 2);
        ctx.fillStyle = occupied ? 'rgba(255,80,80,0.12)' : 'rgba(120,255,120,0.12)';
        ctx.fill();
        ctx.strokeStyle = occupied ? 'rgba(255,80,80,0.7)' : 'rgba(120,255,120,0.7)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      if (!occupied) {
        ctx.beginPath();
        ctx.arc(sx, sy, 34, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,216,118,${hovered ? 0.9 : pulse})`;
        ctx.lineWidth = hovered ? 3 : 2;
        ctx.stroke();
      }
    });
  }

  // sort by y for pseudo depth
  const drawables = [...state.towers, ...state.enemies];
  drawables.sort((a, b) => (a.y || a.pos.y) - (b.y || b.pos.y));
  for (const d of drawables) {
    if (d instanceof Tower) d.draw(hoverPos && Math.hypot(d.x - hoverPos.x, d.y - hoverPos.y) < 34);
    else d.draw();
  }
  for (const p of state.projectiles) p.draw();
  for (const fx of state.effects) fx.draw();
}

// ==================================================================
// ---- Level select: pick one of the maps.LEVELS entries, reset    ----
// ---- game state against it, and start the run.                  ----
// ==================================================================
const levelSelect = document.getElementById('levelSelect');
const levelList = document.getElementById('levelList');
const changeMapBtn = document.getElementById('changeMapBtn');

// ---- Level progress: stars + locks, persisted across visits ----
// World-map model (craftpix "level map" style): level 1 sits at the BOTTOM
// of a tall scrolling map, the path snakes upward to the final level. Each
// node is locked until the previous level is beaten; wins award 1-3 stars
// by how many lives survived (star art: assets/gui/star_1..4.png = 0..3).
const PROGRESS_KEY = 'tod.progress';
function loadProgress() {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {}; }
  catch { return {}; }
}
function saveStars(id, stars) {
  const p = loadProgress();
  if ((p[id] || 0) < stars) {
    p[id] = stars;
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch {}
  }
}
function starsForLives(lives) { return lives >= 16 ? 3 : lives >= 8 ? 2 : 1; }

// The world-map background art (assets/worldmap/LevelAreaFull.png, 1481x2962)
// has a dashed trail drawn on it, snaking bottom-left -> top-right. These are
// its corner waypoints in % of the image (x of width, y of height), traced
// from the art. Level nodes are spread evenly (by on-image arc length) along
// this polyline so they sit on the painted trail at any display size.
const WM_IMG_W = 1481, WM_IMG_H = 2962;
const WM_TRAIL = [
  [22.0, 88.5], [83.5, 88.5], [84.5, 74.5], [19.5, 70.8], [18.0, 55.5],
  [77.0, 53.0], [86.5, 51.0], [86.5, 38.5], [24.0, 37.0], [16.0, 35.0],
  [16.0, 25.5], [45.0, 24.3], [84.0, 21.6],
];

// When there are more levels than one map's trail can hold comfortably, the
// baked extended maps (LevelAreaFull_x2/_x3) are used. Those are composed
// from the original art: the full map on top, plus 1-2 "middle slab" crops
// (original y=570..2962, alternately mirrored) stacked below, with dashed
// connectors drawn between each slab's trail end and the next one's start.
// The constants here MUST match the bake script's crop/stack layout.
const WM_CROP_TOP = 570;                       // middle slab = orig y 570..2962
const WM_SLAB_H = WM_IMG_H - WM_CROP_TOP;      // 2392
function wmVariant(n) {
  // preview override: open index.html?worldmap=2 (or =3) to see the
  // extended maps before the game actually has that many levels
  const forced = new URLSearchParams(location.search).get('worldmap');
  if (forced === '2') n = Math.max(n, 23);
  else if (forced === '3') n = Math.max(n, 45);
  // ~22 nodes per trail keeps neighbours a comfortable tap apart
  if (n <= 22) return {
    img: 'assets/worldmap/LevelAreaFull.png',
    height: WM_IMG_H,
    secs: [{ slab: false, flip: false, oy: 0 }],
  };
  if (n <= 44) return {
    img: 'assets/worldmap/LevelAreaFull_x2.png',
    height: WM_IMG_H + WM_SLAB_H,
    secs: [ // journey order: bottom section first
      { slab: true, flip: true, oy: WM_IMG_H },
      { slab: false, flip: false, oy: 0 },
    ],
  };
  return {
    img: 'assets/worldmap/LevelAreaFull_x3.png',
    height: WM_IMG_H + WM_SLAB_H * 2,
    secs: [
      { slab: true, flip: false, oy: WM_IMG_H + WM_SLAB_H },
      { slab: true, flip: true, oy: WM_IMG_H },
      { slab: false, flip: false, oy: 0 },
    ],
  };
}

function trailPositions(n, variant) {
  const pts = [];
  for (const { slab, flip, oy } of variant.secs) {
    for (const [xp, yp] of WM_TRAIL) {
      let x = xp * WM_IMG_W / 100, y = yp * WM_IMG_H / 100;
      if (slab) y -= WM_CROP_TOP;
      if (flip) x = WM_IMG_W - x;
      pts.push([x, y + oy]);
    }
  }
  const segs = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const L = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    segs.push(L); total += L;
  }
  const out = [];
  for (let k = 0; k < n; k++) {
    let d = n === 1 ? 0 : total * k / (n - 1);
    let i = 0;
    while (i < segs.length - 1 && d > segs[i]) { d -= segs[i]; i++; }
    const t = segs[i] ? d / segs[i] : 0;
    const x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t;
    const y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t;
    out.push({ x: x / WM_IMG_W * 100, y: y / variant.height * 100 });
  }
  return out;
}

function renderLevelList() {
  const levels = window.LEVELS || [];
  const progress = loadProgress();
  levelList.innerHTML = '<span class="wm-title">WORLD MAP</span>';

  // pick the map long enough for this many levels and lay nodes on its trail
  const variant = wmVariant(levels.length);
  levelList.style.backgroundImage = `url('${variant.img}')`;
  levelList.style.aspectRatio = `${WM_IMG_W} / ${variant.height}`;
  // the banner is painted on the top (original) section; keep the title on it
  levelList.querySelector('.wm-title').style.top =
    (5.2 * WM_IMG_H / variant.height) + '%';

  const pos = trailPositions(levels.length, variant);
  let activeNode = null;
  levels.forEach((level, i) => {
    const stars = progress[level.id] || 0;
    const unlocked = i === 0 || (progress[levels[i - 1].id] || 0) > 0;
    const state = !unlocked ? 'locked' : stars > 0 ? 'done s' + stars : 'active';
    const node = document.createElement('button');
    node.className = 'wm-node ' + state;
    node.style.left = pos[i].x + '%';
    node.style.top = pos[i].y + '%';
    node.title = level.desc + (stars ? ` · ${stars}/3 ดาว` : '');
    node.innerHTML =
      (unlocked ? `<span class="wm-num">${i + 1}</span>` : '') +
      `<span class="wm-name">${level.name}</span>`;
    if (unlocked) node.addEventListener('click', () => selectLevel(level));
    else node.disabled = true;
    if (!activeNode && unlocked && stars === 0) activeNode = node;
    levelList.appendChild(node);
  });
  // remember where the player "is" so opening the map scrolls there
  levelList._focusNode = activeNode || levelList.querySelector('.wm-node.done');
}

function openLevelSelect() {
  levelSelect.classList.remove('hidden');
  const n = levelList._focusNode;
  if (n) n.scrollIntoView({ block: 'center' });
}

function selectLevel(level) {
  activeLevel = level;
  lanes = level.LANES.map(buildLaneRuntime);
  BUILD_SPOTS = level.BUILD_SPOTS;
  mapReady = false;

  state.gold = 180;
  state.lives = 20;
  state.wave = 0;
  state.speed = 1;
  state.paused = false;
  state.enemies = [];
  state.towers = [];
  state.projectiles = [];
  state.effects = [];
  state.selectedBuyType = null;
  state.selectedTower = null;
  state.waveInProgress = false;
  state.spawnQueue = [];
  state.spawnTimer = 0;
  state.spawnLaneCounter = 0;
  state.gameOver = false;
  speedBtn.textContent = '1x';
  startWaveBtn.disabled = false;
  document.querySelectorAll('.tower-buy').forEach(e => e.classList.remove('selected'));
  deselectTower();
  overlay.classList.add('hidden');
  updateHud();

  levelSelect.classList.add('hidden');
}

changeMapBtn.addEventListener('click', () => {
  activeLevel = null;
  openLevelSelect();
});

renderLevelList();
openLevelSelect();
updateHud();
requestAnimationFrame(loop);
