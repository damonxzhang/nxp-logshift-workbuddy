/* ============ 邮件内容展示页（问卷 5.1 · 仅演示） ============
   邮件正文模板写死在后端 mail-templates/*.html.hbs，
   本页只读展示「模板源码 + 渲染后的投递效果 + 投递记录」。 */
(function () {
  renderShell('mail');

  const cfg = { mailTab: store.get('mailTab', 'critical') };
  const keep = () => store.set('mailTab', cfg.mailTab);

  // 演示用投递记录（写死的样例）
  const SEND_LOG = [
    { time: '今天 08:00', kind: 'daily', subject: '2026年9月23日 运维运营日报（白班）· 在线率 91.7% · 待处置 9 项', to: '分管领导、信息中心管理层', job: 'push-daily-report（0 8,20 * * *）', state: 'success', cost: '1.2s' },
    { time: '今天 14:52', kind: 'critical', subject: '[特急告警] 视频监控 VMS 发生特急事件，请立即处置', to: '安保部 钱志强、信息中心值班班长、分管领导', job: '事件触发（即时）', state: 'success', cost: '0.6s' },
    { time: '今天 11:38', kind: 'critical', subject: '[特急告警] 仓储管理 WMS 发生特急事件，请立即处置', to: '仓储部 田守义、信息中心值班班长、分管领导', job: '事件触发（即时）', state: 'success', cost: '0.7s' },
    { time: '昨天 20:00', kind: 'daily', subject: '2026年9月22日 运维运营日报（晚班）· 在线率 100.0% · 待处置 3 项', to: '分管领导、信息中心管理层', job: 'push-daily-report（0 8,20 * * *）', state: 'success', cost: '1.1s' },
    { time: '昨天 08:00', kind: 'daily', subject: '2026年9月22日 运维运营日报（白班）· 在线率 95.8% · 待处置 5 项', to: '分管领导、信息中心管理层', job: 'push-daily-report（0 8,20 * * *）', state: 'success', cost: '1.4s' }
  ];

  function render() {
    document.getElementById('content').innerHTML = `
    <div class="notice" style="--nc:var(--primary)">
      ${icon('lock', 19)}
      <div><strong>演示说明：</strong>本系统预警<strong>仅走邮件通道（无短信）</strong>。邮件正文由后端模板引擎渲染，模板文件与 SMTP 网关参数<strong>全部写死在代码中</strong>，页面<strong>不提供在线编辑</strong>。本页仅用于向贵司演示「实际投递到邮箱里长什么样」，如需修改文案请研发调整模板后发版。</div>
    </div>

    <div class="card mt16">
      <div class="stat-strip">
        <div class="si"><div class="si-label">预警通道</div><div class="si-value">仅邮件</div></div>
        <div class="si"><div class="si-label">SMTP 网关</div><div class="si-value">${SMTP_FIXED.host}:${SMTP_FIXED.port}</div></div>
        <div class="si"><div class="si-label">发件人</div><div class="si-value">${SMTP_FIXED.from}</div></div>
        <div class="si"><div class="si-label">模板数量</div><div class="si-value">${Object.keys(MAIL_TEMPLATES).length} 套</div></div>
        <div class="si"><div class="si-label">今日已投递</div><div class="si-value">3 封</div></div>
        <div class="si"><div class="si-label">短信通道</div><div class="si-value">未启用</div></div>
      </div>
    </div>

    ${mailCardHtml(cfg, 'mt24')}

    <section class="card mt24">
      <div class="card-head">
        <div class="card-title">${icon('file', 19)} 近期邮件投递记录
          <span class="card-sub">演示样例，按写死模板与定时任务自动生成</span></div>
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
      <div class="card-foot">${icon('alert', 15)} 退信统一回收至 ${SMTP_FIXED.bounce.split('，')[0].replace('退信统一回收至 ', '')}；连续 3 次退信自动停用该收件人并产生告警。</div>
    </section>

    <div class="grid g-2 mt24">
      <section class="card">
        <div class="card-head"><div class="card-title">${icon('settings', 19)} 网关参数（写死）</div></div>
        <div class="card-body">
          <div class="fixed-kv">
            <div>网关类型</div><div>${SMTP_FIXED.type}</div>
            <div>端口 / 加密</div><div>${SMTP_FIXED.port} · ${SMTP_FIXED.ssl}</div>
            <div>认证方式</div><div>${SMTP_FIXED.auth}</div>
            <div>域名加白</div><div>${SMTP_FIXED.whitelist}</div>
            <div>发送限额</div><div>${SMTP_FIXED.limit}</div>
            <div>超时与重试</div><div>${SMTP_FIXED.timeout}</div>
          </div>
        </div>
      </section>
      <section class="card">
        <div class="card-head"><div class="card-title">${icon('alert', 19)} 如何修改邮件内容</div></div>
        <div class="card-body small" style="line-height:1.95">
          <div>1. 修改模板文件 <code>mail-templates/daily-report.html.hbs</code> / <code>critical.html.hbs</code>；</div>
          <div>2. 常量与收件人规则位于 <code>application-mail.yaml</code>（随版本发布，页面不可热改）；</div>
          <div>3. 灰度建议：先在演示 tenant 投递一次，确认排版后再切换正式 recipients；</div>
          <div>4. 预览效果以本页为准，但本页不具备「保存生效」能力，仅用于沟通确认样式。</div>
          <div class="notice mt16" style="--nc:var(--warn)">
            ${icon('alert', 17)}
            <div><strong>提示：</strong>报价/回调类敏感文案请勿写在邮箱正文中，建议改为系统内跳转链接，避免邮件泄露带来的合规风险。</div>
          </div>
        </div>
      </section>
    </div>`;

    bindMailCard(cfg, () => { keep(); render(); });
  }

  render();
})();
