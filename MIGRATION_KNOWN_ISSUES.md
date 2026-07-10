# Migration Known Issues

更新时间：2026-07-11

## KI-001：To Do List 来源计划缺失

| 项目 | 当前值 |
|---|---|
| 严重程度 | High for PostgreSQL migration; Low for current UI |
| 来源表 | `todo_lists` |
| 来源记录 ID | `0edbbb9a-26a4-4b17-95c5-83f5c80d4f73` |
| 逻辑字段 | `sourcePlanId` |
| 缺失目标表 | `plans` |
| 缺失目标 ID | `9a4b7f8a-5514-4b15-a1b1-0de0afe02060` |
| 当前是否修复 | 否；Phase 1 不修改真实数据 |

### 当前影响

当前 SQLite schema 没有为 `todo_lists.sourcePlanId` 声明外键，`rowToTodoList()` 也不会把该字段返回前端。日常 To Do List 的读取、编辑、完成状态和 Schedule 时间识别不依赖目标 Plan，因此目前未发现可见 UI 影响。

该字段用于标识早期 Daily Plan 向 To Do List 的一次性迁移来源，并有唯一约束。缺失目标意味着这条来源关系无法在未来直接升级为严格 PostgreSQL 外键。

### PostgreSQL 迁移处理建议

1. 在 SQLite 快照和迁移 ledger 中原样记录当前 source/target ID。
2. Dry run 将该记录列为显式 exception，禁止静默跳过或创建虚假 Plan。
3. 在真实迁移批准时，若确认目标 Plan 已永久删除且业务不再依赖来源追踪，将云端该行的 `sourcePlanId` 写为 `NULL`，并把旧值保存在仅迁移管理员可读的 mapping/exception ledger。
4. 如果后续找到目标 Plan 的可靠备份，则优先恢复目标并保留关系，而不是置空。
5. 在上述决策完成前，不对当前 SQLite 行执行 UPDATE/DELETE。
