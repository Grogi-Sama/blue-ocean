// Kalıcı veriler: can, İnci Parası (coin), joker stoku, seviye, ayarlar.
// Şimdilik her şey bu cihazın localStorage'ında tutulur. Mağazaya çıkarken
// coin/satın alma bilgisi mutlaka sunucu tarafına (hesap sistemine) taşınmalı —
// localStorage kullanıcı tarafından kolayca değiştirilebilir.
(function () {
  var KEY = "blueocean_save_v1";

  // ---- Ekonomi ayarları (tek yerden değiştirilebilsin diye burada) ----
  RT.CONFIG = {
    LIVES_MAX: 3,
    LIFE_REGEN_MS: 30 * 60 * 1000,   // her 30 dakikada 1 can
    START_COINS: 0,                   // coin: gerçek para + ilk 7 günün giriş takvimi (başka ücretsiz yol yok)
    START_JOKERS: 2,                  // her jokerden başlangıç stoku
    JOKER_PRICE: 5,                   // 1 joker = 5 coin (ya da 1 reklam)
    REFILL_PRICE: 15,                 // canları tamamen doldurma = 15 coin (üst sınır)
    LIFE_PRICE: 6,                    // eksik can başına coin; 1 eksik = 6, 2 = 12, 3 = 15 (üst sınır)
    AD_SKIP_SEC: 5,                   // sahte reklamda "Reklamı Geç" butonu bu kadar saniye sonra çıkar
    DAILY_REWARDS: [5, 5, 10, 10, 15, 15, 30], // 7 günlük giriş takvimi (toplam 90 coin)
    TRAY_SIZE: 7,
    BANK_MAX: 6,                      // bekleme alanında en fazla 6 taş (= 2 kez Taşı Kaldır)
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
      discovered: 16,                        // "Yeni canlı" penceresinde gösterilmiş taş sayısı
      daily: { claimed: 0, lastDate: null }, // giriş takvimi: kaç gün alındı, en son hangi tarihte
      settings: { musicVol: 50, sfxVol: 80, lang: null } // ses seviyeleri 0-100
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
    // Eski kayıtlardaki açık/kapalı ayarlarını ses seviyesine çevir
    if (d.settings.music === false && d.settings.musicVol === undefined) d.settings.musicVol = 0;
    if (d.settings.sound === false && d.settings.sfxVol === undefined) d.settings.sfxVol = 0;
    delete d.settings.music; delete d.settings.sound; delete d.adLives;
    for (var s in def.settings) if (d.settings[s] === undefined) d.settings[s] = def.settings[s];
    return d;
  }

  RT.save = load();
  if (RT.save.lives > RT.CONFIG.LIVES_MAX) RT.save.lives = RT.CONFIG.LIVES_MAX;
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

  // Eksik canları doldurmanın coin fiyatı (can doluysa 0)
  RT.refillPrice = function () {
    var missing = RT.CONFIG.LIVES_MAX - RT.save.lives;
    return Math.min(RT.CONFIG.REFILL_PRICE, Math.max(0, missing) * RT.CONFIG.LIFE_PRICE);
  };

  RT.spendCoins = function (n) {
    if (RT.save.coins < n) return false;
    RT.save.coins -= n;
    RT.persist();
    return true;
  };

  // ---- 7 günlük giriş takvimi ----
  // Oyuncu her gün (yerel tarih) bir sonraki günün ödülünü alabilir. Kaçırılan gün
  // yanmaz — takvim kaldığı yerden devam eder; 7 ödül alınınca takvim kapanır.
  RT.todayStr = function () {
    var d = new Date();
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  };
  RT.dailyAvailable = function () {
    var dl = RT.save.daily;
    return dl.claimed < RT.CONFIG.DAILY_REWARDS.length && dl.lastDate !== RT.todayStr();
  };
  RT.dailyFinished = function () { return RT.save.daily.claimed >= RT.CONFIG.DAILY_REWARDS.length; };
  RT.claimDaily = function () {
    if (!RT.dailyAvailable()) return 0;
    var amount = RT.CONFIG.DAILY_REWARDS[RT.save.daily.claimed];
    RT.save.daily.claimed++;
    RT.save.daily.lastDate = RT.todayStr();
    RT.save.coins += amount;
    RT.persist();
    return amount;
  };

  RT.formatTime = function (ms) {
    var t = Math.ceil(ms / 1000), m = Math.floor(t / 60), s = t % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  };
})();
