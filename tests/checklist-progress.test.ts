import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { deriveChecklistProgress } from "@/lib/checklist-progress";
import { normalizeChecklistTaskProgress } from "@/lib/services/task-service";

describe("checklist progress", () => {
  it("uses valid checklist rows as the automatic target", () => {
    expect(deriveChecklistProgress([
      { title: "A", completed: true },
      { title: "B", completed: false },
      { title: "C", completed: false },
      { title: "D", completed: true },
      { title: "E", completed: false }
    ])).toEqual({ current: 2, target: 5, unit: "项" });
  });

  it("ignores empty draft rows", () => {
    expect(deriveChecklistProgress([
      { title: "有效条目", completed: false },
      { title: "   ", completed: true }
    ])).toEqual({ current: 0, target: 1, unit: "项" });
  });

  it("normalizes direct API checklist writes before either repository saves them", () => {
    expect(normalizeChecklistTaskProgress({
      type: "checklist",
      progressEnabled: true,
      progressType: "count",
      progressCurrent: 99,
      progressTarget: 99,
      progressUnit: "wrong",
      subtasks: [
        { title: "A", completed: true },
        { title: "B", completed: false },
        { title: "", completed: true }
      ]
    })).toMatchObject({ progressCurrent: 1, progressTarget: 2, progressUnit: "项" });
  });

  it("keeps the task editor on one unified type, count and reminder row", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "components/leo-app.tsx"), "utf8");
    expect(source).toContain("grid-cols-[minmax(0,0.9fr)_minmax(0,1.35fr)_minmax(0,1fr)]");
    expect(source).toContain('["todo", "待办"]');
    expect(source).toContain('["counter", "计数"]');
    expect(source).toContain('["checklist", "清单"]');
    expect(source).toContain('aria-label="当前值"');
    expect(source).toContain('aria-label="目标值"');
    expect(source).not.toContain("setProgressType");
    expect(source).not.toContain("progressUnitValue");
  });
});
