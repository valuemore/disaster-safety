'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { InstitutionType } from '@/lib/types/db'
import type { StaffProfile, HealthStaffType } from '@/lib/staff/types'
import { getRoleRecommendations } from '@/lib/staff/roleRecommendation'
import { RoleRecommendationPanel } from '@/components/institutions/RoleRecommendationPanel'

// ── 기본정보 폼 상태 ────────────────────────────────────────────────────────

interface FormState {
  name: string
  type: InstitutionType
  address: string
  sido: string
  sigungu: string
  dong: string
  latitude: string
  longitude: string
  total_children: string
  infant_count: string
  toddler_count: string
  staff_count: string
  has_shuttle: boolean
  has_outdoor_playground: boolean
  cooling_space_count: string
  water_available: boolean
}

// ── 급식·보건 인력 폼 상태 ─────────────────────────────────────────────────

interface StaffFormState {
  // 급식 인력
  meal_count_per_serving: string
  has_food_service_staff: boolean
  food_service_staff_count: string
  has_cook_license_staff: boolean
  has_collective_food_service: boolean
  // 보건 인력
  has_health_staff: boolean
  health_staff_type: HealthStaffType | ''
  health_staff_count: string
  has_nurse_or_nursing_assistant: boolean
  has_health_teacher: boolean
  has_designated_health_manager: boolean
  // 유치원 전용
  kindergarten_class_count: string
  // 유치원 설립 유형 (역할 추천용)
  kindergarten_ownership: 'public' | 'private' | ''
}

const INITIAL_FORM: FormState = {
  name: '',
  type: 'daycare',
  address: '',
  sido: '',
  sigungu: '',
  dong: '',
  latitude: '',
  longitude: '',
  total_children: '',
  infant_count: '',
  toddler_count: '',
  staff_count: '',
  has_shuttle: false,
  has_outdoor_playground: false,
  cooling_space_count: '0',
  water_available: false,
}

const INITIAL_STAFF: StaffFormState = {
  meal_count_per_serving: '',
  has_food_service_staff: false,
  food_service_staff_count: '',
  has_cook_license_staff: false,
  has_collective_food_service: false,
  has_health_staff: false,
  health_staff_type: '',
  health_staff_count: '',
  has_nurse_or_nursing_assistant: false,
  has_health_teacher: false,
  has_designated_health_manager: false,
  kindergarten_class_count: '',
  kindergarten_ownership: '',
}

// ── 유틸 ────────────────────────────────────────────────────────────────────

function parseIntOrNull(v: string): number | null {
  const n = parseInt(v, 10)
  return isNaN(n) ? null : n
}

function buildStaffProfile(staff: StaffFormState): StaffProfile {
  const profile: StaffProfile = {}

  const mealCount = parseIntOrNull(staff.meal_count_per_serving)
  if (mealCount !== null) profile.meal_count_per_serving = mealCount
  profile.has_food_service_staff = staff.has_food_service_staff
  const foodCount = parseIntOrNull(staff.food_service_staff_count)
  if (foodCount !== null) profile.food_service_staff_count = foodCount
  profile.has_cook_license_staff = staff.has_cook_license_staff
  profile.has_collective_food_service = staff.has_collective_food_service
  profile.has_health_staff = staff.has_health_staff
  if (staff.health_staff_type !== '') profile.health_staff_type = staff.health_staff_type
  const healthCount = parseIntOrNull(staff.health_staff_count)
  if (healthCount !== null) profile.health_staff_count = healthCount
  profile.has_nurse_or_nursing_assistant = staff.has_nurse_or_nursing_assistant
  profile.has_health_teacher = staff.has_health_teacher
  profile.has_designated_health_manager = staff.has_designated_health_manager
  const classCount = parseIntOrNull(staff.kindergarten_class_count)
  if (classCount !== null) profile.kindergarten_class_count = classCount

  return profile
}

// ── 보건담당자 유형 라벨 ─────────────────────────────────────────────────────

