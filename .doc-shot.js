/* 文档分区截图（开发用）：node .doc-shot.js <选择器> <输出png> [宽] */
const fs = require('fs');
const PORT = 9333;
const sel = process.argv[2];
const out = process.argv[3];
const W = Number(process.argv[4] || 1440);
const url = 'file:///' + process.cwd().replace(/\\/g, '/') + '/图表逻辑关系说明.html';
(async () => {
  const r = await fetch('http://127.0.0.1:' + PORT + '/json/new?' + encodeURIComponent(url), { method: 'PUT' });
  const t = await r.json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  const send = (m, p = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result || {}); pending.delete(m.id); } };
  await new Promise(res => { ws.onopen = res; });
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });
  await new Promise(x => setTimeout(x, 3200));
  const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result.value;
  const box = await ev('(function(){var e=document.querySelector(' + JSON.stringify(sel) + ');if(!e)return null;var r=e.getBoundingClientRect();return JSON.stringify({x:r.left+scrollX,y:r.top+scrollY,w:r.width,h:r.height})})()');
  if (!box) { console.log('NOT_FOUND ' + sel); process.exit(1); }
  const b = JSON.parse(box);
  const shot = await send('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: true,
    clip: { x: Math.max(0, b.x - 8), y: Math.max(0, b.y - 8), width: Math.min(b.w + 16, W), height: b.h + 16, scale: 1 }
  });
  fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log('SHOT=' + out + '  ' + Math.round(b.w) + 'x' + Math.round(b.h));
  ws.close();
  try { await fetch('http://127.0.0.1:' + PORT + '/json/close/' + t.id); } catch (e) { }
  process.exit(0);
})().catch(e => { console.error('FAIL: ' + e.message); process.exit(1); });
