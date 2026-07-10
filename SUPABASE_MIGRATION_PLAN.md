# Supabase 与 Vercel 迁移实施计划

目标：在不丢失本地数据、不一次性重写前端的前提下，从 Next.js + SQLite + local uploads 演进为 Next.js + Supabase PostgreSQL/Auth/Storage + Vercel，同时保留可回滚路径。

## 1. 推荐目标架构

```text
Browser / PWA / Electron
  -> Next.js UI
  -> authenticated Route Handlers / service layer
     -> repository interface
        -> Supabase PostgreSQL (cloud deployment)
        -> SQLite (local desktop deployment)
     -> file service
        -> Supabase Storage (cloud)
        -> local uploads (desktop)
  -> Supabase Auth session cookie
  -> Supabase Realtime（可选，后置）
```

第一原则：数据库 owner 从可信 Session 推导，任何业务请求都不能接受客户端提供的 `user_id`。第二原则：迁移期间保留原 API 响应结构，避免 Auth、数据库、Storage 和前端大改同时发生。

## 2. Supabase PostgreSQL 目标结构

### 2.1 通用设计

- 保留当前 21 张表的业务名称、原 UUID 和字段语义，第一阶段不全面重命名。
- 所有私人表增加 `user_id uuid not null references auth.users(id) on delete cascade`。
- 现有时间戳转 `timestamptz`，纯日期转 `date`，每周时刻转 `time`，布尔转 `boolean`，JSON 文本转 `jsonb`。
- `createdAt default now()`；`updatedAt default now()` 并用 trigger 更新。
- 父表增加 `unique(user_id,id)`，子表使用复合外键 `(user_id,parent_id)`，从结构上禁止跨用户关系。
- 状态/类型先用 `text + check`，不要急于 PostgreSQL enum，以便兼容以后新增类型。
- 所有软删除表可增加 `deletedAt timestamptz`；Task 已有 `archivedAt`，不要把 archive 与 delete 混为一谈。

### 2.2 表级目标

| 表 | 目标处理 |
|---|---|
| `tasks` | 保留统一 Task/Deadline/Counter/Checklist/Progress 模型；加 owner、check constraints 和查询索引 |
| `subtasks`, `task_progress_entries` | 加 owner 与复合 FK 到 task；保留历史 |
| `tags`, `task_tags` | `unique(user_id,name)`；连接表 PK 包含 user_id |
| `plans`, `plan_items` | 加 owner；补正式复合 FK；保留排序 |
| `todo_lists`, `todo_list_items` | 加 owner；日程时间用 timestamptz；保留原 To Do 边界 |
| `progress_items` | 迁移兼容表，云端只读；每条确认映射到 task 后停止写入，暂不物理删除 |
| `courses`, `class_sessions`, `assignments` | 作为 legacy 私有表迁移，补时间戳/owner；新增功能继续关闭 |
| `timetable_sources` | owner + RLS；Feed URL 私有；不向客户端返回不必要的凭据型 URL |
| `timetable_courses`, `course_occurrences` | owner + 复合 FK；保留 source identity 唯一约束并加入 user_id |
| `journal_entries` | owner + RLS；`linkedPlanId` 补复合 FK，删除策略需与当前主动删除行为一致 |
| `expenses` | owner；amount 改 numeric；receipt 复合 FK；币种 check |
| `uploaded_files` | owner、bucket、object_path、hash、status；Storage object 另有 policy |
| `important_files` | owner；file 复合 FK；保留 expiry/tags |
| `settings` | PK 改 `(user_id,key)`；迁移标志移到 server-only `schema_migrations` |

可新增基础设施表：

- `profiles(user_id PK, display_name, created_at, updated_at)`：可选，不放业务数据。
- `sync_operations(user_id, device_id, local_id, status, entity_type, server_id, payload_hash, created_at)`：离线推送幂等账本，唯一 `(user_id, device_id, local_id)`。
- `migration_runs`、`migration_id_map`、`migration_file_manifest`：仅 service role 访问，不暴露客户端。

## 3. Supabase Auth 设计

### 3.1 第一版登录方式

采用 Email + Password：注册、登录、持久 Session、退出、忘记密码、重置密码。暂不接 Google/Apple/微信，不做组织和共享。

使用 `@supabase/ssr`：

