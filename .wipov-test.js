/* WIP 参与报警判定回归（2026-10-08 客户口径修正 · 10-09 下线「④ 配置入口」）
   口径：WIP **不画进图表**（实时快照、无逐日历史），只在**报警判定**时计入 ——
        判定 = (累计实际 total + WIP) vs 累计目标 goal；全站统一（大屏徽标 / 红灯天数 / 累计表）。
   注意：10-09 起「④ WIP 报警判定」配置域已从 op-config.html 下线（无 UI 可改），
        判定改用 OP_DEFAULTS.wipOverlay 默认值（on / BE_DT / filter / 计入 Hold）。
        本测试只覆盖：
     A) 引擎纯逻辑（node vm 跑 output-core.js）：opWipSpecs / opWipCfg / opWipQtyOf / opWipDeductK
        + opStatusOf / opAggStatus / opTypeAlarm 的 wipK 抵扣语义（含边界：不传 wipK = 原口径）
     C) 大屏 output.html（jsdom）：**不再有第三条线**、卡副标题含「报警判定已计入 WIP 抵扣」
     D) 停用 / 换工序 / scope=all 的联动（直接写 ohd_op_cfg 验证大屏尊重配置）
   运行：NODE_PATH 指向 jsdom，node 用内置版本（见 README「九、开发校验」） */
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const { JSDOM, VirtualConsole } = require('jsdom');

