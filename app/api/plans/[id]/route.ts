import { deletePlan, updatePlan } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  const plan = updatePlan(id, body);
  if (!plan) return Response.json({ error: "Plan not found" }, { status: 404 });
  return Response.json(plan);
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  deletePlan(id);
  return Response.json({ ok: true });
}
