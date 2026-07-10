import { mutationResponse } from "@/lib/realtime";
import { getPlanService } from "@/lib/services/plan-service";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(getPlanService().listPlans());
}

export async function POST(request: Request) {
  const body = await request.json();
  return mutationResponse(getPlanService().createPlan(body), { status: 201 }, "plans", "create");
}
