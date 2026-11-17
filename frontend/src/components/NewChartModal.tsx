import { useEffect } from "react";
import { useApp } from "../store/AppState";
import { navigate } from "../router";
import { ChartForm } from "./ChartForm";

export function NewChartModal() {
  const { newChartOpen, setNewChartOpen, addChart } = useApp();
  useEffect(() => {
    if (!newChartOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setNewChartOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newChartOpen, setNewChartOpen]);
  if (!newChartOpen) return null;
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="new-chart-title">
      <div className="modal__backdrop" onClick={() => setNewChartOpen(false)} />
      <div className="modal__panel">
        <header className="card__header">
          <div className="card__titles">
            <h2 className="card__title" id="new-chart-title">새 명식</h2>
            <p className="card__subtitle">이 브라우저에만 저장됩니다 · 서버에는 계산용 생년월일시만 전송</p>
          </div>
          <button className="icon-btn" aria-label="닫기" onClick={() => setNewChartOpen(false)}>✕</button>
        </header>
        <ChartForm onSubmit={(d) => {
          addChart(d);
          setNewChartOpen(false);
          navigate({ page: "analysis", tab: "summary" });
        }} />
      </div>
    </div>
  );
}
