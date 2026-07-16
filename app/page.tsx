import { LeoApp } from "@/components/leo-app";
import { LandingPage } from "@/components/landing-page";
import { currentSessionUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  if (process.env.AUTH_REQUIRED === "true") {
    const user = await currentSessionUser();
    if (!user) return <LandingPage />;
  }
  return <LeoApp initialView="dashboard" />;
}
