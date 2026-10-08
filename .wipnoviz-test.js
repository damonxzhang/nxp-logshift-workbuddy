/* WIP 看板 · 动态可视化下线校验（开发用）
   node .wipnoviz-test.js → 确认「动态可视化 · 环形仪表盘阵列」整块移除、其余功能不受影响 */
const fs = require('fs');
const PORT = 9333;
const url = 'file:///' + process.cwd().replace(/\\/g, '/') + '/wip.html';
const results = [];
const ok = (n, p, e) => results.push([p ? 'PASS' : 'FAIL', n, e == null ? '' : String(e)]);

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
  await new Promise(x => setTimeout(x, 3000));

  /* ---- 1. 可视化整块消失 ---- */
  const bodyTxt = await ev(`document.getElementById('content').textContent.replace(/\\s+/g,' ')`);
  ok('页面无「动态可视化」文案', !/动态可视化/.test(bodyTxt));
  ok('页面无「环形仪表盘」文案', !/环形仪表盘/.test(bodyTxt));
  ok('无 #vizHost 容器', (await ev(`!!document.getElementById('vizHost')`)) === false);
  ok('无 .vz-ring / .vz-host DOM', (await ev(`document.querySelectorAll('.vz-ring,.vz-host,.vz-info,.wip-viz').length`)) === 0);
  ok('wip.html 不再引入 wip-viz.js', (await ev(`!!document.querySelector('script[src*="wip-viz.js"]')`)) === false);
  ok('未定义全局 WipViz', (await ev(`typeof window.WipViz`)) === 'undefined');
  const cardsNow = await ev(`document.querySelectorAll('#content .card, #content section.card').length`);
  ok('卡片数 4（筛选 + 矩阵 + 排行 + Hold；原 5 张含可视化卡）', cardsNow === 4, 'cards=' + cardsNow);

  /* ---- 2. 其余功能完好 ---- */
  ok('5 个 KPI 仍在', (await ev(`document.querySelectorAll('.wip-kpi').length`)) === 5);
  ok('口径切换按钮仍在', (await ev(`!!document.getElementById('uK') && !!document.getElementById('uW')`)) === true);
  const heat = await ev(`document.querySelectorAll('#whGrid .wh-cell').length`);
  ok('热力矩阵仍渲染', heat > 0, 'cells=' + heat);
  const rank = await ev(`document.querySelectorAll('#wrList .wr-row, #wrList > div').length`);
  ok('工序排行仍渲染', rank > 0, 'rows=' + rank);
  ok('Hold 跑马灯仍在', (await ev(`!!document.querySelector('.wip-ticker')`)) === true);

  /* ---- 3. 二级抽屉仍可进入 ---- */
  await ev(`(()=>{const c=document.querySelector('#whGrid .wh-cell:not(.empty)')||document.querySelector('#wrList div');c&&c.click();return 1})()`);
  await new Promise(x => setTimeout(x, 900));
  const drawer = await ev(`!!document.querySelector('.drawer.open, .wd-wrap, #drawer') || document.body.textContent.indexOf('二级筛选')>=0`);
  ok('点矩阵/排行仍能进入二级', drawer === true, 'drawer=' + drawer);

  /* ---- 4. 口径切换后重渲染无异常 ---- */
  await ev(`document.getElementById('uW').click()`);
  await new Promise(x => setTimeout(x, 1200));
  ok('切 by earn 后无 viz 残留', (await ev(`document.querySelectorAll('.vz-ring,.vz-host').length`)) === 0);
  await shot('shot-wip-noviz.png', 0);

  ok('无 JS 异常 / console.error', errors.length === 0, errors.join(' | ').slice(0, 300));

  const pass = results.filter(x => x[0] === 'PASS').length;
  console.log('\n================ WIP 可视化下线校验 ================');
  results.forEach(([s, n, e]) => console.log(`${s === 'PASS' ? '✔' : '✘'} ${s}  ${n}${e ? '  → ' + e : ''}`));
  console.log(`\n合计 ${pass}/${results.length} PASS`);
  ws.close();
})().catch(e => { console.error('测试脚本异常：', e); process.exit(1); });
