import type { ProgressItem, Subtask, Task, TaskProgressEntry } from "@/lib/types";
import type { RepositoryContext, RepositoryResult } from "./repository-context";

export type SubtaskDraftInput = string | { id?: string; title?: string; completed?: boolean };
export type TaskInput = Omit<Partial<Task>, "subtasks"> & { subtasks?: SubtaskDraftInput[] };
export type ProgressEntryInput = {
  amountDelta?: number | null;
  currentValueAfter?: number | null;
  durationMinutes?: number | null;
  note?: string | null;
};

export interface TaskRepository {
  listTasks(options?: { archive?: boolean; includeArchived?: boolean }, context?: RepositoryContext): RepositoryResult<Task[]>;
  getTask(id: string, context?: RepositoryContext): RepositoryResult<Task | null>;
  createTask(input: TaskInput, context?: RepositoryContext): RepositoryResult<Task>;
  updateTask(id: string, input: TaskInput, context?: RepositoryContext): RepositoryResult<Task | null>;
  completeTask(id: string, context?: RepositoryContext): RepositoryResult<Task | null>;
  archiveTask(id: string, context?: RepositoryContext): RepositoryResult<Task | null>;
  restoreTask(id: string, context?: RepositoryContext): RepositoryResult<Task | null>;
  deleteTask(id: string, context?: RepositoryContext): RepositoryResult<number>;
  listProgressEntries(taskId: string, context?: RepositoryContext): RepositoryResult<TaskProgressEntry[]>;
  addProgressEntry(taskId: string, input: ProgressEntryInput, context?: RepositoryContext): RepositoryResult<Task | null>;
  updateSubtaskCompletion(id: string, completed: boolean, context?: RepositoryContext): RepositoryResult<Subtask | null>;
  listProgress(context?: RepositoryContext): RepositoryResult<ProgressItem[]>;
  createProgress(input: Partial<ProgressItem>, context?: RepositoryContext): RepositoryResult<ProgressItem>;
  updateProgress(id: string, input: Partial<ProgressItem>, context?: RepositoryContext): RepositoryResult<ProgressItem | null>;
  pinProgressTask(id: string, context?: RepositoryContext): RepositoryResult<ProgressItem[]>;
}
