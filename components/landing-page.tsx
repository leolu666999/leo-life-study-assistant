"use client";

import Image from "next/image";
import Link from "next/link";
import { type ReactNode, useEffect, useRef, useState } from "react";
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
import { UI_LANGUAGE_STORAGE_KEY } from "@/lib/ui-language";

type LandingLanguage = "zh-CN" | "en";

const landingCopy = {
  "zh-CN": {
    navAria: "首页导航",
    tagline: "你的留学生活助手",
    login: "登录",
    register: "注册",
    languageAria: "语言",
    heroBadge: "为海外学习和独立生活而设计",
    heroTagline: "你的留学生活助手",
    heroDescription: "把课表、任务、每日安排、收支和重要文件放在一个安静清晰的空间里。无论在电脑还是手机上，打开就能继续。",
    start: "开始使用",
    existingLogin: "已有账号登录",
    privateSpace: "独立账号空间",
    devices: "手机电脑都能使用",
    imageSwitcher: "切换悉尼背景图片",
    showImage: "显示",
    featuresEyebrow: "一个地方，整理每天",
    featuresTitleBefore: "留学生活，",
    featuresTitleAccent: "不必散落",
    featuresTitleAfter: "在十几个地方",
    featuresDescription: "MyAssist 把真正经常使用的工具放在一起，每个模块各司其职，同时又能在首页形成清楚的今日视图。",
    stepsEyebrow: "从注册到开始使用",
    stepsTitleBefore: "三步建立自己的",
    stepsTitleAccent: "空间",
    steps: [
      ["01", "创建账号", "使用唯一用户名、邮箱和密码注册，确认邮箱后进入自己的个人空间。"],
      ["02", "加入今天的内容", "导入课程，粘贴活动或上传截图生成日程，再添加 Task 与第一笔收支。"],
      ["03", "每天打开首页", "从 Today’s Schedule 开始，继续处理今天最重要的事情。"]
    ],
    ctaEyebrow: "准备好开始了吗？",
    ctaTitle: "让你的生活更有秩序。",
    freeAccount: "免费创建账号",
    contact: "联系开发者",
    credits: "首页照片：Jason Tong、Adam.J.W.C.、Jacques Grießmayer / Wikimedia Commons（已压缩为 WebP，原图许可见 README）",
    features: [
      ["任务与日程", "课程、活动和 To Do 汇成一条时间线", "粘贴活动文字或上传截图，确认后即可加入日程与当天 To Do。首页只保留未完成 Task，完成记录可在任务中心随时查看和恢复。"],
      ["日程与课程", "从开学第一周到整个学期", "导入课表后，用日、周和月视图查看课程与生活安排。点击单次课程，即可查看时间、地点、课次和课程类型。"],
      ["收支记录", "留学花销和收入，按币种记清楚", "记录消费、兼职收入和退款，保留每笔交易的币种、标签与凭证，不把不同币种错误相加。"],
      ["重要文件", "文件和文字资料都有自己的位置", "上传签证、合同和小票，也可创建纯文档保存地址、链接与备忘。内容按个人账号隔离，需要时再安全打开。"]
    ]
  },
  en: {
    navAria: "Home navigation",
    tagline: "Your study abroad life assistant",
    login: "Log in",
    register: "Sign up",
    languageAria: "Language",
    heroBadge: "Designed for studying abroad and independent living",
    heroTagline: "Your study abroad life assistant",
    heroDescription: "Keep your timetable, Task, daily plans, finances and important files in one calm, clear space. Pick up where you left off on your computer or phone.",
    start: "Get started",
    existingLogin: "Log in to your account",
    privateSpace: "Private account space",
    devices: "Works on phone and computer",
    imageSwitcher: "Switch Sydney background image",
    showImage: "Show ",
    featuresEyebrow: "One place for every day",
    featuresTitleBefore: "Study abroad life, ",
    featuresTitleAccent: "without the clutter",
    featuresTitleAfter: " of ten different apps",
    featuresDescription: "MyAssist brings together the tools you actually use. Each module has a clear purpose, while the home page gives you one focused view of today.",
    stepsEyebrow: "From sign-up to your first day",
    stepsTitleBefore: "Build your own space in ",
    stepsTitleAccent: "three steps",
    steps: [
      ["01", "Create your account", "Register with a unique username, email and password, then confirm your email to enter your private space."],
      ["02", "Add today’s essentials", "Import courses, paste an event or upload a screenshot to create a schedule, then add a Task and your first transaction."],
      ["03", "Open your home page daily", "Start with Today’s Schedule and continue with what matters most today."]
    ],
    ctaEyebrow: "Ready to begin?",
    ctaTitle: "Bring more order to your life.",
    freeAccount: "Create a free account",
    contact: "Contact the developer",
    credits: "Homepage photos: Jason Tong, Adam.J.W.C. and Jacques Grießmayer / Wikimedia Commons (compressed to WebP; original licences are listed in README)",
    features: [
      ["Task and schedule", "Courses, events and To Do on one timeline", "Paste event details or upload a screenshot, review the result, and add it to your schedule and daily To Do. The home page shows active Task only; completed items remain available in the Task centre."],
      ["Schedule and courses", "From the first week to the whole semester", "Import your timetable and view courses alongside daily life in day, week and month views. Open an individual class to see its time, location, occurrence and class type."],
      ["Income and expenses", "Keep study abroad spending clear in every currency", "Record spending, part-time income and refunds while preserving each transaction’s currency, tags and receipt. Different currencies are never added together incorrectly."],
      ["Important files", "A place for files and written information", "Upload visas, contracts and receipts, or create secure text documents for addresses, links and notes. Content stays isolated to your account and opens securely when needed."]
    ]
  }
} as const;

