# 만세력 Lab (Saju Manseryeok)

생년월일시(양력/음력)로 사주 원국을 계산하고 합충형파해·십성 세력·12운성·신살·대운을 시각화하는 웹앱.
**로그인 없음** — 명식·설정·프롬프트 기록은 모두 브라우저 `localStorage`에 저장. 개인 NAS에 Docker Compose로 배포.
디자인 원본: Figma "만세력 대시보드" (fileKey `LBXYWvialsuS4S2naI9mja`, 화면 8개).

## 아키텍처

```
[브라우저] ── localStorage: 명식 · 설정 · 프롬프트 기록 (서버에 저장 안 함)
    │
    ▼
frontend (nginx :80) ── 정적 React 빌드 + /api 프록시 + rate limit (1차 방어)
    │  /api/*
    ▼
backend (FastAPI :8000, 내부망) ── 무상태 연산 전용 + 토큰버킷·캐시·동시성 제한 (2차 방어)
    │
    ▼
saju 패키지 (순수 파이썬 계산 엔진)
```

- **백엔드 = 사주 연산 장치**. 저장·세션·사용자 개념 없음. 요청 본문에 이름 같은 식별 정보 받지 않음(`extra="forbid"`).
- **임시 명식**: 오늘 명식 열기 · 달력 날짜 클릭 · 시주 클릭은 `AppState.tempChart`(메모리)로만 연다. localStorage·최근 열람·프롬프트 기록에 남기지 않는다 (`isTemp()`). 사용자가 "이 명식 저장"을 눌렀을 때만 저장.
- **프론트엔드 = 표시 + 저장 + 서식화**. 사주 계산(십성·운성·관계 판정 등)을 프론트에서 재구현하지 않는다.
  허용: 표시용 매핑(한자↔한글, 오행 색), 프롬프트 텍스트 서식화, 저장소 관리.
- 외부 노출 포트는 frontend 하나. backend 는 compose 내부 네트워크에서만 접근.

## 디렉터리

```
backend/
  saju/            계산 엔진 (manseryeok, solar_terms, branch, stem, ...)
    twelve_stages.py  12운성 (음포태/음양동생)
    sinsal.py         신살 · 순(旬)
    luck.py           대운 · 세운
    analysis.py       작용 강도 · 오행/십성 세력 · 신강도 · 격국/용신 · 자리별 강약 (휴리스틱 — 가중치 상수 상단)
    yukchin.py        십성 의미 · 육친(남명/여명) 표
  app/
    main.py        FastAPI 라우트 + DoS 2차 방어 미들웨어
    schemas.py     요청/응답 Pydantic 모델 (= API 계약)
    services.py    엔진 호출 + 응답 조립 (lru_cache)
  tests/           pytest (회귀 기준값 + API)
  cli.py           기존 CLI 데모
frontend/
  src/
    api.ts types.ts router.ts(해시 라우터) App.tsx
    store/AppState.tsx   localStorage 상태 + useAnalysis 훅
    lib/                 ganji(표시 매핑) settings(설정·프리셋→CalcOptions) storage prompt places
    components/          ui(Card·GlyphTile·Segmented…) Sidebar Topbar ChartForm …
    pages/               Today · analysis/{Summary,Dynamics,TenGods,Hidden,Sinsal} · Luck · Prompt · Saved · Settings
    styles/              tokens.css(Figma 변수) app.css
  nginx.conf  Dockerfile
docker-compose.yml  .env.example  docs/ddos-defense.md
saju_env/    로컬 venv (Python 3.14) — 수정 금지
```

## 자주 쓰는 명령 (Windows Git Bash 기준)

```bash
# 의존성
saju_env/Scripts/python.exe -m pip install -r backend/requirements-dev.txt
cd frontend && npm install

# 개발 서버 (두 터미널)
cd backend && ../saju_env/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
cd frontend && npm run dev          # http://localhost:5173 , /api → :8000 프록시

# 검증
cd backend && ../saju_env/Scripts/python.exe -m pytest -q
cd frontend && npx tsc -b --noEmit && npm run build

# 전체 스택 (Docker Desktop 실행 필요)
docker compose up --build           # http://localhost:8080
```

