// Claude API 호출 — JSON-only, 타임아웃 12s, 1회 재시도, 샘플 fallback (docs/04 §5)
// 서버 전용 — 브라우저에서 절대 import 금지
import Anthropic from '@anthropic-ai/sdk'
import { ANTHROPIC_API_KEY, ANTHROPIC_MODEL } from '@/lib/env'
import { AiPlanSchema, SAFETY_DISCLAIMER_FIXED, type AiPlanResult } from './aiPlanSchema'
import { ensureLegacyChecklists } from './legacyAdapter'
import { buildSystemPrompt, OUTPUT_SCHEMA_HINT } from './buildSystemPrompt'
import {
  SAMPLE_AI_RESULT,
  SAMPLE_HEAVY_RAIN_AI_RESULT,
  SAMPLE_INFECTION_AI_RESULT,
} from '@/lib/sample'
import type { AiInput } from './buildAiInput'

const TIMEOUT_MS = 12_000

// 재난유형별 샘플 결과 선택 — AI 실패/키부재 fallback이 유형에 맞는 본문을 반환하도록.
// (이전: 폭염 SAMPLE_AI_RESULT 고정 + disaster_type만 덮어써 본문이 폭염으로 노출되던 버그 수정)
function sampleResultFor(disasterType: AiInput['disaster_type']): AiPlanResult {
  const base =
    disasterType === 'heavy_rain'
      ? SAMPLE_HEAVY_RAIN_AI_RESULT
      : disasterType === 'infection'
        ? SAMPLE_INFECTION_AI_RESULT
        : SAMPLE_AI_RESULT
  return {
    ...(base as AiPlanResult),
    disaster_type: disasterType,
    safety_disclaimer: SAFETY_DISCLAIMER_FIXED,
  } as AiPlanResult
}

function buildUserMessage(input: AiInput): string {
  return `${OUTPUT_SCHEMA_HINT}

[입력 데이터]
${JSON.stringify(input, null, 2)}`
}

function buildRetryMessage(prevOutput: string): string {
  return `직전 출력이 JSON 스키마를 위반했습니다. 아래 형식을 정확히 따라 JSON만 다시 출력하세요.

${OUTPUT_SCHEMA_HINT}

직전 출력:
${prevOutput.slice(0, 500)}`
}

function extractJson(text: string): string {
  // 코드블록 제거 후 첫 '{' ~ 마지막 '}'
  const cleaned = text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) throw new Error('JSON not found in response')
  return cleaned.slice(start, end + 1)
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms)
    ),
  ])
}

export interface CallClaudeResult {
  result: AiPlanResult
  is_fallback: boolean
  model: string
  raw_text?: string
}

export async function callClaudeWithFallback(input: AiInput): Promise<CallClaudeResult> {
  if (!ANTHROPIC_API_KEY) {
    return {
      result: sampleResultFor(input.disaster_type),
      is_fallback: true,
      model: 'sample',
    }
  }

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY })
  // 재난유형별 시스템 프롬프트 조립 (T8-3)
  const systemPrompt = buildSystemPrompt(input.disaster_type)
  let lastRawText = ''

  // 1차 시도
  try {
    const raw = await withTimeout(
      callOnce(client, systemPrompt, buildUserMessage(input)),
      TIMEOUT_MS
    )
    lastRawText = raw
    const parsed = AiPlanSchema.safeParse(JSON.parse(extractJson(raw)))
    if (parsed.success) {
      // ensureLegacyChecklists returns db.ts::AiPlanResult (disaster_type optional)
      // but parsed.data is Zod-validated so disaster_type is always present — safe cast
      const withLegacy = ensureLegacyChecklists(parsed.data) as AiPlanResult
      return {
        result: { ...withLegacy, safety_disclaimer: SAFETY_DISCLAIMER_FIXED },
        is_fallback: false,
        model: ANTHROPIC_MODEL,
        raw_text: raw,
      }
    }
    console.warn('[callClaude] zod 검증 실패, 재시도')
  } catch (err) {
    console.warn('[callClaude] 1차 시도 실패:', err)
  }

  // 2차 재시도 (docs/04 §5 4번)
  try {
    const raw = await withTimeout(
      callOnce(client, systemPrompt, buildRetryMessage(lastRawText)),
      TIMEOUT_MS
    )
    const parsed = AiPlanSchema.safeParse(JSON.parse(extractJson(raw)))
    if (parsed.success) {
      const withLegacy = ensureLegacyChecklists(parsed.data) as AiPlanResult
      return {
        result: { ...withLegacy, safety_disclaimer: SAFETY_DISCLAIMER_FIXED },
        is_fallback: false,
        model: ANTHROPIC_MODEL,
        raw_text: raw,
      }
    }
    console.warn('[callClaude] 재시도도 zod 검증 실패, 샘플 fallback')
  } catch (err) {
    console.warn('[callClaude] 2차 재시도 실패:', err)
  }

  // 샘플 fallback (docs/04 §5 5번) — 재난유형별 본문 반환
  return {
    result: sampleResultFor(input.disaster_type),
    is_fallback: true,
    model: 'sample',
  }
}

async function callOnce(
  client: Anthropic,
  systemPrompt: string,
  userContent: string
): Promise<string> {
  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      { role: 'user', content: userContent },
      { role: 'assistant', content: '{' }, // JSON-only 강제 (prefill)
    ],
  })
  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return '{' + text // prefill '{' 재결합
}
