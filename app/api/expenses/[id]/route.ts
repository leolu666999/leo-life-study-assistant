import { deleteExpense, updateExpense } from "@/lib/db";
import { mutationResponse } from "@/lib/realtime";
import { isSupportedCurrencyCode } from "@/lib/currencies";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  if (body.currency !== undefined && !isSupportedCurrencyCode(body.currency)) {
    return Response.json({ error: "请选择有效货币。" }, { status: 400 });
  }
  const expense = updateExpense(id, body);
  if (!expense) return Response.json({ error: "Expense not found" }, { status: 404 });
  return mutationResponse(expense, 200, "expenses", "update");
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  deleteExpense(id);
  return mutationResponse({ ok: true }, 200, "expenses", "delete");
}
