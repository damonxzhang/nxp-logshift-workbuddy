/* 校验：OP 配置页「数据刷新机制（频率待 IT 确认）」整块已下线（2026-10-08） */
const fs = require('fs');
const PORT = 9333;
const cwd = __dirname.replace(/\\/g, '/');
const root = 'file:///' + cwd + '/';
const URL = root + 'op-config.html';

let pass = 0, fail = 0;
const ok = (c, m, extra) => { c ? (pass++, console.log('PASS ' + m)) : (fail++, console.log('FAIL ' + m + (extra ? '  << ' + extra : ''))); };

(async () => {
  const r = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(URL)}`, { method: 'PUT' });
  const t = await r.json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  const send = (method, params = {}) => new Promise(res => {
    const i = ++id; pending.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  const errs = [];
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result || {}); pending.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') { const d = m.params.exceptionDetails; errs.push('EXCEPTION: ' + ((d.exception && d.exception.description) || d.text || '')); }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errs.push('CONSOLE: ' + m.params.args.map(a => a.value || a.description || '').join(' '));
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errs.push('LOG: ' + m.params.entry.text);
  };
  await new Promise(res => { ws.onopen = res; });
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');

  const ev = async (expr) => {
    const r2 = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    return (r2.result && r2.result.value !== undefined) ? r2.result.value : (r2.exceptionDetails ? ('ERR:' + JSON.stringify(r2.exceptionDetails.text)) : null);
  };
  const wait = ms => new Promise(r2 => setTimeout(r2, ms));

  await send('Page.navigate', { url: URL });
  await wait(1400);

  /* 切到 ④ 页签 */
  await ev(`(()=>{const seg=document.getElementById('segTab');if(seg){const b=[...seg.querySelectorAll('button')].find(x=>x.dataset.t==='alarm');if(b)b.click();}return 1})()`);
  await wait(700);

  const txt = await ev(`document.getElementById('content').innerText`);
  const html = await ev(`document.getElementById('content').innerHTML`);

  ok(!/数据刷新机制/.test(txt), '④ 页无「数据刷新机制」标题', txt.match(/数据刷新机制/));
  ok(!/刷新模式/.test(txt), '④ 页无「刷新模式」字段', txt.match(/刷新模式/));
  ok(!/自动间隔/.test(txt), '④ 页无「自动间隔（秒）」字段', txt.match(/自动间隔/));
  ok(!/实际数据来源/.test(txt), '④ 页无「实际数据来源」字段', txt.match(/实际数据来源/));
  ok(!/库表 \/ 字段口径待客户确认/.test(txt), '④ 页无「库表 / 字段口径待客户确认」chip');
  ok(!/频率待 IT 确认/.test(txt), '④ 页无「频率待 IT 确认」字样');
  ok(!/BE1 Output Report V5\.xls/.test(txt), '④ 页无数据来源报表名', txt.match(/BE1 Output Report[^\n]*/));

  const domNo = await ev(`[!!document.getElementById('cfgRefresh'), !!document.getElementById('cfgAutoSec')]`);
  ok(domNo && domNo[0] === false, 'DOM 无 #cfgRefresh（刷新模式 seg）');
  ok(domNo && domNo[1] === false, 'DOM 无 #cfgAutoSec（自动间隔输入）');

  const tabLabel = await ev(`(()=>{const b=[...document.querySelectorAll('#segTab button')].find(x=>x.dataset.t==='alarm');return b?b.textContent.trim():null})()`);
  ok(/预警分口径 \/ 夏令时/.test(tabLabel || ''), '页签标题已改为「④ 预警分口径 / 夏令时」', tabLabel);

  const cardTitle = await ev(`(()=>{const c=[...document.querySelectorAll('.card-title')].map(x=>x.textContent.trim()).find(s=>s.indexOf('预警分口径')>=0);return c||null})()`);
  ok(cardTitle && !/刷新/.test(cardTitle), '卡标题不再含「刷新」', cardTitle);

  /* 保留项仍在 */
  ok(/夏令时/.test(txt), '④ 页仍保留「夏令时 / 冬令时」配置');
  ok(/预警分口径/.test(txt), '④ 页仍保留「预警分口径」配置');
  ok(/Earn 目标手动修正/.test(txt), '④ 页仍保留「Earn 目标手动修正」表');
  const keep = await ev(`[!!document.getElementById('cfgDst'), !!document.getElementById('cfgDstHour'), !!document.getElementById('cfgEarnMode'), !!document.getElementById('tblEarnMan')]`);
  ok(keep && keep.every(Boolean), '夏令时/开始时间/Earn口径/手动修正表 DOM 均在', JSON.stringify(keep));

  /* 夏令时仍可切换 */
  await ev(`(()=>{const b=[...document.querySelectorAll('#cfgDst button')].find(x=>x.dataset.m==='winter');if(b)b.click();return 1})()`);
  await wait(200);
  const dstWinter = await ev(`(()=>{const b=[...document.querySelectorAll('#cfgDst button')].find(x=>x.dataset.m==='winter');return b?b.classList.contains('active'):null})()`);
  ok(dstWinter === true, '夏令时 seg 仍可切换（冬令时选中生效）');
  await ev(`(()=>{const b=[...document.querySelectorAll('#cfgDst button')].find(x=>x.dataset.m==='summer');if(b)b.click();return 1})()`);

  /* 保存仍可用（不因删除刷新块报错） */
  await ev(`(()=>{const b=document.getElementById('btnAlarmSave');if(b)b.click();return 1})()`);
  await wait(600);
  const toastTxt = await ev(`(()=>{const t=document.querySelector('.toast');return t?t.innerText:''})()`);
  ok(/配置已保存/.test(toastTxt || '') && !/刷新/.test(toastTxt || ''), '保存按钮正常且 toast 文案已改为「预警分口径 / 夏令时配置已保存」', toastTxt);
  const savedCfg = await ev(`JSON.stringify((JSON.parse(localStorage.getItem('ohd_op_cfg')||'{}')).dst)`);
  ok(savedCfg === '"summer"', '保存后 dst=summer 正确写入', savedCfg);

  /* 恢复默认配置按钮仍可用 */
  await ev(`(()=>{const b=document.getElementById('btnResetAll');if(b)b.click();return 1})()`);
  await wait(500);
  ok(/预警分口径/.test(await ev(`document.getElementById('content').innerText`)), '「恢复默认配置」后页面仍正常渲染');

  ok(errs.length === 0, '无 JS 异常', errs.join(' | '));

  console.log(`\nTOTAL pass=${pass} fail=${fail}`);
  ws.close();
  process.exit(fail ? 1 : 0);
})();
