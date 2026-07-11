import type { Plan } from "@/lib/types";
import type { RepositoryContext, RepositoryResult } from "./repository-context";

export type PlanInput = Partial<Plan> & {
  taskIds?: string[];
  itemTitles?: string[];
  itemDrafts?: Array<{ title?: string; completed?: boolean }>;
};

export interface PlanRepository {
  listPlans(context?: RepositoryContext): RepositoryResult<Plan[]>;
  createPlan(input: PlanInput, context?: RepositoryContext): RepositoryResult<Plan>;
  updatePlan(id: string, input: PlanInput, context?: RepositoryContext): RepositoryResult<Plan | null>;
  deletePlan(id: string, context?: RepositoryContext): RepositoryResult<number>;
}
