// ===================== Level 17 — Sundial Roundabout (pre-made background) =====================
// Pre-made painting `td-tileset3/PNG/bg.png` (same desert/cowboy tile family
// as level16's game_background_2 -- identical road/pad/ground tones). Built
// with the [[premade-map-trace]] recipe:
//  - road mask = flood-fill from the 2 edge entries (top stem, left edge)
//    and the bottom-right exit, then closed with a small morphological
//    closing + hole-fill to erase the road's own speckle texture before
//    tracing (raw flood-fill alone gave a mask too holey to skeletonize).
//  - the big circular "roundabout" is a true closed loop (no separate
//    entrance) fed by a WIDE connector where it overlaps the top
//    stem/hairpin visually -- there's no single-pixel junction to find, so
//    the loop's connection point was chosen where the connector area reads
//    naturally in the art (traced via a radial mid-radius scan around the
//    ring's island center once it was isolated as an enclosed hole in the
//    mask). Lane A spirals: top entrance -> full loop around the roundabout
//    island (bleeds path length, matches the drawn art) -> back out ->
//    hairpin down around the skull-island -> joins the long bottom road ->
//    exits bottom-right. Lane B enters off the left edge straight onto the
//    same bottom road.
//  - build pads = the painting's own sand-patch pads, color-detected then
//    CROP-VERIFIED one by one (per the user's level16 correction) -- 4
//    extra color-matched candidates were ground-tone transition bands, not
//    real patches, and were discarded after visual crop inspection.
(function () {
  const W = 1280, H = 720;
  const SC = W / 1920;

  function img(n) { const i = new Image(); i.src = 'assets/roundabout/' + n + '.png'; return i; }
  const ART = { bg: img('main_bg') };

  // Every waypoint below sits on the road's scanned CENTERLINE (standing user
  // rule: monsters always walk the middle of the road) — each segment's
  // center came from cross-section scans of the cleaned road mask, and every
  // point was verified >=32px from the nearest road edge (half-width ~50px).
  // Both lanes share the same TAIL and terminate OFF-CANVAS at the bottom-
  // right exit: a lane that ends mid-map makes enemies vanish there and
  // drain lives (that exact bug shipped in the first version of this level —
  // lane B originally stopped where it met the bottom road).
  const TAIL_SRC = [[700, 861], [850, 862], [1000, 861], [1120, 850], [1200, 829], [1290, 797], [1380, 779], [1480, 779], [1570, 784], [1650, 797], [1700, 812], [1728, 838], [1745, 880], [1751, 940], [1751, 1020], [1751, 1080], [1751, 1140]];
  const LANE_A_SRC = [[644, -40], [644, 140], [641, 240], [638, 330], [640.5, 426.0], [640.9, 438.0], [645.1, 449.5], [646.7, 461.1], [650.5, 472.3], [654.1, 483.5], [659.4, 493.9], [665.4, 503.9], [671.6, 513.7], [679.7, 522.1], [686.0, 531.7], [692.9, 541.0], [701.6, 548.6], [710.7, 555.6], [720.6, 561.5], [729.8, 568.5], [740.1, 573.4], [750.6, 578.1], [761.5, 581.5], [772.4, 584.6], [783.5, 587.5], [794.8, 590.1], [806.3, 589.9], [817.8, 590.9], [829.4, 591.1], [840.7, 589.0], [851.7, 585.1], [863.5, 584.4], [874.2, 579.9], [885.0, 575.6], [895.2, 570.2], [905.1, 564.0], [913.6, 556.0], [923.1, 549.4], [932.8, 542.7], [940.3, 533.7], [948.3, 525.0], [954.9, 515.3], [961.2, 505.3], [966.8, 494.9], [971.3, 484.0], [974.9, 472.7], [979.8, 461.7], [981.3, 449.8], [984.6, 438.1], [984.0, 426.0], [983.1, 414.0], [981.8, 402.1], [979.3, 390.4], [975.9, 379.0], [969.9, 368.5], [965.0, 357.9], [959.0, 347.8], [952.4, 338.3], [945.5, 329.0], [938.8, 319.6], [930.3, 311.7], [921.7, 304.1], [913.0, 296.8], [902.9, 291.3], [893.5, 284.8], [883.5, 279.5], [872.7, 275.8], [861.4, 273.8], [850.8, 270.3], [840.0, 267.0], [828.9, 265.4], [817.6, 266.1], [806.4, 265.6], [795.1, 264.9], [783.3, 263.0], [771.1, 262.0], [700, 267], [600, 268], [500, 268], [440, 272], [390, 292], [348, 330], [317, 378], [303, 430], [302, 520], [302, 610], [302, 700], [304, 755], [318, 808], [352, 842], [420, 859], [520, 861]].concat(TAIL_SRC);
  const LANE_B_SRC = [[-40, 866], [120, 865], [300, 862], [450, 861], [560, 861]].concat(TAIL_SRC);
  const scalePts = pts => pts.map(([x, y]) => [x * SC, y * SC]);
  const LANES = [scalePts(LANE_A_SRC), scalePts(LANE_B_SRC)];

  const PADS_SRC = [[435, 98], [810, 421], [104, 699], [980, 707], [1534, 923]];
  const BUILD_SPOTS = PADS_SRC.map(([x, y]) => [Math.round(x * SC), Math.round(y * SC)]);

  function allArtLoaded() { return Object.values(ART).every(im => im.complete && im.naturalWidth); }

  function composeMap(m) {
    m.drawImage(ART.bg, 0, 0, W, H);
  }

  window.LEVELS = window.LEVELS || [];
  window.LEVELS.push({
    id: 'level17', name: 'Sundial Roundabout', desc: '2 ทาง · วนรอบลานหมุนกลางทะเลทรายก่อนเข้าเส้นทางหลัก',
    LANES, BUILD_SPOTS, composeMap, allArtLoaded,
  });
})();
