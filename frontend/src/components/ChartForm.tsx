// 명식 입력 폼 (오늘의 만세력 '명식 열기' 카드 · 새 명식 모달 · 명식 수정에서 공용)
import { useState, type FormEvent } from "react";
import { useApp } from "../store/AppState";
import { CHART_COLORS, type SavedChart } from "../lib/storage";
import { PLACES, correctionMinutes } from "../lib/places";
import { Segmented } from "./ui";

type Draft = Omit<SavedChart, "id" | "createdAt" | "viewedAt">;

export function ChartForm({ initial, submitLabel = "명식 열기 →", onSubmit, compact }: {
  initial?: Partial<Draft>; submitLabel?: string; onSubmit(d: Draft): void; compact?: boolean;
}) {
  const { state } = useApp();
  const defPlace = PLACES.find((p) => p.name === state.settings.defaultPlace) ?? PLACES[0];
  const [name, setName] = useState(initial?.name ?? "");
  const [date, setDate] = useState(initial?.date ?? "");
  const [time, setTime] = useState(initial?.time ?? "");
  const [unknown, setUnknown] = useState(initial ? initial.time === null : false);
  const [cal, setCal] = useState<"solar" | "lunar" | "leap">(
    initial?.calendar === "lunar" ? (initial.isLeap ? "leap" : "lunar") : "solar");
  const [gender, setGender] = useState<"M" | "F">(initial?.gender ?? "M");
  const [place, setPlace] = useState(initial?.placeName ?? defPlace.name);
  const [customLng, setCustomLng] = useState<string>(
    initial?.longitude != null && !PLACES.some((p) => p.name === initial.placeName) ? String(initial.longitude) : "");
  const [error, setError] = useState<string | null>(null);

  const isCustom = place === "직접 입력";
  const lng = isCustom ? (customLng === "" ? null : Number(customLng)) : PLACES.find((p) => p.name === place)?.longitude ?? null;
  const corr = correctionMinutes(lng);

  function submit(e: FormEvent) {
    e.preventDefault();
    const m = /^(\d{4})[.\-/]?(\d{1,2})[.\-/]?(\d{1,2})$/.exec(date.trim());
    if (!m) return setError("생년월일을 YYYY.MM.DD 형식으로 입력하세요");
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (y < 1900 || y > 2100) return setError("1900~2100년 사이만 계산할 수 있습니다");
    if (mo < 1 || mo > 12 || d < 1 || d > (cal === "solar" ? new Date(y, mo, 0).getDate() : 30)) {
      return setError("존재하지 않는 날짜입니다");
    }
    let t: string | null = null;
    if (!unknown) {
      const tm = /^(\d{1,2}):?(\d{2})$/.exec(time.trim());
      if (!tm || Number(tm[1]) > 23 || Number(tm[2]) > 59) return setError("출생 시각을 HH:MM 형식으로 입력하세요 (모르면 '모름' 체크)");
      t = `${tm[1].padStart(2, "0")}:${tm[2]}`;
    }
    if (isCustom && lng != null && (Number.isNaN(lng) || lng < -180 || lng > 180)) return setError("경도는 -180 ~ 180 사이 숫자입니다");
    setError(null);
    onSubmit({
      name: name.trim().slice(0, 30) || "이름 없는 명식",
      gender, calendar: cal === "solar" ? "solar" : "lunar", isLeap: cal === "leap",
      date: `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      time: t, placeName: place, longitude: lng,
      color: initial?.color ?? CHART_COLORS[state.charts.length % CHART_COLORS.length],
    });
  }

  return (
    <form className={`chart-form ${compact ? "chart-form--compact" : ""}`} onSubmit={submit} noValidate>
      <label className="field">
        <span className="field__label">이름 (선택)</span>
        <input className="input" value={name} maxLength={30} placeholder="예시 명식" onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="field-row">
        <label className="field">
          <span className="field__label">생년월일</span>
          <input className="input" value={date} inputMode="numeric" placeholder="2004.02.21"
                 onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="field">
          <span className="field__label">출생 시각</span>
          <span className="input input--with-addon">
            <input value={unknown ? "" : time} disabled={unknown} inputMode="numeric" placeholder={unknown ? "모름" : "10:12"}
                   onChange={(e) => setTime(e.target.value)} />
            <span className="input__addon">
              <label className="check-inline">모름 <input type="checkbox" checked={unknown} onChange={(e) => setUnknown(e.target.checked)} /></label>
            </span>
          </span>
        </label>
      </div>
      <div className="field-row field-row--controls">
        <Segmented value={cal} onChange={setCal} options={[
          { value: "solar", label: "양력" }, { value: "lunar", label: "음력" }, { value: "leap", label: "윤달" },
        ]} />
        <Segmented value={gender} onChange={setGender} options={[{ value: "M", label: "남" }, { value: "F", label: "여" }]} />
      </div>
      <label className="field">
        <span className="field__label">출생지</span>
        <span className="input input--with-addon input--select">
          <select value={place} onChange={(e) => setPlace(e.target.value)}>
            {PLACES.map((p) => <option key={p.name}>{p.name}</option>)}
            <option>직접 입력</option>
          </select>
          <span className="input__addon">
            {corr != null ? `진태양시 ${corr > 0 ? "+" : "−"}${Math.abs(corr)}분 ✓` : "보정 없음"}
          </span>
        </span>
      </label>
      {isCustom && (
        <label className="field">
          <span className="field__label">경도 (동경 +, 서경 −)</span>
          <input className="input" value={customLng} inputMode="decimal" placeholder="126.98" onChange={(e) => setCustomLng(e.target.value)} />
        </label>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="submit" className="btn btn--primary btn--block">{submitLabel}</button>
    </form>
  );
}
