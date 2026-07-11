# 独立管理员账号架构

更新时间：2026-07-11

## 1. 为什么维护者使用两个账号

项目维护者本人同时有两种完全不同的身份：

1. **Personal Account**：日常使用 MyAssist，保存个人任务、课程、记账、日记和文件。
2. **Admin Account**：系统运维，进入 Admin Dashboard、查看全站异常、跨用户排障和执行受审计的管理操作。

两者必须是两个独立 Supabase Auth user UUID。邮箱、姓名、设备、IP 或“账号属于维护者”都不会自动关联权限或合并数据。

Personal Account 与所有普通用户完全相同，只能访问 `auth.uid() = user_id` 的数据。Admin Account 如果打开普通 MyAssist 页面，也只看到 Admin Account 自己的数据空间。

## 2. 唯一管理员来源

第一版只有一个管理员，不建立 RBAC 表，不在 profiles 保存 `is_admin`。

```text
ADMIN_USER_ID=<Admin Account 的 Supabase Auth UUID>
```

约束：

- 只使用 server-only `ADMIN_USER_ID`。
- 不使用 `NEXT_PUBLIC_` 前缀。
- 不按邮箱判断管理员。
- 不接受请求 body/query/cookie 中的 `isAdmin=true`。
- 普通个人账号不会被自动提升。
- 缺失或不是合法 UUID 时，服务端应 fail closed。

实现位于 `lib/auth/admin.ts`，文件通过 `server-only` 防止进入 Client Component；纯逻辑位于 `admin-core.ts` 便于隔离测试。

## 3. assertAdmin 流程

```text
Admin browser
  -> /api/admin/*
    -> server Supabase Auth client: getUser()
      -> no user: 401
      -> user.id != ADMIN_USER_ID: 403
      -> assertAdmin(user) passed
        -> create server-only service-role client
          -> perform minimal cross-user operation
          -> write admin_audit_logs when action is sensitive
          -> return minimal response
```

浏览器永远不接触 service role key。前端隐藏菜单只是体验，不是权限边界。

## 4. 普通 API 与 Admin API

| 场景 | Client | RLS | 可见范围 |
|---|---|---|---|
| Personal Account 调 `/api/tasks` | authenticated | 生效 | Personal 自己 |
| Admin Account 调 `/api/tasks` | authenticated | 生效 | Admin 自己 |
| 普通用户调 `/api/admin/*` | 不创建高权限 client | 返回 403 | 无 |
| 匿名调 `/api/admin/*` | 无 session | 返回 401 | 无 |
| Admin Account 调 `/api/admin/*` | 先 assertAdmin，后 server-only service role | 受控绕过 | 该接口声明的最小范围 |

管理员账号不会获得一条“管理员 RLS policy”。这样可避免管理员在普通页面或普通 API 中意外混入其他用户数据。

## 5. Admin API

Phase 2.5 已实现两个受保护的只读路由：

- `GET /api/admin/users/[userId]/tasks`
- `GET /api/admin/system/stats`

以下契约仍留待 Phase 3：

- `GET /api/admin/users`
- `GET /api/admin/users/[userId]`
- `GET /api/admin/users/[userId]/todo`
- `GET /api/admin/users/[userId]/expenses`
- `GET /api/admin/users/[userId]/journal`
- `GET /api/admin/users/[userId]/timetable`
- `GET /api/admin/users/[userId]/files`

已实现路由先验证 Supabase access token，再调用 `assertAdminRequest()`，最后才构造高权限 client。Phase 3 必须把同样的顺序应用到剩余路由。

不允许以下实现：

- 从 URL 参数决定“当前管理员”。
- 根据目标 `userId` 是否等于某值决定权限。
- 在普通 Repository 中注入 service role client。
- 让普通业务 API 接受 `bypassRls`。
- 在 Client Component import admin helper。

## 6. Service Role 生命周期

高权限 client 只能在 server-only 模块按请求创建或安全复用。隔离测试项目使用新式 `SUPABASE_SECRET_KEY`，不使用旧版 service-role key。

必须保证：

- 不出现在 `NEXT_PUBLIC_*`。
- 不写入响应、日志、错误详情或 source map。
- 不放入 React state、localStorage、IndexedDB 或 Service Worker。
- 不作为参数传给客户端。
- Preview/Production 使用不同项目和密钥。
- 轮换后旧密钥立即失效。

## 7. 管理员审计

`admin_audit_logs` 对普通客户端零 policy。高风险操作遵循：

1. `assertAdmin()`。
2. 写入 `result=started` 的审计记录。
3. 二次确认 token/确认文本校验。
4. 执行管理操作。
5. 更新或追加 succeeded/failed 结果和非敏感 metadata。

不得把日记正文、财务备注、原文件名、token 或 service role key写入 metadata。

建议 action：

- `disable_user`
- `delete_user`
- `delete_entity`
- `repair_sync`
- `restore_data`
- `create_signed_file_url`

## 8. Admin Dashboard 后续结构

第一版 Dashboard 可包含：

- 用户列表与账号状态。
- 单用户数据量概览。
- API 错误与同步失败。
- Storage metadata/对象不一致。
- 课程导入异常。
- 审计日志。

默认列表不显示日记正文、财务备注或文件内容。进入高敏详情需要显式操作并记录审计。

## 9. 双账号验收

- Personal Account 的 UUID 不等于 `ADMIN_USER_ID`。
- Personal 访问 Admin API 返回 403。
- Admin 访问 Admin API 通过。
- Admin 访问普通 API 仍只见自己的数据。
- Admin 只有在受控 server API 中才能跨用户。
- 两个账号的 settings、tasks、files 等不合并。
- 姓名、邮箱相似和同设备不会改变权限。

PGlite PostgreSQL 安全测试已经覆盖上述核心行为；接入真实 Supabase Auth 后仍需使用三个真实测试账号重复执行。
