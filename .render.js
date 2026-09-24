/* 无头渲染校验工具（开发用，不随页面发布）
   用法：node .render.js <url> <输出文件> [--wait 毫秒]
   通过 CDP 连接已开启 --remote-debugging-port 的 headless Chrome，
   规避「Chrome 已运行会话接管导致 --dump-dom 无输出」的问题，并捕获 JS 异常。 */
const fs = require('fs');
const url = process.argv[2];
const outFile = process.argv[3];
const waitMs = Number((process.argv.indexOf('--wait') >= 0 ? process.argv[process.argv.indexOf('--wait') + 1] : 0)) || 2200;
const PORT = 9333;

(async () => {
  const r = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  const target = await r.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const errors = [];
  const send = (method, params = {}) => new Promise(res => {
    const i = ++id; pending.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params }));
  });

  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result || {}); pending.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      errors.push('EXCEPTION: ' + ((d.exception && d.exception.description) || d.text || ''));
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      errors.push('CONSOLE: ' + m.params.args.map(a => a.value || a.description || '').join(' '));
    }
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
      errors.push('LOG: ' + m.params.entry.text);
    }
  };

  await new Promise(res => { ws.onopen = res; });
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');
  await send('Page.navigate', { url });
  await new Promise(r => setTimeout(r, waitMs));

  const res = await send('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
  const html = (res.result && res.result.value) || '';
  fs.writeFileSync(outFile, html, 'utf8');
  console.log('BYTES=' + html.length);
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO_ERRORS');

  ws.close();
  try { await fetch(`http://127.0.0.1:${PORT}/json/close/${target.id}`); } catch (e) { }
  process.exit(0);
})().catch(e => { console.error('RENDER_FAIL: ' + e.message); process.exit(1); });
