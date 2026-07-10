import type { AppSettings } from "@/lib/types";
import type { RepositoryContext } from "./repository-context";

export interface SettingsRepository {
  getAppSettings(context?: RepositoryContext): AppSettings;
  updateAppSettings(input: Partial<AppSettings>, context?: RepositoryContext): AppSettings;
}
