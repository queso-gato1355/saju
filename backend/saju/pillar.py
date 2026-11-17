"""기둥 (천간 + 지지)"""
from __future__ import annotations

from .branch import Branch
from .relation import Relation
from .stem import Stem


class Pillar:
    """천간 + 지지. 60갑자 음양 일치 검사 포함."""

    def __init__(self, stem, branch):
        self.stem = Stem(stem)
        self.branch = Branch(branch)
        if self.stem.index % 2 != self.branch.index % 2:
            raise ValueError(f"{self.stem.name}{self.branch.name}: 60갑자에 없는 조합(음양 불일치)")

    @classmethod
    def from_str(cls, s: str) -> "Pillar":
        return cls(s[0], s[1])

    @classmethod
    def from_index(cls, i: int) -> "Pillar":
        """60갑자 순번(갑자=0 ... 계해=59)으로 생성"""
        i %= 60
        return cls(i % 10, i % 12)

    @property
    def sexagenary_index(self) -> int:
        """갑자=0 ... 계해=59"""
        s, b = self.stem.index, self.branch.index
        return next(i for i in range(60) if i % 10 == s and i % 12 == b)

    @property
    def gongmang(self) -> tuple[Branch, Branch]:
        """이 기둥이 속한 순(旬)의 공망 두 지지"""
        d = self.branch.index - self.stem.index
        return Branch((d + 10) % 12), Branch((d + 11) % 12)

    def relations(self, other: "Pillar") -> dict[str, list[Relation]]:
        return {
            "천간": self.stem.relations(other.stem),
            "지지": self.branch.relations(other.branch),
        }

    def __and__(self, other: "Pillar"):
        return (self.stem & other.stem, self.branch & other.branch)

    def __xor__(self, other: "Pillar"):
        return (self.stem ^ other.stem, self.branch ^ other.branch)

    def __eq__(self, other) -> bool:
        return isinstance(other, Pillar) and self.stem is other.stem and self.branch is other.branch

    def __hash__(self) -> int:
        return hash((self.stem, self.branch))

    def __str__(self) -> str:
        return f"{self.stem.name}{self.branch.name}"

    def __repr__(self) -> str:
        return f"Pillar({self.stem.name}{self.branch.name} {self.stem.hanja}{self.branch.hanja})"
