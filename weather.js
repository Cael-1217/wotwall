// ==================== weather.js — 天气效果 ====================

const WeatherState = {
  mode: 'off',
  intensity: 50,
  particles: [],
  currentType: 'rain',
  wind: 0,
  lightning: null,
  nextLightningAt: 0,
  randomSwitchAt: 0,
  canvas: null,
  ctx: null,
  rafId: null,
  lastTime: 0,
  dpr: 1,
};

const WEATHER_TYPES = ['rain', 'wind', 'lightning'];

function initWeather() {
  WeatherState.canvas = document.getElementById('weather-layer');
  if (!WeatherState.canvas) return;
  WeatherState.ctx = WeatherState.canvas.getContext('2d');
  resizeWeatherCanvas();
  window.addEventListener('resize', resizeWeatherCanvas);
  loadWeatherSettings();
  syncWeatherUI();
  applyWeatherSettings();
}

function resizeWeatherCanvas() {
  const c = WeatherState.canvas;
  if (!c) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  WeatherState.dpr = dpr;
  c.width = Math.floor(window.innerWidth * dpr);
  c.height = Math.floor(window.innerHeight * dpr);
  c.style.width = window.innerWidth + 'px';
  c.style.height = window.innerHeight + 'px';
  WeatherState.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (WeatherState.mode !== 'off') rebuildParticles();
}

function loadWeatherSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('tw_weather') || '{}');
    if (s.mode) WeatherState.mode = s.mode;
    if (typeof s.intensity === 'number') WeatherState.intensity = s.intensity;
  } catch (e) {}
}

function saveWeatherSettings() {
  try {
    localStorage.setItem('tw_weather', JSON.stringify({
      mode: WeatherState.mode,
      intensity: WeatherState.intensity,
    }));
  } catch (e) {}
}

function syncWeatherUI() {
  const modeSel = document.getElementById('weather-mode');
  if (modeSel) modeSel.value = WeatherState.mode;
  const slider = document.getElementById('weather-intensity');
  if (slider) slider.value = WeatherState.intensity;
  updateSliderVisual(WeatherState.intensity);
  const item = document.getElementById('weather-intensity-item');
  if (item) item.style.display = WeatherState.mode === 'off' ? 'none' : 'flex';
}

function updateSliderVisual(v) {
  const slider = document.getElementById('weather-intensity');
  if (!slider) return;
  const ratio = Math.max(0, Math.min(1, v / 100));
  slider.style.setProperty('--intensity', ratio);
}

function setWeatherMode(mode) {
  WeatherState.mode = mode;
  saveWeatherSettings();
  syncWeatherUI();
  applyWeatherSettings();
}

function setWeatherIntensity(v) {
  WeatherState.intensity = +v;
  saveWeatherSettings();
  updateSliderVisual(WeatherState.intensity);
  if (WeatherState.mode !== 'off') rebuildParticles();
}

function applyWeatherSettings() {
  const layer = WeatherState.canvas;
  if (!layer) return;
  if (WeatherState.mode === 'off') {
    layer.style.display = 'none';
    stopWeatherLoop();
    return;
  }
  layer.style.display = 'block';
  WeatherState.currentType = WeatherState.mode === 'random'
    ? WEATHER_TYPES[Math.floor(Math.random() * WEATHER_TYPES.length)]
    : WeatherState.mode;
  WeatherState.randomSwitchAt = performance.now() + randomRange(8000, 18000);
  rebuildParticles();
  startWeatherLoop();
}

function randomRange(a, b) { return a + Math.random() * (b - a); }

function rebuildParticles() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const intensity = WeatherState.intensity / 100;
  const type = WeatherState.currentType;
  WeatherState.particles = [];
  WeatherState.wind = (Math.random() - 0.5) * 2;

  if (type === 'rain') {
    const count = Math.floor(40 + intensity * 260);
    for (let i = 0; i < count; i++) WeatherState.particles.push(makeRainDrop(w, h, intensity));
  } else if (type === 'wind') {
    const count = Math.floor(15 + intensity * 90);
    for (let i = 0; i < count; i++) WeatherState.particles.push(makeWindParticle(w, h, intensity));
  } else if (type === 'lightning') {
    WeatherState.nextLightningAt = performance.now() + randomRange(1500, 5000 - intensity * 3000);
  }
}

function makeRainDrop(w, h, intensity) {
  return {
    x: Math.random() * w,
    y: Math.random() * h - h,
    len: 8 + Math.random() * 22 + intensity * 14,
    speed: 600 + Math.random() * 700 + intensity * 900,
    alpha: 0.15 + Math.random() * 0.35 + intensity * 0.3,
    thickness: 0.6 + Math.random() * 0.8 + intensity * 0.6,
  };
}

function makeWindParticle(w, h, intensity) {
  return {
    x: -50 - Math.random() * 200,
    y: Math.random() * h,
    len: 60 + Math.random() * 180,
    speed: 200 + Math.random() * 400 + intensity * 500,
    alpha: 0.08 + Math.random() * 0.18 + intensity * 0.15,
    thickness: 0.5 + Math.random() * 1.0 + intensity * 0.6,
    drift: (Math.random() - 0.5) * 40,
  };
}

