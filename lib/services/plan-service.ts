import { getPlanRepository } from "@/lib/repositories";
import type { PlanInput } from "@/lib/repositories/plan-repository";
import type { RepositoryContext } from "@/lib/repositories/repository-context";

export class PlanService {
  constructor(private readonly repository = getPlanRepository()) {}

  listPlans(context?: RepositoryContext) {
    return this.repository.listPlans(context);
  }

  createPlan(input: PlanInput, context?: RepositoryContext) {
    return this.repository.createPlan(input, context);
  }

  updatePlan(id: string, input: PlanInput, context?: RepositoryContext) {
    return this.repository.updatePlan(id, input, context);
  }

  deletePlan(id: string, context?: RepositoryContext) {
    return this.repository.deletePlan(id, context);
  }
}

export function getPlanService() {
  return new PlanService();
}