- Browser client 处理交互。
- Server client 从 cookies 读取/刷新 Session。
- Middleware 只负责刷新 token 和路由门禁提示；真正授权仍在 Route Handler + RLS。
- 服务端每次敏感请求调用 `auth.getUser()` 获取经服务端验证的 user，不仅信任客户端 session payload。

### 3.2 页面保护

公开：`/login`、`/register`、`/forgot-password`、`/reset-password`、`/auth/callback`，以及明确选择公开的产品说明页。  
登录保护：主页、任务、计划、课程、日程、日记、收支、文件、设置、guide 中涉及私人状态的部分及所有业务 API。

Electron/local mode 若继续无账号运行，应通过部署模式明确分支，不要伪造一个固定云端 user ID。

### 3.3 默认 Settings 初始化

推荐在 `auth.users` insert 后通过 `security definer` 数据库函数创建默认 settings：

- `homeTitle = Leo的生活学习助手`
- `showHomeTitle = 1`
- `lastUsedCurrency = ''`
- 其他真正需跨设备的偏好

函数必须固定 `search_path`，只允许受控触发。也可在注册完成后的服务端事务初始化，但必须可幂等重试。

### 3.4 防止 user_id 伪造

```text
request body.user_id -> 忽略/拒绝
server user id       -> supabase.auth.getUser()
insert user_id       -> server-side user.id 或数据库 default auth.uid()
select/update/delete -> RLS + 显式 user_id 条件
service role         -> 仅离线迁移/受控后台，不进入浏览器或公开 API
```

## 4. RLS 设计

所有 21 张现有表启用并强制 RLS。对直接含 `user_id` 的表使用统一四策略：

```sql
-- SELECT / DELETE USING
auth.uid() = user_id

-- INSERT WITH CHECK
auth.uid() = user_id

-- UPDATE
using (auth.uid() = user_id)
with check (auth.uid() = user_id)
```

适用表：`tasks`、`subtasks`、`tags`、`task_tags`、`plans`、`plan_items`、`todo_lists`、`todo_list_items`、`progress_items`、`task_progress_entries`、`courses`、`class_sessions`、`assignments`、`timetable_sources`、`timetable_courses`、`course_occurrences`、`journal_entries`、`expenses`、`uploaded_files`、`important_files`、`settings`。

额外要求：

- 子表 INSERT/UPDATE 除 owner 条件外，复合 FK 必须证明 parent 属于同一用户。
- `sync_operations` 允许用户读取自己的状态；插入最好仅通过受控 API/RPC。
- `migration_*`、`schema_migrations` 不给 authenticated 用户权限，仅 service role。
- `profiles` 若未来有公开昵称，应单独设计公开字段 view；不要把设置表直接公开。
- `storage.objects` 使用 bucket + 路径首段 owner 策略，详见 Storage 报告。
- service role 绕过 RLS，因此只存在本地迁移环境/Vercel server secret，不写入普通 Route Handler 可回显的位置。

上线前必须用两个真实测试账号做交叉访问测试，包括直接 REST、猜 UUID、嵌套关系、signed URL 和删除。

## 5. SQLite 到 Supabase 数据迁移

### 5.1 总原则

- 本地 SQLite 在切换验收前保持权威和只读备份。
- 为现有本地用户先创建/选择一个 Supabase Auth 用户，其 UUID 作为迁入记录的 `user_id`。
- 原业务 UUID 尽量原样保留；仍建立 mapping ledger，记录来源表/旧 ID/新 ID/run ID/hash。
- 迁移使用 service role 的离线脚本，不通过公开 API，不把密钥写入 `.env` 模板或 Git。
- 每个阶段可重复运行，使用主键 upsert + payload hash；发现云端记录已被修改则停止，不覆盖。

### 5.2 一致备份

1. 暂停应用写入。
2. 使用 SQLite backup API 或 checkpoint 后复制主 DB；若直接复制则连同 WAL/SHM。
3. 复制 uploads 只读快照。
4. 生成 schema、每表行数、主键集合、外键孤儿报告、JSON 可解析率、时间格式报告、文件 hash manifest。
5. 备份加时间戳和 SHA-256，至少保留两份不同位置。

不要调用当前 `getDb()` 作为只读导出入口，因为它会自动 migrate/seed。

### 5.3 实际导入顺序

**Wave A：身份、设置与核心关系**

1. Auth user / profile / 默认 settings。
2. `tags`。
3. `tasks` -> `subtasks` -> `task_progress_entries` -> `task_tags`。
4. `plans` -> `plan_items`。
5. `todo_lists` -> `todo_list_items`。
6. `journal_entries`（计划映射已存在后）。
7. `progress_items` 兼容导入并核验 linked task；没有对应任务的旧进度转换为 progress-enabled Task，并记录 mapping。

