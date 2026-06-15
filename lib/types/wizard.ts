// WizardDraft — 서버·클라이언트 공용 타입 (useWizardState.ts에서 재-export)
import type { SituationCode, Role } from './db'
import type { DisasterType } from '@/lib/disaster/types'

export interface WizardDraft {
  /** 재난유형 (기본값: 'heatwave' — 기존 폭염 흐름 유지) */
  disaster_type: DisasterType
  institution_id: string | null
  institution_name: string | null
  has_shuttle: boolean
  disaster_message_id: string | null
  disaster_message_text: string
  disaster_message_source: 'sample' | 'manual' | 'api'
  disaster_message_issued_at: string | null
  selected_situations: SituationCode[]
  situation_etc: string
  role: Role | null
}
