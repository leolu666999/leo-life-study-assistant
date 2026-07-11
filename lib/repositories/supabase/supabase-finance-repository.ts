import { randomUUID } from "node:crypto";
import { isSupportedCurrencyCode } from "@/lib/currencies";
import type { Expense } from "@/lib/types";
import type { ExpenseInput, FinanceRepository } from "../finance-repository";
import type { RepositoryContext } from "../repository-context";
import { requireSupabaseContext } from "../request-context";
import { supabaseSettingsRepository } from "./supabase-settings-repository";

type Row = Record<string, unknown>;
type Receipt = { originalName: string; mimeType: string };

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function mapExpense(row: Row, receipt?: Receipt): Expense {
  return {
    id: String(row.id), type: row.type === "income" ? "income" : "expense", title: String(row.title), amount: Number(row.amount),
    currency: String(row.currency) as Expense["currency"], category: String(row.category), date: String(row.date),
    merchant: row.merchant ? String(row.merchant) : null, paymentMethod: row.paymentMethod ? String(row.paymentMethod) : null,
    notes: row.notes ? String(row.notes) : null, receiptFileId: row.receiptFileId ? String(row.receiptFileId) : null,
    receiptOriginalName: receipt?.originalName ?? null, receiptMimeType: receipt?.mimeType ?? null,
    createdAt: String(row.createdAt), updatedAt: String(row.updatedAt)
  };
}

async function receiptMap(rows: Row[], context?: RepositoryContext) {
  const { client, userId } = requireSupabaseContext(context);
  const ids = [...new Set(rows.map((row) => row.receiptFileId ? String(row.receiptFileId) : "").filter(Boolean))];
  if (ids.length === 0) return new Map<string, Receipt>();
  const { data, error } = await client.from("uploaded_files").select("id,originalName,mimeType").eq("user_id", userId).in("id", ids);
  if (error) throw error;
  return new Map((data ?? []).map((row) => [String(row.id), { originalName: String(row.originalName), mimeType: String(row.mimeType) }]));
}

async function getExpense(id: string, context?: RepositoryContext) {
  const { client, userId } = requireSupabaseContext(context);
  const { data, error } = await client.from("expenses").select("*").eq("user_id", userId).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const receipts = await receiptMap([data], context);
  return mapExpense(data, data.receiptFileId ? receipts.get(String(data.receiptFileId)) : undefined);
}

export const supabaseFinanceRepository: FinanceRepository = {
  async listExpenses(context) {
    const { client, userId } = requireSupabaseContext(context);
    const { data, error } = await client.from("expenses").select("*").eq("user_id", userId)
      .order("date", { ascending: false }).order("createdAt", { ascending: false });
    if (error) throw error;
    const rows = data ?? [];
    const receipts = await receiptMap(rows, context);
    return rows.map((row) => mapExpense(row, row.receiptFileId ? receipts.get(String(row.receiptFileId)) : undefined));
  },
  async createExpense(input, context) {
    const { client, userId } = requireSupabaseContext(context);
    const id = randomUUID();
    const amount = Number(input.amount ?? 0);
    const currency = isSupportedCurrencyCode(input.currency) ? input.currency : "AUD";
    const { error } = await client.from("expenses").insert({ id, user_id: userId, type: input.type === "income" ? "income" : "expense",
      title: input.title ?? (input.type === "income" ? "未命名收入" : "未命名支出"), amount: Number.isFinite(amount) ? amount : 0,
      currency, category: input.category ?? "其他", date: input.date ?? today(), merchant: input.merchant ?? null,
      paymentMethod: input.paymentMethod ?? null, notes: input.notes ?? null, receiptFileId: input.receiptFileId ?? null });
    if (error) throw error;
    await supabaseSettingsRepository.updateAppSettings({ lastUsedCurrency: currency }, context);
    return (await getExpense(id, context))!;
  },
  async updateExpense(id, input, context) {
    const { client, userId } = requireSupabaseContext(context);
    const current = await getExpense(id, context);
    if (!current) return null;
    const amount = input.amount === undefined || input.amount === null ? current.amount : Number(input.amount);
    const next = { ...current, ...input, amount: Number.isFinite(amount) ? amount : current.amount };
    const { data, error } = await client.from("expenses").update({ type: next.type === "income" ? "income" : "expense", title: next.title,
      amount: next.amount, currency: next.currency, category: next.category, date: next.date, merchant: next.merchant ?? null,
      paymentMethod: next.paymentMethod ?? null, notes: next.notes ?? null, receiptFileId: next.receiptFileId ?? null })
      .eq("user_id", userId).eq("id", id).select("id");
    if (error) throw error;
    if (!data?.length) return null;
    if (isSupportedCurrencyCode(next.currency)) await supabaseSettingsRepository.updateAppSettings({ lastUsedCurrency: next.currency }, context);
    return getExpense(id, context);
  },
  async deleteExpense(id, context) {
    const { client, userId } = requireSupabaseContext(context);
    const { data, error } = await client.from("expenses").delete().eq("user_id", userId).eq("id", id).select("id");
    if (error) throw error;
    return data?.length ?? 0;
  }
};
