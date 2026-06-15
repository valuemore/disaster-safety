// T8-3: legacyAdapter — role_based_actions → 레거시 필드 파생 (소비처 backward compat)
// 기존 director_checklist / teacher_checklist / shuttle_checklist 를 직접 읽는
// 코드는 이 어댑터를 통해 role_based_actions에서 동일한 값을 얻는다.

// legacyAdapter는 db.ts::AiPlanResult 를 사용해 소비처(page.tsx 등)와 타입 호환성 유지.
// aiPlanSchema.ts::AiPlanResult 는 Zod infer 타입으로 disaster_type 이 required 이므로
// 구 result_json(optional disaster_type)을 받는 소비처에 직접 사용하면 타입 오류 발생.
import type { AiPlanResult } from '@/lib/types/db'
import type { RoleKey } from '@/lib/disaster/types'

/**
 * role_based_actions 배열에서 특정 역할의 actions 를 반환한다.
 * 해당 역할 항목이 없으면 빈 배열 반환.
 */
export function getActionsByRole(result: AiPlanResult, roleKey: RoleKey): string[] {
  if (!result.role_based_actions) return []
  const found = result.role_based_actions.find((r) => r.role === roleKey)
  return found?.actions ?? []
}

/**
 * role_based_actions로부터 레거시 checklist 필드를 파생·채운다.
 * PlanResult 등 기존 소비처가 director_checklist 등을 직접 읽을 때 항상 값이 있도록 보장.
 *
 * 매핑:
 *   director_checklist  ← director
 *   teacher_checklist   ← homeroom_teacher
 *   shuttle_checklist   ← bus_manager
 */
export function ensureLegacyChecklists(result: AiPlanResult): AiPlanResult {
  const rba = result.role_based_actions ?? []

  const getActions = (roleKey: RoleKey): string[] =>
    rba.find((r) => r.role === roleKey)?.actions ?? []

  return {
    ...result,
    director_checklist: result.director_checklist?.length
      ? result.director_checklist
      : getActions('director'),
    teacher_checklist: result.teacher_checklist?.length
      ? result.teacher_checklist
      : getActions('homeroom_teacher'),
    shuttle_checklist: result.shuttle_checklist?.length
      ? result.shuttle_checklist
      : getActions('bus_manager'),
  }
}
