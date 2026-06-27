import { deleteExpense, updateExpense } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  const expense = updateExpense(id, body);
  if (!expense) return Response.json({ error: "Expense not found" }, { status: 404 });
  return Response.json(expense);
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  deleteExpense(id);
  return Response.json({ ok: true });
}
