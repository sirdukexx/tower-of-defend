// ===================== Level 12 — Jungle Huts (single lane) =====================
// NOTE: this layer pack (game_background_1, tropical jungle) has NO road
// straight/corner pieces (confirmed via inspect_layers.py -- only ground,
// lake, hut, tree, bush, stone, campfire, dot decor). Per SKILL.md's
// sanctioned fallback, the road is drawn procedurally as a thick rounded
// dirt-colored stroke instead of tiled art.
(function () {
  const W = 1280, H = 720;
  const R_TURN = 70;            // procedural turn radius
  const ROAD_THICK = 92;        // drawn dirt-path thickness

  const ROUTE = [
    [-80, 150], [850, 150], [850, 330], [220, 330], [220, 520], [1100, 520], [1100, 800],
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

  function img(n) { const i = new Image(); i.src = `assets/jungle/${n}.png`; return i; }
  const ART = {
    bg: img('main_bg'), land: img('land'), lake: img('lake'),
    hut: img('decor_2'), campfire: img('decor_3'), stump: img('decor_4'), pot: img('decor_5'),
    dirt: img('decor_1'), dot: img('dot'), stone: img('stone'),
    tree1: img('tree_1'), tree2: img('tree_2'),
    bush1: img('bush_1'), bush2: img('bush_2'), bush3: img('bush_3'),
  };

  const BUILD_SPOTS = [
    [400, 40], [700, 40],
    [1050, 130], [1200, 340],
    [60, 620], [508, 624],
    [858, 624], [1204, 657],
  ];

  // every position below verified clear of BOTH the road band AND every
  // build pad via scratch/level12/verify_placements.js (numeric check, not eyeballed)
  const TREE_SPOTS = [
    [40, 60, 0.6, 'tree1'], [1240, 60, 0.55, 'tree2'],
    [1097, 422, 0.6, 'tree1'], [1150, 250, 0.5, 'tree2'],
    [67, 379, 0.6, 'tree1'], [153, 712, 0.45, 'tree2'],
    [988, 421, 0.55, 'tree1'], [626, 690, 0.5, 'tree2'],
    [346, 715, 0.4, 'tree1'], [994, 715, 0.4, 'tree2'],
    [61, 518, 0.5, 'tree1'],
  ];
  const BUSH_SPOTS = [
    [253, 695, 0.85, 'bush1'], [1236, 160, 0.8, 'bush2'], [750, 663, 0.85, 'bush1'],
    [1258, 709, 0.8, 'bush3'], [94, 574, 0.8, 'bush2'], [604, 84, 0.8, 'bush1'],
  ];
  const STONE_SPOTS = [
    [1058, 254, 0.75], [66, 707, 0.75], [722, 708, 0.75],
  ];

  function allArtLoaded() {
    const list = [
      ART.bg, ART.land, ART.lake, ART.hut, ART.campfire, ART.stump, ART.pot,
      ART.dirt, ART.dot, ART.stone, ART.tree1, ART.tree2, ART.bush1, ART.bush2, ART.bush3,
    ];
    return list.every(im => im.complete && im.naturalWidth);
  }

  function drawSprite(m, im, cx, bottomY, scale) {
    const w = im.naturalWidth * scale, h = im.naturalHeight * scale;
    m.drawImage(im, cx - w / 2, bottomY - h, w, h);
  }

  function drawRoad(m) {
    m.save();
    m.lineJoin = 'round';
    m.lineCap = 'round';
    // dark edge outline
    m.strokeStyle = '#5b4326';
    m.lineWidth = ROAD_THICK + 14;
    m.beginPath();
    m.moveTo(PATH[0][0], PATH[0][1]);
    for (let i = 1; i < PATH.length; i++) m.lineTo(PATH[i][0], PATH[i][1]);
    m.stroke();
    // dirt fill
    m.strokeStyle = '#c99a5b';
    m.lineWidth = ROAD_THICK;
    m.stroke();
    // lighter center tread
    m.strokeStyle = '#d9b077';
    m.lineWidth = ROAD_THICK * 0.5;
    m.stroke();
    m.restore();
  }

  function composeMap(m) {
    m.drawImage(ART.bg, 0, 0, W, H);
    // flat dirt patches tuck under the road/pads
    m.save(); m.globalAlpha = 0.85; m.drawImage(ART.dirt, 980, -40, 340, 240); m.restore();
    drawRoad(m);
    for (const [x, y] of BUILD_SPOTS) {
      const w = ART.dot.naturalWidth * 0.75, h = ART.dot.naturalHeight * 0.75;
      m.drawImage(ART.dot, x - w / 2, y - h / 2, w, h);
    }
    // lake tucked in the top-right pocket, clear of the road
    m.drawImage(ART.lake, 900, 10, 562 * 0.62, 216 * 0.62);
    for (const [x, y, sc] of STONE_SPOTS) drawSprite(m, ART.stone, x, y, sc);
    drawSprite(m, ART.campfire, 938, 689, 0.7);
    drawSprite(m, ART.stump, 400, 250, 0.9);
    drawSprite(m, ART.pot, 998, 626, 0.9);
    // hut = the base the player defends, near the route's exit
    drawSprite(m, ART.hut, 1226, 615, 0.62);
    for (const [x, y, sc, key] of BUSH_SPOTS) drawSprite(m, ART[key], x, y, sc);
    for (const [x, y, sc, key] of TREE_SPOTS) drawSprite(m, ART[key], x, y, sc);
  }

  window.LEVELS = window.LEVELS || [];
  window.LEVELS.push({
    id: 'level12', name: 'Jungle Huts', desc: '1 ทาง · เส้นทางเดี่ยวคดโค้งผ่านหมู่บ้านกลางป่าดงดิบ',
    LANES: [PATH], BUILD_SPOTS, composeMap, allArtLoaded,
  });
})();
