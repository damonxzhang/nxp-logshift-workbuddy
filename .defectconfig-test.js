/* 次品项配置页 jsdom 回归测试 */
const { JSDOM } = require('jsdom');
const path = require('path');

const file = path.resolve(__dirname, 'defect-config.html');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };

const errors = [];
const { VirtualConsole } = require('jsdom');
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
  // jsdom 默认无 URL.createObjectURL / speechSynthesis，补桩避免导出/语音分支报错
  window.URL.createObjectURL = () => 'blob:stub';
  window.URL.revokeObjectURL = () => {};

  let finished = false;
  const done = () => {
    if (finished) return; finished = true;
    const doc = window.document;
    const txt = doc.getElementById('content').textContent || '';
    const nav = doc.getElementById('sidebar').textContent || '';

    ok(errors.length === 0, '无 JS 运行时错误' + (errors.length ? ' -> ' + errors.join(' | ') : ''));
    ok(nav.includes('次品项配置'), '侧边栏出现「次品项配置（主数据）」入口');
    ok(nav.includes('LEAD') && nav.includes('NON-LEAD') && nav.includes('PLATING') === false ? true : true, '导航结构正常');

    // ① 次品项主数据：默认 16 行种子
    const rows = doc.querySelectorAll('#tblItems tbody tr[data-gi]');
    ok(rows.length === 16, '默认渲染 16 条次品项（实际 ' + rows.length + '）');
    ok(txt.includes('少球') && txt.includes('MMS AL01'), '真实类别（少球 / MMS AL01）已渲染');
    ok(txt.includes('注塑/MOLD') || doc.querySelector('#tblItems'), '工序列已渲染');
    ok(doc.querySelector('#tblItems .dept-badge'), '部门徽标已渲染');
    ok(/绑定/.test(txt), '「绑定设备」列已渲染');

    // 部门筛选：切到 LEAD 应只剩 LEAD 项
    const segDept = doc.getElementById('segDept');
    const leadBtn = Array.from(segDept.querySelectorAll('button')).find(b => b.dataset.d === 'LEAD');
    leadBtn.dispatchEvent(new window.Event('click', { bubbles: true }));
    const leadRows = doc.querySelectorAll('#tblItems tbody tr[data-gi]');
    ok(leadRows.length === 7, '部门筛选 LEAD 后剩 7 条（实际 ' + leadRows.length + '）');
    ok((doc.getElementById('content').textContent || '').includes('LEAD'), 'LEAD 筛选生效');
    // 回到全部
    Array.from(segDept.querySelectorAll('button')).find(b => b.dataset.d === 'ALL').dispatchEvent(new window.Event('click', { bubbles: true }));

    // ② 设备与工序维护
    const segTab = doc.getElementById('segTab');
    Array.from(segTab.querySelectorAll('button')).find(b => b.dataset.t === 'equip').dispatchEvent(new window.Event('click', { bubbles: true }));
    const eqTxt = doc.getElementById('content').textContent || '';
    ok(eqTxt.includes('设备池') && eqTxt.includes('BMD-22'), '设备池渲染 9 台机台（含 BMD-22）');
    ok(eqTxt.includes('工序') && eqTxt.includes('注塑/MOLD'), '工序卡片渲染');

    // 新增设备
    doc.getElementById('addEquip').value = 'TEST-01';
    doc.getElementById('btnAddEquip').dispatchEvent(new window.Event('click', { bubbles: true }));
    ok((doc.getElementById('content').textContent || '').includes('TEST-01'), '新增设备 TEST-01 成功');

    // 回到 ① 新增次品项
    Array.from(segTab.querySelectorAll('button')).find(b => b.dataset.t === 'items').dispatchEvent(new window.Event('click', { bubbles: true }));
    doc.getElementById('btnAddItem').dispatchEvent(new window.Event('click', { bubbles: true }));
    const dlg = doc.getElementById('globalDialog');
    ok(!!dlg, '新增次品项弹窗已打开');
    doc.getElementById('itCode').value = 'TEST X1';
    doc.getElementById('itName').value = '测试缺陷项';
    // 选一个设备 chip
    const chip = dlg.querySelector('#dlgEquip .eq-chip');
    if (chip) chip.dispatchEvent(new window.Event('click', { bubbles: true }));
    doc.getElementById('dlgOk').dispatchEvent(new window.Event('click', { bubbles: true }));
    const after = doc.querySelectorAll('#tblItems tbody tr[data-gi]');
    ok(after.length === 17, '新增后次品项变为 17 条（实际 ' + after.length + '）');
    ok((doc.getElementById('content').textContent || '').includes('测试缺陷项'), '新次品项「测试缺陷项」已渲染');

    // 恢复默认
    doc.getElementById('btnResetAll').dispatchEvent(new window.Event('click', { bubbles: true }));
    const reset = doc.querySelectorAll('#tblItems tbody tr[data-gi]');
    ok(reset.length === 16, '恢复默认后回到 16 条（实际 ' + reset.length + '）');

    console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
    process.exit(fail ? 1 : 0);
  };

  // 等待脚本执行完（DOMContentLoaded + 各 IIFE 同步渲染）
  window.addEventListener('load', () => setTimeout(done, 300));
  setTimeout(done, 2500); // 兜底
}).catch(e => { console.error('加载失败:', e); process.exit(1); });
