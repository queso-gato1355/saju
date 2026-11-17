import type { CalcOptions } from "../types";
import type { GanjiDisplay, TenGodDisplay } from "./ganji";

export type PresetId = "modern" | "japyeong" | "jeokcheon" | "gungtong" | "custom";

export interface Settings {
  preset: PresetId;
  // 표기
  ganjiDisplay: GanjiDisplay;
  tenGodDisplay: TenGodDisplay;
  elementColor: boolean;
  // 역법·세수
  yearBoundary: "ipchun" | "dongji";
  termPrecision: "minute" | "day";
  astroSource: "calc" | "kasi";
  // 시간 보정
  splitZi: boolean;
  solarTime: boolean;
  defaultPlace: string;
  dstAuto: boolean;
  equationOfTime: boolean;
  // 지장간·12운성
  hiddenTable: "japyeong" | "yeonhae" | "custom";
  showSiryeong: boolean;
  yinMode: "eumpotae" | "same";
  stageBasis: "bong" | "geo" | "both";
  // 작용·세력
  jwabeop: boolean;
  injong: boolean;
  injongAssume: boolean;
  hapCondition: "strict" | "normal" | "loose";
  attenAdjacent: number;
  attenOneGap: number;
  attenFar: number;
  allowBanhap: boolean;
  // 신살·공망·대운
  sinsalBasis: "year" | "day" | "both";
  gongmangBasis: "day" | "year" | "both";
  luckRounding: "round" | "floor" | "precise";
  ageMode: "man" | "korean";
}

export const DEFAULT_SETTINGS: Settings = {
  preset: "modern",
  ganjiDisplay: "hanja",
  tenGodDisplay: "hangul",
  elementColor: true,
  yearBoundary: "ipchun",
  termPrecision: "minute",
  astroSource: "calc",
  splitZi: false,
  solarTime: true,
  defaultPlace: "서울특별시",
  dstAuto: true,
  equationOfTime: false,
  hiddenTable: "japyeong",
  showSiryeong: true,
  yinMode: "eumpotae",
  stageBasis: "both",
  jwabeop: true,
  injong: true,
  injongAssume: true,
  hapCondition: "normal",
  attenAdjacent: 1.0,
  attenOneGap: 0.6,
  attenFar: 0.3,
  allowBanhap: true,
  sinsalBasis: "both",
  gongmangBasis: "both",
  luckRounding: "round",
  ageMode: "man",
};

export interface PresetDef {
  id: PresetId;
  name: string;
  hanja: string;
  desc: string;
  values: Partial<Settings>;
}

export const PRESETS: PresetDef[] = [
  { id: "modern", name: "현대 한국 명리", hanja: "표준", desc: "억부 + 조후 병행 · 국내 만세력 관행", values: {} },
  {
    id: "japyeong", name: "자평진전", hanja: "子平眞詮", desc: "격국 · 용신 중심",
    values: { hapCondition: "strict", yinMode: "eumpotae", allowBanhap: true, jwabeop: false },
  },
  {
    id: "jeokcheon", name: "적천수", hanja: "滴天髓", desc: "억부 · 기세 중심",
    values: { hapCondition: "strict", yinMode: "same", injong: true, jwabeop: true },
  },
  {
    id: "gungtong", name: "궁통보감", hanja: "窮通寶鑑", desc: "조후(계절) 중심",
    values: { hapCondition: "normal", yinMode: "eumpotae", allowBanhap: true },
  },
  { id: "custom", name: "사용자 정의", hanja: "自定", desc: "항목별 직접 지정", values: {} },
];

export function applyPreset(s: Settings, id: PresetId): Settings {
  if (id === "custom") return { ...s, preset: "custom" };
  const p = PRESETS.find((x) => x.id === id)!;
  const calcKeys: (keyof Settings)[] = ["hapCondition", "yinMode", "allowBanhap", "jwabeop", "injong"];
  const reset = Object.fromEntries(calcKeys.map((k) => [k, DEFAULT_SETTINGS[k]]));
  return { ...s, ...reset, ...p.values, preset: id };
}

export function toCalcOptions(s: Settings): CalcOptions {
  return {
    split_zi: s.splitZi,
    solar_time: s.solarTime,
    dst_auto: s.dstAuto,
    equation_of_time: s.equationOfTime,
    term_precision: s.termPrecision,
    yin_mode: s.yinMode,
    hap_condition: s.hapCondition,
    atten_adjacent: s.attenAdjacent,
    atten_one_gap: s.attenOneGap,
    atten_far: s.attenFar,
    allow_banhap: s.allowBanhap,
    jwabeop: s.jwabeop,
    injong: s.injong,
    injong_assume: s.injongAssume,
    sinsal_basis: s.sinsalBasis,
    luck_rounding: s.luckRounding,
    age_mode: s.ageMode,
  };
}

/** 설정 키 → 사람이 읽는 이름 (변경 영향 미리보기용) */
export const SETTING_LABELS: Partial<Record<keyof Settings, string>> = {
  ganjiDisplay: "간지 표기", tenGodDisplay: "십성 표기", elementColor: "오행 색상 표시",
  termPrecision: "절입 시각 정밀도", splitZi: "야자시 구분", solarTime: "진태양시 보정",
  defaultPlace: "기본 출생지", dstAuto: "서머타임 자동 보정", equationOfTime: "균시차 반영",
  showSiryeong: "사령 표시", yinMode: "12운성 음간 처리", stageBasis: "운성 기준",
  jwabeop: "같은 기둥 상호 영향", injong: "종격 가능성 표시", injongAssume: "인종법 · 없는 십성 가정", hapCondition: "합화 성립 조건",
  attenAdjacent: "거리 감쇠 · 인접", attenOneGap: "거리 감쇠 · 1칸", attenFar: "거리 감쇠 · 원격",
  allowBanhap: "반합 · 방합 인정", sinsalBasis: "신살 기준", gongmangBasis: "공망 기준",
  luckRounding: "대운수 계산", ageMode: "나이 표기",
};

/** 계산 결과에 영향을 주는 설정 (아니면 표시만 바뀜) */
export const CALC_KEYS: (keyof Settings)[] = [
  "termPrecision", "splitZi", "solarTime", "dstAuto", "equationOfTime", "yinMode", "jwabeop",
  "injong", "injongAssume", "hapCondition", "attenAdjacent", "attenOneGap", "attenFar", "allowBanhap",
  "sinsalBasis", "luckRounding", "ageMode",
];
