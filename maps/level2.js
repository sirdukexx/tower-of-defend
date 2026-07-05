// ===================== Level 2 — Twin Pass (2 lanes merge, cross a 4-way) =====================
(function () {
  const W = 1280, H = 720;
  const S = 0.55;
  const LANE = 171 * S;
  const K = 256 * S;
  const R = 170.5 * S;
  const C9 = 341 * S;
  const HALF = 170.5 * S;
  const M_W = 341 * S, M_H = 260 * S;
  const M_BDX = 170.5 * S;
  const M_SDY = 92 * S;
  const W7 = 596 * S, H7 = 255 * S;
  const W7_NECK_DY = 86 * S;
  const W10 = 491 * S, H10 = 513 * S;

  function img(n) { const i = new Image(); i.src = 'assets/winter/' + n + '.png'; return i; }
  const ART = {
    bg: img('main_bg'), mountains: img('mountains'), tree: img('tree'),
    stone: img('stone'), dot: img('dot'),
    cabin: img('decor_3'), ruinR: img('decor_1'), ruinS: img('decor_2'),
    BR: img('road_1'), BL: img('road_2'), TR: img('road_3'), TL: img('road_4'),
    H: img('road_5'), V: img('road_6'), wide: img('road_7'),
    merge: img('road_8'), cross: img('road_9'), branch: img('road_10'),
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

  const MERGE = { x: 640 - M_BDX, y: 285 };
  const MERGE_BOTTOM = { x: 640, y: MERGE.y + M_H };
  const LANE_Y = MERGE.y + M_SDY;
  const MERGE_LX = MERGE.x, MERGE_RX = MERGE.x + M_W;
  const CROSS = { cx: 640, cy: 560 };
  const CT = CROSS.cy - HALF, CB = CROSS.cy + HALF, CL = CROSS.cx - HALF, CR = CROSS.cx + HALF;
  const WIDE = { x: -50, y: LANE_Y - W7_NECK_DY };
  const WIDE_NECK_X = WIDE.x + W7;
  const B_X = 1010;

  const BUILD_SPOTS = [
    [420, 40], [780, 40], [180, 140], [1220, 180],
    [480, 200], [1140, 340], [140, 620], [800, 680],
  ];

  const bCorner = cornerAt([0,1], [-1,0], [B_X, LANE_Y]);
  const lDecor  = cornerAt([0,1], [1,0],  [300, CROSS.cy]);
  const rDecor  = cornerAt([1,0], [0,1],  [980, CROSS.cy]);
  const c1 = cornerAt([0,-1], [1,0], [1175, 505]);
  const X10 = 1290 - W10, Y10 = 720 - H10;

  function sprite(m, im, cx, bottomY, sc) {
    const w = im.naturalWidth * sc, h = im.naturalHeight * sc;
    m.drawImage(im, cx - w / 2, bottomY - h, w, h);
  }
  function straightH(m, x0, x1, y) {
    const top = y - LANE / 2; let x = x0;
    while (x < x1) { const wpx = Math.min(256 * S, x1 - x);
      m.drawImage(ART.H, 0, 0, wpx / S, 171, x, top, wpx, LANE); x += wpx; }
  }
  function straightV(m, y0, y1, x) {
    const left = x - LANE / 2; let y = y0;
    while (y < y1) { const hpx = Math.min(256 * S, y1 - y);
      m.drawImage(ART.V, 0, 0, 171, hpx / S, left, y, LANE, hpx); y += hpx; }
  }
  function drawCorner(m, c) { m.drawImage(c.im, c.x, c.y, K, K); }

  function allArtLoaded() { return Object.values(ART).every(im => im.complete && im.naturalWidth); }

  function composeMap(m) {
    m.drawImage(ART.bg, 0, 0, W, H);

    m.drawImage(ART.wide, WIDE.x, WIDE.y, W7, H7);
    straightH(m, WIDE_NECK_X - 3, MERGE_LX + 5, LANE_Y);
    straightV(m, -40, bCorner.P[1] - R, B_X);
    straightH(m, MERGE_RX - 5, B_X - R, LANE_Y);
    straightV(m, MERGE_BOTTOM.y - 3, CT + 5, 640);
    straightV(m, CB - 5, 720, 640);
    straightV(m, -40, lDecor.P[1] - R, 300);
    straightH(m, lDecor.P[0] + R - 3, CL + 5, CROSS.cy);
    straightH(m, CR - 5, rDecor.P[0] - R + 3, CROSS.cy);
    straightV(m, rDecor.P[1] + R - 3, 720, 980);
    straightV(m, c1.P[1] + R - 3, 720, 1175);
    straightH(m, c1.P[0] + R - 3, 1300, 505);
    m.drawImage(ART.branch, X10, Y10, W10, H10);

    drawCorner(m, bCorner); drawCorner(m, lDecor); drawCorner(m, rDecor); drawCorner(m, c1);
    m.drawImage(ART.merge, MERGE.x, MERGE.y, M_W, M_H);
    m.drawImage(ART.cross, CL, CT, C9, C9);

    for (const [x, y] of BUILD_SPOTS) {
      const w = ART.dot.naturalWidth * 0.8, h = ART.dot.naturalHeight * 0.8;
      m.drawImage(ART.dot, x - w / 2, y - h / 2, w, h);
    }

    // every position below verified clear of BOTH the road/junction bands
    // AND every build pad (not by eye) -- decor must never sit on the road
    // or block a tower spot
    m.drawImage(ART.mountains, W - 778 * 0.34 + 40, -60, 778 * 0.34, 657 * 0.34);
    sprite(m, ART.cabin, 466, 493, 0.4);
    const trees = [[135,94],[494,150],[858,140],[1215,417],[139,523],[399,272],[854,495],[66,698]];
    for (const [x, y] of trees) sprite(m, ART.tree, x, y, 0.55);
    const stones = [[201,471],[784,470],[884,272],[404,177]];
    for (const [x, y] of stones) sprite(m, ART.stone, x, y, 0.7);
    sprite(m, ART.ruinR, 1135, 284, 0.5);
  }

  // ---- enemy walk lanes (A: wide-trailhead spawn, B: top spawn) ----
  function turnArc(pts, c, r, steps = 8) {
    const A = [c.P[0] - r * c.inD[0], c.P[1] - r * c.inD[1]];
    const B = [c.P[0] + r * c.outD[0], c.P[1] + r * c.outD[1]];
    const a0 = Math.atan2(A[1] - c.C[1], A[0] - c.C[0]), a1 = Math.atan2(B[1] - c.C[1], B[0] - c.C[0]);
    let d = a1 - a0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    for (let k = 1; k <= steps; k++) { const a = a0 + d * (k / steps); pts.push([c.C[0] + r * Math.cos(a), c.C[1] + r * Math.sin(a)]); }
  }
  function buildLanes() {
    const A = [[20, LANE_Y], [MERGE_LX + 10, LANE_Y], [640, LANE_Y + 20], [640, 720]];
    const bCorner2 = cornerAt([0,1], [-1,0], [B_X, LANE_Y]);
    const B = [[B_X, -30], [B_X, bCorner2.P[1] - R]];
    turnArc(B, bCorner2, R);
    B.push([MERGE_RX - 10, LANE_Y], [640, LANE_Y + 20], [640, 720]);
    return [A, B];
  }
  const LANES = buildLanes();

  window.LEVELS = window.LEVELS || [];
  window.LEVELS.push({
    id: 'level2', name: 'Twin Pass', desc: '2 ทาง · มารวมกันแล้วผ่านสี่แยก',
    LANES, BUILD_SPOTS, composeMap, allArtLoaded,
  });
})();
