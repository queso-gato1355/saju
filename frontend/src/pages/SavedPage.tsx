import { useRef, useState } from "react";
import { Topbar } from "../components/Topbar";
import { ChartForm } from "../components/ChartForm";
import { Card, Hanja } from "../components/ui";
import { useApp } from "../store/AppState";
import { navigate } from "../router";
import { CHART_COLORS, downloadText } from "../lib/storage";
import { dotDate } from "../lib/ganji";

export function SavedPage() {
  const { state, openChart, removeChart, updateChart, importState, setNewChartOpen } = useApp();
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const charts = [...state.charts].sort((a, b) => b.viewedAt - a.viewedAt);

  function exportAll() {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadText(`saju-lab-backup-${stamp}.json`, JSON.stringify(state, null, 2), "application/json");
  }

  async function onImport(file: File, mode: "merge" | "replace") {
    if (file.size > 2_000_000) return setMsg("파일이 너무 큽니다 (2MB 이하)");
    try {
      const n = importState(JSON.parse(await file.text()), mode);
      setMsg(`${n}개 명식을 불러왔습니다 (${mode === "merge" ? "기존 명식 유지" : "전체 교체"})`);
    } catch {
      setMsg("올바른 백업 파일이 아닙니다");
    }
  }

  return (
    <div className="page">
      <Topbar crumbs={["명식", "저장된 명식"]} title="저장된 명식">
        <button className="btn btn--ghost" onClick={exportAll} disabled={!state.charts.length}>백업 내보내기</button>
        <button className="btn btn--ghost" onClick={() => fileRef.current?.click()}>가져오기</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onImport(f, "merge");
          e.target.value = "";
        }} />
        <button className="btn btn--primary" onClick={() => setNewChartOpen(true)}>＋ 새 명식</button>
      </Topbar>

      <div className="banner banner--info">
        로그인 없이 <b>이 브라우저(localStorage)</b>에만 저장됩니다. 서버에는 계산에 필요한 생년월일시·성별·경도만 전송되고 저장되지 않습니다.
        다른 기기로 옮기거나 브라우저 데이터를 지우기 전에 <b>백업 내보내기</b>를 해 두세요.
      </div>
      {msg && <div className="banner banner--ok" role="status">{msg}</div>}

      {charts.length === 0 ? (
        <Card title="저장된 명식이 없습니다" subtitle="새 명식을 만들면 여기에 쌓입니다">
          <button className="btn btn--primary" onClick={() => setNewChartOpen(true)}>＋ 새 명식</button>
        </Card>
      ) : (
        <div className="saved-grid">
          {charts.map((c) => (
            <Card key={c.id} className={c.id === state.activeChartId ? "is-active-chart" : ""}
                  title={<><span className="recent__dot" style={{ background: c.color }} /> {c.name}</>}
                  subtitle={`${c.gender === "M" ? "남" : "여"} · ${c.calendar === "lunar" ? `음력${c.isLeap ? "(윤)" : ""}` : "양력"} ${dotDate(c.date)} ${c.time ?? "시각 모름"} · ${c.placeName}`}>
              {editing === c.id ? (
                <ChartForm initial={c} submitLabel="저장" compact onSubmit={(d) => { updateChart(c.id, { ...d, dayGanji: undefined }); setEditing(null); }} />
              ) : (
                <>
                  <div className="saved-card__ganji">
                    {c.dayGanji ? <><Hanja text={c.dayGanji} className="serif" /> 일주</> : <span className="muted">아직 분석 전</span>}
                  </div>
                  <div className="saved-card__colors">
                    {CHART_COLORS.map((col) => (
                      <button key={col} className={`swatch ${c.color === col ? "is-on" : ""}`} style={{ background: col }}
                              aria-label="색 지정" onClick={() => updateChart(c.id, { color: col })} />
                    ))}
                  </div>
                  <div className="saved-card__actions">
                    <button className="btn btn--primary" onClick={() => { openChart(c.id); navigate({ page: "analysis", tab: "summary" }); }}>열기</button>
                    <button className="btn btn--ghost" onClick={() => setEditing(c.id)}>수정</button>
                    {confirmDel === c.id ? (
                      <>
                        <button className="btn btn--danger" onClick={() => { removeChart(c.id); setConfirmDel(null); }}>정말 삭제</button>
                        <button className="btn btn--ghost" onClick={() => setConfirmDel(null)}>취소</button>
                      </>
                    ) : <button className="btn btn--ghost" onClick={() => setConfirmDel(c.id)}>삭제</button>}
                  </div>
                </>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
