# Supabase / Vercel 迁移风险登记册

评分：影响与概率均为 1-5；等级综合业务影响、发生概率和可检测性。所有高风险项在真实数据 cutover 前必须有自动验证和回滚演练。

## 1. 高风险

| ID | 风险 | 影响/概率 | 触发原因 | 预防与缓解 | 检测/验收 | 回滚 |
|---|---|---:|---|---|---|---|
| H1 | 数据丢失或被覆盖 | 5/3 | 直接在活库迁移、upsert 覆盖云端新数据、WAL 快照不一致 | 停写窗口；SQLite 一致快照；原库/文件只读；migration run + payload hash；禁止无条件 upsert | 每表 count、PK 集合、规范化 hash、抽样实体、FK reconciliation | 切回 SQLite；按 run ID 撤销云端记录，不清空源 |
| H2 | 用户数据串号 | 5/3 | 表无 user_id、只按 ID 查询、子表跨 owner 关联 | 所有私有表 user_id；复合 FK；服务端从 Session 注入 owner；RLS + 显式 owner 条件 | 两账号直接 REST/SDK/猜 UUID/嵌套查询交叉测试 | 立即下线受影响 API；撤销 Session；修策略后审计访问日志 |
| H3 | RLS 配置错误 | 5/3 | 忘记 enable/force、WITH CHECK 缺失、security definer 越权 | migration lint；统一 policy 模板；最小权限；函数固定 search_path | 匿名/authenticated/service role 权限矩阵自动测试 | 回滚 deployment；撤销表 grant；修 forward migration |
| H4 | 文件公开或越权下载 | 5/3 | public bucket、永久 URL、路径不含 owner、下载只凭 UUID | private bucket；路径首段 user_id；Storage policy；短期 signed URL；业务表二次鉴权 | A 用户访问 B object/metadata 必须 403；过期 URL 不可用 | 禁用 bucket policy/旋转签名；撤销 URL；重新迁移受影响对象 |
| H5 | 本地 uploads 迁移不完整 | 5/3 | 元数据与磁盘不一致、孤儿、重复、上传中断 | file manifest、SHA-256、引用计数、幂等 object path、分批上传 | 源/目标对象数、总字节、hash、业务引用全部一致 | 保持 FILE_BACKEND=local；只撤销本 run objects |
| H6 | Auth Session 绕过或失效 | 5/3 | 只信客户端 token、cookie 刷新错误、callback 配错 | `@supabase/ssr`；服务端 `getUser()`；安全 cookie；Auth URL 环境隔离 | 登录/刷新/退出/过期/密码重置/Preview/移动 PWA 全流程 | 回滚 Auth 改动；禁用云业务访问；不影响本地模式 |
| H7 | SQLite/PostgreSQL 类型转换破坏数据 | 5/3 | TEXT 时间、REAL 金额、JSON 文本、0/1 boolean、空字符串 | dry run parser；严格错误清单；numeric；jsonb 验证；明确 null/empty 规则 | 每列转换失败为 0；金额和时间抽样；约束全部启用 | 修转换器后重跑，绝不跳过坏行 |
| H8 | 时区/DST 导致课程与日程错时 | 5/4 | 本地字符串、Australia/Sydney 与 Asia/Shanghai、ICS TZID、DST | 存 timestamptz + 原 timezone；用 IANA 时区；保留原始 occurrenceStart；测试 DST 边界 | Sydney 本地显示、UTC 值、中国查看、DST 切换样例对比 | 课程波次独立回退；保留源 ICS 与旧值映射 |
| H9 | Cascade delete 扩大删除范围 | 5/2 | `auth.users ON DELETE CASCADE`、文件/重要文件方向、跨用户错误 FK | 删除账号二次确认/延迟；软删除；复合 FK；数据库测试 | 构造完整关系图做删除测试；审计受影响行数 | Point-in-time restore/备份；暂停删除接口 |
| H10 | 未鉴权全量备份/健康接口暴露 | 5/3 | 当前 backup 无 Auth，health 返回绝对路径 | 所有 API 门禁；backup 限流审计；health 最小输出 | 匿名请求 401；响应扫描无路径/secret/private data | 立即禁用路由或 Vercel rollback |
| H11 | 离线同步重复创建/冲突 | 4/4 | `/api/sync/push` 无持久幂等，客户端重试、跨设备并发 | `sync_operations` 唯一键；payload hash；事务；版本/updatedAt 检查 | 重放同一 localId 100 次只生成一条；断网中断测试 | 暂停 auto sync；保留队列；人工 reconciliation |
| H12 | 密钥进入浏览器、日志或 Git | 5/2 | service role 放 NEXT_PUBLIC、错误回显、迁移脚本提交 | secret 管理；pre-commit/CI secret scan；日志脱敏；最小权限 | Git 历史和构建产物扫描；浏览器 source/env 检查 | 立即轮换 key；清理历史；审计访问 |

## 2. 中风险

