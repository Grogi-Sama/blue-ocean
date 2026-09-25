// Seviye üretici. Tüm konumlar "taş birimi" cinsinden: 1 birim = 1 taş genişliği.
// Her seviye her açılışta rastgele yeniden dizilir, ama zorluk seviye numarasıyla artar.
(function () {
  // Taş türleri = assets/tiles/<ad>.png dosyaları
  RT.TILE_TYPES = [
    "crab", "clownfish", "starfish", "pufferfish", "turtle", "seahorse", "dolphin", "whale",
    "octopus", "jellyfish", "pearl", "scallop", "shark", "chest", "anchor", "seal"
  ];
  RT.tileSrc = function (type) { return "assets/tiles/" + type + ".png"; };
  RT.tileImg = function (type, cls) {
    return '<img class="' + (cls || "face") + '" src="' + RT.tileSrc(type) + '" alt="" draggable="false">';
  };
  // Tüm görselleri baştan yükle (ilk seviyede taşlar "sonradan belirmesin")
  RT.TILE_TYPES.map(RT.tileSrc).concat([
    "assets/ui/heart.png", "assets/ui/coin.png",
    "assets/jokers/undo.png", "assets/jokers/remove.png", "assets/jokers/shuffle.png", "assets/jokers/expand.png"
  ]).forEach(function (src) { new Image().src = src; });

  var GRID_COLS = 7, GRID_ROWS = 7;
  var STACK_STEP = 0.12; // kenar destelerinde taşlar arası kayma

  function rnd(n) { return Math.floor(Math.random() * n); }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = rnd(i + 1), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  RT.shuffle = shuffle;

  // Seviye numarasından zorluk ayarları
  RT.levelConfig = function (n) {
    var cfg;
    if (n === 1) cfg = { types: 3, main: 18, layers: 2, stack: 0 };
    else if (n === 2) cfg = { types: 4, main: 30, layers: 3, stack: 0 };
    else if (n === 3) cfg = { types: 5, main: 42, layers: 4, stack: 0 };
    else {
      cfg = {
        types: Math.min(6 + Math.floor((n - 4) / 3), RT.TILE_TYPES.length),
        main: Math.min(48 + (n - 4) * 3, 120),
        layers: Math.min(4 + Math.floor((n - 4) / 4), 9),
        stack: Math.min(4 + Math.floor((n - 4) / 3), 12) // her iki deste için
      };
    }
    // Toplam taş sayısı 3'ün katı olmalı
    var total = cfg.main + cfg.stack * 2;
    cfg.main -= total % 3;
    return cfg;
  };

  // Bir katmana simetrik (sol-sağ ayna) hücreler seç
  function pickCells(layer, count) {
    var off = layer % 2 ? 0.5 : 0;
    var cols = off ? GRID_COLS - 1 : GRID_COLS;
    var rows = off ? GRID_ROWS - 1 : GRID_ROWS;
    var inset = Math.min(Math.floor(layer / 3), 2);
    var units = [];
    for (var r = inset; r < rows - inset; r++) {
      for (var c = inset; c < Math.ceil(cols / 2); c++) {
        var mc = cols - 1 - c;
        if (mc === c) units.push([[c, r]]);
        else units.push([[c, r], [mc, r]]);
      }
    }
    // Merkeze yakın hücreler öncelikli (+ biraz rastgelelik): dağınık değil,
    // ortada toplanan "yığın" görüntüsü oluşur
    var cx = (cols - 1) / 2, cy = (rows - 1) / 2;
    units.forEach(function (u) {
      var c0 = u[0];
      u.score = Math.abs(c0[0] - cx) * 0.9 + Math.abs(c0[1] - cy) + Math.random() * 2.2;
    });
    units.sort(function (a, b) { return a.score - b.score; });
    var cells = [];
    for (var i = 0; i < units.length && cells.length < count; i++) {
      var u = units[i];
      if (u.length === 2 && count - cells.length === 1) u = [u[0]];
      u.forEach(function (cr) { cells.push({ x: cr[0] + off, y: cr[1] + off }); });
    }
    return cells;
  }

  RT.overlaps = function (a, b) {
    return Math.abs(a.x - b.x) < 0.999 && Math.abs(a.y - b.y) < 0.999;
  };

  // Bir taşın üstünde (daha yüksek katmanda, çakışan) başka taş var mı?
  RT.isCovered = function (tile, tiles) {
    for (var i = 0; i < tiles.length; i++) {
      var o = tiles[i];
      if (o !== tile && o.layer > tile.layer && RT.overlaps(o, tile)) return true;
    }
    return false;
  };

  RT.buildLevel = function (n) {
    var cfg = RT.levelConfig(n);
    var tiles = [], uid = 0;

    // Ana yığın: alt katmanlar daha kalabalık, üste doğru azalır
    var weights = [], wsum = 0;
    for (var L = 0; L < cfg.layers; L++) { weights.push(cfg.layers - L + 1); wsum += cfg.layers - L + 1; }
    var remaining = cfg.main;
    for (var L2 = 0; L2 < cfg.layers && remaining > 0; L2++) {
      var want = L2 === cfg.layers - 1 ? remaining : Math.round(cfg.main * weights[L2] / wsum);
      var cells = pickCells(L2, Math.min(want, remaining));
      cells.forEach(function (p) { tiles.push({ id: uid++, x: p.x, y: p.y, layer: L2 }); });
      remaining -= cells.length;
    }
    // Yuvarlama yüzünden eksik kalan taşlar için en üste bir katman daha
    var extra = cfg.layers;
    while (remaining > 0) {
      var more = pickCells(extra, remaining);
      more.forEach(function (p) { tiles.push({ id: uid++, x: p.x, y: p.y, layer: extra }); });
      remaining -= more.length; extra++;
    }

    // Alt köşelerde iki deste: yalnızca en üstteki taş görünür
    if (cfg.stack > 0) {
      var mainBottom = Math.max.apply(null, tiles.map(function (t) { return t.y; }));
      var sy = mainBottom + 1.35; // destenin ana yığınla arasında küçük bir boşluk
      for (var s = 0; s < cfg.stack; s++) {
        tiles.push({ id: uid++, x: 0.1 + s * STACK_STEP, y: sy, layer: 100 + s, stack: "L" });
        tiles.push({ id: uid++, x: GRID_COLS - 1.1 - s * STACK_STEP, y: sy, layer: 100 + s, stack: "R" });
      }
    }

    assignTypes(tiles, cfg.types);

    // Tahtayı yalnızca taşların kapladığı alana kırp (böylece ortalanır ve taşlar büyür)
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    tiles.forEach(function (t) {
      minX = Math.min(minX, t.x); minY = Math.min(minY, t.y);
      maxX = Math.max(maxX, t.x); maxY = Math.max(maxY, t.y);
    });
    tiles.forEach(function (t) { t.x -= minX; t.y -= minY; });
    return { tiles: tiles, width: maxX - minX + 1, height: maxY - minY + 1, config: cfg };
  };

  // Türleri, en az bir çözüm yolu garanti olacak şekilde dağıt:
  // Tahtayı sanal olarak üstten sökeriz; açıkta olan taşlardan rastgele 3'er tane
  // alıp aynı türü veririz. Böylece bu söküm sırası her zaman geçerli bir çözümdür
  // (oyuncunun onu bulması gerekir — tahta yine de zorlayıcı).
  function assignTypes(tiles, typeCount) {
    var types = shuffle(RT.TILE_TYPES.slice()).slice(0, typeCount);
    var triples = tiles.length / 3, bag = [];
    for (var i = 0; i < triples; i++) bag.push(types[i % typeCount]);
    shuffle(bag);

    var left = tiles.slice();
    for (var t = 0; t < triples; t++) {
      for (var k = 0; k < 3; k++) {
        var open = left.filter(function (tl) { return !RT.isCovered(tl, left); });
        var pick = open[rnd(open.length)];
        pick.type = bag[t];
        left.splice(left.indexOf(pick), 1);
      }
    }
  }
})();
