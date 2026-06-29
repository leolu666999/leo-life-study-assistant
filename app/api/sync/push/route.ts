import { NextResponse } from "next/server";
import { createExpense, createJournal, createTask, createTodoList } from "@/lib/db";
import type { TaskType } from "@/lib/types";

export const runtime = "nodejs";

type SyncEntityType = "todoList" | "task" | "deadline" | "expense" | "journal" | "checklist";

type SyncQueueItem = {
  localId: string;
  entityType: SyncEntityType;
  payload: Record<string, unknown>;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const items = Array.isArray(body.items) ? (body.items as SyncQueueItem[]) : [];

  const results = items.map((item) => {
    try {
      const created = createFromSyncItem(item);
      return {
        localId: item.localId,
        serverId: created?.id ?? null,
        status: "synced"
      };
    } catch (error) {
      return {
        localId: item.localId,
        serverId: null,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "同步失败"
      };
    }
  });

  return NextResponse.json({
    ok: results.every((item) => item.status === "synced"),
    syncedAt: new Date().toISOString(),
    results
  });
}

function createFromSyncItem(item: SyncQueueItem) {
  const payload = item.payload ?? {};

  if (item.entityType === "todoList") {
    return createTodoList(payload as Parameters<typeof createTodoList>[0]);
  }

  if (item.entityType === "task" || item.entityType === "deadline" || item.entityType === "checklist") {
    const taskType = resolveTaskType(item.entityType, payload.type);
    return createTask({
      ...(payload as Parameters<typeof createTask>[0]),
      type: taskType
    });
  }

  if (item.entityType === "expense") {
    return createExpense({
      ...(payload as Parameters<typeof createExpense>[0]),
      receiptFileId: typeof payload.receiptFileId === "string" ? payload.receiptFileId : null
    });
  }

  if (item.entityType === "journal") {
    return createJournal({
      ...(payload as Parameters<typeof createJournal>[0]),
      source: payload.source === "daily_plan" ? "daily_plan" : "manual"
    });
  }

  throw new Error(`Unsupported sync entity: ${item.entityType}`);
}

function resolveTaskType(entityType: SyncEntityType, payloadType: unknown): TaskType {
  if (entityType === "deadline") return "deadline";
  if (entityType === "checklist") return "checklist";
  if (payloadType === "deadline" || payloadType === "counter" || payloadType === "checklist" || payloadType === "shopping" || payloadType === "plan_item") {
    return payloadType;
  }
  return "todo";
}
