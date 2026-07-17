import type { CourseOccurrence } from "@/lib/types";

type SequenceOccurrence = Pick<CourseOccurrence, "id" | "courseId" | "startAt" | "status">;

export function courseOccurrenceSequence(
  target: SequenceOccurrence,
  occurrences: SequenceOccurrence[]
) {
  const series = occurrences
    .filter((occurrence) => occurrence.courseId === target.courseId && occurrence.status !== "cancelled")
    .sort((left, right) => {
      const timeDifference = new Date(left.startAt).getTime() - new Date(right.startAt).getTime();
      return timeDifference || left.id.localeCompare(right.id);
    });
  const index = series.findIndex((occurrence) => occurrence.id === target.id);

  return {
    number: index >= 0 ? index + 1 : null,
    total: series.length
  };
}
