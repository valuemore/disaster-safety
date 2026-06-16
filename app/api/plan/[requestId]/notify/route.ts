import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { USE_SAMPLE_FALLBACK, APP_BASE_URL } from '@/lib/env'
import { getSessionInstitutionId } from '@/lib/auth/session'
import { sendNotifications, type NotifyTarget } from '@/lib/external/notify'
import { DB_ROLE_TO_ROLEKEY, ROLE_LABELS } from '@/lib/disaster/types'
import type { StaffContact, ChecklistRole } from '@/lib/types/db'

interface RouteContext {
  params: Promise<{ requestId: string }>
}

/**
 * 대응계획을 역할별 담당자에게 발송 (POST).
 * 수신동의(consent_sms/consent_kakao) + is_active 인 담당자만 대상.
 * 발송 본문에는 유아 개인정보를 포함하지 않는다(역할명 + 공유 링크만).
 */
export async function POST(_req: NextRequest, { params }: RouteContext) {
  const { requestId } = await params

  if (USE_SAMPLE_FALLBACK) {
    // 시연: 5역할 발송 시뮬레이션
    return NextResponse.json({ data: { sent: 5, skipped: 0, source: 'sample' }, source: 'sample' })
  }

  const iid = await getSessionInstitutionId()
  if (!iid) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  try {
    const { createAdminSupabaseClient } = await import('@/lib/supabase/server')
    const supabase = createAdminSupabaseClient()

    // 소유 검증 + share_token 확보
    const { data: ar, error } = await supabase
      .from('action_requests')
      .select('id, institution_id, share_token')
      .eq('id', requestId)
      .single()
    if (error || !ar) return NextResponse.json({ error: '대응계획을 찾을 수 없습니다.' }, { status: 404 })
    if (ar.institution_id !== iid) return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 })

    let token = ar.share_token as string | null
    if (!token) {
      token = randomBytes(18).toString('base64url')
      await supabase.from('action_requests').update({ share_token: token }).eq('id', requestId)
    }

    // 역할별 담당자 연락처 조회 (service_role 전용)
    const { data: contacts } = await supabase
      .from('institution_staff_contacts')
      .select('*')
      .eq('institution_id', iid)
      .eq('is_active', true)

    const base = APP_BASE_URL || ''
    const targets: NotifyTarget[] = (contacts ?? []).map((c: StaffContact) => {
      const roleKey = DB_ROLE_TO_ROLEKEY[c.role as ChecklistRole] ?? c.role
      const link = `${base}/share/${token}/${roleKey}`
      const label = ROLE_LABELS[DB_ROLE_TO_ROLEKEY[c.role as ChecklistRole]] ?? '담당자'
      return {
        phone: c.phone ?? '',
        name: c.name,
        message: `[재난안전MVP] ${label} 대응계획이 도착했습니다. 확인: ${link}`,
        consent_sms: c.consent_sms,
        consent_kakao: c.consent_kakao,
      }
    })

    const result = await sendNotifications(targets)

    // 발송 로그 (실패 무시)
    try {
      await supabase.from('notify_logs').insert({
        action_request_id: requestId,
        institution_id: iid,
        channel: result.source,
        recipient_count: result.sent,
        source: result.source === 'sample' ? 'sample' : 'api',
      })
    } catch { /* noop */ }

    return NextResponse.json({ data: result, source: result.source === 'sample' ? 'sample' : 'api' })
  } catch (err) {
    console.error('[POST /api/plan/[id]/notify]', err)
    return NextResponse.json({ error: '발송 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
