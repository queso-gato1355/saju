"""천간 (10간)"""
from __future__ import annotations

from .enums import Element as E, RelationType, YinYang as Y
from .ganji import GanJi
from .relation import Relation


class Stem(GanJi):
    _TABLE = [
        ("갑", "甲", E.WOOD, Y.YANG), ("을", "乙", E.WOOD, Y.YIN),
        ("병", "丙", E.FIRE, Y.YANG), ("정", "丁", E.FIRE, Y.YIN),
        ("무", "戊", E.EARTH, Y.YANG), ("기", "己", E.EARTH, Y.YIN),
        ("경", "庚", E.METAL, Y.YANG), ("신", "辛", E.METAL, Y.YIN),
        ("임", "壬", E.WATER, Y.YANG), ("계", "癸", E.WATER, Y.YIN),
    ]

    # 갑기토 을경금 병신수 정임목 무계화 : index 차이 5
    _HAP_RESULT = [E.EARTH, E.METAL, E.WATER, E.WOOD, E.FIRE]

    def _hap(self, o: "Stem"):
        if abs(self.index - o.index) == 5:
            res = self._HAP_RESULT[min(self.index, o.index)]
            return Relation(RelationType.HAP, (self, o), res)
        return None

    def _chung(self, o: "Stem"):
        # 갑경 을신 병임 정계 (무기토는 충 없음)
        if abs(self.index - o.index) == 6 and self.element != E.EARTH and o.element != E.EARTH:
            return Relation(RelationType.CHUNG, (self, o))
        return None
