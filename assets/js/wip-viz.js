/* ============ WIP 动态可视化 · 备选展示方案（真实数据驱动） ============
   一个方案 = 一种「把在制数据讲清楚」的动效图表，全部基于客户 IT 报表的真实明细（813 批）。
   由 page-wip.js 调用：
     WipViz.html(ctx)        → 返回 HTML 片段
     WipViz.animate(host,ctx)→ 启动入场动效 + 交互绑定
   ctx：
     scheme     当前方案 key（A~E 或 ALL 全部对比）
     rows       在制明细（已按品类筛选）
     steps      工序聚合（按在制量降序，含 qty/val/lots/hold/otd/byType）
     stepsOrder 工序聚合（按报表工艺顺序）
     types      参与统计的 PKG Type
     unitLabel() / valOf(qty,type) / fmtVal(v)   口径换算与格式化
     typeColor / typeName / alarm{ctY,ctR,otd}
     openDrawer(step)  点击进入二级筛选 */
(function () {
  const SCHEMES = {
    A: {
      name: '环形仪表盘', icon: 'activity',
      desc: '每个工序一个进度环：环长 = 该工序在制量占最大工序的比重，环色 = 该工序的主导品类；有 Hold / OTD 逾期的工序环体会脉冲提醒。适合做「工序水位」总览。'
    },
    B: {
      name: '工序 → 品类 流向', icon: 'arrowRight',
      desc: '桑基流向图：左列按报表工艺顺序排列工序，右列为 PKG Type，飘带宽度 = 在制量，带上流动虚线指示流向。一眼看出「哪些工序压着哪类产品、量大在哪一段」。'
    },
    C: {
      name: 'CT 气泡象限', icon: 'target',
      desc: '每个在制批次一个气泡：横轴 BE CT（天）、纵轴在制数量（对数轴）、气泡大小 = 数量、颜色 = 品类；背景黄/红竖带为 CT 报警阈值，右上方「又慢又多」的批次最该先处理。'
    },
    D: {
      name: '批次点阵', icon: 'grid',
      desc: '一个方块 = 一个在制批次，按工序分行排布，颜色 = 品类；入场按行列波纹点亮，CT 超红 / OTD 逾期 / Hold 的方块描边脉冲。适合看「批次粒度」的积压与异常分布。'
    },
    E: {
      name: '极坐标弧', icon: 'zap',
      desc: '中心甜甜圈 = 各品类在制占比，外圈每根弧柱 = 一个工序（长度 = 在制量，颜色 = 主导品类），依次旋转生长。适合大屏远距离观看的「一屏看懂」。'
    }
  };
  const ORDER = ['A', 'B', 'C', 'D', 'E'];

  /* ---------------- 通用工具 ---------------- */
  const num = (v, d) => (v == null ? '—' : (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('en-US') : v.toFixed(d == null ? 1 : d)));

  function domType(byType) {
    let best = null, bv = -1;
    Object.keys(byType || {}).forEach(t => { if (byType[t] > bv) { bv = byType[t]; best = t; } });
    return best;
  }
  function typeTotals(steps) {
    const m = {};
    steps.forEach(s => Object.keys(s.byType).forEach(t => { m[t] = (m[t] || 0) + s.byType[t]; }));
    return m;
  }
  /* 把一组数值按总量分摊到固定高度内（每个至少 minH，自动压缩防溢出） */
  function bandHeights(vals, H, minH, gap) {
    const n = vals.length || 1;
    const avail = Math.max(0, H - (n - 1) * gap - n * minH);
    const total = vals.reduce((a, b) => a + b, 0) || 1;
    let hs = vals.map(v => minH + (v / total) * avail);
    const sum = hs.reduce((a, b) => a + b, 0);
    if (sum > H) hs = hs.map(h => h * H / sum);
    return hs;
  }
  function roll(el, target, dec) {
    if (!el) return;
    const t0 = performance.now(), dur = 900;
    (function step(t) {
      const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = num(target * e, dec == null ? 1 : dec);
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }

  /* =====================================================================
     方案 A · 环形仪表盘阵列
     ===================================================================== */
  function blockA(ctx) {
    const steps = ctx.steps, u = ctx.unitLabel();
    const max = Math.max(1e-9, ...steps.map(s => s.qty));
    const CIRC = 2 * Math.PI * 38;
    const items = steps.map((s, i) => {
      const dom = domType(s.byType) || 'BGA';
      const col = ctx.typeColor[dom] || '#1d4ed8';
      const ratio = 0.1 + 0.9 * (s.qty / max);
      const bad = s.hold > 0, warn = !bad && s.otd > 0;
      const v = ctx.valOf(s.qty, dom);
      return `<div class="vz-ring ${bad ? 'is-bad' : (warn ? 'is-warn' : '')}" data-step="${esc(s.step)}"
        title="${esc(s.step)}：在制 ${ctx.fmtVal(v)}${u} · ${s.lots} 批${bad ? ' · Hold ' + s.hold + ' 批' : ''}${warn ? ' · OTD 逾期 ' + s.otd + ' 批' : ''}">
        <svg viewBox="0 0 100 100" class="vz-ring-svg">
          <circle cx="50" cy="50" r="38" fill="none" stroke="var(--surface-3)" stroke-width="9"/>
          <circle class="vz-arc" cx="50" cy="50" r="38" fill="none" stroke="${col}" stroke-width="9"
            stroke-linecap="round" stroke-dasharray="${CIRC.toFixed(1)}" stroke-dashoffset="${CIRC.toFixed(1)}"
            data-off="${(CIRC * (1 - ratio)).toFixed(1)}" transform="rotate(-90 50 50)"
            style="transition:stroke-dashoffset 1.15s cubic-bezier(.2,.75,.3,1) ${(i * 0.045).toFixed(2)}s"></circle>
        </svg>
        <div class="vz-ring-center"><b data-num="${v}">0</b><span>${u}</span></div>
        <div class="vz-ring-name">${esc(s.step)}</div>
        <div class="vz-ring-meta">${s.lots} 批${bad ? ` · <em>Hold ${s.hold}</em>` : (warn ? ` · <em>OTD ${s.otd}</em>` : '')}</div>
      </div>`;
    }).join('');
    return `<div class="vz-rings">${items}</div>
      <div class="vz-legend">
        <span><i class="vz-lg-dot" style="background:#1d4ed8"></i>环色 = 主导品类（BGA / LGA / QFN / PQFN / FCCSP）</span>
        <span><i class="vz-lg-ring"></i>环长 = 在制量占最大工序的比重</span>
        <span><i class="vz-lg-dot" style="background:var(--danger)"></i>环体脉冲 = 该工序有 Hold / OTD 逾期</span>
      </div>`;
  }

  /* =====================================================================
     方案 B · 工序 → 品类 流向（桑基）
     ===================================================================== */
  function blockB(ctx) {
    const W = 980, H = 660, padT = 34, padB = 30, gap = 5, minH = 12;
    const steps = ctx.stepsOrder, types = ctx.types;
    const availH = H - padT - padB;
    const hs = bandHeights(steps.map(s => s.qty), availH, minH, gap);
    const tt = typeTotals(steps);
    const ths = bandHeights(types.map(t => tt[t] || 0), availH, minH, gap);
    const LX = 178, NW = 14, RX = 806;
    const mid = (LX + NW + RX) / 2;

    let ly = padT, ry = padT, k = 0;
    const lSeg = steps.map((s, i) => { const o = { s, y0: ly, y1: ly + hs[i], cur: ly }; ly += hs[i] + gap; return o; });
    const rSeg = {};
    types.forEach((t, i) => { rSeg[t] = { t, y0: ry, y1: ry + ths[i], h: ths[i], cur: ry, tot: tt[t] || 0 }; ry += ths[i] + gap; });

    const ribs = [], dashes = [], nodes = [];
    lSeg.forEach(l => {
      const selSum = types.reduce((a, t) => a + (l.s.byType[t] || 0), 0) || 1;
      const span = l.y1 - l.y0;
      types.forEach(t => {
        const q = l.s.byType[t] || 0; if (!q) return;
        const r = rSeg[t];
        const h = span * q / selSum;
        const h2 = r.tot ? r.h * q / r.tot : 0;
        const y0 = l.cur, yy0 = r.cur;
        l.cur += h; r.cur += h2;
        if (h < 0.8 && h2 < 0.8) return;
        const c = ctx.typeColor[t] || '#64748b';
        const d = `M${LX + NW},${y0.toFixed(1)} C${mid},${y0.toFixed(1)} ${mid},${yy0.toFixed(1)} ${RX},${yy0.toFixed(1)}`
          + ` L${RX},${(yy0 + h2).toFixed(1)} C${mid},${(yy0 + h2).toFixed(1)} ${mid},${(y0 + h).toFixed(1)} ${LX + NW},${(y0 + h).toFixed(1)} Z`;
        ribs.push(`<path class="vz-fl-rib" d="${d}" fill="${c}" opacity=".3" style="animation-delay:${(k++ * 0.02).toFixed(2)}s"></path>`);
        if (Math.min(h, h2) >= 5) {
          const yc = y0 + h / 2, yyc = yy0 + h2 / 2;
          dashes.push(`<path class="vz-fl-dash" d="M${LX + NW},${yc.toFixed(1)} C${mid},${yc.toFixed(1)} ${mid},${yyc.toFixed(1)} ${RX},${yyc.toFixed(1)}" fill="none" stroke="${c}" stroke-width="1.5" opacity=".9"></path>`);
        }
      });
    });
    lSeg.forEach((l, i) => {
      const s = l.s, h = l.y1 - l.y0, yc = l.y0 + h / 2 + 3.8;
      const dom = domType(s.byType) || 'BGA';
      const bad = s.hold > 0 || s.otd > 0;
      nodes.push(`<g class="vz-fl-node" data-step="${esc(s.step)}" style="animation-delay:${(i * 0.02).toFixed(2)}s">
        <rect x="${LX}" y="${l.y0.toFixed(1)}" width="${NW}" height="${h.toFixed(1)}" rx="4"
          fill="${ctx.typeColor[dom] || '#1d4ed8'}" ${bad ? 'stroke="#cc2f2a" stroke-width="1.4"' : ''}></rect>
        <text class="vz-fl-n" x="${LX - 12}" y="${yc.toFixed(1)}" text-anchor="end">${esc(s.step)}<tspan class="vz-fl-v" dx="7">${ctx.fmtVal(ctx.valOf(s.qty, dom))}${ctx.unitLabel()}</tspan></text>
      </g>`);
    });
    types.forEach(t => {
      const r = rSeg[t], h = r.y1 - r.y0, yc = r.y0 + h / 2 + 3.8;
      nodes.push(`<g class="vz-fl-node">
        <rect x="${RX}" y="${r.y0.toFixed(1)}" width="${NW}" height="${h.toFixed(1)}" rx="4" fill="${ctx.typeColor[t] || '#64748b'}"></rect>
        <text class="vz-fl-n" x="${RX + NW + 12}" y="${yc.toFixed(1)}" text-anchor="start" style="fill:${ctx.typeColor[t] || ''}">${esc(ctx.typeName(t))}<tspan class="vz-fl-v" dx="7">${ctx.fmtVal(ctx.valOf(r.tot, t))}${ctx.unitLabel()}</tspan></text>
      </g>`);
    });

    return `<svg class="vz-flow" viewBox="0 0 ${W} ${H}" role="img" aria-label="工序到 PKG Type 的在制流向">
      <text class="vz-fl-hd" x="${LX - 12}" y="18" text-anchor="end">工序（报表工艺顺序 · ${steps.length} 个）</text>
      <text class="vz-fl-hd" x="${RX + NW + 12}" y="18" text-anchor="start">PKG Type（${types.length} 类）</text>
      ${ribs.join('')}${dashes.join('')}${nodes.join('')}
      <text class="vz-fl-hd" x="${mid}" y="${H - 10}" text-anchor="middle">流向：工序级在制 → 品类归属（飘带宽度 = 在制量 · 流动虚线指示方向）</text>
    </svg>
    <div class="vz-legend">
      ${types.map(t => `<span><i class="vz-lg-dot" style="background:${ctx.typeColor[t] || '#64748b'}"></i>${esc(ctx.typeName(t))} ${ctx.fmtVal(ctx.valOf(tt[t] || 0, t))}${ctx.unitLabel()}</span>`).join('')}
      <span><i class="vz-lg-outline"></i>红框工序 = 存在 Hold / OTD 逾期</span>
    </div>`;
  }

  /* =====================================================================
     方案 C · CT × 数量 气泡象限
     ===================================================================== */
  function blockC(ctx) {
    const W = 980, H = 480, padL = 74, padR = 26, padT = 26, padB = 52;
    const pts = ctx.rows.filter(r => r[10] != null);
    if (!pts.length) return '<div class="small muted">当前筛选下没有 BE CT 数据。</div>';
    const ctMaxRaw = Math.max(ctx.alarm.ctR * 1.6, ...pts.map(r => r[10]));
    const ctMax = Math.max(10, Math.ceil(ctMaxRaw / 10) * 10);
    const qMax = Math.max(...pts.map(r => r[7]));
    const l0 = Math.log10(10), l1 = Math.log10(qMax);
    const X = ct => padL + ct / ctMax * (W - padL - padR);
    const Y = q => H - padB - (Math.log10(Math.max(10, q)) - l0) / (l1 - l0 || 1) * (H - padT - padB);
    const R = q => 2.1 + Math.sqrt(q / qMax) * 6.2;

    /* 报警带 */
    const bandY = padT, bandH = H - padT - padB;
    const bands = [];
    bands.push(`<rect x="${X(0).toFixed(1)}" y="${bandY}" width="${(X(ctx.alarm.ctY) - X(0)).toFixed(1)}" height="${bandH}" fill="#12805a" opacity=".05"></rect>`);
    bands.push(`<rect class="vz-band-y" x="${X(ctx.alarm.ctY).toFixed(1)}" y="${bandY}" width="${Math.max(0, X(ctx.alarm.ctR) - X(ctx.alarm.ctY)).toFixed(1)}" height="${bandH}" fill="#a8620b" opacity=".11"></rect>`);
    bands.push(`<rect class="vz-band-r" x="${X(ctx.alarm.ctR).toFixed(1)}" y="${bandY}" width="${Math.max(0, X(ctMax) - X(ctx.alarm.ctR)).toFixed(1)}" height="${bandH}" fill="#cc2f2a" opacity=".13"></rect>`);
    [ctx.alarm.ctY, ctx.alarm.ctR].forEach((v, i) => {
      bands.push(`<line x1="${X(v).toFixed(1)}" y1="${bandY}" x2="${X(v).toFixed(1)}" y2="${bandY + bandH}" stroke="${i ? '#cc2f2a' : '#a8620b'}" stroke-width="1.2" stroke-dasharray="5 5"></line>`);
      bands.push(`<text class="vz-axis" x="${X(v).toFixed(1)}" y="${bandY + 13}" text-anchor="middle" style="fill:${i ? '#cc2f2a' : '#a8620b'}">CT ${i ? '红' : '黄'}线 ${v} 天</text>`);
    });
    /* 网格与坐标 */
    const ticksX = [];
    for (let v = 0; v <= ctMax; v += ctMax / 6) ticksX.push(v);
    const grid = ticksX.map(v => `<line x1="${X(v).toFixed(1)}" y1="${bandY}" x2="${X(v).toFixed(1)}" y2="${bandY + bandH}" stroke="var(--border)" stroke-width="1"></line>
      <text class="vz-axis" x="${X(v).toFixed(1)}" y="${bandY + bandH + 18}" text-anchor="middle">${Math.round(v)}</text>`).join('');
    const yTicks = [10, 100, 1000, 10000].filter(v => v <= qMax).map(v => `<line x1="${padL}" y1="${Y(v).toFixed(1)}" x2="${W - padR}" y2="${Y(v).toFixed(1)}" stroke="var(--border)" stroke-width="1"></line>
      <text class="vz-axis" x="${padL - 10}" y="${(Y(v) + 3.6).toFixed(1)}" text-anchor="end">${v >= 1000 ? v / 1000 + 'K' : v}</text>`).join('');

    /* 气泡（小的画在上层，避免被大泡盖住） */
    const sorted = pts.slice().sort((a, b) => b[7] - a[7]);
    const bubs = sorted.map((r, i) => {
      const c = ctx.typeColor[r[1]] || '#64748b';
      const ct = r[10], q = r[7], r0 = R(q);
      const bad = ct >= ctx.alarm.ctR || (r[12] != null && r[12] < 0);
      const warn = !bad && ct >= ctx.alarm.ctY;
      const delay = (i / sorted.length * 0.5).toFixed(2);
      return `<circle class="vz-bub ${bad ? 'al' : (warn ? 'ay' : '')}" cx="${X(ct).toFixed(1)}" cy="${Y(q).toFixed(1)}" r="${r0.toFixed(2)}"
        fill="${c}" fill-opacity=".55" stroke="${c}" stroke-width=".9"
        style="animation-delay:${delay}s"
        data-step="${esc(r[0])}" data-lot="${esc(r[6])}" data-type="${esc(r[1])}" data-ct="${ct}" data-qty="${q}"
        data-otd="${r[12] == null ? '' : r[12]}" data-hold="${r[13]}"></circle>`;
    }).join('');

    return `<svg class="vz-flow vz-bubwrap" viewBox="0 0 ${W} ${H}" role="img" aria-label="BE CT 与在制数量的气泡分布">
      ${bands.join('')}${grid}${yTicks}
      ${bubs}
      <text class="vz-axis-ttl" x="${(padL + W - padR) / 2}" y="${H - 8}" text-anchor="middle">BE CT（天）→ 越靠右在制越久</text>
      <text class="vz-axis-ttl" x="16" y="${padT - 8}" text-anchor="start">数量（颗 · 对数）</text>
    </svg>
    <div class="vz-legend">
      ${ctx.types.map(t => `<span><i class="vz-lg-dot" style="background:${ctx.typeColor[t] || '#64748b'}"></i>${esc(ctx.typeName(t))}</span>`).join('')}
      <span><i class="vz-lg-dot" style="background:#a8620b"></i>黄圈 = CT 临界（≥ ${ctx.alarm.ctY} 天）</span>
      <span><i class="vz-lg-dot" style="background:#cc2f2a"></i>红圈脉冲 = CT 超红 / OTD 逾期</span>
      <span>气泡大小 = 批次数量 · 共 ${pts.length} 个批次气泡</span>
    </div>`;
  }

  /* =====================================================================
     方案 D · 批次点阵
     ===================================================================== */
  function blockD(ctx) {
    const COLS = 34;
    const lines = ctx.steps.map((s, si) => {
      const list = ctx.rows.filter(r => r[0] === s.step);
      if (!list.length) return '';
      const dots = list.map((r, i) => {
        const col = Math.round(i % COLS), row = Math.floor(i / COLS);
        const c = ctx.typeColor[r[1]] || '#64748b';
        const ct = r[10], otd = r[12];
        const bad = (ct != null && ct >= ctx.alarm.ctR) || (otd != null && otd < 0);
        const warn = !bad && ct != null && ct >= ctx.alarm.ctY;
        const hold = r[13] > 0;
        const d = ((row + col) * 0.012 + si * 0.05).toFixed(2);
        const tip = `${r[0]} · ${ctx.typeName(r[1])} · 批次 ${r[6]}｜${r[7].toLocaleString('en-US')} 颗`
          + `｜BE CT ${ct == null ? '—' : ct.toFixed(1)} 天｜OTD 余量 ${otd == null ? '—' : otd.toFixed(1)} 天`
          + `${hold ? '｜Hold ' + r[13] + ' 天' : ''}${bad ? '｜⚠ 触发报警' : (warn ? '｜CT 临界' : '')}`;
        return `<i class="vz-dot ${bad ? 'is-bad' : (warn ? 'is-warn' : '')} ${hold ? 'is-hold' : ''}"
          style="background:${c};--d:${d}s" data-step="${esc(r[0])}" data-lot="${esc(r[6])}" title="${esc(tip)}"></i>`;
      }).join('');
      return `<div class="vz-dot-line" data-step="${esc(s.step)}">
        <div class="vz-dot-name"><b>${esc(s.step)}</b><small>${ctx.fmtVal(ctx.valOf(s.qty, domType(s.byType) || 'BGA'))}${ctx.unitLabel()} · ${s.lots} 批${s.hold ? ` · <em>Hold ${s.hold}</em>` : ''}</small></div>
        <div class="vz-dot-grid" style="--cols:${COLS}">${dots}</div>
      </div>`;
    }).join('');
    return `<div class="vz-dots">${lines}</div>
      <div class="vz-legend">
        <span>一个方块 = 一个在制批次 · 共 ${ctx.rows.length} 批</span>
        <span><i class="vz-lg-dot" style="box-shadow:0 0 0 1.5px rgba(168,98,11,.75)"></i>CT 临界</span>
        <span><i class="vz-lg-dot" style="box-shadow:0 0 0 1.5px rgba(204,47,42,.9)"></i>CT 超红 / OTD 逾期（脉冲）</span>
        <span><i class="vz-lg-dot" style="outline:1.5px dashed var(--danger);outline-offset:1px"></i>Hold 批次</span>
      </div>`;
  }

  /* =====================================================================
     方案 E · 极坐标弧（中心甜甜圈 + 外圈工序径向柱）
     ===================================================================== */
  function blockE(ctx) {
    const W = 800, H = 660, cx = 400, cy = 322;
    const R0 = 124, maxLen = 112, donutR = 96, donutW = 26;
    const steps = ctx.stepsOrder, types = ctx.types;
    const tt = typeTotals(steps);
    const grand = steps.reduce((a, s) => a + s.qty, 0) || 1;
    const DC = 2 * Math.PI * donutR;
    const maxQ = Math.max(1e-9, ...steps.map(s => s.qty));

    /* 中心甜甜圈：品类占比 */
    let acc = 0;
    const arcs = types.map((t, i) => {
      const share = (tt[t] || 0) / grand;
      const len = share * DC, off = -acc; acc += len;
      const c = ctx.typeColor[t] || '#64748b';
      return `<circle class="vz-darc" cx="${cx}" cy="${cy}" r="${donutR}" fill="none" stroke="${c}" stroke-width="${donutW}"
        stroke-dasharray="0 ${DC.toFixed(1)}" data-da="${len.toFixed(1)} ${(DC - len).toFixed(1)}"
        stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 ${cx} ${cy})"
        style="transition:stroke-dasharray .95s cubic-bezier(.2,.75,.3,1) ${(i * 0.12).toFixed(2)}s"
        data-type="${esc(t)}" data-share="${(share * 100).toFixed(1)}"></circle>`;
    }).join('');

    /* 外圈径向柱 */
    const n = steps.length, ang = 360 / n;
    const bars = steps.map((s, i) => {
      const a = -90 - ang / 2 + i * ang;
      const dom = domType(s.byType) || 'BGA';
      const col = ctx.typeColor[dom] || '#1d4ed8';
      const len = 16 + (s.qty / maxQ) * maxLen;
      /* 弧柱方向：初始朝上（极角 -90°），顺时针旋转 a → 极角 = a - 90° */
      const rad = (a - 90) * Math.PI / 180;
      const lx = cx + Math.cos(rad) * (R0 + maxLen + 22);
      const ly = cy + Math.sin(rad) * (R0 + maxLen + 22) + 3.6;
      const anchor = Math.cos(rad) > 0.22 ? 'start' : (Math.cos(rad) < -0.22 ? 'end' : 'middle');
      const bad = s.hold > 0 || s.otd > 0;
      return `<g class="vz-pbar-g" data-step="${esc(s.step)}" title="${esc(s.step)}：在制 ${ctx.fmtVal(ctx.valOf(s.qty, dom))}${ctx.unitLabel()} · ${s.lots} 批${bad ? ' · 有报警' : ''}">
        <g transform="rotate(${a.toFixed(2)} ${cx} ${cy})">
          <rect class="vz-pbar ${bad ? 'is-bad' : ''}" x="${cx - 7}" y="${(cy - R0 - len).toFixed(1)}" width="14" height="${len.toFixed(1)}" rx="7"
            fill="${col}" style="--d:${(i * 0.035).toFixed(2)}s"></rect>
        </g>
        <text class="vz-pl" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${anchor}">${esc(s.step)}</text>
      </g>`;
    }).join('');

    return `<svg class="vz-polar" viewBox="0 0 ${W} ${H}" role="img" aria-label="工序在制量的极坐标分布">
      ${bars}
      <circle cx="${cx}" cy="${cy}" r="${donutR}" fill="none" stroke="var(--surface-3)" stroke-width="${donutW}"></circle>
      ${arcs}
      <text class="vz-dc-v" x="${cx}" y="${cy + 2}" text-anchor="middle" id="vzPolarNum">0</text>
      <text class="vz-dc-l" x="${cx}" y="${cy + 24}" text-anchor="middle">在制总量（${ctx.unitLabel()}）</text>
      <text class="vz-dc-s" x="${cx}" y="${cy - 26}" text-anchor="middle">${steps.length} 工序 · ${types.length} 品类</text>
      <text class="vz-dc-s" x="${cx}" y="${cy + 42}" text-anchor="middle">${ctx.rows.length} 批在制</text>
    </svg>
    <div class="vz-legend">
      ${types.map(t => `<span><i class="vz-lg-dot" style="background:${ctx.typeColor[t] || '#64748b'}"></i>${esc(ctx.typeName(t))} ${((tt[t] || 0) / grand * 100).toFixed(1)}%</span>`).join('')}
      <span>外圈弧柱长度 = 该工序在制量（最长 = ${ctx.fmtVal(ctx.valOf(maxQ, types[0]))}${ctx.unitLabel()}）· <em style="color:var(--danger);font-style:normal">红描边 = 有 Hold / OTD 逾期</em></span>
    </div>`;
  }

  const BLOCKS = { A: blockA, B: blockB, C: blockC, D: blockD, E: blockE };

  /* =====================================================================
     对外：渲染 + 动效
     ===================================================================== */
  function html(ctx) {
    const keys = ctx.scheme === 'ALL' ? ORDER : [ctx.scheme];
    return keys.map(k => `<div class="vz-block" data-block="${k}">
      <div class="vz-title">${icon(SCHEMES[k].icon, 17)} 方案 ${k} · ${SCHEMES[k].name}</div>
      <div class="vz-desc">${SCHEMES[k].desc}</div>
      ${BLOCKS[k](ctx)}
    </div>`).join('');
  }

  function animate(host, ctx) {
    /* A：环生长 + 数字滚动 */
    host.querySelectorAll('.vz-arc').forEach(a => { a.style.strokeDashoffset = a.dataset.off; });
    host.querySelectorAll('[data-num]').forEach(el => roll(el, +el.dataset.num, 1));
    /* E：弧柱生长 + 甜甜圈展开 */
    requestAnimationFrame(() => {
      host.querySelectorAll('.vz-pbar').forEach(b => b.classList.add('in'));
      host.querySelectorAll('.vz-darc').forEach(d => { d.setAttribute('stroke-dasharray', d.dataset.da); });
    });
    const pnum = host.querySelector('#vzPolarNum');
    if (pnum) {
      const agg = ctx.steps.reduce((a, s) => a + s.qty, 0);
      roll(pnum, ctx.valOf(agg, ctx.types[0]), 1);
    }
    /* B：飘带逐条显形（CSS 动画已带 delay），节点渐入 */
    /* 交互：hover 统一写到 #vzInfo；点击进入二级筛选 */
    const info = document.getElementById('vzInfo');
    const setInfo = h => { if (info) info.innerHTML = h; };
    host.onmouseover = e => {
      const t = e.target;
      if (t.classList.contains('vz-ring')) {
        const s = ctx.steps.find(x => x.step === t.dataset.step);
        const dom = domType(s.byType) || 'BGA';
        setInfo(`<b>${esc(s.step)}</b>：在制 <b>${ctx.fmtVal(ctx.valOf(s.qty, dom))}${ctx.unitLabel()}</b>（${ctx.fmtVal(s.qty / 1000)}K 颗）· ${s.lots} 批 · Hold <b>${s.hold}</b> · OTD 逾期 <b>${s.otd}</b> — 点击进入二级筛选`);
      } else if (t.classList.contains('vz-bub')) {
        const q = +t.dataset.qty;
        setInfo(`批次 <b>${esc(t.dataset.lot)}</b> · 工序 <b>${esc(t.dataset.step)}</b> · ${esc(ctx.typeName(t.dataset.type))}：BE CT <b>${(+t.dataset.ct).toFixed(1)}</b> 天 · 在制 <b>${q.toLocaleString('en-US')}</b> 颗 · OTD 余量 ${t.dataset.otd === '' ? '—' : (+t.dataset.otd).toFixed(1)} 天${+t.dataset.hold > 0 ? ` · <em style="color:var(--danger);font-style:normal">Hold ${t.dataset.hold} 天</em>` : ''}`);
      } else if (t.classList.contains('vz-dot')) {
        setInfo(t.getAttribute('title'));
      } else if (t.classList.contains('vz-darc')) {
        const ty = t.dataset.type;
        setInfo(`品类 <b>${esc(ctx.typeName(ty))}</b>：在制占比 <b>${t.dataset.share}%</b> — 点击中心可下钻到该品类（用上方品类筛选）`);
      }
    };
    host.onclick = e => {
      const el = e.target.closest('[data-step]');
      if (el) ctx.openDrawer(el.dataset.step);
    };
  }

  window.WipViz = { SCHEMES, ORDER, html, animate };
})();
