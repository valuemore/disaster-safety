import { NextRequest, NextResponse } from 'next/server'
import { USE_SAMPLE_FALLBACK } from '@/lib/env'
import { buildAiInput } from '@/lib/ai/buildAiInput'
import { callClaudeWithFallback } from '@/lib/ai/callClaude'
import { SAFETY_DISCLAIMER_FIXED } from '@/lib/ai/aiPlanSchema'
import { fetchWeatherContext, SAMPLE_WEATHER } from '@/lib/external/weather'
import {
  SAMPLE_ACTION_REQUEST,
  SAMPLE_HEAVY_RAIN_ACTION_REQUEST,
  SAMPLE_INFECTION_ACTION_REQUEST,
  SAMPLE_INSTITUTIONS,
  SAMPLE_HEATWAVE_PROFILES,
  SAMPLE_HEAVY_RAIN_PROFILES,
  SAMPLE_INFECTION_PROFILES,
} from '@/lib/sample'
import { ROLEKEY_TO_DB_ROLE } from '@/lib/disaster/types'
import { riskProfileToHeatwave } from '@/lib/disaster/profileMapping'
import type { WizardDraft } from '@/lib/types/wizard'
import type { Institution, HeatwaveProfile, InstitutionRiskProfile } from '@/lib/types/db'
import type { DisasterType } from '@/lib/disaster/types'

