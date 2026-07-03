import { createPlan, listPlans } from "@/lib/db";
import { mutationResponse } from "@/lib/realtime";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(listPlans());
}

export async function POST(request: Request) {
  const body = await request.json();
  return mutationResponse(createPlan(body), { status: 201 }, "plans", "create");
}
