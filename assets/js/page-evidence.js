/* ============ P1 专属大屏：生产交易日志看板（岗位交接） ============ */
(function () {
  renderShell('evidence');

  let docs = JSON.parse(JSON.stringify(HANDOVER_DOCS));

  function render() {
    /* —— 重点关注事项（置顶：待处理 / 异常 / 逾期 / 关键词命中） —— */
    const prioPending = docs.filter(d => d.pending > 0).map(d => ({
      title: `${d.id} 存在未闭环事项 ${d.pending} 项`,
      meta: `${d.from} → ${d.to} · ${d.note}`, badge: '未闭环', badgeCls: 'b-warn', hot: d.critical > 0
    }));

    const prioAbn = docs.filter(d => d.critical > 0).map(d => ({
      title: `${d.id} 含特急未闭环 ${d.critical} 项`, meta: d.note, badge: '特急', badgeCls: 'b-danger', hot: true
    }));

    const prioOver = docs.filter(d => !d.sign).map(d => ({
      title: `${d.id} 未完成认领签章`, meta: `${d.from} → ${d.to} · ${d.gap} · 逾期未签即形成责任悬空`, badge: '逾期', badgeCls: 'b-danger', hot: true
    }));

    const kwTotal = KEYWORDS_SEED.filter(k => k.enabled).reduce((a, k) => a + (k.hits || 0), 0);
    const prioKw = KEYWORDS_SEED.filter(k => k.enabled && k.hits > 0).sort((a, b) => b.hits - a.hits).slice(0, 5).map(k => ({
      title: `「${k.word.includes('|') ? k.word.split('|')[0] + ' 等多词' : k.word}」今日命中 ${k.hits} 条生产日志`,
      meta: `${k.note} · 匹配方式：${k.match}`, badge: k.level, badgeCls: k.level === '特急' ? 'b-danger' : 'b-warn', hot: k.level === '特急'
    }));

    const PRIO = prioBand([
      { key: 'pending', cls: 'p-attend', icon: 'file', label: '待处理', count: prioPending.length, unit: ' 项', sub: '交接单未闭环事项', items: prioPending },
      { key: 'abn', cls: 'p-abn', icon: 'zap', label: '异常', count: prioAbn.length, unit: ' 项', sub: '特急事项需优先处置', items: prioAbn },
      { key: 'over', cls: 'p-over', icon: 'clock', label: '逾期', count: prioOver.length, unit: ' 单', sub: '未签章交接单 · 已产生真空期', items: prioOver },
      { key: 'kw', cls: 'p-kw', icon: 'search', label: '关键词命中', count: kwTotal, unit: ' 条', sub: '今日命中告警关键词库的生产日志', items: prioKw }
    ]);

    document.getElementById('content').innerHTML = `
    ${PRIO}

    <div class="notice mt16" style="--nc:var(--primary)">
      ${icon('image', 19)}
      <div><strong>P1 专属大屏 · 生产交易日志看板：</strong>对应客户原始需求表第 1 项，在现有交接日志系统基础上升级——支持<strong>关键词检索</strong>、<strong>导出并发送邮件</strong>；本屏自带<strong>预警组件</strong>（阈值/周期/系数可配，触发后屏幕变红 + 强制弹窗 + 语音播报）与<strong>邮件组件</strong>，均为各屏复用能力。<br>
      <strong>FLT 批次、紧急批字段的取值规则待 09-29 与客户确认。</strong></div>
    </div>

    <div class="card mt16">
      <div class="card-head">
        <div class="card-title">${icon('layers', 19)} 本屏标配能力
          <span class="card-sub">每块专属大屏均自带，作为统一组件复用</span></div>
      </div>
      <div class="card-body flex gap16" style="flex-wrap:wrap">
        <a class="chip" href="alerts.html">${icon('bell', 16)} 预警组件 · 阈值 / 强制弹窗 / 语音</a>
        <a class="chip" href="mail.html">${icon('mail', 16)} 邮件组件 · 告警邮件与导出发送</a>
        <a class="chip" href="wall.html">${icon('layers', 16)} 加入监控室轮播</a>
        <span class="chip">${icon('clock', 16)} 数据刷新：手动 + 可配置周期</span>
      </div>
    </div>

    <!-- 岗位交接 -->
    <section class="card mt16">
      <div class="card-head">
        <div class="card-title">${icon('users', 19)} 白晚班交接单据与责任书认领
          <span class="card-sub">认领后即形成书面责任转移，并记录操作人与时间戳</span></div>
        <button class="btn btn-primary btn-sm" id="btnNewHandover">${icon('plus', 15)} 新建交接单</button>
      </div>
      <div class="card-body" style="padding:0">
        <div style="overflow-x:auto">
        <table class="table">
          <thead><tr>
            <th>单据编号</th><th>交接区间</th><th>交接时间</th><th class="center">附件</th>
            <th class="center">未闭环</th><th class="center">特急</th><th>交接说明</th><th>真空期</th><th class="center">责任书</th>
          </tr></thead>
          <tbody>
            ${docs.map((d, i) => `
              <tr>
                <td class="tname">${d.id}</td>
                <td class="small">${d.from} <span class="muted">→</span> ${d.to}</td>
                <td class="small num">${d.time}</td>
                <td class="center">${d.attachments} 张</td>
                <td class="center">${d.pending ? `<span class="badge b-warn">${d.pending}</span>` : '<span class="muted">0</span>'}</td>
                <td class="center">${d.critical ? `<span class="badge b-danger">${d.critical}</span>` : '<span class="muted">0</span>'}</td>
                <td class="small">${d.note}</td>
                <td><span class="badge ${d.gap === '无真空期' ? 'b-success' : 'b-warn'}">${d.gap}</span></td>
                <td class="center">${d.sign
      ? `<span class="badge b-success">已双签</span>`
      : `<button class="btn btn-sm btn-primary" data-sign="${i}">认领并签章</button>`}</td>
              </tr>`).join('')}
          </tbody>
        </table>
        </div>
      </div>
      <div class="card-foot">${icon('alert', 15)} 存在未闭环事项或未签章的交接单，系统将在换班前 10 分钟触发「交接真空期」研判并推送语音告警。</div>
    </section>`;

    bind();
  }

  function bind() {
    document.querySelectorAll('[data-sign]').forEach(b => b.addEventListener('click', () => {
      const i = Number(b.dataset.sign);
      docs[i].sign = true;
      toast(`交接单 ${docs[i].id} 已完成认领签章，责任转移至 ${docs[i].to}`, 'success');
      render();
    }));

    const bn = document.getElementById('btnNewHandover');
    bn && bn.addEventListener('click', () => toast('已创建交接单 HO-20260923-02，等待晚班班长签章确认', 'success'));
  }

  render();
})();
