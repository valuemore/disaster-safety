// AI 입력 빌더 — 화이트리스트 필드만 직렬화, PII 0건 (docs/04 §1)
// T9-2a: disaster_type에 따라 직렬화 프로필을 분기
// P10 T10-1: infection 분기 추가 + disaster_message 옵션화 대비
import type { Institution, HeatwaveProfile, InstitutionRiskProfile } from '@/lib/types/db'
import type { DisasterType } from '@/lib/disaster/types'
import type { WizardDraft } from '@/lib/types/wizard'
import type { WeatherContext } from '@/lib/external/weather'
import {
  riskProfileToHeavyRain,
  riskProfileToInfection,
  type HeavyRainProfile,
  type InfectionProfile,
} from '@/lib/disaster/profileMapping'

export type { WeatherContext }

// ── 화이트리스트: 폭염 프로필 필드 ─────────────────────────────────────────
interface HeatwaveProfileWhitelist {
  heat_vulnerable_count: number
  respiratory_caution_count: number
  mobility_support_count: number
  special_support_count: number
  cooling_ok: boolean
  indoor_alt_space: boolean
  water_supply_ok: boolean
  thermometer: boolean
  first_aid_kit: boolean
  vehicle_thermometer: boolean
  pickup_wait_place: string | null
}

// ── 화이트리스트: 집중호우 프로필 필드 ──────────────────────────────────────
// PII 0건: boolean/select/집계값만. 구조 정보·시설 정보 위주.
interface HeavyRainProfileWhitelist {
  thermometer: boolean
  first_aid_kit: boolean
  indoor_alt_space: boolean
  low_ground: boolean
  near_stream_or_slope: boolean
  has_basement: boolean
  entrance_type: string | null
  pickup_wait_area: string | null
  outdoor_playground_location: string | null
  has_shuttle: boolean
  has_alt_indoor_space: boolean
  has_emergency_contact_plan: boolean
  has_evacuation_space: boolean
  mobility_support_count: number
}

// ── 화이트리스트: 감염병 프로필 필드 (P10 T10-1 신규) ───────────────────────
// PII 0건: 집계·boolean·방식 enum만. 이름·진단명·연락처 절대 없음.
interface InfectionProfileWhitelist {
  thermometer: boolean           // 체온계 보유 (공통 컬럼)
  first_aid_kit: boolean
  indoor_alt_space: boolean      // 분리대기 공간 (공통 컬럼)
  class_child_count: number | null  // 반별 유아 수 집계
  has_infant_class: boolean
  special_support_count: number  // 특별지원 유아 수 집계
  has_health_room: boolean
  has_hand_sanitizer: boolean
  has_mask: boolean
  has_disinfectant: boolean
  guardian_contact_method: string | null  // 방식 enum만 ('app'|'sms'|'call'|'board')
  has_infection_manual: boolean
  has_attendance_stop_template: boolean
}

export interface AiInput {
  // disaster_type은 DisasterType union ('heatwave' | 'heavy_rain' | 'infection')
  disaster_type: DisasterType
  /**
   * 재난문자 정보.
   * 감염병 2-모드(상황 입력 모드)에서는 재난문자 없이 상황만으로 생성 가능.
   * raw_text가 빈 문자열('')이거나 null인 경우 AI는 selected_situations와
   * 기관 정보만으로 대응 체크리스트를 생성한다.
   */
  disaster_message: {
    raw_text: string | null   // null 또는 빈 문자열 허용 (감염병 상황 입력 모드)
    source: string
    issued_at: string | null
  }
  institution: {
    type: string
    sido: string | null
    sigungu: string | null
    total_children: number | null
    infant_count: number | null
    toddler_count: number | null
    staff_count: number | null
    has_shuttle: boolean
    has_outdoor_playground: boolean
    cooling_space_count: number
    water_available: boolean
    /** 당일 실제 재원·등원 유아 수 (집계값, 선택). null이면 미입력. */
    today_present_children: number | null
    /** 당일 실제 출근 교직원 수 (집계값, 선택). null이면 미입력. */
    today_present_staff: number | null
  }
  // 유형별 optional 프로필 — 해당 유형일 때만 존재, 나머지는 undefined
  heatwave_profile?: HeatwaveProfileWhitelist
  heavy_rain_profile?: HeavyRainProfileWhitelist
  /** 감염병 프로필 (P10 T10-1). PII 0건: 집계·boolean·방식 enum만. */
  infection_profile?: InfectionProfileWhitelist
  selected_situations: string[]
  situation_etc: string | null
  weather_context: WeatherContext
}

