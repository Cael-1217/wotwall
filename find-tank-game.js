// ==================== find-tank-game.js — 计时模式 v4.5 ====================

/* ============ 全局状态 ============ */
const GameState = {
  scene: null, camera: null, renderer: null, controls: null,
  animId: null, clock: null,
  panel: null,
  phase: 'menu',        // menu | playing | won
  starting: false,

  // 计时模式
  timeLeft: 60,
  foundCount: 0,
  locked: false,
  roundStart: 0,
  bestScore: 0,

  // 天气（渐变）
  weather: {
    current: 'summer',
    target: 'summer',
    params: {
      bg: new THREE.Color(0x8fc8f0),
      fog: new THREE.Color(0xb8d8ee),
      fogNear: 150, fogFar: 480,
      hemi: 0.7, ambient: 0.35,
      dir: 1.0, dirColor: new THREE.Color(0xfff3e0),
      rain: 0, snow: 0,
    },
    holdTimer: 30,
    transitionT: 1,      // 0..1
    transitionDur: 8,    // 秒
  },
  rainParticles: null,
  snowParticles: null,

  // 场景
  targetTank: null,
  objects: [],
  dirLight: null, ambientLight: null, hemiLight: null,
  winState: null, winSprite: null,
  missileTrail: null, missileTrailHistory: [],

  // 地图（固定）
  terrainAmp: 6,
  terrainSize: 400,
  terrainFeatures: [],
  occupiedBoxes: [],
  treePositions: [],
  tankSpots: [],
  usedSpots: new Set(),
  texCache: {},

  raycaster: null, pointer: null,
  pointerDown: null,

  // 相机（不能转到地图下方）
  cameraMinY: 2,
};

const GAME_LIB_PATHS = { three: 'three.min.js', orbit: 'OrbitControls.js' };