**Wave B：课程**

1. `courses` -> `class_sessions` -> `assignments`。
2. `timetable_sources` -> `timetable_courses` -> `course_occurrences`。
3. 验证时区、系列唯一键、取消/例外和本地修改字段。

**Wave C：文件与财务**

1. 生成 `uploaded_files` manifest 并上传 Storage。
2. 写 `uploaded_files` metadata。
3. 导入 `expenses` 与 `important_files`，建立文件 FK。
4. 校验对象 size/hash/引用数。

文件放在 Wave C 是因为最慢、最易失败；但 `expenses` 依赖小票，所以财务记录要在 file metadata 就绪后整体提交，或先 staging 后一次切换。

### 5.4 Dry run 与验证

Dry run 不写 Supabase，输出：

- 每表源行数、有效行数、失败行数。
- PK 重复、FK 孤儿、跨表引用缺失。
- UUID、日期、timestamptz、JSON、numeric 转换错误。
- 旧进度到任务、课程源到 occurrence、文件引用的映射计划。
- 目标 insert/upsert 顺序和预计字节。

正式迁移后验证：

- 每表按 user_id 的 row count 与源一致，转换表另给 reconciliation。
- 对稳定字段计算规范化 hash；抽样对比完整实体。
- 所有 FK/unique/check 生效。
- 两账号 RLS 交叉测试。
- UI 核心流程：任务/To Do/计划/进度/课表/日记/收支/文件/设置。
- 时间轴对比 Sydney 时区与浏览器显示，特别覆盖 DST。

### 5.5 回滚

- 在云端切换前记录 cutover 时间，暂停本地写入或明确只读。
- 如验证失败，将 `DATA_BACKEND` 切回 SQLite、`FILE_BACKEND` 切回 local；本地数据从未删除。
- 云端回滚按 migration run ID 删除本次插入，不使用全表 truncate。
- 若切换后已产生云端新数据，不能简单回滚覆盖本地；必须先导出增量并做人工确认。这是 cutover 窗口要尽量短的原因。

## 6. 双模式兼容建议

### 6.1 建议保留什么

建议中期保留两个**部署模式**：

```text
local desktop: DATA_BACKEND=sqlite, FILE_BACKEND=local
cloud web:     DATA_BACKEND=supabase, FILE_BACKEND=supabase
```

它能保留 local-first 桌面体验和无云依赖使用，同时支持 Vercel。模式在服务端启动时决定，前端继续调用同一 API。

### 6.2 不建议做什么

第一版不做 SQLite <-> Supabase 持续双向同步，也不做同一请求双写。原因：

- 当前离线队列只覆盖部分 POST，缺少 UPDATE/DELETE tombstone。
- 服务端没有幂等 ledger、版本向量或冲突策略。
- 文件上传和业务 metadata 不是原子操作。
- 多设备会出现时间、排序、完成/恢复和删除冲突。

推荐“二选一的运行后端 + 显式一次性导入/导出”。真正同步应作为后续独立项目。

### 6.3 数据访问抽象

按领域定义 repository，由 service 保持业务规则：

- Task/Todo/Plan/Journal/Finance/Timetable/File/Settings repositories。
- API 层只做 Auth、输入验证、调用 service、响应转换。
- SQLite repository 复用现有 SQL；Supabase repository 使用 server client。
- 选择器只存在服务端，不把 `DATA_BACKEND` 暴露为客户端可切换参数。

## 7. Vercel 环境与兼容性

建议环境变量（名称可在实施时确认）：

```text
DATA_BACKEND=supabase
FILE_BACKEND=supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # 仅迁移/受控后台，必要时才配置
NEXT_PUBLIC_APP_URL=https://...
```

本地桌面继续使用 `LEO_*` 路径变量。不要让云部署默认回退 SQLite，以免在临时文件系统悄悄创建“看似成功但会消失”的数据库。

上线前：

