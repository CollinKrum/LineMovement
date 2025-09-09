import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient();

// Base URL for the API (can be overridden in Vercel env as VITE_API_BASE)
const API_BASE =
  import.meta.env.VITE_API_BASE ?? "https://linemovement.onrender.com";

/** Throw if a fetch Response is not ok */
async function throwIfNotOk(res: Response) {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const msg = `${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`;
    throw new Error(msg);
  }
}

/** Simple wrapper that prefixes API_BASE and handles JSON bodies */
export async function apiRequest(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string, // e.g. "/api/health" or "/api/games"
  data?: unknown
): Promise<Response> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });
  await throwIfNotOk(res);
  return res;
}

// tiny helpers if you like
export const api = {
  get: (p: string) => apiRequest("GET", p),
  post: (p: string, b?: unknown) => apiRequest("POST", p, b),
};
