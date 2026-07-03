import { createCourse, listCourses } from "@/lib/db";
import { mutationResponse } from "@/lib/realtime";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(listCourses());
}

export async function POST(request: Request) {
  const body = await request.json();
  return mutationResponse(createCourse(body), { status: 201 }, "courses", "create");
}
