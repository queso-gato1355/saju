// 임시 명식(저장 안 됨) 안내 + 성별 전환 · 저장 · 닫기
import { useApp } from "../store/AppState";
import { CHART_COLORS } from "../lib/storage";
import { Segmented } from "./ui";

export function TempBanner() {
  const { tempChart, setTempChart, addChart, state } = useApp();
  if (!tempChart) return null;
  const { id: _id, createdAt: _c, viewedAt: _v, dayGanji: _d, ...rest } = tempChart;
  return (
    <div className="banner banner--temp" role="status">
      <span className="banner__text">
        <b>임시 명식</b> · {tempChart.name}
        <span className="muted"> — 저장되지 않으며 새로고침하면 사라집니다</span>
      </span>
      <Segmented size="sm" value={tempChart.gender} onChange={(g) => setTempChart({ ...tempChart, gender: g })}
                 options={[{ value: "M", label: "남" }, { value: "F", label: "여" }]} />
      <button className="btn btn--ghost btn--sm" onClick={() => addChart({ ...rest, color: CHART_COLORS[state.charts.length % CHART_COLORS.length] })}>
        이 명식 저장
      </button>
      <button className="btn btn--ghost btn--sm" onClick={() => setTempChart(null)}>닫기</button>
    </div>
  );
}
