'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { InstitutionType } from '@/lib/types/db'

interface FormState {
  name: string
  type: InstitutionType
  address: string
  sido: string
  sigungu: string
  dong: string
  total_children: string
  infant_count: string
  toddler_count: string
  staff_count: string
  has_shuttle: boolean
  has_outdoor_playground: boolean
  cooling_space_count: string
  water_available: boolean
}

const INITIAL: FormState = {
  name: '',
  type: 'daycare',
  address: '',
  sido: '',
  sigungu: '',
  dong: '',
  total_children: '',
  infant_count: '',
  toddler_count: '',
  staff_count: '',
  has_shuttle: false,
  has_outdoor_playground: false,
  cooling_space_count: '0',
  water_available: false,
}

function parseIntOrNull(v: string): number | null {
  const n = parseInt(v, 10)
  return isNaN(n) ? null : n
}

export function InstitutionForm() {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(INITIAL)
  const [loading, setLoading] = useState(false)

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
      const res = await fetch('/api/institutions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          type: form.type,
          address: form.address || null,
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
              <input
                id="address"
                type="text"
                placeholder="예: 서울특별시 강서구 화곡로 123"
                value={form.address}
                onChange={(e) => setField('address', e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
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

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs text-muted-foreground">
            다음: 폭염 대응 프로필 입력
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
