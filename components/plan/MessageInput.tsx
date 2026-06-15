'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useWizardState } from '@/lib/hooks/useWizardState'
import { getSampleMessagesByType } from '@/lib/sample/disaster_messages'
import type { DisasterSmsItem } from '@/lib/external/disasterSms'
import type { DisasterType } from '@/lib/disaster/types'
import type { DisasterMessage } from '@/lib/types/db'

// ── 탭 타입 (폭염·집중호우 전용 단일 모드) ─────────────────────────────────
type Tab = 'sample' | 'api' | 'manual'

// ── 감염병 2-모드 ────────────────────────────────────────────────────────────
type InfectionMode = 'authority_notice' | 'institution_situation'

// 재난문자 강도 배지 — 메시지 id를 키로 사용
interface IntensityConfig {
  label: string
  variant: 'destructive' | 'secondary' | 'outline'
}

const HEATWAVE_INTENSITY: Record<string, IntensityConfig> = {
  '33333333-0000-0000-0000-000000000001': { label: '폭염경보', variant: 'destructive' },
  '33333333-0000-0000-0000-000000000002': { label: '폭염주의보', variant: 'secondary' },
  '33333333-0000-0000-0000-000000000003': { label: '폭염특보', variant: 'outline' },
}

const HEAVY_RAIN_INTENSITY: Record<string, IntensityConfig> = {
  '33333333-0000-0000-0001-000000000001': { label: '호우경보', variant: 'destructive' },
  '33333333-0000-0000-0001-000000000002': { label: '호우주의보', variant: 'secondary' },
  '33333333-0000-0000-0001-000000000003': { label: '집중호우 특보', variant: 'outline' },
}

function getIntensityConfig(
  disasterType: DisasterType,
  messageId: string
): IntensityConfig | undefined {
  if (disasterType === 'heavy_rain') return HEAVY_RAIN_INTENSITY[messageId]
  if (disasterType === 'heatwave') return HEATWAVE_INTENSITY[messageId]
  return undefined
}

function getSampleMessages(disasterType: DisasterType): DisasterMessage[] {
  return getSampleMessagesByType(disasterType)
}

// ── 감염병 2-모드 컴포넌트 ─────────────────────────────────────────────────

interface InfectionModeInputProps {
  onNext: (text: string, source: 'sample' | 'manual' | 'situation_only') => void
}

