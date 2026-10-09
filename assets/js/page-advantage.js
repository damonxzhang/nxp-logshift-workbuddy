/* ============ 我方优势 · 平台价值页 ============
   面向客户交接演示的「卖点」汇总页：把分散在多个独立系统、又已实际落地的能力
   收敛为 7 条核心优势，便于售前/交接时一页讲清「为什么用我们这套平台」。
   内容均为已有能力的客观陈述（设备报修 / 模具管理 / COMP 塑封料出库解冻 为我方已交付系统）。 */
(function () {
  renderShell('advantage');

  /* ---------------- 七大核心优势（已落地能力，逐条丰富） ---------------- */
  const ADV = [
    {
      no: 1, icon: 'layers', accent: '#1d4ed8',
      title: '多源数据打通，一套平台统一看',
      lead: '把分散在多个独立系统的数据做归一统一口径，一处看板全量掌握，生产人员不再跨平台查数、手工汇总。',
      points: [
        '<b>已落地：</b>设备报修系统、模具管理系统、COMP 塑封料出库解冻数据',
        '<b>再接入：</b>Output（产量）、WIP（在制品）、次品管理（质量）三大产线数据源',
        '统一数据口径与刷新节奏，跨系统指标可直接对比、联动预警',
        '看板即数据源，班组长无需切换多个后台、手工拼表'
      ]
    },
    {
      no: 2, icon: 'search', accent: '#0b6a86',
      title: '批次全链路追溯能力',
      lead: 'Lot 批次可串联从原料到成品的全流程记录，出现质量问题时一键溯源、精准定位。',
      points: [
        '链路串联：塑封料出库解冻记录 → 生产 WIP → 机台信息 → 模具履历 → 不良次品记录',
        '质量问题一键溯源，定位到具体料号、机台、模具与时段',
        '原料—在制—成品端到端可追溯，复盘与责任界定更高效'
      ]
    },
    {
      no: 3, icon: 'alert', accent: '#a8620b',
      title: '次品质量分析（适配 12 小时数据同步）',
      lead: '按班次更新 PPM 趋势，自动交叉比对多系统信息，辅助定位不良根因、评估交付风险。',
      points: [
        '按班次刷新 PPM 趋势，识别持续性不良爬升而非偶发波动',
        '自动交叉比对：设备维修 / 模具保养 / COMP 物料信息，缩小根因范围',
        '估算产量损失，支撑交付风险评估与排产决策',
        '多系统不良数据对账，解决报表口径不一致、数出多门的问题'
      ]
    },
    {
      no: 4, icon: 'zap', accent: '#cc2f2a',
      title: '异常告警 + 工单闭环联动',
      lead: '监控覆盖产出、在制、质量、设备、模具、物料，告警直接联动工单，事件全程留痕。',
      points: [
        '监控维度：产出 / WIP / 不良 / 设备 / 模具 / 物料超时（COMP 解冻超时）',
        '告警直达：可一键关联设备报修、模具维修工单，无需线下转派',
        '从发现 → 派单 → 处置 → 关闭全流程留痕，形成管理闭环'
      ]
    },
    {
      no: 5, icon: 'clock', accent: '#8b5cf6',
      title: 'OTD 周期监控',
      lead: '监控批次在各工序的停留时长，提前暴露生产堵点，降低交付逾期风险。',
      points: [
        '实时监控批次停留时长，识别工序滞留 Lot',
        '结合告警阈值，提前预警超期风险而非事后追责',
        '缩短交付周期，支撑产能与交付准时率（OTD）提升'
      ]
    },
    {
      no: 6, icon: 'monitor', accent: '#12805a',
      title: '可复用的可视化监控大屏 + 岗位交接中心',
      lead: '静态演示原型即可快速落地，兼顾车间实时监控与班组交接复盘，部署简单、离线可用。',
      points: [
        '大屏 + 交接中心一体化：车间监控、班次复盘、产能与交付预判一处完成',
        '零依赖静态原型，断网可演示、部署简单，便于现场快速推广',
        '标准化可视化组件可复用于不同车间与产线，降低后续扩展成本'
      ]
    },
    {
      no: 7, icon: 'shield', accent: '#1640ad',
      title: '我方落地经验优势',
      lead: '设备报修、模具管理均为我方已实施交付的系统，熟悉客户现场业务与数据逻辑。',
      points: [
        '设备报修系统、模具管理系统已实际交付运行，非 POC 纸面方案',
        '熟悉客户现场业务流与数据逻辑，对接成本更低',
        '落地风险更小：是在已验证系统上延展，而非从零集成的陌生系统'
      ]
    }
  ];

  /* ---------------- 我方已落地系统（优势 #7 的支撑证据） ---------------- */
  const SYS = [
    { name: '设备报修系统', icon: 'settings', desc: '机台报修、维修派单与履历留痕，已实际交付运行；本平台告警可直接联动其报修工单。', badge: '已交付运行' },
    { name: '模具管理系统', icon: 'layers', desc: '模具台账、保养计划与维修履历，已实际交付运行；不良分析时交叉比对模具保养记录。', badge: '已交付运行' },
    { name: 'COMP 塑封料出库解冻', icon: 'refresh', desc: '塑封料出库解冻记录与时效监控，已落地；超时（解冻超时）纳入异常告警维度。', badge: '已落地' }
  ];

  /* ---------------- 渲染 ---------------- */
  function statStrip() {
    const items = [
      { label: '我方已落地系统', value: SYS.length + ' 个', foot: '设备报修 / 模具管理 / COMP 解冻' },
      { label: '接入数据源', value: '6 类', foot: 'Output / WIP / 次品 / 设备 / 模具 / COMP' },
      { label: '监控维度', value: '6 项', foot: '产出 / WIP / 不良 / 设备 / 模具 / 物料' },
      { label: '数据同步', value: '12 小时', foot: '班次级刷新，适配现场节奏' },
      { label: '部署方式', value: '离线可用', foot: '零依赖静态原型，断网可演示' }
    ];
    return items.map(i => `
      <div class="si"><div class="si-label">${esc(i.label)}</div>
        <div class="si-value">${esc(i.value)}</div>
        <div class="si-label" style="font-size:12.5px">${esc(i.foot)}</div></div>`).join('');
  }

  function advCard(a) {
    return `<div class="card adv-card">
      <div class="card-head">
        <div class="adv-h">
          <span class="adv-no" style="background:${a.accent}1a;color:${a.accent}">${a.no}</span>
          <div class="card-title" style="color:${a.accent}">${icon(a.icon, 20)} ${esc(a.title)}</div>
        </div>
      </div>
      <div class="card-body">
        <p class="adv-lead">${esc(a.lead)}</p>
        <ul class="adv-points">${a.points.map(p => `<li>${p}</li>`).join('')}</ul>
      </div>
    </div>`;
  }

  function sysCard(s) {
    return `<div class="sys">
      <div class="sys-top">
        <span class="sys-name">${icon(s.icon, 18)} ${esc(s.name)}</span>
        <span class="badge b-success">${esc(s.badge)}</span>
      </div>
      <p class="sys-desc">${esc(s.desc)}</p>
    </div>`;
  }

  function render() {
    document.getElementById('content').innerHTML = `
    <div class="adv-hero">
      <div class="ah-ic">${icon('target', 26)}</div>
      <div>
        <h1>我方优势 · 为什么用这套统一监控与交接中心</h1>
        <p>不是从零拼凑的陌生系统，而是把<strong>已实际交付的设备报修、模具管理、COMP 塑封料出库解冻</strong>与产线 Output / WIP / 次品数据归一打通，形成「看数—追溯—分析—告警—闭环」的一体化平台。以下 7 条核心优势均基于已落地能力。</p>
      </div>
    </div>

    <div class="card mt16">
      <div class="stat-strip">${statStrip()}</div>
    </div>

    <section class="card mt24">
      <div class="card-head">
        <div class="card-title">${icon('target', 19)} 七大核心优势
          <span class="card-sub">均基于已落地系统能力 · 一页讲清平台价值</span></div>
      </div>
      <div class="card-body" style="background:var(--surface-2);padding-top:16px">
        <div class="grid g-2">${ADV.map(advCard).join('')}</div>
      </div>
    </section>

    <section class="card mt24">
      <div class="card-head">
        <div class="card-title">${icon('shield', 19)} 我方已落地系统（优势支撑）
          <span class="card-sub">均为实际交付运行，非演示占位</span></div>
      </div>
      <div class="card-body" style="background:var(--surface-2);padding-top:16px">
        <div class="adv-sys">${SYS.map(sysCard).join('')}</div>
      </div>
    </section>

    <section class="card mt24">
      <div class="card-head">
        <div class="card-title">${icon('zap', 19)} 异常告警 → 工单闭环联动
          <span class="card-sub">优势 #4 的落地形态</span></div>
      </div>
      <div class="card-body">
        <div class="adv-flow">
          <span class="node">${icon('activity', 16)} 多源监控</span>
          <span class="arrow">${icon('arrowRight', 18)}</span>
          <span class="node n-warn">${icon('alert', 16)} 异常告警</span>
          <span class="arrow">${icon('arrowRight', 18)}</span>
          <span class="node">${icon('settings', 16)} 设备报修工单</span>
          <span class="node">${icon('layers', 16)} 模具维修工单</span>
          <span class="arrow">${icon('arrowRight', 18)}</span>
          <span class="node n-ok">${icon('check', 16)} 处置留痕 · 闭环</span>
        </div>
        <div class="small muted mt16">产出 / WIP / 不良 / 设备 / 模具 / 物料（COMP 解冻超时）任一维度越界即触发告警，可直接关联设备报修与模具维修工单，事件从发现到关闭全程留痕。</div>
      </div>
    </section>`;
  }

  render();
})();
