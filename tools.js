// ==================== tools.js — 计算器工具 + 自定义下拉 ====================

function calculateArmor() {
  const act = parseFloat($('calc-act').value);
  const ang = parseFloat($('calc-ang').value);
  const eff = parseFloat($('calc-eff').value);
  if (!isNaN(act) && !isNaN(ang) && isNaN(eff)) {
    $('calc-eff').value = (act / Math.cos(ang * Math.PI / 180)).toFixed(2);
  } else if (!isNaN(eff) && !isNaN(ang) && isNaN(act)) {
    $('calc-act').value = (eff * Math.cos(ang * Math.PI / 180)).toFixed(2);
  } else if (!isNaN(act) && !isNaN(eff) && isNaN(ang)) {
    if (act > eff) { toast('实际厚度不能大于等效厚度'); return; }
    $('calc-ang').value = (Math.acos(act / eff) * 180 / Math.PI).toFixed(2);
  } else {
    toast('请填写且仅填写其中两项');
  }
}
function clearCalc() {
  $('calc-act').value = ''; $('calc-ang').value = ''; $('calc-eff').value = '';
}

function calculatePTW() {
  const w = parseFloat($('calc-weight').value);
  const hp = parseFloat($('calc-hp').value);
  const ptw = parseFloat($('calc-ptw').value);
  if (!isNaN(w) && !isNaN(hp) && isNaN(ptw)) $('calc-ptw').value = (hp / w).toFixed(2);
  else if (!isNaN(w) && !isNaN(ptw) && isNaN(hp)) $('calc-hp').value = (w * ptw).toFixed(2);
  else if (!isNaN(hp) && !isNaN(ptw) && isNaN(w)) $('calc-weight').value = (hp / ptw).toFixed(2);
  else toast('请填写且仅填写其中两项');
}
function clearPTW() {
  $('calc-weight').value = ''; $('calc-hp').value = ''; $('calc-ptw').value = '';
}

function calculateSteering() {
  const wb = parseFloat($('calc-wheelbase').value);
  const ang = parseFloat($('calc-steer-ang').value);
  const rad = parseFloat($('calc-steer-rad').value);
  if (!isNaN(wb) && !isNaN(ang) && isNaN(rad)) {
    $('calc-steer-rad').value = (wb / Math.sin(ang * Math.PI / 180)).toFixed(2);
  } else if (!isNaN(wb) && !isNaN(rad) && isNaN(ang)) {
    if (wb > rad) { toast('轴距不能大于转向半径'); return; }
    $('calc-steer-ang').value = (Math.asin(wb / rad) * 180 / Math.PI).toFixed(2);
  } else if (!isNaN(ang) && !isNaN(rad) && isNaN(wb)) {
    $('calc-wheelbase').value = (rad * Math.sin(ang * Math.PI / 180)).toFixed(2);
  } else {
    toast('请填写且仅填写其中两项');
  }
}
function clearSteering() {
  $('calc-wheelbase').value = ''; $('calc-steer-ang').value = ''; $('calc-steer-rad').value = '';
}

function calculateTurnTime() {
  const rad = parseFloat($('calc-circle-rad').value);
  const spd = parseFloat($('calc-speed').value);
  const time = parseFloat($('calc-turn-time').value);
  if (!isNaN(rad) && !isNaN(spd) && isNaN(time)) {
    $('calc-turn-time').value = (2 * Math.PI * rad / (spd / 3.6)).toFixed(2);
  } else if (!isNaN(rad) && !isNaN(time) && isNaN(spd)) {
    $('calc-speed').value = ((2 * Math.PI * rad / time) * 3.6).toFixed(2);
  } else if (!isNaN(spd) && !isNaN(time) && isNaN(rad)) {
    $('calc-circle-rad').value = (((spd / 3.6) * time) / (2 * Math.PI)).toFixed(2);
  } else {
    toast('请填写且仅填写其中两项');
  }
}
function clearTurnTime() {
  $('calc-circle-rad').value = ''; $('calc-speed').value = ''; $('calc-turn-time').value = '';
}

