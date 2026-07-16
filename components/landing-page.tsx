import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Clock3,
  FileText,
  FolderLock,
  ListChecks,
  MapPin,
  ShieldCheck,
  Smartphone,
  WalletCards
} from "lucide-react";

const featureItems = [
  {
    eyebrow: "任务与日程",
    title: "今天要做什么，一眼就知道",
    description: "每日 To Do、长期任务和带时间的安排自动汇集。课程与生活事项按时间排列，不再来回翻找。",
    visual: <SchedulePreview />
  },
  {
    eyebrow: "课程与课表",
    title: "从开学第一周到整个学期",
    description: "导入课表后，用日、周和月视图查看课程。上课时间、地点和课程类型始终放在一起。",
    visual: <TimetablePreview />
  },
  {
    eyebrow: "收支记录",
    title: "留学花销和收入，按币种记清楚",
    description: "记录消费、兼职收入和退款，保留每笔交易的币种、标签与凭证，不把不同币种错误相加。",
    visual: <FinancePreview />
  },
  {
    eyebrow: "重要文件",
    title: "签证、合同和小票都有自己的位置",
    description: "文件与个人账号隔离保存，需要查看时再安全打开。手机和电脑都能继续处理自己的资料。",
    visual: <FilesPreview />
  }
];

export function LandingPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-white text-slate-950">
      <header className="relative z-20 border-b border-slate-200 bg-white">
        <nav className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8" aria-label="首页导航">
          <Link href="/" className="flex min-w-0 items-baseline gap-2 text-slate-950">
            <span className="text-xl font-bold">MyAssist</span>
            <span className="hidden text-sm text-slate-500 sm:inline">你的留学生活助手</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 sm:px-4">
              登录
            </Link>
            <Link href="/register" className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800">
              注册
            </Link>
          </div>
        </nav>
      </header>

      <section className="relative min-h-[calc(100svh-11rem)] overflow-hidden border-b border-slate-200 sm:min-h-[calc(100svh-7.5rem)]">
        <Image
          src="/images/myassist-landing-hero.webp"
          alt="学生使用电脑和手机整理课表与任务"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[62%_center] opacity-40 sm:object-[68%_center] sm:opacity-100"
        />
        <div className="absolute inset-0 bg-white/35 sm:bg-white/20" aria-hidden="true" />
        <div className="relative mx-auto flex min-h-[calc(100svh-11rem)] max-w-7xl items-center px-4 py-10 sm:min-h-[calc(100svh-7.5rem)] sm:px-6 sm:py-16 lg:px-8">
          <div className="max-w-2xl pb-10 pt-6 sm:pb-16">
            <p className="mb-5 text-sm font-semibold text-slate-700">为海外学习和独立生活而设计</p>
            <h1 className="text-4xl font-bold leading-[1.05] text-slate-950 sm:text-6xl lg:text-7xl">
              MyAssist
              <span className="mt-3 block text-2xl font-semibold text-slate-700 sm:ml-4 sm:mt-0 sm:inline sm:text-3xl lg:text-4xl">你的留学生活助手</span>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-8 text-slate-700 sm:text-lg">
              把课表、任务、每日安排、收支和重要文件放在一个安静清晰的空间里。无论在电脑还是手机上，打开就能继续。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register" className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
                开始使用 <ArrowRight size={17} />
              </Link>
              <Link href="/login" className="rounded-lg border border-slate-300 bg-white/90 px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-white">
                已有账号登录
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-700">
              <span className="inline-flex items-center gap-2"><ShieldCheck size={17} /> 独立账号空间</span>
              <span className="inline-flex items-center gap-2"><Smartphone size={17} /> 手机电脑都能使用</span>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="border-b border-slate-200 bg-white py-14 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-slate-500">一个地方，整理每天</p>
            <h2 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">留学生活，不必散落在十几个地方</h2>
            <p className="mt-5 text-base leading-8 text-slate-600">MyAssist 把真正经常使用的工具放在一起，每个模块各司其职，同时又能在首页形成清楚的今日视图。</p>
          </div>

          <div className="mt-16 divide-y divide-slate-200 border-y border-slate-200">
            {featureItems.map((item, index) => (
              <article key={item.eyebrow} className="grid items-center gap-10 py-14 lg:grid-cols-2 lg:gap-16">
                <div className={index % 2 === 1 ? "lg:order-2" : ""}>
                  <p className="text-sm font-semibold text-slate-500">{item.eyebrow}</p>
                  <h3 className="mt-3 text-2xl font-bold sm:text-3xl">{item.title}</h3>
                  <p className="mt-4 max-w-xl text-base leading-8 text-slate-600">{item.description}</p>
                </div>
                <div className={index % 2 === 1 ? "lg:order-1" : ""}>{item.visual}</div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-slate-50 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div>
              <p className="text-sm font-semibold text-slate-500">从注册到开始使用</p>
              <h2 className="mt-3 text-3xl font-bold sm:text-4xl">三步建立自己的空间</h2>
            </div>
            <ol className="divide-y divide-slate-200 border-y border-slate-200">
              {[
                ["01", "创建账号", "使用唯一用户名、邮箱和密码注册，确认邮箱后进入自己的个人空间。"],
                ["02", "加入今天的内容", "导入课程，添加任务或 To Do，再记录第一笔收支。"],
                ["03", "每天打开首页", "从 Today’s Schedule 开始，继续处理今天最重要的事情。"]
              ].map(([number, title, description]) => (
                <li key={number} className="grid gap-3 py-7 sm:grid-cols-[64px_160px_1fr] sm:items-start">
                  <span className="text-sm font-semibold text-slate-400">{number}</span>
                  <strong className="text-base">{title}</strong>
                  <span className="text-sm leading-7 text-slate-600">{description}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="bg-slate-950 py-16 text-white sm:py-20">
        <div className="mx-auto flex max-w-7xl flex-col gap-7 px-4 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-slate-300">准备好开始了吗？</p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">让下一周比这一周更清楚。</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/register" className="rounded-lg bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100">免费创建账号</Link>
            <Link href="/login" className="rounded-lg border border-slate-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-900">登录</Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-800 bg-slate-950 py-7 text-slate-400">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>MyAssist · 你的留学生活助手</span>
          <Link href="/contact-developer" className="transition hover:text-white">联系开发者</Link>
        </div>
      </footer>
    </main>
  );
}

function SchedulePreview() {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-soft">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <span className="inline-flex items-center gap-2 text-sm font-semibold"><CalendarDays size={17} /> Today’s Schedule</span>
        <span className="text-xs text-slate-400">7月16日</span>
      </div>
      <div className="grid grid-cols-[58px_1fr] px-4 py-4 text-xs">
        <div className="space-y-10 pt-1 text-slate-400"><div>09:00</div><div>10:00</div><div>11:00</div><div>12:00</div></div>
        <div className="relative min-h-[190px] border-l border-slate-200 pl-3">
          <div className="absolute inset-x-3 top-0 rounded-md border border-red-200 bg-red-50 p-3 text-slate-800">
            <div className="font-semibold">DATA1001 Workshop</div>
            <div className="mt-1 inline-flex items-center gap-1 text-slate-500"><Clock3 size={12} /> 09:00 - 10:30</div>
          </div>
          <div className="absolute inset-x-3 top-[104px] rounded-md border border-slate-200 bg-slate-50 p-3 text-slate-800">
            <div className="font-semibold">完成本周阅读</div>
            <div className="mt-1 inline-flex items-center gap-1 text-slate-500"><ListChecks size={12} /> To Do</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TimetablePreview() {
  const days = ["一", "二", "三", "四", "五"];
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-soft">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <span className="inline-flex items-center gap-2 text-sm font-semibold"><BookOpen size={17} /> 本周课表</span>
        <span className="text-xs text-slate-400">悉尼时间</span>
      </div>
      <div className="grid grid-cols-5 border-b border-slate-200 bg-slate-50 text-center text-xs text-slate-500">
        {days.map((day) => <div key={day} className="border-r border-slate-200 px-2 py-2 last:border-r-0">周{day}</div>)}
      </div>
      <div className="grid min-h-[210px] grid-cols-5">
        {days.map((day, index) => (
          <div key={day} className="relative border-r border-slate-100 p-1.5 last:border-r-0">
            {index === 0 && <CourseBlock className="top-5" code="INFO1110" room="PNR 310" />}
            {index === 1 && <CourseBlock className="top-20" code="MATH1061" room="Wallace 200" />}
            {index === 3 && <CourseBlock className="top-10" code="DATA1001" room="BHB B2010" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function CourseBlock({ code, room, className }: { code: string; room: string; className: string }) {
  return (
    <div className={`absolute inset-x-1 rounded-md border border-red-200 bg-red-50 p-2 ${className}`}>
      <div className="truncate text-[11px] font-semibold">{code}</div>
      <div className="mt-1 truncate text-[9px] text-slate-500">{room}</div>
    </div>
  );
}

function FinancePreview() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-sm font-semibold"><WalletCards size={17} /> 本月收支</span>
        <span className="text-xs text-slate-400">按币种统计</span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-md bg-slate-950 p-4 text-white"><div className="text-xs text-slate-300">AUD 结余</div><div className="mt-2 text-2xl font-bold">A$ 486.20</div></div>
        <div className="rounded-md bg-slate-100 p-4"><div className="text-xs text-slate-500">CNY 结余</div><div className="mt-2 text-2xl font-bold">¥ 820.00</div></div>
      </div>
      <div className="mt-5 divide-y divide-slate-100 border-y border-slate-100">
        {[["超市购物", "今天", "-A$ 24.80"], ["兼职收入", "昨天", "+A$ 120.00"], ["交通", "7月14日", "-A$ 5.60"]].map(([title, date, value]) => (
          <div key={title} className="flex items-center justify-between py-3 text-sm">
            <span><strong className="block font-medium">{title}</strong><span className="text-xs text-slate-400">{date}</span></span>
            <span className={value.startsWith("+") ? "font-semibold text-emerald-700" : "font-semibold"}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FilesPreview() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-sm font-semibold"><FolderLock size={17} /> 重要文件</span>
        <ShieldCheck size={18} className="text-emerald-700" />
      </div>
      <div className="mt-5 divide-y divide-slate-100 border-y border-slate-100">
        {[["签证文件", "有效期至 2027/07", "PDF"], ["租房合同", "更新于 7月12日", "PDF"], ["学生证件", "个人资料", "IMG"]].map(([title, detail, type]) => (
          <div key={title} className="flex items-center gap-3 py-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100"><FileText size={18} /></span>
            <span className="min-w-0 flex-1"><strong className="block truncate text-sm font-medium">{title}</strong><span className="text-xs text-slate-400">{detail}</span></span>
            <span className="text-[10px] font-semibold text-slate-400">{type}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs text-slate-500"><MapPin size={14} /> 仅当前账号可以访问</div>
    </div>
  );
}
