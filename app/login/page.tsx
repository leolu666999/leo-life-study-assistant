import { LoginPageClient } from "@/components/auth/login-page-client";
import { safeRedirectPath } from "@/lib/auth/redirect";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const nextPath = safeRedirectPath((await searchParams).next);
  return <LoginPageClient nextPath={nextPath} />;
}
