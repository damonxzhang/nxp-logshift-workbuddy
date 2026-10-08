/* ============ 日志管理 · 生产日志（静态展示页） ============
   来源：客户截图标注版「生产日志」（2026-10-08）——
     · 保留：顶部「上一个交班班 / 回到当前班」、From：夜班 - A班 - 孙志彬 · Date、
       「生产日志」标题（绿色竖条）与 日志内容列表（ID / 日志内容描述 / 操作）。
     · 按标注移除（红 X）：「创建新内容」「添加默认交接」「白班交接 / 夜班交接」、
       「退出」按钮与 物料/设备/备注 分类快捷新建浮层 → 本页为只读静态展示。
   本页新增：LEAD / NON-LEAD 两部门切换（两个按钮来回切），各自维护独立的班次序列；
   点「上一个交班班」逐班回看，点「回到当前班」返回最新班次。数据为静态演示样例，可自由修改。 */
(function () {
  renderShell('logs');

  /* ---------------- 静态演示数据：部门 → 班次序列（0 = 当前班，越往后越早） ---------------- */
  const LOG_SEED = {
    'LEAD': [
      {
        shift: '夜班', cls: 'A班', owner: '孙志彬', date: '2026-09-24',
        logs: [
          '孙志彬：BSG-32 生产前BUYOFF',
          '吴萍：2批00A无能耗批次已完成ICOS，在物料架4-4',
          '孙志彬：7批00L5 FLT已完成ICOS，1批00CT FLT已完成SAW，物料架4-4',
          '孙志彬：1批5381 FLT已完成SAW，物料架4-3',
          '葛金胜：2批00A9工程批已完成MMS，物料架3-3'
        ]
      },
      {
        shift: '白班', cls: 'B班', owner: '周颖', date: '2026-09-23',
        logs: [
          '周颖：BSG-31 生产前BUYOFF，腔体清洁完成',
          '郑楠：3批00C2无能耗批次已完成ICOS，物料架4-1',
          '周颖：4批00L8 FLT已完成ICOS，2批00CT FLT已完成SAW，物料架4-2',
          '韩磊：1批5390 FLT已完成SAW，物料架4-3',
          '郑楠：PM-07 例行保养完成，无异常'
        ]
      },
      {
        shift: '夜班', cls: 'B班', owner: '韩磊', date: '2026-09-23',
        logs: [
          '韩磊：BSG-30 生产前BUYOFF',
          '吴萍：2批00A5无能耗批次已完成ICOS，物料架4-4',
          '韩磊：6批00L2 FLT已完成ICOS，物料架4-4',
          '葛金胜：2批00A9工程批已完成MMS，物料架3-3',
          '韩磊：SMT-03 回温柜温度巡检正常'
        ]
      }
    ],
    'NON-LEAD': [
      {
        shift: '夜班', cls: 'A班', owner: '刘洋', date: '2026-09-24',
        logs: [
          '刘洋：BSG-45 生产前BUYOFF',
          '王强：3批00B2无能耗批次已完成ICOS，物料架2-1',
          '刘洋：5批00D4 FLT已完成ICOS，1批00E8 FLT已完成SAW，物料架2-2',
          '张伟：2批7712 FLT已完成SAW，物料架2-3',
          '陈静：1批00F1工程批已完成MMS，物料架1-2'
        ]
      },
      {
        shift: '白班', cls: 'B班', owner: '陈静', date: '2026-09-23',
        logs: [
          '陈静：BSG-44 生产前BUYOFF，交班设备点检完成',
          '王强：2批00B7无能耗批次已完成ICOS，物料架2-1',
          '陈静：3批00D9 FLT已完成ICOS，物料架2-2',
          '张伟：1批7720 FLT已完成SAW，物料架2-3',
          '王强：固化炉 OV-02 停机保养，已挂警示牌'
        ]
      },
      {
        shift: '夜班', cls: 'B班', owner: '王强', date: '2026-09-23',
        logs: [
          '王强：BSG-43 生产前BUYOFF',
          '刘洋：4批00B4无能耗批次已完成ICOS，物料架2-1',
          '王强：2批00E2 FLT已完成SAW，物料架2-2',
          '陈静：1批00F3工程批已完成MMS，物料架1-2',
          '王强：物料架2-4 补料完成，库存核对无误'
        ]
      }
    ]
  };

  /* ---------------- 状态：部门（记忆选择）+ 班次游标 ---------------- */
  const DEPTS = ['LEAD', 'NON-LEAD'];
  let dept = DEPTS.indexOf(store.get('logs_dept', 'LEAD')) >= 0 ? store.get('logs_dept', 'LEAD') : 'LEAD';
  let idx = 0;                                   // 0 = 当前班，1/2 = 历史班次
  const saveDept = () => store.set('logs_dept', dept);

  function render() {
    const d = LOG_SEED[dept];
    const s = d[idx];

    document.getElementById('content').innerHTML = `
      <div class="card mt16 no-print">
        <div class="card-body">
          <div class="flex acenter gap12 flex-wrap">
            <div class="seg" id="segDept" style="min-width:230px" title="切换部门查看各自的生产日志（LEAD / NON-LEAD 数据相互独立）">
              ${DEPTS.map(x => `<button data-d="${esc(x)}" class="${x === dept ? 'active' : ''}">${esc(x)}</button>`).join('')}
            </div>
            <span class="chip">${icon('file', 14)} 生产日志 · 只读静态展示（按标注不含创建 / 交接入口）</span>
            <div class="flex acenter gap12 flex-wrap logs-meta">
              <span class="log-from">From：${esc(s.shift)} - ${esc(s.cls)} - ${esc(s.owner)}</span>
              <span class="log-from">Date：${esc(s.date)}</span>
            </div>
          </div>
          <div class="flex acenter gap8 mt12">
            <button class="btn btn-sm btn-green" id="btnPrev" ${idx >= d.length - 1 ? 'disabled' : ''}>${icon('arrowRight', 15)} 上一个交班班</button>
            <button class="btn btn-sm btn-green" id="btnCur" ${idx === 0 ? 'disabled' : ''}>${icon('refresh', 15)} 回到当前班</button>
            ${idx > 0 ? `<span class="chip chip-danger" title="「上一个交班班」逐班回看 · 点「回到当前班」返回">${icon('clock', 14)} 正在查看历史班次（${esc(d[idx].date)} ${esc(d[idx].shift)}）</span>` : ''}
          </div>
        </div>
      </div>

      <div class="card mt16">
        <div class="card-body">
          <div class="logs-title">生产日志</div>
          <table class="table logs-table mt12">
            <thead><tr>
              <th style="width:64px">ID</th>
              <th>日志内容描述</th>
              <th style="width:140px">操作</th>
            </tr></thead>
            <tbody>
              ${s.logs.map((t, i) => `
                <tr>
                  <td class="num">${i + 1}</td>
                  <td>${esc(t)}</td>
                  <td></td>
                </tr>`).join('')}
            </tbody>
          </table>
          <div class="sub-note mt12">共 ${s.logs.length} 条 · ${esc(dept)} 部门 · ${esc(s.shift)} ${esc(s.cls)}（${esc(s.date)}）· 数据为静态演示样例；「操作」列按客户截图保留表头、内容为空（只读）。</div>
        </div>
      </div>`;

    bind();
  }

  function bind() {
    const seg = document.getElementById('segDept');
    if (seg) seg.querySelectorAll('button').forEach(b => b.onclick = () => {
      if (b.dataset.d === dept) return;
      dept = b.dataset.d; saveDept();
      idx = 0;                                    // 切部门回到该部门的当前班
      render();
      toast('已切换到 ' + dept + ' 部门日志', 'primary');
    });
    const bp = document.getElementById('btnPrev');
    if (bp) bp.onclick = () => { if (idx < LOG_SEED[dept].length - 1) { idx++; render(); } };
    const bc = document.getElementById('btnCur');
    if (bc) bc.onclick = () => { if (idx !== 0) { idx = 0; render(); toast('已回到当前班', 'success'); } };
  }

  render();
})();
