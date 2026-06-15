// DB 테이블 타입 정의 (docs/02_DB_SCHEMA.md 기준)
// 개인정보 원칙: 이름·진단명·약물명·보호자 연락처 필드 없음

import type { StaffProfile } from '@/lib/staff/types'
export type { StaffProfile } from '@/lib/staff/types'

export type InstitutionType = 'daycare' | 'kindergarten'
export type DisasterMessageSource = 'sample' | 'manual' | 'api'
export type Priority = 'high' | 'medium' | 'low'
export type Role =
  | 'admin'
  | 'director'
  | 'teacher'
  | 'shuttle'
  | 'cook_or_food_service'
  | 'health_manager'
/** DB checklist_items.role 허용값 (0002 마이그레이션으로 확장) */
export type ChecklistRole =
  | 'director'
  | 'teacher'
  | 'shuttle'
  | 'cook_or_food_service'
  | 'health_manager'
export type PickupWaitPlace = 'indoor' | 'shade' | 'outdoor' | 'etc'
/** 지원 재난유형 식별자 (0002 마이그레이션 CHECK 제약과 동기화) */
export type DisasterType = 'heatwave' | 'heavy_rain' | 'infection'
export type SituationCode =
  // 폭염 상황 코드
  | 'before_outdoor'
  | 'during_outdoor'
  | 'field_trip_planned'
  | 'meal_time'
  | 'nap_time'
  | 'pickup_prep'
  | 'before_shuttle'
  | 'cooling_issue'
  | 'heat_symptom_suspected'
  // 집중호우 상황 코드
  | 'during_shuttle'
  | 'basement_in_use'
  | 'flood_risk_nearby'
  | 'pickup_delay_possible'
  | 'power_or_leak'
  // 감염병 상황 코드
  | 'symptomatic_child'
  | 'fever_child'
  | 'vomit_diarrhea'
  | 'respiratory_multiple'
  | 'same_class_repeat'
  | 'guardian_contact_needed'
  | 'attendance_stop_needed'
  | 'classroom_disinfection'
  | 'meal_restroom_hygiene'
  | 'staff_symptomatic'
  | 'parent_notice_needed'
  // 폭염 조리·보건 추가 코드 (T11-5)
  | 'meal_storage_check'
  | 'kitchen_temp_rise'
  // 집중호우 조리·보건 추가 코드 (T11-5)
  | 'kitchen_leak_or_power'
  | 'meal_delay'
  | 'fall_or_anxiety'
  // 감염병 조리 추가 코드 (T11-5)
  | 'cook_symptomatic'
  // 공통 코드
  | 'no_special'
  | 'etc'

export interface Institution {
  id: string
  name: string
  type: InstitutionType
  address: string | null
  latitude: number | null
  longitude: number | null
  sido: string | null
  sigungu: string | null
  dong: string | null
  total_children: number | null
  infant_count: number | null
  toddler_count: number | null
  staff_count: number | null
  has_shuttle: boolean
  has_outdoor_playground: boolean
  cooling_space_count: number
  water_available: boolean
  /**
   * 급식·보건 인력 정보 (0002 추가 컬럼).
   * 구조: lib/staff/types.ts StaffProfile 타입.
   * PII 없음: 인력 유무·수·유형만. 이름·연락처 없음.
   */
  staff_profile?: StaffProfile
  created_at: string
  updated_at: string
}

export interface HeatwaveProfile {
  id: string
  institution_id: string
  heat_vulnerable_count: number
  respiratory_caution_count: number
  mobility_support_count: number
  special_support_count: number
  cooling_ok: boolean
  indoor_alt_space: boolean
  water_supply_ok: boolean
  thermometer: boolean
  first_aid_kit: boolean
  vehicle_thermometer: boolean
  pickup_wait_place: PickupWaitPlace | null
  is_current: boolean
  created_at: string
}

