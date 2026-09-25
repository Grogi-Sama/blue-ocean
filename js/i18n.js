// Türkçe / İngilizce metinler. HTML'de data-i18n="anahtar" olan her eleman
// dil değişince otomatik güncellenir; JS tarafında RT.t("anahtar") kullanılır.
window.RT = window.RT || {};

RT.STRINGS = {
  tr: {
    gameTitle: "Mercan Üçlüsü",
    gameSubtitle: "Üçünü bul, resifi temizle!",
    level: "Seviye",
    play: "Oyna",
    tutorial: "Eğitim",
    settings: "Ayarlar",
    shop: "Mağaza",
    jUndo: "Geri Al", jRemove: "Taşı Kaldır", jShuffle: "Karıştır", jExpand: "Genişlet",
    music: "Müzik", sound: "Ses Efektleri", language: "Dil",
    on: "Açık", off: "Kapalı", close: "Kapat",
    winTitle: "Harika!", winText: "Resifi tertemiz yaptın.",
    nextLevel: "Sonraki Seviye", mainMenu: "Ana Menü",
    loseTitle: "Sepet Doldu!", loseText: "Bir can kaybettin. Tekrar dene!",
    retry: "Tekrar Dene",
    continueTitle: "Sepet Doldu!", continueText: "Reklam izle, son 3 taş tahtaya geri dönsün ve devam et.",
    continueAd: "İzle ve Devam Et", giveUp: "Vazgeç",
    pauseTitle: "Duraklatıldı", resume: "Devam Et",
    quitLevel: "Seviyeden Çık", quitWarn: "Çıkarsan 1 can kaybedersin.",
    noLivesTitle: "Canın Kalmadı", noLivesText: "Yeni can: {t}",
    watchAd: "Reklam İzle (+1 ❤️)", refillCoins: "Canları Doldur ({c} 🪙)",
    adPlaying: "Reklam oynatılıyor…", adDone: "+1 can kazandın!",
    notEnoughCoins: "Yeterli İnci Parası yok!",
    shopTitle: "İnci Parası", shopNote: "Test modu: gerçek ödeme yapılmaz.",
    buy: "Satın Al", bought: "+{n} 🪙 eklendi (test)",
    jokerEmptyTitle: "Joker Bitti", jokerEmptyText: "{name} jokerinden 1 adet al?",
    buyFor: "{c} 🪙 ile Al",
    watchAdJoker: "Reklam İzle (+1 joker)", jokerAdDone: "+1 joker kazandın!", yourCoins: "Bakiyen:",
    adTag: "REKLAM", adSkipIn: "Reklamı geç ({s})", adSkip: "Reklamı Geç",
    daily: "Günlük Ödül", dailyTitle: "Hoş Geldin Takvimi",
    dailyText: "İlk 7 gün her gün gir, İnci Parası topla!",
    day: "{n}. Gün", claim: "Ödülü Al", dailyGot: "+{n} 🪙 kazandın!",
    dailyComeBack: "Yarın yeni ödülün seni bekliyor 🐚", dailyDone: "Takvimi tamamladın!",
    nothingToUndo: "Geri alınacak hamle yok",
    trayEmpty: "Sepet boş",
    alreadyExpanded: "Sepet bu seviyede zaten genişletildi",
    bankFull: "Bekleme alanı dolu",
    // Eğitim
    tNext: "İlerle", tStart: "Başla!", tSkip: "Geç",
    t1Title: "Hoş Geldin!", t1Text: "Aynı 3 taşı bul ve sepete at. Üç tane biriktiğinde yok olurlar.",
    t2Title: "Sepete Dikkat", t2Text: "Sepette 7 yer var. Sepet eşleşme olmadan dolarsa kaybedersin!",
    t3Title: "Katmanlar", t3Text: "Soluk taşların üstünde başka taş var. Önce üsttekileri topla.",
    t4Title: "Jokerler", t4Text: "Zorlandığında jokerler yardımına koşar:",
    t4Undo: "Son hamleni geri alır.",
    t4Remove: "Sepetteki ilk 3 taşı yukarı çıkarır; eşleri gelene kadar orada kilitli bekler.",
    t4Shuffle: "Tahtadaki taşları karıştırır.",
    t4Expand: "Bu seviye için sepete 1 yer ekler.",
    t5Title: "Hazırsın!", t5Text: "Her seviye biraz daha zorlaşır. Sonu yok — bakalım ne kadar ilerleyeceksin?"
  },
  en: {
    gameTitle: "Reef Trio",
    gameSubtitle: "Find three, clear the reef!",
    level: "Level",
    play: "Play",
    tutorial: "Tutorial",
    settings: "Settings",
    shop: "Shop",
    jUndo: "Undo", jRemove: "Remove", jShuffle: "Shuffle", jExpand: "Expand",
    music: "Music", sound: "Sound Effects", language: "Language",
    on: "On", off: "Off", close: "Close",
    winTitle: "Great!", winText: "You cleared the reef.",
    nextLevel: "Next Level", mainMenu: "Main Menu",
    loseTitle: "Tray Full!", loseText: "You lost a life. Try again!",
    retry: "Try Again",
    continueTitle: "Tray Full!", continueText: "Watch an ad to send your last 3 tiles back to the board and keep going.",
    continueAd: "Watch & Continue", giveUp: "Give Up",
    pauseTitle: "Paused", resume: "Resume",
    quitLevel: "Quit Level", quitWarn: "Quitting costs 1 life.",
    noLivesTitle: "Out of Lives", noLivesText: "Next life: {t}",
    watchAd: "Watch Ad (+1 ❤️)", refillCoins: "Refill Lives ({c} 🪙)",
    adPlaying: "Ad playing…", adDone: "+1 life earned!",
    notEnoughCoins: "Not enough Pearl Coins!",
    shopTitle: "Pearl Coins", shopNote: "Test mode: no real payment.",
    buy: "Buy", bought: "+{n} 🪙 added (test)",
    jokerEmptyTitle: "Out of Joker", jokerEmptyText: "Buy 1 {name} joker?",
    buyFor: "Buy for {c} 🪙",
    watchAdJoker: "Watch Ad (+1 joker)", jokerAdDone: "+1 joker earned!", yourCoins: "Balance:",
    adTag: "AD", adSkipIn: "Skip ad ({s})", adSkip: "Skip Ad",
    daily: "Daily Reward", dailyTitle: "Welcome Calendar",
    dailyText: "Log in each of your first 7 days to collect Pearl Coins!",
    day: "Day {n}", claim: "Claim", dailyGot: "+{n} 🪙 earned!",
    dailyComeBack: "A new reward awaits you tomorrow 🐚", dailyDone: "Calendar complete!",
    nothingToUndo: "Nothing to undo",
    trayEmpty: "Tray is empty",
    alreadyExpanded: "Tray already expanded this level",
    bankFull: "Holding area is full",
    tNext: "Next", tStart: "Start!", tSkip: "Skip",
    t1Title: "Welcome!", t1Text: "Find 3 matching tiles and tap them into the tray. Three of a kind disappear.",
    t2Title: "Watch the Tray", t2Text: "The tray has 7 slots. If it fills up without a match, you lose!",
    t3Title: "Layers", t3Text: "Faded tiles are covered by others. Clear the top ones first.",
    t4Title: "Jokers", t4Text: "When you're stuck, jokers help out:",
    t4Undo: "Takes back your last move.",
    t4Remove: "Lifts the first 3 tiles out of the tray; they wait locked above until their matches arrive.",
    t4Shuffle: "Shuffles the tiles on the board.",
    t4Expand: "Adds 1 tray slot for this level.",
    t5Title: "You're Ready!", t5Text: "Each level gets a bit harder. It never ends — how far can you go?"
  }
};

RT.lang = "tr";

RT.t = function (key, vars) {
  var s = (RT.STRINGS[RT.lang] && RT.STRINGS[RT.lang][key]) || RT.STRINGS.tr[key] || key;
  if (vars) for (var k in vars) s = s.replace("{" + k + "}", vars[k]);
  return s;
};

RT.applyI18n = function (root) {
  (root || document).querySelectorAll("[data-i18n]").forEach(function (el) {
    el.textContent = RT.t(el.getAttribute("data-i18n"));
  });
  document.documentElement.lang = RT.lang;
  document.title = RT.t("gameTitle");
};
