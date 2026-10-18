"use client";

import { readJson } from "@/lib/http";

let pending: Promise<string> | null = null;

function loadToken(force = false) {
  if (!pending || force) {
    pending = fetch("/api/csrf", { cache: "no-store" })
      .then((res) => readJson<{ token?: string }>(res))
      .then((data) => data?.token || "")
      .catch(() => "");
  }
  return pending;
}

/** `fetch` for state-changing calls: attaches the CSRF token and retries once if it rotated. */
export async function secureFetch(input: string, init: RequestInit = {}) {
  const send = async (force: boolean) => {
    const token = await loadToken(force);
    const headers = new Headers(init.headers);
    headers.set("x-csrf-token", token);
    return fetch(input, { ...init, headers, credentials: "same-origin" });
  };
  const res = await send(false);
  if (res.status !== 403) return res;
  const body = await readJson<{ code?: string }>(res.clone());
  return body?.code === "CSRF" ? send(true) : res;
}

/** Multipart upload with progress reporting (XHR), CSRF-protected like `secureFetch`. */
export async function secureUpload<T = unknown>(
  url: string,
  form: FormData,
  onProgress?: (fraction: number) => void,
): Promise<{ ok: boolean; status: number; data: (T & { error?: string }) | null }> {
  const attempt = (token: string) =>
    new Promise<{ ok: boolean; status: number; data: (T & { error?: string }) | null }>(
      (resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", url);
        xhr.withCredentials = true;
        xhr.setRequestHeader("x-csrf-token", token);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress?.(e.loaded / e.total);
        };
        xhr.onload = () => {
          let data: (T & { error?: string }) | null = null;
          try {
            data = JSON.parse(xhr.responseText);
          } catch {
            data = null;
          }
          resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, data });
        };
        xhr.onerror = () =>
          resolve({ ok: false, status: 0, data: { error: "Network error during upload." } as T & { error?: string } });
        xhr.send(form);
      },
    );
  const first = await attempt(await loadToken());
  if (first.status === 403 && (first.data as { code?: string } | null)?.code === "CSRF") {
    return attempt(await loadToken(true));
  }
  return first;
}

export async function secureJson<T = unknown>(
  input: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown,
) {
  const res = await secureFetch(input, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await readJson<T & { error?: string }>(res);
  return { ok: res.ok, status: res.status, data };
}
