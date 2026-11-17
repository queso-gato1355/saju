// 백엔드 app/schemas.py 와 1:1. 백엔드 스키마를 바꾸면 여기도 함께 수정.

export type ElementKo = "목" | "화" | "토" | "금" | "수";

export interface Char {
  name: string;
  hanja: string;
  element: ElementKo;
  yinyang: "양" | "음";
}

export interface HiddenOut extends Char {
  role: "여기" | "중기" | "정기";
  days: number;
  ten_god: string;
  tougan: boolean;
}

export interface StemOut extends Char {
  ten_god: string;
  sinsal: string[];
}

export interface JwaOut {
  hanja: string;
  role: string;
  ten_god: string;
  stage: string;
}

export interface BranchOut extends Char {
  ten_god: string;
  hidden: HiddenOut[];
  /** 봉법: 일간 → 이 지지 */
  stage: string;
  /** 봉법 간명 시기 (초년운 · 청년운 · 장년운 · 노년운) */
  period: string;
  /** 거법: 같은 기둥 천간 → 이 지지 */
  stage_geo: string;
  /** 좌법: 지장간 각각 → 이 지지 */
  stage_jwa: JwaOut[];
  sinsal: string[];
  gongmang: string[];
}

export type PillarKey = "h" | "d" | "m" | "y";

export interface PillarOut {
  key: PillarKey;
  label: string;
  ganji: string;
  stem: StemOut;
  branch: BranchOut;
}

export interface TermOut {
  name: string;
  time: string;
  is_jeol: boolean;
}

export interface LunarOut {
  year: number;
  month: number;
  day: number;
  is_leap: boolean;
}

export interface MetaOut {
  solar_date: string;
  lunar: LunarOut | null;
  input_time: string | null;
  adjusted_time: string | null;
  correction_minutes: number | null;
  tz_hours: number;
  dst_applied: boolean;
  prev_jeol: TermOut;
  next_jeol: TermOut;
  gender: "M" | "F";
  yinyang_gender: string;
  near_term_warning: boolean;
}

export interface ScorePart {
  score: number;
  max: number;
  desc: string;
}

export interface StrengthOut {
  score: number;
  label: string;
  deukryeong: ScorePart;
  deukji: ScorePart;
  deukse: ScorePart;
  wolryeong_branch: string;
  wolryeong_element: string;
  wolryeong_deuk: boolean;
}

export type RelKind = "합" | "충" | "형" | "파" | "해";

export interface InteractionOut {
  id: string;
  kind: RelKind;
  sub: string;
  label: string;
  slots: string[];
  chars: string[];
  positions: string;
  strength: number;
  result: string | null;
  degree: number | null;
  note: string;
  desc: string;
  effects: string[];
}

export interface ElementRow {
  element: ElementKo;
  hanja: string;
  count: number;
  static_pct: number;
  after_pct: number;
  reason: string;
}

export interface ContribOut {
  label: string;
  kind: "stem" | "main" | "hidden" | "plus" | "minus";
  value: number;
}

export interface TenGodRow {
  ten_god: string;
  group: string;
  static_pct: number;
  after_pct: number;
  contrib: ContribOut[];
}

export interface GroupRow {
  group: string;
  element: ElementKo;
  static_pct: number;
  after_pct: number;
  note: string;
}

export type ScenarioKey = "natal" | "daewoon" | "sewoon";

export interface Scenario {
  key: ScenarioKey;
  extra: string[];
  interactions: InteractionOut[];
  total: number;
  counts: Record<RelKind, number>;
  elements: ElementRow[];
  yang: number;
  yin: number;
  ten_gods: TenGodRow[];
  groups: GroupRow[];
}

export interface GyeokOut {
  name: string;
  hanja: string;
  reason: string;
  note: string;
}

export interface YongsinOut {
  role: string;
  group: string;
  element: ElementKo;
  element_hanja: string;
  reason: string;
}

export interface SiryeongOut {
  days_since: number;
  term_name: string;
  stem_hanja: string;
  role: string;
  text: string;
}

export interface StageCell {
  stage: string;
  branch: string;
  energy: number;
  marks: string[];
}

export interface SinsalOut {
  name: string;
  hanja: string;
  rule: string;
  targets: string[];
  positions: string[];
  present: boolean;
  keyword: string;
}

export interface GongmangOut {
  basis: "일주" | "년주";
  pillar: string;
  xun: string;
  xun_pillars: string[];
  void: string[];
  hits: string[];
  filled_by_sewoon: boolean;
}

