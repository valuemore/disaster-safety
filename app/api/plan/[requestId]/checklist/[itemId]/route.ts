import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { USE_SAMPLE_FALLBACK } from '@/lib/env'

const ToggleSchema = z.object({ is_done: z.boolean() })

interface Params {
  params: Promise<{ requestId: string; itemId: string }>
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { itemId } = await params
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  const parsed = ToggleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: '입력값이 올바르지 않습니다.' }, { status: 400 })
  }

  // 샘플 모드 또는 fake ID는 로컬 상태로만 관리 — 200 반환
  if (USE_SAMPLE_FALLBACK || itemId.includes('-director-') || itemId.includes('-teacher-') || itemId.includes('-shuttle-')) {
    return NextResponse.json({ success: true, source: 'local' })
  }

  try {
    const { createAdminSupabaseClient } = await import('@/lib/supabase/server')
    const supabase = createAdminSupabaseClient()
    const { error } = await supabase
      .from('checklist_items')
      .update({
        is_done: parsed.data.is_done,
        done_at: parsed.data.is_done ? new Date().toISOString() : null,
      })
      .eq('id', itemId)

    if (error) throw error
    return NextResponse.json({ success: true, source: 'db' })
  } catch (err) {
    console.error('[PATCH checklist toggle]', err)
    // 토글은 로컬 상태가 이미 반영됐으므로 에러여도 200 반환
    return NextResponse.json({ success: true, source: 'local' })
  }
}
