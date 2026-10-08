/* ============ 【已下线】WIP 动态可视化 · 展示方案 ============
   ⚠️ 2026-10-08 客户确认：动态可视化整块下线 ——
      先移除 B 工序→品类流向桑基 / C CT×数量气泡象限 / D 批次点阵 / E 极坐标弧（多选方案对比），
      随后客户要求连「方案 A · 环形仪表盘阵列」一并去掉，WIP 看板只保留：
      KPI + 口径切换/品类筛选 + 工序×PKG Type 热力矩阵 + 工序 WIP 排行 + Hold 跑马灯 + 二级抽屉。
   ⚠️ 本文件已不被任何页面引用（wip.html 中的 script 标签已移除，样式 .vz-* 已从 style.css 删除），
      保留仅为历史实现参考；如需彻底清理可直接删除本文件。
   —— 以下为原实现说明 ——
   一个方案 = 一种「把在制数据讲清楚」的动效图表，全部基于客户 IT 报表的真实明细（813 批）。
   由 page-wip.js 调用：
     WipViz.html(ctx)        → 返回 HTML 片段
     WipViz.animate(host,ctx)→ 启动入场动效 + 交互绑定
   ctx：
     scheme     当前方案 key（当前仅 'A'）
     rows       在制明细（已按品类筛选）
     steps      工序聚合（按在制量降序，含 qty/val/lots/hold/otd/byType）
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
  };
  const ORDER = ['A'];

  /* ---------------- 通用工具 ---------------- */
  const num = (v, d) => (v == null ? '—' : (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('en-US') : v.toFixed(d == null ? 1 : d)));

  function domType(byType) {
    let best = null, bv = -1;
    Object.keys(byType || {}).forEach(t => { if (byType[t] > bv) { bv = byType[t]; best = t; } });
    return best;
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

  const BLOCKS = { A: blockA };

  /* =====================================================================
     对外：渲染 + 动效
     ===================================================================== */
  function html(ctx) {
    const keys = ctx.scheme && BLOCKS[ctx.scheme] ? [ctx.scheme] : ORDER;
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
    /* 交互：hover 统一写到 #vzInfo；点击进入二级筛选 */
    const info = document.getElementById('vzInfo');
    const setInfo = h => { if (info) info.innerHTML = h; };
    host.onmouseover = e => {
      const t = e.target;
      if (t.classList.contains('vz-ring')) {
        const s = ctx.steps.find(x => x.step === t.dataset.step);
        const dom = domType(s.byType) || 'BGA';
        setInfo(`<b>${esc(s.step)}</b>：在制 <b>${ctx.fmtVal(ctx.valOf(s.qty, dom))}${ctx.unitLabel()}</b>（${ctx.fmtVal(s.qty / 1000)}K 颗）· ${s.lots} 批 · Hold <b>${s.hold}</b> · OTD 逾期 <b>${s.otd}</b> — 点击进入二级筛选`);
      }
    };
    host.onclick = e => {
      const el = e.target.closest('[data-step]');
      if (el) ctx.openDrawer(el.dataset.step);
    };
  }

  window.WipViz = { SCHEMES, ORDER, html, animate };
})();
