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

function planItemDrafts(input: PlanInput) {
  const drafts = input.itemDrafts ?? (input.itemTitles ?? []).map((title) => ({ title, completed: false }));
  return drafts.map((item) => ({ id: randomUUID(), title: String(item.title ?? "").trim(), completed: Boolean(item.completed) }))
    .filter((item) => item.title);
}

export const supabasePlanRepository: PlanRepository = {
  async listPlans(context) {
    const { client, userId } = requireSupabaseContext(context);
    const { data, error } = await client.from("plans").select("id").eq("user_id", userId).order("startDate", { ascending: false });
    if (error) throw error;
    return (await Promise.all((data ?? []).map((row) => getPlan(String(row.id), context)))).filter(Boolean) as Plan[];
  },
  async createPlan(input, context) {
    const { client } = requireSupabaseContext(context);
    const id = randomUUID();
    const startDate = input.startDate ?? today();
    const endDate = input.endDate ?? startDate;
    const { error } = await client.rpc("save_plan_with_relations", { p_plan_id: id, p_create: true,
      p_plan: { title: input.title ?? "新计划", type: input.type ?? "daily", startDate, endDate,
        reflectionNote: input.reflectionNote ?? null }, p_task_ids: input.taskIds ?? [],
      p_item_drafts: planItemDrafts(input), p_replace_items: true });
    if (error) throw error;
    return (await getPlan(id, context))!;
  },
  async updatePlan(id, input, context) {
    const { client } = requireSupabaseContext(context);
    const current = await getPlan(id, context);
    if (!current) return null;
    const next = { ...current, ...input };
    const replaceItems = Boolean(input.taskIds || input.itemTitles || input.itemDrafts);
    const { error } = await client.rpc("save_plan_with_relations", { p_plan_id: id, p_create: false,
      p_plan: { title: next.title, type: next.type, startDate: next.startDate, endDate: next.endDate,
        reflectionNote: next.reflectionNote ?? null }, p_task_ids: replaceItems ? input.taskIds ?? [] : current.items.map((item) => item.id),
      p_item_drafts: replaceItems ? planItemDrafts(input) : [], p_replace_items: replaceItems });
    if (error) throw error;
    return getPlan(id, context);
  },
  async deletePlan(id, context) {
    const { client } = requireSupabaseContext(context);
    const { data, error } = await client.rpc("delete_plan_with_journal", { p_plan_id: id });
    if (error) throw error;
    return data ? 1 : 0;
  }
};
