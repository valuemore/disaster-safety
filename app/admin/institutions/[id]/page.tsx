import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { InstitutionCard } from '@/components/admin/InstitutionCard'
import { RecentPlanList } from '@/components/admin/RecentPlanList'
import { USE_SAMPLE_FALLBACK } from '@/lib/env'
import { SAMPLE_INSTITUTIONS, SAMPLE_ADMIN_PLANS } from '@/lib/sample'
import { getSampleInstitution } from '@/lib/sample/institutions'
import type { AdminPlanRow } from '@/lib/sample/admin'
import type { Institution } from '@/lib/types/db'

interface PageProps {
  params: Promise<{ id: string }>
}

async function getInstitutionDetail(id: string): Promise<{
  institution: Institution | null
  plans: AdminPlanRow[]
  isSample: boolean
}> {
  if (USE_SAMPLE_FALLBACK) {
    const institution = getSampleInstitution(id) ?? SAMPLE_INSTITUTIONS[0]
    const plans = SAMPLE_ADMIN_PLANS.filter((p) => p.institution_id === institution.id)
    return { institution, plans, isSample: true }
  }

  try {
    const { createAdminSupabaseClient } = await import('@/lib/supabase/server')
    const supabase = createAdminSupabaseClient()

    const [instResult, plansResult] = await Promise.all([
      supabase.from('institutions').select('*').eq('id', id).single(),
      supabase
        .from('action_requests')
        .select(`id, institution_id, priority, is_fallback, created_by_role, created_at, result_json`)
        .eq('institution_id', id)
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    if (instResult.error || !instResult.data) {
      // ID 불일치 → 샘플 fallback
      const institution = getSampleInstitution(id) ?? SAMPLE_INSTITUTIONS[0]
      return {
        institution,
        plans: SAMPLE_ADMIN_PLANS.filter((p) => p.institution_id === institution.id),
        isSample: true,
      }
    }

    const institution = instResult.data as Institution
    const plans: AdminPlanRow[] = (plansResult.data ?? []).map((row: Record<string, unknown>) => {
      const resultJson = row.result_json as { disaster_summary?: string } | null
      return {
        id: row.id as string,
        institution_id: row.institution_id as string,
        institution_name: institution.name,
        priority: row.priority as AdminPlanRow['priority'],
        created_at: row.created_at as string,
        is_fallback: row.is_fallback as boolean,
        created_by_role: row.created_by_role as string | null,
        disaster_summary: resultJson?.disaster_summary ?? '',
      }
    })

    return { institution, plans, isSample: false }
  } catch (err) {
    console.error('[admin institution detail]', err)
    const institution = getSampleInstitution(id) ?? SAMPLE_INSTITUTIONS[0]
    return {
      institution,
      plans: SAMPLE_ADMIN_PLANS.filter((p) => p.institution_id === institution.id),
      isSample: true,
    }
  }
}

export default async function AdminInstitutionDetailPage({ params }: PageProps) {
  const { id } = await params
  const { institution, plans, isSample } = await getInstitutionDetail(id)

  if (!institution) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6">
        <p className="text-sm text-muted-foreground">기관을 찾을 수 없습니다.</p>
        <Link href="/admin">
          <Button variant="outline" size="sm" className="mt-4">
            ← 대시보드로
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* 브레드크럼 */}
      <div className="mb-4 flex items-center gap-2 text-sm">
        <Link href="/admin" className="text-muted-foreground hover:text-foreground">
          대시보드
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium">{institution.name}</span>
      </div>

      {isSample && (
        <p className="mb-3 text-xs text-muted-foreground">샘플 데이터 기준</p>
      )}

      {/* 기관 정보 카드 */}
      <section className="mb-6">
        <InstitutionCard institution={institution} showDetailLink={false} />
      </section>

      {/* 기관 주소 */}
      {institution.address && (
        <p className="mb-6 text-xs text-muted-foreground px-1">{institution.address}</p>
      )}

      {/* 이 기관의 대응계획 목록 */}
      <section>
        <RecentPlanList
          plans={plans}
          title="이 기관의 대응계획 이력"
          showInstitution={false}
        />
      </section>

      {/* 기관 등록 데이터 수정 */}
      <div className="mt-6 flex gap-2">
        <Link href={`/institutions/${institution.id}/profile`}>
          <Button variant="outline" size="sm">
            폭염 프로필 수정
          </Button>
        </Link>
        <Link href="/admin">
          <Button variant="ghost" size="sm">
            ← 대시보드
          </Button>
        </Link>
      </div>
    </div>
  )
}
