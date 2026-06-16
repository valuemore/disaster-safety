'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useWizardState } from '@/lib/hooks/useWizardState'
import type { DisasterSmsItem } from '@/lib/external/disasterSms'
import type { DisasterType } from '@/lib/disaster/types'

type Tab = 'api' | 'manual'

const TYPE_LABELS: Record<DisasterType, string> = {
  heatwave: '폭염',
  heavy_rain: '집중호우',
  infection: '감염병',
}

export function MessageInput() {
  const router = useRouter()
  const { update, reset } = useWizardState()

  // 마법사 진입 시 이전 draft 초기화 (새 대응계획은 항상 새로 시작)
  useEffect(() => {
    reset()
  }, [reset])

  const [tab, setTab] = useState<Tab>('manual')
  const [manualText, setManualText] = useState('')
  const [apiItems, setApiItems] = useState<DisasterSmsItem[]>([])
  const [apiLoading, setApiLoading] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [apiSelectedId, setApiSelectedId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  /** 자동분류 실패('other') 시 수동 선택 UI 노출 */
  const [needsManualType, setNeedsManualType] = useState(false)

  const chosenText =
    tab === 'api'
      ? apiItems.find((m) => m.id === apiSelectedId)?.raw_text ?? ''
      : manualText.trim()

  const isValid = chosenText.length >= 5

  async function handleFetchApi() {
    setApiLoading(true)
    setApiError(null)
    try {
      const res = await fetch('/api/external/disaster-sms')
      if (!res.ok) throw new Error('fetch failed')
      const json = await res.json()
      setApiItems(json.data ?? [])
      if ((json.data ?? []).length === 0) setApiError('현재 조회된 재난문자가 없습니다.')
    } catch {
      setApiError('재난문자 조회에 실패했습니다. 원문 붙여넣기를 이용해 주세요.')
    } finally {
      setApiLoading(false)
    }
  }

  function proceed(disasterType: DisasterType, issuedAt: string | null) {
    update({
      disaster_type: disasterType,
      disaster_message_text: chosenText,
      disaster_message_source: tab,
      disaster_message_issued_at: issuedAt,
    })
    router.push('/plan/new/situation')
  }

  async function handleNext() {
    if (!isValid || submitting) return
    setSubmitting(true)

    const apiItem = tab === 'api' ? apiItems.find((m) => m.id === apiSelectedId) : null
    const issuedAt = apiItem?.issued_at ?? null

    // 실시간 조회 항목이 이미 분류돼 있으면 그대로 사용
    if (apiItem && apiItem.disaster_type !== 'other') {
      proceed(apiItem.disaster_type, issuedAt)
      return
    }

    try {
      const res = await fetch('/api/plan/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_text: chosenText }),
      })
      const json = await res.json()
      const type = json?.data?.disaster_type as DisasterType | 'other' | undefined
      if (type && type !== 'other') {
        toast.success(`재난유형: ${TYPE_LABELS[type]} (자동 분류)`)
        proceed(type, issuedAt)
        return
      }
      // 분류 실패 → 수동 선택 UI 노출
      setNeedsManualType(true)
      setSubmitting(false)
    } catch {
      setNeedsManualType(true)
      setSubmitting(false)
    }
  }

  function handleManualType(type: DisasterType) {
    const apiItem = tab === 'api' ? apiItems.find((m) => m.id === apiSelectedId) : null
    proceed(type, apiItem?.issued_at ?? null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-xs">자동 분류</Badge>
        <span className="text-xs text-muted-foreground">
          재난문자를 입력하면 재난유형을 자동으로 분류합니다.
        </span>
      </div>

      {/* 탭 전환 */}
      <div className="flex rounded-lg border bg-muted p-1">
        {(
          [
            { key: 'manual', label: '원문 붙여넣기' },
            { key: 'api', label: '실시간 조회' },
          ] as { key: Tab; label: string }[]
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setTab(key); setNeedsManualType(false) }}
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

      {/* 원문 붙여넣기 */}
      {tab === 'manual' && (
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="manual-text">
            재난문자 원문
          </label>
          <textarea
            id="manual-text"
            rows={6}
            placeholder="수신한 재난문자 원문을 붙여넣으세요. (유아 이름·진단명·보호자 연락처 등 개인정보는 삭제 후 입력)"
            value={manualText}
            onChange={(e) => { setManualText(e.target.value); setNeedsManualType(false) }}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="mt-1 text-xs text-muted-foreground">최소 5자 이상 입력해 주세요.</p>
        </div>
      )}

      {/* 실시간 조회 */}
      {tab === 'api' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">행안부 재난문자 API에서 최근 문자를 조회합니다.</p>
            <Button variant="outline" size="sm" onClick={handleFetchApi} disabled={apiLoading} className="shrink-0">
              {apiLoading ? '조회 중…' : '가져오기'}
            </Button>
          </div>
          {apiError && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{apiError}</p>
          )}
          {apiItems.length > 0 && (
            <div className="space-y-2">
              {apiItems.map((msg) => {
                const isSelected = apiSelectedId === msg.id
                return (
                  <button
                    key={msg.id}
                    onClick={() => { setApiSelectedId(msg.id); setNeedsManualType(false) }}
                    className="w-full text-left"
                  >
                    <Card
                      className={`cursor-pointer transition-all ${
                        isSelected ? 'border-primary ring-2 ring-primary ring-offset-1' : 'hover:border-muted-foreground/40'
                      }`}
                    >
                      <CardHeader className="pb-1 pt-3">
                        <CardTitle className="flex items-center gap-2 text-sm">
                          <Badge variant="secondary" className="text-xs">재난문자</Badge>
                          {msg.region && (
                            <span className="text-xs font-normal text-muted-foreground">{msg.region}</span>
                          )}
                          {isSelected && <span className="ml-auto text-xs font-normal text-primary">선택됨</span>}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pb-3">
                        <p className="text-xs leading-relaxed text-muted-foreground line-clamp-3">{msg.raw_text}</p>
                        {msg.issued_at && <p className="mt-1 text-xs text-muted-foreground/70">{msg.issued_at}</p>}
                      </CardContent>
                    </Card>
                  </button>
                )
              })}
            </div>
          )}
          {apiItems.length === 0 && !apiLoading && !apiError && (
            <p className="rounded-md bg-muted px-3 py-6 text-center text-sm text-muted-foreground">
              &lsquo;가져오기&rsquo; 버튼을 눌러 최근 재난문자를 조회하세요.
            </p>
          )}
        </div>
      )}

      {/* 자동분류 실패 시 수동 선택 */}
      {needsManualType && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="mb-2 text-sm font-medium text-amber-800">
            재난유형을 자동으로 분류하지 못했습니다. 유형을 선택하세요.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(TYPE_LABELS) as DisasterType[]).map((t) => (
              <Button key={t} variant="outline" size="sm" onClick={() => handleManualType(t)}>
                {TYPE_LABELS[t]}
              </Button>
            ))}
          </div>
        </div>
      )}

      {!needsManualType && (
        <Button onClick={handleNext} disabled={!isValid || submitting} className="w-full min-h-[48px] text-base">
          {submitting ? '재난유형 분류 중…' : '다음: 현재 상황 선택'}
        </Button>
      )}
    </div>
  )
}
