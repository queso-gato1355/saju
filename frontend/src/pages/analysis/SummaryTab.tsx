import { Card, Chip, ElementGlyph, ElementLegend, GlyphTile, Hanja, useFmt } from "../../components/ui";
import { useApp } from "../../store/AppState";
import { href } from "../../router";
import { ELEMENT_CLASS, fmtText } from "../../lib/ganji";
import type { AnalyzeResponse, PillarOut } from "../../types";

const COLS: { key: "h" | "d" | "m" | "y"; label: string }[] = [
  { key: "h", label: "시주" }, { key: "d", label: "일주" }, { key: "m", label: "월주" }, { key: "y", label: "년주" },
];

export function PillarColumns({ data }: { data: AnalyzeResponse }) {
  const { tg } = useFmt();
  const { state } = useApp();
  const basis = state.settings.stageBasis;
  return (
    <div className="pillars">
      {COLS.map((c, i) => {
        const p: PillarOut | null = data.pillars[i];
        return (
          <div key={c.key} className="pillars__col">
            <span className={`pillars__label ${c.key === "d" ? "fg-accent" : ""}`}>{c.label}</span>
            {p ? (
              <>
                <GlyphTile hanja={p.stem.hanja} element={p.stem.element} sub={tg(p.stem.ten_god)} selected={c.key === "d"} />
                <GlyphTile hanja={p.branch.hanja} element={p.branch.element} sub={tg(p.branch.ten_god)} />
                <div className="pillars__hidden">
                  <span className="pillars__hidden-label">지장간</span>
                  <Hanja text={p.branch.hidden.map((h) => h.hanja).join(" ")} className="serif" />
                </div>
                <span className="pill" title={`봉법(일간 기준, ${p.branch.period}) · 거법(같은 기둥 천간 기준)`}>
                  {basis === "geo" ? p.branch.stage_geo : p.branch.stage}
                  {basis === "both" && p.branch.stage_geo !== p.branch.stage && <small> · 거 {p.branch.stage_geo}</small>}
                </span>
              </>
            ) : (
              <>
                <div className="tile tile--lg tile--unknown"><span className="tile__glyph">?</span><span className="tile__sub">시각 모름</span></div>
                <div className="tile tile--lg tile--unknown"><span className="tile__glyph">?</span></div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StrengthGauge({ score }: { score: number }) {
  const segs = [
    { to: 25, label: "극신약", cls: "chung" }, { to: 45, label: "신약", cls: "chung" },
    { to: 55, label: "중화", cls: "wood" }, { to: 75, label: "신강", cls: "hap" }, { to: 100, label: "극신강", cls: "hap" },
  ];
  let from = 0;
  return (
    <div className="gauge" role="img" aria-label={`신강도 ${score}점`}>
      <div className="gauge__track">
        {segs.map((s) => {
          const w = s.to - from;
          from = s.to;
          return <div key={s.label} className={`gauge__seg bg-${s.cls}`} style={{ flexGrow: w }} />;
        })}
        <div className="gauge__marker" style={{ left: `${Math.min(99, Math.max(1, score))}%` }} />
      </div>
      <div className="gauge__labels">
        {(() => {
          let f = 0;
          return segs.map((s) => {
            const w = s.to - f;
            f = s.to;
            return <span key={s.label} style={{ flexGrow: w }}>{s.label}</span>;
          });
        })()}
      </div>
    </div>
  );
}

export function SummaryTab({ data }: { data: AnalyzeResponse }) {
  const { state } = useApp();
  const mode = state.settings.ganjiDisplay;
  const st = data.strength;
  const natal = data.scenarios[0];
  const total = natal.yang + natal.yin;
  return (
    <div className="grid-2">
      <Card title="원국 명식" subtitle="시 · 일 · 월 · 년 / 십성 · 지장간 · 12운성">
        <PillarColumns data={data} />
        <ElementLegend />
      </Card>

      <div className="stack">
        <Card title="일간 강약" subtitle="득령 · 득지 · 득세 점수 합산 (100점)">
          <div className="score-row">
            <span className="score-big">{st.score}</span><span className="muted">/ 100</span>
            <Chip tone={st.score < 45 ? "chung" : st.score < 55 ? "neutral" : "hap"}>{st.label}</Chip>
          </div>
          <StrengthGauge score={st.score} />
          <div className="subcards">
            {[["득령", st.deukryeong], ["득지", st.deukji], ["득세", st.deukse]].map(([k, v]) => {
              const part = v as typeof st.deukji;
              return (
                <div key={k as string} className="subcard">
                  <div className="subcard__head"><span>{k as string}</span><b className="mono">{part.score}</b><small>/{part.max}</small></div>
                  <div className="subcard__desc">{fmtText(part.desc, mode)}</div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="오행 · 음양 분포" subtitle="원국 정적 분포 (작용 반영 전) · 괄호는 지장간 포함 %">
          <div className="el-boxes">
            {natal.elements.map((e) => (
              <div key={e.element} className={`el-box el-box--${ELEMENT_CLASS[e.element]}`}>
                <ElementGlyph el={e.element} className="el-box__glyph" />
                <b>{e.count}개</b>
                <span className="mono muted">({Math.round(e.static_pct)}%)</span>
                {e.count === 0 && <Chip tone="danger">무(無)</Chip>}
              </div>
            ))}
          </div>
          <div className="yy">
            <div className="yy__labels"><b>양 {natal.yang}</b><span>음 {natal.yin}</span></div>
            <div className="yy__bar">
              <div className="yy__yang" style={{ width: `${(natal.yang / total) * 100}%` }} />
            </div>
          </div>
        </Card>
      </div>

      <Card title="격국 · 용신 후보" subtitle={`억부(抑扶) 기준 · 신강도 ${st.score}점 (${st.label})`}>
        <div className="gyeok">
          <span className="gyeok__label">격국</span>
          <div className="gyeok__row">
            <b className="gyeok__name">{data.gyeok.name} ({data.gyeok.hanja})</b>
            <span className="muted">{fmtText(data.gyeok.reason, mode)}</span>
          </div>
          {data.gyeok.note && <span className="fg-chung small">{data.gyeok.note}</span>}
        </div>
        <div className="roles">
          {data.yongsin.map((y) => (
            <div key={y.role} className="role">
              <div className="role__head"><ElementGlyph el={y.element} className="role__glyph" /><b>{y.role}</b></div>
              <span className="muted small">{y.group} · {fmtText(y.reason, mode)}</span>
            </div>
          ))}
        </div>
        <p className="footnote">격국·용신은 정해진 규칙으로 뽑은 '후보'입니다. 최종 판단은 학파와 해석자에 따라 달라질 수 있습니다.</p>
      </Card>

      <Card title="원국 요약" subtitle="핵심 3줄 · AI 프롬프트에 그대로 포함됩니다">
        <ol className="summary">
          {data.summary.map((s, i) => <li key={i}><span className="summary__num">{i + 1}</span>{fmtText(s, mode)}</li>)}
        </ol>
        <div className="links">
          <a href={href({ page: "analysis", tab: "dynamics" })}>합충형파해 역동 보기 →</a>
          <a href={href({ page: "analysis", tab: "tengods" })}>십성 세력 보기 →</a>
        </div>
      </Card>
    </div>
  );
}
