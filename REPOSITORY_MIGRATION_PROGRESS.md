# Repository Migration Progress

更新时间：2026-07-11

Active backend：`sqlite`

Supabase/Auth/RLS/Storage：未实现、未连接

## 1. 目标结构

```text
Route Handler
  -> Service
    -> Repository Interface
      -> SQLite Repository
        -> existing lib/db.ts helpers
```

`lib/db.ts` 继续负责 SQLite connection、schema migration、seed 和现有 SQL helper。本阶段没有修改 schema、21 张表或 uploads 规则。

## 2. Wave 状态

| Wave | 模块 | 状态 | Route 是否停止直接 import db.ts | Contract coverage |
|---|---|---|---:|---:|
| 1 | Settings | 完成 | 是 | GET/PATCH、默认值、持久化 shape |
| 2 | Tasks/Archive/Progress/Subtasks | 完成 | 是 | CRUD、状态动作、标签、subtasks、进度历史、pin、错误码 |
| 3 | To Do Lists | 完成 | 是 | GET/POST/PATCH、item completion、Schedule 解析、错误码 |
| 4 | Expenses | 完成 | 是 | GET/POST/PATCH/DELETE、币种校验、lastUsedCurrency |
| 5 | Plans/Journal | 完成 | 是 | Plan CRUD、Journal GET/POST、linkedPlanId shape |
| 6 | Timetable/Courses | 完成 | 是 | 空列表、ICS preview/import、occurrence update/cancel、404 |
| 7 | Uploads/Important Files | 完成 | 是 | upload/download、metadata、Important File CRUD、404 |
| 补充 | Offline sync push | 完成 | 是 | create queue result shape、核心 Service 调用 |

## 3. 新增 Repository

- `SettingsRepository`
- `TaskRepository`
- `TodoRepository`
- `FinanceRepository`
- `PlanRepository`
- `JournalRepository`
- `TimetableRepository`
- `FileRepository`

每个接口都有对应 SQLite 实现。接口不暴露 `DatabaseSync` 或 SQL 类型，并接受可选 `RepositoryContext.userId` 作为未来 Auth 注入位置；SQLite 单用户实现当前忽略该值。

## 4. 新增 Service

- `SettingsService`
- `TaskService`
- `TodoService`
- `FinanceService`
- `PlanService`
- `JournalService`
- `TimetableService`
- `FileService`

Route Handler 仍负责 request/body/query 解析、HTTP 状态和响应；Service 不依赖 `NextRequest`/`NextResponse`；Repository 只负责数据访问。

## 5. Backend Selector

- 未设置 `DATA_BACKEND`：使用 SQLite。
- `DATA_BACKEND=sqlite`：使用 SQLite。
- 任意其他值（包括 `supabase`）：明确抛错，不静默 fallback。
- 没有 Supabase repository、SDK 或 stub。

## 6. 尚未迁移的 Route Handler

以下基础设施 API 仍直接 import `lib/db.ts`：

| API | 原因 | 后续建议 |
|---|---|---|
| `GET /api/health` | 需要 SQLite probe 与本机路径，非业务 repository | Phase 2 前建立 SystemHealthService，并收敛公网响应 |
| `GET /api/backup/export` | 跨领域聚合且当前备份不完整 | 单独设计 authenticated BackupService 与完整恢复格式 |

`GET /api/events`、`GET /api/network` 不直接依赖 db.ts，但仍是 local/runtime 基础设施，未在 Phase 1 改造。

## 7. Contract Tests

- 框架：Vitest 3.2.4，Node environment。
- 测试数：42。
- 数据库：每次测试运行使用系统临时目录中的独立 SQLite。
- 每个用例前清空临时业务表和临时 uploads。
- 测试结束关闭连接并删除临时目录。
- 不读取或修改 Application Support 中的真实数据库/uploads。

测试固定了若干非直觉但现存的合同：

- 空标题 Task 默认是“未命名任务”。
- 只提交进度增量时，Task 当前值会更新，但历史行 `currentValueAfter` 保持 `null`。
- pin progress 接口返回整个 ProgressItem 数组。
- Expense PATCH 先校验 currency，再检查 ID 是否存在。

## 8. 数据与兼容性

- API 路径、请求字段、HTTP 状态和 JSON shape 未主动改变。
- SQLite 是唯一 active backend。
- `lib/db.ts` 未删除，现有 SQL 规则仍是唯一实现。
- 数据库 schema 与 uploads 路径/命名不变。
- 已知 `todo_lists.sourcePlanId` orphan 未修改，详见 `MIGRATION_KNOWN_ISSUES.md`。

## 9. Phase 2 Gate

在 contract tests、typecheck、production build、preflight 和真实数据 hash 前后对比全部通过后，可以开始 Phase 2 的 Supabase schema/RLS 设计与测试项目实现。开始 Phase 2 不等于允许迁移真实数据；Auth/RLS 交叉账号测试、完整备份和文件策略仍是 cutover blocker。
