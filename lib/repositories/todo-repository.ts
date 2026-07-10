import type { TodoList, TodoListItem } from "@/lib/types";
import type { RepositoryContext } from "./repository-context";

export type TodoListInput = Partial<TodoList> & {
  itemDrafts?: Array<{ id?: string; content?: string; title?: string; completed?: boolean }>;
  sourcePlanId?: string | null;
};

export interface TodoRepository {
  listTodoLists(context?: RepositoryContext): TodoList[];
  getTodoList(id: string, context?: RepositoryContext): TodoList | null;
  createTodoList(input: TodoListInput, context?: RepositoryContext): TodoList;
  updateTodoList(id: string, input: TodoListInput, context?: RepositoryContext): TodoList | null;
  updateTodoItemCompletion(id: string, completed: boolean, context?: RepositoryContext): TodoListItem | null;
}
