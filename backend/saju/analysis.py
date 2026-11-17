"""원국 분석: 작용 강도 · 오행/십성 세력 · 신강도 · 격국/용신

⚠ 이 모듈의 점수는 '정답'이 아니라 일관된 규칙으로 만든 휴리스틱이다.
  가중치는 모두 아래 상수에 모여 있고, AnalysisOptions 로 일부를 바꿀 수 있다.
  만세력(기둥) 계산과 달리 학파·해석에 따라 얼마든지 달라질 수 있는 영역.

용어
  slot   원국(또는 운)의 한 글자 자리. id: hs/hb(시간/시지) ds/db ms/mb ys/yb, ls/lb(대운) ss/sb(세운)
"""
from __future__ import annotations

from dataclasses import dataclass, field
from itertools import combinations
from typing import Optional

from .branch import Branch
from .enums import Element, RelationType
from .ganji import GanJi
from .pillar import Pillar
from .relation import Relation
from .stem import Stem
from .twelve_stages import STRONG_STAGES, stage_of

# ───────────────────────── 가중치 상수 ─────────────────────────
STEM_WEIGHT = 10.0
BRANCH_WEIGHT = 10.0
MONTH_BRANCH_FACTOR = 1.5          # 월지는 월령이라 1.5배
LUCK_WEIGHT = {"l": 0.8, "s": 0.5}  # 대운 / 세운 글자의 세력 가중

BASE_STRENGTH = {
    "천간합": 0.6, "천간충": 0.7,
    "육합": 0.7, "반합": 0.6, "반합(약)": 0.4, "충": 0.8,
    "형": 0.6, "자형": 0.4, "파": 0.4, "해": 0.45,
    "삼합": 0.9, "방합": 0.8, "삼형": 0.85,
}
MONTH_BONUS = 1.15     # 월지가 낀 작용
DAY_BONUS = 1.05       # 일지(배우자궁)가 낀 작용
LUCK_ATTEN = {"l": 0.7, "s": 0.5}

# 작용이 세력(weight)에 주는 영향
CHUNG_LOSS = 0.35
HYUNG_LOSS = 0.2
PA_HAE_LOSS = 0.12
HAP_TRANSFER = 0.5     # 합화 시 구성 글자 세력 중 결과 오행으로 옮겨가는 비율(×강도×성립도)
HAP_BIND_LOSS = 0.1    # 합은 됐으나 화(化)하지 않은 경우 묶임

TEN_GODS = ["비견", "겁재", "식신", "상관", "편재", "정재", "편관", "정관", "편인", "정인"]
GROUPS = {"비겁": ["비견", "겁재"], "식상": ["식신", "상관"], "재성": ["편재", "정재"],
          "관성": ["편관", "정관"], "인성": ["편인", "정인"]}
GROUP_OF = {tg: g for g, tgs in GROUPS.items() for tg in tgs}
SUPPORTIVE = {"비견", "겁재", "편인", "정인"}

POS_LABEL = {"hs": "시간", "hb": "시지", "ds": "일간", "db": "일지", "ms": "월간", "mb": "월지",
             "ys": "년간", "yb": "년지", "ls": "대운 천간", "lb": "대운 지지",
             "ss": "세운 천간", "sb": "세운 지지"}
COL = {"h": 0, "d": 1, "m": 2, "y": 3}
ELEMENT_HANJA = {Element.WOOD: "木", Element.FIRE: "火", Element.EARTH: "土",
                 Element.METAL: "金", Element.WATER: "水"}


@dataclass(frozen=True)
class AnalysisOptions:
    hap_condition: str = "normal"      # strict | normal | loose
    atten_adjacent: float = 1.0
    atten_one_gap: float = 0.6
    atten_far: float = 0.3
    allow_banhap: bool = True          # 반합 · 방합 인정
    jwabeop: bool = True               # 같은 기둥 천간-지지 상호 영향 반영
    injong: bool = True                # 극신약 시 종격 가능성 표시
    yin_mode: str = "eumpotae"


