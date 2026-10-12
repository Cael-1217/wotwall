// ==================== find-tank-game.js — 寻找坦克 3D v4 ====================

/* ============ 全局状态 ============ */
const GameState = {
  scene: null, camera: null, renderer: null, controls: null,
  animId: null, clock: null,
  currentTheme: 'summer',
  currentMap: 'nature',      // nature | city | factory | challenge
  targetTank: null,
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

  terrainAmp: 4,
  terrainSize: 400,
  terrainFeatures: [],

  occupiedBoxes: [],
  treePositions: [],
  warehouseZones: [],
  texCache: {},

  challenge: false,
  challengeTimeLeft: 90,
  challengeFound: 0,
  challengeTotal: 0,
  challengeTanks: [],

  missileTrail: null,
  missileTrailHistory: [],
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
    catch (e) { console.warn('[find-tank] OrbitControls 未加载'); }
  }
}
function getCardInfoSafe(t) {
  try { return (typeof getCardInfoText === 'function') ? getCardInfoText(t) : ''; }
  catch { return ''; }
}
function esc(s) { return (typeof escapeHtml === 'function') ? escapeHtml(s) : String(s); }
function rand(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

/* ============ 1. 面板 ============ */
function initFindTankGame() {
  if (GameState.panel) return GameState.panel;
  const panel = document.createElement('div');
  panel.id = 'find-tank-panel';
  panel.style.cssText = 'position:fixed;inset:0;z-index:400;background:#0b0b0e;display:none;flex-direction:column;overflow:hidden;';
  panel.innerHTML = `
    <div id="ftg-hud" style="display:none;padding:8px 14px;padding-top:calc(8px + env(safe-area-inset-top));background:linear-gradient(to bottom,rgba(10,10,14,0.96),rgba(10,10,14,0.72));color:#fff;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-shrink:0;z-index:5;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.08);backdrop-filter:blur(8px);">
      <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;">
        <span id="ftg-level-wrap">🎯 <b id="ftg-level" style="color:#ffd83a;">1</b></span>
        <span id="ftg-timer-wrap">⏱ <b id="ftg-timer">0.0</b>s</span>
        <span id="ftg-found-wrap" style="display:none;">🏆 <b id="ftg-found" style="color:#ffd83a;">0</b> / <b id="ftg-total">0</b></span>
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
      <p style="color:#8a8a92;font-size:13px;margin:12px 0 24px;line-height:1.7;max-width:340px;">
        在地图中找到藏匿的坦克<br>只要视野无遮挡，点击它即可获胜
      </p>
      <button id="ftg-btn-start" style="padding:14px 56px;border-radius:999px;border:none;background:linear-gradient(135deg,#ffd83a,#c9a860);color:#1a1611;font-family:inherit;font-size:16px;font-weight:700;letter-spacing:0.05em;cursor:pointer;box-shadow:0 8px 28px rgba(255,216,58,0.35);margin-bottom:12px;min-width:220px;">经典模式</button>
      <button id="ftg-btn-challenge" style="padding:14px 56px;border-radius:999px;border:1px solid rgba(255,216,58,0.5);background:rgba(255,216,58,0.08);color:#ffd83a;font-family:inherit;font-size:16px;font-weight:700;letter-spacing:0.05em;cursor:pointer;margin-bottom:12px;min-width:220px;">🔥 挑战模式 · 90s</button>
      <button id="ftg-btn-menu-quit" style="padding:12px 40px;border-radius:999px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.04);color:#8a8a92;font-family:inherit;font-size:14px;cursor:pointer;">退出</button>
      <div id="ftg-menu-status" style="color:#8a8a92;font-size:12px;margin-top:20px;height:16px;"></div>
    </div>
    <div id="ftg-result" style="position:absolute;inset:0;z-index:20;display:none;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 40%, rgba(28,32,40,0.97), rgba(11,11,14,0.99));color:#fff;padding:24px;text-align:center;overflow-y:auto;">
      <div style="font-size:44px;margin-bottom:6px;" id="ftg-result-emoji">🎉</div>
      <h2 style="margin:0 0 6px;font-size:26px;font-weight:800;color:#ffd83a;" id="ftg-result-title">找到了！</h2>
      <p style="color:#8a8a92;font-size:13px;margin:0 0 18px;" id="ftg-result-tankname">—</p>
      <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:16px 32px;margin-bottom:22px;">
        <div style="font-size:11px;color:#8a8a92;letter-spacing:0.15em;margin-bottom:4px;" id="ftg-result-label">用时</div>
        <div id="ftg-result-time" style="font-size:36px;font-weight:800;font-family:ui-monospace,monospace;color:#ffd83a;">0.00s</div>
      </div>
      <div style="display:flex;gap:10px;margin-bottom:24px;flex-wrap:wrap;justify-content:center;">
        <button id="ftg-btn-next" style="padding:12px 32px;border-radius:999px;border:none;background:linear-gradient(135deg,#ffd83a,#c9a860);color:#1a1611;font-family:inherit;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 6px 20px rgba(255,216,58,0.3);">下一关 →</button>
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
  panel.querySelector('#ftg-btn-start').addEventListener('click', () => beginLevel(false, false));
  panel.querySelector('#ftg-btn-challenge').addEventListener('click', () => beginLevel(false, true));
  panel.querySelector('#ftg-btn-next').addEventListener('click', () => {
    if (GameState.challenge) { beginLevel(true, true); }
    else { GameState.level++; beginLevel(true, false); }
  });
  panel.querySelector('#ftg-btn-result-quit').addEventListener('click', () => {
    showMenu();
  });

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

/* ============ 3. 开始关卡 ============ */
async function beginLevel(isNext, isChallenge) {
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
    GameState.challenge = !!isChallenge;
    GameState.challengeTimeLeft = 90;
    GameState.challengeFound = 0;
    GameState.challengeTanks = [];

    if (!isNext && !isChallenge) GameState.level = 1;

    // HUD 切换
    p.querySelector('#ftg-level-wrap').style.display = isChallenge ? 'none' : 'inline';
    p.querySelector('#ftg-found-wrap').style.display = isChallenge ? 'inline' : 'none';

    initThreeScene();
    generateMap();
    if (isChallenge) spawnChallengeTanks();
    else spawnTank();
    startGameLoop();

    if (!isChallenge) {
      p.querySelector('#ftg-level').textContent = GameState.level;
    }
    p.querySelector('#ftg-timer').textContent = isChallenge ? '90.0' : '0.0';
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
    const d = 220;
    GameState.dirLight.shadow.camera.left = -d;
    GameState.dirLight.shadow.camera.right = d;
    GameState.dirLight.shadow.camera.top = d;
    GameState.dirLight.shadow.camera.bottom = -d;
    GameState.dirLight.shadow.camera.near = 1;
    GameState.dirLight.shadow.camera.far = 700;
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

/* ============ 5. 清场 ============ */
function clearScene() {
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
          mats.forEach(m => m.dispose());
        }
      });
    }
  });
  GameState.objects = [];
  GameState.targetTank = null;
  GameState.winState = null;
  GameState.occupiedBoxes = [];
  GameState.treePositions = [];
  GameState.warehouseZones = [];
  GameState.terrainFeatures = [];
  GameState.challengeTanks = [];

  if (GameState.particleObj) {
    GameState.scene.remove(GameState.particleObj);
    GameState.particleObj.geometry.dispose();
    GameState.particleObj.material.dispose();
    GameState.particleObj = null;
  }
  GameState.particleType = null;
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
  // 山地叠加
  for (const f of GameState.terrainFeatures) {
    if (f.type === 'mountain') {
      const dx = x - f.x, dz = z - f.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < f.r) {
        const t = 1 - d / f.r;
        h += t * t * (3 - 2 * t) * f.height;   // smoothstep 隆起
      }
    } else if (f.type === 'lake') {
      const dx = x - f.x, dz = z - f.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < f.r) {
        const t = 1 - d / f.r;
        h -= t * t * (3 - 2 * t) * f.depth;
      }
    } else if (f.type === 'river') {
      const rx = f.x0 + Math.sin((z - f.z0) * f.freq) * f.amp;
      const d = Math.abs(x - rx);
      if (d < f.w) {
        const t = 1 - d / f.w;
        h -= t * t * f.depth;
      }
    }
  }
  return h;
}

/* ============ 7. 纹理 ============ */
function worldToTex(wx, wz, texSize) {
  const size = GameState.terrainSize;
  return {
    x: (wx + size / 2) / size * texSize,
    y: (wz + size / 2) / size * texSize,
  };
}

function makeGroundTexture(kind, baseColor) {
  const theme = GameState.currentTheme;
  const key = `gnd_${kind}_${baseColor}_${theme}`;
  if (GameState.texCache[key]) return GameState.texCache[key];

  const TS = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = TS;
  const ctx = c.getContext('2d');

  const base = new THREE.Color(baseColor);
  ctx.fillStyle = '#' + base.getHexString();
  ctx.fillRect(0, 0, TS, TS);

  // 底层噪声
  const img = ctx.getImageData(0, 0, TS, TS);
  const data = img.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() - 0.5) * 22;
    data[i] = Math.max(0, Math.min(255, data[i] + n));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);

  const size = GameState.terrainSize;

  if (kind === 'nature') {
    // 草地色斑
    for (let i = 0; i < 260; i++) {
      const x = Math.random() * TS, y = Math.random() * TS;
      const r = 20 + Math.random() * 70;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const isLight = Math.random() < 0.5;
      g.addColorStop(0, isLight ? 'rgba(120,160,80,0.35)' : 'rgba(60,100,50,0.35)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // 湖泊
    for (const f of GameState.terrainFeatures) {
      if (f.type === 'lake') {
        const p = worldToTex(f.x, f.z, TS);
        const rTex = f.r / size * TS;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rTex);
        g.addColorStop(0, 'rgba(40,80,120,0.95)');
        g.addColorStop(0.7, 'rgba(60,110,150,0.85)');
        g.addColorStop(1, 'rgba(90,130,90,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, rTex, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // 河流
    for (const f of GameState.terrainFeatures) {
      if (f.type !== 'river') continue;
      ctx.strokeStyle = 'rgba(60,110,150,0.9)';
      ctx.lineWidth = (f.w * 2) / size * TS;
      ctx.lineCap = 'round';
      ctx.beginPath();
      let first = true;
      const zMin = -size / 2, zMax = size / 2;
      const steps = 60;
      for (let s = 0; s <= steps; s++) {
        const wz = zMin + (zMax - zMin) * s / steps;
        const wx = f.x0 + Math.sin((wz - f.z0) * f.freq) * f.amp;
        const p = worldToTex(wx, wz, TS);
        if (first) { ctx.moveTo(p.x, p.y); first = false; }
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
  } else if (kind === 'city') {
    // 城市：沥青 + 随机街区
    const asphalt = theme === 'snow_night' ? '#242832' : theme === 'rain' ? '#1a1d24' : '#2c2e33';
    ctx.fillStyle = asphalt;
    ctx.fillRect(0, 0, TS, TS);

    // 用不规则的街区划分
    const grid = GameState.cityGrid;
    if (grid) {
      for (let i = 0; i < grid.xEdges.length - 1; i++) {
        for (let j = 0; j < grid.zEdges.length - 1; j++) {
          const x0 = grid.xEdges[i], x1 = grid.xEdges[i + 1];
          const z0 = grid.zEdges[j], z1 = grid.zEdges[j + 1];
          const sw = GameState.streetWidth;
          const px0 = worldToTex(x0 + sw / 2, z0 + sw / 2, TS);
          const px1 = worldToTex(x1 - sw / 2, z1 - sw / 2, TS);

          // 街区底色（人行道浅色）
          ctx.fillStyle = theme === 'snow_night' ? '#42495a'
                        : theme === 'rain' ? '#3a3e46' : '#484b52';
          ctx.fillRect(px0.x, px0.y, px1.x - px0.x, px1.y - px0.y);

          // 内部填充（草地 / 铺装 / 停车场 混合）
          const r = Math.random();
          if (r < 0.15) {
            // 公园草地
            ctx.fillStyle = theme === 'snow_night' ? '#5a6470'
                          : theme === 'rain' ? '#2e3a2e' : '#4a6a3a';
            ctx.fillRect(px0.x + 6, px0.y + 6, px1.x - px0.x - 12, px1.y - px0.y - 12);
            // 小径
            ctx.strokeStyle = 'rgba(160,150,120,0.7)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(px0.x + 10, (px0.y + px1.y) / 2);
            ctx.lineTo(px1.x - 10, (px0.y + px1.y) / 2);
            ctx.stroke();
          } else if (r < 0.7) {
            ctx.fillStyle = theme === 'snow_night' ? '#3a3e48'
                          : theme === 'rain' ? '#2e3138' : '#3c3f45';
            ctx.fillRect(px0.x + 6, px0.y + 6, px1.x - px0.x - 12, px1.y - px0.y - 12);
          } else {
            ctx.fillStyle = theme === 'snow_night' ? '#4a4e5a'
                          : theme === 'rain' ? '#34373e' : '#40434a';
            ctx.fillRect(px0.x + 4, px0.y + 4, px1.x - px0.x - 8, px1.y - px0.y - 8);
          }
        }
      }
      // 中线
      ctx.strokeStyle = 'rgba(220, 200, 130, 0.3)';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 12]);
      for (const xE of grid.xEdges) {
        const p = worldToTex(xE, 0, TS);
        ctx.beginPath();
        ctx.moveTo(p.x, 0);
        ctx.lineTo(p.x, TS);
        ctx.stroke();
      }
      for (const zE of grid.zEdges) {
        const p = worldToTex(0, zE, TS);
        ctx.beginPath();
        ctx.moveTo(0, p.y);
        ctx.lineTo(TS, p.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
  } else if (kind === 'factory') {
    // 工厂：脏灰 + 混凝土地块 + 油渍
    ctx.fillStyle = theme === 'snow_night' ? '#3a3c42'
                  : theme === 'rain' ? '#33353a' : '#5a5c60';
    ctx.fillRect(0, 0, TS, TS);

    // 随机混凝土地块
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * TS, y = Math.random() * TS;
      const w = 40 + Math.random() * 90;
      const h = 40 + Math.random() * 90;
      ctx.fillStyle = Math.random() < 0.5 ? 'rgba(70,70,72,0.5)' : 'rgba(90,88,84,0.5)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(30,30,32,0.4)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, w, h);
    }
    // 油渍
    for (let i = 0; i < 26; i++) {
      const x = Math.random() * TS, y = Math.random() * TS;
      const r = 8 + Math.random() * 28;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(20,20,25,0.6)');
      g.addColorStop(1, 'rgba(20,20,25,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // 车辙
    for (let i = 0; i < 12; i++) {
      const x0 = Math.random() * TS;
      const y0 = Math.random() * TS;
      ctx.strokeStyle = 'rgba(40,38,36,0.5)';
      ctx.lineWidth = 3 + Math.random() * 3;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.bezierCurveTo(x0 + rand(-80, 80), y0 + rand(60, 160),
                        x0 + rand(-80, 80), y0 + rand(200, 320),
                        x0 + rand(-40, 40), y0 + rand(320, 460));
      ctx.stroke();
    }
  } else if (kind === 'challenge') {
    // 挑战模式：四象限
    const half = TS / 2;
    // 左上：自然
    ctx.fillStyle = theme === 'snow_night' ? '#8a94a2' : '#4a6a3a';
    ctx.fillRect(0, 0, half, half);
    // 右上：城市
    ctx.fillStyle = theme === 'snow_night' ? '#3a3e48' : '#3c3f45';
    ctx.fillRect(half, 0, half, half);
    // 左下：工厂
    ctx.fillStyle = theme === 'snow_night' ? '#4a4c52' : '#5a5c60';
    ctx.fillRect(0, half, half, half);
    // 右下：自然/城市混合
    ctx.fillStyle = theme === 'snow_night' ? '#7a8492' : '#47623a';
    ctx.fillRect(half, half, half, half);

    // 边界过渡带（模糊）
    ctx.fillStyle = 'rgba(90,90,90,0.4)';
    ctx.fillRect(half - 12, 0, 24, TS);
    ctx.fillRect(0, half - 12, TS, 24);

    // 加噪声
    const img2 = ctx.getImageData(0, 0, TS, TS);
    const d2 = img2.data;
    for (let i = 0; i < d2.length; i += 4) {
      const n = (Math.random() - 0.5) * 18;
      d2[i] = Math.max(0, Math.min(255, d2[i] + n));
      d2[i + 1] = Math.max(0, Math.min(255, d2[i + 1] + n));
      d2[i + 2] = Math.max(0, Math.min(255, d2[i + 2] + n));
    }
    ctx.putImageData(img2, 0, 0);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 4;
  GameState.texCache[key] = tex;
  return tex;
}

function makeBuildingTexture(kind) {
  const theme = GameState.currentTheme;
  const key = `bld_${kind}_${theme}`;
  if (GameState.texCache[key]) return GameState.texCache[key];

  const TS = 256;
  const c = document.createElement('canvas');
  c.width = c.height = TS;
  const ctx = c.getContext('2d');

  const isNight = theme === 'snow_night';
  const isRain = theme === 'rain';

  let baseCol;
  if (kind === 'office') baseCol = isNight ? '#242c3a' : isRain ? '#3a4250' : '#5a6070';
  else if (kind === 'residential') baseCol = isNight ? '#34302c' : isRain ? '#443e38' : '#8a8078';
  else if (kind === 'mall') baseCol = isNight ? '#2a2a34' : isRain ? '#38383e' : '#7a7a80';
  else baseCol = isNight ? '#2a2a34' : isRain ? '#3a3a40' : '#6c6c72';

  ctx.fillStyle = baseCol;
  ctx.fillRect(0, 0, TS, TS);

  // 表面细颗粒
  const img = ctx.getImageData(0, 0, TS, TS);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 12;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);

  if (kind === 'office') {
    // 高层写字楼：水平玻璃幕墙
    const floors = 16;
    const fh = TS / floors;
    for (let i = 0; i < floors; i++) {
      const y = i * fh + 2;
      const h = fh - 4;
      // 玻璃
      const grad = ctx.createLinearGradient(0, y, 0, y + h);
      if (isNight) {
        grad.addColorStop(0, '#3a4658');
        grad.addColorStop(0.5, '#4a5870');
        grad.addColorStop(1, '#2a3444');
      } else if (isRain) {
        grad.addColorStop(0, '#525c6c');
        grad.addColorStop(1, '#3a4250');
      } else {
        grad.addColorStop(0, '#8896a8');
        grad.addColorStop(1, '#5a6474');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(3, y, TS - 6, h);

      // 竖向窗框
      ctx.fillStyle = baseCol;
      for (let x = 3; x < TS - 3; x += 20) {
        ctx.fillRect(x, y, 2, h);
      }
      // 夜晚灯光
      if (isNight) {
        for (let x = 5; x < TS - 5; x += 20) {
          if (Math.random() < 0.42) {
            const r = 240 + Math.floor(Math.random() * 15);
            const g = 190 + Math.floor(Math.random() * 40);
            const b = 110 + Math.floor(Math.random() * 50);
            ctx.fillStyle = `rgba(${r},${g},${b},${0.75 + Math.random() * 0.2})`;
            ctx.fillRect(x, y, 18, h);
            // 局部窗内暗部
            ctx.fillStyle = 'rgba(0,0,0,0.15)';
            ctx.fillRect(x + 12, y + h * 0.45, 6, h * 0.5);
          }
        }
      }
      // 层间分隔
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(0, y + h + 1, TS, 1.5);
    }
  } else if (kind === 'residential') {
    // 居民楼：小窗+阳台
    const floors = 10;
    const cols = 6;
    const fh = TS / floors;
    const cw = TS / cols;
    for (let j = 0; j < floors; j++) {
      for (let i = 0; i < cols; i++) {
        const x = i * cw + 6;
        const y = j * fh + 6;
        const w = cw - 12;
        const h = fh - 10;
        const lit = isNight ? Math.random() < 0.5 : Math.random() < 0.06;
        if (lit) {
          if (isNight) {
            const warm = 1 - Math.abs(Math.random() - 0.5) * 0.5;
            const r = 250, g = 200 + Math.floor(Math.random() * 40), b = 130 + Math.floor(Math.random() * 60);
            ctx.fillStyle = `rgba(${r},${g},${b},${0.7 + warm * 0.3})`;
          } else {
            ctx.fillStyle = 'rgba(200,205,215,0.6)';
          }
        } else {
          ctx.fillStyle = isNight ? 'rgba(15,20,30,0.92)' : 'rgba(50,55,65,0.7)';
        }
        ctx.fillRect(x, y, w, h);
        // 窗框
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
        // 竖窗棂
        ctx.beginPath();
        ctx.moveTo(x + w / 2, y);
        ctx.lineTo(x + w / 2, y + h);
        ctx.stroke();
        // 阳台
        if (j > 0 && Math.random() < 0.55) {
          ctx.fillStyle = 'rgba(0,0,0,0.22)';
          ctx.fillRect(x - 3, y + h - 2, w + 6, 4);
        }
      }
    }
  } else if (kind === 'mall') {
    // 商场：大玻璃幕墙 + 招牌
    const bandY = TS * 0.2;
    const bandH = TS * 0.55;
    const grad = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
    if (isNight) {
      grad.addColorStop(0, '#4a5468');
      grad.addColorStop(1, '#2a3444');
    } else if (isRain) {
      grad.addColorStop(0, '#5a6270');
      grad.addColorStop(1, '#3a4048');
    } else {
      grad.addColorStop(0, '#8a96a4');
      grad.addColorStop(1, '#5a6470');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(6, bandY, TS - 12, bandH);

    // 玻璃竖框
    ctx.fillStyle = baseCol;
    for (let x = 6; x < TS - 6; x += 26) {
      ctx.fillRect(x, bandY, 3, bandH);
    }
    ctx.fillRect(6, bandY + bandH / 2 - 2, TS - 12, 4);

    // 夜晚店内暖光
    if (isNight) {
      for (let i = 0; i < 22; i++) {
        const x = 10 + Math.random() * (TS - 40);
        const y = bandY + 10 + Math.random() * (bandH - 40);
        ctx.fillStyle = `rgba(255, 200, 110, ${0.3 + Math.random() * 0.4})`;
        ctx.fillRect(x, y, 12 + Math.random() * 16, 12 + Math.random() * 16);
      }
    }

    // 招牌带
    ctx.fillStyle = isNight ? '#141418' : '#2a2a30';
    ctx.fillRect(0, 0, TS, bandY);

    const brandCols = ['#e85a4a', '#f0b840', '#4a90e2', '#50c878', '#e070c0'];
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = brandCols[i];
      ctx.globalAlpha = isNight ? 0.9 : 0.55;
      ctx.fillRect(20 + i * 44, bandY * 0.3, 32, bandY * 0.4);
    }
    ctx.globalAlpha = 1;
  } else {
    const floors = 8, cols = 5;
    const fh = TS / floors, cw = TS / cols;
    for (let j = 0; j < floors; j++) {
      for (let i = 0; i < cols; i++) {
        const x = i * cw + 8, y = j * fh + 8;
        const w = cw - 16, h = fh - 16;
        const lit = isNight && Math.random() < 0.4;
        ctx.fillStyle = lit ? 'rgba(250, 200, 130, 0.8)' : (isNight ? 'rgba(15,20,30,0.9)' : 'rgba(50,55,65,0.65)');
        ctx.fillRect(x, y, w, h);
      }
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 2;
  GameState.texCache[key] = tex;
  return tex;
}

/* ============ 8. 生成地图 ============ */
function generateMap() {
  if (!GameState.scene) return;
  clearScene();

  let mapKind;
  if (GameState.challenge) {
    mapKind = 'challenge';
    GameState.currentMap = 'challenge';
  } else {
    const maps = ['nature', 'city', 'factory'];
    mapKind = pick(maps);
    GameState.currentMap = mapKind;
  }
  const themes = ['summer', 'snow_night', 'rain'];
  GameState.currentTheme = pick(themes);

  // 地形振幅
  if (GameState.challenge) GameState.terrainAmp = 2.5;
  else if (GameState.currentMap === 'nature') GameState.terrainAmp = 7;
  else if (GameState.currentMap === 'city') GameState.terrainAmp = 0.4;
  else GameState.terrainAmp = 0.6;

  const mapNames = { nature: '自然', city: '城市', factory: '工厂', challenge: '挑战' };
  const themeNames = { summer: '夏日', snow_night: '雪夜', rain: '阴雨' };
  const infoEl = document.getElementById('ftg-map-info');
  if (infoEl) infoEl.textContent = `${mapNames[GameState.currentMap]} · ${themeNames[GameState.currentTheme]}`;

  applySkyAndFog();

  // 地形特征（自然/挑战模式）
  if (GameState.currentMap === 'nature') {
    generateNatureFeatures();
  } else if (GameState.currentMap === 'challenge') {
    generateChallengeFeatures();
  }

  // 地形网格
  const size = GameState.terrainSize;
  const geo = new THREE.PlaneGeometry(size, size, 80, 80);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i)));
  }
  geo.computeVertexNormals();

  let groundColor = 0x4a6a3a;
  if (GameState.currentMap === 'city') groundColor = 0x50525a;
  else if (GameState.currentMap === 'factory') groundColor = 0x5a5c60;
  else if (GameState.currentMap === 'challenge') groundColor = 0x6a7a5a;
  if (GameState.currentTheme === 'snow_night') groundColor = 0xdfe4ee;
  else if (GameState.currentTheme === 'rain') groundColor = 0x3a4048;

  const groundTex = makeGroundTexture(GameState.currentMap === 'nature' ? 'nature' : GameState.currentMap, groundColor);
  const groundMat = new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.98, metalness: 0.02 });
  const ground = new THREE.Mesh(geo, groundMat);
  ground.receiveShadow = true;
  GameState.scene.add(ground);
  GameState.objects.push(ground);

  // 湖泊 / 河流水面
  addWaterSurfaces();

  // 各玩法
  if (GameState.currentMap === 'nature') generateNatureMap();
  else if (GameState.currentMap === 'city') generateCityMap();
  else if (GameState.currentMap === 'factory') generateFactoryMap();
  else generateChallengeMap();

  setupParticles();

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

/* ============ 9. 地形特征生成 ============ */
function generateNatureFeatures() {
  const half = GameState.terrainSize / 2;
  // 湖泊
  const lakeCount = 2;
  for (let i = 0; i < lakeCount; i++) {
    const r = rand(28, 50);
    let x, z, ok = false;
    for (let k = 0; k < 20; k++) {
      x = rand(-half + r + 20, half - r - 20);
      z = rand(-half + r + 20, half - r - 20);
      if (Math.hypot(x, z) > r + 40) { ok = true; break; }
    }
    if (!ok) continue;
    GameState.terrainFeatures.push({ type: 'lake', x, z, r, depth: 4.5 });
  }
  // 河流
  GameState.terrainFeatures.push({
    type: 'river',
    x0: rand(-60, 60),
    z0: 0,
    freq: 0.008 + Math.random() * 0.006,
    amp: 60 + Math.random() * 40,
    w: 8 + Math.random() * 5,
    depth: 3.2,
  });
  // 山地
  const mtnCount = 3;
  for (let i = 0; i < mtnCount; i++) {
    const r = rand(40, 70);
    const x = rand(-half + r, half - r);
    const z = rand(-half + r, half - r);
    if (Math.hypot(x, z) < r + 30) continue;
    // 避免山地压在湖上
    let ok = true;
    for (const f of GameState.terrainFeatures) {
      if (f.type === 'lake' && Math.hypot(x - f.x, z - f.z) < f.r + r) { ok = false; break; }
    }
    if (!ok) continue;
    GameState.terrainFeatures.push({ type: 'mountain', x, z, r, height: 14 + Math.random() * 10 });
  }
}

function generateChallengeFeatures() {
  const half = GameState.terrainSize / 2;
  // 一个湖 + 一条河，交界处
  GameState.terrainFeatures.push({ type: 'lake', x: -half / 2, z: half / 2, r: 35, depth: 4 });
  GameState.terrainFeatures.push({
    type: 'river', x0: 0, z0: 0, freq: 0.01, amp: 50, w: 7, depth: 2.8,
  });
}

function addWaterSurfaces() {
  for (const f of GameState.terrainFeatures) {
    if (f.type === 'lake') {
      const waterY = terrainHeight(f.x, f.z) + 0.5;
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
      water.position.set(f.x, waterY, f.z);
      water.receiveShadow = true;
      GameState.scene.add(water);
      GameState.objects.push(water);
    } else if (f.type === 'river') {
      // 用一系列小块拼出河面
      const segs = 40;
      const size = GameState.terrainSize;
      const zMin = -size / 2, zMax = size / 2;
      for (let i = 0; i < segs; i++) {
        const wz0 = zMin + (zMax - zMin) * i / segs;
        const wz1 = zMin + (zMax - zMin) * (i + 1) / segs;
        const wz = (wz0 + wz1) / 2;
        const wx = f.x0 + Math.sin((wz - f.z0) * f.freq) * f.amp;
        const y = terrainHeight(wx, wz) + 0.6;
        const geo = new THREE.PlaneGeometry(f.w * 1.9, (wz1 - wz0) * 1.15);
        geo.rotateX(-Math.PI / 2);
        const mat = new THREE.MeshStandardMaterial({
          color: 0x2a5a80,
          transparent: true,
          opacity: 0.82,
          roughness: 0.2,
          metalness: 0.4,
        });
        const water = new THREE.Mesh(geo, mat);
        water.position.set(wx, y, wz);
        GameState.scene.add(water);
        GameState.objects.push(water);
      }
    }
  }
}

/* ============ 10. 自然地图 ============ */
function generateNatureMap() {
  const size = GameState.terrainSize;
  const half = size / 2 - 12;
  const treeCount = 420;

  // 大树 + 灌木 + 枯树
  for (let i = 0; i < treeCount; i++) {
    const x = rand(-half, half);
    const z = rand(-half, half);
    if (Math.abs(x) < 8 && Math.abs(z) < 8) continue;
    if (!isPositionFree(x, z, 1.5)) continue;
    addTree(x, z);
  }

  // 随机石头
  for (let i = 0; i < 60; i++) {
    const x = rand(-half, half);
    const z = rand(-half, half);
    if (!isPositionFree(x, z, 1)) continue;
    addRock(x, z);
  }
}

/* ============ 11. 城市地图 ============ */
function generateCityMap() {
  const size = GameState.terrainSize;
  const half = size / 2;

  // 生成不规则街区
  const xEdges = [-half];
  while (xEdges[xEdges.length - 1] < half - 20) {
    xEdges.push(xEdges[xEdges.length - 1] + rand(38, 68));
  }
  xEdges.push(half);

  const zEdges = [-half];
  while (zEdges[zEdges.length - 1] < half - 20) {
    zEdges.push(zEdges[zEdges.length - 1] + rand(38, 68));
  }
  zEdges.push(half);

  GameState.cityGrid = { xEdges, zEdges };

  // 每个街区
  for (let i = 0; i < xEdges.length - 1; i++) {
    for (let j = 0; j < zEdges.length - 1; j++) {
      const x0 = xEdges[i], x1 = xEdges[i + 1];
      const z0 = zEdges[j], z1 = zEdges[j + 1];
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;

      if (Math.abs(cx) < 25 && Math.abs(cz) < 25) continue;
      if (Math.random() < 0.06) continue;

      const roll = Math.random();
      if (roll < 0.18) {
        // 公园
        makePark(cx, cz, Math.min(x1 - x0, z1 - z0) * 0.75);
      } else {
        // 建筑群
        populateCityBlock(cx, cz, x1 - x0 - GameState.streetWidth, z1 - z0 - GameState.streetWidth);
      }
    }
  }
}

function populateCityBlock(cx, cz, w, d) {
  const layout = Math.random();
  const rects = [];
  if (layout < 0.22) {
    rects.push({ x: cx, z: cz, w: w * 0.85, d: d * 0.85 });
  } else if (layout < 0.55) {
    rects.push({ x: cx - w * 0.22, z: cz, w: w * 0.42, d: d * 0.85 });
    rects.push({ x: cx + w * 0.22, z: cz, w: w * 0.42, d: d * 0.85 });
  } else {
    const cw = w * 0.42, cd = d * 0.42;
    const offX = w * 0.23, offZ = d * 0.23;
    rects.push({ x: cx - offX, z: cz - offZ, w: cw, d: cd });
    rects.push({ x: cx + offX, z: cz - offZ, w: cw, d: cd });
    rects.push({ x: cx - offX, z: cz + offZ, w: cw, d: cd });
    rects.push({ x: cx + offX, z: cz + offZ, w: cw, d: cd });
  }

  const styleRoll = Math.random();
  let style;
  if (styleRoll < 0.45) style = 'office';
  else if (styleRoll < 0.85) style = 'residential';
  else style = 'mall';

  for (const r of rects) addCityBuilding(r.x, r.z, r.w, r.d, style);
}

function addCityBuilding(x, z, w, d, style) {
  const y = terrainHeight(x, z);
  const isNight = GameState.currentTheme === 'snow_night';

  let h;
  if (style === 'office') h = rand(20, 58);
  else if (style === 'residential') h = rand(9, 22);
  else h = rand(7, 14);

  const tex = makeBuildingTexture(style).clone();
  tex.needsUpdate = true;
  const rH = Math.max(1, Math.round(h / 6));
  const rW = Math.max(1, Math.round(Math.max(w, d) / 6));
  tex.repeat.set(rW, rH);

  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    emissiveMap: isNight ? tex : null,
    emissive: isNight ? 0xffffff : 0x000000,
    emissiveIntensity: isNight ? 0.65 : 0,
    roughness: 0.82,
    metalness: 0.08,
  });

  const group = new THREE.Group();
  const shapeRoll = Math.random();
  if (shapeRoll < 0.6) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    b.position.y = h / 2;
    b.castShadow = true; b.receiveShadow = true;
    group.add(b);
    if (Math.random() < 0.5) {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(w * 0.3, 1.5, d * 0.3), mat);
      cap.position.y = h + 0.75;
      cap.castShadow = true;
      group.add(cap);
    }
  } else if (shapeRoll < 0.82) {
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.7, d), mat);
    b1.position.y = h * 0.35;
    b1.castShadow = true; b1.receiveShadow = true;
    group.add(b1);
    const w2 = w * 0.72, d2 = d * 0.72;
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(w2, h * 0.3, d2), mat);
    b2.position.y = h * 0.85;
    b2.castShadow = true; b2.receiveShadow = true;
    group.add(b2);
  } else {
    const w1 = w, d1 = d * 0.55;
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(w1, h, d1), mat);
    b1.position.set(0, h / 2, -d / 2 + d1 / 2);
    b1.castShadow = true; b1.receiveShadow = true;
    group.add(b1);
    const w2 = w * 0.55, d2 = d * 0.45;
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(w2, h * 0.85, d2), mat);
    b2.position.set(-w / 2 + w2 / 2, h * 0.425, d / 2 - d2 / 2);
    b2.castShadow = true; b2.receiveShadow = true;
    group.add(b2);
  }

  if (isNight && h > 22 && Math.random() < 0.5) {
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xff3344 })
    );
    beacon.position.y = h + 1.2;
    group.add(beacon);
  }

  group.position.set(x, y, z);
  group.rotation.y = Math.random() < 0.12 ? Math.PI / 2 : 0;
  GameState.scene.add(group);
  GameState.objects.push(group);

  const halfW = Math.max(w, d) / 2 + 3;
  GameState.occupiedBoxes.push({
    minX: x - halfW, maxX: x + halfW,
    minZ: z - halfW, maxZ: z + halfW,
  });
}

function makePark(cx, cz, r) {
  const y = terrainHeight(cx, cz);

  // 草地圆
  const grassGeo = new THREE.CircleGeometry(r, 24);
  grassGeo.rotateX(-Math.PI / 2);
  const grassMat = new THREE.MeshStandardMaterial({
    color: GameState.currentTheme === 'snow_night' ? 0xc8d0dc
         : GameState.currentTheme === 'rain' ? 0x2e3a2a : 0x4a7a3a,
    roughness: 0.95,
  });
  const grass = new THREE.Mesh(grassGeo, grassMat);
  grass.position.set(cx, y + 0.05, cz);
  grass.receiveShadow = true;
  GameState.scene.add(grass);
  GameState.objects.push(grass);

  // 树
  const treeN = Math.floor(rand(6, 12));
  for (let i = 0; i < treeN; i++) {
    const a = Math.random() * Math.PI * 2;
    const rr = Math.random() * r * 0.75;
    addTree(cx + Math.cos(a) * rr, cz + Math.sin(a) * rr);
  }

  // 长椅
  const benchMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.85 });
  for (let i = 0; i < 4; i++) {
    const a = Math.random() * Math.PI * 2;
    const rr = r * 0.5 + Math.random() * r * 0.3;
    const bx = cx + Math.cos(a) * rr;
    const bz = cz + Math.sin(a) * rr;
    const bench = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.15, 0.6), benchMat);
    bench.position.set(bx, terrainHeight(bx, bz) + 0.5, bz);
    bench.castShadow = true;
    GameState.scene.add(bench);
    GameState.objects.push(bench);

    const legMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    for (const dx of [-0.7, 0.7]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1), legMat);
      leg.position.set(bx + dx, terrainHeight(bx, bz) + 0.25, bz);
      GameState.scene.add(leg);
      GameState.objects.push(leg);
    }
  }
}

/* ============ 12. 工厂地图 ============ */
function generateFactoryMap() {
  const size = GameState.terrainSize;
  const half = size / 2 - 15;

  // 厂房
  const buildN = 12;
  for (let i = 0; i < buildN; i++) {
    const x = rand(-half, half);
    const z = rand(-half, half);
    if (Math.abs(x) < 25 && Math.abs(z) < 25) continue;
    if (!isPositionFree(x, z, 12)) continue;
    const w = rand(16, 28);
    const d = rand(14, 24);
    addFactoryBuilding(x, z, w, d);
  }

  // 烟囱
  for (let i = 0; i < 10; i++) {
    const x = rand(-half, half);
    const z = rand(-half, half);
    if (!isPositionFree(x, z, 4)) continue;
    addChimney(x, z);
  }

  // 仓库
  const whN = 5;
  for (let i = 0; i < whN; i++) {
    let x, z, angle = 0, ok = false;
    for (let k = 0; k < 30; k++) {
      x = rand(-half, half);
      z = rand(-half, half);
      if (Math.abs(x) < 30 && Math.abs(z) < 30) continue;
      if (isPositionFree(x, z, 18)) { ok = true; break; }
    }
    if (!ok) continue;
    angle = Math.random() < 0.5 ? 0 : Math.PI / 2;
    addWarehouse(x, z, angle);
  }

  // 杂物 / 集装箱 / 油桶
  for (let i = 0; i < 60; i++) {
    const x = rand(-half, half);
    const z = rand(-half, half);
    if (!isPositionFree(x, z, 2)) continue;
    addClutter(x, z);
  }
}

function addFactoryBuilding(x, z, w, d) {
  const y = terrainHeight(x, z);
  const h = rand(6, 12);

  const theme = GameState.currentTheme;
  let baseCol = theme === 'snow_night' ? 0x3a4050 : theme === 'rain' ? 0x35404a : 0x6d737a;
  const mat = new THREE.MeshStandardMaterial({ color: baseCol, roughness: 0.85, metalness: 0.18 });

  const group = new THREE.Group();

  const main = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  main.position.y = h / 2;
  main.castShadow = true; main.receiveShadow = true;
  group.add(main);

  // 锯齿屋顶
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x7a7e84, roughness: 0.72, metalness: 0.28 });
  const teethCount = Math.max(2, Math.floor(w / 3));
  const tw = w / teethCount;
  for (let i = 0; i < teethCount; i++) {
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(tw * 0.9, 1.6, d * 0.92), roofMat);
    tooth.position.set(-w / 2 + tw / 2 + i * tw, h + 0.8, 0);
    tooth.castShadow = true;
    group.add(tooth);
  }

  // 立面窗
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
  const h = rand(14, 32);
  const r = rand(0.7, 1.2);
  const theme = GameState.currentTheme;
  const mat = new THREE.MeshStandardMaterial({
    color: theme === 'rain' ? 0x4a4a52 : 0x8a8a90,
    roughness: 0.85, metalness: 0.2,
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

function addClutter(x, z) {
  const y = terrainHeight(x, z);
  const roll = Math.random();
  const mat = new THREE.MeshStandardMaterial({
    color: roll < 0.5 ? 0x8a5a3a : roll < 0.8 ? 0x4a6a8a : 0x7a7a3a,
    roughness: 0.9,
  });

  if (roll < 0.6) {
    // 集装箱
    const w = rand(2, 4), h = rand(1.6, 2.2), d = rand(1.4, 2.2);
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    box.position.set(x, y + h / 2, z);
    box.rotation.y = Math.random() * Math.PI * 2;
    box.castShadow = true; box.receiveShadow = true;
    GameState.scene.add(box);
    GameState.objects.push(box);
    GameState.occupiedBoxes.push({
      minX: x - w, maxX: x + w, minZ: z - d, maxZ: z + d,
    });
  } else {
    // 油桶
    const r = 0.5;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1.2, 10), mat);
    barrel.position.set(x, y + 0.6, z);
    barrel.castShadow = true;
    GameState.scene.add(barrel);
    GameState.objects.push(barrel);
  }
}

/* ============ 13. 仓库（两端开门，坦克可入） ============ */
function addWarehouse(cx, cz, angle) {
  const y = terrainHeight(cx, cz);
  const W = 24, D = 16, H = 9;
  const wallT = 0.7;
  const doorW = 7;

  const theme = GameState.currentTheme;
  const isNight = theme === 'snow_night';
  const wallMat = new THREE.MeshStandardMaterial({
    color: theme === 'rain' ? 0x4a4e52 : isNight ? 0x424652 : 0x8a8e92,
    roughness: 0.85, metalness: 0.2,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: theme === 'rain' ? 0x3a3e42 : isNight ? 0x363a46 : 0x6a6e72,
    roughness: 0.8, metalness: 0.25,
  });
  const doorMat = new THREE.MeshStandardMaterial({
    color: 0x8a8a92, roughness: 0.6, metalness: 0.5,
  });

  const group = new THREE.Group();

  // 左右墙
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallT, H, D), wallMat);
  leftWall.position.set(-W / 2 + wallT / 2, H / 2, 0);
  leftWall.castShadow = true; leftWall.receiveShadow = true;
  group.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(wallT, H, D), wallMat);
  rightWall.position.set(W / 2 - wallT / 2, H / 2, 0);
  rightWall.castShadow = true; rightWall.receiveShadow = true;
  group.add(rightWall);

  // 屋顶（略微人字）
  const roof = new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, wallT, D + 0.6), roofMat);
  roof.position.set(0, H - wallT / 2, 0);
  roof.castShadow = true; roof.receiveShadow = true;
  group.add(roof);
  // 屋脊
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, 0.9, 1.2), roofMat);
  ridge.position.set(0, H + 0.4, 0);
  group.add(ridge);

  // 前后墙：左右两段留门
  const sideW = (W - doorW) / 2;
  // 前墙（+Z）
  const frontL = new THREE.Mesh(new THREE.BoxGeometry(sideW, H, wallT), wallMat);
  frontL.position.set(-W / 2 + sideW / 2, H / 2, D / 2 - wallT / 2);
  frontL.castShadow = true; frontL.receiveShadow = true;
  group.add(frontL);
  const frontR = new THREE.Mesh(new THREE.BoxGeometry(sideW, H, wallT), wallMat);
  frontR.position.set(W / 2 - sideW / 2, H / 2, D / 2 - wallT / 2);
  frontR.castShadow = true; frontR.receiveShadow = true;
  group.add(frontR);
  // 门框顶（在门上方加一段横梁）
  const frontTop = new THREE.Mesh(new THREE.BoxGeometry(doorW, H - 7, wallT), wallMat);
  frontTop.position.set(0, H - (H - 7) / 2, D / 2 - wallT / 2);
  group.add(frontTop);

  // 后墙（-Z）
  const backL = new THREE.Mesh(new THREE.BoxGeometry(sideW, H, wallT), wallMat);
  backL.position.set(-W / 2 + sideW / 2, H / 2, -D / 2 + wallT / 2);
  backL.castShadow = true; backL.receiveShadow = true;
  group.add(backL);
  const backR = new THREE.Mesh(new THREE.BoxGeometry(sideW, H, wallT), wallMat);
  backR.position.set(W / 2 - sideW / 2, H / 2, -D / 2 + wallT / 2);
  backR.castShadow = true; backR.receiveShadow = true;
  group.add(backR);
  const backTop = new THREE.Mesh(new THREE.BoxGeometry(doorW, H - 7, wallT), wallMat);
  backTop.position.set(0, H - (H - 7) / 2, -D / 2 + wallT / 2);
  group.add(backTop);

  // 卷帘门（略微卷起，门洞是空的，坦克可以从这里通过）
  const rollerL = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, doorW, 12), doorMat);
  rollerL.rotation.z = Math.PI / 2;
  rollerL.position.set(0, H - 7 + 0.4, D / 2 + 0.1);
  group.add(rollerL);
  const rollerB = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, doorW, 12), doorMat);
  rollerB.rotation.z = Math.PI / 2;
  rollerB.position.set(0, H - 7 + 0.4, -D / 2 - 0.1);
  group.add(rollerB);

  // 夜晚内部灯
  if (isNight) {
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffcc66 });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), lampMat);
    lamp.position.set(0, H - 1.5, 0);
    group.add(lamp);

    const ptLight = new THREE.PointLight(0xffcc66, 1.2, 20);
    ptLight.position.set(0, H - 1.8, 0);
    group.add(ptLight);
  }

  group.position.set(cx, y, cz);
  group.rotation.y = angle;
  GameState.scene.add(group);
  GameState.objects.push(group);

  // 用 AABB 记录墙体占据的空间——但内部和门洞留空。
  // 简化处理：只用两侧墙作为障碍物（保证坦克能进出）。
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  // 左右墙的世界坐标中心
  for (const lx of [-W / 2 + wallT / 2, W / 2 - wallT / 2]) {
    const wx = cx + cos * lx;
    const wz = cz - sin * lx;
    const halfX = Math.abs(cos) * (wallT / 2 + 1) + Math.abs(sin) * (D / 2 + 1);
    const halfZ = Math.abs(sin) * (wallT / 2 + 1) + Math.abs(cos) * (D / 2 + 1);
    GameState.occupiedBoxes.push({
      minX: wx - halfX, maxX: wx + halfX,
      minZ: wz - halfZ, maxZ: wz + halfZ,
    });
  }

  // 记录仓库内部区域，供坦克藏身用
  GameState.warehouseZones.push({
    cx, cz, angle, W, D,
    interior: { w: W - 4, d: D - 4 },
  });
}

/* ============ 14. 挑战地图（4 区拼接） ============ */
function generateChallengeMap() {
  const size = GameState.terrainSize;
  const half = size / 2;
  const q = half / 2;   // 每个象限的"半边长"（因为象限中心在 ±half/2）

  // 四个区域中心
  const zones = [
    { cx: -q, cz: -q, type: 'nature' },
    { cx:  q, cz: -q, type: 'city' },
    { cx: -q, cz:  q, type: 'factory' },
    { cx:  q, cz:  q, type: 'nature' },
  ];

  for (const z of zones) {
    generateZone(z.cx, z.cz, q * 2, z.type);
  }
}

function generateZone(cx, cz, zoneSize, type) {
  const half = zoneSize / 2 - 8;
  if (type === 'nature') {
    for (let i = 0; i < 140; i++) {
      const x = cx + rand(-half, half);
      const z = cz + rand(-half, half);
      if (Math.abs(x) > GameState.terrainSize / 2 - 5) continue;
      if (Math.abs(z) > GameState.terrainSize / 2 - 5) continue;
      if (!isPositionFree(x, z, 1.5)) continue;
      addTree(x, z);
    }
    for (let i = 0; i < 20; i++) {
      const x = cx + rand(-half, half);
      const z = cz + rand(-half, half);
      if (!isPositionFree(x, z, 1)) continue;
      addRock(x, z);
    }
  } else if (type === 'city') {
    // 简化：几个街区
    const blockW = 40;
    for (let bx = -half + blockW / 2; bx < half; bx += blockW) {
      for (let bz = -half + blockW / 2; bz < half; bz += blockW) {
        const x = cx + bx;
        const z = cz + bz;
        if (Math.abs(x) > GameState.terrainSize / 2 - 15) continue;
        if (Math.abs(z) > GameState.terrainSize / 2 - 15) continue;
        if (!isPositionFree(x, z, 12)) continue;
        if (Math.random() < 0.15) {
          makePark(x, z, 12);
        } else {
          const style = Math.random() < 0.5 ? 'office' : 'residential';
          const w = rand(16, 26), d = rand(16, 26);
          addCityBuilding(x, z, w, d, style);
        }
      }
    }
  } else if (type === 'factory') {
    for (let i = 0; i < 5; i++) {
      const x = cx + rand(-half, half);
      const z = cz + rand(-half, half);
      if (!isPositionFree(x, z, 12)) continue;
      addFactoryBuilding(x, z, rand(16, 24), rand(14, 22));
    }
    for (let i = 0; i < 4; i++) {
      const x = cx + rand(-half, half);
      const z = cz + rand(-half, half);
      if (!isPositionFree(x, z, 15)) continue;
      addWarehouse(x, z, Math.random() < 0.5 ? 0 : Math.PI / 2);
    }
    for (let i = 0; i < 5; i++) {
      const x = cx + rand(-half, half);
      const z = cz + rand(-half, half);
      if (!isPositionFree(x, z, 4)) continue;
      addChimney(x, z);
    }
  }
}

/* ============ 15. 树木 / 石头 ============ */
function addTree(x, z) {
  const g = new THREE.Group();
  const y = terrainHeight(x, z);
  const theme = GameState.currentTheme;

  const variant = pick(['pine', 'pine', 'oak', 'oak', 'birch', 'bush', 'dead']);

  const trunkColor = variant === 'birch'
    ? 0xe8e0d0
    : theme === 'rain' ? 0x3a2a1a
    : theme === 'snow_night' ? 0x4a3a2a
    : 0x5a3a1a;
  const trunkMat = new THREE.MeshStandardMaterial({ color: trunkColor, roughness: 0.95 });

  const scale = rand(0.7, 1.5);

  if (variant === 'bush') {
    // 灌木
    const leafColor = theme === 'snow_night' ? 0xd0d8e0 : theme === 'rain' ? 0x1a3a1a : 0x3a6a2a;
    const leafMat = new THREE.MeshStandardMaterial({ color: leafColor, roughness: 0.95 });
    const r = rand(0.9, 1.4);
    const bush = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), leafMat);
    bush.position.y = r * 0.8;
    bush.scale.y = 0.8;
    bush.castShadow = true;
    g.add(bush);
  } else if (variant === 'dead') {
    // 枯树
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.28, 2.5, 6), trunkMat);
    trunk.position.y = 1.25;
    trunk.castShadow = true;
    g.add(trunk);
    // 几根枝
    for (let i = 0; i < 4; i++) {
      const br = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 1.2, 4), trunkMat);
      br.position.y = 1.8 + Math.random() * 0.8;
      br.rotation.z = Math.PI / 3 + (Math.random() - 0.5) * 0.5;
      br.rotation.y = Math.random() * Math.PI * 2;
      br.position.x = Math.sin(br.rotation.y) * 0.3;
      br.position.z = Math.cos(br.rotation.y) * 0.3;
      g.add(br);
    }
  } else {
    // 有树干的树
    const trunkH = variant === 'birch' ? 3.2 : 2.4;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, trunkH, 6), trunkMat);
    trunk.position.y = trunkH / 2;
    trunk.castShadow = true;
    g.add(trunk);

    let leafColor = 0x2a5a2a;
    if (theme === 'snow_night') leafColor = 0xdfe8f5;
    else if (theme === 'rain') leafColor = 0x1a3a1a;
    else if (variant === 'birch') leafColor = 0x6a9a4a;
    else if (variant === 'oak') leafColor = 0x3a6a2a;

    const leafMat = new THREE.MeshStandardMaterial({ color: leafColor, roughness: 0.9 });

    if (variant === 'pine') {
      const sizes = [
        { y: trunkH + 0.2, r: 1.7, h: 2.4 },
        { y: trunkH + 1.4, r: 1.35, h: 2.0 },
        { y: trunkH + 2.4, r: 0.9, h: 1.6 },
      ];
      for (const s of sizes) {
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(s.r, s.h, 7), leafMat);
        leaf.position.y = s.y;
        leaf.castShadow = true;
        g.add(leaf);
      }
    } else {
      // 阔叶
      const cr = rand(1.2, 1.8);
      const crown = new THREE.Mesh(new THREE.SphereGeometry(cr, 8, 6), leafMat);
      crown.position.y = trunkH + cr * 0.7;
      crown.scale.y = 0.85;
      crown.castShadow = true;
      g.add(crown);
      // 侧球
      const c2 = new THREE.Mesh(new THREE.SphereGeometry(cr * 0.7, 6, 5), leafMat);
      c2.position.set(cr * 0.5, trunkH + cr * 0.5, 0);
      c2.castShadow = true;
      g.add(c2);
    }
  }

  g.position.set(x, y, z);
  g.scale.setScalar(scale);
  g.rotation.y = Math.random() * Math.PI * 2;

  // 关键：树木不参与射线遮挡检测，让坦克能透过树叶被点到
  g.traverse(c => { c.userData.noHit = true; });

  GameState.scene.add(g);
  GameState.objects.push(g);

  // 记录位置供坦克藏身
  GameState.treePositions.push({ x, z, scale });
}

function addRock(x, z) {
  const y = terrainHeight(x, z);
  const r = rand(0.4, 1.1);
  const theme = GameState.currentTheme;
  const mat = new THREE.MeshStandardMaterial({
    color: theme === 'snow_night' ? 0xb8c0cc
         : theme === 'rain' ? 0x4a4e52
         : 0x8a8a88,
    roughness: 0.95,
  });
  const geo = new THREE.IcosahedronGeometry(r, 0);
  const rock = new THREE.Mesh(geo, mat);
  rock.position.set(x, y + r * 0.5, z);
  rock.rotation.set(Math.random(), Math.random(), Math.random());
  rock.castShadow = true;
  rock.receiveShadow = true;
  GameState.scene.add(rock);
  GameState.objects.push(rock);

  GameState.occupiedBoxes.push({
    minX: x - r, maxX: x + r, minZ: z - r, maxZ: z + r,
  });
}

/* ============ 16. 空闲检测 ============ */
function isPositionFree(x, z, radius) {
  const half = GameState.terrainSize / 2 - 5;
  if (Math.abs(x) > half || Math.abs(z) > half) return false;

  for (const b of GameState.occupiedBoxes) {
    if (x + radius > b.minX && x - radius < b.maxX &&
        z + radius > b.minZ && z - radius < b.maxZ) return false;
  }
  for (const f of GameState.terrainFeatures) {
    if (f.type === 'lake') {
      if (Math.hypot(x - f.x, z - f.z) < f.r + radius) return false;
    } else if (f.type === 'river') {
      const rx = f.x0 + Math.sin((z - f.z0) * f.freq) * f.amp;
      if (Math.abs(x - rx) < f.w + radius) return false;
    } else if (f.type === 'mountain') {
      // 山顶也可以放东西，只是别太陡
    }
  }
  return true;
}

/* ============ 17. 统一坦克模型 ============ */
function createTankModel() {
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

  // 炮塔
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

  // 标记每个 mesh，方便射线检测
  group.traverse(c => { c.userData.tankRoot = group; });

  return group;
}

/* ============ 18. 藏匿坦克（单坦克模式） ============ */
function spawnTank() {
  if (!GameState.scene) return;
  const tank = createTankModel();

  const half = GameState.terrainSize / 2 - 25;
  const RADIUS = 6;
  let x = 0, z = 0;
  let ok = false;

  // 自然地图：优先藏到树下
  if (GameState.currentMap === 'nature' && GameState.treePositions.length > 5) {
    for (let k = 0; k < 30; k++) {
      const t = pick(GameState.treePositions);
      const tx = t.x + rand(-1.5, 1.5);
      const tz = t.z + rand(-1.5, 1.5);
      if (isPositionFree(tx, tz, RADIUS)) {
        x = tx; z = tz; ok = true; break;
      }
    }
  }

  // 工厂地图：优先藏到仓库里
  if (!ok && GameState.currentMap === 'factory' && GameState.warehouseZones.length > 0) {
    for (let k = 0; k < 20; k++) {
      const wh = pick(GameState.warehouseZones);
      const cos = Math.cos(wh.angle), sin = Math.sin(wh.angle);
      const lx = rand(-wh.interior.w / 2 + 3, wh.interior.w / 2 - 3);
      const lz = rand(-wh.interior.d / 2 + 3, wh.interior.d / 2 - 3);
      // 转换到世界坐标
      const wx = wh.cx + cos * lx + sin * lz;
      const wz = wh.cz - sin * lx + cos * lz;
      if (isPositionFree(wx, wz, 3)) {
        x = wx; z = wz; ok = true; break;
      }
    }
  }

  if (!ok) {
    for (let attempt = 0; attempt < 80; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = rand(40, half);
      x = Math.cos(angle) * dist;
      z = Math.sin(angle) * dist;
      if (isPositionFree(x, z, RADIUS)) { ok = true; break; }
    }
  }
  if (!ok) { x = 0; z = 0; }

  const y = terrainHeight(x, z);
  tank.position.set(x, y, z);
  tank.rotation.y = Math.random() * Math.PI * 2;
  GameState.scene.add(tank);
  GameState.objects.push(tank);
  GameState.targetTank = tank;

  addTankHeadlights(tank);
}

function addTankHeadlights(tank) {
  if (GameState.currentTheme !== 'snow_night') return;
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

/* ============ 19. 挑战模式：多辆坦克 ============ */
function spawnChallengeTanks() {
  const count = 12;
  const half = GameState.terrainSize / 2 - 25;
  GameState.challengeTotal = count;
  GameState.challengeTanks = [];

  const places = [];

  // 优先选一些"好藏"的点
  const tries = 300;
  for (let i = 0; i < tries && places.length < count; i++) {
    const x = rand(-half, half);
    const z = rand(-half, half);
    if (!isPositionFree(x, z, 5)) continue;
    // 与其他坦克保持距离
    let tooClose = false;
    for (const p of places) {
      if (Math.hypot(p.x - x, p.z - z) < 20) { tooClose = true; break; }
    }
    if (tooClose) continue;
    places.push({ x, z });
  }

  for (const p of places) {
    const tank = createTankModel();
    const y = terrainHeight(p.x, p.z);
    tank.position.set(p.x, y, p.z);
    tank.rotation.y = Math.random() * Math.PI * 2;
    GameState.scene.add(tank);
    GameState.objects.push(tank);
    addTankHeadlights(tank);

    GameState.challengeTanks.push({
      tank,
      phase: 'idle',  // idle | alert | escape | gone
      t: 0,
      sprite: null,
      dir: new THREE.Vector3(),
    });
  }
}

/* ============ 20. 粒子 ============ */
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
  const fallSpeed = isRain ? 80 : 6;
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

/* ============ 21. 点击处理 ============ */
function handleCanvasClick(clientX, clientY) {
  if (GameState.phase !== 'playing') return;
  if (!GameState.challenge && GameState.locked) return;

  const rect = GameState.renderer.domElement.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((clientY - rect.top) / rect.height) * 2 + 1;

  GameState.pointer.set(x, y);
  GameState.raycaster.setFromCamera(GameState.pointer, GameState.camera);

  const hits = GameState.raycaster.intersectObjects(GameState.scene.children, true);
  for (const h of hits) {
    const obj = h.object;
    if (obj.userData.noHit) continue;          // 树 / 粒子等穿透
    if (obj.isPoints || obj.isSprite) continue;
    // 沿父级找坦克根
    let n = obj;
    while (n) {
      if (n.userData.tankRoot) {
        handleTankHit(n.userData.tankRoot);
        return;
      }
      n = n.parent;
    }
    // 命中的是普通障碍物 → 视为被挡住
    return;
  }
}

function handleTankHit(tankRoot) {
  if (GameState.challenge) {
    // 挑战模式：找到该坦克
    for (const ct of GameState.challengeTanks) {
      if (ct.tank === tankRoot && ct.phase === 'idle') {
        challengeTankFound(ct);
        return;
      }
    }
  } else {
    if (GameState.targetTank === tankRoot) triggerWin();
  }
}

/* ============ 22. 经典模式胜利 ============ */
function triggerWin() {
  if (GameState.locked) return;
  GameState.locked = true;
  GameState.phase = 'won';

  const elapsed = (performance.now() - GameState.startTime) / 1000;
  GameState.elapsed = elapsed;
  if (typeof playSound === 'function') playSound('fav');

  const sprite = makeExclamationSprite();
  const tankPos = GameState.targetTank.position.clone();
  sprite.position.set(tankPos.x, tankPos.y + 7, tankPos.z);
  GameState.scene.add(sprite);
  GameState.winSprite = sprite;

  const half = GameState.terrainSize / 2;
  const p = GameState.targetTank.position;
  const distToEdge = { px: half - p.x, nx: half + p.x, pz: half - p.z, nz: half + p.z };
  let dirX = 0, dirZ = 0;
  const minKey = Object.keys(distToEdge).reduce((a, b) => distToEdge[a] < distToEdge[b] ? a : b);
  if (minKey === 'px') dirX = 1;
  else if (minKey === 'nx') dirX = -1;
  else if (minKey === 'pz') dirZ = 1;
  else dirZ = -1;

  GameState.winState = {
    phase: 'alert',
    t: 0,
    escapeT: 0,
    sprite,
    tank: GameState.targetTank,
    dir: new THREE.Vector3(dirX, 0, dirZ).normalize(),
    baseY: tankPos.y,
    missile: null,
    missileVel: null,
    missileActive: false,
  };
}

/* ============ 23. 挑战模式命中 ============ */
function challengeTankFound(ct) {
  ct.phase = 'alert';
  ct.t = 0;
  GameState.challengeFound++;
  const foundEl = document.getElementById('ftg-found');
  if (foundEl) foundEl.textContent = GameState.challengeFound;
  if (typeof playSound === 'function') playSound('fav');

  // "!" 提示
  const sprite = makeExclamationSprite();
  const p = ct.tank.position.clone();
  sprite.position.set(p.x, p.y + 7, p.z);
  GameState.scene.add(sprite);
  ct.sprite = sprite;

  // 冲向最近边缘
  const half = GameState.terrainSize / 2;
  const distToEdge = { px: half - p.x, nx: half + p.x, pz: half - p.z, nz: half + p.z };
  let dirX = 0, dirZ = 0;
  const minKey = Object.keys(distToEdge).reduce((a, b) => distToEdge[a] < distToEdge[b] ? a : b);
  if (minKey === 'px') dirX = 1;
  else if (minKey === 'nx') dirX = -1;
  else if (minKey === 'pz') dirZ = 1;
  else dirZ = -1;
  ct.dir.set(dirX, 0, dirZ).normalize();

  // 检查是否找全了
  if (GameState.challengeFound >= GameState.challengeTotal) {
    setTimeout(() => {
      if (GameState.phase === 'playing' && GameState.challenge) {
        endChallenge(true);
      }
    }, 800);
  }
}

/* ============ 24. 挑战结束 ============ */
function endChallenge(allFound) {
  if (GameState.phase !== 'playing') return;
  GameState.phase = 'won';
  GameState.locked = true;
  GameState.elapsed = 90 - GameState.challengeTimeLeft;

  // 清掉所有剩余坦克的 ! 提示
  for (const ct of GameState.challengeTanks) {
    if (ct.sprite) {
      GameState.scene.remove(ct.sprite);
      ct.sprite = null;
    }
  }
  showResult();
}

/* ============ 25. 导弹 ============ */
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
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(4, 8, 1);
  sprite.renderOrder = 999;
  return sprite;
}

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
    const r = 0.22;
    fin.position.x = -1.1;
    fin.position.y = Math.cos((i / 3) * Math.PI * 2) * r;
    fin.position.z = Math.sin((i / 3) * Math.PI * 2) * r;
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

  const SPEED = 220;   // 快很多
  const vel = toTank.multiplyScalar(SPEED);
  w.missile = missile;
  w.missileVel = vel;
  w.missileActive = true;

  setupMissileTrail();
  if (typeof playSound === 'function') playSound('open');
}

const MISSILE_TRAIL_MAX = 90;
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

  // 保持 8-25 单位的"戏剧距离"，永远追不上
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

/* ============ 26. 胜利 / 挑战 动画更新 ============ */
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
    if (w.t > 0.6) {
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
    const SPEED = 85;
    w.tank.position.x += w.dir.x * SPEED * dt;
    w.tank.position.z += w.dir.z * SPEED * dt;
    w.tank.position.y = terrainHeight(w.tank.position.x, w.tank.position.z);

    const targetRot = Math.atan2(-w.dir.z, w.dir.x);
    let diff = targetRot - w.tank.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    w.tank.rotation.y += diff * Math.min(1, dt * 6);

    updateMissile(dt);

    const out = GameState.terrainSize / 2 + 30;
    if (Math.abs(w.tank.position.x) > out || Math.abs(w.tank.position.z) > out) {
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
      GameState.winState = null;
      showResult();
    }
  }
}

function updateChallengeTanks(dt) {
  for (const ct of GameState.challengeTanks) {
    if (ct.phase === 'idle' || ct.phase === 'gone') continue;
    ct.t += dt;

    if (ct.phase === 'alert') {
      if (ct.sprite) {
        const pulse = 1 + Math.sin(ct.t * 10) * 0.15;
        ct.sprite.scale.set(4 * pulse, 8 * pulse, 1);
        ct.sprite.position.y = ct.tank.position.y + 7 + Math.sin(ct.t * 6) * 0.5;
      }
      if (ct.t > 0.7) {
        ct.phase = 'escape';
        ct.t = 0;
      }
    } else if (ct.phase === 'escape') {
      const SPEED = 90;
      ct.tank.position.x += ct.dir.x * SPEED * dt;
      ct.tank.position.z += ct.dir.z * SPEED * dt;
      ct.tank.position.y = terrainHeight(ct.tank.position.x, ct.tank.position.z);

      const targetRot = Math.atan2(-ct.dir.z, ct.dir.x);
      let diff = targetRot - ct.tank.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      ct.tank.rotation.y += diff * Math.min(1, dt * 6);

      if (ct.sprite) {
        ct.sprite.position.x = ct.tank.position.x;
        ct.sprite.position.y = ct.tank.position.y + 7 + Math.sin(ct.t * 6) * 0.5;
        ct.sprite.position.z = ct.tank.position.z;
      }

      const out = GameState.terrainSize / 2 + 30;
      if (Math.abs(ct.tank.position.x) > out || Math.abs(ct.tank.position.z) > out) {
        ct.phase = 'gone';
        if (ct.sprite) {
          GameState.scene.remove(ct.sprite);
          ct.sprite = null;
        }
        // 从场景中移除坦克
        const idx = GameState.objects.indexOf(ct.tank);
        if (idx >= 0) GameState.objects.splice(idx, 1);
        GameState.scene.remove(ct.tank);
      }
    }
  }
}

/* ============ 27. 结算 ============ */
function showResult() {
  const p = GameState.panel;
  p.querySelector('#ftg-result').style.display = 'flex';

  const titleEl = p.querySelector('#ftg-result-title');
  const emojiEl = p.querySelector('#ftg-result-emoji');
  const labelEl = p.querySelector('#ftg-result-label');
  const timeEl = p.querySelector('#ftg-result-time');
  const nameEl = p.querySelector('#ftg-result-tankname');
  const nextBtn = p.querySelector('#ftg-btn-next');

  if (GameState.challenge) {
    emojiEl.textContent = GameState.challengeFound >= GameState.challengeTotal ? '🏅' : '⏱';
    titleEl.textContent = '挑战结束';
    labelEl.textContent = '找到坦克';
    timeEl.textContent = `${GameState.challengeFound} / ${GameState.challengeTotal}`;
    nameEl.textContent = `用时 ${GameState.elapsed.toFixed(1)}s · 已用尽 90s 时限`;
    nextBtn.textContent = '再来一局 →';
  } else {
    emojiEl.textContent = '🎉';
    titleEl.textContent = '找到了！';
    labelEl.textContent = '用时';
    timeEl.textContent = GameState.elapsed.toFixed(2) + 's';
    nameEl.textContent = '你找到了藏匿的坦克';
    nextBtn.textContent = '下一关 →';
  }

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

/* ============ 28. 主循环 ============ */
function startGameLoop() {
  if (GameState.animId) return;
  if (!GameState.clock) GameState.clock = new THREE.Clock();
  GameState.clock.getDelta();

  const loop = () => {
    GameState.animId = requestAnimationFrame(loop);
    const dt = Math.min(0.05, GameState.clock.getDelta());

    if (GameState.controls) GameState.controls.update();

    if (GameState.phase === 'playing') {
      if (GameState.challenge) {
        GameState.challengeTimeLeft -= dt;
        if (GameState.challengeTimeLeft < 0) GameState.challengeTimeLeft = 0;
        const t = document.getElementById('ftg-timer');
        if (t) t.textContent = GameState.challengeTimeLeft.toFixed(1);
        if (GameState.challengeTimeLeft <= 0 && !GameState.locked) {
          endChallenge(false);
        }
      } else if (!GameState.locked) {
        GameState.elapsed = (performance.now() - GameState.startTime) / 1000;
        const t = document.getElementById('ftg-timer');
        if (t) t.textContent = GameState.elapsed.toFixed(1);
      }
    }

    updateParticles(dt);
    if (GameState.winState) updateWinAnimation(dt);
    if (GameState.challenge) updateChallengeTanks(dt);

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

/* ============ 29. ESC ============ */
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!GameState.panel || GameState.panel.style.display === 'none') return;
  if (GameState.phase === 'menu') { closeFindTankGame(); return; }
  if (GameState.phase === 'playing') { closeFindTankGame(); return; }
  if (GameState.phase === 'won') {
    if (GameState.challenge) beginLevel(true, true);
    else { GameState.level++; beginLevel(true, false); }
  }
});

/* ============ 导出 ============ */
window.startFindTankGame = startFindTankGame;
window.closeFindTankGame = closeFindTankGame;