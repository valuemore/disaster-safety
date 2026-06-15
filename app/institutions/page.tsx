import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SAMPLE_INSTITUTIONS } from '@/lib/sample'
import { USE_SAMPLE_FALLBACK } from '@/lib/env'
import type { Institution } from '@/lib/types/db'

export const metadata = {
  title: '기관 관리 — 재난안전MVP',
}

async function getInstitutions(): Promise<{ data: Institution[]; source: string }> {
  if (USE_SAMPLE_FALLBACK) {
    return { data: SAMPLE_INSTITUTIONS, source: 'sample' }
  }
  try {
    const { createAdminSupabaseClient } = await import('@/lib/supabase/server')
    const supabase = createAdminSupabaseClient()
    const { data, error } = await supabase
      .from('institutions')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return { data: data as Institution[], source: 'db' }
  } catch {
    return { data: SAMPLE_INSTITUTIONS, source: 'sample' }
  }
}

const TYPE_LABEL = { daycare: '어린이집', kindergarten: '유치원' } as const

export default async function InstitutionsPage() {
  const { data: institutions, source } = await getInstitutions()

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">기관 관리</h1>
          {source === 'sample' && (
            <p className="mt-1 text-xs text-muted-foreground">샘플 데이터로 표시 중</p>
          )}
        </div>
        <Link href="/institutions/new">
          <Button size="sm">+ 기관 등록</Button>
        </Link>
      </div>

      {institutions.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">등록된 기관이 없습니다.</p>
          <Link href="/institutions/new">
            <Button variant="outline" size="sm" className="mt-4">
              기관 등록하기
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {institutions.map((inst) => (
            <Card key={inst.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{inst.name}</CardTitle>
                <CardDescription>
                  {TYPE_LABEL[inst.type]} · {inst.sido} {inst.sigungu}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  유아 {inst.total_children ?? '?'}명 · 교직원 {inst.staff_count ?? '?'}명
                  {inst.has_shuttle ? ' · 통학버스' : ''}
                </p>
                <Link href={`/institutions/${inst.id}/profile`}>
                  <Button variant="outline" size="sm">
                    프로필
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
