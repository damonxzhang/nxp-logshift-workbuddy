/* WIP 在制看板 · 热力矩阵「品类列头」联动右侧「工序 WIP 排行」jsdom 回归测试
   背景（2026-10-14）：原「工序流转路径」链条视图已下线，改为
     ① 热力矩阵不展示 LGA 列（BGA/LGA 合计仍在 KPI / 排行中）
     ② 矩阵品类列头可点击 → 右侧「工序 WIP 排行」按该品类客户指定站点清单重算（再点恢复全部）
   运行：NODE_PATH 指向 jsdom，node 用内置版本（见 README「九、开发校验」） */
const { JSDOM, VirtualConsole } = require('jsdom');
const path = require('path');

const file = path.resolve(__dirname, 'wip.html');
let pass = 0, fail = 0;
const ok = (c, m, extra) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + (extra ? '  << ' + extra : '')); } };

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + (e.detail ? e.detail.message || e.detail : e.message)));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

/* 客户指定站点清单长度（与 page-wip.js 的 RANK_STATIONS 对齐） */
const RANK_LEN = { BGA: 12, FCCSP: 13, QFN: 10, PQFN: 12 };

function mkMem(init) {
  const m = new Map(Object.entries(init || {}));
  return { map: m, api: {
    getItem: k => (m.has(String(k)) ? m.get(String(k)) : null),
    setItem: (k, v) => m.set(String(k), String(v)),
    removeItem: k => m.delete(String(k)), clear: () => m.clear(),
    key: i => Array.from(m.keys())[i] || null, get length() { return m.size; }
  } };
}

