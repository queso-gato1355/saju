# Cloudflare Tunnel 설정 — saju.quesogato.top

구성: `방문자 → Cloudflare(DDoS 흡수·WAF) → 터널 → NAS의 cloudflared → frontend(nginx :8080) → backend`
공유기 포트포워딩 불필요, 집 IP 비노출.

## 0. 전제

- NAS에서 `docker compose up -d` 로 앱이 떠 있고, NAS 안에서 `curl http://localhost:8080/api/health` 가 `{"status":"ok"}`
- frontend 이미지 **1.0.1 이상** (Cloudflare 실제 IP 복원 설정 포함 — 기본값 `latest` 면 자동 충족). 1.0 은 모든 방문자가 IP 하나로 묶임

## 1. Public Hostname 추가 (대시보드에서 터널을 관리하는 경우 — 보통 이 방식)

Cloudflare 대시보드 → **Zero Trust** → **Networks → Tunnels** → 기존 터널 선택 → **Configure** → **Public Hostname** → **Add a public hostname**

| 항목 | 값 |
|---|---|
| Subdomain | `saju` |
| Domain | `quesogato.top` |
| Path | (비움) |
| Service Type | `HTTP` |
| URL | 아래 표에서 선택 |

| cloudflared 실행 방식 | URL |
|---|---|
| NAS 패키지 / `network_mode: host` 컨테이너 | `localhost:8080` |
| 일반(bridge) 도커 컨테이너 | `<NAS 내부 IP>:8080` (예: `192.168.0.10:8080`) |
| saju 와 같은 도커 네트워크에 붙인 경우 | `frontend:80` |

저장하면 `saju.quesogato.top` CNAME DNS 레코드가 자동 생성된다. HTTPS 인증서도 Cloudflare가 처리하므로 Service Type 은 HTTP 로 둔다.

### (참고) config.yml 로 직접 관리하는 터널이면

```yaml
ingress:
  - hostname: saju.quesogato.top
    service: http://localhost:8080
  # ... 기존 규칙들 ...
  - service: http_status:404     # 마지막 규칙은 항상 catch-all
```

```bash
cloudflared tunnel route dns <터널이름> saju.quesogato.top
# 이후 cloudflared 재시작
```

## 2. 보안 · 성능 설정 (quesogato.top 도메인 대시보드)

| 위치 | 설정 | 이유 |
|---|---|---|
| SSL/TLS → Edge Certificates | **Always Use HTTPS** 켬 | http → https 리다이렉트 |
| Security → Bots | **Bot Fight Mode** 켬 | 단순 봇 차단 (무료) |
| Security → WAF → **Rate limiting rules** | 아래 규칙 1개 (무료 플랜 1개 가능) | nginx 앞단에서 1차 차단 → NAS까지 안 옴 |
| Speed → Optimization | **Rocket Loader 끔** | 앱 CSP(`script-src 'self'`)가 Cloudflare 주입 스크립트를 막아 화면이 깨질 수 있음 |
| Scrape Shield | **Email Address Obfuscation 끔** | 같은 이유 (주입 스크립트) |
| Analytics → Web Analytics | 자동 주입(beacon) 쓰지 않기 | 같은 이유 |

### Rate limiting rule 예시

- **If incoming requests match**: `URI Path` `starts with` `/api/`
- **With the same characteristics**: IP
- **When rate exceeds**: `60` requests per `10 seconds` (무료 플랜은 기간 10초 고정)
- **Then take action**: Block, duration 10 seconds

정상 사용자는 화면 하나 여는 데 API 1~4회 정도라 넉넉하다.
nginx(IP당 5r/s, 버스트 20)와 백엔드(IP당 분당 120)가 그 뒤에서 한 번 더 막는다.

### 선택: 나만 쓰거나 지인만 쓸 거라면

Zero Trust → **Access → Applications → Add (Self-hosted)** → `saju.quesogato.top` → 정책에 허용할 이메일만 등록.
로그인(이메일 OTP)한 사람만 접근 → 공격 표면이 사실상 0. 앱 자체에는 로그인 기능이 없어도 된다.

## 3. NAS 쪽 마무리

- cloudflared 가 NAS **호스트**(패키지/host 네트워크)에서 돈다면 `.env` 에 `WEB_BIND=127.0.0.1` →
  LAN에서 8080 직접 접속 불가, Cloudflare 경유만 허용. (bridge 컨테이너면 0.0.0.0 유지)
- 공유기에서 8080 포트포워딩은 **하지 않는다**.

## 4. 확인

```bash
curl -s https://saju.quesogato.top/api/health          # {"status":"ok"}
curl -sI https://saju.quesogato.top/ | grep -i -E "cf-ray|content-security"
```

브라우저로 접속 → 오늘의 만세력이 뜨고 개발자도구 콘솔에 CSP 오류가 없으면 완료.
