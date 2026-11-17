import { useMemo, useState } from "react";
import { Bar, Card, ElementGlyph, Hanja, KindDot, Segmented, Toggle, useFmt } from "../../components/ui";
import { useApp } from "../../store/AppState";
import { ELEMENT_CLASS, KINDS, KIND_COLOR, elementOfHanja, fmtText } from "../../lib/ganji";
import type { AnalyzeResponse, InteractionOut, RelKind, ScenarioKey } from "../../types";
import { LuckStrengthFlow, currentLuckIndex } from "../../components/LuckStrength";

const EL_VAR: Record<string, string> = {
  목: "var(--element-wood)", 화: "var(--element-fire)", 토: "var(--element-earth)",
  금: "var(--element-metal)", 수: "var(--element-water)",
};

export function ScenarioSwitch({ value, onChange }: { value: ScenarioKey; onChange(v: ScenarioKey): void }) {
  return (
    <Segmented size="sm" value={value} onChange={onChange} options={[
      { value: "natal", label: "원국" }, { value: "daewoon", label: "+대운" }, { value: "sewoon", label: "+세운" },
    ]} />
  );
}

function ElementShift({ data }: { data: AnalyzeResponse }) {
  const [sc, setSc] = useState<ScenarioKey>("natal");
  const { state } = useApp();
  const s = data.scenarios.find((x) => x.key === sc)!;
  const topHap = s.interactions.find((i) => i.kind === "합" && i.degree != null);
  return (
    <Card title="오행 세력 변화" subtitle={`원국 정적 분포 → 합충형파해 작용 반영 후${s.extra.length ? ` (+ ${s.extra.join(" · ")})` : ""}`}
          actions={<ScenarioSwitch value={sc} onChange={setSc} />}>
      <div className="shift">
        {s.elements.map((e) => {
          const d = Math.round(e.after_pct - e.static_pct);
          return (
            <div key={e.element} className="shift__row">
              <div className="shift__el"><ElementGlyph el={e.element} className="shift__glyph" /> {e.element}</div>
              <div className="shift__nums">
                <span><b className="mono">{Math.round(e.after_pct)}%</b> <span className={`mono small ${d > 0 ? "fg-up" : d < 0 ? "fg-down" : "muted"}`}>{d > 0 ? `+${d}` : d === 0 ? "±0" : d}</span></span>
                <span className="muted small">원국 {Math.round(e.static_pct)}%</span>
              </div>
              <div className="shift__bars">
                <Bar value={e.after_pct} max={60} ghost={e.static_pct} color={state.settings.elementColor ? EL_VAR[e.element] : "var(--text-muted)"} />
                <span className="muted small">{fmtText(e.reason, state.settings.ganjiDisplay)}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="info">ⓘ 합화(合化)는 월령·투간 조건 충족도에 따라 0~100% 가중 반영됩니다.
        {topHap && ` 현재 ${topHap.label} 성립도 ${Math.round((topHap.degree ?? 0) * 100)}%.`}</div>
    </Card>
  );
}

interface Node { id: string; hanja: string; el: string; x: number; y: number; sub: string; col: string; }

function RelationMap({ data, interactions, selected, onSelect, hidden }: {
  data: AnalyzeResponse; interactions: InteractionOut[]; selected: string | null;
  onSelect(id: string): void; hidden: Set<RelKind>;
}) {
  const { tg, g } = useFmt();
  const { state } = useApp();
  const cols = [
    { k: "h", label: "시주" }, { k: "d", label: "일주" }, { k: "m", label: "월주" }, { k: "y", label: "년주" },
  ];
  const luckCols = [...new Set(interactions.flatMap((i) => i.slots).filter((s) => s[0] === "l" || s[0] === "s").map((s) => s[0]))].sort();
  const allCols = [...cols, ...luckCols.map((k) => ({ k, label: k === "l" ? "대운" : "세운" }))];
  const W = 100 * allCols.length + 40;
  const SY = 150, BY = 270, R = 23;
  const sc = data.scenarios.find((s) => s.extra.length === luckCols.length) ?? data.scenarios[0];
  const extraChars: Record<string, string> = {};
  if (luckCols.includes("l") && sc.extra[0]) { extraChars.ls = sc.extra[0][0]; extraChars.lb = sc.extra[0][1]; }
  if (luckCols.includes("s") && sc.extra[1]) { extraChars.ss = sc.extra[1][0]; extraChars.sb = sc.extra[1][1]; }

  const nodes: Record<string, Node> = {};
  allCols.forEach((c, i) => {
    const x = 70 + i * 100;
    const p = data.pillars.find((q) => q?.key === c.k);
    if (p) {
      nodes[`${c.k}s`] = { id: `${c.k}s`, hanja: p.stem.hanja, el: p.stem.element, x, y: SY, sub: tg(p.stem.ten_god), col: c.label };
      nodes[`${c.k}b`] = { id: `${c.k}b`, hanja: p.branch.hanja, el: p.branch.element, x, y: BY, sub: tg(p.branch.ten_god), col: c.label };
    } else if (extraChars[`${c.k}s`]) {
      for (const part of ["s", "b"] as const) {
        const h = extraChars[`${c.k}${part}`];
        nodes[`${c.k}${part}`] = { id: `${c.k}${part}`, hanja: h, el: elementOfHanja(h) ?? "토", x, y: part === "s" ? SY : BY, sub: c.label, col: c.label };
      }
    }
  });

  const visible = interactions.filter((i) => !hidden.has(i.kind) && i.slots.every((s) => nodes[s]));
  return (
    <svg className="relmap" viewBox={`0 0 ${W} 420`} role="img" aria-label="합충형파해 역동 맵">
      <text x={8} y={SY + 4} className="relmap__axis">천간</text>
      <text x={8} y={BY + 4} className="relmap__axis">지지</text>
      {visible.map((it) => {
        const pts = it.slots.map((s) => nodes[s]).sort((a, b) => a.x - b.x);
        const a = pts[0], b = pts[pts.length - 1];
        const up = a.y === SY;
        const span = Math.abs(b.x - a.x) / 100;
        const h = (it.slots.length === 3 ? 40 : 18) + 22 * span;
        const y0 = up ? a.y - R : a.y + R;
        const cy = up ? y0 - h * 2 : y0 + h * 2;
        const mx = (a.x + b.x) / 2;
        const my = up ? y0 - h : y0 + h;
        const dashed = (it.kind === "합" && (it.degree ?? 1) < 0.5) || it.strength < 0.3;
        const dim = selected != null && selected !== it.id;
        const color = KIND_COLOR[it.kind];
        const d = it.slots.length === 3
          ? `M ${a.x} ${y0} Q ${mx} ${cy} ${b.x} ${y0}`
          : a.x === b.x ? `M ${a.x - 8} ${y0} q 8 ${up ? -60 : 60} 16 0` : `M ${a.x} ${y0} Q ${mx} ${cy} ${b.x} ${y0}`;
        const label = `${g(it.label)} .${String(Math.round(it.strength * 100)).padStart(2, "0")}`;
        return (
          <g key={it.id} className={`relmap__edge ${dim ? "is-dim" : ""}`} onClick={() => onSelect(it.id)}>
            <path d={d} stroke={color} strokeWidth={1.5 + it.strength * 5} fill="none"
                  strokeDasharray={dashed ? "6 5" : undefined} strokeLinecap="round" />
            <path d={d} stroke="transparent" strokeWidth={14} fill="none" />
            <g transform={`translate(${mx}, ${my})`}>
              <rect x={-label.length * 3.6 - 6} y={-9} width={label.length * 7.2 + 12} height={18} rx={9}
                    fill={selected === it.id ? color : "var(--bg-surface)"} stroke={color} />
              <text textAnchor="middle" y={4} className="relmap__label" fill={selected === it.id ? "#fff" : color}>{label}</text>
            </g>
          </g>
        );
      })}
      {Object.values(nodes).map((n) => (
        <g key={n.id}>
          <circle cx={n.x} cy={n.y} r={R} className={`relmap__node ${state.settings.elementColor ? `fill-${ELEMENT_CLASS[n.el as "목"]}` : "fill-plain"} ${n.id === "ds" ? "is-dm" : ""}`} />
          <text x={n.x} y={n.y + 7} textAnchor="middle" className={`relmap__glyph ${n.el === "금" || !state.settings.elementColor ? "is-dark" : ""}`}>
            {state.settings.ganjiDisplay === "hangul" ? g(n.hanja) : n.hanja}
          </text>
          <text x={n.x} y={n.y + (n.y === SY ? 40 : -32)} textAnchor="middle" className="relmap__sub">{n.sub}</text>
        </g>
      ))}
      {allCols.map((c, i) => (
        <text key={c.k} x={70 + i * 100} y={(SY + BY) / 2 + 4} textAnchor="middle"
              className={`relmap__col ${c.k === "d" ? "is-accent" : ""}`}>{c.label}</text>
      ))}
    </svg>
  );
}

function Matrix({ data }: { data: AnalyzeResponse }) {
  const { g } = useFmt();
  const order = ["hs", "ds", "ms", "ys", "hb", "db", "mb", "yb"];
  const chars: Record<string, { hanja: string; el: string }> = {};
  for (const p of data.pillars) {
    if (!p) continue;
    chars[`${p.key}s`] = { hanja: p.stem.hanja, el: p.stem.element };
    chars[`${p.key}b`] = { hanja: p.branch.hanja, el: p.branch.element };
  }
  const ids = order.filter((o) => chars[o]);
  const its = data.scenarios[0].interactions.filter((i) => i.slots.length === 2);
  const cell = (a: string, b: string) => {
    const hits = its.filter((i) => i.slots.includes(a) && i.slots.includes(b));
    return hits.sort((x, y) => y.strength - x.strength)[0];
  };
  return (
    <div className="matrix" style={{ gridTemplateColumns: `28px repeat(${ids.length}, minmax(28px, 1fr))` }}>
      <span />
      {ids.map((id) => <span key={id} className="matrix__head"><Hanja text={chars[id].hanja} /></span>)}
      {ids.map((r, ri) => (
        <div key={r} className="matrix__row">
          <span className="matrix__head"><Hanja text={chars[r].hanja} /></span>
          {ids.map((c, ci) => {
            if (ci < ri) return <span key={c} className="matrix__cell is-empty" />;
            if (ci === ri) return <span key={c} className="matrix__cell is-diag" />;
            const it = cell(r, c);
            return (
              <span key={c} className="matrix__cell" title={it ? `${g(it.label)} ${it.strength}` : ""}
                    style={it ? { background: KIND_COLOR[it.kind], opacity: 0.35 + it.strength * 0.65, color: "#fff" } : undefined}>
                {it ? `.${String(Math.round(it.strength * 100)).padStart(2, "0")}` : ""}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function DynamicsTab({ data }: { data: AnalyzeResponse }) {
  const { g } = useFmt();
  const { state } = useApp();
  const [overlay, setOverlay] = useState(false);
  const [hidden, setHidden] = useState<Set<RelKind>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [luckSel, setLuckSel] = useState(() => currentLuckIndex(data));
  const sc = data.scenarios.find((s) => s.key === (overlay ? "sewoon" : "natal"))!;
  const its = sc.interactions;
  const sel = useMemo(() => its.find((i) => i.id === selected) ?? its[0], [its, selected]);
  const list = showAll ? its : its.slice(0, 6);
  const sewoonYear = data.luck.sewoon.find((s) => s.current);

  return (
    <div className="stack">
      <ElementShift data={data} />
      <Card title="합충형파해 역동 맵" subtitle="선 굵기 = 작용 강도 · 점선 = 원격/불완전 작용 · 클릭 시 상세"
            actions={
              <div className="map-actions">
                {KINDS.map((k) => (
                  <button key={k} className={`chip chip--${{ 합: "hap", 충: "chung", 형: "hyung", 파: "pa", 해: "hae" }[k]} chip--btn ${hidden.has(k) ? "is-off" : ""}`}
                          onClick={() => setHidden((h) => { const n = new Set(h); if (n.has(k)) n.delete(k); else n.add(k); return n; })}>
                    ● {k} {sc.counts[k]}
                  </button>
                ))}
                <label className="toggle-label">
                  <Toggle checked={overlay} onChange={(v) => { setOverlay(v); setSelected(null); }} label="세운 겹치기" />
                  {sewoonYear ? `${sewoonYear.year} ${g(sewoonYear.ganji)}` : ""} 대운·세운 겹치기
                </label>
              </div>
            }>
        <div className="map-layout">
          <div className="map-canvas">
            <RelationMap data={data} interactions={its} selected={sel?.id ?? null} onSelect={setSelected} hidden={hidden} />
            {sel && (
              <div className="map-selected">
                <span className={`chip chip--${{ 합: "hap", 충: "chung", 형: "hyung", 파: "pa", 해: "hae" }[sel.kind]}`}>● 선택됨 · {sel.kind}</span>
                <div>
                  <b>{g(sel.label)}</b> <span className="muted small">{sel.positions}</span>
                  <div className="muted small">{fmtText(sel.desc, state.settings.ganjiDisplay)}</div>
                </div>
                <div className="map-selected__fx">{sel.effects.map((e) => <span key={e} className="mono small">{g(e)}</span>)}</div>
              </div>
            )}
          </div>
          <div className="map-list">
            <div className="map-list__head">
              <b>작용 상세 · 강도순</b>
              {its.length > 6 && <button className="link-btn" onClick={() => setShowAll((v) => !v)}>{showAll ? "접기" : `모두 보기 (${its.length}) →`}</button>}
            </div>
            {its.length === 0 && <p className="muted">뚜렷한 작용이 없습니다.</p>}
            {list.map((it) => (
              <button key={it.id} className={`rel-item ${sel?.id === it.id ? "is-selected" : ""} rel-item--${it.kind}`} onClick={() => setSelected(it.id)}>
                <div className="rel-item__top">
                  <KindDot kind={it.kind} />
                  <b className="serif">{g(it.chars.join(it.kind === "합" ? " + " : it.slots.length === 3 ? " · " : " ↔ "))}</b>
                  <span className="muted small">{it.positions}{it.note ? ` · ${it.note}` : ""}</span>
                  <span className="mono rel-item__val">{it.strength.toFixed(2)}</span>
                </div>
                <div className="rel-item__bottom">
                  <span className="muted small">{fmtText(it.desc, state.settings.ganjiDisplay)}</span>
                  <span className="rel-item__bar"><span style={{ width: `${it.strength * 100}%`, background: KIND_COLOR[it.kind] }} /></span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </Card>
      <div className="grid-2 grid-2--even">
        <Card title="작용 강도 매트릭스" subtitle="글자 쌍별 지배 작용 · 색 농도 = 강도">
          <Matrix data={data} />
          <div className="legend">{KINDS.map((k) => <KindDot key={k} kind={k} />)}</div>
        </Card>
        <Card title="대운별 작용 강도 흐름" subtitle={`원국 × 대운 중첩 시 합충형파해 총량 · ${data.luck.forward ? "순행" : "역행"} · 대운수 ${data.luck.start_label} · 막대를 누르면 상세`}>
          <LuckStrengthFlow data={data} selected={luckSel} onSelect={setLuckSel} />
        </Card>
      </div>
    </div>
  );
}