/* ============ 工具 ============ */
function _nextFrame() { return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); }
function _loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    const ex = document.querySelector(`script[src="${src}"]`);
    if (ex) {
      if (ex.dataset.loaded === '1') return resolve();
      ex.addEventListener('load', () => resolve());
      ex.addEventListener('error', () => reject(new Error('加载失败: ' + src)));
      return;
    }
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = () => { s.dataset.loaded = '1'; resolve(); };
    s.onerror = () => reject(new Error('加载失败: ' + src));
    document.head.appendChild(s);
  });
}
async function ensureThreeLibs() {
  if (!window.THREE || typeof window.THREE.WebGLRenderer !== 'function') {
    await _loadScriptOnce(GAME_LIB_PATHS.three);
  }
  if (!window.THREE || typeof window.THREE.WebGLRenderer !== 'function') {
    throw new Error('Three.js 加载失败：请确认 three.min.js 在仓库根目录');
  }
  if (!window.THREE.OrbitControls) {
    try { await _loadScriptOnce(GAME_LIB_PATHS.orbit); }
    catch (e) { console.warn('[find-tank] OrbitControls 未加载，使用固定视角'); }
  }
}
function getCardInfoSafe(t) {
  try { return (typeof getCardInfoText === 'function') ? getCardInfoText(t) : ''; }
  catch { return ''; }
}
function esc(s) { return (typeof escapeHtml === 'function') ? escapeHtml(s) : String(s); }
function rand(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

// 固定种子 RNG（保证地图布局每次相同）
function makeRNG(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/* ============ 1. 面板 ============ */
function initFindTankGame() {
  if (GameState.panel) return GameState.panel;
  const panel = document.createElement('div');
  panel.id = 'find-tank-panel';
  panel.style.cssText = 'position:fixed;inset:0;z-index:400;background:#0b0b0e;display:none;flex-direction:column;overflow:hidden;';

  panel.innerHTML = `
    <!-- HUD -->
    <div id="ftg-hud" style="display:none;padding:8px 14px;padding-top:calc(8px + env(safe-area-inset-top));background:linear-gradient(to bottom,rgba(10,10,14,0.96),rgba(10,10,14,0.72));color:#fff;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-shrink:0;z-index:5;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.08);backdrop-filter:blur(8px);">
      <div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap;">
        <span>⏱ <b id="ftg-timer" style="color:#ffd83a;font-family:ui-monospace,monospace;">60.0</b>s</span>
        <span>🏆 <b id="ftg-found" style="color:#4aff4a;">0</b></span>
        <span id="ftg-weather-info" style="color:#8a8a92;font-size:12px;"></span>
      </div>
      <div style="display:flex;gap:6px;">
        <button id="ftg-btn-restart" style="padding:6px 12px;border-radius:6px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:#e8e8ea;font-family:inherit;font-size:12px;cursor:pointer;">重开</button>
        <button id="ftg-btn-quit" style="padding:6px 12px;border-radius:6px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:#e8e8ea;font-family:inherit;font-size:12px;cursor:pointer;">退出</button>
      </div>
    </div>

    <div id="game-canvas-wrap" style="flex:1;position:relative;min-height:0;background:#0b0b0e;overflow:hidden;">
      <div id="ftg-error" style="display:none;position:absolute;inset:0;z-index:10;align-items:center;justify-content:center;background:rgba(11,11,14,0.94);color:#ff8a8a;font-size:14px;padding:24px;text-align:center;white-space:pre-wrap;line-height:1.6;"></div>
    </div>

    <!-- 主菜单 -->
    <div id="ftg-menu" style="position:absolute;inset:0;z-index:20;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 35%, #1c2028, #0b0b0e 70%);color:#fff;padding:24px;text-align:center;">
      <div style="font-size:52px;margin-bottom:8px;filter:drop-shadow(0 6px 20px rgba(255,216,58,0.35));">🎯</div>
      <h1 style="margin:0;font-size:32px;font-weight:800;letter-spacing:-0.02em;background:linear-gradient(135deg,#ffd83a,#c9a860);-webkit-background-clip:text;background-clip:text;color:transparent;">寻找坦克</h1>
      <p style="color:#8a8a92;font-size:13px;margin:12px 0 26px;line-height:1.75;max-width:360px;">
        60 秒限时挑战<br>
        每找到一辆坦克立刻刷新下一辆<br>
        天气会随时间渐变，注意边缘浓雾
      </p>
      <button id="ftg-btn-start" style="padding:14px 56px;border-radius:999px;border:none;background:linear-gradient(135deg,#ffd83a,#c9a860);color:#1a1611;font-family:inherit;font-size:16px;font-weight:700;letter-spacing:0.05em;cursor:pointer;box-shadow:0 8px 28px rgba(255,216,58,0.35);margin-bottom:12px;min-width:220px;">开始挑战</button>
      <button id="ftg-btn-menu-quit" style="padding:12px 40px;border-radius:999px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.04);color:#8a8a92;font-family:inherit;font-size:14px;cursor:pointer;">退出</button>
      <div id="ftg-menu-status" style="color:#8a8a92;font-size:12px;margin-top:22px;height:16px;"></div>
    </div>

    <!-- 结算 -->
    <div id="ftg-result" style="position:absolute;inset:0;z-index:20;display:none;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 40%, rgba(28,32,40,0.97), rgba(11,11,14,0.99));color:#fff;padding:24px;text-align:center;overflow-y:auto;">
      <div style="font-size:44px;margin-bottom:6px;">🏁</div>
      <h2 style="margin:0 0 6px;font-size:26px;font-weight:800;color:#ffd83a;">时间到！</h2>
      <p style="color:#8a8a92;font-size:13px;margin:0 0 18px;">本轮战绩</p>
      <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:16px 32px;margin-bottom:12px;">
        <div style="font-size:11px;color:#8a8a92;letter-spacing:0.15em;margin-bottom:4px;">找到坦克</div>
        <div id="ftg-result-found" style="font-size:44px;font-weight:800;font-family:ui-monospace,monospace;color:#4aff4a;">0</div>
      </div>
      <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:10px 24px;margin-bottom:22px;">
        <div style="font-size:11px;color:#8a8a92;letter-spacing:0.12em;">历史最佳</div>
        <div id="ftg-result-best" style="font-size:22px;font-weight:700;color:#ffd83a;font-family:ui-monospace,monospace;">0</div>
      </div>
      <div style="display:flex;gap:10px;margin-bottom:24px;flex-wrap:wrap;justify-content:center;">
        <button id="ftg-btn-retry" style="padding:12px 32px;border-radius:999px;border:none;background:linear-gradient(135deg,#ffd83a,#c9a860);color:#1a1611;font-family:inherit;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 6px 20px rgba(255,216,58,0.3);">再来一局 →</button>
        <button id="ftg-btn-result-quit" style="padding:12px 32px;border-radius:999px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.05);color:#e8e8ea;font-family:inherit;font-size:15px;cursor:pointer;">返回主菜单</button>
      </div>
      <div style="width:100%;max-width:400px;">
        <div style="font-size:11px;color:#8a8a92;letter-spacing:0.15em;margin-bottom:10px;">🎁 随机推荐</div>
        <div id="ftg-result-card" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:14px;cursor:pointer;transition:all 0.2s;display:none;"></div>
      </div>
    </div>
  `;
  document.body.appendChild(panel);
  GameState.panel = panel;

  panel.querySelector('#ftg-btn-quit').addEventListener('click', closeFindTankGame);
  panel.querySelector('#ftg-btn-restart').addEventListener('click', () => beginLevel(true));
  panel.querySelector('#ftg-btn-menu-quit').addEventListener('click', closeFindTankGame);
  panel.querySelector('#ftg-btn-start').addEventListener('click', () => beginLevel(false));
  panel.querySelector('#ftg-btn-retry').addEventListener('click', () => beginLevel(true));
  panel.querySelector('#ftg-btn-result-quit').addEventListener('click', showMenu);

  const wrap = panel.querySelector('#game-canvas-wrap');
  wrap.addEventListener('pointerdown', e => {
    GameState.pointerDown = { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  wrap.addEventListener('pointerup', e => {
    const pd = GameState.pointerDown;
    GameState.pointerDown = null;
    if (!pd) return;
    const dx = e.clientX - pd.x, dy = e.clientY - pd.y;
    if (dx * dx + dy * dy > 36) return;
    if (performance.now() - pd.t > 600) return;
    handleCanvasClick(e.clientX, e.clientY);
  });

  window.addEventListener('resize', () => {
    if (panel.style.display !== 'none') updateViewport();
  });
  if (window.ResizeObserver) {
    new ResizeObserver(() => {
      if (panel.style.display !== 'none') updateViewport();
    }).observe(wrap);
  }
  return panel;
}

/* ============ 2. 入口 ============ */
async function startFindTankGame() {
  const panel = initFindTankGame();
  panel.style.display = 'flex';
  showMenu();
  document.body.style.overflow = 'hidden';
  try { await ensureThreeLibs(); } catch (e) {}
}

function showMenu() {
  GameState.phase = 'menu';
  const p = GameState.panel;
  p.querySelector('#ftg-menu').style.display = 'flex';
  p.querySelector('#ftg-result').style.display = 'none';
  p.querySelector('#ftg-hud').style.display = 'none';
  p.querySelector('#ftg-error').style.display = 'none';
  p.querySelector('#ftg-menu-status').textContent = '';
  if (GameState.animId) stopGameLoop();
}

function closeFindTankGame() {
  if (!GameState.panel) return;
  GameState.panel.style.display = 'none';
  document.body.style.overflow = '';
  stopGameLoop();
  GameState.phase = 'menu';
  if (typeof playSound === 'function') playSound('close');
}

/* ============ 3. 开始 ============ */
async function beginLevel(isRetry) {
  if (GameState.starting) return;
  GameState.starting = true;
  const p = GameState.panel;

  try {
    if (!window.THREE) await ensureThreeLibs();

    p.querySelector('#ftg-menu').style.display = 'none';
    p.querySelector('#ftg-result').style.display = 'none';
    p.querySelector('#ftg-hud').style.display = 'flex';
    p.querySelector('#ftg-error').style.display = 'none';

    await _nextFrame();

    GameState.phase = 'playing';
    GameState.locked = false;
    GameState.timeLeft = 60;
    GameState.foundCount = 0;
    GameState.winState = null;
    GameState.winSprite = null;
    GameState.roundStart = performance.now();

    // 重置天气
    resetWeather();

    initThreeScene();
    if (!isRetry || !GameState.mapBuilt) {
      buildMap();
      GameState.mapBuilt = true;
    }
    clearSceneEntities();
    spawnTank();
    startGameLoop();

    updateHUD();
  } catch (err) {
    console.error('[find-tank] 启动失败:', err);
    const errEl = p.querySelector('#ftg-error');
    errEl.textContent = '⚠ 游戏启动失败\n\n' + (err && err.message ? err.message : String(err));
    errEl.style.display = 'flex';
  } finally {
    GameState.starting = false;
  }
}

/* ============ 4. Three 场景 ============ */
function initThreeScene() {
  const wrap = document.getElementById('game-canvas-wrap');
  if (!wrap) throw new Error('缺少画布容器');
  if (!GameState.renderer) {
    GameState.scene = new THREE.Scene();
    GameState.scene.background = GameState.weather.params.bg.clone();
    GameState.scene.fog = new THREE.Fog(
      GameState.weather.params.fog.clone(),
      GameState.weather.params.fogNear,
      GameState.weather.params.fogFar
    );

    GameState.camera = new THREE.PerspectiveCamera(58, 1, 0.5, 900);
    GameState.camera.position.set(0, 95, 130);

    GameState.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    GameState.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    GameState.renderer.shadowMap.enabled = true;
    GameState.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    wrap.appendChild(GameState.renderer.domElement);

    if (THREE.OrbitControls) {
      const controls = new THREE.OrbitControls(GameState.camera, GameState.renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      // ← 关键：视角不能转到地图下面
      controls.minPolarAngle = 0.15;
      controls.maxPolarAngle = Math.PI / 2 - 0.05;
      controls.minDistance = 25;
      controls.maxDistance = 280;
      controls.target.set(0, 0, 0);
      controls.update();
      GameState.controls = controls;
    }

    GameState.hemiLight = new THREE.HemisphereLight(0xffffff, 0x445566, 0.5);
    GameState.scene.add(GameState.hemiLight);
    GameState.ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
    GameState.scene.add(GameState.ambientLight);
    GameState.dirLight = new THREE.DirectionalLight(0xffffff, 0.95);
    GameState.dirLight.position.set(80, 120, 60);
    GameState.dirLight.castShadow = true;
    GameState.dirLight.shadow.mapSize.width = 2048;
    GameState.dirLight.shadow.mapSize.height = 2048;
    const d = 220;
    Object.assign(GameState.dirLight.shadow.camera, {
      left: -d, right: d, top: d, bottom: -d, near: 1, far: 700,
    });
    GameState.dirLight.shadow.bias = -0.0006;
    GameState.scene.add(GameState.dirLight);
    GameState.scene.add(GameState.dirLight.target);

    GameState.raycaster = new THREE.Raycaster();
    GameState.pointer = new THREE.Vector2();
    GameState.clock = new THREE.Clock();
  }
  updateViewport();
}

function updateViewport() {
  const wrap = document.getElementById('game-canvas-wrap');
  if (!wrap) return;
  const w = Math.max(1, wrap.clientWidth);
  const h = Math.max(1, wrap.clientHeight);
  if (GameState.renderer) GameState.renderer.setSize(w, h);
  if (GameState.camera) {
    GameState.camera.aspect = w / h;
    GameState.camera.updateProjectionMatrix();
  }
}

/* ============ 5. 清场（只清动态实体，保留地图） ============ */
function clearSceneEntities() {
  if (!GameState.scene) return;
  if (GameState.winSprite) { GameState.scene.remove(GameState.winSprite); GameState.winSprite = null; }
  if (GameState.missileTrail) {
    GameState.scene.remove(GameState.missileTrail);
    GameState.missileTrail.geometry.dispose();
    GameState.missileTrail.material.dispose();
    GameState.missileTrail = null;
    GameState.missileTrailHistory = [];
  }
  GameState.objects.forEach(obj => {
    GameState.scene.remove(obj);
    if (obj.traverse) {
      obj.traverse(c => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) {
          const mats = Array.isArray(c.material) ? c.material : [c.material];
          mats.forEach(m => m.dispose && m.dispose());
        }
      });
    }
  });
  GameState.objects = [];
  GameState.targetTank = null;
  GameState.winState = null;
  GameState.usedSpots.clear();
}

/* ============ 6. 地形高度 ============ */
function terrainHeight(x, z) {
  const a = GameState.terrainAmp;
  let h = 0;
  if (a > 0.01) {
    h = Math.sin(x * 0.018) * Math.cos(z * 0.018) * a
      + Math.sin(x * 0.045 + 1.3) * Math.cos(z * 0.038 + 0.6) * a * 0.55
      + Math.sin(x * 0.09 + 2.1) * Math.cos(z * 0.1 + 1.9) * a * 0.28;
  }
  for (const f of GameState.terrainFeatures) {
    if (f.type === 'mountain') {
      const dx = x - f.x, dz = z - f.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < f.r) {
        const t = 1 - d / f.r;
        h += t * t * (3 - 2 * t) * f.height;
      }
    } else if (f.type === 'lake') {
      const dx = x - f.x, dz = z - f.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < f.r) {
        const t = 1 - d / f.r;
        h -= t * t * (3 - 2 * t) * f.depth;
      }
    } else if (f.type === 'flat') {
      const dx = x - f.x, dz = z - f.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < f.r) {
        const t = 1 - d / f.r;
        h = h * (1 - t * 0.9) + f.height * t;
      }
    }
  }
  // 地图边缘：渐升→渐降，配合浓雾
  const edgeStart = GameState.terrainSize / 2 - 70;
  const r = Math.hypot(x, z);
  if (r > edgeStart) {
    const t = Math.min(1, (r - edgeStart) / 60);
    // 边缘轻微抬高，形成视觉屏障
    h += t * 4;
  }
  return h;
}

/* ============ 7. 地面纹理 ============ */
function makeGroundTexture() {
  const key = 'ground_v45';
  if (GameState.texCache[key]) return GameState.texCache[key];
  const TS = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = TS;
  const ctx = c.getContext('2d');
  // 底：草绿
  ctx.fillStyle = '#4a6a3a';
  ctx.fillRect(0, 0, TS, TS);
  // 大色斑
  for (let i = 0; i < 280; i++) {
    const x = Math.random() * TS, y = Math.random() * TS;
    const r = 20 + Math.random() * 90;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const light = Math.random() < 0.5;
    g.addColorStop(0, light ? 'rgba(120,160,80,0.35)' : 'rgba(60,100,50,0.35)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // 细噪点
  const img = ctx.getImageData(0, 0, TS, TS);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 14;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 4;
  GameState.texCache[key] = tex;
  return tex;
}

function makeBuildingTexture(kind) {
  const key = `bld_${kind}`;
  if (GameState.texCache[key]) return GameState.texCache[key];
  const TS = 256;
  const c = document.createElement('canvas');
  c.width = c.height = TS;
  const ctx = c.getContext('2d');

  const isFactory = kind === 'factory';
  ctx.fillStyle = isFactory ? '#5a5e64' : '#6a6e74';
  ctx.fillRect(0, 0, TS, TS);
  // 噪声
  const img = ctx.getImageData(0, 0, TS, TS);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 14;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);

  if (isFactory) {
    // 厂房：水平窗带
    for (let j = 0; j < 6; j++) {
      const y = j * 42 + 8;
      ctx.fillStyle = 'rgba(40,50,60,0.6)';
      ctx.fillRect(10, y, TS - 20, 22);
      ctx.fillStyle = 'rgba(150,170,190,0.35)';
      for (let i = 0; i < 12; i++) {
        ctx.fillRect(14 + i * 20, y + 3, 14, 16);
      }
    }
  } else {
    // 一般建筑：小方窗
    for (let j = 0; j < 8; j++) {
      for (let i = 0; i < 5; i++) {
        const x = i * 50 + 10, y = j * 32 + 6;
        ctx.fillStyle = 'rgba(40,50,60,0.65)';
        ctx.fillRect(x, y, 36, 22);
        ctx.fillStyle = 'rgba(150,170,190,0.3)';
        ctx.fillRect(x + 2, y + 2, 32, 18);
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 2;
  GameState.texCache[key] = tex;
  return tex;
}

/* ============ 8. 固定地图生成 ============ */
const FIXED_FEATURES = [
  // 西北山脉群
  { type: 'mountain', x: -110, z: -110, r: 80, height: 45 },
  { type: 'mountain', x: -150, z: -50, r: 50, height: 28 },
  { type: 'mountain', x: -70, z: -140, r: 55, height: 32 },
  // 西南湖泊
  { type: 'lake', x: -90, z: 90, r: 50, depth: 6 },
  // 中部小湖
  { type: 'lake', x: 40, z: 130, r: 28, depth: 4 },
  // 工厂区（东部平原）
  { type: 'flat', x: 110, z: -80, r: 70, height: 0.6 },
];

function buildMap() {
  GameState.terrainFeatures = FIXED_FEATURES.map(f => ({ ...f }));
  GameState.terrainAmp = 6;
  GameState.occupiedBoxes = [];
  GameState.treePositions = [];
  GameState.tankSpots = [];

  // 地形网格
  const size = GameState.terrainSize;
  const geo = new THREE.PlaneGeometry(size, size, 90, 90);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i)));
  }
  geo.computeVertexNormals();

  const groundMat = new THREE.MeshStandardMaterial({
    map: makeGroundTexture(),
    roughness: 0.98,
    metalness: 0.02,
  });
  const ground = new THREE.Mesh(geo, groundMat);
  ground.receiveShadow = true;
  GameState.scene.add(ground);
  GameState.groundMesh = ground;

  // 水面
  addWaterSurfaces();

  // 植被 + 建筑（固定种子）
  const rng = makeRNG(20241015);
  buildTrees(rng);
  buildFactories(rng);
  buildRocks(rng);

  // 预生成坦克候选点
  buildTankSpots();

  // 初始化粒子系统
  buildParticleSystems();
}

function addWaterSurfaces() {
  for (const f of GameState.terrainFeatures) {
    if (f.type !== 'lake') continue;
    const y = terrainHeight(f.x, f.z) + 0.4;
    const geo = new THREE.CircleGeometry(f.r * 0.95, 32);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x2a5a80,
      transparent: true,
      opacity: 0.85,
      roughness: 0.15,
      metalness: 0.4,
    });
    const water = new THREE.Mesh(geo, mat);
    water.position.set(f.x, y, f.z);
    water.receiveShadow = true;
    GameState.scene.add(water);
    GameState.objects.push(water);
  }
}

