'use client'

/**
 * components/institutions/StaffRecommendationSection.tsx
 *
 * 기관 프로필 페이지에서 staff_profile 기반 역할 추천을 표시하는 클라이언트 컴포넌트.
 * 서버에서 Institution 데이터를 받아 클라이언트에서 getRoleRecommendations를 호출한다.
 *
 * PII 없음: Institution의 집계값(total_children, type)과 staff_profile만 사용.
 */

import { getRoleRecommendations } from '@/lib/staff/roleRecommendation'
import { RoleRecommendationPanel } from '@/components/institutions/RoleRecommendationPanel'
import type { Institution } from '@/lib/types/db'
import type { StaffProfile } from '@/lib/staff/types'

interface StaffRecommendationSectionProps {
  institution: Pick<Institution, 'type' | 'total_children' | 'staff_profile'>
}

export function StaffRecommendationSection({ institution }: StaffRecommendationSectionProps) {
  const staffProfile = institution.staff_profile as StaffProfile | undefined

  // 유치원 설립 유형은 staff_profile에 저장되지 않으므로 undefined 처리
  // (InstitutionForm에서는 실시간 계산 시 kindergarten_ownership 포함)
  const recommendations = getRoleRecommendations({
    institution_type: institution.type,
    total_children: institution.total_children,
    staff_profile: staffProfile ?? {},
  })

  if (recommendations.length === 0) return null

  return (
    <div className="mt-6">
      <RoleRecommendationPanel recommendations={recommendations} />
    </div>
  )
}
