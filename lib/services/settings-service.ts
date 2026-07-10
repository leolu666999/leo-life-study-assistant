import { getSettingsRepository } from "@/lib/repositories";
import type { RepositoryContext } from "@/lib/repositories/repository-context";
import type { AppSettings } from "@/lib/types";

export class SettingsService {
  constructor(private readonly repository = getSettingsRepository()) {}

  getAppSettings(context?: RepositoryContext) {
    return this.repository.getAppSettings(context);
  }

  updateAppSettings(input: Partial<AppSettings>, context?: RepositoryContext) {
    return this.repository.updateAppSettings(input, context);
  }
}

export function getSettingsService() {
  return new SettingsService();
}
