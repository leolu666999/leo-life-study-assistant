import "server-only";
import {
  assertAdminIdentity,
  isAdminIdentity,
  runAsAdminIdentity,
  validateAdminUserId,
  type AuthUserIdentity
} from "./admin-core";

function configuredAdminUserId() {
  return validateAdminUserId(process.env.ADMIN_USER_ID);
}

export function isAdmin(user: AuthUserIdentity | null | undefined) {
  return isAdminIdentity(user, configuredAdminUserId());
}

export function assertAdmin(user: AuthUserIdentity | null | undefined) {
  return assertAdminIdentity(user, configuredAdminUserId());
}

export function runAsAdmin<T>(
  user: AuthUserIdentity | null | undefined,
  action: (identity: { adminUserId: string }) => Promise<T>
) {
  return runAsAdminIdentity(user, configuredAdminUserId(), action);
}

export type { AuthUserIdentity };
export { AdminConfigurationError, AdminForbiddenError, AuthenticationRequiredError } from "./admin-core";
