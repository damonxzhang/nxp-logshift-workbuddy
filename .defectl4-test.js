/* 次品管理 · 三项改动回归：
   ① 一级热力图点击 → 先进入二级（机台树），不再直接跳三级 Package 明细
   ② 三级「同料号跨机台 PPM（反查）」后新增「操作」列 → 跳转四级分析页
   ③ 四级分析页 = 当前料号在各机台上的 PPM 表现（含结论判定 / 返回三级）
   附：op-table.html「异常报警 · 周维度」卡片已下线 */
const { JSDOM, VirtualConsole } = require('jsdom');
const path = require('path');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };

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
      setTimeout(() => resolve({ dom, win: w, doc: w.document, errors }), wait || 600);
    }).catch(reject);
  });
}

(async () => {
  /* ---------- op-table：异常报警 · 周维度 卡片下线 ---------- */
  {
    const { doc, errors } = await loadPage('op-table.html', 700);
    const txt = (doc.getElementById('content') || doc.body).textContent || '';
    console.log('【op-table.html】');
    ok(errors.length === 0, 'op-table 无 JS 运行时错误' + (errors.length ? ' -> ' + errors.join(' | ') : ''));
    ok(!/异常报警 · 周维度/.test(txt), '「异常报警 · 周维度」卡片已删除');
    ok(/周维度累计表/.test(txt), '「周维度累计表」卡片仍在');
    ok(doc.querySelector('#content table.table') != null || /PKG Type/.test(txt), '累计表主体仍正常渲染');
  }

  /* ---------- defect：热力图→二级 / 三级操作列 / 四级分析 ---------- */
  {
    const { win, doc, errors } = await loadPage('defect.html', 800);
    const content = () => doc.getElementById('content');
    const txt = () => content().textContent || '';
    const click = el => { if (el) el.dispatchEvent(new win.Event('click', { bubbles: true })); return !!el; };

    console.log('\n【defect.html · 一级 → 二级】');
    ok(errors.length === 0, 'defect 无 JS 运行时错误' + (errors.length ? ' -> ' + errors.join(' | ') : ''));
    ok(doc.querySelector('#heatChart svg') != null, '一级热力图已渲染');
    const hcell = doc.querySelector('#heatChart .hcell');
    ok(hcell != null, '热力图单元格存在');
    ok(click(hcell), '点击热力图单元格');
    ok(/二级 ·/.test(txt()), '热力图点击进入「二级」（实际标题含二级）');
    ok(!/三级 ·[^·]{0,30}Package 明细/.test(txt()), '不再直接跳到三级「Package 明细」页');
    ok(/机台树状图/.test(txt()) || /未加载设备维度数据/.test(txt()), '二级机台树区域已渲染');

    console.log('\n【defect.html · 二级 → 三级 → 四级】');
    const dnode = doc.querySelector('#devChart .dnode');
    ok(dnode != null, '二级机台节点存在');
    ok(click(dnode), '点击机台节点进入三级');
    ok(/三级 ·/.test(txt()) && /料号 透视/.test(txt()), '进入三级「机台 × 料号 透视」');
    const heads = Array.from(doc.querySelectorAll('#content table.table thead th')).map(t => t.textContent.trim());
    ok(heads[heads.length - 1] === '操作', '三级表末列为「操作」（实际末列：' + heads[heads.length - 1] + '）');
    ok(heads.indexOf('同料号跨机台 PPM（反查）') >= 0, '「同料号跨机台 PPM（反查）」列仍在');
    ok(heads.indexOf('操作') === heads.indexOf('同料号跨机台 PPM（反查）') + 1, '「操作」列紧随反查列之后');

    const l4btns = doc.querySelectorAll('#content [data-l4]');
    ok(l4btns.length > 0, '反查列每行渲染「四级分析」操作按钮（' + l4btns.length + ' 个）');
    const code = l4btns.length ? l4btns[0].dataset.l4 : null;
    ok(!!code, '取到料号：' + code);
    ok(click(l4btns[0]), '点击「四级分析」按钮');
    ok(/四级 · 料号/.test(txt()), '进入四级分析页');
    ok(txt().includes(code), '四级页展示当前料号 ' + code);
    ok(/跨机台 PPM 分析/.test(txt()), '四级页标题/说明含「跨机台 PPM 分析」');
    const h4 = Array.from(doc.querySelectorAll('#content table.table thead th')).map(t => t.textContent.trim());
    ok(h4.includes('机台') && h4.includes('PPM') && h4.includes('占该料号次品') && h4.includes('相对本机'),
      '四级表含 机台 / PPM / 占该料号次品 / 相对本机 等维度列');
    ok(/分析结论/.test(txt()), '四级页给出「分析结论」');
    ok(/机台特异性|料号 \/ 物料共性|跨机平稳|仅本机台生产|无跨机台数据/.test(txt()), '结论落在四种判定之一');
    ok(/#l4Back|返回三级/.test(doc.getElementById('content').innerHTML) || doc.getElementById('l4Back') != null, '四级页有「返回三级」入口');
    ok(/四级 ·/.test(doc.querySelector('.crumb').textContent || ''), '面包屑显示四级层级');

    const back = doc.getElementById('l4Back');
    ok(click(back), '点击「返回三级」');
    ok(/三级 ·/.test(txt()) && !/四级 · 料号/.test(txt()), '返回到三级（四级已退出）');

    ok(errors.length === 0, '全程无 JS 运行时错误' + (errors.length ? ' -> ' + errors.join(' | ') : ''));
  }

  console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('加载失败:', e); process.exit(1); });
