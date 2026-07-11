import { getTimetableService } from "@/lib/services/timetable-service";
import { repositoryContextForRequest } from "@/lib/repositories/request-context";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const context = await repositoryContextForRequest(request);
  return Response.json(await getTimetableService().getTimetable({
      from: url.searchParams.get("from") || undefined,
      to: url.searchParams.get("to") || undefined,
      includeCancelled: url.searchParams.get("includeCancelled") === "1"
  }, context));
}
