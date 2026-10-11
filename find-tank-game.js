// ==================== find-tank-game.js — 找坦克小游戏 ====================

const GameState = {
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  animId: null,
  currentTheme: 'summer', // summer, snow_night, rain
  currentMap: 'forest',   // forest, city, factory, grassland
  targetTank: null,
  allTanks: [],
  objects: [], // 存所有场景物件，方便清理
  panel: null
};

// ---------- 1. 初始化游戏面板（复用你之前的 UI 风格） ----------
function initFindTankGame() {
  if (GameState.panel) return;
  
  // 简单创建一个全屏面板（你可以按需美化）
  const panel = document.createElement('div');
  panel.id = 'find-tank-panel';
  panel.style.cssText = 'position:fixed;inset:0;z-index:400;background:#111;display:none;flex-direction:column;';
  panel.innerHTML = `
    <div style="padding:10px;background:#1a1a1e;color:#fff;display:flex;justify-content:space-between;align-items:center;">
      <span>🔍 寻找坦克 · <span id="game-map-name">草原</span> · <span id="game-theme-name">夏日</span></span>
      <div>
        <button id="game-btn-theme" style="padding:5px 10px;margin-right:10px;">切换天气</button>
        <button id="game-btn-close" style="padding:5px 10px;">关闭</button>
      </div>
    </div>
    <div id="game-canvas-wrap" style="flex:1;position:relative;"></div>
  `;
  document.body.appendChild(panel);
  GameState.panel = panel;

  panel.querySelector('#game-btn-close').addEventListener('click', closeFindTankGame);
  panel.querySelector('#game-btn-theme').addEventListener('click', toggleTheme);
}

// ---------- 2. 游戏入口 ----------
function startFindTankGame() {
  initFindTankGame();
  GameState.panel.style.display = 'flex';
  
  initGameThree();
  generateMap();
  spawnTargetTank();
  startGameLoop();
}

function closeFindTankGame() {
  GameState.panel.style.display = 'none';
  stopGameLoop();
}

// ---------- 3. Three.js 初始化 ----------
function initGameThree() {
  const container = document.getElementById('game-canvas-wrap');
  if (GameState.renderer) return;

  GameState.scene = new THREE.Scene();
  GameState.scene.fog = new THREE.Fog(0xcccccc, 20, 100); // 增加远景雾效，显得更真实

  GameState.camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
  GameState.camera.position.set(0, 15, 25); // 上帝视角/俯视视角

  GameState.renderer = new THREE.WebGLRenderer({ antialias: true });
  GameState.renderer.setSize(container.clientWidth, container.clientHeight);
  GameState.renderer.shadowMap.enabled = true;
  container.appendChild(GameState.renderer.domElement);

  GameState.controls = new THREE.OrbitControls(GameState.camera, GameState.renderer.domElement);
  GameState.controls.enableDamping = true;
  GameState.controls.maxPolarAngle = Math.PI / 2 - 0.1; // 不能钻到地下
  GameState.controls.minDistance = 5;
  GameState.controls.maxDistance = 60;

  // 基础光照
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  GameState.scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(20, 30, 20);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  GameState.scene.add(dirLight);
  
  GameState.dirLight = dirLight; // 存下来供天气切换用
}

// ---------- 4. 清理旧场景 ----------
function clearScene() {
  GameState.objects.forEach(obj => {
    GameState.scene.remove(obj);
    obj.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
  });
  GameState.objects = [];
  GameState.allTanks = [];
  GameState.targetTank = null;
}

