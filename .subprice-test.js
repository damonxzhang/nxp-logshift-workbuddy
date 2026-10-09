/* 纯逻辑校验：小分类（封装料号）级单价
   1) 料号清单能从真实数据自动带出
   2) 料号未配价时回落系统默认单价（OP_EARN_PRICE）→ Earn 数值与改造前一致（不失真）
   3) 给料号配不同单价后，Earn 按料号粒度重新折算
   4) opSubRatios 占比合计 = 1
*/
const fs = require('fs');
const vm = require('vm');

const ctx = {
  console, Math, JSON, Number, isFinite, Date, String, Object, Array, parseInt, parseFloat,
  store: { get: (k, d) => d, set: () => { } },
  localStorage: { getItem: () => null, setItem: () => { } }
};
vm.createContext(ctx);
['assets/js/op-real-data.js', 'assets/js/output-core.js'].forEach(f => {
  vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
});

let pass = 0, fail = 0;
const ok = (c, m, extra) => { c ? (pass++, console.log('PASS ' + m)) : (fail++, console.log('FAIL ' + m + (extra ? '  << ' + extra : ''))); };
const r2 = v => +Number(v).toFixed(2);

/* ---------- 1) 料号清单自动带出 ---------- */
const subs = ctx.opSubsOf('BGA/LGA');
ok(subs.length > 1, 'BGA/LGA 自动带出料号清单（' + subs.length + ' 个）');
ok(subs.every(s => /^98A/.test(s.id)), '料号均为封装料号格式（98A…）', subs.map(s => s.id).slice(0, 3).join(','));
ok(subs.every(s => s.price === null), '未配置时料号单价为空（回落系统默认单价）');
ok(ctx.opSubsOf('FCCSP').length >= 1, 'FCCSP 至少有 1 个料号');

/* ---------- 2) 占比合计 = 1 ---------- */
['BGA/LGA', 'QFN', 'PQFN', 'FCCSP'].forEach(id => {
  const rs = ctx.opSubRatios(id);
  const sum = Object.values(rs).reduce((a, b) => a + b, 0);
  ok(Math.abs(sum - 1) < 1e-9, id + ' 料号占比合计 = 1', String(sum));
});

/* ---------- 3) 未配价时 Earn 不失真：与「大分类口径」手算一致 ---------- */
const wk = ctx.genOpWeek(2026, 39);          // 有真实数据的那一周
ok(wk.isReal, 'W39 为真实数据周');
const ids = ['BGA/LGA', 'QFN', 'PQFN', 'FCCSP'];
const earn = ctx.opEarnSeries(ids, wk);
const manual = [0, 0, 0, 0, 0, 0, 0];
ids.forEach(id => {
  const p = ctx.opPriceOf(id) / 10;
  const t = wk.byType[id];
  for (let i = 0; i < 7; i++) if (t.totalCum[i] != null) manual[i] += t.totalCum[i] * p;
});
const diff = Math.max(...manual.map((v, i) => Math.abs(v - (earn.totalCum[i] || 0))));
ok(diff < 0.6, '未配料号价时 Earn 与大分类口径一致（最大偏差 ' + r2(diff) + ' 万）', String(r2(diff)));

/* 料号级累计数量之和 ≈ 大分类累计数量 */
let subSumDiff = 0;
ids.forEach(id => {
  const t = wk.byType[id];
  for (let i = 0; i < 7; i++) {
    if (t.totalCum[i] == null) continue;
    const s = Object.values(t.subCum).reduce((a, arr) => a + (arr[i] == null ? 0 : arr[i]), 0);
    subSumDiff = Math.max(subSumDiff, Math.abs(s - t.totalCum[i]));
  }
});
ok(subSumDiff < 1.0, '料号级累计之和 = 大分类累计（最大偏差 ' + r2(subSumDiff) + 'K）', String(r2(subSumDiff)));

/* ---------- 4) 配料号价后 Earn 按料号粒度变化 ---------- */
const types2 = vm.runInContext('OPTypeStore.all()', ctx).map(t => Object.assign({}, t));
const bga = types2.find(t => t.id === 'BGA/LGA');
const bgaSubs = ctx.opSubsOf('BGA/LGA');
const mix = ctx.opRealSubMix('BGA/LGA');
// 给占比最大的料号一个高价 9.99，其余留空（回落系统默认单价 1.85）
const top = Object.keys(mix).sort((a, b) => mix[b] - mix[a])[0];
bga.subs = bgaSubs.map(s => ({ id: s.id, price: s.id === top ? 9.99 : null }));
const earn2 = ctx.opEarnSeries(ids, wk, types2);
const d0 = i => (earn2.totalCum[i] || 0) - (earn.totalCum[i] || 0);
ok(d0(0) > 0, 'Top 料号提价后 Earn 变大（' + r2(earn.totalCum[0]) + ' → ' + r2(earn2.totalCum[0]) + ' 万）');
ok(ctx.opSubPriceOf('BGA/LGA', top, types2) === 9.99, 'opSubPriceOf 取到料号自己的单价');
ok(ctx.opSubPriceOf('BGA/LGA', bgaSubs.find(s => s.id !== top).id, types2) === 1.85,
  '未配料号价的料号回落系统默认单价 1.85', String(ctx.opSubPriceOf('BGA/LGA', bgaSubs.find(s => s.id !== top).id, types2)));

/* ---------- 5) 演示周（无真实料号数量）按占比拆分 ---------- */
const wkDemo = ctx.genOpWeek(2026, 40);
ok(!wkDemo.isReal, 'W40 为演示周（无真实数据）');
const subCnt = Object.keys(wkDemo.byType['BGA/LGA'].subCum).length;
ok(subCnt > 1, '演示周也拆出了料号级数量（' + subCnt + ' 个料号）');
const earnDemo = ctx.opEarnSeries(ids, wkDemo);
const earnDemo2 = ctx.opEarnSeries(ids, wkDemo, types2);
ok((earnDemo2.totalCum[0] || 0) > (earnDemo.totalCum[0] || 0), '演示周同样响应料号单价差异');

/* ---------- 6) 手工新增料号（真实数据里没有）不会破坏占比 ---------- */
const types3 = vm.runInContext('OPTypeStore.all()', ctx).map(t => Object.assign({}, t));
const q = types3.find(t => t.id === 'QFN');
q.subs = ctx.opSubsOf('QFN').map(s => ({ id: s.id, price: null }));
q.subs.push({ id: '98ASA-NEW-01', price: 5 });
const rs3 = ctx.opSubRatios('QFN', types3);
const sum3 = Object.values(rs3).reduce((a, b) => a + b, 0);
ok(Math.abs(sum3 - 1) < 1e-9, '新增料号后占比仍归一（合计 ' + r2(sum3) + '）');
ok(rs3['98ASA-NEW-01'] === 0, '真实数据里没有的料号占比为 0（不侵占既有量）', String(rs3['98ASA-NEW-01']));

console.log('\nTOTAL pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
