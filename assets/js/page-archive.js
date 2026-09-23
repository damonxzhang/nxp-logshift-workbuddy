/* ============ 历史日志归档 · 自动归档与检索查询 ============ */
(function () {
  renderShell('archive');

  const isAdmin = CurrentUser.isAdmin();
  const deptList = Array.from(new Set(LOG_RECORDS.map(r => r.dept))).filter(Boolean).sort();
  let cfg = Object.assign({}, ARCHIVE_DEFAULTS, store.get('archive_cfg', {}));
  if (typeof cfg.retentionDays !== 'number') cfg.retentionDays = ARCHIVE_DEFAULTS.retentionDays;
  if (!ARCHIVE_TRIGGER_LABEL[cfg.trigger]) cfg.trigger = 'auto';
  if (!ARCHIVE_STORAGE_LABEL[cfg.storage]) cfg.storage = 'object-cold';
  if (cfg.scope !== 'all' && !deptList.includes(cfg.scope)) cfg.scope = isAdmin ? 'all' : (CurrentUser.dept() || deptList[0] || '');

  const save = () => store.set('archive_cfg', cfg);

  const canView = CurrentUser.can('archive', 'view');
  const canSearch = canView;                     // 检索即查看能力（RBAC 6 动作模型下归入 view）
  const canExport = CurrentUser.can('archive', 'export');
  const canCreate = CurrentUser.can('archive', 'create');   // 手动触发归档

  const PALETTE = ['#1d4ed8', '#0b6a86', '#12805a', '#a8620b', '#8b5cf6', '#cc2f2a', '#0d6b4b', '#6b7280'];

  function effectiveRecords() {
    if (isAdmin) {
      if (cfg.scope === 'all') return LOG_RECORDS.slice();
      return LOG_RECORDS.filter(r => r.dept === cfg.scope);
    }
    return LOG_RECORDS.filter(r => r.dept === CurrentUser.dept());
  }
  function scopeLabel() {
    if (isAdmin) return cfg.scope === 'all' ? '全部数据' : cfg.scope;
    return CurrentUser.dept();
  }
  function scopeBadge() {
    if (isAdmin) {
      return cfg.scope === 'all'
        ? `<span class="scope-badge">${icon('shield', 15)} 数据范围：全部数据（系统管理员）</span>`
        : `<span class="scope-badge limited">${icon('shield', 15)} 数据范围：仅「${esc(cfg.scope)}」</span>`;
    }
    return `<span class="scope-badge limited">${icon('lock', 15)} 数据范围：本处室及下属 · ${esc(CurrentUser.dept())}（受角色权限限制）</span>`;
  }

  /* ---------------- 渲染 ---------------- */
  function render() {
    const recs = effectiveRecords();
    const st = computeArchiveStats(recs, cfg);
    const jobs = loadArchiveJobs();
    const nextAt = nextArchiveAt(cfg);
    const canManual = canCreate;

    document.getElementById('content').innerHTML = `
    <div class="notice" style="--nc:var(--info)">
      ${icon('database', 19)}
      <div><strong>历史日志归档：</strong>系统按可配置规则<strong>自动归档过期日志</strong>，将冷数据从主库移出，减少主库数据量、保障查询与系统性能；归档日志<strong>支持检索查询</strong>，满足审计追溯需求。<strong>归档时长、归档触发规则、存储方式</strong>均为预留配置入口，正式口径待与客户确认。</div>
    </div>

    <div class="card mt16">
      <div class="card-head">
        <div class="card-title">${icon('settings', 19)} 归档规则配置
          <span class="card-sub">预留字段配置入口 · 正式口径待与客户确认</span></div>
        ${scopeBadge()}
      </div>
      <div class="card-body">
        <div class="cfg-row">
          <div class="cfg-item">
            <label class="field-label">归档时长（天）</label>
            <select class="select" id="selRetention" style="width:172px">
              ${[30, 60, 90, 180, 365].map(d => `<option value="${d}" ${cfg.retentionDays === d ? 'selected' : ''}>${d} 天前</option>`).join('')}
            </select>
          </div>
          <div class="cfg-item">
            <label class="field-label">归档触发规则</label>
            <select class="select" id="selTrigger" style="width:200px">
              ${Object.keys(ARCHIVE_TRIGGER_LABEL).map(k => `<option value="${k}" ${cfg.trigger === k ? 'selected' : ''}>${ARCHIVE_TRIGGER_LABEL[k]}</option>`).join('')}
            </select>
          </div>
          <div class="cfg-item">
            <label class="field-label">存储方式</label>
            <select class="select" id="selStorage" style="width:240px">
              ${Object.keys(ARCHIVE_STORAGE_LABEL).map(k => `<option value="${k}" ${cfg.storage === k ? 'selected' : ''}>${ARCHIVE_STORAGE_LABEL[k]}</option>`).join('')}
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
            <div class="cfg-note">归档时长、触发规则与存储方式均为<strong>可配置项</strong>，此处先开放演示入口；上线后由后端配置中心统一管理，避免写在页面。检索与导出均按当前角色权限范围过滤。</div>
          </div>
        </div>
        <div class="rowline mt16">
          <div class="rl-title">${icon('refresh', 16)} 自动归档计划</div>
          <div class="rl-desc">归档触发规则：<strong>${esc(ARCHIVE_TRIGGER_LABEL[cfg.trigger])}</strong> · 下次自动归档：<strong>${esc(nextAt)}</strong></div>
          <button class="btn btn-primary btn-sm" id="btnArchive" ${canManual ? '' : 'disabled title="当前角色无【历史日志归档-手动触发】权限"'}>${icon('archive', 15)} 立即归档</button>
        </div>
      </div>
      <div class="card-foot">${icon('check', 15)} 手动「立即归档」会按当前规则将过期日志移出主库并登记一次归档任务（演示）。归档后主库在线日志量下降、查询性能提升。</div>
    </div>

    <div class="card mt24">
      <div class="stat-strip">
        <div class="si"><div class="si-label">主库在线日志</div><div class="si-value">${st.activeCount.toLocaleString()}</div></div>
        <div class="si"><div class="si-label">已归档日志</div><div class="si-value" style="color:var(--info)">${st.archivedCount.toLocaleString()}</div></div>
        <div class="si"><div class="si-label">累计释放主库空间</div><div class="si-value" style="color:var(--success)">${st.freedMB.toLocaleString()} <span style="font-size:13px;color:var(--text-2)">MB</span></div></div>
        <div class="si"><div class="si-label">归档覆盖率</div><div class="si-value">${st.coveragePct}%</div></div>
        <div class="si"><div class="si-label">归档任务次数</div><div class="si-value" style="color:var(--warn)">${jobs.length}</div></div>
        <div class="si"><div class="si-label">归档规则</div><div class="si-value" style="font-size:17px">${cfg.retentionDays}天 / ${cfg.storage === 'object-cold' ? '对象低频' : cfg.storage === 'cold' ? '冷热分层' : '归档库'}</div></div>
      </div>
      ${canExport ? `<div class="card-foot" style="border-top:1px solid var(--border);border-radius:0 0 var(--radius) var(--radius);display:flex;justify-content:flex-end"><button class="btn btn-sm" id="btnExportSummary">${icon('download', 15)} 导出归档统计 Excel</button></div>` : ''}
    </div>

    <div class="grid g-23 mt24">
      <div class="card">
        <div class="card-head"><div class="card-title">${icon('activity', 19)} 主库在线 vs 已归档趋势（近 12 个月）</div></div>
        <div class="card-body"><div id="trendChart"></div>
          <div class="flex gap8 mt16" style="font-size:13.5px;color:var(--text-2)">
            <span class="chip info">■ 主库在线</span><span class="chip" style="background:#e3f6ee;border-color:#bfe6d6;color:#0d6b4b">■ 已归档</span>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-head"><div class="card-title">${icon('layers', 19)} 已归档日志等级分布</div></div>
        <div class="card-body" style="text-align:center">
          <div id="donutLevel"></div>
          <div class="sub-note mt12">归档日志以 INFO / AUDIT 为主，ERROR 已保留便于审计复查</div>
        </div>
      </div>
    </div>

    <div class="grid g-2 mt24">
      <div class="card">
        <div class="card-head"><div class="card-title">${icon('server', 19)} 各系统已归档日志量（TOP 8）</div>
          <span class="badge b-info">共 ${st.bySystem.reduce((a, b) => a + b.value, 0).toLocaleString()} 条</span></div>
        <div class="card-body"><div id="sysBars"></div></div>
        <div class="card-foot">${icon('alert', 15)} 归档后主库仅保留近期热数据，各系统历史日志按年分区存放于归档存储，可随时检索追溯。</div>
      </div>
      <div class="card">
        <div class="card-head"><div class="card-title">${icon('database', 19)} 归档释放空间趋势（近 12 个月）</div></div>
        <div class="card-body"><div id="freedBars"></div>
          <div class="flex gap8 mt16" style="font-size:13.5px;color:var(--text-2)">
            <span class="chip info">■ 归档条数</span><span class="chip success">■ 释放空间(MB)</span>
          </div>
        </div>
      </div>
    </div>

    <div class="card mt24">
      <div class="card-head"><div class="card-title">${icon('refresh', 19)} 归档任务历史</div>
        <span class="badge b-neutral">${jobs.length} 条</span></div>
      <div class="card-body">${jobs.length ? `<div class="arc-jobs">${jobs.map(j => jobRow(j)).join('')}</div>` : `<div class="muted" style="padding:18px 4px">暂无归档任务记录。可点击上方「立即归档」执行一次，或等待自动归档触发。</div>`}</div>
    </div>

    <div class="card mt24 no-print-none">
      <div class="card-head"><div class="card-title">${icon('search', 19)} 归档日志检索查询
        <span class="card-sub">满足审计追溯 · 按当前角色权限范围过滤</span></div>
        <button class="btn btn-sm ${canExport ? '' : 'btn-ghost'}" id="btnExportSearch" ${canExport ? '' : 'disabled title="当前角色无【历史日志归档-导出】权限"'}>${icon('download', 15)} 导出检索结果</button></div>
      <div class="card-body">
        <div class="filterbar">
          <div class="fb" style="flex:2;min-width:260px">
            <label class="field-label">关键词（消息 / 动作 / 操作人 / 日志ID）</label>
            <div class="toolbar" style="max-width:none;flex:1">
              <div class="search" style="max-width:none;flex:1">
                ${icon('search', 16)}
                <input class="input" id="qKw" placeholder="如：越权访问 / 钱志强 / 交接单" />
              </div>
            </div>
          </div>
          <div class="fb">
            <label class="field-label">等级</label>
            <select class="select" id="qLevel" style="width:140px"><option value="">全部</option>${ARCHIVE_LEVELS.map(l => `<option value="${l}">${l}</option>`).join('')}</select>
          </div>
          <div class="fb">
            <label class="field-label">来源系统</label>
            <select class="select" id="qSys" style="width:200px"><option value="">全部</option>${archivedSysOptions()}</select>
          </div>
          <div class="fb">
            <label class="field-label">操作人</label>
            <select class="select" id="qOp" style="width:160px"><option value="">全部</option>${archivedOpOptions()}</select>
          </div>
          <div class="fb">
            <label class="field-label">起始日期</label>
            <input class="input" id="qFrom" type="date" style="width:170px" />
          </div>
          <div class="fb">
            <label class="field-label">结束日期</label>
            <input class="input" id="qTo" type="date" style="width:170px" />
          </div>
          <div class="fb">
            <label class="field-label">&nbsp;</label>
            <label class="checkline" style="margin:0;white-space:nowrap"><input type="checkbox" id="qInclude" /> 含主库在线日志</label>
          </div>
          <div class="fb">
            <label class="field-label">&nbsp;</label>
            <button class="btn btn-primary" id="btnSearch">${icon('search', 15)} 检索</button>
          </div>
        </div>
        <div class="mt16" id="searchCount" style="font-size:14.5px;color:var(--text-2)">共匹配 <strong id="scNum">0</strong> 条归档日志（默认仅检索已归档日志）。</div>
        <div style="overflow-x:auto;margin-top:10px" id="searchResults"></div>
      </div>
      <div class="card-foot">${icon('check', 15)} 检索默认覆盖<strong>已归档</strong>日志；勾选「含主库在线日志」可一并检索近 ${cfg.retentionDays} 天热数据。结果受当前角色数据范围限制。</div>
    </div>`;

    /* ---- 图表 ---- */
    lineChart(document.getElementById('trendChart'), {
      series: [
        { data: st.trend.active, color: '#1d4ed8', fill: true },
        { data: st.trend.archived, color: '#12805a', fill: false }
      ],
      labels: st.trend.labels, height: 250
    });
    donut(document.getElementById('donutLevel'), st.levelDist.length ? st.levelDist : [{ label: '无', value: 1, color: '#8a95a5' }], 190, st.archivedCount.toLocaleString(), '条');
    hBars(document.getElementById('sysBars'), st.bySystem.map((s, i) => ({ label: s.name + '（' + s.dept + '）', value: s.value, color: PALETTE[i % PALETTE.length] })));
    barGroup(document.getElementById('freedBars'), {
      labels: st.trend.labels,
      series: [
        { name: '归档条数', data: st.trend.archived, color: '#0b6a86' },
        { name: '释放空间(MB)', data: st.trend.freed, color: '#12805a' }
      ],
      height: 260
    });

    /* ---- 交互 ---- */
    const sr = document.getElementById('selRetention'); sr && sr.addEventListener('change', e => { cfg.retentionDays = +e.target.value; save(); render(); });
    const stT = document.getElementById('selTrigger'); stT && stT.addEventListener('change', e => { cfg.trigger = e.target.value; save(); render(); });
    const sS = document.getElementById('selStorage'); sS && sS.addEventListener('change', e => { cfg.storage = e.target.value; save(); render(); });
    const ss = document.getElementById('selScope'); ss && ss.addEventListener('change', e => { cfg.scope = e.target.value; save(); render(); });

    const ba = document.getElementById('btnArchive');
    if (ba) ba.onclick = () => {
      if (!canManual) { toast('当前角色「' + CurrentUser.roleNames().join('/') + '」无【历史日志归档-手动触发】权限', 'danger'); return; }
      const j = {
        time: fmtDT(new Date()), trigger: 'manual',
        rule: '归档 ' + cfg.retentionDays + ' 天前日志 · ' + ARCHIVE_STORAGE_LABEL[cfg.storage],
        count: st.archivedCount, freedMB: st.freedMB, scope: scopeLabel()
      };
      pushArchiveJob(j);
      toast('已执行手动归档：' + st.archivedCount.toLocaleString() + ' 条日志移出主库，释放 ' + st.freedMB.toLocaleString() + ' MB', 'success');
      render();
    };

    const be = document.getElementById('btnExportSummary');
    if (be) be.onclick = () => exportSummary(st);

    const bs = document.getElementById('btnSearch'); bs && bs.addEventListener('click', doSearch);
    const qk = document.getElementById('qKw'); qk && qk.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
    const bx = document.getElementById('btnExportSearch');
    if (bx) bx.onclick = () => {
      if (!canExport) { toast('当前角色无【历史日志归档-导出】权限', 'danger'); return; }
      exportSearch();
    };

    lastStats = st;
  }

  let lastStats = null;

  function jobRow(j) {
    return `<div class="arc-job">
      <div class="aj-time">${esc(j.time)}</div>
      <div class="aj-main"><div class="aj-title">${icon('archive', 15)} ${esc(j.trigger === 'manual' ? '手动归档' : '自动归档')}</div>
        <div class="aj-desc">${esc(j.rule)}${j.scope ? ' · 范围：' + esc(j.scope) : ''}</div></div>
      <div class="aj-stat"><div class="num" style="font-weight:700">${Number(j.count).toLocaleString()}</div><div class="sub-note">条 / 释放 ${Number(j.freedMB).toLocaleString()} MB</div></div>
    </div>`;
  }

  function archivedSysOptions() {
    const set = {}; effectiveRecords().forEach(r => { set[r.sysId] = r.sys; });
    return Object.keys(set).sort().map(k => `<option value="${k}">${esc(set[k])}</option>`).join('');
  }
  function archivedOpOptions() {
    const set = {}; effectiveRecords().forEach(r => { set[r.operator] = 1; });
    return Object.keys(set).sort().map(k => `<option value="${k}">${esc(k)}</option>`).join('');
  }

  /* ---------------- 检索 ---------------- */
  let lastQuery = null;
  function doSearch() {
    if (!canSearch) { toast('当前角色无检索权限', 'danger'); return; }
    const q = {
      kw: getVal('qKw'),
      level: getVal('qLevel'),
      sysId: getVal('qSys'),
      operator: getVal('qOp'),
      from: getVal('qFrom'),
      to: getVal('qTo'),
      includeActive: document.getElementById('qInclude') ? document.getElementById('qInclude').checked : false
    };
    lastQuery = q;
    const res = searchArchived(effectiveRecords(), cfg, q);
    document.getElementById('scNum').textContent = res.total.toLocaleString();
    document.getElementById('searchResults').innerHTML = res.total
      ? `<table class="table"><thead><tr><th>日志ID</th><th class="center">时间</th><th class="center">等级</th><th>来源系统</th><th>操作类型</th><th>动作</th><th>操作人</th><th>状态</th><th>体积</th><th>消息</th></tr></thead><tbody>
          ${res.rows.map(r => `<tr>
            <td class="small num">${esc(r.id)}</td>
            <td class="small num center">${r.ts.getFullYear()}/${pad2(r.ts.getMonth() + 1)}/${pad2(r.ts.getDate())} ${pad2(r.ts.getHours())}:${pad2(r.ts.getMinutes())}</td>
            <td class="center"><span class="badge ${ARCHIVE_LEVEL_META[r.level].cls}">${r.level}</span></td>
            <td class="small">${esc(r.sys)}</td>
            <td>${esc(r.category)}</td>
            <td class="small">${esc(r.action)}</td>
            <td class="small">${esc(r.operator)}</td>
            <td class="small">${esc(r.status)}</td>
            <td class="small num">${(+r.sizeKB).toFixed(1)} KB</td>
            <td class="small">${hl(r.msg, q.kw)}</td>
          </tr>`).join('')}
        </tbody></table>
        <div class="sub-note mt12">已显示前 ${res.rows.length} 条 / 共 ${res.total.toLocaleString()} 条（默认仅检索已归档日志）。</div>`
      : `<div class="muted" style="padding:24px 4px">未匹配到符合条件的归档日志，请调整检索条件。</div>`;
  }

  function exportSearch() {
    if (!lastQuery) { doSearch(); }
    const q = lastQuery || {};
    const res = searchArchived(effectiveRecords(), cfg, Object.assign({}, q, { limit: 5000 }));
    if (!res.total) { toast('当前检索条件下无数据可导出', 'warn'); return; }
    const headers = ['日志ID', '时间', '等级', '来源系统', '操作类型', '动作', '操作人', '状态', '体积KB', '消息'];
    const rows = res.rows.map(r => [r.id, fmtDT(r.ts), r.level, r.sys, r.category, r.action, r.operator, r.status, r.sizeKB, r.msg]);
    exportExcel('归档日志检索结果_' + scopeLabel() + '.xls', headers, rows);
    toast('已导出检索结果 ' + res.total.toLocaleString() + ' 条（演示）', 'success');
  }

  function exportSummary(st) {
    const headers = ['指标', '数值'];
    const rows = [
      ['主库在线日志', st.activeCount],
      ['已归档日志', st.archivedCount],
      ['累计释放主库空间(MB)', st.freedMB],
      ['归档覆盖率(%)', st.coveragePct],
      ['归档时长(天)', cfg.retentionDays],
      ['归档触发规则', ARCHIVE_TRIGGER_LABEL[cfg.trigger]],
      ['存储方式', ARCHIVE_STORAGE_LABEL[cfg.storage]],
      ['数据范围', scopeLabel()],
      ['统计时间', fmtDT(new Date())]
    ];
    st.bySystem.forEach(s => rows.push(['已归档-' + s.name, s.value + ' 条 / ' + s.mb + ' MB']));
    st.levelDist.forEach(l => rows.push(['等级-' + l.label, l.value + ' 条']));
    exportExcel('归档统计_' + scopeLabel() + '.xls', headers, rows);
    toast('已导出归档统计 Excel（演示）', 'success');
  }

  render();
})();
