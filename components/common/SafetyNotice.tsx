import { AlertTriangle } from 'lucide-react'

const SAFETY_NOTICE_TEXT =
  '공식 재난문자와 기관 입력정보를 바탕으로 한 대응지원 정보이며, 위급상황에서는 공식기관 지시와 119 안내를 우선합니다.'

interface SafetyNoticeProps {
  className?: string
}

export function SafetyNotice({ className = '' }: SafetyNoticeProps) {
  return (
    <div
      role="note"
      aria-label="안전 고지"
      className={`flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 ${className}`}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>{SAFETY_NOTICE_TEXT}</p>
    </div>
  )
}

export { SAFETY_NOTICE_TEXT }
