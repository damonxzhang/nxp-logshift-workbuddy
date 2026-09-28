/* ============ 预警通知：关键词联动 + 紧急邮件分发 ============ */
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

  const sysName = id => id === 'ALL' ? '全部子系统' : (SUBSYSTEMS.find(s => s.id === id) || { name: id }).name;
  const kwWord = id => (K.keywords.find(k => k.id === id) || { word: id }).word;
  const ctName = id => (K.contacts.find(c => c.id === id) || { name: id, dept: '—' }).name;
  const kwLevel = id => (K.keywords.find(k => k.id === id) || {}).level === '特急';
  const kwLevelChip = id => kwLevel(id) ? 'danger' : 'warn';
  const optsSel = (list, cur) => list.map(v => `<option ${v === cur ? 'selected' : ''}>${v}</option>`).join('');

  /* ================= 页面 ================= */
  function render() {
    document.getElementById('content').innerHTML = `
    <div class="notice" style="--nc:var(--primary)">
      ${icon('mail', 19)}
      <div><strong>预警通道说明：</strong>本系统预警<strong>仅通过邮件发送</strong>，不含短信通道。异常命中<strong>关键词</strong>后即判定为<strong>紧急邮件</strong>，按「关键词 × 子系统 × 紧急联系人」的绑定关系即时投递。</div>
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
        <div class="card-foot">${icon('zap', 15)} 「多词任一」以竖线 <code>|</code> 分隔多个词，「正则」直接填表达式，例如 <code>^\\s*(越权|提权)</code>。</div>
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
    </section>`;

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
    /* --- 关键词联动 --- */
    const $ = id => document.getElementById(id);
    $('btnNewContact') && ($('btnNewContact').onclick = () => openContactDlg(-1));
    $('btnNewKw') && ($('btnNewKw').onclick = () => openKwDlg(-1));
    $('btnNewBind') && ($('btnNewBind').onclick = () => openBindDlg(-1));

    const togSw = (attr, cb) => document.querySelectorAll(`[data-${attr}]`).forEach(el => el.addEventListener('change', e => cb(Number(el.dataset[attr]), e.target.checked)));
    togSw('ct', (i, v) => { K.contacts[i].enabled = v; saveK(); render(); });
    togSw('kw', (i, v) => { K.keywords[i].enabled = v; saveK(); render(); });
    togSw('bd', (i, v) => { K.bindings[i].enabled = v; saveK(); render(); });

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
  }

  render();
})();
