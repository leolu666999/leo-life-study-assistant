import { mutationResponse } from "@/lib/realtime";
import { getTaskService } from "@/lib/services/task-service";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const task = getTaskService().archiveTask(id);
  if (!task) return Response.json({ error: "Task not found" }, { status: 404 });
  return mutationResponse(task, 200, "tasks", "archive");
}
