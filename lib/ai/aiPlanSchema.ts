import { z } from 'zod'

// docs/04_AI_PROMPT_SPEC.md §2 출력 JSON 스키마
export const AiPlanSchema = z.object({
  disaster_summary: z.string().min(1),
  priority: z.enum(['high', 'medium', 'low']),
  priority_reason: z.string().min(1),
  reflected_evidence: z.array(z.string()).min(1),
  missing_info: z.array(z.string()).min(1),
  director_checklist: z.array(z.string()).min(1),
  teacher_checklist: z.array(z.string()).min(1),
  shuttle_checklist: z.array(z.string()).min(1),
  parent_notice: z.string().min(1),
  after_action_draft: z.object({
    outdoor_adjusted: z.string().nullable(),
    cooling_checked: z.string().nullable(),
    child_health_issue: z.string().nullable(),
    parents_notified: z.string().nullable(),
    shuttle_checked: z.string().nullable(),
    notes: z.string(),
    improvement: z.string(),
  }),
  emergency_contact_guide: z.string().min(1),
  official_priority_notice: z.string().min(1),
  safety_disclaimer: z.string(),
})

export type AiPlanResult = z.infer<typeof AiPlanSchema>

// safety_disclaimer는 항상 이 고정 문구로 서버에서 덮어씀 (docs/04 §5 6번)
export const SAFETY_DISCLAIMER_FIXED =
  '공식 재난문자와 기관 입력정보를 바탕으로 한 대응지원 정보이며, 위급상황에서는 공식기관 지시와 119 안내를 우선합니다.'
