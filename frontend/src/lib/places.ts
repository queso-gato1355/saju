// 출생지 → 경도 (진태양시 보정용). 표준 경선 135°E 기준 보정은 백엔드가 계산.
export interface Place {
  name: string;
  longitude: number | null;
}

export const PLACES: Place[] = [
  { name: "서울특별시", longitude: 126.98 },
  { name: "부산광역시", longitude: 129.08 },
  { name: "대구광역시", longitude: 128.6 },
  { name: "인천광역시", longitude: 126.71 },
  { name: "광주광역시", longitude: 126.85 },
  { name: "대전광역시", longitude: 127.38 },
  { name: "울산광역시", longitude: 129.31 },
  { name: "세종특별자치시", longitude: 127.29 },
  { name: "수원시", longitude: 127.03 },
  { name: "춘천시", longitude: 127.73 },
  { name: "강릉시", longitude: 128.88 },
  { name: "청주시", longitude: 127.49 },
  { name: "천안시", longitude: 127.15 },
  { name: "전주시", longitude: 127.15 },
  { name: "목포시", longitude: 126.39 },
  { name: "여수시", longitude: 127.66 },
  { name: "포항시", longitude: 129.37 },
  { name: "안동시", longitude: 128.73 },
  { name: "창원시", longitude: 128.68 },
  { name: "진주시", longitude: 128.11 },
  { name: "제주특별자치도", longitude: 126.53 },
  { name: "평양", longitude: 125.75 },
  { name: "모름 (보정 안 함)", longitude: null },
];

/** 경도 보정 분 (KST 135°E 기준) — 미리보기 표시용 */
export function correctionMinutes(lng: number | null): number | null {
  if (lng == null) return null;
  return Math.round((lng - 135) * 4);
}
