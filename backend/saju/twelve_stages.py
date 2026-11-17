"""12운성 (十二運星)

천간이 각 지지에서 갖는 기운의 세기.
  양간: 장생 지지에서 순행
  음간: 음포태(기본) — 장생 지지에서 역행 / 음양동생 — 짝이 되는 양간과 동일

봉법(일간 기준): 일간이 원국 각 지지에서 갖는 운성
좌법(자기 천간 기준): 각 기둥 천간이 자기 지지에서 갖는 운성
"""
from __future__ import annotations

from .branch import Branch
from .enums import YinYang
from .stem import Stem

STAGES = ["장생", "목욕", "관대", "건록", "제왕", "쇠", "병", "사", "묘", "절", "태", "양"]

# 시각화를 위한 상대적 기세 (0~9). 해석 점수가 아니라 그래프용.
STAGE_ENERGY = {
    "장생": 6, "목욕": 5, "관대": 7, "건록": 8, "제왕": 9, "쇠": 6,
    "병": 4, "사": 3, "묘": 2, "절": 1, "태": 2, "양": 4,
}

# 강한 운성 (통근으로 볼 수 있는 자리)
STRONG_STAGES = {"장생", "관대", "건록", "제왕"}

# 천간 index → 장생 지지 index
_START = {
    0: 11,  # 갑 → 해
    1: 6,   # 을 → 오 (음포태)
    2: 2,   # 병 → 인
    3: 9,   # 정 → 유
    4: 2,   # 무 → 인
    5: 9,   # 기 → 유
    6: 5,   # 경 → 사
    7: 0,   # 신 → 자
    8: 8,   # 임 → 신
    9: 3,   # 계 → 묘
}

EUMPOTAE = "eumpotae"      # 음간 역행
SAME_BIRTH = "same"         # 음양동생


def stage_of(stem: Stem, branch: Branch, yin_mode: str = EUMPOTAE) -> str:
    s, b = Stem(stem), Branch(branch)
    if s.yinyang is YinYang.YIN and yin_mode == SAME_BIRTH:
        s = Stem(s.index - 1)
    start = _START[s.index]
    if s.yinyang is YinYang.YANG:
        return STAGES[(b.index - start) % 12]
    return STAGES[(start - b.index) % 12]


def cycle(stem: Stem, yin_mode: str = EUMPOTAE) -> list[tuple[str, Branch]]:
    """장생부터 양까지 12단계와 해당 지지"""
    s = Stem(stem)
    eff = Stem(s.index - 1) if (s.yinyang is YinYang.YIN and yin_mode == SAME_BIRTH) else s
    start = _START[eff.index]
    step = 1 if eff.yinyang is YinYang.YANG else -1
    return [(STAGES[i], Branch((start + step * i) % 12)) for i in range(12)]


# ───────────────────────── 12운성 적용법 ─────────────────────────
# 봉법: 일간 → 년·월·일·시지.  년지 초년 · 월지 청년 · 일지 장년 · 시지 노년으로 간명
BONG_PERIOD = {"y": "초년운", "m": "청년운", "d": "장년운", "h": "노년운"}


def geobeop(stem: Stem, branch: Branch, yin_mode: str = EUMPOTAE) -> str:
    """거법: 각 기둥의 천간 → 같은 기둥 지지"""
    return stage_of(stem, branch, yin_mode)


def jwabeop(branch: Branch, yin_mode: str = EUMPOTAE) -> list[tuple[Stem, str, str]]:
    """좌법: 지지의 지장간 글자 각각을 그 지지에 대입 → (지장간, 역할, 운성)"""
    b = Branch(branch)
    return [(h.stem, h.role, stage_of(h.stem, b, yin_mode)) for h in b.hidden]


GROUP_ORDER = ["비겁", "식상", "재성", "관성", "인성"]
_GROUP = {"비견": "비겁", "겁재": "비겁", "식신": "식상", "상관": "식상", "편재": "재성",
          "정재": "재성", "편관": "관성", "정관": "관성", "편인": "인성", "정인": "인성"}


def injongbeop(dm: Stem, stems: list[tuple[str, Stem]], day_branch: Branch,
               assume_missing: bool = True, yin_mode: str = EUMPOTAE) -> list[dict]:
    """인종법: 천간에 뜬 글자(일간 제외)를 일지에 12운성 대입해 그 십성(육친)의 상황을 본다.
    천간에 없는 십성 그룹은 '있다고 가정'하고, 일지와 음양을 맞춘 천간을 끌어와 대입한다.

    stems: [(위치 라벨, 천간)] — 일간은 넣지 않는다.
    일지의 음양은 정기(용) 기준 (자·오·사·해의 체용 차이 때문에 정기 사용).
    """
    db = Branch(day_branch)
    out = []
    for group in GROUP_ORDER:
        present = [(pos, s) for pos, s in stems if _GROUP[s.ten_god(dm)] == group]
        for pos, s in present:
            st = stage_of(s, db, yin_mode)
            out.append({"group": group, "ten_god": s.ten_god(dm), "stem": s, "source": pos,
                        "assumed": False, "stage": st, "energy": STAGE_ENERGY[st]})
        if not present and assume_missing:
            target_yy = db.main_qi.yinyang
            cand = next(s for s in Stem.all() if _GROUP[s.ten_god(dm)] == group and s.yinyang is target_yy)
            st = stage_of(cand, db, yin_mode)
            out.append({"group": group, "ten_god": cand.ten_god(dm), "stem": cand, "source": "가정",
                        "assumed": True, "stage": st, "energy": STAGE_ENERGY[st]})
    return out
