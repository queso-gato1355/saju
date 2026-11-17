// 디자인 공통 요소: Card, Segmented, Toggle, Chip, GlyphTile, Hanja 텍스트 등
import { useState, type ReactNode } from "react";
import { useApp } from "../store/AppState";
import { ELEMENT_CLASS, elementOfHanja, fmtGanji, fmtTenGod } from "../lib/ganji";
import type { ElementKo } from "../types";

export function Card({ title, subtitle, actions, children, className = "", id }: {
  title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode;
  className?: string; id?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
    {/* 배경은 카드 밖 형제 요소로 둬야 카드 자체가 어두워지지 않는다 */}
    {expanded && <div className="card__backdrop" onClick={() => setExpanded(false)} />}
    <section className={`card ${expanded ? "card--expanded" : ""} ${className}`} id={id}>
      {(title || actions) && (
        <header className="card__header">
          <div className="card__titles">
            {title && <h2 className="card__title">{title}</h2>}
            {subtitle && <p className="card__subtitle">{subtitle}</p>}
          </div>
          <div className="card__actions">
            {actions}
            <button className="icon-btn" title={expanded ? "접기" : "크게 보기"} aria-label="크게 보기"
                    onClick={() => setExpanded((v) => !v)}>⤢</button>
          </div>
        </header>
      )}
      {children}
    </section>
    </>
  );
}

export function Segmented<T extends string>({ value, options, onChange, size = "md", className = "" }: {
  value: T; options: { value: NoInfer<T>; label: ReactNode; disabled?: boolean; title?: string }[];
  onChange(v: NoInfer<T>): void; size?: "sm" | "md"; className?: string;
}) {
  return (
    <div className={`seg seg--${size} ${className}`} role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value} disabled={o.disabled}
                title={o.title}
                className={`seg__item ${o.value === value ? "is-active" : ""}`}
                onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, disabled }: {
  checked: boolean; onChange(v: boolean): void; label?: string; disabled?: boolean;
}) {
  return (
    <button role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
            className={`toggle ${checked ? "is-on" : ""}`} onClick={() => onChange(!checked)}>
      <span className="toggle__knob" />
    </button>
  );
}

export function Chip({ children, tone = "neutral", className = "" }: {
  children: ReactNode; tone?: "neutral" | "accent" | "hap" | "chung" | "hyung" | "pa" | "hae" | "earth" | "danger";
  className?: string;
}) {
  return <span className={`chip chip--${tone} ${className}`}>{children}</span>;
}

export function KindDot({ kind }: { kind: string }) {
  const tone = { 합: "hap", 충: "chung", 형: "hyung", 파: "pa", 해: "hae" }[kind] ?? "neutral";
  return <span className={`chip chip--${tone} chip--kind`}>● {kind}</span>;
}

/** 오행 색이 입혀진 간지 텍스트. 한 글자씩 색 */
export function Hanja({ text, className = "", colored = true }: { text: string; className?: string; colored?: boolean }) {
  const { state } = useApp();
  const mode = state.settings.ganjiDisplay;
  const useColor = colored && state.settings.elementColor;
  const shown = [...fmtGanji(text, mode === "hangul" ? "hangul" : "hanja")];
  const chars = [...text].map((ch, i) => {
    const el = elementOfHanja(ch);
    return <span key={i} className={el && useColor ? `fg-${ELEMENT_CLASS[el]}` : undefined}>{shown[i]}</span>;
  });
  const ko = fmtGanji(text, "hangul");
  return (
    <span className={`hanja ${className}`}>
      {chars}
      {mode === "both" && ko !== text && <span className="hanja__ko">({ko})</span>}
    </span>
  );
}

export function useFmt() {
  const { state } = useApp();
  return {
    g: (s: string) => fmtGanji(s, state.settings.ganjiDisplay),
    tg: (s: string) => fmtTenGod(s, state.settings.tenGodDisplay),
    colored: state.settings.elementColor,
  };
}

export function GlyphTile({ hanja, element, sub, selected, size = "lg", dashed, onClick }: {
  hanja: string; element: ElementKo; sub?: string; selected?: boolean; size?: "lg" | "md" | "sm";
  dashed?: boolean; onClick?(): void;
}) {
  const { state } = useApp();
  const { g } = useFmt();
  const cls = state.settings.elementColor ? `tile--${ELEMENT_CLASS[element]}` : "tile--plain";
  const shown = state.settings.ganjiDisplay === "hangul" ? g(hanja) : hanja;
  const Tag = onClick ? "button" : "div";
  return (
    <Tag className={`tile tile--${size} ${cls} ${selected ? "is-selected" : ""} ${dashed ? "is-dashed" : ""}`}
         onClick={onClick}>
      <span className="tile__glyph">{shown}</span>
      {sub && <span className="tile__sub">{sub}</span>}
      {state.settings.ganjiDisplay === "both" && <span className="tile__ko">{g(hanja).slice(-2, -1)}</span>}
    </Tag>
  );
}

export function ElementLegend() {
  return (
    <div className="legend">
      {(["목", "화", "토", "금", "수"] as ElementKo[]).map((e) => (
        <span key={e} className="legend__item">
          <span className={`legend__swatch bg-${ELEMENT_CLASS[e]}`} />{e}
        </span>
      ))}
    </div>
  );
}

export function Loading({ label = "계산 중…" }: { label?: string }) {
  return <div className="state state--loading"><span className="spinner" />{label}</div>;
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?(): void }) {
  return (
    <div className="state state--error" role="alert">
      <strong>계산하지 못했습니다</strong>
      <span>{message}</span>
      {onRetry && <button className="btn btn--ghost" onClick={onRetry}>다시 시도</button>}
    </div>
  );
}

export function Bar({ value, max = 100, color, ghost }: { value: number; max?: number; color: string; ghost?: number }) {
  return (
    <div className="bar">
      {ghost != null && <div className="bar__ghost" style={{ width: `${Math.min(100, (ghost / max) * 100)}%` }} />}
      <div className="bar__fill" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }} />
    </div>
  );
}

export function ElementGlyph({ el, className = "" }: { el: ElementKo; className?: string }) {
  const map = { 목: "木", 화: "火", 토: "土", 금: "金", 수: "水" } as const;
  const { colored } = useFmt();
  return <span className={`serif ${colored ? `fg-${ELEMENT_CLASS[el]}` : ""} ${className}`}>{map[el]}</span>;
}
