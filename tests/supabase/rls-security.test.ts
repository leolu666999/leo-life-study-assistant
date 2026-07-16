import fs from "node:fs";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  AdminConfigurationError,
  AdminForbiddenError,
  AuthenticationRequiredError,
  assertAdminIdentity,
  isAdminIdentity,
  runAsAdminIdentity,
  validateAdminUserId
} from "@/lib/auth/admin-core";
import { adminApiRoutes } from "@/lib/admin/admin-api-contract";
import {
  ADMIN_USER,
  PERSONAL_ACCOUNT,
  USER_A,
  USER_B,
  asAnonymous,
  asAuthenticated,
  asServiceRole,
  businessTables,
  createPhase2Database,
  insertTask,
  resetPhase2Database,
  rowCount
} from "./pglite-harness";

const TASK_A = "10000000-0000-4000-8000-000000000001";
const TASK_ADMIN = "10000000-0000-4000-8000-000000000002";
const TODO_A = "20000000-0000-4000-8000-000000000001";
const FILE_A = "30000000-0000-4000-8000-000000000001";
const SOURCE_A = "40000000-0000-4000-8000-000000000001";
const COURSE_A = "50000000-0000-4000-8000-000000000001";

let database: PGlite;

async function affected(sql: string, params: unknown[] = []) {
  const result = await database.query(sql, params);
  return Number(result.affectedRows ?? 0);
}

async function expectRejected(sql: string, params: unknown[] = []) {
  await expect(database.query(sql, params)).rejects.toMatchObject({ code: expect.stringMatching(/^(42501|23503)$/) });
}

async function seedUserAPrivateData() {
  await insertTask(database, USER_A, TASK_A, "A task");
  await database.query(`insert into public.todo_lists (id, user_id, title, date) values ($1, $2, 'A todo', '2026-07-11')`, [TODO_A, USER_A]);
  await database.query(`insert into public.journal_entries (user_id, date, source, content) values ($1, '2026-07-11', 'manual', 'A journal')`, [USER_A]);
  await database.query(`insert into public.expenses (user_id, title, amount, currency, category, date) values ($1, 'A expense', 1, 'AUD', 'Other', '2026-07-11')`, [USER_A]);
  await database.query(`insert into public.uploaded_files (id, user_id, "originalName", "storedName", path, "mimeType", size) values ($1, $2, 'private.txt', 'stored.txt', './uploads/stored.txt', 'text/plain', 1)`, [FILE_A, USER_A]);
  await database.query(`insert into public.important_files (user_id, title, "fileId") values ($1, 'A file', $2)`, [USER_A, FILE_A]);
  await database.query(`insert into public.timetable_sources (id, user_id, type, name, semester, "academicYear") values ($1, $2, 'ics_file', 'A source', 'S2', 2026)`, [SOURCE_A, USER_A]);
  await database.query(`insert into public.timetable_courses (id, user_id, "courseCode", "courseName", "activityType", semester, "academicYear", "sourceId") values ($1, $2, 'INFO1110', 'Programming', 'Lecture', 'S2', 2026, $3)`, [COURSE_A, USER_A, SOURCE_A]);
  await database.query(`insert into public.course_occurrences (user_id, "courseId", "startAt", "endAt", "sourceId") values ($1, $2, '2026-07-20T09:00:00+10:00', '2026-07-20T10:00:00+10:00', $3)`, [USER_A, COURSE_A, SOURCE_A]);
}

function collectClientSources(directory: string): string[] {
  const sources: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "api" || entry.name.startsWith(".")) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) sources.push(...collectClientSources(target));
    else if (/\.[cm]?[jt]sx?$/.test(entry.name)) {
      const source = fs.readFileSync(target, "utf8");
      if (/^[\s;]*["']use client["'];?/m.test(source)) sources.push(source);
    }
  }
  return sources;
}

beforeAll(async () => {
  database = await createPhase2Database();
});

beforeEach(async () => {
  await resetPhase2Database(database);
});

