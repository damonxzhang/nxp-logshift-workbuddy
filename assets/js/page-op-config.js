/* ============ Output（OP）独立配置页 ============
   四个配置域，全部写入 localStorage，与大屏 output.html 共用同一份数据：
     ① PKG Type 维护（增删改：名称 / 单价 / 默认周目标 / 报警阈值 / 启用）  → OPTypeStore
        · 报警阈值（黄灯 / 红灯，单位 K）挂在每个 PKG Type 上逐项维护
     ② 每周目标数量（按「年份 + 周别」逐 PKG Type 填写本周总目标 K）      → OPGoalStore
     ③ 部门可见范围（哪个部门可以看哪些 PKG Type）                        → OPDeptStore
     ④ 报警比对口径 / 刷新机制 / 夏令时（口径待客户确认，预留入口）        → op_cfg
   权限：需 Output（OP）模块「编辑」权限；否则整页只读。 */
(function () {
  renderShell('opcfg');

  const canEdit = CurrentUser.can('output', 'edit');
  const cur = opCurrentWeek();

  /* ---------------- 配置域 ④：报警 / 刷新 / 夏令时 ---------------- */
  let cfg = Object.assign({}, OP_DEFAULTS, store.get('op_cfg', {}));
  cfg.alarm = Object.assign({}, OP_DEFAULTS.alarm, cfg.alarm || {});
  cfg.refresh = Object.assign({}, OP_DEFAULTS.refresh, cfg.refresh || {});
  const saveCfg = () => store.set('op_cfg', cfg);

  /* ---------------- 状态 ---------------- */
  let tab = 'types';                       // types | goals | dept | alarm
  let types = OPTypeStore.all();           // 工作副本
  let goalYear = cur.year, goalWeek = cur.week;
  let depts = OPDeptStore.all();           // 工作副本

  const TABS = [
    { key: 'types', label: '① PKG Type 维护', icon: 'layers' },
    { key: 'goals', label: '② 每周目标数量', icon: 'target' },
    { key: 'dept', label: '③ 部门可见范围', icon: 'users' },
    { key: 'alarm', label: '④ 比对口径 / 刷新 / 夏令时', icon: 'alert' }
  ];

  function render() {
    document.getElementById('content').innerHTML = `
      <div class="notice mt16" style="--nc:var(--primary)">
        ${icon('settings', 19)}
        <div><strong>Output（OP）独立配置页：</strong>PKG Type 维护（含<strong>逐品类的黄灯 / 红灯报警阈值</strong>）、<strong>每周 PKG Type 目标数量</strong>、
        <strong>部门可见范围（哪个部门可以看什么）</strong>、比对口径 / 刷新 / 夏令时均在此配置，保存后
        <a class="chip chip-link" href="output.html">Output（OP）大屏</a> 即时生效。
        ${canEdit ? '' : '<br><span class="badge b-warn">只读</span> 当前角色无 Output（OP）「编辑」权限，仅可查看配置。'}</div>
      </div>

      <div class="card mt16 no-print">
        <div class="card-head">
          <div class="card-title">${icon('settings', 19)} 配置域
            <span class="card-sub">共 4 类 · 保存后立即写入本地配置仓库</span></div>
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
    if (tab === 'types') return viewTypes();
    if (tab === 'goals') return viewGoals();
    if (tab === 'dept') return viewDept();
    return viewAlarm();
  }

  /* =========================================================
     ① PKG Type 维护
     ========================================================= */
  function viewTypes() {
    const al = opAlarmSum(types.filter(t => t.enabled !== false).map(t => t.id));
    return `
      <div class="card">
        <div class="card-head">
          <div class="card-title">${icon('layers', 19)} PKG Type 维护
            <span class="card-sub">客户后台可增删改 · 默认周目标用于未单独配置周别的场景 · <strong>报警阈值逐品类维护</strong></span></div>
          <div class="flex acenter gap8">
            ${canEdit ? `<button class="btn btn-sm" id="btnTypeAdd">${icon('plus', 16)} 新增 PKG Type</button>
            <button class="btn btn-sm btn-primary" id="btnTypeSave">${icon('check', 16)} 保存</button>` : '<span class="chip">只读</span>'}
          </div>
        </div>
        <div class="card-body">
          <table class="table" id="tblTypes">
            <thead><tr>
              <th>PKG Type（唯一标识）</th><th>显示名</th>
              <th class="center">单价（元/粒）</th><th class="center">默认周目标 [K]</th>
              <th class="center" style="width:120px">黄灯阈值 [K]<div class="small muted" style="font-weight:400">缺口 ≥ 此值报警</div></th>
              <th class="center" style="width:120px">红灯阈值 [K]<div class="small muted" style="font-weight:400">缺口 ≥ 此值报警</div></th>
              <th class="center">启用</th><th class="center">本周状态</th>${canEdit ? '<th class="center">操作</th>' : ''}
            </tr></thead>
            <tbody>${typeRows()}</tbody>
          </table>
          <div class="cfg-note mt12">${icon('alert', 15)}
            阈值为<strong>每个 PKG Type 独立配置</strong>（单位 K，与实际产出同量纲）：当日「目标累计 − 实际累计」缺口 ≥ 黄灯阈值 → 黄灯，≥ 红灯阈值 → 红灯，要求红灯阈值 ≥ 黄灯阈值。
            大屏在「全部品类」汇总视图下，判定阈值为参与汇总各品类阈值<strong>之和</strong>（当前启用品类合计 黄 ${al.yellowK}K / 红 ${al.redK}K）。</div>
          <div class="cfg-note mt12">${icon('alert', 15)} PKG Type 名称需与 IT 库口径一致；单价用于 Earn 金额折算（万元 = 累计K × 单价 / 10）。删除后该品类的历史周目标配置会一并失效。</div>
        </div>
      </div>`;
  }

  /* 阈值输入非法（红 ≤ 黄）时给出即时提示 */
  function thCls(y, r) {
    return (isFinite(y) && isFinite(r) && r > 0 && r <= y) ? ' input-bad' : '';
  }

  function typeRows() {
    const w = genOpWeek(goalYear, goalWeek);
    return types.map((t, i) => {
      const y = t.yellowK == null ? OP_DEFAULTS.alarm.yellowK : Number(t.yellowK);
      const r = t.redK == null ? OP_DEFAULTS.alarm.redK : Number(t.redK);
      const a = opTypeAlarm(t.id, w, { yellowK: y, redK: r, mode: 'diff' });
      return `<tr data-i="${i}">
        <td><input class="input" data-k="id" value="${esc(t.id)}" ${canEdit ? '' : 'readonly'} style="min-width:110px"></td>
        <td><input class="input" data-k="name" value="${esc(t.name || t.id)}" ${canEdit ? '' : 'readonly'} style="min-width:110px"></td>
        <td class="center"><input class="input num" type="number" step="0.01" min="0" data-k="price" value="${t.price == null ? '' : t.price}" ${canEdit ? '' : 'readonly'} style="width:90px;text-align:center"></td>
        <td class="center"><input class="input num" type="number" step="50" min="0" data-k="goal" value="${t.goal == null ? 0 : t.goal}" ${canEdit ? '' : 'readonly'} style="width:110px;text-align:center"></td>
        <td class="center"><input class="input num t-th${thCls(y, r)}" type="number" step="0.5" min="0" data-k="yellowK" value="${y}" ${canEdit ? '' : 'readonly'} style="width:90px;text-align:center" title="缺口 ≥ ${y}K 时黄灯报警"></td>
        <td class="center"><input class="input num t-th${thCls(y, r)}" type="number" step="1" min="0" data-k="redK" value="${r}" ${canEdit ? '' : 'readonly'} style="width:90px;text-align:center" title="缺口 ≥ ${r}K 时红灯报警"></td>
        <td class="center"><input type="checkbox" data-k="enabled" ${t.enabled !== false ? 'checked' : ''} ${canEdit ? '' : 'disabled'}></td>
        <td class="center" data-role="alarm">${alarmBadge(a)}</td>
        ${canEdit ? `<td class="center"><button class="btn btn-sm btn-danger" data-rm="${i}">${icon('trash', 14)}</button></td>` : ''}
      </tr>`;
    }).join('') || `<tr><td colspan="${canEdit ? 9 : 8}" class="center muted">暂无 PKG Type，请点击「新增 PKG Type」</td></tr>`;
  }

  function alarmBadge(a) {
    return a.red > 0 ? '<span class="badge b-danger">红灯 ' + a.red + ' 天</span>'
      : (a.yellow > 0 ? '<span class="badge b-warn">黄灯 ' + a.yellow + ' 天</span>'
        : '<span class="badge b-success">达标</span>');
  }

  /* 阈值 / 单价等改动后，就地重算该行的「本周状态」，无需先保存 */
  function refreshRowAlarm(tr) {
    const cell = tr.querySelector('[data-role="alarm"]');
    if (!cell) return;
    const idx = Number(tr.dataset.i);
    const t = types[idx]; if (!t) return;
    const val = k => { const el = tr.querySelector(`[data-k="${k}"]`); return el ? (el.type === 'checkbox' ? el.checked : el.value) : null; };
    const y = Number(val('yellowK')); const r = Number(val('redK'));
    const bad = isFinite(y) && isFinite(r) && r > 0 && r <= y;
    tr.querySelectorAll('.t-th').forEach(el => el.classList.toggle('input-bad', bad));
    /* 复用引擎同一套判定，只是把阈值换成行内当前值 */
    const w2 = genOpWeek(goalYear, goalWeek);
    const a = opTypeAlarm(t.id, w2, { yellowK: isFinite(y) ? y : OP_DEFAULTS.alarm.yellowK, redK: isFinite(r) ? r : OP_DEFAULTS.alarm.redK, mode: 'diff' });
    cell.innerHTML = alarmBadge(a) + (bad ? '<div class="small" style="color:var(--danger)">红灯阈值需 ≥ 黄灯阈值</div>' : '');
  }

  function collectTypes() {
    const rows = document.querySelectorAll('#tblTypes tbody tr[data-i]');
    const out = [];
    rows.forEach(r => {
      const i = Number(r.dataset.i);
      const prev = types[i] || {};                     // 色标已不在表格中维护，沿用原值不丢失
      const get = k => { const el = r.querySelector(`[data-k="${k}"]`); return el ? (el.type === 'checkbox' ? el.checked : el.value) : null; };
      const id = String(get('id') || '').trim();
      if (!id) return;
      const num = (v, def) => { const n = Number(v); return (v == null || v === '' || !isFinite(n) || n < 0) ? def : n; };
      out.push({
        id,
        name: String(get('name') || id).trim(),
        color: prev.color || '#1d4ed8',
        price: Number(get('price')) || 0,
        goal: Math.max(0, Number(get('goal')) || 0),
        yellowK: num(get('yellowK'), OP_DEFAULTS.alarm.yellowK),
        redK: num(get('redK'), OP_DEFAULTS.alarm.redK),
        enabled: !!get('enabled')
      });
    });
    return out;
  }

  /* =========================================================
     ② 每周目标数量
     ========================================================= */
  function viewGoals() {
    const w = opWeeksInYear(goalYear);
    const opts = [];
    for (let k = 1; k <= w; k++) {
      const s = opWeekStartOf(goalYear, k), e = new Date(s); e.setDate(s.getDate() + 6);
      const m2 = n => String(n).padStart(2, '0');
      const tag = (k === cur.week && goalYear === cur.year) ? '（本周）' : '';
      opts.push(`<option value="${k}" ${k === goalWeek ? 'selected' : ''}>第 ${m2(k)} 周 · ${m2(s.getMonth() + 1)}/${m2(s.getDate())}-${m2(e.getMonth() + 1)}/${m2(e.getDate())}${tag}</option>`);
    }
    const custom = OPGoalStore.of(goalYear, goalWeek);
    const prev = prevWeek(goalYear, goalWeek);
    const prevMap = OPGoalStore.of(prev.year, prev.week);
    const enabled = types.filter(t => t.enabled !== false);

    const rows = enabled.map(t => {
      const curV = custom && custom[t.id] != null ? custom[t.id] : (Number(t.goal) || 0);
      const defV = Number(t.goal) || 0;
      const pv = prevMap && prevMap[t.id] != null ? prevMap[t.id] : defV;
      return `<tr>
        <td><span class="pt-dot" style="background:${esc(t.color || '#1d4ed8')}"></span><strong>${esc(t.id)}</strong></td>
        <td class="center num"><input class="input num" type="number" min="0" step="50" data-g="${esc(t.id)}" value="${curV}" ${canEdit ? '' : 'readonly'} style="width:130px;text-align:center"></td>
        <td class="center num muted">${defV.toLocaleString()}</td>
        <td class="center num muted">${Number(pv).toLocaleString()}</td>
        <td class="center">${(custom && custom[t.id] != null) ? '<span class="badge b-info">已单独配置</span>' : '<span class="badge b-neutral">沿用默认</span>'}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="5" class="center muted">请先到「① PKG Type 维护」启用至少一个品类</td></tr>';

    return `
      <div class="card">
        <div class="card-head">
          <div class="card-title">${icon('target', 19)} 每周 PKG Type 目标数量
            <span class="card-sub">按「年份 + 周别」逐品类填写本周总目标（K），系统均摊到每天并以累计值逐日展示</span></div>
          <div class="flex acenter gap8">
            <select class="input" id="selGY" style="width:110px">${yearOpts(goalYear)}</select>
            <select class="input" id="selGW" style="width:190px">${opts.join('')}</select>
            ${canEdit ? `<button class="btn btn-sm" id="btnCopyPrev">${icon('arrowRight', 16)} 复制上周</button>
            <button class="btn btn-sm btn-primary" id="btnGoalSave">${icon('check', 16)} 保存本周目标</button>
            <button class="btn btn-sm btn-danger" id="btnGoalClear">${icon('trash', 16)} 清除本周配置</button>` : '<span class="chip">只读</span>'}
          </div>
        </div>
        <div class="card-body">
          <div class="cfg-note mb12">${icon('alert', 15)}
            当前：<strong>${goalYear} 年第 ${goalWeek} 周</strong>（${fmtRange(goalYear, goalWeek)}，周六起始）
            ${custom ? ' · <span class="badge b-info">该周已单独配置</span>' : ' · <span class="badge b-neutral">该周沿用默认周目标</span>'}
            。清除配置后自动回落到「默认周目标」。</div>
          <table class="table" id="tblGoals">
            <thead><tr><th>PKG Type</th><th class="center">本周目标 [K]</th>
              <th class="center">默认周目标 [K]</th><th class="center">上周目标 [K]</th><th class="center">来源</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="cfg-note mt12">${icon('alert', 15)} 目标均摊示例：3,680 → 526、1,051、1,577、2,103、2,629、3,154、3,680（累计值逐日展示，末日精确等于周总目标）。</div>
        </div>
      </div>`;
  }

  function yearOpts(sel) {
    const out = [];
    for (let y = cur.year - 1; y <= cur.year + 1; y++) out.push(`<option value="${y}" ${y === sel ? 'selected' : ''}>${y} 年</option>`);
    return out.join('');
  }
  function fmtRange(y, w) {
    const s = opWeekStartOf(y, w), e = new Date(s); e.setDate(s.getDate() + 6);
    const m2 = n => String(n).padStart(2, '0');
    return `${m2(s.getMonth() + 1)}/${m2(s.getDate())} - ${m2(e.getMonth() + 1)}/${m2(e.getDate())}`;
  }
  function prevWeek(y, w) {
    if (w > 1) return { year: y, week: w - 1 };
    return { year: y - 1, week: opWeeksInYear(y - 1) };
  }

  function collectGoals() {
    const map = {};
    document.querySelectorAll('#tblGoals [data-g]').forEach(el => {
      map[el.dataset.g] = Math.max(0, Number(el.value) || 0);
    });
    return map;
  }

  /* =========================================================
     ③ 部门可见范围
     ========================================================= */
  function viewDept() {
    const allIds = types.map(t => t.id);
    const rows = depts.map((d, i) => {
      const isAll = (d.types || []).indexOf('*') >= 0;
      const boxes = allIds.map(id => {
        const on = isAll || (d.types || []).indexOf(id) >= 0;
        const t = types.find(x => x.id === id) || {};
        return `<label class="db"><input type="checkbox" data-d="${i}" data-v="${esc(id)}" ${on ? 'checked' : ''} ${(canEdit && !isAll) ? '' : 'disabled'}>
          <span class="pt-dot" style="background:${esc(t.color || '#1d4ed8')}"></span>${esc(id)}</label>`;
      }).join('');
      return `<tr>
        <td><strong>${esc(d.dept)}</strong>${d.note ? `<div class="small muted">${esc(d.note)}</div>` : ''}</td>
        <td class="center">
          <label class="db allbox"><input type="checkbox" data-all="${i}" ${isAll ? 'checked' : ''} ${canEdit ? '' : 'disabled'}><strong>全部可见</strong></label>
        </td>
        <td>${boxes || '<span class="muted">—</span>'}</td>
        ${canEdit ? `<td class="center"><button class="btn btn-sm btn-danger" data-drm="${i}">${icon('trash', 14)}</button></td>` : ''}
      </tr>`;
    }).join('') || `<tr><td colspan="${canEdit ? 4 : 3}" class="center muted">暂无部门配置</td></tr>`;

    /* 固定三部门中尚未出现在配置里的（一般为被删除的行） */
    const rest = OP_DEPARTMENTS.filter(x => !depts.some(d => d.dept === x));
    const legacy = depts.filter(d => OP_DEPARTMENTS.indexOf(d.dept) < 0);
    const pv = OPDeptStore.previewDept();

    return `
      <div class="card">
        <div class="card-head">
          <div class="card-title">${icon('users', 19)} 部门可见范围
            <span class="card-sub">部门固定为 LEAD / NON-LEAD / PLATING · 逐部门勾选可见的 PKG Type</span></div>
          <div class="flex acenter gap8">
            ${canEdit ? `${rest.length ? `<select class="input" id="selDeptAdd" style="width:170px"><option value="">补齐部门…</option>${rest.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join('')}</select>
            <button class="btn btn-sm" id="btnDeptAdd">${icon('plus', 16)} 补齐</button>` : ''}
            <button class="btn btn-sm" id="btnDeptReset">${icon('refresh', 16)} 重置为默认</button>
            <button class="btn btn-sm btn-primary" id="btnDeptSave">${icon('check', 16)} 保存</button>` : '<span class="chip">只读</span>'}
          </div>
        </div>
        <div class="card-body">
          <div class="cfg-row mb12">
            <div class="cfg-item">
              <label class="field-label">当前视角部门（大屏按其过滤）</label>
              <select class="input" id="selDeptPreview" style="width:170px">${OP_DEPARTMENTS.map(d => `<option value="${esc(d)}" ${d === pv ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select>
            </div>
            <div class="cfg-item">
              <label class="field-label">该部门可见品类</label>
              <div class="cfg-val">${(OPDeptStore.visibleTypes(pv, types.map(t => t.id)) || []).map(id => `<span class="chip">${esc(id)}</span>`).join(' ') || '<span class="muted">—</span>'}</div>
            </div>
          </div>
          <table class="table" id="tblDept">
            <thead><tr><th style="width:180px">部门</th><th class="center" style="width:110px">全部</th>
              <th>可见 PKG Type</th>${canEdit ? '<th class="center" style="width:80px">操作</th>' : ''}</tr></thead>
            <tbody>${rows}</tbody>
          </table>
          ${legacy.length ? `<div class="cfg-note mt12">${icon('alert', 15)} 检测到历史遗留部门（${legacy.map(d => esc(d.dept)).join('、')}），建议删除；大屏仅按 LEAD / NON-LEAD / PLATING 判定。</div>` : ''}
          <div class="cfg-note mt12">${icon('alert', 15)} 真实环境由<strong>当前登录用户所属部门</strong>自动判定（当前登录：${esc((CurrentUser.get() || {}).name || '—')} · ${esc(CurrentUser.dept() || '—')}，不在三部门内时默认按 LEAD 全量可见）；
            此处「视角部门」仅用于演示验证配置效果，保存后回到大屏即可看到过滤结果。</div>
        </div>
      </div>`;
  }

  function collectDepts() {
    const out = depts.map((d, i) => {
      const allEl = document.querySelector(`#tblDept [data-all="${i}"]`);
      if (allEl && allEl.checked) return { dept: d.dept, types: ['*'], note: d.note || '' };
      const arr = [];
      document.querySelectorAll(`#tblDept [data-d="${i}"]`).forEach(el => { if (el.checked) arr.push(el.dataset.v); });
      return { dept: d.dept, types: arr, note: d.note || '' };
    });
    return out;
  }

  /* =========================================================
     ④ 报警 / 刷新 / 夏令时
     ========================================================= */
  function viewAlarm() {
    const enabledIds = types.filter(t => t.enabled !== false).map(t => t.id);
    const sum = opAlarmSum(enabledIds);
    const rows = enabledIds.map(id => {
      const a = opAlarmOf(id);
      return `<tr>
        <td><strong>${esc(id)}</strong></td>
        <td class="center num">${a.yellowK}</td>
        <td class="center num">${a.redK}</td>
        <td class="center muted small">缺口 ≥ ${a.yellowK}K 黄 / ≥ ${a.redK}K 红</td>
      </tr>`;
    }).join('') || '<tr><td colspan="4" class="center muted">暂无启用的 PKG Type</td></tr>';

    return `
      <div class="card">
        <div class="card-head">
          <div class="card-title">${icon('alert', 19)} 比对口径 / 刷新机制 / 夏令时
            <span class="card-sub">报警阈值已移至「① PKG Type 维护」逐品类维护 · 这里只留全局口径</span></div>
          <div class="flex acenter gap8">
            ${canEdit ? `<button class="btn btn-sm btn-primary" id="btnAlarmSave">${icon('check', 16)} 保存</button>` : '<span class="chip">只读</span>'}
          </div>
        </div>
        <div class="card-body">
          <div class="field-label mb8" style="display:block">异常判定口径（全局）</div>
          <div class="cfg-row">
            <div class="cfg-item"><label class="field-label">比对模式</label>
              <div class="seg" id="cfgAlarmMode">
                <button data-m="diff" class="${cfg.alarm.mode === 'diff' ? 'active' : ''}">差额比对</button>
                <button data-m="composite" class="${cfg.alarm.mode === 'composite' ? 'active' : ''}">复合比对</button>
              </div>
            </div>
            <div class="cfg-item"><label class="field-label">阈值维护位置</label>
              <span class="chip">${icon('layers', 14)} ① PKG Type 维护 · 逐品类</span></div>
            <div class="cfg-item"><label class="field-label">全部品类汇总阈值</label>
              <span class="chip">${icon('alert', 14)} 黄 ${sum.yellowK}K / 红 ${sum.redK}K（${enabledIds.length} 类合计）</span></div>
          </div>
          <table class="table mt12">
            <thead><tr><th>PKG Type</th><th class="center" style="width:110px">黄灯阈值 [K]</th>
              <th class="center" style="width:110px">红灯阈值 [K]</th><th class="center">判定口径</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="cfg-note mt12">${icon('alert', 15)} 上表为当前生效阈值（只读预览）。修改请到
            <a href="javascript:void(0)" id="lnkToTypes">① PKG Type 维护</a> 中逐项调整并保存；差额比对模式下的阈值口径仍待客户最终确认。</div>

          <div class="field-label mt16 mb8" style="display:block">数据刷新机制（频率待 IT 确认）</div>
          <div class="cfg-row">
            <div class="cfg-item"><label class="field-label">刷新模式</label>
              <div class="seg" id="cfgRefresh">
                <button data-m="manual" class="${cfg.refresh.mode === 'manual' ? 'active' : ''}">手动</button>
                <button data-m="auto" class="${cfg.refresh.mode === 'auto' ? 'active' : ''}">自动</button>
              </div>
            </div>
            <div class="cfg-item"><label class="field-label">自动间隔（秒）</label>
              <input class="input" type="number" id="cfgAutoSec" value="${cfg.refresh.autoSec}" min="60" step="60" style="width:100px" ${canEdit ? '' : 'readonly'}></div>
            <div class="cfg-item"><label class="field-label">实际数据来源</label>
              <span class="chip chip-real">${icon('database', 14)} ${esc(OP_DEFAULTS.source)}</span>
              <span class="chip">库表 / 字段口径待客户确认</span></div>
          </div>

          <div class="field-label mt16 mb8" style="display:block">夏令时 / 冬令时（影响 IT 查询窗口）</div>
          <div class="cfg-row">
            <div class="cfg-item"><label class="field-label">当前时段</label>
              <div class="seg" id="cfgDst">
                <button data-m="auto" class="${cfg.dst === 'auto' ? 'active' : ''}">自动</button>
                <button data-m="summer" class="${cfg.dst === 'summer' ? 'active' : ''}">夏令时</button>
                <button data-m="winter" class="${cfg.dst === 'winter' ? 'active' : ''}">冬令时</button>
              </div>
            </div>
            <div class="cfg-item"><label class="field-label">查询窗口</label>
              <span class="chip">${cfg.dst === 'winter' ? cfg.dstWindow.winter : cfg.dstWindow.summer}（待 IT 确认）</span></div>
            <div class="cfg-item"><label class="field-label">每周起始日</label>
              <span class="chip">周六（固定，第 1 周 = 该年首个周六所在周）</span></div>
          </div>
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
      OPTypeStore.reset();
      store.set('op_week_goals', {});
      store.set('op_dept_scope', OP_DEPT_SCOPE_DEFAULT.map(d => Object.assign({}, d)));
      store.set('op_cfg', {});
      cfg = Object.assign({}, OP_DEFAULTS, {});
      cfg.alarm = Object.assign({}, OP_DEFAULTS.alarm);
      cfg.refresh = Object.assign({}, OP_DEFAULTS.refresh);
      types = OPTypeStore.all(); depts = OPDeptStore.all();
      toast('已恢复默认配置', 'success'); render();
    };

    /* ---- ① PKG Type ---- */
    const ba = document.getElementById('btnTypeAdd');
    if (ba) ba.onclick = () => {
      types = collectTypes();
      const n = types.length;
      types.push({
        id: 'NEWTYPE' + (n + 1), name: '新类型' + (n + 1),
        color: ['#1d4ed8', '#0b6a86', '#8b5cf6', '#a8620b', '#0b8a5a', '#b3261e'][n % 6],
        price: 1, goal: 500,
        yellowK: OP_DEFAULTS.alarm.yellowK, redK: OP_DEFAULTS.alarm.redK,
        enabled: true
      });
      render(); toast('已新增一行，请修改名称与报警阈值后保存', 'primary');
    };
    const bs = document.getElementById('btnTypeSave');
    if (bs) bs.onclick = () => {
      const list = collectTypes();
      const seen = {}, dup = [];
      list.forEach(t => { if (seen[t.id]) dup.push(t.id); seen[t.id] = 1; });
      if (dup.length) { toast('PKG Type 名称重复：' + dup.join('、'), 'danger'); return; }
      if (!list.length) { toast('至少需要一个 PKG Type', 'warn'); return; }
      const badTh = list.filter(t => t.redK <= t.yellowK);
      if (badTh.length) { toast('红灯阈值必须 ≥ 黄灯阈值：' + badTh.map(t => t.id).join('、'), 'danger'); return; }
      types = list; OPTypeStore.save(list);
      toast('PKG Type 已保存（共 ' + list.length + ' 类，阈值逐品类生效）', 'success'); render();
    };
    /* 阈值 / 单价改动后就地重算该行「本周状态」，不必先保存 */
    document.querySelectorAll('#tblTypes tbody tr[data-i]').forEach(tr => {
      tr.querySelectorAll('[data-k="yellowK"], [data-k="redK"]').forEach(el => {
        el.oninput = () => refreshRowAlarm(tr);
        el.onchange = () => refreshRowAlarm(tr);
      });
    });
    document.querySelectorAll('#tblTypes [data-rm]').forEach(b => b.onclick = () => {
      types = collectTypes();
      types.splice(Number(b.dataset.rm), 1);
      render();
    });

    /* ---- ② 每周目标 ---- */
    const gy = document.getElementById('selGY');
    if (gy) gy.onchange = () => { goalYear = Number(gy.value); const n = opWeeksInYear(goalYear); if (goalWeek > n) goalWeek = n; render(); };
    const gw = document.getElementById('selGW');
    if (gw) gw.onchange = () => { goalWeek = Number(gw.value); render(); };
    const bcp = document.getElementById('btnCopyPrev');
    if (bcp) bcp.onclick = () => {
      const p = prevWeek(goalYear, goalWeek);
      const pm = OPGoalStore.of(p.year, p.week);
      const base = pm || (function () { const m = {}; types.forEach(t => m[t.id] = Number(t.goal) || 0); return m; })();
      document.querySelectorAll('#tblGoals [data-g]').forEach(el => { if (base[el.dataset.g] != null) el.value = base[el.dataset.g]; });
      toast('已带入上一周（' + p.year + ' 第 ' + p.week + ' 周）目标，确认后点保存', 'primary');
    };
    const bgs = document.getElementById('btnGoalSave');
    if (bgs) bgs.onclick = () => {
      const map = collectGoals();
      OPGoalStore.set(goalYear, goalWeek, map);
      toast(goalYear + ' 年第 ' + goalWeek + ' 周目标已保存', 'success'); render();
    };
    const bgc = document.getElementById('btnGoalClear');
    if (bgc) bgc.onclick = () => {
      OPGoalStore.remove(goalYear, goalWeek);
      toast('已清除该周配置，将沿用默认周目标', 'success'); render();
    };

    /* ---- ③ 部门 ---- */
    const sdp = document.getElementById('selDeptPreview');
    if (sdp) sdp.onchange = () => { OPDeptStore.setPreviewDept(sdp.value); render(); toast('视角部门已切换：' + sdp.value, 'success'); };
    const bda = document.getElementById('btnDeptAdd');
    if (bda) bda.onclick = () => {
      const el = document.getElementById('selDeptAdd');
      const v = (el && el.value || '').trim();
      if (!v) { toast('请先选择要补齐的部门', 'warn'); return; }
      if (depts.some(d => d.dept === v)) { toast('该部门已存在', 'warn'); return; }
      depts = collectDepts();
      depts.push({ dept: v, types: ['*'], note: '' });
      render(); toast('已补齐部门：' + v, 'success');
    };
    const bdr = document.getElementById('btnDeptReset');
    if (bdr) bdr.onclick = () => {
      OPDeptStore.reset(); depts = OPDeptStore.all();
      toast('已重置为默认三部门（LEAD / NON-LEAD / PLATING）', 'success'); render();
    };
    const bds = document.getElementById('btnDeptSave');
    if (bds) bds.onclick = () => {
      depts = collectDepts(); OPDeptStore.save(depts);
      toast('部门可见范围已保存', 'success'); render();
    };
    document.querySelectorAll('#tblDept [data-drm]').forEach(b => b.onclick = () => {
      depts = collectDepts(); depts.splice(Number(b.dataset.drm), 1); render();
    });
    document.querySelectorAll('#tblDept [data-all]').forEach(b => b.onchange = () => { depts = collectDepts(); render(); });

    /* ---- ④ 报警 / 刷新 / 夏令时 ---- */
    const lk = document.getElementById('lnkToTypes');
    if (lk) lk.onclick = () => { tab = 'types'; render(); toast('报警阈值请在此逐 PKG Type 维护', 'primary'); };

    const bas = document.getElementById('btnAlarmSave');
    if (bas) bas.onclick = () => {
      /* 黄灯 / 红灯阈值已下沉到「① PKG Type 维护」，此处只保存全局比对口径与刷新 / 夏令时 */
      cfg.alarm.mode = document.querySelector('#cfgAlarmMode .active').dataset.m;
      cfg.refresh.mode = document.querySelector('#cfgRefresh .active').dataset.m;
      cfg.refresh.autoSec = Math.max(60, Number(getVal('cfgAutoSec')) || 600);
      cfg.dst = document.querySelector('#cfgDst .active').dataset.m;
      saveCfg(); toast('比对口径 / 刷新 / 夏令时配置已保存', 'success'); render();
    };
    ['cfgAlarmMode', 'cfgRefresh', 'cfgDst'].forEach(id => {
      const box = document.getElementById(id); if (!box) return;
      box.querySelectorAll('button').forEach(b => b.onclick = () => {
        box.querySelectorAll('button').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
      });
    });
  }

  render();
})();
