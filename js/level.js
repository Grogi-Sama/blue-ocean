// Seviye üretici. Tüm konumlar "taş birimi" cinsinden: 1 birim = 1 taş genişliği.
// Her seviye her açılışta rastgele yeniden dizilir, ama zorluk seviye numarasıyla artar.
(function () {
  // Taş türleri = assets/tiles/<ad>.png dosyaları. İlk 16'sı baştan açık;
  // gerisi bu SIRAYLA, seviye ilerledikçe ikişer ikişer açılır (bkz. RT.unlockedCount).
  RT.TILE_TYPES = [
    "crab", "clownfish", "starfish", "pufferfish", "turtle", "seahorse", "dolphin", "whale",
    "octopus", "jellyfish", "pearl", "scallop", "shark", "chest", "anchor", "seal",
    // 2. paket
    "urchin", "narwhal", "manta", "coral", "kelp", "bluetang", "angler", "otter",
    "penguin", "wheel", "bottle", "helmet", "submarine", "nautilus", "swordfish", "trident",
    // 3. paket
    "lobster", "lighthouse", "lifebuoy", "seagull", "seadragon", "eel", "squid", "shrimp",
    "sanddollar", "compass", "sailboat", "manatee", "mussel", "orca", "mermaidtail", "map"
  ];

  // ---- Yeni taş kilidi ----
  // Seviye 15'ten başlayarak her 8 seviyede 2 yeni taş: 15, 23, 31 … son ikili seviye 135'te.
  var BASE_TILES = 16, UNLOCK_START = 15, UNLOCK_EVERY = 8, UNLOCK_STEP = 2;
  RT.MAX_TYPES_PER_LEVEL = 18; // bir seviyede en fazla bu kadar farklı taş (fazlası çok seyreltir)
  RT.unlockedCount = function (n) {
    if (n < UNLOCK_START) return BASE_TILES;
    var steps = Math.floor((n - UNLOCK_START) / UNLOCK_EVERY) + 1;
    return Math.min(RT.TILE_TYPES.length, BASE_TILES + steps * UNLOCK_STEP);
  };
  // Bu seviyede ilk kez açılan taşlar (yoksa boş dizi)
  RT.newTilesAt = function (n) {
    var now = RT.unlockedCount(n), before = RT.unlockedCount(n - 1);
    return RT.TILE_TYPES.slice(before, now);
  };
  RT.tileSrc = function (type) { return "assets/tiles/" + type + ".png"; };
  RT.tileImg = function (type, cls) {
    return '<img class="' + (cls || "face") + '" src="' + RT.tileSrc(type) + '" alt="" draggable="false">';
  };
  // Açılmış taşların ve arayüz görsellerinin önceden yüklenmesi (ilk seviyede
  // taşlar "sonradan belirmesin"). unlockedCount aşağıda tanımlı, bu yüzden fonksiyon.
  function preload() {
    RT.TILE_TYPES.slice(0, RT.unlockedCount(RT.save.level + 8)).map(RT.tileSrc).concat([
      "assets/ui/heart.png", "assets/ui/coin.png",
      "assets/jokers/undo.png", "assets/jokers/remove.png", "assets/jokers/shuffle.png", "assets/jokers/expand.png"
    ]).forEach(function (src) { new Image().src = src; });
  }

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
        types: Math.min(6 + Math.floor((n - 4) / 3), RT.MAX_TYPES_PER_LEVEL),
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

    assignTypes(tiles, cfg.types, n);

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
  function assignTypes(tiles, typeCount, level) {
    // Yalnızca açılmış taşlardan seç; bu seviyede yeni açılanlar mutlaka yer alsın
    var fresh = RT.newTilesAt(level);
    var others = shuffle(RT.TILE_TYPES.slice(0, RT.unlockedCount(level)).filter(function (t) {
      return fresh.indexOf(t) === -1;
    }));
    var types = fresh.concat(others).slice(0, typeCount);
    typeCount = types.length;
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

  preload();
})();
