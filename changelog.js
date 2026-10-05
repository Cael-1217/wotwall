// ==================== 更新日志数据 ====================

const APP_VERSION = '2.3';

const CHANGELOG_ENTRIES = [
  {
    version: '2.3',
    items: [
      '新增统计页：分类、国家、类型、作者分布',
      '新增主题色自定义（背景斜纹 + 文字色）',
      '新增"最近浏览"记录',
      '新增图片灯箱，点击查看大图',
      '详情页支持左右切换与键盘方向键',
      '详情页新增相关推荐',
      '新增分享链接（#tank=xxx）',
      '投稿图片支持拖拽排序',
      '新增骨架屏、卡片悬浮放大、空状态插画',
      '新增回到顶部按钮',
      '修复分享图生成失败',
      '更新日志改为首次打开弹窗'
    ]
  },
  {
    version: '2.2',
    items: [
      '新增作者主页',
      '外观支持跟随系统',
      '投稿表单自动保存草稿',
      '详情页新增生成分享图',
      '代码拆分为多个文件'
    ]
  },
  {
    version: '2.1',
    items: [
      '新增展品分类：WOT/B、WT、现实/架空',
      '筛选栏根据分类动态切换',
      'WT 国家改为实际国家',
      'WOT/B 保留反坦、火炮分开',
      '下拉菜单改为网页风格自定义 UI',
      '加载屏支持点击关闭',
      '注册工具移至"我的"页面'
    ]
  },
  {
    version: '2.0',
    items: [
      '全新视觉，简约展览墙风格',
      '移除小游戏与运势抽卡',
      '新增投稿工具：本地压缩、一键分享'
    ]
  }
];

const CHANGELOG_SEEN_KEY = 'tw_seen_version';

// ---------- 完整日志渲染 ----------
function renderChangelog() {
  const content = document.getElementById('changelog-content');
  if (!content) return;
  content.innerHTML = CHANGELOG_ENTRIES.map(e => `
    <div class="cl-entry">
      <div class="cl-version">v${e.version}</div>
      <ul class="cl-items">${e.items.map(i => `<li>${i}</li>`).join('')}</ul>
    </div>
  `).join('');
}

// ---------- 版本已读状态 ----------
function shouldShowChangelog() {
  try {
    return localStorage.getItem(CHANGELOG_SEEN_KEY) !== APP_VERSION;
  } catch (e) {
    return false;
  }
}
function markChangelogSeen() {
  try { localStorage.setItem(CHANGELOG_SEEN_KEY, APP_VERSION); } catch (e) {}
}

// ---------- 右下角浮窗 ----------
function showChangelogToast() {
  const toast = document.getElementById('changelog-toast');
  if (!toast) return;

  const latest = CHANGELOG_ENTRIES[0];
  if (latest) {
    const vEl = document.getElementById('cl-toast-version');
    if (vEl) vEl.textContent = 'v' + latest.version;

    const bEl = document.getElementById('cl-toast-body');
    if (bEl) {
      bEl.innerHTML = latest.items
        .slice(0, 5)
        .map(i => `<div class="cl-item">· ${escapeHtml(i)}</div>`)
        .join('');
    }
  }
  toast.classList.add('active');
}

function dismissChangelogToast() {
  const toast = document.getElementById('changelog-toast');
  if (toast) toast.classList.remove('active');
  markChangelogSeen();
}

// ---------- 完整日志弹窗 ----------
function openChangelog() {
  renderChangelog();
  const toast = document.getElementById('changelog-toast');
  if (toast) toast.classList.remove('active');

  const modal = document.getElementById('changelog-modal');
  if (modal) modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeChangelog() {
  markChangelogSeen();
  const modal = document.getElementById('changelog-modal');
  if (modal) modal.classList.remove('active');
  document.body.style.overflow = '';
}

// ---------- 统一绑定（避免重复监听） ----------
function setupChangelogUI() {
  const modal = document.getElementById('changelog-modal');
  if (modal && modal.dataset.bound !== '1') {
    modal.dataset.bound = '1';
    modal.addEventListener('click', e => {
      if (e.target.id === 'changelog-modal') closeChangelog();
    });
  }
}