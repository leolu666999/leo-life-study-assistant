import Link from "next/link";
import { ContactDeveloperForm } from "@/components/contact-developer-form";

export default function ContactDeveloperPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/settings" className="text-sm text-slate-500 hover:text-slate-950">返回 MyAssist</Link>
        <h1 className="mt-5 text-3xl font-semibold text-slate-950">联系开发者</h1>
        <p className="mb-6 mt-2 text-sm text-slate-500">提交问题、建议或账号协助请求。</p>
        <ContactDeveloperForm />
      </div>
    </main>
  );
}
