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

/* ============ 关键词联动：紧急联系人 / 关键词库 / 多对多绑定 ============
   客户可在页面自行维护这三类数据，并按「关键词 × 子系统 × 紧急联系人」多对多绑定。
   命中关键词的异常即视为紧急邮件，按绑定关系即时投递给对应紧急联系人。
   字段说明：
     contacts  level: 仅特急 / 特急+重要 / 全部
     keywords  match: 包含 / 前缀 / 精确 / 正则 / 多词任一（以 | 分隔）
               level: 特急 / 重要    dnd: 是否跳过免打扰时段
     bindings  sys: 子系统 id 数组，含 'ALL' 表示全部子系统
*/

const CONTACTS_SEED = [
  { id: 'C01', name: '钱志强', dept: '安保部', role: '值班班长', mail: 'qian.zq@corp.example.com', level: '仅特急', enabled: true },
  { id: 'C02', name: '田守义', dept: '仓储部', role: '库管主管', mail: 'tian.sy@corp.example.com', level: '仅特急', enabled: true },
  { id: 'C03', name: '孙立群', dept: '财务处', role: '支付业务负责人', mail: 'sun.lq@corp.example.com', level: '特急+重要', enabled: true },
  { id: 'C04', name: '周雅琴', dept: '结算中心', role: '结算主管', mail: 'zhou.yq@corp.example.com', level: '特急+重要', enabled: true },
  { id: 'C05', name: '李国栋', dept: '网络组', role: '网络工程师', mail: 'li.gd@corp.example.com', level: '全部', enabled: true },
  { id: 'C06', name: '吴海涛', dept: '安全合规部', role: '安全经理', mail: 'wu.ht@corp.example.com', level: '特急+重要', enabled: true },
  { id: 'C07', name: '郑文斌', dept: '平台架构组', role: '系统架构师', mail: 'zheng.wb@corp.example.com', level: '全部', enabled: true },
  { id: 'C08', name: '王海涛', dept: '信息中心', role: '夜间值班班长', mail: 'wang.ht@corp.example.com', level: '全部', enabled: true },
  { id: 'C09', name: '刘振华', dept: '分管领导', role: '副总经理', mail: 'liu.zh@corp.example.com', level: '仅特急', enabled: true }
];

const KEYWORDS_SEED = [
  { id: 'K01', word: '宕机', match: '包含', level: '特急', dnd: true, enabled: true, note: '全系统通用', hits: 2 },
  { id: 'K02', word: '心跳中断', match: '包含', level: '特急', dnd: true, enabled: true, note: '主机 / 数据库主节点', hits: 3 },
  { id: 'K03', word: '掉线', match: '包含', level: '特急', dnd: true, enabled: true, note: '设备与存储节点', hits: 2 },
  { id: 'K04', word: '支付失败率|成功率跌破|渠道中断', match: '多词任一', level: '特急', dnd: true, enabled: true, note: '支付资金链路', hits: 4 },
  { id: 'K05', word: '对账不平|资金挂账', match: '多词任一', level: '特急', dnd: false, enabled: true, note: '结算一致性', hits: 1 },
  { id: 'K06', word: '主备切换|链路中断|丢包率', match: '多词任一', level: '特急', dnd: true, enabled: true, note: '网络与专线', hits: 2 },
  { id: 'K07', word: '^\\s*(越权|提权|口令暴力)', match: '正则', level: '特急', dnd: true, enabled: true, note: '堡垒机安全事件', hits: 0 },
  { id: 'K08', word: '作业中断|拣货阻塞|AGV 停摆', match: '多词任一', level: '特急', dnd: true, enabled: true, note: '仓储作业', hits: 1 },
  { id: 'K09', word: '延迟', match: '包含', level: '重要', dnd: false, enabled: true, note: '副本同步与队列积压', hits: 5 },
  { id: 'K10', word: '磁盘使用率超过 90%', match: '包含', level: '重要', dnd: false, enabled: true, note: '容量预警', hits: 2 },
  { id: 'K11', word: '演练', match: '包含', level: '重要', dnd: false, enabled: false, note: '演练期临时关闭', hits: 0 }
];

const BINDINGS_SEED = [
  { id: 'B01', name: '视频与存储类故障', kws: ['K01', 'K02', 'K03'], sys: ['VMS'], contacts: ['C01', 'C08'], enabled: true },
  { id: 'B02', name: '资金支付链路阻断', kws: ['K04', 'K05'], sys: ['PAY', 'SET'], contacts: ['C03', 'C04', 'C09'], enabled: true },
  { id: 'B03', name: '网络与安全事件', kws: ['K06', 'K07'], sys: ['NET', 'BAS', 'IAM'], contacts: ['C05', 'C06', 'C07'], enabled: true },
  { id: 'B04', name: '仓储物流作业中断', kws: ['K08', 'K01'], sys: ['WMS', 'TMS'], contacts: ['C02', 'C08'], enabled: true },
  { id: 'B05', name: '全局兜底（事后复盘）', kws: ['K01', 'K09', 'K10'], sys: ['ALL'], contacts: ['C08', 'C09'], enabled: true }
];

