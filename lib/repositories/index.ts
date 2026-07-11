import type { FileRepository } from "./file-repository";
import type { FinanceRepository } from "./finance-repository";
import type { JournalRepository } from "./journal-repository";
import type { PlanRepository } from "./plan-repository";
import type { SettingsRepository } from "./settings-repository";
import type { TaskRepository } from "./task-repository";
import type { TimetableRepository } from "./timetable-repository";
import type { TodoRepository } from "./todo-repository";
import { sqliteFileRepository } from "./sqlite/sqlite-file-repository";
import { sqliteFinanceRepository } from "./sqlite/sqlite-finance-repository";
import { sqliteJournalRepository } from "./sqlite/sqlite-journal-repository";
import { sqlitePlanRepository } from "./sqlite/sqlite-plan-repository";
import { sqliteSettingsRepository } from "./sqlite/sqlite-settings-repository";
import { sqliteTaskRepository } from "./sqlite/sqlite-task-repository";
import { sqliteTimetableRepository } from "./sqlite/sqlite-timetable-repository";
import { sqliteTodoRepository } from "./sqlite/sqlite-todo-repository";
import { supabaseSettingsRepository } from "./supabase/supabase-settings-repository";
import { supabaseTaskRepository } from "./supabase/supabase-task-repository";
import { supabaseTodoRepository } from "./supabase/supabase-todo-repository";
import { supabaseJournalRepository } from "./supabase/supabase-journal-repository";
import { supabasePlanRepository } from "./supabase/supabase-plan-repository";
import { supabaseFinanceRepository } from "./supabase/supabase-finance-repository";
import { supabaseTimetableRepository } from "./supabase/supabase-timetable-repository";

function activeBackend(): "sqlite" | "supabase" {
  const backend = process.env.DATA_BACKEND || "sqlite";
  if (backend !== "sqlite" && backend !== "supabase") {
    throw new Error(`Unsupported DATA_BACKEND: ${backend}.`);
  }
  if (backend === "supabase" && process.env.AUTH_REQUIRED !== "true") throw new Error("DATA_BACKEND=supabase requires AUTH_REQUIRED=true");
  return backend;
}

function sqliteOnly<T>(repository: T): T {
  const backend = activeBackend();
  if (backend !== "sqlite") throw new Error("This module is not available in Supabase mode; local SQLite fallback is forbidden.");
  return repository;
}

export function getSettingsRepository(): SettingsRepository {
  return activeBackend() === "supabase" ? supabaseSettingsRepository : sqliteSettingsRepository;
}

export function getTaskRepository(): TaskRepository {
  return activeBackend() === "supabase" ? supabaseTaskRepository : sqliteTaskRepository;
}

export function getTodoRepository(): TodoRepository {
  return activeBackend() === "supabase" ? supabaseTodoRepository : sqliteTodoRepository;
}

export function getFinanceRepository(): FinanceRepository {
  return activeBackend() === "supabase" ? supabaseFinanceRepository : sqliteFinanceRepository;
}

export function getPlanRepository(): PlanRepository {
  return activeBackend() === "supabase" ? supabasePlanRepository : sqlitePlanRepository;
}

export function getJournalRepository(): JournalRepository {
  return activeBackend() === "supabase" ? supabaseJournalRepository : sqliteJournalRepository;
}

export function getTimetableRepository(): TimetableRepository {
  return activeBackend() === "supabase" ? supabaseTimetableRepository : sqliteTimetableRepository;
}

export function getFileRepository(): FileRepository {
  return sqliteOnly(sqliteFileRepository);
}
