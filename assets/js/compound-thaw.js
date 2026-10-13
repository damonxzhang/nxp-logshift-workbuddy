/* ============ COMPound 塑封料出库解冻 · 近况（我方系统演示数据） ============
   来源：我方已落地的「COMPound 塑封料出库解冻」系统（属跨系统联动卖点，与 WIP 在制强相关）。
   WIP 在制品看板二级明细每行「塑封料解冻」列即取自此处的实时快照，用于解释「批次为何卡住」。
   设计：
   - 演示项目为静态零依赖，故解冻状态在页面加载时按「批次号 + 当天日期」做确定性伪随机生成；
     同一批次当天状态稳定，时间戳落在合理窗口内（始终呈现“解冻中 / 已就绪 / 超时”语义）。
   - 真实接入时，把 CompoundThaw.of 改为调用后端 / 我方系统接口即可，页面其余逻辑不变。
   API：
   - CompoundThaw.of(lot, now?) -> { status:'ready'|'thawing'|'overtime', matLot, start, ready, overtime, needH }
       status = 解冻状态；matLot = 塑封料批号；start/ready = 解冻开始/预计就绪时间戳(ms)；
       overtime = 超时小时数（仅 overtime 状态 > 0）；needH = 基准解冻时长(小时)。 */
(function () {
  // 塑封料批号前缀（演示可读性）
  const MATERIALS = ['CM-7710', 'CM-8820', 'CM-6591', 'CM-9340', 'CM-5128', 'CM-4467', 'CM-8035', 'CM-3102'];

  // FNV-1a 字符串哈希（稳定、无依赖）
  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  // mulberry32：由种子产出 [0,1) 序列
  function rnd(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pad2 = n => (n < 10 ? '0' + n : '' + n);
  const H = 3600000;

  function of(lot, now) {
    now = now || Date.now();
    // 按「批次 + 当天」取种子 → 同日稳定、跨天刷新
    const seed = hash(lot + '|' + new Date(now).toISOString().slice(0, 10));
    const r = rnd(seed);
    const needH = 6 + Math.floor(r() * 18);          // 基准解冻时长 6..23h
    const roll = r();
    let status, overtime = 0, start, ready;
    if (roll < 0.09) {                                 // ≈9% 解冻超时
      status = 'overtime';
      overtime = 2 + Math.floor(r() * 22);            // 超时 2..23h
      ready = now - overtime * H;
      start = ready - needH * H;
    } else if (roll < 0.30) {                          // ≈21% 解冻中
      status = 'thawing';
      const progress = 0.2 + r() * 0.7;               // 进度 20%~90%
      start = now - progress * needH * H;
      ready = start + needH * H;
    } else {                                           // ≈70% 已解冻
      status = 'ready';
      const done = needH + 1 + Math.floor(r() * 48);  // 已完成多久(小时)
      ready = now - done * H;
      start = ready - needH * H;
    }
    const matLot = MATERIALS[Math.floor(r() * MATERIALS.length)] + '-' + (1000 + Math.floor(r() * 8999));
    return { status, matLot, start, ready, overtime, needH };
  }

  // 便于浮窗格式化时间
  function hhmm(t) { const d = new Date(t); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }

  window.CompoundThaw = { of, hhmm, MATERIALS };
})();
