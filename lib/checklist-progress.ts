export type ChecklistProgressItem = {
  title: string;
  completed: boolean;
};

export function deriveChecklistProgress(items: ChecklistProgressItem[]) {
  const validItems = items.filter((item) => item.title.trim().length > 0);
  return {
    current: validItems.filter((item) => item.completed).length,
    target: validItems.length,
    unit: "项"
  };
}