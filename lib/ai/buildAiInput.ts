// AI 입력 빌더 — 화이트리스트 필드만 직렬화, PII 0건 (docs/04 §1)
import type { Institution, HeatwaveProfile } from '@/lib/types/db'
import type { WizardDraft } from '@/lib/types/wizard'
import type { WeatherContext } from '@/lib/external/weather'

export type { WeatherContext }

export interface AiInput {
  disaster_type: 'heatwave'
  disaster_message: {
    raw_text: string
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
  }
  heatwave_profile: {
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
  selected_situations: string[]
  situation_etc: string | null
  weather_context: WeatherContext
}

export function buildAiInput(
  draft: WizardDraft,
  institution: Institution,
  profile: HeatwaveProfile,
  weatherContext: WeatherContext
): AiInput {
  // 화이트리스트만 포함 — PII(이름·진단명·약물명·연락처) 컬럼은 DB 스키마 자체에 없음
  return {
    disaster_type: 'heatwave',
    disaster_message: {
      raw_text: draft.disaster_message_text,
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
    },
    heatwave_profile: {
      heat_vulnerable_count: profile.heat_vulnerable_count,
      respiratory_caution_count: profile.respiratory_caution_count,
      mobility_support_count: profile.mobility_support_count,
      special_support_count: profile.special_support_count,
      cooling_ok: profile.cooling_ok,
      indoor_alt_space: profile.indoor_alt_space,
      water_supply_ok: profile.water_supply_ok,
      thermometer: profile.thermometer,
      first_aid_kit: profile.first_aid_kit,
      vehicle_thermometer: profile.vehicle_thermometer,
      pickup_wait_place: profile.pickup_wait_place,
    },
    selected_situations: draft.selected_situations,
    situation_etc: draft.situation_etc || null,
    weather_context: weatherContext,
  }
}
