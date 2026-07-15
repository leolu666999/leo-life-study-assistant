import { describe, expect, it } from "vitest";
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
});