// ---------- 5. 核心：自动生成地图 ----------
function generateMap() {
  if (!GameState.scene) return;
  clearScene();

  // 随机选取地图类型和天气
  const maps = ['forest', 'city', 'factory', 'grassland'];
  const themes = ['summer', 'snow_night', 'rain'];
  GameState.currentMap = maps[Math.floor(Math.random() * maps.length)];
  GameState.currentTheme = themes[Math.floor(Math.random() * themes.length)];

  document.getElementById('game-map-name').textContent = 
    {forest:'森林', city:'城市', factory:'工厂', grassland:'草原'}[GameState.currentMap];
  document.getElementById('game-theme-name').textContent = 
    {summer:'夏日', snow_night:'雪夜', rain:'阴雨'}[GameState.currentTheme];

  // 1. 生成地面
  const groundGeo = new THREE.PlaneGeometry(100, 100);
  let groundColor = 0x4a7a3a; // 草原绿
  if (GameState.currentMap === 'city' || GameState.currentMap === 'factory') groundColor = 0x555555;
  if (GameState.currentTheme === 'snow_night') groundColor = 0xeeeeee;
  if (GameState.currentTheme === 'rain') groundColor = 0x333333;

  const groundMat = new THREE.MeshStandardMaterial({ color: groundColor, roughness: 1 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  GameState.scene.add(ground);
  GameState.objects.push(ground);

  // 2. 随机散布物体 (树木或建筑)
  const count = GameState.currentMap === 'forest' ? 80 : 40;
  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * 80;
    const z = (Math.random() - 0.5) * 80;
    // 留出中心区域给玩家或坦克藏身，稍微随机化
    if (Math.abs(x) < 5 && Math.abs(z) < 5) continue;

    if (GameState.currentMap === 'forest' || GameState.currentMap === 'grassland') {
      addTree(x, z);
    } else {
      addBuilding(x, z);
    }
  }
  
  // 应用天气效果
  applyWeatherEffect();
}

// 辅助：生成一棵树
function addTree(x, z) {
  const treeGroup = new THREE.Group();
  const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 2);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1a });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = 1;
  trunk.castShadow = true;
  treeGroup.add(trunk);

  const leafGeo = new THREE.ConeGeometry(1.5, 3, 8);
  let leafColor = 0x2a5a2a;
  if (GameState.currentTheme === 'snow_night') leafColor = 0xffffff; // 雪盖
  if (GameState.currentTheme === 'rain') leafColor = 0x1a3a1a; // 暗绿
  const leafMat = new THREE.MeshStandardMaterial({ color: leafColor });
  const leaf = new THREE.Mesh(leafGeo, leafMat);
  leaf.position.y = 3;
  leaf.castShadow = true;
  treeGroup.add(leaf);

  treeGroup.position.set(x, 0, z);
  // 随机大小和旋转
  treeGroup.scale.setScalar(0.8 + Math.random() * 0.6);
  treeGroup.rotation.y = Math.random() * Math.PI * 2;
  
  GameState.scene.add(treeGroup);
  GameState.objects.push(treeGroup);
}

// 辅助：生成一栋楼
function addBuilding(x, z) {
  const w = 2 + Math.random() * 4;
  const h = 3 + Math.random() * 8;
  const d = 2 + Math.random() * 4;
  
  const geo = new THREE.BoxGeometry(w, h, d);
  let color = 0x888888;
  if (GameState.currentTheme === 'rain') color = 0x444444;
  const mat = new THREE.MeshStandardMaterial({ color: color });
  const box = new THREE.Mesh(geo, mat);
  box.position.set(x, h / 2, z);
  box.castShadow = true;
  box.receiveShadow = true;
  GameState.scene.add(box);
  GameState.objects.push(box);
}

