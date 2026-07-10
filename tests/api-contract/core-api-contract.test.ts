import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "leo-api-contract-"));
const dataDir = path.join(tempRoot, "data");
const uploadsDir = path.join(tempRoot, "uploads");
const dbPath = path.join(dataDir, "contract.db");

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadsDir, { recursive: true });
process.env.LEO_APP_DATA_DIR = tempRoot;
process.env.LEO_DATA_DIR = dataDir;
process.env.LEO_UPLOADS_DIR = uploadsDir;
process.env.LEO_DB_PATH = dbPath;

const businessTables = [
  "assignments", "class_sessions", "course_occurrences", "courses", "expenses", "important_files",
  "journal_entries", "plan_items", "plans", "progress_items", "settings", "subtasks", "tags",
  "task_progress_entries", "task_tags", "tasks", "timetable_courses", "timetable_sources",
  "todo_list_items", "todo_lists", "uploaded_files"
];

async function loadRoutes() {
  return {
    settings: await import("@/app/api/settings/route"),
    tasks: await import("@/app/api/tasks/route"),
    task: await import("@/app/api/tasks/[id]/route"),
    complete: await import("@/app/api/tasks/[id]/complete/route"),
    archiveAction: await import("@/app/api/tasks/[id]/archive/route"),
    restore: await import("@/app/api/tasks/[id]/restore/route"),
    archive: await import("@/app/api/archive/route"),
    progressEntries: await import("@/app/api/tasks/[id]/progress-entries/route"),
    subtask: await import("@/app/api/subtasks/[id]/route"),
    progress: await import("@/app/api/progress/route"),
    progressItem: await import("@/app/api/progress/[id]/route"),
    progressPin: await import("@/app/api/progress/[id]/pin/route"),
    todoLists: await import("@/app/api/todo-lists/route"),
    todoList: await import("@/app/api/todo-lists/[id]/route"),
    todoItem: await import("@/app/api/todo-list-items/[id]/route"),
    expenses: await import("@/app/api/expenses/route"),
    expense: await import("@/app/api/expenses/[id]/route"),
    plans: await import("@/app/api/plans/route"),
    plan: await import("@/app/api/plans/[id]/route"),
    journal: await import("@/app/api/journal/route"),
    courses: await import("@/app/api/courses/route"),
    timetable: await import("@/app/api/timetable/route"),
    timetablePreview: await import("@/app/api/timetable/import/preview/route"),
    timetableConfirm: await import("@/app/api/timetable/import/confirm/route"),
    occurrence: await import("@/app/api/timetable/occurrences/[id]/route"),
    upload: await import("@/app/api/upload/route"),
    uploadedFile: await import("@/app/api/uploads/[id]/route"),
    importantFiles: await import("@/app/api/important-files/route"),
    importantFile: await import("@/app/api/important-files/[id]/route"),
    syncPush: await import("@/app/api/sync/push/route")
  };
}

let routes: Awaited<ReturnType<typeof loadRoutes>>;

