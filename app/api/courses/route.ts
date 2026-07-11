import { getTimetableService } from "@/lib/services/timetable-service";
import { repositoryContextForRequest } from "@/lib/repositories/request-context";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const context = await repositoryContextForRequest(request);
  return Response.json(await getTimetableService().listCourses(context));
}

export async function POST(request: Request) {
  await request.text();
  return Response.json({ error: "旧的手动添加课程功能已停用，请使用课表导入。" }, { status: 410 });
}
