export const dynamic = 'force-dynamic'

import { StatsCards } from '@/components/admin/StatsCards'
import { RecentPlanList } from '@/components/admin/RecentPlanList'
import { InstitutionCard } from '@/components/admin/InstitutionCard'
import { DisasterTypeSummary } from '@/components/admin/DisasterTypeSummary'
import { USE_SAMPLE_FALLBACK } from '@/lib/env'
import { SAMPLE_ADMIN_STATS, SAMPLE_ADMIN_PLANS } from '@/lib/sample/admin'
import { SAMPLE_INSTITUTIONS } from '@/lib/sample'
import type { AdminStats, AdminPlanRow } from '@/lib/sample/admin'
import type { Institution, DisasterType } from '@/lib/types/db'

/**
 * AdminPlanRow 배열에서 재난유형별 건수를 집계한다.
 * result_json.disaster_type 이 없거나 알 수 없으면 'heatwave' 로 fallback (레거시 호환).
 */
function aggregateDisasterTypeCounts(
  plans: AdminPlanRow[],
): Partial<Record<DisasterType, number>> {
  const counts: Partial<Record<DisasterType, number>> = {}
  const validTypes: DisasterType[] = ['heatwave', 'heavy_rain', 'infection']
  for (const plan of plans) {
    const type: DisasterType =
      plan.disaster_type && validTypes.includes(plan.disaster_type)
        ? plan.disaster_type
        : 'heatwave'
    counts[type] = (counts[type] ?? 0) + 1
  }
  return counts
}

async function getAdminData(): Promise<{
  stats: AdminStats
  plans: AdminPlanRow[]
  institutions: Institution[]
  isSample: boolean
}> {
  if (USE_SAMPLE_FALLBACK) {
    return {
      stats: SAMPLE_ADMIN_STATS,
      plans: SAMPLE_ADMIN_PLANS,
      institutions: SAMPLE_INSTITUTIONS,
      isSample: true,
    }
  }

  try {
    const { createAdminSupabaseClient } = await import('@/lib/supabase/server')
    const supabase = createAdminSupabaseClient()

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [instResult, todayResult, highResult, plansResult, institutionsResult] =
      await Promise.all([
        supabase.from('institutions').select('id', { count: 'exact', head: true }),
        supabase
          .from('action_requests')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', todayStart.toISOString()),
        supabase
          .from('action_requests')
          .select('institution_id', { count: 'exact', head: true })
          .eq('priority', 'high')
          .gte('created_at', todayStart.toISOString()),
        supabase
          .from('action_requests')
          .select(`id, institution_id, priority, is_fallback, created_by_role, created_at, result_json, institutions!inner(name)`)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase.from('institutions').select('*').order('created_at', { ascending: false }),
      ])

    const plans: AdminPlanRow[] = (plansResult.data ?? []).map((row: Record<string, unknown>) => {
      const inst = row.institutions as { name: string } | null
      const resultJson = row.result_json as { disaster_summary?: string; disaster_type?: DisasterType } | null
      return {
        id: row.id as string,
        institution_id: row.institution_id as string,
        institution_name: inst?.name ?? '(알 수 없음)',
        priority: row.priority as AdminPlanRow['priority'],
        created_at: row.created_at as string,
        is_fallback: row.is_fallback as boolean,
        created_by_role: row.created_by_role as string | null,
        disaster_summary: resultJson?.disaster_summary ?? '',
        disaster_type: resultJson?.disaster_type ?? null,
      }
    })

    // 재난유형별 건수 집계 (result_json.disaster_type 기반, 레거시는 'heatwave' fallback)
    const disaster_type_counts = aggregateDisasterTypeCounts(plans)

    const stats: AdminStats = {
      institution_count: instResult.count ?? 0,
      today_plan_count: todayResult.count ?? 0,
      high_priority_count: highResult.count ?? 0,
      disaster_type_counts,
    }

    const institutions = (institutionsResult.data ?? []) as Institution[]

    return { stats, plans, institutions, isSample: false }
  } catch (err) {
    console.error('[admin page]', err)
    return {
      stats: SAMPLE_ADMIN_STATS,
      plans: SAMPLE_ADMIN_PLANS,
      institutions: SAMPLE_INSTITUTIONS,
      isSample: true,
    }
  }
}

export default async function AdminPage() {
  const { stats, plans, institutions, isSample } = await getAdminData()

  // 재난유형별 건수: stats 에 포함된 값 우선, 없으면 plans 에서 클라이언트 집계
  const disasterTypeCounts =
    stats.disaster_type_counts ?? aggregateDisasterTypeCounts(plans)

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold">관리자 대시보드</h1>
        <p className="text-sm text-muted-foreground">관할 유아교육기관 재난 대응 현황</p>
      </div>

      {/* 통계 카드 */}
      <section className="mb-6">
        <StatsCards stats={stats} isSample={isSample} />
      </section>

      {/* 재난유형별 생성 현황 */}
      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold">재난유형별 생성 현황</h2>
        <div className="rounded-lg border bg-card p-4">
          <DisasterTypeSummary counts={disasterTypeCounts} />
        </div>
      </section>

      {/* 최근 대응계획 목록 */}
      <section className="mb-6">
        <RecentPlanList plans={plans} title="최근 대응계획" showInstitution />
      </section>

      {/* 등록 기관 목록 (역할 지정 현황 포함) */}
      <section>
        <h2 className="mb-3 text-sm font-semibold">등록 기관 · 역할 지정 현황</h2>
        <div className="space-y-3">
          {institutions.length === 0 ? (
            <p className="text-sm text-muted-foreground">등록된 기관이 없습니다.</p>
          ) : (
            institutions.map((inst) => (
              <InstitutionCard key={inst.id} institution={inst} showDetailLink />
            ))
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          역할 지정 현황은 기관 프로필 기반 참고 정보이며, 실제 법적 의무 여부는 관할 기관에 직접 확인하세요.
        </p>
      </section>
    </div>
  )
}
