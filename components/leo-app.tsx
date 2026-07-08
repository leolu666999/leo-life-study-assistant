"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  CirclePlus,
  CreditCard,
  Download,
  Eye,
  FileText,
  Home,
  ImageIcon,
  ListChecks,
  Menu,
  NotebookPen,
  PanelLeft,
  Plus,
  RotateCcw,
  Search,
  Settings,
  SlidersHorizontal,
  Trash2,
  Upload,
  WalletCards,
  X
} from "lucide-react";
import type {
  Course,
  CourseOccurrence,
  Expense,
  ImportantFile,
  JournalEntry,
  Plan,
  ProgressItem,
  Task,
  TaskType,
  TimetableCourse,
  TimetableImportPreview,
  TimetableSource,
  TodoList,
  TodoListItem
} from "@/lib/types";

type View = "dashboard" | "expenses" | "files" | "tasks" | "plans" | "courses" | "journal" | "archive" | "settings";
type ModalMode = "task" | "deadline" | "plan" | "todoList" | "counter" | "expense" | null;
type ReminderRule =
  | { type: "none" }
  | { type: "deadline_24h" }
  | { type: "daily_until_due" }
  | { type: "hourly_until_due" }
  | {
      type: "custom";
      mode: "hourly" | "daily" | "progress" | "before_due";
      frequencyHours?: number;
      maxCount?: number;
      progressPercent?: number;
      beforeAmount?: number;
      beforeUnit?: "minutes" | "hours" | "days";
    };
type ReminderAlert = {
  task: Task;
  key: string;
  title: string;
  detail: string;
};
type TodoDraftItem = { id: string; title: string; completed: boolean };
type TodoListEditItem = { id?: string; content: string; completed: boolean };
type SyncConnection = "checking" | "online" | "offline";
type SaveStatus = "idle" | "saving" | "saved" | "offline_saved" | "syncing" | "sync_failed";
type OfflineEntityType = "todoList" | "task" | "deadline" | "expense" | "journal" | "checklist";
type OfflineQueueItem = {
  localId: string;
  entityType: OfflineEntityType;
  payload: Record<string, unknown>;
  syncStatus: "pending" | "syncing" | "synced" | "failed";
  createdAt: string;
  updatedAt: string;
  lastSyncAttemptAt?: string;
  errorMessage?: string;
  deviceId: string;
};
type SyncState = {
  connection: SyncConnection;
  saveStatus: SaveStatus;
  pendingCount: number;
  failedCount: number;
  lastSyncAt?: string;
  message: string;
};
type SaveRequest = (url: string, options?: RequestInit) => Promise<Response | void>;

const navItems: Array<{ view: View; href: string; label: string; icon: React.ReactNode }> = [
  { view: "dashboard", href: "/", label: "首页", icon: <Home size={18} /> },
  { view: "tasks", href: "/tasks", label: "任务", icon: <ListChecks size={18} /> },
  { view: "plans", href: "/plans", label: "计划", icon: <CalendarDays size={18} /> },
  { view: "courses", href: "/courses", label: "课程（维修中）", icon: <BookOpen size={18} /> },
  { view: "journal", href: "/journal", label: "日记", icon: <NotebookPen size={18} /> },
  { view: "expenses", href: "/expenses", label: "记账", icon: <WalletCards size={18} /> },
  { view: "files", href: "/files", label: "文件", icon: <FileText size={18} /> },
  { view: "settings", href: "/settings", label: "设置", icon: <Settings size={18} /> }
];

function viewFromPath(pathname: string): View {
  if (pathname === "/archive") return "tasks";
  if (pathname === "/progress" || pathname === "/progresses" || pathname === "/goals") return "tasks";
  return navItems.find((item) => item.href === pathname)?.view || "dashboard";
}

function useEscapeClose(onClose: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [enabled, onClose]);
}

const typeLabels: Record<TaskType, string> = {
  todo: "待办",
  deadline: "截止",
  counter: "计数",
  checklist: "清单",
  shopping: "清单",
  plan_item: "计划项"
};

const expenseCategories = ["吃饭", "超市", "交通", "足球", "大学", "房租", "手机/网络", "购物", "娱乐", "健康", "旅行", "其他"];
const importantFileCategories = ["证件", "签证", "学校", "住宿", "保险", "交通", "银行", "电话卡", "课程", "生活", "其他"];
const paymentMethods = ["现金", "银行卡", "Apple Pay", "微信支付", "支付宝", "银行转账", "其他"];
const offlineDbName = "leo-life-study-offline";
const offlineStoreName = "queue";

function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  if (process.env.NODE_ENV !== "production") {
    navigator.serviceWorker.getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .catch((error) => console.warn("Service worker cleanup failed", error));

    if ("caches" in window) {
      caches.keys()
        .then((keys) => Promise.all(keys.filter((key) => key.startsWith("leo-life-study-assistant")).map((key) => caches.delete(key))))
        .catch((error) => console.warn("Cache cleanup failed", error));
    }
    return;
  }

  navigator.serviceWorker.register("/sw.js").then((registration) => registration.update()).catch((error) => {
    console.warn("Service worker registration failed", error);
  });
}

function getDeviceId() {
  if (typeof window === "undefined") return "server";
  const existing = localStorage.getItem("leo-device-id");
  if (existing) return existing;
  const next = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem("leo-device-id", next);
  return next;
}

function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("当前浏览器不支持离线队列"));
      return;
    }
    const request = indexedDB.open(offlineDbName, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(offlineStoreName)) {
        db.createObjectStore(offlineStoreName, { keyPath: "localId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("打开离线队列失败"));
  });
}

function withOfflineStore<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openOfflineDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(offlineStoreName, mode);
        const request = action(transaction.objectStore(offlineStoreName));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("离线队列操作失败"));
        transaction.oncomplete = () => db.close();
        transaction.onerror = () => {
          db.close();
          reject(transaction.error ?? new Error("离线队列事务失败"));
        };
      })
  );
}

async function listOfflineQueueItems() {
  return (await withOfflineStore<OfflineQueueItem[]>("readonly", (store) => store.getAll())) ?? [];
}

async function queueOfflineMutation(entityType: OfflineEntityType, payload: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const item: OfflineQueueItem = {
    localId: typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    entityType,
    payload,
    syncStatus: "pending",
    createdAt: timestamp,
    updatedAt: timestamp,
    deviceId: getDeviceId()
  };
  await withOfflineStore("readwrite", (store) => store.put(item));
  return item;
}

async function updateOfflineQueueItem(localId: string, patch: Partial<OfflineQueueItem>) {
  const items = await listOfflineQueueItems();
  const existing = items.find((item) => item.localId === localId);
  if (!existing) return;
  await withOfflineStore("readwrite", (store) =>
    store.put({ ...existing, ...patch, updatedAt: new Date().toISOString() })
  );
}

async function clearSyncedOfflineItems() {
  const items = await listOfflineQueueItems();
  await Promise.all(
    items
      .filter((item) => item.syncStatus === "synced")
      .map((item) => withOfflineStore("readwrite", (store) => store.delete(item.localId)))
  );
}

function parseRequestBody(options: RequestInit = {}) {
  if (!options.body || typeof options.body !== "string") return null;
  try {
    const parsed = JSON.parse(options.body);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function offlineEntityForRequest(url: string, options: RequestInit = {}) {
  const method = String(options.method || "GET").toUpperCase();
  if (method !== "POST") return null;
  const payload = parseRequestBody(options);
  if (!payload) return null;
  if (url === "/api/todo-lists") return { entityType: "todoList" as OfflineEntityType, payload };
  if (url === "/api/expenses") return { entityType: "expense" as OfflineEntityType, payload };
  if (url === "/api/journal") return { entityType: "journal" as OfflineEntityType, payload };
  if (url === "/api/tasks") {
    const type = payload.type === "deadline" ? "deadline" : payload.type === "checklist" ? "checklist" : "task";
    return { entityType: type as OfflineEntityType, payload };
  }
  return null;
}

function jsonHeaders(options: RequestInit = {}) {
  if (options.body instanceof FormData) return options.headers;
  return {
    "content-type": "application/json",
    ...(options.headers || {})
  };
}

export function LeoApp({ initialView }: { initialView: View }) {
  const [activeView, setActiveView] = useState<View>(initialView);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [archiveTasks, setArchiveTasks] = useState<Task[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [todoLists, setTodoLists] = useState<TodoList[]>([]);
  const [progress, setProgress] = useState<ProgressItem[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [importantFiles, setImportantFiles] = useState<ImportantFile[]>([]);
  const [modal, setModal] = useState<ModalMode>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [background, setBackground] = useState("default");
  const [loading, setLoading] = useState(true);
  const [dismissedReminderKeys, setDismissedReminderKeys] = useState<string[]>([]);
  const [syncState, setSyncState] = useState<SyncState>({
    connection: "checking",
    saveStatus: "idle",
    pendingCount: 0,
    failedCount: 0,
    lastSyncAt: undefined,
    message: "正在检查电脑连接..."
  });
  const syncLockRef = useRef(false);
  const lastAutoSyncFailedAtRef = useRef(0);
  const lastRealtimeRefreshAtRef = useRef(0);

  useEffect(() => {
    setActiveView(initialView);
  }, [initialView]);

  useEffect(() => {
    const handlePopState = () => {
      setActiveView(viewFromPath(window.location.pathname));
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    setCollapsed(localStorage.getItem("leo-sidebar-collapsed") === "1");
    const savedBackground = localStorage.getItem("leo-background");
    const backgroundWasChosen = localStorage.getItem("leo-background-user-set") === "1";
    setBackground(savedBackground && (savedBackground !== "usyd" || backgroundWasChosen) ? savedBackground : "default");
    setDismissedReminderKeys(JSON.parse(localStorage.getItem("leo-dismissed-reminders") || "[]"));
    registerServiceWorker();
    setSyncState((current) => ({
      ...current,
      lastSyncAt: localStorage.getItem("leo-last-sync-at") || undefined
    }));
    void loadAll();
    void checkHealth(false);
    void refreshOfflineCounts();
  }, []);

  useEffect(() => {
    function handleOnlineSignal() {
      void checkHealth(true).then(() => syncPendingToComputer({ silent: true }));
    }
    function handleFocusSignal() {
      void checkHealth(true).then(() => syncPendingToComputer({ silent: true }));
    }
    function handleVisibilitySignal() {
      if (document.visibilityState === "visible") handleFocusSignal();
    }

    window.addEventListener("online", handleOnlineSignal);
    window.addEventListener("focus", handleFocusSignal);
    document.addEventListener("visibilitychange", handleVisibilitySignal);
    const healthTimer = window.setInterval(() => void checkHealth(true), 30000);
    const syncTimer = window.setInterval(() => void syncPendingToComputer({ silent: true }), 45000);

    return () => {
      window.removeEventListener("online", handleOnlineSignal);
      window.removeEventListener("focus", handleFocusSignal);
      document.removeEventListener("visibilitychange", handleVisibilitySignal);
      window.clearInterval(healthTimer);
      window.clearInterval(syncTimer);
    };
  }, []);

  useEffect(() => {
    if (typeof EventSource === "undefined") return;

    const events = new EventSource("/api/events");
    events.addEventListener("connected", () => {
      setSyncState((current) => ({
        ...current,
        connection: "online",
        message: current.pendingCount > 0 ? "已连接电脑，有待同步内容。" : "已连接电脑。"
      }));
    });
    events.addEventListener("data-change", () => {
      const nowTime = Date.now();
      if (nowTime - lastRealtimeRefreshAtRef.current < 250) return;
      lastRealtimeRefreshAtRef.current = nowTime;
      void loadAll(false);
    });
    events.onerror = () => {
      setSyncState((current) => ({
        ...current,
        connection: current.connection === "offline" ? "offline" : "checking",
        message: "正在恢复实时连接..."
      }));
    };

    return () => events.close();
  }, []);

  useEffect(() => {
    localStorage.setItem("leo-sidebar-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    localStorage.setItem("leo-background", background);
  }, [background]);

  function chooseBackground(value: string) {
    localStorage.setItem("leo-background-user-set", "1");
    setBackground(value);
  }

  async function loadAll(showLoading = true) {
    if (showLoading) setLoading(true);
    const [taskData, archiveData, planData, todoListData, progressData, courseData, journalData, expenseData, importantFileData] = await Promise.all([
      fetchJsonOr<Task[]>("/api/tasks", []),
      fetchJsonOr<Task[]>("/api/archive", []),
      fetchJsonOr<Plan[]>("/api/plans", []),
      fetchJsonOr<TodoList[]>("/api/todo-lists", []),
      fetchJsonOr<ProgressItem[]>("/api/progress", []),
      fetchJsonOr<Course[]>("/api/courses", []),
      fetchJsonOr<JournalEntry[]>("/api/journal", []),
      fetchJsonOr<Expense[]>("/api/expenses", []),
      fetchJsonOr<ImportantFile[]>("/api/important-files", [])
    ]);
    setTasks(taskData);
    setArchiveTasks(archiveData);
    setPlans(planData);
    setTodoLists(todoListData);
    setProgress(progressData);
    setCourses(courseData);
    setJournal(journalData);
    setExpenses(expenseData);
    setImportantFiles(importantFileData);
    if (showLoading) setLoading(false);
  }

  function navigateItem(item: (typeof navItems)[number]) {
    setActiveView(item.view);
    window.history.pushState(null, "", item.href);
  }

  function navigateView(event: React.MouseEvent<HTMLAnchorElement>, item: (typeof navItems)[number]) {
    event.preventDefault();
    navigateItem(item);
  }

  async function refreshOfflineCounts() {
    try {
      const items = await listOfflineQueueItems();
      setSyncState((current) => ({
        ...current,
        pendingCount: items.filter((item) => item.syncStatus === "pending" || item.syncStatus === "syncing").length,
        failedCount: items.filter((item) => item.syncStatus === "failed").length
      }));
    } catch (error) {
      console.warn("Offline queue count failed", error);
    }
  }

  async function checkHealth(silent = true) {
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      if (!response.ok) throw new Error("Health check failed");
      setSyncState((current) => ({
        ...current,
        connection: "online",
        message: current.pendingCount > 0 ? "已连接电脑，有待同步内容。" : "已连接电脑。"
      }));
      return true;
    } catch {
      setSyncState((current) => ({
        ...current,
        connection: "offline",
        message: silent ? current.message : "当前连不上电脑端服务，新增内容会先暂存在手机。"
      }));
      return false;
    } finally {
      await refreshOfflineCounts();
    }
  }

  async function syncPendingToComputer({ silent = false }: { silent?: boolean } = {}) {
    if (syncLockRef.current) return;
    const nowTime = Date.now();
    if (silent && lastAutoSyncFailedAtRef.current && nowTime - lastAutoSyncFailedAtRef.current < 60000) return;

    syncLockRef.current = true;
    try {
      const allItems = await listOfflineQueueItems();
      const pendingItems = allItems.filter((item) => item.syncStatus === "pending" || item.syncStatus === "failed");
      if (pendingItems.length === 0) {
        await refreshOfflineCounts();
        return;
      }

      setSyncState((current) => ({
        ...current,
        connection: current.connection === "offline" ? "checking" : current.connection,
        saveStatus: "syncing",
        message: "正在把手机暂存内容同步到电脑..."
      }));

      await Promise.all(
        pendingItems.map((item) =>
          updateOfflineQueueItem(item.localId, {
            syncStatus: "syncing",
            lastSyncAttemptAt: new Date().toISOString(),
            errorMessage: undefined
          })
        )
      );

      const response = await fetch("/api/sync/push", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          deviceId: getDeviceId(),
          items: pendingItems
        })
      });
      if (!response.ok) throw new Error("Sync request failed");
      const data = await response.json();
      const results = Array.isArray(data.results) ? data.results : [];
      await Promise.all(
        results.map((result: { localId?: string; status?: string; errorMessage?: string }) =>
          result.localId
            ? updateOfflineQueueItem(result.localId, {
                syncStatus: result.status === "synced" ? "synced" : "failed",
                errorMessage: result.status === "synced" ? undefined : result.errorMessage || "同步失败"
              })
            : Promise.resolve()
        )
      );
      await clearSyncedOfflineItems();
      const syncedAt = new Date().toISOString();
      localStorage.setItem("leo-last-sync-at", syncedAt);
      setSyncState((current) => ({
        ...current,
        connection: "online",
        saveStatus: "saved",
        lastSyncAt: syncedAt,
        message: "手机暂存内容已同步到电脑。"
      }));
      await refreshOfflineCounts();
      await loadAll(false);
    } catch (error) {
      lastAutoSyncFailedAtRef.current = Date.now();
      setSyncState((current) => ({
        ...current,
        connection: "offline",
        saveStatus: "sync_failed",
        message: silent ? "暂时同步不了，稍后会自动重试。" : error instanceof Error ? error.message : "同步失败，稍后会自动重试。"
      }));
      await refreshOfflineCounts();
    } finally {
      syncLockRef.current = false;
    }
  }

  async function saveRequest(url: string, options: RequestInit = {}) {
    const offlineMutation = offlineEntityForRequest(url, options);
    setSyncState((current) => ({
      ...current,
      saveStatus: "saving",
      message: "正在保存..."
    }));

    try {
      const response = await fetch(url, {
        ...options,
        headers: jsonHeaders(options)
      });
      if (!response.ok) throw new Error(`Request failed: ${url}`);
      setSyncState((current) => ({
        ...current,
        connection: "online",
        saveStatus: "saved",
        message: "已保存到电脑。"
      }));
      await loadAll(false);
      await refreshOfflineCounts();
      return response;
    } catch (error) {
      if (!offlineMutation) {
        setSyncState((current) => ({
          ...current,
          connection: "offline",
          saveStatus: "sync_failed",
          message: error instanceof Error ? error.message : "保存失败"
        }));
        throw error;
      }

      await queueOfflineMutation(offlineMutation.entityType, offlineMutation.payload);
      setSyncState((current) => ({
        ...current,
        connection: "offline",
        saveStatus: "offline_saved",
        message: "当前连不上电脑，已先存到手机，恢复连接后会同步。"
      }));
      await refreshOfflineCounts();
      return undefined;
    }
  }

  async function mutate(url: string, options: RequestInit = {}) {
    await saveRequest(url, options);
  }

  async function toggleTodoItem(id: string, completed: boolean) {
    const previousTodoLists = todoLists;
    setTodoLists((currentLists) =>
      currentLists.map((list) => ({
        ...list,
        items: list.items.map((item) => (item.id === id ? { ...item, completed } : item))
      }))
    );

    const response = await fetch(`/api/todo-list-items/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ completed })
    });

    if (!response.ok) {
      setTodoLists(previousTodoLists);
      throw new Error("To Do List item update failed");
    }

    await loadAll(false);
  }

  async function toggleTaskSubtask(taskId: string, subtaskId: string, completed: boolean) {
    const previousTasks = tasks;
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              subtasks: task.subtasks?.map((subtask) =>
                subtask.id === subtaskId ? { ...subtask, completed } : subtask
              )
            }
          : task
      )
    );

    const response = await fetch(`/api/subtasks/${subtaskId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ completed })
    });

    if (!response.ok) {
      setTasks(previousTasks);
      throw new Error("Checklist item update failed");
    }

    await loadAll(false);
  }

  async function completeTaskSmooth(id: string) {
    const previousTasks = tasks;
    const previousArchiveTasks = archiveTasks;
    const completedTask = tasks.find((task) => task.id === id);

    setTasks((currentTasks) => currentTasks.filter((task) => task.id !== id));
    if (completedTask) {
      const completedAt = new Date().toISOString();
      setArchiveTasks((currentTasks) => [
        { ...completedTask, status: "completed", completedAt, archivedAt: completedAt },
        ...currentTasks
      ]);
    }

    const response = await fetch(`/api/tasks/${id}/complete`, { method: "POST" });
    if (!response.ok) {
      setTasks(previousTasks);
      setArchiveTasks(previousArchiveTasks);
      throw new Error("Task completion failed");
    }

    await loadAll(false);
  }

  async function updateTaskProgressSmooth(taskId: string, nextValue: number) {
    const previousTasks = tasks;
    const previousProgress = progress;
    const safeValue = Math.max(0, nextValue);
    const task = tasks.find((item) => item.id === taskId);

    setTasks((currentTasks) =>
      currentTasks.map((item) =>
        item.id === taskId
          ? {
              ...item,
              progressEnabled: true,
              progressCurrent: safeValue,
              status: item.status === "not_started" ? "in_progress" : item.status
            }
          : item
      )
    );
    setProgress((currentProgress) =>
      currentProgress.map((item) =>
        item.id === taskId || item.linkedTaskId === taskId ? { ...item, currentValue: safeValue } : item
      )
    );

    const response = await fetch(`/api/tasks/${taskId}/progress-entries`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        currentValueAfter: safeValue
      })
    });

    if (!response.ok) {
      setTasks(previousTasks);
      setProgress(previousProgress);
      throw new Error("Task progress update failed");
    }

    await loadAll(false);
  }

  const pinnedProgress = progress.find((item) => item.pinned) || progress[0];
  const reminderAlerts = useMemo(
    () => buildReminderAlerts(tasks, dismissedReminderKeys),
    [tasks, dismissedReminderKeys]
  );
  const todayCourses = useMemo(() => {
    const day = new Date().getDay();
    return courses.flatMap((course) =>
      course.sessions
        .filter((session) => session.dayOfWeek === day)
        .map((session) => ({ ...session, course }))
    );
  }, [courses]);
  const expenseTotals = useMemo(() => summarizeExpenses(expenses), [expenses]);

  return (
    <div className={`theme-${background} min-h-screen w-full max-w-full overflow-x-hidden pb-36 text-slate-900 ${pinnedProgress ? "pt-24 md:pt-0" : ""}`}>
      <div className="flex min-h-screen w-full max-w-full overflow-x-hidden">
        <aside
          className={`sticky top-0 hidden h-screen shrink-0 border-r border-slate-200/80 bg-white/80 px-3 py-4 shadow-sm backdrop-blur transition-all duration-200 ease-out md:block ${
            collapsed ? "w-[76px]" : "w-64"
          }`}
        >
          <div className="relative mb-5 min-h-[56px]">
            {!collapsed && (
              <div className="min-w-0 pr-14 pt-3 transition-opacity duration-150">
                <div className="text-lg font-semibold">Leo的生活学习助手</div>
              </div>
            )}
            <div className={`absolute top-0 ${collapsed ? "left-1/2 -translate-x-1/2" : "right-0"} rounded-[22px] bg-white p-1 shadow-[0_8px_28px_rgba(15,23,42,0.10)] ring-1 ring-slate-200/60 transition-all duration-200`}>
              <button
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
                onClick={() => setCollapsed((value) => !value)}
                title={collapsed ? "展开侧边栏" : "折叠侧边栏"}
                aria-label={collapsed ? "展开侧边栏" : "折叠侧边栏"}
              >
                <PanelLeft size={24} strokeWidth={1.75} />
              </button>
            </div>
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.view}
                href={item.href}
                onClick={(event) => navigateView(event, item)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  activeView === item.view ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
                title={collapsed ? item.label : undefined}
              >
                {item.icon}
                {!collapsed && <span className="transition-opacity duration-150">{item.label}</span>}
              </Link>
            ))}
          </nav>
          {!collapsed && (
            <Link href="/expenses" className="mt-4 block rounded-lg border border-slate-100 bg-white p-3 shadow-sm transition hover:border-slate-200 hover:shadow-soft">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold">消费记录</span>
                <WalletCards size={16} className="text-slate-400" />
              </div>
              <div className="text-xs text-slate-500">今日</div>
              <div className="text-lg font-semibold">{formatExpenseTotals(expenseTotals.today)}</div>
              <div className="mt-2 truncate text-xs text-slate-500">本月 {formatExpenseTotals(expenseTotals.month)}</div>
            </Link>
          )}
        </aside>

        <main className="mx-auto w-full max-w-full overflow-x-hidden px-3 py-4 md:max-w-7xl md:px-6 md:py-6">
          {loading ? (
            <div className="rounded-lg bg-white p-6 shadow-soft">正在加载 Leo 的本地数据...</div>
          ) : (
            <>
              {activeView === "dashboard" && (
                <Dashboard
                  tasks={tasks}
                  archiveTasks={archiveTasks}
                  todoLists={todoLists}
                  todayCourses={todayCourses}
                  plans={plans}
                  onOpenModal={setModal}
                  onComplete={completeTaskSmooth}
                  onToggleTodoItem={toggleTodoItem}
                  onToggleSubtask={toggleTaskSubtask}
                  onEdit={(task) => {
                    setEditingTask(task);
                    setModal("task");
                  }}
                  onSave={mutate}
                  onProgressUpdate={updateTaskProgressSmooth}
                />
              )}
              {activeView === "tasks" && (
                <TasksPage
                  tasks={mergeAllTasks(tasks, archiveTasks)}
                  onOpenModal={setModal}
                  onComplete={completeTaskSmooth}
                  onRestore={(id) => mutate(`/api/tasks/${id}/restore`, { method: "POST" })}
                  onEdit={(task) => {
                    setEditingTask(task);
                    setModal("task");
                  }}
                  onSave={mutate}
                  onDelete={async (id) => {
                    if (confirm("确定永久删除这条任务吗？")) await mutate(`/api/tasks/${id}`, { method: "DELETE" });
                  }}
                  onProgressUpdate={updateTaskProgressSmooth}
                  onToggleSubtask={toggleTaskSubtask}
                />
              )}
              {activeView === "expenses" && (
                <ExpensesPage
                  expenses={expenses}
                  onOpenModal={() => {
                    setEditingExpense(null);
                    setModal("expense");
                  }}
                  onEdit={(expense) => {
                    setEditingExpense(expense);
                    setModal("expense");
                  }}
                  onSave={mutate}
                />
              )}
              {activeView === "files" && <ImportantFilesPage files={importantFiles} onSave={mutate} />}
              {activeView === "plans" && (
                <PlansPage
                  plans={plans}
                  todoLists={todoLists}
                  onOpenModal={setModal}
                  onSave={mutate}
                  onToggleTodoItem={toggleTodoItem}
                />
              )}
              {activeView === "courses" && <CoursesPage courses={courses} />}
              {activeView === "journal" && <JournalPage journal={journal} onSave={mutate} />}
              {activeView === "settings" && (
                <SettingsPage
                  background={background}
                  setBackground={chooseBackground}
                  onUploaded={() => loadAll(false)}
                  syncState={syncState}
                  onManualSync={() => syncPendingToComputer({ silent: false })}
                  onCheckSync={() => checkHealth(false)}
                />
              )}
            </>
          )}
        </main>
      </div>

      <ReminderStack
        alerts={reminderAlerts}
        onDismiss={(key) => {
          setDismissedReminderKeys((current) => {
            const next = [...new Set([...current, key])].slice(-200);
            localStorage.setItem("leo-dismissed-reminders", JSON.stringify(next));
            return next;
          });
        }}
      />

      <MobileNav activeView={activeView} onSelect={navigateItem} />

      <MobileSyncStatus state={syncState} onSync={() => syncPendingToComputer({ silent: false })} />

      {pinnedProgress && (
        <PinnedProgress
          item={pinnedProgress}
          items={progress}
          open={progressOpen}
          setOpen={setProgressOpen}
          onPin={(id) => mutate(`/api/progress/${id}/pin`, { method: "POST" })}
          onOpenTask={() => {
            setProgressOpen(false);
            setActiveView("tasks");
            window.history.pushState(null, "", "/tasks?filter=progress");
          }}
        />
      )}

      {modal && (
        <QuickModal
          mode={modal}
          task={editingTask}
          expense={editingExpense}
          tasks={tasks}
          onClose={() => {
            setModal(null);
            setEditingTask(null);
            setEditingExpense(null);
          }}
          onCreated={() => loadAll(false)}
          onSaveRequest={saveRequest}
        />
      )}
    </div>
  );
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Request failed: ${url}`);
  return response.json();
}

async function fetchJsonOr<T>(url: string, fallback: T): Promise<T> {
  try {
    return await fetchJson<T>(url);
  } catch (error) {
    console.warn(`Load failed: ${url}`, error);
    return fallback;
  }
}

function SyncStatusPill({ state }: { state: SyncState }) {
  const tone =
    state.connection === "online" && state.pendingCount === 0 && state.failedCount === 0
      ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
      : state.saveStatus === "offline_saved" || state.pendingCount > 0
        ? "bg-amber-50 text-amber-700 ring-amber-100"
        : state.connection === "offline" || state.failedCount > 0
          ? "bg-red-50 text-red-700 ring-red-100"
          : "bg-slate-50 text-slate-600 ring-slate-100";
  const label =
    state.connection === "online" && state.pendingCount === 0 && state.failedCount === 0
      ? "电脑已连接"
      : state.pendingCount > 0
        ? `${state.pendingCount} 条待同步`
        : state.failedCount > 0
          ? `${state.failedCount} 条需重试`
          : state.connection === "offline"
            ? "离线暂存"
            : "检查中";

  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${tone}`}>{label}</span>;
}