const heroImages = [
  {
    src: "/images/sydney-usyd-quadrangle.webp",
    alt: "悉尼大学主楼与草坪",
    label: "The University of Sydney",
    position: "center 58%"
  },
  {
    src: "/images/sydney-harbour-bridge.webp",
    alt: "黄昏中的悉尼海港大桥",
    label: "Sydney Harbour Bridge",
    position: "center center"
  },
  {
    src: "/images/sydney-opera-house.webp",
    alt: "蓝色夜幕下的悉尼歌剧院与海港大桥",
    label: "Sydney Opera House",
    position: "center 66%"
  }
];

type RevealDirection = "up" | "down" | "left" | "right";

const revealDirectionClasses: Record<RevealDirection, string> = {
  up: "translate-y-7",
  down: "-translate-y-7",
  left: "-translate-x-7",
  right: "translate-x-7"
};

function Reveal({
  children,
  className = "",
  delay = 0,
  direction = "up"
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: RevealDirection;
}) {
  const elementRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduceMotion.matches || !("IntersectionObserver" in window)) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setIsVisible(true);
        observer.unobserve(entry.target);
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.14 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={elementRef}
      style={{ transitionDelay: isVisible ? `${delay}ms` : "0ms" }}
      className={`${className} transition-[opacity,transform] duration-700 ease-out motion-reduce:transform-none motion-reduce:opacity-100 motion-reduce:transition-none ${
        isVisible
          ? "translate-x-0 translate-y-0 opacity-100"
          : `${revealDirectionClasses[direction]} opacity-0 will-change-transform`
      }`}
    >
      {children}
    </div>
  );
}

