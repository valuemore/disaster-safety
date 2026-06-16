import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { USE_SAMPLE_FALLBACK } from '@/lib/env'
import { getSessionInstitutionId } from '@/lib/auth/session'
import type { StaffContactRole } from '@/lib/types/db'

const ROLES: StaffContactRole[] = [
  'director',
  'homeroom_teacher',
  'bus_manager',
  'cook_or_food_service',
  'health_manager',
]

const ContactSchema = z.object({
  role: z.enum(ROLES as [StaffContactRole, ...StaffContactRole[]]),
  name: z.string().max(50).nullable().optional(),
  phone: z
    .string()
    .max(20)
    .regex(/^[0-9-]*$/, '숫자와 하이픈만 입력하세요.')
    .nullable()
    .optional(),
  email: z.string().email().max(120).nullable().optional().or(z.literal('')),
  consent_sms: z.boolean().default(false),
  consent_kakao: z.boolean().default(false),
  consent_share_link: z.boolean().default(false),
  is_active: z.boolean().default(true),
})
const PutSchema = z.object({ contacts: z.array(ContactSchema).max(5) })

/** 역할별 담당자 연락처 조회 (세션 기관 본인) */
export async function GET() {
  if (USE_SAMPLE_FALLBACK) {
    return NextResponse.json({ data: [], source: 'sample' })
  }
  const iid = await getSessionInstitutionId()
  if (!iid) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  try {
    const { createAdminSupabaseClient } = await import('@/lib/supabase/server')
    const supabase = createAdminSupabaseClient()
    const { data, error } = await supabase
      .from('institution_staff_contacts')
      .select('*')
      .eq('institution_id', iid)
    if (error) throw error
    return NextResponse.json({ data: data ?? [], source: 'db' })
  } catch (err) {
    console.error('[GET /api/account/contacts]', err)
    return NextResponse.json({ data: [], source: 'sample' })
  }
}

/** 역할별 담당자 연락처 저장 (upsert, 세션 기관 본인) */
export async function PUT(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
  }
  const parsed = PutSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: '입력값이 올바르지 않습니다.', details: parsed.error.flatten() }, { status: 400 })
  }

  if (USE_SAMPLE_FALLBACK) {
    return NextResponse.json({ data: { ok: true }, source: 'sample' })
  }
  const iid = await getSessionInstitutionId()
  if (!iid) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  try {
    const { createAdminSupabaseClient } = await import('@/lib/supabase/server')
    const supabase = createAdminSupabaseClient()
    const rows = parsed.data.contacts.map((c) => ({
      institution_id: iid,
      role: c.role,
      name: c.name || null,
      phone: c.phone || null,
      email: c.email || null,
      consent_sms: c.consent_sms,
      consent_kakao: c.consent_kakao,
      consent_share_link: c.consent_share_link,
      is_active: c.is_active,
      updated_at: new Date().toISOString(),
    }))
    const { error } = await supabase
      .from('institution_staff_contacts')
      .upsert(rows, { onConflict: 'institution_id,role' })
    if (error) throw error
    return NextResponse.json({ data: { ok: true }, source: 'db' })
  } catch (err) {
    console.error('[PUT /api/account/contacts]', err)
    return NextResponse.json({ error: '연락처 저장 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
