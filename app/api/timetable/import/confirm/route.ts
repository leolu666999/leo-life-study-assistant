import { importTimetablePreview } from "@/lib/db";
import { mutationResponse } from "@/lib/realtime";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const preview = await request.json();
  return mutationResponse(importTimetablePreview(preview), { status: 201 }, "timetable", "import");
}
