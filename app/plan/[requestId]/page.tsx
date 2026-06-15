import { PlanResult } from '@/components/plan/PlanResult'
import { USE_SAMPLE_FALLBACK } from '@/lib/env'
import {
  SAMPLE_ACTION_REQUEST,
  SAMPLE_INSTITUTIONS,
  SAMPLE_HEATWAVE_PROFILES,
} from '@/lib/sample'
import type { ActionRequest, ChecklistRole } from '@/lib/types/db'

interface PageProps {
  params: Promise<{ requestId: string }>
}

interface ChecklistItemData {
  id: string
  content: string
  is_done: boolean
  role: ChecklistRole
}

// result_json의 체크리스트 배열 → ChecklistItemData 변환 (DB 없는 경우 또는 fallback)
function buildChecklistFromResult(
  request: ActionRequest
): ChecklistItemData[] {
  const result = request.result_json
  const items: ChecklistItemData[] = []
  const roles: [ChecklistRole, string[]][] = [
    ['director', result.director_checklist],
    ['teacher', result.teacher_checklist],
    ['shuttle', result.shuttle_checklist],
  ]
  for (const [role, list] of roles) {
    list.forEach((content, i) => {
      items.push({
        id: `${request.id}-${role}-${i}`,
        content,
        is_done: false,
        role,
      })
    })
  }
  return items
}

async function getFullPlanData(requestId: string): Promise<{
  request: ActionRequest
  checklistItems: ChecklistItemData[]
  institutionName: string
}> {
  // 샘플 fallback 모드 또는 샘플 ID
  if (USE_SAMPLE_FALLBACK || requestId === SAMPLE_ACTION_REQUEST.id) {
    return {
      request: SAMPLE_ACTION_REQUEST,
      checklistItems: buildChecklistFromResult(SAMPLE_ACTION_REQUEST),
      institutionName: SAMPLE_INSTITUTIONS[0].name,
    }
  }

  try {
    const { createAdminSupabaseClient } = await import('@/lib/supabase/server')
    const supabase = createAdminSupabaseClient()

    // action_request 조회
    const { data: arData, error: arErr } = await supabase
      .from('action_requests')
      .select('*')
      .eq('id', requestId)
      .single()

    if (arErr || !arData) throw arErr ?? new Error('not found')

    const request = arData as ActionRequest

    // 기관명 조회
    const { data: instData } = await supabase
      .from('institutions')
      .select('name')
      .eq('id', request.institution_id)
      .single()
    const institutionName = instData?.name ?? SAMPLE_INSTITUTIONS[0].name

    // checklist_items 조회 (is_fallback이면 result_json에서 빌드)
    let checklistItems: ChecklistItemData[]
    if (request.is_fallback) {
      checklistItems = buildChecklistFromResult(request)
    } else {
      const { data: ciData } = await supabase
        .from('checklist_items')
        .select('*')
        .eq('action_request_id', requestId)
        .order('sort_order')

      checklistItems = (ciData ?? []).map((ci) => ({
        id: ci.id as string,
        content: ci.content as string,
        is_done: ci.is_done as boolean,
        role: ci.role as ChecklistRole,
      }))

      // DB에 항목이 없으면 result_json에서 빌드
      if (checklistItems.length === 0) {
        checklistItems = buildChecklistFromResult(request)
      }
    }

    return { request, checklistItems, institutionName }
  } catch {
    return {
      request: SAMPLE_ACTION_REQUEST,
      checklistItems: buildChecklistFromResult(SAMPLE_ACTION_REQUEST),
      institutionName: SAMPLE_INSTITUTIONS[0].name,
    }
  }
}

export default async function PlanResultPage({ params }: PageProps) {
  const { requestId } = await params
  const { request, checklistItems, institutionName } = await getFullPlanData(requestId)

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-xl font-bold">대응계획 결과</h1>
      <PlanResult
        request={request}
        institutionName={institutionName}
        checklistItems={checklistItems}
      />
    </div>
  )
}
