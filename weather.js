// ==================== weather.js — 天气效果（可叠加 + 乌云） ====================

const WeatherState = {
  activeTypes: { rain: false, wind: false, lightning: false },  // 手动勾选的天气
  randomMode: false,          // 随机模式
  cloudy: false,              // 乌云独立开关
  intensity: 50,              // 0-100

  rainParticles: [],
  windParticles: [],
  clouds: [],

  lightning: null,
  nextLightningAt: 0,
  randomSwitchAt: 0,
  wind: 0,

  canvas: null,
  ctx: null,
  rafId: null,
  lastTime: 0,
  dpr: 1,
};

const ALL_WEATHER = ['rain', 'wind', 'lightning'];

// ==================== 初始化 ====================
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
  if (anyWeatherActive()) rebuildParticles();
}

// ==================== 设置读写 ====================
function loadWeatherSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('tw_weather') || '{}');
    if (s.activeTypes && typeof s.activeTypes === 'object') {
      for (const k of ALL_WEATHER) WeatherState.activeTypes[k] = !!s.activeTypes[k];
    }
    if (typeof s.randomMode === 'boolean') WeatherState.randomMode = s.randomMode;
    if (typeof s.cloudy === 'boolean') WeatherState.cloudy = s.cloudy;
    if (typeof s.intensity === 'number') WeatherState.intensity = s.intensity;
  } catch (e) {}
}

function saveWeatherSettings() {
  try {
    localStorage.setItem('tw_weather', JSON.stringify({
      activeTypes: WeatherState.activeTypes,
      randomMode: WeatherState.randomMode,
      cloudy: WeatherState.cloudy,
      intensity: WeatherState.intensity,
    }));
  } catch (e) {}
}

function anyWeatherActive() {
  return WeatherState.randomMode ||
    WeatherState.activeTypes.rain ||
    WeatherState.activeTypes.wind ||
    WeatherState.activeTypes.lightning ||
    WeatherState.cloudy;
}

// ==================== UI 同步 ====================
function syncWeatherUI() {
  document.querySelectorAll('#weather-toggles button').forEach(b => {
    const key = b.dataset.weather;
    if (key === 'random') b.classList.toggle('active', WeatherState.randomMode);
    else b.classList.toggle('active', !!WeatherState.activeTypes[key]);
  });

  const slider = document.getElementById('weather-intensity');
  if (slider) slider.value = WeatherState.intensity;
  updateSliderVisual(WeatherState.intensity);

  const cloudToggle = document.getElementById('cloudy-toggle');
  if (cloudToggle) cloudToggle.checked = WeatherState.cloudy;

  const item = document.getElementById('weather-intensity-item');
  if (item) item.style.display = anyWeatherActive() ? 'flex' : 'none';
}

function updateSliderVisual(v) {
  const slider = document.getElementById('weather-intensity');
  if (!slider) return;
  const ratio = Math.max(0, Math.min(1, v / 100));
  slider.style.setProperty('--intensity', ratio);
}

// ==================== 交互 API ====================
function toggleWeatherType(type) {
  if (type === 'random') {
    WeatherState.randomMode = !WeatherState.randomMode;
    if (WeatherState.randomMode) {
      // 打开随机模式时，清空手选
      WeatherState.activeTypes.rain = false;
      WeatherState.activeTypes.wind = false;
      WeatherState.activeTypes.lightning = false;
    }
  } else {
    if (!ALL_WEATHER.includes(type)) return;
    WeatherState.activeTypes[type] = !WeatherState.activeTypes[type];
    if (WeatherState.activeTypes[type]) WeatherState.randomMode = false;
  }
  saveWeatherSettings();
  syncWeatherUI();
  applyWeatherSettings();
}

function setWeatherIntensity(v) {
  WeatherState.intensity = +v;
  saveWeatherSettings();
  updateSliderVisual(WeatherState.intensity);
  rebuildParticles();
}

function setCloudy(v) {
  WeatherState.cloudy = !!v;
  saveWeatherSettings();
  syncWeatherUI();
  applyWeatherSettings();
}

// ==================== 应用设置 ====================
function applyWeatherSettings() {
  const layer = WeatherState.canvas;
  if (!layer) return;
  if (!anyWeatherActive()) {
    layer.style.display = 'none';
    stopWeatherLoop();
    return;
  }
  layer.style.display = 'block';

  if (WeatherState.randomMode) {
    // 随机模式：初始化时挑一个非空组合
    WeatherState.activeTypes.rain = Math.random() < 0.5;
    WeatherState.activeTypes.wind = Math.random() < 0.5;
    WeatherState.activeTypes.lightning = Math.random() < 0.4;
    if (!WeatherState.activeTypes.rain &&
        !WeatherState.activeTypes.wind &&
        !WeatherState.activeTypes.lightning) {
      WeatherState.activeTypes.rain = true;
    }
    WeatherState.randomSwitchAt = performance.now() + randomRange(8000, 18000);
  }

  rebuildParticles();
  startWeatherLoop();
}

function randomRange(a, b) { return a + Math.random() * (b - a); }

