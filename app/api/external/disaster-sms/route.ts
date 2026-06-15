import { NextRequest, NextResponse } from 'next/server'
import { fetchRecentDisasterSms } from '@/lib/external/disasterSms'
import type { DisasterType } from '@/lib/disaster/types'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sido = searchParams.get('sido')
  // 재난유형 필터 (optional): 지정 시 해당 유형만 반환
  const disasterType = searchParams.get('disaster_type') as DisasterType | null

  try {
    const items = await fetchRecentDisasterSms(sido, disasterType)
    return NextResponse.json({ data: items, count: items.length })
  } catch (err) {
    console.error('[GET /api/external/disaster-sms]', err)
    return NextResponse.json({ data: [], count: 0, error: 'fetch failed' }, { status: 500 })
  }
}
