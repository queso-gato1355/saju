"""만세력 변환 결과: 사주 원국 (년·월·일·시주)"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import Iterator, Optional

from .branch import Branch
from .pillar import Pillar
from .relation import Relation
from .solar_terms import SolarTerm
from .stem import Stem


@dataclass(frozen=True)
class FourPillars:
    year: Pillar
    month: Pillar
    day: Pillar
    hour: Optional[Pillar]          # 생시 모름이면 None
    solar_date: date                # 입력(또는 음력→변환)된 양력 날짜
    input_time: Optional[datetime]  # 입력 시각 (표준시)
    adjusted_time: Optional[datetime]  # 경도 보정 후 시각 (일·시주 계산에 사용)
    prev_jeol: SolarTerm            # 직전 절입 (월주 기준)
    next_jeol: SolarTerm            # 다음 절입

    @property
    def pillars(self) -> list[Pillar]:
        """[년, 월, 일, (시)]"""
        return [p for p in (self.year, self.month, self.day, self.hour) if p is not None]

    def __iter__(self) -> Iterator[Pillar]:
        return iter(self.pillars)

    @property
    def day_master(self) -> Stem:
        """일간"""
        return self.day.stem

    def pair_relations(self) -> list[tuple[Pillar, Pillar, list[Relation]]]:
        ps = self.pillars
        out = []
        for i in range(len(ps)):
            for j in range(i + 1, len(ps)):
                rels = ps[i].relations(ps[j])
                flat = [r for v in rels.values() for r in v]
                if flat:
                    out.append((ps[i], ps[j], flat))
        return out

    def triple_relations(self) -> list[Relation]:
        return Branch.triple_relations([p.branch for p in self.pillars])

    def __str__(self) -> str:
        labels = ["시주", "일주", "월주", "년주"]
        cols = [self.hour, self.day, self.month, self.year]
        head = "  ".join(f"{l:^4}" for l in labels)
        stems = "  ".join(f"{(c.stem.name + c.stem.hanja) if c else '??':^5}" for c in cols)
        brs = "  ".join(f"{(c.branch.name + c.branch.hanja) if c else '??':^5}" for c in cols)
        return f"{head}\n{stems}\n{brs}"
