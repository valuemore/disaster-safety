// 대응계획 발송 유틸 (서버 전용)
// 우선순위: 카카오 알림톡 → 실패/미사용 시 SMS → 키부재/샘플모드 시 'sample'(실발송 없이 성공 가장)
// 알림톡은 사업자 채널·템플릿 승인이 필요하므로 MVP에서는 구조 + fallback으로 동작한다.
import {
  USE_SAMPLE_FALLBACK,
  KAKAO_ALIMTALK_API_KEY,
  SMS_API_KEY,
} from '@/lib/env'

export interface NotifyTarget {
  /** 수신 전화번호 */
  phone: string
  /** 표시용 이름/직함 (선택) */
  name?: string | null
  /** 발송 본문(유아 PII 미포함) */
  message: string
  /** 채널 동의 */
  consent_sms: boolean
  consent_kakao: boolean
}

export interface NotifyResult {
  sent: number
  skipped: number
  source: 'kakao' | 'sms' | 'sample' | 'mixed'
}

const TIMEOUT_MS = 5_000

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), ms)),
  ])
}

/**
 * 단일 대상 발송. 알림톡 우선, 실패 시 SMS. 키 부재 시 'sample'.
 * 실제 사업자 API 연동 지점에는 주석으로 위치를 표기한다.
 */
async function sendOne(target: NotifyTarget): Promise<'kakao' | 'sms' | 'sample' | null> {
  // 알림톡 (consent_kakao + 키 존재)
  if (target.consent_kakao && KAKAO_ALIMTALK_API_KEY) {
    try {
      // TODO(실연동): 카카오 비즈메시지 알림톡 발송 API 호출 (발신프로필/템플릿 필요)
      // await withTimeout(fetch('https://...alimtalk...', {...}), TIMEOUT_MS)
      await withTimeout(Promise.resolve(), TIMEOUT_MS)
      return 'kakao'
    } catch {
      /* SMS로 폴백 */
    }
  }
  // SMS (consent_sms + 키 존재)
  if (target.consent_sms && SMS_API_KEY) {
    try {
      // TODO(실연동): SMS 발송 API 호출 (예: 알리고/NHN Toast 등)
      // await withTimeout(fetch('https://...sms...', {...}), TIMEOUT_MS)
      await withTimeout(Promise.resolve(), TIMEOUT_MS)
      return 'sms'
    } catch {
      return null
    }
  }
  return null
}

/**
 * 다중 대상 발송. 샘플 모드/키 부재 시 실발송 없이 성공 가장('sample').
 */
export async function sendNotifications(targets: NotifyTarget[]): Promise<NotifyResult> {
  const eligible = targets.filter((t) => (t.consent_kakao || t.consent_sms) && t.phone)
  const skipped = targets.length - eligible.length

  // 샘플 모드 또는 발송 키 전무 → 시뮬레이션
  if (USE_SAMPLE_FALLBACK || (!KAKAO_ALIMTALK_API_KEY && !SMS_API_KEY)) {
    return { sent: eligible.length, skipped, source: 'sample' }
  }

  const channels = new Set<string>()
  let sent = 0
  for (const t of eligible) {
    const ch = await sendOne(t)
    if (ch) {
      sent++
      channels.add(ch)
    }
  }

  const source: NotifyResult['source'] =
    channels.size === 0 ? 'sample' : channels.size > 1 ? 'mixed' : (Array.from(channels)[0] as 'kakao' | 'sms')
  return { sent, skipped: skipped + (eligible.length - sent), source }
}
