import type { AppSettings } from "@/lib/types";
import type { RepositoryContext, RepositoryResult } from "./repository-context";

export interface SettingsRepository {
  getAppSettings(context?: RepositoryContext): RepositoryResult<AppSettings>;
  updateAppSettings(input: Partial<AppSettings>, context?: RepositoryContext): RepositoryResult<AppSettings>;
}
