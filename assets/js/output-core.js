/* ================= OP 专属大屏 · Output（OP）周维度累计追踪 数据引擎 =================
   需求来源：《Output 大屏（周维度追踪）需求提示词》（权威规格）+ 客户后续补充口径。
   以「周」为单位：每周起始日=周六，列顺序 六、日、一、二、三、四、五；单位 K（千颗）。
   每行 PKG Type 展示：goal 行（目标累计）/ total 行（实际累计，由 IT 库定时拉取）/ FE total 行（预留扩展）；
   表格底部固定 Earn goal / Earn total（金额累计，万元）。
   目标逻辑：每周首日（周六）填「一周总目标」，系统均摊到每天并以累计值逐日展示。
     示例：周总目标 3,680 → 526、1,051、1,577、2,103、2,629、3,154、3,680。
   异常检测：每天 goal vs total 差额；差额 ≥ 黄灯阈值 报警（黄），≥ 红灯阈值 报警（红）。
   周维度检索：支持按「年份 + 周别」切换；第 1 周 = 该年第一个星期六所在的那一周。
   配置外置：PKG Type 维护 / 每周目标数量 / 部门可见范围 均由独立配置页 op-config.html 维护，
     写入 localStorage（OPTypeStore / OPGoalStore / OPDeptStore），大屏与配置页共用同一份数据。
   凡标注「待客户确认 / 演示样例」的口径一律做成配置入口 OP_DEFAULTS，页面不写死，便于对接真实数据源。
   真实产出：客户 IT 导出的《BE1 Output Report V5.xls》已接入（见 assets/js/op-real-data.js，
     由 .extract-op.py 抽取）；有真实数据的周直接用真实值，其余周回落演示剖面。 */

const pad2 = n => String(n).padStart(2, '0');

