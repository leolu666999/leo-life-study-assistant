# Supabase Security Test Results

执行日期：2026-07-11

## 真实远端测试

| 分组 | 数量 | 结果 |
|---|---:|---|
| User A / User B RLS 隔离 | 14 | 全部通过 |
| Personal / Admin 与 Admin API | 19 | 全部通过 |
| Private Storage | 3 | 全部通过 |
| 合计 | 36 | 36/36 通过 |

首次运行有 1 项统计 API 超过 Vitest 默认 5 秒超时，同批的后续统计请求正常通过。这不是权限失败。将远端网络测试超时调整为 20 秒后，完整重跑 36/36 通过。

## 越权与数据完整性

- User B 读取 User A Task/Journal/Expense/File/Timetable/Settings：拒绝。
- User B 更新或删除 User A Task：影响 0 行；高权限复查确认原行未改且未删。
- User B 关联 User A Task/TodoList：复合外键拒绝；高权限复查确认子表无新行。
- 匿名访问业务表：拒绝。
- Personal Account 访问 Admin API：403。
- 匿名访问 Admin API：401。
- Admin Account 使用普通 authenticated client：仍只看自己数据。
- Admin Account 通过 `assertAdminRequest()` 后：可执行最小必要的跨用户读取。
- User B 读取/写入 User A Storage 路径：拒绝；原合成对象内容未改。
- 越权成功：0。
- “请求被拒绝但数据库实际已改”：0。

隔离 production build 还在临时 `3027` 端口完成了真实 HTTP 复验：匿名 `401`、User A `403`、User B `403`、Admin `200`。验证后临时服务已关闭。

## 本地回归

- PGlite schema/RLS/security：43 项。
- SQLite API contract：42 项。
- 默认本地测试合计：85 项。
- 远端测试通过后清理所有合成业务记录。

## Secret 检查

- Git 历史 35 个提交未发现 Supabase token/key/JWT/带密码连接串。
- `.env.supabase-test.local` 权限 `600` 且被 Git 忽略。
- Client Component 与生产浏览器 bundle 不包含 `ADMIN_USER_ID`、`SUPABASE_SECRET_KEY` 或 secret key 值。
- 文档和测试输出不包含完整 secret。
