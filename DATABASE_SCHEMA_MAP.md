# SQLite 数据库结构与用户数据边界

审计来源：对当前 SQLite 做只读 `sqlite_master`、`PRAGMA table_info`、`foreign_key_list`、`index_list` 检查，并与 `lib/db.ts` 交叉核对。未读取任何业务行内容。

## 1. 总览

- 真实业务表：**21 张**。
- ID：绝大多数为应用生成的 UUID 字符串，SQLite 类型为 `TEXT`。
- 时间：均以 `TEXT` 保存，应用通常写 ISO 8601；部分业务日期/时间是本地字符串。
- 布尔值：SQLite `INTEGER` 0/1。
- JSON：`tags_json`、`localModifiedFields` 等以 `TEXT` 保存。
- 金额/进度：SQLite `REAL`；PostgreSQL 迁移时金额应改 `numeric`，避免浮点误差。
- 当前没有任何 `user_id`，所有数据都处于单用户全局命名空间。
- 除 `idx_course_occurrences_source_instance` 外，没有业务查询索引；其余均为主键/唯一约束自动索引。

字段标记：`NN` = NOT NULL，`NULL` = 可空，`D=` = 默认值。

## 2. 当前表结构

### 2.1 `tasks`

用途：统一承载 Task、Deadline、Counter、Checklist、Plan Item，以及任务提醒和可选进度能力。

| 字段 | SQLite 类型与约束 |
|---|---|
| `id` | TEXT PK |
| `title` | TEXT NN |
| `description` | TEXT NULL D=`''` |
| `type` | TEXT NN |
| `status` | TEXT NN D=`not_started` |
| `priority` | TEXT NN D=`medium` |
| `tags_json` | TEXT NN D=`[]` |
| `startDate`, `dueDate` | TEXT NULL |
| `createdAt`, `updatedAt` | TEXT NN |
| `completedAt`, `archivedAt` | TEXT NULL |
| `reminderRule` | TEXT NULL D=`none` |
| `progressCurrent`, `progressTarget` | REAL NULL |
| `progressUnit` | TEXT NULL |
| `progressEnabled` | INTEGER NN D=0 |
| `progressType` | TEXT NN D=`none` |
| `pinnedToBottom` | INTEGER NN D=0 |
| `parentPlanId`, `originalImageId`, `notes` | TEXT NULL |

关系：被 `subtasks`、`task_progress_entries`、`task_tags`、`plan_items` 引用。`parentPlanId`、`originalImageId` 没有声明外键。索引仅主键。

### 2.2 `subtasks`

用途：Checklist/任务的子项。

字段：`id TEXT PK`；`taskId TEXT NN`；`title TEXT NN`；`completed INTEGER NN D=0`；`createdAt TEXT NN`；`updatedAt TEXT NN`。  
外键：`taskId -> tasks.id ON DELETE CASCADE`。索引仅主键；缺少 `taskId` 查询索引。

### 2.3 `tags`

用途：规范化任务标签字典。

字段：`id TEXT PK`；`name TEXT NN UNIQUE`；`createdAt TEXT NN`。  
关系：经 `task_tags` 与任务多对多。当前 `name` 全库唯一，迁为多用户后必须改为 `(user_id, name)` 唯一。

### 2.4 `task_tags`

用途：任务与标签多对多连接表。

字段：`taskId TEXT NN`；`tagId TEXT NN`；复合 PK `(taskId, tagId)`。  
外键：两列分别引用 `tasks`、`tags`，均 `ON DELETE CASCADE`。无时间字段。

### 2.5 `plans`

用途：Daily/Weekly/Monthly 计划容器。

字段：`id TEXT PK`；`title TEXT NN`；`type TEXT NN`；`startDate TEXT NN`；`endDate TEXT NN`；`reflectionNote TEXT NULL`；`createdAt TEXT NN`；`updatedAt TEXT NN`。  
关系：`plan_items` 正式引用；`todo_lists.sourcePlanId`、`journal_entries.linkedPlanId` 仅逻辑引用。

