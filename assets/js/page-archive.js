/* ============ 历史日志归档 · 按子系统分类浏览 ============
   页面极简：仅按「不同子系统」对已归档日志分类展示。
   保留全站 RBAC（archive 模块 view/export + 数据范围过滤）。
======================================================== */
(function () {
  renderShell('archive');

  const isAdmin = CurrentUser.isAdmin();
  const deptList = Array.from(new Set(LOG_RECORDS.map(r => r.dept))).filter(Boolean).sort();
  const cfg = Object.assign({}, ARCHIVE_DEFAULTS, store.get('archive_cfg', {}));

  const canView = CurrentUser.can('archive', 'view');
  const canExport = CurrentUser.can('archive', 'export');

  const PALETTE = ['#1d4ed8', '#0b6a86', '#12805a', '#a8620b', '#8b5cf6', '#cc2f2a', '#0d6b4b', '#6b7280'];

  function effectiveRecords() {
    if (isAdmin) return LOG_RECORDS.slice();
    return LOG_RECORDS.filter(r => r.dept === CurrentUser.dept());
  }
  function scopeBadge() {
    if (isAdmin) {
      return `<span class="scope-badge">${icon('shield', 15)} 数据范围：全部数据（系统管理员）</span>`;
    }
    return `<span class="scope-badge limited">${icon('lock', 15)} 数据范围：本处室及下属 · ${esc(CurrentUser.dept())}（受角色权限限制）</span>`;
  }

  /* 按子系统分组已归档日志 */
  function groupBySystem() {
    const recs = effectiveRecords();
    const { archived } = splitArchive(recs, cfg);
    const map = {};
    archived.forEach(r => {
      const g = map[r.sysId] || (map[r.sysId] = { sysId: r.sysId, name: r.sys, dept: r.dept, rows: [], size: 0 });
      g.rows.push(r); g.size += r.sizeKB;
    });
    return Object.keys(map).map(k => {
      const g = map[k];
      g.rows.sort((a, b) => b.ts - a.ts);
      g.count = g.rows.length;
      g.mb = +(g.size / 1024).toFixed(1);
      g.latest = g.rows[0] ? g.rows[0].ts : null;
      return g;
    }).sort((a, b) => b.count - a.count);
  }

  let current = null;   // 当前选中的子系统 sysId

  function fmtTs(t) {
    if (!t) return '—';
    return `${t.getFullYear()}/${pad2(t.getMonth() + 1)}/${pad2(t.getDate())} ${pad2(t.getHours())}:${pad2(t.getMinutes())}`;
  }

  function render() {
    if (!canView) {
      document.getElementById('content').innerHTML = `
      <div class="notice" style="--nc:var(--danger)">
        ${icon('lock', 19)}
        <div><strong>无访问权限：</strong>当前角色「${esc(CurrentUser.roleNames().join('/'))}」未被授予【历史日志归档-查看】权限，请联系管理员授权。</div>
      </div>`;
      return;
    }

    const groups = groupBySystem();
    const totalArchived = groups.reduce((a, g) => a + g.count, 0);
    if (!current || !groups.some(g => g.sysId === current)) current = groups.length ? groups[0].sysId : null;
    const cur = groups.find(g => g.sysId === current) || null;

    document.getElementById('content').innerHTML = `
    <div class="notice" style="--nc:var(--info)">
      ${icon('database', 19)}
      <div><strong>历史日志归档：</strong>过期日志已自动移出主库，此处<strong>按子系统分类</strong>展示已归档日志；点击下方子系统卡片即可查看对应明细。<span class="cfg-note">归档时长、触发规则、存储方式等口径待与客户确认后由后端配置。</span></div>
      <div style="margin-left:auto">${scopeBadge()}</div>
    </div>

    <div class="card mt16">
      <div class="card-head">
        <div class="card-title">${icon('layers', 19)} 按子系统分类
          <span class="card-sub">已归档日志共 ${totalArchived.toLocaleString()} 条 · ${groups.length} 个子系统</span></div>
        <button class="btn btn-sm" id="btnExport" ${canExport ? '' : 'disabled title="当前角色无【历史日志归档-导出】权限"'}>${icon('download', 15)} 导出当前分类明细</button>
      </div>
      <div class="card-body">
        <div class="sys-cat-grid">
          ${groups.map((g, i) => `
          <button class="sys-cat ${g.sysId === current ? 'on' : ''}" data-sys="${g.sysId}" style="--sc:${PALETTE[i % PALETTE.length]}">
            <div class="sc-head"><span class="sc-dot"></span><span class="sc-name">${esc(g.name)}</span></div>
            <div class="sc-meta">${esc(g.dept)} · 最新 ${g.latest ? fmtTs(g.latest).slice(0, 10) : '—'}</div>
            <div class="sc-count">${g.count.toLocaleString()} <small>条</small><span class="sc-mb">${g.mb} MB</span></div>
          </button>`).join('')}
          ${groups.length ? '' : `<div class="muted" style="padding:18px 4px">当前数据范围内暂无已归档日志。</div>`}
        </div>
      </div>
      <div class="card-foot">${icon('check', 15)} 归档日志按子系统分区存放于归档存储，可随时查阅追溯；明细受当前角色数据范围限制。</div>
    </div>

    <div class="card mt24">
      <div class="card-head">
        <div class="card-title">${icon('server', 19)} ${cur ? esc(cur.name) : '子系统'} 归档明细
          ${cur ? `<span class="badge b-info">${cur.count.toLocaleString()} 条</span>` : ''}</div>
        <span class="cfg-note">仅展示最近 200 条，导出可见全量</span>
      </div>
      <div class="card-body" style="overflow-x:auto" id="detailArea">${detailTable(cur)}</div>
    </div>`;

    /* 分类切换 */
    document.querySelectorAll('.sys-cat').forEach(el => {
      el.onclick = () => { current = el.dataset.sys; render(); };
    });

    const bx = document.getElementById('btnExport');
    if (bx) bx.onclick = () => {
      if (!canExport) { toast('当前角色无【历史日志归档-导出】权限', 'danger'); return; }
      if (!cur) { toast('当前数据范围内无可导出的归档日志', 'warn'); return; }
      const headers = ['日志ID', '时间', '等级', '来源系统', '操作类型', '动作', '操作人', '状态', '体积KB', '消息'];
      const rows = cur.rows.slice(0, 5000).map(r => [r.id, fmtDT(r.ts), r.level, r.sys, r.category, r.action, r.operator, r.status, r.sizeKB, r.msg]);
      exportExcel('归档日志_' + cur.name + '.xls', headers, rows);
      toast('已导出「' + cur.name + '」归档明细 ' + Math.min(cur.count, 5000).toLocaleString() + ' 条（演示）', 'success');
    };
  }

  function detailTable(g) {
    if (!g || !g.rows.length) return `<div class="muted" style="padding:24px 4px">暂无归档日志。</div>`;
    return `<table class="table"><thead><tr>
        <th>日志ID</th><th class="center">时间</th><th class="center">等级</th><th>操作类型</th><th>动作</th><th>操作人</th><th>状态</th><th class="center">体积</th><th>消息</th>
      </tr></thead><tbody>
      ${g.rows.slice(0, 200).map(r => `<tr>
        <td class="small num">${esc(r.id)}</td>
        <td class="small num center">${fmtTs(r.ts)}</td>
        <td class="center"><span class="badge ${ARCHIVE_LEVEL_META[r.level].cls}">${r.level}</span></td>
        <td>${esc(r.category)}</td>
        <td class="small">${esc(r.action)}</td>
        <td class="small">${esc(r.operator)}</td>
        <td class="small">${esc(r.status)}</td>
        <td class="small num center">${(+r.sizeKB).toFixed(1)} KB</td>
        <td class="small">${esc(r.msg)}</td>
      </tr>`).join('')}
      </tbody></table>
      ${g.count > 200 ? `<div class="sub-note mt12">已显示最近 200 条 / 共 ${g.count.toLocaleString()} 条，完整数据可通过「导出当前分类明细」获取。</div>` : ''}`;
  }

  render();
})();