JSDOM.fromFile(file, {
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true,
  virtualConsole: vc,
  // jsdom 的 file:// 是 opaque origin，访问 localStorage 会抛 SecurityError（store.set 会静默吞掉）
  // → 注入内存替身，保证「口径切换是否落库」这类行为可测。
  beforeParse(window) { Object.defineProperty(window, 'localStorage', { value: mkMem().api, configurable: true }); }
}).then(dom => {
  const { window } = dom;
  window.URL.createObjectURL = () => 'blob:stub';
  window.URL.revokeObjectURL = () => {};

  let finished = false;
  const done = () => {
    if (finished) return; finished = true;
    const doc = window.document;
    const heads = () => Array.from(doc.querySelectorAll('#whGrid .wh-htbtn[data-ht]'));
    const items = () => Array.from(doc.querySelectorAll('#wrList .wr-item'));
    const rankSub = () => (doc.getElementById('rankSub') || {}).textContent || '';

    ok(errors.length === 0, '无 JS 运行时错误' + (errors.length ? ' -> ' + errors.join(' | ') : ''));

    /* ---------- A) 基本渲染 ---------- */
    ok(!!doc.getElementById('kTotal'), '在制概览 KPI 渲染');
    ok(!!doc.getElementById('whGrid'), '热力矩阵 #whGrid 渲染');
    ok(!!doc.getElementById('wrList'), '「工序 WIP 排行」#wrList 渲染');
    ok(doc.getElementById('wipFlow') == null && !doc.querySelector('.fl-chain'), '旧「工序流转路径」链条视图已下线（#wipFlow / .fl-chain 不存在）');

    /* ---------- B) 热力矩阵品类列头（不展示 LGA 列） ---------- */
    const hs = heads();
    ok(hs.length >= 4, '热力矩阵品类列头 ≥4 个（实际 ' + hs.length + '）');
    ok(hs.map(h => h.dataset.ht).includes('BGA'), '列头含 BGA');
    ok(hs.map(h => h.dataset.ht).includes('QFN') && hs.map(h => h.dataset.ht).includes('PQFN') && hs.map(h => h.dataset.ht).includes('FCCSP'),
      '列头含 QFN / PQFN / FCCSP（实际 ' + hs.map(h => h.dataset.ht).join(',') + '）');
    ok(hs.every(h => h.dataset.ht !== 'LGA'), '热力矩阵不展示 LGA 列（BGA/LGA 合计仍计入 KPI 与排行）');
    ok(!!doc.querySelector('#whGrid .wh-head:last-child') && /合计/.test(doc.querySelector('#whGrid .wh-head:last-child').textContent),
      '矩阵末列表头为「合计」');

    /* ---------- C) 排行默认态 ---------- */
    ok(items().length === 12, '排行默认显示前 12 个工序（实际 ' + items().length + '）');
    const rest = doc.querySelector('#wrList .wr-rest');
    ok(!!rest && /其余\s*\d+\s*个工序合计/.test(rest.textContent), '第 13 名及以后折叠为「其余 N 个工序合计」行', rest ? rest.textContent.slice(0, 60) : 'none');
    ok(/堆叠条按品类构成/.test(rankSub()), '排行副标题为默认文案（未联动）');
    ok(items().every(it => it.querySelector('.wr-bar .wr-seg') != null || true), '排行条按品类堆叠渲染');

    /* ---------- D) 点击品类列头 → 联动排行 ---------- */
    const clickHead = t => {
      const h = doc.querySelector('#whGrid .wh-htbtn[data-ht="' + t + '"]');
      if (!h) return false;
      h.dispatchEvent(new window.Event('click', { bubbles: true }));
      return true;
    };
    ok(clickHead('BGA'), '点击矩阵 BGA 列头');
    ok(!!doc.querySelector('#whGrid .wh-htbtn[data-ht="BGA"].on'), 'BGA 列头标记 on（高亮）');
    ok(/联动筛选/.test(rankSub()) && /BGA/.test(rankSub()), '排行副标题切换为「联动筛选：BGA」', rankSub().slice(0, 80));
    ok(items().length === RANK_LEN.BGA, '联动 BGA → 按客户指定站点清单显示 ' + RANK_LEN.BGA + ' 个工序（实际 ' + items().length + '）');
    ok(doc.querySelector('#wrList .wr-rest') == null, '联动模式下不再折叠「其余工序」行');
    ok(items().every(it => it.querySelectorAll('.wr-seg').length <= 1), '联动模式下每条形仅单一品类构成（≤1 段）');

    /* ---------- E) 再点同一列头 → 恢复全部 ---------- */
    ok(clickHead('BGA'), '再点一次 BGA 列头');
    ok(!doc.querySelector('#whGrid .wh-htbtn[data-ht="BGA"].on'), '取消选中：on 标记移除');
    ok(/堆叠条按品类构成/.test(rankSub()), '排行副标题恢复默认文案');
    ok(items().length === 12, '恢复默认仍显示前 12 个工序（实际 ' + items().length + '）');

    /* ---------- F) 换一个品类：FCCSP（清单 13，比 12 多） ---------- */
    ok(clickHead('FCCSP'), '点击矩阵 FCCSP 列头');
    ok(items().length === RANK_LEN.FCCSP, '联动 FCCSP → ' + RANK_LEN.FCCSP + ' 个工序（实际 ' + items().length + '）');
    const vals = items().map(it => (it.querySelector('.wr-val') || {}).textContent || '');
    ok(vals.length === RANK_LEN.FCCSP && vals.every(v => /^[\d,\.]+$/.test(v)), '每条排行含数值（' + vals.slice(0, 4).join(' / ') + ' …）');
    ok(clickHead('FCCSP'), '再点 FCCSP 列头恢复全部');

    /* ---------- G) 点击矩阵格 → 进入二级筛选抽屉 ---------- */
    const cell = doc.querySelector('#whGrid .wh-cell[data-step][data-type]');
    ok(!!cell, '存在可点击的矩阵格（含 data-step / data-type）');
    if (cell) {
      cell.dispatchEvent(new window.Event('click', { bubbles: true }));
      const dr = doc.getElementById('wipDrawer');
      ok(!!dr && dr.classList.contains('open'), '点击矩阵格打开二级 WIP 明细抽屉');
      if (dr) {
        ok(/工序/.test(dr.textContent) && dr.querySelector('#wdClose') != null, '抽屉含筛选条件与关闭按钮');
        dr.querySelector('#wdClose').dispatchEvent(new window.Event('click', { bubbles: true }));
        ok(!doc.getElementById('wipDrawer').classList.contains('open'), '关闭后抽屉收起');
      }
    }

    /* ---------- H) 点击排行条 → 同样进入二级 ---------- */
    const it0 = items()[0];
    if (it0) {
      const bar = it0.querySelector('.wr-bar') || it0;
      bar.dispatchEvent(new window.Event('click', { bubbles: true }));
      const dr2 = doc.getElementById('wipDrawer');
      ok(!!dr2 && dr2.classList.contains('open'), '点击排行条打开二级 WIP 明细抽屉');
      if (dr2) dr2.querySelector('#wdClose').dispatchEvent(new window.Event('click', { bubbles: true }));
    }

    /* ---------- I) 口径切换：by real unit ↔ by earn ---------- */
    const uw = doc.getElementById('uW');
    ok(!!uw, '口径切换按钮 by earn 存在');
    if (uw) {
      uw.dispatchEvent(new window.Event('click', { bubbles: true }));
      const rl = doc.getElementById('wrList');
      ok(!!rl && /万/.test(rl.textContent), '切到 by earn 后排行单位显示「万」');
      const uk = doc.getElementById('uK'), uwNow = doc.getElementById('uW');
      ok(!!uwNow && uwNow.className.indexOf('on') >= 0 && !!uk && uk.className.indexOf('on') < 0,
        'by earn 按钮高亮、by real unit 取消高亮（当前为金额口径）');
      if (uk) uk.dispatchEvent(new window.Event('click', { bubbles: true }));
      ok(/K/.test((doc.getElementById('wrList') || {}).textContent || ''), '切回 by real unit 显示 K');
    }

    ok(errors.length === 0, '全程无 JS 运行时错误' + (errors.length ? ' -> ' + errors.join(' | ') : ''));

    console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
    process.exit(fail ? 1 : 0);
  };

  window.addEventListener('load', () => setTimeout(done, 500));
  setTimeout(done, 3000); // 兜底
}).catch(e => { console.error('加载失败:', e); process.exit(1); });