@dataclass(frozen=True)
class Slot:
    id: str
    char: GanJi
    weight: float

    @property
    def is_stem(self) -> bool:
        return isinstance(self.char, Stem)

    @property
    def col(self) -> Optional[int]:
        return COL.get(self.id[0])


@dataclass
class Interaction:
    kind: str                     # 합 | 충 | 형 | 파 | 해
    sub: str                      # BASE_STRENGTH 키 (천간합, 육합, 반합, 삼형 ...)
    slots: tuple[str, ...]
    chars: tuple[GanJi, ...]
    strength: float
    result: Optional[Element] = None
    degree: Optional[float] = None     # 합화 성립도 0~1
    note: str = ""

    @property
    def label(self) -> str:
        names = "".join(c.hanja for c in self.chars)
        if self.sub in ("삼합", "방합", "삼형"):
            return f"{names} {self.sub}"
        if self.kind == "합":
            res = ELEMENT_HANJA[self.result] if self.result else ""
            return f"{names}{'반합' if '반합' in self.sub else '합'}{res}"
        return f"{names}{self.kind}"

    @property
    def positions(self) -> str:
        return " · ".join(POS_LABEL[s] for s in self.slots)


# ───────────────────────── slot 구성 ─────────────────────────
def build_slots(pillars: dict[str, Optional[Pillar]], jwabeop: bool) -> list[Slot]:
    slots: list[Slot] = []
    for key, p in pillars.items():
        if p is None:
            continue
        lw = LUCK_WEIGHT.get(key, 1.0)
        sw = STEM_WEIGHT * lw
        bw = BRANCH_WEIGHT * lw * (MONTH_BRANCH_FACTOR if key == "m" else 1.0)
        if jwabeop:
            be, se = p.branch.main_qi.element, p.stem.element
            if be == se or be.generates == se:
                sw *= 1.1
            elif be.controls == se:
                sw *= 0.9
        slots.append(Slot(f"{key}s", p.stem, sw))
        slots.append(Slot(f"{key}b", p.branch, bw))
    return slots


def _atten(a: Slot, b: Slot, opt: AnalysisOptions) -> float:
    luck = [s.id[0] for s in (a, b) if s.id[0] in LUCK_ATTEN]
    if luck:
        return min(LUCK_ATTEN[k] for k in luck)
    gap = abs(a.col - b.col)
    return {0: opt.atten_adjacent, 1: opt.atten_adjacent, 2: opt.atten_one_gap}.get(gap, opt.atten_far)


def _bonus(slot_ids) -> float:
    f = 1.0
    if "mb" in slot_ids:
        f *= MONTH_BONUS
    if "db" in slot_ids:
        f *= DAY_BONUS
    return f


def _sub_of(r: Relation) -> str:
    if isinstance(r.members[0], Stem):
        return "천간합" if r.kind is RelationType.HAP else "천간충"
    if r.kind is RelationType.HAP:
        return "육합"
    if r.kind is RelationType.BANHAP:
        return "반합" if "왕지" in r.note else "반합(약)"
    if r.kind is RelationType.HYUNG:
        return "자형" if r.note == "자형" else "형"
    return {RelationType.CHUNG: "충", RelationType.PA: "파", RelationType.HAE: "해"}[r.kind]


def _kind_of(r: Relation) -> str:
    return "합" if r.kind in (RelationType.HAP, RelationType.BANHAP) else r.kind.value


