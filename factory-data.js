// ==================== factory-data.js ====================
// 静态配置：年代 / 年份 / 物品 / 坦克 / 机器 / 卡车 / 价格 / 订单 / 升级

// ---------- 年代（由具体年份派生） ----------
const F_ERAS = [
  { id:'interwar',  name:'间战期',   from:1919, to:1938 },
  { id:'ww2',       name:'二战',     from:1939, to:1945 },
  { id:'coldEarly', name:'冷战早期', from:1946, to:1965 },
  { id:'coldMid',   name:'冷战中期', from:1966, to:1980 },
  { id:'coldLate',  name:'冷战后期', from:1981, to:1991 },
  { id:'modern',    name:'现代',     from:1992, to:2100 },
];

function fGetEraByYear(y) {
  for (const e of F_ERAS) if (y >= e.from && y <= e.to) return e;
  return F_ERAS[F_ERAS.length - 1];
}
// 第 1 轮 = 1919，每轮 +1 年
function fRoundToYear(round) { return 1918 + round; }

// ---------- 物品 ----------
const F_ITEMS = {
  steel:       { n:'钢材',     c:'#8a8a92' },
  ore:         { n:'矿石',     c:'#6a5a4a' },
  molten:      { n:'钢水',     c:'#ff6a3a' },
  body_light:  { n:'轻型车体', c:'#6a8a6a' },
  body_medium: { n:'中型车体', c:'#5a7a8a' },
  body_heavy:  { n:'重型车体', c:'#8a5a5a' },
  turret:      { n:'炮塔',     c:'#7a7a5a' },
  gun:         { n:'火炮',     c:'#5a5a7a' },
  wheel:       { n:'负重轮',   c:'#4a4a52' },
  engine:      { n:'发动机',   c:'#8a7a4a' },
  ammo:        { n:'弹药',     c:'#a05a3a' },
};

// ---------- 坦克型号 ----------
const F_TANKS = {
  LT_Mk1:  { n:'轻型坦克 Mk.I',  item:'tank_LT_Mk1',  year:1919, type:'LT'  },
  LT_Mk2:  { n:'轻型坦克 Mk.II', item:'tank_LT_Mk2',  year:1930, type:'LT'  },
  MT_Mk1:  { n:'中型坦克 Mk.I',  item:'tank_MT_Mk1',  year:1935, type:'MT'  },
  MT_Mk2:  { n:'中型坦克 Mk.II', item:'tank_MT_Mk2',  year:1940, type:'MT'  },
  HT_Mk1:  { n:'重型坦克 Mk.I',  item:'tank_HT_Mk1',  year:1942, type:'HT'  },
  MT_Mk3:  { n:'中型坦克 Mk.III',item:'tank_MT_Mk3',  year:1946, type:'MT'  },
  MT_Mk4:  { n:'中型坦克 Mk.IV', item:'tank_MT_Mk4',  year:1955, type:'MT'  },
  HT_Mk2:  { n:'重型坦克 Mk.II', item:'tank_HT_Mk2',  year:1960, type:'HT'  },
  MBT_Mk1: { n:'主战坦克 Mk.I',  item:'tank_MBT_Mk1', year:1968, type:'MBT' },
  MBT_Mk2: { n:'主战坦克 Mk.II', item:'tank_MBT_Mk2', year:1980, type:'MBT' },
  MBT_Mk3: { n:'主战坦克 Mk.III',item:'tank_MBT_Mk3', year:1992, type:'MBT' },
  MBT_Mk4: { n:'主战坦克 Mk.IV', item:'tank_MBT_Mk4', year:2005, type:'MBT' },
};
for (const k in F_TANKS) {
  F_ITEMS[F_TANKS[k].item] = { n:F_TANKS[k].n, c:'#c9a860' };
}

// 每辆坦克的组装配方
const F_TANK_RECIPES = {
  LT_Mk1:  { body_light:1, turret:1, gun:1, wheel:4, engine:1, ammo:5  },
  LT_Mk2:  { body_light:1, turret:1, gun:1, wheel:4, engine:1, ammo:6  },
  MT_Mk1:  { body_medium:1,turret:1, gun:1, wheel:4, engine:1, ammo:8  },
  MT_Mk2:  { body_medium:1,turret:1, gun:1, wheel:4, engine:1, ammo:10 },
  HT_Mk1:  { body_heavy:1, turret:1, gun:1, wheel:6, engine:1, ammo:12 },
  MT_Mk3:  { body_medium:1,turret:1, gun:1, wheel:4, engine:1, ammo:12 },
  MT_Mk4:  { body_medium:1,turret:1, gun:1, wheel:4, engine:1, ammo:15 },
  HT_Mk2:  { body_heavy:1, turret:1, gun:1, wheel:6, engine:1, ammo:18 },
  MBT_Mk1: { body_medium:1,turret:1, gun:1, wheel:4, engine:1, ammo:20 },
  MBT_Mk2: { body_medium:1,turret:1, gun:1, wheel:4, engine:1, ammo:22 },
  MBT_Mk3: { body_medium:1,turret:1, gun:1, wheel:4, engine:1, ammo:25 },
  MBT_Mk4: { body_heavy:1, turret:1, gun:1, wheel:6, engine:1, ammo:28 },
};

