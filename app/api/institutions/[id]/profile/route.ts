import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminSupabaseClient } from '@/lib/supabase/server'
import { USE_SAMPLE_FALLBACK } from '@/lib/env'
import { SAMPLE_HEATWAVE_PROFILES, getSampleProfile } from '@/lib/sample'

const ProfileSchema = z.object({
  heat_vulnerable_count: z.number().int().min(0).max(9999).default(0),
  respiratory_caution_count: z.number().int().min(0).max(9999).default(0),
  mobility_support_count: z.number().int().min(0).max(9999).default(0),
  special_support_count: z.number().int().min(0).max(9999).default(0),
  cooling_ok: z.boolean().default(true),
  indoor_alt_space: z.boolean().default(false),
  water_supply_ok: z.boolean().default(false),
  thermometer: z.boolean().default(false),
  first_aid_kit: z.boolean().default(false),
  vehicle_thermometer: z.boolean().default(false),
  pickup_wait_place: z.enum(['indoor', 'shade', 'outdoor', 'etc']).nullable().default(null),
})

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params

  if (USE_SAMPLE_FALLBACK) {
    const profile = getSampleProfile(id) ?? SAMPLE_HEATWAVE_PROFILES[0]
    return NextResponse.json({ data: profile, source: 'sample' })
  }

  try {
    const supabase = createAdminSupabaseClient()
    const { data, error } = await supabase
      .from('heatwave_profiles')
      .select('*')
      .eq('institution_id', id)
      .eq('is_current', true)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return NextResponse.json({ data: data ?? null, source: 'db' })
  } catch (err) {
    console.error('[GET /api/institutions/[id]/profile]', err)
    const profile = getSampleProfile(id) ?? SAMPLE_HEATWAVE_PROFILES[0]
    return NextResponse.json({ data: profile, source: 'sample' })
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id: institution_id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  const parsed = ProfileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: '입력값이 올바르지 않습니다.', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  if (USE_SAMPLE_FALLBACK) {
    const profile = getSampleProfile(institution_id) ?? {
      ...SAMPLE_HEATWAVE_PROFILES[0],
      institution_id,
      ...parsed.data,
    }
    return NextResponse.json({ data: profile, source: 'sample' })
  }

  try {
    const supabase = createAdminSupabaseClient()
    const { data, error } = await supabase
      .from('heatwave_profiles')
      .insert({ ...parsed.data, institution_id })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ data, source: 'db' }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/institutions/[id]/profile]', err)
    return NextResponse.json({ error: '프로필 저장 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
