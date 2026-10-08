/* OP 大屏 · 双部门 2×2 视图 无头校验（开发用）
   node .opdual-test.js  → 校验默认 4 图 2×2、同行共用 Y 轴、单/双切换与持久化 */
const fs = require('fs');
const PORT = 9333;
const url = 'file:///' + process.cwd().replace(/\\/g, '/') + '/output.html';

const results = [];
const ok = (name, pass, extra) => { results.push([pass ? 'PASS' : 'FAIL', name, extra == null ? '' : String(extra)]); };

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
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
  const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result.value;
  const shot = async (file, y) => {
    if (y != null) { await ev(`window.scrollTo(0,${y})`); await new Promise(x => setTimeout(x, 300)); }
    const s = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(file, Buffer.from(s.data, 'base64'));
  };

  await send('Page.navigate', { url });
  await new Promise(x => setTimeout(x, 2600));
  await ev(`localStorage.clear()`);
  await send('Page.navigate', { url });
  await new Promise(x => setTimeout(x, 3000));

  /* ---- 1. 默认 2×2 ---- */
  const cards = await ev(`document.querySelectorAll('#chartStack .op-chart-card').length`);
  ok('默认渲染 4 张图卡', cards === 4, 'cards=' + cards);

  const keys = await ev(`[...document.querySelectorAll('#chartStack .op-chart-card [id^="pc_"]')].map(e=>e.id)`);
  const want = ['pc_goal-LEAD', 'pc_goal-NON-LEAD', 'pc_earn-LEAD', 'pc_earn-NON-LEAD'];
  ok('面板 key = 口径×部门 齐全', want.every(k => keys.indexOf(k) >= 0), JSON.stringify(keys));

  const gridCls = await ev(`document.getElementById('chartStack').className`);
  ok('容器启用 g-2 双列 + op-chart-grid', /g-2/.test(gridCls) && /op-chart-grid/.test(gridCls), gridCls);

  const svgN = await ev(`[...document.querySelectorAll('#chartStack [id^="pc_"]')].map(e=>e.querySelectorAll('svg').length)`);
  ok('每个面板都画出 SVG', svgN.length === 4 && svgN.every(n => n >= 1), JSON.stringify(svgN));

  /* 2×2 几何：两行两列（行 top 分两组，列 left 分两组） */
  const geo = await ev(`[...document.querySelectorAll('#chartStack .op-chart-card')].map(c=>{const r=c.getBoundingClientRect();return [Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)]})`);
  const rows = [...new Set(geo.map(g => g[1]))].length;
  const cols = [...new Set(geo.map(g => g[0]))].length;
  ok('几何为 2 行 × 2 列', rows === 2 && cols === 2, 'rows=' + rows + ' cols=' + cols + ' geo=' + JSON.stringify(geo));
  const wSame = new Set(geo.map(g => g[2])).size === 1;
  ok('四张卡等宽', wSame, JSON.stringify(geo.map(g => g[2])));

  /* ---- 2. 同一行（同口径）共用 Y 轴上限 ---- */
  const topY = async key => ev(`(()=>{const s=document.querySelector('#${key} svg');if(!s)return null;
    const ts=[...s.querySelectorAll('text')].filter(x=>x.getAttribute('text-anchor')==='end');
    return ts.length?ts[ts.length-1].textContent:null})()`);
  const gL = await topY('pc_goal-LEAD'), gN = await topY('pc_goal-NON-LEAD');
  const eL = await topY('pc_earn-LEAD'), eN = await topY('pc_earn-NON-LEAD');
  ok('数量行两部门 Y 轴上限一致', gL != null && gL === gN, `LEAD=${gL} NON-LEAD=${gN}`);
  ok('金额行两部门 Y 轴上限一致', eL != null && eL === eN, `LEAD=${eL} NON-LEAD=${eN}`);

  /* ---- 3. 卡头信息 ---- */
  const titles = await ev(`[...document.querySelectorAll('#chartStack .op-chart-card .card-title')].map(e=>e.innerText.split('\\n')[0].trim().slice(0,40))`);
  ok('标题含部门名', titles.some(x => /LEAD/.test(x)) && titles.some(x => /NON-LEAD/.test(x)), JSON.stringify(titles));
  const overflow = await ev(`[...document.querySelectorAll('#chartStack .op-chart-card')].some(c=>c.scrollWidth>c.clientWidth+2)`);
  ok('半宽卡片无横向溢出', overflow === false, 'overflow=' + overflow);

  await shot('shot-op-dual.png', 0);

  /* ---- 4. 切换单部门 ---- */
  await ev(`[...document.querySelectorAll('#segView button')].find(b=>b.dataset.v==='single').click()`);
  await new Promise(x => setTimeout(x, 2600));
  const sCards = await ev(`document.querySelectorAll('#chartStack .op-chart-card').length`);
  const sCls = await ev(`document.getElementById('chartStack').className`);
  ok('单部门视图 = 2 张图卡', sCards === 2, 'cards=' + sCards);
  ok('单部门视图取消双列', !/g-2/.test(sCls), sCls);
  const sMode = await ev(`localStorage.getItem('ohd_op_view_mode')`);
  ok('切换写入 op_view_mode=single', sMode === '"single"' || sMode === 'single', 'v=' + sMode);
  await shot('shot-op-single.png', 0);

  /* ---- 5. 切回双部门并刷新持久化 ---- */
  await ev(`[...document.querySelectorAll('#segView button')].find(b=>b.dataset.v==='dual').click()`);
  await new Promise(x => setTimeout(x, 2400));
  await send('Page.navigate', { url });
  await new Promise(x => setTimeout(x, 3000));
  const rCards = await ev(`document.querySelectorAll('#chartStack .op-chart-card').length`);
  const rActive = await ev(`(()=>{const b=document.querySelector('#segView .active');return b?b.getAttribute('data-v'):null})()`);
  ok('刷新后仍为双部门 2×2（持久化）', rCards === 4 && rActive === 'dual', 'cards=' + rCards + ' active=' + rActive);

  /* ---- 6. 无 JS 异常 ---- */
  ok('无 JS 异常 / console.error', errors.length === 0, errors.join(' | ').slice(0, 300));

  const pass = results.filter(x => x[0] === 'PASS').length;
  console.log('\n================ OP 双部门 2×2 校验 ================');
  results.forEach(([s, n, e]) => console.log(`${s === 'PASS' ? '✔' : '✘'} ${s}  ${n}${e ? '  → ' + e : ''}`));
  console.log(`\n合计 ${pass}/${results.length} PASS`);
  ws.close();
})().catch(e => { console.error('测试脚本异常：', e); process.exit(1); });
