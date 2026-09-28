// Oyun ekranı: tahta, sepet, bekleme alanı (bank) ve jokerler.
(function () {
  var boardEl = document.getElementById("board");
  var wrapEl = document.getElementById("boardWrap");
  var trayEl = document.getElementById("tray");
  var bankEl = document.getElementById("bank");

  var S = null;        // aktif seviyenin durumu
  var unit = 40;       // 1 taş biriminin piksel karşılığı (ekrana göre hesaplanır)
  var FLY_MS = 230;

  RT.game = {};

  RT.game.start = function (level) {
    var built = RT.buildLevel(level);
    S = {
      level: level,
      tiles: built.tiles,
      width: built.width,
      height: built.height,
      tray: [],            // sepetteki taşlar
      bank: [],            // Taşı Kaldır ile bekletilen taşlar
      trayMax: RT.CONFIG.TRAY_SIZE,
      expanded: false,
      continued: false,    // "Reklam izle, devam et" bu seviyede kullanıldı mı
      pickSeq: 0,          // sepete atılma sırası (devam ederken en son atılanları bulmak için)
      history: [],         // Geri Al için: sepete atılan son taşlar
      flying: 0,           // uçuş animasyonu süren taş sayısı
      rescue: false,       // sepet doldu, oyuncu joker kullanarak yer açmaya çalışıyor
      over: false
    };
    document.getElementById("gameLevel").textContent = level;
    layout();
    renderBoard();
    renderTray();
    renderBank();
    RT.game.renderJokers();
  };

  RT.game.isActive = function () { return !!S && !S.over; };
  // Oyun bitmiş (kazanıldı/kaybedildi/çıkıldı) ama ekranda hâlâ duruyor mu?
  // (Kısa süre sonra açılacak bir pencere bekleniyorsa bitmiş sayılmaz.)
  RT.game.isFinished = function () { return !!S && S.over && !S.pending; };

  // Seviyeden çıkış: süren bir oyundan (ya da sepet dolup kayıp kesinleşmek üzereyken)
  // çıkılırsa 1 can düşer; zaten kaybedilmiş/kazanılmış oyundan çıkmak can yakmaz.
  RT.game.quit = function () {
    if (S && !S.lost && (!S.over || S.trayFull)) RT.spendLife();
    if (S) { S.over = true; S.quit = true; }
  };

  // ---------- Yerleşim ----------
  function layout() {
    if (!S) return;
    var w = wrapEl.clientWidth, h = wrapEl.clientHeight;
    unit = Math.floor(Math.min(w / (S.width + 0.2), h / (S.height + 0.25), 64));
    boardEl.style.width = (S.width * unit) + "px";
    boardEl.style.height = (S.height * unit + unit * 0.12) + "px";
    document.documentElement.style.setProperty("--tile", unit + "px");
    var slot = Math.floor(Math.min((trayEl.clientWidth - 16) / S.trayMax, 58));
    document.documentElement.style.setProperty("--slot", slot + "px");
  }
  window.addEventListener("resize", function () { layout(); if (S) { renderBoard(); renderTray(); renderBank(); } });

  function tileHtml(type) { return RT.tileImg(type); }

  // ---------- Tahta ----------
  function renderBoard() {
    boardEl.innerHTML = "";
    var sorted = S.tiles.slice().sort(function (a, b) { return a.layer - b.layer; });
    sorted.forEach(function (t) {
      var el = document.createElement("div");
      var covered = RT.isCovered(t, S.tiles);
      el.className = "tile" + (covered ? " covered" : "");
      el.style.left = (t.x * unit) + "px";
      el.style.top = (t.y * unit) + "px";
      el.style.zIndex = t.layer + 1;
      el.innerHTML = tileHtml(t.type);
      el.dataset.id = t.id;
      if (!covered) el.addEventListener("pointerdown", function (e) { e.preventDefault(); pickTile(t, el); });
      boardEl.appendChild(el);
    });
  }

  // ---------- Sepet ----------
  function renderTray(ghostIndex) {
    trayEl.innerHTML = "";
    trayEl.classList.toggle("expanded", S.expanded);
    for (var i = 0; i < S.trayMax; i++) {
      var slot = document.createElement("div");
      slot.className = "slot";
      var t = S.tray[i];
      if (t) {
        var el = document.createElement("div");
        el.className = "tile in-tray" + (i === ghostIndex || t.ghost ? " ghost" : "");
        el.innerHTML = tileHtml(t.type);
        slot.appendChild(el);
      }
      trayEl.appendChild(slot);
    }
    // Doluluk uyarısı: son 2 yer kaldığında sepet kırmızımsı parlar
    trayEl.classList.toggle("danger", S.tray.length >= S.trayMax - 2);
  }

  function renderBank() {
    bankEl.innerHTML = "";
    var had = bankEl.classList.contains("has-items");
    bankEl.classList.toggle("has-items", S.bank.length > 0);
    // Alan açılıp kapanınca tahtanın sığacağı yükseklik değişir
    if (had !== S.bank.length > 0) setTimeout(function () { if (S) { layout(); renderBoard(); } }, 220);
    S.bank.forEach(function (t) {
      var el = document.createElement("div");
      el.className = "tile in-bank";
      el.innerHTML = tileHtml(t.type) + '<span class="lock">🔒</span>';
      bankEl.appendChild(el);
    });
  }

  // Aynı türden taş sepette varsa yanına, yoksa sona eklenir
  function insertIndex(type) {
    var idx = -1;
    for (var i = 0; i < S.tray.length; i++) if (S.tray[i].type === type) idx = i;
    return idx === -1 ? S.tray.length : idx + 1;
  }

  // ---------- Taş seçme ----------
  function pickTile(t, el) {
    if (S.over) return;
    if (S.tray.length >= S.trayMax) return;
    if (S.tiles.indexOf(t) === -1) return;
    RT.sfx("tap");

    var from = el.getBoundingClientRect();
    S.tiles.splice(S.tiles.indexOf(t), 1);
    var idx = insertIndex(t.type);
    var trayTile = { id: t.id, type: t.type, ghost: true, orig: t, seq: ++S.pickSeq };
    S.tray.splice(idx, 0, trayTile);
    S.history.push({ tile: t, trayTile: trayTile });
    S.flying++;

    renderBoard();
    renderTray();
    var target = trayEl.children[idx].getBoundingClientRect();
    var st = S;
    fly(t.type, from, target, function () {
      if (st !== S) return; // seviye değişti; eski animasyon yeni seviyeyi etkilemesin
      trayTile.ghost = false;
      S.flying--;
      resolveMatches();
      renderTray();
      checkEnd();
    });
  }

  function fly(type, from, to, done) {
    var f = document.createElement("div");
    f.className = "tile flyer";
    f.innerHTML = tileHtml(type);
    f.style.left = from.left + "px"; f.style.top = from.top + "px";
    f.style.width = from.width + "px"; f.style.height = from.height + "px";
    f.style.setProperty("--tile", from.width + "px");
    document.body.appendChild(f);
    f.getBoundingClientRect(); // tarayıcıya başlangıç konumunu kaydettir
    f.style.transition = "all " + FLY_MS + "ms cubic-bezier(.3,.7,.4,1)";
    f.style.left = to.left + "px"; f.style.top = to.top + "px";
    f.style.width = to.width + "px"; f.style.height = to.height + "px";
    setTimeout(function () { f.remove(); done(); }, FLY_MS);
  }

  // Sepet + bekleme alanında aynı türden 3 taş olunca hepsi temizlenir
  function resolveMatches() {
    var counts = {};
    S.tray.forEach(function (t) { if (!t.ghost) counts[t.type] = (counts[t.type] || 0) + 1; });
    S.bank.forEach(function (t) { counts[t.type] = (counts[t.type] || 0) + 1; });
    for (var type in counts) {
      if (counts[type] < 3) continue;
      var need = 3;
      // Önce bekleme alanındakiler kullanılır (onlar zaten bunun için bekliyor)
      S.bank = S.bank.filter(function (t) { if (need > 0 && t.type === type) { need--; return false; } return true; });
      S.tray = S.tray.filter(function (t) { if (need > 0 && !t.ghost && t.type === type) { need--; return false; } return true; });
      S.history = []; // eşleşen hamleler geri alınamaz
      RT.sfx("match");
      popEffect();
      renderBank();
    }
  }

  function popEffect() {
    trayEl.classList.remove("pop"); void trayEl.offsetWidth; trayEl.classList.add("pop");
  }

  function checkEnd() {
    if (S.over || S.flying > 0) return;
    var st = S;
    // Gecikmeli pencereler yalnızca oyuncu hâlâ bu seviyedeyse açılır
    // (aradaki 0,35 sn'de ☰ → Seviyeden Çık'a basılmış olabilir)
    function later(fn) {
      st.pending = true;
      setTimeout(function () { st.pending = false; if (st === S && !st.quit) fn(); }, 350);
    }
    if (S.tiles.length === 0 && S.tray.length === 0 && S.bank.length === 0) {
      S.over = true;
      RT.save.level = S.level + 1;
      RT.persist();
      later(function () { RT.sfx("win"); RT.ui.showWin(st.level); });
    } else if (S.tray.length >= S.trayMax) {
      S.over = true;
      S.trayFull = true;   // kayıp bekliyor (devam/joker ile kurtarılabilir)
      S.rescue = false;
      var canContinue = !S.continued, canRescue = rescuePossible();
      if (canContinue || canRescue) {
        // Devam (seviye başına 1 kez) ve/veya elindeki jokerle yer açma seçeneği
        later(function () {
          RT.sfx("error");
          RT.ui.showContinue(canContinue ? continueLevel : null, loseLevel, canRescue ? startRescue : null);
        });
      } else {
        later(loseLevel);
      }
    }
  }

  // Sepette yer açabilecek, elde olan bir joker var mı? (Karıştır yer açmaz)
  function rescuePossible() {
    var j = RT.save.jokers, trayN = S.tray.length;
    return (j.undo > 0 && S.history.length > 0) ||
           (j.remove > 0 && trayN > 0 && S.bank.length + Math.min(3, trayN) <= RT.CONFIG.BANK_MAX) ||
           (j.expand > 0 && !S.expanded);
  }

  // Pencere kapanır, oyuncu jokerlerle sepette yer açabilir
  function startRescue() {
    S.over = false;
    S.trayFull = false;
    S.rescue = true;
    RT.ui.toast(RT.t("rescueHint"), 3500);
  }

  // Kurtarma sırasında yer açılamadıysa (joker başarısız / satın alınmadı) pencereyi yeniden göster
  RT.game.recheck = function () {
    if (!S || !S.rescue || S.over) return;
    if (S.tray.length < S.trayMax) { S.rescue = false; return; }
    S.rescue = false;
    checkEnd();
  };

  function loseLevel() {
    if (S.lost) return; // aynı kayıp iki kez sayılmasın
    S.lost = true;
    S.over = true;
    RT.spendLife();
    RT.sfx("lose");
    RT.ui.showLose(S.level);
  }

  // Sepete en son atılan 3 taş, alındıkları yere en üst katmandan geri döner
  // (üstleri açık olur, hemen tekrar alınabilirler)
  function continueLevel() {
    S.continued = true;
    var top = S.tiles.reduce(function (m, t) { return Math.max(m, t.layer); }, 0);
    var back = S.tray.slice().sort(function (a, b) { return b.seq - a.seq; }).slice(0, 3);
    back.forEach(function (tt, i) {
      S.tray.splice(S.tray.indexOf(tt), 1);
      tt.orig.layer = top + 1 + i;
      S.tiles.push(tt.orig);
    });
    S.history = [];
    S.over = false;
    S.trayFull = false;
    S.rescue = false;
    renderBoard(); renderTray();
  }

  // ---------- Jokerler ----------
  RT.game.renderJokers = function () {
    document.querySelectorAll(".joker").forEach(function (b) {
      var j = b.dataset.joker, n = RT.save.jokers[j];
      var c = b.querySelector(".j-count");
      c.textContent = n > 0 ? n : "+";
      c.classList.toggle("buy", n <= 0);
    });
  };

  var JOKERS = {
    undo: function () {
      if (S.flying > 0) return false;
      var last = S.history.pop();
      if (!last) { toast(RT.t("nothingToUndo")); return false; }
      S.tray.splice(S.tray.indexOf(last.trayTile), 1);
      S.tiles.push(last.tile);
      renderBoard(); renderTray();
      return true;
    },
    // Orijinaldeki gibi: sepetin baştaki (en soldaki) 3 taşı sepetin üstündeki
    // bekleme alanına çıkar. Orada kilitli durup eşleri sepete gelince onlarla eşleşir.
    remove: function () {
      if (S.flying > 0) return false;
      var ready = S.tray.filter(function (t) { return !t.ghost; });
      if (ready.length === 0) { toast(RT.t("trayEmpty")); return false; }
      var moving = ready.slice(0, 3);
      if (S.bank.length + moving.length > RT.CONFIG.BANK_MAX) { toast(RT.t("bankFull")); return false; }
      moving.forEach(function (t) {
        S.tray.splice(S.tray.indexOf(t), 1);
        S.bank.push({ id: t.id, type: t.type });
      });
      S.history = []; // bekleme alanına çıkan taşlar geri alınamaz
      renderTray(); renderBank();
      return true;
    },
    shuffle: function () {
      if (S.tiles.length < 2) { toast(RT.t("nothingToShuffle")); return false; }
      var types = RT.shuffle(S.tiles.map(function (t) { return t.type; }));
      S.tiles.forEach(function (t, i) { t.type = types[i]; });
      boardEl.classList.remove("shake"); void boardEl.offsetWidth; boardEl.classList.add("shake");
      renderBoard();
      return true;
    },
    expand: function () {
      if (S.expanded) { toast(RT.t("alreadyExpanded")); return false; }
      S.expanded = true;
      S.trayMax += 1;
      layout(); renderTray();
      return true;
    }
  };

  RT.game.useJoker = function (name) {
    if (!S || S.over) return;
    if (S.rescue && name === "shuffle") { RT.sfx("error"); RT.ui.toast(RT.t("rescueHint"), 3500); return; }
    if (RT.save.jokers[name] <= 0) {
      // Kurtarma sırasında satın almadan kapatılırsa "Sepet Doldu" penceresi geri gelir
      RT.ui.offerJoker(name, S.rescue ? RT.game.recheck : null);
      return;
    }
    var res = JOKERS[name]();
    if (res === true) {
      RT.save.jokers[name]--;
      RT.persist();
      RT.sfx("joker");
    }
    RT.game.renderJokers();
    if (S.rescue) {
      if (S.tray.length < S.trayMax) S.rescue = false;       // yer açıldı, oyun sürüyor
      else setTimeout(RT.game.recheck, 900);                 // açılamadı: seçenekler yeniden
    }
  };

  function toast(txt) { RT.sfx("error"); RT.ui.toast(txt); }

  document.querySelectorAll(".joker").forEach(function (b) {
    b.addEventListener("click", function () { RT.game.useJoker(b.dataset.joker); });
  });

  RT.game.relayout = function () { if (S) { layout(); renderBoard(); renderTray(); renderBank(); } };
})();
