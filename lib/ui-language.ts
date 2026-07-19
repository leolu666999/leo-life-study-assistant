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
  "新增日程": { "zh-TW": "新增日程", en: "Add Schedule" },
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

Object.assign(uiTranslations, {
  "To Do List": { "zh-TW": "待辦清單", en: "To Do List" },
  "Today’s Schedule": { "zh-TW": "今日行程", en: "Today’s Schedule" },
  "Task Card": { "zh-TW": "任務卡片", en: "Task Card" },
  "Task": { "zh-TW": "任務", en: "Task" },
  "Deadline": { "zh-TW": "截止事項", en: "Deadline" },
  "Counter": { "zh-TW": "計數", en: "Counter" },
  "View all": { "zh-CN": "查看全部", "zh-TW": "查看全部", en: "View all" },
  "Add Task": { "zh-TW": "新增任務", en: "Add Task" },
  "Add Deadline": { "zh-TW": "新增截止事項", en: "Add Deadline" },
  "Add Schedule": { "zh-TW": "新增日程", en: "Add Schedule" },
  "Schedule": { "zh-TW": "日程", en: "Schedule" },
  "Courses": { "zh-TW": "課程", en: "Courses" },
  "My Schedule": { "zh-TW": "我的日程", en: "My Schedule" },
  "Home": { "zh-TW": "首頁", en: "Home" },
  "Tasks": { "zh-TW": "任務", en: "Tasks" },
  "Plans": { "zh-TW": "計劃", en: "Plans" },
  "Journal": { "zh-TW": "日記", en: "Journal" },
  "Finance": { "zh-TW": "收支", en: "Finance" },
  "Files": { "zh-TW": "檔案", en: "Files" },
  "Settings": { "zh-TW": "設定", en: "Settings" },
  "正在恢复实时连接...": { "zh-TW": "正在恢復即時連線...", en: "Restoring live connection..." },
  "正在检查连接...": { "zh-TW": "正在檢查連線...", en: "Checking connection..." },
  "同步中...": { "zh-TW": "同步中...", en: "Syncing..." },
  "同步手机暂存内容": { "zh-TW": "同步手機暫存內容", en: "Sync saved mobile changes" },
  "没有符合条件的任务。": { "zh-TW": "沒有符合條件的任務。", en: "No matching tasks." },
  "查看全部": { "zh-TW": "查看全部", en: "View all" },
  "截止时间早于": { "zh-TW": "截止時間早於", en: "Due before" },
  "按标签筛选": { "zh-TW": "按標籤篩選", en: "Filter by tag" },
  "应用": { "zh-TW": "套用", en: "Apply" },
  "今日总览": { "zh-TW": "今日總覽", en: "Today overview" },
  "今天要面对的事情，先一眼看清。": { "zh-TW": "今天要面對的事情，先一眼看清。", en: "See today’s priorities at a glance." },
  "关闭今日总览": { "zh-TW": "關閉今日總覽", en: "Close today overview" },
  "关闭": { "zh-TW": "關閉", en: "Close" },
  "已完成/总数": { "zh-TW": "已完成/總數", en: "Completed / total" },
  "今日截止": { "zh-TW": "今日截止", en: "Due today" },
  "课程": { "zh-TW": "課程", en: "Courses" },
  "今日课程": { "zh-TW": "今日課程", en: "Today’s courses" },
  "搜索任务标题": { "zh-TW": "搜尋任務標題", en: "Search task titles" },
  "标签": { "zh-TW": "標籤", en: "Tag" },
  "开始日期": { "zh-TW": "開始日期", en: "Start date" },
  "截止日期": { "zh-TW": "截止日期", en: "Due date" },
  "离截止时间最近": { "zh-TW": "離截止時間最近", en: "Due soonest" },
  "离截止时间最远": { "zh-TW": "離截止時間最遠", en: "Due latest" },
  "创建时间最新": { "zh-TW": "建立時間最新", en: "Newest created" },
  "创建时间最早": { "zh-TW": "建立時間最早", en: "Oldest created" },
  "标题排序": { "zh-TW": "標題排序", en: "Title" },
  "取消完成": { "zh-TW": "取消完成", en: "Mark incomplete" },
  "标记完成": { "zh-TW": "標記完成", en: "Mark complete" },
  "恢复": { "zh-TW": "恢復", en: "Restore" },
  "完成": { "zh-TW": "完成", en: "Complete" },
  "编辑": { "zh-TW": "編輯", en: "Edit" },
  "删除": { "zh-TW": "刪除", en: "Delete" },
  "归档": { "zh-TW": "封存", en: "Archive" },
  "更新": { "zh-TW": "更新", en: "Update" },
  "未开始": { "zh-TW": "未開始", en: "Not started" },
  "待办": { "zh-TW": "待辦", en: "To do" },
  "已归档": { "zh-TW": "已封存", en: "Archived" },
  "描述": { "zh-TW": "描述", en: "Description" },
  "提醒": { "zh-TW": "提醒", en: "Reminder" },
  "不提醒": { "zh-TW": "不提醒", en: "No reminder" },
  "前一天": { "zh-TW": "前一天", en: "Previous day" },
  "后一天": { "zh-TW": "後一天", en: "Next day" },
  "今天": { "zh-TW": "今天", en: "Today" },
  "当前范围没有课程。": { "zh-TW": "目前範圍沒有課程。", en: "No courses in this range." },
  "日": { "zh-TW": "日", en: "Day" },
  "周": { "zh-TW": "週", en: "Week" },
  "月": { "zh-TW": "月", en: "Month" },
  "学期": { "zh-TW": "學期", en: "Semester" },
  "悉尼时间": { "zh-TW": "悉尼時間", en: "Sydney time" },
  "来源": { "zh-TW": "來源", en: "Sources" },
  "课程系列": { "zh-TW": "課程系列", en: "Course series" },
  "当前显示": { "zh-TW": "目前顯示", en: "Showing" },
  "已选课程": { "zh-TW": "已選課程", en: "Selected courses" },
  "订阅链接": { "zh-TW": "訂閱連結", en: "Calendar link" },
  "上传 ICS 文件": { "zh-TW": "上傳 ICS 檔案", en: "Upload ICS file" },
  "上传课表截图": { "zh-TW": "上傳課表截圖", en: "Upload timetable image" },
  "年份": { "zh-TW": "年份", en: "Year" },
  "读取课表": { "zh-TW": "讀取課表", en: "Load timetable" },
  "导入预览": { "zh-TW": "匯入預覽", en: "Import preview" },
  "确认导入": { "zh-TW": "確認匯入", en: "Confirm import" },
  "未知开始": { "zh-TW": "未知開始", en: "Unknown start" },
  "未知结束": { "zh-TW": "未知結束", en: "Unknown end" },
  "地点待确认": { "zh-TW": "地點待確認", en: "Location to confirm" },
  "还没有待办条目。": { "zh-TW": "還沒有待辦項目。", en: "No To Do items yet." },
  "搜索待办内容或日期，如 7月19日、7.19、2026.7.19": { "zh-TW": "搜尋待辦內容或日期，例如 7月19日、7.19、2026.7.19", en: "Search To Dos or a date, e.g. 19 Jul or 2026-07-19" },
  "搜索计划标题、内容或日期": { "zh-TW": "搜尋計劃標題、內容或日期", en: "Search plan titles, content or dates" },
  "清空搜索": { "zh-TW": "清除搜尋", en: "Clear search" },
  "没有找到匹配的 To Do List。": { "zh-TW": "找不到符合的待辦清單。", en: "No matching To Do Lists." },
  "还没有 To Do List。": { "zh-TW": "還沒有待辦清單。", en: "No To Do Lists yet." },
  "没有找到匹配的计划。": { "zh-TW": "找不到符合的計劃。", en: "No matching plans." },
  "还没有周计划。": { "zh-TW": "還沒有週計劃。", en: "No weekly plans yet." },
  "还没有月计划。": { "zh-TW": "還沒有月計劃。", en: "No monthly plans yet." },
  "新增每日 To Do List": { "zh-TW": "新增每日待辦清單", en: "New Daily To Do List" },
  "新增周计划": { "zh-TW": "新增週計劃", en: "New Weekly Plan" },
  "新增月计划": { "zh-TW": "新增月計劃", en: "New Monthly Plan" },
  "保存": { "zh-TW": "儲存", en: "Save" },
  "取消": { "zh-TW": "取消", en: "Cancel" },
  "标题": { "zh-TW": "標題", en: "Title" },
  "备注": { "zh-TW": "備註", en: "Notes" },
  "日期": { "zh-TW": "日期", en: "Date" },
  "待办条目": { "zh-TW": "待辦項目", en: "To Do items" },
  "添加一行": { "zh-TW": "新增一行", en: "Add row" },
  "新增日记": { "zh-TW": "新增日記", en: "New Journal Entry" },
  "还没有日记。": { "zh-TW": "還沒有日記。", en: "No journal entries yet." },
  "还没有符合条件的收支记录。点右上角新增一笔。": { "zh-TW": "還沒有符合條件的收支記錄。請在右上角新增一筆。", en: "No matching transactions. Add one from the top right." },
  "收入": { "zh-TW": "收入", en: "Income" },
  "支出": { "zh-TW": "支出", en: "Expense" },
  "金额": { "zh-TW": "金額", en: "Amount" },
  "货币": { "zh-TW": "貨幣", en: "Currency" },
  "支付方式": { "zh-TW": "付款方式", en: "Payment method" },
  "商家": { "zh-TW": "商家", en: "Merchant" },
  "上传凭证": { "zh-TW": "上傳憑證", en: "Upload receipt" },
  "搜索文件名、备注或标签": { "zh-TW": "搜尋檔案名稱、備註或標籤", en: "Search file names, notes or tags" },
  "全部分类": { "zh-TW": "全部分類", en: "All categories" },
  "文件列表": { "zh-TW": "檔案清單", en: "File list" },
  "还没有文件。": { "zh-TW": "還沒有檔案。", en: "No files yet." },
  "界面语言": { "zh-TW": "介面語言", en: "Interface language" },
  "选择 MyAssist 使用的语言。": { "zh-TW": "選擇 MyAssist 使用的語言。", en: "Choose the language used by MyAssist." },
  "简体中文": { "zh-TW": "簡體中文", en: "Simplified Chinese" },
  "繁體中文": { "zh-TW": "繁體中文", en: "Traditional Chinese" },
  "English": { "zh-TW": "English", en: "English" },
  "正在读取...": { "zh-TW": "正在讀取...", en: "Loading..." },
  "已连接电脑。": { "zh-TW": "已連線電腦。", en: "Connected to computer." },
  "已连接电脑，有待同步内容。": { "zh-TW": "已連線電腦，有待同步內容。", en: "Connected. Changes are waiting to sync." },
  "网络不可用，新增内容会先保存在手机。": { "zh-TW": "網路不可用，新增內容會先儲存在手機。", en: "Offline. New changes will be saved on this device." },
  "今日没有课程。": { "zh-TW": "今日沒有課程。", en: "No courses today." },
  "未设置": { "zh-TW": "未設定", en: "Not set" },
  "无截止时间": { "zh-TW": "無截止時間", en: "No due date" },
  "关闭提醒": { "zh-TW": "關閉提醒", en: "Dismiss reminder" },
  "永久删除": { "zh-TW": "永久刪除", en: "Delete permanently" },
  "恢复未完成": { "zh-TW": "恢復未完成", en: "Restore as incomplete" },
  "本次用时（分钟）": { "zh-TW": "本次用時（分鐘）", en: "Time spent (minutes)" },
  "本次完成量": { "zh-TW": "本次完成量", en: "Amount completed" },
  "更新后当前值": { "zh-TW": "更新後目前值", en: "New current value" },
  "编辑 To Do List": { "zh-TW": "編輯待辦清單", en: "Edit To Do List" },
  "关闭编辑": { "zh-TW": "關閉編輯", en: "Close editor" },
  "一键导入昨天未完成": { "zh-TW": "一鍵匯入昨天未完成", en: "Import yesterday's incomplete items" },
  "新增待办条目": { "zh-TW": "新增待辦項目", en: "New To Do item" },
  "添加": { "zh-TW": "新增", en: "Add" },
  "随手小记": { "zh-TW": "隨手小記", en: "Quick note" },
  "周计划标题": { "zh-TW": "週計劃標題", en: "Weekly plan title" },
  "月计划标题": { "zh-TW": "月計劃標題", en: "Monthly plan title" },
  "计划内容 / 备注": { "zh-TW": "計劃內容 / 備註", en: "Plan details / notes" },
  "保存计划": { "zh-TW": "儲存計劃", en: "Save plan" },
  "当前学期没有课程。": { "zh-TW": "目前學期沒有課程。", en: "No courses in this semester." },
  "上课安排": { "zh-TW": "上課安排", en: "class slots" },
  "次课": { "zh-TW": "次課", en: "classes" },
  "上次同步": { "zh-TW": "上次同步", en: "Last synced" },
  "实时手机访问网址": { "zh-TW": "即時手機存取網址", en: "Live mobile URL" },
  "Mac 获取方式": { "zh-TW": "Mac 取得方式", en: "Find it on Mac" },
  "Windows 获取方式": { "zh-TW": "Windows 取得方式", en: "Find it on Windows" },
  "查看使用文档": { "zh-TW": "查看使用文件", en: "Open User Guide" },
  "打开留言板": { "zh-TW": "開啟留言板", en: "Open message board" },
  "管理员后台": { "zh-TW": "管理員後台", en: "Admin Dashboard" },
  "第一次使用？从快速上手开始了解 To Do、日程、任务、课程和数据安全。": { "zh-TW": "第一次使用？從快速上手開始了解 To Do、日程、任務、課程和資料安全。", en: "New to MyAssist? Learn about To Dos, schedules, tasks, courses and data safety." },
  "提交问题或建议，并查看开发者联系方式。": { "zh-TW": "提交問題或建議，並查看開發者聯絡方式。", en: "Send feedback or a question and view developer contact details." }
  ,"导出 Markdown": { "zh-TW": "匯出 Markdown", en: "Export Markdown" }
  ,"导出 JSON": { "zh-TW": "匯出 JSON", en: "Export JSON" }
  ,"写一条复盘或观察": { "zh-TW": "寫一則回顧或觀察", en: "Write a reflection or observation" }
  ,"日计划复盘": { "zh-TW": "每日計劃回顧", en: "Daily plan review" }
  ,"手动记录": { "zh-TW": "手動記錄", en: "Manual entry" }
  ,"今日": { "zh-TW": "今日", en: "Today" }
  ,"本周": { "zh-TW": "本週", en: "This week" }
  ,"本月": { "zh-TW": "本月", en: "This month" }
  ,"搜索收支标题或来源": { "zh-TW": "搜尋收支標題或來源", en: "Search transaction titles or sources" }
  ,"全部收支": { "zh-TW": "全部收支", en: "All transactions" }
  ,"查看小票": { "zh-TW": "查看收據", en: "View receipt" }
  ,"没有小票": { "zh-TW": "沒有收據", en: "No receipt" }
  ,"编辑收支": { "zh-TW": "編輯收支", en: "Edit transaction" }
  ,"删除这条收支记录？": { "zh-TW": "刪除這筆收支記錄？", en: "Delete this transaction?" }
  ,"搜索文档标题、内容或标签": { "zh-TW": "搜尋文件標題、內容或標籤", en: "Search document titles, content or tags" }
  ,"纯文档": { "zh-TW": "純文件", en: "Text document" }
  ,"上传文件或创建文档后，会在这里统一管理。": { "zh-TW": "上傳檔案或建立文件後，會在這裡統一管理。", en: "Uploaded files and text documents will appear here." }
  ,"编辑文档": { "zh-TW": "編輯文件", en: "Edit document" }
  ,"查看文档": { "zh-TW": "查看文件", en: "View document" }
  ,"查看文件": { "zh-TW": "查看檔案", en: "View file" }
  ,"删除这个文档？": { "zh-TW": "刪除這份文件？", en: "Delete this document?" }
  ,"删除这个文件？": { "zh-TW": "刪除這個檔案？", en: "Delete this file?" }
  ,"到期": { "zh-TW": "到期", en: "Expires" }
  ,"检查连接": { "zh-TW": "檢查連線", en: "Check connection" }
  ,"手动同步": { "zh-TW": "手動同步", en: "Sync now" }
  ,"待同步": { "zh-TW": "待同步", en: "Pending" }
  ,"失败": { "zh-TW": "失敗", en: "Failed" }
  ,"系统设置 → Wi‑Fi → 当前网络详情，查看 IP 地址。": { "zh-TW": "系統設定 → Wi‑Fi → 目前網路詳細資訊，查看 IP 位址。", en: "Open System Settings → Wi-Fi → network details to find the IP address." }
  ,"也可以在终端运行：ipconfig getifaddr en0": { "zh-TW": "也可以在終端機執行：ipconfig getifaddr en0", en: "Or run in Terminal: ipconfig getifaddr en0" }
  ,"打开命令提示符，运行 ipconfig，查看 IPv4 地址。": { "zh-TW": "開啟命令提示字元，執行 ipconfig，查看 IPv4 位址。", en: "Open Command Prompt, run ipconfig and find the IPv4 address." }
  ,"已保存，首页立即生效。": { "zh-TW": "已儲存，首頁立即生效。", en: "Saved. Your home page has been updated." }
  ,"保存失败，请确认电脑端服务正在运行。": { "zh-TW": "儲存失敗，請確認電腦端服務正在執行。", en: "Unable to save. Check that the desktop service is running." }
  ,"可点击年、月、日后直接用键盘输入，也可打开日历选择": { "zh-TW": "可點選年、月、日後直接用鍵盤輸入，也可開啟日曆選擇", en: "Type a date directly or open the calendar picker" }
  ,"课程详情": { "zh-TW": "課程詳情", en: "Course details" }
  ,"课程代码": { "zh-TW": "課程代碼", en: "Course code" }
  ,"课程名称": { "zh-TW": "課程名稱", en: "Course name" }
  ,"课程类型": { "zh-TW": "課程類型", en: "Class type" }
  ,"地点": { "zh-TW": "地點", en: "Location" }
  ,"开始时间": { "zh-TW": "開始時間", en: "Start time" }
  ,"结束时间": { "zh-TW": "結束時間", en: "End time" }
  ,"第几次课": { "zh-TW": "第幾次課", en: "Class number" }
  ,"时间": { "zh-TW": "時間", en: "Time" }
  ,"周一": { "zh-TW": "週一", en: "Mon" }
  ,"周二": { "zh-TW": "週二", en: "Tue" }
  ,"周三": { "zh-TW": "週三", en: "Wed" }
  ,"周四": { "zh-TW": "週四", en: "Thu" }
  ,"周五": { "zh-TW": "週五", en: "Fri" }
  ,"周六": { "zh-TW": "週六", en: "Sat" }
  ,"周日": { "zh-TW": "週日", en: "Sun" }
  ,"日期与时间（悉尼时间）": { "zh-TW": "日期與時間（雪梨時間）", en: "Date and time (Sydney)" }
  ,"课次": { "zh-TW": "課次", en: "Class number" }
  ,"单次课程": { "zh-TW": "單次課程", en: "Single class" }
  ,"已取消": { "zh-TW": "已取消", en: "Cancelled" }
  ,"已排期": { "zh-TW": "已排程", en: "Scheduled" }
  ,"查看课程详情": { "zh-TW": "查看課程詳情", en: "View class details" }
  ,"编辑地点": { "zh-TW": "編輯地點", en: "Edit location" }
  ,"取消课程": { "zh-TW": "取消課程", en: "Cancel class" }
});

