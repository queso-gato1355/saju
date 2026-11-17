"""기본 열거형: 오행, 음양, 관계 종류"""
from __future__ import annotations

from enum import Enum


class Element(Enum):
    WOOD = "목"
    FIRE = "화"
    EARTH = "토"
    METAL = "금"
    WATER = "수"

    @property
    def generates(self) -> "Element":  # 생
        order = list(Element)
        return order[(order.index(self) + 1) % 5]

    @property
    def controls(self) -> "Element":  # 극
        order = list(Element)
        return order[(order.index(self) + 2) % 5]


class YinYang(Enum):
    YANG = "양"
    YIN = "음"


class RelationType(Enum):
    HAP = "합"
    BANHAP = "반합"
    CHUNG = "충"
    HYUNG = "형"
    PA = "파"
    HAE = "해"
