/* ================= 历史日志归档 · 核心引擎 =================
   本文件提供：
     1) 确定性生成近 420 天运维 / 审计日志样例（含等级 / 来源系统 / 部门 / 操作类型 / 操作人 / 体积）
     2) 归档规则：归档时长（可配置，默认 90 天）、归档触发规则、存储方式
        —— 上述口径均为「预留配置入口」，正式值待与客户确认，页面不写死
     3) 按规则将过期日志划分为「主库在线 / 已归档」并给出统计与图表数据
     4) 归档日志检索查询（关键词 / 等级 / 系统 / 操作人 / 时间范围），满足审计追溯
   archive.html 使用本引擎，并与全站 RBAC（archive 模块）联动做分级范围过滤。
================================================================================ */

const pad2 = n => String(n).padStart(2, '0');

const ARCHIVE_LEVELS = ['INFO', 'WARN', 'ERROR', 'AUDIT', 'DEBUG'];
const ARCHIVE_LEVEL_META = {
  INFO: { label: 'INFO', color: '#0b6a86', cls: 'b-info' },
  WARN: { label: 'WARN', color: '#a8620b', cls: 'b-warn' },
  ERROR: { label: 'ERROR', color: '#cc2f2a', cls: 'b-danger' },
  AUDIT: { label: 'AUDIT', color: '#1d4ed8', cls: 'b-primary' },
  DEBUG: { label: 'DEBUG', color: '#8a95a5', cls: 'b-neutral' }
};

/* 日志来源系统 / 部门映射（与子系统清单一致，便于按处室做分级范围过滤） */
const LOG_SYS = {
  IAM: { name: '统一身份认证 IAM', dept: '平台架构组' },
  NET: { name: '核心网络 Core-Network', dept: '网络组' },
  TMS: { name: '物流调度 TMS', dept: '物流部' },
  PAY: { name: '支付网关 Pay-Gateway', dept: '财务处' },
  VMS: { name: '视频监控 VMS', dept: '安保部' },
  BAS: { name: '安全审计堡垒机', dept: '安全合规部' },
  SET: { name: '数据结算 Settlement', dept: '结算中心' },
  ERP: { name: '生产制造 ERP', dept: '制造一处' },
  SCM: { name: '供应链采购 SCM', dept: '采购部' },
  BI: { name: '经营报表 BI', dept: '数据中台' },
  AUTH: { name: '账号与权限中心', dept: '信息中心' },
  CFG: { name: '系统配置中心', dept: '信息中心' },
  EVD: { name: '存证与交接中心', dept: '信息中心' },
  RPT: { name: '报表投递中心', dept: '信息中心' }
};

