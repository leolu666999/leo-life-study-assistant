# Supabase Phase 2 Progress

更新时间：2026-07-11

## 已完成

- 两份版本化 migration：业务 schema/RLS 与 private Storage policies。
- 21 张 PostgreSQL 业务表，全部包含 `user_id`。
- 20 条 owner-aware 复合外键，阻止跨用户父子关系。
- `profiles`，不包含 `is_admin`。
- `admin_audit_logs`，普通客户端零 policy。
- 84 条业务 owner policy、4 条 profiles policy、8 条 Storage policy，共 96 条。
- `receipts`、`important-files` 两个 private bucket 设计。
- `ADMIN_USER_ID` / `assertAdmin()` server-only helper。
- 9 个 Admin API 契约；尚未创建 live routes。
- PGlite 真实 PostgreSQL schema/RLS 测试。

## 测试结果

| 测试组 | 数量 | 结果 |
|---|---:|---|
| 现有 SQLite API contract | 42 | 全部通过 |
| PostgreSQL schema/policy/Storage | 10 | 全部通过 |
| User A/User B 普通账号隔离 | 14 | 全部通过 |
| Admin/Personal 双账号与受控高权限 | 19 | 全部通过 |
| 总计 | 85 | 全部通过 |

没有发现越权成功。测试使用内存 PGlite，不连接远程 Supabase，不读取 SQLite 业务正文，也不迁移真实数据。

## 身份结论

- Personal Account 是普通账号，没有管理员权限。
- Admin Account 是唯一管理员身份候选，唯一可信来源是 server-only `ADMIN_USER_ID`。
- Admin Account 在普通 authenticated 查询中仍受 RLS，只能看到自己的普通数据。
- 跨用户访问必须经过未来 `/api/admin/*` 的 `assertAdmin()` 和 server-only service role client。
- profiles 数据、邮箱、姓名、设备和客户端字段都不能提升权限。

## 已知数据例外

SQLite 的 `todo_lists.sourcePlanId` 有一条已知 orphan。本阶段没有修改源数据。真实迁移时进入 reconciliation report，并在批准后将云端 `sourcePlanId` 置 NULL；不能创建虚假 Plan，也不能因此静默中止整个批次。

## 尚未完成

- 未创建或连接远程 Supabase 项目。
- 本机没有 Supabase CLI/Docker；migration 已在 PGlite PostgreSQL 执行，仍需在 Supabase Local 或隔离 Supabase branch 复验。
- 未实现 Supabase SSR browser/server client。
- 未实现注册、登录、退出、忘记密码和 Session refresh。
- 未创建 live `/api/admin/*` 路由或 Admin Dashboard。
- 未创建 service-role client。
- 未迁移 SQLite 数据或文件。
- 未切换 `DATA_BACKEND`。

## Auth 阶段 Gate

可以进入下一阶段的 Auth 基础设施实现，但只能使用测试账号和隔离环境。进入 production 或迁移真实数据前仍必须：

1. 在 Supabase Local/隔离 branch 重新执行 migrations 和三账号测试。
2. 实现 `@supabase/ssr` cookie session 和 server `getUser()`。
3. 验证 Admin API 401/403/成功路径。
4. 扫描浏览器 bundle，确认没有 `ADMIN_USER_ID` 或 service role key。
5. 修复完整备份/恢复缺口。
