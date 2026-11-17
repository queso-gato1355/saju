// "이름 · 생년월일로 명식 검색" — 저장된 명식만 브라우저 안에서 검색
import { useMemo, useState } from "react";
import { useApp } from "../store/AppState";
import { navigate } from "../router";
import { dotDate } from "../lib/ganji";

export function ChartSearch({ goto = true }: { goto?: boolean }) {
  const { state, openChart } = useApp();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const hits = useMemo(() => {
    const s = q.trim().replaceAll(".", "-");
    if (!s) return state.charts.slice(0, 6);
    return state.charts.filter((c) => c.name.includes(s) || c.date.includes(s) || c.dayGanji?.includes(s)).slice(0, 8);
  }, [q, state.charts]);

  return (
    <div className="search" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}>
      <span className="search__icon">⌕</span>
      <input className="search__input" value={q} placeholder="이름 · 생년월일로 명식 검색"
             onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }} />
      {open && (
        <div className="search__pop">
          {hits.length === 0 && <div className="search__empty">일치하는 명식이 없습니다</div>}
          {hits.map((c) => (
            <button key={c.id} className="search__hit" onClick={() => {
              openChart(c.id);
              setOpen(false);
              setQ("");
              if (goto) navigate({ page: "analysis", tab: "summary" });
            }}>
              <span className="recent__dot" style={{ background: c.color }} />
              <strong>{c.name}</strong>
              <span className="muted">{c.calendar === "lunar" ? "음 " : ""}{dotDate(c.date)} {c.time ?? "시각 모름"}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
