'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useWizardState } from '@/lib/hooks/useWizardState'
import { useRole } from '@/components/providers/RoleProvider'
import { DISASTER_REGISTRY } from '@/lib/disaster/registry'
import type { SituationCode } from '@/lib/types/db'

const MAX_SELECT = 3

export function SituationPicker() {
  const router = useRouter()
  const { get, update } = useWizardState()
  const { role } = useRole()
  const draft = get()

  // 재난유형별 상황 목록을 레지스트리에서 동적 로드
  const disasterType = draft.disaster_type ?? 'heatwave'
  const registryEntry = DISASTER_REGISTRY[disasterType]
  // registry의 code: string 을 SituationCode 로 캐스팅 (폭염 코드는 동일)
  const situations = registryEntry?.situations ?? []

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

  // 레지스트리에 상황이 없는 경우(준비 중 재난유형) 안내 표시
  if (situations.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-6 text-center">
          <p className="text-sm font-medium text-amber-800">
            {registryEntry?.label ?? disasterType} 유형의 상황 선택은 준비 중입니다.
          </p>
          <p className="mt-1 text-xs text-amber-700">
            현재는 폭염(heatwave) 유형만 지원됩니다.
          </p>
        </div>
      </div>
    )
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
        {situations.map(({ code, label, emoji }) => {
          // registry code: string → SituationCode 캐스팅 (폭염은 완전 일치)
          const situationCode = code as SituationCode
          const isSelected = selected.includes(situationCode)
          const isDisabled =
            !isSelected &&
            code !== 'no_special' &&
            selected.filter((c) => c !== 'no_special').length >= MAX_SELECT

          return (
            <button
              key={code}
              onClick={() => toggle(situationCode)}
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
            placeholder={
              disasterType === 'infection'
                ? '증상 유형·인원수·상황만 입력하세요. (유아 이름·진단명·질병명 기재 금지)'
                : '현재 상황을 직접 입력하세요. (개인정보 기재 금지)'
            }
            value={etcText}
            onChange={(e) => setEtcText(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {disasterType === 'infection' && (
            <p className="mt-1 text-xs text-amber-700">
              유아 이름·진단명·질병명·보호자 연락처는 입력하지 않습니다. &quot;발열 유아 1명&quot;처럼 집계·증상 정보만 기재하세요.
            </p>
          )}
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
          '대응계획 생성하기'
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        공식 재난문자와 기관 입력정보를 바탕으로 대응 우선순위를 제안합니다.
      </p>
    </div>
  )
}
