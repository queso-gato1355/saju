// 해시 라우터 (#/today, #/analysis/summary ...). NAS 정적 서빙에서 새로고침에도 안전.
import { useEffect, useState } from "react";

export type Route =
  | { page: "today" }
  | { page: "analysis"; tab: AnalysisTab }
  | { page: "luck" }
  | { page: "prompt" }
  | { page: "saved" }
  | { page: "settings" };

export type AnalysisTab = "summary" | "dynamics" | "tengods" | "hidden" | "sinsal";
const TABS: AnalysisTab[] = ["summary", "dynamics", "tengods", "hidden", "sinsal"];

export function parse(hash: string): Route {
  const [, page, sub] = hash.replace(/^#/, "").split("/");
  switch (page) {
    case "analysis":
      return { page: "analysis", tab: TABS.includes(sub as AnalysisTab) ? (sub as AnalysisTab) : "summary" };
    case "luck":
    case "prompt":
    case "saved":
    case "settings":
      return { page };
    default:
      return { page: "today" };
  }
}

export function href(r: Route): string {
  return r.page === "analysis" ? `#/analysis/${r.tab}` : `#/${r.page}`;
}

export function navigate(r: Route) {
  window.location.hash = href(r);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(window.location.hash));
  useEffect(() => {
    const on = () => {
      setRoute(parse(window.location.hash));
      document.querySelector(".main")?.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}
