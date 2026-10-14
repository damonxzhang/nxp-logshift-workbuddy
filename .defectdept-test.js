/* 次品管理 · 一级工序筛选 + 部门自动过滤（非用户控件）jsdom 回归测试 */
const { JSDOM, VirtualConsole } = require('jsdom');
const path = require('path');

const file = path.resolve(__dirname, 'defect.html');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + (e.detail ? e.detail.message || e.detail : e.message)));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

JSDOM.fromFile(file, {
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true,
  virtualConsole: vc
}).then(dom => {
  const { window } = dom;
  window.URL.createObjectURL = () => 'blob:stub';
  window.URL.revokeObjectURL = () => {};

  let finished = false;
  const done = () => {
    if (finished) return; finished = true;
    const doc = window.document;
    const content = () => doc.getElementById('content');
    const txt = () => content().textContent || '';
    const chips = () => doc.querySelectorAll('#defChips .legck');
    const stepBtns = () => doc.querySelectorAll('#stepSeg button');

    ok(errors.length === 0, '无 JS 运行时错误' + (errors.length ? ' -> ' + errors.join(' | ') : ''));

    // 部门不再作为用户筛选控件
    ok(doc.getElementById('deptSeg') == null, '部门筛选工具栏（#deptSeg）已移除（部门不作筛选条件）');
    ok(/部门不作为筛选条件/.test(doc.getElementById('content').textContent), '页面含备注：部门不作为筛选条件');
    ok(/根据登录用户所属部门.*自动筛选/.test(doc.getElementById('content').textContent), '页面含备注：按登录用户所属部门自动筛选');

    // 工序筛选工具栏
    ok(doc.getElementById('stepSeg') != null, '工序筛选工具栏（#stepSeg）已渲染');
    const allBtn = Array.from(stepBtns()).find(x => x.dataset.step === 'ALL');
    ok(allBtn != null, '工序筛选含「看全部」按钮');
    // 工序选项：统一为 MOLD / MARK / ICOS 三个（见 defect-real-data.js 的 station 字段与 defect-config-core.js 的工序种子）
    const stationBtns = Array.from(stepBtns()).filter(x => x.dataset.step !== 'ALL');
    ok(stationBtns.length === 3, '工序筛选含 3 个工序维度按钮 MOLD / MARK / ICOS（实际 ' + stationBtns.length + '）');
    ok(JSON.stringify(stationBtns.map(x => x.dataset.step)) === JSON.stringify(['MOLD', 'MARK', 'ICOS']),
      '工序按钮顺序与名称 = MOLD / MARK / ICOS（实际 ' + stationBtns.map(x => x.dataset.step).join(' / ') + '）');

    // 默认：看全部工序 + 部门自动(演示态 ALL) → 16 类
    ok(chips().length === 16, '默认渲染 16 类次品（实际 ' + chips().length + '）');
    ok(doc.querySelector('#procChart svg') != null, '一级折线图渲染');
    ok(doc.querySelector('#heatChart') == null, '一级热力图已移除（容器不存在）');

    // 点击「MOLD」→ 5 类
    const clickStep = st => {
      const b = Array.from(stepBtns()).find(x => x.dataset.step === st);
      if (!b) return false;
      b.dispatchEvent(new window.Event('click', { bubbles: true }));
      return true;
    };
    ok(clickStep('MOLD'), '点击「MOLD」工序');
    ok(chips().length === 5, 'MOLD 只剩 5 类（实际 ' + chips().length + '）');
    ok(Array.from(stepBtns()).find(x => x.dataset.step === 'MOLD').className.indexOf('active') >= 0, 'MOLD 按钮高亮(active)');
    ok(doc.querySelectorAll('#procChart .dser').length === 5, '折线图仅 5 条系列（随工序收缩）');
    ok(txt().includes('5 类别（MOLD）'), '一级趋势卡标题显示「5 类别（MOLD）」');

    // 点击「MARK」→ 10 类
    ok(clickStep('MARK'), '点击「MARK」工序');
    ok(chips().length === 10, 'MARK 范围 10 类（实际 ' + chips().length + '）');
    ok(txt().includes('10 类别（MARK）'), '标题显示「10 类别（MARK）」');

    // 点击「ICOS」→ 1 类
    ok(clickStep('ICOS'), '点击「ICOS」工序');
    ok(chips().length === 1, 'ICOS 范围 1 类（实际 ' + chips().length + '）');

    // 回到看全部
    ok(clickStep('ALL'), '点击「看全部」按钮');
    ok(chips().length === 16, '回到看全部恢复 16 类（实际 ' + chips().length + '）');

    // 一级→二级 联动不受影响（工序切换后仍可下钻）
    const dser = doc.querySelector('#procChart .dser');
    ok(dser != null, '折线图系列存在（用于下钻）');
    if (dser) dser.dispatchEvent(new window.Event('click', { bubbles: true }));
    ok(/二级/.test(txt()), '点击折线系列进入二级（设备维度机台树）');
    ok(doc.getElementById('devChart') != null, '二级机台树容器渲染');

    // 面包屑返回一级
    const crumb = doc.querySelector('.crumb .lk');
    ok(crumb != null, '面包屑返回入口存在');
    if (crumb) crumb.dispatchEvent(new window.Event('click', { bubbles: true }));
    ok(chips().length === 16, '返回一级后恢复 16 类（联动闭环正常）');
    ok(doc.getElementById('stepSeg') != null, '返回一级后工序筛选工具栏仍存在');
    ok(doc.getElementById('deptSeg') == null, '返回一级后部门筛选工具栏仍不存在');

    ok(errors.length === 0, '全程无 JS 运行时错误' + (errors.length ? ' -> ' + errors.join(' | ') : ''));

    console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
    process.exit(fail ? 1 : 0);
  };

  window.addEventListener('load', () => setTimeout(done, 400));
  setTimeout(done, 2800); // 兜底
}).catch(e => { console.error('加载失败:', e); process.exit(1); });
