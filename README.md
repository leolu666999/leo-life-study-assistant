# MyAssist

一个本地优先的生活、学习和出发准备管理工具。它把 To Do List、任务、Deadline、进度、收支、重要文件、计划和日记放在同一个轻量网页应用里，适合留学、搬家、备考、项目推进等需要大量本地资料管理的场景。

A local-first life and study dashboard for managing daily to-dos, tasks, deadlines, progress, expenses, important documents, plans, and journals in one lightweight web app. It is designed for study abroad preparation, moving logistics, personal projects, and day-to-day organization.

## 核心特点 / Highlights

- 本地优先：数据库和上传文件默认保存在 macOS 用户数据目录，不进入 App 包。
- 数据不进 Git：`.gitignore` 会排除数据库、备份和上传文件，更新代码不会覆盖个人数据。
- 每日 To Do List：按日期管理每日清单，支持勾选、编辑和从计划页查看。
- 今日日程：自动识别 To Do List 标题中的中英文时间段，与课程一起显示在每日时间轴。
- Task / Deadline：长期任务和明确截止事项分开管理，Deadline 支持倒计时显示。
- 进度追踪：任务可以开启进度条，例如阅读页数、训练次数、百分比目标。
- 收支：支持 21 种主流国际货币，按币种分别统计，并记住最近一次成功保存的货币。
- 首页个性化：可自定义首页标题，支持中英文和 Emoji，也可完全隐藏标题。
- 重要文件：保存护照、签证、学校、住宿、保险、交通等关键文件，可搜索、分类、添加标签和到期日。
- 计划与日记：支持每日、每周、每月计划和简单复盘记录。

- Local-first: the database and uploads live in the macOS user data directory, outside the app bundle.
- Git-safe data: database files, backups, and uploads are ignored by Git, so code updates do not overwrite personal data.
- Daily To Do List: date-based checklists with editing and completion tracking.
- Daily schedule: recognizes time ranges in To Do titles and combines them with courses on a day timeline.
- Task / Deadline: regular tasks and deadline-based items are managed separately; deadlines can show countdowns.
- Progress tracking: optional progress bars for reading pages, training sessions, percentage goals, and custom units.
- Income and expenses: supports 21 major currencies, keeps totals separate by currency, and remembers the currency used by the latest successful entry.
- Home personalization: customize the home title with text or Emoji, or hide it without leaving empty space.
- Important files: store key documents such as passport, visa, school, accommodation, insurance, travel, and banking materials with search, categories, tags, and expiry dates.
- Plans and journals: daily, weekly, and monthly planning plus lightweight reflections.

## 本地数据说明 / Local Data

这个项目默认不会把你的个人资料提交到 GitHub，也不会把真实数据打进 macOS App。MyAssist 为了兼容现有安装，仍使用重命名前的本地数据目录：

This project is configured so personal data is not committed to GitHub:

```text
~/Library/Application Support/Leo的生活学习助手/data/       SQLite database
~/Library/Application Support/Leo的生活学习助手/uploads/    uploaded receipts, images, and documents
~/Library/Logs/Leo的生活学习助手/                            desktop/backend logs
```

旧版本仓库内的 `data/` 和 `uploads/` 会在首次启动时安全复制到上面的用户数据目录。复制只在目标数据库不存在时发生，不会删除旧数据，也不会用空库覆盖已有数据库。

产品名改为 MyAssist 不会重命名、移动或重新创建这些个人数据。

The repository only keeps placeholder folders. Existing legacy `data/` and `uploads/` are copied to the user data directory on first run when needed.

## 运行方式 / Getting Started

### Mac

```bash
npm install
npm run dev
```

然后打开：

Then open:

