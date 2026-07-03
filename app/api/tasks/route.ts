import { createTask, listTasks } from "@/lib/db";
import { mutationResponse } from "@/lib/realtime";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(listTasks());
}

export async function POST(request: Request) {
  const body = await request.json();
  return mutationResponse(createTask(body), { status: 201 }, "tasks", "create");
}
