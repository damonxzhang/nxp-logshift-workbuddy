/* 全站无头校验（开发用，不随页面发布）：逐页渲染并汇总 JS 异常
   用法：node .checkall.js [目录]  —— 默认当前目录，校验所有 *.html */
const fs = require('fs');
const path = require('path');
const PORT = 9333;
const dir = process.argv[2] || '.';
const base = 'file:///' + path.resolve(dir).replace(/\\/g, '/');
const SKIP = ['功能清单与待确认项.html', '需求对齐清单-0924.html'];
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html') && !SKIP.includes(f)).sort();

(async () => {
  let bad = 0;
  for (const f of files) {
    const url = base + '/' + encodeURIComponent(f);
    const r = await fetch('http://127.0.0.1:' + PORT + '/json/new?' + encodeURIComponent(url), { method: 'PUT' });
    const t = await r.json();
    const ws = new WebSocket(t.webSocketDebuggerUrl);
    let id = 0; const pending = new Map(); const errors = [];
    const send = (m, p = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result || {}); pending.delete(m.id); }
      if (m.method === 'Runtime.exceptionThrown') { const d = m.params.exceptionDetails; errors.push('EXCEPTION: ' + ((d.exception && d.exception.description) || d.text || '')); }
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') { errors.push('CONSOLE: ' + m.params.args.map(a => a.value || a.description || '').join(' ')); }
      if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') { errors.push('LOG: ' + m.params.entry.text); }
    };
    await new Promise(res => { ws.onopen = res; });
    await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
    await send('Page.navigate', { url });
    await new Promise(r2 => setTimeout(r2, 2200));
    const res = await send('Runtime.evaluate', { expression: 'document.querySelectorAll("#content *").length', returnByValue: true });
    const nodes = (res.result && res.result.value) || 0;
    if (errors.length || nodes < 20) bad++;
    console.log((errors.length || nodes < 20 ? 'FAIL ' : 'OK   ') + f + '  nodes=' + nodes + (errors.length ? '\n     ' + errors.join('\n     ') : ''));
    ws.close();
    try { await fetch('http://127.0.0.1:' + PORT + '/json/close/' + t.id); } catch (e) { }
  }
  console.log(bad ? 'TOTAL_FAIL=' + bad : 'ALL_PAGES_OK');
  process.exit(0);
})().catch(e => { console.error('CHECK_FAIL: ' + e.message); process.exit(1); });
