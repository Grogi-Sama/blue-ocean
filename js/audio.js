// Ses efektleri ve müzik — şimdilik tamamen Web Audio ile kodla üretiliyor
// (dosya yok). Gerçek ses/müzik dosyaları geldiğinde bu modülün içi
// değiştirilir; oyunun geri kalanı yalnızca RT.sfx("isim") çağırır.
(function () {
  var ctx = null, master = null, musicGain = null, sfxGain = null;
  var musicTimer = null;
  var musicVoices = []; // çalan müzik notaları (kapatınca hepsi anında durdurulur)

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { return false; }
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    sfxGain = ctx.createGain(); sfxGain.gain.value = sfxLevel(); sfxGain.connect(master);
    musicGain = ctx.createGain(); musicGain.gain.value = 0; musicGain.connect(master);
    // Motor açılınca/kapanınca (iPhone'da telefon araması, kilit ekranı vb.) müziği güncelle
    ctx.onstatechange = function () { RT.updateMusic(); };
    return true;
  }

  // Ayarlardaki 0-100 seviyeleri kazanca (gain) çevrilir
  function sfxLevel() { return 0.6 * RT.save.settings.sfxVol / 100; }
  function musicLevel() { return 1.0 * RT.save.settings.musicVol / 100; }

  RT.setSfxVolume = function () { if (sfxGain) sfxGain.gain.value = sfxLevel(); };

  // Tarayıcılar sesi ancak kullanıcı dokunduktan sonra açmaya izin veriyor.
  // iPhone (Safari) bunu parmak ekrana DEĞDİĞİNDE (pointerdown) değil, dokunma
  // TAMAMLANINCA (touchend / click) kabul ediyor; bu yüzden o olaylarda çağrılır.
  RT.unlockAudio = function () {
    if (!ensure()) return;
    if (ctx.state === "running") { RT.updateMusic(); return; }
    // "suspended" ya da iPhone'a özgü "interrupted": yeniden başlat; açılınca müzik
    // onstatechange / then ile başlar (açılmadan müziği başlatmaya çalışmak işe yaramaz)
    try {
      var p = ctx.resume();
      if (p && p.then) p.then(RT.updateMusic, function () {});
    } catch (e) {}
    // Eski iOS sürümleri için: dokunma anında kısa bir sessiz ses çalmak motoru açar
    try {
      var b = ctx.createBuffer(1, 1, 22050), src = ctx.createBufferSource();
      src.buffer = b; src.connect(ctx.destination); src.start(0);
    } catch (e) {}
  };
  ["touchend", "pointerup", "click", "keydown"].forEach(function (ev) {
    document.addEventListener(ev, RT.unlockAudio, { capture: true, passive: true });
  });

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
    if (opts.dest === musicGain) {
      musicVoices.push(o);
      o.onended = function () { var i = musicVoices.indexOf(o); if (i > -1) musicVoices.splice(i, 1); };
    }
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
    if (!RT.save.settings.sfxVol || !ensure()) return;
    if (ctx.state !== "running") { RT.unlockAudio(); return; }
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

  // Müziği TAMAMEN durdur: zamanlayıcıyı kapat ve çalan/sıradaki tüm notaları kes.
  // (Sadece ses seviyesini 0'a indirmek bazı Android tarayıcılarında uygulanmıyordu.)
  function stopMusicNow() {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    musicVoices.slice().forEach(function (o) { try { o.stop(); } catch (e) {} });
    musicVoices = [];
  }

  RT.updateMusic = function () {
    if (!ctx) return;
    var on = RT.save.settings.musicVol > 0 && ctx.state === "running";
    var now = ctx.currentTime;
    musicGain.gain.cancelScheduledValues(now);
    if (!on) {
      musicGain.gain.setValueAtTime(0, now);
      stopMusicNow();
      return;
    }
    // Seviyeye yumuşakça geç (çubuk sürüklenirken de pürüzsüz)
    musicGain.gain.setTargetAtTime(musicLevel(), now, 0.12);
    if (!musicTimer) {
      playChord();
      musicTimer = setInterval(playChord, 7000);
    }
  };

  // Test/teşhis için: ses motorunun anlık durumu
  RT.audioState = function () {
    return { state: ctx ? ctx.state : "none", musicPlaying: !!musicTimer, musicVoices: musicVoices.length };
  };

  // Uygulama arka plana geçince sesi durdur (telefonda önemli). Geri gelince
  // yeniden açmayı dene; iPhone izin vermezse bir sonraki dokunuşta açılır.
  document.addEventListener("visibilitychange", function () {
    if (!ctx) return;
    if (document.hidden) { stopMusicNow(); ctx.suspend(); }
    else { try { ctx.resume().then(RT.updateMusic, function () {}); } catch (e) {} }
  });
})();
