import type { DisasterMessage } from '@/lib/types/db'

// 폭염 샘플 재난문자 3종 — docs/04_AI_PROMPT_SPEC.md 샘플 입력과 일치
export const SAMPLE_HEATWAVE_MESSAGES: DisasterMessage[] = [
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

// 집중호우 샘플 재난문자 3종
export const SAMPLE_HEAVY_RAIN_MESSAGES: DisasterMessage[] = [
  {
    id: '33333333-0000-0000-0001-000000000001',
    institution_id: null,
    disaster_type: 'heavy_rain',
    source: 'sample',
    raw_text:
      '[기상청] 호우경보 발효(06/15 13:00). 시간당 강수량 50mm 이상 예상. 저지대·지하공간 침수 위험. 외출을 자제하고 대피 안내 방송에 따르세요. 위급 시 119.',
    summary: '호우경보 발효 — 시간당 50mm+, 저지대·지하 침수 위험',
    issued_at: '2026-06-15T13:00:00+09:00',
    received_at: '2026-06-15T13:05:00+09:00',
    created_at: '2026-06-15T13:05:00+09:00',
  },
  {
    id: '33333333-0000-0000-0001-000000000002',
    institution_id: null,
    disaster_type: 'heavy_rain',
    source: 'sample',
    raw_text:
      '[기상청] 호우주의보 발효(06/15 10:30). 오후까지 누적 강수량 80mm 이상 예상. 하천 수위 상승 주의. 통학버스 등 차량 운행 시 침수도로 주행 금지.',
    summary: '호우주의보 발효 — 누적 80mm+, 하천 수위 상승·통학버스 주의',
    issued_at: '2026-06-15T10:30:00+09:00',
    received_at: '2026-06-15T10:35:00+09:00',
    created_at: '2026-06-15T10:35:00+09:00',
  },
  {
    id: '33333333-0000-0000-0001-000000000003',
    institution_id: null,
    disaster_type: 'heavy_rain',
    source: 'sample',
    raw_text:
      '[지자체] 집중호우 특보 발효 중. 하천변·급경사지 인근 주민은 안전한 곳으로 대피하세요. 학교·어린이집 등 교육기관은 하원 시간 조정 등 안전조치를 취해 주세요. 문의: 시청 재난안전과 02-1234-5678.',
    summary: '집중호우 특보 — 하원 시간 조정, 하천변·급경사지 대피 안내',
    issued_at: '2026-06-15T11:00:00+09:00',
    received_at: '2026-06-15T11:05:00+09:00',
    created_at: '2026-06-15T11:05:00+09:00',
  },
]

// 감염병 샘플 안내문자 2종 — 보건당국 안내 형식, PII 없음
export const SAMPLE_INFECTION_MESSAGES: DisasterMessage[] = [
  {
    id: '33333333-0000-0000-0002-000000000001',
    institution_id: null,
    disaster_type: 'infection',
    source: 'sample',
    raw_text:
      '[○○구 보건소] 관내 어린이집·유치원 수족구병 및 인플루엔자 유행 주의 안내. 발열·발진·구토·기침 등 유증상 유아는 등원을 자제하고 의료기관 진료 후 담임교사에게 알려주세요. 손 씻기, 기침 예절, 장난감·시설 소독을 강화해 주십시오. 집단 발생 시 보건소(☎ 02-1234-0000)에 신고해 주세요.',
    summary: '수족구·인플루엔자 유행 주의 — 유증상 유아 등원 자제, 시설 소독 강화',
    issued_at: '2026-06-15T09:00:00+09:00',
    received_at: '2026-06-15T09:05:00+09:00',
    created_at: '2026-06-15T09:05:00+09:00',
  },
  {
    id: '33333333-0000-0000-0002-000000000002',
    institution_id: null,
    disaster_type: 'infection',
    source: 'sample',
    raw_text:
      '[○○시 보건소] 관내 영유아 노로바이러스(장염) 발생 주의 안내. 구토·설사·복통 유증상 아동 등원 자제 및 가정 내 안정 권고. 화장실 후·조리 전 30초 손 씻기 철저, 급식 식기·조리도구 열탕 소독 실시. 증상 지속 시 의료기관 방문. 단체 내 연속 발생 시 즉시 보건소 신고 요망.',
    summary: '노로바이러스(장염) 주의 — 등원 자제, 급식·화장실 위생 강화',
    issued_at: '2026-06-15T10:00:00+09:00',
    received_at: '2026-06-15T10:05:00+09:00',
    created_at: '2026-06-15T10:05:00+09:00',
  },
]

/**
 * 재난유형에 맞는 샘플 메시지 목록 반환.
 * 기본값(heatwave)은 폭염 샘플 3종.
 */
export function getSampleMessagesByType(disasterType: string): DisasterMessage[] {
  if (disasterType === 'heavy_rain') return SAMPLE_HEAVY_RAIN_MESSAGES
  if (disasterType === 'infection') return SAMPLE_INFECTION_MESSAGES
  return SAMPLE_HEATWAVE_MESSAGES
}

/** 하위 호환: 기존 코드가 SAMPLE_DISASTER_MESSAGES를 임포트하던 경로 유지 */
export const SAMPLE_DISASTER_MESSAGES: DisasterMessage[] = SAMPLE_HEATWAVE_MESSAGES

export type SampleMessageId = (typeof SAMPLE_DISASTER_MESSAGES)[number]['id']
