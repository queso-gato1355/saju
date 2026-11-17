"""saju 엔진 호출 + 응답 조립. 사주 계산 자체는 전부 saju 패키지가 한다."""
from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from functools import lru_cache
from typing import Optional
from zoneinfo import ZoneInfo

from saju import Branch, FourPillars, Manseryeok, Pillar, SolarTerms, Stem
from saju.analysis import (
    ELEMENT_HANJA, GROUP_OF, GROUPS, POS_LABEL, TEN_GODS, AnalysisOptions, Interaction,
    apply_interactions, build_slots, element_distribution, find_interactions, group_element,
    gyeokguk, slot_power, strength_score, ten_god_distribution, to_percent, yongsin,
)
from saju.yukchin import meaning as ten_god_meaning
from saju.enums import Element, YinYang
from saju.ganji import GanJi
from saju.luck import compute_luck, current_luck
from saju.sinsal import HANJA as SINSAL_HANJA, KEYWORDS as SINSAL_KW, find_sinsal, xun_of
from saju.twelve_stages import BONG_PERIOD, STAGE_ENERGY, cycle, geobeop, injongbeop, jwabeop, stage_of

from . import schemas as S

SEOUL = ZoneInfo("Asia/Seoul")
KST = timezone(timedelta(hours=9))
PILLAR_LABEL = {"h": "시주", "d": "일주", "m": "월주", "y": "년주"}
KIND_ORDER = ["합", "충", "형", "파", "해"]


class InputError(ValueError):
    """사용자 입력으로 인한 계산 불가 (→ 422)"""


# ───────── 공통 변환 ─────────
def char(c: GanJi) -> S.Char:
    return S.Char(name=c.name, hanja=c.hanja, element=c.element.value, yinyang=c.yinyang.value)


def term_out(t) -> S.TermOut:
    return S.TermOut(name=t.name, time=t.time.isoformat(timespec="minutes"), is_jeol=t.is_jeol)


def lunar_of(d: date) -> Optional[S.LunarOut]:
    try:
        from korean_lunar_calendar import KoreanLunarCalendar
    except ImportError:
        return None
    cal = KoreanLunarCalendar()
    if not cal.setSolarDate(d.year, d.month, d.day):
        return None
    return S.LunarOut(year=cal.lunarYear, month=cal.lunarMonth, day=cal.lunarDay,
                      is_leap=bool(cal.isIntercalation))


def seoul_offset_hours(d: date, t: time) -> float:
    """해당 현지 시각의 한국 법정 UTC 오프셋 (서머타임·+8:30 시기 반영)"""
    off = datetime.combine(d, t).replace(tzinfo=SEOUL).utcoffset()
    return off.total_seconds() / 3600


def parse_hm(s: Optional[str]) -> tuple[Optional[int], int]:
    if not s:
        return None, 0
    h, m = s.split(":")
    return int(h), int(m)


# ───────── 원국 분석 ─────────
@lru_cache(maxsize=2048)
def analyze_cached(req_json: str) -> S.AnalyzeResponse:
    return analyze(S.ChartRequest.model_validate_json(req_json))