/* 日志模板：决定操作类型、默认等级、来源系统与消息文案 */
const LOG_TEMPLATES = [
  { cat: '登录认证', level: 'AUDIT', sys: 'IAM', w: 0.9, action: '用户登录', status: '成功', msg: u => `${u} 通过统一身份认证登录，二次验证通过` },
  { cat: '登录认证', level: 'AUDIT', sys: 'IAM', w: 0.12, action: '登录失败', status: '失败', msg: u => `${u} 登录失败：连续 3 次密码错误，账号临时锁定` },
  { cat: '权限变更', level: 'AUDIT', sys: 'AUTH', w: 0.25, action: '角色权限变更', status: '通过', msg: u => `${u} 调整角色权限矩阵，已审批授权并留痕` },
  { cat: '数据同步', level: 'INFO', sys: 'NET', w: 1.1, action: '采集调度拉取', status: '成功', msg: s => `${s} 状态采集成功，增量事件已入库` },
  { cat: '数据同步', level: 'WARN', sys: 'TMS', w: 0.4, action: '副本同步延迟', status: '成功', msg: s => `${s} 只读副本同步延迟超过阈值，已记录慢调用` },
  { cat: '配置修改', level: 'AUDIT', sys: 'CFG', w: 0.3, action: '配置参数调整', status: '通过', msg: s => `${s} 采集周期与归档策略配置更新并生效` },
  { cat: '接口调用', level: 'INFO', sys: 'PAY', w: 0.8, action: '渠道状态查询', status: '成功', msg: s => `${s} 支付渠道状态查询成功` },
  { cat: '接口调用', level: 'ERROR', sys: 'PAY', w: 0.15, action: '渠道调用异常', status: '失败', msg: s => `${s} 支付渠道调用超时，已降级备用通道` },
  { cat: '告警处置', level: 'WARN', sys: 'VMS', w: 0.6, action: '告警认领', status: '处理中', msg: s => `${s} 告警已认领，正在处置` },
  { cat: '告警处置', level: 'INFO', sys: 'VMS', w: 0.7, action: '告警闭环', status: '成功', msg: s => `${s} 告警处置完成并闭环` },
  { cat: '岗位交接', level: 'AUDIT', sys: 'EVD', w: 0.1, action: '交接单签署', status: '成功', msg: u => `${u} 完成白晚班交接单签署，责任书已上传` },
  { cat: '存证上传', level: 'INFO', sys: 'EVD', w: 0.2, action: '附件存证', status: '成功', msg: u => `${u} 上传交接附件并生成 SHA-256 存证` },
  { cat: '报表投递', level: 'INFO', sys: 'RPT', w: 0.3, action: '运营日报/月报投递', status: '成功', msg: s => `${s} 运营报表投递完成` },
  { cat: '系统巡检', level: 'INFO', sys: 'NET', w: 0.9, action: '健康检查', status: '成功', msg: s => `${s} 健康度巡检完成，综合得分正常` },
  { cat: '安全审计', level: 'AUDIT', sys: 'BAS', w: 0.4, action: '堡垒机审计', status: '通过', msg: s => `${s} 操作经堡垒机代理留痕，合规通过` },
  { cat: '安全审计', level: 'ERROR', sys: 'BAS', w: 0.12, action: '越权访问拦截', status: '失败', msg: s => `${s} 检测到越权访问尝试，已拦截并告警` }
];

const LOG_OPERATORS = ['张卫东', '郑文斌', '吴海涛', '钱志强', '孙立群', '周雅琴', '李国栋', '田守义', '陈慧敏', '系统自动'];

/* 确定性伪随机（同一 seed 每次生成完全相同的数据，便于演示复现） */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function genLogRecords(base) {
  base = base || new Date();
  const DAYS = 365;                               // 覆盖近 12 个月，与归档趋势窗口一致
  const SCALE = 2.6;                              // 每条模板每日期望日志基数（让低权重类别也有样本）
  const start = new Date(base); start.setDate(start.getDate() - (DAYS - 1)); start.setHours(0, 0, 0, 0);
  const rng = mulberry32(20260809);
  const recs = []; let id = 0;
  for (let d = 0; d < DAYS; d++) {
    const date = new Date(start); date.setDate(start.getDate() + d);
    const dow = date.getDay();
    const weekend = (dow === 0 || dow === 6) ? 0.5 : 1;
    const phase = d / (DAYS - 1);                 // 越靠近现在日志量略增
    for (const tpl of LOG_TEMPLATES) {
      let exp = tpl.w * weekend * (0.7 + rng() * 0.7) * (0.85 + phase * 0.4) * SCALE;
      let cnt = Math.floor(exp) + (rng() < (exp - Math.floor(exp)) ? 1 : 0);  // 小数部分按概率补足
      for (let k = 0; k < cnt; k++) {
        const sys = LOG_SYS[tpl.sys] || { name: tpl.sys, dept: '信息中心' };
        // 等级偶发升级（INFO/WARN -> ERROR）
        let level = tpl.level;
        if (level !== 'ERROR' && level !== 'AUDIT' && rng() < 0.04) level = 'ERROR';
        const hh = Math.floor(rng() * 24), mm = Math.floor(rng() * 60), ss = Math.floor(rng() * 60);
        const ts = new Date(date); ts.setHours(hh, mm, ss);
        const op = LOG_OPERATORS[Math.floor(rng() * LOG_OPERATORS.length)];
        const sizeKB = +(1 + rng() * (level === 'ERROR' || level === 'AUDIT' ? 7 : 4)).toFixed(1);
        recs.push({
          id: 'LOG' + String(1000000 + id++),
          ts, level, sysId: tpl.sys, sys: sys.name, dept: sys.dept,
          category: tpl.cat, action: tpl.action, status: tpl.status,
          operator: op, ip: '10.20.31.' + (10 + Math.floor(rng() * 80)),
          sizeKB, msg: tpl.msg(op)
        });
      }
    }
  }
  return recs.sort((a, b) => a.ts - b.ts);
}

