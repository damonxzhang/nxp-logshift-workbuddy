/* ============ 预警通知：邮件通道 + 语音告警 ============ */
(function () {
  renderShell('alerts');

  const S = store.get('alerts', {});
  const cfg = {
    rules: S.rules || NOTIFY_RULES.map(r => Object.assign({}, r)),
    mailTab: 'critical',
    voiceOn: S.voiceOn !== false,
    voiceGender: S.voiceGender || 'female',
    rate: S.rate || 1.1,
    volume: S.volume || 0.9,
    repeat: S.repeat || 2,
    externalSpeaker: S.externalSpeaker !== false,
    tpl: S.tpl || '请注意，{等级}告警：{系统} 出现 {事件}，请 {负责人} 立即前往处置。'
  };
  const save = () => store.set('alerts', cfg);

  function listVoices() { return window.speechSynthesis ? window.speechSynthesis.getVoices() : []; }
  function pickVoice() {
    const vs = listVoices().filter(v => /^zh/i.test(v.lang));
    if (!vs.length) return null;
    const fw = ['female', 'xiaoxiao', 'yaoyao', 'huihui', 'tingting', '女', 'xiaoyi', 'meijia'];
    const female = vs.find(v => fw.some(w => v.name.toLowerCase().includes(w)));
    const male = vs.find(v => !fw.some(w => v.name.toLowerCase().includes(w)));
    return (cfg.voiceGender === 'female' ? (female || vs[0]) : (male || vs[0])) || null;
  }
  function speak(text) {
    if (!('speechSynthesis' in window)) { toast('当前浏览器不支持语音合成，建议使用 Chrome / Edge 体验', 'warn'); return false; }
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const v = pickVoice();
      if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = 'zh-CN'; }
      u.rate = Math.max(0.5, Math.min(2, Number(cfg.rate)));
      u.volume = Math.max(0, Math.min(1, Number(cfg.volume)));
      u.pitch = cfg.voiceGender === 'female' ? 1.15 : 0.9;
      window.speechSynthesis.speak(u);
      return true;
    } catch (e) { toast('语音合成失败：' + e.message, 'danger'); return false; }
  }

  const SAMPLE = { 等级: '特急', 系统: '视频监控 VMS', 事件: '存储节点 node-03 掉线', 负责人: '安保部 钱志强' };
  const fillTpl = t => (t || cfg.tpl).replace(/\{(\w+)\}/g, (m, k) => SAMPLE[k] || `{${k}}`);
  const sampleText = () => fillTpl();

  const online = SUBSYSTEMS.filter(s => s.status !== 'offline').length;

  function render() {
    document.getElementById('content').innerHTML = `
    <div class="notice" style="--nc:var(--primary)">
      ${icon('mail', 19)}
      <div><strong>预警通道说明：</strong>本系统预警<strong>仅通过邮件发送</strong>，不含短信通道。下方「邮件内容预览」可切换查看<strong>特急单发邮件</strong>与<strong>换班运营日报邮件</strong>在收件邮箱中的实际效果。</div>
    </div>

    <div class="grid g-2 mt16">
      <section class="card">
        <div class="card-head">
          <div class="card-title">${icon('file', 19)} 邮件投递策略</div>
        </div>
        <div class="card-body">
          ${Object.entries(MAIL_TEMPLATES).map(([k, t]) => `
            <div class="choice selected" style="margin-bottom:12px;padding:14px 16px;cursor:default">
              <div class="choice-head" style="margin-bottom:6px">
                <span class="choice-radio" style="width:18px;height:18px;flex:0 0 18px"></span>
                <span class="choice-title" style="font-size:16px">${t.name}</span>
              </div>
              <div class="choice-body small">${t.trigger}<br>收件范围：${t.receivers}<br>邮件主题：${t.subject}</div>
            </div>`).join('')}
          <div class="notice mt8" style="--nc:var(--info)">
            ${icon('users', 17)}
            <div class="small">分权分发：子系统的异常仅投递至对应处室负责人邮箱；管理层额外收到全局合并视图，避免信息越级扩散。</div>
          </div>
          <div class="notice mt8" style="--nc:var(--warn)">
            ${icon('alert', 17)}
            <div class="small">特急邮件不受 23:00 - 06:30 免打扰时段限制，其余等级邮件在该时段合并，次日 08:00 随日报补发。</div>
          </div>
        </div>
      </section>

      <section class="card" style="align-self:start">
        <div class="card-head">
          <div class="card-title">${icon('activity', 19)} 邮件通道运行概览</div>
          <span class="badge b-success">${icon('check', 14)} 投递正常</span>
        </div>
        <div class="card-body">
          <div class="rowline">
            <div><div class="rl-title">通知通道</div>
              <div class="rl-desc">仅邮件发送，本期不集成短信网关</div></div>
            <span class="badge b-primary">邮件</span>
          </div>
          <div class="rowline">
            <div><div class="rl-title">今日已投递</div>
              <div class="rl-desc">特急单发 2 封 · 换班日报 1 封</div></div>
            <span class="badge b-info">3 封</span>
          </div>
          <div class="rowline">
            <div><div class="rl-title">最近一次投递</div>
              <div class="rl-desc">今天 14:52 · 视频监控 VMS 特急事件 → 安保部 钱志强</div></div>
            <span class="badge b-success">已送达</span>
          </div>
          <div class="rowline">
            <div><div class="rl-title">订阅覆盖</div>
              <div class="rl-desc">${cfg.rules.length} 个处室、${new Set(cfg.rules.map(r => r.mail)).size} 个负责人邮箱</div></div>
            <span class="badge b-neutral">${cfg.rules.length} 条规则</span>
          </div>
          <div class="rowline">
            <div><div class="rl-title">退信情况</div>
              <div class="rl-desc">连续退信 3 次自动停用收件人并产生告警</div></div>
            <span class="badge b-success">0 封</span>
          </div>
          <div class="notice mt16" style="--nc:var(--success)">
            ${icon('mail', 17)}
            <div class="small">邮件 SSL 加密传输，不携带敏感金额信息；涉及报价、回调地址等内容改为系统内跳转链接。</div>
          </div>
        </div>
      </section>
    </div>

    ${mailCardHtml(cfg, 'mt24')}

    <!-- 分处室分发 -->
    <section class="card mt24">
      <div class="card-head">
        <div class="card-title">${icon('users', 19)} 分权分处室隔离分发规则</div>
        <span class="badge b-primary">${cfg.rules.filter(r => r.enabled).length} / ${cfg.rules.length} 已启用邮件通知</span>
      </div>
      <div class="card-body" style="padding:0">
        <div style="overflow-x:auto">
        <table class="table">
          <thead><tr><th>子系统</th><th>责任处室</th><th>负责人</th><th>接收邮箱（唯一通道：邮件）</th><th>订阅级别</th><th class="center">是否联动语音告警</th><th class="center">启用</th></tr></thead>
          <tbody>
            ${cfg.rules.map((r, i) => `
              <tr>
                <td class="tname">${esc(r.sys)}</td>
                <td><span class="tag">${esc(r.dept)}</span></td>
                <td>${esc(r.to)}</td>
                <td class="small num">${esc(r.mail)}</td>
                <td><span class="badge ${/Critical/.test(r.level) ? 'b-danger' : r.level === '仅日报' ? 'b-neutral' : 'b-warn'}">${esc(r.level)}</span></td>
                <td class="center">${r.voice ? '<span class="badge b-info">终端语音播报</span>' : '<span class="muted">否</span>'}</td>
                <td class="center"><label class="switch"><input type="checkbox" data-rule="${i}" ${r.enabled ? 'checked' : ''}><span class="slider"></span></label></td>
              </tr>`).join('')}
          </tbody>
        </table>
        </div>
      </div>
      <div class="card-foot">${icon('lock', 15)} 分发规则由后端配置文件维护；处室负责人仅可见本处室子系统数据，管理层可查看全局合并视图。</div>
    </section>

    <!-- 语音播报 -->
    <div class="notice mt24" style="--nc:var(--warn)">
      ${icon('volume', 19)}
      <div><strong>调研要点（问卷 5.2）：</strong>大屏及监控室终端触发<strong>红标特急事件</strong>时，是否需要浏览器自动<strong>普通话 / 女声朗读预警</strong>？现场是否<strong>外接扬声器或音响</strong>？语速、音量是否需要开放<strong>个性化可调界面</strong>？</div>
    </div>

    <div class="grid g-2 mt16">
      <section class="card">
        <div class="card-head">
          <div class="card-title">${icon('speaker', 19)} 语音告警策略</div>
          <span class="badge ${cfg.voiceOn ? 'b-success' : 'b-neutral'}">${cfg.voiceOn ? '已启用' : '已关闭'}</span>
        </div>
        <div class="card-body">
          <div class="rowline">
            <div><div class="rl-title">红标特急事件自动语音播报</div>
              <div class="rl-desc">Critical 事件触发时，终端自动朗读告警内容（与邮件通道相互独立）</div></div>
            <label class="switch"><input type="checkbox" id="voiceOn" ${cfg.voiceOn ? 'checked' : ''}><span class="slider"></span></label>
          </div>
          <div class="rowline">
            <div><div class="rl-title">现场已外接扬声器 / 音响</div>
              <div class="rl-desc">未外接时建议使用大屏内置扬声器或值班终端提示音</div></div>
            <label class="switch"><input type="checkbox" id="externalSpeaker" ${cfg.externalSpeaker ? 'checked' : ''}><span class="slider"></span></label>
          </div>

          <div class="field-row mt16">
            <div class="field"><label class="field-label">播报音色</label>
              <select class="select" id="voiceGender">
                <option value="female" ${cfg.voiceGender === 'female' ? 'selected' : ''}>普通话 · 女声（推荐）</option>
                <option value="male" ${cfg.voiceGender === 'male' ? 'selected' : ''}>普通话 · 男声</option>
              </select></div>
            <div class="field"><label class="field-label">重复播报次数</label>
              <select class="select" id="repeat">${[1, 2, 3].map(v => `<option ${cfg.repeat == v ? 'selected' : ''}>${v} 次</option>`).join('')}</select></div>
          </div>

          <div class="field">
            <label class="field-label">播报语速 <span class="muted small" style="font-weight:400">当前 ${Number(cfg.rate).toFixed(1)}× ${Number(cfg.rate) > 1.4 ? '（偏快）' : Number(cfg.rate) < 0.8 ? '（偏慢）' : '（适中）'}</span></label>
            <input type="range" class="slider-input" id="rate" min="0.5" max="2" step="0.1" value="${cfg.rate}">
          </div>
          <div class="field">
            <label class="field-label">播报音量 <span class="muted small" style="font-weight:400">当前 ${Math.round(cfg.volume * 100)}%</span></label>
            <input type="range" class="slider-input" id="volume" min="0.1" max="1" step="0.05" value="${cfg.volume}">
          </div>

          <div class="field">
            <label class="field-label">告警播报文案模板（占位符自动替换）</label>
            <textarea class="textarea" id="tpl">${esc(cfg.tpl)}</textarea>
            <div class="field-hint">可用占位符：{等级} {系统} {事件} {负责人}</div>
          </div>

          <div class="code-box">${esc(sampleText())}</div>

          <div class="flex wrap gap8 mt16">
            <button class="btn btn-primary" id="btnPlay">${icon('volume', 17)} 立即试听告警播报</button>
            <button class="btn" id="btnEmgcy">${icon('alert', 17)} 模拟红标特急触发</button>
            <button class="btn" id="btnStop">${icon('refresh', 17)} 停止播报</button>
          </div>
          <div class="field-hint mt8">${icon('alert', 14)} 浏览器首次发声需用户主动点击一次（本页按钮已满足自动播放策略）；实际部署建议在监控室终端设置 Chrome 自动播放白名单。</div>
        </div>
      </section>

      <section class="card" style="align-self:start">
        <div class="card-head"><div class="card-title">${icon('settings', 19)} 现场环境检查与建议</div></div>
        <div class="card-body">
          <div class="rowline">
            <div><div class="rl-title">通知通道</div>
              <div class="rl-desc">仅邮件发送，本期不集成短信网关</div></div>
            <span class="badge b-primary">邮件</span>
          </div>
          <div class="rowline">
            <div><div class="rl-title">浏览器语音合成能力</div>
              <div class="rl-desc">Web Speech API（SpeechSynthesis）</div></div>
            ${('speechSynthesis' in window) ? '<span class="badge b-success">支持</span>' : '<span class="badge b-danger">不支持</span>'}
          </div>
          <div class="rowline">
            <div><div class="rl-title">中文语音包</div>
              <div class="rl-desc">${listVoices().filter(v => /^zh/i.test(v.lang)).length || '加载中…'} 个中文语音可用</div></div>
            <span class="badge ${listVoices().filter(v => /^zh/i.test(v.lang)).length ? 'b-success' : 'b-warn'}">${listVoices().filter(v => /^zh/i.test(v.lang)).length ? '可用' : '需安装'}</span>
          </div>
          <div class="rowline">
            <div><div class="rl-title">外接扬声器 / 音响</div>
              <div class="rl-desc">${cfg.externalSpeaker ? '现场已布设监控室音响' : '未外接，使用终端内置扬声器'}</div></div>
            <span class="badge ${cfg.externalSpeaker ? 'b-success' : 'b-warn'}">${cfg.externalSpeaker ? '已连接' : '未连接'}</span>
          </div>
          <div class="rowline">
            <div><div class="rl-title">夜间时段免打扰</div>
              <div class="rl-desc">23:00 - 06:30 期间仅保留 Critical 语音播报与特急邮件</div></div>
            <span class="badge b-info">已按建议配置</span>
          </div>

          <hr class="hr">
          <div class="small muted" style="line-height:1.9">
            <div><strong>部署建议：</strong></div>
            <div>1. 监控室大屏终端使用 Chrome / Edge，并将站点加入「声音自动播放」白名单；</div>
            <div>2. 特急事件建议「语音 2 次 + 大屏顶部红标横幅 + 邮件单发」三重触达；</div>
            <div>3. 语速建议 1.1×～1.3×，女声默认音调 +15%，嘈杂环境下音量不低于 80%；</div>
            <div>4. 现场音响建议独立供电，并与消防广播做优先级协商。</div>
          </div>
        </div>
      </section>
    </div>`;

    bind();
  }

  function bind() {
    const $ = id => document.getElementById(id);
    bindMailCard(cfg, render);

    const upd = (id, key, num) => { const el = $(id); el && el.addEventListener('change', e => { cfg[key] = num ? Number(e.target.value) : e.target.value; save(); render(); }); };
    upd('voiceGender', 'voiceGender'); upd('repeat', 'repeat', true); upd('tpl', 'tpl');
    const tog = (id, key) => { const el = $(id); el && el.addEventListener('change', e => { cfg[key] = e.target.checked; save(); render(); }); };
    tog('voiceOn', 'voiceOn'); tog('externalSpeaker', 'externalSpeaker');

    $('rate') && $('rate').addEventListener('input', e => { cfg.rate = Number(e.target.value); save(); });
    $('rate') && $('rate').addEventListener('change', () => render());
    $('volume') && $('volume').addEventListener('input', e => { cfg.volume = Number(e.target.value); save(); });
    $('volume') && $('volume').addEventListener('change', () => render());

    document.querySelectorAll('[data-rule]').forEach(el => el.addEventListener('change', e => {
      cfg.rules[Number(el.dataset.rule)].enabled = e.target.checked; save(); render();
    }));

    $('btnPlay') && $('btnPlay').addEventListener('click', () => {
      if (!cfg.voiceOn) { toast('语音播报当前为关闭状态，请先启用', 'warn'); return; }
      if (speak(sampleText())) toast('正在以' + (cfg.voiceGender === 'female' ? '普通话女声' : '普通话男声') + '播报告警样例', 'success');
    });
    $('btnEmgcy') && $('btnEmgcy').addEventListener('click', () => {
      if (!cfg.voiceOn) { toast('语音播报当前为关闭状态，请先启用', 'warn'); return; }
      toast(`模拟红标特急事件：${SAMPLE.系统} ${SAMPLE.事件}`, 'danger');
      if (!speak(sampleText())) return;
      for (let i = 1; i < Number(cfg.repeat); i++) setTimeout(() => speak(sampleText()), i * 3200);
    });
    $('btnStop') && $('btnStop').addEventListener('click', () => {
      window.speechSynthesis && window.speechSynthesis.cancel();
      toast('已停止播报', 'success');
    });

    if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = () => render();
  }

  render();
})();
