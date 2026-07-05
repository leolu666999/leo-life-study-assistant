export type TaskType =
  | "todo"
  | "deadline"
  | "counter"
  | "checklist"
  | "shopping"
  | "plan_item";

export type TaskStatus = "not_started" | "in_progress" | "completed" | "archived";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type PlanType = "daily" | "weekly" | "monthly";
export type TaskProgressType = "none" | "count" | "pages" | "percentage" | "time" | "custom" | "custom_unit";
export type ExpenseCurrency = "AUD" | "CNY" | "USD";

export type Task = {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  tags: string[];
  startDate?: string | null;
  dueDate?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  archivedAt?: string | null;
  reminderRule?: string | null;
  progressCurrent?: number | null;
  progressTarget?: number | null;
  progressUnit?: string | null;
  progressEnabled?: boolean;
  progressType?: TaskProgressType;
  pinnedToBottom?: boolean;
  parentPlanId?: string | null;
  originalImageId?: string | null;
  notes?: string | null;
  subtasks?: Subtask[];
  progressEntries?: TaskProgressEntry[];
};

export type TaskProgressEntry = {
  id: string;
  taskId: string;
  createdAt: string;
  amountDelta?: number | null;
  currentValueAfter?: number | null;
  durationMinutes?: number | null;
  note?: string | null;
};

export type Subtask = {
  id: string;
  taskId: string;
  title: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TodoListItem = {
  id: string;
  todoListId: string;
  content: string;
  completed: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type TodoList = {
  id: string;
  title: string;
  date: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  items: TodoListItem[];
};

export type Plan = {
  id: string;
  title: string;
  type: PlanType;
  startDate: string;
  endDate: string;
  reflectionNote?: string | null;
  createdAt: string;
  updatedAt: string;
  items?: Task[];
};

export type ProgressItem = {
  id: string;
  title: string;
  currentValue: number;
  targetValue: number;
  unit: string;
  category: string;
  linkedTaskId?: string | null;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Course = {
  id: string;
  code: string;
  name: string;
  semester: string;
  notes?: string | null;
  sessions: ClassSession[];
  assignments: Assignment[];
};

export type ClassSession = {
  id: string;
  courseId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  type: string;
  location: string;
  notes?: string | null;
};

export type Assignment = {
  id: string;
  courseId: string;
  title: string;
  dueDate: string;
  status: string;
  weight?: number | null;
  notes?: string | null;
  linkedTaskId?: string | null;
};

export type TimetableSourceType = "calendar_feed" | "ics_file" | "screenshot";
export type TimetableSyncStatus = "idle" | "success" | "failed";
export type CourseOccurrenceStatus = "scheduled" | "cancelled" | "completed";

export type TimetableSource = {
  id: string;
  type: TimetableSourceType;
  name: string;
  feedUrl?: string | null;
  semester: string;
  academicYear: number;
  timezone: string;
  lastSyncedAt?: string | null;
  lastSyncStatus: TimetableSyncStatus;
  lastSyncError?: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TimetableCourse = {
  id: string;
  courseCode: string;
  courseName: string;
  activityType: string;
  activityName?: string | null;
  semester: string;
  academicYear: number;
  defaultLocation?: string | null;
  campus?: string | null;
  color: string;
  notes?: string | null;
  sourceType: "manual" | TimetableSourceType;
  sourceId?: string | null;
  externalUid?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CourseOccurrence = {
  id: string;
  courseId: string;
  course?: TimetableCourse;
  startAt: string;
  endAt: string;
  location?: string | null;
  campus?: string | null;
  status: CourseOccurrenceStatus;
  isException: boolean;
  originalStartAt?: string | null;
  sourceUpdatedAt?: string | null;
  localModifiedAt?: string | null;
  localModifiedFields?: string[];
  notes?: string | null;
  sourceType?: "manual" | TimetableSourceType;
  sourceId?: string | null;
  externalUid?: string | null;
  occurrenceStart?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TimetableImportPreview = {
  source: {
    type: TimetableSourceType;
    name: string;
    feedUrl?: string | null;
    semester: string;
    academicYear: number;
    timezone: string;
  };
  summary: {
    courseCount: number;
    occurrenceCount: number;
    semesterStart?: string | null;
    semesterEnd?: string | null;
    duplicateCount: number;
    conflictCount: number;
    unrecognizedFields: string[];
  };
  courses: TimetableCourse[];
  occurrences: CourseOccurrence[];
};

export type JournalEntry = {
  id: string;
  date: string;
  source: "daily_plan" | "manual";
  content: string;
  linkedPlanId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Expense = {
  id: string;
  title: string;
  amount: number;
  currency: ExpenseCurrency;
  category: string;
  date: string;
  merchant?: string | null;
  paymentMethod?: string | null;
  notes?: string | null;
  receiptFileId?: string | null;
  receiptOriginalName?: string | null;
  receiptMimeType?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ImportantFile = {
  id: string;
  title: string;
  category: string;
  tags: string[];
  notes?: string | null;
  fileId: string;
  originalName: string;
  mimeType: string;
  size: number;
  expiryDate?: string | null;
  createdAt: string;
  updatedAt: string;
};
