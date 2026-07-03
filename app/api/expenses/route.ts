import { createExpense, listExpenses } from "@/lib/db";
import { mutationResponse } from "@/lib/realtime";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(listExpenses());
}

export async function POST(request: Request) {
  const body = await request.json();
  return mutationResponse(createExpense(body), { status: 201 }, "expenses", "create");
}
