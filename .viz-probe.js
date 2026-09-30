/* 校验方案 E 弧柱几何：每根柱的屏幕高度应与在制量正相关，且位置沿圆周分布 */
const PORT = 9333;
const url = 'file:///' + process.cwd().replace(/\\/g, '/') + '/wip.html';
(async () => {
  const r = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  const t = await r.json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  const send = (m, p = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result || {}); pending.delete(m.id); } };
  await new Promise(res => { ws.onopen = res; });
  const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result.value;
  await send('Emulation.setDeviceMetricsOverride', { width: 1500, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });
  await new Promise(x => setTimeout(x, 2600));
  await ev(`[...document.querySelectorAll('#vizSeg button')].find(x=>x.dataset.v==='E').click()`);
  await new Promise(x => setTimeout(x, 2400));
  const out = await ev(`[...document.querySelectorAll('.vz-pbar-g')].map(g=>{
    const rc=g.querySelector('rect').getBoundingClientRect();
    return {s:g.dataset.step,h:Math.round(rc.height),cx:Math.round(rc.x+rc.width/2),cy:Math.round(rc.y+rc.height/2)};
  })`);
  console.log(JSON.stringify(out, null, 0));
  ws.close();
  try { await fetch(`http://127.0.0.1:${PORT}/json/close/${t.id}`); } catch (e) { }
  process.exit(0);
})().catch(e => { console.error('FAIL: ' + e.message); process.exit(1); });