function buildTrees(rng) {
  // 固定森林带
  const zones = [
    { cx: -90, cz: 90, r: 75, n: 130 },
    { cx: -100, cz: -90, r: 85, n: 110 },
    { cx: 90, cz: 60, r: 80, n: 80 },
    { cx: 0, cz: -20, r: 100, n: 60 },
    { cx: -60, cz: 30, r: 50, n: 50 },
    { cx: 130, cz: 100, r: 60, n: 60 },
  ];
  const positions = [];

  for (const z of zones) {
    for (let i = 0; i < z.n; i++) {
      const a = rng() * Math.PI * 2;
      const rr = Math.sqrt(rng()) * z.r;
      const x = z.cx + Math.cos(a) * rr;
      const zz = z.cz + Math.sin(a) * rr;
      if (Math.hypot(x, zz) > GameState.terrainSize / 2 - 8) continue;
      const h = terrainHeight(x, zz);
      if (h < 0.6 || h > 42) continue;   // 水里 / 太高的山不放
      if (isInFactoryZone(x, zz)) continue;
      positions.push({ x, z: zz, y: h });
    }
  }

  // 边缘密林（形成视觉屏障）
  const half = GameState.terrainSize / 2 - 15;
  for (let i = 0; i < 90; i++) {
    const a = rng() * Math.PI * 2;
    const r = half - 10 + rng() * 20;
    const x = Math.cos(a) * r;
    const zz = Math.sin(a) * r;
    const h = terrainHeight(x, zz);
    if (h < 0.6) continue;
    positions.push({ x, z: zz, y: h });
  }

  const count = positions.length;
  if (count === 0) return;

  // 树干（实例化）
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.32, 2.4, 5);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.95 });
  const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
  trunkMesh.castShadow = true;
  trunkMesh.receiveShadow = true;
  trunkMesh.raycast = () => {};   // 关键：不参与射线检测，让坦克可被点中

  // 树冠（实例化）
  const leafGeo = new THREE.ConeGeometry(1.7, 3.4, 6);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e5a2e, roughness: 0.9 });
  const leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, count);
  leafMesh.castShadow = true;
  leafMesh.raycast = () => {};

  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const t = positions[i];
    const s = 0.75 + rng() * 0.75;

    dummy.position.set(t.x, t.y + 1.2 * s, t.z);
    dummy.scale.set(s, s, s);
    dummy.rotation.set(0, rng() * Math.PI * 2, 0);
    dummy.updateMatrix();
    trunkMesh.setMatrixAt(i, dummy.matrix);

    dummy.position.set(t.x, t.y + (2.4 + 1.7) * s, t.z);
    dummy.updateMatrix();
    leafMesh.setMatrixAt(i, dummy.matrix);

    GameState.treePositions.push({ x: t.x, z: t.z });
  }
  trunkMesh.instanceMatrix.needsUpdate = true;
  leafMesh.instanceMatrix.needsUpdate = true;
  GameState.scene.add(trunkMesh);
  GameState.scene.add(leafMesh);
  GameState.objects.push(trunkMesh, leafMesh);
}

