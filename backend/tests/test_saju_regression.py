"""saju 엔진 불변 기준값 (.claude/rules/saju-domain.md 표와 동일하게 유지)"""
from datetime import date

from saju import Manseryeok, Pillar
from saju.twelve_stages import stage_of


def ganji(p: Pillar) -> str:
    return p.stem.name + p.branch.name


def test_2000_01_01_noon():
    c = Manseryeok().from_solar(2000, 1, 1, 12, 0)
    assert [ganji(p) for p in (c.year, c.month, c.day, c.hour)] == ["기묘", "병자", "무오", "무오"]
    assert c.prev_jeol.name == "대설" and c.prev_jeol.time.strftime("%Y-%m-%d %H:%M") == "1999-12-07 22:47"
    assert c.next_jeol.name == "소한" and c.next_jeol.time.strftime("%Y-%m-%d %H:%M") == "2000-01-06 10:00"


def test_1990_with_longitude():
    c = Manseryeok(longitude=126.98).from_solar(1990, 5, 15, 14, 30)
    assert c.adjusted_time.strftime("%H:%M") == "13:57"
    assert [ganji(p) for p in (c.year, c.month, c.day, c.hour)] == ["경오", "신사", "경진", "계미"]
    assert "".join(b.name for b in c.day.gongmang) == "신유"


def test_1984_gapja_year():
    assert ganji(Manseryeok().from_solar(1984, 6, 1).year) == "갑자"


def test_day_pillar_2000():
    assert ganji(Pillar.from_index(Manseryeok.day_pillar_index(date(2000, 1, 1)))) == "무오"


def test_design_example_2004():
    c = Manseryeok(longitude=126.98).from_solar(2004, 2, 21, 10, 12)
    assert [ganji(p) for p in (c.hour, c.day, c.month, c.year)] == ["신사", "경오", "병인", "갑신"]


def test_pre_1970_does_not_crash():
    c = Manseryeok().from_solar(1950, 6, 15, 10, 0)
    assert ganji(c.day) == "신사"


def test_new_options_default_unchanged():
    a = Manseryeok(longitude=126.98).from_solar(1990, 5, 15, 14, 30)
    b = Manseryeok(longitude=126.98, term_precision="minute", equation_of_time=False).from_solar(1990, 5, 15, 14, 30)
    assert [ganji(p) for p in a.pillars] == [ganji(p) for p in b.pillars]


def test_twelve_stages():
    assert stage_of("경", "사") == "장생"
    assert stage_of("경", "신") == "건록"
    assert stage_of("경", "인") == "절"
    assert stage_of("신", "사") == "사"           # 음포태
    assert stage_of("신", "사", "same") == "장생"  # 음양동생


def test_four_stage_methods():
    from saju import Branch, Stem
    from saju.twelve_stages import geobeop, injongbeop, jwabeop
    # 거법: 辛巳 → 辛(음포태) 巳 = 사
    assert geobeop(Stem("신"), Branch("사")) == "사"
    # 좌법: 寅 지장간 戊丙甲 → 각각 寅에서 장생 · 장생 · 건록
    assert [st for _, _, st in jwabeop(Branch("인"))] == ["장생", "장생", "건록"]
    # 인종법: 庚 일간, 일지 午 / 천간 甲(년) 丙(월) 辛(시)
    rows = injongbeop(Stem("경"), [("년간", Stem("갑")), ("월간", Stem("병")), ("시간", Stem("신"))], Branch("오"))
    by = {(r["group"], r["source"]): r for r in rows}
    assert by[("재성", "년간")]["stage"] == "사"        # 甲 → 午 = 사
    assert by[("관성", "월간")]["stage"] == "제왕"      # 丙 → 午 = 제왕
    assert by[("비겁", "시간")]["stage"] == "병"        # 辛(음) → 午 = 병
    # 천간에 없는 식상·인성은 일지 午(정기 丁=음)와 음양을 맞춰 가정: 식상 → 癸(상관), 인성 → 己(정인)
    assert by[("식상", "가정")]["ten_god"] == "상관" and by[("식상", "가정")]["assumed"]
    assert by[("인성", "가정")]["ten_god"] == "정인"
    # 가정 끔
    rows2 = injongbeop(Stem("경"), [("년간", Stem("갑"))], Branch("오"), assume_missing=False)
    assert all(not r["assumed"] for r in rows2)