export function LandingPage() {
  const [activeHero, setActiveHero] = useState(0);
  const [language, setLanguage] = useState<LandingLanguage>("zh-CN");

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      setActiveHero((current) => (current + 1) % heroImages.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem(UI_LANGUAGE_STORAGE_KEY);
    if (saved === "en") setLanguage("en");
  }, []);

  function selectLanguage(next: LandingLanguage) {
    setLanguage(next);
    window.localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, next);
    document.documentElement.lang = next;
  }

  const text = landingCopy[language];
  const featureVisuals = [
    <SchedulePreview key="schedule" language={language} />,
    <TimetablePreview key="timetable" language={language} />,
    <FinancePreview key="finance" language={language} />,
    <FilesPreview key="files" language={language} />
  ];

  return (
    <main className="min-h-screen overflow-x-hidden bg-white text-slate-950">
      <header className="absolute inset-x-0 top-0 z-20 border-b border-white/20 bg-slate-950/25 text-white backdrop-blur-md">
        <nav className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8" aria-label={text.navAria}>
          <Link href="/" className="flex min-w-0 items-baseline gap-2 text-white">
            <span className="text-xl font-bold">MyAssist</span>
            <span className="hidden text-sm text-white/75 sm:inline">{text.tagline}</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="grid grid-cols-2 rounded-lg border border-white/25 bg-slate-950/25 p-1" aria-label={text.languageAria}>
              <button
                type="button"
                aria-pressed={language === "zh-CN"}
                onClick={() => selectLanguage("zh-CN")}
                className={`h-8 min-w-9 rounded-md px-2 text-xs font-semibold transition ${language === "zh-CN" ? "bg-white text-slate-950" : "text-white/75 hover:text-white"}`}
              >
                中
              </button>
              <button
                type="button"
                aria-pressed={language === "en"}
                onClick={() => selectLanguage("en")}
                className={`h-8 min-w-11 rounded-md px-2 text-xs font-semibold transition ${language === "en" ? "bg-white text-slate-950" : "text-white/75 hover:text-white"}`}
              >
                EN
              </button>
            </div>
            <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/15 sm:px-4">
              {text.login}
            </Link>
            <Link href="/register" className="rounded-lg bg-[#e64626] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#cf3b1e]">
              {text.register}
            </Link>
          </div>
        </nav>
      </header>

      <section className="relative min-h-[calc(100svh-4rem)] overflow-hidden border-b border-slate-800 bg-slate-950 text-white">
        {heroImages.map((image, index) => (
          <Image
            key={image.src}
            src={image.src}
            alt={image.alt}
            fill
            priority={index === 0}
            quality={92}
            sizes="100vw"
            style={{ objectPosition: image.position }}
            className={`object-cover transition-opacity duration-1000 ${index === activeHero ? "opacity-100" : "opacity-0"}`}
          />
        ))}
        <div className="absolute inset-0 bg-slate-950/55" aria-hidden="true" />
        <div className="relative mx-auto flex min-h-[calc(100svh-4rem)] max-w-7xl items-center px-4 pb-20 pt-28 sm:px-6 sm:pb-24 sm:pt-32 lg:px-8">
          <Reveal className="max-w-2xl" direction="up" delay={100}>
            <p className="mb-5 inline-flex items-center rounded-full border border-[#ff8a65]/60 bg-[#e64626]/85 px-3 py-1.5 text-sm font-semibold text-white">
              {text.heroBadge}
            </p>
            <h1 className="text-4xl font-bold leading-[1.05] text-white sm:text-6xl lg:text-7xl">
              MyAssist
              <span className="mt-3 block text-2xl font-semibold text-white/80 sm:ml-4 sm:mt-0 sm:inline sm:text-3xl lg:text-4xl">{text.heroTagline}</span>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-8 text-white/85 sm:text-lg">
              {text.heroDescription}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register" className="inline-flex items-center gap-2 rounded-lg bg-[#e64626] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#cf3b1e]">
                {text.start} <ArrowRight size={17} />
              </Link>
              <Link href="/login" className="rounded-lg border border-white/45 bg-slate-950/25 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-950/45">
                {text.existingLogin}
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/75">
              <span className="inline-flex items-center gap-2"><ShieldCheck size={17} /> {text.privateSpace}</span>
              <span className="inline-flex items-center gap-2"><Smartphone size={17} /> {text.devices}</span>
            </div>
          </Reveal>
        </div>
        <div className="absolute inset-x-0 bottom-0 z-10 border-t border-white/20 bg-slate-950/35 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <span className="truncate text-xs font-semibold text-white/80 sm:text-sm">{heroImages[activeHero].label}</span>
            <div className="flex items-center gap-2" aria-label={text.imageSwitcher}>
              {heroImages.map((image, index) => (
                <button
                  key={image.src}
                  type="button"
                  aria-label={`${text.showImage}${image.label}`}
                  aria-pressed={index === activeHero}
                  onClick={() => setActiveHero(index)}
                  className={`h-2.5 w-2.5 rounded-full border transition ${index === activeHero ? "border-[#ff8a65] bg-[#e64626]" : "border-white bg-transparent hover:bg-white/50"}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="border-b border-slate-200 bg-white py-14 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="max-w-3xl" direction="up">
            <p className="text-sm font-semibold text-[#d63d20]">{text.featuresEyebrow}</p>
            <h2 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">{text.featuresTitleBefore}<span className="text-[#d63d20]">{text.featuresTitleAccent}</span>{text.featuresTitleAfter}</h2>
            <p className="mt-5 text-base leading-8 text-slate-600">{text.featuresDescription}</p>
          </Reveal>

          <div className="mt-16 divide-y divide-slate-200 border-y border-slate-200">
            {text.features.map(([eyebrow, title, description], index) => (
              <article key={eyebrow} className="grid items-center gap-10 py-14 lg:grid-cols-2 lg:gap-16">
                <Reveal className={index % 2 === 1 ? "lg:order-2" : ""} direction={index % 2 === 0 ? "left" : "right"}>
                  <p className="inline-flex items-center rounded-full bg-[#fff0eb] px-3 py-1.5 text-sm font-semibold text-[#c9361b]">{eyebrow}</p>
                  <h3 className="mt-3 text-2xl font-bold sm:text-3xl">{title}</h3>
                  <p className="mt-4 max-w-xl text-base leading-8 text-slate-600">{description}</p>
                </Reveal>
                <Reveal className={index % 2 === 1 ? "lg:order-1" : ""} direction="up" delay={120}>{featureVisuals[index]}</Reveal>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-slate-50 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <Reveal direction="left">
              <p className="text-sm font-semibold text-[#d63d20]">{text.stepsEyebrow}</p>
              <h2 className="mt-3 text-3xl font-bold sm:text-4xl">{text.stepsTitleBefore}<span className="text-[#d63d20]">{text.stepsTitleAccent}</span></h2>
            </Reveal>
            <Reveal direction="right" delay={100}>
              <ol className="divide-y divide-slate-200 border-y border-slate-200">
                {text.steps.map(([number, title, description]) => (
                  <li key={number} className="grid gap-3 py-7 sm:grid-cols-[64px_160px_1fr] sm:items-start">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e64626] text-sm font-bold text-white">{number}</span>
                    <strong className="text-base">{title}</strong>
                    <span className="text-sm leading-7 text-slate-600">{description}</span>
                  </li>
                ))}
              </ol>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="bg-slate-950 py-16 text-white sm:py-20">
        <div className="mx-auto flex max-w-7xl flex-col gap-7 px-4 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
          <Reveal className="max-w-2xl" direction="left">
            <p className="text-sm font-semibold text-[#ff8a65]">{text.ctaEyebrow}</p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">{text.ctaTitle}</h2>
          </Reveal>
          <Reveal className="flex flex-wrap gap-3" direction="right" delay={100}>
            <Link href="/register" className="rounded-lg bg-[#e64626] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#cf3b1e]">{text.freeAccount}</Link>
            <Link href="/login" className="rounded-lg border border-slate-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-900">{text.login}</Link>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-slate-800 bg-slate-950 py-7 text-slate-400">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 text-xs sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm">MyAssist · {text.tagline}</span>
            <Link href="/contact-developer" className="text-sm transition hover:text-white">{text.contact}</Link>
          </div>
          <p className="leading-6 text-slate-500">
            {text.credits}
          </p>
        </div>
      </footer>
    </main>
  );
}

function SchedulePreview({ language }: { language: LandingLanguage }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-soft">
      <div className="flex items-center justify-between border-b border-[#ffd6c9] bg-[#fff8f5] px-4 py-3">
        <span className="inline-flex items-center gap-2 text-sm font-semibold"><CalendarDays size={17} className="text-[#d63d20]" /> Today’s Schedule</span>
        <span className="text-xs text-slate-400">{language === "en" ? "16 July" : "7月16日"}</span>
      </div>
      <div className="grid grid-cols-[58px_1fr] px-4 py-4 text-xs">
        <div className="space-y-10 pt-1 text-slate-400"><div>09:00</div><div>10:00</div><div>11:00</div><div>12:00</div></div>
        <div className="relative min-h-[190px] border-l border-slate-200 pl-3">
          <div className="absolute inset-x-3 top-0 rounded-md border border-[#ffb39d] bg-[#fff0eb] p-3 text-slate-800">
            <div className="font-semibold">DATA1001 Workshop</div>
            <div className="mt-1 inline-flex items-center gap-1 font-medium text-[#b63219]"><Clock3 size={12} /> 09:00 - 10:30</div>
          </div>
          <div className="absolute inset-x-3 top-[104px] rounded-md border border-slate-200 bg-slate-50 p-3 text-slate-800">
            <div className="font-semibold">{language === "en" ? "Finish this week’s reading" : "完成本周阅读"}</div>
            <div className="mt-1 inline-flex items-center gap-1 text-slate-500"><ListChecks size={12} /> To Do</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TimetablePreview({ language }: { language: LandingLanguage }) {
  const days = language === "en" ? ["Mon", "Tue", "Wed", "Thu", "Fri"] : ["一", "二", "三", "四", "五"];
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-soft">
      <div className="flex items-center justify-between border-b border-[#ffd6c9] bg-[#fff8f5] px-4 py-3">
        <span className="inline-flex items-center gap-2 text-sm font-semibold"><BookOpen size={17} className="text-[#d63d20]" /> {language === "en" ? "This week’s timetable" : "本周课表"}</span>
        <span className="text-xs text-slate-400">{language === "en" ? "Sydney time" : "悉尼时间"}</span>
      </div>
      <div className="grid grid-cols-5 border-b border-slate-200 bg-slate-50 text-center text-xs text-slate-500">
        {days.map((day) => <div key={day} className="border-r border-slate-200 px-2 py-2 last:border-r-0">{language === "en" ? day : `周${day}`}</div>)}
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
    <div className={`absolute inset-x-1 rounded-md border border-[#ff9f85] bg-[#fff0eb] p-2 ${className}`}>
      <div className="truncate text-[11px] font-semibold">{code}</div>
      <div className="mt-1 truncate text-[9px] font-medium text-[#a9341d]">{room}</div>
    </div>
  );
}

function FinancePreview({ language }: { language: LandingLanguage }) {
  const entries = language === "en"
    ? [["Groceries", "Today", "-A$ 24.80"], ["Part-time income", "Yesterday", "+A$ 120.00"], ["Transport", "14 July", "-A$ 5.60"]]
    : [["超市购物", "今天", "-A$ 24.80"], ["兼职收入", "昨天", "+A$ 120.00"], ["交通", "7月14日", "-A$ 5.60"]];
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-sm font-semibold"><WalletCards size={17} className="text-[#d63d20]" /> {language === "en" ? "This month’s finances" : "本月收支"}</span>
        <span className="text-xs text-slate-400">{language === "en" ? "By currency" : "按币种统计"}</span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-md bg-slate-950 p-4 text-white"><div className="text-xs text-slate-300">AUD {language === "en" ? "balance" : "结余"}</div><div className="mt-2 text-2xl font-bold text-[#ff8a65]">A$ 486.20</div></div>
        <div className="rounded-md border border-[#ffd6c9] bg-[#fff0eb] p-4"><div className="text-xs text-[#a9341d]">CNY {language === "en" ? "balance" : "结余"}</div><div className="mt-2 text-2xl font-bold">¥ 820.00</div></div>
      </div>
      <div className="mt-5 divide-y divide-slate-100 border-y border-slate-100">
        {entries.map(([title, date, value]) => (
          <div key={title} className="flex items-center justify-between py-3 text-sm">
            <span><strong className="block font-medium">{title}</strong><span className="text-xs text-slate-400">{date}</span></span>
            <span className={value.startsWith("+") ? "font-semibold text-emerald-700" : "font-semibold"}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FilesPreview({ language }: { language: LandingLanguage }) {
  const files = language === "en"
    ? [["Visa documents", "Valid until 2027/07", "PDF"], ["Rental agreement", "Updated 12 July", "PDF"], ["Student ID", "Personal information", "IMG"]]
    : [["签证文件", "有效期至 2027/07", "PDF"], ["租房合同", "更新于 7月12日", "PDF"], ["学生证件", "个人资料", "IMG"]];
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-sm font-semibold"><FolderLock size={17} className="text-[#d63d20]" /> {language === "en" ? "Important files" : "重要文件"}</span>
        <ShieldCheck size={18} className="text-[#d63d20]" />
      </div>
      <div className="mt-5 divide-y divide-slate-100 border-y border-slate-100">
        {files.map(([title, detail, type]) => (
          <div key={title} className="flex items-center gap-3 py-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#fff0eb] text-[#c9361b]"><FileText size={18} /></span>
            <span className="min-w-0 flex-1"><strong className="block truncate text-sm font-medium">{title}</strong><span className="text-xs text-slate-400">{detail}</span></span>
            <span className="text-[10px] font-semibold text-slate-400">{type}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs font-medium text-[#a9341d]"><MapPin size={14} /> {language === "en" ? "Only this account can access these files" : "仅当前账号可以访问"}</div>
    </div>
  );
}
