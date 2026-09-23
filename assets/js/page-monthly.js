/* ============ 自动月报（按月汇总 · 预览 / 导出 PDF·Excel） ============ */
(function () {
  renderShell('monthly');

  const isAdmin = CurrentUser.isAdmin();
  const deptList = Array.from(new Set(ALARM_RECORDS.map(r => r.dept))).filter(Boolean).sort();

  function monthOptions() {
    const arr = []; const now = new Date();
    for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); arr.push(d.getFullYear() + '-' + pad2(d.getMonth() + 1)); }
    return arr;
  }
  const MONTHS = monthOptions();

  const defaultCfg = {
    month: MONTHS[MONTHS.length - 1],
    sections: { overview: true, top: true, disposition: true, root: true, health: true },
    scope: isAdmin ? 'all' : 'dept'
  };
  let cfg = store.get('monthly_cfg', defaultCfg);
  if (!cfg.sections) cfg.sections = defaultCfg.sections;
  if (!MONTHS.includes(cfg.month)) cfg.month = MONTHS[MONTHS.length - 1];
  if (cfg.scope !== 'all' && !deptList.includes(cfg.scope)) cfg.scope = isAdmin ? 'all' : (CurrentUser.dept() || deptList[0] || '');
  const save = () => store.set('monthly_cfg', cfg);

  let generated = true; // 默认载入即生成当前月报，便于预览；点击「生成」可手动重算

  const SECTION_LABEL = { overview: '告警总量与闭环概况', top: 'TOP 高频异常', disposition: '告警处置情况', root: '根因聚类摘要', health: '子系统健康概览' };

  function monthRecs() {
    let recs = ALARM_RECORDS.filter(r => ym(r.ts) === cfg.month);
    if (isAdmin) { if (cfg.scope !== 'all') recs = recs.filter(r => r.dept === cfg.scope); }
    else recs = recs.filter(r => r.dept === CurrentUser.dept());
    return recs;
  }
  function monthSystems() {
    if (isAdmin) { if (cfg.scope !== 'all') return SUBSYSTEMS.filter(s => deptOf(s.id) === cfg.scope); }
    else return SUBSYSTEMS.filter(s => deptOf(s.id) === CurrentUser.dept());
    return SUBSYSTEMS;
  }

  function scopeBadge() {
    if (isAdmin) return cfg.scope === 'all'
      ? `<span class="scope-badge">${icon('shield', 15)} 数据范围：全部数据（系统管理员）</span>`
      : `<span class="scope-badge limited">${icon('shield', 15)} 数据范围：仅「${esc(cfg.scope)}」</span>`;
    return `<span class="scope-badge limited">${icon('lock', 15)} 数据范围：本处室及下属 · ${esc(CurrentUser.dept())}（受角色权限限制）</span>`;
  }

  const now = new Date();
  const nm = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextAuto = `${nm.getFullYear()}年${nm.getMonth() + 1}月1日 08:00`;

  function render() {
    const recs = monthRecs();
    const st = computeAlarmStats(recs, { granularity: 'day', dim: 'keyword' });
    const monthLabel = cfg.month.replace('-', '年') + '月';
    const canExport = CurrentUser.can('report', 'export');
    const sec = cfg.sections;

    document.getElementById('content').innerHTML = `
    <div class="notice" style="--nc:var(--primary)">
      ${icon('file', 19)}
      <div><strong>自动月报：</strong>系统<strong>按月自动汇总</strong>告警与事件数据，包含告警总量、TOP 高频异常、告警处置情况与根因聚类摘要，支持<strong>预览、导出 PDF / Excel</strong>。报表内容可配置，支持<strong>手动触发生成</strong>，并遵循分级权限——当前身份仅可见其权限范围内数据。</div>
    </div>

    <div class="card mt16">
      <div class="card-head">
        <div class="card-title">${icon('settings', 19)} 月报生成与配置
          <span class="card-sub">支持手动触发 · 内容可配置</span></div>
        ${scopeBadge()}
      </div>
      <div class="card-body">
        <div class="cfg-row">
          <div class="cfg-item">
            <label class="field-label">统计月份</label>
            <select class="select" id="selMonth" style="width:160px">
              ${MONTHS.map(m => `<option value="${m}" ${m === cfg.month ? 'selected' : ''}>${m.replace('-', '年')}月</option>`).join('')}
            </select>
          </div>
          <div class="cfg-item">
            <label class="field-label">数据范围</label>
            ${isAdmin
              ? `<select class="select" id="selScope" style="width:200px"><option value="all" ${cfg.scope === 'all' ? 'selected' : ''}>全部数据</option>${deptList.map(d => `<option value="${d}" ${cfg.scope === d ? 'selected' : ''}>仅 ${esc(d)}</option>`).join('')}</select>`
              : `<select class="select" id="selScope" style="width:200px" disabled><option>${esc(CurrentUser.dept())}（本处室及下属）</option></select>`}
          </div>
          <div class="cfg-item">
            <label class="field-label">生成方式</label>
            <button class="btn btn-primary" id="btnGen">${icon('refresh', 16)} 立即生成月报</button>
          </div>
          <div class="cfg-item" style="flex:1;min-width:260px">
            <label class="field-label">自动生成</label>
            <div class="cfg-note">系统将于每月 1 日 08:00 自动生成上月月报并推送管理层；下次自动生成：<strong>${nextAuto}</strong></div>
          </div>
        </div>
        <div class="field-row mt16" style="grid-template-columns:repeat(5,minmax(0,1fr))">
          ${Object.keys(SECTION_LABEL).map(k => `<label class="checkline"><input type="checkbox" class="sec-chk" value="${k}" ${sec[k] ? 'checked' : ''}> ${SECTION_LABEL[k]}</label>`).join('')}
        </div>
      </div>
    </div>

    <div class="toolbar mt16 no-print" style="justify-content:flex-end">
      <button class="btn" id="btnPreview">${icon('file', 16)} 重新预览</button>
      <button class="btn ${canExport ? '' : 'btn-ghost'}" id="btnPdf" ${canExport ? '' : 'disabled title="当前角色无导出权限"'}>${icon('download', 16)} 导出 PDF</button>
      <button class="btn ${canExport ? '' : 'btn-ghost'}" id="btnXls" ${canExport ? '' : 'disabled title="当前角色无导出权限"'}>${icon('download', 16)} 导出 Excel</button>
    </div>

    <div class="print-area mt8" id="reportArea">
      ${generated ? reportHtml(st, monthLabel, sec) : `<div class="card"><div class="card-body center muted" style="padding:50px">请选择统计月份后点击「立即生成月报」</div></div>`}
    </div>`;

    /* ---- 图表（在 print-area 内绘制） ---- */
    if (generated) {
      lineChart(document.getElementById('repTrend'), {
        series: [{ data: st.series.counts, color: '#1d4ed8', fill: true }, { data: st.series.criticals, color: '#cc2f2a', fill: false }],
        labels: st.series.labels, height: 230
      });
      hBars(document.getElementById('repTop'), st.top.slice(0, 10).map((t, i) => ({ label: t.label, value: t.value, color: ['#1d4ed8', '#0b6a86', '#12805a', '#a8620b', '#8b5cf6', '#cc2f2a', '#0d6b4b', '#6b7280', '#2563eb', '#b45309'][i % 10] })));
    }

    /* ---- 交互 ---- */
    const sm = document.getElementById('selMonth'); sm && sm.addEventListener('change', e => { cfg.month = e.target.value; save(); render(); });
    const ss = document.getElementById('selScope'); ss && ss.addEventListener('change', e => { cfg.scope = e.target.value; save(); render(); });
    document.querySelectorAll('.sec-chk').forEach(c => c.onchange = () => { cfg.sections[c.value] = c.checked; save(); render(); });
    document.getElementById('btnGen').onclick = () => { generated = true; save(); render(); toast('已生成 ' + monthLabel + ' 运维月报', 'success'); };
    document.getElementById('btnPreview').onclick = () => { generated = true; render(); toast('已刷新预览', 'success'); };
    const bp = document.getElementById('btnPdf'); if (bp) bp.onclick = () => {
      if (!canExport) { toast('当前角色「' + CurrentUser.roleNames().join('/') + '」无【自动月报-导出】权限', 'danger'); return; }
      window.print();
    };
    const bx = document.getElementById('btnXls'); if (bx) bx.onclick = () => {
      if (!canExport) { toast('当前角色「' + CurrentUser.roleNames().join('/') + '」无【自动月报-导出】权限', 'danger'); return; }
      exportReport(st, monthLabel);
    };
  }

  function reportHtml(st, monthLabel, sec) {
    const sysCount = (isAdmin && cfg.scope !== 'all') ? SUBSYSTEMS.filter(s => deptOf(s.id) === cfg.scope).length : (isAdmin ? SUBSYSTEMS.length : SUBSYSTEMS.filter(s => deptOf(s.id) === CurrentUser.dept()).length);
    let h = `
      <div class="card">
        <div class="card-head">
          <div>
            <div class="report-title">运维监控月报 · ${monthLabel}</div>
            <div class="report-meta">生成时间：${fmtDT(new Date())} · 生成人：${esc(CurrentUser.get() ? CurrentUser.get().name : '—')} · 数据范围：${isAdmin && cfg.scope !== 'all' ? esc(cfg.scope) : '全部数据'}</div>
          </div>
        </div>
        <div class="card-body">`;

    if (sec.overview) {
      h += `<div class="grid g-4" style="gap:14px">
        ${kpi('告警总量', st.total, '起', '#1d4ed8', '#e8eefe')}
        ${kpi('特急 Critical', st.critical, '起', '#cc2f2a', '#fbeae9')}
        ${kpi('已闭环', st.byStatus.closed, '起', '#12805a', '#e6f6ee')}
        ${kpi('闭环率', st.closedRate, '%', '#0b6a86', '#e2f3f9')}
        ${kpi('批量连锁告警簇', st.byType.chained, '簇', '#a8620b', '#fdf1e0')}
        ${kpi('涉及子系统', sysCount, '个', '#8b5cf6', '#f1ecfd')}
      </div>
      <div class="card-sub mt16">本月告警等级构成：特急 ${st.critical} · 重要 ${st.warn} · 正常 ${st.normal}；处置状态：已闭环 ${st.byStatus.closed} / 处理中 ${st.byStatus.doing} / 待处理 ${st.byStatus.pending}。</div>`;
    }

    if (sec.top) {
      h += `<div class="mt24"><div class="font-b mb12">一、TOP 高频异常（按关键词）</div>
        <div class="grid g-23" style="gap:18px"><div><div id="repTrend"></div></div>
        <div><div id="repTop"></div></div></div>
        <div style="overflow-x:auto" class="mt16"><table class="table">
          <thead><tr><th>排名</th><th>高频关键词</th><th class="center">次数</th><th class="center">占比</th><th class="center">关联系统数</th><th class="center">近30天</th></tr></thead>
          <tbody>${st.top.slice(0, 10).map((t, i) => `<tr><td class="center num">${i + 1}</td><td class="tname">${esc(t.label)}</td><td class="center"><span class="badge b-primary">${t.value}</span></td><td class="center num">${t.pct}%</td><td class="center num">${t.systems}</td><td class="center num">${t.recent}</td></tr>`).join('') || '<tr><td colspan="6" class="center muted">本月暂无高频异常</td></tr>'}</tbody>
        </table></div></div>`;
    }

    if (sec.disposition) {
      h += `<div class="mt24"><div class="font-b mb12">二、告警处置情况</div>
        <div class="fixed-kv">
          <div>已闭环</div><div><strong style="color:var(--success)">${st.byStatus.closed}</strong> 起（${st.closedRate}%）</div>
          <div>处理中</div><div><strong style="color:var(--warn)">${st.byStatus.doing}</strong> 起</div>
          <div>待处理</div><div><strong style="color:var(--danger)">${st.byStatus.pending}</strong> 起</div>
          <div>闭环率目标</div><div>≥ 95%（管理层考核线）</div>
        </div>
        <div class="sub-note mt12">说明：闭环率 = 已闭环 / 告警总量。待处理项建议在次月首周交接班会上专项跟踪，避免跨月积压。</div></div>`;
    }

    if (sec.root) {
      h += `<div class="mt24"><div class="font-b mb12">三、根因聚类摘要（相似告警研判）</div>
        <div style="overflow-x:auto"><table class="table">
          <thead><tr><th>代表关键词</th><th>根因分类</th><th>关联系统</th><th class="center">同类</th><th class="center">类型</th><th>处置建议</th></tr></thead>
          <tbody>${st.clusters.slice(0, 10).map(c => `<tr>
            <td class="tname">${esc(c.keyword)}</td><td><span class="chip">${esc(c.category)}</span></td>
            <td class="small">${(c.sysNames || []).map(esc).join('、')}</td>
            <td class="center"><span class="badge ${c.type === 'chained' ? 'b-danger' : 'b-info'}">${c.count}</span></td>
            <td class="center"><span class="badge ${c.type === 'chained' ? 'b-danger' : 'b-info'}">${c.type === 'chained' ? '连锁' : '偶发'}</span></td>
            <td class="small muted">${esc(c.suggestion)}</td></tr>`).join('') || '<tr><td colspan="6" class="center muted">本月暂无聚类数据</td></tr>'}</tbody>
        </table></div>
        <div class="sub-note mt12">同一关键词一天内 ≥3 次或跨 ≥2 子系统同时出现判定为批量连锁，建议优先排查共性根因。</div></div>`;
    }

    if (sec.health) {
      const sys = monthSystems();
      h += `<div class="mt24"><div class="font-b mb12">四、子系统健康概览</div>
        <div style="overflow-x:auto"><table class="table">
          <thead><tr><th>子系统</th><th>类别</th><th class="center">状态</th><th class="center">健康度</th></tr></thead>
          <tbody>${sys.map(s => { const si = statusInfo(s.status); return `<tr>
            <td class="tname">${esc(s.name)}</td><td class="small">${esc(s.cat)}</td>
            <td class="center"><span class="badge ${si.cls}">${si.label}</span></td>
            <td class="center num">${s.health != null ? s.health : '—'}</td></tr>`; }).join('')}</tbody>
        </table></div></div>`;
    }

    h += `</div></div>`;
    return h;
  }

  function kpi(name, value, unit, color, soft) {
    return `<div class="kpi" style="--accent:${color};--accent-soft:${soft}">
      <div class="kpi-top"><div class="kpi-name">${name}</div></div>
      <div class="kpi-value">${value}<span class="kpi-unit">${unit}</span></div>
    </div>`;
  }

  function exportReport(st, monthLabel) {
    const rows = [
      ['概览', '统计月份', monthLabel],
      ['概览', '告警总量', st.total],
      ['概览', '特急 Critical', st.critical],
      ['概览', '重要', st.warn],
      ['概览', '正常', st.normal],
      ['概览', '已闭环', st.byStatus.closed],
      ['概览', '处理中', st.byStatus.doing],
      ['概览', '待处理', st.byStatus.pending],
      ['概览', '闭环率', st.closedRate + '%'],
      ['概览', '批量连锁告警簇', st.byType.chained],
      ['TOP高频异常', '排名', '关键词 / 数值'],
      ...st.top.slice(0, 10).map((t, i) => ['TOP高频异常', (i + 1), t.label + ' / ' + t.value + '次 / 占比' + t.pct + '% / 关联系统' + t.systems + '个']),
      ['根因聚类', '关键词', '类型 / 建议'],
      ...st.clusters.slice(0, 10).map(c => ['根因聚类', c.keyword, (c.type === 'chained' ? '批量连锁' : '偶发') + ' / ' + c.suggestion])
    ];
    exportExcel('运维月报_' + cfg.month + '.xls', ['分类', '名称', '数值 / 说明'], rows);
    toast('已导出月报 Excel（演示）', 'success');
  }

  render();
})();
