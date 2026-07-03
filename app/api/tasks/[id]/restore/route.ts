import { setTaskStatus } from "@/lib/db";
import { mutationResponse } from "@/lib/realtime";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const task = setTaskStatus(id, "not_started");
  if (!task) return Response.json({ error: "Task not found" }, { status: 404 });
  return mutationResponse(task, 200, "tasks", "restore");
}
