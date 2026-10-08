/* 无浏览器冒烟：用 jsdom 渲染 alerts.html / output.html，检查渲染无异常且关键节点存在 */
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const files = process.argv.slice(2);
let fail = 0;
const ok = (c, m, extra) => { c ? console.log('PASS ' + m) : (fail++, console.log('FAIL ' + m + (extra ? '  << ' + extra : ''))); };

(async () => {
  for (const f of files) {
    const errs = [];
    const vc = new VirtualConsole();
    vc.on('jsdomError', e => { if (!/Not implemented: navigation/.test(String(e))) errs.push(String(e.message || e)); });
    vc.on('error', (...a) => errs.push('console.error: ' + a.join(' ')));
    const dom = await JSDOM.fromFile(path.resolve(f), {
      runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc
    });
    await new Promise(r => setTimeout(r, 800));
    const doc = dom.window.document;
    const txt = (doc.getElementById('content') || doc.body).textContent || '';
    const html = (doc.getElementById('content') || doc.body).innerHTML || '';
    console.log('\n--- ' + f + ' ---');
    ok(errs.length === 0, '渲染无 JS 异常', errs.join(' | '));
    ok(txt.length > 100, '内容区已渲染（len=' + txt.length + '）');
    if (/alerts\.html/.test(f)) {
      ok(!/关键词库/.test(txt), '无「关键词库」卡');
      ok(!/新增关键词/.test(txt), '无「新增关键词」按钮');
      ok(/多对多绑定关系/.test(txt), '绑定关系卡存在');
      ok(/子系统 × 报警级别 × 紧急联系人/.test(txt), '绑定副标题已改为 子系统 × 报警级别 × 联系人');
      ok(/Output（OP）产出/.test(txt) && /WIP 在制品/.test(txt) && /次品管理/.test(txt), '三个子系统均出现');
      ok(!/生产制造 ERP|支付网关|仓储管理 WMS|视频监控 VMS/.test(txt), '旧 12 个通用子系统不再出现', (txt.match(/生产制造 ERP|支付网关|仓储管理 WMS|视频监控 VMS/) || [])[0]);
      ok(/紧急联系人/.test(txt), '紧急联系人卡仍存在');
      const rows = doc.querySelectorAll('table tbody tr').length;
      ok(rows >= 8, '表格行已渲染（rows=' + rows + '）');
      /* 打开新增绑定弹窗，检查选项为三个子系统 + 报警级别 */
      const nb = doc.getElementById('btnNewBind');
      if (nb) {
        nb.click();
        await new Promise(r => setTimeout(r, 300));
        const dlg = doc.getElementById('globalDialog');
        const dtxt = dlg ? dlg.textContent : '';
        ok(/Output（OP）产出/.test(dtxt) && /次品管理/.test(dtxt), '弹窗子系统选项为接入的 3 个系统');
        ok(/红色报警/.test(dtxt) && /黄色报警/.test(dtxt), '弹窗含报警级别选项');
        ok(!/关键词/.test(dtxt), '弹窗无关键词选项');
      } else ok(false, '找到「新增绑定」按钮');
    }
    if (/output\.html/.test(f)) {
      ok(!/周（周六起始）/.test(txt), '无「…周 · 日期范围（周六起始）」chip');
      ok(!/双部门视图 · /.test(txt), '无「双部门视图 · …」chip');
      ok(!/阈值 黄/.test(txt) || !/类合计/.test(txt), '无「阈值 …（N 类合计）」chip');
      ok(!/本周红灯 \d+ 天/.test(txt), '无「本周红灯 N 天」chip');
      ok(!/Earn 口径：/.test(txt), '无「Earn 口径：…」chip');
      ok(!/Earn 递进超差/.test(txt), '无「Earn 递进超差 N 天」chip');
      ok(!/配置 PKG Type \/ 每周目标 \/ 部门可见范围/.test(txt), '无「配置 PKG Type / 每周目标 / 部门可见范围」链接 chip');
      ok(!/悬停浮窗可点击/.test(txt), '无「悬停浮窗可点击」chip');
      ok(!/演示数据（本周尚无客户真实数据）/.test(txt), '无「演示数据（本周尚无客户真实数据）」chip');
      const cards = doc.querySelectorAll('.op-chart-card').length;
      ok(cards === 4, '2×2 四张图仍在（cards=' + cards + '）');
      ok(/点击图表查看「周维度累计表」/.test(html), '卡片副标题提示「点击图表查看周维度累计表」');
      const svg = doc.querySelector('.op-chart-card .card-body svg');
      ok(!!svg, 'SVG 已绘制');
      ok(svg && svg.style.cursor === 'pointer', 'SVG cursor=pointer（整图可点）', svg && svg.style.cursor);
      ok(!/lc-tcta/.test(html), '浮窗无 CTA 行');
      /* 10-08：图内不再标注两条线的具体取值（如 5,511K / 5,052K），只留参考线与该日刻度 */
      const SERIES_FILL = ['#1d4ed8', '#12805a', '#8b5cf6', '#0b6a86'];
      const valTexts = Array.from(doc.querySelectorAll('.op-chart-card .card-body svg text'))
        .filter(t => SERIES_FILL.includes(t.getAttribute('fill')))
        .map(t => t.textContent.trim())
        .filter(s => /\d/.test(s));
      ok(valTexts.length === 0, '图内无线条取值数值标注', valTexts.slice(0, 4).join(' / '));
      const endLab = Array.from(doc.querySelectorAll('.op-chart-card .card-body svg text'))
        .filter(t => t.getAttribute('fill') === '#5b6577').map(t => t.textContent.trim());
      ok(endLab.length >= 1, '基准日刻度标签仍在（' + endLab.slice(0, 2).join(',') + '）');
    }
    dom.window.close();
  }
  console.log('\nTOTAL_FAIL=' + fail);
  process.exit(fail ? 1 : 0);
})();