// ==================== 粒子重建 ====================
function rebuildParticles() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const intensity = WeatherState.intensity / 100;

  WeatherState.wind = (Math.random() - 0.5) * 2;
  WeatherState.rainParticles = [];
  WeatherState.windParticles = [];
  WeatherState.clouds = [];

  if (WeatherState.activeTypes.rain) {
    const count = Math.floor(40 + intensity * 260);
    for (let i = 0; i < count; i++) {
      WeatherState.rainParticles.push(makeRainDrop(w, h, intensity));
    }
  }
  if (WeatherState.activeTypes.wind) {
    const count = Math.floor(15 + intensity * 90);
    for (let i = 0; i < count; i++) {
      WeatherState.windParticles.push(makeWindParticle(w, h, intensity));
    }
  }
  if (WeatherState.activeTypes.lightning) {
    WeatherState.nextLightningAt = performance.now() + randomRange(1500, 5000 - intensity * 3000);
  }
  if (WeatherState.cloudy) {
    const count = 3 + Math.floor(intensity * 7);
    for (let i = 0; i < count; i++) {
      WeatherState.clouds.push(makeCloud(w, h, intensity));
    }
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

function makeCloud(w, h, intensity) {
  return {
    x: Math.random() * (w + 400) - 200,
    y: Math.random() * h * 0.3 - 40,
    scale: 0.7 + Math.random() * 1.1 + intensity * 0.6,
    speed: 8 + Math.random() * 18 + intensity * 25,
    alpha: 0.22 + intensity * 0.45 + Math.random() * 0.1,
    puffs: 4 + Math.floor(Math.random() * 3),
  };
}

// ==================== 主循环 ====================
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
  WeatherState.rainParticles = [];
  WeatherState.windParticles = [];
  WeatherState.clouds = [];
  WeatherState.lightning = null;
}

function updateWeather(dt, t) {
  const c = WeatherState.canvas;
  const ctx = WeatherState.ctx;
  if (!c || !ctx) return;

  const w = window.innerWidth;
  const h = window.innerHeight;

  // 随机模式切换
  if (WeatherState.randomMode && t > WeatherState.randomSwitchAt) {
    WeatherState.activeTypes.rain = Math.random() < 0.5;
    WeatherState.activeTypes.wind = Math.random() < 0.5;
    WeatherState.activeTypes.lightning = Math.random() < 0.4;
    if (!WeatherState.activeTypes.rain &&
        !WeatherState.activeTypes.wind &&
        !WeatherState.activeTypes.lightning) {
      WeatherState.activeTypes.rain = true;
    }
    WeatherState.intensity = Math.round(randomRange(25, 95));
    updateSliderVisual(WeatherState.intensity);
    const slider = document.getElementById('weather-intensity');
    if (slider) slider.value = WeatherState.intensity;
    rebuildParticles();
    WeatherState.randomSwitchAt = t + randomRange(8000, 18000);
    return;
  }

  ctx.clearRect(0, 0, w, h);
  const intensity = WeatherState.intensity / 100;

  // 图层顺序：乌云（底层）→ 雨 → 风 → 闪电（顶层）
  if (WeatherState.cloudy) drawClouds(ctx, dt, w, h, intensity);
  if (WeatherState.activeTypes.rain) drawRain(ctx, dt, w, h, intensity);
  if (WeatherState.activeTypes.wind) drawWind(ctx, dt, w, h, intensity);
  if (WeatherState.activeTypes.lightning) drawLightning(ctx, t, w, h, intensity);
}

// ==================== 乌云 ====================
function drawClouds(ctx, dt, w, h, intensity) {
  const isLight = document.documentElement.classList.contains('light');
  for (const c of WeatherState.clouds) {
    c.x += c.speed * dt;
    if (c.x > w + 400) {
      c.x = -400;
      c.y = Math.random() * h * 0.3 - 40;
    }
    drawCloudPuff(ctx, c, isLight);
  }
}

function drawCloudPuff(ctx, c, isLight) {
  const baseR = 70 * c.scale;
  const color = isLight
    ? `rgba(90, 95, 110, ${c.alpha})`
    : `rgba(8, 8, 14, ${c.alpha})`;

  ctx.fillStyle = color;
  ctx.beginPath();

  const puffs = [
    { dx: 0,                    dy: 0,                r: baseR },
    { dx: -baseR * 0.85,        dy: baseR * 0.25,     r: baseR * 0.75 },
    { dx:  baseR * 0.85,        dy: baseR * 0.20,     r: baseR * 0.80 },
    { dx: -baseR * 1.55,        dy: baseR * 0.50,     r: baseR * 0.55 },
    { dx:  baseR * 1.60,        dy: baseR * 0.45,     r: baseR * 0.60 },
    { dx: -baseR * 0.30,        dy: -baseR * 0.40,    r: baseR * 0.62 },
    { dx:  baseR * 0.40,        dy: -baseR * 0.35,    r: baseR * 0.58 },
  ];
  const use = puffs.slice(0, c.puffs + 1);

  for (const p of use) {
    const cx = c.x + p.dx;
    const cy = c.y + p.dy;
    ctx.moveTo(cx + p.r, cy);
    ctx.arc(cx, cy, p.r, 0, Math.PI * 2);
  }
  ctx.fill();
}

// ==================== 雨 ====================
function drawRain(ctx, dt, w, h, intensity) {
  const windX = WeatherState.wind * intensity * 200;
  const color = 'rgba(180, 205, 230, ';
  ctx.lineCap = 'round';
  for (const p of WeatherState.rainParticles) {
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

// ==================== 风 ====================
function drawWind(ctx, dt, w, h, intensity) {
  ctx.lineCap = 'round';
  const baseColor = 'rgba(220, 220, 230, ';
  for (const p of WeatherState.windParticles) {
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

// ==================== 闪电 ====================
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