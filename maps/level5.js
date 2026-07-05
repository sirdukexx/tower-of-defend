// ===================== Level 5 — Crossfield Farm (4 lanes, drafted from a hand-drawn route) =====================
// Draft: top road (spawn LEFT + spawn RIGHT) meets a Y-merge, drops onto a
// second road (spawn LEFT + spawn RIGHT) at a 4-way cross, then exits south.
(function () {
  const W = 1280, H = 720;
  const S = 0.55;
  const LANE = 171 * S;
  const K = 256 * S;
  const R = 170.5 * S;
  const M_W = 341 * S, M_H = 260 * S;
  const M_BDX = 170.5 * S;
  const M_SDY = 92 * S;
  const C9 = 341 * S;
  const HALF = 170.5 * S;

  function img(n) { const i = new Image(); i.src = 'assets/farm/' + n + '.png'; return i; }
  const ART = {
    bg: img('main_bg'), tree: img('tree'), tree2: img('tree_2'), bush: img('bush'),
    stone: img('stone'), dot: img('dot'),
    house: img('decor_2'), windmill: img('decor_5'), campfire: img('decor_4'),
    logs: img('decor_1'), flag: img('decor_3'), fence: img('fence'),
    river: img('river_5'), bridge: img('bridge'),
    BR: img('road_1'), BL: img('road_2'), TR: img('road_3'), TL: img('road_4'),
    H: img('road_5'), V: img('road_6'), merge: img('road_8'), cross: img('road_9'),
  };

  const TOP_Y = 150, MID_Y = 420, SPINE_X = 640;
  const Y8 = { x: SPINE_X - M_BDX, y: TOP_Y - M_SDY };
  const CT = MID_Y - HALF, CB = MID_Y + HALF, CL = SPINE_X - HALF, CR = SPINE_X + HALF;

  // Positions marked by the user directly on the draft: 3 pads flanking the
  // left approach, 3 flanking the right approach, all in the open band
  // between the top road and the mid road.
  const BUILD_SPOTS = [
    [93, 297], [268, 297], [444, 297],
    [800, 297], [925, 297], [1119, 297],
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
  const RIVER_THICK = 90;
  function tileRiverH(m, x0, x1, midY) {
    const top = midY - RIVER_THICK / 2;
    const tileW = 256 * (RIVER_THICK / 171);
    let x = x0;
    while (x < x1 - 0.5) {
      const w = Math.min(tileW, x1 - x);
      m.drawImage(ART.river, 0, 0, w / (RIVER_THICK / 171), 171, x, top, w, RIVER_THICK);
      x += w;
    }
  }

  function allArtLoaded() { return Object.values(ART).every(im => im.complete && im.naturalWidth); }

  function composeMap(m) {
    m.drawImage(ART.bg, 0, 0, W, H);

    straightH(m, -40, Y8.x + 5, TOP_Y);
    straightH(m, Y8.x + M_W - 5, 1320, TOP_Y);
    straightV(m, Y8.y + M_H - 3, CT + 5, SPINE_X);
    straightH(m, -40, CL + 5, MID_Y);
    straightH(m, CR - 5, 1320, MID_Y);
    straightV(m, CB - 5, 720, SPINE_X);

    m.drawImage(ART.merge, Y8.x, Y8.y, M_W, M_H);
    m.drawImage(ART.cross, CL, CT, C9, C9);

    for (const [x, y] of BUILD_SPOTS) {
      const w = ART.dot.naturalWidth * 0.8, h = ART.dot.naturalHeight * 0.8;
      m.drawImage(ART.dot, x - w / 2, y - h / 2, w, h);
    }

    // every position below verified clear of the road/junction bands AND
    // every build pad by a numeric bounding-box check (not by eye) -- decor
    // must never sit on the road or block a tower spot, with ONE deliberate
    // exception: the bridge, which is SUPPOSED to sit where the exit road
    // crosses the river.
    const riverY = 685, gapLo = SPINE_X - 100, gapHi = SPINE_X + 100;
    tileRiverH(m, -20, gapLo, riverY);
    tileRiverH(m, gapHi, 1300, riverY);
    const bw = 220 * 0.92, bh = 169 * 0.92;
    m.drawImage(ART.bridge, SPINE_X - bw / 2, riverY - bh / 2, bw, bh);

    sprite(m, ART.windmill, 1142, 39, 0.62);
    sprite(m, ART.house, 1092, 648, 0.55);
    sprite(m, ART.campfire, 23, 290, 0.6);
    sprite(m, ART.logs, 1217, 664, 0.55);
    sprite(m, ART.fence, 55, 562, 0.7);
    sprite(m, ART.fence, 1102, 703, 0.7);

    const trees = [
      [122,86],[420,60],[860,60],[1207,352],
      [178,355],[359,343],[1010,330],[1200,610],
      [150,620],[600,80],[788,600],
    ];
    for (const [x, y] of trees) sprite(m, ART.tree, x, y, 0.55);
    const stumps = [[422,243],[1074,243],[310,512],[990,512]];
    for (const [x, y] of stumps) sprite(m, ART.tree2, x, y, 0.7);
    const bushes = [[541,303],[700,82],[488,525],[864,525]];
    for (const [x, y] of bushes) sprite(m, ART.bush, x, y, 0.75);
    const stones = [[216,82],[1076,82],[247,525],[1107,525]];
    for (const [x, y] of stones) sprite(m, ART.stone, x, y, 0.8);
  }

  // ---- enemy walk lanes (4 spawns -> Y-merge -> 4-way cross -> exit) ----
  function turnArc(pts, P, inD, outD, r, steps = 8) {
    const C = [P[0] + r * (outD[0] - inD[0]), P[1] + r * (outD[1] - inD[1])];
    const A = [P[0] - r * inD[0], P[1] - r * inD[1]];
    const B = [P[0] + r * outD[0], P[1] + r * outD[1]];
    const a0 = Math.atan2(A[1] - C[1], A[0] - C[0]), a1 = Math.atan2(B[1] - C[1], B[0] - C[0]);
    let d = a1 - a0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    for (let k = 1; k <= steps; k++) { const a = a0 + d * (k / steps); pts.push([C[0] + r * Math.cos(a), C[1] + r * Math.sin(a)]); }
  }
  function buildLanes() {
    const rY = 38;
    function tailFromCross(pts) {
      pts.push([SPINE_X, CB - 4]);
      pts.push([SPINE_X, 760]);
    }
    // A: top-left spawn -> Y merge (turn south) -> straight through cross -> exit
    const A = [[-40, TOP_Y], [SPINE_X - rY, TOP_Y]];
    turnArc(A, [SPINE_X, TOP_Y], [1,0], [0,1], rY);
    A.push([SPINE_X, CT + 4]);
    tailFromCross(A);
    // B: top-right spawn, mirrors A
    const B = [[1320, TOP_Y], [SPINE_X + rY, TOP_Y]];
    turnArc(B, [SPINE_X, TOP_Y], [-1,0], [0,1], rY);
    B.push([SPINE_X, CT + 4]);
    tailFromCross(B);
    // C: mid-left spawn -> turns south at the cross
    const C = [[-40, MID_Y], [SPINE_X - rY, MID_Y]];
    turnArc(C, [SPINE_X, MID_Y], [1,0], [0,1], rY);
    tailFromCross(C);
    // D: mid-right spawn, mirrors C
    const D = [[1320, MID_Y], [SPINE_X + rY, MID_Y]];
    turnArc(D, [SPINE_X, MID_Y], [-1,0], [0,1], rY);
    tailFromCross(D);
    return [A, B, C, D];
  }
  const LANES = buildLanes();

  window.LEVELS = window.LEVELS || [];
  window.LEVELS.push({
    id: 'level5', name: 'Crossfield Farm', desc: '4 ทาง · Y-merge แล้วผ่านสี่แยกกลางทุ่ง',
    LANES, BUILD_SPOTS, composeMap, allArtLoaded,
  });
})();
