"""FastAPI 앱: 사주 연산 전용 API (상태 없음, 저장 없음)

방어선(DoS 대비) — 1차 방어는 nginx(frontend/nginx.conf), 여기는 2차:
  - 요청 본문 크기 제한 (MAX_BODY_BYTES)
  - 동일 요청 결과 LRU 캐시 (services.analyze_cached 등)
  - 동시 연산 수 제한 (세마포어) — 초과 시 즉시 503
  - 간단한 IP 별 토큰 버킷 (프록시 뒤에서는 X-Real-IP 사용)
"""
from __future__ import annotations

import logging
import os
import threading
import time
from collections import OrderedDict
from datetime import date, datetime

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import schemas as S
from . import services

log = logging.getLogger("saju")
logging.basicConfig(level=os.getenv("LOG_LEVEL", "WARNING"))

MAX_BODY_BYTES = 4 * 1024
MAX_CONCURRENT = int(os.getenv("MAX_CONCURRENT", "4"))
RATE_PER_MIN = int(os.getenv("RATE_PER_MIN", "120"))
TRUST_PROXY = os.getenv("TRUST_PROXY", "1") == "1"

app = FastAPI(title="만세력 API", version="1.0.0", docs_url="/api/docs", openapi_url="/api/openapi.json",
              redoc_url=None)

if origins := os.getenv("CORS_ORIGINS"):
    app.add_middleware(CORSMiddleware, allow_origins=origins.split(","), allow_methods=["GET", "POST"],
                       allow_headers=["Content-Type"])

_compute_slots = threading.BoundedSemaphore(MAX_CONCURRENT)


class _Bucket:
    """IP 별 토큰 버킷. 메모리 무한 증가 방지를 위해 최대 키 수 제한."""

    def __init__(self, per_min: int, max_keys: int = 10_000):
        self.rate = per_min / 60.0
        self.cap = float(per_min)
        self.max_keys = max_keys
        self.data: OrderedDict[str, tuple[float, float]] = OrderedDict()
        self.lock = threading.Lock()

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        with self.lock:
            tokens, ts = self.data.pop(key, (self.cap, now))
            tokens = min(self.cap, tokens + (now - ts) * self.rate)
            ok = tokens >= 1
            self.data[key] = (tokens - 1 if ok else tokens, now)
            while len(self.data) > self.max_keys:
                self.data.popitem(last=False)
            return ok


_bucket = _Bucket(RATE_PER_MIN)


def _client_ip(req: Request) -> str:
    if TRUST_PROXY and (ip := req.headers.get("x-real-ip")):
        return ip
    return req.client.host if req.client else "unknown"


@app.middleware("http")
async def guard(request: Request, call_next):
    if request.url.path.startswith("/api/") and request.url.path != "/api/health":
        cl = request.headers.get("content-length")
        if cl and cl.isdigit() and int(cl) > MAX_BODY_BYTES:
            return JSONResponse({"detail": "요청이 너무 큽니다"}, status_code=413)
        if not _bucket.allow(_client_ip(request)):
            return JSONResponse({"detail": "요청이 너무 많습니다. 잠시 후 다시 시도하세요."},
                                status_code=429, headers={"Retry-After": "10"})
    return await call_next(request)


@app.exception_handler(RequestValidationError)
async def validation_handler(_: Request, exc: RequestValidationError):
    msgs = []
    for e in exc.errors():
        loc = ".".join(str(x) for x in e.get("loc", []) if x != "body")
        msg = str(e.get("msg", "")).removeprefix("Value error, ")
        msgs.append(f"{loc}: {msg}" if loc else msg)
    return JSONResponse({"detail": "입력값을 확인하세요 — " + "; ".join(msgs)}, status_code=422)


def _run(fn, *args):
    """동시 연산 제한 + 도메인 오류 → 422"""
    if not _compute_slots.acquire(timeout=2):
        raise HTTPException(503, "서버가 바쁩니다. 잠시 후 다시 시도하세요.")
    try:
        return fn(*args)
    except services.InputError as e:
        raise HTTPException(422, str(e)) from e
    except ImportError as e:
        raise HTTPException(422, str(e)) from e
    finally:
        _compute_slots.release()


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/api/analyze", response_model=S.AnalyzeResponse)
def analyze(req: S.ChartRequest) -> S.AnalyzeResponse:
    if req.reference_date is None:
        req = req.model_copy(update={"reference_date": datetime.now(services.KST).date()})
    return _run(services.analyze_cached, req.model_dump_json())


@app.get("/api/calendar/{year}/{month}", response_model=S.CalendarResponse)
def calendar(year: int, month: int) -> S.CalendarResponse:
    return _run(services.calendar_month, year, month)


@app.get("/api/now", response_model=S.NowResponse)
def now(longitude: float | None = Query(None, ge=-180, le=180), split_zi: bool = False) -> S.NowResponse:
    return _run(services.now_info, longitude, split_zi)


@app.get("/api/search", response_model=S.SearchResponse)
def search(q: str = Query(..., min_length=2, max_length=8), around: date | None = None) -> S.SearchResponse:
    ref = around or datetime.now(services.KST).date()
    if not 1900 <= ref.year <= 2100:
        raise HTTPException(422, "기준일은 1900~2100년 사이여야 합니다")
    return _run(services.search_ganji, q, ref)
