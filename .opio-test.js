/* BGA/LGA「料号 I/O 加权口径」回归（2026-10-13）
   客户《NONLEAD.xlsx》IO sheet：实际结果 = PKG_I/O × Unit（实际数量）÷ 255
     → OP 大屏 BGA/LGA 的目标与实际统一折算成「标准 I/O 当量」= 颗数 × (PKG_I/O ÷ 255)
     → 其余品类（QFN / PQFN / FCCSP）仍按颗数
     → PKG_CODE / PKG_I/O 两个字段由客户在 OP 配置页「④ 料号 I/O 维护」自行配置

   覆盖：
     A) 引擎纯逻辑（node vm 跑 output-core.js）：OP_IO_BASE / OP_IO_TYPES / opIoCandidates
        / OP_IO_STORE / opIoFactorOf / opIoFactorOfType / genOpWeek 的 I/O 折算与未配回落
     B) op-config.html（jsdom）：④ 配置域入口、公式说明、表格、PKG_CODE 自动带出 PKG_I/O、保存
     C) output.html / op-table.html（jsdom）：口径徽标与说明同步呈现
   运行：NODE_PATH 指向 jsdom，node 用内置版本 */
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const { JSDOM, VirtualConsole } = require('jsdom');

let pass = 0, fail = 0;
const ok = (c, m, extra) => { c ? (pass++, console.log('  ✓ ' + m)) : (fail++, console.log('  ✗ ' + m + (extra ? '  << ' + extra : ''))); };

function mkEngine(init) {
  const mem = new Map(Object.entries(init || {}));
  const ctx = {
    console, Math, JSON, Number, isFinite, Date, String, Object, Array, parseInt, parseFloat, Boolean, RegExp, Error,
    localStorage: { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(String(k), String(v)) },
    store: { get: (k, d) => (mem.has(k) ? JSON.parse(mem.get(k)) : d), set: (k, v) => mem.set(k, JSON.stringify(v)) }
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  ['assets/js/io-real-data.js', 'assets/js/op-real-data.js', 'assets/js/wip-real-data.js', 'assets/js/output-core.js']
    .forEach(f => vm.runInContext(fs.readFileSync(path.resolve(__dirname, f), 'utf8'), ctx, { filename: f }));
  return { ctx, run: code => vm.runInContext(code, ctx, { filename: 'probe' }) };
}

function loadPage(file, wait) {
  return new Promise((resolve, reject) => {
    const errors = [];
    const vc = new VirtualConsole();
    vc.on('jsdomError', e => errors.push('jsdomError: ' + (e.detail ? e.detail.message || e.detail : e.message)));
    vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));
    JSDOM.fromFile(path.resolve(__dirname, file), {
      runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc
    }).then(dom => {
      const w = dom.window;
      w.URL.createObjectURL = () => 'blob:stub';
      w.URL.revokeObjectURL = () => {};
      setTimeout(() => resolve({ win: w, doc: w.document, errors }), wait || 700);
    }).catch(reject);
  });
}

