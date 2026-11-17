"""API 요청/응답 모델 (Pydantic v2)

응답 모델을 바꾸면 frontend/src/types.ts 도 같이 바꿀 것.
"""
from __future__ import annotations

from datetime import date as Date
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

TIME_RE = r"^([01]\d|2[0-3]):[0-5]\d$"


class CalcOptions(BaseModel):
    """설정 화면에서 넘어오는 계산 옵션. 모두 기본값이 있어 생략 가능."""
    model_config = ConfigDict(extra="forbid", frozen=True)

    split_zi: bool = False
    solar_time: bool = True                  # 진태양시(경도) 보정
    dst_auto: bool = True                    # 한국 서머타임·UTC+8:30 시기 자동 반영
    equation_of_time: bool = False           # 균시차
    term_precision: Literal["minute", "day"] = "minute"
    yin_mode: Literal["eumpotae", "same"] = "eumpotae"
    hap_condition: Literal["strict", "normal", "loose"] = "normal"
    atten_adjacent: float = Field(1.0, ge=0, le=1)
    atten_one_gap: float = Field(0.6, ge=0, le=1)
    atten_far: float = Field(0.3, ge=0, le=1)
    allow_banhap: bool = True
    jwabeop: bool = True
    injong: bool = True                      # 극신약 시 종격 가능성 표시
    injong_assume: bool = True               # 인종법: 천간에 없는 십성도 가정해 대입
    sinsal_basis: Literal["year", "day", "both"] = "both"
    luck_rounding: Literal["round", "floor", "precise"] = "round"
    age_mode: Literal["man", "korean"] = "man"


class ChartRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    calendar: Literal["solar", "lunar"] = "solar"
    date: Date
    time: Optional[str] = Field(None, pattern=TIME_RE)
    is_leap: bool = False
    gender: Literal["M", "F"] = "M"
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    reference_date: Optional[Date] = None    # '현재' 대운·세운 판정 기준일 (기본: 오늘 KST)
    options: CalcOptions = CalcOptions()

    @field_validator("date")
    @classmethod
    def _year_range(cls, v: Date) -> Date:
        if not 1900 <= v.year <= 2100:
            raise ValueError("1900~2100년 사이 날짜만 계산할 수 있습니다")
        return v

    @field_validator("reference_date")
    @classmethod
    def _ref_range(cls, v: Optional[Date]) -> Optional[Date]:
        if v is not None and not 1900 <= v.year <= 2100:
            raise ValueError("기준일은 1900~2100년 사이여야 합니다")
        return v


# ───────── 응답 ─────────
class Char(BaseModel):
    name: str
    hanja: str
    element: str
    yinyang: str


class HiddenOut(Char):
    role: str
    days: int
    ten_god: str
    tougan: bool


class StemOut(Char):
    ten_god: str               # 일간 자신은 "일간"
    sinsal: list[str]


class JwaOut(BaseModel):
    hanja: str
    role: str
    ten_god: str
    stage: str


class BranchOut(Char):
    ten_god: str
    hidden: list[HiddenOut]
    stage: str                 # 봉법: 일간 → 이 지지
    period: str                # 봉법 간명 시기 (년지 초년운 · 월지 청년운 · 일지 장년운 · 시지 노년운)
    stage_geo: str             # 거법: 같은 기둥 천간 → 이 지지
    stage_jwa: list[JwaOut]    # 좌법: 지장간 각각 → 이 지지
    sinsal: list[str]
    gongmang: list[str]        # ["일주"], ["년주"] 등


class PillarOut(BaseModel):
    key: Literal["h", "d", "m", "y"]
    label: str
    ganji: str
    stem: StemOut
    branch: BranchOut


class TermOut(BaseModel):
    name: str
    time: str                  # ISO
    is_jeol: bool


class LunarOut(BaseModel):
    year: int
    month: int
    day: int
    is_leap: bool


class MetaOut(BaseModel):
    solar_date: Date
    lunar: Optional[LunarOut]
    input_time: Optional[str]
    adjusted_time: Optional[str]
    correction_minutes: Optional[int]
    tz_hours: float
    dst_applied: bool
    prev_jeol: TermOut
    next_jeol: TermOut
    gender: str
    yinyang_gender: str        # 양남 / 음녀 ...
    near_term_warning: bool    # 절입 ±5분 이내


class ScorePart(BaseModel):
    score: int
    max: int
    desc: str


class StrengthOut(BaseModel):
    score: int
    label: str
    deukryeong: ScorePart
    deukji: ScorePart
    deukse: ScorePart
    wolryeong_branch: str
    wolryeong_element: str
    wolryeong_deuk: bool


class InteractionOut(BaseModel):
    id: str
    kind: str                  # 합 충 형 파 해
    sub: str
    label: str
    slots: list[str]
    chars: list[str]
    positions: str
    strength: float
    result: Optional[str]
    degree: Optional[float]
    note: str
    desc: str
    effects: list[str]         # 예: ["寅 목 -32%"]


class ElementRow(BaseModel):
    element: str
    hanja: str
    count: int                 # 원국 겉글자 개수
    static_pct: float
    after_pct: float
    reason: str


class ContribOut(BaseModel):
    label: str
    kind: str                  # stem main hidden plus minus
    value: float


class TenGodRow(BaseModel):
    ten_god: str
    group: str
    static_pct: float
    after_pct: float
    contrib: list[ContribOut]


