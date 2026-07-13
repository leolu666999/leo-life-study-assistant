import { GET as getUpload } from "../../uploads/[id]/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return getUpload(request, context);
}