Object.assign(uiTranslations, {
  "MyAssist 新手指南": { "zh-TW": "MyAssist 新手指南", en: "MyAssist User Guide" },
  "返回设置": { "zh-TW": "返回設定", en: "Back to Settings" },
  "删除标签": { "zh-TW": "刪除標籤", en: "Remove tag" },
  "输入标签，按回车生成": { "zh-TW": "輸入標籤，按 Enter 建立", en: "Enter a tag and press Enter" },
  "继续添加标签": { "zh-TW": "繼續新增標籤", en: "Add another tag" },
  "删除条目": { "zh-TW": "刪除項目", en: "Remove item" },
  "打开日历": { "zh-TW": "開啟日曆", en: "Open calendar" },
  "输入 YYYY-MM-DD，或打开日历选择": { "zh-TW": "輸入 YYYY-MM-DD，或開啟日曆選擇", en: "Enter YYYY-MM-DD or choose from the calendar" },
  "可点击年、月、日后直接用键盘输入，也可打开日历选择": { "zh-TW": "可點選年、月、日後直接用鍵盤輸入，也可開啟日曆選擇", en: "Type the date directly or choose it from the calendar" },
  "文件到期日": { "zh-TW": "檔案到期日", en: "File expiry date" },
  "加入任务": { "zh-TW": "加入任務", en: "Add to tasks" },
  "文档会按账号隔离保存，但不是端到端加密的密码保险箱。主密码、助记词和恢复码仍建议使用专业密码管理器保存。": {
    "zh-TW": "文件會按帳號隔離儲存，但不是端對端加密的密碼保險箱。主密碼、助記詞和復原碼仍建議使用專業密碼管理器儲存。",
    en: "Documents are isolated by account, but this is not an end-to-end encrypted password vault. Store master passwords, recovery phrases and recovery codes in a dedicated password manager."
  },
  "这篇文档还没有内容。": { "zh-TW": "這篇文件還沒有內容。", en: "This document has no content yet." },
  "文档名称": { "zh-TW": "文件名稱", en: "Document name" },
  "输入地址、链接、备忘信息或其他纯文字内容": { "zh-TW": "輸入地址、連結、備忘資訊或其他純文字內容", en: "Enter an address, link, note or other text" },
  "文件名称": { "zh-TW": "檔案名稱", en: "File name" },
  "上传文件或图片": { "zh-TW": "上傳檔案或圖片", en: "Upload a file or image" },
  "上传完成，可以保存。": { "zh-TW": "上傳完成，可以儲存。", en: "Upload complete. You can save now." },
  "上传失败，请确认电脑服务还开着，然后再试一次。": { "zh-TW": "上傳失敗，請確認電腦服務仍在執行，然後再試一次。", en: "Upload failed. Check that the desktop service is running and try again." },
  "文件太大了，先控制在 50MB 以内。": { "zh-TW": "檔案太大，請控制在 50MB 以內。", en: "The file is too large. Choose a file under 50 MB." },
  "文件太大，请选择 20MB 以内的图片或 PDF。": { "zh-TW": "檔案太大，請選擇 20MB 以內的圖片或 PDF。", en: "The file is too large. Choose an image or PDF under 20 MB." },
  "正在上传到电脑...": { "zh-TW": "正在上傳到電腦...", en: "Uploading..." },
  "已上传到电脑。": { "zh-TW": "已上傳到電腦。", en: "Uploaded." },
  "上传失败，请确认电脑端服务正在运行。": { "zh-TW": "上傳失敗，請確認電腦端服務正在執行。", en: "Upload failed. Check that the desktop service is running." },
  "已保存": { "zh-TW": "已儲存", en: "Saved" },
  "备注，可选": { "zh-TW": "備註，可選", en: "Notes, optional" },
  "吃饭": { "zh-TW": "餐飲", en: "Dining" },
  "超市": { "zh-TW": "超市", en: "Groceries" },
  "交通": { "zh-TW": "交通", en: "Transport" },
  "足球": { "zh-TW": "足球", en: "Football" },
  "大学": { "zh-TW": "大學", en: "University" },
  "房租": { "zh-TW": "房租", en: "Rent" },
  "手机/网络": { "zh-TW": "手機/網路", en: "Mobile / Internet" },
  "购物": { "zh-TW": "購物", en: "Shopping" },
  "娱乐": { "zh-TW": "娛樂", en: "Entertainment" },
  "健康": { "zh-TW": "健康", en: "Health" },
  "旅行": { "zh-TW": "旅行", en: "Travel" },
  "其他": { "zh-TW": "其他", en: "Other" },
  "外卖收入": { "zh-TW": "外送收入", en: "Delivery income" },
  "工资": { "zh-TW": "薪資", en: "Salary" },
  "兼职": { "zh-TW": "兼職", en: "Part-time work" },
  "奖学金": { "zh-TW": "獎學金", en: "Scholarship" },
  "退款": { "zh-TW": "退款", en: "Refund" },
  "礼金": { "zh-TW": "禮金", en: "Gift" },
  "投资": { "zh-TW": "投資", en: "Investment" },
  "其他收入": { "zh-TW": "其他收入", en: "Other income" },
  "证件": { "zh-TW": "證件", en: "Identity documents" },
  "签证": { "zh-TW": "簽證", en: "Visa" },
  "学校": { "zh-TW": "學校", en: "University" },
  "住宿": { "zh-TW": "住宿", en: "Accommodation" },
  "保险": { "zh-TW": "保險", en: "Insurance" },
  "银行": { "zh-TW": "銀行", en: "Banking" },
  "电话卡": { "zh-TW": "電話卡", en: "SIM card" },
  "生活": { "zh-TW": "生活", en: "Life" },
  "现金": { "zh-TW": "現金", en: "Cash" },
  "银行卡": { "zh-TW": "銀行卡", en: "Bank card" },
  "微信支付": { "zh-TW": "微信支付", en: "WeChat Pay" },
  "支付宝": { "zh-TW": "支付寶", en: "Alipay" },
  "银行转账": { "zh-TW": "銀行轉帳", en: "Bank transfer" },
  "截止": { "zh-TW": "截止", en: "Deadline" },
  "计数": { "zh-TW": "計數", en: "Counter" },
  "计划项": { "zh-TW": "計劃項目", en: "Plan item" },
  "展开侧边栏": { "zh-TW": "展開側邊欄", en: "Expand sidebar" },
  "折叠侧边栏": { "zh-TW": "收合側邊欄", en: "Collapse sidebar" },
  "确定永久删除这条任务吗？": { "zh-TW": "確定永久刪除這個任務嗎？", en: "Permanently delete this task?" },
  "确定删除这个计划吗？": { "zh-TW": "確定刪除這個計劃嗎？", en: "Delete this plan?" },
  "请先粘贴一段活动信息，或上传活动截图。": { "zh-TW": "請先貼上一段活動資訊，或上傳活動截圖。", en: "Paste event details or upload an event image first." },
  "没有从图片中识别到文字": { "zh-TW": "沒有從圖片中識別到文字", en: "No text was found in the image" },
  "图片识别失败，请改用粘贴文字或手动填写。": { "zh-TW": "圖片識別失敗，請改用貼上文字或手動填寫。", en: "Image recognition failed. Paste text or enter the details manually." },
  "请填写日程标题。": { "zh-TW": "請填寫日程標題。", en: "Enter a schedule title." },
  "请确认日期和时间。": { "zh-TW": "請確認日期和時間。", en: "Check the date and time." },
  "结束时间必须晚于开始时间。": { "zh-TW": "結束時間必須晚於開始時間。", en: "The end time must be later than the start time." },
  "保存日程失败": { "zh-TW": "儲存日程失敗", en: "Unable to save schedule" },
  "文件预览": { "zh-TW": "檔案預覽", en: "File preview" },
  "小票预览": { "zh-TW": "收據預覽", en: "Receipt preview" },
  "小票缩略图": { "zh-TW": "收據縮圖", en: "Receipt thumbnail" },
  "小票大图": { "zh-TW": "收據大圖", en: "Full receipt" },
  "未命名文件": { "zh-TW": "未命名檔案", en: "Untitled file" },
  "未命名课程": { "zh-TW": "未命名課程", en: "Untitled course" },
  "工资、退款、兼职收入": { "zh-TW": "薪資、退款、兼職收入", en: "Salary, refund or part-time income" },
  "午餐、超市购物、打车": { "zh-TW": "午餐、超市購物、搭車", en: "Lunch, groceries or a taxi" },
  "收入来源，可选": { "zh-TW": "收入來源，可選", en: "Income source, optional" },
  "商家名称，可选": { "zh-TW": "商家名稱，可選", en: "Merchant name, optional" },
  "添加备注，可选": { "zh-TW": "新增備註，可選", en: "Add notes, optional" },
  "请至少添加一个待办条目。": { "zh-TW": "請至少新增一個待辦項目。", en: "Add at least one To Do item." },
  "保存失败": { "zh-TW": "儲存失敗", en: "Unable to save" },
  "请确认本地服务正在运行": { "zh-TW": "請確認本機服務正在執行", en: "Check that the local service is running" },
  "计划标题": { "zh-TW": "計劃標題", en: "Plan title" },
  "日计划复盘，可留空": { "zh-TW": "每日計劃回顧，可留空", en: "Daily plan review, optional" },
  "进度名称": { "zh-TW": "進度名稱", en: "Progress name" },
  "分类，例如 football / study": { "zh-TW": "分類，例如 football / study", en: "Category, e.g. football / study" },
  "当前": { "zh-TW": "目前", en: "Current" },
  "目标": { "zh-TW": "目標", en: "Target" },
  "固定到底部进度条": { "zh-TW": "固定到底部進度條", en: "Pin to bottom progress bar" },
  "正在读取课表...": { "zh-TW": "正在讀取課表...", en: "Loading timetable..." },
  "读取失败": { "zh-TW": "讀取失敗", en: "Unable to load" },
  "已生成导入预览，请检查后确认。": { "zh-TW": "已產生匯入預覽，請檢查後確認。", en: "Import preview ready. Review it before confirming." },
  "正在解析 ICS 文件...": { "zh-TW": "正在解析 ICS 檔案...", en: "Reading ICS file..." },
  "解析失败": { "zh-TW": "解析失敗", en: "Unable to read the file" },
  "上传 .ics 文件": { "zh-TW": "上傳 .ics 檔案", en: "Upload .ics file" },
  "截图识别入口已预留：可多选 PNG/JPG/WebP，识别结果只会进入预览，不会直接写入正式课表。": { "zh-TW": "截圖識別入口已預留：可多選 PNG/JPG/WebP，識別結果只會進入預覽，不會直接寫入正式課表。", en: "Choose PNG, JPG or WebP timetable images. Recognition results are previewed before anything is saved." },
  "截图已选择。结构化 OCR 将作为下一阶段接入；当前不会写入数据库。": { "zh-TW": "已選擇截圖。結構化 OCR 將在下一階段接入；目前不會寫入資料庫。", en: "Image selected. Structured OCR is not enabled yet, so nothing will be saved." },
  "修改范围：single / week / month / future / series": { "zh-TW": "修改範圍：single / week / month / future / series", en: "Edit scope: single / week / month / future / series" },
  "取消范围：single / week / month / future / series": { "zh-TW": "取消範圍：single / week / month / future / series", en: "Cancel scope: single / week / month / future / series" },
  "新的地点": { "zh-TW": "新地點", en: "New location" },
  "课程更新失败": { "zh-TW": "課程更新失敗", en: "Unable to update the class" },
  "确定取消选中范围内的课程吗？": { "zh-TW": "確定取消選中範圍內的課程嗎？", en: "Cancel the classes in the selected scope?" },
  "课程取消失败": { "zh-TW": "課程取消失敗", en: "Unable to cancel the class" }
  ,"新建每日 To Do List": { "zh-TW": "新增每日待辦清單", en: "New Daily To Do List" }
  ,"粘贴活动信息或上传截图，确认后会加入 Calendar 和当天 To Do。": { "zh-TW": "貼上活動資訊或上傳截圖，確認後會加入 Calendar 和當天待辦。", en: "Paste event details or upload an image. Review it before adding it to Calendar and today's To Do." }
  ,"粘贴文字": { "zh-TW": "貼上文字", en: "Paste text" }
  ,"上传截图": { "zh-TW": "上傳截圖", en: "Upload image" }
  ,"例如：7月20日 上午10点到11点 Coffee chat\n地点：Fisher Library": { "zh-TW": "例如：7月20日 上午10點到11點 Coffee chat\n地點：Fisher Library", en: "Example: 20 July, 10:00-11:00 Coffee chat\nLocation: Fisher Library" }
  ,"选择活动截图": { "zh-TW": "選擇活動截圖", en: "Choose event image" }
  ,"支持中文和英文图片，识别结果会先进入预览": { "zh-TW": "支援中文和英文圖片，識別結果會先進入預覽", en: "Chinese and English images are supported. Results are previewed first." }
  ,"正在识别图片": { "zh-TW": "正在識別圖片", en: "Reading image" }
  ,"识别活动信息": { "zh-TW": "識別活動資訊", en: "Recognise event details" }
  ,"确认识别结果": { "zh-TW": "確認識別結果", en: "Review recognised details" }
  ,"可信度": { "zh-TW": "可信度", en: "Confidence" }
  ,"日程标题": { "zh-TW": "日程標題", en: "Schedule title" }
  ,"地点，可选": { "zh-TW": "地點，可選", en: "Location, optional" }
  ,"旧手动课程（只读）": { "zh-TW": "舊手動課程（唯讀）", en: "Legacy manual courses (read only)" }
  ,"结余": { "zh-TW": "結餘", en: "Balance" }
  ,"上传中...": { "zh-TW": "上傳中...", en: "Uploading..." }
  ,"上传凭证、小票或账单图片 · JPG、PNG、WEBP 或 PDF，可选": { "zh-TW": "上傳憑證、收據或帳單圖片 · JPG、PNG、WEBP 或 PDF，可選", en: "Upload a receipt or bill · JPG, PNG, WebP or PDF, optional" }
  ,"输入任务标题": { "zh-TW": "輸入任務標題", en: "Task title" }
  ,"类型": { "zh-TW": "類型", en: "Type" }
  ,"计数进度": { "zh-TW": "計數進度", en: "Count progress" }
  ,"当前值": { "zh-TW": "目前值", en: "Current value" }
  ,"目标值": { "zh-TW": "目標值", en: "Target value" }
  ,"无需计数": { "zh-TW": "無需計數", en: "No count needed" }
  ,"是否提醒": { "zh-TW": "是否提醒", en: "Reminder" }
  ,"默认选项，不发送通知": { "zh-TW": "預設選項，不傳送通知", en: "Default option. No notification is sent." }
  ,"每天提醒一次": { "zh-TW": "每天提醒一次", en: "Daily reminder" }
  ,"截止前 24 小时": { "zh-TW": "截止前 24 小時", en: "24 hours before due" }
  ,"任务有截止时间时生效": { "zh-TW": "任務有截止時間時生效", en: "Available when the task has a due time" }
  ,"每周提醒": { "zh-TW": "每週提醒", en: "Weekly reminder" }
  ,"每隔几天提醒": { "zh-TW": "每隔幾天提醒", en: "Interval reminder" }
  ,"提醒设置": { "zh-TW": "提醒設定", en: "Reminder settings" }
  ,"选择任务通知方式": { "zh-TW": "選擇任務通知方式", en: "Choose how this task should notify you" }
  ,"提醒参数": { "zh-TW": "提醒參數", en: "Reminder options" }
  ,"当前任务不会发送提醒通知。需要提醒时，在左侧选择一种提醒方式。": { "zh-TW": "目前任務不會傳送提醒通知。需要提醒時，請在左側選擇一種提醒方式。", en: "This task will not send notifications. Choose a reminder method on the left to enable one." }
  ,"系统会在任务截止前 24 小时提醒你。这个选项会使用任务里的截止时间，不需要额外设置。": { "zh-TW": "系統會在任務截止前 24 小時提醒你。此選項會使用任務的截止時間，不需要額外設定。", en: "MyAssist will remind you 24 hours before the task is due. No additional time is required." }
  ,"提醒时间": { "zh-TW": "提醒時間", en: "Reminder time" }
  ,"星期": { "zh-TW": "星期", en: "Day of week" }
  ,"每隔几天": { "zh-TW": "每隔幾天", en: "Every few days" }
  ,"从哪天开始": { "zh-TW": "從哪天開始", en: "Start date" }
  ,"每天到这个时间，MacBook 会收到一次任务提醒。": { "zh-TW": "每天到這個時間，MacBook 會收到一次任務提醒。", en: "Your MacBook will receive one task reminder at this time each day." }
  ,"这是旧任务里的提醒规则，仍会保留并生效。需要新的固定时间提醒时，可以在左侧改选每天、每周或每隔几天提醒。": { "zh-TW": "這是舊任務的提醒規則，仍會保留並生效。需要新的固定時間提醒時，可以在左側改選每天、每週或每隔幾天提醒。", en: "This legacy reminder rule remains active. Choose daily, weekly or interval reminders on the left to replace it." }
});

