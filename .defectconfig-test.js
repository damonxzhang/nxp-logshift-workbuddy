/* 次品项配置页 jsdom 回归测试
   2026-10-14 页面收敛为单屏：移除「② 设备与工序维护」tab 与「恢复默认配置」按钮，
   工序种子统一为 MOLD / MARK / ICOS（与 defect-real-data.js 的 station 一致）。 */
const { JSDOM } = require('jsdom');
const path = require('path');

const file = path.resolve(__dirname, 'defect-config.html');
let pass = 0, fail = 0;
const ok = (c, m, extra) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + (extra ? '  << ' + extra : '')); } };

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
    const txt = () => doc.getElementById('content').textContent || '';
    const nav = doc.getElementById('sidebar').textContent || '';
    const rows = () => doc.querySelectorAll('#tblItems tbody tr[data-gi]');

    ok(errors.length === 0, '无 JS 运行时错误' + (errors.length ? ' -> ' + errors.join(' | ') : ''));
    ok(nav.includes('次品项配置'), '侧边栏出现「次品项配置（主数据）」入口');

    // ---------- ① 次品项主数据：默认 16 行种子 ----------
    ok(rows().length === 16, '默认渲染 16 条次品项（实际 ' + rows().length + '）');
    ok(txt().includes('少球') && txt().includes('MMS AL01'), '真实类别（少球 / MMS AL01）已渲染');
    ok(txt().includes('MOLD') && txt().includes('MARK'), '工序列已渲染（工序种子 MOLD / MARK / ICOS）');
    ok(doc.querySelector('#tblItems .dept-badge'), '部门徽标已渲染');
    ok(/绑定设备/.test(txt()), '「绑定设备」列已渲染');

    // ---------- 页面已收敛为单屏 ----------
    ok(doc.getElementById('segTab') == null, '「② 设备与工序维护」tab 切换器已移除（收敛为单屏）');
    ok(doc.getElementById('btnResetAll') == null, '「恢复默认配置」按钮已移除（配置域卡片整体下线）');

    // ---------- 部门筛选（分段控件） ----------
    const segDept = doc.getElementById('segDept');
    ok(!!segDept, '部门筛选控件 #segDept 已渲染');
    const clickDept = d => {
      const s = doc.getElementById('segDept');
      const b = s && Array.from(s.querySelectorAll('button')).find(x => x.dataset.d === d);
      if (!b) return false;
      b.dispatchEvent(new window.Event('click', { bubbles: true }));
      return true;
    };
    ok(clickDept('LEAD'), '点击部门筛选「LEAD」');
    ok(rows().length === 7, '部门筛选 LEAD 后剩 7 条（实际 ' + rows().length + '）');
    ok(clickDept('ALL'), '点击部门筛选「全部」');
    ok(rows().length === 16, '回到全部部门恢复 16 条（实际 ' + rows().length + '）');

    // ---------- 工序筛选（下拉，取代原「② 设备与工序维护」里的工序维护） ----------
    const setProc = p => {
      const s = doc.getElementById('selProc');
      if (!s) return false;
      s.value = p;
      s.dispatchEvent(new window.Event('change', { bubbles: true }));
      return true;
    };
    ok(setProc('MOLD'), '工序筛选选择「MOLD」');
    ok(rows().length === 5, '工序 MOLD 范围 5 条（实际 ' + rows().length + '）');
    ok(setProc('MARK'), '工序筛选选择「MARK」');
    ok(rows().length === 10, '工序 MARK 范围 10 条（实际 ' + rows().length + '）');
    ok(setProc('ICOS'), '工序筛选选择「ICOS」');
    ok(rows().length === 1, '工序 ICOS 范围 1 条（实际 ' + rows().length + '）');
    ok(setProc('ALL'), '工序筛选回到「全部工序」');
    ok(rows().length === 16, '回到全部工序恢复 16 条（实际 ' + rows().length + '）');

    // ---------- 新增次品项 ----------
    doc.getElementById('btnAddItem').dispatchEvent(new window.Event('click', { bubbles: true }));
    const dlg = doc.getElementById('globalDialog');
    ok(!!dlg, '新增次品项弹窗已打开');
    if (!dlg) { console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败'); process.exit(1); }
    doc.getElementById('itCode').value = 'TEST X1';
    doc.getElementById('itName').value = '测试缺陷项';
    doc.getElementById('itProc').value = 'MOLD';
    ok(!!doc.getElementById('itProc'), '弹窗含「工序」下拉（选项来自配置的工序种子）');
    // 选一个设备 chip
    const chip = dlg.querySelector('#dlgEquip .eq-chip');
    ok(!!chip, '弹窗含绑定设备 chips（设备池 ' + dlg.querySelectorAll('#dlgEquip .eq-chip').length + ' 台）');
    if (chip) chip.dispatchEvent(new window.Event('click', { bubbles: true }));
    doc.getElementById('dlgOk').dispatchEvent(new window.Event('click', { bubbles: true }));
    ok(rows().length === 17, '新增后次品项变为 17 条（实际 ' + rows().length + '）');
    ok(txt().includes('测试缺陷项'), '新次品项「测试缺陷项」已渲染');
    ok(doc.getElementById('globalDialog') == null, '保存后弹窗已关闭');

    // ---------- 新增项落在 MOLD 工序下：按 MOLD 筛选应能看到它 ----------
    ok(setProc('MOLD'), '再次按 MOLD 筛选');
    ok(rows().length === 6, 'MOLD 工序下现在 6 条（含新增项，实际 ' + rows().length + '）');
    ok(setProc('ALL'), '回到全部工序');

    // ---------- 编辑（代码只读） ----------
    const edBtn = doc.querySelector('#tblItems [data-edit]');
    ok(!!edBtn, '行内「编辑」按钮存在');
    if (edBtn) {
      edBtn.dispatchEvent(new window.Event('click', { bubbles: true }));
      const d2 = doc.getElementById('globalDialog');
      ok(!!d2, '编辑弹窗已打开');
      const codeInput = doc.getElementById('itCode');
      ok(!!codeInput && codeInput.hasAttribute('readonly'), '编辑态代码只读（唯一键不可改）');
      doc.getElementById('dlgCancel').dispatchEvent(new window.Event('click', { bubbles: true }));
      ok(doc.getElementById('globalDialog') == null, '取消后弹窗已关闭');
    }

    // ---------- 删除 ----------
    const rmBtn = doc.querySelector('#tblItems [data-rm]');
    ok(!!rmBtn, '行内「删除」按钮存在');
    if (rmBtn) {
      rmBtn.dispatchEvent(new window.Event('click', { bubbles: true }));
      ok(rows().length === 16, '删除一条后回到 16 条（实际 ' + rows().length + '）');
    }

    ok(errors.length === 0, '全程无 JS 运行时错误' + (errors.length ? ' -> ' + errors.join(' | ') : ''));

    console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
    process.exit(fail ? 1 : 0);
  };

  // 等待脚本执行完（DOMContentLoaded + 各 IIFE 同步渲染）
  window.addEventListener('load', () => setTimeout(done, 300));
  setTimeout(done, 2500); // 兜底
}).catch(e => { console.error('加载失败:', e); process.exit(1); });
