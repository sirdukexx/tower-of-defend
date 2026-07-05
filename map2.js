// ===================== Map 2 — Twin Pass =====================
// Two monster lanes MERGE (road_8) then cross a 4-way (road_9) on the way to
// the base. Built with the map-from-layers method: every piece placed by
// measured geometry so joints are seamless. Junction arm openings were
// measured with the skill's inspector (each 170px wide == the 171px lane).
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

const S = 0.55;
const LANE = 171 * S;           // normal lane width (~94)
const K = 256 * S;              // corner footprint (~141)
const R = 170.5 * S;            // corner / junction centerline radius (~94)
const C9 = 341 * S;             // cross footprint (~188)
const HALF = 170.5 * S;         // junction center -> edge (~94)
const M_W = 341 * S, M_H = 260 * S;   // merge piece
const M_BDX = 170.5 * S;        // merge bottom-exit x from its left
const M_SDY = 92 * S;           // merge side-arm y from its top
const W7 = 596 * S, H7 = 255 * S;     // wide trailhead
const W7_NECK_DY = 86 * S;      // wide right-neck center y from its top
const W10 = 491 * S, H10 = 513 * S;   // big branch/curve
const T10_RX = 491, T10_RY = 426, T10_BX = 86; // road_10 openings (source px)

function img(n){ const i = new Image(); i.src = 'assets/winter/' + n + '.png'; return i; }
const ART = {
  bg: img('main_bg'), mountains: img('mountains'), tree: img('tree'),
  stone: img('stone'), dot: img('dot'),
  cabin: img('decor_3'), ruinR: img('decor_1'), ruinS: img('decor_2'),
  BR: img('road_1'), BL: img('road_2'), TR: img('road_3'), TL: img('road_4'),
  H: img('road_5'), V: img('road_6'), wide: img('road_7'),
  merge: img('road_8'), cross: img('road_9'), branch: img('road_10'),
};

// corner piece + draw position from a turn (in/out unit dirs, turn point P)
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

// ---- anchors ----
const MERGE = { x: 640 - M_BDX, y: 285 };
const MERGE_BOTTOM = { x: 640, y: MERGE.y + M_H };
const LANE_Y = MERGE.y + M_SDY;
const MERGE_LX = MERGE.x, MERGE_RX = MERGE.x + M_W;
const CROSS = { cx: 640, cy: 560 };
const CT = CROSS.cy - HALF, CB = CROSS.cy + HALF, CL = CROSS.cx - HALF, CR = CROSS.cx + HALF;
const WIDE = { x: -50, y: LANE_Y - W7_NECK_DY };
const WIDE_NECK_X = WIDE.x + W7;
const B_X = 1010;

