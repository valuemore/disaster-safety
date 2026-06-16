import { PlanResult } from '@/components/plan/PlanResult'
import { USE_SAMPLE_FALLBACK } from '@/lib/env'
import { SAMPLE_ACTION_REQUEST, SAMPLE_INSTITUTIONS } from '@/lib/sample'
import type { ActionRequest } from '@/lib/types/db'

interface PageProps {
  params: Promise<{ requestId: string }>
}

async function getFullPlanData(requestId: string): Promise<{
  request: ActionRequest
  institutionName: string
}> {
  // 샘플 fallback 모드 또는 샘플 ID
  if (USE_SAMPLE_FALLBACK || requestId === SAMPLE_ACTION_REQUEST.id) {
    return {
      request: SAMPLE_ACTION_REQUEST,
      institutionName: SAMPLE_INSTITUTIONS[0].name,
    }
  }

  try {
    const { createAdminSupabaseClient } = await import('@/lib/supabase/server')
    const supabase = createAdminSupabaseClient()

    const { data: arData, error: arErr } = await supabase
      .from('action_requests')
      .select('*')
      .eq('id', requestId)
      .single()

    if (arErr || !arData) throw arErr ?? new Error('not found')

    const request = arData as ActionRequest

    const { data: instData } = await supabase
      .from('institutions')
      .select('name')
      .eq('id', request.institution_id)
      .single()
    const institutionName = instData?.name ?? SAMPLE_INSTITUTIONS[0].name

    return { request, institutionName }
  } catch {
    return {
      request: SAMPLE_ACTION_REQUEST,
      institutionName: SAMPLE_INSTITUTIONS[0].name,
    }
  }
}

export default async function PlanResultPage({ params }: PageProps) {
  const { requestId } = await params
  const { request, institutionName } = await getFullPlanData(requestId)

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-xl font-bold">대응계획 결과</h1>
      <PlanResult request={request} institutionName={institutionName} />
    </div>
  )
}
