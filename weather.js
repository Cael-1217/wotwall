// ==================== weather.js — 天气效果 ====================

const WeatherState = {
  mode: 'off',           // off | rain | wind | lightning | random | combo
  intensity: 50,         // 0-100
  cloudy: false,         // 乌云独立开关

  // 派生的当前生效类型
  activeTypes: { rain: false, wind: false, lightning: false },

  // 粒子
  rainParticles: [],
  windParticles: [],
  clouds: [],
  wind: 0,

  // 闪电
  lightning: null,
  nextLightningAt: 0,

  // 随机模式切换时间
  randomSwitchAt: 0,

  // Canvas
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
    if (typeof s.mode === 'string') WeatherState.mode = s.mode;
    if (typeof s.cloudy === 'boolean') WeatherState.cloudy = s.cloudy;
    if (typeof s.intensity === 'number') WeatherState.intensity = s.intensity;
  } catch (e) {}
}

function saveWeatherSettings() {
  try {
    localStorage.setItem('tw_weather', JSON.stringify({
      mode: WeatherState.mode,
      cloudy: WeatherState.cloudy,
      intensity: WeatherState.intensity,
    }));
  } catch (e) {}
}

function anyWeatherActive() {
  return WeatherState.mode !== 'off' || WeatherState.cloudy;
}

// ==================== UI 同步 ====================
function syncWeatherUI() {
  const modeSel = document.getElementById('weather-mode');
  if (modeSel) {
    modeSel.value = WeatherState.mode;
    // 触发自定义 select 的刷新（cselect 会监听 change 事件）
    modeSel.dispatchEvent(new Event('change', { bubbles: true }));
  }

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
function setWeatherMode(mode) {
  if (WeatherState.mode === mode) return;
  WeatherState.mode = mode;
  applyModeToActiveTypes();
  saveWeatherSettings();
  syncWeatherUI();
  applyWeatherSettings();
}

function applyModeToActiveTypes() {
  const m = WeatherState.mode;
  if (m === 'combo') {
    WeatherState.activeTypes = { rain: true, wind: true, lightning: true };
  } else if (m === 'rain' || m === 'wind' || m === 'lightning') {
    WeatherState.activeTypes = { rain: false, wind: false, lightning: false };
    WeatherState.activeTypes[m] = true;
  } else if (m === 'random') {
    pickRandomType();
  } else {
    WeatherState.activeTypes = { rain: false, wind: false, lightning: false };
  }
}

function pickRandomType() {
  const pick = ALL_WEATHER[Math.floor(Math.random() * ALL_WEATHER.length)];
  WeatherState.activeTypes = {
    rain: pick === 'rain',
    wind: pick === 'wind',
    lightning: pick === 'lightning',
  };
  WeatherState.randomSwitchAt = performance.now() + randomRange(8000, 18000);
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

  // 如果当前模式是随机，重置随机计时
  if (WeatherState.mode === 'random') {
    pickRandomType();
  } else if (WeatherState.mode !== 'off') {
    applyModeToActiveTypes();
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
    WeatherState.nextLightningAt = performance.now() + randomRange(400, 1500);
  }
  if (WeatherState.cloudy) {
    const count = 4 + Math.floor(intensity * 6);
    for (let i = 0; i < count; i++) {
      WeatherState.clouds.push(makeCloud(w, h, intensity));
    }
  }
}

function makeRainDrop(w, h, intensity) {
  return {
    x: Math.random() * w,
    y: Math.random() * h - h,
    len: 10 + Math.random() * 22 + intensity * 14,
    speed: 600 + Math.random() * 700 + intensity * 900,
    alpha: 0.25 + Math.random() * 0.35 + intensity * 0.3,
    thickness: 0.8 + Math.random() * 0.8 + intensity * 0.6,
  };
}

function makeWindParticle(w, h, intensity) {
  return {
    x: -50 - Math.random() * 200,
    y: Math.random() * h,
    len: 60 + Math.random() * 180,
    speed: 200 + Math.random() * 400 + intensity * 500,
    alpha: 0.1 + Math.random() * 0.2 + intensity * 0.15,
    thickness: 0.6 + Math.random() * 1.0 + intensity * 0.6,
    drift: (Math.random() - 0.5) * 40,
  };
}

function makeCloud(w, h, intensity) {
  return {
    x: Math.random() * (w + 400) - 200,
    y: Math.random() * h * 0.32 - 40,
    scale: 0.9 + Math.random() * 1.2 + intensity * 0.7,
    speed: 8 + Math.random() * 18 + intensity * 25,
    alpha: 0.35 + intensity * 0.4 + Math.random() * 0.1,
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
  if (WeatherState.mode === 'random' && t > WeatherState.randomSwitchAt) {
    pickRandomType();
    WeatherState.intensity = Math.round(randomRange(30, 95));
    updateSliderVisual(WeatherState.intensity);
    const slider = document.getElementById('weather-intensity');
    if (slider) slider.value = WeatherState.intensity;
    rebuildParticles();
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
      c.y = Math.random() * h * 0.32 - 40;
    }
    drawCloudPuff(ctx, c, isLight);
  }
}

function drawCloudPuff(ctx, c, isLight) {
  const baseR = 85 * c.scale;
  // 浅色主题：深灰云；深色主题：黑云
  const color = isLight
    ? `rgba(60, 65, 80, ${c.alpha})`
    : `rgba(0, 0, 0, ${c.alpha})`;

  ctx.fillStyle = color;
  ctx.beginPath();

  const puffs = [
    { dx: 0,              dy: 0,              r: baseR },
    { dx: -baseR * 0.9,   dy: baseR * 0.25,   r: baseR * 0.75 },
    { dx:  baseR * 0.9,   dy: baseR * 0.20,   r: baseR * 0.80 },
    { dx: -baseR * 1.6,   dy: baseR * 0.50,   r: baseR * 0.55 },
    { dx:  baseR * 1.7,   dy: baseR * 0.45,   r: baseR * 0.60 },
    { dx: -baseR * 0.3,   dy: -baseR * 0.42,  r: baseR * 0.62 },
    { dx:  baseR * 0.4,   dy: -baseR * 0.35,  r: baseR * 0.58 },
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
    const flashCount = 2 + Math.floor(intensity * 3);
    for (let i = 0; i < flashCount; i++) {
      WeatherState.lightning.flashes.push({
        at: i * (50 + Math.random() * 90),
        dur: 40 + Math.random() * 80,
        alpha: 0.35 + Math.random() * 0.5 + intensity * 0.3,
      });
    }
    WeatherState.nextLightningAt = t + randomRange(1500, 5000 - intensity * 3500);
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