let pass = 0, fail = 0;
const ok = (c, m, extra) => { c ? (pass++, console.log('PASS ' + m)) : (fail++, console.log('FAIL ' + m + (extra ? '  << ' + extra : ''))); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

function mkMem(init) {
  const m = new Map(Object.entries(init || {}));
  return {
    map: m,
    api: {
      getItem: k => (m.has(String(k)) ? m.get(String(k)) : null),
      setItem: (k, v) => m.set(String(k), String(v)),
      removeItem: k => m.delete(String(k)),
      clear: () => m.clear(),
      key: i => Array.from(m.keys())[i] || null,
      get length() { return m.size; }
    }
  };
}

/* ---------------- A) 引擎纯逻辑 ---------------- */
function engineTests() {
  /* output-core.js 依赖 store（localStorage 包装）+ window.* 数据对象，
     纯逻辑测试里给一个只读替身（读不到就回落内置默认值） */
  const mem = new Map();
  const ctx = {
    console, Math, JSON, Number, isFinite, Date, String, Object, Array, parseInt, parseFloat, Boolean, RegExp, Error,
    localStorage: { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v) },
    store: { get: (k, d) => (mem.has(k) ? JSON.parse(mem.get(k)) : d), set: (k, v) => mem.set(k, JSON.stringify(v)) }
  };
  vm.createContext(ctx);
  ctx.window = ctx;
  const load = f => vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
  load('assets/js/wip-real-data.js');
  load('assets/js/op-real-data.js');
  load('assets/js/defect-real-data.js');
  load('assets/js/output-core.js');

  const specs = vm.runInContext('opWipSpecs()', ctx);
  ok(specs.length >= 20, '工序清单 ≥ 20 个（' + specs.length + '）');
  ok(specs[0].qty >= specs[1].qty, '工序按在制量降序（' + specs[0].spec + ' ' + specs[0].qty + '）');
  ok(specs.some(s => s.spec === 'BE_DT'), '含 BE_DT 工序');
  ok(specs.some(s => s.spec === 'BE_SAW'), '含 BE_SAW 工序');

  const cfg0 = vm.runInContext('opWipCfg({})', ctx);
  ok(cfg0.on === true && cfg0.spec === 'BE_DT' && cfg0.scope === 'filter' && cfg0.excludeHold === false,
    '默认配置 on/BE_DT/filter/计入 Hold', JSON.stringify(cfg0));
  const cfgBad = vm.runInContext('opWipCfg({ wipOverlay: { spec: "__NOPE__" } })', ctx);
  ok(cfgBad.spec === specs[0].spec, '工序失效时回落到最大工序（' + cfgBad.spec + '）');

  const beDt = specs.find(s => s.spec === 'BE_DT');
  const qAll = vm.runInContext('opWipQtyOf("BE_DT", [], { wipOverlay: { scope: "all" } })', ctx);
  ok(qAll === beDt.qty, 'scope=all 时取该工序全部（' + qAll + '）');
  const qHold = vm.runInContext('opWipQtyOf("BE_DT", [], { wipOverlay: { scope: "all", excludeHold: true } })', ctx);
  ok(qHold <= qAll, '剔除 Hold 后不增加（' + qHold + ' ≤ ' + qAll + '）');
  const qFiltered = vm.runInContext('opWipQtyOf("BE_DT", ["BGA/LGA"], { wipOverlay: { scope: "filter" } })', ctx);
  ok(qFiltered > 0 && qFiltered <= qAll, 'scope=filter 按 PKG Type 收窄（' + qFiltered + ' ≤ ' + qAll + '）');
  ok(vm.runInContext('opWipQtyOf("__NOPE__", [], { wipOverlay: { scope: "all" } })', ctx) === 0, '未知工序返回 0');

  const k = vm.runInContext('opWipDeductK(["BGA/LGA"], { wipOverlay: { on: true, spec: "BE_DT", scope: "all" } })', ctx);
  ok(Math.abs(k - beDt.qty / 1000) < 0.1, 'opWipDeductK 折算为 K（' + k + '）');
  ok(vm.runInContext('opWipDeductK(["BGA/LGA"], { wipOverlay: { on: false } })', ctx) === 0, '停用后抵扣 0 K');

  /* 判定语义：wipK 抵扣缺口；不传 = 原口径 */
  const st0 = vm.runInContext('opStatusOf(1000, 800, { yellowK: 50, redK: 200, mode: "diff" })', ctx);
  ok(st0.diff === -200 && st0.status === 'over' && st0.wipK === 0, '不传 wipK 时 = 原口径（缺口 200 → 超标）', JSON.stringify(st0));
  const st1 = vm.runInContext('opStatusOf(1000, 800, { yellowK: 50, redK: 200, mode: "diff" }, 190)', ctx);
  ok(st1.diff === -10 && st1.status === 'met' && st1.eff === 990, 'wipK=190 抵扣到容差内（-10 → 达标）', JSON.stringify(st1));
  const st1b = vm.runInContext('opStatusOf(1000, 800, { yellowK: 50, redK: 200, mode: "diff" }, 150)', ctx);
  ok(st1b.diff === -50 && st1b.status === 'critical', '缺口恰好 = 黄阈值仍判黄灯（-50 → 临界，边界不放松）', JSON.stringify(st1b));
  const st2 = vm.runInContext('opStatusOf(1000, 800, { yellowK: 50, redK: 200, mode: "diff" }, 260)', ctx);
  ok(st2.diff === 60 && st2.status === 'met', 'wipK 超过缺口 → 差值为正、达标', JSON.stringify(st2));
  const st3 = vm.runInContext('opStatusOf(1000, 800, { yellowK: 50, redK: 200, mode: "diff" }, 100)', ctx);
  ok(st3.diff === -100 && st3.status === 'critical', 'wipK 部分抵扣到黄灯区（-100 → 临界）', JSON.stringify(st3));
  const st4 = vm.runInContext('opStatusOf(1000, null, { yellowK: 50, redK: 200, mode: "diff" }, 500)', ctx);
  ok(st4.status === 'none' && st4.diff === null, '未来日（total=null）仍为无数据，不受 WIP 影响');

  /* 聚合 / 单品类告警：wipK 透传 */
  const week = vm.runInContext('genOpWeek(opCurrentWeek().year, opCurrentWeek().week)', ctx);
  const ids = vm.runInContext('OPTypeStore.all().filter(t => t.enabled !== false).map(t => t.id)', ctx);
  const aggNoWip = vm.runInContext('opAggStatus(' + JSON.stringify(ids) + ', opLastActualIdx(genOpWeek(opCurrentWeek().year, opCurrentWeek().week)), genOpWeek(opCurrentWeek().year, opCurrentWeek().week), null, 0)', ctx);
  const aggWip = vm.runInContext('opAggStatus(' + JSON.stringify(ids) + ', opLastActualIdx(genOpWeek(opCurrentWeek().year, opCurrentWeek().week)), genOpWeek(opCurrentWeek().year, opCurrentWeek().week), null, 300)', ctx);
  ok(aggWip.diff === +(aggNoWip.diff + 300).toFixed(1), '聚合判定 wipK 全额抵扣差额（' + aggNoWip.diff + ' → ' + aggWip.diff + '）');
  ok(aggWip.wipK === 300 && aggNoWip.wipK === 0, 'st.wipK 如实回传');

  const oneId = ids[0];
  const alNo = vm.runInContext('opTypeAlarm(' + JSON.stringify(oneId) + ', genOpWeek(opCurrentWeek().year, opCurrentWeek().week), null, 0)', ctx);
  const alWip = vm.runInContext('opTypeAlarm(' + JSON.stringify(oneId) + ', genOpWeek(opCurrentWeek().year, opCurrentWeek().week), null, 80)', ctx);
  ok(alWip.red <= alNo.red && alWip.yellow <= alNo.yellow, '单品类告警：计入 WIP 后红灯 / 黄灯天数不增加（红 ' + alNo.red + '→' + alWip.red + ' · 黄 ' + alNo.yellow + '→' + alWip.yellow + '）');
  ok(alWip.wipK === 80, 'opTypeAlarm 回传 wipK');
  ok(alWip.maxGap <= alNo.maxGap, '最大缺口不变大（' + alNo.maxGap + ' → ' + alWip.maxGap + '）');
}

