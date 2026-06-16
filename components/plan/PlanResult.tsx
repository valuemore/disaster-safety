'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SafetyNotice } from '@/components/common/SafetyNotice'
import { FallbackBadge } from '@/components/common/FallbackBadge'
import { ParentNoticeCard } from './ParentNoticeCard'
import { SharePanel } from './SharePanel'
import { ensureLegacyChecklists } from '@/lib/ai/legacyAdapter'
import type { ActionRequest, RoleBasedAction } from '@/lib/types/db'
import type { RoleKey } from '@/lib/disaster/types'

const PRIORITY_CONFIG = {
  high: { label: '대응 우선순위: 높음', className: 'bg-destructive text-destructive-foreground' },
  medium: { label: '대응 우선순위: 중간', className: 'bg-yellow-500 text-white' },
  low: { label: '대응 우선순위: 낮음', className: 'bg-green-600 text-white' },
} as const

interface PlanResultProps {
  request: ActionRequest
  institutionName: string
}

// 역할 탭 단위 (동적 생성용)
type TabKey = RoleKey | 'parent'

interface RoleTab {
  key: TabKey
  label: string
  // role_based_actions 에서 가져온 actions (읽기전용 렌더용)
  actions: string[]
}

/**
 * role_based_actions 배열에서 동적 역할 탭 목록을 생성한다.
 * 1) role_based_actions 순서대로 역할 탭 생성
 * 2) parent 탭 고정 추가 (마지막)
 * role_based_actions 가 없는 레거시 데이터는 레거시 3탭으로 fallback.
 */
function buildTabs(
  result: ReturnType<typeof ensureLegacyChecklists>
): RoleTab[] {
  const rba: RoleBasedAction[] = result.role_based_actions ?? []

  if (rba.length === 0) {
    // 레거시 fallback: director/teacher/shuttle 3탭 고정
    const legacyTabs: RoleTab[] = [
      { key: 'director', label: '원장', actions: result.director_checklist ?? [] },
      { key: 'homeroom_teacher', label: '담임교사', actions: result.teacher_checklist ?? [] },
      { key: 'bus_manager', label: '통학버스', actions: result.shuttle_checklist ?? [] },
    ]
    return [
      ...legacyTabs,
      { key: 'parent', label: '학부모 안내문', actions: [] },
    ]
  }

  const roleTabs: RoleTab[] = rba.map((entry) => ({
    key: entry.role as RoleKey,
    label: entry.role_label,
    actions: entry.actions,
  }))

  return [
    ...roleTabs,
    { key: 'parent', label: '학부모 안내문', actions: [] },
  ]
}

/**
 * DB ChecklistRole 매핑이 없는 역할(조리사, 보건담당자 등)의
 * actions 를 읽기전용 리스트로 표시한다.
 */
function ReadOnlyActionList({
  label,
  actions,
}: {
  label: string
  actions: string[]
}) {
  if (actions.length === 0 || (actions.length === 1 && actions[0] === '해당 없음')) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{label} 대응계획</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">이 역할에 해당하는 조치 항목이 없습니다.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{label} 체크리스트</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-1">
        {actions.map((action, i) => (
          <div
            key={i}
            className="flex min-h-[44px] items-start gap-3 rounded-md px-2 py-2 text-sm"
          >
            <span
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border text-xs"
              aria-hidden="true"
            >
              {i + 1}
            </span>
            <span className="leading-snug">{action}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function PlanResult({ request, institutionName }: PlanResultProps) {
  // ensureLegacyChecklists 로 role_based_actions → 레거시 필드 보완
  const result = ensureLegacyChecklists(request.result_json)
  const tabs = buildTabs(result)

  const [activeTab, setActiveTab] = useState<TabKey>(tabs[0]?.key ?? 'parent')
  const pConfig = PRIORITY_CONFIG[result.priority]

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

      {/* 역할 탭 (role_based_actions 기반 동적 생성) */}
      <div>
        <div className="mb-3 flex overflow-x-auto rounded-lg border bg-muted p-1 gap-1">
          {tabs.map(({ key, label }) => (
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

        {/* 탭 콘텐츠 */}
        {tabs.map((tab) => {
          if (tab.key !== activeTab) return null

          if (tab.key === 'parent') {
            return <ParentNoticeCard key="parent" text={result.parent_notice} />
          }

          // 역할별 대응계획 (읽기전용)
          return (
            <ReadOnlyActionList
              key={tab.key}
              label={tab.label}
              actions={tab.actions}
            />
          )
        })}
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

      {/* 공유 패널 (역할별 링크/인쇄/발송) */}
      <SharePanel requestId={request.id} tabs={tabs.map((t) => ({ key: t.key, label: t.label }))} />
    </div>
  )
}