| ID | 风险 | 影响/概率 | 缓解与验证 |
|---|---|---:|---|
| M1 | JSON 字段语义变化 | 3/3 | 导入前验证 `tags_json`、`localModifiedFields`、`reminderRule`；保留原始值到 staging；固定排序后 hash |
| M2 | 唯一约束冲突 | 4/3 | `tags.name` 改 `(user_id,name)`；course source unique 加 user_id；dry run 列出重复，不自动合并 |
| M3 | 标签双份真相不一致 | 3/4 | 第一阶段兼容保留 `tags_json` 与 relation；迁移校验并确定 canonical；禁止各自独立写 |
| M4 | 旧 progress 映射重复任务 | 4/3 | 以 `linkedTaskId` 优先；无关联时一对一生成；mapping ledger；标题不能作为唯一匹配依据 |
| M5 | 两套课程模型遗漏 | 4/3 | legacy 与 timetable 分开迁移/计数；旧课程只读；不未经确认合并 |
| M6 | API breaking change | 4/3 | 保持现有 JSON shape；contract tests；先 repository 后切后端；按模块 feature flag |
| M7 | 上传过大导致 Vercel 超时/内存 | 4/3 | signed direct upload、大小/MIME 限制；不在 Route Handler 读完整 Buffer；移动端弱网测试 |
| M8 | Storage 删除与 DB 不一致 | 4/3 | pending_delete 状态、可重试 worker、引用计数、孤儿扫描；不依赖 DB cascade 删除对象 |
| M9 | SSRF 与恶意 ICS | 4/3 | https only、阻断内网/metadata IP、限制 redirect/size/time/content type；解析器异常测试 |
| M10 | PWA 缓存旧 Auth/页面 | 4/3 | Auth/API network-only；版本化 cache；deploy 后 activate/claim；登录退出跨版本测试 |
| M11 | 手机端“离线”能力退化 | 4/3 | 明确 local/cloud 行为；IndexedDB migration；待同步计数；断网新增/重连/失败重试测试 |
| M12 | Realtime 在 Serverless 丢事件 | 3/4 | 移除进程内 SSE；第一版 focus refresh/轮询；后续 Supabase Realtime 按 user filter |
| M13 | Vercel Preview 误连生产 | 4/3 | Preview 独立 Supabase project/branch；环境变量分域；生产写操作需正式域名 |
| M14 | 日记/收支查询性能 | 3/3 | user_id + date/status/type 索引；分页；避免启动时全量读取长期历史 |
| M15 | 查询次数与冷启动延迟 | 3/4 | 初始 11 路并发做测量；按模块懒加载或 dashboard aggregation；连接池使用 Supabase 推荐方式 |
| M16 | 浏览器提醒不可靠 | 3/4 | 不把页面定时器描述为可靠后台提醒；若要保证则单独设计 cron/Web Push 和时区策略 |
| M17 | Auth 用户删除误删全部业务 | 5/2 | 账号删除延迟/导出/再次验证；默认软禁用而非立即删除；PITR/备份 |
| M18 | 财务多币种统计错误 | 4/2 | 保留每笔 currency；按币种分组；不无汇率相加；amount numeric；回归测试 |
| M19 | local/cloud 配置误选 | 4/3 | 云端无 Supabase 配置时 fail closed，不回退临时 SQLite；启动日志只输出 backend 类型不输出 secret/path |

## 3. 低风险

| ID | 风险 | 影响/概率 | 缓解与验证 |
|---|---|---:|---|
| L1 | 字段命名 camelCase 在 PostgreSQL 需引用 | 2/4 | 第一阶段由 repository 映射，避免全量重命名；后续单独规范化 |
| L2 | 旧兼容路由仍存在 | 2/3 | 保留 redirect/统一页面；云端 route protection 覆盖所有入口 |
| L3 | localStorage 偏好未跨设备 | 2/4 | 列出需云同步的设置；背景等 UI 偏好可继续设备本地 |
| L4 | 日志持续增长 | 2/3 | Electron 日志轮转；云日志脱敏与 retention |
| L5 | 无独立自动测试框架 | 3/4 | 在迁移前补 contract/integration/RLS tests；不依赖只有 typecheck |
| L6 | Node `node:sqlite` 实验性 | 2/2 | local mode 固定 Node 兼容版本；repository 隔离；云端不加载该实现 |
| L7 | 网络地址功能云端无意义 | 1/5 | `/api/network` 仅 local mode 暴露；云端设置显示正式 URL |
| L8 | 旧数据目录重复占空间 | 1/4 | 迁移完成后只报告并提供人工清理指引；绝不自动删除 |

## 4. Cutover 停止条件

出现以下任一情况必须停止切换，不得“先上线再修”：

1. 任一用户私有表未启用 RLS，或跨账号测试存在一条越权成功。
2. 源/目标 row count 或主键集合无法解释地不一致。
3. 任一被引用文件缺失，或 hash/size 不一致。
4. Sydney 时区课程在抽样或 DST 边界出现系统性偏移。
5. 离线队列重放会创建重复记录。
6. service role key 出现在浏览器 bundle、Git、日志或 API 响应。
7. Backup、uploads、health 任一接口可匿名访问私人信息。
8. 回滚到 SQLite/local uploads 未实际演练成功。

## 5. 上线后监控

- Auth 登录/刷新失败率、401/403 比例、异常跨用户访问尝试。
- API p50/p95、错误率、Supabase query 失败和连接耗尽。
- 同步队列 pending/failed/duplicate 数。
- Storage 上传失败、pending_delete、孤儿 object、signed URL 失败。
- 每日核心表 count 与备份状态；迁移初期做源/目标只读 reconciliation。
- ICS fetch 被拦截、超时、过大响应和解析失败。
- PWA 版本、Service Worker 更新失败和旧 cache 残留。
- 所有日志必须使用 request ID，禁止记录日记内容、财务备注、Feed URL、文件名、token 或 service key。

## 6. 风险所有权建议

| 领域 | 责任人/审查角色 |
|---|---|
| Schema、迁移、备份恢复 | 数据库迁移负责人 + 独立复核 |
| Auth、RLS、Storage policy | 安全负责人 + 两账号自动测试 |
| API 契约与前端回归 | 应用负责人 |
| 课程/时区 | 课程模块负责人 + Sydney 时区验收 |
| 文件 manifest/hash | Storage 迁移负责人 |
| Vercel/PWA/环境变量 | 发布负责人 |

若项目仍由单人维护，也应把“实施”和“复核”拆成两个独立步骤，并保留机器生成的验收报告。
