"""신살 (神殺)

주요 신살만 다룬다. 기준 지지(년지/일지)나 일간에 따라 '해당 글자'를 정하고,
원국에 그 글자가 있으면 '해당'으로 본다.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from .branch import Branch
from .pillar import Pillar
from .stem import Stem

# 삼합 그룹(지지 index) → (역마, 도화, 화개)
_SAMHAP_GROUP = {
    frozenset((8, 0, 4)): (2, 9, 4),     # 신자진 → 인 / 유 / 진
    frozenset((2, 6, 10)): (8, 3, 10),   # 인오술 → 신 / 묘 / 술
    frozenset((5, 9, 1)): (11, 6, 1),    # 사유축 → 해 / 오 / 축
    frozenset((11, 3, 7)): (5, 0, 7),    # 해묘미 → 사 / 자 / 미
}

# 일간 index → 천을귀인 지지들
_CHEONEUL = {0: (1, 7), 4: (1, 7), 6: (1, 7), 1: (0, 8), 5: (0, 8),
             2: (11, 9), 3: (11, 9), 7: (2, 6), 8: (5, 3), 9: (5, 3)}
# 일간 index → 문창귀인
_MUNCHANG = {0: 5, 1: 6, 2: 8, 3: 9, 4: 8, 5: 9, 6: 11, 7: 0, 8: 2, 9: 3}
# 양간 → 양인 (양간만 인정)
_YANGIN = {0: 3, 2: 6, 4: 6, 6: 9, 8: 0}
# 현침살: 글자 모양에 침(針)이 있는 글자
_HYEONCHIM_STEMS = {0, 7}          # 甲 辛
_HYEONCHIM_BRANCHES = {3, 6, 8}    # 卯 午 申
# 괴강 · 백호 (일주 등 기둥 단위)
_GOEGANG = {"경진", "경술", "임진", "임술", "무술"}
_BAEKHO = {"갑진", "을미", "병술", "정축", "무진", "임술", "계축"}

KEYWORDS = {
    "역마살": "이동 · 변동 · 해외",
    "도화살": "매력 · 인기 · 대인관계",
    "화개살": "학문 · 예술 · 종교",
    "천을귀인": "조력 · 귀인의 도움",
    "문창귀인": "학업 · 문서 · 총명",
    "양인": "결단 · 강한 추진력",
    "현침살": "예리함 · 정밀 작업",
    "괴강살": "강한 기질 · 리더십",
    "백호살": "강렬한 기운 · 사고 주의",
}
HANJA = {
    "역마살": "驛馬", "도화살": "桃花", "화개살": "華蓋", "천을귀인": "天乙貴人",
    "문창귀인": "文昌貴人", "양인": "羊刃", "현침살": "懸針", "괴강살": "魁罡", "백호살": "白虎",
}


@dataclass
class SinsalHit:
    name: str
    rule: str                                  # 판정 근거 (예: "년지 申 → 寅")
    targets: list[str]                         # 찾는 글자(한자)
    positions: list[str] = field(default_factory=list)   # 해당 위치 id (예: "mb")

    @property
    def present(self) -> bool:
        return bool(self.positions)


def _group_of(b: Branch) -> tuple[int, int, int]:
    for g, v in _SAMHAP_GROUP.items():
        if b.index in g:
            return v
    raise RuntimeError("unreachable")


def find_sinsal(pillars: dict[str, Pillar], basis: str = "both") -> list[SinsalHit]:
    """pillars: {"h": 시주?, "d": 일주, "m": 월주, "y": 년주}. basis: year | day | both"""
    branches = {f"{k}b": p.branch for k, p in pillars.items() if p is not None}
    stems = {f"{k}s": p.stem for k, p in pillars.items() if p is not None}
    dm = pillars["d"].stem
    bases = []
    if basis in ("year", "both"):
        bases.append(("년지", "yb", pillars["y"].branch))
    if basis in ("day", "both"):
        bases.append(("일지", "db", pillars["d"].branch))

    def where(targets: set[int], exclude: str | None = None) -> list[str]:
        return [pos for pos, b in branches.items() if b.index in targets and pos != exclude]

    hits: list[SinsalHit] = []
    for idx, name in ((0, "역마살"), (1, "도화살"), (2, "화개살")):
        rules, tgts, pos = [], [], []
        for label, bpos, b in bases:
            t = _group_of(b)[idx]
            rules.append(f"{label} {b.hanja} → {Branch(t).hanja}")
            tgts.append(Branch(t).hanja)
            pos += where({t}, exclude=bpos)
        hits.append(SinsalHit(name, " · ".join(rules), sorted(set(tgts)), sorted(set(pos))))

    ce = _CHEONEUL[dm.index]
    hits.append(SinsalHit("천을귀인", f"일간 {dm.hanja} → {' · '.join(Branch(i).hanja for i in ce)}",
                          [Branch(i).hanja for i in ce], where(set(ce))))
    mc = _MUNCHANG[dm.index]
    hits.append(SinsalHit("문창귀인", f"일간 {dm.hanja} → {Branch(mc).hanja}",
                          [Branch(mc).hanja], where({mc})))
    if dm.index in _YANGIN:
        yi = _YANGIN[dm.index]
        hits.append(SinsalHit("양인", f"일간 {dm.hanja} → {Branch(yi).hanja}",
                              [Branch(yi).hanja], where({yi})))
    else:
        hits.append(SinsalHit("양인", f"일간 {dm.hanja} (음간 — 양인 없음)", [], []))

    hc_pos = [p for p, s in stems.items() if s.index in _HYEONCHIM_STEMS]
    hc_pos += [p for p, b in branches.items() if b.index in _HYEONCHIM_BRANCHES]
    hc_chars = sorted({(stems | branches)[p].hanja for p in hc_pos})
    hits.append(SinsalHit("현침살", "글자 모양 기준 (甲 辛 卯 午 申)", hc_chars, hc_pos))

    for name, table in (("괴강살", _GOEGANG), ("백호살", _BAEKHO)):
        pos = [f"{k}b" for k, p in pillars.items() if p is not None and str(p) in table]
        hits.append(SinsalHit(name, "기둥 간지 기준", sorted({str(pillars[p[0]]) for p in pos}), pos))
    return hits


def xun_of(p: Pillar) -> list[Pillar]:
    """기둥이 속한 순(旬)의 10간지 (갑X ~ 계X)"""
    start = p.sexagenary_index - p.stem.index
    return [Pillar.from_index(start + i) for i in range(10)]
