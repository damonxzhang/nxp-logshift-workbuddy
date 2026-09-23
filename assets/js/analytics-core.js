/* ================= 异常根因分析 & 高频告警统计 · 核心引擎 =================
   本文件提供：
     1) 确定性生成近 180 天告警样例数据（含关键词 / 来源系统 / 根因分类 / 等级 / 部门 / 状态 / 处置时长）
     2) computeAlarmStats()  —— 按日/周/月聚合频次、TOP 高频排行、偶发 vs 批量连锁统计
     3) classifyAlerts()     —— 基于关键词 + 来源系统 + 发生时间自动归类相似告警，区分偶发与批量连锁，给出根因建议
   analytics.html 与 monthly.html 共用本引擎，保证「月报数据口径」与「根因分析口径」一致。
================================================================================ */

const pad2 = n => String(n).padStart(2, '0');

/* 告警场景模板：决定生成数据的关键词、来源系统、根因与处置建议 */
const ALARM_SCENARIOS = [
  { cat: '网络链路', keywords: ['链路中断', '丢包率升高', '主备切换'], systems: ['NET'], base: 0.5, levelW: { critical: 0.5, warn: 0.5 }, escalate: true, root: '网络专线抖动 / 设备倒换', suggestion: '核查专线 SLA 与倒换日志，联系运营商确认抖动源并确认主备切换是否成功' },
  { cat: '存储与录像', keywords: ['存储节点掉线', '录像丢失风险', '录像空间不足'], systems: ['VMS'], base: 0.6, levelW: { critical: 0.7, warn: 0.3 }, escalate: true, root: '视频存储节点故障', suggestion: '检查存储节点健康与录像保留策略，必要时切换备用节点并补录' },
  { cat: '数据库主节点', keywords: ['心跳中断', '主库切换', '连接被拒绝'], systems: ['WMS', 'ERP'], base: 0.4, levelW: { critical: 0.8, warn: 0.2 }, escalate: true, root: '核心 / 自研库主节点心跳异常', suggestion: '核查主备切换演练与故障转移链路，确认切换窗口是否有人值守' },
  { cat: '支付资金链路', keywords: ['支付失败率升高', '成功率跌破阈值', '渠道中断'], systems: ['PAY'], base: 0.7, levelW: { critical: 0.6, warn: 0.4 }, escalate: true, root: '支付渠道成功率劣化', suggestion: '联系支付渠道方确认通道状态，启用备用渠道并降级非核心支付' },
  { cat: '结算一致性', keywords: ['对账不平', '资金挂账', '积压未回执'], systems: ['SET'], base: 0.5, levelW: { critical: 0.3, warn: 0.7 }, escalate: false, root: '对账批次积压 / 不一致', suggestion: '跟踪对账批次积压，协调业务方补回执，必要时人工冲正' },
  { cat: '副本同步延迟', keywords: ['同步延迟', '只读副本延迟'], systems: ['TMS', 'SET', 'PAY'], base: 0.8, levelW: { critical: 0.1, warn: 0.9 }, escalate: false, root: '只读副本同步延迟', suggestion: '检查复制链路与网络带宽，优化大事务拆分与索引' },
  { cat: '容量预警', keywords: ['磁盘使用率超过 90%', '容量预警'], systems: ['BI', 'IAM', 'ERP'], base: 0.4, levelW: { critical: 0.2, warn: 0.8 }, escalate: false, root: '磁盘容量逼近阈值', suggestion: '清理历史数据或扩容，配置自动归档与容量预警' },
  { cat: '安全事件', keywords: ['越权访问', '提权尝试', '口令暴力'], systems: ['BAS', 'IAM'], base: 0.3, levelW: { critical: 0.6, warn: 0.4 }, escalate: false, root: '账号异常 / 暴力尝试', suggestion: '核查堡垒机与 IAM 审计，锁定异常源 IP 并强制改密' },
  { cat: '性能劣化', keywords: ['响应变慢', '线程阻塞', '队列积压'], systems: ['SET', 'PAY', 'ERP'], base: 0.6, levelW: { critical: 0.1, warn: 0.9 }, escalate: false, root: '业务高峰线程 / 队列瓶颈', suggestion: '错峰执行重任务，补充索引或横向扩容' }
];

function deptOf(sysId) {
  const s = (typeof SUBSYSTEMS !== 'undefined') && SUBSYSTEMS.find(x => x.id === sysId);
  if (!s) return '';
  const p = String(s.owner).split('·');
  return p.length > 1 ? p[1].trim() : (p[0] || '').trim();
}