def find_interactions(slots: list[Slot], opt: AnalysisOptions,
                      month_branch: Branch, natal_stems: list[Stem]) -> list[Interaction]:
    out: list[Interaction] = []
    for a, b in combinations(slots, 2):
        if a.is_stem != b.is_stem:
            continue
        if a.id[0] in LUCK_ATTEN and b.id[0] in LUCK_ATTEN and a.id[0] == b.id[0]:
            continue                                   # 같은 운 기둥 안의 글자끼리는 제외
        for r in a.char.relations(b.char):
            sub = _sub_of(r)
            if sub.startswith("반합") and not opt.allow_banhap:
                continue
            s = BASE_STRENGTH[sub] * _atten(a, b, opt) * _bonus((a.id, b.id))
            out.append(Interaction(_kind_of(r), sub, (a.id, b.id), (a.char, b.char),
                                   round(min(s, 0.99), 2), r.result, None, r.note))
    # 3자 관계
    branch_slots = [s for s in slots if not s.is_stem]
    for trio in combinations(branch_slots, 3):
        if len({s.id[0] for s in trio if s.id[0] in LUCK_ATTEN}) > 1:
            continue
        for r in Branch.triple_relations([s.char for s in trio]):
            if len({s.char.index for s in trio}) < 3:
                continue
            sub = r.note[-3:-1] if r.note.endswith("(삼형)") else r.note
            if sub == "방합" and not opt.allow_banhap:
                continue
            att = sum(_atten(x, y, opt) for x, y in combinations(trio, 2)) / 3
            s = BASE_STRENGTH[sub] * att * _bonus([t.id for t in trio])
            out.append(Interaction(_kind_of(r), sub, tuple(t.id for t in trio),
                                   tuple(t.char for t in trio), round(min(s, 0.99), 2),
                                   r.result, None, r.note))
    # 합화 성립도
    for it in out:
        if it.kind == "합" and it.result is not None:
            it.degree = _hap_degree(it, out, opt, month_branch, natal_stems)
    out.sort(key=lambda x: -x.strength)
    return out


def _hap_degree(it: Interaction, all_its: list[Interaction], opt: AnalysisOptions,
                month_branch: Branch, natal_stems: list[Stem]) -> float:
    r = it.result
    wolryeong = month_branch.element == r or month_branch.main_qi.element == r
    tougan = any(s.element == r for s in natal_stems)
    if opt.hap_condition == "strict":
        d = 1.0 if wolryeong else 0.0
    elif opt.hap_condition == "loose":
        d = 1.0 if wolryeong else (0.8 if tougan else 0.5)
    else:
        d = 0.9 if wolryeong else (0.6 if tougan else 0.25)
    if it.sub in ("반합", "반합(약)"):
        d *= 0.8
    broken = any(o.kind == "충" and set(o.slots) & set(it.slots) for o in all_its)
    if broken:
        d *= 0.6
    return round(d, 2)


# ───────────────────────── 세력 계산 ─────────────────────────
@dataclass
class Flow:
    """slot 별 유효 세력과 합화로 옮겨간 세력"""
    mult: dict[str, float]
    transfers: list[tuple[str, Element, float, Interaction]]       # (원 slot, 결과 오행, 양, 작용)
    causes: dict[str, list[tuple[Interaction, float]]] = field(default_factory=dict)  # slot → (작용, 감소량)


def apply_interactions(slots: list[Slot], its: list[Interaction]) -> Flow:
    weight = {s.id: s.weight for s in slots}
    mult = {s.id: 1.0 for s in slots}
    flow = Flow(mult, [], {s.id: [] for s in slots})
    for it in its:
        for sid in it.slots:
            before = mult[sid]
            if it.kind == "충":
                mult[sid] *= 1 - CHUNG_LOSS * it.strength
            elif it.kind == "형":
                mult[sid] *= 1 - HYUNG_LOSS * it.strength
            elif it.kind in ("파", "해"):
                mult[sid] *= 1 - PA_HAE_LOSS * it.strength
            elif it.kind == "합":
                d = it.degree or 0.0
                if it.result is not None and d > 0:
                    moved = mult[sid] * HAP_TRANSFER * it.strength * d
                    mult[sid] -= moved
                    flow.transfers.append((sid, it.result, moved * weight[sid], it))
                else:
                    mult[sid] *= 1 - HAP_BIND_LOSS * it.strength
            flow.causes[sid].append((it, (before - mult[sid]) * weight[sid]))
    return flow


