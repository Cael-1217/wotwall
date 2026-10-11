// ==================== find-tank-game.js — 寻找坦克 3D v3 ====================

/* ==================== 全局状态 ==================== */
const GameState = {
  scene: null, camera: null, renderer: null, controls: null,
  animId: null, clock: null,
  currentTheme: 'summer',
  currentMap: 'forest',
  targetTank: null,
  targetType: 'MBT',
  objects: [],
  panel: null,
  dirLight: null, ambientLight: null, hemiLight: null,
  starting: false,

  phase: 'menu',
  startTime: 0, elapsed: 0,
  level: 1, locked: false,

  particleObj: null, particleType: null,
  winState: null, winSprite: null,

  raycaster: null, pointer: null,
  pointerDown: null,

  terrainAmp: 3,
  terrainSize: 400,   // ← 地图放大到 400×400
  streetPeriod: 50,   // ← 街区周期
  streetWidth: 9,     // ← 街道宽度

  occupiedBoxes: [],  // ← 建筑占位 AABB 列表
  texCache: {},
};

const GAME_LIB_PATHS = { three: 'three.min.js', orbit: 'OrbitControls.js' };

/* ==================== 工具 ==================== */
function _nextFrame() {
  return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
}
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
    catch (e) { console.warn('[find-tank] OrbitControls 未加载'); }
  }
}
function getCardInfoSafe(t) {
  try { return (typeof getCardInfoText === 'function') ? getCardInfoText(t) : ''; }
  catch { return ''; }
}
function esc(s) { return (typeof escapeHtml === 'function') ? escapeHtml(s) : String(s); }
function rand(a, b) { return a + Math.random() * (b - a); }
function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

