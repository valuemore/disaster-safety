import type { InstitutionRiskProfile } from '@/lib/types/db'

/**
 * 감염병 기관 위험 프로필 샘플 2건
 * - 케이스 1 (햇살어린이집): 보건실 있음 — 분리대기 공간 확보
 * - 케이스 2 (새싹어린이집): 보건실 없음 — 개선 포인트 데모
 * PII 0건: 집계값(숫자)·boolean·enum만 포함
 * 이름·진단명·약물명·보호자 연락처 없음
 */
export const SAMPLE_INFECTION_PROFILES: InstitutionRiskProfile[] = [
  {
    // 햇살어린이집 — 보건실 있음, 위생용품 구비 (비교적 양호한 케이스)
    id: '55555555-0000-0000-0002-000000000001',
    institution_id: '11111111-0000-0000-0000-000000000001',
    disaster_type: 'infection',
    thermometer: true,       // 체온계 보유 (공통 컬럼 재사용)
    first_aid_kit: true,
    indoor_alt_space: true,  // 분리대기 공간 확보 (공통 컬럼 재사용)
    disaster_specific: {
      class_child_count: 20,           // 반별 유아 수(집계값만, PII 없음)
      has_infant_class: true,          // 영아반 보유 — 감염 취약 포인트
      special_support_count: 2,        // 특별지원 유아 수(집계값)
      has_health_room: true,           // 보건실 또는 분리대기 공간 — 데모 포인트
      has_hand_sanitizer: true,
      has_mask: true,
      has_disinfectant: true,
      guardian_contact_method: 'app', // 보호자 연락 방식 enum (개인번호 없음)
      has_infection_manual: true,
      has_attendance_stop_template: true,
    },
    is_current: true,
    created_at: '2026-06-15T09:00:00+09:00',
  },
  {
    // 새싹어린이집 — 보건실 없음, 위생용품 일부 미구비 (개선 필요 케이스)
    id: '55555555-0000-0000-0002-000000000002',
    institution_id: '11111111-0000-0000-0000-000000000003',
    disaster_type: 'infection',
    thermometer: true,
    first_aid_kit: true,
    indoor_alt_space: false,  // 분리대기 공간 미확보 — 개선 포인트
    disaster_specific: {
      class_child_count: 15,
      has_infant_class: false,
      special_support_count: 0,
      has_health_room: false,  // 보건실 없음 — 개선 포인트
      has_hand_sanitizer: true,
      has_mask: false,          // 마스크 미구비 — 개선 포인트
      has_disinfectant: true,
      guardian_contact_method: 'sms',
      has_infection_manual: false, // 매뉴얼 미보유 — 개선 포인트
      has_attendance_stop_template: false,
    },
    is_current: true,
    created_at: '2026-06-15T09:00:00+09:00',
  },
]

export function getSampleInfectionProfile(
  institutionId: string
): InstitutionRiskProfile | undefined {
  return SAMPLE_INFECTION_PROFILES.find(
    (p) => p.institution_id === institutionId && p.is_current
  )
}
