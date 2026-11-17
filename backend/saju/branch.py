"""지지 (12지, 지장간 포함)"""
from __future__ import annotations

from .enums import Element as E, RelationType, YinYang as Y
from .ganji import GanJi, pairkey
from .hidden_stem import HiddenStem
from .relation import Relation
from .stem import Stem


class Branch(GanJi):
    _TABLE = [
        ("자", "子", E.WATER, Y.YANG), ("축", "丑", E.EARTH, Y.YIN),
        ("인", "寅", E.WOOD, Y.YANG), ("묘", "卯", E.WOOD, Y.YIN),
        ("진", "辰", E.EARTH, Y.YANG), ("사", "巳", E.FIRE, Y.YIN),
        ("오", "午", E.FIRE, Y.YANG), ("미", "未", E.EARTH, Y.YIN),
        ("신", "申", E.METAL, Y.YANG), ("유", "酉", E.METAL, Y.YIN),
        ("술", "戌", E.EARTH, Y.YANG), ("해", "亥", E.WATER, Y.YIN),
    ]
    # 주의: 자·오·사·해는 체(體)와 용(用)의 음양이 반대.
    # 위 표는 '체' 기준(자=양수). 십성 계산 시엔 정기 지장간을 쓰는 것이 일반적
    # → Branch.ten_god 는 정기 기준으로 오버라이드.

    # 월률분야 지장간 (여기, 중기, 정기) — 학파별 차이 있음, 표만 바꾸면 됨
    _HIDDEN = {
        "자": [("임", 10, "여기"), ("계", 20, "정기")],
        "축": [("계", 9, "여기"), ("신", 3, "중기"), ("기", 18, "정기")],
        "인": [("무", 7, "여기"), ("병", 7, "중기"), ("갑", 16, "정기")],
        "묘": [("갑", 10, "여기"), ("을", 20, "정기")],
        "진": [("을", 9, "여기"), ("계", 3, "중기"), ("무", 18, "정기")],
        "사": [("무", 7, "여기"), ("경", 7, "중기"), ("병", 16, "정기")],
        "오": [("병", 10, "여기"), ("기", 9, "중기"), ("정", 11, "정기")],
        "미": [("정", 9, "여기"), ("을", 3, "중기"), ("기", 18, "정기")],
        "신": [("무", 7, "여기"), ("임", 7, "중기"), ("경", 16, "정기")],
        "유": [("경", 10, "여기"), ("신", 20, "정기")],
        "술": [("신", 9, "여기"), ("정", 3, "중기"), ("무", 18, "정기")],
        "해": [("무", 7, "여기"), ("갑", 7, "중기"), ("임", 16, "정기")],
    }

    # 육합 (자축토 인해목 묘술화 진유금 사신수 오미화/토)
    _YUKHAP = {
        pairkey(0, 1): E.EARTH, pairkey(2, 11): E.WOOD, pairkey(3, 10): E.FIRE,
        pairkey(4, 9): E.METAL, pairkey(5, 8): E.WATER, pairkey(6, 7): E.FIRE,
    }
    # 삼합 (생지, 왕지, 고지) → 오행
    SAMHAP = {
        (8, 0, 4): E.WATER,   # 신자진
        (11, 3, 7): E.WOOD,   # 해묘미
        (2, 6, 10): E.FIRE,   # 인오술
        (5, 9, 1): E.METAL,   # 사유축
    }
    # 방합
    BANGHAP = {
        (2, 3, 4): E.WOOD, (5, 6, 7): E.FIRE,
        (8, 9, 10): E.METAL, (11, 0, 1): E.WATER,
    }
    _PA = {pairkey(*p) for p in [(0, 9), (1, 4), (2, 11), (3, 6), (5, 8), (10, 7)]}
    _HAE = {pairkey(*p) for p in [(0, 7), (1, 6), (2, 5), (3, 4), (8, 11), (9, 10)]}
    # 형
    _SAMHYUNG = {
        frozenset((2, 5, 8)): "무은지형",   # 인사신
        frozenset((1, 10, 7)): "지세지형",  # 축술미
    }
    _SANGHYUNG = {pairkey(0, 3): "무례지형"}  # 자묘
    _JAHYUNG = {4, 6, 9, 11}                   # 진오유해 자형

    def _init(self, idx: int) -> None:
        super()._init(idx)
        self.hidden: list[HiddenStem] = [
            HiddenStem(Stem(s), d, r) for s, d, r in self._HIDDEN[self.name]
        ]

    @property
    def main_qi(self) -> Stem:
        """정기 (본기)"""
        return self.hidden[-1].stem

    def ten_god(self, day_master: Stem) -> str:
        return self.main_qi.ten_god(day_master)

    def hidden_ten_gods(self, day_master: Stem) -> list[tuple[HiddenStem, str]]:
        return [(h, h.stem.ten_god(day_master)) for h in self.hidden]

    # ── 2자 관계 ──
    def _hap(self, o: "Branch"):
        key = pairkey(self.index, o.index)
        if key in self._YUKHAP:
            return Relation(RelationType.HAP, (self, o), self._YUKHAP[key], "육합")
        # 반합: 삼합 중 왕지를 포함한 두 글자
        for trio, el in self.SAMHAP.items():
            if self.index in trio and o.index in trio and self is not o:
                has_wang = trio[1] in (self.index, o.index)
                note = "반합(왕지 포함)" if has_wang else "반합(생지+고지, 약함)"
                return Relation(RelationType.BANHAP, (self, o), el, note)
        return None

    def _chung(self, o: "Branch"):
        if (self.index - o.index) % 12 == 6:
            return Relation(RelationType.CHUNG, (self, o))
        return None

    def _hyung(self, o: "Branch"):
        if self is o and self.index in self._JAHYUNG:
            return Relation(RelationType.HYUNG, (self, o), note="자형")
        key = pairkey(self.index, o.index)
        if key in self._SANGHYUNG:
            return Relation(RelationType.HYUNG, (self, o), note=self._SANGHYUNG[key])
        if self is not o:
            for trio, kind in self._SAMHYUNG.items():
                if key <= trio:
                    return Relation(RelationType.HYUNG, (self, o), note=f"{kind}(2자)")
        return None

    def _pa(self, o: "Branch"):
        if pairkey(self.index, o.index) in self._PA and self is not o:
            return Relation(RelationType.PA, (self, o))
        return None

    def _hae(self, o: "Branch"):
        if pairkey(self.index, o.index) in self._HAE and self is not o:
            return Relation(RelationType.HAE, (self, o))
        return None

    # ── 3자 관계 (원국 전체에서 호출) ──
    @classmethod
    def triple_relations(cls, branches: list["Branch"]) -> list[Relation]:
        idxs = {b.index for b in branches}
        out = []
        for trio, el in cls.SAMHAP.items():
            if set(trio) <= idxs:
                out.append(Relation(RelationType.HAP, tuple(cls(i) for i in trio), el, "삼합"))
        for trio, el in cls.BANGHAP.items():
            if set(trio) <= idxs:
                out.append(Relation(RelationType.HAP, tuple(cls(i) for i in trio), el, "방합"))
        for trio, kind in cls._SAMHYUNG.items():
            if trio <= idxs:
                out.append(Relation(RelationType.HYUNG, tuple(cls(i) for i in sorted(trio)), note=f"{kind}(삼형)"))
        return out
