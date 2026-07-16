# MyAssist

一个本地优先的生活、学习和出发准备管理工具。它把 To Do List、任务、Deadline、进度、收支、重要文件、计划和日记放在同一个轻量网页应用里，适合留学、搬家、备考、项目推进等需要大量本地资料管理的场景。

A local-first life and study dashboard for managing daily to-dos, tasks, deadlines, progress, expenses, important documents, plans, and journals in one lightweight web app. It is designed for study abroad preparation, moving logistics, personal projects, and day-to-day organization.

## 核心特点 / Highlights

- 本地优先：数据库和上传文件默认保存在 macOS 用户数据目录，不进入 App 包。
- 公开产品首页：未登录访客可在悉尼大学、悉尼海港大桥和悉尼歌剧院高清实景轮播中了解任务、日程、收支和文件功能，再从右上角登录或注册；私人页面仍受 Auth 保护。
- 数据不进 Git：`.gitignore` 会排除数据库、备份和上传文件，更新代码不会覆盖个人数据。
- 每日 To Do List：按日期管理每日清单，支持勾选、编辑和从计划页查看。
- 统一日程：侧边栏“日程”同时管理课程和生活安排；可粘贴活动文字或上传截图，确认日期、时间和地点后自动加入 Calendar 与当天 To Do List。
- 自然语言时间：To Do List 标题中的中英文时间段会自动进入日程，例如“早上八点到十点 Coffee chat”。
- 课表日历：日、周视图使用时间轴，月视图使用周一到周日的日历网格，并按悉尼时间显示每节课。
- Task / Deadline：长期任务和明确截止事项分开管理，Deadline 支持倒计时显示。
- 统一计数进度：任务编辑器把“待办 / 计数 / 清单”、数字和提醒排成一行；计数使用当前值/目标值，清单按完成条目数自动同步，不再要求选择进度类型或单位。
- 统一编辑器圆角：任务、截止事项、计数、To Do List 和计划弹窗中的输入、选择与功能框统一使用标题输入框的胶囊圆角。
- 清单自动计次：清单任务开启计次进度后，已完成数和目标值会根据有效清单条目自动同步。
- 收支：支持 21 种主流国际货币，按币种分别统计，并记住最近一次成功保存的货币。
- 快速局部更新：公网新增、编辑、完成、恢复或删除 Task、Deadline、进度、To Do、计划、日记、收支和重要文件后，直接使用保存结果更新当前页面，不再重新请求整套应用数据。只有课表批量导入或批量范围修改会做必要的完整课表校验。
- 首页个性化：可自定义首页标题，支持中英文和 Emoji，也可完全隐藏标题。
- 文件与纯文档：可上传护照、签证和合同，也可创建账号私有的纯文字文档保存地址、链接与备忘信息。两者都支持搜索、分类和标签。
- 计划与日记：支持每日、每周、每月计划和简单复盘记录。

- Local-first: the database and uploads live in the macOS user data directory, outside the app bundle.
- Git-safe data: database files, backups, and uploads are ignored by Git, so code updates do not overwrite personal data.
- Daily To Do List: date-based checklists with editing and completion tracking.
- Unified schedule: combines courses and daily activities, recognizes pasted text or screenshots, and adds confirmed events to both the calendar and that day's To Do List.
- Natural-language time: time ranges written in To Do titles automatically appear on the daily schedule.
- Task / Deadline: regular tasks and deadline-based items are managed separately; deadlines can show countdowns.
- Progress tracking: optional progress bars for reading pages, training sessions, percentage goals, and custom units.
- Income and expenses: supports 21 major currencies, keeps totals separate by currency, and remembers the currency used by the latest successful entry.
- Home personalization: customize the home title with text or Emoji, or hide it without leaving empty space.
- Files and text documents: upload passports, visas, contracts and images, or create account-private text documents for addresses, links and notes. Both support search, categories and tags.
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
npm run test:storage:remote  # Run isolated private Storage and file lifecycle tests
npm run test:transactions:remote  # Verify real PostgreSQL transaction rollback
npm run test:timetable:remote     # Verify real Cloud timetable isolation/import
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
- GitHub `README.md`；
- 未登录用户看到的产品首页及其他展示功能的页面文案。

只更新与本次改动有关的说明，不把尚未完成的功能写成已经可用。功能实现、应用内说明和对外展示必须保持一致。

Every user-facing feature change must update the in-app guide, this README, and any public feature-description surfaces in the same change set. Documentation must describe only functionality that is actually available.

## 首页图片来源 / Landing Image Credits

公开首页使用以下 Wikimedia Commons 原图，并在本地压缩为高质量 WebP 供网页加载：

