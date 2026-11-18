import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:8000" },
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 800,
    // 폰트는 data: URI 로 인라인하지 않는다 — CSP font-src 'self' 를 유지하기 위해
    assetsInlineLimit: (file) => (/\.woff2?$/.test(file) ? false : undefined),
  },
});
