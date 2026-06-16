import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminSupabaseClient } from '@/lib/supabase/server'
import { USE_SAMPLE_FALLBACK } from '@/lib/env'
import { SAMPLE_INSTITUTIONS } from '@/lib/sample'
import { hashPin } from '@/lib/auth/pin'
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth/session'

// ── StaffProfile zod 스키마 ──────────────────────────────────────────────────
// PII 없음: 인력 유무·수·유형만. 이름·연락처·진단명 없음.
const StaffProfileSchema = z.object({
  meal_count_per_serving:       z.number().int().min(0).max(9999).optional(),
  has_food_service_staff:       z.boolean().optional(),
  food_service_staff_count:     z.number().int().min(0).max(999).optional(),
  has_cook_license_staff:       z.boolean().optional(),
  has_collective_food_service:  z.boolean().optional(),
  has_health_staff:             z.boolean().optional(),
  health_staff_type:            z.enum(['nurse', 'nursing_assistant', 'health_teacher', 'designated', 'none']).nullable().optional(),
  health_staff_count:           z.number().int().min(0).max(999).optional(),
  has_nurse_or_nursing_assistant: z.boolean().optional(),
  has_health_teacher:           z.boolean().optional(),
  has_designated_health_manager: z.boolean().optional(),
  kindergarten_class_count:     z.number().int().min(0).max(9999).optional(),
}).optional()

const InstitutionSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['daycare', 'kindergarten']),
  address: z.string().max(200).optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  sido: z.string().max(50).optional().nullable(),
  sigungu: z.string().max(50).optional().nullable(),
  dong: z.string().max(50).optional().nullable(),
  total_children: z.number().int().min(0).max(9999).optional().nullable(),
  infant_count: z.number().int().min(0).max(9999).optional().nullable(),
  toddler_count: z.number().int().min(0).max(9999).optional().nullable(),
  staff_count: z.number().int().min(0).max(9999).optional().nullable(),
  has_shuttle: z.boolean().default(false),
  has_outdoor_playground: z.boolean().default(false),
  cooling_space_count: z.number().int().min(0).max(999).default(0),
  water_available: z.boolean().default(false),
  /** 급식·보건 인력 프로필 (0002 추가 컬럼). 미입력 시 기본값 '{}' 유지. */
  staff_profile: StaffProfileSchema,
  // ── 간편 로그인 + 포털 API 보강 (0004) ──
  login_id: z.string().min(1).max(50).optional(),
  pin: z.string().min(4).max(8).optional(),
  external_code: z.string().max(60).optional().nullable(),
  api_raw: z.record(z.string(), z.unknown()).optional().nullable(),
  child_count_source: z.enum(['api', 'user_corrected']).optional().nullable(),
})

export async function GET() {
  if (USE_SAMPLE_FALLBACK) {
    return NextResponse.json({ data: SAMPLE_INSTITUTIONS, source: 'sample' })
  }

  try {
    const supabase = createAdminSupabaseClient()
    const { data, error } = await supabase
      .from('institutions')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ data, source: 'db' })
  } catch (err) {
    console.error('[GET /api/institutions]', err)
    return NextResponse.json({ data: SAMPLE_INSTITUTIONS, source: 'sample' })
  }
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  const parsed = InstitutionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: '입력값이 올바르지 않습니다.', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  // pin → pin_hash 변환 (평문 PIN은 저장하지 않음)
  const { pin, ...rest } = parsed.data
  const insertData: Record<string, unknown> = { ...rest }
  if (pin) {
    insertData.pin_hash = hashPin(pin)
    insertData.pin_set_at = new Date().toISOString()
  }

  if (USE_SAMPLE_FALLBACK) {
    // 샘플 모드: 실제 저장 없이 첫 번째 샘플 기관으로 세션 발급(데모 흐름 유지)
    const inst = { ...SAMPLE_INSTITUTIONS[0], ...rest }
    const res = NextResponse.json({ data: inst, source: 'sample' })
    res.cookies.set(SESSION_COOKIE, createSessionToken(inst.id, inst.name), sessionCookieOptions)
    return res
  }

  try {
    const supabase = createAdminSupabaseClient()
    const { data, error } = await supabase
      .from('institutions')
      .insert(insertData)
      .select()
      .single()

    if (error) throw error
    // 등록 직후 자동 로그인 (세션 쿠키 발급)
    const res = NextResponse.json({ data, source: 'db' }, { status: 201 })
    res.cookies.set(SESSION_COOKIE, createSessionToken(data.id, data.name), sessionCookieOptions)
    return res
  } catch (err) {
    console.error('[POST /api/institutions]', err)
    return NextResponse.json({ error: '기관 등록 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
