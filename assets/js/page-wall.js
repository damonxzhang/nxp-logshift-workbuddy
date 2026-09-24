/* ============ 监控室 · 多屏轮播（每屏标配能力 N3） ============
   需求来源：09-24 会议 N3「多屏滚动展示」——带班桌多块大屏分别展示不同 KPI，
   自动滚动展示 + 支持手动切换 + 大字号适配（Surface Go / Surface Pro 平板亦可用）。
   屏清单与滚动频率「待 09-29 与客户确认」，故做成配置入口。 */
(function () {
  renderShell('wall');

  /* 轮播屏清单：前 3 块为 KPI 看板屏（P1/P2 已落地），其余为标配与底座能力屏。
     客户规划的 8 块屏（Cell Time / EO / OTD 等）清单待确认，此处以现有屏占位。 */
  const WALL_SCREENS = [
    { key: 'index', href: 'index.html', name: '监控总览', kpi: '全厂健康度 · 告警流水', icon: 'grid', tag: '已上线' },
    { key: 'evidence', href: 'evidence.html', name: '生产交易日志看板', kpi: '交接 · 设备异常 · FLT', icon: 'image', tag: 'P1' },
    { key: 'pit', href: 'pit.html', name: '各站凹库看板', kpi: '凹库量 · 在库时长', icon: 'database', tag: 'P2' },
    { key: 'alerts', href: 'alerts.html', name: '预警组件', kpi: '阈值 · 强制弹窗 · 语音', icon: 'bell', tag: '标配' },
    { key: 'mail', href: 'mail.html', name: '邮件组件', kpi: '告警邮件投递', icon: 'mail', tag: '标配' },
    { key: 'analytics', href: 'analytics.html', name: '异常根因分析', kpi: '高频告警 · 根因聚类', icon: 'search', tag: '已上线' },
    { key: 'monthly', href: 'monthly.html', name: '自动月报', kpi: '月度汇总', icon: 'file', tag: '已上线' },
    { key: 'archive', href: 'archive.html', name: '历史日志归档', kpi: '归档 · 审计检索', icon: 'download', tag: '已上线' }
  ];

  const INTERVALS = [
    { v: 15000, t: '15 秒' }, { v: 30000, t: '30 秒' }, { v: 60000, t: '1 分钟' },
    { v: 120000, t: '2 分钟' }, { v: 300000, t: '5 分钟' }
  ];

  let cfg = store.get('wall_cfg', { interval: 60000, list: WALL_SCREENS.map(s => s.key), large: false });
  if (!Array.isArray(cfg.list) || !cfg.list.length) cfg.list = WALL_SCREENS.map(s => s.key);
  const save = () => store.set('wall_cfg', cfg);

  const list = () => WALL_SCREENS.filter(s => cfg.list.includes(s.key));
  let idx = 0, timer = null, left = 0, playing = true;

  function cur() { const l = list(); return l[Math.min(idx, l.length - 1)]; }

  function tick() {
    const bar = document.getElementById('wallProg');
    if (!bar) return;
    const pct = Math.max(0, 100 - left / cfg.interval * 100);
    bar.style.width = pct.toFixed(1) + '%';
  }

  function loop() {
    clearInterval(timer);
    if (!playing) return;
    left = cfg.interval;
    timer = setInterval(() => {
      left -= 1000;
      tick();
      if (left <= 0) { const l = list(); idx = (idx + 1) % l.length; mount(); }
    }, 1000);
    tick();
  }

  function mount() {
    const s = cur();
    const frame = document.getElementById('wallFrame');
    if (frame && s) frame.src = s.href;
    const nameEl = document.getElementById('wallName');
    const kpiEl = document.getElementById('wallKpi');
    const noEl = document.getElementById('wallNo');
    if (nameEl) nameEl.textContent = s ? s.name : '—';
    if (kpiEl) kpiEl.textContent = s ? s.kpi : '';
    if (noEl) noEl.textContent = `${idx + 1} / ${list().length}`;
    document.querySelectorAll('.screen-tile').forEach(t => {
      t.classList.toggle('on', s && t.dataset.k === s.key);
    });
    left = cfg.interval;
    tick();
  }

  function go(delta) {
    const l = list();
    idx = (idx + delta + l.length) % l.length;
    mount();
    if (playing) loop();
  }

  /* ---------- N1 多级报警演练：屏幕变红 + 强制弹窗 + 语音播报 ---------- */
  function alarmDrill() {
    document.body.classList.add('wall-alarm');
    const sample = {
      title: '备件超期未更换',
      item: 'YP-002 冷却循环泵',
      station: 'NLD 站 · NLD-B03',
      expected: '下次保养 2026-08-12',
      actual: '已超期 43 天（2026-09-24）',
      level: '严重',
      diff: '43 天'
    };
    const mask = document.createElement('div');
    mask.className = 'force-mask';
    mask.id = 'forceAlarm';
    mask.innerHTML = `
      <div class="force-modal">
        <div class="force-head">
          <div class="force-bell">${icon('alert', 26, 2)}</div>
          <div>
            <div class="force-title">${sample.title}</div>
            <div class="force-sub">${sample.station} · 触发级别：<strong>${sample.level}</strong></div>
          </div>
        </div>
        <div class="force-body">
          <div class="force-item">${sample.item}</div>
          <table class="force-cmp">
            <tr><th>预期值</th><td>${sample.expected}</td></tr>
            <tr><th>实际值</th><td class="bad">${sample.actual}</td></tr>
            <tr><th>偏差</th><td class="bad">超出 ${sample.diff}</td></tr>
          </table>
          <div class="small muted">该报警按「屏幕变红 + 强制弹窗 + 语音播报」三级组合触发，需人工确认后解除。</div>
        </div>
        <div class="force-foot">
          <button class="btn" id="faMute">${icon('speaker', 16)} 停止播报</button>
          <button class="btn btn-primary" id="faAck">${icon('check', 16)} 已知悉 · 解除报警</button>
        </div>
      </div>`;
    document.body.appendChild(mask);

    Voice.speakTimes(`紧急报警，${sample.item}，${sample.title}，实际值超出预期 ${sample.diff}，请立即处置`);

    const close = () => {
      document.body.classList.remove('wall-alarm');
      Voice.stop();
      const el = document.getElementById('forceAlarm');
      if (el) el.remove();
      const log = store.get('alarmAck', []);
      log.unshift({ time: fmtDT(new Date()), item: sample.item, by: (CurrentUser.get() || {}).name || '—' });
      store.set('alarmAck', log.slice(0, 20));
      toast('报警已确认并留痕（处置记录已写入审计日志）', 'success');
      renderAck();
    };
    mask.querySelector('#faAck').onclick = close;
    mask.querySelector('#faMute').onclick = () => { Voice.stop(); toast('已停止语音播报', 'warn'); };
  }

  function renderAck() {
    const box = document.getElementById('ackBox');
    if (!box) return;
    const log = store.get('alarmAck', []);
    box.innerHTML = log.length
      ? log.slice(0, 6).map(l => `<div class="flex between acenter" style="padding:6px 0;border-bottom:1px dashed var(--border)">
          <span class="small">${icon('check', 15)} ${esc(l.item)}</span>
          <span class="small muted num">${esc(l.time)} · ${esc(l.by)}</span></div>`).join('')
      : '<div class="small muted">暂无报警确认记录</div>';
  }

  function render() {
    const canEdit = CurrentUser.can('wall', 'edit') || CurrentUser.can('wall', 'create');
    document.getElementById('content').innerHTML = `
    <div class="notice" style="--nc:var(--primary)">
      ${icon('layers', 19)}
      <div><strong>监控室 · 多屏轮播：</strong>带班桌多块大屏各展示一类 KPI，系统按设定间隔<strong>自动滚动</strong>，也支持<strong>手动切换</strong>与<strong>大字号</strong>适配（Surface Go / Pro 平板同样可用）。
      屏清单、滚动频率（1 分钟 / 半分钟）与部署方式（8 台设备各开一地址 vs 单机轮播）<strong>待 09-29 与客户确认</strong>。</div>
    </div>

    <div class="card mt16">
      <div class="card-head">
        <div class="card-title">${icon('monitor', 19)} 轮播舞台
          <span class="badge b-neutral" id="wallNo">1 / ${list().length}</span></div>
        <div class="flex acenter gap8">
          <button class="btn btn-sm" id="btnPrev" title="上一屏">${icon('arrowRight', 16, 1.8)}</button>
          <button class="btn btn-sm btn-primary" id="btnPlay">${icon(playing ? 'clock' : 'zap', 16)} ${playing ? '暂停轮播' : '继续轮播'}</button>
          <button class="btn btn-sm" id="btnNext" title="下一屏">${icon('arrowRight', 16, 1.8)}</button>
          <button class="btn btn-sm" id="btnDrill" title="演示屏幕变红 + 强制弹窗 + 语音播报">${icon('alert', 16)} 报警演练</button>
          <button class="btn btn-sm" id="btnFull">${icon('grid', 16)} 全屏</button>
        </div>
      </div>
      <div class="wall-progress"><i id="wallProg"></i></div>
      <div class="card-body">
        <div class="wall-meta">
          <div>
            <div class="wall-name" id="wallName">—</div>
            <div class="wall-kpi" id="wallKpi"></div>
          </div>
          <div class="flex acenter gap8">
            <span class="chip" id="intervalChip">间隔 ${(INTERVALS.find(i => i.v === cfg.interval) || INTERVALS[2]).t}</span>
            <span class="chip">${cfg.large ? '大字号' : '标准字号'}</span>
          </div>
        </div>
        <div class="wall-stage" id="wallStage">
          <iframe id="wallFrame" src="" title="看板轮播"></iframe>
        </div>
        <div class="small muted mt16">${icon('alert', 15)} 轮播内容为各看板真实页面（已裁去侧边栏与顶栏）；大屏实际部署时可直接常驻打开某一屏地址，无需轮播。</div>
      </div>
    </div>

    <div class="grid g-32 mt16">
      <div class="card">
        <div class="card-head">
          <div class="card-title">${icon('settings', 19)} 轮播配置
            <span class="card-sub">预留入口 · 待客户确认</span></div>
          ${canEdit ? '' : '<span class="chip">只读（角色权限）</span>'}
        </div>
        <div class="card-body">
          <div class="cfg-item mb12">
            <label class="field-label">滚动间隔</label>
            <div class="seg" id="segInt">
              ${INTERVALS.map(i => `<button data-v="${i.v}" class="${cfg.interval === i.v ? 'active' : ''}">${i.t}</button>`).join('')}
            </div>
          </div>
          <div class="cfg-item mb12">
            <label class="field-label">大字号（适配大屏 / 平板）</label>
            <div class="seg" id="segLarge">
              <button data-v="0" class="${!cfg.large ? 'active' : ''}">标准字号</button>
              <button data-v="1" class="${cfg.large ? 'active' : ''}">大字号</button>
            </div>
          </div>
          <div class="cfg-item">
            <label class="field-label">参与轮播的屏（勾选）</label>
            <div class="screen-pick">
              ${WALL_SCREENS.map(s => `
                <label class="pick-row ${cfg.list.includes(s.key) ? 'on' : ''}">
                  <input type="checkbox" value="${s.key}" ${cfg.list.includes(s.key) ? 'checked' : ''} ${canEdit ? '' : 'disabled'}>
                  <span class="flex acenter gap8">${icon(s.icon, 17)} ${s.name}</span>
                  <span class="nav-tag ${s.tag === 'P1' || s.tag === 'P2' ? 't-red' : (s.tag === '标配' ? 't-purple' : 't-plain')}">${s.tag}</span>
                </label>`).join('')}
            </div>
          </div>
          <div class="cfg-note">${icon('alert', 15)} 带班桌 8 块屏的<strong>屏清单与对应 KPI</strong>、以及「8 台设备各开一地址」还是「单机轮播」，均需周二与客户确认后固化。</div>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <div class="card-title">${icon('grid', 19)} 屏清单速览
            <span class="card-sub">点击直接跳转该屏</span></div>
        </div>
        <div class="card-body">
          <div class="wall-grid">
            ${list().map((s, i) => `
              <a class="screen-tile ${i === idx ? 'on' : ''}" data-k="${s.key}" href="${s.href}">
                <div class="st-icon">${icon(s.icon, 22)}</div>
                <div class="st-name">${s.name}</div>
                <div class="st-kpi">${s.kpi}</div>
                <div class="st-no">${i + 1}</div>
              </a>`).join('')}
          </div>
          <div class="mt16">
            <div class="field-label mb12" style="display:block">${icon('check', 15)} 报警确认留痕（审计）</div>
            <div id="ackBox"></div>
          </div>
        </div>
      </div>
    </div>`;

    // 事件绑定
    document.getElementById('btnPrev').onclick = () => go(-1);
    document.getElementById('btnNext').onclick = () => go(1);
    document.getElementById('btnPlay').onclick = e => {
      playing = !playing;
      e.currentTarget.innerHTML = `${icon(playing ? 'clock' : 'zap', 16)} ${playing ? '暂停轮播' : '继续轮播'}`;
      if (playing) loop(); else clearInterval(timer);
      toast(playing ? '已继续自动轮播' : '已暂停轮播，可手动切换', 'primary');
    };
    document.getElementById('btnDrill').onclick = alarmDrill;
    document.getElementById('btnFull').onclick = () => {
      const el = document.getElementById('wallStage');
      if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen();
      else if (document.exitFullscreen) document.exitFullscreen();
    };
    document.querySelectorAll('#segInt button').forEach(b => {
      b.onclick = () => { cfg.interval = Number(b.dataset.v); save(); render(); loop(); };
    });
    document.querySelectorAll('#segLarge button').forEach(b => {
      b.onclick = () => {
        cfg.large = b.dataset.v === '1'; save();
        document.body.classList.toggle('wall-large', cfg.large);
        render(); loop();
      };
    });
    document.querySelectorAll('.screen-pick input').forEach(cb => {
      cb.onchange = () => {
        cfg.list = Array.from(document.querySelectorAll('.screen-pick input:checked')).map(c => c.value);
        if (!cfg.list.length) { cfg.list = [WALL_SCREENS[0].key]; toast('至少保留一屏参与轮播', 'warn'); }
        save(); idx = 0; render(); loop();
      };
    });

    document.body.classList.toggle('wall-large', !!cfg.large);
    mount();
    loop();
    renderAck();
  }

  render();
})();
