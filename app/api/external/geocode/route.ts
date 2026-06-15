import { NextRequest, NextResponse } from 'next/server'
import { geocodeAddress } from '@/lib/external/geocode'

export async function GET(req: NextRequest) {
  const query = new URL(req.url).searchParams.get('query') ?? ''
  if (!query.trim()) {
    return NextResponse.json({ error: '주소를 입력해 주세요.' }, { status: 400 })
  }

  try {
    const result = await geocodeAddress(query)
    return NextResponse.json({ data: result, source: result.source })
  } catch (err) {
    console.error('[GET /api/external/geocode]', err)
    return NextResponse.json({ error: '주소 변환 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
