/* OP 浮窗点击 → 周维度累计表 无头校验（开发用）
   node .tipcta-test.js → 校验浮窗 CTA 渲染 / 点击跳转 / op-table 定位列高亮 / 筛选后清除 */
const fs = require('fs');
const PORT = 9333;
const root = 'file:///' + process.cwd().replace(/\\/g, '/') + '/';
const results = [];
const ok = (name, pass, extra) => { results.push([pass ? 'PASS' : 'FAIL', name, extra == null ? '' : String(extra)]); };

(async () => {
  const r = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(root + 'output.html')}`, { method: 'PUT' });
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
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
  const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result.value;
  const shot = async (file, y) => {
    if (y != null) { await ev(`window.scrollTo(0,${y})`); await new Promise(x => setTimeout(x, 300)); }
    const s = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(file, Buffer.from(s.data, 'base64'));
  };

  await send('Page.navigate', { url: root + 'output.html' });
  await new Promise(x => setTimeout(x, 2600));
  await ev(`localStorage.clear()`);
  await send('Page.navigate', { url: root + 'output.html' });
  await new Promise(x => setTimeout(x, 3000));

  /* ---- 1. 悬停第一张图（goal-LEAD）→ 浮窗出现且含 CTA ---- */
  const wrap = await ev(`(()=>{const el=document.querySelector('#pc_goal-LEAD');const r=el.getBoundingClientRect();
    const svg=el.querySelector('svg');
    svg.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,clientX:r.x+r.width*0.55,clientY:r.y+r.height*0.5}));
    return el.getBoundingClientRect().width})()`);
  await new Promise(x => setTimeout(x, 300));
  const tipVisible = await ev(`(()=>{const t=document.querySelector('#pc_goal-LEAD .lc-tip');return t&&t.style.display!=='none'})()`);
  ok('悬停后浮窗可见', tipVisible === true, 'tip=' + tipVisible);
  const ctaText = await ev(`(document.querySelector('#pc_goal-LEAD .lc-tcta')||{textContent:''}).textContent`);
  ok('浮窗底部渲染「查看周维度累计表」CTA', /查看「周维度累计表」/.test(ctaText), ctaText);
  const tipCls = await ev(`(document.querySelector('#pc_goal-LEAD .lc-tip')||{className:''}).className`);
  ok('浮窗启用 pointer-events（lc-tip-click）', /lc-tip-click/.test(tipCls), tipCls);
  const tipPE = await ev(`getComputedStyle(document.querySelector('#pc_goal-LEAD .lc-tip')).pointerEvents`);
  ok('computed pointer-events = auto', tipPE === 'auto', tipPE);
  await shot('shot-tip-cta.png', 300);

  /* ---- 2. 点击 CTA → 自动跳转 op-table.html，且写入定位日 ---- */
  await ev(`(()=>{const el=document.querySelector('#pc_goal-LEAD');
    const r=el.getBoundingClientRect();
    /* 重新悬停以固定 hoverIdx 到「周日」= 下标 1 */
    el.querySelector('svg').dispatchEvent(new MouseEvent('mousemove',{bubbles:true,clientX:r.x+r.width*0.30,clientY:r.y+r.height*0.5}));
    const t=el.querySelector('.lc-tcta'); t.click(); return 1})()`);
  await new Promise(x => setTimeout(x, 1400));
  const page1 = await ev(`location.pathname.split('/').pop()`);
  ok('点击 CTA 自动跳转到 op-table.html', page1 === 'op-table.html', 'page=' + page1);

  /* 直接在自动跳转后的页面断言定位（op_table_focus 已被本次加载一次性消费） */
  const chip = await ev(`(document.getElementById('chipFocusDay')||{textContent:''}).textContent`);
  ok('累计表出现「已定位到大屏所选日期」chip', /已定位到大屏所选日期/.test(chip), chip);
  const focusN = await ev(`document.querySelectorAll('table.wk .is-focus').length`);
  ok('表格定位列高亮（is-focus 单元格 > 0）', focusN > 0, 'n=' + focusN);
  const focusCols = await ev(`[...document.querySelectorAll('table.wk thead th.is-focus')].map(t=>t.textContent.trim())`);
  ok('表头定位列 = 单列', focusCols.length === 1, JSON.stringify(focusCols));
  const focusGone = await ev(`localStorage.getItem('ohd_op_table_focus')`);
  ok('定位日为一次性消费（进入即清除）', focusGone == null || focusGone === 'null', 'v=' + focusGone);
  await shot('shot-table-focus.png', 420);

  /* ---- 3. 本页切换筛选 → 定位清除 ---- */
  await ev(`(()=>{const b=[...document.querySelectorAll('#segFilter button')].find(x=>x.dataset.f!=='__all__');b.click();return 1})()`);
  await new Promise(x => setTimeout(x, 700));
  const chipAfter = await ev(`!!document.getElementById('chipFocusDay')`);
  const focusAfter = await ev(`document.querySelectorAll('table.wk .is-focus').length`);
  ok('切换筛选后定位清除（chip 消失 + 无 is-focus）', chipAfter === false && focusAfter === 0, `chip=${chipAfter} n=${focusAfter}`);

  /* ---- 4. 回大屏再走一遍全链路（直接导航到 op-table 无定位 → 不应出现 chip） ---- */
  await send('Page.navigate', { url: root + 'op-table.html' });
  await new Promise(x => setTimeout(x, 2600));
  const noChip = await ev(`!!document.getElementById('chipFocusDay')`);
  const tableOk = await ev(`!!document.querySelector('table.wk')`);
  ok('直接打开累计表（无定位）正常渲染且无定位 chip', tableOk === true && noChip === false, `table=${tableOk} chip=${noChip}`);

  ok('无 JS 异常 / console.error', errors.length === 0, errors.join(' | ').slice(0, 300));

  const pass = results.filter(x => x[0] === 'PASS').length;
  console.log('\n================ OP 浮窗 CTA 校验 ================');
  results.forEach(([s, n, e]) => console.log(`${s === 'PASS' ? '✔' : '✘'} ${s}  ${n}${e ? '  → ' + e : ''}`));
  console.log(`\n合计 ${pass}/${results.length} PASS`);
  ws.close();
})().catch(e => { console.error('测试脚本异常：', e); process.exit(1); });
