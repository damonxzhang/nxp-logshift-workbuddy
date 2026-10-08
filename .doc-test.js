/* 文档渲染校验（开发用） */
const fs = require('fs');
const PORT = 9333;
const url = 'file:///' + process.cwd().replace(/\\/g, '/') + '/图表逻辑关系说明.html';
(async () => {
  const r = await fetch('http://127.0.0.1:' + PORT + '/json/new?' + encodeURIComponent(url), { method: 'PUT' });
  const t = await r.json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  let id = 0; const pending = new Map(); const errs = []; const logs = [];
  const send = (m, p = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result || {}); pending.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      errs.push((d.exception && d.exception.description ? d.exception.description : d.text) + ' @line' + d.lineNumber);
    }
    if (m.method === 'Runtime.consoleAPICalled') logs.push(m.params.args.map(a => a.value).join(' '));
  };
  await new Promise(res => { ws.onopen = res; });
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });
  await new Promise(x => setTimeout(x, 3500));
  const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result.value;
  console.log('TITLE:', await ev('document.title'));
  console.log('BADGE:', await ev("document.getElementById('statBadge').textContent"));
  console.log('FIGS :', await ev("document.querySelectorAll('.fig').length"));
  console.log('PINS :', await ev("document.querySelectorAll('.pin').length"));
  console.log('TOC  :', await ev("document.querySelectorAll('#toc a').length"));
  console.log('SVG  :', await ev("document.querySelectorAll('#main svg').length"));
  console.log('FAIL :', await ev("[].slice.call(document.querySelectorAll('.note.danger')).filter(function(x){return x.textContent.indexOf('渲染失败')>=0}).map(function(x){return x.textContent}).join(' || ') || 'none'"));
  console.log('PATH :', await ev("(function(){var p=document.querySelector('.fig svg path');return p?String(p.getAttribute('d')).slice(0,50):'NO-PATH'})()"));
  console.log('DOTS :', await ev("document.querySelectorAll('.dotm i').length"));
  /* 动态可视化（.vz-*）已于 2026-10-08 整块下线，以下两行断言随之作废，保留仅备忘
     console.log('BUBS :', await ev("document.querySelectorAll('.vz-bub').length"));
     console.log('RINGS:', await ev("document.querySelectorAll('.vz-ring').length")); */
  console.log('HEATC:', await ev("document.querySelectorAll('.heat-cell').length"));
  console.log('RANKB:', await ev("document.querySelectorAll('.rank-bar i').length"));
  console.log('PERFIG:', await ev("[].slice.call(document.querySelectorAll('.fig')).map(function(f){return f.id+':'+f.querySelectorAll('.pin').length+'/'+f.querySelectorAll('.co').length}).join(' ')"));
  console.log('LOGS :', logs.join(' | '));
  console.log('ERRS :', errs.length ? errs.join('\n---\n').slice(0, 2500) : 'NO_JS_ERROR');
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  fs.writeFileSync('shot-doc-full.png', Buffer.from(shot.data, 'base64'));
  console.log('SHOT=shot-doc-full.png');
  ws.close();
  try { await fetch('http://127.0.0.1:' + PORT + '/json/close/' + t.id); } catch (e) { }
  process.exit(0);
})().catch(e => { console.error('FAIL: ' + e.message); process.exit(1); });