def _parts(slot: Slot) -> list[tuple[Stem, float, str]]:
    """slot 세력을 천간 단위로 쪼갬: (천간, 비율, 종류 stem|main|hidden)"""
    if slot.is_stem:
        return [(slot.char, 1.0, "stem")]
    return [(h.stem, h.weight, "main" if h.role == "정기" else "hidden") for h in slot.char.hidden]


def element_distribution(slots: list[Slot], flow: Optional[Flow]) -> dict[Element, float]:
    acc = {e: 0.0 for e in Element}
    for s in slots:
        m = flow.mult[s.id] if flow else 1.0
        for st, frac, _ in _parts(s):
            acc[st.element] += s.weight * m * frac
    if flow:
        for _, el, amt, _ in flow.transfers:
            acc[el] += amt
    return acc


def _tg_of_element(el: Element, dm: Stem, same_yinyang_as: GanJi) -> str:
    # 결과 오행 el 을 가진 '가상의 천간'의 십성. 음양은 원 글자 기준.
    for st in Stem.all():
        if st.element == el and st.yinyang == (same_yinyang_as.main_qi.yinyang
                                               if isinstance(same_yinyang_as, Branch)
                                               else same_yinyang_as.yinyang):
            return st.ten_god(dm)
    raise RuntimeError("unreachable")


def ten_god_distribution(slots: list[Slot], dm: Stem, flow: Optional[Flow]
                         ) -> tuple[dict[str, float], dict[str, list[dict]]]:
    """(십성 → 세력, 십성 → 기여 내역)"""
    acc = {tg: 0.0 for tg in TEN_GODS}
    contrib: dict[str, list[dict]] = {tg: [] for tg in TEN_GODS}
    by_id = {s.id: s for s in slots}
    for s in slots:
        if s.id == "ds":
            continue
        m = flow.mult[s.id] if flow else 1.0
        for st, frac, kind in _parts(s):
            tg = st.ten_god(dm)
            base = s.weight * frac
            acc[tg] += base * m
            label = {"stem": f"{st.hanja} 투출", "main": f"{s.char.hanja} 본기",
                     "hidden": f"{s.char.hanja} 중 {st.hanja}"}[kind]
            contrib[tg].append({"label": label, "kind": kind, "value": base})
            if flow and m < 1.0 and flow.causes[s.id]:
                cause = max(flow.causes[s.id], key=lambda c: c[1])[0]
                contrib[tg].append({"label": cause.label, "kind": "minus", "value": -base * (1 - m)})
    if flow:
        for sid, el, amt, it in flow.transfers:
            tg = _tg_of_element(el, dm, by_id[sid].char)
            acc[tg] += amt
            contrib[tg].append({"label": it.label, "kind": "plus", "value": amt})
    return acc, contrib


def to_percent(d: dict, digits: int = 0) -> dict:
    total = sum(d.values()) or 1.0
    return {k: round(v / total * 100, digits) for k, v in d.items()}


