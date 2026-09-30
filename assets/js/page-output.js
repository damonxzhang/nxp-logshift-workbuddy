/* ============ OP 专属大屏：Output（OP）周维度累计追踪 ============
   权威规格：《Output 大屏（周维度追踪）需求提示词》+ 客户补充口径。
   界面：年份 / 周别 / 视角部门 / PKG Type 筛选 → 两张累计对比图（上下排布，高度按视口自适应，力争一屏可见）→ 数据刷新。
   周维度累计表与「异常报警 · 周维度」均已拆分为独立页面 op-table.html（本屏只保留筛选与两张累计对比曲线）。
   PKG Type 维护、每周目标数量、部门可见范围统一在独立配置页 op-config.html 完成。 */
(function () {
  renderShell('op');

  const canExport = CurrentUser.can('output', 'export');
  const canConfig = CurrentUser.can('output', 'edit');

  let fitCharts = null;        // 两张累计图的「按视口高度自适应」回调，由 render() 内注册

  /* ---------------- 年份 / 周别 选择（默认定位到本周） ---------------- */
  const cur = opCurrentWeek();
  const sel = store.get('op_week_sel', {}) || {};
  let year = Number(sel.year) || cur.year;
  let weekNo = Number(sel.week) || cur.week;
  const saveSel = () => store.set('op_week_sel', { year, week: weekNo });

  const cfg = Object.assign({}, OP_DEFAULTS, store.get('op_cfg', {}));
  cfg.alarm = Object.assign({}, OP_DEFAULTS.alarm, cfg.alarm || {});
  cfg.refresh = Object.assign({}, OP_DEFAULTS.refresh, cfg.refresh || {});
  const saveCfg = () => store.set('op_cfg', cfg);

  /* ---------------- PKG Type：受「部门可见范围」约束 ----------------
     部门固定为 LEAD / NON-LEAD / PLATING；真实环境取当前登录用户所属部门，
     此处提供「视角部门」下拉便于演示与验证配置效果。 */
  let dept = OPDeptStore.previewDept();
  let deptScope = [], scopeConfigured = false;
  let pkgTypes = [];
  function applyDeptScope() {
    const all = OPTypeStore.all().filter(t => t.enabled !== false);
    deptScope = OPDeptStore.visibleTypes(dept, all.map(t => t.id));
    scopeConfigured = OPDeptStore.configured(dept);
    pkgTypes = all.filter(t => deptScope.indexOf(t.id) >= 0);
  }
  applyDeptScope();

  // 筛选：选中的 PKG Type id（多选）；空数组 = 全部
  const allIds = () => pkgTypes.map(t => t.id);
  let filter = (cfg.filter && cfg.filter.length) ? cfg.filter.slice() : allIds();
  const selIds = () => {
    const ok = filter.filter(id => allIds().indexOf(id) >= 0);
    return ok.length ? ok : allIds();
  };

  let week = genOpWeek(year, weekNo);
  /* 以下派生量随「年份 / 周别」切换而变，统一在 recalc() 中重算 */
  let days, wdLabel, lastIdx, todayIdx, focusIdx, weekRange, hasActual, focusLabel, realInfo;
  function recalc() {
    days = week.days;                                       // 7 天 六→五
    wdLabel = days.map(d => d.weekday);
    lastIdx = (function () { let k = -1; days.forEach((d, i) => { if (!d.isFuture) k = i; }); return k; })();
    todayIdx = (function () { const k = days.findIndex(d => d.isToday); return k >= 0 ? k : lastIdx; })();
    // 报警/汇总基准日：优先今天（今天有数据时）→ 否则最后一个「有实际产出」的日期
    //（真实数据可能只覆盖周内部分日期，例如首批只拿到 2026-09-26 一个产出日）
    focusIdx = opFocusIdx(week, todayIdx, lastIdx >= 0 ? lastIdx : 6);
    hasActual = opLastActualIdx(week) >= 0;                  // 本周是否已有实际产出
    focusLabel = hasActual ? ('截至 ' + days[focusIdx].weekday) : '本周尚未开始';
    weekRange = `${days[0].label} - ${days[6].label}`;
    /* 数据来源标注：本周是真实数据还是演示数据 */
    const rm = opRealMeta();
    realInfo = week.isReal
      ? { real: true, text: `真实数据 · ${rm ? rm.source : ''}${rm && rm.days ? ' · 产出日 ' + rm.days.join('、') : ''} · ${rm ? rm.rows : 0} 批` }
      : { real: false, text: '演示数据（本周尚无客户真实数据）' };
  }
  recalc();

  function badge(status) {
    const info = opStatusInfo(status);
    return `<span class="badge ${info.badge}">${info.label}</span>`;
  }

  /* 本周红灯 / 黄灯统计（用于图表标记与筛选标签告警） */
  function redDaysOf(ids) {
    const marks = [];
    for (let i = 0; i <= lastIdx; i++) {
      const st = opAggStatus(ids, i, week);
      if (st.status === 'over') marks.push(i);
    }
    return marks;
  }

  /* ---------------- 主渲染 ---------------- */
  function render() {
    const ids = selIds();
    const aggSt = opAggStatus(ids, focusIdx, week);
    const redDays = redDaysOf(ids);
    const redTypes = ids.filter(id => opTypeAlarm(id, week).red > 0);
    const warnTypes = ids.filter(id => opTypeAlarm(id, week).red === 0 && opTypeAlarm(id, week).yellow > 0);
    const gk = goalSeries(ids), ek = earnSeries(ids);      // 两张图各两条线（目标·虚线 / 实际·实线）
    const gap1 = gapAt(gk, focusIdx), gap2 = gapAt(ek, focusIdx);

    document.getElementById('content').innerHTML = `

      <div class="card mt16 no-print">
        <div class="card-head">
          <div class="card-title">${icon('filter', 19)} 筛选
            <span class="card-sub">年份 / 周别 / PKG Type 单选多选 · 筛选与图表联动（当前 ${ids.length} 类）</span></div>
          <div class="flex acenter gap8">
            <button class="btn btn-sm" id="btnCfgPage">${icon('settings', 16)} OP 配置页</button>
            ${canExport ? `<button class="btn btn-sm btn-primary" id="btnExport">${icon('download', 16)} 导出 Excel</button>` : '<span class="chip">只读（无导出权限）</span>'}
          </div>
        </div>
        <div class="card-body">
          <div class="op-filterbar">
            <div class="fi">
              <label class="field-label">年份</label>
              <select class="input" id="selYear" style="width:110px">${yearOptions()}</select>
            </div>
            <div class="fi">
              <label class="field-label">周别</label>
              <select class="input" id="selWeek" style="width:150px">${weekOptions()}</select>
            </div>
            <div class="fi">
              <label class="field-label">视角部门</label>
              <select class="input" id="selDept" style="width:130px">${OP_DEPARTMENTS.map(d => `<option value="${esc(d)}" ${d === dept ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select>
            </div>
            <div class="fi grow">
              <label class="field-label">PKG Type ${redTypes.length ? `<span class="tag-hint red">${redTypes.length} 类红灯</span>` : (warnTypes.length ? `<span class="tag-hint warn">${warnTypes.length} 类黄灯</span>` : '')}</label>
              <div class="seg" id="segFilter">
                <button data-f="__all__" class="${selIds().length === allIds().length ? 'active' : ''}">全部</button>
                ${pkgTypes.map(t => {
      const a = opTypeAlarm(t.id, week);
      const cls = a.red > 0 ? 'f-bad' : (a.yellow > 0 ? 'f-warn' : '');
      const flag = a.red > 0 ? `<span class="tag-flag" title="本周红灯 ${a.red} 天 · 最大缺口 ${a.maxGap}K">超</span>` : '';
      return `<button data-f="${esc(t.id)}" class="${selIds().includes(t.id) ? 'active' : ''} ${cls}">${esc(t.name)}${flag}</button>`;
    }).join('')}
              </div>
            </div>
          </div>
          <div class="flex acenter gap8 mt8 flex-wrap">
            <span class="chip">${icon('calendar', 14)} ${year} 年 第 ${weekNo} 周 · ${weekRange}（周六起始）</span>
            <span class="chip">${icon('users', 14)} 部门 ${esc(dept)} · 可见 ${pkgTypes.length} 类${scopeConfigured ? '' : '（未配置，默认全部可见）'}</span>
            <span class="chip" title="报警阈值逐 PKG Type 维护；汇总视图取各品类阈值之和">${icon('alert', 14)} 阈值 ${opAlarmText(ids)}</span>
            <span class="chip ${realInfo.real ? 'chip-real' : 'chip-demo'}">${icon('database', 14)} ${esc(realInfo.text)}</span>
            ${redDays.length ? `<span class="chip chip-danger">${icon('alert', 14)} 本周红灯 ${redDays.length} 天</span>` : ''}
            <a class="chip chip-link" href="op-config.html">${icon('settings', 14)} 配置 PKG Type / 每周目标 / 部门可见范围</a>
          </div>
        </div>
      </div>

      <div class="grid op-chart-stack mt16" id="chartStack">
        <div class="card op-chart-card">
          <div class="card-head">
            <div class="card-title">${icon('activity', 20)} 累计 goal vs total 曲线对比（K）
              <span class="card-sub">目标（虚线）vs 实际（实线）· 悬停看当日明细 · ${badge(aggSt.status)}${gap1 != null ? ` · ${focusLabel}差额 <strong class="${gap1 < 0 ? 'red-inline' : 'green-inline'}">${gap1 >= 0 ? '+' : ''}${gap1}K</strong>` : ''}${redDays.length ? ` · <span class="red-inline">红灯 ${redDays.length} 天</span>` : ''}</span></div>
            <div class="legend">${gk.map(legendItem).join('')}
              ${redDays.length ? '<span class="lg"><i class="sw-bad"></i>超标红灯区间</span>' : ''}</div>
          </div>
          <div class="card-body"><div id="cGoal"></div></div>
        </div>
        <div class="card op-chart-card">
          <div class="card-head">
            <div class="card-title">${icon('database', 20)} 累计 Earn 目标 vs 实际（万元）
              <span class="card-sub">目标（虚线）vs 实际（实线）· 悬停看当日明细 · 单价 × 累计实际${gap2 != null ? ` · ${focusLabel}差额 <strong class="${gap2 < 0 ? 'red-inline' : 'green-inline'}">${gap2 >= 0 ? '+' : ''}${gap2}万</strong>` : ''}${redDays.length ? ` · <span class="red-inline">红灯 ${redDays.length} 天</span>` : ''}</span></div>
            <div class="legend">${ek.map(legendItem).join('')}
              ${redDays.length ? '<span class="lg"><i class="sw-bad"></i>超标红灯区间</span>' : ''}</div>
          </div>
          <div class="card-body"><div id="cEarn"></div></div>
        </div>
      </div>

      <div class="card mt16 no-print">
        <div class="card-head"><div class="card-title">${icon('refresh', 19)} 数据刷新
          <span class="card-sub">手动 + 自动（频率待 IT 确认）</span></div></div>
        <div class="card-body flex acenter gap12 flex-wrap">
          <button class="btn btn-sm" id="btnRefresh">${icon('refresh', 16)} 手动刷新</button>
          <span class="chip">模式：${cfg.refresh.mode === 'auto' ? '自动（每 ' + (cfg.refresh.autoSec / 60) + ' 分钟）' : '手动'}</span>
          <span class="small muted">实际 total 数据来源：<strong>${esc(cfg.source || OP_DEFAULTS.source)}</strong></span>
          <span class="chip ${realInfo.real ? 'chip-real' : 'chip-demo'}">${icon('database', 14)} ${realInfo.real ? '本周为真实数据' : '本周为演示数据'}</span>
          ${canConfig ? '' : '<span class="chip">当前角色无配置权限（需 Output「编辑」权限）</span>'}
        </div>
      </div>`;

    bindCommon();
    setTimeout(() => {
      const g = gk, e = ek;
      const gWrap = document.getElementById('cGoal'), eWrap = document.getElementById('cEarn');
      const stack = document.getElementById('chartStack');
      const gMarks = redDays.map(i => ({ i, v: g[1].data[i], color: '#cc2f2a', text: '超标' }));
      const eMarks = redDays.map(i => ({ i, v: e[1].data[i], color: '#cc2f2a', text: '超标' }));
      /* 悬停浮层附加行：当日差额 + 状态（未来日显示占位说明） */
      const tipGap = (srs, unit) => i => {
        const g0 = srs[0].data[i], t0 = srs[1].data[i];
        if (g0 == null) return '';
        if (t0 == null) {
          return days[i].isFuture
            ? `<div class="lc-tgap flat">未来日期 · 暂无${unit === 'K' ? '产出' : ' Earn'}数据</div>`
            : `<div class="lc-tgap flat">该日无产出记录（数据未覆盖）</div>`;
        }
        const d = +(t0 - g0).toFixed(1);
        return `<div class="lc-tgap ${d < 0 ? '' : 'ok'}">差额(实际-目标) <strong>${d >= 0 ? '+' : ''}${d.toLocaleString('en-US')}${unit}</strong></div>`;
      };
      const tipTitleG = i => `${days[i].label} · 周六起第 ${i + 1} 天${days[i].isToday ? '（今天）' : ''}`;
      const gTip = tipGap(g, 'K');
      const eTip = tipGap(e, '万');

      /* 上下排布：两张图各占满整行；SVG 以 width:100% + height:auto 铺满，
         显示高度 = 容器宽 × height / vw，故只调 height（视图单位）即可精确控制每张图占多高。 */
      const VW = 1000;
      const draw = H => {
        lineChart(gWrap, {
          series: g, labels: wdLabel, height: H, vw: VW, hover: true, tipUnit: 'K', tipTitle: tipTitleG, tipExtra: gTip,
          min: 0, max: chartMax(g) * 1.08, yUnit: ' K', marks: gMarks, endAt: focusIdx, endUnit: 'K'
        });
        lineChart(eWrap, {
          series: e, labels: wdLabel, height: H, vw: VW, hover: true, tipUnit: '万', tipTitle: tipTitleG, tipExtra: eTip,
          min: 0, max: chartMax(e) * 1.08, yUnit: ' 万', marks: eMarks, endAt: focusIdx, endUnit: '万'
        });
      };

      /* 按视口余量自适应：先画一版量出「卡头 + 内边距 + 图例」的固定占用，
         再把剩余高度平分给两张图，力争两块图在一个屏内同时可见。 */
      const fit = () => {
        draw(300);
        const card = stack.querySelector('.op-chart-card');
        if (!card) return;
        const overhead = card.offsetHeight - gWrap.offsetHeight;              // 卡头 + body 内边距
        const topAbs = stack.getBoundingClientRect().top + window.scrollY;    // 文档坐标：不受当前滚动位置影响
        const GAP = 14;                                                      // 与 .op-chart-stack 的 gap 一致
        const avail = window.innerHeight - topAbs - 18;
        const perCard = (avail - GAP) / 2;                                   // 两张卡 + 卡间距
        const wantPx = Math.max(150, Math.min(340, perCard - overhead));
        const cw = gWrap.clientWidth || VW;
        const wantH = Math.max(120, Math.round(wantPx * VW / cw));
        if (Math.abs(wantH - 300) > 6) draw(wantH);
      };
      fit();
      fitCharts = fit;                                                       // 供窗口尺寸变化时重排
    }, 30);
  }

  function yearOptions() {
    const y0 = cur.year - 1, y1 = cur.year + 1, out = [];
    for (let y = y0; y <= y1; y++) out.push(`<option value="${y}" ${y === year ? 'selected' : ''}>${y} 年</option>`);
    return out.join('');
  }
  function weekOptions() {
    const n = opWeeksInYear(year);
    const out = [];
    for (let w = 1; w <= n; w++) {
      const s = opWeekStartOf(year, w), e = new Date(s); e.setDate(s.getDate() + 6);
      const m2 = n => String(n).padStart(2, '0');
      const tag = (w === cur.week && year === cur.year) ? '（本周）' : '';
      out.push(`<option value="${w}" ${w === weekNo ? 'selected' : ''}>第 ${m2(w)} 周 · ${m2(s.getMonth() + 1)}/${m2(s.getDate())}-${m2(e.getMonth() + 1)}/${m2(e.getDate())}${tag}</option>`);
    }
    return out.join('');
  }

  function chartMax(series) { return Math.max(1, ...series.flatMap(s => s.data.filter(v => v != null && isFinite(v)))); }

  /* 两条线：目标线（虚线·蓝色）与实际线（实线·绿色）。
     注意：目标与实际天然存在出入，两条线不会重合——贴合说明当日基本达标，
       实际线在目标线下方 = 欠产（缺口），在上方 = 超额。 */
  function goalSeries(ids) {
    const goal = wdLabel.map((_, i) => ids.reduce((s, id) => s + (week.byType[id] ? week.byType[id].goalCum[i] : 0), 0));
    const total = wdLabel.map((_, i) => {
      let any = false, v = 0;
      ids.forEach(id => { const t = week.byType[id]; if (t && t.totalCum[i] != null) { v += t.totalCum[i]; any = true; } });
      return any ? v : null;
    });
    return [
      { name: '累计目标 goal（虚线）', color: '#1d4ed8', dash: true, width: 2.2, data: goal },
      { name: '累计实际 total（实线）', color: '#12805a', width: 2.6, data: total }
    ];
  }
  function earnSeries(ids) {
    const e = opEarnSeries(ids, week, OPTypeStore.all());
    return [
      { name: '累计 Earn 目标（虚线）', color: '#8b5cf6', dash: true, width: 2.2, data: e.goalCum },
      { name: '累计 Earn 实际（实线）', color: '#0b6a86', width: 2.6, data: e.totalCum }
    ];
  }
  /* 截至基准日的差额（实际-目标），用于图表副标题，明确「两条线差多少」 */
  function gapAt(series, i) {
    const g = series[0].data[i], t = series[1].data[i];
    if (g == null || t == null) return null;
    return +(t - g).toFixed(1);
  }
  /* 图例条目：目标线画成虚线段，实际线画成实心色块，视觉上与图内两条线一致 */
  function legendItem(s) {
    const sw = s.dash
      ? `<i class="lg-dash" style="border-top-color:${s.color}"></i>`
      : `<i style="background:${s.color}"></i>`;
    return `<span class="lg">${sw}${s.name}</span>`;
  }

  /* ---------------- 事件绑定 ---------------- */
  function bindCommon() {
    const sy = document.getElementById('selYear');
    if (sy) sy.onchange = () => {
      year = Number(sy.value);
      const n = opWeeksInYear(year);
      if (weekNo > n) weekNo = n;
      saveSel(); reload();
    };
    const sw = document.getElementById('selWeek');
    if (sw) sw.onchange = () => { weekNo = Number(sw.value); saveSel(); reload(); };

    const sd = document.getElementById('selDept');
    if (sd) sd.onchange = () => {
      dept = sd.value;
      OPDeptStore.setPreviewDept(dept);
      applyDeptScope();
      filter = [];                                   // 部门变更后重置为「全部可见」
      cfg.filter = []; saveCfg();
      reload();
      toast('已切换视角部门：' + dept + '（可见 ' + pkgTypes.length + ' 类）', 'success');
    };

    const sf = document.getElementById('segFilter');
    if (sf) sf.querySelectorAll('button').forEach(b => b.onclick = () => {
      const f = b.dataset.f;
      if (f === '__all__') { filter = []; }
      else {
        const curSel = selIds();
        if (curSel.includes(f)) filter = curSel.filter(x => x !== f);   // 取消选中
        else filter = curSel.concat(f);                                 // 追加选中
        if (filter.length === 0) filter = [];                           // 空 = 全部
      }
      cfg.filter = filter.slice(); saveCfg();
      render();
    });

    const bp = document.getElementById('btnCfgPage');
    if (bp) bp.onclick = () => {
      if (!canConfig) { toast('当前角色无「Output（OP）」编辑权限，配置页为只读', 'warn'); }
      location.href = 'op-config.html';
    };
    const br = document.getElementById('btnRefresh'); if (br) br.onclick = () => { reload(); toast('已刷新 ' + year + ' 年第 ' + weekNo + ' 周数据', 'primary'); };
    const be = document.getElementById('btnExport');
    if (be) be.onclick = () => {
      if (!canExport) { toast('当前角色无「Output（OP）」导出权限', 'warn'); return; }
      const ids = selIds();
      const headers = ['PKG Type', '行类型', 'Output目标[K]', '六[K]', '日[K]', '一[K]', '二[K]', '三[K]', '四[K]', '五[K]', '差额(基准日)[K]', '状态'];
      const rows = [];
      ids.forEach(id => {
        const t = week.byType[id]; if (!t) return;
        const st = opStatus(id, focusIdx, week);
        rows.push([id, '目标(累计)', t.weekGoal, ...t.goalCum, '', '—']);
        rows.push([id, '实际(累计)', '', ...t.totalCum.map(v => v == null ? '—' : v), st.diff == null ? '—' : st.diff, opStatusInfo(st.status).label]);
        rows.push([id, 'FE 实际(累计)', '—', ...Array(7).fill('—'), '—', '预留']);
      });
      exportExcel('Output_OP_' + year + '_W' + String(weekNo).padStart(2, '0') + '_周维度累计表.xls', headers, rows);
      toast('已导出 Excel', 'success');
    };
  }

  /* 切换周后重算（PKG Type 与部门范围可能已在配置页变更） */
  function reload() {
    applyDeptScope();
    filter = filter.filter(id => pkgTypes.some(t => t.id === id));
    week = genOpWeek(year, weekNo);
    recalc();
    render();
  }

  render();

  /* 窗口尺寸变化后重排两张图的高度（沿用同一套「一屏可见」策略） */
  let rzTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(rzTimer);
    rzTimer = setTimeout(() => { if (typeof fitCharts === 'function') fitCharts(); }, 180);
  });
})();
