/**
 * profileMapping.ts
 * institution_risk_profiles ↔ HeatwaveProfile / HeavyRainProfile 변환 어댑터
 *
 * 보안: PII 컬럼 없음. 집계값(숫자)·boolean·enum만 다룸.
 * 단일 출처: 샘플은 lib/sample/heatwave_profiles.ts 를 그대로 사용.
 */

import type { HeatwaveProfile, InstitutionRiskProfile, PickupWaitPlace } from '@/lib/types/db'

// ── 폭염 disaster_specific JSONB 내 키 목록 ─────────────────────────────────
// 0002 마이그레이션 §g 에서 패킹한 키와 동일해야 함.
interface HeatwaveSpecific {
  heat_vulnerable_count?: number | null
  respiratory_caution_count?: number | null
  mobility_support_count?: number | null
  special_support_count?: number | null
  cooling_ok?: boolean | null
  water_supply_ok?: boolean | null
  vehicle_thermometer?: boolean | null
  pickup_wait_place?: PickupWaitPlace | null
}

/**
 * institution_risk_profiles 행(disaster_type='heatwave') →
 * 기존 HeatwaveProfile 형태로 변환.
 *
 * 공통 컬럼(thermometer, first_aid_kit, indoor_alt_space)은 직접 매핑.
 * 나머지 폭염 특수 필드는 disaster_specific JSONB에서 언패킹.
 * 누락 키는 기본값(0/false/null)으로 채움.
 */
export function riskProfileToHeatwave(row: InstitutionRiskProfile): HeatwaveProfile {
  const sp = (row.disaster_specific ?? {}) as HeatwaveSpecific

  return {
    id: row.id,
    institution_id: row.institution_id,
    // 공통 컬럼 직접 매핑
    thermometer: row.thermometer,
    first_aid_kit: row.first_aid_kit,
    indoor_alt_space: row.indoor_alt_space,
    // disaster_specific JSONB 언패킹 (누락 시 기본값)
    heat_vulnerable_count:     sp.heat_vulnerable_count     ?? 0,
    respiratory_caution_count: sp.respiratory_caution_count ?? 0,
    mobility_support_count:    sp.mobility_support_count    ?? 0,
    special_support_count:     sp.special_support_count     ?? 0,
    cooling_ok:                sp.cooling_ok                ?? true,
    water_supply_ok:           sp.water_supply_ok           ?? false,
    vehicle_thermometer:       sp.vehicle_thermometer       ?? false,
    pickup_wait_place:         sp.pickup_wait_place         ?? null,
    is_current: row.is_current,
    created_at: row.created_at,
  }
}

// ── ProfileForm 입력 타입 (profile/route.ts POST body 와 동일 구조) ──────────

export interface HeatwaveFormInput {
  heat_vulnerable_count: number
  respiratory_caution_count: number
  mobility_support_count: number
  special_support_count: number
  cooling_ok: boolean
  indoor_alt_space: boolean
  water_supply_ok: boolean
  thermometer: boolean
  first_aid_kit: boolean
  vehicle_thermometer: boolean
  pickup_wait_place: PickupWaitPlace | null
}

/**
 * ProfileForm 입력 → institution_risk_profiles INSERT 형태로 변환.
 *
 * disaster_type='heatwave' 고정.
 * 공통 컬럼(thermometer, first_aid_kit, indoor_alt_space)은 최상위 컬럼.
 * 나머지 폭염 특수 필드는 disaster_specific JSONB로 패킹.
 * is_current=true 로 INSERT → 트리거가 기존 행을 false 처리.
 */
export function heatwaveFormToRiskProfile(
  form: HeatwaveFormInput,
  institutionId: string
): {
  institution_id: string
  disaster_type: 'heatwave'
  thermometer: boolean
  first_aid_kit: boolean
  indoor_alt_space: boolean
  disaster_specific: HeatwaveSpecific
  is_current: boolean
} {
  const {
    heat_vulnerable_count,
    respiratory_caution_count,
    mobility_support_count,
    special_support_count,
    cooling_ok,
    water_supply_ok,
    vehicle_thermometer,
    pickup_wait_place,
    thermometer,
    first_aid_kit,
    indoor_alt_space,
  } = form

  return {
    institution_id: institutionId,
    disaster_type: 'heatwave',
    // 공통 컬럼
    thermometer,
    first_aid_kit,
    indoor_alt_space,
    // 폭염 특수 필드 → JSONB 패킹
    disaster_specific: {
      heat_vulnerable_count,
      respiratory_caution_count,
      mobility_support_count,
      special_support_count,
      cooling_ok,
      water_supply_ok,
      vehicle_thermometer,
      pickup_wait_place,
    },
    is_current: true,
  }
}

// ── 집중호우 프로필 타입 ─────────────────────────────────────────────────────

