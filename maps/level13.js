// ===================== Level 13 — Molten Throne (4 lanes, double Y-merge) =====================
// Draft: 4 spawns feed two Y-merges (road_9) in the NW/NE quadrants -- each
// merge combines a far-edge horizontal spawn with a top-edge vertical-drop
// spawn that stays entirely within its own quadrant (no lane crosses the
// other merge's territory). The two merges' single exits then turn inward
// and funnel through a THIRD Y-merge on the spine, exiting south off-canvas.
// This pack has no 4-way cross piece, so the HARD 4-lane topology is built
// from two Y-merges feeding a third Y-merge instead (sanctioned fallback
// per task brief -- see SKILL.md step (b) alternative).
(function () {
  const W = 1280, H = 720;
  const S = 0.55;
  const LANE = 171 * S;      // 94.05
  const K = 256 * S;         // 140.8  (corner piece footprint)
  const R = 170.5 * S;       // 93.775 (centerline turn radius)
  const M_W = 341 * S;       // 187.55 (merge piece width)
  const M_H = 260 * S;       // 143.0  (merge piece height)
  const M_BDX = 170.5 * S;   // 93.775 (half width of merge piece == R)

  function img(n) { const i = new Image(); i.src = 'assets/volcano/' + n + '.png'; return i; }
  const ART = {
    bg: img('main_bg'), land: img('land'), dot: img('dot'),
    lake2: img('lake_2'),
    statue: img('decor_2'), lavarock: img('decor_1'), minivolcano: img('decor_4'),
    lavapool: img('decor_5'), skull: img('decor_6'), bones: img('decor_7'),
    stone1: img('stone_1'), stone2: img('stone_2'), stone3: img('stone_3'), stone7: img('stone_7'), stone8: img('stone_8'),
    BR: img('road_1'), BL: img('road_2'), TR: img('road_3'), TL: img('road_4'),
    V: img('road_5'), H: img('road_6'), merge: img('road_9'),
  };

  // ---- layout ----
  const SPINE_X = 640;
  const TOP_Y = 140;
  const EXIT_A_X = 280, EXIT_B_X = 1000;   // centerline x of merge-A / merge-B single exits
  const YA = { x: EXIT_A_X - M_BDX, y: TOP_Y };
  const YB = { x: EXIT_B_X - M_BDX, y: TOP_Y };
  const mergeA_bottom = YA.y + M_H;   // 283
  const mergeB_bottom = YB.y + M_H;   // 283
  const DROP_X_A = 500;   // spawn2's top-edge entry x (drops down, then west into merge A)
  const DROP_X_B = 780;   // spawn3's top-edge entry x (drops down, then east into merge B)

  const TURN_Y = mergeA_bottom + R + 40;          // 416.775 -- inward-turn row below both merges
  const FINAL_TOP_Y = TURN_Y + R + 40;            // 550.55  -- top of the final merge
  const YF = { x: SPINE_X - M_BDX, y: FINAL_TOP_Y };
  const FINAL_BOTTOM = YF.y + M_H;                // 693.55
  const ENTER_A_X = YF.x + 40;      // 586.225 -- left branch entry of the final merge
  const ENTER_B_X = YF.x + M_W - 40; // 693.775 -- right branch entry of the final merge

  // road_9 (this pack's merge piece) is the mirror of the farm pack's merge
  // used in level5.js: its SINGLE opening is at the image TOP and its two
  // branches fan out to the BOTTOM (verified via alpha cross-section, see
  // inspect_layers.py output). We draw it flipped vertically so it behaves
  // exactly like level5's road_8: two branches enter from the top, one exit
  // leaves the bottom -- letting us reuse the same placement math.
  // drawn with a small bleed margin on the sides/top so fractional-pixel
  // scaling (canvas internal -> CSS object-fit:contain) can never expose a
  // hairline seam between this piece and the straight segments feeding it
  const BLEED = 6;
  function drawMergeFlipped(m, x, y, w, h) {
    m.save();
    m.translate(x, y + h);
    m.scale(1, -1);
    m.drawImage(ART.merge, -BLEED, 0, w + BLEED * 2, h + BLEED);
    m.restore();
  }

  // Build pads: 8 total, spread across the open pockets -- flanking merge A,
  // flanking merge B, the central gap between them, and the lower flanks of
  // the final merge / exit run.
  const BUILD_SPOTS = [
    [70, 20], [70, 620],
    [1210, 20], [1210, 620],
    [640, 250],
    [460, 610], [820, 610],
    [200, 700],
  ];

  function sprite(m, im, cx, bottomY, sc) {
    const w = im.naturalWidth * sc, h = im.naturalHeight * sc;
    m.drawImage(im, cx - w / 2, bottomY - h, w, h);
  }
  function straightH(m, x0, x1, y) {
    const top = y - LANE / 2; let x = x0;
    while (x < x1 - 0.5) { const wpx = Math.min(256 * S, x1 - x);
      m.drawImage(ART.H, 0, 0, wpx / S, 171, x, top, wpx, LANE); x += wpx; }
  }
  function straightV(m, y0, y1, x) {
    const left = x - LANE / 2; let y = y0;
    while (y < y1 - 0.5) { const hpx = Math.min(256 * S, y1 - y);
      m.drawImage(ART.V, 0, 0, 171, hpx / S, left, y, LANE, hpx); y += hpx; }
  }
  function drawCorner(m, Px, Py, inD, outD) {
    const Cx = Px + R * (outD[0] - inD[0]);
    const Cy = Py + R * (outD[1] - inD[1]);
    const right = Cx > Px, below = Cy > Py;
    let piece, dx, dy;
    if (!right && below) { piece = ART.BL; dx = 0; dy = -K; }
    else if (!right && !below) { piece = ART.TL; dx = 0; dy = 0; }
    else if (right && below) { piece = ART.BR; dx = -K; dy = -K; }
    else { piece = ART.TR; dx = -K; dy = 0; }
    m.drawImage(piece, Cx + dx, Cy + dy, K, K);
  }

  function allArtLoaded() { return Object.values(ART).every(im => im.complete && im.naturalWidth); }

  function composeMap(m) {
    m.drawImage(ART.bg, 0, 0, W, H);
    // tileable ground patch to break up the flat backdrop a little
    for (let gy = 0; gy < H; gy += 480) {
      for (let gx = 0; gx < W; gx += 480) {
        m.drawImage(ART.land, gx, gy, 512, 512);
      }
    }

    // ---- straights: merge A approaches ----
    straightH(m, -40, YA.x + 5, TOP_Y);                 // spawn1: far-left edge -> merge A
    straightV(m, -40, TOP_Y - R, DROP_X_A);              // spawn2: top edge drop
    straightH(m, YA.x + M_W - 5, DROP_X_A - R, TOP_Y);   // spawn2: turns west into merge A

    // ---- straights: merge B approaches (mirrors A) ----
    straightH(m, YB.x + M_W - 5, 1320, TOP_Y);           // spawn4: far-right edge -> merge B
    straightV(m, -40, TOP_Y - R, DROP_X_B);              // spawn3: top edge drop
    straightH(m, DROP_X_B + R, YB.x + 5, TOP_Y);         // spawn3: turns east into merge B

    // corners for the two top-edge drop spawns
    drawCorner(m, DROP_X_A, TOP_Y, [0, 1], [-1, 0]);     // spawn2: south -> west
    drawCorner(m, DROP_X_B, TOP_Y, [0, 1], [1, 0]);      // spawn3: south -> east

    // ---- vertical drops from merge A / merge B down to the inward turn ----
    straightV(m, mergeA_bottom - 5, TURN_Y + R, EXIT_A_X);
    straightV(m, mergeB_bottom - 5, TURN_Y + R, EXIT_B_X);

    // inward horizontal runs at TURN_Y connecting to the final merge's entrances
    straightH(m, EXIT_A_X + R, ENTER_A_X - R, TURN_Y);
    straightH(m, ENTER_B_X + R, EXIT_B_X - R, TURN_Y);

    // corner turns at TURN_Y: south->east for stream A, south->west for stream B
    drawCorner(m, EXIT_A_X, TURN_Y, [0, 1], [1, 0]);
    drawCorner(m, EXIT_B_X, TURN_Y, [0, 1], [-1, 0]);
    // corner turns back to south feeding the final merge's entrances
    drawCorner(m, ENTER_A_X, TURN_Y, [1, 0], [0, 1]);
    drawCorner(m, ENTER_B_X, TURN_Y, [-1, 0], [0, 1]);

    // short vertical stubs feeding into the final merge's top edge
    straightV(m, TURN_Y + R, YF.y + 5, ENTER_A_X);
    straightV(m, TURN_Y + R, YF.y + 5, ENTER_B_X);

    // exit stub south of the final merge, off-canvas
    straightV(m, FINAL_BOTTOM - 5, 760, SPINE_X);

    // ---- merge pieces on top (hides any 1px seam at the joints) ----
    drawMergeFlipped(m, YA.x, YA.y, M_W, M_H);
    drawMergeFlipped(m, YB.x, YB.y, M_W, M_H);
    drawMergeFlipped(m, YF.x, YF.y, M_W, M_H);

    // ---- build pads ----
    for (const [x, y] of BUILD_SPOTS) {
      const w = ART.dot.naturalWidth * 0.55, h = ART.dot.naturalHeight * 0.55;
      m.drawImage(ART.dot, x - w / 2, y - h / 2, w, h);
    }

    // ---- decor -- every position verified clear of the road bands and
    // every build pad by scripts/verify_level13.js (numeric bounding-box
    // check, not by eye). No bridge-over-lava crossing is used on this map
    // (the pack's lava-lake pieces are ordinary decor, not a road crossing),
    // so there are zero sanctioned road-overlap exceptions here.
    sprite(m, ART.statue, 950, 700, 0.3);
    sprite(m, ART.minivolcano, 120, 340, 0.45);
    sprite(m, ART.minivolcano, 1150, 340, 0.45);
    sprite(m, ART.lavapool, 100, 330, 0.4);
    sprite(m, ART.lavapool, 1135, 330, 0.4);
    sprite(m, ART.lake2, 350, 715, 0.24);
    sprite(m, ART.skull, 1275, 730, 0.35);
    sprite(m, ART.bones, 60, 400, 0.32);
    sprite(m, ART.bones, 1130, 400, 0.32);
    sprite(m, ART.lavarock, 60, 530, 0.16);
    sprite(m, ART.lavarock, 1090, 700, 0.16);

    const stones = [
      [120, 570, ART.stone1], [1120, 570, ART.stone2],
      [460, 345, ART.stone3], [820, 345, ART.stone7],
      [1000, 720, ART.stone8],
    ];
    for (const [x, y, im2] of stones) sprite(m, im2, x, y, 0.7);
  }

  // ---- enemy walk lanes (4 spawns -> two Y-merges -> final Y-merge -> exit) ----
  function turnArc(pts, P, inD, outD, r, steps = 8) {
    const C = [P[0] + r * (outD[0] - inD[0]), P[1] + r * (outD[1] - inD[1])];
    const A = [P[0] - r * inD[0], P[1] - r * inD[1]];
    const B = [P[0] + r * outD[0], P[1] + r * outD[1]];
    const a0 = Math.atan2(A[1] - C[1], A[0] - C[0]), a1 = Math.atan2(B[1] - C[1], B[0] - C[0]);
    let d = a1 - a0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    for (let k = 1; k <= steps; k++) { const a = a0 + d * (k / steps); pts.push([C[0] + r * Math.cos(a), C[1] + r * Math.sin(a)]); }
  }
  function buildLanes() {
    const rY = 38;   // tight turn radius used INSIDE merge-piece art, same as level5

    // spawn1: far-left edge -> merge A (straight approach)
    const spawn1 = [[-40, TOP_Y], [EXIT_A_X - rY, TOP_Y]];
    turnArc(spawn1, [EXIT_A_X, TOP_Y], [1, 0], [0, 1], rY);
    finishFromMergeA(spawn1);

    // spawn2: top edge drop at DROP_X_A -> turn west -> merge A
    const spawn2 = [[DROP_X_A, -40], [DROP_X_A, TOP_Y - R]];
    turnArc(spawn2, [DROP_X_A, TOP_Y], [0, 1], [-1, 0], R);
    spawn2.push([EXIT_A_X + rY, TOP_Y]);
    turnArc(spawn2, [EXIT_A_X, TOP_Y], [-1, 0], [0, 1], rY);
    finishFromMergeA(spawn2);

    // spawn3: top edge drop at DROP_X_B -> turn east -> merge B
    const spawn3 = [[DROP_X_B, -40], [DROP_X_B, TOP_Y - R]];
    turnArc(spawn3, [DROP_X_B, TOP_Y], [0, 1], [1, 0], R);
    spawn3.push([EXIT_B_X - rY, TOP_Y]);
    turnArc(spawn3, [EXIT_B_X, TOP_Y], [1, 0], [0, 1], rY);
    finishFromMergeB(spawn3);

    // spawn4: far-right edge -> merge B (straight approach)
    const spawn4 = [[1320, TOP_Y], [EXIT_B_X + rY, TOP_Y]];
    turnArc(spawn4, [EXIT_B_X, TOP_Y], [-1, 0], [0, 1], rY);
    finishFromMergeB(spawn4);

    function finishFromMergeA(pts) {
      pts.push([EXIT_A_X, TURN_Y]);
      turnArc(pts, [EXIT_A_X, TURN_Y], [0, 1], [1, 0], R);
      pts.push([ENTER_A_X, TURN_Y]);
      turnArc(pts, [ENTER_A_X, TURN_Y], [1, 0], [0, 1], R);
      pts.push([SPINE_X, FINAL_BOTTOM - 4]);
      pts.push([SPINE_X, 760]);
    }
    function finishFromMergeB(pts) {
      pts.push([EXIT_B_X, TURN_Y]);
      turnArc(pts, [EXIT_B_X, TURN_Y], [0, 1], [-1, 0], R);
      pts.push([ENTER_B_X, TURN_Y]);
      turnArc(pts, [ENTER_B_X, TURN_Y], [-1, 0], [0, 1], R);
      pts.push([SPINE_X, FINAL_BOTTOM - 4]);
      pts.push([SPINE_X, 760]);
    }

    return [spawn1, spawn2, spawn3, spawn4];
  }
  const LANES = buildLanes();

  window.LEVELS = window.LEVELS || [];
  window.LEVELS.push({
    id: 'level13', name: 'Molten Throne', desc: '4 ทาง · หลอมรวมสองครั้งผ่านหุบเขาลาวาสู่บัลลังก์ปีศาจ',
    LANES, BUILD_SPOTS, composeMap, allArtLoaded,
  });
})();
