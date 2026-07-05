// ===================== Map 3 — from the user's red-line draft =====================
// Traced from the hand-drawn draft (1134x611, scaled to 1280x720):
//   - lane 1: enters LEFT top     -> merges at a Y (road_8) with...
//   - lane 2: enters RIGHT top    -> ...same Y, merged flow drops down
//   - spine meets the middle road at a T (road_8 flipped vertically)
//   - lane 3: enters LEFT middle  -> joins at the T, all flow right
//   - corner (road_2) turns down  -> EXIT at the BOTTOM edge ("ทางออก")
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

// ---- anchors traced from the draft ----
const TOP_Y   = 150;   // both top lanes' midline
const SPINE_X = 553;   // Y-merge bottom exit / T-junction top arm
const MID_Y   = 406;   // middle road midline (lane 3)
const TURN_X  = 993;   // right corner where road turns down
// Y merge piece (arms at TOP_Y, bottom exit at SPINE_X)
const Y8 = { x: SPINE_X - M_BDX, y: TOP_Y - M_SDY };
// T junction = road_8 flipped vertically (arms LEFT/RIGHT at MID_Y, top arm at SPINE_X)
const T8 = { x: SPINE_X - M_BDX, y: MID_Y - (M_H - M_SDY) };
const EXIT_TURN = cornerAt([1,0], [0,1], [TURN_X, MID_Y]);  // right -> down (BL)

// Tower build pads (dot.png) -- towers may ONLY be placed here. Verified
// clear of every road/junction band (16px keepout) by a numeric bbox check.
const BUILD_SPOTS = [
  [220,260], [900,260], [220,520], [580,520],
  [1140,460], [640,680], [100,680], [1240,600],
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
  straightH(m, -40, Y8.x + 5, TOP_Y);                    // lane 1: left -> Y
  straightH(m, Y8.x + M_W - 5, 1320, TOP_Y);             // lane 2: Y -> right edge
  straightV(m, Y8.y + M_H - 3, T8.y + 5, SPINE_X);       // spine: Y down to T
  straightH(m, -40, T8.x + 5, MID_Y);                    // lane 3: left -> T
  straightH(m, T8.x + M_W - 5, TURN_X - R + 3, MID_Y);   // T -> corner
  straightV(m, MID_Y + R - 3, 720, TURN_X);              // corner -> bottom exit

  // --- junctions & corner on top ---
  m.drawImage(ART.merge, Y8.x, Y8.y, M_W, M_H);          // Y merge (arms L/R, exit down)
  m.save();                                              // T junction = road_8 flipped V
  m.translate(T8.x, T8.y + M_H); m.scale(1, -1);
  m.drawImage(ART.merge, 0, 0, M_W, M_H);
  m.restore();
  m.drawImage(EXIT_TURN.im, EXIT_TURN.x, EXIT_TURN.y, K, K);

  // --- decor -- every position verified clear of the road/junction bands
  // by a numeric bounding-box check (not by eye); nothing sits on a lane ---
  const trees = [[140,320],[308,303],[414,335],[828,303],[700,85],[240,560],[420,640],[120,600],[1158,303],[1220,560]];
  for (const [x,y] of trees) sprite(m, ART.tree, x, y, 0.55);
  const stones = [[696,253],[913,251],[196,508],[700,560],[1116,480]];
  for (const [x,y] of stones) sprite(m, ART.stone, x, y, 0.7);
  sprite(m, ART.ruinR, 884, 85, 0.5);
  sprite(m, ART.ruinS, 130, 700, 0.5);
  sprite(m, ART.cabin, 1129, 700, 0.62);                 // village at the exit

  // build pads: towers may ONLY be placed on these dots
  for (const [x, y] of BUILD_SPOTS) {
    const w = ART.dot.naturalWidth * 0.8, h = ART.dot.naturalHeight * 0.8;
    m.drawImage(ART.dot, x - w/2, y - h/2, w, h);
  }
  ready = true;
}

// ---- enemy walk paths (3 lanes) ----
function turnArc(pts, P, inD, outD, r, steps=8){
  const C = [P[0] + r * (outD[0] - inD[0]), P[1] + r * (outD[1] - inD[1])];
  const A = [P[0] - r * inD[0], P[1] - r * inD[1]];
  const B = [P[0] + r * outD[0], P[1] + r * outD[1]];
  const a0 = Math.atan2(A[1]-C[1], A[0]-C[0]), a1 = Math.atan2(B[1]-C[1], B[0]-C[0]);
  let d = a1 - a0; while (d > Math.PI) d -= 2*Math.PI; while (d < -Math.PI) d += 2*Math.PI;
  for (let k=1;k<=steps;k++){ const a=a0+d*(k/steps); pts.push([C[0]+r*Math.cos(a), C[1]+r*Math.sin(a)]); }
}
function buildPaths(){
  const rY = 38; // small bend radius inside the Y / T junction art
  // shared downstream: spine -> T (turn right) -> corner -> bottom exit
  function downstreamFromSpine(pts){
    pts.push([SPINE_X, MID_Y - rY - 1]);
    turnArc(pts, [SPINE_X, MID_Y], [0,1], [1,0], rY);
    pts.push([TURN_X - R, MID_Y]);
    turnArc(pts, [TURN_X, MID_Y], [1,0], [0,1], R);
    pts.push([TURN_X, 760]);
  }
  const P1 = [[-40, TOP_Y], [SPINE_X - rY, TOP_Y]];
  turnArc(P1, [SPINE_X, TOP_Y], [1,0], [0,1], rY);
  downstreamFromSpine(P1);
  const P2 = [[1320, TOP_Y], [SPINE_X + rY, TOP_Y]];
  turnArc(P2, [SPINE_X, TOP_Y], [-1,0], [0,1], rY);
  downstreamFromSpine(P2);
  const P3 = [[-40, MID_Y], [TURN_X - R, MID_Y]];
  turnArc(P3, [TURN_X, MID_Y], [1,0], [0,1], R);
  P3.push([TURN_X, 760]);
  return [P1, P2, P3];
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

// ---- monsters on all 3 lanes ----
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
  monsters.push({ lane: spawnI % 3, type: ['e1','e2','e4'][spawnI % 3], d: 0, frame: 0, ft: 0, facing: 1 });
  spawnI++;
}

let last = performance.now();
function loop(now){
  const dt = Math.min((now-last)/1000, 0.05); last = now;
  if (!ready && loaded()) compose();
  spawnT -= dt; if (spawnT <= 0){ spawn(); spawnT = 0.9; }
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
