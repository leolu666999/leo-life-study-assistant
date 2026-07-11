# Supabase Phase 2.5 Progress

更新日期：2026-07-11

## 已完成

- Supabase CLI `2.109.1` 作为 dev dependency 固定。
- 已 link 到隔离项目 `my assist-test`。
- Storage migration 改为只管理 bucket 与 Policy，不改 Supabase 托管表所有权/授权。
- Dry run 只识别两份版本化 migration。
- 两份 migration 已成功应用到远端测试项目。
- PostgreSQL catalog 已验证 21 表、20 复合外键、96 Policy 与 RLS。
- 创建 User A、User B、Admin Account 三个隔离测试账号。
- 新增 server-only Supabase auth/admin client。
- 新增受 `assertAdminRequest()` 保护的统计和指定用户 Task 读取 API。
- 真实远端安全测试 36/36 通过。
- 远端合成业务数据和 Storage object 已清理。

## 保持不变

- `DATA_BACKEND` 未切换，MyAssist 仍使用 SQLite。
- 未迁移 282 行本地数据。
- 未上传 4 个本地文件。
- 未部署 Vercel，未启用 production 账号或注册。
- 未实现完整 Admin Dashboard。

## Phase 3 Gate

可以进入 Phase 3 Auth，但仍只能使用隔离测试项目。下一阶段应实现：

1. `@supabase/ssr` cookie session。
2. 注册、登录、退出、忘记密码。
3. 页面与 Route Handler 的统一 session 保护。
4. 其余 Admin API 与 Admin Dashboard。
5. 密钥轮换、日志脱敏与部署环境分离。

仍不得迁移真实 SQLite/uploads，直到 Auth、RLS、备份恢复和用户验收全部完成。