afterAll(async () => {
  await database.close();
});

describe("PostgreSQL schema and policy contract", () => {
  it("creates all 22 private business tables with user_id", async () => {
    const result = await database.query<{ table_name: string }>(`
      select table_name from information_schema.columns
      where table_schema = 'public' and column_name = 'user_id' and table_name = any($1)
      order by table_name
    `, [businessTables]);
    expect(result.rows.map((row) => row.table_name)).toEqual([...businessTables].sort());
  });

  it("enables and forces RLS on all 22 business tables", async () => {
    const count = await rowCount(database, `select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = any($1) and c.relrowsecurity and c.relforcerowsecurity`, [businessTables]);
    expect(count).toBe(22);
  });

  it("creates exactly 88 business owner policies", async () => {
    expect(await rowCount(database, `select count(*) from pg_policies where schemaname = 'public' and tablename = any($1)`, [businessTables])).toBe(88);
  });

  it("creates four own-data profile policies and no client admin-audit policy", async () => {
    expect(await rowCount(database, `select count(*) from pg_policies where schemaname = 'public' and tablename = 'profiles'`)).toBe(4);
    expect(await rowCount(database, `select count(*) from pg_policies where schemaname = 'public' and tablename = 'admin_audit_logs'`)).toBe(0);
  });

  it("creates eight private Storage policies and private buckets", async () => {
    expect(await rowCount(database, `select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'`)).toBe(8);
    expect(await rowCount(database, `select count(*) from storage.buckets where id in ('receipts','important-files') and public = false`)).toBe(2);
  });

  it("allows a user to create an object only below its own Storage path", async () => {
    await asAuthenticated(database, USER_A);
    await database.query(`insert into storage.objects (bucket_id, name, owner_id) values ('receipts', $1, $2)`, [`${USER_A}/file-a/receipt.txt`, USER_A]);
    expect(await rowCount(database, `select count(*) from storage.objects`)).toBe(1);
    await expect(database.query(`insert into storage.objects (bucket_id, name, owner_id) values ('receipts', $1, $2)`, [`${USER_B}/file-b/receipt.txt`, USER_A])).rejects.toMatchObject({ code: "42501" });
  });

  it("prevents User B from reading User A Storage object", async () => {
    await asAuthenticated(database, USER_A);
    await database.query(`insert into storage.objects (bucket_id, name, owner_id) values ('important-files', $1, $2)`, [`${USER_A}/file-a/private.txt`, USER_A]);
    await asAuthenticated(database, USER_B);
    expect(await rowCount(database, `select count(*) from storage.objects`)).toBe(0);
  });

  it("creates independent default settings for every auth user", async () => {
    await asServiceRole(database);
    expect(await rowCount(database, `select count(*) from public.settings where user_id in ($1,$2,$3)`, [USER_A, USER_B, ADMIN_USER])).toBe(12);
  });

  it("creates all composite owner-parent foreign keys", async () => {
    expect(await rowCount(database, `
      select count(*) from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where c.contype = 'f' and n.nspname = 'public' and t.relname = any($1)
        and array_length(c.conkey, 1) = 2
    `, [businessTables])).toBe(20);
  });

  it("keeps profiles role-free and gives audit logs the required accountability fields", async () => {
    expect(await rowCount(database, `select count(*) from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='is_admin'`)).toBe(0);
    expect(await rowCount(database, `select count(*) from information_schema.columns where table_schema='public' and table_name='admin_audit_logs' and column_name in ('admin_user_id','target_user_id','action','entity_type','entity_id','metadata','result','created_at')`)).toBe(8);
  });
});

