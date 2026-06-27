import { createPlan, listPlans } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(listPlans());
}

export async function POST(request: Request) {
  const body = await request.json();
  return Response.json(createPlan(body), { status: 201 });
}
