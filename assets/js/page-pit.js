/* ============ P2 专属大屏：各站凹库 / 微水调库统计看板 ============ */
(function () {
  renderShell('pit');

  const isAdmin = CurrentUser.isAdmin();
  const deptList = Array.from(new Set(PIT_RECORDS.map(r => r.dept))).filter(Boolean).sort();
  let cfg = store.get('pit_cfg', {
    dim: 'station',
    thresholdH: 24,
    criticalH: 48,
    window: '24H',
    scope: isAdmin ? 'all' : 'dept'
  });
  if (!cfg.dim) cfg.dim = 'station';
  if (cfg.scope !== 'all' && !deptList.includes(cfg.scope)) cfg.scope = isAdmin ? 'all' : (CurrentUser.dept() || deptList[0] || '');
  const save = () => store.set('pit_cfg', cfg);

  const DIM_LABEL = { station: '按站段', machine: '按机台', shift: '按班次', pkg: '按封装' };
  const WINDOWS = ['8H', '12H', '24H', '48H', '7D'];

  function effectiveRecords() {
    if (isAdmin) {
      if (cfg.scope === 'all') return PIT_RECORDS.slice();
      return PIT_RECORDS.filter(r => r.dept === cfg.scope);
    }
    return scopePitRecords(PIT_RECORDS, CurrentUser.scope(), CurrentUser.dept());
  }

  function scopeBadge() {
    if (isAdmin) {
      return cfg.scope === 'all'
        ? `<span class="scope-badge">${icon('shield', 15)} 数据范围：全部数据（系统管理员）</span>`
        : `<span class="scope-badge limited">${icon('shield', 15)} 数据范围：仅「${esc(cfg.scope)}」</span>`;
    }
    return `<span class="scope-badge limited">${icon('lock', 15)} 数据范围：本处室及下属 · ${esc(CurrentUser.dept())}（受角色权限限制）</span>`;
  }

  function statusBadge(hours) {
    const s = pitStatus(hours, cfg);
    if (s === 'critical') return `<span class="badge b-danger">超期 ${hours}H</span>`;
    if (s === 'warn') return `<span class="badge b-warn">预警 ${hours}H</span>`;
    return `<span class="badge b-success">正常 ${hours}H</span>`;
  }

  function render() {
    const recs = effectiveRecords();
    const st = computePitStats(recs, cfg);
    const canExport = CurrentUser.can('pit', 'export');
    const sorted = recs.slice().sort((a, b) => b.hours - a.hours).slice(0, 30);
    const transfers = isAdmin
      ? PIT_TRANSFERS.slice(0, 20)
      : PIT_TRANSFERS.filter(t => t.dept === CurrentUser.dept()).slice(0, 20);

    document.getElementById('content').innerHTML = `
    <div class="notice" style="--nc:var(--primary)">
      ${icon('database', 19)}
      <div><strong>P2 专属大屏 · 各站凹库 / 微水调库统计看板：</strong>按站段、机台、班次等维度统计各站在库（凹库）批次量与在库时长，输出 <strong>超期预警</strong> 与 <strong>TOP 排行</strong>，并展示微水调库流水。
      <strong>术语（凹库 / 微水调库）、统计维度与判定阈值待 09-29 与客户确认</strong>，故全部做成配置入口，页面不写死口径。本屏遵循分级权限，仅可见权限范围内数据。</div>
    </div>

    <div class="card mt16">
      <div class="card-head">
        <div class="card-title">${icon('settings', 19)} 统计口径配置
          <span class="card-sub">预留配置入口 · 正式口径待与客户确认</span></div>
        ${scopeBadge()}
      </div>
      <div class="card-body">
        <div class="cfg-row">
          <div class="cfg-item">
            <label class="field-label">统计维度</label>
            <select class="select" id="selDim" style="width:150px">
              ${Object.keys(DIM_LABEL).map(d => `<option value="${d}" ${cfg.dim === d ? 'selected' : ''}>${DIM_LABEL[d]}</option>`).join('')}
            </select>
          </div>
          <div class="cfg-item">
            <label class="field-label">预警阈值（在库时长）</label>
            <div class="flex acenter gap8">
              <input class="input" id="inpWarn" type="number" min="1" max="168" style="width:78px" value="${cfg.thresholdH}">
              <span class="small muted">小时</span>
            </div>
          </div>
          <div class="cfg-item">
            <label class="field-label">超期阈值（在库时长）</label>
            <div class="flex acenter gap8">
              <input class="input" id="inpCrit" type="number" min="2" max="336" style="width:78px" value="${cfg.criticalH}">
              <span class="small muted">小时</span>
            </div>
          </div>
          <div class="cfg-item">
            <label class="field-label">统计时间窗口</label>
            <div class="seg" id="segWin">
              ${WINDOWS.map(w => `<button data-w="${w}" class="${cfg.window === w ? 'active' : ''}">${w}</button>`).join('')}
            </div>
          </div>
          <div class="cfg-item">
            <label class="field-label">数据范围</label>
            ${isAdmin
        ? `<select class="select" id="selScope" style="width:150px">
                   <option value="all" ${cfg.scope === 'all' ? 'selected' : ''}>全部数据</option>
                   ${deptList.map(d => `<option value="${esc(d)}" ${cfg.scope === d ? 'selected' : ''}>仅 ${esc(d)}</option>`).join('')}
                 </select>`
        : `<span class="chip">${esc(CurrentUser.dept())}（角色限定）</span>`}
          </div>
        </div>
        <div class="cfg-note">
          ${icon('alert', 15)} 数据来源：<strong>${esc(PIT_DEFAULTS.source)}</strong>；当前屏为 P2 首批交付，与需求表第 6 项「Weekly Output / BE&amp;FE 各站 WIP」是否为同一口径，需周二向客户确认。
        </div>
      </div>
    </div>

    <div class="grid g-6 mt16">
      <div class="kpi"><div class="kpi-top"><div class="kpi-name">在库批次</div><div class="kpi-icon" style="--accent:#1d4ed8;--accent-soft:#e7eeff">${icon('database', 20)}</div></div>
        <div class="kpi-value">${st.total}<span class="kpi-unit">批</span></div><div class="kpi-foot">覆盖 ${st.coveredStations} 个站段</div></div>
      <div class="kpi"><div class="kpi-top"><div class="kpi-name">在库总量</div><div class="kpi-icon" style="--accent:#0b6a86;--accent-soft:#e2f3f9">${icon('layers', 20)}</div></div>
        <div class="kpi-value">${(st.qty / 1000).toFixed(1)}<span class="kpi-unit">K</span></div><div class="kpi-foot">片 / 盘（按批次累加）</div></div>
      <div class="kpi"><div class="kpi-top"><div class="kpi-name">超阈值预警</div><div class="kpi-icon" style="--accent:#a8620b;--accent-soft:#fdf1e0">${icon('alert', 20)}</div></div>
        <div class="kpi-value" style="color:var(--warn)">${st.warn}<span class="kpi-unit">批</span></div><div class="kpi-foot">在库 > ${cfg.thresholdH}H</div></div>
      <div class="kpi"><div class="kpi-top"><div class="kpi-name">已超期</div><div class="kpi-icon" style="--accent:#cc2f2a;--accent-soft:#fdecea">${icon('zap', 20)}</div></div>
        <div class="kpi-value" style="color:var(--danger)">${st.critical}<span class="kpi-unit">批</span></div><div class="kpi-foot">在库 > ${cfg.criticalH}H</div></div>
      <div class="kpi"><div class="kpi-top"><div class="kpi-name">平均在库时长</div><div class="kpi-icon" style="--accent:#8b5cf6;--accent-soft:#f1ebfe">${icon('clock', 20)}</div></div>
        <div class="kpi-value">${st.avgHours}<span class="kpi-unit">H</span></div><div class="kpi-foot">最长 ${st.maxHours}H</div></div>
      <div class="kpi"><div class="kpi-top"><div class="kpi-name">今日调库</div><div class="kpi-icon" style="--accent:#12805a;--accent-soft:#e3f6ee">${icon('refresh', 20)}</div></div>
        <div class="kpi-value">${st.transferToday}<span class="kpi-unit">次</span></div><div class="kpi-foot">近 7 日累计 ${st.transferTotal} 次</div></div>
    </div>

    <div class="grid g-2 mt16">
      <div class="card">
        <div class="card-head"><div class="card-title">${icon('grid', 19)} 各站段凹库量
          <span class="card-sub">在库批次数</span></div></div>
        <div class="card-body"><div id="cStation"></div></div>
      </div>
      <div class="card">
        <div class="card-head"><div class="card-title">${icon('clock', 19)} 在库时长分布
          <span class="card-sub">按当前阈值划分</span></div></div>
        <div class="card-body flex acenter" style="gap:20px">
          <div id="cAge"></div>
          <div style="flex:1">${st.ageDist.map(b => `
            <div class="flex between acenter" style="margin-bottom:10px">
              <span class="flex acenter gap8"><i style="width:10px;height:10px;border-radius:3px;background:${b.color};display:inline-block"></i>${b.label}</span>
              <strong class="num">${b.value} 批</strong>
            </div>`).join('')}
          </div>
        </div>
      </div>
    </div>

    <div class="card mt16">
      <div class="card-head"><div class="card-title">${icon('activity', 19)} 近 14 日在库 / 调出趋势
        <span class="card-sub">入库批次 vs 调出批次</span></div></div>
      <div class="card-body"><div id="cTrend"></div></div>
    </div>

    <div class="grid g-2 mt16">
      <div class="card">
        <div class="card-head"><div class="card-title">${icon('server', 19)} 机台 TOP 10
          <span class="card-sub">在库批次最多</span></div></div>
        <div class="card-body"><div id="cMachine"></div></div>
      </div>
      <div class="card">
        <div class="card-head"><div class="card-title">${icon('layers', 19)} ${DIM_LABEL[cfg.dim]}汇总
          <span class="card-sub">当前统计维度</span></div>
          <span class="badge b-neutral">共 ${st.byDim.length} 组</span></div>
        <div class="card-body" style="max-height:340px;overflow:auto">
          <table class="table">
            <thead><tr><th>${cfg.dim === 'shift' ? '班次' : cfg.dim === 'pkg' ? '封装' : cfg.dim === 'machine' ? '机台' : '站段'}</th>
              <th class="center">在库批次</th><th class="center">预警</th><th class="center">超期</th><th class="center">平均时长</th></tr></thead>
            <tbody>${st.byDim.slice(0, 12).map(g => `
              <tr><td><strong>${esc(g.label)}</strong></td><td class="center num">${g.value}</td>
                <td class="center"><span class="badge b-warn">${g.warn}</span></td>
                <td class="center"><span class="badge b-danger">${g.critical}</span></td>
                <td class="center num">${g.avgHours}H</td></tr>`).join('') || '<tr><td colspan="5" class="center muted">当前数据范围无记录</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="card mt16">
      <div class="card-head">
        <div class="card-title">${icon('alert', 19)} 在库批次明细
          <span class="card-sub">按在库时长倒序 · 前 30 条</span></div>
        <div class="flex gap8">
          <span class="badge b-neutral">共 ${st.total} 批</span>
          <button class="btn btn-sm ${canExport ? 'btn-primary' : ''}" id="btnExport" ${canExport ? '' : 'disabled title="当前角色无导出权限"'}>
            ${icon('download', 16)} 导出 Excel</button>
        </div>
      </div>
      <div class="card-body" style="max-height:420px;overflow:auto">
        <table class="table">
          <thead><tr><th>批次号</th><th>站段</th><th>机台</th><th>封装</th><th class="center">数量</th>
            <th>入库时间</th><th>班次</th><th>在库时长</th></tr></thead>
          <tbody>${sorted.map(r => `
            <tr><td><strong>${esc(r.lot)}</strong></td><td>${esc(r.stationName)}</td><td>${esc(r.machine)}</td>
              <td>${esc(r.pkg)}</td><td class="center num">${r.qty}</td><td class="num">${r.inTimeStr}</td>
              <td>${r.shift}</td><td>${statusBadge(r.hours)}</td></tr>`).join('') || '<tr><td colspan="8" class="center muted">当前数据范围无记录</td></tr>'}</tbody>
        </table>
      </div>
    </div>

    <div class="card mt16">
      <div class="card-head"><div class="card-title">${icon('refresh', 19)} 微水调库流水
        <span class="card-sub">近 7 日 · 前 20 条</span></div>
        <span class="badge b-neutral">累计 ${st.transferTotal} 次</span></div>
      <div class="card-body" style="max-height:360px;overflow:auto">
        <table class="table">
          <thead><tr><th>单号</th><th>时间</th><th>站段</th><th>机台</th><th>批次号</th>
            <th class="center">方向</th><th class="center">数量</th><th>操作人</th></tr></thead>
          <tbody>${transfers.map(t => `
            <tr><td><strong>${esc(t.id)}</strong></td><td class="num">${t.timeStr}</td><td>${esc(t.stationName)}</td>
              <td>${esc(t.machine)}</td><td>${esc(t.lot)}</td>
              <td class="center"><span class="badge ${t.dir === '调入' ? 'b-info' : 'b-success'}">${t.dir}</span></td>
              <td class="center num">${t.qty}</td><td>${esc(t.operator)}</td></tr>`).join('') || '<tr><td colspan="8" class="center muted">当前数据范围无记录</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;

    // 图表
    hBars(document.getElementById('cStation'), st.stations.map(s => ({ label: s.label + '（' + s.value + ' 批）', value: s.value, color: '#1d4ed8' })), ' 批');
    donut(document.getElementById('cAge'), st.ageDist, 190, st.total, '在库批次');
    lineChart(document.getElementById('cTrend'), {
      labels: st.trend.labels, height: 250, min: 0,
      max: Math.max(...st.trend.inn, ...st.trend.outn) * 1.2, yUnit: ' 批',
      series: [
        { name: '入库', data: st.trend.inn, color: '#1d4ed8', fill: true },
        { name: '调出', data: st.trend.outn, color: '#12805a' }
      ]
    });
    hBars(document.getElementById('cMachine'), st.byMachine.map((m, i) => ({
      label: m.label + '（' + m.value + ' 批）', value: m.value,
      color: m.critical > 0 ? '#cc2f2a' : (m.warn > 0 ? '#a8620b' : '#0b6a86')
    })), ' 批');

    // 事件
    document.getElementById('selDim').onchange = e => { cfg.dim = e.target.value; save(); render(); };
    const iw = document.getElementById('inpWarn'), ic = document.getElementById('inpCrit');
    iw.onchange = () => {
      let v = Math.max(1, Math.min(168, Number(iw.value) || 24));
      cfg.thresholdH = v; if (v >= cfg.criticalH) cfg.criticalH = v + 24; save(); render();
    };
    ic.onchange = () => {
      let v = Math.max(2, Math.min(336, Number(ic.value) || 48));
      cfg.criticalH = v; if (v <= cfg.thresholdH) cfg.thresholdH = Math.max(1, v - 24); save(); render();
    };
    document.querySelectorAll('#segWin button').forEach(b => {
      b.onclick = () => { cfg.window = b.dataset.w; save(); render(); };
    });
    const ss = document.getElementById('selScope');
    if (ss) ss.onchange = e => { cfg.scope = e.target.value; save(); render(); };
    const be = document.getElementById('btnExport');
    if (be) be.onclick = () => {
      if (!CurrentUser.can('pit', 'export')) { toast('当前角色无「凹库看板」导出权限', 'warn'); return; }
      const rows = effectiveRecords().slice().sort((a, b) => b.hours - a.hours).map(r => [
        r.lot, r.stationName, r.machine, r.pkg, r.qty, r.inTimeStr, r.shift, r.hours + 'H',
        pitStatus(r.hours, cfg) === 'critical' ? '超期' : (pitStatus(r.hours, cfg) === 'warn' ? '预警' : '正常')
      ]);
      exportExcel(`各站凹库明细_${cfg.window}_阈值${cfg.thresholdH}H.xls`,
        ['批次号', '站段', '机台', '封装', '数量', '入库时间', '班次', '在库时长', '状态'], rows);
      toast('已导出凹库明细 Excel', 'success');
    };
  }

  render();
})();
