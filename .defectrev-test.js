/* 校验：次品管理三级「机台 × 料号 透视」新增「同料号跨机台 PPM（反查）」列 · jsdom 版 */
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const FILE = path.resolve('defect.html');
let pass = 0, fail = 0;
const ok = (c, m, extra) => { c ? (pass++, console.log('PASS ' + m)) : (fail++, console.log('FAIL ' + m + (extra ? '  << ' + extra : ''))); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const errs = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!/Not implemented: navigation/.test(String(e))) errs.push(String(e.message || e)); });
  vc.on('error', (...a) => errs.push('console.error: ' + a.join(' ')));
  const dom = await JSDOM.fromFile(FILE, { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc });
  await sleep(1200);
  const w = dom.window, doc = w.document;

  ok(errs.length === 0, '加载渲染无 JS 异常', errs.join(' | '));

  /* 进入二级：点击一级折线某一类别系列（g.dser）→ drillCat 设置，L2 机台树渲染 */
  const dser = doc.querySelector('#procChart .dser');
  ok(!!dser, '一级折线图存在可点击系列');
  if (dser) { dser.onclick({ target: dser }); await sleep(300); }
  ok(errs.length === 0, '点击系列下钻无 JS 异常', errs.join(' | '));

  const dnode = doc.querySelector('#devChart .dnode');
  ok(!!dnode, '二级机台树渲染出机台节点（可进入三级）');
  if (dnode) { dnode.onclick(); await sleep(300); }
  ok(errs.length === 0, '点击机台节点进入三级无 JS 异常', errs.join(' | '));

  const bodyTxt = doc.getElementById('content').textContent || '';
  ok(/三级 · .* × 料号 透视/.test(bodyTxt), '已进入三级「机台 × 料号 透视」');

  const tbl = doc.querySelector('#content table');
  ok(!!tbl, '三级透视表渲染');
  const headTxt = tbl ? (tbl.querySelector('thead').textContent || '') : '';
  ok(/同料号跨机台 PPM（反查）/.test(headTxt), '透视表末列标题为「同料号跨机台 PPM（反查）」');

  const tbodyTxt = tbl ? (tbl.querySelector('tbody').textContent || '') : '';
  ok(/峰值|仅本机台|他机更高|本机最高|跨机平稳/.test(tbodyTxt), '反查列含标注（峰值/仅本机台/他机更高/本机最高/跨机平稳）');

  /* tooltip：多机台料号的反查单元格带「机台:PPM(n/out)」明细 */
  const tipSpans = tbl ? Array.from(tbl.querySelectorAll('td span[title]')) : [];
  const hasDetail = tipSpans.some(s => /PPM（\d|\d\/\d/.test(s.getAttribute('title') || ''));
  ok(hasDetail, '存在跨机台反查 tooltip（格式：机台: PPM（次品/产出））', 'found=' + tipSpans.length);
  if (tipSpans.length) {
    const sample = tipSpans.map(s => s.getAttribute('title')).find(t => /PPM（/.test(t));
    console.log('  样例 tooltip: ' + (sample || '').replace(/\n/g, ' | '));
  }

  ok(errs.length === 0, '全程无 JS 异常', errs.join(' | '));

  console.log('\nTOTAL pass=' + pass + ' fail=' + fail);
  w.close();
  process.exit(fail ? 1 : 0);
})();
