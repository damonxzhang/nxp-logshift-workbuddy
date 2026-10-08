/* 图表说明文档 · 数据探针（开发用）
   把三条主干（运维告警 / OP 产出 / WIP 在制）的真实计算结果导出为 .doc-data.json，
   供 图表逻辑关系说明.html 内联渲染使用。不修改任何工程代码。 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

/* —— 三个独立沙箱：两个引擎各自声明了 pad2 等同名常量，必须隔离作用域 ——
   注意：vm 的顶层 const 会留在该 context 的全局词法环境里，同一 context 重复声明会报错。 */
const mem = {};
const mkLS = () => ({
  getItem: k => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: k => { delete mem[k]; }
});
const JS = p => path.join(__dirname, 'assets/js', p);

/* common.js 里 store 的实现（只用到 localStorage，桩进来即可；不加载 common.js 以免其 DOM 代码报错） */
const STORE_SHIM = `
const store = {
  get(k, def) { try { const v = localStorage.getItem('ohd_' + k); return v === null ? def : JSON.parse(v); } catch (e) { return def; } },
  set(k, v) { try { localStorage.setItem('ohd_' + k, JSON.stringify(v)); } catch (e) { } }
};
`;

function sandbox(files, prelude) {
  const ctx = vm.createContext({ localStorage: mkLS(), console });
  /* wip-real-data.js 用 window.X = ... 挂载，浏览器里 window 即全局对象，这里等价模拟 */
  vm.runInContext('var window = globalThis;', ctx, { filename: 'window-shim.js' });
  if (prelude) vm.runInContext(prelude, ctx, { filename: 'prelude.js' });
  files.forEach(f => vm.runInContext(fs.readFileSync(JS(f), 'utf8'), ctx, { filename: f }));
  ctx.__g = expr => vm.runInContext(expr, ctx);
  return ctx;
}

/* A：运维告警主干（data.js 提供 SUBSYSTEMS，analytics-core.js 依赖它算部门） */
const A = sandbox(['data.js', 'analytics-core.js']);
/* B：OP 产出主干（output-core.js 依赖 localStorage 桩） */
const B = sandbox(['op-real-data.js', 'output-core.js'], STORE_SHIM);
/* C：WIP 在制主干 */
const C = sandbox(['wip-real-data.js']);

const ALARM_RECORDS = A.__g('ALARM_RECORDS');
const SUBSYSTEMS = A.__g('SUBSYSTEMS');
const g = B.__g;   /* 下文中 g('...') 默认指 OP 引擎沙箱 */
const gA = A.__g, gC = C.__g;

const OUT = {};

/* ================= 主干 ① 运维告警 ================= */
(() => {
  const recs = ALARM_RECORDS;
  const day = gA('computeAlarmStats(ALARM_RECORDS, { granularity: "day", dim: "keyword" })');
  const week = gA('computeAlarmStats(ALARM_RECORDS, { granularity: "week", dim: "keyword" })');
  const month = gA('computeAlarmStats(ALARM_RECORDS, { granularity: "month", dim: "keyword" })');
  const compact = st => ({
    labels: st.series.labels,
    counts: st.series.counts,
    criticals: st.series.criticals
  });
  OUT.alarm = {
    total: day.total,
    critical: day.critical,
    warn: day.warn,
    normal: day.normal,
    byStatus: day.byStatus,
    closedRate: day.closedRate,
    byType: day.byType,
    trendDay: compact(day),
    trendWeek: compact(week),
    trendMonth: compact(month),
    top10: day.top.map(t => ({ label: t.label, value: t.value, systems: t.systems, pct: t.pct, recent: t.recent })),
    clusters: day.clusters.slice(0, 6).map(c => ({
      kw: c.keyword || c.kw, cat: c.category || c.cat, n: c.count || c.n,
      sys: (c.systems || c.sys || []).join(' / '),
      type: c.clusterType || c.type,
      root: c.root || '', suggestion: c.suggestion || ''
    })),
    clusterTotal: day.clusters.length,
    range: day.range
  };
})();

