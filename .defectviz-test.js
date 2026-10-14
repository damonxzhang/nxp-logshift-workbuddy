/* 次品管理 · 一级仅保留「BGA Top Defect PPM Trend」折线 + 浮层不残留 jsdom 回归
   校验：
   ① 一级只剩折线一张图（帕累托 / 小倍数 / 热力图三类图表已移除）
   ② 折线 SVG 正常渲染、可下钻二级
   ③ 一级悬停浮层（defectL1Tip，挂在 body）在离开一级进入二级 / 三级 / 四级后必须隐藏，不得残留 */
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
    const txt = () => (content().textContent || '');
    const cards = () => Array.from(content().querySelectorAll('.card-title')).map(t => t.textContent.trim());
    const idxOf = re => cards().findIndex(t => re.test(t));
    const click = el => { if (el) el.dispatchEvent(new window.Event('click', { bubbles: true })); return !!el; };

    ok(errors.length === 0, '无 JS 运行时错误' + (errors.length ? ' -> ' + errors.join(' | ') : ''));

    /* ---------- 一级仅剩折线图 ---------- */
    ok(idxOf(/BGA Top Defect PPM Trend/) >= 0, '一级仍保留「BGA Top Defect PPM Trend」折线图卡片');
    ok(idxOf(/帕累托/) < 0, '帕累托图卡片已移除');
    ok(idxOf(/小倍数趋势矩阵/) < 0, '小倍数趋势矩阵卡片已移除');
    ok(idxOf(/热力图/) < 0, '类别 × 周 PPM 热力图卡片已移除');
    ok(doc.querySelector('#paretoChart') == null, '容器 #paretoChart 已不存在');
    ok(doc.querySelector('#smChart') == null, '容器 #smChart 已不存在');
    ok(doc.querySelector('#heatChart') == null, '容器 #heatChart 已不存在');

    /* ---------- 折线图正常渲染 + 下钻 ---------- */
    const lineSvg = doc.querySelector('#procChart svg');
    ok(lineSvg != null, '折线条形 SVG 渲染');
    ok(doc.querySelectorAll('#procChart .dser').length === 16, '折线含 16 条系列（默认看全部）');
    const dser = doc.querySelector('#procChart .dser');
    ok(dser != null, '存在可点击的折线系列（下钻入口）');

    /* ---------- 浮层残留校验（核心）：模拟一级悬停浮层显示后下钻，必须被隐藏 ---------- */
    // 真实场景：一级渲染时 ensureL1Tip() 已在 body 上创建 #defectL1Tip（默认 display:none），
    // 鼠标悬停时将其置为 block；这里直接取出该元素模拟「悬停态」。
    let tip = doc.getElementById('defectL1Tip');
    ok(tip != null, '一级悬停浮层元素已存在（ensureL1Tip 在一级渲染时创建）');
    tip.style.display = 'block';
    ok(doc.getElementById('defectL1Tip').style.display === 'block', '模拟：一级悬停浮层处于显示态');

    ok(click(dser), '点击折线系列');
    ok(/二级 ·/.test(txt()) && !!doc.getElementById('devChart'), '点击折线系列进入二级机台树');
    ok(doc.getElementById('defectL1Tip').style.display === 'none', '进入二级后一级浮层已隐藏（不再残留）—— 修复点');

    /* 返回一级，浮层仍保持隐藏 */
    click(doc.querySelector('.crumb .lk'));
    ok(idxOf(/BGA Top Defect PPM Trend/) >= 0, '面包屑返回一级');
    ok(doc.getElementById('defectL1Tip').style.display === 'none', '返回一级时浮层仍隐藏');

    /* 再次下钻并一路到四级，浮层全程应保持隐藏 */
    click(doc.querySelector('#procChart .dser'));
    ok(/二级 ·/.test(txt()), '再次进入二级');
    ok(doc.getElementById('defectL1Tip').style.display === 'none', '二级页浮层仍隐藏');
    const dnode = doc.querySelector('#devChart .dnode');
    ok(click(dnode), '点击机台节点进入三级');
    ok(/三级 ·/.test(txt()), '进入三级');
    ok(doc.getElementById('defectL1Tip').style.display === 'none', '三级页浮层仍隐藏');
    const l4 = doc.querySelector('#content [data-l4]');
    ok(l4 != null, '三级存在「四级分析」操作按钮');
    if (l4) { click(l4); ok(/四级 · 料号/.test(txt()), '进入四级'); }
    ok(doc.getElementById('defectL1Tip').style.display === 'none', '四级页浮层仍隐藏（全程未残留）');

    ok(errors.length === 0, '全程无 JS 运行时错误' + (errors.length ? ' -> ' + errors.join(' | ') : ''));
    console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
    process.exit(fail ? 1 : 0);
  };

  window.addEventListener('load', () => setTimeout(done, 400));
  setTimeout(done, 3000); // 兜底
}).catch(e => { console.error('加载失败:', e); process.exit(1); });