function isInFactoryZone(x, z) {
  const zone = FIXED_FEATURES.find(f => f.type === 'flat');
  if (!zone) return false;
  return Math.hypot(x - zone.x, z - zone.z) < zone.r;
}

function buildFactories(rng) {
  const zone = FIXED_FEATURES.find(f => f.type === 'flat');
  if (!zone) return;
  const tex = makeBuildingTexture('factory');

  // 4 个厂房
  const positions = [
    { x: zone.x - 22, z: zone.z - 20, w: 22, d: 16, h: 9 },
    { x: zone.x + 22, z: zone.z - 20, w: 22, d: 16, h: 9 },
    { x: zone.x - 22, z: zone.z + 20, w: 26, d: 18, h: 10 },
    { x: zone.x + 22, z: zone.z + 20, w: 26, d: 18, h: 10 },
  ];

  for (const p of positions) {
    const y = terrainHeight(p.x, p.z);

    const t = tex.clone();
    t.needsUpdate = true;
    t.repeat.set(2, Math.max(1, Math.round(p.h / 4)));

    const mat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.85, metalness: 0.18 });
    const group = new THREE.Group();

    const main = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), mat);
    main.position.y = p.h / 2;
    main.castShadow = true;
    main.receiveShadow = true;
    group.add(main);

    // 锯齿屋顶
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x7a7e84, roughness: 0.72, metalness: 0.28 });
    const teethCount = Math.max(2, Math.floor(p.w / 3));
    const tw = p.w / teethCount;
    for (let i = 0; i < teethCount; i++) {
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(tw * 0.9, 1.4, p.d * 0.9), roofMat);
      tooth.position.set(-p.w / 2 + tw / 2 + i * tw, p.h + 0.7, 0);
      tooth.castShadow = true;
      group.add(tooth);
    }

    group.position.set(p.x, y, p.z);
    GameState.scene.add(group);
    GameState.objects.push(group);

    GameState.occupiedBoxes.push({
      minX: p.x - p.w / 2 - 3, maxX: p.x + p.w / 2 + 3,
      minZ: p.z - p.d / 2 - 3, maxZ: p.z + p.d / 2 + 3,
    });
  }

  // 烟囱
  const chimMat = new THREE.MeshStandardMaterial({ color: 0x8a8a90, roughness: 0.85, metalness: 0.2 });
  for (let i = 0; i < 3; i++) {
    const x = zone.x + (i - 1) * 30;
    const z = zone.z - 35 + rng() * 4;
    const y = terrainHeight(x, z);
    const h = 22 + rng() * 8;
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, h, 10), chimMat);
    c.position.set(x, y + h / 2, z);
    c.castShadow = true;
    GameState.scene.add(c);
    GameState.objects.push(c);

    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 0.95, 0.8, 10),
      new THREE.MeshStandardMaterial({ color: 0xc04040, roughness: 0.7 })
    );
    band.position.set(x, y + h - 2, z);
    GameState.scene.add(band);
    GameState.objects.push(band);

    GameState.occupiedBoxes.push({
      minX: x - 3, maxX: x + 3, minZ: z - 3, maxZ: z + 3,
    });
  }

  // 油桶 / 集装箱
  const clutterColors = [0x8a5a3a, 0x4a6a8a, 0x7a7a3a, 0xc0503a];
  for (let i = 0; i < 30; i++) {
    const x = zone.x + (rng() - 0.5) * 100;
    const z = zone.z + (rng() - 0.5) * 100;
    if (!isPositionFree(x, z, 3)) continue;
    const y = terrainHeight(x, z);
    const color = clutterColors[Math.floor(rng() * clutterColors.length)];
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
    if (rng() < 0.5) {
      // 集装箱
      const w = 2 + rng() * 2, h = 1.6 + rng() * 0.6, d = 1.4 + rng() * 1;
      const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      box.position.set(x, y + h / 2, z);
      box.rotation.y = rng() * Math.PI * 2;
      box.castShadow = true;
      GameState.scene.add(box);
      GameState.objects.push(box);
      GameState.occupiedBoxes.push({
        minX: x - w, maxX: x + w, minZ: z - d, maxZ: z + d,
      });
    } else {
      // 油桶
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.2, 8), mat);
      barrel.position.set(x, y + 0.6, z);
      barrel.castShadow = true;
      GameState.scene.add(barrel);
      GameState.objects.push(barrel);
    }
  }
}

function buildRocks(rng) {
  const half = GameState.terrainSize / 2 - 20;
  const count = 60;
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x7a7a78, roughness: 0.95 });
  const rockGeo = new THREE.IcosahedronGeometry(1, 0);
  const rockMesh = new THREE.InstancedMesh(rockGeo, rockMat, count);
  rockMesh.castShadow = true;
  rockMesh.receiveShadow = true;
  const dummy = new THREE.Object3D();
  let placed = 0;
  let tries = 0;
  while (placed < count && tries < 500) {
    tries++;
    const x = (rng() - 0.5) * 2 * half;
    const z = (rng() - 0.5) * 2 * half;
    const h = terrainHeight(x, z);
    if (h < 1.5 || h > 45) continue;
    const s = 0.6 + rng() * 1.3;
    dummy.position.set(x, h + s * 0.4, z);
    dummy.scale.set(s, s * 0.8, s);
    dummy.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
    dummy.updateMatrix();
    rockMesh.setMatrixAt(placed, dummy.matrix);
    GameState.occupiedBoxes.push({
      minX: x - s, maxX: x + s, minZ: z - s, maxZ: z + s,
    });
    placed++;
  }
  while (placed < count) {
    dummy.position.set(0, -999, 0);
    dummy.updateMatrix();
    rockMesh.setMatrixAt(placed, dummy.matrix);
    placed++;
  }
  rockMesh.instanceMatrix.needsUpdate = true;
  GameState.scene.add(rockMesh);
  GameState.objects.push(rockMesh);
}

