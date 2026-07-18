import { mutationResponse } from "@/lib/realtime";
import { getSettingsService } from "@/lib/services/settings-service";
import { repositoryContextForRequest } from "@/lib/repositories/request-context";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const context = await repositoryContextForRequest(request);
  return Response.json(await getSettingsService().getAppSettings(context));
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const context = await repositoryContextForRequest(request);
  return mutationResponse(await getSettingsService().updateAppSettings({
    lastUsedCurrency: context.backend === "supabase" && (body.lastUsedCurrency === null || typeof body.lastUsedCurrency === "string")
      ? body.lastUsedCurrency
      : undefined,
    homeTitle: typeof body.homeTitle === "string" ? body.homeTitle : undefined,
    showHomeTitle: typeof body.showHomeTitle === "boolean" ? body.showHomeTitle : undefined,
    language: body.language === "zh-CN" || body.language === "zh-TW" || body.language === "en" ? body.language : undefined
  }, context), 200, "settings", "update");
}
