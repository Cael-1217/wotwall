// ==================== find-tank-game.js — 找坦克小游戏（修复版） ====================

const GameState = {
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  animId: null,
  currentTheme: 'summer',   // summer | snow_night | rain
  currentMap: 'forest',     // forest | city | factory | grassland
  targetTank: null,
  objects: [],
  panel: null,
  dirLight: null,
  ambientLight: null,
  starting: false,
};

// 本地库路径（仓库根目录）
const GAME_LIB_PATHS = {
  three: 'three.min.js',
  orbit: 'OrbitControls.js',
};

/* ============ 工具函数 ============ */

function _nextFrame() {
  return new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

function _loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === '1') return resolve();
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('加载失败: ' + src)));
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
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
    throw new Error('Three.js 加载失败：请确认 three.min.js 位于仓库根目录');
  }
  if (!window.THREE.OrbitControls) {
    try { await _loadScriptOnce(GAME_LIB_PATHS.orbit); }
    catch (e) { console.warn('[find-tank] OrbitControls 未加载，将使用固定视角'); }
  }
}

/* ============ 1. 面板 ============ */

function initFindTankGame() {
  if (GameState.panel) return GameState.panel;

  const panel = document.createElement('div');
  panel.id = 'find-tank-panel';
  panel.style.cssText = 'position:fixed;inset:0;z-index:400;background:#111;display:none;flex-direction:column;';

  panel.innerHTML = `
    <div style="padding:10px;background:#1a1a1e;color:#fff;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-shrink:0;">
      <span style="font-size:14px;">🔍 寻找坦克 · <span id="game-map-name">—</span> · <span id="game-theme-name">—</span></span>
      <div style="display:flex;gap:8px;">
        <button id="game-btn-theme" style="padding:6px 12px;border-radius:6px;border:1px solid #3a3a40;background:#2a2a2e;color:#e8e8ea;font-family:inherit;font-size:13px;cursor:pointer;">切换天气</button>
        <button id="game-btn-close" style="padding:6px 12px;border-radius:6px;border:1px solid #3a3a40;background:#2a2a2e;color:#e8e8ea;font-family:inherit;font-size:13px;cursor:pointer;">关闭</button>
      </div>
    </div>
    <div id="game-canvas-wrap" style="flex:1 1 auto;position:relative;min-height:0;overflow:hidden;background:#000;">
      <div id="game-error-overlay" style="display:none;position:absolute;top:0;left:0;right:0;bottom:0;z-index:10;align-items:center;justify-content:center;background:rgba(17,17,17,0.92);color:#ff8a8a;font-size:14px;padding:24px;text-align:center;white-space:pre-wrap;line-height:1.6;"></div>
    </div>
  `;
  document.body.appendChild(panel);
  GameState.panel = panel;

  panel.querySelector('#game-btn-close').addEventListener('click', closeFindTankGame);
  panel.querySelector('#game-btn-theme').addEventListener('click', toggleTheme);

  // 窗口 / 容器尺寸变化时同步
  window.addEventListener('resize', () => {
    if (panel.style.display !== 'none') updateGameViewport();
  });
  const container = panel.querySelector('#game-canvas-wrap');
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(() => {
      if (panel.style.display !== 'none') updateGameViewport();
    });
    ro.observe(container);
  }

  return panel;
}

function showGameError(msg) {
  const overlay = document.getElementById('game-error-overlay');
  if (!overlay) return;
  overlay.textContent = '⚠ 游戏启动失败\n\n' + msg;
  overlay.style.display = 'flex';
}
function hideGameError() {
  const overlay = document.getElementById('game-error-overlay');
  if (overlay) overlay.style.display = 'none';
}

/* ============ 2. 入口（异步） ============ */

