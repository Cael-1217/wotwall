// ==================== config.js — 全局常量与状态 ====================

const TYPE_ICONS = {
  '重坦': `<g stroke="currentColor" stroke-width="3" stroke-linecap="butt">
             <line x1="8"  y1="4" x2="4"  y2="20"/>
             <line x1="14" y1="4" x2="10" y2="20"/>
             <line x1="20" y1="4" x2="16" y2="20"/>
           </g>`,
  '中坦': `<g stroke="currentColor" stroke-width="4" stroke-linecap="butt">
             <line x1="10" y1="4" x2="6"  y2="20"/>
             <line x1="18" y1="4" x2="14" y2="20"/>
           </g>`,
  '轻坦': `<polygon points="12,3 21,12 12,21 3,12" fill="currentColor"/>`,
  '反坦': `<polygon points="2,3 22,3 12,21" fill="currentColor"/>`,
  '火炮': `<rect x="4" y="4" width="16" height="16" rx="1.5" fill="currentColor"/>`,
  '自行火炮/歼击车': `<polygon points="2,3 22,3 12,21" fill="currentColor"/>`,
  '防空车': `<polygon points="12,3 22,21 2,21" fill="currentColor"/>`,
  '工程车': `<polygon points="12,2 21,7 21,17 12,22 3,17 3,7" fill="currentColor"/>`,
};

const MERGED_TD_SPG = '自行火炮/歼击车';
const TD_SPG_ALIASES = ['反坦', '火炮', MERGED_TD_SPG];
function isTDorSPG(type) { return TD_SPG_ALIASES.includes(type); }
function displayType(type) { return isTDorSPG(type) ? MERGED_TD_SPG : type; }
function displayTypeFor(t) {
  if (!t.category || t.category === 'WOT') return t.type;
  return displayType(t.type);
}

const GAME_NATIONS = {
  FR: 'F系', DE: 'D系', US: 'M系', RU: 'S系', CN: 'C系', SE: 'V系',
  UK: 'Y系', PL: 'B系', JK: 'J系', JP: 'R系', SP: 'X系', IT: 'I系'
};
const WT_NATION_OPTIONS = [
  ['US', '美国'], ['DE', '德国'], ['RU', '俄罗斯 / 苏联'],
  ['UK', '英国'], ['FR', '法国'], ['IT', '意大利'],
  ['SE', '瑞典'], ['IL', '以色列'], ['OT', '其他']
];
const WT_NATIONS = Object.fromEntries(WT_NATION_OPTIONS);

const WOT_TIERS = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI'];
const WT_TIERS = (() => {
  const arr = [];
  for (let i = 1; i <= 15; i++) {
    arr.push(`${i}.0`);
    if (i < 15) { arr.push(`${i}.3`); arr.push(`${i}.7`); }
  }
  return arr;
})();

const REAL_ERAS = {
  WW1: '一战时期', WW2: '二战时期', COLD: '冷战降临',
  MODERN: '现代战争', F2042: '未来先锋'
};
const REAL_NATIONS = {
  CN: '中国', RU: '俄罗斯', SU: '苏联', US: '美国', UK: '英国',
  FR: '法国', DE: '德国', IT: '意大利', PL: '波兰', JP: '日本',
  SE: '北欧', AU: '澳大利亚', IL: '以色列',
  AM: '其他（美洲）', AS: '其他（亚洲）', EU: '其他（欧洲）',
  AF: '其他（非洲）', OC: '其他（澳洲）'
};
const REAL_NATION_OPTIONS = [
  ['CN', '中国'], ['RU', '俄罗斯 / 苏联'], ['US', '美国'],
  ['UK', '英国'], ['FR', '法国'], ['DE', '德国'], ['IT', '意大利'],
  ['PL', '波兰'], ['JP', '日本'], ['SE', '北欧'], ['AU', '澳大利亚'],
  ['IL', '以色列'],
  ['AM', '其他（美洲）'], ['AS', '其他（亚洲）'], ['EU', '其他（欧洲）'],
  ['AF', '其他（非洲）'], ['OC', '其他（澳洲）']
];

const CATEGORY_LABELS = { WOT: 'WOT/B', WT: 'WT', REAL: '现实/架空' };

const DRAFT_KEY = 'tw_submit_draft';
const RECENT_KEY = 'tw_recent';
const ACCENT_KEY = 'tw_accent';

const ACCENT_PRESETS = {
  gold:   { dark: '#c9a860', light: '#8a6f3a' },
  blue:   { dark: '#4a90e2', light: '#2f6fbf' },
  green:  { dark: '#5aa860', light: '#3a7a40' },
  purple: { dark: '#a06ac0', light: '#7a4a90' },
  red:    { dark: '#c05a5a', light: '#903a3a' },
};

const state = {
  currentPage: 'tank-page',
  currentAuthor: '',
  currentUser: null,
  pageAnimEnabled: true,
  layout: 'grid',
  currentList: [],
  currentTank: null,
  lightboxIdx: 0,
  lightboxImgs: [],
  destroyMode: false,
};

const $ = id => document.getElementById(id);

// 投稿 / 注册 临时状态
let tankSubmission = { files: [], code: '' };
let dragSrcIdx = -1;
let regSubmission = { file: null, code: '' };

// 工具：点亮计算器状态
let manualCamoOverride = false;

// 彩蛋：破坏模式状态
let __overscrollCounter = 0;
let __eggButtonShown = false;
let __overscrollResetTimer = null;