/**
 * AiInput 빌더.
 *
 * profile 인자는 두 가지 형태를 받는다:
 *   1. HeatwaveProfile (기존 폭염 경로 — 하위 호환)
 *   2. InstitutionRiskProfile (신규 범용 — disaster_type 기반 변환)
 *
 * disaster_type에 따라 적절한 화이트리스트 필드만 직렬화한다.
 * PII 컬럼은 DB 스키마 자체에 없으므로 입력 자체가 안전.
 */
export function buildAiInput(
  draft: WizardDraft,
  institution: Institution,
  profile: HeatwaveProfile | InstitutionRiskProfile,
  weatherContext: WeatherContext
): AiInput {
  // disaster_type은 자동 분류로 채워지나, 미분류('other'→null) 시 폭염 기본값으로 안전 처리
  const disasterType = draft.disaster_type ?? 'heatwave'

  const base: AiInput = {
    disaster_type: disasterType,
    disaster_message: {
      // raw_text가 빈 문자열('')인 경우 null로 정규화.
      // 감염병 상황 입력 모드(재난문자 없음)를 안전하게 처리한다.
      raw_text: draft.disaster_message_text || null,
      source: draft.disaster_message_source,
      issued_at: draft.disaster_message_issued_at,
    },
    institution: {
      type: institution.type,
      sido: institution.sido,
      sigungu: institution.sigungu,
      total_children: institution.total_children,
      infant_count: institution.infant_count,
      toddler_count: institution.toddler_count,
      staff_count: institution.staff_count,
      has_shuttle: institution.has_shuttle,
      has_outdoor_playground: institution.has_outdoor_playground,
      cooling_space_count: institution.cooling_space_count,
      water_available: institution.water_available,
      today_present_children: draft.today_children_count ?? null,
      today_present_staff: draft.today_staff_count ?? null,
    },
    selected_situations: draft.selected_situations,
    situation_etc: draft.situation_etc || null,
    weather_context: weatherContext,
  }

  if (disasterType === 'heavy_rain') {
    // InstitutionRiskProfile인 경우 HeavyRainProfile로 변환, 이미 변환된 경우 그대로 사용
    const hrProfile: HeavyRainProfile = isInstitutionRiskProfile(profile)
      ? riskProfileToHeavyRain(profile)
      : buildDefaultHeavyRainProfile(profile)

    base.heavy_rain_profile = {
      thermometer:                hrProfile.thermometer,
      first_aid_kit:              hrProfile.first_aid_kit,
      indoor_alt_space:           hrProfile.indoor_alt_space,
      low_ground:                 hrProfile.low_ground,
      near_stream_or_slope:       hrProfile.near_stream_or_slope,
      has_basement:               hrProfile.has_basement,
      entrance_type:              hrProfile.entrance_type,
      pickup_wait_area:           hrProfile.pickup_wait_area,
      outdoor_playground_location: hrProfile.outdoor_playground_location,
      has_shuttle:                hrProfile.has_shuttle,
      has_alt_indoor_space:       hrProfile.has_alt_indoor_space,
      has_emergency_contact_plan: hrProfile.has_emergency_contact_plan,
      has_evacuation_space:       hrProfile.has_evacuation_space,
      mobility_support_count:     hrProfile.mobility_support_count,
    }
  } else if (disasterType === 'infection') {
    // P10 T10-1: 감염병 프로필 직렬화 (화이트리스트, PII 0건)
    // InstitutionRiskProfile이면 InfectionProfile로 변환, 아니면 기본값 사용
    const infProfile: InfectionProfile = isInstitutionRiskProfile(profile)
      ? riskProfileToInfection(profile)
      : buildDefaultInfectionProfile()

    base.infection_profile = {
      thermometer:                    infProfile.thermometer,
      first_aid_kit:                  infProfile.first_aid_kit,
      indoor_alt_space:               infProfile.indoor_alt_space,
      class_child_count:              infProfile.class_child_count,
      has_infant_class:               infProfile.has_infant_class,
      special_support_count:          infProfile.special_support_count,
      has_health_room:                infProfile.has_health_room,
      has_hand_sanitizer:             infProfile.has_hand_sanitizer,
      has_mask:                       infProfile.has_mask,
      has_disinfectant:               infProfile.has_disinfectant,
      guardian_contact_method:        infProfile.guardian_contact_method,
      has_infection_manual:           infProfile.has_infection_manual,
      has_attendance_stop_template:   infProfile.has_attendance_stop_template,
    }
  } else {
    // heatwave (기본) — 폭염 프로필 직렬화
    // InstitutionRiskProfile인 경우 HeatwaveProfile로의 변환은 generate route에서 담당
    const hw = profile as HeatwaveProfile
    base.heatwave_profile = {
      heat_vulnerable_count:      hw.heat_vulnerable_count      ?? 0,
      respiratory_caution_count:  hw.respiratory_caution_count  ?? 0,
      mobility_support_count:     hw.mobility_support_count     ?? 0,
      special_support_count:      hw.special_support_count      ?? 0,
      cooling_ok:                 hw.cooling_ok                 ?? true,
      indoor_alt_space:           hw.indoor_alt_space           ?? false,
      water_supply_ok:            hw.water_supply_ok            ?? false,
      thermometer:                hw.thermometer                ?? false,
      first_aid_kit:              hw.first_aid_kit              ?? false,
      vehicle_thermometer:        hw.vehicle_thermometer        ?? false,
      pickup_wait_place:          hw.pickup_wait_place          ?? null,
    }
  }

  return base
}

