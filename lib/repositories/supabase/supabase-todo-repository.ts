import { randomUUID } from "node:crypto";
import { parseScheduleTime } from "@/lib/schedule-time";
import { instantToWallTime, zonedWallTimeToUtc } from "@/lib/timezone";
import type { TodoList, TodoListItem } from "@/lib/types";
import type { TodoListInput, TodoRepository } from "../todo-repository";
import type { RepositoryContext } from "../repository-context";
import { requireSupabaseContext } from "../request-context";

type Row = Record<string, unknown>;

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function titleForDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return year && month && day ? `${year}年${month}月${day}日ToDoList` : "ToDoList";
}

function scheduleFields(content: string, date: string) {
  const parsed = parseScheduleTime(content);
  if (!parsed) return {
    hasScheduleTime: false, scheduledStartAt: null, scheduledEndAt: null, scheduledTimezone: null,
    parsedTimeText: null, scheduleParseConfidence: null
  };
  return {
    hasScheduleTime: true,
    scheduledStartAt: zonedWallTimeToUtc(date, `${parsed.startTime}:00`),
    scheduledEndAt: zonedWallTimeToUtc(date, `${parsed.endTime}:00`),
    scheduledTimezone: "Australia/Sydney", parsedTimeText: parsed.parsedTimeText, scheduleParseConfidence: parsed.confidence
  };
}

function mapItem(row: Row): TodoListItem {
  const timezone = row.scheduledTimezone ? String(row.scheduledTimezone) : "Australia/Sydney";
  return {
    id: String(row.id), todoListId: String(row.todoListId), content: String(row.content), completed: Boolean(row.completed),
    order: Number(row.sortOrder ?? 0), hasScheduleTime: Boolean(row.hasScheduleTime),
    scheduledStartAt: row.scheduledStartAt ? instantToWallTime(String(row.scheduledStartAt), timezone) : null,
    scheduledEndAt: row.scheduledEndAt ? instantToWallTime(String(row.scheduledEndAt), timezone) : null,
    scheduledTimezone: row.scheduledTimezone ? String(row.scheduledTimezone) : null,
    parsedTimeText: row.parsedTimeText ? String(row.parsedTimeText) : null,
    scheduleParseConfidence: row.scheduleParseConfidence === null || row.scheduleParseConfidence === undefined ? null : Number(row.scheduleParseConfidence),
    createdAt: String(row.createdAt), updatedAt: String(row.updatedAt)
  };
}

async function getTodoList(id: string, context?: RepositoryContext) {
  const { client, userId } = requireSupabaseContext(context);
  const [{ data: row, error }, { data: items, error: itemError }] = await Promise.all([
    client.from("todo_lists").select("*").eq("user_id", userId).eq("id", id).maybeSingle(),
    client.from("todo_list_items").select("*").eq("user_id", userId).eq("todoListId", id).order("sortOrder").order("createdAt")
  ]);
  if (error) throw error;
  if (itemError) throw itemError;
  if (!row) return null;
  return {
    id: String(row.id), title: String(row.title), date: String(row.date), notes: row.notes ? String(row.notes) : null,
    createdAt: String(row.createdAt), updatedAt: String(row.updatedAt), items: (items ?? []).map(mapItem)
  } satisfies TodoList;
}

async function syncItems(todoListId: string, date: string, drafts: NonNullable<TodoListInput["itemDrafts"]>, context?: RepositoryContext) {
  const { client, userId } = requireSupabaseContext(context);
  const existing = await client.from("todo_list_items").select("id,createdAt").eq("user_id", userId).eq("todoListId", todoListId);
  if (existing.error) throw existing.error;
  const createdAtById = new Map((existing.data ?? []).map((row) => [String(row.id), String(row.createdAt)]));
  const ownIds = new Set(createdAtById.keys());
  const deleted = await client.from("todo_list_items").delete().eq("user_id", userId).eq("todoListId", todoListId);
  if (deleted.error) throw deleted.error;
  const timestamp = new Date().toISOString();
  const rows = drafts.map((draft, sortOrder) => {
    const content = String(draft.content ?? draft.title ?? "").trim();
    const requestedId = draft.id ? String(draft.id) : "";
    const id = requestedId && ownIds.has(requestedId) ? requestedId : randomUUID();
    return { id, user_id: userId, todoListId, content, completed: Boolean(draft.completed), sortOrder,
      ...scheduleFields(content, date), createdAt: createdAtById.get(id) ?? timestamp, updatedAt: timestamp };
  }).filter((row) => row.content);
  if (rows.length > 0) {
    const inserted = await client.from("todo_list_items").insert(rows);
    if (inserted.error) throw inserted.error;
  }
}

export const supabaseTodoRepository: TodoRepository = {
  async listTodoLists(context) {
    const { client, userId } = requireSupabaseContext(context);
    const { data, error } = await client.from("todo_lists").select("id").eq("user_id", userId).order("date", { ascending: false }).order("createdAt", { ascending: false });
    if (error) throw error;
    return (await Promise.all((data ?? []).map((row) => getTodoList(String(row.id), context)))).filter(Boolean) as TodoList[];
  },
  getTodoList,
  async createTodoList(input, context) {
    const { client, userId } = requireSupabaseContext(context);
    const id = randomUUID();
    const date = input.date ?? today();
    const inserted = await client.from("todo_lists").insert({ id, user_id: userId, title: input.title ?? titleForDate(date), date,
      notes: input.notes ?? null, sourcePlanId: input.sourcePlanId ?? null });
    if (inserted.error) throw inserted.error;
    await syncItems(id, date, input.itemDrafts ?? [], context);
    return (await getTodoList(id, context))!;
  },
  async updateTodoList(id, input, context) {
    const { client, userId } = requireSupabaseContext(context);
    const current = await getTodoList(id, context);
    if (!current) return null;
    const next = { ...current, ...input };
    const { data, error } = await client.from("todo_lists").update({ title: next.title, date: next.date, notes: next.notes ?? null })
      .eq("user_id", userId).eq("id", id).select("id");
    if (error) throw error;
    if (!data?.length) return null;
    if (input.itemDrafts) await syncItems(id, next.date, input.itemDrafts, context);
    return getTodoList(id, context);
  },
  async updateTodoItemCompletion(id, completed, context) {
    const { client, userId } = requireSupabaseContext(context);
    const { data, error } = await client.from("todo_list_items").update({ completed }).eq("user_id", userId).eq("id", id).select("*").maybeSingle();
    if (error) throw error;
    return data ? mapItem(data) : null;
  }
};
