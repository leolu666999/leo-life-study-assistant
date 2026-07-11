export const adminApiRoutes = [
  "/api/admin/users",
  "/api/admin/users/[userId]",
  "/api/admin/users/[userId]/tasks",
  "/api/admin/users/[userId]/todo",
  "/api/admin/users/[userId]/expenses",
  "/api/admin/users/[userId]/journal",
  "/api/admin/users/[userId]/timetable",
  "/api/admin/users/[userId]/files",
  "/api/admin/system/stats"
] as const;

export type AdminApiRoute = (typeof adminApiRoutes)[number];

export type AdminUserSummary = {
  userId: string;
  createdAt: string;
  disabled: boolean;
  lastSignInAt?: string | null;
};

export type AdminSystemStats = {
  totalUsers: number;
  usersCreatedToday: number;
  activeUsers: number;
  apiErrors: number;
  syncFailures: number;
  fileAnomalies: number;
  rowCounts: Record<string, number>;
};

export type AdminAuditInput = {
  adminUserId: string;
  targetUserId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  result: "started" | "succeeded" | "failed";
};

// Phase 2 intentionally defines contracts only. Live /api/admin routes are added with Auth in the next phase.
