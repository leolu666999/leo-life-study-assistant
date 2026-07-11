import { mutationResponse } from "@/lib/realtime";
import { getPlanService } from "@/lib/services/plan-service";
import { repositoryContextForRequest } from "@/lib/repositories/request-context";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  const repositoryContext = await repositoryContextForRequest(request);
  const plan = await getPlanService().updatePlan(id, body, repositoryContext);
  if (!plan) return Response.json({ error: "Plan not found" }, { status: 404 });
  return mutationResponse(plan, 200, "plans", "update");
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const repositoryContext = await repositoryContextForRequest(request);
  await getPlanService().deletePlan(id, repositoryContext);
  return mutationResponse({ ok: true }, 200, "plans", "delete");
}
