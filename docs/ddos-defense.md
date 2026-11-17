# DoS / DDoS 대비 정리

이 앱은 상태가 없고(로그인·DB 없음) 계산이 가벼워서 **공격으로 잃을 데이터는 없다**.
현실적인 위험은 "NAS 의 CPU·메모리·회선을 다 써서 NAS 의 다른 서비스(사진, 파일 공유 등)까지 같이 죽는 것"이다.
그래서 목표는 **(1) 앱이 NAS 자원을 일정 이상 못 쓰게 가두고 (2) 공격 트래픽이 NAS 까지 오지 않게 하는 것**.

## 계층별 방어

| 계층 | 막는 것 | 상태 |
|---|---|---|
| ① 노출 최소화 | 아예 공격 표면을 줄임 | 선택 (아래 권장) |
| ② 앞단 프록시/CDN (Cloudflare Tunnel 등) | 대량 L3/L4·L7 DDoS, 봇 | 선택 (강력 권장) |
| ③ nginx (frontend 컨테이너) | IP 별 과다 요청, slowloris, 큰 본문 | **구현됨** |
| ④ FastAPI 미들웨어 | nginx 우회·설정 실수 대비 2차 제한 | **구현됨** |
| ⑤ 계산 비용 상한 | 요청 1건이 비싼 경우 | **구현됨** |
| ⑥ 컨테이너 자원 제한 | 앱이 NAS 전체를 잡아먹는 것 | **구현됨** |

### ③ nginx (`frontend/nginx.conf`)
- `/api/` IP 당 **초당 5건, 버스트 20** (`limit_req`) → 초과 시 429
- IP 당 동시 연결 10(API) / 20(전체) (`limit_conn`)
- 본문 8KB 제한, 헤더·본문 타임아웃 10초 (slowloris 완화), keepalive 15초
- GET/POST 외 메서드 거부, API 문서(`/api/docs`) 운영 차단
- 정적 파일은 nginx 가 바로 응답(1년 캐시) → 백엔드 부하 없음

### ④ 백엔드 (`backend/app/main.py`)
- 본문 4KB 초과 → 413
- IP 별 토큰 버킷 (기본 분당 120, `API_RATE_PER_MIN`) → 429. 추적 IP 수 상한 1만 개(메모리 고정)
- 동시 계산 4개(`API_MAX_CONCURRENT`) — 2초 안에 자리 없으면 즉시 503 (큐가 무한정 쌓이지 않음)
- uvicorn `--limit-concurrency 64`, keep-alive 5초

### ⑤ 계산 비용
- 입력 범위 고정(1900~2100년, 문자열 길이 제한, 알 수 없는 필드 거부) → 요청당 최악 비용이 수십 ms 로 고정
- 절기·달력·분석 결과 LRU 캐시 → 같은 요청 반복은 거의 공짜
- 프론트도 같은 요청은 메모리 캐시해서 정상 사용자의 요청 수 자체가 적음

### ⑥ 컨테이너 (`docker-compose.yml`)
- backend CPU 1.0 / 메모리 256MB, frontend CPU 0.5 / 128MB → 공격받아도 NAS 의 나머지는 살아 있음
- backend 는 외부 포트 없음, read-only 파일시스템, 권한 제거

## 권장 운영 방식 (택1, 위에서부터 추천)

1. **외부 공개가 필요 없으면: Tailscale/WireGuard VPN 으로만 접속.** 포트포워딩 없음 → DDoS 표면 0.
2. **외부 공개 필요: Cloudflare Tunnel(cloudflared 컨테이너).** 공유기 포트를 열지 않고, 집 IP 가 노출되지 않으며
   Cloudflare 가 대량 DDoS 를 흡수. 무료 플랜의 Rate Limiting 규칙·Bot Fight Mode·(필요 시) Turnstile 추가 가능.
3. 포트포워딩 + NAS 내장 리버스 프록시(HTTPS): 가장 간단하지만 집 IP 노출, 대량 DDoS 엔 무력. 위 ③~⑥ 이 전부.

### 앞단 프록시를 둘 때 꼭 할 것 — 실제 IP 복원
앞에 Cloudflare/NAS 리버스 프록시가 있으면 nginx 가 보는 IP 는 전부 프록시 IP 라서
**모든 사용자가 한 IP 로 묶여 같이 429** 를 받는다. `frontend/nginx.conf` 의 `server {}` 위에 추가:

```nginx
# NAS 리버스 프록시(같은 호스트/도커 네트워크)인 경우 예시
set_real_ip_from 172.16.0.0/12;
set_real_ip_from 192.168.0.0/16;
real_ip_header X-Forwarded-For;
real_ip_recursive on;
# Cloudflare 인 경우: Cloudflare IP 대역을 set_real_ip_from 으로 나열하고 real_ip_header CF-Connecting-IP;
```

## 아직 안 한 것 (필요해지면)
- fail2ban: nginx 429 로그를 보고 반복 IP 를 방화벽에서 차단
- 국가/ASN 차단 (Cloudflare WAF)
- 캡차(Turnstile): 봇이 문제될 때만. 지금은 로그인·폼 제출이 없어 실익 적음
- 모니터링: `docker stats`, NAS 리소스 알림

## 점검 방법
```bash
# 백엔드 단독: 분당 제한 확인 (로컬)
RATE_PER_MIN=20 python -c "..."   # tests 참고, 21번째부터 429

# 배포 후 nginx 제한 확인 (NAS 에서)
for i in $(seq 1 40); do curl -s -o /dev/null -w "%{http_code} " http://localhost:8080/api/calendar/2026/11; done
# → 앞의 ~21개 200, 이후 429 가 섞여야 정상
```