/**
 * 집중호우 disaster_specific JSONB 내 특수 필드
 * 계획 §6 기반: 저지대·하천인접·지하공간·출입구·하원대기·놀이터·대체공간·비상연락망·대피공간
 * PII 0건: boolean/select/집계 위주. 이름·연락처 없음.
 */
export interface HeavyRainSpecific {
  /** 저지대 위치 여부 (침수 위험 주요 지표) */
  low_ground?: boolean | null
  /** 인근 하천·배수로·급경사지 인접 여부 */
  near_stream_or_slope?: boolean | null
  /** 지하공간(지하 교실·창고·주차장 등) 보유 여부 */
  has_basement?: boolean | null
  /** 1층 출입구 구조 ('ground_level'=지면과 동일, 'raised'=지면보다 높음, 'below_grade'=지면보다 낮음) */
  entrance_type?: 'ground_level' | 'raised' | 'below_grade' | null
  /** 하원 대기 장소 ('indoor'=실내, 'covered_outdoor'=지붕있는 실외, 'open_outdoor'=노출 실외) */
  pickup_wait_area?: 'indoor' | 'covered_outdoor' | 'open_outdoor' | null
  /** 실외 놀이터 위치 ('rooftop'=옥상, 'ground_level'=지면, 'none'=없음) */
  outdoor_playground_location?: 'rooftop' | 'ground_level' | 'none' | null
  /** 통학버스 운영 여부 (기관 공통 has_shuttle 외 호우 특화 확인 목적) */
  has_shuttle?: boolean | null
  /** 대체 실내 대기공간 확보 여부 */
  has_alt_indoor_space?: boolean | null
  /** 비상연락망(재난 시 연락체계) 구비 여부 */
  has_emergency_contact_plan?: boolean | null
  /** 침수·정전 시 대피 가능 공간 확보 여부 */
  has_evacuation_space?: boolean | null
  /** 취약 유아 수(이동 지원 필요 — 집계값만, PII 없음) */
  mobility_support_count?: number | null
}

/**
 * 집중호우 HeavyRainProfile — ProfileForm 및 AI 입력에 사용하는 통합 뷰
 */
export interface HeavyRainProfile {
  id: string
  institution_id: string
  // 공통 컬럼
  thermometer: boolean
  first_aid_kit: boolean
  indoor_alt_space: boolean
  // 집중호우 특수 필드 (HeavyRainSpecific에서 언패킹)
  low_ground: boolean
  near_stream_or_slope: boolean
  has_basement: boolean
  entrance_type: 'ground_level' | 'raised' | 'below_grade' | null
  pickup_wait_area: 'indoor' | 'covered_outdoor' | 'open_outdoor' | null
  outdoor_playground_location: 'rooftop' | 'ground_level' | 'none' | null
  has_shuttle: boolean
  has_alt_indoor_space: boolean
  has_emergency_contact_plan: boolean
  has_evacuation_space: boolean
  mobility_support_count: number
  is_current: boolean
  created_at: string
}

/**
 * institution_risk_profiles 행(disaster_type='heavy_rain') →
 * HeavyRainProfile 형태로 변환.
 *
 * 공통 컬럼(thermometer, first_aid_kit, indoor_alt_space)은 직접 매핑.
 * 나머지 집중호우 특수 필드는 disaster_specific JSONB에서 언패킹.
 * 누락 키는 안전 기본값으로 채움.
 */
export function riskProfileToHeavyRain(row: InstitutionRiskProfile): HeavyRainProfile {
  const sp = (row.disaster_specific ?? {}) as HeavyRainSpecific

  return {
    id: row.id,
    institution_id: row.institution_id,
    // 공통 컬럼 직접 매핑
    thermometer: row.thermometer,
    first_aid_kit: row.first_aid_kit,
    indoor_alt_space: row.indoor_alt_space,
    // disaster_specific JSONB 언패킹 (누락 시 안전 기본값)
    low_ground:                   sp.low_ground                   ?? false,
    near_stream_or_slope:         sp.near_stream_or_slope         ?? false,
    has_basement:                 sp.has_basement                 ?? false,
    entrance_type:                sp.entrance_type                ?? null,
    pickup_wait_area:             sp.pickup_wait_area             ?? null,
    outdoor_playground_location:  sp.outdoor_playground_location  ?? null,
    has_shuttle:                  sp.has_shuttle                  ?? false,
    has_alt_indoor_space:         sp.has_alt_indoor_space         ?? false,
    has_emergency_contact_plan:   sp.has_emergency_contact_plan   ?? false,
    has_evacuation_space:         sp.has_evacuation_space         ?? false,
    mobility_support_count:       sp.mobility_support_count       ?? 0,
    is_current: row.is_current,
    created_at: row.created_at,
  }
}

