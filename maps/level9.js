// ===================== Level 9 — Forgotten Ruins (2 lanes merge toward exit) =====================
(function () {
  const W = 1280, H = 720;
  const S = 0.55;
  const LANE = 171 * S;      // drawn road strip thickness
  const K = 256 * S;         // drawn corner footprint (square)
  const R = 170.5 * S;       // centerline turn radius

  function img(n) { const i = new Image(); i.src = 'assets/ruins/' + n + '.png'; return i; }
  const ART = {
    bg: img('main_bg'), dot: img('dot'),
    tree1: img('tree_1'), tree2: img('tree_2'),
    stoneA: img('stone_4'), stoneB: img('stone_5'), stoneC: img('stone_2'),
    ruinBox: img('decor_1'), ruinWall: img('decor_2'), pillar: img('decor_6'),
    vine: img('decor_3'), log: img('decor_4'),
    bushA: img('bush_1'), bushB: img('bush_3'),
    // road pieces: road_1=BR corner, road_3=TR corner, road_5=straight-V, road_6=straight-H
    BR: img('road_1'), TR: img('road_3'), V: img('road_5'), H: img('road_6'),
  };

  // ---- route: two independent single-turn lanes converging toward the right exit ----
  // Lane A: enters top off-screen, turns TR-style at (380,300), exits right off-screen at y=300
  // Lane B: enters bottom off-screen, turns BR-style at (900,500), exits right off-screen at y=500
  const A_TURN = [380, 300];
  const B_TURN = [900, 500];

  function cornerAt(inD, outD, P) {
    const C = [P[0] + R * (outD[0] - inD[0]), P[1] + R * (outD[1] - inD[1])];
    const right = C[0] > P[0], below = C[1] > P[1];
    let im, x, y;
    if (!right && below)       { im = ART.BR /*unused*/; x = C[0];     y = C[1] - K; }
    else if (!right && !below) { im = ART.BR /*unused*/; x = C[0];     y = C[1];     }
    else if (right && below)   { im = ART.BR; x = C[0] - K; y = C[1] - K; }
    else                       { im = ART.TR; x = C[0] - K; y = C[1];     }
    return { im, x, y, C, inD, outD, P };
  }

  const aCorner = cornerAt([0, 1], [1, 0], A_TURN);   // down -> right => TR piece
  const bCorner = cornerAt([0, -1], [1, 0], B_TURN);  // up -> right => BR piece

  const BUILD_SPOTS = [
    [150, 100], [700, 90], [1150, 100],
    [150, 460], [150, 650],
    [960, 90], [1150, 680], [700, 680],
  ];

  function sprite(m, im, cx, bottomY, sc) {
    const w = im.naturalWidth * sc, h = im.naturalHeight * sc;
    m.drawImage(im, cx - w / 2, bottomY - h, w, h);
  }
  function straightH(m, x0, x1, y) {
    const top = y - LANE / 2; let x = x0;
    while (x < x1) {
      const wpx = Math.min(256 * S, x1 - x);
      m.drawImage(ART.H, 0, 0, wpx / S, 171, x, top, wpx, LANE);
      x += wpx;
    }
  }
  function straightV(m, y0, y1, x) {
    const left = x - LANE / 2; let y = y0;
    while (y < y1) {
      const hpx = Math.min(256 * S, y1 - y);
      m.drawImage(ART.V, 0, 0, 171, hpx / S, left, y, LANE, hpx);
      y += hpx;
    }
  }
  function drawCorner(m, c) { m.drawImage(c.im, c.x, c.y, K, K); }

  function allArtLoaded() { return Object.values(ART).every(im => im.complete && im.naturalWidth); }

  function composeMap(m) {
    m.drawImage(ART.bg, 0, 0, W, H);

    for (const [x, y] of BUILD_SPOTS) {
      const w = ART.dot.naturalWidth * 0.8, h = ART.dot.naturalHeight * 0.8;
      m.drawImage(ART.dot, x - w / 2, y - h / 2, w, h);
    }

    // Lane A: top off-screen down to turn, then right off-screen
    straightV(m, -40, aCorner.P[1] - R, A_TURN[0]);
    straightH(m, aCorner.P[0] + R - 3, 1360, A_TURN[1]);
    drawCorner(m, aCorner);

    // Lane B: bottom off-screen up to turn, then right off-screen
    straightV(m, bCorner.P[1] + R - 3, 760, B_TURN[0]);
    straightH(m, bCorner.P[0] + R - 3, 1360, B_TURN[1]);
    drawCorner(m, bCorner);

    // every position below verified clear of BOTH the road bands AND every
    // build pad (not by eye, see scratch/verify_level9.js) -- decor never
    // sits on the road or blocks a pad
    sprite(m, ART.ruinWall, 1250, 220, 0.32);
    sprite(m, ART.ruinBox, 1250, 780, 0.30);
    sprite(m, ART.pillar, 100, 300, 0.4);
    sprite(m, ART.pillar, 1330, 700, 0.4);

    sprite(m, ART.tree1, 60, 500, 0.5);
    sprite(m, ART.tree2, 250, 700, 0.42);
    sprite(m, ART.tree1, 1330, 60, 0.35);
    sprite(m, ART.tree2, 40, 700, 0.45);
    sprite(m, ART.tree2, 500, 700, 0.45);

    sprite(m, ART.stoneA, 250, 300, 0.45);
    sprite(m, ART.stoneB, 1330, 600, 0.35);
    sprite(m, ART.stoneC, 200, 55, 0.55);

    sprite(m, ART.vine, 240, 430, 0.4);
    sprite(m, ART.log, 1030, 700, 0.4);

    sprite(m, ART.bushA, 320, 700, 0.5);
    sprite(m, ART.bushB, 1330, 200, 0.5);
    sprite(m, ART.bushB, 60, 200, 0.55);
  }

  // ---- enemy walk lanes ----
  function turnArc(pts, c, r, steps = 8) {
    const Astart = [c.P[0] - r * c.inD[0], c.P[1] - r * c.inD[1]];
    const Bend = [c.P[0] + r * c.outD[0], c.P[1] + r * c.outD[1]];
    const a0 = Math.atan2(Astart[1] - c.C[1], Astart[0] - c.C[0]);
    const a1 = Math.atan2(Bend[1] - c.C[1], Bend[0] - c.C[0]);
    let d = a1 - a0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    for (let k = 1; k <= steps; k++) { const a = a0 + d * (k / steps); pts.push([c.C[0] + r * Math.cos(a), c.C[1] + r * Math.sin(a)]); }
  }
  function buildLanes() {
    const laneA = [[A_TURN[0], -60], [A_TURN[0], aCorner.P[1] - R]];
    turnArc(laneA, aCorner, R);
    laneA.push([1360, A_TURN[1]]);

    const laneB = [[B_TURN[0], 780], [B_TURN[0], bCorner.P[1] + R]];
    turnArc(laneB, bCorner, R);
    laneB.push([1360, B_TURN[1]]);

    return [laneA, laneB];
  }
  const LANES = buildLanes();

  window.LEVELS = window.LEVELS || [];
  window.LEVELS.push({
    id: 'level9', name: 'Forgotten Ruins',
    desc: 'ซากปรักหักพังโบราณ · 2 ทางบรรจบสู่ทางออกเดียว',
    LANES, BUILD_SPOTS, composeMap, allArtLoaded,
  });
})();
