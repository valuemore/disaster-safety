// T8-3: 공통 + 유형별 policy block 조립
// callClaude.ts 에서 SYSTEM_PROMPT 대신 buildSystemPrompt(disasterType) 를 사용

import type { DisasterType } from '@/lib/disaster/types'
import { COMMON_SYSTEM_PROMPT } from './systemPrompt'
import { HEATWAVE_POLICY_BLOCK, HEATWAVE_OUTPUT_GUIDANCE } from './disaster/heatwave'
import { HEAVY_RAIN_POLICY_BLOCK, HEAVY_RAIN_OUTPUT_GUIDANCE } from './disaster/heavyRain'
import { INFECTION_POLICY_BLOCK, INFECTION_OUTPUT_GUIDANCE } from './disaster/infection'

/**
 * 출력 JSON 스키마 힌트 — role_based_actions 구조 반영 (T8-3 신규)
 */
export const OUTPUT_SCHEMA_HINT = `아래 JSON 스키마에 정확히 맞는 객체 하나만 출력합니다. 다른 텍스트는 일절 포함하지 않습니다.

{
  "disaster_type": "heatwave | heavy_rain | infection",
  "disaster_summary": "재난문자 핵심 요약(1~3문장)",
  "priority": "high | medium | low",
  "priority_reason": "우선순위 판단 근거(1~2문장)",
  "reflected_evidence": ["반영된 근거 정보(최소 1개)"],
  "missing_info": ["더 나은 대응에 필요한 부족 정보"],
  "role_based_actions": [
    {
      "role": "director | homeroom_teacher | bus_manager | cook_or_food_service | health_manager",
      "role_label": "역할 한국어 표시 이름",
      "actions": ["실행 항목(최소 1개, 해당 없으면 ['해당 없음'])"]
    }
  ],
  "parent_notice": "학부모 안내문(공포 금지, 안정감, 구체 행동)",
  "emergency_contact_guide": "응급 연락 안내(119 등 공식 채널 우선)",
  "official_priority_notice": "공식기관 지시 우선 안내문",
  "safety_disclaimer": "공식 재난문자와 기관 입력정보를 바탕으로 한 대응지원 정보이며, 위급상황에서는 공식기관 지시와 119 안내를 우선합니다."
}`

/**
 * 재난유형에 맞는 policy block을 반환한다.
 * P9/P10에서 heavyRain/infection policy block 추가 예정.
 */
function getPolicyBlock(disasterType: DisasterType): string {
  switch (disasterType) {
    case 'heatwave':
      return HEATWAVE_POLICY_BLOCK + '\n' + HEATWAVE_OUTPUT_GUIDANCE
    case 'heavy_rain':
      return HEAVY_RAIN_POLICY_BLOCK + '\n' + HEAVY_RAIN_OUTPUT_GUIDANCE
    case 'infection':
      return INFECTION_POLICY_BLOCK + '\n' + INFECTION_OUTPUT_GUIDANCE
  }
}

/**
 * 완전한 시스템 프롬프트 조립.
 * 공통 안전규칙 + 재난유형별 policy block 을 결합한다.
 */
export function buildSystemPrompt(disasterType: DisasterType): string {
  return COMMON_SYSTEM_PROMPT + '\n' + getPolicyBlock(disasterType)
}