// ── 집중호우 ProfileForm 입력 타입 ────────────────────────────────────────────

export interface HeavyRainFormInput {
  // 공통 컬럼
  thermometer: boolean
  first_aid_kit: boolean
  indoor_alt_space: boolean
  // 집중호우 특수 필드
  low_ground: boolean
  near_stream_or_slope: boolean
  has_basement: boolean
  entrance_type: 'ground_level' | 'raised' | 'below_grade' | null
  pickup_wait_area: 'indoor' | 'covered_outdoor' | 'open_outdoor' | null
  outdoor_playground_location: 'rooftop' | 'ground_level' | 'none' | null
  has_shuttle: boolean
  has_alt_indoor_space: boolean
  has_emergency_contact_plan: boolean
  has_evacuation_space: boolean
  mobility_support_count: number
}

/**
 * HeavyRainFormInput → institution_risk_profiles INSERT 형태로 변환.
 *
 * disaster_type='heavy_rain' 고정.
 * 공통 컬럼(thermometer, first_aid_kit, indoor_alt_space)은 최상위 컬럼.
 * 나머지 집중호우 특수 필드는 disaster_specific JSONB로 패킹.
 * is_current=true → 트리거가 기존 행을 false 처리.
 */
export function heavyRainFormToRiskProfile(
  form: HeavyRainFormInput,
  institutionId: string
): {
  institution_id: string
  disaster_type: 'heavy_rain'
  thermometer: boolean
  first_aid_kit: boolean
  indoor_alt_space: boolean
  disaster_specific: HeavyRainSpecific
  is_current: boolean
} {
  const {
    thermometer,
    first_aid_kit,
    indoor_alt_space,
    low_ground,
    near_stream_or_slope,
    has_basement,
    entrance_type,
    pickup_wait_area,
    outdoor_playground_location,
    has_shuttle,
    has_alt_indoor_space,
    has_emergency_contact_plan,
    has_evacuation_space,
    mobility_support_count,
  } = form

  return {
    institution_id: institutionId,
    disaster_type: 'heavy_rain',
    // 공통 컬럼
    thermometer,
    first_aid_kit,
    indoor_alt_space,
    // 집중호우 특수 필드 → JSONB 패킹
    disaster_specific: {
      low_ground,
      near_stream_or_slope,
      has_basement,
      entrance_type,
      pickup_wait_area,
      outdoor_playground_location,
      has_shuttle,
      has_alt_indoor_space,
      has_emergency_contact_plan,
      has_evacuation_space,
      mobility_support_count,
    },
    is_current: true,
  }
}

// ── 감염병 프로필 타입 (P10 T10-1 신규) ──────────────────────────────────────

/**
 * 감염병 disaster_specific JSONB 내 특수 필드.
 * 계획 §6 기반: 집계값·유무·방식 위주.
 *
 * PII 절대 금지:
 * - 이름·진단명·약물명·보호자 연락처 필드 없음.
 * - 유아 수는 집계(숫자)만, 영아반 여부는 boolean만.
 * - 보호자 연락 방식은 'app'|'sms'|'call'|'board' enum으로만 — 개인 번호 없음.
 */
export interface InfectionSpecific {
  /** 반별 총 유아 수 (집계값만, 이름 없음) */
  class_child_count?: number | null
  /** 영아반(만 0~2세) 보유 여부 */
  has_infant_class?: boolean | null
  /** 특별지원 유아 수 (집계값만, PII 없음) */
  special_support_count?: number | null
  /** 보건실 또는 분리대기 공간 보유 여부 */
  has_health_room?: boolean | null
  /** 손소독제 보유 여부 */
  has_hand_sanitizer?: boolean | null
  /** 마스크 보유 여부 */
  has_mask?: boolean | null
  /** 소독용품(소독액·티슈 등) 보유 여부 */
  has_disinfectant?: boolean | null
  /**
   * 보호자 연락 방식 (개인 연락처가 아닌 방식 enum)
   * 'app'=앱 알림, 'sms'=문자/알림톡, 'call'=전화 통보, 'board'=공지게시판
   */
  guardian_contact_method?: 'app' | 'sms' | 'call' | 'board' | null
  /** 감염병 대응 매뉴얼 보유 여부 */
  has_infection_manual?: boolean | null
  /** 등원중지 안내 템플릿 보유 여부 */
  has_attendance_stop_template?: boolean | null
}

/**
 * 감염병 InfectionProfile — ProfileForm 및 AI 입력에 사용하는 통합 뷰.
 * 공통 컬럼(thermometer, first_aid_kit, indoor_alt_space) + 감염병 특수 필드.
 */
