import { mutationResponse } from "@/lib/realtime";
import { getJournalService } from "@/lib/services/journal-service";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(getJournalService().listJournal());
}

export async function POST(request: Request) {
  const body = await request.json();
  return mutationResponse(getJournalService().createJournal(body), { status: 201 }, "journal", "create");
}
