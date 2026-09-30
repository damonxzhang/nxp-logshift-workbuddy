/* 临时量尺（开发用，不随页面发布）：输出视口与两张图卡的实际几何数据 */
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
  await new Promise(r2 => setTimeout(r2, 2800));
  const expr = 'JSON.stringify({' +
    'ih: window.innerHeight,' +
    'stackTop: Math.round(document.getElementById("chartStack").getBoundingClientRect().top + scrollY),' +
    'cards: [...document.querySelectorAll(".op-chart-card")].map(c => c.offsetHeight),' +
    'charts: [...document.querySelectorAll(".op-chart-card .lc-wrap")].map(w => w.offsetHeight),' +
    'heads: [...document.querySelectorAll(".op-chart-card .card-head")].map(h => h.offsetHeight),' +
    'titles: [...document.querySelectorAll(".op-chart-card .card-title")].map(h => [h.offsetHeight, h.offsetWidth]),' +
    'subs: [...document.querySelectorAll(".op-chart-card .card-sub")].map(h => [h.offsetHeight, h.offsetWidth]),' +
    'legends: [...document.querySelectorAll(".op-chart-card .legend")].map(h => [h.offsetHeight, h.offsetWidth]),' +
    'docH: document.documentElement.scrollHeight' +
    '})';
  const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
  console.log(res.result.value);
  ws.close();
  try { await fetch('http://127.0.0.1:' + PORT + '/json/close/' + t.id); } catch (e) { }
  process.exit(0);
})().catch(e => { console.error('FAIL ' + e.message); process.exit(1); });
