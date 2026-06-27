import { createCourse, listCourses } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(listCourses());
}

export async function POST(request: Request) {
  const body = await request.json();
  return Response.json(createCourse(body), { status: 201 });
}
