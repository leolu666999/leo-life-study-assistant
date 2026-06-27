# Leo 的生活学习助手 / Leo Life Study Assistant

一个本地优先的生活、学习和出发准备管理工具。它把 To Do List、任务、Deadline、进度、记账、重要文件、计划和日记放在同一个轻量网页应用里，适合留学、搬家、备考、项目推进等需要大量本地资料管理的场景。

A local-first life and study dashboard for managing daily to-dos, tasks, deadlines, progress, expenses, important documents, plans, and journals in one lightweight web app. It is designed for study abroad preparation, moving logistics, personal projects, and day-to-day organization.

## 核心特点 / Highlights

- 本地优先：数据库保存在 `data/`，上传文件保存在 `uploads/`。
- 数据不进 Git：`.gitignore` 会排除数据库、备份和上传文件，更新代码不会覆盖个人数据。
- 每日 To Do List：按日期管理每日清单，支持勾选、编辑和从计划页查看。
- Task / Deadline：长期任务和明确截止事项分开管理，Deadline 支持倒计时显示。
- 进度追踪：任务可以开启进度条，例如阅读页数、训练次数、百分比目标。
- 记账：记录消费、分类、支付方式和小票/账单图片。
- 重要文件：保存护照、签证、学校、住宿、保险、交通等关键文件，可搜索、分类、添加标签和到期日。
- 计划与日记：支持每日、每周、每月计划和简单复盘记录。

- Local-first: the database lives in `data/`, and uploaded files live in `uploads/`.
- Git-safe data: database files, backups, and uploads are ignored by Git, so code updates do not overwrite personal data.
- Daily To Do List: date-based checklists with editing and completion tracking.
- Task / Deadline: regular tasks and deadline-based items are managed separately; deadlines can show countdowns.
- Progress tracking: optional progress bars for reading pages, training sessions, percentage goals, and custom units.
- Expenses: log spending with categories, payment methods, notes, and receipt images.
- Important files: store key documents such as passport, visa, school, accommodation, insurance, travel, and banking materials with search, categories, tags, and expiry dates.
- Plans and journals: daily, weekly, and monthly planning plus lightweight reflections.

## 本地数据说明 / Local Data

这个项目默认不会把你的个人资料提交到 GitHub：

This project is configured so personal data is not committed to GitHub:

```text
data/      local SQLite database and backups
uploads/   uploaded receipts, images, and documents
```

仓库中只保留 `data/.gitkeep` 和 `uploads/.gitkeep`，用于创建空文件夹。每个人第一次运行时都会在自己电脑上生成自己的本地数据。

The repository only keeps `data/.gitkeep` and `uploads/.gitkeep` so the folders exist. Each user gets their own local database and upload files when they run the app.

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

## 隐藏/快捷功能 / Hidden and Quick Features

- 双击首页标题 `Leo的生活学习助手` 可以打开今日总览。
- To Do List 卡片内部可以滚动查看较多条目，底部淡出效果表示列表还能继续。
- 勾选首页 To Do List 项目时，完成项会移动到列表底部。
- 开启进度追踪的任务可以出现在底部进度条中，点击右侧箭头切换显示的进度。
- 筛选面板未输入条件时，点击空白处可以关闭。

- Double-click the dashboard title `Leo的生活学习助手` to open today’s overview.
- The To Do List card can scroll internally when it contains many items; the bottom fade indicates more content.
- Completed homepage To Do List items move to the bottom of the list.
- Tasks with progress tracking can appear in the bottom progress bar; use the arrow on the right to switch between tracked items.
- If the filter panel has no active input, clicking outside closes it.

## GitHub 注意事项 / GitHub Notes

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
