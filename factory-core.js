// ==================== factory-core.js ====================
// 状态 / 存档 / 生产 / 卡车 / 订单 / 时间推进

const FGame = {
  data: null,
  view: { x: 0, y: 0, scale: 1 },
  dragging: null,
  running: false,
  lastTime: 0,
  autoSaveAcc: 0,
  uid: 1,
  roundEndCallback: null,
};

const F_SAVE_KEY = 'tw_factory_v1';

function fUid() { return 'u_' + (FGame.uid++); }
function fCurYear() {
  return FGame.data ? fRoundToYear(FGame.data.round) : 1919;
}

// ---------- 存档 ----------
function fNewState(slot, name) {
  return {
    slot, name: name || ('存档 ' + slot),
    round: 1, completedOrders: 0,
    money: 5000, gameTime: 0, timeScale: 1, paused: false,
    machines: [], warehouses: [], trucks: [], sources: [],
    activeOrders: [], availableOrders: [],
    permanent: { warehouseCapacity: 0, truckCapacity: 0 },
    tutorialDone: false,
    autoSaveInterval: 60,
    createdAt: Date.now(),
  };
}
function fLoadAll() {
  try { return JSON.parse(localStorage.getItem(F_SAVE_KEY)) || { slots: {} }; }
  catch (e) { return { slots: {} }; }
}
function fSaveAll(all) {
  try { localStorage.setItem(F_SAVE_KEY, JSON.stringify(all)); } catch (e) {}
}
function fSaveSlot(slot, data) {
  const all = fLoadAll();
  all.slots[slot] = data;
  all.slots[slot].savedAt = Date.now();
  fSaveAll(all);
}
function fLoadSlot(slot) {
  const all = fLoadAll();
  return all.slots[slot] || null;
}
function fDeleteSlot(slot) {
  const all = fLoadAll();
  delete all.slots[slot];
  fSaveAll(all);
}
function fAutoSave() {
  if (!FGame.data) return;
  fSaveSlot(FGame.data.slot, FGame.data);
}

// ---------- 容量 ----------
function fWhCapacity(wh) {
  const lv = FGame.data.permanent.warehouseCapacity || 0;
  return F_UPGRADES.warehouseCapacity.lv[lv] || 100;
}
function fTruckCapacity(truck) {
  const base = (F_TRUCKS[truck.type] && F_TRUCKS[truck.type].cap) || 10;
  const mul = F_UPGRADES.truckCapacity.lv[FGame.data.permanent.truckCapacity || 0] || 1;
  return Math.floor(base * mul);
}

// ---------- 仓库读写 ----------
function fWhTotal(wh) {
  let t = 0;
  for (const k in wh.items) t += wh.items[k] || 0;
  return t;
}
function fWhAdd(wh, item, qty) {
  const cap = fWhCapacity(wh);
  const cur = fWhTotal(wh);
  const can = Math.min(qty, cap - cur);
  if (can <= 0) return 0;
  wh.items[item] = (wh.items[item] || 0) + can;
  return can;
}
function fWhTakeAny(input) {
  for (const item in input) {
    let total = 0;
    for (const wh of FGame.data.warehouses) total += wh.items[item] || 0;
    if (total < input[item]) return false;
  }
  for (const item in input) {
    let remain = input[item];
    for (const wh of FGame.data.warehouses) {
      if (remain <= 0) break;
      const have = wh.items[item] || 0;
      const take = Math.min(have, remain);
      wh.items[item] = have - take;
      remain -= take;
    }
  }
  return true;
}