async function startFindTankGame() {
  if (GameState.starting) return;
  GameState.starting = true;

  try {
    const panel = initFindTankGame();
    panel.style.display = 'flex';
    hideGameError();

    // 关键：等一帧，让 flex 尺寸生效
    await _nextFrame();

    // 关键：确保 Three.js 已加载（本地根目录）
    await ensureThreeLibs();

    // 初始化 3D 环境（幂等）
    initGameThree();

    // 每次进入都随机生成新地图
    generateMap();
    spawnTargetTank();

    if (!GameState.animId) startGameLoop();
  } catch (err) {
    console.error('[find-tank] 启动失败:', err);
    showGameError((err && err.message) ? err.message : String(err));
  } finally {
    GameState.starting = false;
  }
}

function closeFindTankGame() {
  if (!GameState.panel) return;
  GameState.panel.style.display = 'none';
  stopGameLoop();
}

/* ============ 3. 视口同步 ============ */

function updateGameViewport() {
  const container = document.getElementById('game-canvas-wrap');
  if (!container) return;
  const w = Math.max(1, container.clientWidth);
  const h = Math.max(1, container.clientHeight);
  if (GameState.renderer) GameState.renderer.setSize(w, h);
  if (GameState.camera) {
    GameState.camera.aspect = w / h;
    GameState.camera.updateProjectionMatrix();
  }
}

/* ============ 4. Three.js 初始化 ============ */

function initGameThree() {
  const container = document.getElementById('game-canvas-wrap');
  if (!container) throw new Error('找不到 #game-canvas-wrap 容器');

  if (!GameState.renderer) {
    GameState.scene = new THREE.Scene();
    GameState.scene.background = new THREE.Color(0x87ceeb);

    GameState.camera = new THREE.PerspectiveCamera(55, 1, 0.5, 500);
    GameState.camera.position.set(25, 30, 35);
    GameState.camera.lookAt(0, 0, 0);

    GameState.renderer = new THREE.WebGLRenderer({ antialias: true });
    GameState.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    GameState.renderer.shadowMap.enabled = true;
    GameState.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(GameState.renderer.domElement);

    if (THREE.OrbitControls) {
      GameState.controls = new THREE.OrbitControls(GameState.camera, GameState.renderer.domElement);
      GameState.controls.enableDamping = true;
      GameState.controls.dampingFactor = 0.08;
      GameState.controls.maxPolarAngle = Math.PI / 2 - 0.05;
      GameState.controls.minDistance = 8;
      GameState.controls.maxDistance = 80;
      GameState.controls.target.set(0, 0, 0);
      GameState.controls.update();
    }

    GameState.ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    GameState.scene.add(GameState.ambientLight);

    GameState.dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    GameState.dirLight.position.set(30, 40, 20);
    GameState.dirLight.castShadow = true;
    GameState.dirLight.shadow.mapSize.width = 1024;
    GameState.dirLight.shadow.mapSize.height = 1024;
    const d = 60;
    GameState.dirLight.shadow.camera.left = -d;
    GameState.dirLight.shadow.camera.right = d;
    GameState.dirLight.shadow.camera.top = d;
    GameState.dirLight.shadow.camera.bottom = -d;
    GameState.dirLight.shadow.camera.near = 1;
    GameState.dirLight.shadow.camera.far = 200;
    GameState.scene.add(GameState.dirLight);
    GameState.scene.add(GameState.dirLight.target);
  }

  updateGameViewport();
}

/* ============ 5. 清场 ============ */

function clearScene() {
  if (!GameState.scene) return;
  GameState.objects.forEach(obj => {
    GameState.scene.remove(obj);
    if (obj.traverse) {
      obj.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach(m => m.dispose && m.dispose());
          else if (child.material.dispose) child.material.dispose();
        }
      });
    }
  });
  GameState.objects = [];
  GameState.targetTank = null;
}

/* ============ 6. 生成地图 ============ */

