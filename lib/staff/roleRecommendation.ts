/**
 * lib/staff/roleRecommendation.ts
 *
 * 재원 유아수 및 staff_profile 기반 역할 추천 로직.
 *
 * 설계 원칙 (계획 §4, §3c):
 * - 순수 함수 — 외부 의존 없음, 테스트 용이.
 * - 법적 단정 금지: 'check_required' 항목은 반드시 "…확인이 필요합니다" 표현.
 *   배치 의무를 앱이 확정하지 않는다. 공식기관 기준을 직접 확인하도록 안내.
 * - 근거(basis) 표시 허용: 어린이집 100명+ 간호사, 40명+ 조리원만.
 *   그 외 'check_required' 항목에는 basis를 "기준 확인 필요" 표현으로만.
 * - PII 없음: 집계값(숫자)·boolean·유형만 입력받음. 이름·연락처 없음.
 *
 * 법적 disclaimer:
 * 이 로직은 기관 입력 정보를 바탕으로 배치 기준 확인을 제안하는 참고용 도구입니다.
 * 실제 법적 의무 여부는 관할 지자체 및 관련 기관에 직접 확인하십시오.
 */

import type { InstitutionType } from '@/lib/types/db'
import type { StaffProfile } from '@/lib/staff/types'

// ── 출력 타입 ─────────────────────────────────────────────────────────────────

export type RecommendationLevel =
  | 'recommended'     // 권장 — 기관 상황에 맞게 검토
  | 'default_active'  // 기본 활성화 — 해당 기준 충족 시 기본으로 활성
  | 'check_required'  // 배치 기준 확인 필요 — 법적 판단은 앱이 확정하지 않음

export type RoleRecommendationKey =
  | 'cook_or_food_service'
  | 'health_manager'
  | 'collective_food_service'
  | 'food_nutrition'
  | 'health_teacher_multi'

export interface RoleRecommendation {
  /** 추천 대상 역할/항목 식별자 */
  role: RoleRecommendationKey
  /** 추천 수준 */
  level: RecommendationLevel
  /**
   * 사용자에게 표시할 안내 문구.
   * 'check_required'는 반드시 "…기준 확인이 필요합니다" 형태.
   * 법적 의무 단정 표현 금지.
   */
  message: string
  /**
   * 근거 표시 (어린이집 100명+ 간호사·40명+ 조리원만 허용).
   * 그 외는 undefined. 앱이 법적 판단을 확정하지 않도록 제한.
   */
  basis?: string
}

// ── 입력 타입 ─────────────────────────────────────────────────────────────────

export interface RoleRecommendationInput {
  /** 기관 유형: 어린이집 또는 유치원 */
  institution_type: InstitutionType
  /**
   * 기관 설립 유형 (유치원 전용).
   * 'public'=국공립, 'private'=사립. 미입력 시 undefined.
   */
  kindergarten_ownership?: 'public' | 'private'
  /** 현재 재원 유아 총수 (집계값만) */
  total_children?: number | null
  /** 급식·보건 인력 프로필 (부분 입력 허용) */
  staff_profile?: Partial<StaffProfile>
}

// ── 핵심 로직 ─────────────────────────────────────────────────────────────────

/**
 * 재원 유아수·기관유형·staff_profile 기반 역할 추천 배열 반환.
 *
 * 규칙 (계획 §4 역할 추천 로직):
 *
 * [어린이집]
 * 1. 현원 40명 이상 → 조리원/급식담당자 'default_active' (근거 표시 허용)
 * 2. 현원 100명 이상 → 간호사/보건담당자 'default_active' (근거 표시 허용)
 *                    + 영양사/급식관리 'check_required'
 * 3. 1회 급식 50명 이상 → 집단급식소·조리사 기준 'check_required'
 *
 * [유치원]
 * 4. 국공립 → 급식·영양 담당자 'check_required'
 * 5. 사립 현원 100명 이상 → 영양사/영양교사 'check_required'
 * 6. 학급 수 36 이상 → 보건교사 2인 이상 'check_required'
 *
 * 표현 원칙:
 * - 'check_required' 메시지: "…배치 기준 확인이 필요합니다"
 * - 'default_active' 메시지: "…기준에 해당하여 기본 활성화됩니다"
 * - 'recommended' 메시지: "…배치가 권장됩니다"
 * - 어린이집 40명+ 조리원, 100명+ 간호사만 basis 표시.
 *
 * @param input 기관 유형·현원·staff_profile
 * @returns RoleRecommendation 배열 (해당 없으면 빈 배열)
 */
