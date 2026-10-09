/* 次品管理二级机台树状图 · 设备角标（报修 / 换模 近 24h）回归
   覆盖：
     A) device-events.js 纯逻辑：计数范围、时间戳落在近 24h、同日确定性
     B) 二级机台树：每机台 2 个角标（报修 / 换模）、计数与 DeviceEvents 一致
     C) 悬停浮窗：显示具体时间（HH:MM）+ 原因/模具号；角标点击 stopPropagation 不误下钻
     D) 三级机台透视：stat-strip 含近 24h 报修 / 换模 且 title 含时间
   运行：NODE_PATH 指向 jsdom，node 用内置版本（见 README「九、开发校验」） */
const path = require('path');
const fs = require('fs');
const { JSDOM } = require('jsdom');

let pass = 0, fail = 0;
const ok = (c, m, extra) => { c ? (pass++, console.log('PASS ' + m)) : (fail++, console.log('FAIL ' + m + (extra ? '  << ' + extra : ''))); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

function mkMem(init) {
  const m = new Map(Object.entries(init || {}));
  return { map: m, api: {
    getItem: k => (m.has(String(k)) ? m.get(String(k)) : null),
    setItem: (k, v) => m.set(String(k), String(v)),
    removeItem: k => m.delete(String(k)), clear: () => m.clear(),
    key: i => Array.from(m.keys())[i] || null, get length() { return m.size; }
  } };
}

/* ---------------- A) device-events 纯逻辑 ---------------- */
function engineTests() {
  const ctx = { console, Math, JSON, Number, Date, String, Object, Array, parseInt, parseFloat, Boolean, RegExp, Error };
  const vm = require('vm');
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('assets/js/device-events.js', 'utf8'), ctx, { filename: 'device-events.js' });
  const DE = ctx.window.DeviceEvents;
  ok(!!DE && typeof DE.of === 'function', 'DeviceEvents.of 可用');

  const now = Date.now();
  const dev = 'BMD-22';
  const e1 = DE.of(dev, now);
  ok(e1.nRep >= 0 && e1.nRep <= 4, '报修计数 ∈ [0,4]（' + e1.nRep + '）');
  ok(e1.nMold >= 0 && e1.nMold <= 3, '换模计数 ∈ [0,3]（' + e1.nMold + '）');
  const within = arr => arr.every(x => x.t <= now && x.t >= now - 24 * 3600 * 1000);
  ok(within(e1.repair) && within(e1.mold), '所有事件时间戳落在近 24h 内');
  ok(e1.repair.every(x => /^[RM]\d{4}$/.test(x.id) && (x.reason || x.from)), '报修含工单号+原因 / 换模含工单号+模具号');
  ok(e1.mold.every(x => x.from && x.to && x.from !== x.to), '换模 from/to 不同');
  // 同日确定性：换一天种子前、用同一 now 复算应一致
  const e2 = DE.of(dev, now);
  ok(e2.nRep === e1.nRep && e2.nMold === e1.nMold, '同日复算计数确定（' + e1.nRep + '/' + e1.nMold + '）');
  // 不同机台分布不同（抽样多个机台，至少出现一次有报修、一次有换模）
  const all = DE.MACHINES.map(d => DE.of(d, now));
  ok(all.some(x => x.nRep > 0) && all.some(x => x.nMold > 0), '各机台抽样中报修/换模均非空出现');
  // 缺省 now
  const e3 = DE.of('BMD-09');
  ok(typeof e3.nRep === 'number' && e3.repair.length === e3.nRep, '省略 now 仍可生成（长度与计数一致）');
}

