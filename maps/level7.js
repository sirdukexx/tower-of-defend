// ===================== Level 7 — Crystal Cavern (2 lanes, dogleg -> Y-merge -> shared tail) =====================
(function () {
  const W = 1280, H = 720;
  const S = 0.55;
  const LANE = 171 * S;
  const K = 256 * S;
  const R = 170.5 * S;
  const M_W = 341 * S, M_H = 260 * S;
  const M_TOPX = 171 * S;   // local x-offset: top-arm centerline from junction's left edge
  const M_SIDEY = 168 * S;  // local y-offset: left/right-arm centerline from junction's top edge

  function img(n) { const i = new Image(); i.src = 'assets/crystalcavern/' + n + '.png'; return i; }
  const ART = {
    bg: img('main_bg'),
    crystalPink: img('decor_2'), crystalGreen: img('decor_3'), crystalOrange: img('decor_4'),
    crystalBlue: img('decor_5'), crystalRed: img('decor_6'),
    mushroomRed: img('decor_14'), mushroomBlue: img('decor_15'),
    coilTeal: img('decor_10'), coilOlive: img('decor_11'),
    stoneA: img('stone_1'), stoneB: img('stone_4'),
    dot: img('dot'),
    BR: img('road_1'), BL: img('road_2'), TR: img('road_3'), TL: img('road_4'),
    H: img('road_6'), V: img('road_5'), merge: img('road_9'),
  };

  // cornerAt: same proven formula as level4.js (SKILL.md Step 3)
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

  // ---- route geometry ----
  const A_TOP_Y = 130, A_TURN_X = 220;
  const B_TOP_Y = 160, B_TURN_X = 940;
  const JX = 470, JY = 340;
  const LEFT_ARM_Y = JY + M_SIDEY;   // 432.4 - both lane A and lane B feed the junction at this height
  const TOP_ARM_X = JX + M_TOPX;     // 564.05 - merged tail exits north from here
  const TAIL_TURN_Y = 90, EXIT_TURN_X = 1080, EXIT_Y = 760;

  const aTurn1 = cornerAt([1, 0], [0, 1], [A_TURN_X, A_TOP_Y]);
  const aTurn2 = cornerAt([0, 1], [1, 0], [A_TURN_X, LEFT_ARM_Y]);
  const bTurn1 = cornerAt([-1, 0], [0, 1], [B_TURN_X, B_TOP_Y]);
  const bTurn2 = cornerAt([0, 1], [-1, 0], [B_TURN_X, LEFT_ARM_Y]);
  const tTurn1 = cornerAt([0, -1], [1, 0], [TOP_ARM_X, TAIL_TURN_Y]);
  const tTurn2 = cornerAt([1, 0], [0, 1], [EXIT_TURN_X, TAIL_TURN_Y]);

  const BUILD_SPOTS = [
    [340, 40], [1200, 40], [40, 240], [1200, 280],
    [40, 400], [720, 540], [1200, 600], [200, 680],
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

    // build pads first (flat patches tuck under nothing, but draw before road-adjacent decor)
    for (const [x, y] of BUILD_SPOTS) {
      const w = ART.dot.naturalWidth * 0.8, h = ART.dot.naturalHeight * 0.8;
      m.drawImage(ART.dot, x - w / 2, y - h / 2, w, h);
    }

    // straights
    straightH(m, -40, A_TURN_X - R + 3, A_TOP_Y);
    straightV(m, A_TOP_Y + R - 3, LEFT_ARM_Y - R + 3, A_TURN_X);
    straightH(m, A_TURN_X + R - 3, JX + 5, LEFT_ARM_Y);
    straightH(m, B_TURN_X + R - 3, 1320, B_TOP_Y);
    straightV(m, B_TOP_Y + R - 3, LEFT_ARM_Y - R + 3, B_TURN_X);
    straightH(m, JX + M_W - 5, B_TURN_X - R + 3, LEFT_ARM_Y);
    straightV(m, JY - R + 3, TAIL_TURN_Y + R - 3, TOP_ARM_X);
    straightH(m, TOP_ARM_X + R - 3, EXIT_TURN_X - R + 3, TAIL_TURN_Y);
    straightV(m, TAIL_TURN_Y + R - 3, EXIT_Y, EXIT_TURN_X);

    m.drawImage(ART.merge, JX, JY, M_W, M_H);
    for (const c of [aTurn1, aTurn2, bTurn1, bTurn2, tTurn1, tTurn2]) {
      m.drawImage(c.im, c.x, c.y, K, K);
    }

    // every position below verified clear of BOTH the road/junction bands
    // AND every build pad (numeric check, not by eye) -- see scratch
    // placement-check.js run during authoring; zero violations confirmed.
    const crystals = [
      [720, 280], [409, 369], [777, 710], [1204, 555], [78, 572], [965, 620],
    ];
    const crystalArt = [ART.crystalPink, ART.crystalGreen, ART.crystalOrange, ART.crystalBlue, ART.crystalRed];
    crystals.forEach(([x, y], i) => sprite(m, crystalArt[i % crystalArt.length], x, y, 0.5));

    const mushrooms = [[315, 173], [640, 700], [1175, 424], [129, 708]];
    mushrooms.forEach(([x, y], i) => sprite(m, (i % 2 === 0 ? ART.mushroomRed : ART.mushroomBlue), x, y, 0.42));

    const coils = [[460, 240], [889, 696], [838, 292]];
    coils.forEach(([x, y], i) => sprite(m, (i % 2 === 0 ? ART.coilTeal : ART.coilOlive), x, y, 0.38));

    const stones = [[766, 334], [520, 690], [1233, 397]];
    stones.forEach(([x, y], i) => sprite(m, (i % 2 === 0 ? ART.stoneA : ART.stoneB), x, y, 0.45));
  }

  // ---- enemy walk lanes (A: west dogleg, B: east dogleg -> Y-merge -> shared tail) ----
  function turnArc(pts, c, r, steps = 8) {
    const A = [c.P[0] - r * c.inD[0], c.P[1] - r * c.inD[1]];
    const B = [c.P[0] + r * c.outD[0], c.P[1] + r * c.outD[1]];
    const a0 = Math.atan2(A[1] - c.C[1], A[0] - c.C[0]), a1 = Math.atan2(B[1] - c.C[1], B[0] - c.C[0]);
    let d = a1 - a0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    for (let k = 1; k <= steps; k++) { const a = a0 + d * (k / steps); pts.push([c.C[0] + r * Math.cos(a), c.C[1] + r * Math.sin(a)]); }
  }
  function downstreamFromMerge(pts) {
    pts.push([TOP_ARM_X, TAIL_TURN_Y + R]);
    turnArc(pts, tTurn1, R);
    pts.push([EXIT_TURN_X - R, TAIL_TURN_Y]);
    turnArc(pts, tTurn2, R);
    pts.push([EXIT_TURN_X, EXIT_Y]);
  }
  function buildLanes() {
    const rY = 38;
    // Lane A: west entry -> dogleg down -> into junction's LEFT arm -> merge -> tail
    const A = [[-40, A_TOP_Y], [A_TURN_X - R, A_TOP_Y]];
    turnArc(A, aTurn1, R);
    A.push([A_TURN_X, LEFT_ARM_Y - R]);
    turnArc(A, aTurn2, R);
    A.push([JX + rY, LEFT_ARM_Y]);
    turnArc(A, { P: [TOP_ARM_X, LEFT_ARM_Y], C: [TOP_ARM_X, LEFT_ARM_Y - rY], inD: [1, 0], outD: [0, -1] }, rY);
    downstreamFromMerge(A);

    // Lane B: east entry -> dogleg down -> into junction's RIGHT arm -> merge -> tail
    const B = [[1320, B_TOP_Y], [B_TURN_X + R, B_TOP_Y]];
    turnArc(B, bTurn1, R);
    B.push([B_TURN_X, LEFT_ARM_Y - R]);
    turnArc(B, bTurn2, R);
    B.push([JX + M_W - rY, LEFT_ARM_Y]);
    turnArc(B, { P: [TOP_ARM_X, LEFT_ARM_Y], C: [TOP_ARM_X, LEFT_ARM_Y - rY], inD: [-1, 0], outD: [0, -1] }, rY);
    downstreamFromMerge(B);

    return [A, B];
  }
  const LANES = buildLanes();

  window.LEVELS = window.LEVELS || [];
  window.LEVELS.push({
    id: 'level7', name: 'Crystal Cavern',
    desc: '2 ทาง · ถ้ำคริสตัลเรืองแสง หักมุมสองฝั่งก่อนมารวมเป็นทางเดียว',
    LANES, BUILD_SPOTS, composeMap, allArtLoaded,
  });
})();
