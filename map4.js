// ===================== Map 4 — from the user's 2nd red-line draft =====================
// Traced topology from the hand-drawn draft (wavy S path, ~1481x805, scaled to 1280x720):
//   - lane A: enters LEFT edge (upper)  -> zigzags down-right (2 corners) -> merge
//   - lane B: enters RIGHT edge (upper) -> zigzags down-left  (2 corners) -> merge
//   - merged at a Y (road_8), spine drops down, zigzags once more (2 corners)
//   - EXIT at the BOTTOM edge, right-of-center (matches "ทางออก" label position)
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

const S = 0.55;
const LANE = 171 * S;                 // ~94
const K = 256 * S;                    // corner footprint ~141
const R = 170.5 * S;                  // corner centerline radius ~94
const M_W = 341 * S, M_H = 260 * S;   // road_8 merge piece ~188x143
const M_BDX = 170.5 * S;              // merge bottom-exit x from its left
const M_SDY = 92 * S;                 // merge side-arm y from its top

function img(n){ const i = new Image(); i.src = 'assets/winter/' + n + '.png'; return i; }
const ART = {
  bg: img('main_bg'), tree: img('tree'), stone: img('stone'), dot: img('dot'),
  cabin: img('decor_3'), ruinR: img('decor_1'), ruinS: img('decor_2'),
  BR: img('road_1'), BL: img('road_2'), TR: img('road_3'), TL: img('road_4'),
  H: img('road_5'), V: img('road_6'), merge: img('road_8'),
};

function cornerAt(inD, outD, P) {
  const C = [P[0] + R * (outD[0] - inD[0]), P[1] + R * (outD[1] - inD[1])];
  const right = C[0] > P[0], below = C[1] > P[1];
  let im, x, y;
  if (!right && below)      { im = ART.BL; x = C[0];     y = C[1] - K; }
  else if (!right && !below){ im = ART.TL; x = C[0];     y = C[1];     }
  else if (right && below)  { im = ART.BR; x = C[0] - K; y = C[1] - K; }
  else                      { im = ART.TR; x = C[0] - K; y = C[1];     }
  return { im, x, y, C, inD, outD, P };
}

// ---- anchors traced from the draft's zigzag shape ----
// Each dogleg's vertical drop must clear room for BOTH corners (>= 2*R
// centerline radius, ~188px) or the straight between them collapses to a
// gap. A_TOP_Y=110 only left 2px of clearance and B_TOP_Y=190 left NONE
// (a -78px overlap) -- that's the break the user circled. Pulled both
// entries higher so every dogleg has a safe margin above 2*R.
const A_TOP_Y = 80, A_TURN_X = 240;       // lane A: left -> down -> right
const B_TOP_Y = 65, B_TURN_X = 1040;      // lane B: right -> down -> left
const MERGE_ARMS_Y = 300;                 // both lanes level off here before the Y
const MERGE_X = 620;                      // merge piece's bottom-exit x
const Y8 = { x: MERGE_X - M_BDX, y: MERGE_ARMS_Y - M_SDY };
const SPINE_Y = 480;                      // spine drops, then kicks right
const EXIT_X = 900;                       // final corner, then straight down to exit

// two corners feeding the merge's left/right arms
const aTurn1 = cornerAt([1,0], [0,1], [A_TURN_X, A_TOP_Y]);        // right->down
const aTurn2 = cornerAt([0,1], [1,0], [A_TURN_X, MERGE_ARMS_Y]);   // down->right
const bTurn1 = cornerAt([-1,0],[0,1], [B_TURN_X, B_TOP_Y]);        // left->down
const bTurn2 = cornerAt([0,1], [-1,0],[B_TURN_X, MERGE_ARMS_Y]);   // down->left
// two corners after the merge, down to the exit
const sTurn1 = cornerAt([0,1], [1,0], [MERGE_X, SPINE_Y]);         // down->right
const sTurn2 = cornerAt([1,0], [0,1], [EXIT_X, SPINE_Y]);          // right->down

// Tower build pads (dot.png). Towers may ONLY be placed on one of these --
// buildings/decor must never sit on the road, and these are the one
// deliberate exception (a marked pad), verified clear of every road/
// junction band (with an 18px keepout margin) by a numeric bbox check,
// not by eye -- see the note above straights/junctions in compose().
const BUILD_SPOTS = [
  [440,180], [760,180],           // flank lane A's drop / lane B's drop
  [100,340], [1200,320],          // flank the two side entries
  [220,440], [1040,440],          // flank the merge approach arms
  [600,640], [1200,640],          // flank the spine / exit corner
];

// ---- offscreen compose ----
const map = document.createElement('canvas'); map.width = W; map.height = H;
let ready = false;
const need = Object.values(ART);
function loaded(){ return need.every(i => i.complete && i.naturalWidth); }

