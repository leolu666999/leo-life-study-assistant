export const uiLanguages = ["zh-CN", "zh-TW", "en"] as const;

export type UiLanguage = (typeof uiLanguages)[number];

export const UI_LANGUAGE_STORAGE_KEY = "myassist-ui-language";

export function isUiLanguage(value: unknown): value is UiLanguage {
  return typeof value === "string" && uiLanguages.includes(value as UiLanguage);
}

export function normalizeUiLanguage(value: unknown): UiLanguage {
  return isUiLanguage(value) ? value : "zh-CN";
}

const uiTranslations: Record<string, Partial<Record<UiLanguage, string>>> = {
  "首页": { "zh-TW": "首頁", en: "Home" },
  "任务": { "zh-TW": "任務", en: "Tasks" },
  "计划": { "zh-TW": "計劃", en: "Plans" },
  "日程": { "zh-TW": "日程", en: "Schedule" },
  "日记": { "zh-TW": "日記", en: "Journal" },
  "收支": { "zh-TW": "收支", en: "Finance" },
  "文件": { "zh-TW": "檔案", en: "Files" },
  "设置": { "zh-TW": "設定", en: "Settings" },
  "收支记录": { "zh-TW": "收支記錄", en: "Finance summary" },
  "今日结余": { "zh-TW": "今日結餘", en: "Today balance" },
  "本月结余": { "zh-TW": "本月結餘", en: "Month balance" },
  "正在加载 MyAssist 的本地数据...": { "zh-TW": "正在載入 MyAssist 的本機資料...", en: "Loading your MyAssist data..." },
  "筛选": { "zh-TW": "篩選", en: "Filter" },
  "进行中": { "zh-TW": "進行中", en: "Active" },
  "已完成": { "zh-TW": "已完成", en: "Completed" },
  "全部": { "zh-TW": "全部", en: "All" },
  "清单": { "zh-TW": "清單", en: "Checklist" },
  "有进度": { "zh-TW": "有進度", en: "With progress" },
  "新建任务": { "zh-TW": "新增任務", en: "New Task" },
  "添加日程": { "zh-TW": "新增日程", en: "Add Schedule" },
  "我的日程": { "zh-TW": "我的日程", en: "My Schedule" },
  "课程管理": { "zh-TW": "課程管理", en: "Courses" },
  "上传文件": { "zh-TW": "上傳檔案", en: "Upload File" },
  "创建文档": { "zh-TW": "建立文件", en: "Create Document" },
  "文件与文档": { "zh-TW": "檔案與文件", en: "Files and Documents" },
  "新增收支": { "zh-TW": "新增收支", en: "New Transaction" },
  "今天还没有课程或带时间的安排。": { "zh-TW": "今天還沒有課程或帶時間的安排。", en: "No courses or timed plans today." },
  "No tasks for today. Add one to get started.": { "zh-CN": "今天还没有待办事项，添加一项开始吧。", "zh-TW": "今天還沒有待辦事項，新增一項開始吧。" },
  "统一管理任务、截止日期、清单和计数目标": { "zh-TW": "統一管理任務、截止日期、清單和計數目標", en: "Manage tasks, deadlines, checklists and count goals in one place." },
  "Daily 是 To Do List；Weekly / Monthly 保留为计划。": { "zh-TW": "Daily 是 To Do List；Weekly / Monthly 保留為計劃。", en: "Daily contains To Do Lists; Weekly and Monthly contain plans." },
  "把课程、每日安排和带时间的 To Do 放进同一份 Calendar。": { "zh-TW": "把課程、每日安排和帶時間的 To Do 放進同一份 Calendar。", en: "Keep courses, daily plans and timed To Dos in one Calendar." },
  "课程和带时间的 To Do 按一天的时间轴统一显示。": { "zh-TW": "課程和帶時間的 To Do 按一天的時間軸統一顯示。", en: "View courses and timed To Dos together on a daily timeline." },
  "导入、同步和管理完整学期课表，所有时间均按悉尼时间显示。": { "zh-TW": "匯入、同步和管理完整學期課表，所有時間均按悉尼時間顯示。", en: "Import, sync and manage a full semester timetable in Sydney time." },
  "自动聚合日计划复盘，也可以手动写新的记录。": { "zh-TW": "自動彙整每日計劃回顧，也可以手動撰寫新記錄。", en: "Review daily plans automatically or write a journal entry." },
  "记录收入和支出，照片与账单保存在本地 uploads 文件夹。": { "zh-TW": "記錄收入和支出，照片與帳單保存在本機 uploads 資料夾。", en: "Track income and expenses with optional receipt uploads." },
  "重要文件": { "zh-TW": "重要檔案", en: "Important Files" },
  "上传证件和图片，或创建纯文字文档保存地址、链接和备忘信息。": { "zh-TW": "上傳證件和圖片，或建立純文字文件保存地址、連結和備忘資訊。", en: "Upload files or create secure text documents for addresses, links and notes." },
  "账号、手机访问、本地存储和外观偏好。": { "zh-TW": "帳號、手機存取、本機儲存和外觀偏好。", en: "Account, language, local access and personal preferences." },
  "使用文档": { "zh-TW": "使用文件", en: "User Guide" },
  "联系开发者": { "zh-TW": "聯絡開發者", en: "Contact Developer" },
  "当前账号": { "zh-TW": "目前帳號", en: "Current Account" },
  "用户名": { "zh-TW": "使用者名稱", en: "Username" },
  "邮箱地址": { "zh-TW": "電子郵件", en: "Email" },
  "普通个人账号": { "zh-TW": "一般個人帳號", en: "Personal account" },
  "独立管理员账号": { "zh-TW": "獨立管理員帳號", en: "Admin account" },
  "退出登录": { "zh-TW": "登出", en: "Sign out" },
  "首页个性化": { "zh-TW": "首頁個人化", en: "Home personalisation" },
  "首页标题": { "zh-TW": "首頁標題", en: "Home title" },
  "显示首页标题": { "zh-TW": "顯示首頁標題", en: "Show home title" },
  "保存首页设置": { "zh-TW": "儲存首頁設定", en: "Save home settings" },
  "保存中...": { "zh-TW": "儲存中...", en: "Saving..." },
  "本地存储": { "zh-TW": "本機儲存", en: "Local storage" },
  "手机访问 / 同步状态": { "zh-TW": "手機存取 / 同步狀態", en: "Mobile access / Sync" },
  "数据库路径": { "zh-TW": "資料庫路徑", en: "Database path" },
  "上传路径": { "zh-TW": "上傳路徑", en: "Upload path" },
  "服务端口": { "zh-TW": "服務連接埠", en: "Server port" },
  "电脑已连接": { "zh-TW": "電腦已連線", en: "Connected" },
  "离线暂存": { "zh-TW": "離線暫存", en: "Saved offline" },
  "检查中": { "zh-TW": "檢查中", en: "Checking" }
};

export function translateUiText(language: UiLanguage, source: string): string {
  return uiTranslations[source]?.[language] ?? source;
}

export function uiLanguageLocale(language: UiLanguage): string {
  if (language === "en") return "en-AU";
  return language;
}
