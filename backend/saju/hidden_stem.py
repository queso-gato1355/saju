"""지장간 (지지 속에 숨은 천간)"""
from __future__ import annotations

from dataclasses import dataclass

from .stem import Stem


@dataclass(frozen=True)
class HiddenStem:
    stem: Stem
    days: int       # 월률분야 일수
    role: str       # 여기 / 중기 / 정기

    @property
    def weight(self) -> float:
        return self.days / 30

    def __repr__(self) -> str:
        return f"{self.stem.name}({self.role},{self.days}일)"
