// ===================== Level 18 — Bonecave Hollow (pre-made background) =====================
// Pre-made painting `td-tileset3/PNG/game_background_3/game_background_3.png`
// (dark cave/canyon theme: gray cliffs, bones, torches, skulls, a cave mouth).
// Built with the [[premade-map-trace]] recipe. Notes specific to this map:
//  - The road tone (~121,125,114) is NEARLY IDENTICAL to the pad-splotch tone
//    (~117,122,114) and to the gray cliff rock, so a plain color threshold
//    can't separate them. Flood-fill from the edge entries isolates the road
//    (the cliffs/splotches are disconnected islands), and pads were found as
//    LIGHT components NOT in the road mask, then crop-verified (10 of 15
//    color-matched blobs were cliff-top rock / campfire smoke / torches, not
//    real pads -- discarded).
//  - Road topology is a double Y: a left-edge base trunk that forks at a main
//    junction (~1041,667) into an upper-right spawn (right edge) and, via a
//    second junction (~1231,914), a bottom-edge spawn. Modeled as 2 lanes that
//    both merge onto the shared trunk and exit off-canvas at the left base.
//  - Centerlines were extracted from the skeleton (skan) of the cleaned mask,
//    smoothed and decimated, so every waypoint rides the true road center
//    (standing rule: monsters always walk the middle of the road). Both lanes
//    end OFF-CANVAS at the left base so enemies never vanish mid-map.
(function () {
  const W = 1280, H = 720;
  const SC = W / 1920;

  function img(n) { const i = new Image(); i.src = 'assets/cavern/' + n + '.png'; return i; }
  const ART = { bg: img('main_bg') };

  const LANE_A_SRC = [[1960, 380], [1876.0, 393.0], [1839.0, 385.7], [1809.0, 361.9], [1779.0, 337.4], [1743.0, 324.4], [1705.0, 319.3], [1667.0, 317.0], [1629.0, 315.0], [1591.0, 316.0], [1553.0, 316.0], [1514.0, 316.0], [1476.0, 317.0], [1438.0, 319.0], [1400.0, 323.6], [1364.0, 335.0], [1333.0, 357.2], [1305.2, 384.0], [1286.3, 417.0], [1274.7, 454.0], [1269.1, 492.0], [1263.2, 530.0], [1250.0, 566.0], [1229.4, 598.9], [1200.0, 623.4], [1167.0, 642.3], [1130.0, 652.9], [1092.0, 657.7], [1054.0, 664.1], [1041.0, 667.0], [1011.0, 644.4], [982.2, 618.6], [951.0, 596.7], [916.0, 581.6], [878.0, 575.9], [840.0, 573.0], [802.0, 572.0], [764.0, 573.0], [726.0, 570.2], [688.0, 563.3], [654.8, 548.1], [624.0, 524.0], [592.0, 504.1], [555.0, 495.0], [517.0, 490.3], [479.0, 490.0], [441.0, 489.0], [403.0, 489.0], [365.0, 489.0], [327.0, 489.1], [289.0, 489.0], [251.0, 486.0], [213.0, 479.1], [178.0, 462.4], [147.8, 439.6], [124.7, 409.0], [109.1, 374.0], [102.3, 336.0], [94.7, 298.0], [86.9, 261.0], [70.6, 227.0], [47.0, 196.3], [27.3, 164.0], [12.1, 129.0], [0.0, 107.0], [-60, 60]];
  const LANE_B_SRC = [[1700, 1140], [1671.0, 1067.0], [1640.0, 1045.6], [1618.0, 1016.0], [1598.1, 983.0], [1573.9, 953.4], [1541.0, 932.9], [1505.0, 920.2], [1467.0, 914.0], [1429.0, 913.0], [1391.0, 913.0], [1353.0, 913.0], [1315.0, 913.0], [1277.0, 912.0], [1239.0, 914.0], [1231.0, 914.0], [1193.0, 910.3], [1155.0, 904.9], [1120.0, 889.3], [1088.9, 867.3], [1065.7, 837.0], [1048.4, 803.0], [1039.1, 766.0], [1035.9, 728.0], [1036.0, 690.0], [1041.0, 667.0], [1011.0, 644.4], [982.2, 618.6], [951.0, 596.7], [916.0, 581.6], [878.0, 575.9], [840.0, 573.0], [802.0, 572.0], [764.0, 573.0], [726.0, 570.2], [688.0, 563.3], [654.8, 548.1], [624.0, 524.0], [592.0, 504.1], [555.0, 495.0], [517.0, 490.3], [479.0, 490.0], [441.0, 489.0], [403.0, 489.0], [365.0, 489.0], [327.0, 489.1], [289.0, 489.0], [251.0, 486.0], [213.0, 479.1], [178.0, 462.4], [147.8, 439.6], [124.7, 409.0], [109.1, 374.0], [102.3, 336.0], [94.7, 298.0], [86.9, 261.0], [70.6, 227.0], [47.0, 196.3], [27.3, 164.0], [12.1, 129.0], [0.0, 107.0], [-60, 60]];
  const scalePts = pts => pts.map(([x, y]) => [x * SC, y * SC]);
  const LANES = [scalePts(LANE_A_SRC), scalePts(LANE_B_SRC)];

  const PADS_SRC = [[309, 337], [1655, 451], [822, 729], [1263, 770], [299, 903]];
  const BUILD_SPOTS = PADS_SRC.map(([x, y]) => [Math.round(x * SC), Math.round(y * SC)]);

  function allArtLoaded() { return Object.values(ART).every(im => im.complete && im.naturalWidth); }

  function composeMap(m) {
    m.drawImage(ART.bg, 0, 0, W, H);
  }

  window.LEVELS = window.LEVELS || [];
  window.LEVELS.push({
    id: 'level18', name: 'Bonecave Hollow', desc: '2 ทาง · สองสายมาบรรจบในโพรงถ้ำกระดูกมืด',
    LANES, BUILD_SPOTS, composeMap, allArtLoaded,
  });
})();
