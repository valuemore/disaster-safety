'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useWizardState } from '@/lib/hooks/useWizardState'
import { SAMPLE_DISASTER_MESSAGES } from '@/lib/sample'

type Tab = 'sample' | 'manual'

// 재난문자 강도 뱃지
const INTENSITY: Record<string, { label: string; variant: 'destructive' | 'secondary' | 'outline' }> = {
  '33333333-0000-0000-0000-000000000001': { label: '폭염경보', variant: 'destructive' },
  '33333333-0000-0000-0000-000000000002': { label: '폭염주의보', variant: 'secondary' },
  '33333333-0000-0000-0000-000000000003': { label: '폭염특보', variant: 'outline' },
}

export function MessageInput() {
  const router = useRouter()
  const { get, update } = useWizardState()
  const draft = get()

  const [tab, setTab] = useState<Tab>('sample')
  const [selectedId, setSelectedId] = useState<string | null>(draft.disaster_message_id)
  const [manualText, setManualText] = useState(
    draft.disaster_message_source === 'manual' ? draft.disaster_message_text : ''
  )

  const isValid =
    tab === 'sample' ? !!selectedId : manualText.trim().length >= 5

  function handleNext() {
    if (tab === 'sample' && selectedId) {
      const msg = SAMPLE_DISASTER_MESSAGES.find((m) => m.id === selectedId)!
      update({
        disaster_message_id: selectedId,
        disaster_message_text: msg.raw_text,
        disaster_message_source: 'sample',
        disaster_message_issued_at: msg.issued_at,
      })
    } else {
      update({
        disaster_message_id: null,
        disaster_message_text: manualText.trim(),
        disaster_message_source: 'manual',
        disaster_message_issued_at: null,
      })
    }
    router.push('/plan/new/situation')
  }

  return (
    <div className="space-y-4">
      {/* 탭 전환 */}
      <div className="flex rounded-lg border bg-muted p-1">
        {(
          [
            { key: 'sample', label: '샘플 선택' },
            { key: 'manual', label: '원문 붙여넣기' },
          ] as { key: Tab; label: string }[]
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              tab === key
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 샘플 선택 탭 */}
      {tab === 'sample' && (
        <div className="space-y-2">
          {SAMPLE_DISASTER_MESSAGES.map((msg) => {
            const intensity = INTENSITY[msg.id]
            const isSelected = selectedId === msg.id
            return (
              <button
                key={msg.id}
                onClick={() => setSelectedId(msg.id)}
                className="w-full text-left"
              >
                <Card
                  className={`cursor-pointer transition-all ${
                    isSelected
                      ? 'border-primary ring-2 ring-primary ring-offset-1'
                      : 'hover:border-muted-foreground/40'
                  }`}
                >
                  <CardHeader className="pb-1 pt-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      {intensity && (
                        <Badge variant={intensity.variant} className="text-xs">
                          {intensity.label}
                        </Badge>
                      )}
                      {isSelected && (
                        <span className="ml-auto text-xs font-normal text-primary">선택됨 ✓</span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-3">
                    <p className="text-xs leading-relaxed text-muted-foreground line-clamp-3">
                      {msg.raw_text}
                    </p>
                    {msg.summary && (
                      <p className="mt-1 text-xs font-medium">{msg.summary}</p>
                    )}
                  </CardContent>
                </Card>
              </button>
            )
          })}
        </div>
      )}

      {/* 원문 붙여넣기 탭 */}
      {tab === 'manual' && (
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="manual-text">
            재난문자 원문
          </label>
          <textarea
            id="manual-text"
            rows={6}
            placeholder="수신한 재난문자 원문을 붙여넣으세요."
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            최소 5자 이상 입력해 주세요.
          </p>
        </div>
      )}

      <Button
        onClick={handleNext}
        disabled={!isValid}
        className="w-full min-h-[48px] text-base"
      >
        다음: 현재 상황 선택
      </Button>
    </div>
  )
}
