/* ============ 监控总览页 ============ */
(function () {
  renderShell('index');

  // —— 近 24 小时健康度 / 告警数（按当前时间滚动生成标签）
  const now = new Date();
  const labels = [], healthTrend = [], alertTrend = [];
  const base = [97, 98, 97, 96, 98, 97, 96, 95, 94, 92, 88, 87, 89, 91, 86, 84, 86, 88, 89, 90, 91, 93, 94, 95];
  const abase = [1, 0, 2, 1, 0, 1, 1, 2, 1, 4, 7, 6, 3, 5, 8, 9, 6, 4, 3, 2, 2, 1, 1, 0];
  for (let i = 23; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 3600 * 1000);
    labels.push(pad(d.getHours()) + ':00');
    healthTrend.push(base[23 - i]);
    alertTrend.push(abase[23 - i]);
  }

  const online = SUBSYSTEMS.filter(s => s.status !== 'offline').length;
  const avgHealth = Math.round(SUBSYSTEMS.filter(s => s.health > 0).reduce((a, b) => a + b.health, 0) / SUBSYSTEMS.filter(s => s.health > 0).length * 10) / 10;
  const abnormal = SUBSYSTEMS.filter(s => s.status === 'warn' || s.status === 'critical').length;

  const KPIS = [
    { name: '接入子系统总数', value: SUBSYSTEMS.length, unit: '个', foot: `核心 ${SUBSYSTEMS.filter(s => s.cat === '核心').length} · 外围 ${SUBSYSTEMS.filter(s => s.cat === '外围').length}`, icon: 'layers', color: '#1d4ed8', soft: '#e7eeff' },
    { name: '系统在线率', value: (online / SUBSYSTEMS.length * 100).toFixed(1), unit: '%', foot: `${online}/${SUBSYSTEMS.length} 在线 · 异常 ${abnormal} 个`, icon: 'wifi', color: '#12805a', soft: '#e3f6ee' },
    { name: '今日异常事件', value: 32, unit: '起', foot: '特急 2 · 重要 5 · 一般 25', icon: 'alert', color: '#cc2f2a', soft: '#fdecea' },
    { name: '待处置待办', value: 9, unit: '项', foot: '其中 2 项已超时（>30 分钟）', icon: 'file', color: '#a8620b', soft: '#fdf1e0' },
    { name: '平均健康度', value: avgHealth, unit: '分', foot: '较昨日同时段 +1.6 分', icon: 'activity', color: '#0b6a86', soft: '#e2f3f9' },
    { name: '交接真空期风险', value: '中', unit: '', foot: '距下次换班 4 小时 23 分', icon: 'users', color: '#8b5cf6', soft: '#f1ebfe' }
  ];

  const levelDist = [
    { label: '特急 / Critical', value: 2, color: '#cc2f2a' },
    { label: '重要 / Major', value: 5, color: '#e0912a' },
    { label: '一般 / Minor', value: 16, color: '#1d4ed8' },
    { label: '提示 / Info', value: 9, color: '#0b6a86' }
  ];

  // —— 交接态势
  const nextShiftStart = new Date(now);
  nextShiftStart.setHours(now.getHours() < 20 ? 20 : 32, 0, 0, 0);
  if (now.getHours() >= 20) nextShiftStart.setDate(nextShiftStart.getDate() + 1), nextShiftStart.setHours(8, 0, 0, 0);
  const minsToShift = Math.round((nextShiftStart - now) / 60000);
  const gapText = minsToShift > 60 ? `${Math.floor(minsToShift / 60)} 小时 ${minsToShift % 60} 分` : `${minsToShift} 分钟`;

  document.getElementById('content').innerHTML = `
  <div class="grid g-6">
    ${KPIS.map(k => `
      <div class="kpi" style="--accent:${k.color};--accent-soft:${k.soft}">
        <div class="kpi-top">
          <span class="kpi-name">${k.name}</span>
          <span class="kpi-icon">${icon(k.icon, 20)}</span>
        </div>
        <div class="kpi-value">${k.value}<span class="kpi-unit">${k.unit}</span></div>
        <div class="kpi-foot">${k.foot}</div>
      </div>`).join('')}
  </div>

  <div class="grid g-23 mt24">
    <section class="card">
      <div class="card-head">
        <div class="card-title">${icon('activity', 19)} 近 24 小时健康度趋势
          <span class="card-sub">每分钟自动刷新 · 数据取自健康度得分换算任务</span>
        </div>
        <div class="legend">
          <span><i style="background:#1d4ed8"></i>综合健康度</span>
          <span><i style="background:#e0912a"></i>告警事件数</span>
        </div>
      </div>
      <div class="card-body">
        <div id="healthChart"></div>
      </div>
    </section>

    <section class="card">
      <div class="card-head"><div class="card-title">${icon('alert', 19)} 今日异常等级分布</div></div>
      <div class="card-body center">
        <div id="levelDonut" style="display:flex;justify-content:center"></div>
        <div class="mt8">
          ${levelDist.map(l => `<div class="flex between" style="padding:5px 4px;border-bottom:1px dashed var(--border)">
            <span class="flex acenter gap8 small"><i style="width:11px;height:11px;border-radius:3px;background:${l.color};display:inline-block"></i>${l.label}</span>
            <span class="num" style="font-weight:700">${l.value}</span></div>`).join('')}
        </div>
      </div>
    </section>
  </div>

  <div class="grid g-23 mt24">
    <section class="card">
      <div class="card-head">
        <div class="card-title">${icon('server', 19)} 子系统实时状态
          <span class="card-sub">共 ${SUBSYSTEMS.length} 个已并联接入</span>
        </div>
        <a class="btn btn-sm" href="systems.html">查看全部与底座清单 ${icon('arrowRight', 15)}</a>
      </div>
      <div class="card-body" style="padding:0">
        <div style="overflow-x:auto">
        <table class="table">
          <thead><tr>
            <th>子系统</th><th>类别</th><th>数据库底座</th><th>接口能力</th>
            <th style="width:150px">健康度</th><th>状态</th><th>负责人</th>
          </tr></thead>
          <tbody>
            ${SUBSYSTEMS.map(s => {
              const st = statusInfo(s.status);
              return `<tr>
                <td><div class="tname">${s.name}</div><div class="tsub">ID：${s.id} · 采集模式 ${s.mode}</div></td>
                <td><span class="tag">${s.cat}</span></td>
                <td>${s.db} <span class="tsub">${s.ver}</span></td>
                <td>${s.api}</td>
                <td>
                  <div class="flex acenter gap8">
                    <div class="progress" style="flex:1"><i style="width:${s.health}%;background:${st.color}"></i></div>
                    <span class="num small" style="width:34px;text-align:right;font-weight:600">${s.health}</span>
                  </div>
                </td>
                <td><span class="badge ${st.cls}">${st.label}</span></td>
                <td class="small">${s.owner}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
        </div>
      </div>
    </section>

    <div style="display:flex;flex-direction:column;gap:18px">
      <section class="card">
        <div class="card-head">
          <div class="card-title">${icon('users', 19)} 白晚班交接态势</div>
          <span class="badge b-warn">风险 中</span>
        </div>
        <div class="card-body">
          <div class="rowline">
            <div><div class="rl-title">${currentShift()[0]}（${currentShift()[1]}）</div>
              <div class="rl-desc">当前值班：张卫东 · 值班班长</div></div>
            <span class="badge b-primary">进行中</span>
          </div>
          <div class="rowline">
            <div><div class="rl-title">距下次换班</div>
              <div class="rl-desc">${fmtDT(nextShiftStart).slice(11, 16)} ${now.getHours() < 20 ? '（白→晚）' : '（晚→白）'}</div></div>
            <span class="num" style="font-size:19px;font-weight:700">${gapText}</span>
          </div>
          <div class="rowline">
            <div><div class="rl-title">未闭环事项</div>
              <div class="rl-desc">需在换班前闭环或书面顺延</div></div>
            <span class="badge b-danger">9 项</span>
          </div>
          <div class="rowline">
            <div><div class="rl-title">上次交接责任书</div>
              <div class="rl-desc">HO-20260923-01 · 已双签确认</div></div>
            <span class="badge b-success">无真空期</span>
          </div>
          <div class="flex gap8 mt16">
            <button class="btn btn-primary" id="btnGenHandover">${icon('download', 17)} 生成交接单</button>
            <a class="btn" href="evidence.html">上传现场存证</a>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="card-head">
          <div class="card-title">${icon('bell', 19)} 最新告警处置流水</div>
          <div class="toolbar">
            <span class="sub-note">语音播报可在右上角开关</span>
            <a class="btn btn-sm" href="alerts.html">通知配置</a>
          </div>
        </div>
        <div class="card-body">
          <div class="timeline">
            ${ALERT_FEED.map((a, i) => {
              const st = statusInfo(a.level === 'critical' ? 'critical' : a.level === 'warn' ? 'warn' : 'normal');
              return `<div class="tl-item" style="--tl:${st.color}">
                <div class="flex between acenter gap8">
                  <span class="tl-title">${a.title}</span>
                  <span class="flex acenter gap8">
                    <button class="btn btn-sm btn-ghost" data-say="${i}" title="语音播报该条告警">${icon('volume', 16)}</button>
                    <span class="badge ${st.cls}">${a.level === 'critical' ? '特急' : a.level === 'warn' ? '重要' : '已恢复'}</span>
                  </span>
                </div>
                <div class="tl-time">${a.time} · ${a.sys} · ${a.handler}</div>
              </div>`;
            }).join('')}
          </div>
        </div>
      </section>
    </div>
  </div>`;

  lineChart(document.getElementById('healthChart'), {
    labels,
    height: 250,
    min: 0, max: 100,
    series: [
      { data: healthTrend, color: '#1d4ed8', fill: true },
      { data: alertTrend.map(v => Math.min(100, v * 10)), color: '#e0912a' }
    ]
  });
  donut(document.getElementById('levelDonut'), levelDist, 200, 32, '今日事件总数');

  const b = document.getElementById('btnGenHandover');
  if (b) b.onclick = () => toast('已生成交接单 HO-20260923-02，含 9 项未闭环事项', 'success');

  document.querySelectorAll('[data-say]').forEach(el => el.onclick = () => {
    const a = ALERT_FEED[Number(el.dataset.say)];
    Voice.speak(`${a.level === 'critical' ? '特急告警' : '告警'}：${a.sys}，${a.title}，${a.handler}。`);
  });
})();
