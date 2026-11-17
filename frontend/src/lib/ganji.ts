// 표시용 매핑만 (사주 계산 금지)
import type { ElementKo } from "../types";

const STEMS = "甲乙丙丁戊己庚辛壬癸";
const STEMS_KO = "갑을병정무기경신임계";
const BRANCHES = "子丑寅卯辰巳午未申酉戌亥";
const BRANCHES_KO = "자축인묘진사오미신유술해";
const STEM_EL: ElementKo[] = ["목", "목", "화", "화", "토", "토", "금", "금", "수", "수"];
const BRANCH_EL: ElementKo[] = ["수", "토", "목", "목", "토", "화", "화", "토", "금", "금", "토", "수"];

export const ELEMENTS: ElementKo[] = ["목", "화", "토", "금", "수"];
export const ELEMENT_HANJA: Record<ElementKo, string> = { 목: "木", 화: "火", 토: "土", 금: "金", 수: "水" };
export const ELEMENT_CLASS: Record<ElementKo, string> = {
  목: "wood", 화: "fire", 토: "earth", 금: "metal", 수: "water",
};

export function elementOfHanja(ch: string): ElementKo | null {
  const s = STEMS.indexOf(ch);
  if (s >= 0) return STEM_EL[s];
  const b = BRANCHES.indexOf(ch);
  if (b >= 0) return BRANCH_EL[b];
  return null;
}

export function hanjaToHangul(ch: string): string {
  const s = STEMS.indexOf(ch);
  if (s >= 0) return STEMS_KO[s];
  const b = BRANCHES.indexOf(ch);
  if (b >= 0) return BRANCHES_KO[b];
  return ch;
}

export type GanjiDisplay = "hanja" | "hangul" | "both";
export type TenGodDisplay = "hangul" | "hanja" | "short";

/** 간지 문자열(한자)을 설정에 맞게 변환. both 는 "甲子(갑자)" */
export function fmtGanji(s: string, mode: GanjiDisplay): string {
  if (mode === "hanja") return s;
  const ko = [...s].map(hanjaToHangul).join("");
  if (mode === "hangul") return ko;
  return ko === s ? s : `${s}(${ko})`;
}

/** 자유 문장 안의 간지 한자를 한글 모드일 때만 치환 */
export function fmtText(s: string, mode: GanjiDisplay): string {
  return mode === "hangul" ? [...s].map(hanjaToHangul).join("") : s;
}

const TEN_GOD_HANJA: Record<string, string> = {
  비견: "比肩", 겁재: "劫財", 식신: "食神", 상관: "傷官", 편재: "偏財",
  정재: "正財", 편관: "偏官", 정관: "正官", 편인: "偏印", 정인: "正印", 일간: "日干",
};
const TEN_GOD_SHORT: Record<string, string> = {
  비견: "비", 겁재: "겁", 식신: "식", 상관: "상", 편재: "재",
  정재: "정재", 편관: "살", 정관: "관", 편인: "효", 정인: "인", 일간: "일간",
};

export function fmtTenGod(tg: string, mode: TenGodDisplay): string {
  if (mode === "hanja") return TEN_GOD_HANJA[tg] ?? tg;
  if (mode === "short") return TEN_GOD_SHORT[tg] ?? tg;
  return tg;
}

const COLOR_BY_STEM = ["푸른", "푸른", "붉은", "붉은", "노란", "노란", "흰", "흰", "검은", "검은"];
const ANIMAL = ["쥐", "소", "호랑이", "토끼", "용", "뱀", "말", "양", "원숭이", "닭", "개", "돼지"];

/** "丙午" → "붉은 말의 해" */
export function yearNickname(ganji: string): string {
  const s = STEMS.indexOf(ganji[0]);
  const b = BRANCHES.indexOf(ganji[1]);
  if (s < 0 || b < 0) return "";
  return `${COLOR_BY_STEM[s]} ${ANIMAL[b]}의 해`;
}

/** 두 오행 칩 문구: 같으면 "화 과다" */
export function elementPairLabel(a: ElementKo, b: ElementKo): string {
  return a === b ? `${a} 과다` : `${a} · ${b}`;
}

const WEEKDAY = ["월", "화", "수", "목", "금", "토", "일"];
export function weekdayKo(d: Date): string {
  return WEEKDAY[(d.getDay() + 6) % 7];
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function dotDate(iso: string): string {
  return iso.slice(0, 10).replaceAll("-", ".");
}

export function hm(iso: string | null): string {
  return iso ? iso.slice(11, 16) : "";
}

export function mdDot(iso: string): string {
  return `${iso.slice(5, 7)}.${iso.slice(8, 10)}`;
}

export const KIND_COLOR: Record<string, string> = {
  합: "var(--relation-hap)", 충: "var(--relation-chung)", 형: "var(--relation-hyung)",
  파: "var(--relation-pa)", 해: "var(--relation-hae)",
};
export const KINDS = ["합", "충", "형", "파", "해"] as const;

export const TERM_HANJA: Record<string, string> = {
  입춘: "立春", 우수: "雨水", 경칩: "驚蟄", 춘분: "春分", 청명: "淸明", 곡우: "穀雨",
  입하: "立夏", 소만: "小滿", 망종: "芒種", 하지: "夏至", 소서: "小暑", 대서: "大暑",
  입추: "立秋", 처서: "處暑", 백로: "白露", 추분: "秋分", 한로: "寒露", 상강: "霜降",
  입동: "立冬", 소설: "小雪", 대설: "大雪", 동지: "冬至", 소한: "小寒", 대한: "大寒",
};
