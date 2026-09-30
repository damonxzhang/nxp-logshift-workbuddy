/* 临时：验证二级抽屉交互（点击排行第2项 BE_SAW → 仅看 Hold → 展开报警配置） */
const fs = require('fs');
const url = process.argv[2];
const PORT = 9333;
(async () => {
  const r = await fetch('http://127.0.0.1:' + PORT + '/json/new?' + encodeURIComponent(url), { method: 'PUT' });
  const t = await r.json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  const send = (m, p = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result || {}); pending.delete(m.id); } };
  await new Promise(res => { ws.onopen = res; });
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });
  await new Promise(r2 => setTimeout(r2, 2600));
  const ev = ex => send('Runtime.evaluate', { expression: ex });
  await ev(`document.querySelectorAll('.wr-item .wr-name')[1].click()`);
  await new Promise(r2 => setTimeout(r2, 900));
  await ev(`document.querySelector('#fHold').click()`);
  await new Promise(r2 => setTimeout(r2, 500));
  await ev(`document.querySelector('.wd-alarm').setAttribute('open','')`);
  await new Promise(r2 => setTimeout(r2, 400));
  const info = await send('Runtime.evaluate', { expression: `JSON.stringify({
    title: document.querySelector('.wd-title').textContent.trim().replace(/\\s+/g,' '),
    rows: document.querySelectorAll('table.wdt tbody tr').length,
    alRed: document.querySelectorAll('table.wdt tr.al-red').length,
    holdChips: [...document.querySelectorAll('table.wdt td .chip')].length,
    kpis: [...document.querySelectorAll('.wd-kpi b')].map(b => b.textContent)
  })`, returnByValue: true });
  console.log(JSON.stringify(info).slice(0, 600));
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('.shot-wip3.png', Buffer.from(shot.data, 'base64'));
  ws.close();
  try { await fetch('http://127.0.0.1:' + PORT + '/json/close/' + t.id); } catch (e) { }
  process.exit(0);
})().catch(e => { console.error('FAIL ' + e.message); process.exit(1); });
