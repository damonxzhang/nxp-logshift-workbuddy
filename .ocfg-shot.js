/* 截图 op-config.html 的 ④ 页签（开发用） */
const PORT = 9333;
const cwd = __dirname.replace(/\\/g, '/');
const URL = 'file:///' + cwd + '/op-config.html';
const OUT = process.argv[2] || 'shot-opcfg-norefresh.png';

(async () => {
  const r = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(URL)}`, { method: 'PUT' });
  const t = await r.json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  const send = (m, p = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result || {}); pending.delete(m.id); } };
  await new Promise(res => { ws.onopen = res; });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: URL });
  await new Promise(r2 => setTimeout(r2, 1500));
  const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result.value;
  await ev(`(()=>{const b=[...document.querySelectorAll('#segTab button')].find(x=>x.dataset.t==='alarm');if(b)b.click();return 1})()`);
  await new Promise(r2 => setTimeout(r2, 600));
  await ev(`(()=>{const c=[...document.querySelectorAll('.card-title')].map(x=>x.closest('.card')).find(x=>x&&x.innerText.indexOf('预警分口径')>=0);if(c)c.scrollIntoView({block:'start'});return 1})()`);
  await new Promise(r2 => setTimeout(r2, 400));
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  require('fs').writeFileSync(OUT, Buffer.from(shot.data, 'base64'));
  console.log('SHOT=' + OUT);
  ws.close();
  process.exit(0);
})();
