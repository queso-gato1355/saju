import { useMemo, useState } from "react";
import { Topbar } from "../components/Topbar";
import { Card, ErrorBox, GlyphTile, Loading, Segmented } from "../components/ui";
import { isTemp, useAnalysis, useApp } from "../store/AppState";
import { TempBanner } from "../components/TempBanner";
import { NoChart } from "./analysis/AnalysisPage";
import {
  DEFAULT_PROMPT_OPTIONS, INTENTS, buildPrompt, estimateTokens, type IncludeKey, type PromptOptions,
} from "../lib/prompt";
import { downloadText } from "../lib/storage";
import { elementOfHanja } from "../lib/ganji";

function relTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "방금";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "오늘";
  const y = new Date(today.getTime() - 86_400_000);
  if (d.toDateString() === y.toDateString()) return "어제";
  return `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, "0")}`;
}

export function PromptPage() {
  const { state, viewChart: activeChart, openChart, addPrompt } = useApp();
  const res = useAnalysis(activeChart);
  const [opt, setOpt] = useState<PromptOptions>(DEFAULT_PROMPT_OPTIONS);
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);
  const [picker, setPicker] = useState(false);

  const text = useMemo(
    () => (res.data && activeChart ? buildPrompt(res.data, opt, activeChart.gender) : ""),
    [res.data, opt, activeChart],
  );
  if (!activeChart) return <NoChart title="AI 프롬프트 생성" />;
  const data = res.data;
  const sewoon = data?.luck.sewoon.find((s) => s.current);
  const curLuck = data?.luck.pillars.find((p) => p.current);
  const lines = text.split("\n");
  const hiIdx = lines.findIndex((l) => l.trimStart().startsWith("- ") && /\d\.\d\d/.test(l));

  const includeRows: { key: IncludeKey; label: string; meta?: string; required?: boolean }[] = [
    { key: "chart", label: "원국 8글자 · 십성", meta: "필수", required: true },
    { key: "hidden", label: "지장간 · 12운성" },
    { key: "interactions", label: "합충형파해 작용 + 강도", meta: data ? `${data.scenarios[0].interactions.length}건` : "" },
    { key: "elements", label: "오행 세력 (작용 반영)" },
    { key: "luck", label: "대운 (현재 + 전후)", meta: curLuck?.ganji },
    { key: "sewoon", label: `세운 ${sewoon ? `${sewoon.year} ${sewoon.ganji}` : ""}` },
    { key: "sinsal", label: "신살 · 공망" },
  ];

  function record() {
    if (isTemp(activeChart)) return; // 임시 명식은 기록하지 않음
    addPrompt({ chartId: activeChart!.id, chartName: activeChart!.name, intent: opt.intent, format: opt.format, options: opt });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied("ok");
      record();
    } catch {
      setCopied("fail");
    }
    setTimeout(() => setCopied(null), 4000);
  }

  return (
    <div className="page">
      <Topbar crumbs={["도구", "AI 프롬프트 생성"]} title="AI 프롬프트 생성">
        <div className="chart-picker" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setPicker(false)}>
          <button className="chart-picker__btn" onClick={() => setPicker((v) => !v)}>
            {activeChart.dayGanji && (
              <GlyphTile hanja={activeChart.dayGanji[0]} element={elementOfHanja(activeChart.dayGanji[0]) ?? "토"} size="sm" />
            )}
            <b>{activeChart.name}{activeChart.dayGanji ? ` · ${activeChart.dayGanji} 일주` : ""}</b>
            <span className="muted">⌄</span>
          </button>
          {picker && (
            <div className="search__pop">
              {state.charts.map((c) => (
                <button key={c.id} className="search__hit" onClick={() => { openChart(c.id); setPicker(false); }}>
                  <span className="recent__dot" style={{ background: c.color }} /><b>{c.name}</b>
                  <span className="muted">{c.dayGanji ? `${c.dayGanji} 일주` : ""}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Topbar>

      <TempBanner />
      <div className="prompt-layout">
        <Card title="구성 옵션" subtitle="프롬프트에 넣을 데이터와 질문 의도">
          <div className="opt-group">
            <span className="opt-group__label">포함 데이터</span>
            {includeRows.map((r) => (
              <label key={r.key} className={`check-row ${r.required ? "is-required" : ""}`}>
                <input type="checkbox" checked={opt.include[r.key]} disabled={r.required}
                       onChange={(e) => setOpt((o) => ({ ...o, include: { ...o.include, [r.key]: e.target.checked } }))} />
                <span>{r.label}</span>
                {r.meta && <span className="muted small">{r.meta}</span>}
              </label>
            ))}
          </div>
          <div className="opt-group">
            <span className="opt-group__label">질문 의도</span>
            <div className="pills">
              {INTENTS.map((it) => (
                <button key={it} className={`pill-btn ${opt.intent === it ? "is-active" : ""}`}
                        onClick={() => setOpt((o) => ({ ...o, intent: it, include: it === "세운" ? { ...o.include, sewoon: true } : o.include }))}>
                  {it === "세운" ? `${sewoon?.year ?? ""} 운세` : it}
                </button>
              ))}
            </div>
          </div>
          <div className="opt-group">
            <span className="opt-group__label">출력 형식</span>
            <Segmented value={opt.format} onChange={(v) => setOpt((o) => ({ ...o, format: v }))} options={[
              { value: "xml", label: "XML 태그" }, { value: "markdown", label: "Markdown" },
              { value: "json", label: "JSON" }, { value: "text", label: "Text" },
            ]} />
          </div>
          <div className="opt-group">
            <span className="opt-group__label">해석 톤</span>
            <Segmented value={opt.tone} onChange={(v) => setOpt((o) => ({ ...o, tone: v }))} options={[
              { value: "expert", label: "전문가 · 근거 중심" }, { value: "easy", label: "쉬운 설명" },
            ]} />
          </div>
          <div className="opt-group">
            <span className="opt-group__label">추가 지시 (선택)</span>
            <textarea className="input textarea" maxLength={500} value={opt.extra} placeholder="예: 자율주행 · 컴퓨터비전 분야 진로와의 적합도도 함께 봐줘."
                      onChange={(e) => setOpt((o) => ({ ...o, extra: e.target.value }))} />
          </div>
        </Card>

        <Card title="프롬프트 미리보기" subtitle="실시간 생성 · 옵션 변경 시 자동 갱신"
              actions={
                <>
                  <span className="chip mono">≈ {estimateTokens(text).toLocaleString()} tokens</span>
                  <button className="btn btn--ghost" disabled={!text}
                          onClick={() => { downloadText(`saju-prompt-${activeChart.name}.md`, text, "text/markdown"); record(); }}>.md 저장</button>
                  <button className="btn btn--primary" disabled={!text} onClick={copy}>⧉ 복사하기</button>
                </>
              }>
          {res.loading && !data && <Loading />}
          {res.error && <ErrorBox message={res.error} />}
          {text && (
            <pre className="code" aria-label="프롬프트 미리보기">
              {lines.map((l, i) => (
                <div key={i} className={`code__line ${i === hiIdx ? "is-hi" : ""}`}>
                  <span className="code__no">{i + 1}</span>
                  <span className={l.trim().startsWith("<") ? "code__tag" : ""}>{l}</span>
                </div>
              ))}
            </pre>
          )}
          <div className="prompt-foot">
            {copied === "ok" && <span className="chip chip--ok">✓ 클립보드에 복사됨</span>}
            {copied === "fail" && <span className="chip chip--danger">복사 실패 — 직접 선택해 복사하세요</span>}
            <span className="muted small">Claude · ChatGPT · Gemini 어디에 붙여넣어도 동일한 구조로 해석됩니다. 이름·생년월일은 포함하지 않습니다.</span>
          </div>
        </Card>
      </div>

      <Card title="최근 생성한 프롬프트">
        {state.prompts.length === 0 ? <p className="muted">복사하거나 저장한 프롬프트가 여기에 기록됩니다 (이 브라우저에만 저장).</p> : (
          <div className="recent-prompts">
            {state.prompts.slice(0, 8).map((p) => (
              <button key={p.id} className="recent-prompt" onClick={() => {
                if (state.charts.some((c) => c.id === p.chartId)) openChart(p.chartId);
                if (p.options && typeof p.options === "object") setOpt({ ...DEFAULT_PROMPT_OPTIONS, ...(p.options as PromptOptions) });
              }}>
                <div className="recent-prompt__head"><b>{p.chartName}</b><span className="muted small">{relTime(p.createdAt)}</span></div>
                <span className="muted small">{p.intent} · {{ xml: "XML", markdown: "Markdown", json: "JSON", text: "Text" }[p.format] ?? p.format}</span>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
