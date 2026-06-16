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

  // cpmsapi030 코드 기반 실 상세조회 (운영 인증키 적용 시 실데이터)
  const [arcode, setArcode] = useState('')
  const [stcode, setStcode] = useState('')
  const [codeLoading, setCodeLoading] = useState(false)

  const [loginId, setLoginId] = useState('')
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [submitting, setSubmitting] = useState(false)

  /** 응답 메타에 따른 안내 토스트 (개발키/목록API 상태 구분) */
  function notifySource(source: string, error?: string) {
    if (source === 'api') return
    if (error === 'guide_template_only') {
      toast.info('개발용 인증키 응답(레이아웃 가이드)입니다. 운영 인증키 적용 시 실데이터가 표시됩니다. 우선 예시값으로 진행할 수 있습니다.')
    } else if (error === 'list_api_unavailable') {
      toast.info('이름 검색은 목록 API 승인 후 제공됩니다. 어린이집 코드로 불러오거나 예시값으로 진행하세요.')
    } else {
      toast.info('포털 API 응답이 없어 예시 결과를 표시합니다.')
    }
  }

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
      notifySource(json.source, json.error)
      if ((json.data ?? []).length === 0) toast.error('검색 결과가 없습니다.')
    } catch {
      toast.error('검색에 실패했습니다.')
    } finally {
      setSearching(false)
    }
  }

  /** cpmsapi030 코드 기반 실 상세조회 */
  async function handleCodeLookup() {
    if (!arcode.trim() || !stcode.trim()) {
      toast.error('지역코드(arcode)와 어린이집코드(stcode)를 입력하세요.')
      return
    }
    setCodeLoading(true)
    try {
      const res = await fetch(
        `/api/external/childcare?arcode=${encodeURIComponent(arcode.trim())}&code=${encodeURIComponent(stcode.trim())}&type=${type}`
      )
      const json = await res.json()
      setCandidates(json.data ?? [])
      notifySource(json.source, json.error)
      if (json.source === 'api' && (json.data ?? []).length > 0) {
        toast.success('포털 실데이터를 불러왔습니다.')
        handleSelect(json.data[0])
      }
    } catch {
      toast.error('조회에 실패했습니다.')
    } finally {
      setCodeLoading(false)
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
      toast.success('기관이 등록되었습니다. 재난 대응 프로필을 입력하세요.')
      router.push(`/institutions/${json.data.id}/profile?onboarding=1`)
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

          {/* 어린이집 코드로 직접 조회 (cpmsapi030 상세 — 운영 인증키 적용 시 실데이터) */}
          <details className="rounded-md border bg-muted/30 p-2">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
              어린이집 코드로 불러오기 (지역코드 + 어린이집코드)
            </summary>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={arcode}
                onChange={(e) => setArcode(e.target.value)}
                placeholder="지역코드(arcode)"
                className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={stcode}
                onChange={(e) => setStcode(e.target.value)}
                placeholder="어린이집코드(stcode)"
                className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
              />
              <Button variant="outline" onClick={handleCodeLookup} disabled={codeLoading} className="shrink-0">
                {codeLoading ? '조회 중…' : '불러오기'}
              </Button>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              현재는 개발용 인증키로 레이아웃 응답만 제공됩니다. 운영 인증키 승인 후 실데이터가 자동 반영됩니다.
            </p>
          </details>

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