/* 确定性伪随机（同一 seed 每次生成完全相同的数据，便于演示与月报复用） */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function genAlarmRecords(base) {
  base = base || new Date();
  const start = new Date(base); start.setDate(start.getDate() - 179); start.setHours(0, 0, 0, 0);
  const rng = mulberry32(20260923);
  const recs = []; let id = 0;
  for (let d = 0; d < 180; d++) {
    const date = new Date(start); date.setDate(start.getDate() + d);
    const dow = date.getDay();
    const weekend = (dow === 0 || dow === 6) ? 0.55 : 1;
    const phase = d / 179;                 // 0 → 1，越靠近现在越易高发
    for (const sc of ALARM_SCENARIOS) {
      let cnt = sc.base * weekend * (0.7 + rng() * 0.7);
      if (sc.escalate) cnt *= (0.5 + phase * 1.3);
      cnt = Math.floor(cnt);
      for (let k = 0; k < cnt; k++) {
        const sysId = sc.systems[Math.floor(rng() * sc.systems.length)];
        const sys = (typeof SUBSYSTEMS !== 'undefined' && SUBSYSTEMS.find(s => s.id === sysId)) || { name: sysId };
        const kw = sc.keywords[Math.floor(rng() * sc.keywords.length)];
        const lv = rng();
        let level = 'warn';
        if (lv < (sc.levelW.critical || 0)) level = 'critical';
        else if (lv > 1 - (sc.levelW.warn || 0)) level = 'warn';
        else level = 'normal';
        const hh = 6 + Math.floor(rng() * 16), mm = Math.floor(rng() * 60);
        const ts = new Date(date); ts.setHours(hh, mm, Math.floor(rng() * 60));
        const st = rng();
        const status = st < 0.6 ? '已闭环' : st < 0.85 ? '处理中' : '待处理';
        const durationMin = status === '已闭环' ? (10 + Math.floor(rng() * 290)) : null;
        recs.push({
          id: 'A' + (100000 + id++), ts, sysId, sys: sys.name, dept: deptOf(sysId),
          keyword: kw, category: sc.cat, level,
          title: sys.name + '：' + kw + '（' + sc.cat + '）',
          status, durationMin, root: sc.root, suggestion: sc.suggestion
        });
      }
    }
  }
  return recs.sort((a, b) => a.ts - b.ts);
}

/* 全量样例数据（页面会按当前角色权限范围二次过滤） */
const ALARM_RECORDS = genAlarmRecords(new Date());

/* ---------------- 相似告警聚类：关键词 + 发生时间（同一天）归类 ---------------- */
function ymd(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function ym(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1); }
function isoWeek(d) {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = dt.getUTCDay() || 7; dt.setUTCDate(dt.getUTCDate() + 4 - day);
  const yr = dt.getUTCFullYear();
  const wk = Math.ceil((((dt - new Date(Date.UTC(yr, 0, 1))) / 86400000) + 1) / 7);
  return yr + '-W' + pad2(wk);
}

function classifyAlerts(records) {
  const groups = {};
  records.forEach(r => { const key = r.keyword + '|' + ymd(r.ts); (groups[key] || (groups[key] = [])).push(r); });
  const typeOf = {};
  const clusters = [];
  Object.keys(groups).forEach(key => {
    const arr = groups[key];
    const systems = Array.from(new Set(arr.map(r => r.sysId)));
    // 批量连锁：同一关键词一天内出现 ≥3 次，或跨 ≥2 个子系统同时出现
    const chained = arr.length >= 3 || systems.length >= 2;
    typeOf[key] = chained ? 'chained' : 'occasional';
    const r0 = arr[0];
    clusters.push({
      key, keyword: r0.keyword, category: r0.category,
      systems, sysNames: systems.map(id => ((typeof SUBSYSTEMS !== 'undefined' && SUBSYSTEMS.find(s => s.id === id)) || { name: id }).name),
      count: arr.length, type: chained ? 'chained' : 'occasional',
      first: arr.reduce((a, b) => a.ts < b.ts ? a : b).ts,
      last: arr.reduce((a, b) => a.ts > b.ts ? a : b).ts,
      rootCause: r0.root, suggestion: r0.suggestion, dept: r0.dept
    });
  });
  records.forEach(r => { r.clusterType = typeOf[r.keyword + '|' + ymd(r.ts)]; });
  clusters.sort((a, b) => b.count - a.count);
  return { clusters, typeOf };
}