const traditionalCharacterMap = Object.fromEntries([
  ["设", "設"], ["页", "頁"], ["务", "務"], ["划", "劃"], ["课", "課"], ["记", "記"], ["录", "錄"],
  ["账", "帳"], ["户", "戶"], ["显", "顯"], ["标", "標"], ["题", "題"], ["储", "儲"], ["据", "據"],
  ["库", "庫"], ["径", "徑"], ["传", "傳"], ["连", "連"], ["线", "線"], ["载", "載"], ["筛", "篩"],
  ["选", "選"], ["签", "籤"], ["间", "間"], ["创", "創"], ["归", "歸"], ["档", "檔"], ["删", "刪"],
  ["复", "復"], ["统", "統"], ["计", "計"], ["数", "數"], ["览", "覽"], ["总", "總"], ["门", "門"],
  ["节", "節"], ["项", "項"], ["条", "條"], ["还", "還"], ["没", "沒"], ["这", "這"], ["个", "個"],
  ["为", "為"], ["与", "與"], ["开", "開"], ["闭", "閉"], ["导", "導"], ["预", "預"], ["认", "認"],
  ["确", "確"], ["动", "動"], ["态", "態"], ["联", "聯"], ["络", "絡"], ["发", "發"], ["现", "現"],
  ["应", "應"], ["网", "網"], ["图", "圖"], ["场", "場"], ["启", "啟"], ["历", "歷"], ["钟", "鐘"],
  ["频", "頻"], ["单", "單"], ["别", "別"], ["从", "從"], ["后", "後"], ["写", "寫"], ["读", "讀"]
]) as Record<string, string>;