function startWeatherLoop() {
  if (WeatherState.rafId) return;
  WeatherState.lastTime = performance.now();
  const loop = (t) => {
    WeatherState.rafId = requestAnimationFrame(loop);
    const dt = Math.min(64, t - WeatherState.lastTime) / 1000;
    WeatherState.lastTime = t;
    updateWeather(dt, t);
  };
  WeatherState.rafId = requestAnimationFrame(loop);
}

function stopWeatherLoop() {
  if (WeatherState.rafId) {
    cancelAnimationFrame(WeatherState.rafId);
    WeatherState.rafId = null;
  }
  const c = WeatherState.canvas;
  if (c && WeatherState.ctx) WeatherState.ctx.clearRect(0, 0, c.width, c.height);
  WeatherState.particles = [];
  WeatherState.lightning = null;
}

function updateWeather(dt, t) {
  const c = WeatherState.canvas;
  const ctx = WeatherState.ctx;
  if (!c || !ctx) return;

  if (WeatherState.mode === 'random' && t > WeatherState.randomSwitchAt) {
    WeatherState.currentType = WEATHER_TYPES[Math.floor(Math.random() * WEATHER_TYPES.length)];
    WeatherState.intensity = Math.round(randomRange(25, 95));
    updateSliderVisual(WeatherState.intensity);
    const slider = document.getElementById('weather-intensity');
    if (slider) slider.value = WeatherState.intensity;
    rebuildParticles();
    WeatherState.randomSwitchAt = t + randomRange(8000, 18000);
    return;
  }

  const w = window.innerWidth;
  const h = window.innerHeight;
  ctx.clearRect(0, 0, w, h);

  const type = WeatherState.currentType;
  const intensity = WeatherState.intensity / 100;

  if (type === 'rain') drawRain(ctx, dt, w, h, intensity);
  else if (type === 'wind') drawWind(ctx, dt, w, h, intensity);
  else if (type === 'lightning') drawLightning(ctx, t, w, h, intensity);
}

function drawRain(ctx, dt, w, h, intensity) {
  const windX = WeatherState.wind * intensity * 200;
  const color = 'rgba(180, 205, 230, ';
  ctx.lineCap = 'round';
  for (const p of WeatherState.particles) {
    p.y += p.speed * dt;
    p.x += windX * dt;
    if (p.y > h + 30 || p.x < -50 || p.x > w + 50) {
      p.y = -30 - Math.random() * 60;
      p.x = Math.random() * w;
    }
    const dx = windX * 0.04;
    ctx.strokeStyle = color + p.alpha + ')';
    ctx.lineWidth = p.thickness;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + dx, p.y + p.len);
    ctx.stroke();
  }
}

function drawWind(ctx, dt, w, h, intensity) {
  ctx.lineCap = 'round';
  const baseColor = 'rgba(220, 220, 230, ';
  for (const p of WeatherState.particles) {
    p.x += p.speed * dt;
    p.y += Math.sin((p.x + p.len) * 0.01) * p.drift * dt;
    if (p.x > w + 200) {
      p.x = -200 - Math.random() * 200;
      p.y = Math.random() * h;
    }
    ctx.strokeStyle = baseColor + p.alpha + ')';
    ctx.lineWidth = p.thickness;
    ctx.beginPath();
    const dx = p.len;
    const dy = Math.sin(p.x * 0.01) * 6;
    ctx.moveTo(p.x, p.y);
    ctx.quadraticCurveTo(p.x + dx * 0.5, p.y + dy, p.x + dx, p.y);
    ctx.stroke();
  }
}

function drawLightning(ctx, t, w, h, intensity) {
  if (!WeatherState.lightning && t >= WeatherState.nextLightningAt) {
    WeatherState.lightning = {
      startTime: t,
      duration: 100 + intensity * 180,
      flashes: [],
    };
    const flashCount = 1 + Math.floor(intensity * 3);
    for (let i = 0; i < flashCount; i++) {
      WeatherState.lightning.flashes.push({
        at: i * (50 + Math.random() * 90),
        dur: 30 + Math.random() * 70,
        alpha: 0.25 + Math.random() * 0.5 + intensity * 0.3,
      });
    }
    WeatherState.nextLightningAt = t + randomRange(1800, 6000 - intensity * 4000);
  }

  if (WeatherState.lightning) {
    const l = WeatherState.lightning;
    const elapsed = t - l.startTime;
    let alpha = 0;
    for (const f of l.flashes) {
      if (elapsed >= f.at && elapsed < f.at + f.dur) {
        const k = 1 - (elapsed - f.at) / f.dur;
        alpha = Math.max(alpha, f.alpha * k);
      }
    }
    if (elapsed > l.duration + 300) {
      WeatherState.lightning = null;
    } else if (alpha > 0) {
      ctx.fillStyle = `rgba(255, 250, 240, ${alpha})`;
      ctx.fillRect(0, 0, w, h);
    }
  }
}