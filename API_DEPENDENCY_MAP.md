# API 与数据访问依赖图

审计结论：`app/api` 下有 **34 个 Route Handler 文件、49 个方法端点**。全部使用 Node runtime，全部直接或间接依赖本地单用户数据，当前无 Auth、Session、CSRF/Origin 边界或用户所有权校验。

## 1. 总体调用链

```text
LeoApp client component
  -> same-origin /api/*
    -> Route Handler
      -> lib/db.ts (DatabaseSync / SQLite)
      -> lib/realtime.ts (process-local EventEmitter)
      -> local filesystem / OS network APIs (部分路由)
```

响应主要直接返回实体 JSON。写操作通常使用 `mutationResponse()`，在返回 JSON 前广播 `data-change`；没有统一错误模型、schema validation 或事务边界层。

## 2. 端点清单

### 2.1 任务、进度与归档

| 方法与路径 | 输入 | 输出 | 数据表/依赖 |
|---|---|---|---|
| `GET /api/tasks` | 无 | 活跃 Task 数组，含 subtasks/progress | `tasks`, `subtasks`, `task_progress_entries` |
| `POST /api/tasks` | Task JSON：标题、类型、状态、日期、标签、提醒、进度、subtasks 等 | 新建 Task，201 | `tasks`, `subtasks`, `tags`, `task_tags` |
| `PATCH /api/tasks/[id]` | Task 部分字段 | 更新后的 Task | 同上；可重建 subtasks/标签关系 |
| `DELETE /api/tasks/[id]` | path `id` | `{ok:true}` | 删除 `tasks`；外键级联 subtasks/progress/task_tags/plan_items |
| `POST /api/tasks/[id]/complete` | path `id` | Task | `tasks`；状态、完成时间、固定进度状态 |
| `POST /api/tasks/[id]/archive` | path `id` | Task | `tasks` |
| `POST /api/tasks/[id]/restore` | path `id` | Task | `tasks` |
| `GET /api/archive` | 无 | 包含归档/完成范围的 Task 数组 | `tasks` 及子表 |
| `GET /api/tasks/[id]/progress-entries` | path `id` | 进度历史数组 | `task_progress_entries` |
| `POST /api/tasks/[id]/progress-entries` | `amountDelta`、`currentValue`、`durationMinutes`、`note` | 更新后的 Task，201 | `task_progress_entries`, `tasks` |
| `PATCH /api/subtasks/[id]` | `completed` | Subtask | `subtasks` |
| `GET /api/progress` | 无 | Task 映射后的 ProgressItem 数组 | 主要 `tasks`；旧 `progress_items` 兼容迁移 |
| `POST /api/progress` | 旧 Progress 表单 | 新建/更新 task-backed progress | `tasks`, `tags`, `task_tags` |
| `PATCH /api/progress/[id]` | 当前值/目标/单位等 | ProgressItem | `tasks` |
| `POST /api/progress/[id]/pin` | path `id` | 被固定的 ProgressItem | `tasks`，全表互斥更新 `pinnedToBottom` |

迁云注意：所有写入都必须从服务端 Session 注入 `user_id`；按 ID 操作必须同时匹配 `.eq('user_id', user.id)`，不能只依赖 RLS 后再返回“成功”。固定进度的互斥更新应做成事务/RPC。

### 2.2 To Do 与计划

| 方法与路径 | 输入 | 输出 | 数据表/依赖 |
|---|---|---|---|
| `GET /api/todo-lists` | 无 | To Do List 数组及 items | `todo_lists`, `todo_list_items` |
| `POST /api/todo-lists` | 标题、日期、notes、itemDrafts | 新建列表，201 | 两张 To Do 表；解析自然语言时间 |
| `PATCH /api/todo-lists/[id]` | 列表字段与 itemDrafts | 更新后的列表 | 更新容器；删除后重建/更新 items 与日程字段 |
| `PATCH /api/todo-list-items/[id]` | `completed` | 更新后的 item | `todo_list_items` |
| `GET /api/plans` | 无 | Plan 数组及关联 Task | `plans`, `plan_items`, `tasks` |
| `POST /api/plans` | title/type/date range/reflection/taskIds/itemDrafts | Plan，201 | `plans`, `plan_items`，可能创建任务和 journal |
| `PATCH /api/plans/[id]` | Plan 部分字段和 items | Plan | `plans`, `plan_items`, `tasks`, `journal_entries` |
| `DELETE /api/plans/[id]` | path `id` | `{ok:true}` | 主动删关联 journal，再删 plan；`plan_items` 级联 |

