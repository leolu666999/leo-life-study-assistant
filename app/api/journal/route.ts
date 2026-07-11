import { mutationResponse } from "@/lib/realtime";
import { getJournalService } from "@/lib/services/journal-service";
import { repositoryContextForRequest } from "@/lib/repositories/request-context";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const context = await repositoryContextForRequest(request);
  return Response.json(await getJournalService().listJournal(context));
}

export async function POST(request: Request) {
  const body = await request.json();
  const context = await repositoryContextForRequest(request);
  return mutationResponse(await getJournalService().createJournal(body, context), { status: 201 }, "journal", "create");
}
