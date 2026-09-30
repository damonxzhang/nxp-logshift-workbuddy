/* ============ 子系统接入与数据库底座页（问卷 1.1） ============
   本次真实接入范围只有两个子系统：Output（OP）与 WIP。
   页面据此收敛为两块：① 接入范围概览（统计条）② 两个子系统的接入详情卡。
   不再展示通用样例子系统清单（原 12 条 ERP / 支付网关 / 堡垒机… 为虚构样例，已移除）；
   「统一底座 · 五层能力」与「待确认项 · 现场确认清单」两块已按客户要求删除。 */
(function () {
  renderShell('systems');

  /* ---------------- 本次接入范围（本页唯一数据源） ---------------- */
  const SCOPE = [
    {
      id: 'OP',
      name: 'Output（OP）',
      sub: '产量输出 · 周维度追踪（周六起始，列序 六 → 五）',
      icon: 'activity',
      accent: '#1d4ed8',
      phase: '已投产',
      phaseCls: 'b-success',
      progress: 100,
      screen: { label: 'Output（OP）大屏', href: 'output.html' },
      extra: [
        { label: '周维度累计表', href: 'op-table.html' },
        { label: '目标与权限配置', href: 'op-config.html' }
      ],
      kv: [
        ['数据来源', 'IT 库（只读账号 + SQL 视图）· 实际 total 的库表与字段口径待客户提供'],
        ['接入方式', '模式 A · 只读直读 + 定时拉取（全程不写入源系统）'],
        ['采集频率', '每小时增量拉取（24 次/日）+ 每日 01:00 全量校验'],
        ['数据粒度', 'PKG Type × 日（周口径周六起始）；Output 目标 / 实际 + Earn 单价'],
        ['关键维度', '年份 / 周别 / PKG Type / 部门（LEAD · NON-LEAD · PLATING）'],
        ['责任部门', '生产计划部（口径）· 信息中心（接入与运维）']
      ],
      marks: [
        { t: '口径确认', ok: true },
        { t: '数据源确认', ok: true },
        { t: '大屏上线', ok: true },
        { t: '权限与配置', ok: true }
      ],
      note: '大屏已按客户要求上线（含周维度累计表、目标与权限配置两个配套页）；实际产出的取数库表与字段口径确认后即可由演示数据切换为真实数据。'
    },
    {
      id: 'WIP',
      name: 'WIP（在制品）',
      sub: '产量 · WIP 在制品看板（真实数据演示版已上线 · 按 PDF 第四部分「4. WIP」需求落地）',
      icon: 'layers',
      accent: '#8b5cf6',
      phase: '演示版已上线',
      phaseCls: 'b-success',
      progress: 90,
      screen: { label: 'WIP 在制品看板', href: 'wip.html' },
      kv: [
        ['数据来源', '客户 IT 导出《BE1 WIP Report-V26.xls》在制品快照（813 批 · 2,668.7K · Hold 22 批 · OTD 逾期 130 批）'],
        ['接入方式', '模式 A · 报表文件抽取（.extract-wip.py 生成 wip-real-data.js，IT 更新报表后重跑即刷新）'],
        ['一级界面', '按 pkgType 显示各工序 WIP：by real unit（数量 K）/ by earn（按 OP 单价折算万元）双口径切换'],
        ['二级界面', '进入指定工序后按 pkg type / pkg size / 封装料号 / 机台位置 / Bank / Hold / 关键字筛选，支持导出'],
        ['报警配置', '二级界面可配置 BE CT 黄 / 红阈值与 OTD 逾期红线（本地保存，立即生效）'],
        ['责任部门', '生产计划部（口径）· 信息中心（接入与运维）']
      ],
      marks: [
        { t: '需求确认（PDF §4）', ok: true },
        { t: '数据源确认', ok: true },
        { t: '看板上线（演示版）', ok: true },
        { t: 'IT 库直连（待客户开放）', ok: false }
      ],
      note: '一级/二级界面与报警配置均已可演示；当前以报表抽取方式供数，待客户开放 IT 库只读账号后切换为定时直连，界面无需改动。'
    }
  ];

  /* ---------------- 渲染 ---------------- */
  function statStrip() {
    const done = SCOPE.filter(s => s.progress >= 100).length;
    const items = [
      { label: '本次接入子系统', value: SCOPE.length + ' 个', foot: SCOPE.map(s => s.id).join(' · ') },
      { label: '已上线', value: done + ' 个', foot: 'OP 大屏 + WIP 看板（WIP 为演示版）' },
      { label: '只读接入', value: SCOPE.length + ' / ' + SCOPE.length, foot: '不写入源系统' },
      { label: 'WIP 供数方式', value: '报表抽取', foot: '待客户开放 IT 库后切直连' },
      { label: '采集频率', value: '每小时', foot: '增量拉取 + 每日全量校验' }
    ];
    return items.map(i => `
      <div class="si"><div class="si-label">${esc(i.label)}</div>
        <div class="si-value">${esc(i.value)}</div>
        <div class="si-label" style="font-size:12.5px">${esc(i.foot)}</div></div>`).join('');
  }

  function sysCard(s) {
    const kv = s.kv.map(([k, v]) => `<div>${esc(k)}</div><div>${esc(v)}</div>`).join('');
    const marks = s.marks.map(m => `<span class="chip" style="color:${m.ok ? 'var(--success)' : 'var(--text-3)'}">
      ${icon(m.ok ? 'check' : 'clock', 14)} ${esc(m.t)}</span>`).join('');
    const links = s.screen
      ? `<span class="flex acenter wrap gap8">${icon('monitor', 15)}
          对应大屏：<a href="${s.screen.href}"><strong>${esc(s.screen.label)}</strong></a>
          ${(s.extra || []).map(e => `<a class="chip" href="${e.href}">${esc(e.label)} ${icon('arrowRight', 13)}</a>`).join('')}</span>`
      : `<span class="flex acenter gap8">${icon('clock', 15)} 该屏为<strong>暂缓占位</strong>，暂未创建页面；确认纳期后即可按同一接入方案开工</span>`;

    return `<div class="card">
      <div class="card-head">
        <div>
          <div class="card-title" style="color:${s.accent}">${icon(s.icon, 20)} ${esc(s.name)}</div>
          <div class="card-sub" style="display:block;margin-top:6px">${esc(s.sub)}</div>
        </div>
        <span class="badge ${s.phaseCls}">${esc(s.phase)}</span>
      </div>
      <div class="card-body">
        <div class="fixed-kv">${kv}</div>

        <div class="flex between acenter mt16">
          <span class="small muted">接入完成度</span>
          <strong style="color:${s.accent}">${s.progress}%</strong>
        </div>
        <div class="progress mt8"><i style="width:${s.progress}%;background:${s.accent}"></i></div>

        <div class="flex wrap gap8 mt16">${marks}</div>
        <div class="small muted mt12">${esc(s.note)}</div>
      </div>
      <div class="card-foot">${links}</div>
    </div>`;
  }

  function render() {
    document.getElementById('content').innerHTML = `
    <div class="notice" style="--nc:var(--primary)">
      ${icon('server', 19)}
      <div><strong>调研要点（问卷 1.1）：</strong>本次需并联接入统一监控中心的子系统<strong>已收敛为 2 个</strong>——<strong>Output（OP）</strong> 与 <strong>WIP</strong>。请确认这两个子系统的<strong>数据来源、接入方式、采集频率与数据粒度</strong>；确认后即按「一个子系统一块屏」排期开工。</div>
    </div>

    <div class="card mt16">
      <div class="stat-strip">${statStrip()}</div>
    </div>

    <section class="card mt24">
      <div class="card-head">
        <div class="card-title">${icon('layers', 19)} 子系统接入清单
          <span class="card-sub">共 ${SCOPE.length} 个 · 一个子系统一块专属大屏</span></div>
        <div class="flex acenter gap8">
          <button class="btn btn-sm" id="btnExport">${icon('download', 16)} 导出接入清单</button>
        </div>
      </div>
      <div class="card-body" style="background:var(--surface-2);padding-top:16px">
        <div class="grid g-2">${SCOPE.map(sysCard).join('')}</div>
      </div>
    </section>`;

    bind();
  }

  function bind() {
    const be = document.getElementById('btnExport');
    be && be.addEventListener('click', () => toast('已生成《子系统接入清单》Excel（演示）', 'success'));
  }

  render();
})();
