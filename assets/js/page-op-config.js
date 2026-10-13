/* ============ Output（OP）独立配置页 ============
   四个配置域（原「部门可见范围」与「④ WIP 报警判定配置」均已下线；④ 现为「料号 I/O 维护」），全部写入 localStorage，与大屏 output.html 共用同一份数据：
     ① PKG Type 维护（增删改：名称 / 小分类单价 / 默认周目标 / 报警阈值 / 启用）  → OPTypeStore
        · 报警阈值（黄灯 / 红灯，单位 K）挂在每个 PKG Type 上逐项维护
        · 10-08 客户口径：PKG Type = 大分类，其下还有「小分类 = 封装料号（PackageOutline）」，
          单价细分到料号（types[].subs[].price）；大分类 price 保留为「兜底价」，料号未配价时沿用。
     ② 每周目标数量（按「年份 + 周别」逐 PKG Type 填写本周总目标 K）      → OPGoalStore
     ③ 预警分口径 / 夏令时（口径待客户确认，预留入口）                    → op_cfg
        （原「③ 部门可见范围 → OPDeptStore」已于 2026-10-08 按客户要求整块下线）
        · 预警逻辑分口径（10-08 客户修正）：数量口径沿用「周目标均摊」不变；
          金额（Earn）口径可切换「递进式 ±5%」（周六看上周五实际、周日看周六实际，逐日递进），
          并支持周二拿到准确出库数据后手动修正本周后续几天的 Earn 目标（按周保存）。
     · 夏令时改手动：取消自动切换，默认保持夏令时；切冬令时手动点击；开始时间可指定 6 点 / 7 点。
     ④ 料号 I/O 维护（2026-10-13 新增）                                            → OP_IO_STORE
        · 客户《NONLEAD.xlsx》IO sheet 中 **PKG_CODE（封装代码）与 PKG_I/O 均可自行配置**：
          原始式「实际结果 = PKG_I/O × Unit（实际数量）÷ 255」。
        · 这里维护「OP 产出报表里的料号 ↔ PKG_CODE ↔ PKG_I/O」的对应关系；
          配好后 BGA/LGA 的产出与周目标在大屏 / 周维度累计表统一折算成「标准 I/O 当量」。
   权限：需 Output（OP）模块「编辑」权限；否则整页只读。 */
