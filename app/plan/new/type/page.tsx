'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { WizardProgress } from '@/components/wizard/WizardProgress'
import { useWizardState } from '@/lib/hooks/useWizardState'
import { DISASTER_REGISTRY } from '@/lib/disaster/registry'
import type { DisasterType } from '@/lib/disaster/types'

// 재난유형별 아이콘(이모지)과 설명 문구 — registry에 없는 UI 전용 메타데이터
const DISASTER_UI_META: Record<DisasterType, { icon: string; description: string }> = {
  heatwave: {
    icon: '☀️',
    description: '폭염 재난문자 수신 시 원장·담임·통학버스 역할별 대응 체크리스트와 학부모 안내문을 생성합니다.',
  },
  heavy_rain: {
    icon: '🌧️',
    description: '집중호우 재난문자 수신 시 실외중단·하원조정·통학버스 운행 판단을 지원합니다.',
  },
  infection: {
    icon: '🏥',
    description: '기관 내 감염병 유증상 발생 시 분리대기·보호자 연락·소독 절차를 안내합니다.',
  },
}

// registry 순서를 고정하기 위해 DisasterType 배열로 정의
const DISASTER_ORDER: DisasterType[] = ['heatwave', 'heavy_rain', 'infection']

export default function DisasterTypePage() {
  const router = useRouter()
  const { get, update } = useWizardState()

  // 딥링크 진입 시 기본값 보장: sessionStorage에 institution_id 없으면 기관 선택으로 리다이렉트
  const [selectedType, setSelectedType] = useState<DisasterType>('heatwave')
  const [guardChecked, setGuardChecked] = useState(false)

  useEffect(() => {
    const draft = get()
    // institution_id 없으면 기관 선택 단계로 돌려보냄
    if (!draft.institution_id) {
      router.replace('/plan/new')
      return
    }
    // 이미 저장된 disaster_type이 있으면 복원
    setSelectedType(draft.disaster_type ?? 'heatwave')
    setGuardChecked(true)
  }, [get, router])

  function handleNext() {
    update({ disaster_type: selectedType })
    router.push('/plan/new/message')
  }

  function handleBack() {
    router.push('/plan/new')
  }

  if (!guardChecked) {
    // 가드 체크 중 스켈레톤
    return (
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
        <div className="h-10 animate-pulse rounded-lg bg-muted" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <WizardProgress currentStep={1} />

      <div className="mb-6">
        <h1 className="text-xl font-bold">재난유형 선택</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          대응계획을 생성할 재난유형을 선택하세요.
        </p>
      </div>

      <div className="space-y-3">
        {DISASTER_ORDER.map((type) => {
          const entry = DISASTER_REGISTRY[type]
          const meta = DISASTER_UI_META[type]
          const isEnabled = entry.enabled
          const isSelected = selectedType === type && isEnabled

          return (
            <button
              key={type}
              type="button"
              disabled={!isEnabled}
              aria-pressed={isSelected}
              aria-disabled={!isEnabled}
              onClick={() => {
                if (isEnabled) setSelectedType(type)
              }}
              className={[
                'w-full text-left transition-all rounded-xl',
                !isEnabled && 'cursor-not-allowed opacity-40',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <Card
                className={[
                  'transition-all',
                  isSelected
                    ? 'border-primary ring-2 ring-primary ring-offset-1'
                    : isEnabled
                      ? 'hover:border-muted-foreground/40'
                      : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <CardHeader className="pb-1 pt-4">
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-base">
                      <span aria-hidden="true" className="text-xl leading-none">
                        {meta.icon}
                      </span>
                      {entry.label}
                    </span>
                    <span className="flex items-center gap-2">
                      {!isEnabled && (
                        <Badge variant="secondary" className="text-xs">
                          준비중
                        </Badge>
                      )}
                      {isSelected && (
                        <span className="text-xs font-normal text-primary">선택됨 ✓</span>
                      )}
                    </span>
                  </CardTitle>
                  <CardDescription className="text-xs leading-relaxed">
                    {meta.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-4">
                  {isEnabled ? (
                    <p className="text-xs text-muted-foreground">
                      상황 버튼 {entry.situations.length}개 · 역할별 체크리스트 생성 지원
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      향후 업데이트에서 지원 예정입니다.
                    </p>
                  )}
                </CardContent>
              </Card>
            </button>
          )
        })}
      </div>

      <div className="mt-6 space-y-3">
        <Button
          onClick={handleNext}
          disabled={!DISASTER_REGISTRY[selectedType]?.enabled}
          className="w-full min-h-[48px] text-base"
        >
          {DISASTER_REGISTRY[selectedType]?.label ?? '폭염'} 대응계획 생성하기
        </Button>
        <Button
          variant="outline"
          onClick={handleBack}
          className="w-full min-h-[44px]"
        >
          이전 단계로
        </Button>
      </div>
    </div>
  )
}