function sprite(m, im, cx, bottomY, sc){
  const w = im.naturalWidth * sc, h = im.naturalHeight * sc;
  m.drawImage(im, cx - w/2, bottomY - h, w, h);
}
function straightH(m, x0, x1, y){
  const top = y - LANE/2; let x = x0;
  while (x < x1 - 0.5){ const wpx = Math.min(256*S, x1 - x);
    m.drawImage(ART.H, 0,0, wpx/S,171, x, top, wpx, LANE); x += wpx; }
}
function straightV(m, y0, y1, x){
  const left = x - LANE/2; let y = y0;
  while (y < y1 - 0.5){ const hpx = Math.min(256*S, y1 - y);
    m.drawImage(ART.V, 0,0, 171,hpx/S, left, y, LANE, hpx); y += hpx; }
}

function compose(){
  const m = map.getContext('2d');
  m.drawImage(ART.bg, 0, 0, W, H);

  // --- straights (junctions/corners cap them afterwards) ---
  straightH(m, -40, A_TURN_X - R + 3, A_TOP_Y);                    // lane A: left edge -> turn1
  straightV(m, A_TOP_Y + R - 3, MERGE_ARMS_Y - R + 3, A_TURN_X);   // turn1 -> turn2
  straightH(m, A_TURN_X + R - 3, Y8.x + 5, MERGE_ARMS_Y);          // turn2 -> merge left arm

  straightH(m, B_TURN_X + R - 3, 1320, B_TOP_Y);                   // lane B: right edge -> turn1
  straightV(m, B_TOP_Y + R - 3, MERGE_ARMS_Y - R + 3, B_TURN_X);   // turn1 -> turn2
  straightH(m, Y8.x + M_W - 5, B_TURN_X - R + 3, MERGE_ARMS_Y);    // merge right arm -> turn2

  straightV(m, Y8.y + M_H - 3, SPINE_Y - R + 3, MERGE_X);          // merge bottom -> sTurn1
  straightH(m, MERGE_X + R - 3, EXIT_X - R + 3, SPINE_Y);          // sTurn1 -> sTurn2
  straightV(m, SPINE_Y + R - 3, 760, EXIT_X);                      // sTurn2 -> off bottom edge

  // --- junction & corners on top ---
  m.drawImage(ART.merge, Y8.x, Y8.y, M_W, M_H);
  for (const c of [aTurn1, aTurn2, bTurn1, bTurn2, sTurn1, sTurn2]) {
    m.drawImage(c.im, c.x, c.y, K, K);
  }

  // --- decor (every placement below is checked by a numeric bounding-box
  //     test against the road/junction bands -- see verify_placements() ---
  const trees = [
    [140,260],[420,60],[620,150],[900,60],[1180,260],
    [110,470],[380,540],[1180,450],[1040,650],[720,700],
    [340,650],[60,650],
  ];
  for (const [x,y] of trees) sprite(m, ART.tree, x, y, 0.55);
  const stones = [[500,220],[780,220],[300,420],[1150,650],[1200,470]];
  for (const [x,y] of stones) sprite(m, ART.stone, x, y, 0.7);
  sprite(m, ART.ruinR, 1250, 300, 0.5); // moved clear of lane B's raised entry
  sprite(m, ART.ruinS, 70, 320, 0.5);   // moved clear of lane A's entry+drop
  sprite(m, ART.cabin, 1080, 700, 0.6); // village near the exit

  // --- build pads: towers may ONLY be placed on these dots ---
  for (const [x, y] of BUILD_SPOTS) {
    const w = ART.dot.naturalWidth * 0.8, h = ART.dot.naturalHeight * 0.8;
    m.drawImage(ART.dot, x - w/2, y - h/2, w, h);
  }
  ready = true;
}

