// 재난문자 원문 → 재난유형 AI 보조 분류 (서버 전용)
// 키워드 분류(classifyFromText)가 'other'일 때만 호출하는 경량 1콜.
import Anthropic from '@anthropic-ai/sdk'
import { ANTHROPIC_API_KEY, ANTHROPIC_MODEL } from '@/lib/env'
import type { DisasterType } from '@/lib/disaster/types'

const TIMEOUT_MS = 12_000

const SYSTEM = `너는 한국 재난문자를 분류하는 분류기다.
입력 문자를 다음 중 하나로만 분류해 한 단어로 답하라:
- heatwave (폭염·고온·온열)
- heavy_rain (호우·집중호우·침수·태풍·홍수)
- infection (감염병·확진·유행·방역)
- other (위 셋에 해당하지 않음)
오직 위 영문 키워드 하나만 출력한다. 설명·문장 금지.`

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), ms)),
  ])
}

/**
 * 재난문자 원문을 AI로 분류한다. 실패/키부재 시 'other' 반환.
 */
export async function classifyDisasterWithAi(
  rawText: string
): Promise<DisasterType | 'other'> {
  if (!ANTHROPIC_API_KEY || !rawText.trim()) return 'other'
  try {
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY })
    const res = await withTimeout(
      client.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 8,
        system: SYSTEM,
        messages: [{ role: 'user', content: rawText.slice(0, 1000) }],
      }),
      TIMEOUT_MS
    )
    const text = (res.content[0]?.type === 'text' ? res.content[0].text : '').trim().toLowerCase()
    if (text.includes('heatwave')) return 'heatwave'
    if (text.includes('heavy_rain') || text.includes('heavy')) return 'heavy_rain'
    if (text.includes('infection')) return 'infection'
    return 'other'
  } catch (err) {
    console.warn('[classifyDisasterWithAi] fallback to other:', err)
    return 'other'
  }
}