// ---------- 机器生产 ----------
function fTickMachines(gameDt) {
  if (!FGame.data.warehouses.length) return;
  const year = fCurYear();

  for (const m of FGame.data.machines) {
    if (!m.recipe) continue;
    const def = F_MACHINES[m.type];
    if (!def) continue;
    const rec = def.recipes[m.recipe];
    if (!rec) continue;

    // 如果选中的配方还没解锁（旧存档），跳过
    if (rec.year > year) { m.blockedYear = true; continue; }
    m.blockedYear = false;

    if (!m.producing) {
      if (fWhTakeAny(rec.in)) { m.producing = true; m.progress = 0; m.waiting = false; }
      else { m.waiting = true; continue; }
    }
    if (m.producing) {
      m.progress += gameDt;
      if (m.progress >= rec.t) {
        const wh = FGame.data.warehouses[0];
        let ok = true;
        for (const item in rec.out) {
          if (fWhAdd(wh, item, rec.out[item]) < rec.out[item]) { ok = false; break; }
        }
        if (ok) { m.producing = false; m.progress = 0; }
        else { m.progress = rec.t; m.blocked = true; }
      }
    }
  }
}

// ---------- 卡车 ----------
function fTickTrucks(gameDt) {
  if (!FGame.data.warehouses.length) return;
  const wh = FGame.data.warehouses[0];
  for (const t of FGame.data.trucks) {
    const src = FGame.data.sources.find(s => s.id === t.sourceId);
    if (!src) continue;
    const srcDef = F_SOURCES[src.type];
    if (!srcDef) continue;
    const sp = { x: src.x, y: src.y };
    const wp = { x: wh.x, y: wh.y };
    const tdef = F_TRUCKS[t.type];
    if (!tdef) continue;

    switch (t.state) {
      case 'going':
        fMoveTo(t, sp, tdef.speed, gameDt);
        if (fArrive(t, sp)) { t.state = 'loading'; t.timer = 1.2; }
        break;
      case 'loading':
        t.timer -= gameDt;
        if (t.timer <= 0) {
          t.cargo = { item: srcDef.item, qty: fTruckCapacity(t) };
          t.state = 'returning';
        }
        break;
      case 'returning':
        fMoveTo(t, wp, tdef.speed, gameDt);
        if (fArrive(t, wp)) { t.state = 'unloading'; t.timer = 0.6; }
        break;
      case 'unloading':
        t.timer -= gameDt;
        if (t.timer <= 0) {
          if (t.cargo.item) fWhAdd(wh, t.cargo.item, t.cargo.qty);
          t.cargo = { item: null, qty: 0 };
          t.state = 'going';
        }
        break;
    }
  }
}
function fMoveTo(o, tgt, speed, dt) {
  const dx = tgt.x - o.x, dy = tgt.y - o.y;
  const d = Math.hypot(dx, dy);
  if (d < 1) return;
  const step = speed * dt;
  if (step >= d) { o.x = tgt.x; o.y = tgt.y; return; }
  o.x += dx / d * step;
  o.y += dy / d * step;
}
function fArrive(o, tgt) { return Math.hypot(o.x - tgt.x, o.y - tgt.y) < 4; }

// ---------- 订单 ----------
function fTickOrders(gameDt) {
  if (!FGame.data.activeOrders.length) return;
  for (let i = FGame.data.activeOrders.length - 1; i >= 0; i--) {
    const o = FGame.data.activeOrders[i];
    o.timeLeft -= gameDt;
    if (fOrderComplete(o)) {
      fCompleteOrder(o, i);
    } else if (o.timeLeft <= 0) {
      fFailOrder(o, i);
    }
  }
}
function fOrderComplete(o) {
  for (const tk in o.tanks) {
    const item = F_TANKS[tk] && F_TANKS[tk].item;
    if (!item) return false;
    let total = 0;
    for (const wh of FGame.data.warehouses) total += wh.items[item] || 0;
    if (total < o.tanks[tk]) return false;
  }
  return true;
}
function fCompleteOrder(o, i) {
  for (const tk in o.tanks) {
    const item = F_TANKS[tk].item;
    let remain = o.tanks[tk];
    for (const wh of FGame.data.warehouses) {
      if (remain <= 0) break;
      const have = wh.items[item] || 0;
      const take = Math.min(have, remain);
      wh.items[item] = have - take;
      remain -= take;
    }
  }
  FGame.data.money += o.reward;
  FGame.data.completedOrders++;
  FGame.data.activeOrders.splice(i, 1);
  if (typeof fUIToast === 'function') fUIToast('订单完成 +' + o.reward);
  if (FGame.data.activeOrders.length === 0) fEndRound(false);
}

