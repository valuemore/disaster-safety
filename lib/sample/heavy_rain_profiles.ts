import type { InstitutionRiskProfile } from '@/lib/types/db'

/**
 * 집중호우 기관 위험 프로필 샘플 2건
 * - 케이스 1 (햇살어린이집): 저지대·지하공간 보유 — 위험 데모 포인트
 * - 케이스 2 (무지개유치원): 비저지대·하천인접 없음 — 비교 케이스
 * PII 0건: 집계값(숫자)·boolean·enum만 포함
 */
export const SAMPLE_HEAVY_RAIN_PROFILES: InstitutionRiskProfile[] = [
  {
    // 햇살어린이집 — 저지대·지하공간 있음 (위험 케이스)
    id: '55555555-0000-0000-0001-000000000001',
    institution_id: '11111111-0000-0000-0000-000000000001',
    disaster_type: 'heavy_rain',
    thermometer: true,
    first_aid_kit: true,
    indoor_alt_space: true,
    disaster_specific: {
      low_ground: true,               // 저지대 위치 — 침수 위험 주요 지표
      near_stream_or_slope: false,
      has_basement: true,             // 지하공간 보유 — 데모 포인트
      entrance_type: 'ground_level',  // 1층 출입구가 지면과 동일
      pickup_wait_area: 'indoor',
      outdoor_playground_location: 'ground_level',
      has_shuttle: true,
      has_alt_indoor_space: true,
      has_emergency_contact_plan: true,
      has_evacuation_space: false,    // 대피공간 미확보 — 개선 포인트
      mobility_support_count: 1,
    },
    is_current: true,
    created_at: '2026-06-15T09:00:00+09:00',
  },
  {
    // 무지개유치원 — 비저지대·지하공간 없음 (비교 케이스)
    id: '55555555-0000-0000-0001-000000000002',
    institution_id: '11111111-0000-0000-0000-000000000002',
    disaster_type: 'heavy_rain',
    thermometer: true,
    first_aid_kit: true,
    indoor_alt_space: true,
    disaster_specific: {
      low_ground: false,
      near_stream_or_slope: false,
      has_basement: false,
      entrance_type: 'raised',        // 지면보다 높음 — 침수 위험 낮음
      pickup_wait_area: 'indoor',
      outdoor_playground_location: 'ground_level',
      has_shuttle: true,
      has_alt_indoor_space: true,
      has_emergency_contact_plan: true,
      has_evacuation_space: true,
      mobility_support_count: 0,
    },
    is_current: true,
    created_at: '2026-06-15T09:00:00+09:00',
  },
]

export function getSampleHeavyRainProfile(institutionId: string): InstitutionRiskProfile | undefined {
  return SAMPLE_HEAVY_RAIN_PROFILES.find(
    (p) => p.institution_id === institutionId && p.is_current
  )
}
