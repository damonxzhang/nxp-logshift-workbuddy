/* ============ 次品管理 · 质量预警（整体原型设计方案中的一个独立模块） ============
   数据来源：客户原始资料 BGA WK2601-2652 PPM Yield trend.xlsx
     - trend 矩阵：16 次品类别 × 52 周(WW40'26→WW39'26) 真实计数
     - WW40'26-M 等：每周 ICOS 结料数量汇总 = IQC Output（PPM 分母）
     - WWxx'26-M 原始明细：设备(Mold机台) × 料号(PkgCode) 产出与各缺陷代码计数 → 设备维度
     - WW40'26-abnormal 等：各周 Package 级 产出 / BE Reject / 良率
   四级钻取：一级 类别×52周 的**四种展现形式**（① 多系列折线 ② 帕累托贡献排序+累计占比80/20 ③ 小倍数趋势矩阵(独立量程) ④ 类别×周热力图，点击均下钻同一二级）→ 二级 选中类别 设备维度机台树状图(根=类别,子节点=机台,可切换周) → 三级 点机台节点进入「机台×料号」透视(参考客户 -M 透视表,含同料号跨机台反查) → 四级 末列「操作」进入该料号的跨机台 PPM 分析页 / 另可点折线数据点进入该周 Package 明细
   PPM = 次品数 ÷ IQC Output × 100 万；红线 2000 PPM(良率 0.998)，预警线 3000 PPM(CWAAY 0.997)
   本页全部为真实客户数据，无演示/伪随机。 */
