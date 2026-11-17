import { Card, Chip, GlyphTile, Hanja, useFmt } from "../../components/ui";
import { useApp } from "../../store/AppState";
import { ELEMENT_CLASS, fmtText } from "../../lib/ganji";
import type { AnalyzeResponse } from "../../types";

const LABEL = { h: "시지", d: "일지", m: "월지", y: "년지" } as const;

function HiddenCards({ data }: { data: AnalyzeResponse }) {
  const { tg } = useFmt();
  const { state } = useApp();
  return (
    <Card title="지장간 배분" subtitle="여기 · 중기 · 정기 일수 (30일 기준) · 학파 설정: 자평진전 배분표"
          actions={<span className="small muted"><Chip tone="hap">투출</Chip> <Chip tone="chung">사령</Chip> 천간에 드러난 지장간 / 출생일 기준 당령</span>}>
      <div className="hidden-grid">
        {data.pillars.map((p) => {
          if (!p) return <div key="h" className="hidden-card hidden-card--unknown">시주 모름</div>;
          const isMonth = p.key === "m";
          const siryeong = isMonth && state.settings.showSiryeong;
          return (
            <div key={p.key} className={`hidden-card ${siryeong ? "is-siryeong" : ""}`}>
              <div className="hidden-card__head">
                <GlyphTile hanja={p.branch.hanja} element={p.branch.element} size="sm" />
                <div><b>{LABEL[p.key]}</b><div className="muted small">{tg(p.branch.ten_god)}</div></div>
              </div>
              <div className="hidden-card__bar">
                {p.branch.hidden.map((h) => (
                  <span key={h.role} style={{ flexGrow: h.days }}
                        className={`hseg ${h.role === "정기" ? `bg-${ELEMENT_CLASS[h.element]}` : `tint-${ELEMENT_CLASS[h.element]}`}`}>
                    <Hanja text={h.hanja} colored={false} />
                  </span>
                ))}
              </div>
              {siryeong && (
                <div className="hidden-card__siryeong">
                  <Chip tone="chung">사령 · {data.siryeong.stem_hanja}</Chip>
                  <span className="fg-chung small">{fmtText(data.siryeong.text, state.settings.ganjiDisplay)}</span>
                </div>
              )}
              {p.branch.hidden.map((h) => (
                <div key={h.role} className="hidden-row">
                  <span className="muted small">{h.role}</span>
                  <Hanja text={h.hanja} className="serif" />
                  <span className="small">{h.days}일</span>
                  <span className="muted small">{tg(h.ten_god)}</span>
                  {h.tougan && <Chip tone="hap">투출</Chip>}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function StageChart({ data }: { data: AnalyzeResponse }) {
  const { g } = useFmt();
  const cells = data.twelve_cycle;
  const W = 640, H = 230, L = 30, Rt = 20, T = 30, B = 170;
  const x = (i: number) => L + (i * (W - L - Rt)) / 11;
  const y = (e: number) => B - (e / 9) * (B - T);
  const pts = cells.map((c, i) => `${x(i)},${y(c.energy)}`).join(" ");
  return (
    <svg className="stage-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="12운성 흐름">
      {[T, (T + B) / 2, B].map((yy) => <line key={yy} x1={L} x2={W - Rt} y1={yy} y2={yy} className="stage-chart__grid" />)}
      <polygon points={`${x(0)},${B} ${pts} ${x(11)},${B}`} className="stage-chart__area" />
      <polyline points={pts} className="stage-chart__line" />
      {cells.map((c, i) => (
        <g key={c.stage}>
          {c.marks.length > 0 && (
            <>
              <circle cx={x(i)} cy={y(c.energy)} r={5} className={`stage-chart__dot fill-${ELEMENT_CLASS[data.pillars.find((p) => p?.branch.hanja === c.branch)?.branch.element ?? "토"]}`} />
              {c.marks.map((m, k) => (
                <g key={m} transform={`translate(${x(i)}, ${y(c.energy) - 18 - k * 20})`}>
                  <rect x={-16} y={-9} width={32} height={17} rx={4} className="stage-chart__tag" />
                  <text textAnchor="middle" y={4} className="stage-chart__tagtext">{m}</text>
                </g>
              ))}
            </>
          )}
          <text x={x(i)} y={B + 22} textAnchor="middle" className={`stage-chart__stage ${c.marks.length ? "is-on" : ""}`}>{c.stage}</text>
          <text x={x(i)} y={B + 40} textAnchor="middle" className={`stage-chart__branch ${c.marks.length ? "is-on" : ""}`}>{g(c.branch)}</text>
        </g>
      ))}
    </svg>
  );
}

const STAGE_TONE: Record<string, string> = {
  장생: "strong", 관대: "strong", 건록: "strong", 제왕: "strong",
  목욕: "mid", 쇠: "mid", 양: "mid", 태: "mid",
  병: "weak", 사: "weak", 묘: "weak", 절: "weak",
};

function StageChip({ stage }: { stage: string }) {
  return <span className={`stage-chip stage-chip--${STAGE_TONE[stage] ?? "mid"}`}>{stage}</span>;
}

function MethodsTable({ data }: { data: AnalyzeResponse }) {
  const { g, tg } = useFmt();
  const dm = data.day_master;
  // 년주부터 (초년 → 노년 순서)
  const rows = [...data.pillars].reverse().filter(Boolean) as NonNullable<AnalyzeResponse["pillars"][number]>[];
  return (
    <Card title="12운성 적용법 비교" subtitle="같은 글자라도 무엇을 기준으로 대입하느냐에 따라 운성이 달라집니다">
      <div className="table-wrap">
        <table className="table methods">
          <thead>
            <tr>
              <th>기둥</th>
              <th>봉법<small>일간 {g(dm.hanja)} → 지지</small></th>
              <th>거법<small>자기 천간 → 지지</small></th>
              <th>좌법<small>지장간 → 그 지지</small></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.key}>
                <td><b>{p.label}</b> <Hanja text={p.ganji} className="serif" /></td>
                <td><StageChip stage={p.branch.stage} /> <span className="muted small">{p.branch.period}</span></td>
                <td><StageChip stage={p.branch.stage_geo} /> <span className="muted small">{g(p.stem.hanja)}→{g(p.branch.hanja)}</span></td>
                <td>
                  <div className="jwa">
                    {p.branch.stage_jwa.map((j) => (
                      <span key={j.role} className="jwa__item" title={`${j.role} · ${j.ten_god}`}>
                        <Hanja text={j.hanja} className="serif" /><span className="muted small">{tg(j.ten_god)}</span><StageChip stage={j.stage} />
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="method-notes">
        <li><b>봉법</b> 일간을 년·월·일·시지에 대입 — 년지 초년운 · 월지 청년운 · 일지 장년운 · 시지 노년운으로 간명</li>
        <li><b>거법</b> 각 기둥의 천간을 같은 기둥 지지에 대입 (년간→년지, 월간→월지 …)</li>
        <li><b>좌법</b> 각 지지의 지장간 글자를 그 지지에 대입 (십성 이름은 일간 기준)</li>
      </ul>
    </Card>
  );
}

function InjongCard({ data }: { data: AnalyzeResponse }) {
  const { g, tg } = useFmt();
  const { state } = useApp();
  const yk = Object.fromEntries(data.ten_god_meanings.map((m) => [m.ten_god, m.yukchin]));
  const day = data.pillars[1]!;
  return (
    <Card title={<>인종법(引從法) · 일지 <Hanja text={data.injong_branch} /> 기준</>}
          subtitle="천간에 뜬 글자를 일지에 대입해 그 십성(육친)의 상황을 봅니다 · 천간에 없는 십성은 일지와 음양을 맞춘 글자를 가정">
      <div className="injong-list">
        {data.injong.map((x, i) => (
          <div key={i} className={`injong-item ${x.assumed ? "is-assumed" : ""}`}>
            <div className="injong-item__who">
              <GlyphTile hanja={x.hanja} element={x.element} size="sm" dashed={x.assumed} />
              <div>
                <b>{tg(x.ten_god)}</b> <span className="muted small">{x.group}</span>
                <div className="muted small">{yk[x.ten_god]}</div>
              </div>
            </div>
            <span className={`chip ${x.assumed ? "chip--neutral" : "chip--accent"}`}>{x.assumed ? "가정" : x.source}</span>
            <span className="injong-item__arrow">{g(x.hanja)} → {g(data.injong_branch)}</span>
            <StageChip stage={x.stage} />
            <span className="injong-item__bar"><span style={{ width: `${(x.energy / 9) * 100}%` }} /></span>
          </div>
        ))}
      </div>
      <p className="footnote">
        일지 {g(day.branch.hanja)}의 음양은 정기({g(day.branch.hidden[day.branch.hidden.length - 1].hanja)}, {day.branch.hidden[day.branch.hidden.length - 1].yinyang}) 기준으로 맞췄습니다.
        {state.settings.injongAssume ? " 천간에 없는 글자는 12운성으로 통변하지 않는 학파도 많으니 '가정' 항목은 참고용입니다." : " 설정에서 '천간에 없는 십성 가정'이 꺼져 있어 실제 천간만 표시합니다."}
      </p>
    </Card>
  );
}

export function HiddenTab({ data }: { data: AnalyzeResponse }) {
  const { state } = useApp();
  const dm = data.day_master;
  return (
    <div className="stack">
      <HiddenCards data={data} />
      <div className="grid-2 grid-2--wide-left">
        <Card title={<>12운성 흐름 · 일간 <Hanja text={dm.hanja} /> (봉법)</>}
              subtitle={`일간이 각 지지에서 갖는 기운의 세기 · ${state.settings.yinMode === "eumpotae" ? "음포태(음간 역행)" : "음양동생"} 적용`}>
          <StageChart data={data} />
        </Card>
        <InjongCard data={data} />
      </div>
      <MethodsTable data={data} />
    </div>
  );
}
