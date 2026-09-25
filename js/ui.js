// Ekranlar, pencereler (modal), eğitim, ayarlar, mağaza ve açılış.
(function () {
  var modal = document.getElementById("modal");
  var card = document.getElementById("modalCard");
  var toastEl = document.getElementById("toast");
  var toastTimer = null;

  RT.ui = {};

  // ---------- Ekran geçişi ----------
  function show(screen) {
    document.querySelectorAll(".screen").forEach(function (s) { s.classList.toggle("active", s.id === "screen-" + screen); });
    if (screen === "game") RT.game.relayout();
    refreshHud();
  }
  RT.ui.show = show;

  // ---------- Üst bilgiler (can / coin / seviye) ----------
  function refreshHud() {
    RT.tickLives();
    var s = RT.save;
    document.querySelectorAll(".lives-count").forEach(function (e) { e.textContent = s.lives; });
    document.querySelectorAll(".coin-count").forEach(function (e) { e.textContent = s.coins; });
    document.getElementById("menuLevel").textContent = s.level;
    var timer = document.querySelector("#menuLives .lives-timer");
    timer.textContent = s.lives < RT.CONFIG.LIVES_MAX ? RT.formatTime(RT.msToNextLife()) : "";
    refreshDailyButton();
    var nl = document.getElementById("noLivesTimer");
    if (nl) nl.textContent = RT.formatTime(RT.msToNextLife());
  }
  RT.ui.refreshHud = refreshHud;
  setInterval(refreshHud, 1000);

  // ---------- Modal yardımcıları ----------
  // Çeviri metinlerindeki 🪙 / ❤️ emojilerini oyunun kendi ikonlarıyla değiştir
  var INLINE_ICONS = {
    "🪙": '<img class="i-coin" src="assets/ui/coin.png" alt="">',
    "❤️": '<img class="i-heart" src="assets/ui/heart.png" alt="">'
  };
  function withIcons(html) {
    for (var k in INLINE_ICONS) html = html.split(k).join(INLINE_ICONS[k]);
    return html;
  }
  RT.ui.withIcons = withIcons;

  function openModal(html, opts) {
    card.innerHTML = withIcons(html);
    card.className = "modal-card" + (opts && opts.cls ? " " + opts.cls : "");
    modal.hidden = false;
    card.querySelectorAll("[data-m]").forEach(function (b) {
      b.addEventListener("click", function () { RT.sfx("click"); handlers[b.dataset.m] && handlers[b.dataset.m](b); });
    });
  }
  function closeModal() { modal.hidden = true; card.innerHTML = ""; }
  RT.ui.closeModal = closeModal;

  var handlers = {}; // her modal kendi butonlarını buraya bağlar

  RT.ui.toast = function (txt) {
    toastEl.innerHTML = withIcons(txt);
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 1800);
  };

  // ---------- Oyun başlatma ----------
  function play() {
    RT.tickLives();
    if (RT.save.lives <= 0) { showNoLives(); return; }
    var fresh = RT.newTilesAt(RT.save.level);
    if (fresh.length && RT.unlockedCount(RT.save.level) > RT.save.discovered) {
      showDiscovery(fresh);
      return;
    }
    closeModal();
    show("game");
    RT.game.start(RT.save.level);
  }

  // "Yeni canlı keşfettin!" — yeni açılan taşları tanıtır, sonra seviyeyi başlatır
  function showDiscovery(types) {
    RT.save.discovered = RT.unlockedCount(RT.save.level);
    RT.persist();
    handlers.go = play;
    RT.sfx("win");
    openModal(
      '<div class="discover">' + types.map(function (t) { return '<span class="d-tile">' + RT.tileImg(t, "d-img") + "</span>"; }).join("") + "</div>" +
      "<h2>" + RT.t("discoverTitle") + "</h2>" +
      "<p>" + RT.t("discoverText") + "</p>" +
      '<button class="btn btn-green" data-m="go">' + RT.t("discoverGo") + "</button>",
      { cls: "discovery" }
    );
  }

  // ---------- Kazandın / Kaybettin ----------
  RT.ui.showWin = function (level) {
    handlers.next = play;
    handlers.menu = function () { closeModal(); show("menu"); };
    openModal(
      '<div class="m-emoji">🏆</div>' +
      "<h2>" + RT.t("winTitle") + "</h2>" +
      "<p>" + RT.t("level") + " " + level + " — " + RT.t("winText") + "</p>" +
      '<button class="btn btn-green" data-m="next">' + RT.t("nextLevel") + "</button>" +
      '<button class="btn btn-soft" data-m="menu">' + RT.t("mainMenu") + "</button>",
      { cls: "win" }
    );
  };

  RT.ui.showLose = function () {
    handlers.retry = play;
    handlers.menu = function () { closeModal(); show("menu"); };
    openModal(
      '<div class="m-emoji">🫧</div>' +
      "<h2>" + RT.t("loseTitle") + "</h2>" +
      "<p>" + RT.t("loseText") + "</p>" +
      '<div class="m-lives">❤️ × ' + RT.save.lives + "</div>" +
      '<button class="btn btn-play" data-m="retry">' + RT.t("retry") + "</button>" +
      '<button class="btn btn-soft" data-m="menu">' + RT.t("mainMenu") + "</button>"
    );
  };

  // ---------- Sepet doldu: reklam izle, devam et ----------
  RT.ui.showContinue = function (onContinue, onGiveUp) {
    handlers.continueAd = function () { watchAd(function () { closeModal(); onContinue(); }); };
    handlers.giveUp = function () { closeModal(); onGiveUp(); };
    openModal(
      '<div class="m-emoji">🫧</div>' +
      "<h2>" + RT.t("continueTitle") + "</h2>" +
      "<p>" + RT.t("continueText") + "</p>" +
      '<button class="btn btn-blue" data-m="continueAd">📺 ' + RT.t("continueAd") + "</button>" +
      '<button class="btn btn-soft" data-m="giveUp">' + RT.t("giveUp") + "</button>"
    );
  };

  // ---------- Duraklatma ----------
  function showPause() {
    handlers.resume = closeModal;
    handlers.quit = function () { RT.spendLife(); closeModal(); show("menu"); };
    handlers.settings = showSettings;
    openModal(
      "<h2>" + RT.t("pauseTitle") + "</h2>" +
      '<button class="btn btn-blue" data-m="resume">' + RT.t("resume") + "</button>" +
      '<button class="btn btn-soft" data-m="settings">' + RT.t("settings") + "</button>" +
      '<button class="btn btn-danger" data-m="quit">' + RT.t("quitLevel") + "</button>" +
      '<p class="small">' + RT.t("quitWarn") + "</p>"
    );
  }

  // ---------- Can bitti ----------
  function showNoLives() {
    handlers.ad = function () { watchAd(function () { RT.addLives(1); closeModal(); refreshHud(); RT.ui.toast(RT.t("adDone")); }); };
    handlers.refill = function () {
      if (!RT.spendCoins(RT.CONFIG.REFILL_PRICE)) { RT.ui.toast(RT.t("notEnoughCoins")); showShop(); return; }
      RT.addLives(RT.CONFIG.LIVES_MAX); closeModal(); refreshHud();
    };
    handlers.close = closeModal;
    openModal(
      '<button class="m-close" data-m="close">✕</button>' +
      '<div class="m-emoji">💔</div>' +
      "<h2>" + RT.t("noLivesTitle") + "</h2>" +
      "<p>" + RT.t("noLivesText", { t: '<b id="noLivesTimer">' + RT.formatTime(RT.msToNextLife()) + "</b>" }) + "</p>" +
      '<button class="btn btn-play" data-m="ad">📺 ' + RT.t("watchAd") + "</button>" +
      '<button class="btn btn-soft" data-m="refill">' + RT.t("refillCoins", { c: RT.CONFIG.REFILL_PRICE }) + "</button>"
    );
  }

  // Sahte reklam: gerçek reklam SDK'sı (ör. AdMob "ödüllü reklam") mobil pakette
  // eklenecek. Şimdilik AD_SKIP_SEC saniye geri sayım, sonra "Reklamı Geç" butonu;
  // ödül butona basınca verilir.
  var adTimer = null;
  function watchAd(onReward) {
    var left = RT.CONFIG.AD_SKIP_SEC;
    handlers.skipAd = function () { clearInterval(adTimer); onReward(); };
    openModal(
      '<div class="ad-screen"><span class="ad-tag">' + RT.t("adTag") + '</span>' +
      '<div class="m-emoji spin">📺</div><h2>' + RT.t("adPlaying") + "</h2></div>" +
      '<div class="ad-bar"><i style="animation-duration:' + left + 's"></i></div>' +
      '<button class="btn btn-soft ad-skip" data-m="skipAd" disabled>' + RT.t("adSkipIn", { s: left }) + "</button>",
      { cls: "ad" }
    );
    var btn = card.querySelector(".ad-skip");
    clearInterval(adTimer);
    adTimer = setInterval(function () {
      left--;
      if (left > 0) { btn.textContent = RT.t("adSkipIn", { s: left }); return; }
      clearInterval(adTimer);
      btn.disabled = false;
      btn.classList.add("ready");
      btn.textContent = RT.t("adSkip") + " ⏭";
    }, 1000);
  }

  // ---------- Mağaza (test) ----------
  function showShop() {
    handlers.close = closeModal;
    handlers.buy = function (b) {
      // GERÇEK ÖDEME YOK. Mağaza entegrasyonunda burası uygulama içi satın
      // alma (Google Play / App Store) onayından SONRA çalışacak.
      var n = +b.dataset.coins;
      RT.save.coins += n; RT.persist(); refreshHud();
      RT.ui.toast(RT.t("bought", { n: n }));
    };
    var packs = RT.CONFIG.COIN_PACKS.map(function (p) {
      return '<div class="pack"><span class="pack-coins">🪙 ' + p.coins + '</span>' +
        '<button class="btn btn-play small" data-m="buy" data-coins="' + p.coins + '">' + p.price + "</button></div>";
    }).join("");
    openModal(
      '<button class="m-close" data-m="close">✕</button>' +
      '<img class="m-img" src="assets/ui/coin.png" alt=""><h2>' + RT.t("shopTitle") + "</h2>" + packs +
      '<p class="small">' + RT.t("shopNote") + "</p>"
    );
  }

  // ---------- Joker satın alma ----------
  var JOKER_NAME_KEY = { undo: "jUndo", remove: "jRemove", shuffle: "jShuffle", expand: "jExpand" };
  RT.ui.offerJoker = function (name) {
    handlers.close = closeModal;
    function grant() { RT.save.jokers[name]++; RT.persist(); closeModal(); refreshHud(); RT.game.renderJokers(); }
    handlers.buyJoker = function () {
      if (!RT.spendCoins(RT.CONFIG.JOKER_PRICE)) { RT.ui.toast(RT.t("notEnoughCoins")); showShop(); return; }
      grant();
    };
    handlers.adJoker = function () { watchAd(function () { grant(); RT.ui.toast(RT.t("jokerAdDone")); }); };
    openModal(
      '<button class="m-close" data-m="close">✕</button>' +
      "<h2>" + RT.t("jokerEmptyTitle") + "</h2>" +
      "<p>" + RT.t("jokerEmptyText", { name: RT.t(JOKER_NAME_KEY[name]) }) + "</p>" +
      '<button class="btn btn-play" data-m="buyJoker">' + RT.t("buyFor", { c: RT.CONFIG.JOKER_PRICE }) + "</button>" +
      '<button class="btn btn-soft" data-m="adJoker">📺 ' + RT.t("watchAdJoker") + "</button>" +
      '<p class="small">' + RT.t("yourCoins") + " 🪙 " + RT.save.coins + "</p>"
    );
  };

  // ---------- 7 günlük giriş takvimi ----------
  function showDaily() {
    var R = RT.CONFIG.DAILY_REWARDS, claimed = RT.save.daily.claimed, can = RT.dailyAvailable();
    handlers.close = closeModal;
    handlers.claim = function () {
      var got = RT.claimDaily();
      if (!got) return;
      RT.sfx("win");
      refreshHud();
      showDaily();
      RT.ui.toast(RT.t("dailyGot", { n: got }));
    };
    var cells = R.map(function (c, i) {
      var state = i < claimed ? "done" : (i === claimed && can ? "today" : "locked");
      return '<div class="day ' + state + (i === R.length - 1 ? " big" : "") + '">' +
        "<small>" + RT.t("day", { n: i + 1 }) + "</small>" +
        '<span class="day-coin">' + (state === "done" ? "✅" : '<img src="assets/ui/coin.png" alt="">') + "</span>" +
        "<b>" + c + "</b></div>";
    }).join("");
    openModal(
      '<button class="m-close" data-m="close">✕</button>' +
      "<h2>" + RT.t("dailyTitle") + "</h2>" +
      '<p class="small">' + RT.t("dailyText") + "</p>" +
      '<div class="days">' + cells + "</div>" +
      (can ? '<button class="btn btn-green" data-m="claim">' + RT.t("claim") + "</button>"
           : '<p class="small">' + RT.t(RT.dailyFinished() ? "dailyDone" : "dailyComeBack") + "</p>")
    );
  }

  function refreshDailyButton() {
    var b = document.getElementById("dailyBtn");
    b.hidden = RT.dailyFinished();
    b.classList.toggle("has-reward", RT.dailyAvailable());
  }

  // ---------- Ayarlar ----------
  function showSettings() {
    var st = RT.save.settings;
    handlers.close = function () { closeModal(); if (RT.game.isActive() && document.getElementById("screen-game").classList.contains("active")) showPause(); };
    handlers.music = function () { st.music = !st.music; RT.persist(); RT.updateMusic(); showSettings(); };
    handlers.sound = function () { st.sound = !st.sound; RT.persist(); showSettings(); };
    handlers.lang = function (b) { setLang(b.dataset.lang); showSettings(); };
    function toggle(key, on) {
      return '<div class="set-row"><span>' + RT.t(key) + '</span><button class="toggle' + (on ? " on" : "") +
        '" data-m="' + key + '">' + RT.t(on ? "on" : "off") + "</button></div>";
    }
    openModal(
      '<button class="m-close" data-m="close">✕</button>' +
      "<h2>" + RT.t("settings") + "</h2>" +
      toggle("music", st.music) + toggle("sound", st.sound) +
      '<div class="set-row"><span>' + RT.t("language") + '</span><div class="seg">' +
      '<button class="' + (RT.lang === "tr" ? "on" : "") + '" data-m="lang" data-lang="tr">TR</button>' +
      '<button class="' + (RT.lang === "en" ? "on" : "") + '" data-m="lang" data-lang="en">EN</button>' +
      "</div></div>"
    );
  }

  function setLang(l) {
    RT.lang = l;
    RT.save.settings.lang = l;
    RT.persist();
    RT.applyI18n();
  }

  // ---------- Eğitim ----------
  function showTutorial(step) {
    step = step || 0;
    var J = function (icon, key, desc) {
      return '<div class="t-joker"><span class="j-icon"><img src="assets/jokers/' + icon + '.png" alt=""></span><div><b>' + RT.t(key) + "</b><br>" + RT.t(desc) + "</div></div>";
    };
    var steps = [
      { e: '<span class="t-row">' + [1, 2, 3].map(function () { return RT.tileImg("scallop", "t-tile"); }).join("") + "</span>", k: "t1" },
      { e: '<span class="t-tray">' + ["clownfish", "clownfish", "crab", "starfish", "starfish", "octopus"].map(function (n) { return RT.tileImg(n, "t-mini"); }).join("") + "<i></i></span>", k: "t2" },
      { e: '<span class="t-layers"><b>' + RT.tileImg("turtle", "t-face") + '</b><b class="dim">' + RT.tileImg("jellyfish", "t-face") + "</b></span>", k: "t3" },
      { e: "", k: "t4", extra: J("undo", "jUndo", "t4Undo") + J("remove", "jRemove", "t4Remove") + J("shuffle", "jShuffle", "t4Shuffle") + J("expand", "jExpand", "t4Expand") },
      { e: "🏆", k: "t5" }
    ];
    var s = steps[step], last = step === steps.length - 1;
    var dots = steps.map(function (_, i) { return '<i class="' + (i === step ? "on" : "") + '"></i>'; }).join("");
    handlers.next = function () {
      if (last) { finishTutorial(); return; }
      showTutorial(step + 1);
    };
    handlers.skip = finishTutorial;
    openModal(
      (last ? "" : '<button class="m-skip" data-m="skip">' + RT.t("tSkip") + "</button>") +
      (s.e ? '<div class="m-emoji t-visual">' + s.e + "</div>" : "") +
      "<h2>" + RT.t(s.k + "Title") + "</h2>" +
      "<p>" + RT.t(s.k + "Text") + "</p>" + (s.extra || "") +
      '<div class="dots">' + dots + "</div>" +
      '<button class="btn btn-play" data-m="next">' + RT.t(last ? "tStart" : "tNext") + "</button>",
      { cls: "tutorial" }
    );
  }
  function finishTutorial() {
    var first = !RT.save.tutorialSeen;
    RT.save.tutorialSeen = true;
    RT.persist();
    closeModal();
    if (first && RT.dailyAvailable()) showDaily(); // ilk açılışta eğitimden sonra 1. günün ödülü
  }

  // ---------- Menü butonları ----------
  var ACTIONS = {
    play: play,
    "open-tutorial": function () { showTutorial(0); },
    "open-settings": showSettings,
    "open-shop": showShop,
    "open-daily": showDaily,
    pause: showPause
  };
  document.querySelectorAll("[data-action]").forEach(function (b) {
    b.addEventListener("click", function () { RT.sfx("click"); ACTIONS[b.dataset.action](); });
  });

  // İlk dokunuşta sesi aç (tarayıcı kuralı)
  document.addEventListener("pointerdown", RT.unlockAudio, { once: false, passive: true });

  // ---------- Dekoratif kabarcıklar ----------
  (function bubbles() {
    var host = document.getElementById("bubbles");
    for (var i = 0; i < 18; i++) {
      var b = document.createElement("i");
      var size = 6 + Math.random() * 18;
      b.style.width = b.style.height = size + "px";
      b.style.left = Math.random() * 100 + "%";
      b.style.animationDuration = (9 + Math.random() * 12) + "s";
      b.style.animationDelay = (-Math.random() * 20) + "s";
      host.appendChild(b);
    }
  })();

  // ---------- Açılış ----------
  var saved = RT.save.settings.lang;
  RT.lang = saved || ((navigator.language || "tr").toLowerCase().indexOf("tr") === 0 ? "tr" : "en");
  RT.applyI18n();
  refreshHud();
  if (!RT.save.tutorialSeen) showTutorial(0);
  else if (RT.dailyAvailable()) showDaily(); // her gün ilk açılışta takvim kendiliğinden açılır
})();
