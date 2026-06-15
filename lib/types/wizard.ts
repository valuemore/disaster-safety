// WizardDraft — 서버·클라이언트 공용 타입 (useWizardState.ts에서 재-export)
import type { SituationCode, Role } from './db'

export interface WizardDraft {
  institution_id: string | null
  institution_name: string | null
  has_shuttle: boolean
  disaster_message_id: string | null
  disaster_message_text: string
  disaster_message_source: 'sample' | 'manual'
  disaster_message_issued_at: string | null
  selected_situations: SituationCode[]
  situation_etc: string
  role: Role | null
}