// ★ 超时扣 75% 报酬
function fFailOrder(o, i) {
  const penalty = Math.floor(o.reward * 0.75);
  FGame.data.money -= penalty;
  FGame.data.activeOrders.splice(i, 1);
  if (typeof fUIToast === 'function') fUIToast('订单超时 -' + penalty);
  if (FGame.data.activeOrders.length === 0) fEndRound(true);
}

function fEndRound(failed) {
  FGame.data.paused = true;
  // 破产检查
  let bankrupt = false;
  if (FGame.data.money < 0) {
    bankrupt = true;
    FGame.data.money = 1000; // 保底
  }
  fAutoSave();
  if (typeof fUIShowRoundEnd === 'function') {
    fUIShowRoundEnd({ failed, bankrupt, year: fCurYear(), round: FGame.data.round });
  }
}

// ---------- 下一轮 ----------
function fNextRound() {
  FGame.data.round++;
  const year = fCurYear();
  FGame.data.gameTime = 0;
  FGame.data.timeScale = 1;
  FGame.data.paused = false;
  FGame.data.activeOrders = [];
  FGame.data.availableOrders = fGenerateOrders(year);
  fAutoSave();
  if (typeof fUIRefreshAll === 'function') fUIRefreshAll();
}

// ---------- 生成订单池 ----------
// 只生成当前年份附近可生产的订单
function fGenerateOrders(year) {
  const candidates = F_ORDER_POOL.filter(o => {
    if (o.year > year) return false;
    if (o.year < year - 15) return false; // 太老的订单不出现
    // 所有需要的坦克都必须在当前年份解锁
    for (const tk in o.tanks) {
      if (!F_TANKS[tk] || F_TANKS[tk].year > year) return false;
    }
    return true;
  });
  if (!candidates.length) {
    // 兜底：找最近的
    const nearest = F_ORDER_POOL.reduce((best, o) =>
      Math.abs(o.year - year) < Math.abs(best.year - year) ? o : best
    );
    return [fMaterializeOrder(nearest, year)];
  }
  // 从候选中随机取 2~4 个
  const n = Math.min(4, candidates.length);
  const shuffled = candidates.slice().sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n).map(o => fMaterializeOrder(o, year));
}
function fMaterializeOrder(tpl, year) {
  return {
    id: fUid(),
    name: fMakeOrderName(year),
    tanks: JSON.parse(JSON.stringify(tpl.tanks)),
    reward: tpl.reward,
    time: tpl.time,
    timeLeft: tpl.time,
  };
}

// ---------- 主循环 ----------
function fTick(dt) {
  if (!FGame.data || FGame.data.paused) return;
  // 现实 30 秒 = 游戏 1 天 → gameDt 单位是"天"
  const gameDt = dt * FGame.data.timeScale * (1 / 30);
  FGame.data.gameTime += gameDt;
  fTickMachines(gameDt);
  fTickTrucks(gameDt);
  fTickOrders(gameDt);
}

function fStartLoop() {
  if (FGame.running) return;
  FGame.running = true;
  FGame.lastTime = performance.now();
  const loop = (t) => {
    if (!FGame.running) return;
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (t - FGame.lastTime) / 1000);
    FGame.lastTime = t;
    fTick(dt);
    FGame.autoSaveAcc += dt;
    if (FGame.data && FGame.autoSaveAcc >= (FGame.data.autoSaveInterval || 60)) {
      FGame.autoSaveAcc = 0;
      fAutoSave();
    }
    if (typeof fRender === 'function') fRender();
    if (typeof fUIUpdateHUD === 'function') fUIUpdateHUD();
  };
  requestAnimationFrame(loop);
}
function fStopLoop() { FGame.running = false; }