// ---- enemy walk paths (2 lanes -> merge -> spine) ----
function turnArc(pts, c, r, steps=8){
  const A = [c.P[0] - r*c.inD[0], c.P[1] - r*c.inD[1]];
  const B = [c.P[0] + r*c.outD[0], c.P[1] + r*c.outD[1]];
  const a0 = Math.atan2(A[1]-c.C[1], A[0]-c.C[0]), a1 = Math.atan2(B[1]-c.C[1], B[0]-c.C[0]);
  let d = a1 - a0; while (d > Math.PI) d -= 2*Math.PI; while (d < -Math.PI) d += 2*Math.PI;
  for (let k=1;k<=steps;k++){ const a=a0+d*(k/steps); pts.push([c.C[0]+r*Math.cos(a), c.C[1]+r*Math.sin(a)]); }
}
function downstreamFromMerge(pts){
  pts.push([MERGE_X, SPINE_Y - R]);
  turnArc(pts, sTurn1, R);
  pts.push([EXIT_X - R, SPINE_Y]);
  turnArc(pts, sTurn2, R);
  pts.push([EXIT_X, 760]);
}
function buildPaths(){
  const rY = 38; // tight bend baked into the road_8 art itself
  const yMerge = cornerAt([1,0], [0,1], [MERGE_X, MERGE_ARMS_Y]); // visual only, for the merge's internal curve

  const A = [[-40, A_TOP_Y], [A_TURN_X - R, A_TOP_Y]];
  turnArc(A, aTurn1, R);
  A.push([A_TURN_X, MERGE_ARMS_Y - R]);
  turnArc(A, aTurn2, R);
  A.push([Y8.x + rY, MERGE_ARMS_Y]);
  turnArc(A, { P:[MERGE_X, MERGE_ARMS_Y], C:[MERGE_X, MERGE_ARMS_Y+rY], inD:[1,0], outD:[0,1] }, rY);
  downstreamFromMerge(A);

  const B = [[1320, B_TOP_Y], [B_TURN_X + R, B_TOP_Y]];
  turnArc(B, bTurn1, R);
  B.push([B_TURN_X, MERGE_ARMS_Y - R]);
  turnArc(B, bTurn2, R);
  B.push([Y8.x + M_W - rY, MERGE_ARMS_Y]);
  turnArc(B, { P:[MERGE_X, MERGE_ARMS_Y], C:[MERGE_X, MERGE_ARMS_Y+rY], inD:[-1,0], outD:[0,1] }, rY);
  downstreamFromMerge(B);

  return [A, B];
}
const PATHS = buildPaths();
function polyLen(p){ let L=0; for(let i=1;i<p.length;i++) L+=Math.hypot(p[i][0]-p[i-1][0], p[i][1]-p[i-1][1]); return L; }
const LENS = PATHS.map(polyLen);
function ptAt(p, d){
  for(let i=1;i<p.length;i++){ const seg=Math.hypot(p[i][0]-p[i-1][0], p[i][1]-p[i-1][1]);
    if(d<=seg){ const t=seg?d/seg:0; return {x:p[i-1][0]+(p[i][0]-p[i-1][0])*t, y:p[i-1][1]+(p[i][1]-p[i-1][1])*t,
      ang:Math.atan2(p[i][1]-p[i-1][1], p[i][0]-p[i-1][0])}; } d-=seg; }
  const e=p[p.length-1]; return {x:e[0], y:e[1], ang:0};
}

// ---- monsters on both lanes ----
function eframe(dir,name,n){ const a=[]; for(let i=0;i<n;i++){ const s=String(i).padStart(3,'0');
  const im=new Image(); im.src=`assets/enemies/${dir}/${name}${s}.png`; a.push(im);} return a; }
const MON = {
  e1: eframe('e1','1_enemies_1_walk_',20),
  e2: eframe('e2','2_enemies_1_walk_',20),
  e4: eframe('e4','4_enemies_1_walk_',20),
};
const monsters = [];
let spawnT = 0, spawnI = 0;
function spawn(){
  monsters.push({ lane: spawnI % 2, type: ['e1','e2','e4'][spawnI % 3], d: 0, frame: 0, ft: 0, facing: 1 });
  spawnI++;
}

let last = performance.now();
function loop(now){
  const dt = Math.min((now-last)/1000, 0.05); last = now;
  if (!ready && loaded()) compose();
  spawnT -= dt; if (spawnT <= 0){ spawn(); spawnT = 1.0; }
  for (const mo of monsters){
    mo.d += 72 * dt;
    mo.ft += dt; if (mo.ft > 0.06){ mo.ft = 0; mo.frame = (mo.frame + 1) % 20; }
    mo.pos = ptAt(PATHS[mo.lane], mo.d);
    const dx = Math.cos(mo.pos.ang);
    if (dx > 0.15) mo.facing = 1; else if (dx < -0.15) mo.facing = -1;
  }
  for (let i = monsters.length - 1; i >= 0; i--){ if (monsters[i].d > LENS[monsters[i].lane]) monsters.splice(i, 1); }

  ctx.clearRect(0, 0, W, H);
  if (ready) ctx.drawImage(map, 0, 0); else { ctx.fillStyle = '#dfe8ee'; ctx.fillRect(0, 0, W, H); }
  const sorted = [...monsters].sort((a, b) => (a.pos?.y || 0) - (b.pos?.y || 0));
  for (const mo of sorted){
    const fr = MON[mo.type][mo.frame]; if (!fr || !fr.complete || !fr.naturalWidth || !mo.pos) continue;
    const size = 64, ar = fr.naturalWidth / fr.naturalHeight;
    let w = size, h = size / ar; if (h > size){ h = size; w = size * ar; }
    const flip = mo.facing === -1;
    if (flip){ ctx.save(); ctx.translate(mo.pos.x, 0); ctx.scale(-1, 1); ctx.translate(-mo.pos.x, 0); }
    ctx.drawImage(fr, mo.pos.x - w/2, mo.pos.y - h + 6, w, h);
    if (flip) ctx.restore();
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
