(() => {
  const roomInput = document.getElementById('roomInput');
  const connectBtn = document.getElementById('connectBtn');
  const motionBtn = document.getElementById('motionBtn');
  const calibrateBtn = document.getElementById('calibrateBtn');
  const statusText = document.getElementById('statusText');
  const statusDot = document.getElementById('statusDot');
  const errorText = document.getElementById('errorText');
  const connectionValue = document.getElementById('connectionValue');
  const sensorValue = document.getElementById('sensorValue');
  const sendValue = document.getElementById('sendValue');
  const gaugeNeedle = document.getElementById('gaugeNeedle');
  const angleValue = document.getElementById('angleValue');
  const recalibrateBanner = document.getElementById('recalibrateBanner');

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  let peer = null;
  let connection = null;
  let sensorEnabled = false;
  let hasSensorData = false;
  let calibrated = false;
  let screenAngle = getScreenAngle();
  let center = 0;
  let currentRaw = 0;
  let filtered = 0;
  let lastSend = 0;
  let sentPackets = 0;
  let hzTimer = performance.now();

  const params = new URLSearchParams(window.location.search);
  const roomFromUrl = (params.get('room') || '').replace(/\D/g, '').slice(0, 4);
  if (roomFromUrl) roomInput.value = roomFromUrl;

  function setStatus(text, mode = 'warn') {
    statusText.textContent = text;
    statusDot.className = `status-dot ${mode}`;
  }

  function getScreenAngle() {
    if (screen.orientation && typeof screen.orientation.angle === 'number') {
      return ((screen.orientation.angle % 360) + 360) % 360;
    }
    if (typeof window.orientation === 'number') {
      return ((window.orientation % 360) + 360) % 360;
    }
    return 0;
  }

  // Dla telefonu poziomo ruch lewo/prawo jest na osi beta.
  // Znak zależy od tego, w którą stronę został obrócony ekran.
  function readTilt(event) {
    const angle = getScreenAngle();
    const beta = Number(event.beta || 0);
    const gamma = Number(event.gamma || 0);

    if (angle === 90) return beta;
    if (angle === 270) return -beta;

    // awaryjnie dla urządzeń, które nie zwracają kąta ekranu
    return gamma;
  }

  function orientationChanged() {
    const newAngle = getScreenAngle();
    if (newAngle === screenAngle) return;

    screenAngle = newAngle;
    calibrated = false;
    filtered = 0;
    gaugeNeedle.style.transform = 'rotate(0deg)';
    angleValue.textContent = '0°';
    recalibrateBanner.classList.add('show');

    if (connection && connection.open) {
      connection.send({ type: 'paused' });
    }
  }

  async function enableMotion() {
    errorText.textContent = '';

    try {
      if (typeof DeviceOrientationEvent === 'undefined') {
        throw new Error('Ta przeglądarka nie udostępnia danych z czujnika orientacji.');
      }

      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        const result = await DeviceOrientationEvent.requestPermission();
        if (result !== 'granted') throw new Error('Nie przyznano dostępu do czujników ruchu.');
      }

      if (!sensorEnabled) {
        window.addEventListener('deviceorientation', onOrientation, true);
        sensorEnabled = true;
      }

      sensorValue.textContent = 'aktywny';
      motionBtn.textContent = 'Czujniki włączone';
      motionBtn.disabled = true;
      motionBtn.style.opacity = '.65';
      recalibrateBanner.classList.add('show');
    } catch (error) {
      sensorValue.textContent = 'błąd';
      errorText.textContent = error.message || String(error);
    }
  }

  function onOrientation(event) {
    currentRaw = readTilt(event);
    hasSensorData = true;

    if (!calibrated) return;

    let delta = currentRaw - center;

    // mała martwa strefa usuwa drgania przy trzymaniu telefonu
    if (Math.abs(delta) < 1.2) delta = 0;

    // pełny zakres prądownicy uzyskujemy przy ok. 24 stopniach przechylenia telefonu
    const normalized = clamp(delta / 24, -1, 1);
    filtered += (normalized - filtered) * 0.16;

    gaugeNeedle.style.transform = `rotate(${filtered * 58}deg)`;
    angleValue.textContent = `${Math.round(delta)}°`;

    if (connection && connection.open) {
      const now = performance.now();
      if (now - lastSend > 30) {
        connection.send({ type: 'tilt', value: filtered });
        lastSend = now;
        sentPackets++;
      }
    }
  }

  function calibrate() {
    errorText.textContent = '';

    if (!sensorEnabled) {
      errorText.textContent = 'Najpierw włącz czujniki ruchu.';
      return;
    }

    if (window.innerHeight > window.innerWidth) {
      errorText.textContent = 'Obróć telefon poziomo i dopiero wtedy wycentruj sterowanie.';
      return;
    }

    if (!hasSensorData) {
      errorText.textContent = 'Czekam na pierwszy odczyt z czujnika. Porusz lekko telefonem i spróbuj ponownie.';
      return;
    }

    center = currentRaw;
    filtered = 0;
    calibrated = true;
    screenAngle = getScreenAngle();
    gaugeNeedle.style.transform = 'rotate(0deg)';
    angleValue.textContent = '0°';
    recalibrateBanner.classList.remove('show');

    if (connection && connection.open) {
      connection.send({ type: 'calibrated' });
      setStatus('Gotowe do gry', 'ok');
    } else {
      errorText.textContent = 'Sterowanie jest wycentrowane, ale telefon nie jest jeszcze połączony z grą.';
    }
  }

  function connect() {
    errorText.textContent = '';
    const code = roomInput.value.replace(/\D/g, '').slice(0, 4);
    roomInput.value = code;

    if (code.length !== 4) {
      errorText.textContent = 'Wpisz 4-cyfrowy kod z ekranu komputera.';
      return;
    }

    if (typeof Peer === 'undefined') {
      errorText.textContent = 'Nie udało się wczytać modułu połączenia. Sprawdź połączenie z internetem.';
      return;
    }

    if (peer) {
      try { peer.destroy(); } catch (_) {}
    }

    setStatus('Łączenie...', 'warn');
    connectionValue.textContent = '...';
    peer = new Peer();

    peer.on('open', () => {
      connection = peer.connect(`firetilt-${code}`, { reliable: false });

      connection.on('open', () => {
        setStatus('Połączono z grą', 'ok');
        connectionValue.textContent = 'OK';
        connection.send({ type: 'controller' });
      });

      connection.on('close', () => {
        setStatus('Połączenie zakończone', 'bad');
        connectionValue.textContent = '—';
      });

      connection.on('error', () => {
        setStatus('Błąd połączenia', 'bad');
        connectionValue.textContent = 'błąd';
      });
    });

    peer.on('error', error => {
      setStatus('Nie udało się połączyć', 'bad');
      connectionValue.textContent = 'błąd';
      errorText.textContent = `Sprawdź kod i czy gra jest nadal otwarta${error?.type ? ` (${error.type})` : ''}.`;
    });
  }

  roomInput.addEventListener('input', () => {
    roomInput.value = roomInput.value.replace(/\D/g, '').slice(0, 4);
  });

  connectBtn.addEventListener('click', connect);
  motionBtn.addEventListener('click', enableMotion);
  calibrateBtn.addEventListener('click', calibrate);

  window.addEventListener('orientationchange', () => setTimeout(orientationChanged, 150));
  window.addEventListener('resize', () => setTimeout(orientationChanged, 150));
  if (screen.orientation?.addEventListener) {
    screen.orientation.addEventListener('change', () => setTimeout(orientationChanged, 150));
  }

  setInterval(() => {
    const now = performance.now();
    const seconds = (now - hzTimer) / 1000;
    if (seconds >= 1) {
      sendValue.textContent = `${Math.round(sentPackets / seconds)} Hz`;
      sentPackets = 0;
      hzTimer = now;
    }
  }, 500);

  if (roomInput.value.length === 4) {
    setTimeout(connect, 250);
  }
})();
