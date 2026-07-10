import { createExpense, deleteExpense, listExpenses, updateExpense } from "@/lib/db";
import type { FinanceRepository } from "../finance-repository";

export const sqliteFinanceRepository: FinanceRepository = {
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense
};
