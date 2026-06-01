"use client";

export type ApiResult = { ok: boolean; next?: string; error?: string; [k: string]: unknown };

export async function postJson(url: string, body?: unknown): Promise<ApiResult> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return (await res.json().catch(() => ({ ok: false, error: "bad_response" }))) as ApiResult;
}

export async function postForm(url: string, form: FormData): Promise<ApiResult> {
  const res = await fetch(url, { method: "POST", body: form });
  return (await res.json().catch(() => ({ ok: false, error: "bad_response" }))) as ApiResult;
}
