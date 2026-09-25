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
    var nl = document.getElementById("noLivesTimer");
    if (nl) nl.textContent = RT.formatTime(RT.msToNextLife());
  }
  RT.ui.refreshHud = refreshHud;
  setInterval(refreshHud, 1000);

  // ---------- Modal yardımcıları ----------
  function openModal(html, opts) {
    card.innerHTML = html;
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
    toastEl.textContent = txt;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 1800);
  };

  // ---------- Oyun başlatma ----------
  function play() {
    RT.tickLives();
    if (RT.save.lives <= 0) { showNoLives(); return; }
    closeModal();
    show("game");
    RT.game.start(RT.save.level);
  }

  // ---------- Kazandın / Kaybettin ----------
  RT.ui.showWin = function (level) {
    handlers.next = play;
    handlers.menu = function () { closeModal(); show("menu"); };
    openModal(
      '<div class="m-emoji">🏆</div>' +
      "<h2>" + RT.t("winTitle") + "</h2>" +
      "<p>" + RT.t("level") + " " + level + " — " + RT.t("winText") + "</p>" +
      '<button class="btn btn-play" data-m="next">' + RT.t("nextLevel") + "</button>" +
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

  // ---------- Duraklatma ----------
  function showPause() {
    handlers.resume = closeModal;
    handlers.quit = function () { RT.spendLife(); closeModal(); show("menu"); };
    handlers.settings = showSettings;
    openModal(
      "<h2>" + RT.t("pauseTitle") + "</h2>" +
      '<button class="btn btn-play" data-m="resume">' + RT.t("resume") + "</button>" +
      '<button class="btn btn-soft" data-m="settings">⚙️ ' + RT.t("settings") + "</button>" +
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

  // Sahte reklam: gerçek reklam SDK'sı (ör. AdMob) mobil pakette eklenecek
  function watchAd(onDone) {
    openModal('<div class="m-emoji spin">📺</div><h2>' + RT.t("adPlaying") + '</h2><div class="ad-bar"><i></i></div>');
    setTimeout(onDone, 2500);
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
      '<div class="m-emoji">🪙</div><h2>' + RT.t("shopTitle") + "</h2>" + packs +
      '<p class="small">' + RT.t("shopNote") + "</p>"
    );
  }

  // ---------- Joker satın alma ----------
  var JOKER_NAME_KEY = { undo: "jUndo", remove: "jRemove", shuffle: "jShuffle", expand: "jExpand" };
  RT.ui.offerJoker = function (name) {
    handlers.close = closeModal;
    handlers.buyJoker = function () {
      if (!RT.spendCoins(RT.CONFIG.JOKER_PRICE)) { RT.ui.toast(RT.t("notEnoughCoins")); showShop(); return; }
      RT.save.jokers[name]++; RT.persist(); closeModal(); refreshHud(); RT.game.renderJokers();
    };
    openModal(
      '<button class="m-close" data-m="close">✕</button>' +
      "<h2>" + RT.t("jokerEmptyTitle") + "</h2>" +
      "<p>" + RT.t("jokerEmptyText", { name: RT.t(JOKER_NAME_KEY[name]) }) + "</p>" +
      '<button class="btn btn-play" data-m="buyJoker">' + RT.t("buyFor", { c: RT.CONFIG.JOKER_PRICE }) + "</button>" +
      '<p class="small">🪙 ' + RT.save.coins + "</p>"
    );
  };

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
      return '<div class="t-joker"><span class="j-icon">' + icon + "</span><div><b>" + RT.t(key) + "</b><br>" + RT.t(desc) + "</div></div>";
    };
    var steps = [
      { e: "🐚🐚🐚", k: "t1" },
      { e: '<span class="t-tray">' + "🐠🐠🦀⭐⭐🐙<i></i>" + "</span>", k: "t2" },
      { e: '<span class="t-layers"><b>🐢</b><b class="dim">🦑</b></span>', k: "t3" },
      { e: "", k: "t4", extra: J("↩️", "jUndo", "t4Undo") + J("🪝", "jRemove", "t4Remove") + J("🌀", "jShuffle", "t4Shuffle") + J("➕", "jExpand", "t4Expand") },
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
    RT.save.tutorialSeen = true;
    RT.persist();
    closeModal();
  }

  // ---------- Menü butonları ----------
  var ACTIONS = {
    play: play,
    "open-tutorial": function () { showTutorial(0); },
    "open-settings": showSettings,
    "open-shop": showShop,
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
})();
