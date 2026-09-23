/* ================= 演示样例数据（全部为虚构数据，可自由修改） ================= */

const SUBSYSTEMS = [
  { id: 'ERP', name: '生产制造 ERP', cat: '核心', db: 'Oracle', ver: '19c', iso: true, replica: true, api: 'RESTful + gRPC', mode: 'A', status: 'normal', health: 98, owner: '赵启明 · 制造处' },
  { id: 'PAY', name: '支付网关 Pay-Gateway', cat: '核心', db: 'MySQL', ver: '8.0.34', iso: true, replica: true, api: 'RESTful', mode: 'A', status: 'warn', health: 82, owner: '孙立群 · 财务处' },
  { id: 'SET', name: '数据结算 Settlement', cat: '核心', db: 'PostgreSQL', ver: '14.9', iso: true, replica: true, api: 'RESTful', mode: 'A', status: 'warn', health: 76, owner: '周雅琴 · 结算中心' },
  { id: 'NET', name: '核心网络 Core-Network', cat: '核心', db: 'Prometheus TSDB', ver: '2.48', iso: true, replica: false, api: 'Exporter + Alertmanager', mode: 'A', status: 'normal', health: 96, owner: '李国栋 · 网络组' },
  { id: 'BAS', name: '安全审计堡垒机', cat: '核心', db: 'MySQL', ver: '5.7.42', iso: true, replica: false, api: 'Syslog + REST', mode: 'A', status: 'normal', health: 94, owner: '吴海涛 · 安全合规部' },
  { id: 'IAM', name: '统一身份认证 IAM', cat: '核心', db: 'Redis + MySQL', ver: '7.2 / 8.0', iso: true, replica: true, api: 'RESTful', mode: 'A', status: 'normal', health: 99, owner: '郑文斌 · 平台架构组' },
  { id: 'TMS', name: '物流调度 TMS', cat: '外围', db: 'SQL Server', ver: '2019 CU22', iso: true, replica: true, api: '未开放（需直连）', mode: 'B', status: 'warn', health: 71, owner: '马建军 · 物流部' },
  { id: 'ITS', name: '客户工单 ITSM', cat: '外围', db: 'PostgreSQL', ver: '13.11', iso: false, replica: true, api: 'RESTful', mode: 'A', status: 'normal', health: 93, owner: '何秀兰 · 客服中心' },
  { id: 'VMS', name: '视频监控 VMS', cat: '外围', db: 'MongoDB', ver: '6.0.9', iso: true, replica: false, api: 'gRPC', mode: 'A', status: 'critical', health: 48, owner: '钱志强 · 安保部' },
  { id: 'SCM', name: '供应链采购 SCM', cat: '外围', db: 'MySQL', ver: '8.0.32', iso: true, replica: true, api: 'RESTful', mode: 'A', status: 'normal', health: 91, owner: '冯丽娟 · 采购部' },
  { id: 'BI', name: '经营报表 BI', cat: '外围', db: 'ClickHouse', ver: '23.8', iso: true, replica: true, api: 'RESTful', mode: 'A', status: 'normal', health: 95, owner: '许文广 · 数据中台' },
  { id: 'WMS', name: '仓储管理 WMS', cat: '外围', db: '自研 NewSQL', ver: 'v3.2', iso: true, replica: false, api: '仅内网 SQL', mode: 'B', status: 'offline', health: 0, owner: '田守义 · 仓储部' }
];

const ALERT_FEED = [
  { time: '14:52', level: 'critical', sys: '视频监控 VMS', title: '存储节点 node-03 掉线，录像丢失风险', handler: '已派单 → 安保部 钱志强' },
  { time: '14:20', level: 'warn', sys: '物流调度 TMS', title: '只读副本同步延迟 182s，超过阈值 120s', handler: '待处理' },
  { time: '13:05', level: 'warn', sys: '支付网关 Pay-Gateway', title: '渠道「通联」成功率降至 96.4%（阈值 99%）', handler: '处理中 → 财务处' },
  { time: '11:38', level: 'critical', sys: '仓储管理 WMS', title: '自研库主节点心跳中断超 15 分钟', handler: '升级中 → 平台架构组' },
  { time: '10:12', level: 'warn', sys: '数据结算 Settlement', title: '对账批次 B20260923-07 积压未回执', handler: '已挂起（待制造商版本号）' },
  { time: '08:03', level: 'normal', sys: '统一身份认证 IAM', title: '白班登录后令牌签发恢复正常', handler: '已闭环' }
];