[http://localhost:3011](http://localhost:3011)

也可以双击 `启动-Mac.command`。

You can also double-click `启动-Mac.command`.

### macOS Desktop App

开发模式：

```bash
npm run desktop:dev
```

构建 `.app`：

```bash
npm run desktop:pack
```

输出位置：

```text
dist/mac-arm64/MyAssist.app
```

构建 `.dmg`：

```bash
npm run desktop:dist
```

输出位置：

```text
dist/MyAssist-0.1.0.dmg
```

桌面 App 会先检查 `http://127.0.0.1:3011/api/health`。如果已有健康后端，就复用它；如果没有后端，会自动启动打包在 App 内的同一套 Next.js 后端。App 只会关闭自己启动的后端，不会结束外部手动启动的服务。

### Windows

```bat
npm install
npm run dev
```

然后打开：

Then open:

[http://localhost:3011](http://localhost:3011)

也可以双击 `启动-Windows.bat`。

You can also double-click `启动-Windows.bat`.

## 常用脚本 / Scripts

```bash
npm run dev      # Start the local development server on port 3011
npm run build    # Build the app
npm run start    # Start the production server on port 3011
npm test         # Run isolated API contract tests
npm run desktop:dev   # Start Electron in development mode
npm run desktop:pack  # Build macOS .app
npm run desktop:dist  # Build macOS .dmg
npm run migration:preflight  # Run the read-only SQLite/uploads migration preflight
npm run test:auth:remote     # Run isolated real Supabase Auth tests
npm run test:transactions:remote  # Verify real PostgreSQL transaction rollback
```

### 迁移预检 / Migration Preflight

在准备数据库迁移前，可以生成只读的 SQLite 与 uploads 基线报告：

```bash
npm run migration:preflight
```

正式迁移准备建议扫描停止写入后生成的 SQLite 快照：

```bash
npm run migration:preflight -- --db "/absolute/path/to/snapshot.db"
```

工具不会调用会自动迁移数据的 `getDb()`，不会修改 SQLite 或 uploads，也不会连接 Supabase。报告写入被 Git 忽略的 `migration-reports/`，只包含表名、计数、ID、匿名摘要和文件 SHA-256，不包含日记正文、财务备注、原始文件名或 Feed URL。

## 文档维护 / Documentation Maintenance

每次新增或修改用户可见功能时，必须在同一批提交中同步更新：

- 设置页中的“使用文档”；
- GitHub `README.md`。

Every user-facing feature change must update both the in-app guide under Settings and this README in the same change set.

## 架构 / Architecture

- 前端：Next.js App Router + React + Tailwind CSS，页面入口复用 `components/leo-app.tsx`。
- 后端：同一个 Next.js 项目内的 `/api/*` 路由，运行在本地 Node.js。核心业务采用 Route Handler → Service → Repository Interface → SQLite Repository 分层。
- 数据库：`node:sqlite`，默认路径 `~/Library/Application Support/Leo的生活学习助手/data/leo_life_study.db`。
- 上传文件：`~/Library/Application Support/Leo的生活学习助手/uploads/`。
- 浏览器入口：`http://localhost:3011`。
- 桌面入口：Electron 无地址栏窗口，加载同一个本地 Next 前端。
- 实时同步：浏览器和桌面端订阅 `GET /api/events` 的 Server-Sent Events；任意写入 API 成功后广播 `data-change`，其他窗口静默重新请求数据库真实状态。
- 日志：`~/Library/Logs/Leo的生活学习助手/desktop.log`。

Repository backend 默认且当前只支持 `sqlite`。如果 `DATA_BACKEND` 设置为未实现的值，应用会明确报错，不会静默回退到本地 SQLite。Phase 1 进度和剩余基础设施路由见 `REPOSITORY_MIGRATION_PROGRESS.md`，已知迁移数据例外见 `MIGRATION_KNOWN_ISSUES.md`。

Phase 2 已增加尚未连接生产环境的 PostgreSQL schema、RLS 与 private Storage policy。21 张业务表都有 owner `user_id`，普通账号按 `auth.uid()` 隔离；独立管理员账号只由 server-only `ADMIN_USER_ID` 判断。详情见 `SUPABASE_RLS_MATRIX.md`、`ADMIN_ARCHITECTURE.md` 和 `SUPABASE_PHASE2_PROGRESS.md`。当前 MyAssist 运行 backend 仍然是 SQLite，没有迁移真实数据。

Phase 2.5 已在 Sydney 隔离 Supabase 测试项目应用两份 migration，并用 User A、User B、Admin Account 完成 36 项真实 Auth/PostgreSQL/RLS/Storage 安全测试。详情见 `SUPABASE_REMOTE_VALIDATION.md`、`SUPABASE_SECURITY_TEST_RESULTS.md` 和 `SUPABASE_PHASE2_5_PROGRESS.md`。这不会切换当前 SQLite backend。

Phase 3 使用双模式过渡：默认 `DATA_BACKEND=sqlite`、`AUTH_REQUIRED=false`，现有本地应用不要求登录，也不会改变当前 SQLite 或 uploads。隔离 Auth 测试模式使用 Supabase Auth + 系统临时目录中的专用空 SQLite；必须同时设置 `TEST_DATABASE=true`、`AUTH_TEST_DATA_ROOT` 和全部 `LEO_*` 测试路径。任一路径指向真实 Application Support、仓库真实数据或临时根目录之外时，应用会 fail closed。详情见 `AUTH_ARCHITECTURE.md`、`SUPABASE_PHASE3_AUTH.md` 和 `AUTH_SECURITY_TEST_RESULTS.md`。

Phase 3 已提供邮箱注册、登录、SSR Cookie Session、退出、忘记密码、重置密码、Auth callback、页面/API 保护和独立 Admin 身份检查。Phase 4 在此基础上增加核心 Supabase Repository；SQLite 模式下仍不会把现有本地数据猜测绑定给任何账号。

Phase 4 核心 Repository 已实现：Settings、Tasks/Progress/Subtasks、To Do、Plans、Journal 和 Expenses 可在 `DATA_BACKEND=supabase`、`AUTH_REQUIRED=true` 时通过当前 Session `user.id` 访问 Supabase，并由 RLS 与 owner-aware 外键隔离。课程、课表、文件、重要文件和真实 Storage 暂未切换；Cloud mode 会明确拒绝 SQLite-only Repository，离线 replay 也会返回 `409`，不会静默回退或重复写入。现有 282 行 SQLite 与 4 个本地文件没有迁移。

Phase 4 详情和 API 状态见 `SUPABASE_PHASE4_REPOSITORIES.md`、`SUPABASE_REPOSITORY_PROGRESS.md` 与 `CLOUD_DATA_ISOLATION_TEST_RESULTS.md`。

Phase 4.5 已为 Task/Progress、Plan/Journal、To Do 与 Finance 的 11 条多表写入流程增加 7 个 PostgreSQL 事务函数。函数使用 `security invoker`，owner 只来自 `auth.uid()`，现有 RLS 与跨用户复合外键继续生效；任一子步骤失败时整笔业务写入回滚。13 项真实远程事务测试与原有测试合计 223/223 通过，partial state 与越权成功均为 0。默认 SQLite 模式、282 行真实数据和 4 个本地文件未改变。详情见 `SUPABASE_TRANSACTION_AUDIT.md`、`SUPABASE_TRANSACTION_RPCS.md` 与 `TRANSACTION_FAILURE_TEST_RESULTS.md`。

安全的环境变量示例见 `.env.example`。`NEXT_PUBLIC_SUPABASE_URL` 与 publishable key 可以进入浏览器；`SUPABASE_SECRET_KEY`、`ADMIN_USER_ID`、数据库密码和 access token 只能留在本机服务端或 CLI，绝不能加 `NEXT_PUBLIC_`，也不能提交到 GitHub。

端口可以通过环境变量调整：

```bash
LEO_PORT=3013 npm run desktop:dev
LEO_PORT=3013 npm run start
```

数据目录也可以通过环境变量调整：

```bash
LEO_APP_DATA_DIR="/path/to/app-data" npm run dev
LEO_DATA_DIR="/path/to/data" LEO_UPLOADS_DIR="/path/to/uploads" npm run dev
```

## 更新方式 / Updating Without Losing Data

如果这个项目已经连接到 GitHub，以后更新代码时：

When this project is connected to GitHub, update the code with:

```bash
git pull
npm install
npm run dev
```

`data/` 和 `uploads/` 不会被 Git 覆盖，所以你的任务、To Do List、账单、小票和重要文件不会因为更新代码而丢失。

`data/` and `uploads/` are ignored by Git, so tasks, to-dos, expenses, receipts, and important files are not overwritten by code updates.

## 备份与恢复 / Backup and Restore

- App 内“设置”页可以导出部分 JSON 数据，但当前导出不包含 To Do、新版课表和文件本体，不能单独用于完整恢复。
- SQLite 数据库文件在 `~/Library/Application Support/Leo的生活学习助手/data/leo_life_study.db`。
- 上传文件在 `~/Library/Application Support/Leo的生活学习助手/uploads/`。
- 恢复时先关闭浏览器/桌面 App 和本地后端，再替换数据库与上传目录。
- 构建或替换新版 `.app` 不会删除用户数据，因为数据不在 `.app` 包内部。

彻底卸载但保留数据：删除 `dist/mac-arm64/MyAssist.app` 或 Applications 中的 App，保留 `~/Library/Application Support/Leo的生活学习助手/`。

彻底删除 App 和用户数据：删除 App 后，再删除：

```text
~/Library/Application Support/Leo的生活学习助手/
~/Library/Logs/Leo的生活学习助手/
```

## 故障排查 / Troubleshooting

- 页面变成裸 HTML：清理 `.next`，确认 `/_next/` 静态资源没有 404，开发模式会自动注销旧 service worker。
- 桌面 App 显示后端启动失败：查看 `~/Library/Logs/Leo的生活学习助手/desktop.log`。
- 端口被占用：确认 `http://127.0.0.1:3011/api/health` 是否健康；如果端口被坏进程占用，关闭该进程或用 `LEO_PORT=其他端口` 启动。
- 两端不同步：确认 `/api/events` 能连接；普通增删改查仍可用，实时连接恢复后会继续收到变更。
- 替换图标：准备 `.icns` 图标后，在 `package.json` 的 `build.mac.icon` 中配置图标路径，再重新运行 `npm run desktop:pack`。

## 隐藏/快捷功能 / Hidden and Quick Features

- 双击首页标题 `MyAssist` 可以打开今日总览。
- To Do List 卡片内部可以滚动查看较多条目，底部淡出效果表示列表还能继续。
- 勾选首页 To Do List 项目时，完成项会移动到列表底部。
- 开启进度追踪的任务可以出现在底部进度条中，点击右侧箭头切换显示的进度。
- 筛选面板未输入条件时，点击空白处可以关闭。

- Double-click the dashboard title `MyAssist` to open today’s overview.
- The To Do List card can scroll internally when it contains many items; the bottom fade indicates more content.
- Completed homepage To Do List items move to the bottom of the list.
- Tasks with progress tracking can appear in the bottom progress bar; use the arrow on the right to switch between tracked items.
- If the filter panel has no active input, clicking outside closes it.

## GitHub 注意事项 / GitHub Notes

项目仓库：[github.com/leolu666999/MyAssist](https://github.com/leolu666999/MyAssist)

请不要手动提交以下内容：

Do not manually commit:

```text
data/
uploads/
.next/
node_modules/
.env*
```

如果需要分享给朋友，只分享 GitHub 仓库或不包含 `data/`、`uploads/` 的压缩包。

When sharing with friends, share the GitHub repository or a zip that excludes `data/` and `uploads/`.