### 2.6 `plan_items`

用途：计划与任务的排序连接表。

字段：`planId TEXT NN`；`taskId TEXT NN`；`sortOrder INTEGER NN D=0`；复合 PK `(planId, taskId)`。  
外键：`planId -> plans.id`、`taskId -> tasks.id`，均 `ON DELETE CASCADE`。无时间字段。

### 2.7 `todo_lists`

用途：独立的每日 To Do List 容器，不等同 Task。

字段：`id TEXT PK`；`title TEXT NN`；`date TEXT NN`；`notes TEXT NULL`；`sourcePlanId TEXT NULL UNIQUE`；`createdAt TEXT NN`；`updatedAt TEXT NN`。  
关系：一对多 `todo_list_items`；`sourcePlanId` 没有外键。索引为 PK 与 `sourcePlanId` 唯一索引。

### 2.8 `todo_list_items`

用途：To Do List 项及自然语言时间识别结果。

| 字段 | SQLite 类型与约束 |
|---|---|
| `id` | TEXT PK |
| `todoListId` | TEXT NN |
| `content` | TEXT NN |
| `completed` | INTEGER NN D=0 |
| `sortOrder` | INTEGER NN D=0 |
| `createdAt`, `updatedAt` | TEXT NN |
| `hasScheduleTime` | INTEGER NN D=0 |
| `scheduledStartAt`, `scheduledEndAt` | TEXT NULL |
| `scheduledTimezone`, `parsedTimeText` | TEXT NULL |
| `scheduleParseConfidence` | REAL NULL |

外键：`todoListId -> todo_lists.id ON DELETE CASCADE`。缺少 `(todoListId, sortOrder)` 与日程时间索引。

### 2.9 `progress_items`

用途：旧版独立进度实体，现已兼容迁入 `tasks`，仍保留旧数据与关联。

字段：`id TEXT PK`；`title TEXT NN`；`currentValue REAL NN D=0`；`targetValue REAL NN D=1`；`unit TEXT NULL D=''`；`category TEXT NULL D=general`；`linkedTaskId TEXT NULL`；`pinned INTEGER NN D=0`；`createdAt TEXT NN`；`updatedAt TEXT NN`。  
关系：`linkedTaskId` 没有外键。目标云模型不应继续产生新记录，但迁移验证前不能删除该表。

### 2.10 `task_progress_entries`

用途：任务进度更新历史。

字段：`id TEXT PK`；`taskId TEXT NN`；`createdAt TEXT NN`；`amountDelta REAL NULL`；`currentValueAfter REAL NULL`；`durationMinutes REAL NULL`；`note TEXT NULL`。  
外键：`taskId -> tasks.id ON DELETE CASCADE`。没有 `updatedAt`；缺少 `(taskId, createdAt)` 索引。

### 2.11 `courses`

用途：旧版手动课程主表，新增接口已返回 410，但旧数据仍可读取。

字段：`id TEXT PK`；`code TEXT NN`；`name TEXT NN`；`semester TEXT NN`；`notes TEXT NULL`。  
关系：一对多 `class_sessions`、`assignments`。无创建/更新时间。

### 2.12 `class_sessions`

用途：旧课程模型中的每周上课时段。

字段：`id TEXT PK`；`courseId TEXT NN`；`dayOfWeek INTEGER NN`；`startTime TEXT NN`；`endTime TEXT NN`；`type TEXT NN`；`location TEXT NN`；`notes TEXT NULL`。  
外键：`courseId -> courses.id ON DELETE CASCADE`。无时间戳和业务索引。

### 2.13 `assignments`

用途：旧课程模型中的作业。

字段：`id TEXT PK`；`courseId TEXT NN`；`title TEXT NN`；`dueDate TEXT NN`；`status TEXT NN D=not_started`；`weight REAL NULL`；`notes TEXT NULL`；`linkedTaskId TEXT NULL`。  
外键：仅 `courseId -> courses.id ON DELETE CASCADE`；`linkedTaskId` 没有外键。无时间戳。