/* ============ 9. 坦克候选点 ============ */
function buildTankSpots() {
  const rng = makeRNG(77777);
  const half = GameState.terrainSize / 2 - 30;
  const spots = [];

  // 1. 优先：树林里（藏在树下）
  for (let i = 0; i < 40; i++) {
    const t = GameState.treePositions[Math.floor(rng() * GameState.treePositions.length)];
    if (!t) continue;
    const x = t.x + (rng() - 0.5) * 3;
    const z = t.z + (rng() - 0.5) * 3;
    if (!isPositionFree(x, z, 5)) continue;
    spots.push({ x, z });
  }

  // 2. 山地缓坡
  for (let i = 0; i < 30; i++) {
    const x = -140 + (rng() - 0.5) * 100;
    const z = -140 + (rng() - 0.5) * 100;
    const h = terrainHeight(x, z);
    if (h < 5 || h > 35) continue;
    if (!isPositionFree(x, z, 5)) continue;
    spots.push({ x, z });
  }

  // 3. 湖边
  for (let i = 0; i < 20; i++) {
    const lake = FIXED_FEATURES.find(f => f.type === 'lake' && f.r > 40);
    if (!lake) break;
    const a = rng() * Math.PI * 2;
    const r = lake.r + 8 + rng() * 25;
    const x = lake.x + Math.cos(a) * r;
    const z = lake.z + Math.sin(a) * r;
    if (!isPositionFree(x, z, 5)) continue;
    spots.push({ x, z });
  }

  // 4. 工厂区
  const zone = FIXED_FEATURES.find(f => f.type === 'flat');
  if (zone) {
    for (let i = 0; i < 20; i++) {
      const x = zone.x + (rng() - 0.5) * zone.r * 1.6;
      const z = zone.z + (rng() - 0.5) * zone.r * 1.6;
      if (!isPositionFree(x, z, 5)) continue;
      spots.push({ x, z });
    }
  }

  // 5. 随机填充
  for (let i = 0; i < 60 && spots.length < 120; i++) {
    const x = (rng() - 0.5) * 2 * half;
    const z = (rng() - 0.5) * 2 * half;
    if (!isPositionFree(x, z, 5)) continue;
    spots.push({ x, z });
  }

  GameState.tankSpots = spots;
}

function isPositionFree(x, z, radius) {
  const half = GameState.terrainSize / 2 - 8;
  if (Math.abs(x) > half || Math.abs(z) > half) return false;
  for (const b of GameState.occupiedBoxes) {
    if (x + radius > b.minX && x - radius < b.maxX &&
        z + radius > b.minZ && z - radius < b.maxZ) return false;
  }
  for (const f of GameState.terrainFeatures) {
    if (f.type === 'lake') {
      if (Math.hypot(x - f.x, z - f.z) < f.r + radius) return false;
    }
  }
  return true;
}

/* ============ 10. 精细坦克模型 ============ */
function createTankModel() {
  const group = new THREE.Group();
  const baseColor = 0x4a5a3a;

  const hullMat = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.78, metalness: 0.18 });
  const hullDarkMat = new THREE.MeshStandardMaterial({ color: 0x2a3a28, roughness: 0.8, metalness: 0.15 });
  const trackMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.95 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.85, metalness: 0.3 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x2f3338, roughness: 0.55, metalness: 0.7 });

  function makeTrack() {
    const t = new THREE.Group();
    const beltBottom = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.16, 0.42), trackMat);
    beltBottom.position.y = -0.28;
    t.add(beltBottom);
    const beltTop = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.16, 0.42), trackMat);
    beltTop.position.y = 0.32;
    t.add(beltTop);
    const beltFront = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.76, 0.42), trackMat);
    beltFront.position.set(1.72, 0.02, 0);
    t.add(beltFront);
    const beltBack = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.76, 0.42), trackMat);
    beltBack.position.set(-1.72, 0.02, 0);
    t.add(beltBack);
    const wheelGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.34, 10);
    for (let i = 0; i < 6; i++) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.x = Math.PI / 2;
      w.position.set(-1.35 + i * 0.54, 0, 0);
      t.add(w);
    }
    const driveGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.36, 8);
    const d1 = new THREE.Mesh(driveGeo, wheelMat);
    d1.rotation.x = Math.PI / 2;
    d1.position.set(-1.55, 0.05, 0);
    t.add(d1);
    const d2 = new THREE.Mesh(driveGeo, wheelMat);
    d2.rotation.x = Math.PI / 2;
    d2.position.set(1.55, 0.05, 0);
    t.add(d2);
    for (let i = 0; i < 10; i++) {
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.44), trackMat);
      tooth.position.set(-1.6 + i * 0.36, 0.4, 0);
      t.add(tooth);
    }
    return t;
  }

  const trackL = makeTrack();
  trackL.position.set(0, 0.35, 0.82);
  group.add(trackL);
  const trackR = makeTrack();
  trackR.position.set(0, 0.35, -0.82);
  group.add(trackR);

  const hullLower = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.5, 1.55), hullMat);
  hullLower.position.set(0, 0.6, 0);
  hullLower.castShadow = true;
  group.add(hullLower);

  const hullUpper = new THREE.Mesh(new THREE.BoxGeometry(2.95, 0.45, 1.35), hullMat);
  hullUpper.position.set(0, 1.05, 0);
  hullUpper.castShadow = true;
  group.add(hullUpper);

  const glacis = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 1.35), hullDarkMat);
  glacis.rotation.z = -Math.PI / 4.5;
  glacis.position.set(1.35, 0.85, 0);
  glacis.castShadow = true;
  group.add(glacis);

  // 炮塔（前置）
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.78, 0.12, 14), hullDarkMat);
  ring.position.set(0.35, 1.34, 0);
  group.add(ring);

  const turret = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.55, 1.3), hullMat);
  turret.position.set(0.35, 1.65, 0);
  turret.castShadow = true;
  group.add(turret);

  const turretFront = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 1.15), hullMat);
  turretFront.position.set(1.1, 1.68, 0);
  turretFront.castShadow = true;
  group.add(turretFront);

  const turretTop = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.14, 1.15), hullMat);
  turretTop.position.set(0.35, 1.99, 0);
  turretTop.castShadow = true;
  group.add(turretTop);

  const mantlet = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.52, 0.85), hullDarkMat);
  mantlet.position.set(1.38, 1.7, 0);
  group.add(mantlet);

  const barrelBase = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.5, 10), metalMat);
  barrelBase.rotation.z = -Math.PI / 2;
  barrelBase.position.set(1.7, 1.7, 0);
  group.add(barrelBase);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 2.4, 10), metalMat);
  barrel.rotation.z = -Math.PI / 2;
  barrel.position.set(3.15, 1.7, 0);
  barrel.castShadow = true;
  group.add(barrel);

  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.32, 10), metalMat);
  muzzle.rotation.z = -Math.PI / 2;
  muzzle.position.set(4.35, 1.7, 0);
  group.add(muzzle);

  const cupola = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.24, 10), hullMat);
  cupola.position.set(-0.25, 2.1, 0.38);
  group.add(cupola);

  const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.05, 10), hullDarkMat);
  hatch.position.set(-0.25, 2.24, 0.38);
  group.add(hatch);

  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.4, 4), metalMat);
  antenna.position.set(-0.65, 2.7, -0.4);
  group.add(antenna);

  // 标记坦克根节点
  group.userData.isTank = true;
  group.traverse(c => { c.userData.tankRoot = group; });

  return group;
}

/* ============ 11. 藏匿坦克 ============ */
function spawnTank() {
  if (!GameState.scene) return;
  if (GameState.tankSpots.length === 0) return;

  // 找一个未用过的点
  let spot = null;
  for (let i = 0; i < 60; i++) {
    const s = GameState.tankSpots[Math.floor(Math.random() * GameState.tankSpots.length)];
    const key = `${Math.round(s.x)},${Math.round(s.z)}`;
    if (GameState.usedSpots.has(key)) continue;
    spot = s;
    GameState.usedSpots.add(key);
    break;
  }
  // 全用过了：清空再用
  if (!spot) {
    GameState.usedSpots.clear();
    spot = GameState.tankSpots[Math.floor(Math.random() * GameState.tankSpots.length)];
  }

  const tank = createTankModel();
  const y = terrainHeight(spot.x, spot.z);
  tank.position.set(spot.x, y, spot.z);
  tank.rotation.y = Math.random() * Math.PI * 2;

  GameState.scene.add(tank);
  GameState.objects.push(tank);
  GameState.targetTank = tank;
}

/* ============ 12. 天气系统（渐变） ============ */
const WEATHER_PRESETS = {
  summer: {
    bg: 0x8fc8f0, fog: 0xb8d8ee,
    fogNear: 150, fogFar: 480,
    hemi: 0.7, ambient: 0.35,
    dir: 1.0, dirColor: 0xfff3e0,
    rain: 0, snow: 0,
  },
  rain: {
    bg: 0x39404d, fog: 0x4a5260,
    fogNear: 80, fogFar: 260,
    hemi: 0.45, ambient: 0.32,
    dir: 0.42, dirColor: 0xbcc6d4,
    rain: 0.55, snow: 0,
  },
  snow: {
    bg: 0xc8d8e8, fog: 0xd0dce8,
    fogNear: 100, fogFar: 320,
    hemi: 0.6, ambient: 0.4,
    dir: 0.55, dirColor: 0xecf2ff,
    rain: 0, snow: 1,
  },
};

