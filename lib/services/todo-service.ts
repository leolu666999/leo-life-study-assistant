import { getTodoRepository } from "@/lib/repositories";
import type { RepositoryContext } from "@/lib/repositories/repository-context";
import type { TodoListInput } from "@/lib/repositories/todo-repository";

export class TodoService {
  constructor(private readonly repository = getTodoRepository()) {}

  listTodoLists(context?: RepositoryContext) {
    return this.repository.listTodoLists(context);
  }

  getTodoList(id: string, context?: RepositoryContext) {
    return this.repository.getTodoList(id, context);
  }

  createTodoList(input: TodoListInput, context?: RepositoryContext) {
    return this.repository.createTodoList(input, context);
  }

  updateTodoList(id: string, input: TodoListInput, context?: RepositoryContext) {
    return this.repository.updateTodoList(id, input, context);
  }

  updateTodoItemCompletion(id: string, completed: boolean, context?: RepositoryContext) {
    return this.repository.updateTodoItemCompletion(id, completed, context);
  }
}

export function getTodoService() {
  return new TodoService();
}
