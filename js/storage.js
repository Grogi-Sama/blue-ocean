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
    // Fiyatlar (referans: 100 coin ≈ 0,99 $)
    JOKER_PRICE: 25,                  // 1 joker (ya da 1 reklam)
    LIFE_PRICE: 20,                   // eksik can başına; 1 eksik = 20, 2 = 40, 3 = 50 (üst sınır)
    REFILL_PRICE: 50,                 // tüm canları doldurma üst sınırı
    CONTINUE_PRICE: 30,               // sepet dolunca coinle devam (reklam alternatifi)
    AD_SKIP_SEC: 5,                   // sahte reklamda "Reklamı Geç" butonu bu kadar saniye sonra çıkar
    DAILY_REWARDS: [10, 10, 20, 20, 30, 30, 80], // 7 günlük giriş takvimi (toplam 200 coin, kullanıcı onaylı)
    TRAY_SIZE: 7,
    BANK_MAX: 6,                      // bekleme alanında en fazla 6 taş (= 2 kez Taşı Kaldır)
    // Coin paketleri. Fiyatlar mağazada ülke ülke girilir; oyun yayında fiyat
    // yazısını mağazadan alır. Buradaki try/usd yalnızca web test sürümü için.
    COIN_PACKS: [
      { id: "pack1", coins: 100,  bonus: 0,  usd: 1.09,  try: 19.99 },
      { id: "pack2", coins: 330,  bonus: 10, usd: 3.29,  try: 49.99 },
      { id: "pack3", coins: 600,  bonus: 20, usd: 5.49,  try: 79.99 },
      { id: "pack4", coins: 1300, bonus: 30, usd: 10.99, try: 149.99, badge: "popular" },
      { id: "pack5", coins: 2800, bonus: 40, usd: 21.99, try: 279.99 },
      { id: "pack6", coins: 7500, bonus: 50, usd: 54.99, try: 649.99, badge: "best" }
    ],
    // Tek seferlik başlangıç paketi: coin + her jokerden 3 adet
    STARTER_PACK: { id: "starter", coins: 250, jokers: 3, usd: 2.19, try: 34.99 }
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
      discovered: 16,
      starterBought: false,                  // başlangıç paketi alındı mı (tek seferlik)                        // "Yeni canlı" penceresinde gösterilmiş taş sayısı
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

  // Web test sürümünde bölge tahmini: saat dilimi İstanbul ise TL, değilse USD.
  // (Yayında fiyat ve para birimini mağaza, oyuncunun hesap ülkesine göre verir.)
  RT.region = (function () {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone === "Europe/Istanbul" ? "TR" : "INTL"; }
    catch (e) { return "INTL"; }
  })();
  RT.priceLabel = function (pack) {
    return RT.region === "TR"
      ? new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(pack.try)
      : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(pack.usd);
  };

  RT.formatTime = function (ms) {
    var t = Math.ceil(ms / 1000), m = Math.floor(t / 60), s = t % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  };
})();
