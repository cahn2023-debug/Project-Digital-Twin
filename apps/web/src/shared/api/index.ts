export const apiBase = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(apiBase + path, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error("Không thể kết nối API. Hãy chạy corepack pnpm dev để khởi động ứng dụng.");
    }
    throw error;
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = body && typeof body.detail === "string" ? body.detail : `HTTP ${response.status}`;
    throw new Error(detail);
  }
  return body as T;
}


