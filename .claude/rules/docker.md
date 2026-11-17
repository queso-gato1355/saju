---
paths:
  - "**/Dockerfile"
  - "docker-compose*.yml"
  - "frontend/nginx.conf"
  - ".env.example"
  - "**/.dockerignore"
  - "docs/ddos-defense.md"
---

# Docker / 배포 / DoS 규칙

## 이미지
- backend: `python:3.14-slim`, uid 10001 비 root, uvicorn worker 2 + `--limit-concurrency 64`. healthcheck 는 urllib.
- frontend: `node:22-alpine` 빌드 → `nginx:1.29-alpine`. `npm ci` 를 위해 `package-lock.json` 커밋 필수.
- 베이스 태그는 메이저/마이너 고정, `latest` 금지.

## compose
- 외부 포트는 frontend `${WEB_PORT:-8080}:80` 하나. backend 는 `expose` 만.
- backend: `read_only`, `cap_drop: ALL`, `no-new-privileges`, 메모리 256M · CPU 1.0 제한.
- 환경변수: `API_RATE_PER_MIN`, `API_MAX_CONCURRENT` (.env.example 참고).

## nginx.conf (1차 방어 — 바꿀 때 docs/ddos-defense.md 와 함께 수정)
- `/api/` : IP 당 5r/s burst 20, 동시 연결 10, 본문 8KB, 타임아웃 10s, GET/POST 만.
- `/api/docs`, `/api/openapi.json` 는 운영에서 차단.
- 보안 헤더 + CSP(`'self'` 만). 외부 CDN 리소스를 추가하면 CSP 도 수정해야 함.
- `location` 에 `add_header` 를 쓰면 server 레벨 헤더가 상속되지 않음 → 보안 헤더를 다시 적을 것.
- 앞단에 NAS 리버스 프록시/Cloudflare 가 있으면 `set_real_ip_from` + `real_ip_header` 를 설정해야 IP 별 제한이 동작.
