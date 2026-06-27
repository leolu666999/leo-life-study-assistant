import { createProgress, listProgress } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(listProgress());
}

export async function POST(request: Request) {
  const body = await request.json();
  return Response.json(createProgress(body), { status: 201 });
}
