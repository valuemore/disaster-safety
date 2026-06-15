import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminSupabaseClient } from '@/lib/supabase/server'
import { USE_SAMPLE_FALLBACK } from '@/lib/env'
import { SAMPLE_INSTITUTIONS } from '@/lib/sample'

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