def analyze(req: S.ChartRequest) -> S.AnalyzeResponse:
    o = req.options
    hh, mm = parse_hm(req.time)

    # 음력 → 양력 먼저 (서머타임 판정은 양력 날짜 기준)
    if req.calendar == "lunar":
        try:
            y, m, d = Manseryeok.lunar_to_solar(req.date.year, req.date.month, req.date.day, req.is_leap)
        except ValueError as e:
            raise InputError(str(e)) from e
        solar = date(y, m, d)
    else:
        solar = req.date
    if not 1900 <= solar.year <= 2100:
        raise InputError("1900~2100년 사이 날짜만 계산할 수 있습니다")

    tz_hours = 9.0
    if o.dst_auto:
        tz_hours = seoul_offset_hours(solar, time(hh if hh is not None else 12, mm))
    dst_applied = tz_hours != 9.0
    lng = req.longitude if (o.solar_time and req.longitude is not None) else None
    ms = Manseryeok(tz_hours=tz_hours, longitude=lng, split_zi=o.split_zi,
                    term_precision=o.term_precision, equation_of_time=o.equation_of_time)
    chart = ms.from_solar(solar.year, solar.month, solar.day, hh, mm)

    pillars: dict[str, Optional[Pillar]] = {"h": chart.hour, "d": chart.day, "m": chart.month, "y": chart.year}
    dm = chart.day_master
    aopt = AnalysisOptions(o.hap_condition, o.atten_adjacent, o.atten_one_gap, o.atten_far,
                           o.allow_banhap, o.jwabeop, o.injong, o.yin_mode)

    birth_moment = chart.input_time or datetime.combine(solar, time(12, 0), ms.tz)
    ref = req.reference_date or datetime.now(KST).date()
    man_age = ref.year - solar.year - ((ref.month, ref.day) < (solar.month, solar.day))
    age_shift = 1 if o.age_mode == "korean" else 0
    luck = compute_luck(chart, birth_moment, req.gender, o.luck_rounding)
    real_cur = current_luck(luck, man_age)          # 첫 대운 시작 전이면 None
    cur_luck = real_cur or luck.pillars[0]           # 시나리오(+대운) 계산용 대표 대운
    sewoon_pillar = Manseryeok().from_solar(ref.year, ref.month, ref.day).year

    # 시나리오: 원국 / +대운 / +세운
    natal_stems = [p.stem for p in pillars.values() if p is not None]
    scen_defs = [
        ("natal", {}, []),
        ("daewoon", {"l": cur_luck.pillar}, [str_h(cur_luck.pillar)]),
        ("sewoon", {"l": cur_luck.pillar, "s": sewoon_pillar}, [str_h(cur_luck.pillar), str_h(sewoon_pillar)]),
    ]
    natal_slots = build_slots(pillars, o.jwabeop)
    static_el = element_distribution(natal_slots, None)
    static_tg, _ = ten_god_distribution(natal_slots, dm, None)
    scenarios: list[S.Scenario] = []
    natal_its: list[Interaction] = []
    for key, extra, extra_names in scen_defs:
        slots = build_slots({**pillars, **extra}, o.jwabeop)
        its = find_interactions(slots, aopt, chart.month.branch, natal_stems)
        flow = apply_interactions(slots, its)
        if key == "natal":
            natal_its, natal_flow, natal_slots_used = its, flow, slots
        scenarios.append(build_scenario(key, extra_names, slots, its, flow, dm, pillars,
                                        static_el, static_tg))

    strength = strength_score(pillars, o.yin_mode)
    natal = scenarios[0]
    group_power = {g.group: g.static_pct for g in natal.groups}
    gyeok = gyeokguk(pillars, strength["score"], o.injong)
    ys = yongsin(dm, strength["score"], group_power)

    sinsal_hits = find_sinsal(pillars, o.sinsal_basis)
    gongmang = build_gongmang(pillars, sewoon_pillar)
    pillar_outs = build_pillars(pillars, dm, o.yin_mode, sinsal_hits, gongmang)

    adj = chart.adjusted_time
    corr = round((adj - chart.input_time).total_seconds() / 60) if chart.input_time else None
    near = any(abs((t.time - birth_moment).total_seconds()) < 300 for t in (chart.prev_jeol, chart.next_jeol))
    yy = chart.year.stem.yinyang is YinYang.YANG
    meta = S.MetaOut(
        solar_date=solar, lunar=lunar_of(solar),
        input_time=chart.input_time.isoformat(timespec="minutes") if chart.input_time else None,
        adjusted_time=adj.isoformat(timespec="minutes") if adj else None,
        correction_minutes=corr, tz_hours=tz_hours, dst_applied=dst_applied,
        prev_jeol=term_out(chart.prev_jeol), next_jeol=term_out(chart.next_jeol),
        gender=req.gender,
        yinyang_gender=("양" if yy else "음") + ("남" if req.gender == "M" else "녀"),
        near_term_warning=near and chart.input_time is not None,
    )

    return S.AnalyzeResponse(
        meta=meta,
        pillars=pillar_outs,
        day_master=char(dm),
        strength=S.StrengthOut(
            score=strength["score"], label=strength["label"],
            deukryeong=S.ScorePart(**strength["deukryeong"]),
            deukji=S.ScorePart(**strength["deukji"]),
            deukse=S.ScorePart(**strength["deukse"]),
            wolryeong_branch=strength["wolryeong"]["branch"],
            wolryeong_element=strength["wolryeong"]["element"],
            wolryeong_deuk=strength["wolryeong"]["deuk"],
        ),
        scenarios=scenarios,
        gyeok=S.GyeokOut(**gyeok),
        yongsin=[S.YongsinOut(**y) for y in ys],
        summary=build_summary(dm, strength, natal, natal_its, ys, pillars),
        siryeong=build_siryeong(chart, birth_moment),
        twelve_cycle=build_cycle(dm, pillars, o.yin_mode),
        sinsal=[S.SinsalOut(name=h.name, hanja=SINSAL_HANJA[h.name], rule=h.rule, targets=h.targets,
                            positions=[POS_LABEL[p] for p in h.positions], present=h.present,
                            keyword=SINSAL_KW[h.name]) for h in sinsal_hits],
        gongmang=gongmang,
        luck=build_luck(luck, cur_luck, real_cur, pillars, aopt, chart, natal_stems, ref, solar, age_shift),
        slot_power=[S.SlotPowerOut(**x) for x in slot_power(natal_slots_used, natal_flow, dm, chart.month.branch)],
        injong_branch=chart.day.branch.hanja,
        injong=[S.InjongOut(group=x["group"], ten_god=x["ten_god"], hanja=x["stem"].hanja,
                            element=x["stem"].element.value, yinyang=x["stem"].yinyang.value,
                            source=x["source"], assumed=x["assumed"], stage=x["stage"], energy=x["energy"])
                for x in injongbeop(dm, [(POS_LABEL[k + "s"], pillars[k].stem) for k in ("y", "m", "h")
                                         if pillars.get(k) is not None],
                                    chart.day.branch, o.injong_assume, o.yin_mode)],
        ten_god_meanings=[S.TenGodMeaningOut(**ten_god_meaning(t, req.gender)) for t in TEN_GODS],
    )


