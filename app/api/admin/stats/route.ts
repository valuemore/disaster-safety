import { NextResponse } from 'next/server'
import { USE_SAMPLE_FALLBACK } from '@/lib/env'
import { SAMPLE_ADMIN_STATS } from '@/lib/sample/admin'

export async function GET() {
  if (USE_SAMPLE_FALLBACK) {
    return NextResponse.json({ data: SAMPLE_ADMIN_STATS, source: 'sample' })
  }

  try {
    const { createAdminSupabaseClient } = await import('@/lib/supabase/server')
    const supabase = createAdminSupabaseClient()

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [instResult, todayResult, highResult] = await Promise.all([
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
    ])

    return NextResponse.json({
      data: {
        institution_count: instResult.count ?? 0,
        today_plan_count: todayResult.count ?? 0,
        high_priority_count: highResult.count ?? 0,
      },
      source: 'db',
    })
  } catch (err) {
    console.error('[GET /api/admin/stats]', err)
    return NextResponse.json({ data: SAMPLE_ADMIN_STATS, source: 'sample' })
  }
}
