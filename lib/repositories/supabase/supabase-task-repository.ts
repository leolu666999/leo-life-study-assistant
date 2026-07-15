import { randomUUID } from "node:crypto";
import type { ProgressItem, Subtask, Task, TaskProgressEntry } from "@/lib/types";
import type { ProgressEntryInput, SubtaskDraftInput, TaskInput, TaskRepository } from "../task-repository";
import type { RepositoryContext } from "../repository-context";
import { requireSupabaseContext } from "../request-context";

type Row = Record<string, unknown>;

function numberOrNull(value: unknown) {
  return value === null || value === undefined ? null : Number(value);
}

function tagsFrom(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}

function normalizeTags(type: Task["type"], values: string[]) {
  const tags = [...new Set(values.map((tag) => String(tag).trim()).filter(Boolean))];
  if (type === "checklist" && !tags.includes("清单")) tags.push("清单");
  return tags;
}

function mapSubtask(row: Row): Subtask {
  return {
    id: String(row.id), taskId: String(row.taskId), title: String(row.title), completed: Boolean(row.completed),
    createdAt: String(row.createdAt), updatedAt: String(row.updatedAt)
  };
}

function mapEntry(row: Row): TaskProgressEntry {
  return {
    id: String(row.id), taskId: String(row.taskId), createdAt: String(row.createdAt),
    amountDelta: numberOrNull(row.amountDelta), currentValueAfter: numberOrNull(row.currentValueAfter),
    durationMinutes: numberOrNull(row.durationMinutes), note: row.note ? String(row.note) : null
  };
}

function mapTask(row: Row, subtasks: Subtask[] = [], progressEntries: TaskProgressEntry[] = []): Task {
  const progressTarget = numberOrNull(row.progressTarget);
  return {
    id: String(row.id), title: String(row.title), description: String(row.description ?? ""), type: row.type as Task["type"],
    status: row.status as Task["status"], priority: row.priority as Task["priority"], tags: tagsFrom(row.tags_json),
    startDate: row.startDate ? String(row.startDate) : null, dueDate: row.dueDate ? String(row.dueDate) : null,
    createdAt: String(row.createdAt), updatedAt: String(row.updatedAt), completedAt: row.completedAt ? String(row.completedAt) : null,
    archivedAt: row.archivedAt ? String(row.archivedAt) : null, reminderRule: String(row.reminderRule ?? "none"),
    progressCurrent: numberOrNull(row.progressCurrent), progressTarget, progressUnit: row.progressUnit ? String(row.progressUnit) : null,
    progressEnabled: Boolean(row.progressEnabled) || progressTarget !== null, progressType: (row.progressType ?? "none") as Task["progressType"],
    pinnedToBottom: Boolean(row.pinnedToBottom), parentPlanId: row.parentPlanId ? String(row.parentPlanId) : null,
    originalImageId: row.originalImageId ? String(row.originalImageId) : null, notes: row.notes ? String(row.notes) : null,
    subtasks, progressEntries
  };
}

function progressFromTask(task: Task): ProgressItem {
  return {
    id: task.id, title: task.title, currentValue: task.progressCurrent ?? 0, targetValue: task.progressTarget ?? 1,
    unit: task.progressUnit ?? "", category: task.tags[0] ?? task.type, linkedTaskId: task.id,
    pinned: Boolean(task.pinnedToBottom), createdAt: task.createdAt, updatedAt: task.updatedAt
  };
}

async function getTask(id: string, context?: RepositoryContext) {
  const { client, userId } = requireSupabaseContext(context);
  const [{ data: row, error }, { data: subtasks, error: subtaskError }, { data: entries, error: entryError }] = await Promise.all([
    client.from("tasks").select("*").eq("user_id", userId).eq("id", id).is("deletedAt", null).maybeSingle(),
    client.from("subtasks").select("*").eq("user_id", userId).eq("taskId", id).order("createdAt"),
    client.from("task_progress_entries").select("*").eq("user_id", userId).eq("taskId", id).order("createdAt")
  ]);
  if (error) throw error;
  if (subtaskError) throw subtaskError;
  if (entryError) throw entryError;
  return row ? mapTask(row, (subtasks ?? []).map(mapSubtask), (entries ?? []).map(mapEntry)) : null;
}

