import { useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { MenuCtx } from "./components/Topbar";
import { NewChartModal } from "./components/NewChartModal";
import { useRoute } from "./router";
import { useApp } from "./store/AppState";
import { TodayPage } from "./pages/TodayPage";
import { AnalysisPage } from "./pages/analysis/AnalysisPage";
import { LuckPage } from "./pages/LuckPage";
import { PromptPage } from "./pages/PromptPage";
import { SavedPage } from "./pages/SavedPage";
import { SettingsPage } from "./pages/SettingsPage";

export default function App() {
  const route = useRoute();
  const { storageOk } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <MenuCtx.Provider value={() => setMenuOpen(true)}>
      <div className="app">
        <Sidebar route={route} open={menuOpen} onClose={() => setMenuOpen(false)} />
        <main className="main">
          {!storageOk && (
            <div className="banner banner--warn" role="status">
              브라우저 저장소를 사용할 수 없어 명식·설정이 저장되지 않습니다 (사생활 보호 모드 등).
            </div>
          )}
          {route.page === "today" && <TodayPage />}
          {route.page === "analysis" && <AnalysisPage tab={route.tab} />}
          {route.page === "luck" && <LuckPage />}
          {route.page === "prompt" && <PromptPage />}
          {route.page === "saved" && <SavedPage />}
          {route.page === "settings" && <SettingsPage />}
        </main>
        <NewChartModal />
      </div>
    </MenuCtx.Provider>
  );
}
