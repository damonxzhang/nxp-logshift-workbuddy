/* ============ WIP 在制品看板（产量 · 二级钻取） ============
   需求来源：《OneBE添加交接信息.pdf》第四部分「4. WIP」：
     一级界面：按 pkgType 显示各个工序的 WIP（by real unit、by earn 两种口径）；
     二级界面：进入指定工序，按自定义条件筛选 WIP（pkg type / pkg family / pkg size / machine no…）；
     二级界面支持配置各项指标报警的范围（BE CT / OTD，阈值本地可配）。
   样式刻意区别于客户现有深蓝科技风（环形仪表 + 横条）：浅色卡片 + 热力矩阵 + 排行条 + Hold 跑马灯，
   动效：数字滚动 / 条形生长 / 热力格渐入 / 巡检高亮 / 跑马灯 / 抽屉滑入。
   数据：客户 IT 导出《BE1 WIP Report-V26.xls》（真实数据，见 wip-real-data.js），
   金额按 OP 配置单价（opPriceOf，LGA 复用 BGA/LGA 价）折算 Earn。 */
(function () {
  renderShell('wip');

  const canExport = CurrentUser.can('output', 'export');

  /* ---------------- 真实数据 ---------------- */
  const RAW = (typeof WIP_REAL_DATA !== 'undefined' && WIP_REAL_DATA) || { meta: {}, rows: [] };
  const rows = RAW.rows || [];
  if (!rows.length) { document.getElementById('content').innerHTML = '<div class="notice mt16">未找到 WIP 数据（wip-real-data.js），请重跑 .extract-wip.py。</div>'; return; }

  /* 品类调色板（与 OP 大屏一致；WIP 原始口径区分 BGA / LGA） */
  const TYPE_COLOR = { BGA: '#1d4ed8', LGA: '#0b8a5a', QFN: '#8b5cf6', PQFN: '#0b6a86', FCCSP: '#a8620b' };
  const typeName = t => (t === 'LGA' ? 'BGA/LGA' : t);
  /* 单价口径：OP 配置里 BGA / LGA 合为「BGA/LGA」一类，两原始品类共用同一单价 */
  const PRICE_KEY = { BGA: 'BGA/LGA', LGA: 'BGA/LGA' };
  const priceOf = t => opPriceOf(PRICE_KEY[t] || t);           // 元/粒

  /* 数量→口径值：unit='K' 千颗 | '万' Earn 万元（按品类单价折算，逐行乘单价后求和） */
  let unit = store.get('wip_unit', 'K');
  const valOf = (qty, type) => unit === 'K' ? qty / 1000 : qty * priceOf(type) / 10000;
  const unitLabel = () => unit === 'K' ? 'K' : '万';
  const fmtVal = v => v == null ? '—' : (v >= 1000 ? Math.round(v).toLocaleString('en-US') : v.toFixed(1));

  /* 品类清单（按在制量降序） */
  const typeQty = {};
  rows.forEach(r => { typeQty[r[1]] = (typeQty[r[1]] || 0) + r[7]; });
  const ALL_TYPES = Object.keys(typeQty).sort((a, b) => typeQty[b] - typeQty[a]);
  let typeSel = store.get('wip_types', []);
  const selTypes = () => { const ok = typeSel.filter(t => ALL_TYPES.includes(t)); return ok.length ? ok : ALL_TYPES; };
  const saveSel = () => store.set('wip_types', typeSel);

  /* ---------------- 聚合 ----------------
     每个工序：按品类数量 / 金额、批次数、Hold、OTD 逾期 */
  function stepAgg() {
    const types = selTypes();
    const m = {};
    rows.forEach(r => {
      if (!types.includes(r[1])) return;
      const s = m[r[0]] || (m[r[0]] = { step: r[0], qty: 0, val: 0, lots: 0, hold: 0, otd: 0, byType: {} });
      s.qty += r[7]; s.val += valOf(r[7], r[1]); s.lots++;
      s.byType[r[1]] = (s.byType[r[1]] || 0) + r[7];
      if (r[13] > 0) s.hold++;
      if (r[12] != null && r[12] < 0) s.otd++;
    });
    return Object.values(m).sort((a, b) => b.qty - a.qty);
  }
  const rowsOf = steps => rows.filter(r => steps.includes(r[0]) && selTypes().includes(r[1]));

  /* ---------------- 全局汇总 ---------------- */
  function globalAgg() {
    const types = selTypes();
    let qty = 0, earn = 0, lots = 0, hold = 0, otd = 0;
    rows.forEach(r => {
      if (!types.includes(r[1])) return;
      qty += r[7]; earn += r[7] * priceOf(r[1]) / 10000; lots++;
      if (r[13] > 0) hold++;
      if (r[12] != null && r[12] < 0) otd++;
    });
    return { qty, earn, lots, hold, otd };
  }

  /* ---------------- 工序工艺顺序（按报表首次出现顺序，用于流向 / 极坐标方案） ---------------- */
  const STEP_ORDER = (function () {
    const o = [], seen = {};
    rows.forEach(r => { if (!(r[0] in seen)) { seen[r[0]] = 1; o.push(r[0]); } });
    return o;
  })();
  function stepsInOrder() {
    const m = {};
    stepAgg().forEach(s => { m[s.step] = s; });
    return STEP_ORDER.map(k => m[k]).filter(Boolean);
  }

  /* ---------------- 动态可视化方案（备选，真实数据驱动） ---------------- */
  const VIZ_LIST = (window.WipViz ? WipViz.ORDER : ['A']).map(k => Object.assign({ key: k }, WipViz.SCHEMES[k]));
  let viz = store.get('wip_viz', 'A');
  if (viz !== 'ALL' && VIZ_LIST.every(v => v.key !== viz)) viz = 'A';
  const saveViz = () => store.set('wip_viz', viz);
  let vizPatrol = null, vizSpot = 0;

  function vizCtx(steps) {
    const keep = selTypes();
    return {
      scheme: viz, rows: rows.filter(r => keep.includes(r[1])), steps, stepsOrder: stepsInOrder(),
      types: keep, unitLabel, valOf, fmtVal, typeColor: TYPE_COLOR, typeName,
      alarm: alarmCfg, openDrawer
    };
  }

  function renderViz(steps) {
    const host = document.getElementById('vizHost');
    if (!host) return;
    host.innerHTML = WipViz.html(vizCtx(steps));
    WipViz.animate(host, vizCtx(steps));

    /* 方案 A 的工序巡检高亮（与热力矩阵共用轮询节奏） */
    if (vizPatrol) clearInterval(vizPatrol);
    if (viz === 'A' || viz === 'ALL') {
      vizPatrol = setInterval(() => {
        if (drawerOpen || document.hidden) return;
        const els = host.querySelectorAll('.vz-ring');
        if (!els.length) return;
        els.forEach(x => x.classList.remove('spot'));
        vizSpot = (vizSpot + 1) % els.length;
        els[vizSpot].classList.add('spot');
      }, 3500);
    }
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

  function render() {
    const g = globalAgg();
    const m = RAW.meta || {};
    const holdLots = rows.filter(r => r[13] > 0);
    const steps = stepAgg();
    const heatRows = steps.slice(0, 16);

    document.getElementById('content').innerHTML = `
      <div class="notice mt16">
        ${icon('database', 17)} <strong>真实数据</strong> · 来源客户 IT 导出《${esc(m.source || 'BE1 WIP Report-V26.xls')}》在制品快照 ·
        共 <strong>${(m.lots || rows.length).toLocaleString('en-US')}</strong> 批 · 合计 <strong>${fmtVal((m.totalQty || 0) / 1000)}K</strong> ·
        抽取于 ${esc(m.extractedAt || '—')}（IT 更新报表后重跑 .extract-wip.py 即可刷新）
      </div>

      <div class="wip-kpis mt16">
        <div class="wip-kpi" style="--wk-accent:#1d4ed8"><div class="wk-label">${icon('layers', 15)} WIP 在制总量</div>
          <div class="wk-value" id="kTotal">0</div><div class="wk-foot">按当前口径 ${unit === 'K' ? '数量（千颗）' : '金额（Earn）'}</div></div>
        <div class="wip-kpi" style="--wk-accent:#0b6a86"><div class="wk-label">${icon('file', 15)} 在制批次</div>
          <div class="wk-value" id="kLots">0</div><div class="wk-foot">覆盖 ${steps.length} 个工序</div></div>
        <div class="wip-kpi" style="--wk-accent:#a8620b"><div class="wk-label">${icon('clock', 15)} Earn 占用</div>
          <div class="wk-value" id="kEarn">0</div><div class="wk-foot">按 OP 单价折算（万元）</div></div>
        <div class="wip-kpi ${g.hold ? 'is-danger' : ''}" style="--wk-accent:#cc2f2a"><div class="wk-label"><i class="wk-pulse" style="${g.hold ? '' : 'display:none'}"></i> Hold 暂停</div>
          <div class="wk-value" id="kHold">0</div><div class="wk-foot">批次 · 见下方跑马灯明细</div></div>
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

      <section class="card mt16 wip-viz">
        <div class="card-head">
          <div class="card-title">${icon('zap', 19)} 动态可视化 · 方案对比
            <span class="card-sub">5 个备选展示方案，全部由客户真实明细驱动 · 切换查看，选定后可固化为看板默认图表</span></div>
          <div class="vz-seg" id="vizSeg">
            ${VIZ_LIST.map(v => `<button data-v="${v.key}" class="${viz === v.key ? 'on' : ''}">${icon(v.icon, 15)} 方案 ${v.key} · ${v.name}</button>`).join('')}
            <button data-v="ALL" class="${viz === 'ALL' ? 'on' : ''}">${icon('grid', 15)} 全部平铺对比</button>
          </div>
        </div>
        <div class="card-body">
          <div id="vizHost" class="vz-host"></div>
          <div class="vz-info" id="vzInfo">${icon('search', 14)} 把鼠标移到图表上查看明细 · 点击任意图形进入该工序的二级筛选。</div>
        </div>
      </section>

      <div class="grid g-23 mt16">
        <section class="card">
          <div class="card-head"><div class="card-title">${icon('grid', 19)} 工序 × PKG Type 热力矩阵
            <span class="card-sub">颜色深浅 = 该格占该品类在制量的比重 · 悬停查看明细 · 点击进入该工序</span></div></div>
          <div class="card-body wip-heat"><div class="wh-grid" id="whGrid" style="--wh-cols:${selTypes().length}"></div>
            <div class="wh-info" id="whInfo">把鼠标移到任意格子上查看该「工序 × 品类」的在制明细。</div>
          </div>
        </section>
        <section class="card">
          <div class="card-head"><div class="card-title">${icon('activity', 19)} 工序 WIP 排行
            <span class="card-sub">堆叠条按品类构成 · 自动巡检高亮 · 点击进入</span></div></div>
          <div class="card-body wip-rank" id="wrList" style="max-height:430px;overflow:auto"></div>
        </section>
      </div>

      <section class="card mt16">
        <div class="card-head"><div class="card-title">${icon('bell', 19)} Hold 暂停批次 · 滚动提醒
          <span class="card-sub">共 ${holdLots.length} 批 · 悬停暂停滚动 · 数据乱码为源文件原生编码所致</span></div></div>
        <div class="card-body" style="padding-top:10px;padding-bottom:10px">
          ${holdLots.length ? `<div class="wip-ticker"><div class="tk-track" style="--tk-dur:${Math.max(24, holdLots.length * 7)}s">${(holdLots.concat(holdLots)).map(r => `
            <span class="tk-item"><b>${esc(r[6])}</b><span class="tk-days">Hold ${r[13]} 天</span>
            <span class="tk-step">${esc(r[0])}</span><span>${typeName(r[1])} · ${fmtVal(r[7] / 1000)}K</span></span>`).join('')}</div></div>`
        : '<div class="small muted">当前无 Hold 批次。</div>'}
        </div>
      </section>`;

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

    /* 动态可视化方案切换 */
    const vseg = document.getElementById('vizSeg');
    if (vseg) vseg.querySelectorAll('button').forEach(b => {
      b.onclick = () => { viz = b.dataset.v; saveViz(); render(); };
    });

    renderHeat(heatRows, steps);
    renderRank(steps);
    renderViz(steps);
    startPatrol(steps);
  }

  /* ---------------- 热力矩阵 ---------------- */
  function renderHeat(heatRows, steps) {
    const types = selTypes();
    const colMax = {};
    types.forEach(t => { colMax[t] = Math.max(1e-9, ...steps.map(s => (s.byType[t] || 0))); });
    const grid = document.getElementById('whGrid');
    const info = document.getElementById('whInfo');

    const head = `<div class="wh-row" style="animation-delay:0s"><div class="wh-head">工序 \\ 品类</div>
      ${types.map(t => `<div class="wh-head" style="color:${TYPE_COLOR[t] || 'var(--text-3)'}">${esc(typeName(t))}</div>`).join('')}
      <div class="wh-head">合计（${unitLabel()}）</div></div>`;

    const body = heatRows.map((s, ri) => {
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
        const lotN = rows.filter(r => r[0] === step && r[1] === t).length;
        const holdN = rows.filter(r => r[0] === step && r[1] === t && r[13] > 0).length;
        info.innerHTML = `<strong>${esc(step)}</strong> × <strong>${esc(typeName(t))}</strong>：在制
          <strong>${fmtVal(q / 1000)}K</strong>（Earn ${fmtVal(q * priceOf(t) / 10000)} 万）· ${lotN} 批 · Hold ${holdN} 批 — 点击进入二级筛选`;
      }
    };
    grid.onclick = e => {
      const el = e.target.closest('[data-step]');
      if (el) openDrawer(el.dataset.step);
    };
  }

  /* ---------------- 排行条 ---------------- */
  function renderRank(steps) {
    const types = selTypes();
    const list = steps.slice(0, 12);
    const rest = steps.slice(12);
    const max = Math.max(1e-9, ...list.map(s => s.qty));
    const el = document.getElementById('wrList');
    el.innerHTML = list.map((s, i) => {
      const segs = types.map(t => {
        const q = s.byType[t] || 0;
        if (!q) return '';
        return `<i class="wr-seg" data-w="${(q / max * 100).toFixed(2)}" style="background:${TYPE_COLOR[t] || '#64748b'}"></i>`;
      }).join('');
      return `<div class="wr-item" data-step="${esc(s.step)}" style="animation-delay:${(i * 0.05).toFixed(2)}s">
        <div class="wr-line"><span class="wr-name" title="进入二级筛选">${esc(s.step)}</span>
          <span class="wr-val">${fmtVal(s.val)}</span><span class="small muted">${unitLabel()}</span>
          <span class="wr-meta">${s.lots} 批${s.hold ? ` · <span style="color:var(--danger)">Hold ${s.hold}</span>` : ''}${s.otd ? ` · <span style="color:var(--danger)">OTD ${s.otd}</span>` : ''}</span></div>
        <div class="wr-bar" title="进入 ${esc(s.step)} 二级筛选">${segs}</div></div>`;
    }).join('') + (rest.length ? `<div class="wr-rest">其余 ${rest.length} 个工序合计 ${fmtVal(rest.reduce((a, s) => a + s.val, 0))}${unitLabel()}（${rest.map(s => esc(s.step)).join(' · ')}）</div>` : '');

    /* 条形生长动画：先置 0，下一帧写入目标宽度触发过渡 */
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.querySelectorAll('.wr-seg[data-w]').forEach(sg => { sg.style.width = sg.dataset.w + '%'; });
    }));
    el.onclick = e => {
      const item = e.target.closest('.wr-item');
      if (item) openDrawer(item.dataset.step);
    };
  }

  /* ---------------- 自动巡检高亮 ---------------- */
  function startPatrol(steps) {
    if (patrolTimer) clearInterval(patrolTimer);
    const targets = () => document.querySelectorAll('.wr-item');
    patrolTimer = setInterval(() => {
      if (drawerOpen || document.hidden) return;
      const els = targets();
      if (!els.length) return;
      els.forEach(x => x.classList.remove('spot'));
      const hs = document.querySelectorAll('.wh-row[data-step]');
      hs.forEach(x => x.classList.remove('spot'));
      patrolIdx = (patrolIdx + 1) % steps.length;
      const step = steps[patrolIdx].step;
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
      dr = { step, types: selTypes().slice(), size: '', outline: '', loc: '', bank: '', holdOnly: false, kw: '', sort: 'otd', page: 1 };
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
    let list = rows.filter(r => r[0] === dr.step
      && dr.types.includes(r[1])
      && (!dr.size || r[2] === dr.size)
      && (!dr.outline || r[3] === dr.outline)
      && (!dr.loc || r[9] === dr.loc)
      && (!dr.bank || r[15] === dr.bank)
      && (!dr.holdOnly || r[13] > 0)
      && (!kw || (r[6] + ' ' + r[4] + ' ' + r[3] + ' ' + r[5]).toLowerCase().includes(kw)));
    const cmp = {
      otd: (a, b) => (a[12] == null ? 1e9 : a[12]) - (b[12] == null ? 1e9 : b[12]),
      ct: (a, b) => (b[10] || 0) - (a[10] || 0),
      qty: (a, b) => b[7] - a[7]
    }[dr.sort];
    return list.sort(cmp);
  }

  function buildDrawer() {
    const all = rows.filter(r => r[0] === dr.step);
    const uniq = (arr, i) => Array.from(new Set(arr.map(r => r[i]).filter(x => x !== ''))).sort();
    const sizes = uniq(all, 2), outlines = uniq(all, 3), locs = uniq(all, 9), banks = uniq(all, 15);
    const list = drRows();
    const qty = list.reduce((a, r) => a + r[7], 0);
    const earn = list.reduce((a, r) => a + r[7] * priceOf(r[1]) / 10000, 0);
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
          <span class="flex-1"></span>
          ${canExport ? `<button class="btn btn-sm btn-primary" id="wdExport">${icon('download', 15)} 导出 Excel（${list.length} 批）</button>` : '<span class="chip">只读（无导出权限）</span>'}
        </div>

        <div style="overflow:auto;border:1px solid var(--border);border-radius:10px;background:var(--surface)">
          <table class="table wdt" style="width:100%;border:0;min-width:980px">
            <thead><tr><th>批次号</th><th>PKG Type</th><th>尺寸</th><th>封装料号</th><th>器件</th>
              <th class="num">数量</th><th>机台/位置</th><th class="num">BE CT(天)</th><th class="num">ASSY CT(天)</th>
              <th class="num">OTD 余量(天)</th><th>Hold</th><th>Bank</th><th>线材</th></tr></thead>
            <tbody>${view.map(r => {
              const ct = r[10], otdV = r[12];
              const ctCls = ct != null && ct >= alarmCfg.ctR ? 'r2' : (ct != null && ct >= alarmCfg.ctY ? 'r1' : '');
              const rowCls = (ct != null && ct >= alarmCfg.ctR) || (otdV != null && otdV <= alarmCfg.otd && otdV < 0) ? 'al-red'
                : (ct != null && ct >= alarmCfg.ctY ? 'al-yel' : '');
              return `<tr class="${rowCls}">
                <td style="font-family:ui-monospace,Consolas,monospace">${esc(r[6])}</td>
                <td><span style="color:${TYPE_COLOR[r[1]] || 'var(--text-3)'};font-weight:700">${esc(typeName(r[1]))}</span></td>
                <td>${esc(r[2]) || '—'}</td>
                <td style="font-family:ui-monospace,Consolas,monospace">${esc(r[3])}</td>
                <td title="${esc(r[4])}">${esc(r[4].length > 16 ? r[4].slice(0, 15) + '…' : r[4])}</td>
                <td class="num">${r[7].toLocaleString('en-US')}</td>
                <td>${esc(r[9]) || '—'}</td>
                <td class="num">${ct == null ? '—' : `<span class="ct-badge ${ctCls}">${ct.toFixed(1)}</span>`}</td>
                <td class="num">${r[11] == null ? '—' : r[11].toFixed(1)}</td>
                <td class="num ${otdV != null && otdV < 0 ? 'otd-bad' : ''}">${otdV == null ? '—' : otdV.toFixed(1)}</td>
                <td>${r[13] > 0 ? `<span class="chip" style="color:var(--danger);border-color:#f3c2bf">${r[13]} 天</span>` : '<span class="muted small">—</span>'}</td>
                <td>${esc(r[15])}</td><td>${esc(r[16]) || '—'}</td></tr>`;
            }).join('') || '<tr><td colspan="13" class="center muted" style="padding:26px">当前筛选条件下无批次。</td></tr>'}</tbody>
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
    const ex = drawer.querySelector('#wdExport');
    if (ex) ex.onclick = () => {
      const headers = ['批次号', 'PKG Type', 'PKG SIZE', '封装料号', '器件', '产品族', '数量(颗)', 'Qty by I/O', '机台/位置',
        'BE_CT(天)', 'ASSY_CT(天)', 'OTD余量(天)', 'Hold(天)', 'Hold原因', 'Bank', '线材', 'DC'];
      const rs = drRows();
      exportExcel('WIP_' + dr.step + '_在制明细.xls', headers, rs.map(r => [r[6], r[1], r[2], r[3], r[4], r[5], r[7], r[8], r[9], r[10], r[11], r[12], r[13], r[14], r[15], r[16], r[17]]));
      toast('已导出 ' + rs.length + ' 批明细（' + dr.step + '）', 'success');
    };
    drawer.querySelector('#pgPrev').onclick = () => { if (dr.page > 1) { dr.page--; buildDrawer(); } };
    drawer.querySelector('#pgNext').onclick = () => { if (dr.page < pages) { dr.page++; buildDrawer(); } };
    drawer.querySelectorAll('[data-pg]').forEach(b => { b.onclick = () => { dr.page = +b.dataset.pg; buildDrawer(); }; });
  }

  document.addEventListener('keydown', e => { if (e.key === 'Escape' && drawerOpen) closeDrawer(); });

  render();
})();