### 2.14 `timetable_sources`

用途：ICS 文件或 Calendar Feed 导入源与同步状态。

字段：`id TEXT PK`；`type TEXT NN`；`name TEXT NN`；`feedUrl TEXT NULL`；`semester TEXT NN`；`academicYear INTEGER NN`；`timezone TEXT NN D=Australia/Sydney`；`lastSyncedAt TEXT NULL`；`lastSyncStatus TEXT NN D=idle`；`lastSyncError TEXT NULL`；`enabled INTEGER NN D=1`；`createdAt TEXT NN`；`updatedAt TEXT NN`。  
关系：`timetable_courses.sourceId`、`course_occurrences.sourceId` 是逻辑引用，无正式外键。Feed URL 属于敏感数据。

### 2.15 `timetable_courses`

用途：当前课表的课程系列/活动组，不是每个 occurrence。

字段：`id TEXT PK`；`courseCode TEXT NN`；`courseName TEXT NN`；`activityType TEXT NN`；`activityName TEXT NULL`；`semester TEXT NN`；`academicYear INTEGER NN`；`defaultLocation TEXT NULL`；`campus TEXT NULL`；`color TEXT NN D=#0f172a`；`notes TEXT NULL`；`sourceType TEXT NN D=manual`；`sourceId TEXT NULL`；`externalUid TEXT NULL`；`createdAt TEXT NN`；`updatedAt TEXT NN`。  
关系：一对多 `course_occurrences`；`sourceId` 未声明外键。仅主键索引。

### 2.16 `course_occurrences`

用途：课表中的具体上课实例，支持例外、本地覆盖和取消。

| 字段 | SQLite 类型与约束 |
|---|---|
| `id` | TEXT PK |
| `courseId` | TEXT NN |
| `startAt`, `endAt` | TEXT NN |
| `location`, `campus` | TEXT NULL |
| `status` | TEXT NN D=scheduled |
| `isException` | INTEGER NN D=0 |
| `originalStartAt`, `sourceUpdatedAt`, `localModifiedAt` | TEXT NULL |
| `localModifiedFields` | TEXT NN D=`[]` |
| `notes` | TEXT NULL |
| `sourceType` | TEXT NN D=manual |
| `sourceId`, `externalUid`, `occurrenceStart` | TEXT NULL |
| `createdAt`, `updatedAt` | TEXT NN |

外键：`courseId -> timetable_courses.id ON DELETE CASCADE`。  
索引：部分唯一索引 `(sourceId, externalUid, occurrenceStart)`，仅三列均非空时生效。缺少按 `startAt/endAt` 的日程查询索引。

### 2.17 `journal_entries`

用途：日记与计划反思。

字段：`id TEXT PK`；`date TEXT NN`；`source TEXT NN`；`content TEXT NN`；`linkedPlanId TEXT NULL`；`createdAt TEXT NN`；`updatedAt TEXT NN`。  
关系：`linkedPlanId` 没有外键；删除计划时应用代码主动删除关联日记。缺少日期索引。

### 2.18 `expenses`

用途：收入与支出、多币种、可选小票。

字段：`id TEXT PK`；`title TEXT NN`；`amount REAL NN`；`currency TEXT NN D=AUD`；`category TEXT NN`；`date TEXT NN`；`merchant TEXT NULL`；`paymentMethod TEXT NULL`；`notes TEXT NULL`；`receiptFileId TEXT NULL`；`createdAt TEXT NN`；`updatedAt TEXT NN`；`type TEXT NN D=expense`。  
外键：`receiptFileId -> uploaded_files.id ON DELETE SET NULL`。缺少 `(date, currency, type)` 索引。金额迁云应使用 `numeric(18,4)` 或按最小货币单位存整数，不能继续用浮点。

### 2.19 `uploaded_files`

