/* ================= 公共脚本：图标 / 导航 / 顶栏 / 提示 / 图表 ================= */

const ICONS = {
  grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6"/>',
  server: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>',
  database: '<ellipse cx="12" cy="5.5" rx="8" ry="3"/><path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9.5" r="2"/><path d="M21 16l-5-5-9 9"/>',
  bell: '<path d="M18 8a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7"/><path d="M13.7 20a2 2 0 0 1-3.4 0"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M12 15V3"/><path d="M7.5 7.5L12 3l4.5 4.5"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/>',
  volume: '<path d="M11 5L6.5 9H3v6h3.5L11 19z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 6a8.5 8.5 0 0 1 0 12"/>',
  check: '<path d="M4 12.5l5 5L20 6.5"/>',
  alert: '<path d="M12 3.5L2.5 20.5h19z"/><path d="M12 9v5"/><path d="M12 17.5h.01"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 14h10l1-14"/>',
  settings: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7.5 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.6 14H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 7.5l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 3.6V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.5 1.4l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.4 8.3-8 9.5C7.4 20.3 4 17 4 12V6z"/>',
  activity: '<path d="M3 12h4l3 8 4-16 3 8h4"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>',
  wifi: '<path d="M5 12.5a10 10 0 0 1 14 0"/><path d="M8.5 16a5.5 5.5 0 0 1 7 0"/><path d="M12 19.5h.01"/>',
  key: '<circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v3M15.5 12v2.5"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 4v4h-4"/><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 20v-4h4"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M12 3v12"/><path d="M7.5 10.5L12 15l4.5-4.5"/>',
  arrowRight: '<path d="M5 12h14"/><path d="M14 7l5 5-5 5"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 20a6.4 6.4 0 0 0-2-4.6"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  speaker: '<rect x="6" y="3" width="12" height="18" rx="2.5"/><circle cx="12" cy="14" r="3.2"/><path d="M12 8.5h.01"/>',
  close: '<path d="M18 6L6 18M6 6l12 12"/>',
  zap: '<path d="M13 2L4.5 13.5H11l-1 8.5L19.5 10H13z"/>',
  monitor: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>'
};

function icon(name, size = 19, sw = 1.7) {
  const p = ICONS[name] || ICONS.grid;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
}

/* ---------------- 侧边导航 ----------------
   信息架构依据《需求对齐清单-0924》「一个子系统 = 一块专属大屏」三层结构：
     ① 监控室（多屏轮播入口）
     ② 专属大屏层（一个子系统一块屏，按屏排期）
     ③ 屏内标配能力（预警 / 邮件，各屏复用，非某一屏专属）
     ④ 平台底座（数据接入 / 采集调度 / 权限，各屏共用）
     ⑤ 分析与归档
   其中 tag 为交付状态，与需求文档的优先级一一对应。 */
const NAV_GROUPS = [
  {
    label: '监控室',
    items: [
      { key: 'index', href: 'index.html', label: '监控总览', icon: 'grid' },
      { key: 'wall', href: 'wall.html', label: '监控室 · 多屏轮播', icon: 'layers', tag: '标配', tagCls: 't-purple' }
    ]
  },
  {
    label: '专属大屏 · 一系统一屏',
    items: [
      { key: 'evidence', href: 'evidence.html', label: '生产交易日志看板', icon: 'image', tag: 'P1', tagCls: 't-red' },
      { key: 'pit', href: 'pit.html', label: '凹库 · 微水调库看板', icon: 'database', tag: 'P2', tagCls: 't-red' },
      { key: 'countdown', href: '', label: 'OTD·铜线时效屏', icon: 'clock', tag: '待排期', tagCls: 't-plain' },
      { key: 'output', href: '', label: '产量 · WIP 看板', icon: 'activity', tag: '暂缓', tagCls: 't-plain' },
      { key: 'monitor', href: '', label: '设备程序·状态屏', icon: 'zap', tag: '待排期', tagCls: 't-plain' }
    ]
  },
  {
    label: '屏内标配能力 · 各屏复用',
    items: [
      { key: 'alerts', href: 'alerts.html', label: '预警组件 · 多级报警', icon: 'bell', tag: '标配', tagCls: 't-purple' },
      { key: 'mail', href: 'mail.html', label: '邮件组件 · 投递效果', icon: 'mail', tag: '标配', tagCls: 't-purple' }
    ]
  },
  {
    label: '平台底座 · 各屏共用',
    items: [
      { key: 'systems', href: 'systems.html', label: '子系统接入与底座', icon: 'server' },
      { key: 'ingest', href: 'ingest.html', label: '采集调度与调用日志', icon: 'refresh' },
      { key: 'users', href: 'users.html', label: '用户与权限管理', icon: 'users' }
    ]
  },
  {
    label: '分析与归档',
    items: [
      { key: 'analytics', href: 'analytics.html', label: '异常根因智能分析', icon: 'search' },
      { key: 'monthly', href: 'monthly.html', label: '自动月报', icon: 'file' },
      { key: 'archive', href: 'archive.html', label: '历史日志归档', icon: 'download' }
    ]
  }
];

