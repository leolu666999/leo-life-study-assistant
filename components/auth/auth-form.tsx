"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { buildAuthCallbackUrl } from "@/lib/auth/callback-url";
import { safeRedirectPath } from "@/lib/auth/redirect";

type AuthFormMode = "login" | "register" | "forgot" | "reset";

export function AuthForm({ mode, nextPath = "/" }: { mode: AuthFormMode; nextPath?: string }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
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
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ identifier: email.trim(), password, rememberMe })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "登录失败。");
        window.location.assign(safeRedirectPath(nextPath));
        return;
      }

      if (mode === "register") {
        if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) throw new Error("用户名需为 3 至 24 位字母、数字或下划线。");
        if (password.length < 8) throw new Error("密码至少需要 8 个字符。");
        const redirectTo = buildAuthCallbackUrl(window.location.origin, "/");
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: redirectTo, data: { username } }
        });
        if (error) {
          const errorText = `${error.code || ""} ${error.message}`.toLowerCase();
          const emailAlreadyUsed = error.code === "user_already_exists"
            || errorText.includes("user already registered")
            || errorText.includes("email already registered")
            || errorText.includes("email already exists")
            || errorText.includes("email address is already registered");
          if (emailAlreadyUsed) {
            throw new Error("该邮箱已被使用，请直接登录或使用“找回密码”。");
          }
          throw error;
        }
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          throw new Error("该邮箱已被使用，请直接登录或使用“找回密码”。");
        }
        if (data.session) {
          window.location.assign("/");
          return;
        }
        setMessage("注册请求已提交。请检查邮箱并通过确认链接完成登录。");
      }

      if (mode === "forgot") {
        const redirectTo = buildAuthCallbackUrl(window.location.origin, "/reset-password");
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
      {mode === "register" && (
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          用户名
          <input required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" autoComplete="username" value={username}
            onChange={(event) => setUsername(event.target.value)} placeholder="字母、数字或下划线"
            title="3 至 24 位，仅限英文字母、数字和下划线"
            className="h-11 rounded-lg border border-slate-200 px-3 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100" />
          <span className="text-xs font-normal leading-5 text-slate-500">
            3 至 24 位，仅限英文字母、数字和下划线；用户名全局唯一，且不区分大小写。
          </span>
        </label>
      )}
      {needsEmail && (
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          {mode === "login" ? "用户名或邮箱" : "邮箱"}
          <input
            required
            type={mode === "login" ? "text" : "email"}
            autoComplete={mode === "login" ? "username" : "email"}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-11 rounded-lg border border-slate-200 px-3 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
          />
          {mode === "login" && (
            <span className="text-xs font-normal leading-5 text-slate-500">
              可输入注册邮箱或用户名；用户名不区分大小写。
            </span>
          )}
          {mode === "register" && (
            <span className="text-xs font-normal leading-5 text-slate-500">
              每个邮箱只能注册一个账号；如果邮箱已被使用，系统会在提交后明确提示。
            </span>
          )}
        </label>
      )}
      {needsPassword && (
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          {mode === "reset" ? "新密码" : "密码"}
          <span className="relative block">
            <input
              required
              minLength={8}
              type={showPassword ? "text" : "password"}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 w-full rounded-lg border border-slate-200 px-3 pr-11 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 inline-flex -translate-y-1/2 rounded-md p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "隐藏密码" : "显示密码"}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </span>
          {(mode === "login" || mode === "register") && (
            <span className="text-xs font-normal leading-5 text-slate-500">
              {mode === "register"
                ? "至少 8 个字符，密码区分大小写；建议混合字母、数字和符号。"
                : "密码区分大小写，请输入注册时设置的完整密码。"}
            </span>
          )}
        </label>
      )}
      {mode === "reset" && (
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          再次输入新密码
          <span className="relative block">
            <input
              required
              minLength={8}
              type={showConfirmation ? "text" : "password"}
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className="h-11 w-full rounded-lg border border-slate-200 px-3 pr-11 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 inline-flex -translate-y-1/2 rounded-md p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
              onClick={() => setShowConfirmation((value) => !value)}
              aria-label={showConfirmation ? "隐藏确认密码" : "显示确认密码"}
            >
              {showConfirmation ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </span>
        </label>
      )}
      {mode === "login" && (
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(event) => setRememberMe(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          在这台电脑保持登录
        </label>
      )}
      {mode === "login" && <div className="text-right"><Link href="/forgot-password" className="text-sm text-slate-600 hover:text-slate-950">找回密码</Link></div>}
      {errorMessage && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>}
      {message && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
      <button disabled={submitting} className="h-11 w-full rounded-lg bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-50">
        {submitting ? "处理中..." : mode === "login" ? "登录" : mode === "register" ? "注册" : mode === "forgot" ? "发送重置邮件" : "更新密码"}
      </button>
    </form>
  );
}
