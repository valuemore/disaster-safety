// DB 테이블 타입 정의 (docs/02_DB_SCHEMA.md 기준)
// 개인정보 원칙: 이름·진단명·약물명·보호자 연락처 필드 없음

export type InstitutionType = 'daycare' | 'kindergarten'
export type DisasterMessageSource = 'sample' | 'manual' | 'api'
export type Priority = 'high' | 'medium' | 'low'
export type Role = 'admin' | 'director' | 'teacher' | 'shuttle'
export type ChecklistRole = 'director' | 'teacher' | 'shuttle'
export type PickupWaitPlace = 'indoor' | 'shade' | 'outdoor' | 'etc'
export type SituationCode =
  | 'before_outdoor'
  | 'during_outdoor'
  | 'field_trip_planned'
  | 'meal_time'
  | 'nap_time'
  | 'pickup_prep'
  | 'before_shuttle'
  | 'cooling_issue'
  | 'heat_symptom_suspected'
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
  heatwave_profile_id: string | null
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
  outdoor_adjusted: boolean | null
  cooling_checked: boolean | null
  child_health_issue: boolean | null
  parents_notified: boolean | null
  shuttle_checked: boolean | null
  completed_by: string | null
  notes: string | null
  improvement: string | null
  created_at: string
}

// AI 출력 JSON 스키마 (docs/04_AI_PROMPT_SPEC.md §2)
export interface AiPlanResult {
  disaster_summary: string
  priority: Priority
  priority_reason: string
  reflected_evidence: string[]
  missing_info: string[]
  director_checklist: string[]
  teacher_checklist: string[]
  shuttle_checklist: string[]
  parent_notice: string
  after_action_draft: {
    outdoor_adjusted: string | null
    cooling_checked: string | null
    child_health_issue: string | null
    parents_notified: string | null
    shuttle_checked: string | null
    notes: string
    improvement: string
  }
  emergency_contact_guide: string
  official_priority_notice: string
  safety_disclaimer: string
}