/* ---------------- B/C/D) 页面（jsdom） ---------------- */
async function pageTests() {
  const mem = mkMem();
  const vc = new (require('jsdom').VirtualConsole)();
  const errs = [];
  vc.on('jsdomError', e => errs.push(e.message));
  const dom = await JSDOM.fromFile(path.resolve('defect.html'), {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(window) {
      Object.defineProperty(window, 'localStorage', { value: mem.api, configurable: true });
      window.HTMLElement.prototype.getBoundingClientRect = function () { return { left: 0, top: 0, right: 960, bottom: 440, width: 960, height: 440, x: 0, y: 0 }; };
    }
  });
  await sleep(1400);
  const doc = dom.window.document;
  const win = dom.window;
  ok(errs.length === 0, '缺陷页加载无 JS 异常', errs.join(' | '));
  ok(!!win.DeviceEvents, 'device-events.js 已注入 window.DeviceEvents');

  // 进入二级：点击第一个有设备的 .dser 类别
  const dser = Array.from(doc.querySelectorAll('#procChart .dser'));
  ok(dser.length > 0, '一级趋势图存在可点击类别（' + dser.length + '）');
  let entered = false;
  for (const g of dser) {
    g.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
    await sleep(500);
    const nodes = doc.querySelectorAll('#devChart .dnode');
    if (nodes.length > 0) { entered = true; break; }
  }
  ok(entered, '点击类别后进入二级机台树（#devChart 含机台节点）');
  const nodes = Array.from(doc.querySelectorAll('#devChart .dnode'));
  ok(nodes.length > 0, '二级机台节点数 > 0（' + nodes.length + '）');

  const badges = Array.from(doc.querySelectorAll('#devChart .dev-badge'));
  ok(badges.length === nodes.length * 2, '每机台恰好 2 个角标（' + badges.length + ' = ' + nodes.length + '×2）');
  const repB = badges.filter(b => b.dataset.type === 'repair');
  const molB = badges.filter(b => b.dataset.type === 'mold');
  ok(repB.length === nodes.length && molB.length === nodes.length, '报修 / 换模 角标各一（' + repB.length + '/' + molB.length + '）');

  // 计数与 DeviceEvents 一致
  let cntOk = true, badTxt = '';
  nodes.forEach(nd => {
    const dev = nd.dataset.d;
    const ev = win.DeviceEvents.of(dev, Date.now());
    const rb = nd.querySelector('.dev-badge[data-type="repair"]');
    const mb = nd.querySelector('.dev-badge[data-type="mold"]');
    const rn = +(rb.textContent.match(/报修\s*(\d+)/) || [])[1];
    const mn = +(mb.textContent.match(/换模\s*(\d+)/) || [])[1];
    if (rn !== ev.nRep || mn !== ev.nMold) { cntOk = false; badTxt = `${dev}: 角标 ${rn}/${mn} vs 源 ${ev.nRep}/${ev.nMold}`; }
  });
  ok(cntOk, '角标计数与 DeviceEvents 源一致', badTxt);

  // 悬停浮窗：显示具体时间 + 原因/模具
  const rb0 = repB[0];
  rb0.dispatchEvent(new win.MouseEvent('mouseover', { bubbles: true }));
  await sleep(120);
  const tip = doc.getElementById('defectDevTip');
  ok(!!tip && tip.style.display === 'block', '角标悬停浮窗显示');
  ok(/近 24h 设备报修/.test(tip.textContent), '浮窗标题为「近 24h 设备报修」');
  ok(/\d{2}:\d{2}/.test(tip.textContent), '浮窗含具体时间（HH:MM）');
  const dev0 = rb0.dataset.d;
  const ev0 = win.DeviceEvents.of(dev0, Date.now());
  if (ev0.nRep > 0) ok(/工单|R\d{4}/.test(tip.textContent) && /原因|·/.test(tip.textContent), '浮窗列报修工单与故障原因');
  else ok(/无记录/.test(tip.textContent), '报修为空时浮窗显示「无记录」');
  rb0.dispatchEvent(new win.MouseEvent('mouseout', { bubbles: true }));
  await sleep(60);
  ok(doc.getElementById('defectDevTip').style.display === 'none', '移出后浮窗隐藏');

  // 换模角标悬停
  const mb0 = molB[0];
  mb0.dispatchEvent(new win.MouseEvent('mouseover', { bubbles: true }));
  await sleep(120);
  ok(/近 24h 模具更换/.test(doc.getElementById('defectDevTip').textContent), '换模浮窗标题为「近 24h 模具更换」');

  // 角标点击 stopPropagation：不应误下钻进三级
  mb0.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await sleep(300);
  ok(!!doc.getElementById('devChart'), '点击角标后仍在二级（#devChart 仍在，未误下钻）');

  // 进入三级某机台，校验 stat-strip 角标
  nodes[0].dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  await sleep(400);
  const stillL2 = !!doc.getElementById('devChart');
  if (!stillL2) {
    const strip = doc.querySelector('.stat-strip');
    ok(!!strip && /近 24h 报修/.test(strip.textContent) && /近 24h 换模/.test(strip.textContent), '三级 stat-strip 含近 24h 报修 / 换模');
    const sis = Array.from(doc.querySelectorAll('.stat-strip .si'));
    const repSi = sis.find(s => /近 24h 报修/.test(s.textContent));
    const molSi = sis.find(s => /近 24h 换模/.test(s.textContent));
    ok(!!repSi && !!repSi.getAttribute('title') && /\d{2}:\d{2}/.test(repSi.getAttribute('title')), '三级 报修 项 title 含具体时间');
    ok(!!molSi && !!molSi.getAttribute('title') && /→/.test(molSi.getAttribute('title')), '三级 换模 项 title 含模具号（from→to）');
  } else {
    ok(false, '预期进入三级但未进入（点击机台节点失败）');
  }
  ok(errs.length === 0, '缺陷页全流程无 JS 异常', errs.join(' | '));
}

(async () => {
  engineTests();
  await pageTests();
  console.log('\n==== devbadge: ' + pass + ' PASS / ' + fail + ' FAIL ====');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
