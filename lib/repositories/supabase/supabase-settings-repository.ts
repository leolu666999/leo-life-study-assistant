import { isSupportedCurrencyCode } from "@/lib/currencies";
import type { AppSettings } from "@/lib/types";
import type { SettingsRepository } from "../settings-repository";
import { requireSupabaseContext } from "../request-context";
import { normalizeUiLanguage } from "@/lib/ui-language";

const defaults: AppSettings = { lastUsedCurrency: null, homeTitle: "MyAssist", showHomeTitle: true, language: "zh-CN" };

async function readSettings(context: Parameters<SettingsRepository["getAppSettings"]>[0]) {
  const { client, userId } = requireSupabaseContext(context);
  const { data, error } = await client.from("settings").select("key,value").eq("user_id", userId)
    .in("key", ["lastUsedCurrency", "homeTitle", "showHomeTitle", "language"]);
  if (error) throw error;
  const values = new Map((data ?? []).map((row) => [String(row.key), String(row.value)]));
  const currency = values.get("lastUsedCurrency");
  const title = values.get("homeTitle")?.trim();
  return {
    lastUsedCurrency: isSupportedCurrencyCode(currency) ? currency : null,
    homeTitle: title || defaults.homeTitle,
    showHomeTitle: values.get("showHomeTitle") !== "0",
    language: normalizeUiLanguage(values.get("language"))
  } satisfies AppSettings;
}

export const supabaseSettingsRepository: SettingsRepository = {
  getAppSettings: readSettings,
  async updateAppSettings(input, context) {
    const { client, userId } = requireSupabaseContext(context);
    const rows: Array<{ user_id: string; key: string; value: string }> = [];
    if (input.lastUsedCurrency !== undefined) {
      if (input.lastUsedCurrency === null) rows.push({ user_id: userId, key: "lastUsedCurrency", value: "" });
      else if (isSupportedCurrencyCode(input.lastUsedCurrency)) rows.push({ user_id: userId, key: "lastUsedCurrency", value: input.lastUsedCurrency });
    }
    if (input.homeTitle !== undefined) rows.push({ user_id: userId, key: "homeTitle", value: input.homeTitle.trim() || "MyAssist" });
    if (input.showHomeTitle !== undefined) rows.push({ user_id: userId, key: "showHomeTitle", value: input.showHomeTitle ? "1" : "0" });
    if (input.language === "zh-CN" || input.language === "zh-TW" || input.language === "en") rows.push({ user_id: userId, key: "language", value: input.language });
    if (rows.length > 0) {
      const { error } = await client.from("settings").upsert(rows, { onConflict: "user_id,key" });
      if (error) throw error;
    }
    return readSettings(context);
  }
};
