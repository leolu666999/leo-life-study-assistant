# Supabase RLS 权限矩阵

更新时间：2026-07-11

## 1. 统一规则

所有 21 张业务表都启用并强制 RLS。每张表有四条普通用户 policy：

```sql
SELECT USING      ((select auth.uid()) = user_id)
INSERT WITH CHECK ((select auth.uid()) = user_id)
UPDATE USING      ((select auth.uid()) = user_id)
       WITH CHECK ((select auth.uid()) = user_id)
DELETE USING      ((select auth.uid()) = user_id)
```

普通业务客户端永远使用 authenticated client。唯一管理员账号在普通 API 中也使用 authenticated client，因此仍只能访问管理员账号自己的普通业务数据。

“Admin controlled server API”表示：请求先验证登录，再由 `assertAdmin()` 比较当前用户 UUID 与 server-only `ADMIN_USER_ID`，通过后服务器才使用高权限 client。它不是一条管理员 RLS policy，也不会让管理员浏览器绕过 RLS。

## 2. 21 张业务表

| 表 | Anonymous SELECT | Auth SELECT own | Auth SELECT other | INSERT own | INSERT other | UPDATE own | UPDATE other | DELETE own | DELETE other | Admin controlled server API |
|---|---|---|---|---|---|---|---|---|---|---|
| `tasks` | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 可按目标用户读取/维护 |
| `subtasks` | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 可；复合 FK 保证 task owner 一致 |
| `tags` | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 可按目标用户读取/维护 |
| `task_tags` | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 可；task/tag 必须同 owner |
| `plans` | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 可按目标用户读取/维护 |
| `plan_items` | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 可；plan/task 必须同 owner |
| `todo_lists` | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 可按目标用户读取/维护 |
| `todo_list_items` | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 可；TodoList 必须同 owner |
| `progress_items` | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 仅迁移兼容/排障 |
| `task_progress_entries` | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 可；Task 必须同 owner |
| `courses` | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 可按目标用户读取/维护 |
| `class_sessions` | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 可；Course 必须同 owner |
| `assignments` | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 可；Course/Task 必须同 owner |
| `timetable_sources` | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 可；Feed URL 只返回最小必要信息 |
| `timetable_courses` | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 可；Source 必须同 owner |
| `course_occurrences` | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 可；Course/Source 必须同 owner |
| `journal_entries` | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 可；高敏内容需审计和最小返回 |
| `expenses` | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 可；财务数据需审计和最小返回 |
| `uploaded_files` | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 只返回 metadata/signed URL |
| `important_files` | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 可；File 必须同 owner |
| `settings` | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 允许 | 拒绝 | 可排障；管理员自身设置保持独立 |

维护者的 Personal Account 完全按上述普通用户列处理。维护者的 Admin Account 在普通 API 中也按上述普通用户列处理。

## 3. Profiles

`profiles` 有四条 own-data policy，普通用户只能读写自己的 display name。表中没有 `is_admin` 字段；即使 profiles 被错误修改，也不能产生管理员权限。

| 操作 | Anonymous | Own profile | Other profile | Admin controlled server API |
|---|---|---|---|---|
| SELECT | 拒绝 | 允许 | 拒绝 | 可读取最小用户概览 |
| INSERT | 拒绝 | 允许 | 拒绝 | 可用于修复 |
| UPDATE | 拒绝 | 允许 | 拒绝 | 可用于修复 |
| DELETE | 拒绝 | 允许 | 拒绝 | 仅高风险受控操作 |

## 4. Admin Audit Logs

`admin_audit_logs` 启用并强制 RLS，但没有 anon/authenticated policy，且显式撤销普通客户端权限。只有 server-side service role 可写入或读取。

每条高风险操作至少记录：管理员 UUID、目标用户 UUID、action、entity type、entity ID、metadata、result 和时间。管理员不能通过普通 authenticated client 篡改审计日志。

## 5. Storage

两个 bucket 均为 private：

- `receipts`
- `important-files`

路径固定为：

```text
{user_id}/{file_id}/{sanitized_name}
```

两个 bucket 各有 SELECT/INSERT/UPDATE/DELETE 四条 policy，共 8 条。策略同时检查 bucket ID 与路径第一段等于 `auth.uid()`。

| 操作 | Anonymous | Own path | Other path | Admin browser | Admin server API |
|---|---|---|---|---|---|
| SELECT | 拒绝 | 允许 | 拒绝 | 不直接绕过 | 可生成短时 signed URL |
| INSERT | 拒绝 | 允许 | 拒绝 | 不直接绕过 | 受控修复时允许 |
| UPDATE | 拒绝 | 允许 | 拒绝 | 不直接绕过 | 受控修复时允许 |
| DELETE | 拒绝 | 允许 | 拒绝 | 不直接绕过 | 高风险操作，必须写审计日志 |

## 6. Policy 数量

- 21 张业务表：84 条。
- `profiles`：4 条。
- Storage：8 条。
- `admin_audit_logs`：0 条普通客户端 policy，默认拒绝。
- 总计：96 条实际 policy。
