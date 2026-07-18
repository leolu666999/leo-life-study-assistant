import { describe, expect, it } from "vitest";
import { matchesPlanSearch, matchesTodoListSearch } from "@/lib/plan-search";
import type { Plan, TodoList } from "@/lib/types";

const todoList: TodoList = {
  id: "todo-list-1",
  title: "2026年7月19日 To Do List",
  date: "2026-07-19",
  notes: "出发前再检查一次",
  createdAt: "2026-07-19T00:00:00.000Z",
  updatedAt: "2026-07-19T00:00:00.000Z",
  items: [
    {
      id: "todo-item-1",
      todoListId: "todo-list-1",
      content: "购买域名",
      completed: false,
      order: 0,
      createdAt: "2026-07-19T00:00:00.000Z",
      updatedAt: "2026-07-19T00:00:00.000Z"
    }
  ]
};

const weeklyPlan: Plan = {
  id: "plan-1",
  title: "抵澳第一周",
  type: "weekly",
  startDate: "2026-07-19",
  endDate: "2026-07-25",
  reflectionNote: "熟悉校园",
  createdAt: "2026-07-19T00:00:00.000Z",
  updatedAt: "2026-07-19T00:00:00.000Z"
};

describe("plan search", () => {
  it.each(["7月19日", "7.19", "2026.7.19", "2026/7/19", "2026-07-19"])(
    "matches a Daily To Do List by date alias %s",
    (query) => expect(matchesTodoListSearch(todoList, query)).toBe(true)
  );

  it("matches Daily content and notes without exposing unrelated lists", () => {
    expect(matchesTodoListSearch(todoList, "购买域名")).toBe(true);
    expect(matchesTodoListSearch(todoList, "检查一次")).toBe(true);
    expect(matchesTodoListSearch(todoList, "不存在的事项")).toBe(false);
  });

  it("matches weekly and monthly plans by content or date", () => {
    expect(matchesPlanSearch(weeklyPlan, "抵澳")).toBe(true);
    expect(matchesPlanSearch(weeklyPlan, "7.25")).toBe(true);
    expect(matchesPlanSearch(weeklyPlan, "8月1日")).toBe(false);
  });
});
