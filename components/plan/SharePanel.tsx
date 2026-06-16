'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface ShareTab {
  key: string
  label: string
}

interface SharePanelProps {
  requestId: string
  tabs: ShareTab[]
}

export function SharePanel({ requestId, tabs }: SharePanelProps) {
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)

  async function ensureToken(): Promise<string | null> {
    if (token) return token
    setLoading(true)
    try {
      const res = await fetch(`/api/plan/${requestId}/share`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok || !json?.data?.token) {
        toast.error(json?.error ?? '공유 링크 생성에 실패했습니다.')
        return null
      }
      setToken(json.data.token)
      return json.data.token as string
    } catch {
      toast.error('네트워크 오류가 발생했습니다.')
      return null
    } finally {
      setLoading(false)
    }
  }

  function shareUrl(t: string, roleKey: string): string {
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    return `${base}/share/${t}/${roleKey}`
  }

  async function handleCopy(roleKey: string) {
    const t = await ensureToken()
    if (!t) return
    try {
      await navigator.clipboard.writeText(shareUrl(t, roleKey))
      toast.success('링크가 복사되었습니다.')
    } catch {
      toast.error('복사에 실패했습니다.')
    }
  }

  async function handleSend() {
    const t = await ensureToken()
    if (!t) return
    setSending(true)
    try {
      const res = await fetch(`/api/plan/${requestId}/notify`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json?.error ?? '발송에 실패했습니다.')
        return
      }
      const { sent = 0, skipped = 0, source } = json.data ?? {}
      toast.success(
        source === 'sample'
          ? `발송 시뮬레이션 완료 (${sent}건). 실제 발송은 키 설정 후 동작합니다.`
          : `${sent}명에게 발송했습니다.${skipped ? ` (수신동의 없음 ${skipped}건 제외)` : ''}`
      )
    } catch {
      toast.error('네트워크 오류가 발생했습니다.')
    } finally {
      setSending(false)
    }
  }

  return (
    <Card className="print:hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">담당자에게 공유</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {tabs.map((tab) => (
            <Button
              key={tab.key}
              variant="outline"
              size="sm"
              onClick={() => handleCopy(tab.key)}
              disabled={loading}
              className="justify-start text-xs"
            >
              🔗 {tab.label} 링크 복사
            </Button>
          ))}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="secondary" className="flex-1 min-h-[44px]" onClick={() => window.print()}>
            🖨️ 출력 / PDF 저장
          </Button>
          <Button className="flex-1 min-h-[44px]" onClick={handleSend} disabled={sending}>
            {sending ? '발송 중…' : '📨 담당자에게 발송 (문자·알림톡)'}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          등록된 역할별 담당자 연락처와 수신 동의를 기준으로 발송됩니다. 발송 내용에 유아 개인정보는 포함되지 않습니다.
        </p>
      </CardContent>
    </Card>
  )
}
