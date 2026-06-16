/**
 * lib/auth/pin.ts
 *
 * 기관 로그인 PIN 해시/검증 (서버 전용).
 * - Node.js crypto scrypt 사용 — 외부 의존 없음.
 * - 저장 형식: `scrypt$<saltHex>$<hashHex>`
 * - PIN은 4~8자리 숫자 권장(검증은 호출부에서). 평문 PIN은 절대 저장하지 않는다.
 */

import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'

const KEYLEN = 32

/** PIN 평문 → 해시 문자열 */
export function hashPin(pin: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(pin, salt, KEYLEN)
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`
}

/** PIN 평문이 저장된 해시와 일치하는지 검증 (타이밍 안전 비교) */
export function verifyPin(pin: string, stored: string | null | undefined): boolean {
  if (!stored) return false
  const parts = stored.split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  try {
    const salt = Buffer.from(parts[1], 'hex')
    const expected = Buffer.from(parts[2], 'hex')
    const actual = scryptSync(pin, salt, expected.length)
    if (actual.length !== expected.length) return false
    return timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}