function MobileSyncStatus({ state, onSync }: { state: SyncState; onSync: () => void }) {
  const shouldShow =
    state.connection !== "online" ||
    state.pendingCount > 0 ||
    state.failedCount > 0 ||
    state.saveStatus === "saving" ||
    state.saveStatus === "syncing" ||
    state.saveStatus === "offline_saved";

  if (!shouldShow) return null;

  return (
    <button
      type="button"
      className="fixed right-3 top-[calc(env(safe-area-inset-top)+5.2rem)] z-40 rounded-full border border-slate-200 bg-white/95 px-3 py-2 text-xs font-medium text-slate-700 shadow-soft backdrop-blur md:hidden"
      onClick={onSync}
      title="同步手机暂存内容"
    >
      {state.saveStatus === "syncing" ? "同步中..." : state.pendingCount > 0 ? `${state.pendingCount} 条待同步` : state.message}
    </button>
  );
}

function PageHeader({
  title,
  subtitle,
  actions,
  onTitleDoubleClick
}: {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  onTitleDoubleClick?: () => void;
}) {
  return (
    <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-end">
      <div>
        <h1
          className={`text-2xl font-semibold tracking-normal md:text-3xl ${onTitleDoubleClick ? "cursor-default select-none" : ""}`}
          onDoubleClick={onTitleDoubleClick}
        >
          {title}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>
      {actions && <div className="flex w-full flex-wrap gap-2 md:w-auto md:justify-end">{actions}</div>}
    </div>
  );
}

