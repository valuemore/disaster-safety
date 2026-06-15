'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { PickupWaitPlace } from '@/lib/types/db'
import type { DisasterType } from '@/lib/disaster/types'
import type { HeavyRainFormInput, InfectionFormInput } from '@/lib/disaster/profileMapping'

// ── 공통 서브컴포넌트 ──────────────────────────────────────────────────────

function Counter({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (n: number) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          className="flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold transition-colors hover:bg-muted disabled:opacity-40"
          disabled={value === 0}
          aria-label={`${label} 감소`}
        >
          −
        </button>
        <span className="w-8 text-center tabular-nums text-sm font-medium">{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(9999, value + 1))}
          className="flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold transition-colors hover:bg-muted"
          aria-label={`${label} 증가`}
        >
          +
        </button>
      </div>
    </div>
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex min-h-[44px] cursor-pointer items-center justify-between">
      <span className="text-sm">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? 'bg-primary' : 'bg-muted-foreground/30'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </label>
  )
}

// ── 폭염 폼 ───────────────────────────────────────────────────────────────

interface HeatwaveFormState {
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

const HEATWAVE_INITIAL: HeatwaveFormState = {
  heat_vulnerable_count: 0,
  respiratory_caution_count: 0,
  mobility_support_count: 0,
  special_support_count: 0,
  cooling_ok: true,
  indoor_alt_space: false,
  water_supply_ok: false,
  thermometer: false,
  first_aid_kit: false,
  vehicle_thermometer: false,
  pickup_wait_place: null,
}

const PICKUP_OPTIONS: { value: PickupWaitPlace; label: string }[] = [
  { value: 'indoor', label: '실내' },
  { value: 'shade', label: '그늘' },
  { value: 'outdoor', label: '야외' },
  { value: 'etc', label: '기타' },
]

function HeatwaveProfileForm({
  institutionId,
  hasShuttle,
}: {
  institutionId: string
  hasShuttle: boolean
}) {
  const router = useRouter()
  const [form, setForm] = useState<HeatwaveFormState>(HEATWAVE_INITIAL)
  const [loading, setLoading] = useState(false)

  function setField<K extends keyof HeatwaveFormState>(key: K, val: HeatwaveFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`/api/institutions/${institutionId}/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, disaster_type: 'heatwave' }),
      })

      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? '프로필 저장 실패')
        return
      }

      toast.success('폭염 대응 프로필이 저장되었습니다.')
      router.push(`/plan/new?institution=${institutionId}`)
    } catch {
      toast.error('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="space-y-4">
        {/* PII 없음 안내 */}
        <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
          ※ 유아 이름·진단명·약물명·보호자 연락처는 입력하지 않습니다. 취약 유아 정보는 숫자 집계값만 입력합니다.
        </div>

        {/* 취약 유아 집계 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">취약 유아 집계 (숫자만)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Counter
              label="온열취약 유아 수"
              value={form.heat_vulnerable_count}
              onChange={(n) => setField('heat_vulnerable_count', n)}
            />
            <Counter
              label="호흡기 주의 유아 수"
              value={form.respiratory_caution_count}
              onChange={(n) => setField('respiratory_caution_count', n)}
            />
            <Counter
              label="이동지원 필요 유아 수"
              value={form.mobility_support_count}
              onChange={(n) => setField('mobility_support_count', n)}
            />
            <Counter
              label="기타 특별지원 유아 수"
              value={form.special_support_count}
              onChange={(n) => setField('special_support_count', n)}
            />
          </CardContent>
        </Card>

        {/* 시설·물품 현황 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">시설·물품 현황</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <Toggle
              label="냉방기 정상 작동"
              checked={form.cooling_ok}
              onChange={(v) => setField('cooling_ok', v)}
            />
            <Separator />
            <Toggle
              label="실내 대체활동 공간 있음"
              checked={form.indoor_alt_space}
              onChange={(v) => setField('indoor_alt_space', v)}
            />
            <Separator />
            <Toggle
              label="정수기/물 공급 가능"
              checked={form.water_supply_ok}
              onChange={(v) => setField('water_supply_ok', v)}
            />
            <Separator />
            <Toggle
              label="체온계 보유"
              checked={form.thermometer}
              onChange={(v) => setField('thermometer', v)}
            />
            <Separator />
            <Toggle
              label="구급함 보유"
              checked={form.first_aid_kit}
              onChange={(v) => setField('first_aid_kit', v)}
            />
            {hasShuttle && (
              <>
                <Separator />
                <Toggle
                  label="차량 내부 온도계 보유"
                  checked={form.vehicle_thermometer}
                  onChange={(v) => setField('vehicle_thermometer', v)}
                />
              </>
            )}
          </CardContent>
        </Card>

        {/* 하원 대기 장소 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">하원 대기 장소</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {PICKUP_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setField(
                      'pickup_wait_place',
                      form.pickup_wait_place === opt.value ? null : opt.value
                    )
                  }
                  className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                    form.pickup_wait_place === opt.value
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Button
          type="submit"
          className="w-full min-h-[48px] text-base"
          disabled={loading}
        >
          {loading ? '저장 중...' : '프로필 저장 후 대응계획 생성하기'}
        </Button>
      </div>
    </form>
  )
}

// ── 집중호우 폼 ───────────────────────────────────────────────────────────

type HeavyRainFormState = HeavyRainFormInput

const HEAVY_RAIN_INITIAL: HeavyRainFormState = {
  thermometer: false,
  first_aid_kit: false,
  indoor_alt_space: false,
  low_ground: false,
  near_stream_or_slope: false,
  has_basement: false,
  entrance_type: null,
  pickup_wait_area: null,
  outdoor_playground_location: null,
  has_shuttle: false,
  has_alt_indoor_space: false,
  has_emergency_contact_plan: false,
  has_evacuation_space: false,
  mobility_support_count: 0,
}

const ENTRANCE_OPTIONS: { value: HeavyRainFormState['entrance_type']; label: string }[] = [
  { value: 'ground_level', label: '지면과 동일' },
  { value: 'raised', label: '지면보다 높음' },
  { value: 'below_grade', label: '지면보다 낮음' },
]

const PICKUP_WAIT_AREA_OPTIONS: { value: HeavyRainFormState['pickup_wait_area']; label: string }[] = [
  { value: 'indoor', label: '실내' },
  { value: 'covered_outdoor', label: '지붕 있는 실외' },
  { value: 'open_outdoor', label: '노출 실외' },
]

const PLAYGROUND_LOCATION_OPTIONS: {
  value: HeavyRainFormState['outdoor_playground_location']
  label: string
}[] = [
  { value: 'rooftop', label: '옥상' },
  { value: 'ground_level', label: '지상' },
  { value: 'none', label: '없음' },
]

function HeavyRainProfileForm({
  institutionId,
  hasShuttle,
}: {
  institutionId: string
  hasShuttle: boolean
}) {
  const router = useRouter()
  const [form, setForm] = useState<HeavyRainFormState>({
    ...HEAVY_RAIN_INITIAL,
    has_shuttle: hasShuttle,
  })
  const [loading, setLoading] = useState(false)

  function setField<K extends keyof HeavyRainFormState>(key: K, val: HeavyRainFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`/api/institutions/${institutionId}/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, disaster_type: 'heavy_rain' }),
      })

      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? '프로필 저장 실패')
        return
      }

      toast.success('집중호우 대응 프로필이 저장되었습니다.')
      router.push(`/plan/new?institution=${institutionId}&disaster_type=heavy_rain`)
    } catch {
      toast.error('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="space-y-4">
        {/* PII 없음 안내 */}
        <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
          ※ 유아 이름·진단명·약물명·보호자 연락처는 입력하지 않습니다. 취약 유아 정보는 숫자 집계값만 입력합니다.
        </div>

        {/* 기관 위치·시설 환경 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">기관 위치·시설 환경</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <Toggle
              label="저지대 위치 (침수 위험 지역)"
              checked={form.low_ground}
              onChange={(v) => setField('low_ground', v)}
            />
            <Separator />
            <Toggle
              label="인근 하천·배수로·급경사지 있음"
              checked={form.near_stream_or_slope}
              onChange={(v) => setField('near_stream_or_slope', v)}
            />
            <Separator />
            <Toggle
              label="지하공간 보유 (지하 교실·창고·주차장 등)"
              checked={form.has_basement}
              onChange={(v) => setField('has_basement', v)}
            />
          </CardContent>
        </Card>

        {/* 1층 출입구 구조 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">1층 출입구 구조</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2">
              {ENTRANCE_OPTIONS.map((opt) => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() =>
                    setField(
                      'entrance_type',
                      form.entrance_type === opt.value ? null : opt.value
                    )
                  }
                  className={`rounded-md border px-3 py-3 text-sm text-left transition-colors ${
                    form.entrance_type === opt.value
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 하원 대기 장소 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">하원 대기 장소</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2">
              {PICKUP_WAIT_AREA_OPTIONS.map((opt) => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() =>
                    setField(
                      'pickup_wait_area',
                      form.pickup_wait_area === opt.value ? null : opt.value
                    )
                  }
                  className={`rounded-md border px-3 py-3 text-sm text-left transition-colors ${
                    form.pickup_wait_area === opt.value
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 실외 놀이터 위치 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">실외 놀이터 위치</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {PLAYGROUND_LOCATION_OPTIONS.map((opt) => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() =>
                    setField(
                      'outdoor_playground_location',
                      form.outdoor_playground_location === opt.value ? null : opt.value
                    )
                  }
                  className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                    form.outdoor_playground_location === opt.value
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 대응 자원·계획 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">대응 자원·계획</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <Toggle
              label="대체 실내 대기공간 확보"
              checked={form.has_alt_indoor_space}
              onChange={(v) => setField('has_alt_indoor_space', v)}
            />
            <Separator />
            <Toggle
              label="실내 대체활동 공간 있음"
              checked={form.indoor_alt_space}
              onChange={(v) => setField('indoor_alt_space', v)}
            />
            <Separator />
            <Toggle
              label="비상연락망 (재난 시 연락체계) 구비"
              checked={form.has_emergency_contact_plan}
              onChange={(v) => setField('has_emergency_contact_plan', v)}
            />
            <Separator />
            <Toggle
              label="침수·정전 시 대피 가능 공간 확보"
              checked={form.has_evacuation_space}
              onChange={(v) => setField('has_evacuation_space', v)}
            />
            <Separator />
            <Toggle
              label="체온계 보유"
              checked={form.thermometer}
              onChange={(v) => setField('thermometer', v)}
            />
            <Separator />
            <Toggle
              label="구급함 보유"
              checked={form.first_aid_kit}
              onChange={(v) => setField('first_aid_kit', v)}
            />
            {hasShuttle && (
              <>
                <Separator />
                <Toggle
                  label="통학버스 운영"
                  checked={form.has_shuttle}
                  onChange={(v) => setField('has_shuttle', v)}
                />
              </>
            )}
          </CardContent>
        </Card>

        {/* 취약 유아 집계 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">취약 유아 집계 (숫자만)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Counter
              label="이동지원 필요 유아 수"
              value={form.mobility_support_count}
              onChange={(n) => setField('mobility_support_count', n)}
            />
          </CardContent>
        </Card>

        <Button
          type="submit"
          className="w-full min-h-[48px] text-base"
          disabled={loading}
        >
          {loading ? '저장 중...' : '프로필 저장 후 대응계획 생성하기'}
        </Button>
      </div>
    </form>
  )
}

// ── 감염병 폼 ─────────────────────────────────────────────────────────────

type InfectionFormState = InfectionFormInput

const INFECTION_INITIAL: InfectionFormState = {
  thermometer: false,
  first_aid_kit: false,
  indoor_alt_space: false,
  class_child_count: null,
  has_infant_class: false,
  special_support_count: 0,
  has_health_room: false,
  has_hand_sanitizer: false,
  has_mask: false,
  has_disinfectant: false,
  guardian_contact_method: null,
  has_infection_manual: false,
  has_attendance_stop_template: false,
}

const GUARDIAN_CONTACT_OPTIONS: {
  value: InfectionFormState['guardian_contact_method']
  label: string
  desc: string
}[] = [
  { value: 'app', label: '앱 알림', desc: '알림장·연락 앱' },
  { value: 'sms', label: '문자·알림톡', desc: 'SMS/카카오 알림톡' },
  { value: 'call', label: '전화 통보', desc: '담임교사 개별 전화' },
  { value: 'board', label: '공지게시판', desc: '기관 홈페이지·게시판' },
]

function InfectionProfileForm({
  institutionId,
}: {
  institutionId: string
  hasShuttle: boolean
}) {
  const router = useRouter()
  const [form, setForm] = useState<InfectionFormState>(INFECTION_INITIAL)
  const [loading, setLoading] = useState(false)

  function setField<K extends keyof InfectionFormState>(key: K, val: InfectionFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`/api/institutions/${institutionId}/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, disaster_type: 'infection' }),
      })

      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? '프로필 저장 실패')
        return
      }

      toast.success('감염병 대응 프로필이 저장되었습니다.')
      router.push(`/plan/new?institution=${institutionId}&disaster_type=infection`)
    } catch {
      toast.error('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="space-y-4">
        {/* PII 경고 — 강조 표시 */}
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
          <p className="font-semibold">개인정보 입력 금지</p>
          <p className="mt-0.5">
            유아 이름·진단명·질병명·보호자 연락처는 입력하지 않습니다.
            발열 유아 수 등 집계값만 입력하세요. 아래 항목 외 개인정보 기재 불가.
          </p>
        </div>

        {/* 유아 집계 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">유아 집계 (숫자만, PII 없음)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 반별 유아 수 */}
            <div className="flex items-center justify-between">
              <span className="text-sm">반별 총 유아 수</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setField('class_child_count', Math.max(0, (form.class_child_count ?? 0) - 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold transition-colors hover:bg-muted disabled:opacity-40"
                  disabled={(form.class_child_count ?? 0) === 0}
                  aria-label="반별 유아 수 감소"
                >
                  −
                </button>
                <span className="w-10 text-center tabular-nums text-sm font-medium">
                  {form.class_child_count ?? 0}
                </span>
                <button
                  type="button"
                  onClick={() => setField('class_child_count', Math.min(9999, (form.class_child_count ?? 0) + 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold transition-colors hover:bg-muted"
                  aria-label="반별 유아 수 증가"
                >
                  +
                </button>
              </div>
            </div>
            <Counter
              label="특별지원 유아 수"
              value={form.special_support_count}
              onChange={(n) => setField('special_support_count', n)}
            />
          </CardContent>
        </Card>

        {/* 시설·반 구성 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">시설·반 구성</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <Toggle
              label="영아반(만 0~2세) 보유"
              checked={form.has_infant_class}
              onChange={(v) => setField('has_infant_class', v)}
            />
            <Separator />
            <Toggle
              label="보건실 또는 분리대기 공간 있음"
              checked={form.has_health_room}
              onChange={(v) => setField('has_health_room', v)}
            />
            <Separator />
            <Toggle
              label="분리대기 가능 실내 공간 있음"
              checked={form.indoor_alt_space}
              onChange={(v) => setField('indoor_alt_space', v)}
            />
          </CardContent>
        </Card>

        {/* 위생·감염 대응 물품 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">위생·감염 대응 물품</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <Toggle
              label="체온계 보유"
              checked={form.thermometer}
              onChange={(v) => setField('thermometer', v)}
            />
            <Separator />
            <Toggle
              label="구급함 보유"
              checked={form.first_aid_kit}
              onChange={(v) => setField('first_aid_kit', v)}
            />
            <Separator />
            <Toggle
              label="손소독제 보유"
              checked={form.has_hand_sanitizer}
              onChange={(v) => setField('has_hand_sanitizer', v)}
            />
            <Separator />
            <Toggle
              label="마스크 보유"
              checked={form.has_mask}
              onChange={(v) => setField('has_mask', v)}
            />
            <Separator />
            <Toggle
              label="소독용품 보유 (소독액·티슈 등)"
              checked={form.has_disinfectant}
              onChange={(v) => setField('has_disinfectant', v)}
            />
          </CardContent>
        </Card>

        {/* 보호자 연락 방식 (enum 선택 — 개인 연락처 입력 아님) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">보호자 연락 방식</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-2 text-xs text-muted-foreground">
              방식 선택만. 개인 연락처는 입력하지 않습니다.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {GUARDIAN_CONTACT_OPTIONS.map((opt) => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() =>
                    setField(
                      'guardian_contact_method',
                      form.guardian_contact_method === opt.value ? null : opt.value
                    )
                  }
                  className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                    form.guardian_contact_method === opt.value
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  <span className="block font-medium">{opt.label}</span>
                  <span className={`block text-xs ${form.guardian_contact_method === opt.value ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                    {opt.desc}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 대응 계획·매뉴얼 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">대응 계획·매뉴얼</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <Toggle
              label="감염병 대응 매뉴얼 보유"
              checked={form.has_infection_manual}
              onChange={(v) => setField('has_infection_manual', v)}
            />
            <Separator />
            <Toggle
              label="등원중지 안내 템플릿 보유"
              checked={form.has_attendance_stop_template}
              onChange={(v) => setField('has_attendance_stop_template', v)}
            />
          </CardContent>
        </Card>

        <Button
          type="submit"
          className="w-full min-h-[48px] text-base"
          disabled={loading}
        >
          {loading ? '저장 중...' : '프로필 저장 후 대응계획 생성하기'}
        </Button>
      </div>
    </form>
  )
}

// ── 공개 컴포넌트: disaster_type prop 분기 ────────────────────────────────

interface ProfileFormProps {
  institutionId: string
  hasShuttle: boolean
  /** 재난유형 — 미전달 시 'heatwave' (기존 폭염 기본값 유지) */
  disasterType?: DisasterType
}

export function ProfileForm({ institutionId, hasShuttle, disasterType = 'heatwave' }: ProfileFormProps) {
  if (disasterType === 'heavy_rain') {
    return (
      <HeavyRainProfileForm
        institutionId={institutionId}
        hasShuttle={hasShuttle}
      />
    )
  }
  if (disasterType === 'infection') {
    return (
      <InfectionProfileForm
        institutionId={institutionId}
        hasShuttle={hasShuttle}
      />
    )
  }
  // 기본값: heatwave (기존 동작 유지)
  return (
    <HeatwaveProfileForm
      institutionId={institutionId}
      hasShuttle={hasShuttle}
    />
  )
}
