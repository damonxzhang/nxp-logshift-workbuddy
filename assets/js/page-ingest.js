/* ============ 数据采集与调度：页面提供各子系统对接调用日志 ============ */
(function () {
  renderShell('ingest');

  let logs = buildCallLogs();
  let kw = '', sysF = 'all', resF = 'all', range = 'today';
  let live = false, timer = null, detail = null;

  const liveTpl = [
    { sys: 'PAY', mode: 'A', kind: 'REST 状态拉取', ep: 'GET https://pay-gw.corp.internal:8443/api/v1/health', http: 200, cost: 132, rows: 1, res: 'success' },
    { sys: 'IAM', mode: 'A', kind: 'REST 状态拉取', ep: 'GET https://iam.corp.internal/api/v1/health', http: 200, cost: 97, rows: 1, res: 'success' },
    { sys: 'NET', mode: 'A', kind: 'Prometheus 指标查询', ep: 'GET https://prom.corp.internal/api/v1/query?query=up', http: 200, cost: 168, rows: 42, res: 'success' },
    { sys: 'SET', mode: 'A', kind: '事件增量拉取', ep: 'GET https://settle.corp.internal/api/v1/events?since=evt_44099', http: 200, cost: 1421, rows: 3, res: 'success' },
    { sys: 'TMS', mode: 'B', kind: '只读库轮询 SQL', ep: 'SELECT ... FROM tms.ops_event WHERE id > :watermark', http: 200, cost: 1104, rows: 2, res: 'success' },
    { sys: 'BAS', mode: 'A', kind: 'Syslog 事件接收', ep: 'syslog udp://10.20.31.9:514', http: 200, cost: 41, rows: 1, res: 'success' },
    { sys: 'VMS', mode: 'A', kind: 'REST 状态拉取', ep: 'GET https://vms.corp.internal/api/v1/health', http: 200, cost: 3041, rows: 0, res: 'timeout', note: '流读取超时 3000ms，下个周期自动重试' },
    { sys: 'ERP', mode: 'A', kind: 'gRPC 流式订阅', ep: 'grpc stream erpsvc.Monitor/Subscribe', http: 200, cost: 66, rows: 2, res: 'success' },
    { sys: 'BI', mode: 'A', kind: '事件增量拉取', ep: 'GET https://bi.corp.internal/api/v1/events?since=evt_12099', http: 200, cost: 92, rows: 0, res: 'empty' },
    { sys: 'WMS', mode: 'B', kind: '只读库轮询 SQL', ep: 'SELECT ... FROM wms.handover_task WHERE id > :watermark', http: 0, cost: 5000, rows: 0, res: 'conn', note: '目标主节点故障切换中，连接被拒绝' }
  ];
  let liveSeq = 0;

  function sysName(id) { const s = SUBSYSTEMS.find(x => x.id === id); return s ? s.name : id; }

  function filtered() {
    const now = new Date();
    return logs.filter(l => {
      const m1 = !kw || (sysName(l.sys) + l.kind + l.ep + l.id).toLowerCase().includes(kw.toLowerCase());
      const m2 = sysF === 'all' || l.sys === sysF;
      const m3 = resF === 'all' || l.res === resF;
      let m4 = true;
      if (range === '1h') m4 = now - l.ts <= 3600000;
      else if (range === '6h') m4 = now - l.ts <= 21600000;
      else if (range === 'today') m4 = l.ts.toDateString() === now.toDateString();
      return m1 && m2 && m3 && m4;
    });
  }

  function stat(list) {
    const total = list.length;
    const ok = list.filter(l => l.res === 'success' || l.res === 'empty').length;
    const fail = list.filter(l => ['timeout', 'auth', 'conn'].includes(l.res)).length;
    const slow = list.filter(l => l.res === 'slow').length;
    const avg = total ? Math.round(list.reduce((a, b) => a + b.cost, 0) / total) : 0;
    const rows = list.reduce((a, b) => a + b.rows, 0);
    return { total, ok, fail, slow, avg, rows, rate: total ? (ok / total * 100).toFixed(1) : '0.0' };
  }

  // 各子系统对接情况汇总
  function overview() {
    return SUBSYSTEMS.map(s => {
      const ls = logs.filter(l => l.sys === s.id);
      if (!ls.length) return { id: s.id, name: s.name, mode: s.mode, last: '—', lastRes: null, calls: 0, rate: '—', avg: '—', rows: 0 };
      const last = ls[0];
      const ok = ls.filter(l => ['success', 'empty'].includes(l.res)).length;
      return {
        id: s.id, name: s.name, mode: last.mode,
        last: last.time.slice(11), lastRes: last.res,
        calls: ls.length, rate: (ok / ls.length * 100).toFixed(0),
        avg: Math.round(ls.reduce((a, b) => a + b.cost, 0) / ls.length), rows: ls.reduce((a, b) => a + b.rows, 0)
      };
    });
  }

  function detailHtml(l) {
    const s = SUBSYSTEMS.find(x => x.id === l.sys) || {};
    const req = `${l.ep}
X-Request-Id: ${l.id}
${l.mode === 'A'
        ? 'Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9…（OAuth2 客户端凭证，30 分钟续期）\nAccept: application/json\nTimeout: 3000ms  Retry: 3'
        : 'User: monitor_ro（只读账号，仅 SELECT）\nPool: 8  Timeout: 2000ms  ReadOnly: true  AutoCommit: false'}`;

    const evt = { eventId: 'evt_' + (77000 + Math.abs(l.id.length * 37) % 900), level: l.res === 'success' ? 'minor' : 'critical', subsystem: l.sys, occurredAt: l.time, summary: '事务响应超时，已记录告警', owner: s.owner || '—' };
    const resp = l.res === 'conn'
      ? `dial tcp ${s.id === 'WMS' ? '10.20.31.28:3306' : '10.20.31.18:3306'}: connect: connection refused\n（已计入连续失败计数 3/3，该子系统标记为离线状态）`
      : l.res === 'timeout'
        ? `Context deadline exceeded (3000ms)\nwatermark: 未推进（保持 evt_77120 不变）\nstrategy: 下个调度周期自动重试，连续 3 次失败后降级为低频轮询`
        : l.res === 'auth'
          ? `HTTP/1.1 401 Unauthorized\n{"code":401,"message":"token expired"}\n→ 已自动刷新令牌并重放一次，重放结果：200 OK`
          : JSON.stringify({
            code: l.http, traceId: l.id, subsystem: l.sys, tookMs: l.cost,
            events: Array.from({ length: Math.min(l.rows, 3) }, () => evt),
            nextWatermark: 'evt_' + (77200 + Math.abs(l.cost % 500)),
            hasMore: l.rows > 3
          }, null, 2);

    const advice = {
      timeout: '① 检查目标节点与网络连通性；② 确认 SQL/接口是否有慢查询或未走索引；③ 连续 3 次失败将自动降级为低频轮询。',
      conn: '① 确认目标主机存活与端口放行；② 只读库请联系 DBA 确认故障切换是否完成；③ 恢复后系统自动切回正常周期。',
      auth: '① 检查 OAuth2 客户端密钥是否过期；② 确认网关系统时间与 NTP 同步（偏差 > 5 分钟会导致令牌失效）。',
      slow: '① 建议为 occurred_at / update_time 补充索引；② 与业务侧错峰执行重任务；③ 持续超阈值将记入慢调用审计报告。',
      empty: '无新数据属正常情况，事件水位未推进，不产生重复告警。',
      success: '调用正常，已按事件水位完成增量同步。'
    }[l.res] || '';

    return `
      <div class="fixed-kv" style="margin-bottom:16px">
        <div>日志编号</div><div class="log-meta">${l.id}</div>
        <div>发生时间</div><div>${l.time}</div>
        <div>目标子系统</div><div>${sysName(l.sys)}（${l.id && s.id ? s.id : ''} · ${s.db || ''} ${s.ver || ''}）</div>
        <div>负责人</div><div>${s.owner || '—'}</div>
        <div>采集模式</div><div>模式 ${l.mode}（${l.mode === 'A' ? 'API / 日志网关订阅' : '只读库直连抓取'}）</div>
        <div>调用结果</div><div><span class="badge ${RES_META[l.res].cls}">${RES_META[l.res].label}</span> ${l.note ? '· ' + l.note : ''}</div>
      </div>
      <div class="field"><label class="field-label">请求报文</label><div class="code-box" style="white-space:pre-wrap">${esc(req)}</div></div>
      <div class="field"><label class="field-label">响应报文</label><div class="code-box" style="white-space:pre-wrap;max-height:280px;overflow:auto">${esc(resp)}</div></div>
      <div class="notice" style="--nc:var(--primary)">${icon('alert', 17)}<div><strong>处置建议：</strong>${advice}</div></div>`;
  }

  function render() {
    const rows = filtered();
    const st = stat(rows);
    const ov = overview();
    const failDist = ['timeout', 'conn', 'auth', 'slow']
      .map(k => ({ key: k, label: RES_META[k].label, value: logs.filter(l => l.res === k).length, color: RES_META[k].color }))
      .filter(x => x.value > 0);
    const slowTop = overview().filter(o => o.calls && o.avg > 400).sort((a, b) => b.avg - a.avg).slice(0, 5)
      .map(o => ({ label: o.name, value: o.avg, color: o.avg > 1500 ? '#cc2f2a' : o.avg > 800 ? '#a8620b' : '#1d4ed8' }));

    document.getElementById('content').innerHTML = `
    <div class="notice" style="--nc:var(--primary)">
      ${icon('activity', 19)}
      <div><strong>页面说明：</strong>本页用于查看<strong>各子系统的数据对接调用日志</strong>，实时反映每一次采集调用了谁、花了多久、返回多少条、是否成功，便于快速定位哪一环没打通。</div>
    </div>

    <div class="grid g-6 mt16">
      ${[
        { n: '今日调用总次数', v: st.total, u: '次', f: '覆盖 ' + new Set(rows.map(r => r.sys)).size + ' 个子系统', c: '#1d4ed8', s: '#e7eeff', i: 'activity' },
        { n: '调用成功率', v: st.rate, u: '%', f: `成功 ${st.ok} · 无数据 ${rows.filter(r => r.res === 'empty').length}`, c: '#12805a', s: '#e3f6ee', i: 'check' },
        { n: '平均响应耗时', v: st.avg, u: 'ms', f: '慢调用阈值 1500ms（模式 A）/ 2000ms（模式 B）', c: '#0b6a86', s: '#e2f3f9', i: 'clock' },
        { n: '异常调用次数', v: st.fail + st.slow, u: '次', f: `失败 ${st.fail} · 慢响应 ${st.slow}`, c: '#cc2f2a', s: '#fdecea', i: 'alert' },
        { n: '本日同步数据量', v: st.rows, u: '条', f: '按事件水位增量提取，不重复入库', c: '#8b5cf6', s: '#f1ebfe', i: 'database' },
        { n: '纳管子系统', v: SUBSYSTEMS.length, u: '个', f: `其中 ${ov.filter(o => o.mode === 'B').length} 个为无接口遗留系统`, c: '#a8620b', s: '#fdf1e0', i: 'layers' }
      ].map(k => `<div class="kpi" style="--accent:${k.c};--accent-soft:${k.s}">
        <div class="kpi-top"><span class="kpi-name">${k.n}</span><span class="kpi-icon">${icon(k.i, 20)}</span></div>
        <div class="kpi-value">${k.v}<span class="kpi-unit">${k.u}</span></div>
        <div class="kpi-foot">${k.f}</div></div>`).join('')}
    </div>

    <!-- 各子系统对接情况总览 -->
    <section class="card mt24">
      <div class="card-head">
        <div class="card-title">${icon('layers', 19)} 各子系统数据对接情况总览
          <span class="card-sub">按今日调用日志实时汇总</span></div>
        <span class="badge b-info">${icon('database', 14)} 含 API 网关与只读库两类对接方式</span>
      </div>
      <div class="card-body" style="padding:0">
        <div style="overflow-x:auto">
        <table class="table">
          <thead><tr>
            <th>子系统</th><th class="center">采集模式</th><th class="center">今日调用</th>
            <th class="center">同步数据</th><th class="center">平均耗时</th><th class="center">成功率</th>
            <th>最近一次调用</th><th class="center">最近结果</th>
          </tr></thead>
          <tbody>
            ${ov.map(o => {
              const rm = o.lastRes ? RES_META[o.lastRes] : null;
              return `<tr>
                <td class="tname">${o.name}<div class="tsub">ID：${o.id}</div></td>
                <td class="center"><span class="badge ${o.mode === 'A' ? 'b-info' : 'b-warn'}">模式 ${o.mode || '—'}</span></td>
                <td class="center num">${o.calls}</td>
                <td class="center num">${o.rows} 条</td>
                <td class="center num">${o.avg === '—' ? '—' : o.avg + ' ms'}</td>
                <td class="center">${o.rate === '—' ? '<span class="muted">—</span>' : `<span class="num" style="font-weight:700;color:${o.rate >= 95 ? '#12805a' : o.rate >= 80 ? '#a8620b' : '#cc2f2a'}">${o.rate}%</span>`}</td>
                <td class="small num">${o.last}</td>
                <td class="center">${rm ? `<span class="badge ${rm.cls}">${rm.label}</span>` : '<span class="muted">未采集</span>'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
        </div>
      </div>
      <div class="card-foot">${icon('alert', 15)} 模式 B（TMS / WMS）为无标准接口的遗留系统，通过只读库轮询；连续失败 3 次的子系统会自动降级为低频轮询并推送值班群。</div>
    </section>

    <!-- 调用日志 -->
    <section class="card mt24">
      <div class="card-head">
        <div class="card-title">${icon('file', 19)} 数据对接调用日志
          <span class="card-sub">共 ${rows.length} 条（总日志 ${logs.length} 条）</span></div>
        <div class="toolbar">
          <label class="checkline" style="margin:0;min-width:auto">
            <span class="${live ? '' : 'muted'}">${live ? '<span class="live-dot"></span>' : ''} 实时</span>
            <label class="switch" style="margin-left:6px"><input type="checkbox" id="live" ${live ? 'checked' : ''}><span class="slider"></span></label>
          </label>
          <button class="btn btn-sm" id="btnReplay">${icon('refresh', 15)} 手动触发全量采集</button>
          <button class="btn btn-sm" id="btnExport">${icon('download', 15)} 导出日志</button>
        </div>
      </div>
      <div class="card-body" style="background:var(--surface-2);border-bottom:1px solid var(--border)">
        <div class="toolbar">
          <div class="search">${icon('search', 17)}<input class="input" id="kw" placeholder="搜索子系统 / 调用类型 / 端点 / 日志编号" value="${esc(kw)}"></div>
          <select class="select" id="sysF" style="width:210px">
            <option value="all">全部子系统</option>
            ${SUBSYSTEMS.map(s => `<option value="${s.id}" ${sysF === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
          </select>
          <select class="select" id="resF" style="width:170px">
            <option value="all">全部结果</option>
            ${Object.entries(RES_META).map(([k, v]) => `<option value="${k}" ${resF === k ? 'selected' : ''}>${v.label}</option>`).join('')}
          </select>
          <select class="select" id="range" style="width:150px">
            <option value="1h" ${range === '1h' ? 'selected' : ''}>近 1 小时</option>
            <option value="6h" ${range === '6h' ? 'selected' : ''}>近 6 小时</option>
            <option value="today" ${range === 'today' ? 'selected' : ''}>今日</option>
            <option value="all" ${range === 'all' ? 'selected' : ''}>全部</option>
          </select>
          <button class="btn btn-sm" id="btnReset">重置筛选</button>
        </div>
      </div>
      <div class="card-body" style="padding:0">
        <div style="overflow-x:auto;max-height:620px;overflow-y:auto">
        <table class="table">
          <thead style="position:sticky;top:0;z-index:2">
            <tr>
              <th style="width:110px">时间</th><th style="width:170px">子系统</th>
              <th class="center" style="width:80px">模式</th><th style="width:150px">调用类型</th>
              <th>调用端点 / SQL</th>
              <th class="center" style="width:80px">状态码</th><th class="center" style="width:100px">耗时</th>
              <th class="center" style="width:90px">返回条数</th><th class="center" style="width:110px">结果</th><th class="center" style="width:80px">详情</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length ? rows.map(l => {
              const rm = RES_META[l.res];
              const pct = Math.min(100, l.cost / 30);
              return `<tr>
                <td class="small num">${l.time.slice(11)}</td>
                <td><div class="tname" style="font-size:14.5px">${sysName(l.sys)}</div><div class="tsub">${l.id}</div></td>
                <td class="center"><span class="badge ${l.mode === 'A' ? 'b-info' : 'b-warn'}">${l.mode}</span></td>
                <td class="small">${l.kind}</td>
                <td class="log-meta">${esc(l.ep)}</td>
                <td class="center"><span class="http-code" style="color:${l.http >= 400 ? '#cc2f2a' : l.http === 0 ? '#8a95a5' : '#12805a'}">${l.http || '—'}</span></td>
                <td class="center">
                  <div class="small num" style="font-weight:600;color:${l.cost > 2000 ? '#cc2f2a' : l.cost > 1500 ? '#a8620b' : '#1d2836'}">${l.cost} ms</div>
                  <div class="bar-mini" style="width:${Math.max(pct, 6)}%;background:${l.cost > 2000 ? '#cc2f2a' : l.cost > 1500 ? '#a8620b' : '#1d4ed8'};opacity:.55"></div>
                </td>
                <td class="center num">${l.rows}</td>
                <td class="center"><span class="badge ${rm.cls}">${rm.label}</span></td>
                <td class="center"><button class="btn btn-sm btn-ghost" data-detail="${l.id}">${icon('search', 16)}</button></td>
              </tr>`;
            }).join('') : `<tr><td colspan="10" class="center muted" style="padding:36px">当前筛选条件下没有调用日志</td></tr>`}
          </tbody>
        </table>
        </div>
      </div>
      <div class="card-foot">${icon('alert', 15)} 日志保留 30 天，超出部分自动转归档；超时与连接失败会在下一调度周期自动重试，连续 3 次失败触发降级并告警。</div>
    </section>

    <div class="grid g-2 mt24">
      <section class="card">
        <div class="card-head"><div class="card-title">${icon('alert', 19)} 异常调用分布</div></div>
        <div class="card-body"><div id="failBars"></div>
          ${failDist.length ? '' : '<div class="muted small">今日暂无异常调用</div>'}</div>
      </section>
      <section class="card">
        <div class="card-head"><div class="card-title">${icon('clock', 19)} 响应耗时 Top 5</div>
          <span class="card-sub">平均耗时（ms）</span></div>
        <div class="card-body"><div id="slowBars"></div>
          ${slowTop.length ? '' : '<div class="muted small">全部子系统响应均在阈值内</div>'}</div>
      </section>
    </div>`;

    hBars(document.getElementById('failBars'), failDist, ' 次');
    hBars(document.getElementById('slowBars'), slowTop, ' ms');
    bind();
  }

  function appendLive() {
    const t = liveTpl[liveSeq % liveTpl.length];
    liveSeq++;
    const now = new Date();
    logs.unshift(Object.assign({}, t, {
      id: 'LOG' + now.getTime().toString().slice(-9),
      time: fmtDT(now), ts: now
    }));
    if (logs.length > 200) logs.pop();
    render();
  }

  function bind() {
    const $ = id => document.getElementById(id);
    const kEl = $('kw');
    kEl.addEventListener('input', e => { kw = e.target.value; const p = kEl.selectionStart; render(); const n = $('kw'); n.focus(); n.setSelectionRange(p, p); });
    $('sysF').addEventListener('change', e => { sysF = e.target.value; render(); });
    $('resF').addEventListener('change', e => { resF = e.target.value; render(); });
    $('range').addEventListener('change', e => { range = e.target.value; render(); });
    $('btnReset').addEventListener('click', () => { kw = ''; sysF = 'all'; resF = 'all'; range = 'today'; render(); toast('已重置筛选条件', 'success'); });
    $('btnExport').addEventListener('click', () => toast(`已导出当前 ${filtered().length} 条调用日志（演示）`, 'success'));
    $('btnReplay').addEventListener('click', () => {
      SUBSYSTEMS.slice(0, 4).forEach((s, i) => setTimeout(appendLive, i * 400));
      toast('已手动触发一次全量采集，正在刷新调用日志', 'success');
    });
    $('live').addEventListener('change', e => {
      live = e.target.checked;
      clearInterval(timer);
      if (live) { timer = setInterval(appendLive, 4000); toast('已开启实时调用日志刷新（每 4 秒模拟一次调度）', 'success'); }
      else toast('已停止实时刷新', 'success');
      render();
    });

    document.querySelectorAll('[data-detail]').forEach(b => b.addEventListener('click', () => {
      const l = logs.find(x => x.id === b.dataset.detail);
      if (l) openModal(l);
    }));
  }

  function openModal(l) {
    const rm = RES_META[l.res];
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML = `<div class="modal">
      <div class="modal-head">
        <div>
          <div style="font-size:18px;font-weight:700">调用日志详情 · ${l.id}</div>
          <div class="small muted">${sysName(l.sys)} · ${l.kind} · ${l.time}</div>
        </div>
        <div class="flex acenter gap8">
          <span class="badge ${rm.cls}">${rm.label}</span>
          <button class="btn btn-sm btn-ghost" id="mClose">${icon('plus', 18).replace('<path d="M12 5v14M5 12h14"/>', '<path d="M18 6L6 18M6 6l12 12"/>')}</button>
        </div>
      </div>
      <div class="modal-body">${detailHtml(l)}</div>
      <div class="card-foot" style="border-radius:0 0 var(--radius) var(--radius);display:flex;justify-content:space-between;align-items:center">
        <span class="small muted">支持查看报文详情与手动重放</span>
        <button class="btn btn-primary btn-sm" id="mReplay">${icon('refresh', 15)} 手动重放该调用</button>
      </div>
    </div>`;
    document.body.appendChild(mask);
    detail = mask;
    mask.addEventListener('click', e => { if (e.target === mask) closeModal(); });
    mask.querySelector('#mClose').onclick = closeModal;
    mask.querySelector('#mReplay').onclick = () => {
      const now = new Date();
      logs.unshift(Object.assign({}, l, {
        id: 'LOG' + now.getTime().toString().slice(-9), time: fmtDT(now), ts: now,
        http: l.res === 'conn' ? 0 : 200, cost: Math.max(80, Math.round(l.cost * 0.6)), res: 'success', rows: l.rows || 1, note: ''
      }));
      closeModal();
      render();
      toast('已重放该次调用，结果：成功', 'success');
    };
  }
  function closeModal() { if (detail) { detail.remove(); detail = null; } }

  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  render();
})();