def str_h(p: Pillar) -> str:
    return p.stem.hanja + p.branch.hanja


def build_pillars(pillars, dm: Stem, yin_mode: str, hits, gongmang: list[S.GongmangOut]
                  ) -> list[Optional[S.PillarOut]]:
    natal_stems = {p.stem for p in pillars.values() if p is not None}
    short = {"역마살": "역마", "도화살": "도화", "화개살": "화개", "천을귀인": "귀인",
             "문창귀인": "문창", "양인": "양인", "현침살": "현침", "괴강살": "괴강", "백호살": "백호"}
    by_pos: dict[str, list[str]] = {}
    for h in hits:
        for p in h.positions:
            by_pos.setdefault(p, []).append(short[h.name])
    out: list[Optional[S.PillarOut]] = []
    for key in ("h", "d", "m", "y"):
        p = pillars[key]
        if p is None:
            out.append(None)
            continue
        gm = [g.basis for g in gongmang if p.branch.hanja in g.void and not
              (g.basis == "일주" and key == "d") and not (g.basis == "년주" and key == "y")]
        out.append(S.PillarOut(
            key=key, label=PILLAR_LABEL[key], ganji=str_h(p),
            stem=S.StemOut(**char(p.stem).model_dump(),
                           ten_god="일간" if key == "d" else p.stem.ten_god(dm),
                           sinsal=by_pos.get(f"{key}s", [])),
            branch=S.BranchOut(
                **char(p.branch).model_dump(), ten_god=p.branch.ten_god(dm),
                hidden=[S.HiddenOut(**char(h.stem).model_dump(), role=h.role, days=h.days,
                                    ten_god=h.stem.ten_god(dm),
                                    tougan=h.stem in natal_stems)
                        for h in p.branch.hidden],
                stage=stage_of(dm, p.branch, yin_mode),
                period=BONG_PERIOD[key],
                stage_geo=geobeop(p.stem, p.branch, yin_mode),
                stage_jwa=[S.JwaOut(hanja=hs.hanja, role=role, ten_god=hs.ten_god(dm), stage=st)
                           for hs, role, st in jwabeop(p.branch, yin_mode)],
                sinsal=by_pos.get(f"{key}b", []) + (["공망"] if gm else []),
                gongmang=gm,
            ),
        ))
    return out