// 扁平索引：便于按 key 反查
const NAV = NAV_GROUPS.reduce((a, g) => a.concat(g.items), []);

const PAGE_TITLES = {
  index: ['监控总览', '全厂子系统健康度 · 异常处置 · 交接态势'],
  wall: ['监控室 · 多屏轮播', '带班桌多块大屏自动轮播 · 可配间隔 / 手动切换 / 大字号'],
  evidence: ['生产交易日志看板', 'P1 首批 · 班级交接 · 设备异常 · 紧急批 · FLT 批次'],
  pit: ['各站凹库 · 微水调库看板', 'P2 首批 · 按站 / 机台 / 班次统计凹库量与调库趋势'],
  systems: ['子系统接入与底座', '问卷 1.1 · 待接入子系统规模与接入方式'],
  ingest: ['采集调度与调用日志', '问卷 2.1 / 3.1 · 各子系统数据对接情况与调用日志'],
  alerts: ['预警组件 · 多级报警', '每屏标配 · 阈值/周期/系数可配 · 屏幕变色 + 强制弹窗 + 语音'],
  analytics: ['异常根因智能分析', '高频告警统计 · 相似告警聚类 · 根因研判'],
  monthly: ['自动月报', '按月汇总告警与事件 · 预览 / 导出 PDF·Excel'],
  archive: ['历史日志归档', '过期日志自动归档 · 检索查询与审计追溯'],
  mail: ['邮件组件 · 投递效果', '每屏标配 · 演示实际投递到邮箱的效果'],
  users: ['用户与权限管理', 'RBAC · 用户 / 角色 / 权限矩阵 / 授权留痕']
};

// 把 .sidebar 包进 .nav-shell 占位层：使侧边栏悬停浮出时不再挤压内容区
function wrapSidebar() {
  const sb = document.getElementById('sidebar');
  if (!sb || sb.parentElement.classList.contains('nav-shell')) return;
  const shell = document.createElement('div');
  shell.className = 'nav-shell';
  sb.parentNode.insertBefore(shell, sb);
  shell.appendChild(sb);
}

