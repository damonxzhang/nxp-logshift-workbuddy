/* OP 配置页专项校验（开发用）：PKG Type 维护的逐品类报警阈值 + ④ 页签
   node .opcfg-test.js */
const fs = require('fs');
const PORT = 9333;
const url = 'file:///' + process.cwd().replace(/\\/g, '/') + '/op-config.html';

(async () => {
  const r = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  const t = await r.json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  let id = 0; const pending = new Map(); const errors = [];
  const send = (m, p = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result || {}); pending.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errors.push((m.params.exceptionDetails.exception || {}).description || m.params.exceptionDetails.text);
  };
  await new Promise(res => { ws.onopen = res; });
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 980, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });
  await new Promise(r2 => setTimeout(r2, 2600));

  const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result.value;

  console.log('表头: ' + await ev(`[...document.querySelectorAll('#tblTypes thead th')].map(x=>x.innerText.trim().replace(/\\n/g,'/')).join(' | ')`));
  console.log('行1状态: ' + await ev(`document.querySelector('#tblTypes tbody tr[data-i="0"] [data-role="alarm"]').innerText.trim().replace(/\\n/g,' ')`));
  console.log('阈值列数: ' + await ev(`document.querySelectorAll('#tblTypes tbody tr[data-i="0"] [data-k="yellowK"],#tblTypes tbody tr[data-i="0"] [data-k="redK"]').length`));
  console.log('是否还有色标列: ' + await ev(`/色标/.test(document.querySelector('#tblTypes thead').innerText)`));

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('shot-opcfg-types.png', Buffer.from(shot.data, 'base64'));

  /* 就地改阈值 → 看本周状态是否实时重算（把 BGA/LGA 红灯阈值改成 2000，必然全天红灯） */
  await ev(`(()=>{const tr=document.querySelector('#tblTypes tbody tr[data-i="0"]');const el=tr.querySelector('[data-k="redK"]');el.value=2000;el.dispatchEvent(new Event('input',{bubbles:true}));return 1})()`);
  console.log('改 redK=2000 后状态: ' + await ev(`document.querySelector('#tblTypes tbody tr[data-i="0"] [data-role="alarm"]').innerText.trim().replace(/\\n/g,' ')`));
  /* 非法：红 ≤ 黄 → 应出现红色提示 */
  await ev(`(()=>{const tr=document.querySelector('#tblTypes tbody tr[data-i="0"]');const el=tr.querySelector('[data-k="redK"]');el.value=0.5;el.dispatchEvent(new Event('input',{bubbles:true}));return 1})()`);
  console.log('红(0.5)≤黄(1) 校验: ' + await ev(`document.querySelector('#tblTypes tbody tr[data-i="0"] [data-role="alarm"]').innerText.trim().replace(/\\n/g,' ')`));
  console.log('输入框错误样式: ' + await ev(`document.querySelector('#tblTypes tbody tr[data-i="0"] [data-k="redK"]').className`));
  const shot2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('shot-opcfg-bad.png', Buffer.from(shot2.data, 'base64'));

  /* 刷新页面确认非法值不会被写入（未点保存） */
  console.log('------- ④ 页签 -------');
  await send('Page.navigate', { url });
  await new Promise(r2 => setTimeout(r2, 2000));
  await ev(`[...document.querySelectorAll('#segTab button')].find(b=>b.dataset.t==='alarm').click()`);
  await new Promise(r2 => setTimeout(r2, 800));
  console.log('④页签标题: ' + await ev(`document.querySelector('#tabBody .card-title').innerText.trim().replace(/\\n/g,' ')`));
  console.log('④是否还有黄灯阈值输入: ' + await ev(`!!document.getElementById('cfgYellow')`));
  console.log('④阈值预览表: ' + await ev(`[...document.querySelectorAll('#tabBody table tbody tr')].map(tr=>tr.innerText.trim().replace(/\\t|\\n/g,' / ')).join(' || ')`));
  const shot3 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('shot-opcfg-alarm.png', Buffer.from(shot3.data, 'base64'));

  console.log(errors.length ? 'JS_ERROR:\n' + errors.join('\n') : 'NO_JS_ERROR');
  ws.close();
  try { await fetch(`http://127.0.0.1:${PORT}/json/close/${t.id}`); } catch (e) { }
  process.exit(0);
})().catch(e => { console.error('FAIL: ' + e.message); process.exit(1); });
