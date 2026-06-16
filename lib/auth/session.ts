/**
 * lib/auth/session.ts
 *
 * 간편 기관 로그인 세션 (서버 전용).
 * - 쿠키 `ds_session`에 HMAC-SHA256 서명된 토큰을 저장한다.
 * - 토큰 = base64url(JSON payload) + '.' + hex(HMAC).
 * - payload: { iid: 기관ID, name: 기관명, iat: 발급시각(ms), exp: 만료시각(ms) }
 * - httpOnly 쿠키이므로 클라이언트 JS에서 직접 읽을 수 없다.
 *   로그인 상태는 /api/auth/session 으로 확인한다.
 *
 * 주의: 인증의 실검증은 Route Handler / Server Component에서 수행한다.
 *       proxy.ts는 낙관적 체크(쿠키 존재 여부)만 담당한다.
 */

import { createHmac, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { SESSION_SECRET } from '@/lib/env'

export const SESSION_COOKIE = 'ds_session'
const MAX_AGE_MS = 12 * 60 * 60 * 1000 // 12시간

export interface SessionPayload {
  /** 기관 ID */
  iid: string
  /** 기관명 (헤더 표시용) */
  name: string
  /** 발급 시각 (ms) */
  iat: number
  /** 만료 시각 (ms) */
  exp: number
}

function b64urlEncode(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url')
}

function b64urlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8')
}

function sign(data: string): string {
  return createHmac('sha256', SESSION_SECRET).update(data).digest('hex')
}

/** 기관 정보로 서명된 세션 토큰 문자열 생성 */
export function createSessionToken(iid: string, name: string): string {
  const now = Date.now()
  const payload: SessionPayload = { iid, name, iat: now, exp: now + MAX_AGE_MS }
  const body = b64urlEncode(JSON.stringify(payload))
  const sig = sign(body)
  return `${body}.${sig}`
}

/** 토큰 검증 → payload (실패/만료 시 null) */
export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return null
  const body = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = sign(body)
  try {
    const a = Buffer.from(sig, 'hex')
    const b = Buffer.from(expected, 'hex')
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  } catch {
    return null
  }
  try {
    const payload = JSON.parse(b64urlDecode(body)) as SessionPayload
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return null
    if (!payload.iid) return null
    return payload
  } catch {
    return null
  }
}

/** 쿠키에 들어갈 옵션 (Route Handler에서 NextResponse.cookies.set에 사용) */
export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: MAX_AGE_MS / 1000,
}

/** 현재 요청의 세션 payload 조회 (Server Component / Route Handler) */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies()
  return verifySessionToken(store.get(SESSION_COOKIE)?.value)
}

/** 현재 로그인 기관 ID (없으면 null) */
export async function getSessionInstitutionId(): Promise<string | null> {
  return (await getSession())?.iid ?? null
}
