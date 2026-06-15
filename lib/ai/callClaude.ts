// Claude API 호출 — JSON-only, 타임아웃 12s, 1회 재시도, 샘플 fallback (docs/04 §5)
// 서버 전용 — 브라우저에서 절대 import 금지
import Anthropic from '@anthropic-ai/sdk'
import { ANTHROPIC_API_KEY, ANTHROPIC_MODEL } from '@/lib/env'
import { AiPlanSchema, SAFETY_DISCLAIMER_FIXED, type AiPlanResult } from './aiPlanSchema'
import { SAMPLE_AI_RESULT } from '@/lib/sample'
import type { AiInput } from './buildAiInput'

const TIMEOUT_MS = 12_000

// docs/04 §3 시스템 프롬프트
const SYSTEM_PROMPT = `당신은 한국의 유아교육기관(어린이집·유치원) 폭염 재난대응을 지원하는 보조 도구입니다.
입력으로 받은 '공식 재난문자', '기관 집계정보', '폭염 대응 프로필(숫자 집계값)', '현재 상황'만을
근거로, 원장·담임교사·통학버스 담당자가 즉시 실행할 수 있는 구체적 행동을 한국어로 생성합니다.

반드시 지킬 규칙:
1) 출력은 지정된 JSON 객체 하나만 출력합니다. JSON 외의 설명, 마크다운, 코드블록 표시를 절대 포함하지 않습니다.
2) 의료 진단, 질병명 단정, 약물 권고를 하지 않습니다. 건강 이상이 의심되면 '그늘/실내 이동, 수분, 체온 확인, 필요 시 119' 수준의 일반 안전 행동만 안내합니다.
3) 당신의 안내가 공식기관(지자체·소방·기상청) 지시보다 우선한다고 표현하지 않습니다. 항상 공식 지시와 119를 우선하도록 안내합니다.
4) 학부모 안내문은 과도한 공포·불안을 조장하지 않고, 기관이 이미 적절히 조치 중임을 전제로 안정감을 주며, 보호자가 할 구체 행동을 포함합니다.
5) 개인을 식별하는 정보(이름, 진단명, 약물명, 연락처)를 만들어내거나 요구하지 않습니다.
6) 입력에 없는 사실을 지어내지 않습니다. 부족하면 missing_info에 적습니다.
7) 'reflected_evidence'에는 실제로 반영한 입력 항목을 구체적으로 적어 입력→결과의 연결을 드러냅니다.`

const OUTPUT_SCHEMA_HINT = `아래 JSON 스키마에 정확히 맞는 객체 하나만 출력합니다. 다른 텍스트는 일절 포함하지 않습니다.

{
  "disaster_summary": "재난문자 핵심 요약(1~3문장)",
  "priority": "high | medium | low",
  "priority_reason": "우선순위 판단 근거(1~2문장)",
  "reflected_evidence": ["반영된 근거 정보(최소 1개)"],
  "missing_info": ["더 나은 대응에 필요한 부족 정보"],
  "director_checklist": ["원장용 실행 항목(최소 3개)"],
  "teacher_checklist": ["담임교사용 실행 항목(최소 3개)"],
  "shuttle_checklist": ["통학버스 담당자용 항목, has_shuttle:false이면 ['해당 없음']"],
  "parent_notice": "학부모 안내문(공포 금지, 안정감, 구체 행동)",
  "after_action_draft": {
    "outdoor_adjusted": "null 또는 권고 메모",
    "cooling_checked": "null 또는 권고 메모",
    "child_health_issue": "null 또는 권고 메모",
    "parents_notified": "null 또는 권고 메모",
    "shuttle_checked": "null 또는 권고 메모",
    "notes": "특이사항 초안(개인식별정보 금지)",
    "improvement": "개선 필요사항 초안"
  },
  "emergency_contact_guide": "응급 연락 안내(119 등 공식 채널 우선)",
  "official_priority_notice": "공식기관 지시 우선 안내문",
  "safety_disclaimer": "공식 재난문자와 기관 입력정보를 바탕으로 한 대응지원 정보이며, 위급상황에서는 공식기관 지시와 119 안내를 우선합니다."
}`

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
    return { result: { ...SAMPLE_AI_RESULT }, is_fallback: true, model: 'sample' }
  }

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY })
  let lastRawText = ''

  // 1차 시도
  try {
    const raw = await withTimeout(
      callOnce(client, buildUserMessage(input)),
      TIMEOUT_MS
    )
    lastRawText = raw
    const parsed = AiPlanSchema.safeParse(JSON.parse(extractJson(raw)))
    if (parsed.success) {
      return {
        result: { ...parsed.data, safety_disclaimer: SAFETY_DISCLAIMER_FIXED },
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
      callOnce(client, buildRetryMessage(lastRawText)),
      TIMEOUT_MS
    )
    const parsed = AiPlanSchema.safeParse(JSON.parse(extractJson(raw)))
    if (parsed.success) {
      return {
        result: { ...parsed.data, safety_disclaimer: SAFETY_DISCLAIMER_FIXED },
        is_fallback: false,
        model: ANTHROPIC_MODEL,
        raw_text: raw,
      }
    }
    console.warn('[callClaude] 재시도도 zod 검증 실패, 샘플 fallback')
  } catch (err) {
    console.warn('[callClaude] 2차 재시도 실패:', err)
  }

  // 샘플 fallback (docs/04 §5 5번)
  return { result: { ...SAMPLE_AI_RESULT }, is_fallback: true, model: 'sample' }
}

async function callOnce(client: Anthropic, userContent: string): Promise<string> {
  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: userContent },
      { role: 'assistant', content: '{' }, // JSON-only 강제 (prefill)
    ],
  })
  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return '{' + text // prefill '{' 재결합
}
