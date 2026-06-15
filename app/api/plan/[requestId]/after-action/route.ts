import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { USE_SAMPLE_FALLBACK } from '@/lib/env'
import { SAMPLE_ACTION_REQUEST } from '@/lib/sample'

const AfterActionSchema = z.object({
  message_checked_at: z.string().nullable().optional(),
  outdoor_adjusted: z.boolean().nullable().optional(),
  cooling_checked: z.boolean().nullable().optional(),
  child_health_issue: z.boolean().nullable().optional(),
  parents_notified: z.boolean().nullable().optional(),
  shuttle_checked: z.boolean().nullable().optional(),
  completed_by: z.string().max(100).nullable().optional(),
  // 자유텍스트 필드: 개인식별정보 금지 안내는 UI에서 제공
  notes: z.string().max(2000).nullable().optional(),
  improvement: z.string().max(2000).nullable().optional(),
})

interface Params {
  params: Promise<{ requestId: string }>
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { requestId } = await params

  if (USE_SAMPLE_FALLBACK) {
    return NextResponse.json({ data: null, source: 'sample' })
  }

  try {
    const { createAdminSupabaseClient } = await import('@/lib/supabase/server')
    const supabase = createAdminSupabaseClient()
    const { data, error } = await supabase
      .from('after_action_records')
      .select('*')
      .eq('action_request_id', requestId)
      .maybeSingle()
    if (error) throw error
    return NextResponse.json({ data: data ?? null, source: 'db' })
  } catch (err) {
    console.error('[GET after-action]', err)
    return NextResponse.json({ data: null, source: 'sample' })
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { requestId } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  const parsed = AfterActionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: '입력값이 올바르지 않습니다.', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  // 샘플 모드: 저장 없이 성공 반환
  if (USE_SAMPLE_FALLBACK || requestId === SAMPLE_ACTION_REQUEST.id) {
    return NextResponse.json({
      data: { id: 'sample-aar', action_request_id: requestId, ...parsed.data },
      source: 'sample',
    })
  }

  try {
    const { createAdminSupabaseClient } = await import('@/lib/supabase/server')
    const supabase = createAdminSupabaseClient()

    // action_request에서 institution_id 조회
    const { data: ar, error: arErr } = await supabase
      .from('action_requests')
      .select('institution_id')
      .eq('id', requestId)
      .single()
    if (arErr) throw arErr

    // upsert (동일 action_request_id 중복 방지)
    const { data, error } = await supabase
      .from('after_action_records')
      .upsert(
        {
          action_request_id: requestId,
          institution_id: ar.institution_id,
          ...parsed.data,
        },
        { onConflict: 'action_request_id' }
      )
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ data, source: 'db' }, { status: 201 })
  } catch (err) {
    console.error('[POST after-action]', err)
    return NextResponse.json({ error: '사후기록 저장 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