class GroupRow(BaseModel):
    group: str
    element: str
    static_pct: float
    after_pct: float
    note: str


class Scenario(BaseModel):
    key: Literal["natal", "daewoon", "sewoon"]
    extra: list[str]           # 추가된 운 간지 (예: ["己巳"])
    interactions: list[InteractionOut]
    total: float
    counts: dict[str, int]
    elements: list[ElementRow]
    yang: int
    yin: int
    ten_gods: list[TenGodRow]
    groups: list[GroupRow]


class GyeokOut(BaseModel):
    name: str
    hanja: str
    reason: str
    note: str


class YongsinOut(BaseModel):
    role: str
    group: str
    element: str
    element_hanja: str
    reason: str


class SiryeongOut(BaseModel):
    days_since: int
    term_name: str
    stem_hanja: str
    role: str
    text: str


class InjongOut(BaseModel):
    group: str
    ten_god: str
    hanja: str
    element: str
    yinyang: str
    source: str                # 년간 / 월간 / 시간 / 가정
    assumed: bool
    stage: str
    energy: int


class StageCell(BaseModel):
    stage: str
    branch: str
    energy: int
    marks: list[str]           # 이 지지에 앉은 원국 위치 (시지/일지/...)


class SinsalOut(BaseModel):
    name: str
    hanja: str
    rule: str
    targets: list[str]
    positions: list[str]
    present: bool
    keyword: str


class GongmangOut(BaseModel):
    basis: str                 # 일주 / 년주
    pillar: str
    xun: str                   # 甲子旬
    xun_pillars: list[str]
    void: list[str]
    hits: list[str]            # 해당 위치 라벨
    filled_by_sewoon: bool


class SlotGodOut(BaseModel):
    ten_god: str
    hanja: str
    role: str                  # 천간 / 여기 / 중기 / 정기
    share: float
    power: float


class SlotPowerOut(BaseModel):
    id: str
    label: str
    kind: Literal["stem", "branch"]
    hanja: str
    element: str
    season: str                # 왕 상 휴 수 사 (월령 대비)
    season_factor: float
    interaction_factor: float  # 합충형파해 작용 후 잔존율
    score: int                 # 100 = 보통
    level: str                 # 강 / 보통 / 약 / 매우 약
    causes: list[str]
    ten_gods: list[SlotGodOut]


class TenGodMeaningOut(BaseModel):
    ten_god: str
    hanja: str
    yukchin: str
    domains: str
    strength_trait: str
    caution: str


class LuckPillarOut(BaseModel):
    ganji: str
    stem: Char
    branch: Char
    stem_ten_god: str
    branch_ten_god: str
    start_age: float
    age_label: str
    start_year: int
    current: bool
    strength_by_kind: dict[str, float]
    total: float
    top: list[str]
    interactions: list["InteractionOut"]
    sewoon: list["SewoonOut"]


class SewoonOut(BaseModel):
    year: int
    ganji: str
    stem: Char
    branch: Char
    stem_ten_god: str
    branch_ten_god: str
    current: bool


class LuckOut(BaseModel):
    forward: bool
    start_label: str
    days_to_term: float
    pillars: list[LuckPillarOut]
    sewoon: list[SewoonOut]
    notes: list[str]


class AnalyzeResponse(BaseModel):
    meta: MetaOut
    pillars: list[Optional[PillarOut]]       # [시, 일, 월, 년] — 시주 모르면 첫 항목 null
    day_master: Char
    strength: StrengthOut
    scenarios: list[Scenario]
    gyeok: GyeokOut
    yongsin: list[YongsinOut]
    summary: list[str]
    siryeong: SiryeongOut
    twelve_cycle: list[StageCell]
    sinsal: list[SinsalOut]
    gongmang: list[GongmangOut]
    luck: LuckOut
    slot_power: list[SlotPowerOut]
    injong_branch: str                       # 인종법 기준 지지 (일지)
    injong: list[InjongOut]
    ten_god_meanings: list[TenGodMeaningOut]


# ───────── 달력 / 오늘 ─────────
class DayCell(BaseModel):
    date: Date
    weekday: int               # 0=월
    ganji: str
    stem: Char
    branch: Char
    lunar: Optional[LunarOut]
    terms: list[TermOut]


class MonthPillarSpan(BaseModel):
    ganji: str
    stem: Char
    branch: Char
    jeol_name: str
    start: str                 # ISO


class CalendarResponse(BaseModel):
    year: int
    month: int
    year_ganji: str
    days: list[DayCell]
    month_pillars: list[MonthPillarSpan]     # 이 달에 걸친 월건 (보통 2개)
    year_flow: list[MonthPillarSpan]         # 그 해 입춘부터 12절


class PillarNow(BaseModel):
    ganji: str
    stem: Char
    branch: Char


class HourSlot(BaseModel):
    ganji: str
    stem: Char
    branch: Char
    start: str                 # HH:MM (표준시)
    end: str
    current: bool


class NowResponse(BaseModel):
    now: str
    year: PillarNow
    month: PillarNow
    day: PillarNow
    hour: PillarNow
    lunar: Optional[LunarOut]
    prev_term: TermOut
    next_term: TermOut
    days_since_term: int
    days_to_term: int
    month_jeol: TermOut
    next_month_jeol: TermOut
    hours: list[HourSlot]
    correction_minutes: int


class SearchHit(BaseModel):
    date: Date
    ganji: str


class SearchResponse(BaseModel):
    query: str
    kind: str
    hits: list[SearchHit]
