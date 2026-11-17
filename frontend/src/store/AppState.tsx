import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "../api";
import { toCalcOptions, type Settings } from "../lib/settings";
import {
  loadState, newId, sanitize, saveState, type PersistedState, type PromptHistory, type SavedChart,
} from "../lib/storage";
import type { AnalyzeResponse, CalcOptions, ChartRequest } from "../types";
import { ymd } from "../lib/ganji";

interface Ctx {
  state: PersistedState;
  storageOk: boolean;
  activeChart: SavedChart | null;
  addChart(c: Omit<SavedChart, "id" | "createdAt" | "viewedAt">): SavedChart;
  updateChart(id: string, patch: Partial<SavedChart>): void;
  removeChart(id: string): void;
  openChart(id: string): void;
  saveSettings(s: Settings): void;
  addPrompt(p: Omit<PromptHistory, "id" | "createdAt">): void;
  importState(data: unknown, mode: "merge" | "replace"): number;
  newChartOpen: boolean;
  setNewChartOpen(v: boolean): void;
  /** 저장하지 않는 임시 명식 (오늘 명식 · 달력 날짜 · 시주 클릭). 새로고침하면 사라진다 */
  tempChart: SavedChart | null;
  openTemp(c: Omit<SavedChart, "id" | "createdAt" | "viewedAt" | "color">): void;
  setTempChart(c: SavedChart | null): void;
  /** 분석 화면에 보여줄 명식: 임시 명식이 있으면 우선 */
  viewChart: SavedChart | null;
}

export const isTemp = (c: SavedChart | null | undefined) => !!c && c.id.startsWith("temp:");

const AppCtx = createContext<Ctx | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedState>(() => loadState());
  const [storageOk, setStorageOk] = useState(true);
  const [newChartOpen, setNewChartOpen] = useState(false);
  const [tempChart, setTempChart] = useState<SavedChart | null>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setStorageOk(saveState(state));
  }, [state]);

  const activeChart = useMemo(
    () => state.charts.find((c) => c.id === state.activeChartId) ?? null,
    [state.charts, state.activeChartId],
  );

  const addChart = useCallback((c: Omit<SavedChart, "id" | "createdAt" | "viewedAt">) => {
    const now = Date.now();
    const chart: SavedChart = { ...c, id: newId(), createdAt: now, viewedAt: now };
    setState((s) => ({ ...s, charts: [chart, ...s.charts], activeChartId: chart.id }));
    setTempChart(null);
    return chart;
  }, []);

  const updateChart = useCallback((id: string, patch: Partial<SavedChart>) => {
    setState((s) => ({ ...s, charts: s.charts.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  }, []);

  const removeChart = useCallback((id: string) => {
    setState((s) => {
      const charts = s.charts.filter((c) => c.id !== id);
      const active = s.activeChartId === id ? charts[0]?.id ?? null : s.activeChartId;
      return { ...s, charts, activeChartId: active };
    });
  }, []);

  const openChart = useCallback((id: string) => {
    setTempChart(null);
    setState((s) => ({
      ...s, activeChartId: id,
      charts: s.charts.map((c) => (c.id === id ? { ...c, viewedAt: Date.now() } : c)),
    }));
  }, []);

  const saveSettings = useCallback((settings: Settings) => setState((s) => ({ ...s, settings })), []);

  const addPrompt = useCallback((p: Omit<PromptHistory, "id" | "createdAt">) => {
    setState((s) => ({ ...s, prompts: [{ ...p, id: newId(), createdAt: Date.now() }, ...s.prompts].slice(0, 20) }));
  }, []);

  const importState = useCallback((data: unknown, mode: "merge" | "replace") => {
    const incoming = sanitize(data);
    setState((s) => {
      if (mode === "replace") return incoming;
      const ids = new Set(s.charts.map((c) => c.id));
      const added = incoming.charts.filter((c) => !ids.has(c.id));
      return { ...s, charts: [...s.charts, ...added] };
    });
    return incoming.charts.length;
  }, []);

  const openTemp = useCallback((c: Omit<SavedChart, "id" | "createdAt" | "viewedAt" | "color">) => {
    const now = Date.now();
    setTempChart({ ...c, id: `temp:${now}`, color: "#9aa0ad", createdAt: now, viewedAt: now });
  }, []);

  const value: Ctx = {
    state, storageOk, activeChart, addChart, updateChart, removeChart, openChart, saveSettings,
    addPrompt, importState, newChartOpen, setNewChartOpen, tempChart, openTemp, setTempChart,
    viewChart: tempChart ?? activeChart,
  };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): Ctx {
  const v = useContext(AppCtx);
  if (!v) throw new Error("AppStateProvider 밖에서 useApp 사용");
  return v;
}

export function chartRequest(c: SavedChart, opts: CalcOptions): ChartRequest {
  return {
    calendar: c.calendar, date: c.date, time: c.time, is_leap: c.isLeap, gender: c.gender,
    longitude: c.longitude, reference_date: ymd(new Date()), options: opts,
  };
}

export interface AnalysisState {
  data: AnalyzeResponse | null;
  error: string | null;
  loading: boolean;
}

/** 명식 + 설정(+일부 덮어쓰기)으로 분석 결과를 가져온다 */
export function useAnalysis(chart: SavedChart | null, override?: Partial<CalcOptions>,
                            settingsOverride?: Settings): AnalysisState {
  const { state, updateChart } = useApp();
  const settings = settingsOverride ?? state.settings;
  const [res, setRes] = useState<AnalysisState>({ data: null, error: null, loading: !!chart });
  const reqKey = chart ? JSON.stringify(chartRequest(chart, { ...toCalcOptions(settings), ...override })) : "";

  useEffect(() => {
    if (!chart) {
      setRes({ data: null, error: null, loading: false });
      return;
    }
    let alive = true;
    setRes((r) => ({ ...r, loading: true, error: null }));
    api.analyze(JSON.parse(reqKey)).then(
      (data) => {
        if (!alive) return;
        setRes({ data, error: null, loading: false });
        const dg = data.pillars[1]?.ganji;
        if (dg && chart.dayGanji !== dg && !settingsOverride && !isTemp(chart)) updateChart(chart.id, { dayGanji: dg });
      },
      (e: Error) => alive && setRes({ data: null, error: e.message, loading: false }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reqKey]);
  return res;
}