# ───────────────────────── 신강도 ─────────────────────────
def strength_score(pillars: dict[str, Optional[Pillar]], yin_mode: str) -> dict:
    dm = pillars["d"].stem
    mb = pillars["m"].branch

    def sup_frac(b: Branch) -> float:
        return sum(h.days for h in b.hidden if h.stem.ten_god(dm) in SUPPORTIVE) / 30

    main_sup = mb.main_qi.ten_god(dm) in SUPPORTIVE
    others = sum(h.days for h in mb.hidden[:-1] if h.stem.ten_god(dm) in SUPPORTIVE) / 30
    deukryeong = 40 * (0.7 + 0.3 * min(1.0, others * 2)) if main_sup else 40 * 0.5 * others

    has_hour = pillars.get("h") is not None
    w = {"d": 0.5, "h": 0.25, "y": 0.25} if has_hour else {"d": 0.6, "y": 0.4}
    deukji = 30 * sum(sup_frac(pillars[k].branch) * wt for k, wt in w.items())
    roots = []
    for k in ("h", "d", "y", "m"):
        p = pillars.get(k)
        if p is not None:
            st = stage_of(dm, p.branch, yin_mode)
            if st in STRONG_STAGES:
                roots.append(f"{p.branch.hanja} {st}")

    stem_keys = [k for k in ("y", "m", "h") if pillars.get(k) is not None]
    per = 30 / len(stem_keys)
    sup_stems = [pillars[k].stem for k in stem_keys if pillars[k].stem.ten_god(dm) in SUPPORTIVE]
    deukse = per * len(sup_stems)
    se_desc = [f"{s.hanja} {s.ten_god(dm)}" for s in sup_stems]
    hidden_sup = sorted({h.stem.hanja for k in stem_keys for h in pillars[k].branch.hidden
                         if h.stem.ten_god(dm) in SUPPORTIVE})
    if hidden_sup:
        se_desc.append("지장간 " + "".join(hidden_sup))

    score = round(deukryeong + deukji + deukse)
    label = ("극신약" if score < 25 else "신약" if score < 45 else "중화" if score < 55
             else "신강" if score < 75 else "극신강")
    el = mb.main_qi.element
    return {
        "score": score, "label": label,
        "deukryeong": {"score": round(deukryeong), "max": 40,
                       "desc": f"{mb.hanja}월 {el.value}왕 · {dm.hanja} {'득령' if main_sup else '실령'}"},
        "deukji": {"score": round(deukji), "max": 30, "desc": " · ".join(roots) or "통근 약함"},
        "deukse": {"score": round(deukse), "max": 30, "desc": " · ".join(se_desc) or "돕는 천간 없음"},
        "wolryeong": {"branch": mb.hanja, "element": el.value, "deuk": main_sup},
    }


# ───────────────────────── 격국 · 용신 ─────────────────────────
GYEOK_HANJA = {"편재": "偏財", "정재": "正財", "편관": "偏官", "정관": "正官", "식신": "食神",
               "상관": "傷官", "편인": "偏印", "정인": "正印", "건록": "建祿", "양인": "羊刃", "월겁": "月劫"}


def gyeokguk(pillars: dict[str, Optional[Pillar]], score: int, injong: bool) -> dict:
    dm = pillars["d"].stem
    mb = pillars["m"].branch
    stems = {k: pillars[k].stem for k in ("y", "m", "h") if pillars.get(k) is not None}
    chosen, why = None, ""
    for h in reversed(mb.hidden):                    # 정기 → 중기 → 여기 순으로 투출 확인
        hit = [k for k, s in stems.items() if s is h.stem]
        if hit:
            chosen = h
            why = f"월지 {mb.hanja}의 {h.role} {h.stem.hanja}이 {POS_LABEL[hit[0] + 's'][:2]}에 투출"
            break
    if chosen is None:
        chosen = mb.hidden[-1]
        why = f"투출한 지장간이 없어 월지 {mb.hanja} 정기 {chosen.stem.hanja} 기준"
    tg = chosen.stem.ten_god(dm)
    if tg == "비견":
        name = "건록"
    elif tg == "겁재":
        name = "양인" if dm.yinyang.value == "양" else "월겁"
    else:
        name = tg
    note = ""
    if injong and score < 15:
        note = "일간이 극히 약해 종격(從格) 가능성 검토 필요"
    return {"name": f"{name}격", "hanja": f"{GYEOK_HANJA[name]}格", "reason": why, "note": note}


def group_element(group: str, dm: Stem) -> Element:
    me = dm.element
    if group == "비겁":
        return me
    if group == "식상":
        return me.generates
    if group == "재성":
        return me.controls
    if group == "관성":
        return next(e for e in Element if e.controls == me)
    return next(e for e in Element if e.generates == me)       # 인성


