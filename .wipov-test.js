/* NON-LEAD · WIP 叠加回归（2026-10-08 客户要求）
   A) 纯逻辑（node vm 直接跑 output-core.js + wip-real-data.js）
   B) op-config.html ④ 配置域 UI（jsdom）
   C) output.html 图表：NON-LEAD 数量图多第三条线 + 浮窗含 WIP（jsdom，含 hover 模拟）
   D) 停用 / 换工序后大屏的回落与跟随
   注：jsdom 在 file:// 下访问 localStorage 会抛 SecurityError → 用 beforeParse 注入可读写替身，
       这样既能验证保存落盘，也能给大屏预置配置。 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

let pass = 0, fail = 0;
const ok = (c, m, extra) => { c ? (pass++, console.log('PASS ' + m)) : (fail++, console.log('FAIL ' + m + (extra ? '  << ' + extra : ''))); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* localStorage 替身（可跨 JSDOM 实例复用，模拟「配置已保存后在另一页生效」） */
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
async function load(page, mem) {
  const errs = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!/Not implemented: navigation/.test(String(e))) errs.push(String(e.message || e)); });
  vc.on('error', (...a) => errs.push('console.error: ' + a.join(' ')));
  const dom = await JSDOM.fromFile(path.resolve(page), {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(window) { Object.defineProperty(window, 'localStorage', { value: mem.api, configurable: true }); }
  });
  await sleep(1000);
  return { dom, doc: dom.window.document, errs };
}

