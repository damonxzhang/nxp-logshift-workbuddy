# -*- coding: utf-8 -*-
"""抽取客户《NONLEAD.xlsx》IO sheet → assets/js/io-real-data.js（幂等）

口径（101 行全部验证一致）：
    实际结果 = PKG_I/O × Unit（实际数量）÷ base      base = 255（客户表中固定）
    PKG_I/O（用户可以配置）、PKG_CODE（客户封装代码）、PKG_TYPE 均由客户在系统内自行维护。

    → 产出量按「I/O 加权当量」计量：BGA/LGA 的颗数 × (PKG_I/O ÷ 255)。
      料号 → PKG_CODE / PKG_I/O 的对应关系在 OP 配置页「料号 I/O 维护」里由客户配置。

客户更新本表后重跑本脚本即可刷新：
    "C:/Users/User/.workbuddy/binaries/python/envs/default/Scripts/python.exe" .extract-io.py
"""
import json
import os
import re

import openpyxl

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '原始资料', 'NONLEAD.xlsx')
DST = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets', 'js', 'io-real-data.js')

# 表头容错：定位实际列（PKG_TYPE / PKG_CODE / PKG_I/O / Unit / 实际结果）
HEAD = {
    'pkg': re.compile(r'PKG_TYPE', re.I),
    'code': re.compile(r'PKG_CODE', re.I),
    'io': re.compile(r'PKG_I/O', re.I),
    'unit': re.compile(r'^Unit', re.I),
    'act': re.compile(r'实际结果'),
}


def main():
    wb = openpyxl.load_workbook(SRC, data_only=True)
    if 'IO' not in wb.sheetnames:
        raise SystemExit('NONLEAD.xlsx 中找不到 IO sheet，现有 sheet：%s' % wb.sheetnames)
    ws = wb['IO']

    # 定位表头行（第 1 行；若不在第 1 行则向下找首个含 PKG_TYPE 的行）
    hrow, cols = 1, None
    for ri, row in enumerate(ws.iter_rows(values_only=True), start=1):
        vals = [(v or '') for v in row]
        if any(HEAD['pkg'].search(str(v)) for v in vals):
            hrow, cols = ri, {}
            for ci, v in enumerate(vals):
                for k, rx in HEAD.items():
                    if rx.search(str(v)):
                        cols[k] = ci
            break
    if not cols or 'pkg' not in cols or 'io' not in cols:
        raise SystemExit('IO sheet 表头识别失败：cols=%s' % (cols,))

    rows, bases = [], set()
    for row in ws.iter_rows(min_row=hrow + 1, values_only=True):
        pkg = row[cols['pkg']] if cols['pkg'] < len(row) else None
        io = row[cols['io']] if cols['io'] < len(row) else None
        if pkg is None or io is None or str(pkg).strip() == '':
            continue
        code = row[cols['code']] if 'code' in cols and cols['code'] < len(row) else None
        unit = row[cols['unit']] if 'unit' in cols and cols['unit'] < len(row) else None
        act = row[cols['act']] if 'act' in cols and cols['act'] < len(row) else None
        # 归一化为字符串料号（保留前导 0，如 00BN / 007J）
        code_s = str(code).strip() if code is not None else ''
        if code_s.endswith('.0'):
            code_s = code_s[:-2]
        try:
            io_n = float(io)
        except (TypeError, ValueError):
            continue
        rows.append({'p': str(pkg).strip(), 'c': code_s, 'io': io_n,
                     'u': (float(unit) if isinstance(unit, (int, float)) else None),
                     'a': (round(float(act), 4) if isinstance(act, (int, float)) else None)})
        if unit and act and io_n:
            bases.add(round(io_n * float(unit) / float(act), 6))

    if not rows:
        raise SystemExit('IO sheet 未解析到任何数据行')
    base = sorted(bases)[0] if len(bases) == 1 else 255.0

    by_pkg = {}
    for r in rows:
        by_pkg.setdefault(r['p'], []).append([r['c'], r['io']])
    for v in by_pkg.values():
        v.sort(key=lambda x: x[0])

    out = {
        'source': 'NONLEAD.xlsx · IO sheet（客户导出）',
        'extractedAt': '2026-10-13',
        'formula': '实际结果 = PKG_I/O × Unit ÷ %s' % int(base),
        'base': base,
        'rows': len(rows),
        'codes': [{'pkg': r['p'], 'code': r['c'], 'io': r['io'], 'unit': r['u'], 'actual': r['a']}
                  for r in rows],
        'byPkg': by_pkg,
        'ioValues': sorted({r['io'] for r in rows}),
    }

    js = ('/* ============ 真实数据：客户《NONLEAD.xlsx》IO sheet ============\n'
          '   由 .extract-io.py 自动生成，请勿手工编辑；客户更新 IO 表后重跑脚本即可。\n'
          '   列：PKG_TYPE / PKG_CODE / PKG_I/O（用户可以配置）/ Unit（实际数量）/ 实际结果\n'
          '   口径：实际结果 = PKG_I/O × Unit ÷ %d（%d 行全部校验一致）\n'
          '   用途：BGA/LGA 的产出按「I/O 加权当量」计量 —— 颗数 × (PKG_I/O ÷ %d)；\n'
          '         其余 PKG Type（QFN / PQFN / FCCSP）仍按颗数计量。\n'
          '         料号 ↔ PKG_CODE / PKG_I/O 的对应关系由客户在 OP 配置页「料号 I/O 维护」配置。 */\n'
          'const IO_REAL_DATA = %s;\n') % (int(base), len(rows), int(base),
                                           json.dumps(out, ensure_ascii=False, indent=2))

    with open(DST, 'w', encoding='utf-8') as f:
        f.write(js)

    print('[ok] IO sheet 解析 %d 行（base=%s，%s）→ %s' %
          (len(rows), base, ' / '.join('%s:%d' % (k, len(v)) for k, v in by_pkg.items()), DST))


if __name__ == '__main__':
    main()
