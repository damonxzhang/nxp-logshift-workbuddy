/* ============ 次品管理 · 次品项主数据配置（核心数据层） ============
   用户在「次品项配置」页按 部门 / 工序 维护次品项（名称 + 代码）及其与设备（机台）的绑定关系。
   本文件负责：部门常量、设备池 / 工序 / 次品项种子数据、localStorage 读写（DefectCfgStore）。
   部门口径：2026-10-16 客户确认统一为 NON-LEAD（DEFECT_DEPARTMENTS 常量保留供编辑弹窗使用）。
   设备池取自客户真实数据 BGA WK2601-2652 -M 透视的 Mold 机台（BMD-/QMD-），用户可增删。
   次品项种子：代码 / 名称 / 工序(station) 取自客户真实 16 类别；部门映射与设备绑定为演示默认，用户可改。 */
(function (global) {
  'use strict';

  // 部门固定（与 OP 模块口径一致）
  const DEFECT_DEPARTMENTS = ['LEAD', 'NON-LEAD', 'PLATING'];

  // 设备池（机台）：取自客户真实 -M 透视的设备清单（均为 Mold 机台），用户可增删
  const DEFECT_EQUIP_SEED = ['BMD-02', 'BMD-07', 'BMD-09', 'BMD-14', 'BMD-17', 'BMD-19', 'BMD-21', 'BMD-22', 'QMD-12'];

  // 工序（Process）：默认 6 个（按 2026-10-16 客户主数据口径），用户可按需扩展
  const DEFECT_PROCESS_SEED = ['MOLD', 'Marking', 'BallAttach', 'SAW', 'ICOS', 'FE'];

  // 次品项主数据种子：2026-10-16 客户提供全量清单（工序 / 次品代码 / 中文名称），老数据已废弃。
  // 部门口径客户未提供，默认 LEAD（可在编辑弹窗调整）；设备绑定均为空，用户可按需绑定。
  const DEFECT_ITEMS_SEED = [];
  (function () {
    const add = (process, rows) => rows.forEach(([code, name]) => DEFECT_ITEMS_SEED.push({ code, name, dept: 'NON-LEAD', process, equip: [] }));
    add('MOLD', [
      ['BMD1', '崩角,裂缝'], ['BMD2', '外来物'], ['BMD3', '未充满'], ['BMD4', '翘曲超标'], ['BMD5', '空洞'],
      ['BMD6', '金线暴露'], ['BMD7', '金线冲弯/冲断'], ['BMD8', '分层'], ['BMD9', '压痕/划痕'], ['BMD10', '溢胶'],
      ['BMD11', 'MARK数错误'], ['BMD12', '其它'], ['BMD13', 'substrate/L/F issue'], ['BMD14', 'Die 印'], ['BMD15', 'mold follow']
    ]);
    add('Marking', [
      ['LLA01', '印字缺陷'], ['LLA02', '划痕'], ['LLA03', 'MARK数错误'], ['LLA04', '其他'],
      ['QLA01', '印字不清'], ['QLA02', '印字错误'], ['QLA03', '印字位置不正'], ['QLA04', '划痕'], ['QLA05', 'MARK数划错'],
      ['QLA06', '其他'], ['QLA07', '分层'], ['QLA08', '印字外来物'], ['QLA09', '印字缺陷'], ['QLA10', '印字污染'],
      ['QLA11', '印字面崩角'], ['QLA12', '印字面白边']
    ]);
    add('BallAttach', [
      ['AL01', '少球'], ['AL02', '共面性'], ['AL03', '锡球变形/大球/小球'], ['AL04', '料破损'], ['AL05', '印字/外来物'],
      ['AL06', '印字缺陷'], ['AL07', '印字/表面划伤'], ['AL08', '印字/污染'], ['AL09', '其它'], ['AL10', '分层'],
      ['AL11', '外来物少球'], ['AL12', '球损伤/球变形']
    ]);
    add('SAW', [
      ['SS1', '切偏/外观尺寸'], ['SS2', '边缘崩角'], ['SS3', '球损伤/球变形'], ['SS4', '微隙'], ['SS5', '料破损'],
      ['SS6', '少料'], ['SS7', '污染'], ['SS8', '划痕'], ['SS9', '其它'], ['SSA', '外形尺寸'], ['SSB', '切偏'],
      ['SSC', '分层'], ['SSD', 'SAW连筋'], ['SSE', 'SAW白边'], ['SSF', 'SAW切割面色差'], ['SSG', 'long-short lead']
    ]);
    add('ICOS', [
      ['BRV1', '料破损'], ['BRV2', '少料'], ['BRV3', '球损'], ['BRV4', '其它'], ['BRV5', 'Solderability'],
      ['BRV6', '收集数据'], ['BRV7', 'Dimple其他']
    ]);
    add('FE', [
      ['WER', '碎屑'], ['WBOT', 'AL 碎屑'], ['SDBOT', '框架变形'], ['QDBS', '银浆碎屑'], ['DBOT', '框架变形'],
      ['QWBAA', '黑点'], ['BDBC', '无Die']
    ]);
  })();

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
    KEY: 'defect_cfg_v3',
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
            dept: 'NON-LEAD', // 2026-10-16 客户口径：部门统一为 NON-LEAD（旧配置中的其他值也一并归一）
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
