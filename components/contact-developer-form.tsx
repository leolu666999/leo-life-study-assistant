"use client";

import { Mail, MessageSquareText, Phone } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

export function ContactDeveloperForm() {
  const [contact, setContact] = useState<{ email: string | null; phone: string | null }>({ email: null, phone: null });
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetch("/api/developer-contact").then((response) => response.json()).then(setContact).catch(() => undefined); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setStatus("");
    const response = await fetch("/api/developer-contact", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, message })
    });
    const result = await response.json();
    setSubmitting(false);
    if (!response.ok) return setStatus(result.error || "发送失败，请稍后重试。");
    setMessage("");
    setStatus("留言已发送，我们会尽快处理。");
  }

  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_240px]">
      <form onSubmit={submit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
        <div className="flex items-center gap-2"><MessageSquareText size={20} /><h2 className="font-semibold">留言板</h2></div>
        <label className="grid gap-2 text-sm font-medium text-slate-700">联系邮箱（未登录时填写）
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="your@email.com"
            className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-slate-500" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">留言
          <textarea required maxLength={4000} value={message} onChange={(event) => setMessage(event.target.value)}
            className="min-h-36 rounded-lg border border-slate-200 p-3 outline-none focus:border-slate-500" placeholder="请描述你的问题或建议" />
        </label>
        {status && <p role="status" className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{status}</p>}
        <button disabled={submitting} className="h-11 w-full rounded-lg bg-slate-900 font-medium text-white disabled:opacity-50">{submitting ? "发送中..." : "发送留言"}</button>
      </form>
      <aside className="space-y-3 rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
        <h2 className="font-semibold">开发者联系方式</h2>
        <div className="flex gap-3 text-sm text-slate-600"><Mail size={18} /><span>{contact.email || "暂未配置"}</span></div>
        <div className="flex gap-3 text-sm text-slate-600"><Phone size={18} /><span>{contact.phone || "暂未配置"}</span></div>
      </aside>
    </div>
  );
}
