"""사주 만세력 CLI / 데모

사용 예
  python main.py                                  # 관계 연산 데모
  python main.py 1990-05-15 14:30                 # 양력
  python main.py 1990-04-21 14:30 --lunar         # 음력 (korean_lunar_calendar 필요)
  python main.py 1990-05-15 14:30 --lng 126.98    # 서울 경도 보정
  python main.py 1990-05-15                       # 생시 모름
"""
from __future__ import annotations

import argparse

from saju import Branch, FourPillars, Manseryeok, Pillar, Stem


def print_chart(chart: FourPillars) -> None:
    print(f"양력 {chart.solar_date}", end="")
    if chart.input_time:
        print(f" {chart.input_time:%H:%M}", end="")
        if chart.adjusted_time != chart.input_time:
            print(f" (보정 {chart.adjusted_time:%H:%M})", end="")
    print(f"\n절기: {chart.prev_jeol} ~ {chart.next_jeol}\n")
    print(chart)

    dm = chart.day_master
    print(f"\n일간: {dm.name}({dm.element.value})  일주 공망: {''.join(str(b) for b in chart.day.gongmang)}")
    for label, p in zip(["년", "월", "일", "시"], chart.pillars):
        stem_tg = "일간" if p is chart.day else p.stem.ten_god(dm)
        print(f"  {label}주 {p}  {p.stem.name}:{stem_tg}  {p.branch.name}:{p.branch.ten_god(dm)}  지장간:",
              [(h.stem.name, tg) for h, tg in p.branch.hidden_ten_gods(dm)])
    print("기둥쌍 관계:")
    for a, b, rels in chart.pair_relations():
        print(f"  {a} ↔ {b}: {[str(r) for r in rels]}")
    print("3자 관계:", [str(r) for r in chart.triple_relations()])


def demo() -> None:
    gap, gi = Stem("갑"), Stem("기")
    print(gap & gi)                         # 갑기 합→토
    print(Stem("경") ^ gap)                 # 경갑 충
    ja, o, myo = Branch("자"), Branch("오"), Branch("묘")
    print(ja ^ o, "|", ja % myo, "|", Branch("진") % Branch("진"))
    print(Branch("인") & Branch("해"), "|", Branch("인") // Branch("해"))
    print(Branch("자") - Branch("미"))
    print(Branch("신") & Branch("자"))      # 반합
    print("인 지장간:", Branch("인").hidden)
    print("갑자 공망:", Pillar.from_str("갑자").gongmang)

    print("\n── 만세력 예시: 양력 2000-01-01 12:00 ──")
    print_chart(Manseryeok().from_solar(2000, 1, 1, 12, 0))


def main() -> None:
    ap = argparse.ArgumentParser(description="생년월일시 → 사주 원국")
    ap.add_argument("date", nargs="?", help="YYYY-MM-DD")
    ap.add_argument("time", nargs="?", help="HH:MM (생략 시 시주 없음)")
    ap.add_argument("--lunar", action="store_true", help="음력 날짜로 입력")
    ap.add_argument("--leap", action="store_true", help="음력 윤달")
    ap.add_argument("--lng", type=float, default=None, help="출생지 경도 (평균태양시 보정)")
    ap.add_argument("--tz", type=float, default=9.0, help="표준시 UTC 오프셋 (기본 9)")
    ap.add_argument("--split-zi", action="store_true", help="야자시/조자시 구분")
    args = ap.parse_args()

    if not args.date:
        demo()
        return

    y, m, d = map(int, args.date.split("-"))
    hh = mm = None
    if args.time:
        hh, mm = map(int, args.time.split(":"))
    ms = Manseryeok(tz_hours=args.tz, longitude=args.lng, split_zi=args.split_zi)
    if args.lunar:
        chart = ms.from_lunar(y, m, d, args.leap, hh, mm or 0)
    else:
        chart = ms.from_solar(y, m, d, hh, mm or 0)
    print_chart(chart)


if __name__ == "__main__":
    main()
