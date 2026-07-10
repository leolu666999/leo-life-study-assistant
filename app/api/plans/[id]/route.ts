import { mutationResponse } from "@/lib/realtime";
import { getPlanService } from "@/lib/services/plan-service";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  const plan = getPlanService().updatePlan(id, body);
  if (!plan) return Response.json({ error: "Plan not found" }, { status: 404 });
  return mutationResponse(plan, 200, "plans", "update");
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  getPlanService().deletePlan(id);
  return mutationResponse({ ok: true }, 200, "plans", "delete");
}
