import { mutationResponse } from "@/lib/realtime";
import { getSettingsService } from "@/lib/services/settings-service";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(getSettingsService().getAppSettings());
}

export async function PATCH(request: Request) {
  const body = await request.json();
  return mutationResponse(getSettingsService().updateAppSettings({
    homeTitle: typeof body.homeTitle === "string" ? body.homeTitle : undefined,
    showHomeTitle: typeof body.showHomeTitle === "boolean" ? body.showHomeTitle : undefined
  }), 200, "settings", "update");
}