export interface LuckPillarOut {
  ganji: string;
  stem: Char;
  branch: Char;
  stem_ten_god: string;
  branch_ten_god: string;
  start_age: number;
  age_label: string;
  start_year: number;
  current: boolean;
  strength_by_kind: Record<RelKind, number>;
  total: number;
  top: string[];
  interactions: InteractionOut[];
  sewoon: SewoonOut[];
}

export interface SewoonOut {
  year: number;
  ganji: string;
  stem: Char;
  branch: Char;
  stem_ten_god: string;
  branch_ten_god: string;
  current: boolean;
}

export interface LuckOut {
  forward: boolean;
  start_label: string;
  days_to_term: number;
  pillars: LuckPillarOut[];
  sewoon: SewoonOut[];
  notes: string[];
}

export interface AnalyzeResponse {
  meta: MetaOut;
  pillars: (PillarOut | null)[];
  day_master: Char;
  strength: StrengthOut;
  scenarios: Scenario[];
  gyeok: GyeokOut;
  yongsin: YongsinOut[];
  summary: string[];
  siryeong: SiryeongOut;
  twelve_cycle: StageCell[];
  sinsal: SinsalOut[];
  gongmang: GongmangOut[];
  luck: LuckOut;
  slot_power: SlotPowerOut[];
  injong_branch: string;
  injong: InjongOut[];
  ten_god_meanings: TenGodMeaningOut[];
}

export interface InjongOut {
  group: string;
  ten_god: string;
  hanja: string;
  element: ElementKo;
  yinyang: "양" | "음";
  source: string;
  assumed: boolean;
  stage: string;
  energy: number;
}

export interface SlotGodOut {
  ten_god: string;
  hanja: string;
  role: "천간" | "여기" | "중기" | "정기";
  share: number;
  power: number;
}

export interface SlotPowerOut {
  id: string;
  label: string;
  kind: "stem" | "branch";
  hanja: string;
  element: ElementKo;
  season: "왕" | "상" | "휴" | "수" | "사";
  season_factor: number;
  interaction_factor: number;
  score: number;
  level: "강" | "보통" | "약" | "매우 약";
  causes: string[];
  ten_gods: SlotGodOut[];
}

export interface TenGodMeaningOut {
  ten_god: string;
  hanja: string;
  yukchin: string;
  domains: string;
  strength_trait: string;
  caution: string;
}

export interface DayCell {
  date: string;
  weekday: number;
  ganji: string;
  stem: Char;
  branch: Char;
  lunar: LunarOut | null;
  terms: TermOut[];
}

export interface MonthPillarSpan {
  ganji: string;
  stem: Char;
  branch: Char;
  jeol_name: string;
  start: string;
}

export interface CalendarResponse {
  year: number;
  month: number;
  year_ganji: string;
  days: DayCell[];
  month_pillars: MonthPillarSpan[];
  year_flow: MonthPillarSpan[];
}

export interface PillarNow {
  ganji: string;
  stem: Char;
  branch: Char;
}

export interface HourSlot extends PillarNow {
  start: string;
  end: string;
  current: boolean;
}

export interface NowResponse {
  now: string;
  year: PillarNow;
  month: PillarNow;
  day: PillarNow;
  hour: PillarNow;
  lunar: LunarOut | null;
  prev_term: TermOut;
  next_term: TermOut;
  days_since_term: number;
  days_to_term: number;
  month_jeol: TermOut;
  next_month_jeol: TermOut;
  hours: HourSlot[];
  correction_minutes: number;
}

export interface SearchResponse {
  query: string;
  kind: "day" | "month" | "year";
  hits: { date: string; ganji: string }[];
}

/** 백엔드 CalcOptions */
export interface CalcOptions {
  split_zi: boolean;
  solar_time: boolean;
  dst_auto: boolean;
  equation_of_time: boolean;
  term_precision: "minute" | "day";
  yin_mode: "eumpotae" | "same";
  hap_condition: "strict" | "normal" | "loose";
  atten_adjacent: number;
  atten_one_gap: number;
  atten_far: number;
  allow_banhap: boolean;
  jwabeop: boolean;
  injong: boolean;
  injong_assume: boolean;
  sinsal_basis: "year" | "day" | "both";
  luck_rounding: "round" | "floor" | "precise";
  age_mode: "man" | "korean";
}

export interface ChartRequest {
  calendar: "solar" | "lunar";
  date: string;
  time: string | null;
  is_leap: boolean;
  gender: "M" | "F";
  longitude: number | null;
  reference_date?: string;
  options: CalcOptions;
}