const WEATHER_CYCLE = ['summer', 'rain', 'snow'];

function resetWeather() {
  const w = GameState.weather;
  w.current = 'summer';
  w.target = 'summer';
  w.holdTimer = 25;
  w.transitionT = 1;
  // 立即将参数设置为夏天
  const p = WEATHER_PRESETS.summer;
  w.params.bg.setHex(p.bg);
  w.params.fog.setHex(p.fog);
  w.params.fogNear = p.fogNear;
  w.params.fogFar = p.fogFar;
  w.params.hemi = p.hemi;
  w.params.ambient = p.ambient;
  w.params.dir = p.dir;
  w.params.dirColor.setHex(p.dirColor);
  w.params.rain = p.rain;
  w.params.snow = p.snow;
  if (GameState.scene) {
    GameState.scene.background = w.params.bg.clone();
    if (GameState.scene.fog) {
      GameState.scene.fog.color.copy(w.params.fog);
      GameState.scene.fog.near = w.params.fogNear;
      GameState.scene.fog.far = w.params.fogFar;
    }
  }
  updateWeatherInfoUI();
}

function updateWeather(dt) {
  const w = GameState.weather;
  if (!GameState.scene) return;

  // 停留在当前天气
  if (w.transitionT >= 1) {
    w.holdTimer -= dt;
    if (w.holdTimer <= 0) {
      // 选下一个天气
      const idx = WEATHER_CYCLE.indexOf(w.target);
      w.current = w.target;
      w.target = WEATHER_CYCLE[(idx + 1) % WEATHER_CYCLE.length];
      w.transitionT = 0;
      w.holdTimer = 25 + Math.random() * 10;
      updateWeatherInfoUI();
    }
    return;
  }

  // 渐变过渡
  w.transitionT = Math.min(1, w.transitionT + dt / w.transitionDur);
  const t = smoothstep(w.transitionT);
  const from = WEATHER_PRESETS[w.current];
  const to = WEATHER_PRESETS[w.target];
  const p = w.params;

  p.bg.setHex(from.bg).lerp(new THREE.Color(to.bg), t);
  p.fog.setHex(from.fog).lerp(new THREE.Color(to.fog), t);
  p.fogNear = from.fogNear + (to.fogNear - from.fogNear) * t;
  p.fogFar = from.fogFar + (to.fogFar - from.fogFar) * t;
  p.hemi = from.hemi + (to.hemi - from.hemi) * t;
  p.ambient = from.ambient + (to.ambient - from.ambient) * t;
  p.dir = from.dir + (to.dir - from.dir) * t;
  p.dirColor.setHex(from.dirColor).lerp(new THREE.Color(to.dirColor), t);
  p.rain = from.rain + (to.rain - from.rain) * t;
  p.snow = from.snow + (to.snow - from.snow) * t;

  applyWeatherParams();
}

function smoothstep(t) { return t * t * (3 - 2 * t); }

function applyWeatherParams() {
  const p = GameState.weather.params;
  const s = GameState.scene;
  if (!s) return;
  if (!s.background) s.background = new THREE.Color();
  s.background.copy(p.bg);
  if (s.fog) {
    s.fog.color.copy(p.fog);
    s.fog.near = p.fogNear;
    s.fog.far = p.fogFar;
  }
  if (GameState.hemiLight) GameState.hemiLight.intensity = p.hemi;
  if (GameState.ambientLight) GameState.ambientLight.intensity = p.ambient;
  if (GameState.dirLight) {
    GameState.dirLight.intensity = p.dir;
    GameState.dirLight.color.copy(p.dirColor);
  }
  if (GameState.rainParticles) {
    GameState.rainParticles.material.opacity = 0.7 * p.rain;
    GameState.rainParticles.visible = p.rain > 0.01;
  }
  if (GameState.snowParticles) {
    GameState.snowParticles.material.opacity = 0.95 * p.snow;
    GameState.snowParticles.visible = p.snow > 0.01;
  }
}

function updateWeatherInfoUI() {
  const el = document.getElementById('ftg-weather-info');
  if (!el) return;
  const names = { summer: '☀ 夏日', rain: '🌧 阴雨', snow: '❄ 飘雪' };
  el.textContent = names[GameState.weather.target] || '';
}

/* ============ 13. 粒子 ============ */
function makeSnowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.7)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}
function makeRainTexture() {
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 32;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 32);
  g.addColorStop(0, 'rgba(200,220,255,0)');
  g.addColorStop(0.5, 'rgba(200,220,255,0.85)');
  g.addColorStop(1, 'rgba(200,220,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(2, 0, 4, 32);
  return new THREE.CanvasTexture(c);
}

function buildParticleSystems() {
  const areaSize = GameState.terrainSize * 0.9;
  const topY = 120;

  // 雨
  {
    const count = 6000;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * areaSize;
      pos[i * 3 + 1] = Math.random() * topY;
      pos[i * 3 + 2] = (Math.random() - 0.5) * areaSize;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      size: 1.2, map: makeRainTexture(),
      transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true,
    });
    const pts = new THREE.Points(geo, mat);
    pts.raycast = () => {};
    pts.visible = false;
    GameState.scene.add(pts);
    GameState.rainParticles = pts;
  }

  // 雪
  {
    const count = 3000;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * areaSize;
      pos[i * 3 + 1] = Math.random() * topY;
      pos[i * 3 + 2] = (Math.random() - 0.5) * areaSize;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      size: 1.4, map: makeSnowTexture(),
      transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true,
    });
    const pts = new THREE.Points(geo, mat);
    pts.raycast = () => {};
    pts.visible = false;
    GameState.scene.add(pts);
    GameState.snowParticles = pts;
  }
}

function updateParticles(dt) {
  const w = GameState.weather.params;
  const areaSize = GameState.terrainSize * 0.9;
  const topY = 120;

  if (GameState.rainParticles && w.rain > 0.01) {
    const arr = GameState.rainParticles.geometry.attributes.position.array;
    const count = arr.length / 3;
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      arr[i3 + 1] -= 85 * dt;
      arr[i3] += 3 * dt;
      if (arr[i3 + 1] < 0) {
        arr[i3 + 1] = topY;
        arr[i3] = (Math.random() - 0.5) * areaSize;
        arr[i3 + 2] = (Math.random() - 0.5) * areaSize;
      }
    }
    GameState.rainParticles.geometry.attributes.position.needsUpdate = true;
  }
  if (GameState.snowParticles && w.snow > 0.01) {
    const arr = GameState.snowParticles.geometry.attributes.position.array;
    const count = arr.length / 3;
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      arr[i3 + 1] -= 6 * dt;
      arr[i3] += Math.sin((arr[i3 + 1] + i) * 0.35) * 1.2 * dt;
      if (arr[i3 + 1] < 0) {
        arr[i3 + 1] = topY;
        arr[i3] = (Math.random() - 0.5) * areaSize;
        arr[i3 + 2] = (Math.random() - 0.5) * areaSize;
      }
    }
    GameState.snowParticles.geometry.attributes.position.needsUpdate = true;
  }
}

/* ============ 14. 点击处理 ============ */
function handleCanvasClick(clientX, clientY) {
  if (GameState.phase !== 'playing') return;
  if (GameState.locked) return;
  if (!GameState.targetTank) return;

  const rect = GameState.renderer.domElement.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((clientY - rect.top) / rect.height) * 2 + 1;
  GameState.pointer.set(x, y);
  GameState.raycaster.setFromCamera(GameState.pointer, GameState.camera);

  // 收集目标坦克的所有 mesh
  const tankMeshes = [];
  GameState.targetTank.traverse(o => { if (o.isMesh) tankMeshes.push(o); });

  // 射线检测
  const tankHits = GameState.raycaster.intersectObjects(tankMeshes, false);
  if (tankHits.length === 0) return;

  // 检查是否有障碍物在坦克前面
  const allHits = GameState.raycaster.intersectObjects(GameState.scene.children, true);
  for (const hit of allHits) {
    const obj = hit.object;
    if (obj.raycast === undefined) continue;
    // 树、粒子、地面不阻挡
    if (obj.isPoints || obj.isSprite) continue;
    if (obj === GameState.groundMesh) continue;
    // 检查是否为坦克子物体
    let n = obj;
    let isTank = false;
    while (n) {
      if (n === GameState.targetTank) { isTank = true; break; }
      n = n.parent;
    }
    if (isTank) triggerWin();
    return;
  }
}

