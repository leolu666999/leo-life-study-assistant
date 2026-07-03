import { deletePlan, updatePlan } from "@/lib/db";
import { mutationResponse } from "@/lib/realtime";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  const plan = updatePlan(id, body);
  if (!plan) return Response.json({ error: "Plan not found" }, { status: 404 });
  return mutationResponse(plan, 200, "plans", "update");
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  deletePlan(id);
  return mutationResponse({ ok: true }, 200, "plans", "delete");
}