function InfectionModeInput({ onNext }: InfectionModeInputProps) {
  const [mode, setMode] = useState<InfectionMode>('authority_notice')
  const [tab, setTab] = useState<'sample' | 'manual'>('sample')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [manualText, setManualText] = useState('')
  const [situationMemo, setSituationMemo] = useState('')

  const sampleMessages = getSampleMessagesByType('infection')

  const isValid =
    mode === 'authority_notice'
      ? tab === 'sample'
        ? !!selectedId
        : manualText.trim().length >= 5
      : true // 기관 상황 모드는 메모 선택적

  function handleNext() {
    if (mode === 'authority_notice') {
      if (tab === 'sample' && selectedId) {
        const msg = sampleMessages.find((m) => m.id === selectedId)!
        onNext(msg.raw_text, 'sample')
      } else {
        onNext(manualText.trim(), 'manual')
      }
    } else {
      // 기관 내 유증상 상황 모드: 재난문자 없이 짧은 상황 메모만
      onNext(situationMemo.trim(), 'situation_only')
    }
  }

  return (
    <div className="space-y-4">
      {/* 감염병 배지 */}
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs border-amber-500 text-amber-700 bg-amber-50">
          감염병
        </Badge>
        <span className="text-xs text-muted-foreground">
          입력 방식을 선택하세요.
        </span>
      </div>

      {/* 2-모드 토글 */}
      <div className="flex rounded-lg border bg-muted p-1 gap-1">
        <button
          onClick={() => setMode('authority_notice')}
          className={`flex-1 rounded-md py-2.5 text-sm font-medium transition-colors leading-tight ${
            mode === 'authority_notice'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          보건당국 안내문자
        </button>
        <button
          onClick={() => setMode('institution_situation')}
          className={`flex-1 rounded-md py-2.5 text-sm font-medium transition-colors leading-tight ${
            mode === 'institution_situation'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          기관 내 유증상 상황
        </button>
      </div>

      {/* 모드 1: 보건당국 안내문자 */}
      {mode === 'authority_notice' && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            보건소·보건당국으로부터 수신한 안내문자를 선택하거나 직접 입력합니다.
          </p>

          {/* 서브 탭: 샘플 / 원문 입력 */}
          <div className="flex rounded-lg border bg-muted p-1 gap-1">
            <button
              onClick={() => setTab('sample')}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                tab === 'sample'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              샘플 선택
            </button>
            <button
              onClick={() => setTab('manual')}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                tab === 'manual'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              원문 붙여넣기
            </button>
          </div>

          {tab === 'sample' && (
            <div className="space-y-2">
              {sampleMessages.map((msg) => {
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
                          <Badge variant="outline" className="text-xs border-amber-500 text-amber-700">
                            보건당국 안내
                          </Badge>
                          {isSelected && (
                            <span className="ml-auto text-xs font-normal text-primary">선택됨</span>
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

          {tab === 'manual' && (
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="infection-manual-text">
                보건당국 안내문자 원문
              </label>
              <textarea
                id="infection-manual-text"
                rows={6}
                placeholder="수신한 보건당국 안내문자를 붙여넣으세요. (유아 이름 등 개인정보는 삭제 후 입력)"
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                최소 5자 이상 입력해 주세요. 유아 이름·진단명·보호자 연락처 등 개인정보는 삭제 후 붙여넣으세요.
              </p>
            </div>
          )}
        </div>
      )}

      {/* 모드 2: 기관 내 유증상 상황 입력 */}
      {mode === 'institution_situation' && (
        <div className="space-y-3">
          <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-800">
            재난문자 없이 기관 상황만으로 대응계획을 만듭니다.
            유증상 유아 수 등 집계 정보를 간단히 메모하세요.
            이름·진단명·질병명은 입력하지 않습니다.
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="situation-memo">
              현재 기관 상황 메모 <span className="font-normal text-muted-foreground">(선택)</span>
            </label>
            <textarea
              id="situation-memo"
              rows={4}
              placeholder="예) 오전 발열 유아 2명, 구토 1명. 같은 반에서 어제부터 증상 반복 (이름·진단명 기재 금지)"
              value={situationMemo}
              onChange={(e) => setSituationMemo(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              이름·진단명·질병명은 입력하지 않습니다. 숫자·상황·방식 등 집계 정보만 기재하세요.
            </p>
          </div>
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

// ── 폭염·집중호우 단일 모드 입력 ─────────────────────────────────────────────

export function MessageInput() {
  const router = useRouter()
  const { get, update } = useWizardState()
  const draft = get()

  const disasterType: DisasterType = draft.disaster_type ?? 'heatwave'
  const sampleMessages = getSampleMessages(disasterType)

  const [tab, setTab] = useState<Tab>('sample')
  const [selectedId, setSelectedId] = useState<string | null>(draft.disaster_message_id)
  const [manualText, setManualText] = useState(
    draft.disaster_message_source === 'manual' ? draft.disaster_message_text : ''
  )
  const [apiItems, setApiItems] = useState<DisasterSmsItem[]>([])
  const [apiLoading, setApiLoading] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [apiSelectedId, setApiSelectedId] = useState<string | null>(null)

  // ── 감염병은 2-모드 컴포넌트로 분기 ──────────────────────────────────────
  if (disasterType === 'infection') {
    const handleInfectionNext = (
      text: string,
      source: 'sample' | 'manual' | 'situation_only'
    ) => {
      update({
        disaster_message_id: null,
        disaster_message_text: text,
        disaster_message_source: source === 'situation_only' ? 'manual' : source,
        disaster_message_issued_at: null,
      })
      router.push('/plan/new/situation')
    }
    return <InfectionModeInput onNext={handleInfectionNext} />
  }

  // ── 폭염·집중호우 단일 모드 ───────────────────────────────────────────────

  const isValid =
    tab === 'sample'
      ? !!selectedId
      : tab === 'api'
        ? !!apiSelectedId
        : manualText.trim().length >= 5

  async function handleFetchApi() {
    setApiLoading(true)
    setApiError(null)
    try {
      const url = `/api/external/disaster-sms?disaster_type=${disasterType}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('fetch failed')
      const json = await res.json()
      setApiItems(json.data ?? [])
      if (json.data?.length === 0) setApiError('현재 조회된 재난문자가 없습니다.')
    } catch {
      setApiError('재난문자 조회에 실패했습니다. 샘플을 사용해 주세요.')
    } finally {
      setApiLoading(false)
    }
  }

  function handleNext() {
    if (tab === 'api' && apiSelectedId) {
      const msg = apiItems.find((m) => m.id === apiSelectedId)!
      update({
        disaster_message_id: null,
        disaster_message_text: msg.raw_text,
        disaster_message_source: 'api',
        disaster_message_issued_at: msg.issued_at,
      })
      router.push('/plan/new/situation')
      return
    }
    if (tab === 'sample' && selectedId) {
      const msg = sampleMessages.find((m) => m.id === selectedId)!
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

  const disasterLabel = disasterType === 'heavy_rain' ? '집중호우' : '폭염'

  return (
    <div className="space-y-4">
      {/* 재난유형 안내 배지 */}
      <div className="flex items-center gap-2">
        <Badge variant={disasterType === 'heavy_rain' ? 'secondary' : 'destructive'} className="text-xs">
          {disasterLabel}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {disasterLabel} 관련 재난문자를 선택하세요.
        </span>
      </div>

      {/* 탭 전환 */}
      <div className="flex rounded-lg border bg-muted p-1">
        {(
          [
            { key: 'sample', label: '샘플 선택' },
            { key: 'api', label: '실시간 조회' },
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
          {sampleMessages.map((msg) => {
            const intensity = getIntensityConfig(disasterType, msg.id)
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
                        <span className="ml-auto text-xs font-normal text-primary">선택됨</span>
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

      {/* 실시간 API 조회 탭 */}
      {tab === 'api' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              행안부 재난문자 API에서 최근 {disasterLabel} 문자를 조회합니다.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleFetchApi}
              disabled={apiLoading}
              className="shrink-0"
            >
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
                  <button key={msg.id} onClick={() => setApiSelectedId(msg.id)} className="w-full text-left">
                    <Card
                      className={`cursor-pointer transition-all ${
                        isSelected
                          ? 'border-primary ring-2 ring-primary ring-offset-1'
                          : 'hover:border-muted-foreground/40'
                      }`}
                    >
                      <CardHeader className="pb-1 pt-3">
                        <CardTitle className="flex items-center gap-2 text-sm">
                          <Badge variant="secondary" className="text-xs">재난문자</Badge>
                          {msg.source === 'sample' && (
                            <Badge variant="outline" className="text-xs">샘플</Badge>
                          )}
                          {isSelected && (
                            <span className="ml-auto text-xs font-normal text-primary">선택됨</span>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pb-3">
                        <p className="text-xs leading-relaxed text-muted-foreground line-clamp-3">{msg.raw_text}</p>
                        {msg.issued_at && (
                          <p className="mt-1 text-xs text-muted-foreground/70">{msg.issued_at}</p>
                        )}
                      </CardContent>
                    </Card>
                  </button>
                )
              })}
            </div>
          )}
          {apiItems.length === 0 && !apiLoading && !apiError && (
            <p className="rounded-md bg-muted px-3 py-6 text-center text-sm text-muted-foreground">
              '가져오기' 버튼을 눌러 최근 {disasterLabel} 재난문자를 조회하세요.
            </p>
          )}
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