function subtaskPayload(drafts: SubtaskDraftInput[], current: Subtask[] = []) {
  const createdAtById = new Map(current.map((row) => [row.id, row.createdAt]));
  const now = new Date().toISOString();
  return drafts.map((draft) => typeof draft === "string"
    ? { id: randomUUID(), title: draft.trim(), completed: false }
    : { id: draft.id || randomUUID(), title: String(draft.title ?? "").trim(), completed: Boolean(draft.completed) })
    .filter((draft) => draft.title)
    .map((draft) => ({ ...draft, createdAt: createdAtById.get(draft.id) ?? now }));
}

function taskPayload(task: TaskInput & Pick<Task, "title" | "type" | "status" | "priority">) {
  return {
    title: task.title, description: task.description ?? "", type: task.type, status: task.status, priority: task.priority,
    startDate: task.startDate ?? null, dueDate: task.dueDate ?? null, completedAt: task.completedAt ?? null,
    archivedAt: task.archivedAt ?? null, reminderRule: task.reminderRule ?? "none", progressCurrent: task.progressCurrent ?? null,
    progressTarget: task.progressTarget ?? null, progressUnit: task.progressUnit ?? null,
    progressEnabled: Boolean(task.progressEnabled), progressType: task.progressType ?? "none",
    pinnedToBottom: Boolean(task.pinnedToBottom), parentPlanId: task.parentPlanId ?? null,
    originalImageId: task.originalImageId ?? null, notes: task.notes ?? null
  };
}

async function createTask(input: TaskInput, context?: RepositoryContext) {
  const { client } = requireSupabaseContext(context);
  const id = randomUUID();
  const type = (input.type === "shopping" ? "checklist" : input.type ?? "todo") as Task["type"];
  const tags = normalizeTags(type, input.tags ?? []);
  const progressEnabled = Boolean(input.progressEnabled || input.progressTarget !== null && input.progressTarget !== undefined);
  const row = {
    title: input.title ?? "未命名任务", description: input.description ?? "", type,
    status: input.status ?? "not_started", priority: input.priority ?? "medium", tags_json: tags,
    startDate: input.startDate ?? null, dueDate: input.dueDate ?? null, completedAt: input.completedAt ?? null,
    archivedAt: input.archivedAt ?? null, reminderRule: input.reminderRule ?? "none", progressCurrent: input.progressCurrent ?? null,
    progressTarget: input.progressTarget ?? null, progressUnit: input.progressUnit ?? null, progressEnabled,
    progressType: input.progressType ?? (progressEnabled ? "custom" : "none"), pinnedToBottom: Boolean(input.pinnedToBottom),
    parentPlanId: input.parentPlanId ?? null, originalImageId: input.originalImageId ?? null, notes: input.notes ?? null
  };
  const { error } = await client.rpc("save_task_with_relations", {
    p_task_id: id, p_create: true, p_task: taskPayload(row), p_tags: tags,
    p_subtasks: subtaskPayload(input.subtasks ?? []), p_replace_subtasks: true
  });
  if (error) throw error;
  return (await getTask(id, context))!;
}

async function updateTask(id: string, input: TaskInput, context?: RepositoryContext) {
  const { client } = requireSupabaseContext(context);
  const current = await getTask(id, context);
  if (!current) return null;
  const type = (input.type === "shopping" ? "checklist" : input.type ?? current.type) as Task["type"];
  const tags = normalizeTags(type, input.tags ?? current.tags);
  const next = { ...current, ...input, type, tags };
  if (input.status === undefined && current.status === "not_started") next.status = "in_progress";
  const { error } = await client.rpc("save_task_with_relations", {
    p_task_id: id, p_create: false, p_task: taskPayload(next), p_tags: tags,
    p_subtasks: subtaskPayload(input.subtasks ?? [], current.subtasks), p_replace_subtasks: Boolean(input.subtasks)
  });
  if (error) throw error;
  return getTask(id, context);
}

