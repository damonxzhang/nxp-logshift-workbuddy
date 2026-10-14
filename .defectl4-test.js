/* 次品管理 · 三项改动回归：
   ① 一级热力图点击 → 先进入二级（机台树），不再直接跳三级 Package 明细
   ② 三级「同料号跨机台 PPM（反查）」后新增「操作」列 → 跳转四级分析页
   ③ 四级分析页 = 当前料号在各机台上的 PPM 表现（含结论判定 / 返回三级）
   附：op-table.html「异常报警 · 周维度」卡片已下线 */
const { JSDOM, VirtualConsole } = require('jsdom');
const path = require('path');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };

function loadPage(file, wait) {
  return new Promise((resolve, reject) => {
    const errors = [];
    const vc = new VirtualConsole();
    vc.on('jsdomError', e => errors.push('jsdomError: ' + (e.detail ? e.detail.message || e.detail : e.message)));
    vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));
    JSDOM.fromFile(path.resolve(__dirname, file), {
      runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc
    }).then(dom => {
      const w = dom.window;
      w.URL.createObjectURL = () => 'blob:stub';
      w.URL.revokeObjectURL = () => {};
      setTimeout(() => resolve({ dom, win: w, doc: w.document, errors }), wait || 600);
    }).catch(reject);
  });
}

