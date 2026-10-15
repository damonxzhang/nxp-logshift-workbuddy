/* ============ WIP · 品类配置 ============
   维护 WIP 在制品看板热力矩阵「品类列头」主数据：
   品类代码 / 显示名 / 单价口径 / 是否在矩阵显示 / 排行联动站点清单（颜色由系统默认调色板分配，不再开放配置）。
   配置写入 localStorage（WipTypeStore），wip.html 与本页共用同一份；
   数据中出现但未配置的品类在看板上按默认样式自动补齐。
   权限：与 OP / 次品配置页口径一致，仅管理员（output 编辑权限）可编辑，否则整页只读。 */
(function () {
  renderShell('wipcfg');

  const canEdit = CurrentUser.can('output', 'edit');

  /* WIP 数据中出现的品类（按在制量降序）：用于「未配置品类」提示 */
  const dataTypes = (() => {
    if (typeof WIP_REAL_DATA === 'undefined' || !WIP_REAL_DATA || !Array.isArray(WIP_REAL_DATA.rows)) return [];
    const q = {};
    WIP_REAL_DATA.rows.forEach(r => { if (r[1]) q[r[1]] = (q[r[1]] || 0) + (r[7] || 0); });
    return Object.keys(q).sort((a, b) => q[b] - q[a]);
  })();

  /* OP 单价口径可选项（来自「OP 目标与权限配置」的 PKG Type） */
  const priceKeys = (() => {
    try { return (typeof OPTypeStore !== 'undefined' ? OPTypeStore.all() : []).map(t => t.id).filter(Boolean); } catch (e) { return []; }
  })();

  let cfg = WipTypeStore.all();      // 工作副本

  function render() {
    const miss = dataTypes.filter(t => !cfg.some(c => c.key === t));

    const body = cfg.map((t, i) => {
      const stPreview = t.stations.length
        ? t.stations.slice(0, 5).map(s => `<span class="chip lang" style="font-size:12px">${esc(s[0])}</span>`).join('') +
          (t.stations.length > 5 ? `<span class="chip" style="font-size:12px">+${t.stations.length - 5}</span>` : '')
        : '<span class="muted small">未配置（联动时沿用 BGA 清单）</span>';
      return `<tr data-i="${i}">
        <td><span class="lang" style="font-family:'JetBrains Mono',Consolas,monospace;font-weight:600">${esc(t.key)}</span>
          ${dataTypes.includes(t.key) ? '' : '<span class="small muted" title="WIP 当前数据中暂无该品类批次">（数据暂无）</span>'}</td>
        <td style="font-weight:600">${esc(t.name)}</td>
        <td class="center">${t.showInHeat
          ? '<span class="wt-heat-on">✓ 矩阵显示</span>'
          : '<span class="wt-heat-off">✗ 不显示（仍计入合计/排行）</span>'}</td>
        <td>${t.priceKey ? `<span class="chip">${esc(t.priceKey)}</span>` : '<span class="muted small">—</span>'}</td>
        <td><div class="flex acenter gap5" style="flex-wrap:wrap">${stPreview}</div></td>
        ${canEdit ? `<td class="center"><div class="flex acenter gap6" style="justify-content:center">
            <button class="btn btn-sm" data-edit="${i}">${icon('settings', 14)} 编辑</button>
            <button class="btn btn-sm btn-danger" data-rm="${i}">${icon('trash', 14)}</button>
          </div></td>` : '<td class="center muted small">只读</td>'}
      </tr>`;
    }).join('') || `<tr><td colspan="6" class="center muted">暂无品类配置，点击「新增品类」添加。</td></tr>`;

    document.getElementById('content').innerHTML = `
      ${miss.length ? `<div class="notice mt16">${icon('info', 16)} WIP 数据中检测到未配置品类：<b>${miss.map(esc).join('、')}</b>，
        看板将按默认样式展示；如需自定义显示名 / 颜色 / 站点清单，请点击「新增品类」录入（品类代码需与数据一致）。</div>` : ''}
      <div class="card mt16">
        <div class="card-head">
          <div class="card-title">${icon('layers', 19)} 品类配置（热力矩阵列头）
            <span class="card-sub">WIP 看板热力矩阵的品类列头由此维护 · 共 ${cfg.length} 个品类 · 保存后刷新 wip.html 即生效</span></div>
          <div class="flex acenter gap8">
            ${canEdit ? `<button class="btn btn-sm btn-primary" id="btnAddType">${icon('plus', 16)} 新增品类</button>
            <button class="btn btn-sm" id="btnReset">${icon('refresh', 16)} 恢复默认配置</button>` : '<span class="chip">只读（无编辑权限）</span>'}
          </div>
        </div>
        <div class="card-body">
          <table class="table" id="tblTypes">
            <thead><tr>
              <th>品类代码</th><th>显示名</th><th class="center">热力矩阵列头</th>
              <th>单价口径（OP）</th><th>排行联动站点清单</th><th class="center">操作</th>
            </tr></thead>
            <tbody>${body}</tbody>
          </table>
        </div>
        </div>
      </div>`;

    bind();
  }

  /* ---------------- 新增 / 编辑品类弹窗 ---------------- */
  function openTypeDlg(i) {
    const editing = (i != null && cfg[i]);
    const it = editing ? JSON.parse(JSON.stringify(cfg[i]))
      : { key: '', name: '', color: '#64748b', priceKey: priceKeys[0] || '', showInHeat: true, stations: [] };

    const priceOpts = ['<option value="">（不折算 Earn，按品类代码直查）</option>']
      .concat(priceKeys.map(k => `<option value="${esc(k)}"${k === it.priceKey ? ' selected' : ''}>${esc(k)}</option>`)).join('');
    const stHtml = it.stations.map(s => stRowHtml(s[0], s[1].join(', '))).join('');

    openDialog({
      title: editing ? `编辑品类 · ${esc(it.key)}` : '新增品类',
      sub: '维护显示名 / 单价口径 / 是否在矩阵显示，以及排行联动的站点清单（颜色由系统默认调色板分配）',
      width: 780,
      okText: '保存',
      body: `
        <div class="flex gap16" style="align-items:flex-start">
          <div style="flex:1">
            <label class="field-label">品类代码（唯一标识，与 WIP 数据 PKG Type 一致）</label>
            <input class="input lang" id="wtKey" value="${esc(it.key)}" placeholder="如 BGA / LGA / QFN" ${editing ? 'readonly' : ''} style="font-family:'JetBrains Mono',Consolas,monospace">
            ${editing ? '<div class="small muted mt6">代码为唯一键，编辑时不可修改（如需变更请删除后新增）。</div>' : ''}

            <label class="field-label mt16">显示名</label>
            <input class="input" id="wtName" value="${esc(it.name)}" placeholder="如 BGA/LGA（留空则显示代码）">

            <div class="flex gap12 mt16">
              <div style="flex:1">
                <label class="field-label">单价口径（OP PKG Type）</label>
                <select class="input" id="wtPrice" style="width:100%">${priceOpts}</select>
              </div>
            </div>

            <label class="field-label mt16">热力矩阵列头</label>
            <label class="flex acenter gap8" style="cursor:pointer">
              <input type="checkbox" id="wtHeat" ${it.showInHeat ? 'checked' : ''}>
              <span class="small">在热力矩阵显示该品类列头（关闭后仍计入合计 / 排行 / KPI）</span>
            </label>
          </div>
          <div style="flex:1.15">
            <label class="field-label">排行联动站点清单 <span class="small muted">（点击矩阵列头时右侧排行按此清单展示）</span></label>
            <div id="stRows">${stHtml}</div>
            <button class="btn btn-sm mt8" id="stAdd" type="button">${icon('plus', 14)} 添加站点</button>
            <div class="small muted mt8">站点显示名随意（如 mold / Ship）；工序代码需与 WIP 数据的 Station 一致，多个代码用逗号分隔（如 BMOLD, QMOLD）。
              清单留空时，联动排行沿用 BGA 的站点清单。</div>
          </div>
        </div>`,
      onOk: (_m, close) => {
        const key = getVal('wtKey');
        const name = getVal('wtName');
        const priceKey = getVal('wtPrice');
        const showInHeat = getChk('wtHeat');
        const stations = Array.from(document.querySelectorAll('#stRows .st-row')).map(row => {
          const nm = row.querySelector('.st-name').value.trim();
          const codes = row.querySelector('.st-codes').value.split(/[,，\s]+/).map(x => x.trim()).filter(Boolean);
          return [nm, codes];
        }).filter(s => s[0] && s[1].length);
        if (!key) { toast('请填写品类代码', 'warn'); return; }
        if (!editing && cfg.some(c => c.key === key)) { toast('品类代码「' + key + '」已存在', 'danger'); return; }
        if (!editing) {
          cfg.push({ key, name: name || key, color: nextColor(), priceKey, showInHeat, stations });
          toast('已新增品类「' + (name || key) + '」（' + key + '）', 'success');
        } else {
          const t = cfg[i];
          t.name = name || key; t.priceKey = priceKey; t.showInHeat = showInHeat; t.stations = stations;
          toast('已保存品类「' + t.name + '」（' + t.key + '）', 'success');
        }
        WipTypeStore.save(cfg);
        render();
        close();
      }
    });

    /* 站点清单行的增删（弹窗打开后绑定） */
    const bindSt = () => {
      document.querySelectorAll('#stRows .st-rm').forEach(b => {
        b.onclick = () => { b.closest('.st-row').remove(); };
      });
    };
    bindSt();
    document.getElementById('stAdd').onclick = () => {
      document.getElementById('stRows').insertAdjacentHTML('beforeend', stRowHtml('', ''));
      bindSt();
    };
  }

  /* 颜色不再开放配置：新增品类自动从未占用的系统默认调色板取色 */
  const PALETTE = ['#1d4ed8', '#0b8a5a', '#8b5cf6', '#0b6a86', '#a8620b', '#b91c1c', '#0369a1', '#4d7c0f'];
  const nextColor = () => PALETTE.find(c => !cfg.some(t => t.color === c)) || '#64748b';

  function stRowHtml(name, codes) {
    return `<div class="st-row">
      <input class="st-name" placeholder="站点显示名" value="${esc(name)}">
      <input class="st-codes" placeholder="工序代码，逗号分隔" value="${esc(codes)}">
      <button class="st-rm" type="button" title="删除该站点">×</button>
    </div>`;
  }

  /* ---------------- 事件绑定 ---------------- */
  function bind() {
    const bai = document.getElementById('btnAddType');
    if (bai) bai.onclick = () => openTypeDlg(null);

    const br = document.getElementById('btnReset');
    if (br) br.onclick = () => {
      openDialog({
        title: '恢复默认配置',
        sub: '将品类配置重置为内置默认（BGA / LGA / QFN / PQFN / FCCSP），当前修改会全部丢失',
        okText: '恢复默认',
        body: `<div style="line-height:1.8">确认恢复默认品类配置吗？<br><span class="small muted">该操作仅影响 WIP 品类配置，不影响 WIP 数据与其他页面配置。</span></div>`,
        onOk: (_m, close) => { WipTypeStore.reset(); cfg = WipTypeStore.all(); toast('已恢复默认品类配置', 'primary'); render(); close(); }
      });
    };

    document.querySelectorAll('#tblTypes [data-edit]').forEach(b => b.onclick = () => openTypeDlg(Number(b.dataset.edit)));
    document.querySelectorAll('#tblTypes [data-rm]').forEach(b => b.onclick = () => {
      const i = Number(b.dataset.rm);
      const t = cfg[i]; if (!t) return;
      openDialog({
        title: '删除品类',
        sub: `品类「${esc(t.name)}」（${esc(t.key)}）`,
        okText: '删除',
        body: `<div style="line-height:1.8">确认删除该品类吗？<br>
          <span class="small muted">删除后，若 WIP 数据中仍存在该品类批次，看板会按默认样式自动补齐展示；历史筛选偏好将一并失效。</span></div>`,
        onOk: (_m, close) => {
          cfg.splice(i, 1);
          WipTypeStore.save(cfg);
          toast('已删除品类「' + t.key + '」', 'success');
          render();
          close();
        }
      });
    });
  }

  render();
})();