async function setStatus(id: string, status: "completed" | "archived" | "not_started", context?: RepositoryContext) {
  const timestamp = new Date().toISOString();
  const patch: TaskInput = { status };
  if (status === "completed") Object.assign(patch, { completedAt: timestamp, archivedAt: timestamp });
  if (status === "archived") patch.archivedAt = timestamp;
  if (status === "not_started") Object.assign(patch, { completedAt: null, archivedAt: null });
  return updateTask(id, patch, context);
}

async function listProgress(context?: RepositoryContext) {
  const { client, userId } = requireSupabaseContext(context);
  const [{ data: taskRows, error }, { data: legacyRows, error: legacyError }] = await Promise.all([
    client.from("tasks").select("*").eq("user_id", userId).is("deletedAt", null).not("status", "in", "(completed,archived)"),
    client.from("progress_items").select("*").eq("user_id", userId)
  ]);
  if (error) throw error;
  if (legacyError) throw legacyError;
  const taskItems = (taskRows ?? []).filter((row) => Boolean(row.progressEnabled) || row.progressTarget !== null).map((row) => progressFromTask(mapTask(row)));
  const legacyItems = (legacyRows ?? []).map((row) => ({
    id: String(row.id), title: String(row.title), currentValue: Number(row.currentValue), targetValue: Number(row.targetValue),
    unit: String(row.unit ?? ""), category: String(row.category ?? "general"), linkedTaskId: row.linkedTaskId ? String(row.linkedTaskId) : null,
    pinned: Boolean(row.pinned), createdAt: String(row.createdAt), updatedAt: String(row.updatedAt)
  } satisfies ProgressItem));
  return [...taskItems, ...legacyItems].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
}

