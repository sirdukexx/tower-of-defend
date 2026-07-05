// ===================== Level 6 — Bone Wastes (single lane) =====================
(function () {
  const W = 1280, H = 720;
  const S = 0.58;
  const ROAD_THICK = 171 * S;
  const R_TURN = 170.5 * S;
  const CORNER_SIZE = 256 * S;

  const ROUTE = [
    [-80, 130], [540, 130], [540, 410], [190, 410], [190, 650], [920, 650], [920, 270], [1360, 270],
  ];

  function unitDir(a, b) { return [Math.sign(b[0] - a[0]), Math.sign(b[1] - a[1])]; }

  function buildRoundedPath() {
    const pts = [ROUTE[0].slice()];
    for (let i = 1; i < ROUTE.length - 1; i++) {
      const P = ROUTE[i];
      const din = unitDir(ROUTE[i - 1], P), dout = unitDir(P, ROUTE[i + 1]);
      const C = [P[0] + R_TURN * (dout[0] - din[0]), P[1] + R_TURN * (dout[1] - din[1])];
      const A = [P[0] - R_TURN * din[0], P[1] - R_TURN * din[1]];
      const B = [P[0] + R_TURN * dout[0], P[1] + R_TURN * dout[1]];
      const a0 = Math.atan2(A[1] - C[1], A[0] - C[0]);
      const a1 = Math.atan2(B[1] - C[1], B[0] - C[0]);
      let d = a1 - a0;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      const STEPS = 7;
      for (let k = 0; k <= STEPS; k++) {
        const a = a0 + d * (k / STEPS);
        pts.push([C[0] + R_TURN * Math.cos(a), C[1] + R_TURN * Math.sin(a)]);
      }
    }
    pts.push(ROUTE[ROUTE.length - 1].slice());
    return pts;
  }
  const PATH = buildRoundedPath();

  function img(n) { const i = new Image(); i.src = `assets/bonewastes/${n}.png`; return i; }
  const ART = {
    bg: img('main_bg'), dot: img('dot'),
    cave: img('decor_11'), cliff: img('decor_10'),
    tent: img('decor_1'), hut: img('decor_2'),
    horns: img('decor_5'), grave: img('decor_6'), campfire: img('decor_3'),
    tree1: img('tree_1'), tree2: img('tree_2'), tree3: img('tree_3'),
    stone1: img('stone_1'), stone2: img('stone_2'), stone4: img('stone_4'), stone5: img('stone_5'),
    bush1: img('bush_1'), bush3: img('bush_3'),
    roads: {
      BL: img('road_2'), TL: img('road_4'), BR: img('road_1'), TR: img('road_3'),
      H: img('road_6'), V: img('road_5'),
    },
  };

  // 8 build pads, spread across the map, each numerically verified clear of
  // every road band (16px keepout) and every other pad (42px exclusion).
  const BUILD_SPOTS = [
    [280, 260], [1000, 60], [700, 240], [60, 260],
    [60, 620], [650, 505], [1150, 460], [1150, 650],
  ];

  // every position below verified clear of BOTH the road/corner bands AND
  // every build pad (not by eye) -- decor must never sit on the road or
  // block a tower spot; positions resolved with the skill's
  // resolvePlacements()/nearestSafe() helpers, zero violations confirmed.
  const TREE1_SPOTS = [
    [160, 344, 0.6], [1056, 612, 0.6], [380, 40, 0.6], [797, 533, 0.6],
  ];
  const TREE2_SPOTS = [
    [48, 443, 0.55], [1260, 150, 0.55], [665, 461, 0.55], [806, 381, 0.55],
  ];
  const TREE3_SPOTS = [
    [1260, 470, 0.5], [70, 578, 0.5], [820, 190, 0.5],
  ];
  const STONE1_SPOTS = [[650, 30], [1061, 378], [350, 540]];
  const STONE2_SPOTS = [[1139, 387], [402, 560], [395, 253]];
  const STONE4_SPOTS = [[1190, 202]];
  const STONE5_SPOTS = [[381, 306]];
  const BUSH1_SPOTS = [[850, 30], [1100, 150], [458, 573], [516, 568]];
  const BUSH3_SPOTS = [[756, 332], [593, 584], [1206, 531]];

  function allArtLoaded() {
    const list = [
      ART.bg, ART.dot, ART.cave, ART.cliff, ART.tent, ART.hut,
      ART.horns, ART.grave, ART.campfire,
      ART.tree1, ART.tree2, ART.tree3,
      ART.stone1, ART.stone2, ART.stone4, ART.stone5,
      ART.bush1, ART.bush3,
      ART.roads.BL, ART.roads.TL, ART.roads.BR, ART.roads.TR, ART.roads.H, ART.roads.V,
    ];
    return list.every(im => im.complete && im.naturalWidth);
  }

  function drawSprite(m, im, cx, bottomY, scale) {
    const w = im.naturalWidth * scale, h = im.naturalHeight * scale;
    m.drawImage(im, cx - w / 2, bottomY - h, w, h);
  }
  function tileRoadH(m, x0, x1, midY) {
    const top = midY - ROAD_THICK / 2; let x = x0;
    while (x < x1) { const wPx = Math.min(256 * S, x1 - x);
      m.drawImage(ART.roads.H, 0, 0, wPx / S, 171, x, top, wPx, ROAD_THICK); x += wPx; }
  }
  function tileRoadV(m, y0, y1, midX) {
    const left = midX - ROAD_THICK / 2; let y = y0;
    while (y < y1) { const hPx = Math.min(256 * S, y1 - y);
      m.drawImage(ART.roads.V, 0, 0, 171, hPx / S, left, y, ROAD_THICK, hPx); y += hPx; }
  }
  function drawRoadPieces(m) {
    for (let i = 0; i < ROUTE.length - 1; i++) {
      const a = ROUTE[i], b = ROUTE[i + 1];
      const startTrim = i > 0 ? R_TURN : 0;
      const endTrim = i < ROUTE.length - 2 ? R_TURN : 0;
      if (a[1] === b[1]) {
        const lo = Math.min(a[0], b[0]), hi = Math.max(a[0], b[0]);
        const trimLo = a[0] < b[0] ? startTrim : endTrim;
        const trimHi = a[0] < b[0] ? endTrim : startTrim;
        tileRoadH(m, lo + trimLo, hi - trimHi, a[1]);
      } else {
        const lo = Math.min(a[1], b[1]), hi = Math.max(a[1], b[1]);
        const trimLo = a[1] < b[1] ? startTrim : endTrim;
        const trimHi = a[1] < b[1] ? endTrim : startTrim;
        tileRoadV(m, lo + trimLo, hi - trimHi, a[0]);
      }
    }
    for (let i = 1; i < ROUTE.length - 1; i++) {
      const P = ROUTE[i];
      const din = unitDir(ROUTE[i - 1], P), dout = unitDir(P, ROUTE[i + 1]);
      const C = [P[0] + R_TURN * (dout[0] - din[0]), P[1] + R_TURN * (dout[1] - din[1])];
      const right = C[0] > P[0], below = C[1] > P[1];
      let im, dx, dy;
      if (!right && below)       { im = ART.roads.BL; dx = 0; dy = -CORNER_SIZE; }
      else if (!right && !below) { im = ART.roads.TL; dx = 0; dy = 0; }
      else if (right && below)   { im = ART.roads.BR; dx = -CORNER_SIZE; dy = -CORNER_SIZE; }
      else                       { im = ART.roads.TR; dx = -CORNER_SIZE; dy = 0; }
      m.drawImage(im, C[0] + dx, C[1] + dy, CORNER_SIZE, CORNER_SIZE);
    }
  }

  function composeMap(m) {
    m.drawImage(ART.bg, 0, 0, W, H);
    drawRoadPieces(m);
    for (const [x, y] of BUILD_SPOTS) {
      const w = ART.dot.naturalWidth * 0.55, h = ART.dot.naturalHeight * 0.55;
      m.drawImage(ART.dot, x - w / 2, y - h / 2, w, h);
    }
    // cliff wedge, bottom-left, mostly off-canvas
    const cliffScale = 0.4;
    m.drawImage(ART.cliff, -60, 480 - ART.cliff.naturalHeight * cliffScale,
      ART.cliff.naturalWidth * cliffScale, ART.cliff.naturalHeight * cliffScale);
    // cave mouth landmark near the route's exit, top-right, partially off-canvas
    const caveScale = 0.4;
    m.drawImage(ART.cave, 1300, -20, ART.cave.naturalWidth * caveScale, ART.cave.naturalHeight * caveScale);

    for (const [x, y] of STONE1_SPOTS) drawSprite(m, ART.stone1, x, y, 0.8);
    for (const [x, y] of STONE2_SPOTS) drawSprite(m, ART.stone2, x, y, 0.8);
    for (const [x, y] of STONE4_SPOTS) drawSprite(m, ART.stone4, x, y, 0.5);
    for (const [x, y] of STONE5_SPOTS) drawSprite(m, ART.stone5, x, y, 0.55);
    for (const [x, y] of BUSH1_SPOTS) drawSprite(m, ART.bush1, x, y, 0.6);
    for (const [x, y] of BUSH3_SPOTS) drawSprite(m, ART.bush3, x, y, 0.7);

    drawSprite(m, ART.hut, 80, 30, 0.42);
    drawSprite(m, ART.tent, 1216, 608, 0.5);
    drawSprite(m, ART.grave, 1133, 203, 0.55);
    drawSprite(m, ART.horns, 781, 583, 0.6);
    drawSprite(m, ART.campfire, 733, 435, 0.5);

    for (const [x, y, sc] of TREE1_SPOTS) drawSprite(m, ART.tree1, x, y, sc);
    for (const [x, y, sc] of TREE2_SPOTS) drawSprite(m, ART.tree2, x, y, sc);
    for (const [x, y, sc] of TREE3_SPOTS) drawSprite(m, ART.tree3, x, y, sc);
  }

  window.LEVELS = window.LEVELS || [];
  window.LEVELS.push({
    id: 'level6', name: 'Bone Wastes', desc: '1 ทาง · เส้นทางเดี่ยวคดเคี้ยวผ่านทะเลทรายกระดูกสู่ปากถ้ำ',
    LANES: [PATH], BUILD_SPOTS, composeMap, allArtLoaded,
  });
})();