const HEALTH_STAFF_OPTIONS: { value: HealthStaffType; label: string }[] = [
  { value: 'nurse', label: '간호사' },
  { value: 'nursing_assistant', label: '간호조무사' },
  { value: 'health_teacher', label: '보건교사' },
  { value: 'designated', label: '지정 보건담당자' },
  { value: 'none', label: '없음' },
]

// ── 급식·보건 인력 입력 섹션 ─────────────────────────────────────────────────

function StaffProfileSection({
  staff,
  setStaff,
  institutionType,
}: {
  staff: StaffFormState
  setStaff: React.Dispatch<React.SetStateAction<StaffFormState>>
  institutionType: InstitutionType
}) {
  function setStaffField<K extends keyof StaffFormState>(key: K, val: StaffFormState[K]) {
    setStaff((prev) => ({ ...prev, [key]: val }))
  }

  return (
    <div className="space-y-4">
      {/* 급식 인력 */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-foreground">급식 인력</h3>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="meal_count_per_serving">
              1회 급식 제공 인원
            </label>
            <input
              id="meal_count_per_serving"
              type="number"
              inputMode="numeric"
              min={0}
              max={9999}
              placeholder="예: 80"
              value={staff.meal_count_per_serving}
              onChange={(e) => setStaffField('meal_count_per_serving', e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="mt-0.5 text-xs text-muted-foreground">집단급식소 기준 확인용 집계값만 입력합니다.</p>
          </div>

          <div className="space-y-2">
            <label className="flex min-h-[44px] cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={staff.has_food_service_staff}
                onChange={(e) => setStaffField('has_food_service_staff', e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <span className="text-sm">급식(조리) 인력 보유</span>
            </label>
          </div>

          {staff.has_food_service_staff && (
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="food_service_staff_count">
                급식 인력 수
              </label>
              <input
                id="food_service_staff_count"
                type="number"
                inputMode="numeric"
                min={0}
                max={999}
                placeholder="0"
                value={staff.food_service_staff_count}
                onChange={(e) => setStaffField('food_service_staff_count', e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}

          <div className="space-y-2">
            {(
              [
                ['has_cook_license_staff', '조리사 면허 보유 인력 포함'],
                ['has_collective_food_service', '집단급식소 신고 완료'],
              ] as [keyof StaffFormState, string][]
            ).map(([key, label]) => (
              <label key={key} className="flex min-h-[44px] cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={staff[key] as boolean}
                  onChange={(e) => setStaffField(key, e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <Separator />

      {/* 보건 인력 */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-foreground">보건 인력</h3>
        <div className="space-y-3">
          <label className="flex min-h-[44px] cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={staff.has_health_staff}
              onChange={(e) => setStaffField('has_health_staff', e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <span className="text-sm">보건 인력 보유</span>
          </label>

          {staff.has_health_staff && (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="health_staff_type">
                  보건담당자 유형
                </label>
                <select
                  id="health_staff_type"
                  value={staff.health_staff_type}
                  onChange={(e) =>
                    setStaffField('health_staff_type', e.target.value as HealthStaffType | '')
                  }
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">선택 안 함</option>
                  {HEALTH_STAFF_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="health_staff_count">
                  보건 인력 수
                </label>
                <input
                  id="health_staff_count"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={999}
                  placeholder="0"
                  value={staff.health_staff_count}
                  onChange={(e) => setStaffField('health_staff_count', e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="space-y-2">
                {(
                  [
                    ['has_nurse_or_nursing_assistant', '간호사/간호조무사 포함'],
                    ['has_health_teacher', '보건교사 포함'],
                    ['has_designated_health_manager', '지정 보건담당자 포함'],
                  ] as [keyof StaffFormState, string][]
                ).map(([key, label]) => (
                  <label key={key} className="flex min-h-[44px] cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={staff[key] as boolean}
                      onChange={(e) => setStaffField(key, e.target.checked)}
                      className="h-4 w-4 rounded border-border accent-primary"
                    />
                    <span className="text-sm">{label}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 유치원 전용 */}
      {institutionType === 'kindergarten' && (
        <>
          <Separator />
          <div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">유치원 추가 정보</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">설립 유형</label>
                <div className="flex gap-2">
                  {(
                    [
                      ['public', '국공립'],
                      ['private', '사립'],
                    ] as ['public' | 'private', string][]
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() =>
                        setStaffField(
                          'kindergarten_ownership',
                          staff.kindergarten_ownership === val ? '' : val
                        )
                      }
                      className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${
                        staff.kindergarten_ownership === val
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border hover:bg-muted'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="kindergarten_class_count">
                  학급 수
                </label>
                <input
                  id="kindergarten_class_count"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={9999}
                  placeholder="예: 8"
                  value={staff.kindergarten_class_count}
                  onChange={(e) => setStaffField('kindergarten_class_count', e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="mt-0.5 text-xs text-muted-foreground">보건교사 배치 기준 확인용 집계값만 입력합니다.</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── 메인 폼 컴포넌트 ─────────────────────────────────────────────────────────

export function InstitutionForm() {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [staff, setStaff] = useState<StaffFormState>(INITIAL_STAFF)
  const [loading, setLoading] = useState(false)
  const [geocoding, setGeocoding] = useState(false)

  // ── 역할 추천 (클라이언트 실시간 계산) ──────────────────────────────────
  const recommendations = useMemo(() => {
    const staffProfile = buildStaffProfile(staff)
    return getRoleRecommendations({
      institution_type: form.type,
      kindergarten_ownership:
        form.type === 'kindergarten' && staff.kindergarten_ownership !== ''
          ? (staff.kindergarten_ownership as 'public' | 'private')
          : undefined,
      total_children: parseIntOrNull(form.total_children),
      staff_profile: staffProfile,
    })
  }, [form.type, form.total_children, staff])

  async function handleGeocode() {
    if (!form.address.trim()) {
      toast.error('주소를 먼저 입력해 주세요.')
      return
    }
    setGeocoding(true)
    try {
      const res = await fetch(`/api/external/geocode?query=${encodeURIComponent(form.address)}`)
      const json = await res.json()
      if (!res.ok || !json.data) {
        toast.error('주소 변환 실패 — 시도/시군구/행정동을 직접 입력해 주세요.')
        return
      }
      const d = json.data
      setForm((prev) => ({
        ...prev,
        sido: d.sido ?? prev.sido,
        sigungu: d.sigungu ?? prev.sigungu,
        dong: d.dong ?? prev.dong,
        latitude: d.lat != null ? String(d.lat) : prev.latitude,
        longitude: d.lng != null ? String(d.lng) : prev.longitude,
      }))
      toast.success(
        json.source === 'api' ? '주소가 자동으로 채워졌습니다.' : '샘플 좌표로 채워졌습니다 (키 미설정).'
      )
    } catch {
      toast.error('주소 변환 중 오류가 발생했습니다.')
    } finally {
      setGeocoding(false)
    }
  }

  function setField<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('기관명을 입력해 주세요.')
      return
    }

    setLoading(true)
    try {
      const staffProfile = buildStaffProfile(staff)
      const res = await fetch('/api/institutions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          type: form.type,
          address: form.address || null,
          latitude: form.latitude ? parseFloat(form.latitude) : null,
          longitude: form.longitude ? parseFloat(form.longitude) : null,
          sido: form.sido || null,
          sigungu: form.sigungu || null,
          dong: form.dong || null,
          total_children: parseIntOrNull(form.total_children),
          infant_count: parseIntOrNull(form.infant_count),
          toddler_count: parseIntOrNull(form.toddler_count),
          staff_count: parseIntOrNull(form.staff_count),
          has_shuttle: form.has_shuttle,
          has_outdoor_playground: form.has_outdoor_playground,
          cooling_space_count: parseIntOrNull(form.cooling_space_count) ?? 0,
          water_available: form.water_available,
          staff_profile: staffProfile,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? '기관 등록 실패')
        return
      }

      toast.success('기관이 등록되었습니다.')
      router.push(`/institutions/${json.data.id}/profile`)
    } catch {
      toast.error('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="space-y-4">
        {/* 기본 정보 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">기본 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="name">
                기관명 <span className="text-destructive">*</span>
              </label>
              <input
                id="name"
                type="text"
                required
                placeholder="예: 햇살어린이집"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">기관 유형</label>
              <div className="flex gap-2">
                {(['daycare', 'kindergarten'] as InstitutionType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setField('type', t)}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${
                      form.type === t
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    {t === 'daycare' ? '어린이집' : '유치원'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="address">
                주소
              </label>
              <div className="flex gap-2">
                <input
                  id="address"
                  type="text"
                  placeholder="예: 서울특별시 강서구 화곡로 123"
                  value={form.address}
                  onChange={(e) => setField('address', e.target.value)}
                  className="flex-1 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGeocode}
                  disabled={geocoding}
                  className="shrink-0 text-xs"
                >
                  {geocoding ? '검색 중…' : '자동 채움'}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(['sido', 'sigungu', 'dong'] as const).map((key) => (
                <div key={key}>
                  <label className="mb-1 block text-xs text-muted-foreground" htmlFor={key}>
                    {key === 'sido' ? '시도' : key === 'sigungu' ? '시군구' : '행정동'}
                  </label>
                  <input
                    id={key}
                    type="text"
                    placeholder={key === 'sido' ? '서울특별시' : key === 'sigungu' ? '강서구' : '화곡동'}
                    value={form[key]}
                    onChange={(e) => setField(key, e.target.value)}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 인원 현황 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">인원 현황</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {(
              [
                ['total_children', '전체 유아 수'],
                ['infant_count', '영아 수'],
                ['toddler_count', '유아 수'],
                ['staff_count', '교직원 수'],
              ] as [keyof FormState, string][]
            ).map(([key, label]) => (
              <div key={key}>
                <label className="mb-1 block text-sm font-medium" htmlFor={key}>
                  {label}
                </label>
                <input
                  id={key}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={9999}
                  placeholder="0"
                  value={form[key] as string}
                  onChange={(e) => setField(key, e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 시설 현황 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">시설 현황</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="cooling_space_count">
                냉방 가능 공간 수
              </label>
              <input
                id="cooling_space_count"
                type="number"
                inputMode="numeric"
                min={0}
                max={999}
                placeholder="0"
                value={form.cooling_space_count}
                onChange={(e) => setField('cooling_space_count', e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <Separator />

            <div className="space-y-2">
              {(
                [
                  ['has_shuttle', '통학버스 운영'],
                  ['has_outdoor_playground', '실외 놀이터 있음'],
                  ['water_available', '물 공급 가능(정수기 등)'],
                ] as [keyof FormState, string][]
              ).map(([key, label]) => (
                <label key={key} className="flex min-h-[44px] cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={form[key] as boolean}
                    onChange={(e) => setField(key, e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 급식·보건 인력 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">급식·보건 인력</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              인력 유무·수·유형만 입력합니다. 이름·연락처는 입력하지 않습니다.
            </p>
          </CardHeader>
          <CardContent>
            <StaffProfileSection
              staff={staff}
              setStaff={setStaff}
              institutionType={form.type}
            />
          </CardContent>
        </Card>

        {/* 역할 배치 기준 안내 (실시간 추천) */}
        {recommendations.length > 0 && (
          <RoleRecommendationPanel recommendations={recommendations} />
        )}

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs text-muted-foreground">
            다음: 재난 대응 프로필 입력
          </Badge>
        </div>

        <Button
          type="submit"
          className="w-full min-h-[48px] text-base"
          disabled={loading}
        >
          {loading ? '등록 중...' : '기관 등록 후 프로필 입력하기'}
        </Button>
      </div>
    </form>
  )
}
