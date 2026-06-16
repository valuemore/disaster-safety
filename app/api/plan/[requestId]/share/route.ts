import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { USE_SAMPLE_FALLBACK } from '@/lib/env'
import { getSessionInstitutionId } from '@/lib/auth/session'

interface RouteContext {
  params: Promise<{ requestId: string }>
}

/**
 * 대응계획 공유 토큰 발급 (POST).
 * 세션 기관이 소유한 action_request인지 검증 후 share_token을 생성/반환한다.
 */
export async function POST(_req: NextRequest, { params }: RouteContext) {
  const { requestId } = await params

  // 샘플 모드: DB 없이 결정적 토큰 반환 (시연 무중단)
  if (USE_SAMPLE_FALLBACK) {
    return NextResponse.json({ data: { token: `sample-${requestId}` }, source: 'sample' })
  }

  const iid = await getSessionInstitutionId()
  if (!iid) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  try {
    const { createAdminSupabaseClient } = await import('@/lib/supabase/server')
    const supabase = createAdminSupabaseClient()

    const { data: ar, error } = await supabase
      .from('action_requests')
      .select('id, institution_id, share_token')
      .eq('id', requestId)
      .single()

    if (error || !ar) {
      return NextResponse.json({ error: '대응계획을 찾을 수 없습니다.' }, { status: 404 })
    }
    if (ar.institution_id !== iid) {
      return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })
    }

    if (ar.share_token) {
      return NextResponse.json({ data: { token: ar.share_token }, source: 'db' })
    }

    const token = randomBytes(18).toString('base64url')
    const { error: updErr } = await supabase
      .from('action_requests')
      .update({ share_token: token })
      .eq('id', requestId)
    if (updErr) throw updErr

    return NextResponse.json({ data: { token }, source: 'db' })
  } catch (err) {
    console.error('[POST /api/plan/[id]/share]', err)
    return NextResponse.json({ error: '공유 링크 생성 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