(function () {
  renderShell('opcfg');

  const canEdit = CurrentUser.can('output', 'edit');
  const cur = opCurrentWeek();

  /* ---------------- 配置域 ③：预警分口径 / 夏令时 ---------------- */
  let cfg = Object.assign({}, OP_DEFAULTS, store.get('op_cfg', {}));
  cfg.alarm = Object.assign({}, OP_DEFAULTS.alarm, cfg.alarm || {});
  cfg.goalMode = Object.assign({}, OP_DEFAULTS.goalMode, cfg.goalMode || {});
  cfg.earnProg = Object.assign({}, OP_DEFAULTS.earnProg, cfg.earnProg || {});
  cfg.earnProg.manual = Object.assign({}, cfg.earnProg.manual || {});
  /* 夏令时改手动（10-08）：旧配置里的 auto 一律迁移为 summer */
  if (cfg.dst !== 'summer' && cfg.dst !== 'winter') cfg.dst = OP_DEFAULTS.dst;
  if (cfg.dstStartHour !== 6 && cfg.dstStartHour !== 7) cfg.dstStartHour = OP_DEFAULTS.dstStartHour;
  const saveCfg = () => store.set('op_cfg', cfg);
  const curGoalMode = () => Object.assign({}, OP_DEFAULTS.goalMode, cfg.goalMode || {});
  const curEarnProg = () => Object.assign({}, OP_DEFAULTS.earnProg, cfg.earnProg || {});

  /* ---------------- 状态 ---------------- */
  let tab = 'types';                       // types | goals | alarm | io
  let types = OPTypeStore.all();           // 工作副本
  let goalYear = cur.year, goalWeek = cur.week;
  let ioType = OP_IO_TYPES[0] || 'BGA/LGA';      // 当前维护 I/O 映射的 PKG Type
  let ioRows = null;                             // 工作副本；null = 从仓库读

  const TABS = [
    { key: 'types', label: '① PKG Type 维护', icon: 'layers' },
    { key: 'goals', label: '② 每周目标数量', icon: 'target' },
    { key: 'alarm', label: '③ 预警分口径 / 夏令时', icon: 'alert' },
    { key: 'io', label: '④ 料号 I/O 维护', icon: 'database' }
  ];

  function render() {
    document.getElementById('content').innerHTML = `
      <div class="notice mt16" style="--nc:var(--primary)">
        ${icon('settings', 19)}
        <div><strong>Output（OP）独立配置页：</strong>PKG Type 维护（含<strong>逐品类的黄灯 / 红灯报警阈值</strong>与<strong>小分类（封装料号）单价</strong>）、<strong>每周 PKG Type 目标数量</strong>、
        预警分口径（数量沿用均摊 / Earn 递进式 ±5%）/ 夏令时（手动）均在此配置，保存后
        <a class="chip chip-link" href="output.html">Output（OP）大屏</a> 即时生效。
        ${canEdit ? '' : '<br><span class="badge b-warn">只读</span> 当前角色无 Output（OP）「编辑」权限，仅可查看配置。'}</div>
      </div>

      <div class="card mt16 no-print">
        <div class="card-head">
          <div class="card-title">${icon('settings', 19)} 配置域
            <span class="card-sub">共 ${TABS.length} 类 · 保存后立即写入本地配置仓库</span></div>
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
    if (tab === 'io') return viewIo();
    return viewAlarm();
  }

  /* =========================================================
     ④ 料号 I/O 维护（BGA/LGA 专有口径：产出 = 颗数 × PKG_I/O ÷ 255）
     ------------------------------------------------------------
     客户《NONLEAD.xlsx》IO sheet 中 **PKG_CODE / PKG_I/O 两个字段均可由客户自行配置**：
     这里维护「OP 产出报表里的料号（12 位） ↔ 客户封装代码 PKG_CODE ↔ 该封装料号的 I/O 数」。
     配置后 Output（OP）大屏 / 周维度累计表里该 PKG Type 的目标与实际会统一折算成
     「标准 I/O 当量」；其它 PKG Type 仍按颗数。
     ========================================================= */
  function ioRowsOf(tid) { return (ioRows && ioType === tid) ? ioRows : OP_IO_STORE.all(tid); }
  function ioPool() { return opIoCandidates(); }
  function ioPoolMap() { const m = {}; ioPool().forEach(c => { if (!m[c.code]) m[c.code] = c.io; }); return m; }
  /* 该品类在真实产出里出现过的料号（作为待配置的 OP 料号清单） */
  function ioSubPool(tid) {
    const fromData = Object.keys(opSubRatios(tid, types));
    const saved = OP_IO_STORE.all(tid).map(x => x.sub);
    return Array.from(new Set(fromData.concat(saved))).sort();
  }
  function collectIo() {
    const tbl = document.getElementById('tblIo');
    if (!tbl) return ioRowsOf(ioType);
    const num = v => { const s = String(v == null ? '' : v).trim(); return (s === '' || !isFinite(Number(s))) ? null : Number(s); };
    return Array.from(tbl.querySelectorAll('tbody tr[data-i]')).map(tr => ({
      sub: tr.querySelector('[data-k="sub"]').value.trim(),
      code: tr.querySelector('[data-k="code"]').value.trim(),
      io: num(tr.querySelector('[data-k="io"]').value)
    })).filter(x => x.sub);
  }
  function viewIo() {
    const tid = ioType;
    const rows = ioRowsOf(tid);
    const pool = ioPool(), poolMap = ioPoolMap();
    const subPool = ioSubPool(tid);
    const types2 = types;
    const fType = opIoFactorOfType(tid, types2);
    const configured = rows.some(r => r.io != null && r.io > 0);
    const missSubs = subPool.filter(s => {
      const r = rows.find(x => x.sub === s);
      return !r || r.io == null || !(r.io > 0);
    });
    const codeList = pool.map(c => `<option value="${esc(c.code)}">`).join('');
    const body = rows.length ? rows.map((r, i) => {
      const f = (r.io == null || !(r.io > 0)) ? null : r.io / OP_IO_BASE;
      const inPool = poolMap[r.code] != null;
      return `<tr data-i="${i}">
        <td><input class="input" data-k="sub" value="${esc(r.sub)}" list="ioSubList" ${canEdit ? '' : 'readonly'} style="min-width:150px" placeholder="产出报表里的料号"></td>
        <td><input class="input" data-k="code" value="${esc(r.code)}" list="ioCodeList" ${canEdit ? '' : 'readonly'} style="min-width:96px" placeholder="封装代码"></td>
        <td class="center"><input class="input num" type="number" min="0" step="1" data-k="io" value="${r.io == null ? '' : r.io}" ${canEdit ? '' : 'readonly'} style="width:96px;text-align:center" placeholder="未配"></td>
        <td class="num">${f == null ? '<span class="muted">按品类系数兜底</span>' : f.toFixed(3)}</td>
        <td class="small muted" data-k="src">${inPool ? '客户 IO 表命中（PKG_I/O = ' + fmtNum(poolMap[r.code]) + '）' : (r.code ? '<span style="color:var(--warn)">不在客户 IO 表候选中</span>' : '—')}</td>
        ${canEdit ? `<td class="center"><button class="btn btn-sm btn-danger" data-iorm="${i}">${icon('trash', 14)}</button></td>` : ''}
      </tr>`;
    }).join('') : `<tr><td colspan="${canEdit ? 6 : 5}" class="center muted">该 PKG Type 尚未配置料号 I/O —— 可点「新增料号」或「从客户 IO 表带入候选」。</td></tr>`;

    return `
      <div class="card">
        <div class="card-head">
          <div class="card-title">${icon('database', 19)} ④ 料号 I/O 维护（BGA/LGA 产出口径）
            <span class="card-sub">客户《NONLEAD.xlsx》IO sheet 中 <b>PKG_CODE</b>（封装代码）与 <b>PKG_I/O</b>（I/O 数）<b>均可自行配置</b>；此处维护「OP 料号 ↔ PKG_CODE ↔ PKG_I/O」的对应关系</span></div>
          <div class="flex acenter gap8 flex-wrap">
            <span class="small muted">PKG Type</span>
            <div class="seg" id="ioSeg">${types.map(t => `<button data-iot="${esc(t.id)}" class="${tid === t.id ? 'active' : ''}">${esc(t.name || t.id)}${opUsesIo(t.id) ? '' : ' · 颗数'}</button>`).join('')}</div>
          </div>
        </div>
        <div class="card-body">
          <div class="notice" style="--nc:${configured ? 'var(--success)' : 'var(--warn)'}">
            ${icon('info', 17)}
            <div>
              <strong>折算公式</strong>：I/O 当量 = <b>颗数 × (PKG_I/O ÷ ${OP_IO_BASE})</b>　　（客户 IO 表原始式：实际结果 = PKG_I/O × Unit ÷ ${OP_IO_BASE}）
              <br><strong>当前 ${esc(tid)}</strong>：${opUsesIo(tid) ? `已配 <b>${rows.filter(r => r.io != null && r.io > 0).length}</b> 个料号，品类加权系数 <b>${fType == null ? '—（未配置，回落 1.0 即等同颗数）' : fType.toFixed(3)}</b>` : '<b>该品类不走 I/O 口径</b>，仍按颗数计量（仅 BGA/LGA 使用 I/O 加权）'}
              ${missSubs.length ? `<br><span style="color:var(--warn)">提示：产出报表里还有 <b>${missSubs.length}</b> 个料号未配 PKG_I/O（${esc(missSubs.slice(0, 6).join('、'))}${missSubs.length > 6 ? ' …' : ''}），未配的按品类加权系数兜底。</span>` : ''}
              ${!configured && opUsesIo(tid) ? '<br><span style="color:var(--danger)"><b>尚未配置任何 PKG_I/O</b>：大屏与累计表当前仍按「颗数」显示，补齐配置后自动切换为 I/O 加权当量。</span>' : ''}
            </div>
          </div>

          <div class="flex acenter gap8 mt12 flex-wrap">
            ${canEdit ? `<button class="btn btn-sm" id="btnIoAdd">${icon('plus', 16)} 新增料号</button>
            <button class="btn btn-sm" id="btnIoSeed">${icon('download', 16)} 从客户 IO 表带入候选（${pool.length} 条）</button>
            <button class="btn btn-sm btn-primary" id="btnIoSave">${icon('check', 16)} 保存</button>
            <button class="btn btn-sm" id="btnIoReset">${icon('refresh', 16)} 恢复默认（清空该品类）</button>` : '<span class="chip">只读</span>'}
            <button class="btn btn-sm" id="btnIoExport">${icon('download', 16)} Excel 导出</button>
            <span class="flex-1"></span>
            <span class="small muted">候选库：客户 IO 表 ${pool.length} 条（BGA / LGA 合计），输入 PKG_CODE 时会自动带出 PKG_I/O</span>
          </div>

          <datalist id="ioCodeList">${codeList}</datalist>
          <datalist id="ioSubList">${subPool.map(s => `<option value="${esc(s)}">`).join('')}</datalist>

          <div class="table-wrap mt10">
            <table class="table" id="tblIo">
              <thead><tr>
                <th>OP 料号（产出报表）</th><th>PKG_CODE（封装代码）</th><th class="center">PKG_I/O</th>
                <th class="num">折算系数 I/O ÷ ${OP_IO_BASE}</th><th>数据来源校验</th>${canEdit ? '<th class="center">操作</th>' : ''}
              </tr></thead>
              <tbody>${body}</tbody>
            </table>
          </div>
          <div class="sub-note mt8">
            · <b>OP 料号</b>：产出报表（BE1 Output Report）里的 12 位料号，可从下拉候选里选，也可手工输入；共 ${subPool.length} 个料号在本品类的产出中出现。
            · <b>PKG_CODE / PKG_I/O</b>：客户《NONLEAD.xlsx》IO sheet 的两个可配置字段；填入客户表里的 PKG_CODE 后，<b>PKG_I/O 会自动带出</b>，也可手工覆盖。
            · <b>折算系数</b> = PKG_I/O ÷ ${OP_IO_BASE}，作用于该料号的产出数量；<b>周目标</b>同步按「料号产出结构 × 各料号系数」的加权系数折算，保证实际与目标同量纲可比。
            · 留空 PKG_I/O 的料号按<b>品类加权系数</b>兜底（不丢量）；一个料号都没配时整体回落 1.0（等同颗数口径）。
          </div>
        </div>
      </div>`;
  }

  function fmtNum(v) { return (v == null ? '—' : Math.round(v).toLocaleString()); }

  /* =========================================================
     ① PKG Type 维护
     ========================================================= */
  function viewTypes() {
    return `
      <div class="card">
        <div class="card-head">
            <div class="card-title">${icon('layers', 19)} PKG Type 维护（大分类）
              <span class="card-sub">客户后台可增删改 · 默认周目标用于未单独配置周别的场景 · <strong>报警阈值逐品类维护</strong> · <strong>单价可细分到小分类（封装料号）</strong></span></div>
          <div class="flex acenter gap8">
            ${canEdit ? `<button class="btn btn-sm" id="btnTypeAdd">${icon('plus', 16)} 新增 PKG Type</button>
            <button class="btn btn-sm btn-primary" id="btnTypeSave">${icon('check', 16)} 保存</button>` : '<span class="chip">只读</span>'}
          </div>
        </div>
        <div class="card-body">
          <table class="table" id="tblTypes">
            <thead><tr>
              <th>PKG Type（唯一标识）<div class="small muted" style="font-weight:400">大分类</div></th><th>显示名</th>
              <th class="center">小分类（封装料号）<div class="small muted" style="font-weight:400">各自单价 · 点「管理」维护</div></th>
              <th class="center">默认周目标 [K]</th>
              <th class="center" style="width:120px">黄灯阈值 [K]<div class="small muted" style="font-weight:400">缺口 ≥ 此值报警</div></th>
              <th class="center" style="width:120px">红灯阈值 [K]<div class="small muted" style="font-weight:400">缺口 ≥ 此值报警</div></th>
              <th class="center">启用</th><th class="center">本周状态</th>${canEdit ? '<th class="center">操作</th>' : ''}
            </tr></thead>
            <tbody>${typeRows()}</tbody>
          </table>
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
      const sl = opSubsOf(t.id, types);
      const priced = sl.filter(s => s.price != null).length;
      return `<tr data-i="${i}">
        <td><input class="input" data-k="id" value="${esc(t.id)}" ${canEdit ? '' : 'readonly'} style="min-width:110px"></td>
        <td><input class="input" data-k="name" value="${esc(t.name || t.id)}" ${canEdit ? '' : 'readonly'} style="min-width:110px"></td>
        <td class="center">
          ${sl.length
            ? `<div class="flex acenter gap6" style="justify-content:center">
                 <span class="chip">${sl.length} 个料号</span>
                 <span class="small ${priced ? 'ok' : 'muted'}">已配价 ${priced}</span>
               </div>
               ${canEdit ? `<button class="btn btn-sm mt6" data-sub="${i}">${icon('settings', 14)} 管理单价</button>` : ''}`
            : `<span class="small muted">—</span>
               ${canEdit ? `<button class="btn btn-sm mt6" data-sub="${i}">${icon('plus', 14)} 添加料号</button>` : ''}`}
        </td>
        <td class="center"><input class="input num" type="number" step="50" min="0" data-k="goal" value="${t.goal == null ? 0 : t.goal}" ${canEdit ? '' : 'readonly'} style="width:110px;text-align:center"></td>
        <td class="center"><input class="input num t-th${thCls(y, r)}" type="number" step="0.5" min="0" data-k="yellowK" value="${y}" ${canEdit ? '' : 'readonly'} style="width:90px;text-align:center" title="缺口 ≥ ${y}K 时黄灯报警"></td>
        <td class="center"><input class="input num t-th${thCls(y, r)}" type="number" step="1" min="0" data-k="redK" value="${r}" ${canEdit ? '' : 'readonly'} style="width:90px;text-align:center" title="缺口 ≥ ${r}K 时红灯报警"></td>
        <td class="center"><input type="checkbox" data-k="enabled" ${t.enabled !== false ? 'checked' : ''} ${canEdit ? '' : 'disabled'}></td>
        <td class="center" data-role="alarm">${alarmBadge(a)}</td>
        ${canEdit ? `<td class="center"><button class="btn btn-sm btn-danger" data-rm="${i}">${icon('trash', 14)}</button></td>` : ''}
      </tr>`;
    }).join('') || `<tr><td colspan="${canEdit ? 9 : 8}" class="center muted">暂无 PKG Type，请点击「新增 PKG Type」</td></tr>`;
  }

  /* =========================================================
     ① 补 小分类（封装料号）单价维护弹窗 · 2026-10-08
     料号清单 = 配置页手工维护 ∪ 真实产出数据中出现过的料号（opSubsOf 已合并）。
     单价留空 = 沿用大分类兜底价；Earn 金额按料号粒度折算。
     ========================================================= */
  function openSubDlg(i) {
    const t = types[i]; if (!t) return;
    const list = opSubsOf(t.id, types);
    const mix = opRealSubMix(t.id);
    const totMix = Object.keys(mix).reduce((a, k) => a + (Number(mix[k]) || 0), 0);
    const base = OP_EARN_PRICE[t.id] != null ? OP_EARN_PRICE[t.id] : 1.0;  // 系统默认单价（大分类不再维护兜底单价字段）

    const rowHtml = s => {
      const share = (mix[s.id] != null && totMix > 0) ? (Number(mix[s.id]) / totMix * 100) : null;
      return `<tr data-s="${esc(s.id)}">
        <td><input class="input" data-k="sid" value="${esc(s.id)}" style="min-width:140px"></td>
        <td class="center">${share == null ? '<span class="small muted">—</span>' : '<span class="small">' + share.toFixed(1) + '%</span>'}</td>
        <td class="center"><input class="input num" type="number" step="0.01" min="0" data-k="sprice"
             value="${s.price == null ? '' : s.price}" placeholder="留空=${base}" style="width:110px;text-align:center"></td>
        <td class="center"><span class="small ${s.price == null ? 'muted' : 'ok'}">${s.price == null ? '兜底 ' + base : '料号价 ' + s.price}</span></td>
        <td class="center"><button class="btn btn-sm btn-danger" data-srm="${esc(s.id)}">${icon('trash', 14)}</button></td>
      </tr>`;
    };

    openDialog({
      title: '小分类（封装料号）单价 · ' + esc(t.name || t.id),
      sub: 'PKG Type「' + esc(t.id) + '」为<strong>大分类</strong>；下面每个<strong>封装料号</strong>可配各自的单价，留空则沿用本品类<strong>系统默认单价 ' + base + ' 元/粒</strong>',
      width: 720,
      okText: '确定',
      body: `
        <div class="cfg-note mb12">${icon('alert', 15)}
          料号来自客户报表 <code>PackageOutline</code> 列。「占比」为该料号在真实产出数据中的数量占比，仅作参考；
          <strong>未维护料号单价时，Earn 金额按本品类系统默认单价折算，数值不会失真。</strong></div>
        <table class="table" id="tblSubs">
          <thead><tr>
            <th>封装料号（小分类）</th><th class="center">产出占比<div class="small muted" style="font-weight:400">真实数据</div></th>
            <th class="center">单价（元/粒）</th><th class="center">生效价</th><th class="center">操作</th>
          </tr></thead>
          <tbody>${list.map(rowHtml).join('') ||
            '<tr><td colspan="5" class="center muted">暂无料号，点「新增料号」手工添加</td></tr>'}</tbody>
        </table>
        <div class="flex acenter gap8 mt12">
          <button class="btn btn-sm" id="btnSubAdd">${icon('plus', 16)} 新增料号</button>
          <button class="btn btn-sm" id="btnSubFill">${icon('refresh', 16)} 全部填充为系统默认单价 ${base}</button>
          <button class="btn btn-sm" id="btnSubClear">${icon('close', 16)} 清空单价（全部回落兜底）</button>
        </div>`,
      onOk: () => {
        const rows = document.querySelectorAll('#tblSubs tbody tr[data-s]');
        const out = [], seen = {};
        rows.forEach(r => {
          const idEl = r.querySelector('[data-k="sid"]'), pEl = r.querySelector('[data-k="sprice"]');
          const id = String((idEl && idEl.value) || '').trim();
          if (!id || seen[id]) return;
          seen[id] = 1;
          const raw = pEl ? String(pEl.value).trim() : '';
          const n = Number(raw);
          out.push({ id, price: (raw === '' || !isFinite(n)) ? null : n });
        });
        t.subs = out;
        render();
        toast('已保存 ' + out.length + ' 个料号（' + out.filter(s => s.price != null).length + ' 个已配单价）', 'success');
      }
    });

    /* 弹窗内交互 */
    const tb = () => document.querySelector('#tblSubs tbody');
    const bindRow = tr => {
      const rm = tr.querySelector('[data-srm]');
      if (rm) rm.onclick = () => { tr.remove(); const b = tb(); if (b && !b.querySelector('tr[data-s]')) b.innerHTML = '<tr><td colspan="5" class="center muted">暂无料号，点「新增料号」手工添加</td></tr>'; };
    };
    document.querySelectorAll('#tblSubs tbody tr[data-s]').forEach(bindRow);
    const bAdd = document.getElementById('btnSubAdd');
    if (bAdd) bAdd.onclick = () => {
      const b = tb(); if (!b) return;
      const empty = b.querySelector('tr:not([data-s])'); if (empty) empty.remove();
      const tr = document.createElement('tr');
      tr.setAttribute('data-s', '');
      tr.innerHTML = `<td><input class="input" data-k="sid" value="" placeholder="如 98ASA00855D" style="min-width:140px"></td>
        <td class="center"><span class="small muted">—</span></td>
        <td class="center"><input class="input num" type="number" step="0.01" min="0" data-k="sprice" value="" placeholder="留空=${base}" style="width:110px;text-align:center"></td>
        <td class="center"><span class="small muted">—</span></td>
        <td class="center"><button class="btn btn-sm btn-danger" data-srm="">${icon('trash', 14)}</button></td>`;
      b.appendChild(tr); bindRow(tr); tr.querySelector('[data-k="sid"]').focus();
    };
    const bFill = document.getElementById('btnSubFill');
    if (bFill) bFill.onclick = () => {
      document.querySelectorAll('#tblSubs [data-k="sprice"]').forEach(el => { el.value = base; });
      toast('已全部填充为系统默认单价 ' + base + '，可再逐个修改', 'primary');
    };
    const bClear = document.getElementById('btnSubClear');
    if (bClear) bClear.onclick = () => {
      document.querySelectorAll('#tblSubs [data-k="sprice"]').forEach(el => { el.value = ''; });
      toast('已清空料号单价，全部回落系统默认单价', 'primary');
    };
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
        subs: Array.isArray(prev.subs) ? prev.subs.map(s => ({ id: s.id, price: s.price == null ? null : Number(s.price) })) : [],   // 小分类（料号）单价
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

  /* Earn 目标手动修正：7 天（万元），空 = null（按规则自动）
     10-08 客户要求：整表不再「填完点保存」一次收走 —— 改由每格右侧的「生效」按钮逐日写入，
     点了哪天就哪天生效，后续日期的基准 / 区间 / 判定立即按递进链重算。 */
  function earnManOf(key) {
    cfg.earnProg = Object.assign({}, OP_DEFAULTS.earnProg, cfg.earnProg || {});
    cfg.earnProg.manual = Object.assign({}, cfg.earnProg.manual || {});
    const arr = (cfg.earnProg.manual[key] || []).slice();
    while (arr.length < 7) arr.push(null);
    return arr;
  }
  /* 点「生效」：读该格输入 → 写入配置 → 落盘 → 整表重算 */
  function applyEarnMan(i) {
    if (!canEdit) return;
    const el = document.querySelector('#tblEarnMan [data-em="' + i + '"]');
    if (!el) return;
    const v = String(el.value || '').trim();
    const num = (v === '' || !isFinite(Number(v))) ? null : Math.max(0, Number(v));
    const key = opWeekKey(goalYear, goalWeek);
    const arr = earnManOf(key);
    arr[i] = num;
    cfg.earnProg.manual[key] = arr;
    saveCfg();
    const wdn = ['六', '日', '一', '二', '三', '四', '五'][i];
    toast(num == null
      ? `周${wdn} 已恢复自动（清除手动修正值），后续日期基准已重算`
      : `周${wdn} 修正值 ${num} 万已生效，后续日期基准已按递进链重算`, 'success');
    render();
  }
  /* 输入框改动后：把该日按钮从「已生效」切回高亮的「生效」，提示需要再点一次 */
  function markEarnManDraft(el) {
    const i = Number(el.dataset.em);
    const btn = document.querySelector('#tblEarnMan [data-emok="' + i + '"]');
    if (!btn || btn.disabled) return;
    const v = String(el.value || '').trim();
    const cur = (v === '' || !isFinite(Number(v))) ? null : Number(v);
    const eff = Number(btn.dataset.eff === '' ? NaN : btn.dataset.eff);
    const effV = isFinite(eff) ? eff : null;
    const dirty = String(cur) !== String(effV);
    btn.classList.toggle('btn-primary', dirty);
    btn.textContent = dirty ? '生效' : (effV == null ? '生效' : '已生效');
  }

  /* =========================================================
     ③ 预警分口径 / 夏令时
     （原「③ 部门可见范围」已按 2026-10-08 客户要求整块下线：
       部门固定为 LEAD / NON-LEAD / PLATING，可见范围沿用引擎内置默认，
       大屏的「视角部门」下拉仅用于切换统计视角，不再提供配置入口。）
     ========================================================= */
  function viewAlarm() {
    const gm = curGoalMode(), ep = curEarnProg();
    return `
      <div class="card">
        <div class="card-head">
          <div class="card-title">${icon('alert', 19)} 预警分口径 / 夏令时
            <span class="card-sub">报警阈值已在「① PKG Type 维护」逐品类维护 · 这里只留预警分口径与 Earn 目标基准</span></div>
          <div class="flex acenter gap8">
            ${canEdit ? `<button class="btn btn-sm btn-primary" id="btnAlarmSave">${icon('check', 16)} 保存</button>` : '<span class="chip">只读</span>'}
          </div>
        </div>
        <div class="card-body">
          <div class="cfg-row">
            <div class="cfg-item">
              <label class="field-label">金额口径 · 累计 Earn 目标 vs 实际（万元）</label>
              <div class="seg" id="cfgEarnMode">
                <button data-m="even" class="${gm.earn === 'even' ? 'active' : ''}">周目标均摊</button>
                <button data-m="progressive" class="${gm.earn === 'progressive' ? 'active' : ''}">递进式 ±${ep.pct}%</button>
              </div>
              <div class="small muted mt8">递进式：<strong>周六</strong>看<strong>上周五实际值</strong> ±${ep.pct}% 为正常区间；<strong>周日</strong>看<strong>周六实际值</strong> ±${ep.pct}%；逐日递进。解决周末数据滞后导致的监控盲区。</div>
            </div>
          </div>
          <div class="cfg-row mt8">
            <div class="cfg-item"><label class="field-label">递进容差 ±%</label>
              <input class="input" type="number" id="cfgEarnPct" value="${ep.pct}" min="0" max="50" step="0.5" style="width:96px" ${canEdit ? '' : 'readonly'}>
              <div class="small muted mt8">当日实际超出基准 ±${ep.pct}% → 黄灯</div></div>
            <div class="cfg-item"><label class="field-label">红灯倍数（× 容差）</label>
              <input class="input" type="number" id="cfgEarnRedX" value="${ep.redX}" min="1" max="5" step="0.5" style="width:96px" ${canEdit ? '' : 'readonly'}>
              <div class="small muted mt8">超出 ±${(ep.pct * ep.redX).toFixed(1)}% → 红灯</div></div>
            <div class="cfg-item"><label class="field-label">递进基准</label>
              <span class="chip">${icon('trend', 14)} 前一日当日实际（周六 = 上周五当日实际）</span>
              <div class="small muted mt8">无前值可依时回落「周目标均摊」的当日增量，保证目标线不断。</div></div>
          </div>
          <div class="cfg-note mt12">${icon('alert', 15)} 两个口径<strong>互不影响</strong>：切换 Earn 口径只改金额目标基准，不动数量目标与黄 / 红阈值。
            累计 Earn 目标线 = 各日递进基准的逐日累加（相当于实际线右移一天）；预警判定用<strong>当日</strong> Earn 与基准的偏差。</div>

          <div class="field-label mt16 mb8" style="display:block">Earn 目标手动修正（周二下午拿到准确出库数据后修正后续几天）</div>
          <div class="flex acenter gap8 mb8">
            <span class="chip">${icon('calendar', 14)} 修正周：${goalYear} 年第 ${goalWeek} 周（${fmtRange(goalYear, goalWeek)}）</span>
            <span class="sub-note">周二下午拿到准确出库数据后，在此修正<strong>周三 ~ 周五</strong>的目标。留空 = 按上面规则自动递进；填写即覆盖该天目标（万元）。周别在「② 每周目标数量」切换。</span>
          </div>
          ${earnManualTable()}

          <div class="field-label mt16 mb8" style="display:block">夏令时 / 冬令时（手动切换 · 影响 IT 查询窗口）</div>
          <div class="cfg-row">
            <div class="cfg-item"><label class="field-label">当前时段</label>
              <div class="seg" id="cfgDst">
                <button data-m="summer" class="${cfg.dst === 'winter' ? '' : 'active'}">夏令时（默认）</button>
                <button data-m="winter" class="${cfg.dst === 'winter' ? 'active' : ''}">冬令时</button>
              </div>
              <div class="small muted mt8">10-08 修正：<strong>已取消自动切换</strong>，默认保持夏令时；切冬令时需在此手动点击（旧配置中的「自动」已迁移为夏令时）。</div>
            </div>
            <div class="cfg-item"><label class="field-label">查询窗口开始时间</label>
              <div class="seg" id="cfgDstHour">
                <button data-m="6" class="${cfg.dstStartHour === 7 ? '' : 'active'}">06:00</button>
                <button data-m="7" class="${cfg.dstStartHour === 7 ? 'active' : ''}">07:00</button>
              </div>
              <div class="small muted mt8">手动指定开始时间（6 点 / 7 点）。</div>
            </div>
            <div class="cfg-item"><label class="field-label">查询窗口</label>
              <span class="chip">${opDstWindow(cfg).text}（待 IT 确认）</span></div>
            <div class="cfg-item"><label class="field-label">每周起始日</label>
              <span class="chip">周六（固定，第 1 周 = 该年首个周六所在周）</span></div>
          </div>
        </div>
      </div>`;
  }

  /* Earn 目标手动修正表（按周）：7 天各一个输入框（万元），并预览生效基准 / 正常区间 / 当日实际 / 判定 */
  function earnManualTable() {
    const key = opWeekKey(goalYear, goalWeek);
    const ep = curEarnProg();
    const man = (ep.manual && ep.manual[key]) || [];
    const w = genOpWeek(goalYear, goalWeek);
    const ids = types.filter(t => t.enabled !== false).map(t => t.id);
    const ev = opEarnSeriesCfg(ids, w, types, cfg);
    /* 未手动修正时的自动基准（用于对照） */
    const autoCfg = Object.assign({}, cfg, { earnProg: Object.assign({}, ep, { manual: Object.assign({}, ep.manual, { [key]: [] }) }) });
    const auto = opEarnSeriesCfg(ids, w, types, autoCfg);
    const isProg = ev.mode === 'progressive';
    /* 均摊口径下没有 base / band / prog，退化为「均摊当日增量」展示 */
    const dailyOf = cum => { const o = []; let a = 0; for (let i = 0; i < 7; i++) { o.push(+(cum[i] - a).toFixed(1)); a = cum[i]; } return o; };
    const baseOf = e => (e.base || dailyOf(e.goalCum));
    const wd = ['六', '日', '一', '二', '三', '四', '五'];
    const srcTxt = { manual: '手动修正', prevManual: '前一日修正值', prevDay: '前一日实际', prevWeekFri: '上周五实际', even: '均摊兜底' };
    const idx = [0, 1, 2, 3, 4, 5, 6];
    const row = (label, fn) => `<tr><td class="muted small" style="white-space:nowrap">${label}</td>${idx.map(i => `<td class="center small">${fn(i)}</td>`).join('')}</tr>`;
    /* 「生效」按钮（10-08 客户要求）：点当日按钮才把该日修正值写进配置，
       后面日期的「生效基准 / 正常区间 / 判定」即时按递进链重算；
       已过去的日期（早于今天）不可再修正 → 按钮禁用；均摊口径下 manual 不生效 → 一并禁用。 */
    const effOf = i => { const v = man[i]; return (v == null || v === '' || !isFinite(Number(v))) ? null : Number(v); };
    const pastOf = i => !w.days[i].isFuture && !w.days[i].isToday;      // 已过去 = 早于今天
    const okDisabled = i => !canEdit || !isProg || pastOf(i);
    const dayTag = i => w.days[i].isToday ? '今天' : (w.days[i].isFuture ? '未来' : '已过去');
    const badgeOf = p => {
      if (!p || p.status === 'none') return '<span class="badge b-neutral">—</span>';
      const i = opStatusInfo(p.status);
      return `<span class="badge ${i.badge}">${i.label}${p.dev == null ? '' : ' ' + (p.dev >= 0 ? '+' : '') + p.dev + '%'}</span>`;
    };
    return `
      <table class="table" id="tblEarnMan">
        <thead><tr><th style="width:120px">日</th>${idx.map(i => `<th class="center">${wd[i]}<div class="small muted" style="font-weight:400">${w.days[i].label} · ${dayTag(i)}</div></th>`).join('')}</tr></thead>
        <tbody>
          ${row('手动修正 [万]', i => `<div class="em-cell">
              <input class="input num" type="number" step="0.1" min="0" data-em="${i}" value="${effOf(i) == null ? '' : effOf(i)}" ${(canEdit && !okDisabled(i)) ? '' : 'readonly'} style="width:78px;text-align:center" placeholder="自动">
              <button class="btn btn-sm em-ok ${effOf(i) == null ? 'btn-primary' : 'btn-green'}" data-emok="${i}" data-eff="${effOf(i) == null ? '' : effOf(i)}" ${okDisabled(i) ? 'disabled' : ''} title="${pastOf(i) ? '该日已过去，不可再修正' : (isProg ? '点此让该日修正值生效，后续日期基准随之重算' : '仅「递进式」口径下可修正')}">${effOf(i) == null ? '生效' : '已生效'}</button>
            </div>`)}
          ${row('生效基准 [万]', i => `${baseOf(ev)[i]}<div class="small muted">${isProg ? (srcTxt[ev.src[i]] || '') : '周目标均摊'}</div>`)}
          ${row('正常区间 ±' + ep.pct + '%', i => (isProg ? `${ev.band[i][0]} ~ ${ev.band[i][1]}` : '<span class="muted">—</span>'))}
          ${row('当日实际 [万]', i => (ev.dailyActual[i] == null ? '—' : ev.dailyActual[i]))}
          ${row('判定', i => (isProg ? badgeOf(ev.prog[i]) : '<span class="muted">按差额阈值</span>'))}
          ${row('自动基准（对照）', i => (isProg ? (auto.base[i] == null ? '—' : auto.base[i]) : baseOf(auto)[i]))}
        </tbody>
      </table>
      <div class="cfg-note mt12">${icon('alert', 15)} ${isProg
        ? `「生效基准」为当前配置下的实际取值：填了手动值即覆盖当天基准；<strong>且该修正值会顺着递进链往后传一天</strong>——下一天的基准直接沿用这个修正值（不再取前一日实际）。其余按递进规则（周六=上周五实际 / 次日=前一日实际）自动取，无前值时回落均摊增量。
           判定用<strong>当日 Earn</strong> 与基准的偏差：±${ep.pct}% 内正常、超出 ${ep.pct}% → 黄灯、超出 ${(ep.pct * ep.redX).toFixed(1)}% → 红灯。`
        : `当前 Earn 口径为<strong>周目标均摊</strong>，基准 = 周总目标 ÷ 7 的当日增量；手动修正与 ±${ep.pct}% 判定仅在「递进式」口径下生效（切到递进式后填写）。`}</div>
      <div class="cfg-note mt8">${icon('check', 15)} <strong>修正值需点当日「生效」按钮才写入</strong>（10-08 客户要求）：
        填完数值 → 点「生效」→ 该日修正值立即入库，<strong>后续日期的「生效基准 / 正常区间 / 判定」随之重算</strong>（递进链：下一天基准直接沿用该修正值，再往后回到前一日实际）；
        按钮显示「已生效」表示该日已有修正值，改动后按钮转为高亮的「生效」待点击。
        <strong>已过去的日期（早于今天）按钮禁用</strong>，历史周整周不可修正；周二下午拿到准确出库数据后修正周三 ~ 周五。</div>`;
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
      OPDeptStore.reset();          // 部门可见范围无配置入口了，恢复默认时一并清掉历史残留
      store.set('op_io_map', {});    // 料号 I/O 映射一并清空
      store.set('op_cfg', {});
      cfg = Object.assign({}, OP_DEFAULTS, {});
      cfg.alarm = Object.assign({}, OP_DEFAULTS.alarm);
      cfg.goalMode = Object.assign({}, OP_DEFAULTS.goalMode);
      cfg.earnProg = Object.assign({}, OP_DEFAULTS.earnProg, { manual: {} });
      cfg.dst = OP_DEFAULTS.dst;                 // 夏令时（手动，默认）
      cfg.dstStartHour = OP_DEFAULTS.dstStartHour;
      cfg.wipOverlay = Object.assign({}, OP_DEFAULTS.wipOverlay);   // WIP 参与报警判定
      types = OPTypeStore.all();
      ioRows = null;
      toast('已恢复默认配置', 'success'); render();
    };

    /* ---- ④ 料号 I/O 维护（BGA/LGA 口径） ---- */
    const ioSeg = document.getElementById('ioSeg');
    if (ioSeg) ioSeg.querySelectorAll('button').forEach(b => {
      b.onclick = () => { ioRows = null; ioType = b.dataset.iot; render(); };
    });
    const ba1 = document.getElementById('btnIoAdd');
    if (ba1) ba1.onclick = () => {
      ioRows = collectIo().concat([{ sub: '', code: '', io: null }]);
      render(); toast('已新增一行：填入 OP 料号 + PKG_CODE（PKG_I/O 会自动带出）后保存', 'primary');
    };
    const bs1 = document.getElementById('btnIoSave');
    if (bs1) bs1.onclick = () => {
      const list = collectIo();
      const seen = {}, dup = [];
      list.forEach(x => { if (seen[x.sub]) dup.push(x.sub); seen[x.sub] = 1; });
      if (dup.length) { toast('OP 料号重复：' + dup.join('、'), 'danger'); return; }
      ioRows = list; OP_IO_STORE.save(ioType, list);
      const f = opIoFactorOfType(ioType, types);
      toast('料号 I/O 已保存（' + list.length + ' 行 · 品类加权系数 ' + (f == null ? '未配置' : f.toFixed(3)) + '），大屏即时生效', 'success');
      render();
    };
    const br1 = document.getElementById('btnIoReset');
    if (br1) br1.onclick = () => {
      OP_IO_STORE.reset(ioType); ioRows = null;
      toast('已清空 ' + ioType + ' 的料号 I/O 配置', 'success'); render();
    };
    const bg1 = document.getElementById('btnIoSeed');
    if (bg1) bg1.onclick = () => {
      const cur = collectIo();
      const has = {}; cur.forEach(x => { has[x.code] = 1; });
      const add = ioPool().filter(c => !has[c.code]).map(c => ({ sub: '', code: c.code, io: c.io }));
      if (!add.length) { toast('客户 IO 表候选已全部带入', 'warn'); return; }
      ioRows = cur.concat(add);
      render();
      toast('已带入客户 IO 表 ' + add.length + ' 条候选（OP 料号留空，请在左侧填入对应料号后保存）', 'primary');
    };
    const be1 = document.getElementById('btnIoExport');
    if (be1) be1.onclick = () => {
      const list = collectIo();
      exportExcel('OP_料号I_O映射_' + ioType + '.xls',
        ['OP 料号', 'PKG_CODE', 'PKG_I/O', '折算系数 I/O÷' + OP_IO_BASE, '数据来源校验'],
        list.map(x => [x.sub, x.code, x.io == null ? '' : x.io,
          (x.io == null || !(x.io > 0)) ? '' : (x.io / OP_IO_BASE).toFixed(3),
          ioPoolMap()[x.code] != null ? '客户 IO 表命中' : (x.code ? '不在客户 IO 表候选中' : '')]));
      toast('已导出 ' + list.length + ' 行', 'success');
    };
    document.querySelectorAll('#tblIo [data-iorm]').forEach(b => b.onclick = () => {
      const list = collectIo();
      list.splice(Number(b.dataset.iorm), 1);
      ioRows = list; render();
    });
    /* 输入 PKG_CODE 时自动带出客户 IO 表里的 PKG_I/O（仅在 PKG_I/O 为空时带出，不覆盖手工值） */
    document.querySelectorAll('#tblIo [data-k="code"]').forEach(el => {
      el.onchange = () => {
        const v = el.value.trim();
        const tr = el.closest('tr');
        const ioEl = tr && tr.querySelector('[data-k="io"]');
        const fcEl = tr && tr.querySelector('td:nth-child(4)');
        const srcEl = tr && tr.querySelector('[data-k="src"]');
        const c = v ? ioPool().find(x => x.code === v) : null;
        if (ioEl && c && ioEl.value === '') {
          ioEl.value = c.io;
          if (fcEl) fcEl.textContent = (c.io / OP_IO_BASE).toFixed(3);
          toast('已按客户 IO 表带出 PKG_I/O = ' + c.io, 'primary');
        }
        if (srcEl) srcEl.innerHTML = !v ? '—'
          : (c ? '客户 IO 表命中（PKG_I/O = ' + fmtNum(c.io) + '）' : '<span style="color:var(--warn)">不在客户 IO 表候选中</span>');
      };
    });

    /* ---- ① PKG Type ---- */
    const ba = document.getElementById('btnTypeAdd');
    if (ba) ba.onclick = () => {
      types = collectTypes();
      const n = types.length;
      types.push({
        id: 'NEWTYPE' + (n + 1), name: '新类型' + (n + 1),
        color: ['#1d4ed8', '#0b6a86', '#8b5cf6', '#a8620b', '#0b8a5a', '#b3261e'][n % 6],
        subs: [],
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
    /* 小分类（封装料号）单价维护：先把表格当前值收进工作副本，再开弹窗 */
    document.querySelectorAll('#tblTypes [data-sub]').forEach(b => b.onclick = () => {
      types = collectTypes();
      openSubDlg(Number(b.dataset.sub));
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

    /* ---- ③ 预警分口径 / 夏令时 ---- */
    const bas = document.getElementById('btnAlarmSave');
    if (bas) bas.onclick = () => {
      /* 黄灯 / 红灯阈值与异常判定口径已下沉到「① PKG Type 维护」，此处只保存预警分口径与夏令时
         （数据刷新机制、异常判定口径均按 2026-10-08 客户要求下线） */
      /* 预警逻辑分口径（10-08）：数量口径固定均摊；金额口径可切递进式 */
      cfg.goalMode = Object.assign({}, OP_DEFAULTS.goalMode, cfg.goalMode || {});
      cfg.goalMode.qty = 'even';
      cfg.goalMode.earn = document.querySelector('#cfgEarnMode .active').dataset.m;
      cfg.earnProg = Object.assign({}, OP_DEFAULTS.earnProg, cfg.earnProg || {});
      cfg.earnProg.manual = Object.assign({}, cfg.earnProg.manual || {});
      const pctN = Number(getVal('cfgEarnPct')); const redN = Number(getVal('cfgEarnRedX'));
      cfg.earnProg.pct = isFinite(pctN) ? Math.min(50, Math.max(0, pctN)) : OP_DEFAULTS.earnProg.pct;
      cfg.earnProg.redX = isFinite(redN) ? Math.min(5, Math.max(1, redN)) : OP_DEFAULTS.earnProg.redX;
      cfg.earnProg.anchor = 'prevDay';
      /* 手动修正值不再由「保存」整表收走（10-08 客户要求）：
         逐日点「生效」按钮时才写入，故这里保留已生效的 manual 不动 */
      cfg.earnProg.manual = Object.assign({}, cfg.earnProg.manual || {});
      /* 夏令时改手动：只有 夏令时 / 冬令时，开始时间 6 或 7 点 */
      cfg.dst = document.querySelector('#cfgDst .active').dataset.m === 'winter' ? 'winter' : 'summer';
      cfg.dstManual = true;
      cfg.dstStartHour = document.querySelector('#cfgDstHour .active').dataset.m === '7' ? 7 : 6;
      saveCfg(); toast('预警分口径 / 夏令时配置已保存', 'success'); render();
    };
    ['cfgDst', 'cfgEarnMode', 'cfgDstHour'].forEach(id => {
      const box = document.getElementById(id); if (!box) return;
      box.querySelectorAll('button').forEach(b => b.onclick = () => {
        box.querySelectorAll('button').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
      });
    });

    /* ---- ③ Earn 手动修正：逐日「生效」按钮 ---- */
    document.querySelectorAll('#tblEarnMan [data-emok]').forEach(b => {
      b.onclick = () => applyEarnMan(Number(b.dataset.emok));
    });
    document.querySelectorAll('#tblEarnMan [data-em]').forEach(el => {
      el.oninput = () => markEarnManDraft(el);
      el.onchange = () => markEarnManDraft(el);
    });

  }

  render();
})();
