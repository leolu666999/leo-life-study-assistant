import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServerClient } from "@supabase/ssr";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { POST as upload } from "@/app/api/upload/route";
import { GET as download } from "@/app/api/uploads/[id]/route";
import { GET as listImportant, POST as createImportant } from "@/app/api/important-files/route";
import { PATCH as patchImportant, DELETE as deleteImportant } from "@/app/api/important-files/[id]/route";
import { POST as createExpense } from "@/app/api/expenses/route";
import { DELETE as deleteExpense } from "@/app/api/expenses/[id]/route";
import { CLOUD_UPLOAD_MAX_BYTES } from "@/lib/storage/file-security";
import { retryPendingCloudObject } from "@/lib/repositories/supabase/supabase-file-repository";

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for remote Storage tests`);
  return value;
};

const url = required("NEXT_PUBLIC_SUPABASE_URL");
const key = required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const secret = required("SUPABASE_SECRET_KEY");
const userAId = required("SUPABASE_TEST_USER_A_ID");
const userBId = required("SUPABASE_TEST_USER_B_ID");
const adminId = required("SUPABASE_TEST_ADMIN_ID");
const owners = [userAId, userBId, adminId];

const pdfBytes = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF", "ascii");
const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0]);

function client(clientKey = key) {
  return createClient(url, clientKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

async function signIn(emailKey: string, passwordKey: string) {
  const result = client();
  const { data, error } = await result.auth.signInWithPassword({ email: required(emailKey), password: required(passwordKey) });
  if (error || !data.session) throw error || new Error("Unable to sign in test user");
  return { client: result, session: data.session };
}

function request(path: string, session?: Session, method = "GET", body?: unknown) {
  return new Request(`http://local.test${path}`, {
    method,
    headers: {
      ...(session ? { authorization: `Bearer ${session.access_token}` } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" })
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

async function cookieRequest(path: string, session: Session) {
  const jar = new Map<string, string>();
  const cookieClient = createServerClient(url, key, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (values) => values.forEach(({ name, value }) => jar.set(name, value))
    }
  });
  const { error } = await cookieClient.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token
  });
  if (error) throw error;
  return new Request(`http://local.test${path}`, {
    headers: { cookie: [...jar].map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join("; ") }
  });
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

function uploadRequest(session: Session | undefined, name: string, mime: string, bytes: Buffer, purpose = "important_file") {
  const form = new FormData();
  form.append("file", new File([Uint8Array.from(bytes)], name, { type: mime }));
  form.append("linkedEntityType", purpose);
  return new Request("http://local.test/api/upload", {
    method: "POST", headers: session ? { authorization: `Bearer ${session.access_token}` } : {}, body: form
  });
}

async function uploadFile(session: Session, name: string, mime: string, bytes: Buffer, purpose = "important_file") {
  const response = await upload(uploadRequest(session, name, mime, bytes, purpose));
  expect(response.status).toBe(201);
  const body = await response.json() as Record<string, any>;
  const { data, error } = await service.from("uploaded_files").select("bucket,object_path,sha256,status").eq("id", body.id).single();
  if (error) throw error;
  return { ...body, _cloud: data } as Record<string, any>;
}

let service: SupabaseClient;
let aClient: SupabaseClient;
let bClient: SupabaseClient;
let adminClient: SupabaseClient;
let a: Session;
let b: Session;
let admin: Session;
let importantUploadA: Record<string, any>;
let importantUploadB: Record<string, any>;
let importantA: Record<string, any>;
let receiptA: Record<string, any>;

async function cleanup() {
  const { data: files } = await service.from("uploaded_files").select("bucket,object_path").in("user_id", owners);
  for (const bucket of ["receipts", "important-files"]) {
    const paths = (files ?? []).filter((row) => row.object_path).map((row) => String(row.object_path));
    if (paths.length) await service.storage.from(bucket).remove(paths);
  }
  await service.from("important_files").delete().in("user_id", owners);
  await service.from("expenses").delete().in("user_id", owners);
  await service.from("uploaded_files").delete().in("user_id", owners);
}

beforeAll(async () => {
  process.env.DATA_BACKEND = "supabase";
  process.env.FILE_BACKEND = "supabase";
  process.env.AUTH_REQUIRED = "true";
  service = client(secret);
  const [userA, userB, adminUser] = await Promise.all([
    signIn("SUPABASE_TEST_USER_A_EMAIL", "SUPABASE_TEST_USER_A_PASSWORD"),
    signIn("SUPABASE_TEST_USER_B_EMAIL", "SUPABASE_TEST_USER_B_PASSWORD"),
    signIn("SUPABASE_TEST_ADMIN_EMAIL", "SUPABASE_TEST_ADMIN_PASSWORD")
  ]);
  aClient = userA.client; bClient = userB.client; adminClient = adminUser.client;
  a = userA.session; b = userB.session; admin = adminUser.session;
  await cleanup();
}, 60_000);

