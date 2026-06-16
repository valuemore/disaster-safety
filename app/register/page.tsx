'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SafetyNotice } from '@/components/common/SafetyNotice'
import { useSession } from '@/components/providers/SessionProvider'
import type { ChildcareInstitutionInfo } from '@/lib/external/childcareInfo'
import type { InstitutionType } from '@/lib/types/db'

export default function RegisterPage() {
  const router = useRouter()
  const { refresh } = useSession()

  const [type, setType] = useState<InstitutionType>('daycare')
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [candidates, setCandidates] = useState<ChildcareInstitutionInfo[]>([])
  const [selected, setSelected] = useState<ChildcareInstitutionInfo | null>(null)

  const [loginId, setLoginId] = useState('')
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSearch() {
    if (!query.trim()) {
      toast.error('기관명을 입력하세요.')
      return
    }
    setSearching(true)
    try {
      const res = await fetch(`/api/external/childcare?q=${encodeURIComponent(query.trim())}&type=${type}`)
      const json = await res.json()
      setCandidates(json.data ?? [])
      if (json.source === 'sample') {
        toast.info('포털 API 키 미설정 — 예시 결과를 표시합니다.')
      }
      if ((json.data ?? []).length === 0) toast.error('검색 결과가 없습니다.')
    } catch {
      toast.error('검색에 실패했습니다.')
    } finally {
      setSearching(false)
    }
  }

  function handleSelect(c: ChildcareInstitutionInfo) {
    setSelected(c)
    setLoginId(c.external_code ?? '')
  }

  async function handleRegister() {
    if (!selected) return
    if (!loginId.trim()) {
      toast.error('로그인 등록번호를 입력하세요.')
      return
    }
    if (pin.length < 4 || pin !== pin2) {
      toast.error('PIN(4~8자리)을 정확히 입력하고 확인란과 일치시키세요.')
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        name: selected.name ?? query.trim(),
        type,
        address: selected.address,
        latitude: selected.latitude,
        longitude: selected.longitude,
        sido: selected.sido,
        sigungu: selected.sigungu,
        total_children: selected.current_count ?? selected.child_count_total,
        infant_count: selected.infant_total_count,
        toddler_count: selected.preschool_total_count,
        staff_count: selected.staff_total,
        has_shuttle: selected.has_shuttle,
        has_outdoor_playground: (selected.playground_count ?? 0) > 0,
        login_id: loginId.trim(),
        pin,
        external_code: selected.external_code,
        api_raw: selected.raw,
        child_count_source: 'api' as const,
      }
      const res = await fetch('/api/institutions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? '기관 등록에 실패했습니다.')
        setSubmitting(false)
        return
      }
      await refresh()
      toast.success('기관이 등록되었습니다. 담당자 연락처를 등록하세요.')
      router.push('/account/contacts')
    } catch {
      toast.error('네트워크 오류가 발생했습니다.')
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">기관 등록</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          어린이집정보공개포털에서 기관을 검색해 기본정보를 자동으로 채웁니다.
        </p>
      </div>

      {/* 1. 검색 */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">1. 기관 검색</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex rounded-lg border bg-muted p-1">
            {(['daycare', 'kindergarten'] as InstitutionType[]).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                  type === t ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                {t === 'daycare' ? '어린이집' : '유치원'}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="기관명을 입력하세요"
              className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
            />
            <Button onClick={handleSearch} disabled={searching} className="shrink-0">
              {searching ? '검색 중…' : '검색'}
            </Button>
          </div>

          {candidates.length > 0 && (
            <div className="space-y-2">
              {candidates.map((c, i) => (
                <button key={c.external_code ?? i} onClick={() => handleSelect(c)} className="w-full text-left">
                  <div
                    className={`rounded-md border px-3 py-2 text-sm transition-all ${
                      selected?.external_code === c.external_code
                        ? 'border-primary ring-2 ring-primary ring-offset-1'
                        : 'hover:border-muted-foreground/40'
                    }`}
                  >
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.type_name} · {c.address}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      현원 {c.current_count ?? '-'}명 · 통학차량 {c.has_shuttle ? '운영' : '미운영'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. 선택 + 로그인 정보 */}
      {selected && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">2. 로그인 정보 설정</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              선택: <span className="font-medium text-foreground">{selected.name}</span> · 현원{' '}
              {selected.current_count ?? '-'}명 · 영아 {selected.infant_total_count}명 · 유아{' '}
              {selected.preschool_total_count}명 · 교직원 {selected.staff_total ?? '-'}명
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">로그인 등록번호</label>
              <input
                type="text"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="기관코드 또는 사용할 등록번호"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-sm font-medium">PIN (4~8자리)</label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm tracking-widest"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">PIN 확인</label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={pin2}
                  onChange={(e) => setPin2(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm tracking-widest"
                />
              </div>
            </div>
            <Button onClick={handleRegister} disabled={submitting} className="w-full min-h-[48px] text-base font-semibold">
              {submitting ? '등록 중…' : '기관 등록하고 시작하기'}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="mb-6 text-center text-sm text-muted-foreground">
        이미 등록하셨나요?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          로그인
        </Link>
      </div>

      <SafetyNotice />
    </div>
  )
}
