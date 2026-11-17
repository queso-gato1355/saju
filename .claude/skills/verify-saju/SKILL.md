---
name: verify-saju
description: saju 계산 엔진을 수정한 뒤 결과가 바뀌지 않았는지(또는 의도대로 바뀌었는지) 검증한다. saju/ 패키지의 manseryeok·solar_terms·branch·stem 등을 고친 후, 또는 사용자가 "만세력 결과 검증", "회귀 테스트" 를 요청할 때 사용.
---

# 사주 계산 검증

## 1. 회귀 테스트

```bash
cd backend && ../saju_env/Scripts/python.exe -m pytest -q tests/test_saju_regression.py
```

CLI 로 기준값을 직접 확인할 수도 있다 (backend/ 에서 실행):

```bash
PYTHONIOENCODING=utf-8 ../saju_env/Scripts/python.exe cli.py 2000-01-01 12:00
PYTHONIOENCODING=utf-8 ../saju_env/Scripts/python.exe cli.py 1990-05-15 14:30 --lng 126.98
```

기대값은 `.claude/rules/saju-domain.md` 의 "불변 기준값" 표.

## 2. 경계 케이스 점검 (계산 로직을 바꿨다면 반드시)

다음을 실행해서 변경 전/후 출력을 비교한다 (`git stash` 가 없으면 변경 전 출력을 먼저 저장해 둘 것).

| 케이스 | 확인 포인트 |
|---|---|
| 입춘 직전/직후 (예: 해당 연도 입춘 시각 ±1분) | 년주·월주가 정확히 그 시각에 바뀌는가 |
| 22:59 / 23:00 / 23:30 / 00:59 / 01:00 | 자시 처리, `--split-zi` 유무에 따른 일주 차이 |
| `--lng 126.98` 유무 | 시주 경계(예: 13:29 vs 13:31)에서 시주가 달라지는가 |
| 생시 모름 (`cli.py 1990-05-15`) | 시주 없음, 년·월주 정상 |
| 음력 윤달 (`--lunar --leap`, 윤달이 있는 해) | 양력 변환 일치 |
| 존재하지 않는 음력 날짜 | `ValueError` 와 한국어 메시지 |

## 3. 외부 자료 교차 확인

절기 시각 계산을 바꿨다면 KASI(한국천문연구원) 천문우주지식정보 절기 시각과 몇 개 연도를 비교해
오차가 2분 이내인지 보고한다. 웹 조회가 필요하면 사용자에게 먼저 알린다.

## 4. 보고

- 바뀐 결과가 없으면: "기준값 N개, 경계 케이스 M개 모두 동일" 로 간단히 보고.
- 바뀐 결과가 있으면: 입력 / 변경 전 / 변경 후 표를 만들고, 의도한 변경인지 사용자에게 확인받는다.
