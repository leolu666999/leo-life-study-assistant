# Supabase Remote Validation

验证日期：2026-07-11

## 目标环境

- Project name：`my assist-test`
- Project ref：`xjpvqvtnyaurcdraqxmt`
- Region：Oceania / Sydney (`ap-southeast-2`)
- 用途：隔离开发与安全测试，非 production
- 验证前状态：Healthy，migration history 为空

## 凭据边界

- CLI access token 由 `supabase login` 保存在 macOS 原生凭据存储。
- Publishable/secret key 由已登录 CLI 直接写入本机 `.env.supabase-test.local`。
- 本地 env 文件权限为 `600`，且被 `.env*` Git 规则忽略。
- 测试使用新式 publishable/secret key，没有使用旧版 `service_role` key。
- 报告、日志、Git 与浏览器 bundle 均不包含完整 key、token、密码、测试邮箱或账号 UUID。

## Migration 执行

CLI 版本固定为 `2.109.1`。先执行 `supabase db push --dry-run`，只列出：

1. `202607110001_phase2_schema_rls.sql`
2. `202607110002_private_storage_policies.sql`

正式 `db push` 成功应用两份 migration。Docker 缺失警告只影响本地 catalog cache，不影响远端 migration；`supabase migration list` 已确认两个版本的 local/remote 记录一致。

## 远端 PostgreSQL Catalog 结果

| 检查项 | 实际值 | 预期 |
|---|---:|---:|
| 业务表 | 21 | 21 |
| 非空 `user_id` | 21 | 21 |
| owner-aware 复合外键 | 20 | 20 |
| 启用 RLS 的业务表 | 21 | 21 |
| Force RLS 业务表 | 21 | 21 |
| 业务表 Policy | 84 | 84 |
| Profiles Policy | 4 | 4 |
| Storage Policy | 8 | 8 |
| Admin audit client Policy | 0 | 0 |
| 私有 bucket | 2 | 2 |
| 已应用 migration | 2 | 2 |

## 账号与清理

创建 3 个合成测试账号：User A、User B、Admin Account。Admin UUID 仅保存为 server-only `ADMIN_USER_ID`。

测试后远端只保留：

- Auth users：3
- Profiles：3
- Settings：12（每个账号 4 条默认设置）

所有合成 Task、To Do、Journal、Expense、Timetable、file metadata、Storage object 和 admin audit test row 已清理为 0。没有上传本地真实文件。