- [University of Sydney's Main Quadrangle](https://commons.wikimedia.org/wiki/File:University_of_Sydney%27s_Main_Quadrangle.jpg)，Jason Tong，CC BY-SA 3.0；
- [Sydney harbour bridge new south wales](https://commons.wikimedia.org/wiki/File:Sydney_harbour_bridge_new_south_wales.jpg)，Adam.J.W.C.，CC BY 3.0；
- [Sydney opera house 2010](https://commons.wikimedia.org/wiki/File:Sydney_opera_house_2010.jpg)，Jacques Grießmayer，CC BY 3.0。

## Vercel Preview 访问 / Preview Access

Vercel Preview 部署用于隔离 Supabase 测试项目。项目级 Vercel SSO Deployment Protection 已关闭，普通访客打开公网链接会直接进入 MyAssist 自己的登录/注册页面，而不是 Vercel 登录页。应用安全仍由 MyAssist 的 Supabase Auth、RLS、server-only Admin API 和 private Storage 策略负责。

Supabase Auth 的 Site URL 使用 `https://myassist-test.vercel.app`。允许的邮件回调包含 `http://localhost:3011/**`、`http://127.0.0.1:3011/**`、稳定 Vercel 域名和当前 Vercel 预览域名模式；邮箱确认与密码重置都应回到 `/auth/callback`，不应跳到 `localhost:3000`。

Cloud 文件仍保存在 private Supabase Storage。图片缩略图和预览通过 MyAssist 同源 `/api/private-files/[id]` 受保护接口加载：服务端直接读取当前请求的登录 Session、核对当前账号与文件所有者，再以内联方式返回图片；该动态接口强制不缓存，非登录用户或其他账号不能访问。

`.vercelignore` 中的本地 `data`、`uploads` 等目录使用根目录锚定规则，只排除真实本地数据，不会误删 `app/api/uploads` 或管理员 data API 等同名源码目录。

所有登录后的私人 API 响应均标记为 private/no-store，并按 Cookie 与 Authorization 区分，避免同一设备切换账号后复用上一个账号的缓存数据。

登录页支持显示/隐藏密码，并可选择是否在当前电脑保持登录。不勾选时 Auth Cookie 使用浏览器会话生命周期。

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

Phase 2 最初建立了 21 张 PostgreSQL 业务表；后续“纯文档”功能新增 `secure_documents`，当前共 22 张用户私有业务表。每张表都有 owner `user_id` 并按 `auth.uid()` 隔离；独立管理员账号只由 server-only `ADMIN_USER_ID` 判断。详情见 `SUPABASE_RLS_MATRIX.md`、`ADMIN_ARCHITECTURE.md` 和 `SUPABASE_PHASE2_PROGRESS.md`。本地模式仍使用 SQLite，没有迁移真实数据。

Phase 2.5 已在 Sydney 隔离 Supabase 测试项目应用两份 migration，并用 User A、User B、Admin Account 完成 36 项真实 Auth/PostgreSQL/RLS/Storage 安全测试。详情见 `SUPABASE_REMOTE_VALIDATION.md`、`SUPABASE_SECURITY_TEST_RESULTS.md` 和 `SUPABASE_PHASE2_5_PROGRESS.md`。这不会切换当前 SQLite backend。

Phase 3 使用双模式过渡：默认 `DATA_BACKEND=sqlite`、`AUTH_REQUIRED=false`，现有本地应用不要求登录，也不会改变当前 SQLite 或 uploads。隔离 Auth 测试模式使用 Supabase Auth + 系统临时目录中的专用空 SQLite；必须同时设置 `TEST_DATABASE=true`、`AUTH_TEST_DATA_ROOT` 和全部 `LEO_*` 测试路径。任一路径指向真实 Application Support、仓库真实数据或临时根目录之外时，应用会 fail closed。详情见 `AUTH_ARCHITECTURE.md`、`SUPABASE_PHASE3_AUTH.md` 和 `AUTH_SECURITY_TEST_RESULTS.md`。

Phase 3 已提供邮箱注册、登录、SSR Cookie Session、退出、忘记密码、重置密码、Auth callback、页面/API 保护和独立 Admin 身份检查。Phase 4 在此基础上增加核心 Supabase Repository；SQLite 模式下仍不会把现有本地数据猜测绑定给任何账号。

Phase 4 核心 Repository 已实现：Settings、Tasks/Progress/Subtasks、To Do、Plans、Journal 和 Expenses 可在 `DATA_BACKEND=supabase`、`AUTH_REQUIRED=true` 时通过当前 Session `user.id` 访问 Supabase，并由 RLS 与 owner-aware 外键隔离。课程、课表、文件、重要文件和真实 Storage 暂未切换；Cloud mode 会明确拒绝 SQLite-only Repository，离线 replay 也会返回 `409`，不会静默回退或重复写入。现有 282 行 SQLite 与 4 个本地文件没有迁移。

Phase 4 详情和 API 状态见 `SUPABASE_PHASE4_REPOSITORIES.md`、`SUPABASE_REPOSITORY_PROGRESS.md` 与 `CLOUD_DATA_ISOLATION_TEST_RESULTS.md`。

Phase 4.5 已为 Task/Progress、Plan/Journal、To Do 与 Finance 的 11 条多表写入流程增加 7 个 PostgreSQL 事务函数。函数使用 `security invoker`，owner 只来自 `auth.uid()`，现有 RLS 与跨用户复合外键继续生效；任一子步骤失败时整笔业务写入回滚。13 项真实远程事务测试与原有测试合计 223/223 通过，partial state 与越权成功均为 0。默认 SQLite 模式、282 行真实数据和 4 个本地文件未改变。详情见 `SUPABASE_TRANSACTION_AUDIT.md`、`SUPABASE_TRANSACTION_RPCS.md` 与 `TRANSACTION_FAILURE_TEST_RESULTS.md`。

Phase 5 已增加 Supabase Timetable Repository：Cloud mode 可按当前账号查询课程/课表，预览和确认 ICS/Calendar Feed，处理 RRULE、RDATE、EXDATE、RECURRENCE-ID 例外与取消，并编辑或软取消 occurrence。三表 confirm 由单个 `security invoker` PostgreSQL RPC 原子执行，重复来源使用 SHA-256 `sourceKey`，实例 identity 保持 `(user_id, sourceId, externalUid, occurrenceStart)`。Feed 获取增加协议、私网/DNS、跳转、超时、大小和内容类型保护。新增 43 项测试后完整矩阵为 266/266；真实本地 1 个 source、16 个 timetable courses、165 个 occurrences 与 4 个 uploads 未迁移。详情见 `SUPABASE_PHASE5_TIMETABLE.md`、`SUPABASE_TIMETABLE_AUDIT.md`、`TIMETABLE_TIMEZONE_POLICY.md` 与 `TIMETABLE_CLOUD_TEST_RESULTS.md`。

Phase 6 已增加 Supabase File Repository 与私有 Storage 生命周期：Cloud mode 支持 PDF/JPEG/PNG/WebP（最大 10 MiB）、SHA-256、Important Files、Expense 小票、60 秒 signed URL，以及 `pending_delete` 删除补偿。对象路径固定为当前账号前缀，普通 Admin API 也不能跨用户读取文件；Storage 删除前后都会验证真实对象状态。完整测试矩阵为 292/292，文件越权与 partial invisible state 均为 0。真实 SQLite、WAL/SHM 和 4 个 uploads 哈希未变化，也没有上传到测试项目。详情见 `SUPABASE_PHASE6_STORAGE.md`、`SUPABASE_STORAGE_AUDIT.md`、`STORAGE_SECURITY_MODEL.md`、`STORAGE_CLOUD_TEST_RESULTS.md` 与 `FILE_DELETE_COMPENSATION_POLICY.md`。

Phase 7 已加入正式账号和支持入口：注册要求全局唯一用户名、邮箱和密码，登录支持“用户名或邮箱 + 密码”；用户名存入 `profiles` 并使用大小写不敏感唯一约束。找回密码继续使用 Supabase Auth 安全邮件流程，“联系开发者”允许登录用户或匿名访客留言。`developer_messages` 不开放任何客户端读取策略，只有受保护的 Admin API 可以查看和更新状态。

账号规则会直接显示在登录和注册页面：用户名为 3 至 24 位，仅限英文字母、数字和下划线，全局唯一且不区分大小写；密码至少 8 个字符并区分大小写，建议混合字母、数字和符号。登录时可使用注册邮箱或用户名。

每个邮箱只能注册一个账号。注册流程会识别 Supabase 返回的重复邮箱状态；若邮箱已经使用，页面会明确提示用户直接登录或使用“找回密码”，不会误显示为等待邮件确认。

独立管理员后台位于 `/admin`。只有 `ADMIN_USER_ID` 对应的独立 Admin Account 能进入；用户列表、用户数据、留言和文件查看均经过 `/api/admin/*`、`assertAdmin()` 与服务端 elevated client。原文件只提供 60 秒 signed URL，留言状态修改会写入 `admin_audit_logs`。开发者联系方式通过服务端 `DEVELOPER_CONTACT_EMAIL` 和 `DEVELOPER_CONTACT_PHONE` 配置，不写入源码或浏览器 bundle。

“新增收支”弹窗采用统一 segmented control、金额主视觉、分类 chips、响应式日期/支付方式布局和独立凭证上传卡。桌面端普通 MacBook 视口完整显示；手机端单列纵向滚动，不产生横向滚动。

任务、Deadline 和清单的新建/编辑弹窗暂时隐藏优先级选项。数据库字段与已有记录保持不变；编辑旧任务会保留原优先级，新任务继续使用现有默认值。

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
