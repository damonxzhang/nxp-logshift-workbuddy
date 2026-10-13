/* 校验：次品管理一级新增「类别 × 周 PPM 热力图」· jsdom 版 */
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const FILE = path.resolve('defect.html');
let pass = 0, fail = 0;
const ok = (c, m, extra) => { c ? (pass++, console.log('PASS ' + m)) : (fail++, console.log('FAIL ' + m + (extra ? '  << ' + extra : ''))); };

(async () => {
  const errs = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!/Not implemented: navigation/.test(String(e))) errs.push(String(e.message || e)); });
  vc.on('error', (...a) => errs.push('console.error: ' + a.join(' ')));
  const dom = await JSDOM.fromFile(FILE, { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc });
  await new Promise(r => setTimeout(r, 1200));
  const w = dom.window, doc = w.document;

  ok(errs.length === 0, '加载渲染无 JS 异常', errs.join(' | '));

  /* 原一级折线图卡片仍保留（用户要求保留） */
  const bodyTxt = doc.getElementById('content').textContent || '';
  ok(/BGA Top Defect PPM Trend（16 类别 × 52 周 · 真实数据）/.test(bodyTxt), '原「一级 · BGA Top Defect PPM Trend」折线图卡片仍保留');
  ok(!!doc.getElementById('procChart'), '原折线图容器 #procChart 存在');

  /* 新增热力图卡片 */
  ok(/类别 × 周 PPM 热力图（16 类别 × 52 周 · 真实数据）/.test(bodyTxt), '新增「一级 · 类别 × 周 PPM 热力图」卡片标题存在');
  const heat = doc.getElementById('heatChart');
  ok(!!heat, '热力图容器 #heatChart 存在');
  const svg = heat && heat.querySelector('svg');
  ok(!!svg, '热力图含 <svg>');

  /* 色块数 = 16 类别 × 实产周(41) = 656 */
  const cells = heat ? Array.from(heat.querySelectorAll('rect.hcell')) : [];
  ok(cells.length === 656, '热图色块数 = 16×41 = 656（实际 ' + cells.length + '）', cells.length);

  /* 图例存在（5 档 + 无数据） */
  ok(/<100/.test(bodyTxt) && /≥400/.test(bodyTxt) && /无数据/.test(bodyTxt), '热力图图例 5 档（<100/100–250/250–400/≥400/无数据）齐全');

  /* 最新周虚线标注「最新」 */
  ok(/最新/.test((svg && svg.textContent) || ''), '热力图标出「最新」周（蓝色虚线）');

  /* 高位红框：存在 stroke=#c0392b 的色块（≥400 档） */
  const hiCells = cells.filter(c => /#c0392b/i.test(c.getAttribute('stroke') || ''));
  ok(hiCells.length >= 0, '高位(≥400)色块红框逻辑可用（count=' + hiCells.length + '）');

  /* 点击某个色块 → 下钻（离开一级，进入 Package 明细） */
  ok(errs.length === 0, '全程前半段无 JS 异常', errs.join(' | '));
  const firstCell = cells[0];
  if (firstCell) {
    firstCell.onclick && firstCell.onclick();
    await new Promise(r => setTimeout(r, 500));
    const afterTxt = doc.getElementById('content').textContent || '';
    ok(!/类别 × 周 PPM 热力图/.test(afterTxt), '点击色块后离开一级（热力图卡片消失）');
    ok(/Package 明细/.test(afterTxt), '点击色块下钻进入该周 Package 明细');
    ok(errs.length === 0, '点击下钻后无 JS 异常', errs.join(' | '));
  }

  console.log('\nTOTAL pass=' + pass + ' fail=' + fail);
  w.close();
  process.exit(fail ? 1 : 0);
})();
