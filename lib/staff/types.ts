/**
 * lib/staff/types.ts
 *
 * institutions.staff_profile JSONB 컬럼 구조 타입 정의 (0002 마이그레이션 §3c).
 *
 * 보안 원칙:
 * - PII 없음: 인력 유무·수·유형만. 이름·연락처·진단명 컬럼 없음.
 * - DB 저장: institutions.staff_profile JSONB(기본값 '{}')
 *
 * 모든 필드는 optional: 미입력 기관은 기본값 '{}'으로 저장됨.
 */

/** 보건담당자 유형 enum */
export type HealthStaffType =
  | 'nurse'               // 간호사
  | 'nursing_assistant'   // 간호조무사
  | 'health_teacher'      // 보건교사
  | 'designated'          // 지정 보건담당자 (감염병예방법 기준)
  | 'none'                // 보건담당자 없음

/**
 * 기관 급식·보건 인력 프로필 (institutions.staff_profile JSONB 구조).
 *
 * 계획 §3c 키 전체 포함. 모든 필드 optional(미입력 시 undefined).
 * 역할 자동 활성화 로직(roleRecommendation.ts)에서 이 타입을 입력으로 사용.
 */
export interface StaffProfile {
  // ── 급식 인력 ──────────────────────────────────────────────────────────
  /** 1회 급식 제공 인원 수 (집단급식소 기준 판단용 — 집계값만) */
  meal_count_per_serving?: number
  /** 급식(조리) 인력 보유 여부 */
  has_food_service_staff?: boolean
  /** 급식(조리) 인력 수 (집계값만) */
  food_service_staff_count?: number
  /** 조리사 면허 보유 인력 포함 여부 */
  has_cook_license_staff?: boolean
  /** 집단급식소 신고 여부 */
  has_collective_food_service?: boolean

  // ── 보건 인력 ──────────────────────────────────────────────────────────
  /** 보건 인력 보유 여부 */
  has_health_staff?: boolean
  /**
   * 보건담당자 유형.
   * 'nurse'=간호사, 'nursing_assistant'=간호조무사, 'health_teacher'=보건교사,
   * 'designated'=지정 보건담당자, 'none'=없음.
   */
  health_staff_type?: HealthStaffType | null
  /** 보건담당자 수 (집계값만) */
  health_staff_count?: number
  /** 간호사 또는 간호조무사 보유 여부 */
  has_nurse_or_nursing_assistant?: boolean
  /** 보건교사 보유 여부 (유치원·학교) */
  has_health_teacher?: boolean
  /** 지정 보건담당자 보유 여부 */
  has_designated_health_manager?: boolean

  // ── 유치원 전용 ────────────────────────────────────────────────────────
  /** 유치원 학급 수 (보건교사 배치 기준 확인용 — 집계값만) */
  kindergarten_class_count?: number
}
