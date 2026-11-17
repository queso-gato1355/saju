"""만세력: 양력/음력 생년월일시 → 사주 원국(FourPillars)

규칙
  년주  입춘(황경 315°) 기준으로 해가 바뀜. 1984년 = 갑자년
  월주  12절(입춘·경칩·청명...) 기준. 월간은 연간에서 오호둔(갑기년→병인월)
  일주  율리우스일 기준 60갑자 순환 (2000-01-01 = 무오일)
  시주  2시간 단위(자시 23:00~01:00). 시간은 일간에서 오서둔(갑기일→갑자시)

옵션
  tz_hours   입력 시각의 표준시 (기본 +9 KST). 1954-03-21~1961-08-09 한국은 +8.5
  longitude  출생지 경도. 주면 평균태양시로 보정 (서울 126.98° → 약 -32분)
  split_zi   True: 야자시/조자시 구분 (23시대는 일주는 당일, 시간만 다음날 기준)
             False(기본): 23시부터 다음날로 봄
  term_precision  "minute"(기본): 절입 시각을 분 단위로 비교
                  "day": 절입일 하루 전체를 새 절기로 봄 (일 단위 만세력 관행)
  equation_of_time  True: 경도 보정에 균시차까지 더해 진태양시로 (기본 False)
"""
from __future__ import annotations

import math
from datetime import date, datetime, time, timedelta, timezone
from typing import Optional

from .four_pillars import FourPillars
from .pillar import Pillar
from .solar_terms import SolarTerms

_DAY_OFFSET = 49   # (JDN + 49) % 60 → 60갑자 순번 (갑자=0)


class Manseryeok:
    def __init__(self, tz_hours: float = 9.0, longitude: Optional[float] = None,
                 split_zi: bool = False, term_precision: str = "minute",
                 equation_of_time: bool = False):
        self.tz_hours = tz_hours
        self.tz = timezone(timedelta(hours=tz_hours))
        self.longitude = longitude
        self.split_zi = split_zi
        self.term_precision = term_precision
        self.equation_of_time = equation_of_time

    # ── 공개 API ──
    def from_solar(self, year: int, month: int, day: int,
                   hour: Optional[int] = None, minute: int = 0) -> FourPillars:
        """양력 날짜(+시각) → 사주. hour=None 이면 시주 없이 계산."""
        d = date(year, month, day)
        if hour is None:
            # 시각 모름: 정오 기준으로 년·월주 판정
            moment = datetime.combine(d, time(12, 0), self.tz)
            return self._build(d, moment, None)
        moment = datetime.combine(d, time(hour, minute), self.tz)
        return self._build(d, moment, moment)

    def from_lunar(self, year: int, month: int, day: int, is_leap: bool = False,
                   hour: Optional[int] = None, minute: int = 0) -> FourPillars:
        """음력 날짜(+시각) → 사주. korean_lunar_calendar 패키지 필요."""
        y, m, d = self.lunar_to_solar(year, month, day, is_leap)
        return self.from_solar(y, m, d, hour, minute)

    def from_datetime(self, dt: datetime) -> FourPillars:
        if dt.tzinfo is not None:
            dt = dt.astimezone(self.tz)
        return self.from_solar(dt.year, dt.month, dt.day, dt.hour, dt.minute)

    @staticmethod
    def lunar_to_solar(year: int, month: int, day: int, is_leap: bool = False) -> tuple[int, int, int]:
        try:
            from korean_lunar_calendar import KoreanLunarCalendar
        except ImportError as e:
            raise ImportError(
                "음력 입력에는 'korean_lunar_calendar' 패키지가 필요합니다: "
                "pip install korean_lunar_calendar"
            ) from e
        cal = KoreanLunarCalendar()
        if not cal.setLunarDate(year, month, day, is_leap):
            raise ValueError(f"유효하지 않은 음력 날짜: {year}-{month}-{day}{' (윤달)' if is_leap else ''}")
        return cal.solarYear, cal.solarMonth, cal.solarDay

    # ── 각 기둥 계산 ──
    @staticmethod
    def year_pillar_index(saju_year: int) -> int:
        return (saju_year - 4) % 60

    @staticmethod
    def day_pillar_index(d: date) -> int:
        jdn = d.toordinal() + 1721425   # proleptic Gregorian ordinal → JDN
        return (jdn + _DAY_OFFSET) % 60

    @staticmethod
    def month_pillar(year_stem_idx: int, month_no: int) -> Pillar:
        """month_no: 0=인월 ... 11=축월"""
        first = (year_stem_idx % 5) * 2 + 2       # 오호둔: 갑기→병, 을경→무 ...
        return Pillar((first + month_no) % 10, (month_no + 2) % 12)

    @staticmethod
    def hour_pillar(day_stem_idx: int, branch_idx: int) -> Pillar:
        first = (day_stem_idx % 5) * 2            # 오서둔: 갑기→갑자, 을경→병자 ...
        return Pillar((first + branch_idx) % 10, branch_idx)

    @staticmethod
    def hour_branch_index(t: datetime) -> int:
        minutes = t.hour * 60 + t.minute
        return ((minutes + 60) // 120) % 12

    def adjust_time(self, moment: datetime) -> datetime:
        """표준시 → 지방 평균태양시 (longitude 지정 시)"""
        if self.longitude is None:
            return moment
        minutes = (self.longitude - 15 * self.tz_hours) * 4
        if self.equation_of_time:
            minutes += self.equation_of_time_minutes(moment.date())
        return moment + timedelta(minutes=minutes)

    @staticmethod
    def equation_of_time_minutes(d: date) -> float:
        """균시차(진태양시 − 평균태양시, 분). 근사식, 오차 ±1분 이내."""
        b = math.radians(360 / 365 * (d.timetuple().tm_yday - 81))
        return 9.87 * math.sin(2 * b) - 7.53 * math.cos(b) - 1.5 * math.sin(b)

    # ── 조립 ──
    def _build(self, solar_date: date, moment: datetime,
               input_time: Optional[datetime]) -> FourPillars:
        # 년·월주: 절입은 절대 시각이므로 보정 없이 실제 시각으로 비교
        if self.term_precision == "day":
            moment = datetime.combine(moment.date(), time(23, 59, 59), moment.tzinfo)
        lon = SolarTerms.longitude_at(moment)
        month_no = int(((lon - 315.0) % 360.0) // 30)       # 0=인월
        saju_year = moment.year - 1 if (moment.month <= 2 and month_no >= 10) else moment.year
        year = Pillar.from_index(self.year_pillar_index(saju_year))
        month = self.month_pillar(year.stem.index, month_no)
        prev_jeol, next_jeol = SolarTerms.jeol_around(moment)

        # 일·시주
        if input_time is None:
            day = Pillar.from_index(self.day_pillar_index(solar_date))
            return FourPillars(year, month, day, None, solar_date, None, None, prev_jeol, next_jeol)

        adj = self.adjust_time(input_time)
        day_date = adj.date()
        hour_stem_date = day_date
        if adj.hour >= 23:                     # 자시 시작
            hour_stem_date = day_date + timedelta(days=1)
            if not self.split_zi:
                day_date = hour_stem_date
        day = Pillar.from_index(self.day_pillar_index(day_date))
        hs_day = Pillar.from_index(self.day_pillar_index(hour_stem_date))
        hour = self.hour_pillar(hs_day.stem.index, self.hour_branch_index(adj))
        return FourPillars(year, month, day, hour, solar_date, input_time, adj, prev_jeol, next_jeol)
