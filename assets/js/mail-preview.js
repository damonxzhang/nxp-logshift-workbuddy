/* ==========================================================
   邮件内容展示（仅供演示）
   邮件正文模板写死在后端 mail-templates/*.html.hbs，
   此处仅按占位符渲染出「实际投递效果」，不提供任何在线编辑。
   alerts.html 的「后台邮件内容展示页」与独立页 mail.html 共用本模块。
   ========================================================== */

const MAIL_SOURCE_TPL = {
  critical: `# mail-templates/critical.html.hbs（后端写死模板，不支持在线编辑）
&lt;h2&gt;【{{levelText}}告警】{{subsystem}} 发生 {{levelText}} 事件，请立即处置&lt;/h2&gt;
&lt;p&gt;事件摘要：{{summary}}&lt;/p&gt;
&lt;table&gt;
  &lt;tr&gt;&lt;td&gt;事件编号&lt;/td&gt;&lt;td&gt;{{eventId}}&lt;/td&gt;&lt;/tr&gt;
  &lt;tr&gt;&lt;td&gt;来源子系统&lt;/td&gt;&lt;td&gt;{{subsystem}}（{{dbType}} {{dbVersion}}）&lt;/td&gt;&lt;/tr&gt;
  &lt;tr&gt;&lt;td&gt;异常等级&lt;/td&gt;&lt;td&gt;{{levelText}} / {{level}}&lt;/td&gt;&lt;/tr&gt;
  &lt;tr&gt;&lt;td&gt;责任处室 / 负责人&lt;/td&gt;&lt;td&gt;{{dept}} · {{owner}}&lt;/td&gt;&lt;/tr&gt;
  &lt;tr&gt;&lt;td&gt;SLA 剩余&lt;/td&gt;&lt;td&gt;{{slaRemain}}&lt;/td&gt;&lt;/tr&gt;
&lt;/table&gt;`,
  daily: `# mail-templates/daily-report.html.hbs（后端写死模板，不支持在线编辑）
&lt;h2&gt;{{date}} 运维运营日报（{{shiftName}}）&lt;/h2&gt;
&lt;p&gt;本班次共接入 {{totalSubsystems}} 个业务子系统，在线率 {{onlineRate}}，
产生异常事件 {{todayEvents}} 起，已闭环 {{closed}} 起，待处置 {{pending}} 起。&lt;/p&gt;
{{#each kpiCards}}
  &lt;div class="kpi"&gt;&lt;div&gt;{{value}}&lt;/div&gt;&lt;div&gt;{{label}}&lt;/div&gt;&lt;/div&gt;
{{/each}}
&lt;table&gt; {{#each subsystems}} &lt;tr&gt;&lt;td&gt;{{name}}&lt;/td&gt;&lt;td&gt;{{health}}&lt;/td&gt;…&lt;/tr&gt; {{/each}} &lt;/table&gt;`
};

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
            <tr><td>现场存证</td><td>已关联 2 张现场照片（SHA-256 已登记，落盘至 ${STORAGE_FIXED.server}）</td></tr>
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
  return `
  <section class="card ${extraClass}">
    <div class="card-head">
      <div class="card-title">${icon('mail', 19)} 后台邮件内容展示页
        <span class="card-sub">模板由后端渲染，此处仅做效果预览（演示用）</span></div>
      <div class="toolbar">
        ${Object.entries(MAIL_TEMPLATES).map(([k, t]) =>
    `<button class="btn btn-sm ${cfg.mailTab === k ? 'btn-primary' : ''}" data-mail="${k}">${k === 'critical' ? 'Critical 特急单发' : t.name}</button>`).join('')}
        <button class="btn btn-sm" id="btnMailSim">${icon('mail', 15)} 模拟投递该封</button>
      </div>
    </div>
    <div class="card-body">
      <div class="fixed-kv" style="margin-bottom:14px">
        <div>模板文件</div><div class="log-meta">mail-templates/${cfg.mailTab === 'critical' ? 'critical' : 'daily-report'}.html.hbs（写死）</div>
        <div>邮件主题</div><div>${MAIL_TEMPLATES[cfg.mailTab].subject}</div>
        <div>触发时机</div><div>${MAIL_TEMPLATES[cfg.mailTab].trigger}</div>
        <div>收件范围</div><div>${MAIL_TEMPLATES[cfg.mailTab].receivers}</div>
      </div>
      <div class="grid g-2 mt16" style="gap:18px">
        <div>
          <div class="small muted" style="margin-bottom:8px">① 模板源码（写死）</div>
          <div class="code-box" style="white-space:pre-wrap;font-size:13px;max-height:300px;overflow:auto">${MAIL_SOURCE_TPL[cfg.mailTab]}</div>
        </div>
        <div>
          <div class="small muted" style="margin-bottom:8px">② 渲染后的实际效果</div>
          ${mailHtml(cfg.mailTab)}
        </div>
      </div>
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
      ? '已按写死模板即时投递至：安保部 钱志强、信息中心值班班长、分管领导'
      : '已按写死模板投递本班次运营日报至：分管领导、信息中心管理层', 'success');
  });
}
