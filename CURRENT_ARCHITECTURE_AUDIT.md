# 当前架构技术审计

审计日期：2026-07-10  
审计范围：代码、配置、SQLite 元数据、API 路由、PWA、Electron、本地存储边界。  
审计约束：只读检查；未读取业务记录内容，未修改数据库、环境变量、API 或业务代码。

## 1. 执行摘要

当前项目是一个单仓库、单用户、本地优先应用：Next.js 同时承担页面与 Route Handler，本地 Node 进程通过 `node:sqlite` 直接读写 SQLite，并通过本地文件系统保存上传文件。网页、PWA 和 Electron 桌面端共用同一套页面和 API；手机通过局域网访问电脑上的 `0.0.0.0:3011`。

它适合当前“个人电脑作为数据主机”的模式，但不能原样部署到 Vercel：SQLite、本地 uploads、进程内 SSE、局域网地址探测和无身份验证 API 都需要处理。迁移时最重要的原则是先建立身份与所有权边界，再迁业务数据，最后迁文件，不能先把现有 API 直接暴露到公网。

## 2. 项目与技术栈

| 项目 | 当前情况 |
|---|---|
| 仓库 | 项目根目录（下文记为 `<repo-root>`） |
| Next.js | `package.json` 声明 `^15.1.3`；当前安装版本 `15.5.19` |
| React | 19 |
| 路由 | App Router；页面位于 `app/**/page.tsx`，无 Pages Router |
| 语言 | TypeScript 5.7，`strict: true` |
| 样式 | Tailwind CSS 3.4 + `app/globals.css` |
| 图标 | `lucide-react` |
| 课表解析 | `ical.js`、`rrule` |
| 后端 | Next.js Route Handlers，全部声明 `runtime = "nodejs"` |
| 数据库 | SQLite，Node 内置实验性 `node:sqlite` / `DatabaseSync` |
| 桌面端 | Electron 43 + electron-builder |
| PWA | Web App Manifest + 手写 Service Worker |
| 测试/检查 | 无独立测试框架；`npm run lint` 与 `npm run typecheck` 都执行 `tsc --noEmit` |

## 3. 项目结构

```text
app/                  App Router 页面与 34 个 API Route Handler
components/           主要 UI；核心为大型客户端组件 leo-app.tsx
lib/                  SQLite、类型、课表解析、时间识别、实时事件、配置
electron/             Electron 主进程与 preload
public/               PWA manifest、service worker、离线页、图标和静态图片
scripts/              standalone 打包整理、应用图标生成
data/                 旧版/仓库内本地数据位置，Git 忽略真实内容
uploads/              旧版/仓库内上传位置，Git 忽略真实内容
.codex-backups/        本地备份，Git 忽略
```

页面路由包括 `/`、`/tasks`、`/plans`、`/courses`、`/schedule`、`/journal`、`/expenses`、`/files`、`/settings`、`/guide`。`/archive`、`/progress`、`/progresses`、`/goals` 仍保留兼容入口，由页面层导向统一后的功能。

## 4. 前端架构与调用方式

- `components/leo-app.tsx` 是主要客户端状态容器，启动时并行读取任务、归档、计划、To Do、进度、课程、日记、收支、重要文件和设置。
- 页面内导航使用 History API 与复用组件状态，减少整页刷新。
- 所有主数据通过同源 `/api/*` 获取，没有直接从浏览器访问 SQLite。
- 变更后通常重新执行一轮 `loadAll(false)`；跨窗口刷新依赖 `/api/events` 的 SSE 事件。
- 手机离线新增使用 IndexedDB 队列 `leo-life-study-offline/queue`，支持 To Do List、Task、Deadline、Checklist、收支和日记的 POST；恢复连接后推送 `/api/sync/push`。
- IndexedDB 队列目前没有服务端持久化幂等键。请求成功但客户端未收到响应时，重试可能重复创建记录。
- `localStorage` 保存设备 ID、侧栏折叠、背景、提醒忽略记录和最近同步时间。这些不是完整主数据，但迁云后应明确哪些设置需要跨设备同步。