afterAll(async () => {
  await cleanup();
  await Promise.all([aClient.auth.signOut({ scope: "local" }), bClient.auth.signOut({ scope: "local" }), adminClient.auth.signOut({ scope: "local" })]);
  delete process.env.DATA_BACKEND; delete process.env.FILE_BACKEND; delete process.env.AUTH_REQUIRED;
}, 60_000);

describe.sequential("Phase 6 real Supabase Storage", () => {
  it("1. anonymous multipart upload is rejected", async () => {
    await expect(upload(uploadRequest(undefined, "anon.pdf", "application/pdf", pdfBytes))).rejects.toThrow(/Authentication/);
  });

  it("2. User A uploads a validated private PDF with owner path and SHA-256", async () => {
    importantUploadA = await uploadFile(a, "phase6-a.pdf", "application/pdf", pdfBytes);
    expect(importantUploadA).toMatchObject({ originalName: "phase6-a.pdf", mimeType: "application/pdf", size: pdfBytes.length });
    expect(importantUploadA).not.toHaveProperty("bucket");
    expect(importantUploadA._cloud).toMatchObject({ status: "uploaded", bucket: "important-files" });
    expect(importantUploadA._cloud.object_path).toMatch(new RegExp(`^${userAId}/${importantUploadA.id}/`));
    expect(importantUploadA._cloud.sha256).toBe(crypto.createHash("sha256").update(pdfBytes).digest("hex"));
    const { data } = await service.storage.from("important-files").list(`${userAId}/${importantUploadA.id}`);
    expect(data).toHaveLength(1);
  });

  it("3. User B can upload identical content without metadata or path deduplication", async () => {
    importantUploadB = await uploadFile(b, "phase6-b.pdf", "application/pdf", pdfBytes);
    expect(importantUploadB._cloud.sha256).toBe(importantUploadA._cloud.sha256);
    expect(importantUploadB.id).not.toBe(importantUploadA.id);
    expect(importantUploadB._cloud.object_path).toMatch(new RegExp(`^${userBId}/`));
  });

  it("4. oversized upload is rejected before metadata or Storage writes", async () => {
    const before = await service.from("uploaded_files").select("*", { count: "exact", head: true }).eq("user_id", userAId);
    const response = await upload(uploadRequest(a, "large.pdf", "application/pdf", Buffer.alloc(CLOUD_UPLOAD_MAX_BYTES + 1)));
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "File exceeds the 10 MB cloud upload limit" });
    const after = await service.from("uploaded_files").select("*", { count: "exact", head: true }).eq("user_id", userAId);
    expect(after.count).toBe(before.count);
  });

  it("5. unsupported MIME, MIME mismatch and traversal names are rejected", async () => {
    await expect(upload(uploadRequest(a, "x.html", "text/html", Buffer.from("<html>")))).rejects.toThrow("not allowed");
    await expect(upload(uploadRequest(a, "x.pdf", "application/pdf", pngBytes))).rejects.toThrow("content");
    await expect(upload(uploadRequest(a, "../x.pdf", "application/pdf", pdfBytes))).rejects.toThrow("Unsafe");
  });

  it("6. User A can proxy-download exact bytes while User B and Admin ordinary API cannot", async () => {
    const own = await download(request(`/api/uploads/${importantUploadA.id}`, a), params(importantUploadA.id));
    expect(own.status).toBe(200);
    expect(Buffer.from(await own.arrayBuffer())).toEqual(pdfBytes);
    expect((await download(request(`/api/uploads/${importantUploadA.id}`, b), params(importantUploadA.id))).status).toBe(404);
    expect((await download(request(`/api/uploads/${importantUploadA.id}`, admin), params(importantUploadA.id))).status).toBe(404);
  });

  it("6b. browser Cookie Session can load the owner's private image route", async () => {
    const own = await download(await cookieRequest(`/api/uploads/${importantUploadA.id}?preview=1`, a), params(importantUploadA.id));
    expect(own.status).toBe(200);
    expect(Buffer.from(await own.arrayBuffer())).toEqual(pdfBytes);
    expect(own.headers.get("cache-control")).toContain("no-store");
    expect(own.headers.get("vary")).toContain("Cookie");
  });

  it("7. signed download URL is short-lived, owner-only, and not persisted", async () => {
    const response = await download(request(`/api/uploads/${importantUploadA.id}?signed=1`, a), params(importantUploadA.id));
    expect(response.status).toBe(200);
    const signed = await response.json() as { url: string; expiresIn: number };
    expect(signed.expiresIn).toBe(60);
    expect(await fetch(signed.url).then((result) => result.status)).toBe(200);
    expect((await download(request(`/api/uploads/${importantUploadA.id}?signed=1`, b), params(importantUploadA.id))).status).toBe(404);
    const { data } = await service.from("uploaded_files").select("*").eq("id", importantUploadA.id).single();
    expect(JSON.stringify(data)).not.toContain(signed.url);
  });

  it("8. Storage policies prevent B and anonymous from reading or listing A objects", async () => {
    const objectPath = String(importantUploadA._cloud.object_path);
    expect((await bClient.storage.from("important-files").download(objectPath)).error).toBeTruthy();
    expect((await bClient.storage.from("important-files").list(`${userAId}/${importantUploadA.id}`)).data).toEqual([]);
    expect((await client().storage.from("important-files").download(objectPath)).error).toBeTruthy();
  });

  it("9. User A creates and lists an Important File with the established JSON shape", async () => {
    const response = await createImportant(request("/api/important-files", a, "POST", {
      title: "Phase 6 document", category: "学校", tags: ["test", "cloud"], notes: "synthetic", expiryDate: "2027-01-01", fileId: importantUploadA.id
    }));
    expect(response.status).toBe(201);
    importantA = await response.json();
    expect(importantA).toMatchObject({ title: "Phase 6 document", category: "学校", tags: ["test", "cloud"], expiryDate: "2027-01-01", fileId: importantUploadA.id });
    const listed = await (await listImportant(request("/api/important-files", a))).json() as any[];
    expect(listed).toEqual([expect.objectContaining({ id: importantA.id, originalName: "phase6-a.pdf" })]);
  });

  it("10. User B cannot see, create from, patch, or delete User A Important File", async () => {
    expect(await (await listImportant(request("/api/important-files", b))).json()).toEqual([]);
    await expect(createImportant(request("/api/important-files", b, "POST", { title: "cross", fileId: importantUploadA.id }))).rejects.toBeTruthy();
    expect((await patchImportant(request(`/api/important-files/${importantA.id}`, b, "PATCH", { title: "tampered" }), params(importantA.id))).status).toBe(404);
    expect((await deleteImportant(request(`/api/important-files/${importantA.id}`, b, "DELETE"), params(importantA.id))).status).toBe(200);
    const { data } = await service.from("important_files").select("title").eq("id", importantA.id).single();
    expect(data?.title).toBe("Phase 6 document");
    expect((await service.storage.from("important-files").list(`${userAId}/${importantUploadA.id}`)).data).toHaveLength(1);
  });

  it("11. User A updates Important File fields without changing its file binding", async () => {
    const response = await patchImportant(request(`/api/important-files/${importantA.id}`, a, "PATCH", { title: "Updated document", tags: ["updated"] }), params(importantA.id));
    expect(await response.json()).toMatchObject({ id: importantA.id, title: "Updated document", tags: ["updated"], fileId: importantUploadA.id });
  });

  it("12. User A uploads a private receipt and creates an Expense relation", async () => {
    receiptA = await uploadFile(a, "receipt-a.png", "image/png", pngBytes, "expense");
    expect(receiptA._cloud.bucket).toBe("receipts");
    const response = await createExpense(request("/api/expenses", a, "POST", {
      title: "Synthetic receipt", type: "expense", amount: 12, currency: "AUD", category: "测试", date: "2026-07-12", receiptFileId: receiptA.id
    }));
    expect(response.status).toBe(201);
    const expense = await response.json() as Record<string, any>;
    expect(expense).toMatchObject({ receiptFileId: receiptA.id, receiptOriginalName: "receipt-a.png", receiptMimeType: "image/png" });
    receiptA.expenseId = expense.id;
  });

  it("13. User B cannot attach User A receipt even when UUID is known", async () => {
    await expect(createExpense(request("/api/expenses", b, "POST", {
      title: "Cross receipt", type: "expense", amount: 1, currency: "AUD", category: "测试", date: "2026-07-12", receiptFileId: receiptA.id
    }))).rejects.toBeTruthy();
    const { count } = await service.from("expenses").select("*", { count: "exact", head: true }).eq("user_id", userBId).eq("title", "Cross receipt");
    expect(count).toBe(0);
  });

  it("14. deleting one of two receipt references preserves the shared object", async () => {
    const second = await (await createExpense(request("/api/expenses", a, "POST", {
      title: "Second reference", type: "expense", amount: 2, currency: "AUD", category: "测试", date: "2026-07-12", receiptFileId: receiptA.id
    }))).json() as Record<string, any>;
    expect((await deleteExpense(request(`/api/expenses/${receiptA.expenseId}`, a, "DELETE"), params(receiptA.expenseId))).status).toBe(200);
    const { data: metadata } = await service.from("uploaded_files").select("status").eq("id", receiptA.id).single();
    expect(metadata?.status).toBe("uploaded");
    expect((await service.storage.from("receipts").list(`${userAId}/${receiptA.id}`)).data).toHaveLength(1);
    receiptA.expenseId = second.id;
  });

  it("15. deleting the final Expense reference removes Storage and marks metadata deleted", async () => {
    expect((await deleteExpense(request(`/api/expenses/${receiptA.expenseId}`, a, "DELETE"), params(receiptA.expenseId))).status).toBe(200);
    const { data: metadata } = await service.from("uploaded_files").select("status,deletedAt").eq("id", receiptA.id).single();
    expect(metadata?.status).toBe("deleted");
    expect(metadata?.deletedAt).toBeTruthy();
    expect((await service.storage.from("receipts").list(`${userAId}/${receiptA.id}`)).data).toEqual([]);
  });

  it("16. a forced Storage delete failure leaves visible pending_delete metadata for retry", async () => {
    const file = await uploadFile(a, "retry.pdf", "application/pdf", pdfBytes);
    const created = await (await createImportant(request("/api/important-files", a, "POST", { title: "Retry", fileId: file.id }))).json() as Record<string, any>;
    await service.from("uploaded_files").update({ bucket: "missing-phase6-bucket" }).eq("id", file.id);
    await expect(deleteImportant(request(`/api/important-files/${created.id}`, a, "DELETE"), params(created.id))).rejects.toThrow("pending_delete");
    const { data: metadata } = await service.from("uploaded_files").select("status").eq("id", file.id).single();
    expect(metadata?.status).toBe("pending_delete");
    expect((await service.storage.from("important-files").list(`${userAId}/${file.id}`)).data).toHaveLength(1);
    await service.from("uploaded_files").update({ bucket: "important-files" }).eq("id", file.id);
    expect(await retryPendingCloudObject(file.id, { backend: "supabase", userId: userAId, supabase: aClient })).toBe(true);
    const { data: retried } = await service.from("uploaded_files").select("status").eq("id", file.id).single();
    expect(retried?.status).toBe("deleted");
  });

  it("17. deleting the final Important File reference removes object and soft-deletes metadata", async () => {
    expect((await deleteImportant(request(`/api/important-files/${importantA.id}`, a, "DELETE"), params(importantA.id))).status).toBe(200);
    const { data } = await service.from("uploaded_files").select("status").eq("id", importantUploadA.id).single();
    expect(data?.status).toBe("deleted");
    expect((await service.storage.from("important-files").list(`${userAId}/${importantUploadA.id}`)).data).toEqual([]);
  });

  it("18. User B can delete only its own object through its own Important File", async () => {
    const created = await (await createImportant(request("/api/important-files", b, "POST", { title: "B file", fileId: importantUploadB.id }))).json() as Record<string, any>;
    expect((await deleteImportant(request(`/api/important-files/${created.id}`, b, "DELETE"), params(created.id))).status).toBe(200);
    const { data } = await service.from("uploaded_files").select("status").eq("id", importantUploadB.id).single();
    expect(data?.status).toBe("deleted");
  });

  it("19. anonymous and foreign Storage delete operations do not alter owner state", async () => {
    const file = await uploadFile(a, "policy.pdf", "application/pdf", pdfBytes);
    await bClient.storage.from("important-files").remove([file._cloud.object_path]);
    await client().storage.from("important-files").remove([file._cloud.object_path]);
    expect((await service.storage.from("important-files").list(`${userAId}/${file.id}`)).data).toHaveLength(1);
  });

  it("20. private buckets enforce configured MIME and 10 MiB limits", async () => {
    const { data, error } = await service.storage.getBucket("receipts");
    expect(error).toBeNull();
    expect(data).toMatchObject({ public: false, file_size_limit: 10485760 });
    expect(data?.allowed_mime_types).toEqual(expect.arrayContaining(["application/pdf", "image/jpeg", "image/png", "image/webp"]));
  });
});
