import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  AppSettings,
  Assignment,
  ClassSession,
  CourseOccurrence,
  Course,
  Expense,
  ImportantFile,
  JournalEntry,
  Plan,
  ProgressItem,
  Subtask,
  Task,
  TaskProgressEntry,
  TimetableCourse,
  TimetableImportPreview,
  TimetableSource,
  TodoList,
  TodoListItem
} from "./types";
import { dataBackend, dataDir, dbPath, migrateLegacyUserDataIfNeeded, uploadsDir } from "./app-config";
import { isSupportedCurrencyCode } from "./currencies";
import { parseScheduleTime } from "./schedule-time";

type DatabaseLike = {
  exec: (sql: string) => void;
  prepare: (sql: string) => {
    all: (...params: unknown[]) => Record<string, unknown>[];
    get: (...params: unknown[]) => Record<string, unknown> | undefined;
    run: (...params: unknown[]) => { changes: number; lastInsertRowid: number | bigint };
  };
};

const sqlite = require("node:sqlite") as { DatabaseSync: new (path: string) => DatabaseLike };
type SubtaskDraftInput = string | { id?: string; title?: string; completed?: boolean };
type TaskInput = Omit<Partial<Task>, "subtasks"> & { subtasks?: SubtaskDraftInput[] };
type ExpenseInput = Partial<Omit<Expense, "amount">> & { amount?: number | string | null };
type ImportantFileInput = Partial<Omit<ImportantFile, "tags">> & { tags?: string[] | string };
type PlanInput = Partial<Plan> & {
  taskIds?: string[];
  itemTitles?: string[];
  itemDrafts?: Array<{ title?: string; completed?: boolean }>;
};
type TodoListInput = Partial<TodoList> & {
  itemDrafts?: Array<{ id?: string; content?: string; title?: string; completed?: boolean }>;
  sourcePlanId?: string | null;
};

export { dataDir, dbPath, uploadsDir };

declare global {
  // eslint-disable-next-line no-var
  var leoDb: DatabaseLike | undefined;
}

function now() {
  return new Date().toISOString();
}

function normalizeTaskType(type?: string | null) {
  return type === "shopping" ? "checklist" : type;
}

