import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminSupabaseClient } from '@/lib/supabase/server'
import { USE_SAMPLE_FALLBACK } from '@/lib/env'
import { SAMPLE_INSTITUTIONS } from '@/lib/sample'
import { verifyPin } from '@/lib/auth/pin'
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth/session'

const LoginSchema = z.object({
  login_id: z.string().min(1).max(50),
  pin: z.string().min(4).max(8),
})

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  const parsed = LoginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: '기관 등록번호와 PIN을 확인하세요.' }, { status: 400 })
  }
  const { login_id, pin } = parsed.data

  // 샘플 모드: 실제 검증 없이 첫 번째 샘플 기관으로 세션 발급 (시연 무중단)
  if (USE_SAMPLE_FALLBACK) {
    const inst = SAMPLE_INSTITUTIONS[0]
    return issueSession(inst.id, inst.name)
  }

  try {
    const supabase = createAdminSupabaseClient()
    const { data, error } = await supabase
      .from('institutions')
      .select('id, name, pin_hash')
      .eq('login_id', login_id)
      .maybeSingle()

    if (error) throw error
    if (!data || !verifyPin(pin, data.pin_hash)) {
      return NextResponse.json(
        { error: '기관 등록번호 또는 PIN이 일치하지 않습니다.' },
        { status: 401 }
      )
    }
    return issueSession(data.id, data.name)
  } catch (err) {
    console.error('[POST /api/auth/login]', err)
    return NextResponse.json({ error: '로그인 처리 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

function issueSession(iid: string, name: string) {
  const token = createSessionToken(iid, name)
  const res = NextResponse.json({ data: { id: iid, name }, source: 'db' })
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions)
  return res
}
