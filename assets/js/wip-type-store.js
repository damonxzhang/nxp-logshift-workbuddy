/* ============ WIP · 品类配置（核心数据层） ============
   维护 WIP 在制品看板热力矩阵「品类列头」的可配置主数据：
     key        品类代码（与 WIP 数据 pkgType 列一致，唯一标识）
     name       显示名（如 LGA 显示为 BGA/LGA）
     color      品类颜色（矩阵列头 / 筛选 chip / 排行堆叠条共用）
     priceKey   OP 单价口径（对应「OP 目标与权限配置」里的 PKG Type id，用于 Earn 折算）
     showInHeat 是否在热力矩阵显示该品类列头（LGA 默认不显示，其数量仍计入合计/排行/KPI）
     stations   排行联动站点清单 [ [站点显示名, [工序代码...]] ]；为空时沿用 BGA 清单
   配置写入 localStorage（WipTypeStore），wip.html 与 wip-config.html 共用同一份。 */
(function (global) {
  'use strict';

  // 默认品类配置（与历史硬编码口径完全一致，可作为「恢复默认」基准）
  const WIP_TYPES_SEED = [
    {
      key: 'BGA', name: 'BGA', color: '#1d4ed8', priceKey: 'BGA/LGA', showInHeat: true,
      stations: [
        ['PREM_PLS', ['PREM_PLS']],
        ['PASSWND', ['PSSWND']],
        ['BMOLD', ['BMOLD']],
        ['NLD_PMC', ['NLD_PMC']],
        ['BLMARK', ['BLMARK']],
        ['NLD_HPC', ['NLD_HPC']],
        ['BR', ['BR']],
        ['FLUX_CLEAN', ['FLUX_CLEAN']],
        ['BE_SAW', ['BE_SAW']],
        ['BFOI_GATE', ['BFOI_GATE']],
        ['FVI_GATE', ['FVI_GATE']],
        ['Ship', ['BE_DC']]
      ]
    },
    {
      key: 'LGA', name: 'BGA/LGA', color: '#0b8a5a', priceKey: 'BGA/LGA', showInHeat: false,
      stations: []
    },
    {
      key: 'FCCSP', name: 'FCCSP', color: '#a8620b', priceKey: 'FCCSP', showInHeat: true,
      stations: [
        ['PREM_PLS', ['PREM_PLS']],
        ['PASSWND', ['PSSWND']],
        ['FMOLD', ['FMOLD']],
        ['NLD_PMC', ['NLD_PMC']],
        ['FCMARK', ['FCMARK']],
        ['FPF_REFLOW', ['FPF_REFLOW']],
        ['FPF_CLEAN', ['FPF_CLEAN']],
        ['BR', ['BR']],
        ['FLUX_CLEAN', ['FLUX_CLEAN']],
        ['BE_SAW', ['BE_SAW']],
        ['BFOI_GATE', ['BFOI_GATE']],
        ['FVI_GATE', ['FVI_GATE']],
        ['Ship', ['BE_DC']]
      ]
    },
    {
      key: 'QFN', name: 'QFN', color: '#8b5cf6', priceKey: 'QFN', showInHeat: true,
      stations: [
        ['PASSWND', ['PSSWND']],
        ['QMOLD', ['QMOLD']],
        ['DE_TAPING', ['DE_TAPING']],
        ['NLD_PMC', ['NLD_PMC']],
        ['NLD_SI', ['NLD_SI']],
        ['QMARK', ['QMARK']],
        ['BE_SAW', ['BE_SAW']],
        ['BFOI_GATE', ['BFOI_GATE']],
        ['FVI_GATE', ['FVI_GATE']],
        ['Ship', ['BE_DC']]
      ]
    },
    {
      key: 'PQFN', name: 'PQFN', color: '#0b6a86', priceKey: 'PQFN', showInHeat: true,
      stations: [
        ['PREM_PLS', ['PREM_PLS']],
        ['PASSWND', ['PSSWND']],
        ['PMOLD', ['PMOLD']],
        ['DE_TAPING', ['DE_TAPING']],
        ['NLD_PMC', ['NLD_PMC']],
        ['NLD_SI', ['NLD_SI']],
        ['PMARK', ['PMARK']],
        ['DEFLASH', ['DEFLASH']],
        ['BE_PSAW', ['BE_PSAW']],
        ['PINSP', ['PINSP']],
        ['FVI_GATE', ['FVI_GATE']],
        ['Ship', ['BE_DC']]
      ]
    }
  ];

  function seed() {
    return WIP_TYPES_SEED.map(t => ({
      key: t.key, name: t.name, color: t.color, priceKey: t.priceKey,
      showInHeat: t.showInHeat !== false,
      stations: (t.stations || []).map(s => [s[0], (s[1] || []).slice()])
    }));
  }

  // 未配置品类的默认样式：WIP 数据新出现的品类自动以此展示（不入库，编辑保存后才落库）
  function defaultOf(key) {
    return { key: String(key || '').trim(), name: String(key || '').trim(), color: '#64748b', priceKey: String(key || '').trim(), showInHeat: true, stations: [] };
  }

  const WipTypeStore = {
    KEY: 'wip_type_cfg_v1',
    raw() {
      try { return store.get(this.KEY, null); } catch (e) { return null; }
    },
    all() {
      const v = this.raw();
      if (v && Array.isArray(v.types)) {
        return v.types.map(t => ({
          key: String(t.key || '').trim(),
          name: String(t.name || t.key || '').trim(),
          color: String(t.color || '#64748b').trim(),
          priceKey: String(t.priceKey || t.key || '').trim(),
          showInHeat: t.showInHeat !== false,
          stations: (Array.isArray(t.stations) ? t.stations : []).map(s => [
            String((s && s[0]) || '').trim(),
            ((s && Array.isArray(s[1])) ? s[1] : String((s && s[1]) || '').split(/[,，\s]+/)).map(c => String(c).trim()).filter(Boolean)
          ]).filter(s => s[0])
        })).filter(t => t.key);
      }
      return seed();
    },
    save(types) {
      store.set(this.KEY, {
        types: (types || []).map(t => ({
          key: t.key, name: t.name, color: t.color, priceKey: t.priceKey,
          showInHeat: t.showInHeat !== false,
          stations: (t.stations || []).map(s => [s[0], (s[1] || []).slice()])
        }))
      });
    },
    reset() { store.set(this.KEY, seed()); },
    of(key) { return this.all().find(t => t.key === key) || null; },
    defaultOf
  };

  global.WIP_TYPES_SEED = WIP_TYPES_SEED;
  global.WipTypeStore = WipTypeStore;
})(typeof window !== 'undefined' ? window : globalThis);
