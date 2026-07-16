import { describe, expect, it } from "vitest";
import { mutationRefreshScope } from "@/lib/mutation-refresh";

describe("mutation refresh scope", () => {
  it("keeps expense changes inside finance state", () => {
    expect(mutationRefreshScope("/api/expenses")).toBe("expenses");
    expect(mutationRefreshScope("/api/expenses/expense-id")).toBe("expenses");
  });

  it("does not reload the application after a raw upload", () => {
    expect(mutationRefreshScope("/api/upload")).toBe("none");
  });

  it("maps related task endpoints to one targeted scope", () => {
    expect(mutationRefreshScope("/api/tasks/task-id/complete")).toBe("tasks");
    expect(mutationRefreshScope("/api/subtasks/subtask-id")).toBe("tasks");
    expect(mutationRefreshScope("/api/progress/progress-id")).toBe("tasks");
  });

  it("keeps every common editor inside its own data scope", () => {
    expect(mutationRefreshScope("/api/todo-lists/list-id")).toBe("todo");
    expect(mutationRefreshScope("/api/todo-list-items/item-id")).toBe("todo");
    expect(mutationRefreshScope("/api/plans/plan-id")).toBe("plans");
    expect(mutationRefreshScope("/api/journal")).toBe("journal");
    expect(mutationRefreshScope("/api/important-files/file-id")).toBe("files");
    expect(mutationRefreshScope("/api/secure-documents/document-id")).toBe("files");
    expect(mutationRefreshScope("/api/timetable/occurrences/occurrence-id")).toBe("timetable");
    expect(mutationRefreshScope("/api/settings")).toBe("settings");
  });
});
