import type { Expense } from "@/lib/types";
import type { RepositoryContext } from "./repository-context";

export type ExpenseInput = Partial<Omit<Expense, "amount">> & { amount?: number | string | null };

export interface FinanceRepository {
  listExpenses(context?: RepositoryContext): Expense[];
  createExpense(input: ExpenseInput, context?: RepositoryContext): Expense;
  updateExpense(id: string, input: ExpenseInput, context?: RepositoryContext): Expense | null;
  deleteExpense(id: string, context?: RepositoryContext): number;
}
