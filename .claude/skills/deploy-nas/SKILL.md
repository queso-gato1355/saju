---
name: deploy-nas
description: 만세력 웹앱을 NAS 의 Docker Compose 로 배포한다. 사용자가 "배포", "NAS에 올려", "deploy" 를 요청할 때 사용.
disable-model-invocation: true
---

# NAS 배포

`.claude/CLAUDE.md` 의 "NAS 배포 정보" 섹션에서 접속 주소·배포 경로·아키텍처를 읽는다.
`TODO` 로 남아 있으면 먼저 사용자에게 물어보고 CLAUDE.md 에 기록한 뒤 진행한다.

## 1. 배포 전 점검 (로컬)

1. 백엔드 테스트: `cd backend && ../saju_env/Scripts/python.exe -m pytest -q` — 실패하면 중단.
   - `frontend/package-lock.json` 이 있어야 이미지 빌드(`npm ci`)가 된다.
2. 프론트 빌드/타입체크: `cd frontend && npx tsc -b --noEmit && npm run build` — 실패하면 중단.
3. `docker compose config` 로 compose 파일 문법 확인.
4. `docker compose build` 로 로컬 빌드가 되는지 확인 (Docker Desktop 이 있을 때).

## 2. 전송 & 실행 — 하나 선택 (기본: 0)

### 0. Docker Hub 이미지 pull (기본)

```bash
# 로컬: 새 버전이면 빌드·스모크 테스트·push (CLAUDE.md 의 릴리스 절차)
scp docker-compose.yml .env.example <NAS_USER>@<NAS_HOST>:<DEPLOY_PATH>/
ssh <NAS_USER>@<NAS_HOST> "cd <DEPLOY_PATH> && [ -f .env ] || cp .env.example .env; docker compose up -d --no-build"
```

compose 가 `latest` + `pull_policy: always` 라서 `up -d` 할 때마다 최신 이미지를 받아 바뀐 컨테이너만 재시작한다.
특정 버전으로 고정·롤백하려면 NAS 의 `.env` 에서 `IMAGE_TAG=1.0.1` 처럼 지정.


### A. 소스를 NAS 로 복사하고 NAS 에서 빌드 (아키텍처 문제 없음)

```bash
# .env, node_modules, saju_env, __pycache__, dist 는 제외
rsync -av --delete \
  --exclude node_modules --exclude saju_env --exclude __pycache__ \
  --exclude dist --exclude .env --exclude .claude --exclude .pytest_cache \
  ./ <NAS_USER>@<NAS_HOST>:<DEPLOY_PATH>/
ssh <NAS_USER>@<NAS_HOST> "cd <DEPLOY_PATH> && docker compose up -d --build"
```

Windows 에 rsync 가 없으면 `scp -r backend frontend docker-compose.yml .env.example ...` 로 대체하거나,
NAS 의 Container Manager(GUI)에서 프로젝트 폴더를 지정해 빌드하도록 안내한다.

### B. 로컬에서 이미지 빌드 후 tar 로 전달

```bash
docker buildx build --platform linux/<ARCH> -t saju-backend:<TAG> --load backend
docker buildx build --platform linux/<ARCH> -t saju-frontend:<TAG> --load frontend
docker save saju-backend:<TAG> saju-frontend:<TAG> -o saju-images.tar
scp saju-images.tar docker-compose.yml <NAS_USER>@<NAS_HOST>:<DEPLOY_PATH>/
ssh <NAS_USER>@<NAS_HOST> "cd <DEPLOY_PATH> && docker load -i saju-images.tar && docker compose up -d"
```

## 3. 배포 후 확인

```bash
ssh <NAS_USER>@<NAS_HOST> "cd <DEPLOY_PATH> && docker compose ps && docker compose logs --tail 50"
curl -s http://<NAS_HOST>:<WEB_PORT>/api/health
curl -s -X POST http://<NAS_HOST>:<WEB_PORT>/api/analyze \
  -H 'Content-Type: application/json' \
  -d '{"date":"2000-01-01","time":"12:00","options":{"solar_time":false}}'
```

마지막 응답의 `pillars[].ganji` 가 戊午 · 戊午 · 丙子 · 己卯 (시·일·월·년) 인지 확인한다.

rate limit 동작 확인(선택): `docs/ddos-defense.md` 의 "점검 방법". NAS 앞단에 리버스 프록시가 있다면 real_ip 설정이 되어 있는지 먼저 확인.

## 주의

- `ssh`, `docker compose up/down` 등 원격·운영 명령은 실행 전에 사용자 확인을 받는다.
- NAS 의 `.env` 는 덮어쓰지 않는다 (rsync 에서 제외).
- 실패 시 `docker compose logs` 결과를 그대로 보여주고, 임의로 `down`/볼륨 삭제를 하지 않는다.
