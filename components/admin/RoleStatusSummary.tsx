/**
 * components/admin/RoleStatusSummary.tsx
 *
 * 기관의 staff_profile 기반 역할 추천 결과를 요약 배지로 표시.
 * getRoleRecommendations() 호출만 — 로직 수정 없음.
 *
 * 법적 단정 금지: "확인 필요" 등 표현만 사용 (roleRecommendation.ts 원칙 상속).
 */

import {
  getRoleRecommendations,
  type RoleRecommendation,
  type RoleRecommendationKey,
} from '@/lib/staff/roleRecommendation'
import type { Institution } from '@/lib/types/db'

// ── 역할 키 → 한국어 짧은 라벨 ───────────────────────────────────────────────
const ROLE_SHORT_LABEL: Record<RoleRecommendationKey, string> = {
  cook_or_food_service: '조리사/급식',
  health_manager: '보건담당자',
  collective_food_service: '집단급식소',
  food_nutrition: '영양사/영양교사',
  health_teacher_multi: '보건교사(복수)',
}

// ── 추천 수준 → 배지 스타일 ───────────────────────────────────────────────────
const LEVEL_STYLE: Record<RoleRecommendation['level'], string> = {
  default_active:
    'bg-green-50 text-green-700 border border-green-200',
  recommended:
    'bg-blue-50 text-blue-700 border border-blue-200',
  check_required:
    'bg-amber-50 text-amber-700 border border-amber-200',
}

const LEVEL_ICON: Record<RoleRecommendation['level'], string> = {
  default_active: '✓',
  recommended: '◎',
  check_required: '!',
}

interface RoleStatusSummaryProps {
  institution: Institution
}

export function RoleStatusSummary({ institution }: RoleStatusSummaryProps) {
  const input = {
    institution_type: institution.type,
    total_children: institution.total_children,
    staff_profile: institution.staff_profile ?? {},
    // 유치원 유형 정보는 staff_profile 내 없으므로 undefined 처리
    kindergarten_ownership: undefined as 'public' | 'private' | undefined,
  }

  const recommendations = getRoleRecommendations(input)

  if (recommendations.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">역할 추천 해당 없음</p>
    )
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {recommendations.map((rec) => (
        <span
          key={rec.role}
          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${LEVEL_STYLE[rec.level]}`}
          title={rec.message}
        >
          <span aria-hidden="true">{LEVEL_ICON[rec.level]}</span>
          {ROLE_SHORT_LABEL[rec.role] ?? rec.role}
          {rec.level === 'check_required' && (
            <span className="opacity-75"> 확인 필요</span>
          )}
        </span>
      ))}
    </div>
  )
}
