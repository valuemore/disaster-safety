import type { DisasterType } from '@/lib/types/db'
import { SAMPLE_AI_RESULT } from './action_results'

export interface AdminPlanRow {
  id: string
  institution_id: string
  institution_name: string
  priority: 'high' | 'medium' | 'low' | null
  created_at: string
  is_fallback: boolean
  created_by_role: string | null
  disaster_summary: string
  /** 재난유형 식별자 (result_json.disaster_type 에서 추출) */
  disaster_type?: DisasterType | null
}

export interface AdminStats {
  institution_count: number
  today_plan_count: number
  high_priority_count: number
  /** 재난유형별 대응계획 생성 건수 (전체 기간) */
  disaster_type_counts?: Partial<Record<DisasterType, number>>
}

export const SAMPLE_ADMIN_STATS: AdminStats = {
  institution_count: 3,
  today_plan_count: 5,
  high_priority_count: 2,
  // 데모용 재난유형 분포: 폭염 3건, 집중호우 2건, 감염병 1건
  disaster_type_counts: {
    heatwave: 3,
    heavy_rain: 2,
    infection: 1,
  },
}

export const SAMPLE_ADMIN_PLANS: AdminPlanRow[] = [
  {
    id: '44444444-0000-0000-0000-000000000001',
    institution_id: '11111111-0000-0000-0000-000000000001',
    institution_name: '햇살어린이집',
    priority: 'high',
    created_at: '2026-06-16T14:10:00+09:00',
    is_fallback: true,
    created_by_role: 'director',
    disaster_summary: SAMPLE_AI_RESULT.disaster_summary,
    disaster_type: 'heatwave',
  },
  {
    id: '44444444-0000-0000-0000-000000000002',
    institution_id: '11111111-0000-0000-0000-000000000002',
    institution_name: '무지개유치원',
    priority: 'medium',
    created_at: '2026-06-16T11:30:00+09:00',
    is_fallback: true,
    created_by_role: 'teacher',
    disaster_summary: '호우경보 발효 중. 실외활동 중단 및 하원 일정 조정 권장.',
    disaster_type: 'heavy_rain',
  },
  {
    id: '44444444-0000-0000-0000-000000000003',
    institution_id: '11111111-0000-0000-0000-000000000003',
    institution_name: '새싹어린이집',
    priority: 'high',
    created_at: '2026-06-15T09:20:00+09:00',
    is_fallback: true,
    created_by_role: 'director',
    disaster_summary: '감염병 대응 조치 중. 유증상 유아 분리 및 보호자 연락 완료.',
    disaster_type: 'infection',
  },
  {
    id: '44444444-0000-0000-0000-000000000004',
    institution_id: '11111111-0000-0000-0000-000000000001',
    institution_name: '햇살어린이집',
    priority: 'medium',
    created_at: '2026-06-15T10:00:00+09:00',
    is_fallback: true,
    created_by_role: 'teacher',
    disaster_summary: '폭염주의보 발효 중. 실내 활동 전환과 수분 보충 권장.',
    disaster_type: 'heatwave',
  },
  {
    id: '44444444-0000-0000-0000-000000000005',
    institution_id: '11111111-0000-0000-0000-000000000002',
    institution_name: '무지개유치원',
    priority: 'low',
    created_at: '2026-06-14T16:00:00+09:00',
    is_fallback: true,
    created_by_role: 'director',
    disaster_summary: '집중호우 예보. 통학버스 운행 전 경로 점검 권장.',
    disaster_type: 'heavy_rain',
  },
  {
    id: '44444444-0000-0000-0000-000000000006',
    institution_id: '11111111-0000-0000-0000-000000000003',
    institution_name: '새싹어린이집',
    priority: 'low',
    created_at: '2026-06-14T09:00:00+09:00',
    is_fallback: true,
    created_by_role: 'director',
    disaster_summary: '폭염 특보 해제. 일상 활동 가능하나 지속적 수분 섭취 권장.',
    disaster_type: 'heatwave',
  },
]
