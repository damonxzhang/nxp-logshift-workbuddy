/* ============ OP 专属大屏：Output（OP）每日追踪 + 工序机台明细 ============ */
(function () {
  renderShell('op');

  const canExport = CurrentUser.can('output', 'export');
  let week = OP_WEEK;                 // 可随配置重算
  let stepOut = OP_STEP_OUTPUT;
  const cfg = Object.assign({}, OP_DEFAULTS, store.get('op_cfg', {}));
  // 合并 alarm / refresh 子对象
  cfg.alarm = Object.assign({}, OP_DEFAULTS.alarm, cfg.alarm || {});
  cfg.refresh = Object.assign({}, OP_DEFAULTS.refresh, cfg.refresh || {});
  cfg.weeklyGo = Object.assign({}, OP_DEFAULTS.weeklyGo, cfg.weeklyGo || {});
  const save = () => store.set('op_cfg', cfg);

  let tab = 'lvl1';                  // lvl1 一级界面 / lvl2 二级界面
  let filter = 'all';                // 全部 / BGA / PQ / Calvin / Lichip
  const todayIdx = (week.days.findIndex(d => d.isToday) >= 0) ? week.days.findIndex(d => d.isToday) : 6;
  let dayIdx = todayIdx;

  function rebuild() {
    // 用当前配置重算演示数据
    Object.assign(OP_DEFAULTS.weeklyGo, cfg.weeklyGo);
    OP_DEFAULTS.targetMode = cfg.targetMode;
    OP_DEFAULTS.alarm = cfg.alarm;
    week = genOpWeek(new Date());
    stepOut = genOpStepOutput(new Date());
  }

  /* ---------------- 重点关注事项（置顶：待处理 / 异常 / 预警 / 关键词命中） ---------------- */
  function buildPrio() {
    const types = OP_PART_TYPES;
    const alarms = types.map(t => ({ t, a: opAlarm(t.id, dayIdx, week) }));
    const red = alarms.filter(x => x.a.level === 'red');
    const yellow = alarms.filter(x => x.a.level === 'yellow');
    const notOk = alarms.filter(x => !x.a.ok);

    const prioAttend = notOk.map(x => ({
      title: `${x.t.name} · ${x.a.mode === 'composite' ? '复合比对' : '差额比对'}`,
      meta: `当日实际 ${(x.a.diff + (week.byType[x.t.id][dayIdx].go)).toLocaleString()} · 目标 ${week.byType[x.t.id][dayIdx].go.toLocaleString()}`,
      badge: x.a.level === 'red' ? '缺口严重' : '缺口预警',
      badgeCls: x.a.level === 'red' ? 'b-danger' : 'b-warn',
      hot: x.a.level === 'red'
    }));
    const prioAbn = red.map(x => ({
      title: `${x.t.name} 缺口 ≥ ${(cfg.alarm.redK / 1000)}K`,
      meta: `差额 ${x.a.diff.toLocaleString()} 粒（红灯）`, badge: '红灯', badgeCls: 'b-danger', hot: true
    }));
    const prioOver = yellow.map(x => ({
      title: `${x.t.name} 缺口 ≥ ${(cfg.alarm.yellowK / 1000)}K`,
      meta: `差额 ${x.a.diff.toLocaleString()} 粒（黄灯）`, badge: '黄灯', badgeCls: 'b-warn'
    }));
    const kw = [
      { title: `报警模式：${cfg.alarm.mode === 'composite' ? '复合比对' : '差额比对'}`, meta: `阈值 黄 ${(cfg.alarm.yellowK / 1000)}K / 红 ${(cfg.alarm.redK / 1000)}K`, badge: '配置', badgeCls: 'b-info' },
      { title: `夏令时：${cfg.dst === 'auto' ? '自动' : (cfg.dst === 'summer' ? '夏令时' : '冬令时')}`, meta: `查询窗口：${cfg.dst === 'winter' ? cfg.dstWindow.winter : cfg.dstWindow.summer}`, badge: '待确认', badgeCls: 'b-warn' }
    ];
    return prioBand([
      { key: 'attend', cls: 'p-attend', icon: 'file', label: '待处理', count: notOk.length, unit: ' 类', sub: '当日未达标的 Part Type', items: prioAttend },
      { key: 'abn', cls: 'p-abn', icon: 'zap', label: '异常 · 红灯', count: red.length, unit: ' 类', sub: `差额 ≥ ${(cfg.alarm.redK / 1000)}K`, items: prioAbn },
      { key: 'over', cls: 'p-over', icon: 'clock', label: '预警 · 黄灯', count: yellow.length, unit: ' 类', sub: `差额 ≥ ${(cfg.alarm.yellowK / 1000)}K`, items: prioOver },
      { key: 'kw', cls: 'p-kw', icon: 'search', label: '关键词命中', count: kw.length, unit: ' 项', sub: '报警模式 / 夏令时窗口（口径待客户确认）', items: kw }
    ]);
  }

  function light(level) {
    const li = opLightInfo(level);
    return `<span class="badge" style="background:${li.color}1a;color:${li.color};border:1px solid ${li.color}55">${li.label}</span>`;
  }

  function render() {
    const prio = buildPrio();
    document.getElementById('content').innerHTML = `
      ${prio}

      <div class="notice mt16" style="--nc:var(--primary)">
        ${icon('activity', 19)}
        <div><strong>Output（OP）大屏（P2）：</strong>一级界面按日追踪 <strong>Go（目标值）/ Total / 前线Total / Earning Total</strong>，
        二级界面下钻<strong>工序 → Part Type</strong> 与 <strong>工序 → 机台号</strong> 实际 Output。
        <strong>价格、目标值生成、夏令时、报警阈值、刷新频率等口径待 09-29 后（预计 10-06 现场）与客户确认</strong>，
        故全部做成配置入口；当前为演示样例，数据源为确定性生成，可自由修改。</div>
      </div>

      <div class="card mt16 no-print">
        <div class="card-head">
          <div class="card-title">${icon('layers', 19)} 界面切换
            <span class="card-sub">一级每日追踪 / 二级工序机台详情</span></div>
          <div class="flex acenter gap8">
            <div class="seg" id="segTab">
              <button data-t="lvl1" class="${tab === 'lvl1' ? 'active' : ''}">一级 · 每日追踪</button>
              <button data-t="lvl2" class="${tab === 'lvl2' ? 'active' : ''}">二级 · 工序机台详情</button>
            </div>
            <button class="btn btn-sm" id="btnCfg">${icon('settings', 16)} 预留配置入口</button>
            ${canExport ? `<button class="btn btn-sm btn-primary" id="btnExport">${icon('download', 16)} 导出 Excel</button>` : '<span class="chip">只读（无导出权限）</span>'}
          </div>
        </div>
      </div>

      ${tab === 'lvl1' ? renderLvl1() : renderLvl2()}

      <div class="card mt16 no-print">
        <div class="card-head"><div class="card-title">${icon('refresh', 19)} 数据刷新
          <span class="card-sub">手动 + 自动（频率待 IT 确认）</span></div></div>
        <div class="card-body flex acenter gap12">
          <button class="btn btn-sm" id="btnRefresh">${icon('refresh', 16)} 手动刷新</button>
          <span class="chip">模式：${cfg.refresh.mode === 'auto' ? '自动（每 ' + (cfg.refresh.autoSec / 60) + ' 分钟）' : '手动'}</span>
          <span class="small muted">数据来源：<strong>${esc(OP_DEFAULTS.source)}</strong> · 真实库表 / SQL 待业务方 10-06 现场提供</span>
        </div>
      </div>`;

    if (tab === 'lvl1') bindLvl1(); else bindLvl2();
    bindCommon();
  }

  /* ---------------- 一级界面 ---------------- */
  function renderLvl1() {
    const k = opDayKPI(week, dayIdx, filter);
    const types = filter === 'all' ? OP_PART_TYPES : OP_PART_TYPES.filter(t => t.id === filter);
    const dayLabel = week.days[dayIdx].label + ' ' + week.days[dayIdx].weekday;

    // 图表 A：单位 K —— Go / Total / 前线Total
    const labels = week.days.map(d => d.label);
    const seriesUnits = [
      { name: 'Go（目标值）', color: '#1d4ed8', fill: true, data: week.days.map((_, i) => sum(i, 'go') / 1000) },
      { name: 'Total（实际）', color: '#12805a', data: week.days.map((_, i) => sum(i, 'actual') / 1000) },
      { name: '前线Total', color: '#a8620b', data: week.days.map((_, i) => sum(i, 'front') / 1000) }
    ];
    // 图表 B：金额 万元 —— Earning
    const seriesMoney = [
      { name: 'Earning Total', color: '#8b5cf6', fill: true, data: week.days.map((_, i) => sum(i, 'earning')) }
    ];

    function sum(i, key) {
      let s = 0; types.forEach(t => s += week.byType[t.id][i][key]); return s;
    }

    // 选中日各 Part Type 报警
    const alarms = types.map(t => ({ t, r: week.byType[t.id][dayIdx], a: opAlarm(t.id, dayIdx, week) }));

    return `
      <div class="card mt16">
        <div class="card-head">
          <div class="card-title">${icon('filter', 19)} 一级界面 · 每日追踪
            <span class="card-sub">当前选中日：${dayLabel}（本周${week.days[dayIdx].idx + 1}/7）</span></div>
          <div class="seg" id="segDay">
            ${week.days.map(d => `<button data-d="${d.idx}" class="${d.idx === dayIdx ? 'active' : ''}">${d.label}<small style="opacity:.7"> ${d.weekday.replace('(首)', '')}</small></button>`).join('')}
          </div>
        </div>
        <div class="card-body">
          <div class="cfg-row mb12">
            <div class="cfg-item"><label class="field-label">按 Part Type 筛选</label>
              <div class="seg" id="segFilter">
                <button data-f="all" class="${filter === 'all' ? 'active' : ''}">全部</button>
                ${OP_PART_TYPES.map(t => `<button data-f="${t.id}" class="${filter === t.id ? 'active' : ''}">${t.name}</button>`).join('')}
              </div>
            </div>
          </div>
          <div class="grid g-4">
            <div class="kpi"><div class="kpi-top"><div class="kpi-name">Go（目标值）</div><div class="kpi-icon" style="--accent:#1d4ed8;--accent-soft:#e7eeff">${icon('target', 20)}</div></div>
              <div class="kpi-value">${(k.go / 1000).toFixed(1)}<span class="kpi-unit">K</span></div><div class="kpi-foot">粒 · 当日目标</div></div>
            <div class="kpi"><div class="kpi-top"><div class="kpi-name">Total（实际）</div><div class="kpi-icon" style="--accent:#12805a;--accent-soft:#e3f6ee">${icon('activity', 20)}</div></div>
              <div class="kpi-value">${(k.total / 1000).toFixed(1)}<span class="kpi-unit">K</span></div><div class="kpi-foot">粒 · 后线实际（QA 后）</div></div>
            <div class="kpi"><div class="kpi-top"><div class="kpi-name">前线 Total</div><div class="kpi-icon" style="--accent:#a8620b;--accent-soft:#fdf1e0">${icon('arrowRight', 20)}</div></div>
              <div class="kpi-value">${(k.front / 1000).toFixed(1)}<span class="kpi-unit">K</span></div><div class="kpi-foot">粒 · 前线实际</div></div>
            <div class="kpi"><div class="kpi-top"><div class="kpi-name">Earning Total</div><div class="kpi-icon" style="--accent:#8b5cf6;--accent-soft:#f1ebfe">${icon('database', 20)}</div></div>
              <div class="kpi-value">${k.earning.toFixed(1)}<span class="kpi-unit">万</span></div><div class="kpi-foot">元 · 实际 × 配置单价</div></div>
          </div>
        </div>
      </div>

      <div class="grid g-2 mt16">
        <div class="card">
          <div class="card-head"><div class="card-title">${icon('activity', 19)} 每日产出趋势（单位 K）
            <span class="card-sub">Go / Total / 前线Total</span></div></div>
          <div class="card-body"><div id="cUnits"></div>
            <div class="legend">${seriesUnits.map(s => `<span class="lg"><i style="background:${s.color}"></i>${s.name}</span>`).join('')}</div>
          </div>
        </div>
        <div class="card">
          <div class="card-head"><div class="card-title">${icon('database', 19)} 每日 Earning（金额 · 万元）
            <span class="card-sub">后线实际 × 配置价格</span></div></div>
          <div class="card-body"><div id="cMoney"></div>
            <div class="legend">${seriesMoney.map(s => `<span class="lg"><i style="background:${s.color}"></i>${s.name}</span>`).join('')}</div>
          </div>
        </div>
      </div>

      <div class="card mt16">
        <div class="card-head"><div class="card-title">${icon('alert', 19)} 异常报警 · ${dayLabel}
          <span class="card-sub">${cfg.alarm.mode === 'composite' ? '复合比对' : '差额比对'} · 黄 ${(cfg.alarm.yellowK / 1000)}K / 红 ${(cfg.alarm.redK / 1000)}K</span></div></div>
        <div class="card-body" style="max-height:360px;overflow:auto">
          <table class="table">
            <thead><tr><th>Part Type</th><th class="center">目标值</th><th class="center">实际 Total</th>
              <th class="center">差额（实际-目标）</th><th class="center">达成率</th><th class="center">状态</th></tr></thead>
            <tbody>${alarms.map(x => {
              const rate = (x.r.actual / x.r.go * 100).toFixed(1);
              return `<tr><td><strong>${x.t.name}</strong></td>
                <td class="center num">${x.r.go.toLocaleString()}</td>
                <td class="center num">${x.r.actual.toLocaleString()}</td>
                <td class="center num" style="color:${x.a.diff < 0 ? 'var(--danger)' : 'var(--success)'}">${x.a.diff >= 0 ? '+' : ''}${x.a.diff.toLocaleString()}</td>
                <td class="center num">${rate}%</td>
                <td class="center">${light(x.a.level)}</td></tr>`;
            }).join('') || '<tr><td colspan="6" class="center muted">无数据</td></tr>'}</tbody>
          </table>
        </div>
      </div>`;

    function noop() { }
    setTimeout(() => {
      lineChart(document.getElementById('cUnits'), { series: seriesUnits, labels, height: 250, min: 0, max: Math.max(...seriesUnits.flatMap(s => s.data)) * 1.2, yUnit: ' K' });
      lineChart(document.getElementById('cMoney'), { series: seriesMoney, labels, height: 250, min: 0, max: Math.max(...seriesMoney.flatMap(s => s.data)) * 1.2, yUnit: ' 万' });
    });
    return '';
  }

  function bindLvl1() {
    document.querySelectorAll('#segDay button').forEach(b => b.onclick = () => { dayIdx = Number(b.dataset.d); render(); });
    document.querySelectorAll('#segFilter button').forEach(b => b.onclick = () => { filter = b.dataset.f; render(); });
  }

  /* ---------------- 二级界面 ---------------- */
  function renderLvl2() {
    // 上半：工序 → Part Type
    const typeHead = OP_PART_TYPES.map(t => `<th class="center" style="color:${t.color}">${t.name}</th>`).join('');
    const typeRows = OP_STEPS.map(s => {
      const cells = OP_PART_TYPES.map(t => `<td class="center num">${(stepOut.byType[s.name][t.id] / 1000).toFixed(1)}K</td>`).join('');
      const sumK = (stepOut.stepTotal[s.name] / 1000).toFixed(1);
      return `<tr><td><strong>${s.name}</strong>${s.final ? ' <span class="badge b-success">最终站</span>' : ''}</td>${cells}<td class="center num"><strong>${sumK}K</strong></td></tr>`;
    }).join('');

    // 下半：工序 → 机台号
    let machineRows = '';
    OP_STEPS.forEach(s => {
      const ms = OP_MACHINES[s.name];
      const sum = stepOut.byMachine[s.name].__sum;
      ms.forEach((m, i) => {
        const v = stepOut.byMachine[s.name][m];
        machineRows += `<tr><td>${i === 0 ? `<strong>${s.name}</strong>${s.final ? ' <span class="badge b-success">最终站</span>' : ''}` : ''}</td>
          <td>${m}</td><td class="center num">${(v / 1000).toFixed(1)}K</td>
          <td class="center num">${sum ? (v / sum * 100).toFixed(1) : 0}%</td></tr>`;
      });
    });

    // 图表：工序 × Part Type 分组柱
    const labels = OP_STEPS.map(s => s.name.replace(' 质检', '').replace(' 固晶', '').replace(' 键合', '').replace(' 塑封', '').replace(' 切筋', '').replace(' 电镀', ''));
    const series = OP_PART_TYPES.map(t => ({ name: t.name, color: t.color, data: OP_STEPS.map(s => stepOut.byType[s.name][t.id] / 1000) }));

    // 最终站机台分布（donut）
    const qaMachines = OP_MACHINES[OP_FINAL_STEP].map(m => ({ label: m, value: stepOut.byMachine[OP_FINAL_STEP][m], color: '#12805a' }));

    return `
      <div class="notice mt16" style="--nc:var(--warn)">
        ${icon('alert', 18)}
        <div><strong>数据逻辑澄清：</strong>所有中间工序（DB / WB / Mold / Trim / Plating）数据仅为<strong>过程监控</strong>，
        <strong>最终 Output 以最后一站（QA 质检过后）数据为准</strong>。下表「最终站」行即为权威产出值。</div>
      </div>

      <div class="card mt16">
        <div class="card-head"><div class="card-title">${icon('layers', 19)} 上半 · 按工序 → Part Type 实际 Output
          <span class="card-sub">单位 K（千粒）</span></div></div>
        <div class="card-body">
          <div id="cStepType"></div>
          <table class="table mt16">
            <thead><tr><th>工序</th>${typeHead}<th class="center">工序合计</th></tr></thead>
            <tbody>${typeRows}</tbody>
          </table>
        </div>
      </div>

      <div class="grid g-2 mt16">
        <div class="card">
          <div class="card-head"><div class="card-title">${icon('server', 19)} 下半 · 按工序 → 机台号 实际 Output
            <span class="card-sub">单位 K（千粒）</span></div></div>
          <div class="card-body" style="max-height:420px;overflow:auto">
            <table class="table">
              <thead><tr><th>工序</th><th>机台号</th><th class="center">实际 Output</th><th class="center">工序内占比</th></tr></thead>
              <tbody>${machineRows}</tbody>
            </table>
          </div>
        </div>
        <div class="card">
          <div class="card-head"><div class="card-title">${icon('server', 19)} 最终站（QA）机台分布
            <span class="card-sub">权威产出</span></div></div>
          <div class="card-body flex acenter" style="gap:20px">
            <div id="cQaMachine"></div>
            <div style="flex:1">${qaMachines.map(m => `
              <div class="flex between acenter" style="margin-bottom:10px">
                <span class="flex acenter gap8"><i style="width:10px;height:10px;border-radius:3px;background:${m.color};display:inline-block"></i>${m.label}</span>
                <strong class="num">${(m.value / 1000).toFixed(1)}K</strong>
              </div>`).join('')}
            </div>
          </div>
        </div>
      </div>`;
  }

  function bindLvl2() {
    const labels = OP_STEPS.map(s => s.name.replace(' 质检', '').replace(' 固晶', '').replace(' 键合', '').replace(' 塑封', '').replace(' 切筋', '').replace(' 电镀', ''));
    const series = OP_PART_TYPES.map(t => ({ name: t.name, color: t.color, data: OP_STEPS.map(s => stepOut.byType[s.name][t.id] / 1000) }));
    barGroup(document.getElementById('cStepType'), { labels, series, height: 260, max: Math.max(...series.flatMap(s => s.data)) * 1.15 });
    donut(document.getElementById('cQaMachine'), OP_MACHINES[OP_FINAL_STEP].map(m => ({ label: m, value: stepOut.byMachine[OP_FINAL_STEP][m], color: '#12805a' })), 190, (stepOut.byMachine[OP_FINAL_STEP].__sum / 1000).toFixed(0) + 'K', 'QA 产出');
  }

  /* ---------------- 配置入口（预留 · 待客户确认） ---------------- */
  function openConfig() {
    const priceRows = OP_PRICE_TABLE.map(p => `<tr><td><code>${esc(p.device)}</code>${p.base !== p.device ? ` <span class="small muted">(${esc(p.base)})</span>` : ''}</td>
      <td>${p.partType}</td><td>${esc(p.dept)}</td><td class="center num">¥${p.price.toFixed(2)}</td></tr>`).join('');
    const goRows = OP_PART_TYPES.map(t => `<div class="cfg-item"><label class="field-label">${t.name} 每周首日(周六)目标</label>
      <input class="input" type="number" min="0" step="1000" id="go_${t.id}" value="${cfg.weeklyGo[t.id]}" style="width:120px"><span class="small muted">粒</span></div>`).join('');

    const body = `
      <div class="cfg-note">${icon('alert', 15)} 以下均为<strong>待客户确认口径</strong>，已做成配置；保存后即时重算演示数据。真实 Device 编码、价格表、SQL 待业务方提供。</div>

      <div class="field-label mt12" style="display:block">基础价格配置（B 列 Device / G 列 单价 / 部门，兼容 99 编码）</div>
      <div style="max-height:180px;overflow:auto" class="mt8">
        <table class="table"><thead><tr><th>Device</th><th>Part Type</th><th>部门</th><th class="center">单价(元)</th></tr></thead>
        <tbody>${priceRows}</tbody></table>
      </div>

      <div class="field-label mt12" style="display:block">目标值生成（每周起始：周六 · 模式）</div>
      <div class="cfg-row mt8">${goRows}
        <div class="cfg-item"><label class="field-label">生成模式</label>
          <div class="seg" id="cfgMode">
            <button data-m="avg" class="${cfg.targetMode === 'avg' ? 'active' : ''}">平均分配</button>
            <button data-m="linear" class="${cfg.targetMode === 'linear' ? 'active' : ''}">线性递增</button>
          </div>
        </div>
      </div>

      <div class="field-label mt12" style="display:block">异常报警配置（按部门可覆盖 · 此处为全局）</div>
      <div class="cfg-row mt8">
        <div class="cfg-item"><label class="field-label">比对模式</label>
          <div class="seg" id="cfgAlarmMode">
            <button data-m="diff" class="${cfg.alarm.mode === 'diff' ? 'active' : ''}">差额比对</button>
            <button data-m="composite" class="${cfg.alarm.mode === 'composite' ? 'active' : ''}">复合比对</button>
          </div>
        </div>
        <div class="cfg-item"><label class="field-label">黄灯阈值（差额）</label>
          <input class="input" type="number" id="cfgYellow" value="${cfg.alarm.yellowK}" min="0" step="500" style="width:110px"><span class="small muted">粒</span></div>
        <div class="cfg-item"><label class="field-label">红灯阈值（差额）</label>
          <input class="input" type="number" id="cfgRed" value="${cfg.alarm.redK}" min="0" step="1000" style="width:110px"><span class="small muted">粒</span></div>
        <div class="cfg-item"><label class="field-label">复合比对 WIP 占比</label>
          <input class="input" type="number" id="cfgWip" value="${Math.round(cfg.alarm.wipRatio * 100)}" min="0" max="100" step="5" style="width:90px"><span class="small muted">%</span></div>
      </div>

      <div class="field-label mt12" style="display:block">数据刷新机制（频率待 IT 确认）</div>
      <div class="cfg-row mt8">
        <div class="cfg-item"><label class="field-label">刷新模式</label>
          <div class="seg" id="cfgRefresh">
            <button data-m="manual" class="${cfg.refresh.mode === 'manual' ? 'active' : ''}">手动</button>
            <button data-m="auto" class="${cfg.refresh.mode === 'auto' ? 'active' : ''}">自动</button>
          </div>
        </div>
        <div class="cfg-item"><label class="field-label">自动间隔（秒）</label>
          <input class="input" type="number" id="cfgAutoSec" value="${cfg.refresh.autoSec}" min="60" step="60" style="width:100px"></div>
      </div>

      <div class="field-label mt12" style="display:block">夏令时 / 冬令时（影响 IT 查询窗口）</div>
      <div class="cfg-row mt8">
        <div class="cfg-item"><label class="field-label">当前时段</label>
          <div class="seg" id="cfgDst">
            <button data-m="auto" class="${cfg.dst === 'auto' ? 'active' : ''}">自动</button>
            <button data-m="summer" class="${cfg.dst === 'summer' ? 'active' : ''}">夏令时</button>
            <button data-m="winter" class="${cfg.dst === 'winter' ? 'active' : ''}">冬令时</button>
          </div>
        </div>
        <div class="cfg-item"><label class="field-label">查询窗口</label>
          <span class="chip">${cfg.dst === 'winter' ? cfg.dstWindow.winter : cfg.dstWindow.summer}（待 IT 确认）</span></div>
      </div>`;

    openDialog({
      title: 'Output（OP）· 预留配置入口', sub: '全部口径待 09-29 / 10-06 与客户确认', width: 820, body, okText: '保存并应用',
      onOk: (mask, close) => {
        OP_PART_TYPES.forEach(t => { const v = Number(document.getElementById('go_' + t.id).value); if (!isNaN(v)) cfg.weeklyGo[t.id] = v; });
        cfg.targetMode = mask.querySelector('#cfgMode .active').dataset.m;
        cfg.alarm.mode = mask.querySelector('#cfgAlarmMode .active').dataset.m;
        cfg.alarm.yellowK = Math.max(0, Number(document.getElementById('cfgYellow').value) || 1000);
        cfg.alarm.redK = Math.max(0, Number(document.getElementById('cfgRed').value) || 10000);
        cfg.alarm.wipRatio = Math.max(0, Math.min(1, (Number(document.getElementById('cfgWip').value) || 15) / 100));
        cfg.refresh.mode = mask.querySelector('#cfgRefresh .active').dataset.m;
        cfg.refresh.autoSec = Math.max(60, Number(document.getElementById('cfgAutoSec').value) || 600);
        cfg.dst = mask.querySelector('#cfgDst .active').dataset.m;
        if (cfg.dst === 'winter') cfg.dstWindow = OP_DEFAULTS.dstWindow; // 展示用
        save();
        rebuild();
        close();
        toast('配置已保存并应用（演示数据已重算）', 'success');
        render();
      }
    });
  }

  function bindCommon() {
    document.querySelectorAll('#segTab button').forEach(b => b.onclick = () => { tab = b.dataset.t; render(); });
    const bc = document.getElementById('btnCfg'); if (bc) bc.onclick = openConfig;
    const br = document.getElementById('btnRefresh'); if (br) br.onclick = () => { rebuild(); render(); toast('已手动刷新演示数据', 'primary'); };
    const be = document.getElementById('btnExport');
    if (be) be.onclick = () => {
      if (!canExport) { toast('当前角色无「Output（OP）」导出权限', 'warn'); return; }
      if (tab === 'lvl1') {
        const headers = ['日期', '星期', 'Part Type', '目标值', '实际Total', '前线Total', 'Earning(万)', '差额', '状态'];
        const rows = [];
        week.days.forEach((d, i) => OP_PART_TYPES.forEach(t => {
          const r = week.byType[t.id][i], a = opAlarm(t.id, i, week);
          rows.push([d.label, d.weekday, t.name, r.go, r.actual, r.front, r.earning, a.diff, opLightInfo(a.level).label]);
        }));
        exportExcel('Output_OP_每日追踪_7日.xls', headers, rows);
      } else {
        const headers = ['工序', '是否最终站', 'Part Type', '实际Output(粒)', '机台号', '机台Output(粒)'];
        const rows = [];
        OP_STEPS.forEach(s => OP_PART_TYPES.forEach(t => {
          rows.push([s.name, s.final ? '是' : '否', t.name, stepOut.byType[s.name][t.id], '', '']);
          OP_MACHINES[s.name].forEach(m => rows.push(['', '', '', '', m, stepOut.byMachine[s.name][m]]));
        }));
        exportExcel('Output_OP_工序机台明细.xls', headers, rows);
      }
      toast('已导出 Excel', 'success');
    };
  }

  render();
})();
