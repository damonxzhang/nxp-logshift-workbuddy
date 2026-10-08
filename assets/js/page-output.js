/* ============ OP 专属大屏：Output（OP）周维度累计追踪 ============
   权威规格：《Output 大屏（周维度追踪）需求提示词》+ 客户补充口径。
   界面：年份 / 周别 / 视角部门 / PKG Type 筛选 → 累计对比图 → 数据刷新。
   图表排布（10-08 客户确认）：默认「双部门 2×2」= LEAD / NON-LEAD 两个部门 ×（数量 / 金额）两张图，
     行 = 口径、列 = 部门，同一行共用 Y 轴上限以便横向比高低；可切「单部门」回到原上下两张图。
   周维度累计表与「异常报警 · 周维度」均已拆分为独立页面 op-table.html（本屏只保留筛选与两张累计对比曲线）。
   PKG Type 维护、每周目标数量、预警分口径统一在独立配置页 op-config.html 完成
   （「部门可见范围」配置域已下线，部门固定 LEAD / NON-LEAD / PLATING，可见范围用引擎内置默认）。 */
(function () {
  renderShell('op');

  const canExport = CurrentUser.can('output', 'export');
  const canConfig = CurrentUser.can('output', 'edit');

  let fitCharts = null;        // 全部累计图的「按视口高度自适应」回调，由 render() 内注册

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

  /* ---------------- 视图模式（10-08 客户确认） ----------------
     dual（默认）：LEAD + NON-LEAD 两个部门 ×（数量 / 金额）= 四张图，2×2 排布
                  （行 = 口径，列 = 部门，同一行共用 Y 轴上限以便直接横向对比）
     single：沿用原来的「单一视角部门 · 上下两张图」 */
  const DUAL_DEPTS = ['LEAD', 'NON-LEAD'];
  let viewMode = store.get('op_view_mode', 'dual') === 'single' ? 'single' : 'dual';
  const saveViewMode = () => store.set('op_view_mode', viewMode);
  /* 某部门实际参与统计的 PKG Type = 该部门可见范围 ∩ 当前 PKG Type 筛选 */
  function idsForDept(d) {
    const all = OPTypeStore.all().filter(t => t.enabled !== false);
    const scope = OPDeptStore.visibleTypes(d, all.map(t => t.id));
    const f = (filter && filter.length) ? filter : all.map(t => t.id);
    const inter = scope.filter(id => f.indexOf(id) >= 0);
    return inter.length ? inter : scope;
  }

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
    /* Earn 口径提示（10-08 修正）：数量口径固定「周目标均摊」；金额口径可切「递进式 ±5%」 */
    const ei = earnMeta(ids) || { mode: 'even', pct: 5 };
    const earnOverN = (ei.prog || []).filter(p => p && (p.status === 'critical' || p.status === 'over')).length;
    const earnSub = ei.mode === 'progressive'
      ? ` · 递进式 ±${ei.pct}%（基准=前一日实际）${earnOverN ? ` · <span class="red-inline">超差 ${earnOverN} 天</span>` : ''}`
      : '';

    /* ---------------- 图表面板 ----------------
       dual   → 行=口径（数量 / 金额），列=部门（LEAD / NON-LEAD），四张图 2×2
       single → 单一视角部门上排数量、下排金额 */
    const isDual = viewMode === 'dual';
    const panelDepts = isDual ? DUAL_DEPTS : [dept];
    function makePanel(d, kind) {
      const pids = isDual ? idsForDept(d) : ids;
      const srs = kind === 'goal' ? goalSeries(pids) : earnSeries(pids);
      /* WIP 叠加（10-08 客户要求）：只给【NON-LEAD · 累计 goal vs total（K）】这一张图
         追加第三条线「累计实际 + 在制 WIP」，用于看「已产出 + 在制」能否覆盖周目标。
         WIP 是实时快照（报表无逐日历史），所有周都按最新快照画，故 7 天同一值。 */
      let wip = null;
      const wo = opWipCfg(cfg);
      if (kind === 'goal' && d === 'NON-LEAD' && wo.on && wo.spec) {
        const k = +(opWipQtyOf(wo.spec, pids, cfg) / 1000).toFixed(1);
        if (k > 0) {
          wip = { spec: wo.spec, k: k, scope: wo.scope, excludeHold: wo.excludeHold };
          const base = srs[1].data;
          srs.push({
            name: `累计实际 + WIP（${wo.spec}）`,
            color: '#a8620b', dash: '3 4', width: 2.2,
            data: base.map(v => (v == null ? null : +(v + k).toFixed(1)))
          });
        }
      }
      return {
        key: kind + '-' + d, dept: d, kind, ids: pids, series: srs,
        redDays: redDaysOf(pids),
        st: opAggStatus(pids, focusIdx, week),
        gap: gapAt(srs, focusIdx),
        em: earnMeta(pids),
        wip
      };
    }
    const panels = [];
    if (isDual) ['goal', 'earn'].forEach(kind => panelDepts.forEach(d => panels.push(makePanel(d, kind))));
    else ['goal', 'earn'].forEach(kind => panels.push(makePanel(dept, kind)));
    /* 同一行（同一口径）共用 Y 轴上限，两个部门可直接横向比高低 */
    const maxByKind = {};
    ['goal', 'earn'].forEach(kind => {
      maxByKind[kind] = Math.max(1, ...panels.filter(p => p.kind === kind).map(p => chartMax(p.series)));
    });

    const panelCard = p => {
      const isG = p.kind === 'goal';
      const overN = (p.em.prog || []).filter(x => x && (x.status === 'critical' || x.status === 'over')).length;
      const deptTag = isDual ? `<span class="chip">${icon('users', 14)} ${esc(p.dept)} · 可见 ${p.ids.length} 类</span> ` : '';
      const gapTxt = p.gap != null
        ? ` · ${focusLabel}差额 <strong class="${p.gap < 0 ? 'red-inline' : 'green-inline'}">${p.gap >= 0 ? '+' : ''}${p.gap}${isG ? 'K' : '万'}</strong>`
        : '';
      const redTxt = p.redDays.length ? ` · <span class="red-inline">红灯 ${p.redDays.length} 天</span>` : '';
      const earnTag = (!isG && p.em.mode === 'progressive')
        ? ` · 递进式 ±${p.em.pct}%${overN ? ` · <span class="red-inline">超差 ${overN} 天</span>` : ''}`
        : '';
      /* WIP 叠加提示：明确标注工序、数量与「实时快照」口径（报表无逐日历史） */
      const wipTag = p.wip
        ? ` · WIP 叠加 <strong>${esc(p.wip.spec)} ${p.wip.k}K</strong>（${p.wip.scope === 'all' ? '该工序全部' : '跟随筛选'}·实时快照）`
        : '';
      return `<div class="card op-chart-card">
          <div class="card-head">
            <div class="card-title">${isG ? icon('activity', 20) : icon('database', 20)} ${isDual ? esc(p.dept) + ' · ' : ''}${isG ? '累计 goal vs total 曲线对比（K）' : '累计 Earn 目标 vs 实际（万元）'}
              <span class="card-sub">${deptTag}目标（虚线）vs 实际（实线）· 悬停看当日明细 · 点击图表查看「周维度累计表」 · ${badge(p.st.status)}${gapTxt}${redTxt}${earnTag}${wipTag}</span></div>
            <div class="legend">${p.series.map(legendItem).join('')}
              ${p.redDays.length ? '<span class="lg"><i class="sw-bad"></i>超标红灯区间</span>' : ''}</div>
          </div>
          <div class="card-body"><div id="pc_${esc(p.key)}"></div></div>
        </div>`;
    };

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
              <label class="field-label">视角部门${isDual ? '<span class="tag-hint">仅影响筛选清单</span>' : ''}</label>
              <select class="input" id="selDept" style="width:130px" title="${isDual ? '双部门视图下仅用于决定 PKG Type 筛选清单；单部门视图下决定图表统计对象' : '决定图表统计对象与 PKG Type 筛选清单'}">${OP_DEPARTMENTS.map(d => `<option value="${esc(d)}" ${d === dept ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select>
            </div>
            <div class="fi">
              <label class="field-label">图表视图</label>
              <div class="seg" id="segView" title="双部门 2×2：LEAD / NON-LEAD ×（数量 / 金额）四张图；单部门：当前视角部门上下两张图">
                <button data-v="dual" class="${isDual ? 'active' : ''}">双部门 2×2</button>
                <button data-v="single" class="${isDual ? '' : 'active'}">单部门</button>
              </div>
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
        </div>
      </div>

      <div class="grid ${isDual ? 'g-2 op-chart-grid' : ''} op-chart-stack mt16" id="chartStack">
        ${panels.map(panelCard).join('')}
      </div>
      ${isDual ? `<div class="sub-note mt8">2×2 排布：行 = 口径（数量 / 金额），列 = 部门（LEAD / NON-LEAD）；同一行两部门共用 Y 轴上限，可直接横向比高低。</div>` : ''}

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
      const stack = document.getElementById('chartStack');
      /* 悬停浮层附加行：当日差额 + 状态（未来日显示占位说明）；
         含 WIP 叠加的面板再补一行「WIP（工序）x K · 产出+在制 y K」 */
      const tipGap = p => i => {
        const srs = p.series, unit = p.kind === 'goal' ? 'K' : '万';
        const wip = p.wip;
        const g0 = srs[0].data[i], t0 = srs[1].data[i];
        const wipLine = wip
          ? `<div class="lc-tgap flat">WIP（${esc(wip.spec)}） <strong>${wip.k.toLocaleString('en-US')}K</strong>${t0 == null ? '' : ` · 产出+在制 <strong>${(t0 + wip.k).toFixed(1).replace(/\.0$/, '')}K</strong>`}<div class="small muted">实时快照${wip.scope === 'all' ? ' · 该工序全部' : ' · 跟随当前 PKG Type 筛选'}${wip.excludeHold ? ' · 已剔除 Hold' : ''}</div></div>`
          : '';
        if (g0 == null) return wipLine;
        if (t0 == null) {
          return (days[i].isFuture
            ? `<div class="lc-tgap flat">未来日期 · 暂无${unit === 'K' ? '产出' : ' Earn'}数据</div>`
            : `<div class="lc-tgap flat">该日无产出记录（数据未覆盖）</div>`) + wipLine;
        }
        const d = +(t0 - g0).toFixed(1);
        return `<div class="lc-tgap ${d < 0 ? '' : 'ok'}">差额(实际-目标) <strong>${d >= 0 ? '+' : ''}${d.toLocaleString('en-US')}${unit}</strong></div>` + wipLine;
      };
      const tipTitle = i => `${days[i].label} · 周六起第 ${i + 1} 天${days[i].isToday ? '（今天）' : ''}`;

      /* 全部面板一次绘制。SVG 以 width:100% + height:auto 铺满容器：
         · 显示高度(px) = 容器宽 × height / vw → 由 height 控制每张图占多高；
         · 图内文字像素尺寸 ∝ 1000 × 容器宽 / vw² → 卡片变窄（2×2）时同步调小 vw，
           保证「整行单图」与「半宽双列」两种排布下文字看起来一样大。 */
      const BASE_VW = 1000, BASE_CW = 1400;                 // 基准：整行单图（容器约 1400px，vw=1000）
      const vwFor = cw => Math.max(520, Math.round(BASE_VW * Math.sqrt(Math.max(320, cw) / BASE_CW)));

      const drawAll = H => {
        panels.forEach(p => {
          const el = document.getElementById('pc_' + p.key);
          if (!el) return;
          const unit = p.kind === 'goal' ? 'K' : '万';
          const cw = el.clientWidth || BASE_CW;
          lineChart(el, {
            series: p.series, labels: wdLabel, height: Math.round(H * vwFor(cw) / cw), vw: vwFor(cw),
            hover: true, tipUnit: unit, tipTitle, tipExtra: tipGap(p),
            min: 0, max: maxByKind[p.kind] * 1.08, yUnit: ' ' + unit,
            marks: p.redDays.map(i => ({ i, v: p.series[1].data[i], color: '#cc2f2a', text: '超标' })),
            endAt: focusIdx,
            /* 图表直接可点（2026-10-08 客户要求：不再挂在浮窗上）：
               点击图内任意位置 → 取该处所在的「日」→ 跳转周维度累计表并定位到该列 */
            onClick: i => {
              store.set('op_table_focus', { day: i });
              location.href = 'op-table.html';
            }
          });
        });
      };

      /* 按视口余量自适应：先画一版量出「卡头 + 内边距 + 图例」的固定占用，
         再把剩余高度按「两行」平分（2×2 = 两行两列；单部门 = 两行一列），
         力争全部图卡在一个屏内同时可见。 */
      const fit = () => {
        drawAll(240);
        const cards = Array.prototype.slice.call(stack.querySelectorAll('.op-chart-card'));
        if (!cards.length) return;
        let overhead = 0;                                                    // 取最「厚」的卡头作为统一占用
        cards.forEach(c => {
          const w = c.querySelector('[id^="pc_"]');
          if (w) overhead = Math.max(overhead, c.offsetHeight - w.offsetHeight);
        });
        const topAbs = stack.getBoundingClientRect().top + window.scrollY;   // 文档坐标：不受当前滚动位置影响
        const GAP = 14;                                                      // 与 .op-chart-stack 的 gap 一致
        const avail = window.innerHeight - topAbs - 18;
        const perRow = (avail - GAP) / 2;                                    // 两行 + 行间距
        const wantPx = Math.max(150, Math.min(340, perRow - overhead));
        if (Math.abs(wantPx - 240) > 6) drawAll(wantPx);
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
  /* Earn 目标序列按配置页口径生成（even 周目标均摊 / progressive 递进式 ±5%） */
  let earnInfo = null;
  /* Earn 口径元信息（模式 / pct / 逐日基准 / 逐日判定），供卡片副标题与红字提示使用 */
  function earnMeta(ids) {
    return opEarnSeriesCfg(ids, week, OPTypeStore.all(), cfg);
  }
  function earnSeries(ids) {
    const e = earnMeta(ids);
    earnInfo = e;
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

    const sv = document.getElementById('segView');
    if (sv) sv.querySelectorAll('button').forEach(b => b.onclick = () => {
      const v = b.dataset.v === 'single' ? 'single' : 'dual';
      if (v === viewMode) return;
      viewMode = v; saveViewMode();
      render();
      toast(v === 'dual'
        ? '已切换：双部门 2×2（LEAD / NON-LEAD × 数量 / 金额）'
        : '已切换：单部门视图（' + dept + '）', 'primary');
    });

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

  /* 窗口尺寸变化后重排全部图卡的高度（沿用同一套「一屏可见」策略） */
  let rzTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(rzTimer);
    rzTimer = setTimeout(() => { if (typeof fitCharts === 'function') fitCharts(); }, 180);
  });
})();
