import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { USE_SAMPLE_FALLBACK } from '@/lib/env'
import { classifyFromText } from '@/lib/external/disasterSms'
import { classifyDisasterWithAi } from '@/lib/ai/classifyDisaster'

const Schema = z.object({ raw_text: z.string().min(1).max(5000) })

/**
 * 재난문자 원문 → 재난유형 자동 분류.
 * 1차: 키워드 분류(classifyFromText). 'other'면 2차 AI 보조 분류.
 * 응답: { disaster_type, source }  (disaster_type은 'other' 가능 → 클라이언트에서 수동 선택 유도)
 */
export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
  }
  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: '재난문자 내용을 입력해 주세요.' }, { status: 400 })
  }

  const text = parsed.data.raw_text
  const keyword = classifyFromText(text)
  if (keyword !== 'other') {
    return NextResponse.json({ data: { disaster_type: keyword, source: 'keyword' } })
  }

  // 키워드 미분류 → AI 보조 (샘플 모드/키부재 시 'other' 유지)
  if (USE_SAMPLE_FALLBACK) {
    return NextResponse.json({ data: { disaster_type: 'other', source: 'sample' } })
  }
  const ai = await classifyDisasterWithAi(text)
  return NextResponse.json({ data: { disaster_type: ai, source: ai === 'other' ? 'none' : 'ai' } })
}
