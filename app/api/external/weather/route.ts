import { NextRequest, NextResponse } from 'next/server'
import { fetchWeatherContext, SAMPLE_WEATHER } from '@/lib/external/weather'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')

  if (!lat || !lng) {
    return NextResponse.json({ error: 'lat, lng 파라미터가 필요합니다.' }, { status: 400 })
  }

  const latNum = parseFloat(lat)
  const lngNum = parseFloat(lng)
  if (isNaN(latNum) || isNaN(lngNum)) {
    return NextResponse.json({ error: 'lat, lng는 숫자여야 합니다.' }, { status: 400 })
  }

  try {
    const result = await fetchWeatherContext(latNum, lngNum)
    return NextResponse.json({ data: result, source: result.source })
  } catch (err) {
    console.error('[GET /api/external/weather]', err)
    return NextResponse.json({ data: { ...SAMPLE_WEATHER }, source: 'sample' })
  }
}
