/* ================= P2 各站凹库 / 微水调库看板 · 数据引擎 =================
   说明：「凹库」「微水调库」为 09-24 会议听记术语，正式名称与统计口径
   待 09-29 与客户确认，故全部做成配置入口（PIT_DEFAULTS），页面不写死口径。
   本站为演示原型，数据由确定性伪随机生成，刷新可复现。 */

const pad2 = n => String(n).padStart(2, '0');

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* 站段与机台（站段 LD / NLD / PLT 取自客户原始需求表） */
const PIT_STATIONS = [
  { id: 'LD', name: 'LD 站', weight: 1.25, machines: ['LD-A01', 'LD-A02', 'LD-A03', 'LD-A04', 'LD-A05', 'LD-A06'] },
  { id: 'NLD', name: 'NLD 站', weight: 1.0, machines: ['NLD-B01', 'NLD-B02', 'NLD-B03', 'NLD-B04', 'NLD-B05', 'NLD-B06'] },
  { id: 'PLT', name: 'PLT 站', weight: 0.8, machines: ['PLT-C01', 'PLT-C02', 'PLT-C03', 'PLT-C04', 'PLT-C05'] }
];

/* 机台归属处室：用于演示分级权限（不同角色仅可见其权限范围内数据） */
const PIT_DEPTS = ['仓储部', '安保部', '信息中心', '财务处', '结算中心', '网络组', '平台架构组', '安全合规部', '审计部'];

const PIT_PKGS = ['SOP-8', 'QFN-32', 'BGA-256', 'QFP-64', 'CSP-36', 'TO-220', 'SOT-23', 'DFN-8'];

/* 统计口径配置（预留入口 · 待客户确认） */
const PIT_DEFAULTS = {
  dim: 'station',      // 统计维度：station 按站 / machine 按机台 / shift 按班次 / pkg 按封装
  thresholdH: 24,      // 凹库预警阈值（在库时长，小时）
  criticalH: 48,       // 超期阈值（小时）
  window: '24H',       // 统计时间窗口
  source: '待客户确认', // 数据来源（预留）
  gran: 'day'          // 趋势粒度
};

const PIT_DIM_LABEL = { station: '按站段', machine: '按机台', shift: '按班次', pkg: '按封装' };

/* 生成在库批次记录 */
function genPitRecords(base) {
  base = base || new Date();
  const rng = mulberry32(20260924);
  const recs = [];
  let seq = 1000;

  PIT_STATIONS.forEach(st => {
    st.machines.forEach((mc, mi) => {
      const dept = PIT_DEPTS[(mi + st.id.length) % PIT_DEPTS.length];
      const cnt = 3 + Math.floor(rng() * 7);          // 每台机在库 3-9 批
      for (let i = 0; i < cnt; i++) {
        // 在库时长：多数集中在短时长，长尾少数超期（贴合真实凹库分布）
        const r = rng();
        const hours = r < 0.45 ? +(rng() * 12 + 0.5).toFixed(1)
          : r < 0.72 ? +(12 + rng() * 12).toFixed(1)
            : r < 0.9 ? +(24 + rng() * 24).toFixed(1)
              : +(48 + rng() * 30).toFixed(1);
        const inTime = new Date(base.getTime() - hours * 3600000);
        const h = inTime.getHours();
        recs.push({
          id: 'PIT-' + (++seq),
          lot: 'L' + (2600 + seq) + '-' + pad2(1 + Math.floor(rng() * 28)),
          station: st.id,
          stationName: st.name,
          machine: mc,
          dept: dept,
          pkg: PIT_PKGS[Math.floor(rng() * PIT_PKGS.length)],
          qty: 200 + Math.floor(rng() * 4800),
          hours: hours,
          inTime: inTime,
          inTimeStr: `${pad2(inTime.getMonth() + 1)}-${pad2(inTime.getDate())} ${pad2(h)}:${pad2(inTime.getMinutes())}`,
          shift: (h >= 8 && h < 20) ? '白班' : '晚班'
        });
      }
    });
  });
  return recs;
}

const PIT_RECORDS = genPitRecords(new Date());