function renderShell(page) {
  const title = PAGE_TITLES[page] || ['演示', ''];
  wrapSidebar();

  const navItem = n => {
    const cls = ['nav-item'];
    if (n.key === page) cls.push('active');
    if (!n.href) cls.push('off');
    const tag = n.tag ? `<span class="nav-tag ${n.tagCls || 't-plain'}">${n.tag}</span>` : '';
    const inner = `<span class="nav-icon">${icon(n.icon, 20)}</span><span class="nav-text">${n.label}</span>${tag}`;
    return n.href
      ? `<a href="${n.href}" class="${cls.join(' ')}" title="${n.label}">${inner}</a>`
      : `<span class="${cls.join(' ')}" role="button" tabindex="0"
           title="${n.label}（${n.tag}）· 待 09-29 与客户确认后开工"
           onclick="toast('「${n.label}」为${n.tag}看板，需求与数据源待 09-29 会议确认后开工','warn')">${inner}</span>`;
  };

  document.getElementById('sidebar').innerHTML = `
    <div class="brand">
      <div class="brand-logo">${icon('shield', 24, 1.9)}</div>
      <div class="brand-text">
        <div class="brand-title">统一监控与交接中心</div>
        <div class="brand-sub">OpsMonitor · DEMO</div>
      </div>
    </div>
    <nav class="nav">
      ${NAV_GROUPS.map(g => `
        <div class="nav-group">
          <div class="nav-label">${g.label}</div>
          ${g.items.map(navItem).join('')}
        </div>`).join('')}
    </nav>
    <div class="sidebar-foot">
      <div class="env-text">
        <div class="env"><span class="dot dot-success"></span> 演示环境 v1.1.0</div>
        <div class="env" style="color:var(--text-3)">数据均为样例，可自由修改</div>
      </div>
      <button class="pin-btn" id="pinBtn" aria-label="固定或收起侧边栏">${icon('lock', 17, 1.8)}</button>
    </div>`;

  const pb = document.getElementById('pinBtn');
  if (pb) pb.onclick = () => {
    Sidebar.togglePin();
    toast(Sidebar.pinned ? '侧边栏已固定常驻' : '侧边栏已收起 · 鼠标移到左侧自动浮出', 'success');
  };
  Sidebar.apply();

  // 首次进入时给一次轻提示，避免不知道侧边栏可以展开
  if (Sidebar.mini && !store.get('nav_hint', false)) {
    store.set('nav_hint', true);
    setTimeout(() => toast('左侧目录已收起：鼠标移到最左侧即可自动浮出，点图钉可固定常驻', 'primary'), 700);
  }

  document.getElementById('topbar').innerHTML = `
    <div class="topbar-left">
      <div class="page-title">${title[0]}</div>
      <div class="page-desc">${title[1]}</div>
    </div>
    <div class="topbar-right">
      <button class="vbtn ${Voice.cfg.on ? 'on' : ''}" id="vBtn" title="点击开启 / 关闭全站语音播报">
        <span class="vbtn-icon">${icon(Voice.cfg.on ? 'volume' : 'speaker', 18)}</span>
        <span class="vbtn-txt">语音播报</span>
        <span class="vstate">${Voice.cfg.on ? '已开启' : '已关闭'}</span>
      </button>
      <span class="shift-pill">${icon('clock', 16)} <span id="shiftName">白班</span> · <span id="shiftClock">--:--:--</span></span>
      <div class="who">
        <label class="who-sel-label" for="whoSel">当前身份</label>
        <select class="who-sel" id="whoSel" title="切换演示身份：用于演示分级权限下的数据范围与操作权限">
          ${typeof USERS_SEED !== 'undefined' ? USERS_SEED.map(u => `<option value="${u.id}" ${u.id === CurrentUser.id ? 'selected' : ''}>${esc(u.name)} · ${esc(u.dept)}（${u.roles.map(rid => (ROLES_SEED.find(r => r.id === rid) || {}).name).filter(Boolean).join('/')}）</option>`).join('') : ''}
        </select>
        <div class="avatar">${esc((CurrentUser.get() ? CurrentUser.get().name : '张').slice(0, 1))}</div>
      </div>
    </div>`;

  const vb = document.getElementById('vBtn');
  if (vb) vb.onclick = () => Voice.toggle();

  const ws = document.getElementById('whoSel');
  if (ws) ws.onchange = () => {
    CurrentUser.set(ws.value);
    toast('已切换演示身份：' + (CurrentUser.get() ? CurrentUser.get().name : '') + '，数据范围按该角色权限刷新', 'success');
    setTimeout(() => location.reload(), 360);
  };

  startClock();
  if (Voice.supported()) {
    window.speechSynthesis.onvoiceschanged = () => { };
  }
}

function currentShift() {
  const h = new Date().getHours();
  if (h >= 8 && h < 20) return ['白班', '08:00 - 20:00'];
  return ['晚班', '20:00 - 次日 08:00'];
}