现状缺口：没有删除 To Do List/item 的独立 API；完成状态以外的 item 编辑依赖整个列表 PATCH。迁云时应先保持契约，再逐步细化，避免前端同时大改。

### 2.3 课程与日程

| 方法与路径 | 输入 | 输出 | 数据表/依赖 |
|---|---|---|---|
| `GET /api/courses` | 无 | 旧 Course 数组及 sessions/assignments | `courses`, `class_sessions`, `assignments` |
| `POST /api/courses` | 任意 | 410，旧手动添加已停用 | 不写库 |
| `GET /api/timetable` | query `from`, `to`, `includeCancelled` | `{sources,courses,occurrences}` | `timetable_sources`, `timetable_courses`, `course_occurrences` |
| `POST /api/timetable/import/preview` | multipart ICS/文本/Feed URL、学期、年份、时区；或 JSON | `TimetableImportPreview` | `ical.js`, `rrule`; 可服务器请求外部 URL；预览不写库 |
| `POST /api/timetable/import/confirm` | 完整 preview JSON | 导入结果，201 | 三张 timetable 表 |
| `PATCH /api/timetable/occurrences/[id]` | `patch`、`scope` | occurrence | `course_occurrences`，支持单次/系列更新 |
| `DELETE /api/timetable/occurrences/[id]` | query `scope` | 取消后的 occurrence | 软取消/系列取消，不物理删除 |

公网风险：Preview 的 Feed URL 是服务端任意出站请求入口，必须限制 `https`、DNS/IP、重定向、响应大小和超时；`feedUrl` 本身需私有化/RLS。导入确认必须服务端重新验证数据归属，不应信任客户端 preview 中的 source/course IDs。

### 2.4 日记、收支、设置

| 方法与路径 | 输入 | 输出 | 数据表/依赖 |
|---|---|---|---|
| `GET /api/journal` | 无 | JournalEntry 数组 | `journal_entries` |
| `POST /api/journal` | date/source/content/linkedPlanId | JournalEntry，201 | `journal_entries` |
| `GET /api/expenses` | 无 | Expense 数组，附小票元数据 | `expenses`, `uploaded_files` |
| `POST /api/expenses` | type/title/amount/currency/category/date/merchant/payment/notes/receiptFileId | Expense，201 | `expenses`, `uploaded_files`, `settings.lastUsedCurrency` |
| `PATCH /api/expenses/[id]` | Expense 部分字段 | Expense | 同上 |
| `DELETE /api/expenses/[id]` | path `id` | `{ok:true}` | 仅删 `expenses`；当前不清理小票文件 |
| `GET /api/settings` | 无 | `{lastUsedCurrency,homeTitle,showHomeTitle}` | `settings` |
| `PATCH /api/settings` | home title/show 与受控设置 | AppSettings | `settings` |

日记内容、财务和设置均为私有数据。金额输入目前只做应用层币种校验；目标库要加 `amount >= 0`、currency code 约束。设置 API 应使用当前用户的复合键，不能允许客户端提交任意用户 ID。

### 2.5 文件与重要文件

| 方法与路径 | 输入 | 输出 | 数据表/依赖 |
|---|---|---|---|
| `POST /api/upload` | multipart `file`，可选多态关联字段 | uploaded file metadata，201 | 本地 `uploadsDir`、`uploaded_files`、内存 Buffer |
| `GET /api/uploads/[id]` | path `id` | 原始文件二进制 | `uploaded_files` + 本地文件读取 |
| `GET /api/important-files` | 无 | ImportantFile 数组与文件元数据 | `important_files`, `uploaded_files` |
| `POST /api/important-files` | title/category/tags/notes/expiryDate/fileId | ImportantFile，201 | 两表关联 |
| `PATCH /api/important-files/[id]` | 业务元数据 | ImportantFile | `important_files` |
| `DELETE /api/important-files/[id]` | path `id` | `{ok:true}` | 删除业务记录；无引用时删 file metadata 和磁盘文件 |

公网风险：当前上传没有服务端文件大小、MIME、扩展名、恶意内容或配额校验；下载只凭 UUID，无 Auth；`storedName` 直接参与路径拼接，虽由服务端生成但仍应使用规范化 object path。迁云后优先使用短时 signed upload/download URL 或受控服务端路由。

