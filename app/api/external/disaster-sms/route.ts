import { NextRequest, NextResponse } from 'next/server'
import { fetchRecentDisasterSms } from '@/lib/external/disasterSms'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sido = searchParams.get('sido')

  try {
    const items = await fetchRecentDisasterSms(sido)
    return NextResponse.json({ data: items, count: items.length })
  } catch (err) {
    console.error('[GET /api/external/disaster-sms]', err)
    return NextResponse.json({ data: [], count: 0, error: 'fetch failed' }, { status: 500 })
  }
}
