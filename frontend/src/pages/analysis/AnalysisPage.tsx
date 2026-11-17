import { Topbar } from "../../components/Topbar";
import { ChartSearch } from "../../components/ChartSearch";
import { ChartForm } from "../../components/ChartForm";
import { TempBanner } from "../../components/TempBanner";
import { Card, ErrorBox, Hanja, Loading, useFmt } from "../../components/ui";
import { useAnalysis, useApp } from "../../store/AppState";
import { href, navigate, type AnalysisTab } from "../../router";
import { ELEMENT_HANJA, dotDate, hm } from "../../lib/ganji";
import type { SavedChart } from "../../lib/storage";
import type { AnalyzeResponse } from "../../types";
import { SummaryTab } from "./SummaryTab";
import { DynamicsTab } from "./DynamicsTab";
import { TenGodsTab } from "./TenGodsTab";
import { HiddenTab } from "./HiddenTab";
import { SinsalTab } from "./SinsalTab";

const TAB_LABEL: Record<AnalysisTab, string> = {
  summary: "원국 요약", dynamics: "합충형파해 역동", tengods: "십성 세력", hidden: "지장간 · 12운성", sinsal: "신살 · 공망",
};

export function ProfileStrip({ chart, data }: { chart: SavedChart; data: AnalyzeResponse }) {
  const { g } = useFmt();
  const m = data.meta;
  const n = data.scenarios[0];
  const corr = m.correction_minutes;
  const yy = m.yinyang_gender;
  const yyHanja = `${yy[0] === "양" ? "陽" : "陰"}${yy[1] === "남" ? "男" : "女"}`;
  const dm = data.day_master;
  return (
    <section className="card profile">
      <div className="profile__main">
        <div className="profile__name">{chart.name} · {chart.gender === "M" ? "남" : "여"} · {yy}({yyHanja})</div>
        <div className="profile__sub">
          양력 {dotDate(m.solar_date)}{m.input_time ? ` ${hm(m.input_time)}` : " (시각 모름)"}
          {"  ·  "}{chart.placeName.replace(/특별시|광역시|특별자치시|특별자치도/, "")}
          {corr != null && corr !== 0 ? ` (진태양시 ${corr > 0 ? "+" : "−"}${Math.abs(corr)}분 보정)` : ""}
          {m.dst_applied && ` · 표준시 UTC+${m.tz_hours} 적용`}
          {m.lunar && `  ·  음력 ${m.lunar.year}.${String(m.lunar.month).padStart(2, "0")}.${String(m.lunar.day).padStart(2, "0")}${m.lunar.is_leap ? " (윤)" : ""}`}
        </div>
        {m.near_term_warning && <div className="profile__warn">⚠ 절입 시각 ±5분 이내 출생 — 월주·년주를 한국천문연구원 자료로 교차 확인하세요</div>}
      </div>
      <div className="profile__stat">
        <span className="profile__label">일간</span>
        <span><b>{g(dm.hanja)}{ELEMENT_HANJA[dm.element]}</b> <small>{dm.yinyang}{dm.element}</small></span>
      </div>
      <div className="profile__stat">
        <span className="profile__label">월령</span>
        <span>
          <b><Hanja text={data.strength.wolryeong_branch} /> · {data.strength.wolryeong_element}왕</b>{" "}
          <small>{data.strength.wolryeong_deuk ? "득령 ○" : "실령 ✕"}</small>
        </span>
      </div>
      <div className="profile__stat">
        <span className="profile__label">신강도</span>
        <span><b className={data.strength.score < 45 ? "fg-chung" : "fg-hap"}>{data.strength.score}</b> <small>{data.strength.label}</small></span>
      </div>
      <div className="profile__stat">
        <span className="profile__label">작용 총량</span>
        <span>
          <b className="fg-accent">{n.total.toFixed(2)}</b>{" "}
          <small>{(["합", "충", "형", "파", "해"] as const).map((k) => `${k}${n.counts[k]}`).join(" ")}</small>
        </span>
      </div>
    </section>
  );
}

export function NoChart({ title }: { title: string }) {
  const { addChart } = useApp();
  return (
    <div className="page">
      <Topbar crumbs={["명식"]} title={title} />
      <Card title="먼저 명식을 열어주세요" subtitle="생년월일시를 입력하면 이 브라우저에 저장되고 바로 분석됩니다">
        <div className="narrow">
          <ChartForm onSubmit={(d) => addChart(d)} />
        </div>
      </Card>
    </div>
  );
}

export function AnalysisPage({ tab }: { tab: AnalysisTab }) {
  const { viewChart: activeChart, setNewChartOpen } = useApp();
  const res = useAnalysis(activeChart);
  if (!activeChart) return <NoChart title="사주원국 분석" />;
  return (
    <div className="page">
      <Topbar crumbs={["명식", activeChart.name, TAB_LABEL[tab]]} title="사주원국 분석">
        <ChartSearch goto={false} />
        <button className="btn btn--ghost" onClick={() => setNewChartOpen(true)}>＋ 새 명식</button>
        <button className="btn btn--primary" onClick={() => navigate({ page: "prompt" })}>✦  AI 프롬프트로 내보내기</button>
      </Topbar>
      <TempBanner />
      {res.data && <ProfileStrip chart={activeChart} data={res.data} />}
      <nav className="tabs" aria-label="분석 탭">
        {(Object.keys(TAB_LABEL) as AnalysisTab[]).map((t) => (
          <a key={t} href={href({ page: "analysis", tab: t })} className={`tabs__item ${t === tab ? "is-active" : ""}`}
             aria-current={t === tab ? "page" : undefined}>{TAB_LABEL[t]}</a>
        ))}
      </nav>
      {res.loading && !res.data && <Loading />}
      {res.error && <ErrorBox message={res.error} />}
      {res.data && (
        <>
          {tab === "summary" && <SummaryTab data={res.data} />}
          {tab === "dynamics" && <DynamicsTab data={res.data} />}
          {tab === "tengods" && <TenGodsTab data={res.data} />}
          {tab === "hidden" && <HiddenTab data={res.data} />}
          {tab === "sinsal" && <SinsalTab data={res.data} chart={activeChart} />}
        </>
      )}
    </div>
  );
}
