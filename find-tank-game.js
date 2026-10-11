// ==================== find-tank-game.js — 寻找坦克 3D v2 ====================

/* ==================== 全局状态 ==================== */
const GameState = {
  scene: null, camera: null, renderer: null, controls: null,
  animId: null, clock: null,
  currentTheme: 'summer',
  currentMap: 'forest',
  targetTank: null,
  objects: [],
  panel: null,
  dirLight: null, ambientLight: null, hemiLight: null,
  starting: false,

  phase: 'menu',           // menu | playing | won
  startTime: 0, elapsed: 0,
  level: 1, locked: false,

  particleObj: null, particleType: null,
  winState: null, winSprite: null,

  raycaster: null, pointer: null,
  pointerDown: null,

  terrainAmp: 3,
  terrainSize: 200,

  texPool: [],
};

/* ==================== 库路径 ==================== */
const GAME_LIB_PATHS = { three: 'three.min.js', orbit: 'OrbitControls.js' };

/* ==================== 工具函数 ==================== */
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
function esc(s) {
  return (typeof escapeHtml === 'function') ? escapeHtml(s) : String(s);
}

/* ==================== 1. 面板 ==================== */
function initFindTankGame() {
  if (GameState.panel) return GameState.panel;

  const panel = document.createElement('div');
  panel.id = 'find-tank-panel';
  panel.style.cssText = 'position:fixed;inset:0;z-index:400;background:#0b0b0e;display:none;flex-direction:column;overflow:hidden;';

  panel.innerHTML = `
    <!-- HUD -->
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

    <!-- 主菜单 -->
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

    <!-- 结算 -->
    <div id="ftg-result" style="position:absolute;inset:0;z-index:20;display:none;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 40%, rgba(28,32,40,0.97), rgba(11,11,14,0.99));color:#fff;padding:24px;text-align:center;">
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

  // 事件绑定
  panel.querySelector('#ftg-btn-quit').addEventListener('click', closeFindTankGame);
  panel.querySelector('#ftg-btn-restart').addEventListener('click', () => beginLevel(true));
  panel.querySelector('#ftg-btn-menu-quit').addEventListener('click', closeFindTankGame);
  panel.querySelector('#ftg-btn-start').addEventListener('click', () => beginLevel(false));
  panel.querySelector('#ftg-btn-next').addEventListener('click', () => {
    GameState.level++;
    beginLevel(true);
  });
  panel.querySelector('#ftg-btn-result-quit').addEventListener('click', closeFindTankGame);

  // 画布点击
  const wrap = panel.querySelector('#game-canvas-wrap');
  wrap.addEventListener('pointerdown', e => {
    GameState.pointerDown = { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  wrap.addEventListener('pointerup', e => {
    const pd = GameState.pointerDown;
    GameState.pointerDown = null;
    if (!pd) return;
    const dx = e.clientX - pd.x, dy = e.clientY - pd.y;
    if (dx * dx + dy * dy > 36) return;   // 拖动，不算点击
    if (performance.now() - pd.t > 600) return;
    handleCanvasClick(e.clientX, e.clientY);
  });

  // 窗口尺寸同步
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
  // 提前预加载
  try { await ensureThreeLibs(); } catch (e) { /* 菜单阶段忽略 */ }
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
  // 清空场景
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

    GameState.camera = new THREE.PerspectiveCamera(58, 1, 0.5, 800);
    GameState.camera.position.set(0, 65, 85);

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
      GameState.controls.minDistance = 15;
      GameState.controls.maxDistance = 220;
      GameState.controls.target.set(0, 0, 0);
      GameState.controls.update();
    }

    // 光照
    GameState.hemiLight = new THREE.HemisphereLight(0xffffff, 0x445566, 0.5);
    GameState.scene.add(GameState.hemiLight);

    GameState.ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
    GameState.scene.add(GameState.ambientLight);

    GameState.dirLight = new THREE.DirectionalLight(0xffffff, 0.95);
    GameState.dirLight.position.set(60, 90, 40);
    GameState.dirLight.castShadow = true;
    GameState.dirLight.shadow.mapSize.width = 2048;
    GameState.dirLight.shadow.mapSize.height = 2048;
    const d = 110;
    GameState.dirLight.shadow.camera.left = -d;
    GameState.dirLight.shadow.camera.right = d;
    GameState.dirLight.shadow.camera.top = d;
    GameState.dirLight.shadow.camera.bottom = -d;
    GameState.dirLight.shadow.camera.near = 1;
    GameState.dirLight.shadow.camera.far = 400;
    GameState.dirLight.shadow.bias = -0.0005;
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
            if (m.map) m.map.dispose();
            if (m.emissiveMap) m.emissiveMap.dispose();
            m.dispose();
          });
        }
      });
    }
  });
  GameState.objects = [];
  GameState.targetTank = null;
  GameState.winState = null;

  if (GameState.particleObj) {
    GameState.scene.remove(GameState.particleObj);
    GameState.particleObj.geometry.dispose();
    GameState.particleObj.material.dispose();
    GameState.particleObj = null;
  }
  GameState.particleType = null;
}

/* ==================== 6. 地形高度 ==================== */
function terrainHeight(x, z) {
  const a = GameState.terrainAmp;
  if (a <= 0.01) return 0;
  return (
    Math.sin(x * 0.035) * Math.cos(z * 0.035) * a +
    Math.sin(x * 0.085 + 1.3) * Math.cos(z * 0.075 + 0.6) * a * 0.55 +
    Math.sin(x * 0.18 + 2.1) * Math.cos(z * 0.2 + 1.9) * a * 0.28
  );
}

/* ==================== 7. 生成地图 ==================== */
function generateMap() {
  if (!GameState.scene) return;
  clearScene();

  const maps = ['forest', 'city', 'factory', 'grassland'];
  const themes = ['summer', 'snow_night', 'rain'];
  GameState.currentMap = maps[Math.floor(Math.random() * maps.length)];
  GameState.currentTheme = themes[Math.floor(Math.random() * themes.length)];

  // 地形振幅
  GameState.terrainAmp = (GameState.currentMap === 'city' || GameState.currentMap === 'factory') ? 1.2 : 5.5;

  const mapNames = { forest: '森林', city: '城市', factory: '工厂', grassland: '草原' };
  const themeNames = { summer: '夏日', snow_night: '雪夜', rain: '阴雨' };
  const infoEl = document.getElementById('ftg-map-info');
  if (infoEl) infoEl.textContent = `${mapNames[GameState.currentMap]} · ${themeNames[GameState.currentTheme]}`;

  // 天空 & 雾
  applySkyAndFog();

  // 地形
  const size = GameState.terrainSize;
  const geo = new THREE.PlaneGeometry(size, size, 80, 80);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i)));
  }
  geo.computeVertexNormals();

  let groundColor = 0x4a7a3a;
  if (GameState.currentMap === 'city' || GameState.currentMap === 'factory') groundColor = 0x555658;
  if (GameState.currentTheme === 'snow_night') groundColor = 0xe8eaf2;
  else if (GameState.currentTheme === 'rain') groundColor = 0x2f3540;

  const groundMat = new THREE.MeshStandardMaterial({ color: groundColor, roughness: 1, metalness: 0 });
  const ground = new THREE.Mesh(geo, groundMat);
  ground.receiveShadow = true;
  GameState.scene.add(ground);
  GameState.objects.push(ground);

  // 准备建筑纹理池
  GameState.texPool = [];
  const poolSize = 8;
  for (let i = 0; i < poolSize; i++) {
    GameState.texPool.push(makeBuildingTexture());
  }

  // 散布物体
  const half = size / 2 - 10;
  const count = GameState.currentMap === 'forest' ? 150
              : GameState.currentMap === 'grassland' ? 90
              : GameState.currentMap === 'city' ? 60
              : 70;

  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * 2 * half;
    const z = (Math.random() - 0.5) * 2 * half;
    // 中心保底留空
    if (Math.abs(x) < 8 && Math.abs(z) < 8) continue;

    if (GameState.currentMap === 'forest' || GameState.currentMap === 'grassland') {
      addTree(x, z);
    } else if (GameState.currentMap === 'city') {
      addCityBuilding(x, z);
    } else {
      addFactoryBuilding(x, z);
    }
  }

  // 工厂额外烟囱 / 管道
  if (GameState.currentMap === 'factory') {
    for (let i = 0; i < 5; i++) {
      const x = (Math.random() - 0.5) * 2 * half;
      const z = (Math.random() - 0.5) * 2 * half;
      if (Math.abs(x) < 12 && Math.abs(z) < 12) continue;
      addChimney(x, z);
    }
  }

  // 粒子
  setupParticles();

  // 相机复位
  if (GameState.camera) {
    GameState.camera.position.set(0, 65, 85);
    if (GameState.controls) {
      GameState.controls.target.set(0, 0, 0);
      GameState.controls.update();
    }
  }
}

/* ---------- 天空 & 雾 ---------- */
function applySkyAndFog() {
  const s = GameState.scene;
  const theme = GameState.currentTheme;
  if (theme === 'summer') {
    s.background = new THREE.Color(0x8fc8f0);
    s.fog = new THREE.Fog(0xb8d8ee, 140, 340);
    if (GameState.hemiLight) GameState.hemiLight.intensity = 0.7;
    if (GameState.ambientLight) GameState.ambientLight.intensity = 0.35;
    if (GameState.dirLight) {
      GameState.dirLight.intensity = 1.0;
      GameState.dirLight.color.setHex(0xfff3e0);
      GameState.dirLight.position.set(60, 90, 40);
    }
  } else if (theme === 'snow_night') {
    s.background = new THREE.Color(0x0a0e1e);
    s.fog = new THREE.Fog(0x0a0e1e, 80, 260);
    if (GameState.hemiLight) GameState.hemiLight.intensity = 0.28;
    if (GameState.ambientLight) GameState.ambientLight.intensity = 0.15;
    if (GameState.dirLight) {
      GameState.dirLight.intensity = 0.35;
      GameState.dirLight.color.setHex(0x8faadd);
      GameState.dirLight.position.set(-50, 70, -40);
    }
  } else {
    s.background = new THREE.Color(0x39404d);
    s.fog = new THREE.Fog(0x4a5260, 60, 220);
    if (GameState.hemiLight) GameState.hemiLight.intensity = 0.45;
    if (GameState.ambientLight) GameState.ambientLight.intensity = 0.32;
    if (GameState.dirLight) {
      GameState.dirLight.intensity = 0.42;
      GameState.dirLight.color.setHex(0xbcc6d4);
      GameState.dirLight.position.set(30, 80, 20);
    }
  }
}

/* ==================== 8. 建筑纹理 ==================== */
function makeBuildingTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');

  const theme = GameState.currentTheme;
  const isNight = theme === 'snow_night';
  const baseCol = theme === 'rain' ? '#3a3f48' : isNight ? '#2c3242' : '#7a7d84';
  ctx.fillStyle = baseCol;
  ctx.fillRect(0, 0, 128, 128);

  // 窗格 8 行 × 6 列
  const rows = 8, cols = 6;
  const cw = 128 / cols, ch = 128 / rows;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const lit = isNight ? Math.random() < 0.55 : Math.random() < 0.15;
      if (lit) {
        // 暖黄灯光
        const r = 240 + Math.floor(Math.random() * 15);
        const g = 190 + Math.floor(Math.random() * 40);
        const b = 100 + Math.floor(Math.random() * 60);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
      } else {
        ctx.fillStyle = isNight ? 'rgba(15,20,35,0.9)' : 'rgba(40,45,55,0.75)';
      }
      ctx.fillRect(i * cw + 1, j * ch + 1, cw - 2, ch - 2);
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

/* ==================== 9. 树木 ==================== */
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

  // 三层锥形，更自然
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
  g.scale.setScalar(0.75 + Math.random() * 0.7);
  g.rotation.y = Math.random() * Math.PI * 2;

  GameState.scene.add(g);
  GameState.objects.push(g);
}

/* ==================== 10. 城市建筑 ==================== */
function addCityBuilding(x, z) {
  const y = terrainHeight(x, z);
  const shapeType = Math.random();

  const w = 3 + Math.random() * 5;
  const d = 3 + Math.random() * 5;
  const h = 6 + Math.random() * 20;

  const tex = GameState.texPool[Math.floor(Math.random() * GameState.texPool.length)];
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    emissiveMap: tex,
    emissive: GameState.currentTheme === 'snow_night' ? 0xffffff : 0x000000,
    emissiveIntensity: GameState.currentTheme === 'snow_night' ? 0.9 : 0,
    roughness: 0.85,
    metalness: 0.05,
  });

  const group = new THREE.Group();

  if (shapeType < 0.55) {
    // 普通长方体
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    b.position.y = h / 2;
    b.castShadow = true;
    b.receiveShadow = true;
    group.add(b);
  } else if (shapeType < 0.78) {
    // L 形（两个盒子组合）
    const w1 = w, d1 = d * 0.5;
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(w1, h, d1), mat);
    b1.position.set(0, h / 2, -d / 2 + d1 / 2);
    b1.castShadow = true; b1.receiveShadow = true;
    group.add(b1);

    const w2 = w * 0.5, d2 = d * 0.5;
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(w2, h * 0.85, d2), mat);
    b2.position.set(w / 2 - w2 / 2, h * 0.425, d / 2 - d2 / 2);
    b2.castShadow = true; b2.receiveShadow = true;
    group.add(b2);
  } else {
    // 阶梯状（上小下大）
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.6, d), mat);
    b1.position.y = h * 0.3;
    b1.castShadow = true; b1.receiveShadow = true;
    group.add(b1);

    const w2 = w * 0.7, d2 = d * 0.7;
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(w2, h * 0.4, d2), mat);
    b2.position.y = h * 0.8;
    b2.castShadow = true; b2.receiveShadow = true;
    group.add(b2);

    // 屋顶小盒子
    const b3 = new THREE.Mesh(new THREE.BoxGeometry(w * 0.3, 1.2, d * 0.3), mat);
    b3.position.y = h + 0.6;
    b3.castShadow = true;
    group.add(b3);
  }

  // 夜景屋顶灯光（红点）
  if (GameState.currentTheme === 'snow_night' && Math.random() < 0.4) {
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xff3344 });
    const lightMesh = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 6), lightMat);
    lightMesh.position.set(0, h + 1.5, 0);
    group.add(lightMesh);
  }

  group.position.set(x, y, z);
  group.rotation.y = Math.random() * Math.PI * 2;
  GameState.scene.add(group);
  GameState.objects.push(group);
}

/* ==================== 11. 工厂建筑 ==================== */
function addFactoryBuilding(x, z) {
  const y = terrainHeight(x, z);
  const w = 8 + Math.random() * 8;
  const d = 8 + Math.random() * 10;
  const h = 4 + Math.random() * 5;

  // 工厂外壳材质
  const color = GameState.currentTheme === 'snow_night' ? 0x3a4050
              : GameState.currentTheme === 'rain' ? 0x35404a
              : 0x6d737a;
  const mat = new THREE.MeshStandardMaterial({
    color, roughness: 0.85, metalness: 0.15
  });

  const group = new THREE.Group();

  // 主楼
  const main = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  main.position.y = h / 2;
  main.castShadow = true; main.receiveShadow = true;
  group.add(main);

  // 锯齿形屋顶
  const toothMat = new THREE.MeshStandardMaterial({
    color: 0x8a8e94, roughness: 0.7, metalness: 0.25
  });
  const teethCount = Math.floor(w / 2.5);
  for (let i = 0; i < teethCount; i++) {
    const tooth = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 1.4, d * 0.95),
      toothMat
    );
    tooth.position.set(-w / 2 + 1.25 + i * 2.5, h + 0.7, 0);
    tooth.castShadow = true;
    group.add(tooth);
  }

  // 立面窗户条
  if (GameState.currentTheme === 'snow_night') {
    const winMat = new THREE.MeshBasicMaterial({ color: 0xffcc66 });
    for (let i = 0; i < 4; i++) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), winMat);
      win.position.set(-w / 2 + 1 + i * 2, h * 0.5, d / 2 + 0.01);
      group.add(win);
    }
  }

  group.position.set(x, y, z);
  group.rotation.y = Math.random() < 0.5 ? 0 : Math.PI / 2 * (Math.random() < 0.5 ? 1 : -1);
  GameState.scene.add(group);
  GameState.objects.push(group);
}

/* ==================== 12. 工厂烟囱 ==================== */
function addChimney(x, z) {
  const y = terrainHeight(x, z);
  const h = 12 + Math.random() * 14;
  const r = 0.7 + Math.random() * 0.5;

  const mat = new THREE.MeshStandardMaterial({
    color: GameState.currentTheme === 'rain' ? 0x4a4a52 : 0x8a8a90,
    roughness: 0.85, metalness: 0.2
  });

  const group = new THREE.Group();

  const chimney = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.15, h, 12), mat);
  chimney.position.y = h / 2;
  chimney.castShadow = true;
  group.add(chimney);

  // 顶部红白条
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 1.05, r * 1.05, 0.6, 12),
    new THREE.MeshStandardMaterial({ color: 0xc04040, roughness: 0.7 })
  );
  band.position.y = h - 1.5;
  group.add(band);

  // 红色警示灯
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff2222 })
  );
  beacon.position.y = h + 0.4;
  group.add(beacon);

  group.position.set(x, y, z);
  GameState.scene.add(group);
  GameState.objects.push(group);
}

/* ==================== 13. 前置炮塔精细坦克模型 ==================== */
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

  // === 履带总成（两侧） ===
  function makeTrackAssembly() {
    const t = new THREE.Group();

    // 履带外壳（4 段）
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

    // 负重轮 × 6
    const wheelGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.34, 12);
    for (let i = 0; i < 6; i++) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.x = Math.PI / 2;
      w.position.set(-1.35 + i * 0.54, 0, 0);
      t.add(w);
    }

    // 主动轮（后） / 诱导轮（前）
    const driveGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.36, 10);
    const drive = new THREE.Mesh(driveGeo, wheelMat);
    drive.rotation.x = Math.PI / 2;
    drive.position.set(-1.55, 0.05, 0);
    t.add(drive);

    const idler = new THREE.Mesh(driveGeo, wheelMat);
    idler.rotation.x = Math.PI / 2;
    idler.position.set(1.55, 0.05, 0);
    t.add(idler);

    // 履带齿（顶部小块）
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

  // === 车体下部 ===
  const hullLower = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.5, 1.55), hullMat);
  hullLower.position.set(0, 0.6, 0);
  hullLower.castShadow = true;
  hullLower.receiveShadow = true;
  group.add(hullLower);

  // === 车体上部（略窄，形成斜面感） ===
  const hullUpper = new THREE.Mesh(new THREE.BoxGeometry(2.95, 0.45, 1.35), hullMat);
  hullUpper.position.set(0, 1.05, 0);
  hullUpper.castShadow = true;
  group.add(hullUpper);

  // 前部倾斜装甲（用一个旋转的盒子近似）
  const glacis = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 1.35), hullMatDark);
  glacis.rotation.z = -Math.PI / 4.5;
  glacis.position.set(1.35, 0.85, 0);
  glacis.castShadow = true;
  group.add(glacis);

  // === 前挡泥板 ===
  const fender = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 1.7), hullMatDark);
  fender.position.set(1.85, 1.28, 0);
  group.add(fender);

  // === 工具箱 / 储物箱 ===
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.28, 0.35), hullMatDark);
  box.position.set(-1.0, 1.4, 0.45);
  box.castShadow = true;
  group.add(box);

  const box2 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4), hullMatDark);
  box2.position.set(-1.0, 1.36, -0.45);
  box2.castShadow = true;
  group.add(box2);

  // === 尾部排气管 ===
  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 8), metalMat);
  exhaust.rotation.z = Math.PI / 2;
  exhaust.position.set(-1.75, 1.15, 0.35);
  group.add(exhaust);

  const exhaust2 = exhaust.clone();
  exhaust2.position.z = -0.35;
  group.add(exhaust2);

  if (type === 'MBT') {
    // ================ 主战坦克：前置炮塔 ================
    // 炮塔座圈（小圆台）
    const ringGeo = new THREE.CylinderGeometry(0.72, 0.78, 0.12, 16);
    const ring = new THREE.Mesh(ringGeo, hullMatDark);
    ring.position.set(0.35, 1.34, 0);
    group.add(ring);

    // 炮塔主体（偏前）
    const turret = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.55, 1.3), hullMat);
    turret.position.set(0.35, 1.65, 0);
    turret.castShadow = true;
    group.add(turret);

    // 炮塔前部倾斜面
    const turretFront = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 1.15), hullMat);
    turretFront.position.set(1.1, 1.68, 0);
    turretFront.castShadow = true;
    group.add(turretFront);

    // 炮塔顶部
    const turretTop = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.14, 1.15), hullMat);
    turretTop.position.set(0.35, 1.99, 0);
    turretTop.castShadow = true;
    group.add(turretTop);

    // 炮盾
    const mantlet = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.52, 0.85), hullMatDark);
    mantlet.position.set(1.38, 1.7, 0);
    group.add(mantlet);

    // 主炮管（分段：基部粗 + 主体 + 炮口）
    const barrelBase = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.5, 12), metalMat);
    barrelBase.rotation.z = -Math.PI / 2;
    barrelBase.position.set(1.7, 1.7, 0);
    group.add(barrelBase);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 2.4, 12), metalMat);
    barrel.rotation.z = -Math.PI / 2;
    barrel.position.set(3.15, 1.7, 0);
    barrel.castShadow = true;
    group.add(barrel);

    // 炮口制退器
    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.32, 12), metalMat);
    muzzle.rotation.z = -Math.PI / 2;
    muzzle.position.set(4.35, 1.7, 0);
    group.add(muzzle);

    // 制退器开槽（两个薄环）
    const ringA = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 6, 14), metalMat);
    ringA.rotation.y = Math.PI / 2;
    ringA.position.set(4.42, 1.7, 0);
    group.add(ringA);
    const ringB = ringA.clone();
    ringB.position.x = 4.28;
    group.add(ringB);

    // 车长塔
    const cupola = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.24, 12), hullMat);
    cupola.position.set(-0.25, 2.1, 0.38);
    cupola.castShadow = true;
    group.add(cupola);

    // 车长塔舱盖
    const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.05, 12), hullMatDark);
    hatch.position.set(-0.25, 2.24, 0.38);
    group.add(hatch);

    // 高射机枪
    const mgBase = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.08, 0.15), metalMat);
    mgBase.position.set(-0.25, 2.28, 0.38);
    group.add(mgBase);
    const mgBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 6), metalMat);
    mgBarrel.rotation.z = -Math.PI / 2;
    mgBarrel.position.set(0.1, 2.35, 0.38);
    group.add(mgBarrel);

    // 侧面装甲块
    const side1 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.35, 0.08), hullMatDark);
    side1.position.set(0.3, 1.65, 0.68);
    group.add(side1);
    const side2 = side1.clone();
    side2.position.z = -0.68;
    group.add(side2);

    // 天线
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.4, 4), metalMat);
    antenna.position.set(-0.65, 2.7, -0.4);
    group.add(antenna);

    // 炮塔尾部储物篮
    const basket = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.3, 1.05), hullMatDark);
    basket.position.set(-0.55, 1.55, 0);
    basket.castShadow = true;
    group.add(basket);

  } else {
    // ================ 无炮塔坦克歼击车 ================
    // 战斗室（前部斜甲）
    const casemate = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.62, 1.3), hullMat);
    casemate.position.set(-0.1, 1.6, 0);
    casemate.castShadow = true;
    group.add(casemate);

    // 战斗室前斜装甲
    const casemateFront = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.65, 1.2), hullMatDark);
    casemateFront.rotation.z = -Math.PI / 5;
    casemateFront.position.set(0.85, 1.55, 0);
    casemateFront.castShadow = true;
    group.add(casemateFront);

    // 战斗室顶部
    const casemateTop = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 1.2), hullMat);
    casemateTop.position.set(-0.1, 1.94, 0);
    group.add(casemateTop);

    // 炮盾（球型）
    const mantlet = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), hullMatDark);
    mantlet.position.set(1.15, 1.68, 0);
    mantlet.scale.set(0.7, 1, 1.05);
    group.add(mantlet);

    // 长身管主炮
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 3.0, 12), metalMat);
    barrel.rotation.z = -Math.PI / 2;
    barrel.position.set(2.75, 1.68, 0);
    barrel.castShadow = true;
    group.add(barrel);

    // 炮口制退器
    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.3, 12), metalMat);
    muzzle.rotation.z = -Math.PI / 2;
    muzzle.position.set(4.35, 1.68, 0);
    group.add(muzzle);

    // 舱盖
    const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 12), hullMatDark);
    hatch.position.set(-0.55, 2.02, 0.35);
    group.add(hatch);

    // 潜望镜
    const peri = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.16), metalMat);
    peri.position.set(0.4, 2.02, 0.42);
    group.add(peri);

    // 天线
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.3, 4), metalMat);
    antenna.position.set(-0.9, 2.6, -0.45);
    group.add(antenna);
  }

  return group;
}

/* ==================== 14. 藏匿坦克 ==================== */
function spawnTank() {
  if (!GameState.scene) return;

  const types = ['MBT', 'TD'];
  const type = types[Math.floor(Math.random() * types.length)];
  const tank = createTankModel(type);

  // 藏在距中心较远的位置
  const half = GameState.terrainSize / 2 - 20;
  let x, z, tries = 0;
  do {
    const angle = Math.random() * Math.PI * 2;
    const dist = 35 + Math.random() * (half - 35);
    x = Math.cos(angle) * dist;
    z = Math.sin(angle) * dist;
    tries++;
  } while (Math.abs(x) < 15 && Math.abs(z) < 15 && tries < 20);

  const y = terrainHeight(x, z);
  tank.position.set(x, y, z);
  tank.rotation.y = Math.random() * Math.PI * 2;

  GameState.scene.add(tank);
  GameState.objects.push(tank);
  GameState.targetTank = tank;

  // 雪夜车灯
  if (GameState.currentTheme === 'snow_night') {
    // 主探照灯
    const spot = new THREE.SpotLight(0xfff0c0, 4, 45, Math.PI / 7, 0.55, 1.2);
    spot.position.set(1.4, 1.4, 0.35);

    const target = new THREE.Object3D();
    target.position.set(30, 0, 2);
    tank.add(target);
    spot.target = target;
    tank.add(spot);

    // 副灯（右侧）
    const spot2 = new THREE.SpotLight(0xfff0c0, 2.5, 40, Math.PI / 7, 0.55, 1.2);
    spot2.position.set(1.4, 1.4, -0.35);
    const target2 = new THREE.Object3D();
    target2.position.set(30, 0, -2);
    tank.add(target2);
    spot2.target = target2;
    tank.add(spot2);

    // 发光的灯罩小球
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });
    const lamp1 = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), lampMat);
    lamp1.position.set(1.55, 1.35, 0.35);
    tank.add(lamp1);
    const lamp2 = lamp1.clone();
    lamp2.position.z = -0.35;
    tank.add(lamp2);
  }
}

/* ==================== 15. 雨雪粒子 ==================== */
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
  const count = isRain ? 6000 : 3000;
  const areaSize = GameState.terrainSize * 0.9;
  const topY = 90;

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
    size: isRain ? 1.0 : 1.1,
    map: tex,
    transparent: true,
    opacity: isRain ? 0.55 : 0.95,
    depthWrite: false,
    sizeAttenuation: true,
    blending: isRain ? THREE.NormalBlending : THREE.NormalBlending,
  });

  const pts = new THREE.Points(geo, mat);
  pts.raycast = () => {};   // 不参与点击
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

  const fallSpeed = isRain ? 55 : 5.5;
  const drift = isRain ? 2 : 1.2;
  const topY = 90;

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    arr[i3 + 1] -= fallSpeed * dt;
    arr[i3] += Math.sin((arr[i3 + 1] + i) * 0.35) * drift * dt;

    if (arr[i3 + 1] < 0) {
      arr[i3 + 1] = topY;
      arr[i3] = (Math.random() - 0.5) * GameState.terrainSize * 0.9;
      arr[i3 + 2] = (Math.random() - 0.5) * GameState.terrainSize * 0.9;
    }
  }
  pts.geometry.attributes.position.needsUpdate = true;
}

/* ==================== 16. 点击 → 遮挡判定 ==================== */
function handleCanvasClick(clientX, clientY) {
  if (GameState.phase !== 'playing' || GameState.locked) return;
  if (!GameState.targetTank) return;

  const rect = GameState.renderer.domElement.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((clientY - rect.top) / rect.height) * 2 + 1;

  GameState.pointer.set(x, y);
  GameState.raycaster.setFromCamera(GameState.pointer, GameState.camera);

  // 收集坦克所有网格
  const tankMeshes = [];
  GameState.targetTank.traverse(o => { if (o.isMesh) tankMeshes.push(o); });

  // 先测试是否点在坦克上
  const tankHits = GameState.raycaster.intersectObjects(tankMeshes, false);
  if (tankHits.length === 0) return;

  // 检测遮挡：对全场做射线，看第一个命中的是否为坦克
  const allHits = GameState.raycaster.intersectObjects(GameState.scene.children, true);
  for (const hit of allHits) {
    const obj = hit.object;
    // 跳过无实体意义的辅助对象
    if (obj.isPoints || obj.isSprite) continue;
    if (obj.type === 'SpotLight' || obj.type === 'PointLight' || obj.type === 'DirectionalLight') continue;

    // 判断是否是坦克的子物体
    let n = obj;
    let isTank = false;
    while (n) {
      if (n === GameState.targetTank) { isTank = true; break; }
      n = n.parent;
    }

    if (isTank) {
      triggerWin();
    }
    // 无论第一个命中的是什么，都结束判定
    return;
  }
}

/* ==================== 17. 胜利 ==================== */
function triggerWin() {
  if (GameState.locked) return;
  GameState.locked = true;
  GameState.phase = 'won';

  const elapsed = (performance.now() - GameState.startTime) / 1000;
  GameState.elapsed = elapsed;

  if (typeof playSound === 'function') playSound('fav');

  // 1. "!" 漂浮标记
  const sprite = makeExclamationSprite();
  const tankPos = GameState.targetTank.position.clone();
  sprite.position.set(tankPos.x, tankPos.y + 6, tankPos.z);
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
    sprite,
    tank: GameState.targetTank,
    dir: new THREE.Vector3(dirX, 0, dirZ).normalize(),
    t: 0,
    baseY: tankPos.y,
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

function updateWinAnimation(dt) {
  const w = GameState.winState;
  if (!w) return;
  w.t += dt;

  // 阶段 1：0 ~ 1.0s 显示 !
  if (w.sprite) {
    const bob = Math.sin(w.t * 6) * 0.6;
    w.sprite.position.y = w.baseY + 6.5 + bob;
    const s = 1 + Math.sin(w.t * 8) * 0.12;
    w.sprite.scale.set(4 * s, 8 * s, 1);
  }

  // 阶段 2：1.0s ~ 2.6s 坦克冲出地图
  if (w.t > 1.0 && w.t < 2.6) {
    const speed = 45;
    const step = speed * dt;
    w.tank.position.x += w.dir.x * step;
    w.tank.position.z += w.dir.z * step;
    w.tank.position.y = terrainHeight(w.tank.position.x, w.tank.position.z);

    // 车体朝向运动方向
    const targetRot = Math.atan2(-w.dir.z, w.dir.x);
    // 平滑转向
    let diff = targetRot - w.tank.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    w.tank.rotation.y += diff * Math.min(1, dt * 8);
  }

  // 阶段 3：结束 → 结算
  if (w.t >= 2.6) {
    if (w.sprite) {
      GameState.scene.remove(w.sprite);
      GameState.winSprite = null;
    }
    GameState.winState = null;
    showResult();
  }
}

/* ==================== 18. 结算界面 ==================== */
function showResult() {
  const p = GameState.panel;
  p.querySelector('#ftg-result').style.display = 'flex';

  p.querySelector('#ftg-result-time').textContent = GameState.elapsed.toFixed(2) + 's';

  // 坦克名称
  const tankTypeEl = p.querySelector('#ftg-result-tankname');
  tankTypeEl.textContent = '你找到了一辆藏匿的坦克';

  // 随机推荐一辆站内坦克
  const cardEl = p.querySelector('#ftg-result-card');
  let pick = null;
  try {
    if (typeof tanks !== 'undefined' && tanks.length) {
      pick = tanks[Math.floor(Math.random() * tanks.length)];
    }
  } catch (e) {}

  if (pick) {
    cardEl.style.display = 'block';
    cardEl.innerHTML = `
      <div style="display:flex;gap:12px;align-items:center;">
        <img src="${esc(pick.imgs[0] || '')}" alt=""
             style="width:72px;height:72px;object-fit:contain;background:#1a1a1e;border-radius:10px;flex-shrink:0;"
             onerror="this.style.opacity='0.3'">
        <div style="flex:1;min-width:0;text-align:left;">
          <div style="font-size:15px;font-weight:700;color:#fff;margin-bottom:3px;">${esc(pick.name)}</div>
          <div style="font-size:11px;color:#8a8a92;line-height:1.4;">${esc(getCardInfoSafe(pick))}</div>
          <div style="font-size:11px;color:#ffd83a;margin-top:6px;">点击查看详情 →</div>
        </div>
      </div>
    `;
    cardEl.onclick = () => {
      closeFindTankGame();
      if (typeof showTankDetail === 'function') {
        setTimeout(() => showTankDetail(pick), 120);
      }
    };
    // hover 效果
    cardEl.onmouseenter = () => { cardEl.style.background = 'rgba(255,255,255,0.09)'; cardEl.style.borderColor = 'rgba(255,216,58,0.4)'; };
    cardEl.onmouseleave = () => { cardEl.style.background = 'rgba(255,255,255,0.05)'; cardEl.style.borderColor = 'rgba(255,255,255,0.1)'; };
  } else {
    cardEl.style.display = 'none';
  }

  if (typeof playSound === 'function') playSound('open');
}

/* ==================== 19. 主循环 ==================== */
function startGameLoop() {
  if (GameState.animId) return;
  if (!GameState.clock) GameState.clock = new THREE.Clock();
  GameState.clock.getDelta(); // 重置

  const loop = () => {
    GameState.animId = requestAnimationFrame(loop);
    const dt = Math.min(0.05, GameState.clock.getDelta());

    if (GameState.controls) GameState.controls.update();

    // 计时
    if (GameState.phase === 'playing' && !GameState.locked) {
      GameState.elapsed = (performance.now() - GameState.startTime) / 1000;
      const t = document.getElementById('ftg-timer');
      if (t) t.textContent = GameState.elapsed.toFixed(1);
    }

    // 粒子
    updateParticles(dt);

    // 胜利动画
    if (GameState.winState) updateWinAnimation(dt);

    // 渲染
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

/* ==================== 20. ESC 键 ==================== */
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!GameState.panel || GameState.panel.style.display === 'none') return;
  if (GameState.phase === 'menu') { closeFindTankGame(); return; }
  if (GameState.phase === 'playing') { closeFindTankGame(); return; }
  // 结算界面 → 下一关
  if (GameState.phase === 'won') {
    GameState.level++;
    beginLevel(true);
  }
});

/* ==================== 导出 ==================== */
window.startFindTankGame = startFindTankGame;
window.closeFindTankGame = closeFindTankGame;