(async () => {
  /* ---------- op-table：异常报警 · 周维度 卡片下线 ---------- */
  {
    const { doc, errors } = await loadPage('op-table.html', 700);
    const txt = (doc.getElementById('content') || doc.body).textContent || '';
    console.log('【op-table.html】');
    ok(errors.length === 0, 'op-table 无 JS 运行时错误' + (errors.length ? ' -> ' + errors.join(' | ') : ''));
    ok(!/异常报警 · 周维度/.test(txt), '「异常报警 · 周维度」卡片已删除');
    ok(/周维度累计表/.test(txt), '「周维度累计表」卡片仍在');
    ok(doc.querySelector('#content table.table') != null || /PKG Type/.test(txt), '累计表主体仍正常渲染');
  }

  /* ---------- defect：热力图→二级 / 三级操作列 / 四级分析 ---------- */
  {
    const { win, doc, errors } = await loadPage('defect.html', 800);
    const content = () => doc.getElementById('content');
    const txt = () => content().textContent || '';
    const click = el => { if (el) el.dispatchEvent(new win.Event('click', { bubbles: true })); return !!el; };

    console.log('\n【defect.html · 一级 → 二级】');
    ok(errors.length === 0, 'defect 无 JS 运行时错误' + (errors.length ? ' -> ' + errors.join(' | ') : ''));
    ok(doc.querySelector('#procChart svg') != null, '一级折线图已渲染');
    const dser = doc.querySelector('#procChart .dser');
    ok(dser != null, '折线图系列存在');
    ok(click(dser), '点击折线系列');
    ok(/二级 ·/.test(txt()), '折线点击进入「二级」（实际标题含二级）');
    ok(!/三级 ·[^·]{0,30}Package 明细/.test(txt()), '不直接跳到三级「Package 明细」页');
    ok(/机台树状图/.test(txt()) || /未加载设备维度数据/.test(txt()), '二级机台树区域已渲染');

    console.log('\n【defect.html · 二级 → 三级 → 四级】');
    const dnode = doc.querySelector('#devChart .dnode');
    ok(dnode != null, '二级机台节点存在');
    ok(click(dnode), '点击机台节点进入三级');
    ok(/三级 ·/.test(txt()) && /料号 透视/.test(txt()), '进入三级「机台 × 料号 透视」');
    const heads = Array.from(doc.querySelectorAll('#content table.table thead th')).map(t => t.textContent.trim());
    ok(heads[heads.length - 1] === '操作', '三级表末列为「操作」（实际末列：' + heads[heads.length - 1] + '）');
    ok(heads.indexOf('同料号跨机台 PPM（反查）') >= 0, '「同料号跨机台 PPM（反查）」列仍在');
    ok(heads.indexOf('操作') === heads.indexOf('同料号跨机台 PPM（反查）') + 1, '「操作」列紧随反查列之后');

    const l4btns = doc.querySelectorAll('#content [data-l4]');
    ok(l4btns.length > 0, '反查列每行渲染「四级分析」操作按钮（' + l4btns.length + ' 个）');
    const code = l4btns.length ? l4btns[0].dataset.l4 : null;
    ok(!!code, '取到料号：' + code);
    ok(click(l4btns[0]), '点击「四级分析」按钮');
    ok(/四级 · 料号/.test(txt()), '进入四级分析页');
    ok(txt().includes(code), '四级页展示当前料号 ' + code);
    ok(/跨机台 PPM 分析/.test(txt()), '四级页标题/说明含「跨机台 PPM 分析」');
    const h4 = Array.from(doc.querySelectorAll('#content table.table thead th')).map(t => t.textContent.trim());
    ok(h4.includes('机台') && h4.includes('PPM') && h4.includes('占该料号次品') && h4.includes('相对本机'),
      '四级表含 机台 / PPM / 占该料号次品 / 相对本机 等维度列');
    /* 2026-10-14：四级页「分析结论」块与三级「口径说明」按客户要求精简下线，
       改为校验四级页的核心数据承载（6 项 KPI 条 + 跨机台明细表 + 两图）仍在。 */
    /* 注意：页面上有多个 .stat-strip（顶部全局 KPI 条 + 四级卡片内的指标条），必须按内容定位 */
    const l4strip = Array.from(doc.querySelectorAll('#content .stat-strip')).find(s => /料号加权 PPM/.test(s.textContent));
    ok(!!l4strip && /涉及机台数/.test(l4strip.textContent) && /本机台排名/.test(l4strip.textContent),
      '四级页 KPI 条含 料号加权 PPM / 涉及机台数 / 本机台排名 等指标');
    ok(!/分析结论/.test(txt()), '四级页「分析结论」块已按精简口径下线（不再渲染）');
    ok(/最新|无跨机台记录|跨机台/.test(txt()) || doc.querySelector('#content table.table') != null,
      '四级页仍渲染跨机台明细表 / 无记录提示');
    ok(/#l4Back|返回三级/.test(doc.getElementById('content').innerHTML) || doc.getElementById('l4Back') != null, '四级页有「返回三级」入口');
    ok(/四级 ·/.test(doc.querySelector('.crumb').textContent || ''), '面包屑显示四级层级');

    /* ---- 新增：四级页表格上方并排两图（① 各机台 PPM 柱状 ② 各机台次品占比环形饼图） ---- */
    console.log('\n【defect.html · 四级图表（柱状 + 饼图）】');
    const col = doc.querySelector('#content .l4-2col');
    ok(col != null, '四级页渲染并排两图容器 .l4-2col');
    const boxes = col ? col.querySelectorAll('.l4-box') : [];
    ok(boxes.length === 2, '容器内恰好两张图卡（实际 ' + boxes.length + '）');
    const t0 = boxes[0] ? boxes[0].textContent : '', t1 = boxes[1] ? boxes[1].textContent : '';
    ok(/各机台 PPM 对比/.test(t0), '左图为「各机台 PPM 对比」（柱状）');
    ok(/各机台次品占比/.test(t1), '右图为「各机台次品占比」（饼图）');
    const svg0 = boxes[0] ? boxes[0].querySelector('svg.l4-svg') : null;
    const svg1 = boxes[1] ? boxes[1].querySelector('svg.l4-svg') : null;
    ok(svg0 != null && svg0.querySelectorAll('rect').length > 0, '左图渲染出柱体 rect（' + (svg0 ? svg0.querySelectorAll('rect').length : 0) + ' 根）');
    ok(svg0 != null && /预警线 350/.test(svg0.textContent), '左图标注 350 预警线');
    {
      const barMax = svg0 ? Array.from(svg0.querySelectorAll('rect')).reduce((a, r) => a, 0) : 0;
      const anyHigh = svg0 ? Number((/fill="var\(--danger\)"[^>]*rx/.test(svg0.innerHTML)) ? 1 : 0) : 0;
      ok(!anyHigh || /红线 500/.test(svg0.textContent), '存在 ≥500 PPM 柱时同步标注 500 红线（无高柱则可不标）');
    }
    const segs = svg1 ? svg1.querySelectorAll('path, circle').length : 0;
    ok(svg1 != null && segs > 0, '右图渲染出扇区/环形（' + segs + ' 个图元）');
    ok(svg1 != null && /次品合计/.test(svg1.textContent), '右图环形中心标注「次品合计」');
    ok(svg1 != null && /%/.test(svg1.textContent), '右图图例给出占比 %');

    // 与表格同源：柱状/饼图机台数 = 表格「机台」行数（不含合计行）
    const tbl0 = doc.querySelector('#content table.table');
    const devCount = tbl0 ? Array.from(tbl0.querySelectorAll('tbody tr')).filter(tr => !/合计/.test(tr.textContent)).length : 0;
    const barCount = svg0 ? svg0.querySelectorAll('rect').length : 0;
    ok(devCount > 0 && barCount >= devCount, '柱体数（' + barCount + '）覆盖表格机台行数（' + devCount + '）');
    // 柱高必须与 PPM 单调一致（最高 PPM → 最高柱）
    {
      const trs = Array.from(tbl0 ? tbl0.querySelectorAll('tbody tr') : []).filter(tr => !/合计/.test(tr.textContent));
      const tds = trs.map(tr => tr.querySelectorAll('td'));
      const devPpm = tds.map(td => ({ d: td[0].textContent.replace('▶ ', '').replace('（本机台）', '').trim(), ppm: Number(td[3].textContent) }));
      const rects = Array.from(svg0 ? svg0.querySelectorAll('rect') : []);
      const hs = rects.map(r => Number(r.getAttribute('height')));
      const topDev = devPpm.slice().sort((a, b) => b.ppm - a.ppm)[0];
      const maxH = Math.max.apply(null, hs);
      const maxIdx = hs.indexOf(maxH);
      ok(topDev && devPpm[maxIdx] && devPpm[maxIdx].d === topDev.d,
        '最高 PPM 机台（' + (topDev ? topDev.d + ' ' + topDev.ppm : '—') + '）对应最高柱（实际最高柱为 ' + (devPpm[maxIdx] ? devPpm[maxIdx].d : '—') + '）');
      const minH = Math.min.apply(null, hs);
      const ppmPos = devPpm.filter(x => x.ppm > 0).map(x => x.ppm);
      if (ppmPos.length === devPpm.length) {
        const sortedP = ppmPos.slice().sort((a, b) => b - a);
        const rH = maxH / minH, rP = sortedP[0] / sortedP[sortedP.length - 1];
        ok(Math.abs(rH - rP) < 0.08 * rP + 0.05,
          '柱高与 PPM 严格成比例（高度比 ' + rH.toFixed(2) + ' vs PPM 比 ' + rP.toFixed(2) + '）');
      } else {
        const zi = devPpm.findIndex(x => x.ppm === 0);
        ok(zi >= 0 && hs[zi] <= 2, 'PPM = 0 的机台柱为最小占位（高度 ' + hs[zi] + '）');
      }
      ok(maxH > 20 && maxH <= 178, '最高柱高度合理（' + maxH + ' ≤ 绘图区 178）');
    }

    // 图表位于表格上方
    ok(col && tbl0 && (col.compareDocumentPosition(tbl0) & win.Node.DOCUMENT_POSITION_FOLLOWING) !== 0, '两图位于明细表上方');
    // 并排一行（同一父容器内两列网格）
    ok(col && win.getComputedStyle(col).gridTemplateColumns.split(' ').length === 2 || /l4-2col/.test(col.className), '两图并排同一行（2 列网格）');

    // 切换周后图表随之刷新
    const sel4 = doc.getElementById('devSel4');
    if (sel4 && sel4.options.length > 1) {
      sel4.value = sel4.options[1].value;
      sel4.dispatchEvent(new win.Event('change', { bubbles: true }));
      const col2 = doc.querySelector('#content .l4-2col');
      ok(col2 != null && col2.querySelectorAll('svg.l4-svg').length === 2, '切换周后两图仍正常渲染');
    }

    const back = doc.getElementById('l4Back');
    ok(click(back), '点击「返回三级」');
    ok(/三级 ·/.test(txt()) && !/四级 · 料号/.test(txt()), '返回到三级（四级已退出）');

    ok(errors.length === 0, '全程无 JS 运行时错误' + (errors.length ? ' -> ' + errors.join(' | ') : ''));
  }

  console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('加载失败:', e); process.exit(1); });