/* 生成微水调库流水（近 7 天） */
function genPitTransfers(base) {
  base = base || new Date();
  const rng = mulberry32(771103);
  const ops = ['田守义', '钱志强', '孙立群', '周雅琴', '李国栋', '吴海涛'];
  const out = [];
  for (let d = 6; d >= 0; d--) {
    const day = new Date(base); day.setDate(base.getDate() - d);
    const cnt = 6 + Math.floor(rng() * 8);
    for (let i = 0; i < cnt; i++) {
      const st = PIT_STATIONS[Math.floor(rng() * PIT_STATIONS.length)];
      const mc = st.machines[Math.floor(rng() * st.machines.length)];
      const t = new Date(day); t.setHours(8 + Math.floor(rng() * 13), Math.floor(rng() * 60), 0, 0);
      out.push({
        id: 'TR-' + (2000 + out.length),
        time: t,
        timeStr: `${pad2(t.getMonth() + 1)}-${pad2(t.getDate())} ${pad2(t.getHours())}:${pad2(t.getMinutes())}`,
        stationName: st.name,
        machine: mc,
        dept: PIT_DEPTS[(st.machines.indexOf(mc) + 2) % PIT_DEPTS.length],
        lot: 'L' + (2600 + Math.floor(rng() * 900)) + '-' + pad2(1 + Math.floor(rng() * 28)),
        dir: rng() < 0.5 ? '调入' : '调出',
        qty: 100 + Math.floor(rng() * 2400),
        operator: ops[Math.floor(rng() * ops.length)]
      });
    }
  }
  return out.sort((a, b) => b.time - a.time);
}

const PIT_TRANSFERS = genPitTransfers(new Date());

/* 在库时长状态：normal 正常 / warn 预警（超阈值）/ critical 超期 */
function pitStatus(hours, cfg) {
  if (hours > cfg.criticalH) return 'critical';
  if (hours > cfg.thresholdH) return 'warn';
  return 'normal';
}

/* 按统计维度聚合 */
function groupByPit(records, dim) {
  const map = new Map();
  records.forEach(r => {
    const k = r[dim] || r.station;
    if (!map.has(k)) map.set(k, { key: k, count: 0, qty: 0, warn: 0, critical: 0, hoursSum: 0 });
    const g = map.get(k);
    g.count++; g.qty += r.qty; g.hoursSum += r.hours;
    if (r.hours > 48) g.critical++; else if (r.hours > 24) g.warn++;
  });
  return Array.from(map.values()).map(g => ({
    label: g.key, value: g.count, qty: g.qty, warn: g.warn, critical: g.critical,
    avgHours: +(g.hoursSum / g.count).toFixed(1)
  })).sort((a, b) => b.value - a.value);
}

/* 汇总统计 */
function computePitStats(records, cfg) {
  const c = Object.assign({}, PIT_DEFAULTS, cfg || {});
  const total = records.length;
  const qty = records.reduce((a, r) => a + r.qty, 0);
  const warn = records.filter(r => r.hours > c.thresholdH && r.hours <= c.criticalH).length;
  const critical = records.filter(r => r.hours > c.criticalH).length;
  const hoursSum = records.reduce((a, r) => a + r.hours, 0);
  const avgHours = total ? +(hoursSum / total).toFixed(1) : 0;
  const maxHours = total ? +Math.max(...records.map(r => r.hours)).toFixed(1) : 0;

  // 在库时长分布
  const buckets = [
    { label: `< ${c.thresholdH}H（正常）`, value: 0, color: '#12805a' },
    { label: `${c.thresholdH}-${c.criticalH}H（预警）`, value: 0, color: '#a8620b' },
    { label: `> ${c.criticalH}H（超期）`, value: 0, color: '#cc2f2a' }
  ];
  records.forEach(r => {
    if (r.hours > c.criticalH) buckets[2].value++;
    else if (r.hours > c.thresholdH) buckets[1].value++;
    else buckets[0].value++;
  });

  // 近 14 天趋势（入库 / 调出）
  const trng = mulberry32(31415926);
  const labels = [], inn = [], outn = [];
  const base = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(base); d.setDate(base.getDate() - i);
    labels.push(`${d.getMonth() + 1}/${d.getDate()}`);
    inn.push(8 + Math.floor(trng() * 16));
    outn.push(6 + Math.floor(trng() * 15));
  }

  const stations = PIT_STATIONS.map(s => {
    const rs = records.filter(r => r.station === s.id);
    return { label: s.name, value: rs.length, color: '#1d4ed8' };
  });

  const todayStr = `${pad2(base.getMonth() + 1)}-${pad2(base.getDate())}`;
  const todayTransfers = PIT_TRANSFERS.filter(t => t.timeStr.startsWith(todayStr));

  return {
    total, qty, warn, critical, avgHours, maxHours,
    stations,
    byDim: groupByPit(records, c.dim === 'station' ? 'stationName' : c.dim),
    byMachine: groupByPit(records, 'machine').slice(0, 10),
    ageDist: buckets,
    trend: { labels, inn, outn },
    transferToday: todayTransfers.length,
    transferTotal: PIT_TRANSFERS.length,
    coveredStations: PIT_STATIONS.filter(s => records.some(r => r.station === s.id)).length
  };
}

/* 分级权限：按数据范围过滤 */
function scopePitRecords(records, scope, dept) {
  if (scope === '全部数据') return records;
  if (scope === '仅本人相关') return records.slice(0, Math.max(1, Math.floor(records.length * 0.12)));
  return records.filter(r => r.dept === dept);
}