def yongsin(dm: Stem, score: int, group_power: dict[str, float]) -> list[dict]:
    if score < 50:
        k = max(("식상", "재성", "관성"), key=lambda g: group_power[g])
        if k == "재성":
            roles = [("비겁", "재성 견제 · 신약 보강"), ("인성", "비겁 생조"),
                     ("재성", "재성 과다"), ("식상", "재성 생조")]
        elif k == "식상":
            roles = [("인성", f"식상 제어 · {dm.hanja} 생조"), ("비겁", "신약 보강"),
                     ("식상", "식상 과다 · 설기"), ("재성", "인성 파괴")]
        else:
            roles = [("인성", f"살인상생 · {dm.hanja} 생조"), ("비겁", "비겁 · 신약 보강"),
                     ("관성", "관살 과다"), ("재성", "재성 · 관 생조")]
    else:
        if group_power["인성"] > group_power["비겁"]:
            roles = [("재성", "인성 제어"), ("식상", "재성 생조"),
                     ("인성", "인성 과다"), ("관성", "인성 생조")]
        else:
            main = "관성" if group_power["관성"] >= 5 else "식상"
            roles = ([("관성", "비겁 제어"), ("재성", "관성 생조")] if main == "관성"
                     else [("식상", "비겁 설기"), ("재성", "식상 유통")])
            roles += [("비겁", "비겁 과다"), ("인성", "비겁 생조")]
    names = ["용신", "희신", "기신", "구신"]
    return [{"role": n, "group": g, "element": group_element(g, dm).value,
             "element_hanja": ELEMENT_HANJA[group_element(g, dm)], "reason": why}
            for n, (g, why) in zip(names, roles)]


# ───────────────────────── 자리별 강약 (인종법 보기) ─────────────────────────
SEASON_FACTOR = {"왕": 1.2, "상": 1.1, "휴": 0.9, "수": 0.8, "사": 0.7}


def season_state(el: Element, month_el: Element) -> str:
    """월령(월지 정기 오행) 대비 왕상휴수사"""
    if el == month_el:
        return "왕"
    if month_el.generates == el:
        return "상"
    if el.generates == month_el:
        return "휴"
    if el.controls == month_el:
        return "수"
    return "사"


def slot_power(slots: list[Slot], flow: Flow, dm: Stem, month_branch: Branch) -> list[dict]:
    """각 글자 자리의 세력 지수(100 = 보통)와 그 안에 놓인 십성.

    지수 = 100 × 왕상휴수사 계수 × 합충형파해 작용 후 잔존율
    """
    month_el = month_branch.main_qi.element
    out = []
    for s in slots:
        el = s.char.main_qi.element if isinstance(s.char, Branch) else s.char.element
        st = season_state(el, month_el)
        mult = flow.mult[s.id]
        score = 100 * SEASON_FACTOR[st] * mult
        level = "강" if score >= 115 else "보통" if score >= 95 else "약" if score >= 75 else "매우 약"
        causes = [f"{it.label} -{round(amt / s.weight * 100)}%" for it, amt in flow.causes.get(s.id, [])
                  if amt / s.weight >= 0.005]
        gods = []
        for st_, frac, kind in _parts(s):
            role = "천간" if kind == "stem" else next(h.role for h in s.char.hidden if h.stem is st_)
            gods.append({"ten_god": "일간" if s.id == "ds" else st_.ten_god(dm), "hanja": st_.hanja,
                         "role": role, "share": round(frac, 2), "power": round(score * frac, 1)})
        out.append({"id": s.id, "label": POS_LABEL[s.id], "kind": "stem" if s.is_stem else "branch",
                    "hanja": s.char.hanja, "element": el.value, "season": st,
                    "season_factor": SEASON_FACTOR[st], "interaction_factor": round(mult, 2),
                    "score": round(score), "level": level, "causes": causes, "ten_gods": gods})
    return out