// ---------- 原料来源 ----------
const F_SOURCES = {
  steel_mill:      { n:'钢厂',     item:'steel',  c:'#a08060', year:1919, travel:12 },
  ore_mine:        { n:'矿场',     item:'ore',    c:'#6a5a4a', year:1919, travel:18 },
  engine_supplier: { n:'发动机厂', item:'engine', c:'#4a6a8a', year:1935, travel:25 },
  ammo_supplier:   { n:'弹药厂',   item:'ammo',   c:'#8a5a3a', year:1935, travel:20 },
};

// ---------- 机器 ----------
const F_MACHINES = {
  welder: {
    n:'焊接机', c:'#5a8a6a', year:1919,
    recipes: {
      body_light:  { n:'轻型车体', in:{steel:2},   out:{body_light:1},  t:1.5, year:1919 },
      turret:      { n:'焊接炮塔', in:{steel:2},   out:{turret:1},      t:1.5, year:1919 },
      gun:         { n:'火炮',     in:{steel:1},   out:{gun:1},         t:1.0, year:1919 },
      wheel:       { n:'负重轮',   in:{steel:0.5}, out:{wheel:1},       t:0.4, year:1919 },
      body_medium: { n:'中型车体', in:{steel:4},   out:{body_medium:1}, t:2.5, year:1935 },
      body_heavy:  { n:'重型车体', in:{steel:6},   out:{body_heavy:1},  t:3.5, year:1942 },
    },
  },
  foundry: {
    n:'铸造机', c:'#a05a3a', year:1946,
    recipes: {
      body_light:  { n:'铸造轻型车体', in:{molten:2}, out:{body_light:1},  t:1.5, year:1946 },
      turret:      { n:'铸造炮塔',     in:{molten:2}, out:{turret:1},      t:2.0, year:1946 },
      gun:         { n:'铸造火炮',     in:{molten:1}, out:{gun:1},         t:1.5, year:1946 },
      body_medium: { n:'铸造中型车体', in:{molten:4}, out:{body_medium:1}, t:2.5, year:1946 },
      body_heavy:  { n:'铸造重型车体', in:{molten:6}, out:{body_heavy:1},  t:3.5, year:1946 },
    },
  },
  smelter: {
    n:'炼钢炉', c:'#8a6a5a', year:1919,
    recipes: {
      molten: { n:'炼钢', in:{ore:1}, out:{molten:1}, t:1.5, year:1919 },
    },
  },
  assembler: {
    n:'组装台', c:'#5a5a8a', year:1919,
    recipes: {},
  },
};
// 组装台配方动态根据 F_TANK_RECIPES 生成
for (const k in F_TANK_RECIPES) {
  const tk = F_TANKS[k];
  F_MACHINES.assembler.recipes[k] = {
    n: tk.n,
    in: F_TANK_RECIPES[k],
    out: { [tk.item]: 1 },
    t: tk.type === 'HT' ? 6 : tk.type === 'MBT' ? 5 : 4,
    year: tk.year,
  };
}

// ---------- 卡车 ----------
const F_TRUCKS = {
  type_a:      { n:'战地运输车 Type-A',   c:'#8a7a5a', cap:10, speed:70,  year:1919 },
  type_b:      { n:'轻型运输车 Type-B',   c:'#7a6a4a', cap:12, speed:80,  year:1928 },
  type_c:      { n:'标准军用卡车 Type-C', c:'#6a6a5a', cap:15, speed:85,  year:1936 },
  type_d:      { n:'重型运输车 Type-D',   c:'#5a5a5a', cap:22, speed:75,  year:1942 },
  type_e:      { n:'战后运输车 Type-E',   c:'#5a6a7a', cap:20, speed:90,  year:1948 },
  aozv_20311:  { n:'Aozv 20311',          c:'#4a6a8a', cap:30, speed:95,  year:1955 },
  aozv_20400:  { n:'Aozv 20400',          c:'#4a6a8a', cap:35, speed:100, year:1965 },
  aozv_20750:  { n:'Aozv 20750',          c:'#3a5a7a', cap:45, speed:110, year:1978 },
  aozv_21100:  { n:'Aozv 21100',          c:'#3a5a7a', cap:60, speed:130, year:1990 },
  aozv_22000:  { n:'Aozv 22000',          c:'#2a4a6a', cap:80, speed:140, year:2000 },
};

