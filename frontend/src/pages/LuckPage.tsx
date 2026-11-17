import { useState } from "react";
import { Topbar } from "../components/Topbar";
import { ChartSearch } from "../components/ChartSearch";
import { TempBanner } from "../components/TempBanner";
import { LuckStrengthFlow, currentLuckIndex } from "../components/LuckStrength";
import { Card, ErrorBox, GlyphTile, Hanja, Loading, useFmt } from "../components/ui";
import { useAnalysis, useApp } from "../store/AppState";
import { NoChart, ProfileStrip } from "./analysis/AnalysisPage";
import type { AnalyzeResponse } from "../types";

function Timeline({ data, selected, onSelect }: { data: AnalyzeResponse; selected: number; onSelect(i: number): void }) {
  const { tg } = useFmt();
  return (
    <div className="luck-timeline" role="tablist" aria-label="대운">
      {data.luck.pillars.map((p, i) => (
        <button key={p.ganji} role="tab" aria-selected={i === selected}
                className={`luck-card ${p.current ? "is-current" : ""} ${i === selected ? "is-selected" : ""}`} onClick={() => onSelect(i)}>
          <span className="muted small">{p.age_label} · {p.start_year}</span>
          <GlyphTile hanja={p.stem.hanja} element={p.stem.element} size="sm" sub={tg(p.stem_ten_god)} />
          <GlyphTile hanja={p.branch.hanja} element={p.branch.element} size="sm" sub={tg(p.branch_ten_god)} />
          <span className="mono small">{p.total.toFixed(2)}</span>
          {p.current && <span className="pill pill--accent">현재</span>}
        </button>
      ))}
    </div>
  );
}

export function LuckPage() {
  const { viewChart: activeChart, setNewChartOpen } = useApp();
  const res = useAnalysis(activeChart);
  const { g, tg } = useFmt();
  const [sel, setSel] = useState<number | null>(null);
  if (!activeChart) return <NoChart title="대운 · 세운 흐름" />;
  const data = res.data;
  const idx = sel ?? (data ? currentLuckIndex(data) : 0);
  const lp = data?.luck.pillars[idx];
  return (
    <div className="page">
      <Topbar crumbs={["명식", activeChart.name, "대운 · 세운"]} title="대운 · 세운 흐름">
        <ChartSearch goto={false} />
        <button className="btn btn--ghost" onClick={() => setNewChartOpen(true)}>＋ 새 명식</button>
      </Topbar>
      <TempBanner />
      {res.loading && !data && <Loading />}
      {res.error && <ErrorBox message={res.error} />}
      {data && lp && (
        <>
          <ProfileStrip chart={activeChart} data={data} />
          <Card title="대운 (大運)" subtitle={`${data.luck.forward ? "순행" : "역행"} · 대운수 ${data.luck.start_label} · 절입까지 ${data.luck.days_to_term}일 ÷ 3 · 숫자는 원국과의 작용 총량 · 대운을 누르면 세운과 상세가 바뀝니다`}>
            <Timeline data={data} selected={idx} onSelect={setSel} />
          </Card>
          <div className="grid-2 grid-2--wide-left">
            <Card title="대운별 작용 강도 흐름" subtitle="원국 × 대운 중첩 시 합충형파해 총량 · 막대를 눌러도 대운이 바뀝니다">
              <LuckStrengthFlow data={data} selected={idx} onSelect={setSel} />
            </Card>
            <Card title={<>세운 (歲運) · <Hanja text={lp.ganji} /> 대운 기간</>}
                  subtitle={`${lp.start_year}년 ~ ${lp.start_year + 9}년 · ${lp.age_label}부터`}>
              <div className="sewoon-grid">
                {lp.sewoon.map((s) => (
                  <div key={s.year} className={`sewoon ${s.current ? "is-current" : ""}`}>
                    <span className="muted small">{s.year}</span>
                    <Hanja text={s.ganji} className="serif sewoon__ganji" colored={!s.current} />
                    <span className="small sewoon__tg">{tg(s.stem_ten_god)} · {tg(s.branch_ten_god)}</span>
                  </div>
                ))}
              </div>
              {data.luck.notes.length > 0 && (
                <ul className="notes">{data.luck.notes.map((n) => <li key={n}>{g(n)}</li>)}</ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
