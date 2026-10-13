/* WIP 工序流转路径（横向，位于热力矩阵上方）+ 二级联动 jsdom 回归测试 */
const { JSDOM, VirtualConsole } = require('jsdom');
const path = require('path');

const file = path.resolve(__dirname, 'wip.html');
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

    ok(errors.length === 0, '无 JS 运行时错误' + (errors.length ? ' -> ' + errors.join(' | ') : ''));

    // 默认在制概览未被破坏
    ok(!!doc.getElementById('kTotal'), '默认在制概览 KPI 渲染');
    ok(!!doc.getElementById('whGrid'), '在制概览热力矩阵渲染');

    // 流转路径直接渲染在概览中（不再需要切 tab），且位于热力矩阵「上方」
    ok(!!doc.getElementById('flBranch') || doc.querySelector('.fl-chain'), '工序流转路径已渲染');
    ok(doc.getElementById('wipFlow').innerHTML.includes('工序流转路径'), '标题「工序流转路径」已渲染');
    const flEl = doc.getElementById('wipFlow'), whEl = doc.getElementById('whGrid');
    const before = flEl.compareDocumentPosition(whEl) & window.Node.DOCUMENT_POSITION_FOLLOWING;
    ok(!!before, '工序流转路径位于「工序 × PKG Type 热力矩阵」上方（DOM 顺序）');
    ok(!doc.getElementById('vtFlow') && !doc.querySelector('.wip-viewtabs'), '视图切换 tab 已移除（内容已并入概览）');

    // 横向排列：横向滚动容器 + 链条为 flex-row（样式在 wip.html 专属 <style>）
    ok(!!doc.querySelector('.fl-scroll'), '横向滚动容器 .fl-scroll 已渲染');
    const cssTxt = Array.from(doc.querySelectorAll('style')).map(s => s.textContent).join('\n');
    ok(/\.fl-chain\{[^}]*flex-direction:row/.test(cssTxt), '链条样式为横向（flex-direction:row）');
    ok(/\.fl-arrow\{[^}]*width:30px/.test(cssTxt) || /\.fl-arrow\{[^}]*height:2px/.test(cssTxt), '箭头样式为横向（宽 > 高）');

    // BGA 默认：10 个链节点 + 末行 5 去处二级联动
    const nodes = doc.querySelectorAll('.fl-chain .fl-node[data-step]');
    ok(nodes.length === 10, 'BGA 链上渲染 10 个工序节点（实际 ' + nodes.length + '）');
    ok(doc.getElementById('flBranch') && /分流向\s*5/.test(doc.getElementById('flBranch').textContent), '末行「去处分流」= 5 个去处');
    ok(doc.getElementById('flBranch').textContent.includes('二级联动'), '二级联动标签已渲染');

    // 二级默认收起
    const leaves = doc.querySelectorAll('#flLeaves .fl-leaf[data-step]');
    ok(leaves.length === 5, 'BGA 二级去处明细 5 个（实际 ' + leaves.length + '）');
    ok(doc.getElementById('flLeaves').hidden === true, '二级默认收起（hidden）');
    ok(!doc.getElementById('flBranch').contains(doc.getElementById('flLeaves')), '横向布局下二级明细为链条下方的独立行（不在分支节点内）');

    // 点击展开二级联动
    doc.getElementById('flBranchHead').dispatchEvent(new window.Event('click', { bubbles: true }));
    ok(doc.getElementById('flLeaves').hidden === false, '点击后二级展开');
    ok(doc.getElementById('flBranch').classList.contains('open'), '分支节点标记 open');

    // 真实在制量叠加：节点含 K 文本
    const qs = doc.querySelectorAll('.fl-q');
    let hasK = Array.from(qs).some(e => /K/.test(e.textContent) && !/0\.0K/.test(e.textContent));
    ok(qs.length > 0 && hasK, '工序节点叠加真实在制量（K）');

    // 切换封装类型：QFN → 4 去处
    const ft = t => { const b = doc.querySelector('[data-ft="' + t + '"]'); b.dispatchEvent(new window.Event('click', { bubbles: true })); };
    ft('QFN');
    ok(/分流向\s*4/.test((doc.getElementById('flBranch') || {}).textContent || ''), 'QFN 末行 = 4 个去处');
    ok(doc.querySelectorAll('#flLeaves .fl-leaf[data-step]').length === 4, 'QFN 二级 4 个去处');

    // FCCSP → 2 去处
    ft('FCCSP');
    ok(/分流向\s*2/.test((doc.getElementById('flBranch') || {}).textContent || ''), 'FCCSP 末行 = 2 个去处');

    // PQFN → 单一去处（无二级联动，末节点为普通节点 BE_MT）
    ft('PQFN');
    ok(!doc.getElementById('flBranch'), 'PQFN 单一去处 → 无二级联动节点');
    const pqNodes = doc.querySelectorAll('.fl-chain .fl-node[data-step]');
    ok(pqNodes.length === 11, 'PQFN 10 链 + 1 去处节点 = 11（实际 ' + pqNodes.length + '）');

    // 节点点击 → 进入该工序 WIP 明细抽屉（复用 openDrawer）
    ft('BGA');
    const firstNode = doc.querySelector('.fl-chain .fl-node[data-step]');
    firstNode.dispatchEvent(new window.Event('click', { bubbles: true }));
    const drawer = doc.getElementById('wipDrawer');
    ok(drawer && drawer.classList.contains('open'), '点击工序节点打开 WIP 明细抽屉');
    if (drawer) { const c = doc.getElementById('wdClose'); if (c) c.dispatchEvent(new window.Event('click', { bubbles: true })); }

    console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
    process.exit(fail ? 1 : 0);
  };

  window.addEventListener('load', () => setTimeout(done, 400));
  setTimeout(done, 3000); // 兜底
}).catch(e => { console.error('加载失败:', e); process.exit(1); });
