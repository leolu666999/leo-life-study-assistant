export const adminApiRoutes = [
  "/api/admin/users",
  "/api/admin/users/[userId]",
  "/api/admin/users/[userId]/tasks",
  "/api/admin/users/[userId]/todo",
  "/api/admin/users/[userId]/expenses",
  "/api/admin/users/[userId]/journal",
  "/api/admin/users/[userId]/timetable",
  "/api/admin/users/[userId]/files",
  "/api/admin/users/[userId]/data",
  "/api/admin/users/[userId]/files/[fileId]/signed-url",
  "/api/admin/messages",
  "/api/admin/messages/[messageId]",
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

// Cross-user access is implemented only by assertAdmin-protected server routes.
