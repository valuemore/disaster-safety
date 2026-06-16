import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SafetyNotice } from '@/components/common/SafetyNotice'
import { USE_SAMPLE_FALLBACK } from '@/lib/env'
import { SAMPLE_ACTION_REQUEST } from '@/lib/sample'
import { ensureLegacyChecklists } from '@/lib/ai/legacyAdapter'
import { ROLE_LABELS, type RoleKey } from '@/lib/disaster/types'
import type { ActionRequest } from '@/lib/types/db'

interface PageProps {
  params: Promise<{ token: string; role: string }>
}

async function loadByToken(token: string): Promise<ActionRequest | null> {
  if (USE_SAMPLE_FALLBACK || token.startsWith('sample-')) {
    return SAMPLE_ACTION_REQUEST
  }
  try {
    const { createAdminSupabaseClient } = await import('@/lib/supabase/server')
    const supabase = createAdminSupabaseClient()
    const { data, error } = await supabase
      .from('action_requests')
      .select('*')
      .eq('share_token', token)
      .single()
    if (error || !data) return null
    return data as ActionRequest
  } catch {
    return null
  }
}

export default async function SharePage({ params }: PageProps) {
  const { token, role } = await params
  const request = await loadByToken(token)
  if (!request) notFound()

  const result = ensureLegacyChecklists(request.result_json)

  // parent(학부모 안내문) 또는 역할별 대응계획
  let title: string
  let body: React.ReactNode

  if (role === 'parent') {
    title = '학부모 안내문'
    body = <p className="whitespace-pre-wrap text-sm leading-relaxed">{result.parent_notice}</p>
  } else {
    const roleKey = role as RoleKey
    const entry = (result.role_based_actions ?? []).find((r) => r.role === roleKey)
    title = `${ROLE_LABELS[roleKey] ?? role} 대응계획`
    const actions = entry?.actions ?? []
    body =
      actions.length === 0 || (actions.length === 1 && actions[0] === '해당 없음') ? (
        <p className="text-sm text-muted-foreground">이 역할에 해당하는 조치 항목이 없습니다.</p>
      ) : (
        <ol className="space-y-2">
          {actions.map((a, i) => (
            <li key={i} className="flex items-start gap-3 text-sm">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs">
                {i + 1}
              </span>
              <span className="leading-snug">{a}</span>
            </li>
          ))}
        </ol>
      )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-4">
        <p className="text-xs text-muted-foreground">재난안전MVP · 공유된 대응계획</p>
        <h1 className="mt-1 text-xl font-bold">{title}</h1>
      </div>

      <Card className="mb-4">
        <CardHeader className="pb-1">
          <CardTitle className="text-sm">재난문자 요약</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{result.disaster_summary}</p>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{title}</CardTitle>
        </CardHeader>
        <CardContent>{body}</CardContent>
      </Card>

      <SafetyNotice />
    </div>
  )
}