function request(url: string, method: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

function context(id: string) {
  return { params: Promise.resolve({ id }) };
}

async function json(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

function resetTemporaryDatabase() {
  const database = new DatabaseSync(dbPath);
  database.exec("PRAGMA foreign_keys = OFF;");
  for (const table of businessTables) database.exec(`DELETE FROM "${table}";`);
  database.exec("PRAGMA foreign_keys = ON;");
  database.close();
  fs.rmSync(uploadsDir, { recursive: true, force: true });
  fs.mkdirSync(uploadsDir, { recursive: true });
}

async function createTask(body: Record<string, unknown> = {}) {
  const response = await routes.tasks.POST(request("http://local.test/api/tasks", "POST", body));
  return { response, body: await json(response) };
}

async function createTodoList(body: Record<string, unknown> = {}) {
  const response = await routes.todoLists.POST(request("http://local.test/api/todo-lists", "POST", body));
  return { response, body: await json(response) };
}

async function createExpense(body: Record<string, unknown>) {
  const response = await routes.expenses.POST(request("http://local.test/api/expenses", "POST", body));
  return { response, body: await json(response) };
}

beforeAll(async () => {
  routes = await loadRoutes();
  await routes.settings.GET();
});

beforeEach(() => {
  resetTemporaryDatabase();
});

afterAll(() => {
  const globalState = globalThis as typeof globalThis & { leoDb?: { close?: () => void } };
  globalState.leoDb?.close?.();
  delete globalState.leoDb;
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

describe("Settings API contract", () => {
  it("GET returns the persisted settings shape with local defaults", async () => {
    const response = await routes.settings.GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      lastUsedCurrency: null,
      homeTitle: "Leo的生活学习助手",
      showHomeTitle: true
    });
  });

  it("PATCH persists only the exposed home settings and preserves the response shape", async () => {
    const response = await routes.settings.PATCH(request("http://local.test/api/settings", "PATCH", {
      homeTitle: "测试助手",
      showHomeTitle: false,
      lastUsedCurrency: "USD"
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      lastUsedCurrency: null,
      homeTitle: "测试助手",
      showHomeTitle: false
    });
    expect(await (await routes.settings.GET()).json()).toEqual({
      lastUsedCurrency: null,
      homeTitle: "测试助手",
      showHomeTitle: false
    });
  });
});

describe("Tasks API contract", () => {
  it("GET returns an empty array for an empty database", async () => {
    const response = await routes.tasks.GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  it("POST keeps the current permissive defaults when title is omitted", async () => {
    const { response, body } = await createTask();
    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      title: "未命名任务",
      type: "todo",
      status: "not_started",
      priority: "medium",
      tags: [],
      progressEnabled: false,
      pinnedToBottom: false,
      subtasks: [],
      progressEntries: []
    });
    expect(typeof body.id).toBe("string");
    expect(typeof body.createdAt).toBe("string");
    expect(typeof body.updatedAt).toBe("string");
  });

  it("POST preserves tags, checklist subtasks and progress fields", async () => {
    const { body } = await createTask({
      title: "阅读",
      type: "checklist",
      tags: ["学习"],
      subtasks: ["第一章", { title: "第二章", completed: true }],
      progressEnabled: true,
      progressType: "pages",
      progressCurrent: 10,
      progressTarget: 100,
      progressUnit: "页"
    });
    expect(body.tags).toEqual(["学习", "清单"]);
    expect(body.subtasks).toHaveLength(2);
    expect(body).toMatchObject({ progressEnabled: true, progressType: "pages", progressCurrent: 10, progressTarget: 100, progressUnit: "页" });
  });

  it("PATCH returns 404 for an unknown task", async () => {
    const response = await routes.task.PATCH(request("http://local.test/api/tasks/missing", "PATCH", { title: "x" }), context("missing"));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Task not found" });
  });

  it("PATCH updates an existing task without changing the entity shape", async () => {
    const created = await createTask({ title: "旧标题", type: "deadline", dueDate: "2026-08-01T09:00" });
    const response = await routes.task.PATCH(request("http://local.test/api/tasks/id", "PATCH", { title: "新标题", priority: "high" }), context(String(created.body.id)));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: created.body.id, title: "新标题", type: "deadline", priority: "high", dueDate: "2026-08-01T09:00" });
  });

  it("complete, archive and restore keep their current status transitions", async () => {
    const created = await createTask({ title: "状态任务" });
    const id = String(created.body.id);
    const completed = await routes.complete.POST(request("http://local.test", "POST"), context(id));
    expect(await completed.json()).toMatchObject({ status: "completed" });
    const archived = await routes.archiveAction.POST(request("http://local.test", "POST"), context(id));
    expect(await archived.json()).toMatchObject({ status: "archived" });
    const restored = await routes.restore.POST(request("http://local.test", "POST"), context(id));
    expect(await restored.json()).toMatchObject({ status: "not_started", completedAt: null, archivedAt: null });
  });

  it("status actions return 404 for an unknown task", async () => {
    for (const action of [routes.complete.POST, routes.archiveAction.POST, routes.restore.POST]) {
      const response = await action(request("http://local.test", "POST"), context("missing"));
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "Task not found" });
    }
  });

  it("GET archive returns the current includeArchived task collection", async () => {
    const created = await createTask({ title: "归档任务" });
    await routes.archiveAction.POST(request("http://local.test", "POST"), context(String(created.body.id)));
    const response = await routes.archive.GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(expect.arrayContaining([expect.objectContaining({ id: created.body.id, status: "archived" })]));
  });

  it("progress history starts empty and POST updates the task with a history entry", async () => {
    const created = await createTask({ title: "进度任务", progressEnabled: true, progressCurrent: 2, progressTarget: 10, progressUnit: "次" });
    const id = String(created.body.id);
    expect(await (await routes.progressEntries.GET(request("http://local.test", "GET"), context(id))).json()).toEqual([]);
    const response = await routes.progressEntries.POST(request("http://local.test", "POST", { amountDelta: 3, note: "测试记录", durationMinutes: 20 }), context(id));
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({ id, progressCurrent: 5 });
    expect(body.progressEntries).toEqual([expect.objectContaining({ taskId: id, amountDelta: 3, currentValueAfter: null, durationMinutes: 20, note: "测试记录" })]);
  });

  it("progress entry POST returns 404 for an unknown task", async () => {
    const response = await routes.progressEntries.POST(request("http://local.test", "POST", { amountDelta: 1 }), context("missing"));
    expect(response.status).toBe(404);
  });

  it("subtask PATCH updates completion and returns 404 when missing", async () => {
    const created = await createTask({ title: "清单", type: "checklist", subtasks: ["项目"] });
    const subtaskId = String((created.body.subtasks as Array<Record<string, unknown>>)[0].id);
    const updated = await routes.subtask.PATCH(request("http://local.test", "PATCH", { completed: true }), context(subtaskId));
    expect(await updated.json()).toMatchObject({ id: subtaskId, completed: true });
    const missing = await routes.subtask.PATCH(request("http://local.test", "PATCH", { completed: true }), context("missing"));
    expect(missing.status).toBe(404);
  });

  it("progress compatibility endpoints create, update, list and pin task-backed progress", async () => {
    const createdResponse = await routes.progress.POST(request("http://local.test/api/progress", "POST", { title: "计数", currentValue: 1, targetValue: 5, unit: "次" }));
    expect(createdResponse.status).toBe(201);
    const created = await json(createdResponse);
    const id = String(created.id);
    expect(await (await routes.progress.GET()).json()).toEqual([expect.objectContaining({ id, currentValue: 1, targetValue: 5 })]);
    const updated = await routes.progressItem.PATCH(request("http://local.test", "PATCH", { currentValue: 3 }), context(id));
    expect(await updated.json()).toMatchObject({ id, currentValue: 3 });
    const pinned = await routes.progressPin.POST(request("http://local.test", "POST"), context(id));
    expect(await pinned.json()).toEqual([expect.objectContaining({ id, pinned: true })]);
  });

  it("progress PATCH returns 404 for an unknown ID", async () => {
    const response = await routes.progressItem.PATCH(request("http://local.test", "PATCH", { currentValue: 3 }), context("missing"));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Progress item not found" });
  });

  it("DELETE returns the current success shape and removes the task", async () => {
    const created = await createTask({ title: "删除任务" });
    const response = await routes.task.DELETE(request("http://local.test", "DELETE"), context(String(created.body.id)));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(await (await routes.tasks.GET()).json()).toEqual([]);
  });
});

