import type { ProgressItem, Subtask, Task, TaskProgressEntry } from "@/lib/types";
import type { RepositoryContext } from "./repository-context";

export type SubtaskDraftInput = string | { id?: string; title?: string; completed?: boolean };
export type TaskInput = Omit<Partial<Task>, "subtasks"> & { subtasks?: SubtaskDraftInput[] };
export type ProgressEntryInput = {
  amountDelta?: number | null;
  currentValueAfter?: number | null;
  durationMinutes?: number | null;
  note?: string | null;
};

export interface TaskRepository {
  listTasks(options?: { archive?: boolean; includeArchived?: boolean }, context?: RepositoryContext): Task[];
  getTask(id: string, context?: RepositoryContext): Task | null;
  createTask(input: TaskInput, context?: RepositoryContext): Task;
  updateTask(id: string, input: TaskInput, context?: RepositoryContext): Task | null;
  completeTask(id: string, context?: RepositoryContext): Task | null;
  archiveTask(id: string, context?: RepositoryContext): Task | null;
  restoreTask(id: string, context?: RepositoryContext): Task | null;
  deleteTask(id: string, context?: RepositoryContext): number;
  listProgressEntries(taskId: string, context?: RepositoryContext): TaskProgressEntry[];
  addProgressEntry(taskId: string, input: ProgressEntryInput, context?: RepositoryContext): Task | null;
  updateSubtaskCompletion(id: string, completed: boolean, context?: RepositoryContext): Subtask | null;
  listProgress(context?: RepositoryContext): ProgressItem[];
  createProgress(input: Partial<ProgressItem>, context?: RepositoryContext): ProgressItem;
  updateProgress(id: string, input: Partial<ProgressItem>, context?: RepositoryContext): ProgressItem | null;
  pinProgressTask(id: string, context?: RepositoryContext): ProgressItem[];
}
