import { createProgress, listProgress } from "@/lib/db";
import { mutationResponse } from "@/lib/realtime";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(listProgress());
}

export async function POST(request: Request) {
  const body = await request.json();
  return mutationResponse(createProgress(body), { status: 201 }, "progress", "create");
}
