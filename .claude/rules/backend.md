---
paths:
  - "backend/app/**"
  - "backend/requirements*.txt"
  - "backend/cli.py"
---

# 백엔드 (FastAPI) 규칙

- 백엔드는 **연산 전용**. DB·세션·사용자·파일 저장 추가 금지. 상태는 전부 브라우저에 있다.
- 라우터는 `/api` prefix, 동기 `def` 핸들러. 무거운 함수는 `main._run()` 으로 감싸 동시 계산 수 제한 + 도메인 오류 → 422.
- 요청/응답은 `app/schemas.py` Pydantic 모델. 요청 모델은 `extra="forbid", frozen=True` (캐시 키 안정성 + 불필요한 개인정보 차단).
- 응답 조립은 `app/services.py` 에서만. 사주 판정은 반드시 `saju` 패키지 함수 호출로.
- 캐시: 결정적 계산은 `lru_cache` (analyze 는 요청 JSON 문자열을 키로). 크기 상한 유지.
- 입력 범위: 연도 1900~2100, 경도 -180~180, 쿼리 문자열 길이 제한. 새 엔드포인트도 동일 원칙.
- 로그: 기본 WARNING. 생년월일시를 INFO 이상으로 남기지 않는다.
- DoS 2차 방어(`main.py` guard 미들웨어: 본문 4KB 제한, IP 토큰버킷, 세마포어)를 우회하는 경로를 만들지 않는다.
- 의존성은 `requirements.txt` 에 `==` 고정. 테스트 도구는 `requirements-dev.txt`.

## 테스트
- `tests/test_saju_regression.py`: `.claude/rules/saju-domain.md` 기준값.
- `tests/test_api.py`: 양력/음력/생시 모름/잘못된 음력(422)/범위 밖(422)/추가 필드 거부/달력·검색.
- 새 엔드포인트·옵션을 추가하면 테스트도 추가.