(function () {
  renderShell('defect');
  const D = window.DEFECT_REAL;
  if (!D) {
    document.getElementById('content').innerHTML = '<div class="notice" style="--nc:var(--danger)">未加载真实数据文件 assets/js/defect-real-data.js</div>';
    return;
  }

  // ---------- 常量 / 状态 ----------
  const RED = 2000, WARN = 3000; // PPM：红线(良率0.998) / 预警线(CWAAY0.997)
  let latestIdx = D.output.findIndex(o => o != null);
  if (latestIdx < 0) latestIdx = 0;
  let drillCat = null, drillWeek = null, top5 = false;
  let devWeek = null; // 设备维度所选周（weeks 索引），null = 默认最新实产周；判空必须用 == null（索引 0 合法）
  let drillDev = null; // 三级：选中机台名（Mold机台），从二级树状图点进去
  let drillCode = null; // 四级：从三级「同料号跨机台 PPM（反查）」操作列点入的料号（PkgCode）
  let activeCats = D.cats.map(c => c.key); // 自定义勾选的次品项
  let deptFilter = 'ALL'; // 数据范围筛选：看全部(ALL) / 按部门(LEAD|NON-LEAD|PLATING)；正式上线时按登录账号所属部门自动锁定，演示先用按钮手动切换
  let paretoRange = store.get('defect_pareto', 'latest'); // 帕累托图时间口径：latest / w13 / w26 / all

  // 次品类别 → 部门 归属（与「次品项配置（主数据）」一致；演示默认，用户可在配置页改部门）
  const DEFECT_DEPT_MAP = {
    'MMS AL01': 'LEAD', 'MMS AL02': 'LEAD', 'MMS AL03': 'LEAD', 'MMS AL06': 'LEAD',
    'MOLD BMD2': 'LEAD', 'MOLD BMD3': 'LEAD', 'SAW SS7': 'LEAD',
    'MMS AL05': 'NON-LEAD', 'MMS AL07': 'NON-LEAD', 'MMS AL08': 'NON-LEAD', 'MMS AL09': 'NON-LEAD',
    'MMS AL11': 'NON-LEAD', 'MMS AL12': 'NON-LEAD', 'MOLD BMD9': 'NON-LEAD', 'IQC&Supplier': 'NON-LEAD',
    'ICOS BMD12': 'PLATING'
  };
  const catDeptOf = k => DEFECT_DEPT_MAP[k] || 'ALL';
  // 当前范围可见的次品类别（部门筛选后的集合）
  const visibleCats = () => (deptFilter === 'ALL' ? D.cats : D.cats.filter(c => catDeptOf(c.key) === deptFilter));
  // 范围感知的周合计 PPM（部门范围=该部门各类别合计；看全部=全厂合计，等价于 weeklyTotalPPM）
  function weeklyScopePPM(i) {
    const o = D.output[i]; if (!o) return null;
    let td = 0; visibleCats().forEach(c => { td += (D.counts[c.key][i] || 0); });
    return td / o * 1e6;
  }
  // 切换数据范围：重置勾选为该范围全部类别并刷新（一级/二级/三级联动不受影响）
  function setDeptFilter(d) { deptFilter = d; activeCats = visibleCats().map(c => c.key); render(); }

  // ---------- 计算 ----------
  const fmt = n => (n == null ? '—' : Math.round(n).toLocaleString());
  const catPPM = (k, i) => (D.ppm[k] ? D.ppm[k][i] : null);
  // 周显示标签（数组无年份后缀；WW52 为上年 '25，其余为 '26）
  const weekLabel = i => D.weeks[i] + (D.weeks[i] === 'WW52' ? "'25" : "'26");
  // 时间轴（旧→新）：数组原始序为 WW40(最新)→…→WW39(最旧) 且含 WW41–WW51 未来空周，
  // 旋转为 WW52'25→WW01'26→…→WW40'26 连续时间序，并剔除无 -M 透视的空周（PPM 为 null）
  function dispIdx() {
    const start = D.weeks.findIndex((w, i) => i > 0 && D.output[i] != null);
    const arr = [];
    for (let i = (start < 0 ? 0 : start); i < D.weeks.length; i++) if (D.output[i] != null) arr.push(i);
    for (let i = 0; i < (start < 0 ? D.weeks.length : start); i++) if (D.output[i] != null) arr.push(i);
    return arr.length ? arr : D.weeks.map((w, i) => i);
  }
  function weeklyTotalPPM(i) {
    const o = D.output[i]; if (!o) return null;
    let td = 0; D.cats.forEach(c => { td += (D.counts[c.key][i] || 0); });
    return td / o * 1e6;
  }
  const statusOf = p => (p == null ? 'none' : p >= WARN ? 'red' : p >= RED ? 'warn' : 'good');
  const statusColor = s => (s === 'red' ? 'var(--danger)' : s === 'warn' ? 'var(--warn)' : s === 'good' ? 'var(--success)' : 'var(--text-2)');
  function breaches() {
    const list = [];
    D.weeks.forEach((w, i) => { const p = weeklyTotalPPM(i); if (p != null && p >= RED) list.push({ w, p }); });
    return list.sort((a, b) => b.p - a.p);
  }

  // ---------- 设备维度（Mold机台 × PkgCode 透视，与客户 -M 透视表同口径：空 PkgCode 批次不计入） ----------
  function devRows(catKey, weekIdx) {
    const node = D.device && D.device[D.weeks[weekIdx]];
    if (!node) return null;
    const catCnt = (node.cnt && node.cnt[catKey]) || {};
    const catC = (node.ccnt && node.ccnt[catKey]) || {};
    return node.devs.map(d => {
      const cout = node.cout[d] || {};
      let out = 0; Object.keys(cout).forEach(c => { out += cout[c]; });
      const n = catCnt[d] || 0;
      const subs = Object.keys(cout)
        .map(c => ({ c, out: cout[c], n: (catC[d] && catC[d][c]) || 0 }))
        .filter(x => x.n > 0)
        .map(x => ({ ...x, ppm: x.out ? x.n / x.out * 1e6 : 0 }))
        .sort((a, b) => b.ppm - a.ppm);
      return { d, out, n, ppm: out ? n / out * 1e6 : null, subs };
    }).sort((a, b) => (b.ppm || -1) - (a.ppm || -1));
  }
  function devWeeksAvail() {
    if (!D.device) return [];
    return dispIdx().filter(i => D.device[D.weeks[i]]);
  }

  // ---------- L1：BGA Top Defect PPM Trend（16 类别 × 52 周多系列折线，对齐客户 trend 图形态） ----------
  const PALETTE = ['#2563eb', '#ea580c', '#0d9488', '#b91c1c', '#7c3aed', '#65a30d', '#db2777', '#0891b2', '#ca8a04', '#4f46e5', '#16a34a', '#dc2626', '#0284c7', '#9333ea', '#c2410c', '#475569'];
  const catColor = k => { const i = D.cats.findIndex(c => c.key === k); return PALETTE[(i < 0 ? 0 : i) % PALETTE.length]; };

  // 一级悬停浮窗（显示该位置所对应类别的二级详情概要）
  function ensureL1Tip() {
    let t = document.getElementById('defectL1Tip');
    if (!t) {
      t = document.createElement('div');
      t.id = 'defectL1Tip';
      t.style.cssText = 'position:fixed;z-index:90;display:none;max-width:252px;background:#fff;border:1px solid var(--line,#e1e7f0);border-radius:10px;box-shadow:0 8px 24px rgba(15,23,42,.16);padding:10px 12px;font-size:12px;color:var(--text);pointer-events:none;line-height:1.5';
      document.body.appendChild(t);
    }
    return t;
  }

  function lineChartL1(el) {
    let series = activeCats.map(k => ({ k, name: D.cats.find(c => c.key === k).name }));
    if (top5) {
      const top = [...series].map(x => ({ ...x, v: catPPM(x.k, latestIdx) })).filter(x => x.v != null)
        .sort((a, b) => b.v - a.v).slice(0, 5).map(x => x.k);
      series = series.filter(x => top.includes(x.k));
    }
    const W = 960, H = 440, padL = 46, padR = 14, padT = 28, padB = 44;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const disp = dispIdx(), m = disp.length;
    const vals = [];
    series.forEach(sr => disp.forEach(oi => { const v = catPPM(sr.k, oi); if (v != null) vals.push(v); }));
    const rawMax = Math.max(10, ...vals);
    const steps = [20, 25, 50, 100, 200, 500];
    const step = steps.find(st => rawMax / st <= 6) || 1000;
    const maxV = Math.ceil(rawMax * 1.08 / step) * step;
    const xOf = j => padL + (m <= 1 ? 0 : (j / (m - 1)) * plotW);
    const yOf = v => padT + plotH - (v / maxV) * plotH;

    let s = '';
    for (let v = 0; v <= maxV; v += step) {
      const y = yOf(v);
      s += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="var(--line,#e5eaf2)" stroke-width="1"/>` +
        `<text x="${padL - 8}" y="${(y + 3.5).toFixed(1)}" font-size="10.5" fill="var(--text-2)" text-anchor="end">${v}</text>`;
    }
    disp.forEach((oi, j) => { if (j % 4 === 0 || j === m - 1) s += `<text x="${xOf(j).toFixed(1)}" y="${H - padB + 16}" font-size="9.5" fill="var(--text-2)" text-anchor="middle">${D.weeks[oi]}</text>`; });

    series.forEach(sr => {
      const col = catColor(sr.k);
      let seg = '', hit = '', prev = null, prevH = null;
      const pts = [];
      disp.forEach((oi, j) => {
        const v = catPPM(sr.k, oi); if (v == null) { prev = null; return; }
        const x = xOf(j), y = yOf(v);
        if (prev) seg += `<line x1="${prev.x.toFixed(1)}" y1="${prev.y.toFixed(1)}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${col}" stroke-width="1.8"/>`;
        if (prevH) hit += `<line x1="${prevH.x.toFixed(1)}" y1="${prevH.y.toFixed(1)}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="rgba(0,0,0,0)" stroke-width="9"/>`;
        prev = { x, y }; prevH = { x, y };
        pts.push({ i: oi, x, y, v });
      });
      s += `<g class="dser" data-k="${esc(sr.k)}" style="cursor:pointer">${hit}${seg}`;
      pts.forEach(p => { s += `<circle data-i="${p.i}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.4" fill="${col}" stroke="#fff" stroke-width="1"/>`; });
      if (pts.length) {
        const peak = pts.reduce((a, p) => p.v > a.v ? p : a, pts[0]);
        const last = pts[pts.length - 1];
        const lab = p => `<text x="${p.x.toFixed(1)}" y="${(p.y - 6).toFixed(1)}" font-size="9.5" font-weight="700" fill="${col}" text-anchor="middle">${Math.round(p.v)}</text>`;
        s += lab(peak);
        if (last.i !== peak.i) s += lab(last);
      }
      s += '</g>';
    });

    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="display:block;width:100%;height:auto;overflow:visible">${s}</svg>`;
    el.querySelectorAll('.dser').forEach(g => {
      g.onclick = e => {
        drillCat = g.dataset.k;
        drillDev = null;
        drillCode = null;
        drillWeek = (e.target.tagName === 'circle') ? +e.target.getAttribute('data-i') : null;
        render();
      };
    });

    // 悬停浮窗：定位周 + 最近类别线 → 浮窗显示该类别二级概要
    const svg = el.querySelector('svg');
    const tip = ensureL1Tip();
    let hoverG = null;
    const hideTip = () => { tip.style.display = 'none'; if (hoverG) hoverG.innerHTML = ''; };
    el.addEventListener('mousemove', e => {
      if (!series.length) { hideTip(); return; }
      const r = el.getBoundingClientRect();
      if (!r.width) return;
      const cx = (e.clientX - r.left) / r.width * W;
      const cy = (e.clientY - r.top) / r.height * H;
      if (cx < padL || cx > W - padR) { hideTip(); return; }
      let j = Math.max(0, Math.min(m - 1, Math.round((cx - padL) / plotW * (m - 1))));
      const oi = disp[j], week = D.weeks[oi];
      let best = null, bestD = Infinity;
      series.forEach(sr => {
        const v = catPPM(sr.k, oi); if (v == null) return;
        const d = Math.abs(yOf(v) - cy);
        if (d < bestD) { bestD = d; best = { sr, v, y: yOf(v) }; }
      });
      if (!best) { hideTip(); return; }
      const c = D.cats.find(x => x.key === best.sr.k);
      const latestV = catPPM(best.sr.k, latestIdx);
      const worst = disp.reduce((a, k) => { const p = catPPM(best.sr.k, k); return (p != null && (a.p == null || p > a.p)) ? { w: D.weeks[k], p } : a; }, { w: '—', p: null });
      // 该悬停周该类别的最差机台（对应二级设备维度页面概要）
      const dnode = D.device && D.device[week];
      let devTxt = '无机台明细';
      if (dnode && dnode.cnt && dnode.cnt[best.sr.k]) {
        const cc = dnode.cnt[best.sr.k];
        let bd = null;
        Object.keys(cc).forEach(d => {
          const co = dnode.cout[d] || {}; let o = 0; Object.keys(co).forEach(x => { o += co[x]; });
          const p = o ? cc[d] / o * 1e6 : 0;
          if (!bd || p > bd.p) bd = { d, p };
        });
        devTxt = bd ? `${bd.d}（${Math.round(bd.p)} PPM）` : '各机台均无次品';
      } else if (dnode) devTxt = '本周无次品记录';
      if (!hoverG) { hoverG = document.createElementNS('http://www.w3.org/2000/svg', 'g'); hoverG.setAttribute('id', 'l1hover'); svg.appendChild(hoverG); }
      hoverG.innerHTML =
        `<line x1="${xOf(j).toFixed(1)}" y1="${padT}" x2="${xOf(j).toFixed(1)}" y2="${padT + plotH}" stroke="var(--text-2)" stroke-width="1" stroke-dasharray="3 3" opacity="0.55"/>` +
        `<circle cx="${xOf(j).toFixed(1)}" cy="${best.y.toFixed(1)}" r="4" fill="${catColor(best.sr.k)}" stroke="#fff" stroke-width="1.5"/>`;
      tip.innerHTML =
        `<div style="font-weight:700;margin-bottom:4px"><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${catColor(best.sr.k)};margin-right:5px"></span>${esc(c.name)} <span style="color:var(--text-2);font-weight:400;font-size:11px">${esc(c.station)}</span></div>` +
        `<div style="font-size:12px;margin-bottom:6px">悬停周 <b>${weekLabel(oi)}</b> · PPM <b style="color:${catColor(best.sr.k)}">${Math.round(best.v)}</b></div>` +
        `<div style="font-size:11.5px;color:var(--text-2);line-height:1.7">该周最差机台 <b style="color:var(--text)">${esc(devTxt)}</b><br>最新周 PPM <b style="color:var(--text)">${latestV == null ? '—' : Math.round(latestV)}</b><br>最差周 <b style="color:var(--text)">${worst.w}${worst.p != null ? ' (' + Math.round(worst.p) + ')' : ''}</b><br>所属工序 ${esc(c.station)}</div>` +
        `<div style="font-size:11px;color:var(--primary);margin-top:6px">点击进入二级设备维度明细</div>`;
      tip.style.display = 'block';
      const tw = tip.offsetWidth, th = tip.offsetHeight;
      let lx = e.clientX + 14, ly = e.clientY + 14;
      if (lx + tw > window.innerWidth - 8) lx = e.clientX - tw - 14;
      if (ly + th > window.innerHeight - 8) ly = e.clientY - th - 14;
      tip.style.left = lx + 'px'; tip.style.top = ly + 'px';
    });
    el.addEventListener('mouseleave', hideTip);
  }

  // ---------- L1 补充：类别 × 周 PPM 热力图（16 类别 × 实产周 网格，一眼看全高位点） ----------
  // 注：类别级 PPM 全量最大约 580，远低于「周合计」红线 2000 / 预警线 3000；故按类别自身量程分档着色。
  function heatBand(v) {
    if (v == null) return '#eef2f7';
    if (v < 100) return '#c8e6c9';
    if (v < 250) return '#fff3b0';
    if (v < 400) return '#ffd089';
    return '#f4978e';
  }
  function heatLegend() {
    const items = [['#c8e6c9', '<100'], ['#fff3b0', '100–250'], ['#ffd089', '250–400'], ['#f4978e', '≥400'], ['#eef2f7', '无数据']];
    return items.map(([c, t]) => `<span class="flex acenter gap5" style="font-size:11.5px;color:var(--text-2)"><span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:${c};border:1px solid rgba(0,0,0,.08)"></span>${t} PPM</span>`).join('');
  }
  function ensureHeatTip() {
    let t = document.getElementById('defectHeatTip');
    if (!t) {
      t = document.createElement('div');
      t.id = 'defectHeatTip';
      t.style.cssText = 'position:fixed;z-index:92;display:none;max-width:230px;background:#fff;border:1px solid var(--line,#e1e7f0);border-radius:10px;box-shadow:0 8px 24px rgba(15,23,42,.16);padding:9px 11px;font-size:12px;color:var(--text);pointer-events:none;line-height:1.6';
      document.body.appendChild(t);
    }
    return t;
  }
  /* ---------- L1 展现形式 2：帕累托图（类别次品贡献排序 + 累计占比 80/20） ----------
     与折线（时间趋势）、热力图（类别×周矩阵）互补：回答「先压哪几个类别最有效」。 */
  const PA_RANGES = [{ k: 'latest', t: '最新周' }, { k: 'w13', t: '近 13 周' }, { k: 'w26', t: '近 26 周' }, { k: 'all', t: '52 周合计' }];
  const shortNum = v => (v == null ? '—' : Math.abs(v) >= 10000 ? (v / 1000).toFixed(0) + 'K' : Math.abs(v) >= 1000 ? (v / 1000).toFixed(1) + 'K' : String(Math.round(v)));
  function paretoData() {
    const disp = dispIdx();
    let idxs;
    if (paretoRange === 'w13') idxs = disp.slice(-13);
    else if (paretoRange === 'w26') idxs = disp.slice(-26);
    else if (paretoRange === 'all') idxs = disp.slice();
    else idxs = [latestIdx];
    const rows = visibleCats().map(c => {
      let n = 0, o = 0;
      idxs.forEach(i => { n += (D.counts[c.key][i] || 0); o += (D.output[i] || 0); });
      return { key: c.key, name: c.name, station: c.station, n, out: o, ppm: o ? n / o * 1e6 : null, idxs: idxs.slice() };
    }).filter(r => r.out > 0 && r.n > 0).sort((a, b) => b.n - a.n);
    const totN = rows.reduce((a, r) => a + r.n, 0);
    let acc = 0;
    rows.forEach(r => { acc += r.n; r.share = totN ? r.n / totN * 100 : 0; r.acc = totN ? acc / totN * 100 : 0; });
    let k80 = rows.findIndex(r => r.acc >= 80); if (k80 < 0) k80 = rows.length - 1;
    return { rows, totN, idxs, k80, top5n: rows.slice(0, 5).reduce((a, r) => a + r.n, 0) };
  }
  function paretoL1(el) {
    const d = paretoData();
    const rangeLabel = PA_RANGES.find(r => r.k === paretoRange).t + '（' + d.idxs.length + ' 个实产周）';
    if (!d.rows.length) { el.innerHTML = '<div class="sub-note">当前数据范围 / 时间口径下无次品记录。</div>'; return; }
    const W = 960, H = 318, padL = 54, padR = 54, padT = 20, padB = 96;
    const plotH = H - padT - padB, plotW = W - padL - padR, n = d.rows.length;
    const slot = plotW / n, bw = Math.min(34, slot * 0.58);
    const maxN = d.rows[0].n || 1;
    const yL = v => padT + plotH - (v / maxN) * plotH;
    const yR = p => padT + plotH - (p / 100) * plotH;
    const xC = i => padL + slot * i + slot / 2;
    let s = '';
    [0, .25, .5, .75, 1].forEach(t => {
      const y = padT + plotH * (1 - t);
      s += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${(W - padR).toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--line,#e1e7f0)" stroke-width=".8"/>` +
        `<text x="${padL - 8}" y="${(y + 3.5).toFixed(1)}" font-size="9.5" fill="var(--text-2)" text-anchor="end">${shortNum(maxN * t)}</text>` +
        `<text x="${(W - padR + 8).toFixed(1)}" y="${(y + 3.5).toFixed(1)}" font-size="9.5" fill="#7c3aed" text-anchor="start">${Math.round(t * 100)}%</text>`;
    });
    d.rows.forEach((r, i) => {
      const col = catColor(r.key), y = yL(r.n), x = xC(i) - bw / 2;
      const tip = `${r.name}（${r.station}）\n次品 ${fmt(r.n)} · 结料 ${fmt(r.out)} · ${Math.round(r.ppm)} PPM\n占比 ${r.share.toFixed(1)}% · 累计 ${r.acc.toFixed(1)}%\n点击进入二级 · 机台树`;
      s += `<rect class="pbar" data-k="${esc(r.key)}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1.5, padT + plotH - y).toFixed(1)}" fill="${col}" rx="2"><title>${esc(tip)}</title></rect>` +
        `<text x="${xC(i).toFixed(1)}" y="${(y - 5).toFixed(1)}" font-size="9" fill="var(--text)" text-anchor="middle">${shortNum(r.n)}</text>` +
        `<text class="pbar" data-k="${esc(r.key)}" transform="rotate(-38 ${xC(i).toFixed(1)} ${(padT + plotH + 13).toFixed(1)})" x="${xC(i).toFixed(1)}" y="${(padT + plotH + 13).toFixed(1)}" font-size="10.5" fill="var(--text)" text-anchor="end"><title>${esc(tip)}</title>${esc(r.name)}</text>`;
    });
    const pts = d.rows.map((r, i) => `${xC(i).toFixed(1)},${yR(r.acc).toFixed(1)}`).join(' ');
    s += `<polyline points="${pts}" fill="none" stroke="#0f172a" stroke-width="1.6" stroke-linejoin="round" opacity=".85"/>`;
    d.rows.forEach((r, i) => { s += `<circle cx="${xC(i).toFixed(1)}" cy="${yR(r.acc).toFixed(1)}" r="2.6" fill="#0f172a" opacity=".85"/>`; });
    s += `<line x1="${padL}" y1="${yR(80).toFixed(1)}" x2="${(W - padR).toFixed(1)}" y2="${yR(80).toFixed(1)}" stroke="#7c3aed" stroke-width="1.2" stroke-dasharray="6 3"/>` +
      `<text x="${(W - padR - 4).toFixed(1)}" y="${(yR(80) - 6).toFixed(1)}" font-size="9.5" fill="#7c3aed" text-anchor="end">80% 参考线</text>` +
      `<text x="${padL}" y="12" font-size="9.5" fill="var(--text-2)">柱：次品数（左轴）· 黑线：累计占比（右轴）</text>`;
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="display:block;width:100%;height:auto;overflow:visible">${s}</svg>`;
    el.querySelectorAll('.pbar').forEach(b => { b.onclick = () => { drillCat = b.dataset.k; drillDev = null; drillWeek = null; drillCode = null; render(); }; });
  }

  /* ---------- L1 展现形式 3：小倍数趋势矩阵（Small Multiples，一格一类别） ----------
     解决「16 条线挤在一张图看不清单类别走势」：每格独立量程的迷你趋势 + 最新/峰值/均值。 */
  function smallMultiples(el) {
    const cats = visibleCats(), disp = dispIdx();
    if (!cats.length) { el.innerHTML = '<div class="sub-note">当前数据范围下无类别。</div>'; return; }
    const SW = 132, SH = 34;
    const cells = cats.map(c => {
      const vals = disp.map(i => catPPM(c.key, i));
      const nz = vals.filter(v => v != null);
      const lastV = nz.length ? nz[nz.length - 1] : null;
      const maxV = nz.length ? Math.max.apply(null, nz) : 0;
      const avgV = nz.length ? nz.reduce((a, b) => a + b, 0) / nz.length : null;
      const pk = nz.length ? nz.indexOf(maxV) : -1;
      const px = i => (disp.length > 1 ? (i / (disp.length - 1)) * (SW - 4) + 2 : SW / 2);
      const py = v => SH - 3 - (maxV > 0 ? (v / maxV) * (SH - 8) : 0);
      let d = '', started = false, lastPt = null;
      vals.forEach((v, i) => {
        if (v == null) return;
        d += (started ? ' L' : 'M') + px(i).toFixed(1) + ',' + py(v).toFixed(1);
        started = true; lastPt = { x: px(i), y: py(v), i, v };
      });
      const col = catColor(c.key);
      const on = activeCats.includes(c.key);
      const lbl = nz.length ? `${weekLabel(disp[disp.length - 1])} ${Math.round(lastV)} PPM（峰值 ${Math.round(maxV)} · ${weekLabel(disp[pk])}）` : '该类别无实产周数据';
      const svg = started
        ? `<polyline points="${d.replace(/[ML]/g, '').trim().split('L').join(' ')}" fill="none" stroke="${col}" stroke-width="1.5" stroke-linejoin="round"/>` +
          (pk >= 0 ? `<circle cx="${px(pk).toFixed(1)}" cy="${py(maxV).toFixed(1)}" r="2.4" fill="#dc2626"><title>峰值 ${Math.round(maxV)} PPM · ${weekLabel(disp[pk])}</title></circle>` : '') +
          (lastPt ? `<circle cx="${lastPt.x.toFixed(1)}" cy="${lastPt.y.toFixed(1)}" r="2.4" fill="${col}" stroke="#fff" stroke-width="1"><title>最新 ${Math.round(lastV)} PPM</title></circle>` : '')
        : `<line x1="2" y1="${SH - 3}" x2="${SW - 2}" y2="${SH - 3}" stroke="var(--line,#e1e7f0)" stroke-width="1.4"/>`;
      return `<div class="dp-sm ${on ? '' : 'off'}" data-sm="${esc(c.key)}" title="${esc(c.name)}（${esc(c.station)}）· ${esc(lbl)} · 均值 ${avgV == null ? '—' : Math.round(avgV)} PPM\n点击进入二级 · 机台树">
          <div class="dp-sm-hd"><i style="background:${col}"></i><span>${esc(c.name)}</span></div>
          <svg class="dp-sm-svg" viewBox="0 0 ${SW} ${SH}" preserveAspectRatio="none">${svg}</svg>
          <div class="dp-sm-ft"><b style="color:${col}">${lastV == null ? '—' : Math.round(lastV)}</b><span>峰 ${maxV ? Math.round(maxV) : '—'} · 均 ${avgV == null ? '—' : Math.round(avgV)}</span></div>
        </div>`;
    }).join('');
    el.innerHTML = `<div class="dp-sms">${cells}</div>`;
    el.querySelectorAll('[data-sm]').forEach(n => { n.onclick = () => { drillCat = n.dataset.sm; drillDev = null; drillWeek = null; drillCode = null; render(); }; });
  }

  function heatmapL1(el, cats) {
    cats = cats || D.cats;
    const disp = dispIdx(), nC = disp.length;
    const W = 960, padL = 120, padT = 26, padR = 10, padB = 30;
    const cellH = 18, cellW = (W - padL - padR) / nC;
    const H = padT + cats.length * cellH + padB;
    const latestJ = disp.indexOf(latestIdx);
    let s = '';
    disp.forEach((oi, j) => {
      if (j % 4 === 0 || j === nC - 1) {
        s += `<text x="${(padL + j * cellW + cellW / 2).toFixed(1)}" y="${padT - 8}" font-size="9" fill="var(--text-2)" text-anchor="middle">${D.weeks[oi].replace('WW', '')}</text>`;
      }
    });
    cats.forEach((c, ri) => {
      const y = padT + ri * cellH;
      s += `<text x="${padL - 8}" y="${(y + cellH / 2 + 3.6).toFixed(1)}" font-size="10.5" fill="var(--text)" text-anchor="end">${esc(c.name)}</text>`;
      disp.forEach((oi, j) => {
        const v = catPPM(c.key, oi);
        const x = padL + j * cellW;
        const col = heatBand(v);
        const hi = v != null && v >= 400;
        s += `<rect class="hcell" data-k="${esc(c.key)}" data-i="${oi}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${cellW.toFixed(1)}" height="${cellH}" fill="${col}" stroke="${hi ? '#c0392b' : 'rgba(255,255,255,.6)'}" stroke-width="${hi ? 0.9 : 0.4}"/>`;
      });
    });
    if (latestJ >= 0) {
      const x = padL + latestJ * cellW + cellW / 2;
      s += `<line x1="${x.toFixed(1)}" y1="${padT - 4}" x2="${x.toFixed(1)}" y2="${(padT + cats.length * cellH).toFixed(1)}" stroke="var(--primary)" stroke-width="1.4" stroke-dasharray="3 3"/>` +
        `<text x="${x.toFixed(1)}" y="${(padT + cats.length * cellH + 14).toFixed(1)}" font-size="9.5" fill="var(--primary)" text-anchor="middle">最新</text>`;
    }
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="display:block;width:100%;height:auto;overflow:visible">${s}</svg>`;
    const tip = ensureHeatTip();
    const hide = () => { tip.style.display = 'none'; };
    el.addEventListener('mousemove', e => {
      const r = el.getBoundingClientRect(); if (!r.width) return;
      const cx = (e.clientX - r.left) / r.width * W, cy = (e.clientY - r.top) / r.height * H;
      if (cx < padL || cx > W - padR || cy < padT || cy > padT + cats.length * cellH) { hide(); return; }
      const j = Math.max(0, Math.min(nC - 1, Math.floor((cx - padL) / cellW)));
      const ri = Math.max(0, Math.min(cats.length - 1, Math.floor((cy - padT) / cellH)));
      const c = cats[ri], oi = disp[j], v = catPPM(c.key, oi);
      tip.innerHTML = `<div style="font-weight:700;margin-bottom:3px"><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${heatBand(v)};margin-right:5px"></span>${esc(c.name)} <span style="color:var(--text-2);font-weight:400;font-size:11px">${esc(c.station)}</span></div>` +
        `<div style="font-size:12px">周 <b>${weekLabel(oi)}</b> · PPM <b style="color:var(--text)">${v == null ? '—' : Math.round(v)}</b></div>` +
        `<div style="font-size:11px;color:var(--primary);margin-top:4px">点击进入二级 · ${esc(c.station)} 机台树（带该周上下文）</div>`;
      tip.style.display = 'block';
      let lx = e.clientX + 14, ly = e.clientY + 14;
      const tw = tip.offsetWidth, th = tip.offsetHeight;
      if (lx + tw > window.innerWidth - 8) lx = e.clientX - tw - 14;
      if (ly + th > window.innerHeight - 8) ly = e.clientY - th - 14;
      tip.style.left = lx + 'px'; tip.style.top = ly + 'px';
    });
    el.addEventListener('mouseleave', hide);
    /* 热力图单元格点击 = 先进入二级（机台树），不再直接跳三级 Package 明细；
       所点周作为二级的上下文周（若该周无设备明细，则回落到最近的可用周）。 */
    el.querySelectorAll('.hcell').forEach(rc => {
      rc.onclick = () => {
        drillCat = rc.dataset.k;
        drillDev = null;
        drillWeek = null;
        drillCode = null;
        const av = devWeeksAvail(), w = +rc.dataset.i;
        devWeek = av.includes(w) ? w : (av.length ? av[av.length - 1] : latestIdx);
        render();
      };
    });
  }

  // ---------- L2：设备维度（机台 PPM 条形 + 机台×料号 透视表，参考客户 -M 透视表） ----------
  const DEV_RED = 500, DEV_WARN = 350; // 机台级展示口径：设备 PPM≥500 红 / ≥350 预警（对齐客户透视图的高亮形态）
  // 单次注入：树节点 hover 高亮
  function ensureDefCss() {
    if (document.getElementById('defectTreeCss')) return;
    const st = document.createElement('style');
    st.id = 'defectTreeCss';
    st.textContent = '.dnode:hover .nrect{stroke:var(--primary);stroke-width:2}';
    document.head.appendChild(st);
  }

  // 设备角标悬停浮窗（报修 / 换模 近 24h 明细）
  function ensureDevTip() {
    let t = document.getElementById('defectDevTip');
    if (!t) {
      t = document.createElement('div');
      t.id = 'defectDevTip';
      t.style.cssText = 'position:fixed;z-index:95;display:none;max-width:280px;background:#fff;border:1px solid var(--line,#e1e7f0);border-radius:10px;box-shadow:0 8px 24px rgba(15,23,42,.16);padding:10px 12px;font-size:12px;color:var(--text);pointer-events:none;line-height:1.6';
      document.body.appendChild(t);
      document.addEventListener('mousemove', e => {
        if (t.style.display === 'none') return;
        let x = e.clientX + 14, y = e.clientY + 14;
        const r = t.getBoundingClientRect();
        if (x + r.width > window.innerWidth - 8) x = e.clientX - r.width - 14;
        if (y + r.height > window.innerHeight - 8) y = e.clientY - r.height - 14;
        t.style.left = x + 'px'; t.style.top = y + 'px';
      });
    }
    return t;
  }
  function devTipHtml(dev, type) {
    const ev = window.DeviceEvents ? DeviceEvents.of(dev, Date.now()) : null;
    if (!ev) return `<div style="font-weight:700;margin-bottom:4px">${esc(dev)}</div><div class="muted">设备报修 / 模具管理数据未接入</div>`;
    const list = type === 'repair' ? ev.repair : ev.mold;
    const title = type === 'repair' ? '近 24h 设备报修' : '近 24h 模具更换';
    const rows = list.length ? list.map(x => {
      const hh = DeviceEvents.hhmm(x.t);
      if (type === 'repair') return `<div style="display:flex;justify-content:space-between;gap:12px"><span style="font-weight:700;color:var(--text)">${hh}</span><span style="color:var(--text-2)">${esc(x.id)} · ${esc(x.reason)}</span></div>`;
      return `<div style="display:flex;justify-content:space-between;gap:12px"><span style="font-weight:700;color:var(--text)">${hh}</span><span style="color:var(--text-2)">${esc(x.id)} · ${esc(x.from)} → ${esc(x.to)}</span></div>`;
    }).join('') : `<div class="muted">近 24 小时无记录</div>`;
    return `<div style="font-weight:700;margin-bottom:6px">${esc(dev)} · ${title}（${list.length}）</div>${rows}`;
  }
  function showDevTip(dev, type) { const t = ensureDevTip(); t.innerHTML = devTipHtml(dev, type); t.style.display = 'block'; }
  function hideDevTip() { const t = document.getElementById('defectDevTip'); if (t) t.style.display = 'none'; }

  // 机台树状图：根=次品类别，二级节点=机台（点击进三级料号透视）
  function devTreeChart(el, catKey, weekIdx) {
    ensureDefCss();
    const now = Date.now(); // 设备报修 / 换模 = 我方系统实时快照（近 24h）
    // 机台节点后的角标（报修 / 换模），SVG pill
    function badgeG(x, midY, type, n, col, dev) {
      const fill = type === 'repair' ? '#fdecec' : '#eaf2fe';
      return `<g class="dev-badge" data-type="${type}" data-d="${esc(dev)}" style="cursor:help">` +
        `<rect x="${x}" y="${(midY - 9).toFixed(1)}" width="72" height="18" rx="9" fill="${fill}" stroke="${col}" stroke-width="1"/>` +
        `<circle cx="${(x + 13).toFixed(1)}" cy="${midY}" r="4.5" fill="${col}"/>` +
        `<text x="${(x + 24).toFixed(1)}" y="${(midY + 3.5).toFixed(1)}" font-size="10.5" font-weight="700" fill="${col}">${type === 'repair' ? '报修' : '换模'} ${n}</text>` +
        `</g>`;
    }
    const rows = (devRows(catKey, weekIdx) || []).filter(r => r.out > 0);
    const W = 960, padT = 12, padB = 12, rowH = 46;
    const H = padT + padB + Math.max(1, rows.length) * rowH;
    const maxV = Math.max(1, ...rows.map(r => r.ppm || 0)) * 1.08;
    const rx0 = 8, rootW = 172, rx1 = rx0 + rootW, nx0 = 236, nx1 = 760;
    const cy = H / 2;
    const tot = rows.reduce((a, r) => ({ out: a.out + r.out, n: a.n + r.n }), { out: 0, n: 0 });
    const totPPM = tot.out ? tot.n / tot.out * 1e6 : null;
    let s = '';
    rows.forEach((r, i) => {
      const ey = padT + i * rowH + rowH / 2, mx = (rx1 + nx0) / 2;
      s += `<path d="M${rx1},${cy.toFixed(1)} L${mx},${cy.toFixed(1)} L${mx},${ey.toFixed(1)} L${nx0},${ey.toFixed(1)}" fill="none" stroke="var(--line,#d3dced)" stroke-width="1.6"/>`;
    });
    const rootH = 76, ry = cy - rootH / 2;
    s += `<rect x="${rx0}" y="${ry.toFixed(1)}" width="${rootW}" height="${rootH}" rx="10" fill="#fff" stroke="var(--primary)" stroke-width="1.6"/>` +
      `<text x="${rx0 + 12}" y="${(ry + 23).toFixed(1)}" font-size="11.5" fill="var(--text-2)">次品类别（本周合计）</text>` +
      `<text x="${rx0 + 12}" y="${(ry + 45).toFixed(1)}" font-size="14" font-weight="700" fill="var(--text)">${esc(D.cats.find(c => c.key === catKey).name)}</text>` +
      `<text x="${rx0 + 12}" y="${(ry + 64).toFixed(1)}" font-size="11.5" fill="var(--text-2)">${weekLabel(weekIdx)} · <tspan font-weight="700" fill="var(--text)">${totPPM == null ? '—' : Math.round(totPPM)}</tspan> PPM</text>`;
    rows.forEach((r, i) => {
      const y = padT + i * rowH + 5, h = rowH - 12, midY = y + h / 2;
      const hot = r.ppm != null && r.ppm >= DEV_WARN;
      const col = r.ppm != null && r.ppm >= DEV_RED ? 'var(--danger)' : hot ? 'var(--warn)' : 'var(--primary)';
      const bw = Math.max(3, ((r.ppm || 0) / maxV) * 190);
      const ev = (window.DeviceEvents ? DeviceEvents.of(r.d, now) : { nRep: 0, nMold: 0 });
      const repCol = ev.nRep > 0 ? 'var(--danger)' : 'var(--text-2)';
      const molCol = ev.nMold > 0 ? '#2563eb' : 'var(--text-2)';
      const cx = nx1 - 168; // 角标簇起点（报修 / 换模）
      s += `<g class="dnode" data-d="${esc(r.d)}" style="cursor:pointer">` +
        `<rect class="nrect" x="${nx0}" y="${y.toFixed(1)}" width="${nx1 - nx0}" height="${h}" rx="9" fill="#fff" stroke="var(--line,#e1e7f0)" stroke-width="1.4"/>` +
        `<text x="${nx0 + 12}" y="${(midY + 4).toFixed(1)}" font-size="12.5" font-weight="700" fill="var(--text)">${esc(r.d)}</text>` +
        `<rect x="${nx0 + 92}" y="${(midY - 5).toFixed(1)}" width="190" height="10" rx="5" fill="#eef2f8"/>` +
        `<rect x="${nx0 + 92}" y="${(midY - 5).toFixed(1)}" width="${bw.toFixed(1)}" height="10" rx="5" fill="${col}" opacity="${r.n ? 1 : 0.35}"/>` +
        `<text x="${nx0 + 294}" y="${(midY + 4).toFixed(1)}" font-size="12.5" font-weight="700" fill="${col}">${r.ppm == null ? '—' : Math.round(r.ppm)} <tspan font-size="10.5" font-weight="400" fill="var(--text-2)">PPM</tspan></text>` +
        badgeG(cx, midY, 'repair', ev.nRep, repCol, r.d) +
        badgeG(cx + 78, midY, 'mold', ev.nMold, molCol, r.d) +
        `<text x="${nx1 - 10}" y="${(midY + 5).toFixed(1)}" font-size="15" fill="var(--primary)" text-anchor="end">›</text>` +
        `</g>`;
    });
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="display:block;width:100%;height:auto;overflow:visible">${s}</svg>`;
    el.querySelectorAll('.dnode').forEach(g => { g.onclick = () => { drillDev = g.dataset.d; drillWeek = null; drillCode = null; render(); }; });
    el.querySelectorAll('.dev-badge').forEach(g => {
      g.addEventListener('mouseover', () => showDevTip(g.dataset.d, g.dataset.type));
      g.addEventListener('mouseout', hideDevTip);
      g.addEventListener('click', e => { e.stopPropagation(); showDevTip(g.dataset.d, g.dataset.type); });
    });
  }

  // 某机台下的全部料号（含 0 次品，与客户透视表一致）
  function devCodes(catKey, weekIdx, dev) {
    const node = D.device && D.device[D.weeks[weekIdx]];
    if (!node) return [];
    const cout = node.cout[dev] || {};
    const cc = (node.ccnt && node.ccnt[catKey] && node.ccnt[catKey][dev]) || {};
    return Object.keys(cout).map(c => ({ c, out: cout[c], n: cc[c] || 0, ppm: cout[c] ? (cc[c] || 0) / cout[c] * 1e6 : 0 }))
      .sort((a, b) => (b.ppm - a.ppm) || (b.out - a.out));
  }

  // 反查：某料号（PkgCode）在「同周 + 同类别」下、跨全部 Mold 机台的 PPM 分布（判断机台特异性 vs 料号/物料共性）
  function codeAcrossDevs(catKey, weekIdx, code) {
    const node = D.device && D.device[D.weeks[weekIdx]];
    if (!node) return [];
    const res = [];
    (node.devs || []).forEach(d => {
      const cout = node.cout[d] || {};
      if (!(code in cout)) return; // 该机台未生产此料号
      const cc = (node.ccnt && node.ccnt[catKey] && node.ccnt[catKey][d]) || {};
      const out = cout[code] || 0;
      const n = cc[code] || 0;
      res.push({ d, out, n, ppm: out ? n / out * 1e6 : 0 });
    });
    return res.sort((a, b) => b.ppm - a.ppm);
  }
  // 单料号反查单元格（最后一列）
  function revCellHtml(catKey, weekIdx, code, onlyDev) {
    const across = codeAcrossDevs(catKey, weekIdx, code);
    const k = across.length;
    if (k <= 1) return '<span class="muted small">仅本机台</span>';
    const peak = across[0];
    const cur = across.find(a => a.d === onlyDev);
    const curIsPeak = !!(cur && peak.d === cur.d);
    const pkCol = peak.ppm >= DEV_WARN ? 'var(--danger)' : (peak.ppm >= 350 ? 'var(--warn)' : 'var(--text-2)');
    const tip = across.map(a => `${a.d === onlyDev ? '▶ ' : '  '}${a.d}: ${Math.round(a.ppm)} PPM（${fmt(a.n)}/${fmt(a.out)}）`).join('\n');
    const tag = (peak.ppm >= DEV_WARN)
      ? (curIsPeak ? '<span style="color:var(--danger);font-weight:700">本机最高</span>' : '<span style="color:var(--primary)">他机更高</span>')
      : '<span class="muted small">跨机平稳</span>';
    return `<span title="${esc(tip)}" style="cursor:help;color:${pkCol};font-weight:${peak.ppm >= DEV_WARN ? 700 : 400}">峰值 ${Math.round(peak.ppm)}·${esc(peak.d)}·共${k}机台</span> <span style="font-size:11px">${tag}</span>`;
  }

  /* ---------- L4：料号跨机台 可视化（并排两张：① 各机台 PPM 柱状 ② 各机台次品占比 环形饼图） ----------
     两图与下方明细表同源同口径（该料号 × 本周 × 同类别 × 各 Mold 机台），用于一眼定位主要贡献机台。
     用 SVG 静态绘制 + 原生 <title> 悬停提示（无额外脚本依赖）。 */
  const DEV_PALETTE = ['#2563eb', '#ea580c', '#0d9488', '#b91c1c', '#7c3aed', '#65a30d', '#db2777', '#0891b2', '#ca8a04', '#4f46e5', '#16a34a', '#dc2626', '#0284c7', '#9333ea', '#c2410c', '#475569'];
  const devColor = i => DEV_PALETTE[i % DEV_PALETTE.length];
  const niceCeil = v => { const p = Math.pow(10, Math.floor(Math.log10(Math.max(v, 1e-6)))); const nn = v / p; return (nn <= 1 ? 1 : nn <= 2 ? 2 : nn <= 2.5 ? 2.5 : nn <= 5 ? 5 : 10) * p; };
  // Y 轴上限走「好刻度」阶梯，保证 350 预警线（必要时含 500 红线）始终落在绘图区内
  const L4_NICE = [50, 100, 150, 200, 250, 300, 350, 400, 500, 600, 750, 800, 1000, 1250, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 8000, 10000];
  const l4Top = maxP => {
    const need = Math.max(maxP * 1.08, maxP >= DEV_WARN ? DEV_RED * 1.15 : DEV_WARN * 1.12, 10);
    for (let i = 0; i < L4_NICE.length; i++) if (L4_NICE[i] >= need) return L4_NICE[i];
    return niceCeil(need);
  };
  const l4Band = v => (v >= DEV_RED ? 'var(--danger)' : (v >= DEV_WARN ? 'var(--warn)' : 'var(--text)'));

  // ① 各机台 PPM 柱状（含 350 预警线 / 500 红线；本机台高亮描边）
  function l4BarChart(across, curDev) {
    const W = 470, H = 250, padL = 50, padR = 16, padT = 24, padB = 48;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const n = Math.max(across.length, 1), slot = plotW / n, bw = Math.min(42, slot * 0.56);
    const maxP = across.reduce((a, x) => Math.max(a, x.ppm), 0);
    const yTop = l4Top(maxP);
    const yOf = v => padT + plotH - (v / yTop) * plotH;
    let s = '';
    [0, .25, .5, .75, 1].forEach(t => {
      const y = padT + plotH * (1 - t);
      s += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${(W - padR).toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--line,#e1e7f0)" stroke-width=".8"/>` +
        `<text x="${padL - 7}" y="${(y + 3.5).toFixed(1)}" font-size="9.5" fill="var(--text-2)" text-anchor="end">${Math.round(yTop * t)}</text>`;
    });
    s += `<text x="${padL - 7}" y="${padT - 10}" font-size="9.5" fill="var(--text-2)" text-anchor="end">PPM</text>`;
    [[DEV_WARN, 'var(--warn)', '预警线 ' + DEV_WARN], [DEV_RED, 'var(--danger)', '红线 ' + DEV_RED]].forEach(([lv, col, txt]) => {
      if (lv >= yTop) return;
      const y = yOf(lv);
      s += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${(W - padR).toFixed(1)}" y2="${y.toFixed(1)}" stroke="${col}" stroke-width="1.1" stroke-dasharray="5 3" opacity=".8"/>` +
        `<text x="${(W - padR - 2).toFixed(1)}" y="${(y - 4).toFixed(1)}" font-size="9" fill="${col}" text-anchor="end">${txt}</text>`;
    });
    across.forEach((a, i) => {
      const x = padL + slot * i + (slot - bw) / 2;
      const h = Math.max(1.5, Math.min(plotH, (a.ppm / yTop) * plotH));
      const y = padT + plotH - h;
      const isMe = a.d === curDev, col = l4Band(a.ppm);
      const tip = `${isMe ? '▶ ' : ''}${a.d}${isMe ? '（本机台）' : ''}\nPPM ${Math.round(a.ppm)} · 次品 ${fmt(a.n)} / 结料 ${fmt(a.out)}\n占该料号次品 ${(a.share != null ? a.share : 0).toFixed(1)}%`;
      s += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" fill="${col}" fill-opacity="${isMe ? 1 : 0.78}" rx="2.5"${isMe ? ` stroke="#0f172a" stroke-width="1.6" stroke-dasharray="3 2"` : ''}><title>${esc(tip)}</title></rect>` +
        `<text x="${(x + bw / 2).toFixed(1)}" y="${(y - 5).toFixed(1)}" font-size="9.5" font-weight="${isMe ? 700 : 400}" fill="${col}" text-anchor="middle">${Math.round(a.ppm)}</text>` +
        `<text transform="rotate(-32 ${(x + bw / 2).toFixed(1)} ${(padT + plotH + 14).toFixed(1)})" x="${(x + bw / 2).toFixed(1)}" y="${(padT + plotH + 14).toFixed(1)}" font-size="10" font-weight="${isMe ? 700 : 400}" fill="${isMe ? 'var(--text)' : 'var(--text-2)'}" text-anchor="end"><title>${esc(tip)}</title>${esc(a.d)}${isMe ? ' ◂' : ''}</text>`;
    });
    return `<svg class="l4-svg" viewBox="0 0 ${W} ${H}" style="display:block;width:100%;height:auto;overflow:visible">${s}</svg>`;
  }

  // ② 各机台次品数占比 环形图（右列表例：机台 / 次品数 / 占比）
  function l4PieChart(across, curDev, totN, wppm) {
    const W = 470, H = 250, cx = 118, cy = 122, R = 74, r = 44;
    let s = '';
    if (!totN) {
      s += `<circle cx="${cx}" cy="${cy}" r="${(R + r) / 2}" fill="none" stroke="#eef2f8" stroke-width="${R - r}"/>` +
        `<text x="${cx}" y="${cy + 4}" font-size="12" fill="var(--text-2)" text-anchor="middle">无次品</text>`;
    } else {
      const live = across.filter(a => a.n > 0);
      if (live.length <= 1) {
        const c0 = live[0] || null;
        const col = c0 ? l4Band(c0.ppm) : '#cbd5e1';
        s += `<circle cx="${cx}" cy="${cy}" r="${(R + r) / 2}" fill="none" stroke="${col}" stroke-width="${R - r}" stroke-opacity="${c0 && c0.d === curDev ? 1 : 0.8}"><title>${c0 ? esc(c0.d) + '：100.0%（' + fmt(c0.n) + ' 颗）' : '无次品'}</title></circle>`;
      } else {
        let ang = -Math.PI / 2, idx = 0;
        across.forEach((a, i) => {
          const frac = a.n / totN;
          if (frac <= 0) { return; }
          idx++;
          const a2 = ang + frac * Math.PI * 2;
          const col = l4Band(a.ppm), isMe = a.d === curDev;
          const x1 = cx + R * Math.cos(ang), y1 = cy + R * Math.sin(ang);
          const x2 = cx + R * Math.cos(a2), y2 = cy + R * Math.sin(a2);
          const xi2 = cx + r * Math.cos(a2), yi2 = cy + r * Math.sin(a2);
          const xi1 = cx + r * Math.cos(ang), yi1 = cy + r * Math.sin(ang);
          const large = frac > 0.5 ? 1 : 0;
          const tip = `${isMe ? '▶ ' : ''}${a.d}${isMe ? '（本机台）' : ''}\n次品 ${fmt(a.n)} 颗 · 占 ${(frac * 100).toFixed(1)}%\nPPM ${Math.round(a.ppm)} · 结料 ${fmt(a.out)}`;
          s += `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} A${R} ${R} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} L${xi2.toFixed(1)} ${yi2.toFixed(1)} A${r} ${r} 0 ${large} 0 ${xi1.toFixed(1)} ${yi1.toFixed(1)} Z" fill="${col}" fill-opacity="${isMe ? 1 : 0.8}" stroke="#fff" stroke-width="1.4"><title>${esc(tip)}</title></path>`;
          // 占比 ≥ 8% 时在扇区内标百分比
          if (frac >= 0.08) {
            const mid = (ang + a2) / 2, rm = (R + r) / 2;
            s += `<text x="${(cx + rm * Math.cos(mid)).toFixed(1)}" y="${(cy + rm * Math.sin(mid) + 3.4).toFixed(1)}" font-size="10.5" font-weight="700" fill="#fff" text-anchor="middle" pointer-events="none">${Math.round(frac * 100)}%</text>`;
          }
          ang = a2;
        });
      }
    }
    s += `<text x="${cx}" y="${cy - 4}" font-size="11" fill="var(--text-2)" text-anchor="middle">次品合计</text>` +
      `<text x="${cx}" y="${cy + 17}" font-size="20" font-weight="800" fill="var(--text)" text-anchor="middle">${fmt(totN)}</text>` +
      `<text x="${cx}" y="${cy + 34}" font-size="10.5" fill="var(--text-2)" text-anchor="middle">加权 ${Math.round(wppm)} PPM</text>`;
    // 右侧图例
    const lx = 216, ly = 40, gap = Math.min(24, (H - 66) / Math.max(across.length, 1));
    across.forEach((a, i) => {
      const y = ly + i * gap, isMe = a.d === curDev;
      const share = totN ? a.n / totN * 100 : 0;
      s += `<rect x="${lx}" y="${(y - 8).toFixed(1)}" width="10" height="10" rx="2" fill="${l4Band(a.ppm)}" fill-opacity="${isMe ? 1 : 0.8}"><title>${esc(a.d)}</title></rect>` +
        `<text x="${lx + 16}" y="${(y + 1).toFixed(1)}" font-size="11" font-weight="${isMe ? 700 : 400}" fill="var(--text)">${isMe ? '▶ ' : ''}${esc(a.d)}<tspan font-size="9.5" fill="var(--text-3,#64748b)">${isMe ? '（本机台）' : ''}</tspan></text>` +
        `<text x="${lx + 152}" y="${(y + 1).toFixed(1)}" font-size="11" fill="var(--text-2)" text-anchor="end">${fmt(a.n)} 颗</text>` +
        `<text x="${lx + 214}" y="${(y + 1).toFixed(1)}" font-size="11" font-weight="700" fill="${isMe ? 'var(--text)' : 'var(--text-2)'}" text-anchor="end">${share.toFixed(1)}%</text>`;
    });
    return `<svg class="l4-svg" viewBox="0 0 ${W} ${H}" style="display:block;width:100%;height:auto;overflow:visible">${s}</svg>`;
  }

  // 两张图并排（一行两列，窄屏自动堆叠）
  function l4Charts(across, curDev, totN, wppm) {
    if (!across.length) return '';
    const withShare = across.map(a => Object.assign({}, a, { share: totN ? a.n / totN * 100 : 0 }));
    const box = (title, sub, inner) => `<div class="l4-box">
        <div class="l4-box-hd">${title}<span class="l4-box-sub">${sub}</span></div>
        ${inner}
      </div>`;
    const icBar = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M6.5 21v-7M11.5 21V6M16.5 21v-11M21 21v-4"/></svg>';
    const icPie = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3v9l6.4 6.3"/></svg>';
    return `<div class="l4-2col">
      ${box(icBar + ' 各机台 PPM 对比', '柱高 = 该料号在本机台的 PPM（含预警 / 红线）', l4BarChart(withShare, curDev))}
      ${box(icPie + ' 各机台次品占比', '环宽 = 该机台次品数 ÷ 该料号本周次品总数', l4PieChart(withShare, curDev, totN, wppm))}
    </div>`;
  }

  function devPivotTable(catKey, weekIdx, onlyDev) {
    const all = devRows(catKey, weekIdx);
    if (!all) return '';
    const rows = onlyDev ? all.filter(r => r.d === onlyDev) : all;
    let html = `<table class="table"><thead><tr><th>机台 / 料号（PkgCode）</th><th class="num">ICOS结料数量</th><th class="num">次品数</th><th class="num">PPM</th><th>同料号跨机台 PPM（反查）</th><th style="width:120px">操作</th></tr></thead><tbody>`;
    rows.forEach(r => {
      const dred = r.ppm != null && r.ppm >= DEV_RED;
      html += `<tr style="background:#f4f7fb"><td style="font-weight:700">${esc(r.d)}</td><td class="num" style="font-weight:700">${fmt(r.out)}</td><td class="num" style="font-weight:700">${fmt(r.n)}</td>` +
        `<td class="num" style="font-weight:700;${dred ? 'color:var(--danger)' : ''}">${r.ppm == null ? '—' : Math.round(r.ppm)}</td>` +
        `<td class="muted small">每行反查该料号 →</td><td></td></tr>`;
      const cs = onlyDev ? devCodes(catKey, weekIdx, r.d) : r.subs;
      cs.forEach(sb => {
        const sred = sb.ppm >= DEV_WARN, zero = !sb.n;
        html += `<tr><td style="padding-left:26px;${zero ? 'color:var(--text-2)' : ''}">└ ${esc(sb.c)}</td><td class="num" style="${zero ? 'color:var(--text-2)' : ''}">${fmt(sb.out)}</td><td class="num">${fmt(sb.n)}</td>` +
          `<td class="num" style="${sred ? 'color:var(--danger);font-weight:700' : ''}">${Math.round(sb.ppm)}</td>` +
          `<td style="font-size:12px">${revCellHtml(catKey, weekIdx, sb.c, onlyDev)}</td>` +
          `<td><button class="chip" data-l4="${esc(sb.c)}" data-l4dev="${esc(r.d)}" title="进入四级：该料号在各机台上的 PPM 表现分析" style="cursor:pointer;white-space:nowrap">四级分析 ›</button></td></tr>`;
      });
    });
    if (!onlyDev) {
      const tout = rows.reduce((a, r) => a + r.out, 0), tn = rows.reduce((a, r) => a + r.n, 0);
      html += `<tr style="background:#eef3fa"><td style="font-weight:700">合计</td><td class="num" style="font-weight:700">${fmt(tout)}</td><td class="num" style="font-weight:700">${fmt(tn)}</td><td class="num" style="font-weight:700">${tout ? Math.round(tn / tout * 1e6) : '—'}</td><td class="num">—</td><td></td></tr>`;
    }
    return html + '</tbody></table>';
  }

  // ---------- L3：选中周 Package 级明细 ----------
  function abnTable(weekIdx) {
    const w = D.weeks[weekIdx], rows = D.abnormal[w] || [];
    if (!rows.length) return `<div class="sub-note">该周（${w}）无 Package 级明细数据。</div>`;
    const body = rows.map(r => {
      const out = r.output, rej = r.rej;
      const yld = (out && rej != null) ? out / (out + rej) : null;
      const bad = yld != null && yld < 0.998;
      const ycol = yld == null ? 'var(--text-2)' : (bad ? 'var(--danger)' : 'var(--text)');
      const ytxt = yld == null ? '—' : (yld * 100).toFixed(2) + '%';
      return `<tr><td>${esc(r.short || '')}</td><td>${esc(r.outline || '')}</td><td>${esc(r.code || '')}</td>` +
        `<td class="num">${fmt(out)}</td><td class="num">${fmt(rej)}</td>` +
        `<td class="num" style="color:${ycol};font-weight:${bad ? 700 : 400}">${ytxt}</td></tr>`;
    }).join('');
    return `<table class="table"><thead><tr><th>料号（Package）</th><th>Package Outline</th><th>PKG Code</th><th class="num">产出</th><th class="num">BE Reject</th><th class="num">良率</th></tr></thead><tbody>${body}</tbody></table>`;
  }

  function crumbHtml() {
    const lk = (go, t) => `<span style="color:var(--primary);cursor:pointer" class="lk" data-go="${go}">${t}</span>`;
    if (!drillCat) return `<div class="crumb">一级 · 类别 PPM 趋势概览（WW52'25 → ${D.weeks[latestIdx]}'26，共 ${D.output.filter(o => o != null).length} 个实产周）</div>`;
    const c = D.cats.find(x => x.key === drillCat);
    if (drillDev != null) {
      const head = `${lk(1, '一级')} › ${lk(2, '二级（' + esc(c.name) + '）')} › ${lk(3, '三级 · ' + esc(drillDev) + ' × 料号透视')}`;
      return `<div class="crumb">${head} › ${drillCode ? '四级 · 料号 ' + esc(drillCode) + ' 跨机台 PPM 分析（' + weekLabel(devWeek) + '）' : '（' + weekLabel(devWeek) + '）'}</div>`;
    }
    if (drillWeek == null) return `<div class="crumb">${lk(1, '一级 · 类别概览')} › 二级 · ${esc(c.name)}（${esc(c.station)}）· 设备维度（机台树）</div>`;
    return `<div class="crumb">${lk(1, '一级')} › ${lk(2, '二级（' + esc(c.name) + '）')} › 三级 · ${D.weeks[drillWeek]} Package 明细</div>`;
  }

  function reqNoteHtml() {
    return `<div class="card mt24">
      <div class="card-head"><div class="card-title">${icon('alert', 19)} 数据口径与需求要点</div></div>
      <div class="card-body">
        <ul style="margin:0;padding-left:18px;line-height:2;font-size:14px;color:var(--text-2)">
          <li><b style="color:var(--primary)">真实数据</b>：客户原始资料 <code>BGA WK2601-2652 PPM Yield trend.xlsx</code> — trend 矩阵(16 类别×52周) + 各周 -M 原始/透视 + -abnormal 明细，本页无任何演示数据。</li>
          <li><b style="color:var(--primary)">PPM 公式</b>：次品数 ÷ IQC Output(ICOS 结料数量) × 100 万；仅统计 IQC 完成品。</li>
          <li><b style="color:var(--primary)">阈值</b>：红线 2000 PPM（良率目标 0.998）/ 预警线 3000 PPM（CWAAY 0.997）。</li>
          <li><b style="color:var(--primary)">最新周</b>：${D.weeks[latestIdx]}（当前）；WW41–WW51 为未来周（无 -M 透视），趋势图仅绘实产周。</li>
          <li><b style="color:var(--primary)">四种展现形式</b>：① 折线趋势（16 类 × 52 周多系列，看走势）② 帕累托图（类别次品贡献排序 + 累计占比 80/20，看「先压哪几类」）③ 小倍数趋势矩阵（一格一类别、各自独立量程，看单类别走势）④ 类别 × 周热力图（看高位点位置）。四者数据同源、点击均下钻同一二级。</li>
          <li><b style="color:var(--primary)">四级钻取</b>：① 类别 PPM 概览（折线 / 帕累托 / 小倍数 / 热力图）→ ② 选中类别 设备维度<b>机台树状图</b>（可切换周，热力图点击会带上所点周）→ ③ <b>点击机台节点</b>进入该机台「机台 × 料号」透视（产出 / 次品数 / PPM + 同料号跨机台反查）→ ④ 末列「<b>操作 · 四级分析</b>」进入该料号的<b>跨机台 PPM 分析页</b>（各机台 PPM / 次品占比 / 与本机差值 / 结论判定）。另可从折线<b>数据点</b>直接下钻至该周 Package 明细（产出 / BE Reject / 良率）。</li>
        </ul>
      </div>
    </div>`;
  }

  function render() {
    const stage = document.getElementById('content');
    const latestPPM = weeklyScopePPM(latestIdx);
    const latestOut = D.output[latestIdx];
    const latestDef = visibleCats().reduce((a, c) => a + (D.counts[c.key][latestIdx] || 0), 0);
    const overCats = visibleCats().filter(c => { const p = catPPM(c.key, latestIdx); return p != null && p >= RED; }).length;
    const br = breaches();

    // KPI
    const kpis = `<div class="stat-strip">
      <div class="si"><div class="si-label">本周总 PPM（${D.weeks[latestIdx]}）</div><div class="si-value" style="color:${statusColor(statusOf(latestPPM))}">${latestPPM == null ? '—' : latestPPM.toFixed(0)}</div></div>
      <div class="si"><div class="si-label">本周总产出</div><div class="si-value">${fmt(latestOut)}</div></div>
      <div class="si"><div class="si-label">本周总次品</div><div class="si-value">${fmt(latestDef)}</div></div>
      <div class="si"><div class="si-label">超阈值类别</div><div class="si-value" style="color:${overCats ? 'var(--danger)' : 'var(--text)'}">${overCats}</div></div>
      <div class="si"><div class="si-label">近52周超2000周数</div><div class="si-value" style="color:${br.length ? 'var(--warn)' : 'var(--success)'}">${br.length}</div></div>
    </div>`;

    const banner = latestPPM != null && latestPPM >= RED
      ? `<div class="notice" style="--nc:var(--danger)"><strong>⚠ 本周总 PPM ${latestPPM.toFixed(0)} 超红线 2000</strong> — 已触发红屏 / 弹窗预警<button class="btn btn-sm" id="alarmBtn" style="margin-left:10px">查看预警清单</button></div>`
      : `<div class="notice" style="--nc:var(--success)">✓ 本周总 PPM ${latestPPM == null ? '—' : latestPPM.toFixed(0)} < 2000（达标，良率 0.998）${br.length ? ` · 近 52 周有 <b>${br.length}</b> 周曾超红线` : ''}<button class="btn btn-sm btn-ghost" id="alarmBtn" style="margin-left:10px">查看预警清单</button></div>`;

    let body = '';
    if (drillCat == null) {
      const chips = visibleCats().map(c => `<label class="legck" data-def="${esc(c.key)}" style="display:inline-flex;align-items:center;gap:6px;padding:4px 11px;border:1px solid ${activeCats.includes(c.key) ? 'var(--primary)' : 'var(--line,#e1e7f0)'};border-radius:999px;cursor:pointer;font-size:12.5px;color:var(--text);user-select:none;background:${activeCats.includes(c.key) ? 'rgba(37,99,235,.07)' : 'transparent'}"><input type="checkbox" ${activeCats.includes(c.key) ? 'checked' : ''} style="accent-color:var(--primary);margin:0;cursor:pointer"><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${catColor(c.key)}"></i>${esc(c.name)}</label>`).join('');
      const scopeTitle = deptFilter === 'ALL' ? '16 类别' : visibleCats().length + ' 类别（' + deptFilter + '）';
      const scopeHint = deptFilter === 'ALL' ? '展示全部 16 类次品（默认）' : deptFilter + ' 部门 · ' + visibleCats().length + ' 类';
      const pa = paretoData();
      const paLabel = PA_RANGES.find(r => r.k === paretoRange).t;
      const paBtns = PA_RANGES.map(r => `<button data-pa="${r.k}" class="${paretoRange === r.k ? 'active' : ''}">${r.t}</button>`).join('');
      body = `<div class="card mt16">
        <div class="card-head">
          <div class="card-title">${icon('layers', 19)} 一级 · BGA Top Defect PPM Trend（${scopeTitle} × 52 周 · 真实数据）</div>
        </div>
        <div class="card-body">
          <div class="dp-scope">
            <span class="dp-scope-lbl">数据范围</span>
            <div class="seg" id="deptSeg">
              <button data-dept="ALL" class="${deptFilter === 'ALL' ? 'active' : ''}">看全部</button>
              <button data-dept="LEAD" class="${deptFilter === 'LEAD' ? 'active' : ''}">LEAD</button>
              <button data-dept="NON-LEAD" class="${deptFilter === 'NON-LEAD' ? 'active' : ''}">NON-LEAD</button>
              <button data-dept="PLATING" class="${deptFilter === 'PLATING' ? 'active' : ''}">PLATING</button>
            </div>
            <span class="dp-scope-hint">${scopeHint}</span>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px" id="defChips">${chips}</div>
          <div class="flex between acenter mt8">
            <div class="flex gap8">
              <button class="chip" id="ckAllBtn">全选</button>
              <button class="chip" id="ckNoneBtn">清空</button>
              <button class="chip ${top5 ? 'active' : ''}" id="top5Btn">Top 5 筛选</button>
            </div>
            <span class="sub-note">点击折线下钻该类别设备维度 · 点击数据点直达该周 Package 明细 · 勾选图例显隐 · 悬停查看二级概要</span>
          </div>
          <div id="procChart"></div>
          <div class="sub-note mt8">纵轴 PPM = 次品数 ÷ IQC Output × 100 万；横轴按时间序仅绘实产周（${D.output.filter(o => o != null).length} 周，WW41–WW51 未来周不显示）；标签标注各线峰值与最新周值。</div>
        </div>
      </div>
      <div class="card mt16">
        <div class="card-head">
          <div class="card-title">${icon('layers', 19)} 一级 · 类别次品贡献帕累托 · 前 N 类压降优先（${scopeTitle} · 真实数据）</div>
          <div class="seg" id="paSeg">${paBtns}</div>
        </div>
        <div class="card-body">
          <div class="flex acenter gap8 flex-wrap" style="margin-bottom:8px">
            <span class="chip">${icon('filter', 14)} 口径 ${paLabel} · ${pa.idxs.length} 个实产周</span>
            ${pa.rows.length ? `<span class="chip">${icon('layers', 14)} 次品合计 <b>${fmt(pa.totN)}</b></span>
            <span class="chip">${icon('alert', 14)} 前 <b>${pa.k80 + 1}</b> 类已覆盖 <b>80%</b> 次品</span>
            <span class="chip">${icon('target', 14)} Top 5 占比 <b>${(pa.totN ? pa.top5n / pa.totN * 100 : 0).toFixed(1)}%</b></span>` : '<span class="chip">当前口径无次品记录</span>'}
            <span class="flex-1"></span><span class="sub-note">点击柱 / 类别名进入该类别二级 · 机台树</span>
          </div>
          <div id="paretoChart"></div>
          <div class="sub-note mt8">柱 = 该类别在所选口径下的<b>次品数</b>（左轴），黑线 = <b>累计占比</b>（右轴 0–100%），紫色虚线为 80% 参考线。用于回答「不良集中在哪几个类别、压哪几个性价比最高」；与上方折线（看趋势）、下方热力图（看类别×周位置）互补。</div>
        </div>
      </div>

      <div class="card mt16">
        <div class="card-head">
          <div class="card-title">${icon('grid', 19)} 一级 · 小倍数趋势矩阵 · 每类一格独立量程（${scopeTitle} × 实产周 · 真实数据）</div>
          <span class="sub-note">红点 = 该类别历史峰值 · 实心点 = 最新实产周 · 淡化格 = 已在图例中取消勾选</span>
        </div>
        <div class="card-body">
          <div id="smChart"></div>
          <div class="sub-note mt8">每格一个类别的迷你趋势（<b>各自独立量程</b>，只比自身高低，适合看单类别走势与突变周）；底部为最新 / 峰值 / 均值 PPM。点击任意小格进入该类别二级 · 机台树。</div>
        </div>
      </div>

      <div class="card mt16">
        <div class="card-head">
          <div class="card-title">${icon('grid', 19)} 一级 · 类别 × 周 PPM 热力图（${scopeTitle} × 52 周 · 真实数据）</div>
        </div>
        <div class="card-body">
          <div id="heatChart"></div>
          <div class="flex acenter gap8 mt10" style="flex-wrap:wrap">${heatLegend()}</div>
          <div class="sub-note mt8">每个色块 = 某类别在某周的 PPM；绿 → 黄 → 橙 → 红 表示 PPM 升高，<b>红框</b>=该类别周 PPM 处于高位（≥400）。蓝色虚线 = 最新周（最右）。<b>点击色块进入该类别的二级 · 机台树</b>（自动带上所点周作为上下文周，不再直接跳三级）。注：类别级 PPM 远低于 2000 总红线，2000 / 3000 红线适用于<b>周合计</b>口径。</div>
        </div>
      </div>`;
    } else if (drillDev == null && drillWeek == null) {
      const c = D.cats.find(x => x.key === drillCat);
      const latestCat = catPPM(drillCat, latestIdx);
      const worst = D.weeks.reduce((a, w, i) => { const p = D.ppm[drillCat][i]; return (p != null && (a.p == null || p > a.p)) ? { w, p } : a; }, { w: '—', p: null });
      const avail = devWeeksAvail();
      if (devWeek == null || !avail.includes(devWeek)) devWeek = avail.length ? avail[avail.length - 1] : latestIdx;
      const hasDev = !!D.device;
      const node = hasDev ? D.device[D.weeks[devWeek]] : null;
      const anyCnt = !!(node && node.cnt && node.cnt[drillCat]);
      const drows = hasDev ? (devRows(drillCat, devWeek) || []) : [];
      const worstDev = drows.find(r => r.out > 0 && r.n > 0);
      const selOpts = avail.map(i => `<option value="${i}"${i === devWeek ? ' selected' : ''}>${weekLabel(i)}</option>`).join('');
      body = `<div class="card mt16">
        <div class="card-head"><div class="card-title">${icon('layers', 19)} 二级 · ${esc(c.name)}（${esc(c.station)}）· 设备维度（机台树）</div></div>
        <div class="card-body">
          <div class="stat-strip" style="margin-bottom:10px">
            <div class="si"><div class="si-label">最新周 PPM</div><div class="si-value" style="color:${statusColor(statusOf(latestCat))}">${latestCat == null ? '—' : latestCat}</div></div>
            <div class="si"><div class="si-label">最差周</div><div class="si-value" style="color:${statusColor(statusOf(worst.p))}">${worst.w}${worst.p != null ? ' (' + worst.p.toFixed(0) + ')' : ''}</div></div>
            <div class="si"><div class="si-label">所选周最差机台</div><div class="si-value" style="font-size:19px">${worstDev ? esc(worstDev.d) + `<span style="font-size:13px;color:var(--danger);margin-left:4px">${Math.round(worstDev.ppm)}</span>` : '—'}</div></div>
            <div class="si"><div class="si-label">所属工序</div><div class="si-value">${esc(c.station)}</div></div>
          </div>
          <div class="flex between acenter" style="margin:4px 0 10px">
            <div class="flex acenter gap8">
              <button class="chip" id="devPrev">‹ 上一周</button>
              <select id="devSel" style="padding:5px 8px;border:1px solid var(--line,#e1e7f0);border-radius:8px;background:#fff;color:var(--text);font-size:13px;cursor:pointer">${selOpts}</select>
              <button class="chip" id="devNext">下一周 ›</button>
            </div>
            <span class="sub-note">机台 = Mold机台 · 料号 = PkgCode · 与客户 -M 透视表同口径</span>
          </div>
          ${!hasDev ? '<div class="notice" style="--nc:var(--danger)">未加载设备维度数据（defect-real-data.js 缺 device 块）。</div>' : `
          <div style="font-weight:700;font-size:14.5px;display:flex;align-items:center;gap:6px;margin:2px 0 4px">${icon('layers', 16)} 机台树状图（${weekLabel(devWeek)}）</div>
          <div id="devChart"></div>
          ${anyCnt ? '' : '<div class="sub-note mt8">本周该类别在 -M 机台明细中无次品记录（各机台 PPM = 0）。</div>'}
          <div class="sub-note mt8">根节点 = 次品类别（本周合计 PPM），子节点 = Mold机台（PPM 越高越红）；<b>点击机台节点进入三级「机台 × 料号」透视</b>。机台级关注口径：≥ ${DEV_RED} 红 / ≥ ${DEV_WARN} 橙（参考客户透视图高亮）。机台后角标：<span style="color:var(--danger);font-weight:700">● 报修</span> = 设备报修系统近 24h 工单数，<span style="color:#2563eb;font-weight:700">● 换模</span> = 模具管理系统近 24h 换模次数，<b>悬停查看具体时间</b>（实时快照，与所选周无关）。</div>`}
        </div>
      </div>`;
    } else if (drillDev != null && drillCode != null) {
      /* 四级 · 料号跨机台 PPM 分析（从三级「同料号跨机台 PPM（反查）」行的操作列点入）
         维度 = 当前料号（PkgCode）在同周 + 同类别下、于各 Mold 机台上的 PPM 表现值。 */
      const c = D.cats.find(x => x.key === drillCat);
      const avail = devWeeksAvail();
      const across = codeAcrossDevs(drillCat, devWeek, drillCode);
      const totOut = across.reduce((a, x) => a + x.out, 0);
      const totN = across.reduce((a, x) => a + x.n, 0);
      const wppm = totOut ? totN / totOut * 1e6 : 0;
      const peak = across[0] || null, low = across.length ? across[across.length - 1] : null;
      const cur = across.find(a => a.d === drillDev) || null;
      const rank = across.findIndex(a => a.d === drillDev);
      const maxP = peak ? peak.ppm : 0;
      const hotN = across.filter(a => a.ppm >= DEV_WARN).length;
      const ratio = (peak && low && low.ppm > 0) ? peak.ppm / low.ppm : null;
      let vText, vColor, vTip;
      if (!across.length) { vText = '无跨机台数据'; vColor = 'var(--text-2)'; vTip = '本周该类别 -M 明细中未检索到该料号的机台记录。'; }
      else if (across.length === 1) { vText = '仅本机台生产'; vColor = 'var(--text-2)'; vTip = '本周只有 1 台机台生产该料号，无法做跨机对比；若 PPM 偏高，建议结合该机台的报修 / 换模记录排查。'; }
      else if (cur && peak && cur.d === peak.d && peak.ppm >= DEV_WARN && hotN <= Math.max(1, Math.ceil(across.length / 3))) {
        vText = '机台特异性'; vColor = 'var(--danger)';
        vTip = '本机台 PPM 为全部机台最高且明显跑赢其余机台 → 不良大概率来自该机台（参数 / 模具 / 保养状态），而非料号本身。建议：查该机台近 24h 报修与换模记录，优先设备侧根因。';
      } else if (hotN >= Math.max(2, Math.ceil(across.length * 0.6))) {
        vText = '料号 / 物料共性'; vColor = 'var(--primary)';
        vTip = '多数机台在该料号上 PPM 都偏高 → 不良更可能来自料号 / 物料批次 / 来料或设计，而非单一机台。建议：查同批次物料、来料检验与工程变更。';
      } else { vText = '跨机平稳'; vColor = 'var(--text)'; vTip = '各机台 PPM 差异不大，未见明显机台聚集，暂不需要机台侧专项排查。'; }
      const selOpts = avail.map(i => `<option value="${i}"${i === devWeek ? ' selected' : ''}>${weekLabel(i)}</option>`).join('');
      const rowsHtml = across.map(a => {
        const isMe = a.d === drillDev;
        const col = a.ppm >= DEV_RED ? 'var(--danger)' : (a.ppm >= DEV_WARN ? 'var(--warn)' : 'var(--text)');
        const share = totN ? a.n / totN * 100 : 0;
        const bw = maxP > 0 ? Math.max(2, a.ppm / maxP * 100) : 0;
        const diffTxt = (cur && !isMe) ? ((a.ppm - cur.ppm >= 0 ? '+' : '') + Math.round(a.ppm - cur.ppm)) : '—';
        const diffCol = (cur && !isMe) ? ((a.ppm - cur.ppm > 0) ? 'var(--danger)' : '#12805a') : 'var(--text-2)';
        return `<tr style="${isMe ? 'background:#fff7e6' : ''}">
          <td style="font-weight:${isMe ? 700 : 400}">${isMe ? '▶ ' : ''}${esc(a.d)}${isMe ? '<span class="muted small" style="margin-left:4px">（本机台）</span>' : ''}</td>
          <td class="num">${fmt(a.out)}</td><td class="num">${fmt(a.n)}</td>
          <td class="num" style="font-weight:700;color:${col}">${Math.round(a.ppm)}</td>
          <td class="num">${share.toFixed(1)}%</td>
          <td class="num" style="color:${diffCol}">${diffTxt}</td>
          <td style="min-width:120px"><div style="display:flex;align-items:center;gap:6px"><div style="flex:1;height:9px;background:#eef2f8;border-radius:5px;overflow:hidden"><div style="width:${bw.toFixed(1)}%;height:100%;background:${col};border-radius:5px"></div></div><span class="muted small" style="width:52px;text-align:right">${Math.round(a.ppm)}</span></div></td>
        </tr>`;
      }).join('');
      body = `<div class="card mt16">
        <div class="card-head"><div class="card-title">${icon('layers', 19)} 四级 · 料号 <span style="color:var(--primary)">${esc(drillCode)}</span> 跨机台 PPM 分析（${weekLabel(devWeek)} · ${esc(c.name)}）</div></div>
        <div class="card-body">
          <div class="stat-strip" style="margin-bottom:10px">
            <div class="si"><div class="si-label">料号加权 PPM</div><div class="si-value" style="color:${wppm >= DEV_RED ? 'var(--danger)' : (wppm >= DEV_WARN ? 'var(--warn)' : 'var(--text)')}">${Math.round(wppm)}</div></div>
            <div class="si"><div class="si-label">涉及机台数</div><div class="si-value">${across.length}</div></div>
            <div class="si"><div class="si-label">最高机台</div><div class="si-value" style="font-size:19px">${peak ? esc(peak.d) + '<span style="font-size:13px;color:var(--danger);margin-left:4px">' + Math.round(peak.ppm) + '</span>' : '—'}</div></div>
            <div class="si"><div class="si-label">最低机台</div><div class="si-value" style="font-size:19px">${low ? esc(low.d) + '<span style="font-size:13px;color:#12805a;margin-left:4px">' + Math.round(low.ppm) + '</span>' : '—'}</div></div>
            <div class="si"><div class="si-label">最高 / 最低 倍数</div><div class="si-value">${ratio ? ratio.toFixed(1) + '×' : '—'}</div></div>
            <div class="si"><div class="si-label">本机台排名</div><div class="si-value">${rank >= 0 ? (rank + 1) + ' / ' + across.length : '—'}</div></div>
          </div>
          <div class="flex acenter gap8" style="margin:4px 0 10px">
            <button class="chip" id="devPrev4">‹ 上一周</button>
            <select id="devSel4" style="padding:5px 8px;border:1px solid var(--line,#e1e7f0);border-radius:8px;background:#fff;color:var(--text);font-size:13px;cursor:pointer">${selOpts}</select>
            <button class="chip" id="devNext4">下一周 ›</button>
            <button class="chip" id="l4Back" style="margin-left:auto">‹ 返回三级（${esc(drillDev)} × 料号透视）</button>
            <span class="sub-note">切换周可对比同一料号的历史跨机台表现</span>
          </div>
          ${across.length ? l4Charts(across, drillDev, totN, wppm) : ''}
          ${across.length ? `<table class="table"><thead><tr><th>机台</th><th class="num">ICOS结料数量</th><th class="num">次品数</th><th class="num">PPM</th><th class="num">占该料号次品</th><th class="num">相对本机</th><th>PPM 对比</th></tr></thead><tbody>${rowsHtml}
            <tr style="background:#eef3fa"><td style="font-weight:700">合计 / 加权</td><td class="num" style="font-weight:700">${fmt(totOut)}</td><td class="num" style="font-weight:700">${fmt(totN)}</td><td class="num" style="font-weight:700">${Math.round(wppm)}</td><td class="num">100.0%</td><td class="num">—</td><td></td></tr>
          </tbody></table>` : '<div class="notice" style="--nc:var(--warn)">本周该类别下未检索到该料号的跨机台记录。</div>'}
          <div class="sub-note mt8" style="border-left:3px solid ${vColor};padding-left:10px">
            <b>分析结论：<span style="color:${vColor}">${vText}</span></b><br>${esc(vTip)}
          </div>
          <div class="sub-note mt8">口径：仅统计<b>本周实际生产过该料号</b>的 Mold 机台（未生产不列入）；PPM = 次品数 ÷ ICOS结料数量 × 100 万；机台级关注线 ≥ ${DEV_RED} 红 / ≥ ${DEV_WARN} 橙。「占该料号次品」= 该机台次品数 ÷ 该料号本周次品总数，用于定位主要贡献机台。<b>表格上方两图与表格同源</b>：左图柱高 = 各机台 PPM（虚线为 ${DEV_WARN} 预警线 / ${DEV_RED} 红线，本机台描边高亮），右图环宽 = 各机台次品数占比（含机台图例），可一眼定位主要贡献机台与离群机台。点击顶部面包屑或「返回三级」回到机台 × 料号透视。</div>
        </div>
      </div>`;
    } else if (drillDev != null) {
      // 三级 · 机台 × 料号 透视（从二级树状图点入）
      const c = D.cats.find(x => x.key === drillCat);
      const avail = devWeeksAvail();
      const all = devRows(drillCat, devWeek) || [];
      const me = all.find(r => r.d === drillDev);
      const codes = devCodes(drillCat, devWeek, drillDev);
      const rank = all.findIndex(r => r.d === drillDev);
      const worstCode = codes[0];
      const selOpts = avail.map(i => `<option value="${i}"${i === devWeek ? ' selected' : ''}>${weekLabel(i)}</option>`).join('');
      const meHot = me && me.ppm != null && me.ppm >= DEV_RED;
      const ev3 = window.DeviceEvents ? DeviceEvents.of(drillDev, Date.now()) : { repair: [], mold: [], nRep: 0, nMold: 0 };
      const repTitle = '设备报修系统 · 近 24h：\n' + (ev3.repair.length ? ev3.repair.map(x => DeviceEvents.hhmm(x.t) + '  ' + x.id + '  ' + x.reason).join('\n') : '无记录');
      const molTitle = '模具管理系统 · 近 24h：\n' + (ev3.mold.length ? ev3.mold.map(x => DeviceEvents.hhmm(x.t) + '  ' + x.id + '  ' + x.from + ' → ' + x.to).join('\n') : '无记录');
      body = `<div class="card mt16">
        <div class="card-head"><div class="card-title">${icon('table', 19)} 三级 · ${esc(drillDev)} × 料号 透视（${weekLabel(devWeek)} · ${esc(c.name)}）</div></div>
        <div class="card-body">
          <div class="stat-strip" style="margin-bottom:10px">
            <div class="si"><div class="si-label">该机台 PPM</div><div class="si-value" style="color:${meHot ? 'var(--danger)' : 'var(--text)'}">${me ? Math.round(me.ppm) : '—'}</div></div>
            <div class="si"><div class="si-label">次品数 / 产出</div><div class="si-value" style="font-size:19px">${me ? fmt(me.n) + ' / ' + fmt(me.out) : '—'}</div></div>
            <div class="si"><div class="si-label">最差料号</div><div class="si-value" style="font-size:19px">${worstCode ? esc(worstCode.c) + `<span style="font-size:13px;margin-left:4px;color:${worstCode.ppm >= DEV_WARN ? 'var(--danger)' : 'var(--text-2)'}">${Math.round(worstCode.ppm)}</span>` : '—'}</div></div>
            <div class="si"><div class="si-label">机台 PPM 排名</div><div class="si-value">${rank >= 0 ? (rank + 1) + ' / ' + all.length : '—'}</div></div>
            <div class="si" title="${esc(repTitle)}"><div class="si-label">近 24h 报修</div><div class="si-value" style="color:${ev3.nRep ? 'var(--danger)' : 'var(--text-2)'}">${ev3.nRep}</div></div>
            <div class="si" title="${esc(molTitle)}"><div class="si-label">近 24h 换模</div><div class="si-value" style="color:${ev3.nMold ? '#2563eb' : 'var(--text-2)'}">${ev3.nMold}</div></div>
          </div>
          <div class="flex acenter gap8" style="margin:4px 0 10px">
            <button class="chip" id="devPrev3">‹ 上一周</button>
            <select id="devSel3" style="padding:5px 8px;border:1px solid var(--line,#e1e7f0);border-radius:8px;background:#fff;color:var(--text);font-size:13px;cursor:pointer">${selOpts}</select>
            <button class="chip" id="devNext3">下一周 ›</button>
            <span class="sub-note">切换周可直接对比同一机台的历史料号构成</span>
          </div>
          ${devPivotTable(drillCat, devWeek, drillDev)}
          <div class="sub-note mt8">与客户 -M 透视表同口径：料号 = PkgCode，PPM = 次品数 ÷ ICOS结料数量 × 100 万；列出该机台本周全部料号（含 0 次品行），≥ ${DEV_WARN} PPM 标红；空 PkgCode 批次不计入。新增「<b>同料号跨机台 PPM（反查）</b>」列：针对每个料号，反查其在<b>同周 + 同类别</b>下、跨全部 Mold 机台的 PPM 分布（悬停看各机台明细）；可判断不良是<b>机台特异性</b>（本机最高）还是<b>料号/物料共性</b>（他机更高）。<b>末列「操作」→「四级分析」</b>可直接进入该料号的<b>跨机台 PPM 分析页</b>（各机台 PPM / 次品占比 / 与本机差值 / 结论判定）。点击顶部面包屑返回二级树状图。</div>
        </div>
      </div>`;
    } else {
      const c = D.cats.find(x => x.key === drillCat);
      body = `<div class="card mt16">
        <div class="card-head"><div class="card-title">${icon('table', 19)} 三级 · ${D.weeks[drillWeek]} Package 明细（上下文：${esc(c.name)}）</div></div>
        <div class="card-body">
          ${abnTable(drillWeek)}
          <div class="sub-note mt12">良率 &lt; 0.998（即 ≥2000 PPM）标红。数据来自该周 -abnormal 明细。点击顶部面包屑可返回。</div>
        </div>
      </div>`;
    }

    stage.innerHTML = kpis + banner + crumbHtml() + body + reqNoteHtml();

    if (drillCat == null) {
      lineChartL1(document.getElementById('procChart'));
      paretoL1(document.getElementById('paretoChart'));
      smallMultiples(document.getElementById('smChart'));
      heatmapL1(document.getElementById('heatChart'), visibleCats());
    }
    else if (drillDev == null && drillWeek == null) {
      if (D.device) devTreeChart(document.getElementById('devChart'), drillCat, devWeek);
    }

    stage.querySelectorAll('#defChips .legck input').forEach(cb => {
      cb.onchange = () => {
        const k = cb.closest('.legck').dataset.def;
        if (cb.checked) { if (!activeCats.includes(k)) activeCats = [...activeCats, k]; }
        else activeCats = activeCats.filter(x => x !== k);
        render();
      };
    });
    const ckA = stage.querySelector('#ckAllBtn'); if (ckA) ckA.onclick = () => { activeCats = visibleCats().map(c => c.key); render(); };
    const ckN = stage.querySelector('#ckNoneBtn'); if (ckN) ckN.onclick = () => { activeCats = []; render(); };
    const ds = stage.querySelector('#deptSeg'); if (ds) ds.querySelectorAll('button').forEach(b => { b.onclick = () => setDeptFilter(b.dataset.dept); });
    const ps = stage.querySelector('#paSeg'); if (ps) ps.querySelectorAll('button').forEach(b => { b.onclick = () => { paretoRange = b.dataset.pa; store.set('defect_pareto', paretoRange); render(); }; });
    stage.querySelectorAll('[data-l4]').forEach(b => { b.onclick = () => { drillCode = b.dataset.l4; drillDev = b.dataset.l4dev || drillDev; render(); }; });
    const b4 = stage.querySelector('#l4Back'); if (b4) b4.onclick = () => { drillCode = null; render(); };
    [['#devSel', '#devPrev', '#devNext'], ['#devSel3', '#devPrev3', '#devNext3'], ['#devSel4', '#devPrev4', '#devNext4']].forEach(([sid, pid, nid]) => {
      const dsel = stage.querySelector(sid);
      if (!dsel) return;
      dsel.value = String(devWeek);
      dsel.onchange = () => { devWeek = +dsel.value; render(); };
      const avail = devWeeksAvail(), cur = avail.indexOf(devWeek);
      const pv = stage.querySelector(pid), nx = stage.querySelector(nid);
      if (pv) { pv.onclick = () => { if (cur > 0) { devWeek = avail[cur - 1]; render(); } }; pv.style.opacity = cur > 0 ? 1 : 0.45; }
      if (nx) { nx.onclick = () => { if (cur < avail.length - 1) { devWeek = avail[cur + 1]; render(); } }; nx.style.opacity = cur < avail.length - 1 ? 1 : 0.45; }
    });
    const t5 = stage.querySelector('#top5Btn'); if (t5) t5.onclick = () => { top5 = !top5; render(); };
    stage.querySelectorAll('.crumb .lk').forEach(l => { l.onclick = () => {
      const g = +l.dataset.go;
      if (g === 1) { drillCat = null; drillWeek = null; drillDev = null; drillCode = null; }
      else if (g === 2) { drillWeek = null; drillDev = null; drillCode = null; }
      else { drillWeek = null; drillCode = null; } // 回到三级（保留机台）
      render();
    }; });
    const ab = stage.querySelector('#alarmBtn'); if (ab) ab.onclick = () => openAlarm(br);
  }

  function openAlarm(br) {
    let mask = document.getElementById('defectAlarmMask');
    if (!mask) {
      mask = document.createElement('div');
      mask.id = 'defectAlarmMask';
      mask.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.5);display:none;align-items:center;justify-content:center;z-index:80';
      mask.innerHTML = `<div style="background:#fff;border:1px solid var(--line,#e1e7f0);border-radius:14px;width:min(520px,92vw);max-height:80vh;overflow:auto;padding:18px">
        <div class="flex between acenter" style="font-weight:700;margin-bottom:12px"><span>PPM 超红线（≥2000）预警清单</span><button id="defectAlarmClose" style="border:0;background:#eef2f8;color:#1d2836;font-size:18px;width:28px;height:28px;border-radius:8px;cursor:pointer">×</button></div>
        <div id="defectAlarmBody"></div></div>`;
      document.body.appendChild(mask);
      mask.addEventListener('click', e => { if (e.target === mask) mask.style.display = 'none'; });
      mask.querySelector('#defectAlarmClose').onclick = () => { mask.style.display = 'none'; };
    }
    mask.querySelector('#defectAlarmBody').innerHTML = br.length
      ? br.map(a => `<div style="display:flex;justify-content:space-between;padding:8px 10px;border-radius:8px;margin-bottom:6px;font-size:13px;background:#f7f9fc"><span>周 ${esc(a.w)}</span><span style="color:var(--danger);font-weight:700">${a.p.toFixed(0)} PPM</span></div>`).join('')
      : '<div style="padding:8px 10px;font-size:13px;background:#f7f9fc;border-radius:8px">近 52 周总 PPM 均未突破红线 2000，良率达标。</div>';
    mask.style.display = 'flex';
  }

  render();
})();
