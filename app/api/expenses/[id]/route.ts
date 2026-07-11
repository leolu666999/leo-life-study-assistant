import { mutationResponse } from "@/lib/realtime";
import { isSupportedCurrencyCode } from "@/lib/currencies";
import { getFinanceService } from "@/lib/services/finance-service";
import { repositoryContextForRequest } from "@/lib/repositories/request-context";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  if (body.currency !== undefined && !isSupportedCurrencyCode(body.currency)) {
    return Response.json({ error: "请选择有效货币。" }, { status: 400 });
  }
  const repositoryContext = await repositoryContextForRequest(request);
  const expense = await getFinanceService().updateExpense(id, body, repositoryContext);
  if (!expense) return Response.json({ error: "Expense not found" }, { status: 404 });
  return mutationResponse(expense, 200, "expenses", "update");
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const repositoryContext = await repositoryContextForRequest(request);
  await getFinanceService().deleteExpense(id, repositoryContext);
  return mutationResponse({ ok: true }, 200, "expenses", "delete");
}
