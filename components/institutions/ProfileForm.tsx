'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { PickupWaitPlace } from '@/lib/types/db'

interface ProfileFormProps {
  institutionId: string
  hasShuttle: boolean
}

interface FormState {
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

const INITIAL: FormState = {
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

export function ProfileForm({ institutionId, hasShuttle }: ProfileFormProps) {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(INITIAL)
  const [loading, setLoading] = useState(false)

  function setField<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`/api/institutions/${institutionId}/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
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