const TASKS_PRESET = [
  { name: '子系统状态拉取', cron: '*/5 * * * *', mode: '系统内置', last: '14:55:00', dur: '1.8s', enabled: true, desc: '调用各子系统 /health 网关接口' },
  { name: '异常日志增量同步', cron: '*/1 * * * *', mode: '系统内置', last: '14:59:12', dur: '0.6s', enabled: true, desc: '从 ELK / Prometheus 拉取增量事件' },
  { name: '健康度得分换算', cron: '*/15 * * * *', mode: '可配置', last: '14:45:00', dur: '3.2s', enabled: true, desc: '按权重计算子系统综合得分' },
  { name: '交接真空期研判', cron: '50 7,19 * * *', mode: '可配置', last: '07:50:00', dur: '2.1s', enabled: true, desc: '换班前 10 分钟扫描未闭环事项' },
  { name: '运营日报生成与投递', cron: '0 8,20 * * *', mode: '可配置', last: '08:00:00', dur: '6.4s', enabled: true, desc: '生成 HTML 日报并推送管理层' },
  { name: '历史附件冷归档', cron: '0 2 * * *', mode: '可配置', last: '02:00:00', dur: '41.7s', enabled: false, desc: '归档 90 天前存证至对象存储低频层' }
];

const HANDOVER_DOCS = [
  { id: 'HO-20260923-01', from: '晚班 · 王海涛', to: '白班 · 张卫东', time: '2026-09-23 08:00', attachments: 3, pending: 2, critical: 1, sign: true, gap: '无真空期', note: 'WMS 主库切换演练窗口 22:00-23:00，需留人值守。' },
  { id: 'HO-20260922-02', from: '白班 · 李国栋', to: '晚班 · 王海涛', time: '2026-09-22 20:00', attachments: 1, pending: 0, critical: 0, sign: true, gap: '无真空期', note: '网络设备固件升级完成，观察 24 小时。' },
  { id: 'HO-20260922-01', from: '晚班 · 陈慧敏', to: '白班 · 李国栋', time: '2026-09-22 08:00', attachments: 2, pending: 3, critical: 1, sign: false, gap: '真空期 12 分钟', note: '交接时 VMS 存储告警未闭环，已标记顺延。' }
];

const NOTIFY_RULES = [
  { sys: '支付网关 Pay-Gateway', dept: '财务处', to: '孙立群', mail: 'sun.lq@corp.example.com', level: 'Critical + 日报', voice: true, enabled: true },
  { sys: '数据结算 Settlement', dept: '结算中心', to: '周雅琴', mail: 'zhou.yq@corp.example.com', level: 'Critical + 日报', voice: false, enabled: true },
  { sys: '核心网络 Core-Network', dept: '网络组', to: '李国栋', mail: 'li.gd@corp.example.com', level: 'Critical + 日报', voice: true, enabled: true },
  { sys: '安全审计堡垒机', dept: '安全合规部', to: '吴海涛', mail: 'wu.ht@corp.example.com', level: '全部（含普通告警）', voice: false, enabled: true },
  { sys: '视频监控 VMS', dept: '安保部', to: '钱志强', mail: 'qian.zq@corp.example.com', level: 'Critical + 日报', voice: true, enabled: true },
  { sys: '物流调度 TMS', dept: '物流部', to: '马建军', mail: 'ma.jj@corp.example.com', level: '仅日报', voice: false, enabled: true },
  { sys: '统一身份认证 IAM', dept: '平台架构组', to: '郑文斌', mail: 'zheng.wb@corp.example.com', level: 'Critical + 日报', voice: false, enabled: true },
  { sys: '仓储管理 WMS', dept: '仓储部', to: '田守义', mail: 'tian.sy@corp.example.com', level: 'Critical + 日报', voice: true, enabled: true }
];

