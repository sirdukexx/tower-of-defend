// ===================== Level 11 — Twilight Watch (3 lanes merge, one exit) =====================
(function () {
  const W = 1280, H = 720;
  const S = 0.5;
  const LANE = 171 * S;
  const K = 256 * S;
  const R = 170.5 * S;
  const M_W = 341 * S, M_H = 260 * S;
  const M_BDX = 170.5 * S;
  const M_SDY = 92 * S;

  function img(n) { const i = new Image(); i.src = 'assets/twilight/' + n + '.png'; return i; }
  const ART = {
    bg: img('main_bg'), tree: img('decor_1'), tower: img('decor_2'), keep: img('decor_3'),
    twigs: img('decor_4'), rune1: img('decor_5'), rune2: img('decor_6'), rune3: img('decor_7'),
    rune4: img('decor_8'), stone: img('stone'), dot: img('dot'),
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

  // ---- layout: lane1 (top-left) + lane2 (top-right) merge in a Y at TOP_Y,
  // spine drops down and joins lane3 (entering from the left at MID_Y) in a
  // T-junction, combined path runs right then turns down to exit off the
  // bottom edge near TURN_X.
  const TOP_Y = 130, SPINE_X = 700, MID_Y = 430, TURN_X = 1080;
  const Y8 = { x: SPINE_X - M_BDX, y: TOP_Y - M_SDY };
  const T8 = { x: SPINE_X - M_BDX, y: MID_Y - (M_H - M_SDY) };
  const EXIT_TURN = cornerAt([1, 0], [0, 1], [TURN_X, MID_Y]);

  const BUILD_SPOTS = [
    [364, 232], [984, 232], [230, 300], [500, 300],
    [900, 300], [1184, 532], [300, 600], [820, 620],
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

  function allArtLoaded() { return Object.values(ART).every(im => im.complete && im.naturalWidth); }

  function composeMap(m) {
    m.drawImage(ART.bg, 0, 0, W, H);

    straightH(m, -40, Y8.x + 5, TOP_Y);
    straightH(m, Y8.x + M_W - 5, 1320, TOP_Y);
    straightV(m, Y8.y + M_H - 3, T8.y + 5, SPINE_X);
    straightH(m, -40, T8.x + 5, MID_Y);
    straightH(m, T8.x + M_W - 5, TURN_X - R + 3, MID_Y);
    straightV(m, MID_Y + R - 3, 720, TURN_X);

    m.drawImage(ART.merge, Y8.x, Y8.y, M_W, M_H);
    m.save();
    m.translate(T8.x, T8.y + M_H); m.scale(1, -1);
    m.drawImage(ART.merge, 0, 0, M_W, M_H);
    m.restore();
    m.drawImage(EXIT_TURN.im, EXIT_TURN.x, EXIT_TURN.y, K, K);

    for (const [x, y] of BUILD_SPOTS) {
      const w = ART.dot.naturalWidth * 0.75, h = ART.dot.naturalHeight * 0.75;
      m.drawImage(ART.dot, x - w / 2, y - h / 2, w, h);
    }

    // every position below verified clear of BOTH the road/junction bands
    // AND every build pad (not by eye) -- decor must never sit on the road
    // or block a tower spot
    const trees = [[101, 284], [60, 630], [1220, 300], [1209, 669], [520, 60], [960, 640], [160, 690], [850, 60]];
    for (const [x, y] of trees) sprite(m, ART.tree, x, y, 0.5);
    const stones = [[404, 346], [1082, 276], [162, 562], [560, 700]];
    for (const [x, y] of stones) sprite(m, ART.stone, x, y, 0.6);
    const runes = [[220, 60], [981, 686], [60, 533], [1233, 346]];
    const runeArt = [ART.rune1, ART.rune2, ART.rune3, ART.rune4];
    runes.forEach(([x, y], i) => sprite(m, runeArt[i], x, y, 0.5));
    sprite(m, ART.twigs, 949, 70, 0.45);
    sprite(m, ART.tower, 744, 631, 0.45);
    sprite(m, ART.keep, 1200, 60, 0.5);
  }

  // ---- enemy walk lanes (3 spawns merging into one exit) ----
  function turnArc(pts, P, inD, outD, r, steps = 8) {
    const C = [P[0] + r * (outD[0] - inD[0]), P[1] + r * (outD[1] - inD[1])];
    const A = [P[0] - r * inD[0], P[1] - r * inD[1]];
    const B = [P[0] + r * outD[0], P[1] + r * outD[1]];
    const a0 = Math.atan2(A[1] - C[1], A[0] - C[0]), a1 = Math.atan2(B[1] - C[1], B[0] - C[0]);
    let d = a1 - a0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    for (let k = 1; k <= steps; k++) { const a = a0 + d * (k / steps); pts.push([C[0] + r * Math.cos(a), C[1] + r * Math.sin(a)]); }
  }
  function buildLanes() {
    const rY = 35;
    function downstreamFromSpine(pts) {
      pts.push([SPINE_X, MID_Y - rY - 1]);
      turnArc(pts, [SPINE_X, MID_Y], [0, 1], [1, 0], rY);
      pts.push([TURN_X - R, MID_Y]);
      turnArc(pts, [TURN_X, MID_Y], [1, 0], [0, 1], R);
      pts.push([TURN_X, 760]);
    }
    const P1 = [[-40, TOP_Y], [SPINE_X - rY, TOP_Y]];
    turnArc(P1, [SPINE_X, TOP_Y], [1, 0], [0, 1], rY);
    downstreamFromSpine(P1);
    const P2 = [[1320, TOP_Y], [SPINE_X + rY, TOP_Y]];
    turnArc(P2, [SPINE_X, TOP_Y], [-1, 0], [0, 1], rY);
    downstreamFromSpine(P2);
    const P3 = [[-40, MID_Y], [TURN_X - R, MID_Y]];
    turnArc(P3, [TURN_X, MID_Y], [1, 0], [0, 1], R);
    P3.push([TURN_X, 760]);
    return [P1, P2, P3];
  }
  const LANES = buildLanes();

  window.LEVELS = window.LEVELS || [];
  window.LEVELS.push({
    id: 'level11', name: 'Twilight Watch',
    desc: 'ป้อมค่ำคืน 3 เส้นทาง · รวมกันเป็นทางเดียวก่อนออก',
    LANES, BUILD_SPOTS, composeMap, allArtLoaded,
  });
})();