function toggleDpmMode() {
  const isAuto = $('calc-dpm-mode').checked;
  $('calc-item-reload').style.display = isAuto ? 'none' : 'flex';
  document.querySelectorAll('.dpm-auto-item').forEach(item => {
    item.style.display = isAuto ? 'flex' : 'none';
  });
  clearFirepower();
}
function calculateFirepower() {
  const isAuto = $('calc-dpm-mode').checked;
  let D = parseFloat($('calc-dmg').value);
  let R = parseFloat($('calc-rpm').value);
  let P = parseFloat($('calc-dpm').value);
  if (!isAuto) {
    let T = parseFloat($('calc-reload').value);
    if (!isNaN(R) && isNaN(T)) T = 60 / R;
    if (!isNaN(T) && isNaN(R)) R = 60 / T;
    if (!isNaN(D) && !isNaN(R) && isNaN(P)) P = D * R;
    else if (!isNaN(P) && !isNaN(R) && isNaN(D)) D = P / R;
    else if (!isNaN(P) && !isNaN(D) && isNaN(R)) R = P / D;
    if (!isNaN(D)) $('calc-dmg').value = Math.round(D);
    if (!isNaN(R)) $('calc-rpm').value = R.toFixed(2);
    if (!isNaN(P)) $('calc-dpm').value = Math.round(P);
    if (!isNaN(T)) $('calc-reload').value = T.toFixed(2);
    return;
  }
  let C = parseFloat($('calc-clip').value);
  let S = parseFloat($('calc-short').value);
  let L = parseFloat($('calc-long').value);
  if (!isNaN(D) && !isNaN(C) && !isNaN(S) && !isNaN(L) && isNaN(P)) {
    const cycle = L + (C - 1) * S;
    P = D * C * 60 / cycle;
    R = C * 60 / cycle;
  }
  if (!isNaN(D)) $('calc-dmg').value = Math.round(D);
  if (!isNaN(C)) $('calc-clip').value = Math.round(C);
  if (!isNaN(S)) $('calc-short').value = S.toFixed(2);
  if (!isNaN(L)) $('calc-long').value = L.toFixed(2);
  if (!isNaN(R)) $('calc-rpm').value = R.toFixed(2);
  if (!isNaN(P)) $('calc-dpm').value = Math.round(P);
}
function clearFirepower() {
  ['calc-dmg', 'calc-reload', 'calc-clip', 'calc-short', 'calc-long', 'calc-rpm', 'calc-dpm']
    .forEach(id => { const el = $(id); if (el) el.value = ''; });
}

