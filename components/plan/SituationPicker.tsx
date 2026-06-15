'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useWizardState } from '@/lib/hooks/useWizardState'
import { useRole } from '@/components/providers/RoleProvider'
import type { SituationCode } from '@/lib/types/db'

const MAX_SELECT = 3

const SITUATIONS: { code: SituationCode; label: string; emoji: string }[] = [
  { code: 'before_outdoor', label: '실외활동 시작 전', emoji: '🌤️' },
  { code: 'during_outdoor', label: '실외놀이 중', emoji: '🏃' },
  { code: 'field_trip_planned', label: '현장학습·외출 예정', emoji: '🚌' },
  { code: 'meal_time', label: '급식 시간', emoji: '🍱' },
  { code: 'nap_time', label: '낮잠 시간', emoji: '😴' },
  { code: 'pickup_prep', label: '하원 준비 중', emoji: '🎒' },
  { code: 'before_shuttle', label: '통학버스 탑승 전', emoji: '🚌' },
  { code: 'cooling_issue', label: '냉방기 이상', emoji: '❄️' },
  { code: 'heat_symptom_suspected', label: '온열증상 의심 유아', emoji: '🌡️' },
  { code: 'no_special', label: '특별한 상황 없음', emoji: '✅' },
  { code: 'etc', label: '기타(직접 입력)', emoji: '✏️' },
]

export function SituationPicker() {
  const router = useRouter()
  const { get, update } = useWizardState()
  const { role } = useRole()
  const draft = get()

  const [selected, setSelected] = useState<SituationCode[]>(draft.selected_situations)
  const [etcText, setEtcText] = useState(draft.situation_etc)
  const [submitting, setSubmitting] = useState(false)

  function toggle(code: SituationCode) {
    if (code === 'no_special') {
      setSelected(['no_special'])
      return
    }
    setSelected((prev) => {
      const withoutNoSpecial = prev.filter((c) => c !== 'no_special')
      if (withoutNoSpecial.includes(code)) {
        return withoutNoSpecial.filter((c) => c !== code)
      }
      if (withoutNoSpecial.length >= MAX_SELECT) {
        toast.warning(`상황은 최대 ${MAX_SELECT}개까지 선택할 수 있습니다.`)
        return prev
      }
      return [...withoutNoSpecial, code]
    })
  }

  const hasEtc = selected.includes('etc')
  const isValid = selected.length > 0 && (!hasEtc || etcText.trim().length > 0)

  async function handleGenerate() {
    if (!isValid) return
    setSubmitting(true)

    update({ selected_situations: selected, situation_etc: etcText.trim() })

    try {
      const wizardData = {
        ...get(),
        selected_situations: selected,
        situation_etc: etcText.trim(),
        role,
      }
      const res = await fetch('/api/plan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wizardData),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? '생성 실패')
        setSubmitting(false)
        return
      }
      router.push(`/plan/${json.data.id}`)
    } catch {
      toast.error('네트워크 오류가 발생했습니다.')
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* 선택 카운터 */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          현재 기관 상황을 선택하세요 (최대 {MAX_SELECT}개)
        </p>
        <span className="text-sm font-medium text-primary">
          {selected.filter((c) => c !== 'no_special').length}/{MAX_SELECT}
        </span>
      </div>

      {/* 상황 버튼 그리드 */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {SITUATIONS.map(({ code, label, emoji }) => {
          const isSelected = selected.includes(code)
          const isDisabled =
            !isSelected &&
            code !== 'no_special' &&
            selected.filter((c) => c !== 'no_special').length >= MAX_SELECT

          return (
            <button
              key={code}
              onClick={() => toggle(code)}
              disabled={isDisabled}
              className={`flex min-h-[56px] items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-all ${
                isSelected
                  ? 'border-primary bg-primary/10 font-medium text-primary'
                  : isDisabled
                  ? 'cursor-not-allowed border-border bg-muted text-muted-foreground opacity-50'
                  : 'border-border hover:border-muted-foreground/50 hover:bg-muted'
              }`}
              aria-pressed={isSelected}
            >
              <span className="text-base" aria-hidden="true">
                {emoji}
              </span>
              <span className="leading-tight">{label}</span>
            </button>
          )
        })}
      </div>

      {/* 기타 직접 입력 */}
      {hasEtc && (
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="etc-text">
            기타 상황 입력
          </label>
          <textarea
            id="etc-text"
            rows={3}
            placeholder="현재 상황을 직접 입력하세요."
            value={etcText}
            onChange={(e) => setEtcText(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}

      {/* 생성 버튼 */}
      <Button
        onClick={handleGenerate}
        disabled={!isValid || submitting}
        className="w-full min-h-[52px] text-base font-semibold"
      >
        {submitting ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            대응계획 생성 중...
          </span>
        ) : (
          '🌡️ 대응계획 생성하기'
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        공식 재난문자와 기관 입력정보를 바탕으로 대응 우선순위를 제안합니다.
      </p>
    </div>
  )
}