describe("To Do List API contract", () => {
  it("GET returns an empty array for an empty database", async () => {
    expect(await (await routes.todoLists.GET()).json()).toEqual([]);
  });

  it("POST keeps current defaults and returns the list shape", async () => {
    const { response, body } = await createTodoList();
    expect(response.status).toBe(201);
    expect(body).toMatchObject({ title: expect.any(String), date: expect.any(String), notes: null, items: [] });
  });

  it("POST parses schedule time without converting the To Do item into a Task", async () => {
    const { body } = await createTodoList({ date: "2026-07-11", itemDrafts: [{ content: "13:00-15:00 写作业" }] });
    const item = (body.items as Array<Record<string, unknown>>)[0];
    expect(item).toMatchObject({
      content: "13:00-15:00 写作业",
      hasScheduleTime: true,
      scheduledStartAt: "2026-07-11T13:00:00",
      scheduledEndAt: "2026-07-11T15:00:00"
    });
    expect(await (await routes.tasks.GET()).json()).toEqual([]);
  });

  it("PATCH returns 404 for an unknown list", async () => {
    const response = await routes.todoList.PATCH(request("http://local.test", "PATCH", { title: "x" }), context("missing"));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "To Do List not found" });
  });

  it("PATCH updates list fields and item completion can be changed independently", async () => {
    const created = await createTodoList({ date: "2026-07-11", title: "旧清单", itemDrafts: [{ content: "事项" }] });
    const id = String(created.body.id);
    const itemId = String((created.body.items as Array<Record<string, unknown>>)[0].id);
    const updated = await routes.todoList.PATCH(request("http://local.test", "PATCH", { title: "新清单" }), context(id));
    expect(await updated.json()).toMatchObject({ id, title: "新清单" });
    const itemResponse = await routes.todoItem.PATCH(request("http://local.test", "PATCH", { completed: true }), context(itemId));
    expect(await itemResponse.json()).toMatchObject({ id: itemId, completed: true });
  });

  it("item PATCH returns 404 for an unknown item", async () => {
    const response = await routes.todoItem.PATCH(request("http://local.test", "PATCH", { completed: true }), context("missing"));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "To Do List item not found" });
  });
});

