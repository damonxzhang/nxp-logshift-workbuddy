# -*- coding: utf-8 -*-
"""把客户 IT 提供的《BE1 Output Report V5.xls》抽取为 OP 大屏可用的真实数据模块。

用法：
    python .extract-op.py "原始资料/BE1 Output Report V5.xls" assets/js/op-real-data.js

口径（与 assets/js/output-core.js 保持一致）：
    周起始 = 周六；第 1 周 = 该年第一个周六所在的那一周；列序 六→五。
    产出日 = MoveOutTime 的日期；数量 = Qty（颗）；单位换算 K = 颗 / 1000。
    PKG Type 映射：BGA + LGA 合并为 BGA/LGA（大屏口径），其余按原值。
"""
import sys, json, datetime
import xlrd

SRC = sys.argv[1] if len(sys.argv) > 1 else '原始资料/BE1 Output Report V5.xls'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'assets/js/op-real-data.js'

PKG_MAP = {'BGA': 'BGA/LGA', 'LGA': 'BGA/LGA'}


def first_saturday(year):
    d = datetime.date(year, 1, 1)
    return d + datetime.timedelta(days=(5 - d.weekday()) % 7)   # weekday: 周一=0 … 周六=5


def week_of(d):
    """返回 (year, weekNo, dayIdx)：周六起始周编号与在周内的第几天（0=周六）。"""
    y = d.year
    fs = first_saturday(y)
    if d < fs:
        y -= 1
        fs = first_saturday(y)
    return y, (d - fs).days // 7 + 1, (d - fs).days % 7


def serial_to_date(v):
    return datetime.datetime(1899, 12, 30) + datetime.timedelta(days=float(v))


def main():
    wb = xlrd.open_workbook(SRC)
    sh = wb.sheet_by_index(0)
    hdr = [sh.cell_value(0, c) for c in range(sh.ncols)]
    idx = {h: i for i, h in enumerate(hdr)}

    byweek = {}        # '2026-W39' -> { typeId: [7 天颗数] }
    meta = {}          # '2026-W39' -> { rows, lots, dates, types(原始) }
    days_seen = {}
    lots = set()
    raw_types = {}

    for r in range(1, sh.nrows):
        pkg = str(sh.cell_value(r, idx['PKG Type'])).strip()
        if not pkg:
            continue
        lot = str(sh.cell_value(r, idx['LotNumber'])).strip()
        q = float(sh.cell_value(r, idx['Qty']) or 0)
        mv = sh.cell_value(r, idx['MoveOutTime'])
        if not isinstance(mv, float) or mv <= 0:
            continue
        y, w, di = week_of(serial_to_date(mv).date())
        key = '%d-W%02d' % (y, w)
        tid = PKG_MAP.get(pkg, pkg)
        row = byweek.setdefault(key, {}).setdefault(tid, [None] * 7)
        row[di] = (row[di] or 0) + q
        m = meta.setdefault(key, {'rows': 0, 'lots': [], 'days': [], 'rawTypes': {}})
        m['rows'] += 1
        m['lots'].append(lot)
        d = serial_to_date(mv).date().isoformat()
        if d not in m['days']:
            m['days'].append(d)
        m['rawTypes'][pkg] = m['rawTypes'].get(pkg, 0) + q
        days_seen[d] = days_seen.get(d, 0) + 1
        lots.add(lot)
        raw_types[pkg] = raw_types.get(pkg, 0) + q

    for m in meta.values():
        m['lots'] = len(set(m['lots']))
    src_date = sorted(days_seen)
    body = {
        'source': 'BE1 Output Report V5.xls（客户 IT 导出）',
        'extractedAt': datetime.date.today().isoformat(),
        'rows': sh.nrows - 1,
        'lots': len(lots),
        'days': src_date,
        'rawTypes': raw_types,
        'weeks': byweek
    }

    js = []
    js.append('/* ============ 真实数据：客户 IT 提供的《BE1 Output Report V5.xls》 ============')
    js.append('   由 .extract-op.py 自动生成，请勿手工编辑；客户更新数据后重新运行脚本即可。')
    js.append('   口径：产出日 = MoveOutTime 的日期；数量 = Qty（颗）→ K = 颗 / 1000；')
    js.append('        周起始 = 周六，第 1 周 = 该年第一个周六所在的那一周（与大屏一致）；')
    js.append('        PKG Type：BGA + LGA 合并为 BGA/LGA，其余按原值。')
    js.append('   weeks[周键][PKG Type] = [六, 日, 一, 二, 三, 四, 五] 当日的「颗数」，null = 该日无数据。 */')
    js.append('const OP_REAL_DATA = ' + json.dumps(body, ensure_ascii=False, indent=2) + ';')
    js.append('')
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write('\n'.join(js))

    print('源文件     :', SRC, '| 明细行', sh.nrows - 1)
    print('产出日     :', ', '.join(src_date), '| 批次数', len(lots))
    print('原始 PKG   :', json.dumps(raw_types, ensure_ascii=False))
    for k in sorted(byweek):
        print('  周', k, json.dumps({t: [None if v is None else round(v, 0) for v in arr] for t, arr in byweek[k].items()}, ensure_ascii=False))
    print('输出       :', OUT)


if __name__ == '__main__':
    main()
