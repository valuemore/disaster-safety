/**
 * app/api/institutions/[id]/staff-profile/route.ts
 *
 * 기관 staff_profile PATCH 엔드포인트 (급식·보건 인력 정보 업데이트).
 *
 * 보안 원칙:
 * - service_role(admin) 클라이언트만 사용 — 서버 전용.
 * - PII 없음: StaffProfileSchema는 인력 유무·수·유형만. 이름·연락처 없음.
 * - USE_SAMPLE_FALLBACK 또는 DB 실패 시 graceful 처리.
 *
 * GET: 현재 staff_profile 조회.
 * PATCH: staff_profile 업데이트 (부분 병합 — 기존 키 유지, 신규 키 덮어쓰기).
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminSupabaseClient } from '@/lib/supabase/server'
import { USE_SAMPLE_FALLBACK } from '@/lib/env'
import { getSampleInstitution, SAMPLE_INSTITUTIONS } from '@/lib/sample'

// ── StaffProfile zod 스키마 ──────────────────────────────────────────────────
// 계획 §3c 키 전체. PII 없음: 인력 유무·수·유형만.
const StaffProfileSchema = z.object({
  meal_count_per_serving:         z.number().int().min(0).max(9999).optional(),
  has_food_service_staff:         z.boolean().optional(),
  food_service_staff_count:       z.number().int().min(0).max(999).optional(),
  has_cook_license_staff:         z.boolean().optional(),
  has_collective_food_service:    z.boolean().optional(),
  has_health_staff:               z.boolean().optional(),
  health_staff_type:              z.enum(['nurse', 'nursing_assistant', 'health_teacher', 'designated', 'none']).nullable().optional(),
  health_staff_count:             z.number().int().min(0).max(999).optional(),
  has_nurse_or_nursing_assistant: z.boolean().optional(),
  has_health_teacher:             z.boolean().optional(),
  has_designated_health_manager:  z.boolean().optional(),
  kindergarten_class_count:       z.number().int().min(0).max(9999).optional(),
})

interface Params {
  params: Promise<{ id: string }>
}

// ── GET: 현재 staff_profile 조회 ─────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params

  if (USE_SAMPLE_FALLBACK) {
    const institution = getSampleInstitution(id) ?? SAMPLE_INSTITUTIONS[0]
    return NextResponse.json({
      data: { staff_profile: institution.staff_profile ?? {} },
      source: 'sample',
    })
  }

  try {
    const supabase = createAdminSupabaseClient()
    const { data, error } = await supabase
      .from('institutions')
      .select('id, staff_profile')
      .eq('id', id)
      .single()

    if (error) throw error
    return NextResponse.json({
      data: { staff_profile: data.staff_profile ?? {} },
      source: 'db',
    })
  } catch (err) {
    console.error('[GET /api/institutions/[id]/staff-profile]', err)
    const institution = getSampleInstitution(id) ?? SAMPLE_INSTITUTIONS[0]
    return NextResponse.json({
      data: { staff_profile: institution.staff_profile ?? {} },
      source: 'sample',
    })
  }
}

// ── PATCH: staff_profile 업데이트 ────────────────────────────────────────────
// 부분 병합: 기존 JSONB에 새 키를 병합 (||연산자 — PostgreSQL jsonb 병합).

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  const parsed = StaffProfileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: '입력값이 올바르지 않습니다.', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  // 빈 객체 요청이면 변경 없이 현재 값 반환
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ data: { staff_profile: {} }, source: 'noop' })
  }

  if (USE_SAMPLE_FALLBACK) {
    // 샘플 모드: 실제 저장 없이 병합된 결과 반환 (데모 흐름 유지)
    const institution = getSampleInstitution(id) ?? SAMPLE_INSTITUTIONS[0]
    const merged = { ...(institution.staff_profile ?? {}), ...parsed.data }
    return NextResponse.json({ data: { staff_profile: merged }, source: 'sample' })
  }

  try {
    const supabase = createAdminSupabaseClient()

    // PostgreSQL jsonb 병합 연산자 ||를 사용하여 기존 키 보존 + 신규 키 덮어쓰기.
    // Supabase는 rpc 또는 raw SQL 없이 jsonb 병합을 지원하지 않으므로
    // 먼저 현재 값을 읽어 JS에서 병합 후 업데이트.
    const { data: current, error: fetchErr } = await supabase
      .from('institutions')
      .select('staff_profile')
      .eq('id', id)
      .single()

    if (fetchErr) throw fetchErr

    const merged = {
      ...(typeof current.staff_profile === 'object' && current.staff_profile !== null
        ? (current.staff_profile as Record<string, unknown>)
        : {}),
      ...parsed.data,
    }

    const { data: updated, error: updateErr } = await supabase
      .from('institutions')
      .update({ staff_profile: merged })
      .eq('id', id)
      .select('id, staff_profile')
      .single()

    if (updateErr) throw updateErr
    return NextResponse.json({ data: { staff_profile: updated.staff_profile }, source: 'db' })
  } catch (err) {
    console.error('[PATCH /api/institutions/[id]/staff-profile]', err)
    // DB 실패 시 graceful fallback: 200 + sample source 반환
    const institution = getSampleInstitution(id) ?? SAMPLE_INSTITUTIONS[0]
    const merged = { ...(institution.staff_profile ?? {}), ...parsed.data }
    return NextResponse.json({
      data: { staff_profile: merged },
      source: 'sample',
      warning: '저장 중 오류가 발생하여 임시 응답을 반환합니다.',
    })
  }
}
