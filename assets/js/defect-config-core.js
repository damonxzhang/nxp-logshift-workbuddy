/* ============ 次品管理 · 次品项主数据配置（核心数据层） ============
   用户在「次品项配置」页按 部门 / 工序 维护次品项（名称 + 代码）及其与设备（机台）的绑定关系。
   本文件负责：部门常量、设备池 / 工序 / 次品项种子数据、localStorage 读写（DefectCfgStore）。
   部门口径与 OP 模块一致：固定 LEAD / NON-LEAD / PLATING 三个，不可编辑（项目约定）。
   设备池取自客户真实数据 BGA WK2601-2652 -M 透视的 Mold 机台（BMD-/QMD-），用户可增删。
   次品项种子：代码 / 名称 / 工序(station) 取自客户真实 16 类别；部门映射与设备绑定为演示默认，用户可改。 */
(function (global) {
  'use strict';

  // 部门固定（与 OP 模块口径一致）
  const DEFECT_DEPARTMENTS = ['LEAD', 'NON-LEAD', 'PLATING'];

  // 设备池（机台）：取自客户真实 -M 透视的设备清单（均为 Mold 机台），用户可增删
  const DEFECT_EQUIP_SEED = ['BMD-02', 'BMD-07', 'BMD-09', 'BMD-14', 'BMD-17', 'BMD-19', 'BMD-21', 'BMD-22', 'QMD-12'];

  // 工序（Process）：默认仅 3 个，用户可按需扩展
  const DEFECT_PROCESS_SEED = ['MOLD', 'MARK', 'ICOS'];

  // 次品项主数据种子：代码/名称 与真实 16 类别一一对应；部门映射与设备绑定为演示默认值
  const DEFECT_ITEMS_SEED = [
    { code: 'MMS AL01', name: '少球', dept: 'LEAD', process: 'MARK', equip: [] },
    { code: 'MMS AL02', name: '共面性', dept: 'LEAD', process: 'MARK', equip: [] },
    { code: 'MMS AL03', name: '锡球变形(大/小球)', dept: 'LEAD', process: 'MARK', equip: [] },
    { code: 'MMS AL06', name: '印字缺陷', dept: 'LEAD', process: 'MARK', equip: [] },
    { code: 'MOLD BMD2', name: '外来物', dept: 'LEAD', process: 'MOLD', equip: DEFECT_EQUIP_SEED.slice() },
    { code: 'MOLD BMD3', name: '未充满', dept: 'LEAD', process: 'MOLD', equip: DEFECT_EQUIP_SEED.slice() },
    { code: 'SAW SS7', name: 'SAW污染(外来物/粉尘)', dept: 'LEAD', process: 'MOLD', equip: [] },
    { code: 'MMS AL05', name: '印字面外来物', dept: 'NON-LEAD', process: 'MARK', equip: [] },
    { code: 'MMS AL07', name: '印字/表面划伤', dept: 'NON-LEAD', process: 'MARK', equip: [] },
    { code: 'MMS AL08', name: '印字/污染', dept: 'NON-LEAD', process: 'MARK', equip: [] },
    { code: 'MMS AL09', name: '印字/其它(overkill)', dept: 'NON-LEAD', process: 'MARK', equip: [] },
    { code: 'MMS AL11', name: '外来物少球', dept: 'NON-LEAD', process: 'MARK', equip: [] },
    { code: 'MMS AL12', name: '球损伤', dept: 'NON-LEAD', process: 'MARK', equip: [] },
    { code: 'MOLD BMD9', name: '压痕/划痕', dept: 'NON-LEAD', process: 'MOLD', equip: DEFECT_EQUIP_SEED.slice() },
    { code: 'IQC&Supplier', name: 'substrate issue', dept: 'NON-LEAD', process: 'MOLD', equip: [] },
    { code: 'ICOS BMD12', name: '其它(ICOS overkill)', dept: 'PLATING', process: 'ICOS', equip: [] }
  ];

  function seed() {
    return {
      equipPool: DEFECT_EQUIP_SEED.slice(),
      processes: DEFECT_PROCESS_SEED.slice(),
      items: DEFECT_ITEMS_SEED.map(i => ({
        code: i.code, name: i.name, dept: i.dept, process: i.process,
        equip: (i.equip || []).slice()
      }))
    };
  }

  const DefectCfgStore = {
    KEY: 'defect_cfg_v2',
    raw() {
      try { return store.get(this.KEY, null); } catch (e) { return null; }
    },
    all() {
      const v = this.raw();
      if (v && v.items && Array.isArray(v.items)) {
        // 容错：补齐缺失字段
        const out = {
          equipPool: Array.isArray(v.equipPool) ? v.equipPool.slice() : DEFECT_EQUIP_SEED.slice(),
          processes: Array.isArray(v.processes) ? v.processes.slice() : DEFECT_PROCESS_SEED.slice(),
          items: v.items.map(i => ({
            code: String(i.code || '').trim(),
            name: String(i.name || i.code || '').trim(),
            dept: DEFECT_DEPARTMENTS.indexOf(i.dept) >= 0 ? i.dept : DEFECT_DEPARTMENTS[0],
            process: String(i.process || '').trim(),
            equip: Array.isArray(i.equip) ? i.equip.slice() : []
          })).filter(i => i.code)
        };
        return out;
      }
      return seed();
    },
    save(cfg) {
      store.set(this.KEY, {
        equipPool: (cfg.equipPool || []).slice(),
        processes: (cfg.processes || []).slice(),
        items: (cfg.items || []).map(i => ({
          code: i.code, name: i.name, dept: i.dept, process: i.process, equip: (i.equip || []).slice()
        }))
      });
    },
    reset() { store.set(this.KEY, seed()); }
  };

  global.DEFECT_DEPARTMENTS = DEFECT_DEPARTMENTS;
  global.DEFECT_EQUIP_SEED = DEFECT_EQUIP_SEED;
  global.DEFECT_PROCESS_SEED = DEFECT_PROCESS_SEED;
  global.DEFECT_ITEMS_SEED = DEFECT_ITEMS_SEED;
  global.DefectCfgStore = DefectCfgStore;
})(typeof window !== 'undefined' ? window : globalThis);
