import type { TodoList, TodoListItem } from "@/lib/types";
import type { RepositoryContext, RepositoryResult } from "./repository-context";

export type TodoListInput = Partial<TodoList> & {
  itemDrafts?: Array<{ id?: string; content?: string; title?: string; completed?: boolean }>;
  sourcePlanId?: string | null;
};

export interface TodoRepository {
  listTodoLists(context?: RepositoryContext): RepositoryResult<TodoList[]>;
  getTodoList(id: string, context?: RepositoryContext): RepositoryResult<TodoList | null>;
  createTodoList(input: TodoListInput, context?: RepositoryContext): RepositoryResult<TodoList>;
  updateTodoList(id: string, input: TodoListInput, context?: RepositoryContext): RepositoryResult<TodoList | null>;
  updateTodoItemCompletion(id: string, completed: boolean, context?: RepositoryContext): RepositoryResult<TodoListItem | null>;
}