function mulberry32OP(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ---------------- 维度定义：PKG Type（客户后台可增删改，此处为演示样例） ----------------
   单位：goal 为「周总目标 [K]」；price 为单价（元/粒）；color 用于图表与筛选高亮（不再在配置页维护）。
   报警阈值 yellowK / redK 为「每个 PKG Type 独立配置」（单位 K，差额比对）：
     缺口 ≥ yellowK → 黄灯；缺口 ≥ redK → 红灯。在「OP 目标与权限配置 · ① PKG Type 维护」逐项维护。 */
const OP_PKG_TYPES = [
  { id: 'BGA/LGA', name: 'BGA/LGA', color: '#1d4ed8', goal: 3680, price: 1.85, yellowK: 1, redK: 10, enabled: true },
  { id: 'PQFN', name: 'PQFN', color: '#0b6a86', goal: 200, price: 0.92, yellowK: 1, redK: 10, enabled: true },
  { id: 'QFN', name: 'QFN', color: '#8b5cf6', goal: 2400, price: 1.62, yellowK: 1, redK: 10, enabled: true },
  { id: 'FCCSP', name: 'FCCSP', color: '#a8620b', goal: 150, price: 2.30, yellowK: 1, redK: 10, enabled: true }
];

/* 单价兜底表（未在 PKG Type 上配置 price 时使用）。演示样例，待客户确认。 */
const OP_EARN_PRICE = { 'BGA/LGA': 1.85, 'PQFN': 0.92, 'QFN': 1.62, 'FCCSP': 2.30 };
function opPriceOf(id, types) {
  const list = types || OPTypeStore.all();
  const t = list.find(x => x.id === id);
  if (t && t.price != null && t.price !== '') return Number(t.price) || 0;
  return OP_EARN_PRICE[id] != null ? OP_EARN_PRICE[id] : 1.0;
}

/* ---------------- 演示剖面（仅在「该周没有真实数据」时作为回落） ----------------
   数组为「当日实际 / 当日目标」的比值（7 天，六→五）。已有真实数据的周（见 op-real-data.js）
   不会用到这里的数值，页面会标注「真实数据 / 演示数据」以作区分。
   设计原则：① 每个品类的比值都明显偏离 1，保证「目标线」与「实际线」不会重合
            ② 偏离方向保持同号并逐日累积，使两条线在图上呈现清晰可辨的张口
            ③ 四类分别覆盖 达标 / 临界 / 超标 三种状态，两张累计对比图都能看到红灯区间 */
const OP_DEMO_PROFILE = {
  'BGA/LGA': [1.040, 0.955, 0.870, 0.780, 0.740, 0.800, 0.900],  // 主力品类：周中大幅掉量 → 缺口逐日张口（超标·红灯）
  'PQFN':    [1.075, 1.065, 1.055, 1.048, 1.042, 1.036, 1.030],  // 稳定小幅超额 → 实际线始终在目标线上方（达标·绿灯）
  'QFN':     [1.055, 1.025, 0.985, 0.958, 0.978, 0.972, 0.995],  // 前高后弱 → 两线在临界带内交错穿越（临界·黄灯）
  'FCCSP':   [1.060, 0.905, 0.820, 0.720, 0.700, 0.780, 0.880]   // 明显欠产 → 深坑后缓慢回补（超标·红灯）
};
const OP_DEMO_PROFILE_DEFAULT = [1.08, 1.05, 1.02, 1.00, 0.98, 0.99, 1.00]; // 未在剖面表中的品类：温和超额后回落

/* ---------------- 预留配置入口（OP_DEFAULTS · 全部口径待客户确认） ---------------- */
const OP_DEFAULTS = {
  weekStart: 'Sat',          // 每周起始：周六
  // 报警阈值「兜底默认」（单位 K）：正常情况下阈值逐一挂在各 PKG Type 上
  // （在「OP 目标与权限配置 · ① PKG Type 维护」逐项维护），此处仅用于
  //  ① 品类尚未配置阈值时回落；② 多品类聚合阈值的基准。
  alarm: {
    yellowK: 1,              // 差额 ≥ 1K 黄灯（临界）
    redK: 10,                // 差额 ≥ 10K 红灯（超标）
    mode: 'diff'             // diff 差额比对（支持后续扩展 composite 复合比对）
  },
  refresh: { mode: 'manual', autoSec: 600 }, // 刷新机制：手动 + 自动（频率待 IT 确认，默认 10 分钟）
  dst: 'auto',               // 夏令时/冬令时：auto 自动 / summer 夏令时 / winter 冬令时
  dstWindow: {
    summer: '周六 06:00 - 周日 06:00',
    winter: '周六 07:00 - 周日 07:00'
  },
  source: '客户 IT 导出《BE1 Output Report V5.xls》'   // 实际 total 数据来源（已接入真实导出报表）
};

/* =========================================================================
   一、三个配置仓库（localStorage）· 大屏与配置页共用同一份数据
   ========================================================================= */

/* 1) PKG Type 维护（增删改：名称 / 颜色 / 单价 / 周默认目标 / 启用） */
const OPTypeStore = {
  all() {
    const v = store.get('op_pkg_types', null);
    if (Array.isArray(v) && v.length) return v.map(t => Object.assign({}, t));
    return OP_PKG_TYPES.map(t => Object.assign({}, t));
  },
  save(list) { store.set('op_pkg_types', list.map(t => Object.assign({}, t))); opAlarmCacheClear(); },
  reset() { store.set('op_pkg_types', OP_PKG_TYPES.map(t => Object.assign({}, t))); opAlarmCacheClear(); }
};

/* 2) 每周 PKG Type 目标数量：{ '2026-W40': { 'BGA/LGA': 3680, ... } }
      未单独配置的周，沿用 PKG Type 上的「默认周目标」。 */
const OPGoalStore = {
  all() { return store.get('op_week_goals', {}) || {}; },
  of(year, week) { return this.all()[opWeekKey(year, week)] || null; },
  set(year, week, map) { const a = this.all(); a[opWeekKey(year, week)] = map; store.set('op_week_goals', a); },
  remove(year, week) { const a = this.all(); delete a[opWeekKey(year, week)]; store.set('op_week_goals', a); },
  has(year, week) { return !!this.of(year, week); },
  keys() { return Object.keys(this.all()).sort(); }
};

/* 3) 部门可见范围：哪个部门可以看哪些 PKG Type（types 含 '*' 表示全部可见）
      客户口径（2026-09-30）：部门固定为 LEAD / NON-LEAD / PLATING 三个。 */
const OP_DEPARTMENTS = ['LEAD', 'NON-LEAD', 'PLATING'];
const OP_DEPT_SCOPE_DEFAULT = [
  { dept: 'LEAD', types: ['*'], note: '管理视角，可见全部 PKG Type' },
  { dept: 'NON-LEAD', types: ['BGA/LGA', 'PQFN', 'QFN'], note: '非 Lead 类产线，不含 FCCSP' },
  { dept: 'PLATING', types: ['FCCSP', 'QFN'], note: '电镀段，仅可见电镀相关品类' }
];
/* 部门清单：固定三个 + 历史配置里出现过的部门（兼容旧数据） */
function opDepartments() {
  const s = [];
  const push = d => { if (d && s.indexOf(d) < 0) s.push(d); };
  OP_DEPARTMENTS.forEach(push);
  (OPDeptStore.raw() || []).forEach(d => push(d.dept));
  return s;
}
const OPDeptStore = {
  raw() {
    const v = store.get('op_dept_scope', null);
    return Array.isArray(v) ? v.map(d => Object.assign({}, d)) : null;
  },
  all() {
    const v = this.raw();
    // 旧口径（生产部 / 封装部 …）的三部门迁移：存储里若不含 LEAD/NON-LEAD/PLATING，直接回落默认
    if (v && v.length && v.some(d => OP_DEPARTMENTS.indexOf(d.dept) >= 0)) return v;
    return OP_DEPT_SCOPE_DEFAULT.map(d => Object.assign({}, d));
  },
  save(list) { store.set('op_dept_scope', list.map(d => Object.assign({}, d))); },
  reset() { store.set('op_dept_scope', OP_DEPT_SCOPE_DEFAULT.map(d => Object.assign({}, d))); },
  /* 某部门可见的 PKG Type id 列表（'*' → 全部）；未配置部门默认全部可见 */
  visibleTypes(dept, allIds) {
    const row = this.all().find(d => d.dept === dept);
    if (!row || !row.types || !row.types.length) return allIds.slice();
    if (row.types.indexOf('*') >= 0) return allIds.slice();
    return allIds.filter(id => row.types.indexOf(id) >= 0);
  },
  configured(dept) { return this.all().some(d => d.dept === dept); },
  /* 演示用「视角部门」：真实环境应取当前登录用户所属部门，此处可手动切换以验证配置效果 */
  previewDept() {
    const v = store.get('op_preview_dept', '') || '';
    if (v && OP_DEPARTMENTS.indexOf(v) >= 0) return v;
    const d = (typeof CurrentUser !== 'undefined' && CurrentUser.dept && CurrentUser.dept()) || '';
    return OP_DEPARTMENTS.indexOf(d) >= 0 ? d : OP_DEPARTMENTS[0];
  },
  setPreviewDept(dept) { store.set('op_preview_dept', dept); }
};

/* =========================================================================
   二、周历工具（每周起始 = 周六；第 1 周 = 该年第一个星期六所在的那一周）
   ========================================================================= */
function opFirstSaturday(year) {
  const d = new Date(year, 0, 1);
  const add = (6 - d.getDay() + 7) % 7;      // 距该年第一个周六的天数
  d.setDate(d.getDate() + add);
  d.setHours(0, 0, 0, 0);
  return d;
}

/* 第 weekNo 周的起始日（周六） */
function opWeekStartOf(year, weekNo) {
  const d = opFirstSaturday(year);
  d.setDate(d.getDate() + (Math.max(1, weekNo | 0) - 1) * 7);
  return d;
}

/* 某年共有多少个「周六起始周」 */
function opWeeksInYear(year) {
  const a = opFirstSaturday(year), b = opFirstSaturday(year + 1);
  return Math.max(1, Math.round((b - a) / (7 * 86400000)));
}

function opWeekKey(year, week) { return year + '-W' + pad2(week); }

/* 取「本周六为起点」的起始日（供默认定位使用） */
function opWeekStart(base) {
  base = base || new Date();
  const d = new Date(base);
  const dow = d.getDay();                 // 0=周日, 6=周六
  const offset = (dow === 6) ? 0 : (dow + 1) % 7; // 距本周六的天数
  d.setDate(d.getDate() - offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

/* 某日期属于哪一年的第几周（以周六为周起始） */
function opWeekOf(base) {
  const start = opWeekStart(base);
  let y = start.getFullYear();
  const fs = opFirstSaturday(y);
  if (start.getTime() < fs.getTime()) y -= 1;   // 年初未到第一个周六 → 归属上一年最后一周
  const wk = Math.round((start - opFirstSaturday(y)) / (7 * 86400000)) + 1;
  return { year: y, week: wk, start: start };
}

/* 当前日期所处的年份 / 周别（页面默认定位） */
function opCurrentWeek() { return opWeekOf(new Date()); }

/* 由起始日展开 7 天（六→五），并标记今天 / 未来日 */
function opDaysFrom(start) {
  const wdName = ['六', '日', '一', '二', '三', '四', '五'];
  const t = new Date();
  const t0 = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
  const out = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i); d.setHours(0, 0, 0, 0);
    const ts = d.getTime();
    out.push({
      idx: i,
      date: d,
      label: `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`,
      weekday: wdName[i],
      isFirst: i === 0,
      isToday: ts === t0,
      isFuture: ts > t0        // 未来日期：尚无实际产出
    });
  }
  return out;
}

/* =========================================================================
   三、周维度累计数据生成
   每个 PKG Type：
     goalCum[i]  = 本周总目标按天均摊后的「累计值」（第 7 天精确等于周总目标）
     totalCum[i] = 实际产出「累计值」：该周若存在真实数据（assets/js/op-real-data.js，
       来自客户 IT 的《BE1 Output Report V5.xls》，按 MoveOutTime 归日、Qty 汇总为 K）
       则直接用真实值，没数据的日期留空（不编造）；否则回落到演示剖面生成、页面标注「演示数据」。
   单位均为 K（千颗）。未来日期 totalCum[i] = null。
   ========================================================================= */
function opGoalsOf(year, weekNo, types) {
  const list = types || OPTypeStore.all();
  const custom = OPGoalStore.of(year, weekNo);
  const map = {};
  list.forEach(t => {
    const c = custom && custom[t.id];
    map[t.id] = (c != null && c !== '') ? Number(c) : (Number(t.goal) || 0);
  });
  return map;
}

/* 该周的真实数据（无则返回 null）；数据来自 op-real-data.js 的 OP_REAL_DATA */
function opRealWeek(year, weekNo) {
  if (typeof OP_REAL_DATA === 'undefined' || !OP_REAL_DATA || !OP_REAL_DATA.weeks) return null;
  return OP_REAL_DATA.weeks[opWeekKey(year, weekNo)] || null;
}

/* 真实数据的元信息（数据来源 / 产出日期 / 批次），供页面标注；无数据时返回 null */
function opRealMeta() {
  return (typeof OP_REAL_DATA !== 'undefined' && OP_REAL_DATA) ? OP_REAL_DATA : null;
}

/* 本周「最后一个有实际产出的日期」下标（-1 = 整周无数据）。
   真实数据可能只覆盖周内部分日期（如首批只拿到一个产出日），
   各页面的基准日 / 差额比对应以它为界，而不是「今天」。 */
function opLastActualIdx(week) {
  let k = -1;
  if (!week || !week.byType) return k;
  Object.keys(week.byType).forEach(id => {
    const arr = week.byType[id].totalCum || [];
    for (let i = 0; i < arr.length; i++) if (arr[i] != null && i > k) k = i;
  });
  return k;
}

/* 基准日下标：优先「今天」（今天有数据时），否则取最后一个有数据的日期 */
function opFocusIdx(week, todayIdx, fallback) {
  const act = opLastActualIdx(week);
  if (act < 0) return typeof fallback === 'number' ? fallback : 6;
  return Math.min(todayIdx >= 0 ? todayIdx : fallback, act);
}

function genOpWeek(year, weekNo) {
  year = year || opCurrentWeek().year;
  weekNo = weekNo || opCurrentWeek().week;
  const types = OPTypeStore.all();
  const start = opWeekStartOf(year, weekNo);
  const days = opDaysFrom(start);
  const goals = opGoalsOf(year, weekNo, types);
  const rng = mulberry32OP(year * 1000 + weekNo * 7 + 20260929);
  const realWeek = opRealWeek(year, weekNo);
  const byType = {};
  types.filter(t => t.enabled !== false).forEach(t => {
    const weekGoal = goals[t.id] != null ? goals[t.id] : (Number(t.goal) || 0);
    const profile = OP_DEMO_PROFILE[t.id] || OP_DEMO_PROFILE_DEFAULT;
    const real = realWeek ? realWeek[t.id] : null;      // 真实每日产出（颗）；该品类可能无数据
    const goalCum = [], totalCum = [];
    let gAcc = 0, tExact = 0;
    for (let i = 0; i < 7; i++) {
      const prevG = i === 0 ? 0 : gAcc;
      // 当日目标 = 本周总目标均摊到当日的增量（累计值之差），第 7 天补足到精确周总目标
      const dailyGoal = i === 6 ? (weekGoal - gAcc) : Math.round(weekGoal * (i + 1) / 7 - prevG);
      gAcc += dailyGoal;
      goalCum.push(gAcc);

      if (realWeek) {
        // 真实数据周：只展示有数据的日期，缺数据的日期留空（不编造）
        const q = real ? real[i] : null;
        if (q == null) { totalCum.push(null); continue; }
        tExact += Number(q) / 1000;
        totalCum.push(Math.max(0, Math.round(tExact)));
        continue;
      }

      if (days[i].isFuture) { totalCum.push(null); continue; }   // 未来日：无实际值
      const noise = 0.99 + rng() * 0.02;
      // 注意：按「未取整的浮点累计」推进再取整。若先对每日实际取整，
      // 小目标品类（如周目标 200K）的零头会被逐日抹平，导致实际与目标完全重合。
      tExact += dailyGoal * profile[i] * noise;
      totalCum.push(Math.max(0, Math.round(tExact)));
    }
    goalCum[6] = weekGoal;            // 确保累计末值精确等于周总目标
    byType[t.id] = { goalCum, totalCum, weekGoal };
  });
  return {
    year, week: weekNo, key: opWeekKey(year, weekNo), start, days, byType, types,
    isReal: !!realWeek,                                     // 本周是否存在真实数据
    realTypes: realWeek ? Object.keys(realWeek).length : 0  // 真实数据覆盖的品类数
  };
}

/* =========================================================================
   四、达标状态判定（达标 / 临界 / 超标）
   差额 diff = total - goal（K，可负）。阈值逐个 PKG Type 配置（单位 K，见 opAlarmOf）：
     单品类判定用该品类自身阈值；多品类聚合判定用「各品类阈值之和」（见 opAlarmSum）。
     diff ≥ 0                      → 达标（green）
     0 < 缺口 < yellowK            → 达标（容差内，绿）
     yellowK ≤ 缺口 < redK         → 临界（yellow，黄灯）
     缺口 ≥ redK                   → 超标（red，红灯）
     total 为 null（未来日）        → 无数据（none）
   ========================================================================= */
/* PKG Type 阈值解析缓存：单元格逐个判定时会高频调用，避免反复读 localStorage。
   OPTypeStore.save / reset 后自动失效。 */
let _opAlarmCache = null;
function opAlarmCacheClear() { _opAlarmCache = null; }
function opAlarmMap() {
  if (_opAlarmCache) return _opAlarmCache;
  const d = OP_DEFAULTS.alarm;
  const num = v => {
    if (v == null || v === '') return null;
    const n = Number(v);
    return isFinite(n) && n >= 0 ? n : null;
  };
  const m = {};
  OPTypeStore.all().forEach(t => {
    const y = num(t.yellowK), r = num(t.redK);
    m[t.id] = { yellowK: y == null ? d.yellowK : y, redK: r == null ? d.redK : r, mode: d.mode };
  });
  _opAlarmCache = m;
  return m;
}

/* 单个 PKG Type 的报警阈值（K）：优先取该品类自身配置，缺失时回落 OP_DEFAULTS.alarm。
   —— 阈值挂在 PKG Type 上，品类不同阈值可以不同（大品类容忍更大缺口）。 */
function opAlarmOf(typeId) {
  const m = opAlarmMap();
  if (m[typeId]) return m[typeId];
  const d = OP_DEFAULTS.alarm;
  return { yellowK: d.yellowK, redK: d.redK, mode: d.mode };
}

/* 多 PKG Type 聚合阈值 = 参与汇总各品类阈值之和
   （聚合差额本身就是各品类缺口之和，阈值同量纲相加才可比）。 */
function opAlarmSum(typeIds) {
  const ids = (typeIds && typeIds.length) ? typeIds : OPTypeStore.all().map(t => t.id);
  let y = 0, r = 0;
  ids.forEach(id => { const a = opAlarmOf(id); y += a.yellowK; r += a.redK; });
  return { yellowK: +y.toFixed(1), redK: +r.toFixed(1), mode: OP_DEFAULTS.alarm.mode };
}

/* 阈值文案：单一品类 →「黄 1K / 红 10K」；多品类 →「黄 4K / 红 40K（4 类合计）」 */
function opAlarmText(typeIds) {
  const ids = typeIds || [];
  if (ids.length === 1) {
    const a = opAlarmOf(ids[0]);
    return '黄 ' + a.yellowK + 'K / 红 ' + a.redK + 'K';
  }
  const s = opAlarmSum(ids);
  return '黄 ' + s.yellowK + 'K / 红 ' + s.redK + 'K（' + ids.length + ' 类合计）';
}

function opStatusOf(goal, total, cfg) {
  const c = cfg || OP_DEFAULTS.alarm;
  if (total == null) return { diff: null, level: 'none', status: 'none', rate: null, goal, total: null };
  const diff = +(total - goal).toFixed(1);   // K
  const s = -diff;                            // 缺口绝对值
  let level, status;
  if (diff >= 0) { level = 'green'; status = 'met'; }
  else if (s < c.yellowK) { level = 'green'; status = 'met'; }
  else if (s < c.redK) { level = 'yellow'; status = 'critical'; }
  else { level = 'red'; status = 'over'; }
  const rate = goal > 0 ? (total / goal * 100) : 100;
  return { diff, level, status, rate: +rate.toFixed(1), goal, total };
}

/* 单品类每日状态：阈值默认取该 PKG Type 自身配置，cfg 传入时按传入值覆盖
   （配置页在未保存时就地预览某个品类的阈值变化）。 */
function opStatus(typeId, dayIdx, week, cfg) {
  const t = week && week.byType[typeId];
  if (!t) return { diff: null, level: 'none', status: 'none', rate: null, goal: 0, total: null };
  return opStatusOf(t.goalCum[dayIdx], t.totalCum[dayIdx], cfg || opAlarmOf(typeId));
}

/* 多 PKG Type 聚合状态（用于图表/底部汇总标注）。未来日不参与聚合。
   阈值 = 参与聚合各品类阈值之和；cfg 传入时按传入值覆盖。 */
function opAggStatus(typeIds, dayIdx, week, cfg) {
  let goal = 0, total = 0, any = false;
  typeIds.forEach(id => {
    const t = week.byType[id]; if (!t) return;
    goal += t.goalCum[dayIdx];
    if (t.totalCum[dayIdx] != null) { total += t.totalCum[dayIdx]; any = true; }
  });
  if (!any) return { diff: null, level: 'none', status: 'none', rate: null, goal, total: null };
  return opStatusOf(goal, total, cfg || opAlarmSum(typeIds));
}

/* 某 PKG Type 本周是否出现过红灯 / 黄灯（用于筛选标签告警）。阈值取该品类自身配置。 */
function opTypeAlarm(typeId, week, cfg) {
  const t = week && week.byType[typeId];
  const res = { red: 0, yellow: 0, worst: 'none', worstDay: -1, maxGap: 0 };
  if (!t) return res;
  const ac = cfg || opAlarmOf(typeId);
  for (let i = 0; i < 7; i++) {
    const st = opStatusOf(t.goalCum[i], t.totalCum[i], ac);
    if (st.status === 'over') { res.red++; if (res.worst !== 'over') { res.worst = 'over'; res.worstDay = i; } }
    else if (st.status === 'critical') { res.yellow++; if (res.worst === 'none' || res.worst === 'met') { res.worst = 'critical'; res.worstDay = i; } }
    const gap = st.diff == null ? 0 : -st.diff;
    if (gap > res.maxGap) res.maxGap = +gap.toFixed(1);
  }
  if (res.red && res.worst !== 'over') res.worst = 'over';
  return res;
}

/* =========================================================================
   五、Earn 金额累计（万元）
   Earn(万) = Σ_type (累计 K × 1000 × 单价元/粒) / 10000 = Σ_type (累计 K × 单价 / 10)
   types 为参与汇总的 PKG Type id 列表（受筛选影响）。
   ========================================================================= */
function opEarnSeries(typeIds, week, typeList) {
  const goalCum = [0, 0, 0, 0, 0, 0, 0], totalCum = [null, null, null, null, null, null, null];
  let started = false;
  typeIds.forEach(id => {
    const t = week.byType[id]; if (!t) return;
    const p = opPriceOf(id, typeList) / 10;   // K → 万元 折算系数
    for (let i = 0; i < 7; i++) {
      goalCum[i] += t.goalCum[i] * p;
      if (t.totalCum[i] != null) { totalCum[i] = (totalCum[i] || 0) + t.totalCum[i] * p; started = true; }
    }
  });
  return {
    goalCum: goalCum.map(v => +v.toFixed(1)),
    totalCum: totalCum.map(v => (v == null ? null : +v.toFixed(1))),
    started
  };
}

/* =========================================================================
   六、状态 → 文案/配色（供页面徽标与图例复用）
   ========================================================================= */
function opStatusInfo(status) {
  return ({
    met: { label: '达标', color: '#12805a', dot: 'dot-success', badge: 'b-success', light: '绿灯' },
    critical: { label: '临界', color: '#a8620b', dot: 'dot-warn', badge: 'b-warn', light: '黄灯' },
    over: { label: '超标', color: '#cc2f2a', dot: 'dot-danger', badge: 'b-danger', light: '红灯' },
    none: { label: '无数据', color: '#8a95a5', dot: 'dot-neutral', badge: 'b-neutral', light: '—' }
  })[status] || { label: '—', color: '#8a95a5', dot: 'dot-neutral', badge: 'b-neutral', light: '—' };
}

/* ---------------- 对外统一数据生成（供页面与监控室轮播调用） ---------------- */
const OP_WEEK = genOpWeek(opCurrentWeek().year, opCurrentWeek().week);

/* 帮助：某 PKG Type 截至某日的累计达成率 */
function opWeekRate(typeId, dayIdx, week) {
  const t = week.byType[typeId]; if (!t) return 100;
  return t.goalCum[dayIdx] > 0 ? (t.totalCum[dayIdx] / t.goalCum[dayIdx] * 100) : 100;
}
