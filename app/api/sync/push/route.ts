import { NextResponse } from "next/server";
import { broadcastDataChange } from "@/lib/realtime";
import type { ExpenseInput } from "@/lib/repositories/finance-repository";
import type { TaskInput } from "@/lib/repositories/task-repository";
import type { TodoListInput } from "@/lib/repositories/todo-repository";
import { getFinanceService } from "@/lib/services/finance-service";
import { getJournalService } from "@/lib/services/journal-service";
import { getTaskService } from "@/lib/services/task-service";
import { getTodoService } from "@/lib/services/todo-service";
import type { TaskType } from "@/lib/types";

export const runtime = "nodejs";

type SyncEntityType = "todoList" | "task" | "deadline" | "expense" | "journal" | "checklist";

type SyncQueueItem = {
  localId: string;
  entityType: SyncEntityType;
  payload: Record<string, unknown>;
};

export async function POST(request: Request) {
  if (process.env.DATA_BACKEND === "supabase") {
    return NextResponse.json({ error: "Cloud offline replay is disabled until idempotent sync operations are implemented." }, { status: 409 });
  }
  const body = await request.json().catch(() => ({}));
  const items = Array.isArray(body.items) ? (body.items as SyncQueueItem[]) : [];

  const results = await Promise.all(items.map(async (item) => {
    try {
      const created = await createFromSyncItem(item);
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
  }));
  if (results.some((item) => item.status === "synced")) {
    broadcastDataChange("sync", "push");
  }

  return NextResponse.json({
    ok: results.every((item) => item.status === "synced"),
    syncedAt: new Date().toISOString(),
    results
  });
}

async function createFromSyncItem(item: SyncQueueItem) {
  const payload = item.payload ?? {};

  if (item.entityType === "todoList") {
    return await getTodoService().createTodoList(payload as TodoListInput);
  }

  if (item.entityType === "task" || item.entityType === "deadline" || item.entityType === "checklist") {
    const taskType = resolveTaskType(item.entityType, payload.type);
    return await getTaskService().createTask({
      ...(payload as TaskInput),
      type: taskType
    });
  }

  if (item.entityType === "expense") {
    return getFinanceService().createExpense({
      ...(payload as ExpenseInput),
      receiptFileId: typeof payload.receiptFileId === "string" ? payload.receiptFileId : null
    });
  }

  if (item.entityType === "journal") {
    return getJournalService().createJournal({
      ...payload,
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
