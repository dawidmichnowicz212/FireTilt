(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const BASE_W = 1600;
  const BASE_H = 900;
  const RAD = Math.PI / 180;

  const ui = {
    pair: document.getElementById('pairOverlay'),
    countdown: document.getElementById('countdownOverlay'),
    result: document.getElementById('resultOverlay'),
    countNumber: document.getElementById('countNumber'),
    roomCode: document.getElementById('roomCode'),
    qr: document.getElementById('qrCode'),
    time: document.getElementById('timeValue'),
    fires: document.getElementById('fireValue'),
    score: document.getElementById('scoreValue'),
    threat: document.getElementById('threatValue'),
    threatFill: document.getElementById('threatFill'),
    connectionText: document.getElementById('connectionText'),
    connectionDot: document.getElementById('connectionDot'),
    finalScore: document.getElementById('finalScore'),
    finalTime: document.getElementById('finalTime'),
    finalAccuracy: document.getElementById('finalAccuracy'),
    finalFires: document.getElementById('finalFires'),
    resultTitle: document.getElementById('resultTitle'),
    resultText: document.getElementById('resultText')
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const random = (min, max) => min + Math.random() * (max - min);
  const lerp = (a, b, t) => a + (b - a) * t;

  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let dpr = 1;

  function resizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;

    scale = Math.min(window.innerWidth / BASE_W, window.innerHeight / BASE_H);
    offsetX = (window.innerWidth - BASE_W * scale) / 2;
    offsetY = (window.innerHeight - BASE_H * scale) / 2;
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  const assets = {};
  const assetFiles = {
    house: 'assets/house.svg',
    shed: 'assets/shed.svg',
    tree: 'assets/tree.svg',
    dumpster: 'assets/dumpster.svg',
    crates: 'assets/crates.svg',
    hydrant: 'assets/hydrant.svg',
    fence: 'assets/fence.svg',
    bench: 'assets/bench.svg',
    truck: 'assets/firetruck.svg',
    nozzle: 'assets/nozzle.svg'
  };

  function loadAssets() {
    Object.entries(assetFiles).forEach(([name, file]) => {
      const img = new Image();
      img.src = file;
      assets[name] = img;
    });
  }
  loadAssets();

  const sceneObjects = [
    { asset: 'tree', x: 55, y: 315, w: 235, h: 352 },
    { asset: 'house', x: 310, y: 235, w: 470, h: 362 },
    { asset: 'fence', x: 15, y: 610, w: 360, h: 87 },
    { asset: 'bench', x: 405, y: 586, w: 180, h: 104 },
    { asset: 'hydrant', x: 600, y: 570, w: 85, h: 135 },
    { asset: 'dumpster', x: 840, y: 575, w: 190, h: 114 },
    { asset: 'shed', x: 1000, y: 352, w: 285, h: 222 },
    { asset: 'crates', x: 1210, y: 495, w: 205, h: 144 },
    { asset: 'tree', x: 1370, y: 325, w: 205, h: 308 }
  ];

  const fireTemplate = [
    { id: 'tree', x: 180, y: 421, radius: 62, power: 0.82 },
    { id: 'roof', x: 520, y: 318, radius: 70, power: 0.95 },
    { id: 'window', x: 665, y: 430, radius: 53, power: 0.76 },
    { id: 'dumpster', x: 938, y: 595, radius: 50, power: 0.74 },
    { id: 'shed', x: 1130, y: 410, radius: 67, power: 0.92 },
    { id: 'crates', x: 1310, y: 536, radius: 57, power: 0.78 }
  ];

  let fires = [];
  let water = [];
  let smoke = [];
  let sparks = [];
  let steam = [];

  let gameState = 'pairing';
  let startTime = 0;
  let elapsed = 0;
  let score = 0;
  let shots = 0;
  let hits = 0;
  let extinguished = 0;
  let lastFrame = performance.now();
  let sceneTime = 0;

  let targetAim = 0;
  let aim = 0;
  let waterTimer = 0;
  let keyboardMode = false;
  const keys = { left: false, right: false };

  const truck = {
    x: 560,
    y: 616,
    w: 480,
    h: 231
  };

  const nozzle = {
    x: 800,
    y: 660,
    length: 180,
    maxAngle: 72
  };

  function resetFires() {
    fires = fireTemplate.map(fire => ({
      ...fire,
      intensity: fire.power,
      maxIntensity: 1.3,
      out: false,
      hit: 0,
      growDelay: random(0, 2)
    }));
  }

  function resetGame() {
    resetFires();
    water = [];
    smoke = [];
    sparks = [];
    steam = [];
    elapsed = 0;
    score = 0;
    shots = 0;
    hits = 0;
    extinguished = 0;
    targetAim = 0;
    aim = 0;
    waterTimer = 0;
    updateHud();
  }
  resetGame();

  function formatTime(seconds) {
    const value = Math.max(0, Math.floor(seconds));
    return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  }

  function drawSky() {
    const gradient = ctx.createLinearGradient(0, 0, 0, BASE_H);
    gradient.addColorStop(0, '#07111e');
    gradient.addColorStop(0.55, '#10283a');
    gradient.addColorStop(1, '#17242d');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, BASE_W, BASE_H);

    ctx.fillStyle = 'rgba(232, 241, 255, .85)';
    ctx.beginPath();
    ctx.arc(1390, 105, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0a1724';
    ctx.beginPath();
    ctx.arc(1404, 94, 32, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < 55; i++) {
      const x = (i * 137) % BASE_W;
      const y = 35 + ((i * 83) % 230);
      const pulse = 0.45 + Math.sin(sceneTime * 1.4 + i) * 0.2;
      ctx.fillStyle = `rgba(220,235,248,${pulse})`;
      ctx.fillRect(x, y, 2, 2);
    }

    // daleka zabudowa
    ctx.fillStyle = '#0b1722';
    for (let x = 0; x < BASE_W; x += 72) {
      const h = 65 + ((x * 11) % 95);
      ctx.fillRect(x, 305 - h, 64, h);
      if ((x / 72) % 2 === 0) {
        ctx.fillStyle = 'rgba(241, 199, 102, .12)';
        ctx.fillRect(x + 15, 270 - h, 7, 7);
        ctx.fillRect(x + 39, 284 - h, 7, 7);
        ctx.fillStyle = '#0b1722';
      }
    }

    // teren i ulica
    ctx.fillStyle = '#24372d';
    ctx.fillRect(0, 480, BASE_W, 230);
    ctx.fillStyle = '#667079';
    ctx.fillRect(0, 650, BASE_W, 42);
    ctx.fillStyle = '#1c2329';
    ctx.fillRect(0, 692, BASE_W, 208);

    ctx.strokeStyle = 'rgba(247, 214, 105, .45)';
    ctx.lineWidth = 6;
    ctx.setLineDash([55, 42]);
    ctx.beginPath();
    ctx.moveTo(0, 820);
    ctx.lineTo(BASE_W, 820);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawStreetLamps() {
    const lamps = [735, 1460];
    lamps.forEach(x => {
      ctx.strokeStyle = '#303b43';
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(x, 650);
      ctx.lineTo(x, 420);
      ctx.lineTo(x + 28, 420);
      ctx.stroke();

      const glow = ctx.createRadialGradient(x + 30, 430, 0, x + 30, 430, 75);
      glow.addColorStop(0, 'rgba(255,220,130,.2)');
      glow.addColorStop(1, 'rgba(255,220,130,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - 50, 350, 160, 160);

      ctx.fillStyle = '#e5c46c';
      ctx.fillRect(x + 17, 414, 34, 12);
    });
  }

  function drawSceneObjects() {
    sceneObjects.forEach(item => {
      const img = assets[item.asset];
      if (img && img.complete && img.naturalWidth > 0) ctx.drawImage(img, item.x, item.y, item.w, item.h);
    });
  }

  function drawFireLight(fire) {
    if (fire.out) return;
    const radius = fire.radius * (1.6 + fire.intensity * 0.5);
    const glow = ctx.createRadialGradient(fire.x, fire.y, 4, fire.x, fire.y, radius);
    glow.addColorStop(0, `rgba(255, 118, 39, ${0.14 * fire.intensity})`);
    glow.addColorStop(1, 'rgba(255, 85, 25, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(fire.x - radius, fire.y - radius, radius * 2, radius * 2);
  }

  function drawSingleFlame(x, y, size, phase, opacity) {
    const sway = Math.sin(sceneTime * 7 + phase) * size * 0.13;
    const pulse = 0.88 + Math.sin(sceneTime * 10 + phase * 1.7) * 0.09;
    size *= pulse;

    ctx.save();
    ctx.translate(x + sway, y);
    ctx.globalAlpha = opacity;

    ctx.fillStyle = '#f14a24';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-size * .52, -size * .35, -size * .36, -size * .86, sway * .2, -size);
    ctx.bezierCurveTo(size * .14, -size * .7, size * .58, -size * .46, 0, 0);
    ctx.fill();

    ctx.fillStyle = '#ffad32';
    ctx.beginPath();
    ctx.moveTo(0, -size * .08);
    ctx.bezierCurveTo(-size * .28, -size * .34, -size * .15, -size * .65, size * .03, -size * .76);
    ctx.bezierCurveTo(size * .18, -size * .52, size * .28, -size * .31, 0, -size * .08);
    ctx.fill();

    ctx.fillStyle = '#ffe477';
    ctx.beginPath();
    ctx.moveTo(0, -size * .12);
    ctx.bezierCurveTo(-size * .12, -size * .3, -size * .04, -size * .47, size * .02, -size * .55);
    ctx.bezierCurveTo(size * .12, -size * .36, size * .12, -size * .24, 0, -size * .12);
    ctx.fill();
    ctx.restore();
  }

  function drawFires() {
    fires.forEach((fire, index) => {
      if (fire.out) return;
      drawFireLight(fire);

      const size = fire.radius * (0.72 + fire.intensity * 0.42);
      for (let i = 0; i < 6; i++) {
        const px = fire.x + (i - 2.5) * size * 0.18;
        const py = fire.y + Math.sin(i * 1.7) * 4;
        drawSingleFlame(px, py, size * randomStable(index, i), index * 2 + i, 0.88);
      }

      if (fire.hit > 0) {
        ctx.fillStyle = `rgba(150,220,255,${fire.hit * .28})`;
        ctx.beginPath();
        ctx.arc(fire.x, fire.y - fire.radius * .35, fire.radius * 1.15, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  function randomStable(a, b) {
    return 0.55 + (((a + 3) * 31 + (b + 7) * 17) % 50) / 100;
  }

  function addEffects(dt) {
    fires.forEach((fire, index) => {
      if (!fire.out) {
        if (Math.random() < dt * (2.1 + fire.intensity * 2)) {
          smoke.push({
            x: fire.x + random(-18, 18),
            y: fire.y - fire.radius * .55,
            vx: random(-8, 8),
            vy: random(-38, -20),
            size: random(18, 34),
            life: random(1.6, 2.8),
            maxLife: 2.8
          });
        }
        if (Math.random() < dt * (4 + fire.intensity * 5)) {
          sparks.push({
            x: fire.x + random(-25, 25), y: fire.y - 20,
            vx: random(-30, 30), vy: random(-120, -55),
            life: random(.45, 1.1), maxLife: 1.1
          });
        }
      }
      fire.hit = Math.max(0, fire.hit - dt * 2.7);
      fire.growDelay -= dt;
      if (gameState === 'playing' && !fire.out && fire.growDelay <= 0) {
        fire.intensity = Math.min(fire.maxIntensity, fire.intensity + dt * 0.0045);
      }
      if (fire.out && Math.random() < dt * 0.8 && index % 2 === 0) {
        steam.push({x: fire.x + random(-15,15), y: fire.y, vx: random(-8,8), vy: random(-30,-18), size: random(12,23), life: random(.7,1.4), maxLife: 1.4});
      }
    });
  }

  function updateEffects(list, dt) {
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.life -= dt;
      if (p.life <= 0) { list.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if ('size' in p) p.size += dt * 7;
    }
  }

  function drawSmoke() {
    smoke.forEach(p => {
      const alpha = clamp(p.life / p.maxLife, 0, 1) * .24;
      ctx.fillStyle = `rgba(95,105,112,${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });

    steam.forEach(p => {
      const alpha = clamp(p.life / p.maxLife, 0, 1) * .23;
      ctx.fillStyle = `rgba(205,228,238,${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawSparks() {
    sparks.forEach(p => {
      const alpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.fillStyle = `rgba(255,186,67,${alpha})`;
      ctx.fillRect(p.x, p.y, 3, 3);
    });
  }

  function nozzleAngle() {
    return aim * nozzle.maxAngle;
  }

  function nozzleTip() {
    const angle = (nozzleAngle() - 90) * RAD;
    return {
      x: nozzle.x + Math.cos(angle) * nozzle.length,
      y: nozzle.y + Math.sin(angle) * nozzle.length
    };
  }

  function drawTruckAndNozzle() {
    if (assets.truck?.complete && assets.truck.naturalWidth > 0) {
      ctx.drawImage(assets.truck, truck.x, truck.y, truck.w, truck.h);
    }

    const angle = (nozzleAngle() - 90) * RAD;
    ctx.save();
    ctx.translate(nozzle.x, nozzle.y);
    ctx.rotate(angle);
    if (assets.nozzle?.complete && assets.nozzle.naturalWidth > 0) {
      ctx.drawImage(assets.nozzle, -31, -39, 205, 87);
    } else {
      ctx.fillStyle = '#aebbc3';
      ctx.fillRect(0, -10, 175, 20);
    }
    ctx.restore();
  }

  function spawnWater(dt) {
    if (gameState !== 'playing') return;

    waterTimer += dt * 78;
    while (waterTimer >= 1) {
      waterTimer--;
      const angle = (nozzleAngle() - 90 + random(-1.9, 1.9)) * RAD;
      const tip = nozzleTip();
      const speed = random(990, 1180);
      water.push({
        x: tip.x,
        y: tip.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.35,
        size: random(2.4, 5.2)
      });
      shots++;
    }
  }

  function updateWater(dt) {
    const gravity = 390;

    for (let i = water.length - 1; i >= 0; i--) {
      const p = water[i];
      p.life -= dt;
      if (p.life <= 0) { water.splice(i, 1); continue; }

      p.vy += gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.x < -50 || p.x > BASE_W + 50 || p.y > BASE_H + 30) {
        water.splice(i, 1);
        continue;
      }

      let used = false;
      for (const fire of fires) {
        if (fire.out) continue;
        const dx = p.x - fire.x;
        const dy = p.y - (fire.y - fire.radius * .3);
        const hitRadius = fire.radius * (0.72 + fire.intensity * .15);

        if (dx * dx + dy * dy < hitRadius * hitRadius) {
          fire.intensity -= 0.0105;
          fire.hit = 1;
          hits++;
          score += 2;
          used = true;

          if (Math.random() < .18) {
            steam.push({x: p.x, y: p.y, vx: random(-8,8), vy: random(-35,-18), size: random(7,14), life: .8, maxLife: .8});
          }

          if (fire.intensity <= 0.06) {
            fire.intensity = 0;
            fire.out = true;
            extinguished++;
            score += 450;
            for (let n = 0; n < 18; n++) {
              steam.push({x: fire.x + random(-25,25), y: fire.y + random(-15,10), vx: random(-18,18), vy: random(-65,-20), size: random(10,22), life: random(.8,1.5), maxLife: 1.5});
            }
          }
          break;
        }
      }
      if (used) water.splice(i, 1);
    }
  }

  function drawWater() {
    ctx.lineCap = 'round';
    water.forEach(p => {
      const speed = Math.hypot(p.vx, p.vy) || 1;
      const tx = p.x - (p.vx / speed) * 12;
      const ty = p.y - (p.vy / speed) * 12;
      ctx.strokeStyle = `rgba(128,211,255,${clamp(p.life,0,.85)})`;
      ctx.lineWidth = p.size;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();

      ctx.fillStyle = 'rgba(210,242,255,.8)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1.2, p.size * .38), 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function updateAim(dt) {
    if (keyboardMode) {
      if (keys.left) targetAim -= dt * 0.92;
      if (keys.right) targetAim += dt * 0.92;
      if (!keys.left && !keys.right) targetAim *= Math.pow(0.86, dt * 60);
      targetAim = clamp(targetAim, -1, 1);
    }
    aim = lerp(aim, targetAim, 1 - Math.pow(0.0008, dt));
  }

  function getThreat() {
    const active = fires.filter(f => !f.out);
    if (!active.length) return 0;
    const sum = active.reduce((total, fire) => total + fire.intensity / fire.maxIntensity, 0);
    return clamp((sum / fireTemplate.length) * 100, 0, 100);
  }

  function updateHud() {
    const active = fires.filter(f => !f.out).length;
    const threat = Math.round(getThreat());
    ui.time.textContent = formatTime(elapsed);
    ui.fires.textContent = active;
    ui.score.textContent = Math.round(score);
    ui.threat.textContent = `${threat}%`;
    ui.threatFill.style.width = `${threat}%`;
  }

  function finishGame(won) {
    if (gameState !== 'playing') return;
    gameState = 'finished';

    const timeBonus = won ? Math.max(0, 3000 - elapsed * 18) : 0;
    score += timeBonus;
    const accuracy = shots > 0 ? Math.round((hits / shots) * 100) : 0;

    ui.resultTitle.textContent = won ? 'Pożar opanowany!' : 'Nie udało się opanować pożaru';
    ui.resultText.textContent = won
      ? 'Wszystkie źródła ognia zostały ugaszone.'
      : 'Poziom zagrożenia osiągnął maksimum.';
    ui.finalScore.textContent = Math.round(score);
    ui.finalTime.textContent = formatTime(elapsed);
    ui.finalAccuracy.textContent = `${accuracy}%`;
    ui.finalFires.textContent = `${extinguished}/${fireTemplate.length}`;
    ui.result.classList.remove('hidden');
  }

  function startGame() {
    resetGame();
    ui.pair.classList.add('hidden');
    ui.result.classList.add('hidden');
    gameState = 'countdown';
    ui.countdown.classList.remove('hidden');

    let number = 3;
    ui.countNumber.textContent = number;
    const timer = setInterval(() => {
      number--;
      if (number > 0) {
        ui.countNumber.textContent = number;
      } else {
        clearInterval(timer);
        ui.countdown.classList.add('hidden');
        gameState = 'playing';
        startTime = performance.now();
      }
    }, 700);
  }

  function update(dt) {
    sceneTime += dt;
    updateAim(dt);
    addEffects(dt);
    updateEffects(smoke, dt);
    updateEffects(steam, dt);
    updateEffects(sparks, dt);

    sparks.forEach(p => { p.vy += 55 * dt; });

    if (gameState === 'playing') {
      elapsed = (performance.now() - startTime) / 1000;
      spawnWater(dt);
      updateWater(dt);

      if (fires.every(f => f.out)) finishGame(true);
      else if (getThreat() >= 99.8) finishGame(false);
    } else {
      updateWater(dt);
    }

    updateHud();
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offsetX, dpr * offsetY);

    drawSky();
    drawStreetLamps();
    drawSceneObjects();
    drawSmoke();
    drawFires();
    drawSparks();
    drawWater();
    drawTruckAndNozzle();
  }

  function loop(now) {
    const dt = Math.min((now - lastFrame) / 1000, 0.033);
    lastFrame = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // połączenie telefonu
  let peer = null;
  let connection = null;
  let room = '';

  function setConnection(text, mode = 'warn') {
    ui.connectionText.textContent = text;
    ui.connectionDot.className = `status-dot ${mode}`;
  }

  function makeRoomCode() {
    return String(Math.floor(1000 + Math.random() * 9000));
  }

  function controllerAddress() {
    const url = new URL('controller.html', window.location.href);
    url.searchParams.set('room', room);
    return url.toString();
  }

  function drawQr() {
    ui.qr.innerHTML = '';
    const url = controllerAddress();

    if (typeof QRCode !== 'undefined') {
      new QRCode(ui.qr, { text: url, width: 220, height: 220, correctLevel: QRCode.CorrectLevel.M });
    } else {
      ui.qr.textContent = 'Nie udało się wczytać kodu QR. Użyj kodu gry.';
    }
  }

  function createRoom(code = makeRoomCode()) {
    room = code;
    ui.roomCode.textContent = room;
    drawQr();
    setConnection('Oczekiwanie na telefon', 'warn');

    if (peer) {
      try { peer.destroy(); } catch (_) {}
    }

    if (typeof Peer === 'undefined') {
      setConnection('Brak modułu połączenia', 'bad');
      return;
    }

    peer = new Peer(`firetilt-${room}`);

    peer.on('open', () => {
      setConnection('Oczekiwanie na telefon', 'warn');
    });

    peer.on('connection', conn => {
      if (connection && connection.open) connection.close();
      connection = conn;

      connection.on('open', () => {
        setConnection('Telefon połączony - wycentruj sterowanie', 'ok');
      });

      connection.on('data', data => {
        if (!data || typeof data !== 'object') return;

        if (data.type === 'tilt' && typeof data.value === 'number') {
          targetAim = clamp(data.value, -1, 1);
        }

        if (data.type === 'calibrated') {
          keyboardMode = false;
          setConnection('Kontroler gotowy', 'ok');
          if (gameState === 'pairing') startGame();
        }
      });

      connection.on('close', () => {
        setConnection('Telefon rozłączony', 'bad');
      });
    });

    peer.on('error', error => {
      if (error?.type === 'unavailable-id') {
        setTimeout(() => createRoom(), 150);
      } else {
        setConnection('Błąd połączenia', 'bad');
      }
    });
  }

  document.getElementById('newCodeBtn').addEventListener('click', () => createRoom());

  document.getElementById('keyboardModeBtn').addEventListener('click', () => {
    keyboardMode = true;
    setConnection('Tryb testowy - klawiatura', 'ok');
    startGame();
  });

  document.getElementById('restartBtn').addEventListener('click', () => {
    if (keyboardMode || (connection && connection.open)) startGame();
    else {
      gameState = 'pairing';
      ui.result.classList.add('hidden');
      ui.pair.classList.remove('hidden');
    }
  });

  document.getElementById('pairAgainBtn').addEventListener('click', () => {
    gameState = 'pairing';
    ui.result.classList.add('hidden');
    ui.pair.classList.remove('hidden');
    keyboardMode = false;
    createRoom();
  });

  window.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') keys.left = true;
    if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') keys.right = true;
  });

  window.addEventListener('keyup', event => {
    if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') keys.left = false;
    if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') keys.right = false;
  });

  createRoom();
})();
