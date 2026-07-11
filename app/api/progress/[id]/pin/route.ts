import { mutationResponse } from "@/lib/realtime";
import { getTaskService } from "@/lib/services/task-service";
import { repositoryContextForRequest } from "@/lib/repositories/request-context";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const repositoryContext = await repositoryContextForRequest(request);
  return mutationResponse(await getTaskService().pinProgressTask(id, repositoryContext), 200, "progress", "pin");
}
