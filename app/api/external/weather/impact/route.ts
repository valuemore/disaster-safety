import { NextRequest, NextResponse } from 'next/server'
import { fetchImpactForecast } from '@/lib/external/impactForecast'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sido = searchParams.get('sido')

  try {
    const forecast = await fetchImpactForecast(sido)
    return NextResponse.json({ data: forecast, source: forecast.source })
  } catch (err) {
    console.error('[GET /api/external/weather/impact]', err)
    return NextResponse.json({ error: 'fetch failed' }, { status: 500 })
  }
}