/* ============ 15. 胜利 + 自动刷新 ============ */
function triggerWin() {
  if (GameState.locked) return;
  GameState.locked = true;

  GameState.foundCount++;
  updateHUD();

  if (typeof playSound === 'function') playSound('fav');

  // "!" 标记
  const sprite = makeExclamationSprite();
  const tankPos = GameState.targetTank.position.clone();
  sprite.position.set(tankPos.x, tankPos.y + 7, tankPos.z);
  GameState.scene.add(sprite);
  GameState.winSprite = sprite;

  // 计算逃跑方向
  const half = GameState.terrainSize / 2;
  const p = GameState.targetTank.position;
  const distToEdge = {
    px: half - p.x, nx: half + p.x, pz: half - p.z, nz: half + p.z,
  };
  let dirX = 0, dirZ = 0;
  const minKey = Object.keys(distToEdge).reduce((a, b) => distToEdge[a] < distToEdge[b] ? a : b);
  if (minKey === 'px') dirX = 1;
  else if (minKey === 'nx') dirX = -1;
  else if (minKey === 'pz') dirZ = 1;
  else dirZ = -1;

  GameState.winState = {
    phase: 'alert',
    t: 0,
    sprite,
    tank: GameState.targetTank,
    dir: new THREE.Vector3(dirX, 0, dirZ).normalize(),
    baseY: tankPos.y,
    missile: null,
    missileVel: null,
    missileActive: false,
  };
}

function makeExclamationSprite() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.font = 'bold 220px -apple-system, "PingFang SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 14;
  ctx.strokeStyle = '#1a1208';
  ctx.strokeText('!', 64, 128);
  ctx.fillStyle = '#ffd83a';
  ctx.fillText('!', 64, 128);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(4, 8, 1);
  sprite.renderOrder = 999;
  return sprite;
}

/* ============ 16. 导弹 ============ */
function createMissileModel() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 2.6, 10),
    new THREE.MeshStandardMaterial({ color: 0x8a8a92, roughness: 0.5, metalness: 0.6 })
  );
  body.rotation.z = -Math.PI / 2;
  g.add(body);
  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 0.7, 10),
    new THREE.MeshStandardMaterial({ color: 0xcc4444, roughness: 0.4, metalness: 0.5 })
  );
  nose.rotation.z = -Math.PI / 2;
  nose.position.x = 1.65;
  g.add(nose);
  const finMat = new THREE.MeshStandardMaterial({ color: 0x4a4a52, roughness: 0.6, metalness: 0.4 });
  for (let i = 0; i < 3; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.75, 0.06), finMat);
    fin.position.x = -1.1;
    fin.position.y = Math.cos((i / 3) * Math.PI * 2) * 0.22;
    fin.position.z = Math.sin((i / 3) * Math.PI * 2) * 0.22;
    fin.rotation.y = (i / 3) * Math.PI * 2;
    g.add(fin);
  }
  const flame = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 10, 10),
    new THREE.MeshBasicMaterial({
      color: 0xffaa33, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  flame.position.x = -1.55;
  flame.name = 'flame';
  g.add(flame);
  const flameInner = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 10, 10),
    new THREE.MeshBasicMaterial({
      color: 0xffffcc, transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  flameInner.position.x = -1.5;
  flameInner.name = 'flameInner';
  g.add(flameInner);
  return g;
}

function spawnMissile() {
  const w = GameState.winState;
  if (!w) return;
  const tankPos = w.tank.position.clone();
  const camPos = GameState.camera.position.clone();
  const awayDir = camPos.clone().sub(tankPos).normalize();
  const spawnPos = camPos.clone().add(awayDir.multiplyScalar(150));
  spawnPos.y += 45;
  spawnPos.x += (Math.random() - 0.5) * 60;
  spawnPos.z += (Math.random() - 0.5) * 60;

  const missile = createMissileModel();
  missile.position.copy(spawnPos);
  const toTank = tankPos.clone().sub(spawnPos).normalize();
  missile.rotation.y = Math.atan2(-toTank.z, toTank.x);
  GameState.scene.add(missile);

  const SPEED = 220;
  const vel = toTank.multiplyScalar(SPEED);
  w.missile = missile;
  w.missileVel = vel;
  w.missileActive = true;

  setupMissileTrail();
  if (typeof playSound === 'function') playSound('open');
}

const MISSILE_TRAIL_MAX = 80;
function setupMissileTrail() {
  if (GameState.missileTrail) {
    GameState.scene.remove(GameState.missileTrail);
    GameState.missileTrail.geometry.dispose();
    GameState.missileTrail.material.dispose();
  }
  const positions = new Float32Array(MISSILE_TRAIL_MAX * 3);
  for (let i = 0; i < MISSILE_TRAIL_MAX; i++) positions[i * 3 + 1] = -9999;
  const colors = new Float32Array(MISSILE_TRAIL_MAX * 3);
  for (let i = 0; i < MISSILE_TRAIL_MAX; i++) {
    const t = i / MISSILE_TRAIL_MAX;
    colors[i * 3] = Math.max(0, 1.0 - t * 0.6);
    colors[i * 3 + 1] = Math.max(0, 0.85 - t * 0.75);
    colors[i * 3 + 2] = Math.max(0, 0.35 - t * 0.3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 2.4, vertexColors: true, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  });
  const pts = new THREE.Points(geo, mat);
  pts.raycast = () => {};
  pts.frustumCulled = false;
  GameState.scene.add(pts);
  GameState.missileTrail = pts;
  GameState.missileTrailHistory = [];
}

function updateMissileTrail() {
  const trail = GameState.missileTrail;
  const w = GameState.winState;
  if (!trail || !w || !w.missile) return;
  const hist = GameState.missileTrailHistory;
  hist.unshift(w.missile.position.clone());
  if (hist.length > MISSILE_TRAIL_MAX) hist.length = MISSILE_TRAIL_MAX;
  const posArr = trail.geometry.attributes.position.array;
  for (let i = 0; i < MISSILE_TRAIL_MAX; i++) {
    if (i < hist.length) {
      const p = hist[i];
      posArr[i * 3] = p.x;
      posArr[i * 3 + 1] = p.y;
      posArr[i * 3 + 2] = p.z;
    } else {
      posArr[i * 3 + 1] = -9999;
    }
  }
  trail.geometry.attributes.position.needsUpdate = true;
}

function updateMissile(dt) {
  const w = GameState.winState;
  if (!w || !w.missile || !w.missileActive) return;
  const missile = w.missile;
  const tank = w.tank;
  const targetPos = tank.position.clone();
  targetPos.y += 1.5;
  const toTarget = targetPos.clone().sub(missile.position);
  const dist = toTarget.length();
  const desiredDir = toTarget.clone().normalize();
  const desiredVel = desiredDir.clone().multiplyScalar(w.missileVel.length());
  const turnRate = 4.5;
  w.missileVel.lerp(desiredVel, Math.min(1, turnRate * dt));

  let speedMul = 1;
  if (dist < 40) speedMul = 0.75;
  if (dist < 22) speedMul = 0.45;
  if (dist < 12) speedMul = 0.15;
  missile.position.addScaledVector(w.missileVel, dt * speedMul);

  const v = w.missileVel.clone().normalize();
  const targetRot = Math.atan2(-v.z, v.x);
  let diff = targetRot - missile.rotation.y;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  missile.rotation.y += diff * Math.min(1, dt * 10);

  const flame = missile.getObjectByName('flame');
  const flameInner = missile.getObjectByName('flameInner');
  if (flame) {
    const s = 1 + Math.sin(performance.now() * 0.03) * 0.15;
    flame.scale.setScalar(s);
  }
  if (flameInner) {
    const s = 1 + Math.sin(performance.now() * 0.04 + 1) * 0.2;
    flameInner.scale.setScalar(s);
  }
  updateMissileTrail();
}

/* ============ 17. 胜利动画 + 自动刷新 ============ */
function updateWinAnimation(dt) {
  const w = GameState.winState;
  if (!w) return;
  w.t += dt;

  if (w.phase === 'alert') {
    if (w.sprite) {
      const pulse = 1 + Math.sin(w.t * 10) * 0.15;
      w.sprite.scale.set(4 * pulse, 8 * pulse, 1);
      w.sprite.position.y = w.baseY + 7 + Math.sin(w.t * 6) * 0.5;
    }
    if (w.t > 0.5) {
      w.phase = 'missile';
      w.t = 0;
      spawnMissile();
    }
    return;
  }

  if (w.phase === 'missile') {
    if (w.sprite) {
      const pulse = 1 + Math.sin(w.t * 10) * 0.15;
      w.sprite.scale.set(4 * pulse, 8 * pulse, 1);
      w.sprite.position.y = w.baseY + 7 + Math.sin(w.t * 6) * 0.5;
    }
    updateMissile(dt);
    if (w.missile) {
      const dist = w.missile.position.distanceTo(w.tank.position);
      if (dist < 50) {
        w.phase = 'escape';
        w.escapeT = 0;
        if (w.missileVel) w.missileVel.setLength(Math.max(80, w.missileVel.length() * 0.7));
      }
    }
    return;
  }

  if (w.phase === 'escape') {
    w.escapeT += dt;
    const SPEED = 90;
    w.tank.position.x += w.dir.x * SPEED * dt;
    w.tank.position.z += w.dir.z * SPEED * dt;
    w.tank.position.y = terrainHeight(w.tank.position.x, w.tank.position.z);

    const targetRot = Math.atan2(w.dir.x, w.dir.z);
    let diff = targetRot - w.tank.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    w.tank.rotation.y += diff * Math.min(1, dt * 6);

    updateMissile(dt);

    const out = GameState.terrainSize / 2 + 30;
    if (Math.abs(w.tank.position.x) > out || Math.abs(w.tank.position.z) > out) {
      // 清场
      if (w.missile) { GameState.scene.remove(w.missile); w.missile = null; }
      if (GameState.missileTrail) {
        GameState.scene.remove(GameState.missileTrail);
        GameState.missileTrail.geometry.dispose();
        GameState.missileTrail.material.dispose();
        GameState.missileTrail = null;
      }
      if (w.sprite) {
        GameState.scene.remove(w.sprite);
        GameState.winSprite = null;
      }
      // 移除旧坦克
      const idx = GameState.objects.indexOf(w.tank);
      if (idx >= 0) GameState.objects.splice(idx, 1);
      GameState.scene.remove(w.tank);
      w.tank.traverse(c => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) {
          const mats = Array.isArray(c.material) ? c.material : [c.material];
          mats.forEach(m => m.dispose && m.dispose());
        }
      });

      GameState.winState = null;
      GameState.targetTank = null;
      GameState.locked = false;

      // 时间未结束 → 立刻生成下一辆
      if (GameState.phase === 'playing' && GameState.timeLeft > 0) {
        setTimeout(() => {
          if (GameState.phase === 'playing') spawnTank();
        }, 100);
      }
    }
  }
}

