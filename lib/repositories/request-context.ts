import type { RepositoryContext } from "./repository-context";

export class CloudRepositoryConfigurationError extends Error {}
export class CloudRepositoryAuthenticationError extends Error {}

export async function repositoryContextForRequest(request: Request): Promise<RepositoryContext> {
  const backend = process.env.DATA_BACKEND?.trim() || "sqlite";
  if (backend === "sqlite") return { backend: "sqlite" };
  if (backend !== "supabase") throw new CloudRepositoryConfigurationError(`Unsupported DATA_BACKEND: ${backend}`);
  if (process.env.AUTH_REQUIRED !== "true") {
    throw new CloudRepositoryConfigurationError("DATA_BACKEND=supabase requires AUTH_REQUIRED=true");
  }

  const { authenticatedRequestContext } = await import("@/lib/supabase/server");
  const authenticated = await authenticatedRequestContext(request);
  if (!authenticated) throw new CloudRepositoryAuthenticationError("Authentication required");
  return { backend: "supabase", userId: authenticated.user.id, supabase: authenticated.client };
}

export function requireSupabaseContext(context?: RepositoryContext) {
  if (!context?.userId || !context.supabase) throw new CloudRepositoryAuthenticationError("Trusted Supabase context is required");
  return { userId: context.userId, client: context.supabase };
}