export async function POST(req: NextRequest) {
  let body: WizardDraft
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  // 감염병(infection)은 재난문자 없이 상황만으로 생성 허용 (계획 §6, §5-2).
  // 폭염·집중호우는 재난문자 + 상황 모두 필수.
  const requestDisasterType: DisasterType = body.disaster_type ?? 'heatwave'
  const isInfection = requestDisasterType === 'infection'

  if (!body.selected_situations?.length) {
    return NextResponse.json(
      { error: '현재 상황을 선택해 주세요.' },
      { status: 400 }
    )
  }
  if (!isInfection && !body.disaster_message_text?.trim()) {
    return NextResponse.json(
      { error: '재난문자와 현재 상황을 입력해 주세요.' },
      { status: 400 }
    )
  }

  // ── 샘플 fallback 모드 ──────────────────────────────────────────────────
  if (USE_SAMPLE_FALLBACK) {
    const disasterType: DisasterType = body.disaster_type ?? 'heatwave'

    // TODO(T10-3): SAMPLE_INFECTION_ACTION_REQUEST를 완전한 감염병 시나리오로 교체 예정
    const baseSample =
      disasterType === 'heavy_rain'
        ? SAMPLE_HEAVY_RAIN_ACTION_REQUEST
        : disasterType === 'infection'
          ? SAMPLE_INFECTION_ACTION_REQUEST
          : SAMPLE_ACTION_REQUEST

    return NextResponse.json({
      data: {
        ...baseSample,
        institution_id: body.institution_id ?? baseSample.institution_id,
        // 감염병은 재난문자 없을 수 있으므로 null-safe 처리
        disaster_message_id: isInfection
          ? (body.disaster_message_id ?? null)
          : baseSample.disaster_message_id,
        selected_situations: body.selected_situations,
        situation_etc: body.situation_etc || null,
        created_by_role: body.role ?? 'director',
      },
      source: 'sample',
    })
  }

  // ── 실 DB + AI 경로 ────────────────────────────────────────────────────
  let institution: Institution
  // profile: HeatwaveProfile 또는 InstitutionRiskProfile — buildAiInput이 disaster_type으로 분기
  let profile: HeatwaveProfile | InstitutionRiskProfile
  /** institution_risk_profiles.id — action_requests.risk_profile_id 에 기록 */
  let riskProfileId: string | null = null

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

    // 현재 유효 프로필 조회 (institution_risk_profiles, disaster_type 기반)
    const disasterType: DisasterType = body.disaster_type ?? 'heatwave'
    const { data: profileData, error: profileErr } = await supabase
      .from('institution_risk_profiles')
      .select('*')
      .eq('institution_id', institution.id)
      .eq('disaster_type', disasterType)
      .eq('is_current', true)
      .maybeSingle()

    if (profileErr || !profileData) {
      // 프로필 없을 때: 유형별 샘플 기본값으로 처리
      if (disasterType === 'heavy_rain') {
        profile = SAMPLE_HEAVY_RAIN_PROFILES[0] as InstitutionRiskProfile
      } else if (disasterType === 'infection') {
        // 감염병: 샘플 프로필 사용 (단일 출처: lib/sample/infection_profiles.ts)
        profile = SAMPLE_INFECTION_PROFILES[0] as InstitutionRiskProfile
      } else {
        // 폭염: 샘플 프로필 fallback
        profile = SAMPLE_HEATWAVE_PROFILES[0] as HeatwaveProfile
      }
      riskProfileId = null
    } else {
      // InstitutionRiskProfile 행을 buildAiInput에 전달 — disaster_type 기반으로 내부 분기
      const riskRow = profileData as InstitutionRiskProfile
      if (disasterType === 'heavy_rain') {
        // 집중호우: InstitutionRiskProfile을 그대로 전달 (buildAiInput이 riskProfileToHeavyRain 호출)
        profile = riskRow
      } else if (disasterType === 'infection') {
        // 감염병: riskProfileToInfection으로 변환 후 buildAiInput에 전달
        // buildAiInput은 isInstitutionRiskProfile 타입가드로 감지해 infection_profile 직렬화
        profile = riskRow
      } else {
        // 폭염: 기존 동작 동일 유지 — HeatwaveProfile 형태로 변환
        profile = riskProfileToHeatwave(riskRow)
      }
      riskProfileId = riskRow.id
    }
  } catch {
    // DB 접근 불가 시 샘플로 계속
    const fallbackType: DisasterType = body.disaster_type ?? 'heatwave'
    institution = SAMPLE_INSTITUTIONS[0] as Institution
    if (fallbackType === 'heavy_rain') {
      profile = SAMPLE_HEAVY_RAIN_PROFILES[0] as InstitutionRiskProfile
    } else if (fallbackType === 'infection') {
      // 감염병: 샘플 프로필 사용 (단일 출처: lib/sample/infection_profiles.ts)
      profile = SAMPLE_INFECTION_PROFILES[0] as InstitutionRiskProfile
    } else {
      profile = SAMPLE_HEATWAVE_PROFILES[0] as HeatwaveProfile
    }
    riskProfileId = null
  }

  // ── 날씨 컨텍스트 조회 (실패 시 샘플) ─────────────────────────────────
  const weatherContext = await fetchWeatherContext(
    institution.latitude,
    institution.longitude,
    body.disaster_type ?? 'heatwave'
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
    // risk_profile_id: institution_risk_profiles FK (0002 신규 컬럼, 주 값)
    // heatwave_profile_id: 레거시 컬럼 — nullable이므로 NULL로 남겨 deprecated 처리
    const { data: arData, error: arErr } = await supabase
      .from('action_requests')
      .insert({
        institution_id: institution.id,
        disaster_message_id:
          body.disaster_message_source === 'sample' ? body.disaster_message_id : null,
        heatwave_profile_id: null,
        risk_profile_id: riskProfileId,
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
    // T8-3: role_based_actions 기반으로 변경. role_based_actions가 없으면 레거시 필드 fallback.
    let checklistRows: { action_request_id: string; role: string; sort_order: number; content: string }[] = []

    if (result.role_based_actions && result.role_based_actions.length > 0) {
      // role_based_actions → DB role 매핑 후 INSERT (5역할 모두: director/teacher/shuttle/cook_or_food_service/health_manager)
      for (const roleAction of result.role_based_actions) {
        const dbRole = ROLEKEY_TO_DB_ROLE[roleAction.role]
        if (!dbRole) {
          // 알 수 없는 role key — 방어적으로 skip
          console.warn(`[generate] unknown role '${roleAction.role}' — skipping`)
          continue
        }
        const rows = roleAction.actions
          .filter((a) => a && a !== '해당 없음') // '해당 없음' 또는 빈 항목은 저장 제외
          .map((content, i) => ({
            action_request_id: arData.id,
            role: dbRole,
            sort_order: i,
            content,
          }))
        checklistRows = checklistRows.concat(rows)
      }
    } else {
      // 레거시 필드 fallback (role_based_actions 미존재 시)
      const dir = result.director_checklist ?? []
      const tea = result.teacher_checklist ?? []
      const shu = result.shuttle_checklist ?? []
      checklistRows = [
        ...dir.map((content, i) => ({ action_request_id: arData.id, role: 'director', sort_order: i, content })),
        ...tea.map((content, i) => ({ action_request_id: arData.id, role: 'teacher', sort_order: i, content })),
        ...shu.map((content, i) => ({ action_request_id: arData.id, role: 'shuttle', sort_order: i, content })),
      ]
    }

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