Windows 콘솔 한글 깨짐 → `PYTHONIOENCODING=utf-8`.

## API (상세는 backend/app/schemas.py)

| 메서드 | 경로 | 용도 |
|---|---|---|
| POST | `/api/analyze` | 원국 전체 분석 (원국·신강도·시나리오(원국/+대운/+세운)·격국·용신·12운성·신살·공망·대운(대운별 세운·작용 목록)·요약·자리별 강약(`slot_power`, 인종법 보기)·십성 의미/육친(`ten_god_meanings`)) |
| GET | `/api/calendar/{y}/{m}` | 월 달력 (일진·음력·절기) + 월건 + 그해 12절 흐름 |
| GET | `/api/now?longitude=&split_zi=` | 현재 년·월·일·시주, 오늘 12시진, 절기 경과 |
| GET | `/api/search?q=甲子日&around=` | 간지(일/월/년) 날짜 검색 |
| GET | `/api/health` | 헬스체크 |

`ChartRequest.options`(CalcOptions)는 설정 화면 값 그대로. 응답 모델을 바꾸면 `frontend/src/types.ts` 도 같은 변경에서 수정.

## 작업 원칙

- `saju/` 의 **만세력 계산**(기둥·절기·보정)은 `.claude/rules/saju-domain.md` 기준값을 깨면 안 된다. 바뀌면 사용자 확인.
- `saju/analysis.py` 의 점수는 휴리스틱. 가중치 변경은 가능하지만 이유를 남기고 화면 문구("후보", "휴리스틱")를 유지.
- 사용자 입력 오류는 422 + 한국어 메시지. 500 금지.
- 개인정보: 서버 로그에 생년월일시 남기지 않음. AI 프롬프트에 이름·생년월일 넣지 않음.
- 새 의존성은 꼭 필요할 때만. 계산 엔진에는 추가 금지(`tzdata` 는 서머타임 판정용 예외).
- UI 문구·에러는 한국어. Figma 토큰은 `styles/tokens.css` 변수만 사용.

## 미구현 / 준비 중 (설정 화면에서 비활성 표시)

동지세수 · KASI 역서 데이터 · 연해자평식/사용자 정의 지장간 배분표 · 다크 모드.

## NAS 배포 정보 (사용자 확인 후 채울 것)

- NAS CPU 아키텍처: **amd64** (사용자 확인, 2026-11-17)
- Docker Hub 이미지(공개): `quesogato3924/saju-backend`, `quesogato3924/saju-frontend` — 1.0 = 최초 릴리스 (latest 도 같은 이미지)
  - 릴리스: `docker build --platform linux/amd64 -t quesogato3924/<svc>:<ver> -t …:latest <dir>` → 로컬 compose 스모크 테스트 → `docker push`
  - compose 는 `IMAGE_TAG`(.env, 기본 1.0)로 태그 선택
- 접속: `TODO` (예: `ssh user@nas.local`)
- 배포 경로: `TODO` (예: `/volume1/docker/saju`)
- 외부 포트: `.env` 의 `WEB_PORT` (기본 8080)
- 공개 주소: **https://saju.quesogato.top** — NAS 의 cloudflared(Cloudflare Tunnel) → frontend:8080. 설정은 docs/cloudflare.md
- nginx 는 사설 대역에서 온 요청의 `CF-Connecting-IP` 로 실제 IP 를 복원 (rate limit 이 IP 별로 동작하기 위해 필수)
- GitHub: https://github.com/queso-gato1355/saju (기본 브랜치 main)

배포 절차는 `/deploy-nas` 스킬, DoS 대비는 `docs/ddos-defense.md`.