describe("Expenses API contract", () => {
  it("GET returns an empty array for an empty database", async () => {
    expect(await (await routes.expenses.GET()).json()).toEqual([]);
  });

  it("POST requires a supported currency and keeps the current 400 shape", async () => {
    const missing = await routes.expenses.POST(request("http://local.test", "POST", { title: "收入", amount: 10 }));
    expect(missing.status).toBe(400);
    expect(await missing.json()).toEqual({ error: "请选择有效货币。" });
    const invalid = await routes.expenses.POST(request("http://local.test", "POST", { title: "收入", amount: 10, currency: "ABC" }));
    expect(invalid.status).toBe(400);
  });

  it("POST returns the expense shape and updates lastUsedCurrency only after save", async () => {
    const { response, body } = await createExpense({ title: "外卖收入", type: "income", amount: 10, currency: "AUD", category: "外卖收入", date: "2026-07-11" });
    expect(response.status).toBe(201);
    expect(body).toMatchObject({ title: "外卖收入", type: "income", amount: 10, currency: "AUD", receiptFileId: null });
    expect(await (await routes.settings.GET()).json()).toMatchObject({ lastUsedCurrency: "AUD" });
  });

  it("PATCH validates currency before checking the expense ID", async () => {
    const invalid = await routes.expense.PATCH(request("http://local.test", "PATCH", { currency: "ABC" }), context("missing"));
    expect(invalid.status).toBe(400);
    const missing = await routes.expense.PATCH(request("http://local.test", "PATCH", { currency: "USD" }), context("missing"));
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "Expense not found" });
  });

  it("PATCH preserves the response shape and successful currency memory", async () => {
    const created = await createExpense({ title: "支出", type: "expense", amount: 5, currency: "AUD", category: "其他", date: "2026-07-11" });
    const response = await routes.expense.PATCH(request("http://local.test", "PATCH", { currency: "USD", amount: 6 }), context(String(created.body.id)));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: created.body.id, amount: 6, currency: "USD" });
    expect(await (await routes.settings.GET()).json()).toMatchObject({ lastUsedCurrency: "USD" });
  });

  it("DELETE returns the current success shape and removes the record", async () => {
    const created = await createExpense({ title: "删除", type: "expense", amount: 5, currency: "CNY", category: "其他", date: "2026-07-11" });
    const response = await routes.expense.DELETE(request("http://local.test", "DELETE"), context(String(created.body.id)));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(await (await routes.expenses.GET()).json()).toEqual([]);
  });
});

