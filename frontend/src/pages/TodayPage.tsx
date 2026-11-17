import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { Topbar } from "../components/Topbar";
import { ChartForm } from "../components/ChartForm";
import { useNow } from "../components/Sidebar";
import { Card, Chip, ErrorBox, Hanja, Loading, Segmented, useFmt } from "../components/ui";
import { useApp } from "../store/AppState";
import { navigate } from "../router";
import { PLACES } from "../lib/places";
import {
  ELEMENT_CLASS, TERM_HANJA, elementPairLabel, hm, mdDot, pad2, weekdayKo, yearNickname, ymd,
} from "../lib/ganji";
import type { CalendarResponse, Char, DayCell, SearchResponse } from "../types";

function ElementDots({ a, b }: { a: Char; b: Char }) {
  return (
    <span className="el-chip">
      <span className={`dot bg-${ELEMENT_CLASS[a.element]}`} />
      <span className={`dot bg-${ELEMENT_CLASS[b.element]}`} />
      {elementPairLabel(a.element, b.element)}
    </span>
  );
}

function PillarCard({ label, ganji, suffix, stem, branch, sub }: {
  label: string; ganji: string; suffix: string; stem: Char; branch: Char; sub: string;
}) {
  return (
    <div className="card pillar-card">
      <div className="pillar-card__head">
        <span className="muted">{label}</span>
        <ElementDots a={stem} b={branch} />
      </div>
      <div className="pillar-card__ganji"><Hanja text={ganji} /><span className="pillar-card__suffix">{suffix}</span></div>
      <div className="pillar-card__sub">{sub}</div>
    </div>
  );
}

function parseDateQuery(q: string): { y: number; m: number; d?: number } | null {
  const m = /^(\d{4})[.\-/년\s]*(\d{1,2})(?:[.\-/월\s]*(\d{1,2}))?/.exec(q.trim());
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: m[3] ? Number(m[3]) : undefined };
}

