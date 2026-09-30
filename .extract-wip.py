# -*- coding: utf-8 -*-
"""从客户 IT 导出的《BE1 WIP Report-V26.xls》抽取在制品明细，
生成 assets/js/wip-real-data.js（纯静态可离线加载）。

用法：
  python .extract-wip.py <源xls路径> <输出js路径>

口径：
  - 跳过 Bank 以 Total 开头的小计行与空行（仅保留批次明细）；
  - Specname = 当前工序（站名）；LOCATION_ = 机台/位置；
  - IsOnHold 解析为 hold 天数（源格式 'YES  18.5 Days'）；
  - 数量单位为颗；金额折算在页面侧按 OP 单价配置完成。
客户 IT 更新报表后重跑本脚本即可刷新看板。
"""
import sys, datetime
import xlrd

COLS = ['Bank', 'PackageOutline', 'DEVICE', 'Nick_Name', 'Productname', 'PKG_SIZE',
        'PKG Type', 'LotNumber', 'Specname', 'Qty', 'Qty by I/O', 'LOCATION_',
        'BE_CT[days]', 'ASSY_CT[days]', 'OTD_Shutdown[days]', 'WIRE_TYPE',
        'IsOnHold', 'Hold_Reason', 'DC']


def cell(v):
    if v is None:
        return ''
    if isinstance(v, float):
        return v
    return str(v).strip()


def hold_days(v):
    """'YES     18.5 Days' -> 18.5；'NO' -> 0；空 -> 0"""
    s = str(v)
    if 'YES' not in s.upper():
        return 0
    for tok in s.replace(';', ' ').split():
        try:
            return float(tok)
        except ValueError:
            continue
    return 0.0


def jstr(s):
    """转成可安全内嵌 JS 的双引号字符串字面量（含换行/控制符）；None 输出 null。"""
    if s is None:
        return 'null'
    out = []
    for ch in str(s):
        if ch == '"':
            out.append('\\"')
        elif ch == '\\':
            out.append('\\\\')
        elif ch == '\n':
            out.append('\\n')
        elif ch == '\r':
            out.append('\\r')
        elif ch == '\t':
            out.append('\\t')
        elif ord(ch) < 0x20:
            out.append('\\x%02x' % ord(ch))
        else:
            out.append(ch)
    return '"' + ''.join(out) + '"'


def main(src, out):
    wb = xlrd.open_workbook(src)
    sh = wb.sheet_by_index(0)
    hdr = [str(sh.cell_value(0, c)).strip() for c in range(sh.ncols)]
    idx = {name: hdr.index(name) for name in COLS}
    rows = []
    for r in range(2, sh.nrows):
        bank = cell(sh.cell_value(r, idx['Bank']))
        if bank.lower().startswith('total'):
            continue
        pkg = cell(sh.cell_value(r, idx['PKG Type']))
        step = cell(sh.cell_value(r, idx['Specname']))
        lot = cell(sh.cell_value(r, idx['LotNumber']))
        if not pkg or not lot:      # 小计/汇总行
            continue
        qty = sh.cell_value(r, idx['Qty'])
        qty = float(qty) if isinstance(qty, (int, float)) else 0.0
        io = sh.cell_value(r, idx['Qty by I/O'])
        io = round(float(io), 1) if isinstance(io, (int, float)) else 0.0

        def num(name, nd=2):
            v = sh.cell_value(r, idx[name])
            return round(float(v), nd) if isinstance(v, (int, float)) else None

        rows.append([
            step,                                # 0 工序
            pkg,                                 # 1 PKG Type
            cell(sh.cell_value(r, idx['PKG_SIZE'])),          # 2 尺寸
            cell(sh.cell_value(r, idx['PackageOutline'])),    # 3 封装料号
            cell(sh.cell_value(r, idx['DEVICE'])),            # 4 器件
            cell(sh.cell_value(r, idx['Nick_Name'])),         # 5 产品族
            lot,                                 # 6 批次号
            round(qty),                          # 7 数量(颗)
            io,                                  # 8 Qty by I/O
            cell(sh.cell_value(r, idx['LOCATION_'])),         # 9 机台/位置
            num('BE_CT[days]'),                  # 10 BE CT(天)
            num('ASSY_CT[days]'),                # 11 ASSY CT(天)
            num('OTD_Shutdown[days]', 2),        # 12 OTD 余量(天，负=已逾期)
            hold_days(sh.cell_value(r, idx['IsOnHold'])),     # 13 Hold 天数
            cell(sh.cell_value(r, idx['Hold_Reason'])),       # 14 Hold 原因(源文件即乱码)
            bank,                                # 15 Bank
            cell(sh.cell_value(r, idx['WIRE_TYPE'])),         # 16 线材
            cell(sh.cell_value(r, idx['DC'])),                # 17 DC
        ])

    total = sum(r[7] for r in rows)
    hold_n = sum(1 for r in rows if r[13] > 0)
    otd_n = sum(1 for r in rows if r[12] is not None and r[12] < 0)
    meta = {
        'source': 'BE1 WIP Report-V26.xls',
        'note': '客户 IT 导出的在制品明细快照（重跑 .extract-wip.py 刷新）',
        'lots': len(rows),
        'totalQty': total,
        'holdLots': hold_n,
        'otdRisk': otd_n,
        'extractedAt': datetime.date.today().isoformat(),
    }
    js = (
        '/* ==== WIP 看板真实数据（由 .extract-wip.py 从客户报表自动生成，勿手改） ====\n'
        '   来源：《' + meta['source'] + '》· 明细 ' + str(meta['lots']) + ' 批 · 合计 '
        + format(round(total / 1000, 1), ',') + 'K · Hold ' + str(hold_n) + ' 批 · OTD 逾期 '
        + str(otd_n) + ' 批\n'
        '   行格式：[工序, PKG Type, 尺寸, 封装料号, 器件, 产品族, 批次号, 数量颗, QtyIO,\n'
        '           机台/位置, BE_CT天, ASSY_CT天, OTD余量天, Hold天, Hold原因, Bank, 线材, DC] */\n'
        'window.WIP_REAL_DATA = {\n'
        '  meta: ' + repr(meta).replace("'", '"') + ',\n'
        '  rows: [\n'
        + ''.join('    [' + ','.join(
            ((str(x) if isinstance(x, int) else '%.4g' % x) if isinstance(x, (int, float)) else jstr(x))
            for x in row) + '],\n' for row in rows)
        + '  ]\n};\n'
    )
    with open(out, 'w', encoding='utf-8') as f:
        f.write(js)
    print('OK lots=%d total=%.1fK hold=%d otd=%d -> %s (%.0f KB)' %
          (len(rows), total / 1000, hold_n, otd_n, out, len(js) / 1024))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
