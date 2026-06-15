import type { HeatwaveProfile } from '@/lib/types/db'

// 기관당 1개 프로필 — supabase/seed.sql과 동일 데이터
export const SAMPLE_HEATWAVE_PROFILES: HeatwaveProfile[] = [
  {
    id: '22222222-0000-0000-0000-000000000001',
    institution_id: '11111111-0000-0000-0000-000000000001',
    heat_vulnerable_count: 3,
    respiratory_caution_count: 2,
    mobility_support_count: 1,
    special_support_count: 1,
    cooling_ok: true,
    indoor_alt_space: true,
    water_supply_ok: true,
    thermometer: true,
    first_aid_kit: true,
    vehicle_thermometer: false, // 차량 온도계 미보유 — 데모 포인트
    pickup_wait_place: 'indoor',
    is_current: true,
    created_at: '2026-06-15T09:00:00+09:00',
  },
  {
    id: '22222222-0000-0000-0000-000000000002',
    institution_id: '11111111-0000-0000-0000-000000000002',
    heat_vulnerable_count: 5,
    respiratory_caution_count: 3,
    mobility_support_count: 0,
    special_support_count: 2,
    cooling_ok: false, // 냉방 이상 — 다양한 케이스
    indoor_alt_space: true,
    water_supply_ok: true,
    thermometer: true,
    first_aid_kit: true,
    vehicle_thermometer: true,
    pickup_wait_place: 'shade',
    is_current: true,
    created_at: '2026-06-15T09:00:00+09:00',
  },
  {
    id: '22222222-0000-0000-0000-000000000003',
    institution_id: '11111111-0000-0000-0000-000000000003',
    heat_vulnerable_count: 1,
    respiratory_caution_count: 0,
    mobility_support_count: 0,
    special_support_count: 0,
    cooling_ok: true,
    indoor_alt_space: false,
    water_supply_ok: true,
    thermometer: false,
    first_aid_kit: true,
    vehicle_thermometer: false,
    pickup_wait_place: 'outdoor',
    is_current: true,
    created_at: '2026-06-15T09:00:00+09:00',
  },
]

export function getSampleProfile(institutionId: string): HeatwaveProfile | undefined {
  return SAMPLE_HEATWAVE_PROFILES.find(
    (p) => p.institution_id === institutionId && p.is_current
  )
}