// ---------- 价格 ----------
const F_PRICES = {
  warehouse:  2000,
  welder:     2500,
  foundry:    3000,
  smelter:    2800,
  assembler:  2000,
  type_a:     1500,
  type_b:     1800,
  type_c:     2500,
  type_d:     4000,
  type_e:     3500,
  aozv_20311: 6000,
  aozv_20400: 7500,
  aozv_20750: 12000,
  aozv_21100: 20000,
  aozv_22000: 30000,
};

// ---------- 订单池（真实历史年份） ----------
const F_ORDER_POOL = [
  // 间战期
  { era:'interwar',  year:1919, tanks:{LT_Mk1:1},                reward:3000,   time:8  },
  { era:'interwar',  year:1925, tanks:{LT_Mk1:2},                reward:6000,   time:12 },
  { era:'interwar',  year:1930, tanks:{LT_Mk1:2,LT_Mk2:1},       reward:9000,   time:14 },
  { era:'interwar',  year:1935, tanks:{MT_Mk1:1,LT_Mk2:1},       reward:11000,  time:15 },
  { era:'interwar',  year:1938, tanks:{MT_Mk1:2},                reward:12000,  time:16 },
  // 二战
  { era:'ww2',       year:1939, tanks:{LT_Mk2:3},                reward:13000,  time:14 },
  { era:'ww2',       year:1940, tanks:{MT_Mk2:2},                reward:15000,  time:14 },
  { era:'ww2',       year:1941, tanks:{MT_Mk1:3,LT_Mk2:2},       reward:22000,  time:18 },
  { era:'ww2',       year:1942, tanks:{HT_Mk1:1,MT_Mk2:2},       reward:28000,  time:20 },
  { era:'ww2',       year:1943, tanks:{MT_Mk2:4},                reward:32000,  time:20 },
  { era:'ww2',       year:1944, tanks:{HT_Mk1:3,MT_Mk2:2},       reward:48000,  time:24 },
  { era:'ww2',       year:1945, tanks:{HT_Mk1:4},                reward:52000,  time:24 },
  // 冷战早期
  { era:'coldEarly', year:1946, tanks:{MT_Mk3:2},                reward:18000,  time:14 },
  { era:'coldEarly', year:1950, tanks:{MT_Mk3:3},                reward:28000,  time:18 },
  { era:'coldEarly', year:1953, tanks:{MT_Mk3:4},                reward:38000,  time:20 },
  { era:'coldEarly', year:1955, tanks:{MT_Mk4:2},                reward:24000,  time:16 },
  { era:'coldEarly', year:1958, tanks:{MT_Mk4:4},                reward:50000,  time:22 },
  { era:'coldEarly', year:1960, tanks:{HT_Mk2:2},                reward:32000,  time:18 },
  { era:'coldEarly', year:1962, tanks:{HT_Mk2:3,MT_Mk4:2},       reward:56000,  time:24 },
  { era:'coldEarly', year:1965, tanks:{MT_Mk4:5},                reward:64000,  time:24 },
  // 冷战中期
  { era:'coldMid',   year:1968, tanks:{MBT_Mk1:2},               reward:36000,  time:18 },
  { era:'coldMid',   year:1970, tanks:{MBT_Mk1:3},               reward:52000,  time:20 },
  { era:'coldMid',   year:1973, tanks:{MBT_Mk1:4,MT_Mk4:2},      reward:72000,  time:24 },
  { era:'coldMid',   year:1976, tanks:{MBT_Mk1:5},               reward:88000,  time:26 },
  { era:'coldMid',   year:1980, tanks:{MBT_Mk2:2},               reward:46000,  time:18 },
  // 冷战后期
  { era:'coldLate',  year:1982, tanks:{MBT_Mk2:3},               reward:68000,  time:22 },
  { era:'coldLate',  year:1985, tanks:{MBT_Mk2:4},               reward:88000,  time:24 },
  { era:'coldLate',  year:1988, tanks:{MBT_Mk2:5},               reward:108000, time:26 },
  { era:'coldLate',  year:1991, tanks:{MBT_Mk2:6},               reward:130000, time:28 },
  // 现代
  { era:'modern',    year:1992, tanks:{MBT_Mk3:2},               reward:60000,  time:18 },
  { era:'modern',    year:1999, tanks:{MBT_Mk3:4},               reward:120000, time:24 },
  { era:'modern',    year:2005, tanks:{MBT_Mk4:2},               reward:80000,  time:20 },
  { era:'modern',    year:2010, tanks:{MBT_Mk4:4},               reward:160000, time:26 },
  { era:'modern',    year:2015, tanks:{MBT_Mk4:6},               reward:240000, time:30 },
];

