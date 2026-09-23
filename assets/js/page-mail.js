/* ============ 邮件内容展示页（问卷 5.1 · 仅演示） ============
   只读展示系统实际投递到邮箱的邮件效果与投递记录。 */
(function () {
  renderShell('mail');

  const cfg = { mailTab: store.get('mailTab', 'critical') };
  const keep = () => store.set('mailTab', cfg.mailTab);

  // 演示用投递记录
  const SEND_LOG = [
    { time: '今天 08:00', kind: 'daily', subject: '2026年9月23日 运维运营日报（白班）· 在线率 91.7% · 待处置 9 项', to: '分管领导、信息中心管理层', job: '换班定时任务（08:00）', state: 'success', cost: '1.2s' },
    { time: '今天 14:52', kind: 'critical', subject: '[特急告警] 视频监控 VMS 发生特急事件，请立即处置', to: '安保部 钱志强、信息中心值班班长、分管领导', job: '事件触发（即时）', state: 'success', cost: '0.6s' },
    { time: '今天 11:38', kind: 'critical', subject: '[特急告警] 仓储管理 WMS 发生特急事件，请立即处置', to: '仓储部 田守义、信息中心值班班长、分管领导', job: '事件触发（即时）', state: 'success', cost: '0.7s' },
    { time: '昨天 20:00', kind: 'daily', subject: '2026年9月22日 运维运营日报（晚班）· 在线率 100.0% · 待处置 3 项', to: '分管领导、信息中心管理层', job: '换班定时任务（20:00）', state: 'success', cost: '1.1s' },
    { time: '昨天 08:00', kind: 'daily', subject: '2026年9月22日 运维运营日报（白班）· 在线率 95.8% · 待处置 5 项', to: '分管领导、信息中心管理层', job: '换班定时任务（08:00）', state: 'success', cost: '1.4s' }
  ];

  function render() {
    document.getElementById('content').innerHTML = `
    <div class="notice" style="--nc:var(--primary)">
      ${icon('mail', 19)}
      <div><strong>页面说明：</strong>本系统预警<strong>仅走邮件通道（无短信）</strong>。本页用于向贵司演示「邮件实际投递到邮箱里长什么样」，上半部分是邮件正文效果，下方为近期投递记录。</div>
    </div>

    <div class="card mt16">
      <div class="stat-strip">
        <div class="si"><div class="si-label">预警通道</div><div class="si-value">仅邮件</div></div>
        <div class="si"><div class="si-label">邮件类型</div><div class="si-value">${Object.keys(MAIL_TEMPLATES).length} 类</div></div>
        <div class="si"><div class="si-label">今日已投递</div><div class="si-value">3 封</div></div>
        <div class="si"><div class="si-label">近两日投递</div><div class="si-value">5 封</div></div>
        <div class="si"><div class="si-label">投递成功率</div><div class="si-value">100%</div></div>
        <div class="si"><div class="si-label">短信通道</div><div class="si-value">未启用</div></div>
      </div>
    </div>

    ${mailCardHtml(cfg, 'mt24')}

    <section class="card mt24">
      <div class="card-head">
        <div class="card-title">${icon('file', 19)} 近期邮件投递记录
          <span class="card-sub">按特急事件与换班节点自动生成</span></div>
        <span class="badge b-success">${icon('check', 14)} 全部投递成功</span>
      </div>
      <div class="card-body" style="padding:0">
        <div style="overflow-x:auto">
        <table class="table">
          <thead><tr>
            <th>投递时间</th><th class="center">类型</th><th>邮件主题</th><th>收件范围</th><th>触发来源</th><th class="center">耗时</th><th class="center">状态</th>
          </tr></thead>
          <tbody>
            ${SEND_LOG.map(l => `
              <tr>
                <td class="small num">${l.time}</td>
                <td class="center"><span class="badge ${l.kind === 'critical' ? 'b-danger' : 'b-info'}">${l.kind === 'critical' ? '特急单发' : '运营日报'}</span></td>
                <td class="tname">${esc(l.subject)}</td>
                <td class="small">${esc(l.to)}</td>
                <td class="small muted">${esc(l.job)}</td>
                <td class="center small num">${l.cost}</td>
                <td class="center"><span class="badge b-success">已送达</span></td>
              </tr>`).join('')}
          </tbody>
        </table>
        </div>
      </div>
      <div class="card-foot">${icon('alert', 15)} 退信统一回收至运维值班邮箱；连续 3 次退信自动停用该收件人并产生告警。</div>
    </section>`;

    bindMailCard(cfg, () => { keep(); render(); });
  }

  render();
})();
