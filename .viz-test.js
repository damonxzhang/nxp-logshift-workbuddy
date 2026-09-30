/* WIP 动态可视化方案 · 无头校验 + 截图（开发用）
   node .viz-test.js  → 逐方案渲染并截图 shot-viz-A..E / ALL，汇总 JS 异常与关键 DOM 断言 */
const fs = require('fs');
const PORT = 9333;
const url = 'file:///' + process.cwd().replace(/\\/g, '/') + '/wip.html';
const SCHEMES = ['A', 'B', 'C', 'D', 'E', 'ALL'];

(async () => {
  const r = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  const t = await r.json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  let id = 0; const pending = new Map(); const errors = [];
  const send = (m, p = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result || {}); pending.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errors.push('EXCEPTION: ' + ((m.params.exceptionDetails.exception || {}).description || m.params.exceptionDetails.text));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('CONSOLE: ' + m.params.args.map(a => a.value || a.description || '').join(' '));
  };
  await new Promise(res => { ws.onopen = res; });
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1500, height: 1000, deviceScaleFactor: 1, mobile: false });
  const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result.value;
  const shot = async (file, y) => {
    if (y != null) { await ev(`window.scrollTo(0,${y})`); await new Promise(x => setTimeout(x, 350)); }
    const s = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(file, Buffer.from(s.data, 'base64'));
  };

  await send('Page.navigate', { url });
  await new Promise(x => setTimeout(x, 2800));
  /* 清空本地存储回到默认口径（数量 K），保证断言可复现 */
  await ev(`localStorage.clear()`);
  await send('Page.navigate', { url });
  await new Promise(x => setTimeout(x, 2800));
  console.log('方案按钮数: ' + await ev(`document.querySelectorAll('#vizSeg button').length`));
  console.log('可视化卡片存在: ' + await ev(`!!document.getElementById('vizHost')`));

  const probe = {
    A: `[document.querySelectorAll('.vz-ring').length, document.querySelectorAll('.vz-arc').length, document.querySelector('.vz-ring-center b').textContent]`,
    B: `[document.querySelectorAll('.vz-fl-rib').length, document.querySelectorAll('.vz-fl-dash').length, document.querySelectorAll('.vz-fl-node').length]`,
    C: `[document.querySelectorAll('.vz-bub').length, document.querySelectorAll('.vz-bub.al').length, document.querySelectorAll('.vz-bub.ay').length]`,
    D: `[document.querySelectorAll('.vz-dot').length, document.querySelectorAll('.vz-dot.is-bad').length, document.querySelectorAll('.vz-dot.is-hold').length]`,
    E: `[document.querySelectorAll('.vz-pbar').length, document.querySelectorAll('.vz-darc').length, document.getElementById('vzPolarNum').textContent]`,
    ALL: `[document.querySelectorAll('.vz-block').length, document.querySelectorAll('#vizHost svg').length]`
  };

  for (const s of SCHEMES) {
    const y = await ev(`(()=>{const b=[...document.querySelectorAll('#vizSeg button')].find(x=>x.dataset.v==='${s}');b.click();return 1})()`);
    await new Promise(x => setTimeout(x, 2600));
    console.log(s + ' → ' + JSON.stringify(await ev(probe[s])));
    await shot('shot-viz-' + s + '.png', s === 'A' ? 520 : 420);
  }

  /* 交互：hover 气泡 / 点击环 → 是否写入信息条 / 是否打开抽屉 */
  await ev(`[...document.querySelectorAll('#vizSeg button')].find(x=>x.dataset.v==='C').click()`);
  await new Promise(x => setTimeout(x, 2200));
  await ev(`(()=>{const b=document.querySelector('.vz-bub');const r=b.getBoundingClientRect();
    b.dispatchEvent(new MouseEvent('mouseover',{bubbles:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2}));return 1})()`);
  console.log('气泡 hover 信息条: ' + await ev(`document.getElementById('vzInfo').innerText.slice(0,90)`));

  await ev(`[...document.querySelectorAll('#vizSeg button')].find(x=>x.dataset.v==='A').click()`);
  await new Promise(x => setTimeout(x, 2200));
  await ev(`document.querySelector('.vz-ring').click()`);
  await new Promise(x => setTimeout(x, 900));
  console.log('点击环后抽屉打开: ' + await ev(`!!document.querySelector('.wip-drawer.open')`));
  console.log('抽屉标题: ' + await ev(`(document.querySelector('.wd-title')||{}).innerText||''`));

  console.log(errors.length ? 'JS_ERROR:\n' + errors.join('\n') : 'NO_JS_ERROR');
  ws.close();
  try { await fetch(`http://127.0.0.1:${PORT}/json/close/${t.id}`); } catch (e) { }
  process.exit(0);
})().catch(e => { console.error('FAIL: ' + e.message); process.exit(1); });
