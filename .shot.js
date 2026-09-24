/* 无头截图工具（开发用）
   node .shot.js <url> <out.png> [hoverX] [hoverY]   —— 可模拟鼠标悬停验证侧边栏浮出 */
const fs = require('fs');
const url = process.argv[2];
const out = process.argv[3];
const hx = process.argv[4] ? Number(process.argv[4]) : null;
const hy = process.argv[5] ? Number(process.argv[5]) : null;
const PORT = 9333;

(async () => {
  const r = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  const t = await r.json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  const send = (method, params = {}) => new Promise(res => {
    const i = ++id; pending.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result || {}); pending.delete(m.id); } };
  await new Promise(res => { ws.onopen = res; });
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });
  await new Promise(r2 => setTimeout(r2, 2600));
  if (hx !== null) {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: hx, y: hy, buttons: 0 });
    await new Promise(r2 => setTimeout(r2, 700));
  }
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log('SHOT=' + out);
  ws.close();
  try { await fetch(`http://127.0.0.1:${PORT}/json/close/${t.id}`); } catch (e) { }
  process.exit(0);
})().catch(e => { console.error('SHOT_FAIL: ' + e.message); process.exit(1); });
