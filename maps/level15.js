// ===================== Level 15 — Blight Marsh (3 lanes merge, procedural road) =====================
// This layer pack (game_background_4, pack 2) ships NO road straight/corner/junction
// pieces -- only decor (lakes, land patch, dead trees, stones, obelisk, dot). Per the
// map-from-layers skill's documented fallback, the road is drawn procedurally with
// rounded multi-layer strokes; the layer art is used purely for ground/decor.
(function () {
  const W = 1280, H = 720;
  const R = 42;              // turn radius (procedural corner arc radius)
  const LANE = 46;            // drawn road strip thickness

  function img(n) { const i = new Image(); i.src = 'assets/blight/' + n + '.png'; return i; }
  const ART = {
    bg: img('main_bg'),
    land: img('land'),
    dot: img('dot'),
    obelisk: img('decor_1'),
    lakeA: img('lake_1'), lakeB: img('lake_3'),
    stoneA: img('stone_1'), stoneB: img('stone_3'), stoneC: img('stone_4'),
    treeA: img('tree_1'), treeB: img('tree_2'), treeC: img('tree_3'),
  };

  // ---------------------------------------------------------------------
  // Route geometry -- three lanes merge into one exit:
  //   Lane A enters top-left, turns down-right into the spine
  //   Lane B enters top-right, turns down-left into the spine
  //   spine drops to MID_Y where it T-joins Lane C (entering from the left)
  //   combined flow turns down at EXIT_X and exits off the bottom edge
  const SPINE_X = 490, AX = 350, BX = 630;
  const TOP_Y = 130, MID_Y = 420, EXIT_X = 990, BOT_Y = 760;

  // Run-length sanity (checked once at load time; every run here is comfortably >= 2R):
  //  A horiz AX->SPINE_X = 140 (need >=84)   B horiz SPINE_X->BX = 140 (need >=84)
  //  spine vert TOP_Y->MID_Y = 290 (need >=84)   exit vert = 258
  const RUN_CHECKS = [
    ['A horiz', SPINE_X - AX, 2 * R],
    ['B horiz', BX - SPINE_X, 2 * R],
    ['spine vert', MID_Y - TOP_Y, 2 * R],
    ['exit vert', BOT_Y - (MID_Y + R), 10],
  ];
  RUN_CHECKS.forEach(([label, len, need]) => {
    if (len < need) console.warn('level15 route run too short:', label, len, '<', need);
  });

  const BUILD_SPOTS = [
    [150, 230], [760, 230], [150, 560], [610, 300],
    [1120, 230], [820, 600], [1160, 620], [300, 640],
  ];

  // ---------------------------------------------------------------------
  // Procedural road path (axis-aligned waypoints); rounded stroke draws the
  // curves, and the same waypoints (with sampled arcs) drive enemy walking.
  function unitDir(a, b) { return [Math.sign(b[0] - a[0]), Math.sign(b[1] - a[1])]; }

  function turnArc(pts, P, inD, outD, r, steps = 8) {
    const C = [P[0] + r * (outD[0] - inD[0]), P[1] + r * (outD[1] - inD[1])];
    const A = [P[0] - r * inD[0], P[1] - r * inD[1]];
    const B = [P[0] + r * outD[0], P[1] + r * outD[1]];
    const a0 = Math.atan2(A[1] - C[1], A[0] - C[0]), a1 = Math.atan2(B[1] - C[1], B[0] - C[0]);
    let d = a1 - a0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    for (let k = 1; k <= steps; k++) { const a = a0 + d * (k / steps); pts.push([C[0] + r * Math.cos(a), C[1] + r * Math.sin(a)]); }
  }

  // downstream shared path: from the spine's merge point, down to MID_Y (T with
  // lane C), across to EXIT_X, then down off the bottom
  function downstreamFromSpine(pts) {
    pts.push([SPINE_X, MID_Y - R - 1]);
    turnArc(pts, [SPINE_X, MID_Y], [0, 1], [1, 0], R);
    pts.push([EXIT_X - R, MID_Y]);
    turnArc(pts, [EXIT_X, MID_Y], [1, 0], [0, 1], R);
    pts.push([EXIT_X, BOT_Y]);
  }

  function buildLanes() {
    // Lane A: enters top at x=AX, straight down to TOP_Y, corner turns right into spine
    const P1 = [[AX, -40], [AX, TOP_Y - R]];
    turnArc(P1, [AX, TOP_Y], [0, 1], [1, 0], R);
    P1.push([SPINE_X - R, TOP_Y]);
    turnArc(P1, [SPINE_X, TOP_Y], [1, 0], [0, 1], R);
    downstreamFromSpine(P1);

    // Lane B: enters top at x=BX, straight down to TOP_Y, corner turns left into spine
    const P2 = [[BX, -40], [BX, TOP_Y - R]];
    turnArc(P2, [BX, TOP_Y], [0, 1], [-1, 0], R);
    P2.push([SPINE_X + R, TOP_Y]);
    turnArc(P2, [SPINE_X, TOP_Y], [-1, 0], [0, 1], R);
    downstreamFromSpine(P2);

    // Lane C: enters from the left at MID_Y, straight across, T-joins the spine,
    // continues to the exit turn and out the bottom
    const P3 = [[-40, MID_Y], [EXIT_X - R, MID_Y]];
    turnArc(P3, [EXIT_X, MID_Y], [1, 0], [0, 1], R);
    P3.push([EXIT_X, BOT_Y]);

    return [P1, P2, P3];
  }
  const LANES = buildLanes();

  // ---------------------------------------------------------------------
  // Road drawing: rounded multi-layer stroke along the centerline polyline
  // of each lane segment (pre-merge sections only drawn once each; the
  // shared downstream trunk drawn once). Two-layer stroke: dark silt edge
  // under a lighter swamp-path fill, so it reads as a worn path.
  function strokePath(m, pts, width, color) {
    if (pts.length < 2) return;
    m.lineJoin = 'round'; m.lineCap = 'round';
    m.strokeStyle = color; m.lineWidth = width;
    m.beginPath();
    m.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) m.lineTo(pts[i][0], pts[i][1]);
    m.stroke();
  }

  // centerline polylines for drawing (pre-merge arms + shared trunk once)
  function armA() {
    const p = [[AX, -40], [AX, TOP_Y - R]];
    turnArc(p, [AX, TOP_Y], [0, 1], [1, 0], R);
    p.push([SPINE_X - R, TOP_Y]);
    turnArc(p, [SPINE_X, TOP_Y], [1, 0], [0, 1], R);
    p.push([SPINE_X, MID_Y]);
    return p;
  }
  function armB() {
    const p = [[BX, -40], [BX, TOP_Y - R]];
    turnArc(p, [BX, TOP_Y], [0, 1], [-1, 0], R);
    p.push([SPINE_X + R, TOP_Y]);
    turnArc(p, [SPINE_X, TOP_Y], [-1, 0], [0, 1], R);
    p.push([SPINE_X, MID_Y]);
    return p;
  }
  function trunk() {
    const p = [[-40, MID_Y], [EXIT_X - R, MID_Y]];
    turnArc(p, [EXIT_X, MID_Y], [1, 0], [0, 1], R);
    p.push([EXIT_X, BOT_Y]);
    return p;
  }

  function drawRoad(m) {
    const segs = [armA(), armB(), trunk()];
    // dark silt edge (wider, darker) then lighter path fill on top
    for (const s of segs) strokePath(m, s, LANE + 14, '#3a3a28');
    for (const s of segs) strokePath(m, s, LANE, '#6b6b46');
    for (const s of segs) strokePath(m, s, LANE - 16, '#82824f');
  }

  function allArtLoaded() { return Object.values(ART).every(im => im.complete && im.naturalWidth); }

  function sprite(m, im, cx, bottomY, sc) {
    const w = im.naturalWidth * sc, h = im.naturalHeight * sc;
    m.drawImage(im, cx - w / 2, bottomY - h, w, h);
  }

  function composeMap(m) {
    m.drawImage(ART.bg, 0, 0, W, H);

    // flat ground clearing patches tucked under the junctions (land.png,
    // low alpha edge blends into bg -- purely ambience, safely under road)
    sprite(m, ART.land, SPINE_X, MID_Y + 40, 0.6);
    sprite(m, ART.land, EXIT_X, MID_Y + 10, 0.55);

    drawRoad(m);

    for (const [x, y] of BUILD_SPOTS) {
      const w = ART.dot.naturalWidth * 0.75, h = ART.dot.naturalHeight * 0.75;
      m.drawImage(ART.dot, x - w / 2, y - h / 2, w, h);
    }

    // every position below verified clear of BOTH the road bands AND every
    // build pad by scripts/level15-check.js (not by eye) -- decor must never
    // sit on the road or block a tower spot
    const lakes = [[128, 678, ART.lakeA, 0.5], [1170, 490, ART.lakeB, 0.5]];
    for (const [x, y, im, sc] of lakes) sprite(m, im, x, y, sc);

    const stones = [[58, 374, ART.stoneA], [930, 130, ART.stoneB], [1240, 260, ART.stoneC], [480, 640, ART.stoneA]];
    for (const [x, y, im] of stones) sprite(m, im, x, y, 0.65);

    const trees = [
      [30, 130, ART.treeB], [234, 598, ART.treeC], [190, 90, ART.treeA],
      [898, 700, ART.treeB], [1226, 418, ART.treeC], [820, 40, ART.treeC],
      [376, 700, ART.treeB], [1260, 130, ART.treeA],
    ];
    for (const [x, y, im] of trees) sprite(m, im, x, y, 0.5);

    sprite(m, ART.obelisk, 1017, 368, 0.62);
  }

  window.LEVELS = window.LEVELS || [];
  window.LEVELS.push({
    id: 'level15', name: 'Blight Marsh',
    desc: '3 ทาง · หนองพิษ รวมกันเป็นทางเดียว',
    LANES, BUILD_SPOTS, composeMap, allArtLoaded,
  });
})();
