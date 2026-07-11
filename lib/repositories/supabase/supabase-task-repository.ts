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

async function syncTags(taskId: string, tags: string[], context?: RepositoryContext) {
  const { client, userId } = requireSupabaseContext(context);
  const { error: deleteError } = await client.from("task_tags").delete().eq("user_id", userId).eq("taskId", taskId);
  if (deleteError) throw deleteError;
  for (const name of tags) {
    let { data: tag, error } = await client.from("tags").select("id").eq("user_id", userId).eq("name", name).maybeSingle();
    if (error) throw error;
    if (!tag) {
      const inserted = await client.from("tags").insert({ id: randomUUID(), user_id: userId, name }).select("id").single();
      if (inserted.error) throw inserted.error;
      tag = inserted.data;
    }
    const linked = await client.from("task_tags").insert({ user_id: userId, taskId, tagId: tag.id });
    if (linked.error) throw linked.error;
  }
}

async function syncSubtasks(taskId: string, drafts: SubtaskDraftInput[], context?: RepositoryContext) {
  const { client, userId } = requireSupabaseContext(context);
  const existing = await client.from("subtasks").select("id,createdAt").eq("user_id", userId).eq("taskId", taskId);
  if (existing.error) throw existing.error;
  const createdAtById = new Map((existing.data ?? []).map((row) => [String(row.id), String(row.createdAt)]));
  const deleted = await client.from("subtasks").delete().eq("user_id", userId).eq("taskId", taskId);
  if (deleted.error) throw deleted.error;
  const now = new Date().toISOString();
  const rows = drafts.map((draft) => typeof draft === "string"
    ? { id: randomUUID(), title: draft.trim(), completed: false }
    : { id: draft.id || randomUUID(), title: String(draft.title ?? "").trim(), completed: Boolean(draft.completed) })
    .filter((draft) => draft.title)
    .map((draft) => ({ ...draft, user_id: userId, taskId, createdAt: createdAtById.get(draft.id) ?? now, updatedAt: now }));
  if (rows.length > 0) {
    const inserted = await client.from("subtasks").insert(rows);
    if (inserted.error) throw inserted.error;
  }
}

async function createTask(input: TaskInput, context?: RepositoryContext) {
  const { client, userId } = requireSupabaseContext(context);
  const id = randomUUID();
  const type = (input.type === "shopping" ? "checklist" : input.type ?? "todo") as Task["type"];
  const tags = normalizeTags(type, input.tags ?? []);
  if (input.pinnedToBottom) {
    const unpin = await client.from("tasks").update({ pinnedToBottom: false }).eq("user_id", userId);
    if (unpin.error) throw unpin.error;
    await client.from("progress_items").update({ pinned: false }).eq("user_id", userId);
  }
  const progressEnabled = Boolean(input.progressEnabled || input.progressTarget !== null && input.progressTarget !== undefined);
  const row = {
    id, user_id: userId, title: input.title ?? "未命名任务", description: input.description ?? "", type,
    status: input.status ?? "not_started", priority: input.priority ?? "medium", tags_json: tags,
    startDate: input.startDate ?? null, dueDate: input.dueDate ?? null, completedAt: input.completedAt ?? null,
    archivedAt: input.archivedAt ?? null, reminderRule: input.reminderRule ?? "none", progressCurrent: input.progressCurrent ?? null,
    progressTarget: input.progressTarget ?? null, progressUnit: input.progressUnit ?? null, progressEnabled,
    progressType: input.progressType ?? (progressEnabled ? "custom" : "none"), pinnedToBottom: Boolean(input.pinnedToBottom),
    parentPlanId: input.parentPlanId ?? null, originalImageId: input.originalImageId ?? null, notes: input.notes ?? null
  };
  const inserted = await client.from("tasks").insert(row);
  if (inserted.error) throw inserted.error;
  await syncTags(id, tags, context);
  if (input.subtasks?.length) await syncSubtasks(id, input.subtasks, context);
  return (await getTask(id, context))!;
}

