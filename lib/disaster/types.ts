// 재난유형 및 역할 키 정의 (docs/11_DISASTER_TYPE_EXPANSION_PLAN.md §3, §5 기준)
// P8 T8-1 슬라이스: 신규 구조 추가만, 기존 폭염 동작 불변

import type { ChecklistRole } from '@/lib/types/db'

/** 지원 재난유형 식별자 */
export type DisasterType = 'heatwave' | 'heavy_rain' | 'infection'

/**
 * AI 출력 및 역할 레벨 키.
 * DB checklist_items.role 은 5-값('director'|'teacher'|'shuttle'|'cook_or_food_service'|'health_manager').
 * ROLEKEY_TO_DB_ROLE 매핑을 통해 변환한다.
 */
export type RoleKey =
  | 'director'
  | 'homeroom_teacher'
  | 'bus_manager'
  | 'cook_or_food_service'
  | 'health_manager'

// ── DB ↔ RoleKey 매핑 ──────────────────────────────────────────────────────

/**
 * AI/타입 레벨 RoleKey → DB checklist_items.role 변환.
 * 0002 마이그레이션으로 DB CHECK 5종 확장 완료:
 * cook_or_food_service / health_manager 포함.
 */
export const ROLEKEY_TO_DB_ROLE: Record<RoleKey, ChecklistRole> = {
  director: 'director',
  homeroom_teacher: 'teacher',
  bus_manager: 'shuttle',
  cook_or_food_service: 'cook_or_food_service',
  health_manager: 'health_manager',
} as const

/**
 * DB checklist_items.role → RoleKey 역매핑
 * 0002 마이그레이션에서 DB CHECK 5종 확장 완료.
 * cook_or_food_service / health_manager 는 동일 키를 그대로 RoleKey로 사용.
 */
export const DB_ROLE_TO_ROLEKEY: Record<ChecklistRole, RoleKey> = {
  director: 'director',
  teacher: 'homeroom_teacher',
  shuttle: 'bus_manager',
  cook_or_food_service: 'cook_or_food_service',
  health_manager: 'health_manager',
} as const

// ── 역할 한국어 라벨 ───────────────────────────────────────────────────────

/** RoleKey → 한국어 표시 라벨 */
export const ROLE_LABELS: Record<RoleKey, string> = {
  director: '원장',
  homeroom_teacher: '담임교사',
  bus_manager: '통학버스 담당자',
  cook_or_food_service: '조리사/급식담당자',
  health_manager: '보건담당자',
} as const