/* ============ RBAC 用户与权限管理 ============
   标准的「用户 - 角色 - 权限」三层模型：
     USERS      用户（可归属多个角色）
     ROLES      角色（一组权限点的集合）
     PERMS      权限点 = 功能模块 × 操作动作
     AUDIT      权限变更审计日志
   页面支持客户自行维护用户、角色与授权关系。
   ============ */

const PERM_ACTIONS = [
  { id: 'view', label: '查看' },
  { id: 'create', label: '新增' },
  { id: 'edit', label: '编辑' },
  { id: 'delete', label: '删除' },
  { id: 'export', label: '导出' },
  { id: 'approve', label: '审批授权' }
];

const PERM_MODULES = [
  { id: 'overview', name: '监控总览', desc: '健康度、告警流水、交接态势大盘' },
  { id: 'systems', name: '子系统管理', desc: '接入子系统清单与底座信息' },
  { id: 'ingest', name: '数据采集与日志', desc: '对接情况与调用日志' },
  { id: 'evidence', name: '存证与岗位交接', desc: '附件存证、交接单与责任书' },
  { id: 'alerts', name: '预警通知', desc: '邮件策略、语音播报、分发规则' },
  { id: 'keyword', name: '关键词与紧急联系人', desc: '关键词命中规则与绑定关系' },
  { id: 'analysis', name: '异常根因分析', desc: '高频告警统计、根因聚类、相似告警研判' },
  { id: 'report', name: '自动月报', desc: '月度报表生成、预览与导出' },
  { id: 'archive', name: '历史日志归档', desc: '过期日志自动归档、检索查询与审计追溯' },
  { id: 'pit', name: '凹库·微水调库看板', desc: '各站凹库量统计、在库时长与调库趋势（P2 屏）' },
  { id: 'wall', name: '监控室轮播', desc: '多屏轮播、轮播顺序与间隔配置（监控室）' },
  { id: 'user', name: '用户与权限', desc: '用户、角色、权限矩阵管理' },
  { id: 'system', name: '系统设置', desc: '基础参数、字典、备份与升级' }
];

const ROLES_SEED = [
  {
    id: 'R01', name: '系统管理员', builtin: true, level: '系统级', users: 2, color: '#1d4ed8',
    desc: '拥有全部功能的全部权限，可创建角色并授权他人',
    perms: { overview: ['view', 'create', 'edit', 'delete', 'export', 'approve'], systems: ['view', 'create', 'edit', 'delete', 'export', 'approve'], ingest: ['view', 'create', 'edit', 'delete', 'export', 'approve'], evidence: ['view', 'create', 'edit', 'delete', 'export', 'approve'], alerts: ['view', 'create', 'edit', 'delete', 'export', 'approve'], keyword: ['view', 'create', 'edit', 'delete', 'export', 'approve'], analysis: ['view', 'create', 'edit', 'delete', 'export', 'approve'], report: ['view', 'create', 'edit', 'delete', 'export', 'approve'], archive: ['view', 'create', 'edit', 'delete', 'export', 'approve'], pit: ['view', 'create', 'edit', 'delete', 'export', 'approve'], wall: ['view', 'create', 'edit', 'delete', 'export', 'approve'], user: ['view', 'create', 'edit', 'delete', 'export', 'approve'], system: ['view', 'create', 'edit', 'delete', 'export', 'approve'] }
  },
  {
    id: 'R02', name: '信息中心主任', builtin: false, level: '管理级', users: 1, color: '#0b6a86',
    desc: '全局查看与审批，可管理本部门用户，不可修改系统参数',
    perms: { overview: ['view', 'export'], systems: ['view', 'edit', 'export'], ingest: ['view', 'export'], evidence: ['view', 'create', 'edit', 'export', 'approve'], alerts: ['view', 'create', 'edit', 'export', 'approve'], keyword: ['view', 'create', 'edit', 'export', 'approve'], analysis: ['view', 'export'], report: ['view', 'create', 'edit', 'export', 'approve'], archive: ['view', 'create', 'edit', 'export', 'approve'], pit: ['view', 'export'], wall: ['view'], user: ['view', 'create', 'edit'], system: ['view'] }
  },
  {
    id: 'R03', name: '值班班长', builtin: false, level: '执行级', users: 2, color: '#12805a',
    desc: '负责日常值守、异常处置与白晚班交接，可上传存证、认领责任书',
    perms: { overview: ['view'], systems: ['view'], ingest: ['view'], evidence: ['view', 'create', 'edit', 'export'], alerts: ['view', 'create', 'edit'], keyword: ['view'], analysis: ['view'], report: ['view', 'create', 'edit', 'export'], archive: ['view', 'create', 'export'], pit: ['view', 'create', 'export'], wall: ['view'], user: ['view'], system: [] }
  },
  {
    id: 'R04', name: '处室负责人', builtin: false, level: '执行级', users: 4, color: '#a8620b',
    desc: '仅可见本处室相关数据，负责本处室异常签收与处置反馈',
    perms: { overview: ['view'], systems: ['view'], ingest: ['view'], evidence: ['view', 'create', 'edit'], alerts: ['view', 'edit'], keyword: ['view'], analysis: ['view'], report: ['view', 'edit'], archive: ['view'], pit: ['view'], wall: ['view'], user: ['view'], system: [] }
  },
  {
    id: 'R05', name: '安全审计员', builtin: false, level: '审计级', users: 1, color: '#8b5cf6',
    desc: '只读 + 导出，用于合规审计与追溯，不可做任何写操作',
    perms: { overview: ['view', 'export'], systems: ['view', 'export'], ingest: ['view', 'export'], evidence: ['view', 'export'], alerts: ['view', 'export'], keyword: ['view', 'export'], analysis: ['view', 'export'], report: ['view', 'export'], archive: ['view', 'export'], pit: ['view', 'export'], wall: ['view'], user: ['view', 'export'], system: ['view'] }
  },
  {
    id: 'R06', name: '只读访客', builtin: false, level: '访客级', users: 1, color: '#8a95a5',
    desc: '演示或参观用，仅可查看监控总览，不含任何导出能力',
    perms: { overview: ['view'], systems: [], ingest: [], evidence: [], alerts: [], keyword: [], analysis: ['view'], report: [], archive: ['view'], pit: ['view'], wall: ['view'], user: [], system: [] }
  }
];

