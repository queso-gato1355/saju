// 분석 결과(백엔드 계산값)를 AI 프롬프트 텍스트로 '서식화'만 한다. 계산하지 않는다.
// 개인정보 보호: 이름·생년월일은 넣지 않는다 (원국 간지만으로 해석 가능).
import type { AnalyzeResponse } from "../types";

export type PromptFormat = "xml" | "markdown" | "json" | "text";
export type PromptTone = "expert" | "easy";
export type IncludeKey = "chart" | "hidden" | "interactions" | "elements" | "luck" | "sewoon" | "sinsal";

export interface PromptOptions {
  include: Record<IncludeKey, boolean>;
  intent: string;
  format: PromptFormat;
  tone: PromptTone;
  extra: string;
}

export const INTENTS = ["종합 해석", "진로 · 적성", "재물", "연애 · 관계", "건강 경향", "세운"] as const;

export const DEFAULT_PROMPT_OPTIONS: PromptOptions = {
  include: { chart: true, hidden: true, interactions: true, elements: true, luck: true, sewoon: false, sinsal: false },
  intent: "종합 해석",
  format: "xml",
  tone: "expert",
  extra: "",
};

const KIND_ARROW: Record<string, string> = { 합: "+", 충: "↔", 형: "·", 파: "↔", 해: "↔" };

interface Section { tag: string; title: string; attrs?: Record<string, string>; lines: string[]; data: unknown }

function sections(d: AnalyzeResponse, o: PromptOptions, gender: "M" | "F"): Section[] {
  const out: Section[] = [];
  const ps = d.pillars;
  const natal = d.scenarios[0];
  const after = d.scenarios[0].elements;
  const sewoon = d.luck.sewoon.find((s) => s.current);
  const role = o.tone === "expert"
    ? ["당신은 자평명리 전문가입니다. 아래 구조화 데이터만 근거로 해석하고,", "각 주장마다 근거가 된 글자와 작용을 인용하세요."]
    : ["당신은 사주명리를 쉽게 설명해 주는 상담가입니다. 아래 데이터만 근거로,", "전문 용어는 풀어서 설명하고 근거가 된 글자를 함께 알려 주세요."];
  out.push({ tag: "role", title: "역할", lines: role, data: role.join(" ") });

  const dm = d.day_master;
  const chartAttrs = {
    day_master: `${dm.hanja}(${dm.yinyang}${dm.element})`,
    month_command: `${d.strength.wolryeong_branch} ${d.strength.wolryeong_element}왕 · ${d.strength.wolryeong_deuk ? "득령" : "실령"}`,
    strength: `${d.strength.score} ${d.strength.label}`,
    gender: gender === "M" ? "남" : "여",
    yinyang: d.meta.yinyang_gender,
  };
  const pillarLine = ps.map((p, i) => `${["시주", "일주", "월주", "년주"][i]} ${p ? p.ganji : "미상"}`).join(" | ");
  const tgLine = ps.map((p) => (p ? `${p.stem.hanja}${p.stem.ten_god} ${p.branch.hanja}${p.branch.ten_god}` : "미상")).join(" | ");
  const chartLines = [pillarLine, `십성 ${tgLine}`];
  if (o.include.hidden) {
    chartLines.push(`지장간 ${ps.filter(Boolean).map((p) => `${p!.branch.hanja}(${p!.branch.hidden.map((h) => h.hanja).join("")})`).join(" ")}`);
    chartLines.push(`12운성(봉법) ${ps.filter(Boolean).map((p) => `${p!.branch.hanja} ${p!.branch.stage}(${p!.branch.period})`).join(" · ")}`);
    chartLines.push(`12운성(거법) ${ps.filter(Boolean).map((p) => `${p!.ganji} ${p!.branch.stage_geo}`).join(" · ")}`);
    chartLines.push(`인종법(일지 ${d.injong_branch} 기준) ${d.injong.map((x) => `${x.ten_god} ${x.hanja}${x.assumed ? "(가정)" : ""} ${x.stage}`).join(" · ")}`);
    chartLines.push(`사령 ${d.siryeong.text}`);
  }
  chartLines.push(`격국 ${d.gyeok.name} — ${d.gyeok.reason}`);
  chartLines.push(`용신 후보 ${d.yongsin.map((y) => `${y.role} ${y.element_hanja}(${y.group})`).join(" · ")}`);
  out.push({ tag: "chart", title: "원국", attrs: chartAttrs, lines: chartLines, data: { ...chartAttrs, pillars: pillarLine, ten_gods: tgLine } });

  if (o.include.interactions) {
    const lines = natal.interactions.map((i) =>
      `- ${i.kind}  ${i.chars.join(KIND_ARROW[i.kind])}  ${i.positions}${i.note ? ` (${i.note})` : ""}  ${i.strength.toFixed(2)}${i.degree != null ? ` 성립도 ${Math.round(i.degree * 100)}%` : ""}${i.effects.length ? `  ${i.effects.join(", ")}` : ""}`);
    out.push({ tag: "interactions", title: "합충형파해 작용", attrs: { scale: "0-1", sorted: "strength" },
      lines: lines.length ? lines : ["- 뚜렷한 작용 없음"], data: natal.interactions.map((i) => ({ kind: i.kind, chars: i.chars, positions: i.positions, strength: i.strength, degree: i.degree, effects: i.effects })) });
  }
  if (o.include.elements) {
    const line = after.map((e) => `${e.element} ${Math.round(e.after_pct)}`).join(" · ");
    const tg = natal.groups.map((g) => `${g.group} ${Math.round(g.after_pct)}`).join(" · ");
    out.push({ tag: "elements", title: "오행 · 십성 세력 (작용 반영, %)", attrs: { after_interactions: "true" },
      lines: [line, tg], data: { elements: Object.fromEntries(after.map((e) => [e.element, Math.round(e.after_pct)])), groups: Object.fromEntries(natal.groups.map((g) => [g.group, Math.round(g.after_pct)])) } });
  }
  if (o.include.luck) {
    const idx = d.luck.pillars.findIndex((p) => p.current);
    const around = d.luck.pillars.slice(Math.max(0, idx - 1), idx + 2);
    const lines = around.map((p) => `${p.current ? "현재" : "인접"} 대운 ${p.ganji} (${p.age_label}~)${p.top.length ? `: ${p.top.join(", ")}` : ""} · 작용 합 ${p.total}`);
    out.push({ tag: "luck", title: "대운", attrs: { direction: d.luck.forward ? "순행" : "역행", start: d.luck.start_label }, lines, data: around });
  }
  if (o.include.sewoon && sewoon) {
    const s = d.scenarios.find((x) => x.key === "sewoon")!;
    const extra = s.interactions.filter((i) => i.slots.some((x) => x[0] === "s")).slice(0, 5)
      .map((i) => `- ${i.kind} ${i.chars.join(KIND_ARROW[i.kind])} ${i.positions} ${i.strength.toFixed(2)}`);
    out.push({ tag: "sewoon", title: `세운 ${sewoon.year}`, attrs: { year: String(sewoon.year), ganji: sewoon.ganji },
      lines: [`${sewoon.year} ${sewoon.ganji} 세운과 원국·대운의 작용`, ...(extra.length ? extra : ["- 뚜렷한 작용 없음"])], data: { year: sewoon.year, ganji: sewoon.ganji, interactions: extra } });
  }
  if (o.include.sinsal) {
    const lines = d.sinsal.filter((s) => s.present).map((s) => `${s.name}(${s.hanja}) ${s.targets.join("·")} @ ${s.positions.join(", ")}`);
    for (const g of d.gongmang) lines.push(`공망(${g.basis}) ${g.void.join("")}${g.hits.length ? ` — ${g.hits.join(", ")}` : " — 원국 해당 없음"}`);
    out.push({ tag: "sinsal", title: "신살 · 공망", lines, data: lines });
  }
  out.push({ tag: "summary", title: "원국 요약", lines: d.summary, data: d.summary });

  const intent = o.intent === "세운" && sewoon ? `${sewoon.year}년 세운(${sewoon.ganji})` : o.intent;
  const task = [`${intent} 관점에서 작용 강도 순으로 해석하세요.`];
  if (o.intent === "건강 경향") task.push("의학적 진단이 아니라 오행 균형에 따른 경향으로만 설명하세요.");
  if (o.tone === "easy") task.push("결론을 먼저 말하고, 3~5개의 짧은 문단으로 정리하세요.");
  if (o.extra.trim()) task.push(`추가: ${o.extra.trim().slice(0, 500)}`);
  out.push({ tag: "task", title: "요청", lines: task, data: task.join(" ") });
  return out;
}