describe("Plan and Journal API contract", () => {
  it("Plan GET/POST/PATCH/DELETE preserves the current shapes", async () => {
    expect(await (await routes.plans.GET()).json()).toEqual([]);
    const createdResponse = await routes.plans.POST(request("http://local.test/api/plans", "POST", {
      title: "周计划",
      type: "weekly",
      startDate: "2026-07-13",
      endDate: "2026-07-19",
      itemDrafts: [{ title: "完成复习", completed: false }]
    }));
    expect(createdResponse.status).toBe(201);
    const created = await json(createdResponse);
    expect(created).toMatchObject({ title: "周计划", type: "weekly", items: [expect.objectContaining({ title: "完成复习", type: "plan_item" })] });
    const updated = await routes.plan.PATCH(request("http://local.test", "PATCH", { title: "更新周计划" }), context(String(created.id)));
    expect(await updated.json()).toMatchObject({ id: created.id, title: "更新周计划" });
    const deleted = await routes.plan.DELETE(request("http://local.test", "DELETE"), context(String(created.id)));
    expect(await deleted.json()).toEqual({ ok: true });
  });

  it("Plan PATCH returns 404 for an unknown plan", async () => {
    const response = await routes.plan.PATCH(request("http://local.test", "PATCH", { title: "x" }), context("missing"));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Plan not found" });
  });

  it("Journal GET/POST preserves linkedPlanId and response shape", async () => {
    expect(await (await routes.journal.GET()).json()).toEqual([]);
    const response = await routes.journal.POST(request("http://local.test/api/journal", "POST", {
      date: "2026-07-11",
      source: "manual",
      content: "隔离测试日记",
      linkedPlanId: null
    }));
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ date: "2026-07-11", source: "manual", content: "隔离测试日记", linkedPlanId: null });
  });
});

describe("Timetable API contract", () => {
  const icsText = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Leo Contract Test//EN",
    "BEGIN:VEVENT",
    "UID:contract-course-1",
    "DTSTART:20260720T000000Z",
    "DTEND:20260720T010000Z",
    "SUMMARY:INFO1110 Lecture",
    "LOCATION:Test Room",
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");

  it("GET courses and timetable return the current empty shapes", async () => {
    expect(await (await routes.courses.GET()).json()).toEqual([]);
    const timetable = await routes.timetable.GET(request("http://local.test/api/timetable?includeCancelled=1", "GET"));
    expect(await timetable.json()).toEqual({ sources: [], courses: [], occurrences: [] });
  });

  it("POST preview keeps the current 400 error when ICS and feed URL are absent", async () => {
    const response = await routes.timetablePreview.POST(request("http://local.test/api/timetable/import/preview", "POST", {}));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "缺少 ICS 内容或 Calendar Feed URL。" });
  });

  it("preview, confirm, update and cancel preserve timetable data flow", async () => {
    const previewResponse = await routes.timetablePreview.POST(request("http://local.test/api/timetable/import/preview", "POST", {
      icsText,
      name: "Contract ICS",
      semester: "Semester 2",
      academicYear: 2026,
      timezone: "Australia/Sydney"
    }));
    expect(previewResponse.status).toBe(200);
    const preview = await json(previewResponse);
    expect(preview).toMatchObject({ source: { type: "ics_file", timezone: "Australia/Sydney" }, summary: { courseCount: 1, occurrenceCount: 1 } });
    const confirmResponse = await routes.timetableConfirm.POST(request("http://local.test/api/timetable/import/confirm", "POST", preview));
    expect(confirmResponse.status).toBe(201);
    expect(await confirmResponse.json()).toMatchObject({ created: 1, conflicts: 0 });
    const timetable = await (await routes.timetable.GET(request("http://local.test/api/timetable?includeCancelled=1", "GET"))).json() as Record<string, unknown>;
    const occurrence = (timetable.occurrences as Array<Record<string, unknown>>)[0];
    const occurrenceId = String(occurrence.id);
    const updated = await routes.occurrence.PATCH(request("http://local.test", "PATCH", { patch: { location: "Updated Room" }, scope: "single" }), context(occurrenceId));
    expect(await updated.json()).toMatchObject({ id: occurrenceId, location: "Updated Room", isException: true });
    const cancelled = await routes.occurrence.DELETE(request("http://local.test/api/timetable/occurrences/id?scope=single", "DELETE"), context(occurrenceId));
    expect(await cancelled.json()).toMatchObject({ id: occurrenceId, status: "cancelled" });
  });

  it("occurrence PATCH and DELETE return 404 for an unknown ID", async () => {
    const patched = await routes.occurrence.PATCH(request("http://local.test", "PATCH", { location: "x" }), context("missing"));
    expect(patched.status).toBe(404);
    const deleted = await routes.occurrence.DELETE(request("http://local.test/api/timetable/occurrences/missing", "DELETE"), context("missing"));
    expect(deleted.status).toBe(404);
  });
});

