# 本地文件系统与 Supabase Storage 迁移方案

本报告只设计迁移，不创建 bucket、不上传文件、不移动本地目录。

## 1. 当前存储位置

| 类别 | 当前路径/方式 | 数据库关联 | 删除行为 | Git 风险 |
|---|---|---|---|---|
| SQLite | `~/Library/Application Support/Leo的生活学习助手/data/leo_life_study.db` | 主数据库 | 应用不自动删除 | 默认不在仓库，但环境变量可改路径 |
| SQLite WAL/SHM | 数据库同目录 | SQLite 事务状态 | 随 SQLite 生命周期 | 备份时必须一并处理或做一致快照 |
| 旧 SQLite | 仓库 `data/` | 旧版/兼容来源 | 新位置缺失时复制，不删除 | `data/*` 已忽略，仅 `.gitkeep` 跟踪 |
| uploads | `~/Library/Application Support/Leo的生活学习助手/uploads/` | `uploaded_files` | 仅重要文件删除链路会尝试清理 | 默认不在仓库 |
| 旧 uploads | 仓库 `uploads/` | 旧版/兼容来源 | 按缺失文件复制，不删除 | `uploads/*` 已忽略，仅 `.gitkeep` 跟踪 |
| 本地备份 | 仓库 `.codex-backups/`、`data/backups/` 等运维目录 | 不属于正式 schema | 手工管理 | `.codex-backups/` 与 `data/*` 已忽略 |
| JSON 导出 | `/api/backup/export` 下载到浏览器选择的位置 | 包含多表数据与文件元数据 | 浏览器/用户管理 | 下载落点不受仓库规则控制 |
| Electron 日志 | `~/Library/Logs/Leo的生活学习助手/desktop.log` | 无 | 未见轮转策略 | 不在仓库 |
| 静态图片/图标 | `public/`、`build/` | 代码资产 | 随版本控制 | 应提交，非用户数据 |

审计期间只确认目录存在及总体占用，不枚举文件名、不读取文件内容。

## 2. 当前上传链路

1. 浏览器向 `POST /api/upload` 提交 multipart `file`。
2. Route Handler 将完整文件读入内存。
3. 以 `randomUUID() + 原始扩展名` 生成 `storedName`。
4. 写入 `uploadsDir/storedName`。
5. `uploaded_files` 保存 `originalName`、`storedName`、相对 `path`、MIME、size、createdAt 和可选多态关联。
6. 业务记录保存 `fileId`；前端通过 `/api/uploads/[id]` 读取。

问题：无服务端大小/类型限制、无哈希、无病毒扫描、无配额、上传与 DB 写入不是原子事务；磁盘写入成功而 DB 失败会产生孤儿，反之也可能产生缺失文件。

## 3. 当前文件类别

| 文件类别 | 当前真实支持 | 关系 | 当前清理完整性 |
|---|---:|---|---|
| 收支小票 | 是 | `expenses.receiptFileId -> uploaded_files.id` | 删除 Expense 不删除元数据/物理文件，可能孤儿 |
| 重要文件 | 是 | `important_files.fileId -> uploaded_files.id` | 删除时检查收支/重要文件引用，无引用则删磁盘；基本可用但非事务 |
| 通用未关联上传 | 是，设置页入口 | 只写 `uploaded_files`，关联可为空 | 无自动清理，可能孤儿 |
| Task attachments | 未形成完整业务模型 | 仅有通用多态字段潜力 | 无正式关系/清理 |
| Journal attachments | 未实现 | 无 | 无 |
| Course screenshots / ICS 原文件 | ICS 只在请求中解析，未持久化原文件 | 无 | 无 |
| OCR 原图 | 未发现服务端 OCR 存储链路 | 无 | 无 |
| Avatar | 未实现 | 无 | 无 |

不要为“未来类别”迁移并不存在的文件。第一阶段只迁 receipts 和 important files；其余 bucket 可预留设计但不必创建。

## 4. Supabase Storage bucket 设计

建议第一版使用以下 **private buckets**：

| Bucket | 第一版是否创建 | 内容 | 路径格式 |
|---|---:|---|---|
| `receipts` | 是 | 收支小票 | `{user_id}/{file_id}/{sanitized_name}` |
| `important-files` | 是 | 重要文件 | `{user_id}/{file_id}/{sanitized_name}` |
| `course-imports` | 可选 | 仅在决定保留 ICS 原文件后使用 | `{user_id}/{source_id}/{file_id}.ics` |
| `task-attachments` | 否，功能实现时再建 | 未来任务附件 | `{user_id}/{task_id}/{file_id}/{name}` |
| `journal-attachments` | 否 | 未来日记附件 | `{user_id}/{journal_id}/{file_id}/{name}` |
| `avatars` | 否 | 未来头像 | `{user_id}/{version}.{ext}` |

也可用单一 `user-files` bucket 加 category 路径。当前项目类别少，但分 bucket 能更清楚地设置 MIME、大小、生命周期和权限；因此优先分 `receipts` 与 `important-files`。

所有 bucket 默认 private。不要把“难猜 UUID”当权限，不要生成永久 public URL。

## 5. 目标文件元数据

保留 `uploaded_files` 概念，增加/调整：

