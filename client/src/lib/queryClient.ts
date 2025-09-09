import { QueryClient } from "@tanstack/react-query";

/**
 * Point the frontend to the backend.
 * Locally, you can run the API on http://localhost:3000 (or whatever you use).
 * In Vercel prod, set VITE_API_BASE=https://linemovement.onrender.com
 */
export const API_BASE =
  import.meta.env.VITE_API_BASE?.replace(/\/+$/, "") ||
  (import.meta.env.DEV ? "http://localhost:3000" : "https://linemovement.onrender.com");

/** Build an absolute URL from a relative path or passthrough absolute URLs */
function toUrl(pathOrUrl: string) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${API_BASE}${path}`;
}

export async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`);
  }
}

/** Single place all requests go through */
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown
): Promise<Response> {
  const res = await fetch(toUrl(url), {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include", // keep if your API uses cookies/sessions
  });
  await throwIfResNotOk(res);
  return res;
}

// Small helpers (optional)
export const api = {
  get: (url: string) => apiRequest("GET", url),
  post: (url: string, body?: unknown) => apiRequest("POST", url, body),
  put: (url: string, body?: unknown) => apiRequest("PUT", url, body),
  del: (url: string) => apiRequest("DELETE", url),
};

export const queryClient = new QueryClient();