(async () => {
  /* ================= A) 纯逻辑 ================= */
  {
    const ctx = {
      console, Math, JSON, Number, isFinite, Date, String, Object, Array, parseInt, parseFloat,
      store: { get: (k, d) => d, set: () => { } },
      localStorage: { getItem: () => null, setItem: () => { } },
      window: {}
    };
    vm.createContext(ctx);
    ['assets/js/wip-real-data.js', 'assets/js/op-real-data.js', 'assets/js/output-core.js'].forEach(f => {
      vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
    });

    const specs = vm.runInContext('opWipSpecs()', ctx);
    ok(specs.length === 24, 'WIP 工序清单 24 个（' + specs.length + '）');
    ok(specs[0].spec === 'BE_DT', '数量最大的工序是 BE_DT', specs[0].spec);
    ok(Math.abs(specs[0].qty / 1000 - 629.3) < 0.5, 'BE_DT 在制约 629.3K', (specs[0].qty / 1000).toFixed(1));
    ok(vm.runInContext("opWipTypeOf('BGA')", ctx) === 'BGA/LGA', 'WIP 的 BGA 映射为 OP 的 BGA/LGA');
    ok(vm.runInContext("opWipTypeOf('LGA')", ctx) === 'BGA/LGA', 'WIP 的 LGA 映射为 OP 的 BGA/LGA');
    ok(vm.runInContext("opWipTypeOf('QFN')", ctx) === 'QFN', 'QFN 同名映射');

    const NL = ['BGA/LGA', 'PQFN', 'QFN'];
    const qFilter = vm.runInContext(`opWipQtyOf('BE_DT', ${JSON.stringify(NL)}, { wipOverlay: { scope: 'filter' } })`, ctx);
    const qAll = vm.runInContext(`opWipQtyOf('BE_DT', ${JSON.stringify(NL)}, { wipOverlay: { scope: 'all' } })`, ctx);
    const qNoHold = vm.runInContext(`opWipQtyOf('BE_DT', ${JSON.stringify(NL)}, { wipOverlay: { scope: 'filter', excludeHold: true } })`, ctx);
    ok(qFilter > 0, '跟随筛选能算出量（' + (qFilter / 1000).toFixed(1) + 'K）');
    ok(qAll >= qFilter, '「该工序全部」≥ 跟随筛选', (qAll / 1000).toFixed(1) + ' vs ' + (qFilter / 1000).toFixed(1));
    ok(qNoHold <= qFilter, '剔除 Hold 后 ≤ 计入 Hold', (qNoHold / 1000).toFixed(1) + ' vs ' + (qFilter / 1000).toFixed(1));
    ok(vm.runInContext("opWipQtyOf('不存在的工序', ['BGA/LGA'], {})", ctx) === 0, '未知工序返回 0');

    const c1 = vm.runInContext('opWipCfg({})', ctx);
    ok(c1.on === true && c1.spec === 'BE_DT' && c1.scope === 'filter', '默认配置：启用 / BE_DT / 跟随筛选', JSON.stringify(c1));
    const c2 = vm.runInContext("opWipCfg({ wipOverlay: { spec: 'ZZZ' } })", ctx);
    ok(c2.spec === 'BE_DT', 'spec 失效时回落到数量最大的工序', c2.spec);
  }

  /* ================= B) op-config.html ④ ================= */
  const memB = mkMem();
  {
    const { doc, errs } = await load('op-config.html', memB);
    const txt = () => (doc.getElementById('content') || doc.body).textContent || '';

    ok(errs.length === 0, '配置页渲染无异常', errs.join(' | '));
    const tabs = Array.from(doc.querySelectorAll('#segTab button'));
    ok(tabs.length === 4, '配置域页签 4 个（' + tabs.length + '）');
    const t4 = tabs.find(b => b.dataset.t === 'wip');
    ok(!!t4 && /④ NON-LEAD · WIP 叠加/.test(t4.textContent), '④ 页签为「NON-LEAD · WIP 叠加」', t4 && t4.textContent.trim());

    t4.click();
    await sleep(400);
    ok(/共 4 类/.test(txt()), '卡副标题「共 4 类」');
    ok(/NON-LEAD · WIP 叠加/.test(txt()), '④ 页签可渲染');
    const sel = doc.getElementById('selWipSpec');
    ok(!!sel, '存在工序下拉');
    ok(sel && sel.options.length === 24, '工序下拉 24 项（' + (sel ? sel.options.length : 0) + '）');
    ok(sel && sel.value === 'BE_DT', '默认选中 BE_DT', sel && sel.value);
    ok(doc.querySelectorAll('#tblWipSpec tbody tr').length === 24, '工序清单表 24 行');
    ok(/图内实际取用/.test(txt()), '预览区含「图内实际取用」');
    ok(/实时在制快照/.test(txt()), '说明含「实时在制快照」口径');
    ok(/叠加线只是/.test(txt()), '注明叠加线不参与达标判定');

    /* 选 BE_SAW → 保存 */
    const btnSaw = Array.from(doc.querySelectorAll('#tblWipSpec [data-ws]')).find(b => b.dataset.ws === 'BE_SAW');
    ok(!!btnSaw, 'BE_SAW 行有「选为叠加工序」按钮');
    btnSaw.click();
    await sleep(300);
    ok(doc.getElementById('selWipSpec').value === 'BE_SAW', '点选后下拉切到 BE_SAW');
    ok(/557\.8K/.test(txt()), '清单显示 BE_SAW 557.8K');

    Array.from(doc.querySelectorAll('#cfgWipScope button')).find(b => b.dataset.m === 'all').click();
    await sleep(250);
    Array.from(doc.querySelectorAll('#cfgWipHold button')).find(b => b.dataset.m === 'exclude').click();
    await sleep(250);
    const bs = doc.getElementById('btnWipSave');
    ok(!!bs, '存在保存按钮');
    bs.click();
    await sleep(300);
    const saved = JSON.parse(memB.map.get('ohd_op_cfg') || '{}');
    ok(saved.wipOverlay && saved.wipOverlay.spec === 'BE_SAW', '保存后 spec=BE_SAW', JSON.stringify(saved.wipOverlay));
    ok(saved.wipOverlay && saved.wipOverlay.scope === 'all' && saved.wipOverlay.excludeHold === true, '保存后 scope=all / 剔除 Hold', JSON.stringify(saved.wipOverlay));
    ok(errs.length === 0, '④ 全流程无 JS 异常', errs.join(' | '));
    doc.defaultView.close();
  }

  /* ================= C) output.html：默认（BE_DT 启用） ================= */
  const memC = mkMem();
  {
    const { doc, errs } = await load('output.html', memC);
    const html = () => (doc.getElementById('content') || doc.body).innerHTML || '';
    ok(errs.length === 0, '大屏渲染无异常', errs.join(' | '));
    const cards = Array.from(doc.querySelectorAll('.op-chart-card'));
    ok(cards.length === 4, '2×2 四张图仍在（' + cards.length + '）');

    const cardOf = key => { const el = doc.getElementById('pc_' + key); return el ? el.closest('.op-chart-card') : null; };
    const cNL = cardOf('goal-NON-LEAD'), cLD = cardOf('goal-LEAD');
    ok(!!cNL && !!cLD, '找到 NON-LEAD / LEAD 数量图');
    const nlTxt = cNL ? cNL.textContent : '', ldTxt = cLD ? cLD.textContent : '';
    ok(/累计实际 \+ WIP/.test(nlTxt), 'NON-LEAD 图例含「累计实际 + WIP」');
    ok(!/累计实际 \+ WIP/.test(ldTxt), 'LEAD 图例不含 WIP 线');
    ok(/WIP 叠加/.test(nlTxt) && /BE_DT/.test(nlTxt), 'NON-LEAD 卡副标题标注 WIP 叠加工序');
    ok(/实时快照/.test(nlTxt), '副标题注明「实时快照」口径');
    const nlPaths = cNL ? cNL.querySelectorAll('.card-body svg path').length : 0;
    const ldPaths = cLD ? cLD.querySelectorAll('.card-body svg path').length : 0;
    ok(nlPaths === 3, 'NON-LEAD 图 3 条线（paths=' + nlPaths + '）');
    ok(ldPaths === 2, 'LEAD 图仍是 2 条线（paths=' + ldPaths + '）');

    /* 浮窗：mock 出 SVG 尺寸后派发 mousemove */
    const svg = cNL ? cNL.querySelector('.card-body svg') : null;
    ok(!!svg, 'NON-LEAD 图 SVG 已绘制');
    if (svg) {
      svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 300, right: 800, bottom: 300, x: 0, y: 0 });
      svg.dispatchEvent(new doc.defaultView.MouseEvent('mousemove', { clientX: 520, clientY: 150, bubbles: true }));
      await sleep(150);
      const tip = cNL.querySelector('.lc-tip');
      ok(!!tip && tip.style.display === 'block', '浮窗已显示');
      const tt = tip ? tip.textContent : '';
      ok(/WIP（BE_DT）/.test(tt), '浮窗含「WIP（BE_DT）」', tt.slice(0, 160));
      ok(/产出\+在制/.test(tt), '浮窗含「产出+在制」合计', tt.slice(0, 200));
      ok(/实时快照/.test(tt), '浮窗注明实时快照口径');
      ok(tip && tip.querySelectorAll('.lc-trow').length === 3, '浮窗 3 行数据（目标 / 实际 / 实际+WIP）');
    }
    ok(/点击图表查看「周维度累计表」/.test(html()), '整图可点提示仍在');
    doc.defaultView.close();
  }

  /* ================= D) 停用 / 换工序后的大屏表现 ================= */
  {
    const mem1 = mkMem({ ohd_op_cfg: JSON.stringify({ wipOverlay: { on: false, spec: 'BE_DT', scope: 'filter', excludeHold: false } }) });
    const { doc } = await load('output.html', mem1);
    const cNL = doc.getElementById('pc_goal-NON-LEAD') ? doc.getElementById('pc_goal-NON-LEAD').closest('.op-chart-card') : null;
    ok(cNL && cNL.querySelectorAll('.card-body svg path').length === 2, '停用后 NON-LEAD 回到 2 条线');
    ok(cNL && !/累计实际 \+ WIP/.test(cNL.textContent), '停用后图例无 WIP 线');
    doc.defaultView.close();

    const mem2 = mkMem({ ohd_op_cfg: JSON.stringify({ wipOverlay: { on: true, spec: 'BE_SAW', scope: 'all', excludeHold: false } }) });
    const { doc: d2 } = await load('output.html', mem2);
    const c2 = d2.getElementById('pc_goal-NON-LEAD') ? d2.getElementById('pc_goal-NON-LEAD').closest('.op-chart-card') : null;
    ok(c2 && /BE_SAW/.test(c2.textContent), '换工序后副标题显示 BE_SAW');
    ok(c2 && /该工序全部/.test(c2.textContent), 'scope=all 时副标题显示「该工序全部」');
    ok(c2 && c2.querySelectorAll('.card-body svg path').length === 3, '换工序后仍是 3 条线');
    d2.defaultView.close();
  }

  console.log('\nTOTAL pass=' + pass + ' fail=' + fail);
  process.exit(fail ? 1 : 0);
})();
