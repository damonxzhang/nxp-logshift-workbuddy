/* 料号（小分类）单价维护 UI 回归：配置页 ① PKG Type 维护 */
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

let pass = 0, fail = 0;
const ok = (c, m, extra) => { c ? (pass++, console.log('PASS ' + m)) : (fail++, console.log('FAIL ' + m + (extra ? '  << ' + extra : ''))); };

(async () => {
  const errs = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!/Not implemented: navigation/.test(String(e))) errs.push(String(e.message || e)); });
  vc.on('error', (...a) => errs.push('console.error: ' + a.join(' ')));
  const dom = await JSDOM.fromFile(path.resolve('op-config.html'), {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc
  });
  await new Promise(r => setTimeout(r, 900));
  const doc = dom.window.document;
  const txt = () => (doc.getElementById('content') || doc.body).textContent || '';
  const html = () => (doc.getElementById('content') || doc.body).innerHTML || '';

  ok(errs.length === 0, '渲染无 JS 异常', errs.join(' | '));
  ok(/小分类（封装料号）/.test(html()), '表头含「小分类（封装料号）」列');
  ok(!/兜底单价/.test(html()), '大分类表已移除「兜底单价」列（不再维护大分类兜底价）');
  ok(!/大分类 \/ 小分类两级单价/.test(html()), '卡内说明已移除「大分类 / 小分类两级单价」等大段说明');

  const rows = Array.from(doc.querySelectorAll('#tblTypes tbody tr[data-i]'));
  ok(rows.length >= 4, 'PKG Type 行数 >= 4（' + rows.length + '）');
  const bgaRow = rows.find(r => { const el = r.querySelector('[data-k="id"]'); return el && el.value === 'BGA/LGA'; });
  ok(!!bgaRow, '找到 BGA/LGA 行');
  const subCell = bgaRow ? bgaRow.children[2].textContent : '';
  const m = subCell.match(/(\d+)\s*个料号/);
  ok(!!m && Number(m[1]) > 1, 'BGA/LGA 显示真实料号数量（' + (m ? m[1] : '?') + ' 个）', subCell.trim());
  ok(/已配价 0/.test(subCell), '初始「已配价 0」', subCell.trim());

  const btn = bgaRow && bgaRow.querySelector('[data-sub]');
  ok(!!btn, '存在「管理单价」按钮');
  btn.click();
  await new Promise(r => setTimeout(r, 300));

  const dlg = doc.getElementById('globalDialog');
  ok(!!dlg, '弹窗已打开');
  const dtxt = dlg ? dlg.textContent : '';
  ok(/小分类（封装料号）单价/.test(dtxt), '弹窗标题为「小分类（封装料号）单价」', dtxt.slice(0, 40));
  ok(/系统默认单价/.test(dtxt) && /大分类/.test(dtxt), '弹窗说明含大分类 + 系统默认单价');
  const srows = Array.from(doc.querySelectorAll('#tblSubs tbody tr[data-s]'));
  ok(srows.length >= 15, '弹窗列出料号（' + srows.length + ' 行）');
  ok(srows.some(r => /98A/.test(r.querySelector('[data-k="sid"]').value)), '料号为封装料号格式（98A…）');
  ok(/产出占比/.test(dlg.innerHTML), '弹窗含「产出占比」列（真实数据占比）');

  /* 给第一个料号填单价 */
  const pEl = srows[0].querySelector('[data-k="sprice"]');
  pEl.value = '3.50';
  ok(!!doc.getElementById('btnSubFill'), '有「全部填充为系统默认单价」按钮');
  ok(!!doc.getElementById('btnSubClear'), '有「清空单价」按钮');

  doc.getElementById('dlgOk').click();
  await new Promise(r => setTimeout(r, 300));
  const bgaRow2 = Array.from(doc.querySelectorAll('#tblTypes tbody tr[data-i]'))
    .find(r => { const el = r.querySelector('[data-k="id"]'); return el && el.value === 'BGA/LGA'; });
  const cell2 = bgaRow2 ? bgaRow2.children[2].textContent : '';
  ok(/已配价 1/.test(cell2), '保存后显示「已配价 1」', cell2.trim());

  /* 保存整表 */
  const bs = doc.getElementById('btnTypeSave');
  ok(!!bs, '找到保存按钮');
  bs.click();
  await new Promise(r => setTimeout(r, 300));
  const bgaRow3 = Array.from(doc.querySelectorAll('#tblTypes tbody tr[data-i]'))
    .find(r => { const el = r.querySelector('[data-k="id"]'); return el && el.value === 'BGA/LGA'; });
  const cell3 = bgaRow3 ? bgaRow3.children[2].textContent : '';
  ok(/已配价 1/.test(cell3), '整表保存后料号单价未丢失', cell3.trim());
  ok(errs.length === 0, '全流程无 JS 异常', errs.join(' | '));

  console.log('\nTOTAL pass=' + pass + ' fail=' + fail);
  process.exit(fail ? 1 : 0);
})();