/* ==================== 1. 面板 ==================== */
function initFindTankGame() {
  if (GameState.panel) return GameState.panel;

  const panel = document.createElement('div');
  panel.id = 'find-tank-panel';
  panel.style.cssText = 'position:fixed;inset:0;z-index:400;background:#0b0b0e;display:none;flex-direction:column;overflow:hidden;';

  panel.innerHTML = `
    <div id="ftg-hud" style="display:none;padding:8px 14px;padding-top:calc(8px + env(safe-area-inset-top));background:linear-gradient(to bottom,rgba(10,10,14,0.96),rgba(10,10,14,0.72));color:#fff;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-shrink:0;z-index:5;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.08);backdrop-filter:blur(8px);">
      <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;">
        <span>🎯 <b id="ftg-level" style="color:#ffd83a;">1</b></span>
        <span>⏱ <b id="ftg-timer">0.0</b>s</span>
        <span id="ftg-map-info" style="color:#8a8a92;font-size:12px;"></span>
      </div>
      <div style="display:flex;gap:6px;">
        <button id="ftg-btn-restart" style="padding:6px 12px;border-radius:6px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:#e8e8ea;font-family:inherit;font-size:12px;cursor:pointer;">重开</button>
        <button id="ftg-btn-quit" style="padding:6px 12px;border-radius:6px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:#e8e8ea;font-family:inherit;font-size:12px;cursor:pointer;">退出</button>
      </div>
    </div>

    <div id="game-canvas-wrap" style="flex:1;position:relative;min-height:0;background:#0b0b0e;overflow:hidden;">
      <div id="ftg-error" style="display:none;position:absolute;inset:0;z-index:10;align-items:center;justify-content:center;background:rgba(11,11,14,0.94);color:#ff8a8a;font-size:14px;padding:24px;text-align:center;white-space:pre-wrap;line-height:1.6;"></div>
    </div>

    <div id="ftg-menu" style="position:absolute;inset:0;z-index:20;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 35%, #1c2028, #0b0b0e 70%);color:#fff;padding:24px;text-align:center;">
      <div style="font-size:52px;margin-bottom:8px;filter:drop-shadow(0 6px 20px rgba(255,216,58,0.35));">🎯</div>
      <h1 style="margin:0;font-size:32px;font-weight:800;letter-spacing:-0.02em;background:linear-gradient(135deg,#ffd83a,#c9a860);-webkit-background-clip:text;background-clip:text;color:transparent;">寻找坦克</h1>
      <p style="color:#8a8a92;font-size:13px;margin:12px 0 28px;line-height:1.7;max-width:340px;">
        在地图中找到藏匿的坦克<br>只要视野无遮挡，点击它即可获胜
      </p>
      <button id="ftg-btn-start" style="padding:14px 56px;border-radius:999px;border:none;background:linear-gradient(135deg,#ffd83a,#c9a860);color:#1a1611;font-family:inherit;font-size:16px;font-weight:700;letter-spacing:0.05em;cursor:pointer;box-shadow:0 8px 28px rgba(255,216,58,0.35);margin-bottom:12px;">开始游戏</button>
      <button id="ftg-btn-menu-quit" style="padding:12px 40px;border-radius:999px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.04);color:#8a8a92;font-family:inherit;font-size:14px;cursor:pointer;">退出</button>
      <div id="ftg-menu-status" style="color:#8a8a92;font-size:12px;margin-top:20px;height:16px;"></div>
    </div>

    <div id="ftg-result" style="position:absolute;inset:0;z-index:20;display:none;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 40%, rgba(28,32,40,0.97), rgba(11,11,14,0.99));color:#fff;padding:24px;text-align:center;overflow-y:auto;">
      <div style="font-size:44px;margin-bottom:6px;">🎉</div>
      <h2 style="margin:0 0 6px;font-size:26px;font-weight:800;color:#ffd83a;">找到了！</h2>
      <p style="color:#8a8a92;font-size:13px;margin:0 0 18px;" id="ftg-result-tankname">—</p>

      <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:16px 32px;margin-bottom:22px;">
        <div style="font-size:11px;color:#8a8a92;letter-spacing:0.15em;margin-bottom:4px;">用时</div>
        <div id="ftg-result-time" style="font-size:36px;font-weight:800;font-family:ui-monospace,monospace;color:#ffd83a;">0.00s</div>
      </div>

      <div style="display:flex;gap:10px;margin-bottom:24px;flex-wrap:wrap;justify-content:center;">
        <button id="ftg-btn-next" style="padding:12px 32px;border-radius:999px;border:none;background:linear-gradient(135deg,#ffd83a,#c9a860);color:#1a1611;font-family:inherit;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 6px 20px rgba(255,216,58,0.3);">下一关 →</button>
        <button id="ftg-btn-result-quit" style="padding:12px 32px;border-radius:999px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.05);color:#e8e8ea;font-family:inherit;font-size:15px;cursor:pointer;">退出游戏</button>
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
  panel.querySelector('#ftg-btn-next').addEventListener('click', () => {
    GameState.level++;
    beginLevel(true);
  });
  panel.querySelector('#ftg-btn-result-quit').addEventListener('click', closeFindTankGame);

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

/* ==================== 2. 入口 ==================== */
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
  if (GameState.scene) clearScene();
}

function closeFindTankGame() {
  if (!GameState.panel) return;
  GameState.panel.style.display = 'none';
  document.body.style.overflow = '';
  stopGameLoop();
  GameState.phase = 'menu';
  if (typeof playSound === 'function') playSound('close');
}

/* ==================== 3. 开始关卡 ==================== */
async function beginLevel(isNext) {
  if (GameState.starting) return;
  GameState.starting = true;

  const p = GameState.panel;
  const statusEl = p.querySelector('#ftg-menu-status');

  try {
    if (!window.THREE) {
      statusEl.textContent = '正在加载 3D 引擎…';
      await ensureThreeLibs();
    }

    p.querySelector('#ftg-menu').style.display = 'none';
    p.querySelector('#ftg-result').style.display = 'none';
    p.querySelector('#ftg-hud').style.display = 'flex';
    p.querySelector('#ftg-error').style.display = 'none';

    await _nextFrame();

    GameState.phase = 'playing';
    GameState.locked = false;
    GameState.elapsed = 0;
    GameState.winState = null;
    GameState.winSprite = null;
    GameState.startTime = performance.now();

    if (!isNext) GameState.level = 1;

    initThreeScene();
    generateMap();
    spawnTank();
    startGameLoop();

    p.querySelector('#ftg-level').textContent = GameState.level;
    p.querySelector('#ftg-timer').textContent = '0.0';
  } catch (err) {
    console.error('[find-tank] 启动失败:', err);
    const errEl = p.querySelector('#ftg-error');
    errEl.textContent = '⚠ 游戏启动失败\n\n' + (err && err.message ? err.message : String(err));
    errEl.style.display = 'flex';
  } finally {
    GameState.starting = false;
  }
}

/* ==================== 4. Three.js 场景 ==================== */
function initThreeScene() {
  const wrap = document.getElementById('game-canvas-wrap');
  if (!wrap) throw new Error('缺少画布容器');

  if (!GameState.renderer) {
    GameState.scene = new THREE.Scene();
    GameState.scene.background = new THREE.Color(0x87ceeb);

    GameState.camera = new THREE.PerspectiveCamera(58, 1, 0.5, 1200);
    GameState.camera.position.set(0, 95, 130);

    GameState.renderer = new THREE.WebGLRenderer({ antialias: true });
    GameState.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    GameState.renderer.shadowMap.enabled = true;
    GameState.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    wrap.appendChild(GameState.renderer.domElement);

    if (THREE.OrbitControls) {
      GameState.controls = new THREE.OrbitControls(GameState.camera, GameState.renderer.domElement);
      GameState.controls.enableDamping = true;
      GameState.controls.dampingFactor = 0.08;
      GameState.controls.maxPolarAngle = Math.PI / 2 - 0.02;
      GameState.controls.minDistance = 25;
      GameState.controls.maxDistance = 380;
      GameState.controls.target.set(0, 0, 0);
      GameState.controls.update();
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
    const d = 200;
    GameState.dirLight.shadow.camera.left = -d;
    GameState.dirLight.shadow.camera.right = d;
    GameState.dirLight.shadow.camera.top = d;
    GameState.dirLight.shadow.camera.bottom = -d;
    GameState.dirLight.shadow.camera.near = 1;
    GameState.dirLight.shadow.camera.far = 600;
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

/* ==================== 5. 清场 ==================== */
function clearScene() {
  if (!GameState.scene) return;
  if (GameState.winSprite) {
    GameState.scene.remove(GameState.winSprite);
    GameState.winSprite = null;
  }
  GameState.objects.forEach(obj => {
    GameState.scene.remove(obj);
    if (obj.traverse) {
      obj.traverse(c => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) {
          const mats = Array.isArray(c.material) ? c.material : [c.material];
          mats.forEach(m => {
            // 不 dispose 缓存的纹理
            m.dispose();
          });
        }
      });
    }
  });
  GameState.objects = [];
  GameState.targetTank = null;
  GameState.winState = null;
  GameState.occupiedBoxes = [];

  if (GameState.particleObj) {
    GameState.scene.remove(GameState.particleObj);
    GameState.particleObj.geometry.dispose();
    GameState.particleObj.material.dispose();
    GameState.particleObj = null;
  }
  GameState.particleType = null;

  // 清理导弹尾迹
  if (GameState.missileTrail) {
    GameState.scene.remove(GameState.missileTrail);
    GameState.missileTrail.geometry.dispose();
    GameState.missileTrail.material.dispose();
    GameState.missileTrail = null;
  }
}

/* ==================== 6. 地形高度 ==================== */
function terrainHeight(x, z) {
  const a = GameState.terrainAmp;
  if (a <= 0.01) return 0;
  return (
    Math.sin(x * 0.018) * Math.cos(z * 0.018) * a +
    Math.sin(x * 0.045 + 1.3) * Math.cos(z * 0.038 + 0.6) * a * 0.55 +
    Math.sin(x * 0.09 + 2.1) * Math.cos(z * 0.1 + 1.9) * a * 0.28
  );
}

/* ==================== 7. 地面纹理 ==================== */
function makeGroundTexture(mapType, colorHex) {
  const key = `ground_${mapType}_${colorHex}_${GameState.currentTheme}`;
  if (GameState.texCache[key]) return GameState.texCache[key];

  const size = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');

  const baseColor = new THREE.Color(colorHex);
  ctx.fillStyle = '#' + baseColor.getHexString();
  ctx.fillRect(0, 0, size, size);

  // 柔和噪点（分两层）
  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() - 0.5) * 18;
    data[i] = Math.max(0, Math.min(255, data[i] + n));
    data[i+1] = Math.max(0, Math.min(255, data[i+1] + n));
    data[i+2] = Math.max(0, Math.min(255, data[i+2] + n));
  }
  ctx.putImageData(imgData, 0, 0);

  // 城市 / 工厂：画街道网格
  if (mapType === 'city' || mapType === 'factory') {
    const mapSize = GameState.terrainSize;
    const scale = size / mapSize;
    const period = GameState.streetPeriod;
    const sw = GameState.streetWidth;

    // 草地/泥土底色 → 沥青
    const asphalt = GameState.currentTheme === 'rain' ? '#1e2026'
                  : GameState.currentTheme === 'snow_night' ? '#3a3f4a'
                  : '#2a2c30';
    ctx.fillStyle = asphalt;

    // 垂直街道
    for (let wx = -mapSize/2 + period; wx < mapSize/2; wx += period) {
      const px = (wx + mapSize/2) * scale;
      const w = sw * scale;
      ctx.fillRect(px - w/2, 0, w, size);
    }
    // 水平街道
    for (let wz = -mapSize/2 + period; wz < mapSize/2; wz += period) {
      const pz = (wz + mapSize/2) * scale;
      const h = sw * scale;
      ctx.fillRect(0, pz - h/2, size, h);
    }

    // 人行道边框（略亮）
    ctx.strokeStyle = GameState.currentTheme === 'rain' ? '#3a3e46'
                    : GameState.currentTheme === 'snow_night' ? '#5a6070'
                    : '#44464c';
    ctx.lineWidth = Math.max(1, 2 * scale);
    for (let wx = -mapSize/2 + period; wx < mapSize/2; wx += period) {
      const px = (wx + mapSize/2) * scale;
      const w = sw * scale;
      ctx.strokeRect(px - w/2, 0, w, size);
    }
    for (let wz = -mapSize/2 + period; wz < mapSize/2; wz += period) {
      const pz = (wz + mapSize/2) * scale;
      const h = sw * scale;
      ctx.strokeRect(0, pz - h/2, size, h);
    }

    // 道路中线（虚线）
    ctx.strokeStyle = 'rgba(220, 200, 130, 0.28)';
    ctx.lineWidth = Math.max(1, 1.2 * scale);
    ctx.setLineDash([6 * scale, 8 * scale]);
    for (let wx = -mapSize/2 + period; wx < mapSize/2; wx += period) {
      const px = (wx + mapSize/2) * scale;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, size);
      ctx.stroke();
    }
    for (let wz = -mapSize/2 + period; wz < mapSize/2; wz += period) {
      const pz = (wz + mapSize/2) * scale;
      ctx.beginPath();
      ctx.moveTo(0, pz);
      ctx.lineTo(size, pz);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 4;
  GameState.texCache[key] = tex;
  return tex;
}

/* ==================== 8. 建筑纹理（更精细） ==================== */
function makeBuildingTexture(kind) {
  const theme = GameState.currentTheme;
  const key = `bld_${kind}_${theme}`;
  if (GameState.texCache[key]) return GameState.texCache[key];

  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');

  const isNight = theme === 'snow_night';
  const isRain = theme === 'rain';

  // 基础色（不同建筑风格）
  let baseCol;
  if (kind === 'office') {
    baseCol = isNight ? '#2a3040' : isRain ? '#3e444e' : '#586070';
  } else if (kind === 'residential') {
    baseCol = isNight ? '#3a3430' : isRain ? '#4a4440' : '#8a8078';
  } else if (kind === 'mall') {
    baseCol = isNight ? '#30303a' : isRain ? '#404048' : '#787a80';
  } else {
    baseCol = isNight ? '#2e2e38' : isRain ? '#3e3e44' : '#6c6c72';
  }

  ctx.fillStyle = baseCol;
  ctx.fillRect(0, 0, size, size);

  // 建筑表面细微纹理
  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() - 0.5) * 10;
    data[i] = Math.max(0, Math.min(255, data[i] + n));
    data[i+1] = Math.max(0, Math.min(255, data[i+1] + n));
    data[i+2] = Math.max(0, Math.min(255, data[i+2] + n));
  }
  ctx.putImageData(imgData, 0, 0);

  // 窗户
  if (kind === 'office') {
    // 写字楼：水平玻璃条带
    const floors = 12;
    const fh = size / floors;
    for (let i = 0; i < floors; i++) {
      const y = i * fh + 2;
      const h = fh - 5;
      // 玻璃底色
      const grad = ctx.createLinearGradient(0, y, 0, y + h);
      if (isNight) {
        grad.addColorStop(0, '#4a5568');
        grad.addColorStop(1, '#2a3040');
      } else if (isRain) {
        grad.addColorStop(0, '#5a6470');
        grad.addColorStop(1, '#3e444e');
      } else {
        grad.addColorStop(0, '#7a8898');
        grad.addColorStop(1, '#5a6474');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(6, y, size - 12, h);

      // 竖条窗框
      ctx.fillStyle = baseCol;
      for (let x = 6 + 22; x < size - 6; x += 24) {
        ctx.fillRect(x, y, 2, h);
      }

      // 夜晚亮灯
      if (isNight) {
        for (let x = 8; x < size - 8; x += 24) {
          if (Math.random() < 0.35) {
            const r = 240 + Math.floor(Math.random() * 15);
            const g = 190 + Math.floor(Math.random() * 40);
            const b = 100 + Math.floor(Math.random() * 60);
            ctx.fillStyle = `rgba(${r},${g},${b},0.85)`;
            ctx.fillRect(x, y, 20, h);
          }
        }
        // 每层水平分隔线
        ctx.fillStyle = 'rgba(20,24,32,0.6)';
        ctx.fillRect(0, y + h + 1, size, 2);
      }
    }
  } else if (kind === 'residential') {
    // 居民楼：小方格窗户
    const floors = 10;
    const cols = 6;
    const fh = size / floors;
    const cw = size / cols;
    for (let j = 0; j < floors; j++) {
      for (let i = 0; i < cols; i++) {
        const x = i * cw + 4;
        const y = j * fh + 4;
        const w = cw - 8;
        const h = fh - 8;

        let lit = false;
        if (isNight) lit = Math.random() < 0.45;
        else if (isRain) lit = Math.random() < 0.08;
        else lit = Math.random() < 0.12;

        if (lit) {
          const warm = isNight;
          const r = warm ? 250 : 200;
          const g = warm ? 200 + Math.floor(Math.random() * 40) : 210;
          const b = warm ? 120 + Math.floor(Math.random() * 60) : 220;
          ctx.fillStyle = `rgb(${r},${g},${b})`;
        } else {
          ctx.fillStyle = isNight ? 'rgba(20,25,35,0.92)' : 'rgba(55,60,70,0.7)';
        }
        ctx.fillRect(x, y, w, h);

        // 阳台横条
        if (Math.random() < 0.6) {
          ctx.fillStyle = 'rgba(0,0,0,0.18)';
          ctx.fillRect(x - 2, y + h - 3, w + 4, 3);
        }
      }
    }
  } else if (kind === 'mall') {
    // 商场：大面积玻璃幕墙 + 招牌
    const bandH = size * 0.55;
    const y0 = size * 0.25;

    // 玻璃幕墙
    const grad = ctx.createLinearGradient(0, y0, 0, y0 + bandH);
    if (isNight) {
      grad.addColorStop(0, '#5a6478');
      grad.addColorStop(1, '#3a4258');
    } else if (isRain) {
      grad.addColorStop(0, '#6a7280');
      grad.addColorStop(1, '#4a5058');
    } else {
      grad.addColorStop(0, '#8a96a4');
      grad.addColorStop(1, '#68727e');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(8, y0, size - 16, bandH);

    // 玻璃竖框
    ctx.fillStyle = baseCol;
    for (let x = 8; x < size - 8; x += 32) {
      ctx.fillRect(x, y0, 3, bandH);
    }
    // 玻璃横框
    ctx.fillRect(8, y0 + bandH / 2 - 2, size - 16, 4);

    // 夜晚内部暖光
    if (isNight) {
      for (let i = 0; i < 8; i++) {
        const x = 12 + Math.random() * (size - 40);
        const y = y0 + 8 + Math.random() * (bandH - 30);
        ctx.fillStyle = `rgba(255, 210, 120, ${0.3 + Math.random() * 0.4})`;
        ctx.fillRect(x, y, 16, 16);
      }
    }

    // 顶部招牌
    ctx.fillStyle = isNight ? '#1a1a22' : '#3a3a44';
    ctx.fillRect(0, 0, size, y0);

    // 招牌文字块（抽象色块）
    const brandCols = ['#e85a4a', '#f0b840', '#4a90e2', '#50c878'];
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = brandCols[i];
      ctx.globalAlpha = isNight ? 0.85 : 0.55;
      ctx.fillRect(20 + i * 55, y0 * 0.35, 40, y0 * 0.35);
    }
    ctx.globalAlpha = 1;
  } else {
    // 通用：简单方窗
    const floors = 8;
    const cols = 5;
    const fh = size / floors;
    const cw = size / cols;
    for (let j = 0; j < floors; j++) {
      for (let i = 0; i < cols; i++) {
        const x = i * cw + 6;
        const y = j * fh + 6;
        const w = cw - 12;
        const h = fh - 12;
        const lit = isNight && Math.random() < 0.4;
        if (lit) {
          ctx.fillStyle = 'rgba(250, 200, 130, 0.85)';
        } else {
          ctx.fillStyle = isNight ? 'rgba(20,25,35,0.9)' : 'rgba(50,55,65,0.65)';
        }
        ctx.fillRect(x, y, w, h);
      }
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 2;
  GameState.texCache[key] = tex;
  return tex;
}

/* ==================== 9. 生成地图 ==================== */
function generateMap() {
  if (!GameState.scene) return;
  clearScene();

  const maps = ['forest', 'city', 'factory', 'grassland'];
  const themes = ['summer', 'snow_night', 'rain'];
  GameState.currentMap = maps[Math.floor(Math.random() * maps.length)];
  GameState.currentTheme = themes[Math.floor(Math.random() * themes.length)];

  // 地形振幅
  GameState.terrainAmp = (GameState.currentMap === 'city' || GameState.currentMap === 'factory') ? 0.6 : 5.0;

  const mapNames = { forest: '森林', city: '城市', factory: '工厂', grassland: '草原' };
  const themeNames = { summer: '夏日', snow_night: '雪夜', rain: '阴雨' };
  const infoEl = document.getElementById('ftg-map-info');
  if (infoEl) infoEl.textContent = `${mapNames[GameState.currentMap]} · ${themeNames[GameState.currentTheme]}`;

  applySkyAndFog();

  // 地形
  const size = GameState.terrainSize;
  const geo = new THREE.PlaneGeometry(size, size, 60, 60);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i)));
  }
  geo.computeVertexNormals();

  let groundColor = 0x4a6a3a;
  if (GameState.currentMap === 'city' || GameState.currentMap === 'factory') groundColor = 0x5a5c60;
  if (GameState.currentTheme === 'snow_night') groundColor = 0xdfe4ee;
  else if (GameState.currentTheme === 'rain') groundColor = 0x3a4048;

  const groundTex = makeGroundTexture(GameState.currentMap, groundColor);
  const groundMat = new THREE.MeshStandardMaterial({
    map: groundTex,
    roughness: 0.98,
    metalness: 0.02,
  });
  const ground = new THREE.Mesh(geo, groundMat);
  ground.receiveShadow = true;
  GameState.scene.add(ground);
  GameState.objects.push(ground);

  // 建筑 / 树木
  if (GameState.currentMap === 'city') {
    generateCityGrid();
  } else if (GameState.currentMap === 'factory') {
    generateFactoryGrid();
  } else {
    generateTrees();
  }

  setupParticles();

  // 相机复位
  if (GameState.camera) {
    GameState.camera.position.set(0, 95, 130);
    if (GameState.controls) {
      GameState.controls.target.set(0, 0, 0);
      GameState.controls.update();
    }
  }
}

function applySkyAndFog() {
  const s = GameState.scene;
  const theme = GameState.currentTheme;
  if (theme === 'summer') {
    s.background = new THREE.Color(0x8fc8f0);
    s.fog = new THREE.Fog(0xb8d8ee, 220, 520);
    if (GameState.hemiLight) GameState.hemiLight.intensity = 0.7;
    if (GameState.ambientLight) GameState.ambientLight.intensity = 0.35;
    if (GameState.dirLight) {
      GameState.dirLight.intensity = 1.0;
      GameState.dirLight.color.setHex(0xfff3e0);
    }
  } else if (theme === 'snow_night') {
    s.background = new THREE.Color(0x0a0e1e);
    s.fog = new THREE.Fog(0x0a0e1e, 120, 400);
    if (GameState.hemiLight) GameState.hemiLight.intensity = 0.28;
    if (GameState.ambientLight) GameState.ambientLight.intensity = 0.15;
    if (GameState.dirLight) {
      GameState.dirLight.intensity = 0.35;
      GameState.dirLight.color.setHex(0x8faadd);
    }
  } else {
    s.background = new THREE.Color(0x39404d);
    s.fog = new THREE.Fog(0x4a5260, 100, 350);
    if (GameState.hemiLight) GameState.hemiLight.intensity = 0.45;
    if (GameState.ambientLight) GameState.ambientLight.intensity = 0.32;
    if (GameState.dirLight) {
      GameState.dirLight.intensity = 0.42;
      GameState.dirLight.color.setHex(0xbcc6d4);
    }
  }
}

/* ==================== 10. 树木散布（森林 / 草原） ==================== */
function generateTrees() {
  const size = GameState.terrainSize;
  const half = size / 2 - 15;
  const count = GameState.currentMap === 'forest' ? 320 : 140;

  for (let i = 0; i < count; i++) {
    const x = rand(-half, half);
    const z = rand(-half, half);
    if (Math.abs(x) < 8 && Math.abs(z) < 8) continue;
    addTree(x, z);
  }
}

function addTree(x, z) {
  const g = new THREE.Group();
  const y = terrainHeight(x, z);
  const theme = GameState.currentTheme;

  const trunkMat = new THREE.MeshStandardMaterial({
    color: theme === 'rain' ? 0x3a2a1a : 0x5a3a1a,
    roughness: 0.95
  });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 2.4, 6), trunkMat);
  trunk.position.y = 1.2;
  trunk.castShadow = true;
  g.add(trunk);

  let leafColor = 0x2a5a2a;
  if (theme === 'snow_night') leafColor = 0xdfe8f5;
  else if (theme === 'rain') leafColor = 0x1a3a1a;

  const leafMat = new THREE.MeshStandardMaterial({ color: leafColor, roughness: 0.9 });
  const sizes = [
    { y: 3.2, r: 1.7, h: 2.4 },
    { y: 4.4, r: 1.35, h: 2.0 },
    { y: 5.4, r: 0.9, h: 1.6 },
  ];
  for (const s of sizes) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(s.r, s.h, 7), leafMat);
    leaf.position.y = s.y;
    leaf.castShadow = true;
    g.add(leaf);
  }

  g.position.set(x, y, z);
  g.scale.setScalar(rand(0.75, 1.45));
  g.rotation.y = Math.random() * Math.PI * 2;

  GameState.scene.add(g);
  GameState.objects.push(g);
}

/* ==================== 11. 城市网格 ==================== */
function generateCityGrid() {
  const size = GameState.terrainSize;
  const period = GameState.streetPeriod;
  const half = size / 2;
  const blockSize = period - GameState.streetWidth;

  // 街区中心
  for (let bx = -half + period; bx < half; bx += period) {
    for (let bz = -half + period; bz < half; bz += period) {
      const cx = bx + period / 2 - GameState.streetWidth / 2;
      const cz = bz + period / 2 - GameState.streetWidth / 2;

      // 中心留出空旷
      if (Math.abs(cx) < 30 && Math.abs(cz) < 30) continue;

      // 街区偶尔留空
      if (Math.random() < 0.12) continue;

      populateCityBlock(cx, cz, blockSize);
    }
  }
}

function populateCityBlock(cx, cz, blockSize) {
  const padding = 3;
  const avail = blockSize - padding * 2;

  const layout = Math.random();
  const rects = [];

  if (layout < 0.22) {
    // 单栋大楼
    const w = avail * rand(0.7, 0.95);
    const d = avail * rand(0.7, 0.95);
    rects.push({ x: cx, z: cz, w, d });
  } else if (layout < 0.55) {
    // 两栋并排
    const w = avail * 0.45;
    const d = avail * rand(0.7, 0.95);
    rects.push({ x: cx - avail * 0.25, z: cz, w, d });
    rects.push({ x: cx + avail * 0.25, z: cz, w, d });
  } else {
    // 2x2 四栋
    const cell = avail * 0.45;
    const off = avail * 0.25;
    rects.push({ x: cx - off, z: cz - off, w: cell, d: cell });
    rects.push({ x: cx + off, z: cz - off, w: cell, d: cell });
    rects.push({ x: cx - off, z: cz + off, w: cell, d: cell });
    rects.push({ x: cx + off, z: cz + off, w: cell, d: cell });
  }

  // 每个街区随机风格
  const styleRoll = Math.random();
  let style;
  if (styleRoll < 0.45) style = 'office';
  else if (styleRoll < 0.8) style = 'residential';
  else style = 'mall';

  for (const r of rects) {
    addCityBuilding(r.x, r.z, r.w, r.d, style);
  }
}

function addCityBuilding(x, z, w, d, style) {
  const y = terrainHeight(x, z);
  const isNight = GameState.currentTheme === 'snow_night';

  let h;
  if (style === 'office') h = rand(18, 55);
  else if (style === 'residential') h = rand(8, 20);
  else h = rand(6, 12);   // mall

  // 商圈内的商场更矮但更宽
  if (style === 'mall' && Math.random() < 0.3) {
    h = rand(8, 14);
  }

  const tex = makeBuildingTexture(style);
  // 根据尺寸调整 UV 重复（避免拉伸）
  const texW = tex.clone();
  texW.needsUpdate = true;
  const rH = Math.max(1, Math.round(h / 6));
  const rW = Math.max(1, Math.round(Math.max(w, d) / 6));
  texW.repeat.set(rW, rH);

  const mat = new THREE.MeshStandardMaterial({
    map: texW,
    emissiveMap: isNight ? texW : null,
    emissive: isNight ? 0xffffff : 0x000000,
    emissiveIntensity: isNight ? 0.55 : 0,
    roughness: 0.82,
    metalness: 0.08,
  });

  const group = new THREE.Group();

  // 形状变化
  const shapeRoll = Math.random();
  if (shapeRoll < 0.6) {
    // 简单长方体
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    b.position.y = h / 2;
    b.castShadow = true; b.receiveShadow = true;
    group.add(b);

    // 屋顶小箱
    if (Math.random() < 0.5) {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(w * 0.3, 1.5, d * 0.3), mat);
      cap.position.y = h + 0.75;
      cap.castShadow = true;
      group.add(cap);
    }
  } else if (shapeRoll < 0.82) {
    // 阶梯状
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.7, d), mat);
    b1.position.y = h * 0.35;
    b1.castShadow = true; b1.receiveShadow = true;
    group.add(b1);

    const w2 = w * 0.7, d2 = d * 0.7;
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(w2, h * 0.3, d2), mat);
    b2.position.y = h * 0.85;
    b2.castShadow = true; b2.receiveShadow = true;
    group.add(b2);
  } else {
    // L 形
    const w1 = w, d1 = d * 0.55;
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(w1, h, d1), mat);
    b1.position.set(0, h / 2, -d / 2 + d1 / 2);
    b1.castShadow = true; b1.receiveShadow = true;
    group.add(b1);

    const w2 = w * 0.55, d2 = d * 0.45;
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(w2, h * 0.8, d2), mat);
    b2.position.set(-w / 2 + w2 / 2, h * 0.4, d / 2 - d2 / 2);
    b2.castShadow = true; b2.receiveShadow = true;
    group.add(b2);
  }

  // 夜晚屋顶警示灯
  if (isNight && h > 20 && Math.random() < 0.5) {
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff3344 });
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 6), beaconMat);
    beacon.position.y = h + 1.2;
    group.add(beacon);
  }

  group.position.set(x, y, z);
  group.rotation.y = Math.random() < 0.15 ? Math.PI / 2 : 0;

  GameState.scene.add(group);
  GameState.objects.push(group);

  // 记录占位 AABB（用于坦克生成排除）
  const halfW = Math.max(w, d) / 2 + 3;
  GameState.occupiedBoxes.push({
    minX: x - halfW, maxX: x + halfW,
    minZ: z - halfW, maxZ: z + halfW,
  });
}

/* ==================== 12. 工厂网格 ==================== */
function generateFactoryGrid() {
  const size = GameState.terrainSize;
  const period = GameState.streetPeriod;
  const half = size / 2;
  const blockSize = period - GameState.streetWidth;

  for (let bx = -half + period; bx < half; bx += period) {
    for (let bz = -half + period; bz < half; bz += period) {
      const cx = bx + period / 2 - GameState.streetWidth / 2;
      const cz = bz + period / 2 - GameState.streetWidth / 2;

      if (Math.abs(cx) < 30 && Math.abs(cz) < 30) continue;
      if (Math.random() < 0.18) continue;

      // 一半概率工厂主体，一半烟囱
      if (Math.random() < 0.65) {
        const w = blockSize * rand(0.6, 0.95);
        const d = blockSize * rand(0.6, 0.95);
        addFactoryBuilding(cx, cz, w, d);
      } else {
        addChimney(cx, cz);
      }
    }
  }

  // 额外散布一些小烟囱
  for (let i = 0; i < 8; i++) {
    const x = rand(-half + 20, half - 20);
    const z = rand(-half + 20, half - 20);
    if (isPositionFree(x, z, 10)) addChimney(x, z);
  }
}

function addFactoryBuilding(x, z, w, d) {
  const y = terrainHeight(x, z);
  const h = rand(6, 12);

  const theme = GameState.currentTheme;
  let baseCol = theme === 'snow_night' ? 0x3a4050 : theme === 'rain' ? 0x35404a : 0x6d737a;
  const mat = new THREE.MeshStandardMaterial({ color: baseCol, roughness: 0.82, metalness: 0.18 });

  const group = new THREE.Group();

  // 主楼
  const main = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  main.position.y = h / 2;
  main.castShadow = true; main.receiveShadow = true;
  group.add(main);

  // 锯齿屋顶
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x8a8e94, roughness: 0.72, metalness: 0.28 });
  const toothW = 2.0;
  const teethCount = Math.max(2, Math.floor(w / 3));
  const actualToothW = w / teethCount;
  for (let i = 0; i < teethCount; i++) {
    const tooth = new THREE.Mesh(
      new THREE.BoxGeometry(actualToothW * 0.9, 1.6, d * 0.92),
      roofMat
    );
    tooth.position.set(-w / 2 + actualToothW / 2 + i * actualToothW, h + 0.8, 0);
    tooth.castShadow = true;
    group.add(tooth);
  }

  // 立面窗户
  if (theme === 'snow_night') {
    const winMat = new THREE.MeshBasicMaterial({ color: 0xffcc66 });
    const cols = Math.max(2, Math.floor(w / 3));
    for (let i = 0; i < cols; i++) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0), winMat);
      win.position.set(-w / 2 + 1.5 + i * (w / cols), h * 0.5, d / 2 + 0.02);
      group.add(win);
    }
  }

  group.position.set(x, y, z);
  group.rotation.y = Math.random() < 0.5 ? 0 : Math.PI / 2;
  GameState.scene.add(group);
  GameState.objects.push(group);

  const halfW = Math.max(w, d) / 2 + 3;
  GameState.occupiedBoxes.push({
    minX: x - halfW, maxX: x + halfW,
    minZ: z - halfW, maxZ: z + halfW,
  });
}

function addChimney(x, z) {
  const y = terrainHeight(x, z);
  const h = rand(14, 30);
  const r = rand(0.7, 1.2);

  const theme = GameState.currentTheme;
  const mat = new THREE.MeshStandardMaterial({
    color: theme === 'rain' ? 0x4a4a52 : 0x8a8a90,
    roughness: 0.85, metalness: 0.2
  });

  const group = new THREE.Group();

  const chimney = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.15, h, 12), mat);
  chimney.position.y = h / 2;
  chimney.castShadow = true;
  group.add(chimney);

  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 1.05, r * 1.05, 0.7, 12),
    new THREE.MeshStandardMaterial({ color: 0xc04040, roughness: 0.7 })
  );
  band.position.y = h - 1.5;
  group.add(band);

  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff2222 })
  );
  beacon.position.y = h + 0.5;
  group.add(beacon);

  group.position.set(x, y, z);
  GameState.scene.add(group);
  GameState.objects.push(group);

  GameState.occupiedBoxes.push({
    minX: x - r * 2, maxX: x + r * 2,
    minZ: z - r * 2, maxZ: z + r * 2,
  });
}

/* ==================== 13. 位置空闲检测 ==================== */
function isPositionFree(x, z, radius) {
  for (const b of GameState.occupiedBoxes) {
    if (x + radius > b.minX && x - radius < b.maxX &&
        z + radius > b.minZ && z - radius < b.maxZ) {
      return false;
    }
  }
  return true;
}

/* ==================== 14. 精细坦克模型 ==================== */
function createTankModel(type) {
  const group = new THREE.Group();

  const theme = GameState.currentTheme;
  let baseColor = 0x3f5a3a;
  if (theme === 'snow_night') baseColor = 0xd6d9e2;
  else if (theme === 'rain') baseColor = 0x33383f;

  const hullMat = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.78, metalness: 0.18 });
  const hullMatDark = new THREE.MeshStandardMaterial({ color: new THREE.Color(baseColor).multiplyScalar(0.75), roughness: 0.8, metalness: 0.15 });
  const trackMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.95 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.85, metalness: 0.3 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x2f3338, roughness: 0.55, metalness: 0.7 });

  function makeTrackAssembly() {
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

    const wheelGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.34, 12);
    for (let i = 0; i < 6; i++) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.x = Math.PI / 2;
      w.position.set(-1.35 + i * 0.54, 0, 0);
      t.add(w);
    }

    const driveGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.36, 10);
    const drive = new THREE.Mesh(driveGeo, wheelMat);
    drive.rotation.x = Math.PI / 2;
    drive.position.set(-1.55, 0.05, 0);
    t.add(drive);
    const idler = new THREE.Mesh(driveGeo, wheelMat);
    idler.rotation.x = Math.PI / 2;
    idler.position.set(1.55, 0.05, 0);
    t.add(idler);

    for (let i = 0; i < 10; i++) {
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.44), trackMat);
      tooth.position.set(-1.6 + i * 0.36, 0.4, 0);
      t.add(tooth);
    }
    return t;
  }

  const trackL = makeTrackAssembly();
  trackL.position.set(0, 0.35, 0.82);
  group.add(trackL);
  const trackR = makeTrackAssembly();
  trackR.position.set(0, 0.35, -0.82);
  group.add(trackR);

  const hullLower = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.5, 1.55), hullMat);
  hullLower.position.set(0, 0.6, 0);
  hullLower.castShadow = true; hullLower.receiveShadow = true;
  group.add(hullLower);

  const hullUpper = new THREE.Mesh(new THREE.BoxGeometry(2.95, 0.45, 1.35), hullMat);
  hullUpper.position.set(0, 1.05, 0);
  hullUpper.castShadow = true;
  group.add(hullUpper);

  const glacis = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 1.35), hullMatDark);
  glacis.rotation.z = -Math.PI / 4.5;
  glacis.position.set(1.35, 0.85, 0);
  glacis.castShadow = true;
  group.add(glacis);

  const fender = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 1.7), hullMatDark);
  fender.position.set(1.85, 1.28, 0);
  group.add(fender);

  const box = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.28, 0.35), hullMatDark);
  box.position.set(-1.0, 1.4, 0.45);
  box.castShadow = true;
  group.add(box);
  const box2 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4), hullMatDark);
  box2.position.set(-1.0, 1.36, -0.45);
  box2.castShadow = true;
  group.add(box2);

  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 8), metalMat);
  exhaust.rotation.z = Math.PI / 2;
  exhaust.position.set(-1.75, 1.15, 0.35);
  group.add(exhaust);
  const exhaust2 = exhaust.clone();
  exhaust2.position.z = -0.35;
  group.add(exhaust2);

  if (type === 'MBT') {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.78, 0.12, 16), hullMatDark);
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

    const mantlet = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.52, 0.85), hullMatDark);
    mantlet.position.set(1.38, 1.7, 0);
    group.add(mantlet);

    const barrelBase = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.5, 12), metalMat);
    barrelBase.rotation.z = -Math.PI / 2;
    barrelBase.position.set(1.7, 1.7, 0);
    group.add(barrelBase);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 2.4, 12), metalMat);
    barrel.rotation.z = -Math.PI / 2;
    barrel.position.set(3.15, 1.7, 0);
    barrel.castShadow = true;
    group.add(barrel);

    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.32, 12), metalMat);
    muzzle.rotation.z = -Math.PI / 2;
    muzzle.position.set(4.35, 1.7, 0);
    group.add(muzzle);

    const ringA = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 6, 14), metalMat);
    ringA.rotation.y = Math.PI / 2;
    ringA.position.set(4.42, 1.7, 0);
    group.add(ringA);
    const ringB = ringA.clone();
    ringB.position.x = 4.28;
    group.add(ringB);

    const cupola = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.24, 12), hullMat);
    cupola.position.set(-0.25, 2.1, 0.38);
    cupola.castShadow = true;
    group.add(cupola);

    const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.05, 12), hullMatDark);
    hatch.position.set(-0.25, 2.24, 0.38);
    group.add(hatch);

    const mgBase = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.08, 0.15), metalMat);
    mgBase.position.set(-0.25, 2.28, 0.38);
    group.add(mgBase);
    const mgBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 6), metalMat);
    mgBarrel.rotation.z = -Math.PI / 2;
    mgBarrel.position.set(0.1, 2.35, 0.38);
    group.add(mgBarrel);

    const side1 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.35, 0.08), hullMatDark);
    side1.position.set(0.3, 1.65, 0.68);
    group.add(side1);
    const side2 = side1.clone();
    side2.position.z = -0.68;
    group.add(side2);

    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.4, 4), metalMat);
    antenna.position.set(-0.65, 2.7, -0.4);
    group.add(antenna);

    const basket = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.3, 1.05), hullMatDark);
    basket.position.set(-0.55, 1.55, 0);
    basket.castShadow = true;
    group.add(basket);
  } else {
    const casemate = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.62, 1.3), hullMat);
    casemate.position.set(-0.1, 1.6, 0);
    casemate.castShadow = true;
    group.add(casemate);

    const casemateFront = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.65, 1.2), hullMatDark);
    casemateFront.rotation.z = -Math.PI / 5;
    casemateFront.position.set(0.85, 1.55, 0);
    casemateFront.castShadow = true;
    group.add(casemateFront);

    const casemateTop = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 1.2), hullMat);
    casemateTop.position.set(-0.1, 1.94, 0);
    group.add(casemateTop);

    const mantlet = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), hullMatDark);
    mantlet.position.set(1.15, 1.68, 0);
    mantlet.scale.set(0.7, 1, 1.05);
    group.add(mantlet);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 3.0, 12), metalMat);
    barrel.rotation.z = -Math.PI / 2;
    barrel.position.set(2.75, 1.68, 0);
    barrel.castShadow = true;
    group.add(barrel);

    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.3, 12), metalMat);
    muzzle.rotation.z = -Math.PI / 2;
    muzzle.position.set(4.35, 1.68, 0);
    group.add(muzzle);

    const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 12), hullMatDark);
    hatch.position.set(-0.55, 2.02, 0.35);
    group.add(hatch);

    const peri = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.16), metalMat);
    peri.position.set(0.4, 2.02, 0.42);
    group.add(peri);

    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.3, 4), metalMat);
    antenna.position.set(-0.9, 2.6, -0.45);
    group.add(antenna);
  }

  return group;
}

/* ==================== 15. 藏匿坦克（避让建筑） ==================== */
function spawnTank() {
  if (!GameState.scene) return;

  const types = ['MBT', 'TD'];
  GameState.targetType = pick(types);
  const tank = createTankModel(GameState.targetType);

  const half = GameState.terrainSize / 2 - 25;
  const TANK_RADIUS = 6;   // 坦克周围需要多大的空闲半径

  let x = 0, z = 0;
  let ok = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    // 距中心较远
    const angle = Math.random() * Math.PI * 2;
    const dist = rand(40, half);
    x = Math.cos(angle) * dist;
    z = Math.sin(angle) * dist;

    if (Math.abs(x) > half || Math.abs(z) > half) continue;
    if (isPositionFree(x, z, TANK_RADIUS)) {
      ok = true;
      break;
    }
  }

  // 兜底：如果全部失败，就扔到（0,0）附近
  if (!ok) {
    x = 0; z = 0;
  }

  const y = terrainHeight(x, z);
  tank.position.set(x, y, z);
  tank.rotation.y = Math.random() * Math.PI * 2;

  GameState.scene.add(tank);
  GameState.objects.push(tank);
  GameState.targetTank = tank;

  if (GameState.currentTheme === 'snow_night') {
    const spot = new THREE.SpotLight(0xfff0c0, 4, 60, Math.PI / 7, 0.55, 1.2);
    spot.position.set(1.4, 1.4, 0.35);
    const target = new THREE.Object3D();
    target.position.set(40, 0, 2);
    tank.add(target);
    spot.target = target;
    tank.add(spot);

    const spot2 = new THREE.SpotLight(0xfff0c0, 2.5, 50, Math.PI / 7, 0.55, 1.2);
    spot2.position.set(1.4, 1.4, -0.35);
    const target2 = new THREE.Object3D();
    target2.position.set(40, 0, -2);
    tank.add(target2);
    spot2.target = target2;
    tank.add(spot2);

    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });
    const lamp1 = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), lampMat);
    lamp1.position.set(1.55, 1.35, 0.35);
    tank.add(lamp1);
    const lamp2 = lamp1.clone();
    lamp2.position.z = -0.35;
    tank.add(lamp2);
  }
}

/* ==================== 16. 粒子 ==================== */
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
  c.width = 8; c.height = 32;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 32);
  g.addColorStop(0, 'rgba(200,220,255,0)');
  g.addColorStop(0.5, 'rgba(200,220,255,0.85)');
  g.addColorStop(1, 'rgba(200,220,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(2, 0, 4, 32);
  return new THREE.CanvasTexture(c);
}

function setupParticles() {
  const theme = GameState.currentTheme;
  if (theme === 'summer') return;

  const isRain = theme === 'rain';
  const count = isRain ? 8000 : 4000;
  const areaSize = GameState.terrainSize * 0.8;
  const topY = 120;

  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * areaSize;
    positions[i * 3 + 1] = Math.random() * topY;
    positions[i * 3 + 2] = (Math.random() - 0.5) * areaSize;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const tex = isRain ? makeRainTexture() : makeSnowTexture();
  const mat = new THREE.PointsMaterial({
    size: isRain ? 1.2 : 1.4,
    map: tex,
    transparent: true,
    opacity: isRain ? 0.55 : 0.95,
    depthWrite: false,
    sizeAttenuation: true,
  });

  const pts = new THREE.Points(geo, mat);
  pts.raycast = () => {};
  GameState.scene.add(pts);
  GameState.particleObj = pts;
  GameState.particleType = theme;
}

function updateParticles(dt) {
  const pts = GameState.particleObj;
  if (!pts) return;
  const arr = pts.geometry.attributes.position.array;
  const count = arr.length / 3;
  const isRain = GameState.particleType === 'rain';

  const fallSpeed = isRain ? 70 : 6;
  const drift = isRain ? 2.5 : 1.2;
  const topY = 120;

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    arr[i3 + 1] -= fallSpeed * dt;
    arr[i3] += Math.sin((arr[i3 + 1] + i) * 0.35) * drift * dt;

    if (arr[i3 + 1] < 0) {
      arr[i3 + 1] = topY;
      arr[i3] = (Math.random() - 0.5) * GameState.terrainSize * 0.8;
      arr[i3 + 2] = (Math.random() - 0.5) * GameState.terrainSize * 0.8;
    }
  }
  pts.geometry.attributes.position.needsUpdate = true;
}

/* ==================== 17. 点击 → 遮挡判定 ==================== */
function handleCanvasClick(clientX, clientY) {
  if (GameState.phase !== 'playing' || GameState.locked) return;
  if (!GameState.targetTank) return;

  const rect = GameState.renderer.domElement.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((clientY - rect.top) / rect.height) * 2 + 1;

  GameState.pointer.set(x, y);
  GameState.raycaster.setFromCamera(GameState.pointer, GameState.camera);

  const tankMeshes = [];
  GameState.targetTank.traverse(o => { if (o.isMesh) tankMeshes.push(o); });

  const tankHits = GameState.raycaster.intersectObjects(tankMeshes, false);
  if (tankHits.length === 0) return;

  const allHits = GameState.raycaster.intersectObjects(GameState.scene.children, true);
  for (const hit of allHits) {
    const obj = hit.object;
    if (obj.isPoints || obj.isSprite) continue;

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

/* ==================== 18. 胜利 + 导弹 ==================== */
function triggerWin() {
  if (GameState.locked) return;
  GameState.locked = true;
  GameState.phase = 'won';

  const elapsed = (performance.now() - GameState.startTime) / 1000;
  GameState.elapsed = elapsed;

  if (typeof playSound === 'function') playSound('fav');

  // 1. "!" 精灵
  const sprite = makeExclamationSprite();
  const tankPos = GameState.targetTank.position.clone();
  sprite.position.set(tankPos.x, tankPos.y + 7, tankPos.z);
  GameState.scene.add(sprite);
  GameState.winSprite = sprite;

  // 2. 计算冲出方向（朝最近的地图边缘）
  const half = GameState.terrainSize / 2;
  const p = GameState.targetTank.position;
  const distToEdge = {
    px: half - p.x,
    nx: half + p.x,
    pz: half - p.z,
    nz: half + p.z,
  };
  let dirX = 0, dirZ = 0;
  const minKey = Object.keys(distToEdge).reduce((a, b) => distToEdge[a] < distToEdge[b] ? a : b);
  if (minKey === 'px') dirX = 1;
  else if (minKey === 'nx') dirX = -1;
  else if (minKey === 'pz') dirZ = 1;
  else dirZ = -1;

  GameState.winState = {
    phase: 'alert',       // alert → missile → escape
    t: 0,
    escapeT: 0,
    sprite,
    tank: GameState.targetTank,
    dir: new THREE.Vector3(dirX, 0, dirZ).normalize(),
    baseY: tankPos.y,
    missile: null,
    missileVel: null,
    missileTarget: new THREE.Vector3(),
    missileActive: false,
  };
}

function makeExclamationSprite() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
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
  const mat = new THREE.SpriteMaterial({
    map: tex,
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(4, 8, 1);
  sprite.renderOrder = 999;
  return sprite;
}

/* ---------- 导弹 ---------- */
function createMissileModel() {
  const g = new THREE.Group();

  // 弹体（细长圆柱）
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 2.6, 10),
    new THREE.MeshStandardMaterial({ color: 0x8a8a92, roughness: 0.5, metalness: 0.6 })
  );
  body.rotation.z = -Math.PI / 2;   // 朝向 +X
  g.add(body);

  // 鼻锥
  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 0.7, 10),
    new THREE.MeshStandardMaterial({ color: 0xcc4444, roughness: 0.4, metalness: 0.5 })
  );
  nose.rotation.z = -Math.PI / 2;
  nose.position.x = 1.65;
  g.add(nose);

  // 尾翼（3 片）
  const finMat = new THREE.MeshStandardMaterial({ color: 0x4a4a52, roughness: 0.6, metalness: 0.4 });
  for (let i = 0; i < 3; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.75, 0.06), finMat);
    fin.position.x = -1.1;
    fin.rotation.x = (i / 3) * Math.PI * 2;
    // 需要绕 X 轴偏移，让翼片贴在弹体周围
    const r = 0.22;
    fin.position.y = Math.cos((i / 3) * Math.PI * 2) * r;
    fin.position.z = Math.sin((i / 3) * Math.PI * 2) * r;
    // 让翼片长边朝外
    fin.rotation.z = 0;
    fin.rotation.x = 0;
    fin.rotation.y = (i / 3) * Math.PI * 2;
    g.add(fin);
  }

  // 尾焰发光（球体 + 加色混合）
  const flame = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 10, 10),
    new THREE.MeshBasicMaterial({
      color: 0xffaa33,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  flame.position.x = -1.55;
  flame.name = 'flame';
  g.add(flame);

  // 内焰（亮黄）
  const flameInner = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 10, 10),
    new THREE.MeshBasicMaterial({
      color: 0xffffcc,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
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

  // 从相机后方较远处生成
  const awayDir = camPos.clone().sub(tankPos).normalize();
  const spawnPos = camPos.clone().add(awayDir.multiplyScalar(150));
  spawnPos.y += 45;
  // 横向偏移，制造更有戏剧性的入场
  spawnPos.x += (Math.random() - 0.5) * 60;
  spawnPos.z += (Math.random() - 0.5) * 60;

  const missile = createMissileModel();
  missile.position.copy(spawnPos);

  // 初始朝向坦克
  const toTank = tankPos.clone().sub(spawnPos).normalize();
  missile.rotation.y = Math.atan2(-toTank.z, toTank.x);
  missile.rotation.z = 0;

  GameState.scene.add(missile);

  // 速度
  const SPEED = 70;
  const vel = toTank.multiplyScalar(SPEED);

  w.missile = missile;
  w.missileVel = vel;
  w.missileActive = true;

  // 创建尾迹
  setupMissileTrail();

  if (typeof playSound === 'function') playSound('open');
}

/* ---------- 尾迹 ---------- */
const MISSILE_TRAIL_MAX = 90;

function setupMissileTrail() {
  if (GameState.missileTrail) {
    GameState.scene.remove(GameState.missileTrail);
    GameState.missileTrail.geometry.dispose();
    GameState.missileTrail.material.dispose();
  }

  const positions = new Float32Array(MISSILE_TRAIL_MAX * 3);
  // 全部放在地下，避免初始可见
  for (let i = 0; i < MISSILE_TRAIL_MAX; i++) {
    positions[i * 3 + 1] = -9999;
  }

  const colors = new Float32Array(MISSILE_TRAIL_MAX * 3);
  for (let i = 0; i < MISSILE_TRAIL_MAX; i++) {
    const t = i / MISSILE_TRAIL_MAX;
    // 最新 → 亮黄，最旧 → 暗红
    const r = 1.0 - t * 0.6;
    const gg = 0.85 - t * 0.75;
    const b = 0.35 - t * 0.3;
    colors[i * 3] = Math.max(0, r);
    colors[i * 3 + 1] = Math.max(0, gg);
    colors[i * 3 + 2] = Math.max(0, b);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 2.2,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
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
  // 头插法：最新位置在最前
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

/* ---------- 导弹更新 ---------- */
function updateMissile(dt) {
  const w = GameState.winState;
  if (!w || !w.missile || !w.missileActive) return;

  const missile = w.missile;
  const tank = w.tank;

  // 目标点：坦克上方一点
  const targetPos = tank.position.clone();
  targetPos.y += 1.5;

  const toTarget = targetPos.clone().sub(missile.position);
  const dist = toTarget.length();

  // 转向
  const desiredDir = toTarget.clone().normalize();
  const desiredVel = desiredDir.clone().multiplyScalar(w.missileVel.length());

  // 转向速率
  const turnRate = 3.5;
  w.missileVel.lerp(desiredVel, Math.min(1, turnRate * dt));

  // 距离越近速度越慢（戏剧效果，永不真正击中）
  let speedMul = 1;
  if (dist < 30) speedMul = 0.65;
  if (dist < 15) speedMul = 0.4;

  missile.position.addScaledVector(w.missileVel, dt * speedMul);

  // 朝向
  const v = w.missileVel.clone().normalize();
  const targetRot = Math.atan2(-v.z, v.x);
  let diff = targetRot - missile.rotation.y;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  missile.rotation.y += diff * Math.min(1, dt * 8);

  // 尾焰脉动
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

  // 更新尾迹
  updateMissileTrail();
}

/* ---------- 胜利动画主循环 ---------- */
function updateWinAnimation(dt) {
  const w = GameState.winState;
  if (!w) return;
  w.t += dt;

  // === 阶段 1：alert ===
  if (w.phase === 'alert') {
    if (w.sprite) {
      const pulse = 1 + Math.sin(w.t * 10) * 0.15;
      w.sprite.scale.set(4 * pulse, 8 * pulse, 1);
      w.sprite.position.y = w.baseY + 7 + Math.sin(w.t * 6) * 0.5;
    }
    if (w.t > 0.6) {
      w.phase = 'missile';
      w.t = 0;
      spawnMissile();
    }
    return;
  }

  // === 阶段 2：missile ===
  if (w.phase === 'missile') {
    if (w.sprite) {
      const pulse = 1 + Math.sin(w.t * 10) * 0.15;
      w.sprite.scale.set(4 * pulse, 8 * pulse, 1);
      w.sprite.position.y = w.baseY + 7 + Math.sin(w.t * 6) * 0.5;
    }

    updateMissile(dt);

    if (w.missile) {
      const dist = w.missile.position.distanceTo(w.tank.position);
      if (dist < 45) {
        w.phase = 'escape';
        w.escapeT = 0;
        // 让导弹减速，制造“永远差一点”的感觉
        if (w.missileVel) {
          w.missileVel.setLength(Math.max(30, w.missileVel.length() * 0.7));
        }
      }
    }
    return;
  }

  // === 阶段 3：escape ===
  if (w.phase === 'escape') {
    w.escapeT += dt;

    // 坦克朝边缘冲刺
    const SPEED = 55;
    w.tank.position.x += w.dir.x * SPEED * dt;
    w.tank.position.z += w.dir.z * SPEED * dt;
    w.tank.position.y = terrainHeight(w.tank.position.x, w.tank.position.z);

    // 坦克朝向运动方向
    const targetRot = Math.atan2(-w.dir.z, w.dir.x);
    let diff = targetRot - w.tank.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    w.tank.rotation.y += diff * Math.min(1, dt * 6);

    // 导弹继续追
    updateMissile(dt);

    // 检查是否跑出地图
    const out = GameState.terrainSize / 2 + 30;
    if (Math.abs(w.tank.position.x) > out || Math.abs(w.tank.position.z) > out) {
      // 清掉导弹和尾迹
      if (w.missile) {
        GameState.scene.remove(w.missile);
        w.missile = null;
      }
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
      GameState.winState = null;
      showResult();
    }
  }
}

/* ==================== 19. 结算 ==================== */
function showResult() {
  const p = GameState.panel;
  p.querySelector('#ftg-result').style.display = 'flex';
  p.querySelector('#ftg-result-time').textContent = GameState.elapsed.toFixed(2) + 's';

  const nameEl = p.querySelector('#ftg-result-tankname');
  nameEl.textContent = GameState.targetType === 'MBT'
    ? '你找到了一辆主战坦克'
    : '你找到了一辆坦克歼击车';

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
      if (typeof showTankDetail === 'function') {
        setTimeout(() => showTankDetail(tk), 120);
      }
    };
    cardEl.onmouseenter = () => { cardEl.style.background = 'rgba(255,255,255,0.09)'; cardEl.style.borderColor = 'rgba(255,216,58,0.4)'; };
    cardEl.onmouseleave = () => { cardEl.style.background = 'rgba(255,255,255,0.05)'; cardEl.style.borderColor = 'rgba(255,255,255,0.1)'; };
  } else {
    cardEl.style.display = 'none';
  }

  if (typeof playSound === 'function') playSound('open');
}

/* ==================== 20. 主循环 ==================== */
function startGameLoop() {
  if (GameState.animId) return;
  if (!GameState.clock) GameState.clock = new THREE.Clock();
  GameState.clock.getDelta();

  const loop = () => {
    GameState.animId = requestAnimationFrame(loop);
    const dt = Math.min(0.05, GameState.clock.getDelta());

    if (GameState.controls) GameState.controls.update();

    if (GameState.phase === 'playing' && !GameState.locked) {
      GameState.elapsed = (performance.now() - GameState.startTime) / 1000;
      const t = document.getElementById('ftg-timer');
      if (t) t.textContent = GameState.elapsed.toFixed(1);
    }

    updateParticles(dt);

    if (GameState.winState) updateWinAnimation(dt);

    if (GameState.renderer && GameState.scene && GameState.camera) {
      GameState.renderer.render(GameState.scene, GameState.camera);
    }
  };
  GameState.animId = requestAnimationFrame(loop);
}

function stopGameLoop() {
  if (GameState.animId) {
    cancelAnimationFrame(GameState.animId);
    GameState.animId = null;
  }
}

/* ==================== 21. ESC ==================== */
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!GameState.panel || GameState.panel.style.display === 'none') return;
  if (GameState.phase === 'menu') { closeFindTankGame(); return; }
  if (GameState.phase === 'playing') { closeFindTankGame(); return; }
  if (GameState.phase === 'won') {
    GameState.level++;
    beginLevel(true);
  }
});

/* ==================== 导出 ==================== */
window.startFindTankGame = startFindTankGame;
window.closeFindTankGame = closeFindTankGame;