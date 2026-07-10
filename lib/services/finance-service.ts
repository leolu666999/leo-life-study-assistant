import { getFinanceRepository } from "@/lib/repositories";
import type { ExpenseInput } from "@/lib/repositories/finance-repository";
import type { RepositoryContext } from "@/lib/repositories/repository-context";

export class FinanceService {
  constructor(private readonly repository = getFinanceRepository()) {}

  listExpenses(context?: RepositoryContext) {
    return this.repository.listExpenses(context);
  }

  createExpense(input: ExpenseInput, context?: RepositoryContext) {
    return this.repository.createExpense(input, context);
  }

  updateExpense(id: string, input: ExpenseInput, context?: RepositoryContext) {
    return this.repository.updateExpense(id, input, context);
  }

  deleteExpense(id: string, context?: RepositoryContext) {
    return this.repository.deleteExpense(id, context);
  }
}

export function getFinanceService() {
  return new FinanceService();
}
