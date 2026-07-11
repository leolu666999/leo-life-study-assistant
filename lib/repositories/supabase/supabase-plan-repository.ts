import { randomUUID } from "node:crypto";
import type { Plan, Task } from "@/lib/types";
import type { PlanInput, PlanRepository } from "../plan-repository";
import type { RepositoryContext } from "../repository-context";
import { requireSupabaseContext } from "../request-context";
import { supabaseTaskRepository } from "./supabase-task-repository";

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

async function getPlan(id: string, context?: RepositoryContext) {
  const { client, userId } = requireSupabaseContext(context);
  const [{ data: row, error }, { data: links, error: linkError }] = await Promise.all([
    client.from("plans").select("*").eq("user_id", userId).eq("id", id).maybeSingle(),
    client.from("plan_items").select("taskId,sortOrder").eq("user_id", userId).eq("planId", id).order("sortOrder")
  ]);
  if (error) throw error;
  if (linkError) throw linkError;
  if (!row) return null;
  const items = (await Promise.all((links ?? []).map((link) => supabaseTaskRepository.getTask(String(link.taskId), context))))
    .filter(Boolean) as Task[];
  return {
    id: String(row.id), title: String(row.title), type: row.type as Plan["type"], startDate: String(row.startDate),
    endDate: String(row.endDate), reflectionNote: row.reflectionNote ? String(row.reflectionNote) : null,
    createdAt: String(row.createdAt), updatedAt: String(row.updatedAt), items
  } satisfies Plan;
}

async function syncPlanItems(planId: string, input: PlanInput, plan: Pick<Plan, "title" | "type" | "startDate" | "endDate">, context?: RepositoryContext) {
  const { client, userId } = requireSupabaseContext(context);
  const existingTaskIds = input.taskIds ?? [];
  for (const taskId of existingTaskIds) {
    if (!await supabaseTaskRepository.getTask(taskId, context)) throw new Error("Plan task does not belong to the current user");
  }
  const drafts = input.itemDrafts ?? (input.itemTitles ?? []).map((title) => ({ title, completed: false }));
  const newTaskIds: string[] = [];
  for (const draft of drafts.map((item) => ({ title: String(item.title ?? "").trim(), completed: Boolean(item.completed) })).filter((item) => item.title)) {
    const completedAt = draft.completed ? new Date().toISOString() : null;
    const task = await supabaseTaskRepository.createTask({ title: draft.title, type: "plan_item",
      status: draft.completed ? "completed" : "not_started", priority: "medium",
      tags: [plan.type === "daily" ? "To Do List" : plan.title], startDate: plan.startDate,
      dueDate: plan.type === "daily" ? plan.endDate : null, completedAt, archivedAt: completedAt, parentPlanId: planId }, context);
    newTaskIds.push(task.id);
  }
  const deleted = await client.from("plan_items").delete().eq("user_id", userId).eq("planId", planId);
  if (deleted.error) throw deleted.error;
  const taskIds = [...existingTaskIds, ...newTaskIds];
  if (taskIds.length > 0) {
    const inserted = await client.from("plan_items").insert(taskIds.map((taskId, sortOrder) => ({ user_id: userId, planId, taskId, sortOrder })));
    if (inserted.error) throw inserted.error;
  }
}

async function syncReflection(plan: Plan, context?: RepositoryContext) {
  if (plan.type !== "daily") return;
  const { client, userId } = requireSupabaseContext(context);
  const deleted = await client.from("journal_entries").delete().eq("user_id", userId).eq("source", "daily_plan").eq("linkedPlanId", plan.id);
  if (deleted.error) throw deleted.error;
  const content = String(plan.reflectionNote ?? "").trim();
  if (!content) return;
  const inserted = await client.from("journal_entries").insert({ id: randomUUID(), user_id: userId, date: plan.startDate,
    source: "daily_plan", content, linkedPlanId: plan.id });
  if (inserted.error) throw inserted.error;
}

export const supabasePlanRepository: PlanRepository = {
  async listPlans(context) {
    const { client, userId } = requireSupabaseContext(context);
    const { data, error } = await client.from("plans").select("id").eq("user_id", userId).order("startDate", { ascending: false });
    if (error) throw error;
    return (await Promise.all((data ?? []).map((row) => getPlan(String(row.id), context)))).filter(Boolean) as Plan[];
  },
  async createPlan(input, context) {
    const { client, userId } = requireSupabaseContext(context);
    const id = randomUUID();
    const startDate = input.startDate ?? today();
    const endDate = input.endDate ?? startDate;
    const inserted = await client.from("plans").insert({ id, user_id: userId, title: input.title ?? "新计划", type: input.type ?? "daily",
      startDate, endDate, reflectionNote: input.reflectionNote ?? null });
    if (inserted.error) throw inserted.error;
    const plan = { id, title: input.title ?? "新计划", type: input.type ?? "daily", startDate, endDate } as const;
    await syncPlanItems(id, input, plan, context);
    const result = (await getPlan(id, context))!;
    await syncReflection(result, context);
    return result;
  },
  async updatePlan(id, input, context) {
    const { client, userId } = requireSupabaseContext(context);
    const current = await getPlan(id, context);
    if (!current) return null;
    const next = { ...current, ...input };
    const { data, error } = await client.from("plans").update({ title: next.title, type: next.type, startDate: next.startDate,
      endDate: next.endDate, reflectionNote: next.reflectionNote ?? null }).eq("user_id", userId).eq("id", id).select("id");
    if (error) throw error;
    if (!data?.length) return null;
    if (input.taskIds || input.itemTitles || input.itemDrafts) await syncPlanItems(id, input, next, context);
    const result = (await getPlan(id, context))!;
    await syncReflection(result, context);
    return result;
  },
  async deletePlan(id, context) {
    const { client, userId } = requireSupabaseContext(context);
    const journalDelete = await client.from("journal_entries").delete().eq("user_id", userId).eq("linkedPlanId", id);
    if (journalDelete.error) throw journalDelete.error;
    const { data, error } = await client.from("plans").delete().eq("user_id", userId).eq("id", id).select("id");
    if (error) throw error;
    return data?.length ?? 0;
  }
};
