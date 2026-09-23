/* ============ 子系统接入规模与数据库底座页（问卷 1.1 / 1.2） ============ */
(function () {
  renderShell('systems');

  const DB_TYPES = ['MySQL', 'PostgreSQL', 'Oracle', 'SQL Server', 'Redis', 'MongoDB', 'ClickHouse', 'Prometheus TSDB', '自研 NewSQL', '其他（请注明）'];
  let list = SUBSYSTEMS.concat(store.get('systems_extra', []));
  let kw = '', cat = 'all', stFilter = 'all', showForm = false;

  function statInt(list) {
    const core = list.filter(s => s.cat === '核心').length;
    const replica = list.filter(s => s.replica).length;
    const iso = list.filter(s => s.iso).length;
    const apiOk = list.filter(s => !/未开放|仅内网/.test(s.api)).length;
    return [
      { label: '待接入子系统总数', value: list.length + ' 个' },
      { label: '核心 / 外围', value: `${core} / ${list.length - core}` },
      { label: '已内网隔离部署', value: iso + ' 个' },
      { label: '具备只读副本', value: replica + ' 个' },
      { label: '具备标准接口（模式 A）', value: apiOk + ' 个' },
      { label: '需数据库直连（模式 B）', value: (list.length - apiOk) + ' 个' }
    ];
  }

  function render() {
    const stats = statInt(list);
    const dbCount = {};
    list.forEach(s => { const k = s.db.split(' ')[0]; dbCount[k] = (dbCount[k] || 0) + 1; });
    const palette = ['#1d4ed8', '#0b6a86', '#12805a', '#a8620b', '#8b5cf6', '#cc2f2a', '#3f8fbf', '#7a869a'];
    const dbItems = Object.entries(dbCount).sort((a, b) => b[1] - a[1]).map((e, i) => ({ label: e[0], value: e[1], color: palette[i % palette.length] }));

    const rows = list.filter(s => {
      const m1 = !kw || (s.name + s.id + s.db + s.owner + s.api).toLowerCase().includes(kw.toLowerCase());
      const m2 = cat === 'all' || s.cat === cat;
      const m3 = stFilter === 'all' || s.status === stFilter;
      return m1 && m2 && m3;
    });

    const riskHost = list.filter(s => !s.replica);
    const modeB = list.filter(s => /未开放|仅内网/.test(s.api));

    document.getElementById('content').innerHTML = `
    <div class="notice" style="--nc:var(--primary)">
      ${icon('shield', 19)}
      <div><strong>调研要点（问卷 1.1 / 1.2）：</strong>请确认待监测子系统<strong>总数与清单</strong>，并逐项登记底层<strong>数据库类型与版本</strong>、是否<strong>内网隔离部署</strong>、是否提供<strong>只读副本</strong>用于提取监控日志。下方可直接登记，新增项会保存在本机浏览器（LocalStorage）以便演示。</div>
    </div>

    <div class="card mt16">
      <div class="stat-strip">
        ${stats.map(s => `<div class="si"><div class="si-label">${s.label}</div><div class="si-value">${s.value}</div></div>`).join('')}
      </div>
    </div>

    <div class="grid g-32 mt24">
      <section class="card" style="align-self:start">
        <div class="card-head"><div class="card-title">${icon('layers', 19)} 数据库类型构成</div></div>
        <div class="card-body"><div id="dbBars"></div></div>
        <div class="card-foot">共 ${Object.keys(dbCount).length} 种数据底座，异构程度较高，建议对不通用的底座单独评估采集方案。</div>
      </section>

      <section class="card">
        <div class="card-head">
          <div class="card-title">${icon('alert', 19)} 需在技术对接会上确认的风险项</div>
          <span class="badge b-warn">${riskHost.length + modeB.length} 项待确认</span>
        </div>
        <div class="card-body">
          <div class="rowline">
            <div><div class="rl-title">未提供只读副本（${riskHost.length} 个）</div>
              <div class="rl-desc">${riskHost.map(s => s.name).join('、') || '无'}</div></div>
            <a class="btn btn-sm" href="ingest.html">评估直连方案</a>
          </div>
          <div class="rowline">
            <div><div class="rl-title">不具备标准接口，建议走模式 B（${modeB.length} 个）</div>
              <div class="rl-desc">${modeB.map(s => s.name).join('、') || '无'} —— 需确认连接池占用、只读账号权限与 SQL 耗时审计要求</div></div>
            <a class="btn btn-sm" href="ingest.html">配置采集模式</a>
          </div>
          <div class="rowline">
            <div><div class="rl-title">存在公网可达数据库（${list.filter(s => !s.iso).length} 个）</div>
              <div class="rl-desc">${list.filter(s => !s.iso).map(s => s.name).join('、') || '无'} —— 建议限期迁移至内网隔离区或经堡垒机代理访问</div></div>
            <span class="badge b-info">安全建议</span>
          </div>
        </div>
      </section>
    </div>

    <section class="card mt24">
      <div class="card-head">
        <div class="card-title">${icon('server', 19)} 待接入子系统清单
          <span class="card-sub">当前筛选出 ${rows.length} / ${list.length} 条</span>
        </div>
        <div class="toolbar">
          <div class="search">${icon('search', 17)}<input class="input" id="kw" placeholder="搜索系统名称 / 数据库 / 负责人" value="${esc(kw)}"></div>
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
          <button class="btn btn-primary" id="btnAdd">${icon('plus', 17)} 登记新系统</button>
          <button class="btn" id="btnExport">${icon('download', 17)} 导出清单</button>
        </div>
      </div>

      ${showForm ? `
      <div class="card-body" style="background:var(--surface-2);border-bottom:1px solid var(--border)">
        <div style="font-size:16px;font-weight:600;margin-bottom:14px">登记新子系统（问卷 1.1 / 1.2 采集项）</div>
        <div class="field-row">
          <div class="field"><label class="field-label">系统名称 *</label><input class="input" id="f_name" placeholder="例如：设备巡检 EAM"></div>
          <div class="field"><label class="field-label">系统标识 ID</label><input class="input" id="f_id" placeholder="例如：EAM"></div>
        </div>
        <div class="field-row">
          <div class="field"><label class="field-label">所属类别</label>
            <select class="select" id="f_cat"><option>外围</option><option>核心</option></select></div>
          <div class="field"><label class="field-label">底层数据库类型</label>
            <select class="select" id="f_db">${DB_TYPES.map(t => `<option>${t}</option>`).join('')}</select></div>
        </div>
        <div class="field-row">
          <div class="field"><label class="field-label">数据库版本</label><input class="input" id="f_ver" placeholder="例如：8.0.34"></div>
          <div class="field"><label class="field-label">负责人 / 处室</label><input class="input" id="f_owner" placeholder="例如：孙立群 · 财务处"></div>
        </div>
        <div class="field-row">
          <div class="field"><label class="field-label">是否内网隔离部署</label>
            <select class="select" id="f_iso"><option value="1">是，内网隔离区</option><option value="0">否，存在公网可达</option></select></div>
          <div class="field"><label class="field-label">是否支持只读副本</label>
            <select class="select" id="f_replica"><option value="1">支持，已提供只读副本</option><option value="0">不支持 / 未提供</option></select></div>
        </div>
        <div class="field"><label class="field-label">已有接口能力</label>
          <select class="select" id="f_api">
            <option>RESTful</option><option>gRPC</option><option>RESTful + gRPC</option>
            <option>已接入日志网关（ELK/Prometheus/Splunk）</option>
            <option>Syslog + REST</option><option>仅内网 SQL</option><option>未开放（需直连）</option>
          </select>
          <div class="field-hint">选择「仅内网 SQL」或「未开放」时，系统将自动判定为 <strong>模式 B：数据库直连抓取</strong>。</div>
        </div>
        <div class="flex gap8">
          <button class="btn btn-primary" id="btnSave">保存登记</button>
          <button class="btn" id="btnCancel">取消</button>
        </div>
      </div>` : ''}

      <div class="card-body" style="padding:0">
        <div style="overflow-x:auto">
        <table class="table">
          <thead><tr>
            <th>子系统</th><th>类别</th><th>数据库底座</th><th>版本</th>
            <th class="center">内网隔离</th><th class="center">只读副本</th>
            <th>接口能力</th><th class="center">采集模式</th><th>状态</th><th>负责人</th><th class="center">操作</th>
          </tr></thead>
          <tbody>
            ${rows.length ? rows.map(s => {
              const st = statusInfo(s.status);
              const needB = /未开放|仅内网/.test(s.api);
              return `<tr>
                <td><div class="tname">${esc(s.name)}</div><div class="tsub">${esc(s.id)}</div></td>
                <td><span class="tag">${s.cat}</span></td>
                <td class="tname">${esc(s.db)}</td>
                <td class="small muted num">${esc(s.ver || '—')}</td>
                <td class="center">${s.iso ? `<span class="badge b-success">已隔离</span>` : `<span class="badge b-danger">公网可达</span>`}</td>
                <td class="center">${s.replica ? `<span class="badge b-success">支持</span>` : `<span class="badge b-neutral">不支持</span>`}</td>
                <td class="small">${esc(s.api)}</td>
                <td class="center"><span class="badge ${needB ? 'b-warn' : 'b-info'}">${needB ? '模式 B' : '模式 A'}</span></td>
                <td><span class="badge ${st.cls}">${st.label}</span></td>
                <td class="small">${esc(s.owner || '—')}</td>
                <td class="center">${String(s.id).startsWith('NEW_')
                  ? `<button class="btn btn-sm btn-ghost" data-del="${s.id}" title="删除">${icon('trash', 16)}</button>`
                  : `<span class="small muted">样例</span>`}</td>
              </tr>`;
            }).join('') : `<tr><td colspan="11" class="center muted" style="padding:34px">没有符合条件的子系统，请调整筛选条件</td></tr>`}
          </tbody>
        </table>
        </div>
      </div>
      <div class="card-foot">${icon('alert', 15)} 「只读副本」为否的系统，若采用模式 B 直连抓取，请在网络策略中仅放行监控中心采集机 IP，并授予 SELECT 只读账号。</div>
    </section>`;

    hBars(document.getElementById('dbBars'), dbItems, ' 个');
    bind();
  }

  function bind() {
    const kEl = document.getElementById('kw');
    kEl && kEl.addEventListener('input', e => { kw = e.target.value; const p = kEl.selectionStart; render(); const n = document.getElementById('kw'); n.focus(); n.setSelectionRange(p, p); });
    const c = document.getElementById('cat'); c && c.addEventListener('change', e => { cat = e.target.value; render(); });
    const sf = document.getElementById('stFilter'); sf && sf.addEventListener('change', e => { stFilter = e.target.value; render(); });
    const ba = document.getElementById('btnAdd'); ba && ba.addEventListener('click', () => { showForm = !showForm; render(); if (showForm) document.getElementById('f_name').focus(); });
    const bc = document.getElementById('btnCancel'); bc && bc.addEventListener('click', () => { showForm = false; render(); });
    const be = document.getElementById('btnExport'); be && be.addEventListener('click', () => toast('已生成《待接入子系统与数据库底座清单》Excel（演示）', 'success'));

    document.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
      const id = b.getAttribute('data-del');
      list = list.filter(s => s.id !== id);
      store.set('systems_extra', list.filter(s => String(s.id).startsWith('NEW_')));
      toast('已删除该登记项', 'success');
      render();
    }));

    const bs = document.getElementById('btnSave');
    bs && bs.addEventListener('click', () => {
      const name = document.getElementById('f_name').value.trim();
      if (!name) { toast('请填写系统名称', 'danger'); return; }
      const idv = (document.getElementById('f_id').value.trim() || name.slice(0, 3)).toUpperCase();
      const api = document.getElementById('f_api').value;
      const item = {
        id: 'NEW_' + idv + '_' + Date.now().toString().slice(-4),
        name, cat: document.getElementById('f_cat').value,
        db: document.getElementById('f_db').value,
        ver: document.getElementById('f_ver').value.trim(),
        iso: document.getElementById('f_iso').value === '1',
        replica: document.getElementById('f_replica').value === '1',
        api, mode: /未开放|仅内网/.test(api) ? 'B' : 'A',
        status: 'normal', health: 100,
        owner: document.getElementById('f_owner').value.trim()
      };
      list.push(item);
      store.set('systems_extra', list.filter(s => String(s.id).startsWith('NEW_')));
      showForm = false;
      render();
      toast(`已登记「${name}」，建议采集模式 ${item.mode}`, 'success');
    });
  }

  render();
})();
