# -*- coding: utf-8 -*-
"""从 BGA PPM trend.xlsx 的各周 -M 原始表抽取设备维度数据：
   设备=Mold机台, 料号=PkgCode, 产出=ICOS结料数量, 次品=各缺陷代码列计数
   生成 window.DEFECT_REAL.device = { [weekLabel]: { devs, cout, cnt, ccnt } } 并追加到 defect-real-data.js
   结构（幂等：重复运行会先移除旧的 device 块）：
     devs: 设备名数组（按产出降序）
     cout: { dev: { code: out } }
     cnt:  { catKey: { dev: count } }        # 稀疏，仅 count>0
     ccnt: { catKey: { dev: { code: count } } }  # 稀疏
"""
import openpyxl, json, re, sys, io
from collections import defaultdict

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

XLS = r"D:\其他项目\NXP\归档\王刘平\原始资料\BGA WK2601-2652 PPM Yield trend.xlsx"
JS = r"D:\其他项目\NXP\归档\王刘平\ops-handover-demo\assets\js\defect-real-data.js"

# -M 缺陷代码列 → DEFECT_REAL 类别 key（精确表头匹配）
CAT_MAP = {
    'AL01': 'MMS AL01', 'AL02': 'MMS AL02', 'AL03': 'MMS AL03', 'AL05': 'MMS AL05',
    'AL06': 'MMS AL06', 'AL07': 'MMS AL07', 'AL08': 'MMS AL08', 'AL09': 'MMS AL09',
    'AL11': 'MMS AL11', 'AL12': 'MMS AL12',
    'BMD12': 'ICOS BMD12', 'BMD2': 'MOLD BMD2', 'BMD3': 'MOLD BMD3', 'BMD9': 'MOLD BMD9',
    'SS7': 'SAW SS7',
}
SHEET_RE = re.compile(r"^WW\d+'\d+-M$")

wb = openpyxl.load_workbook(XLS, read_only=True, data_only=False)
device = {}
for ws in wb.worksheets:
    if not SHEET_RE.match(ws.title):
        continue
    week = ws.title.split("'")[0]
    it = ws.iter_rows(values_only=True)
    header = next(it)
    col = {}
    for j, v in enumerate(header):
        if v is None:
            continue
        s = str(v).strip()
        if s and s not in col:
            col[s] = j
    idev, iout, icod = col.get('Mold机台'), col.get('ICOS结料数量'), col.get('PkgCode')
    if idev is None or iout is None:
        print(f"[skip] {ws.title}: 缺 Mold机台/ICOS结料数量 列")
        continue
    catcols = [(col[c], cat) for c, cat in CAT_MAP.items() if c in col]
    cout = defaultdict(lambda: defaultdict(float))   # dev -> code -> out
    cnt = defaultdict(lambda: defaultdict(float))    # cat -> dev -> n
    ccnt = defaultdict(lambda: defaultdict(lambda: defaultdict(float)))  # cat -> dev -> code -> n
    nrows = 0
    for row in it:
        if idev >= len(row) or iout >= len(row):
            continue
        dev, out = row[idev], row[iout]
        if dev is None or not isinstance(out, (int, float)):
            continue  # 透视区/空行/汇总行（Mold机台 为空）
        dev = str(dev).strip()
        if not dev:
            continue
        code = ''
        if icod is not None and icod < len(row) and row[icod] is not None:
            code = str(row[icod]).strip()
        if not code:
            continue  # 与客户透视表口径一致：PkgCode 为空的批次不计入机台透视
        cout[dev][code] += out
        nrows += 1
        for j, cat in catcols:
            v = row[j] if j < len(row) else None
            if isinstance(v, (int, float)) and v:
                cnt[cat][dev] += v
                ccnt[cat][dev][code] += v
    if not nrows:
        print(f"[skip] {ws.title}: 无有效数据行")
        continue
    devs = sorted(cout.keys(), key=lambda d: -sum(cout[d].values()))
    node = {
        'devs': devs,
        'cout': {d: {k: int(v) if float(v).is_integer() else round(v, 1)
                     for k, v in sorted(cout[d].items(), key=lambda kv: -kv[1])} for d in devs},
        'cnt': {c: {d: int(n) if float(n).is_integer() else round(n, 1)
                    for d, n in sorted(cnt[c].items(), key=lambda kv: -kv[1])} for c in cnt},
        'ccnt': {c: {d: {k: int(v) if float(v).is_integer() else round(v, 1)
                         for k, v in sorted(ccnt[c][d].items(), key=lambda kv: -kv[1])} for d in ccnt[c]}
                 for c in ccnt},
    }
    device[week] = node
    ncats = len(node['cnt'])
    print(f"[ok] {ws.title} -> {week}: lots={nrows}, devs={len(devs)}, cats_with_defect={ncats}")
wb.close()

js_obj = json.dumps(device, ensure_ascii=False, separators=(',', ':'))
src = open(JS, encoding='utf-8').read()
marker = 'window.DEFECT_REAL.device = '
if marker in src:
    src = src[:src.index(marker)].rstrip().rstrip(';')
    print("[update] 移除旧 device 块")
src = src.rstrip() + ';\nwindow.DEFECT_REAL.device = ' + js_obj + ';\n'
open(JS, 'w', encoding='utf-8').write(src)
size = len(js_obj.encode('utf-8'))
print(f"[done] weeks={len(device)}, json={size/1024:.0f} KB, written -> {JS}")
