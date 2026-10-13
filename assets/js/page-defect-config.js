/* ============ 次品管理 · 次品项配置（主数据） ============
   按 部门 / 工序 维护次品项（名称 + 代码）及其与设备（机台）的绑定关系。
   配置写入 localStorage（DefectCfgStore），与次品管理大屏共用同一份主数据。
   权限：需「Output（OP）/ 次品」编辑权限（沿用 OP 配置页口径，仅管理员可编辑）；否则整页只读。
   部门固定为 LEAD / NON-LEAD / PLATING（项目口径，不可编辑）。 */
(function () {
  renderShell('defectcfg');

  // 与 OP 配置页一致：仅拥有 output 编辑权限（管理员）可编辑，其余角色只读
  const canEdit = CurrentUser.can('output', 'edit');
  const DEPTS = (typeof DEFECT_DEPARTMENTS !== 'undefined' && DEFECT_DEPARTMENTS.length) ? DEFECT_DEPARTMENTS : ['LEAD', 'NON-LEAD', 'PLATING'];

  let cfg = DefectCfgStore.all();
  let tab = 'items';                       // items | equip
  let fDept = 'ALL';                       // ALL | LEAD | NON-LEAD | PLATING
  let fProc = 'ALL';                       // ALL | <process>

  const TABS = [
    { key: 'items', label: '① 次品项主数据', icon: 'layers' },
    { key: 'equip', label: '② 设备与工序维护', icon: 'server' }
  ];

  function render() {
    const realKeys = (typeof DEFECT_REAL !== 'undefined' && DEFECT_REAL.cats) ? DEFECT_REAL.cats.map(c => c.key) : [];
    const cfgKeys = cfg.items.map(i => i.code);
    const matched = realKeys.filter(k => cfgKeys.indexOf(k) >= 0).length;
    const realTotal = realKeys.length || 16;

    document.getElementById('content').innerHTML = `
      <div class="notice mt16" style="--nc:var(--primary)">
        ${icon('settings', 19)}
        <div><strong>次品项配置（主数据）：</strong>按<strong>部门 / 工序</strong>维护次品项的<strong>名称与代码</strong>，并配置<strong>次品项与设备（机台）的绑定关系</strong>。
        保存后写入本地配置仓库，作为次品管理大屏的缺陷项主数据。
        ${canEdit ? '' : '<br><span class="badge b-warn">只读</span> 当前角色无编辑权限，仅可查看配置（切换为管理员身份即可编辑）。'}</div>
      </div>

      <div class="card mt16 no-print">
        <div class="card-head">
          <div class="card-title">${icon('settings', 19)} 配置域
            <span class="card-sub">共 2 类 · 保存后立即写入本地配置仓库</span></div>
          <div class="flex acenter gap8">
            <div class="seg" id="segTab">
              ${TABS.map(t => `<button data-t="${t.key}" class="${tab === t.key ? 'active' : ''}">${icon(t.icon, 15)} ${t.label}</button>`).join('')}
            </div>
            ${canEdit ? `<button class="btn btn-sm" id="btnResetAll">${icon('refresh', 16)} 恢复默认配置</button>` : ''}
          </div>
        </div>
      </div>

      <div id="tabBody" class="mt16">${tabBody()}</div>`;

    bind();
  }

  function tabBody() {
    return tab === 'items' ? viewItems() : viewEquip();
  }

  /* =========================================================
     ① 次品项主数据
     ========================================================= */
  function viewItems() {
    const realKeys = (typeof DEFECT_REAL !== 'undefined' && DEFECT_REAL.cats) ? DEFECT_REAL.cats.map(c => c.key) : [];
    const cfgKeys = cfg.items.map(i => i.code);
    const matched = realKeys.filter(k => cfgKeys.indexOf(k) >= 0).length;
    const realTotal = realKeys.length || 16;
    const matchNote = realKeys.length
      ? `已配置 <b>${matched} / ${realTotal}</b> 项代码与真实缺陷类别一致；其余为可扩展的自定义次品项。`
      : '当前未加载真实缺陷数据，所有配置项均为自定义主数据。';

    const procOpts = ['<option value="ALL"' + (fProc === 'ALL' ? ' selected' : '') + '>全部工序</option>']
      .concat(cfg.processes.map(p => `<option value="${esc(p)}"${fProc === p ? ' selected' : ''}>${esc(p)}</option>`)).join('');

    const rows = cfg.items.filter(i => (fDept === 'ALL' || i.dept === fDept) && (fProc === 'ALL' || i.process === fProc));

    const body = rows.length ? rows.map((it, idx) => {
      const gi = cfg.items.indexOf(it);
      const eqChips = it.equip.length
        ? it.equip.slice(0, 4).map(e => `<span class="chip lang">${esc(e)}</span>`).join('') + (it.equip.length > 4 ? `<span class="chip">+${it.equip.length - 4}</span>` : '')
        : '<span class="muted small">未绑定</span>';
      const procChip = it.process ? `<span class="chip">${esc(it.process)}</span>` : '<span class="muted small">未分类</span>';
      return `<tr data-gi="${gi}">
        <td><span class="lang" style="font-family:'JetBrains Mono',Consolas,monospace;font-weight:600">${esc(it.code)}</span></td>
        <td>${esc(it.name)}</td>
        <td>${deptBadge(it.dept)}</td>
        <td>${procChip}</td>
        <td><div class="flex acenter gap5" style="flex-wrap:wrap">${eqChips}</div></td>
        ${canEdit ? `<td class="center"><div class="flex acenter gap6" style="justify-content:center">
            <button class="btn btn-sm" data-edit="${gi}">${icon('settings', 14)} 编辑</button>
            <button class="btn btn-sm btn-danger" data-rm="${gi}">${icon('trash', 14)}</button>
          </div></td>` : '<td class="center muted small">只读</td>'}
      </tr>`;
    }).join('') : `<tr><td colspan="${canEdit ? 6 : 6}" class="center muted">当前筛选条件下无次品项，点击「新增次品项」添加。</td></tr>`;

    return `
      <div class="cfg-note mb12">${icon('alert', 15)} ${matchNote} 部门固定为 <b>LEAD / NON-LEAD / PLATING</b>（项目口径，不可编辑）；工序与设备池可在「② 设备与工序维护」中增删。</div>
      <div class="card">
        <div class="card-head">
          <div class="card-title">${icon('layers', 19)} 次品项主数据
            <span class="card-sub">按部门 / 工序筛选 · 共 ${cfg.items.length} 项 · 当前显示 ${rows.length} 项</span></div>
          <div class="flex acenter gap8">
            <div class="seg" id="segDept">
              <button data-d="ALL" class="${fDept === 'ALL' ? 'active' : ''}">全部</button>
              ${DEPTS.map(d => `<button data-d="${d}" class="${fDept === d ? 'active' : ''}">${d}</button>`).join('')}
            </div>
            <select class="input" id="selProc" style="width:170px">${procOpts}</select>
            <button class="btn btn-sm" id="btnExport">${icon('download', 16)} 导出 Excel</button>
            ${canEdit ? `<button class="btn btn-sm btn-primary" id="btnAddItem">${icon('plus', 16)} 新增次品项</button>` : '<span class="chip">只读</span>'}
          </div>
        </div>
        <div class="card-body">
          <table class="table" id="tblItems">
            <thead><tr>
              <th>代码</th><th>名称</th><th class="center">部门</th><th class="center">工序</th>
              <th>绑定设备（机台）</th>${canEdit ? '<th class="center">操作</th>' : '<th class="center">操作</th>'}
            </tr></thead>
            <tbody>${body}</tbody>
          </table>
        </div>
      </div>`;
  }

  function deptBadge(d) {
    const map = {
      'LEAD': { bg: 'rgba(37,99,235,.12)', c: '#1a3f9e', t: 'LEAD' },
      'NON-LEAD': { bg: 'rgba(16,128,90,.12)', c: '#0d6b4b', t: 'NON-LEAD' },
      'PLATING': { bg: 'rgba(139,92,246,.14)', c: '#5b21b6', t: 'PLATING' }
    };
    const m = map[d] || { bg: 'var(--surface-3)', c: 'var(--text-2)', t: d };
    return `<span class="dept-badge" style="background:${m.bg};color:${m.c}">${m.t}</span>`;
  }

  /* 新增 / 编辑 次品项弹窗 */
  function openItemDlg(gi) {
    const editing = (gi != null && cfg.items[gi]);
    const it = editing ? Object.assign({}, cfg.items[gi]) : { code: '', name: '', dept: DEPTS[0], process: cfg.processes[0] || '', equip: [] };
    const procOpts = cfg.processes.map(p => `<option value="${esc(p)}"${p === it.process ? ' selected' : ''}>${esc(p)}</option>`).join('') ||
      `<option value="">（请先在「② 设备与工序维护」添加工序）</option>`;
    const deptOpts = DEPTS.map(d => `<option value="${d}"${d === it.dept ? ' selected' : ''}>${d}</option>`).join('');
    const eqChips = cfg.equipPool.map(e => {
      const on = it.equip.indexOf(e) >= 0;
      return `<span class="eq-chip${on ? ' on' : ''}" data-eq="${esc(e)}">${esc(e)}${on ? ' ✓' : ''}</span>`;
    }).join('') || '<span class="muted small">设备池为空，请先在「② 设备与工序维护」添加机台</span>';

    openDialog({
      title: editing ? '编辑次品项' : '新增次品项',
      sub: '维护该次品项的<strong>名称与代码</strong>，并选择其<strong>绑定的设备（机台）</strong>',
      width: 720,
      okText: '保存',
      body: `
        <div class="flex gap16" style="align-items:flex-start">
          <div style="flex:1">
            <label class="field-label">代码（唯一标识）</label>
            <input class="input lang" id="itCode" value="${esc(it.code)}" placeholder="如 MMS AL01 / MOLD BMD2" ${editing ? 'readonly' : ''} style="font-family:'JetBrains Mono',Consolas,monospace">
            ${editing ? '<div class="small muted mt6">代码为唯一键，编辑时不可修改（如需变更请删除后新增）。</div>' : '<div class="small muted mt6">与真实缺陷类别代码一致时可自动对齐大屏数据。</div>'}

            <label class="field-label mt16">名称</label>
            <input class="input" id="itName" value="${esc(it.name)}" placeholder="如 少球 / 外来物">

            <div class="flex gap12 mt16">
              <div style="flex:1"><label class="field-label">部门</label>
                <select class="input" id="itDept" style="width:100%">${deptOpts}</select></div>
              <div style="flex:1"><label class="field-label">工序</label>
                <select class="input" id="itProc" style="width:100%">${procOpts}</select></div>
            </div>
          </div>
          <div style="flex:1">
            <label class="field-label">绑定设备（机台）<span class="small muted">（可多选 · 点击切换）</span></label>
            <div id="dlgEquip" class="flex acenter gap6" style="flex-wrap:wrap;max-height:240px;overflow:auto;padding:8px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2)">${eqChips}</div>
            <div class="small muted mt8">绑定的设备即该次品项可归因的机台；次品管理大屏下钻到机台维度时，可据此关联定位责任设备。</div>
          </div>
        </div>`,
      onOk: () => {
        const code = getVal('itCode').trim();
        const name = getVal('itName').trim();
        const dept = getVal('itDept');
        const proc = getVal('itProc');
        const equip = Array.from(document.querySelectorAll('#dlgEquip .eq-chip.on')).map(el => el.dataset.eq);
        if (!code) { toast('请填写次品项代码', 'warn'); return; }
        if (!name) { toast('请填写次品项名称', 'warn'); return; }
        if (!proc) { toast('请选择工序（可到「② 设备与工序维护」添加）', 'warn'); return; }
        if (!editing) {
          if (cfg.items.some(i => i.code === code)) { toast('代码「' + code + '」已存在，请使用唯一代码', 'danger'); return; }
          cfg.items.push({ code, name, dept: DEPTS.indexOf(dept) >= 0 ? dept : DEPTS[0], process: proc, equip });
          toast('已新增次品项「' + name + '」（' + code + '）', 'success');
        } else {
          const t = cfg.items[gi];
          t.name = name; t.dept = DEPTS.indexOf(dept) >= 0 ? dept : t.dept; t.process = proc; t.equip = equip;
          toast('已保存次品项「' + name + '」', 'success');
        }
        DefectCfgStore.save(cfg);
        render();
      }
    });

    // 绑定设备 chips 切换
    document.querySelectorAll('#dlgEquip .eq-chip').forEach(ch => {
      ch.onclick = () => { ch.classList.toggle('on'); ch.innerHTML = ch.dataset.eq + (ch.classList.contains('on') ? ' ✓' : ''); };
    });
  }

  /* =========================================================
     ② 设备与工序维护
     ========================================================= */
  function viewEquip() {
    const eqChips = cfg.equipPool.map(e => {
      const used = cfg.items.filter(i => i.equip.indexOf(e) >= 0).length;
      return `<span class="eq-pool" data-eq="${esc(e)}">${esc(e)}
        ${canEdit ? `<button class="eq-x" data-rm="${esc(e)}" title="删除${used ? '（将从 ' + used + ' 个次品项移除绑定）' : ''}">×</button>` : ''}
        ${used ? `<i class="eq-used">绑 ${used}</i>` : ''}</span>`;
    }).join('') || '<span class="muted small">设备池为空，请在下方添加机台。</span>';

    const procChips = cfg.processes.map(p => {
      const used = cfg.items.filter(i => i.process === p).length;
      return `<span class="eq-pool" data-proc="${esc(p)}">${esc(p)}
        ${canEdit ? `<button class="eq-x" data-rmproc="${esc(p)}" title="删除${used ? '（被 ' + used + ' 个次品项使用）' : ''}">×</button>` : ''}
        ${used ? `<i class="eq-used">用 ${used}</i>` : ''}</span>`;
    }).join('') || '<span class="muted small">工序为空，请在下方添加。</span>';

    return `
      <div class="cfg-note mb12">${icon('alert', 15)} <strong>部门固定为 LEAD / NON-LEAD / PLATING</strong>（项目口径，不可编辑）。本页维护<b>设备池（机台）</b>与<b>工序</b>，二者供「① 次品项主数据」中的设备绑定与工序归类使用。</div>

      <div class="card">
        <div class="card-head">
          <div class="card-title">${icon('server', 19)} 设备池（机台）
            <span class="card-sub">次品项可绑定的设备清单 · 共 ${cfg.equipPool.length} 台</span></div>
          ${canEdit ? `<div class="flex acenter gap8">
            <input class="input lang" id="addEquip" placeholder="新增机台代码，如 BMD-31" style="width:200px;font-family:'JetBrains Mono',Consolas,monospace">
            <button class="btn btn-sm btn-primary" id="btnAddEquip">${icon('plus', 16)} 添加</button>
          </div>` : '<span class="chip">只读</span>'}
        </div>
        <div class="card-body">
          <div class="flex acenter gap8" style="flex-wrap:wrap">${eqChips}</div>
          <div class="sub-note mt10">标「绑 N」表示该设备已被 N 个次品项绑定；删除设备会同步从相关次品项移除该绑定。</div>
        </div>
      </div>

      <div class="card mt16">
        <div class="card-head">
          <div class="card-title">${icon('layers', 19)} 工序（Process）
            <span class="card-sub">次品项的工序归类 · 共 ${cfg.processes.length} 项</span></div>
          ${canEdit ? `<div class="flex acenter gap8">
            <input class="input" id="addProc" placeholder="新增工序，如 电镀/PLATING" style="width:200px">
            <button class="btn btn-sm btn-primary" id="btnAddProc">${icon('plus', 16)} 添加</button>
          </div>` : '<span class="chip">只读</span>'}
        </div>
        <div class="card-body">
          <div class="flex acenter gap8" style="flex-wrap:wrap">${procChips}</div>
          <div class="sub-note mt10">标「用 N」表示该工序已被 N 个次品项使用；被使用的工序需先改派次品项后方可删除。</div>
        </div>
      </div>`;
  }

  /* =========================================================
     事件绑定
     ========================================================= */
  function bind() {
    const st = document.getElementById('segTab');
    if (st) st.querySelectorAll('button').forEach(b => b.onclick = () => { tab = b.dataset.t; render(); });

    const bra = document.getElementById('btnResetAll');
    if (bra) bra.onclick = () => {
      DefectCfgStore.reset();
      cfg = DefectCfgStore.all();
      fDept = 'ALL'; fProc = 'ALL';
      toast('已恢复默认配置', 'success'); render();
    };

    // ① 次品项
    const sd = document.getElementById('segDept');
    if (sd) sd.querySelectorAll('button').forEach(b => b.onclick = () => { fDept = b.dataset.d; render(); });
    const sp = document.getElementById('selProc');
    if (sp) sp.onchange = () => { fProc = sp.value; render(); };

    const bai = document.getElementById('btnAddItem');
    if (bai) bai.onclick = () => openItemDlg(null);

    const be = document.getElementById('btnExport');
    if (be) be.onclick = () => {
      const rows = cfg.items.filter(i => (fDept === 'ALL' || i.dept === fDept) && (fProc === 'ALL' || i.process === fProc));
      const headers = ['代码', '名称', '部门', '工序', '绑定设备', '设备数'];
      const data = rows.map(i => [i.code, i.name, i.dept, i.process, i.equip.join(' / '), i.equip.length]);
      exportExcel('次品项主数据_' + (fDept === 'ALL' ? '全部部门' : fDept) + '_' + fmtDateCN(new Date()) + '.xls', headers, data);
      toast('已导出 ' + rows.length + ' 条次品项', 'success');
    };

    document.querySelectorAll('#tblItems [data-edit]').forEach(b => b.onclick = () => openItemDlg(Number(b.dataset.edit)));
    document.querySelectorAll('#tblItems [data-rm]').forEach(b => b.onclick = () => {
      const gi = Number(b.dataset.rm);
      const it = cfg.items[gi]; if (!it) return;
      cfg.items.splice(gi, 1);
      DefectCfgStore.save(cfg);
      toast('已删除次品项「' + it.name + '」（' + it.code + '）', 'success'); render();
    });

    // ② 设备与工序
    const bae = document.getElementById('btnAddEquip');
    if (bae) bae.onclick = () => {
      const v = getVal('addEquip').trim();
      if (!v) { toast('请填写机台代码', 'warn'); return; }
      if (cfg.equipPool.indexOf(v) >= 0) { toast('设备「' + v + '」已存在', 'warn'); return; }
      cfg.equipPool.push(v); DefectCfgStore.save(cfg);
      toast('已添加设备 ' + v, 'success'); render();
    };
    const bap = document.getElementById('btnAddProc');
    if (bap) bap.onclick = () => {
      const v = getVal('addProc').trim();
      if (!v) { toast('请填写工序名称', 'warn'); return; }
      if (cfg.processes.indexOf(v) >= 0) { toast('工序「' + v + '」已存在', 'warn'); return; }
      cfg.processes.push(v); DefectCfgStore.save(cfg);
      toast('已添加工序 ' + v, 'success'); render();
    };
    // 设备删除
    document.querySelectorAll('.eq-x[data-rm]').forEach(b => b.onclick = () => {
      const eq = b.dataset.rm;
      const used = cfg.items.filter(i => i.equip.indexOf(eq) >= 0).length;
      cfg.equipPool = cfg.equipPool.filter(x => x !== eq);
      cfg.items.forEach(i => { i.equip = i.equip.filter(x => x !== eq); });
      DefectCfgStore.save(cfg);
      toast(used ? `已删除设备 ${eq}，并从 ${used} 个次品项移除绑定` : `已删除设备 ${eq}`, 'success'); render();
    });
    document.querySelectorAll('.eq-x[data-rmproc]').forEach(b => b.onclick = () => {
      const p = b.dataset.rmproc;
      const used = cfg.items.filter(i => i.process === p).length;
      if (used) { toast(`工序「${p}」已被 ${used} 个次品项使用，请先在「① 次品项主数据」中改派后再删除`, 'warn'); return; }
      cfg.processes = cfg.processes.filter(x => x !== p);
      DefectCfgStore.save(cfg);
      toast(`已删除工序 ${p}`, 'success'); render();
    });
  }

  render();
})();
