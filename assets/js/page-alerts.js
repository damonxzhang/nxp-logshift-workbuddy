/* ============ 预警通知：关键词联动 + 邮件通道 + 语音播报 ============ */
(function () {
  renderShell('alerts');

  const clone = o => JSON.parse(JSON.stringify(o));

  /* ---------------- 关键词联动数据（客户可自行维护） ---------------- */
  const K = store.get('keywordCfg', null) || {};
  if (!Array.isArray(K.contacts)) K.contacts = clone(CONTACTS_SEED);
  if (!Array.isArray(K.keywords)) K.keywords = clone(KEYWORDS_SEED);
  if (!Array.isArray(K.bindings)) K.bindings = clone(BINDINGS_SEED);
  const saveK = () => store.set('keywordCfg', K);

  const nextId = (prefix, list) => {
    let i = list.length + 1;
    while (list.some(x => x.id === prefix + String(i).padStart(2, '0'))) i++;
    return prefix + String(i).padStart(2, '0');
  };

  /* ---------------- 其它演示开关 ---------------- */
  const S = store.get('alerts', {});
  const cfg = {
    rules: S.rules || NOTIFY_RULES.map(r => Object.assign({}, r)),
    mailTab: 'critical',
    tpl: S.tpl || '紧急告警：{系统} 发生 {事件}，命中关键词「{关键词}」，请 {负责人} 立即处置。'
  };
  const save = () => store.set('alerts', { tpl: cfg.tpl, trialText: trial.text });

  const V = Voice.cfg;

  const trial = {
    text: S.trialText || '视频监控存储节点 node-03 掉线，心跳中断已持续 12 分钟',
    sysId: 'VMS',
    result: null
  };

  const SAMPLE = { 系统: '视频监控 VMS', 事件: '存储节点 node-03 掉线', 负责人: '安保部 钱志强', 关键词: '掉线' };
  const fillTpl = t => (t || cfg.tpl).replace(/\{(\w+)\}/g, (m, k) => SAMPLE[k] || `{${k}}`);
  const sampleText = () => fillTpl();

  const sysName = id => id === 'ALL' ? '全部子系统' : (SUBSYSTEMS.find(s => s.id === id) || { name: id }).name;
  const kwWord = id => (K.keywords.find(k => k.id === id) || { word: id }).word;
  const ctName = id => (K.contacts.find(c => c.id === id) || { name: id, dept: '—' }).name;
  const kwLevel = id => (K.keywords.find(k => k.id === id) || {}).level === '特急';
  const kwLevelChip = id => kwLevel(id) ? 'danger' : 'warn';
  const optsSel = (list, cur) => list.map(v => `<option ${v === cur ? 'selected' : ''}>${v}</option>`).join('');

  /* ================= 试算结果 ================= */
  function trialHtml() {
    const r = trial.result;
    if (!r) return `
      <div class="result-box ok">
        <div class="result-line"><span class="rl-k">当前状态</span>
          <span class="small muted">填写左侧异常描述，点击「匹配并派发」查看会命中哪些关键词、通知到哪些紧急联系人。</span></div>
      </div>`;

    if (!r.hits.length) return `
      <div class="result-box">
        <div class="result-line"><span class="rl-k">匹配结果</span><span class="badge b-neutral">未命中关键词</span></div>
        <div class="result-line"><span class="rl-k">处理方式</span><span class="small">按普通告警记录，随当日运营日报汇总发出，不触发紧急邮件与语音播报。</span></div>
      </div>`;

    const hl = kwHighlight(trial.text, r.hits);
    return `
      <div class="result-box ${r.level === '特急' ? 'danger' : ''}">
        <div class="result-line"><span class="rl-k">异常等级</span>
          <span class="badge ${r.level === '特急' ? 'b-danger' : 'b-warn'}">升级为「${r.level}」紧急邮件</span></div>
        <div class="result-line"><span class="rl-k">原文命中</span><div class="small" style="line-height:1.8">${hl}</div></div>
        <div class="result-line"><span class="rl-k">命中关键词</span><div class="chips">
          ${r.hits.map(k => `<span class="chip ${k.level === '特急' ? 'danger' : 'warn'}">${esc(k.word)}<span class="sub-note">${esc(k.match)}</span></span>`).join('')}
        </div></div>
        <div class="result-line"><span class="rl-k">生效绑定</span><div class="chips">
          ${r.bindings.length ? r.bindings.map(b => `<span class="chip success">${esc(b.name)}</span>`).join('') : '<span class="muted small">无匹配绑定，需先配置</span>'}
        </div></div>
        <div class="result-line"><span class="rl-k">收件人</span><div style="flex:1">
          ${r.receivers.length ? `
            <table class="table" style="margin:0">
              <thead><tr><th>姓名</th><th>处室</th><th>邮箱</th><th class="center">接收级别</th></tr></thead>
              <tbody>${r.receivers.map(c => `<tr>
                <td class="tname">${esc(c.name)}</td><td class="small">${esc(c.dept)}</td>
                <td class="small num">${esc(c.mail)}</td>
                <td class="center"><span class="chip">${esc(c.level)}</span></td></tr>`).join('')}</tbody>
            </table>` : '<span class="muted small">绑定规则未关联到任何启用中的联系人</span>'}
        </div></div>
        <div class="flex wrap gap8 mt16">
          <button class="btn btn-primary btn-sm" id="btnSpeakTrial">${icon('volume', 15)} 语音播报这条告警</button>
          <button class="btn btn-sm" id="btnViewMail">${icon('mail', 15)} 查看邮件效果</button>
        </div>
      </div>`;
  }

  /* ================= 页面 ================= */
  function render() {
    document.getElementById('content').innerHTML = `
    <div class="notice" style="--nc:var(--primary)">
      ${icon('mail', 19)}
      <div><strong>预警通道说明：</strong>本系统预警<strong>仅通过邮件发送</strong>，不含短信通道。异常命中<strong>关键词</strong>后即判定为<strong>紧急邮件</strong>，按「关键词 × 子系统 × 紧急联系人」的绑定关系即时投递；<strong>语音播报由右上角总开关控制</strong>，可随时开启或关闭。</div>
    </div>

    <div class="notice mt16" style="--nc:var(--warn)">
      ${icon('key', 19)}
      <div><strong>关键词 × 子系统 × 紧急联系人（多对多，客户自助配置）：</strong>关键词库与紧急联系人均可自助增删改，三者自由绑定——同一关键词可绑多个子系统与多个联系人，一个联系人也可承接多个关键词。</div>
    </div>

    <div class="grid g-2 mt16">
      <section class="card">
        <div class="card-head">
          <div class="card-title">${icon('users', 19)} 紧急联系人
            <span class="card-sub">命中关键词时的收件人</span></div>
          <div class="toolbar">
            <span class="badge b-primary">${K.contacts.filter(c => c.enabled).length} / ${K.contacts.length} 启用</span>
            <button class="btn btn-sm btn-primary" id="btnNewContact">${icon('plus', 15)} 新增联系人</button>
          </div>
        </div>
        <div class="card-body" style="padding:0">
          <div style="overflow-x:auto;max-height:430px;overflow-y:auto">
          <table class="table">
            <thead style="position:sticky;top:0;z-index:2"><tr>
              <th>姓名</th><th>处室</th><th>角色</th><th>接收邮箱</th><th class="center">接收级别</th><th class="center">启用</th><th class="center">操作</th>
            </tr></thead>
            <tbody>
              ${K.contacts.map((c, i) => `
                <tr>
                  <td class="tname">${esc(c.name)}</td>
                  <td><span class="tag">${esc(c.dept)}</span></td>
                  <td class="small">${esc(c.role)}</td>
                  <td class="small num">${esc(c.mail)}</td>
                  <td class="center"><span class="chip ${c.level === '仅特急' ? 'danger' : c.level === '全部' ? 'info' : 'warn'}">${esc(c.level)}</span></td>
                  <td class="center"><label class="switch"><input type="checkbox" data-ct="${i}" ${c.enabled ? 'checked' : ''}><span class="slider"></span></label></td>
                  <td class="center">
                    <button class="btn btn-sm btn-ghost" data-ctedit="${i}" title="编辑">${icon('settings', 16)}</button>
                    <button class="btn btn-sm btn-ghost" data-ctdel="${i}" title="删除">${icon('trash', 16)}</button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
          </div>
        </div>
        <div class="card-foot">${icon('alert', 15)} 「仅特急」联系人只在紧急邮件时收信，「全部」则同时接收常规告警。</div>
      </section>

      <section class="card">
        <div class="card-head">
          <div class="card-title">${icon('key', 19)} 关键词库
            <span class="card-sub">命中即升级为紧急邮件</span></div>
          <div class="toolbar">
            <span class="badge b-danger">${K.keywords.filter(k => k.enabled && k.level === '特急').length} 个特急</span>
            <button class="btn btn-sm btn-primary" id="btnNewKw">${icon('plus', 15)} 新增关键词</button>
          </div>
        </div>
        <div class="card-body" style="padding:0">
          <div style="overflow-x:auto;max-height:430px;overflow-y:auto">
          <table class="table">
            <thead style="position:sticky;top:0;z-index:2"><tr>
              <th>关键词 / 表达式</th><th class="center">匹配方式</th><th class="center">等级</th>
              <th class="center">跳过免打扰</th><th class="center">今日命中</th><th class="center">启用</th><th class="center">操作</th>
            </tr></thead>
            <tbody>
              ${K.keywords.map((k, i) => `
                <tr>
                  <td><div class="tname" style="font-size:14.5px">${esc(k.word)}</div><div class="tsub">${esc(k.note || '')}</div></td>
                  <td class="center"><span class="chip lang">${esc(k.match)}</span></td>
                  <td class="center"><span class="badge ${k.level === '特急' ? 'b-danger' : 'b-warn'}">${esc(k.level)}</span></td>
                  <td class="center">${k.dnd ? '<span class="chip success">是</span>' : '<span class="muted">否</span>'}</td>
                  <td class="center num">${k.hits || 0}</td>
                  <td class="center"><label class="switch"><input type="checkbox" data-kw="${i}" ${k.enabled ? 'checked' : ''}><span class="slider"></span></label></td>
                  <td class="center">
                    <button class="btn btn-sm btn-ghost" data-kwedit="${i}" title="编辑">${icon('settings', 16)}</button>
                    <button class="btn btn-sm btn-ghost" data-kwdel="${i}" title="删除">${icon('trash', 16)}</button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
          </div>
        </div>
        <div class="card-foot">${icon('zap', 15)} 「多词任一」以竖线 <code>|</code> 分隔多个词，「正则」直接填表达式，例如 <code>^\s*(越权|提权)</code>。</div>
      </section>
    </div>

    <section class="card mt24">
      <div class="card-head">
        <div class="card-title">${icon('layers', 19)} 多对多绑定关系
          <span class="card-sub">关键词 × 子系统 × 紧急联系人</span></div>
        <div class="toolbar">
          <span class="badge b-info">${K.bindings.filter(b => b.enabled).length} / ${K.bindings.length} 条生效</span>
          <button class="btn btn-sm btn-primary" id="btnNewBind">${icon('plus', 15)} 新增绑定</button>
        </div>
      </div>
      <div class="card-body" style="padding:0">
        <div style="overflow-x:auto">
        <table class="table">
          <thead><tr><th style="width:170px">绑定名称</th><th>关键词</th><th>子系统</th><th>紧急联系人</th><th class="center">组合数</th><th class="center">启用</th><th class="center">操作</th></tr></thead>
          <tbody>
            ${K.bindings.length ? K.bindings.map((b, i) => `
              <tr>
                <td><div class="tname" style="font-size:14.5px">${esc(b.name)}</div><div class="tsub">${b.id}</div></td>
                <td><div class="chips">${b.kws.length ? b.kws.map(k => `<span class="chip ${kwLevelChip(k)}">${esc(kwWord(k))}</span>`).join('') : '<span class="muted small">未选择</span>'}</div></td>
                <td><div class="chips">${b.sys.map(s => `<span class="chip">${esc(sysName(s))}</span>`).join('') || '<span class="muted small">未选择</span>'}</div></td>
                <td><div class="chips">${b.contacts.map(c => `<span class="chip info">${esc(ctName(c))}</span>`).join('') || '<span class="muted small">未选择</span>'}</div></td>
                <td class="center num">${bindingCoverage(b)}</td>
                <td class="center"><label class="switch"><input type="checkbox" data-bd="${i}" ${b.enabled ? 'checked' : ''}><span class="slider"></span></label></td>
                <td class="center">
                  <button class="btn btn-sm btn-ghost" data-bdedit="${i}" title="编辑">${icon('settings', 16)}</button>
                  <button class="btn btn-sm btn-ghost" data-bddel="${i}" title="删除">${icon('trash', 16)}</button>
                </td>
              </tr>`).join('') : `<tr><td colspan="7" class="center muted" style="padding:30px">暂无绑定关系，点击右侧「新增绑定」开始配置</td></tr>`}
          </tbody>
        </table>
        </div>
      </div>
      <div class="card-foot">${icon('activity', 15)} 一条绑定即一个笛卡尔积：任一关键词在该子系统上被命中，就向列表内全部紧急联系人发出紧急邮件。</div>
    </section>

    <section class="card mt24">
      <div class="card-head">
        <div class="card-title">${icon('search', 19)} 命中试算与投递演练
          <span class="card-sub">输入一条异常描述，看看它会发给谁</span></div>
        <div class="toolbar">
          <button class="btn btn-sm btn-primary" id="btnTrial">${icon('zap', 15)} 匹配并派发</button>
        </div>
      </div>
      <div class="card-body">
        <div class="grid g-2" style="gap:20px">
          <div>
            <div class="field">
              <label class="field-label">异常描述</label>
              <textarea class="textarea" id="trialText" style="min-height:110px" placeholder="粘贴一条子系统异常告警内容">${esc(trial.text)}</textarea>
            </div>
            <div class="field">
              <label class="field-label">来源子系统</label>
              <select class="select" id="trialSys">
                ${SUBSYSTEMS.map(s => `<option value="${s.id}" ${trial.sysId === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
              </select>
            </div>
            <div class="small muted" style="line-height:2">
              样例快速试算：<br>
              ${['支付渠道中断，支付失败率升至 18%', '核心交换机主备切换失败，链路中断', 'AGV 停摆导致拣货阻塞，作业中断', '晚班例行演练，请忽略']
      .map(t => `<button class="link-btn" data-trial="${esc(t)}">${esc(t)}</button>`).join('<br>')}
            </div>
          </div>
          <div>${trialHtml()}</div>
        </div>
      </div>
    </section>

    <div class="grid g-2 mt24">
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
            <div class="small">标记「跳过免打扰」的关键词在 23:00 - 06:30 仍会即时投递，其余等级邮件在该时段合并，次日 08:00 随日报补发。</div>
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
            <div><div class="rl-title">紧急联系人</div>
              <div class="rl-desc">${K.contacts.filter(c => c.enabled).length} 人在线，覆盖 ${K.bindings.filter(b => b.enabled).length} 条绑定规则</div></div>
            <span class="badge b-neutral">${K.contacts.length} 人已登记</span>
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
          <thead><tr><th>子系统</th><th>责任处室</th><th>负责人</th><th>接收邮箱（唯一通道：邮件）</th><th>订阅级别</th><th class="center">语音告警</th><th class="center">启用</th></tr></thead>
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
      <div class="card-foot">${icon('lock', 15)} 处室负责人仅可见本处室子系统数据，管理层可查看全局合并视图。</div>
    </section>

    <!-- 语音播报 -->
    <div class="notice mt24" style="--nc:var(--warn)">
      ${icon('volume', 19)}
      <div><strong>调研要点（问卷 5.2）：</strong>大屏及监控室终端触发<strong>红标特急事件</strong>时，是否需要浏览器自动<strong>普通话 / 女声朗读预警</strong>？现场是否<strong>外接扬声器或音响</strong>？语速、音量是否开放<strong>个性化可调界面</strong>？</div>
    </div>

    <div class="grid g-2 mt16">
      <section class="card">
        <div class="card-head">
          <div class="card-title">${icon('speaker', 19)} 语音告警策略</div>
          <span class="badge ${V.on ? 'b-success' : 'b-neutral'}">${V.on ? '已启用' : '已关闭'}</span>
        </div>
        <div class="card-body">
          <div class="rowline">
            <div><div class="rl-title">语音播报总开关</div>
              <div class="rl-desc">与页面右上角开关实时联动；关闭后告警仅通过邮件通知</div></div>
            <label class="switch"><input type="checkbox" id="voiceOn" ${V.on ? 'checked' : ''}><span class="slider"></span></label>
          </div>
          <div class="rowline">
            <div><div class="rl-title">现场已外接扬声器 / 音响</div>
              <div class="rl-desc">未外接时建议使用大屏内置扬声器或值班终端提示音</div></div>
            <label class="switch"><input type="checkbox" id="externalSpeaker" ${V.external ? 'checked' : ''}><span class="slider"></span></label>
          </div>

          <div class="field mt16">
            <label class="field-label">哪些事件需要语音播报</label>
            <label class="checkline"><input type="checkbox" id="srcKeyword" ${V.sources.includes('keyword') ? 'checked' : ''}><span>命中关键词的紧急事件（含绑定规则命中的联系人）</span></label>
            <label class="checkline"><input type="checkbox" id="srcCritical" ${V.sources.includes('critical') ? 'checked' : ''}><span>子系统上报的红标特急（Critical）告警</span></label>
          </div>

          <div class="field-row">
            <div class="field"><label class="field-label">播报音色</label>
              <select class="select" id="voiceGender">
                <option value="female" ${V.gender === 'female' ? 'selected' : ''}>普通话 · 女声（推荐）</option>
                <option value="male" ${V.gender === 'male' ? 'selected' : ''}>普通话 · 男声</option>
              </select></div>
            <div class="field"><label class="field-label">重复播报次数</label>
              <select class="select" id="repeat">${[1, 2, 3].map(v => `<option ${V.repeat == v ? 'selected' : ''}>${v} 次</option>`).join('')}</select></div>
          </div>

          <div class="field">
            <label class="field-label">播报语速 <span class="muted small" style="font-weight:400">当前 ${Number(V.rate).toFixed(1)}× ${Number(V.rate) > 1.4 ? '（偏快）' : Number(V.rate) < 0.8 ? '（偏慢）' : '（适中）'}</span></label>
            <input type="range" class="slider-input" id="rate" min="0.5" max="2" step="0.1" value="${V.rate}">
          </div>
          <div class="field">
            <label class="field-label">播报音量 <span class="muted small" style="font-weight:400">当前 ${Math.round(V.volume * 100)}%</span></label>
            <input type="range" class="slider-input" id="volume" min="0.1" max="1" step="0.05" value="${V.volume}">
          </div>

          <div class="field">
            <label class="field-label">告警播报文案模板（占位符自动替换）</label>
            <textarea class="textarea" id="tpl">${esc(cfg.tpl)}</textarea>
            <div class="field-hint">可用占位符：{系统} {事件} {负责人} {关键词}</div>
          </div>

          <div class="code-box">${esc(sampleText())}</div>

          <div class="flex wrap gap8 mt16">
            <button class="btn btn-primary" id="btnPlay">${icon('volume', 17)} 立即试听告警播报</button>
            <button class="btn" id="btnEmgcy">${icon('alert', 17)} 模拟红标特急触发</button>
            <button class="btn" id="btnStop">${icon('refresh', 17)} 停止播报</button>
          </div>
          <div class="field-hint mt8">${icon('alert', 14)} 浏览器首次发声需用户点击一次页面（本页按钮已满足该策略）；实际部署建议在监控室终端设置 Chrome 自动播放白名单。</div>

          <hr class="hr">
          <div class="flex between acenter wrap gap8">
            <div style="font-weight:600">最近播报记录</div>
            <span class="sub-note">仅保留最近 6 条</span>
          </div>
          <div class="mt8">
            ${(() => { const l = store.get('voiceLog', []).slice(0, 6); return l.length ? l.map(x => `
              <div class="result-line" style="padding:3px 0">
                <span class="rl-k small num">${x.time.slice(11)}</span>
                <span class="small">${esc(x.text)}</span>
              </div>`).join('') : '<div class="small muted">暂无播报记录，点击上方按钮试听一次。</div>'; })()}
          </div>
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
            ${Voice.supported() ? '<span class="badge b-success">支持</span>' : '<span class="badge b-danger">不支持</span>'}
          </div>
          <div class="rowline">
            <div><div class="rl-title">中文语音包</div>
              <div class="rl-desc">${Voice.zhVoices().length || '加载中…'} 个中文语音可用</div></div>
            <span class="badge ${Voice.zhVoices().length ? 'b-success' : 'b-warn'}">${Voice.zhVoices().length ? '可用' : '需安装'}</span>
          </div>
          <div class="rowline">
            <div><div class="rl-title">外接扬声器 / 音响</div>
              <div class="rl-desc">${V.external ? '现场已布设监控室音响' : '未外接，使用终端内置扬声器'}</div></div>
            <span class="badge ${V.external ? 'b-success' : 'b-warn'}">${V.external ? '已连接' : '未连接'}</span>
          </div>
          <div class="rowline">
            <div><div class="rl-title">夜间时段免打扰</div>
              <div class="rl-desc">23:00 - 06:30 仅保留标记「跳过免打扰」的特急事项</div></div>
            <span class="badge b-info">已按建议配置</span>
          </div>

          <hr class="hr">
          <div class="small muted" style="line-height:1.9">
            <div><strong>部署建议：</strong></div>
            <div>1. 监控室大屏终端使用 Chrome / Edge，并将站点加入「声音自动播放」白名单；</div>
            <div>2. 特急事件建议「语音 2 次 + 大屏顶部红标横幅 + 紧急邮件单发」三重触达；</div>
            <div>3. 语速建议 1.1×～1.3×，女声默认音调 +15%，嘈杂环境下音量不低于 80%；</div>
            <div>4. 现场音响建议独立供电，并与消防广播做优先级协商。</div>
          </div>
        </div>
      </section>
    </div>`;

    bind();
  }

  /* ================= 弹窗：联系人 ================= */
  function openContactDlg(idx) {
    const edit = idx >= 0;
    const c = edit ? K.contacts[idx] : { name: '', dept: '', role: '', mail: '', level: '仅特急', enabled: true };
    openDialog({
      title: edit ? '编辑紧急联系人' : '新增紧急联系人',
      sub: '命中关键词后，紧急邮件将即时投递到该邮箱',
      width: 620,
      body: `
        <div class="field-row">
          <div class="field"><label class="field-label">姓名</label><input class="input" id="fName" autofocus value="${esc(c.name)}"></div>
          <div class="field"><label class="field-label">接收邮箱</label><input class="input" id="fMail" placeholder="name@corp.example.com" value="${esc(c.mail)}"></div>
        </div>
        <div class="field-row">
          <div class="field"><label class="field-label">所属处室</label><input class="input" id="fDept" value="${esc(c.dept)}"></div>
          <div class="field"><label class="field-label">岗位角色</label><input class="input" id="fRole" value="${esc(c.role)}"></div>
        </div>
        <div class="field"><label class="field-label">接收级别</label>
          <select class="select" id="fLevel">${optsSel(['仅特急', '特急+重要', '全部'], c.level)}</select>
          <div class="field-hint">仅特急=只收紧急邮件；全部=同时接收常规告警</div>
        </div>
        <label class="checkline"><input type="checkbox" id="fEnabled" ${c.enabled ? 'checked' : ''}><span>启用该联系人</span></label>`,
      onOk: (mask, close) => {
        const name = getVal('fName'), mail = getVal('fMail');
        if (!name) { toast('请填写联系人姓名', 'warn'); return; }
        if (!/^\S+@\S+\.\S+$/.test(mail)) { toast('请填写有效的邮箱地址', 'warn'); return; }
        const data = { name, mail, dept: getVal('fDept') || '未分组', role: getVal('fRole') || '联系人', level: getVal('fLevel'), enabled: getChk('fEnabled') };
        if (edit) Object.assign(K.contacts[idx], data); else K.contacts.push(Object.assign({ id: nextId('C', K.contacts) }, data));
        saveK(); close(); render();
        toast(edit ? `已更新联系人「${name}」` : `已新增紧急联系人「${name}」`, 'success');
      }
    });
  }

  /* ================= 弹窗：关键词 ================= */
  function openKwDlg(idx) {
    const edit = idx >= 0;
    const k = edit ? K.keywords[idx] : { word: '', match: '包含', level: '特急', dnd: true, note: '', hits: 0, enabled: true };
    openDialog({
      title: edit ? '编辑关键词' : '新增关键词',
      sub: '异常内容命中该词时，立即升级为紧急邮件并通知绑定联系人',
      width: 620,
      body: `
        <div class="field"><label class="field-label">关键词 / 表达式</label>
          <input class="input" id="fWord" autofocus placeholder="例如：宕机，或：支付失败率|渠道中断" value="${esc(k.word)}"></div>
        <div class="field-row">
          <div class="field"><label class="field-label">匹配方式</label>
            <select class="select" id="fMatch">${optsSel(MATCH_MODES, k.match)}</select></div>
          <div class="field"><label class="field-label">命中等级</label>
            <select class="select" id="fLevel">${optsSel(['特急', '重要'], k.level)}</select></div>
        </div>
        <div class="field"><label class="field-label">备注</label>
          <input class="input" id="fNote" placeholder="说明该关键词的业务含义" value="${esc(k.note)}"></div>
        <label class="checkline"><input type="checkbox" id="fDnd" ${k.dnd ? 'checked' : ''}><span>夜间免打扰时段（23:00 - 06:30）仍即时投递</span></label>
        <label class="checkline"><input type="checkbox" id="fEnabled" ${k.enabled ? 'checked' : ''}><span>启用该关键词</span></label>`,
      onOk: (mask, close) => {
        const word = getVal('fWord');
        if (!word) { toast('请填写关键词', 'warn'); return; }
        const data = { word, match: getVal('fMatch'), level: getVal('fLevel'), note: getVal('fNote'), dnd: getChk('fDnd'), enabled: getChk('fEnabled'), hits: edit ? k.hits : 0 };
        if (edit) Object.assign(K.keywords[idx], data); else K.keywords.push(Object.assign({ id: nextId('K', K.keywords) }, data));
        saveK(); close(); render();
        toast(edit ? `已更新关键词「${word}」` : `已新增关键词「${word}」`, 'success');
      }
    });
  }

  /* ================= 弹窗：绑定 ================= */
  const pickList = (name, items) => items.map(it => `
    <label class="pick-item">
      <input type="checkbox" data-pick="${name}" value="${it.value}" ${it.checked ? 'checked' : ''}>
      <span>${esc(it.label)}</span>
      ${it.sub ? `<span class="pi-sub">${esc(it.sub)}</span>` : ''}
    </label>`).join('');

  function openBindDlg(idx) {
    const edit = idx >= 0;
    const b = edit ? K.bindings[idx] : { name: '', kws: [], sys: [], contacts: [], enabled: true };
    openDialog({
      title: edit ? '编辑绑定关系' : '新增绑定关系',
      sub: '关键词 × 子系统 × 紧急联系人，三项均可多选（多对多）',
      width: 860,
      body: `
        <div class="field"><label class="field-label">绑定名称</label>
          <input class="input" id="fName" autofocus placeholder="例如：资金支付链路阻断" value="${esc(b.name)}"></div>
        <div class="grid g-3 mt16" style="gap:14px">
          <div class="field">
            <div class="flex between acenter"><label class="field-label">关键词</label>
              <button class="link-btn" data-all="kws">全选 / 清空</button></div>
            <div class="pick">
              ${pickList('kws', K.keywords.map(k => ({ value: k.id, label: k.word, sub: k.level, checked: b.kws.includes(k.id) })))}
            </div>
          </div>
          <div class="field">
            <div class="flex between acenter"><label class="field-label">子系统</label>
              <button class="link-btn" data-all="sys">全选 / 清空</button></div>
            <div class="pick">
              <label class="pick-item"><input type="checkbox" data-pick="sys" value="ALL" ${b.sys.includes('ALL') ? 'checked' : ''}><span>全部子系统</span><span class="pi-sub">含后续新增</span></label>
              ${pickList('sys', SUBSYSTEMS.map(s => ({ value: s.id, label: s.name, checked: b.sys.includes(s.id) })))}
            </div>
          </div>
          <div class="field">
            <div class="flex between acenter"><label class="field-label">紧急联系人</label>
              <button class="link-btn" data-all="contacts">全选 / 清空</button></div>
            <div class="pick">
              ${pickList('contacts', K.contacts.map(c => ({ value: c.id, label: c.name, sub: c.dept, checked: b.contacts.includes(c.id) })))}
            </div>
          </div>
        </div>
        <label class="checkline mt16"><input type="checkbox" id="fEnabled" ${b.enabled ? 'checked' : ''}><span>启用该绑定</span></label>`,
      onOk: (mask, close) => {
        const name = getVal('fName');
        if (!name) { toast('请填写绑定名称', 'warn'); return; }
        const kws = getChkList('kws'), sys = getChkList('sys'), contacts = getChkList('contacts');
        if (!kws.length || !sys.length || !contacts.length) { toast('关键词、子系统、紧急联系人均需至少选择一项', 'warn'); return; }
        const data = { name, kws, sys, contacts, enabled: getChk('fEnabled') };
        if (edit) Object.assign(K.bindings[idx], data); else K.bindings.push(Object.assign({ id: nextId('B', K.bindings) }, data));
        saveK(); close(); render();
        toast(edit ? `已更新绑定「${name}」` : `已新增绑定「${name}」，覆盖 ${bindingCoverage(data)} 种子系统 × 联系人组合`, 'success');
      }
    });

    const mask = document.getElementById('globalDialog');
    if (mask) mask.querySelectorAll('[data-all]').forEach(btn => btn.onclick = e => {
      e.preventDefault();
      const n = btn.dataset.all;
      const boxes = Array.from(mask.querySelectorAll(`[data-pick="${n}"]`));
      const allChecked = boxes.every(x => x.checked);
      boxes.forEach(x => { x.checked = !allChecked; });
    });
  }

  function confirmDel(what, cb) {
    openDialog({
      title: '确认删除',
      width: 480,
      okText: '删除',
      body: `<div style="font-size:16px;line-height:1.9">确定要删除<strong>${esc(what)}</strong>吗？<br><span class="small muted">删除后相关的投递规则同步失效，请谨慎操作。</span></div>`,
      onOk: (mask, close) => { cb(); close(); }
    });
  }

  /* ================= 事件绑定 ================= */
  function bind() {
    const $ = id => document.getElementById(id);

    bindMailCard(cfg, render);

    /* --- 关键词联动 --- */
    $('btnNewContact') && ($('btnNewContact').onclick = () => openContactDlg(-1));
    $('btnNewKw') && ($('btnNewKw').onclick = () => openKwDlg(-1));
    $('btnNewBind') && ($('btnNewBind').onclick = () => openBindDlg(-1));

    const togSw = (attr, cb) => document.querySelectorAll(`[data-${attr}]`).forEach(el => el.addEventListener('change', e => cb(Number(el.dataset[attr]), e.target.checked)));
    togSw('ct', (i, v) => { K.contacts[i].enabled = v; saveK(); render(); });
    togSw('kw', (i, v) => { K.keywords[i].enabled = v; saveK(); render(); });
    togSw('bd', (i, v) => { K.bindings[i].enabled = v; saveK(); render(); });
    togSw('rule', (i, v) => { cfg.rules[i].enabled = v; save(); render(); });

    const act = (attr, fn) => document.querySelectorAll(`[data-${attr}]`).forEach(el => el.addEventListener('click', () => fn(Number(el.dataset[attr]))));
    act('ctedit', i => openContactDlg(i));
    act('kwedit', i => openKwDlg(i));
    act('bdedit', i => openBindDlg(i));
    act('ctdel', i => confirmDel(`联系人「${K.contacts[i].name}」`, () => {
      const id = K.contacts[i].id;
      K.contacts.splice(i, 1);
      K.bindings.forEach(b => { b.contacts = b.contacts.filter(c => c !== id); });
      saveK(); render(); toast('联系人已删除，相关绑定已同步清理', 'success');
    }));
    act('kwdel', i => confirmDel(`关键词「${K.keywords[i].word}」`, () => {
      const id = K.keywords[i].id;
      K.keywords.splice(i, 1);
      K.bindings.forEach(b => { b.kws = b.kws.filter(k => k !== id); });
      saveK(); render(); toast('关键词已删除，相关绑定已同步清理', 'success');
    }));
    act('bddel', i => confirmDel(`绑定「${K.bindings[i].name}」`, () => {
      K.bindings.splice(i, 1); saveK(); render(); toast('绑定关系已删除', 'success');
    }));

    const tt = $('trialText');
    tt && (tt.oninput = e => { trial.text = e.target.value; });
    const ts = $('trialSys');
    ts && (ts.onchange = e => { trial.sysId = e.target.value; });
    document.querySelectorAll('[data-trial]').forEach(el => el.onclick = () => {
      trial.text = el.dataset.trial;
      trial.result = resolveDispatch({ text: trial.text, sysId: trial.sysId, contacts: K.contacts, keywords: K.keywords, bindings: K.bindings });
      render();
    });
    $('btnTrial') && ($('btnTrial').onclick = () => {
      trial.text = tt ? tt.value : trial.text;
      trial.sysId = ts ? ts.value : trial.sysId;
      trial.result = resolveDispatch({ text: trial.text, sysId: trial.sysId, contacts: K.contacts, keywords: K.keywords, bindings: K.bindings });
      store.set('alerts', { tpl: cfg.tpl, trialText: trial.text });
      render();
      const hit = trial.result && trial.result.hits.length;
      if (hit) toast(`命中 ${hit} 个关键词，将向 ${trial.result.receivers.length} 位紧急联系人发出紧急邮件`, 'danger');
      else toast('未命中任何关键词，按普通告警随日报汇总发出', 'success');
      if (hit && V.on && V.sources.includes('keyword')) {
        const words = trial.result.hits.map(h => h.word).join('、');
        Voice.speak(`紧急告警：${sysName(trial.sysId)}，命中关键词 ${words}，请 ${trial.result.receivers.map(r => r.name).join('、') || '值班人员'} 立即处置。`);
      }
    });
    $('btnSpeakTrial') && ($('btnSpeakTrial').onclick = () => {
      if (!trial.result || !trial.result.hits.length) return;
      const words = trial.result.hits.map(h => h.word).join('、');
      const who = trial.result.receivers.map(r => r.name).join('、') || '值班人员';
      Voice.speak(`紧急告警：${sysName(trial.sysId)}，命中关键词 ${words}，请 ${who} 立即处置。`);
    });
    $('btnViewMail') && ($('btnViewMail').onclick = () => {
      cfg.mailTab = 'critical'; render();
      const el = document.querySelectorAll('.card')[0];
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      toast('下方为收件人邮箱中看到的紧急邮件效果', 'primary');
    });

    /* --- 语音 --- */
    const vSave = () => { Voice.save(); render(); };
    $('voiceOn') && ($('voiceOn').onchange = e => { V.on = e.target.checked; Voice.save(); if (V.on) Voice.speak('语音播报已开启，紧急告警将自动朗读。'); else Voice.stop(); render(); });
    $('externalSpeaker') && ($('externalSpeaker').onchange = e => { V.external = e.target.checked; vSave(); });
    $('voiceGender') && ($('voiceGender').onchange = e => { V.gender = e.target.value; vSave(); });
    $('repeat') && ($('repeat').onchange = e => { V.repeat = Number(e.target.value); vSave(); });
    $('srcCritical') && ($('srcCritical').onchange = e => { toggleSrc('critical', e.target.checked); });
    $('srcKeyword') && ($('srcKeyword').onchange = e => { toggleSrc('keyword', e.target.checked); });
    $('rate') && ($('rate').oninput = e => { V.rate = Number(e.target.value); Voice.save(); });
    $('rate') && ($('rate').onchange = () => render());
    $('volume') && ($('volume').oninput = e => { V.volume = Number(e.target.value); Voice.save(); });
    $('volume') && ($('volume').onchange = () => render());
    $('tpl') && ($('tpl').onchange = e => { cfg.tpl = e.target.value; save(); render(); });

    $('btnPlay') && ($('btnPlay').onclick = () => { if (Voice.speak(sampleText())) toast('正在播报告警样例', 'success'); });
    $('btnEmgcy') && ($('btnEmgcy').onclick = () => {
      toast(`模拟红标特急事件：${SAMPLE.系统} ${SAMPLE.事件}`, 'danger');
      Voice.speakTimes(sampleText());
    });
    $('btnStop') && ($('btnStop').onclick = () => { Voice.stop(); toast('已停止播报', 'success'); });
  }

  function toggleSrc(key, on) {
    const s = new Set(V.sources || []);
    if (on) s.add(key); else s.delete(key);
    V.sources = Array.from(s);
    Voice.save();
    render();
  }

  render();
})();
