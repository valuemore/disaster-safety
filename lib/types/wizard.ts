// WizardDraft — 서버·클라이언트 공용 타입 (useWizardState.ts에서 재-export)
import type { SituationCode } from './db'
import type { DisasterType } from '@/lib/disaster/types'

export interface WizardDraft {
  /**
   * 재난유형. 재난문자 입력 시 AI/키워드로 자동 분류되어 채워진다.
   * 분류 전이거나 미분류('other')일 수 있어 null 허용.
   */
  disaster_type: DisasterType | null
  /** 기관 ID — 로그인 세션 기준. generate route에서 세션값으로 override됨. */
  institution_id: string | null
  institution_name: string | null
  has_shuttle: boolean
  disaster_message_text: string
  /** 'manual'=원문 붙여넣기, 'api'=실시간 조회 */
  disaster_message_source: 'manual' | 'api'
  disaster_message_issued_at: string | null
  selected_situations: SituationCode[]
  situation_etc: string
  /** 당일 실제 재원·등원 유아 수 (동적 집계값, 선택). 미입력 시 null → 기관 등록 정원 사용. */
  today_children_count: number | null
  /** 당일 실제 출근 교직원 수 (동적 집계값, 선택). */
  today_staff_count: number | null
}
