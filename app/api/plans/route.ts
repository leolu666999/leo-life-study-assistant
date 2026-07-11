import { mutationResponse } from "@/lib/realtime";
import { getPlanService } from "@/lib/services/plan-service";
import { repositoryContextForRequest } from "@/lib/repositories/request-context";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const context = await repositoryContextForRequest(request);
  return Response.json(await getPlanService().listPlans(context));
}

export async function POST(request: Request) {
  const body = await request.json();
  const context = await repositoryContextForRequest(request);
  return mutationResponse(await getPlanService().createPlan(body, context), { status: 201 }, "plans", "create");
}
