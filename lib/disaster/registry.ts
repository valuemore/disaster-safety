// 재난유형별 메타데이터 레지스트리 (docs/11_DISASTER_TYPE_EXPANSION_PLAN.md §6 기준)
// P8 T8-1: 폭염만 실제 데이터 등록, heavy_rain/infection 은 enabled:false placeholder.
// SituationPicker.tsx 는 T8-4에서 이 레지스트리를 참조하도록 변경 예정.

import type { DisasterType } from './types'

/** 현재상황 선택 옵션 단위 */
export interface SituationOption {
  code: string
  label: string
  emoji: string
}

/** 재난유형 레지스트리 항목 */
export interface DisasterRegistryEntry {
  type: DisasterType
  /** 재난유형 선택 화면 활성 여부 (false = "준비 중" 표시) */
  enabled: boolean
  /** 화면 표시 라벨 (예: '폭염') */
  label: string
  /** 현재상황 선택 버튼 목록 */
  situations: SituationOption[]
}

// ── 폭염 상황 목록 (SituationPicker.tsx SITUATIONS 와 동일) ──────────────

const HEATWAVE_SITUATIONS: SituationOption[] = [
  { code: 'before_outdoor',         label: '실외활동 시작 전',      emoji: '🌤️' },
  { code: 'during_outdoor',         label: '실외놀이 중',            emoji: '🏃' },
  { code: 'field_trip_planned',     label: '현장학습·외출 예정',    emoji: '🚌' },
  { code: 'meal_time',              label: '급식 시간',              emoji: '🍱' },
  { code: 'nap_time',               label: '낮잠 시간',              emoji: '😴' },
  { code: 'pickup_prep',            label: '하원 준비 중',           emoji: '🎒' },
  { code: 'before_shuttle',         label: '통학버스 탑승 전',       emoji: '🚌' },
  { code: 'cooling_issue',          label: '냉방기 이상',            emoji: '❄️' },
  { code: 'heat_symptom_suspected', label: '온열증상 의심 유아',     emoji: '🌡️' },
  { code: 'meal_storage_check',     label: '급식 식재료 보관 확인',  emoji: '🧊' },
  { code: 'kitchen_temp_rise',      label: '조리실 온도 상승',       emoji: '🍳' },
  { code: 'no_special',             label: '특별한 상황 없음',       emoji: '✅' },
  { code: 'etc',                    label: '기타(직접 입력)',        emoji: '✏️' },
]

// ── 집중호우 상황 목록 (P9 T9-1 신규) ───────────────────────────────────────

const HEAVY_RAIN_SITUATIONS: SituationOption[] = [
  { code: 'before_outdoor',        label: '실외활동 시작 전',       emoji: '🌧️' },
  { code: 'during_outdoor',        label: '실외놀이 중',             emoji: '☔' },
  { code: 'pickup_prep',           label: '하원 준비 중',            emoji: '🎒' },
  { code: 'before_shuttle',        label: '통학버스 운행 전',        emoji: '🚌' },
  { code: 'during_shuttle',        label: '통학버스 운행 중',        emoji: '🌊' },
  { code: 'basement_in_use',       label: '지하공간 사용 중',        emoji: '⚠️' },
  { code: 'field_trip_planned',    label: '현장학습 예정',           emoji: '🚌' },
  { code: 'flood_risk_nearby',     label: '기관 주변 침수 우려',     emoji: '🌊' },
  { code: 'pickup_delay_possible', label: '보호자 인계 지연 가능',   emoji: '⏱️' },
  { code: 'power_or_leak',              label: '정전·누수 발생',           emoji: '⚡' },
  { code: 'kitchen_leak_or_power',      label: '조리실 누수·정전 우려',    emoji: '💧' },
  { code: 'meal_delay',                 label: '급식 제공 지연 가능',      emoji: '🍽️' },
  { code: 'fall_or_anxiety',            label: '낙상·불안 반응 유아',      emoji: '😟' },
  { code: 'no_special',                 label: '특별한 상황 없음',         emoji: '✅' },
  { code: 'etc',                        label: '기타(직접 입력)',          emoji: '✏️' },
]

// ── 감염병 상황 목록 (P10 T10-1 신규) ──────────────────────────────────────

const INFECTION_SITUATIONS: SituationOption[] = [
  { code: 'symptomatic_child',      label: '유증상 유아 발생',          emoji: '🤒' },
  { code: 'fever_child',            label: '발열 유아 발생',             emoji: '🌡️' },
  { code: 'vomit_diarrhea',         label: '구토·설사 증상',            emoji: '🤢' },
  { code: 'respiratory_multiple',   label: '호흡기 증상 다수',           emoji: '😷' },
  { code: 'same_class_repeat',      label: '같은 반 유사증상 반복',     emoji: '🦠' },
  { code: 'guardian_contact_needed',label: '보호자 연락 필요',           emoji: '📞' },
  { code: 'attendance_stop_needed', label: '등원중지 안내 필요',         emoji: '🚫' },
  { code: 'classroom_disinfection', label: '교실 소독 필요',             emoji: '🧼' },
  { code: 'meal_restroom_hygiene',  label: '급식·화장실 위생 강화',     emoji: '🍽️' },
  { code: 'staff_symptomatic',      label: '교직원 유증상',              emoji: '👩‍⚕️' },
  { code: 'cook_symptomatic',       label: '조리종사자 유증상',          emoji: '🤧' },
  { code: 'parent_notice_needed',   label: '학부모 안내문 발송 필요',   emoji: '📄' },
  { code: 'no_special',             label: '특별한 상황 없음',           emoji: '✅' },
  { code: 'etc',                    label: '기타(직접 입력)',            emoji: '✏️' },
]

// ── 레지스트리 정의 ────────────────────────────────────────────────────────

export const DISASTER_REGISTRY: Record<DisasterType, DisasterRegistryEntry> = {
  heatwave: {
    type: 'heatwave',
    enabled: true,
    label: '폭염',
    situations: HEATWAVE_SITUATIONS,
  },

  // P9 T9-3: 집중호우 활성화
  heavy_rain: {
    type: 'heavy_rain',
    enabled: true,
    label: '집중호우',
    situations: HEAVY_RAIN_SITUATIONS,
  },

  // P10 T10-3: 감염병 활성화
  infection: {
    type: 'infection',
    enabled: true,
    label: '감염병',
    situations: INFECTION_SITUATIONS,
  },
}

// ── 헬퍼 함수 ─────────────────────────────────────────────────────────────

/** 특정 재난유형 항목 반환 */
export function getDisasterEntry(type: DisasterType): DisasterRegistryEntry {
  return DISASTER_REGISTRY[type]
}

/** enabled:true 인 재난유형 목록만 반환 */
export function getEnabledDisasters(): DisasterRegistryEntry[] {
  return Object.values(DISASTER_REGISTRY).filter((entry) => entry.enabled)
}
