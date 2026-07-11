import { mutationResponse } from "@/lib/realtime";
import { getTaskService } from "@/lib/services/task-service";
import { repositoryContextForRequest } from "@/lib/repositories/request-context";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const context = await repositoryContextForRequest(request);
  return Response.json(await getTaskService().listProgress(context));
}

export async function POST(request: Request) {
  const body = await request.json();
  const context = await repositoryContextForRequest(request);
  return mutationResponse(await getTaskService().createProgress(body, context), { status: 201 }, "progress", "create");
}
