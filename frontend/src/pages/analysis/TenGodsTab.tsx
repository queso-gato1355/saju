import { useState } from "react";
import { Card, Chip, ElementGlyph, GlyphTile, Hanja, useFmt } from "../../components/ui";
import { useApp } from "../../store/AppState";
import { ELEMENT_CLASS, fmtText } from "../../lib/ganji";
import type { AnalyzeResponse, ContribOut, ScenarioKey } from "../../types";
import { ScenarioSwitch } from "./DynamicsTab";

const GROUP_ORDER = ["비겁", "식상", "재성", "관성", "인성"];
const GROUP_MEMBERS: Record<string, [string, string]> = {
  비겁: ["비견", "겁재"], 식상: ["식신", "상관"], 재성: ["편재", "정재"], 관성: ["편관", "정관"], 인성: ["편인", "정인"],
};
const PALACE = { h: "자녀 · 말년", d: "본인 · 배우자", m: "부모 · 사회", y: "조상 · 초년" } as const;

function TenGodChart({ data }: { data: AnalyzeResponse }) {
  const [sc, setSc] = useState<ScenarioKey>("natal");
  const { tg } = useFmt();
  const { state } = useApp();
  const s = data.scenarios.find((x) => x.key === sc)!;
  const byTg = Object.fromEntries(s.ten_gods.map((t) => [t.ten_god, t]));
  const groupEl = Object.fromEntries(s.groups.map((g) => [g.group, g.element]));
  const max = Math.max(10, ...s.ten_gods.flatMap((t) => [t.after_pct, t.static_pct]));
  return (
    <Card title="십성 세력 분포" subtitle="회색 = 원국 정적 · 컬러 = 합충형파해 작용 반영 후 (%)"
          actions={<ScenarioSwitch value={sc} onChange={setSc} />}>
      <div className="tg-layout">
        <div className="tg-chart">
          {GROUP_ORDER.map((g) => {
            const el = groupEl[g];
            const color = state.settings.elementColor ? `var(--element-${ELEMENT_CLASS[el]})` : "var(--text-muted)";
            return (
              <div key={g} className="tg-group" style={{ borderColor: color }}>
                <div className="tg-group__bars">
                  {GROUP_MEMBERS[g].map((t) => {
                    const row = byTg[t];
                    const d = Math.round(row.after_pct - row.static_pct);
                    return (
                      <div key={t} className="tg-bar">
                        <span className="mono tg-bar__val">{Math.round(row.after_pct)}</span>
                        <div className="tg-bar__cols">
                          <span className="tg-bar__static" style={{ height: `${(row.static_pct / max) * 160}px` }} />
                          <span className="tg-bar__after" style={{ height: `${(row.after_pct / max) * 160}px`, background: color }} />
                        </div>
                        <span className="tg-bar__name">{tg(t)}</span>
                        <span className={`mono small ${d > 0 ? "fg-up" : d < 0 ? "fg-down" : "muted"}`}>{d > 0 ? `+${d}` : d === 0 ? "±0" : d}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="tg-group__label">{g} <ElementGlyph el={el} /></div>
              </div>
            );
          })}
        </div>
        <div className="tg-groups">
          <b className="small">육친 그룹 합계</b>
          {s.groups.map((g) => (
            <div key={g.group} className="tg-sum">
              <div className="tg-sum__head">
                <b>{g.group}</b><span className="muted small">{g.note}</span>
                <span className="mono small">{Math.round(g.static_pct)}→{Math.round(g.after_pct)}</span>
              </div>
              <div className="bar"><div className="bar__fill" style={{
                width: `${g.after_pct}%`,
                background: state.settings.elementColor ? `var(--element-${ELEMENT_CLASS[g.element]})` : "var(--text-muted)",
              }} /></div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function Palace({ data }: { data: AnalyzeResponse }) {
  const { tg, g } = useFmt();
  const cols = (["h", "d", "m", "y"] as const).map((k, i) => ({ k, p: data.pillars[i] }));
  const day = data.pillars[1]!;
  const month = data.pillars[2]!;
  return (
    <Card title="궁위별 십성 배치" subtitle="어느 자리에 어떤 십성이 앉아 있는가">
      <div className="palace">
        {cols.map(({ k, p }) => (
          <div key={k} className="palace__col">
            <b className={k === "d" ? "fg-accent" : ""}>{{ h: "시주", d: "일주", m: "월주", y: "년주" }[k]}</b>
            <span className="muted small">{PALACE[k]}</span>
            {p ? (
              <>
                <div className={`palace__cell tint-${ELEMENT_CLASS[p.stem.element]}`}>
                  <b>{tg(p.stem.ten_god)}</b><Hanja text={p.stem.hanja} />
                </div>
                <div className={`palace__cell tint-${ELEMENT_CLASS[p.branch.element]}`}>
                  <b>{tg(p.branch.ten_god)}</b><Hanja text={p.branch.hanja} />
                </div>
              </>
            ) : <div className="palace__cell palace__cell--unknown">시각 모름</div>}
          </div>
        ))}
      </div>
      <p className="note">
        일지(배우자궁)에 {tg(day.branch.ten_god)} {g(day.branch.hanja)} · 월주(사회궁)에 {tg(month.stem.ten_god)} {g(month.stem.hanja)} + {tg(month.branch.ten_god)} {g(month.branch.hanja)}
        {" "}— 사회적 자리에서 {month.stem.ten_god.slice(-1) === month.branch.ten_god.slice(-1) ? `${month.stem.ten_god} 성향이 겹쳐 강하게` : "두 십성이 함께"} 작동합니다.
      </p>
    </Card>
  );
}

const CONTRIB_LABEL: Record<ContribOut["kind"], string> = {
  stem: "천간 투출", main: "지지 본기", hidden: "지장간", plus: "작용 보정 +", minus: "작용 보정 −",
};

function Contribution({ data }: { data: AnalyzeResponse }) {
  const { tg, g } = useFmt();
  const { state } = useApp();
  const s = data.scenarios[0];
  const top = [...s.ten_gods].sort((a, b) => b.after_pct - a.after_pct).slice(0, 4);
  const scale = Math.max(...top.map((t) => t.contrib.filter((c) => c.value > 0).reduce((a, c) => a + c.value, 0)), 1);
  return (
    <Card title="세력 기여도 분해" subtitle="상위 십성의 점수가 어디서 나오는가 · 가중치는 설정 > 작용·세력 계산">
      <div className="legend">
        {(Object.keys(CONTRIB_LABEL) as ContribOut["kind"][]).map((k) => (
          <span key={k} className="legend__item"><span className={`legend__swatch contrib--${k}`} />{CONTRIB_LABEL[k]}</span>
        ))}
      </div>
      <div className="contrib">
        {top.map((t) => {
          const minus = t.contrib.filter((c) => c.kind === "minus");
          const biggest = [...t.contrib].sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
            .find((c) => c.kind === "plus" || c.kind === "minus");
          return (
            <div key={t.ten_god} className="contrib__row">
              <div className="contrib__name"><b>{tg(t.ten_god)}</b><span className="muted small">{Math.round(t.after_pct)}%</span></div>
              <div className="contrib__bar">
                {t.contrib.filter((c) => c.kind !== "minus").map((c, i) => (
                  <span key={i} className={`contrib__seg contrib--${c.kind}`} style={{ flexBasis: `${(c.value / scale) * 100}%` }}
                        title={`${g(c.label)} ${c.value}`}>{g(c.label)}</span>
                ))}
                {minus.map((c, i) => (
                  <span key={`m${i}`} className="contrib__seg contrib--minus" style={{ flexBasis: `${(-c.value / scale) * 100}%` }}
                        title={`${g(c.label)} ${c.value}`}>{g(c.label)}</span>
                ))}
              </div>
              <span className="muted small contrib__note">
                {biggest ? fmtText(`${biggest.label} ${biggest.kind === "plus" ? "합화로 보강" : "작용으로 손상"} (${biggest.value > 0 ? "+" : ""}${biggest.value})`, state.settings.ganjiDisplay) : "작용 영향 적음"}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

const LEVEL_TONE = { 강: "hap", 보통: "neutral", 약: "hyung", "매우 약": "chung" } as const;
const LEVEL_COLOR = { 강: "var(--relation-hap)", 보통: "var(--text-muted)", 약: "var(--relation-hyung)", "매우 약": "var(--relation-chung)" } as const;
const SEASON_HANJA = { 왕: "旺", 상: "相", 휴: "休", 수: "囚", 사: "死" } as const;
const ROLE_ORDER = { 천간: 0, 정기: 1, 중기: 2, 여기: 3 } as const;

function SlotPowerCard({ data }: { data: AnalyzeResponse }) {
  const { tg, g } = useFmt();
  const sp = data.slot_power;
  const order = ["hb", "db", "mb", "yb"];
  const branches = order.map((id) => sp.find((x) => x.id === id)).filter(Boolean) as typeof sp;
  const stemOf = (bid: string) => sp.find((x) => x.id === bid[0] + "s");

  // 십성 → 놓인 자리들 (서식화만: 백엔드가 계산한 자리별 세력을 십성 기준으로 묶어 보여줌)
  const byGod = new Map<string, { where: string; hanja: string; role: string; power: number; level: string }[]>();
  for (const slot of sp) {
    for (const t of slot.ten_gods) {
      if (t.ten_god === "일간") continue;
      const arr = byGod.get(t.ten_god) ?? [];
      arr.push({ where: slot.label, hanja: t.hanja, role: t.role, power: t.power, level: slot.level });
      byGod.set(t.ten_god, arr);
    }
  }
  const rows = [...byGod.entries()].map(([god, list]) => ({ god, list: list.sort((a, b) => b.power - a.power), total: list.reduce((a, x) => a + x.power, 0) }))
    .sort((a, b) => b.total - a.total);
  const maxTotal = Math.max(...rows.map((r) => r.total), 1);

  return (
    <Card title="십성이 놓인 자리 · 지지 강약"
          subtitle="지수 100 = 보통 · 월령 대비 왕상휴수사 × 합충형파해 작용 후 잔존율 · 천간은 아래 지지에 뿌리를 둡니다">
      <div className="injong">
        {branches.map((b) => {
          const st = stemOf(b.id);
          return (
            <div key={b.id} className={`injong__col injong__col--${b.level === "매우 약" ? "weak" : b.level === "강" ? "strong" : "mid"}`}>
              <div className="injong__head">
                <b>{b.label}</b>
                <Chip tone={LEVEL_TONE[b.level]}>{b.level}</Chip>
              </div>
              {st && (
                <div className="injong__stem" title="이 지지 위에 앉은 천간">
                  <GlyphTile hanja={st.hanja} element={st.element} size="sm" />
                  <span className="small">{st.ten_gods[0].ten_god === "일간" ? "일간" : tg(st.ten_gods[0].ten_god)}</span>
                  <span className="mono small muted">{st.score}</span>
                </div>
              )}
              <div className="injong__branch">
                <GlyphTile hanja={b.hanja} element={b.element} size="md" />
                <div className="injong__score">
                  <span className="mono injong__num">{b.score}</span>
                  <div className="injong__gauge"><span style={{ width: `${Math.min(100, (b.score / 150) * 100)}%`, background: LEVEL_COLOR[b.level] }} /><i style={{ left: `${(100 / 150) * 100}%` }} /></div>
                  <span className="muted small">월령 {b.season}({SEASON_HANJA[b.season]}) ×{b.season_factor} · 작용 ×{b.interaction_factor}</span>
                </div>
              </div>
              <div className="injong__gods">
                {[...b.ten_gods].sort((x, y) => ROLE_ORDER[x.role] - ROLE_ORDER[y.role]).map((t) => (
                  <div key={t.role} className="injong__god">
                    <span className="muted small">{t.role}</span>
                    <Hanja text={t.hanja} className="serif" />
                    <b className="small">{tg(t.ten_god)}</b>
                    <span className="injong__bar"><span style={{ width: `${Math.min(100, t.power)}%` }} /></span>
                    <span className="mono small">{Math.round(t.power)}</span>
                  </div>
                ))}
              </div>
              {b.causes.length > 0 && (
                <ul className="injong__causes">
                  {b.causes.slice(0, 3).map((c) => <li key={c}>{g(c)}</li>)}
                  {b.causes.length > 3 && <li className="muted">외 {b.causes.length - 3}건</li>}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <div className="injong-table">
        <b className="small">십성별 위치 · 세력 (강한 순)</b>
        {rows.map((r) => (
          <div key={r.god} className="injong-row">
            <b>{tg(r.god)}</b>
            <span className="injong-row__bar"><span style={{ width: `${(r.total / maxTotal) * 100}%` }} /></span>
            <div className="injong-row__where">
              {r.list.map((w, i) => (
                <span key={i} className={`where-chip where-chip--${w.level === "매우 약" ? "weak" : w.level === "강" ? "strong" : "mid"}`}>
                  {w.where} <Hanja text={w.hanja} /> {w.role !== "천간" ? w.role : ""} <span className="mono">{Math.round(w.power)}</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="footnote">지장간 세력 = 지지 지수 × 일수 비율(여기·중기·정기). 지지가 충·형으로 약해지면 그 안의 십성도 함께 약해집니다. 일간 자신은 제외.</p>
    </Card>
  );
}

function MeaningCard({ data }: { data: AnalyzeResponse }) {
  const { tg } = useFmt();
  const natal = data.scenarios[0];
  const pct = Object.fromEntries(natal.ten_gods.map((t) => [t.ten_god, t.after_pct]));
  const where = new Map<string, string[]>();
  for (const slot of data.slot_power) for (const t of slot.ten_gods) {
    if (t.ten_god === "일간") continue;
    where.set(t.ten_god, [...(where.get(t.ten_god) ?? []), slot.label]);
  }
  const ranked = [...data.ten_god_meanings].sort((a, b) => (pct[b.ten_god] ?? 0) - (pct[a.ten_god] ?? 0));
  const top = new Set(ranked.slice(0, 3).map((m) => m.ten_god));
  const groupOf = Object.fromEntries(natal.ten_gods.map((t) => [t.ten_god, t.group]));
  return (
    <Card title="십성의 의미 · 육친론"
          subtitle={`${data.meta.gender === "M" ? "남명" : "여명"} 기준 육친 · 인생 영역 · 세력 % (작용 반영) · 상위 3개 강조 — 육친 배정은 학파에 따라 일부 다름`}>
      <div className="meanings">
        {ranked.map((m) => {
          const p = pct[m.ten_god] ?? 0;
          const absent = !where.has(m.ten_god);
          return (
            <div key={m.ten_god} className={`meaning ${top.has(m.ten_god) ? "is-top" : ""} ${absent ? "is-absent" : ""}`}>
              <div className="meaning__head">
                <b>{tg(m.ten_god)}</b><span className="serif muted small">{m.hanja}</span>
                <span className="muted small">{groupOf[m.ten_god]}</span>
                <span className="mono meaning__pct">{Math.round(p)}%</span>
              </div>
              <div className="meaning__row"><span className="meaning__k">육친</span><span>{m.yukchin}</span></div>
              <div className="meaning__row"><span className="meaning__k">영역</span><span>{m.domains}</span></div>
              <div className="meaning__row"><span className="meaning__k">강점</span><span>{m.strength_trait}</span></div>
              <div className="meaning__row"><span className="meaning__k">주의</span><span>{m.caution}</span></div>
              <div className="meaning__where small">{absent ? "원국에 없음 — 운에서 들어올 때 드러남" : `위치: ${[...new Set(where.get(m.ten_god))].join(" · ")}`}</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function TenGodsTab({ data }: { data: AnalyzeResponse }) {
  return (
    <div className="stack">
      <TenGodChart data={data} />
      <SlotPowerCard data={data} />
      <div className="grid-2">
        <Palace data={data} />
        <Contribution data={data} />
      </div>
      <MeaningCard data={data} />
    </div>
  );
}
