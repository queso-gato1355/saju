import { useEffect, useState } from "react";
import indicator from "../assets/indicator.svg";
import { api } from "../api";
import { useApp } from "../store/AppState";
import { href, navigate, type Route } from "../router";
import type { NowResponse } from "../types";
import { dotDate, weekdayKo } from "../lib/ganji";
import { PLACES } from "../lib/places";
import { useFmt } from "./ui";

const NAV: { icon: string; label: string; route: Route; match: Route["page"] }[] = [
  { icon: "◷", label: "오늘의 만세력", route: { page: "today" }, match: "today" },
  { icon: "◎", label: "사주원국 분석", route: { page: "analysis", tab: "summary" }, match: "analysis" },
  { icon: "↻", label: "대운 · 세운 흐름", route: { page: "luck" }, match: "luck" },
  { icon: "✦", label: "AI 프롬프트 생성", route: { page: "prompt" }, match: "prompt" },
  { icon: "▤", label: "저장된 명식", route: { page: "saved" }, match: "saved" },
  { icon: "⚙", label: "설정", route: { page: "settings" }, match: "settings" },
];

export function useNow(): NowResponse | null {
  const { state } = useApp();
  const lng = state.settings.solarTime
    ? PLACES.find((p) => p.name === state.settings.defaultPlace)?.longitude ?? null : null;
  const [now, setNow] = useState<NowResponse | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => api.now(lng, state.settings.splitZi).then((n) => alive && setNow(n), () => {});
    load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [lng, state.settings.splitZi]);
  return now;
}

export function Sidebar({ route, open, onClose }: { route: Route; open: boolean; onClose(): void }) {
  const { state, openChart } = useApp();
  const { g } = useFmt();
  const now = useNow();
  const recent = [...state.charts].sort((a, b) => b.viewedAt - a.viewedAt).slice(0, 5);
  const today = new Date();

  return (
    <>
      <aside className={`sidebar ${open ? "is-open" : ""}`}>
        <div className="brand">
          <div className="brand__logo">命</div>
          <div>
            <div className="brand__name">만세력 Lab</div>
            <div className="brand__sub">Saju Analytics</div>
          </div>
        </div>
        <div className="sidebar__section">WORKSPACE</div>
        <nav className="nav">
          {NAV.map((n) => {
            const active = route.page === n.match;
            return (
              <a key={n.label} href={href(n.route)} onClick={onClose}
                 className={`nav__item ${active ? "is-active" : ""}`} aria-current={active ? "page" : undefined}>
                <span className="nav__icon">{n.icon}</span>
                <span className="nav__label">{n.label}</span>
                {active && <img src={indicator} alt="" width={8} height={8} className="nav__indicator" />}
              </a>
            );
          })}
        </nav>
        <div className="sidebar__section">최근 열람 명식</div>
        <div className="recent">
          {recent.length === 0 && <p className="recent__empty">아직 저장된 명식이 없습니다</p>}
          {recent.map((c) => (
            <button key={c.id} className={`recent__item ${c.id === state.activeChartId ? "is-active" : ""}`}
                    onClick={() => {
                      openChart(c.id);
                      onClose();
                      if (route.page !== "analysis" && route.page !== "prompt" && route.page !== "luck") {
                        navigate({ page: "analysis", tab: "summary" });
                      }
                    }}>
              <span className="recent__dot" style={{ background: c.color }} />
              <span className="recent__name">{c.name}</span>
              {c.dayGanji && <span className="recent__ganji">{g(c.dayGanji)} 일주</span>}
            </button>
          ))}
        </div>
        <div className="sidebar__spacer" />
        <div className="today-box">
          <div className="today-box__date">오늘 · {dotDate(now?.now ?? today.toISOString())} ({weekdayKo(today)})</div>
          <div className="today-box__ganji">
            {now ? `${g(now.year.ganji)}年 ${g(now.month.ganji)}月 ${g(now.day.ganji)}日` : "…"}
          </div>
          {now && (
            <div className="today-box__term">
              {now.prev_term.name} +{now.days_since_term}일 · {now.next_term.name}까지 {now.days_to_term}일
            </div>
          )}
        </div>
      </aside>
      {open && <div className="sidebar__scrim" onClick={onClose} />}
    </>
  );
}