export function TodayPage() {
  const now = useNow();
  const { g } = useFmt();
  const { addChart, setNewChartOpen, openTemp, state } = useApp();
  const place = PLACES.find((p) => p.name === state.settings.defaultPlace) ?? PLACES[0];
  const today = new Date();
  const [view, setView] = useState<"month" | "week" | "year">("month");
  const [ym, setYm] = useState({ y: today.getFullYear(), m: today.getMonth() + 1 });
  const [selected, setSelected] = useState(ymd(today));
  const [cal, setCal] = useState<CalendarResponse | null>(null);
  const [nextCal, setNextCal] = useState<CalendarResponse | null>(null);
  const [prevCal, setPrevCal] = useState<CalendarResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchResponse | null>(null);
  const [searchErr, setSearchErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setErr(null);
    const prev = ym.m === 1 ? { y: ym.y - 1, m: 12 } : { y: ym.y, m: ym.m - 1 };
    const next = ym.m === 12 ? { y: ym.y + 1, m: 1 } : { y: ym.y, m: ym.m + 1 };
    api.calendar(ym.y, ym.m).then((c) => alive && setCal(c), (e: Error) => alive && setErr(e.message));
    if (next.y <= 2100) api.calendar(next.y, next.m).then((c) => alive && setNextCal(c), () => alive && setNextCal(null));
    if (prev.y >= 1900) api.calendar(prev.y, prev.m).then((c) => alive && setPrevCal(c), () => alive && setPrevCal(null));
    return () => {
      alive = false;
    };
  }, [ym.y, ym.m]);

  const cells = useMemo(() => {
    if (!cal) return [];
    const first = new Date(`${cal.days[0].date}T00:00:00`);
    const lead = first.getDay(); // 일요일 시작
    const before = (prevCal?.days ?? []).slice(-lead).map((d) => ({ d, out: true }));
    const cur = cal.days.map((d) => ({ d, out: false }));
    const total = Math.ceil((lead + cur.length) / 7) * 7;
    const after = (nextCal?.days ?? []).slice(0, total - lead - cur.length).map((d) => ({ d, out: true }));
    return [...(before.length === lead ? before : Array.from({ length: lead }, () => null)), ...cur, ...after];
  }, [cal, prevCal, nextCal]);

  const weekCells = useMemo(() => {
    const idx = cells.findIndex((c) => c?.d.date === selected);
    const start = Math.max(0, Math.floor((idx < 0 ? 0 : idx) / 7) * 7);
    return cells.slice(start, start + 7);
  }, [cells, selected]);

  function move(delta: number) {
    if (view === "year") return setYm((v) => ({ y: Math.min(2100, Math.max(1900, v.y + delta)), m: v.m }));
    if (view === "week") {
      const d = new Date(`${selected}T00:00:00`);
      d.setDate(d.getDate() + 7 * delta);
      setSelected(ymd(d));
      setYm({ y: d.getFullYear(), m: d.getMonth() + 1 });
      return;
    }
    setYm((v) => {
      const m = v.m + delta;
      const y = v.y + Math.floor((m - 1) / 12);
      const mm = ((m - 1) % 12 + 12) % 12 + 1;
      return y < 1900 || y > 2100 ? v : { y, m: mm };
    });
  }

  /** 저장하지 않는 임시 명식으로 바로 분석 화면 열기 */
  function openTempAt(date: string, time: string | null, name: string) {
    openTemp({
      name, gender: "M", calendar: "solar", date, time, isLeap: false,
      placeName: place.name, longitude: state.settings.solarTime ? place.longitude : null,
    });
    navigate({ page: "analysis", tab: "summary" });
  }

  function openTodayChart() {
    // KST 현재 시각 (브라우저 시간대와 무관)
    const kst = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }); // "2026-11-17 16:12:33"
    const date = kst.slice(0, 10), time = kst.slice(11, 16);
    openTempAt(date, time, `오늘 명식 · ${date.replaceAll("-", ".")} ${time}`);
  }

  function openHour(start: string, branchHanja: string) {
    // 시진 시작 + 60분 = 시진 한가운데 (보정 오차와 무관하게 해당 시주가 나오도록)
    const [h, m] = start.split(":").map(Number);
    const mid = (h * 60 + m + 60) % 1440;
    const date = now?.now.slice(0, 10) ?? ymd(today);
    openTempAt(date, `${pad2(Math.floor(mid / 60))}:${pad2(mid % 60)}`, `${date.replaceAll("-", ".")} ${branchHanja}時 원국`);
  }

  function jumpTo(date: string) {
    setSelected(date);
    setYm({ y: Number(date.slice(0, 4)), m: Number(date.slice(5, 7)) });
    setHits(null);
    if (view === "year") setView("month");
  }

  async function runSearch() {
    setSearchErr(null);
    const dq = parseDateQuery(q);
    if (dq) {
      if (dq.y < 1900 || dq.y > 2100 || dq.m < 1 || dq.m > 12) return setSearchErr("1900~2100년 범위의 날짜를 입력하세요");
      return jumpTo(`${dq.y}-${pad2(dq.m)}-${pad2(dq.d ?? 1)}`);
    }
    try {
      setHits(await api.search(q.trim(), selected));
    } catch (e) {
      setSearchErr((e as Error).message);
    }
  }

  const monthSub = cal ? (
    <>
      {g(cal.year_ganji)}년 · {cal.month_pillars.map((m, i) => (
        <span key={m.ganji}>{i > 0 && " → "}<Hanja text={m.ganji} colored={false} />月</span>
      ))}
      {cal.month_pillars[1] && ` (${mdDot(cal.month_pillars[1].start)} ${cal.month_pillars[1].jeol_name})`}
    </>
  ) : null;

  const todayStr = ymd(today);

  const renderCell = (c: { d: DayCell; out: boolean } | null, i: number) => {
    if (!c) return <div key={`e${i}`} className="day day--empty" />;
    const { d, out } = c;
    const dt = new Date(`${d.date}T00:00:00`);
    const dow = dt.getDay();
    const isToday = d.date === todayStr;
    const lunarFirst = d.lunar?.day === 1;
    return (
      <button key={d.date} className={`day ${out ? "day--out" : ""} ${isToday ? "day--today" : ""} ${d.date === selected ? "is-selected" : ""}`}
              title="클릭하면 이 날의 원국을 바로 분석 (저장 안 함)"
              onClick={() => { setSelected(d.date); openTempAt(d.date, null, `${d.date.replaceAll("-", ".")} ${d.ganji}日 원국 (시각 모름)`); }}>
        <span className="day__top">
          <span className={`day__num ${dow === 0 ? "is-sun" : dow === 6 ? "is-sat" : ""}`}>{dt.getDate()}</span>
          {d.lunar && (
            <span className={`day__lunar ${lunarFirst ? "is-first" : ""}`}>
              {lunarFirst ? `음 ${d.lunar.month}.1` : `${d.lunar.month}.${d.lunar.day}`}{d.lunar.is_leap ? "閏" : ""}
            </span>
          )}
        </span>
        <span className="day__ganji"><Hanja text={d.ganji} colored={!out} /></span>
        {d.terms.map((t) => (
          <span key={t.name} className={`term-badge ${t.is_jeol ? "" : "term-badge--mid"}`}>{t.name} {TERM_HANJA[t.name]}</span>
        ))}
        {isToday && <span className="today-pill">오늘</span>}
      </button>
    );
  };

  return (
    <div className="page">
      <Topbar crumbs={["만세력", `${ym.y}년 ${ym.m}월`]} title="오늘의 만세력">
        <div className="search search--wide" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setHits(null)}>
          <span className="search__icon">⌕</span>
          <input className="search__input" value={q} placeholder="날짜 · 간지로 검색 (예: 甲子日)"
                 onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && q.trim() && runSearch()} />
          {(hits || searchErr) && (
            <div className="search__pop">
              {searchErr && <div className="search__empty">{searchErr}</div>}
              {hits && <div className="search__head">{g(hits.query)} · {{ day: "일진", month: "월건", year: "세운" }[hits.kind]} 검색 결과</div>}
              {hits?.hits.map((h) => (
                <button key={h.date} className="search__hit" onClick={() => jumpTo(h.date)}>
                  <Hanja text={h.ganji} /><span className="muted">{h.date.replaceAll("-", ".")}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="btn btn--ghost" onClick={() => { jumpTo(todayStr); }}>오늘로 이동</button>
        <button className="btn btn--ghost" onClick={openTodayChart} title="지금 이 시각의 원국을 저장하지 않고 분석">◎ 오늘 명식 열기</button>
        <button className="btn btn--primary" onClick={() => setNewChartOpen(true)}>＋ 새 명식</button>
      </Topbar>

      <div className="grid-4">
        {now ? (
          <>
            <PillarCard label={`세운 · ${now.now.slice(0, 4)}`} ganji={now.year.ganji} suffix="年"
                        stem={now.year.stem} branch={now.year.branch} sub={yearNickname(now.year.ganji)} />
            <PillarCard label={`월건 · ${now.month_jeol.name} 이후`} ganji={now.month.ganji} suffix="月"
                        stem={now.month.stem} branch={now.month.branch}
                        sub={`${mdDot(now.month_jeol.time)} ${now.month_jeol.name} ~ ${mdDot(now.next_month_jeol.time)} ${now.next_month_jeol.name}`} />
            <PillarCard label={`오늘 일진 · ${mdDot(now.now)} (${weekdayKo(today)})`} ganji={now.day.ganji} suffix="日"
                        stem={now.day.stem} branch={now.day.branch}
                        sub={now.lunar ? `음력 ${now.lunar.month}.${now.lunar.day}${now.lunar.is_leap ? " (윤)" : ""}` : ""} />
            <PillarCard label={`현재 시진 · ${hm(now.now)}`} ganji={now.hour.ganji} suffix="時"
                        stem={now.hour.stem} branch={now.hour.branch}
                        sub={(() => {
                          const h = now.hours.find((x) => x.current);
                          return h ? `${h.start} – ${h.end} (KST 보정 ${now.correction_minutes}분)` : "";
                        })()} />
          </>
        ) : (
          [0, 1, 2, 3].map((i) => <div key={i} className="card pillar-card skeleton" />)
        )}
      </div>

      <div className="today-layout">
        <Card className="calendar-card"
              title={view === "year" ? `${ym.y}년 월건` : `${ym.y}년 ${ym.m}월`}
              subtitle={monthSub}
              actions={
                <>
                  <button className="icon-btn" aria-label="이전" onClick={() => move(-1)}>‹</button>
                  <button className="icon-btn" aria-label="다음" onClick={() => move(1)}>›</button>
                  <Segmented size="sm" value={view} onChange={setView}
                             options={[{ value: "month", label: "월" }, { value: "week", label: "주" }, { value: "year", label: "년" }]} />
                </>
              }>
          {err && <ErrorBox message={err} />}
          {!cal && !err && <Loading />}
          {cal && view !== "year" && (
            <>
              <div className="cal-head">
                {["일", "월", "화", "수", "목", "금", "토"].map((w, i) => (
                  <span key={w} className={i === 0 ? "is-sun" : i === 6 ? "is-sat" : ""}>{w}</span>
                ))}
              </div>
              <div className={`cal-grid ${view === "week" ? "cal-grid--week" : ""}`}>
                {(view === "week" ? weekCells : cells).map(renderCell)}
              </div>
            </>
          )}
          {cal && view === "year" && (
            <div className="year-grid">
              {cal.year_flow.map((m) => {
                const mm = Number(m.start.slice(5, 7));
                const yy = Number(m.start.slice(0, 4));
                return (
                  <button key={m.start} className="year-cell" onClick={() => { setYm({ y: yy, m: mm }); setView("month"); }}>
                    <Hanja text={m.ganji} className="year-cell__ganji" />月
                    <span className="muted">{m.jeol_name} · {yy !== ym.y ? `${yy}.` : ""}{mdDot(m.start)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        <div className="today-side">
          <Card title="명식 열기" subtitle="생년월일시로 원국을 바로 계산">
            <ChartForm onSubmit={(d) => { addChart(d); navigate({ page: "analysis", tab: "summary" }); }} />
          </Card>
          <Card title="오늘의 시주"
                subtitle={now ? <><Hanja text={now.day.ganji[0]} colored={false} />日 기준 · 오서둔(五鼠遁) · 클릭하면 그 시각 원국 분석</> : ""}>
            {!now ? <Loading /> : (
              <div className="hour-grid">
                {now.hours.map((h) => (
                  <button key={h.ganji} className={`hour ${h.current ? "is-current" : ""}`}
                          title="클릭하면 오늘 이 시진의 원국을 바로 분석 (저장 안 함)"
                          onClick={() => openHour(h.start, h.branch.hanja)}>
                    <span className="hour__ganji"><Hanja text={h.ganji} colored={!h.current} /></span>
                    <span className="hour__label">{g(h.branch.hanja)}時</span>
                    <span className="hour__time">{h.start}~</span>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <Card title={`${cal?.year_flow[0]?.start.slice(0, 4) ?? ym.y} 절기 · 월건 흐름`}
            subtitle="12절(節) 기준 월주 교체 시점 · 날짜는 KST 기준">
        {cal ? (
          <div className="flow-row">
            {cal.year_flow.map((m) => {
              const active = now?.month.ganji === m.ganji && now.month_jeol.time.slice(0, 10) === m.start.slice(0, 10);
              return (
                <button key={m.start} className={`flow-cell ${active ? "is-active" : ""}`}
                        onClick={() => { setYm({ y: Number(m.start.slice(0, 4)), m: Number(m.start.slice(5, 7)) }); setView("month"); }}>
                  <span className="flow-cell__bar" />
                  <span className="flow-cell__ganji"><Hanja text={m.ganji} colored={!active} />月</span>
                  <span className="flow-cell__sub">{m.jeol_name} · {mdDot(m.start)}</span>
                </button>
              );
            })}
          </div>
        ) : <Loading />}
      </Card>
      {cal && <p className="footnote">절입 시각은 천문 계산식(VSOP87 축약) 기준이며 오차는 1~2분 이내입니다. <Chip>KST</Chip></p>}
    </div>
  );
}
