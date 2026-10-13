/* 校验：WIP 在制品看板接入 COMPound 塑封料解冻状态（抽屉表新列 + 筛选 + tooltip） · jsdom 版 */
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const FILE = path.resolve('wip.html');
let pass = 0, fail = 0;
const ok = (c, m, extra) => { c ? (pass++, console.log('PASS ' + m)) : (fail++, console.log('FAIL ' + m + (extra ? '  << ' + extra : ''))); };

(async () => {
  const errs = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!/Not implemented: navigation/.test(String(e))) errs.push(String(e.message || e)); });
  vc.on('error', (...a) => errs.push('console.error: ' + a.join(' ')));
  const dom = await JSDOM.fromFile(FILE, { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc });
  await new Promise(r => setTimeout(r, 1000));
  const w = dom.window, doc = w.document;

  ok(errs.length === 0, '加载渲染无 JS 异常', errs.join(' | '));

  /* 打开第一个工序抽屉（二级明细） */
  const item = doc.querySelector('.wr-item') || doc.querySelector('.wh-name');
  ok(!!item, '存在可点击进入二级明细的工序入口');
  item.click();
  await new Promise(r => setTimeout(r, 700));

  const drawer = doc.getElementById('wipDrawer');
  ok(!!drawer, '抽屉已打开');

  /* 演示补充强调横幅（非客户初始需求） */
  const noteTxt = drawer.querySelector('.thaw-demo-note') ? drawer.querySelector('.thaw-demo-note').textContent : '';
  ok(/演示补充能力 · 非客户初始需求/.test(noteTxt), '抽屉顶部有「演示补充能力 · 非客户初始需求」强调横幅');
  ok(/不属原《OneBE 添加交接信息》WIP 需求范围/.test(noteTxt), '横幅明确标注不属客户初始 WIP 需求范围');

  /* 新列「塑封料解冻」存在 + 列头「演示」标签 */
  const headTxt = (drawer.querySelector('.wdt thead') || doc.body).textContent || '';
  ok(/塑封料解冻/.test(headTxt), '抽屉表含「塑封料解冻」列');
  ok(/塑封料解冻/.test(headTxt) && /演示/.test(drawer.querySelector('.wdt thead').textContent), '列头「塑封料解冻」带「演示」标签');

  /* 至少有解冻状态单元格（已解冻/解冻中/解冻超时） */
  const thawCells = Array.from(drawer.querySelectorAll('.wdt tbody td')).filter(td => /已解冻|解冻中|解冻超时/.test(td.textContent));
  ok(thawCells.length > 0, '存在塑封料解冻状态单元格（count=' + thawCells.length + '）', thawCells.length);

  /* tooltip 含物料批号（悬停信息） + 标注「演示补充数据」 */
  const tipCell = thawCells.find(td => /物料批号/.test(td.getAttribute('title') || ''));
  ok(!!tipCell, '解冻单元格 tooltip 含「物料批号 / 解冻开始 / 预计就绪」');
  ok(!!tipCell && /演示补充数据/.test(tipCell.getAttribute('title') || ''), '解冻单元格 tooltip 标注「演示补充数据」');

  /* 单元格明面展示解冻开始 / 结束时间（用户要求：放到明面，不只 tooltip） */
  const twinCell = thawCells.find(td => /开始\s*\d{1,2}:\d{2}/.test(td.textContent) && /结束\s*\d{1,2}:\d{2}/.test(td.textContent));
  ok(!!twinCell, '解冻单元格明面展示「开始 HH:MM」与「结束 HH:MM」时间');

  /* 筛选按钮存在 + 常驻「演示」标记（chip-demo） */
  const fThaw = drawer.querySelector('#fThaw');
  ok(!!fThaw, '存在「仅看解冻超时」筛选按钮');
  ok(fThaw && fThaw.classList.contains('chip-demo'), '筛选按钮常驻「演示」标记（chip-demo 样式）');
  ok(fThaw && /演示/.test(fThaw.textContent), '筛选按钮文案含「· 演示」');

  /* 点击筛选后，表内仅剩解冻超时行（若存在超时批） */
  if (fThaw) {
    fThaw.click();
    await new Promise(r => setTimeout(r, 400));
    const rows = Array.from(drawer.querySelectorAll('.wdt tbody tr')).filter(tr => tr.querySelector('td'));
    const allOvertime = rows.every(tr => /解冻超时/.test(tr.textContent));
    const nonEmpty = rows.length > 0;
    ok(!nonEmpty || allOvertime, '点击「仅看解冻超时」后表内仅剩解冻超时行（rows=' + rows.length + '）');
    ok(/解冻超时/.test((drawer.querySelector('.wd-title') || doc.body).textContent || ''), '抽屉标题显示「解冻超时 N」计数');
  }

  /* 解冻超时行有左侧高亮（inline box-shadow） */
  const otRow = Array.from(drawer.querySelectorAll('.wdt tbody tr')).find(tr => /解冻超时/.test(tr.textContent));
  ok(!otRow || /inset 3px 0 0 #b45309/.test(otRow.getAttribute('style') || ''), '解冻超时行带左侧琥珀色高亮');

  ok(errs.length === 0, '全程无 JS 异常', errs.join(' | '));
  console.log('\nTOTAL pass=' + pass + ' fail=' + fail);
  w.close();
  process.exit(fail ? 1 : 0);
})();
