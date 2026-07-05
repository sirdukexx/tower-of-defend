// ===================== Level 10 — Sunken Outpost (2 lanes, desert/wasteland merge) =====================
(function () {
  const W = 1280, H = 720;
  const S = 0.55;
  const LANE = 171 * S;
  const K = 256 * S;
  const R = 170.5 * S;
  const M_W = 341 * S, M_H = 260 * S;
  const M_BDX = 170.5 * S;
  const M_SDY = 92 * S;

  function img(n) { const i = new Image(); i.src = 'assets/outpost/' + n + '.png'; return i; }
  const ART = {
    bg: img('main_bg'), dot: img('dot'),
    cactus: img('decor_3'), skull: img('decor_4'), deadTree: img('decor_5'),
    bonePile: img('decor_6'), cabin: img('decor_7'), lake: img('lake'),
    stoneA: img('stone_1'), stoneB: img('stone_2'), stoneC: img('stone_3'),
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

  // ---- route layout ----
  // Lane A enters top-left, dips down into the merge's left arm.
  // Lane B enters bottom-right, rises up into the merge's right arm.
  // Both combine at the road_8 merge piece, then a single spine drops and
  // turns right to exit off the right edge.
  const A_TOP_Y = 90, A_TURN_X = 250;
  const B_BOT_Y = 660, B_TURN_X = 1080;
  const MERGE_ARMS_Y = 340;
  const MERGE_X = 640;
  const Y8 = { x: MERGE_X - M_BDX, y: MERGE_ARMS_Y - M_SDY };
  const SPINE_BOTTOM_Y = 630;
  const EXIT_X = MERGE_X;

  const aTurn1 = cornerAt([1,0], [0,1], [A_TURN_X, A_TOP_Y]);
  const aTurn2 = cornerAt([0,1], [1,0], [A_TURN_X, MERGE_ARMS_Y]);
  const bTurn1 = cornerAt([-1,0],[0,-1],[B_TURN_X, B_BOT_Y]);
  const bTurn2 = cornerAt([0,-1],[-1,0],[B_TURN_X, MERGE_ARMS_Y]);
  const sTurn1 = cornerAt([0,1], [1,0], [MERGE_X, SPINE_BOTTOM_Y]);

  const BUILD_SPOTS = [
    [90,300], [80,600], [450,120], [860,110],
    [1220,120], [1220,420], [850,480], [280,650],
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

    for (const [x, y] of BUILD_SPOTS) {
      const w = ART.dot.naturalWidth * 0.8, h = ART.dot.naturalHeight * 0.8;
      m.drawImage(ART.dot, x - w / 2, y - h / 2, w, h);
    }

    straightH(m, -40, A_TURN_X - R + 3, A_TOP_Y);
    straightV(m, A_TOP_Y + R - 3, MERGE_ARMS_Y - R + 3, A_TURN_X);
    straightH(m, A_TURN_X + R - 3, Y8.x + 5, MERGE_ARMS_Y);
    straightH(m, B_TURN_X + R - 3, 1320, B_BOT_Y);
    straightV(m, MERGE_ARMS_Y + R - 3, B_BOT_Y - R + 3, B_TURN_X);
    straightH(m, Y8.x + M_W - 5, B_TURN_X - R + 3, MERGE_ARMS_Y);
    straightV(m, Y8.y + M_H - 3, SPINE_BOTTOM_Y - R + 3, MERGE_X);
    straightH(m, MERGE_X + R - 3, 1320, SPINE_BOTTOM_Y);

    m.drawImage(ART.merge, Y8.x, Y8.y, M_W, M_H);
    for (const c of [aTurn1, aTurn2, bTurn1, bTurn2, sTurn1]) {
      m.drawImage(c.im, c.x, c.y, K, K);
    }

    // every position below verified clear of BOTH the road/merge bands
    // AND every build pad, by a Node.js numeric sweep (not by eye) -- decor
    // must never sit on the road or block a tower spot
    sprite(m, ART.lake, 1127, 267, 0.62);

    const cacti = [[458,485],[200,500],[950,200],[429,229]];
    for (const [x, y] of cacti) sprite(m, ART.cactus, x, y, 0.6);

    sprite(m, ART.stoneA, 650, 150, 0.9);
    sprite(m, ART.stoneB, 1104, 158, 0.9);
    sprite(m, ART.stoneC, 143, 459, 0.9);
    sprite(m, ART.stoneA, 400, 600, 0.9);
    sprite(m, ART.stoneB, 851, 264, 0.9);

    const bones = [[775,154],[95,233],[500,620]];
    for (const [x, y] of bones) sprite(m, ART.bonePile, x, y, 0.5);

    sprite(m, ART.skull, 973, 563, 0.55);
    sprite(m, ART.deadTree, 284, 546, 0.55);
    sprite(m, ART.deadTree, 1206, 375, 0.5);
    sprite(m, ART.cabin, 554, 200, 0.55);
  }

  // ---- enemy walk lanes (A: top-left dogleg, B: bottom-right dogleg -> merge -> exit) ----
  function turnArc(pts, c, r, steps = 8) {
    const A = [c.P[0] - r * c.inD[0], c.P[1] - r * c.inD[1]];
    const B = [c.P[0] + r * c.outD[0], c.P[1] + r * c.outD[1]];
    const a0 = Math.atan2(A[1] - c.C[1], A[0] - c.C[0]), a1 = Math.atan2(B[1] - c.C[1], B[0] - c.C[0]);
    let d = a1 - a0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    for (let k = 1; k <= steps; k++) { const a = a0 + d * (k / steps); pts.push([c.C[0] + r * Math.cos(a), c.C[1] + r * Math.sin(a)]); }
  }
  function downstreamFromMerge(pts) {
    pts.push([MERGE_X, SPINE_BOTTOM_Y - R]);
    turnArc(pts, sTurn1, R);
    pts.push([1320, SPINE_BOTTOM_Y]);
  }
  function buildLanes() {
    const rY = 38;
    const A = [[-40, A_TOP_Y], [A_TURN_X - R, A_TOP_Y]];
    turnArc(A, aTurn1, R);
    A.push([A_TURN_X, MERGE_ARMS_Y - R]);
    turnArc(A, aTurn2, R);
    A.push([Y8.x + rY, MERGE_ARMS_Y]);
    turnArc(A, { P:[MERGE_X, MERGE_ARMS_Y], C:[MERGE_X, MERGE_ARMS_Y+rY], inD:[1,0], outD:[0,1] }, rY);
    downstreamFromMerge(A);

    const B = [[1320, B_BOT_Y], [B_TURN_X + R, B_BOT_Y]];
    turnArc(B, bTurn1, R);
    B.push([B_TURN_X, MERGE_ARMS_Y + R]);
    turnArc(B, bTurn2, R);
    B.push([Y8.x + M_W - rY, MERGE_ARMS_Y]);
    turnArc(B, { P:[MERGE_X, MERGE_ARMS_Y], C:[MERGE_X, MERGE_ARMS_Y+rY], inD:[-1,0], outD:[0,1] }, rY);
    downstreamFromMerge(B);

    return [A, B];
  }
  const LANES = buildLanes();

  window.LEVELS = window.LEVELS || [];
  window.LEVELS.push({
    id: 'level10', name: 'Sunken Outpost', desc: '2 ทาง · เส้นทางทะเลทรายบรรจบกันก่อนถึงบ่อน้ำร้าง',
    LANES, BUILD_SPOTS, composeMap, allArtLoaded,
  });
})();