async function updateTask(id: string, input: TaskInput, context?: RepositoryContext) {
  const { client, userId } = requireSupabaseContext(context);
  const current = await getTask(id, context);
  if (!current) return null;
  const type = (input.type === "shopping" ? "checklist" : input.type ?? current.type) as Task["type"];
  const tags = normalizeTags(type, input.tags ?? current.tags);
  const next = { ...current, ...input, type, tags };
  if (input.progressCurrent !== undefined && Number(input.progressCurrent ?? 0) > 0 && current.status === "not_started") next.status = "in_progress";
  if (next.pinnedToBottom) {
    const unpin = await client.from("tasks").update({ pinnedToBottom: false }).eq("user_id", userId).neq("id", id);
    if (unpin.error) throw unpin.error;
    await client.from("progress_items").update({ pinned: false }).eq("user_id", userId);
  }
  const updated = await client.from("tasks").update({
    title: next.title, description: next.description ?? "", type: next.type, status: next.status, priority: next.priority,
    tags_json: tags, startDate: next.startDate ?? null, dueDate: next.dueDate ?? null, completedAt: next.completedAt ?? null,
    archivedAt: next.archivedAt ?? null, reminderRule: next.reminderRule ?? "none", progressCurrent: next.progressCurrent ?? null,
    progressTarget: next.progressTarget ?? null, progressUnit: next.progressUnit ?? null, progressEnabled: Boolean(next.progressEnabled),
    progressType: next.progressType ?? "none", pinnedToBottom: Boolean(next.pinnedToBottom), parentPlanId: next.parentPlanId ?? null,
    originalImageId: next.originalImageId ?? null, notes: next.notes ?? null
  }).eq("user_id", userId).eq("id", id).select("id");
  if (updated.error) throw updated.error;
  if (!updated.data?.length) return null;
  await syncTags(id, tags, context);
  if (input.subtasks) await syncSubtasks(id, input.subtasks, context);
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
    const { client, userId } = requireSupabaseContext(context);
    const task = await getTask(taskId, context);
    if (!task) return null;
    const amountDelta = input.amountDelta === null || input.amountDelta === undefined ? null : Number(input.amountDelta);
    const currentValueAfter = input.currentValueAfter === null || input.currentValueAfter === undefined ? null : Number(input.currentValueAfter);
    const durationMinutes = input.durationMinutes === null || input.durationMinutes === undefined ? null : Number(input.durationMinutes);
    const nextCurrent = currentValueAfter ?? (task.progressCurrent ?? 0) + (amountDelta ?? 0);
    const inserted = await client.from("task_progress_entries").insert({
      id: randomUUID(), user_id: userId, taskId, amountDelta, currentValueAfter, durationMinutes, note: input.note ?? null
    });
    if (inserted.error) throw inserted.error;
    return updateTask(taskId, { progressEnabled: true, progressCurrent: nextCurrent, progressTarget: task.progressTarget ?? 1,
      progressUnit: task.progressUnit ?? "", status: task.status === "not_started" ? "in_progress" : task.status }, context);
  },
  async updateSubtaskCompletion(id, completed, context) {
    const { client, userId } = requireSupabaseContext(context);
    const { data, error } = await client.from("subtasks").update({ completed }).eq("user_id", userId).eq("id", id).select("*").maybeSingle();
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
    const { client, userId } = requireSupabaseContext(context);
    await client.from("tasks").update({ pinnedToBottom: false }).eq("user_id", userId);
    await client.from("progress_items").update({ pinned: false }).eq("user_id", userId);
    if (await getTask(id, context)) {
      const result = await client.from("tasks").update({ pinnedToBottom: true, progressEnabled: true }).eq("user_id", userId).eq("id", id);
      if (result.error) throw result.error;
    } else {
      const result = await client.from("progress_items").update({ pinned: true }).eq("user_id", userId).eq("id", id);
      if (result.error) throw result.error;
    }
    return listProgress(context);
  }
};
