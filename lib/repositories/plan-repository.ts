import type { Plan } from "@/lib/types";
import type { RepositoryContext } from "./repository-context";

export type PlanInput = Partial<Plan> & {
  taskIds?: string[];
  itemTitles?: string[];
  itemDrafts?: Array<{ title?: string; completed?: boolean }>;
};

export interface PlanRepository {
  listPlans(context?: RepositoryContext): Plan[];
  createPlan(input: PlanInput, context?: RepositoryContext): Plan;
  updatePlan(id: string, input: PlanInput, context?: RepositoryContext): Plan | null;
  deletePlan(id: string, context?: RepositoryContext): number;
}