/* ---------------- C/D) jsdom：大屏（④ 配置域已下线，只验证判定在大屏的落地） ---------------- */
function mockRect(win) {
  win.HTMLElement.prototype.getBoundingClientRect = function () {
    return { left: 0, top: 0, right: 800, bottom: 320, width: 800, height: 320, x: 0, y: 0 };
  };
}

(async () => {
  engineTests();
  console.log('--- 引擎逻辑完成，进入 jsdom 大屏 ---');

  const errs = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!/Not implemented: navigation/.test(String(e))) errs.push(String(e.message || e)); });
  vc.on('error', (...a) => errs.push('console.error: ' + a.join(' ')));

  /* C) 大屏：不再有第三条线（用默认 wipOverlay：on/BE_DT/filter/计入 Hold） */
  const mem = mkMem();
  const dom = await JSDOM.fromFile(path.resolve('output.html'), {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(window) { Object.defineProperty(window, 'localStorage', { value: mem.api, configurable: true }); mockRect(window); }
  });
  await sleep(1400);
  const doc = dom.window.document;
  const txt = () => (doc.getElementById('content') || doc.body).textContent || '';
  ok(errs.length === 0, '大屏渲染无 JS 异常', errs.join(' | '));

  const cards = Array.from(doc.querySelectorAll('.op-chart-card'));
  ok(cards.length === 4, '双部门 2×2 四张图（' + cards.length + '）');
  const nlCard = cards.find(c => /NON-LEAD/.test(c.textContent) && /累计 goal vs total/.test(c.textContent));
  ok(!!nlCard, '找到 NON-LEAD 数量图');
  const nlTxt = nlCard ? nlCard.textContent : '';
  ok(/报警判定已计入 WIP 抵扣/.test(nlTxt) && /BE_DT/.test(nlTxt), 'NON-LEAD 卡注明判定已计入 WIP 抵扣（工序 BE_DT）', nlTxt.slice(0, 200));
  ok(/不参与绘图|不上图/.test(nlTxt), '注明 WIP 不参与绘图');
  ok(!/累计实际 \+ WIP/.test(nlTxt), '图例里不再有「累计实际 + WIP」第三条线');
  const nlLegend = nlCard ? nlCard.querySelector('.legend') : null;
  const nlItems = nlLegend ? Array.from(nlLegend.querySelectorAll('.lg')).filter(x => !/超标红灯区间/.test(x.textContent)) : [];
  ok(nlItems.length === 2, 'NON-LEAD 数量图仍为两条线（' + nlItems.length + '）', nlItems.map(x => x.textContent).join(' / '));
  /* 注意：卡片里有多个内联 SVG（图标 icon() 也是 <svg>！），必须用 .lc-wrap svg 精确定位图表 */
  const nlSvg = nlCard ? nlCard.querySelector('.lc-wrap svg') : null;
  ok(!!nlSvg, 'NON-LEAD 图已绘制 SVG');
  const nlPaths = nlSvg ? Array.from(nlSvg.querySelectorAll('path[stroke]')).filter(p => p.getAttribute('fill') === 'none') : [];
  ok(nlPaths.length === 2, '图内恰好两条折线（' + nlPaths.length + '）', nlPaths.map(p => p.getAttribute('stroke')).join(' / '));
  const nlDash = nlPaths.filter(p => (p.getAttribute('stroke-dasharray') || '') !== '').length;
  ok(nlDash === 1, '其中 1 条为虚线目标线（' + nlDash + '）');
  const nlDashPos = nlPaths.filter(p => { const d = p.getAttribute('stroke-dasharray') || ''; return d && !/^0/.test(d) && d !== ''; }).length;
  ok(nlDashPos === 1, '虚线只有目标线一条（WIP 线已彻底移除）');

  const subWith = (() => {
    const c = Array.from(doc.querySelectorAll('.op-chart-card')).find(x => /NON-LEAD/.test(x.textContent) && /累计 goal vs total/.test(x.textContent));
    return c ? (c.querySelector('.card-sub') || {}).textContent || '' : '';
  })();
  ok(/达标|临界|超标/.test(subWith), 'NON-LEAD 卡副标题含达标徽标', subWith.slice(0, 160));

  /* D) 预置「停用」→ 大屏不应出现 WIP 提示；图仍两条线 */
  const mem3 = mkMem({ ohd_op_cfg: JSON.stringify({ wipOverlay: { on: false, spec: 'BE_DT', scope: 'filter', excludeHold: false } }) });
  const dom3 = await JSDOM.fromFile(path.resolve('output.html'), {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(window) { Object.defineProperty(window, 'localStorage', { value: mem3.api, configurable: true }); mockRect(window); }
  });
  await sleep(1400);
  const doc3 = dom3.window.document;
  const c3 = Array.from(doc3.querySelectorAll('.op-chart-card')).find(c => /NON-LEAD/.test(c.textContent) && /累计 goal vs total/.test(c.textContent));
  ok(!!c3 && !/报警判定已计入 WIP 抵扣/.test(c3.textContent), '停用后 NON-LEAD 卡不再提示 WIP 抵扣');
  const items3 = c3 ? Array.from(c3.querySelectorAll('.legend .lg')).filter(x => !/超标红灯区间/.test(x.textContent)) : [];
  ok(items3.length === 2, '停用后仍是两条线（' + items3.length + '）');

  /* D2) 换工序 → 提示跟着变 */
  const mem4 = mkMem({ ohd_op_cfg: JSON.stringify({ wipOverlay: { on: true, spec: 'BE_SAW', scope: 'all', excludeHold: false } }) });
  const dom4 = await JSDOM.fromFile(path.resolve('output.html'), {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(window) { Object.defineProperty(window, 'localStorage', { value: mem4.api, configurable: true }); mockRect(window); }
  });
  await sleep(1400);
  const doc4 = dom4.window.document;
  const c4 = Array.from(doc4.querySelectorAll('.op-chart-card')).find(c => /NON-LEAD/.test(c.textContent) && /累计 goal vs total/.test(c.textContent));
  ok(!!c4 && /BE_SAW/.test(c4.textContent), '换工序后提示显示 BE_SAW');
  ok(!!c4 && /该工序全部/.test(c4.textContent), 'scope=all 时提示显示「该工序全部」');
  const items4 = c4 ? Array.from(c4.querySelectorAll('.legend .lg')).filter(x => !/超标红灯区间/.test(x.textContent)) : [];
  ok(items4.length === 2, '换工序后仍无第三条线（' + items4.length + '）');

  /* 浮窗：hover 出 WIP 说明行（不绘图，仅提示判定口径） */
  await sleep(600);
  const nl4 = Array.from(doc4.querySelectorAll('.op-chart-card')).find(c => /NON-LEAD/.test(c.textContent) && /累计 goal vs total/.test(c.textContent));
  const svg4 = nl4 ? nl4.querySelector('.lc-wrap svg') : null;
  ok(!!svg4, 'NON-LEAD 图 SVG 已绘制（浮窗前置）');
  if (svg4) {
    svg4.getBoundingClientRect = () => ({ left: 0, top: 0, right: 800, bottom: 300, width: 800, height: 300, x: 0, y: 0 });
    const r4 = svg4.getBoundingClientRect();
    ok(r4.width > 0, '实例级 mock 生效（width=' + r4.width + '）');
    svg4.dispatchEvent(new doc4.defaultView.MouseEvent('mousemove', { clientX: 520, clientY: 150, bubbles: true }));
    await sleep(250);
    const tip = nl4.querySelector('.lc-tip');
    const tipTxt = tip ? tip.textContent : '';
    ok(!!tip && tip.style.display === 'block', '浮窗已显示', tip ? tip.style.display : 'no .lc-tip');
    ok(/报警判定含 WIP 抵扣/.test(tipTxt), '浮窗含「报警判定含 WIP 抵扣」说明', tipTxt.slice(0, 220));
    ok(/不绘图/.test(tipTxt), '浮窗注明 WIP 不绘图');
    ok(/BE_SAW/.test(tipTxt), '浮窗按配置显示工序 BE_SAW');
    const tipLines = tip ? tip.querySelectorAll('.lc-tgap').length : 0;
    ok(tipLines <= 2, '浮窗附加行不超过 2 行（差额 + WIP 说明，实际 ' + tipLines + '）');
    ok(!!tip && /lc-tgap-wip/.test(tip.innerHTML), 'WIP 说明行带可换行样式 lc-tgap-wip');
  } else {
    for (let i = 0; i < 7; i++) ok(false, '浮窗测试未就绪');
  }
  ok(errs.length === 0, '大屏全流程无 JS 异常', errs.join(' | '));

  console.log('\nTOTAL pass=' + pass + ' fail=' + fail);
  process.exit(fail ? 1 : 0);
})();
