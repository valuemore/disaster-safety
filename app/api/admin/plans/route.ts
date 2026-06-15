import { NextRequest, NextResponse } from 'next/server'
import { USE_SAMPLE_FALLBACK } from '@/lib/env'
import { SAMPLE_ADMIN_PLANS, type AdminPlanRow } from '@/lib/sample/admin'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const institutionId = searchParams.get('institution_id')
  const limit = Math.min(Number(searchParams.get('limit') ?? '20'), 50)

  if (USE_SAMPLE_FALLBACK) {
    const filtered = institutionId
      ? SAMPLE_ADMIN_PLANS.filter((p) => p.institution_id === institutionId)
      : SAMPLE_ADMIN_PLANS
    return NextResponse.json({ data: filtered.slice(0, limit), source: 'sample' })
  }

  try {
    const { createAdminSupabaseClient } = await import('@/lib/supabase/server')
    const supabase = createAdminSupabaseClient()

    let query = supabase
      .from('action_requests')
      .select(`
        id,
        institution_id,
        priority,
        is_fallback,
        created_by_role,
        created_at,
        result_json,
        institutions!inner(name)
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (institutionId) {
      query = query.eq('institution_id', institutionId)
    }

    const { data, error } = await query
    if (error) throw error

    const plans: AdminPlanRow[] = (data ?? []).map((row: Record<string, unknown>) => {
      const inst = row.institutions as { name: string } | null
      const resultJson = row.result_json as { disaster_summary?: string } | null
      return {
        id: row.id as string,
        institution_id: row.institution_id as string,
        institution_name: inst?.name ?? '(알 수 없음)',
        priority: row.priority as AdminPlanRow['priority'],
        created_at: row.created_at as string,
        is_fallback: row.is_fallback as boolean,
        created_by_role: row.created_by_role as string | null,
        disaster_summary: resultJson?.disaster_summary ?? '',
      }
    })

    return NextResponse.json({ data: plans, source: 'db' })
  } catch (err) {
    console.error('[GET /api/admin/plans]', err)
    const filtered = institutionId
      ? SAMPLE_ADMIN_PLANS.filter((p) => p.institution_id === institutionId)
      : SAMPLE_ADMIN_PLANS
    return NextResponse.json({ data: filtered.slice(0, limit), source: 'sample' })
  }
}
