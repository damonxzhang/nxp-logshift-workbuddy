/* ==========================================================
   邮件内容展示（仅供演示）
   此处按真实占位符渲染出「实际投递到邮箱后看到的样子」，
   alerts.html 的「邮件内容展示页」与独立页 mail.html 共用本模块。
   ========================================================== */

function mailHtml(kind) {
  if (kind === 'critical') return `
    <div class="mail-preview">
      <div class="mail-head" style="background:linear-gradient(180deg,#fdecea,#fff);border-bottom:2px solid #f6c9c6">
        <div class="flex between acenter wrap gap8">
          <div>
            <div style="font-size:19px;font-weight:700;color:#cc2f2a">【特急告警】视频监控 VMS 发生特急事件，请立即处置</div>
            <div class="small muted">发件人：${SMTP_FIXED.fromName} &lt;${SMTP_FIXED.from}&gt; · 收件人：安保部 钱志强、信息中心值班班长、分管领导</div>
          </div>
          <span class="badge b-danger">Critical</span>
        </div>
      </div>
      <div class="mail-body">
        <div class="notice" style="--nc:var(--danger)">
          ${icon('alert', 18)}
          <div><strong>事件摘要：</strong>存储节点 node-03 心跳中断，持续 12 分 36 秒，存在录像丢失风险。</div>
        </div>
        <table class="table mt16">
          <thead><tr><th>项目</th><th>内容</th></tr></thead>
          <tbody>
            <tr><td>事件编号</td><td class="num">EVT-20260923-1482</td></tr>
            <tr><td>来源子系统</td><td>视频监控 VMS（MongoDB 6.0.9）</td></tr>
            <tr><td>异常等级</td><td><span class="badge b-danger">特急 / Critical</span></td></tr>
            <tr><td>首次发生</td><td class="num">2026-09-23 14:52:07</td></tr>
            <tr><td>责任处室 / 负责人</td><td>安保部 · 钱志强</td></tr>
            <tr><td>SLA 剩余</td><td><span class="num" style="color:#cc2f2a;font-weight:700">12 分 46 秒</span></td></tr>
            <tr><td>当前处置建议</td><td>① 现场确认机柜 PDU 供电 ② 检查 node-03 硬盘指示灯 ③ 15 分钟内未恢复请升级至厂商值班电话</td></tr>
            <tr><td>现场存证</td><td>已关联 2 张现场照片（哈希指纹已登记入存证链）</td></tr>
          </tbody>
        </table>
        <div class="mt16 small muted">本邮件 Critical 事件即时单发，不受免打扰时段限制；请勿直接回复。</div>
      </div>
    </div>`;

  const online = SUBSYSTEMS.filter(s => s.status !== 'offline').length;
  const shift = new Date().getHours() < 20;
  return `
    <div class="mail-preview">
      <div class="mail-head">
        <div class="flex between acenter wrap gap8">
          <div>
            <div style="font-size:19px;font-weight:700">${fmtDateCN(new Date())} 运维运营日报（${shift ? '白班' : '晚班'}）</div>
            <div class="small muted">发件人：${SMTP_FIXED.fromName} &lt;${SMTP_FIXED.from}&gt; · 收件人：分管领导、信息中心管理层</div>
          </div>
          <span class="badge b-success">${weekCN(new Date())} ${shift ? '白班班次' : '晚班班次'}</span>
        </div>
      </div>
      <div class="mail-body">
        <div>各位领导好：</div>
        <div style="margin-top:8px">本班次（${shift ? '08:00 - 20:00' : '20:00 - 次日 08:00'}）共接入 <strong>${SUBSYSTEMS.length}</strong> 个业务子系统，在线率 <strong>${(online / SUBSYSTEMS.length * 100).toFixed(1)}%</strong>，产生异常事件 <strong>32</strong> 起，已闭环 <strong>23</strong> 起，待处置 <strong>9</strong> 起。</div>
        <div class="mail-kpi">
          <div><div class="mk-v">2</div><div class="mk-l">特急 Critical</div></div>
          <div><div class="mk-v">5</div><div class="mk-l">重要 Major</div></div>
          <div><div class="mk-v">87.2</div><div class="mk-l">平均健康度</div></div>
          <div><div class="mk-v">0</div><div class="mk-l">交接真空期</div></div>
        </div>
        <div style="font-weight:600;margin:6px 0 8px">一、子系统运行概况</div>
        <table class="table">
          <thead><tr><th>子系统</th><th>健康度</th><th>今日异常</th><th>未闭环</th><th>处置负责人</th></tr></thead>
          <tbody>
            ${SUBSYSTEMS.map(s => {
              const st = statusInfo(s.status);
              return `<tr><td>${s.name}</td>
                <td><span class="num" style="color:${st.color};font-weight:700">${s.health}</span></td>
                <td class="num">${s.status === 'critical' ? 7 : s.status === 'warn' ? 4 : 1}</td>
                <td class="num">${s.status === 'critical' || s.status === 'warn' ? 2 : 0}</td>
                <td class="small">${s.owner}</td></tr>`;
            }).join('')}
          </tbody>
        </table>
        <div style="font-weight:600;margin:16px 0 8px">二、需管理层关注事项</div>
        <div class="small" style="line-height:1.9">
          <div>1. 视频监控 VMS 存储节点 node-03 掉线（Critical），已派单安保部，SLA 剩余 12 分钟；</div>
          <div>2. 仓储管理 WMS 自研库主节点故障切换中，已临时关闭非核心写入；</div>
          <div>3. 物流调度 TMS 只读副本同步延迟 182s，DBA 已介入排查。</div>
        </div>
        <div class="mt16 small muted">本邮件由「统一监控与岗位交接中心」按模板自动生成，投递时间 08:00 / 20:00；请勿直接回复。</div>
      </div>
    </div>`;
}

/* 邮件内容展示卡片（alerts 页与 mail 页共用）
   cfg.mailTab：critical | daily */
function mailCardHtml(cfg, extraClass = '') {
  const t = MAIL_TEMPLATES[cfg.mailTab];
  return `
  <section class="card ${extraClass}">
    <div class="card-head">
      <div class="card-title">${icon('mail', 19)} 邮件内容预览
        <span class="card-sub">展示收件人在邮箱中实际看到的样子（演示用）</span></div>
      <div class="toolbar">
        ${Object.entries(MAIL_TEMPLATES).map(([k, v]) =>
    `<button class="btn btn-sm ${cfg.mailTab === k ? 'btn-primary' : ''}" data-mail="${k}">${v.name}</button>`).join('')}
        <button class="btn btn-sm" id="btnMailSim">${icon('mail', 15)} 模拟投递该封</button>
      </div>
    </div>
    <div class="card-body">
      <div class="mail-brief">
        <div><span>邮件主题</span>${t.subject}</div>
        <div><span>触发时机</span>${t.trigger}</div>
        <div><span>收件范围</span>${t.receivers}</div>
      </div>
      ${mailHtml(cfg.mailTab)}
    </div>
  </section>`;
}

function bindMailCard(cfg, rerender) {
  document.querySelectorAll('[data-mail]').forEach(el => el.addEventListener('click', () => {
    cfg.mailTab = el.dataset.mail; rerender();
  }));
  const b = document.getElementById('btnMailSim');
  b && b.addEventListener('click', () => {
    toast(cfg.mailTab === 'critical'
      ? '已投递至：安保部 钱志强、信息中心值班班长、分管领导'
      : '已投递本班次运营日报至：分管领导、信息中心管理层', 'success');
  });
}
