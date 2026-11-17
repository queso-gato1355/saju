"""대운(大運) · 세운(歲運)

대운 방향: 양남음녀(년간 양 + 남 / 년간 음 + 여) 순행, 음남양녀 역행.
대운수: 출생 시각부터 (순행) 다음 절입 / (역행) 직전 절입까지의 일수 ÷ 3.
  rounding = "round"(반올림, 기본) | "floor"(버림) | "precise"(년·개월까지)
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from .enums import YinYang
from .four_pillars import FourPillars
from .pillar import Pillar


@dataclass(frozen=True)
class LuckPillar:
    pillar: Pillar
    start_age: float          # 만 나이 기준 시작 (precise 모드에서 소수)
    start_year: int           # 시작 양력 연도 (근사)


@dataclass(frozen=True)
class LuckInfo:
    forward: bool
    days_to_term: float
    start_age: float          # 대운수
    start_label: str          # 예: "3세" / "3년 4개월"
    pillars: list[LuckPillar]


def is_forward(chart: FourPillars, gender: str) -> bool:
    yang_year = chart.year.stem.yinyang is YinYang.YANG
    return yang_year == (gender == "M")


def compute_luck(chart: FourPillars, birth_moment: datetime, gender: str,
                 rounding: str = "round", count: int = 10) -> LuckInfo:
    forward = is_forward(chart, gender)
    target = chart.next_jeol.time if forward else chart.prev_jeol.time
    days = abs((target - birth_moment).total_seconds()) / 86400.0
    raw = days / 3.0                       # 3일 = 1년
    if rounding == "floor":
        start = float(int(raw))
        label = f"{int(start)}세"
    elif rounding == "precise":
        years = int(raw)
        months = int(round((raw - years) * 12))
        if months == 12:
            years, months = years + 1, 0
        start = years + months / 12
        label = f"{years}년 {months}개월"
    else:
        start = float(int(raw + 0.5))
        label = f"{int(start)}세"
    if start == 0 and rounding != "precise":
        start = 1.0                        # 대운수 0은 1로 본다 (관행)
        label = "1세"

    step = 1 if forward else -1
    base = chart.month.sexagenary_index
    birth_year = birth_moment.year
    pillars = [
        LuckPillar(Pillar.from_index(base + step * (i + 1)), start + 10 * i,
                   birth_year + int(start + 10 * i))
        for i in range(count)
    ]
    return LuckInfo(forward, round(days, 2), start, label, pillars)


def year_pillar(year: int) -> Pillar:
    """세운: 해당 양력 연도(입춘 이후)의 년주"""
    return Pillar.from_index((year - 4) % 60)


def current_luck(info: LuckInfo, age: float) -> LuckPillar | None:
    cur = None
    for lp in info.pillars:
        if age >= lp.start_age:
            cur = lp
    return cur