/* 全量样例数据（页面会按当前角色权限范围二次过滤） */
const LOG_RECORDS = genLogRecords(new Date());

/* ---------------- 归档默认规则（预留配置入口，正式值待与客户确认） ---------------- */
const ARCHIVE_DEFAULTS = {
  retentionDays: 90,          // 归档时长：超过该天数的日志自动从主库归档
  trigger: 'auto',            // 归档触发规则：auto 每日定时 / weekly 每周 / manual 手动
  storage: 'object-cold',     // 存储方式：object-cold 对象存储低频层 / cold 冷热分层 / db 归档库
  includeActive: false        // 检索时是否包含主库在线日志
};

const ARCHIVE_STORAGE_LABEL = {
  'object-cold': '对象存储低频访问层（OSS 低频 / 归档存储）',
  'cold': '冷热数据分层（热库 + 归档库分离）',
  'db': '独立归档数据库（只读副本，按年分区）'
};
const ARCHIVE_TRIGGER_LABEL = {
  'auto': '每日定时自动归档（默认 02:00）',
  'weekly': '每周定时自动归档（默认周一 02:00）',
  'manual': '仅手动触发归档（由管理员在页面执行）'
};

function archiveThreshold(cfg) {
  const now = new Date();
  const t = new Date(now); t.setDate(t.getDate() - (cfg.retentionDays || ARCHIVE_DEFAULTS.retentionDays));
  t.setHours(0, 0, 0, 0);
  return t;
}

/* 按规则划分主库在线 / 已归档 */
function splitArchive(records, cfg) {
  const th = archiveThreshold(cfg);
  const active = [], archived = [];
  records.forEach(r => (r.ts < th ? archived : active).push(r));
  return { active, archived, threshold: th };
}

/* 归档任务历史（手动或自动执行记录，持久化于本地） */
function loadArchiveJobs() {
  try { return (typeof store !== 'undefined' && store.get('archive_jobs', [])) || []; } catch (e) { return []; }
}
function pushArchiveJob(job) {
  const jobs = loadArchiveJobs();
  jobs.unshift(job);
  if (typeof store !== 'undefined') store.set('archive_jobs', jobs.slice(0, 40));
  return jobs;
}

/* 下次自动归档时间（演示说明用） */
function nextArchiveAt(cfg) {
  if (cfg.trigger === 'manual') return '由管理员手动触发（不自动执行）';
  const now = new Date();
  const t = new Date(now);
  if (cfg.trigger === 'weekly') {
    const day = t.getDay();
    const add = (8 - day) % 7; // 下一个周一
    t.setDate(t.getDate() + (add === 0 ? 7 : add));
    t.setHours(2, 0, 0, 0);
  } else {
    t.setDate(t.getDate() + 1); t.setHours(2, 0, 0, 0);
  }
  return `${t.getFullYear()}/${pad2(t.getMonth() + 1)}/${pad2(t.getDate())} 02:00`;
}

