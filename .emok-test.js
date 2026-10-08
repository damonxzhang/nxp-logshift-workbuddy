/* Earn 手动修正「逐日生效」按钮回归（2026-10-08 客户要求）
   1) 每格输入框后有「生效」按钮
   2) 已过去的日期（早于今天）按钮禁用、输入框只读
   3) 点「生效」→ 该日修正值入库，后续日期基准按递进链重算
   4) 改动未点生效不入库；③ 的「保存」不再整表覆盖 manual */
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

let pass = 0, fail = 0;
const ok = (c, m, extra) => { c ? (pass++, console.log('PASS ' + m)) : (fail++, console.log('FAIL ' + m + (extra ? '  << ' + extra : ''))); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

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

(async () => {
  const mem = mkMem();
  const errs = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!/Not implemented: navigation/.test(String(e))) errs.push(String(e.message || e)); });
  vc.on('error', (...a) => errs.push('console.error: ' + a.join(' ')));
  const dom = await JSDOM.fromFile(path.resolve('op-config.html'), {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(window) { Object.defineProperty(window, 'localStorage', { value: mem.api, configurable: true }); }
  });
  await sleep(1000);
  const doc = dom.window.document;
  const txt = () => (doc.getElementById('content') || doc.body).textContent || '';

  ok(errs.length === 0, '渲染无 JS 异常', errs.join(' | '));

  /* 切到 ③ 预警分口径 / 夏令时 */
  const t3 = Array.from(doc.querySelectorAll('#segTab button')).find(b => b.dataset.t === 'alarm');
  ok(!!t3, '找到 ③ 页签');
  t3.click();
  await sleep(400);
  ok(/Earn 目标手动修正/.test(txt()), '③ 含 Earn 目标手动修正表');

  const tbl = doc.getElementById('tblEarnMan');
  ok(!!tbl, '找到 #tblEarnMan');
  const btns = tbl ? Array.from(tbl.querySelectorAll('[data-emok]')) : [];
  const ins = tbl ? Array.from(tbl.querySelectorAll('[data-em]')) : [];
  ok(btns.length === 7, '7 个「生效」按钮（' + btns.length + '）');
  ok(ins.length === 7, '7 个手动修正输入框（' + ins.length + '）');

  /* 表头日期与状态标签 */
  const ths = Array.from(tbl.querySelectorAll('thead th')).slice(1).map(th => th.textContent);
  ok(ths.every(t => /已过去|今天|未来/.test(t)), '表头标注每日状态（已过去 / 今天 / 未来）', ths.join(' | '));
  const pastIdx = ths.map((t, i) => (/已过去/.test(t) ? i : -1)).filter(i => i >= 0);
  const openIdx = ths.map((t, i) => (/今天|未来/.test(t) ? i : -1)).filter(i => i >= 0);
  ok(pastIdx.length > 0, '本周存在已过去的日期（' + pastIdx.join(',') + '）');
  ok(openIdx.length > 0, '本周存在可修正的日期（今天 / 未来：' + openIdx.join(',') + '）');

  /* 禁用一致性：已过去 → 按钮禁用 + 输入框只读 */
  ok(pastIdx.every(i => btns[i].disabled), '已过去日期的「生效」按钮禁用', pastIdx.map(i => btns[i].disabled).join(','));
  ok(pastIdx.every(i => ins[i].hasAttribute('readonly')), '已过去日期的输入框只读');
  ok(openIdx.every(i => !btns[i].disabled), '今天 / 未来日期的按钮可用', openIdx.map(i => btns[i].disabled).join(','));
  ok(openIdx.every(i => !ins[i].hasAttribute('readonly')), '今天 / 未来日期的输入框可编辑');
  ok(pastIdx.every(i => /该日已过去/.test(btns[i].getAttribute('title') || '')), '禁用按钮 title 说明「该日已过去」');

  /* 行定位辅助：按首列文本取某一行的第 i 格（每次实时查询，避免拿到重渲染前的旧表引用） */
  const cellOf = (label, i) => {
    const t = doc.getElementById('tblEarnMan'); if (!t) return null;
    const tr = Array.from(t.querySelectorAll('tbody tr')).find(r => (r.children[0].textContent || '').indexOf(label) >= 0);
    return tr ? (tr.children[i + 1] || null) : null;
  };
  const target = openIdx[0];                      // 第一个可修正的日期
  const nextDay = target + 1;
  const baseBefore = nextDay <= 6 ? (cellOf('生效基准', nextDay) ? cellOf('生效基准', nextDay).textContent : '') : '';

  /* 输入 → 未点生效 → 不入库 */
  ins[target].value = '12.3';
  ins[target].dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  await sleep(150);
  ok(btns[target].classList.contains('btn-primary'), '改动后按钮转为高亮的「生效」');
  ok(btns[target].textContent.trim() === '生效', '按钮文案回到「生效」', btns[target].textContent.trim());
  let cfg1 = JSON.parse(mem.map.get('ohd_op_cfg') || '{}');
  ok(!cfg1.earnProg || !cfg1.earnProg.manual, '未点生效时不写入 localStorage');

  /* 点「生效」 */
  btns[target].click();
  await sleep(400);
  const cfg2 = JSON.parse(mem.map.get('ohd_op_cfg') || '{}');
  const manArr = (cfg2.earnProg && cfg2.earnProg.manual) ? Object.values(cfg2.earnProg.manual)[0] : null;
  ok(!!manArr, '点生效后 manual 已入库', JSON.stringify(cfg2.earnProg && cfg2.earnProg.manual));
  ok(manArr && Number(manArr[target]) === 12.3, '入库值 = 12.3（第 ' + target + ' 天）', JSON.stringify(manArr));

  /* 重渲染后按钮变「已生效」绿色 */
  const btns2 = Array.from(doc.getElementById('tblEarnMan').querySelectorAll('[data-emok]'));
  ok(btns2[target] && btns2[target].textContent.trim() === '已生效', '生效后按钮显示「已生效」', btns2[target] && btns2[target].textContent.trim());
  ok(btns2[target] && btns2[target].classList.contains('btn-green'), '已生效按钮为绿色');

  /* 后续日期基准随之调整（递进链：下一天沿用修正值） */
  if (nextDay <= 6) {
    const baseAfter = cellOf('生效基准', nextDay) ? cellOf('生效基准', nextDay).textContent : '';
    ok(/12\.3/.test(baseAfter), '次日「生效基准」已调整为 12.3（前一日修正值）', 'before=' + baseBefore.trim() + ' after=' + baseAfter.trim());
    ok(/前一日修正值/.test(baseAfter), '次日来源标注「前一日修正值」', baseAfter.trim());
  } else {
    ok(true, '修正是本周最后一天，无次日可验证（跳过）');
    ok(true, '（跳过）');
  }
  const srcCell = cellOf('生效基准', target) ? cellOf('生效基准', target).textContent : '';
  ok(/手动修正/.test(srcCell), '当日来源标注「手动修正」', srcCell.trim());

  /* ③ 的「保存」不再整表覆盖 manual */
  const insAll = Array.from(doc.getElementById('tblEarnMan').querySelectorAll('[data-em]'));
  insAll.forEach(el => { if (!el.hasAttribute('readonly')) el.value = '99'; });
  doc.getElementById('btnAlarmSave').click();
  await sleep(400);
  const cfg3 = JSON.parse(mem.map.get('ohd_op_cfg') || '{}');
  const man3 = (cfg3.earnProg && cfg3.earnProg.manual) ? Object.values(cfg3.earnProg.manual)[0] : null;
  ok(man3 && Number(man3[target]) === 12.3, '点「保存」不会把未生效的草稿写进 manual', JSON.stringify(man3));

  /* 清掉：置空后点生效 → 恢复自动 */
  const insT = Array.from(doc.getElementById('tblEarnMan').querySelectorAll('[data-em]'))[target];
  const btnT = Array.from(doc.getElementById('tblEarnMan').querySelectorAll('[data-emok]'))[target];
  insT.value = '';
  insT.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  await sleep(120);
  btnT.click();
  await sleep(400);
  const cfg4 = JSON.parse(mem.map.get('ohd_op_cfg') || '{}');
  const man4 = (cfg4.earnProg && cfg4.earnProg.manual) ? Object.values(cfg4.earnProg.manual)[0] : null;
  ok(man4 && man4[target] === null, '置空后点生效 → 该日恢复自动（null）', JSON.stringify(man4));

  ok(/修正值需点当日「生效」按钮才写入/.test(txt()), '说明含「需点当日生效按钮才写入」');
  ok(/已过去的日期/.test(txt()) && /按钮禁用/.test(txt()), '说明含「已过去的日期按钮禁用」');
  ok(errs.length === 0, '全流程无 JS 异常', errs.join(' | '));

  console.log('\nTOTAL pass=' + pass + ' fail=' + fail);
  process.exit(fail ? 1 : 0);
})();
