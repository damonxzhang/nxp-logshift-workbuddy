/* 次品管理 · 一级新增两种展现形式 jsdom 回归
   ② 帕累托图（类别次品贡献排序 + 累计占比 80/20 + 时间口径切换）
   ③ 小倍数趋势矩阵 Small Multiples（一格一类别，独立量程）
   同时校验 DOM 顺序：折线 → 帕累托 → 小倍数 → 热力图 */
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
    const click = el => { if (el) el.dispatchEvent(new window.Event('click', { bubbles: true })); return !!el; };
    const cards = () => Array.from(content().querySelectorAll('.card-title')).map(t => t.textContent.trim());
    const idxOf = re => cards().findIndex(t => re.test(t));

    ok(errors.length === 0, '无 JS 运行时错误' + (errors.length ? ' -> ' + errors.join(' | ') : ''));

    /* ---------- DOM 顺序 ---------- */
    const iLine = idxOf(/BGA Top Defect PPM Trend/);
    const iPa = idxOf(/帕累托/);
    const iSm = idxOf(/小倍数趋势矩阵/);
    const iHeat = idxOf(/热力图/);
    ok(iLine >= 0, '一级折线趋势卡片保留');
    ok(iPa > iLine, '帕累托图排在折线趋势图「下面」');
    ok(iSm > iPa, '小倍数趋势矩阵排在帕累托图下面');
    ok(iHeat > iSm, '热力图仍在最下方（原位置保留）');
    ok(iLine < iPa && iPa < iSm && iSm < iHeat, '四级展现形式自上而下依次为：折线 → 帕累托 → 小倍数 → 热力图');

    /* ---------- 帕累托 ---------- */
    const paSvg = doc.querySelector('#paretoChart svg');
    ok(paSvg != null, '帕累托图 SVG 渲染');
    const bars = doc.querySelectorAll('#paretoChart .pbar');
    ok(bars.length > 0, '帕累托柱 / 类别名渲染（' + bars.length + ' 个可点击元素）');
    ok(/累计占比/.test(txt()), '帕累托卡含「累计占比」说明');
    ok(/80% 参考线/.test(txt()) || /80%/.test(txt()), '帕累托卡含 80% 参考线 / 80% 覆盖提示');
    ok(/前 <b>\d+<\/b> 类已覆盖/.test(content().innerHTML), '帕累托摘要显示「前 N 类已覆盖 80% 次品」');
    ok(doc.querySelectorAll('#paretoChart polyline').length >= 1, '累计占比折线渲染');
    ok(/柱：次品数（左轴）/.test(txt()), '双轴说明存在（柱=次品数 / 黑线=累计占比）');
    const paBtns = doc.querySelectorAll('#paSeg button');
    ok(paBtns.length === 4, '口径切换 4 个按钮（最新周 / 近13周 / 近26周 / 52周合计）');
    ok(Array.from(paBtns).find(b => b.dataset.pa === 'latest').className.indexOf('active') >= 0, '默认口径=最新周');

    // 切到「近 13 周」
    click(doc.querySelector('#paSeg button[data-pa="w13"]'));
    ok(/近 13 周 · 13 个实产周/.test(txt()), '切换到「近 13 周」并显示 13 个实产周口径');
    ok(doc.querySelectorAll('#paretoChart .pbar').length > 0, '近 13 周口径下帕累托仍渲染');

    // 切部门 → 帕累托随之收缩
    click(Array.from(doc.querySelectorAll('#deptSeg button')).find(b => b.dataset.dept === 'LEAD'));
    ok(/7 类别（LEAD）/.test(txt()), '切 LEAD 后标题显示 7 类别（LEAD）');
    const leadBars = doc.querySelectorAll('#paretoChart .pbar').length;
    const leadSm = doc.querySelectorAll('#smChart .dp-sm').length;
    ok(leadSm === 7, '小倍数矩阵随部门收缩为 7 格（实际 ' + leadSm + '）');
    ok(leadBars > 0 && leadBars <= 14, '帕累托随部门收缩（' + leadBars + ' 个元素）');
    click(Array.from(doc.querySelectorAll('#deptSeg button')).find(b => b.dataset.dept === 'ALL'));
    ok(doc.querySelectorAll('#smChart .dp-sm').length === 16, '回看全部后小倍数恢复 16 格');

    /* ---------- 小倍数 ---------- */
    const sms = doc.querySelectorAll('#smChart .dp-sm');
    ok(sms.length === 16, '小倍数矩阵渲染 16 格（实际 ' + sms.length + '）');
    ok(doc.querySelectorAll('#smChart .dp-sm-svg').length === 16, '每格含独立迷你趋势 SVG');
    ok(doc.querySelectorAll('#smChart .dp-sm-ft b').length === 16, '每格底部显示最新 PPM');
    ok(/峰 /.test(sms[0].textContent) && /均 /.test(sms[0].textContent), '每格底部含峰值 / 均值');
    ok(doc.querySelectorAll('#smChart circle').length > 0, '峰值 / 最新点已标注');
    ok(!doc.querySelector('#smChart .dp-sm.off'), '默认无淡化格（图例全选）');

    // 取消勾选一个类别 → 该格淡化
    const cb = doc.querySelector('#defChips .legck input');
    cb.checked = false; cb.dispatchEvent(new window.Event('change', { bubbles: true }));
    ok(doc.querySelectorAll('#smChart .dp-sm.off').length === 1, '图例取消勾选后对应小格淡化（off）');
    cb.checked = true; cb.dispatchEvent(new window.Event('change', { bubbles: true }));
    ok(doc.querySelectorAll('#smChart .dp-sm.off').length === 0, '重新勾选后恢复');

    /* ---------- 联动：两者点击均可下钻二级 ---------- */
    click(doc.querySelector('#paretoChart .pbar'));
    ok(/二级 ·/.test(txt()) && !!doc.getElementById('devChart'), '点击帕累托柱 → 进入二级机台树');
    click(doc.querySelector('.crumb .lk'));
    ok(!!doc.querySelector('#paretoChart svg'), '返回一级后帕累托重新渲染');
    click(doc.querySelector('#smChart .dp-sm'));
    ok(/二级 ·/.test(txt()) && !!doc.getElementById('devChart'), '点击小倍数小格 → 进入二级机台树');
    click(doc.querySelector('.crumb .lk'));
    ok(!!doc.querySelector('#smChart .dp-sms'), '返回一级后小倍数矩阵重新渲染');

    ok(errors.length === 0, '全程无 JS 运行时错误' + (errors.length ? ' -> ' + errors.join(' | ') : ''));
    console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
    process.exit(fail ? 1 : 0);
  };

  window.addEventListener('load', () => setTimeout(done, 400));
  setTimeout(done, 3000); // 兜底
}).catch(e => { console.error('加载失败:', e); process.exit(1); });
