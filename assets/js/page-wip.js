/* ============ WIP 在制品看板（产量 · 二级钻取） ============
   需求来源：《OneBE添加交接信息.pdf》第四部分「4. WIP」：
     一级界面：按 pkgType 显示各个工序的 WIP（by real unit、by earn 两种口径）；
     二级界面：进入指定工序，按自定义条件筛选 WIP（pkg type / pkg family / pkg size / machine no…）；
     二级界面支持配置各项指标报警的范围（BE CT / OTD，阈值本地可配）。
   样式刻意区别于客户现有深蓝科技风（环形仪表 + 横条）：浅色卡片 + 热力矩阵 + 排行条 + Hold 跑马灯，
   动效：数字滚动 / 条形生长 / 热力格渐入 / 巡检高亮 / 跑马灯 / 抽屉滑入。
   数据：客户 IT 导出《BE1 WIP Report-V26.xls》（真实数据，见 wip-real-data.js），
   金额按 OP 配置单价折算 Earn（LGA 复用 BGA/LGA 价）；
   10-08 起支持「小分类 = 封装料号」级单价：WIP 明细行自带料号（PackageOutline），
   逐个料号取价（opSubPriceOf），料号未配价时自动回落大分类兜底价。 */
(function () {
  renderShell('wip');

  const canExport = CurrentUser.can('output', 'export');

  /* ---------------- 真实数据 ---------------- */
  const RAW = (typeof WIP_REAL_DATA !== 'undefined' && WIP_REAL_DATA) || { meta: {}, rows: [] };
  const rows = RAW.rows || [];
  if (!rows.length) { document.getElementById('content').innerHTML = '<div class="notice mt16">未找到 WIP 数据（wip-real-data.js），请重跑 .extract-wip.py。</div>'; return; }

  /* 品类配置（WipTypeStore · 客户可在 wip-config.html 自行配置）：
     数据里出现但未配置的品类自动按默认样式补齐（不入库，配置页编辑保存后生效） */
  const TCFG = (() => {
    const list = WipTypeStore.all();
    const have = {};
    list.forEach(c => { have[c.key] = 1; });
    rows.forEach(r => { if (r[1] && !have[r[1]]) { have[r[1]] = 1; list.push(WipTypeStore.defaultOf(r[1])); } });
    return list;
  })();
  const cfgOf = t => TCFG.find(c => c.key === t) || WipTypeStore.defaultOf(t);
  const TYPE_COLOR = {};
  TCFG.forEach(c => { TYPE_COLOR[c.key] = c.color; });
  const typeName = t => (cfgOf(t).name || t);
  /* 单价口径：品类配置的 priceKey 对应 OP 配置里的 PKG Type id（如 BGA / LGA 共用「BGA/LGA」价） */
  const priceOf = t => opPriceOf(cfgOf(t).priceKey || t);      // 元/粒（大分类兜底价）
  /* 小分类（封装料号）单价：料号价 → 大分类兜底价。行内无料号时退回大分类价 */
  const priceOfSub = (t, sub) => (sub ? opSubPriceOf(cfgOf(t).priceKey || t, String(sub).trim()) : priceOf(t));

  /* 数量→口径值：unit='K' 千颗 | '万' Earn 万元（按料号单价折算，逐行乘单价后求和） */
  let unit = store.get('wip_unit', 'K');
  const valOf = (qty, type, sub) => unit === 'K' ? qty / 1000 : qty * priceOfSub(type, sub) / 10000;
  const unitLabel = () => unit === 'K' ? 'K' : '万';
  const fmtVal = v => v == null ? '—' : (v >= 1000 ? Math.round(v).toLocaleString('en-US') : v.toFixed(1));

  /* 品类清单（按在制量降序） */
  const typeQty = {};
  rows.forEach(r => { typeQty[r[1]] = (typeQty[r[1]] || 0) + r[7]; });
  const ALL_TYPES = Object.keys(typeQty).sort((a, b) => typeQty[b] - typeQty[a]);
  let typeSel = store.get('wip_types', []);
  const selTypes = () => { const ok = typeSel.filter(t => ALL_TYPES.includes(t)); return ok.length ? ok : ALL_TYPES; };
  const saveSel = () => store.set('wip_types', typeSel);
  /* 热力矩阵列：按品类配置的「矩阵显示」开关过滤（默认 LGA 不显示列头）；其数量仍计入合计 / 排行 / KPI */
  const heatTypes = () => selTypes().filter(t => cfgOf(t).showInHeat !== false);

  /* ---------------- 工序显示清单（客户指定名称与顺序）→ 数据工序代码 ---------------- */
  const STEP_MAP = [
    ['Plasma', ['PREM_PLS']],
    ['passwnd', ['PSSWND']],
    ['mold', ['BMOLD', 'QMOLD', 'FMOLD']],
    ['detaping', []],
    ['PMC', ['NLD_PMC']],
    ['SI', ['NLD_SI']],
    ['Mark', ['BLMARK', 'QMARK', 'FCMARK']],
    ['Pre_treat', []],
    ['HPC', ['NLD_HPC']],
    ['BallAttach', []],
    ['FluxClean', ['FLUX_CLEAN']],
    ['SAW', ['BE_SAW', 'SAW_STAGE']],
    ['ICOS', ['BFOI_GATE']],
    ['QA', ['FVI_GATE']],
    ['Ship', ['BE_DT', 'BE_MT', 'BE_KESFT', 'BE_TTJBI', 'BE_DC']]
  ];
  /* 排行联动站点清单：读品类配置（客户可在 wip-config.html 维护）；未配置清单的品类沿用 BGA */
  const bgaStations = () => { const c = cfgOf('BGA'); return (c && c.stations && c.stations.length) ? c.stations : []; };
  const stationsOf = t => { const c = cfgOf(t); return (c && c.stations && c.stations.length) ? c.stations : bgaStations(); };
  const codesOf = name => {
    const it = STEP_MAP.find(x => x[0] === name) ||
      TCFG.reduce((a, c) => a.concat(c.stations || []), []).find(x => x[0] === name);
    return it ? it[1] : [name];
  };

  /* ---------------- 聚合 ----------------
     按上述固定清单聚合（仅 15 行、顺序固定）：数量 / 金额、批次数、Hold、OTD 逾期 */
  function stepAgg() {
    const types = selTypes();
    return STEP_MAP.map(([name, codes]) => {
      const s = { step: name, qty: 0, val: 0, lots: 0, hold: 0, otd: 0, byType: {} };
      rows.forEach(r => {
        if (!codes.includes(r[0]) || !types.includes(r[1])) return;
        s.qty += r[7]; s.val += valOf(r[7], r[1], r[3]); s.lots++;
        s.byType[r[1]] = (s.byType[r[1]] || 0) + r[7];
        if (r[13] > 0) s.hold++;
        if (r[12] != null && r[12] < 0) s.otd++;
      });
      return s;
    });
  }

  /* ---------------- 全局汇总 ---------------- */
  function globalAgg() {
    const types = selTypes();
    let qty = 0, earn = 0, lots = 0, hold = 0, otd = 0;
    rows.forEach(r => {
      if (!types.includes(r[1])) return;
      qty += r[7]; earn += r[7] * priceOfSub(r[1], r[3]) / 10000; lots++;
      if (r[13] > 0) hold++;
      if (r[12] != null && r[12] < 0) otd++;
    });
    return { qty, earn, lots, hold, otd };
  }

  /* ---------------- 动效：数字滚动 ---------------- */
  function countUp(el, target, dec, suffix) {
    const t0 = performance.now(), dur = 950, from = 0;
    function frame(t) {
      const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      const v = from + (target - from) * e;
      el.innerHTML = (dec ? v.toFixed(dec) : Math.round(v).toLocaleString('en-US')) + (suffix ? ` <small>${suffix}</small>` : '');
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ---------------- 一级界面渲染 ---------------- */
  let patrolTimer = null, patrolIdx = -1;
  let rankType = 'BGA';   // 排行联动品类：矩阵品类列头按钮选中值（'' = 全部品类）；默认联动 BGA

  function render() {
    const g = globalAgg();
    const steps = stepAgg();

    document.getElementById('content').innerHTML = `
      <div id="wipMain">
      <div class="wip-kpis mt16">
        <div class="wip-kpi" style="--wk-accent:#1d4ed8"><div class="wk-label">${icon('layers', 15)} WIP 在制总量</div>
          <div class="wk-value" id="kTotal">0</div><div class="wk-foot">按当前口径 ${unit === 'K' ? '数量（千颗）' : '金额（Earn）'}</div></div>
        <div class="wip-kpi" style="--wk-accent:#0b6a86"><div class="wk-label">${icon('file', 15)} 在制批次</div>
          <div class="wk-value" id="kLots">0</div><div class="wk-foot">覆盖 ${steps.length} 个工序</div></div>
        <div class="wip-kpi" style="--wk-accent:#a8620b"><div class="wk-label">${icon('clock', 15)} Earn 占用</div>
          <div class="wk-value" id="kEarn">0</div><div class="wk-foot">按 OP 单价折算（万元）</div></div>
        <div class="wip-kpi ${g.hold ? 'is-danger' : ''}" style="--wk-accent:#cc2f2a"><div class="wk-label"><i class="wk-pulse" style="${g.hold ? '' : 'display:none'}"></i> Hold 暂停</div>
          <div class="wk-value" id="kHold">0</div><div class="wk-foot">批次</div></div>
        <div class="wip-kpi ${g.otd ? 'is-danger' : ''}" style="--wk-accent:#b3261e"><div class="wk-label">${icon('alert', 15)} OTD 逾期</div>
          <div class="wk-value" id="kOtd">0</div><div class="wk-foot">Shutdown 余量为负（已逾期）</div></div>
      </div>

      <div class="card mt16">
        <div class="card-body flex acenter gap12 flex-wrap">
          <div class="wip-seg" role="tablist">
            <button id="uK" class="${unit === 'K' ? 'on' : ''}">${icon('layers', 15)} by real unit（数量）</button>
            <button id="uW" class="${unit === '万' ? 'on' : ''}">${icon('database', 15)} by earn（金额）</button>
          </div>
          <span class="small muted">口径：</span>
          <div class="flex gap8 flex-wrap">${ALL_TYPES.map(t => `
            <button class="chip ${selTypes().includes(t) ? '' : 'muted'}" data-type="${t}" style="cursor:pointer;${selTypes().includes(t) ? 'border-color:' + TYPE_COLOR[t] + ';color:' + TYPE_COLOR[t] + ';font-weight:700' : ''}">
              ${typeName(t)} <b>${fmtVal(typeQty[t] / 1000)}K</b></button>`).join('')}
          </div>
          <span class="flex-1"></span>
          <span class="small muted">点击工序名 / 矩阵格进入二级筛选</span>
        </div>
      </div>

      <div class="grid g-23 mt16">
        <section class="card">
          <div class="card-head"><div class="card-title">${icon('grid', 19)} 工序 × PKG Type 热力矩阵
            <span class="card-sub">颜色深浅 = 该格占该品类在制量的比重 · 点击品类列头联动右侧排行 · 悬停查看明细 · 点击进入该工序</span></div></div>
          <div class="card-body wip-heat"><div class="wh-grid" id="whGrid" style="--wh-cols:${heatTypes().length}"></div>
            <div class="wh-info" id="whInfo">把鼠标移到任意格子上查看该「工序 × 品类」的在制明细。</div>
          </div>
        </section>
        <section class="card">
          <div class="card-head"><div class="card-title">${icon('activity', 19)} 工序 WIP 排行
            <span class="card-sub" id="rankSub">堆叠条按品类构成 · 自动巡检高亮 · 点击进入</span></div></div>
          <div class="card-body wip-rank" id="wrList" style="max-height:680px;overflow:auto"></div>
          <div class="card-foot" style="padding:8px 16px 12px;color:#64748b;font-size:12px;border-top:1px dashed #e2e8f0">备注：Ship 的数值是 BE_DT、BE_MT、BE_KESFT、BE_TTJBI、BE_DC 这五个的总和。</div>
        </section>
      </div>
      </div>`;

    /* KPI 数字滚动 */
    countUp(document.getElementById('kTotal'), unit === 'K' ? g.qty / 1000 : g.earn, 1, unitLabel());
    countUp(document.getElementById('kLots'), g.lots, 0, '批');
    countUp(document.getElementById('kEarn'), g.earn, 1, '万');
    countUp(document.getElementById('kHold'), g.hold, 0, '批');
    countUp(document.getElementById('kOtd'), g.otd, 0, '批');

    /* 口径切换 / 品类筛选 */
    document.getElementById('uK').onclick = () => { unit = 'K'; store.set('wip_unit', unit); render(); };
    document.getElementById('uW').onclick = () => { unit = '万'; store.set('wip_unit', unit); render(); };
    document.querySelectorAll('[data-type]').forEach(b => {
      b.onclick = () => {
        const t = b.dataset.type;
        typeSel = selTypes().includes(t) ? selTypes().filter(x => x !== t) : selTypes().concat(t);
        if (selTypes().length === ALL_TYPES.length) typeSel = [];
        saveSel(); render();
      };
    });

    renderHeat(steps);
    renderRank(steps);
    startPatrol();
  }

  /* ---------------- 热力矩阵 ----------------
     行 = 客户指定 15 个工序（固定顺序、显示名）；悬停 / 点击按映射代码合并取数 */
  function renderHeat(steps) {
    const types = heatTypes();
    const colMax = {};
    types.forEach(t => { colMax[t] = Math.max(1e-9, ...steps.map(s => (s.byType[t] || 0))); });
    const grid = document.getElementById('whGrid');
    const info = document.getElementById('whInfo');

    const head = `<div class="wh-row" style="animation-delay:0s"><div class="wh-head">工序 \\ 品类</div>
      ${types.map(t => `<div class="wh-head wh-htbtn ${rankType === t ? 'on' : ''}" data-ht="${t}"
        style="color:${TYPE_COLOR[t] || 'var(--text-3)'}"
        title="联动右侧「工序 WIP 排行」：仅看 ${esc(typeName(t))}${rankType === t ? '（再点一次恢复全部）' : ''}">${esc(typeName(t))}</div>`).join('')}
      <div class="wh-head">合计（${unitLabel()}）</div></div>`;

    const body = steps.map((s, ri) => {
      const delay = (ri * 0.04).toFixed(2);
      const cells = types.map((t, ci) => {
        const q = s.byType[t] || 0;
        if (!q) return `<div class="wh-cell empty" style="animation-delay:${delay + ci * 0.02}s">·</div>`;
        const v = valOf(q, t), ratio = q / colMax[t];
        const c = TYPE_COLOR[t] || '#64748b';
        const bg = `rgba(${hexRGB(c)},${(0.07 + ratio * 0.78).toFixed(3)})`;
        return `<div class="wh-cell" data-step="${esc(s.step)}" data-type="${t}" data-qty="${q}"
          style="background:${bg};animation-delay:${(delay + ci * 0.02)}s"
          title="${esc(s.step)} × ${esc(typeName(t))}">${fmtVal(v)}</div>`;
      }).join('');
      return `<div class="wh-row" data-step="${esc(s.step)}" style="animation-delay:${delay}s">
        <div class="wh-name" data-step="${esc(s.step)}" title="进入 ${esc(s.step)} 二级筛选">${esc(s.step)}<small>${s.lots}批</small></div>
        ${cells}<div class="wh-total" data-step="${esc(s.step)}">${fmtVal(s.val)}</div></div>`;
    }).join('');

    grid.innerHTML = head + body;

    grid.onmouseover = e => {
      const cell = e.target.closest('.wh-cell[data-qty]');
      if (cell) {
        const step = cell.dataset.step, t = cell.dataset.type, q = +cell.dataset.qty;
        const codes = codesOf(step);
        const sub = rows.filter(r => codes.includes(r[0]) && r[1] === t);
        const lotN = sub.length;
        const holdN = sub.filter(r => r[13] > 0).length;
        /* Earn 按格子内各料号的实际数量 × 各自单价汇总（不整体乘一个品类价） */
        const cellEarn = sub.reduce((a, r) => a + r[7] * priceOfSub(r[1], r[3]) / 10000, 0);
        info.innerHTML = `<strong>${esc(step)}</strong> × <strong>${esc(typeName(t))}</strong>：在制
          <strong>${fmtVal(q / 1000)}K</strong>（Earn ${fmtVal(cellEarn)} 万 · 按料号单价折算）· ${lotN} 批 · Hold ${holdN} 批 — 点击进入二级筛选`;
      }
    };
    grid.onclick = e => {
      /* 品类列头按钮：联动右侧排行（再点同一列头恢复全部） */
      const ht = e.target.closest('[data-ht]');
      if (ht) {
        rankType = rankType === ht.dataset.ht ? '' : ht.dataset.ht;
        grid.querySelectorAll('[data-ht]').forEach(h => {
          const on = h.dataset.ht === rankType;
          h.classList.toggle('on', on);
          h.title = `联动右侧「工序 WIP 排行」：仅看 ${typeName(h.dataset.ht)}${on ? '（再点一次恢复全部）' : ''}`;
        });
        renderRank(steps);
        return;
      }
      const el = e.target.closest('[data-step]');
      if (el) openDrawer(el.dataset.step);
    };
  }

  /* ---------------- 排行条 ---------------- */
  function renderRank(steps) {
    const types = selTypes();
    const rt = types.includes(rankType) ? rankType : '';
    let list;
    if (rt) {
      /* 联动模式：矩阵列头选中某品类时，仅按该品类配置的站点清单重算在制（未配置清单的品类沿用 BGA） */
      const stations = stationsOf(rt);
      list = stations.map(([name, codes, warn]) => {
        const o = { step: name, qty: 0, val: 0, lots: 0, hold: 0, otd: 0, byType: {}, warn: warn > 0 ? Number(warn) : 0 };
        rows.forEach(r => {
          if (!codes.includes(r[0]) || r[1] !== rt) return;
          o.qty += r[7]; o.val += valOf(r[7], r[1], r[3]); o.lots++;
          if (r[13] > 0) o.hold++;
          if (r[12] != null && r[12] < 0) o.otd++;
        });
        o.byType[rt] = o.qty;
        return o;
      });   // 按站点清单配置顺序全量展示（顺序可在 wip-config 拖拽调整）：无数据显示 0
    } else {
      list = steps.slice().sort((a, b) => b.qty - a.qty);   // 排行按数量，矩阵顺序不受影响
    }
    const show = rt ? list : list.slice(0, 12);
    const rest = rt ? [] : list.slice(12);
    const max = Math.max(1e-9, ...show.map(s => s.qty));
    const el = document.getElementById('wrList');
    el.innerHTML = show.map((s, i) => {
      const segs = types.map(t => {
        const q = s.byType[t] || 0;
        if (!q) return '';
        return `<i class="wr-seg" data-w="${(q / max * 100).toFixed(2)}" style="background:${TYPE_COLOR[t] || '#64748b'}"></i>`;
      }).join('');
      const warnTag = s.warn > 0
        ? (s.qty > s.warn
          ? ` · <span style="color:var(--danger);font-weight:700" title="在制 ${s.qty.toLocaleString('en-US')} 超过预警值 ${s.warn.toLocaleString('en-US')}（站点清单配置）">⚠ 超预警</span>`
          : ` · <span class="muted" title="站点清单配置的预警值：${s.warn.toLocaleString('en-US')} 颗">预警 ${s.warn.toLocaleString('en-US')}</span>`)
        : '';
      return `<div class="wr-item" data-step="${esc(s.step)}" style="animation-delay:${(i * 0.05).toFixed(2)}s">
        <div class="wr-line"><span class="wr-name" title="进入二级筛选"${s.warn > 0 && s.qty > s.warn ? ' style="color:var(--danger)"' : ''}>${esc(s.step)}</span>
          <span class="wr-val">${fmtVal(s.val)}</span><span class="small muted">${unitLabel()}</span>
          <span class="wr-meta">${s.lots} 批${s.hold ? ` · <span style="color:var(--danger)">Hold ${s.hold}</span>` : ''}${s.otd ? ` · <span style="color:var(--danger)">OTD ${s.otd}</span>` : ''}${warnTag}</span></div>
        <div class="wr-bar" title="进入 ${esc(s.step)} 二级筛选">${segs}</div></div>`;
    }).join('') + (rest.length ? `<div class="wr-rest">其余 ${rest.length} 个工序合计 ${fmtVal(rest.reduce((a, s) => a + s.val, 0))}${unitLabel()}（${rest.map(s => esc(s.step)).join(' · ')}）</div>` : '');

    /* 联动状态提示 */
    const sub = document.getElementById('rankSub');
    if (sub) sub.innerHTML = rt
      ? `联动筛选：<b style="color:${TYPE_COLOR[rt] || 'inherit'}">${esc(typeName(rt))}</b> · 点击矩阵品类列头切换 / 再点恢复全部`
      : '堆叠条按品类构成 · 自动巡检高亮 · 点击进入';

    /* 条形生长动画：先置 0，下一帧写入目标宽度触发过渡 */
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.querySelectorAll('.wr-seg[data-w]').forEach(sg => { sg.style.width = sg.dataset.w + '%'; });
    }));
    el.onclick = e => {
      const item = e.target.closest('.wr-item');
      if (item) openDrawer(item.dataset.step);
    };
  }

  /* ---------------- 自动巡检高亮 ----------------
     轮流高亮右侧排行中当前可见的工序（联动筛选下仅巡检可见项），并同步矩阵行 */
  function startPatrol() {
    if (patrolTimer) clearInterval(patrolTimer);
    patrolTimer = setInterval(() => {
      if (drawerOpen || document.hidden) return;
      const els = document.querySelectorAll('.wr-item');
      if (!els.length) return;
      els.forEach(x => x.classList.remove('spot'));
      const hs = document.querySelectorAll('.wh-row[data-step]');
      hs.forEach(x => x.classList.remove('spot'));
      patrolIdx = (patrolIdx + 1) % els.length;
      const step = els[patrolIdx].dataset.step;
      els.forEach(x => { if (x.dataset.step === step) x.classList.add('spot'); });
      hs.forEach(x => { if (x.dataset.step === step) x.classList.add('spot'); });
    }, 3500);
  }

  /* ---------------- 工具 ---------------- */
  function hexRGB(h) {
    const n = parseInt(h.slice(1), 16);
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  }

  /* =====================================================================
     二级界面：进入指定工序，按自定义条件筛选 WIP + 指标报警范围配置
     ===================================================================== */
  let drawerOpen = false;
  const PAGE_SIZE = 50;
  const ALARM_DEF = { ctY: 7, ctR: 14, otd: 0 };        // BE CT 黄/红（天）、OTD 逾期红线（≤ 该值报红）
  const alarmCfg = Object.assign({}, ALARM_DEF, store.get('wip_alarm', {}));
  const saveAlarm = () => store.set('wip_alarm', alarmCfg);

  let dr = null;   // 当前抽屉状态 { step, types, size, outline, loc, bank, holdOnly, kw, sort, page }

  function openDrawer(step) {
    try {
      dr = { step, types: rankType ? [rankType] : selTypes().slice(), size: '', outline: '', loc: '', bank: '', holdOnly: false, thawOnly: false, kw: '', sort: 'otd', page: 1, sel: [] };
      buildDrawer();
      document.getElementById('wipMask').classList.add('open');
      document.getElementById('wipDrawer').classList.add('open');
      drawerOpen = true;
    } catch (e) { console.error(e); toast('打开工序详情失败：' + (e && e.message || e), 'danger'); }
  }
  function closeDrawer() {
    document.getElementById('wipMask').classList.remove('open');
    document.getElementById('wipDrawer').classList.remove('open');
    drawerOpen = false;
  }

  function drRows() {
    const kw = dr.kw.trim().toLowerCase();
    const codes = codesOf(dr.step);
    let list = rows.filter(r => codes.includes(r[0])
      && dr.types.includes(r[1])
      && (!dr.size || r[2] === dr.size)
      && (!dr.outline || r[3] === dr.outline)
      && (!dr.loc || r[9] === dr.loc)
      && (!dr.bank || r[15] === dr.bank)
      && (!dr.holdOnly || r[13] > 0)
      && (!dr.thawOnly || (typeof CompoundThaw !== 'undefined' && CompoundThaw.of(r[6], Date.now()).status === 'overtime'))
      && (!kw || (r[6] + ' ' + r[4] + ' ' + r[3] + ' ' + r[5]).toLowerCase().includes(kw)));
    const cmp = {
      otd: (a, b) => (a[12] == null ? 1e9 : a[12]) - (b[12] == null ? 1e9 : b[12]),
      ct: (a, b) => (b[10] || 0) - (a[10] || 0),
      qty: (a, b) => b[7] - a[7]
    }[dr.sort];
    return list.sort(cmp);
  }

  function buildDrawer() {
    const codes = codesOf(dr.step);
    const all = rows.filter(r => codes.includes(r[0]));
    const uniq = (arr, i) => Array.from(new Set(arr.map(r => r[i]).filter(x => x !== ''))).sort();
    const sizes = uniq(all, 2), outlines = uniq(all, 3), locs = uniq(all, 9), banks = uniq(all, 15);
    const list = drRows();
    const qty = list.reduce((a, r) => a + r[7], 0);
    const earn = list.reduce((a, r) => a + r[7] * priceOfSub(r[1], r[3]) / 10000, 0);
    const hold = list.filter(r => r[13] > 0).length;
    const otd = list.filter(r => r[12] != null && r[12] < 0).length;
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (dr.page > pages) dr.page = pages;
    const view = list.slice((dr.page - 1) * PAGE_SIZE, dr.page * PAGE_SIZE);
    const chip = t => `<button class="chip ${dr.types.includes(t) ? '' : 'muted'}" data-dt="${t}" style="cursor:pointer;${dr.types.includes(t) ? 'border-color:' + (TYPE_COLOR[t] || '#64748b') + ';color:' + (TYPE_COLOR[t] || '#64748b') + ';font-weight:700' : ''}">${esc(typeName(t))}</button>`;

    let drawer = document.getElementById('wipDrawer');
    let mask = document.getElementById('wipMask');
    if (!drawer) {
      mask = document.createElement('div'); mask.id = 'wipMask'; mask.className = 'wip-mask'; mask.onclick = closeDrawer;
      drawer = document.createElement('div'); drawer.id = 'wipDrawer'; drawer.className = 'wip-drawer';
      document.body.appendChild(mask); document.body.appendChild(drawer);
    }

    drawer.innerHTML = `
      <div class="wd-head">
        <div>
          <div class="wd-title">${icon('layers', 20)} 工序详情 · <code>${esc(dr.step)}</code>
            ${hold ? `<span class="chip" style="color:var(--danger);border-color:#f3c2bf">Hold ${hold}</span>` : ''}
            ${otd ? `<span class="chip" style="color:var(--danger);border-color:#f3c2bf">OTD 逾期 ${otd}</span>` : ''}</div>
          <div class="wd-sub">二级界面 · 按自定义条件筛选 WIP · 单价随 OP 配置联动（Earn 万元 = 颗 × 元/粒 ÷ 10000）</div>
        </div>
        <button class="btn btn-sm" id="wdClose">${icon('close', 16)} 关闭</button>
      </div>
      <div class="wd-body">
        <div class="wd-filters">
          <span class="small muted" style="font-weight:700">pkg type</span>${ALL_TYPES.map(chip).join('')}
          <select id="fSize"><option value="">PKG SIZE 全部</option>${sizes.map(s => `<option ${dr.size === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>
          <select id="fOutline"><option value="">封装料号全部</option>${outlines.map(s => `<option ${dr.outline === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>
          <select id="fLoc"><option value="">机台/位置全部</option>${locs.map(s => `<option ${dr.loc === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>
          <select id="fBank"><option value="">Bank 全部</option>${banks.map(s => `<option ${dr.bank === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>
          <button class="chip ${dr.holdOnly ? '' : 'muted'}" id="fHold" style="cursor:pointer;${dr.holdOnly ? 'color:var(--danger);border-color:#f3c2bf;font-weight:700' : ''}">仅看 Hold</button>
          <input type="text" id="fKw" placeholder="搜索批次 / 器件 / 料号 / 产品族…" value="${esc(dr.kw)}" style="width:210px">
        </div>

        <details class="wd-alarm" ${dr.alarmOpen ? 'open' : ''}>
          <summary>${icon('alert', 16)} 指标报警范围配置（保存后立即生效，阈值存本地）</summary>
          <div class="wa-body">
            <div><label>BE CT 黄色阈值（天 ≥）</label><input type="number" id="aCtY" step="0.5" min="0" value="${alarmCfg.ctY}"></div>
            <div><label>BE CT 红色阈值（天 ≥）</label><input type="number" id="aCtR" step="0.5" min="0" value="${alarmCfg.ctR}"></div>
            <div><label>OTD 逾期红线（天 ≤）</label><input type="number" id="aOtd" step="0.5" value="${alarmCfg.otd}"></div>
            <button class="btn btn-sm btn-primary" id="aSave">${icon('check', 15)} 保存阈值</button>
            <button class="btn btn-sm" id="aReset">${icon('refresh', 15)} 恢复默认</button>
            <span class="small muted">默认：CT 黄 7 / 红 14 天 · OTD ≤ 0 天为逾期（Shutdown 余量为负即已逾期）</span>
          </div>
        </details>

        <div class="wd-kpis">
          <div class="wd-kpi"><b>${fmtVal(qty / 1000)}K</b><span>在制数量（${list.length} 批）</span></div>
          <div class="wd-kpi"><b>${fmtVal(earn)} 万</b><span>Earn 占用（按 OP 单价）</span></div>
          <div class="wd-kpi" style="${hold ? 'border-color:#f3c2bf' : ''}"><b style="${hold ? 'color:var(--danger)' : ''}">${hold}</b><span>Hold 暂停批次</span></div>
          <div class="wd-kpi" style="${otd ? 'border-color:#f3c2bf' : ''}"><b style="${otd ? 'color:var(--danger)' : ''}">${otd}</b><span>OTD 逾期批次（红线 ≤ ${alarmCfg.otd} 天）</span></div>
        </div>

        <div class="flex acenter gap12" style="margin-bottom:8px">
          <span class="small muted">排序：</span>
          <select id="fSort" style="height:31px;border:1px solid var(--border);border-radius:8px;padding:0 8px;font-size:13px">
            <option value="otd" ${dr.sort === 'otd' ? 'selected' : ''}>OTD 余量升序（最急优先）</option>
            <option value="ct" ${dr.sort === 'ct' ? 'selected' : ''}>BE CT 降序（在制最久优先）</option>
            <option value="qty" ${dr.sort === 'qty' ? 'selected' : ''}>数量降序</option>
          </select>
          <button class="btn btn-sm" id="btnCalcMan" title="先在列表勾选批次，再计算所选批次的金额与总价">${icon('check', 15)} 人工计算${dr.sel.length ? `（${dr.sel.length}）` : ''}</button>
          <button class="btn btn-sm" id="btnCalcAuto" title="输入目标总价或需求数量，系统按当前排序自动挑选批次">${icon('zap', 15)} 自动计算</button>
          <span class="flex-1"></span>
          ${canExport ? `<button class="btn btn-sm btn-primary" id="wdExport">${icon('download', 15)} 导出 Excel（${list.length} 批）</button>` : '<span class="chip">只读（无导出权限）</span>'}
        </div>

        <div style="overflow:auto;border:1px solid var(--border);border-radius:10px;background:var(--surface)">
          <table class="table wdt" style="width:100%;border:0;min-width:1060px">
            <thead><tr><th style="width:36px"><input type="checkbox" id="ckAll" title="全选 / 取消本页"></th><th>批次号</th><th>PKG Type</th><th>尺寸</th><th>封装料号</th><th>器件</th>
              <th class="num">数量</th><th class="num">金额(元)</th><th>机台/位置</th><th class="num">BE CT(天)</th><th class="num">ASSY CT(天)</th>
              <th class="num">OTD 余量(天)</th><th>Hold</th><th>塑封料解冻 <span class="tag-hint warn">演示</span></th><th>Bank</th><th>线材</th></tr></thead>
            <tbody>${view.map(r => {
              const ct = r[10], otdV = r[12];
              const ctCls = ct != null && ct >= alarmCfg.ctR ? 'r2' : (ct != null && ct >= alarmCfg.ctY ? 'r1' : '');
              const rowCls = (ct != null && ct >= alarmCfg.ctR) || (otdV != null && otdV <= alarmCfg.otd && otdV < 0) ? 'al-red'
                : (ct != null && ct >= alarmCfg.ctY ? 'al-yel' : '');
              const tw = (typeof CompoundThaw !== 'undefined') ? CompoundThaw.of(r[6], Date.now()) : { status: 'ready', matLot: '—', start: 0, ready: 0, overtime: 0 };
              const twTag = tw.status === 'ready' ? `<span style="color:#0b8a5a;font-weight:700">已解冻</span>`
                : tw.status === 'thawing' ? `<span style="color:#1d4ed8">解冻中</span>`
                : `<span style="color:#b45309;font-weight:700">⚠ 解冻超时 ${tw.overtime}h</span>`;
              const twTitle = `物料批号 ${tw.matLot} · 解冻开始 ${CompoundThaw.hhmm(tw.start)} · 预计就绪 ${CompoundThaw.hhmm(tw.ready)}${tw.status === 'overtime' ? ' · 已超时 ' + tw.overtime + ' 小时' : ''} · 演示补充数据`;
              const extraStyle = tw.status === 'overtime' ? 'box-shadow: inset 3px 0 0 #b45309;' : '';
              return `<tr class="${rowCls}" style="${extraStyle}">
                <td><input type="checkbox" class="ck-row" data-b="${esc(r[6])}" ${dr.sel.includes(r[6]) ? 'checked' : ''}></td>
                <td style="font-family:ui-monospace,Consolas,monospace">${esc(r[6])}</td>
                <td><span style="color:${TYPE_COLOR[r[1]] || 'var(--text-3)'};font-weight:700">${esc(typeName(r[1]))}</span></td>
                <td>${esc(r[2]) || '—'}</td>
                <td style="font-family:ui-monospace,Consolas,monospace">${esc(r[3])}</td>
                <td title="${esc(r[4])}">${esc(r[4].length > 16 ? r[4].slice(0, 15) + '…' : r[4])}</td>
                <td class="num">${r[7].toLocaleString('en-US')}</td>
                <td class="num" title="数量 × 单价（单价随 OP 配置联动）"><b>${Math.round(r[7] * priceOfSub(r[1], r[3])).toLocaleString('en-US')}</b></td>
                <td>${esc(r[9]) || '—'}</td>
                <td class="num">${ct == null ? '—' : `<span class="ct-badge ${ctCls}">${ct.toFixed(1)}</span>`}</td>
                <td class="num">${r[11] == null ? '—' : r[11].toFixed(1)}</td>
                <td class="num ${otdV != null && otdV < 0 ? 'otd-bad' : ''}">${otdV == null ? '—' : otdV.toFixed(1)}</td>
                <td>${r[13] > 0 ? `<span class="chip" style="color:var(--danger);border-color:#f3c2bf">${r[13]} 天</span>` : '<span class="muted small">—</span>'}</td>
                <td title="${twTitle}">
                  <div>${twTag}</div>
                  <div class="muted small" style="margin-top:3px;font-family:ui-monospace,Consolas,monospace;line-height:1.45">
                    开始 ${CompoundThaw.hhmm(tw.start)}<br>结束 ${CompoundThaw.hhmm(tw.ready)}
                  </div>
                </td>
                <td>${esc(r[15])}</td><td>${esc(r[16]) || '—'}</td></tr>`;
            }).join('') || '<tr><td colspan="16" class="center muted" style="padding:26px">当前筛选条件下无批次。</td></tr>'}</tbody>
          </table>
        </div>

        <div class="wd-foot">
          <span class="small muted">共 ${list.length} 批 · 第 ${dr.page} / ${pages} 页 · 红底行 = 触发红色报警 · 黄底行 = CT 临界</span>
          <div class="wd-page flex gap8">
            <button id="pgPrev" ${dr.page <= 1 ? 'disabled' : ''}>上一页</button>
            ${pages > 1 && pages <= 9 ? Array.from({ length: pages }, (_, i) => `<button class="${dr.page === i + 1 ? 'on' : ''}" data-pg="${i + 1}">${i + 1}</button>`).join('') : ''}
            <button id="pgNext" ${dr.page >= pages ? 'disabled' : ''}>下一页</button>
          </div>
        </div>
      </div>`;

    /* ---- 抽屉事件 ---- */
    drawer.querySelector('#wdClose').onclick = closeDrawer;
    drawer.querySelectorAll('[data-dt]').forEach(b => {
      b.onclick = () => {
        const t = b.dataset.dt;
        dr.types = dr.types.includes(t) ? dr.types.filter(x => x !== t) : dr.types.concat(t);
        if (!dr.types.length) dr.types = ALL_TYPES.slice();
        dr.page = 1; buildDrawer();
      };
    });
    const bind = (id, key) => {
      const el = drawer.querySelector(id);
      el.onchange = () => { dr[key] = el.value; dr.page = 1; buildDrawer(); };
    };
    bind('#fSize', 'size'); bind('#fOutline', 'outline'); bind('#fLoc', 'loc'); bind('#fBank', 'bank'); bind('#fSort', 'sort');
    drawer.querySelector('#fHold').onclick = () => { dr.holdOnly = !dr.holdOnly; dr.page = 1; buildDrawer(); };
    let kwTimer = null;
    const kwEl = drawer.querySelector('#fKw');
    kwEl.oninput = () => {
      clearTimeout(kwTimer);
      kwTimer = setTimeout(() => { dr.kw = kwEl.value; dr.page = 1; buildDrawer(); const k2 = drawer.querySelector('#fKw'); k2.focus(); k2.setSelectionRange(k2.value.length, k2.value.length); }, 350);
    };
    drawer.querySelector('#aSave').onclick = () => {
      alarmCfg.ctY = Number(drawer.querySelector('#aCtY').value) || 0;
      alarmCfg.ctR = Number(drawer.querySelector('#aCtR').value) || 0;
      alarmCfg.otd = Number(drawer.querySelector('#aOtd').value) || 0;
      saveAlarm(); toast('报警阈值已保存：CT 黄 ' + alarmCfg.ctY + ' / 红 ' + alarmCfg.ctR + ' 天 · OTD ≤ ' + alarmCfg.otd + ' 天', 'success');
      buildDrawer();
    };
    drawer.querySelector('#aReset').onclick = () => {
      Object.assign(alarmCfg, ALARM_DEF); saveAlarm(); toast('已恢复默认报警阈值', 'primary'); buildDrawer();
    };
    /* ---- 批次勾选（跨页保留，供人工计算） ---- */
    const updCalcManBtn = () => {
      const bm = drawer.querySelector('#btnCalcMan');
      if (bm) bm.innerHTML = `${icon('check', 15)} 人工计算${dr.sel.length ? `（${dr.sel.length}）` : ''}`;
    };
    const ckAll = drawer.querySelector('#ckAll');
    if (ckAll) ckAll.onchange = () => {
      view.forEach(r => {
        const i = dr.sel.indexOf(r[6]);
        if (ckAll.checked && i < 0) dr.sel.push(r[6]);
        if (!ckAll.checked && i >= 0) dr.sel.splice(i, 1);
      });
      drawer.querySelectorAll('.ck-row').forEach(c => { c.checked = ckAll.checked; });
      updCalcManBtn();
    };
    drawer.querySelectorAll('.ck-row').forEach(c => {
      c.onchange = () => {
        const b = c.dataset.b, i = dr.sel.indexOf(b);
        if (c.checked && i < 0) dr.sel.push(b);
        if (!c.checked && i >= 0) dr.sel.splice(i, 1);
        if (ckAll) ckAll.checked = view.every(r => dr.sel.includes(r[6]));
        updCalcManBtn();
      };
    });
    drawer.querySelector('#btnCalcMan').onclick = manCalc;
    drawer.querySelector('#btnCalcAuto').onclick = autoCalc;
    const ex = drawer.querySelector('#wdExport');
    if (ex) ex.onclick = () => {
      const headers = ['批次号', 'PKG Type', 'PKG SIZE', '封装料号', '器件', '产品族', '数量(颗)', 'Qty by I/O', '机台/位置',
        'BE_CT(天)', 'ASSY_CT(天)', 'OTD余量(天)', 'Hold(天)', 'Hold原因', '塑封料解冻(演示补充)', 'Bank', '线材', 'DC'];
      const rs = drRows();
      const thawLabel = r => { const t = CompoundThaw.of(r[6], Date.now()); return t.status === 'ready' ? '已解冻' : t.status === 'thawing' ? '解冻中' : '解冻超时' + t.overtime + 'h'; };
      exportExcel('WIP_' + dr.step + '_在制明细.xls', headers, rs.map(r => [r[6], r[1], r[2], r[3], r[4], r[5], r[7], r[8], r[9], r[10], r[11], r[12], r[13], r[14], thawLabel(r), r[15], r[16], r[17]]));
      toast('已导出 ' + rs.length + ' 批明细（' + dr.step + '）', 'success');
    };
    drawer.querySelector('#pgPrev').onclick = () => { if (dr.page > 1) { dr.page--; buildDrawer(); } };
    drawer.querySelector('#pgNext').onclick = () => { if (dr.page < pages) { dr.page++; buildDrawer(); } };
    drawer.querySelectorAll('[data-pg]').forEach(b => { b.onclick = () => { dr.page = +b.dataset.pg; buildDrawer(); }; });
  }

  /* ---------------- 批次计算：人工 / 自动（金额 = 数量 × 单价，单价随 OP 配置联动） ---------------- */
  function calcTableHtml(items) {
    const totQ = items.reduce((a, x) => a + x.qty, 0);
    const totA = items.reduce((a, x) => a + x.qty * x.price, 0);
    return `<div style="overflow:auto;border:1px solid var(--border);border-radius:10px;background:var(--surface);max-height:430px">
      <table class="table wdt" style="width:100%;border:0;min-width:660px">
        <thead><tr><th>#</th><th>批次号</th><th>PKG Type</th><th>封装料号</th><th class="num">数量(颗)</th><th class="num">单价(元/粒)</th><th class="num">金额(元)</th></tr></thead>
        <tbody>${items.map((x, i) => `<tr>
          <td class="num muted">${i + 1}</td>
          <td style="font-family:ui-monospace,Consolas,monospace">${esc(x.batch)}</td>
          <td><span style="color:${TYPE_COLOR[x.type] || 'var(--text-3)'};font-weight:700">${esc(typeName(x.type))}</span></td>
          <td style="font-family:ui-monospace,Consolas,monospace">${esc(x.outline)}</td>
          <td class="num">${x.qty.toLocaleString('en-US')}</td>
          <td class="num">${x.price.toFixed(4)}</td>
          <td class="num"><b>${Math.round(x.qty * x.price).toLocaleString('en-US')}</b></td>
        </tr>`).join('') || '<tr><td colspan="7" class="center muted" style="padding:22px">无批次</td></tr>'}</tbody>
      </table>
    </div>
    <div class="mt10" style="font-size:14px;line-height:1.8">
      合计：<b>${items.length}</b> 批 · 总数量 <b>${totQ.toLocaleString('en-US')}</b> 颗 · 总价 <b style="color:#1d4ed8">${Math.round(totA).toLocaleString('en-US')}</b> 元
    </div>`;
  }

  function manCalc() {
    const selSet = new Set(dr.sel);
    const picked = drRows().filter(r => selSet.has(r[6]));
    if (!picked.length) { toast('请先在列表中勾选批次', 'warn'); return; }
    const miss = dr.sel.length - picked.length;
    openDialog({
      title: `人工计算 · ${esc(dr.step)}`,
      sub: `已选 ${picked.length} 批${miss ? ` · 另有 ${miss} 批已不在当前筛选范围，已忽略` : ''} · 单价随 OP 配置联动（金额 = 数量 × 单价）`,
      width: 880,
      okText: '关闭',
      body: calcTableHtml(picked.map(r => ({ batch: r[6], type: r[1], outline: r[3], qty: r[7], price: priceOfSub(r[1], r[3]) })))
    });
  }

  function autoCalc() {
    const sortName = { otd: 'OTD 余量升序（最急优先）', ct: 'BE CT 降序（在制最久优先）', qty: '数量降序' }[dr.sort] || '';
    const mask = openDialog({
      title: `自动计算 · ${esc(dr.step)}`,
      sub: `按当前排序「${sortName}」依次取批，最后一批可部分取用 · 结果可手动增删批次后「再次计算」 · 单价随 OP 配置联动`,
      width: 880,
      okText: '开始计算',
      cancelText: '关闭',
      body: `
        <div class="flex acenter gap12" style="flex-wrap:wrap">
          <label class="flex acenter gap6 small" style="cursor:pointer"><input type="radio" name="acMode" value="qty" checked> 按需求数量（颗）</label>
          <label class="flex acenter gap6 small" style="cursor:pointer"><input type="radio" name="acMode" value="amt"> 按目标总价（元）</label>
          <input class="input" type="number" id="acNeed" min="1" step="any" placeholder="输入目标值" style="width:170px;height:32px">
        </div>
        <div id="acResult" class="mt12"><div class="small muted">输入目标值后点「开始计算」，系统按当前排序自动挑选所需批次；之后可手动增删批次并「再次计算」，逐步逼近目标。</div></div>`,
      onOk: m => runAutoCalc(m)
    });
    mask.querySelector('#acNeed').addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); runAutoCalc(mask); }
    });
  }

  function acTotals(items) {
    return { totQ: items.reduce((a, x) => a + x.qty, 0), totA: items.reduce((a, x) => a + x.qty * x.price, 0) };
  }

  function renderAcResult(m) {
    const st = m._ac; if (!st) return;
    const { totQ, totA } = acTotals(st.items);
    let note;
    if (st.mode === 'qty') {
      note = totQ === st.need
        ? `<span style="color:#0b8a5a;font-weight:700">已满足需求数量 ${st.need.toLocaleString('en-US')} 颗</span>`
        : totQ < st.need
          ? `<span class="red-inline">还差 ${(st.need - totQ).toLocaleString('en-US')} 颗，点「再次计算」自动补批</span>`
          : `<span style="color:#b45309;font-weight:700">已超出目标 ${(totQ - st.need).toLocaleString('en-US')} 颗，可移除部分批次</span>`;
    } else {
      note = totA <= st.need
        ? `剩余预算 <b>${Math.round(st.need - totA).toLocaleString('en-US')}</b> 元（按整颗取用，整除有余时向下取）`
        : `<span style="color:#b45309;font-weight:700">已超出预算 ${Math.round(totA - st.need).toLocaleString('en-US')} 元，可移除部分批次</span>`;
    }
    m.querySelector('#acResult').innerHTML = `
      <div style="overflow:auto;border:1px solid var(--border);border-radius:10px;background:var(--surface);max-height:330px">
        <table class="table wdt" style="width:100%;border:0;min-width:720px">
          <thead><tr><th>#</th><th>批次号</th><th>PKG Type</th><th>封装料号</th><th class="num">数量(颗)</th><th class="num">单价(元/粒)</th><th class="num">金额(元)</th><th class="center" style="width:64px">操作</th></tr></thead>
          <tbody>${st.items.map((x, i) => `<tr>
            <td class="num muted">${i + 1}</td>
            <td style="font-family:ui-monospace,Consolas,monospace">${esc(x.batch)}</td>
            <td><span style="color:${TYPE_COLOR[x.type] || 'var(--text-3)'};font-weight:700">${esc(typeName(x.type))}</span></td>
            <td style="font-family:ui-monospace,Consolas,monospace">${esc(x.outline)}</td>
            <td class="num">${x.qty.toLocaleString('en-US')}</td>
            <td class="num">${x.price.toFixed(4)}</td>
            <td class="num"><b>${Math.round(x.qty * x.price).toLocaleString('en-US')}</b></td>
            <td class="center"><button class="btn btn-sm btn-ghost" data-del="${esc(x.batch)}" style="color:#dc2626;padding:2px 8px">移除</button></td>
          </tr>`).join('') || '<tr><td colspan="8" class="center muted" style="padding:22px">暂无批次，可点「＋ 添加批次」或重新计算</td></tr>'}</tbody>
        </table>
      </div>
      <div class="mt10 flex acenter gap12" style="flex-wrap:wrap;font-size:14px">
        <span>合计：<b>${st.items.length}</b> 批 · 总数量 <b>${totQ.toLocaleString('en-US')}</b> 颗 · 总价 <b style="color:#1d4ed8">${Math.round(totA).toLocaleString('en-US')}</b> 元</span>
        <span>${note}</span>
        <span class="flex gap8" style="margin-left:auto">
          <button class="btn btn-sm" id="acAddBtn">＋ 添加批次</button>
          <button class="btn btn-sm btn-primary" id="acRecalc">${icon('zap', 14)} 再次计算</button>
        </span>
      </div>
      <div id="acAddBox" style="display:none" class="mt10"></div>`;
    m.querySelectorAll('[data-del]').forEach(b => {
      b.onclick = () => {
        const i = st.items.findIndex(x => x.batch === b.dataset.del);
        if (i >= 0) { st.items.splice(i, 1); renderAcResult(m); }
      };
    });
    m.querySelector('#acAddBtn').onclick = () => {
      const box = m.querySelector('#acAddBox');
      const show = box.style.display === 'none';
      box.style.display = show ? '' : 'none';
      if (show) renderAcCands(m);
    };
    m.querySelector('#acRecalc').onclick = () => recalcAuto(m);
  }

  function renderAcCands(m) {
    const st = m._ac;
    const box = m.querySelector('#acAddBox');
    if (!box) return;
    const used = new Set(st.items.map(x => x.batch));
    const cands = drRows().filter(r => !used.has(r[6]) && priceOfSub(r[1], r[3]) > 0);
    box.innerHTML = `
      <div class="small muted" style="margin-bottom:6px">可添加批次（未在清单中，按当前排序展示，整批加入）· 共 ${cands.length} 批</div>
      <div style="overflow:auto;border:1px solid var(--border);border-radius:10px;background:var(--surface);max-height:200px">
        <table class="table wdt" style="width:100%;border:0;min-width:640px">
          <thead><tr><th>批次号</th><th>PKG Type</th><th>封装料号</th><th class="num">数量(颗)</th><th class="num">单价(元/粒)</th><th class="num">整批金额(元)</th><th class="center" style="width:64px">操作</th></tr></thead>
          <tbody>${cands.map(r => { const p = priceOfSub(r[1], r[3]); return `<tr>
            <td style="font-family:ui-monospace,Consolas,monospace">${esc(r[6])}</td>
            <td><span style="color:${TYPE_COLOR[r[1]] || 'var(--text-3)'};font-weight:700">${esc(typeName(r[1]))}</span></td>
            <td style="font-family:ui-monospace,Consolas,monospace">${esc(r[3])}</td>
            <td class="num">${r[7].toLocaleString('en-US')}</td>
            <td class="num">${p.toFixed(4)}</td>
            <td class="num"><b>${Math.round(r[7] * p).toLocaleString('en-US')}</b></td>
            <td class="center"><button class="btn btn-sm" data-add="${esc(r[6])}" style="padding:2px 8px">加入</button></td>
          </tr>`; }).join('') || '<tr><td colspan="7" class="center muted" style="padding:18px">没有可添加的批次</td></tr>'}</tbody>
        </table>
      </div>`;
    box.querySelectorAll('[data-add]').forEach(b => {
      b.onclick = () => {
        const r = drRows().find(x => x[6] === b.dataset.add);
        if (!r || st.items.some(x => x.batch === r[6])) return;
        const price = priceOfSub(r[1], r[3]);
        st.items.push({ batch: r[6], type: r[1], outline: r[3], qty: r[7], price });
        renderAcResult(m);
      };
    });
  }

  function recalcAuto(m) {
    const st = m._ac;
    if (!st) { runAutoCalc(m); return; }
    const mode = (m.querySelector('input[name="acMode"]:checked') || {}).value || 'qty';
    const raw = Number(m.querySelector('#acNeed').value);
    if (!raw || raw <= 0) { toast('请输入大于 0 的目标值', 'warn'); return; }
    st.mode = mode;
    st.need = mode === 'qty' ? Math.round(raw) : raw;
    const { totQ, totA } = acTotals(st.items);
    let remaining = mode === 'qty' ? st.need - totQ : st.need - totA;
    if (remaining <= 0) {
      renderAcResult(m);
      toast(mode === 'qty' ? '已达/超出目标数量，可手动移除部分批次' : '预算已用尽/超出，可手动移除部分批次', 'warn');
      return;
    }
    const used = new Set(st.items.map(x => x.batch));
    for (const r of drRows()) {
      if (remaining <= 0) break;
      if (used.has(r[6])) continue;
      const price = priceOfSub(r[1], r[3]);
      if (price <= 0) continue;
      const take = mode === 'qty' ? Math.min(r[7], remaining) : Math.min(r[7], Math.floor(remaining / price));
      if (take <= 0) continue;
      st.items.push({ batch: r[6], type: r[1], outline: r[3], qty: take, price });
      remaining -= mode === 'qty' ? take : take * price;
      used.add(r[6]);
    }
    renderAcResult(m);
  }

  function runAutoCalc(m) {
    const mode = (m.querySelector('input[name="acMode"]:checked') || {}).value || 'qty';
    const raw = Number(m.querySelector('#acNeed').value);
    if (!raw || raw <= 0) { toast('请输入大于 0 的目标值', 'warn'); return; }
    const need = mode === 'qty' ? Math.round(raw) : raw;
    let remaining = need;
    const items = [];
    for (const r of drRows()) {
      if (remaining <= 0) break;
      const price = priceOfSub(r[1], r[3]);
      if (price <= 0) continue;
      const take = mode === 'qty'
        ? Math.min(r[7], remaining)
        : Math.min(r[7], Math.floor(remaining / price));
      if (take <= 0) continue;
      items.push({ batch: r[6], type: r[1], outline: r[3], qty: take, price });
      remaining = mode === 'qty' ? remaining - take : remaining - take * price;
    }
    if (!items.length) { toast('当前筛选条件下无可取批次', 'warn'); return; }
    m._ac = { mode, need, items };
    renderAcResult(m);
  }

  document.addEventListener('keydown', e => { if (e.key === 'Escape' && drawerOpen) closeDrawer(); });

  render();
})();
