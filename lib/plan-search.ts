import type { Plan, TodoList } from "@/lib/types";

function normalizeSearchValue(value: string) {
  return value.toLocaleLowerCase().replace(/\s+/g, "").trim();
}

export function planDateSearchAliases(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return [date];

  const [, year, paddedMonth, paddedDay] = match;
  const month = String(Number(paddedMonth));
  const day = String(Number(paddedDay));

  return [
    date,
    `${year}/${paddedMonth}/${paddedDay}`,
    `${year}.${month}.${day}`,
    `${year}/${month}/${day}`,
    `${year}年${month}月${day}日`,
    `${month}月${day}日`,
    `${month}.${day}`,
    `${month}/${day}`,
    `${month}-${day}`,
    `${paddedMonth}.${paddedDay}`,
    `${paddedMonth}/${paddedDay}`
  ];
}

function matchesSearch(query: string, values: Array<string | null | undefined>) {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) return true;
  return values.some((value) => value && normalizeSearchValue(value).includes(normalizedQuery));
}

export function matchesTodoListSearch(todoList: TodoList, query: string) {
  return matchesSearch(query, [
    todoList.title,
    todoList.notes,
    todoList.date,
    ...planDateSearchAliases(todoList.date),
    ...todoList.items.map((item) => item.content)
  ]);
}

export function matchesPlanSearch(plan: Plan, query: string) {
  return matchesSearch(query, [
    plan.title,
    plan.reflectionNote,
    plan.startDate,
    plan.endDate,
    ...planDateSearchAliases(plan.startDate),
    ...planDateSearchAliases(plan.endDate)
  ]);
}
