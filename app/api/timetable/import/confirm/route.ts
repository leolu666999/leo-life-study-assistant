import { mutationResponse } from "@/lib/realtime";
import { getTimetableService } from "@/lib/services/timetable-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const preview = await request.json();
  return mutationResponse(getTimetableService().importTimetable(preview), { status: 201 }, "timetable", "import");
}
