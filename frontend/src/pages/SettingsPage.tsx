import { useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../api";
import { Topbar } from "../components/Topbar";
import { Card, Chip, Segmented, Toggle } from "../components/ui";
import { chartRequest, useApp } from "../store/AppState";
import {
  CALC_KEYS, DEFAULT_SETTINGS, PRESETS, SETTING_LABELS, applyPreset, toCalcOptions, type Settings,
} from "../lib/settings";
import { PLACES } from "../lib/places";
import type { SavedChart } from "../lib/storage";
import type { AnalyzeResponse } from "../types";

// ───────── 설정 맵 ─────────
type NodeId = string;
const SET_NODES: { id: NodeId; label: string; card: string }[] = [
  { id: "display", label: "표기", card: "sec-display" },
  { id: "calendar", label: "역법 · 세수", card: "sec-calendar" },
  { id: "time", label: "시간 보정", card: "sec-time" },
  { id: "hidden", label: "지장간 · 12운성", card: "sec-hidden" },
  { id: "power", label: "작용 · 세력 계산", card: "sec-power" },
  { id: "sinsal", label: "신살 · 공망 · 대운", card: "sec-sinsal" },
];
const STEP_NODES = [
  { id: "pillars", label: "원국 8글자" }, { id: "hiddenStep", label: "지장간 · 사령" }, { id: "stages", label: "12운성" },
  { id: "rel", label: "합충형파해 강도" }, { id: "force", label: "오행 · 십성 세력" }, { id: "sinsalStep", label: "신살 · 공망" },
  { id: "luck", label: "대운 · 세운" },
];
const SCREEN_NODES = [
  { id: "today", label: "오늘의 만세력" }, { id: "summary", label: "원국 요약" }, { id: "dyn", label: "합충형파해 역동" },
  { id: "tg", label: "십성 세력" }, { id: "hiddenScr", label: "지장간 · 12운성" }, { id: "sinsalScr", label: "신살 · 공망" },
  { id: "prompt", label: "AI 프롬프트" },
];
const E1: Record<string, string[]> = {
  calendar: ["pillars", "luck"], time: ["pillars"], hidden: ["hiddenStep", "stages"],
  power: ["rel", "force"], sinsal: ["sinsalStep", "luck"], display: [],
};
const E2: Record<string, string[]> = {
  pillars: SCREEN_NODES.map((s) => s.id), hiddenStep: ["hiddenScr", "tg", "prompt"], stages: ["summary", "hiddenScr", "prompt"],
  rel: ["dyn", "summary", "prompt"], force: ["tg", "summary", "dyn", "prompt"], sinsalStep: ["sinsalScr", "prompt"], luck: ["dyn", "prompt"],
};
const KEY_GROUP: Partial<Record<keyof Settings, string>> = {
  ganjiDisplay: "display", tenGodDisplay: "display", elementColor: "display", termPrecision: "calendar",
  yearBoundary: "calendar", astroSource: "calendar", splitZi: "time", solarTime: "time", defaultPlace: "time",
  dstAuto: "time", equationOfTime: "time", hiddenTable: "hidden", showSiryeong: "hidden", yinMode: "hidden",
  stageBasis: "hidden", jwabeop: "power", injong: "power", hapCondition: "power", attenAdjacent: "power",
  attenOneGap: "power", attenFar: "power", allowBanhap: "power", injongAssume: "hidden", sinsalBasis: "sinsal", gongmangBasis: "sinsal",
  luckRounding: "sinsal", ageMode: "sinsal",
};

function SettingsMap({ selected, onSelect }: { selected: string; onSelect(id: string): void }) {
  const W = 640, H = 380;
  const xs = [20, 250, 470], nw = [150, 150, 150], nh = 26;
  const ys = (n: number, i: number) => 30 + i * ((H - 60) / (n - 1));
  const pos: Record<string, { x: number; y: number; col: number }> = {};
  SET_NODES.forEach((n, i) => (pos[n.id] = { x: xs[0], y: ys(SET_NODES.length, i), col: 0 }));
  STEP_NODES.forEach((n, i) => (pos[n.id] = { x: xs[1], y: ys(STEP_NODES.length, i), col: 1 }));
  SCREEN_NODES.forEach((n, i) => (pos[n.id] = { x: xs[2], y: ys(SCREEN_NODES.length, i), col: 2 }));
  const steps = selected === "display" ? [] : E1[selected] ?? [];
  const screens = new Set(selected === "display" ? SCREEN_NODES.map((s) => s.id) : steps.flatMap((s) => E2[s]));
  const hot = new Set([selected, ...steps, ...screens]);
  const edges: { a: string; b: string; on: boolean }[] = [];
  for (const [a, bs] of Object.entries(E1)) for (const b of bs) edges.push({ a, b, on: a === selected });
  for (const [a, bs] of Object.entries(E2)) for (const b of bs) edges.push({ a, b, on: steps.includes(a) });
  if (selected === "display") for (const s of SCREEN_NODES) edges.push({ a: "display", b: s.id, on: true });
  const curve = (a: string, b: string) => {
    const p = pos[a], q = pos[b];
    const x1 = p.x + nw[p.col], y1 = p.y + nh / 2, x2 = q.x, y2 = q.y + nh / 2;
    const mx = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
  };
  const all = [...SET_NODES, ...STEP_NODES, ...SCREEN_NODES];
  return (
    <svg className="smap" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="설정이 어떤 계산과 화면에 영향을 주는지">
      <text x={xs[0]} y={14} className="smap__head">설정</text>
      <text x={xs[1]} y={14} className="smap__head">계산 단계</text>
      <text x={xs[2]} y={14} className="smap__head">화면 · 출력</text>
      {edges.filter((e) => !e.on).map((e, i) => <path key={`o${i}`} d={curve(e.a, e.b)} className="smap__edge" />)}
      {edges.filter((e) => e.on).map((e, i) => <path key={`h${i}`} d={curve(e.a, e.b)} className="smap__edge is-on" />)}
      {all.map((n) => {
        const p = pos[n.id];
        const isSet = p.col === 0;
        return (
          <g key={n.id} transform={`translate(${p.x}, ${p.y})`} className={`smap__node ${hot.has(n.id) ? "is-hot" : ""} ${n.id === selected ? "is-selected" : ""} ${isSet ? "is-setting" : ""}`}
             onClick={isSet ? () => onSelect(n.id) : undefined}>
            <rect width={nw[p.col]} height={nh} rx={6} />
            <text x={10} y={17}>{n.label}</text>
          </g>
        );
      })}
      {selected === "display" && <text x={xs[0]} y={H - 4} className="smap__note">표기는 계산 없이 모든 화면에 적용</text>}
    </svg>
  );
}

// ───────── 변경 영향 미리보기 ─────────
const SAMPLE: SavedChart = {
  id: "sample", name: "예시 명식", gender: "M", calendar: "solar", date: "2004-02-21", time: "10:12", isLeap: false,
  placeName: "서울특별시", longitude: 126.98, color: "#7048e8", createdAt: 0, viewedAt: 0,
};

function diffResult(a: AnalyzeResponse, b: AnalyzeResponse): string[] {
  const out: string[] = [];
  const pa = a.pillars.map((p) => p?.ganji ?? "?"), pb = b.pillars.map((p) => p?.ganji ?? "?");
  const names = ["시주", "일주", "월주", "년주"];
  pa.forEach((g, i) => g !== pb[i] && out.push(`${names[i]} ${g} → ${pb[i]}`));
  if (a.strength.score !== b.strength.score) out.push(`신강도 ${a.strength.score} → ${b.strength.score}`);
  if (a.gyeok.name !== b.gyeok.name) out.push(`격국 ${a.gyeok.name} → ${b.gyeok.name}`);
  const ta = a.scenarios[0].total, tb = b.scenarios[0].total;
  if (Math.abs(ta - tb) > 0.005) out.push(`작용 총량 ${ta.toFixed(2)} → ${tb.toFixed(2)}`);
  const stg = (r: AnalyzeResponse) => r.pillars.map((p) => p?.branch.stage).join();
  const self = (r: AnalyzeResponse) => r.pillars.map((p) => `${p?.branch.stage_geo}${p?.branch.stage_jwa.map((j) => j.stage)}`).join();
  const inj = (r: AnalyzeResponse) => r.injong.map((x) => x.hanja + x.stage).join();
  if (inj(a) !== inj(b)) out.push("인종법 결과 변경");
  if (stg(a) !== stg(b)) out.push("12운성(봉법) 변경");
  if (self(a) !== self(b)) out.push("12운성(거법·좌법) 변경");
  if (a.luck.start_label !== b.luck.start_label || a.luck.pillars[0].age_label !== b.luck.pillars[0].age_label) {
    out.push(`대운수 ${a.luck.pillars[0].age_label} → ${b.luck.pillars[0].age_label}`);
  }
  const ma = a.sinsal.filter((s) => s.present).map((s) => s.name).join(), mb = b.sinsal.filter((s) => s.present).map((s) => s.name).join();
  if (ma !== mb) out.push("신살 목록 변경");
  if (a.meta.adjusted_time !== b.meta.adjusted_time) out.push(`보정 시각 ${a.meta.adjusted_time?.slice(11, 16)} → ${b.meta.adjusted_time?.slice(11, 16)}`);
  return out;
}

function fmtVal(k: keyof Settings, v: unknown): string {
  const map: Record<string, string> = {
    hanja: "한자", hangul: "한글", both: "병기/둘 다", short: "약어", minute: "분 단위", day: "일 단위/일지",
    eumpotae: "음포태", same: "음양동생", bong: "봉법", geo: "거법", strict: "엄격", normal: "보통", loose: "관대",
    year: "년지/년주", round: "반올림", floor: "버림", precise: "시간까지 정밀", man: "만 나이", korean: "세는 나이",
  };
  if (typeof v === "boolean") return v ? "켬" : "끔";
  if (typeof v === "number") return v.toFixed(2);
  if (k === "sinsalBasis" && v === "day") return "일지";
  if (k === "gongmangBasis" && v === "day") return "일주";
  return map[String(v)] ?? String(v);
}

function ImpactPreview({ saved, draft, chart }: { saved: Settings; draft: Settings; chart: SavedChart }) {
  const changed = (Object.keys(draft) as (keyof Settings)[]).filter((k) => k !== "preset" && draft[k] !== saved[k]);
  const [results, setResults] = useState<Record<string, { status: "loading" | "same" | "diff" | "display" | "error"; lines: string[] }>>({});
  const key = JSON.stringify([changed.map((k) => [k, draft[k]]), chart.id]);

  useEffect(() => {
    let alive = true;
    const placeLng = (s: Settings) => PLACES.find((p) => p.name === s.defaultPlace)?.longitude ?? null;
    const init: typeof results = {};
    for (const k of changed) init[k] = CALC_KEYS.includes(k) ? { status: "loading", lines: [] } : { status: "display", lines: [] };
    setResults(init);
    const calc = changed.filter((k) => CALC_KEYS.includes(k)).slice(0, 8);
    if (!calc.length) return;
    const base = api.analyze(chartRequest(chart, toCalcOptions(saved)));
    calc.forEach((k) => {
      const one = { ...saved, [k]: draft[k] } as Settings;
      const c = k === "defaultPlace" ? { ...chart, longitude: placeLng(one) } : chart;
      Promise.all([base, api.analyze(chartRequest(c, toCalcOptions(one)))]).then(([a, b]) => {
        if (!alive) return;
        const lines = diffResult(a, b);
        setResults((r) => ({ ...r, [k]: { status: lines.length ? "diff" : "same", lines } }));
      }, () => alive && setResults((r) => ({ ...r, [k]: { status: "error", lines: [] } })));
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <div className="impact">
      <b>변경 영향 미리보기 · {chart.name}</b>
      {changed.length === 0 && <p className="muted small">아직 바뀐 설정이 없습니다. 항목을 바꾸면 이 명식 기준으로 결과 차이를 보여줍니다.</p>}
      {changed.map((k) => {
        const r = results[k];
        return (
          <div key={k} className={`impact__item ${r?.status === "diff" ? "is-diff" : ""}`}>
            <div className="impact__head">
              <b>{SETTING_LABELS[k] ?? k} → {fmtVal(k, draft[k])}</b>
              <Chip tone={r?.status === "diff" ? "hyung" : "neutral"}>
                {{ loading: "계산 중", same: "영향 없음", diff: "결과 바뀜", display: "표시만 변경", error: "계산 실패" }[r?.status ?? "loading"]}
              </Chip>
            </div>
            {r?.lines.length ? <span className="muted small">{r.lines.join(" · ")}</span> : null}
          </div>
        );
      })}
    </div>
  );
}

// ───────── 폼 요소 ─────────
function RadioCards<T extends string>({ value, onChange, options }: {
  value: T; onChange(v: NoInfer<T>): void; options: { value: NoInfer<T>; label: string; desc?: string; disabled?: boolean }[];
}) {
  return (
    <div className="radio-cards" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o) => (
        <button key={o.value} className={`radio-card ${value === o.value ? "is-on" : ""}`} disabled={o.disabled}
                onClick={() => onChange(o.value)} aria-pressed={value === o.value}>
          <span className="radio-card__title"><span className="radio-dot" />{o.label}</span>
          {o.desc && <span className="radio-card__desc">{o.desc}</span>}
        </button>
      ))}
    </div>
  );
}

function Row({ title, desc, children, block }: { title: string; desc?: string; children: ReactNode; block?: boolean }) {
  return (
    <div className={`set-row ${block ? "set-row--block" : ""}`}>
      <div><b>{title}</b>{desc && <div className="muted small">{desc}</div>}</div>
      <div className="set-row__ctl">{children}</div>
    </div>
  );
}

function Section({ id, icon, title, desc, children, highlight }: {
  id: string; icon: string; title: string; desc: string; children: ReactNode; highlight?: boolean;
}) {
  return (
    <section id={id} className={`card set-sec ${highlight ? "is-highlight" : ""}`}>
      <header className="set-sec__head">
        <span className="set-sec__icon">{icon}</span>
        <div><h2 className="card__title">{title}</h2><p className="card__subtitle">{desc}</p></div>
      </header>
      {children}
    </section>
  );
}

function Slider({ value, onChange, label }: { value: number; onChange(v: number): void; label: string }) {
  return (
    <span className="slider">
      <input type="range" min={0} max={1} step={0.05} value={value} aria-label={label}
             onChange={(e) => onChange(Number(e.target.value))} />
      <span className="mono small">{value.toFixed(2)}</span>
    </span>
  );
}

export function SettingsPage() {
  const { state, saveSettings, activeChart } = useApp();
  const saved = state.settings;
  const [draft, setDraft] = useState<Settings>(saved);
  const [mapSel, setMapSel] = useState("time");
  const [q, setQ] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  useEffect(() => setDraft(saved), [saved]);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => {
    setDraft((d) => ({ ...d, [k]: v, preset: k in KEY_GROUP && ["hapCondition", "yinMode", "allowBanhap", "jwabeop", "injong"].includes(k) ? "custom" : d.preset }));
    const g = KEY_GROUP[k];
    if (g) setMapSel(g);
  };

  const matches = (title: string) => q.trim() !== "" && title.includes(q.trim());
  const sectionMatch = (keys: string[]) => keys.some(matches);
  useEffect(() => {
    if (!q.trim()) return;
    const el = document.querySelector(".set-sec.is-highlight");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [q]);

  const lngOf = (name: string) => PLACES.find((p) => p.name === name)?.longitude;
  const sel = SET_NODES.find((n) => n.id === mapSel);

  return (
    <div className="page">
      <Topbar crumbs={["환경 설정", "계산 규칙"]} title="설정">
        <div className="search">
          <span className="search__icon">⌕</span>
          <input className="search__input" value={q} placeholder="설정 항목 검색" onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="btn btn--ghost" onClick={() => setDraft({ ...DEFAULT_SETTINGS })}>기본값으로 초기화</button>
        <button className="btn btn--primary" disabled={!dirty} onClick={() => {
          saveSettings(draft);
          setFlash("저장되었습니다 · 이 브라우저에 적용");
          setTimeout(() => setFlash(null), 3000);
        }}>변경 사항 저장</button>
      </Topbar>
      {flash && <div className="banner banner--ok" role="status">{flash}</div>}
      {dirty && !flash && <div className="banner banner--info">저장하지 않은 변경 사항이 있습니다.</div>}

      <section className={`card set-sec ${sectionMatch(["학파", "프리셋"]) ? "is-highlight" : ""}`}>
        <header className="set-sec__head">
          <span className="set-sec__icon">派</span>
          <div><h2 className="card__title">학파 프리셋</h2><p className="card__subtitle">한 번에 여러 규칙을 바꿉니다 · 개별 항목을 바꾸면 "사용자 정의"로 전환</p></div>
        </header>
        <div className="presets">
          {PRESETS.map((p) => (
            <button key={p.id} className={`preset ${draft.preset === p.id ? "is-on" : ""}`} onClick={() => setDraft((d) => applyPreset(d, p.id))}>
              <b>{p.name} <small className="muted">{p.hanja}</small></b>
              <span className="muted small">{p.desc}</span>
              {saved.preset === p.id && <span className="pill pill--accent">사용 중</span>}
            </button>
          ))}
        </div>
      </section>

      <Card title="설정 맵" subtitle="어떤 설정이 어떤 계산과 화면을 바꾸는지 · 항목을 고르면 영향 경로가 강조됩니다"
            actions={sel && <span className="pill pill--accent">선택: {sel.label}</span>}>
        <div className="smap-layout">
          <div className="smap-wrap"><SettingsMap selected={mapSel} onSelect={setMapSel} /></div>
          <ImpactPreview saved={saved} draft={draft} chart={activeChart ?? SAMPLE} />
        </div>
      </Card>

      <div className="grid-2 grid-2--even settings-cols">
        <div className="stack">
          <Section id="sec-display" icon="表" title="표기" desc="화면 · 프롬프트에 글자를 어떻게 보여줄지" highlight={sectionMatch(["표기", "간지", "십성", "오행 색상"])}>
            <Row title="간지 표기" block>
              <RadioCards value={draft.ganjiDisplay} onChange={(v) => set("ganjiDisplay", v)} options={[
                { value: "hanja", label: "한자", desc: "甲子" }, { value: "hangul", label: "한글", desc: "갑자" }, { value: "both", label: "병기", desc: "甲子(갑자)" },
              ]} />
            </Row>
            <Row title="십성 표기" block>
              <RadioCards value={draft.tenGodDisplay} onChange={(v) => set("tenGodDisplay", v)} options={[
                { value: "hangul", label: "한글", desc: "편재" }, { value: "hanja", label: "한자", desc: "偏財" }, { value: "short", label: "약어", desc: "재" },
              ]} />
            </Row>
            <Row title="오행 색상 표시" desc="글자 타일 · 그래프에 오행 색 적용">
              <Toggle checked={draft.elementColor} onChange={(v) => set("elementColor", v)} label="오행 색상" />
            </Row>
          </Section>

          <Section id="sec-calendar" icon="曆" title="역법 · 세수" desc="연주 · 월주가 바뀌는 기준" highlight={sectionMatch(["역법", "세수", "절입", "천문"])}>
            <Row title="세수(歲首) 기준" desc="연주가 바뀌는 시점" block>
              <RadioCards value={draft.yearBoundary} onChange={(v) => set("yearBoundary", v)} options={[
                { value: "ipchun", label: "입춘세수", desc: "입춘 절입 시각에 연주 교체 (일반적)" },
                { value: "dongji", label: "동지세수", desc: "준비 중 — 학파 규칙 검증 후 제공", disabled: true },
              ]} />
            </Row>
            <Row title="절입 시각 정밀도" desc="절기 경계일 출생자의 월주 판정" block>
              <RadioCards value={draft.termPrecision} onChange={(v) => set("termPrecision", v)} options={[
                { value: "minute", label: "분 단위", desc: "천문 계산 절입 시각" }, { value: "day", label: "일 단위", desc: "절기 당일 0시 기준" },
              ]} />
            </Row>
            <Row title="천문 데이터" desc="절기 · 음력 변환 기준">
              <Segmented size="sm" value={draft.astroSource} onChange={(v) => set("astroSource", v)} options={[
                { value: "kasi", label: "KASI 역서", disabled: true, title: "준비 중" }, { value: "calc", label: "천문 계산식" },
              ]} />
            </Row>
          </Section>

          <Section id="sec-time" icon="時" title="시간 보정" desc="출생 시각을 시주로 바꾸는 규칙" highlight={sectionMatch(["시간", "야자시", "조자시", "진태양시", "서머타임", "균시차", "경도"])}>
            <Row title="야자시 · 조자시" desc="23:00~01:00 子시 처리 방식" block>
              <RadioCards value={draft.splitZi ? "split" : "merge"} onChange={(v) => set("splitZi", v === "split")} options={[
                { value: "split", label: "구분함", desc: "23~24시 야자시는 당일 일주 + 다음 날 子시 시간" },
                { value: "merge", label: "구분 안 함", desc: "23시부터 다음 날 일주로 넘김" },
              ]} />
              <div className="zi-bar">
                <span>亥시</span>
                <span className={draft.splitZi ? "is-on" : ""}>{draft.splitZi ? "야자시 · 당일" : "子시 · 익일"}</span>
                <span className="is-on">{draft.splitZi ? "조자시 · 익일" : "子시 · 익일"}</span>
                <span>丑시</span>
              </div>
            </Row>
            <Row title="진태양시 보정" desc="출생지 경도 기준으로 표준시와의 차이 보정">
              <select className="input input--sm" value={draft.defaultPlace} onChange={(e) => set("defaultPlace", e.target.value)} aria-label="기본 출생지">
                {PLACES.filter((p) => p.longitude != null).map((p) => <option key={p.name}>{p.name}</option>)}
              </select>
              <span className="mono small muted">{lngOf(draft.defaultPlace)?.toFixed(2)}°</span>
              <Toggle checked={draft.solarTime} onChange={(v) => set("solarTime", v)} label="진태양시 보정" />
            </Row>
            <Row title="서머타임 · 표준시 자동 보정" desc="1948~1960 · 1987~1988 서머타임, 1954~1961 UTC+8:30 시기 반영">
              <Toggle checked={draft.dstAuto} onChange={(v) => set("dstAuto", v)} label="서머타임 자동 보정" />
            </Row>
            <Row title="균시차 반영" desc="지구 공전 궤도에 따른 ±16분 보정 (진태양시 보정이 켜져 있을 때)">
              <Toggle checked={draft.equationOfTime} onChange={(v) => set("equationOfTime", v)} label="균시차" />
            </Row>
          </Section>
        </div>

        <div className="stack">
          <Section id="sec-hidden" icon="藏" title="지장간 · 12운성" desc="지지 속 천간과 운성 판정 규칙" highlight={sectionMatch(["지장간", "12운성", "사령", "운성", "음포태", "봉법", "좌법", "거법", "인종법"])}>
            <Row title="지장간 배분표" desc="여기 · 중기 · 정기 일수 출처" block>
              <RadioCards value={draft.hiddenTable} onChange={(v) => set("hiddenTable", v)} options={[
                { value: "japyeong", label: "자평진전식", desc: "寅 戊7 丙7 甲16" },
                { value: "yeonhae", label: "연해자평식", desc: "준비 중", disabled: true },
                { value: "custom", label: "사용자 정의", desc: "준비 중", disabled: true },
              ]} />
            </Row>
            <Row title="사령(司令) 계산" desc="절입 후 경과일로 당령 지장간 표시">
              <Toggle checked={draft.showSiryeong} onChange={(v) => set("showSiryeong", v)} label="사령 표시" />
            </Row>
            <Row title="12운성 음간 처리" block>
              <RadioCards value={draft.yinMode} onChange={(v) => set("yinMode", v)} options={[
                { value: "eumpotae", label: "음포태", desc: "음간은 역행" }, { value: "same", label: "음양동생", desc: "음간도 양간과 동일" },
              ]} />
            </Row>
            <Row title="원국표 운성 기준" desc="봉법: 일간 → 각 지지 · 거법: 각 기둥 천간 → 자기 지지 (좌법 · 인종법은 지장간·12운성 탭에 항상 표시)">
              <Segmented size="sm" value={draft.stageBasis} onChange={(v) => set("stageBasis", v)} options={[
                { value: "bong", label: "봉법" }, { value: "geo", label: "거법" }, { value: "both", label: "둘 다 표시" },
              ]} />
            </Row>
            <Row title="인종법 · 천간에 없는 십성" desc="일지와 음양을 맞춘 글자를 가정해 대입 (가정 글자는 통변하지 않는 학파도 많음)">
              <Toggle checked={draft.injongAssume} onChange={(v) => set("injongAssume", v)} label="인종법 가정" />
            </Row>
          </Section>

          <Section id="sec-power" icon="力" title="작용 · 세력 계산" desc="합충형파해와 십성 세력 산출 방식" highlight={sectionMatch(["작용", "세력", "합화", "감쇠", "반합", "종격"])}>
            <Row title="같은 기둥 천간 · 지지 상호 영향" desc="지지가 천간을 생하면 천간 세력 +10%, 극하면 −10%">
              <Toggle checked={draft.jwabeop} onChange={(v) => set("jwabeop", v)} label="좌법" />
            </Row>
            <Row title="종격(從格) 가능성 표시" desc="신강도가 극히 낮을 때 격국 카드에 종격 검토 안내">
              <Toggle checked={draft.injong} onChange={(v) => set("injong", v)} label="인종법" />
            </Row>
            <Row title="합화(合化) 성립 조건" block>
              <RadioCards value={draft.hapCondition} onChange={(v) => set("hapCondition", v)} options={[
                { value: "strict", label: "엄격", desc: "월령 득령 필수" }, { value: "normal", label: "보통", desc: "월령 또는 투간" },
                { value: "loose", label: "관대", desc: "합만 있으면 반영" },
              ]} />
            </Row>
            <Row title="거리 감쇠 · 인접"><Slider label="인접" value={draft.attenAdjacent} onChange={(v) => set("attenAdjacent", v)} /></Row>
            <Row title="거리 감쇠 · 1칸 떨어짐"><Slider label="1칸" value={draft.attenOneGap} onChange={(v) => set("attenOneGap", v)} /></Row>
            <Row title="거리 감쇠 · 원격"><Slider label="원격" value={draft.attenFar} onChange={(v) => set("attenFar", v)} /></Row>
            <Row title="반합 · 방합 인정" desc="삼합 · 방합의 두 글자만 있어도 반영">
              <Toggle checked={draft.allowBanhap} onChange={(v) => set("allowBanhap", v)} label="반합 인정" />
            </Row>
          </Section>

          <Section id="sec-sinsal" icon="運" title="신살 · 공망 · 대운" desc="부가 판정 기준" highlight={sectionMatch(["신살", "공망", "대운", "나이"])}>
            <Row title="신살 기준">
              <Segmented size="sm" value={draft.sinsalBasis} onChange={(v) => set("sinsalBasis", v)} options={[
                { value: "year", label: "년지" }, { value: "day", label: "일지" }, { value: "both", label: "둘 다" },
              ]} />
            </Row>
            <Row title="공망 기준">
              <Segmented size="sm" value={draft.gongmangBasis} onChange={(v) => set("gongmangBasis", v)} options={[
                { value: "day", label: "일주" }, { value: "year", label: "년주" }, { value: "both", label: "둘 다" },
              ]} />
            </Row>
            <Row title="대운수 계산" desc="3일 = 1년 환산 방식">
              <Segmented size="sm" value={draft.luckRounding} onChange={(v) => set("luckRounding", v)} options={[
                { value: "round", label: "반올림" }, { value: "floor", label: "버림" }, { value: "precise", label: "시간까지 정밀" },
              ]} />
            </Row>
            <Row title="나이 표기">
              <Segmented size="sm" value={draft.ageMode} onChange={(v) => set("ageMode", v)} options={[
                { value: "man", label: "만 나이" }, { value: "korean", label: "세는 나이" },
              ]} />
            </Row>
          </Section>
        </div>
      </div>
    </div>
  );
}