const DEPT_STATS = [
  { label: '制造一处', value: 12, color: '#1d4ed8' },
  { label: '财务处', value: 9, color: '#0b6a86' },
  { label: '结算中心', value: 7, color: '#12805a' },
  { label: '安保部', value: 5, color: '#a8620b' },
  { label: '物流部', value: 4, color: '#8b5cf6' }
];

/* ==========================================================
   以下为「代码中写死（后端配置文件 / 常量）」的参数
   页面仅做展示，不提供修改入口
   ========================================================== */

// 5.1 邮件网关：写死在企业自建私有邮件服务器
const SMTP_FIXED = {
  type: '企业自建私有邮件服务器（Postfix + Dovecot，内网部署）',
  host: 'mail.corp.example.com',
  port: 587,
  ssl: 'STARTTLS（ opportunistic TLS，强制开启）',
  auth: 'AUTH LOGIN · 专用服务账号 ops-monitor（非个人账号）',
  from: 'ops-monitor@corp.example.com',
  fromName: '统一监控与岗位交接中心',
  whitelist: '出口 IP 10.20.31.0/24 已在邮件网关加白；发信域名 ops.corp.example.com 已完成 SPF / DKIM / DMARC 备案',
  limit: '单日上限 500 封 · 单封收件人 ≤ 50 人 · 附件 ≤ 10 MB',
  timeout: '连接超时 5s · 读取超时 15s · 失败重试 3 次（30s / 120s / 300s）',
  bounce: '退信统一回收至 ops-bounce@corp.example.com，连续 3 次退信自动停用该收件人并告警'
};

// 邮件正文模板：由后端模板引擎渲染，代码内置
const MAIL_TEMPLATES = {
  critical: {
    name: 'Critical 特急事件单发邮件',
    trigger: '触发条件：子系统上报 Critical（特急 / 阻断级）事件，立即单封投递',
    receivers: '该子系统责任处室负责人 + 信息中心值班班长 + 分管领导',
    subject: '[特急告警] {子系统} 发生 {等级} 事件，请立即处置'
  },
  daily: {
    name: '白晚班换班运营日报邮件',
    trigger: '触发条件：后端定时任务 cron = 0 8,20 * * *，白晚班换班节点自动投递',
    receivers: '分管领导 + 信息中心管理层（可选：按处室分别分发）',
    subject: '{日期} 运维运营日报（{班次}）· 在线率 {在线率} · 待处置 {待处置} 项'
  }
};

// 4.1 附件存储：统一写入客户指定服务器
const STORAGE_FIXED = {
  server: 'file-mgt-01（10.20.40.12）· 运维内网区',
  protocol: 'NFS v4.1 只读无关写入挂载（备选 SMB 3.0）',
  mount: '/mnt/ops-evidence',
  pathRule: '/mnt/ops-evidence/{yyyy}/{MM}/{dd}/{单据号}/{文件哈希前16位}.{扩展名}',
  quota: '配额 2 TB · 已用 218.4 GB（10.7%）· 低于 80% 不告警',
  retain: '在线保留 180 天 → 自动转入归档区保留 3 年（符合审计要求）',
  backup: '每日 02:30 增量备份至异地机房，异地副本保留 30 天',
  derived: '落盘同时生成 320×180 缩略图与 1280×720 预览件，原图不做压缩降质',
  fingerprint: '写入时计算 SHA-256 并登记水印时间、操作人，形成不可篡改存证链',
  access: '仅经堡垒机代理访问，禁止公网直连；取图走后端鉴权临时 URL（30 分钟有效）'
};

// 2.1 采集模式与端点：后端 collector.yaml 固定配置
const COLLECT_FIXED = {
  strategy: '以模式 A 为主、模式 B 兜底：具备标准接口的系统走网关订阅推送，遗留系统走只读库定时轮询',
  gateway: '统一日志网关 https://log-gw.corp.internal:9443/api/v1（ELK + Prometheus Alertmanager 双通道）',
  auth: 'OAuth2 客户端凭证，令牌 30 分钟自动续期；证书指纹校验',
  pushMode: 'Webhook 主动推送为主，轮询降级兜底（网关不可达时 30 秒轮询一次）',
  dbMode: '仅 TMS、WMS 两个无接口系统走模式 B：只读账号 monitor_ro，连接池上限 8，SQL 超时 2000ms',
  fallback: '连续 3 次采集失败自动降级为低频轮询并推送运维群，恢复后自动切回'
};