def _effects(it: Interaction, slots_by_id, flow) -> list[str]:
    out = []
    for sid in it.slots:
        loss = next((amt for i, amt in flow.causes.get(sid, []) if i is it), 0.0)
        w = slots_by_id[sid].weight
        if loss > 0.01 and w:
            c = slots_by_id[sid].char
            out.append(f"{c.hanja} {c.element.value} -{round(loss / w * 100)}%")
    if it.kind == "합" and it.result is not None and it.degree:
        moved = sum(a for _, _, a, i in flow.transfers if i is it)
        if moved > 0.01:
            out.append(f"{it.result.value} +{round(moved, 1)}")
    return out


def _desc(it: Interaction, dm: Stem) -> str:
    tgs = " · ".join(f"{c.hanja} {c.ten_god(dm) if not (c is dm) else '일간'}" for c in it.chars)
    if it.kind == "충":
        extra = " 월령 손상 — 격의 기반이 흔들림." if "mb" in it.slots else ""
        return f"{tgs} 충돌.{extra}"
    if it.kind == "합":
        if it.result is not None and it.degree is not None:
            return f"{tgs} 결합 → {it.result.value}({ELEMENT_HANJA[it.result]}) 기운, 성립도 {round(it.degree * 100)}%."
        return f"{tgs} 결합."
    if it.kind == "형":
        return f"{tgs} — {it.note or '형'}. 압박 · 마찰 · 조정의 작용."
    return f"{tgs} — {it.kind}. 관계가 약하게 어긋나는 작용."


def interaction_out(it: Interaction, iid: str, dm: Stem, effects: list[str]) -> S.InteractionOut:
    return S.InteractionOut(
        id=iid, kind=it.kind, sub=it.sub, label=it.label, slots=list(it.slots),
        chars=[c.hanja for c in it.chars], positions=it.positions, strength=it.strength,
        result=it.result.value if it.result else None, degree=it.degree, note=it.note,
        desc=_desc(it, dm), effects=effects)


def sewoon_out(yr: int, dm: Stem, ref_year: int) -> S.SewoonOut:
    p = Pillar.from_index((yr - 4) % 60)
    return S.SewoonOut(year=yr, ganji=str_h(p), stem=char(p.stem), branch=char(p.branch),
                       stem_ten_god=p.stem.ten_god(dm), branch_ten_god=p.branch.ten_god(dm),
                       current=yr == ref_year)


