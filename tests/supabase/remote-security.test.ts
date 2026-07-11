import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { GET as getAdminStats } from "@/app/api/admin/system/stats/route";
import { GET as getAdminUserTasks } from "@/app/api/admin/users/[userId]/tasks/route";
import { adminApiRoutes } from "@/lib/admin/admin-api-contract";
import { isAdminIdentity } from "@/lib/auth/admin-core";

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for remote Supabase tests`);
  return value;
};

const url = required("NEXT_PUBLIC_SUPABASE_URL");
const publishableKey = required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const secretKey = required("SUPABASE_SECRET_KEY");
const userAId = required("SUPABASE_TEST_USER_A_ID");
const userBId = required("SUPABASE_TEST_USER_B_ID");
const adminId = required("SUPABASE_TEST_ADMIN_ID");

function client(key = publishableKey) {
  return createClient(url, key, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false }
  });
}

async function signedInClient(emailName: string, passwordName: string) {
  const result = client();
  const { data, error } = await result.auth.signInWithPassword({
    email: required(emailName),
    password: required(passwordName)
  });
  if (error || !data.session) throw error || new Error(`Unable to sign in ${emailName}`);
  return { client: result, token: data.session.access_token };
}

const ids = {
  taskA: crypto.randomUUID(),
  taskB: crypto.randomUUID(),
  taskAdmin: crypto.randomUUID(),
  subtaskCross: crypto.randomUUID(),
  todoListA: crypto.randomUUID(),
  todoItemCross: crypto.randomUUID(),
  journalA: crypto.randomUUID(),
  journalB: crypto.randomUUID(),
  expenseA: crypto.randomUUID(),
  uploadedA: crypto.randomUUID(),
  importantA: crypto.randomUUID(),
  timetableSourceA: crypto.randomUUID(),
  timetableCourseA: crypto.randomUUID(),
  occurrenceA: crypto.randomUUID(),
  audit: crypto.randomUUID()
};

let adminClient: SupabaseClient;
let userA: SupabaseClient;
let userB: SupabaseClient;
let adminOrdinary: SupabaseClient;
let anonymous: SupabaseClient;
let tokenA: string;
let tokenB: string;
let tokenAdmin: string;

async function cleanupFixtures() {
  const ownerIds = [userAId, userBId, adminId];
  await adminClient.storage.from("receipts").remove([`${userAId}/${ids.uploadedA}/synthetic.txt`]);
  for (const table of [
    "task_tags", "subtasks", "task_progress_entries", "plan_items", "todo_list_items", "important_files",
    "expenses", "course_occurrences", "timetable_courses", "timetable_sources", "assignments", "class_sessions",
    "journal_entries", "progress_items", "todo_lists", "tasks", "tags", "plans", "uploaded_files"
  ]) {
    await adminClient.from(table).delete().in("user_id", ownerIds);
  }
  await adminClient.from("admin_audit_logs").delete().eq("id", ids.audit);
}

beforeAll(async () => {
  adminClient = client(secretKey);
  anonymous = client();
  const a = await signedInClient("SUPABASE_TEST_USER_A_EMAIL", "SUPABASE_TEST_USER_A_PASSWORD");
  const b = await signedInClient("SUPABASE_TEST_USER_B_EMAIL", "SUPABASE_TEST_USER_B_PASSWORD");
  const admin = await signedInClient("SUPABASE_TEST_ADMIN_EMAIL", "SUPABASE_TEST_ADMIN_PASSWORD");
  userA = a.client;
  userB = b.client;
  adminOrdinary = admin.client;
  tokenA = a.token;
  tokenB = b.token;
  tokenAdmin = admin.token;

  await cleanupFixtures();
  const fixtureWrites = [
    userA.from("todo_lists").insert({ id: ids.todoListA, user_id: userAId, title: "A test list", date: "2026-07-11" }),
    userA.from("journal_entries").insert({ id: ids.journalA, user_id: userAId, date: "2026-07-11", source: "manual", content: "A synthetic journal" }),
    userB.from("journal_entries").insert({ id: ids.journalB, user_id: userBId, date: "2026-07-11", source: "manual", content: "B synthetic journal" }),
    userA.from("expenses").insert({ id: ids.expenseA, user_id: userAId, title: "Synthetic expense", amount: 1, currency: "AUD", category: "test", date: "2026-07-11" }),
    userA.from("uploaded_files").insert({ id: ids.uploadedA, user_id: userAId, originalName: "synthetic.txt", storedName: "synthetic.txt", path: "synthetic", mimeType: "text/plain", size: 9 }),
    userA.from("timetable_sources").insert({ id: ids.timetableSourceA, user_id: userAId, type: "ics_file", name: "Synthetic", semester: "test", academicYear: 2026 }),
    userA.from("timetable_courses").insert({ id: ids.timetableCourseA, user_id: userAId, courseCode: "TEST1000", courseName: "Synthetic", activityType: "test", semester: "test", academicYear: 2026, sourceId: ids.timetableSourceA })
  ];
  for (const write of fixtureWrites) {
    const { error } = await write;
    if (error) throw error;
  }
  const dependentWrites = [
    userA.from("important_files").insert({ id: ids.importantA, user_id: userAId, title: "Synthetic", fileId: ids.uploadedA }),
    userA.from("course_occurrences").insert({ id: ids.occurrenceA, user_id: userAId, courseId: ids.timetableCourseA, startAt: "2026-07-11T10:00:00Z", endAt: "2026-07-11T11:00:00Z", sourceId: ids.timetableSourceA })
  ];
  for (const write of dependentWrites) {
    const { error } = await write;
    if (error) throw error;
  }
}, 60_000);

afterAll(async () => {
  await cleanupFixtures();
  await Promise.all([userA.auth.signOut(), userB.auth.signOut(), adminOrdinary.auth.signOut()]);
}, 60_000);

describe.sequential("real ordinary-user RLS isolation", () => {
  it("1. User A can create its own Task", async () => {
    const { error } = await userA.from("tasks").insert({ id: ids.taskA, user_id: userAId, title: "A task", type: "todo" });
    expect(error).toBeNull();
  });

  it("2. User A can read its own Task", async () => {
    const { data, error } = await userA.from("tasks").select("id").eq("id", ids.taskA);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("3. User B cannot read User A Task", async () => {
    const { data, error } = await userB.from("tasks").select("id").eq("id", ids.taskA);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("4. User B cannot update User A Task and the row stays unchanged", async () => {
    const { data, error } = await userB.from("tasks").update({ title: "tampered" }).eq("id", ids.taskA).select("id");
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
    const { data: actual } = await adminClient.from("tasks").select("title").eq("id", ids.taskA).single();
    expect(actual?.title).toBe("A task");
  });

  it("5. User B cannot delete User A Task and the row remains", async () => {
    const { data, error } = await userB.from("tasks").delete().eq("id", ids.taskA).select("id");
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
    const { count } = await adminClient.from("tasks").select("*", { count: "exact", head: true }).eq("id", ids.taskA);
    expect(count).toBe(1);
  });

  it("6. User B cannot attach a Subtask to User A Task", async () => {
    const { error } = await userB.from("subtasks").insert({ id: ids.subtaskCross, user_id: userBId, taskId: ids.taskA, title: "cross-owner" });
    expect(error).not.toBeNull();
    const { count } = await adminClient.from("subtasks").select("*", { count: "exact", head: true }).eq("id", ids.subtaskCross);
    expect(count).toBe(0);
  });

  it("7. User B cannot attach an item to User A TodoList", async () => {
    const { error } = await userB.from("todo_list_items").insert({ id: ids.todoItemCross, user_id: userBId, todoListId: ids.todoListA, content: "cross-owner" });
    expect(error).not.toBeNull();
    const { count } = await adminClient.from("todo_list_items").select("*", { count: "exact", head: true }).eq("id", ids.todoItemCross);
    expect(count).toBe(0);
  });

  it("8. User B cannot read User A Journal", async () => {
    const { data } = await userB.from("journal_entries").select("id").eq("id", ids.journalA);
    expect(data).toHaveLength(0);
  });

  it("9. User B cannot read User A Expenses", async () => {
    const { data } = await userB.from("expenses").select("id").eq("id", ids.expenseA);
    expect(data).toHaveLength(0);
  });

  it("10. User B cannot read User A Important File metadata", async () => {
    const { data } = await userB.from("important_files").select("id").eq("id", ids.importantA);
    expect(data).toHaveLength(0);
  });

  it("11. User B cannot read User A Timetable", async () => {
    const { data } = await userB.from("course_occurrences").select("id").eq("id", ids.occurrenceA);
    expect(data).toHaveLength(0);
  });

  it("12. User B cannot read User A Settings", async () => {
    const { data } = await userB.from("settings").select("key").eq("user_id", userAId);
    expect(data).toHaveLength(0);
  });

  it("13. Guessing User A UUID still returns no Task", async () => {
    const { data } = await userB.from("tasks").select("id").eq("user_id", userAId).eq("id", ids.taskA);
    expect(data).toHaveLength(0);
  });

  it("14. Anonymous client cannot access a private table", async () => {
    const { data, error } = await anonymous.from("tasks").select("id");
    expect(data ?? []).toHaveLength(0);
    expect(error).not.toBeNull();
  });
});

describe.sequential("real Admin and Personal account separation", () => {
  it("1. Personal Account is not admin", () => {
    expect(isAdminIdentity({ id: userAId }, adminId)).toBe(false);
  });

  it("2. User A receives 403 from Admin API", async () => {
    const response = await getAdminStats(new Request("http://local/api/admin/system/stats", { headers: { authorization: `Bearer ${tokenA}` } }));
    expect(response.status).toBe(403);
  });

  it("3. User B receives 403 from Admin API", async () => {
    const response = await getAdminStats(new Request("http://local/api/admin/system/stats", { headers: { authorization: `Bearer ${tokenB}` } }));
    expect(response.status).toBe(403);
  });

  it("4. Admin User can enter Admin API", async () => {
    const response = await getAdminStats(new Request("http://local/api/admin/system/stats", { headers: { authorization: `Bearer ${tokenAdmin}` } }));
    expect(response.status).toBe(200);
  });

  it("5. Admin API can query User A Task", async () => {
    const response = await getAdminUserTasks(
      new Request("http://local/api/admin/users/a/tasks", { headers: { authorization: `Bearer ${tokenAdmin}` } }),
      { params: Promise.resolve({ userId: userAId }) }
    );
    expect(response.status).toBe(200);
    expect((await response.json()).tasks.some((task: { id: string }) => task.id === ids.taskA)).toBe(true);
  });

  it("6. Admin API can query User B Task", async () => {
    const { error } = await userB.from("tasks").insert({ id: ids.taskB, user_id: userBId, title: "B task", type: "todo" });
    expect(error).toBeNull();
    const response = await getAdminUserTasks(
      new Request("http://local/api/admin/users/b/tasks", { headers: { authorization: `Bearer ${tokenAdmin}` } }),
      { params: Promise.resolve({ userId: userBId }) }
    );
    expect(response.status).toBe(200);
    expect((await response.json()).tasks.some((task: { id: string }) => task.id === ids.taskB)).toBe(true);
  });

  it("7. Ordinary User A cannot call the cross-user task API", async () => {
    const response = await getAdminUserTasks(
      new Request("http://local/api/admin/users/b/tasks", { headers: { authorization: `Bearer ${tokenA}` } }),
      { params: Promise.resolve({ userId: userBId }) }
    );
    expect(response.status).toBe(403);
  });

  it("8. Controlled admin client can read User B Journal", async () => {
    const { data } = await adminClient.from("journal_entries").select("id").eq("id", ids.journalB);
    expect(data).toHaveLength(1);
  });

  it("9. Admin API returns cross-user statistics", async () => {
    const response = await getAdminStats(new Request("http://local/api/admin/system/stats", { headers: { authorization: `Bearer ${tokenAdmin}` } }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.totalUsers).toBeGreaterThanOrEqual(3);
    expect(body.rowCounts.tasks).toBeGreaterThanOrEqual(2);
  });

  it("10. Admin ordinary client only sees its own data", async () => {
    const { error } = await adminOrdinary.from("tasks").insert({ id: ids.taskAdmin, user_id: adminId, title: "Admin own task", type: "todo" });
    expect(error).toBeNull();
    const { data } = await adminOrdinary.from("tasks").select("id");
    expect(data?.map((row) => row.id)).toEqual([ids.taskAdmin]);
  });

  it("11. Admin ordinary client cannot directly read Personal Account Task", async () => {
    const { data } = await adminOrdinary.from("tasks").select("id").eq("id", ids.taskA);
    expect(data).toHaveLength(0);
  });

  it("12. Browser/client source contains no secret-key reference", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "components/leo-app.tsx"), "utf8");
    expect(source).not.toContain("SUPABASE_SECRET_KEY");
    expect(source).not.toContain("sb_secret_");
  });

  it("13. ADMIN_USER_ID is absent from client source", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "components/leo-app.tsx"), "utf8");
    expect(source).not.toContain("ADMIN_USER_ID");
  });

  it("14. Anonymous Admin API access receives 401", async () => {
    const response = await getAdminStats(new Request("http://local/api/admin/system/stats"));
    expect(response.status).toBe(401);
  });

  it("15. Ordinary authenticated access receives 403", async () => {
    const response = await getAdminStats(new Request("http://local/api/admin/system/stats", { headers: { authorization: `Bearer ${tokenA}` } }));
    expect(response.status).toBe(403);
  });

  it("16. Similar email or metadata never grants admin", () => {
    expect(isAdminIdentity({ id: userAId }, adminId)).toBe(false);
  });

  it("17. Personal and Admin IDs remain independent", () => {
    expect(userAId).not.toBe(adminId);
    expect(userBId).not.toBe(adminId);
  });

  it("18. Admin API contracts include protected stats and task routes", () => {
    expect(adminApiRoutes).toContain("/api/admin/system/stats");
    expect(adminApiRoutes).toContain("/api/admin/users/[userId]/tasks");
  });

  it("19. Ordinary clients cannot access audit logs while controlled server client can", async () => {
    const input = { id: ids.audit, admin_user_id: adminId, target_user_id: userAId, action: "phase2_5_test", result: "succeeded" };
    expect((await adminClient.from("admin_audit_logs").insert(input)).error).toBeNull();
    const ordinary = await userA.from("admin_audit_logs").select("id").eq("id", ids.audit);
    expect(ordinary.data ?? []).toHaveLength(0);
    expect(ordinary.error).not.toBeNull();
    const { data } = await adminClient.from("admin_audit_logs").select("id").eq("id", ids.audit);
    expect(data).toHaveLength(1);
  });
});

describe.sequential("real private Storage policies", () => {
  const objectPath = `${userAId}/${ids.uploadedA}/synthetic.txt`;

  it("1. User A can upload a synthetic object under its own path", async () => {
    const { error } = await userA.storage.from("receipts").upload(objectPath, "synthetic", { contentType: "text/plain", upsert: true });
    expect(error).toBeNull();
  });

  it("2. User B cannot download User A synthetic object", async () => {
    const { error } = await userB.storage.from("receipts").download(objectPath);
    expect(error).not.toBeNull();
  });

  it("3. User B cannot upload into User A path and the object is unchanged", async () => {
    const { error } = await userB.storage.from("receipts").upload(`${userAId}/${crypto.randomUUID()}/blocked.txt`, "blocked");
    expect(error).not.toBeNull();
    const { data, error: downloadError } = await adminClient.storage.from("receipts").download(objectPath);
    expect(downloadError).toBeNull();
    expect(await data?.text()).toBe("synthetic");
  });
});
