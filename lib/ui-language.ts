export const uiLanguages = ["zh-CN", "zh-TW", "en"] as const;

export type UiLanguage = (typeof uiLanguages)[number];

export const UI_LANGUAGE_STORAGE_KEY = "myassist-ui-language";

export function isUiLanguage(value: unknown): value is UiLanguage {
  return typeof value === "string" && uiLanguages.includes(value as UiLanguage);
}

export function normalizeUiLanguage(value: unknown): UiLanguage {
  return isUiLanguage(value) ? value : "zh-CN";
}
