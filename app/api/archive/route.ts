import { getTaskService } from "@/lib/services/task-service";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(getTaskService().listAllTasks());
}