/* ================= 主干 ② OP 产出 ================= */
(() => {
  const cw = g('opCurrentWeek()');
  const key = g('opWeekKey(opCurrentWeek().year, opCurrentWeek().week)');
  const wk = g('genOpWeek(opCurrentWeek().year, opCurrentWeek().week)');
  const types = g('OPTypeStore.all().filter(t => t.enabled !== false).map(t => t.id)');
  const allTypes = g('OPTypeStore.all()');
  const days = wk.days.map(d => d.date || d.label || '');
  const aggGoal = [0, 0, 0, 0, 0, 0, 0];
  const aggTotal = [null, null, null, null, null, null, null];
  types.forEach(id => {
    const t = wk.byType[id]; if (!t) return;
    for (let i = 0; i < 7; i++) {
      aggGoal[i] += t.goalCum[i];
      if (t.totalCum[i] != null) aggTotal[i] = (aggTotal[i] || 0) + t.totalCum[i];
    }
  });
  const earn = g(`opEarnSeries(${JSON.stringify(types)}, genOpWeek(opCurrentWeek().year, opCurrentWeek().week), OPTypeStore.all())`);
  const todayIdx = g('opDaysFrom(opWeekStartOf(opCurrentWeek().year, opCurrentWeek().week)).findIndex(d => d.isToday)');
  const focusIdx = g(`opFocusIdx(genOpWeek(opCurrentWeek().year, opCurrentWeek().week), ${todayIdx}, 0)`);

  const statuses = [], redDays = [], yellows = [];
  for (let i = 0; i < 7; i++) {
    const st = g(`opAggStatus(${JSON.stringify(types)}, ${i}, genOpWeek(opCurrentWeek().year, opCurrentWeek().week))`);
    statuses.push(st.status);
    if (st.status === 'over') redDays.push(i);
    if (st.status === 'critical') yellows.push(i);
  }

  const byType = types.map(id => {
    const st = g(`opStatus(${JSON.stringify(id)}, ${focusIdx}, genOpWeek(opCurrentWeek().year, opCurrentWeek().week))`);
    const al = g(`opTypeAlarm(${JSON.stringify(id)}, genOpWeek(opCurrentWeek().year, opCurrentWeek().week))`);
    const a = g(`opAlarmOf(${JSON.stringify(id)})`);
    const t = wk.byType[id];
    const cfg = allTypes.find(x => x.id === id) || {};
    return {
      id, color: cfg.color || '#1d4ed8', price: cfg.price, weekGoal: t ? t.weekGoal : 0,
      goal: st.goal, actual: st.total, diff: st.diff, rate: st.rate, status: st.status,
      yellowK: a.yellowK, redK: a.redK,
      redDays: al.red, yellowDays: al.yellow, maxGap: al.maxGap,
      goalCum: t ? t.goalCum : [], totalCum: t ? t.totalCum : []
    };
  });

  OUT.op = {
    weekKey: key, isReal: wk.isReal, realTypes: wk.realTypes,
    dayLabels: wk.days.map(d => d.wn || d.label || ''),
    dayDates: days, todayIdx, focusIdx,
    types, goalCum: aggGoal, totalCum: aggTotal,
    earnGoalCum: earn.goalCum, earnTotalCum: earn.totalCum,
    statuses, redDays, yellows,
    sumYellow: g(`opAlarmSum(${JSON.stringify(types)}).yellowK`),
    sumRed: g(`opAlarmSum(${JSON.stringify(types)}).redK`),
    alarmText: g(`opAlarmText(${JSON.stringify(types)})`),
    gapAtFocusQty: (aggTotal[focusIdx] == null ? null : Math.round((aggTotal[focusIdx] - aggGoal[focusIdx]) * 10) / 10),
    earnNormalizedMax: Math.round(aggGoal[6] * 1.08),
    byType,
    /* 对照用：取上一周（W38，覆盖 2026-09-19 起，无真实数据 → 走演示剖面），
       用来展示「均摊目标 / 累计曲线 / 红灯日 / 基准日」在数据完整时的形态 */
    demo: (() => {
      const w = g('opCurrentWeek().week') - 1;
      const y = g('opCurrentWeek().year');
      const wk2 = g(`genOpWeek(${y}, ${w})`);
      const tg = [0,0,0,0,0,0,0], tt = [null,null,null,null,null,null,null];
      types.forEach(id => { const t = wk2.byType[id]; if (!t) return;
        for (let i = 0; i < 7; i++) { tg[i] += t.goalCum[i]; if (t.totalCum[i] != null) tt[i] = (tt[i] || 0) + t.totalCum[i]; } });
      const e2 = g(`opEarnSeries(${JSON.stringify(types)}, genOpWeek(${y}, ${w}), OPTypeStore.all())`);
      const st2 = [], rd = [], yl = [];
      for (let i = 0; i < 7; i++) {
        const st = g(`opAggStatus(${JSON.stringify(types)}, ${i}, genOpWeek(${y}, ${w}))`);
        st2.push(st.status); if (st.status === 'over') rd.push(i); if (st.status === 'critical') yl.push(i);
      }
      return {
        year: y, week: w, key: g(`opWeekKey(${y}, ${w})`),
        dayDates: wk2.days.map(d => d.date || ''),
        goalCum: tg, totalCum: tt,
        earnGoalCum: e2.goalCum, earnTotalCum: e2.totalCum,
        statuses: st2, redDays: rd, yellows: yl,
        byDayGoal: (() => { const a = []; for (let i = 0; i < 7; i++) a.push(tg[i] - (i ? tg[i-1] : 0)); return a; })()
      };
    })()
  };
})();