// 3.1 调度周期：全局硬编码，变更需发版重启
const CRON_FIXED = [
  { job: 'collect-subsystem-status', alias: '子系统状态拉取', cron: '*/1 * * * *', note: '每分钟调用各子系统 /health 网关接口' },
  { job: 'pull-alert-log', alias: '异常日志增量同步', cron: '*/1 * * * *', note: '按事件水位拉取增量，不做全量扫描' },
  { job: 'sync-legacy-db', alias: '遗留库（TMS/WMS）轮询', cron: '*/5 * * * *', note: '模式 B 子系统，按水位增量提取' },
  { job: 'calc-health-score', alias: '健康度得分换算', cron: '*/15 * * * *', note: '按可用性 40% / 性能 30% / 业务链路 30% 加权' },
  { job: 'judge-handover-gap', alias: '交接真空期研判', cron: '50 7,19 * * *', note: '换班前 10 分钟扫描未闭环事项' },
  { job: 'push-daily-report', alias: '运营日报生成与投递', cron: '0 8,20 * * *', note: '生成 HTML 日报并推送管理层' },
  { job: 'archive-evidence', alias: '历史附件冷归档', cron: '0 2 * * *', note: '180 天前存证转入归档区' }
];

/* ============ 采集调用日志（用于查看各系统数据对接情况） ============
   m = 距今多少分钟前发生；res：success 成功 / empty 无新数据 /
   slow 慢响应 / timeout 超时 / auth 鉴权失败 / conn 连接失败
=================================================================== */
const CALL_LOG_TPL = [
  { m: 1, sys: 'PAY', mode: 'A', kind: 'REST 状态拉取', ep: 'GET https://pay-gw.corp.internal:8443/api/v1/health', http: 200, cost: 128, rows: 1, res: 'success' },
  { m: 1, sys: 'IAM', mode: 'A', kind: 'REST 状态拉取', ep: 'GET https://iam.corp.internal/api/v1/health', http: 200, cost: 96, rows: 1, res: 'success' },
  { m: 2, sys: 'ERP', mode: 'A', kind: '事件增量拉取', ep: 'GET https://log-gw.corp.internal:9443/api/v1/events?since=evt_88213', http: 200, cost: 214, rows: 6, res: 'success' },
  { m: 2, sys: 'VMS', mode: 'A', kind: 'gRPC 流式订阅', ep: 'grpc stream vmssvc.Monitor/Subscribe', http: 200, cost: 3104, rows: 0, res: 'timeout', note: '节点 node-03 掉线，流读取超时 3000ms，本轮数据丢弃，下个周期重试' },
  { m: 3, sys: 'NET', mode: 'A', kind: 'Prometheus 指标查询', ep: 'GET https://prom.corp.internal/api/v1/query?query=up', http: 200, cost: 173, rows: 42, res: 'success' },
  { m: 3, sys: 'BAS', mode: 'A', kind: 'Syslog 事件接收', ep: 'syslog udp://10.20.31.9:514', http: 200, cost: 41, rows: 3, res: 'success' },
  { m: 4, sys: 'SET', mode: 'A', kind: '事件增量拉取', ep: 'GET https://settle.corp.internal/api/v1/events?since=evt_44012', http: 200, cost: 1582, rows: 12, res: 'slow', note: '响应超过 1500ms 慢调用阈值，已记录慢调用审计（索引缺失建议优化）' },
  { m: 5, sys: 'TMS', mode: 'B', kind: '只读库轮询 SQL', ep: 'SELECT ... FROM tms.ops_event WHERE id > :watermark', http: 200, cost: 3021, rows: 0, res: 'timeout', note: '超过 SQL 耗时阈值 2000ms 已强制中断，记录慢查询审计，等待下个周期重试' },
  { m: 5, sys: 'SCM', mode: 'A', kind: 'REST 状态拉取', ep: 'GET https://scm.corp.internal/api/v1/health', http: 200, cost: 141, rows: 1, res: 'success' },
  { m: 6, sys: 'BI', mode: 'A', kind: '事件增量拉取', ep: 'GET https://bi.corp.internal/api/v1/events?since=evt_12033', http: 200, cost: 88, rows: 0, res: 'empty' },
  { m: 6, sys: 'ITS', mode: 'A', kind: 'REST 状态拉取', ep: 'GET https://itsm.corp.internal/api/v1/health', http: 200, cost: 1042, rows: 1, res: 'success' },
  { m: 7, sys: 'PAY', mode: 'A', kind: '事件增量拉取', ep: 'GET https://pay-gw.corp.internal:8443/api/v1/events?since=evt_77120', http: 200, cost: 236, rows: 4, res: 'success' },
  { m: 8, sys: 'WMS', mode: 'B', kind: '只读库轮询 SQL', ep: 'SELECT ... FROM wms.handover_task WHERE id > :watermark', http: 0, cost: 5000, rows: 0, res: 'conn', note: '主机 10.20.31.28:3306 连接被拒绝（目标主节点故障切换中），标记子系统离线' },
  { m: 9, sys: 'ERP', mode: 'A', kind: 'gRPC 流式订阅', ep: 'grpc stream erpsvc.Monitor/Subscribe', http: 200, cost: 62, rows: 2, res: 'success' },
  { m: 10, sys: 'IAM', mode: 'A', kind: '事件增量拉取', ep: 'GET https://iam.corp.internal/api/v1/events?since=evt_9011', http: 200, cost: 119, rows: 1, res: 'success' },
  { m: 12, sys: 'NET', mode: 'A', kind: 'REST 状态拉取', ep: 'GET https://prom.corp.internal/api/v1/alerts', http: 200, cost: 151, rows: 8, res: 'success' },
  { m: 13, sys: 'SET', mode: 'A', kind: 'REST 状态拉取', ep: 'GET https://settle.corp.internal/api/v1/health', http: 200, cost: 187, rows: 1, res: 'success' },
  { m: 15, sys: 'VMS', mode: 'A', kind: 'REST 状态拉取', ep: 'GET https://vms.corp.internal/api/v1/health', http: 401, cost: 74, rows: 0, res: 'auth', note: 'OAuth2 令牌过期返回 401，已自动刷新令牌并重放一次后成功' },
  { m: 16, sys: 'TMS', mode: 'B', kind: '只读库轮询 SQL', ep: 'SELECT ... FROM tms.handover_task WHERE id > :watermark', http: 200, cost: 842, rows: 3, res: 'success' },
  { m: 18, sys: 'BAS', mode: 'A', kind: 'REST 状态拉取', ep: 'GET https://bastion.corp.internal/api/v1/health', http: 200, cost: 97, rows: 1, res: 'success' },
  { m: 20, sys: 'PAY', mode: 'A', kind: 'REST 状态拉取', ep: 'GET https://pay-gw.corp.internal:8443/api/v1/health', http: 200, cost: 1834, rows: 1, res: 'slow', note: '渠道对账任务占用线程导致响应变慢，建议错峰执行' },
  { m: 22, sys: 'SCM', mode: 'A', kind: '事件增量拉取', ep: 'GET https://scm.corp.internal/api/v1/events?since=evt_55210', http: 200, cost: 203, rows: 2, res: 'success' },
  { m: 25, sys: 'BI', mode: 'A', kind: 'REST 状态拉取', ep: 'GET https://bi.corp.internal/api/v1/health', http: 200, cost: 133, rows: 1, res: 'success' },
  { m: 28, sys: 'ITS', mode: 'A', kind: '事件增量拉取', ep: 'GET https://itsm.corp.internal/api/v1/events?since=evt_33120', http: 200, cost: 176, rows: 5, res: 'success' },
  { m: 31, sys: 'ERP', mode: 'A', kind: 'REST 状态拉取', ep: 'GET https://erp.corp.internal/api/v1/health', http: 200, cost: 145, rows: 1, res: 'success' },
  { m: 35, sys: 'VMS', mode: 'A', kind: '事件增量拉取', ep: 'GET https://vms.corp.internal/api/v1/events?since=evt_66218', http: 200, cost: 219, rows: 9, res: 'success' },
  { m: 40, sys: 'WMS', mode: 'B', kind: '只读库轮询 SQL', ep: 'SELECT ... FROM wms.ops_event WHERE id > :watermark', http: 0, cost: 5000, rows: 0, res: 'conn', note: '连接失败：目标主节点故障切换进行中' },
  { m: 46, sys: 'NET', mode: 'A', kind: 'Prometheus 指标查询', ep: 'GET https://prom.corp.internal/api/v1/query?query=node_load5', http: 200, cost: 212, rows: 42, res: 'success' },
  { m: 52, sys: 'IAM', mode: 'A', kind: 'REST 状态拉取', ep: 'GET https://iam.corp.internal/api/v1/health', http: 200, cost: 91, rows: 1, res: 'success' },
  { m: 58, sys: 'TMS', mode: 'B', kind: '只读库轮询 SQL', ep: 'SELECT ... FROM tms.ops_event WHERE id > :watermark', http: 200, cost: 1128, rows: 7, res: 'success' },
  { m: 65, sys: 'PAY', mode: 'A', kind: '事件增量拉取', ep: 'GET https://pay-gw.corp.internal:8443/api/v1/events?since=evt_77100', http: 200, cost: 241, rows: 3, res: 'success' },
  { m: 72, sys: 'SET', mode: 'A', kind: '事件增量拉取', ep: 'GET https://settle.corp.internal/api/v1/events?since=evt_43980', http: 200, cost: 1673, rows: 11, res: 'slow', note: '超过慢调用阈值，建议为 occurred_at 字段补充索引' },
  { m: 85, sys: 'BAS', mode: 'A', kind: 'Syslog 事件接收', ep: 'syslog udp://10.20.31.9:514', http: 200, cost: 38, rows: 2, res: 'success' },
  { m: 96, sys: 'SCM', mode: 'A', kind: 'REST 状态拉取', ep: 'GET https://scm.corp.internal/api/v1/health', http: 200, cost: 128, rows: 1, res: 'success' },
  { m: 110, sys: 'ITS', mode: 'A', kind: 'REST 状态拉取', ep: 'GET https://itsm.corp.internal/api/v1/health', http: 200, cost: 156, rows: 1, res: 'success' },
  { m: 128, sys: 'ERP', mode: 'A', kind: '事件增量拉取', ep: 'GET https://erp.corp.internal/api/v1/events?since=evt_88100', http: 200, cost: 198, rows: 4, res: 'success' },
  { m: 150, sys: 'BI', mode: 'A', kind: '事件增量拉取', ep: 'GET https://bi.corp.internal/api/v1/events?since=evt_12000', http: 200, cost: 176, rows: 3, res: 'success' },
  { m: 176, sys: 'NET', mode: 'A', kind: 'REST 状态拉取', ep: 'GET https://prom.corp.internal/api/v1/alerts', http: 200, cost: 149, rows: 6, res: 'success' }
];

const RES_META = {
  success: { label: '成功', cls: 'b-success', color: '#12805a' },
  empty: { label: '无新数据', cls: 'b-neutral', color: '#8a95a5' },
  slow: { label: '慢响应', cls: 'b-warn', color: '#a8620b' },
  timeout: { label: '超时', cls: 'b-danger', color: '#cc2f2a' },
  auth: { label: '鉴权失败', cls: 'b-warn', color: '#a8620b' },
  conn: { label: '连接失败', cls: 'b-danger', color: '#cc2f2a' }
};

function buildCallLogs(baseTime) {
  const t = baseTime || new Date();
  return CALL_LOG_TPL.map((x, i) => Object.assign({}, x, {
    id: 'LOG' + String(100000 + i),
    time: fmtDT(new Date(t.getTime() - x.m * 60000)),
    ts: new Date(t.getTime() - x.m * 60000)
  })).sort((a, b) => b.ts - a.ts);
}
