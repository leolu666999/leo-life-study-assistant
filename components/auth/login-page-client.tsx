"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { UI_LANGUAGE_STORAGE_KEY, type UiLanguage } from "@/lib/ui-language";

const copy = {
  "zh-CN": {
    title: "登录 MyAssist",
    subtitle: "使用用户名或邮箱登录你的个人空间。",
    prompt: "还没有账号？",
    create: "创建账号",
    chineseLabel: "切换为中文",
    englishLabel: "Switch to English"
  },
  en: {
    title: "Sign in to MyAssist",
    subtitle: "Use your username or email to access your personal space.",
    prompt: "New to MyAssist?",
    create: "Create an account",
    chineseLabel: "切换为中文",
    englishLabel: "Switch to English"
  }
} as const;

export function LoginPageClient({ nextPath }: { nextPath: string }) {
  const [language, setLanguage] = useState<UiLanguage>("zh-CN");

  useEffect(() => {
    const saved = window.localStorage.getItem(UI_LANGUAGE_STORAGE_KEY);
    setLanguage(saved === "en" ? "en" : "zh-CN");
  }, []);

  function selectLanguage(next: UiLanguage) {
    setLanguage(next);
    window.localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, next);
    document.documentElement.lang = next;
  }

  const text = copy[language === "en" ? "en" : "zh-CN"];
  const switcher = (
    <div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1" aria-label="Language">
      <button
        type="button"
        aria-label={text.chineseLabel}
        aria-pressed={language !== "en"}
        className={`h-8 min-w-10 rounded-md px-2 text-xs font-semibold transition ${language !== "en" ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
        onClick={() => selectLanguage("zh-CN")}
      >
        中
      </button>
      <button
        type="button"
        aria-label={text.englishLabel}
        aria-pressed={language === "en"}
        className={`h-8 min-w-12 rounded-md px-2 text-xs font-semibold tracking-wide transition ${language === "en" ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
        onClick={() => selectLanguage("en")}
      >
        EN
      </button>
    </div>
  );

  return (
    <AuthShell
      title={text.title}
      subtitle={text.subtitle}
      headerAction={switcher}
      footer={<>{text.prompt} <Link href="/register" className="font-medium text-slate-950">{text.create}</Link></>}
    >
      <AuthForm mode="login" nextPath={nextPath} language={language} />
    </AuthShell>
  );
}
