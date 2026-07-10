import { getAppSettings, updateAppSettings } from "@/lib/db";
import { mutationResponse } from "@/lib/realtime";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(getAppSettings());
}

export async function PATCH(request: Request) {
  const body = await request.json();
  return mutationResponse(updateAppSettings({
    homeTitle: typeof body.homeTitle === "string" ? body.homeTitle : undefined,
    showHomeTitle: typeof body.showHomeTitle === "boolean" ? body.showHomeTitle : undefined
  }), 200, "settings", "update");
}
