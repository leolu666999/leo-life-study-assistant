export type AuthUserIdentity = {
  id: string;
};

export class AuthenticationRequiredError extends Error {
  readonly status = 401;

  constructor() {
    super("Authentication required");
    this.name = "AuthenticationRequiredError";
  }
}

export class AdminForbiddenError extends Error {
  readonly status = 403;

  constructor() {
    super("Admin access required");
    this.name = "AdminForbiddenError";
  }
}

export class AdminConfigurationError extends Error {
  readonly status = 500;

  constructor() {
    super("ADMIN_USER_ID is not configured with a valid user UUID");
    this.name = "AdminConfigurationError";
  }
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateAdminUserId(adminUserId: string | undefined) {
  const normalized = adminUserId?.trim();
  if (!normalized || !uuidPattern.test(normalized)) throw new AdminConfigurationError();
  return normalized;
}

export function isAdminIdentity(user: AuthUserIdentity | null | undefined, adminUserId: string | undefined) {
  if (!user) return false;
  return user.id === validateAdminUserId(adminUserId);
}

export function assertAdminIdentity(user: AuthUserIdentity | null | undefined, adminUserId: string | undefined) {
  if (!user) throw new AuthenticationRequiredError();
  if (!isAdminIdentity(user, adminUserId)) throw new AdminForbiddenError();
  return { adminUserId: user.id } as const;
}

export async function runAsAdminIdentity<T>(
  user: AuthUserIdentity | null | undefined,
  adminUserId: string | undefined,
  action: (identity: { adminUserId: string }) => Promise<T>
) {
  return action(assertAdminIdentity(user, adminUserId));
}
