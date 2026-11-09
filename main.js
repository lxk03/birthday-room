/* ===================================================================
   生日小屋 · 交互
   ------------------------------------------------------------------
   十件家具 → 十句话 → 十颗星星 → 蜡烛点亮 → 许愿 → 吹灭
   =================================================================== */
(function () {
  'use strict';

  var CFG = window.ROOM || {};
  var NS = 'http://www.w3.org/2000/svg';
  var body = document.body;

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function rand(a, b) { return a + Math.random() * (b - a); }

  /* ── 节点 ───────────────────────────────────────────────── */
  var svg       = $('#room');
  var starLayer = null;          // build 之后才有
  var hudNum    = $('.hud-num b');
  var hudStars  = $('#hudStars');
  var noteEl    = $('#note');
  var noteWho   = $('#noteWho');
  var noteTxt   = $('#noteTxt');
  var hintEl    = $('#hint');
  var hintTxt   = $('#hintTxt');
  var finaleEl  = $('#finale');
  var confettiEl= $('#confetti');
  var themeName = $('#themeName');
  var soundIco  = $('#soundIco');

  /* ── 常量 ───────────────────────────────────────────────── */
  var ITEM_IDS = ['lights', 'window', 'frame', 'books', 'bed',
                  'record', 'lamp', 'cat', 'balloon', 'gift'];
  var TOTAL = ITEM_IDS.length;

  var LABELS = {
    lights: '灯串', window: '窗', frame: '相框', books: '书架', bed: '床',
    record: '唱片机', lamp: '落地灯', cat: '猫', balloon: '气球',
    gift: '礼物', door: '门', cake: '蛋糕'
  };

  var THEMES = [
    { id: 'warm',  name: '暖光' },
    { id: 'pixel', name: '像素' },
    { id: 'ink',   name: '纸张' }
  ];

  var SKIES = ['day', 'dusk', 'night', 'meteor'];

  var DEFAULT_NOTES = {
    lights:  '灯亮起来的时候我就想，你会不会在门口站了一会儿才推门。',
    window:  '窗外现在是秋天。',
    frame:   '这张照片里你笑得很傻。',
    books:   '书架上的书，你随便拿。',
    bed:     '被子晒过了，困了就躺。',
    record:  '这张唱片有点旧了，但很好听。',
    lamp:    '灯给你留着。',
    cat:     '它说它知道你今天会来。',
    balloon: '别戳，会炸。',
    gift:    '拆的时候轻一点。'
  };

  var NOTES = {};
  ITEM_IDS.forEach(function (id) {
    NOTES[id] = (CFG.notes && CFG.notes[id]) || DEFAULT_NOTES[id];
  });

  var FIN = CFG.finale || {};
  var FIN_HINT  = FIN.hint  || '许个愿，然后吹灭它。';
  var FIN_TITLE = FIN.title || '生日快乐';
  var FIN_LINES = FIN.lines || ['这一年辛苦了。'];
  var FIN_AGAIN = FIN.again || '再看一遍';

  /* ── 存档 ───────────────────────────────────────────────── */
  var KEY = 'birthday-room.v2';
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { saved = {}; }

  var state = {
    visited: new Set(Array.isArray(saved.visited) ? saved.visited : []),
    theme:   saved.theme || 'warm',
    sound:   saved.sound !== false,
    lights:  typeof saved.lights === 'number' ? saved.lights : 0,
    sky:     typeof saved.sky === 'number' ? saved.sky : 1,
    candle:  saved.candle || 'off',
    done:    !!saved.done,
    seen:    !!saved.seen
  };

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        visited: Array.from(state.visited),
        theme: state.theme,
        sound: state.sound,
        lights: state.lights,
        sky: state.sky,
        candle: state.candle,
        done: state.done,
        seen: true
      }));
    } catch (e) { /* 隐身模式，忽略 */ }
  }

  /* ── 声音 ───────────────────────────────────────────────── */
  var ctx = null;
  var master = null;

  function audio() {
    if (!state.sound) return null;
    try {
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();

        master = ctx.createGain();
        master.gain.value = 0.55;
        master.connect(ctx.destination);

        // 一点点空间感
        var delay = ctx.createDelay(1);
        delay.delayTime.value = 0.19;
        var fb = ctx.createGain();
        fb.gain.value = 0.22;
        var wet = ctx.createGain();
        wet.gain.value = 0.26;
        master.connect(delay);
        delay.connect(fb);
        fb.connect(delay);
        delay.connect(wet);
        wet.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    } catch (e) {
      return null;
    }
  }

  /* 八音盒音色 */
  function musicBox(freq, when, dur) {
    var c = audio();
    if (!c) return;
    var t = (when == null ? c.currentTime + 0.05 : when);

    var g = c.createGain();
    g.connect(master);

    var o1 = c.createOscillator();
    o1.type = 'triangle';
    o1.frequency.value = freq;

    var o2 = c.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = freq * 2.01;
    var g2 = c.createGain();
    g2.gain.value = 0.26;

    o1.connect(g);
    o2.connect(g2);
    g2.connect(g);

    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.24, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0008, t + (dur || 0.3) + 0.55);

    o1.start(t); o2.start(t);
    o1.stop(t + (dur || 0.3) + 0.75);
    o2.stop(t + (dur || 0.3) + 0.75);
  }

  function noiseBurst(when, dur, gain, freq) {
    var c = audio();
    if (!c) return;
    var len = Math.max(1, Math.floor(c.sampleRate * dur));
    var buf = c.createBuffer(1, len, c.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = c.createBufferSource();
    src.buffer = buf;

    var f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq || 1200;
    f.Q.value = 0.9;

    var g = c.createGain();
    g.gain.setValueAtTime(gain || 0.2, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);

    src.connect(f); f.connect(g); g.connect(master);
    src.start(when);
    src.stop(when + dur + 0.02);
  }

  function sfx(kind) {
    var c = audio();
    if (!c) return;
    var t = c.currentTime + 0.01;

    switch (kind) {
      case 'click':
        musicBox(1046.5, t, 0.05);
        break;

      case 'chime':
        musicBox(1318.5, t, 0.12);
        musicBox(1975.5, t + 0.07, 0.14);
        break;

      case 'pop':
        noiseBurst(t, 0.16, 0.5, 900);
        break;

      case 'meow': {
        var o = c.createOscillator();
        var g = c.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(620, t);
        o.frequency.exponentialRampToValueAtTime(880, t + 0.11);
        o.frequency.exponentialRampToValueAtTime(520, t + 0.34);
        var f = c.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 1800;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.09, t + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.36);
        o.connect(f); f.connect(g); g.connect(master);
        o.start(t); o.stop(t + 0.4);
        break;
      }

      case 'blow':
        noiseBurst(t, 0.5, 0.32, 700);
        noiseBurst(t + 0.06, 0.4, 0.2, 400);
        break;

      case 'gift':
        musicBox(1046.5, t, 0.08);
        musicBox(1568.0, t + 0.1, 0.1);
        musicBox(2093.0, t + 0.2, 0.16);
        break;

      case 'toggle':
        musicBox(523.25, t, 0.06);
        break;
    }
  }

  /* ── 生日歌 ─────────────────────────────────────────────── */
  var SONG = [
    // 祝你生日快乐
    [['G4', 0.00, .30], ['G4', 0.33, .30], ['A4', 0.66, .30], ['G4', 1.00, .30],
     ['C5', 1.45, .30], ['B4', 1.80, .62]],
    [['G4', 2.52, .30], ['G4', 2.85, .30], ['A4', 3.18, .30], ['G4', 3.52, .30],
     ['D5', 3.97, .30], ['C5', 4.32, .70]],
    [['G4', 5.12, .30], ['G4', 5.45, .30], ['G5', 5.78, .30], ['E5', 6.12, .30],
     ['C5', 6.57, .30], ['B4', 6.90, .30], ['A4', 7.23, .62]],
    [['F5', 7.95, .30], ['F5', 8.28, .30], ['E5', 8.61, .30], ['C5', 8.95, .30],
     ['D5', 9.30, .30], ['C5', 9.63, .95]]
  ];

  var NOTE_HZ = {
    'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
    'C5': 523.25, 'D5': 587.33, 'E5': 659.25,
    'F5': 698.46, 'G5': 783.99
  };

  var songTimers = [];
  var songStopAt = 0;

  function stopSong() {
    songTimers.forEach(function (id) { clearTimeout(id); });
    songTimers = [];
    songStopAt = 0;
  }

  function playSong() {
    var c = audio();
    if (!c) return;
    stopSong();
    var t0 = c.currentTime + 0.12;

    SONG.forEach(function (phrase) {
      phrase.forEach(function (n) {
        var delayMs = (n[1]) * 1000;
        var id = setTimeout(function () {
          var c2 = audio();
          if (!c2) return;
          musicBox(NOTE_HZ[n[0]], c2.currentTime + 0.02, n[2]);
        }, delayMs);
        songTimers.push(id);
      });
    });

    songStopAt = t0 + 11;
  }

  /* ── 音乐（自己的歌） ───────────────────────────────────── */
  var tracks = (CFG.tracks || []).filter(function (t) { return t && t.src; });
  var trackIdx = -1;
  var audioEl = null;
  var recordOn = false;

  function ensureAudioEl() {
    if (audioEl) return audioEl;
    audioEl = new Audio();
    audioEl.preload = 'auto';
    audioEl.addEventListener('ended', function () {
      if (recordOn && tracks.length) nextTrack();
    });
    audioEl.addEventListener('error', function () {
      if (!recordOn) return;
      // 文件找不到时明说，别静默退回八音盒让人以为没切歌
      showNote('唱片机', '这首没加载出来，先放八音盒吧。');
      playSong();
    });
    return audioEl;
  }

  var plays = 0;
  function nextTrack() {
    if (!tracks.length) { playSong(); return; }
    trackIdx = (trackIdx + 1) % tracks.length;
    plays++;
    try {
      var el = ensureAudioEl();
      el.src = tracks[trackIdx].src;
      el.volume = 0.55;
      var p = el.play();
      if (p && p.catch) p.catch(function () {});
      // 第二次起，给个「换到哪首了」的反馈
      if (plays > 1) {
        setTimeout(function () {
          showNote('唱片机', '♪ 第 ' + (trackIdx + 1) + ' 首 · 共 ' + tracks.length + ' 首');
        }, 900);
      }
    } catch (e) {}
  }

  function stopAllAudio() {
    stopSong();
    if (audioEl) { try { audioEl.pause(); } catch (e) {} }
  }

  /* ── 胶卷 / 照片轮播 ────────────────────────────────────── */
  var photos = (CFG.photos || []).filter(Boolean);
  var photoIdx = 0;
  var filmTimer = null;

  function renderFilm() {
    var modal = $('#filmModal');
    if (!modal) return;
    var img = $('#filmImg');
    var empty = $('#filmEmpty');
    var cnt = $('#filmCount');

    if (!photos.length) {
      if (img) img.hidden = true;
      if (empty) {
        empty.hidden = false;
        empty.textContent = CFG.filmEmpty || '照片还在冲洗中……';
      }
      if (cnt) cnt.textContent = '';
      return;
    }
    if (img) { img.hidden = false; img.src = photos[photoIdx]; }
    if (empty) empty.hidden = true;
    if (cnt) cnt.textContent = (photoIdx + 1) + ' / ' + photos.length;
  }

  function scheduleFilm() {
    clearInterval(filmTimer);
    if (photos.length > 1) {
      filmTimer = setInterval(function () { stepFilm(1); }, 3400);
    }
  }

  function stepFilm(d) {
    if (!photos.length) return;
    photoIdx = (photoIdx + d + photos.length) % photos.length;
    renderFilm();
    scheduleFilm();
  }

  function openFilm() {
    var modal = $('#filmModal');
    if (!modal) return;
    photoIdx = 0;
    modal.hidden = false;
    renderFilm();
    scheduleFilm();
    sfx('chime');
  }

  function closeFilm() {
    var modal = $('#filmModal');
    if (!modal) return;
    clearInterval(filmTimer);
    modal.hidden = true;
  }

  /* ── 主题 ───────────────────────────────────────────────── */
  function applyTheme(id) {
    state.theme = id;
    body.dataset.theme = id;
    var t = THEMES.filter(function (x) { return x.id === id; })[0] || THEMES[0];
    if (themeName) themeName.textContent = t.name;
    persist();
  }

  function cycleTheme() {
    var idx = THEMES.map(function (t) { return t.id; }).indexOf(state.theme);
    applyTheme(THEMES[(idx + 1) % THEMES.length].id);
    sfx('click');
  }

  /* ── 声音开关 ───────────────────────────────────────────── */
  function applySound(on) {
    state.sound = on;
    if (soundIco) soundIco.textContent = on ? '🔊' : '🔇';
    var btn = $('#soundBtn');
    if (btn) btn.setAttribute('aria-pressed', String(on));
    persist();
  }

  /* ── 纸条 ───────────────────────────────────────────────── */
  var noteTimer = null;
  var noteHideTimer = null;

  function showNote(who, text) {
    if (!noteEl) return;
    noteWho.textContent = who || '';
    noteTxt.textContent = text || '';
    noteEl.hidden = false;
    clearTimeout(noteTimer);
    clearTimeout(noteHideTimer);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { noteEl.classList.add('show'); });
    });
    noteTimer = setTimeout(function () {
      noteEl.classList.remove('show');
      noteHideTimer = setTimeout(function () { noteEl.hidden = true; }, 340);
    }, 5000);
  }

  /* ── 计数 ───────────────────────────────────────────────── */
  function renderCount(n) {
    if (hudNum) hudNum.textContent = String(n);
    if (hudStars) {
      hudStars.textContent = '★'.repeat(Math.min(n, TOTAL)) + '☆'.repeat(Math.max(0, TOTAL - n));
    }
  }

  /* ── 星星飞行 ───────────────────────────────────────────── */
  var STAR_D = 'M0,-11 L3.2,-3.4 L11,-3.4 L4.8,1.4 L7,9.4 L0,4.6 L-7,9.4 L-4.8,1.4 L-11,-3.4 L-3.2,-3.4 Z';

  function toSvgPoint(clientX, clientY) {
    try {
      var p = svg.createSVGPoint();
      p.x = clientX; p.y = clientY;
      var m = svg.getScreenCTM();
      if (!m) return null;
      return p.matrixTransform(m.inverse());
    } catch (e) {
      return null;
    }
  }

  function flyStar(fromEl) {
    if (!starLayer || !fromEl) return;
    var r = fromEl.getBoundingClientRect();
    if (!r.width && !r.height) return;

    var pt = toSvgPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (!pt) return;

    var star = document.createElementNS(NS, 'path');
    star.setAttribute('d', STAR_D);
    star.setAttribute('class', 'fly-star');
    star.style.transform = 'translate(' + pt.x.toFixed(1) + 'px, ' + pt.y.toFixed(1) + 'px) scale(.45)';
    star.style.opacity = '0';
    starLayer.appendChild(star);

    var tgt = (window.ISOROOM && window.ISOROOM.starTarget) || { x: 611, y: 336 };
    var endX = tgt.x + rand(-24, 24);
    var endY = tgt.y + rand(-14, 10);

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        star.style.opacity = '1';
        star.style.transform = 'translate(' + endX.toFixed(1) + 'px, ' + endY.toFixed(1) + 'px) scale(1.15)';
      });
    });

    setTimeout(function () {
      star.style.opacity = '0';
      star.style.transform = 'translate(' + endX.toFixed(1) + 'px, ' + (endY - 18).toFixed(1) + 'px) scale(1.6)';
      setTimeout(function () {
        if (star.parentNode) star.parentNode.removeChild(star);
      }, 420);
    }, 1100);
  }

  /* ── 各件家具的反应 ─────────────────────────────────────── */
  function toggleLights() {
    if (state.lights === 0) {
      state.lights = 1;
      body.dataset.lights = 'on';
      sfx('toggle');
    } else if (state.lights === 1) {
      state.lights = 2;
      body.dataset.lights = 'on';
      body.dataset.party = 'on';
      sfx('chime');
    } else {
      state.lights = 1;
      delete body.dataset.party;
      sfx('toggle');
    }
    persist();
  }

  function cycleSky() {
    state.sky = (state.sky + 1) % SKIES.length;
    body.dataset.sky = SKIES[state.sky];
    sfx('click');
    persist();
  }

  var frameHue = 0;
  function turnFrame(el) {
    frameHue = (frameHue + 55) % 360;
    var art = $('.frame-art', el);
    if (art) {
      art.style.transition = 'filter .45s ease';
      art.style.filter = 'hue-rotate(' + frameHue + 'deg)';
    }
    animate(el, 'nudge', 480);
    sfx('toggle');
  }

  function toggleRecord() {
    recordOn = true;
    body.dataset.record = 'on';
    stopSong();          // 停掉可能还在响的合成音
    nextTrack();         // 有歌就切下一首，没歌就用八音盒
  }

  var lampOn = false;
  function toggleLamp() {
    lampOn = !lampOn;
    body.dataset.lamp = lampOn ? 'on' : 'off';
    sfx('toggle');
  }

  function pokeCat(el) {
    flash(el, 'cat', 'jump', 660);
    sfx('meow');
  }

  var balloonPopped = false;
  function popBalloon(el) {
    if (balloonPopped) { sfx('click'); return; }
    balloonPopped = true;
    flash(el, 'balloon', 'pop', 400);
    sfx('pop');
    setTimeout(function () {
      body.dataset.balloon = 'gone';
      var b = $('.balloon-body', el);
      if (b) b.style.opacity = '0';
      var s = $('.balloon-string', el);
      if (s) s.style.opacity = '0';
    }, 380);
  }

  function openGift(el) {
    flash(el, 'gift', 'open', 520);
    sfx('gift');
  }

  function bounceBed(el) {
    flash(el, 'bed', 'bounce', 720);
    sfx('toggle');
  }

  function openDoor(el) {
    if (body.dataset.door === 'open') {
      delete body.dataset.door;
    } else {
      body.dataset.door = 'open';
      sfx('toggle');
      setTimeout(function () {
        showNote(LABELS.door, CFG.doorNote || '门没锁。');
      }, 420);
      return;
    }
    sfx('toggle');
  }

  /* 给 body 临时打一个状态 → CSS 播放动画 */
  function flash(el, key, val, ms) {
    body.dataset[key] = val;
    setTimeout(function () {
      if (body.dataset[key] === val) delete body.dataset[key];
    }, ms);
  }

  function animate(el, cls, ms) {
    el.classList.add(cls);
    setTimeout(function () { el.classList.remove(cls); }, ms);
  }

  /* ── 收集 ───────────────────────────────────────────────── */
  function collect(id, el) {
    var fresh = !state.visited.has(id);
    if (fresh) {
      state.visited.add(id);
      renderCount(state.visited.size);
      persist();
      flyStar(el);
      sfx('chime');
    } else {
      sfx('click');
    }

    showNote(LABELS[id], NOTES[id]);

    if (state.visited.size >= TOTAL && state.candle !== 'lit' && state.candle !== 'out') {
      setTimeout(lightCandle, fresh ? 1250 : 300);
    }
    return fresh;
  }

  function lightCandle() {
    if (body.dataset.candle === 'lit') return;
    body.dataset.candle = 'lit';
    state.candle = 'lit';
    persist();
    sfx('chime');
    showNote(LABELS.cake, FIN_HINT);
    playSong();

    setTimeout(function () {
      var cake = $('[data-item="cake"]');
      if (cake) animate(cake, 'cake-pop', 700);
    }, 200);
  }

  function blowOut() {
    if (body.dataset.candle !== 'lit') return;
    body.dataset.candle = 'out';
    state.candle = 'out';
    persist();
    sfx('blow');
    setTimeout(showFinale, 1250);
  }

  /* ── 结局 ───────────────────────────────────────────────── */
  function showFinale() {
    if (!finaleEl) return;
    state.done = true;
    persist();

    $('#finaleTitle').textContent = FIN_TITLE;
    $('#finaleLine1').textContent = FIN_LINES[0] || '';
    $('#finaleLine2').textContent = FIN_LINES[1] || '';
    $('#againBtn').textContent = FIN_AGAIN;

    var dateStr = (CFG.dateText || '') + (CFG.year ? ' · ' + CFG.year : '');
    $('#finaleDate').textContent = dateStr;

    var sig = $('#signature');
    if (sig) {
      sig.textContent = CFG.signature || '';
      if (!CFG.signature) sig.hidden = true;
    }

    finaleEl.hidden = false;
    burstConfetti(130);

    setTimeout(function () { burstConfetti(70); }, 1400);
    setTimeout(function () { burstConfetti(50); }, 2900);
  }

  function hideFinale() {
    if (!finaleEl) return;
    finaleEl.hidden = true;
    confettiEl.innerHTML = '';
    // 蜡烛回到点亮状态，可以再吹一次
    body.dataset.candle = 'lit';
    state.candle = 'lit';
    persist();
    playSong();
  }

  function burstConfetti(n) {
    if (!confettiEl) return;
    var colors = ['#ffd166', '#ef476f', '#06d6a0', '#118ab2', '#f78c6b', '#fff0c9', '#c77dff'];
    for (var i = 0; i < n; i++) {
      var s = document.createElement('i');
      s.style.left = (Math.random() * 100) + 'vw';
      s.style.background = colors[(Math.random() * colors.length) | 0];
      s.style.width = (5 + Math.random() * 6) + 'px';
      s.style.height = (9 + Math.random() * 9) + 'px';
      s.style.setProperty('--dx', (Math.random() * 280 - 140).toFixed(1) + 'px');
      s.style.setProperty('--rot', ((Math.random() * 1000 - 240) | 0) + 'deg');
      s.style.animationDuration = (2.3 + Math.random() * 2.6).toFixed(2) + 's';
      s.style.animationDelay = (Math.random() * 1.5).toFixed(2) + 's';
      s.style.opacity = (0.72 + Math.random() * 0.28).toFixed(2);
      confettiEl.appendChild(s);
    }
    setTimeout(function () {
      $$('i', confettiEl).forEach(function (el) {
        if (el.getAnimations && el.getAnimations().length === 0) el.remove();
      });
    }, 7000);
  }

  /* ── 主点击路由 ─────────────────────────────────────────── */
  function hit(id, el) {
    switch (id) {
      case 'lights':  toggleLights();          collect(id, el); break;
      case 'window':  cycleSky();              collect(id, el); break;
      case 'frame':   turnFrame(el);           collect(id, el); break;
      case 'books':   animate($('[data-item="books"]'), 'nudge', 460); collect(id, el); break;
      case 'bed':     bounceBed(el);           collect(id, el); break;
      case 'record':  toggleRecord();          collect(id, el); break;
      case 'lamp':    toggleLamp();            collect(id, el); break;
      case 'cat':     pokeCat(el);             collect(id, el); break;
      case 'balloon': popBalloon(el);          collect(id, el); break;
      case 'gift':    openGift(el);            collect(id, el); break;
      case 'cake':    return cakeTap();
      case 'door':    return openDoor(el);
      case 'film':    return openFilm();
    }
  }

  function cakeTap() {
    var c = body.dataset.candle;
    if (c === 'lit') return blowOut();
    if (c === 'out') return lightCandle();

    var left = TOTAL - state.visited.size;
    if (left > 0) {
      showNote(LABELS.cake, '还差 ' + left + ' 颗星星，先把屋里点亮吧。');
      sfx('click');
    } else {
      lightCandle();
    }
  }

  /* ── 事件 ───────────────────────────────────────────────── */
  function bindItem() {
    svg.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-item]') : null;
      if (!t) return;
      var id = t.getAttribute('data-item');
      if (!id) return;
      hideHint();
      hit(id, t);
    });

    svg.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
      var t = e.target.closest ? e.target.closest('[data-item]') : null;
      if (!t) return;
      e.preventDefault();
      hideHint();
      hit(t.getAttribute('data-item'), t);
    });
  }

  function hideHint() {
    if (!hintEl || hintEl.classList.contains('hide')) return;
    hintEl.classList.add('hide');
    setTimeout(function () { if (hintEl) hintEl.style.display = 'none'; }, 700);
    state.seen = true;
    persist();
  }

  /* ── 初始化 ─────────────────────────────────────────────── */
  /* 把等距房间挂到 svg 上（两种解析方式，哪个能用用哪个） */
  function mountRoom() {
    if (!window.ISOROOM || !svg) return;
    var markup = window.ISOROOM.build();
    try {
      var doc = new DOMParser().parseFromString(
        '<svg xmlns="http://www.w3.org/2000/svg">' + markup + '</svg>',
        'image/svg+xml'
      );
      if (doc.getElementsByTagName('parsererror').length) throw new Error('parsererror');
      var root = doc.documentElement;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      // 固定次数的循环，杜绝任何"永远移不完"的可能
      var kids = Array.prototype.slice.call(root.childNodes);
      for (var i = 0; i < kids.length; i++) {
        svg.appendChild(document.adoptNode(kids[i]));
      }
    } catch (e) {
      svg.innerHTML = markup;
    }
    starLayer = $('.star-layer');
  }

  function init() {
    // 先把房间画出来
    mountRoom();

    // 主题
    applyTheme(state.theme);
    applySound(state.sound);

    // 灯光
    if (state.lights >= 1) body.dataset.lights = 'on';
    if (state.lights >= 2) body.dataset.party = 'on';

    // 天空
    state.sky = Math.max(0, Math.min(SKIES.length - 1, state.sky));
    body.dataset.sky = SKIES[state.sky];

    // 计数
    renderCount(state.visited.size);

    // 蜡烛
    if (state.candle === 'lit' || state.candle === 'out') {
      body.dataset.candle = state.candle;
    } else if (state.visited.size >= TOTAL) {
      // 上次已经集齐但没点亮（比如刷新在点亮前）
      setTimeout(function () {
        body.dataset.candle = 'lit';
        state.candle = 'lit';
        persist();
      }, 600);
    }

    // 气球 / 唱片等瞬态
    balloonPopped = false;

    // 开场提示
    if (hintEl) {
      hintTxt.textContent = CFG.intro
        ? CFG.intro + ' · 点一点屋里的东西'
        : '点一点屋里的东西';
      if (state.seen || state.visited.size > 0) {
        hintEl.style.display = 'none';
      } else {
        setTimeout(hideHint, 9000);
      }
    }

    // 标题
    if (CFG.who) {
      document.title = '生日小屋 · 给' + CFG.who;
    }

    bindItem();

    // 胶卷轮播
    var fc = $('#filmClose');
    if (fc) fc.addEventListener('click', closeFilm);
    var fp = $('#filmPrev');
    if (fp) fp.addEventListener('click', function () { stepFilm(-1); });
    var fn = $('#filmNext');
    if (fn) fn.addEventListener('click', function () { stepFilm(1); });
    var fm = $('#filmModal');
    if (fm) fm.addEventListener('click', function (e) {
      if (e.target === fm) closeFilm();
    });
    window.addEventListener('keydown', function (e) {
      var m = $('#filmModal');
      if (!m || m.hidden) return;
      if (e.key === 'Escape') closeFilm();
      else if (e.key === 'ArrowLeft') stepFilm(-1);
      else if (e.key === 'ArrowRight') stepFilm(1);
    });

    var tb = $('#themeBtn');
    if (tb) tb.addEventListener('click', cycleTheme);

    var sb = $('#soundBtn');
    if (sb) {
      sb.addEventListener('click', function () {
        applySound(!state.sound);
        if (state.sound) sfx('chime');
        if (!state.sound) stopAllAudio();
      });
    }

    var ab = $('#againBtn');
    if (ab) ab.addEventListener('click', hideFinale);

    // 空格键不要滚动页面
    window.addEventListener('keydown', function (e) {
      if (e.key === ' ' && document.activeElement && document.activeElement.tagName === 'BODY') {
        e.preventDefault();
      }
    }, { passive: false });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
