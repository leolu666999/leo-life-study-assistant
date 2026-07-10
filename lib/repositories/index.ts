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

function activeBackend() {
  const backend = process.env.DATA_BACKEND || "sqlite";
  if (backend !== "sqlite") {
    throw new Error(`Unsupported DATA_BACKEND: ${backend}. This build only provides the SQLite repository.`);
  }
  return backend;
}

function sqliteOnly<T>(repository: T): T {
  activeBackend();
  return repository;
}

export function getSettingsRepository(): SettingsRepository {
  return sqliteOnly(sqliteSettingsRepository);
}

export function getTaskRepository(): TaskRepository {
  return sqliteOnly(sqliteTaskRepository);
}

export function getTodoRepository(): TodoRepository {
  return sqliteOnly(sqliteTodoRepository);
}

export function getFinanceRepository(): FinanceRepository {
  return sqliteOnly(sqliteFinanceRepository);
}

export function getPlanRepository(): PlanRepository {
  return sqliteOnly(sqlitePlanRepository);
}

export function getJournalRepository(): JournalRepository {
  return sqliteOnly(sqliteJournalRepository);
}

export function getTimetableRepository(): TimetableRepository {
  return sqliteOnly(sqliteTimetableRepository);
}

export function getFileRepository(): FileRepository {
  return sqliteOnly(sqliteFileRepository);
}
