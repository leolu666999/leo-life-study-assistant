import { createJournal, listJournal } from "@/lib/db";
import { mutationResponse } from "@/lib/realtime";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(listJournal());
}

export async function POST(request: Request) {
  const body = await request.json();
  return mutationResponse(createJournal(body), { status: 201 }, "journal", "create");
}
