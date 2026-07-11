import { mutationResponse } from "@/lib/realtime";
import { getTaskService } from "@/lib/services/task-service";
import { repositoryContextForRequest } from "@/lib/repositories/request-context";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const context = await repositoryContextForRequest(request);
  return Response.json(await getTaskService().listActiveTasks(context));
}

export async function POST(request: Request) {
  const body = await request.json();
  const context = await repositoryContextForRequest(request);
  return mutationResponse(await getTaskService().createTask(body, context), { status: 201 }, "tasks", "create");
}
