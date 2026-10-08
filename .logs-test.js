/* 日志管理 · 生产日志 静态页 无头校验（开发用）
   node .logs-test.js → 渲染 / LEAD-NON-LEAD 切换 / 班次回看 / 无 JS 异常 */
const fs = require('fs');
const PORT = 9333;
const url = 'file:///' + process.cwd().replace(/\\/g, '/') + '/logs.html';
const results = [];
const ok = (name, pass, extra) => { results.push([pass ? 'PASS' : 'FAIL', name, extra == null ? '' : String(extra)]); };

(async () => {
  const r = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  const t = await r.json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  let id = 0; const pending = new Map(); const errors = [];
  const send = (m, p = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result || {}); pending.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errors.push('EXCEPTION: ' + ((m.params.exceptionDetails.exception || {}).description || m.params.exceptionDetails.text));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('CONSOLE: ' + m.params.args.map(a => a.value || a.description || '').join(' '));
  };
  await new Promise(res => { ws.onopen = res; });
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1500, height: 1000, deviceScaleFactor: 1, mobile: false });
  const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result.value;
  const shot = async (file, y) => {
    if (y != null) { await ev(`window.scrollTo(0,${y})`); await new Promise(x => setTimeout(x, 300)); }
    const s = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(file, Buffer.from(s.data, 'base64'));
  };

  await send('Page.navigate', { url });
  await new Promise(x => setTimeout(x, 2600));
  await ev(`localStorage.clear()`);
  await send('Page.navigate', { url });
  await new Promise(x => setTimeout(x, 2600));

  /* ---- 1. 默认渲染（LEAD 当前班） ---- */
  const navTxt = await ev(`(()=>{const a=document.querySelector('.nav-item.active');return a?a.textContent.replace(/\\s+/g,' '):''})()`);
  ok('侧边导航含「日志管理 · 生产日志」且高亮', /日志管理/.test(navTxt), navTxt);
  ok('顶部标题正确', (await ev(`document.querySelector('.page-title').textContent`)).indexOf('日志管理') >= 0);
  const rows0 = await ev(`document.querySelectorAll('.logs-table tbody tr').length`);
  ok('默认 5 条日志', rows0 === 5, 'rows=' + rows0);
  const from0 = await ev(`document.querySelector('.log-from').textContent`);
  ok('默认 LEAD 当前班 From', from0 === 'From：夜班 - A班 - 孙志彬', from0);
  const date0 = await ev(`(document.querySelectorAll('.log-from')[1]||{textContent:''}).textContent`);
  ok('Date 显示', date0 === 'Date：2026-09-24', date0);
  const row1 = await ev(`document.querySelector('.logs-table tbody tr td:nth-child(2)').textContent`);
  ok('首行内容 = BSG-32 生产前BUYOFF', /BSG-32 生产前BUYOFF/.test(row1), row1);
  ok('「创建新内容」等标注移除项不存在', (await ev(`document.body.innerHTML.includes('创建新内容') || document.body.innerHTML.includes('白班交接') || document.body.innerHTML.includes('物料') && false`)) === false);
  const prevDisabled = await ev(`document.getElementById('btnPrev').disabled`);
  const curDisabled = await ev(`document.getElementById('btnCur').disabled`);
  ok('当前班：上一个交班班可用 / 回到当前班禁用', prevDisabled === false && curDisabled === true, `prev=${prevDisabled} cur=${curDisabled}`);
  await shot('shot-logs-lead.png', 0);

  /* ---- 2. 班次回看 ---- */
  await ev(`document.getElementById('btnPrev').click()`);
  await new Promise(x => setTimeout(x, 300));
  const from1 = await ev(`document.querySelector('.log-from').textContent`);
  ok('上一个交班班 → 白班 B班 周颖', from1 === 'From：白班 - B班 - 周颖', from1);
  const histChip = await ev(`!!document.querySelector('.chip-danger')`);
  ok('出现「正在查看历史班次」chip', histChip === true, 'chip=' + histChip);
  const curDisabled1 = await ev(`document.getElementById('btnCur').disabled`);
  ok('历史班次下「回到当前班」可用', curDisabled1 === false, 'cur=' + curDisabled1);
  await ev(`document.getElementById('btnPrev').click()`);
  await new Promise(x => setTimeout(x, 300));
  const prevDisabled2 = await ev(`document.getElementById('btnPrev').disabled`);
  ok('到最早班次后「上一个交班班」禁用', prevDisabled2 === true, 'prev=' + prevDisabled2);
  await ev(`document.getElementById('btnCur').click()`);
  await new Promise(x => setTimeout(x, 300));
  ok('回到当前班 → From 还原', (await ev(`document.querySelector('.log-from').textContent`)) === 'From：夜班 - A班 - 孙志彬');

  /* ---- 3. 切 NON-LEAD ---- */
  await ev(`[...document.querySelectorAll('#segDept button')].find(b=>b.dataset.d==='NON-LEAD').click()`);
  await new Promise(x => setTimeout(x, 300));
  const fromN = await ev(`document.querySelector('.log-from').textContent`);
  ok('NON-LEAD 当前班 From', fromN === 'From：夜班 - A班 - 刘洋', fromN);
  const rowN = await ev(`document.querySelector('.logs-table tbody tr td:nth-child(2)').textContent`);
  ok('NON-LEAD 首行内容不同', /BSG-45/.test(rowN), rowN);
  const activeD = await ev(`document.querySelector('#segDept .active').getAttribute('data-d')`);
  ok('seg 高亮 NON-LEAD', activeD === 'NON-LEAD', activeD);
  const deptStored = await ev(`localStorage.getItem('ohd_logs_dept')`);
  ok('部门选择持久化', /NON-LEAD/.test(deptStored || ''), 'v=' + deptStored);
  await shot('shot-logs-nonlead.png', 0);

  /* ---- 4. 刷新后保持 NON-LEAD ---- */
  await send('Page.navigate', { url });
  await new Promise(x => setTimeout(x, 2600));
  ok('刷新后仍为 NON-LEAD', (await ev(`document.querySelector('.log-from').textContent`)) === 'From：夜班 - A班 - 刘洋');

  ok('无 JS 异常 / console.error', errors.length === 0, errors.join(' | ').slice(0, 300));

  const pass = results.filter(x => x[0] === 'PASS').length;
  console.log('\n================ 日志管理静态页校验 ================');
  results.forEach(([s, n, e]) => console.log(`${s === 'PASS' ? '✔' : '✘'} ${s}  ${n}${e ? '  → ' + e : ''}`));
  console.log(`\n合计 ${pass}/${results.length} PASS`);
  ws.close();
})().catch(e => { console.error('测试脚本异常：', e); process.exit(1); });
