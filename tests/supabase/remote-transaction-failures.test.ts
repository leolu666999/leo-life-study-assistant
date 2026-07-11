import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for remote transaction tests`);
  return value;
};

const url = required("NEXT_PUBLIC_SUPABASE_URL");
const publishableKey = required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const secretKey = required("SUPABASE_SECRET_KEY");
const userAId = required("SUPABASE_TEST_USER_A_ID");
const userBId = required("SUPABASE_TEST_USER_B_ID");
const adminId = required("SUPABASE_TEST_ADMIN_ID");

function client(key = publishableKey) {
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

async function signedInClient(emailName: string, passwordName: string) {
  const result = client();
  const { data, error } = await result.auth.signInWithPassword({ email: required(emailName), password: required(passwordName) });
  if (error || !data.session) throw error || new Error(`Unable to sign in ${emailName}`);
  return result;
}

const ids = Object.fromEntries([
  "taskSub", "taskTag", "taskExisting", "taskUpdate", "subtaskOriginal", "progressTask", "progressEntry",
  "taskB", "planCross", "planCreate", "planTaskConflict", "planUpdate", "planLinkedTask", "planDraft",
  "journalOriginal", "todoCreate", "todoCreateItem", "todoUpdate", "todoOriginalItem", "todoUpdateItem",
  "expense", "receiptB"
].map((key) => [key, crypto.randomUUID()])) as Record<string, string>;

let admin: SupabaseClient;
let userA: SupabaseClient;
let userB: SupabaseClient;

const taskPayload = (title: string, extra: Record<string, unknown> = {}) => ({
  title, description: "", type: "todo", status: "not_started", priority: "medium",
  reminderRule: "none", progressEnabled: false, progressType: "none", pinnedToBottom: false,
  ...extra
});

async function count(table: string, column: string, value: string) {
  const { count: valueCount, error } = await admin.from(table).select("*", { count: "exact", head: true }).eq(column, value);
  if (error) throw error;
  return valueCount ?? 0;
}

async function cleanup() {
  const owners = [userAId, userBId, adminId];
  for (const table of [
    "expenses", "todo_list_items", "todo_lists", "journal_entries", "task_tags", "subtasks",
    "task_progress_entries", "progress_items", "plan_items", "tasks", "tags", "plans", "uploaded_files"
  ]) {
    const { error } = await admin.from(table).delete().in("user_id", owners);
    if (error) throw error;
  }
}

beforeAll(async () => {
  admin = client(secretKey);
  [userA, userB] = await Promise.all([
    signedInClient("SUPABASE_TEST_USER_A_EMAIL", "SUPABASE_TEST_USER_A_PASSWORD"),
    signedInClient("SUPABASE_TEST_USER_B_EMAIL", "SUPABASE_TEST_USER_B_PASSWORD")
  ]);
  await cleanup();
  await admin.from("settings").upsert([
    { user_id: userAId, key: "lastUsedCurrency", value: "AUD" },
    { user_id: userBId, key: "lastUsedCurrency", value: "USD" }
  ], { onConflict: "user_id,key" });
}, 60_000);

afterAll(async () => {
  await cleanup();
  await admin.from("settings").upsert([
    { user_id: userAId, key: "lastUsedCurrency", value: "" },
    { user_id: userBId, key: "lastUsedCurrency", value: "" }
  ], { onConflict: "user_id,key" });
  await Promise.all([userA.auth.signOut(), userB.auth.signOut()]);
}, 60_000);

describe.sequential("Phase 4.5 real PostgreSQL transaction rollback", () => {
  it("1. Task create rolls back when a duplicate Subtask fails", async () => {
    const child = crypto.randomUUID();
    const { error } = await userA.rpc("save_task_with_relations", { p_task_id: ids.taskSub, p_create: true,
      p_task: taskPayload("rollback subtask"), p_tags: ["atomic"],
      p_subtasks: [{ id: child, title: "one" }, { id: child, title: "two" }], p_replace_subtasks: true });
    expect(error).not.toBeNull();
    expect(await count("tasks", "id", ids.taskSub)).toBe(0);
    expect(await count("subtasks", "taskId", ids.taskSub)).toBe(0);
    expect(await count("task_tags", "taskId", ids.taskSub)).toBe(0);
  });

  it("2. Task create rolls back when tag creation fails", async () => {
    const { error } = await userA.rpc("save_task_with_relations", { p_task_id: ids.taskTag, p_create: true,
      p_task: taskPayload("rollback tag"), p_tags: ["valid", null], p_subtasks: [], p_replace_subtasks: true });
    expect(error).not.toBeNull();
    expect(await count("tasks", "id", ids.taskTag)).toBe(0);
    expect(await count("task_tags", "taskId", ids.taskTag)).toBe(0);
  });

  it("3. Duplicate Task UUID leaves the existing Task and relations unchanged", async () => {
    await userA.from("tasks").insert({ id: ids.taskExisting, title: "original", type: "todo" });
    const { error } = await userA.rpc("save_task_with_relations", { p_task_id: ids.taskExisting, p_create: true,
      p_task: taskPayload("replacement"), p_tags: ["replacement"], p_subtasks: [], p_replace_subtasks: true });
    expect(error).not.toBeNull();
    const { data } = await admin.from("tasks").select("title").eq("id", ids.taskExisting).single();
    expect(data?.title).toBe("original");
    expect(await count("task_tags", "taskId", ids.taskExisting)).toBe(0);
  });

  it("4. Task update restores the old parent and Subtask after rebuild failure", async () => {
    await userA.from("tasks").insert({ id: ids.taskUpdate, title: "before", type: "todo" });
    await userA.from("subtasks").insert({ id: ids.subtaskOriginal, taskId: ids.taskUpdate, title: "original child" });
    const duplicate = crypto.randomUUID();
    const { error } = await userA.rpc("save_task_with_relations", { p_task_id: ids.taskUpdate, p_create: false,
      p_task: taskPayload("after"), p_tags: ["after"],
      p_subtasks: [{ id: duplicate, title: "new one" }, { id: duplicate, title: "new two" }], p_replace_subtasks: true });
    expect(error).not.toBeNull();
    const [{ data: task }, { data: subtasks }] = await Promise.all([
      admin.from("tasks").select("title").eq("id", ids.taskUpdate).single(),
      admin.from("subtasks").select("id,title").eq("taskId", ids.taskUpdate)
    ]);
    expect(task?.title).toBe("before");
    expect(subtasks).toEqual([{ id: ids.subtaskOriginal, title: "original child" }]);
  });

  it("5. Progress-entry conflict does not update the Task current value", async () => {
    await userA.from("tasks").insert({ id: ids.progressTask, title: "progress", type: "counter",
      progressEnabled: true, progressCurrent: 2, progressTarget: 10, progressType: "count" });
    await userA.from("task_progress_entries").insert({ id: ids.progressEntry, taskId: ids.progressTask, amountDelta: 1 });
    const { error } = await userA.rpc("add_task_progress_entry_atomic", { p_task_id: ids.progressTask,
      p_entry_id: ids.progressEntry, p_entry: { amountDelta: 97 }, p_next_current: 99 });
    expect(error).not.toBeNull();
    const { data } = await admin.from("tasks").select("progressCurrent").eq("id", ids.progressTask).single();
    expect(Number(data?.progressCurrent)).toBe(2);
    expect(await count("task_progress_entries", "taskId", ids.progressTask)).toBe(1);
  });

  it("6. Plan create rolls back when User A links User B Task", async () => {
    await userB.from("tasks").insert({ id: ids.taskB, title: "B private", type: "todo" });
    const { error } = await userA.rpc("save_plan_with_relations", { p_plan_id: ids.planCross, p_create: true,
      p_plan: { title: "cross plan", type: "daily", startDate: "2026-07-12", endDate: "2026-07-12" },
      p_task_ids: [ids.taskB], p_item_drafts: [], p_replace_items: true });
    expect(error).not.toBeNull();
    expect(await count("plans", "id", ids.planCross)).toBe(0);
    expect(await count("plan_items", "planId", ids.planCross)).toBe(0);
  });

  it("7. Plan create rolls back when a generated Task UUID conflicts", async () => {
    await userA.from("tasks").insert({ id: ids.planTaskConflict, title: "existing", type: "todo" });
    const { error } = await userA.rpc("save_plan_with_relations", { p_plan_id: ids.planCreate, p_create: true,
      p_plan: { title: "conflict plan", type: "daily", startDate: "2026-07-12", endDate: "2026-07-12", reflectionNote: "new" },
      p_task_ids: [], p_item_drafts: [{ id: ids.planTaskConflict, title: "conflict" }], p_replace_items: true });
    expect(error).not.toBeNull();
    expect(await count("plans", "id", ids.planCreate)).toBe(0);
    expect(await count("journal_entries", "linkedPlanId", ids.planCreate)).toBe(0);
  });

  it("8. Plan update restores Plan, links and Journal after a mid-write failure", async () => {
    await userA.from("plans").insert({ id: ids.planUpdate, title: "before plan", type: "daily", startDate: "2026-07-12", endDate: "2026-07-12", reflectionNote: "before note" });
    await userA.from("tasks").insert({ id: ids.planLinkedTask, title: "linked", type: "todo" });
    await userA.from("plan_items").insert({ planId: ids.planUpdate, taskId: ids.planLinkedTask, sortOrder: 0 });
    await userA.from("journal_entries").insert({ id: ids.journalOriginal, date: "2026-07-12", source: "daily_plan", content: "before note", linkedPlanId: ids.planUpdate });
    const { error } = await userA.rpc("save_plan_with_relations", { p_plan_id: ids.planUpdate, p_create: false,
      p_plan: { title: "after plan", type: "daily", startDate: "2026-07-12", endDate: "2026-07-12", reflectionNote: "after note" },
      p_task_ids: [], p_item_drafts: [{ id: ids.planDraft, title: "one" }, { id: ids.planDraft, title: "two" }], p_replace_items: true });
    expect(error).not.toBeNull();
    const [{ data: plan }, { data: links }, { data: journal }] = await Promise.all([
      admin.from("plans").select("title,reflectionNote").eq("id", ids.planUpdate).single(),
      admin.from("plan_items").select("taskId").eq("planId", ids.planUpdate),
      admin.from("journal_entries").select("id,content").eq("linkedPlanId", ids.planUpdate)
    ]);
    expect(plan).toMatchObject({ title: "before plan", reflectionNote: "before note" });
    expect(links).toEqual([{ taskId: ids.planLinkedTask }]);
    expect(journal).toEqual([{ id: ids.journalOriginal, content: "before note" }]);
    expect(await count("tasks", "id", ids.planDraft)).toBe(0);
  });

  it("9. To Do create rolls back when a duplicate item UUID fails", async () => {
    const duplicate = ids.todoCreateItem;
    const { error } = await userA.rpc("save_todo_list_with_items", { p_list_id: ids.todoCreate, p_create: true,
      p_list: { title: "rollback list", date: "2026-07-12" },
      p_items: [{ id: duplicate, content: "one", sortOrder: 0 }, { id: duplicate, content: "two", sortOrder: 1 }],
      p_replace_items: true });
    expect(error).not.toBeNull();
    expect(await count("todo_lists", "id", ids.todoCreate)).toBe(0);
    expect(await count("todo_list_items", "todoListId", ids.todoCreate)).toBe(0);
  });

  it("10. To Do update restores the old list and items after replacement failure", async () => {
    await userA.from("todo_lists").insert({ id: ids.todoUpdate, title: "before list", date: "2026-07-12" });
    await userA.from("todo_list_items").insert({ id: ids.todoOriginalItem, todoListId: ids.todoUpdate, content: "original", sortOrder: 0 });
    const { error } = await userA.rpc("save_todo_list_with_items", { p_list_id: ids.todoUpdate, p_create: false,
      p_list: { title: "after list", date: "2026-07-12" },
      p_items: [{ id: ids.todoUpdateItem, content: "one" }, { id: ids.todoUpdateItem, content: "two" }], p_replace_items: true });
    expect(error).not.toBeNull();
    const [{ data: list }, { data: items }] = await Promise.all([
      admin.from("todo_lists").select("title").eq("id", ids.todoUpdate).single(),
      admin.from("todo_list_items").select("id,content").eq("todoListId", ids.todoUpdate)
    ]);
    expect(list?.title).toBe("before list");
    expect(items).toEqual([{ id: ids.todoOriginalItem, content: "original" }]);
  });

  it("11. Expense failure leaves both Expense and remembered currency unchanged", async () => {
    await userB.from("uploaded_files").insert({ id: ids.receiptB, originalName: "b.txt", storedName: "b.txt",
      path: "synthetic", mimeType: "text/plain", size: 1 });
    const { error } = await userA.rpc("save_expense_with_currency", { p_expense_id: ids.expense, p_create: true,
      p_expense: { type: "expense", title: "cross receipt", amount: 1, currency: "CNY", category: "test",
        date: "2026-07-12", receiptFileId: ids.receiptB } });
    expect(error).not.toBeNull();
    expect(await count("expenses", "id", ids.expense)).toBe(0);
    const { data } = await admin.from("settings").select("value").eq("user_id", userAId).eq("key", "lastUsedCurrency").single();
    expect(data?.value).toBe("AUD");
  });

  it("12. Anonymous callers cannot execute transaction functions", async () => {
    const anonymous = client();
    const { error } = await anonymous.rpc("save_task_with_relations", { p_task_id: crypto.randomUUID(), p_create: true,
      p_task: taskPayload("anonymous"), p_tags: [], p_subtasks: [], p_replace_subtasks: true });
    expect(error).not.toBeNull();
  });

  it("13. Zero progress preserves the existing not_started status", async () => {
    const taskId = crypto.randomUUID();
    await userA.from("tasks").insert({ id: taskId, title: "zero progress", type: "counter",
      status: "not_started", progressEnabled: true, progressCurrent: 0, progressTarget: 10, progressType: "count" });
    const { error } = await userA.rpc("add_task_progress_entry_atomic", { p_task_id: taskId,
      p_entry_id: crypto.randomUUID(), p_entry: { amountDelta: 0 }, p_next_current: 0 });
    expect(error).toBeNull();
    const { data } = await admin.from("tasks").select("status,progressCurrent").eq("id", taskId).single();
    expect(data).toMatchObject({ status: "not_started", progressCurrent: 0 });
  });
});
