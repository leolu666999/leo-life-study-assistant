import { mutationResponse } from "@/lib/realtime";
import { isSupportedCurrencyCode } from "@/lib/currencies";
import { getFinanceService } from "@/lib/services/finance-service";
import { repositoryContextForRequest } from "@/lib/repositories/request-context";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const context = await repositoryContextForRequest(request);
  return Response.json(await getFinanceService().listExpenses(context));
}

export async function POST(request: Request) {
  const body = await request.json();
  if (!isSupportedCurrencyCode(body.currency)) {
    return Response.json({ error: "请选择有效货币。" }, { status: 400 });
  }
  const context = await repositoryContextForRequest(request);
  return mutationResponse(await getFinanceService().createExpense(body, context), { status: 201 }, "expenses", "create");
}
