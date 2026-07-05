// ===================== Level 8 — Ashen Canyon (single lane) =====================
(function () {
  const W = 1280, H = 720;
  const S = 0.58;
  const ROAD_THICK = 171 * S;
  const R_TURN = 170.5 * S;
  const CORNER_SIZE = 256 * S;

  const ROUTE = [
    [-80, 150], [980, 150], [980, 410], [240, 410], [240, 660], [1360, 660],
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

  function img(n) { const i = new Image(); i.src = `assets/ashencanyon/${n}.png`; return i; }
  const ART = {
    bg: img('main_bg'), dot: img('dot'),
    ridge: img('decor_13'), rockL: img('decor_14'), rockR: img('decor_15'),
    chest: img('decor_1'), torch: img('decor_2'), embers: img('decor_3'), bone: img('decor_4'),
    skull1: img('decor_8'), skull2: img('decor_9'),
    stone1: img('stone_1'), stone2: img('stone_2'), stone3: img('stone_3'),
    bush1: img('bush_1'), bush2: img('bush_2'),
    roads: {
      BL: img('road_2'), TL: img('road_4'), BR: img('road_1'), TR: img('road_3'),
      H: img('road_6'), V: img('road_5'),
    },
  };

  const BUILD_SPOTS = [
    [400, 42], [780, 42],
    [1150, 400], [1150, 500],
    [600, 280], [600, 535],
    [80, 280], [80, 580],
  ];

  // every position below verified clear of BOTH the road bands AND every
  // build pad (numerically, not by eye) -- see scratchpad verify_level8.js
  const TREE_SPOTS = []; // this pack has no tree art; bushes fill that role
  const BUSH_SPOTS = [
    [40, 78, 0.9, 'bush1'], [1250, 60, 0.8, 'bush2'], [1250, 280, 0.85, 'bush1'],
    [1230, 570, 0.7, 'bush2'], [40, 700, 0.9, 'bush1'], [1100, 300, 0.85, 'bush1'],
    [700, 585, 0.8, 'bush2'],
  ];
  const STONE_SPOTS = [
    [500, 78, 'stone1'], [900, 78, 'stone2'], [1240, 400, 'stone3'],
    [700, 320, 'stone1'], [500, 585, 'stone3'],
  ];
  const SKULL_SPOTS = [
    [300, 78, 'skull1'], [1250, 550, 'skull2'], [700, 78, 'skull1'],
  ];
  const BONE_SPOTS = [
    [800, 320, 0.9], [900, 585, 0.85],
  ];

  function allArtLoaded() {
    const list = [
      ART.bg, ART.dot, ART.ridge, ART.rockL, ART.rockR,
      ART.chest, ART.torch, ART.embers, ART.bone, ART.skull1, ART.skull2,
      ART.stone1, ART.stone2, ART.stone3, ART.bush1, ART.bush2,
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
      const w = ART.dot.naturalWidth * 0.75, h = ART.dot.naturalHeight * 0.75;
      m.drawImage(ART.dot, x - w / 2, y - h / 2, w, h);
    }
    // big rock landmarks tucked along the clear top strip above the first road
    // run and in the clear right column -- verified clear of every road band
    // (see scratchpad verify_level8.js), not just "mostly off-canvas" by eye.
    m.drawImage(ART.rockL, -90, -250, 407 * 0.5, 577 * 0.5);
    m.drawImage(ART.rockR, 1060, 30, 755 * 0.45, 450 * 0.45);
    m.drawImage(ART.ridge, 300, -95, 1888 * 0.2, 416 * 0.2);
    for (const [x, y, kind] of STONE_SPOTS) drawSprite(m, ART[kind], x, y, 0.9);
    for (const [x, y, kind] of SKULL_SPOTS) drawSprite(m, ART[kind], x, y, 1.0);
    for (const [x, y, sc] of BONE_SPOTS) drawSprite(m, ART.bone, x, y, sc);
    drawSprite(m, ART.chest, 1250, 300, 0.65);
    drawSprite(m, ART.torch, 150, 715, 0.5);
    drawSprite(m, ART.embers, 1200, 250, 0.5);
    for (const [x, y, sc, kind] of BUSH_SPOTS) drawSprite(m, ART[kind], x, y, sc);
  }

  window.LEVELS = window.LEVELS || [];
  window.LEVELS.push({
    id: 'level8', name: 'Ashen Canyon', desc: '1 ทาง · หุบเขาหินเถ้าถ่านคดโค้ง เส้นทางเดียว ระดับง่าย',
    LANES: [PATH], BUILD_SPOTS, composeMap, allArtLoaded,
  });
})();
