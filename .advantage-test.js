/* 校验：新增「我方优势」页（advantage.html）渲染无异常且关键节点齐全 · jsdom 版 */
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const FILE = path.resolve('advantage.html');
let pass = 0, fail = 0;
const ok = (c, m, extra) => { c ? (pass++, console.log('PASS ' + m)) : (fail++, console.log('FAIL ' + m + (extra ? '  << ' + extra : ''))); };

(async () => {
  const errs = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!/Not implemented: navigation/.test(String(e))) errs.push(String(e.message || e)); });
  vc.on('error', (...a) => errs.push('console.error: ' + a.join(' ')));
  const dom = await JSDOM.fromFile(FILE, { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc });
  await new Promise(r => setTimeout(r, 900));
  const w = dom.window, doc = w.document;

  ok(errs.length === 0, '渲染无 JS 异常', errs.join(' | '));

  const txt = (doc.getElementById('content') || doc.body).textContent || '';
  ok(txt.length > 200, '内容区已渲染（len=' + txt.length + '）');

  const cards = doc.querySelectorAll('.adv-card').length;
  ok(cards === 7, '七大核心优势卡齐全（cards=' + cards + '）', cards);

  const sys = doc.querySelectorAll('.adv-sys .sys').length;
  ok(sys === 3, '我方已落地系统卡为 3 个（' + sys + '）', sys);

  ok(!!doc.querySelector('.adv-hero') && /为什么用这套统一监控/.test(txt), '页导语（adv-hero）存在');
  ok(/我方优势 · 平台价值/.test((doc.getElementById('topbar') || doc.body).textContent || ''), '顶栏页标题为「我方优势 · 平台价值」');
  ok(/多源数据打通/.test(txt) && /批次全链路追溯/.test(txt) && /OTD 周期监控/.test(txt) && /我方落地经验优势/.test(txt), '7 条优势标题均在');
  ok(/异常告警 → 工单闭环联动/.test(txt) || /异常告警/.test(txt) && /处置留痕/.test(txt), '告警→工单闭环流存在');

  /* 侧边栏新增「我方优势」分组与入口 */
  const navTxt = doc.getElementById('sidebar').textContent || '';
  ok(/我方优势/.test(navTxt), '侧边栏出现「我方优势」分组');
  const link = Array.from(doc.querySelectorAll('#sidebar a')).find(a => /advantage\.html/.test(a.getAttribute('href') || ''));
  ok(!!link, '侧边栏含 advantage.html 入口');

  ok(errs.length === 0, '全程无 JS 异常', errs.join(' | '));
  console.log('\nTOTAL pass=' + pass + ' fail=' + fail);
  w.close();
  process.exit(fail ? 1 : 0);
})();
