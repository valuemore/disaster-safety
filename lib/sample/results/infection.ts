import type { AiPlanResult, ActionRequest } from '@/lib/types/db'
import { ensureLegacyChecklists } from '@/lib/ai/legacyAdapter'

// TODO(T10-3): 감염병 전용 샘플 결과 작성 예정.
// 현재는 최소 구조만 제공 — generate route USE_SAMPLE_FALLBACK 분기에서 사용.
// T10-3 완료 시 이 파일을 완전한 감염병 시나리오로 교체한다.
//
// 시나리오 (T10-3에서 구체화 예정):
//   기관 내 발열 유아 발생 + 보호자 연락 필요 + 교실 소독 필요
//   역할: 원장·담임교사·보건담당자·조리사/급식담당자
//   재난문자 없이 상황만으로 생성 (재난문자 옵션화 적용)

const _INFECTION_AI_RESULT_BASE: AiPlanResult = {
  // ── 재난유형 ────────────────────────────────────────────────────────────────
  disaster_type: 'infection',

  // ── 공통 요약·우선순위 ──────────────────────────────────────────────────────
  disaster_summary:
    '기관 내 발열 및 유증상 유아가 발생하였습니다. 분리대기·보호자 연락·교실 소독 등 감염병 대응 절차를 즉시 시행합니다.',
  priority: 'high',
  priority_reason:
    '유증상 유아 발생 및 같은 반 유사증상 반복 가능성으로 감염 전파 예방을 위한 즉각 조치가 필요합니다.',
  reflected_evidence: [
    '현재 상황: 발열 유아 발생, 보호자 연락 필요, 교실 소독 필요',
    '기관 입력: 보건당국 안내 및 기관 감염병 대응 매뉴얼 기준 적용',
  ],
  missing_info: [
    '유증상 유아 수 및 증상 발현 시각',
    '같은 반 다른 유아의 증상 여부',
    '보건당국 현재 권고 사항',
  ],

  // ── 역할별 행동 배열 ──────────────────────────────────────────────────────
  role_based_actions: [
    {
      role: 'director',
      role_label: '원장',
      actions: [
        '유증상 유아를 분리대기 공간으로 즉시 이동시키도록 담임교사에게 지시합니다.',
        '보호자에게 유아 상태를 안내하고 조기 귀가를 요청합니다.',
        '감염병 대응 매뉴얼을 발동하고 보건당국(관할 보건소) 신고 여부를 확인합니다.',
        '교실 소독 일정을 결정하고 소독 전까지 해당 공간 출입을 제한합니다.',
        '전체 학부모에게 상황 안내문을 발송합니다.',
        '교직원 유증상 여부를 확인합니다.',
      ],
    },
    {
      role: 'homeroom_teacher',
      role_label: '담임교사',
      actions: [
        '유증상 유아를 교실 내 다른 유아와 분리하고 분리대기 공간으로 안내합니다.',
        '같은 반 유아의 체온 및 증상 여부를 관찰하고 기록합니다.',
        '손 씻기를 유아들과 함께 실시하고 환기를 충분히 합니다.',
        '유아의 상태 변화를 원장에게 수시로 보고합니다.',
        '유아가 불안해하지 않도록 침착하게 안내합니다.',
      ],
    },
    {
      role: 'bus_manager',
      role_label: '통학버스 담당자',
      actions: [
        '차량 내부를 충분히 환기하고 자주 접촉하는 손잡이·시트 등을 소독합니다.',
        '탑승 유아 중 유증상 유아가 있을 경우 원장에게 보고합니다.',
      ],
    },
    {
      role: 'cook_or_food_service',
      role_label: '조리사/급식담당자',
      actions: [
        '조리 전후 손 씻기와 위생 수칙을 철저히 준수합니다.',
        '식기·조리도구 소독 및 교차오염 방지를 강화합니다.',
        '유증상 조리종사자가 있을 경우 즉시 원장에게 보고하고 급식 담당을 교대합니다.',
        '급식 제공 시 배식 구역의 위생 환경을 점검합니다.',
      ],
    },
    {
      role: 'health_manager',
      role_label: '보건담당자',
      actions: [
        '유증상 유아의 체온을 측정하고 증상(발열·구토·설사·호흡기 증상 등)을 기록합니다.',
        '분리대기 공간에서 유아를 관찰하며 증상 악화 시 원장에게 보고하고 119 안내를 따릅니다.',
        '같은 반 유아의 증상 여부를 담임교사와 함께 확인합니다.',
        '손소독제·마스크 등 위생용품 재고를 확인하고 부족 시 원장에게 요청합니다.',
        '보호자 인계 전까지 유아 상태를 지속적으로 관찰합니다.',
        '의료 진단은 의료기관과 보건당국의 권한이며, 본 안내는 보건당국·119 지시를 보완하는 참고 정보입니다.',
      ],
    },
  ],

  // ── 학부모 안내문 ─────────────────────────────────────────────────────────
  parent_notice:
    '안녕하세요. 오늘 우리 기관에서 유증상 유아가 발생하여 즉시 분리대기 및 보호자 연락 조치를 취하였습니다. 해당 유아의 보호자님께는 별도로 연락드렸습니다. 현재 기관 내 손 씻기, 환기, 소독 등 감염 예방 조치를 강화하고 있습니다. 가정에서도 유아 건강 상태를 주의 깊게 살펴보시고, 발열이나 유사 증상이 나타나면 등원을 자제하시고 의료기관을 방문해 주세요. 아이들의 안전을 위해 최선을 다하겠습니다. 위급 상황에서는 공식기관 지시와 119 안내를 최우선으로 따릅니다.',

  // ── 사후기록 초안 ────────────────────────────────────────────────────────
  after_action_draft: {
    checked_items: {
      symptomatic_isolated: '유증상 유아 분리대기 완료',
      guardian_contacted: '보호자 연락 완료',
      classroom_disinfected: '교실 소독 완료',
      hygiene_strengthened: '손 씻기·환기 강화 실시',
      symptom_recorded: '유아 증상·체온 기록 완료',
      parents_notified: '전체 학부모 안내문 발송 완료',
      health_authority_checked: '보건당국 신고 여부 확인',
    },
    notes: '',
    improvement: '',
  },

  // ── 응급/공식기관/disclaimer ──────────────────────────────────────────────
  emergency_contact_guide:
    '유아가 고열(38.5도 이상), 경련, 심한 구토·설사, 호흡 곤란을 보이면 즉시 119에 연락하고 관할 보건소에 신고합니다. 감염병 발생 시 보건당국·의료기관의 지시를 최우선으로 따릅니다.',
  official_priority_notice:
    '본 안내는 기관의 신속한 대응을 돕기 위한 보조 정보입니다. 보건당국·의료기관·관할 보건소의 지시가 있으면 그 지시를 최우선으로 따릅니다. 진단 및 치료는 반드시 의료기관을 통해야 합니다.',
  safety_disclaimer:
    '공식 재난문자와 기관 입력정보를 바탕으로 한 대응지원 정보이며, 위급상황에서는 공식기관 지시와 119 안내를 우선합니다.',
}

// legacyAdapter 적용 — director/teacher/shuttle_checklist 파생 보장
export const SAMPLE_INFECTION_AI_RESULT: AiPlanResult =
  ensureLegacyChecklists(_INFECTION_AI_RESULT_BASE)

// 감염병 데모용 사전 생성 action_request 1건
// TODO(T10-3): selected_situations를 감염병 전용 코드로 교체 예정
export const SAMPLE_INFECTION_ACTION_REQUEST: ActionRequest = {
  id: '44444444-0000-0000-0002-000000000001',
  institution_id: '11111111-0000-0000-0000-000000000001',
  disaster_message_id: null, // 감염병: 재난문자 없이 상황 입력 모드
  heatwave_profile_id: null,
  risk_profile_id: '55555555-0000-0000-0002-000000000001',
  selected_situations: ['symptomatic_child', 'guardian_contact_needed', 'classroom_disinfection'],
  situation_etc: null,
  priority: 'high',
  result_json: SAMPLE_INFECTION_AI_RESULT,
  is_fallback: true,
  model: 'sample',
  created_by_role: 'director',
  created_at: '2026-06-15T10:30:00+09:00',
}