export interface InfectionProfile {
  id: string
  institution_id: string
  // 공통 컬럼
  thermometer: boolean      // 체온계 보유 여부 (공통 컬럼 재사용)
  first_aid_kit: boolean
  indoor_alt_space: boolean // 분리대기 공간 여부 (공통 컬럼 재사용)
  // 감염병 특수 필드 (InfectionSpecific에서 언패킹)
  class_child_count: number | null
  has_infant_class: boolean
  special_support_count: number
  has_health_room: boolean
  has_hand_sanitizer: boolean
  has_mask: boolean
  has_disinfectant: boolean
  guardian_contact_method: 'app' | 'sms' | 'call' | 'board' | null
  has_infection_manual: boolean
  has_attendance_stop_template: boolean
  is_current: boolean
  created_at: string
}

/**
 * institution_risk_profiles 행(disaster_type='infection') →
 * InfectionProfile 형태로 변환.
 *
 * 공통 컬럼(thermometer, first_aid_kit, indoor_alt_space)은 직접 매핑.
 * 나머지 감염병 특수 필드는 disaster_specific JSONB에서 언패킹.
 * 누락 키는 안전 기본값으로 채움.
 */
export function riskProfileToInfection(row: InstitutionRiskProfile): InfectionProfile {
  const sp = (row.disaster_specific ?? {}) as InfectionSpecific

  return {
    id: row.id,
    institution_id: row.institution_id,
    // 공통 컬럼 직접 매핑
    thermometer:       row.thermometer,       // 체온계
    first_aid_kit:     row.first_aid_kit,
    indoor_alt_space:  row.indoor_alt_space,  // 분리대기 공간
    // disaster_specific JSONB 언패킹 (누락 시 안전 기본값)
    class_child_count:            sp.class_child_count             ?? null,
    has_infant_class:             sp.has_infant_class              ?? false,
    special_support_count:        sp.special_support_count         ?? 0,
    has_health_room:              sp.has_health_room               ?? false,
    has_hand_sanitizer:           sp.has_hand_sanitizer            ?? false,
    has_mask:                     sp.has_mask                      ?? false,
    has_disinfectant:             sp.has_disinfectant              ?? false,
    guardian_contact_method:      sp.guardian_contact_method       ?? null,
    has_infection_manual:         sp.has_infection_manual          ?? false,
    has_attendance_stop_template: sp.has_attendance_stop_template  ?? false,
    is_current: row.is_current,
    created_at: row.created_at,
  }
}

// ── 감염병 ProfileForm 입력 타입 ─────────────────────────────────────────────

/**
 * 감염병 ProfileForm 입력 타입.
 * PII 필드 없음: 집계·유무·방식 enum만.
 */
export interface InfectionFormInput {
  // 공통 컬럼
  thermometer: boolean
  first_aid_kit: boolean
  indoor_alt_space: boolean
  // 감염병 특수 필드
  class_child_count: number | null
  has_infant_class: boolean
  special_support_count: number
  has_health_room: boolean
  has_hand_sanitizer: boolean
  has_mask: boolean
  has_disinfectant: boolean
  guardian_contact_method: 'app' | 'sms' | 'call' | 'board' | null
  has_infection_manual: boolean
  has_attendance_stop_template: boolean
}

/**
 * InfectionFormInput → institution_risk_profiles INSERT 형태로 변환.
 *
 * disaster_type='infection' 고정.
 * 공통 컬럼(thermometer, first_aid_kit, indoor_alt_space)은 최상위 컬럼.
 * 나머지 감염병 특수 필드는 disaster_specific JSONB로 패킹.
 * is_current=true → 트리거가 기존 행을 false 처리.
 */
export function infectionFormToRiskProfile(
  form: InfectionFormInput,
  institutionId: string
): {
  institution_id: string
  disaster_type: 'infection'
  thermometer: boolean
  first_aid_kit: boolean
  indoor_alt_space: boolean
  disaster_specific: InfectionSpecific
  is_current: boolean
} {
  const {
    thermometer,
    first_aid_kit,
    indoor_alt_space,
    class_child_count,
    has_infant_class,
    special_support_count,
    has_health_room,
    has_hand_sanitizer,
    has_mask,
    has_disinfectant,
    guardian_contact_method,
    has_infection_manual,
    has_attendance_stop_template,
  } = form

  return {
    institution_id: institutionId,
    disaster_type: 'infection',
    // 공통 컬럼
    thermometer,
    first_aid_kit,
    indoor_alt_space,
    // 감염병 특수 필드 → JSONB 패킹 (PII 0건 확인: 이름·진단명·연락처 없음)
    disaster_specific: {
      class_child_count,
      has_infant_class,
      special_support_count,
      has_health_room,
      has_hand_sanitizer,
      has_mask,
      has_disinfectant,
      guardian_contact_method,
      has_infection_manual,
      has_attendance_stop_template,
    },
    is_current: true,
  }
}
