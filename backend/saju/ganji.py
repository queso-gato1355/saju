"""천간·지지 공통 부모 클래스"""
from __future__ import annotations

from typing import TYPE_CHECKING, ClassVar

from .enums import Element, YinYang
from .relation import Relation

if TYPE_CHECKING:
    from .stem import Stem


def pairkey(a: int, b: int) -> frozenset:
    """순서 무관한 두 인덱스 쌍 키"""
    return frozenset((a, b))


class GanJi:
    """천간·지지 공통 부모. 이름으로 생성하면 항상 같은 인스턴스(싱글턴).

    연산자 (같은 계열끼리 비교, 관계 없으면 None)
      a & b   → 합   (천간합 / 지지 육합·반합)
      a ^ b   → 충
      a % b   → 형   (지지 전용)
      a // b  → 파   (지지 전용)
      a - b   → 해   (지지 전용)
      a.relations(b) → 위 관계 전부를 list[Relation]으로
    """

    _TABLE: ClassVar[list[tuple]] = []           # 하위 클래스가 채움

    def __new__(cls, key):
        if isinstance(key, cls):
            return key
        idx = cls._resolve(key)
        cache = cls.__dict__.get("_instances")
        if cache is None:
            cache = {}
            setattr(cls, "_instances", cache)
        if idx not in cache:
            obj = super().__new__(cls)
            obj._init(idx)
            cache[idx] = obj
        return cache[idx]

    @classmethod
    def _resolve(cls, key) -> int:
        if isinstance(key, int):
            if not 0 <= key < len(cls._TABLE):
                raise ValueError(f"{cls.__name__} index out of range: {key}")
            return key
        for i, row in enumerate(cls._TABLE):
            if key in (row[0], row[1]):
                return i
        raise ValueError(f"알 수 없는 {cls.__name__}: {key!r}")

    def _init(self, idx: int) -> None:
        row = self._TABLE[idx]
        self.index: int = idx
        self.name: str = row[0]
        self.hanja: str = row[1]
        self.element: Element = row[2]
        self.yinyang: YinYang = row[3]

    @classmethod
    def all(cls) -> list:
        return [cls(i) for i in range(len(cls._TABLE))]

    # 십성: 일간(day_master) 기준으로 이 글자의 오행·음양이 무엇인지
    def ten_god(self, day_master: "Stem") -> str:
        me, other = day_master.element, self.element
        same = day_master.yinyang == self.yinyang
        if other == me:
            return "비견" if same else "겁재"
        if me.generates == other:
            return "식신" if same else "상관"
        if me.controls == other:
            return "편재" if same else "정재"
        if other.controls == me:
            return "편관" if same else "정관"
        if other.generates == me:
            return "편인" if same else "정인"
        raise RuntimeError("unreachable")

    # ── 연산자: 하위 클래스가 _hap/_chung/... 를 구현 ──
    def _check(self, other):
        if type(other) is not type(self):
            return NotImplemented
        return None

    def __and__(self, other):
        return self._check(other) or self._hap(other)

    def __xor__(self, other):
        return self._check(other) or self._chung(other)

    def __mod__(self, other):
        return self._check(other) or self._hyung(other)

    def __floordiv__(self, other):
        return self._check(other) or self._pa(other)

    def __sub__(self, other):
        return self._check(other) or self._hae(other)

    def _hap(self, o): return None
    def _chung(self, o): return None
    def _hyung(self, o): return None
    def _pa(self, o): return None
    def _hae(self, o): return None

    def relations(self, other) -> list[Relation]:
        out = []
        for fn in (self._hap, self._chung, self._hyung, self._pa, self._hae):
            r = fn(other)
            if r:
                out.append(r)
        return out

    def __repr__(self) -> str:
        return f"{type(self).__name__}({self.name}{self.hanja})"

    def __str__(self) -> str:
        return self.name

    def __hash__(self) -> int:
        return hash((type(self).__name__, self.index))

    def __eq__(self, other) -> bool:
        return self is other
