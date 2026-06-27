import { createExpense, listExpenses } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(listExpenses());
}

export async function POST(request: Request) {
  const body = await request.json();
  return Response.json(createExpense(body), { status: 201 });
}