(async () => {
  /* ================= A) 引擎纯逻辑 ================= */
  console.log('【A】引擎：output-core.js I/O 加权口径');
  {
    const { run } = mkEngine();
    const d = run(`
      const types = OPTypeStore.all();
      const subs = Object.keys(opSubRatios('BGA/LGA', types));
      const o = {
        base: OP_IO_BASE, ioTypes: OP_IO_TYPES, usesBga: opUsesIo('BGA/LGA'), usesQfn: opUsesIo('QFN'),
        cands: opIoCandidates().length, subs,
        fNone: opIoFactorOfType('BGA/LGA', types),
        cfg0: OP_IO_STORE.configured('BGA/LGA')
      };
      OP_IO_STORE.save('BGA/LGA', [
        { sub: subs[0], code: '5289', io: 225 },
        { sub: subs[1], code: '00BN', io: 624 }
      ]);
      o.cfg1 = OP_IO_STORE.configured('BGA/LGA');
      o.fAvg = opIoFactorOfType('BGA/LGA', types);
      o.f1 = opIoFactorOf('BGA/LGA', subs[0]);
      o.f2 = opIoFactorOf('BGA/LGA', subs[1]);
      o.fMiss = opIoFactorOf('BGA/LGA', '__nope__');
      o.fQfn = opIoFactorOfType('QFN', types);
      const w = genOpWeek(2026, 39);
      const b = w.byType['BGA/LGA'], q = w.byType['QFN'];
      o.bga = { ioMode: b.ioMode, ioConfigured: b.ioConfigured, ioFactor: b.ioFactor, unit: b.unit,
        qtyTotal: b.qtyTotalCum[0], ioTotal: b.totalCum[0],
        qtyGoal: b.qtyWeekGoal, ioGoal: b.weekGoal, goalEnd: b.goalCum[6],
        hasQty: !!b.qtySubCum, ioHit: b.ioHitSubs, ioMiss: b.ioMissSubs };
      o.qfn = { ioMode: q.ioMode, goal: q.weekGoal, total: q.totalCum[0], hasQty: !!q.qtyTotalCum };
      // 未配置回落：清空配置后系数应为 1（等同颗数）
      OP_IO_STORE.reset('BGA/LGA');
      const w2 = genOpWeek(2026, 39);
      const b2 = w2.byType['BGA/LGA'];
      o.fall = { cfg: OP_IO_STORE.configured('BGA/LGA'), f: opIoFactorOfType('BGA/LGA', types),
        same: b2.totalCum[0] === b2.qtyTotalCum[0], ioConfigured: b2.ioConfigured };
      globalThis.__o = o;
    `);
    const o = run('globalThis.__o');

    ok(o.base === 255, 'OP_IO_BASE = 255（来自客户 IO 表）');
    ok(JSON.stringify(o.ioTypes) === JSON.stringify(['BGA/LGA']), 'OP_IO_TYPES = [BGA/LGA]');
    ok(o.usesBga === true && o.usesQfn === false, '仅 BGA/LGA 走 I/O 口径，QFN 仍按颗数');
    ok(o.cands === 101, '客户 IO 表候选 101 条（实际 ' + o.cands + '）');
    ok(o.subs.length > 0, 'BGA/LGA 产出料号 ' + o.subs.length + ' 个可配置');
    ok(o.fNone === null && o.cfg0 === false, '未配置时 opIoFactorOfType → null（界面提示回落 1.0）');
    ok(o.cfg1 === true, '配置后 OP_IO_STORE.configured = true');
    ok(Math.abs(o.f1 - 225 / 255) < 1e-9, '单料号系数 = PKG_I/O ÷ 255（225/255 = ' + o.f1.toFixed(4) + '）');
    ok(Math.abs(o.f2 - 624 / 255) < 1e-9, '另一料号系数 = 624/255 = ' + o.f2.toFixed(4));
    ok(o.fMiss === null, '未配料号 opIoFactorOf → null（由品类系数兜底）');
    ok(o.fQfn === null, 'QFN 不参与 I/O 折算（系数 null）');
    ok(o.fAvg > 0 && o.fAvg < 1.5, '品类加权系数 = ' + o.fAvg.toFixed(4) + '（按料号产出结构加权）');
    ok(o.bga.ioMode === true && o.bga.unit === '标准 I/O 当量', 'BGA/LGA 标记 ioMode + 单位「标准 I/O 当量」');
    ok(o.bga.qtyGoal === 3680 && o.bga.ioGoal === Math.round(3680 * o.fAvg),
      '周目标同步折算：' + o.bga.qtyGoal + 'K 颗 → ' + o.bga.ioGoal + 'K I/O 当量');
    ok(o.bga.goalEnd === o.bga.ioGoal, '累计目标末值 = 折算后的周目标（同量纲可比）');
    ok(o.bga.ioTotal !== o.bga.qtyTotal && o.bga.ioTotal > 0,
      '实际同步折算：' + o.bga.qtyTotal + 'K 颗 → ' + o.bga.ioTotal + 'K I/O 当量');
    ok(Math.abs(o.bga.ioTotal / o.bga.qtyTotal - o.fAvg) < 0.02,
      '折算比例与品类加权系数一致（' + (o.bga.ioTotal / o.bga.qtyTotal).toFixed(3) + ' ≈ ' + o.fAvg.toFixed(3) + '）');
    ok(o.bga.ioMiss > 0 && o.bga.ioHit > 0, '已配 ' + o.bga.ioHit + ' 个料号、未配 ' + o.bga.ioMiss + ' 个（未配按系数兜底，不丢量）');
    ok(o.bga.hasQty === true, '原「颗数」口径完整保留（qtySubCum / qtyTotalCum 可对账）');
    ok(!o.qfn.ioMode && o.qfn.goal === 2400 && !o.qfn.hasQty, 'QFN 完全不受影响（仍 2400K 颗、无 I/O 标记）');
    ok(o.fall.cfg === false && o.fall.f === null && o.fall.same === true && o.fall.ioConfigured === false,
      '清空配置后回落：实际 = 颗数（ioConfigured=false，界面会提示「尚未配置」）');
  }

  /* ================= B) op-config.html ④ 料号 I/O 维护 ================= */
  console.log('\n【B】op-config.html：④ 料号 I/O 维护配置域');
  {
    const { win, doc, errors } = await loadPage('op-config.html', 800);
    const click = el => { if (el) el.dispatchEvent(new win.Event('click', { bubbles: true })); return !!el; };
    const setVal = (el, v) => { if (!el) return false; el.value = v; el.dispatchEvent(new win.Event('change', { bubbles: true })); el.dispatchEvent(new win.Event('input', { bubbles: true })); return true; };
    const txt = () => (doc.getElementById('content') || doc.body).textContent || '';

    ok(errors.length === 0, 'op-config 无 JS 运行时错误' + (errors.length ? ' -> ' + errors.join(' | ') : ''));
    const tabs = Array.from(doc.querySelectorAll('#segTab button'));
    ok(tabs.length === 4, '配置域共 4 个 tab（实际 ' + tabs.length + '）');
    ok(tabs.some(b => /④ 料号 I\/O 维护/.test(b.textContent)), '存在「④ 料号 I/O 维护」入口');
    ok(/共 4 类/.test(txt()), '配置域说明更新为「共 4 类」');

    click(tabs.find(b => /④/.test(b.textContent)));
    ok(/料号 I\/O 维护/.test(txt()), '切换到 ④ 域并渲染');
    ok(/PKG_CODE/.test(txt()) && /PKG_I\/O/.test(txt()), '两个客户可配置字段均在表中');
    ok(/颗数 × \(PKG_I\/O ÷ 255\)/.test(txt()), '展示折算公式（颗数 × PKG_I/O ÷ 255）');
    ok(/客户 IO 表 101 条/.test(txt()), '候选库标注客户 IO 表 101 条');
    ok(doc.getElementById('btnIoAdd') && doc.getElementById('btnIoSeed') && doc.getElementById('btnIoSave'), '工具条按钮齐备（新增 / 带入候选 / 保存）');
    ok(/尚未配置任何 PKG_I\/O/.test(txt()), '未配置时给出醒目提示');
    ok(!!doc.getElementById('tblIo'), '料号 I/O 表格已渲染');

    // 新增一行 → 填 PKG_CODE → 自动带出 PKG_I/O → 保存
    click(doc.getElementById('btnIoAdd'));
    const rowsOf = () => Array.from(doc.querySelectorAll('#tblIo tbody tr[data-i]'));
    ok(rowsOf().length >= 1, '新增料号行已插入（' + rowsOf().length + ' 行）');
    const r0 = rowsOf()[rowsOf().length - 1];
    setVal(r0.querySelector('[data-k="sub"]'), '98ASA00081D');
    setVal(r0.querySelector('[data-k="code"]'), '5289');
    const ioEl = r0.querySelector('[data-k="io"]');
    ok(ioEl && ioEl.value !== '' && Number(ioEl.value) === 225, '填入客户 IO 表的 PKG_CODE=5289 后自动带出 PKG_I/O=' + (ioEl ? ioEl.value : '—'));
    ok(/客户 IO 表命中/.test(r0.textContent), '数据来源校验命中客户 IO 表');
    click(doc.getElementById('btnIoSave'));
    ok(/品类加权系数/.test(txt()), '保存成功并回显品类加权系数');
    ok(!/尚未配置任何 PKG_I\/O/.test(txt()), '配置后未配置提示消失');

    // 恢复默认
    click(doc.getElementById('btnIoReset'));
    ok(/尚未配置任何 PKG_I\/O/.test(txt()), '恢复默认后回到未配置状态');
    ok(doc.querySelectorAll('#tblIo tbody tr[data-i]').length === 0, '恢复默认后表格清空');

    ok(errors.length === 0, '全程无 JS 运行时错误' + (errors.length ? ' -> ' + errors.join(' | ') : ''));
  }

  /* ================= C) output.html / op-table.html 口径标注 ================= */
  console.log('\n【C】output.html 与 op-table.html：I/O 口径标注');
  {
    const { win, doc, errors } = await loadPage('output.html', 900);
    const txt = () => (doc.getElementById('content') || doc.body).textContent || '';
    const cards = () => Array.from(doc.querySelectorAll('.op-chart-card'));
    ok(errors.length === 0, 'output.html 无 JS 运行时错误' + (errors.length ? ' -> ' + errors.join(' | ') : ''));

    /* --- BGA/LGA 单独成图，不再混在「累计 goal vs total」数量图里 --- */
    ok(cards().length === 6, '双部门 3×2：颗数 / I/O当量 / 金额 × LEAD/NON-LEAD 共 6 张（' + cards().length + '）');
    const ioCards = cards().filter(c => /本图口径：标准 I\/O 当量/.test(c.textContent));
    const qtyCards = cards().filter(c => /本图口径：颗数/.test(c.textContent));
    const earnCards = cards().filter(c => /累计 Earn 目标 vs 实际/.test(c.textContent));
    ok(ioCards.length === 2, 'I/O 口径独立成图 2 张（LEAD / NON-LEAD），实际 ' + ioCards.length);
    ok(qtyCards.length === 2, '颗数口径图 2 张，实际 ' + qtyCards.length);
    ok(earnCards.length === 2, '金额图 2 张，实际 ' + earnCards.length);
    ok(ioCards.every(c => /BGA\/LGA/.test(c.textContent)), 'I/O 图标题/口径说明标明 BGA/LGA');
    ok(ioCards.every(c => /累计 goal vs total 曲线对比（标准 I\/O 当量）/.test(c.textContent)), 'I/O 图标题含「累计 goal vs total 曲线对比（标准 I/O 当量）」');
    ok(qtyCards.every(c => !/BGA\/LGA/.test(c.textContent.replace(/BGA\/LGA 走 I\/O 加权口径[^<]*/, ''))),
      '颗数图中不再出现 BGA/LGA（已完全拆出）');
    ok(qtyCards.every(c => /累计 goal vs total 曲线对比（K · 颗数）/.test(c.textContent)), '颗数图标题标明「K · 颗数」');
    ok(qtyCards.some(c => /QFN/.test(c.textContent) && /本图口径：颗数/.test(c.textContent)), '颗数图列出 QFN 等品类');

    /* --- 口径说明 --- */
    ok(/周目标已按「料号产出结构 × 各料号 PKG_I\/O」加权同步折算/.test(txt()), 'I/O 图说明目标已同步折算');
    ok(/④ 料号 I\/O 维护/.test(txt()), '给出配置入口指引');
    ok(/3×2 排布：行 = 口径（颗数 \/ BGA·LGA 标准 I\/O 当量 \/ 金额）/.test(txt()), '布局说明改为 3×2 三种口径');
    ok(/BGA\/LGA 因计算方法与其他品类不同/.test(txt()), '布局说明写明 BGA/LGA 不与颗数口径混排');
    ok(errors.length === 0, 'output.html 全程无 JS 异常');
  }
  {
    const { doc, errors } = await loadPage('op-table.html', 900);
    const txt = () => (doc.getElementById('content') || doc.body).textContent || '';
    ok(errors.length === 0, 'op-table.html 无 JS 运行时错误' + (errors.length ? ' -> ' + errors.join(' | ') : ''));
    ok(/I\/O 口径/.test(txt()), '周维度累计表 BGA/LGA 行带「I/O 口径」徽标');
    ok(/口径：标准 I\/O 当量/.test(txt()), '累计表行内注明 I/O 折算口径与加权系数');
    ok(/BGA\/LGA 的 I\/O 加权口径（与其它品类不同）/.test(txt()), '口径说明清单新增 BGA/LGA I/O 条目');
    ok(/QFN \/ PQFN \/ FCCSP 仍按颗数/.test(txt()), '说明清单写明其余品类仍按颗数');
    ok(errors.length === 0, 'op-table.html 全程无 JS 异常');
  }

  console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('加载失败:', e); process.exit(1); });
