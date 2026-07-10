import { createTodoList, getTodoList, listTodoLists, setTodoListItemCompleted, updateTodoList } from "@/lib/db";
import type { TodoRepository } from "../todo-repository";

export const sqliteTodoRepository: TodoRepository = {
  listTodoLists,
  getTodoList: (id) => getTodoList(id),
  createTodoList,
  updateTodoList,
  updateTodoItemCompletion: setTodoListItemCompleted
};
