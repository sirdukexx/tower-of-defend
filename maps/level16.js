// ===================== Level 16 — Longhorn Loop (pre-made background) =====================
// Unlike levels 1-15 (composed at runtime from road/decor layer pieces), this
// level uses the kit's FINISHED painting `game_background_2.png` from
// tower-defense-game-tilesets as-is. The walk lanes below were traced off the
// painted road with a flood-fill road mask + centerline scans (not by eye).
// Build spots are the painting's OWN pad patches: the artist drew them as
// flat sand blobs in a distinct color (209,166,105) vs the road (226,191,129)
// -- detected as connected components of that exact tone, filtered to
// realistic patch sizes (3k-12k px; two huge same-tone ground-gradient blobs
// were false positives), giving 13 pads. The 14th patch, under the bull
// skull, is deliberately excluded (a structure occupies it). No dot.png is
// drawn -- the pads are already part of the painting.
(function () {
  const W = 1280, H = 720;
  const SC = W / 1920; // source art is 1920x1080 -> canvas 1280x720

  function img(n) { const i = new Image(); i.src = 'assets/longhorn/' + n + '.png'; return i; }
  const ART = { bg: img('main_bg') };

  // Lane A: upper-left entry -> horseshoe loop over the top -> right side ->
  // bottom road back left -> exits south. Lane B: lower-left entry -> joins
  // the bottom road just before the exit stub.
  const LANE_A_SRC = [
    [-60, 320], [100, 350], [250, 375], [400, 425], [550, 430], [700, 435], [850, 445],
    [930, 420], [950, 380], [975, 330], [995, 280], [1005, 230], [1030, 170], [1070, 120],
    [1120, 100], [1170, 95], [1230, 110], [1270, 140], [1295, 190], [1320, 250], [1340, 300],
    [1370, 345], [1420, 385], [1490, 430], [1570, 465], [1640, 500], [1680, 530], [1695, 570],
    [1685, 610], [1655, 660], [1615, 705], [1570, 745], [1480, 770], [1380, 775], [1280, 768],
    [1200, 760], [1140, 800], [1060, 840], [960, 850], [860, 845], [760, 865], [650, 875],
    [560, 880], [500, 900], [480, 950], [472, 1010], [475, 1080], [475, 1140],
  ];
  const LANE_B_SRC = [
    [-60, 530], [60, 540], [110, 610], [160, 690], [200, 760], [260, 830], [340, 870],
    [430, 890], [470, 940], [472, 1010], [475, 1080], [475, 1140],
  ];
  const scalePts = pts => pts.map(([x, y]) => [x * SC, y * SC]);
  const LANES = [scalePts(LANE_A_SRC), scalePts(LANE_B_SRC)];

  // canvas coords -- centroids of the painting's built-in pad patches.
  // Each of these 8 was verified by cropping the source art around it and
  // confirming a real drawn patch sits there: the color-only component scan
  // initially returned 13, but 5 were ground-tone-boundary false positives
  // (gradient bands between the two ground tones share the patch color) --
  // the user caught those, and crop inspection confirmed all 5 had no patch.
  const BUILD_SPOTS = [
    [105, 140], [508, 189], [774, 170], [1007, 189],
    [974, 399], [217, 469], [830, 607], [453, 658],
  ];

  function allArtLoaded() { return Object.values(ART).every(im => im.complete && im.naturalWidth); }

  function composeMap(m) {
    m.drawImage(ART.bg, 0, 0, W, H);
    // no pad art drawn: the painting already contains its own pad patches
  }

  window.LEVELS = window.LEVELS || [];
  window.LEVELS.push({
    id: 'level16', name: 'Longhorn Loop', desc: '2 ทาง · ทางอ้อมวงเกือกม้ากลางทะเลทรายคาวบอย',
    LANES, BUILD_SPOTS, composeMap, allArtLoaded,
  });
})();
