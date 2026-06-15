'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SafetyNotice } from '@/components/common/SafetyNotice'
import { FallbackBadge } from '@/components/common/FallbackBadge'
import { ChecklistCard } from './ChecklistCard'
import { ParentNoticeCard } from './ParentNoticeCard'
import type { ActionRequest, ChecklistRole } from '@/lib/types/db'

type Tab = ChecklistRole | 'parent'

const TABS: { key: Tab; label: string }[] = [
  { key: 'director', label: '원장' },
  { key: 'teacher', label: '담임교사' },
  { key: 'shuttle', label: '통학버스' },
  { key: 'parent', label: '학부모 안내문' },
]

const PRIORITY_CONFIG = {
  high: { label: '대응 우선순위: 높음', className: 'bg-destructive text-destructive-foreground' },
  medium: { label: '대응 우선순위: 중간', className: 'bg-yellow-500 text-white' },
  low: { label: '대응 우선순위: 낮음', className: 'bg-green-600 text-white' },
} as const

interface ChecklistItemData {
  id: string
  content: string
  is_done: boolean
  role: ChecklistRole
}

interface PlanResultProps {
  request: ActionRequest
  institutionName: string
  checklistItems: ChecklistItemData[]
}

export function PlanResult({ request, institutionName, checklistItems }: PlanResultProps) {
  const [activeTab, setActiveTab] = useState<Tab>('director')
  const result = request.result_json
  const pConfig = PRIORITY_CONFIG[result.priority]

  const itemsByRole = (role: ChecklistRole) =>
    checklistItems.filter((it) => it.role === role)

  return (
    <div className="space-y-4">
      {/* 우선순위 배지 + fallback 배지 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${pConfig.className}`}>
          {pConfig.label}
        </span>
        <FallbackBadge isFallback={request.is_fallback} />
      </div>

      {/* 기관명 */}
      <p className="text-sm text-muted-foreground">{institutionName}</p>

      {/* 재난문자 요약 */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-sm">재난문자 요약</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{result.disaster_summary}</p>
          <p className="mt-2 text-xs text-muted-foreground">{result.priority_reason}</p>
        </CardContent>
      </Card>

      {/* 반영된 근거 */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-sm">반영된 근거</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {result.reflected_evidence.map((e, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className="mt-0.5 shrink-0 text-primary">•</span>
              <span>{e}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 부족한 정보 */}
      {result.missing_info.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-amber-800">추가로 확인이 필요한 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {result.missing_info.map((m, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-amber-800">
                <span className="mt-0.5 shrink-0">!</span>
                <span>{m}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 역할 탭 */}
      <div>
        <div className="mb-3 flex overflow-x-auto rounded-lg border bg-muted p-1 gap-1">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'director' && (
          <ChecklistCard
            requestId={request.id}
            role="director"
            items={itemsByRole('director')}
          />
        )}
        {activeTab === 'teacher' && (
          <ChecklistCard
            requestId={request.id}
            role="teacher"
            items={itemsByRole('teacher')}
          />
        )}
        {activeTab === 'shuttle' && (
          <ChecklistCard
            requestId={request.id}
            role="shuttle"
            items={itemsByRole('shuttle')}
          />
        )}
        {activeTab === 'parent' && (
          <ParentNoticeCard text={result.parent_notice} />
        )}
      </div>

      {/* 응급 안내 */}
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-4">
          <p className="text-xs leading-relaxed text-red-800">{result.emergency_contact_guide}</p>
        </CardContent>
      </Card>

      {/* 공식기관 우선 안내 */}
      <Card>
        <CardContent className="pt-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            {result.official_priority_notice}
          </p>
        </CardContent>
      </Card>

      {/* SafetyNotice 고정 문구 */}
      <SafetyNotice />

      {/* 사후기록 작성 */}
      <Link href={`/plan/${request.id}/after-action`}>
        <Button variant="outline" className="w-full min-h-[48px]">
          사후기록 작성하기
        </Button>
      </Link>
    </div>
  )
}