// ── 타입 가드 ─────────────────────────────────────────────────────────────

function isInstitutionRiskProfile(p: HeatwaveProfile | InstitutionRiskProfile): p is InstitutionRiskProfile {
  return 'disaster_type' in p && 'disaster_specific' in p
}

/** 폭염 HeatwaveProfile 구조를 기본값 집중호우 프로필로 변환 (비상 fallback) */
function buildDefaultHeavyRainProfile(_: HeatwaveProfile): HeavyRainProfile {
  return {
    id: '',
    institution_id: '',
    thermometer: false,
    first_aid_kit: false,
    indoor_alt_space: false,
    low_ground: false,
    near_stream_or_slope: false,
    has_basement: false,
    entrance_type: null,
    pickup_wait_area: null,
    outdoor_playground_location: null,
    has_shuttle: false,
    has_alt_indoor_space: false,
    has_emergency_contact_plan: false,
    has_evacuation_space: false,
    mobility_support_count: 0,
    is_current: true,
    created_at: new Date().toISOString(),
  }
}

/** 감염병 프로필 기본값 (프로필 미등록 시 비상 fallback) */
function buildDefaultInfectionProfile(): InfectionProfile {
  return {
    id: '',
    institution_id: '',
    thermometer: false,
    first_aid_kit: false,
    indoor_alt_space: false,
    class_child_count: null,
    has_infant_class: false,
    special_support_count: 0,
    has_health_room: false,
    has_hand_sanitizer: false,
    has_mask: false,
    has_disinfectant: false,
    guardian_contact_method: null,
    has_infection_manual: false,
    has_attendance_stop_template: false,
    is_current: true,
    created_at: new Date().toISOString(),
  }
}
