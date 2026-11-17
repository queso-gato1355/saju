"""24절기 계산 (외부 라이브러리 없이 천문 계산)

태양 겉보기 황경은 Jean Meeus, *Astronomical Algorithms* 32장의 VSOP87 축약 급수
(지구 일심 황경) + 장동 + 광행차로 계산. 절입 시각 오차는 대략 1~2분 이내.
절입 시각 바로 근처(±5분)에 태어난 경우는 KASI(한국천문연구원) 자료로 교차 확인 권장.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from functools import lru_cache
from datetime import datetime, timedelta, timezone

TROPICAL_YEAR = 365.24219
_J2000 = 2451545.0
_UNIX_EPOCH_JD = 2440587.5
_EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)

# VSOP87 지구 일심 황경 L0~L5 (A, B, C) — Meeus 표 32.A (단위 1e-8 rad)
_VSOP_L = [
    [(175347046, 0, 0), (3341656, 4.6692568, 6283.07585), (34894, 4.6261, 12566.1517),
     (3497, 2.7441, 5753.3849), (3418, 2.8289, 3.5231), (3136, 3.6277, 77713.7715),
     (2676, 4.4181, 7860.4194), (2343, 6.1352, 3930.2097), (1324, 0.7425, 11506.7698),
     (1273, 2.0371, 529.691), (1199, 1.1096, 1577.3435), (990, 5.233, 5884.927),
     (902, 2.045, 26.298), (857, 3.508, 398.149), (780, 1.179, 5223.694),
     (753, 2.533, 5507.553), (505, 4.583, 18849.228), (492, 4.205, 775.523),
     (357, 2.92, 0.067), (317, 5.849, 11790.629), (284, 1.899, 796.298),
     (271, 0.315, 10977.079), (243, 0.345, 5486.778), (206, 4.806, 2544.314),
     (205, 1.869, 5573.143), (202, 2.458, 6069.777), (156, 0.833, 213.299),
     (132, 3.411, 2942.463), (126, 1.083, 20.775), (115, 0.645, 0.98),
     (103, 0.636, 4694.003), (102, 0.976, 15720.839), (102, 4.267, 7.114),
     (99, 6.21, 2146.17), (98, 0.68, 155.42), (86, 5.98, 161000.69),
     (85, 1.3, 6275.96), (85, 3.67, 71430.7), (80, 1.81, 17260.15),
     (79, 3.04, 12036.46), (75, 1.76, 5088.63), (74, 3.5, 3154.69),
     (74, 4.68, 801.82), (70, 0.83, 9437.76), (62, 3.98, 8827.39),
     (61, 1.82, 7084.9), (57, 2.78, 6286.6), (56, 4.39, 14143.5),
     (56, 3.47, 6279.55), (52, 0.19, 12139.55), (52, 1.33, 1748.02),
     (51, 0.28, 5856.48), (49, 0.49, 1194.45), (41, 5.37, 8429.24),
     (41, 2.4, 19651.05), (39, 6.17, 10447.39), (37, 6.04, 10213.29),
     (37, 2.57, 1059.38), (36, 1.71, 2352.87), (36, 1.78, 6812.77),
     (33, 0.59, 17789.85), (30, 0.44, 83996.85), (30, 2.74, 1349.87),
     (25, 3.16, 4690.48)],
    [(628331966747, 0, 0), (206059, 2.678235, 6283.07585), (4303, 2.6351, 12566.1517),
     (425, 1.59, 3.523), (119, 5.796, 26.298), (109, 2.966, 1577.344),
     (93, 2.59, 18849.23), (72, 1.14, 529.69), (68, 1.87, 398.15),
     (67, 4.41, 5507.55), (59, 2.89, 5223.69), (56, 2.17, 155.42),
     (45, 0.4, 796.3), (36, 0.47, 775.52), (29, 2.65, 7.11),
     (21, 5.34, 0.98), (19, 1.85, 5486.78), (19, 4.97, 213.3),
     (17, 2.99, 6275.96), (16, 0.03, 2544.31), (16, 1.43, 2146.17),
     (15, 1.21, 10977.08), (12, 2.83, 1748.02), (12, 3.26, 5088.63),
     (12, 5.27, 1194.45), (12, 2.08, 4694.0), (11, 0.77, 553.57),
     (10, 1.3, 6286.6), (10, 4.24, 1349.87), (9, 2.7, 242.73),
     (9, 5.64, 951.72), (8, 5.3, 2352.87), (6, 2.65, 9437.76),
     (6, 4.67, 4690.48)],
    [(52919, 0, 0), (8720, 1.0721, 6283.0758), (309, 0.867, 12566.152),
     (27, 0.05, 3.52), (16, 5.19, 26.3), (16, 3.68, 155.42),
     (10, 0.76, 18849.23), (9, 2.06, 77713.77), (7, 0.83, 775.52),
     (5, 4.66, 1577.34), (4, 1.03, 7.11), (4, 3.44, 5573.14),
     (3, 5.14, 796.3), (3, 6.05, 5507.55), (3, 1.19, 242.73),
     (3, 6.12, 529.69), (3, 0.31, 398.15), (3, 2.28, 553.57),
     (2, 4.38, 5223.69), (2, 3.75, 0.98)],
    [(289, 5.844, 6283.076), (35, 0, 0), (17, 5.49, 12566.15),
     (3, 5.2, 155.42), (1, 4.72, 3.52), (1, 5.3, 18849.23), (1, 5.97, 242.73)],
    [(114, 3.142, 0), (8, 4.13, 6283.08), (1, 3.84, 12566.15)],
    [(1, 3.14, 0)],
]
# 지구-태양 거리 R (광행차 보정용, 주요 항만)
_VSOP_R = [
    [(100013989, 0, 0), (1670700, 3.0984635, 6283.07585), (13956, 3.05525, 12566.1517),
     (3084, 5.1985, 77713.7715), (1628, 1.1739, 5753.3849), (1576, 2.8469, 7860.4194)],
    [(103019, 1.10749, 6283.07585), (1721, 1.0644, 12566.1517)],
    [(4359, 5.7846, 6283.0758)],
]


@dataclass(frozen=True)
class SolarTerm:
    name: str
    longitude: int          # 태양 황경 (도)
    time: datetime          # 절입 시각 (tz-aware)

    @property
    def is_jeol(self) -> bool:
        """'절'(월의 시작) 여부. 중기(우수·춘분...)면 False"""
        return (self.longitude - 315) % 30 == 0

    def __str__(self) -> str:
        return f"{self.name} {self.time:%Y-%m-%d %H:%M}"


class SolarTerms:
    # 황경 0°(춘분)부터 15° 간격
    NAMES = [
        "춘분", "청명", "곡우", "입하", "소만", "망종",
        "하지", "소서", "대서", "입추", "처서", "백로",
        "추분", "한로", "상강", "입동", "소설", "대설",
        "동지", "소한", "대한", "입춘", "우수", "경칩",
    ]

    # ── 시간 변환 ──
    @staticmethod
    def julian_day(dt: datetime) -> float:
        """tz-aware datetime → 율리우스일(UT)"""
        return dt.timestamp() / 86400.0 + _UNIX_EPOCH_JD

    @staticmethod
    def from_julian_day(jd: float, tz: timezone) -> datetime:
        ts = (jd - _UNIX_EPOCH_JD) * 86400.0
        # fromtimestamp 는 Windows 에서 1970년 이전(음수)을 지원하지 않으므로 직접 더한다
        return (_EPOCH + timedelta(seconds=round(ts))).astimezone(tz)

    @staticmethod
    def delta_t(year: float) -> float:
        """ΔT = TT - UT (초). Espenak & Meeus 다항식 근사."""
        y = year
        if y < 1900:
            u = (y - 1820) / 100
            return -20 + 32 * u * u
        if y < 1920:
            t = y - 1900
            return -2.79 + 1.494119 * t - 0.0598939 * t**2 + 0.0061966 * t**3 - 0.000197 * t**4
        if y < 1941:
            t = y - 1920
            return 21.20 + 0.84493 * t - 0.076100 * t**2 + 0.0020936 * t**3
        if y < 1961:
            t = y - 1950
            return 29.07 + 0.407 * t - t**2 / 233 + t**3 / 2547
        if y < 1986:
            t = y - 1975
            return 45.45 + 1.067 * t - t**2 / 260 - t**3 / 718
        if y < 2005:
            t = y - 2000
            return (63.86 + 0.3345 * t - 0.060374 * t**2 + 0.0017275 * t**3
                    + 0.000651814 * t**4 + 0.00002373599 * t**5)
        if y < 2050:
            t = y - 2000
            return 62.92 + 0.32217 * t + 0.005589 * t**2
        if y < 2150:
            return -20 + 32 * ((y - 1820) / 100) ** 2 - 0.5628 * (2150 - y)
        u = (y - 1820) / 100
        return -20 + 32 * u * u

    # ── 태양 황경 ──
    @staticmethod
    def _series(terms, tau: float) -> float:
        return sum(a * math.cos(b + c * tau) for a, b, c in terms)

    @classmethod
    def sun_longitude(cls, jd_ut: float) -> float:
        """태양 겉보기 황경(도, 0~360). VSOP87 축약(Meeus 32장) + 장동 + 광행차"""
        year = 2000 + (jd_ut - _J2000) / 365.25
        jde = jd_ut + cls.delta_t(year) / 86400.0
        t = (jde - _J2000) / 36525.0
        tau = t / 10.0
        l_earth = sum(cls._series(terms, tau) * tau ** i
                      for i, terms in enumerate(_VSOP_L)) / 1e8
        r = sum(cls._series(terms, tau) * tau ** i
                for i, terms in enumerate(_VSOP_R)) / 1e8
        lon = math.degrees(l_earth) + 180.0               # 지구 → 태양 기하 황경
        lon -= 0.09033 / 3600.0                            # FK5 보정
        # 장동 (황경 성분, 주요 4항)
        omega = math.radians(125.04452 - 1934.136261 * t)
        ls = math.radians(280.4665 + 36000.7698 * t)
        lm = math.radians(218.3165 + 481267.8813 * t)
        dpsi = (-17.20 * math.sin(omega) - 1.32 * math.sin(2 * ls)
                - 0.23 * math.sin(2 * lm) + 0.21 * math.sin(2 * omega))
        lon += dpsi / 3600.0
        lon -= 20.4898 / 3600.0 / r                        # 광행차
        return lon % 360.0

    @classmethod
    def longitude_at(cls, dt: datetime) -> float:
        return cls.sun_longitude(cls.julian_day(dt))

    # ── 절기 시각 찾기 ──
    @classmethod
    def _solve(cls, longitude: float, jd_guess: float) -> float:
        jd = jd_guess
        for _ in range(50):
            diff = (longitude - cls.sun_longitude(jd) + 180.0) % 360.0 - 180.0
            jd += diff / 360.0 * TROPICAL_YEAR
            if abs(diff) < 1e-7:
                break
        return jd

    @classmethod
    def find(cls, year: int, longitude: int, tz: timezone) -> SolarTerm:
        """year(양력) 안에 드는, 황경 longitude 절기의 시각"""
        longitude %= 360
        spring = cls.julian_day(datetime(year, 3, 20, tzinfo=timezone.utc))
        offset = longitude / 360.0 * TROPICAL_YEAR
        if longitude >= 285:          # 소한~경칩은 춘분 이전(1~3월)
            offset -= TROPICAL_YEAR
        jd = cls._solve(longitude, spring + offset)
        return SolarTerm(cls.NAMES[longitude // 15], longitude, cls.from_julian_day(jd, tz))

    @classmethod
    def of_year(cls, year: int, tz: timezone) -> list[SolarTerm]:
        """해당 양력 연도의 24절기 (시간순). 결과는 캐시된다(순수 함수)."""
        return list(_of_year_cached(year, tz))

    @classmethod
    def jeol_around(cls, dt: datetime) -> tuple[SolarTerm, SolarTerm]:
        """dt 직전·직후의 '절'(월 경계) 두 개. 대운 계산 등에 사용."""
        tz = dt.tzinfo
        jeols = [s for y in (dt.year - 1, dt.year, dt.year + 1)
                 for s in cls.of_year(y, tz) if s.is_jeol]
        jeols.sort(key=lambda s: s.time)
        for prev, nxt in zip(jeols, jeols[1:]):
            if prev.time <= dt < nxt.time:
                return prev, nxt
        raise RuntimeError("절기를 찾지 못했습니다")


@lru_cache(maxsize=512)
def _of_year_cached(year: int, tz: timezone) -> tuple[SolarTerm, ...]:
    terms = [SolarTerms.find(year, i * 15, tz) for i in range(24)]
    return tuple(sorted(terms, key=lambda s: s.time))