describe("Files API contract", () => {
  async function uploadTestFile() {
    const form = new FormData();
    form.append("file", new File(["contract file"], "contract.txt", { type: "text/plain" }));
    const response = await routes.upload.POST(new Request("http://local.test/api/upload", { method: "POST", body: form }));
    return { response, body: await json(response) };
  }

  it("POST upload returns 400 when file is absent", async () => {
    const response = await routes.upload.POST(new Request("http://local.test/api/upload", { method: "POST", body: new FormData() }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Missing file" });
  });

  it("POST upload and GET download preserve metadata, bytes and content type", async () => {
    const uploaded = await uploadTestFile();
    expect(uploaded.response.status).toBe(201);
    expect(uploaded.body).toMatchObject({ originalName: "contract.txt", mimeType: "text/plain", size: 13 });
    const download = await routes.uploadedFile.GET(request("http://local.test", "GET"), context(String(uploaded.body.id)));
    expect(download.status).toBe(200);
    expect(download.headers.get("content-type")).toBe("text/plain");
    expect(Buffer.from(await download.arrayBuffer()).toString("utf8")).toBe("contract file");
  });

  it("GET download returns 404 for an unknown file", async () => {
    const response = await routes.uploadedFile.GET(request("http://local.test", "GET"), context("missing"));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "File not found" });
  });

  it("Important file GET/POST/PATCH/DELETE preserves current behavior", async () => {
    const uploaded = await uploadTestFile();
    expect(await (await routes.importantFiles.GET()).json()).toEqual([]);
    const createdResponse = await routes.importantFiles.POST(request("http://local.test/api/important-files", "POST", {
      title: "测试文件",
      category: "学校",
      tags: ["测试"],
      fileId: uploaded.body.id
    }));
    expect(createdResponse.status).toBe(201);
    const created = await json(createdResponse);
    expect(created).toMatchObject({ title: "测试文件", category: "学校", tags: ["测试"], fileId: uploaded.body.id });
    const updated = await routes.importantFile.PATCH(request("http://local.test", "PATCH", { title: "更新文件" }), context(String(created.id)));
    expect(await updated.json()).toMatchObject({ id: created.id, title: "更新文件" });
    const deleted = await routes.importantFile.DELETE(request("http://local.test", "DELETE"), context(String(created.id)));
    expect(await deleted.json()).toEqual({ ok: true });
  });

  it("Important file POST validates fileId and PATCH returns 404 when missing", async () => {
    const invalid = await routes.importantFiles.POST(request("http://local.test", "POST", { title: "x" }));
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ error: "Missing fileId" });
    const missing = await routes.importantFile.PATCH(request("http://local.test", "PATCH", { title: "x" }), context("missing"));
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "Important file not found" });
  });
});

describe("Repository backend selector", () => {
  it("fails closed for an unsupported cloud backend instead of falling back to SQLite", async () => {
    const previous = process.env.DATA_BACKEND;
    process.env.DATA_BACKEND = "supabase";
    try {
      const { getSettingsService } = await import("@/lib/services/settings-service");
      expect(() => getSettingsService()).toThrow("Unsupported DATA_BACKEND: supabase");
    } finally {
      if (previous === undefined) delete process.env.DATA_BACKEND;
      else process.env.DATA_BACKEND = previous;
    }
  });
});

describe("Offline sync API contract", () => {
  it("push keeps the current per-item result shape while creating through services", async () => {
    const response = await routes.syncPush.POST(request("http://local.test/api/sync/push", "POST", {
      deviceId: "contract-device",
      items: [{ localId: "local-1", entityType: "task", payload: { title: "离线任务" } }]
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      syncedAt: expect.any(String),
      results: [{ localId: "local-1", serverId: expect.any(String), status: "synced" }]
    });
    expect(await (await routes.tasks.GET()).json()).toEqual([expect.objectContaining({ title: "离线任务" })]);
  });
});