用途：本地上传文件元数据。

字段：`id TEXT PK`；`originalName TEXT NN`；`storedName TEXT NN`；`path TEXT NN`；`mimeType TEXT NN`；`size INTEGER NN`；`createdAt TEXT NN`；`linkedEntityType TEXT NULL`；`linkedEntityId TEXT NULL`。  
关系：被 `expenses` 与 `important_files` 引用；多态关联字段无外键。没有 `updatedAt`、校验和、存储 bucket/object path 唯一约束。

### 2.20 `important_files`

用途：重要文件业务元数据与分类、标签、到期日。

字段：`id TEXT PK`；`title TEXT NN`；`category TEXT NN D=其他`；`tags_json TEXT NN D=[]`；`notes TEXT NULL`；`fileId TEXT NN`；`createdAt TEXT NN`；`updatedAt TEXT NN`；`expiryDate TEXT NULL`。  
外键：`fileId -> uploaded_files.id ON DELETE CASCADE`。注意方向是删除 `uploaded_files` 会级联删除重要文件；删除重要文件时应用代码另行判断引用并删除物理文件。

### 2.21 `settings`

用途：键值设置及内部迁移标志。

字段：`key TEXT PK`；`value TEXT NN`；`updatedAt TEXT NN`。  
已知业务键包括 `lastUsedCurrency`、`homeTitle`、`showHomeTitle`、`background`；也包含 `progress_items_migrated_to_tasks`、`todo_lists_migrated_from_daily_plans`、`todo_schedule_fields_backfilled` 等内部标志。迁云后主键必须改为 `(user_id, key)`，并区分用户设置与全局迁移版本。

## 3. 需求中名称与真实结构的对应关系

| 需求概念 | 真实位置 |
|---|---|
| tasks | `tasks` |
| todo_lists / todo_items | `todo_lists` / `todo_list_items` |
| deadlines | 无独立表；`tasks.type = 'deadline'` |
| counters | 无独立表；`tasks.type = 'counter'` |
| checklists | 无独立表；`tasks.type = 'checklist'` + `subtasks` |
| progress_entries | `task_progress_entries`；另有旧 `progress_items` |
| expenses | `expenses` |
| courses / occurrences | 旧 `courses`；当前 `timetable_courses` / `course_occurrences` |
| journals | `journal_entries` |
| ideas | 无独立表 |
| important files | `important_files` + `uploaded_files` |
| settings | `settings` |
| reminders | 无独立表；`tasks.reminderRule` JSON/字符串 |
| tags | `tags` + `task_tags`，同时 `tasks.tags_json` 有冗余副本 |
| attachments | 无独立表；只有通用 `uploaded_files` 元数据 |
| timetable_sources | `timetable_sources` |

## 4. 用户数据边界与 RLS 分类

当前 21 张表都包含或能推导私人生活/学习数据，**没有可直接视为全局公共业务数据的现有表**。

| 表 | 私有数据 | 目标需 `user_id` | 需 RLS | 共享可能性 |
|---|---:|---:|---:|---|
| `tasks`, `subtasks`, `task_progress_entries` | 是 | 是 | 是 | 将来可共享任务，但第一版不共享 |
| `tags`, `task_tags` | 是 | 是 | 是 | 标签名不能跨用户全局唯一 |
| `plans`, `plan_items` | 是 | 是 | 是 | 第一版私有 |
| `todo_lists`, `todo_list_items` | 是 | 是 | 是 | 第一版私有 |
| `progress_items` | 是 | 是 | 是 | 仅迁移兼容/只读 |
| `courses`, `class_sessions`, `assignments` | 是 | 是 | 是 | 课程选择和作业属于私人数据 |
| `timetable_sources`, `timetable_courses`, `course_occurrences` | 是 | 是 | 是 | Feed URL、地点与时间敏感 |
| `journal_entries` | 高敏 | 是 | 是 | 第一版绝不共享 |
| `expenses` | 高敏 | 是 | 是 | 第一版绝不共享 |
| `uploaded_files`, `important_files` | 高敏 | 是 | 是 | 文件默认私有；Storage 同样需策略 |
| `settings` | 是 | 是 | 是 | 每用户独立 |

