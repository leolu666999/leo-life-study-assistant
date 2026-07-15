import { getTaskRepository } from "@/lib/repositories";
import { deriveChecklistProgress } from "@/lib/checklist-progress";
import type { RepositoryContext } from "@/lib/repositories/repository-context";
import type { ProgressEntryInput, TaskInput } from "@/lib/repositories/task-repository";
import type { ProgressItem } from "@/lib/types";

export class TaskService {
  constructor(private readonly repository = getTaskRepository()) {}

  listActiveTasks(context?: RepositoryContext) {
    return this.repository.listTasks({}, context);
  }

  listAllTasks(context?: RepositoryContext) {
    return this.repository.listTasks({ includeArchived: true }, context);
  }

  getTask(id: string, context?: RepositoryContext) {
    return this.repository.getTask(id, context);
  }

  createTask(input: TaskInput, context?: RepositoryContext) {
    return this.repository.createTask(normalizeChecklistTaskProgress(input), context);
  }

  updateTask(id: string, input: TaskInput, context?: RepositoryContext) {
    return this.repository.updateTask(id, normalizeChecklistTaskProgress(input), context);
  }

  completeTask(id: string, context?: RepositoryContext) {
    return this.repository.completeTask(id, context);
  }

  archiveTask(id: string, context?: RepositoryContext) {
    return this.repository.archiveTask(id, context);
  }

  restoreTask(id: string, context?: RepositoryContext) {
    return this.repository.restoreTask(id, context);
  }

  deleteTask(id: string, context?: RepositoryContext) {
    return this.repository.deleteTask(id, context);
  }

  listProgressEntries(taskId: string, context?: RepositoryContext) {
    return this.repository.listProgressEntries(taskId, context);
  }

  addProgressEntry(taskId: string, input: ProgressEntryInput, context?: RepositoryContext) {
    return this.repository.addProgressEntry(taskId, input, context);
  }

  updateSubtaskCompletion(id: string, completed: boolean, context?: RepositoryContext) {
    return this.repository.updateSubtaskCompletion(id, completed, context);
  }

  listProgress(context?: RepositoryContext) {
    return this.repository.listProgress(context);
  }

  createProgress(input: Partial<ProgressItem>, context?: RepositoryContext) {
    return this.repository.createProgress(input, context);
  }

  updateProgress(id: string, input: Partial<ProgressItem>, context?: RepositoryContext) {
    return this.repository.updateProgress(id, input, context);
  }

  pinProgressTask(id: string, context?: RepositoryContext) {
    return this.repository.pinProgressTask(id, context);
  }
}

export function getTaskService() {
  return new TaskService();
}

export function normalizeChecklistTaskProgress(input: TaskInput): TaskInput {
  if (input.type !== "checklist" || !input.progressEnabled || input.progressType !== "count" || !input.subtasks) {
    return input;
  }
  const progress = deriveChecklistProgress(input.subtasks.map((item) =>
    typeof item === "string"
      ? { title: item, completed: false }
      : { title: item.title ?? "", completed: Boolean(item.completed) }
  ));
  return {
    ...input,
    progressCurrent: progress.current,
    progressTarget: progress.target,
    progressUnit: progress.unit
  };
}