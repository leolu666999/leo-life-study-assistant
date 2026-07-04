import { listCourses } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(listCourses());
}

export async function POST(request: Request) {
  await request.text();
  return Response.json({ error: "旧的手动添加课程功能已停用，请使用课表导入。" }, { status: 410 });
}