function toTraditionalUi(source: string): string {
  return Array.from(source, (character) => traditionalCharacterMap[character] ?? character).join("");
}

function translateDynamicUiText(language: UiLanguage, source: string): string | null {
  let match = source.match(/^(\d+) 条待同步$/);
  if (match) return language === "en" ? `${match[1]} pending` : language === "zh-TW" ? `${match[1]} 條待同步` : source;
  match = source.match(/^(\d+) 条需重试$/);
  if (match) return language === "en" ? `${match[1]} to retry` : language === "zh-TW" ? `${match[1]} 條需重試` : source;
  match = source.match(/^(\d+) 节课程 · (\d+) 项 To Do$/);
  if (match) return language === "en" ? `${match[1]} courses · ${match[2]} To Dos` : language === "zh-TW" ? `${match[1]} 節課程 · ${match[2]} 項待辦` : source;
  match = source.match(/^(\d+) 个 To Do List$/);
  if (match) return language === "en" ? `${match[1]} To Do Lists` : language === "zh-TW" ? `${match[1]} 個待辦清單` : source;
  match = source.match(/^(\d+) 个计划$/);
  if (match) return language === "en" ? `${match[1]} plans` : language === "zh-TW" ? `${match[1]} 個計劃` : source;
  match = source.match(/^(\d+) 条$/);
  if (match) return language === "en" ? `${match[1]} items` : language === "zh-TW" ? `${match[1]} 條` : source;
  match = source.match(/^(\d+) 个$/);
  if (match) return language === "en" ? `${match[1]} items` : language === "zh-TW" ? `${match[1]} 個` : source;
  match = source.match(/^待同步 (\d+) 条 · 失败 (\d+) 条$/);
  if (match) return language === "en" ? `${match[1]} pending · ${match[2]} failed` : language === "zh-TW" ? `待同步 ${match[1]} 條 · 失敗 ${match[2]} 條` : source;
  match = source.match(/^(\d+) 个上课安排 · (\d+) 次课$/);
  if (match) return language === "en" ? `${match[1]} class slots · ${match[2]} classes` : language === "zh-TW" ? `${match[1]} 個上課安排 · ${match[2]} 次課` : source;
  match = source.match(/^已选择：(.+)$/);
  if (match) return language === "en" ? `Selected: ${match[1]}` : language === "zh-TW" ? `已選擇：${match[1]}` : source;
  match = source.match(/^导入完成：新增 (\d+)，更新 (\d+)，跳过 (\d+)，冲突 (\d+)$/);
  if (match) {
    if (language === "en") return `Import complete: ${match[1]} created, ${match[2]} updated, ${match[3]} skipped, ${match[4]} conflicts`;
    if (language === "zh-TW") return `匯入完成：新增 ${match[1]}，更新 ${match[2]}，略過 ${match[3]}，衝突 ${match[4]}`;
    return source;
  }
  match = source.match(/^(\d+) 门课程 · (\d+) 节课 · 重复 (\d+) · 冲突 (\d+)$/);
  if (match) {
    if (language === "en") return `${match[1]} courses · ${match[2]} classes · ${match[3]} duplicates · ${match[4]} conflicts`;
    if (language === "zh-TW") return `${match[1]} 門課程 · ${match[2]} 節課 · 重複 ${match[3]} · 衝突 ${match[4]}`;
    return source;
  }
  match = source.match(/^悉尼时间 · 来源 (\d+) · 课程系列 (\d+) · 当前显示 (\d+)$/);
  if (match) {
    if (language === "en") return `Sydney time · ${match[1]} sources · ${match[2]} course series · ${match[3]} shown`;
    if (language === "zh-TW") return `雪梨時間 · 來源 ${match[1]} · 課程系列 ${match[2]} · 目前顯示 ${match[3]}`;
    return source;
  }
  match = source.match(/^悉尼时间 · 来源 (\d+) · 已选课程 (\d+) · 课程系列 (\d+)$/);
  if (match) {
    if (language === "en") return `Sydney time · ${match[1]} sources · ${match[2]} selected courses · ${match[3]} course series`;
    if (language === "zh-TW") return `雪梨時間 · 來源 ${match[1]} · 已選課程 ${match[2]} · 課程系列 ${match[3]}`;
    return source;
  }
  return null;
}

export function translateUiText(language: UiLanguage, source: string): string {
  const exact = uiTranslations[source]?.[language];
  if (exact) return exact;
  const dynamic = translateDynamicUiText(language, source);
  if (dynamic) return dynamic;
  if (language === "zh-TW") return toTraditionalUi(source);
  return source;
}

export function uiLanguageLocale(language: UiLanguage): string {
  if (language === "en") return "en-AU";
  return language;
}
