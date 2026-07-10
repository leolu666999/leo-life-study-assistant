import { mutationResponse } from "@/lib/realtime";
import { getTaskService } from "@/lib/services/task-service";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(getTaskService().listProgress());
}

export async function POST(request: Request) {
  const body = await request.json();
  return mutationResponse(getTaskService().createProgress(body), { status: 201 }, "progress", "create");
}
