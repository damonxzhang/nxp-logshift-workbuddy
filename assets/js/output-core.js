/* ================= OP 专属大屏 · Output（OP）数据引擎 =================
   需求来源：《会议纪要_20260929.html》Output（OP）系统配置与逻辑。
   本屏为演示原型，数据由确定性伪随机生成，刷新可复现（mulberry32）。
   凡标注「待客户确认」的口径（价格/目标值生成/夏令时/报警阈值/刷新频率）
   一律做成配置入口 OP_DEFAULTS，页面不写死，便于后续对接真实数据源。 */

const pad2 = n => String(n).padStart(2, '0');

function mulberry32OP(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ---------------- 维度定义 ---------------- */
const OP_PART_TYPES = [
  { id: 'BGA', name: 'BGA', color: '#1d4ed8' },
  { id: 'PQ', name: 'PQ', color: '#0b6a86' },
  { id: 'Calvin', name: 'Calvin', color: '#8b5cf6' },
  { id: 'Lichip', name: 'Lichip', color: '#a8620b' }
];

/* 工序（Process Step）：QA 为最后一站，最终 Output 以 QA 过后数据为准 */
const OP_STEPS = [
  { id: 'DB', name: 'DB 固晶', final: false },
  { id: 'WB', name: 'WB 键合', final: false },
  { id: 'Mold', name: 'Mold 塑封', final: false },
  { id: 'Trim', name: 'Trim 切筋', final: false },
  { id: 'Plating', name: 'Plating 电镀', final: false },
  { id: 'QA', name: 'QA 质检', final: true }
];
const OP_FINAL_STEP = 'QA 质检';

/* 机台号（按工序） */
const OP_MACHINES = {
  'DB 固晶': ['DB-01', 'DB-02'],
  'WB 键合': ['WB-01', 'WB-02', 'WB-03'],
  'Mold 塑封': ['MD-01', 'MD-02'],
  'Trim 切筋': ['TR-01', 'TR-02'],
  'Plating 电镀': ['PL-01', 'PL-02'],
  'QA 质检': ['QA-01', 'QA-02', 'QA-03']
};

/* ---------------- 基础价格配置（B 列 Device / G 列 单价 / 部门） ----------------
   兼容带 "99"（出货）与不带 "99"（本厂测试转化）编码，视为同一物料不同状态，价格一致。 */
const OP_PRICE_RAW = [
  ['BGA256', 'BGA', '封装一部', 1.85],
  ['BGA25699', 'BGA', '封装一部', 1.85],
  ['BGA169', 'BGA', '封装一部', 1.62],
  ['PQ48', 'PQ', '封装二部', 0.92],
  ['PQ4899', 'PQ', '封装二部', 0.92],
  ['PQ64', 'PQ', '封装二部', 1.05],
  ['CALV20', 'Calvin', '封装三部', 2.30],
  ['CALV2099', 'Calvin', '封装三部', 2.30],
  ['LCH10', 'Lichip', '封装三部', 1.45],
  ['LCH1099', 'Lichip', '封装三部', 1.45]
];

function strip99(code) { return code.replace(/99$/, ''); }

const OP_PRICE_TABLE = OP_PRICE_RAW.map(r => ({
  device: r[0], partType: r[1], dept: r[2], price: r[3], base: strip99(r[0])
}));

/* 各 Part Type 均价（用于 Earning 估算） */
const OP_PRICE_BY_TYPE = OP_PART_TYPES.reduce((a, t) => {
  const rows = OP_PRICE_TABLE.filter(p => p.partType === t.id);
  a[t.id] = rows.reduce((s, p) => s + p.price, 0) / rows.length;
  return a;
}, {});

/* ---------------- 预留配置入口（OP_DEFAULTS · 全部口径待客户确认） ---------------- */
const OP_DEFAULTS = {
  weekStart: 'Sat',          // 每周起始：周六（纪要确认需修正原周日设定）
  targetMode: 'avg',         // 目标值生成：avg 平均分配 / linear 线性递增（优先数据源准确）
  refresh: { mode: 'manual', autoSec: 600 }, // 刷新机制：手动 + 自动（频率待 IT 确认，默认 10 分钟）
  dst: 'auto',               // 夏令时/冬令时：auto 自动 / summer 夏令时 / winter 冬令时
  dstWindow: {
    summer: '周六 06:00 - 周日 06:00',
    winter: '周六 07:00 - 周日 07:00'
  },
  // 每周首日（周六）各 Part Type 目标值（单位：粒，演示样例）
  weeklyGo: { BGA: 120000, PQ: 90000, Calvin: 60000, Lichip: 45000 },
  // 异常报警配置（按部门配置，缺省走全局）
  alarm: {
    yellowK: 1000,           // 差额 ≥ 1K 黄灯
    redK: 10000,             // 差额 ≥ 10K 红灯
    mode: 'diff',            // diff 差额比对 / composite 复合比对
    wipRatio: 0.15,          // 复合比对：配置 WIP 占比（实际 + WIP占比×目标 ≥ 目标即达标）
    byDept: {}               // 预留：部门级覆盖，如 { '封装一部': { yellowK:2000, redK:15000, wipRatio:0.2 } }
  },
  source: '待客户确认'        // 数据来源（真实库表/SQL 待业务方 10-06 现场提供）
};

/* ---------------- 时间工具：本周六为起点 ---------------- */
function opWeekStart(base) {
  base = base || new Date();
  const d = new Date(base);
  const dow = d.getDay();                 // 0=周日, 6=周六
  const offset = (dow === 6) ? 0 : (dow + 1) % 7; // 距本周六的天数
  d.setDate(d.getDate() - offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

function opWeekDays(base) {
  const start = opWeekStart(base);
  const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const out = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    out.push({
      idx: i,
      date: d,
      label: `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`,
      weekday: i === 0 ? '周六(首)' : names[d.getDay()],
      isToday: (function () { const t = new Date(); return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate(); })()
    });
  }
  return out;
}

/* ---------------- 一级界面：每周每日 Go / Total / 前线Total / Earning ---------------- */
function genOpWeek(base) {
  const rng = mulberry32OP(20260929);
  const days = opWeekDays(base);
  // byType[type] = [{ go, actual, front, earning, status }, ... 7 天]
  const byType = {};
  OP_PART_TYPES.forEach(t => {
    const firstGo = OP_DEFAULTS.weeklyGo[t.id] || 0;
    const arr = [];
    const basePrice = OP_PRICE_BY_TYPE[t.id] || 1;
    for (let i = 0; i < 7; i++) {
      // 目标值生成：avg 模式 = 首日值直接沿用（平均分配）；linear 模式 = 首日值按 ±8% 线性爬坡
      let go = firstGo;
      if (OP_DEFAULTS.targetMode === 'linear') {
        const f = 0.92 + (i / 6) * 0.16; // 0.92 → 1.08
        go = Math.round(firstGo * f);
      }
      // 实际数量：围绕目标 ±12% 波动，制造达标/缺口混合（用于触发报警）
      const actual = Math.round(go * (0.86 + rng() * 0.26));
      // 前线实际数量：约为实际的 70%~92%
      const front = Math.round(actual * (0.70 + rng() * 0.22));
      // Earning Total：基于后线实际数量 × 配置价格（元）→ 转万元展示
      const earning = +(actual * basePrice / 10000).toFixed(2);
      arr.push({ go, actual, front, earning, diff: actual - go });
    }
    byType[t.id] = arr;
  });
  return { days, byType };
}

/* 汇总某日（或全部 Part Type 累加）的 KPI */
function opDayKPI(week, dayIdx, typeFilter) {
  const types = typeFilter && typeFilter !== 'all'
    ? OP_PART_TYPES.filter(t => t.id === typeFilter)
    : OP_PART_TYPES;
  let go = 0, total = 0, front = 0, earning = 0;
  types.forEach(t => {
    const r = week.byType[t.id][dayIdx];
    go += r.go; total += r.actual; front += r.front; earning += r.earning;
  });
  return { go, total, front, earning };
}

/* 报警判定（差额比对 / 复合比对，支持部门级覆盖） */
function opAlarm(typeId, dayIdx, week) {
  const r = week.byType[typeId][dayIdx];
  const dept = (OP_PRICE_TABLE.find(p => p.partType === typeId) || {}).dept || '';
  const cfg = Object.assign({}, OP_DEFAULTS.alarm, OP_DEFAULTS.alarm.byDept[dept] || {});
  const diff = r.actual - r.go;                 // 缺口为负
  if (cfg.mode === 'composite') {
    const composite = r.actual + r.go * cfg.wipRatio;
    const ok = composite >= r.go;
    const level = ok ? 'green' : (Math.abs(diff) >= cfg.redK ? 'red' : (Math.abs(diff) >= cfg.yellowK ? 'yellow' : 'green'));
    return { mode: 'composite', diff, level, composite: Math.round(composite), ok };
  }
  // diff 差额比对
  let level = 'green';
  if (diff < -cfg.redK) level = 'red';
  else if (diff < -cfg.yellowK) level = 'yellow';
  else if (diff >= 0) level = 'green';
  else level = 'green';
  return { mode: 'diff', diff, level, ok: diff >= 0 };
}

/* ---------------- 二级界面：工序 → Part Type / 工序 → 机台号 实际 Output ----------------
   所有中间工序仅为过程监控，最终 Output 以 QA（最后一站）为准。 */
function genOpStepOutput(base) {
  const rng = mulberry32OP(909018);
  const out = { byType: {}, byMachine: {}, stepTotal: {}, finalTotal: {} };
  // 最终站（QA）实际产出基准：取本周日均实际量的确定性缩放
  const weekAvg = OP_PART_TYPES.reduce((a, t) => {
    a[t.id] = Math.round((OP_DEFAULTS.weeklyGo[t.id] || 0) * 0.97);
    return a;
  }, {});

  OP_STEPS.forEach(s => {
    const isFinal = s.final;
    // 中间工序产出略高于最终站（含在制/报废），最终站=权威值
    const factor = isFinal ? 1.0 : (1.04 + rng() * 0.10);
    out.byType[s.name] = {};
    out.byMachine[s.name] = {};
    let stepSum = 0;
    OP_PART_TYPES.forEach(t => {
      const v = Math.round(weekAvg[t.id] * factor * (0.9 + rng() * 0.2));
      out.byType[s.name][t.id] = v;
      stepSum += v;
    });
    out.stepTotal[s.name] = stepSum;
    let mSum = 0;
    OP_MACHINES[s.name].forEach(m => {
      const v = Math.round(stepSum / OP_MACHINES[s.name].length * (0.8 + rng() * 0.4));
      out.byMachine[s.name][m] = v;
      mSum += v;
    });
    out.byMachine[s.name].__sum = mSum;
  });
  out.finalTotal = out.stepTotal[OP_FINAL_STEP];
  return out;
}

/* ---------------- 对外统一数据生成（供页面与监控室轮播调用） ---------------- */
const OP_WEEK = genOpWeek(new Date());
const OP_STEP_OUTPUT = genOpStepOutput(new Date());

/* 帮助：状态灯文案 */
function opLightInfo(level) {
  return ({
    green: { label: '达标', color: '#12805a', dot: 'dot-success' },
    yellow: { label: '缺口预警', color: '#a8620b', dot: 'dot-warn' },
    red: { label: '缺口严重', color: '#cc2f2a', dot: 'dot-danger' }
  })[level] || { label: '—', color: '#8a95a5', dot: 'dot-neutral' };
}
