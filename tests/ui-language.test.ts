import { describe, expect, it } from "vitest";
import { translateUiText, uiLanguageLocale } from "../lib/ui-language";

const criticalSystemText = [
  "正在恢复实时连接...",
  "今天还没有课程或带时间的安排。",
  "没有符合条件的任务。",
  "0 节课程 · 0 项 To Do",
  "导入完成：新增 1，更新 2，跳过 3，冲突 4",
  "悉尼时间 · 来源 1 · 课程系列 16 · 当前显示 13",
  "新增日程",
  "课程管理",
  "上传截图",
  "提醒设置",
  "上传凭证"
] as const;

describe("UI language consistency", () => {
  it("translates critical system UI completely in English mode", () => {
    for (const source of criticalSystemText) {
      expect(translateUiText("en", source), source).not.toMatch(/[\u3400-\u9fff]/u);
    }
    expect(uiLanguageLocale("en")).toBe("en-AU");
  });

  it("uses Traditional Chinese throughout Traditional mode", () => {
    expect(translateUiText("zh-TW", "正在恢复实时连接...")).toBe("正在恢復即時連線...");
    expect(translateUiText("zh-TW", "今天还没有课程或带时间的安排。")).toBe("今天還沒有課程或帶時間的安排。");
    expect(translateUiText("zh-TW", "0 节课程 · 0 项 To Do")).toBe("0 節課程 · 0 項待辦");
    expect(translateUiText("zh-TW", "上传截图")).toBe("上傳截圖");
    expect(uiLanguageLocale("zh-TW")).toBe("zh-TW");
  });

  it("keeps established product phrases in Simplified Chinese mode", () => {
    expect(translateUiText("zh-CN", "Today’s Schedule")).toBe("Today’s Schedule");
    expect(translateUiText("zh-CN", "Task Card")).toBe("Task Card");
    expect(translateUiText("zh-CN", "To Do List")).toBe("To Do List");
  });
});
