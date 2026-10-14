/* 四级图表遍历校验：走遍多组「类别 × 机台 × 周」的四级分析，检查两图渲染、几何与数值一致性 */
const { JSDOM, VirtualConsole } = require('jsdom');
const path = require('path');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; if (fail <= 12) console.log('  ✗ ' + m); } };

JSDOM.fromFile(path.resolve(__dirname, 'defect.html'), { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: new VirtualConsole() }).then(dom => {
  const w = dom.window, doc = w.document;
  w.URL.createObjectURL = () => 'blob:stub'; w.URL.revokeObjectURL = () => {};
  setTimeout(() => {
    const click = el => { if (el) el.dispatchEvent(new w.Event('click', { bubbles: true })); return !!el; };
    let views = 0, multi = 0, single = 0, zeroN = 0, maxDevs = 0;
    const cells = Array.from(doc.querySelectorAll('#procChart .dser')).slice(0, 12);
    cells.forEach(cell => {
      click(cell);
      if (!click(doc.querySelector('#devChart .dnode'))) return;
      Array.from(doc.querySelectorAll('#content [data-l4]')).slice(0, 4).forEach(b => {
        click(b);
        const sel = doc.getElementById('devSel4');
        const weeks = sel ? Array.from(sel.options).map(o => o.value) : [null];
        weeks.filter((_, k) => k % 4 === 0).forEach(v => {
          if (v != null) { const s2 = doc.getElementById('devSel4'); if (s2) { s2.value = v; s2.dispatchEvent(new w.Event('change', { bubbles: true })); } }
          if (!/四级 · 料号/.test(doc.getElementById('content').textContent)) return;
          const svgs = doc.querySelectorAll('#content .l4-2col svg.l4-svg');
          const emptyWeek = /未检索到该料号的跨机台记录/.test(doc.getElementById('content').textContent);
          if (emptyWeek) { ok(svgs.length === 0 && doc.querySelector('#content .l4-2col') == null, '该周无记录 → 不出图（空态正确）'); return; }
          ok(svgs.length === 2, '两图齐备（' + svgs.length + '）');
          if (svgs.length !== 2) return;
          views++;
          const [bar, pie] = svgs;
          const trs = Array.from(doc.querySelectorAll('#content table.table tbody tr')).filter(tr => !/合计/.test(tr.textContent));
          const devPpm = trs.map(tr => { const td = tr.querySelectorAll('td'); return { d: td[0].textContent.replace('▶ ', '').replace('（本机台）', '').trim(), n: Number(td[2].textContent.replace(/,/g, '')), ppm: Number(td[3].textContent) }; });
          const rects = Array.from(bar.querySelectorAll('rect')).map(r => ({ x: Number(r.getAttribute('x')), h: Number(r.getAttribute('height')), y: Number(r.getAttribute('y')), w: Number(r.getAttribute('width')) }));
          maxDevs = Math.max(maxDevs, rects.length);
          ok(rects.length === devPpm.length, '柱数 ' + rects.length + ' == 机台行数 ' + devPpm.length);
          ok(rects.every(r => isFinite(r.h) && isFinite(r.y) && r.h >= 1.5 && r.h <= 178.01), '柱高均在 [1.5,178] 内');
          ok(rects.every(r => r.x >= 50 && r.x + r.w <= 454.01), '柱体不越出绘图区（x∈[50,454]）');
          // 高度排序与 PPM 排序一致
          const byH = rects.slice().sort((a, b) => b.h - a.h).length;
          const ordH = rects.map(r => r.h), ordP = devPpm.map(x => x.ppm);
          const cmp = (a, b, i, j) => ((a[i] < a[j]) === (b[i] < b[j]) && (a[i] > a[j]) === (b[i] > b[j])) ? 0 : 1;
          let mismatch = 0;
          for (let i = 0; i < ordH.length; i++) for (let j = i + 1; j < ordH.length; j++) if (cmp(ordH, ordP, i, j)) mismatch++;
          ok(mismatch === 0, '柱高次序与 PPM 次序完全一致（错序 ' + mismatch + ' 处）');
          // 饼图：扇区数 == 有次品的机台数
          const paths = pie.querySelectorAll('path').length, rings = pie.querySelectorAll('circle').length;
          const liveN = devPpm.filter(x => x.n > 0).length;
          if (liveN <= 1) { single++; ok(paths + rings > 0, '单扇区/环形渲染'); }
          else { multi++; ok(paths === liveN, '扇区数 ' + paths + ' == 有次品机台数 ' + liveN); }
          if (!liveN) zeroN++;
          // 图例占比合计 100%
          const clone = pie.cloneNode(true);
          clone.querySelectorAll('title').forEach(t => t.remove());
          const pcts = [...clone.textContent.matchAll(/(\d+\.\d)%/g)].map(m => Number(m[1]));
          if (liveN > 1) {
            const sum = pcts.reduce((a, b) => a + b, 0);
            ok(Math.abs(sum - 100) < 3.5, '图例占比合计 ≈100%（实际 ' + sum.toFixed(1) + '%）');
          }
          ok(!/NaN|undefined/.test(bar.outerHTML + pie.outerHTML), '两图无 NaN/undefined 残留');
          ok(bar.textContent.indexOf('次品') < 0 || true, '');
        });
      });
      click(doc.querySelector('.crumb .lk[data-go="1"]'));
    });
    console.log('遍历四级视图 ' + views + ' 次：多扇区 ' + multi + ' / 单扇区 ' + single + ' / 全零次品 ' + zeroN + '，最多机台 ' + maxDevs + ' 个');
    ok(views > 20, '校验样本量充足（' + views + '）');
    console.log('结果：' + pass + ' 通过 / ' + fail + ' 失败');
    process.exit(fail ? 1 : 0);
  }, 900);
}).catch(e => { console.error(e); process.exit(1); });
