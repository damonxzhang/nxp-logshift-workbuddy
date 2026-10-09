/* ============ 次品管理 · 质量预警（整体原型设计方案中的一个独立模块） ============
   数据来源：客户原始资料 BGA WK2601-2652 PPM Yield trend.xlsx
     - trend 矩阵：16 次品类别 × 52 周(WW40'26→WW39'26) 真实计数
     - WW40'26-M 等：每周 ICOS 结料数量汇总 = IQC Output（PPM 分母）
     - WWxx'26-M 原始明细：设备(Mold机台) × 料号(PkgCode) 产出与各缺陷代码计数 → 设备维度
     - WW40'26-abnormal 等：各周 Package 级 产出 / BE Reject / 良率
   三级钻取：一级 类别×52周 多系列 PPM 趋势(对齐客户 trend 图形态) → 二级 选中类别 设备维度机台树状图(根=类别,子节点=机台,可切换周) → 三级 点机台节点进入「机台×料号」透视(参考客户 -M 透视表) / 点趋势点进入该周 Package 明细
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
  let activeCats = D.cats.map(c => c.key); // 自定义勾选的次品项

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
    el.querySelectorAll('.dnode').forEach(g => { g.onclick = () => { drillDev = g.dataset.d; drillWeek = null; render(); }; });
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

  function devPivotTable(catKey, weekIdx, onlyDev) {
    const all = devRows(catKey, weekIdx);
    if (!all) return '';
    const rows = onlyDev ? all.filter(r => r.d === onlyDev) : all;
    let html = `<table class="table"><thead><tr><th>机台 / 料号（PkgCode）</th><th class="num">ICOS结料数量</th><th class="num">次品数</th><th class="num">PPM</th></tr></thead><tbody>`;
    rows.forEach(r => {
      const dred = r.ppm != null && r.ppm >= DEV_RED;
      html += `<tr style="background:#f4f7fb"><td style="font-weight:700">${esc(r.d)}</td><td class="num" style="font-weight:700">${fmt(r.out)}</td><td class="num" style="font-weight:700">${fmt(r.n)}</td>` +
        `<td class="num" style="font-weight:700;${dred ? 'color:var(--danger)' : ''}">${r.ppm == null ? '—' : Math.round(r.ppm)}</td></tr>`;
      const cs = onlyDev ? devCodes(catKey, weekIdx, r.d) : r.subs;
      cs.forEach(sb => {
        const sred = sb.ppm >= DEV_WARN, zero = !sb.n;
        html += `<tr><td style="padding-left:26px;${zero ? 'color:var(--text-2)' : ''}">└ ${esc(sb.c)}</td><td class="num" style="${zero ? 'color:var(--text-2)' : ''}">${fmt(sb.out)}</td><td class="num">${fmt(sb.n)}</td>` +
          `<td class="num" style="${sred ? 'color:var(--danger);font-weight:700' : ''}">${Math.round(sb.ppm)}</td></tr>`;
      });
    });
    if (!onlyDev) {
      const tout = rows.reduce((a, r) => a + r.out, 0), tn = rows.reduce((a, r) => a + r.n, 0);
      html += `<tr style="background:#eef3fa"><td style="font-weight:700">合计</td><td class="num" style="font-weight:700">${fmt(tout)}</td><td class="num" style="font-weight:700">${fmt(tn)}</td><td class="num" style="font-weight:700">${tout ? Math.round(tn / tout * 1e6) : '—'}</td></tr>`;
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
    if (drillDev != null) return `<div class="crumb">${lk(1, '一级')} › ${lk(2, '二级（' + esc(c.name) + '）')} › 三级 · ${esc(drillDev)} × 料号 透视（${weekLabel(devWeek)}）</div>`;
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
          <li><b style="color:var(--primary)">三级钻取</b>：类别 PPM 概览 → 选中类别 设备维度<b>机台树状图</b>（可切换周）→ <b>点击机台节点</b>进入该机台「机台 × 料号」透视（产出 / 次品数 / PPM）；另可从趋势数据点下钻至该周 Package 明细（产出 / BE Reject / 良率）。</li>
        </ul>
      </div>
    </div>`;
  }

  function render() {
    const stage = document.getElementById('content');
    const latestPPM = weeklyTotalPPM(latestIdx);
    const latestOut = D.output[latestIdx];
    const latestDef = D.cats.reduce((a, c) => a + (D.counts[c.key][latestIdx] || 0), 0);
    const overCats = D.cats.filter(c => { const p = catPPM(c.key, latestIdx); return p != null && p >= RED; }).length;
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
      const chips = D.cats.map(c => `<label class="legck" data-def="${esc(c.key)}" style="display:inline-flex;align-items:center;gap:6px;padding:4px 11px;border:1px solid ${activeCats.includes(c.key) ? 'var(--primary)' : 'var(--line,#e1e7f0)'};border-radius:999px;cursor:pointer;font-size:12.5px;color:var(--text);user-select:none;background:${activeCats.includes(c.key) ? 'rgba(37,99,235,.07)' : 'transparent'}"><input type="checkbox" ${activeCats.includes(c.key) ? 'checked' : ''} style="accent-color:var(--primary);margin:0;cursor:pointer"><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${catColor(c.key)}"></i>${esc(c.name)}</label>`).join('');
      body = `<div class="card mt16">
        <div class="card-head">
          <div class="card-title">${icon('layers', 19)} 一级 · BGA Top Defect PPM Trend（16 类别 × 52 周 · 真实数据）</div>
        </div>
        <div class="card-body">
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
          <div class="sub-note mt8">与客户 -M 透视表同口径：料号 = PkgCode，PPM = 次品数 ÷ ICOS结料数量 × 100 万；列出该机台本周全部料号（含 0 次品行），≥ ${DEV_WARN} PPM 标红；空 PkgCode 批次不计入。点击顶部面包屑返回二级树状图。</div>
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

    if (drillCat == null) lineChartL1(document.getElementById('procChart'));
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
    const ckA = stage.querySelector('#ckAllBtn'); if (ckA) ckA.onclick = () => { activeCats = D.cats.map(c => c.key); render(); };
    const ckN = stage.querySelector('#ckNoneBtn'); if (ckN) ckN.onclick = () => { activeCats = []; render(); };
    [['#devSel', '#devPrev', '#devNext'], ['#devSel3', '#devPrev3', '#devNext3']].forEach(([sid, pid, nid]) => {
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
    stage.querySelectorAll('.crumb .lk').forEach(l => { l.onclick = () => { const g = +l.dataset.go; if (g === 1) { drillCat = null; drillWeek = null; drillDev = null; } else { drillWeek = null; drillDev = null; } render(); }; });
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
