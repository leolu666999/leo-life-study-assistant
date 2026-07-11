import { getTaskService } from "@/lib/services/task-service";
import { repositoryContextForRequest } from "@/lib/repositories/request-context";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const context = await repositoryContextForRequest(request);
  return Response.json(await getTaskService().listAllTasks(context));
}