### 2.6 同步、实时、健康与备份

| 方法与路径 | 输入 | 输出 | 数据/系统依赖 |
|---|---|---|---|
| `POST /api/sync/push` | `deviceId` + IndexedDB queue items | 每项 localId/serverId/status | 按类型创建 To Do/Task/Expense/Journal；无持久幂等表 |
| `GET /api/events` | SSE | connected、heartbeat、data-change | 进程内 EventEmitter |
| `GET /api/health` | 无 | ok、端口及本地绝对路径 | SQLite probe、数据库/上传/日志路径 |
| `GET /api/network` | 无 | 局域网 IPv4 与访问地址 | `os.networkInterfaces()` |
| `GET /api/backup/export` | 无 | 下载聚合 JSON；当前遗漏 To Do 与新版 timetable 数据 | 多张业务表、settings、file metadata、绝对路径 |

这些是云迁移的高风险接口：

- `/api/sync/push` 必须用 `(user_id, device_id, local_id)` 唯一幂等表，且逐项事务化。
- SSE 应换 Supabase Realtime、短轮询或按需刷新；不建议在 Vercel 保留进程内长连接。
- Health 只返回通用状态与 request ID，不返回文件系统路径。
- Network 路由仅保留在 desktop/local mode，云端禁用。
- Backup 必须鉴权、限流、审计；当前导出遗漏 `todo_lists`、`todo_list_items`、`timetable_sources`、`timetable_courses`、`course_occurrences` 等表，且不含文件二进制，不能作为完整灾难恢复备份。

## 3. 数据访问 helper 对照

`lib/db.ts` 导出的 helper 大致分为：

- 设置：`getAppSettings`, `updateAppSettings`。
- 任务：`createTask`, `getTask`, `listTasks`, `updateTask`, `setTaskStatus`, `deleteTask`, subtasks/tags/progress helpers。
- To Do：`listTodoLists`, `getTodoList`, `createTodoList`, `updateTodoList`, completion helper。
- 计划：`listPlans`, `createPlan`, `updatePlan`, `deletePlan`。
- 课程：旧课程查询/创建 helper；课表 source/course/occurrence 查询、导入、编辑、取消。
- 日记、收支、重要文件、上传元数据：各自 CRUD 子集。
- 导出：`exportBackup()` 聚合多模块。

该文件既做 schema migration 又做业务查询。建议先抽出接口而不改 API 契约：

```ts
interface TaskRepository { /* task methods */ }
interface TodoRepository { /* todo methods */ }
interface FinanceRepository { /* expense methods */ }
interface TimetableRepository { /* timetable methods */ }
interface FileRepository { /* metadata methods */ }
interface SettingsRepository { /* settings methods */ }
```

Route Handler 调 service，service 从可信 Session 获取 `userId` 并调用 repository。SQLite 和 Supabase 分别实现 repository；业务层不接受客户端传来的 owner ID。

## 4. 前端依赖与迁云兼容性

- 初始加载会并发发起约 11 个 GET；迁云后可保留，但要考虑 RLS 下的查询数与延迟，必要时用聚合 dashboard endpoint。
- `EventSource('/api/events')` 触发全量刷新，云端可改 Supabase Realtime 后做模块级失效，或第一版使用窗口 focus + 手动刷新。
- 图片 `<img src="/api/uploads/{id}">` 和下载链接依赖 cookie 鉴权；若改 signed URL，前端需要异步获取并处理过期。
- 离线队列只覆盖“新增”，不覆盖 PATCH/DELETE；不能宣传为完整离线同步。Supabase 上线时必须决定继续推自有 `/api/sync/push`，还是实现真正的同步协议。
- Service Worker 当前不缓存 `/api`，这是正确基础；Auth 回调、登录和重置页面也应明确 network-only。

## 5. API 迁移顺序

1. 增加统一 Auth/session helper 与请求校验，不先改响应结构。
2. 建 repository/service 层，以 SQLite 实现通过回归测试固定现有行为。
3. 为 Supabase 实现 read path，按模块进行影子校验。
4. 切换写 path，并加入幂等键、事务/RPC、审计日志。
5. 文件接口迁 Storage，最后移除云端 filesystem 依赖。
6. 替换 SSE、收敛 health/network/backup。

每一步都应保留原 API 的客户端返回形状，避免数据库迁移、Auth、前端重构同时发生。