/* ---------------- 时间分桶（日 / 周 / 月） ---------------- */
function bucketSeries(records, gran) {
  if (!records.length) return { labels: [], counts: [], criticals: [] };
  const minT = records.reduce((a, b) => a.ts < b.ts ? a : b).ts;
  const maxT = records.reduce((a, b) => a.ts > b.ts ? a : b).ts;
  const map = {};
  records.forEach(r => {
    const k = gran === 'day' ? ymd(r.ts) : gran === 'week' ? isoWeek(r.ts) : ym(r.ts);
    (map[k] || (map[k] = { c: 0, cr: 0 })).c++;
    if (r.level === 'critical') map[k].cr++;
  });
  const labels = [], counts = [], criticals = [];
  if (gran === 'day') {
    const cur = new Date(minT); cur.setHours(0, 0, 0, 0); const end = new Date(maxT); end.setHours(0, 0, 0, 0);
    while (cur <= end) {
      const k = ymd(cur); labels.push((cur.getMonth() + 1) + '/' + cur.getDate());
      const e = map[k] || { c: 0, cr: 0 }; counts.push(e.c); criticals.push(e.cr);
      cur.setDate(cur.getDate() + 1);
    }
  } else if (gran === 'month') {
    let y = minT.getFullYear(), m = minT.getMonth();
    while (y < maxT.getFullYear() || (y === maxT.getFullYear() && m <= maxT.getMonth())) {
      const k = y + '-' + pad2(m + 1); labels.push(y + '年' + (m + 1) + '月');
      const e = map[k] || { c: 0, cr: 0 }; counts.push(e.c); criticals.push(e.cr);
      m++; if (m > 11) { m = 0; y++; }
    }
  } else {
    Object.keys(map).sort().forEach(k => { labels.push('第' + k.split('-W')[1] + '周'); counts.push(map[k].c); criticals.push(map[k].cr); });
  }
  return { labels, counts, criticals };
}

/* ---------------- 按维度 TOP 高频排行 ---------------- */
function topBy(records, dim, n) {
  const keyOf = r => dim === 'keyword' ? r.keyword
    : dim === 'sys' ? r.sys
      : dim === 'category' ? r.category
        : r.level === 'critical' ? '特急' : r.level === 'warn' ? '重要' : '正常';
  const map = {};
  records.forEach(r => { const k = keyOf(r); (map[k] || (map[k] = { c: 0, sys: new Set() })).c++; map[k].sys.add(r.sysId); });
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
  const recent = {};
  records.forEach(r => { if (r.ts >= cutoff) { const k = keyOf(r); recent[k] = (recent[k] || 0) + 1; } });
  const total = records.length || 1;
  return Object.keys(map).map(k => ({
    label: k, value: map[k].c, systems: map[k].sys.size,
    pct: +(map[k].c / total * 100).toFixed(1), recent: recent[k] || 0
  })).sort((a, b) => b.value - a.value).slice(0, n || 10);
}

/* ---------------- 汇总入口：analytics 与 monthly 共用 ---------------- */
function computeAlarmStats(records, opts) {
  opts = opts || {};
  const gran = opts.granularity || 'day';
  const dim = opts.dim || 'keyword';
  const recs = records.map(r => Object.assign({}, r));   // 克隆，避免污染全局样例
  const total = recs.length;
  const critical = recs.filter(r => r.level === 'critical').length;
  const warn = recs.filter(r => r.level === 'warn').length;
  const normal = recs.filter(r => r.level === 'normal').length;
  const byStatus = {
    closed: recs.filter(r => r.status === '已闭环').length,
    doing: recs.filter(r => r.status === '处理中').length,
    pending: recs.filter(r => r.status === '待处理').length
  };
  const closedRate = total ? Math.round(byStatus.closed / total * 100) : 0;
  const cls = classifyAlerts(recs);
  const occasional = recs.filter(r => r.clusterType === 'occasional').length;
  const s = bucketSeries(recs, gran);
  const top = topBy(recs, dim, 10);
  const range = total ? { from: recs.reduce((a, b) => a.ts < b.ts ? a : b).ts, to: recs.reduce((a, b) => a.ts > b.ts ? a : b).ts } : null;
  return {
    total, critical, warn, normal, byStatus, closedRate,
    series: s, top,
    byType: { occasional, chained: total - occasional },
    clusters: cls.clusters,
    range
  };
}

/* 按当前角色数据范围过滤样例（全部数据 / 本处室及下属） */
function scopeRecords(records, scope, dept) {
  if (scope === '全部数据' || !dept) return records.slice();
  return records.filter(r => r.dept === dept).slice();
}
