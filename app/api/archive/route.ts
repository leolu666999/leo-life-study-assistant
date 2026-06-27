import { listTasks } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(listTasks({ includeArchived: true }));
}