/* ---------------- 归档统计（概览 / 图表） ---------------- */
function computeArchiveStats(records, cfg) {
  const { active, archived, threshold } = splitArchive(records, cfg);
  const freedMB = +(archived.reduce((a, r) => a + r.sizeKB, 0) / 1024).toFixed(1);
  const activeMB = +(active.reduce((a, r) => a + r.sizeKB, 0) / 1024).toFixed(1);

  // 已归档日志等级分布
  const lvlMap = {};
  archived.forEach(r => { lvlMap[r.level] = (lvlMap[r.level] || 0) + 1; });
  const levelDist = ARCHIVE_LEVELS.map(l => ({ label: l, value: lvlMap[l] || 0, color: ARCHIVE_LEVEL_META[l].color }))
    .filter(x => x.value > 0).sort((a, b) => b.value - a.value);

  // 各系统已归档量（TOP）
  const sysMap = {};
  archived.forEach(r => { (sysMap[r.sysId] || (sysMap[r.sysId] = { name: r.sys, dept: r.dept, c: 0, size: 0 })).c++; sysMap[r.sysId].size += r.sizeKB; });
  const bySystem = Object.keys(sysMap).map(k => ({ sysId: k, name: sysMap[k].name, dept: sysMap[k].dept, value: sysMap[k].c, mb: +(sysMap[k].size / 1024).toFixed(1) }))
    .sort((a, b) => b.value - a.value).slice(0, 8);

  // 近 12 个月趋势：主库在线 vs 已归档（按月份归并，归档判定基于当前阈值）
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ y: d.getFullYear(), m: d.getMonth() + 1, label: d.getFullYear() + '年' + (d.getMonth() + 1) + '月' });
  }
  const inMonth = (ts, y, m) => ts.getFullYear() === y && (ts.getMonth() + 1) === m;
  const seriesActive = [], seriesArchived = [], seriesFreed = [];
  months.forEach(mo => {
    let a = 0, ar = 0, fr = 0;
    records.forEach(r => {
      if (!inMonth(r.ts, mo.y, mo.m)) return;
      if (r.ts < threshold) { ar++; fr += r.sizeKB; } else { a++; }
    });
    seriesActive.push(a); seriesArchived.push(ar); seriesFreed.push(+(fr / 1024).toFixed(1));
  });

  return {
    total: records.length, activeCount: active.length, archivedCount: archived.length,
    freedMB, activeMB, threshold,
    levelDist, bySystem,
    trend: { labels: months.map(m => m.label), active: seriesActive, archived: seriesArchived, freed: seriesFreed },
    coveragePct: records.length ? Math.round(archived.length / records.length * 100) : 0
  };
}

/* ---------------- 归档日志检索查询（审计追溯） ---------------- */
function searchArchived(records, cfg, q) {
  q = q || {};
  const { archived, threshold } = splitArchive(records, cfg);
  let pool = cfg.includeActive || q.includeActive ? records.slice() : archived.slice();
  let matched = pool;
  if (q.kw) {
    const kw = q.kw.toLowerCase();
    matched = matched.filter(r => (r.msg + r.action + r.category + r.operator + r.id).toLowerCase().includes(kw));
  }
  if (q.level) matched = matched.filter(r => r.level === q.level);
  if (q.sysId) matched = matched.filter(r => r.sysId === q.sysId);
  if (q.operator) matched = matched.filter(r => r.operator === q.operator);
  if (q.from) { const f = new Date(q.from); f.setHours(0, 0, 0, 0); matched = matched.filter(r => r.ts >= f); }
  if (q.to) { const t = new Date(q.to); t.setHours(23, 59, 59, 999); matched = matched.filter(r => r.ts <= t); }
  matched.sort((a, b) => b.ts - a.ts);
  const total = matched.length;
  const rows = matched.slice(0, q.limit || 200);
  return { total, rows, scope: q._scopeLabel || '' };
}

/* 检索结果高亮关键词（仅高亮 msg，避免 XSS：先转义再插入 <mark>） */
function hl(text, kw) {
  const safe = esc(text);
  if (!kw) return safe;
  const i = safe.toLowerCase().indexOf(kw.toLowerCase());
  if (i < 0) return safe;
  return safe.slice(0, i) + '<span class="hl">' + safe.slice(i, i + kw.length) + '</span>' + safe.slice(i + kw.length);
}

/* 按当前角色数据范围过滤样例（全部数据 / 本处室及下属） */
function scopeLogRecords(records, scope, dept) {
  if (scope === '全部数据' || !dept) return records.slice();
  return records.filter(r => r.dept === dept).slice();
}