function Dashboard({
  tasks,
  archiveTasks,
  todoLists,
  todayCourses,
  plans,
  onOpenModal,
  onComplete,
  onToggleTodoItem,
  onToggleSubtask,
  onEdit,
  onSave,
  onProgressUpdate
}: {
  tasks: Task[];
  archiveTasks: Task[];
  todoLists: TodoList[];
  todayCourses: Array<{ id: string; startTime: string; endTime: string; type: string; location: string; course: Course }>;
  plans: Plan[];
  onOpenModal: (mode: ModalMode) => void;
  onComplete: (id: string) => void;
  onToggleTodoItem: (id: string, completed: boolean) => void;
  onToggleSubtask: (taskId: string, subtaskId: string, completed: boolean) => void;
  onEdit: (task: Task) => void;
  onSave: (url: string, options?: RequestInit) => Promise<void>;
  onProgressUpdate: (taskId: string, nextValue: number) => Promise<void>;
}) {
  const today = new Date();
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [taskFilterOpen, setTaskFilterOpen] = useState(false);
  const [taskFilterDueBeforeDraft, setTaskFilterDueBeforeDraft] = useState("");
  const [taskFilterTagDraft, setTaskFilterTagDraft] = useState("");
  const [taskFilterDueBefore, setTaskFilterDueBefore] = useState("");
  const [taskFilterTag, setTaskFilterTag] = useState("");
  const [overviewOpen, setOverviewOpen] = useState(false);
  const taskFilterAreaRef = useRef<HTMLDivElement>(null);
  const todoPreviewItems = buildTodayTodoPreviewItems(todoLists);
  const todayOverview = buildTodayOverview(todoPreviewItems, tasks, todayCourses);
  const reminders = buildPlanReminders(plans, currentTime);
  const dashboardTasks = mergeDashboardTasks(tasks, archiveTasks.filter((task) => task.status === "completed"));
  const filteredDashboardTasks = dashboardTasks.filter((task) => {
    if (taskFilterDueBefore) {
      if (!task.dueDate) return false;
      const dueTime = new Date(task.dueDate).getTime();
      const filterTime = new Date(taskFilterDueBefore).getTime();
      if (Number.isFinite(filterTime) && dueTime > filterTime) return false;
    }
    if (taskFilterTag.trim()) {
      const tagQuery = taskFilterTag.trim().toLowerCase();
      if (!task.tags.some((tag) => tag.toLowerCase().includes(tagQuery))) return false;
    }
    return true;
  });

  useEffect(() => {
    const key = `leo-today-overview-dismissed-${localDateKey(today)}`;
    const sessionKey = `leo-today-overview-auto-shown-${localDateKey(today)}`;
    if (localStorage.getItem(key) !== "1" && sessionStorage.getItem(sessionKey) !== "1") {
      sessionStorage.setItem(sessionKey, "1");
      setOverviewOpen(true);
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!taskFilterOpen || taskFilterDueBeforeDraft || taskFilterTagDraft.trim()) return;

    function closeEmptyFilterOnOutsideClick(event: MouseEvent) {
      if (!taskFilterAreaRef.current?.contains(event.target as Node)) {
        setTaskFilterOpen(false);
      }
    }

    document.addEventListener("mousedown", closeEmptyFilterOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeEmptyFilterOnOutsideClick);
  }, [taskFilterOpen, taskFilterDueBeforeDraft, taskFilterTagDraft]);

  function closeTodayOverview() {
    localStorage.setItem(`leo-today-overview-dismissed-${localDateKey(today)}`, "1");
    sessionStorage.setItem(`leo-today-overview-auto-shown-${localDateKey(today)}`, "1");
    setOverviewOpen(false);
  }

  return (
    <>
      <PageHeader
        title="Leo的生活学习助手"
        subtitle={today.toLocaleDateString("zh-CN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        onTitleDoubleClick={() => setOverviewOpen(true)}
        actions={
          <>
            <ActionButton onClick={() => onOpenModal("todoList")} icon={<ListChecks size={16} />} label="To Do List" />
            <ActionButton onClick={() => onOpenModal("task")} icon={<CirclePlus size={16} />} label="Add Task" />
            <ActionButton onClick={() => onOpenModal("deadline")} icon={<CalendarDays size={16} />} label="Add Deadline" />
            <ActionButton onClick={() => onOpenModal("expense")} icon={<WalletCards size={16} />} label="记账" />
          </>
        }
      />

      {overviewOpen && <TodayOverviewDialog summary={todayOverview} onClose={closeTodayOverview} />}

      {reminders.length > 0 && (
        <div className="mb-4 grid gap-3 md:grid-cols-2">
          {reminders.map((reminder) => (
            <div key={reminder} className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              {reminder}
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <TodoListPreviewCard items={todoPreviewItems} onToggle={onToggleTodoItem} />
        <section className="relative h-[300px] overflow-hidden rounded-lg bg-white p-4 shadow-soft">
          <SectionTitle title="Today’s Courses" />
          <div className="space-y-3">
            {todayCourses.length === 0 && <EmptyLine text="今天没有课程安排。" />}
            {todayCourses.map((session) => (
              <div key={session.id} className="rounded-lg border border-slate-200 p-3">
                <div className="font-medium">{session.course.code} · {session.type}</div>
                <div className="text-sm text-slate-600">{session.startTime}-{session.endTime} · {session.location}</div>
              </div>
            ))}
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-b from-white/0 to-white" />
        </section>
      </div>

      <section className="relative mt-4">
        <div ref={taskFilterAreaRef}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <SectionTitle title="Task Card" />
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
              onClick={() => setTaskFilterOpen((value) => !value)}
            >
              <SlidersHorizontal size={16} />
              筛选
            </button>
          </div>
          {taskFilterOpen && (
            <div className="absolute right-0 top-12 z-30 grid w-full gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-lg md:w-[720px] md:grid-cols-[1fr_1fr_auto]">
            <Input
              type="datetime-local"
              value={taskFilterDueBeforeDraft}
              onChange={(event) => setTaskFilterDueBeforeDraft(event.target.value)}
              placeholder="截止时间早于"
            />
            <Input
              value={taskFilterTagDraft}
              onChange={(event) => setTaskFilterTagDraft(event.target.value)}
              placeholder="按标签筛选"
            />
            <button
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
              onClick={() => {
                setTaskFilterDueBefore(taskFilterDueBeforeDraft);
                setTaskFilterTag(taskFilterTagDraft);
                setTaskFilterOpen(false);
              }}
            >
              应用
            </button>
            </div>
          )}
        </div>
        <TaskGrid
          tasks={filteredDashboardTasks}
          onComplete={onComplete}
          onEdit={onEdit}
          onSave={onSave}
          onProgressUpdate={onProgressUpdate}
          onToggleSubtask={onToggleSubtask}
        />
      </section>
    </>
  );
}

type TodayOverviewSummary = {
  todoTotal: number;
  todoCompleted: number;
  deadlineCount: number;
  courseCount: number;
};

function TodayOverviewDialog({ summary, onClose }: { summary: TodayOverviewSummary; onClose: () => void }) {
  useEscapeClose(onClose);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="app-modal-panel w-full max-w-xl rounded-lg bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">今日总览</h2>
            <p className="mt-1 text-sm text-slate-500">今天要面对的事情，先一眼看清。</p>
          </div>
          <button
            className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
            onClick={onClose}
            aria-label="关闭今日总览"
            title="关闭"
          >
            <X size={18} />
          </button>
        </div>
        <TodayOverviewStats summary={summary} large />
      </section>
    </div>
  );
}

function TodayOverviewStats({ summary, large = false }: { summary: TodayOverviewSummary; large?: boolean }) {
  const stats = [
    { label: "To Do", value: `${summary.todoCompleted}/${summary.todoTotal}`, hint: "已完成/总数" },
    { label: "Deadline", value: `${summary.deadlineCount}`, hint: "今日截止" },
    { label: "课程", value: `${summary.courseCount}`, hint: "今日课程" }
  ];

  return (
    <div className="grid gap-3">
      {stats.map((item) => (
        <div key={item.label} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-3">
          <div className="text-xs font-medium text-slate-500">{item.label}</div>
          <div className="mt-1 truncate text-lg font-semibold text-slate-950">{item.value}</div>
          <div className="mt-1 text-xs text-slate-400">{item.hint}</div>
        </div>
      ))}
    </div>
  );
}

function TasksPage({
  tasks,
  onOpenModal,
  onComplete,
  onRestore,
  onEdit,
  onSave,
  onDelete,
  onProgressUpdate,
  onToggleSubtask
}: {
  tasks: Task[];
  onOpenModal: (mode: ModalMode) => void;
  onComplete: (id: string) => void;
  onRestore: (id: string) => void;
  onEdit: (task: Task) => void;
  onSave: (url: string, options?: RequestInit) => Promise<void>;
  onDelete: (id: string) => void;
  onProgressUpdate: (taskId: string, nextValue: number) => Promise<void>;
  onToggleSubtask: (taskId: string, subtaskId: string, completed: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "completed" | "all">("active");
  const [typeFilter, setTypeFilter] = useState<TaskType | "progress" | "">("");
  const [tag, setTag] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [sort, setSort] = useState("due-nearest");
  const statusTabs: Array<["active" | "completed" | "all", string]> = [
    ["active", "进行中"],
    ["completed", "已完成"],
    ["all", "全部"]
  ];
  const typeTabs: Array<[TaskType | "progress" | "", string]> = [
    ["", "全部"],
    ["todo", "Task"],
    ["deadline", "Deadline"],
    ["counter", "Counter"],
    ["checklist", "清单"],
    ["progress", "有进度"]
  ];

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");
    const filter = params.get("filter");
    if (status === "completed" || status === "all") setStatusFilter(status);
    if (filter === "progress") setTypeFilter("progress");
  }, []);

  const filtered = tasks
    .filter(isTaskCardGridItem)
    .filter((task) => {
      const normalizedType = normalizeType(task.type);
      const isCompletedGroup = task.status === "completed" || task.status === "archived";
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && !isCompletedGroup) ||
        (statusFilter === "completed" && isCompletedGroup);
      return (
        matchesStatus &&
        task.title.toLowerCase().includes(query.toLowerCase()) &&
        (!typeFilter || (typeFilter === "progress" ? Boolean(task.progressEnabled || task.progressTarget) : normalizedType === typeFilter)) &&
        (!tag || task.tags.some((item) => item.toLowerCase().includes(tag.toLowerCase()))) &&
        (!startDate || Boolean(task.startDate) && String(task.startDate) >= startDate) &&
        (!dueDate || Boolean(task.dueDate) && String(task.dueDate) <= dueDate)
      );
    })
    .sort((a, b) => sortTasks(a, b, sort));

  return (
    <>
      <PageHeader
        title="任务"
        subtitle="统一管理任务、截止日期、清单和计数目标"
        actions={<ActionButton onClick={() => onOpenModal("task")} icon={<Plus size={16} />} label="新建任务" />}
      />
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {statusTabs.map(([value, label]) => (
          <button
            key={value}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium ${
              statusFilter === value ? "bg-slate-900 text-white" : "bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
            onClick={() => setStatusFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <section className="mb-4 rounded-lg bg-white p-4 shadow-soft">
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {typeTabs.map(([value, label]) => (
            <button
              key={value || "all"}
              className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium ${
                typeFilter === value ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
              onClick={() => setTypeFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-6">
          <SearchBox value={query} onChange={setQuery} placeholder="搜索任务标题" className="mb-0 md:col-span-2" />
          <Input value={tag} onChange={(event) => setTag(event.target.value)} placeholder="标签" />
          <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} title="开始日期" />
          <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} title="截止日期" />
          <Select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            options={[
              ["due-nearest", "离截止时间最近"],
              ["due-farthest", "离截止时间最远"],
              ["created-newest", "创建时间最新"],
              ["created-oldest", "创建时间最早"],
              ["title", "标题排序"]
            ]}
          />
        </div>
      </section>
      <TaskGrid
        tasks={filtered}
        onComplete={onComplete}
        onRestore={onRestore}
        onEdit={onEdit}
        onSave={onSave}
        onDelete={onDelete}
        onProgressUpdate={onProgressUpdate}
        onToggleSubtask={onToggleSubtask}
      />
    </>
  );
}

function TodoListPreviewCard({ items, onToggle }: { items: TodoListItem[]; onToggle: (id: string, completed: boolean) => Promise<void> | void }) {
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const completionTimers = useRef<number[]>([]);
  const hasOverflowHint = items.length > 4;

  useEffect(() => {
    return () => {
      completionTimers.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  function completeWithAnimation(item: TodoListItem) {
    if (completingIds.has(item.id)) return;
    if (item.completed) {
      void onToggle(item.id, false);
      return;
    }
    setCompletingIds((current) => new Set(current).add(item.id));
    const timer = window.setTimeout(() => {
      void Promise.resolve(onToggle(item.id, true)).finally(() => {
        setCompletingIds((current) => {
          const next = new Set(current);
          next.delete(item.id);
          return next;
        });
      });
    }, 1250);
    completionTimers.current.push(timer);
  }

  return (
    <section className="relative h-[300px] overflow-hidden rounded-lg border border-slate-100 bg-white p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">To Do List</h2>
        <Link href="/plans" className="rounded-lg px-2 py-1 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900">
          View all
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg bg-slate-50 px-4 py-5 text-sm text-slate-500">
          No tasks for today. Add one to get started.
        </div>
      ) : (
        <div className="todo-preview-list scrollbar-thin space-y-2 pb-16 pr-1">
          {items.map((item) => (
            <div
              key={item.id}
              className={`todo-preview-row relative z-0 flex items-center gap-3 rounded-lg border border-slate-100 bg-white/80 px-3 py-2.5 ${
                completingIds.has(item.id) ? "todo-preview-row-completing" : ""
              }`}
            >
              <button
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
                  item.completed || completingIds.has(item.id)
                    ? "border-yellow-500 bg-yellow-500 text-white"
                    : "border-slate-300 bg-white text-transparent hover:border-slate-400"
                }`}
                onClick={() => completeWithAnimation(item)}
                disabled={completingIds.has(item.id)}
                title={item.completed ? "取消完成" : "标记完成"}
              >
                <Check size={13} />
              </button>
              <div className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{item.content}</div>
            </div>
          ))}
        </div>
      )}

      {hasOverflowHint && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24 bg-gradient-to-b from-white/0 via-white/80 to-white" />
      )}
    </section>
  );
}

function TaskGrid({
  tasks,
  onComplete,
  onRestore,
  onEdit,
  onSave,
  onDelete,
  onProgressUpdate,
  onToggleSubtask
}: {
  tasks: Task[];
  onComplete: (id: string) => void;
  onRestore?: (id: string) => void;
  onEdit: (task: Task) => void;
  onSave: (url: string, options?: RequestInit) => Promise<void>;
  onDelete?: (id: string) => void;
  onProgressUpdate: (taskId: string, nextValue: number) => Promise<void>;
  onToggleSubtask: (taskId: string, subtaskId: string, completed: boolean) => void;
}) {
  if (tasks.length === 0) return <EmptyBlock text="没有符合条件的任务。" />;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          onComplete={onComplete}
          onRestore={onRestore}
          onEdit={onEdit}
          onSave={onSave}
          onDelete={onDelete}
          onProgressUpdate={onProgressUpdate}
          onToggleSubtask={onToggleSubtask}
        />
      ))}
    </div>
  );
}

function mergeDashboardTasks(activeTasks: Task[], completedTasks: Task[]) {
  const taskMap = new Map<string, Task>();
  [...activeTasks, ...completedTasks].forEach((task) => {
    if (task.status !== "archived") taskMap.set(task.id, task);
  });
  return Array.from(taskMap.values());
}

function mergeAllTasks(activeTasks: Task[], archivedTasks: Task[]) {
  const taskMap = new Map<string, Task>();
  [...activeTasks, ...archivedTasks].forEach((task) => taskMap.set(task.id, task));
  return Array.from(taskMap.values());
}

function TaskCard({
  task,
  onComplete,
  onRestore,
  onEdit,
  onSave,
  onDelete,
  onProgressUpdate,
  onToggleSubtask
}: {
  task: Task;
  onComplete: (id: string) => void;
  onRestore?: (id: string) => void;
  onEdit: (task: Task) => void;
  onSave: (url: string, options?: RequestInit) => Promise<void>;
  onDelete?: (id: string) => void;
  onProgressUpdate: (taskId: string, nextValue: number) => Promise<void>;
  onToggleSubtask: (taskId: string, subtaskId: string, completed: boolean) => void;
}) {
  const completedOrArchived = task.status === "completed" || task.status === "archived";
  const urgent = !completedOrArchived && isDueWithin24HoursOrOverdue(task.dueDate);
  const hasProgress = Boolean(task.progressEnabled || task.progressTarget);
  const visibleTaskTags = task.tags.filter(
    (tag) => task.type !== "deadline" || !["deadline", "截止"].includes(tag.trim().toLowerCase())
  );
  const [progressEditorOpen, setProgressEditorOpen] = useState(false);
  const [progressCurrentDraft, setProgressCurrentDraft] = useState(String(task.progressCurrent ?? 0));
  const [progressDeltaDraft, setProgressDeltaDraft] = useState("");
  const [progressDurationDraft, setProgressDurationDraft] = useState("");
  const [progressNoteDraft, setProgressNoteDraft] = useState("");
  const [, setCountdownTick] = useState(0);

  useEffect(() => {
    setProgressCurrentDraft(String(task.progressCurrent ?? 0));
  }, [task.progressCurrent]);

  useEffect(() => {
    if (task.type !== "deadline" || !task.dueDate) return;
    const timer = window.setInterval(() => setCountdownTick((value) => value + 1), 60_000);
    return () => window.clearInterval(timer);
  }, [task.type, task.dueDate]);

  async function saveProgressUpdate() {
    const currentValueAfter = progressCurrentDraft.trim() === "" ? null : Number(progressCurrentDraft);
    const amountDelta = progressDeltaDraft.trim() === "" ? null : Number(progressDeltaDraft);
    const durationMinutes = progressDurationDraft.trim() === "" ? null : Number(progressDurationDraft);
    if (currentValueAfter !== null && !Number.isFinite(currentValueAfter)) return;
    if (amountDelta !== null && !Number.isFinite(amountDelta)) return;
    if (durationMinutes !== null && !Number.isFinite(durationMinutes)) return;
    await onSave(`/api/tasks/${task.id}/progress-entries`, {
      method: "POST",
      body: JSON.stringify({
        currentValueAfter,
        amountDelta,
        durationMinutes,
        note: progressNoteDraft.trim() || null
      })
    });
    setProgressDeltaDraft("");
    setProgressDurationDraft("");
    setProgressNoteDraft("");
    setProgressEditorOpen(false);
  }
  return (
    <article
      className={`flex min-h-[220px] flex-col rounded-lg border p-4 shadow-soft ${
        urgent ? "border-red-200 bg-red-50" : completedOrArchived ? "border-slate-200 bg-slate-50/70 opacity-90" : "border-slate-200 bg-white"
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-lg font-semibold">{task.title}</h3>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {task.type === "deadline" && <Badge>Deadline</Badge>}
            <Badge>{statusLabel(task.status)}</Badge>
            {visibleTaskTags.map((tag) => (
              <span key={tag} className="rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-600">{tag}</span>
            ))}
          </div>
        </div>
        {!completedOrArchived && (
          <button className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-white" onClick={() => onEdit(task)} title="编辑">
            <Menu size={16} />
          </button>
        )}
      </div>
      {task.description && <p className="mb-3 line-clamp-3 text-sm text-slate-600">{task.description}</p>}
      {task.dueDate && (
        <div className={`mb-3 text-sm ${urgent ? "font-semibold text-red-700" : "text-slate-600"}`}>
          {task.type === "deadline" ? `${formatTaskDateTime(task.dueDate)} · ${countdownText(task.dueDate)}` : formatTaskDateTime(task.dueDate)}
        </div>
      )}
      {hasProgress ? (
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
          <ProgressLine current={task.progressCurrent || 0} target={task.progressTarget || 1} unit={task.progressUnit || ""} />
          <div className="mt-3">
            <button
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100"
              onClick={() => setProgressEditorOpen((value) => !value)}
            >
              更新
            </button>
          </div>
          {progressEditorOpen && (
            <div className="mt-3 grid gap-2">
              <Input
                inputMode="decimal"
                value={progressDeltaDraft}
                onChange={(event) => setProgressDeltaDraft(event.target.value)}
                placeholder={`本次完成量${task.progressUnit ? `（${task.progressUnit}）` : ""}`}
              />
              <Input
                inputMode="decimal"
                value={progressCurrentDraft}
                onChange={(event) => setProgressCurrentDraft(event.target.value)}
                placeholder={`更新后当前值${task.progressUnit ? `（${task.progressUnit}）` : ""}`}
              />
              <Input
                inputMode="decimal"
                value={progressDurationDraft}
                onChange={(event) => setProgressDurationDraft(event.target.value)}
                placeholder="本次用时（分钟）"
              />
              <textarea
                className="min-h-[64px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                value={progressNoteDraft}
                onChange={(event) => setProgressNoteDraft(event.target.value)}
                placeholder="备注"
              />
              <button className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white" onClick={saveProgressUpdate}>
                保存
              </button>
            </div>
          )}
          {task.progressEntries && task.progressEntries.length > 0 && (
            <div className="mt-3 max-h-28 space-y-1 overflow-hidden border-t border-slate-200 pt-2 text-xs text-slate-500">
              {task.progressEntries.slice(-4).reverse().map((entry) => (
                <div key={entry.id} className="flex justify-between gap-2">
                  <span>{formatTaskDateTime(entry.createdAt)}</span>
                  <span>
                    {entry.amountDelta !== null && entry.amountDelta !== undefined ? `+${entry.amountDelta}` : ""}
                    {entry.currentValueAfter !== null && entry.currentValueAfter !== undefined ? ` 到 ${entry.currentValueAfter}` : ""}
                    {entry.durationMinutes ? ` · ${entry.durationMinutes} 分钟` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
      {task.type === "checklist" && task.subtasks && task.subtasks.length > 0 && (
        <div className="mt-2 max-h-44 space-y-1.5 overflow-auto rounded-lg border border-slate-100 bg-slate-50 p-2 text-sm text-slate-700">
          {task.subtasks.map((subtask) => (
            <div key={subtask.id} className="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5">
              <button
                type="button"
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
                  subtask.completed
                    ? "border-yellow-500 bg-yellow-500 text-white"
                    : "border-slate-300 bg-white text-transparent hover:border-slate-400"
                }`}
                onClick={() => onToggleSubtask(task.id, subtask.id, !subtask.completed)}
                title={subtask.completed ? "取消完成" : "标记完成"}
              >
                <Check size={13} />
              </button>
              <span className="min-w-0 flex-1 break-words">{subtask.title}</span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-auto pt-4">
        {completedOrArchived ? (
          <div className="grid grid-cols-[1fr_auto] gap-2">
            {onRestore ? (
              <button className="flex items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50" onClick={() => onRestore(task.id)}>
                <RotateCcw size={15} /> 恢复
              </button>
            ) : (
              <button className="flex cursor-default items-center justify-center gap-2 rounded-lg bg-slate-200 px-3 py-2 text-sm font-medium text-slate-500" disabled>
                <Check size={15} /> 已完成
              </button>
            )}
            {onDelete && (
              <button className="flex items-center justify-center rounded-lg border border-red-200 px-3 py-2 text-red-600 hover:bg-red-50" onClick={() => onDelete(task.id)} title="永久删除">
                <Trash2 size={15} />
              </button>
            )}
          </div>
        ) : (
          <div className={onDelete ? "grid grid-cols-[1fr_auto_auto] gap-2" : "grid grid-cols-[1fr_auto] gap-2"}>
            <button className="flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white" onClick={() => onComplete(task.id)}>
              <Check size={15} /> 完成
            </button>
            <button className="flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-slate-600 hover:bg-slate-50" onClick={() => onSave(`/api/tasks/${task.id}/archive`, { method: "POST" })} title="归档">
              <Archive size={15} />
            </button>
            {onDelete && (
              <button className="flex items-center justify-center rounded-lg border border-red-200 px-3 py-2 text-red-600 hover:bg-red-50" onClick={() => onDelete(task.id)} title="永久删除">
                <Trash2 size={15} />
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function ReminderStack({ alerts, onDismiss }: { alerts: ReminderAlert[]; onDismiss: (key: string) => void }) {
  if (alerts.length === 0) return null;
  return (
    <div className="fixed right-4 top-4 z-[60] flex w-[calc(100vw-32px)] max-w-md flex-col gap-3">
      {alerts.slice(0, 4).map((alert) => (
        <section key={alert.key} className="rounded-lg border border-amber-200 bg-white p-4 shadow-soft">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-amber-700">{alert.title}</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{alert.task.title}</div>
            </div>
            <button
              className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
              onClick={() => onDismiss(alert.key)}
              title="关闭提醒"
            >
              <X size={16} />
            </button>
          </div>
          <div className="space-y-1 text-sm text-slate-600">
            <div>{typeLabels[alert.task.type]} · {statusLabel(alert.task.status)}</div>
            <div>{alert.detail}</div>
            {alert.task.description && <div className="line-clamp-2 pt-1 text-slate-500">{alert.task.description}</div>}
          </div>
        </section>
      ))}
    </div>
  );
}

function PlansPage({
  plans,
  todoLists,
  onOpenModal,
  onSave,
  onToggleTodoItem
}: {
  plans: Plan[];
  todoLists: TodoList[];
  onOpenModal: (mode: ModalMode) => void;
  onSave: (url: string, options?: RequestInit) => Promise<void>;
  onToggleTodoItem: (id: string, completed: boolean) => Promise<void> | void;
}) {
  const weeklyMonthlyPlans = plans.filter((plan) => plan.type !== "daily");

  async function createPlanByType(type: "weekly" | "monthly") {
    const today = new Date().toISOString().slice(0, 10);
    await onSave("/api/plans", {
      method: "POST",
      body: JSON.stringify({
        title: type === "weekly" ? "新周计划" : "新月计划",
        type,
        startDate: today,
        endDate: today
      })
    });
  }

  return (
    <>
      <PageHeader
        title="计划"
        subtitle="Daily 是 To Do List；Weekly / Monthly 保留为计划。"
        actions={<ActionButton onClick={() => onOpenModal("todoList")} icon={<Plus size={16} />} label="新建每日 To Do List" />}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg bg-white p-4 shadow-soft">
          <SectionTitle title="Daily" />
          <div className="space-y-3">
            {todoLists.length === 0 && <EmptyLine text="还没有 To Do List。" />}
            {todoLists.map((todoList) => (
              <TodoListCard
                key={todoList.id}
                todoList={todoList}
                yesterdayIncompleteItems={getPreviousIncompleteTodoItems(todoList, todoLists)}
                onSave={onSave}
                onToggleTodoItem={onToggleTodoItem}
              />
            ))}
          </div>
        </section>
        {(["weekly", "monthly"] as const).map((type) => (
          <section key={type} className="rounded-lg bg-white p-4 shadow-soft">
            <div className="mb-3 flex items-center justify-between gap-3">
              <SectionTitle title={type === "weekly" ? "Weekly" : "Monthly"} />
              <button
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                onClick={() => void createPlanByType(type)}
              >
                {type === "weekly" ? "新增周计划" : "新增月计划"}
              </button>
            </div>
            <div className="space-y-3">
              {weeklyMonthlyPlans.filter((plan) => plan.type === type).length === 0 && (
                <EmptyLine text={type === "weekly" ? "还没有周计划。" : "还没有月计划。"} />
              )}
              {weeklyMonthlyPlans.filter((plan) => plan.type === type).map((plan) => (
                <PlanCard key={plan.id} plan={plan} onSave={onSave} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

function TodoListCard({
  todoList,
  yesterdayIncompleteItems,
  onSave,
  onToggleTodoItem
}: {
  todoList: TodoList;
  yesterdayIncompleteItems: TodoListItem[];
  onSave: (url: string, options?: RequestInit) => Promise<void>;
  onToggleTodoItem: (id: string, completed: boolean) => Promise<void> | void;
}) {
  const [note, setNote] = useState(todoList.notes || "");
  const [editorOpen, setEditorOpen] = useState(false);

  useEffect(() => {
    setNote(todoList.notes || "");
  }, [todoList.notes]);

  async function saveTodoList(itemDrafts: Array<{ id?: string; content: string; completed: boolean }>) {
    await onSave(`/api/todo-lists/${todoList.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        notes: note,
        itemDrafts
      })
    });
    setEditorOpen(false);
  }

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="font-semibold">{todoList.title}</div>
      <div className="mb-3 text-xs text-slate-500">{todoList.date}</div>
      <div className="space-y-2">
        {todoList.items.length === 0 && <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">还没有待办条目。</div>}
        {todoList.items.map((item) => (
          <label key={item.id} className="flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm text-slate-700">
            <button
              type="button"
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
                item.completed ? "border-yellow-500 bg-yellow-500 text-white" : "border-slate-300 bg-white text-transparent hover:border-slate-400"
              }`}
              onClick={() => void onToggleTodoItem(item.id, !item.completed)}
              title={item.completed ? "取消完成" : "标记完成"}
            >
              <Check size={13} />
            </button>
            <span className="min-w-0 flex-1 truncate">{item.content}</span>
          </label>
        ))}
        <textarea
          className="min-h-[70px] w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-slate-400"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="随手小记"
        />
      </div>
      <button className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white" onClick={() => setEditorOpen(true)}>
        编辑
      </button>
      {editorOpen && (
        <TodoListEditDialog
          todoList={todoList}
          yesterdayIncompleteItems={yesterdayIncompleteItems}
          note={note}
          onNoteChange={setNote}
          onClose={() => setEditorOpen(false)}
          onSave={saveTodoList}
        />
      )}
    </div>
  );
}

function TodoListEditDialog({
  todoList,
  yesterdayIncompleteItems,
  note,
  onNoteChange,
  onClose,
  onSave
}: {
  todoList: TodoList;
  yesterdayIncompleteItems: TodoListItem[];
  note: string;
  onNoteChange: (value: string) => void;
  onClose: () => void;
  onSave: (itemDrafts: Array<{ id?: string; content: string; completed: boolean }>) => Promise<void>;
}) {
  const [items, setItems] = useState<TodoListEditItem[]>(() => todoList.items.map((item) => ({ id: item.id, content: item.content, completed: item.completed })));
  const [newItem, setNewItem] = useState("");
  const [hoveredItemIndex, setHoveredItemIndex] = useState<number | null>(null);
  const itemInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  useEscapeClose(onClose);
  const importableYesterdayItems = yesterdayIncompleteItems.filter(
    (yesterdayItem) => !items.some((item) => item.content.trim().toLowerCase() === yesterdayItem.content.trim().toLowerCase())
  );

  function addItem() {
    const content = newItem.trim();
    if (!content) return;
    setItems((current) => [...current, { content, completed: false }]);
    setNewItem("");
  }

  function importYesterdayIncomplete() {
    if (importableYesterdayItems.length === 0) return;
    setItems((current) => [
      ...current,
      ...importableYesterdayItems.map((item) => ({ content: item.content, completed: false }))
    ]);
  }

  function focusItemInput(index: number) {
    itemInputRefs.current[index]?.focus();
  }

  function handleItemArrowNavigation(event: React.KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    const nextIndex = event.key === "ArrowUp" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= items.length) return;
    event.preventDefault();
    focusItemInput(nextIndex);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="app-modal-panel w-full max-w-xl rounded-lg bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">编辑 To Do List</h2>
            <p className="mt-1 text-sm text-slate-500">{todoList.title}</p>
          </div>
          <button
            className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
            onClick={onClose}
            aria-label="关闭编辑"
            title="关闭"
          >
            <X size={18} />
          </button>
        </div>

        <button
          type="button"
          className="mb-3 flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-default disabled:text-slate-400"
          onClick={importYesterdayIncomplete}
          disabled={importableYesterdayItems.length === 0}
        >
          <span>一键导入昨天未完成</span>
          <span>{importableYesterdayItems.length} 条</span>
        </button>

        <div
          className="space-y-2"
          onMouseMove={(event) => {
            const row = (event.target as HTMLElement).closest("[data-todo-edit-index]");
            setHoveredItemIndex(row ? Number(row.getAttribute("data-todo-edit-index")) : null);
          }}
          onMouseLeave={() => setHoveredItemIndex(null)}
        >
          {items.length === 0 && <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">还没有待办条目。</div>}
          {items.map((item, index) => (
            <div
              key={item.id || `new-${index}`}
              data-todo-edit-index={index}
              className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2 text-sm text-slate-700"
            >
              <button
                type="button"
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
                  item.completed ? "border-yellow-500 bg-yellow-500 text-white" : "border-slate-300 bg-white text-transparent hover:border-slate-400"
                }`}
                onClick={() =>
                  setItems((current) => current.map((currentItem, currentIndex) => (currentIndex === index ? { ...currentItem, completed: !currentItem.completed } : currentItem)))
                }
                title={item.completed ? "取消完成" : "标记完成"}
              >
                <Check size={13} />
              </button>
              <input
                ref={(element) => {
                  itemInputRefs.current[index] = element;
                }}
                className="min-w-0 flex-1 bg-transparent outline-none"
                value={item.content}
                onChange={(event) =>
                  setItems((current) => current.map((currentItem, currentIndex) => (currentIndex === index ? { ...currentItem, content: event.target.value } : currentItem)))
                }
                onKeyDown={(event) => handleItemArrowNavigation(event, index)}
              />
              <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                {hoveredItemIndex === index && (
                  <button
                    type="button"
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white transition hover:bg-red-600"
                    onClick={() => {
                      setItems((current) => current.filter((_, currentIndex) => currentIndex !== index));
                      setHoveredItemIndex(null);
                    }}
                    title="删除"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <Input
            className="flex-1"
            value={newItem}
            onChange={(event) => setNewItem(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addItem();
              }
            }}
            placeholder="新增待办条目"
          />
          <button className="ml-auto rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={addItem}>
            添加
          </button>
        </div>

        <textarea
          className="mt-3 min-h-[70px] w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-slate-400"
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder="随手小记"
        />

        <button className="mt-4 w-full rounded-lg bg-slate-900 px-3 py-3 text-sm font-medium text-white" onClick={() => void onSave(items)}>
          保存
        </button>
      </section>
    </div>
  );
}

function PlanCard({ plan, onSave }: { plan: Plan; onSave: (url: string, options?: RequestInit) => Promise<void> }) {
  const [title, setTitle] = useState(plan.title);
  const [startDate, setStartDate] = useState(plan.startDate);
  const [endDate, setEndDate] = useState(plan.endDate);
  const [note, setNote] = useState(plan.reflectionNote || "");

  async function savePlan() {
    await onSave(`/api/plans/${plan.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        title,
        startDate,
        endDate,
        reflectionNote: note
      })
    });
  }

  async function deleteCurrentPlan() {
    if (!confirm("确定删除这个计划吗？")) return;
    await onSave(`/api/plans/${plan.id}`, { method: "DELETE" });
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 p-3">
      <input
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-slate-400"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder={plan.type === "weekly" ? "周计划标题" : "月计划标题"}
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
          type="date"
          value={startDate}
          onChange={(event) => setStartDate(event.target.value)}
        />
        <input
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
          type="date"
          value={endDate}
          onChange={(event) => setEndDate(event.target.value)}
        />
      </div>
      <textarea
        className="min-h-[96px] w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-slate-400"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="计划内容 / 备注"
      />
      <div className="flex gap-2">
        <button className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white" onClick={savePlan}>
          保存计划
        </button>
        <button
          className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
          onClick={deleteCurrentPlan}
        >
          删除
        </button>
      </div>
    </div>
  );
}

type TimetableViewMode = "day" | "week" | "month" | "semester";
type TimetableEditScope = "single" | "week" | "month" | "future" | "series";

function startOfLocalDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function filterOccurrencesForView(occurrences: CourseOccurrence[], view: TimetableViewMode, anchorDate: string) {
  const anchor = startOfLocalDay(new Date(`${anchorDate}T00:00:00`));
  let start = new Date(anchor);
  let end = addDays(start, 1);
  if (view === "week") {
    const day = (start.getDay() + 6) % 7;
    start = addDays(start, -day);
    end = addDays(start, 7);
  } else if (view === "month") {
    start.setDate(1);
    end = new Date(start);
    end.setMonth(end.getMonth() + 1);
  } else if (view === "semester") {
    return occurrences
      .filter((occurrence) => occurrence.status !== "cancelled")
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }
  return occurrences
    .filter((occurrence) => {
      const startAt = new Date(occurrence.startAt);
      const endAt = new Date(occurrence.endAt);
      return occurrence.status !== "cancelled" && endAt >= start && startAt < end;
    })
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
}

function promptScope(message = "修改范围：single / week / month / future / series"): TimetableEditScope | null {
  const value = prompt(message, "single")?.trim() as TimetableEditScope | undefined;
  if (!value) return null;
  return ["single", "week", "month", "future", "series"].includes(value) ? value : null;
}

function TimetableOccurrenceRow({ occurrence }: { occurrence: CourseOccurrence }) {
  const course = occurrence.course;
  return (
    <div className="grid gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm md:grid-cols-[1.2fr_1fr_1fr]">
      <div className="font-medium text-slate-900">{course?.courseCode ?? "COURSE"} · {course?.courseName ?? "未命名课程"}</div>
      <div className="text-slate-600">{formatTaskDateTime(occurrence.startAt)} - {formatTaskDateTime(occurrence.endAt)}</div>
      <div className="text-slate-500">{occurrence.location || course?.defaultLocation || "地点待确认"}</div>
    </div>
  );
}

function TimetableOccurrenceCard({
  occurrence,
  onEdit,
  onCancel
}: {
  occurrence: CourseOccurrence;
  onEdit: () => void;
  onCancel: () => void;
}) {
  const course = occurrence.course;
  return (
    <article className="rounded-lg border border-slate-100 bg-white p-4 shadow-soft">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-950">{course?.courseCode ?? "COURSE"}</span>
            <Badge>{course?.activityType ?? "课程"}</Badge>
          </div>
          <div className="mt-1 text-sm font-medium text-slate-700">{course?.courseName ?? course?.activityName ?? "未命名课程"}</div>
        </div>
        <div className="flex gap-2">
          <button className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" onClick={onEdit} title="编辑地点">
            <Settings size={16} />
          </button>
          <button className="rounded-lg border border-red-200 p-2 text-red-500 hover:bg-red-50" onClick={onCancel} title="取消课程">
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="space-y-2 text-sm text-slate-600">
        <div>{formatTaskDateTime(occurrence.startAt)} - {formatTaskDateTime(occurrence.endAt)}</div>
        <div>{occurrence.location || course?.defaultLocation || "地点待确认"}</div>
        {occurrence.notes && <div className="line-clamp-2 text-slate-500">{occurrence.notes}</div>}
      </div>
    </article>
  );
}

function TimetableCalendarView({
  occurrences,
  view,
  anchorDate,
  onEdit,
  onCancel
}: {
  occurrences: CourseOccurrence[];
  view: "day" | "week";
  anchorDate: string;
  onEdit: (occurrence: CourseOccurrence) => void;
  onCancel: (occurrence: CourseOccurrence) => void;
}) {
  const days = getTimetableDays(view, anchorDate);
  const dayKeys = days.map((day) => localDateKey(day));
  const visibleOccurrences = occurrences.filter((occurrence) => dayKeys.includes(localDateKey(new Date(occurrence.startAt))));
  const hourRange = getTimetableHourRange(visibleOccurrences);
  const hours = Array.from({ length: hourRange.end - hourRange.start + 1 }, (_, index) => hourRange.start + index);
  const hourHeight = view === "day" ? 76 : 68;
  const bodyHeight = (hourRange.end - hourRange.start) * hourHeight;
  const timeColumnWidth = view === "day" ? 72 : 64;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <div
          className="min-w-[760px]"
          style={{ width: view === "day" ? "100%" : "max(100%, 980px)" }}
        >
          <div
            className="grid border-b border-slate-200 bg-slate-50"
            style={{ gridTemplateColumns: `${timeColumnWidth}px repeat(${days.length}, minmax(96px, 1fr))` }}
          >
            <div className="border-r border-slate-200 px-2 py-3 text-xs font-medium text-slate-400">时间</div>
            {days.map((day) => (
              <div key={day.toISOString()} className="border-r border-slate-200 px-3 py-2 last:border-r-0">
                <div className="text-xs font-medium text-slate-500">{weekdayLabel(day)}</div>
                <div className="mt-0.5 text-sm font-semibold text-slate-950">{monthDayLabel(day)}</div>
              </div>
            ))}
          </div>

          <div
            className="grid"
            style={{ gridTemplateColumns: `${timeColumnWidth}px repeat(${days.length}, minmax(96px, 1fr))` }}
          >
            <div className="relative border-r border-slate-200 bg-slate-50" style={{ height: bodyHeight }}>
              {hours.slice(0, -1).map((hour, index) => (
                <div
                  key={hour}
                  className="absolute left-0 right-0 -translate-y-2 px-2 text-right text-[11px] font-medium text-slate-500"
                  style={{ top: index * hourHeight }}
                >
                  {formatCalendarHour(hour)}
                </div>
              ))}
            </div>

            {days.map((day) => {
              const dayKey = localDateKey(day);
              const dayOccurrences = visibleOccurrences.filter((occurrence) => localDateKey(new Date(occurrence.startAt)) === dayKey);
              const laidOut = layoutTimetableDayOccurrences(dayOccurrences);
              return (
                <div key={dayKey} className="relative border-r border-slate-200 last:border-r-0" style={{ height: bodyHeight }}>
                  {hours.slice(0, -1).map((hour, index) => (
                    <div
                      key={hour}
                      className="absolute left-0 right-0 border-t border-slate-100"
                      style={{ top: index * hourHeight }}
                    >
                      <div className="h-[1px] border-t border-slate-50" />
                    </div>
                  ))}
                  {laidOut.map(({ occurrence, lane, laneCount }) => {
                    const startMinutes = minutesSinceMidnight(new Date(occurrence.startAt));
                    const endMinutes = minutesSinceMidnight(new Date(occurrence.endAt));
                    const top = Math.max(0, ((startMinutes - hourRange.start * 60) / 60) * hourHeight);
                    const height = Math.max(36, ((endMinutes - startMinutes) / 60) * hourHeight - 4);
                    const gap = 6;
                    const width = `calc(${100 / laneCount}% - ${gap}px)`;
                    const left = `calc(${(100 / laneCount) * lane}% + ${gap / 2}px)`;
                    return (
                      <TimetableCalendarEvent
                        key={occurrence.id}
                        occurrence={occurrence}
                        top={top}
                        height={height}
                        width={width}
                        left={left}
                        compact={view === "week"}
                        onEdit={() => onEdit(occurrence)}
                        onCancel={() => onCancel(occurrence)}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function TimetableCalendarEvent({
  occurrence,
  top,
  height,
  width,
  left,
  compact,
  onEdit,
  onCancel
}: {
  occurrence: CourseOccurrence;
  top: number;
  height: number;
  width: string;
  left: string;
  compact: boolean;
  onEdit: () => void;
  onCancel: () => void;
}) {
  const course = occurrence.course;
  const color = course?.color || "#0f172a";
  const background = calendarEventBackground(color);
  return (
    <article
      className="absolute overflow-hidden rounded-md border p-2 text-left shadow-sm transition hover:z-20 hover:shadow-md"
      style={{
        top,
        height,
        width,
        left,
        borderColor: color,
        background,
        color: "#0f172a"
      }}
      title={`${course?.courseCode ?? "COURSE"} ${course?.activityType ?? ""} ${formatCalendarTimeRange(occurrence)}`}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold leading-tight">{course?.courseCode ?? "COURSE"}</div>
          <div className="truncate text-[11px] font-medium leading-tight text-slate-700">{course?.activityType ?? "课程"}</div>
        </div>
        <div className="flex shrink-0 gap-1 opacity-0 transition hover:opacity-100 focus-within:opacity-100">
          <button className="rounded bg-white/80 p-1 text-slate-600 shadow-sm hover:bg-white" onClick={onEdit} title="编辑地点">
            <Settings size={12} />
          </button>
          <button className="rounded bg-white/80 p-1 text-red-500 shadow-sm hover:bg-white" onClick={onCancel} title="取消课程">
            <X size={12} />
          </button>
        </div>
      </div>
      <div className="mt-1 truncate text-[11px] leading-tight text-slate-700">{formatCalendarTimeRange(occurrence)}</div>
      {!compact && <div className="mt-1 line-clamp-2 text-[11px] leading-tight text-slate-600">{occurrence.location || course?.defaultLocation || "地点待确认"}</div>}
      {compact && height > 72 && <div className="mt-1 line-clamp-2 text-[11px] leading-tight text-slate-600">{occurrence.location || course?.defaultLocation || "地点待确认"}</div>}
    </article>
  );
}

function CoursesPage({ courses }: { courses: Course[] }) {
  const [sources, setSources] = useState<TimetableSource[]>([]);
  const [timetableCourses, setTimetableCourses] = useState<TimetableCourse[]>([]);
  const [occurrences, setOccurrences] = useState<CourseOccurrence[]>([]);
  const [preview, setPreview] = useState<TimetableImportPreview | null>(null);
  const [importMode, setImportMode] = useState<"feed" | "file" | "screenshot">("feed");
  const [feedUrl, setFeedUrl] = useState("");
  const [semester, setSemester] = useState("Semester 1");
  const [academicYear, setAcademicYear] = useState(String(new Date().getFullYear()));
  const [view, setView] = useState<TimetableViewMode>("week");
  const [anchorDate, setAnchorDate] = useState(localDateKey(new Date()));
  const [importMessage, setImportMessage] = useState("");

  useEffect(() => {
    void loadTimetable();
  }, []);

  async function loadTimetable() {
    const response = await fetch("/api/timetable?includeCancelled=1", { cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json()) as {
      sources: TimetableSource[];
      courses: TimetableCourse[];
      occurrences: CourseOccurrence[];
    };
    setSources(data.sources);
    setTimetableCourses(data.courses);
    setOccurrences(data.occurrences);
  }

  async function previewFeed() {
    setImportMessage("正在读取课表...");
    const response = await fetch("/api/timetable/import/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        feedUrl,
        semester,
        academicYear: Number(academicYear),
        timezone: "Australia/Sydney"
      })
    });
    const data = await response.json();
    if (!response.ok) {
      setImportMessage(data.error || "读取失败");
      return;
    }
    setPreview(data);
    setImportMessage("已生成导入预览，请检查后确认。");
  }

  async function previewFile(file: File | null) {
    if (!file) return;
    setImportMessage("正在解析 ICS 文件...");
    const form = new FormData();
    form.append("file", file);
    form.append("semester", semester);
    form.append("academicYear", academicYear);
    form.append("timezone", "Australia/Sydney");
    const response = await fetch("/api/timetable/import/preview", { method: "POST", body: form });
    const data = await response.json();
    if (!response.ok) {
      setImportMessage(data.error || "解析失败");
      return;
    }
    setPreview(data);
    setImportMessage("已生成导入预览，请检查后确认。");
  }

  async function confirmImport() {
    if (!preview) return;
    const response = await fetch("/api/timetable/import/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(preview)
    });
    const data = await response.json();
    if (!response.ok) {
      setImportMessage(data.error || "保存失败");
      return;
    }
    setImportMessage(`导入完成：新增 ${data.created}，更新 ${data.updated}，跳过 ${data.skipped}，冲突 ${data.conflicts}`);
    setPreview(null);
    await loadTimetable();
  }

  async function updateOccurrence(occurrence: CourseOccurrence) {
    const scope = promptScope();
    if (!scope) return;
    const location = prompt("新的地点", occurrence.location || "");
    if (location === null) return;
    await fetch(`/api/timetable/occurrences/${occurrence.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scope, patch: { location } })
    });
    await loadTimetable();
  }

  async function cancelOccurrence(occurrence: CourseOccurrence) {
    const scope = promptScope("取消范围：single / week / month / future / series");
    if (!scope) return;
    if (!confirm("确定取消选中范围内的课程吗？")) return;
    await fetch(`/api/timetable/occurrences/${occurrence.id}?scope=${encodeURIComponent(scope)}`, { method: "DELETE" });
    await loadTimetable();
  }

  const visibleOccurrences = filterOccurrencesForView(occurrences, view, anchorDate);

  return (
    <>
      <PageHeader title="课程" subtitle="导入、同步和管理完整学期课表。" />
      <section className="mb-4 rounded-lg bg-white p-4 shadow-soft">
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {(["feed", "file", "screenshot"] as const).map((mode) => (
            <button
              key={mode}
              className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium ${
                importMode === mode ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
              onClick={() => setImportMode(mode)}
            >
              {mode === "feed" ? "订阅链接" : mode === "file" ? "上传 ICS 文件" : "上传课表截图"}
            </button>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-5">
          <Input value={semester} onChange={(event) => setSemester(event.target.value)} placeholder="学期" />
          <Input value={academicYear} onChange={(event) => setAcademicYear(event.target.value)} placeholder="年份" inputMode="numeric" />
          {importMode === "feed" && (
            <>
              <Input value={feedUrl} onChange={(event) => setFeedUrl(event.target.value)} placeholder="Calendar Feed URL" className="md:col-span-2" />
              <button className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white" onClick={() => void previewFeed()}>
                读取课表
              </button>
            </>
          )}
          {importMode === "file" && (
            <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600 md:col-span-3">
              上传 .ics 文件
              <input className="hidden" type="file" accept=".ics,text/calendar" onChange={(event) => void previewFile(event.target.files?.[0] ?? null)} />
            </label>
          )}
          {importMode === "screenshot" && (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600 md:col-span-3">
              截图识别入口已预留：可多选 PNG/JPG/WebP，识别结果只会进入预览，不会直接写入正式课表。
              <input className="mt-2 block w-full text-xs" type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={() => setImportMessage("截图已选择。结构化 OCR 将作为下一阶段接入；当前不会写入数据库。")} />
            </div>
          )}
        </div>
        {importMessage && <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{importMessage}</div>}
      </section>

      {preview && (
        <section className="mb-4 rounded-lg bg-white p-4 shadow-soft">
          <div className="mb-3 flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <div>
              <SectionTitle title="导入预览" />
              <div className="text-sm text-slate-500">
                {preview.summary.courseCount} 门课程 · {preview.summary.occurrenceCount} 节课 · 重复 {preview.summary.duplicateCount} · 冲突 {preview.summary.conflictCount}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {preview.summary.semesterStart ? formatTaskDateTime(preview.summary.semesterStart) : "未知开始"} - {preview.summary.semesterEnd ? formatTaskDateTime(preview.summary.semesterEnd) : "未知结束"}
              </div>
            </div>
            <ActionButton onClick={() => void confirmImport()} icon={<Check size={16} />} label="确认导入" />
          </div>
          <div className="max-h-72 space-y-2 overflow-auto">
            {preview.occurrences.slice(0, 80).map((occurrence) => (
              <TimetableOccurrenceRow key={occurrence.id} occurrence={occurrence} />
            ))}
          </div>
        </section>
      )}

      <section className="mb-4 rounded-lg bg-white p-4 shadow-soft">
        <div className="mb-4 grid gap-3 md:grid-cols-[auto_auto_1fr] md:items-center">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {(["day", "week", "month", "semester"] as const).map((item) => (
              <button
                key={item}
                className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium ${
                  view === item ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
                onClick={() => setView(item)}
              >
                {item === "day" ? "日" : item === "week" ? "周" : item === "month" ? "月" : "学期"}
              </button>
            ))}
          </div>
          <Input type="date" value={anchorDate} onChange={(event) => setAnchorDate(event.target.value)} />
          <div className="text-sm text-slate-500 md:text-right">
            来源 {sources.length} · 课程系列 {timetableCourses.length} · 当前显示 {visibleOccurrences.length}
          </div>
        </div>
        {view === "day" || view === "week" ? (
          visibleOccurrences.length === 0 ? (
            <EmptyBlock text="当前范围没有课程。" />
          ) : (
            <TimetableCalendarView
              occurrences={visibleOccurrences}
              view={view}
              anchorDate={anchorDate}
              onEdit={(occurrence) => void updateOccurrence(occurrence)}
              onCancel={(occurrence) => void cancelOccurrence(occurrence)}
            />
          )
        ) : (
          <div className="space-y-3">
            {visibleOccurrences.length === 0 && <EmptyBlock text="当前范围没有课程。" />}
            {visibleOccurrences.map((occurrence) => (
              <TimetableOccurrenceCard
                key={occurrence.id}
                occurrence={occurrence}
                onEdit={() => void updateOccurrence(occurrence)}
                onCancel={() => void cancelOccurrence(occurrence)}
              />
            ))}
          </div>
        )}
      </section>

      {courses.length > 0 && (
        <section className="rounded-lg bg-white p-4 shadow-soft">
          <SectionTitle title="旧手动课程（只读）" />
          <div className="grid gap-3 lg:grid-cols-2">
            {courses.map((course) => (
              <div key={course.id} className="rounded-lg border border-slate-200 p-3">
                <div className="font-semibold">{course.code} · {course.name}</div>
                <div className="text-sm text-slate-500">{course.semester}</div>
                <div className="mt-2 space-y-1 text-sm text-slate-600">
                  {course.sessions.map((session) => (
                    <div key={session.id}>周{session.dayOfWeek === 0 ? "日" : session.dayOfWeek} · {session.startTime}-{session.endTime} · {session.type} · {session.location}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function JournalPage({ journal, onSave }: { journal: JournalEntry[]; onSave: (url: string, options?: RequestInit) => Promise<void> }) {
  function exportMarkdown() {
    const content = journal.map((entry) => `## ${entry.date}\n\n${entry.content}\n`).join("\n");
    downloadBlob("leo-journal.md", content, "text/markdown");
  }

  return (
    <>
      <PageHeader
        title="日记"
        subtitle="自动聚合日计划复盘，也可以手动写新的记录。"
        actions={
          <>
            <button className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" onClick={exportMarkdown}>导出 Markdown</button>
            <button className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" onClick={() => downloadBlob("leo-journal.json", JSON.stringify(journal, null, 2), "application/json")}>导出 JSON</button>
          </>
        }
      />
      <form
        className="mb-4 rounded-lg bg-white p-4 shadow-soft"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          void onSave("/api/journal", {
            method: "POST",
            body: JSON.stringify({ date: form.get("date"), content: form.get("content"), source: "manual" })
          });
          event.currentTarget.reset();
        }}
      >
        <div className="grid gap-3 md:grid-cols-[180px_1fr_auto]">
          <Input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
          <Input name="content" placeholder="写一条复盘或观察" required />
          <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">添加</button>
        </div>
      </form>
      <div className="space-y-3">
        {journal.map((entry) => (
          <article key={entry.id} className="rounded-lg bg-white p-4 shadow-soft">
            <div className="mb-2 flex items-center gap-2">
              <div className="font-semibold">{entry.date}</div>
              <Badge>{entry.source === "daily_plan" ? "日计划复盘" : "手动记录"}</Badge>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{entry.content}</p>
          </article>
        ))}
      </div>
    </>
  );
}

function ExpensesPage({
  expenses,
  onOpenModal,
  onEdit,
  onSave
}: {
  expenses: Expense[];
  onOpenModal: () => void;
  onEdit: (expense: Expense) => void;
  onSave: (url: string, options?: RequestInit) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);
  useEscapeClose(() => setPreviewFileId(null), Boolean(previewFileId));
  const totals = summarizeExpenses(expenses);
  const filtered = expenses.filter((expense) => {
    const text = `${expense.title} ${expense.merchant ?? ""}`.toLowerCase();
    return (
      text.includes(query.toLowerCase()) &&
      (!category || expense.category === category) &&
      (!from || expense.date >= from) &&
      (!to || expense.date <= to)
    );
  });

  return (
    <>
      <PageHeader
        title="记账"
        subtitle="记录每天消费，照片和账单保存在本地 uploads 文件夹。"
        actions={<ActionButton onClick={onOpenModal} icon={<WalletCards size={16} />} label="新增消费" />}
      />

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <ExpenseStatCard title="今日消费" amount={totals.today} />
        <ExpenseStatCard title="本周消费" amount={totals.week} />
        <ExpenseStatCard title="本月消费" amount={totals.month} />
      </div>

      <section className="mb-4 rounded-lg bg-white p-4 shadow-soft">
        <div className="grid gap-3 md:grid-cols-[1fr_160px_1fr]">
          <SearchBox value={query} onChange={setQuery} placeholder="搜索消费标题或商家" className="mb-0" />
          <Select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            options={[["", "全部分类"], ...expenseCategories.map((item) => [item, item] as [string, string])]}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </div>
        </div>
      </section>

      <section className="rounded-lg bg-white p-4 shadow-soft">
        <div className="mb-3 flex items-center justify-between">
          <SectionTitle title="消费记录列表" />
          <div className="text-sm text-slate-500">{filtered.length} 条</div>
        </div>
        <div className="space-y-3">
          {filtered.length === 0 && <EmptyBlock text="还没有消费记录。点右上角新增一笔。" />}
          {filtered.map((expense) => (
            <article key={expense.id} className="flex flex-col gap-3 rounded-lg border border-slate-100 p-3 md:flex-row md:items-center">
              <button
                className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-slate-50 text-slate-400"
                onClick={() => expense.receiptFileId && setPreviewFileId(expense.receiptFileId)}
                disabled={!expense.receiptFileId}
                title={expense.receiptFileId ? "查看小票" : "没有小票"}
              >
                {expense.receiptFileId && isImageMime(expense.receiptMimeType) ? (
                  <img src={`/api/uploads/${expense.receiptFileId}`} alt="小票缩略图" className="h-full w-full object-cover" />
                ) : expense.receiptFileId ? (
                  <ImageIcon size={20} />
                ) : (
                  <CreditCard size={20} />
                )}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{expense.title}</h3>
                  <Badge>{expense.category}</Badge>
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  {expense.date} {expense.merchant ? ` · ${expense.merchant}` : ""} {expense.paymentMethod ? ` · ${expense.paymentMethod}` : ""}
                </div>
                {expense.notes && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{expense.notes}</p>}
              </div>
              <div className="flex items-center justify-between gap-3 md:min-w-[210px] md:justify-end">
                <div className="text-right">
                  <div className="text-lg font-semibold">{formatMoney(expense.amount, expense.currency)}</div>
                  <div className="text-xs text-slate-500">{expense.createdAt.slice(0, 10)}</div>
                </div>
                <button className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" onClick={() => onEdit(expense)} title="编辑消费">
                  <Menu size={16} />
                </button>
                <button
                  className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50"
                  onClick={async () => {
                    if (confirm("确定删除这条消费记录吗？")) await onSave(`/api/expenses/${expense.id}`, { method: "DELETE" });
                  }}
                  title="删除消费"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {previewFileId && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4" onClick={() => setPreviewFileId(null)}>
          <div className="max-h-[90vh] max-w-4xl overflow-auto rounded-lg bg-white p-3 shadow-soft" onClick={(event) => event.stopPropagation()}>
            <div className="mb-2 flex justify-end">
              <button className="rounded-lg border border-slate-200 p-2" onClick={() => setPreviewFileId(null)} title="关闭">
                <X size={16} />
              </button>
            </div>
            <img src={`/api/uploads/${previewFileId}`} alt="小票大图" className="max-h-[78vh] w-full rounded-lg object-contain" />
          </div>
        </div>
      )}
    </>
  );
}

function ImportantFilesPage({ files, onSave }: { files: ImportantFile[]; onSave: (url: string, options?: RequestInit) => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [editingFile, setEditingFile] = useState<ImportantFile | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<ImportantFile | null>(null);
  useEscapeClose(() => setPreviewFile(null), Boolean(previewFile));
  const filtered = files.filter((file) => {
    const text = `${file.title} ${file.originalName} ${file.notes ?? ""} ${file.tags.join(" ")}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (!category || file.category === category);
  });

  return (
    <>
      <PageHeader
        title="重要文件"
        subtitle="保存证件、签证、学校、住宿和出行材料，文件本体保存在本地 uploads 文件夹。"
        actions={
          <ActionButton
            onClick={() => {
              setEditingFile(null);
              setModalOpen(true);
            }}
            icon={<Upload size={16} />}
            label="上传文件"
          />
        }
      />

      <section className="mb-4 rounded-lg bg-white p-4 shadow-soft">
        <div className="grid gap-3 md:grid-cols-[1fr_180px]">
          <SearchBox value={query} onChange={setQuery} placeholder="搜索文件名、备注或标签" className="mb-0 h-12" />
          <Select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="h-12 shadow-sm"
            options={[["", "全部分类"], ...importantFileCategories.map((item) => [item, item] as [string, string])]}
          />
        </div>
      </section>

      <section className="rounded-lg bg-white p-4 shadow-soft">
        <div className="mb-3 flex items-center justify-between">
          <SectionTitle title="文件列表" />
          <div className="text-sm text-slate-500">{filtered.length} 个</div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.length === 0 && <EmptyBlock text="还没有重要文件。点右上角上传一个。" />}
          {filtered.map((file) => (
            <article key={file.id} className="min-w-0 rounded-lg border border-slate-100 p-3">
              <button
                className="mb-3 flex h-36 w-full items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-slate-50 text-slate-400"
                onClick={() => setPreviewFile(file)}
                title="查看文件"
              >
                {isImageMime(file.mimeType) ? (
                  <img src={`/api/uploads/${file.fileId}`} alt={file.title} className="h-full w-full object-cover" />
                ) : (
                  <FileText size={34} />
                )}
              </button>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold">{file.title}</h3>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <Badge>{file.category}</Badge>
                    {file.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-600">{tag}</span>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                    onClick={() => {
                      setEditingFile(file);
                      setModalOpen(true);
                    }}
                    title="编辑文件"
                  >
                    <Menu size={16} />
                  </button>
                  <button
                    className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50"
                    onClick={async () => {
                      if (confirm("确定删除这个重要文件记录吗？")) {
                        await onSave(`/api/important-files/${file.id}`, { method: "DELETE" });
                      }
                    }}
                    title="删除文件"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="mt-2 break-all text-sm text-slate-500 md:truncate">{file.originalName}</div>
              {file.expiryDate && (
                <div className={`mt-2 text-sm font-medium ${expiryCountdownClass(file.expiryDate)}`}>
                  到期 {formatDateOnly(file.expiryDate)} · {countdownText(file.expiryDate)}
                </div>
              )}
              {file.notes && <p className="mt-2 line-clamp-2 text-sm text-slate-600">{file.notes}</p>}
            </article>
          ))}
        </div>
      </section>

      {modalOpen && (
        <ImportantFileModal
          file={editingFile}
          onClose={() => setModalOpen(false)}
          onSaveRequest={onSave}
          onCreated={async () => {
            await onSave("/api/important-files", { method: "GET" });
          }}
        />
      )}

      {previewFile && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4" onClick={() => setPreviewFile(null)}>
          <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-lg bg-white p-4 shadow-soft" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-xl font-semibold">{previewFile.title}</h2>
                <div className="mt-1 text-sm text-slate-500">{previewFile.originalName}</div>
              </div>
              <button className="rounded-lg border border-slate-200 p-2" onClick={() => setPreviewFile(null)} title="关闭">
                <X size={16} />
              </button>
            </div>
            {isImageMime(previewFile.mimeType) ? (
              <img src={`/api/uploads/${previewFile.fileId}`} alt={previewFile.title} className="max-h-[70vh] w-full rounded-lg object-contain" />
            ) : (
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                <div className="font-medium text-slate-900">{previewFile.originalName}</div>
                <div className="mt-1">{previewFile.mimeType}</div>
                <a className="mt-3 inline-flex rounded-lg bg-slate-900 px-3 py-2 text-white" href={`/api/uploads/${previewFile.fileId}`} target="_blank" rel="noreferrer">
                  打开文件
                </a>
              </div>
            )}
            {previewFile.expiryDate && (
              <div className={`mt-3 rounded-lg bg-slate-50 p-3 text-sm font-medium ${expiryCountdownClass(previewFile.expiryDate)}`}>
                到期 {formatDateOnly(previewFile.expiryDate)} · {countdownText(previewFile.expiryDate)}
              </div>
            )}
            {previewFile.notes && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{previewFile.notes}</p>}
          </div>
        </div>
      )}
    </>
  );
}

function ImportantFileModal({
  file,
  onClose,
  onSaveRequest,
  onCreated
}: {
  file: ImportantFile | null;
  onClose: () => void;
  onSaveRequest: SaveRequest;
  onCreated: () => Promise<void>;
}) {
  const [uploading, setUploading] = useState(false);
  const [fileId, setFileId] = useState(file?.fileId || "");
  const [fileName, setFileName] = useState(file?.originalName || "");
  const [fileTags, setFileTags] = useState<string[]>(file?.tags || []);
  const [filePreviewUrl, setFilePreviewUrl] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  useEscapeClose(onClose);

  useEffect(() => {
    return () => {
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    };
  }, [filePreviewUrl]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/30 p-4 backdrop-blur-sm md:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !dirty) onClose();
      }}
    >
      <form
        className="app-modal-panel max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg bg-white p-5 shadow-soft"
        onChangeCapture={() => setDirty(true)}
        onSubmit={async (event) => {
          event.preventDefault();
          if (!fileId) return;
          const form = new FormData(event.currentTarget);
          const payload = {
            title: form.get("title") || fileName || "未命名文件",
            category: form.get("category"),
            notes: form.get("notes") || null,
            tags: fileTags,
            expiryDate: form.get("expiryDate") || null,
            fileId
          };
          await onSaveRequest(file ? `/api/important-files/${file.id}` : "/api/important-files", {
            method: file ? "PATCH" : "POST",
            body: JSON.stringify(payload)
          });
          await onCreated();
          onClose();
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">{file ? "编辑重要文件" : "上传重要文件"}</h2>
          <button type="button" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" onClick={onClose}>
            关闭
          </button>
        </div>

        <div className="grid gap-3">
          <Input name="title" placeholder="文件名称" defaultValue={file?.title || ""} />
          <div className="grid gap-3 md:grid-cols-2">
            <Select
              name="category"
              defaultValue={file?.category || "其他"}
              options={importantFileCategories.map((item) => [item, item] as [string, string])}
            />
            <TagEditor
              tags={fileTags}
              onChange={(tags) => {
                setDirty(true);
                setFileTags(tags);
              }}
            />
          </div>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            <span>文件到期日</span>
            <Input name="expiryDate" type="date" defaultValue={file?.expiryDate || ""} />
          </label>
          <textarea name="notes" className="min-h-[90px] rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-slate-400" placeholder="备注" defaultValue={file?.notes || ""} />

          <label className="flex cursor-pointer flex-col gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
            <span className="inline-flex items-center gap-2">
              <Upload size={18} />
              {uploading ? "上传中..." : fileName ? `已选择：${fileName}` : "上传文件或图片"}
            </span>
            {fileId && (
              <span className="inline-flex items-center gap-1 text-slate-500">
                <Eye size={15} /> 已保存
              </span>
            )}
            <input
              className="hidden"
              type="file"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
              onChange={async (event) => {
                const selected = event.target.files?.[0];
                if (!selected) return;
                setDirty(true);
                setUploadMessage("");
                if (selected.size > 50 * 1024 * 1024) {
                  setUploadMessage("文件太大了，先控制在 50MB 以内。");
                  event.currentTarget.value = "";
                  return;
                }
                if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
                setFilePreviewUrl(selected.type.startsWith("image/") ? URL.createObjectURL(selected) : "");
                setUploading(true);
                try {
                  const form = new FormData();
                  form.append("file", selected);
                  form.append("linkedEntityType", "important_file");
                  const response = await fetch("/api/upload", { method: "POST", body: form });
                  if (!response.ok) throw new Error("upload failed");
                  const metadata = await response.json();
                  setFileId(String(metadata.id));
                  setFileName(selected.name);
                  setUploadMessage("上传完成，可以保存。");
                } catch {
                  setUploadMessage("上传失败，请确认电脑服务还开着，然后再试一次。");
                } finally {
                  setUploading(false);
                }
              }}
            />
          </label>
          {filePreviewUrl && (
            <img src={filePreviewUrl} alt="文件预览" className="max-h-56 w-full rounded-lg border border-slate-100 object-contain" />
          )}
          {uploadMessage && <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{uploadMessage}</div>}
        </div>

        <button className="mt-5 w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white" disabled={!fileId || uploading}>
          保存
        </button>
      </form>
    </div>
  );
}

function ExpenseStatCard({ title, amount }: { title: string; amount: Record<string, number> }) {
  return (
    <section className="rounded-lg bg-white p-4 shadow-soft">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="mt-2 text-2xl font-semibold">{formatExpenseTotals(amount)}</div>
    </section>
  );
}

function SettingsPage({
  background,
  setBackground,
  onUploaded,
  syncState,
  onManualSync,
  onCheckSync
}: {
  background: string;
  setBackground: (value: string) => void;
  onUploaded: () => void;
  syncState: SyncState;
  onManualSync: () => void;
  onCheckSync: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [currentUrl, setCurrentUrl] = useState("http://电脑局域网IP:3011");
  const [phoneUrl, setPhoneUrl] = useState("");
  const [storageInfo, setStorageInfo] = useState({
    databasePath: "正在读取...",
    uploadsDir: "正在读取...",
    port: "3011"
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    setCurrentUrl(`${window.location.protocol}//${window.location.host}`);

    async function refreshNetworkUrl() {
      try {
        const [networkResponse, healthResponse] = await Promise.all([
          fetch("/api/network", { cache: "no-store" }),
          fetch("/api/health", { cache: "no-store" })
        ]);
        if (networkResponse.ok) {
          const data = (await networkResponse.json()) as { url?: string; port?: number };
          setPhoneUrl(data.url || "");
          setStorageInfo((current) => ({ ...current, port: String(data.port || current.port) }));
        }
        if (healthResponse.ok) {
          const data = (await healthResponse.json()) as { databasePath?: string; uploadsDir?: string; port?: number };
          setStorageInfo((current) => ({
            databasePath: data.databasePath || current.databasePath,
            uploadsDir: data.uploadsDir || current.uploadsDir,
            port: String(data.port || current.port)
          }));
        }
      } catch {
        setPhoneUrl("");
      }
    }

    void refreshNetworkUrl();
    const timer = window.setInterval(refreshNetworkUrl, 15000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <>
      <PageHeader title="设置" subtitle="本地路径、背景、备份和未来功能占位。" />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg bg-white p-4 shadow-soft">
          <SectionTitle title="本地存储" />
          <InfoRow label="数据库路径" value={storageInfo.databasePath} />
          <InfoRow label="上传路径" value={storageInfo.uploadsDir} />
          <InfoRow label="服务端口" value={storageInfo.port} />
          <a className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white" href="/api/backup/export">
            <Download size={16} /> 导出 JSON 备份
          </a>
        </section>
        <section className="rounded-lg bg-white p-4 shadow-soft">
          <div className="mb-3 flex items-center justify-between gap-3">
            <SectionTitle title="手机访问 / 同步状态" />
            <SyncStatusPill state={syncState} />
          </div>
          <InfoRow label="当前端口" value={storageInfo.port} />
          <InfoRow label="当前打开地址" value={currentUrl} />
          <InfoRow label="手机输入这个网址" value={phoneUrl || "正在读取电脑局域网 IP..."} />
          {syncState.lastSyncAt && <InfoRow label="上次同步" value={formatDateTime(syncState.lastSyncAt)} />}
          <div className="space-y-3 text-sm text-slate-600">
            <p>电脑和手机连接同一个 Wi‑Fi，或者电脑连接手机热点后，在手机浏览器里输入下面这个地址。</p>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-slate-500">实时手机访问网址</div>
              <div className="mt-1 break-all font-mono text-base font-semibold text-slate-900">{phoneUrl || "正在读取..."}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="font-medium text-slate-800">Mac 获取方式</div>
              <div className="mt-1">系统设置 → Wi‑Fi → 当前网络详情，查看 IP 地址。</div>
              <div className="mt-1 font-mono text-xs text-slate-500">也可以在终端运行：ipconfig getifaddr en0</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="font-medium text-slate-800">Windows 获取方式</div>
              <div className="mt-1">打开命令提示符，运行 ipconfig，查看 IPv4 地址。</div>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="text-slate-500">手机访问格式</div>
              <div className="mt-1 break-all font-mono text-slate-900">http://电脑局域网IP:3011</div>
              <div className="mt-2 text-slate-500">当前示例</div>
              <div className="mt-1 break-all font-mono text-slate-900">{phoneUrl || "http://192.168.1.23:3011"}</div>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="font-medium text-slate-800">离线暂存</div>
              <div className="mt-1">{syncState.message}</div>
              <div className="mt-2 text-xs text-slate-500">待同步 {syncState.pendingCount} 条 · 失败 {syncState.failedCount} 条</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-700" onClick={onCheckSync}>
                  检查连接
                </button>
                <button type="button" className="rounded-lg bg-slate-900 px-3 py-2 font-medium text-white" onClick={onManualSync}>
                  手动同步
                </button>
              </div>
            </div>
          </div>
        </section>
        <section className="rounded-lg bg-white p-4 shadow-soft">
          <SectionTitle title="外观" />
          <Select
            value={background}
            onChange={(event) => setBackground(event.target.value)}
            options={[
              ["default", "Default"],
              ["ocean", "Ocean"],
              ["city", "City"],
              ["forest", "Forest"],
              ["starry", "Starry sky"],
              ["usyd", "USYD Main Building"]
            ]}
          />
          <p className="mt-3 text-sm text-slate-500">主题偏好保存在 localStorage，主数据仍然全部进入 SQLite。</p>
        </section>
        <section className="rounded-lg bg-white p-4 shadow-soft">
          <SectionTitle title="上传" />
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 p-5 text-sm text-slate-600">
            <Upload size={18} />
            {uploading ? "上传中..." : "选择文件上传到 ./uploads"}
            <input
              className="hidden"
              type="file"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setUploadMessage("");
                if (file.size > 50 * 1024 * 1024) {
                  setUploadMessage("文件太大了，先控制在 50MB 以内。");
                  event.currentTarget.value = "";
                  return;
                }
                setUploading(true);
                try {
                  const form = new FormData();
                  form.append("file", file);
                  const response = await fetch("/api/upload", { method: "POST", body: form });
                  if (!response.ok) throw new Error("upload failed");
                  setUploadMessage("上传完成。");
                  onUploaded();
                } catch {
                  setUploadMessage("上传失败，请确认电脑服务还开着，然后再试一次。");
                } finally {
                  setUploading(false);
                }
              }}
            />
          </label>
          {uploadMessage && <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{uploadMessage}</div>}
        </section>
        <section className="rounded-lg bg-white p-4 shadow-soft">
          <SectionTitle title="未来功能占位" />
          <div className="space-y-2 text-sm text-slate-600">
            <div>Import backup：占位，MVP 暂不导入。</div>
            <div>Canvas / USYD sync：占位，MVP 暂不同步。</div>
            <div>OCR 手写计划：占位，MVP 暂不识别。</div>
            <div>AI 周/月复盘：占位，MVP 暂不启用。</div>
          </div>
        </section>
      </div>
    </>
  );
}

function ExpenseModal({
  expense,
  onClose,
  onCreated,
  onSaveRequest
}: {
  expense: Expense | null;
  onClose: () => void;
  onCreated: () => Promise<void>;
  onSaveRequest: SaveRequest;
}) {
  const [uploading, setUploading] = useState(false);
  const [receiptFileId, setReceiptFileId] = useState(expense?.receiptFileId || "");
  const [receiptName, setReceiptName] = useState(expense?.receiptOriginalName || "");
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  useEscapeClose(onClose);

  useEffect(() => {
    return () => {
      if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl);
    };
  }, [receiptPreviewUrl]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/30 p-4 backdrop-blur-sm md:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !dirty) onClose();
      }}
    >
      <form
        className="app-modal-panel max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg bg-white p-5 shadow-soft"
        onChangeCapture={() => setDirty(true)}
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const payload = {
            title: form.get("title"),
            amount: Number(form.get("amount") || 0),
            currency: form.get("currency"),
            category: form.get("category"),
            date: form.get("date"),
            merchant: form.get("merchant") || null,
            paymentMethod: form.get("paymentMethod") || null,
            notes: form.get("notes") || null,
            receiptFileId: receiptFileId || null
          };
          await onSaveRequest(expense ? `/api/expenses/${expense.id}` : "/api/expenses", {
            method: expense ? "PATCH" : "POST",
            body: JSON.stringify(payload)
          });
          await onCreated();
          onClose();
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">{expense ? "编辑消费" : "新增消费"}</h2>
          <button type="button" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" onClick={onClose}>
            关闭
          </button>
        </div>

        <div className="grid gap-3">
          <Input name="title" placeholder="消费标题" defaultValue={expense?.title || ""} required />
          <div className="grid gap-3 md:grid-cols-3">
            <Input name="amount" type="number" min="0" step="0.01" placeholder="金额" defaultValue={expense?.amount ?? ""} required />
            <Select name="currency" defaultValue={expense?.currency || "AUD"} options={[["AUD", "AUD"], ["CNY", "CNY"], ["USD", "USD"]]} />
            <Select
              name="category"
              defaultValue={expense?.category || "吃饭"}
              required
              options={expenseCategories.map((item) => [item, item] as [string, string])}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Input name="date" type="date" defaultValue={expense?.date || new Date().toISOString().slice(0, 10)} required />
            <Input name="merchant" placeholder="商家，可选" defaultValue={expense?.merchant || ""} />
            <Select
              name="paymentMethod"
              defaultValue={expense?.paymentMethod || ""}
              options={[["", "支付方式，可选"], ...paymentMethods.map((item) => [item, item] as [string, string])]}
            />
          </div>
          <textarea name="notes" className="min-h-[90px] rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-slate-400" placeholder="备注，可选" defaultValue={expense?.notes || ""} />

          <label className="flex cursor-pointer flex-col gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
            <span className="inline-flex items-center gap-2">
              <Upload size={18} />
              {uploading ? "上传中..." : receiptName ? `已关联：${receiptName}` : "上传小票/账单照片，可选"}
            </span>
            {receiptFileId && (
              <span className="inline-flex items-center gap-1 text-slate-500">
                <Eye size={15} /> 已保存
              </span>
            )}
            <input
              className="hidden"
              type="file"
              accept="image/*,.pdf"
              capture={undefined}
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setDirty(true);
                if (file.size > 20 * 1024 * 1024) {
                  setUploadMessage("文件太大，请选择 20MB 以内的图片或 PDF。");
                  return;
                }
                if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl);
                setReceiptPreviewUrl(file.type.startsWith("image/") ? URL.createObjectURL(file) : "");
                setUploading(true);
                setUploadMessage("正在上传到电脑...");
                const form = new FormData();
                form.append("file", file);
                form.append("linkedEntityType", "expense");
                try {
                  const response = await fetch("/api/upload", { method: "POST", body: form });
                  if (!response.ok) throw new Error("上传失败");
                  const metadata = await response.json();
                  setReceiptFileId(String(metadata.id));
                  setReceiptName(file.name);
                  setUploadMessage("已上传到电脑。");
                } catch {
                  setUploadMessage("上传失败，请确认电脑端服务正在运行。");
                } finally {
                  setUploading(false);
                }
              }}
            />
          </label>
          {uploadMessage && <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{uploadMessage}</div>}
          {receiptPreviewUrl ? (
            <img src={receiptPreviewUrl} alt="小票预览" className="h-40 w-full rounded-lg border border-slate-100 object-contain" />
          ) : receiptFileId && isImageMime(expense?.receiptMimeType || "") && (
            <img src={`/api/uploads/${receiptFileId}`} alt="小票预览" className="h-40 w-full rounded-lg border border-slate-100 object-contain" />
          )}
        </div>

        <button className="mt-5 w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
          保存
        </button>
      </form>
    </div>
  );
}

function QuickModal({
  mode,
  task,
  expense,
  tasks,
  onClose,
  onCreated,
  onSaveRequest
}: {
  mode: ModalMode;
  task: Task | null;
  expense: Expense | null;
  tasks: Task[];
  onClose: () => void;
  onCreated: () => Promise<void>;
  onSaveRequest: SaveRequest;
}) {
  useEscapeClose(onClose);

  if (mode === "expense") {
    return <ExpenseModal expense={expense} onClose={onClose} onCreated={onCreated} onSaveRequest={onSaveRequest} />;
  }

  const isDeadlineForm = mode === "deadline" || task?.type === "deadline";
  const initialReminder = parseReminderRule(task?.reminderRule);
  const [reminderType, setReminderType] = useState<ReminderRule["type"]>(initialReminder.type);
  const [customMode, setCustomMode] = useState<"hourly" | "daily" | "progress" | "before_due">(
    initialReminder.type === "custom" ? initialReminder.mode : "before_due"
  );
  const [frequencyHours, setFrequencyHours] = useState(initialReminder.type === "custom" ? String(initialReminder.frequencyHours ?? 1) : "1");
  const [maxCount, setMaxCount] = useState(initialReminder.type === "custom" ? String(initialReminder.maxCount ?? 3) : "3");
  const [progressPercent, setProgressPercent] = useState(initialReminder.type === "custom" ? String(initialReminder.progressPercent ?? 80) : "80");
  const [beforeAmount, setBeforeAmount] = useState(initialReminder.type === "custom" ? String(initialReminder.beforeAmount ?? 1) : "1");
  const [beforeUnit, setBeforeUnit] = useState<"minutes" | "hours" | "days">(
    initialReminder.type === "custom" ? initialReminder.beforeUnit ?? "hours" : "hours"
  );
  const [progressEnabled, setProgressEnabled] = useState(Boolean(task?.progressEnabled || task?.progressTarget || mode === "counter"));
  const [progressType, setProgressType] = useState(task?.progressType || "count");
  const [todoDate, setTodoDate] = useState(new Date().toISOString().slice(0, 10));
  const [todoItems, setTodoItems] = useState<TodoDraftItem[]>([createTodoDraftItem()]);
  const [selectedTaskType, setSelectedTaskType] = useState<TaskType>(
    isDeadlineForm ? "deadline" : normalizeType(task?.type || "todo")
  );
  const [taskTags, setTaskTags] = useState<string[]>(() => {
    const initialTags = task?.tags || [];
    return normalizeType(task?.type) === "checklist" && !initialTags.includes("清单")
      ? [...initialTags, "清单"]
      : initialTags;
  });
  const [checklistItems, setChecklistItems] = useState<TodoDraftItem[]>(() =>
    task?.subtasks?.length
      ? task.subtasks.map((subtask) => ({ id: subtask.id, title: subtask.title, completed: subtask.completed }))
      : [createTodoDraftItem()]
  );
  const [dirty, setDirty] = useState(false);
  const modalTitle = task
    ? "编辑任务"
    : mode === "todoList"
      ? "新增 To Do List"
      : mode === "deadline"
        ? "Add Deadline"
        : mode === "plan"
          ? "Add Plan"
          : mode === "counter"
            ? "Add Counter Goal"
            : "Add Task";

  function serializeReminderRule() {
    if (reminderType !== "custom") return reminderType;
    return JSON.stringify({
      type: "custom",
      mode: customMode,
      frequencyHours: Math.max(1, Number(frequencyHours || 1)),
      maxCount: Math.max(1, Number(maxCount || 1)),
      progressPercent: Math.min(100, Math.max(1, Number(progressPercent || 1))),
      beforeAmount: Math.max(1, Number(beforeAmount || 1)),
      beforeUnit
    } satisfies ReminderRule);
  }

  function changeTaskType(nextType: TaskType) {
    setSelectedTaskType(nextType);
    setTaskTags((currentTags) => {
      if (nextType === "checklist") return currentTags.includes("清单") ? currentTags : [...currentTags, "清单"];
      return currentTags.filter((tag) => tag !== "清单");
    });
    if (nextType === "counter") setProgressEnabled(true);
    setDirty(true);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/30 p-4 backdrop-blur-sm md:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !dirty) onClose();
      }}
    >
      <form
        className="app-modal-panel max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg bg-white p-5 shadow-soft"
        onChangeCapture={() => setDirty(true)}
        onSubmit={async (event) => {
          event.preventDefault();
          try {
          const form = new FormData(event.currentTarget);
          if (mode === "todoList") {
            const itemDrafts = todoItems
              .map((item) => ({ content: item.title.trim(), completed: item.completed }))
              .filter((item) => item.content);
            if (itemDrafts.length === 0) {
              alert("请至少添加一个待办条目。");
              return;
            }
            await onSaveRequest("/api/todo-lists", {
              method: "POST",
              body: JSON.stringify({
                title: buildTodoListTitle(todoDate),
                date: todoDate,
                notes: String(form.get("notes") || ""),
                itemDrafts
              })
            });
          } else if (mode === "plan") {
            const taskIds = form.getAll("taskIds").map(String);
            await onSaveRequest("/api/plans", {
              method: "POST",
              body: JSON.stringify({
                title: form.get("title"),
                type: form.get("planType"),
                startDate: form.get("startDate"),
                endDate: form.get("endDate"),
                reflectionNote: form.get("reflectionNote"),
                taskIds
              })
            });
          } else if (mode === "counter") {
            await onSaveRequest("/api/tasks", {
              method: "POST",
              body: JSON.stringify({
                title: form.get("title"),
                description: "",
                type: "counter",
                status: "not_started",
                priority: "medium",
                tags: [String(form.get("category") || "进度")],
                progressEnabled: true,
                progressType,
                progressCurrent: Number(form.get("progressCurrent") || 0),
                progressTarget: Number(form.get("progressTarget") || 1),
                progressUnit: form.get("progressUnit") || defaultProgressUnit(progressType),
                pinnedToBottom: form.get("pinnedToBottom") === "on"
              })
            });
          } else {
            const payload = {
              title: form.get("title"),
              description: form.get("description"),
              type: isDeadlineForm ? "deadline" : selectedTaskType,
              status: isDeadlineForm ? task?.status ?? "not_started" : form.get("status"),
              priority: task?.priority ?? "medium",
              tags: selectedTaskType === "checklist" && !taskTags.includes("清单") ? [...taskTags, "清单"] : taskTags,
              subtasks: selectedTaskType === "checklist"
                ? checklistItems
                    .map((item) => ({ id: item.id, title: item.title.trim(), completed: item.completed }))
                    .filter((item) => item.title)
                : [],
              startDate: form.get("startDate") || null,
              dueDate: form.get("dueDate") || null,
              reminderRule: serializeReminderRule(),
              progressCurrent: form.get("progressCurrent") ? Number(form.get("progressCurrent")) : null,
              progressTarget: form.get("progressTarget") ? Number(form.get("progressTarget")) : null,
              progressUnit: progressEnabled ? form.get("progressUnit") || defaultProgressUnit(progressType) : null,
              progressEnabled,
              progressType: progressEnabled ? progressType : "none",
              pinnedToBottom: progressEnabled && form.get("pinnedToBottom") === "on"
            };
            await onSaveRequest(task ? `/api/tasks/${task.id}` : "/api/tasks", {
              method: task ? "PATCH" : "POST",
              body: JSON.stringify(payload)
            });
          }
          await onCreated();
          onClose();
          } catch (error) {
            alert(`保存失败：${error instanceof Error ? error.message : "请确认本地服务正在运行"}`);
          }
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">{modalTitle}</h2>
          <button type="button" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" onClick={onClose}>
            关闭
          </button>
        </div>

        {mode === "todoList" ? (
          <div className="grid gap-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-xs text-slate-500">标题</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{buildTodoListTitle(todoDate)}</div>
            </div>
            <Input name="date" type="date" value={todoDate} onChange={(event) => setTodoDate(event.target.value)} required />
            <TodoChecklistEditor
              items={todoItems}
              onChange={(items) => {
                setDirty(true);
                setTodoItems(items);
              }}
            />
            <textarea name="notes" className="min-h-[70px] rounded-lg border border-slate-200 p-3 outline-none focus:border-slate-400" placeholder="备注，可选" />
          </div>
        ) : mode === "plan" ? (
          <div className="grid gap-3">
            <Input name="title" placeholder="计划标题" required />
            <Select name="planType" options={[["daily", "Daily"], ["weekly", "Weekly"], ["monthly", "Monthly"]]} />
            <div className="grid gap-3 md:grid-cols-2">
              <Input name="startDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
              <Input name="endDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
            </div>
            <textarea name="reflectionNote" className="min-h-[100px] rounded-lg border border-slate-200 p-3 outline-none focus:border-slate-400" placeholder="日计划复盘，可留空" />
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="mb-2 text-sm font-medium">加入任务</div>
              <div className="grid gap-2 md:grid-cols-2">
                {tasks.map((item) => (
                  <label key={item.id} className="flex items-center gap-2 text-sm text-slate-600">
                    <input type="checkbox" name="taskIds" value={item.id} />
                    <span className="truncate">{item.title}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        ) : mode === "counter" ? (
          <div className="grid gap-3">
            <Input name="title" placeholder="进度名称" required />
            <Select
              value={progressType}
              onChange={(event) => setProgressType(event.target.value as typeof progressType)}
              options={[
                ["count", "次数"],
                ["pages", "阅读页数"],
                ["percentage", "百分比"],
                ["time", "时间"],
                ["custom", "自定义单位"]
              ]}
            />
            <div className="grid gap-3 md:grid-cols-3">
              <Input name="progressCurrent" type="number" defaultValue="0" />
              <Input name="progressTarget" type="number" defaultValue="10" />
              <Input name="progressUnit" placeholder="单位，例如 次 / 页 / 小时 / %" defaultValue={defaultProgressUnit(progressType)} />
            </div>
            <Input name="category" placeholder="分类，例如 football / study" />
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <input type="checkbox" name="pinnedToBottom" defaultChecked={false} />
              固定到底部进度条
            </label>
          </div>
        ) : (
          <div className="grid gap-3">
            <Input name="title" placeholder="标题" defaultValue={task?.title || ""} required />
            <TagEditor
              tags={taskTags}
              onChange={(tags) => {
                setDirty(true);
                setTaskTags(
                  selectedTaskType === "checklist" && !tags.includes("清单")
                    ? [...tags, "清单"]
                    : tags
                );
              }}
            />
            <textarea name="description" className="min-h-[90px] rounded-lg border border-slate-200 p-3 outline-none focus:border-slate-400" placeholder="描述" defaultValue={task?.description || ""} />
            {!isDeadlineForm && (
              <div className="grid gap-3 md:grid-cols-2">
                <Select
                  name="type"
                  value={selectedTaskType}
                  onChange={(event) => changeTaskType(event.target.value as TaskType)}
                  options={[
                    ["todo", "待办"],
                    ["counter", "计数"],
                    ["checklist", "清单"]
                  ]}
                />
                <Select name="status" defaultValue={task?.status === "archived" ? "completed" : task?.status || "not_started"} options={[["not_started", "未开始"], ["in_progress", "进行中"], ["completed", "已完成"]]} />
              </div>
            )}
            {!isDeadlineForm && selectedTaskType === "checklist" && (
              <TodoChecklistEditor
                items={checklistItems}
                onChange={(items) => {
                  setDirty(true);
                  setChecklistItems(items);
                }}
              />
            )}
            <div className="grid gap-3 md:grid-cols-2">
              <Input name="startDate" type="date" defaultValue={task?.startDate || ""} />
              <Input name="dueDate" type="datetime-local" defaultValue={toDateTimeInputValue(task?.dueDate)} />
            </div>
            <Select
              value={reminderType}
              onChange={(event) => setReminderType(event.target.value as ReminderRule["type"])}
              options={[
                ["none", "不提醒"],
                ["deadline_24h", "24 小时前"],
                ["daily_until_due", "每天直到截止"],
                ["hourly_until_due", "每小时直到截止"],
                ["custom", "自定义"]
              ]}
            />
            {reminderType === "custom" && (
              <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <Select
                  value={customMode}
                  onChange={(event) => setCustomMode(event.target.value as typeof customMode)}
                  options={[
                    ["before_due", "按截止前多久"],
                    ["hourly", "按每小时频率"],
                    ["daily", "按每天频率"],
                    ["progress", "按进度百分比"]
                  ]}
                />
                {(customMode === "hourly" || customMode === "daily") && (
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input
                      type="number"
                      min="1"
                      value={customMode === "daily" ? "24" : frequencyHours}
                      onChange={(event) => setFrequencyHours(event.target.value)}
                      disabled={customMode === "daily"}
                      placeholder="频率，小时"
                    />
                    <Input type="number" min="1" value={maxCount} onChange={(event) => setMaxCount(event.target.value)} placeholder="提醒次数" />
                  </div>
                )}
                {customMode === "progress" && (
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={progressPercent}
                    onChange={(event) => setProgressPercent(event.target.value)}
                    placeholder="进度达到百分比"
                  />
                )}
                {customMode === "before_due" && (
                  <div className="grid gap-3 md:grid-cols-[1fr_160px]">
                    <Input type="number" min="1" value={beforeAmount} onChange={(event) => setBeforeAmount(event.target.value)} placeholder="截止前多久" />
                    <Select
                      value={beforeUnit}
                      onChange={(event) => setBeforeUnit(event.target.value as typeof beforeUnit)}
                      options={[
                        ["minutes", "分钟"],
                        ["hours", "小时"],
                        ["days", "天"]
                      ]}
                    />
                  </div>
                )}
              </div>
            )}
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <input type="checkbox" checked={progressEnabled} onChange={(event) => setProgressEnabled(event.target.checked)} />
              开启进度追踪
            </label>
            {progressEnabled && (
              <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <Select
                  value={progressType}
                  onChange={(event) => setProgressType(event.target.value as typeof progressType)}
                  options={[
                    ["count", "次数"],
                    ["pages", "阅读页数"],
                    ["percentage", "百分比"],
                    ["time", "时间"],
                    ["custom", "自定义单位"]
                  ]}
                />
                <div className="grid gap-3 md:grid-cols-3">
                  <Input name="progressCurrent" type="number" placeholder="当前进度" defaultValue={task?.progressCurrent ?? 0} />
                  <Input name="progressTarget" type="number" placeholder="目标值" defaultValue={task?.progressTarget ?? (progressType === "percentage" ? 100 : "")} />
                  <Input name="progressUnit" placeholder="单位" defaultValue={task?.progressUnit || defaultProgressUnit(progressType)} />
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" name="pinnedToBottom" defaultChecked={Boolean(task?.pinnedToBottom)} />
                  固定到底部进度条
                </label>
              </div>
            )}
          </div>
        )}
        <button className="mt-5 w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
          保存
        </button>
      </form>
    </div>
  );
}

function TagEditor({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState("");

  function addTag(value: string) {
    const clean = value.trim().replace(/^#+/, "").trim();
    if (!clean) return;
    if (tags.some((tag) => tag.toLowerCase() === clean.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...tags, clean]);
    setDraft("");
  }

  function removeTag(tagToRemove: string) {
    onChange(tags.filter((tag) => tag !== tagToRemove));
  }

  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2 outline-none focus-within:border-slate-400">
      <div className="flex min-h-[32px] flex-wrap items-center gap-2">
        {tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
            {tag}
            <button
              type="button"
              className="ml-1 rounded-full text-slate-400 transition hover:text-slate-700"
              onClick={() => removeTag(tag)}
              title={`删除标签 ${tag}`}
            >
              <X size={13} />
            </button>
          </span>
        ))}
        <input
          className="min-w-[160px] flex-1 border-none bg-transparent py-1 text-sm outline-none placeholder:text-slate-400"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addTag(draft);
            }
            if (event.key === "Backspace" && !draft && tags.length > 0) {
              event.preventDefault();
              onChange(tags.slice(0, -1));
            }
          }}
          onBlur={() => addTag(draft)}
          placeholder={tags.length === 0 ? "输入标签，按回车生成" : "继续添加标签"}
        />
      </div>
    </div>
  );
}

function TodoChecklistEditor({
  items,
  onChange
}: {
  items: TodoDraftItem[];
  onChange: (items: TodoDraftItem[]) => void;
}) {
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingFocusId) return;
    inputRefs.current[pendingFocusId]?.focus();
    setPendingFocusId(null);
  }, [items, pendingFocusId]);

  function updateItem(id: string, patch: Partial<TodoDraftItem>) {
    onChange(items.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  function addItem(afterId?: string) {
    const nextItem = createTodoDraftItem();
    if (!afterId) {
      onChange([...items, nextItem]);
      setPendingFocusId(nextItem.id);
      return;
    }
    const index = items.findIndex((item) => item.id === afterId);
    const nextItems = [...items];
    nextItems.splice(index + 1, 0, nextItem);
    onChange(nextItems);
    setPendingFocusId(nextItem.id);
  }

  function removeItem(id: string) {
    const nextItems = items.filter((item) => item.id !== id);
    onChange(nextItems.length > 0 ? nextItems : [createTodoDraftItem()]);
  }

  function focusItemByIndex(index: number) {
    const target = items[index];
    if (target) inputRefs.current[target.id]?.focus();
  }

  function handleItemArrowNavigation(event: React.KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    const nextIndex = event.key === "ArrowUp" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= items.length) return;
    event.preventDefault();
    focusItemByIndex(nextIndex);
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-2 text-sm font-medium text-slate-700">待办条目</div>
      <div className="space-y-1">
        {items.map((item, index) => (
          <div key={item.id} className="group flex items-center gap-2 rounded-lg px-1 py-1.5">
            <button
              type="button"
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition ${
                item.completed ? "border-yellow-500 bg-yellow-500 text-white" : "border-slate-300 bg-white text-transparent hover:border-slate-400"
              }`}
              onClick={() => updateItem(item.id, { completed: !item.completed })}
              title={item.completed ? "取消完成" : "标记完成"}
            >
              <Check size={14} />
            </button>
            <input
              ref={(element) => {
                inputRefs.current[item.id] = element;
              }}
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none"
              value={item.title}
              onChange={(event) => updateItem(item.id, { title: event.target.value })}
              onKeyDown={(event) => {
                handleItemArrowNavigation(event, index);
                if (event.defaultPrevented) return;
                if (event.key === "Enter") {
                  event.preventDefault();
                  addItem(item.id);
                }
                if (event.key === "Backspace" && item.title === "" && items.length > 1) {
                  event.preventDefault();
                  removeItem(item.id);
                }
              }}
              placeholder={index === 0 ? "待办条目" : ""}
            />
            <button
              type="button"
              className="rounded-lg p-1 text-slate-300 opacity-0 transition hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100"
              onClick={() => removeItem(item.id)}
              title="删除条目"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="mt-2 rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100" onClick={() => addItem()}>
        + 添加一行
      </button>
    </div>
  );
}

function PinnedProgress({
  item,
  items,
  open,
  setOpen,
  onPin,
  onOpenTask
}: {
  item: ProgressItem;
  items: ProgressItem[];
  open: boolean;
  setOpen: (value: boolean) => void;
  onPin: (id: string) => void;
  onOpenTask: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open, setOpen]);

  return (
    <div ref={containerRef} className="fixed inset-x-2 top-[calc(env(safe-area-inset-top)+8px)] z-40 max-w-[calc(100vw-16px)] md:bottom-4 md:left-[calc(50%+40px)] md:right-auto md:top-auto md:w-[560px] md:max-w-none md:-translate-x-1/2">
      {open && (
        <div className="mb-2 max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white p-2 shadow-soft">
          {items.map((progress) => (
            <button
              key={progress.id}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"
              onClick={() => {
                onPin(progress.id);
                setOpen(false);
              }}
            >
              <span>{progress.title}</span>
              <span className="text-slate-500">{progress.currentValue} / {progress.targetValue} {progress.unit}</span>
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-left shadow-soft md:p-3"
        onClick={onOpenTask}
        title="打开任务页的有进度筛选"
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{item.title}</div>
            <ProgressLine current={item.currentValue} target={item.targetValue} unit={item.unit} compact />
          </div>
          <span
            className="rounded-lg border border-slate-200 p-2"
            onClick={(event) => {
              event.stopPropagation();
              setOpen(!open);
            }}
            title="展开进度列表"
          >
            <ChevronDown size={16} />
          </span>
        </div>
      </button>
    </div>
  );
}

function MobileNav({
  activeView,
  onSelect
}: {
  activeView: View;
  onSelect: (item: (typeof navItems)[number]) => void;
}) {
  const mobileItems = navItems.slice(0, 9);
  const navRef = useRef<HTMLElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const longPressTimer = useRef<number | null>(null);
  const didScrub = useRef(false);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubIndex, setScrubIndex] = useState(() => Math.max(0, mobileItems.findIndex((item) => item.view === activeView)));
  const [sliderStyle, setSliderStyle] = useState({ left: 0, width: 0 });

  function clearLongPressTimer() {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function updateSlider(index: number) {
    const nav = navRef.current;
    const item = itemRefs.current[index];
    if (!nav || !item) return;
    setSliderStyle({
      left: item.offsetLeft - nav.scrollLeft,
      width: item.offsetWidth
    });
  }

  function itemIndexFromPoint(clientX: number) {
    const index = itemRefs.current.findIndex((item) => {
      if (!item) return false;
      const rect = item.getBoundingClientRect();
      return clientX >= rect.left && clientX <= rect.right;
    });
    return index >= 0 ? index : scrubIndex;
  }

  function startScrub(index: number) {
    setScrubIndex(index);
    updateSlider(index);
    setScrubbing(true);
    didScrub.current = true;
  }

  function handlePointerDown(event: React.PointerEvent<HTMLButtonElement>, index: number) {
    if (event.pointerType === "mouse") return;
    clearLongPressTimer();
    pointerStart.current = { x: event.clientX, y: event.clientY };
    longPressTimer.current = window.setTimeout(() => {
      event.currentTarget.setPointerCapture?.(event.pointerId);
      startScrub(index);
    }, 180);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLElement>) {
    if (!scrubbing) {
      if (pointerStart.current) {
        const moved = Math.hypot(event.clientX - pointerStart.current.x, event.clientY - pointerStart.current.y);
        if (moved > 8) clearLongPressTimer();
      }
      return;
    }
    event.preventDefault();
    const nextIndex = itemIndexFromPoint(event.clientX);
    setScrubIndex(nextIndex);
    updateSlider(nextIndex);
  }

  function finishScrub() {
    clearLongPressTimer();
    pointerStart.current = null;
    if (scrubbing) {
      const target = mobileItems[scrubIndex];
      if (target) onSelect(target);
    }
    setScrubbing(false);
    window.setTimeout(() => {
      didScrub.current = false;
    }, 80);
  }

  useEffect(() => {
    if (scrubbing) updateSlider(scrubIndex);
  }, [scrubbing, scrubIndex]);

  return (
    <nav
      ref={navRef}
      className="mobile-bottom-nav fixed bottom-0 left-0 right-0 z-50 flex max-w-[100dvw] gap-1 overflow-x-auto overflow-y-hidden border-t border-slate-200 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-soft backdrop-blur md:hidden"
      onPointerMove={handlePointerMove}
      onPointerUp={finishScrub}
      onPointerCancel={finishScrub}
      onContextMenu={(event) => event.preventDefault()}
      onScroll={() => {
        if (scrubbing) updateSlider(scrubIndex);
      }}
    >
      {scrubbing && (
        <div
          className="pointer-events-none absolute top-2 h-[52px] rounded-[18px] border border-white/80 bg-white/45 shadow-[0_8px_26px_rgba(15,23,42,0.22)] ring-1 ring-slate-900/10 backdrop-blur-xl transition-[left,width] duration-100"
          style={{ left: sliderStyle.left, width: sliderStyle.width }}
        />
      )}
      {mobileItems.map((item, index) => (
        <button
          key={item.view}
          type="button"
          ref={(node) => {
            itemRefs.current[index] = node;
          }}
          aria-current={activeView === item.view ? "page" : undefined}
          onPointerDown={(event) => handlePointerDown(event, index)}
          onContextMenu={(event) => event.preventDefault()}
          onClick={() => {
            if (didScrub.current) {
              didScrub.current = false;
              return;
            }
            onSelect(item);
          }}
          className={`mobile-nav-item relative z-10 flex w-20 shrink-0 select-none flex-col items-center gap-1 rounded-lg px-2 py-2 text-[11px] leading-tight transition ${
            activeView === item.view && !scrubbing ? "bg-slate-900 text-white" : scrubIndex === index && scrubbing ? "text-slate-950" : "text-slate-600"
          }`}
        >
          {item.icon}
          <span className="w-full truncate text-center">{item.label.replace("（维修中）", "")}</span>
        </button>
      ))}
    </nav>
  );
}

function ActionButton({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-sm" onClick={onClick}>
      {icon}
      {label}
    </button>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <h2 className="mb-3 text-base font-semibold">{title}</h2>;
}

function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "red" | "green" }) {
  const className =
    tone === "red"
      ? "bg-red-100 text-red-700"
      : tone === "green"
        ? "bg-emerald-100 text-emerald-700"
        : "bg-slate-100 text-slate-600";
  return <span className={`rounded-lg px-2 py-1 text-xs ${className}`}>{children}</span>;
}

function ProgressLine({
  current,
  target,
  unit,
  compact = false
}: {
  current: number;
  target: number;
  unit: string;
  compact?: boolean;
}) {
  const percent = Math.min(100, Math.round((current / Math.max(target, 1)) * 100));
  return (
    <div className={compact ? "mt-1" : "mt-2"}>
      <div className="mb-1 flex justify-between text-xs text-slate-500">
        <span>{current} / {target} {unit}</span>
        <span>{percent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-lg bg-slate-100">
        <div className="h-full rounded-lg bg-slate-900" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function SearchBox({
  value,
  onChange,
  placeholder,
  className = ""
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <label className={`mb-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm ${className}`}>
      <Search size={16} className="text-slate-400" />
      <input className="w-full bg-transparent text-sm outline-none" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input className={`rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 ${className}`} {...rest} />;
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement> & { options: Array<[string, string]> }) {
  const { options, className = "", ...rest } = props;
  return (
    <select className={`rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 ${className}`} {...rest}>
      {options.map(([value, label]) => (
        <option key={value} value={value}>{label}</option>
      ))}
    </select>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">{text}</div>;
}

function EmptyLine({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-slate-200 p-3 text-sm text-slate-500">{text}</div>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-slate-100 py-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-mono text-slate-800">{value}</span>
    </div>
  );
}

function splitLines(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitTags(value: string) {
  return value
    .split(/[，,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function createTodoDraftItem(): TodoDraftItem {
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    title: "",
    completed: false
  };
}

function buildTodoListTitle(value: string) {
  const date = parseTaskDate(value);
  if (!date) return "ToDoList";
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日ToDoList`;
}

function summarizeExpenses(expenses: Expense[]) {
  const today = localDateKey(new Date());
  const weekStart = startOfWeek(new Date());
  const monthKey = today.slice(0, 7);
  return expenses.reduce(
    (totals, expense) => {
      const date = parseTaskDate(expense.date);
      if (!date) return totals;
      if (localDateKey(date) === today) addExpenseTotal(totals.today, expense);
      if (date >= weekStart) addExpenseTotal(totals.week, expense);
      if (expense.date.slice(0, 7) === monthKey) addExpenseTotal(totals.month, expense);
      return totals;
    },
    { today: {}, week: {}, month: {} } as Record<"today" | "week" | "month", Record<string, number>>
  );
}

function buildTodayOverview(
  todoItems: TodoListItem[],
  tasks: Task[],
  todayCourses: Array<{ id: string; startTime: string; endTime: string; type: string; location: string; course: Course }>
): TodayOverviewSummary {
  const todayKey = localDateKey(new Date());
  const deadlineCount = tasks.filter((task) => {
    if (task.type !== "deadline" || !task.dueDate) return false;
    const due = parseTaskDate(task.dueDate);
    return due ? localDateKey(due) === todayKey : false;
  }).length;

  return {
    todoTotal: todoItems.length,
    todoCompleted: todoItems.filter((item) => item.completed).length,
    deadlineCount,
    courseCount: todayCourses.length
  };
}

function addExpenseTotal(bucket: Record<string, number>, expense: Expense) {
  bucket[expense.currency] = (bucket[expense.currency] || 0) + expense.amount;
}

function startOfWeek(date: Date) {
  const start = new Date(date);
  const day = start.getDay() || 7;
  start.setDate(start.getDate() - day + 1);
  start.setHours(0, 0, 0, 0);
  return start;
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(amount || 0);
}

function formatExpenseTotals(totals: Record<string, number>) {
  const entries = Object.entries(totals).filter(([, amount]) => amount > 0);
  if (entries.length === 0) return formatMoney(0, "AUD");
  return entries.map(([currency, amount]) => formatMoney(amount, currency)).join(" / ");
}

function isImageMime(mime?: string | null) {
  return !mime || mime.startsWith("image/");
}

function statusLabel(status: string) {
  return status === "not_started" ? "未开始" : status === "in_progress" ? "进行中" : status === "completed" ? "已完成" : "已归档";
}

function getTimetableDays(view: "day" | "week", anchorDate: string) {
  const anchor = startOfLocalDay(new Date(`${anchorDate}T00:00:00`));
  if (view === "day") return [anchor];
  const mondayOffset = (anchor.getDay() + 6) % 7;
  const monday = addDays(anchor, -mondayOffset);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

function getTimetableHourRange(occurrences: CourseOccurrence[]) {
  if (occurrences.length === 0) return { start: 8, end: 18 };
  const starts = occurrences.map((occurrence) => new Date(occurrence.startAt).getHours());
  const ends = occurrences.map((occurrence) => {
    const end = new Date(occurrence.endAt);
    return end.getMinutes() > 0 ? end.getHours() + 1 : end.getHours();
  });
  return {
    start: Math.max(0, Math.min(8, Math.min(...starts))),
    end: Math.min(24, Math.max(18, Math.max(...ends)))
  };
}

function layoutTimetableDayOccurrences(occurrences: CourseOccurrence[]) {
  const sorted = [...occurrences].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  const active: Array<{ lane: number; end: number }> = [];
  return sorted.map((occurrence) => {
    const start = new Date(occurrence.startAt).getTime();
    const end = new Date(occurrence.endAt).getTime();
    for (let index = active.length - 1; index >= 0; index -= 1) {
      if (active[index].end <= start) active.splice(index, 1);
    }
    const usedLanes = new Set(active.map((item) => item.lane));
    let lane = 0;
    while (usedLanes.has(lane)) lane += 1;
    active.push({ lane, end });
    const laneCount = Math.max(
      1,
      sorted.filter((item) => {
        const itemStart = new Date(item.startAt).getTime();
        const itemEnd = new Date(item.endAt).getTime();
        return itemStart < end && itemEnd > start;
      }).length
    );
    return { occurrence, lane: Math.min(lane, laneCount - 1), laneCount };
  });
}

function minutesSinceMidnight(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function weekdayLabel(date: Date) {
  return date.toLocaleDateString("zh-CN", { weekday: "short" });
}

function monthDayLabel(date: Date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatCalendarHour(hour: number) {
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour}:00 AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12}:00 PM`;
}

function formatCalendarTimeRange(occurrence: CourseOccurrence) {
  const options: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", hour12: false };
  return `${new Date(occurrence.startAt).toLocaleTimeString("zh-CN", options)} - ${new Date(occurrence.endAt).toLocaleTimeString("zh-CN", options)}`;
}

function calendarEventBackground(color: string) {
  const clean = color.startsWith("#") && (color.length === 7 || color.length === 4) ? color : "#0f172a";
  if (clean.length === 4) {
    const [, r, g, b] = clean;
    return `rgba(${parseInt(`${r}${r}`, 16)}, ${parseInt(`${g}${g}`, 16)}, ${parseInt(`${b}${b}`, 16)}, 0.18)`;
  }
  const red = parseInt(clean.slice(1, 3), 16);
  const green = parseInt(clean.slice(3, 5), 16);
  const blue = parseInt(clean.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, 0.16)`;
}

function progressTypeLabel(type?: string | null) {
  if (type === "pages") return "阅读页数";
  if (type === "percentage") return "百分比";
  if (type === "time") return "时间";
  if (type === "custom" || type === "custom_unit") return "自定义单位";
  if (type === "none") return "无进度";
  return "次数";
}

function defaultProgressUnit(type?: string | null) {
  if (type === "pages") return "页";
  if (type === "percentage") return "%";
  if (type === "time") return "小时";
  if (type === "count") return "次";
  return "";
}

function normalizeType(type?: string | null): TaskType {
  return type === "shopping" ? "checklist" : (type || "todo") as TaskType;
}

function taskTime(task: Task) {
  const value = task.dueDate || task.startDate || task.completedAt || task.archivedAt || task.createdAt;
  return parseTaskDate(value)?.getTime() ?? 0;
}

function sortTasks(a: Task, b: Task, sort: string) {
  if (sort === "due-nearest") return taskDueTime(a) - taskDueTime(b);
  if (sort === "due-farthest") return taskDueTime(b) - taskDueTime(a);
  if (sort === "created-newest") return createdTime(b) - createdTime(a);
  if (sort === "created-oldest") return createdTime(a) - createdTime(b);
  if (sort === "title") return a.title.localeCompare(b.title, "zh-Hans-CN");
  if (sort === "earliest") return taskTime(a) - taskTime(b);
  if (sort === "latest") return taskTime(b) - taskTime(a);
  const nowTime = Date.now();
  return Math.abs(taskTime(a) - nowTime) - Math.abs(taskTime(b) - nowTime);
}

function taskDueTime(task: Task) {
  return parseTaskDate(task.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
}

function createdTime(task: Task) {
  return parseTaskDate(task.createdAt)?.getTime() ?? 0;
}

function isTaskCardGridItem(task: Task) {
  return task.type !== "plan_item" && !task.tags.includes("To Do List");
}

function isDueWithin24HoursOrOverdue(date?: string | null) {
  const due = parseTaskDate(date);
  if (!due) return false;
  return due.getTime() - Date.now() <= 24 * 60 * 60 * 1000;
}

function buildTodayTodoPreviewItems(todoLists: TodoList[]) {
  const todayKey = localDateKey(new Date());
  return todoLists
    .filter((todoList) => todoList.date === todayKey)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .flatMap((todoList) => todoList.items)
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      if (a.item.completed !== b.item.completed) return a.item.completed ? 1 : -1;
      return (a.item.order ?? a.index) - (b.item.order ?? b.index);
    })
    .map(({ item }) => item);
}

function getPreviousIncompleteTodoItems(todoList: TodoList, todoLists: TodoList[]) {
  const previousDate = shiftLocalDateKey(todoList.date, -1);
  const uniqueItems = new Map<string, TodoListItem>();
  todoLists
    .filter((candidate) => candidate.date === previousDate)
    .flatMap((candidate) => candidate.items)
    .filter((item) => !item.completed)
    .forEach((item) => {
      const key = item.content.trim().toLowerCase();
      if (key && !uniqueItems.has(key)) uniqueItems.set(key, item);
    });
  return [...uniqueItems.values()];
}

function shiftLocalDateKey(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

function localDateKey(date: Date) {
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfToday() {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
}

function daysUntil(date?: string | null) {
  if (!date) return 999;
  const due = parseTaskDate(date)?.getTime();
  if (!due) return 999;
  const today = new Date().getTime();
  return Math.ceil((due - today) / 86400000);
}

function countdownText(date?: string | null) {
  const due = parseTaskDate(date);
  if (!due) return "无截止时间";
  const diffMs = due.getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const totalMinutes = Math.max(1, Math.round(abs / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const totalHours = Math.floor(totalMinutes / 60);
  const text = abs > 24 * 60 * 60 * 1000
    ? `${days} 天 ${hours} 小时`
    : totalHours > 0
      ? `${totalHours} 小时 ${minutes} 分钟`
      : `${minutes} 分钟`;
  return diffMs < 0 ? `已过期 ${text}` : `还剩 ${text}`;
}

function expiryCountdownClass(date?: string | null) {
  const expiry = parseTaskDate(date);
  if (!expiry) return "text-slate-600";
  const remaining = expiry.getTime() - Date.now();
  if (remaining < 0) return "text-red-700";
  if (remaining <= 30 * 24 * 60 * 60 * 1000) return "text-amber-700";
  return "text-slate-600";
}

function parseTaskDate(value?: string | null) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T23:59:59`);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatTaskDateTime(value?: string | null) {
  const date = parseTaskDate(value);
  if (!date) return "未设置";
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23"
  });
}

function formatDateTime(value?: string | null) {
  return formatTaskDateTime(value);
}

function formatDateOnly(value?: string | null) {
  const date = parseTaskDate(value);
  if (!date) return "未设置";
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

function toDateTimeInputValue(value?: string | null) {
  const date = parseTaskDate(value);
  if (!date) return "";
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseReminderRule(value?: string | null): ReminderRule {
  if (!value || value === "none") return { type: "none" };
  if (value === "one_day_before_due") return { type: "deadline_24h" };
  if (value === "daily_until_due") return { type: "daily_until_due" };
  if (value === "hourly_until_due") return { type: "hourly_until_due" };
  if (value === "custom_before_due") return { type: "custom", mode: "before_due", beforeAmount: 1, beforeUnit: "hours", maxCount: 1 };
  if (value === "progress_based") return { type: "custom", mode: "progress", progressPercent: 80, maxCount: 1 };
  try {
    const parsed = JSON.parse(value) as ReminderRule;
    if (parsed.type === "custom") return parsed;
  } catch {
    return { type: "none" };
  }
  return { type: "none" };
}

function buildReminderAlerts(tasks: Task[], dismissedKeys: string[]) {
  const dismissed = new Set(dismissedKeys);
  return tasks.flatMap((task) => {
    if (task.status === "completed" || task.status === "archived") return [];
    const alert = buildReminderAlert(task);
    if (!alert || dismissed.has(alert.key)) return [];
    return [alert];
  });
}

function buildReminderAlert(task: Task): ReminderAlert | null {
  const rule = parseReminderRule(task.reminderRule);
  if (rule.type === "none") return null;
  const due = parseTaskDate(task.dueDate);
  const now = new Date();
  const dueMs = due?.getTime();
  const nowMs = now.getTime();

  if (rule.type === "deadline_24h") {
    if (!dueMs || nowMs < dueMs - 24 * 60 * 60 * 1000 || nowMs > dueMs) return null;
    return makeReminderAlert(task, "24 小时截止提醒", "deadline_24h", "24h");
  }

  if (rule.type === "daily_until_due") {
    if (!dueMs || nowMs > dueMs) return null;
    return makeReminderAlert(task, "每日截止提醒", "daily_until_due", slotKey("day", now));
  }

  if (rule.type === "hourly_until_due") {
    if (!dueMs || nowMs > dueMs) return null;
    return makeReminderAlert(task, "每小时截止提醒", "hourly_until_due", slotKey("hour", now));
  }

  if (rule.type !== "custom") return null;
  if (rule.mode === "progress") {
    const target = Math.max(1, Number(task.progressTarget || 0));
    const percent = Math.round((Number(task.progressCurrent || 0) / target) * 100);
    if (percent < Number(rule.progressPercent || 80)) return null;
    return makeReminderAlert(task, "进度提醒", "custom_progress", `${rule.progressPercent || 80}`);
  }

  if (!dueMs || nowMs > dueMs) return null;

  if (rule.mode === "before_due") {
    const amount = Number(rule.beforeAmount || 1);
    const unitMs = rule.beforeUnit === "days" ? 86400000 : rule.beforeUnit === "minutes" ? 60000 : 3600000;
    const threshold = dueMs - amount * unitMs;
    if (nowMs < threshold) return null;
    return makeReminderAlert(task, "自定义截止提醒", "custom_before_due", `${amount}-${rule.beforeUnit}`);
  }

  const frequencyHours = rule.mode === "daily" ? 24 : Math.max(1, Number(rule.frequencyHours || 1));
  const maxWindow = frequencyHours * Math.max(1, Number(rule.maxCount || 1)) * 3600000;
  if (dueMs - nowMs > maxWindow) return null;
  return makeReminderAlert(task, rule.mode === "daily" ? "自定义每日提醒" : "自定义频率提醒", `custom_${rule.mode}`, slotKey(`${frequencyHours}h`, now));
}

function makeReminderAlert(task: Task, title: string, ruleKey: string, slot: string): ReminderAlert {
  return {
    task,
    key: `${task.id}:${ruleKey}:${slot}`,
    title,
    detail: `截止时间：${formatTaskDateTime(task.dueDate)} · ${countdownText(task.dueDate)}`
  };
}

function slotKey(unit: string, date: Date): string {
  const pad = (number: number) => String(number).padStart(2, "0");
  if (unit === "day") return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  if (unit === "hour") return `${slotKey("day", date)}T${pad(date.getHours())}`;
  if (unit.endsWith("h")) {
    const hours = Math.max(1, Number(unit.replace("h", "")));
    const bucket = Math.floor(date.getHours() / hours) * hours;
    return `${slotKey("day", date)}T${pad(bucket)}`;
  }
  return date.toISOString();
}

function buildPlanReminders(plans: Plan[], now = new Date()) {
  const reminders: string[] = [];
  const sunday = now.getDay() === 0;
  if (sunday && now.getHours() >= 21) {
    const nextWeek = new Date(now);
    nextWeek.setDate(now.getDate() + 1);
    const nextWeekIso = nextWeek.toISOString().slice(0, 10);
    const exists = plans.some((plan) => plan.type === "weekly" && plan.startDate >= nextWeekIso);
    if (!exists) reminders.push(`现在是${formatWeekdayTime(now)}，下周 weekly plan 还没创建。`);
  }
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (tomorrow.getDate() === 1 && now.getHours() < 12) {
    const exists = plans.some((plan) => plan.type === "monthly" && plan.startDate.slice(0, 7) === tomorrow.toISOString().slice(0, 7));
    if (!exists) reminders.push("今天是月末中午前，下个月 monthly plan 还没创建。");
  }
  return reminders;
}

function formatWeekdayTime(date: Date) {
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const hour = date.getHours();
  const period = hour < 6 ? "凌晨" : hour < 12 ? "上午" : hour < 18 ? "下午" : "晚上";
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${weekdays[date.getDay()]}${period} ${hour}:${minute}`;
}

function downloadBlob(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
