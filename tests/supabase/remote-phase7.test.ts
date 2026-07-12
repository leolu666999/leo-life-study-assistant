import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import { POST as submitContact } from "@/app/api/developer-contact/route";
import { GET as listAdminMessages } from "@/app/api/admin/messages/route";

const required = (name: string) => { const value = process.env[name]; if (!value) throw new Error(`${name} required`); return value; };
const url = required("NEXT_PUBLIC_SUPABASE_URL");
const publishable = required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const secret = required("SUPABASE_SECRET_KEY");
const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const username = `phase7_${suffix}`.slice(0, 24);
const email = `phase7-${suffix}@example.com`;
const password = `Safe-${suffix}-A1!`;
const adminEmail = required("SUPABASE_TEST_ADMIN_EMAIL");
const adminPassword = required("SUPABASE_TEST_ADMIN_PASSWORD");
const createdUsers: string[] = [];
const createdMessages: string[] = [];

afterAll(async () => {
  if (createdMessages.length) await admin.from("developer_messages").delete().in("id", createdMessages);
  for (const id of createdUsers) await admin.auth.admin.deleteUser(id);
});

describe.sequential("Phase 7 real Supabase security", () => {
  it("creates a username profile and supports password authentication", async () => {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username } });
    expect(error).toBeNull(); expect(data.user).toBeTruthy(); createdUsers.push(data.user!.id);
    const { data: profile } = await admin.from("profiles").select("username").eq("user_id", data.user!.id).single();
    expect(profile?.username).toBe(username);
    const client = createClient(url, publishable, { auth: { persistSession: false } });
    const login = await client.auth.signInWithPassword({ email, password });
    expect(login.error).toBeNull(); expect(login.data.user?.id).toBe(data.user!.id);
  });

  it("rejects a duplicate username case-insensitively without creating an auth user", async () => {
    const duplicateEmail = `duplicate-${suffix}@example.com`;
    const result = await admin.auth.admin.createUser({ email: duplicateEmail, password, email_confirm: true, user_metadata: { username: username.toUpperCase() } });
    expect(result.error).toBeTruthy(); expect(result.data.user).toBeNull();
    const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    expect(listed.data.users.some((user) => user.email === duplicateEmail)).toBe(false);
  });

  it("rejects a duplicate email", async () => {
    const result = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username: `other_${suffix}`.slice(0, 24) } });
    expect(result.error).toBeTruthy();
  });

  it("blocks anonymous and ordinary users from reading developer messages", async () => {
    const inserted = await admin.from("developer_messages").insert({ user_id: createdUsers[0], username, email, message: "Synthetic Phase 7 message" }).select("id").single();
    expect(inserted.error).toBeNull(); createdMessages.push(inserted.data!.id);
    const anonymous = createClient(url, publishable, { auth: { persistSession: false } });
    expect((await anonymous.from("developer_messages").select("*")).error).toBeTruthy();
    await anonymous.auth.signInWithPassword({ email, password });
    expect((await anonymous.from("developer_messages").select("*")).error).toBeTruthy();
  });

  it("allows elevated admin storage access and controlled status updates", async () => {
    const { data, error } = await admin.from("developer_messages").update({ status: "resolved" }).eq("id", createdMessages[0]).select("status").single();
    expect(error).toBeNull(); expect(data?.status).toBe("resolved");
  });

  it("accepts an anonymous contact form without exposing the message list", async () => {
    const response = await submitContact(new Request("http://localhost/api/developer-contact", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: `visitor-${suffix}@example.com`, message: "Anonymous synthetic support request" })
    }));
    expect(response.status).toBe(201);
    const body = await response.json(); createdMessages.push(body.id);
    expect(body).not.toHaveProperty("message");
  });

  it("returns 403 to an ordinary user and allows the configured Admin Account", async () => {
    const ordinary = createClient(url, publishable, { auth: { persistSession: false } });
    const ordinarySession = await ordinary.auth.signInWithPassword({ email, password });
    const denied = await listAdminMessages(new Request("http://localhost/api/admin/messages", { headers: { authorization: `Bearer ${ordinarySession.data.session!.access_token}` } }));
    expect(denied.status).toBe(403);
    const adminLogin = createClient(url, publishable, { auth: { persistSession: false } });
    const adminSession = await adminLogin.auth.signInWithPassword({ email: adminEmail, password: adminPassword });
    const allowedResponse = await listAdminMessages(new Request("http://localhost/api/admin/messages", { headers: { authorization: `Bearer ${adminSession.data.session!.access_token}` } }));
    expect(allowedResponse.status).toBe(200);
    expect((await allowedResponse.json()).messages.some((message: { id: string }) => createdMessages.includes(message.id))).toBe(true);
  });
});
