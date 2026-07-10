import { createExpense, listExpenses } from "@/lib/db";
import { mutationResponse } from "@/lib/realtime";
import { isSupportedCurrencyCode } from "@/lib/currencies";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(listExpenses());
}

export async function POST(request: Request) {
  const body = await request.json();
  if (!isSupportedCurrencyCode(body.currency)) {
    return Response.json({ error: "请选择有效货币。" }, { status: 400 });
  }
  return mutationResponse(createExpense(body), { status: 201 }, "expenses", "create");
}