- 删除云路径对 `node:sqlite`、`fs.writeFile/readFile`、`os.networkInterfaces` 的运行依赖。
- Route Handlers 保持 Node runtime；不强行改 Edge。
- 替换进程内 SSE；第一版可用 focus refresh，后续 Supabase Realtime。
- 长耗时文件导出/导入不放在单次 Vercel 请求内。
- Calendar Feed 请求加 SSRF 防护、超时、大小和 content-type 限制。
- 配置 Supabase Site URL、正式/Preview callback、密码重置 URL。
- Service Worker 排除 Auth 路径和私有响应；更新 cache version。
- Health 不泄漏绝对路径或 secret。
- Vercel Preview 不能连接生产数据，或必须使用独立 Supabase 项目/分支。

## 8. 分阶段实施计划

### Phase 0：冻结基线与可恢复备份

目标：建立可证明的源数据基线。  
范围：只读审计脚本、备份规范、row count/hash/file manifest。  
验收：备份可打开；所有表/文件有 reconciliation；无业务代码切换。  
风险：复制 WAL 不一致、备份泄露。  
回滚：完全可回滚，无运行时改动。

### Phase 1：Repository 边界与行为测试

目标：让 Route Handler 不再直接绑定 `lib/db.ts`。  
范围：service/repository、输入 schema、SQLite 实现、关键 API 回归测试。  
验收：SQLite 模式 UI 行为与当前一致，build/typecheck 通过。  
风险：隐性业务规则遗漏。  
回滚：保留旧调用路径，按模块回退。

### Phase 2：Supabase schema、RLS 与测试账号

目标：创建目标表、约束、索引、trigger、RLS。  
范围：SQL migrations、seed-free defaults、RLS 测试。  
验收：两账号交叉访问全部失败；service role 迁移可用；无真实数据。  
风险：RLS 漏洞、cascade 误删。  
回滚：仅测试项目可重建；生产迁移须版本化 down/forward fix。

### Phase 3：Auth 与受保护 API

目标：登录、注册、持久 Session、退出、忘记密码。  
范围：Auth 页面、SSR client、middleware、API session helper、默认 settings。  
验收：未登录无法访问私有页面/API；伪造 user_id 无效。  
风险：cookie/redirect/preview URL 错误。  
回滚：云分支回退；本地模式不受影响。

### Phase 4：核心数据迁移

目标：迁 Task/To Do/Plan/Journal/Settings/Progress。  
范围：Supabase repositories、migration dry run/ledger、模块切换。  
验收：counts/hash/关系/RLS/UI 全通过。  
风险：旧 progress 映射、标签双写、离线重复。  
回滚：切回 SQLite；保留迁移 run。

### Phase 5：课程与时区

目标：迁两套课程模型与 occurrence。  
范围：timetable tables、ICS import、Sydney 时区和 DST 测试。  
验收：课程数量、系列、日期、地点、例外与日程显示一致。  
风险：最复杂的时间与唯一键问题。  
回滚：课程模块单独切回 SQLite/read-only。

### Phase 6：Storage、收支与重要文件

目标：迁文件、小票、财务与重要文件。  
范围：private buckets、signed URL、metadata、清理任务。  
验收：hash/size/引用、跨账号隔离、上传预览删除均通过。  
风险：文件缺失、孤儿、权限、Vercel 请求大小。  
回滚：FILE_BACKEND 切 local；不删除本地原件。

### Phase 7：Vercel、PWA 与真实用户试运行

目标：受控上线。  
范围：环境隔离、域名/Auth callback、PWA、监控、备份、限流。  
验收：桌面/手机、登录恢复、离线提示、核心流程、RLS、构建部署通过。  
风险：缓存旧版本、Session、生产环境变量。  
回滚：Vercel 回滚部署 + 后端模式切换；保留 SQLite 快照。

## 9. 最难的三个模块

1. **文件 + 收支 + 重要文件**：二进制与 DB 非原子、现有小票删除会孤儿、Storage/RLS/signed URL 多层权限。
2. **课程/课表/时区**：两套模型、ICS recurrence、例外、本地修改、Sydney DST 和唯一键同时存在。
3. **离线队列与多设备一致性**：当前只支持部分新增，缺乏幂等与冲突模型；不能直接当云同步协议使用。

## 10. 决策建议

- **建议保留 local-first 模式**：是，作为独立部署后端保留，不做第一版双向同步。
- **是否直接一次性全迁 Supabase**：否。按模块波次迁移并保留 SQLite 回滚。
- **下一步最合适的单个任务**：编写“只读迁移预检工具”的规格与测试，它只从 SQLite 快照输出 schema/count/FK/JSON/time/file manifest 和 dry-run 报告，不连接 Supabase、不修改源数据。它会成为后续所有迁移阶段的安全基线。
