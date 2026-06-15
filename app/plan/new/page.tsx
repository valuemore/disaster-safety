'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useRole } from '@/components/providers/RoleProvider'
import { useWizardState } from '@/lib/hooks/useWizardState'
import type { Institution } from '@/lib/types/db'

const ROLE_LABELS: Record<string, string> = {
  director: '원장',
  teacher: '담임교사',
  shuttle: '통학버스 담당자',
  admin: '지자체 관리자',
}

const TYPE_LABEL = { daycare: '어린이집', kindergarten: '유치원' } as const

function PlanNewInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { role } = useRole()
  const { update, reset } = useWizardState()

  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(
    searchParams.get('institution')
  )

  useEffect(() => {
    reset()
    fetch('/api/institutions')
      .then((r) => r.json())
      .then(({ data }) => setInstitutions(data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [reset])

  function handleStart() {
    if (!selectedId) return
    const inst = institutions.find((i) => i.id === selectedId)
    update({
      institution_id: selectedId,
      institution_name: inst?.name ?? null,
      has_shuttle: inst?.has_shuttle ?? false,
    })
    router.push('/plan/new/message')
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-2 flex items-center gap-2">
        {role && (
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {ROLE_LABELS[role] ?? role}
          </span>
        )}
        <span className="text-xs text-muted-foreground">대응계획 생성</span>
      </div>

      <h1 className="mb-1 text-xl font-bold">기관 선택</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        대응계획을 생성할 기관을 선택하세요.
      </p>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : institutions.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">등록된 기관이 없습니다.</p>
          <Link href="/institutions/new">
            <Button variant="outline" size="sm" className="mt-4">
              기관 등록하기
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {institutions.map((inst) => (
            <button
              key={inst.id}
              onClick={() => setSelectedId(inst.id)}
              className="w-full text-left"
            >
              <Card
                className={`cursor-pointer transition-all ${
                  selectedId === inst.id
                    ? 'border-primary ring-2 ring-primary ring-offset-1'
                    : 'hover:border-muted-foreground/40'
                }`}
              >
                <CardHeader className="pb-1 pt-3">
                  <CardTitle className="flex items-center justify-between text-sm">
                    <span>{inst.name}</span>
                    {selectedId === inst.id && (
                      <span className="text-xs font-normal text-primary">선택됨 ✓</span>
                    )}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {TYPE_LABEL[inst.type]} · {inst.sido} {inst.sigungu}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-3">
                  <p className="text-xs text-muted-foreground">
                    유아 {inst.total_children ?? '?'}명
                    {inst.has_shuttle ? ' · 통학버스 운영' : ''}
                  </p>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}

      <div className="mt-6 space-y-3">
        <Button
          onClick={handleStart}
          disabled={!selectedId}
          className="w-full min-h-[48px] text-base"
        >
          선택한 기관으로 시작하기
        </Button>
        <Link href="/institutions/new" className="block">
          <Button variant="outline" className="w-full">
            새 기관 등록하기
          </Button>
        </Link>
      </div>
    </div>
  )
}

export default function PlanNewPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl px-4 py-6 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      }
    >
      <PlanNewInner />
    </Suspense>
  )
}
