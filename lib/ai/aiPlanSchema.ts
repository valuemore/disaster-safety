import { z } from 'zod'
import type { RoleKey } from '@/lib/disaster/types'

// docs/04_AI_PROMPT_SPEC.md §2 출력 JSON 스키마
// T8-3: role_based_actions 배열 추가, disaster_type 추가, after_action_draft 범용화
// 기존 director/teacher/shuttle_checklist 는 legacyAdapter 호환을 위해 optional 유지

const ROLE_KEY_VALUES = [
  'director',
  'homeroom_teacher',
  'bus_manager',
  'cook_or_food_service',
  'health_manager',
] as const satisfies [RoleKey, ...RoleKey[]]

export const AiPlanSchema = z.object({
  // ── 신규: 재난유형 ─────────────────────────────────────────────────────────
  disaster_type: z.enum(['heatwave', 'heavy_rain', 'infection']),

  // ── 공통 요약·우선순위·근거 ───────────────────────────────────────────────
  disaster_summary: z.string().min(1),
  priority: z.enum(['high', 'medium', 'low']),
  priority_reason: z.string().min(1),
  reflected_evidence: z.array(z.string()).min(1),
  missing_info: z.array(z.string()).min(1),

  // ── 신규: 역할별 행동 배열 (핵심 구조) ───────────────────────────────────
  role_based_actions: z
    .array(
      z.object({
        role: z.enum(ROLE_KEY_VALUES),
        role_label: z.string(),
        actions: z.array(z.string()), // 빈 배열 허용 ("해당 없음" 처리)
      })
    )
    .min(1),

  // ── 학부모 안내문 ─────────────────────────────────────────────────────────
  parent_notice: z.string().min(1),

  // ── 사후기록 초안 (deprecated: 사후기록 기능 제거 — optional 유지로 기존 샘플 호환) ──
  after_action_draft: z
    .object({
      checked_items: z.record(z.string(), z.string().nullable()),
      notes: z.string(),
      improvement: z.string(),
      outdoor_adjusted: z.string().nullable().optional(),
      cooling_checked: z.string().nullable().optional(),
      child_health_issue: z.string().nullable().optional(),
      parents_notified: z.string().nullable().optional(),
      shuttle_checked: z.string().nullable().optional(),
    })
    .optional(),

  // ── 응급/공식기관/disclaimer ──────────────────────────────────────────────
  emergency_contact_guide: z.string().min(1),
  official_priority_notice: z.string().min(1),
  safety_disclaimer: z.string(),

  // ── 레거시 필드 — optional (legacyAdapter가 role_based_actions로부터 파생) ─
  director_checklist: z.array(z.string()).optional(),
  teacher_checklist: z.array(z.string()).optional(),
  shuttle_checklist: z.array(z.string()).optional(),
})

export type AiPlanResult = z.infer<typeof AiPlanSchema>

// safety_disclaimer는 항상 이 고정 문구로 서버에서 덮어씀 (docs/04 §5 6번)
export const SAFETY_DISCLAIMER_FIXED =
  '공식 재난문자와 기관 입력정보를 바탕으로 한 대응지원 정보이며, 위급상황에서는 공식기관 지시와 119 안내를 우선합니다.'
