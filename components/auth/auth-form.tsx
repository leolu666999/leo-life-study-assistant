"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { safeRedirectPath } from "@/lib/auth/redirect";

type AuthFormMode = "login" | "register" | "forgot" | "reset";

export function AuthForm({ mode, nextPath = "/" }: { mode: AuthFormMode; nextPath?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const needsEmail = mode !== "reset";
  const needsPassword = mode === "login" || mode === "register" || mode === "reset";

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    setErrorMessage("");

    try {
      const supabase = createSupabaseBrowserClient();
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        window.location.assign(safeRedirectPath(nextPath));
        return;
      }

      if (mode === "register") {
        if (password.length < 8) throw new Error("密码至少需要 8 个字符。");
        const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/")}`;
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: redirectTo }
        });
        if (error) throw error;
        if (data.session) {
          window.location.assign("/");
          return;
        }
        setMessage("注册请求已提交。请检查邮箱并通过确认链接完成登录。");
      }

      if (mode === "forgot") {
        const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`;
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
        if (error) throw error;
        setMessage("如果这个邮箱可以重置密码，你会收到一封重置邮件。请检查收件箱。");
      }

      if (mode === "reset") {
        if (password.length < 8) throw new Error("新密码至少需要 8 个字符。");
        if (password !== confirmation) throw new Error("两次输入的密码不一致。");
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setMessage("密码已更新，现在可以返回 MyAssist。");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "操作失败，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      {needsEmail && (
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          邮箱
          <input
            required
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-11 rounded-lg border border-slate-200 px-3 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
          />
        </label>
      )}
      {needsPassword && (
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          {mode === "reset" ? "新密码" : "密码"}
          <input
            required
            minLength={8}
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-11 rounded-lg border border-slate-200 px-3 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
          />
        </label>
      )}
      {mode === "reset" && (
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          再次输入新密码
          <input
            required
            minLength={8}
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            className="h-11 rounded-lg border border-slate-200 px-3 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
          />
        </label>
      )}
      {mode === "login" && <div className="text-right"><Link href="/forgot-password" className="text-sm text-slate-600 hover:text-slate-950">忘记密码？</Link></div>}
      {errorMessage && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>}
      {message && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
      <button disabled={submitting} className="h-11 w-full rounded-lg bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-50">
        {submitting ? "处理中..." : mode === "login" ? "登录" : mode === "register" ? "注册" : mode === "forgot" ? "发送重置邮件" : "更新密码"}
      </button>
    </form>
  );
}
