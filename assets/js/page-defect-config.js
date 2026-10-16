/* ============ 次品管理 · 次品项配置（主数据） ============
   按 部门 / 工序 维护次品项（名称 + 代码）及其与设备（机台）的绑定关系。
   配置写入 localStorage（DefectCfgStore），与次品管理大屏共用同一份主数据。
   权限：需「Output（OP）/ 次品」编辑权限（沿用 OP 配置页口径，仅管理员可编辑）；否则整页只读。
   部门口径：2026-10-16 客户确认统一为 NON-LEAD。 */
(function () {
  renderShell('defectcfg');

  // 与 OP 配置页一致：仅拥有 output 编辑权限（管理员）可编辑，其余角色只读
  const canEdit = CurrentUser.can('output', 'edit');
  const DEPTS = (typeof DEFECT_DEPARTMENTS !== 'undefined' && DEFECT_DEPARTMENTS.length) ? DEFECT_DEPARTMENTS : ['LEAD', 'NON-LEAD', 'PLATING'];

  let cfg = DefectCfgStore.all();
  let fProc = 'ALL';                       // ALL | <process>
  let fCode = '';                          // 代码关键字（模糊，忽略大小写）
  let fName = '';                          // 名称关键字（模糊，忽略大小写）

  // 统一筛选：工序 + 代码/名称关键字（主数据表格与 Excel 导出共用）
  const filteredRows = () => {
    const kCode = fCode.trim().toLowerCase(), kName = fName.trim().toLowerCase();
    return cfg.items.filter(i =>
      (fProc === 'ALL' || i.process === fProc) &&
      (!kCode || String(i.code).toLowerCase().indexOf(kCode) >= 0) &&
      (!kName || String(i.name).toLowerCase().indexOf(kName) >= 0));
  };

  function render() {
    document.getElementById('content').innerHTML = `
      <div id="tabBody" class="mt16">${viewItems()}</div>
    `;

    bind();
  }

  /* =========================================================
     ① 次品项主数据
     ========================================================= */
  function viewItems() {
    const procOpts = ['<option value="ALL"' + (fProc === 'ALL' ? ' selected' : '') + '>全部工序</option>']
      .concat(cfg.processes.map(p => `<option value="${esc(p)}"${fProc === p ? ' selected' : ''}>${esc(p)}</option>`)).join('');

    const rows = filteredRows();

    const body = rows.length ? rows.map((it, idx) => {
      const gi = cfg.items.indexOf(it);
      const procChip = it.process ? `<span class="chip">${esc(it.process)}</span>` : '<span class="muted small">未分类</span>';
      return `<tr data-gi="${gi}">
        <td><span class="lang" style="font-family:'JetBrains Mono',Consolas,monospace;font-weight:600">${esc(it.code)}</span></td>
        <td>${esc(it.name)}</td>
        <td>${deptBadge(it.dept)}</td>
        <td>${procChip}</td>
        ${canEdit ? `<td class="center"><div class="flex acenter gap6" style="justify-content:center">
            <button class="btn btn-sm" data-edit="${gi}">${icon('settings', 14)} 编辑</button>
            <button class="btn btn-sm btn-danger" data-rm="${gi}">${icon('trash', 14)}</button>
          </div></td>` : '<td class="center muted small">只读</td>'}
      </tr>`;
    }).join('') : `<tr><td colspan="5" class="center muted">当前筛选条件下无次品项，点击「新增次品项」添加。</td></tr>`;

    return `
      <div class="card">
        <div class="card-head">
          <div class="card-title">${icon('layers', 19)} 次品项主数据
            <span class="card-sub">按工序筛选 · 共 ${cfg.items.length} 项 · 当前显示 ${rows.length} 项</span></div>
          <div class="flex acenter gap8">
            <input class="input lang" id="fltCode" placeholder="按代码筛选" style="width:120px" value="${esc(fCode)}">
            <input class="input" id="fltName" placeholder="按名称筛选" style="width:120px" value="${esc(fName)}">
            <select class="input" id="selProc" style="width:170px">${procOpts}</select>
            <button class="btn btn-sm" id="btnExport">${icon('download', 16)} 导出 Excel</button>
            ${canEdit ? `<button class="btn btn-sm btn-primary" id="btnAddItem">${icon('plus', 16)} 新增次品项</button>` : '<span class="chip">只读</span>'}
          </div>
        </div>
        <div class="card-body">
          <table class="table" id="tblItems">
            <thead><tr>
              <th>代码</th><th>名称</th><th class="center">部门</th><th class="center">工序</th>
              ${canEdit ? '<th class="center">操作</th>' : '<th class="center">操作</th>'}
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
      `<option value="">（暂无可用工序）</option>`;
    const deptOpts = DEPTS.map(d => `<option value="${d}"${d === it.dept ? ' selected' : ''}>${d}</option>`).join('');
    const eqChips = cfg.equipPool.map(e => {
      const on = it.equip.indexOf(e) >= 0;
      return `<span class="eq-chip${on ? ' on' : ''}" data-eq="${esc(e)}">${esc(e)}${on ? ' ✓' : ''}</span>`;
    }).join('') || '<span class="muted small">设备池为空</span>';

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
      onOk: (_m, close) => {
        const code = getVal('itCode').trim();
        const name = getVal('itName').trim();
        const dept = getVal('itDept');
        const proc = getVal('itProc');
        const equip = Array.from(document.querySelectorAll('#dlgEquip .eq-chip.on')).map(el => el.dataset.eq);
        if (!code) { toast('请填写次品项代码', 'warn'); return; }
        if (!name) { toast('请填写次品项名称', 'warn'); return; }
        if (!proc) { toast('请选择工序', 'warn'); return; }
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
        close();          // 保存成功后关闭弹窗（openDialog 的 onOk 需自行调用 close）
      }
    });

    // 绑定设备 chips 切换
    document.querySelectorAll('#dlgEquip .eq-chip').forEach(ch => {
      ch.onclick = () => { ch.classList.toggle('on'); ch.innerHTML = ch.dataset.eq + (ch.classList.contains('on') ? ' ✓' : ''); };
    });
  }

  /* =========================================================
     事件绑定
     ========================================================= */
  function bind() {
    // ① 次品项
    const sp = document.getElementById('selProc');
    if (sp) sp.onchange = () => { fProc = sp.value; render(); };

    // 代码 / 名称关键字实时筛选（重绘后恢复焦点与光标位置，保证连续输入）
    const bindFlt = id => {
      const el = document.getElementById(id);
      if (el) el.oninput = () => {
        const pos = el.selectionStart;
        if (id === 'fltCode') fCode = el.value; else fName = el.value;
        render();
        const ne = document.getElementById(id);
        if (ne) { ne.focus(); try { ne.setSelectionRange(pos, pos); } catch (e) {} }
      };
    };
    bindFlt('fltCode'); bindFlt('fltName');

    const bai = document.getElementById('btnAddItem');
    if (bai) bai.onclick = () => openItemDlg(null);

    const be = document.getElementById('btnExport');
    if (be) be.onclick = () => {
      const rows = filteredRows();
      const headers = ['代码', '名称', '部门', '工序', '绑定设备', '设备数'];
      const data = rows.map(i => [i.code, i.name, i.dept, i.process, i.equip.join(' / '), i.equip.length]);
      exportExcel('次品项主数据_全部部门_' + fmtDateCN(new Date()) + '.xls', headers, data);
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

  }

  render();
})();