function generateMap(forceTheme) {
  if (!GameState.scene) return;
  clearScene();

  const maps = ['forest', 'city', 'factory', 'grassland'];
  const themes = ['summer', 'snow_night', 'rain'];

  GameState.currentMap = maps[Math.floor(Math.random() * maps.length)];
  // ⚠️ 修复：如果传了 forceTheme 就用它，否则随机
  GameState.currentTheme = forceTheme || themes[Math.floor(Math.random() * themes.length)];

  const mapNames = { forest: '森林', city: '城市', factory: '工厂', grassland: '草原' };
  const themeNames = { summer: '夏日', snow_night: '雪夜', rain: '阴雨' };
  const mapEl = document.getElementById('game-map-name');
  const themeEl = document.getElementById('game-theme-name');
  if (mapEl) mapEl.textContent = mapNames[GameState.currentMap];
  if (themeEl) themeEl.textContent = themeNames[GameState.currentTheme];

  // 地面
  const groundGeo = new THREE.PlaneGeometry(100, 100);
  let groundColor = 0x4a7a3a;
  if (GameState.currentMap === 'city' || GameState.currentMap === 'factory') groundColor = 0x555555;
  if (GameState.currentTheme === 'snow_night') groundColor = 0xeeeeee;
  if (GameState.currentTheme === 'rain') groundColor = 0x333333;

  const groundMat = new THREE.MeshStandardMaterial({ color: groundColor, roughness: 1 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  GameState.scene.add(ground);
  GameState.objects.push(ground);

  // 散布物体
  const count = GameState.currentMap === 'forest' ? 80 : 40;
  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * 80;
    const z = (Math.random() - 0.5) * 80;
    if (Math.abs(x) < 5 && Math.abs(z) < 5) continue;
    if (GameState.currentMap === 'forest' || GameState.currentMap === 'grassland') {
      addTree(x, z);
    } else {
      addBuilding(x, z);
    }
  }

  applyWeatherEffect();
}

function addTree(x, z) {
  const treeGroup = new THREE.Group();

  const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 2, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1a });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = 1;
  trunk.castShadow = true;
  treeGroup.add(trunk);

  const leafGeo = new THREE.ConeGeometry(1.5, 3, 8);
  let leafColor = 0x2a5a2a;
  if (GameState.currentTheme === 'snow_night') leafColor = 0xe8f0ff;
  if (GameState.currentTheme === 'rain') leafColor = 0x1a3a1a;
  const leafMat = new THREE.MeshStandardMaterial({ color: leafColor });
  const leaf = new THREE.Mesh(leafGeo, leafMat);
  leaf.position.y = 3;
  leaf.castShadow = true;
  treeGroup.add(leaf);

  treeGroup.position.set(x, 0, z);
  treeGroup.scale.setScalar(0.8 + Math.random() * 0.6);
  treeGroup.rotation.y = Math.random() * Math.PI * 2;

  GameState.scene.add(treeGroup);
  GameState.objects.push(treeGroup);
}

function addBuilding(x, z) {
  const w = 2 + Math.random() * 4;
  const h = 3 + Math.random() * 8;
  const d = 2 + Math.random() * 4;

  const geo = new THREE.BoxGeometry(w, h, d);
  let color = 0x888888;
  if (GameState.currentTheme === 'rain') color = 0x444444;
  if (GameState.currentTheme === 'snow_night') color = 0x9a9aae;
  const mat = new THREE.MeshStandardMaterial({ color });
  const box = new THREE.Mesh(geo, mat);
  box.position.set(x, h / 2, z);
  box.castShadow = true;
  box.receiveShadow = true;
  GameState.scene.add(box);
  GameState.objects.push(box);
}

/* ============ 7. 坦克模型 ============ */

