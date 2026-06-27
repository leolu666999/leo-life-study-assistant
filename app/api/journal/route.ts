import { createJournal, listJournal } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(listJournal());
}

export async function POST(request: Request) {
  const body = await request.json();
  return Response.json(createJournal(body), { status: 201 });
}
