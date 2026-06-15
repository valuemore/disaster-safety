import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AfterActionForm } from '@/components/plan/AfterActionForm'
import { USE_SAMPLE_FALLBACK } from '@/lib/env'
import { SAMPLE_ACTION_REQUEST, SAMPLE_INSTITUTIONS } from '@/lib/sample'
import type { ActionRequest } from '@/lib/types/db'

interface PageProps {
  params: Promise<{ requestId: string }>
}

async function getActionRequest(requestId: string): Promise<{
  request: ActionRequest
  institutionName: string
  hasShuttle: boolean
}> {
  if (USE_SAMPLE_FALLBACK || requestId === SAMPLE_ACTION_REQUEST.id) {
    return {
      request: SAMPLE_ACTION_REQUEST,
      institutionName: SAMPLE_INSTITUTIONS[0].name,
      hasShuttle: SAMPLE_INSTITUTIONS[0].has_shuttle,
    }
  }

  try {
    const { createAdminSupabaseClient } = await import('@/lib/supabase/server')
    const supabase = createAdminSupabaseClient()

    const { data: ar, error: arErr } = await supabase
      .from('action_requests')
      .select('*')
      .eq('id', requestId)
      .single()

    if (arErr || !ar) throw arErr ?? new Error('not found')

    const { data: inst } = await supabase
      .from('institutions')
      .select('name, has_shuttle')
      .eq('id', ar.institution_id)
      .single()

    return {
      request: ar as ActionRequest,
      institutionName: inst?.name ?? SAMPLE_INSTITUTIONS[0].name,
      hasShuttle: inst?.has_shuttle ?? false,
    }
  } catch {
    return {
      request: SAMPLE_ACTION_REQUEST,
      institutionName: SAMPLE_INSTITUTIONS[0].name,
      hasShuttle: SAMPLE_INSTITUTIONS[0].has_shuttle,
    }
  }
}

export default async function AfterActionPage({ params }: PageProps) {
  const { requestId } = await params
  const { request, institutionName, hasShuttle } = await getActionRequest(requestId)
  const draft = request.result_json.after_action_draft

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center gap-2">
        <Link href={`/plan/${requestId}`}>
          <Button variant="ghost" size="sm" className="px-2">
            ← 대응계획
          </Button>
        </Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-xl font-bold">사후기록</h1>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">{institutionName}</p>

      <AfterActionForm
        requestId={requestId}
        aiDraft={draft}
        hasShuttle={hasShuttle}
      />
    </div>
  )
}