// ---------- 订单名称（真实历史事件） ----------
const F_ORDER_NAMES_BY_YEAR = {
  1919: ['一战后重建装甲','边境治安巡逻'],
  1925: ['本土防卫部队','机械化实验'],
  1930: ['装甲兵扩充计划','边防军订单'],
  1935: ['新式坦克试验','机械化步兵'],
  1938: ['边境防卫预备','军备扩充'],
  1939: ['波兰战役装甲补充','秋季作战准备'],
  1940: ['法国战役紧急订单','西线装甲补充'],
  1941: ['巴巴罗萨行动装备','东线前线订单'],
  1942: ['斯大林格勒前线','冬季反攻准备'],
  1943: ['库尔斯克装甲预备','夏季攻势准备'],
  1944: ['诺曼底登陆准备','东西两线补充'],
  1945: ['柏林攻坚补充','最后攻势'],
  1946: ['战后重建装甲','占领军装备'],
  1950: ['朝鲜战场紧急订单','远东装甲补充'],
  1953: ['北约驻军装备','西欧防线'],
  1955: ['新一代坦克采购','华约应对'],
  1958: ['中东驻军订单','苏伊士危机应对'],
  1960: ['柏林危机应对','欧洲驻军采购'],
  1962: ['古巴导弹危机准备','加勒比战备'],
  1965: ['越南战场装甲','东南亚驻军'],
  1968: ['布拉格之春应对','欧洲装甲集群'],
  1970: ['西德驻军采购','北约联合演习'],
  1973: ['赎罪日战争补充','中东紧急订单'],
  1976: ['北方边境防御','北欧驻军装备'],
  1980: ['快速反应部队','波斯湾战备'],
  1982: ['马岛战争装备','福克兰远征'],
  1985: ['北约联合演习','中欧装甲'],
  1988: ['两伊战争出口','中东出口订单'],
  1991: ['海湾战争订单','沙漠风暴行动'],
  1992: ['维和部队装备','冷战结束裁军'],
  1999: ['科索沃行动','巴尔干部署'],
  2005: ['伊拉克自由行动','反恐装备'],
  2010: ['多国联合军演','北约现代化'],
  2015: ['边境防卫采购','东部边境增援'],
};

function fMakeOrderName(year) {
  let pool = F_ORDER_NAMES_BY_YEAR[year];
  if (!pool) {
    // 回退：找最接近的年份
    const keys = Object.keys(F_ORDER_NAMES_BY_YEAR).map(Number).sort((a,b)=>a-b);
    let nearest = keys[0];
    for (const k of keys) if (Math.abs(k - year) < Math.abs(nearest - year)) nearest = k;
    pool = F_ORDER_NAMES_BY_YEAR[nearest];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

// ---------- 永久升级（跨轮继承） ----------
const F_UPGRADES = {
  warehouseCapacity: {
    n:'仓库容量', lv:[100,150,220,300,500],
    cost:[0,3000,8000,18000,40000],
  },
  truckCapacity: {
    n:'卡车容量', lv:[1.0,1.15,1.3,1.5,2.0],
    cost:[0,3000,8000,18000,40000],
  },
};

// ---------- 工具函数（供 UI 层调用） ----------
// 返回当前年份下所有解锁的坦克型号 key
function fUnlockedTanks(year) {
  return Object.keys(F_TANKS).filter(k => F_TANKS[k].year <= year);
}
// 返回当前年份下所有解锁的卡车型号 key
function fUnlockedTrucks(year) {
  return Object.keys(F_TRUCKS).filter(k => F_TRUCKS[k].year <= year);
}
// 返回机器某配方的可选项（只显示已解锁）
function fMachineOptions(machineType, year) {
  const def = F_MACHINES[machineType];
  if (!def) return [];
  return Object.keys(def.recipes).filter(k => def.recipes[k].year <= year);
}