describe("ordinary user RLS isolation", () => {
  it("1. User A can create its own Task", async () => {
    await insertTask(database, USER_A, TASK_A);
    expect(await rowCount(database, `select count(*) from public.tasks where id = $1`, [TASK_A])).toBe(1);
  });

  it("2. User A can read its own Task", async () => {
    await insertTask(database, USER_A, TASK_A);
    expect(await rowCount(database, `select count(*) from public.tasks where user_id = $1`, [USER_A])).toBe(1);
  });

  it("3. User B cannot read User A Task", async () => {
    await insertTask(database, USER_A, TASK_A);
    await asAuthenticated(database, USER_B);
    expect(await rowCount(database, `select count(*) from public.tasks where id = $1`, [TASK_A])).toBe(0);
  });

  it("4. User B cannot update User A Task", async () => {
    await insertTask(database, USER_A, TASK_A);
    await asAuthenticated(database, USER_B);
    expect(await affected(`update public.tasks set title = 'hijacked' where id = $1`, [TASK_A])).toBe(0);
  });

  it("5. User B cannot delete User A Task", async () => {
    await insertTask(database, USER_A, TASK_A);
    await asAuthenticated(database, USER_B);
    expect(await affected(`delete from public.tasks where id = $1`, [TASK_A])).toBe(0);
  });

  it("6. User B cannot attach a Subtask to User A Task", async () => {
    await insertTask(database, USER_A, TASK_A);
    await asAuthenticated(database, USER_B);
    await expectRejected(`insert into public.subtasks (user_id, "taskId", title) values ($1,$2,'bad')`, [USER_B, TASK_A]);
  });

  it("7. User B cannot attach an item to User A TodoList", async () => {
    await asAuthenticated(database, USER_A);
    await database.query(`insert into public.todo_lists (id, user_id, title, date) values ($1,$2,'A','2026-07-11')`, [TODO_A, USER_A]);
    await asAuthenticated(database, USER_B);
    await expectRejected(`insert into public.todo_list_items (user_id, "todoListId", content) values ($1,$2,'bad')`, [USER_B, TODO_A]);
  });

  it("8. User B cannot read User A Journal", async () => {
    await seedUserAPrivateData();
    await asAuthenticated(database, USER_B);
    expect(await rowCount(database, `select count(*) from public.journal_entries where user_id = $1`, [USER_A])).toBe(0);
  });

  it("9. User B cannot read User A Expenses", async () => {
    await seedUserAPrivateData();
    await asAuthenticated(database, USER_B);
    expect(await rowCount(database, `select count(*) from public.expenses where user_id = $1`, [USER_A])).toBe(0);
  });

  it("10. User B cannot read User A Important File metadata", async () => {
    await seedUserAPrivateData();
    await asAuthenticated(database, USER_B);
    expect(await rowCount(database, `select count(*) from public.important_files where user_id = $1`, [USER_A])).toBe(0);
  });

  it("11. User B cannot read User A Timetable", async () => {
    await seedUserAPrivateData();
    await asAuthenticated(database, USER_B);
    expect(await rowCount(database, `select count(*) from public.course_occurrences where user_id = $1`, [USER_A])).toBe(0);
  });

  it("12. User B cannot read User A Settings", async () => {
    await asAuthenticated(database, USER_B);
    expect(await rowCount(database, `select count(*) from public.settings where user_id = $1`, [USER_A])).toBe(0);
    expect(await rowCount(database, `select count(*) from public.settings`)).toBe(4);
  });

  it("13. Guessing User A UUID still returns no Task", async () => {
    await insertTask(database, USER_A, TASK_A);
    await asAuthenticated(database, USER_B);
    expect(await rowCount(database, `select count(*) from public.tasks where id = '${TASK_A}'`)).toBe(0);
  });

  it("14. Anonymous role cannot access a private table", async () => {
    await asAnonymous(database);
    await expect(database.query(`select * from public.tasks`)).rejects.toMatchObject({ code: "42501" });
  });

  it("15. User B cannot read or modify User A secure document", async () => {
    await asAuthenticated(database, USER_A);
    const created = await database.query<{ id: string }>(`insert into public.secure_documents (user_id, title, content) values ($1, 'A private note', 'secret') returning id`, [USER_A]);
    const id = created.rows[0]?.id;
    await asAuthenticated(database, USER_B);
    expect(await rowCount(database, `select count(*) from public.secure_documents where id = $1`, [id])).toBe(0);
    expect(await affected(`update public.secure_documents set content = 'hijacked' where id = $1`, [id])).toBe(0);
    expect(await affected(`delete from public.secure_documents where id = $1`, [id])).toBe(0);
    await asServiceRole(database);
    const content = await database.query<{ content: string }>(`select content from public.secure_documents where id = $1`, [id]);
    expect(content.rows[0]?.content).toBe("secret");
  });
});

