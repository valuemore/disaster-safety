import { NextRequest, NextResponse } from 'next/server'
import { USE_SAMPLE_FALLBACK } from '@/lib/env'
import { buildAiInput } from '@/lib/ai/buildAiInput'
import { callClaudeWithFallback } from '@/lib/ai/callClaude'
import { SAFETY_DISCLAIMER_FIXED } from '@/lib/ai/aiPlanSchema'
import { fetchWeatherContext, SAMPLE_WEATHER } from '@/lib/external/weather'
import {
  SAMPLE_ACTION_REQUEST,
  SAMPLE_INSTITUTIONS,
  SAMPLE_HEATWAVE_PROFILES,
} from '@/lib/sample'
import type { WizardDraft } from '@/lib/types/wizard'
import type { Institution, HeatwaveProfile } from '@/lib/types/db'

export async function POST(req: NextRequest) {
  let body: WizardDraft
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  if (!body.disaster_message_text?.trim() || !body.selected_situations?.length) {
    return NextResponse.json(
      { error: '재난문자와 현재 상황을 입력해 주세요.' },
      { status: 400 }
    )
  }

  // ── 샘플 fallback 모드 ──────────────────────────────────────────────────
  if (USE_SAMPLE_FALLBACK) {
    return NextResponse.json({
      data: {
        ...SAMPLE_ACTION_REQUEST,
        institution_id: body.institution_id ?? SAMPLE_ACTION_REQUEST.institution_id,
        selected_situations: body.selected_situations,
        situation_etc: body.situation_etc || null,
        created_by_role: body.role ?? 'director',
      },
      source: 'sample',
    })
  }

  // ── 실 DB + AI 경로 ────────────────────────────────────────────────────
  let institution: Institution
  let profile: HeatwaveProfile

  try {
    const { createAdminSupabaseClient } = await import('@/lib/supabase/server')
    const supabase = createAdminSupabaseClient()

    // 기관 조회
    const instId = body.institution_id
    if (instId) {
      const { data, error } = await supabase
        .from('institutions')
        .select('*')
        .eq('id', instId)
        .single()
      institution = error ? (SAMPLE_INSTITUTIONS[0] as Institution) : (data as Institution)
    } else {
      institution = SAMPLE_INSTITUTIONS[0] as Institution
    }

    // 현재 유효 폭염 프로필 조회
    const { data: profileData, error: profileErr } = await supabase
      .from('heatwave_profiles')
      .select('*')
      .eq('institution_id', institution.id)
      .eq('is_current', true)
      .maybeSingle()
    profile =
      profileErr || !profileData
        ? (SAMPLE_HEATWAVE_PROFILES[0] as HeatwaveProfile)
        : (profileData as HeatwaveProfile)
  } catch {
    // DB 접근 불가 시 샘플로 계속
    institution = SAMPLE_INSTITUTIONS[0] as Institution
    profile = SAMPLE_HEATWAVE_PROFILES[0] as HeatwaveProfile
  }

  // ── 날씨 컨텍스트 조회 (실패 시 샘플) ─────────────────────────────────
  const weatherContext = await fetchWeatherContext(
    institution.latitude,
    institution.longitude
  ).catch(() => ({ ...SAMPLE_WEATHER }))

  // ── AI 호출 ────────────────────────────────────────────────────────────
  const aiInput = buildAiInput(body, institution, profile, weatherContext)
  const { result, is_fallback, model } = await callClaudeWithFallback(aiInput)

  // safety_disclaimer 고정 주입 (모든 경로)
  result.safety_disclaimer = SAFETY_DISCLAIMER_FIXED

  // ── DB 저장 ────────────────────────────────────────────────────────────
  try {
    const { createAdminSupabaseClient } = await import('@/lib/supabase/server')
    const supabase = createAdminSupabaseClient()

    // action_request INSERT
    const { data: arData, error: arErr } = await supabase
      .from('action_requests')
      .insert({
        institution_id: institution.id,
        disaster_message_id:
          body.disaster_message_source === 'sample' ? body.disaster_message_id : null,
        heatwave_profile_id: profile.id,
        selected_situations: body.selected_situations,
        situation_etc: body.situation_etc || null,
        priority: result.priority,
        result_json: result,
        is_fallback,
        model,
        created_by_role: body.role ?? null,
      })
      .select()
      .single()

    if (arErr) throw arErr

    // checklist_items INSERT (역할별 펼침)
    const checklistRows = [
      ...result.director_checklist.map((content, i) => ({
        action_request_id: arData.id,
        role: 'director',
        sort_order: i,
        content,
      })),
      ...result.teacher_checklist.map((content, i) => ({
        action_request_id: arData.id,
        role: 'teacher',
        sort_order: i,
        content,
      })),
      ...result.shuttle_checklist.map((content, i) => ({
        action_request_id: arData.id,
        role: 'shuttle',
        sort_order: i,
        content,
      })),
    ]

    await supabase.from('checklist_items').insert(checklistRows)

    return NextResponse.json({ data: arData, source: 'db' }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/plan/generate] DB 저장 실패, 샘플 ID 반환:', err)
    // DB 저장 실패 시에도 데모 흐름 유지 — 샘플 ID로 결과 화면 진행
    return NextResponse.json({
      data: {
        ...SAMPLE_ACTION_REQUEST,
        institution_id: institution.id,
        selected_situations: body.selected_situations,
        situation_etc: body.situation_etc || null,
        priority: result.priority,
        result_json: result,
        is_fallback: true,
        model: 'sample-fallback',
        created_by_role: body.role ?? null,
      },
      source: 'sample',
    })
  }
}