/**
 * institution_risk_profiles 테이블 (0002 신규)
 * 공통 컬럼 + 재난유형별 특수필드(disaster_specific JSONB)
 *
 * disaster_specific 키 예시:
 *   폭염: heat_vulnerable_count, respiratory_caution_count, mobility_support_count,
 *         special_support_count, cooling_ok, water_supply_ok,
 *         vehicle_thermometer, pickup_wait_place
 *   집중호우: low_ground, near_stream, has_basement, ...
 *   감염병: has_health_room, has_thermometer, has_sanitizer, ...
 */
export interface InstitutionRiskProfile {
  id: string
  institution_id: string
  disaster_type: DisasterType
  // 공통 위험대응 컬럼
  thermometer: boolean
  first_aid_kit: boolean
  indoor_alt_space: boolean
  // 유형별 특수 필드 (JSONB)
  disaster_specific: Record<string, unknown>
  is_current: boolean
  created_at: string
}

export interface DisasterMessage {
  id: string
  institution_id: string | null
  disaster_type: string
  source: DisasterMessageSource
  raw_text: string
  summary: string | null
  issued_at: string | null
  received_at: string
  created_at: string
}

export interface ActionRequest {
  id: string
  institution_id: string
  disaster_message_id: string | null
  /** @deprecated 0002 마이그레이션 후 risk_profile_id 사용. P8 안정화 후 제거 예정. */
  heatwave_profile_id: string | null
  /** 범용 프로필 FK (0002 신규 컬럼 — institution_risk_profiles.id) */
  risk_profile_id: string | null
  selected_situations: SituationCode[] | null
  situation_etc: string | null
  priority: Priority | null
  result_json: AiPlanResult
  is_fallback: boolean
  model: string | null
  created_by_role: Role | null
  created_at: string
}

export interface ChecklistItem {
  id: string
  action_request_id: string
  role: ChecklistRole
  sort_order: number
  content: string
  is_done: boolean
  done_at: string | null
  created_at: string
}

export interface AfterActionRecord {
  id: string
  action_request_id: string
  institution_id: string
  message_checked_at: string | null
  // 폭염 레거시 boolean 5개 — 기존 행 호환을 위해 유지
  outdoor_adjusted: boolean | null
  cooling_checked: boolean | null
  child_health_issue: boolean | null
  parents_notified: boolean | null
  shuttle_checked: boolean | null
  completed_by: string | null
  notes: string | null
  improvement: string | null
  /** 재난유형 (0002 추가 컬럼 — 기본값 'heatwave') */
  disaster_type?: DisasterType
  /** 재난유형별 동적 체크 항목 키-값 (0002 추가 컬럼) */
  checked_items?: Record<string, string | boolean | null>
  created_at: string
}

// AI 출력 JSON 스키마 (docs/04_AI_PROMPT_SPEC.md §2)
// T8-3: role_based_actions 배열 추가, disaster_type 추가, after_action_draft 범용화.
// 레거시 *_checklist 필드는 optional 유지 (legacyAdapter 경유 보장).
export interface RoleBasedAction {
  role: 'director' | 'homeroom_teacher' | 'bus_manager' | 'cook_or_food_service' | 'health_manager'
  role_label: string
  actions: string[]
}

export interface AiPlanResult {
  // 신규: 재난유형
  disaster_type?: DisasterType
  disaster_summary: string
  priority: Priority
  priority_reason: string
  reflected_evidence: string[]
  missing_info: string[]
  // 신규: 역할별 행동 배열 (핵심 구조)
  role_based_actions?: RoleBasedAction[]
  parent_notice: string
  after_action_draft: {
    // 신규: 재난유형별 동적 키-값
    checked_items?: Record<string, string | null>
    notes: string
    improvement: string
    // 폭염 레거시 필드 — optional 유지
    outdoor_adjusted?: string | null
    cooling_checked?: string | null
    child_health_issue?: string | null
    parents_notified?: string | null
    shuttle_checked?: string | null
  }
  emergency_contact_guide: string
  official_priority_notice: string
  safety_disclaimer: string
  // 레거시 필드 — legacyAdapter 가 role_based_actions 로부터 파생
  director_checklist?: string[]
  teacher_checklist?: string[]
  shuttle_checklist?: string[]
}
