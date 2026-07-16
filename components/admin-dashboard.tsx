"use client";

import { FileText, LayoutDashboard, MessageSquareText, Search, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type UserRow = { id: string; email: string | null; username: string | null; createdAt: string; lastSignInAt: string | null };
type MessageRow = { id: string; user_id: string | null; username: string | null; email: string | null; message: string; status: string; created_at: string };
const dataTabs = [["tasks", "Task / Deadline"], ["todo", "To Do"], ["expenses", "Expense"], ["journal", "Journal"], ["timetable", "Course / Timetable"], ["importantFiles", "Important Files"], ["files", "上传文件"], ["documents", "纯文档"]] as const;

export function AdminDashboard() {
  const [stats, setStats] = useState<Record<string, unknown>>({});
  const [users, setUsers] = useState<UserRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [detail, setDetail] = useState<{ counts?: Record<string, number> }>({});
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [activeData, setActiveData] = useState("tasks");

  const load = useCallback(async () => {
    const [statsResponse, usersResponse, messagesResponse] = await Promise.all([
      fetch("/api/admin/system/stats"), fetch(`/api/admin/users?q=${encodeURIComponent(query)}`), fetch("/api/admin/messages")
    ]);
    if (statsResponse.ok) setStats(await statsResponse.json());
    if (usersResponse.ok) setUsers((await usersResponse.json()).users || []);
    if (messagesResponse.ok) setMessages((await messagesResponse.json()).messages || []);
  }, [query]);
  useEffect(() => { void load(); }, [load]);

  async function openUser(user: UserRow, type = activeData) {
    setSelected(user); setActiveData(type);
    const [detailResponse, rowsResponse] = await Promise.all([
      fetch(`/api/admin/users/${user.id}`), fetch(`/api/admin/users/${user.id}/data?type=${type}`)
    ]);
    if (detailResponse.ok) setDetail(await detailResponse.json());
    if (rowsResponse.ok) setRows((await rowsResponse.json()).rows || []);
  }
  async function updateMessage(id: string, status: string) {
    await fetch(`/api/admin/messages/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
    await load();
  }
  async function openFile(row: Record<string, unknown>) {
    if (!selected) return;
    const response = await fetch(`/api/admin/users/${selected.id}/files/${row.id}/signed-url`, { method: "POST" });
    if (response.ok) window.open((await response.json()).url, "_blank", "noopener,noreferrer");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-950">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex items-center justify-between"><div><p className="text-sm text-slate-500">MyAssist</p><h1 className="text-2xl font-semibold">Admin Dashboard</h1></div><a href="/" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm">返回应用</a></header>
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {([['总用户', stats.totalUsers], ['今日新增', stats.usersCreatedToday], ['活跃用户', stats.activeUsers], ['文件异常', stats.fileAnomalies]] as Array<[string, unknown]>).map(([label, value]) => <div key={label} className="rounded-lg border border-slate-200 bg-white p-4"><div className="text-sm text-slate-500">{label}</div><div className="mt-2 text-2xl font-semibold">{String(value ?? 0)}</div></div>)}
        </section>
        <div className="mt-5 grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-2 font-semibold"><Users size={18}/>用户</div>
            <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3"><Search size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 outline-none" placeholder="搜索用户名或邮箱" /></label>
            <div className="mt-3 max-h-[620px] space-y-2 overflow-auto">{users.map((user) => <button key={user.id} onClick={() => openUser(user)} className={`w-full rounded-lg border p-3 text-left ${selected?.id === user.id ? 'border-slate-900 bg-slate-50' : 'border-slate-100'}`}><div className="font-medium">{user.username || '未设置用户名'}</div><div className="truncate text-xs text-slate-500">{user.email}</div></button>)}</div>
          </section>
          <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4">
            {!selected ? <div className="flex min-h-64 items-center justify-center text-slate-400"><LayoutDashboard className="mr-2"/>选择用户查看详情</div> : <>
              <h2 className="text-lg font-semibold">{selected.username || selected.email}</h2><p className="text-sm text-slate-500">{selected.email} · 注册 {selected.createdAt.slice(0,10)}</p>
              <div className="my-4 flex gap-2 overflow-x-auto">{dataTabs.map(([type,label]) => <button key={type} onClick={() => openUser(selected,type)} className={`shrink-0 rounded-lg px-3 py-2 text-sm ${activeData===type?'bg-slate-900 text-white':'bg-slate-100'}`}>{label} {detail.counts?.[type] ?? ''}</button>)}</div>
              <div className="max-h-[500px] space-y-2 overflow-auto">{rows.length===0?<p className="py-8 text-center text-sm text-slate-400">暂无数据</p>:rows.map((row,index)=><article key={String(row.id || index)} className="rounded-lg border border-slate-100 p-3 text-sm"><div className="font-medium">{String(row.title || row.content || row.originalName || row.courseCode || row.id)}</div><pre className="mt-2 overflow-hidden whitespace-pre-wrap text-xs text-slate-500">{JSON.stringify(row,null,2)}</pre>{activeData==='files'&&<button onClick={()=>openFile(row)} className="mt-2 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white"><FileText size={14} className="mr-1 inline"/>查看原文件（60 秒）</button>}</article>)}</div>
            </>}
          </section>
        </div>
        <section className="mt-5 rounded-lg border border-slate-200 bg-white p-4"><div className="mb-3 flex items-center gap-2 font-semibold"><MessageSquareText size={18}/>开发者留言</div><div className="space-y-3">{messages.map((message)=><article key={message.id} className="rounded-lg border border-slate-100 p-3"><div className="flex flex-wrap justify-between gap-2"><div className="text-sm font-medium">{message.username || message.email || '匿名用户'}</div><select value={message.status} onChange={(event)=>updateMessage(message.id,event.target.value)} className="rounded-lg border border-slate-200 px-2 py-1 text-sm"><option value="unread">未读</option><option value="read">已读</option><option value="resolved">已解决</option></select></div><p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{message.message}</p><p className="mt-2 text-xs text-slate-400">{new Date(message.created_at).toLocaleString()}</p></article>)}</div></section>
      </div>
    </main>
  );
}