// Tower build pads (dot.png) -- towers may ONLY be placed here. Verified
// clear of every road/junction band (18px keepout) by a numeric bbox check.
const BUILD_SPOTS = [
  [420,40], [780,40], [180,140], [1220,180],
  [480,200], [1140,340], [140,620], [800,680],
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
function drawCorner(m, c){ m.drawImage(c.im, c.x, c.y, K, K); }

function compose(){
  const m = map.getContext('2d');
  m.drawImage(ART.bg, 0, 0, W, H);

  // ---------- corners we need (compute first, draw last) ----------
  const bCorner = cornerAt([0,1], [-1,0], [B_X, LANE_Y]);          // lane B: down->left (TL)
  const lDecor  = cornerAt([0,1], [1,0],  [300, CROSS.cy]);        // left decor: down->right (TR)
  const rDecor  = cornerAt([1,0], [0,1],  [980, CROSS.cy]);        // right decor: right->down (BL)

  // ---------- STRAIGHTS (drawn first) ----------
  // lane A: wide trailhead spawn -> straight -> merge left arm
  m.drawImage(ART.wide, WIDE.x, WIDE.y, W7, H7);
  straightH(m, WIDE_NECK_X - 3, MERGE_LX + 5, LANE_Y);
  // lane B: down -> corner -> straight -> merge right arm
  straightV(m, -40, bCorner.P[1] - R, B_X);
  straightH(m, MERGE_RX - 5, B_X - R, LANE_Y);
  // merged tail: merge -> short V -> cross -> V -> base
  straightV(m, MERGE_BOTTOM.y - 3, CT + 5, 640);
  straightV(m, CB - 5, 720, 640);
  // left decorative: top -> down -> corner -> right -> cross left arm
  straightV(m, -40, lDecor.P[1] - R, 300);
  straightH(m, lDecor.P[0] + R - 3, CL + 5, CROSS.cy);
  // right decorative: cross right arm -> right -> corner -> down -> off bottom
  straightH(m, CR - 5, rDecor.P[0] - R + 3, CROSS.cy);
  straightV(m, rDecor.P[1] + R - 3, 720, 980);

  // bottom-right sweep: two road ends to the map edges, a forked remnant.
  // road_1 (BR): comes UP from the bottom edge, curves out the RIGHT edge.
  const c1 = cornerAt([0,-1], [1,0], [1175, 505]);   // up -> right (BR)
  straightV(m, c1.P[1] + R - 3, 720, 1175);
  straightH(m, c1.P[0] + R - 3, 1300, 505);
  // road_10 (big branch): its RIGHT opening meets the right edge, its BOTTOM
  // opening meets the bottom edge -- a grand sweeping curve in the corner.
  const X10 = 1290 - W10, Y10 = 720 - H10;
  m.drawImage(ART.branch, X10, Y10, W10, H10);

  // ---------- JUNCTIONS + CORNERS on top (caps the straight ends) ----------
  drawCorner(m, bCorner); drawCorner(m, lDecor); drawCorner(m, rDecor); drawCorner(m, c1);
  m.drawImage(ART.merge, MERGE.x, MERGE.y, M_W, M_H);
  m.drawImage(ART.cross, CL, CT, C9, C9);

  // ---------- decor + base ----------
  m.drawImage(ART.mountains, W - 778*0.34 + 40, -60, 778*0.34, 657*0.34);
  // every position below verified clear of the road/junction bands by a
  // numeric bounding-box check (not by eye) -- decor must never sit on the road
  const trees = [[150,120],[470,150],[840,140],[1161,417],[139,523],[489,495],[854,495],[180,690]];
  for (const [x,y] of trees) sprite(m, ART.tree, x, y, 0.55);
  const stones = [[201,471],[784,470],[884,272],[414,272]];
  for (const [x,y] of stones) sprite(m, ART.stone, x, y, 0.7);

  // build pads: towers may ONLY be placed on these dots
  for (const [x, y] of BUILD_SPOTS) {
    const w = ART.dot.naturalWidth * 0.8, h = ART.dot.naturalHeight * 0.8;
    m.drawImage(ART.dot, x - w/2, y - h/2, w, h);
  }
  sprite(m, ART.ruinR, 1180, 300, 0.5);
  sprite(m, ART.cabin, 640, 715, 0.62); // base at the merged exit

  ready = true;
}

// ---- enemy walk paths (two lanes that merge) ----
function arc(pts, c, steps=8){
  const a0 = Math.atan2(c.P[1]-R*c.inD[1] - c.C[1], c.P[0]-R*c.inD[0] - c.C[0]);
  const a1 = Math.atan2(c.P[1]+R*c.outD[1] - c.C[1], c.P[0]+R*c.outD[0] - c.C[0]);
  let d = a1 - a0; while (d> Math.PI) d-=2*Math.PI; while (d<-Math.PI) d+=2*Math.PI;
  for (let k=1;k<=steps;k++){ const a=a0+d*(k/steps); pts.push([c.C[0]+R*Math.cos(a), c.C[1]+R*Math.sin(a)]); }
}
function buildPaths(){
  const bCorner = cornerAt([0,1],[-1,0],[B_X, LANE_Y]);
  // A: spawn at wide trailhead -> merge left -> curve to bottom exit -> cross -> base
  const A = [[20, LANE_Y], [MERGE_LX+10, LANE_Y], [640, LANE_Y+20], [640, 720]];
  // B: top -> down -> corner -> left -> merge right -> bottom -> base
  const B = [[B_X, -30], [B_X, bCorner.P[1]-R]];
  arc(B, bCorner);
  B.push([MERGE_RX-10, LANE_Y], [640, LANE_Y+20], [640, 720]);
  return { A, B };
}
const PATHS = buildPaths();

function polyLen(p){ let L=0; for(let i=1;i<p.length;i++) L+=Math.hypot(p[i][0]-p[i-1][0], p[i][1]-p[i-1][1]); return L; }
function ptAt(p, d){
  for(let i=1;i<p.length;i++){ const seg=Math.hypot(p[i][0]-p[i-1][0], p[i][1]-p[i-1][1]);
    if(d<=seg){ const t=seg?d/seg:0; return {x:p[i-1][0]+(p[i][0]-p[i-1][0])*t, y:p[i-1][1]+(p[i][1]-p[i-1][1])*t,
      ang:Math.atan2(p[i][1]-p[i-1][1], p[i][0]-p[i-1][0])}; } d-=seg; }
  const e=p[p.length-1]; return {x:e[0], y:e[1], ang:0};
}

// ---- monster sprites on both lanes ----
function eframe(dir,name,n){ const a=[]; for(let i=0;i<n;i++){ const s=String(i).padStart(3,'0');
  const im=new Image(); im.src=`assets/enemies/${dir}/${name}${s}.png`; a.push(im);} return a; }
const MON = {
  e1: eframe('e1','1_enemies_1_walk_',20),
  e2: eframe('e2','2_enemies_1_walk_',20),
  e4: eframe('e4','4_enemies_1_walk_',20),
};
const monsters = [];
const LEN = { A: polyLen(PATHS.A), B: polyLen(PATHS.B) };
let spawnT = 0, spawnI = 0;
function spawn(){
  const lane = spawnI % 2 === 0 ? 'A' : 'B';
  const type = ['e1','e2','e4'][spawnI % 3];
  monsters.push({ lane, type, d: 0, frame: 0, ft: 0, facing: 1 });
  spawnI++;
}

let last = performance.now();
function loop(now){
  const dt = Math.min((now-last)/1000, 0.05); last = now;
  if (!ready && loaded()) compose();
  // update monsters
  spawnT -= dt; if (spawnT <= 0){ spawn(); spawnT = 1.1; }
  for (const mo of monsters){
    mo.d += 70 * dt;
    mo.ft += dt; if (mo.ft>0.06){ mo.ft=0; mo.frame=(mo.frame+1)%20; }
    const pos = ptAt(PATHS[mo.lane], mo.d); mo.pos = pos;
    const dx = Math.cos(pos.ang); if (dx>0.15) mo.facing=1; else if (dx<-0.15) mo.facing=-1;
  }
  for (let i=monsters.length-1;i>=0;i--){ if (monsters[i].d > LEN[monsters[i].lane]) monsters.splice(i,1); }

  // render
  ctx.clearRect(0,0,W,H);
  if (ready) ctx.drawImage(map,0,0); else { ctx.fillStyle='#dfe8ee'; ctx.fillRect(0,0,W,H); }
  const sorted = [...monsters].sort((a,b)=> (a.pos?.y||0)-(b.pos?.y||0));
  for (const mo of sorted){
    const fr = MON[mo.type][mo.frame]; if (!fr || !fr.complete || !fr.naturalWidth || !mo.pos) continue;
    const size = 64, ar = fr.naturalWidth/fr.naturalHeight;
    let w=size, h=size/ar; if (h>size){ h=size; w=size*ar; }
    const flip = mo.facing===-1;
    if (flip){ ctx.save(); ctx.translate(mo.pos.x,0); ctx.scale(-1,1); ctx.translate(-mo.pos.x,0); }
    ctx.drawImage(fr, mo.pos.x-w/2, mo.pos.y-h+6, w, h);
    if (flip) ctx.restore();
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
