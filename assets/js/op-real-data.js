/* ============ 真实数据：客户 IT 提供的《BE1 Output Report V5.xls》 ============
   由 .extract-op.py 自动生成，请勿手工编辑；客户更新数据后重新运行脚本即可。
   口径：产出日 = MoveOutTime 的日期；数量 = Qty（颗）→ K = 颗 / 1000；
        周起始 = 周六，第 1 周 = 该年第一个周六所在的那一周（与大屏一致）；
        PKG Type：BGA + LGA 合并为 BGA/LGA，其余按原值。
   weeks[周键][PKG Type] = [六, 日, 一, 二, 三, 四, 五] 当日的「颗数」，null = 该日无数据。 */
const OP_REAL_DATA = {
  "source": "BE1 Output Report V5.xls（客户 IT 导出）",
  "extractedAt": "2026-09-30",
  "rows": 227,
  "lots": 227,
  "days": [
    "2026-09-26"
  ],
  "rawTypes": {
    "QFN": 298543.0,
    "BGA": 473602.0,
    "PQFN": 28604.0,
    "LGA": 7097.0,
    "FCCSP": 48402.0
  },
  "weeks": {
    "2026-W39": {
      "QFN": [
        298543.0,
        null,
        null,
        null,
        null,
        null,
        null
      ],
      "BGA/LGA": [
        480699.0,
        null,
        null,
        null,
        null,
        null,
        null
      ],
      "PQFN": [
        28604.0,
        null,
        null,
        null,
        null,
        null,
        null
      ],
      "FCCSP": [
        48402.0,
        null,
        null,
        null,
        null,
        null,
        null
      ]
    }
  }
};
