/* 临时调试：逐项点击排行条，检查抽屉 open 类与报错 */
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
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url });
  await new Promise(r2 => setTimeout(r2, 2600));
  const q = async ex => (await send('Runtime.evaluate', { expression: ex, returnByValue: true })).result;
  await q("window.addEventListener('error', e => { window.__err = e.message; }); window.addEventListener('unhandledrejection', e => { window.__err = 'rej:' + e.reason; });");
  for (const idx of [0, 1]) {
    console.log('click' + idx + ':', JSON.stringify(await q("document.querySelectorAll('.wr-item .wr-name')[" + idx + "].click(); 'ok'")));
    await new Promise(r2 => setTimeout(r2, 600));
    console.log('cls' + idx + ':', JSON.stringify(await q("document.getElementById('wipDrawer').className")));
    console.log('title' + idx + ':', JSON.stringify(await q("document.querySelector('.wd-title') ? document.querySelector('.wd-title').textContent.trim().replace(/\\s+/g,' ') : 'EMPTY'")));
    console.log('err' + idx + ':', JSON.stringify(await q('window.__err || "none"')));
    await q("if (document.querySelector('#wdClose')) document.querySelector('#wdClose').click();");
    await new Promise(r2 => setTimeout(r2, 400));
  }
  ws.close(); process.exit(0);
})().catch(e => { console.error('FAIL ' + e.message); process.exit(1); });