export const supabaseTaskRepository: TaskRepository = {
  async listTasks(options = {}, context) {
    const { client, userId } = requireSupabaseContext(context);
    const { data, error } = await client.from("tasks").select("id,status,dueDate,type,tags_json,createdAt,startDate").eq("user_id", userId).is("deletedAt", null);
    if (error) throw error;
    const now = new Date().toISOString();
    const visible = (data ?? []).filter((row) => row.type !== "plan_item" && !tagsFrom(row.tags_json).includes("To Do List"))
      .filter((row) => options.includeArchived || (options.archive
        ? row.status === "completed" || row.status === "archived" || Boolean(row.dueDate && String(row.dueDate) < now)
        : row.status !== "completed" && row.status !== "archived"));
    const tasks = (await Promise.all(visible.map((row) => getTask(String(row.id), context)))).filter(Boolean) as Task[];
    const statusOrder = { not_started: 0, in_progress: 1, completed: 2, archived: 3 };
    return tasks.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]
      || String(a.dueDate ?? a.startDate ?? a.createdAt).localeCompare(String(b.dueDate ?? b.startDate ?? b.createdAt))
      || b.createdAt.localeCompare(a.createdAt));
  },
  getTask,
  createTask,
  updateTask,
  completeTask: (id, context) => setStatus(id, "completed", context),
  archiveTask: (id, context) => setStatus(id, "archived", context),
  restoreTask: (id, context) => setStatus(id, "not_started", context),
  async deleteTask(id, context) {
    const { client, userId } = requireSupabaseContext(context);
    const { data, error } = await client.from("tasks").delete().eq("user_id", userId).eq("id", id).select("id");
    if (error) throw error;
    return data?.length ?? 0;
  },
  async listProgressEntries(taskId, context) {
    const { client, userId } = requireSupabaseContext(context);
    const { data, error } = await client.from("task_progress_entries").select("*").eq("user_id", userId).eq("taskId", taskId).order("createdAt");
    if (error) throw error;
    return (data ?? []).map(mapEntry);
  },
  async addProgressEntry(taskId, input: ProgressEntryInput, context) {
    const { client } = requireSupabaseContext(context);
    const task = await getTask(taskId, context);
    if (!task) return null;
    const amountDelta = input.amountDelta === null || input.amountDelta === undefined ? null : Number(input.amountDelta);
    const currentValueAfter = input.currentValueAfter === null || input.currentValueAfter === undefined ? null : Number(input.currentValueAfter);
    const durationMinutes = input.durationMinutes === null || input.durationMinutes === undefined ? null : Number(input.durationMinutes);
    const nextCurrent = currentValueAfter ?? (task.progressCurrent ?? 0) + (amountDelta ?? 0);
    const entryId = randomUUID();
    const { error } = await client.rpc("add_task_progress_entry_atomic", { p_task_id: taskId, p_entry_id: entryId,
      p_entry: { amountDelta, currentValueAfter, durationMinutes, note: input.note ?? null }, p_next_current: nextCurrent });
    if (error) throw error;
    return getTask(taskId, context);
  },
  async updateSubtaskCompletion(id, completed, context) {
    const { client } = requireSupabaseContext(context);
    const { data, error } = await client.rpc("update_checklist_subtask_atomic", {
      p_subtask_id: id,
      p_completed: completed
    });
    if (error) throw error;
    return data ? mapSubtask(data) : null;
  },
  listProgress,
  async createProgress(input, context) {
    const task = await createTask({ title: input.title ?? "新进度任务", type: "counter", status: "not_started",
      tags: input.category ? [input.category] : ["进度"], progressEnabled: true,
      progressType: input.unit === "%" ? "percentage" : input.unit === "页" ? "pages" : "count",
      progressCurrent: input.currentValue ?? 0, progressTarget: input.targetValue ?? 1, progressUnit: input.unit ?? "",
      pinnedToBottom: input.pinned ?? false }, context);
    return progressFromTask(task);
  },
  async updateProgress(id, input, context) {
    const task = await getTask(id, context);
    if (task) {
      const updated = await updateTask(id, { title: input.title ?? task.title, progressEnabled: true,
        progressCurrent: input.currentValue ?? task.progressCurrent ?? 0, progressTarget: input.targetValue ?? task.progressTarget ?? 1,
        progressUnit: input.unit ?? task.progressUnit ?? "", pinnedToBottom: input.pinned ?? task.pinnedToBottom }, context);
      return updated ? progressFromTask(updated) : null;
    }
    const { client, userId } = requireSupabaseContext(context);
    const { data: current, error } = await client.from("progress_items").select("*").eq("user_id", userId).eq("id", id).maybeSingle();
    if (error) throw error;
    if (!current) return null;
    const next = { ...current, ...input };
    const result = await client.from("progress_items").update({ title: next.title, currentValue: next.currentValue,
      targetValue: next.targetValue, unit: next.unit, category: next.category, linkedTaskId: next.linkedTaskId ?? null,
      pinned: Boolean(next.pinned) }).eq("user_id", userId).eq("id", id).select("*").single();
    if (result.error) throw result.error;
    return {
      id: String(result.data.id), title: String(result.data.title), currentValue: Number(result.data.currentValue),
      targetValue: Number(result.data.targetValue), unit: String(result.data.unit ?? ""), category: String(result.data.category ?? "general"),
      linkedTaskId: result.data.linkedTaskId ? String(result.data.linkedTaskId) : null, pinned: Boolean(result.data.pinned),
      createdAt: String(result.data.createdAt), updatedAt: String(result.data.updatedAt)
    };
  },
  async pinProgressTask(id, context) {
    const { client } = requireSupabaseContext(context);
    const { error } = await client.rpc("pin_progress_item_atomic", { p_item_id: id });
    if (error) throw error;
    return listProgress(context);
  }
};