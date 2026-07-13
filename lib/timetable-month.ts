export function buildTimetableMonthDateKeys(anchorDate: string) {
  const [year, month] = anchorDate.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) return [];

  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const mondayOffset = (firstDay.getUTCDay() + 6) % 7;
  const gridStart = new Date(firstDay);
  gridStart.setUTCDate(firstDay.getUTCDate() - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setUTCDate(gridStart.getUTCDate() + index);
    return day.toISOString().slice(0, 10);
  });
}
