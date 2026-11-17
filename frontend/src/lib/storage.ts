// localStorage 래퍼. 로그인 없이 이 브라우저에만 저장된다.
// 사생활 보호 모드/저장소 차단 환경에서도 앱이 동작하도록 모든 접근을 try/catch.
import { DEFAULT_SETTINGS, type Settings } from "./settings";

const KEY = "saju-lab:v1";

export interface SavedChart {
  id: string;
  name: string;
  gender: "M" | "F";
  calendar: "solar" | "lunar";
  date: string;            // YYYY-MM-DD (입력한 달력 기준)
  time: string | null;     // HH:MM, null = 모름
  isLeap: boolean;
  placeName: string;
  longitude: number | null;
  color: string;
  memo?: string;
  createdAt: number;
  viewedAt: number;
  dayGanji?: string;       // 사이드바 표시용 캐시 (예: "庚午")
}

export interface PromptHistory {
  id: string;
  chartId: string;
  chartName: string;
  intent: string;
  format: string;
  createdAt: number;
  options: unknown;
}

export interface PersistedState {
  version: 1;
  charts: SavedChart[];
  activeChartId: string | null;
  settings: Settings;
  prompts: PromptHistory[];
}

export const CHART_COLORS = ["#e6e8ee", "#7048e8", "#e8590c", "#2f9e44", "#4c6ef5", "#c99a2e", "#e03131", "#0c8599"];

export function emptyState(): PersistedState {
  return { version: 1, charts: [], activeChartId: null, settings: DEFAULT_SETTINGS, prompts: [] };
}

export function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyState();
    return sanitize(JSON.parse(raw));
  } catch {
    return emptyState();
  }
}

export function saveState(s: PersistedState): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

/** 가져오기/로드 시 형식 검증 — 알 수 없는 값은 버린다 */
export function sanitize(input: unknown): PersistedState {
  const base = emptyState();
  if (!input || typeof input !== "object") return base;
  const o = input as Record<string, unknown>;
  const charts = Array.isArray(o.charts) ? o.charts.filter(isChart).slice(0, 500) : [];
  const settings = { ...DEFAULT_SETTINGS, ...(isObj(o.settings) ? pickKnown(o.settings) : {}) };
  // v1 초기 버전: 운성 기준 "jwa"(자기 천간 기준)는 정의상 거법 → "geo"
  if ((settings.stageBasis as string) === "jwa") settings.stageBasis = "geo";
  if (!["bong", "geo", "both"].includes(settings.stageBasis)) settings.stageBasis = "both";
  const prompts = Array.isArray(o.prompts) ? (o.prompts as PromptHistory[]).filter(isObj).slice(0, 30) : [];
  const active = typeof o.activeChartId === "string" && charts.some((c) => c.id === o.activeChartId)
    ? o.activeChartId : charts[0]?.id ?? null;
  return { version: 1, charts, activeChartId: active, settings, prompts };
}

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function pickKnown(v: Record<string, unknown>): Partial<Settings> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    if (k in v && typeof v[k] === typeof DEFAULT_SETTINGS[k]) out[k] = v[k];
  }
  return out as Partial<Settings>;
}

function isChart(v: unknown): v is SavedChart {
  if (!isObj(v)) return false;
  return typeof v.id === "string" && typeof v.name === "string" && typeof v.date === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(v.date)
    && (v.time === null || (typeof v.time === "string" && /^\d{2}:\d{2}$/.test(v.time)))
    && (v.gender === "M" || v.gender === "F") && (v.calendar === "solar" || v.calendar === "lunar");
}

export function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function downloadText(filename: string, text: string, mime = "text/plain") {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