function createTankModel(type) {
  const group = new THREE.Group();

  let baseColor = 0x3a5a3a;
  if (GameState.currentTheme === 'snow_night') baseColor = 0xd8d8e0;
  if (GameState.currentTheme === 'rain') baseColor = 0x333333;

  const armorMat = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.8 });
  const trackMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });

  // 底盘
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.6, 1.4), armorMat);
  body.position.y = 0.5;
  body.castShadow = true;
  group.add(body);

  // 履带
  const trackGeo = new THREE.BoxGeometry(2.6, 0.4, 0.3);
  const trackL = new THREE.Mesh(trackGeo, trackMat);
  trackL.position.set(0, 0.2, 0.8);
  trackL.castShadow = true;
  group.add(trackL);
  const trackR = new THREE.Mesh(trackGeo, trackMat);
  trackR.position.set(0, 0.2, -0.8);
  trackR.castShadow = true;
  group.add(trackR);

  if (type === 'MBT') {
    // 炮塔
    const turret = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 1.0), armorMat);
    turret.position.set(-0.2, 1.0, 0);
    turret.castShadow = true;
    group.add(turret);

    // 炮管
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.5, roughness: 0.5 });
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.8, 8), barrelMat);
    barrel.rotation.z = -Math.PI / 2;
    barrel.position.set(1.0, 1.0, 0);
    barrel.castShadow = true;
    group.add(barrel);
  } else {
    // TD：无炮塔，低矮车体 + 一根炮管
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.0, 8), barrelMat);
    barrel.rotation.z = -Math.PI / 2;
    barrel.position.set(0.8, 0.8, 0);
    barrel.castShadow = true;
    group.add(barrel);
  }

  return group;
}

/* ============ 8. 藏匿目标坦克 ============ */

function spawnTargetTank() {
  if (!GameState.scene) return;

  const types = ['MBT', 'TD'];
  const targetType = types[Math.floor(Math.random() * types.length)];
  const tank = createTankModel(targetType);

  const angle = Math.random() * Math.PI * 2;
  const dist = 15 + Math.random() * 25;
  const x = Math.cos(angle) * dist;
  const z = Math.sin(angle) * dist;

  tank.position.set(x, 0, z);
  tank.rotation.y = Math.random() * Math.PI * 2;

  GameState.scene.add(tank);
  GameState.objects.push(tank);
  GameState.targetTank = tank;

  // 雪夜：车灯亮起
  if (GameState.currentTheme === 'snow_night') {
    const spot = new THREE.SpotLight(0xffffcc, 3, 30, Math.PI / 6, 0.5, 1);
    spot.position.set(1, 0.8, 0);
    tank.add(spot);

    const target = new THREE.Object3D();
    target.position.set(12, 0, 0);
    tank.add(target);
    spot.target = target;
  }
}

/* ============ 9. 天气切换 ============ */

function toggleTheme() {
  const themes = ['summer', 'snow_night', 'rain'];
  const idx = themes.indexOf(GameState.currentTheme);
  const next = themes[(idx + 1) % themes.length];
  generateMap(next);   // 强制使用指定主题
  spawnTargetTank();
}

function applyWeatherEffect() {
  if (!GameState.scene) return;
  const ambient = GameState.ambientLight;
  const dir = GameState.dirLight;

  if (GameState.currentTheme === 'summer') {
    GameState.scene.background = new THREE.Color(0x87ceeb);
    if (GameState.scene.fog) GameState.scene.fog.color.setHex(0xcccccc);
    if (ambient) ambient.intensity = 0.7;
    if (dir) { dir.intensity = 0.9; dir.color.setHex(0xffffff); }
  } else if (GameState.currentTheme === 'snow_night') {
    GameState.scene.background = new THREE.Color(0x0a0a1a);
    if (GameState.scene.fog) GameState.scene.fog.color.setHex(0x0a0a1a);
    if (ambient) ambient.intensity = 0.2;
    if (dir) { dir.intensity = 0.3; dir.color.setHex(0xaaccff); }
  } else if (GameState.currentTheme === 'rain') {
    GameState.scene.background = new THREE.Color(0x444455);
    if (GameState.scene.fog) GameState.scene.fog.color.setHex(0x666677);
    if (ambient) ambient.intensity = 0.5;
    if (dir) { dir.intensity = 0.4; dir.color.setHex(0xccccdd); }
  }
}

/* ============ 10. 主循环 ============ */

function startGameLoop() {
  if (GameState.animId) return;
  const loop = () => {
    GameState.animId = requestAnimationFrame(loop);
    if (GameState.controls) GameState.controls.update();
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

/* ============ 导出到全局 ============ */
window.startFindTankGame = startFindTankGame;
window.closeFindTankGame = closeFindTankGame;