/* ================= 主干 ③ WIP 在制 ================= */
(() => {
  const rows = gC('WIP_REAL_DATA.rows');
  const meta = gC('WIP_REAL_DATA.meta');
  const types = g('OPTypeStore.all().map(t => t.id)');
  const priceKey = t => (t === 'LGA' || t === 'BGA') ? 'BGA/LGA' : t;
  const priceOf = t => g(`opPriceOf(${JSON.stringify(priceKey(t))})`) || 1;

  const order = [], seenS = {}, sIdx = {};
  rows.forEach(r => { if (!(r[0] in seenS)) { seenS[r[0]] = 1; sIdx[r[0]] = order.length; order.push(r[0]); } });
  const tSeen = {}, tOrder = [], tIdx = {};
  rows.forEach(r => { if (!(r[1] in tSeen)) { tSeen[r[1]] = 1; tIdx[r[1]] = tOrder.length; tOrder.push(r[1]); } });

  const stepMap = order.map(n => ({ name: n, qty: 0, lots: 0, hold: 0, otd: 0, byType: tOrder.map(() => 0) }));
  const typeMap = tOrder.map(t => ({ id: t, qty: 0, lots: 0, color: (g(`OPTypeStore.all().find(x => x.id === ${JSON.stringify(priceKey(t))})`) || {}).color || '#1d4ed8' }));
  const lots = [];
  let totalQty = 0, totalHold = 0, totalOtd = 0, totalEarn = 0;

  rows.forEach(r => {
    const si = sIdx[r[0]], ti = tIdx[r[1]], qty = Number(r[7]) || 0;
    const ct = r[10] == null ? null : Number(r[10]), hold = Number(r[13]) || 0;
    const otd = r[12] == null ? null : Number(r[12]);
    stepMap[si].qty += qty; stepMap[si].lots++;
    stepMap[si].byType[ti] += qty;
    if (hold > 0) stepMap[si].hold++;
    if (otd != null && otd < 0) stepMap[si].otd++;
    typeMap[ti].qty += qty; typeMap[ti].lots++;
    totalQty += qty; totalEarn += qty * priceOf(r[1]) / 10000;
    if (hold > 0) totalHold++;
    if (otd != null && otd < 0) totalOtd++;
    lots.push([si, ti, ct, qty, hold, otd]);
  });

  /* 报警分级（与 wip.js / wip-viz.js 一致：CT ≥ ctR 或 OTD < otd → 红；CT ≥ ctY → 黄） */
  const AL = JSON.parse(mem["ohd_wip_alarm"] || "null") || { ctY: 7, ctR: 14, otd: 0 };
  let nRed = 0, nAmber = 0, ctHave = 0, nRedWithCt = 0;
  const ctAll = [];
  lots.forEach(l => {
    const ct = l[2], otd = l[5];
    const isRed = (ct != null && ct >= AL.ctR) || (otd != null && otd < AL.otd);
    if (ct != null) { ctHave++; ctAll.push(ct); if (isRed) nRedWithCt++; }
    if (isRed) nRed++;
    else if (ct != null && ct >= AL.ctY) nAmber++;
  });
  ctAll.sort((a, b) => a - b);
  const q = p => ctAll[Math.min(ctAll.length - 1, Math.floor(ctAll.length * p))];

  OUT.wip = {
    meta,
    alarm: AL,
    totalQtyK: Math.round(totalQty / 100) / 10,
    totalLots: rows.length,
    totalHold, totalOtd,
    totalEarnWan: Math.round(totalEarn * 10) / 10,
    stepOrder: order,
    typeOrder: tOrder,
    typeMap: typeMap.map(t => ({ ...t, qtyK: Math.round(t.qty / 100) / 10 })),
    stepMap: stepMap.map(s => ({ ...s, qtyK: Math.round(s.qty / 100) / 10 })),
    ct: {
      have: ctHave, red: nRed, amber: nAmber, redWithCt: nRedWithCt,
      min: q(0), p25: q(.25), med: q(.5), p75: q(.75), p90: q(.9), max: q(1),
      avg: Math.round(ctAll.reduce((a, b) => a + b, 0) / ctAll.length * 100) / 100
    },
    lots
  };
})();

