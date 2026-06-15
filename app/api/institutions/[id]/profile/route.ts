import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminSupabaseClient } from '@/lib/supabase/server'
import { USE_SAMPLE_FALLBACK } from '@/lib/env'
import { SAMPLE_HEATWAVE_PROFILES, getSampleProfile } from '@/lib/sample'
import {
  riskProfileToHeatwave,
  heatwaveFormToRiskProfile,
  riskProfileToHeavyRain,
  heavyRainFormToRiskProfile,
  riskProfileToInfection,
  infectionFormToRiskProfile,
} from '@/lib/disaster/profileMapping'
import type { InstitutionRiskProfile } from '@/lib/types/db'
import type { DisasterType } from '@/lib/disaster/types'

// ── zod 스키마: 폭염 ──────────────────────────────────────────────────────

const HeatwaveProfileSchema = z.object({
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

// ── zod 스키마: 집중호우 ──────────────────────────────────────────────────

const HeavyRainProfileSchema = z.object({
  thermometer: z.boolean().default(false),
  first_aid_kit: z.boolean().default(false),
  indoor_alt_space: z.boolean().default(false),
  low_ground: z.boolean().default(false),
  near_stream_or_slope: z.boolean().default(false),
  has_basement: z.boolean().default(false),
  entrance_type: z.enum(['ground_level', 'raised', 'below_grade']).nullable().default(null),
  pickup_wait_area: z.enum(['indoor', 'covered_outdoor', 'open_outdoor']).nullable().default(null),
  outdoor_playground_location: z.enum(['rooftop', 'ground_level', 'none']).nullable().default(null),
  has_shuttle: z.boolean().default(false),
  has_alt_indoor_space: z.boolean().default(false),
  has_emergency_contact_plan: z.boolean().default(false),
  has_evacuation_space: z.boolean().default(false),
  mobility_support_count: z.number().int().min(0).max(9999).default(0),
})

// ── zod 스키마: 감염병 ──────────────────────────────────────────────────────
// PII 필드 없음: 집계·boolean·방식 enum만.

const InfectionProfileSchema = z.object({
  // 공통 컬럼
  thermometer: z.boolean().default(false),
  first_aid_kit: z.boolean().default(false),
  indoor_alt_space: z.boolean().default(false),
  // 감염병 특수 필드
  class_child_count: z.number().int().min(0).max(9999).nullable().default(null),
  has_infant_class: z.boolean().default(false),
  special_support_count: z.number().int().min(0).max(9999).default(0),
  has_health_room: z.boolean().default(false),
  has_hand_sanitizer: z.boolean().default(false),
  has_mask: z.boolean().default(false),
  has_disinfectant: z.boolean().default(false),
  guardian_contact_method: z.enum(['app', 'sms', 'call', 'board']).nullable().default(null),
  has_infection_manual: z.boolean().default(false),
  has_attendance_stop_template: z.boolean().default(false),
})

// ── 기본 샘플 집중호우 프로필 ─────────────────────────────────────────────

const SAMPLE_HEAVY_RAIN_PROFILE = {
  id: '22222222-0000-0000-0001-000000000001',
  institution_id: '11111111-0000-0000-0000-000000000001',
  thermometer: true,
  first_aid_kit: true,
  indoor_alt_space: true,
  low_ground: false,
  near_stream_or_slope: false,
  has_basement: false,
  entrance_type: null as null,
  pickup_wait_area: 'indoor' as const,
  outdoor_playground_location: 'ground_level' as const,
  has_shuttle: true,
  has_alt_indoor_space: true,
  has_emergency_contact_plan: true,
  has_evacuation_space: false,
  mobility_support_count: 0,
  is_current: true,
  created_at: '2026-06-15T09:00:00+09:00',
}

// ── 기본 샘플 감염병 프로필 ──────────────────────────────────────────────────
// PII 0건: 집계·boolean·방식 enum만. USE_SAMPLE_FALLBACK 또는 DB 오류 시 반환.

const SAMPLE_INFECTION_PROFILE = {
  id: '22222222-0000-0000-0002-000000000001',
  institution_id: '11111111-0000-0000-0000-000000000001',
  thermometer: true,
  first_aid_kit: true,
  indoor_alt_space: true,           // 분리대기 공간 있음
  class_child_count: 20 as number | null,
  has_infant_class: false,
  special_support_count: 0,
  has_health_room: false,
  has_hand_sanitizer: true,
  has_mask: true,
  has_disinfectant: true,
  guardian_contact_method: 'app' as const,
  has_infection_manual: true,
  has_attendance_stop_template: true,
  is_current: true,
  created_at: '2026-06-15T09:00:00+09:00',
}

interface Params {
  params: Promise<{ id: string }>
}

// ── GET: 기관 프로필 조회 ─────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const disasterType: DisasterType =
    (searchParams.get('disaster_type') as DisasterType | null) ?? 'heatwave'

  // 집중호우 프로필 조회
  if (disasterType === 'heavy_rain') {
    if (USE_SAMPLE_FALLBACK) {
      return NextResponse.json({ data: SAMPLE_HEAVY_RAIN_PROFILE, source: 'sample' })
    }
    try {
      const supabase = createAdminSupabaseClient()
      const { data, error } = await supabase
        .from('institution_risk_profiles')
        .select('*')
        .eq('institution_id', id)
        .eq('disaster_type', 'heavy_rain')
        .eq('is_current', true)
        .maybeSingle()

      if (error) throw error
      if (!data) return NextResponse.json({ data: null, source: 'db' })

      const profile = riskProfileToHeavyRain(data as InstitutionRiskProfile)
      return NextResponse.json({ data: profile, source: 'db' })
    } catch (err) {
      console.error('[GET /api/institutions/[id]/profile] heavy_rain:', err)
      return NextResponse.json({ data: SAMPLE_HEAVY_RAIN_PROFILE, source: 'sample' })
    }
  }

  // 감염병 프로필 조회
  if (disasterType === 'infection') {
    if (USE_SAMPLE_FALLBACK) {
      return NextResponse.json({ data: SAMPLE_INFECTION_PROFILE, source: 'sample' })
    }
    try {
      const supabase = createAdminSupabaseClient()
      const { data, error } = await supabase
        .from('institution_risk_profiles')
        .select('*')
        .eq('institution_id', id)
        .eq('disaster_type', 'infection')
        .eq('is_current', true)
        .maybeSingle()

      if (error) throw error
      if (!data) return NextResponse.json({ data: null, source: 'db' })

      const profile = riskProfileToInfection(data as InstitutionRiskProfile)
      return NextResponse.json({ data: profile, source: 'db' })
    } catch (err) {
      console.error('[GET /api/institutions/[id]/profile] infection:', err)
      return NextResponse.json({ data: SAMPLE_INFECTION_PROFILE, source: 'sample' })
    }
  }

  // 폭염 프로필 조회 (기본값 — 기존 동작 유지)
  if (USE_SAMPLE_FALLBACK) {
    const profile = getSampleProfile(id) ?? SAMPLE_HEATWAVE_PROFILES[0]
    return NextResponse.json({ data: profile, source: 'sample' })
  }

  try {
    const supabase = createAdminSupabaseClient()
    const { data, error } = await supabase
      .from('institution_risk_profiles')
      .select('*')
      .eq('institution_id', id)
      .eq('disaster_type', 'heatwave')
      .eq('is_current', true)
      .maybeSingle()

    if (error) throw error
    if (!data) return NextResponse.json({ data: null, source: 'db' })

    const profile = riskProfileToHeatwave(data as InstitutionRiskProfile)
    return NextResponse.json({ data: profile, source: 'db' })
  } catch (err) {
    console.error('[GET /api/institutions/[id]/profile]', err)
    const profile = getSampleProfile(id) ?? SAMPLE_HEATWAVE_PROFILES[0]
    return NextResponse.json({ data: profile, source: 'sample' })
  }
}

// ── POST: 기관 프로필 저장 ────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: Params) {
  const { id: institution_id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  // disaster_type 추출 (body에서 읽고 제거 후 스키마 검증)
  const rawBody = body as Record<string, unknown>
  const disasterType: DisasterType =
    (rawBody.disaster_type as DisasterType | undefined) ?? 'heatwave'

  // 집중호우 프로필 저장
  if (disasterType === 'heavy_rain') {
    const parsed = HeavyRainProfileSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: '입력값이 올바르지 않습니다.', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    if (USE_SAMPLE_FALLBACK) {
      return NextResponse.json({
        data: { ...SAMPLE_HEAVY_RAIN_PROFILE, institution_id, ...parsed.data },
        source: 'sample',
      })
    }

    try {
      const supabase = createAdminSupabaseClient()
      const riskRow = heavyRainFormToRiskProfile(parsed.data, institution_id)
      const { data, error } = await supabase
        .from('institution_risk_profiles')
        .insert(riskRow)
        .select()
        .single()

      if (error) throw error

      const profile = riskProfileToHeavyRain(data as InstitutionRiskProfile)
      return NextResponse.json({ data: profile, source: 'db' }, { status: 201 })
    } catch (err) {
      console.error('[POST /api/institutions/[id]/profile] heavy_rain:', err)
      return NextResponse.json({ error: '프로필 저장 중 오류가 발생했습니다.' }, { status: 500 })
    }
  }

  // 감염병 프로필 저장
  if (disasterType === 'infection') {
    const parsed = InfectionProfileSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: '입력값이 올바르지 않습니다.', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    if (USE_SAMPLE_FALLBACK) {
      return NextResponse.json({
        data: { ...SAMPLE_INFECTION_PROFILE, institution_id, ...parsed.data },
        source: 'sample',
      })
    }

    try {
      const supabase = createAdminSupabaseClient()
      const riskRow = infectionFormToRiskProfile(parsed.data, institution_id)
      const { data, error } = await supabase
        .from('institution_risk_profiles')
        .insert(riskRow)
        .select()
        .single()

      if (error) throw error

      const profile = riskProfileToInfection(data as InstitutionRiskProfile)
      return NextResponse.json({ data: profile, source: 'db' }, { status: 201 })
    } catch (err) {
      console.error('[POST /api/institutions/[id]/profile] infection:', err)
      return NextResponse.json({ error: '프로필 저장 중 오류가 발생했습니다.' }, { status: 500 })
    }
  }

  // 폭염 프로필 저장 (기본값 — 기존 동작 유지)
  const parsed = HeatwaveProfileSchema.safeParse(rawBody)
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

    const riskRow = heatwaveFormToRiskProfile(parsed.data, institution_id)
    const { data, error } = await supabase
      .from('institution_risk_profiles')
      .insert(riskRow)
      .select()
      .single()

    if (error) throw error

    const profile = riskProfileToHeatwave(data as InstitutionRiskProfile)
    return NextResponse.json({ data: profile, source: 'db' }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/institutions/[id]/profile]', err)
    return NextResponse.json({ error: '프로필 저장 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