function startClock() {
  const tick = () => {
    const now = new Date();
    const p = n => String(n).padStart(2, '0');
    const el = document.getElementById('shiftClock');
    if (el) el.textContent = `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;
    const sn = document.getElementById('shiftName');
    if (sn) sn.textContent = currentShift()[0];
  };
  tick();
  setInterval(tick, 1000);
}

/* ---------------- 本地存储（演示用持久化） ---------------- */
const store = {
  get(k, def) {
    try { const v = localStorage.getItem('ohd_' + k); return v === null ? def : JSON.parse(v); }
    catch (e) { return def; }
  },
  set(k, v) { try { localStorage.setItem('ohd_' + k, JSON.stringify(v)); } catch (e) { } }
};

/* ---------------- 侧边栏：可自动隐藏（收起为图标条 + 悬停浮出 + 图钉固定） ----------------
   注意：必须定义在 store 之后（对象字面量初始化时会立即读取本地存储）。 */
const Sidebar = {
  // true = 收起为图标条（悬停浮出）；false = 常驻展开
  mini: store.get('nav_mini', true),
  pinned: store.get('nav_pinned', false),

  apply() {
    const b = document.body;
    b.classList.toggle('nav-mini', this.mini);
    b.classList.toggle('nav-pinned', this.pinned);
    const pin = document.getElementById('pinBtn');
    if (pin) {
      // 常驻展开 = 已固定，或显式展开（非收起）
      const fixed = this.pinned || !this.mini;
      pin.classList.toggle('on', fixed);
      pin.title = fixed ? '已固定常驻 · 点击收起为图标条' : '已收起 · 点击固定常驻展开';
    }
  },
  save() { store.set('nav_mini', this.mini); store.set('nav_pinned', this.pinned); },
  // 图钉：在「常驻展开」与「自动隐藏」之间切换
  togglePin() {
    if (this.pinned) { this.pinned = false; this.mini = true; }
    else { this.pinned = true; this.mini = false; }
    this.save(); this.apply();
  }
};

/* ================= 当前登录身份（演示用，用于演示分级权限下的数据范围） =================
   真实系统由登录会话决定；此处提供顶栏身份切换，便于演示「不同角色仅可见其权限范围内数据」。 */
const CurrentUser = {
  id: store.get('current_user', 'U01'),
  set(id) { this.id = id; store.set('current_user', id); },
  get() { return (typeof USERS_SEED !== 'undefined' && USERS_SEED.find(u => u.id === this.id)) || (typeof USERS_SEED !== 'undefined' ? USERS_SEED[0] : null); },
  scope() { const u = this.get(); return u ? u.scope : '全部数据'; },
  dept() { const u = this.get(); return u ? u.dept : ''; },
  roles() { const u = this.get(); return u ? u.roles : ['R01']; },
  roleNames() { return this.roles().map(rid => { const r = (typeof ROLES_SEED !== 'undefined' && ROLES_SEED.find(x => x.id === rid)) || {}; return r.name || rid; }); },
  // 是否拥有某模块某操作权限（取所拥有角色的并集）
  can(module, action) {
    return this.roles().some(rid => {
      const r = (typeof ROLES_SEED !== 'undefined' && ROLES_SEED.find(x => x.id === rid));
      return r && (r.perms[module] || []).includes(action);
    });
  },
  isAdmin() { return this.roles().includes('R01'); }
};

/* ---------------- Toast ---------------- */
function toast(msg, type = 'primary') {
  const colors = { primary: '#1d4ed8', success: '#12805a', warn: '#a8620b', danger: '#cc2f2a' };
  const icons = { primary: 'activity', success: 'check', warn: 'alert', danger: 'alert' };
  let wrap = document.querySelector('.toast-wrap');
  if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toast-wrap'; document.body.appendChild(wrap); }
  const el = document.createElement('div');
  el.className = 'toast';
  el.style.setProperty('--tc', colors[type] || colors.primary);
  el.innerHTML = `<span style="color:${colors[type]}">${icon(icons[type], 19)}</span><span>${msg}</span>`;
  wrap.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(8px)'; el.style.transition = '.25s'; setTimeout(() => el.remove(), 250); }, 2600);
}

/* ================= 全站语音播报（右上角总开关，客户可自行控制） ================= */
const VOICE_DEFAULTS = { on: false, gender: 'female', rate: 1.1, volume: 0.9, repeat: 1, sources: ['critical', 'keyword'], external: true };

const Voice = {
  cfg: Object.assign({}, VOICE_DEFAULTS, store.get('voice', {})),
  listeners: [],

  save() {
    store.set('voice', this.cfg);
    this.syncBtn();
    this.listeners.forEach(f => { try { f(this.cfg); } catch (e) { } });
  },
  onChange(f) { this.listeners.push(f); },

  supported() { return typeof window !== 'undefined' && 'speechSynthesis' in window; },
  list() { return this.supported() ? window.speechSynthesis.getVoices() : []; },
  zhVoices() { return this.list().filter(v => /^zh/i.test(v.lang)); },

  pick() {
    const vs = this.zhVoices();
    if (!vs.length) return null;
    const fw = ['female', 'xiaoxiao', 'yaoyao', 'huihui', 'tingting', '女', 'xiaoyi', 'meijia'];
    const isF = v => fw.some(w => v.name.toLowerCase().includes(w));
    const female = vs.find(isF), male = vs.find(v => !isF(v));
    return (this.cfg.gender === 'female' ? (female || vs[0]) : (male || vs[0])) || null;
  },

  speak(text, _repeat) {
    if (!this.cfg.on) { toast('语音播报当前为「已关闭」，可在页面右上角一键开启', 'warn'); return false; }
    if (!text) return false;
    if (!this.supported()) { toast('当前浏览器不支持语音合成，建议使用 Chrome / Edge', 'warn'); return false; }
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text));
      const v = this.pick();
      if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = 'zh-CN'; }
      u.rate = Math.max(0.5, Math.min(2, Number(this.cfg.rate) || 1));
      u.volume = Math.max(0, Math.min(1, Number(this.cfg.volume) || 0.9));
      u.pitch = this.cfg.gender === 'female' ? 1.15 : 0.9;
      u.onend = () => this.syncBtn(false);
      u.onerror = () => this.syncBtn(false);
      window.speechSynthesis.speak(u);
      this.syncBtn(true);
      this.log(text);
      return true;
    } catch (e) { toast('语音合成失败：' + e.message, 'danger'); return false; }
  },

  speakTimes(text) {
    const n = Math.max(1, Number(this.cfg.repeat) || 1);
    for (let i = 0; i < n; i++) setTimeout(() => this.speak(text), i * 3200);
  },

  stop() {
    if (this.supported()) window.speechSynthesis.cancel();
    this.syncBtn(false);
  },

  log(text) {
    const l = store.get('voiceLog', []);
    l.unshift({ time: fmtDT(new Date()), text: String(text).slice(0, 120) });
    store.set('voiceLog', l.slice(0, 20));
  },

  toggle() {
    this.cfg.on = !this.cfg.on;
    this.save();
    if (this.cfg.on) {
      toast('语音播报已开启 · 后续紧急告警将自动朗读', 'success');
      setTimeout(() => this.speak('语音播报已开启，紧急告警将自动朗读。'), 120);
    } else {
      this.stop();
      toast('语音播报已关闭 · 告警仅通过邮件通知', 'warn');
    }
  },

  syncBtn(speaking) {
    const b = document.getElementById('vBtn');
    if (!b) return;
    b.className = 'vbtn' + (this.cfg.on ? ' on' : '') + (speaking ? ' speaking' : '');
    const st = b.querySelector('.vstate');
    if (st) st.textContent = speaking ? '播报中…' : (this.cfg.on ? '已开启' : '已关闭');
  }
};

/* ================= 通用弹窗 ================= */
function openDialog(opt) {
  const { title = '', sub = '', body = '', okText = '保存', cancelText = '取消', width = 640, onOk = null } = opt || {};
  closeDialog();
  const mask = document.createElement('div');
  mask.className = 'modal-mask';
  mask.id = 'globalDialog';
  mask.innerHTML = `
    <div class="modal" style="max-width:${width}px">
      <div class="modal-head">
        <div>
          <div style="font-size:18px;font-weight:700">${title}</div>
          ${sub ? `<div class="small muted" style="margin-top:2px">${sub}</div>` : ''}
        </div>
        <button class="btn btn-sm btn-ghost" id="dlgClose">${icon('close', 18)}</button>
      </div>
      <div class="modal-body">${body}</div>
      <div class="card-foot" style="border-radius:0 0 var(--radius) var(--radius);display:flex;justify-content:flex-end;align-items:center;gap:10px">
        <button class="btn" id="dlgCancel">${cancelText}</button>
        <button class="btn btn-primary" id="dlgOk">${okText}</button>
      </div>
    </div>`;
  document.body.appendChild(mask);
  const close = () => closeDialog();
  mask.addEventListener('click', e => { if (e.target === mask) close(); });
  mask.querySelector('#dlgClose').onclick = close;
  mask.querySelector('#dlgCancel').onclick = close;
  mask.querySelector('#dlgOk').onclick = () => { if (onOk) onOk(mask, close); else close(); };
  const first = mask.querySelector('[autofocus]');
  if (first) first.focus();
  return mask;
}

function closeDialog() { const d = document.getElementById('globalDialog'); if (d) d.remove(); }

const getVal = id => { const el = document.getElementById(id); return el ? String(el.value).trim() : ''; };
const getChk = id => { const el = document.getElementById(id); return !!el && el.checked; };
const getChkList = name => Array.from(document.querySelectorAll(`[data-pick="${name}"]:checked`)).map(el => el.value);

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeDialog(); }
});

/* ---------------- 工具函数 ---------------- */
const pad = n => String(n).padStart(2, '0');
const fmtTime = d => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const fmtDT = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const fmtDateCN = d => `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
const weekCN = d => '星期' + '日一二三四五六'[d.getDay()];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fileSize = b => b < 1024 ? b + ' B' : b < 1024 * 1024 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(2) + ' MB';

/* ---------------- 通用导出：Excel（.xls，零依赖，Excel 可直接打开） ---------------- */
function exportExcel(filename, headers, rows) {
  let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"></head><body><table border="1" cellspacing="0">';
  html += '<tr>' + headers.map(h => `<th>${esc(h)}</th>`).join('') + '</tr>';
  rows.forEach(r => { html += '<tr>' + r.map(c => `<td>${esc(c == null ? '' : c)}</td>`).join('') + '</tr>'; });
  html += '</table></body></html>';
  const blob = new Blob(['﻿' + html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 120);
}

function statusInfo(s) {
  const map = {
    normal: { label: '正常', cls: 'b-success', dot: 'dot-success', color: '#12805a' },
    warn: { label: '告警', cls: 'b-warn', dot: 'dot-warn', color: '#a8620b' },
    critical: { label: '严重', cls: 'b-danger', dot: 'dot-danger', color: '#cc2f2a' },
    offline: { label: '离线', cls: 'b-neutral', dot: 'dot-neutral', color: '#8a95a5' }
  };
  return map[s] || map.normal;
}

/* ---------------- 轻量 SVG 图表（无外部依赖） ---------------- */
function lineChart(el, opts) {
  const { series, labels, height = 240, min = 0, max = 100, yUnit = '' } = opts;
  const W = 1000, H = height, pl = 46, pr = 16, pt = 16, pb = 30;
  const iw = W - pl - pr, ih = H - pt - pb;
  const step = iw / (labels.length - 1);
  const X = i => pl + i * step;
  const Y = v => pt + ih - (v - min) / (max - min) * ih;
  let grid = '', ticks = '';
  for (let i = 0; i <= 4; i++) {
    const v = min + (max - min) * i / 4, y = Y(v);
    grid += `<line x1="${pl}" y1="${y}" x2="${W - pr}" y2="${y}" stroke="#e6ebf3" stroke-width="1"/>`;
    ticks += `<text x="${pl - 10}" y="${y + 4}" text-anchor="end" font-size="12" fill="#8a95a5">${Math.round(v)}${yUnit}</text>`;
  }
  let xt = '';
  labels.forEach((l, i) => {
    if (i % 3 === 0 || i === labels.length - 1) {
      xt += `<text x="${X(i)}" y="${H - 8}" text-anchor="middle" font-size="12" fill="#8a95a5">${l}</text>`;
    }
  });
  const paths = series.map(s => {
    const d = s.data.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
    const area = s.fill
      ? `<path d="${d} L${X(s.data.length - 1)},${pt + ih} L${pl},${pt + ih} Z" fill="${s.color}" opacity=".10"/>`
      : '';
    return area + `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`;
  }).join('');
  const dots = series.map(s => s.data.map((v, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="3" fill="#fff" stroke="${s.color}" stroke-width="2"/>`).join('')).join('');
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" style="overflow:visible">${grid}${xt}${ticks}${paths}${dots}</svg>`;
}

function barGroup(el, opts) {
  const { labels, series, height = 240, max } = opts;
  const W = 1000, H = height, pl = 46, pr = 16, pt = 14, pb = 32;
  const iw = W - pl - pr, ih = H - pt - pb;
  const maxV = max || Math.max(...series.flatMap(s => s.data)) * 1.15;
  const gw = iw / labels.length;
  const bw = Math.min(26, (gw - 18) / series.length);
  let grid = '', ticks = '';
  for (let i = 0; i <= 4; i++) {
    const v = maxV * i / 4, y = pt + ih - v / maxV * ih;
    grid += `<line x1="${pl}" y1="${y}" x2="${W - pr}" y2="${y}" stroke="#e6ebf3"/>`;
    ticks += `<text x="${pl - 10}" y="${y + 4}" text-anchor="end" font-size="12" fill="#8a95a5">${Math.round(v)}</text>`;
  }
  let bars = '', xt = '';
  labels.forEach((l, i) => {
    const cx = pl + gw * i + gw / 2;
    series.forEach((s, j) => {
      const v = s.data[i], h = ih * (v / maxV);
      const x = cx - (series.length * bw + (series.length - 1) * 6) / 2 + j * (bw + 6);
      bars += `<rect x="${x}" y="${pt + ih - h}" width="${bw}" height="${Math.max(h, 1)}" rx="4" fill="${s.color}"/>`;
    });
    xt += `<text x="${cx}" y="${H - 9}" text-anchor="middle" font-size="12.5" fill="#8a95a5">${l}</text>`;
  });
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" style="overflow:visible">${grid}${ticks}${bars}${xt}</svg>`;
}

function donut(el, items, size = 190, centerTop = '', centerSub = '') {
  const total = items.reduce((a, b) => a + b.value, 0) || 1;
  const r = 68, cx = 95, cy = 95, C = 2 * Math.PI * r;
  let acc = 0, segs = '';
  items.forEach(it => {
    const len = it.value / total * C;
    segs += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${it.color}" stroke-width="24"
      stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-acc}" transform="rotate(-90 ${cx} ${cy})"/>`;
    acc += len;
  });
  el.innerHTML = `<svg viewBox="0 0 190 190" width="${size}" height="${size}">${segs}
    <text x="95" y="92" text-anchor="middle" font-size="30" font-weight="700" fill="#1d2836">${centerTop}</text>
    <text x="95" y="112" text-anchor="middle" font-size="13" fill="#8a95a5">${centerSub}</text></svg>`;
}

function hBars(el, items, suffix = '') {
  const max = Math.max(...items.map(i => i.value)) || 1;
  el.innerHTML = items.map(i => `
    <div style="margin-bottom:14px">
      <div class="flex between acenter" style="margin-bottom:5px">
        <span style="font-size:14.5px">${i.label}</span>
        <span style="font-size:15px;font-weight:700" class="num">${i.value}${suffix}</span>
      </div>
      <div class="progress"><i style="width:${(i.value / max * 100).toFixed(1)}%;background:${i.color}"></i></div>
    </div>`).join('');
}