function onStatusChange() {
  const status = $('calc-status').value;
  $('still-camo-row').style.display = status === 'still' ? 'flex' : 'none';
  $('moving-camo-row').style.display = status === 'moving' ? 'flex' : 'none';
  manualCamoOverride = false;
  $('calc-final-camo').value = '';
  autoCalcFinalCamo();
}
function onFinalCamoManual() { manualCamoOverride = true; }
function autoCalcFinalCamo() {
  if (manualCamoOverride) return;
  const status = $('calc-status').value;
  let camo = status === 'still'
    ? parseFloat($('calc-base-camo').value)
    : parseFloat($('calc-move-camo').value);
  if (isNaN(camo)) { $('calc-final-camo').value = ''; return; }
  const bushType = $('calc-bush').value;
  let bushBonus = bushType === 'sparse' ? 25 : bushType === 'single' ? 50 : bushType === 'double' ? 80 : 0;
  if ($('calc-high-optics').checked && bushBonus > 0) bushBonus = Math.max(0, bushBonus - 15);
  if ($('calc-camo-paint').checked) camo += 4;
  camo += (parseFloat($('calc-exhaust').value) || 0);
  camo += bushBonus;
  camo = Math.min(100, Math.max(0, camo));
  if ($('calc-cvs').checked) camo *= 0.85;
  $('calc-final-camo').value = camo.toFixed(1);
}
function setupSpottingAutoCalc() {
  ['calc-base-camo', 'calc-move-camo', 'calc-status', 'calc-bush',
   'calc-camo-paint', 'calc-exhaust', 'calc-cvs', 'calc-high-optics'].forEach(id => {
    const el = $(id);
    if (el) {
      el.addEventListener('input', autoCalcFinalCamo);
      el.addEventListener('change', autoCalcFinalCamo);
    }
  });
}
function calculateSpotting() {
  const finalCamo = parseFloat($('calc-final-camo').value);
  const viewRange = parseFloat($('calc-view-range').value);
  if (isNaN(finalCamo) || isNaN(viewRange)) { toast('请填写综合隐蔽值和敌方视野'); return; }
  if (viewRange <= 50) { $('spotting-result').textContent = '敌方视野必须大于 50 米'; return; }
  let L = viewRange - (viewRange - 50) * (finalCamo / 100);
  L = Math.min(445, Math.max(50, L));
  $('spotting-result').textContent = `点亮距离：${L.toFixed(1)} 米`;
}
function clearSpotting() {
  $('calc-base-camo').value = '';
  $('calc-move-camo').value = '';
  $('calc-status').value = 'still';
  $('calc-bush').value = 'none';
  $('calc-camo-paint').checked = false;
  $('calc-exhaust').value = '0';
  $('calc-cvs').checked = false;
  $('calc-high-optics').checked = false;
  $('calc-final-camo').value = '';
  $('calc-view-range').value = '';
  $('spotting-result').textContent = '';
  $('still-camo-row').style.display = 'flex';
  $('moving-camo-row').style.display = 'none';
  manualCamoOverride = false;
}

function enhanceSelect(selectEl) {
  if (selectEl.dataset.enhanced === '1') return;
  selectEl.dataset.enhanced = '1';

  const wrapper = document.createElement('div');
  wrapper.className = 'cselect';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'cselect-trigger';
  trigger.innerHTML = `<span class="cselect-label"></span>
    <svg class="cselect-arrow" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5"
            fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

  const menu = document.createElement('div');
  menu.className = 'cselect-menu';

  wrapper.appendChild(trigger);
  wrapper.appendChild(menu);

  selectEl.parentNode.insertBefore(wrapper, selectEl);
  selectEl.classList.add('cselect-native');

  function refresh() {
    const opts = Array.from(selectEl.options);
    const cur = selectEl.value;
    menu.innerHTML = '';
    opts.forEach(opt => {
      const item = document.createElement('div');
      item.className = 'cselect-option';
      if (opt.value === cur) item.classList.add('selected');
      if (opt.disabled) item.classList.add('disabled');
      item.dataset.value = opt.value;
      item.textContent = opt.textContent;
      item.addEventListener('click', e => {
        e.stopPropagation();
        if (opt.disabled) return;
        selectEl.value = opt.value;
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        close();
      });
      menu.appendChild(item);
    });
    const sel = selectEl.options[selectEl.selectedIndex];
    trigger.querySelector('.cselect-label').textContent = sel ? sel.textContent : '';
    wrapper.classList.toggle('disabled', selectEl.disabled);
  }

  function open() {
    document.querySelectorAll('.cselect.open').forEach(el => {
      if (el !== wrapper) el.classList.remove('open');
    });
    wrapper.classList.add('open');
  }
  function close() { wrapper.classList.remove('open'); }

  trigger.addEventListener('click', e => {
    e.stopPropagation();
    if (selectEl.disabled) return;
    if (wrapper.classList.contains('open')) close();
    else open();
  });

  selectEl.addEventListener('change', refresh);

  const mo = new MutationObserver(() => {
    refresh();
    wrapper.classList.toggle('disabled', selectEl.disabled);
  });
  mo.observe(selectEl, {
    childList: true,
    attributes: true,
    attributeFilter: ['disabled']
  });

  refresh();
}

document.addEventListener('click', () => {
  document.querySelectorAll('.cselect.open').forEach(el => el.classList.remove('open'));
});

function enhanceAllSelects() {
  document.querySelectorAll('select').forEach(enhanceSelect);
}