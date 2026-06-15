import type { DisasterMessage } from '@/lib/types/db'

// 강도별 샘플 재난문자 3종 — docs/04_AI_PROMPT_SPEC.md 샘플 입력과 일치
export const SAMPLE_DISASTER_MESSAGES: DisasterMessage[] = [
  {
    id: '33333333-0000-0000-0000-000000000001',
    institution_id: null,
    disaster_type: 'heatwave',
    source: 'sample',
    raw_text:
      '[기상청] 오늘 14시 기준 폭염경보 발효. 야외활동을 자제하고 충분한 수분을 섭취하세요. 어린이·노인·환자 등 취약계층은 시원한 곳에서 휴식하고 이상 증상 발생 시 119로 연락하세요.',
    summary: '폭염경보 발효 — 야외활동 자제, 취약계층 주의',
    issued_at: '2026-06-15T14:00:00+09:00',
    received_at: '2026-06-15T14:05:00+09:00',
    created_at: '2026-06-15T14:05:00+09:00',
  },
  {
    id: '33333333-0000-0000-0000-000000000002',
    institution_id: null,
    disaster_type: 'heatwave',
    source: 'sample',
    raw_text:
      '[기상청] 오늘 10시 기준 폭염주의보 발효. 낮 최고기온 33도 예상. 야외 작업·활동 시 자주 휴식하고 수분을 충분히 섭취하세요.',
    summary: '폭염주의보 발효 — 낮 최고기온 33°C, 야외활동 주의',
    issued_at: '2026-06-15T10:00:00+09:00',
    received_at: '2026-06-15T10:10:00+09:00',
    created_at: '2026-06-15T10:10:00+09:00',
  },
  {
    id: '33333333-0000-0000-0000-000000000003',
    institution_id: null,
    disaster_type: 'heatwave',
    source: 'sample',
    raw_text:
      '[지자체] 폭염 특보 발효 중. 유아·어린이 야외활동을 자제하세요. 야외 대기 시 10분 이상 자제. 냉방시설 이용 권장. 긴급복지시설 안내: 1234-5678.',
    summary: '폭염특보 — 유아 야외활동 자제, 냉방시설 이용 권장',
    issued_at: '2026-06-15T11:30:00+09:00',
    received_at: '2026-06-15T11:35:00+09:00',
    created_at: '2026-06-15T11:35:00+09:00',
  },
]

export type SampleMessageId = (typeof SAMPLE_DISASTER_MESSAGES)[number]['id']
