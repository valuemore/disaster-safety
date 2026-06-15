'use client'

/**
 * components/institutions/RoleRecommendationPanel.tsx
 *
 * 재원 유아수·기관유형·staff_profile 기반 역할 추천 문구 표시 패널.
 *
 * 표현 원칙 (계획 §4, roleRecommendation.ts):
 * - roleRecommendation의 message를 그대로 표시 — 앱이 법적 의무를 단정하지 않는 톤.
 * - 상단에 보조 안내 1줄: "법적 배치 기준은 관할 지자체·교육청 확인이 필요합니다"
 * - level별 시각 구분:
 *   - default_active: 초록 강조 (기본 활성)
 *   - recommended: 파랑 (권장)
 *   - check_required: 앰버 (확인 필요)
 *
 * PII 없음: 집계값(숫자)·boolean·유형만 수신.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { RoleRecommendation, RecommendationLevel } from '@/lib/staff/roleRecommendation'

// ── 레벨별 스타일 매핑 ────────────────────────────────────────────────────────

const LEVEL_STYLES: Record<
  RecommendationLevel,
  { border: string; bg: string; badge: string; badgeText: string; icon: string }
> = {
  default_active: {
    border: 'border-green-300',
    bg: 'bg-green-50',
    badge: 'bg-green-100 text-green-800',
    badgeText: '기본 활성',
    icon: 'text-green-600',
  },
  recommended: {
    border: 'border-blue-300',
    bg: 'bg-blue-50',
    badge: 'bg-blue-100 text-blue-800',
    badgeText: '권장',
    icon: 'text-blue-600',
  },
  check_required: {
    border: 'border-amber-300',
    bg: 'bg-amber-50',
    badge: 'bg-amber-100 text-amber-800',
    badgeText: '확인 필요',
    icon: 'text-amber-600',
  },
}

const ROLE_LABELS: Record<string, string> = {
  cook_or_food_service: '조리사/급식담당자',
  health_manager: '보건담당자',
  collective_food_service: '집단급식소',
  food_nutrition: '영양사/영양교사',
  health_teacher_multi: '보건교사 다인 배치',
}

// ── 서브컴포넌트: 개별 추천 항목 ─────────────────────────────────────────────

function RecommendationItem({ rec }: { rec: RoleRecommendation }) {
  const styles = LEVEL_STYLES[rec.level]
  const roleLabel = ROLE_LABELS[rec.role] ?? rec.role

  return (
    <div
      className={`rounded-md border p-3 ${styles.border} ${styles.bg}`}
      role="listitem"
    >
      <div className="flex flex-wrap items-start gap-2">
        <span className={`inline-flex shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${styles.badge}`}>
          {styles.badgeText}
        </span>
        <span className="text-xs font-semibold text-foreground">{roleLabel}</span>
      </div>
      <p className="mt-1.5 text-sm leading-snug text-foreground">{rec.message}</p>
      {rec.basis && (
        <p className="mt-1 text-xs text-muted-foreground">
          근거: {rec.basis}
        </p>
      )}
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

interface RoleRecommendationPanelProps {
  recommendations: RoleRecommendation[]
  /** 패널을 카드로 감쌀지 여부 (기본 true) */
  withCard?: boolean
}

export function RoleRecommendationPanel({
  recommendations,
  withCard = true,
}: RoleRecommendationPanelProps) {
  if (recommendations.length === 0) return null

  const content = (
    <div className="space-y-2">
      {/* 법적 단정 금지 보조 안내 */}
      <p className="text-xs text-muted-foreground leading-snug">
        법적 배치 기준은 관할 지자체·교육청 확인이 필요합니다. 아래 항목은 기관 입력정보 기반 참고 안내입니다.
      </p>
      <div role="list" className="space-y-2">
        {recommendations.map((rec, i) => (
          <RecommendationItem key={`${rec.role}-${i}`} rec={rec} />
        ))}
      </div>
    </div>
  )

  if (!withCard) return content

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">역할 배치 기준 안내</CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  )
}