describe("independent administrator security", () => {
  it("1. Personal Account is not admin", () => {
    expect(isAdminIdentity({ id: PERSONAL_ACCOUNT }, ADMIN_USER)).toBe(false);
  });

  it("2. User A receives 403 from admin assertion", () => {
    expect(() => assertAdminIdentity({ id: USER_A }, ADMIN_USER)).toThrow(AdminForbiddenError);
  });

  it("3. User B receives 403 from admin assertion", () => {
    expect(() => assertAdminIdentity({ id: USER_B }, ADMIN_USER)).toThrow(AdminForbiddenError);
  });

  it("4. Admin User passes admin assertion", () => {
    expect(assertAdminIdentity({ id: ADMIN_USER }, ADMIN_USER)).toEqual({ adminUserId: ADMIN_USER });
  });

  it("5. Admin controlled server flow can query User A", async () => {
    await runAsAdminIdentity({ id: ADMIN_USER }, ADMIN_USER, async () => {
      await asServiceRole(database);
      expect(await rowCount(database, `select count(*) from auth.users where id = $1`, [USER_A])).toBe(1);
    });
  });

  it("6. Admin controlled server flow can query User B", async () => {
    await runAsAdminIdentity({ id: ADMIN_USER }, ADMIN_USER, async () => {
      await asServiceRole(database);
      expect(await rowCount(database, `select count(*) from auth.users where id = $1`, [USER_B])).toBe(1);
    });
  });

  it("7. Admin controlled server flow can read User A Task", async () => {
    await insertTask(database, USER_A, TASK_A);
    await runAsAdminIdentity({ id: ADMIN_USER }, ADMIN_USER, async () => {
      await asServiceRole(database);
      expect(await rowCount(database, `select count(*) from public.tasks where user_id = $1`, [USER_A])).toBe(1);
    });
  });

  it("8. Admin controlled server flow can read User B Journal", async () => {
    await asAuthenticated(database, USER_B);
    await database.query(`insert into public.journal_entries (user_id,date,source,content) values ($1,'2026-07-11','manual','B')`, [USER_B]);
    await runAsAdminIdentity({ id: ADMIN_USER }, ADMIN_USER, async () => {
      await asServiceRole(database);
      expect(await rowCount(database, `select count(*) from public.journal_entries where user_id = $1`, [USER_B])).toBe(1);
    });
  });

  it("9. Admin controlled server flow can produce cross-user stats", async () => {
    await insertTask(database, USER_A, TASK_A);
    await insertTask(database, ADMIN_USER, TASK_ADMIN);
    await runAsAdminIdentity({ id: ADMIN_USER }, ADMIN_USER, async () => {
      await asServiceRole(database);
      expect(await rowCount(database, `select count(*) from auth.users`)).toBe(3);
      expect(await rowCount(database, `select count(*) from public.tasks`)).toBe(2);
    });
  });

  it("10. Admin User ordinary API role only sees its own business data", async () => {
    await insertTask(database, USER_A, TASK_A);
    await insertTask(database, ADMIN_USER, TASK_ADMIN);
    await asAuthenticated(database, ADMIN_USER);
    expect(await rowCount(database, `select count(*) from public.tasks`)).toBe(1);
    expect(await rowCount(database, `select count(*) from public.tasks where id = $1`, [TASK_A])).toBe(0);
  });

  it("11. Admin cross-user access requires the controlled high-privilege flow", async () => {
    await insertTask(database, USER_A, TASK_A);
    await asAuthenticated(database, ADMIN_USER);
    expect(await rowCount(database, `select count(*) from public.tasks where user_id = $1`, [USER_A])).toBe(0);
  });

  it("12. Client source contains no service-role key access", () => {
    const source = [...collectClientSources(path.join(process.cwd(), "app")), ...collectClientSources(path.join(process.cwd(), "components"))].join("\n");
    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(source).not.toContain("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY");
  });

  it("13. ADMIN_USER_ID is server-only and absent from client source", () => {
    const clientSource = fs.readFileSync(path.join(process.cwd(), "components/leo-app.tsx"), "utf8");
    expect(clientSource).not.toContain("ADMIN_USER_ID");
    expect(clientSource).not.toContain("NEXT_PUBLIC_ADMIN");
    expect(fs.readFileSync(path.join(process.cwd(), "lib/auth/admin.ts"), "utf8")).toContain('import "server-only"');
  });

  it("14. Anonymous admin access receives 401 semantics", () => {
    expect(() => assertAdminIdentity(null, ADMIN_USER)).toThrow(AuthenticationRequiredError);
  });

  it("15. Ordinary login receives 403 semantics and cannot self-promote", () => {
    const untrusted = { id: USER_A, isAdmin: true, email: "admin@example.test" };
    expect(() => assertAdminIdentity(untrusted, ADMIN_USER)).toThrow(AdminForbiddenError);
  });

  it("requires a valid UUID configuration and never authorizes by email", () => {
    expect(() => validateAdminUserId("admin@example.test")).toThrow(AdminConfigurationError);
    expect(isAdminIdentity({ id: USER_A }, ADMIN_USER)).toBe(false);
  });

  it("keeps Personal and Admin account IDs and data spaces independent", async () => {
    expect(PERSONAL_ACCOUNT).not.toBe(ADMIN_USER);
    await insertTask(database, PERSONAL_ACCOUNT, TASK_A);
    await insertTask(database, ADMIN_USER, TASK_ADMIN);
    await asAuthenticated(database, PERSONAL_ACCOUNT);
    expect(await rowCount(database, `select count(*) from public.tasks`)).toBe(1);
    await asAuthenticated(database, ADMIN_USER);
    expect(await rowCount(database, `select count(*) from public.tasks`)).toBe(1);
  });

  it("defines Admin API contracts and exposes only protected admin route groups", () => {
    expect(adminApiRoutes).toHaveLength(13);
    expect(adminApiRoutes.every((route) => route.startsWith("/api/admin/"))).toBe(true);
    const routes = fs.readdirSync(path.join(process.cwd(), "app/api/admin"));
    expect(routes.sort()).toEqual(["messages", "system", "users"]);
    expect(fs.readFileSync(path.join(process.cwd(), "app/api/admin/system/stats/route.ts"), "utf8")).toContain("assertAdminRequest");
    expect(fs.readFileSync(path.join(process.cwd(), "app/api/admin/users/[userId]/tasks/route.ts"), "utf8")).toContain("assertAdminRequest");
  });

  it("allows only the controlled high-privilege flow to write admin audit logs", async () => {
    await asAuthenticated(database, USER_A);
    await expect(database.query(`insert into public.admin_audit_logs (admin_user_id, target_user_id, action) values ($1,$2,'forbidden')`, [USER_A, USER_B])).rejects.toMatchObject({ code: "42501" });
    await runAsAdminIdentity({ id: ADMIN_USER }, ADMIN_USER, async () => {
      await asServiceRole(database);
      await database.query(`insert into public.admin_audit_logs (admin_user_id, target_user_id, action, result) values ($1,$2,'inspect_user','succeeded')`, [ADMIN_USER, USER_A]);
      expect(await rowCount(database, `select count(*) from public.admin_audit_logs where admin_user_id = $1 and target_user_id = $2`, [ADMIN_USER, USER_A])).toBe(1);
    });
  });
});
