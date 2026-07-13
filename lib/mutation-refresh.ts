export type MutationRefreshScope =
  | "expenses"
  | "tasks"
  | "todo"
  | "plans"
  | "journal"
  | "files"
  | "timetable"
  | "settings"
  | "none"
  | "all";

export function mutationRefreshScope(url: string): MutationRefreshScope {
  const path = url.split("?", 1)[0];

  if (path.startsWith("/api/expenses")) return "expenses";
  if (path.startsWith("/api/tasks") || path.startsWith("/api/subtasks") || path.startsWith("/api/progress")) return "tasks";
  if (path.startsWith("/api/todo-lists") || path.startsWith("/api/todo-list-items")) return "todo";
  if (path.startsWith("/api/plans")) return "plans";
  if (path.startsWith("/api/journal")) return "journal";
  if (path.startsWith("/api/important-files")) return "files";
  if (path === "/api/upload" || path.startsWith("/api/private-files") || path.startsWith("/api/uploads")) return "none";
  if (path.startsWith("/api/timetable") || path.startsWith("/api/courses")) return "timetable";
  if (path.startsWith("/api/settings")) return "settings";
  return "all";
}
