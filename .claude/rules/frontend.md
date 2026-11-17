---
paths:
  - "frontend/**"
---

# 프론트엔드 (React 19 + TypeScript + Vite) 규칙

## 구조
- 라우팅: `src/router.ts` 의 해시 라우터(`#/today`, `#/analysis/<tab>` …). 라우터 라이브러리 추가 금지.
- 전역 상태: `store/AppState.tsx` 하나. 모든 영속 데이터는 `lib/storage.ts` 를 통해 `localStorage` 키 `saju-lab:v1` 에.
  - 저장소 접근은 항상 try/catch (사생활 보호 모드 대응). 실패 시 배너로 알림.
  - 가져오기(JSON) 데이터는 `sanitize()` 로 검증 후에만 반영.
  - 스키마를 바꾸면 `version` 을 올리고 마이그레이션 추가.
- 분석 화면은 `viewChart`(= 임시 명식 ?? 저장된 활성 명식)를 쓴다. 임시 명식은 저장·기록 금지, `<TempBanner />` 로 안내.
- API 호출은 `src/api.ts` 에서만, 상대 경로 `/api/...`. 같은 요청은 메모리 캐시.
- 분석 데이터는 `useAnalysis(chart, override?)` 훅으로. 설정 → `toCalcOptions()` 로 변환해 백엔드에 전달.

## 계산 금지
- 십성·12운성·관계·세력 등 사주 판정은 백엔드 응답만 사용. 프론트에서 필요한 값이 없으면 백엔드 스키마에 추가.
- 허용: `lib/ganji.ts` 표시 매핑(한자↔한글, 오행 색, 띠 이름), `lib/prompt.ts` 서식화.

## 디자인 (Figma "만세력 대시보드")
- 색·폰트는 `styles/tokens.css` 변수만. 하드코딩 색 추가 금지(관계 색 틴트 등 파생색 제외).
- 폰트: IBM Plex Sans KR(UI) · Noto Serif KR(간지) · JetBrains Mono(숫자) — `@fontsource` 자체 호스팅 (외부 CDN 금지: CSP `font-src 'self'`).
- 원국표는 전통 순서 **시 · 일 · 월 · 년** (왼→오). 일간은 보라 테두리.
- 설정의 간지 표기(한자/한글/병기), 십성 표기, 오행 색상 토글을 새 컴포넌트에서도 반영 (`useFmt()`, `<Hanja>`, `<GlyphTile>`).
- 반응형: 1100px 이하 1열, 960px 이하 사이드바 드로어, 640px 이하 모바일. 390px 폭에서 가로 스크롤 없어야 함.

## 검증
- `npx tsc -b --noEmit` 와 `npm run build` 통과.
- UI 변경 후 브라우저에서 해당 화면 + 390px 폭 확인.
