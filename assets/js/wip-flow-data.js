/* ==== WIP 工序流转路径（来源：客户《NONLEAD.xlsx》BGA / PQFN / QFN / FCCSP 四个 sheet）====
   · 每个 sheet 的内容按流程自上而下串联（"按照流程一步步下来"），一行 = 一个工序节点。
   · 末行 = 出货 / 去处节点：若一行含多个工序码，表示该步分流向多个去处 —— 在 WIP 看板中
     做成「二级联动」样式（一级 = 去处汇总节点，二级 = 各去处明细，点击展开/收起）。
   · 目的：为【WIP 在制品看板】提供「工序流转」视图，在真实在制量之上叠加工序流向；
     分流向节点即"一行多个数据"的位置。
   · 工序码与 wip-real-data.js 的 step 字段一一对应，可直接叠加真实在制量（K / 批）。
   注：WIP_FLOW_STEP 的中文为"示意名"（基于工序码推断），客户可校正。 */
window.WIP_FLOW_DATA = {
  BGA: {
    name: 'BGA',
    steps: ['PREM_PLS', 'PASSWND', 'BMOLD', 'NLD_PMC', 'BLMARK', 'NLD_HPC', 'BR', 'BE_SAW', 'BFOI_GATE', 'FVI_GATE'],
    to: ['BE_DT', 'BE_MT', 'BE-KESFT', 'BE-TTJBI', 'BE_DC']
  },
  PQFN: {
    name: 'PQFN',
    steps: ['PREM_PLS', 'PASSWND', 'PMOLD', 'DE_TAPING', 'NLD_PMC', 'NLD_SI', 'PMARK', 'DEFLASH', 'PINSP', 'FVI_GATE'],
    to: ['BE_MT']
  },
  QFN: {
    name: 'QFN',
    steps: ['PASSWND', 'QMOLD', 'DE_TAPING', 'NLD_PMC', 'NLD_SI', 'QMARK', 'BE_SAW', 'BFOI_GATE', 'FVI_GATE'],
    to: ['BE_DT', 'BE_MT', 'BE-KESFT', 'BE-TTJBI']
  },
  FCCSP: {
    name: 'FCCSP',
    steps: ['PREM_PLS', 'PASSWND', 'FMOLD', 'NLD_PMC', 'FCMARK', 'FPF_REFLOW', 'FPF_CLEAN', 'BR', 'FLUX_CLEAN', 'BE_SAW', 'BFOI_GATE', 'FVI_GATE'],
    to: ['BE_DT', 'BE_DC']
  }
};

/* 工序码 → 中文示意名（客户可校正） */
window.WIP_FLOW_STEP = {
  PREM_PLS: '来料预加工', PASSWND: '钝化开窗', BMOLD: 'BGA 塑封', NLD_PMC: '点胶固化', BLMARK: '镭雕打标',
  NLD_HPC: '背面点胶固化', BR: '背面研磨', BE_SAW: '划片', BFOI_GATE: '出货检验(FOI)', FVI_GATE: '终检门',
  BE_DT: '后端测试 DT', BE_MT: '后端标记测试', 'BE-KESFT': '后端软测试', 'BE-TTJBI': '后端 TTJBI', BE_DC: '后端出货入库',
  PMOLD: 'PQFN 塑封', DE_TAPING: '解胶脱膜', NLD_SI: '点胶 SI', PMARK: 'PQFN 打标', DEFLASH: '去溢料', PINSP: '外观检验',
  QMOLD: 'QFN 塑封', QMARK: 'QFN 打标', FMOLD: 'FCCSP 塑封', FCMARK: 'FCCSP 打标', FPF_REFLOW: '回流焊', FPF_CLEAN: '回流后清洗', FLUX_CLEAN: '助焊剂清洗'
};
