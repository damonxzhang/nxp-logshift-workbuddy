/* ============ 故障图片/截图上传存证（4.1）与岗位交接 ============ */
(function () {
  renderShell('evidence');

  // 4.1 附件存证规范与上传留痕
  const LIMIT = {
    sizeMB: 5, files: 9, totalMB: 50,
    width: 1280, height: 720, types: 'JPG / PNG / WEBP'
  };

  let files = [];   // 本次会话上传的存证
  let dragOver = false;
  let docs = JSON.parse(JSON.stringify(HANDOVER_DOCS));

  const totalBytes = () => files.reduce((a, b) => a + b.size, 0);

  function fakeHash(f) {
    let h = 0;
    const s = f.name + f.size + f.time;
    for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) & 0xffffffff; }
    return (h >>> 0).toString(16).padStart(8, '0') + 'a9f3c1e7b2d40' + String(f.size % 9973).padStart(4, '0');
  }

  function accept(list) {
    let ok = 0, bad = 0;
    Array.from(list).forEach(f => {
      if (!/^image\//.test(f.type)) { bad++; toast(`「${f.name}」不是图片，已忽略`, 'danger'); return; }
      if (f.size > LIMIT.sizeMB * 1024 * 1024) { bad++; toast(`「${f.name}」超过 ${LIMIT.sizeMB}MB 单张限制`, 'danger'); return; }
      if (files.length >= LIMIT.files) { bad++; toast(`单次最多上传 ${LIMIT.files} 张`, 'danger'); return; }
      if (totalBytes() + f.size > LIMIT.totalMB * 1024 * 1024) { bad++; toast(`已超过单据 ${LIMIT.totalMB}MB 总容量上限`, 'danger'); return; }
      const url = URL.createObjectURL(f);
      const item = { name: f.name, size: f.size, url, time: fmtDT(new Date()), w: 0, h: 0, low: false, type: f.type };
      files.push(item);
      ok++;
      const img = new Image();
      img.onload = () => { item.w = img.naturalWidth; item.h = img.naturalHeight; item.low = item.w < 1280 || item.h < 720; render(); };
      img.src = url;
    });
    render();
    if (ok) toast(`已添加 ${ok} 张存证，自动生成哈希指纹并写入存证链`, 'success');
  }

  function render() {
    const usedMB = (totalBytes() / 1048576);
    document.getElementById('content').innerHTML = `
    <div class="notice" style="--nc:var(--primary)">
      ${icon('image', 19)}
      <div><strong>P1 专属大屏 · 生产交易日志看板：</strong>对应客户原始需求表第 1 项，在现有交接日志系统基础上升级——支持上传<strong>现场照片 / 报错截图</strong>存证、<strong>关键词检索</strong>、<strong>导出并发送邮件</strong>；本屏自带<strong>预警组件</strong>（阈值/周期/系数可配，触发后屏幕变红 + 强制弹窗 + 语音播报）与<strong>邮件组件</strong>，均为各屏复用能力。<br>
      系统自动提取分辨率、大小并生成哈希指纹，随单据一并归档留痕。<strong>FLT 批次、紧急批字段的取值规则待 09-29 与客户确认。</strong></div>
    </div>

    <div class="card mt16">
      <div class="card-head">
        <div class="card-title">${icon('layers', 19)} 本屏标配能力
          <span class="card-sub">每块专属大屏均自带，作为统一组件复用</span></div>
      </div>
      <div class="card-body flex gap16" style="flex-wrap:wrap">
        <a class="chip" href="alerts.html">${icon('bell', 16)} 预警组件 · 阈值 / 强制弹窗 / 语音</a>
        <a class="chip" href="mail.html">${icon('mail', 16)} 邮件组件 · 告警邮件与导出发送</a>
        <a class="chip" href="wall.html">${icon('layers', 16)} 加入监控室轮播</a>
        <span class="chip">${icon('clock', 16)} 数据刷新：手动 + 可配置周期</span>
      </div>
    </div>

    <div class="mt16">
      <!-- 上传区 -->
      <section class="card">
        <div class="card-head">
          <div class="card-title">${icon('upload', 19)} 现场存证上传
            <span class="card-sub">支持拖拽 · 自动提取分辨率与哈希指纹</span></div>
          <button class="btn btn-sm" id="btnDemoImg">${icon('plus', 15)} 生成两张示意截图</button>
        </div>
        <div class="card-body">
          <div class="dropzone ${dragOver ? 'over' : ''}" id="dz">
            <div class="dz-icon">${icon('upload', 26)}</div>
            <div class="dz-title">点击选择文件，或将截图拖拽到此处</div>
            <div class="dz-sub">支持 ${LIMIT.types} · 单张 ≤ ${LIMIT.sizeMB}MB · 单单据 ≤ ${LIMIT.files} 张 · 总量 ${LIMIT.totalMB}MB</div>
            <input type="file" id="fileInput" accept="image/*" multiple hidden>
          </div>

          <div class="grid g-3 mt16">
            <div class="kpi" style="--accent:#1d4ed8;--accent-soft:#e7eeff">
              <div class="kpi-name">本单据已上传</div>
              <div class="kpi-value">${files.length}<span class="kpi-unit">张</span></div>
              <div class="kpi-foot">上限 ${LIMIT.files} 张</div>
            </div>
            <div class="kpi" style="--accent:#0b6a86;--accent-soft:#e2f3f9">
              <div class="kpi-name">已占用容量</div>
              <div class="kpi-value">${usedMB.toFixed(2)}<span class="kpi-unit">MB</span></div>
              <div class="kpi-foot">单据上限 ${LIMIT.totalMB} MB</div>
            </div>
            <div class="kpi" style="--accent:#a8620b;--accent-soft:#fdf1e0">
              <div class="kpi-name">分辨率不足告警</div>
              <div class="kpi-value">${files.filter(f => f.low).length}<span class="kpi-unit">张</span></div>
              <div class="kpi-foot">要求 ≥ ${LIMIT.width} × ${LIMIT.height}</div>
            </div>
          </div>

          <div class="thumbs">
            ${files.length ? files.map((f, i) => `
              <div class="thumb">
                <div class="thumb-img"><img src="${f.url}" alt="存证图片"></div>
                <div class="thumb-meta">
                  <div class="thumb-name" title="${esc(f.name)}">${esc(f.name)}</div>
                  <div>${fileSize(f.size)} · ${f.w || '?'}×${f.h || '?'}</div>
                  <div class="flex wrap gap8 mt8">
                    <span class="badge ${f.low ? 'b-warn' : 'b-success'}">${f.low ? '低于建议清晰度' : '清晰度合格'}</span>
                  </div>
                  <div class="small muted" style="margin-top:6px;word-break:break-all">SHA-256：${fakeHash(f).slice(0, 16)}…</div>
                </div>
                <div class="thumb-bar">
                  <span class="small muted">${f.time.slice(11)}</span>
                  <button class="btn btn-sm btn-ghost" data-rm="${i}">${icon('trash', 15)} 移除</button>
                </div>
              </div>`).join('') : `
              <div class="muted small" style="grid-column:1/-1;padding:10px 2px">
                ${icon('alert', 15)} 暂无存证。现场上报时建议至少上传 2 张：① 设备/屏体报错全景；② 软件报错详情（含时间戳）。
              </div>`}
          </div>

          <div class="flex gap8 mt16">
            <button class="btn btn-primary" id="btnSubmit" ${files.length ? '' : 'disabled'}>${icon('check', 17)} 提交存证并关联单据</button>
            <span class="small muted">演示数据仅保存在浏览器内存，不会真正上传到任何服务器。</span>
          </div>
        </div>
      </section>

    </div>

    <!-- 岗位交接 -->
    <section class="card mt24">
      <div class="card-head">
        <div class="card-title">${icon('users', 19)} 白晚班交接单据与责任书认领
          <span class="card-sub">认领后即形成书面责任转移，并记录操作人与时间戳</span></div>
        <button class="btn btn-primary btn-sm" id="btnNewHandover">${icon('plus', 15)} 新建交接单</button>
      </div>
      <div class="card-body" style="padding:0">
        <div style="overflow-x:auto">
        <table class="table">
          <thead><tr>
            <th>单据编号</th><th>交接区间</th><th>交接时间</th><th class="center">附件</th>
            <th class="center">未闭环</th><th class="center">特急</th><th>交接说明</th><th>真空期</th><th class="center">责任书</th>
          </tr></thead>
          <tbody>
            ${docs.map((d, i) => `
              <tr>
                <td class="tname">${d.id}</td>
                <td class="small">${d.from} <span class="muted">→</span> ${d.to}</td>
                <td class="small num">${d.time}</td>
                <td class="center">${d.attachments} 张</td>
                <td class="center">${d.pending ? `<span class="badge b-warn">${d.pending}</span>` : '<span class="muted">0</span>'}</td>
                <td class="center">${d.critical ? `<span class="badge b-danger">${d.critical}</span>` : '<span class="muted">0</span>'}</td>
                <td class="small">${d.note}</td>
                <td><span class="badge ${d.gap === '无真空期' ? 'b-success' : 'b-warn'}">${d.gap}</span></td>
                <td class="center">${d.sign
                  ? `<span class="badge b-success">已双签</span>`
                  : `<button class="btn btn-sm btn-primary" data-sign="${i}">认领并签章</button>`}</td>
              </tr>`).join('')}
          </tbody>
        </table>
        </div>
      </div>
      <div class="card-foot">${icon('alert', 15)} 存在未闭环事项或未签章的交接单，系统将在换班前 10 分钟触发「交接真空期」研判并推送语音告警。</div>
    </section>`;

    bind();
  }

  function bind() {
    const $ = id => document.getElementById(id);
    const dz = $('dz'), fi = $('fileInput');

    dz.addEventListener('click', () => fi.click());
    fi.addEventListener('change', e => { accept(e.target.files); fi.value = ''; });
    ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dragOver = true; dz.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dragOver = false; dz.classList.remove('over'); }));
    dz.addEventListener('drop', e => { if (e.dataTransfer && e.dataTransfer.files) accept(e.dataTransfer.files); });

    document.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => {
      const i = Number(b.dataset.rm);
      URL.revokeObjectURL(files[i].url);
      files.splice(i, 1);
      toast('已移除该存证', 'success');
      render();
    }));

    $('btnSubmit') && $('btnSubmit').addEventListener('click', () => {
      toast(`已提交 ${files.length} 张存证，关联至交接单 HO-20260923-02`, 'success');
    });

    $('btnDemoImg') && $('btnDemoImg').addEventListener('click', () => {
      // 用 SVG 生成两张示意截图（离线可用，无需网络）
      const make = (title, body, color) => {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720">
          <rect width="1280" height="720" fill="#f4f6fa"/>
          <rect x="0" y="0" width="1280" height="64" fill="#1d2836"/>
          <text x="28" y="42" font-family="Microsoft YaHei" font-size="26" fill="#ffffff">${title}</text>
          <rect x="40" y="120" width="1200" height="200" rx="14" fill="#ffffff" stroke="#e1e7f0"/>
          <text x="72" y="180" font-family="Microsoft YaHei" font-size="30" fill="#cc2f2a">${body}</text>
          <text x="72" y="240" font-family="Consolas" font-size="22" fill="#566375">CONN_TIMEOUT after 3000ms | retry=3 | node=node-03</text>
          <rect x="40" y="360" width="1200" height="300" rx="14" fill="#ffffff" stroke="#e1e7f0"/>
          <circle cx="110" cy="500" r="34" fill="${color}" opacity="0.15"/><circle cx="110" cy="500" r="12" fill="${color}"/>
          <text x="170" y="492" font-family="Microsoft YaHei" font-size="24" fill="#1d2836">${body}</text>
          <text x="170" y="536" font-family="Microsoft YaHei" font-size="20" fill="#8a95a5">抓图时间 ${fmtDT(new Date())} · 张卫东</text>
        </svg>`;
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      };
      const t = Date.now();
      [
        { name: '机柜-03-PDU报错现场.jpg', size: 2411724, w: 1280, h: 720 },
        { name: 'VMS控制台报错截图.png', size: 1380452, w: 1280, h: 720 }
      ].forEach((s, i) => {
        if (files.length >= LIMIT.files) return;
        files.push({
          name: s.name, size: s.size, w: s.w, h: s.h, low: false, time: fmtDT(new Date(t + i * 1000)),
          url: make(i === 0 ? 'VMS 存储节点监控' : 'VMS 管理控制台', i === 0 ? '存储节点 node-03 心跳中断' : '录像写入失败：设备离线', '#cc2f2a')
        });
      });
      render();
      toast('已生成 2 张示意截图（离线 SVG，可直接替换真实素材）', 'success');
    });

    document.querySelectorAll('[data-sign]').forEach(b => b.addEventListener('click', () => {
      const i = Number(b.dataset.sign);
      docs[i].sign = true;
      toast(`交接单 ${docs[i].id} 已完成认领签章，责任转移至 ${docs[i].to}`, 'success');
      render();
    }));

    const bn = document.getElementById('btnNewHandover');
    bn && bn.addEventListener('click', () => toast('已创建交接单 HO-20260923-02，等待晚班班长签章确认', 'success'));
  }

  render();
})();
