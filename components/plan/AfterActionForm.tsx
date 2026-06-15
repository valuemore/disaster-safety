'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

interface AiDraft {
  outdoor_adjusted: string | null
  cooling_checked: string | null
  child_health_issue: string | null
  parents_notified: string | null
  shuttle_checked: string | null
  notes: string
  improvement: string
}

interface AfterActionFormProps {
  requestId: string
  aiDraft: AiDraft
  hasShuttle: boolean
}

interface FormState {
  message_checked_at: string
  outdoor_adjusted: boolean | null
  cooling_checked: boolean | null
  child_health_issue: boolean | null
  parents_notified: boolean | null
  shuttle_checked: boolean | null
  completed_by: string
  notes: string
  improvement: string
}

// AI 초안의 문자열로 boolean 초기값 추론 (non-null → 조치됨으로 간주)
function inferBool(draftValue: string | null): boolean | null {
  if (draftValue === null) return null
  return true
}

function nowIso(): string {
  return new Date().toISOString().slice(0, 16) // datetime-local 형식
}

interface ToggleFieldProps {
  label: string
  hint: string | null
  value: boolean | null
  onChange: (v: boolean | null) => void
}

function ToggleField({ label, hint, value, onChange }: ToggleFieldProps) {
  return (
    <div className="space-y-1">
      <div className="flex min-h-[44px] items-center justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <div className="flex gap-1.5">
          {(['예', '아니요'] as const).map((opt) => {
            const isYes = opt === '예'
            const isActive = value === (isYes ? true : false)
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onChange(isActive ? null : isYes ? true : false)}
                className={`rounded-md border px-3 py-1 text-xs transition-colors ${
                  isActive
                    ? isYes
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-destructive bg-destructive text-destructive-foreground'
                    : 'border-border hover:bg-muted'
                }`}
              >
                {opt}
              </button>
            )
          })}
        </div>
      </div>
      {hint && (
        <p className="text-xs text-muted-foreground pl-0.5">
          AI 초안: {hint}
        </p>
      )}
    </div>
  )
}

export function AfterActionForm({ requestId, aiDraft, hasShuttle }: AfterActionFormProps) {
  const router = useRouter()
  const [form, setForm] = useState<FormState>({
    message_checked_at: nowIso(),
    outdoor_adjusted: inferBool(aiDraft.outdoor_adjusted),
    cooling_checked: inferBool(aiDraft.cooling_checked),
    child_health_issue: inferBool(aiDraft.child_health_issue),
    parents_notified: inferBool(aiDraft.parents_notified),
    shuttle_checked: hasShuttle ? inferBool(aiDraft.shuttle_checked) : null,
    completed_by: '',
    notes: aiDraft.notes ?? '',
    improvement: aiDraft.improvement ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  function setField<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`/api/plan/${requestId}/after-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          message_checked_at: form.message_checked_at
            ? new Date(form.message_checked_at).toISOString()
            : null,
          completed_by: form.completed_by || null,
          notes: form.notes || null,
          improvement: form.improvement || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? '저장 실패')
        return
      }
      setSaved(true)
      toast.success('사후기록이 저장되었습니다.')
    } catch {
      toast.error('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (saved) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
        <p className="text-lg font-semibold text-green-800">✓ 사후기록 저장 완료</p>
        <p className="mt-1 text-sm text-green-700">수고하셨습니다. 오늘도 안전한 하루였습니다.</p>
        <div className="mt-4 flex gap-2 justify-center">
          <Button variant="outline" size="sm" onClick={() => router.push(`/plan/${requestId}`)}>
            대응계획으로 돌아가기
          </Button>
          <Button size="sm" onClick={() => router.push('/')}>
            홈으로
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="space-y-4">
        {/* AI 초안 안내 */}
        <div className="rounded-md bg-primary/5 border border-primary/20 px-4 py-3 text-xs text-primary">
          공식 재난문자와 기관 입력정보를 바탕으로 AI가 초안을 자동으로 채웠습니다. 실제 조치 내용에 맞게 수정하세요.
        </div>

        {/* 재난문자 확인 시각 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">재난문자 확인 시각</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="datetime-local"
                value={form.message_checked_at}
                onChange={(e) => setField('message_checked_at', e.target.value)}
                className="flex-1 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setField('message_checked_at', nowIso())}
              >
                지금
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 조치 항목 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">조치 내용</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ToggleField
              label="실외활동 조정"
              hint={aiDraft.outdoor_adjusted}
              value={form.outdoor_adjusted}
              onChange={(v) => setField('outdoor_adjusted', v)}
            />
            <Separator />
            <ToggleField
              label="냉방 확인"
              hint={aiDraft.cooling_checked}
              value={form.cooling_checked}
              onChange={(v) => setField('cooling_checked', v)}
            />
            <Separator />
            <ToggleField
              label="유아 건강 이상 여부"
              hint={aiDraft.child_health_issue}
              value={form.child_health_issue}
              onChange={(v) => setField('child_health_issue', v)}
            />
            <Separator />
            <ToggleField
              label="학부모 안내 완료"
              hint={aiDraft.parents_notified}
              value={form.parents_notified}
              onChange={(v) => setField('parents_notified', v)}
            />
            {hasShuttle && (
              <>
                <Separator />
                <ToggleField
                  label="통학버스 확인"
                  hint={aiDraft.shuttle_checked}
                  value={form.shuttle_checked}
                  onChange={(v) => setField('shuttle_checked', v)}
                />
              </>
            )}
          </CardContent>
        </Card>

        {/* 조치 완료자 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">조치 완료자</CardTitle>
          </CardHeader>
          <CardContent>
            <input
              type="text"
              placeholder="직함 또는 역할 (예: 원장, 담임교사) — 실명 지양"
              value={form.completed_by}
              onChange={(e) => setField('completed_by', e.target.value)}
              maxLength={100}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </CardContent>
        </Card>

        {/* 특이사항 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">특이사항</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              rows={4}
              value={form.notes}
              onChange={(e) => setField('notes', e.target.value)}
              maxLength={2000}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="mt-1 text-xs text-destructive">
              ※ 개인 이름·연락처·진단명은 입력하지 않습니다.
            </p>
          </CardContent>
        </Card>

        {/* 개선 필요사항 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">개선 필요사항</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              rows={3}
              value={form.improvement}
              onChange={(e) => setField('improvement', e.target.value)}
              maxLength={2000}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </CardContent>
        </Card>

        <Button
          type="submit"
          className="w-full min-h-[48px] text-base"
          disabled={loading}
        >
          {loading ? '저장 중...' : '사후기록 저장하기'}
        </Button>

        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() => router.back()}
        >
          취소 — 대응계획으로 돌아가기
        </Button>
      </div>
    </form>
  )
}
