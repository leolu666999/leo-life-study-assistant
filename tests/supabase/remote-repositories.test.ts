import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { GET as getSettings, PATCH as patchSettings } from "@/app/api/settings/route";
import { GET as getTasks, POST as postTask } from "@/app/api/tasks/route";
import { PATCH as patchTask, DELETE as deleteTask } from "@/app/api/tasks/[id]/route";
import { POST as completeTask } from "@/app/api/tasks/[id]/complete/route";
import { POST as archiveTask } from "@/app/api/tasks/[id]/archive/route";
import { POST as restoreTask } from "@/app/api/tasks/[id]/restore/route";
import { GET as getProgressEntries, POST as postProgressEntry } from "@/app/api/tasks/[id]/progress-entries/route";
import { PATCH as patchSubtask } from "@/app/api/subtasks/[id]/route";
import { GET as getProgress, POST as postProgress } from "@/app/api/progress/route";
import { POST as pinProgress } from "@/app/api/progress/[id]/pin/route";
import { GET as getTodoLists, POST as postTodoList } from "@/app/api/todo-lists/route";
import { PATCH as patchTodoList } from "@/app/api/todo-lists/[id]/route";
import { PATCH as patchTodoItem } from "@/app/api/todo-list-items/[id]/route";
import { GET as getPlans, POST as postPlan } from "@/app/api/plans/route";
import { PATCH as patchPlan, DELETE as deletePlan } from "@/app/api/plans/[id]/route";
import { GET as getJournal, POST as postJournal } from "@/app/api/journal/route";
import { GET as getExpenses, POST as postExpense } from "@/app/api/expenses/route";
import { PATCH as patchExpense, DELETE as deleteExpense } from "@/app/api/expenses/[id]/route";

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for remote repository tests`);
  return value;
};

const url = required("NEXT_PUBLIC_SUPABASE_URL");
const publishableKey = required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const secretKey = required("SUPABASE_SECRET_KEY");
const userAId = required("SUPABASE_TEST_USER_A_ID");
const userBId = required("SUPABASE_TEST_USER_B_ID");
const adminId = required("SUPABASE_TEST_ADMIN_ID");

let admin: SupabaseClient;
let userA: Session;
let userB: Session;
let adminSession: Session;
let taskAId = "";
let subtaskAId = "";
let adminTaskId = "";
let todoAId = "";
let todoItemAId = "";
let planAId = "";
let journalAId = "";
let expenseAId = "";
let expenseUsdId = "";
let receiptAId = "";

function client(key = publishableKey) {
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

async function signIn(emailName: string, passwordName: string) {
  const result = client();
  const { data, error } = await result.auth.signInWithPassword({ email: required(emailName), password: required(passwordName) });
  if (error || !data.session) throw error || new Error(`Unable to sign in ${emailName}`);
  return data.session;
}

function request(path: string, session: Session, method = "GET", body?: unknown) {
  return new Request(`http://local.test${path}`, {
    method,
    headers: {
      authorization: `Bearer ${session.access_token}`,
      ...(body === undefined ? {} : { "content-type": "application/json" })
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

async function json(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

async function restoreSettings() {
  const rows = [userAId, userBId, adminId].flatMap((userId) => [
    { user_id: userId, key: "lastUsedCurrency", value: "" },
    { user_id: userId, key: "homeTitle", value: "MyAssist" },
    { user_id: userId, key: "showHomeTitle", value: "1" },
    { user_id: userId, key: "background", value: "default" }
  ]);
  const { error } = await admin.from("settings").upsert(rows, { onConflict: "user_id,key" });
  if (error) throw error;
}

async function cleanupBusinessFixtures() {
  const owners = [userAId, userBId, adminId];
  for (const table of ["expenses", "todo_list_items", "todo_lists", "journal_entries", "task_tags", "subtasks", "task_progress_entries", "progress_items", "plan_items", "tasks", "tags", "plans", "uploaded_files"]) {
    const { error } = await admin.from(table).delete().in("user_id", owners);
    if (error) throw error;
  }
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeAll(async () => {
  process.env.DATA_BACKEND = "supabase";
  process.env.AUTH_REQUIRED = "true";
  admin = client(secretKey);
  [userA, userB, adminSession] = await Promise.all([
    signIn("SUPABASE_TEST_USER_A_EMAIL", "SUPABASE_TEST_USER_A_PASSWORD"),
    signIn("SUPABASE_TEST_USER_B_EMAIL", "SUPABASE_TEST_USER_B_PASSWORD"),
    signIn("SUPABASE_TEST_ADMIN_EMAIL", "SUPABASE_TEST_ADMIN_PASSWORD")
  ]);
  await cleanupBusinessFixtures();
  await restoreSettings();
}, 60_000);

afterAll(async () => {
  await cleanupBusinessFixtures();
  await restoreSettings();
  delete process.env.DATA_BACKEND;
  delete process.env.AUTH_REQUIRED;
}, 60_000);

describe.sequential("Wave 1 cloud Settings Repository", () => {
  it("1. User A reads the existing API settings shape", async () => {
    const response = await getSettings(request("/api/settings", userA));
    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({ lastUsedCurrency: null, homeTitle: "MyAssist", showHomeTitle: true });
  });

  it("2. User A updates its home title without affecting User B", async () => {
    const updated = await patchSettings(request("/api/settings", userA, "PATCH", { homeTitle: "A Cloud", user_id: userBId }));
    expect(await json(updated)).toMatchObject({ homeTitle: "A Cloud" });
    expect(await json(await getSettings(request("/api/settings", userB)))).toMatchObject({ homeTitle: "MyAssist" });
  });

  it("3. User B updates lastUsedCurrency without affecting User A", async () => {
    expect(await json(await patchSettings(request("/api/settings", userB, "PATCH", { lastUsedCurrency: "USD" })))).toMatchObject({ lastUsedCurrency: "USD" });
    expect(await json(await getSettings(request("/api/settings", userA)))).toMatchObject({ lastUsedCurrency: null });
  });

  it("4. Admin Account ordinary Settings API uses only its own data space", async () => {
    expect(await json(await patchSettings(request("/api/settings", adminSession, "PATCH", { homeTitle: "Admin Cloud" })))).toMatchObject({ homeTitle: "Admin Cloud" });
    expect(await json(await getSettings(request("/api/settings", userA)))).toMatchObject({ homeTitle: "A Cloud" });
  });

  it("5. client owner fields and headers cannot replace Session user.id", async () => {
    const spoofed = new Request("http://local.test/api/settings?user_id=" + userBId, {
      method: "PATCH",
      headers: { authorization: `Bearer ${userA.access_token}`, "content-type": "application/json", "x-user-id": userBId },
      body: JSON.stringify({ homeTitle: "A Verified", user_id: userBId })
    });
    expect(await json(await patchSettings(spoofed))).toMatchObject({ homeTitle: "A Verified" });
    expect(await json(await getSettings(request("/api/settings", userB)))).toMatchObject({ homeTitle: "MyAssist" });
  });
});

describe.sequential("Wave 2 cloud Task Repository", () => {
  it("6. User A creates a checklist Task with progress and the current response shape", async () => {
    const response = await postTask(request("/api/tasks", userA, "POST", {
      title: "A cloud task", type: "checklist", priority: "high", tags: ["cloud"],
      progressEnabled: true, progressType: "count", progressCurrent: 99, progressTarget: 99, progressUnit: "wrong",
      subtasks: [
        { title: "A private item", completed: false },
        { title: "B", completed: true },
        { title: "C", completed: false },
        { title: "D", completed: false },
        { title: "E", completed: false }
      ]
    }));
    expect(response.status).toBe(201);
    const body = await json(response) as { id: string; subtasks: Array<{ id: string }>; tags: string[]; progressCurrent: number; progressTarget: number; progressUnit: string };
    taskAId = body.id;
    subtaskAId = body.subtasks[0].id;
    expect(body.tags).toEqual(expect.arrayContaining(["cloud", "清单"]));
    expect(body.progressCurrent).toBe(1);
    expect(body.progressTarget).toBe(5);
    expect(body.progressUnit).toBe("项");
  });

  it("7. User A lists its Task", async () => {
    const body = await (await getTasks(request("/api/tasks", userA))).json() as Array<{ id: string }>;
    expect(body.some((task) => task.id === taskAId)).toBe(true);
  });

  it("8. User B cannot see User A Task", async () => {
    const body = await (await getTasks(request("/api/tasks", userB))).json() as Array<{ id: string }>;
    expect(body.some((task) => task.id === taskAId)).toBe(false);
  });

  it("9. User B cannot update User A Task and the row is unchanged", async () => {
    const response = await patchTask(request(`/api/tasks/${taskAId}`, userB, "PATCH", { title: "tampered" }), params(taskAId));
    expect(response.status).toBe(404);
    const { data } = await admin.from("tasks").select("title").eq("id", taskAId).single();
    expect(data?.title).toBe("A cloud task");
  });

  it("10. User B cannot delete User A Task even when UUID is known", async () => {
    expect((await deleteTask(request(`/api/tasks/${taskAId}`, userB, "DELETE"), params(taskAId))).status).toBe(200);
    const { count } = await admin.from("tasks").select("*", { count: "exact", head: true }).eq("id", taskAId);
    expect(count).toBe(1);
  });

  it("11. User B cannot complete User A Task", async () => {
    expect((await completeTask(request(`/api/tasks/${taskAId}/complete`, userB, "POST"), params(taskAId))).status).toBe(404);
  });

  it("12. progress history is owner-only and updates the Task shape", async () => {
    const updated = await postProgressEntry(request(`/api/tasks/${taskAId}/progress-entries`, userA, "POST", { amountDelta: 2, note: "A only" }), params(taskAId));
    expect(await json(updated)).toMatchObject({ id: taskAId, progressCurrent: 3, status: "in_progress" });
    expect(await (await getProgressEntries(request(`/api/tasks/${taskAId}/progress-entries`, userB), params(taskAId))).json()).toEqual([]);
  });

  it("13. subtasks are owner-only", async () => {
    expect((await patchSubtask(request(`/api/subtasks/${subtaskAId}`, userB, "PATCH", { completed: true }), params(subtaskAId))).status).toBe(404);
    const own = await patchSubtask(request(`/api/subtasks/${subtaskAId}`, userA, "PATCH", { completed: true }), params(subtaskAId));
    expect(await json(own)).toMatchObject({ id: subtaskAId, completed: true });
    const { data } = await admin.from("tasks").select("progressCurrent,progressTarget,progressUnit").eq("id", taskAId).single();
    expect(data).toMatchObject({ progressCurrent: 2, progressTarget: 5, progressUnit: "项" });
  });

  it("14. archive and restore preserve current Task transitions", async () => {
    expect(await json(await archiveTask(request(`/api/tasks/${taskAId}/archive`, userA, "POST"), params(taskAId)))).toMatchObject({ status: "archived" });
    expect(await json(await restoreTask(request(`/api/tasks/${taskAId}/restore`, userA, "POST"), params(taskAId)))).toMatchObject({ status: "not_started", archivedAt: null });
  });

  it("15. legacy progress endpoints create and pin a task-backed progress item", async () => {
    const created = await json(await postProgress(request("/api/progress", userA, "POST", { title: "A counter", currentValue: 2, targetValue: 10, unit: "次" }))) as { id: string };
    const pinned = await (await pinProgress(request(`/api/progress/${created.id}/pin`, userA, "POST"), params(created.id))).json() as Array<{ id: string; pinned: boolean }>;
    expect(pinned.find((item) => item.id === created.id)?.pinned).toBe(true);
    expect((await (await getProgress(request("/api/progress", userB))).json() as Array<{ id: string }>).some((item) => item.id === created.id)).toBe(false);
  });

  it("16. Admin Account ordinary Task API sees only Admin-owned Tasks", async () => {
    const created = await json(await postTask(request("/api/tasks", adminSession, "POST", { title: "Admin own task", type: "todo" }))) as { id: string };
    adminTaskId = created.id;
    const listed = await (await getTasks(request("/api/tasks", adminSession))).json() as Array<{ id: string }>;
    expect(listed.some((task) => task.id === adminTaskId)).toBe(true);
    expect(listed.some((task) => task.id === taskAId)).toBe(false);
  });

  it("17. database rejects a cross-user Subtask parent", async () => {
    const b = client();
    await b.auth.setSession({ access_token: userB.access_token, refresh_token: userB.refresh_token });
    const { error } = await b.from("subtasks").insert({ user_id: userBId, taskId: taskAId, title: "cross owner" });
    expect(error).not.toBeNull();
  });

  it("18. database rejects a cross-user Task/Tag relation", async () => {
    const { data: tagA } = await admin.from("tags").select("id").eq("user_id", userAId).eq("name", "cloud").single();
    const b = client();
    await b.auth.setSession({ access_token: userB.access_token, refresh_token: userB.refresh_token });
    const { error } = await b.from("task_tags").insert({ user_id: userBId, taskId: adminTaskId, tagId: tagA!.id });
    expect(error).not.toBeNull();
  });

  it("19. User A can delete its own Task", async () => {
    expect((await deleteTask(request(`/api/tasks/${taskAId}`, userA, "DELETE"), params(taskAId))).status).toBe(200);
    const { count } = await admin.from("tasks").select("*", { count: "exact", head: true }).eq("id", taskAId);
    expect(count).toBe(0);
  });
});

describe.sequential("Wave 3 cloud To Do Repository", () => {
  it("20. User A creates a To Do List with Sydney wall-time schedule fields", async () => {
    const response = await postTodoList(request("/api/todo-lists", userA, "POST", {
      title: "A private list", date: "2026-07-12",
      itemDrafts: [{ content: "晚上7点到8点半 健身", completed: false }, { content: "无时间事项", completed: false }]
    }));
    expect(response.status).toBe(201);
    const body = await response.json() as { id: string; items: Array<{ id: string; hasScheduleTime: boolean; scheduledStartAt: string; scheduledEndAt: string }> };
    todoAId = body.id;
    todoItemAId = body.items[0].id;
    expect(body.items[0]).toMatchObject({ hasScheduleTime: true, scheduledStartAt: "2026-07-12T19:00:00", scheduledEndAt: "2026-07-12T20:30:00" });
    expect(body.items[1].hasScheduleTime).toBe(false);
  });

  it("21. User A lists its To Do while User B cannot see it", async () => {
    const a = await (await getTodoLists(request("/api/todo-lists", userA))).json() as Array<{ id: string }>;
    const b = await (await getTodoLists(request("/api/todo-lists", userB))).json() as Array<{ id: string }>;
    expect(a.some((list) => list.id === todoAId)).toBe(true);
    expect(b.some((list) => list.id === todoAId)).toBe(false);
  });

  it("22. User B cannot update User A To Do List", async () => {
    const response = await patchTodoList(request(`/api/todo-lists/${todoAId}`, userB, "PATCH", { title: "tampered" }), params(todoAId));
    expect(response.status).toBe(404);
    const { data } = await admin.from("todo_lists").select("title").eq("id", todoAId).single();
    expect(data?.title).toBe("A private list");
  });

  it("23. User B cannot complete User A To Do item", async () => {
    expect((await patchTodoItem(request(`/api/todo-list-items/${todoItemAId}`, userB, "PATCH", { completed: true }), params(todoItemAId))).status).toBe(404);
    const { data } = await admin.from("todo_list_items").select("completed").eq("id", todoItemAId).single();
    expect(data?.completed).toBe(false);
  });

  it("24. User A can complete its own item without losing schedule fields", async () => {
    const body = await json(await patchTodoItem(request(`/api/todo-list-items/${todoItemAId}`, userA, "PATCH", { completed: true }), params(todoItemAId)));
    expect(body).toMatchObject({ id: todoItemAId, completed: true, hasScheduleTime: true, scheduledStartAt: "2026-07-12T19:00:00" });
  });

  it("25. database rejects a cross-user To Do parent relation", async () => {
    const b = client();
    await b.auth.setSession({ access_token: userB.access_token, refresh_token: userB.refresh_token });
    const { error } = await b.from("todo_list_items").insert({ user_id: userBId, todoListId: todoAId, content: "cross owner" });
    expect(error).not.toBeNull();
  });

  it("26. Admin Account ordinary To Do API cannot see User A list", async () => {
    const listed = await (await getTodoLists(request("/api/todo-lists", adminSession))).json() as Array<{ id: string }>;
    expect(listed.some((list) => list.id === todoAId)).toBe(false);
  });
});

describe.sequential("Wave 4 cloud Plan and Journal Repositories", () => {
  it("27. User A creates a daily Plan with items and a reflection", async () => {
    const response = await postPlan(request("/api/plans", userA, "POST", {
      title: "A private plan", type: "daily", startDate: "2026-07-13", endDate: "2026-07-13",
      reflectionNote: "A private reflection", itemTitles: ["A plan item"]
    }));
    expect(response.status).toBe(201);
    const body = await response.json() as { id: string; items: Array<{ title: string }> };
    planAId = body.id;
    expect(body.items.map((item) => item.title)).toContain("A plan item");
  });

  it("28. User A lists its Plan while User B cannot see it", async () => {
    const a = await (await getPlans(request("/api/plans", userA))).json() as Array<{ id: string }>;
    const b = await (await getPlans(request("/api/plans", userB))).json() as Array<{ id: string }>;
    expect(a.some((plan) => plan.id === planAId)).toBe(true);
    expect(b.some((plan) => plan.id === planAId)).toBe(false);
  });

  it("29. User B cannot update or delete User A Plan", async () => {
    expect((await patchPlan(request(`/api/plans/${planAId}`, userB, "PATCH", { title: "tampered" }), params(planAId))).status).toBe(404);
    expect((await deletePlan(request(`/api/plans/${planAId}`, userB, "DELETE"), params(planAId))).status).toBe(200);
    const { data } = await admin.from("plans").select("title").eq("id", planAId).single();
    expect(data?.title).toBe("A private plan");
  });

  it("30. User A updates its Plan and reflection", async () => {
    const body = await json(await patchPlan(request(`/api/plans/${planAId}`, userA, "PATCH", {
      title: "A updated plan", reflectionNote: "A updated private reflection"
    }), params(planAId)));
    expect(body).toMatchObject({ id: planAId, title: "A updated plan", reflectionNote: "A updated private reflection" });
  });

  it("31. User A creates a high-sensitivity Journal entry that User B cannot read", async () => {
    const created = await json(await postJournal(request("/api/journal", userA, "POST", {
      date: "2026-07-13", source: "manual", content: "A HIGHLY PRIVATE JOURNAL CONTENT"
    }))) as { id: string };
    journalAId = created.id;
    const b = await (await getJournal(request("/api/journal", userB))).json() as Array<{ id: string; content: string }>;
    expect(b.some((entry) => entry.id === journalAId || entry.content.includes("HIGHLY PRIVATE"))).toBe(false);
  });

  it("32. database rejects User B linking Journal to User A Plan", async () => {
    await expect(postJournal(request("/api/journal", userB, "POST", {
      date: "2026-07-13", source: "manual", content: "cross owner", linkedPlanId: planAId
    }))).rejects.toBeTruthy();
    const { count } = await admin.from("journal_entries").select("*", { count: "exact", head: true })
      .eq("user_id", userBId).eq("content", "cross owner");
    expect(count).toBe(0);
  });

  it("33. Admin Account ordinary APIs cannot see User A Plan or Journal", async () => {
    const plans = await (await getPlans(request("/api/plans", adminSession))).json() as Array<{ id: string }>;
    const journal = await (await getJournal(request("/api/journal", adminSession))).json() as Array<{ id: string }>;
    expect(plans.some((plan) => plan.id === planAId)).toBe(false);
    expect(journal.some((entry) => entry.id === journalAId)).toBe(false);
  });

  it("34. User A deletes its Plan and the generated daily reflection", async () => {
    expect((await deletePlan(request(`/api/plans/${planAId}`, userA, "DELETE"), params(planAId))).status).toBe(200);
    const [{ count: planCount }, { count: reflectionCount }] = await Promise.all([
      admin.from("plans").select("*", { count: "exact", head: true }).eq("id", planAId),
      admin.from("journal_entries").select("*", { count: "exact", head: true }).eq("linkedPlanId", planAId)
    ]);
    expect(planCount).toBe(0);
    expect(reflectionCount).toBe(0);
  });
});

describe.sequential("Wave 5 cloud Finance Repository", () => {
  it("35. User A creates AUD income and lastUsedCurrency updates only after save", async () => {
    const response = await postExpense(request("/api/expenses", userA, "POST", {
      title: "A delivery income", type: "income", amount: 10, currency: "AUD", category: "外卖收入", date: "2026-07-14"
    }));
    expect(response.status).toBe(201);
    const body = await response.json() as { id: string; amount: number; currency: string; receiptFileId: null };
    expenseAId = body.id;
    expect(body).toMatchObject({ amount: 10, currency: "AUD", receiptFileId: null });
    expect(await json(await getSettings(request("/api/settings", userA)))).toMatchObject({ lastUsedCurrency: "AUD" });
  });

  it("36. User A keeps USD and AUD records as separate currencies", async () => {
    const created = await postExpense(request("/api/expenses", userA, "POST", {
      title: "A USD expense", type: "expense", amount: 7.5, currency: "USD", category: "其他", date: "2026-07-14"
    }));
    expenseUsdId = String((await created.json()).id);
    const list = await (await getExpenses(request("/api/expenses", userA))).json() as Array<{ id: string; amount: number; currency: string }>;
    expect(list.find((item) => item.id === expenseAId)).toMatchObject({ amount: 10, currency: "AUD" });
    expect(list.find((item) => item.id === expenseUsdId)).toMatchObject({ amount: 7.5, currency: "USD" });
  });

  it("37. User B cannot read User A Expenses", async () => {
    const list = await (await getExpenses(request("/api/expenses", userB))).json() as Array<{ id: string }>;
    expect(list.some((item) => item.id === expenseAId || item.id === expenseUsdId)).toBe(false);
  });

  it("38. User B cannot update or delete User A Expense", async () => {
    expect((await patchExpense(request(`/api/expenses/${expenseAId}`, userB, "PATCH", { amount: 999, currency: "AUD" }), params(expenseAId))).status).toBe(404);
    expect((await deleteExpense(request(`/api/expenses/${expenseAId}`, userB, "DELETE"), params(expenseAId))).status).toBe(200);
    const { data } = await admin.from("expenses").select("amount").eq("id", expenseAId).single();
    expect(Number(data?.amount)).toBe(10);
  });

  it("39. database rejects User B attaching User A receipt metadata", async () => {
    receiptAId = crypto.randomUUID();
    const { error: fixtureError } = await admin.from("uploaded_files").insert({ id: receiptAId, user_id: userAId,
      originalName: "synthetic.txt", storedName: "synthetic.txt", path: "synthetic", mimeType: "text/plain", size: 1 });
    expect(fixtureError).toBeNull();
    await expect(postExpense(request("/api/expenses", userB, "POST", {
      title: "cross receipt", amount: 1, currency: "AUD", category: "其他", receiptFileId: receiptAId
    }))).rejects.toBeTruthy();
    const { count } = await admin.from("expenses").select("*", { count: "exact", head: true }).eq("user_id", userBId).eq("title", "cross receipt");
    expect(count).toBe(0);
  });

  it("40. Admin Account ordinary Expenses API sees only Admin-owned data", async () => {
    const own = await postExpense(request("/api/expenses", adminSession, "POST", {
      title: "Admin own expense", amount: 2, currency: "AUD", category: "其他", date: "2026-07-14"
    }));
    expect(own.status).toBe(201);
    const list = await (await getExpenses(request("/api/expenses", adminSession))).json() as Array<{ id: string }>;
    expect(list.some((item) => item.id === expenseAId)).toBe(false);
  });

  it("41. User A updates currency and only its own currency memory", async () => {
    const body = await json(await patchExpense(request(`/api/expenses/${expenseAId}`, userA, "PATCH", { amount: 12, currency: "CNY" }), params(expenseAId)));
    expect(body).toMatchObject({ id: expenseAId, amount: 12, currency: "CNY" });
    expect(await json(await getSettings(request("/api/settings", userA)))).toMatchObject({ lastUsedCurrency: "CNY" });
    expect(await json(await getSettings(request("/api/settings", userB)))).toMatchObject({ lastUsedCurrency: "USD" });
  });

  it("42. User A deletes its own Expense", async () => {
    expect((await deleteExpense(request(`/api/expenses/${expenseAId}`, userA, "DELETE"), params(expenseAId))).status).toBe(200);
    const { count } = await admin.from("expenses").select("*", { count: "exact", head: true }).eq("id", expenseAId);
    expect(count).toBe(0);
  });
});
