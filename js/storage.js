// Kalıcı veriler: can, İnci Parası (coin), joker stoku, seviye, ayarlar.
// Şimdilik her şey bu cihazın localStorage'ında tutulur. Mağazaya çıkarken
// coin/satın alma bilgisi mutlaka sunucu tarafına (hesap sistemine) taşınmalı —
// localStorage kullanıcı tarafından kolayca değiştirilebilir.
(function () {
  var KEY = "reeftrio_save_v1";

  // ---- Ekonomi ayarları (tek yerden değiştirilebilsin diye burada) ----
  RT.CONFIG = {
    LIVES_MAX: 5,
    LIFE_REGEN_MS: 30 * 60 * 1000,   // her 30 dakikada 1 can
    START_COINS: 0,                   // coin yalnızca gerçek parayla alınır
    START_JOKERS: 2,                  // her jokerden başlangıç stoku
    JOKER_PRICE: 40,                  // 1 joker = 40 coin
    REFILL_PRICE: 60,                 // canları tamamen doldurma = 60 coin
    TRAY_SIZE: 7,
    BANK_MAX: 3,                      // Taşı Kaldır ile bekletilebilecek en fazla taş
    COIN_PACKS: [                     // test mağazası paketleri
      { coins: 100, price: "₺29,99" },
      { coins: 300, price: "₺74,99" },
      { coins: 800, price: "₺169,99" }
    ]
  };

  function defaults() {
    return {
      lives: RT.CONFIG.LIVES_MAX,
      lastRegen: Date.now(),
      coins: RT.CONFIG.START_COINS,
      jokers: {
        undo: RT.CONFIG.START_JOKERS, remove: RT.CONFIG.START_JOKERS,
        shuffle: RT.CONFIG.START_JOKERS, expand: RT.CONFIG.START_JOKERS
      },
      level: 1,
      tutorialSeen: false,
      settings: { music: true, sound: true, lang: null }
    };
  }

  function load() {
    var d = null;
    try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
    var def = defaults();
    if (!d) return def;
    // Yeni alanlar eklendiğinde eski kayıtlar bozulmasın
    for (var k in def) if (d[k] === undefined) d[k] = def[k];
    for (var j in def.jokers) if (d.jokers[j] === undefined) d.jokers[j] = def.jokers[j];
    for (var s in def.settings) if (d.settings[s] === undefined) d.settings[s] = def.settings[s];
    return d;
  }

  RT.save = load();
  RT.persist = function () {
    try { localStorage.setItem(KEY, JSON.stringify(RT.save)); } catch (e) {}
  };

  // ---- Can sistemi ----
  // Can tam değilse her LIFE_REGEN_MS'de bir can dolar. Uygulama kapalıyken
  // geçen süre de sayılır (lastRegen'den bu yana geçen süreye bakılır).
  RT.tickLives = function () {
    var s = RT.save, C = RT.CONFIG;
    if (s.lives >= C.LIVES_MAX) { s.lastRegen = Date.now(); return; }
    var gained = Math.floor((Date.now() - s.lastRegen) / C.LIFE_REGEN_MS);
    if (gained > 0) {
      s.lives = Math.min(C.LIVES_MAX, s.lives + gained);
      s.lastRegen += gained * C.LIFE_REGEN_MS;
      if (s.lives >= C.LIVES_MAX) s.lastRegen = Date.now();
      RT.persist();
    }
  };

  RT.msToNextLife = function () {
    if (RT.save.lives >= RT.CONFIG.LIVES_MAX) return 0;
    return Math.max(0, RT.save.lastRegen + RT.CONFIG.LIFE_REGEN_MS - Date.now());
  };

  RT.addLives = function (n) {
    var wasFull = RT.save.lives >= RT.CONFIG.LIVES_MAX;
    RT.save.lives = Math.min(RT.CONFIG.LIVES_MAX, RT.save.lives + n);
    if (RT.save.lives >= RT.CONFIG.LIVES_MAX || wasFull) RT.save.lastRegen = Date.now();
    RT.persist();
  };

  RT.spendLife = function () {
    if (RT.save.lives >= RT.CONFIG.LIVES_MAX) RT.save.lastRegen = Date.now();
    RT.save.lives = Math.max(0, RT.save.lives - 1);
    RT.persist();
  };

  RT.spendCoins = function (n) {
    if (RT.save.coins < n) return false;
    RT.save.coins -= n;
    RT.persist();
    return true;
  };

  RT.formatTime = function (ms) {
    var t = Math.ceil(ms / 1000), m = Math.floor(t / 60), s = t % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  };
})();
