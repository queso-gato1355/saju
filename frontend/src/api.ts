// 백엔드 호출은 이 파일에서만. 항상 상대 경로 /api/... (개발: Vite proxy, 운영: nginx)
import type {
  AnalyzeResponse, CalendarResponse, ChartRequest, NowResponse, SearchResponse,
} from "./types";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError(0, "서버에 연결할 수 없습니다. 네트워크 상태를 확인하세요.");
  }
  if (!res.ok) {
    let msg = `요청 실패 (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") msg = body.detail;
    } catch {
      /* 본문 없음 */
    }
    throw new ApiError(res.status, msg);
  }
  return res.json() as Promise<T>;
}

// 같은 요청은 세션 동안 메모리에 캐시 (서버 부하·요청 수 감소)
const cache = new Map<string, Promise<unknown>>();
function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit) return hit as Promise<T>;
  const p = fn().catch((e) => {
    cache.delete(key);
    throw e;
  });
  cache.set(key, p);
  if (cache.size > 300) cache.delete(cache.keys().next().value as string);
  return p;
}

export const api = {
  analyze(req: ChartRequest): Promise<AnalyzeResponse> {
    const body = JSON.stringify(req);
    return cached(`analyze:${body}`, () => request<AnalyzeResponse>("/api/analyze", { method: "POST", body }));
  },
  calendar(year: number, month: number): Promise<CalendarResponse> {
    return cached(`cal:${year}-${month}`, () => request<CalendarResponse>(`/api/calendar/${year}/${month}`));
  },
  now(longitude: number | null, splitZi: boolean): Promise<NowResponse> {
    const q = new URLSearchParams();
    if (longitude != null) q.set("longitude", String(longitude));
    if (splitZi) q.set("split_zi", "true");
    return request<NowResponse>(`/api/now?${q}`);
  },
  search(q: string, around?: string): Promise<SearchResponse> {
    const p = new URLSearchParams({ q });
    if (around) p.set("around", around);
    return cached(`search:${p}`, () => request<SearchResponse>(`/api/search?${p}`));
  },
};
