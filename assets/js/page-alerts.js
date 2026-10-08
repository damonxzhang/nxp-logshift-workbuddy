/* ============ 预警通知：子系统 × 报警级别 × 紧急联系人 ============
   2026-10-08 客户确认：① 去掉「关键词库」，预警由大屏多级报警（红 / 黄）直接触发；
                       ② 子系统收敛为本次实际接入的 3 个（Output / WIP / 次品管理）。
   ================================================================ */
(function () {
  renderShell('alerts');

  const clone = o => JSON.parse(JSON.stringify(o));

  /* ---------------- 预警通知配置（客户可自行维护） ----------------
     localStorage key 沿用历史名 'keywordCfg'，避免客户已维护的联系人丢失。 */
  const K = store.get('keywordCfg', null) || {};
  if (!Array.isArray(K.contacts)) K.contacts = clone(CONTACTS_SEED);
  /* 旧结构迁移：绑定里带 kws（关键词）或无 levels 字段的一律按新种子重置 */
  if (!Array.isArray(K.bindings) || K.bindings.some(b => b.kws || !Array.isArray(b.levels))) {
    K.bindings = clone(BINDINGS_SEED);
    delete K.keywords;
  }
  const saveK = () => store.set('keywordCfg', K);

  const nextId = (prefix, list) => {
    let i = list.length + 1;
    while (list.some(x => x.id === prefix + String(i).padStart(2, '0'))) i++;
    return prefix + String(i).padStart(2, '0');
  };

  const sysName = id => id === 'ALL' ? '全部子系统（3 个）' : (ALERT_SYSTEMS.find(s => s.id === id) || { name: id }).name;
  const ctName = id => (K.contacts.find(c => c.id === id) || { name: id, dept: '—' }).name;
  const lvName = id => (ALERT_LEVELS.find(l => l.id === id) || { name: id }).name;
  const lvChip = id => (id === 'red' ? 'danger' : 'warn');
  const optsSel = (list, cur) => list.map(v => `<option ${v === cur ? 'selected' : ''}>${v}</option>`).join('');

  /* 各子系统的红 / 黄触发口径（与三块大屏实际口径一致） */
  const SYS_RULE = {
    OP: '红：累计产出缺口 ≥ 红灯阈值（逐 PKG Type 可配）；黄：≥ 黄灯阈值。金额（Earn）口径按递进 ±5% 判定',
    WIP: '红：BE CT ≥ 红阈值 / OTD 逾期超红线；黄：≥ 黄阈值（均在二级抽屉按工序配置）',
    DEFECT: '红：周 PPM 突破红线 2000（良率 < 0.998）；黄：达预警线口径 3000 PPM（CWAAY 0.997）'
  };
  const sysRule = id => SYS_RULE[id] || '阈值由该子系统大屏的报警配置决定';

  /* ================= 页面 ================= */
  function render() {
    document.getElementById('content').innerHTML = `
    <div class="notice" style="--nc:var(--primary)">
      ${icon('mail', 19)}
      <div><strong>预警通道说明：</strong>本系统预警<strong>仅通过邮件发送</strong>，不含短信通道。大屏出现<strong>红色 / 黄色报警</strong>时，按下方「子系统 × 报警级别 × 紧急联系人」的绑定关系即时投递紧急邮件。</div>
    </div>

    <div class="notice mt16" style="--nc:var(--warn)">
      ${icon('layers', 19)}
      <div><strong>子系统 × 报警级别 × 紧急联系人（多对多，客户自助配置）：</strong>子系统即本次实际接入的 <strong>Output（OP）/ WIP 在制品 / 次品管理</strong> 三个（2026-10-08 收敛，与接入范围口径一致）；报警级别分<strong>红色报警</strong>（红屏 + 强制弹窗 + 语音播报）与<strong>黄色报警</strong>（黄灯 · 仅邮件）。三者自由绑定——同一子系统可绑多个联系人，一个联系人也可承接多个子系统。</div>
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
        <div class="card-foot">${icon('alert', 15)} 「仅特急」= 只收<strong>红色报警</strong>邮件；「特急+重要」= 红 + 黄都收；「全部」= 同时接收常规告警。与绑定的「报警级别」取交集后投递。</div>
      </section>

      <section class="card">
        <div class="card-head">
          <div class="card-title">${icon('server', 19)} 预警子系统与报警级别
            <span class="card-sub">本次接入的 3 个子系统 · 只读</span></div>
          <div class="toolbar"><span class="badge b-info">${ALERT_SYSTEMS.length} 个子系统 · ${ALERT_LEVELS.length} 级报警</span></div>
        </div>
        <div class="card-body" style="padding:0">
          <table class="table">
            <thead><tr><th>子系统</th><th>归属与入口</th><th>触发口径（红 / 黄）</th></tr></thead>
            <tbody>
              ${ALERT_SYSTEMS.map(s => `
                <tr>
                  <td><div class="tname" style="font-size:14.5px">${esc(s.name)}</div><div class="tsub">${esc(s.id)} · ${esc(s.cat)}</div></td>
                  <td class="small">${esc(s.owner)}</td>
                  <td class="small">${esc(sysRule(s.id))}</td>
                </tr>`).join('')}
              <tr>
                <td><div class="tname" style="font-size:14.5px">${icon('alert', 15)} 报警级别</div><div class="tsub">red / yellow</div></td>
                <td class="small">大屏 + 弹窗 + 邮件</td>
                <td class="small">${ALERT_LEVELS.map(l => `<span class="chip ${lvChip(l.id)}">${esc(l.name)}</span> ${esc(l.desc)}`).join('<br>')}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="card-foot">${icon('database', 15)} 子系统清单与「接入范围」口径一致（Output / WIP / 次品管理），后续新增子系统在此同步后即可被绑定关系引用。</div>
      </section>
    </div>

    <section class="card mt24">
      <div class="card-head">
        <div class="card-title">${icon('layers', 19)} 多对多绑定关系
          <span class="card-sub">子系统 × 报警级别 × 紧急联系人</span></div>
        <div class="toolbar">
          <span class="badge b-info">${K.bindings.filter(b => b.enabled).length} / ${K.bindings.length} 条生效</span>
          <button class="btn btn-sm btn-primary" id="btnNewBind">${icon('plus', 15)} 新增绑定</button>
        </div>
      </div>
      <div class="card-body" style="padding:0">
        <div style="overflow-x:auto">
        <table class="table">
          <thead><tr><th style="width:190px">绑定名称</th><th>子系统</th><th style="width:150px">报警级别</th><th>紧急联系人</th><th class="center">组合数</th><th class="center">启用</th><th class="center">操作</th></tr></thead>
          <tbody>
            ${K.bindings.length ? K.bindings.map((b, i) => `
              <tr>
                <td><div class="tname" style="font-size:14.5px">${esc(b.name)}</div><div class="tsub">${b.id}</div></td>
                <td><div class="chips">${b.sys.map(s => `<span class="chip">${esc(sysName(s))}</span>`).join('') || '<span class="muted small">未选择</span>'}</div></td>
                <td><div class="chips">${(b.levels || []).map(l => `<span class="chip ${lvChip(l)}">${esc(lvName(l))}</span>`).join('') || '<span class="muted small">未选择</span>'}</div></td>
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
      <div class="card-foot">${icon('activity', 15)} 一条绑定即一个笛卡尔积：任一被选子系统触发所选级别的报警，就向列表内全部紧急联系人发出紧急邮件（再按联系人「接收级别」取交集）。</div>
    </section>`;

    bind();
  }

  /* ================= 弹窗：联系人 ================= */
  function openContactDlg(idx) {
    const edit = idx >= 0;
    const c = edit ? K.contacts[idx] : { name: '', dept: '', role: '', mail: '', level: '仅特急', enabled: true };
    openDialog({
      title: edit ? '编辑紧急联系人' : '新增紧急联系人',
      sub: '子系统触发红色 / 黄色报警后，紧急邮件将即时投递到该邮箱',
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
          <div class="field-hint">仅特急 = 只收红色报警；特急+重要 = 红 + 黄；全部 = 同时接收常规告警</div>
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

  /* ================= 弹窗：绑定 ================= */
  const pickList = (name, items) => items.map(it => `
    <label class="pick-item">
      <input type="checkbox" data-pick="${name}" value="${it.value}" ${it.checked ? 'checked' : ''}>
      <span>${esc(it.label)}</span>
      ${it.sub ? `<span class="pi-sub">${esc(it.sub)}</span>` : ''}
    </label>`).join('');

  function openBindDlg(idx) {
    const edit = idx >= 0;
    const b = edit ? K.bindings[idx] : { name: '', sys: [], levels: ['red'], contacts: [], enabled: true };
    openDialog({
      title: edit ? '编辑绑定关系' : '新增绑定关系',
      sub: '子系统 × 报警级别 × 紧急联系人，三项均可多选（多对多）',
      width: 860,
      body: `
        <div class="field"><label class="field-label">绑定名称</label>
          <input class="input" id="fName" autofocus placeholder="例如：OP 产出缺口（累计未达标）" value="${esc(b.name)}"></div>
        <div class="grid g-3 mt16" style="gap:14px">
          <div class="field">
            <div class="flex between acenter"><label class="field-label">子系统</label>
              <button class="link-btn" data-all="sys">全选 / 清空</button></div>
            <div class="pick">
              <label class="pick-item"><input type="checkbox" data-pick="sys" value="ALL" ${b.sys.includes('ALL') ? 'checked' : ''}><span>全部子系统</span><span class="pi-sub">含后续新增</span></label>
              ${pickList('sys', ALERT_SYSTEMS.map(s => ({ value: s.id, label: s.name, sub: s.cat, checked: b.sys.includes(s.id) })))}
            </div>
          </div>
          <div class="field">
            <div class="flex between acenter"><label class="field-label">报警级别</label>
              <button class="link-btn" data-all="levels">全选 / 清空</button></div>
            <div class="pick">
              ${pickList('levels', ALERT_LEVELS.map(l => ({ value: l.id, label: l.name, sub: l.desc, checked: (b.levels || []).includes(l.id) })))}
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
        const sys = getChkList('sys'), levels = getChkList('levels'), contacts = getChkList('contacts');
        if (!sys.length || !levels.length || !contacts.length) { toast('子系统、报警级别、紧急联系人均需至少选择一项', 'warn'); return; }
        const data = { name, sys, levels, contacts, enabled: getChk('fEnabled') };
        if (edit) Object.assign(K.bindings[idx], data); else K.bindings.push(Object.assign({ id: nextId('B', K.bindings) }, data));
        saveK(); close(); render();
        toast(edit ? `已更新绑定「${name}」` : `已新增绑定「${name}」，覆盖 ${bindingCoverage(data)} 组子系统 × 报警级别 × 联系人组合`, 'success');
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
    /* --- 预警通知配置 --- */
    const $ = id => document.getElementById(id);
    $('btnNewContact') && ($('btnNewContact').onclick = () => openContactDlg(-1));
    $('btnNewBind') && ($('btnNewBind').onclick = () => openBindDlg(-1));

    const togSw = (attr, cb) => document.querySelectorAll(`[data-${attr}]`).forEach(el => el.addEventListener('change', e => cb(Number(el.dataset[attr]), e.target.checked)));
    togSw('ct', (i, v) => { K.contacts[i].enabled = v; saveK(); render(); });
    togSw('bd', (i, v) => { K.bindings[i].enabled = v; saveK(); render(); });

    const act = (attr, fn) => document.querySelectorAll(`[data-${attr}]`).forEach(el => el.addEventListener('click', () => fn(Number(el.dataset[attr]))));
    act('ctedit', i => openContactDlg(i));
    act('bdedit', i => openBindDlg(i));
    act('ctdel', i => confirmDel(`联系人「${K.contacts[i].name}」`, () => {
      const id = K.contacts[i].id;
      K.contacts.splice(i, 1);
      K.bindings.forEach(b => { b.contacts = b.contacts.filter(c => c !== id); });
      saveK(); render(); toast('联系人已删除，相关绑定已同步清理', 'success');
    }));
    act('bddel', i => confirmDel(`绑定「${K.bindings[i].name}」`, () => {
      K.bindings.splice(i, 1); saveK(); render(); toast('绑定关系已删除', 'success');
    }));
  }

  render();
})();
