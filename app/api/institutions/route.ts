import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminSupabaseClient } from '@/lib/supabase/server'
import { USE_SAMPLE_FALLBACK } from '@/lib/env'
import { SAMPLE_INSTITUTIONS } from '@/lib/sample'

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

  if (USE_SAMPLE_FALLBACK) {
    // 샘플 모드: 실제 저장 없이 첫 번째 샘플 기관 ID 반환(데모 흐름 유지)
    return NextResponse.json({
      data: { ...SAMPLE_INSTITUTIONS[0], ...parsed.data },
      source: 'sample',
    })
  }

  try {
    const supabase = createAdminSupabaseClient()
    const { data, error } = await supabase
      .from('institutions')
      .insert(parsed.data)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ data, source: 'db' }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/institutions]', err)
    return NextResponse.json({ error: '기관 등록 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