const USERS_SEED = [
  { id: 'U01', account: 'admin', name: '张卫东', dept: '信息中心', post: '值班班长', phone: '138****6021', mail: 'zhang.wd@corp.example.com', roles: ['R01', 'R03'], scope: '全部数据', status: 'enabled', lastLogin: '2026-09-23 17:42', created: '2025-03-18', builtin: true, mfa: true },
  { id: 'U02', account: 'zheng.wb', name: '郑文斌', dept: '平台架构组', post: '系统架构师', phone: '139****4478', mail: 'zheng.wb@corp.example.com', roles: ['R01'], scope: '全部数据', status: 'enabled', lastLogin: '2026-09-23 16:08', created: '2025-03-18', builtin: false, mfa: true },
  { id: 'U03', account: 'wu.ht', name: '吴海涛', dept: '安全合规部', post: '安全经理', phone: '137****2255', mail: 'wu.ht@corp.example.com', roles: ['R02'], scope: '全部数据', status: 'enabled', lastLogin: '2026-09-23 15:31', created: '2025-05-06', builtin: false, mfa: true },
  { id: 'U04', account: 'qian.zq', name: '钱志强', dept: '安保部', post: '值班班长', phone: '135****8830', mail: 'qian.zq@corp.example.com', roles: ['R03', 'R04'], scope: '本处室及下属', status: 'enabled', lastLogin: '2026-09-23 14:52', created: '2025-06-12', builtin: false, mfa: false },
  { id: 'U05', account: 'sun.lq', name: '孙立群', dept: '财务处', post: '支付业务负责人', phone: '136****1190', mail: 'sun.lq@corp.example.com', roles: ['R04'], scope: '本处室及下属', status: 'enabled', lastLogin: '2026-09-23 13:05', created: '2025-06-12', builtin: false, mfa: false },
  { id: 'U06', account: 'zhou.yq', name: '周雅琴', dept: '结算中心', post: '结算主管', phone: '134****6677', mail: 'zhou.yq@corp.example.com', roles: ['R04'], scope: '本处室及下属', status: 'enabled', lastLogin: '2026-09-23 11:38', created: '2025-07-01', builtin: false, mfa: false },
  { id: 'U07', account: 'li.gd', name: '李国栋', dept: '网络组', post: '网络工程师', phone: '133****4412', mail: 'li.gd@corp.example.com', roles: ['R04'], scope: '本处室及下属', status: 'disabled', lastLogin: '2026-09-12 09:20', created: '2025-07-01', builtin: false, mfa: false },
  { id: 'U08', account: 'tian.sy', name: '田守义', dept: '仓储部', post: '库管主管', phone: '132****9034', mail: 'tian.sy@corp.example.com', roles: ['R04'], scope: '本处室及下属', status: 'enabled', lastLogin: '2026-09-23 10:03', created: '2025-08-19', builtin: false, mfa: false },
  { id: 'U09', account: 'audit01', name: '陈慧敏', dept: '审计部', post: '内审专员', phone: '131****5520', mail: 'chen.hm@corp.example.com', roles: ['R05'], scope: '全部数据', status: 'enabled', lastLogin: '2026-09-22 16:44', created: '2025-09-02', builtin: false, mfa: true },
  { id: 'U10', account: 'guest', name: '参观账号', dept: '外部', post: '演示访客', phone: '—', mail: 'guest@corp.example.com', roles: ['R06'], scope: '仅本人相关', status: 'disabled', lastLogin: '2026-08-30 10:15', created: '2025-11-11', builtin: false, mfa: false }
];