export function getRoleRecommendations(
  input: RoleRecommendationInput
): RoleRecommendation[] {
  const {
    institution_type,
    kindergarten_ownership,
    total_children,
    staff_profile = {},
  } = input

  const count = total_children ?? 0
  const recommendations: RoleRecommendation[] = []

  // ── 어린이집 규칙 ────────────────────────────────────────────────────────
  if (institution_type === 'daycare') {
    // 규칙 1: 현원 40명 이상 → 조리원/급식담당자 기본 활성화
    // 근거: 영유아보육법 시행규칙 상 어린이집 조리원 배치 기준(40명 이상) 참조
    if (count >= 40) {
      recommendations.push({
        role: 'cook_or_food_service',
        level: 'default_active',
        message: `현원 ${count}명으로 조리원/급식담당자 역할이 기본 활성화됩니다. 실제 인원 배치를 확인하세요.`,
        basis: '어린이집 현원 40명 이상 조리원 배치 기준',
      })
    } else if (count > 0) {
      // 40명 미만이어도 급식을 제공한다면 권장
      recommendations.push({
        role: 'cook_or_food_service',
        level: 'recommended',
        message: `현원 ${count}명으로 조리원/급식담당자 배치가 권장됩니다. 급식 제공 여부를 확인하세요.`,
      })
    }

    // 규칙 2: 현원 100명 이상 → 간호사/보건담당자 기본 활성화 + 영양사 확인 필요
    // 근거: 영유아보육법 시행규칙 상 어린이집 간호사/간호조무사 배치 기준(100명 이상) 참조
    if (count >= 100) {
      recommendations.push({
        role: 'health_manager',
        level: 'default_active',
        message: `현원 ${count}명으로 간호사/보건담당자 역할이 기본 활성화됩니다. 실제 인원 배치를 확인하세요.`,
        basis: '어린이집 현원 100명 이상 간호사/간호조무사 배치 기준',
      })
      recommendations.push({
        role: 'food_nutrition',
        level: 'check_required',
        // 법적 단정 금지: "의무입니다"가 아닌 "확인이 필요합니다"
        message: `현원 ${count}명으로 영양사/급식관리 담당자 배치 기준 확인이 필요합니다. 관할 지자체에 문의하세요.`,
      })
    }

    // 규칙 3: 1회 급식 제공 인원 50명 이상 → 집단급식소·조리사 기준 확인
    const mealCount = staff_profile.meal_count_per_serving ?? 0
    if (mealCount >= 50) {
      recommendations.push({
        role: 'collective_food_service',
        level: 'check_required',
        // 법적 단정 금지
        message: `1회 급식 제공 인원 ${mealCount}명으로 집단급식소 신고 및 조리사 배치 기준 확인이 필요합니다. 관할 기관에 문의하세요.`,
      })
    }
  }

  // ── 유치원 규칙 ──────────────────────────────────────────────────────────
  if (institution_type === 'kindergarten') {
    // 규칙 4: 국공립 유치원 → 급식·영양 담당자 확인 필요
    if (kindergarten_ownership === 'public') {
      recommendations.push({
        role: 'food_nutrition',
        level: 'check_required',
        // 법적 단정 금지
        message: '국공립 유치원의 급식·영양 담당자 배치 기준 확인이 필요합니다. 관할 교육청에 문의하세요.',
      })
      // 국공립은 급식담당자도 활성화 권장
      recommendations.push({
        role: 'cook_or_food_service',
        level: 'recommended',
        message: '국공립 유치원으로 조리사/급식담당자 배치가 권장됩니다.',
      })
    }

    // 규칙 5: 사립 유치원 현원 100명 이상 → 영양사/영양교사 확인 필요
    if (kindergarten_ownership === 'private' && count >= 100) {
      recommendations.push({
        role: 'food_nutrition',
        level: 'check_required',
        // 법적 단정 금지
        message: `사립 유치원 현원 ${count}명으로 영양사/영양교사 배치 기준 확인이 필요합니다. 관할 교육청에 문의하세요.`,
      })
    }

    // 규칙 6: 학급 수 36 이상 → 보건교사 2인 이상 확인 필요
    // 주의: 보건교사 배치는 100명 기준으로 단정하지 말 것 (계획 §4 명시)
    const classCount = staff_profile.kindergarten_class_count ?? 0
    if (classCount >= 36) {
      recommendations.push({
        role: 'health_teacher_multi',
        level: 'check_required',
        // 법적 단정 금지: "의무입니다" 금지, 기준 확인 표현
        message: `학급 수 ${classCount}개로 보건교사 2인 이상 배치 기준 확인이 필요합니다. 관할 교육청에 문의하세요.`,
      })
    }

    // 유치원 급식 인원 50명+ 집단급식소 확인
    const mealCount = staff_profile.meal_count_per_serving ?? 0
    if (mealCount >= 50) {
      recommendations.push({
        role: 'collective_food_service',
        level: 'check_required',
        // 법적 단정 금지
        message: `1회 급식 제공 인원 ${mealCount}명으로 집단급식소 신고 및 조리사 배치 기준 확인이 필요합니다. 관할 기관에 문의하세요.`,
      })
    }
  }

  return recommendations
}