def build_scenario(key, extra_names, slots, its, flow, dm, pillars, static_el, static_tg) -> S.Scenario:
    by_id = {s.id: s for s in slots}
    after_el = element_distribution(slots, flow)
    sp, ap = to_percent(static_el, 1), to_percent(after_el, 1)
    natal_chars = [p.stem for p in pillars.values() if p] + [p.branch for p in pillars.values() if p]

    el_rows = []
    for e in Element:
        hits = [(it, amt) for sid, lst in flow.causes.items() for it, amt in lst
                if by_id[sid].char.element == e and amt > 0]
        gains = [(it, a) for _, el, a, it in flow.transfers if el == e]
        reason = ""
        up = ap[e] - sp[e] > 0.5
        down = sp[e] - ap[e] > 0.5
        if up:
            reason = (f"{max(gains, key=lambda x: x[1])[0].label} 합화로 강화" if gains
                      else "다른 오행이 약해져 상대적으로 증가")
        elif down and hits:
            reason = f"{max(hits, key=lambda x: x[1])[0].label}으로 약화"
        elif not any(c.element == e for c in natal_chars):
            hidden = any(h.stem.element == e for p in pillars.values() if p for h in p.branch.hidden)
            reason = "지장간에만 존재" if hidden else "원국에 없음"
        else:
            reason = "변화 적음"
        el_rows.append(S.ElementRow(element=e.value, hanja=ELEMENT_HANJA[e],
                                    count=sum(1 for c in natal_chars if c.element == e),
                                    static_pct=sp[e], after_pct=ap[e], reason=reason))

    after_tg, contrib = ten_god_distribution(slots, dm, flow)
    st_pct, af_pct = to_percent(static_tg), to_percent(after_tg)
    tg_rows = []
    for tg in TEN_GODS:
        merged: dict[tuple[str, str], float] = {}
        for c in contrib[tg]:
            k = (c["label"], c["kind"])
            merged[k] = merged.get(k, 0) + c["value"]
        total_after = sum(after_tg.values()) or 1
        tg_rows.append(S.TenGodRow(
            ten_god=tg, group=GROUP_OF[tg], static_pct=st_pct[tg], after_pct=af_pct[tg],
            contrib=[S.ContribOut(label=k[0], kind=k[1], value=round(v / total_after * 100, 1))
                     for k, v in sorted(merged.items(), key=lambda kv: -abs(kv[1])) if abs(v) > 0.05],
        ))
    groups = []
    for g, members in GROUPS.items():
        s_ = sum(st_pct[t] for t in members)
        a_ = sum(af_pct[t] for t in members)
        diff = a_ - s_
        note = ("작용으로 증가" if diff > 1 else "작용으로 감소" if diff < -1 else "변화 적음")
        groups.append(S.GroupRow(group=g, element=group_element(g, dm).value,
                                 static_pct=s_, after_pct=a_, note=note))
    groups.sort(key=lambda r: -r.after_pct)

    counts = {k: sum(1 for it in its if it.kind == k) for k in KIND_ORDER}
    yang = sum(1 for c in natal_chars if c.yinyang is YinYang.YANG)
    return S.Scenario(
        key=key, extra=extra_names,
        interactions=[interaction_out(it, f"{key}-{i}", dm, _effects(it, by_id, flow)) for i, it in enumerate(its)],
        total=round(sum(it.strength for it in its), 2), counts=counts,
        elements=el_rows, yang=yang, yin=len(natal_chars) - yang,
        ten_gods=tg_rows, groups=groups,
    )


def build_summary(dm, strength, natal: S.Scenario, its: list[Interaction], ys, pillars) -> list[str]:
    top_el = max(natal.elements, key=lambda r: r.after_pct)
    mb = pillars["m"].branch
    deuk = "득령" if strength["wolryeong"]["deuk"] else "실령"
    top_group = next(g for g in natal.groups if group_element(g.group, dm).value == top_el.element)
    l1 = (f"{strength['label']}한 {dm.hanja}{ELEMENT_HANJA[dm.element]} 일간이 {mb.hanja}월에 태어나 {deuk} — "
          f"{top_el.element}({top_el.hanja}) {top_group.group}이 {round(top_el.after_pct)}%로 가장 강하다.")
    l2 = "원국 안에 뚜렷한 합충형파해 작용이 없어 구조가 안정적이다."
    if its:
        center_cnt: dict[str, int] = {}
        for it in its:
            for c in it.chars:
                if isinstance(c, Branch):
                    center_cnt[c.hanja] = center_cnt.get(c.hanja, 0) + 1
        if center_cnt:
            center = max(center_cnt, key=center_cnt.get)
            rel = [it.label for it in its if any(c.hanja == center for c in it.chars)][:3]
            pos = next((POS_LABEL[s] for it in its for s, c in zip(it.slots, it.chars) if c.hanja == center), "")
        else:
            center, rel, pos = its[0].chars[0].hanja, [its[0].label], POS_LABEL[its[0].slots[0]]
        total = sum(it.strength for it in its)
        level = "매우 역동적이다" if total > 3 else "역동적이다" if total > 1.5 else "비교적 안정적이다"
        l2 = f"{pos} {center}을 중심으로 {' · '.join(rel)}이 걸려 원국이 {level}."
    y = ys[0]
    grp_el = Element(y["element"])
    in_stem = any(p.stem.element == grp_el for p in pillars.values() if p)
    in_branch = any(p.branch.element == grp_el for p in pillars.values() if p)
    in_hidden = any(h.stem.element == grp_el for p in pillars.values() if p for h in p.branch.hidden)
    where = ("천간에 드러나 있어 쓰기 좋다" if in_stem else
             "지지에 뿌리가 있으나 천간에 드러나지 않았다" if in_branch else
             "지장간에만 있어 용신이 약하다" if in_hidden else "원국에 없어 운에서 보충해야 한다")
    l3 = f"{y['element_hanja']} {y['group']}(용신)이 {where} — {y['element_hanja']} 운에서 균형이 회복된다."
    return [l1, l2, l3]


