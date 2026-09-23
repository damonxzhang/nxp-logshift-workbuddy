/* ============ 异常根因智能分析 & 高频报警统计 ============ */
(function () {
  renderShell('analytics');

  const isAdmin = CurrentUser.isAdmin();
  const deptList = Array.from(new Set(ALARM_RECORDS.map(r => r.dept))).filter(Boolean).sort();
  let cfg = store.get('analytics_cfg', { gran: 'day', dim: 'keyword', scope: isAdmin ? 'all' : 'dept' });
  if (!cfg.gran) cfg.gran = 'day';
  if (!cfg.dim) cfg.dim = 'keyword';
  if (cfg.scope !== 'all' && !deptList.includes(cfg.scope)) cfg.scope = isAdmin ? 'all' : (CurrentUser.dept() || deptList[0] || '');

  const save = () => store.set('analytics_cfg', cfg);

  const GRAN_LABEL = { day: '按日', week: '按周', month: '按月' };
  const DIM_LABEL = { keyword: '关键词', sys: '来源系统', category: '根因分类', level: '告警等级' };
  const PALETTE = ['#1d4ed8', '#0b6a86', '#12805a', '#a8620b', '#8b5cf6', '#cc2f2a', '#0d6b4b', '#6b7280', '#2563eb', '#b45309'];

  function effectiveRecords() {
    if (isAdmin) {
      if (cfg.scope === 'all') return ALARM_RECORDS.slice();
      return ALARM_RECORDS.filter(r => r.dept === cfg.scope);
    }
    return ALARM_RECORDS.filter(r => r.dept === CurrentUser.dept());
  }

  function scopeBadge() {
    if (isAdmin) {
      return cfg.scope === 'all'
        ? `<span class="scope-badge">${icon('shield', 15)} 数据范围：全部数据（系统管理员）</span>`
        : `<span class="scope-badge limited">${icon('shield', 15)} 数据范围：仅「${esc(cfg.scope)}」</span>`;
    }
    return `<span class="scope-badge limited">${icon('lock', 15)} 数据范围：本处室及下属 · ${esc(CurrentUser.dept())}（受角色权限限制）</span>`;
  }

  function render() {
    const recs = effectiveRecords();
    const st = computeAlarmStats(recs, { granularity: cfg.gran, dim: cfg.dim });
    const fmtRange = st.range ? `${st.range.from.getFullYear()}/${pad2(st.range.from.getMonth() + 1)}/${pad2(st.range.from.getDate())} - ${st.range.to.getFullYear()}/${pad2(st.range.to.getMonth() + 1)}/${pad2(st.range.to.getDate())}` : '—';
    const topKw = st.top[0] ? st.top[0].label : '—';
    const canExport = CurrentUser.can('analysis', 'export');

    document.getElementById('content').innerHTML = `
    <div class="notice" style="--nc:var(--primary)">
      ${icon('activity', 19)}
      <div><strong>异常根因智能分析：</strong>系统按可配置字段对告警数据聚合统计，支持<strong>按日 / 周 / 月</strong>统计告警频次并输出 <strong>TOP 高频告警排行</strong>；同时基于<strong>告警关键词、来源系统、发生时间</strong>自动归类相似告警，区分<strong>偶发告警</strong>与<strong>批量连锁告警</strong>，辅助定位问题根因。统计口径遵循分级权限，当前身份仅可见其权限范围内数据。</div>
    </div>

    <div class="card mt16">
      <div class="card-head">
        <div class="card-title">${icon('settings', 19)} 统计口径配置
          <span class="card-sub">预留字段配置入口 · 正式口径待与客户确认</span></div>
        ${scopeBadge()}
      </div>
      <div class="card-body">
        <div class="cfg-row">
          <div class="cfg-item">
            <label class="field-label">时间粒度</label>
            <div class="seg" id="segGran">
              ${['day', 'week', 'month'].map(g => `<button data-g="${g}" class="${cfg.gran === g ? 'active' : ''}">${GRAN_LABEL[g]}</button>`).join('')}
            </div>
          </div>
          <div class="cfg-item">
            <label class="field-label">统计维度（高频排行口径）</label>
            <select class="select" id="selDim" style="width:172px">
              ${Object.keys(DIM_LABEL).map(d => `<option value="${d}" ${cfg.dim === d ? 'selected' : ''}>${DIM_LABEL[d]}</option>`).join('')}
            </select>
          </div>
          <div class="cfg-item">
            <label class="field-label">数据范围</label>
            ${isAdmin
              ? `<select class="select" id="selScope" style="width:200px"><option value="all" ${cfg.scope === 'all' ? 'selected' : ''}>全部数据</option>${deptList.map(d => `<option value="${d}" ${cfg.scope === d ? 'selected' : ''}>仅 ${esc(d)}</option>`).join('')}</select>`
              : `<select class="select" id="selScope" style="width:200px" disabled><option>${esc(CurrentUser.dept())}（本处室及下属）</option></select>`}
          </div>
          <div class="cfg-item" style="flex:1;min-width:240px">
            <label class="field-label">说明</label>
            <div class="cfg-note">聚合字段（关键词 / 系统 / 分类 / 等级）、聚类时间窗、偶发与连锁判定阈值均为<strong>可配置项</strong>，此处先开放演示入口，正式上线后由后端配置中心统一管理，避免写在页面。</div>
          </div>
        </div>
      </div>
    </div>

    <div class="card mt24">
      <div class="stat-strip">
        <div class="si"><div class="si-label">统计周期告警总数</div><div class="si-value">${st.total}</div></div>
        <div class="si"><div class="si-label">特急（Critical）</div><div class="si-value" style="color:var(--danger)">${st.critical}</div></div>
        <div class="si"><div class="si-label">高频 TOP 关键词</div><div class="si-value" style="font-size:17px">${esc(topKw)}</div></div>
        <div class="si"><div class="si-label">批量连锁告警簇</div><div class="si-value" style="color:var(--danger)">${st.byType.chained}</div></div>
        <div class="si"><div class="si-label">偶发告警</div><div class="si-value">${st.byType.occasional}</div></div>
        <div class="si"><div class="si-label">闭环率</div><div class="si-value" style="color:var(--success)">${st.closedRate}%</div></div>
      </div>
    </div>

    <div class="grid g-23 mt24">
      <div class="card">
        <div class="card-head"><div class="card-title">${icon('activity', 19)} 告警频次趋势（${GRAN_LABEL[cfg.gran]}）</div></div>
        <div class="card-body"><div id="trendChart"></div>
          <div class="flex gap8 mt16" style="font-size:13.5px;color:var(--text-2)">
            <span class="chip info">■ 告警总量</span><span class="chip danger">■ 其中特急</span>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-head"><div class="card-title">${icon('layers', 19)} 告警构成</div></div>
        <div class="card-body">
          <div class="grid g-2" style="gap:10px;align-items:center">
            <div style="text-align:center"><div id="donutType"></div><div class="sub-note" style="margin-top:6px">偶发 vs 批量连锁</div></div>
            <div style="text-align:center"><div id="donutLevel"></div><div class="sub-note" style="margin-top:6px">告警等级</div></div>
          </div>
        </div>
      </div>
    </div>

    <div class="grid g-2 mt24">
      <div class="card">
        <div class="card-head"><div class="card-title">${icon('zap', 19)} TOP 高频告警排行（按${DIM_LABEL[cfg.dim]}）</div>
          <button class="btn btn-sm ${canExport ? '' : 'btn-ghost'}" id="btnExport" ${canExport ? '' : 'disabled title="当前角色无导出权限"'}>${icon('download', 15)} 导出 Excel</button></div>
        <div class="card-body"><div id="topBars"></div></div>
        <div class="card-foot">${icon('alert', 15)} 排行数据由「异常根因分析」引擎按当前口径实时计算，月报模块直接复用同一口径。</div>
      </div>
      <div class="card">
        <div class="card-head"><div class="card-title">${icon('bell', 19)} 告警处置情况</div></div>
        <div class="card-body">
          <div id="statusBars"></div>
          <div class="fixed-kv mt16">
            <div>已闭环</div><div><strong style="color:var(--success)">${st.byStatus.closed}</strong> 起</div>
            <div>处理中</div><div><strong style="color:var(--warn)">${st.byStatus.doing}</strong> 起</div>
            <div>待处理</div><div><strong style="color:var(--danger)">${st.byStatus.pending}</strong> 起</div>
          </div>
        </div>
      </div>
    </div>

    <div class="card mt24">
      <div class="card-head"><div class="card-title">${icon('search', 19)} 相似告警聚类与根因研判
        <span class="card-sub">基于关键词 + 来源系统 + 发生时间自动归类</span></div>
        <span class="badge b-neutral">共 ${st.clusters.length} 个聚类</span></div>
      <div class="card-body" style="padding:0">
        <div style="overflow-x:auto">
        <table class="table">
          <thead><tr><th>代表关键词</th><th>根因分类</th><th>关联系统</th><th>时间窗口</th><th class="center">同类数量</th><th class="center">类型</th><th>根因研判与处置建议</th></tr></thead>
          <tbody>
            ${st.clusters.length ? st.clusters.slice(0, 14).map(c => `
              <tr>
                <td class="tname">${esc(c.keyword)}</td>
                <td><span class="chip">${esc(c.category)}</span></td>
                <td class="small">${(c.sysNames || []).map(esc).join('、')}</td>
                <td class="small num">${c.first.getFullYear()}/${pad2(c.first.getMonth() + 1)}/${pad2(c.first.getDate())} ~ ${c.last.getDate()}日</td>
                <td class="center"><span class="badge ${c.type === 'chained' ? 'b-danger' : 'b-info'}">${c.count}</span></td>
                <td class="center"><span class="badge ${c.type === 'chained' ? 'b-danger' : 'b-info'}">${c.type === 'chained' ? '批量连锁' : '偶发'}</span></td>
                <td class="small muted">${esc(c.suggestion)}</td>
              </tr>`).join('') : `<tr><td colspan="7" class="center muted" style="padding:34px">当前范围内暂无聚类数据</td></tr>`}
          </tbody>
        </table>
        </div>
      </div>
      <div class="card-foot">${icon('check', 15)} 同一关键词一天内出现 ≥3 次或跨 ≥2 个子系统同时出现，判定为<strong>批量连锁</strong>，建议优先排查共性根因（网络 / 存储 / 数据库 / 渠道）；其余视为<strong>偶发</strong>。</div>
    </div>`;

    /* ---- 图表 ---- */
    lineChart(document.getElementById('trendChart'), {
      series: [
        { data: st.series.counts, color: '#1d4ed8', fill: true },
        { data: st.series.criticals, color: '#cc2f2a', fill: false }
      ],
      labels: st.series.labels, height: 250
    });
    donut(document.getElementById('donutType'), [
      { label: '偶发', value: st.byType.occasional, color: '#0b6a86' },
      { label: '批量连锁', value: st.byType.chained, color: '#cc2f2a' }
    ], 168, st.byType.chained + st.byType.occasional, '簇');
    donut(document.getElementById('donutLevel'), [
      { label: '特急', value: st.critical, color: '#cc2f2a' },
      { label: '重要', value: st.warn, color: '#a8620b' },
      { label: '正常', value: st.normal, color: '#12805a' }
    ], 168, st.total, '条');
    hBars(document.getElementById('topBars'), st.top.map((t, i) => ({ label: t.label, value: t.value, color: PALETTE[i % PALETTE.length] })));
    hBars(document.getElementById('statusBars'), [
      { label: '已闭环', value: st.byStatus.closed, color: '#12805a' },
      { label: '处理中', value: st.byStatus.doing, color: '#a8620b' },
      { label: '待处理', value: st.byStatus.pending, color: '#cc2f2a' }
    ]);

    /* ---- 交互 ---- */
    document.querySelectorAll('#segGran button').forEach(b => b.onclick = () => { cfg.gran = b.getAttribute('data-g'); save(); render(); });
    const sd = document.getElementById('selDim'); sd && sd.addEventListener('change', e => { cfg.dim = e.target.value; save(); render(); });
    const ss = document.getElementById('selScope'); ss && ss.addEventListener('change', e => { cfg.scope = e.target.value; save(); render(); });
    const be = document.getElementById('btnExport');
    if (be) be.onclick = () => {
      if (!canExport) { toast('当前角色「' + CurrentUser.roleNames().join('/') + '」无【异常根因分析-导出】权限', 'danger'); return; }
      const rows = st.top.map((t, i) => [i + 1, t.label, t.value, t.pct + '%', t.systems, t.recent]);
      exportExcel('高频告警统计_' + (cfg.scope === 'all' ? '全部数据' : cfg.scope) + '.xls',
        ['排名', DIM_LABEL[cfg.dim], '发生次数', '占比', '关联系统数', '近30天'], rows);
      toast('已导出高频告警统计 Excel（演示）', 'success');
    };
  }

  render();
})();
