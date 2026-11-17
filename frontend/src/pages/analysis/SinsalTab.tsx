import { useState } from "react";
import { Card, Chip, ErrorBox, GlyphTile, Hanja, Segmented, useFmt } from "../../components/ui";
import { useAnalysis, useApp } from "../../store/AppState";
import type { SavedChart } from "../../lib/storage";
import type { AnalyzeResponse, CalcOptions } from "../../types";

const SINSAL_TONE: Record<string, string> = {
  역마: "hap", 도화: "pa", 화개: "hae", 귀인: "accent", 문창: "accent", 양인: "chung", 현침: "pa", 괴강: "chung", 백호: "chung", 공망: "neutral",
};

const FULL_TONE: Record<string, string> = {
  역마살: "hap", 도화살: "pa", 화개살: "hae", 천을귀인: "accent", 문창귀인: "accent",
  양인: "chung", 현침살: "pa", 괴강살: "chung", 백호살: "chung",
};

function SinsalMap({ data, basis, setBasis, loading }: {
  data: AnalyzeResponse; basis: CalcOptions["sinsal_basis"]; setBasis(b: CalcOptions["sinsal_basis"]): void; loading: boolean;
}) {
  return (
    <Card title="신살 위치 맵" subtitle="원국 8글자 위에 걸린 신살 · 기본 기준은 설정에서 변경"
          actions={<Segmented size="sm" value={basis} onChange={setBasis} options={[
            { value: "year", label: "년지 기준" }, { value: "day", label: "일지 기준" }, { value: "both", label: "둘 다" },
          ]} />}>
      <div className={`sinsal-map ${loading ? "is-loading" : ""}`}>
        {data.pillars.map((p, i) => (
          <div key={i} className="sinsal-map__col">
            <b className={p?.key === "d" ? "fg-accent" : ""}>{["시주", "일주", "월주", "년주"][i]}</b>
            {p ? (
              <>
                <GlyphTile hanja={p.stem.hanja} element={p.stem.element} size="md" />
                <div className="sinsal-map__chips">{p.stem.sinsal.length ? p.stem.sinsal.map((s) => <Chip key={s} tone={SINSAL_TONE[s] as never}>{s}</Chip>) : <span className="muted">–</span>}</div>
                <GlyphTile hanja={p.branch.hanja} element={p.branch.element} size="md" dashed={p.branch.gongmang.length > 0} />
                <div className="sinsal-map__chips">{p.branch.sinsal.length ? p.branch.sinsal.map((s) => <Chip key={s} tone={SINSAL_TONE[s] as never}>{s}</Chip>) : <span className="muted">–</span>}</div>
              </>
            ) : <span className="muted">시각 모름</span>}
          </div>
        ))}
      </div>
    </Card>
  );
}

function Gongmang({ data }: { data: AnalyzeResponse }) {
  const { g } = useFmt();
  const { state } = useApp();
  const basis = state.settings.gongmangBasis;
  const rows = data.gongmang.filter((gm) => basis === "both" || (basis === "day" ? gm.basis === "일주" : gm.basis === "년주"));
  const sewoon = data.luck.sewoon.find((s) => s.current);
  const filled = rows.filter((r) => r.filled_by_sewoon);
  return (
    <Card title="공망 (空亡)" subtitle="60갑자 순(旬)에서 짝을 못 찾은 두 지지">
      {rows.map((gm) => (
        <div key={gm.basis} className="gm">
          <b className="small">{gm.basis} 기준 · {g(gm.pillar)} → {g(gm.xun)}</b>
          <div className="gm__row">
            {gm.xun_pillars.map((x) => <span key={x} className={`gm__cell ${x === gm.pillar ? "is-self" : ""}`}><Hanja text={x} colored={x !== gm.pillar} /></span>)}
            <span className="gm__arrow">→</span>
            {gm.void.map((v) => {
              const hit = gm.hits.some((h) => h.endsWith(v));
              return <span key={v} className={`gm__void ${hit ? "is-hit" : ""}`}><Hanja text={v} colored={false} /></span>;
            })}
          </div>
          <p className={`small ${gm.hits.length ? "fg-chung" : "muted"}`}>
            공망 {gm.void.map(g).join(" · ")} — {gm.hits.length ? `${gm.hits.map(g).join(", ")}가 공망${gm.hits.some((h) => h.startsWith("일지")) ? " (배우자궁)" : ""}` : "원국에 해당 글자 없음"}
          </p>
        </div>
      ))}
      {sewoon && (
        <div className="info">
          {filled.length
            ? `${sewoon.year} ${g(sewoon.ganji)} 세운에 ${g(sewoon.ganji[1])}가 들어오면 공망이 채워집니다(전실).`
            : `${sewoon.year} ${g(sewoon.ganji)} 세운은 공망 지지와 겹치지 않습니다.`} 공망 기준(일주/년주)은 설정에서 선택
        </div>
      )}
    </Card>
  );
}

function SinsalList({ data }: { data: AnalyzeResponse }) {
  const { g } = useFmt();
  const gmHit = data.gongmang.flatMap((x) => x.hits.map((h) => ({ basis: x.basis, pillar: x.pillar, h })));
  return (
    <Card title="신살 목록" subtitle="해당 · 미해당을 함께 표시">
      <div className="sinsal-list">
        {data.sinsal.filter((s) => s.present).map((s) => (
          <div key={s.name} className="sinsal-row is-on">
            <span className={`dot dot--${FULL_TONE[s.name] ?? "accent"}`} />
            <b>{s.name}</b><span className="muted small serif">{s.hanja}</span>
            <span className="muted small sinsal-row__rule">{g(s.rule)}</span>
            <b className="serif">{s.targets.map(g).join(" · ")}</b>
            <Chip tone="accent">{s.keyword}</Chip>
          </div>
        ))}
        {gmHit.map((x) => (
          <div key={x.basis + x.h} className="sinsal-row is-on">
            <span className="dot dot--neutral" />
            <b>공망</b><span className="muted small serif">空亡</span>
            <span className="muted small sinsal-row__rule">{x.basis} {g(x.pillar)}旬</span>
            <b className="serif">{g(x.h.slice(-1))}</b>
            <Chip>{x.h.slice(0, 2)} 비어 있음</Chip>
          </div>
        ))}
        {data.sinsal.filter((s) => !s.present).map((s) => (
          <div key={s.name} className="sinsal-row">
            <span className="dot dot--off" />
            <b>{s.name}</b><span className="muted small serif">{s.hanja}</span>
            <span className="muted small sinsal-row__rule">{g(s.rule)}</span>
            <span className="muted">없음</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function SinsalTab({ data, chart }: { data: AnalyzeResponse; chart: SavedChart }) {
  const { state } = useApp();
  const [basis, setBasis] = useState<CalcOptions["sinsal_basis"]>(state.settings.sinsalBasis);
  const override = basis !== state.settings.sinsalBasis ? { sinsal_basis: basis } : undefined;
  const res = useAnalysis(override ? chart : null, override);
  const shown = override ? res.data ?? data : data;
  return (
    <div className="stack">
      {res.error && <ErrorBox message={res.error} />}
      <SinsalMap data={shown} basis={basis} setBasis={setBasis} loading={!!override && res.loading} />
      <div className="grid-2 grid-2--even">
        <Gongmang data={shown} />
        <SinsalList data={shown} />
      </div>
    </div>
  );
}
