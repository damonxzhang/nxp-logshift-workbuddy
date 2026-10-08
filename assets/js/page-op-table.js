/* ============ Output（OP）· 周维度累计表（独立页） ============
   本页由原「Output（OP）大屏」中的周维度累计表拆分而来，专门用于查看/对账/导出。
   规格：《Output 大屏（周维度追踪）需求提示词》——
     每周起始周六，列序 六→五，单位 K；行维度 = PKG Type（goal / total / FE total 三行），
     底部固定 Earn 目标 / Earn 实际两行（万元）；实际行按每日差额着色并脉冲提示（达标/临界/超标）。
   年份 / 周别 / 视角部门 / PKG Type 筛选与 output.html 共用同一份选择与配置。 */
(function () {
  renderShell('optable');

  const canExport = CurrentUser.can('output', 'export');
  const canConfig = CurrentUser.can('output', 'edit');

  /* ---------------- 年份 / 周别（与大屏共用 op_week_sel） ---------------- */
  const cur = opCurrentWeek();
  const sel = store.get('op_week_sel', {}) || {};
  let year = Number(sel.year) || cur.year;
  let weekNo = Number(sel.week) || cur.week;
  const saveSel = () => store.set('op_week_sel', { year, week: weekNo });

  const cfg = Object.assign({}, OP_DEFAULTS, store.get('op_cfg', {}));
  cfg.alarm = Object.assign({}, OP_DEFAULTS.alarm, cfg.alarm || {});
  const saveCfg = () => store.set('op_cfg', cfg);

  /* ---------------- PKG Type：受「部门可见范围」约束（LEAD / NON-LEAD / PLATING） ---------------- */
  let dept = OPDeptStore.previewDept();
  let deptScope = [], scopeConfigured = false, pkgTypes = [];
  function applyDeptScope() {
    const all = OPTypeStore.all().filter(t => t.enabled !== false);
    deptScope = OPDeptStore.visibleTypes(dept, all.map(t => t.id));
    scopeConfigured = OPDeptStore.configured(dept);
    pkgTypes = all.filter(t => deptScope.indexOf(t.id) >= 0);
  }
  applyDeptScope();

  const allIds = () => pkgTypes.map(t => t.id);
  let filter = (cfg.filter && cfg.filter.length) ? cfg.filter.slice() : allIds();
  const selIds = () => {
    const ok = filter.filter(id => allIds().indexOf(id) >= 0);
    return ok.length ? ok : allIds();
  };

  let week = genOpWeek(year, weekNo);
  /* 来自 OP 大屏浮窗点击的「定位日」（0-6 = 六→五）：一次性消费，表格高亮对应列 */
  let focusDay = (function () {
    const fd = store.get('op_table_focus', null);
    if (fd && Number.isInteger(fd.day) && fd.day >= 0 && fd.day <= 6) return fd.day;
    return null;
  })();
  if (focusDay != null) store.set('op_table_focus', null);
  let days, wdLabel, lastIdx, todayIdx, focusIdx, weekRange, hasActual, focusLabel, realInfo;
  function recalc() {
    days = week.days;
    wdLabel = days.map(d => d.weekday);
    lastIdx = (function () { let k = -1; days.forEach((d, i) => { if (!d.isFuture) k = i; }); return k; })();
    todayIdx = (function () { const k = days.findIndex(d => d.isToday); return k >= 0 ? k : lastIdx; })();
    // 基准日：优先今天（今天有数据时）→ 否则最后一个「有实际产出」的日期
    focusIdx = opFocusIdx(week, todayIdx, lastIdx >= 0 ? lastIdx : 6);
    hasActual = opLastActualIdx(week) >= 0;
    focusLabel = hasActual ? ('截至 ' + days[focusIdx].weekday) : '本周尚未开始';
    weekRange = `${days[0].label} - ${days[6].label}`;
    const rm = opRealMeta();
    realInfo = week.isReal
      ? { real: true, text: `真实数据 · ${rm ? rm.source : ''}${rm && rm.days ? ' · 产出日 ' + rm.days.join('、') : ''} · ${rm ? rm.rows : 0} 批` }
      : { real: false, text: '演示数据（本周尚无客户真实数据）' };
  }
  recalc();

  function fmt(v) { return (v == null) ? '—' : Math.round(v).toLocaleString(); }
  function badge(status) { const i = opStatusInfo(status); return `<span class="badge ${i.badge}">${i.label}</span>`; }
  function aggAt(ids, i) { let g = 0, t = 0; ids.forEach(id => { const x = week.byType[id]; if (x) { g += x.goalCum[i]; t += (x.totalCum[i] || 0); } }); return { g, t }; }

  /* ---------------- 主渲染 ---------------- */
  function render() {
    const ids = selIds();
    const agg6 = aggAt(ids, 6);
    const aggNow = aggAt(ids, focusIdx);
    const aggSt = opAggStatus(ids, focusIdx, week);
    const earn = opEarnSeriesCfg(ids, week, OPTypeStore.all(), cfg);
    const redTypes = ids.filter(id => opTypeAlarm(id, week).red > 0);
    const warnTypes = ids.filter(id => opTypeAlarm(id, week).red === 0 && opTypeAlarm(id, week).yellow > 0);
    const overCells = countOverCells(ids);

    document.getElementById('content').innerHTML = `

      <div class="card mt16 no-print">
        <div class="card-head">
          <div class="card-title">${icon('filter', 19)} 筛选
            <span class="card-sub">年份 / 周别 / 视角部门 / PKG Type 单选多选（当前 ${ids.length} 类）</span></div>
          <div class="flex acenter gap8">
            <a class="btn btn-sm" href="output.html">${icon('activity', 16)} 返回 Output 大屏</a>
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
            <span class="chip">${icon('target', 14)} 周目标 ${fmt(agg6.g)}K</span>
            <span class="chip">${icon('activity', 14)} 周实际 ${hasActual ? fmt(aggNow.t) + 'K（' + focusLabel + '）' : '—'}</span>
            <span class="chip">${icon('check', 14)} 达成率 ${aggSt.rate == null ? '—' : aggSt.rate + '%'} ${badge(aggSt.status)}</span>
            <span class="chip">${icon('database', 14)} Earn 实际 ${earn.totalCum[focusIdx] == null ? '—' : earn.totalCum[focusIdx] + ' 万'}</span>
            <span class="chip" title="数量口径沿用周目标均摊；金额口径按配置页口径：周目标均摊 / 递进式（周六看上周五实际、周日看周六实际，逐日递进）">${icon('trend', 14)} Earn 目标口径：${earn.mode === 'progressive' ? '递进式 ±' + earn.pct + '%' : '周目标均摊'}</span>
            <span class="chip ${realInfo.real ? 'chip-real' : 'chip-demo'}">${icon('database', 14)} ${esc(realInfo.text)}</span>
            ${overCells ? `<span class="chip chip-danger">${icon('alert', 14)} 超标单元格 ${overCells} 个</span>` : ''}
            ${focusDay != null ? `<span class="chip chip-real" id="chipFocusDay" title="来自 Output 大屏浮窗点击 · 已在表中定位到该日（切换筛选后清除）">${icon('arrowRight', 14)} 已定位到大屏所选日期：${days[focusDay].label}（${days[focusDay].weekday}）</span>` : ''}
          </div>
        </div>
      </div>

      <div class="card mt16">
        <div class="card-head">
          <div class="card-title">${icon('layers', 19)} 周维度累计表
            <span class="card-sub">${year} 年第 ${weekNo} 周 · PKG Type ×（Output 目标 + 六[K]~五[K]）；goal / total / FE total 三行 + 底部 Earn 两行</span></div>
          <div class="flex acenter gap8">
            <span class="chip">${icon('alert', 14)} 达标 / 临界 / 超标 实时着色</span>
          </div>
        </div>
        <div class="card-body">
          ${renderWeekTable(ids)}
          <div class="wk-legend mt12">
            <span class="lg"><i style="background:#1d4ed8"></i>目标(累计) goal</span>
            <span class="lg"><i style="background:#12805a"></i>实际(累计) total</span>
            <span class="lg"><i class="sw-ok"></i>达标（绿灯）</span>
            <span class="lg"><i class="sw-warn"></i>临界（黄灯·脉冲）</span>
            <span class="lg"><i class="sw-bad"></i>超标（红灯·脉冲）</span>
            <span class="lg"><i class="sw-future"></i>未来日期（无数据）</span>
            <span class="lg"><i class="sw-nodata"></i>已过日期但无产出记录</span>
          </div>
        </div>
      </div>

      <div class="card mt16">
        <div class="card-head">
          <div class="card-title">${icon('alert', 19)} 异常报警 · 周维度（${focusLabel}）
            <span class="card-sub">差额比对 · 阈值逐 PKG Type 独立配置 · 逐品类列出累计、报警天数与当前阈值</span></div>
          ${redTypes.length ? `<span class="chip chip-danger">${icon('alert', 14)} ${redTypes.length} 类红灯</span>` : (warnTypes.length ? `<span class="chip">${icon('alert', 14)} ${warnTypes.length} 类黄灯</span>` : '<span class="chip">本周无报警</span>')}
        </div>
        <div class="card-body" style="max-height:360px;overflow:auto">
          ${renderAlarmTable(ids)}
        </div>
      </div>

      <div class="card mt16 no-print">
        <div class="card-head"><div class="card-title">${icon('alert', 19)} 口径说明
          <span class="card-sub">待客户确认项</span></div></div>
        <div class="card-body">
          <ul class="small muted" style="margin:0;padding-left:20px;line-height:1.9">
            <li><strong>目标(累计)</strong>：每周第一天填「一周总目标」，系统均摊到每天并以<strong>累计值</strong>逐日展示（示例 3,680 → 526、1,051、1,577…3,680）。</li>
            <li><strong>实际(累计)</strong>：由 IT 数据库定时获取（当前为确定性演示样例，库表 / 刷新频率待 IT 确认）。</li>
            <li><strong>异常判定</strong>：每日 goal vs total 差额，阈值<strong>逐个 PKG Type 独立配置</strong>（当前 ${opAlarmText(ids)}），在 <a href="op-config.html">OP 配置页 · ① PKG Type 维护</a> 中逐项维护。</li>
            <li><strong>FE 实际(累计)</strong>：预留扩展行，口径待定；<strong>Earn</strong> 由单价 × 累计实际换算（万元）。</li>
            <li>周目标、价格、报警阈值、刷新频率、夏令时等均可在 <a href="op-config.html">OP 配置页</a> 调整。</li>
          </ul>
        </div>
      </div>`;

    bindCommon();
  }

  function yearOptions() {
    const out = [];
    for (let y = cur.year - 1; y <= cur.year + 1; y++) out.push(`<option value="${y}" ${y === year ? 'selected' : ''}>${y} 年</option>`);
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

  /* 超标单元格计数（用于摘要 chip） */
  function countOverCells(ids) {
    let n = 0;
    ids.forEach(id => {
      const t = week.byType[id]; if (!t) return;
      for (let i = 0; i <= lastIdx; i++) { if (t.totalCum[i] != null && opStatus(id, i, week).status === 'over') n++; }
    });
    return n;
  }

  /* ---------------- 周维度累计表 ---------------- */
  function renderWeekTable(ids) {
    const focusCls = i => (i === focusDay ? ' is-focus' : '');
    const head = `<thead><tr>
      <th class="lbl">PKG Type</th>
      <th class="lbl">Output 目标 [K]</th>
      ${wdLabel.map((w, i) => `<th class="${i === todayIdx ? 'is-today' : ''}${focusCls(i)}">${w} [K]${i === todayIdx ? ' <span class="tod">今</span>' : ''}${focusDay === i ? ' <span class="tod">定</span>' : ''}</th>`).join('')}
    </tr></thead>`;

    const body = ids.map(id => {
      const t = week.byType[id]; if (!t) return '';
      const info = pkgTypes.find(p => p.id === id) || {};
      const stNow = opStatus(id, focusIdx, week);
      const meta = `<div class="small muted" style="margin-top:2px">${focusLabel}：差额 ${stNow.diff == null ? '—' : (stNow.diff >= 0 ? '+' : '') + stNow.diff + 'K'} · ${opStatusInfo(stNow.status).label}</div>`;
      const goalCells = t.goalCum.map((v, i) => `<td class="${i === todayIdx ? 'is-today' : ''}${focusCls(i)}">${v}</td>`).join('');
      const totalCells = t.totalCum.map((v, i) => {
        if (v == null) {
          // 未来日期 → 斜纹「无数据」；已过去但无产出的日期（真实数据未覆盖）→ 浅灰「—」，两者含义不同
          const cls = days[i].isFuture ? 'cell-future' : 'cell-nodata';
          return `<td class="${cls} ${i === todayIdx ? 'is-today' : ''}${focusCls(i)}">—</td>`;
        }
        const st = opStatus(id, i, week);
        const cls = st.status === 'over' ? 'cell-bad' : (st.status === 'critical' ? 'cell-warn' : '');
        const flag = st.status === 'met' ? '' : `<span class="cell-flag ${st.status === 'over' ? 'flag-bad' : 'flag-warn'}">${st.status === 'over' ? '超' : '警'}</span>`;
        return `<td class="${cls} ${i === todayIdx ? 'is-today' : ''}${focusCls(i)}">${v}${flag}</td>`;
      }).join('');
      const feCells = `<td colspan="7" class="cell-fe">—（预留扩展行 · FE total）</td>`;
      return `
        <tr class="row-goal">
          <td class="lbl"><span class="pt-dot" style="background:${info.color || '#1d4ed8'}"></span><strong>${esc(id)}</strong>${meta}</td>
          <td class="lbl goal-num">目标(累计)</td>${goalCells}
        </tr>
        <tr class="row-total">
          <td class="lbl"></td>
          <td class="lbl">实际(累计)</td>${totalCells}
        </tr>
        <tr class="row-fe">
          <td class="lbl"></td>
          <td class="lbl">FE 实际(累计)</td>${feCells}
        </tr>`;
    }).join('');

    const earn = opEarnSeriesCfg(ids, week, OPTypeStore.all(), cfg);
    const earnGoalCells = earn.goalCum.map((v, i) => `<td class="${i === todayIdx ? 'is-today' : ''}${focusCls(i)}">${v}</td>`).join('');
    const earnTotalCells = earn.totalCum.map((v, i) => `<td class="${i === todayIdx ? 'is-today' : ''}${focusCls(i)}">${v == null ? '—' : v}</td>`).join('');
    const foot = `
      <tr class="row-earn row-earn-goal">
        <td class="lbl"></td>
        <td class="lbl">Earn 目标(累计) 万<div class="small muted" style="font-weight:400">${earn.mode === 'progressive' ? '递进式 ±' + earn.pct + '%' : '周目标均摊'}</div></td>${earnGoalCells}
      </tr>
      <tr class="row-earn row-earn-total">
        <td class="lbl"></td>
        <td class="lbl">Earn 实际(累计) 万</td>${earnTotalCells}
      </tr>`;

    return `<div class="wk-scroll"><table class="wk">${head}<tbody>${body}${foot}</tbody></table></div>`;
  }

  /* ---------------- 异常报警表（周维度，截至基准日累计） ---------------- */
  function renderAlarmTable(ids) {
    const rows = ids.map(id => {
      const t = week.byType[id]; if (!t) return '';
      const st = opStatus(id, focusIdx, week);
      const a = opTypeAlarm(id, week);
      const th = opAlarmOf(id);
      return `<tr><td><span class="pt-dot" style="background:${(pkgTypes.find(p => p.id === id) || {}).color || '#1d4ed8'}"></span> <strong>${esc(id)}</strong></td>
        <td class="center num">${t.goalCum[focusIdx].toLocaleString()}</td>
        <td class="center num">${t.totalCum[focusIdx] == null ? '—' : t.totalCum[focusIdx].toLocaleString()}</td>
        <td class="center num" style="color:${st.diff != null && st.diff < 0 ? 'var(--danger)' : 'var(--success)'}">${st.diff == null ? '—' : (st.diff >= 0 ? '+' : '') + st.diff + 'K'}</td>
        <td class="center num">${st.rate == null ? '—' : st.rate + '%'}</td>
        <td class="center">${badge(st.status)}</td>
        <td class="center num muted">黄 ${th.yellowK}K / 红 ${th.redK}K</td>
        <td class="center">${a.red ? `<span class="badge b-danger">红 ${a.red} 天</span>` : (a.yellow ? `<span class="badge b-warn">黄 ${a.yellow} 天</span>` : '<span class="muted">—</span>')}</td>
        <td class="center num">${a.maxGap ? a.maxGap + 'K' : '—'}</td></tr>`;
    }).join('');
    return `<table class="table"><thead><tr>
      <th>PKG Type</th><th class="center">周目标(累计)</th><th class="center">周实际(累计)</th>
      <th class="center">差额(实际-目标)</th><th class="center">达成率</th><th class="center">状态</th>
      <th class="center">报警阈值</th>
      <th class="center">本周报警天数</th><th class="center">最大缺口</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="9" class="center muted">无数据（当前部门可见范围为空，请在 OP 配置页调整）</td></tr>'}</tbody></table>`;
  }

  /* ---------------- 事件绑定 ---------------- */
  function bindCommon() {
    /* 「定位日」是一次性定位：用户在本页做任何筛选变更后即清除 */
    const clearFocus = () => { if (focusDay != null) { focusDay = null; store.set('op_table_focus', null); } };
    const sy = document.getElementById('selYear');
    if (sy) sy.onchange = () => {
      year = Number(sy.value);
      const n = opWeeksInYear(year);
      if (weekNo > n) weekNo = n;
      clearFocus(); saveSel(); reload();
    };
    const sw = document.getElementById('selWeek');
    if (sw) sw.onchange = () => { clearFocus(); weekNo = Number(sw.value); saveSel(); reload(); };

    const sd = document.getElementById('selDept');
    if (sd) sd.onchange = () => {
      dept = sd.value;
      OPDeptStore.setPreviewDept(dept);
      applyDeptScope();
      filter = []; cfg.filter = []; saveCfg();
      clearFocus(); reload();
      toast('已切换视角部门：' + dept + '（可见 ' + pkgTypes.length + ' 类）', 'success');
    };

    const sf = document.getElementById('segFilter');
    if (sf) sf.querySelectorAll('button').forEach(b => b.onclick = () => {
      const f = b.dataset.f;
      if (f === '__all__') { filter = []; }
      else {
        const curSel = selIds();
        if (curSel.includes(f)) filter = curSel.filter(x => x !== f);
        else filter = curSel.concat(f);
        if (filter.length === 0) filter = [];
      }
      cfg.filter = filter.slice(); saveCfg();
      clearFocus(); render();
    });

    const bp = document.getElementById('btnCfgPage');
    if (bp) bp.onclick = () => {
      if (!canConfig) toast('当前角色无「Output（OP）」编辑权限，配置页为只读', 'warn');
      location.href = 'op-config.html';
    };

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
      const earn = opEarnSeriesCfg(ids, week, OPTypeStore.all(), cfg);
      rows.push(['Earn', '目标(累计) 万', '', ...earn.goalCum, '', '—']);
      rows.push(['Earn', '实际(累计) 万', '', ...earn.totalCum.map(v => v == null ? '—' : v), '', '—']);
      exportExcel('Output_OP_' + year + '_W' + String(weekNo).padStart(2, '0') + '_周维度累计表.xls', headers, rows);
      toast('已导出 Excel', 'success');
    };
  }

  function reload() {
    applyDeptScope();
    filter = filter.filter(id => pkgTypes.some(t => t.id === id));
    week = genOpWeek(year, weekNo);
    recalc();
    render();
  }

  render();
})();