export function buildPrompt(d: AnalyzeResponse, o: PromptOptions, gender: "M" | "F"): string {
  const secs = sections(d, o, gender);
  switch (o.format) {
    case "xml":
      return secs.map((s) => {
        const attrs = s.attrs ? " " + Object.entries(s.attrs).map(([k, v]) => `${k}="${v.replaceAll('"', "'")}"`).join(" ") : "";
        return `<${s.tag}${attrs}>\n${s.lines.map((l) => `  ${l}`).join("\n")}\n</${s.tag}>`;
      }).join("\n\n");
    case "markdown":
      return secs.map((s) => {
        const attrs = s.attrs ? `\n${Object.entries(s.attrs).map(([k, v]) => `> ${k}: ${v}`).join("\n")}` : "";
        return `## ${s.title}${attrs}\n\n${s.lines.map((l) => (l.startsWith("- ") ? l : `- ${l}`)).join("\n")}`;
      }).join("\n\n");
    case "json":
      return JSON.stringify(Object.fromEntries(secs.map((s) => [s.tag, s.attrs ? { ...s.attrs, data: s.data } : s.data])), null, 2);
    default:
      return secs.map((s) => `[${s.title}]\n${s.lines.join("\n")}`).join("\n\n");
  }
}

/** 대략적 토큰 수: 한글·한자 1자 ≈ 1토큰, 그 외 4자 ≈ 1토큰 */
export function estimateTokens(s: string): number {
  let cjk = 0;
  for (const ch of s) if (/[ㄱ-힝一-鿿]/.test(ch)) cjk++;
  return Math.round(cjk + (s.length - cjk) / 4);
}
