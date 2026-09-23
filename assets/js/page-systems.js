/* ============ 子系统接入规模与数据库底座页（问卷 1.1） ============ */
(function () {
  renderShell('systems');

  let list = SUBSYSTEMS.slice();
  let kw = '', cat = 'all', stFilter = 'all';

  function statsOf(arr) {
    const core = arr.filter(s => s.cat === '核心').length;
    const modeA = arr.filter(s => s.mode === 'A').length;
    const running = arr.filter(s => s.status !== 'offline').length;
    return [
      { label: '待接入子系统总数', value: arr.length + ' 个' },
      { label: '核心 / 外围', value: `${core} / ${arr.length - core}` },
      { label: '模式 A（接口订阅）', value: modeA + ' 个' },
      { label: '模式 B（数据库直连）', value: (arr.length - modeA) + ' 个' },
      { label: '在线子系统', value: `${running} / ${arr.length}` },
      { label: '平均健康度', value: Math.round(arr.reduce((a, b) => a + b.health, 0) / arr.length) + ' 分' }
    ];
  }

  function render() {
    const stats = statsOf(list);

    const rows = list.filter(s => {
      const m1 = !kw || (s.name + s.id + s.owner).toLowerCase().includes(kw.toLowerCase());
      const m2 = cat === 'all' || s.cat === cat;
      const m3 = stFilter === 'all' || s.status === stFilter;
      return m1 && m2 && m3;
    });

    document.getElementById('content').innerHTML = `
    <div class="notice" style="--nc:var(--primary)">
      ${icon('server', 19)}
      <div><strong>调研要点（问卷 1.1）：</strong>请确认现场需要并联接入统一监控中心的<strong>子系统总数与完整清单</strong>（含 ERP、支付网关、数据结算、核心网络、安全审计堡垒机等核心及外围系统）。</div>
    </div>

    <div class="card mt16">
      <div class="stat-strip">
        ${stats.map(s => `<div class="si"><div class="si-label">${s.label}</div><div class="si-value">${s.value}</div></div>`).join('')}
      </div>
    </div>

    <section class="card mt24">
      <div class="card-head">
        <div class="card-title">${icon('layers', 19)} 待接入子系统清单
          <span class="card-sub">当前筛选出 ${rows.length} / ${list.length} 条</span>
        </div>
        <div class="toolbar">
          <div class="search">${icon('search', 17)}<input class="input" id="kw" placeholder="搜索系统名称 / 负责人" value="${esc(kw)}"></div>
          <select class="select" id="cat" style="width:150px">
            <option value="all" ${cat === 'all' ? 'selected' : ''}>全部类别</option>
            <option value="核心" ${cat === '核心' ? 'selected' : ''}>核心系统</option>
            <option value="外围" ${cat === '外围' ? 'selected' : ''}>外围系统</option>
          </select>
          <select class="select" id="stFilter" style="width:150px">
            <option value="all" ${stFilter === 'all' ? 'selected' : ''}>全部状态</option>
            <option value="normal" ${stFilter === 'normal' ? 'selected' : ''}>正常</option>
            <option value="warn" ${stFilter === 'warn' ? 'selected' : ''}>告警</option>
            <option value="critical" ${stFilter === 'critical' ? 'selected' : ''}>严重</option>
            <option value="offline" ${stFilter === 'offline' ? 'selected' : ''}>离线</option>
          </select>
          <button class="btn" id="btnExport">${icon('download', 17)} 导出清单</button>
        </div>
      </div>

      <div class="card-body" style="padding:0">
        <div style="overflow-x:auto">
        <table class="table">
          <thead><tr>
            <th>子系统</th><th>类别</th><th class="center">采集模式</th><th>状态</th><th>负责人</th>
          </tr></thead>
          <tbody>
            ${rows.length ? rows.map(s => {
              const st = statusInfo(s.status);
              const needB = s.mode === 'B';
              return `<tr>
                <td><div class="tname">${esc(s.name)}</div><div class="tsub">${esc(s.id)}</div></td>
                <td><span class="tag">${s.cat}</span></td>
                <td class="center"><span class="badge ${needB ? 'b-warn' : 'b-info'}">${needB ? '模式 B · 数据库直连' : '模式 A · 接口订阅'}</span></td>
                <td><span class="badge ${st.cls}">${st.label}</span></td>
                <td class="small">${esc(s.owner || '—')}</td>
              </tr>`;
            }).join('') : `<tr><td colspan="5" class="center muted" style="padding:34px">没有符合条件的子系统，请调整筛选条件</td></tr>`}
          </tbody>
        </table>
        </div>
      </div>
      <div class="card-foot">${icon('check', 15)} 清单由现场调研确认后固化，新增或下线子系统请通过变更流程提交，由信息中心统一维护。</div>
    </section>`;

    bind();
  }

  function bind() {
    const kEl = document.getElementById('kw');
    kEl && kEl.addEventListener('input', e => { kw = e.target.value; const p = kEl.selectionStart; render(); const n = document.getElementById('kw'); n.focus(); n.setSelectionRange(p, p); });
    const c = document.getElementById('cat'); c && c.addEventListener('change', e => { cat = e.target.value; render(); });
    const sf = document.getElementById('stFilter'); sf && sf.addEventListener('change', e => { stFilter = e.target.value; render(); });
    const be = document.getElementById('btnExport'); be && be.addEventListener('click', () => toast('已生成《待接入子系统清单》Excel（演示）', 'success'));
  }

  render();
})();