// ---------- 6. 核心：生成坦克模型 (低多边形风格，可自行精细化) ----------
function createTankModel(type) {
  const group = new THREE.Group();
  // 随机涂装颜色（与环境相近，增加寻找难度）
  let baseColor = 0x3a5a3a; // 暗绿
  if (GameState.currentTheme === 'snow_night') baseColor = 0xdddddd; // 白色伪装
  if (GameState.currentTheme === 'rain') baseColor = 0x333333; // 深灰伪装

  const armorMat = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.8 });
  const trackMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });

  // 底盘
  const bodyGeo = new THREE.BoxGeometry(2.4, 0.6, 1.4);
  const body = new THREE.Mesh(bodyGeo, armorMat);
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
    // 主战坦克：有炮塔和炮管
    const turretGeo = new THREE.BoxGeometry(1.2, 0.5, 1.0);
    const turret = new THREE.Mesh(turretGeo, armorMat);
    turret.position.set(-0.2, 1.0, 0);
    turret.castShadow = true;
    group.add(turret);

    const barrelGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.8);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.5 });
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    barrel.rotation.z = -Math.PI / 2;
    barrel.position.set(1.0, 1.0, 0);
    barrel.castShadow = true;
    group.add(barrel);
  } else {
    // 无炮塔坦克歼击车：低矮车体，只有一根炮管
    const barrelGeo = new THREE.CylinderGeometry(0.1, 0.1, 2.0);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    barrel.rotation.z = -Math.PI / 2;
    barrel.position.set(0.8, 0.8, 0);
    barrel.castShadow = true;
    group.add(barrel);
  }

  return group;
}

// ---------- 7. 藏入目标坦克 ----------
function spawnTargetTank() {
  const types = ['MBT', 'TD'];
  const targetType = types[Math.floor(Math.random() * types.length)];
  
  const tank = createTankModel(targetType);
  
  // 随机藏在一个角落或树丛后面
  const angle = Math.random() * Math.PI * 2;
  const dist = 15 + Math.random() * 25; // 距离中心 15-40 单位
  const x = Math.cos(angle) * dist;
  const z = Math.sin(angle) * dist;

  tank.position.set(x, 0, z);
  tank.rotation.y = Math.random() * Math.PI * 2; // 随机朝向
  
  GameState.scene.add(tank);
  GameState.objects.push(tank);
  GameState.targetTank = tank;
  GameState.allTanks.push(tank);

  // 雪夜模式下，给坦克加上车灯（发光光晕）
  if (GameState.currentTheme === 'snow_night') {
    const spotlight = new THREE.SpotLight(0xffffaa, 2, 30, Math.PI / 6, 0.5, 1);
    spotlight.position.set(1, 0.8, 0);
    spotlight.target.position.set(10, 0, 0);
    tank.add(spotlight);
    tank.add(spotlight.target);
  }
}

// ---------- 8. 天气切换效果 ----------
function toggleTheme() {
  const themes = ['summer', 'snow_night', 'rain'];
  const idx = themes.indexOf(GameState.currentTheme);
  GameState.currentTheme = themes[(idx + 1) % themes.length];
  generateMap(); // 重新生成地图并应用新天气
  spawnTargetTank();
}

function applyWeatherEffect() {
  const ambient = GameState.scene.children.find(c => c.isAmbientLight);
  const dir = GameState.dirLight;

  if (GameState.currentTheme === 'summer') {
    GameState.scene.background = new THREE.Color(0x87ceeb); // 天蓝
    GameState.scene.fog.color.setHex(0xcccccc);
    if (ambient) ambient.intensity = 0.7;
    if (dir) { dir.intensity = 0.9; dir.color.setHex(0xffffff); }
  } else if (GameState.currentTheme === 'snow_night') {
    GameState.scene.background = new THREE.Color(0x0a0a1a); // 深夜
    GameState.scene.fog.color.setHex(0x0a0a1a);
    if (ambient) ambient.intensity = 0.2; // 月光微弱
    if (dir) { dir.intensity = 0.3; dir.color.setHex(0xaaccff); }
  } else if (GameState.currentTheme === 'rain') {
    GameState.scene.background = new THREE.Color(0x444455); // 阴霾
    GameState.scene.fog.color.setHex(0x666677);
    if (ambient) ambient.intensity = 0.5;
    if (dir) { dir.intensity = 0.4; dir.color.setHex(0xccccdd); }
  }
}

// ---------- 9. 游戏循环 ----------
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

window.startFindTankGame = startFindTankGame;
window.closeFindTankGame = closeFindTankGame;