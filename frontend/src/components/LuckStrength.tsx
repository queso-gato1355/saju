// 대운별 작용 강도 흐름 — 대운 막대를 클릭하면 아래 상세가 그 대운으로 바뀐다.
// 사주원국 분석 > 합충형파해 역동, 대운 · 세운 흐름 두 곳에서 공용.
import { Hanja, KindDot, useFmt } from "./ui";
import { useApp } from "../store/AppState";
import { KINDS, KIND_COLOR, fmtText } from "../lib/ganji";
import type { AnalyzeResponse } from "../types";

export function currentLuckIndex(data: AnalyzeResponse): number {
  return Math.max(0, data.luck.pillars.findIndex((p) => p.current));
}

export function LuckStrengthFlow({ data, selected, onSelect }: {
  data: AnalyzeResponse; selected: number; onSelect(i: number): void;
}) {
  const { g } = useFmt();
  const { state } = useApp();
  const pillars = data.luck.pillars;
  const max = Math.max(1, ...pillars.map((p) => p.total));
  const lp = pillars[selected] ?? pillars[0];
  return (
    <div className="luck-strength">
      <div className="luckflow" role="tablist" aria-label="대운 선택">
        {pillars.map((p, i) => (
          <button key={p.ganji} role="tab" aria-selected={i === selected}
                  className={`luckflow__col ${p.current ? "is-current" : ""} ${i === selected ? "is-selected" : ""}`}
                  onClick={() => onSelect(i)} title={`${p.ganji} 대운 상세 보기`}>
            <span className="mono small">{p.total.toFixed(1)}</span>
            <div className="luckflow__stack" style={{ height: `${(p.total / max) * 150 + 4}px` }}>
              {KINDS.map((k) => p.strength_by_kind[k] > 0 && (
                <div key={k} style={{ flexGrow: p.strength_by_kind[k], background: KIND_COLOR[k] }} title={`${k} ${p.strength_by_kind[k]}`} />
              ))}
            </div>
            <span className="luckflow__ganji"><Hanja text={p.ganji} /></span>
            <span className="muted small">{p.age_label}</span>
            {p.current ? <span className="pill pill--accent">현재</span> : <span className="pill pill--ghost">{p.start_year}</span>}
          </button>
        ))}
      </div>

      <div className="luck-detail">
        <div className="luck-detail__head">
          <b><Hanja text={lp.ganji} /> 대운{lp.current ? " (현재)" : ""}</b>
          <span className="muted small">{lp.age_label}부터 · {lp.start_year}~{lp.start_year + 9}년 · 작용 합 {lp.total.toFixed(2)}</span>
        </div>
        <div className="kind-bars">
          {KINDS.map((k) => (
            <div key={k} className="kind-bar">
              <KindDot kind={k} />
              <span className="bar"><span className="bar__fill" style={{ width: `${Math.min(100, (lp.strength_by_kind[k] / Math.max(1, max)) * 100)}%`, background: KIND_COLOR[k] }} /></span>
              <span className="mono small">{lp.strength_by_kind[k].toFixed(2)}</span>
            </div>
          ))}
        </div>
        {lp.interactions.length === 0 ? (
          <p className="muted small">이 대운 글자는 원국과 뚜렷한 합충형파해 작용이 없습니다.</p>
        ) : (
          <div className="luck-detail__list">
            {lp.interactions.map((it) => (
              <div key={it.id} className="luck-rel">
                <KindDot kind={it.kind} />
                <b className="serif">{g(it.label)}</b>
                <span className="muted small luck-rel__pos">{it.positions}</span>
                <span className="rel-item__bar"><span style={{ width: `${it.strength * 100}%`, background: KIND_COLOR[it.kind] }} /></span>
                <span className="mono small">{it.strength.toFixed(2)}</span>
                <span className="muted small luck-rel__desc">{fmtText(it.desc, state.settings.ganjiDisplay)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
