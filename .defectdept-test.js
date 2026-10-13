/* 次品管理 · 数据范围（部门筛选）jsdom 回归测试 */
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
    const segBtns = () => doc.querySelectorAll('#deptSeg button');
    const clickDept = d => {
      const b = Array.from(segBtns()).find(x => x.dataset.dept === d);
      if (!b) return false;
      b.dispatchEvent(new window.Event('click', { bubbles: true }));
      return true;
    };
    const uniqHeatK = () => new Set(Array.from(doc.querySelectorAll('#heatChart .hcell')).map(r => r.dataset.k)).size;

    ok(errors.length === 0, '无 JS 运行时错误' + (errors.length ? ' -> ' + errors.join(' | ') : ''));

    // 数据范围工具栏
    ok(doc.getElementById('deptSeg') != null, '数据范围工具栏（#deptSeg）已渲染');
    ok(segBtns().length === 4, '工具栏含 4 个按钮（看全部/LEAD/NON-LEAD/PLATING）');

    // 默认：看全部 → 16 类
    ok(chips().length === 16, '默认「看全部」渲染 16 类次品（实际 ' + chips().length + '）');
    ok(doc.querySelector('#procChart svg') != null, '一级折线图渲染');
    ok(doc.querySelector('#heatChart svg') != null, '一级热力图渲染');

    // LEAD → 7 类
    ok(clickDept('LEAD'), '点击 LEAD 按钮');
    ok(chips().length === 7, 'LEAD 范围只剩 7 类（实际 ' + chips().length + '）');
    ok(/LEAD 部门 · 7 类/.test(txt()), '范围提示显示「LEAD 部门 · 7 类」');
    ok(Array.from(segBtns()).find(x => x.dataset.dept === 'LEAD').className.indexOf('active') >= 0, 'LEAD 按钮高亮(active)');
    ok(doc.querySelectorAll('#procChart .dser').length === 7, '折线图仅 7 条系列');
    ok(uniqHeatK() === 7, '热力图仅 7 行类别');
    ok(txt().includes('7 类别（LEAD）'), '一级趋势卡标题显示「7 类别（LEAD）」');

    // NON-LEAD → 8 类
    ok(clickDept('NON-LEAD'), '点击 NON-LEAD 按钮');
    ok(chips().length === 8, 'NON-LEAD 范围剩 8 类（实际 ' + chips().length + '）');
    ok(/NON-LEAD 部门 · 8 类/.test(txt()), '范围提示显示「NON-LEAD 部门 · 8 类」');

    // PLATING → 1 类
    ok(clickDept('PLATING'), '点击 PLATING 按钮');
    ok(chips().length === 1, 'PLATING 范围剩 1 类（实际 ' + chips().length + '）');
    ok(/PLATING 部门 · 1 类/.test(txt()), '范围提示显示「PLATING 部门 · 1 类」');

    // 回到看全部
    ok(clickDept('ALL'), '点击「看全部」按钮');
    ok(chips().length === 16, '回到看全部恢复 16 类（实际 ' + chips().length + '）');

    // 一级→二级 联动不受影响（范围切换后仍可下钻）
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
    ok(doc.getElementById('deptSeg') != null, '返回一级后数据范围工具栏仍存在');

    ok(errors.length === 0, '全程无 JS 运行时错误' + (errors.length ? ' -> ' + errors.join(' | ') : ''));

    console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
    process.exit(fail ? 1 : 0);
  };

  window.addEventListener('load', () => setTimeout(done, 400));
  setTimeout(done, 2800); // 兜底
}).catch(e => { console.error('加载失败:', e); process.exit(1); });
