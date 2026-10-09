/* ============ 设备报修 / 换模 · 近 24 小时事件（我方系统演示数据） ============
   来源：我方已落地的「设备报修系统」与「模具管理系统」（非客户次品数据，属跨系统联动卖点）。
   次品管理二级机台树状图每个机台节点后的「报修 N / 换模 N」角标即取自此处的实时快照。
   设计：
   - 演示项目为静态零依赖，故事件在页面加载时按「机台名 + 当天日期」做确定性伪随机生成；
     同一机台当天计数稳定，时间戳落在 [now-24h, now] 窗口内（始终呈现“近 24 小时”语义）。
   - 真实接入时，把 DeviceEvents.of 改为调用后端 / 我方系统接口即可，页面其余逻辑不变。
   API：
   - DeviceEvents.of(dev, now?) -> { repair:[{t,id,reason}], mold:[{t,id,from,to}], nRep, nMold }
       t = 毫秒时间戳（近 24h）；id = 工单号；reason = 故障描述；from/to = 换模前后模具号。 */
(function () {
  // 次品模块真实出现的机台（BMD-* / QMD-*），用于可读性；未知机台按名字哈希仍可生成。
  const MACHINES = ['BMD-22', 'BMD-09', 'BMD-14', 'BMD-19', 'BMD-07', 'BMD-02', 'BMD-21', 'BMD-17', 'QMD-12', 'BMD-16', 'BMD-18', 'BMD-01'];
  const REASONS = ['模具温度偏差', '顶针卡滞', '真空报警', '合模不到位', '顶出异常', '射胶压力波动', '热流道堵塞', '嵌件定位偏移'];
  const MOLDS = ['M-1042', 'M-1170', 'M-0931', 'M-1288', 'M-0755', 'M-1402', 'M-0618', 'M-1533'];

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

  function of(dev, now) {
    now = now || Date.now();
    // 按「机台 + 当天」取种子 → 同日稳定、跨天刷新（仍落在近 24h 窗口）
    const seed = hash(dev + '|' + new Date(now).toISOString().slice(0, 10));
    const r = rnd(seed);
    const nRep = Math.floor(r() * 5);   // 0..4 单
    const nMold = Math.floor(r() * 4);  // 0..3 次
    const repair = [], mold = [];
    for (let i = 0; i < nRep; i++) {
      const off = 5 + Math.floor(r() * (1440 - 5)); // 距现在 5~1439 分钟
      repair.push({ t: now - off * 60000, id: 'R' + (1000 + Math.floor(r() * 8999)), reason: REASONS[Math.floor(r() * REASONS.length)] });
    }
    for (let i = 0; i < nMold; i++) {
      const off = 5 + Math.floor(r() * (1440 - 5));
      const fi = Math.floor(r() * MOLDS.length);
      let ti = Math.floor(r() * MOLDS.length);
      if (ti === fi) ti = (ti + 1) % MOLDS.length;
      mold.push({ t: now - off * 60000, id: 'M' + (2000 + Math.floor(r() * 7999)), from: MOLDS[fi], to: MOLDS[ti] });
    }
    repair.sort((a, b) => b.t - a.t); // 最近优先
    mold.sort((a, b) => b.t - a.t);
    return { repair, mold, nRep: repair.length, nMold: mold.length };
  }

  // 便于浮窗格式化时间
  function hhmm(t) { const d = new Date(t); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }

  window.DeviceEvents = { of, hhmm, MACHINES };
})();
