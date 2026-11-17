import { createContext, useContext, type ReactNode } from "react";
import { useApp } from "../store/AppState";

export const MenuCtx = createContext<() => void>(() => {});

export function Topbar({ crumbs, title, children }: { crumbs: string[]; title: string; children?: ReactNode }) {
  const { activeChart } = useApp();
  const openMenu = useContext(MenuCtx);
  return (
    <header className="topbar">
      <button className="topbar__menu icon-btn" aria-label="메뉴 열기" onClick={openMenu}>☰</button>
      <div className="topbar__titles">
        <div className="topbar__crumbs">{crumbs.join("  /  ")}</div>
        <h1 className="topbar__title">{title}</h1>
      </div>
      <div className="topbar__actions">{children}</div>
      <a className="avatar" href="#/saved" title={activeChart ? `현재 명식: ${activeChart.name}` : "저장된 명식"}>
        {activeChart?.name.slice(0, 1) ?? "命"}
      </a>
    </header>
  );
}
