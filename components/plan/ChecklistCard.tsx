'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ChecklistRole } from '@/lib/types/db'

interface ChecklistItem {
  id: string
  content: string
  is_done: boolean
}

interface ChecklistCardProps {
  requestId: string
  role: ChecklistRole
  items: ChecklistItem[]
}

const ROLE_LABELS: Record<ChecklistRole, string> = {
  director: '원장',
  teacher: '담임교사',
  shuttle: '통학버스 담당자',
}

export function ChecklistCard({ requestId, role, items: initialItems }: ChecklistCardProps) {
  const [items, setItems] = useState(initialItems)

  async function toggle(id: string) {
    // 낙관적 업데이트
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, is_done: !it.is_done } : it))
    )
    const item = items.find((it) => it.id === id)
    if (!item) return

    // 백그라운드 DB 저장 (실패해도 로컬 상태 유지)
    fetch(`/api/plan/${requestId}/checklist/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_done: !item.is_done }),
    }).catch(() => {})
  }

  const doneCount = items.filter((i) => i.is_done).length
  const total = items.length

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span>{ROLE_LABELS[role]} 체크리스트</span>
          <span className="text-xs font-normal text-muted-foreground">
            {doneCount}/{total} 완료
          </span>
        </CardTitle>
        {/* 진행률 바 */}
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: total > 0 ? `${(doneCount / total) * 100}%` : '0%' }}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-1">
        {items.map((item, i) => (
          <button
            key={item.id}
            onClick={() => toggle(item.id)}
            className={`flex w-full min-h-[44px] items-start gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted ${
              item.is_done ? 'opacity-60' : ''
            }`}
            aria-pressed={item.is_done}
          >
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs transition-colors ${
                item.is_done
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border'
              }`}
              aria-hidden="true"
            >
              {item.is_done ? '✓' : i + 1}
            </span>
            <span
              className={`leading-snug ${item.is_done ? 'line-through text-muted-foreground' : ''}`}
            >
              {item.content}
            </span>
          </button>
        ))}
      </CardContent>
    </Card>
  )
}
