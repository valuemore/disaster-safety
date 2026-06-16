import { NextRequest, NextResponse } from 'next/server'
import { USE_SAMPLE_FALLBACK } from '@/lib/env'
import { SAMPLE_INSTITUTIONS } from '@/lib/sample'

/**
 * 관리자용 기관 목록 — 페이지네이션 + 검색 + 지역 필터 (1,000개+ 대비).
 * GET ?q=&sido=&page=&size=
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') ?? '').trim()
  const sido = (searchParams.get('sido') ?? '').trim()
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1)
  const size = Math.min(50, Math.max(5, Number(searchParams.get('size') ?? '20') || 20))

  if (USE_SAMPLE_FALLBACK) {
    let data = SAMPLE_INSTITUTIONS
    if (q) data = data.filter((i) => i.name.includes(q))
    if (sido) data = data.filter((i) => i.sido === sido)
    return NextResponse.json({ data, total: data.length, page, size, source: 'sample' })
  }

  try {
    const { createAdminSupabaseClient } = await import('@/lib/supabase/server')
    const supabase = createAdminSupabaseClient()

    const from = (page - 1) * size
    let query = supabase
      .from('institutions')
      .select('id, name, type, sido, sigungu, total_children, has_shuttle, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + size - 1)

    if (q) query = query.ilike('name', `%${q}%`)
    if (sido) query = query.eq('sido', sido)

    const { data, count, error } = await query
    if (error) throw error
    return NextResponse.json({ data: data ?? [], total: count ?? 0, page, size, source: 'db' })
  } catch (err) {
    console.error('[GET /api/admin/institutions]', err)
    return NextResponse.json({ data: SAMPLE_INSTITUTIONS, total: SAMPLE_INSTITUTIONS.length, page, size, source: 'sample' })
  }
}