## 5. 后端与数据访问层

- 共有 **34 个 API 路由文件、49 个“HTTP 方法 + 路径”端点**。
- 没有 Server Action；Route Handler 直接调用 `lib/db.ts`。
- `lib/db.ts` 同时承担建表、补列、旧数据迁移、seed、查询、业务写入、文件元数据和备份导出，职责集中。
- SQLite 连接缓存在 `globalThis.leoDb`，启动时启用 WAL 与外键。
- 当前没有登录、Session、用户表或 `user_id`；API 按本机单用户模型信任所有请求。
- 进程内 `EventEmitter` 广播变更，SSE 每 25 秒发心跳。该机制不能跨 Vercel 实例共享状态。

## 6. 数据库位置与生命周期

默认位置：

```text
~/Library/Application Support/Leo的生活学习助手/data/leo_life_study.db
```

可通过以下环境变量覆盖：

| 环境变量 | 用途 |
|---|---|
| `LEO_APP_DATA_DIR` | 应用数据根目录 |
| `LEO_DATA_DIR` | SQLite 数据目录 |
| `LEO_DB_PATH` | SQLite 文件完整路径 |
| `LEO_UPLOADS_DIR` | uploads 目录 |
| `LEO_LOG_DIR` | Electron/应用日志目录 |
| `LEO_PORT` / `PORT` | 服务端口，默认 3011 |
| `LEO_HOST` | Electron 后端主机，默认 `127.0.0.1` |

`lib/app-config.ts` 会在新位置没有数据库时，从仓库内旧路径 `data/` 复制数据库、WAL、SHM；uploads 也会按缺失文件复制。它不会删除旧数据。当前真实 schema 有 **21 张业务表**，详见 `DATABASE_SCHEMA_MAP.md`。

注意：`getDb()` 会在连接时自动运行建表、补列、历史进度迁移、Daily Plan 到 To Do 的迁移、日程字段回填和 seed。因此未来迁移脚本不能简单 import 并调用 `getDb()` 做“只读导出”；应使用只读 SQLite 连接或独立导出器。

## 7. 本地文件存储

默认 uploads：

```text
~/Library/Application Support/Leo的生活学习助手/uploads/
```

上传 API 把整个文件读入内存，以 `randomUUID + 原扩展名` 生成 `storedName`，写入 uploads，并在 `uploaded_files` 保存元数据。当前明确的业务消费方是：

- 收支小票：`expenses.receiptFileId`
- 重要文件：`important_files.fileId`

设置页还提供通用上传入口，它只创建 `uploaded_files` 元数据而不建立业务引用，因此也可能产生未关联文件。

任务附件、日记附件、课程截图目前没有独立数据表或完整业务链路；`uploaded_files` 虽有多态关联字段，但没有外键约束。重要文件删除会在无剩余引用时删除元数据和磁盘文件；删除收支记录不会同步清理小票文件，存在孤儿文件风险。

仓库审计显示 `data/`、`uploads/`、`.codex-backups/` 和 Application Support 目录均存在本地文件；本报告未枚举文件名或读取内容。Git 当前只跟踪 `data/.gitkeep` 与 `uploads/.gitkeep`，`.gitignore` 会排除真实数据和 `.env*`。

## 8. 开发、构建与桌面启动

| 命令 | 行为 |
|---|---|
| `npm run dev` | `next dev -H 0.0.0.0 -p 3011`，允许局域网访问 |
| `npm run build` | Next production build；随后整理 standalone 目录 |
| `npm run start` | `next start -H 0.0.0.0 -p 3011` |
| `npm run desktop:dev` | Electron 启动本地 Next dev server |
| `npm run desktop:pack` | standalone + macOS `.app` |
| `npm run desktop:dist` | standalone + DMG |