def build_siryeong(chart: FourPillars, birth: datetime) -> S.SiryeongOut:
    days = max(0, int((birth - chart.prev_jeol.time).total_seconds() // 86400))
    acc = 0
    chosen = chart.month.branch.hidden[-1]
    for h in chart.month.branch.hidden:
        acc += h.days
        if days < acc:
            chosen = h
            break
    return S.SiryeongOut(days_since=days, term_name=chart.prev_jeol.name, stem_hanja=chosen.stem.hanja,
                         role=chosen.role,
                         text=f"{chart.prev_jeol.name} +{days}일 → {chosen.role} {chosen.stem.hanja} 당령")


def build_cycle(dm: Stem, pillars, yin_mode: str) -> list[S.StageCell]:
    marks: dict[int, list[str]] = {}
    for k, lab in (("h", "시지"), ("d", "일지"), ("m", "월지"), ("y", "년지")):
        p = pillars[k]
        if p is not None:
            marks.setdefault(p.branch.index, []).append(lab)
    return [S.StageCell(stage=st, branch=b.hanja, energy=STAGE_ENERGY[st], marks=marks.get(b.index, []))
            for st, b in cycle(dm, yin_mode)]


def build_gongmang(pillars, sewoon: Pillar) -> list[S.GongmangOut]:
    out = []
    for basis, key in (("일주", "d"), ("년주", "y")):
        p = pillars[key]
        void = [b.hanja for b in p.gongmang]
        xun = xun_of(p)
        hits = []
        for k in ("h", "d", "m", "y"):
            q = pillars[k]
            if q is not None and k != key and q.branch.hanja in void:
                hits.append(f"{PILLAR_LABEL[k][0]}지 {q.branch.hanja}")
        out.append(S.GongmangOut(basis=basis, pillar=str_h(p), xun=f"{str_h(xun[0])}旬",
                                 xun_pillars=[str_h(x) for x in xun], void=void, hits=hits,
                                 filled_by_sewoon=sewoon.branch.hanja in void))
    return out


def build_luck(luck, cur, real_cur, pillars, aopt, chart, natal_stems, ref: date, solar: date, age_shift: int) -> S.LuckOut:
    dm = pillars["d"].stem
    rows = []
    for li, lp in enumerate(luck.pillars):
        slots = build_slots({**pillars, "l": lp.pillar}, aopt.jwabeop)
        its = [it for it in find_interactions(slots, aopt, chart.month.branch, natal_stems)
               if any(s[0] == "l" for s in it.slots)]
        by_kind = {k: round(sum(it.strength for it in its if it.kind == k), 2) for k in KIND_ORDER}
        age = lp.start_age + age_shift
        age_label = f"{age:g}세" if float(age).is_integer() else f"{int(age)}세 {round((age % 1) * 12)}개월"
        rows.append(S.LuckPillarOut(
            ganji=str_h(lp.pillar), stem=char(lp.pillar.stem), branch=char(lp.pillar.branch),
            stem_ten_god=lp.pillar.stem.ten_god(dm), branch_ten_god=lp.pillar.branch.ten_god(dm),
            start_age=lp.start_age, age_label=age_label, start_year=lp.start_year,
            current=lp is real_cur, strength_by_kind=by_kind, total=round(sum(by_kind.values()), 2),
            top=[it.label for it in sorted(its, key=lambda x: -x.strength)[:3]],
            interactions=[interaction_out(it, f"luck{li}-{i}", dm, [])
                          for i, it in enumerate(sorted(its, key=lambda x: -x.strength)[:8])],
            sewoon=[sewoon_out(lp.start_year + k, dm, ref.year) for k in range(10)],
        ))
    notes = []
    ranked = sorted(rows, key=lambda r: (not r.current, -r.total))[:3]
    for r in ranked:
        if r.top:
            notes.append(f"{r.ganji} 대운{' (현재)' if r.current else ''} — {' · '.join(r.top)} · 작용 합 {r.total}")
    sewoon = [sewoon_out(cur.start_year + k, dm, ref.year) for k in range(10)]
    return S.LuckOut(forward=luck.forward, start_label=luck.start_label, days_to_term=luck.days_to_term,
                     pillars=rows, sewoon=sewoon, notes=notes)


# ───────── 달력 · 오늘 · 검색 ─────────
@lru_cache(maxsize=512)
def calendar_month(year: int, month: int) -> S.CalendarResponse:
    if not 1900 <= year <= 2100 or not 1 <= month <= 12:
        raise InputError("1900~2100년 범위의 달만 조회할 수 있습니다")
    first = date(year, month, 1)
    nxt = date(year + (month == 12), month % 12 + 1, 1)
    terms = [t for y in (year - 1, year, year + 1) for t in SolarTerms.of_year(y, KST)]
    days = []
    d = first
    while d < nxt:
        p = Pillar.from_index(Manseryeok.day_pillar_index(d))
        days.append(S.DayCell(date=d, weekday=d.weekday(), ganji=str_h(p), stem=char(p.stem),
                              branch=char(p.branch), lunar=lunar_of(d),
                              terms=[term_out(t) for t in terms if t.time.date() == d]))
        d += timedelta(days=1)

    jeols = sorted((t for t in terms if t.is_jeol), key=lambda t: t.time)
    ms = Manseryeok()

    def span(t) -> S.MonthPillarSpan:
        c = ms.from_datetime(t.time + timedelta(minutes=1))
        return S.MonthPillarSpan(ganji=str_h(c.month), stem=char(c.month.stem), branch=char(c.month.branch),
                                 jeol_name=t.name, start=t.time.isoformat(timespec="minutes"))

    start_dt = datetime.combine(first, time(0, 0), KST)
    end_dt = datetime.combine(nxt, time(0, 0), KST)
    prev = max((t for t in jeols if t.time <= start_dt), key=lambda t: t.time)
    inside = [t for t in jeols if start_dt < t.time < end_dt]
    ipchun = next(t for t in jeols if t.time.year == year and t.name == "입춘")
    flow = [t for t in jeols if t.time >= ipchun.time][:12]
    year_p = ms.from_datetime(ipchun.time + timedelta(minutes=1)).year
    return S.CalendarResponse(year=year, month=month, year_ganji=str_h(year_p), days=days,
                              month_pillars=[span(t) for t in [prev, *inside]],
                              year_flow=[span(t) for t in flow])


def now_info(longitude: Optional[float], split_zi: bool, now: Optional[datetime] = None) -> S.NowResponse:
    now = (now or datetime.now(KST)).astimezone(KST)
    ms = Manseryeok(longitude=longitude, split_zi=split_zi)
    c = ms.from_datetime(now)
    terms = sorted((t for y in (now.year - 1, now.year, now.year + 1) for t in SolarTerms.of_year(y, KST)),
                   key=lambda t: t.time)
    prev_t = max((t for t in terms if t.time <= now), key=lambda t: t.time)
    next_t = min((t for t in terms if t.time > now), key=lambda t: t.time)
    corr = round((ms.adjust_time(now) - now).total_seconds() / 60)
    # 하루 12시진: 자시는 (23:00 - 보정) 부터. 시간은 보정 전 표준시로 표시
    hours = []
    midnight = datetime.combine(now.date(), time(0, 0), KST)
    for i in range(12):
        start = midnight + timedelta(hours=-1 + 2 * i, minutes=-corr)
        end = start + timedelta(hours=2)
        hp = Pillar(((c.day.stem.index % 5) * 2 + i) % 10, i)      # 오서둔: 오늘 일간 기준
        hours.append(S.HourSlot(ganji=str_h(hp), stem=char(hp.stem), branch=char(hp.branch),
                                start=start.strftime("%H:%M"), end=end.strftime("%H:%M"),
                                current=start <= now < end))
    if not any(h.current for h in hours) and c.hour is not None:
        hours[c.hour.branch.index].current = True
    return S.NowResponse(
        now=now.isoformat(timespec="minutes"),
        year=pnow(c.year), month=pnow(c.month), day=pnow(c.day), hour=pnow(c.hour),
        lunar=lunar_of(now.date()), prev_term=term_out(prev_t), next_term=term_out(next_t),
        days_since_term=(now.date() - prev_t.time.date()).days,
        days_to_term=(next_t.time.date() - now.date()).days,
        month_jeol=term_out(c.prev_jeol), next_month_jeol=term_out(c.next_jeol),
        hours=hours, correction_minutes=corr,
    )


def pnow(p: Pillar) -> S.PillarNow:
    return S.PillarNow(ganji=str_h(p), stem=char(p.stem), branch=char(p.branch))


def parse_ganji(q: str) -> tuple[Pillar, str]:
    q = q.strip()
    kind = "day"
    for suf, k in (("日", "day"), ("일", "day"), ("月", "month"), ("월", "month"),
                   ("年", "year"), ("년", "year")):
        if q.endswith(suf) and len(q) == 3:
            q, kind = q[:-1], k
            break
    if len(q) != 2:
        raise InputError("간지는 두 글자로 입력하세요 (예: 甲子日, 갑자일)")
    try:
        return Pillar(Stem(q[0]), Branch(q[1])), kind
    except ValueError as e:
        raise InputError(str(e)) from e


def search_ganji(q: str, around: date, limit: int = 8) -> S.SearchResponse:
    p, kind = parse_ganji(q)
    target = p.sexagenary_index
    hits: list[S.SearchHit] = []
    if kind == "day":
        cur = Manseryeok.day_pillar_index(around)
        first = around + timedelta(days=(target - cur) % 60)
        for i in range(-limit // 2, limit - limit // 2):
            d = first + timedelta(days=60 * i)
            if 1900 <= d.year <= 2100:
                hits.append(S.SearchHit(date=d, ganji=str_h(p)))
    elif kind == "year":
        y0 = around.year + ((target - (around.year - 4)) % 60)
        for i in range(-limit // 2, limit - limit // 2):
            y = y0 + 60 * i
            if 1900 <= y <= 2100:
                hits.append(S.SearchHit(date=date(y, 2, 4), ganji=str_h(p)))
    else:
        ms = Manseryeok()
        y = around.year - 5
        while len(hits) < limit and y <= around.year + 10:
            for t in (t for t in SolarTerms.of_year(y, KST) if t.is_jeol):
                c = ms.from_datetime(t.time + timedelta(minutes=1))
                if c.month == p and 1900 <= t.time.year <= 2100:
                    hits.append(S.SearchHit(date=t.time.date(), ganji=str_h(p)))
            y += 1
        hits = sorted(hits, key=lambda h: abs((h.date - around).days))[:limit]
        hits.sort(key=lambda h: h.date)
    return S.SearchResponse(query=q, kind=kind, hits=hits)
