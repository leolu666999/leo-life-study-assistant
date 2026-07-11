import type { Expense } from "@/lib/types";
import type { RepositoryContext, RepositoryResult } from "./repository-context";

export type ExpenseInput = Partial<Omit<Expense, "amount">> & { amount?: number | string | null };

export interface FinanceRepository {
  listExpenses(context?: RepositoryContext): RepositoryResult<Expense[]>;
  createExpense(input: ExpenseInput, context?: RepositoryContext): RepositoryResult<Expense>;
  updateExpense(id: string, input: ExpenseInput, context?: RepositoryContext): RepositoryResult<Expense | null>;
  deleteExpense(id: string, context?: RepositoryContext): RepositoryResult<number>;
}