如未来实现协作，不应把 `user_id` 改造成“当前访问者”；应保留 owner `user_id`，另建 `shares`/`memberships` 表并通过显式授权扩展 RLS。

## 5. PostgreSQL 目标映射原则

为减少业务改动，第一阶段保留现有表名、ID 和字段语义；不要在数据迁移同时全面改名。类型建议：

| SQLite | PostgreSQL |
|---|---|
| UUID 字符串 `TEXT` | `uuid`，保留原始 UUID 值 |
| 时间戳 `TEXT` | `timestamptz` |
| 纯日期 `TEXT` | `date` |
| 每周时间 `TEXT` | `time` |
| 0/1 `INTEGER` | `boolean` |
| JSON 文本 | `jsonb`，导入前验证合法 JSON |
| 金额 `REAL` | `numeric(18,4)` |
| 普通进度 `REAL` | `numeric` 或 `double precision`，按业务精度选择 |

所有私有表增加：

```sql
user_id uuid not null references auth.users(id) on delete cascade
```

推荐为父表建立 `unique (user_id, id)`，子表使用 `(user_id, parent_id)` 复合外键，阻止跨用户拼接关系。连接表主键推荐包含 `user_id`，例如 `(user_id, taskId, tagId)`。

## 6. 目标约束与索引

最低必要索引：

- `tasks (user_id, archivedAt, status, dueDate)`、`(user_id, type)`、`(user_id, updatedAt desc)`。
- `subtasks (user_id, taskId)`。
- `tags unique (user_id, name)`；`task_tags (user_id, tagId)`。
- `plans (user_id, type, startDate, endDate)`；`plan_items (user_id, planId, sortOrder)`。
- `todo_lists unique (user_id, sourcePlanId)`，并加 `(user_id, date)`。
- `todo_list_items (user_id, todoListId, sortOrder)`、`(user_id, hasScheduleTime, scheduledStartAt)`。
- `task_progress_entries (user_id, taskId, createdAt desc)`。
- `journal_entries (user_id, date desc)`。
- `expenses (user_id, date desc, currency, type)`。
- `uploaded_files unique (user_id, bucket, object_path)`。
- `important_files (user_id, category, expiryDate)`。
- `timetable_sources (user_id, enabled)`。
- `timetable_courses (user_id, sourceId, courseCode)`。
- `course_occurrences (user_id, startAt, endAt)`，并保留按源实例的唯一约束，扩展为 `(user_id, sourceId, externalUid, occurrenceStart)`。
- `settings primary key (user_id, key)`。

`createdAt`/`updatedAt` 应设数据库默认 `now()`；`updatedAt` 用统一 trigger 自动更新，避免只依赖客户端。旧表缺失的时间戳可在导入时使用迁移时间并记录 `timestamp_inferred=true` 到迁移日志，不伪造精确历史。

## 7. 需要在迁移前决定的结构问题

1. `tasks.tags_json` 与 `tags/task_tags` 双份真相：第一版为兼容可保留并校验一致；稳定后再选定规范化关系为唯一真相。
2. `progress_items` 已是旧模型：先迁入隔离的 legacy 表或转换清单，验证任务和历史后停止使用，不能直接丢弃。
3. 旧课程与新课表并存：两套表都要备份迁移；UI 可继续只读旧课程，但不能把旧课程自动合并到新课表而无映射记录。
4. 多态 `uploaded_files`：RLS 可以按文件 owner 保护，但关系完整性应由受控服务函数维护；不要让客户端随意写 `linkedEntityId`。
5. `settings` 混合用户设置与迁移标志：目标应把迁移版本移到仅服务端可写的 `schema_migrations`，用户设置留在 `settings`。
