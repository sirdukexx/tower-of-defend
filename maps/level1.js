// ===================== Level 1 — Winter Village (single lane) =====================
(function () {
  const W = 1280, H = 720;
  const S = 0.58;
  const ROAD_THICK = 171 * S;
  const R_TURN = 170.5 * S;
  const CORNER_SIZE = 256 * S;

  const ROUTE = [
    [-80, 220], [1080, 220], [1080, 460], [400, 460], [400, 660], [1360, 660],
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

  function img(n) { const i = new Image(); i.src = `assets/winter/${n}.png`; return i; }
  const ART = {
    bg: img('main_bg'), mountains: img('mountains'), tree: img('tree'),
    stone: img('stone'), dot: img('dot'),
    cabin: img('decor_3'), ruinRound: img('decor_1'), ruinSquare: img('decor_2'),
    roads: {
      BL: img('road_2'), TL: img('road_4'), BR: img('road_1'), TR: img('road_3'),
      H: img('road_5'), V: img('road_6'),
    },
  };

  const BUILD_SPOTS = [
    [500, 120], [850, 120],
    [300, 330], [540, 330], [760, 340], [960, 340],
    [1200, 430],
    [300, 570], [560, 570], [820, 570],
  ];
  // every position below verified clear of BOTH the road/junction bands AND
  // every build pad (not by eye) -- decor must never sit on the road or
  // block a tower spot
  const TREE_SPOTS = [
    [330, 150, 0.6], [700, 150, 0.6], [985, 129, 0.55],
    [1204, 160, 0.6], [1141, 129, 0.55], [1231, 392, 0.55],
    [105, 386, 0.6], [173, 392, 0.65], [274, 478, 0.6],
    [45, 601, 0.6], [50, 499, 0.65], [236, 707, 0.6],
    [864, 392, 0.55],
  ];
  const STONE_SPOTS = [
    [441, 324], [920, 146], [1044, 125], [150, 470], [678, 594], [1015, 588],
  ];

  function allArtLoaded() {
    const list = [
      ART.bg, ART.mountains, ART.tree, ART.stone, ART.dot,
      ART.cabin, ART.ruinRound, ART.ruinSquare,
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
      const w = ART.dot.naturalWidth * 0.8, h = ART.dot.naturalHeight * 0.8;
      m.drawImage(ART.dot, x - w / 2, y - h / 2, w, h);
    }
    m.drawImage(ART.mountains, -50, -66, 778 * 0.36, 657 * 0.36);
    for (const [x, y] of STONE_SPOTS) drawSprite(m, ART.stone, x, y, 0.7);
    drawSprite(m, ART.ruinRound, 1215, 300, 0.55);
    drawSprite(m, ART.ruinSquare, 140, 668, 0.55);
    drawSprite(m, ART.cabin, 1200, 592, 0.25); // shrunk to fit clear of the busy exit pads
    for (const [x, y, sc] of TREE_SPOTS) drawSprite(m, ART.tree, x, y, sc);
  }

  window.LEVELS = window.LEVELS || [];
  window.LEVELS.push({
    id: 'level1', name: 'Winter Village', desc: '1 ทาง · เส้นทางเดี่ยวคดโค้งผ่านหน้าผาหิมะ',
    LANES: [PATH], BUILD_SPOTS, composeMap, allArtLoaded,
  });
})();