`next.config.ts` 使用 `output: "standalone"`，并将 `node:sqlite` 标为外部服务端包。打包脚本主动从 standalone 中删除 `data/` 与 `uploads/`，避免把用户数据放进应用包。

Electron 使用单实例锁，默认连接/启动 `127.0.0.1:3011`，窗口启用 `contextIsolation`、关闭 `nodeIntegration`、开启 sandbox。它把 Next 服务视作本地后端，打包后仍依赖可写的 macOS Application Support 目录。

## 9. PWA 与移动端

- `public/manifest.webmanifest`：standalone、portrait、中文、192/512/Apple Touch 图标。
- 生产环境注册 `/sw.js`；开发环境自动注销旧 Service Worker 并清理相关缓存。
- Service Worker 不拦截 `/api/`、`/_next/`；导航使用网络优先并回退 `offline.html`，静态资源采用缓存优先并后台更新。
- 页面通过 Tailwind 响应式类、单列移动布局、固定底部导航、安全区 CSS 和横向溢出控制适配手机。
- PWA 的“离线”不是完整离线数据库：页面/API 数据仍依赖电脑，只有部分新增操作进入 IndexedDB 队列。
- 浏览器提醒依赖页面/Service Worker 的 Notification API，没有服务端定时任务；页面未运行时无法保证准时提醒。

## 10. 配置与部署现状

- 仓库没有 `.env` 文件、`vercel.json`、Docker 配置或 Supabase SDK。
- `.env*` 已被 Git 忽略。
- 当前 Git 分支为 `main`，工作树在审计开始时干净并跟踪 `origin/main`。
- 远程：`origin` 指向 `leo-life-study-assistant`，另有 `usyd` 远程。
- 当前没有 CI、自动测试或 Vercel 部署配置。

## 11. 上 Vercel 前的阻断项

1. **SQLite 持久化**：Vercel 函数文件系统不可作为持久数据库；`node:sqlite` 也把状态绑定到单实例磁盘。
2. **uploads 持久化**：本地写文件在 Serverless 环境不可靠，必须迁 Storage。
3. **无身份验证**：所有业务、文件下载和备份接口均可直接访问，不能公开部署。
4. **进程内实时事件**：EventEmitter/SSE 只在单进程有效，Serverless 多实例会漏事件。
5. **局域网 API**：`/api/network` 使用 `os.networkInterfaces()`，云上没有产品意义。
6. **健康检查泄露路径**：`/api/health` 返回数据库、uploads、日志绝对路径，公网必须收敛。
7. **备份导出**：`/api/backup/export` 返回大量私人数据和文件元数据，必须鉴权并限制；它同时遗漏 To Do 和新版 timetable 表，不能视为完整可恢复备份。
8. **课表远程抓取**：服务器按用户 URL 执行 `fetch`，需 URL 协议/域名/IP 校验、超时和大小限制，避免 SSRF。
9. **上传内存与校验**：当前整文件 Buffer、无服务端大小/MIME 白名单，需改直传或受控流式上传。
10. **提醒与后台任务**：浏览器端检查不能等价于可靠云端提醒；若要保证通知需另行设计 cron/队列/Web Push。
11. **PWA/Auth 缓存**：Service Worker 不应缓存带用户数据的响应、登录回调或私有 HTML。
12. **Auth 回调**：需配置 Supabase Site URL、Vercel Preview/Production redirect URLs 和密码重置链接。

## 12. 架构结论

建议保留同一前端与 API 契约，但把数据访问拆为明确的 repository/service 边界。短期可支持两个发布形态：桌面本地版使用 SQLite + local files，云端版使用 Supabase + Storage；不建议第一版做双向实时同步或双写。具体目标架构、Auth、RLS、迁移与回滚方案见 `SUPABASE_MIGRATION_PLAN.md`。
