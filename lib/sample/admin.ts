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
}

export interface AdminStats {
  institution_count: number
  today_plan_count: number
  high_priority_count: number
}

export const SAMPLE_ADMIN_STATS: AdminStats = {
  institution_count: 3,
  today_plan_count: 2,
  high_priority_count: 1,
}

export const SAMPLE_ADMIN_PLANS: AdminPlanRow[] = [
  {
    id: '44444444-0000-0000-0000-000000000001',
    institution_id: '11111111-0000-0000-0000-000000000001',
    institution_name: '햇살어린이집',
    priority: 'high',
    created_at: '2026-06-15T14:10:00+09:00',
    is_fallback: true,
    created_by_role: 'director',
    disaster_summary: SAMPLE_AI_RESULT.disaster_summary,
  },
  {
    id: '44444444-0000-0000-0000-000000000002',
    institution_id: '11111111-0000-0000-0000-000000000002',
    institution_name: '무지개유치원',
    priority: 'medium',
    created_at: '2026-06-15T11:30:00+09:00',
    is_fallback: true,
    created_by_role: 'teacher',
    disaster_summary: '폭염주의보 발효 중. 실내 활동 전환과 수분 보충 권장.',
  },
  {
    id: '44444444-0000-0000-0000-000000000003',
    institution_id: '11111111-0000-0000-0000-000000000003',
    institution_name: '새싹어린이집',
    priority: 'low',
    created_at: '2026-06-14T09:20:00+09:00',
    is_fallback: true,
    created_by_role: 'director',
    disaster_summary: '폭염 특보 해제. 일상 활동 가능하나 지속적 수분 섭취 권장.',
  },
]
