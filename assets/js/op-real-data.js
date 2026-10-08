/* ============ 真实数据：客户 IT 提供的《BE1 Output Report V5.xls》 ============
   由 .extract-op.py 自动生成，请勿手工编辑；客户更新数据后重新运行脚本即可。
   口径：产出日 = MoveOutTime 的日期；数量 = Qty（颗）→ K = 颗 / 1000；
        周起始 = 周六，第 1 周 = 该年第一个周六所在的那一周（与大屏一致）；
        PKG Type：BGA + LGA 合并为 BGA/LGA，其余按原值。
   weeks[周键][PKG Type] = [六, 日, 一, 二, 三, 四, 五] 当日的「颗数」，null = 该日无数据。
   subs[周键][PKG Type][封装料号] = 同上形状的料号级颗数（用于「单价细分到料号」的 Earn 折算）；
   subMix[PKG Type][封装料号] = 全表颗数合计，供「无真实数据的演示周」按料号结构占比拆分。 */
const OP_REAL_DATA = {
  "source": "BE1 Output Report V5.xls（客户 IT 导出）",
  "extractedAt": "2026-10-08",
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
  },
  "subs": {
    "2026-W39": {
      "QFN": {
        "98ASA00602D": [
          230061.0,
          null,
          null,
          null,
          null,
          null,
          null
        ],
        "98ASA00474D": [
          33429.0,
          null,
          null,
          null,
          null,
          null,
          null
        ],
        "98ASA00466D": [
          16225.0,
          null,
          null,
          null,
          null,
          null,
          null
        ],
        "98ASA01504D": [
          8293.0,
          null,
          null,
          null,
          null,
          null,
          null
        ],
        "98ASA01997D": [
          10535.0,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      "BGA/LGA": {
        "98ASA00101D": [
          46455.0,
          null,
          null,
          null,
          null,
          null,
          null
        ],
        "98ARH98219A": [
          9822.0,
          null,
          null,
          null,
          null,
          null,
          null
        ],
        "98ASA99207D": [
          4652.0,
          null,
          null,
          null,
          null,
          null,
          null
        ],
        "98ASA01088D": [
          44747.0,
          null,
          null,
          null,
          null,
          null,
          null
        ],
        "98ASA00783D": [
          8672.0,
          null,
          null,
          null,
          null,
          null,
          null
        ],
        "98ASA00694D": [
          7097.0,
          null,
          null,
          null,
          null,
          null,
          null
        ],
        "98ASA01888D": [
          99945.0,
          null,
          null,
          null,
          null,
          null,
          null
        ],
        "98ASA00802D": [
          24102.0,
          null,
          null,
          null,
          null,
          null,
          null
        ],
        "98ASA00346D": [
          37204.0,
          null,
          null,
          null,
          null,
          null,
          null
        ],
        "98ASA00468D": [
          45585.0,
          null,
          null,
          null,
          null,
          null,
          null
        ],
        "98ASA00081D": [
          17562.0,
          null,
          null,
          null,
          null,
          null,
          null
        ],
        "98ASA00404D": [
          2740.0,
          null,
          null,
          null,
          null,
          null,
          null
        ],
        "98ASA01918D": [
          1374.0,
          null,
          null,
          null,
          null,
          null,
          null
        ],
        "98ASA00855D": [
          128986.0,
          null,
          null,
          null,
          null,
          null,
          null
        ],
        "98ASA01483D": [
          1756.0,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      "PQFN": {
        "98ARL10579D": [
          4256.0,
          null,
          null,
          null,
          null,
          null,
          null
        ],
        "98ASA00815D": [
          24348.0,
          null,
          null,
          null,
          null,
          null,
          null
        ]
      },
      "FCCSP": {
        "98ASA01200D": [
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
  },
  "subMix": {
    "QFN": {
      "98ASA00602D": 230061.0,
      "98ASA00474D": 33429.0,
      "98ASA00466D": 16225.0,
      "98ASA01504D": 8293.0,
      "98ASA01997D": 10535.0
    },
    "BGA/LGA": {
      "98ASA00101D": 46455.0,
      "98ARH98219A": 9822.0,
      "98ASA99207D": 4652.0,
      "98ASA01088D": 44747.0,
      "98ASA00783D": 8672.0,
      "98ASA00694D": 7097.0,
      "98ASA01888D": 99945.0,
      "98ASA00802D": 24102.0,
      "98ASA00346D": 37204.0,
      "98ASA00468D": 45585.0,
      "98ASA00081D": 17562.0,
      "98ASA00404D": 2740.0,
      "98ASA01918D": 1374.0,
      "98ASA00855D": 128986.0,
      "98ASA01483D": 1756.0
    },
    "PQFN": {
      "98ARL10579D": 4256.0,
      "98ASA00815D": 24348.0
    },
    "FCCSP": {
      "98ASA01200D": 48402.0
    }
  }
};
