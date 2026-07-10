import { getAppSettings, updateAppSettings } from "@/lib/db";
import type { SettingsRepository } from "../settings-repository";

export const sqliteSettingsRepository: SettingsRepository = {
  getAppSettings: () => getAppSettings(),
  updateAppSettings
};
