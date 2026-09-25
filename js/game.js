// Oyun ekranı: tahta, sepet, bekleme alanı (bank) ve jokerler.
(function () {
  var boardEl = document.getElementById("board");
  var wrapEl = document.getElementById("boardWrap");
  var trayEl = document.getElementById("tray");
  var bankEl = document.getElementById("bank");
  var hintEl = document.getElementById("hint");

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
      history: [],         // Geri Al için: sepete atılan son taşlar
      flying: 0,           // uçuş animasyonu süren taş sayısı
      armed: null,         // seçim bekleyen joker (şimdilik yalnızca "remove")
      over: false
    };
    document.getElementById("gameLevel").textContent = level;
    setHint("");
    layout();
    renderBoard();
    renderTray();
    renderBank();
    RT.game.renderJokers();
  };

  RT.game.isActive = function () { return S && !S.over; };

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

  function tileHtml(type) { return '<span class="face">' + type + "</span>"; }

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
        (function (tile) {
          el.addEventListener("pointerdown", function (e) { e.preventDefault(); onTrayTap(tile); });
        })(t);
        if (S.armed === "remove") el.classList.add("selectable");
        slot.appendChild(el);
      }
      trayEl.appendChild(slot);
    }
    // Doluluk uyarısı: son 2 yer kaldığında sepet kırmızımsı parlar
    trayEl.classList.toggle("danger", S.tray.length >= S.trayMax - 2);
  }

  function renderBank() {
    bankEl.innerHTML = "";
    bankEl.classList.toggle("has-items", S.bank.length > 0);
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
    if (S.over || S.armed) { if (S.armed) RT.sfx("error"); return; }
    if (S.tray.length >= S.trayMax) return;
    RT.sfx("tap");

    var from = el.getBoundingClientRect();
    S.tiles.splice(S.tiles.indexOf(t), 1);
    var idx = insertIndex(t.type);
    var trayTile = { id: t.id, type: t.type, ghost: true };
    S.tray.splice(idx, 0, trayTile);
    S.history.push({ tile: t, trayTile: trayTile });
    S.flying++;

    renderBoard();
    renderTray();
    var target = trayEl.children[idx].getBoundingClientRect();
    fly(t.type, from, target, function () {
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
    if (S.tiles.length === 0 && S.tray.length === 0 && S.bank.length === 0) {
      S.over = true;
      RT.save.level = S.level + 1;
      RT.persist();
      setTimeout(function () { RT.sfx("win"); RT.ui.showWin(S.level); }, 350);
    } else if (S.tray.length >= S.trayMax) {
      S.over = true;
      RT.spendLife();
      setTimeout(function () { RT.sfx("lose"); RT.ui.showLose(S.level); }, 350);
    }
  }

  // ---------- Jokerler ----------
  RT.game.renderJokers = function () {
    document.querySelectorAll(".joker").forEach(function (b) {
      var j = b.dataset.joker, n = RT.save.jokers[j];
      var c = b.querySelector(".j-count");
      c.textContent = n > 0 ? n : "+";
      c.classList.toggle("buy", n <= 0);
      b.classList.toggle("armed", S && S.armed === j);
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
    remove: function () {
      if (S.tray.length === 0) { toast(RT.t("trayEmpty")); return false; }
      if (S.bank.length >= RT.CONFIG.BANK_MAX) { toast(RT.t("bankFull")); return false; }
      S.armed = "remove";
      setHint(RT.t("pickTrayTile"));
      renderTray();
      RT.game.renderJokers();
      return "armed"; // joker, taş seçilince harcanır
    },
    shuffle: function () {
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
    // Silah zaten kuruluysa tekrar basmak iptal eder
    if (S.armed === name) { cancelArm(); return; }
    if (S.armed) cancelArm();
    if (RT.save.jokers[name] <= 0) { RT.ui.offerJoker(name); return; }
    var res = JOKERS[name]();
    if (res === true) {
      RT.save.jokers[name]--;
      RT.persist();
      RT.sfx("joker");
    }
    RT.game.renderJokers();
  };

  function onTrayTap(tile) {
    if (S.armed !== "remove" || tile.ghost) return;
    S.tray.splice(S.tray.indexOf(tile), 1);
    S.bank.push({ id: tile.id, type: tile.type });
    S.history = S.history.filter(function (h) { return h.trayTile !== tile; });
    RT.save.jokers.remove--;
    RT.persist();
    RT.sfx("joker");
    cancelArm();
    renderBank();
  }

  function cancelArm() {
    S.armed = null;
    setHint("");
    renderTray();
    RT.game.renderJokers();
  }

  function setHint(txt) { hintEl.textContent = txt; hintEl.classList.toggle("show", !!txt); }
  function toast(txt) { RT.sfx("error"); RT.ui.toast(txt); }

  document.querySelectorAll(".joker").forEach(function (b) {
    b.addEventListener("click", function () { RT.game.useJoker(b.dataset.joker); });
  });

  RT.game.relayout = function () { if (S) { layout(); renderBoard(); renderTray(); renderBank(); } };
})();
