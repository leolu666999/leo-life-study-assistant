import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({ title, subtitle, children, footer }: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-soft sm:p-8">
        <Link href="/" className="mb-8 block text-lg font-semibold text-slate-950">MyAssist</Link>
        <h1 className="text-2xl font-semibold text-slate-950">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">{subtitle}</p>
        <div className="mt-6">{children}</div>
        {footer && <div className="mt-6 border-t border-slate-100 pt-5 text-center text-sm text-slate-500">{footer}</div>}
      </section>
    </main>
  );
}