| 字段 | 目标类型/说明 |
|---|---|
| `id` | uuid PK，保留旧 ID |
| `user_id` | uuid NN，FK `auth.users` |
| `bucket` | text NN |
| `object_path` | text NN，不含 bucket |
| `originalName` | text NN |
| `storedName` | text NN，可保留兼容；不再作为物理绝对路径 |
| `mimeType` | text NN |
| `size` | bigint NN，检查 `size >= 0` |
| `sha256` | text NULL；迁移时计算，用于验证/去重检测 |
| `status` | `pending/uploaded/failed/deleted` |
| `linkedEntityType`, `linkedEntityId` | 兼容保留；写入只允许服务端 |
| `createdAt`, `updatedAt`, `deletedAt` | timestamptz |

唯一约束：`unique(user_id, bucket, object_path)`。`object_path` 第一段必须等于 `auth.uid()`；数据库 RLS 与 Storage policy 两层都校验。

## 6. Storage 权限策略

以 `receipts` 为例，`storage.objects` 策略应同时限制 bucket 和路径首段：

```sql
bucket_id = 'receipts'
and (storage.foldername(name))[1] = auth.uid()::text
```

SELECT/INSERT/UPDATE/DELETE 都使用这一所有权条件。`important-files` 同理。应用业务表再通过 `uploaded_files.user_id = auth.uid()` 保护元数据。

推荐访问方式：

- 小文件：登录用户向受控 API 请求短期 signed upload URL，上传成功后服务端校验 object 并提交元数据。
- 下载/预览：服务端验证业务记录与 file owner 后返回短期 signed URL，或使用 Supabase 客户端在 RLS 下下载。
- 不允许客户端选择任意 `user_id`、bucket 或 object path。
- 限制扩展名与 MIME；服务端不要只信浏览器上传的 `file.type`。

## 7. 删除与一致性设计

Storage 删除不是普通 PostgreSQL 外键 cascade 能覆盖的。建议“先标记、后删除、可重试”：

1. 事务内把业务引用解除/软删除，`uploaded_files.status='pending_delete'`。
2. 后台函数或受控 Route Handler 删除 Storage object。
3. 成功后将 metadata 标记 `deleted` 或物理删除。
4. 失败保留任务状态并重试，不能让 UI 假装已完全清理。

对于共享引用，先查询当前 user 范围内所有业务引用。更稳妥的长期结构是显式 `file_links(file_id, entity_type, entity_id)`，但第一版可保留当前字段与两条正式 FK，避免不必要重构。

收支删除必须新增清理策略：如果小票不再被任何记录引用，进入 pending delete；否则只解除引用。重要文件同理。

## 8. 文件迁移流程

### 8.1 准备与备份

1. 停止写入或创建一致快照。
2. 复制 SQLite 主文件并正确处理 WAL/SHM；保留原 uploads 只读副本。
3. 从 `uploaded_files` 导出 manifest，但不把绝对本机路径上传到云端。
4. 对每个文件记录：旧 file ID、业务类别、旧 stored name、size、MIME、SHA-256、引用计数。
5. 检查数据库有元数据但磁盘缺失、磁盘存在但无元数据、重复引用和路径越界。

### 8.2 Dry run

- 不上传，只计算目标 bucket/object path。
- 验证每个 `receiptFileId/fileId` 都能解析到一个 manifest 项。
- 输出数量、总字节、缺失数、孤儿数、重复哈希数；报告不能含私人文件名时用 file ID。
- 对缺失/冲突项要求显式处理，不静默跳过。

### 8.3 上传与提交

1. 使用 service role 的离线迁移脚本上传，service key 不进入仓库。
2. 上传后从 Storage 获取 size/metadata，必要时下载抽样校验 SHA-256。
3. `uploaded_files` 使用原 UUID upsert，写 bucket/object path 和 migration run ID。
4. 迁移 `expenses`、`important_files` 外键。
5. 生成旧 ID -> 新 object path 映射；即使 ID 不变也保留 ledger。
6. 只有数据库、Storage 和引用校验全部通过后才宣布文件阶段完成。

### 8.4 幂等与回滚

- 目标 object path 含旧 `file_id`，重复运行不会产生随机新副本。
- 上传前检查 path + hash；一致则跳过，不一致则停止并报告冲突。
- 数据库 upsert 受 migration run 控制，不能覆盖已由云端用户修改的记录。
- 回滚不删除本地文件；切回 SQLite/local backend 即可。
- 删除云端迁移对象必须按 migration run manifest 执行，禁止清空 bucket。

## 9. 备份与导出改造

当前 JSON 备份只含部分业务表和文件元数据，不含 To Do、新版 timetable 或文件内容，不能独立恢复。云端应设计：

- 结构化数据导出 JSON/NDJSON。
- 文件 manifest：bucket、object path、size、hash、关联，不含 signed URL。
- 可选异步打包文件，必须短期授权、限流并记录审计。
- 导出只允许当前用户，所有查询仍经过 `user_id` 条件/RLS。
- 不在 Vercel 请求内同步压缩大量文件；使用后台任务或逐文件下载方案。

## 10. 验收清单

- 数据库引用数与成功迁移对象数一致。
- 每个 Storage object 路径首段是 owner user UUID。
- 未登录用户无法列出、读取、写入或删除对象。
- 用户 A 无法通过猜 ID/路径访问用户 B 文件。
- 小票与重要文件预览、下载、删除在桌面和手机正常。
- 删除失败可重试，不产生“DB 已删但对象永远遗留”的静默状态。
- 本地原件和备份在验收完成前保持只读，不删除、不覆盖。
- 仓库继续只跟踪 `.gitkeep`，不提交 manifest 中的私人文件名或导出数据。