/* ================= index.html 页面自带演示数组（不在主干上） ================= */
OUT.indexDemo = {
  hours: (() => { const a = []; for (let i = 23; i >= 0; i--) a.push(i); return a; })(),
  base: [97, 98, 97, 96, 98, 97, 96, 95, 94, 92, 88, 87, 89, 91, 86, 84, 86, 88, 89, 90, 91, 93, 94, 95],
  abase: [1, 0, 2, 1, 0, 1, 1, 2, 1, 4, 7, 6, 3, 5, 8, 9, 6, 4, 3, 2, 2, 1, 1, 0],
  levelDist: [
    { label: '特急 / Critical', value: 2, color: '#cc2f2a' },
    { label: '重要 / Major', value: 5, color: '#e0912a' },
    { label: '一般 / Minor', value: 16, color: '#1d4ed8' },
    { label: '提示 / Info', value: 9, color: '#0b6a86' }
  ],
  subsystems: SUBSYSTEMS.map(s => ({ id: s.id, name: s.name, health: s.health, status: s.status }))
};

/* ================= ingest 页的失败分布 / 慢接口（演示数组） ================= */
(() => {
  const ingest = fs.readFileSync(JS('page-ingest.js'), 'utf8');
  const m = ingest.match(/const failDist = \[[\s\S]*?\];/);
  OUT.ingestRaw = m ? m[0] : null;
})();

fs.writeFileSync(path.join(__dirname, '.doc-data.json'), JSON.stringify(OUT, null, 1), 'utf8');
console.log('OK  alarm.total=' + OUT.alarm.total + '  op.weekKey=' + OUT.op.weekKey +
  '  wip.lots=' + OUT.wip.totalLots + '  wip.qtyK=' + OUT.wip.totalQtyK +
  '  ct.red=' + OUT.wip.ct.red + '  ct.amber=' + OUT.wip.ct.amber + '  ct.have=' + OUT.wip.ct.have);
console.log('top10:', OUT.alarm.top10.map(t => t.label + '=' + t.value + '(' + t.pct + '%)').join(' | '));
console.log('alarm.trendDay 前12:', OUT.alarm.trendDay.labels.slice(0, 12).join(','), '| counts', OUT.alarm.trendDay.counts.slice(0, 12).join(','));
console.log('alarm.trendMonth:', OUT.alarm.trendMonth.labels.join(','), '|', OUT.alarm.trendMonth.counts.join(','));
console.log('alarm.clusters:', OUT.alarm.clusters.length, JSON.stringify(OUT.alarm.clusters.slice(0, 2)));
console.log('wip.ct:', JSON.stringify(OUT.wip.ct));
console.log('op.demo:', OUT.op.demo.key, 'goalCum=', OUT.op.demo.goalCum.join(','), ' totalCum=', OUT.op.demo.totalCum.join(','));
console.log('op.demo.statuses:', OUT.op.demo.statuses.join(','), 'redDays=', JSON.stringify(OUT.op.demo.redDays), 'yellows=', JSON.stringify(OUT.op.demo.yellows));
console.log('op.earn(real):', OUT.op.earnGoalCum.join(','), '|', OUT.op.earnTotalCum.join(','));
console.log('size:', (fs.statSync(path.join(__dirname, '.doc-data.json')).size / 1024).toFixed(1) + ' KB');
console.log('op.byType:', OUT.op.byType.map(t => t.id + ' goal=' + t.goal + ' actual=' + t.actual + ' ' + t.status).join(' | '));
console.log('op.statuses:', OUT.op.statuses.join(','), ' redDays=', JSON.stringify(OUT.op.redDays), ' focusIdx=', OUT.op.focusIdx);
console.log('wip.steps(前6):', OUT.wip.stepMap.slice(0, 6).map(s => s.name + '=' + s.qtyK + 'K/' + s.lots + '批').join(' | '));
console.log('wip.types:', OUT.wip.typeMap.map(t => t.id + '=' + t.qtyK + 'K').join(' | '));
