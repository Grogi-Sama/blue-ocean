// Ses efektleri ve müzik — şimdilik tamamen Web Audio ile kodla üretiliyor
// (dosya yok). Gerçek ses/müzik dosyaları geldiğinde bu modülün içi
// değiştirilir; oyunun geri kalanı yalnızca RT.sfx("isim") çağırır.
(function () {
  var ctx = null, master = null, musicGain = null, sfxGain = null;
  var musicTimer = null;

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { return false; }
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.5; sfxGain.connect(master);
    musicGain = ctx.createGain(); musicGain.gain.value = 0; musicGain.connect(master);
    return true;
  }

  // Tarayıcılar sesi ancak ilk dokunuştan sonra açmaya izin veriyor
  RT.unlockAudio = function () {
    if (!ensure()) return;
    if (ctx.state === "suspended") ctx.resume();
    RT.updateMusic();
  };

  function tone(freq, start, dur, opts) {
    opts = opts || {};
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = opts.type || "sine";
    o.frequency.setValueAtTime(freq, start);
    if (opts.slideTo) o.frequency.exponentialRampToValueAtTime(opts.slideTo, start + dur);
    var vol = opts.vol || 0.3;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + (opts.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g); g.connect(opts.dest || sfxGain);
    o.start(start); o.stop(start + dur + 0.05);
  }

  var SFX = {
    // Taşa dokunma: yumuşak kabarcık "blup"
    tap: function (t) { tone(420, t, 0.12, { slideTo: 780, vol: 0.25 }); },
    // Üçleme: yükselen parlak arpej
    match: function (t) {
      [660, 880, 1320].forEach(function (f, i) { tone(f, t + i * 0.06, 0.25, { type: "triangle", vol: 0.2 }); });
    },
    joker: function (t) { tone(300, t, 0.3, { slideTo: 900, type: "triangle", vol: 0.2 }); },
    click: function (t) { tone(600, t, 0.06, { vol: 0.15 }); },
    error: function (t) { tone(200, t, 0.18, { type: "square", vol: 0.08 }); },
    win: function (t) {
      [523, 659, 784, 1046, 1318].forEach(function (f, i) { tone(f, t + i * 0.1, 0.5, { type: "triangle", vol: 0.2 }); });
    },
    lose: function (t) {
      [392, 330, 262].forEach(function (f, i) { tone(f, t + i * 0.18, 0.45, { type: "sine", vol: 0.22 }); });
    }
  };

  RT.sfx = function (name) {
    if (!RT.save.settings.sound || !ensure() || ctx.state !== "running") return;
    if (SFX[name]) SFX[name](ctx.currentTime);
  };

  // ---- Müzik: yavaş, yumuşak akor dizisi + ara sıra kabarcık notaları ----
  // Geçici (placeholder). Sonra telifsiz gerçek bir parçayla değiştireceğiz.
  var CHORDS = [
    [220.0, 277.2, 329.6], // A
    [185.0, 233.1, 277.2], // F#m
    [146.8, 185.0, 220.0], // D
    [164.8, 207.7, 246.9]  // E
  ];
  var chordIdx = 0;

  function playChord() {
    var t = ctx.currentTime, ch = CHORDS[chordIdx++ % CHORDS.length];
    ch.forEach(function (f) {
      tone(f, t, 7.5, { attack: 2.5, vol: 0.07, dest: musicGain });
      tone(f * 2, t + 0.02, 7.5, { attack: 3, vol: 0.02, dest: musicGain });
    });
    // Birkaç rastgele "damla" notası (pentatonik, hep uyumlu)
    for (var i = 0; i < 3; i++) {
      var note = ch[Math.floor(Math.random() * 3)] * 4;
      tone(note, t + 1 + Math.random() * 5, 1.6, { attack: 0.02, vol: 0.025, type: "triangle", dest: musicGain });
    }
  }

  RT.updateMusic = function () {
    if (!ctx) return;
    var on = RT.save.settings.music && ctx.state === "running";
    musicGain.gain.cancelScheduledValues(ctx.currentTime);
    musicGain.gain.linearRampToValueAtTime(on ? 0.8 : 0, ctx.currentTime + 1);
    if (on && !musicTimer) {
      playChord();
      musicTimer = setInterval(playChord, 7000);
    } else if (!on && musicTimer) {
      clearInterval(musicTimer); musicTimer = null;
    }
  };

  // Uygulama arka plana geçince müziği durdur (telefonda önemli)
  document.addEventListener("visibilitychange", function () {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else { ctx.resume().then(RT.updateMusic); }
  });
})();
