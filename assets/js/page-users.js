/* ============ 用户与权限管理（标准 RBAC：用户 - 角色 - 权限） ============ */
(function () {
  renderShell('users');

  let users = store.get('rbac_users', null) || USERS_SEED.map(u => Object.assign({}, u));
  let roles = store.get('rbac_roles', null) || ROLES_SEED.map(r => Object.assign({}, r, { perms: JSON.parse(JSON.stringify(r.perms)) }));
  let audit = store.get('rbac_audit', null) || AUDIT_SEED.slice();
  let tab = store.get('rbac_tab', 'user');

  // 兼容历史持久化：补齐新增权限模块（异常根因分析 / 自动月报），避免旧角色缺失这两列
  (function normalizeRoles() {
    let changed = false;
    roles.forEach(r => {
      PERM_MODULES.forEach(m => {
        if (!r.perms[m.id]) { r.perms[m.id] = (r.id === 'R01') ? PERM_ACTIONS.map(a => a.id) : []; changed = true; }
      });
    });
    if (changed) saveR();
  })();

  let kw = '', fDept = 'all', fStatus = 'all', fRole = 'all', selRole = roles[0].id;

  const saveU = () => store.set('rbac_users', users);
  const saveR = () => store.set('rbac_roles', roles);
  const saveA = () => store.set('rbac_audit', audit);

  const roleOf = id => roles.find(r => r.id === id);
  const usersIn = rid => users.filter(u => u.roles.includes(rid)).length;
  const permCount = r => Object.values(r.perms || {}).reduce((a, b) => a + b.length, 0);
  const TOTAL_PERM = PERM_MODULES.length * PERM_ACTIONS.length;

  function log(action, target, detail, result = '成功') {
    audit.unshift({ time: fmtDT(new Date()), user: '张卫东', action, target, result, ip: '10.20.31.45', detail });
    audit = audit.slice(0, 60);
    saveA();
  }

  const depts = () => Array.from(new Set(users.map(u => u.dept)));

  /* ---------------- 顶部统计 ---------------- */
  function statStrip() {
    const enabled = users.filter(u => u.status === 'enabled').length;
    const adminCount = users.filter(u => u.roles.includes('R01')).length;
    const mfa = users.filter(u => u.mfa).length;
    return [
      { label: '系统用户总数', value: users.length + ' 人' },
      { label: '启用 / 停用', value: `${enabled} / ${users.length - enabled}` },
      { label: '角色数量', value: roles.length + ' 个' },
      { label: '可授权权限点', value: TOTAL_PERM + ' 项' },
      { label: '超级管理员', value: adminCount + ' 人' },
      { label: '已开二次验证', value: mfa + ' 人' }
    ];
  }

  /* ---------------- 页面骨架 ---------------- */
  function render() {
    const s = statStrip();
    document.getElementById('content').innerHTML = `
    <div class="notice" style="--nc:var(--primary)">
      ${icon('users', 19)}
      <div><strong>标准 RBAC 权限模型：</strong>系统按「<strong>用户 → 角色 → 权限</strong>」三层授权。先在<strong>角色权限</strong>页维护各角色的功能菜单与操作许可（查看 / 新增 / 编辑 / 删除 / 导出 / 审批授权），再到<strong>用户管理</strong>为用户分配一个或多个角色即可。所有授权变更均留痕，可在<strong>操作日志</strong>中追溯。</div>
    </div>

    <div class="card mt16">
      <div class="stat-strip">
        ${s.map(x => `<div class="si"><div class="si-label">${x.label}</div><div class="si-value">${x.value}</div></div>`).join('')}
      </div>
    </div>

    <div class="card mt24">
      <div class="card-head">
        <div class="seg" id="tabs">
          <button data-tab="user" class="${tab === 'user' ? 'active' : ''}">${icon('user', 17)} 用户管理</button>
          <button data-tab="role" class="${tab === 'role' ? 'active' : ''}">${icon('key', 17)} 角色权限</button>
          <button data-tab="audit" class="${tab === 'audit' ? 'active' : ''}">${icon('file', 17)} 操作日志</button>
        </div>
      </div>
      <div id="pane"></div>
    </div>`;

    document.querySelectorAll('#tabs button').forEach(b => b.addEventListener('click', () => {
      tab = b.getAttribute('data-tab'); store.set('rbac_tab', tab); render();
    }));

    if (tab === 'user') renderUsers();
    else if (tab === 'role') renderRoles();
    else renderAudit();
  }

  /* ---------------- Tab 1：用户管理 ---------------- */
  function renderUsers() {
    const rows = users.filter(u => {
      const m1 = !kw || (u.name + u.account + u.dept + u.post + u.mail).toLowerCase().includes(kw.toLowerCase());
      const m2 = fDept === 'all' || u.dept === fDept;
      const m3 = fStatus === 'all' || u.status === fStatus;
      const m4 = fRole === 'all' || u.roles.includes(fRole);
      return m1 && m2 && m3 && m4;
    });

    document.getElementById('pane').innerHTML = `
      <div class="card-body">
        <div class="toolbar">
          <div class="search">${icon('search', 17)}<input class="input" id="ukw" placeholder="搜索姓名 / 账号 / 处室 / 邮箱" value="${esc(kw)}"></div>
          <select class="select" id="fDept" style="width:150px">
            <option value="all">全部处室</option>
            ${depts().map(d => `<option ${fDept === d ? 'selected' : ''}>${esc(d)}</option>`).join('')}
          </select>
          <select class="select" id="fRole" style="width:170px">
            <option value="all">全部角色</option>
            ${roles.map(r => `<option value="${r.id}" ${fRole === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}
          </select>
          <select class="select" id="fStatus" style="width:130px">
            <option value="all">全部状态</option>
            <option value="enabled" ${fStatus === 'enabled' ? 'selected' : ''}>已启用</option>
            <option value="disabled" ${fStatus === 'disabled' ? 'selected' : ''}>已停用</option>
          </select>
          <button class="btn btn-primary" id="btnNewUser">${icon('plus', 17)} 新增用户</button>
          <button class="btn" id="btnExportUser">${icon('download', 17)} 导出花名册</button>
        </div>
      </div>
      <div class="card-body" style="padding:0">
        <div style="overflow-x:auto">
        <table class="table">
          <thead><tr>
            <th>用户</th><th>所属处室 / 岗位</th><th>角色</th><th>数据范围</th>
            <th class="center">状态</th><th>最近登录</th><th class="center">二次验证</th><th class="center">操作</th>
          </tr></thead>
          <tbody>
            ${rows.length ? rows.map(u => {
              const on = u.status === 'enabled';
              return `<tr>
                <td>
                  <div class="flex acenter gap8">
                    <div class="avatar" style="width:34px;height:34px;font-size:14px">${esc(u.name.slice(0, 1))}</div>
                    <div><div class="tname">${esc(u.name)}${u.builtin ? ` <span class="badge b-primary" style="margin-left:4px">内置</span>` : ''}</div>
                      <div class="tsub">账号 ${esc(u.account)}</div></div>
                  </div>
                </td>
                <td><div class="small">${esc(u.dept)}</div><div class="tsub">${esc(u.post)}</div></td>
                <td><div class="chips">${u.roles.length ? u.roles.map(rid => {
                  const r = roleOf(rid); if (!r) return '';
                  return `<span class="chip info">${esc(r.name)}</span>`;
                }).join('') : '<span class="muted small">未分配</span>'}</div></td>
                <td class="small">${esc(u.scope)}</td>
                <td class="center"><span class="badge ${on ? 'b-success' : 'b-neutral'}">${on ? '已启用' : '已停用'}</span></td>
                <td class="small num">${esc(u.lastLogin)}</td>
                <td class="center">${u.mfa ? `<span class="chip success">${icon('shield', 13)} 已开启</span>` : `<span class="chip">未开启</span>`}</td>
                <td class="center">
                  <div class="flex gap8" style="justify-content:center">
                    <button class="btn btn-sm" data-edit="${u.id}">编辑</button>
                    <button class="btn btn-sm" data-pwd="${u.id}">重置密码</button>
                    <button class="btn btn-sm ${on ? '' : 'btn-primary'}" data-tg="${u.id}">${on ? '停用' : '启用'}</button>
                    <button class="btn btn-sm btn-ghost" data-del="${u.id}" title="删除">${icon('trash', 16)}</button>
                  </div>
                </td>
              </tr>`;
            }).join('') : `<tr><td colspan="8" class="center muted" style="padding:34px">没有符合条件的用户，请调整筛选条件</td></tr>`}
          </tbody>
        </table>
        </div>
      </div>
      <div class="card-foot">${icon('alert', 15)} 停用用户保留历史处置记录，不做物理删除；删除操作请谨慎，涉及交接责任的账号建议先停用观察。</div>`;

    const kEl = document.getElementById('ukw');
    kEl && kEl.addEventListener('input', e => { kw = e.target.value; const p = kEl.selectionStart; renderUsers(); const n = document.getElementById('ukw'); n.focus(); n.setSelectionRange(p, p); });
    const bindSel = (id, fn) => { const el = document.getElementById(id); el && el.addEventListener('change', e => { fn(e.target.value); renderUsers(); }); };
    bindSel('fDept', v => fDept = v);
    bindSel('fRole', v => fRole = v);
    bindSel('fStatus', v => fStatus = v);

    document.getElementById('btnNewUser').onclick = () => userDialog(null);
    document.getElementById('btnExportUser').onclick = () => toast('已导出《系统用户花名册》Excel（演示）', 'success');

    document.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => userDialog(b.getAttribute('data-edit')));
    document.querySelectorAll('[data-pwd]').forEach(b => b.onclick = () => {
      const u = users.find(x => x.id === b.getAttribute('data-pwd'));
      log('重置密码', u.account, `管理员重置 ${u.name} 的登录密码，已强制下次登录修改`);
      toast(`已重置「${u.name}」的登录密码，下次登录需修改`, 'success');
      render();
    });
    document.querySelectorAll('[data-tg]').forEach(b => b.onclick = () => {
      const u = users.find(x => x.id === b.getAttribute('data-tg'));
      const to = u.status === 'enabled' ? 'disabled' : 'enabled';
      if (u.builtin && to === 'disabled') { toast('内置管理员账号不可停用', 'danger'); return; }
      u.status = to; saveU();
      log(to === 'enabled' ? '启用用户' : '停用用户', u.account, `${u.name}（${u.dept}）账号状态变更为${to === 'enabled' ? '已启用' : '已停用'}`);
      toast(`「${u.name}」已${to === 'enabled' ? '启用' : '停用'}`, 'success');
      render();
    });
    document.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      const u = users.find(x => x.id === b.getAttribute('data-del'));
      if (u.builtin) { toast('内置管理员账号不可删除', 'danger'); return; }
      openDialog({
        title: '删除用户确认', width: 480, okText: '确认删除',
        sub: '删除后该账号将无法登录，历史处置记录保留 180 天',
        body: `<div class="flex acenter gap8"><div class="avatar">${esc(u.name.slice(0, 1))}</div>
          <div><div class="tname">${esc(u.name)}（${esc(u.account)}）</div>
          <div class="tsub">${esc(u.dept)} · ${esc(u.post)} · 拥有 ${u.roles.length} 个角色</div></div></div>
          <div class="notice mt16" style="--nc:var(--danger)">${icon('alert', 17)}<div>建议对承担白晚班交接责任的账号先「停用」而非删除，避免交接单责任人缺失。</div></div>`,
        onOk: (_m, close) => {
          users = users.filter(x => x.id !== u.id); saveU();
          log('删除用户', u.account, `已删除用户 ${u.name}（${u.dept}）`);
          close(); toast('用户已删除', 'success'); render();
        }
      });
    });
  }

  /* ---------------- 用户新增 / 编辑弹窗 ---------------- */
  function userDialog(uid) {
    const u = uid ? users.find(x => x.id === uid) : null;
    const edit = !!u;
    const cur = u ? u.roles.slice() : ['R03'];
    const opts = (arr, val) => arr.map(v => `<option ${v === val ? 'selected' : ''}>${esc(v)}</option>`).join('');

    openDialog({
      title: edit ? '编辑用户' : '新增用户',
      sub: edit ? '可修改资料、调整角色与数据范围' : '新账号初始密码将发送至用户邮箱，首次登录强制修改',
      width: 720,
      body: `
        <div class="field-row">
          <div class="field"><label class="field-label">姓名 *</label><input class="input" id="u_name" autofocus value="${esc(u ? u.name : '')}" placeholder="例如：李明远"></div>
          <div class="field"><label class="field-label">登录账号 *</label><input class="input" id="u_account" value="${esc(u ? u.account : '')}" placeholder="例如：li.my" ${edit ? 'readonly style="background:var(--surface-3)"' : ''}></div>
        </div>
        <div class="field-row">
          <div class="field"><label class="field-label">所属处室 *</label>
            <input class="input" id="u_dept" value="${esc(u ? u.dept : '')}" placeholder="例如：财务处" list="deptList">
            <datalist id="deptList">${depts().map(d => `<option value="${esc(d)}">`).join('')}</datalist></div>
          <div class="field"><label class="field-label">岗位职务</label><input class="input" id="u_post" value="${esc(u ? u.post : '')}" placeholder="例如：结算主管"></div>
        </div>
        <div class="field-row">
          <div class="field"><label class="field-label">手机号码</label><input class="input" id="u_phone" value="${esc(u ? u.phone : '')}" placeholder="用于二次验证"></div>
          <div class="field"><label class="field-label">企业邮箱 *</label><input class="input" id="u_mail" value="${esc(u ? u.mail : '')}" placeholder="用于接收告警邮件"></div>
        </div>
        <div class="field">
          <label class="field-label">分配角色（可多选，权限取并集）</label>
          <div class="pick">
            ${roles.map(r => `<label class="pick-item">
              <input type="checkbox" value="${r.id}" class="rchk" ${cur.includes(r.id) ? 'checked' : ''}>
              <span style="width:4px;height:22px;border-radius:3px;background:${r.color}"></span>
              <span><div style="font-weight:600">${esc(r.name)}</div><div class="sub-note">${esc(r.desc)}</div></span>
              <span class="pi-sub">${usersIn(r.id)} 人 · ${permCount(r)} 权限点</span>
            </label>`).join('')}
          </div>
        </div>
        <div class="field-row">
          <div class="field"><label class="field-label">数据范围</label>
            <select class="select" id="u_scope">${opts(['全部数据', '本处室及下属', '仅本人相关'], u ? u.scope : '本处室及下属')}</select></div>
          <div class="field"><label class="field-label">账号状态</label>
            <select class="select" id="u_status"><option value="enabled" ${u && u.status === 'enabled' ? 'selected' : ''}>启用</option><option value="disabled" ${u && u.status === 'disabled' ? 'selected' : ''}>停用</option></select></div>
        </div>
        <label class="checkline"><input type="checkbox" id="u_mfa" ${u && u.mfa ? 'checked' : ''}> 强制开启二次验证（短信 / 令牌）</label>`,
      onOk: (_m, close) => {
        const name = getVal('u_name'), account = getVal('u_account'), dept = getVal('u_dept'), mail = getVal('u_mail');
        if (!name) { toast('请填写姓名', 'danger'); return; }
        if (!account) { toast('请填写登录账号', 'danger'); return; }
        if (!edit && users.some(x => x.account === account)) { toast('该登录账号已存在', 'danger'); return; }
        if (!mail.includes('@')) { toast('请填写有效的企业邮箱', 'danger'); return; }
        const rs = Array.from(document.querySelectorAll('.rchk:checked')).map(i => i.value);
        if (!rs.length) { toast('请至少分配一个角色', 'danger'); return; }
        const data = {
          name, account, dept: dept || '未分组', post: getVal('u_post') || '—',
          phone: getVal('u_phone') || '—', mail, roles: rs,
          scope: getVal('u_scope'), status: getVal('u_status'), mfa: getChk('u_mfa')
        };
        if (edit) {
          Object.assign(u, data);
          log('编辑用户', account, `更新 ${name} 的资料 / 角色 / 数据范围`);
        } else {
          users.push(Object.assign({ id: 'U' + Date.now().toString().slice(-6), lastLogin: '从未登录', created: fmtDT(new Date()).slice(0, 10), builtin: false }, data));
          log('新增用户', account, `新建用户 ${name}（${dept}），分配角色 ${rs.length} 个`);
        }
        saveU(); close();
        toast(edit ? '用户信息已保存' : `用户「${name}」已创建，初始密码已发送至邮箱`, 'success');
        render();
      }
    });
  }

  /* ---------------- Tab 2：角色与权限矩阵 ---------------- */
  function renderRoles() {
    const r = roleOf(selRole);
    const isAdminBuiltin = r.builtin;
    document.getElementById('pane').innerHTML = `
      <div class="card-body">
        <div class="grid g-32" style="gap:18px">
          <div>
            <div class="flex between acenter" style="margin-bottom:12px">
              <div class="font-b">系统角色（${roles.length}）</div>
              <button class="btn btn-sm btn-primary" id="btnNewRole">${icon('plus', 15)} 新建角色</button>
            </div>
            <div class="role-list">
              ${roles.map(x => `
                <div class="role-item ${x.id === selRole ? 'active' : ''}" data-role="${x.id}">
                  <div class="ri-top">
                    <div class="ri-bar" style="background:${x.color}"></div>
                    <div style="flex:1;min-width:0">
                      <div class="ri-name">${esc(x.name)}
                        ${x.builtin ? '<span class="badge b-primary" style="margin-left:6px">内置</span>' : ''}
                        <span class="badge b-neutral" style="margin-left:6px">${esc(x.level)}</span></div>
                      <div class="ri-sub">${esc(x.desc)}</div>
                    </div>
                  </div>
                  <div class="ri-foot">
                    <span class="chip info">${icon('users', 13)} ${usersIn(x.id)} 人</span>
                    <span class="chip success">${icon('key', 13)} ${permCount(x)} / ${TOTAL_PERM} 权限点</span>
                  </div>
                </div>`).join('')}
            </div>
          </div>

          <div>
            <div class="flex between acenter" style="margin-bottom:12px">
              <div>
                <div class="font-b">权限矩阵 · ${esc(r.name)}
                  ${isAdminBuiltin ? `<span class="badge b-warn" style="margin-left:8px">${icon('lock', 13)} 内置角色，谨慎修改</span>` : ''}
                </div>
                <div class="sub-note">勾选该角色可执行的操作，保存后立即对该角色下全部用户生效</div>
              </div>
              <div class="flex gap8">
                <button class="btn btn-sm" id="btnClearPerm">清空权限</button>
                <button class="btn btn-sm" id="btnFullPerm">授予全部</button>
                <button class="btn btn-sm" id="btnCopyRole">${icon('plus', 15)} 复制角色</button>
                <button class="btn btn-sm btn-ghost" id="btnDelRole" title="删除角色">${icon('trash', 16)}</button>
              </div>
            </div>
            <div style="overflow-x:auto">
            <table class="table matrix">
              <thead><tr>
                <th style="min-width:230px">功能模块</th>
                ${PERM_ACTIONS.map(a => `<th class="center">${a.label}</th>`).join('')}
                <th class="center">整行</th>
              </tr></thead>
              <tbody>
                ${PERM_MODULES.map(m => {
                  const cur = r.perms[m.id] || [];
                  return `<tr>
                    <td><div class="tname">${esc(m.name)}</div><div class="tsub">${esc(m.desc)}</div></td>
                    ${PERM_ACTIONS.map(a => `<td class="center"><input type="checkbox" class="pchk" data-m="${m.id}" data-a="${a.id}" ${cur.includes(a.id) ? 'checked' : ''}></td>`).join('')}
                    <td class="center"><button class="link-btn" data-allrow="${m.id}">全选</button></td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
            </div>
            <div class="perm-sum mt16" id="permSum"></div>
          </div>
        </div>
      </div>
      <div class="card-foot">${icon('check', 15)} 用户最终权限 = 其所拥有全部角色权限的并集；同一角色内未勾选的操作将被拒绝并记录在操作日志中。</div>`;

    updateSum();

    document.querySelectorAll('[data-role]').forEach(el => el.onclick = () => { selRole = el.getAttribute('data-role'); renderRoles(); });
    document.getElementById('btnNewRole').onclick = () => roleDialog(null);

    document.getElementById('btnCopyRole').onclick = () => {
      const nr = {
        id: 'R' + Date.now().toString().slice(-5), name: r.name + '（副本）', builtin: false, level: r.level, users: 0, color: r.color,
        desc: '复制自「' + r.name + '」，可按需微调权限',
        perms: JSON.parse(JSON.stringify(r.perms))
      };
      roles.push(nr); saveR(); selRole = nr.id;
      log('新建角色', nr.name, `以「${r.name}」为模板复制生成新角色，权限点 ${permCount(nr)} 个`);
      toast('已复制生成新角色，请调整名称与权限', 'success');
      renderRoles();
    };

    document.getElementById('btnDelRole').onclick = () => {
      if (r.builtin) { toast('内置角色不可删除', 'danger'); return; }
      const n = usersIn(r.id);
      if (n) { toast(`该角色下仍有 ${n} 名用户，请先改派角色`, 'danger'); return; }
      openDialog({
        title: '删除角色确认', width: 460, okText: '确认删除',
        body: `<div class="tname">${esc(r.name)}</div><div class="tsub">${esc(r.desc)}</div>
          <div class="notice mt16" style="--nc:var(--warn)">${icon('alert', 17)}<div>删除后不可恢复，请确认该角色已无人使用。</div></div>`,
        onOk: (_m, close) => {
          roles = roles.filter(x => x.id !== r.id); saveR(); selRole = roles[0].id;
          log('删除角色', r.name, '已删除自定义角色');
          close(); toast('角色已删除', 'success'); renderRoles();
        }
      });
    };

    document.getElementById('btnClearPerm').onclick = () => {
      if (isAdminBuiltin) { toast('内置超级管理员角色不可清空权限', 'danger'); return; }
      r.perms = {}; PERM_MODULES.forEach(m => r.perms[m.id] = []);
      saveR(); log('编辑权限', r.name, '清空该角色全部权限点'); renderRoles();
      toast('已清空该角色全部权限', 'success');
    };

    document.getElementById('btnFullPerm').onclick = () => {
      r.perms = {}; PERM_MODULES.forEach(m => r.perms[m.id] = PERM_ACTIONS.map(a => a.id));
      saveR(); log('编辑权限', r.name, `授予该角色全部 ${TOTAL_PERM} 个权限点`); renderRoles();
      toast('已授予全部权限', 'success');
    };

    document.querySelectorAll('.pchk').forEach(cb => cb.onchange = () => {
      const m = cb.getAttribute('data-m'), a = cb.getAttribute('data-a');
      const arr = r.perms[m] || (r.perms[m] = []);
      if (cb.checked) { if (!arr.includes(a)) arr.push(a); }
      else r.perms[m] = arr.filter(x => x !== a);
      saveR(); updateSum();
      log('编辑权限', r.name, `${PERM_MODULES.find(x => x.id === m).name}：${cb.checked ? '授予' : '收回'}【${PERM_ACTIONS.find(x => x.id === a).label}】`);
    });

    document.querySelectorAll('[data-allrow]').forEach(b => b.onclick = () => {
      const m = b.getAttribute('data-allrow');
      r.perms[m] = PERM_ACTIONS.map(a => a.id);
      saveR(); log('编辑权限', r.name, `${PERM_MODULES.find(x => x.id === m).name}：授予全部操作`);
      renderRoles(); toast('已授予该模块全部操作权限', 'success');
    });
  }

  function updateSum() {
    const el = document.getElementById('permSum'), r = roleOf(selRole);
    if (!el) return;
    const n = permCount(r);
    el.innerHTML = `${icon('key', 17)} 当前角色共 <strong style="font-size:17px">${n}</strong> / ${TOTAL_PERM} 个权限点，覆盖 ${Object.values(r.perms).filter(a => a.length).length} / ${PERM_MODULES.length} 个功能模块`;
  }

  /* ---------------- 角色新建弹窗 ---------------- */
  function roleDialog() {
    openDialog({
      title: '新建角色',
      sub: '可从已有角色复制权限后微调，也可以建立空白角色逐项授权',
      width: 620,
      body: `
        <div class="field"><label class="field-label">角色名称 *</label><input class="input" id="r_name" autofocus placeholder="例如：设备巡检专员"></div>
        <div class="field"><label class="field-label">角色说明</label><input class="input" id="r_desc" placeholder="一句话描述该角色的职责边界"></div>
        <div class="field-row">
          <div class="field"><label class="field-label">角色级别</label>
            <select class="select" id="r_level"><option>系统级</option><option selected>管理级</option><option>执行级</option><option>审计级</option><option>访客级</option></select></div>
          <div class="field"><label class="field-label">权限来源</label>
            <select class="select" id="r_from"><option value="">空白角色（逐项授权）</option>
              ${roles.map(r => `<option value="${r.id}">复制「${esc(r.name)}」的权限</option>`).join('')}</select></div>
        </div>`,
      onOk: (_m, close) => {
        const name = getVal('r_name');
        if (!name) { toast('请填写角色名称', 'danger'); return; }
        if (roles.some(r => r.name === name)) { toast('同名角色已存在', 'danger'); return; }
        const from = getVal('r_from');
        const src = from ? roleOf(from) : null;
        const nr = {
          id: 'R' + Date.now().toString().slice(-5), name, builtin: false,
          level: getVal('r_level'), users: 0, color: '#0b6a86',
          desc: getVal('r_desc') || '自定义角色',
          perms: src ? JSON.parse(JSON.stringify(src.perms)) : {}
        };
        PERM_MODULES.forEach(m => { if (!nr.perms[m.id]) nr.perms[m.id] = []; });
        roles.push(nr); saveR(); selRole = nr.id;
        log('新建角色', name, src ? `以「${src.name}」为模板创建` : '创建空白角色，待逐项授权');
        close(); toast(`角色「${name}」已创建，请配置权限`, 'success');
        renderRoles();
      }
    });
  }

  /* ---------------- Tab 3：操作日志 ---------------- */
  function renderAudit() {
    const rows = audit.filter(a => !kw || (a.user + a.action + a.target + a.detail + a.ip).toLowerCase().includes(kw.toLowerCase()));
    const actColor = { '新增用户': 'b-success', '编辑用户': 'b-info', '删除用户': 'b-danger', '启用用户': 'b-success', '停用用户': 'b-warn', '重置密码': 'b-warn', '编辑权限': 'b-primary', '新建角色': 'b-success', '删除角色': 'b-danger', '登录': 'b-neutral', '导出数据': 'b-info' };

    document.getElementById('pane').innerHTML = `
      <div class="card-body">
        <div class="toolbar">
          <div class="search">${icon('search', 17)}<input class="input" id="akw" placeholder="搜索操作人 / 动作 / 对象 / IP" value="${esc(kw)}"></div>
          <span class="small muted">共 ${audit.length} 条授权留痕，保留 180 天</span>
          <button class="btn" id="btnExportAudit">${icon('download', 17)} 导出审计报表</button>
        </div>
      </div>
      <div class="card-body" style="padding:0">
        <div style="overflow-x:auto">
        <table class="table">
          <thead><tr><th>时间</th><th>操作人</th><th>动作</th><th>操作对象</th><th class="center">结果</th><th>来源 IP</th><th>详情</th></tr></thead>
          <tbody>
            ${rows.length ? rows.map(a => `<tr>
              <td class="small num">${esc(a.time)}</td>
              <td class="tname">${esc(a.user)}</td>
              <td><span class="badge ${actColor[a.action] || 'b-neutral'}">${esc(a.action)}</span></td>
              <td class="small">${esc(a.target)}</td>
              <td class="center"><span class="badge ${a.result === '成功' ? 'b-success' : 'b-danger'}">${esc(a.result)}</span></td>
              <td class="small num">${esc(a.ip)}</td>
              <td class="small muted">${esc(a.detail)}</td>
            </tr>`).join('') : `<tr><td colspan="7" class="center muted" style="padding:34px">没有匹配的日志记录</td></tr>`}
          </tbody>
        </table>
        </div>
      </div>
      <div class="card-foot">${icon('shield', 15)} 用户、角色、权限的所有变更均写入审计日志，满足等保与内控审计追溯要求。</div>`;

    const kEl = document.getElementById('akw');
    kEl && kEl.addEventListener('input', e => { kw = e.target.value; const p = kEl.selectionStart; renderAudit(); const n = document.getElementById('akw'); n.focus(); n.setSelectionRange(p, p); });
    document.getElementById('btnExportAudit').onclick = () => toast('已导出《权限变更审计报表》PDF（演示）', 'success');
  }

  render();
})();