const AUDIT_SEED = [
  { time: '2026-09-23 17:42', user: '张卫东', action: '登录', target: '系统首页', result: '成功', ip: '10.20.31.45', detail: '密码 + 短信二次验证' },
  { time: '2026-09-23 16:08', user: '郑文斌', action: '修改权限', target: '角色「值班班长」', result: '成功', ip: '10.20.31.28', detail: 'evidence: 增加【审批授权】' },
  { time: '2026-09-23 15:31', user: '吴海涛', action: '新增用户', target: '账号 audit01', result: '成功', ip: '10.20.31.66', detail: '分配角色：安全审计员' },
  { time: '2026-09-23 14:02', user: '郑文斌', action: '停用用户', target: '账号 guest', result: '成功', ip: '10.20.31.28', detail: '演示期结束后临时停用' },
  { time: '2026-09-23 11:20', user: '张卫东', action: '角色变更', target: '钱志强', result: '成功', ip: '10.20.31.45', detail: '增加角色：处室负责人' },
  { time: '2026-09-23 09:15', user: '李国栋', action: '登录', target: '系统首页', result: '失败', ip: '10.20.31.77', detail: '连续 3 次密码错误，账号被临时锁定' },
  { time: '2026-09-22 16:44', user: '陈慧敏', action: '导出数据', target: '《9月告警流水台账》', result: '成功', ip: '10.20.31.90', detail: '导出 268 条记录，已留痕' },
  { time: '2026-09-22 10:33', user: '吴海涛', action: '重置密码', target: '账号 li.gd', result: '成功', ip: '10.20.31.66', detail: '用户忘记密码，已重置并强制下次登录修改' }
];

const DEPT_STATS = [
  { label: '制造一处', value: 12, color: '#1d4ed8' },
  { label: '财务处', value: 9, color: '#0b6a86' },
  { label: '结算中心', value: 7, color: '#12805a' },
  { label: '安保部', value: 5, color: '#a8620b' },
  { label: '物流部', value: 4, color: '#8b5cf6' }
];

/* ==========================================================
   实施参数（SMTP / 模板 / 存储 / 采集 / 调度）
   这些值代表后端实际落地时的配置，页面不做展示，
   仅供研发在实施阶段对齐口径使用。
   ========================================================== */

// 5.1 邮件网关实施参数（企业自建私有邮件服务器）
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

// 邮件正文模板：由后端模板引擎渲染
const MAIL_TEMPLATES = {
  critical: {
    name: 'Critical 特急事件单发邮件',
    trigger: '触发条件：子系统上报 Critical（特急 / 阻断级）事件，立即单封投递',
    receivers: '该子系统责任处室负责人 + 信息中心值班班长 + 分管领导',
    subject: '[特急告警] {子系统} 发生 {等级} 事件，请立即处置'
  },
  daily: {
    name: '白晚班换班运营日报邮件',
    trigger: '触发条件：白晚班换班节点（08:00 / 20:00）自动投递当日汇总运营日报',
    receivers: '分管领导 + 信息中心管理层（可选：按处室分别分发）',
    subject: '{日期} 运维运营日报（{班次}）· 在线率 {在线率} · 待处置 {待处置} 项'
  }
};

// 4.1 附件存储：统一写入客户指定服务器（页面不展示）
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

// 2.1 采集模式与端点（实施时对接口径）
const COLLECT_FIXED = {
  strategy: '以模式 A 为主、模式 B 兜底：具备标准接口的系统走网关订阅推送，遗留系统走只读库定时轮询',
  gateway: '统一日志网关 https://log-gw.corp.internal:9443/api/v1（ELK + Prometheus Alertmanager 双通道）',
  auth: 'OAuth2 客户端凭证，令牌 30 分钟自动续期；证书指纹校验',
  pushMode: 'Webhook 主动推送为主，轮询降级兜底（网关不可达时 30 秒轮询一次）',
  dbMode: '仅 TMS、WMS 两个无接口系统走模式 B：只读账号 monitor_ro，连接池上限 8，SQL 超时 2000ms',
  fallback: '连续 3 次采集失败自动降级为低频轮询并推送运维群，恢复后自动切回'
};

// 3.1 调度周期（实施时对接口径）
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
