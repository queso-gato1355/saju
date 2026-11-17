"""두(세) 글자 사이의 관계(합·충·형·파·해)를 표현하는 값 객체"""
from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Optional

from .enums import Element, RelationType

if TYPE_CHECKING:
    from .ganji import GanJi


@dataclass(frozen=True)
class Relation:
    kind: RelationType
    members: tuple["GanJi", ...]
    result: Optional[Element] = None  # 합화 오행
    note: str = ""                    # 형의 종류 등 부가정보

    def __str__(self) -> str:
        names = "".join(m.name for m in self.members)
        res = f"→{self.result.value}" if self.result else ""
        note = f" ({self.note})" if self.note else ""
        return f"{names} {self.kind.value}{res}{note}"
