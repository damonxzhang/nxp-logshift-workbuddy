/* 纯逻辑校验：Earn 递进链 —— 手动修正值的「下一天」基准应沿用修正值 */
const fs = require('fs');
const vm = require('vm');

const ctx = {
  console, Math, JSON, Number, isFinite, Date, String, Object, Array, parseInt, parseFloat,
  store: { get: (k, d) => d, set: () => { } },   // OPTypeStore 等用到
  localStorage: { getItem: () => null, setItem: () => { } }
};
vm.createContext(ctx);
['assets/js/op-real-data.js', 'assets/js/output-core.js'].forEach(f => {
  vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
});

let pass = 0, fail = 0;
const ok = (c, m, extra) => { c ? (pass++, console.log('PASS ' + m)) : (fail++, console.log('FAIL ' + m + (extra ? '  << ' + extra : ''))); };

const week = ctx.genOpWeek(2026, 40);
const types = ['BGA/LGA', 'QFN', 'PQFN'];
const baseCfg = {
  goalMode: { qty: 'even', earn: 'progressive' },
  earnProg: { pct: 5, redX: 2, anchor: 'prevDay', manual: {} }
};

/* 1) 无手动修正：周六=上周五实际，其余=前一日实际 */
const a = ctx.opEarnSeriesCfg(types, week, types, baseCfg);
ok(a.mode === 'progressive', '递进式口径生效');
ok(a.src[0] === 'prevWeekFri' || a.src[0] === 'even', '周六基准来源 = 上周五实际 / 兜底', a.src[0]);
ok(a.src.slice(1).every(s => ['prevDay', 'even'].includes(s)), '无修正时其余日来源为 前一日实际 / 兜底', JSON.stringify(a.src));

/* 2) 给周三（index=4）填手动值 88.8，周四（index=5）基准应 = 88.8 且 src='prevManual' */
const key = week.key;
const cfg2 = JSON.parse(JSON.stringify(baseCfg));
cfg2.earnProg.manual = { [key]: [null, null, null, null, 88.8, null, null] };
const b = ctx.opEarnSeriesCfg(types, week, types, cfg2);
ok(b.base[4] === 88.8, '周三生效基准 = 手动值 88.8', String(b.base[4]));
ok(b.src[4] === 'manual', '周三来源标记为 manual', b.src[4]);
ok(b.base[5] === 88.8, '周四生效基准沿用修正值 88.8', String(b.base[5]));
ok(b.src[5] === 'prevManual', '周四来源标记为 prevManual（前一日修正值）', b.src[5]);
ok(b.base[6] !== 88.8 || b.src[6] === 'prevManual', '周五回到「前一日实际」规则（周三未修正则取周四实际）', b.src[6] + '/' + b.base[6]);

/* 3) 连续修正两天：周三 88.8、周四 95.5 → 周四=88.8(修正自身优先)、周五=95.5 */
const cfg3 = JSON.parse(JSON.stringify(baseCfg));
cfg3.earnProg.manual = { [key]: [null, null, null, null, 88.8, 95.5, null] };
const c = ctx.opEarnSeriesCfg(types, week, types, cfg3);
ok(c.base[4] === 88.8 && c.src[4] === 'manual', '周三 = 自身手动值 88.8');
ok(c.base[5] === 95.5 && c.src[5] === 'manual', '周四 = 自身手动值 95.5', c.base[5] + '/' + c.src[5]);
ok(c.base[6] === 95.5 && c.src[6] === 'prevManual', '周五沿用周四修正值 95.5', c.base[6] + '/' + c.src[6]);

/* 4) 修正值也影响累计目标线（累计 = 各日基准累加） */
let g = 0; const want = [];
for (let i = 0; i < 7; i++) { g += c.base[i]; want.push(+g.toFixed(1)); }
ok(JSON.stringify(c.goalCum) === JSON.stringify(want), '累计 Earn 目标线 = 各日（含修正链）基准累加', JSON.stringify(c.goalCum));

/* 5) 均摊口径下不受影响 */
const cfg4 = JSON.parse(JSON.stringify(cfg3)); cfg4.goalMode.earn = 'even';
const d = ctx.opEarnSeriesCfg(types, week, types, cfg4);
ok(d.mode === 'even' && d.base === null, '均摊口径下不启用递进基准（base=null）');

console.log('\nTOTAL pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
