import { createPlan, deletePlan, listPlans, updatePlan } from "@/lib/db";
import type { PlanRepository } from "../plan-repository";

export const sqlitePlanRepository: PlanRepository = {
  listPlans,
  createPlan,
  updatePlan,
  deletePlan
};