/* ============ 18. HUD / 结算 ============ */
function updateHUD() {
  const p = GameState.panel;
  if (!p) return;
  p.querySelector('#ftg-found').textContent = GameState.foundCount;
}

function endGame() {
  if (GameState.phase !== 'playing') return;
  GameState.phase = 'won';
  GameState.locked = true;
  const p = GameState.panel;

  // 更新最佳成绩
  try {
    const saved = parseInt(localStorage.getItem('tw_ftg_best') || '0', 10);
    if (GameState.foundCount > saved) {
      localStorage.setItem('tw_ftg_best', String(GameState.foundCount));
      GameState.bestScore = GameState.foundCount;
    } else {
      GameState.bestScore = saved;
    }
  } catch (e) { GameState.bestScore = GameState.foundCount; }

  p.querySelector('#ftg-result-found').textContent = GameState.foundCount;
  p.querySelector('#ftg-result-best').textContent = GameState.bestScore;
  p.querySelector('#ftg-result').style.display = 'flex';

  // 随机推荐
  const cardEl = p.querySelector('#ftg-result-card');
  let tk = null;
  try {
    if (typeof tanks !== 'undefined' && tanks.length) {
      tk = tanks[Math.floor(Math.random() * tanks.length)];
    }
  } catch (e) {}
  if (tk) {
    cardEl.style.display = 'block';
    cardEl.innerHTML = `
      <div style="display:flex;gap:12px;align-items:center;">
        <img src="${esc(tk.imgs[0] || '')}" alt=""
             style="width:72px;height:72px;object-fit:contain;background:#1a1a1e;border-radius:10px;flex-shrink:0;"
             onerror="this.style.opacity='0.3'">
        <div style="flex:1;min-width:0;text-align:left;">
          <div style="font-size:15px;font-weight:700;color:#fff;margin-bottom:3px;">${esc(tk.name)}</div>
          <div style="font-size:11px;color:#8a8a92;line-height:1.4;">${esc(getCardInfoSafe(tk))}</div>
          <div style="font-size:11px;color:#ffd83a;margin-top:6px;">点击查看详情 →</div>
        </div>
      </div>
    `;
    cardEl.onclick = () => {
      closeFindTankGame();
      if (typeof showTankDetail === 'function') setTimeout(() => showTankDetail(tk), 120);
    };
    cardEl.onmouseenter = () => { cardEl.style.background = 'rgba(255,255,255,0.09)'; cardEl.style.borderColor = 'rgba(255,216,58,0.4)'; };
    cardEl.onmouseleave = () => { cardEl.style.background = 'rgba(255,255,255,0.05)'; cardEl.style.borderColor = 'rgba(255,255,255,0.1)'; };
  } else {
    cardEl.style.display = 'none';
  }
  if (typeof playSound === 'function') playSound('open');
}

/* ============ 19. 主循环 ============ */
function startGameLoop() {
  if (GameState.animId) return;
  if (!GameState.clock) GameState.clock = new THREE.Clock();
  GameState.clock.getDelta();

  const loop = () => {
    GameState.animId = requestAnimationFrame(loop);
    const dt = Math.min(0.05, GameState.clock.getDelta());

    // 计时
    if (GameState.phase === 'playing') {
      GameState.timeLeft -= dt;
      if (GameState.timeLeft <= 0) {
        GameState.timeLeft = 0;
        updateTimerUI();
        endGame();
      } else {
        updateTimerUI();
      }
    }

    // 天气渐变
    updateWeather(dt);

    // 粒子
    updateParticles(dt);

    // 胜利动画
    if (GameState.winState) updateWinAnimation(dt);

    // 相机约束（不能钻到地图下面）
    if (GameState.controls) {
      GameState.controls.update();
      const camY = GameState.camera.position.y;
      const minY = terrainHeight(GameState.camera.position.x, GameState.camera.position.z) + 6;
      if (camY < minY) {
        GameState.camera.position.y = minY;
      }
    }

    if (GameState.renderer && GameState.scene && GameState.camera) {
      GameState.renderer.render(GameState.scene, GameState.camera);
    }
  };
  GameState.animId = requestAnimationFrame(loop);
}

function updateTimerUI() {
  const el = document.getElementById('ftg-timer');
  if (el) el.textContent = GameState.timeLeft.toFixed(1);
}

function stopGameLoop() {
  if (GameState.animId) {
    cancelAnimationFrame(GameState.animId);
    GameState.animId = null;
  }
}

/* ============ 20. ESC ============ */
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!GameState.panel || GameState.panel.style.display === 'none') return;
  if (GameState.phase === 'menu') { closeFindTankGame(); return; }
  if (GameState.phase === 'playing') { showMenu(); return; }
  if (GameState.phase === 'won') { beginLevel(true); }
});

/* ============ 导出 ============ */
window.startFindTankGame = startFindTankGame;
window.closeFindTankGame = closeFindTankGame;