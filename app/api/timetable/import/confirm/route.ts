import { mutationResponse } from "@/lib/realtime";
import { getTimetableService } from "@/lib/services/timetable-service";
import { repositoryContextForRequest } from "@/lib/repositories/request-context";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const preview = await request.json();
  const context = await repositoryContextForRequest(request);
  return mutationResponse(await getTimetableService().importTimetable(preview, context), { status: 201 }, "timetable", "import");
}
