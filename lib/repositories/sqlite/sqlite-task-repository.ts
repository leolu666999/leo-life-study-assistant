import {
  addProgressEntry,
  createProgress,
  createTask,
  deleteTask,
  getTask,
  listProgress,
  listProgressEntries,
  listTasks,
  pinProgress,
  setSubtaskCompleted,
  setTaskStatus,
  updateProgress,
  updateTask
} from "@/lib/db";
import type { TaskRepository } from "../task-repository";

export const sqliteTaskRepository: TaskRepository = {
  listTasks,
  getTask: (id) => getTask(id),
  createTask: (input) => createTask(input),
  updateTask,
  completeTask: (id) => setTaskStatus(id, "completed"),
  archiveTask: (id) => setTaskStatus(id, "archived"),
  restoreTask: (id) => setTaskStatus(id, "not_started"),
  deleteTask,
  listProgressEntries: (taskId) => listProgressEntries(taskId),
  addProgressEntry,
  updateSubtaskCompletion: setSubtaskCompleted,
  listProgress,
  createProgress,
  updateProgress,
  pinProgressTask: pinProgress
};
