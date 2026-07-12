import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

export const USER_A = "11111111-1111-4111-8111-111111111111";
export const USER_B = "22222222-2222-4222-8222-222222222222";
export const ADMIN_USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const PERSONAL_ACCOUNT = USER_A;

const businessTables = [
  "tasks", "subtasks", "tags", "task_tags", "plans", "plan_items", "todo_lists", "todo_list_items",
  "progress_items", "task_progress_entries", "courses", "class_sessions", "assignments", "timetable_sources",
  "timetable_courses", "course_occurrences", "journal_entries", "expenses", "uploaded_files", "important_files", "settings"
];

export async function createPhase2Database() {
  const database = new PGlite();
  await database.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (
      id uuid primary key,
      email text,
      created_at timestamptz not null default now(),
      last_sign_in_at timestamptz,
      banned_until timestamptz
    );
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant select on auth.users to service_role;

    create schema storage;
    create table storage.buckets (
      id text primary key,
      name text not null,
      public boolean not null default false,
      file_size_limit bigint,
      allowed_mime_types text[]
    );
    create table storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text not null references storage.buckets(id),
      name text not null,
      owner_id uuid
    );
    alter table storage.objects enable row level security;
    grant select, insert, update, delete on storage.objects to authenticated;
    grant all on storage.objects to service_role;
    grant usage on schema public, storage to anon, authenticated, service_role;
  `);
  for (const migration of [
    "supabase/migrations/202607110001_phase2_schema_rls.sql",
    "supabase/migrations/202607110002_private_storage_policies.sql",
    "supabase/migrations/202607120004_phase6_storage_lifecycle.sql",
    "supabase/migrations/202607120005_phase6_pending_delete_retry.sql"
  ]) {
    await database.exec(fs.readFileSync(path.join(process.cwd(), migration), "utf8"));
  }
  return database;
}

export async function resetPhase2Database(database: PGlite) {
  await database.exec("reset role;");
  await database.query("select set_config('request.jwt.claim.sub', '', false)");
  await database.exec("truncate table auth.users cascade;");
  await database.query(
    "insert into auth.users (id, email) values ($1, $2), ($3, $4), ($5, $6)",
    [USER_A, "personal@example.test", USER_B, "user-b@example.test", ADMIN_USER, "admin@example.test"]
  );
}

export async function asAuthenticated(database: PGlite, userId: string) {
  await database.exec("reset role;");
  await database.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  await database.exec("set role authenticated;");
}

export async function asAnonymous(database: PGlite) {
  await database.exec("reset role;");
  await database.query("select set_config('request.jwt.claim.sub', '', false)");
  await database.exec("set role anon;");
}

export async function asServiceRole(database: PGlite) {
  await database.exec("reset role;");
  await database.query("select set_config('request.jwt.claim.sub', '', false)");
  await database.exec("set role service_role;");
}

export async function rowCount(database: PGlite, sql: string, params: unknown[] = []) {
  const result = await database.query<{ count: number }>(sql, params);
  return Number(result.rows[0]?.count ?? 0);
}

export async function insertTask(database: PGlite, userId: string, id: string, title = "Task") {
  await asAuthenticated(database, userId);
  await database.query(
    `insert into public.tasks (id, user_id, title, type) values ($1, $2, $3, 'todo')`,
    [id, userId, title]
  );
}

export { businessTables };