function todayIso() {
  return localDateKey(new Date());
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

function localDateKey(date: Date) {
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function getDb() {
  if (dataBackend !== "sqlite") throw new Error("Local SQLite access is forbidden when DATA_BACKEND is not sqlite");
  migrateLegacyUserDataIfNeeded();

  if (!globalThis.leoDb) {
    globalThis.leoDb = new sqlite.DatabaseSync(dbPath);
    globalThis.leoDb.exec("PRAGMA journal_mode = WAL;");
    globalThis.leoDb.exec("PRAGMA foreign_keys = ON;");
    migrate(globalThis.leoDb);
    seed(globalThis.leoDb);
  }

  return globalThis.leoDb;
}

function migrate(db: DatabaseLike) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_started',
      priority TEXT NOT NULL DEFAULT 'medium',
      tags_json TEXT NOT NULL DEFAULT '[]',
      startDate TEXT,
      dueDate TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      completedAt TEXT,
      archivedAt TEXT,
      reminderRule TEXT DEFAULT 'none',
      progressCurrent REAL,
      progressTarget REAL,
      progressUnit TEXT,
      progressEnabled INTEGER NOT NULL DEFAULT 0,
      progressType TEXT NOT NULL DEFAULT 'none',
      pinnedToBottom INTEGER NOT NULL DEFAULT 0,
      parentPlanId TEXT,
      originalImageId TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS subtasks (
      id TEXT PRIMARY KEY,
      taskId TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_tags (
      taskId TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      tagId TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (taskId, tagId)
    );

    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      startDate TEXT NOT NULL,
      endDate TEXT NOT NULL,
      reflectionNote TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS plan_items (
      planId TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
      taskId TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      sortOrder INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (planId, taskId)
    );

    CREATE TABLE IF NOT EXISTS todo_lists (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      notes TEXT,
      sourcePlanId TEXT UNIQUE,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS todo_list_items (
      id TEXT PRIMARY KEY,
      todoListId TEXT NOT NULL REFERENCES todo_lists(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      sortOrder INTEGER NOT NULL DEFAULT 0,
      hasScheduleTime INTEGER NOT NULL DEFAULT 0,
      scheduledStartAt TEXT,
      scheduledEndAt TEXT,
      scheduledTimezone TEXT,
      parsedTimeText TEXT,
      scheduleParseConfidence REAL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS progress_items (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      currentValue REAL NOT NULL DEFAULT 0,
      targetValue REAL NOT NULL DEFAULT 1,
      unit TEXT DEFAULT '',
      category TEXT DEFAULT 'general',
      linkedTaskId TEXT,
      pinned INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_progress_entries (
      id TEXT PRIMARY KEY,
      taskId TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      createdAt TEXT NOT NULL,
      amountDelta REAL,
      currentValueAfter REAL,
      durationMinutes REAL,
      note TEXT
    );

    CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      semester TEXT NOT NULL,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS class_sessions (
      id TEXT PRIMARY KEY,
      courseId TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      dayOfWeek INTEGER NOT NULL,
      startTime TEXT NOT NULL,
      endTime TEXT NOT NULL,
      type TEXT NOT NULL,
      location TEXT NOT NULL,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY,
      courseId TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      dueDate TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_started',
      weight REAL,
      notes TEXT,
      linkedTaskId TEXT
    );

    CREATE TABLE IF NOT EXISTS timetable_sources (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      feedUrl TEXT,
      semester TEXT NOT NULL,
      academicYear INTEGER NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'Australia/Sydney',
      lastSyncedAt TEXT,
      lastSyncStatus TEXT NOT NULL DEFAULT 'idle',
      lastSyncError TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS timetable_courses (
      id TEXT PRIMARY KEY,
      courseCode TEXT NOT NULL,
      courseName TEXT NOT NULL,
      activityType TEXT NOT NULL,
      activityName TEXT,
      semester TEXT NOT NULL,
      academicYear INTEGER NOT NULL,
      defaultLocation TEXT,
      campus TEXT,
      color TEXT NOT NULL DEFAULT '#0f172a',
      notes TEXT,
      sourceType TEXT NOT NULL DEFAULT 'manual',
      sourceId TEXT,
      externalUid TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS course_occurrences (
      id TEXT PRIMARY KEY,
      courseId TEXT NOT NULL REFERENCES timetable_courses(id) ON DELETE CASCADE,
      startAt TEXT NOT NULL,
      endAt TEXT NOT NULL,
      location TEXT,
      campus TEXT,
      status TEXT NOT NULL DEFAULT 'scheduled',
      isException INTEGER NOT NULL DEFAULT 0,
      originalStartAt TEXT,
      sourceUpdatedAt TEXT,
      localModifiedAt TEXT,
      localModifiedFields TEXT NOT NULL DEFAULT '[]',
      notes TEXT,
      sourceType TEXT NOT NULL DEFAULT 'manual',
      sourceId TEXT,
      externalUid TEXT,
      occurrenceStart TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_course_occurrences_source_instance
      ON course_occurrences(sourceId, externalUid, occurrenceStart)
      WHERE sourceId IS NOT NULL AND externalUid IS NOT NULL AND occurrenceStart IS NOT NULL;

    CREATE TABLE IF NOT EXISTS journal_entries (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      source TEXT NOT NULL,
      content TEXT NOT NULL,
      linkedPlanId TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL DEFAULT 'expense',
      title TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'AUD',
      category TEXT NOT NULL,
      date TEXT NOT NULL,
      merchant TEXT,
      paymentMethod TEXT,
      notes TEXT,
      receiptFileId TEXT REFERENCES uploaded_files(id) ON DELETE SET NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS important_files (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '其他',
      tags_json TEXT NOT NULL DEFAULT '[]',
      notes TEXT,
      expiryDate TEXT,
      fileId TEXT NOT NULL REFERENCES uploaded_files(id) ON DELETE CASCADE,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS uploaded_files (
      id TEXT PRIMARY KEY,
      originalName TEXT NOT NULL,
      storedName TEXT NOT NULL,
      path TEXT NOT NULL,
      mimeType TEXT NOT NULL,
      size INTEGER NOT NULL,
      createdAt TEXT NOT NULL,
      linkedEntityType TEXT,
      linkedEntityId TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `);
  ensureColumn(db, "tasks", "progressEnabled", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "tasks", "progressType", "TEXT NOT NULL DEFAULT 'none'");
  ensureColumn(db, "tasks", "pinnedToBottom", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "todo_lists", "sourcePlanId", "TEXT");
  ensureColumn(db, "important_files", "expiryDate", "TEXT");
  ensureColumn(db, "expenses", "type", "TEXT NOT NULL DEFAULT 'expense'");
  ensureColumn(db, "todo_list_items", "hasScheduleTime", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "todo_list_items", "scheduledStartAt", "TEXT");
  ensureColumn(db, "todo_list_items", "scheduledEndAt", "TEXT");
  ensureColumn(db, "todo_list_items", "scheduledTimezone", "TEXT");
  ensureColumn(db, "todo_list_items", "parsedTimeText", "TEXT");
  ensureColumn(db, "todo_list_items", "scheduleParseConfidence", "REAL");
  db.exec(`
    UPDATE tasks
    SET progressEnabled = 1,
        progressType = CASE
          WHEN progressUnit = '%' THEN 'percentage'
          WHEN progressUnit = '页' THEN 'pages'
          WHEN progressUnit IN ('小时', '分钟', 'h', 'hour', 'hours') THEN 'time'
          WHEN progressUnit IS NOT NULL AND progressUnit != '' THEN 'count'
          ELSE 'custom'
        END
    WHERE progressTarget IS NOT NULL AND progressEnabled = 0;
  `);
  migrateProgressItemsToTasks(db);
  migrateDailyPlansToTodoLists(db);
  backfillTodoScheduleFields(db);
}

function ensureColumn(db: DatabaseLike, table: string, column: string, definition: string) {
  const existing = db.prepare(`PRAGMA table_info(${table})`).all().some((row) => row.name === column);
  if (!existing) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
}

function writeSetting(db: DatabaseLike, key: string, value: string) {
  db.prepare("INSERT OR REPLACE INTO settings (key, value, updatedAt) VALUES (?, ?, ?)").run(key, value, now());
}

export function getAppSettings(db = getDb()): AppSettings {
  const rows = db.prepare("SELECT key, value FROM settings WHERE key IN (?, ?, ?)")
    .all("lastUsedCurrency", "homeTitle", "showHomeTitle");
  const values = new Map(rows.map((row) => [String(row.key), String(row.value)]));
  const lastUsedCurrency = values.get("lastUsedCurrency");
  const storedHomeTitle = values.get("homeTitle")?.trim();
  return {
    lastUsedCurrency: isSupportedCurrencyCode(lastUsedCurrency) ? lastUsedCurrency : null,
    homeTitle: !storedHomeTitle || storedHomeTitle === "Leo的生活学习助手" ? "MyAssist" : storedHomeTitle,
    showHomeTitle: values.get("showHomeTitle") !== "0"
  };
}

export function updateAppSettings(input: Partial<AppSettings>) {
  const db = getDb();
  if (input.lastUsedCurrency !== undefined) {
    if (input.lastUsedCurrency === null) writeSetting(db, "lastUsedCurrency", "");
    else if (isSupportedCurrencyCode(input.lastUsedCurrency)) writeSetting(db, "lastUsedCurrency", input.lastUsedCurrency);
  }
  if (input.homeTitle !== undefined) {
    writeSetting(db, "homeTitle", input.homeTitle.trim() || "MyAssist");
  }
  if (input.showHomeTitle !== undefined) {
    writeSetting(db, "showHomeTitle", input.showHomeTitle ? "1" : "0");
  }
  return getAppSettings(db);
}

function scheduleFields(content: string, date: string) {
  const parsed = parseScheduleTime(content);
  if (!parsed) {
    return {
      hasScheduleTime: 0,
      scheduledStartAt: null,
      scheduledEndAt: null,
      scheduledTimezone: null,
      parsedTimeText: null,
      scheduleParseConfidence: null
    };
  }
  return {
    hasScheduleTime: 1,
    scheduledStartAt: `${date}T${parsed.startTime}:00`,
    scheduledEndAt: `${date}T${parsed.endTime}:00`,
    scheduledTimezone: "Australia/Sydney",
    parsedTimeText: parsed.parsedTimeText,
    scheduleParseConfidence: parsed.confidence
  };
}

function backfillTodoScheduleFields(db: DatabaseLike) {
  const migrated = db.prepare("SELECT value FROM settings WHERE key = ?").get("todo_schedule_fields_backfilled");
  if (migrated?.value === "1") return;
  const rows = db.prepare(`
    SELECT i.id, i.content, l.date
    FROM todo_list_items i
    JOIN todo_lists l ON l.id = i.todoListId
  `).all();
  const update = db.prepare(`
    UPDATE todo_list_items SET
      hasScheduleTime = ?, scheduledStartAt = ?, scheduledEndAt = ?, scheduledTimezone = ?,
      parsedTimeText = ?, scheduleParseConfidence = ?
    WHERE id = ?
  `);
  for (const row of rows) {
    const fields = scheduleFields(String(row.content), String(row.date));
    update.run(
      fields.hasScheduleTime,
      fields.scheduledStartAt,
      fields.scheduledEndAt,
      fields.scheduledTimezone,
      fields.parsedTimeText,
      fields.scheduleParseConfidence,
      row.id
    );
  }
  db.prepare("INSERT OR REPLACE INTO settings (key, value, updatedAt) VALUES (?, ?, ?)").run(
    "todo_schedule_fields_backfilled",
    "1",
    now()
  );
}

function migrateDailyPlansToTodoLists(db: DatabaseLike) {
  const flag = db.prepare("SELECT value FROM settings WHERE key = ?").get("todo_lists_migrated_from_daily_plans");
  if (flag?.value === "1") return;

  const dailyPlans = db.prepare("SELECT * FROM plans WHERE type = 'daily' ORDER BY createdAt ASC").all();
  for (const plan of dailyPlans) {
    const planId = String(plan.id);
    const existing = db.prepare("SELECT id FROM todo_lists WHERE sourcePlanId = ?").get(planId);
    if (existing) continue;

    const taskRows = db.prepare(`
      SELECT t.*
      FROM tasks t
      JOIN plan_items pi ON pi.taskId = t.id
      WHERE pi.planId = ?
      ORDER BY pi.sortOrder ASC
    `).all(planId);
    if (taskRows.length === 0) continue;

    const timestamp = now();
    const todoListId = randomUUID();
    db.prepare(
      "INSERT INTO todo_lists (id, title, date, notes, sourcePlanId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(
      todoListId,
      String(plan.title),
      String(plan.startDate),
      plan.reflectionNote ?? null,
      planId,
      String(plan.createdAt ?? timestamp),
      timestamp
    );

    taskRows.forEach((task, index) => {
      db.prepare(
        "INSERT INTO todo_list_items (id, todoListId, content, completed, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(
        randomUUID(),
        todoListId,
        String(task.title),
        String(task.status) === "completed" || String(task.status) === "archived" ? 1 : 0,
        index,
        String(task.createdAt ?? timestamp),
        timestamp
      );
    });
  }

  db.prepare("INSERT OR REPLACE INTO settings (key, value, updatedAt) VALUES (?, ?, ?)").run(
    "todo_lists_migrated_from_daily_plans",
    "1",
    now()
  );
}

function migrateProgressItemsToTasks(db: DatabaseLike) {
  const flag = db.prepare("SELECT value FROM settings WHERE key = ?").get("progress_items_migrated_to_tasks");
  if (flag?.value === "1") return;

  const progressItems = db.prepare("SELECT * FROM progress_items ORDER BY createdAt ASC").all();
  for (const item of progressItems) {
    const timestamp = String(item.updatedAt ?? now());
    const linkedTaskId = item.linkedTaskId ? String(item.linkedTaskId) : null;
    const existingTask = linkedTaskId ? db.prepare("SELECT id FROM tasks WHERE id = ?").get(linkedTaskId) : undefined;
    let taskId = existingTask?.id ? String(existingTask.id) : "";
    const currentValue = Number(item.currentValue ?? 0);
    const targetValue = Number(item.targetValue ?? 1);
    const unit = String(item.unit ?? "");
    const progressType = inferProgressType(unit);
    const pinned = Number(item.pinned ?? 0) === 1;

    if (taskId) {
      db.prepare(`
        UPDATE tasks
        SET progressEnabled = 1,
            progressCurrent = ?,
            progressTarget = ?,
            progressUnit = ?,
            progressType = ?,
            pinnedToBottom = ?,
            updatedAt = ?
        WHERE id = ?
      `).run(currentValue, targetValue, unit, progressType, pinned ? 1 : 0, timestamp, taskId);
    } else {
      taskId = randomUUID();
      const tags = normalizeTaskTags("counter", [String(item.category ?? "进度")]);
      db.prepare(
        `INSERT INTO tasks
         (id, title, description, type, status, priority, tags_json, startDate, dueDate, createdAt, updatedAt,
          completedAt, archivedAt, reminderRule, progressCurrent, progressTarget, progressUnit, progressEnabled,
          progressType, pinnedToBottom, parentPlanId, originalImageId, notes)
         VALUES (?, ?, '', 'counter', 'not_started', 'medium', ?, NULL, NULL, ?, ?, NULL, NULL, 'none', ?, ?, ?, 1, ?, ?, NULL, NULL, NULL)`
      ).run(
        taskId,
        String(item.title ?? "进度任务"),
        JSON.stringify(tags),
        String(item.createdAt ?? timestamp),
        timestamp,
        currentValue,
        targetValue,
        unit,
        progressType,
        pinned ? 1 : 0
      );
      syncTags(taskId, tags, db);
      db.prepare("UPDATE progress_items SET linkedTaskId = ?, updatedAt = ? WHERE id = ?").run(taskId, timestamp, item.id);
    }

    if (pinned) db.prepare("UPDATE tasks SET pinnedToBottom = CASE WHEN id = ? THEN 1 ELSE 0 END").run(taskId);
    const existingEntry = db.prepare("SELECT id FROM task_progress_entries WHERE taskId = ? AND currentValueAfter = ? LIMIT 1").get(taskId, currentValue);
    if (!existingEntry && currentValue !== 0) {
      db.prepare(
        "INSERT INTO task_progress_entries (id, taskId, createdAt, amountDelta, currentValueAfter, durationMinutes, note) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(randomUUID(), taskId, timestamp, null, currentValue, null, "从旧进度记录迁移");
    }
  }

  db.prepare("INSERT OR REPLACE INTO settings (key, value, updatedAt) VALUES (?, ?, ?)").run(
    "progress_items_migrated_to_tasks",
    "1",
    now()
  );
}

function seed(db: DatabaseLike) {
  const createdAt = now();
  db.prepare("INSERT OR IGNORE INTO settings (key, value, updatedAt) VALUES (?, ?, ?)").run(
    "background",
    "default",
    createdAt
  );
}

function parseJsonArray(value: unknown) {
  try {
    const parsed = JSON.parse(String(value ?? "[]"));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function rowToTask(row: Record<string, unknown>, subtasks: Subtask[] = [], progressEntries: TaskProgressEntry[] = []): Task {
  const progressCurrent = row.progressCurrent === null || row.progressCurrent === undefined ? null : Number(row.progressCurrent);
  const progressTarget = row.progressTarget === null || row.progressTarget === undefined ? null : Number(row.progressTarget);
  const progressEnabled = Number(row.progressEnabled ?? 0) === 1 || progressTarget !== null;
  return {
    id: String(row.id),
    title: String(row.title),
    description: String(row.description ?? ""),
    type: normalizeTaskType(String(row.type)) as Task["type"],
    status: row.status as Task["status"],
    priority: row.priority as Task["priority"],
    tags: JSON.parse(String(row.tags_json ?? "[]")),
    startDate: row.startDate ? String(row.startDate) : null,
    dueDate: row.dueDate ? String(row.dueDate) : null,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
    completedAt: row.completedAt ? String(row.completedAt) : null,
    archivedAt: row.archivedAt ? String(row.archivedAt) : null,
    reminderRule: row.reminderRule ? String(row.reminderRule) : "none",
    progressCurrent,
    progressTarget,
    progressUnit: row.progressUnit ? String(row.progressUnit) : null,
    progressEnabled,
    progressType: (row.progressType ? String(row.progressType) : progressEnabled ? inferProgressType(String(row.progressUnit ?? "")) : "none") as Task["progressType"],
    pinnedToBottom: Number(row.pinnedToBottom ?? 0) === 1,
    parentPlanId: row.parentPlanId ? String(row.parentPlanId) : null,
    originalImageId: row.originalImageId ? String(row.originalImageId) : null,
    notes: row.notes ? String(row.notes) : null,
    subtasks,
    progressEntries
  };
}

function inferProgressType(unit: string) {
  if (unit === "%") return "percentage";
  if (unit === "页") return "pages";
  if (["小时", "分钟", "h", "hour", "hours"].includes(unit)) return "time";
  if (unit) return "count";
  return "custom";
}

function rowToSubtask(row: Record<string, unknown>): Subtask {
  return {
    id: String(row.id),
    taskId: String(row.taskId),
    title: String(row.title),
    completed: Number(row.completed) === 1,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt)
  };
}

function rowToTodoListItem(row: Record<string, unknown>): TodoListItem {
  return {
    id: String(row.id),
    todoListId: String(row.todoListId),
    content: String(row.content),
    completed: Number(row.completed) === 1,
    order: Number(row.sortOrder ?? 0),
    hasScheduleTime: Number(row.hasScheduleTime ?? 0) === 1,
    scheduledStartAt: row.scheduledStartAt ? String(row.scheduledStartAt) : null,
    scheduledEndAt: row.scheduledEndAt ? String(row.scheduledEndAt) : null,
    scheduledTimezone: row.scheduledTimezone ? String(row.scheduledTimezone) : null,
    parsedTimeText: row.parsedTimeText ? String(row.parsedTimeText) : null,
    scheduleParseConfidence: row.scheduleParseConfidence === null || row.scheduleParseConfidence === undefined
      ? null
      : Number(row.scheduleParseConfidence),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt)
  };
}

function rowToTodoList(row: Record<string, unknown>, items: TodoListItem[] = []): TodoList {
  return {
    id: String(row.id),
    title: String(row.title),
    date: String(row.date),
    notes: row.notes ? String(row.notes) : null,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
    items
  };
}

function rowToProgressEntry(row: Record<string, unknown>): TaskProgressEntry {
  return {
    id: String(row.id),
    taskId: String(row.taskId),
    createdAt: String(row.createdAt),
    amountDelta: row.amountDelta === null || row.amountDelta === undefined ? null : Number(row.amountDelta),
    currentValueAfter: row.currentValueAfter === null || row.currentValueAfter === undefined ? null : Number(row.currentValueAfter),
    durationMinutes: row.durationMinutes === null || row.durationMinutes === undefined ? null : Number(row.durationMinutes),
    note: row.note ? String(row.note) : null
  };
}

function rowToExpense(row: Record<string, unknown>): Expense {
  return {
    id: String(row.id),
    type: row.type === "income" ? "income" : "expense",
    title: String(row.title),
    amount: Number(row.amount),
    currency: String(row.currency ?? "AUD") as Expense["currency"],
    category: String(row.category),
    date: String(row.date),
    merchant: row.merchant ? String(row.merchant) : null,
    paymentMethod: row.paymentMethod ? String(row.paymentMethod) : null,
    notes: row.notes ? String(row.notes) : null,
    receiptFileId: row.receiptFileId ? String(row.receiptFileId) : null,
    receiptOriginalName: row.receiptOriginalName ? String(row.receiptOriginalName) : null,
    receiptMimeType: row.receiptMimeType ? String(row.receiptMimeType) : null,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt)
  };
}

function rowToImportantFile(row: Record<string, unknown>): ImportantFile {
  return {
    id: String(row.id),
    title: String(row.title),
    category: String(row.category ?? "其他"),
    tags: parseJsonArray(row.tags_json),
    notes: row.notes ? String(row.notes) : null,
    fileId: String(row.fileId),
    originalName: String(row.originalName ?? ""),
    mimeType: String(row.mimeType ?? "application/octet-stream"),
    size: Number(row.size ?? 0),
    expiryDate: row.expiryDate ? String(row.expiryDate) : null,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt)
  };
}

function normalizeTaskTags(type: Task["type"], tags: string[]) {
  const normalized = [...new Set(tags.map((tag) => String(tag).trim()).filter(Boolean))];
  if (type === "checklist" && !normalized.includes("清单")) normalized.push("清单");
  return normalized;
}

function syncTags(taskId: string, tags: string[], db = getDb()) {
  db.prepare("DELETE FROM task_tags WHERE taskId = ?").run(taskId);
  for (const tag of tags.filter(Boolean)) {
    const tagId = randomUUID();
    db.prepare("INSERT OR IGNORE INTO tags (id, name, createdAt) VALUES (?, ?, ?)").run(tagId, tag, now());
    const existing = db.prepare("SELECT id FROM tags WHERE name = ?").get(tag);
    if (existing?.id) {
      db.prepare("INSERT OR IGNORE INTO task_tags (taskId, tagId) VALUES (?, ?)").run(taskId, existing.id);
    }
  }
}

export function createTask(input: TaskInput, db = getDb(), createdAt = now()) {
  const id = randomUUID();
  const taskType = (normalizeTaskType(input.type) ?? "todo") as Task["type"];
  const tags = normalizeTaskTags(taskType, input.tags ?? []);
  if (input.pinnedToBottom) {
    db.prepare("UPDATE tasks SET pinnedToBottom = 0").run();
    db.prepare("UPDATE progress_items SET pinned = 0").run();
  }
  db.prepare(
    `INSERT INTO tasks
     (id, title, description, type, status, priority, tags_json, startDate, dueDate, createdAt, updatedAt,
      completedAt, archivedAt, reminderRule, progressCurrent, progressTarget, progressUnit, progressEnabled, progressType,
      pinnedToBottom, parentPlanId, originalImageId, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.title ?? "未命名任务",
    input.description ?? "",
    taskType,
    input.status ?? "not_started",
    input.priority ?? "medium",
    JSON.stringify(tags),
    input.startDate ?? null,
    input.dueDate ?? null,
    createdAt,
    createdAt,
    input.completedAt ?? null,
    input.archivedAt ?? null,
    input.reminderRule ?? "none",
    input.progressCurrent ?? null,
    input.progressTarget ?? null,
    input.progressUnit ?? null,
    input.progressEnabled || input.progressTarget !== null && input.progressTarget !== undefined ? 1 : 0,
    input.progressType ?? (input.progressTarget !== null && input.progressTarget !== undefined ? inferProgressType(input.progressUnit ?? "") : "none"),
    input.pinnedToBottom ? 1 : 0,
    input.parentPlanId ?? null,
    input.originalImageId ?? null,
    input.notes ?? null
  );

  syncTags(id, tags, db);
  if (input.subtasks?.length) syncTaskSubtasks(id, input.subtasks, db);

  return getTask(id, db)!;
}

export function createSubtask(taskId: string, title: string, db = getDb()) {
  const timestamp = now();
  db.prepare("INSERT INTO subtasks (id, taskId, title, completed, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)").run(
    randomUUID(),
    taskId,
    title,
    0,
    timestamp,
    timestamp
  );
}

function syncTaskSubtasks(taskId: string, drafts: SubtaskDraftInput[], db = getDb()) {
  const timestamp = now();
  const existingRows = db.prepare("SELECT id, createdAt FROM subtasks WHERE taskId = ?").all(taskId);
  const createdAtById = new Map(existingRows.map((row) => [String(row.id), String(row.createdAt)]));
  db.prepare("DELETE FROM subtasks WHERE taskId = ?").run(taskId);
  drafts
    .map((draft) => {
      if (typeof draft === "string") return { id: randomUUID(), title: draft.trim(), completed: false };
      return {
        id: draft.id || randomUUID(),
        title: String(draft.title ?? "").trim(),
        completed: Boolean(draft.completed)
      };
    })
    .filter((draft) => draft.title)
    .forEach((draft) => {
      db.prepare("INSERT INTO subtasks (id, taskId, title, completed, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)").run(
        draft.id,
        taskId,
        draft.title,
        draft.completed ? 1 : 0,
        createdAtById.get(draft.id) ?? timestamp,
        timestamp
      );
    });
}

export function setSubtaskCompleted(id: string, completed: boolean) {
  const db = getDb();
  const timestamp = now();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("UPDATE subtasks SET completed = ?, updatedAt = ? WHERE id = ?").run(completed ? 1 : 0, timestamp, id);
    const row = db.prepare("SELECT * FROM subtasks WHERE id = ?").get(id);
    if (!row) {
      db.exec("COMMIT");
      return null;
    }
    const taskId = String((row as { taskId?: unknown }).taskId ?? "");
    db.prepare(`
      UPDATE tasks
      SET status = CASE WHEN status = 'not_started' THEN 'in_progress' ELSE status END,
          progressCurrent = CASE
            WHEN type = 'checklist' AND progressEnabled = 1 AND progressType = 'count'
            THEN (SELECT COUNT(*) FROM subtasks WHERE taskId = ? AND completed = 1)
            ELSE progressCurrent
          END,
          progressTarget = CASE
            WHEN type = 'checklist' AND progressEnabled = 1 AND progressType = 'count'
            THEN (SELECT COUNT(*) FROM subtasks WHERE taskId = ?)
            ELSE progressTarget
          END,
          progressUnit = CASE
            WHEN type = 'checklist' AND progressEnabled = 1 AND progressType = 'count' THEN '项'
            ELSE progressUnit
          END,
          updatedAt = ?
      WHERE id = ?
    `).run(taskId, taskId, timestamp, taskId);
    db.exec("COMMIT");
    return rowToSubtask(row);
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function getTask(id: string, db = getDb()) {
  const row = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
  if (!row) return null;
  const subtasks = db.prepare("SELECT * FROM subtasks WHERE taskId = ? ORDER BY createdAt ASC").all(id).map(rowToSubtask);
  const progressEntries = listProgressEntries(id, db);
  return rowToTask(row, subtasks, progressEntries);
}

function isVisibleTask(task: Task) {
  return task.type !== "plan_item" && !task.tags.includes("To Do List");
}

export function listTasks(options: { archive?: boolean; includeArchived?: boolean } = {}) {
  const db = getDb();
  const where = options.includeArchived
    ? ""
    : options.archive
      ? "WHERE status IN ('completed', 'archived') OR (dueDate IS NOT NULL AND dueDate < date('now'))"
      : "WHERE status NOT IN ('completed', 'archived')";
  const rows = db.prepare(`SELECT * FROM tasks ${where} ORDER BY 
    CASE status WHEN 'not_started' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'completed' THEN 2 ELSE 3 END,
    COALESCE(dueDate, startDate, createdAt) ASC,
    createdAt DESC`).all();
  return (rows.map((row) => getTask(String(row.id), db)).filter(Boolean) as Task[]).filter(isVisibleTask);
}

export function updateTask(id: string, input: TaskInput) {
  const db = getDb();
  const current = getTask(id, db);
  if (!current) return null;

  const next = {
    ...current,
    ...input,
    tags: input.tags ?? current.tags,
    type: normalizeTaskType(input.type ?? current.type) as Task["type"],
    progressEnabled: input.progressEnabled ?? current.progressEnabled,
    progressType: input.progressType ?? current.progressType ?? "none",
    pinnedToBottom: input.pinnedToBottom ?? current.pinnedToBottom
  };
  next.tags = normalizeTaskTags(next.type, next.tags);

  const shouldAutoStart = input.status === undefined && current.status === "not_started";
  if (shouldAutoStart) next.status = "in_progress";
  if (next.pinnedToBottom) {
    db.prepare("UPDATE tasks SET pinnedToBottom = 0 WHERE id != ?").run(id);
    db.prepare("UPDATE progress_items SET pinned = 0").run();
  }

  db.prepare(
    `UPDATE tasks SET
      title = ?, description = ?, type = ?, status = ?, priority = ?, tags_json = ?, startDate = ?, dueDate = ?,
      updatedAt = ?, completedAt = ?, archivedAt = ?, reminderRule = ?, progressCurrent = ?, progressTarget = ?,
      progressUnit = ?, progressEnabled = ?, progressType = ?, pinnedToBottom = ?, parentPlanId = ?, originalImageId = ?, notes = ?
     WHERE id = ?`
  ).run(
    next.title,
    next.description ?? "",
    next.type,
    next.status,
    next.priority,
    JSON.stringify(next.tags),
    next.startDate ?? null,
    next.dueDate ?? null,
    now(),
    next.completedAt ?? null,
    next.archivedAt ?? null,
    next.reminderRule ?? "none",
    next.progressCurrent ?? null,
    next.progressTarget ?? null,
    next.progressUnit ?? null,
    next.progressEnabled ? 1 : 0,
    next.progressType ?? "none",
    next.pinnedToBottom ? 1 : 0,
    next.parentPlanId ?? null,
    next.originalImageId ?? null,
    next.notes ?? null,
    id
  );

  syncTags(id, next.tags, db);
  if (input.subtasks) {
    syncTaskSubtasks(id, input.subtasks, db);
  }

  return getTask(id, db);
}

export function setTaskStatus(id: string, status: "completed" | "archived" | "not_started") {
  const timestamp = now();
  const patch: TaskInput = { status };
  if (status === "completed") {
    patch.completedAt = timestamp;
    patch.archivedAt = timestamp;
  }
  if (status === "archived") patch.archivedAt = timestamp;
  if (status === "not_started") {
    patch.completedAt = null;
    patch.archivedAt = null;
  }
  return updateTask(id, patch);
}

export function deleteTask(id: string) {
  const db = getDb();
  return db.prepare("DELETE FROM tasks WHERE id = ?").run(id).changes;
}

export function listProgress() {
  const db = getDb();
  const taskRows = db.prepare(`
    SELECT * FROM tasks
    WHERE status NOT IN ('completed', 'archived')
      AND (progressEnabled = 1 OR progressTarget IS NOT NULL)
    ORDER BY pinnedToBottom DESC, updatedAt DESC
  `).all();

  return taskRows.map((row) => ({
    id: String(row.id),
    title: String(row.title),
    currentValue: row.progressCurrent === null || row.progressCurrent === undefined ? 0 : Number(row.progressCurrent),
    targetValue: row.progressTarget === null || row.progressTarget === undefined ? 1 : Number(row.progressTarget),
    unit: String(row.progressUnit ?? ""),
    category: JSON.parse(String(row.tags_json ?? "[]"))[0] ?? String(row.type ?? "task"),
    linkedTaskId: String(row.id),
    pinned: Number(row.pinnedToBottom ?? 0) === 1,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt)
  })) as ProgressItem[];
}

export function createProgress(input: Partial<ProgressItem>) {
  const task = createTask({
    title: input.title ?? "新进度任务",
    type: "counter",
    status: "not_started",
    tags: input.category ? [input.category] : ["进度"],
    progressEnabled: true,
    progressType: input.unit === "%" ? "percentage" : input.unit === "页" ? "pages" : "count",
    progressCurrent: input.currentValue ?? 0,
    progressTarget: input.targetValue ?? 1,
    progressUnit: input.unit ?? "",
    pinnedToBottom: input.pinned ?? false
  });
  return listProgress().find((item) => item.id === task.id)!;
}

export function updateProgress(id: string, input: Partial<ProgressItem>) {
  const db = getDb();
  const task = getTask(id, db);
  if (task) {
    const updated = updateTask(id, {
      title: input.title ?? task.title,
      progressEnabled: true,
      progressCurrent: input.currentValue ?? task.progressCurrent ?? 0,
      progressTarget: input.targetValue ?? task.progressTarget ?? 1,
      progressUnit: input.unit ?? task.progressUnit ?? "",
      pinnedToBottom: input.pinned ?? task.pinnedToBottom
    });
    return listProgress().find((item) => item.id === updated?.id)!;
  }
  const current = listProgress().find((item) => item.id === id);
  if (!current) return null;
  const next = { ...current, ...input };
  db.prepare(
    "UPDATE progress_items SET title = ?, currentValue = ?, targetValue = ?, unit = ?, category = ?, linkedTaskId = ?, pinned = ?, updatedAt = ? WHERE id = ?"
  ).run(
    next.title,
    next.currentValue,
    next.targetValue,
    next.unit,
    next.category,
    next.linkedTaskId ?? null,
    next.pinned ? 1 : 0,
    now(),
    id
  );
  if (next.linkedTaskId && next.currentValue > 0) {
    const linkedTask = getTask(next.linkedTaskId, db);
    if (linkedTask?.status === "not_started") {
      updateTask(next.linkedTaskId, { status: "in_progress" });
    }
  }
  return listProgress().find((item) => item.id === id)!;
}

export function pinProgress(id: string) {
  const db = getDb();
  const task = getTask(id, db);
  if (task) {
    db.prepare("UPDATE tasks SET pinnedToBottom = 0").run();
    db.prepare("UPDATE progress_items SET pinned = 0").run();
    db.prepare("UPDATE tasks SET pinnedToBottom = 1, progressEnabled = 1, updatedAt = ? WHERE id = ?").run(now(), id);
    return listProgress();
  }
  db.prepare("UPDATE progress_items SET pinned = 0").run();
  db.prepare("UPDATE tasks SET pinnedToBottom = 0").run();
  db.prepare("UPDATE progress_items SET pinned = 1, updatedAt = ? WHERE id = ?").run(now(), id);
  return listProgress();
}

export function listProgressEntries(taskId: string, db = getDb()) {
  return db
    .prepare("SELECT * FROM task_progress_entries WHERE taskId = ? ORDER BY createdAt ASC")
    .all(taskId)
    .map(rowToProgressEntry);
}

export function addProgressEntry(
  taskId: string,
  input: {
    amountDelta?: number | null;
    currentValueAfter?: number | null;
    durationMinutes?: number | null;
    note?: string | null;
  }
) {
  const db = getDb();
  const task = getTask(taskId, db);
  if (!task) return null;

  const timestamp = now();
  const amountDelta = input.amountDelta === undefined || input.amountDelta === null || Number.isNaN(Number(input.amountDelta))
    ? null
    : Number(input.amountDelta);
  const currentValueAfter = input.currentValueAfter === undefined || input.currentValueAfter === null || Number.isNaN(Number(input.currentValueAfter))
    ? null
    : Number(input.currentValueAfter);
  const durationMinutes = input.durationMinutes === undefined || input.durationMinutes === null || Number.isNaN(Number(input.durationMinutes))
    ? null
    : Number(input.durationMinutes);

  let nextCurrent = task.progressCurrent ?? 0;
  if (currentValueAfter !== null) nextCurrent = currentValueAfter;
  else if (amountDelta !== null) nextCurrent += amountDelta;

  db.prepare(
    "INSERT INTO task_progress_entries (id, taskId, createdAt, amountDelta, currentValueAfter, durationMinutes, note) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(randomUUID(), taskId, timestamp, amountDelta, currentValueAfter, durationMinutes, input.note ?? null);

  updateTask(taskId, {
    progressEnabled: true,
    progressCurrent: nextCurrent,
    progressTarget: task.progressTarget ?? 1,
    progressUnit: task.progressUnit ?? "",
    status: task.status === "not_started" ? "in_progress" : task.status
  });

  return getTask(taskId, db);
}

export function listTodoLists() {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM todo_lists ORDER BY date DESC, createdAt DESC").all();
  return rows.map((row) => getTodoList(String(row.id), db)).filter(Boolean) as TodoList[];
}

export function getTodoList(id: string, db = getDb()) {
  const row = db.prepare("SELECT * FROM todo_lists WHERE id = ?").get(id);
  if (!row) return null;
  const items = db
    .prepare("SELECT * FROM todo_list_items WHERE todoListId = ? ORDER BY sortOrder ASC, createdAt ASC")
    .all(id)
    .map(rowToTodoListItem);
  return rowToTodoList(row, items);
}

export function createTodoList(input: TodoListInput) {
  const db = getDb();
  const timestamp = now();
  const id = randomUUID();
  const date = input.date ?? todayIso();
  db.prepare(
    "INSERT INTO todo_lists (id, title, date, notes, sourcePlanId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(
    id,
    input.title ?? buildTodoListTitle(date),
    date,
    input.notes ?? null,
    input.sourcePlanId ?? null,
    timestamp,
    timestamp
  );
  syncTodoListItems(id, input.itemDrafts ?? [], db);
  return getTodoList(id, db)!;
}

export function updateTodoList(id: string, input: TodoListInput) {
  const db = getDb();
  const current = getTodoList(id, db);
  if (!current) return null;
  const next = { ...current, ...input };
  db.prepare("UPDATE todo_lists SET title = ?, date = ?, notes = ?, updatedAt = ? WHERE id = ?").run(
    next.title,
    next.date,
    next.notes ?? null,
    now(),
    id
  );
  if (input.itemDrafts) syncTodoListItems(id, input.itemDrafts, db);
  return getTodoList(id, db);
}

export function setTodoListItemCompleted(id: string, completed: boolean) {
  const db = getDb();
  db.prepare("UPDATE todo_list_items SET completed = ?, updatedAt = ? WHERE id = ?").run(completed ? 1 : 0, now(), id);
  const row = db.prepare("SELECT * FROM todo_list_items WHERE id = ?").get(id);
  return row ? rowToTodoListItem(row) : null;
}

function syncTodoListItems(
  todoListId: string,
  drafts: Array<{ id?: string; content?: string; title?: string; completed?: boolean }>,
  db: DatabaseLike
) {
  const timestamp = now();
  const todoList = db.prepare("SELECT date FROM todo_lists WHERE id = ?").get(todoListId);
  const date = String(todoList?.date ?? todayIso());
  db.prepare("DELETE FROM todo_list_items WHERE todoListId = ?").run(todoListId);
  drafts
    .map((draft) => ({
      id: draft.id || randomUUID(),
      content: String(draft.content ?? draft.title ?? "").trim(),
      completed: Boolean(draft.completed)
    }))
    .filter((draft) => draft.content)
    .forEach((draft, index) => {
      const fields = scheduleFields(draft.content, date);
      db.prepare(
        `INSERT INTO todo_list_items
         (id, todoListId, content, completed, sortOrder, hasScheduleTime, scheduledStartAt, scheduledEndAt,
          scheduledTimezone, parsedTimeText, scheduleParseConfidence, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        draft.id,
        todoListId,
        draft.content,
        draft.completed ? 1 : 0,
        index,
        fields.hasScheduleTime,
        fields.scheduledStartAt,
        fields.scheduledEndAt,
        fields.scheduledTimezone,
        fields.parsedTimeText,
        fields.scheduleParseConfidence,
        timestamp,
        timestamp
      );
    });
}

function buildTodoListTitle(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "ToDoList";
  return `${parsed.getFullYear()}年${parsed.getMonth() + 1}月${parsed.getDate()}日ToDoList`;
}

export function listPlans() {
  const db = getDb();
  const plans = db.prepare("SELECT * FROM plans ORDER BY startDate DESC").all().map((row) => ({
    id: String(row.id),
    title: String(row.title),
    type: row.type as Plan["type"],
    startDate: String(row.startDate),
    endDate: String(row.endDate),
    reflectionNote: row.reflectionNote ? String(row.reflectionNote) : null,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
    items: db.prepare("SELECT t.* FROM tasks t JOIN plan_items pi ON pi.taskId = t.id WHERE pi.planId = ? ORDER BY pi.sortOrder ASC").all(row.id).map((taskRow) => getTask(String(taskRow.id), db)).filter(Boolean)
  })) as Plan[];
  return plans;
}

export function createPlan(input: PlanInput) {
  const db = getDb();
  const timestamp = now();
  const id = randomUUID();
  const startDate = input.startDate ?? todayIso();
  const endDate = input.endDate ?? startDate;
  db.prepare(
    "INSERT INTO plans (id, title, type, startDate, endDate, reflectionNote, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(
    id,
    input.title ?? "新计划",
    input.type ?? "daily",
    startDate,
    endDate,
    input.reflectionNote ?? null,
    timestamp,
    timestamp
  );
  syncPlanItems(id, input, { title: input.title ?? "新计划", startDate, endDate, type: input.type ?? "daily" }, db);
  syncPlanReflectionToJournal(id);
  return listPlans().find((plan) => plan.id === id)!;
}

export function updatePlan(id: string, input: PlanInput) {
  const db = getDb();
  const current = listPlans().find((plan) => plan.id === id);
  if (!current) return null;
  const next = { ...current, ...input };
  db.prepare("UPDATE plans SET title = ?, type = ?, startDate = ?, endDate = ?, reflectionNote = ?, updatedAt = ? WHERE id = ?").run(
    next.title,
    next.type,
    next.startDate,
    next.endDate,
    next.reflectionNote ?? null,
    now(),
    id
  );
  if (input.taskIds || input.itemTitles) syncPlanItems(id, input, next, db);
  syncPlanReflectionToJournal(id);
  return listPlans().find((plan) => plan.id === id)!;
}

export function deletePlan(id: string) {
  const db = getDb();
  db.prepare("DELETE FROM journal_entries WHERE linkedPlanId = ?").run(id);
  return db.prepare("DELETE FROM plans WHERE id = ?").run(id).changes;
}

function syncPlanItems(
  planId: string,
  input: PlanInput,
  plan: { title: string; startDate: string; endDate: string; type: string },
  db: DatabaseLike
) {
  const existingTaskIds = input.taskIds ?? [];
  const drafts = input.itemDrafts ?? (input.itemTitles ?? []).map((title) => ({ title, completed: false }));
  const newTaskIds = drafts
    .map((draft) => ({ title: String(draft.title ?? "").trim(), completed: Boolean(draft.completed) }))
    .filter((draft) => draft.title)
    .map((draft) => {
      const completedAt = draft.completed ? now() : null;
      return (
      createTask(
        {
          title: draft.title,
          type: "plan_item",
          status: draft.completed ? "completed" : "not_started",
          priority: "medium",
          tags: [plan.type === "daily" ? "To Do List" : plan.title],
          startDate: plan.startDate,
          dueDate: plan.type === "daily" ? plan.endDate : null,
          completedAt,
          archivedAt: completedAt,
          parentPlanId: planId
        },
        db
      ).id
      );
    });
  const taskIds = [...existingTaskIds, ...newTaskIds];
  db.prepare("DELETE FROM plan_items WHERE planId = ?").run(planId);
  taskIds.forEach((taskId, index) => {
    db.prepare("INSERT OR IGNORE INTO plan_items (planId, taskId, sortOrder) VALUES (?, ?, ?)").run(planId, taskId, index);
  });
}

function syncPlanReflectionToJournal(planId: string) {
  const db = getDb();
  const plan = db.prepare("SELECT * FROM plans WHERE id = ?").get(planId);
  if (!plan || plan.type !== "daily") return;
  const content = String(plan.reflectionNote ?? "").trim();
  db.prepare("DELETE FROM journal_entries WHERE source = 'daily_plan' AND linkedPlanId = ?").run(planId);
  if (!content) return;
  const timestamp = now();
  db.prepare(
    "INSERT INTO journal_entries (id, date, source, content, linkedPlanId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(randomUUID(), plan.startDate, "daily_plan", content, planId, timestamp, timestamp);
}

export function listCourses() {
  const db = getDb();
  return db.prepare("SELECT * FROM courses ORDER BY code ASC").all().map((row) => {
    const courseId = String(row.id);
    return {
      id: courseId,
      code: String(row.code),
      name: String(row.name),
      semester: String(row.semester),
      notes: row.notes ? String(row.notes) : null,
      sessions: db.prepare("SELECT * FROM class_sessions WHERE courseId = ? ORDER BY dayOfWeek, startTime").all(courseId).map((session) => ({
        id: String(session.id),
        courseId: String(session.courseId),
        dayOfWeek: Number(session.dayOfWeek),
        startTime: String(session.startTime),
        endTime: String(session.endTime),
        type: String(session.type),
        location: String(session.location),
        notes: session.notes ? String(session.notes) : null
      })) as ClassSession[],
      assignments: db.prepare("SELECT * FROM assignments WHERE courseId = ? ORDER BY dueDate ASC").all(courseId).map((assignment) => ({
        id: String(assignment.id),
        courseId: String(assignment.courseId),
        title: String(assignment.title),
        dueDate: String(assignment.dueDate),
        status: String(assignment.status),
        weight: assignment.weight === null || assignment.weight === undefined ? null : Number(assignment.weight),
        notes: assignment.notes ? String(assignment.notes) : null,
        linkedTaskId: assignment.linkedTaskId ? String(assignment.linkedTaskId) : null
      })) as Assignment[]
    } satisfies Course;
  });
}

export function createCourse(input: {
  code?: string;
  name?: string;
  semester?: string;
  notes?: string;
  sessions?: Partial<ClassSession>[];
}) {
  const db = getDb();
  const id = randomUUID();
  db.prepare("INSERT INTO courses (id, code, name, semester, notes) VALUES (?, ?, ?, ?, ?)").run(
    id,
    input.code ?? "COURSE",
    input.name ?? "新课程",
    input.semester ?? "Semester 1",
    input.notes ?? ""
  );
  for (const session of input.sessions ?? []) {
    db.prepare(
      "INSERT INTO class_sessions (id, courseId, dayOfWeek, startTime, endTime, type, location, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      randomUUID(),
      id,
      session.dayOfWeek ?? new Date().getDay(),
      session.startTime ?? "09:00",
      session.endTime ?? "10:00",
      session.type ?? "lecture",
      session.location ?? "待确认",
      session.notes ?? ""
    );
  }
  return listCourses().find((course) => course.id === id)!;
}

function safeJsonArray(value: unknown) {
  try {
    const parsed = JSON.parse(String(value ?? "[]"));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function mapTimetableSource(row: Record<string, unknown>): TimetableSource {
  return {
    id: String(row.id),
    type: row.type as TimetableSource["type"],
    name: String(row.name),
    feedUrl: row.feedUrl ? String(row.feedUrl) : null,
    semester: String(row.semester),
    academicYear: Number(row.academicYear),
    timezone: String(row.timezone || "Australia/Sydney"),
    lastSyncedAt: row.lastSyncedAt ? String(row.lastSyncedAt) : null,
    lastSyncStatus: row.lastSyncStatus as TimetableSource["lastSyncStatus"],
    lastSyncError: row.lastSyncError ? String(row.lastSyncError) : null,
    enabled: Boolean(row.enabled),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt)
  };
}

function mapTimetableCourse(row: Record<string, unknown>): TimetableCourse {
  return {
    id: String(row.id),
    courseCode: String(row.courseCode),
    courseName: String(row.courseName),
    activityType: String(row.activityType),
    activityName: row.activityName ? String(row.activityName) : null,
    semester: String(row.semester),
    academicYear: Number(row.academicYear),
    defaultLocation: row.defaultLocation ? String(row.defaultLocation) : null,
    campus: row.campus ? String(row.campus) : null,
    color: String(row.color || "#0f172a"),
    notes: row.notes ? String(row.notes) : null,
    sourceType: row.sourceType as TimetableCourse["sourceType"],
    sourceId: row.sourceId ? String(row.sourceId) : null,
    externalUid: row.externalUid ? String(row.externalUid) : null,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt)
  };
}

function mapCourseOccurrence(row: Record<string, unknown>, course?: TimetableCourse): CourseOccurrence {
  return {
    id: String(row.id),
    courseId: String(row.courseId),
    course,
    startAt: String(row.startAt),
    endAt: String(row.endAt),
    location: row.location ? String(row.location) : null,
    campus: row.campus ? String(row.campus) : null,
    status: row.status as CourseOccurrence["status"],
    isException: Boolean(row.isException),
    originalStartAt: row.originalStartAt ? String(row.originalStartAt) : null,
    sourceUpdatedAt: row.sourceUpdatedAt ? String(row.sourceUpdatedAt) : null,
    localModifiedAt: row.localModifiedAt ? String(row.localModifiedAt) : null,
    localModifiedFields: safeJsonArray(row.localModifiedFields),
    notes: row.notes ? String(row.notes) : null,
    sourceType: row.sourceType as CourseOccurrence["sourceType"],
    sourceId: row.sourceId ? String(row.sourceId) : null,
    externalUid: row.externalUid ? String(row.externalUid) : null,
    occurrenceStart: row.occurrenceStart ? String(row.occurrenceStart) : null,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt)
  };
}

export function listTimetableSources() {
  return getDb()
    .prepare("SELECT * FROM timetable_sources ORDER BY updatedAt DESC")
    .all()
    .map(mapTimetableSource);
}

export function getTimetableSource(id: string) {
  const row = getDb().prepare("SELECT * FROM timetable_sources WHERE id = ?").get(id);
  return row ? mapTimetableSource(row) : null;
}

export function listTimetableCourses() {
  return getDb()
    .prepare("SELECT * FROM timetable_courses ORDER BY courseCode ASC, activityType ASC")
    .all()
    .map(mapTimetableCourse);
}

export function listCourseOccurrences(input: { from?: string; to?: string; includeCancelled?: boolean } = {}) {
  const db = getDb();
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (input.from) {
    clauses.push("o.endAt >= ?");
    params.push(input.from);
  }
  if (input.to) {
    clauses.push("o.startAt <= ?");
    params.push(input.to);
  }
  if (!input.includeCancelled) clauses.push("o.status != 'cancelled'");
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db.prepare(`SELECT o.*, c.courseCode, c.courseName, c.activityType, c.activityName, c.semester, c.academicYear, c.defaultLocation, c.color, c.notes AS courseNotes, c.sourceType AS courseSourceType, c.sourceId AS courseSourceId, c.externalUid AS courseExternalUid, c.createdAt AS courseCreatedAt, c.updatedAt AS courseUpdatedAt FROM course_occurrences o JOIN timetable_courses c ON c.id = o.courseId ${where} ORDER BY o.startAt ASC`).all(...params);
  return rows.map((row) => {
    const course = mapTimetableCourse({
      id: row.courseId,
      courseCode: row.courseCode,
      courseName: row.courseName,
      activityType: row.activityType,
      activityName: row.activityName,
      semester: row.semester,
      academicYear: row.academicYear,
      defaultLocation: row.defaultLocation,
      campus: row.campus,
      color: row.color,
      notes: row.courseNotes,
      sourceType: row.courseSourceType,
      sourceId: row.courseSourceId,
      externalUid: row.courseExternalUid,
      createdAt: row.courseCreatedAt,
      updatedAt: row.courseUpdatedAt
    });
    return mapCourseOccurrence(row, course);
  });
}

function findOrCreateTimetableSource(preview: TimetableImportPreview) {
  const db = getDb();
  const timestamp = now();
  const existing = preview.source.feedUrl
    ? db.prepare("SELECT * FROM timetable_sources WHERE feedUrl = ? AND type = ?").get(preview.source.feedUrl, preview.source.type)
    : undefined;
  if (existing) {
    db.prepare("UPDATE timetable_sources SET name = ?, semester = ?, academicYear = ?, timezone = ?, enabled = 1, updatedAt = ? WHERE id = ?")
      .run(preview.source.name, preview.source.semester, preview.source.academicYear, preview.source.timezone, timestamp, existing.id);
    return String(existing.id);
  }
  const id = randomUUID();
  db.prepare("INSERT INTO timetable_sources (id, type, name, feedUrl, semester, academicYear, timezone, lastSyncStatus, enabled, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, 'idle', 1, ?, ?)")
    .run(id, preview.source.type, preview.source.name, preview.source.feedUrl ?? null, preview.source.semester, preview.source.academicYear, preview.source.timezone, timestamp, timestamp);
  return id;
}

function findOrCreateTimetableCourse(course: TimetableCourse, sourceId: string) {
  const db = getDb();
  const timestamp = now();
  const existing = db.prepare(
    "SELECT * FROM timetable_courses WHERE sourceId = ? AND courseCode = ? AND courseName = ? AND activityType = ?"
  ).get(sourceId, course.courseCode, course.courseName, course.activityType);
  if (existing) {
    db.prepare("UPDATE timetable_courses SET activityName = ?, defaultLocation = ?, campus = ?, notes = ?, updatedAt = ? WHERE id = ?")
      .run(course.activityName ?? null, course.defaultLocation ?? null, course.campus ?? null, course.notes ?? null, timestamp, existing.id);
    return String(existing.id);
  }
  const id = randomUUID();
  db.prepare("INSERT INTO timetable_courses (id, courseCode, courseName, activityType, activityName, semester, academicYear, defaultLocation, campus, color, notes, sourceType, sourceId, externalUid, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(id, course.courseCode, course.courseName, course.activityType, course.activityName ?? null, course.semester, course.academicYear, course.defaultLocation ?? null, course.campus ?? null, course.color || "#0f172a", course.notes ?? null, course.sourceType, sourceId, course.externalUid ?? null, timestamp, timestamp);
  return id;
}

export function importTimetablePreview(preview: TimetableImportPreview) {
  const db = getDb();
  const timestamp = now();
  const sourceId = findOrCreateTimetableSource(preview);
  const courseIdMap = new Map<string, string>();
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let conflicts = 0;

  for (const course of preview.courses) {
    courseIdMap.set(course.id, findOrCreateTimetableCourse({ ...course, sourceId }, sourceId));
  }

  for (const occurrence of preview.occurrences) {
    const courseId = courseIdMap.get(occurrence.courseId);
    if (!courseId) continue;
    const occurrenceStart = occurrence.occurrenceStart || occurrence.startAt;
    const existing = occurrence.sourceId && occurrence.externalUid
      ? db.prepare("SELECT * FROM course_occurrences WHERE sourceId = ? AND externalUid = ? AND occurrenceStart = ?").get(sourceId, occurrence.externalUid, occurrenceStart)
      : undefined;
    if (existing) {
      const localFields = safeJsonArray(existing.localModifiedFields);
      if (localFields.length > 0) {
        conflicts += 1;
        skipped += 1;
        continue;
      }
      db.prepare("UPDATE course_occurrences SET courseId = ?, startAt = ?, endAt = ?, location = ?, campus = ?, status = ?, sourceUpdatedAt = ?, notes = ?, updatedAt = ? WHERE id = ?")
        .run(courseId, occurrence.startAt, occurrence.endAt, occurrence.location ?? null, occurrence.campus ?? null, occurrence.status, timestamp, occurrence.notes ?? null, timestamp, existing.id);
      updated += 1;
    } else {
      db.prepare("INSERT INTO course_occurrences (id, courseId, startAt, endAt, location, campus, status, isException, originalStartAt, sourceUpdatedAt, localModifiedFields, notes, sourceType, sourceId, externalUid, occurrenceStart, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(randomUUID(), courseId, occurrence.startAt, occurrence.endAt, occurrence.location ?? null, occurrence.campus ?? null, occurrence.status, occurrence.isException ? 1 : 0, occurrence.originalStartAt ?? null, timestamp, JSON.stringify([]), occurrence.notes ?? null, occurrence.sourceType || preview.source.type, sourceId, occurrence.externalUid ?? null, occurrenceStart, timestamp, timestamp);
      created += 1;
    }
  }

  db.prepare("UPDATE timetable_sources SET lastSyncedAt = ?, lastSyncStatus = 'success', lastSyncError = NULL, updatedAt = ? WHERE id = ?")
    .run(timestamp, timestamp, sourceId);

  return { sourceId, created, updated, skipped, conflicts };
}

function occurrenceScopeClause(occurrence: CourseOccurrence, scope: string) {
  if (scope === "series") return { clause: "courseId = ?", params: [occurrence.courseId] };
  if (scope === "future") return { clause: "courseId = ? AND startAt >= ?", params: [occurrence.courseId, occurrence.startAt] };
  const start = new Date(occurrence.startAt);
  const end = new Date(occurrence.startAt);
  if (scope === "week") {
    const day = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - day);
    start.setHours(0, 0, 0, 0);
    end.setTime(start.getTime());
    end.setDate(end.getDate() + 7);
  } else if (scope === "month") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end.setTime(start.getTime());
    end.setMonth(end.getMonth() + 1);
  } else {
    return { clause: "id = ?", params: [occurrence.id] };
  }
  return { clause: "courseId = ? AND startAt >= ? AND startAt < ?", params: [occurrence.courseId, start.toISOString(), end.toISOString()] };
}

export function updateCourseOccurrence(id: string, patch: Partial<CourseOccurrence>, scope = "single") {
  const current = listCourseOccurrences({ includeCancelled: true }).find((item) => item.id === id);
  if (!current) return null;
  const timestamp = now();
  const fields = ["startAt", "endAt", "location", "campus", "notes", "status"].filter((field) => field in patch);
  const scopeWhere = occurrenceScopeClause(current, scope);
  getDb().prepare(`UPDATE course_occurrences SET startAt = COALESCE(?, startAt), endAt = COALESCE(?, endAt), location = COALESCE(?, location), campus = COALESCE(?, campus), notes = COALESCE(?, notes), status = COALESCE(?, status), isException = 1, localModifiedAt = ?, localModifiedFields = ?, updatedAt = ? WHERE ${scopeWhere.clause} AND (localModifiedAt IS NULL OR ? = 'single')`)
    .run(patch.startAt ?? null, patch.endAt ?? null, patch.location ?? null, patch.campus ?? null, patch.notes ?? null, patch.status ?? null, timestamp, JSON.stringify(fields), timestamp, ...scopeWhere.params, scope);
  return listCourseOccurrences({ includeCancelled: true }).find((item) => item.id === id) ?? null;
}

export function cancelCourseOccurrence(id: string, scope = "single") {
  return updateCourseOccurrence(id, { status: "cancelled" }, scope);
}

export function listJournal() {
  const db = getDb();
  return db.prepare("SELECT * FROM journal_entries ORDER BY date DESC, createdAt DESC").all().map((row) => ({
    id: String(row.id),
    date: String(row.date),
    source: row.source as JournalEntry["source"],
    content: String(row.content),
    linkedPlanId: row.linkedPlanId ? String(row.linkedPlanId) : null,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt)
  })) as JournalEntry[];
}

export function createJournal(input: Partial<JournalEntry>) {
  const db = getDb();
  const timestamp = now();
  const id = randomUUID();
  db.prepare(
    "INSERT INTO journal_entries (id, date, source, content, linkedPlanId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(
    id,
    input.date ?? todayIso(),
    input.source ?? "manual",
    input.content ?? "",
    input.linkedPlanId ?? null,
    timestamp,
    timestamp
  );
  return listJournal().find((entry) => entry.id === id)!;
}

export function listExpenses() {
  const db = getDb();
  return db.prepare(`
    SELECT
      e.*,
      f.originalName AS receiptOriginalName,
      f.mimeType AS receiptMimeType
    FROM expenses e
    LEFT JOIN uploaded_files f ON f.id = e.receiptFileId
    ORDER BY e.date DESC, e.createdAt DESC
  `).all().map(rowToExpense);
}

export function getExpense(id: string, db = getDb()) {
  const row = db.prepare(`
    SELECT
      e.*,
      f.originalName AS receiptOriginalName,
      f.mimeType AS receiptMimeType
    FROM expenses e
    LEFT JOIN uploaded_files f ON f.id = e.receiptFileId
    WHERE e.id = ?
  `).get(id);
  return row ? rowToExpense(row) : null;
}

export function createExpense(input: ExpenseInput) {
  const db = getDb();
  const timestamp = now();
  const id = randomUUID();
  const amount = Number(input.amount ?? 0);
  const currency = isSupportedCurrencyCode(input.currency) ? input.currency : "AUD";
  db.prepare(
    `INSERT INTO expenses
     (id, type, title, amount, currency, category, date, merchant, paymentMethod, notes, receiptFileId, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.type === "income" ? "income" : "expense",
    input.title ?? (input.type === "income" ? "未命名收入" : "未命名支出"),
    Number.isFinite(amount) ? amount : 0,
    currency,
    input.category ?? "其他",
    input.date ?? todayIso(),
    input.merchant ?? null,
    input.paymentMethod ?? null,
    input.notes ?? null,
    input.receiptFileId ?? null,
    timestamp,
    timestamp
  );

  if (input.receiptFileId) linkUploadedFile(input.receiptFileId, "expense", id, db);
  writeSetting(db, "lastUsedCurrency", currency);
  return getExpense(id, db)!;
}

export function updateExpense(id: string, input: ExpenseInput) {
  const db = getDb();
  const current = getExpense(id, db);
  if (!current) return null;
  const amount = input.amount === undefined || input.amount === null ? current.amount : Number(input.amount);
  const next = { ...current, ...input, amount: Number.isFinite(amount) ? amount : current.amount };
  db.prepare(
    `UPDATE expenses SET
      type = ?, title = ?, amount = ?, currency = ?, category = ?, date = ?, merchant = ?,
      paymentMethod = ?, notes = ?, receiptFileId = ?, updatedAt = ?
     WHERE id = ?`
  ).run(
    next.type === "income" ? "income" : "expense",
    next.title,
    next.amount,
    next.currency,
    next.category,
    next.date,
    next.merchant ?? null,
    next.paymentMethod ?? null,
    next.notes ?? null,
    next.receiptFileId ?? null,
    now(),
    id
  );

  if (next.receiptFileId) linkUploadedFile(next.receiptFileId, "expense", id, db);
  if (isSupportedCurrencyCode(next.currency)) writeSetting(db, "lastUsedCurrency", next.currency);
  return getExpense(id, db);
}

export function deleteExpense(id: string) {
  const db = getDb();
  return db.prepare("DELETE FROM expenses WHERE id = ?").run(id).changes;
}

export function listImportantFiles() {
  const db = getDb();
  return db.prepare(`
    SELECT
      i.*,
      f.originalName AS originalName,
      f.mimeType AS mimeType,
      f.size AS size
    FROM important_files i
    JOIN uploaded_files f ON f.id = i.fileId
    ORDER BY i.updatedAt DESC, i.createdAt DESC
  `).all().map(rowToImportantFile);
}

export function getImportantFile(id: string, db = getDb()) {
  const row = db.prepare(`
    SELECT
      i.*,
      f.originalName AS originalName,
      f.mimeType AS mimeType,
      f.size AS size
    FROM important_files i
    JOIN uploaded_files f ON f.id = i.fileId
    WHERE i.id = ?
  `).get(id);
  return row ? rowToImportantFile(row) : null;
}

export function createImportantFile(input: ImportantFileInput) {
  const db = getDb();
  const timestamp = now();
  const id = randomUUID();
  const tags = Array.isArray(input.tags) ? input.tags : String(input.tags ?? "").split(/[，,\n]/);
  db.prepare(
    `INSERT INTO important_files
     (id, title, category, tags_json, notes, expiryDate, fileId, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.title ?? input.originalName ?? "未命名文件",
    input.category ?? "其他",
    JSON.stringify(tags.map((tag) => tag.trim()).filter(Boolean)),
    input.notes ?? null,
    input.expiryDate ?? null,
    input.fileId,
    timestamp,
    timestamp
  );
  if (input.fileId) linkUploadedFile(input.fileId, "important_file", id, db);
  return getImportantFile(id, db)!;
}

export function updateImportantFile(id: string, input: ImportantFileInput) {
  const db = getDb();
  const current = getImportantFile(id, db);
  if (!current) return null;
  const tags = input.tags === undefined
    ? current.tags
    : Array.isArray(input.tags)
      ? input.tags
      : String(input.tags ?? "").split(/[，,\n]/);
  const next = { ...current, ...input, tags: tags.map((tag) => String(tag).trim()).filter(Boolean) };
  db.prepare(
    `UPDATE important_files SET
      title = ?, category = ?, tags_json = ?, notes = ?, expiryDate = ?, updatedAt = ?
     WHERE id = ?`
  ).run(
    next.title,
    next.category,
    JSON.stringify(next.tags),
    next.notes ?? null,
    next.expiryDate ?? null,
    now(),
    id
  );
  return getImportantFile(id, db);
}

export function deleteImportantFile(id: string) {
  const db = getDb();
  const current = getImportantFile(id, db);
  if (!current) return 0;
  const changes = db.prepare("DELETE FROM important_files WHERE id = ?").run(id).changes;
  const remainingImportantRefs = db.prepare("SELECT COUNT(*) AS count FROM important_files WHERE fileId = ?").get(current.fileId);
  const remainingExpenseRefs = db.prepare("SELECT COUNT(*) AS count FROM expenses WHERE receiptFileId = ?").get(current.fileId);
  const refCount = Number(remainingImportantRefs?.count ?? 0) + Number(remainingExpenseRefs?.count ?? 0);
  if (refCount === 0) {
    const uploaded = db.prepare("SELECT storedName FROM uploaded_files WHERE id = ?").get(current.fileId);
    db.prepare("DELETE FROM uploaded_files WHERE id = ?").run(current.fileId);
    if (uploaded?.storedName) {
      try {
        fs.unlinkSync(path.join(uploadsDir, String(uploaded.storedName)));
      } catch {
        // The metadata is already removed; a missing local file should not block deletion.
      }
    }
  }
  return changes;
}

export function createUploadedFile(input: {
  originalName: string;
  storedName: string;
  path: string;
  mimeType: string;
  size: number;
  linkedEntityType?: string | null;
  linkedEntityId?: string | null;
}) {
  const db = getDb();
  const id = randomUUID();
  db.prepare(
    "INSERT INTO uploaded_files (id, originalName, storedName, path, mimeType, size, createdAt, linkedEntityType, linkedEntityId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(
    id,
    input.originalName,
    input.storedName,
    input.path,
    input.mimeType,
    input.size,
    now(),
    input.linkedEntityType ?? null,
    input.linkedEntityId ?? null
  );
  return db.prepare("SELECT * FROM uploaded_files WHERE id = ?").get(id);
}

export function linkUploadedFile(id: string, linkedEntityType: string, linkedEntityId: string, db = getDb()) {
  return db.prepare("UPDATE uploaded_files SET linkedEntityType = ?, linkedEntityId = ? WHERE id = ?").run(
    linkedEntityType,
    linkedEntityId,
    id
  ).changes;
}

export function getUploadedFile(id: string) {
  return getDb().prepare("SELECT * FROM uploaded_files WHERE id = ?").get(id);
}

export function exportBackup() {
  const db = getDb();
  return {
    exportedAt: now(),
    appName: "MyAssist",
    databasePath: dbPath,
    uploadsPath: uploadsDir,
    tasks: listTasks({ includeArchived: true }),
    plans: listPlans(),
    progressItems: listProgress(),
    courses: listCourses(),
    journalEntries: listJournal(),
    expenses: listExpenses(),
    importantFiles: listImportantFiles(),
    uploadedFiles: db.prepare("SELECT * FROM uploaded_files ORDER BY createdAt DESC").all(),
    settings: db.prepare("SELECT * FROM settings").all()
  };
}