// ── 케이스 검증용 주석 (빌드 시 제거됨) ──────────────────────────────────────
/*
 * 주요 케이스 예상 결과:
 *
 * Case A: 어린이집, 현원 40명
 *   getRoleRecommendations({ institution_type: 'daycare', total_children: 40 })
 *   → [{ role: 'cook_or_food_service', level: 'default_active', basis: '어린이집 현원 40명 이상 조리원 배치 기준' }]
 *
 * Case B: 어린이집, 현원 100명
 *   getRoleRecommendations({ institution_type: 'daycare', total_children: 100 })
 *   → [
 *       { role: 'cook_or_food_service', level: 'default_active', basis: '어린이집 현원 40명 이상 조리원 배치 기준' },
 *       { role: 'health_manager',       level: 'default_active', basis: '어린이집 현원 100명 이상 간호사/간호조무사 배치 기준' },
 *       { role: 'food_nutrition',       level: 'check_required' }
 *     ]
 *
 * Case C: 유치원 사립, 현원 100명
 *   getRoleRecommendations({ institution_type: 'kindergarten', kindergarten_ownership: 'private', total_children: 100 })
 *   → [{ role: 'food_nutrition', level: 'check_required', message: '...영양사/영양교사 배치 기준 확인이 필요합니다...' }]
 *
 * Case D: 유치원, 36학급
 *   getRoleRecommendations({ institution_type: 'kindergarten', staff_profile: { kindergarten_class_count: 36 } })
 *   → [{ role: 'health_teacher_multi', level: 'check_required', message: '...보건교사 2인 이상 배치 기준 확인이 필요합니다...' }]
 *
 * Case E: 어린이집, 1회 급식 50명
 *   getRoleRecommendations({ institution_type: 'daycare', staff_profile: { meal_count_per_serving: 50 } })
 *   → 포함: { role: 'collective_food_service', level: 'check_required', message: '...집단급식소 신고 및 조리사 배치 기준 확인이 필요합니다...' }
 *
 * 표현 확인:
 * - 'check_required' 메시지: 전부 "…확인이 필요합니다" 형태. "의무입니다" 없음.
 * - 보건교사 배치는 100명 기준으로 단정하지 않음 (규칙 6은 학급수 36 기준만).
 * - 어린이집 40명/100명 케이스에만 basis 표시. 그 외 basis=undefined.
 */
