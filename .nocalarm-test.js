/* 校验：OP 配置页「异常判定口径（全局）」整块已下线（2026-10-08）· jsdom 版 */
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const FILE = path.resolve('op-config.html');
let pass = 0, fail = 0;
const ok = (c, m, extra) => { c ? (pass++, console.log('PASS ' + m)) : (fail++, console.log('FAIL ' + m + (extra ? '  << ' + extra : ''))); };

(async () => {
  const errs = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!/Not implemented: navigation/.test(String(e))) errs.push(String(e.message || e)); });
  vc.on('error', (...a) => errs.push('console.error: ' + a.join(' ')));
  const dom = await JSDOM.fromFile(FILE, { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc });
  await new Promise(r => setTimeout(r, 900));
  const w = dom.window, doc = w.document;

  /* 切到 ④ 页签 */
  const seg = doc.getElementById('segTab');
  const btn = seg && Array.from(seg.querySelectorAll('button')).find(b => b.dataset.t === 'alarm');
  ok(!!btn, '找到 ④ 页签按钮');
  btn.click();
  await new Promise(r => setTimeout(r, 300));

  const txt = doc.getElementById('content').textContent;
  const html = doc.getElementById('content').innerHTML;

  ok(!/异常判定口径/.test(txt), '④ 页无「异常判定口径（全局）」标题', (txt.match(/异常判定口径[^\n]*/) || [])[0]);
  ok(!/比对模式/.test(txt), '④ 页无「比对模式」字段');
  ok(!/差额比对/.test(txt) && !/复合比对/.test(txt), '④ 页无 差额比对 / 复合比对 选项');
  ok(!/阈值维护位置/.test(txt), '④ 页无「阈值维护位置」');
  ok(!/全部品类汇总阈值/.test(txt), '④ 页无「全部品类汇总阈值」chip');
  ok(!doc.getElementById('cfgAlarmMode'), 'DOM 无 #cfgAlarmMode');
  ok(!doc.getElementById('lnkToTypes'), 'DOM 无 #lnkToTypes 跳转链接');
  const tables = doc.querySelectorAll('#content .card table').length;
  ok(tables === 1, '④ 页仅剩 Earn 手动修正一张表（tables=' + tables + '）');

  /* 保留项 */
  ok(/预警逻辑分口径/.test(txt), '④ 页仍保留「预警逻辑分口径（10-08 修正）」');
  ok(/Earn 目标手动修正/.test(txt), '④ 页仍保留「Earn 目标手动修正」表');
  ok(/夏令时/.test(txt), '④ 页仍保留夏令时配置');
  ok(!!doc.getElementById('cfgDst') && !!doc.getElementById('cfgDstHour') && !!doc.getElementById('cfgEarnMode') && !!doc.getElementById('tblEarnMan'),
    '夏令时 / 开始时间 / Earn 口径 / 手动修正表 DOM 均在');

  /* 保存仍可用 */
  try {
    doc.getElementById('btnAlarmSave').click();
    await new Promise(r => setTimeout(r, 300));
    /* 注：jsdom 下 file:// 为 opaque origin，store.set 写 localStorage 会抛 SecurityError，
       保存流程（含 toast）在 jsdom 中无法完整走通；这里只验证「点击保存不产生未捕获异常 + 页面仍可重渲染」，
       持久化与 toast 在真实浏览器中生效（此前 CDP 版 .norefresh-test.js 已验证过同一条保存链路）。 */
    ok(/预警逻辑分口径/.test(doc.getElementById('content').textContent), '点击保存后 ④ 页重渲染正常');
  } catch (e) {
    ok(false, '保存流程异常', e && (e.name + ': ' + e.message));
  }

  /* 恢复默认配置 */
  const rs = doc.getElementById('btnResetAll');
  if (rs) { rs.click(); await new Promise(r => setTimeout(r, 300)); }
  ok(/预警逻辑分口径/.test(doc.getElementById('content').textContent), '「恢复默认配置」后页面仍正常渲染');

  ok(errs.length === 0, '无 JS 异常', errs.join(' | '));
  console.log('\nTOTAL pass=' + pass + ' fail=' + fail);
  w.close();
  process.exit(fail ? 1 : 0);
})();
